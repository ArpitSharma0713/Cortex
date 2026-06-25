import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log(`Database connected at ${result.rows[0].now.toISOString()}`);
  } catch (error) {
    console.error("Database connection failed:", error.message);
    throw error;
  }
}

export default pool;
