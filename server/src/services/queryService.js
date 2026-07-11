import pool from "../config/db.js";

export async function createQuery(workspaceId, userId, question) {
  const { rows } = await pool.query(
    `
      INSERT INTO queries (workspace_id, user_id, question)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [workspaceId, userId, question],
  );

  return rows[0];
}

export async function completeQuery(queryId, answer, chunkIds, tokenCount) {
  const { rows } = await pool.query(
    `
      UPDATE queries
      SET answer = $1,
          chunk_ids = $2,
          token_count = $3,
          status = 'completed'
      WHERE id = $4
      RETURNING *
    `,
    [answer, chunkIds, tokenCount, queryId],
  );

  return rows[0] || null;
}

export async function failQuery(queryId, errorMessage) {
  const { rows } = await pool.query(
    `
      UPDATE queries
      SET status = 'failed',
          error_message = $1
      WHERE id = $2
      RETURNING *
    `,
    [errorMessage, queryId],
  );

  return rows[0] || null;
}

export async function getQueryCountToday(userId) {
  const { rows } = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM queries
      WHERE user_id = $1
        AND created_at >= CURRENT_DATE
        AND status != 'failed'
    `,
    [userId],
  );

  return rows[0].count;
}

export async function getRecentQueries(limit = 5) {
  const { rows } = await pool.query(
    `
      SELECT status, question, LEFT(answer, 60) AS answer_preview
      FROM queries
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return rows;
}

