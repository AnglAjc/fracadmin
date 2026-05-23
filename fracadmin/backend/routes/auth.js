const router  = require("express").Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const pool    = require("../db/pool");
const requireAuth = require("../middleware/requireAuth");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email y contraseña son requeridos" });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM admins WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: "Credenciales incorrectas" });

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: "Credenciales incorrectas" });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, nombre: admin.nombre },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({ token, admin: { id: admin.id, email: admin.email, nombre: admin.nombre } });
  } catch (err) {
    console.error("[auth/login]", err.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /api/auth/me  — verifica token activo
router.get("/me", requireAuth, (req, res) => {
  res.json({ admin: req.admin });
});

module.exports = router;
