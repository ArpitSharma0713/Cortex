import pool from "../config/db.js";

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
  error_message,
  created_at,
  updated_at
`;

const statusExtraColumns = {
  pageCount: "page_count",
  chunkCount: "chunk_count",
  errorMessage: "error_message",
};

export async function createDocument(
  workspaceId,
  userId,
  { name, originalFilename, fileSize, mimeType },
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
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING ${documentSelect}
      `,
      [workspaceId, userId, name, originalFilename, fileSize, mimeType],
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
    `,
    [documentId, workspaceId, userId],
  );

  return result.rows[0] || null;
}

export async function deleteDocument(documentId, workspaceId, userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        DELETE FROM documents
        WHERE id = $1
          AND workspace_id = $2
          AND user_id = $3
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
    return result.rowCount > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
