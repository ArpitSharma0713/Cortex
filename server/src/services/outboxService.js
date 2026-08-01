import pool from "../config/db.js";

export async function writeOutboxEvent(
  client,
  { eventType, documentId, workspaceId, payload },
) {
  await client.query(
    `
      INSERT INTO outbox_events (
        event_type,
        document_id,
        workspace_id,
        payload
      )
      VALUES ($1, $2, $3, $4)
    `,
    [eventType, documentId, workspaceId, JSON.stringify(payload)],
  );
}

export async function getPendingEvents(limit = 20) {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM outbox_events
      WHERE status = 'pending'
      ORDER BY created_at ASC, id ASC
      LIMIT $1
    `,
    [limit],
  );

  return rows;
}

export async function markEventProcessing(eventId) {
  const result = await pool.query(
    `
      UPDATE outbox_events
      SET status = 'processing',
          error_message = NULL
      WHERE id = $1
        AND status = 'pending'
      RETURNING id
    `,
    [eventId],
  );

  return result.rowCount > 0;
}

export async function markEventCompleted(eventId) {
  await pool.query(
    `
      UPDATE outbox_events
      SET status = 'completed',
          error_message = NULL,
          processed_at = NOW()
      WHERE id = $1
    `,
    [eventId],
  );
}

export async function markEventFailed(eventId, errorMessage) {
  await pool.query(
    `
      UPDATE outbox_events
      SET status = 'failed',
          error_message = $1,
          attempts = attempts + 1
      WHERE id = $2
    `,
    [errorMessage, eventId],
  );
}

export async function recoverProcessingEvents() {
  const result = await pool.query(
    `
      UPDATE outbox_events
      SET status = 'pending'
      WHERE status = 'processing'
    `,
  );

  return result.rowCount;
}
