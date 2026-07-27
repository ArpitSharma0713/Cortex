import pool from "../config/db.js";
import { deleteDocumentVectors } from "./embeddingService.js";
import { deleteFromR2 } from "./storageService.js";

const documentSelect = `
  id,
  workspace_id,
  user_id,
  name,
  original_filename,
  file_size,
  mime_type,
  status,
  page_count,
  chunk_count,
  embedded_chunk_count,
  storage_key,
  sha256_hash,
  deleted_at,
  error_message,
  created_at,
  updated_at
`;

const statusExtraColumns = {
  pageCount: "page_count",
  chunkCount: "chunk_count",
  embeddedChunkCount: "embedded_chunk_count",
  errorMessage: "error_message",
};

export async function createDocument(
  workspaceId,
  userId,
  { name, originalFilename, fileSize, mimeType, sha256Hash },
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        INSERT INTO documents (
          workspace_id,
          user_id,
          name,
          original_filename,
          file_size,
          mime_type,
          sha256_hash,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING ${documentSelect}
      `,
      [
        workspaceId,
        userId,
        name,
        originalFilename,
        fileSize,
        mimeType,
        sha256Hash,
      ],
    );

    await client.query(
      `
        UPDATE workspaces
        SET document_count = document_count + 1,
            updated_at = NOW()
        WHERE id = $1
          AND user_id = $2
      `,
      [workspaceId, userId],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findByHash(workspaceId, hash) {
  const result = await pool.query(
    `
      SELECT ${documentSelect}
      FROM documents
      WHERE workspace_id = $1
        AND sha256_hash = $2
        AND deleted_at IS NULL
    `,
    [workspaceId, hash],
  );

  return result.rows[0] || null;
}

export async function setStorageKey(documentId, storageKey) {
  const result = await pool.query(
    `
      UPDATE documents
      SET storage_key = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING ${documentSelect}
    `,
    [storageKey, documentId],
  );

  return result.rows[0] || null;
}

export async function updateDocumentStatus(documentId, status, extra = {}) {
  const fields = ["status = $1", "updated_at = NOW()"];
  const params = [status];

  for (const [key, value] of Object.entries(extra)) {
    const column = statusExtraColumns[key];

    if (column) {
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    }
  }

  params.push(documentId);

  const result = await pool.query(
    `
      UPDATE documents
      SET ${fields.join(", ")}
      WHERE id = $${params.length}
      RETURNING ${documentSelect}
    `,
    params,
  );

  return result.rows[0] || null;
}

export async function clearDocumentChunks(documentId) {
  try {
    await deleteDocumentVectors(documentId);
  } catch (error) {
    const message = error.data?.status?.error || error.message || "";

    if (!message.toLowerCase().includes("not found")) {
      throw error;
    }
  }

  await pool.query("DELETE FROM chunks WHERE document_id = $1", [documentId]);
  await pool.query(
    `
      UPDATE documents
      SET chunk_count = 0,
          embedded_chunk_count = 0,
          updated_at = NOW()
      WHERE id = $1
    `,
    [documentId],
  );
}
export async function insertChunks(chunks) {
  if (chunks.length === 0) {
    return [];
  }

  const values = chunks
    .map((chunk, index) => {
      const offset = index * 8;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
    })
    .join(", ");

  const params = chunks.flatMap((chunk) => [
    chunk.id,
    chunk.documentId,
    chunk.workspaceId,
    chunk.userId,
    chunk.chunkIndex,
    chunk.content,
    chunk.tokenCount,
    chunk.pageNumber,
  ]);

  const result = await pool.query(
    `
      INSERT INTO chunks (
        id,
        document_id,
        workspace_id,
        user_id,
        chunk_index,
        content,
        token_count,
        page_number
      )
      VALUES ${values}
      RETURNING id
    `,
    params,
  );

  return result.rows;
}

export async function getDocumentsByWorkspace(workspaceId, userId) {
  const result = await pool.query(
    `
      SELECT ${documentSelect}
      FROM documents
      WHERE workspace_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    `,
    [workspaceId, userId],
  );

  return result.rows;
}

export async function getDocumentById(documentId, workspaceId, userId) {
  const result = await pool.query(
    `
      SELECT ${documentSelect}
      FROM documents
      WHERE id = $1
        AND workspace_id = $2
        AND user_id = $3
        AND deleted_at IS NULL
    `,
    [documentId, workspaceId, userId],
  );

  return result.rows[0] || null;
}

export async function deleteDocument(documentId, workspaceId, userId) {
  const existingDocument = await getDocumentById(documentId, workspaceId, userId);

  if (!existingDocument) {
    return false;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        UPDATE documents
        SET deleted_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND workspace_id = $2
          AND user_id = $3
          AND deleted_at IS NULL
        RETURNING id
      `,
      [documentId, workspaceId, userId],
    );

    if (result.rowCount > 0) {
      await client.query(
        `
          UPDATE workspaces
          SET document_count = GREATEST(document_count - 1, 0),
              updated_at = NOW()
          WHERE id = $1
            AND user_id = $2
        `,
        [workspaceId, userId],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  try {
    await deleteDocumentVectors(documentId);
  } catch (error) {
    const message = error.data?.status?.error || error.message || "";

    if (!message.toLowerCase().includes("not found")) {
      throw error;
    }
  }

  if (existingDocument.storage_key) {
    await deleteFromR2(existingDocument.storage_key);
  }

  return true;
}
