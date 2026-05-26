const router = require("express").Router();
const pool   = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");

// Todos los endpoints requieren auth
router.use(requireAuth);

// ── CATEGORÍAS ─────────────────────────────────────────────────
router.get("/categorias", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM finanzas_categorias ORDER BY tipo, nombre");
  res.json(rows);
});

router.post("/categorias", async (req, res) => {
  const { nombre, tipo, color } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  const { rows } = await pool.query(
    "INSERT INTO finanzas_categorias (nombre, tipo, color) VALUES ($1,$2,$3) RETURNING *",
    [nombre, tipo || "gasto", color || "#854F0B"]
  );
  res.status(201).json(rows[0]);
});

// ── CUENTAS ────────────────────────────────────────────────────
router.get("/cuentas", async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      c.*,
      c.saldo_inicial
        + COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN m.tipo='gasto'   THEN m.monto ELSE 0 END), 0)
      AS saldo_actual
    FROM finanzas_cuentas c
    LEFT JOIN finanzas_movimientos m ON m.cuenta_id = c.id
    GROUP BY c.id
    ORDER BY c.id
  `);
  res.json(rows);
});

router.post("/cuentas", async (req, res) => {
  const { nombre, tipo, saldo_inicial } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });
  const { rows } = await pool.query(
    "INSERT INTO finanzas_cuentas (nombre, tipo, saldo_inicial) VALUES ($1,$2,$3) RETURNING *",
    [nombre, tipo || "efectivo", Number(saldo_inicial) || 0]
  );
  res.status(201).json(rows[0]);
});

router.patch("/cuentas/:id", async (req, res) => {
  const { nombre, saldo_inicial } = req.body;
  const { rows } = await pool.query(
    "UPDATE finanzas_cuentas SET nombre=COALESCE($1,nombre), saldo_inicial=COALESCE($2,saldo_inicial) WHERE id=$3 RETURNING *",
    [nombre || null, saldo_inicial != null ? Number(saldo_inicial) : null, req.params.id]
  );
  res.json(rows[0]);
});

// ── MOVIMIENTOS ────────────────────────────────────────────────
router.get("/movimientos", async (req, res) => {
  const { tipo, categoria_id, cuenta_id, desde, hasta, page = 1, limit = 100 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const params = [];
  let where = "WHERE TRUE";

  if (tipo)         { params.push(tipo);         where += ` AND m.tipo = $${params.length}`; }
  if (categoria_id) { params.push(categoria_id); where += ` AND m.categoria_id = $${params.length}`; }
  if (cuenta_id)    { params.push(cuenta_id);    where += ` AND m.cuenta_id = $${params.length}`; }
  if (desde)        { params.push(desde);        where += ` AND m.fecha >= $${params.length}`; }
  if (hasta)        { params.push(hasta);        where += ` AND m.fecha <= $${params.length}`; }

  const { rows } = await pool.query(`
    SELECT m.*, c.nombre AS categoria_nombre, c.color AS categoria_color,
           ct.nombre AS cuenta_nombre
    FROM finanzas_movimientos m
    LEFT JOIN finanzas_categorias c  ON c.id  = m.categoria_id
    LEFT JOIN finanzas_cuentas    ct ON ct.id = m.cuenta_id
    ${where}
    ORDER BY m.fecha DESC, m.id DESC
    LIMIT $${params.length+1} OFFSET $${params.length+2}
  `, [...params, Number(limit), offset]);

  const { rows: cr } = await pool.query(
    `SELECT COUNT(*) FROM finanzas_movimientos m ${where}`, params
  );

  res.json({ data: rows, total: Number(cr[0].count) });
});

// Resumen financiero (para dashboard de finanzas)
router.get("/resumen", async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END) AS total_ingresos,
      SUM(CASE WHEN tipo='gasto'   THEN monto ELSE 0 END) AS total_gastos,
      COUNT(*) AS total_movimientos
    FROM finanzas_movimientos
  `);

  const { rows: porCategoria } = await pool.query(`
    SELECT c.nombre, c.color, m.tipo,
           SUM(m.monto) AS total, COUNT(*) AS cantidad
    FROM finanzas_movimientos m
    JOIN finanzas_categorias c ON c.id = m.categoria_id
    GROUP BY c.id, c.nombre, c.color, m.tipo
    ORDER BY total DESC
  `);

  const { rows: porMes } = await pool.query(`
    SELECT TO_CHAR(fecha, 'YYYY-MM') AS mes,
           SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END) AS ingresos,
           SUM(CASE WHEN tipo='gasto'   THEN monto ELSE 0 END) AS gastos
    FROM finanzas_movimientos
    WHERE fecha >= NOW() - INTERVAL '12 months'
    GROUP BY mes ORDER BY mes
  `);

  const { rows: cuentas } = await pool.query(`
    SELECT c.nombre, c.tipo,
      c.saldo_inicial
        + COALESCE(SUM(CASE WHEN m.tipo='ingreso' THEN m.monto ELSE 0 END),0)
        - COALESCE(SUM(CASE WHEN m.tipo='gasto'   THEN m.monto ELSE 0 END),0)
      AS saldo_actual
    FROM finanzas_cuentas c
    LEFT JOIN finanzas_movimientos m ON m.cuenta_id = c.id
    GROUP BY c.id, c.nombre, c.tipo, c.saldo_inicial
  `);

  res.json({ ...rows[0], porCategoria, porMes, cuentas });
});

