import {
  enqueueDocumentProcessing,
  retryDocumentProcessing,
} from "../queues/documentQueue.js";
import * as documentService from "../services/documentService.js";
import {
  buildStorageKey,
  computeHash,
  downloadFromR2,
  uploadToR2,
} from "../services/storageService.js";
import * as workspaceService from "../services/workspaceService.js";
import { withTenantContext } from "../middleware/withTenantContext.js";

function formatDocument(document) {
  return {
    id: document.id,
    workspaceId: document.workspace_id,
    userId: document.user_id,
    name: document.name,
    originalFilename: document.original_filename,
    fileSize: document.file_size,
    mimeType: document.mime_type,
    status: document.status,
    pageCount: document.page_count,
    chunkCount: document.chunk_count,
    embeddedChunkCount: document.embedded_chunk_count,
    storageKey: document.storage_key,
    sha256Hash: document.sha256_hash,
    deletedAt: document.deleted_at,
    errorMessage: document.error_message,
    createdAt: document.created_at,
    updatedAt: document.updated_at,
  };
}

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function assertWorkspaceOwner(workspaceId, userId) {
  const workspace = await workspaceService.getWorkspaceById(workspaceId, userId);

  if (!workspace) {
    throw createError(404, "Workspace not found");
  }

  return workspace;
}

export async function uploadDocument(req, res, next) {
  let document;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    await assertWorkspaceOwner(req.params.workspaceId, req.user.id);

    const hash = computeHash(req.file.buffer);
    const lookup = await withTenantContext(req.user.id, async (client) => {
      const existingDocument = await documentService.findByHash(
        client,
        req.params.workspaceId,
        req.user.id,
        hash,
      );

      if (existingDocument) {
        return { existingDocument };
      }

      const createdDocument = await documentService.createDocument(
        client,
        req.params.workspaceId,
        req.user.id,
        {
          name: req.body.name || req.file.originalname,
          originalFilename: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          sha256Hash: hash,
        },
      );

      return { createdDocument };
    });

    if (lookup.existingDocument) {
      return res.status(409).json({
        error: "This file has already been uploaded to this workspace",
        documentId: lookup.existingDocument.id,
      });
    }

    document = lookup.createdDocument;

    const storageKey = buildStorageKey(
      req.params.workspaceId,
      document.id,
      req.file.originalname,
    );

    await uploadToR2(storageKey, req.file.buffer, req.file.mimetype);
    await withTenantContext(req.user.id, (client) =>
      documentService.setStorageKey(
        client,
        document.id,
        req.user.id,
        storageKey,
      ),
    );
    await enqueueDocumentProcessing(
      document.id,
      storageKey,
      req.params.workspaceId,
      req.user.id,
    );

    return res.status(202).json({
      documentId: document.id,
      status: "pending",
      message: "Document received, queued for processing",
    });
  } catch (error) {
    if (document) {
      await withTenantContext(req.user.id, (client) =>
        documentService.updateDocumentStatus(
          client,
          document.id,
          req.user.id,
          "failed",
          { errorMessage: error.message },
        ),
      )
        .catch(() => {});
    }

    return next(error);
  }
}

function attachmentFilename(filename) {
  return filename.replace(/[\r\n"]/g, "_");
}

export async function getEmbeddingStatus(req, res, next) {
  try {
    await assertWorkspaceOwner(req.params.workspaceId, req.user.id);

    const document = await withTenantContext(req.user.id, (client) =>
      documentService.getDocumentById(
        client,
        req.params.id,
        req.params.workspaceId,
        req.user.id,
      ),
    );

    if (!document) {
      throw createError(404, "Document not found");
    }

    const formattedDocument = formatDocument(document);

    return res.status(200).json({
      documentId: formattedDocument.id,
      status: formattedDocument.status,
      chunkCount: formattedDocument.chunkCount,
      embeddedChunkCount: formattedDocument.embeddedChunkCount,
      isFullyEmbedded:
        formattedDocument.chunkCount === formattedDocument.embeddedChunkCount &&
        formattedDocument.chunkCount > 0,
      errorMessage: formattedDocument.errorMessage || null,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listDocuments(req, res, next) {
  try {
    await assertWorkspaceOwner(req.params.workspaceId, req.user.id);

    const documents = await withTenantContext(req.user.id, (client) =>
      documentService.getDocumentsByWorkspace(
        client,
        req.params.workspaceId,
        req.user.id,
      ),
    );

    return res.status(200).json({
      documents: documents.map(formatDocument),
      count: documents.length,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getDocument(req, res, next) {
  try {
    await assertWorkspaceOwner(req.params.workspaceId, req.user.id);

    const document = await withTenantContext(req.user.id, (client) =>
      documentService.getDocumentById(
        client,
        req.params.id,
        req.params.workspaceId,
        req.user.id,
      ),
    );

    if (!document) {
      throw createError(404, "Document not found");
    }

    return res.status(200).json(formatDocument(document));
  } catch (error) {
    return next(error);
  }
}

export async function downloadDocument(req, res, next) {
  try {
    await assertWorkspaceOwner(req.params.workspaceId, req.user.id);

    const document = await withTenantContext(req.user.id, (client) =>
      documentService.getDocumentById(
        client,
        req.params.id,
        req.params.workspaceId,
        req.user.id,
      ),
    );

    if (!document || !document.storage_key) {
      throw createError(404, "Document not found");
    }

    const buffer = await downloadFromR2(document.storage_key);

    res.setHeader("Content-Type", document.mime_type);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${attachmentFilename(document.original_filename)}"`,
    );

    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
}

export async function retryDocument(req, res, next) {
  try {
    await assertWorkspaceOwner(req.params.workspaceId, req.user.id);

    const document = await withTenantContext(req.user.id, (client) =>
      documentService.getDocumentById(
        client,
        req.params.id,
        req.params.workspaceId,
        req.user.id,
      ),
    );

    if (!document) {
      throw createError(404, "Document not found");
    }

    if (document.status !== "failed") {
      return res.status(400).json({ error: "Only failed documents can be retried" });
    }

    if (!document.storage_key) {
      return res.status(400).json({ error: "No stored file to retry from" });
    }

    await retryDocumentProcessing(
      document.id,
      document.storage_key,
      req.params.workspaceId,
      req.user.id,
    );
    await withTenantContext(req.user.id, (client) =>
      documentService.updateDocumentStatus(
        client,
        document.id,
        req.user.id,
        "pending",
        { errorMessage: null },
      ),
    );

    return res.status(202).json({
      documentId: document.id,
      status: "pending",
      message: "Retry queued",
    });
  } catch (error) {
    return next(error);
  }
}
export async function deleteDocument(req, res, next) {
  try {
    await assertWorkspaceOwner(req.params.workspaceId, req.user.id);

    const wasDeleted = await withTenantContext(req.user.id, (client) =>
      documentService.deleteDocument(
        client,
        req.params.id,
        req.params.workspaceId,
        req.user.id,
      ),
    );

    if (!wasDeleted) {
      throw createError(404, "Document not found");
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
