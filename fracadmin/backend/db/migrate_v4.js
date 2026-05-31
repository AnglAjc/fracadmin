require("dotenv").config();
const pool = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Agregar columna pausado a residents
    await client.query(`
      ALTER TABLE residents
      ADD COLUMN IF NOT EXISTS pausado BOOLEAN DEFAULT FALSE
    `);
    await client.query("COMMIT");
    console.log("Migracion v4 completada — campo pausado en residents");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}
migrate();
