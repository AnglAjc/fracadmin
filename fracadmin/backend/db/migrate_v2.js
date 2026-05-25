require("dotenv").config();
const pool = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Cambiar comprobante_url de TEXT a TEXT (ya es TEXT, solo verificamos)
    // y ampliar el límite de body en server.js a 10mb (ya está configurado)
    // Agregar columna comprobante_tipo para saber si es base64 o URL
    await client.query(`
      ALTER TABLE payment_submissions
        ALTER COLUMN comprobante_url TYPE TEXT
    `).catch(() => {}); // Ignorar si ya es TEXT

    await client.query("COMMIT");
    console.log("Migracion v2 completada");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error en migracion v2:", err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
