require("dotenv").config();
const pool = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE residents
      ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_residents_tags ON residents USING GIN(tags)
    `);

    await client.query("COMMIT");
    console.log("✓ Migracion v5 completada — columna tags agregada a residents");
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
