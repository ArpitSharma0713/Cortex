import pool from "../config/db.js";

export async function withTenantContext(userId, callback) {
  const client = await pool.connect();
  let result;
  let operationError;

  try {
    await client.query(
      "SELECT set_config('app.current_user_id', $1, false)",
      [userId],
    );
    result = await callback(client);
  } catch (error) {
    operationError = error;
  }

  let resetError;

  try {
    await client.query("RESET app.current_user_id");
  } catch (error) {
    resetError = error;
  }

  // Passing an error makes pg remove a connection whose tenant state is uncertain.
  client.release(resetError);

  if (operationError) {
    throw operationError;
  }

  if (resetError) {
    throw resetError;
  }

  return result;
}
