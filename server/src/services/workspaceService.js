import pool from "../config/db.js";

const workspaceSelect = `
  id,
  user_id,
  name,
  description,
  mode,
  document_count,
  created_at,
  updated_at
`;

export async function createWorkspace(userId, { name, description, mode }) {
  const result = await pool.query(
    `
      INSERT INTO workspaces (user_id, name, description, mode)
      VALUES ($1, $2, $3, $4)
      RETURNING ${workspaceSelect}
    `,
    [userId, name, description || null, mode],
  );

  return result.rows[0];
}

export async function getWorkspacesByUser(userId) {
  const result = await pool.query(
    `
      SELECT ${workspaceSelect}
      FROM workspaces
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId],
  );

  return result.rows;
}

export async function getWorkspaceById(workspaceId, userId) {
  const result = await pool.query(
    `
      SELECT ${workspaceSelect}
      FROM workspaces
      WHERE id = $1
        AND user_id = $2
    `,
    [workspaceId, userId],
  );

  return result.rows[0] || null;
}

export async function updateWorkspace(workspaceId, userId, updates) {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    values.push(value);
    fields.push(`${key} = $${values.length}`);
  }

  values.push(workspaceId, userId);

  const result = await pool.query(
    `
      UPDATE workspaces
      SET ${fields.join(", ")},
          updated_at = NOW()
      WHERE id = $${values.length - 1}
        AND user_id = $${values.length}
      RETURNING ${workspaceSelect}
    `,
    values,
  );

  return result.rows[0] || null;
}

export async function deleteWorkspace(workspaceId, userId) {
  const result = await pool.query(
    `
      DELETE FROM workspaces
      WHERE id = $1
        AND user_id = $2
      RETURNING id
    `,
    [workspaceId, userId],
  );

  return result.rowCount > 0;
}
