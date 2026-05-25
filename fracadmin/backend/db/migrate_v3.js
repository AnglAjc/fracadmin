require("dotenv").config();
const pool = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Categorías de movimientos financieros ──────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS finanzas_categorias (
        id         SERIAL PRIMARY KEY,
        nombre     VARCHAR(100) NOT NULL,
        tipo       VARCHAR(20)  NOT NULL DEFAULT 'gasto',
        -- 'gasto' | 'ingreso'
        color      VARCHAR(20)  DEFAULT '#854F0B',
        created_at TIMESTAMPTZ  DEFAULT NOW()
      )
    `);

    // Categorías iniciales
    await client.query(`
      INSERT INTO finanzas_categorias (nombre, tipo, color) VALUES
        ('Vigilancia',        'gasto',   '#A32D2D'),
        ('Luz',               'gasto',   '#854F0B'),
        ('Teléfono',          'gasto',   '#854F0B'),
        ('App WhatsApp',      'gasto',   '#854F0B'),
        ('Poda / Pasto',      'gasto',   '#3B6D11'),
        ('Arquitecto / Obra', 'gasto',   '#185FA5'),
        ('Mantenimiento',     'gasto',   '#5f5e5a'),
        ('Materiales',        'gasto',   '#5f5e5a'),
        ('Cuotas residentes', 'ingreso', '#3B6D11'),
        ('Terrenos / Otros',  'ingreso', '#185FA5')
      ON CONFLICT DO NOTHING
    `);

    // ── Cuentas de dinero ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS finanzas_cuentas (
        id          SERIAL PRIMARY KEY,
        nombre      VARCHAR(100) NOT NULL,
        tipo        VARCHAR(30)  NOT NULL DEFAULT 'efectivo',
        -- 'efectivo' | 'debito' | 'transferencia'
        saldo_inicial NUMERIC(12,2) DEFAULT 0,
        created_at  TIMESTAMPTZ  DEFAULT NOW()
      )
    `);

    // Cuentas iniciales (saldos del Excel)
    await client.query(`
      INSERT INTO finanzas_cuentas (nombre, tipo, saldo_inicial) VALUES
        ('Tarjeta Débito', 'debito',   0),
        ('Efectivo',       'efectivo', 0)
      ON CONFLICT DO NOTHING
    `);

    // ── Movimientos financieros ────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS finanzas_movimientos (
        id           SERIAL PRIMARY KEY,
        fecha        DATE         NOT NULL DEFAULT CURRENT_DATE,
        tipo         VARCHAR(20)  NOT NULL DEFAULT 'gasto',
        -- 'gasto' | 'ingreso'
        concepto     TEXT         NOT NULL,
        monto        NUMERIC(12,2) NOT NULL,
        categoria_id INTEGER      REFERENCES finanzas_categorias(id) ON DELETE SET NULL,
        cuenta_id    INTEGER      REFERENCES finanzas_cuentas(id) ON DELETE SET NULL,
        notas        TEXT,
        comprobante  TEXT,
        created_at   TIMESTAMPTZ  DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mov_fecha ON finanzas_movimientos(fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_mov_tipo  ON finanzas_movimientos(tipo);
    `);

    await client.query("COMMIT");
    console.log("Migracion v3 completada — finanzas");
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
