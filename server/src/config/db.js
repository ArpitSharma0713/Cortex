import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

export async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log(`Database connected at ${result.rows[0].now.toISOString()}`);
  } catch (error) {
    console.error("Database connection failed:", error.message || error.code || JSON.stringify(error));
    throw error;
  }
}

export default pool;