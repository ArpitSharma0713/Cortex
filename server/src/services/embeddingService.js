import { withTenantContext } from "../middleware/withTenantContext.js";
import { embedTexts } from "../utils/embedder.js";
import { writeOutboxEvent } from "./outboxService.js";

const EMBED_BATCH_SIZE = 32;

export async function embedDocument(documentId, userId) {
  const chunks = await withTenantContext(userId, async (client) => {
    const { rows } = await client.query(
      `
        SELECT *
        FROM chunks
        WHERE document_id = $1
          AND user_id = $2
          AND is_embedded = FALSE
        ORDER BY chunk_index
      `,
      [documentId, userId],
    );

    return rows;
  });

  if (chunks.length === 0) {
    return withTenantContext(userId, async (client) => {
      const { rows } = await client.query(
        `
          SELECT COUNT(*)::int AS embedded_count
          FROM chunks
          WHERE document_id = $1
            AND user_id = $2
            AND is_embedded = TRUE
        `,
        [documentId, userId],
      );

      return { embedded: rows[0].embedded_count };
    });
  }

  for (let index = 0; index < chunks.length; index += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(index, index + EMBED_BATCH_SIZE);
    const texts = batch.map((chunk) => chunk.content);
    const vectors = await embedTexts(texts);
    const ids = batch.map((chunk) => chunk.id);

    await withTenantContext(userId, async (client) => {
      try {
        await client.query("BEGIN");
        await client.query(
          `
            UPDATE chunks
            SET is_embedded = TRUE
            WHERE id = ANY($1::uuid[])
              AND user_id = $2
          `,
          [ids, userId],
        );

        await client.query(
          `
            UPDATE documents
            SET embedded_chunk_count = (
              SELECT COUNT(*)::int
              FROM chunks
              WHERE document_id = $1
                AND user_id = $2
                AND is_embedded = TRUE
            ),
            updated_at = NOW()
            WHERE id = $1
              AND user_id = $2
          `,
          [documentId, userId],
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
      }
    });
  }

  return withTenantContext(userId, async (client) => {
    const { rows } = await client.query(
      `
        SELECT embedded_chunk_count
        FROM documents
        WHERE id = $1
          AND user_id = $2
      `,
      [documentId, userId],
    );

    return { embedded: rows[0]?.embedded_chunk_count || 0 };
  });
}
