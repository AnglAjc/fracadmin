require("dotenv").config();
const pool = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE residents
      ADD COLUMN IF NOT EXISTS pagos27 JSONB NOT NULL DEFAULT '{}'
    `);

    await client.query("COMMIT");
    console.log("✓ Migracion v6 completada — columna pagos27 agregada a residents");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("✗ Error:", err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