router.post("/movimientos", async (req, res) => {
  const { fecha, tipo, concepto, monto, categoria_id, cuenta_id, notas, comprobante } = req.body;
  if (!concepto || !monto) return res.status(400).json({ error: "Concepto y monto requeridos" });
  const { rows } = await pool.query(`
    INSERT INTO finanzas_movimientos
      (fecha, tipo, concepto, monto, categoria_id, cuenta_id, notas, comprobante)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [
    fecha || new Date().toISOString().slice(0,10),
    tipo || "gasto",
    concepto, Number(monto),
    categoria_id || null, cuenta_id || null,
    notas || null, comprobante || null,
  ]);
  res.status(201).json(rows[0]);
});

router.patch("/movimientos/:id", async (req, res) => {
  const { fecha, tipo, concepto, monto, categoria_id, cuenta_id, notas } = req.body;
  const { rows } = await pool.query(`
    UPDATE finanzas_movimientos SET
      fecha        = COALESCE($1, fecha),
      tipo         = COALESCE($2, tipo),
      concepto     = COALESCE($3, concepto),
      monto        = COALESCE($4, monto),
      categoria_id = COALESCE($5, categoria_id),
      cuenta_id    = COALESCE($6, cuenta_id),
      notas        = COALESCE($7, notas)
    WHERE id = $8 RETURNING *
  `, [fecha||null, tipo||null, concepto||null,
      monto ? Number(monto) : null,
      categoria_id||null, cuenta_id||null, notas||null,
      req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
  res.json(rows[0]);
});

router.delete("/movimientos/:id", async (req, res) => {
  await pool.query("DELETE FROM finanzas_movimientos WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
// ── EDITAR / ELIMINAR CATEGORÍAS ───────────────────────────────
router.patch("/categorias/:id", async (req, res) => {
  const { nombre, color } = req.body;
  const { rows } = await pool.query(
    "UPDATE finanzas_categorias SET nombre=COALESCE($1,nombre), color=COALESCE($2,color) WHERE id=$3 RETURNING *",
    [nombre||null, color||null, req.params.id]
  );
  res.json(rows[0]);
});

router.delete("/categorias/:id", async (req, res) => {
  // Desvincula movimientos antes de eliminar
  await pool.query("UPDATE finanzas_movimientos SET categoria_id=NULL WHERE categoria_id=$1", [req.params.id]);
  await pool.query("DELETE FROM finanzas_categorias WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

// ── ELIMINAR CUENTAS ───────────────────────────────────────────
router.delete("/cuentas/:id", async (req, res) => {
  await pool.query("UPDATE finanzas_movimientos SET cuenta_id=NULL WHERE cuenta_id=$1", [req.params.id]);
  await pool.query("DELETE FROM finanzas_cuentas WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});
