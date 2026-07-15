const router = require("express").Router();
const pool   = require("../db/pool");
const requireAuth   = require("../middleware/requireAuth");
const whatsappSvc   = require("../services/whatsapp");

const MESES_NOMBRES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                       "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Cuota mínima esperada: enero-marzo 2026 = 350, resto = 400
function montoMinimo(mes, anio) {
  if (Number(anio) === 2026 && Number(mes) >= 1 && Number(mes) <= 3) return 350;
  return 400;
}

// POST /api/payments/submit
router.post("/submit", async (req, res) => {
  const { resident_id, nombre, telefono, calle, lote, mza,
          mes, anio, monto, comprobante_b64, comprobante_url, notas } = req.body;
  if (!nombre || !mes || !anio || !monto)
    return res.status(400).json({ error: "Faltan campos requeridos" });
  if (Number(monto) <= 0) return res.status(400).json({ error: "El monto debe ser mayor a 0" });
  if (comprobante_b64 && comprobante_b64.length > 7 * 1024 * 1024)
    return res.status(400).json({ error: "La imagen es demasiado grande (máx 5 MB)" });

  const comprobanteGuardar = comprobante_b64 || comprobante_url || null;
  try {
    const { rows } = await pool.query(`
      INSERT INTO payment_submissions
        (resident_id, nombre, telefono, calle, lote, mza, mes, anio, monto, comprobante_url, notas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id
    `, [resident_id||null, nombre, telefono||null, calle||null, lote||null, mza||null,
        mes, Number(anio), Number(monto), comprobanteGuardar, notas||null]);

    if (resident_id && telefono) {
      await pool.query("UPDATE residents SET telefono=$1, updated_at=NOW() WHERE id=$2", [telefono, resident_id]);
    }
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error("[payments/submit]", err.message);
    res.status(500).json({ error: "Error al registrar el pago" });
  }
});

// GET /api/payments/check-duplicate
router.get("/check-duplicate", async (req, res) => {
  const { resident_id, mes, anio } = req.query;
  if (!resident_id || !mes || !anio) return res.json({ exists: false });
  try {
    const { rows } = await pool.query(`
      SELECT id FROM payment_submissions
      WHERE resident_id=$1 AND mes=$2 AND anio=$3
        AND status IN ('pendiente','aprobado')
      LIMIT 1
    `, [resident_id, mes, Number(anio)]);
    res.json({ exists: rows.length > 0 });
  } catch { res.json({ exists: false }); }
});

