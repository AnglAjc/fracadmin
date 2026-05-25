const router = require("express").Router();
const pool   = require("../db/pool");
const requireAuth   = require("../middleware/requireAuth");
const whatsappSvc   = require("../services/whatsapp");

// POST /api/payments/submit — residente envía pago
router.post("/submit", async (req, res) => {
  const {
    resident_id, nombre, telefono,
    calle, lote, mza,
    mes, anio, monto,
    comprobante_b64,   // base64 de imagen (nuevo)
    comprobante_url,   // URL legacy (retrocompat)
    notas,
  } = req.body;

  if (!nombre || !mes || !anio || !monto)
    return res.status(400).json({ error: "Faltan campos requeridos" });
  if (Number(monto) <= 0)
    return res.status(400).json({ error: "El monto debe ser mayor a 0" });

  // Tamaño máximo base64 ~7MB (5MB imagen)
  if (comprobante_b64 && comprobante_b64.length > 7 * 1024 * 1024)
    return res.status(400).json({ error: "La imagen es demasiado grande (máx 5 MB)" });

  // Usamos base64 si viene, si no la URL legacy
  const comprobanteGuardar = comprobante_b64 || comprobante_url || null;

  try {
    const { rows } = await pool.query(`
      INSERT INTO payment_submissions
        (resident_id, nombre, telefono, calle, lote, mza, mes, anio, monto, comprobante_url, notas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id
    `, [
      resident_id || null, nombre, telefono || null,
      calle || null, lote || null, mza || null,
      mes, Number(anio), Number(monto),
      comprobanteGuardar, notas || null,
    ]);

    // Actualizar teléfono del residente
    if (resident_id && telefono) {
      await pool.query(
        "UPDATE residents SET telefono = $1, updated_at = NOW() WHERE id = $2",
        [telefono, resident_id]
      );
    }

    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error("[payments/submit]", err.message);
    res.status(500).json({ error: "Error al registrar el pago" });
  }
});

// GET /api/payments — lista pagos (admin)
router.get("/", requireAuth, async (req, res) => {
  const { status, page = 1, limit = 100 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    let where = "WHERE TRUE";
    const params = [];
    if (status) { params.push(status); where += ` AND ps.status = $${params.length}`; }

    // No devolvemos el base64 completo en la lista (demasiado pesado),
    // solo indicamos si tiene comprobante con una URL o un flag
    const { rows } = await pool.query(`
      SELECT
        ps.id, ps.resident_id, ps.nombre, ps.telefono,
        ps.calle, ps.lote, ps.mza, ps.mes, ps.anio, ps.monto,
        ps.notas, ps.status, ps.reviewed_at, ps.rejection_reason,
        ps.whatsapp_sent, ps.created_at,
        CASE
          WHEN ps.comprobante_url IS NOT NULL AND ps.comprobante_url != ''
          THEN ps.comprobante_url
          ELSE NULL
        END AS comprobante_url,
        r.calle AS res_calle, r.lote AS res_lote, r.mza AS res_mza, r.residente AS res_nombre
      FROM payment_submissions ps
      LEFT JOIN residents r ON r.id = ps.resident_id
      ${where}
      ORDER BY ps.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, Number(limit), offset]);

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM payment_submissions ps ${where}`, params
    );

    res.json({ data: rows, total: Number(countRows[0].count), page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("[payments GET]", err.message);
    res.status(500).json({ error: "Error al obtener pagos" });
  }
});

// GET /api/payments/:id/comprobante — devuelve el base64 o URL para mostrar la imagen
router.get("/:id/comprobante", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT comprobante_url FROM payment_submissions WHERE id = $1",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Pago no encontrado" });
    res.json({ comprobante: rows[0].comprobante_url || null });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener comprobante" });
  }
});

// PATCH /api/payments/:id/approve
router.patch("/:id/approve", requireAuth, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT * FROM payment_submissions WHERE id = $1", [id]
    );
    const pago = rows[0];
    if (!pago) return res.status(404).json({ error: "Pago no encontrado" });
    if (pago.status !== "pendiente") return res.status(400).json({ error: "Este pago ya fue revisado" });

    await client.query(`
      UPDATE payment_submissions
      SET status = 'aprobado', reviewed_by = $1, reviewed_at = NOW()
      WHERE id = $2
    `, [req.admin.id, id]);

    // Aplicar pago al residente
    if (pago.resident_id) {
      const mesIdx = Number(pago.mes) - 1;
      const campo  = String(pago.anio) === "2025" ? "pagos25" : "pagos26";
      await client.query(`
        UPDATE residents
        SET ${campo} = jsonb_set(${campo}, $1, $2::jsonb, true), updated_at = NOW()
        WHERE id = $3
      `, [`{${mesIdx}}`, JSON.stringify(Number(pago.monto)), pago.resident_id]);
    }

    await client.query("COMMIT");

    // WhatsApp (no bloqueante)
    if (pago.telefono) {
      whatsappSvc.sendApprovalNotification({
        telefono: pago.telefono, nombre: pago.nombre,
        mes: pago.mes, anio: pago.anio, monto: pago.monto, submissionId: id,
      }).then(async (ok) => {
        if (ok) await pool.query(
          "UPDATE payment_submissions SET whatsapp_sent = TRUE, whatsapp_sent_at = NOW() WHERE id = $1", [id]
        );
      }).catch(console.error);
    }

    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[payments/approve]", err.message);
    res.status(500).json({ error: "Error al aprobar el pago" });
  } finally {
    client.release();
  }
});

// PATCH /api/payments/:id/reject
router.patch("/:id/reject", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM payment_submissions WHERE id = $1", [id]
    );
    const pago = rows[0];
    if (!pago) return res.status(404).json({ error: "Pago no encontrado" });
    if (pago.status !== "pendiente") return res.status(400).json({ error: "Este pago ya fue revisado" });

    await pool.query(`
      UPDATE payment_submissions
      SET status = 'rechazado', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2
      WHERE id = $3
    `, [req.admin.id, reason || null, id]);

    if (pago.telefono) {
      whatsappSvc.sendRejectionNotification({
        telefono: pago.telefono, nombre: pago.nombre,
        mes: pago.mes, anio: pago.anio, monto: pago.monto,
        reason: reason || "Comprobante inválido",
      }).catch(console.error);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[payments/reject]", err.message);
    res.status(500).json({ error: "Error al rechazar el pago" });
  }
});

module.exports = router;
