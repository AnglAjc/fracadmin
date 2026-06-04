const router = require("express").Router();
const pool   = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");

const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// POST /api/residents — crear residente
router.post("/", requireAuth, async (req, res) => {
  const { calle, lote, mza, residente, pagos25, pagos26, deuda_extra, telefono } = req.body;
  if (!calle || !lote || !mza || !residente)
    return res.status(400).json({ error: "calle, lote, mza y residente son requeridos" });
  const id = `${calle.toUpperCase()}-${lote}-${mza}-${Date.now()}`;
  try {
    const { rows } = await pool.query(`
      INSERT INTO residents (id, calle, lote, mza, residente, pagos25, pagos26, deuda_extra, telefono)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [id, calle.toUpperCase(), lote, mza, residente,
        JSON.stringify(pagos25 || {}), JSON.stringify(pagos26 || {}),
        Number(deuda_extra || 0), telefono || null]);
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
    const fields = [], vals = [];
    const push = (col, val) => { vals.push(val); fields.push(`${col} = $${vals.length}`); };
    if (calle      != null) push("calle",       calle.toUpperCase());
    if (lote       != null) push("lote",        lote);
    if (mza        != null) push("mza",         mza);
    if (residente  != null) push("residente",   residente);
    if (deuda_extra!= null) push("deuda_extra", Number(deuda_extra));
    if (telefono   != null) push("telefono",    telefono);
    if (pagos25    != null) push("pagos25",     JSON.stringify(pagos25));
    if (pagos26    != null) push("pagos26",     JSON.stringify(pagos26));
    if (pausado    != null) push("pausado",     pausado);
    if (fields.length === 0) return res.status(400).json({ error: "Nada que actualizar" });
    push("updated_at", new Date());
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE residents SET ${fields.join(", ")} WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!rows[0]) return res.status(404).json({ error: "Residente no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("[residents PATCH]", err.message);
    res.status(500).json({ error: "Error al actualizar residente" });
  }
});

// DELETE /api/residents/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM residents WHERE id=$1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: "Residente no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar residente" });
  }
});

// PATCH /api/residents/:id/toggle-pago — registrar/deshacer pago manualmente + sync finanzas
router.patch("/:id/toggle-pago", requireAuth, async (req, res) => {
  const { anio, mes, accion, monto, metodo } = req.body;
  if (!anio || mes === undefined) return res.status(400).json({ error: "anio y mes requeridos" });

  const campo  = String(anio) === "2025" ? "pagos25" : "pagos26";
  const mesIdx = Number(mes);
  // Monto: usar el enviado, o 400 por defecto (mensualidad actual)
  const montoNum = Number(monto) || 400;
  const metodoStr = metodo || "efectivo";
  const valor    = accion === "pagar" ? montoNum : "pendiente";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Actualizar pagos del residente
    const { rows } = await client.query(
      `UPDATE residents SET ${campo}=jsonb_set(${campo},$1,$2::jsonb,true), updated_at=NOW() WHERE id=$3 RETURNING *`,
      [`{${mesIdx}}`, JSON.stringify(valor), req.params.id]
    );
    if (!rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Residente no encontrado" }); }

    const residente = rows[0];

    // 2. Sincronizar con finanzas
    const mesNombre   = MESES_FULL[mesIdx] || `Mes ${mesIdx+1}`;
    const fechaPago   = `${anio}-${String(mesIdx+1).padStart(2,"0")}-05`;
    const nombreCorto = residente.residente.split("/")[0].trim();

    if (accion === "pagar") {
      // Buscar categoría "Cuotas residentes"
      const catRes = await client.query(
        "SELECT id FROM finanzas_categorias WHERE nombre='Cuotas residentes' LIMIT 1"
      );
      const catId = catRes.rows[0]?.id || null;

      // Verificar que no exista ya un movimiento para este mes/residente
      const exists = await client.query(`
        SELECT id FROM finanzas_movimientos
        WHERE concepto ILIKE $1 AND fecha = $2 AND tipo = 'ingreso'
        LIMIT 1
      `, [`%${nombreCorto}%${mesNombre} ${anio}%`, fechaPago]);

      if (exists.rows.length === 0) {
        // Buscar cuenta según método de pago
      const cuentaTipo = metodoStr === "debito" ? "debito" : "efectivo";
      const cuentaRes = await client.query(
        "SELECT id FROM finanzas_cuentas WHERE tipo=$1 ORDER BY id LIMIT 1",
        [cuentaTipo]
      );
      const cuentaId = cuentaRes.rows[0]?.id || null;

      await client.query(`
          INSERT INTO finanzas_movimientos (fecha, tipo, concepto, monto, categoria_id, cuenta_id, notas)
          VALUES ($1,'ingreso',$2,$3,$4,$5,$6)
        `, [
          fechaPago,
          `Cuota ${mesNombre} ${anio} — ${nombreCorto}`,
          montoNum,
          catId,
          cuentaId,
          `Registrado manualmente · ${metodoStr} · ${residente.calle} L${residente.lote} · Admin`,
        ]);
      }
    } else {
      // Deshacer: eliminar el movimiento de finanzas si existe
      await client.query(`
        DELETE FROM finanzas_movimientos
        WHERE concepto ILIKE $1 AND fecha = $2 AND tipo = 'ingreso'
          AND notas ILIKE '%Registrado manualmente%'
      `, [`%${nombreCorto}%${mesNombre} ${anio}%`, fechaPago]);
    }

    await client.query("COMMIT");
    res.json(residente);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[toggle-pago]", err.message);
    res.status(500).json({ error: "Error al registrar pago" });
  } finally {
    client.release();
  }
});

module.exports = router;
