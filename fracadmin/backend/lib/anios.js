// ---------------------------------------------------------------------------
// Años de cobro soportados por el sistema.
// Para agregar un año nuevo:
//   1. ALTER TABLE residents ADD COLUMN IF NOT EXISTS pagosYY JSONB NOT NULL DEFAULT '{}';
//   2. Agregarlo a ANIOS y a CUOTAS aquí (y en los frontends).
// ---------------------------------------------------------------------------
const ANIOS  = [2025, 2026, 2027];
const CUOTAS = { 2025: 350, 2026: 400, 2027: 400 };

// "pagos25" / "pagos26" / "pagos27". Devuelve null si el año no está soportado
// (importante: el nombre de columna se interpola en el SQL).
function campoAnio(anio) {
  const a = Number(anio);
  if (!ANIOS.includes(a)) return null;
  return `pagos${String(a).slice(-2)}`;
}

// Cuota anual base usada para calcular deuda.
function cuotaAnio(anio) {
  return CUOTAS[Number(anio)] ?? 400;
}

// Cantidad de meses de `anio` que ya vencieron (mes actual exclusive).
//   año pasado → 12, año en curso → mes actual (0-11), año futuro → 0
function mesesVencidos(anio, now = new Date()) {
  const y = now.getFullYear();
  if (y > anio) return 12;
  if (y === anio) return now.getMonth();
  return 0;
}

module.exports = { ANIOS, CUOTAS, campoAnio, cuotaAnio, mesesVencidos };
