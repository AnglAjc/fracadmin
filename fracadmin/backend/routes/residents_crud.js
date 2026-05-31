const router = require("express").Router();
const pool   = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");

// GET /api/residents — ya existe en residents.js (búsqueda pública + admin)
// Aquí agregamos: crear, actualizar, eliminar

// POST /api/residents — crear residente manualmente (admin)
router.post("/", requireAuth, async (req, res) => {
  const { calle, lote, mza, residente, pagos25, pagos26, deuda_extra, telefono } = req.body;
  if (!calle || !lote || !mza || !residente)
    return res.status(400).json({ error: "calle, lote, mza y residente son requeridos" });

  const id = `${calle.toUpperCase()}-${lote}-${mza}-${Date.now()}`;
  try {
    const { rows } = await pool.query(`
      INSERT INTO residents (id, calle, lote, mza, residente, pagos25, pagos26, deuda_extra, telefono)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [
      id, calle.toUpperCase(), lote, mza, residente,
      JSON.stringify(pagos25 || {}),
      JSON.stringify(pagos26 || {}),
      Number(deuda_extra || 0),
      telefono || null,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[residents POST]", err.message);
    res.status(500).json({ error: "Error al crear residente" });
  }
});

// PATCH /api/residents/:id — editar residente
router.patch("/:id", requireAuth, async (req, res) => {
  const { calle, lote, mza, residente, deuda_extra, telefono, pagos25, pagos26, pausado } = req.body;
  try {
    const fields = [];
    const vals   = [];
    const push   = (col, val) => { vals.push(val); fields.push(`${col} = $${vals.length}`); };

    if (calle     != null) push("calle",       calle.toUpperCase());
    if (lote      != null) push("lote",        lote);
    if (mza       != null) push("mza",         mza);
    if (residente != null) push("residente",   residente);
    if (deuda_extra != null) push("deuda_extra", Number(deuda_extra));
    if (telefono  != null) push("telefono",    telefono);
    if (pagos25   != null) push("pagos25",     JSON.stringify(pagos25));
    if (pagos26   != null) push("pagos26",     JSON.stringify(pagos26));
    if (pausado   != null) push("pausado",     pausado);

    if (fields.length === 0) return res.status(400).json({ error: "Nada que actualizar" });
    push("updated_at", new Date());

    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE residents SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: "Residente no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("[residents PATCH]", err.message);
    res.status(500).json({ error: "Error al actualizar residente" });
  }
});

// DELETE /api/residents/:id — eliminar residente
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM residents WHERE id = $1", [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Residente no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[residents DELETE]", err.message);
    res.status(500).json({ error: "Error al eliminar residente" });
  }
});

module.exports = router;

// PATCH /api/residents/:id/toggle-pago — marcar/desmarcar un mes como pagado
router.patch("/:id/toggle-pago", requireAuth, async (req, res) => {
  const { anio, mes, accion } = req.body;
  // accion: 'pagar' | 'deshacer'
  if (!anio || mes === undefined) return res.status(400).json({ error: "anio y mes requeridos" });
  const campo  = String(anio) === "2025" ? "pagos25" : "pagos26";
  const mesIdx = Number(mes);
  const valor  = accion === "pagar" ? 400 : "pendiente";
  try {
    const { rows } = await pool.query(
      `UPDATE residents SET ${campo}=jsonb_set(${campo},$1,$2::jsonb,true), updated_at=NOW() WHERE id=$3 RETURNING *`,
      [`{${mesIdx}}`, JSON.stringify(valor), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("[toggle-pago]", err.message);
    res.status(500).json({ error: "Error al actualizar pago" });
  }
});
