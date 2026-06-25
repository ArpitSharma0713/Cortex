import { v4 as uuidv4 } from "uuid";
import * as documentService from "../services/documentService.js";
import * as workspaceService from "../services/workspaceService.js";
import { chunkText } from "../utils/chunker.js";
import { extractTextFromBuffer } from "../utils/pdfParser.js";

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
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    await assertWorkspaceOwner(req.params.workspaceId, req.user.id);

    const document = await documentService.createDocument(
      req.params.workspaceId,
      req.user.id,
      {
        name: req.body.name || req.file.originalname,
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    );

    res.status(202).json({
      documentId: document.id,
      status: "pending",
      message: "Document received, processing started",
    });

    processDocument(
      document.id,
      req.file.buffer,
      req.params.workspaceId,
      req.user.id,
    ).catch((error) =>
      console.error(`Processing failed for ${document.id}:`, error),
    );
  } catch (error) {
    return next(error);
  }
}

async function processDocument(documentId, buffer, workspaceId, userId) {
  await documentService.updateDocumentStatus(documentId, "processing");

  try {
    const { text, pageCount } = await extractTextFromBuffer(buffer);
    const chunks = chunkText(text);

    const chunkRecords = chunks.map((chunk) => ({
      id: uuidv4(),
      documentId,
      workspaceId,
      userId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      pageNumber: null,
    }));

    await documentService.insertChunks(chunkRecords);
    await documentService.updateDocumentStatus(documentId, "ready", {
      pageCount,
      chunkCount: chunks.length,
    });
  } catch (error) {
    await documentService.updateDocumentStatus(documentId, "failed", {
      errorMessage: error.message,
    });
  }
}

export async function listDocuments(req, res, next) {
  try {
    await assertWorkspaceOwner(req.params.workspaceId, req.user.id);

    const documents = await documentService.getDocumentsByWorkspace(
      req.params.workspaceId,
      req.user.id,
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

    const document = await documentService.getDocumentById(
      req.params.id,
      req.params.workspaceId,
      req.user.id,
    );

    if (!document) {
      throw createError(404, "Document not found");
    }

    return res.status(200).json(formatDocument(document));
  } catch (error) {
    return next(error);
  }
}

export async function deleteDocument(req, res, next) {
  try {
    await assertWorkspaceOwner(req.params.workspaceId, req.user.id);

    const wasDeleted = await documentService.deleteDocument(
      req.params.id,
      req.params.workspaceId,
      req.user.id,
    );

    if (!wasDeleted) {
      throw createError(404, "Document not found");
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
