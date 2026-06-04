require("dotenv").config();
const pool = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Agregar columna pausado
    await client.query(`
      ALTER TABLE residents
      ADD COLUMN IF NOT EXISTS pausado BOOLEAN DEFAULT FALSE
    `);

    // Ampliar lote y mza de VARCHAR(20) a VARCHAR(100)
    await client.query(`
      ALTER TABLE residents
        ALTER COLUMN lote TYPE VARCHAR(100),
        ALTER COLUMN mza  TYPE VARCHAR(100)
    `);

    // También en payment_submissions
    await client.query(`
      ALTER TABLE payment_submissions
        ALTER COLUMN lote TYPE VARCHAR(100),
        ALTER COLUMN mza  TYPE VARCHAR(100)
    `);

    await client.query("COMMIT");
    console.log("✓ Migracion v4 completada");
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
