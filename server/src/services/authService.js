import pool from "../config/db.js";

const userSelect = `
  id,
  email,
  password_hash,
  full_name,
  google_id,
  created_at,
  updated_at
`;

export async function createUser({ email, passwordHash, fullName }) {
  const result = await pool.query(
    `
      INSERT INTO users (email, password_hash, full_name)
      VALUES ($1, $2, $3)
      RETURNING ${userSelect}
    `,
    [email.toLowerCase(), passwordHash, fullName || null],
  );

  return result.rows[0];
}

export async function findUserById(id) {
  const result = await pool.query(
    `
      SELECT ${userSelect}
      FROM users
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
}

export async function findUserByEmail(email) {
  const result = await pool.query(
    `
      SELECT ${userSelect}
      FROM users
      WHERE email = $1
    `,
    [email.toLowerCase()],
  );

  return result.rows[0] || null;
}

export async function findUserByGoogleId(googleId) {
  const result = await pool.query(
    `
      SELECT ${userSelect}
      FROM users
      WHERE google_id = $1
    `,
    [googleId],
  );

  return result.rows[0] || null;
}

export async function createOrUpdateGoogleUser({ googleId, email, fullName }) {
  const existingGoogleUser = await findUserByGoogleId(googleId);

  if (existingGoogleUser) {
    const result = await pool.query(
      `
        UPDATE users
        SET email = $1,
            full_name = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING ${userSelect}
      `,
      [
        email.toLowerCase(),
        fullName || existingGoogleUser.full_name,
        existingGoogleUser.id,
      ],
    );

    return result.rows[0];
  }

  const existingEmailUser = await findUserByEmail(email);

  if (existingEmailUser) {
    const result = await pool.query(
      `
        UPDATE users
        SET google_id = $1,
            full_name = COALESCE($2, full_name),
            updated_at = NOW()
        WHERE id = $3
        RETURNING ${userSelect}
      `,
      [googleId, fullName || null, existingEmailUser.id],
    );

    return result.rows[0];
  }

  const result = await pool.query(
    `
      INSERT INTO users (email, full_name, google_id)
      VALUES ($1, $2, $3)
      RETURNING ${userSelect}
    `,
    [email.toLowerCase(), fullName || null, googleId],
  );

  return result.rows[0];
}

export async function storeRefreshToken(userId, tokenHash, expiresAt) {
  const result = await pool.query(
    `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, token_hash, expires_at, created_at
    `,
    [userId, tokenHash, expiresAt],
  );

  return result.rows[0];
}

export async function findRefreshToken(tokenHash) {
  const result = await pool.query(
    `
      SELECT
        refresh_tokens.id,
        refresh_tokens.user_id,
        refresh_tokens.token_hash,
        refresh_tokens.expires_at,
        refresh_tokens.created_at,
        users.email,
        users.full_name
      FROM refresh_tokens
      JOIN users ON users.id = refresh_tokens.user_id
      WHERE refresh_tokens.token_hash = $1
    `,
    [tokenHash],
  );

  return result.rows[0] || null;
}

export async function deleteRefreshToken(tokenHash) {
  await pool.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [
    tokenHash,
  ]);
}

export async function deleteAllUserRefreshTokens(userId) {
  await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);
}
