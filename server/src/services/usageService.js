import pool from "../config/db.js";
import { getPlanLimits } from "../config/limits.js";

export async function getUserPlan(userId) {
  const result = await pool.query("SELECT plan FROM users WHERE id = $1", [
    userId,
  ]);

  return result.rows[0]?.plan || "free";
}

export async function getDailyQueryUsage(userId) {
  const result = await pool.query(
    `
      SELECT query_count
      FROM user_query_usage
      WHERE user_id = $1
        AND usage_date = CURRENT_DATE
    `,
    [userId],
  );

  return result.rows[0]?.query_count || 0;
}

export async function consumeDailyQueryQuota(userId) {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);

  const result = await pool.query(
    `
      INSERT INTO user_query_usage (user_id, usage_date, query_count)
      VALUES ($1, CURRENT_DATE, 1)
      ON CONFLICT (user_id, usage_date)
      DO UPDATE
      SET query_count = user_query_usage.query_count + 1,
          updated_at = NOW()
      WHERE user_query_usage.query_count < $2
      RETURNING usage_date, query_count
    `,
    [userId, limits.queriesPerDay],
  );

  if (result.rows.length === 0) {
    const currentUsage = await getDailyQueryUsage(userId);
    const error = new Error("Daily query limit exceeded");
    error.statusCode = 429;
    error.details = {
      plan,
      limit: limits.queriesPerDay,
      used: currentUsage,
    };
    throw error;
  }

  return {
    plan,
    limit: limits.queriesPerDay,
    used: result.rows[0].query_count,
    usageDate: result.rows[0].usage_date,
  };
}
