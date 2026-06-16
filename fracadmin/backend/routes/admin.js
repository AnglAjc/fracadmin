const router = require("express").Router();
const pool   = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");
const whatsappSvc = require("../services/whatsapp");

// ---------------------------------------------------------------------------
// calcDeuda — versión corregida
//
// Reglas:
//   • Un slot "pendiente" → debe cobrar la cuota completa del año.
//   • Un slot null/undefined → mes pasado sin registro → cuenta como deuda.
//   • Un slot numérico < cuota → pago parcial → cobra la diferencia.
//   • Un slot numérico >= cuota → pagado, sin deuda.
//   • Un slot "vacio" → lote desocupado, no cobra.
//   • pausado = true → sin deuda.
//
// Cuotas históricas: 2025 = $350, 2026 = $400
// ---------------------------------------------------------------------------
function calcDeuda(r, maxMes2026) {
  if (r.pausado) return 0;

  const CUOTA_25 = 350;
  const CUOTA_26 = 400;

  let deuda = 0;

  // ── 2025 (12 meses) ──────────────────────────────────────────────────────
  for (let m = 0; m < 12; m++) {
    const v = r.pagos25[m];
    if (v === "vacio") continue;                        // desocupado
    if (v === "pendiente" || v === null || v === undefined) {
      deuda += CUOTA_25;                                // sin pago
    } else if (typeof v === "number" && v < CUOTA_25) {
      deuda += (CUOTA_25 - v);                         // pago parcial
    }
    // v >= CUOTA_25 → pagado completo, sin deuda
  }

  // ── 2026 (hasta el mes actual, exclusive) ────────────────────────────────
  for (let m = 0; m < maxMes2026; m++) {
    const v = r.pagos26[m];
    if (v === "vacio") continue;                        // desocupado
    if (v === "pendiente" || v === null || v === undefined) {
      deuda += CUOTA_26;                                // sin pago
    } else if (typeof v === "number" && v < CUOTA_26) {
      deuda += (CUOTA_26 - v);                         // pago parcial
    }
    // v >= CUOTA_26 → pagado completo, sin deuda
  }

  deuda += Number(r.deuda_extra || 0);
  return deuda;
}

function getMaxMes2026() {
  const now = new Date();
  return now.getFullYear() >= 2026 ? now.getMonth() : 0;
}

// GET /api/admin/dashboard
router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const primerDiaMes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
    const mesActual    = now.toLocaleDateString("es-MX", { month:"long", year:"numeric" });
    const maxMes2026   = getMaxMes2026();

    const [residentsRes, paymentsRes, pendingRes, finMesRes, finTotalRes, allResidents] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM residents"),
      pool.query("SELECT COUNT(*), SUM(monto) FROM payment_submissions WHERE status='aprobado'"),
      pool.query("SELECT COUNT(*) FROM payment_submissions WHERE status='pendiente'"),
      pool.query(`
        SELECT
          SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END) AS ingresos_mes,
          SUM(CASE WHEN tipo='gasto'   THEN monto ELSE 0 END) AS gastos_mes
        FROM finanzas_movimientos WHERE fecha >= $1
      `, [primerDiaMes]),
      pool.query(`
        SELECT
          SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END) AS total_ingresos,
          SUM(CASE WHEN tipo='gasto'   THEN monto ELSE 0 END) AS total_gastos
        FROM finanzas_movimientos
      `),
      pool.query("SELECT id, pagos25, pagos26, deuda_extra, pausado FROM residents"),
    ]);

    let morosos = 0, alCorriente = 0, totalDeuda = 0;
    for (const r of allResidents.rows) {
      const deuda = calcDeuda(r, maxMes2026);
      if (deuda > 0) morosos++; else alCorriente++;
      totalDeuda += deuda;
    }

    res.json({
      totalResidentes: Number(residentsRes.rows[0].count),
      morosos, alCorriente, totalDeuda,
      pagosTotales:    Number(paymentsRes.rows[0].count),
      totalRecaudado:  Number(paymentsRes.rows[0].sum || 0),
      pagosPendientes: Number(pendingRes.rows[0].count),
      ingresosMes:     Number(finMesRes.rows[0]?.ingresos_mes   || 0),
      gastosMes:       Number(finMesRes.rows[0]?.gastos_mes     || 0),
      balanceMes:      Number(finMesRes.rows[0]?.ingresos_mes   || 0) - Number(finMesRes.rows[0]?.gastos_mes || 0),
      totalIngresos:   Number(finTotalRes.rows[0]?.total_ingresos || 0),
      totalGastos:     Number(finTotalRes.rows[0]?.total_gastos   || 0),
      balanceTotal:    Number(finTotalRes.rows[0]?.total_ingresos || 0) - Number(finTotalRes.rows[0]?.total_gastos || 0),
      mesActual,
    });
  } catch (err) {
    console.error("[admin/dashboard]", err.message);
    res.status(500).json({ error: "Error al obtener métricas" });
  }
});

// GET /api/admin/morosos
router.get("/morosos", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM residents ORDER BY calle, mza, lote");
    const maxMes2026 = getMaxMes2026();
    const morosos = rows
      .map(r => ({ ...r, deuda: calcDeuda(r, maxMes2026) }))
      .filter(r => r.deuda > 0)
      .sort((a, b) => b.deuda - a.deuda);
    res.json(morosos);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener morosos" });
  }
});

// POST /api/admin/notify-moroso
router.post("/notify-moroso", requireAuth, async (req, res) => {
  const { residentId } = req.body;
  if (!residentId) return res.status(400).json({ error: "residentId requerido" });
  try {
    const { rows } = await pool.query("SELECT * FROM residents WHERE id=$1", [residentId]);
    const r = rows[0];
    if (!r)          return res.status(404).json({ error: "No encontrado" });
    if (!r.telefono) return res.status(400).json({ error: "Sin teléfono registrado" });
    const deuda = calcDeuda(r, getMaxMes2026());
    if (deuda === 0) return res.status(400).json({ error: "Este residente no tiene deuda" });
    const ok = await whatsappSvc.sendDebtReminder({
      telefono: r.telefono,
      nombre:   r.residente.split("/")[0].trim(),
      deuda,
    });
    res.json({ ok });
  } catch (err) {
    console.error("[notify-moroso]", err.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/admin/notify-all-morosos
router.post("/notify-all-morosos", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM residents WHERE telefono IS NOT NULL AND telefono != ''"
    );
    const maxMes2026 = getMaxMes2026();
    const morosos = rows
      .map(r => ({ ...r, deuda: calcDeuda(r, maxMes2026) }))
      .filter(r => r.deuda > 0);

    let enviados = 0, fallidos = 0;
    for (const r of morosos) {
      const ok = await whatsappSvc.sendDebtReminder({
        telefono: r.telefono,
        nombre:   r.residente.split("/")[0].trim(),
        deuda:    r.deuda,
      }).catch(() => false);
      if (ok) enviados++; else fallidos++;
    }
    res.json({ ok: true, total: morosos.length, enviados, fallidos });
  } catch (err) {
    res.status(500).json({ error: "Error al enviar notificaciones" });
  }
});

// POST /api/admin/reset
router.post("/reset", requireAuth, async (req, res) => {
  if (req.body.confirmacion !== "REINICIAR")
    return res.status(400).json({ error: "Confirmación incorrecta" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM payment_submissions");
    await client.query("DELETE FROM finanzas_movimientos");
    await client.query("DELETE FROM residents");
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Error al reiniciar" });
  } finally { client.release(); }
});

module.exports = router;