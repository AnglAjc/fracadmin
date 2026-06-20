const router = require("express").Router();
const pool   = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");

// GET /api/residents
router.get("/", requireAuth, async (req, res) => {
  try {
    const { calle, search } = req.query;
    let query = "SELECT * FROM residents WHERE TRUE";
    const params = [];
    if (calle)  { params.push(calle);        query += ` AND calle = $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND residente ILIKE $${params.length}`; }
    query += " ORDER BY calle, mza, lote";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("[residents GET]", err.message);
    res.status(500).json({ error: "Error al obtener residentes" });
  }
});

// GET /api/residents/search
router.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  try {
    const { rows } = await pool.query(`
      SELECT id, calle, lote, mza, residente, telefono
      FROM residents
      WHERE residente ILIKE $1
         OR (calle || ' ' || lote) ILIKE $1
      ORDER BY calle, lote
      LIMIT 10
    `, [`%${q}%`]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error en búsqueda" });
  }
});

// GET /api/residents/locations
// Devuelve la lista pública de domicilios válidos (calle, mza, lote)
// para poblar los dropdowns del formulario y evitar que los residentes
// capturen direcciones que no existen.
router.get("/locations", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT calle, mza, lote
      FROM residents
      ORDER BY calle, mza, lote
    `);
    res.json(rows);
  } catch (err) {
    console.error("[residents/locations]", err.message);
    res.status(500).json({ error: "Error al obtener domicilios" });
  }
});

// GET /api/residents/by-location
// Si hay más de un residente en esa dirección (mismo lote, diferente mza),
// devuelve todos para que el frontend muestre un selector.
router.get("/by-location", async (req, res) => {
  const { calle, lote, mza } = req.query;
  if (!calle || !lote) return res.json(null);
  try {
    const { rows } = await pool.query(`
      SELECT id, calle, lote, mza, residente, telefono, pagos25, pagos26, deuda_extra
      FROM residents
      WHERE LOWER(TRIM(calle)) = LOWER(TRIM($1))
        AND LOWER(TRIM(lote))  ILIKE LOWER(TRIM($2)) || '%'
        AND ($3::text IS NULL OR LOWER(TRIM(mza)) = LOWER(TRIM($3)))
      ORDER BY lote, mza
      LIMIT 10
    `, [calle, lote, mza || null]);

    if (rows.length === 0) return res.json(null);
    // Si hay exactamente uno (o se especificó mza), devolver objeto simple
    // para no romper el comportamiento anterior del frontend
    if (rows.length === 1) return res.json(rows[0]);
    // Múltiples → devolver array para que el frontend muestre selector
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error en búsqueda" });
  }
});

// POST /api/residents/import
// FIX: ahora guarda telefono; usa ON CONFLICT para no pisar teléfonos capturados después
router.post("/import", requireAuth, async (req, res) => {
  const { residents } = req.body;
  if (!Array.isArray(residents) || residents.length === 0)
    return res.status(400).json({ error: "Se requiere un array de residentes" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let inserted = 0, updated = 0;

    for (const r of residents) {
      // telefono desde Excel: solo usar si viene y la BD no tiene uno ya guardado
      const telefonoExcel = r.telefono || null;

      const { rows } = await client.query(`
        INSERT INTO residents (id, calle, lote, mza, residente, pagos25, pagos26, deuda_extra, telefono)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          calle       = EXCLUDED.calle,
          lote        = EXCLUDED.lote,
          mza         = EXCLUDED.mza,
          residente   = EXCLUDED.residente,
          pagos25     = EXCLUDED.pagos25,
          pagos26     = EXCLUDED.pagos26,
          deuda_extra = EXCLUDED.deuda_extra,
          -- Solo actualizar teléfono si el Excel trae uno y la BD no tiene ninguno aún
          telefono    = CASE
                          WHEN residents.telefono IS NOT NULL AND residents.telefono != ''
                          THEN residents.telefono
                          ELSE EXCLUDED.telefono
                        END,
          updated_at  = NOW()
        RETURNING (xmax = 0) AS inserted
      `, [r.id, r.calle, r.lote, r.mza, r.residente,
          JSON.stringify(r.pagos25), JSON.stringify(r.pagos26),
          r.deudaExtra || 0, telefonoExcel]);

      if (rows[0].inserted) inserted++; else updated++;
    }

    await client.query("COMMIT");
    res.json({ ok: true, inserted, updated, total: residents.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[residents/import]", err.message);
    res.status(500).json({ error: "Error al importar residentes" });
  } finally {
    client.release();
  }
});

// PATCH /api/residents/:id/telefono
router.patch("/:id/telefono", async (req, res) => {
  const { telefono } = req.body;
  if (!telefono) return res.status(400).json({ error: "Teléfono requerido" });
  try {
    await pool.query(
      "UPDATE residents SET telefono = $1, updated_at = NOW() WHERE id = $2",
      [telefono, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar teléfono" });
  }
});

// GET /api/residents/:id/historial
router.get("/:id/historial", requireAuth, async (req, res) => {
  try {
    const { rows: resident } = await pool.query(
      "SELECT * FROM residents WHERE id = $1", [req.params.id]
    );
    if (!resident[0]) return res.status(404).json({ error: "No encontrado" });

    const { rows: pagos } = await pool.query(`
      SELECT
        ps.id, ps.mes, ps.anio, ps.monto, ps.status,
        ps.created_at, ps.reviewed_at, ps.rejection_reason,
        ps.whatsapp_sent, ps.comprobante_url,
        TO_CHAR(ps.created_at,  'DD/MM/YYYY HH24:MI') AS fecha_envio,
        TO_CHAR(ps.reviewed_at, 'DD/MM/YYYY HH24:MI') AS fecha_revision,
        a.email AS revisado_por
      FROM payment_submissions ps
      LEFT JOIN admins a ON a.id = ps.reviewed_by
      WHERE ps.resident_id = $1
      ORDER BY ps.anio DESC, ps.mes DESC, ps.created_at DESC
    `, [req.params.id]);

    res.json({ resident: resident[0], pagos });
  } catch (err) {
    console.error("[residents/historial]", err.message);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

module.exports = router;