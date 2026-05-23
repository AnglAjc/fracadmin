require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes      = require("./routes/auth");
const residentRoutes  = require("./routes/residents");
const paymentRoutes   = require("./routes/payments");
const adminRoutes     = require("./routes/admin");
const whatsappRoutes  = require("./routes/whatsapp");

const app = express();

// ── Seguridad ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.ADMIN_URL,
    process.env.RESIDENT_URL,
    "http://localhost:5173",
    "http://localhost:5174",
  ],
  credentials: true,
}));

// Rate limiting general
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Rate limiting estricto para autenticación
app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Demasiados intentos, espera 15 minutos." },
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Rutas ──────────────────────────────────────────────────────
app.use("/api/auth",      authRoutes);
app.use("/api/residents", residentRoutes);
app.use("/api/payments",  paymentRoutes);
app.use("/api/admin",     adminRoutes);
app.use("/api/whatsapp",  whatsappRoutes);

// Health check para Render
app.get("/health", (req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── Error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Error interno" : err.message,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`FracAdmin API corriendo en puerto ${PORT}`));
