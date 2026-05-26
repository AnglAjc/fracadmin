const router = require("express").Router();
const pool   = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");
const whatsappSvc = require("../services/whatsapp");

// GET /api/admin/dashboard
router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const [residentsRes, paymentsRes, pendingRes] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM residents"),
      pool.query("SELECT COUNT(*), SUM(monto) FROM payment_submissions WHERE status = 'aprobado'"),
      pool.query("SELECT COUNT(*) FROM payment_submissions WHERE status = 'pendiente'"),
    ]);
    const { rows: allResidents } = await pool.query(
      "SELECT id, pagos25, pagos26, deuda_extra FROM residents"
    );
    const now = new Date();
    const maxMes2026 = now.getFullYear() >= 2026 ? now.getMonth() : 0;
    let morosos = 0, alCorriente = 0, totalDeuda = 0;
    for (const r of allResidents) {
      let deuda = 0;
      for (let m = 0; m < 12; m++) if (r.pagos25[m] === "pendiente") deuda += 350;
      for (let m = 0; m < maxMes2026; m++) if (r.pagos26[m] === "pendiente") deuda += 400;
      deuda += Number(r.deuda_extra || 0);
      if (deuda > 0) morosos++; else alCorriente++;
      totalDeuda += deuda;
    }
    res.json({
      totalResidentes:  Number(residentsRes.rows[0].count),
      morosos, alCorriente, totalDeuda,
      pagosTotales:     Number(paymentsRes.rows[0].count),
      totalRecaudado:   Number(paymentsRes.rows[0].sum || 0),
      pagosPendientes:  Number(pendingRes.rows[0].count),
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
    const now = new Date();
    const maxMes2026 = now.getFullYear() >= 2026 ? now.getMonth() : 0;
    const morosos = rows.map(r => {
      let deuda = 0;
      for (let m = 0; m < 12; m++) if (r.pagos25[m] === "pendiente") deuda += 350;
      for (let m = 0; m < maxMes2026; m++) if (r.pagos26[m] === "pendiente") deuda += 400;
      deuda += Number(r.deuda_extra || 0);
      return { ...r, deuda };
    }).filter(r => r.deuda > 0).sort((a, b) => b.deuda - a.deuda);
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
    const { rows } = await pool.query("SELECT * FROM residents WHERE id = $1", [residentId]);
    const r = rows[0];
    if (!r) return res.status(404).json({ error: "Residente no encontrado" });
    if (!r.telefono) return res.status(400).json({ error: "Sin teléfono registrado" });
    const now = new Date();
    const maxMes2026 = now.getFullYear() >= 2026 ? now.getMonth() : 0;
    let deuda = 0;
    for (let m = 0; m < 12; m++) if (r.pagos25[m] === "pendiente") deuda += 350;
    for (let m = 0; m < maxMes2026; m++) if (r.pagos26[m] === "pendiente") deuda += 400;
    deuda += Number(r.deuda_extra || 0);
    const ok = await whatsappSvc.sendDebtReminder({ telefono: r.telefono, nombre: r.residente.split("/")[0].trim(), deuda });
    res.json({ ok });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/admin/reset — ⚠️ Elimina TODOS los datos
router.post("/reset", requireAuth, async (req, res) => {
  const { confirmacion } = req.body;
  if (confirmacion !== "REINICIAR") return res.status(400).json({ error: "Confirmación incorrecta" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM payment_submissions");
    await client.query("DELETE FROM finanzas_movimientos");
    await client.query("DELETE FROM residents");
    await client.query("COMMIT");
    res.json({ ok: true, msg: "Aplicación reiniciada. Todos los datos fueron eliminados." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/reset]", err.message);
    res.status(500).json({ error: "Error al reiniciar" });
  } finally { client.release(); }
});

module.exports = router;
