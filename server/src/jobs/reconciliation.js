import pool from "../config/db.js";
import { qdrant } from "../config/qdrant.js";
import { withTenantContext } from "../middleware/withTenantContext.js";

const RECONCILIATION_BATCH_SIZE = Number.parseInt(
  process.env.RECONCILIATION_BATCH_SIZE || "100",
  10,
);

function collectionName() {
  return process.env.QDRANT_COLLECTION;
}

export async function runReconciliation() {
  console.log("Running reconciliation check...");

  const { rows: users } = await pool.query("SELECT id FROM users ORDER BY id");
  const embeddedChunks = [];

  for (const user of users) {
    const tenantChunks = await withTenantContext(user.id, async (client) => {
      const { rows } = await client.query(
        `
          SELECT chunks.id, chunks.document_id
          FROM chunks
          INNER JOIN documents ON documents.id = chunks.document_id
          WHERE chunks.user_id = $1
            AND documents.user_id = $1
            AND chunks.is_embedded = TRUE
            AND documents.deleted_at IS NULL
          ORDER BY chunks.id
        `,
        [user.id],
      );

      return rows;
    });

    embeddedChunks.push(...tenantChunks);
  }

  const missingFromQdrant = [];

  for (
    let index = 0;
    index < embeddedChunks.length;
    index += RECONCILIATION_BATCH_SIZE
  ) {
    const batch = embeddedChunks.slice(index, index + RECONCILIATION_BATCH_SIZE);
    const ids = batch.map((chunk) => chunk.id);

    try {
      const points = await qdrant.retrieve(collectionName(), { ids });
      const foundIds = new Set(points.map((point) => String(point.id)));

      for (const chunk of batch) {
        if (!foundIds.has(String(chunk.id))) {
          missingFromQdrant.push(chunk.id);
        }
      }
    } catch (error) {
      console.error(
        `Reconciliation check failed for chunk batch beginning ${ids[0]}:`,
        error.message,
      );
    }
  }

  if (missingFromQdrant.length > 0) {
    console.warn(
      `Reconciliation found ${missingFromQdrant.length} chunks missing from Qdrant:`,
      missingFromQdrant,
    );
  } else {
    console.log("Reconciliation: no drift detected");
  }

  return {
    checked: embeddedChunks.length,
    missing: missingFromQdrant.length,
  };
}
