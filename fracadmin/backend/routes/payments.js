const router = require("express").Router();
const pool   = require("../db/pool");
const requireAuth   = require("../middleware/requireAuth");
const whatsappSvc   = require("../services/whatsapp");

// POST /api/payments/submit — residente envía pago (público)
router.post("/submit", async (req, res) => {
  const {
    resident_id, nombre, telefono,
    calle, lote, mza,
    mes, anio, monto,
    comprobante_url, notas,
  } = req.body;

  if (!nombre || !mes || !anio || !monto)
    return res.status(400).json({ error: "Faltan campos requeridos" });

  if (Number(monto) <= 0)
    return res.status(400).json({ error: "El monto debe ser mayor a 0" });

  try {
    const { rows } = await pool.query(`
      INSERT INTO payment_submissions
        (resident_id, nombre, telefono, calle, lote, mza, mes, anio, monto, comprobante_url, notas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id
    `, [resident_id || null, nombre, telefono || null,
        calle || null, lote || null, mza || null,
        mes, Number(anio), Number(monto),
        comprobante_url || null, notas || null]);

    // Si tiene teléfono y existe el residente, actualizamos el teléfono
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

// GET /api/payments — lista pagos (admin), con filtros
router.get("/", requireAuth, async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let where = "WHERE TRUE";
    const params = [];
    if (status) {
      params.push(status);
      where += ` AND ps.status = $${params.length}`;
    }

    const { rows } = await pool.query(`
      SELECT
        ps.*,
        r.calle   AS res_calle,
        r.lote    AS res_lote,
        r.mza     AS res_mza,
        r.residente AS res_nombre
      FROM payment_submissions ps
      LEFT JOIN residents r ON r.id = ps.resident_id
      ${where}
      ORDER BY ps.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, Number(limit), offset]);

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM payment_submissions ps ${where}`, params
    );

    res.json({
      data: rows,
      total: Number(countRows[0].count),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    console.error("[payments GET]", err.message);
    res.status(500).json({ error: "Error al obtener pagos" });
  }
});

// PATCH /api/payments/:id/approve — admin aprueba un pago
router.patch("/:id/approve", requireAuth, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Obtener el pago
    const { rows } = await client.query(
      "SELECT * FROM payment_submissions WHERE id = $1",
      [id]
    );
    const pago = rows[0];
    if (!pago) return res.status(404).json({ error: "Pago no encontrado" });
    if (pago.status !== "pendiente")
      return res.status(400).json({ error: "Este pago ya fue revisado" });

    // Marcar como aprobado
    await client.query(`
      UPDATE payment_submissions
      SET status = 'aprobado', reviewed_by = $1, reviewed_at = NOW()
      WHERE id = $2
    `, [req.admin.id, id]);

    // Aplicar el pago al residente en la tabla residents
    if (pago.resident_id) {
      const mesIdx = Number(pago.mes) - 1; // mes viene 1-based
      const campo  = String(pago.anio) === "2025" ? "pagos25" : "pagos26";
      await client.query(`
        UPDATE residents
        SET ${campo} = jsonb_set(${campo}, $1, $2::jsonb, true),
            updated_at = NOW()
        WHERE id = $3
      `, [
        `{${mesIdx}}`,
        JSON.stringify(Number(pago.monto)),
        pago.resident_id,
      ]);
    }

    await client.query("COMMIT");

    // Enviar notificación WhatsApp (no bloqueante)
    const telefono = pago.telefono;
    if (telefono) {
      whatsappSvc.sendApprovalNotification({
        telefono,
        nombre: pago.nombre,
        mes: pago.mes,
        anio: pago.anio,
        monto: pago.monto,
        submissionId: id,
      }).then(async (ok) => {
        if (ok) {
          await pool.query(
            "UPDATE payment_submissions SET whatsapp_sent = TRUE, whatsapp_sent_at = NOW() WHERE id = $1",
            [id]
          );
        }
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

// PATCH /api/payments/:id/reject — admin rechaza un pago
router.patch("/:id/reject", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const { rows } = await pool.query(
      "SELECT * FROM payment_submissions WHERE id = $1", [id]
    );
    const pago = rows[0];
    if (!pago) return res.status(404).json({ error: "Pago no encontrado" });
    if (pago.status !== "pendiente")
      return res.status(400).json({ error: "Este pago ya fue revisado" });

    await pool.query(`
      UPDATE payment_submissions
      SET status = 'rechazado', reviewed_by = $1, reviewed_at = NOW(),
          rejection_reason = $2
      WHERE id = $3
    `, [req.admin.id, reason || null, id]);

    // Notificar rechazo por WhatsApp si tiene teléfono
    if (pago.telefono) {
      whatsappSvc.sendRejectionNotification({
        telefono: pago.telefono,
        nombre: pago.nombre,
        mes: pago.mes,
        anio: pago.anio,
        monto: pago.monto,
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
