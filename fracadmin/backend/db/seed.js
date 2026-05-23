require("dotenv").config();
const pool = require("./pool");
const bcrypt = require("bcryptjs");

async function seed() {
  const client = await pool.connect();
  try {
    const email = process.env.ADMIN_EMAIL || "admin@fraccionamiento.com";
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      console.error("Define ADMIN_PASSWORD en el .env");
      process.exit(1);
    }
    const hash = await bcrypt.hash(password, 12);
    await client.query(`
      INSERT INTO admins (email, password_hash, nombre)
      VALUES ($1, $2, 'Administrador')
      ON CONFLICT (email) DO UPDATE SET password_hash = $2
    `, [email.toLowerCase().trim(), hash]);
    console.log("Admin creado: " + email);
  } catch (err) {
    console.error("Error en seed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
