require("dotenv").config({ path: "../.env" });
const pool = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Tabla de administradores ───────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id          SERIAL PRIMARY KEY,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nombre      VARCHAR(255),
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Tabla de residentes ────────────────────────────────────
    // Importados desde el Excel; son la fuente de verdad de quién vive aquí
    await client.query(`
      CREATE TABLE IF NOT EXISTS residents (
        id          VARCHAR(100) PRIMARY KEY,
        calle       VARCHAR(100) NOT NULL,
        lote        VARCHAR(20)  NOT NULL,
        mza         VARCHAR(20)  NOT NULL,
        residente   TEXT         NOT NULL,
        pagos25     JSONB        NOT NULL DEFAULT '{}',
        pagos26     JSONB        NOT NULL DEFAULT '{}',
        deuda_extra NUMERIC(10,2) DEFAULT 0,
        telefono    VARCHAR(30),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Tabla de pagos enviados por residentes ─────────────────
    // Cada formulario enviado desde la vista de residente
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_submissions (
        id            SERIAL PRIMARY KEY,
        resident_id   VARCHAR(100) REFERENCES residents(id) ON DELETE SET NULL,
        nombre        TEXT         NOT NULL,
        telefono      VARCHAR(30),
        calle         VARCHAR(100),
        lote          VARCHAR(20),
        mza           VARCHAR(20),
        mes           VARCHAR(30)  NOT NULL,
        anio          INTEGER      NOT NULL,
        monto         NUMERIC(10,2) NOT NULL,
        comprobante_url TEXT,
        notas         TEXT,
        status        VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
        -- pendiente | aprobado | rechazado
        reviewed_by   INTEGER REFERENCES admins(id),
        reviewed_at   TIMESTAMPTZ,
        rejection_reason TEXT,
        whatsapp_sent BOOLEAN DEFAULT FALSE,
        whatsapp_sent_at TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Índices ────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_submissions_status     ON payment_submissions(status);
      CREATE INDEX IF NOT EXISTS idx_submissions_resident   ON payment_submissions(resident_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_created    ON payment_submissions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_residents_calle        ON residents(calle);
    `);

    await client.query("COMMIT");
    console.log("✓ Migración completada");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("✗ Error en migración:", err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