// GET /api/payments
router.get("/", requireAuth, async (req, res) => {
  const { status, page=1, limit=100 } = req.query;
  const offset = (Number(page)-1) * Number(limit);
  const params = [];
  let where = "WHERE TRUE";
  if (status) { params.push(status); where += ` AND ps.status = $${params.length}`; }

  try {
    const { rows } = await pool.query(`
      SELECT ps.id, ps.resident_id, ps.nombre, ps.telefono,
             ps.calle, ps.lote, ps.mza, ps.mes, ps.anio, ps.monto,
             ps.notas, ps.status, ps.reviewed_at, ps.rejection_reason,
             ps.whatsapp_sent, ps.created_at,
             CASE WHEN ps.comprobante_url IS NOT NULL AND ps.comprobante_url != ''
                  THEN ps.comprobante_url ELSE NULL END AS comprobante_url,
             r.calle AS res_calle, r.lote AS res_lote
      FROM payment_submissions ps
      LEFT JOIN residents r ON r.id = ps.resident_id
      ${where}
      ORDER BY ps.created_at DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, Number(limit), offset]);

    const { rows: cr } = await pool.query(
      `SELECT COUNT(*) FROM payment_submissions ps ${where}`, params
    );
    res.json({ data: rows, total: Number(cr[0].count), page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener pagos" });
  }
});

// GET /api/payments/:id/comprobante
router.get("/:id/comprobante", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT comprobante_url FROM payment_submissions WHERE id=$1", [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ comprobante: rows[0].comprobante_url || null });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener comprobante" });
  }
});

// PATCH /api/payments/:id/approve
// Acepta opcionalmente { monto } en el body para corregir el monto antes de aprobar.
router.patch("/:id/approve", requireAuth, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query("SELECT * FROM payment_submissions WHERE id=$1", [id]);
    const pago = rows[0];
    if (!pago) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pago no encontrado" });
    }
    if (pago.status !== "pendiente") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Ya fue revisado" });
    }

    // Si el admin envió un monto corregido, usarlo; si no, usar el del residente
    const montoFinal = req.body.monto ? Number(req.body.monto) : Number(pago.monto);

    // Validación de monto mínimo sobre el monto final
    const minimoEsperado = montoMinimo(pago.mes, pago.anio);
    if (montoFinal < minimoEsperado) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `El monto ($${montoFinal}) es menor al mínimo requerido de $${minimoEsperado} MXN`
      });
    }

    // Actualizar monto en la submission si fue corregido
    if (req.body.monto && montoFinal !== Number(pago.monto)) {
      await client.query(
        "UPDATE payment_submissions SET monto=$1 WHERE id=$2",
        [montoFinal, id]
      );
    }

    await client.query(`
      UPDATE payment_submissions SET status='aprobado', reviewed_by=$1, reviewed_at=NOW() WHERE id=$2
    `, [req.admin.id, id]);

    // Aplicar al residente con el monto final
    if (pago.resident_id) {
      const mesIdx = Number(pago.mes) - 1;
      const campo  = String(pago.anio) === "2025" ? "pagos25" : "pagos26";
      await client.query(`
        UPDATE residents SET ${campo}=jsonb_set(${campo},$1,$2::jsonb,true), updated_at=NOW() WHERE id=$3
      `, [`{${mesIdx}}`, JSON.stringify(montoFinal), pago.resident_id]);
    }

    // ── Auto-registrar en Finanzas con el monto final ──────────
    const mesNombre = MESES_NOMBRES[Number(pago.mes) - 1] || pago.mes;
    const catRes = await client.query(
      "SELECT id FROM finanzas_categorias WHERE nombre='Cuotas residentes' LIMIT 1"
    );
    const catId = catRes.rows[0]?.id || null;
    const fechaPago = `${pago.anio}-${String(pago.mes).padStart(2,"0")}-05`;
    const notaMonto = montoFinal !== Number(pago.monto)
      ? ` · Monto ajustado de $${pago.monto} a $${montoFinal}`
      : "";

    await client.query(`
      INSERT INTO finanzas_movimientos (fecha, tipo, concepto, monto, categoria_id, notas)
      VALUES ($1,'ingreso',$2,$3,$4,$5)
    `, [
      fechaPago,
      `Cuota ${mesNombre} ${pago.anio} — ${pago.nombre}`,
      montoFinal,
      catId,
      `Aprobado por admin · ${pago.calle||""} L${pago.lote||"?"} · Folio #${id}${notaMonto}`,
    ]);

    await client.query("COMMIT");

    // WhatsApp (no bloqueante)
    if (pago.telefono) {
      whatsappSvc.sendApprovalNotification({
        telefono: pago.telefono, nombre: pago.nombre,
        mes: pago.mes, anio: pago.anio, monto: pago.monto, submissionId: id,
      }).then(async (ok) => {
        if (ok) await pool.query(
          "UPDATE payment_submissions SET whatsapp_sent=TRUE, whatsapp_sent_at=NOW() WHERE id=$1", [id]
        );
      }).catch(console.error);
    }

    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[payments/approve]", err.message);
    res.status(500).json({ error: "Error al aprobar el pago" });
  } finally { client.release(); }
});

// PATCH /api/payments/:id/reject
router.patch("/:id/reject", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const { rows } = await pool.query("SELECT * FROM payment_submissions WHERE id=$1", [id]);
    const pago = rows[0];
    if (!pago) return res.status(404).json({ error: "No encontrado" });
    if (pago.status !== "pendiente") return res.status(400).json({ error: "Ya fue revisado" });

    await pool.query(`
      UPDATE payment_submissions SET status='rechazado', reviewed_by=$1, reviewed_at=NOW(), rejection_reason=$2 WHERE id=$3
    `, [req.admin.id, reason||null, id]);

    if (pago.telefono) {
      whatsappSvc.sendRejectionNotification({
        telefono: pago.telefono, nombre: pago.nombre,
        mes: pago.mes, anio: pago.anio, monto: pago.monto,
        reason: reason || "Comprobante inválido",
      }).catch(console.error);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al rechazar el pago" });
  }
});

module.exports = router;