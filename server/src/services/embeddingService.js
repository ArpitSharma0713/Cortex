import pool from "../config/db.js";
import { embedTexts } from "../utils/embedder.js";
import { writeOutboxEvent } from "./outboxService.js";

const EMBED_BATCH_SIZE = 32;

export async function embedDocument(documentId) {
  const { rows: chunks } = await pool.query(
    `
      SELECT *
      FROM chunks
      WHERE document_id = $1
        AND is_embedded = FALSE
      ORDER BY chunk_index
    `,
    [documentId],
  );

  if (chunks.length === 0) {
    const { rows } = await pool.query(
      `
        SELECT COUNT(*)::int AS embedded_count
        FROM chunks
        WHERE document_id = $1
          AND is_embedded = TRUE
      `,
      [documentId],
    );

    return { embedded: rows[0].embedded_count };
  }

  for (let index = 0; index < chunks.length; index += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(index, index + EMBED_BATCH_SIZE);
    const texts = batch.map((chunk) => chunk.content);
    const vectors = await embedTexts(texts);
    const ids = batch.map((chunk) => chunk.id);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          UPDATE chunks
          SET is_embedded = TRUE
          WHERE id = ANY($1::uuid[])
        `,
        [ids],
      );

      await client.query(
        `
          UPDATE documents
          SET embedded_chunk_count = (
            SELECT COUNT(*)::int
            FROM chunks
            WHERE document_id = $1
              AND is_embedded = TRUE
          ),
          updated_at = NOW()
          WHERE id = $1
        `,
        [documentId],
      );

      await writeOutboxEvent(client, {
        eventType: "chunks_embedded",
        documentId,
        workspaceId: batch[0].workspace_id,
        payload: {
          points: batch.map((chunk, vectorIndex) => ({
            id: chunk.id,
            vector: vectors[vectorIndex],
            payload: {
              chunk_id: chunk.id,
              document_id: chunk.document_id,
              workspace_id: chunk.workspace_id,
              user_id: chunk.user_id,
              chunk_index: chunk.chunk_index,
              token_count: chunk.token_count,
              page_number: chunk.page_number,
              content: chunk.content,
            },
          })),
        },
      });

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const { rows } = await pool.query(
    `
      SELECT embedded_chunk_count
      FROM documents
      WHERE id = $1
    `,
    [documentId],
  );

  return { embedded: rows[0]?.embedded_chunk_count || 0 };
}
