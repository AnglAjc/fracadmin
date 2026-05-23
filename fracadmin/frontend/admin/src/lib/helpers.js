export const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
export const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export const CALLES = ["AMADA","BALVINA","MARBELLA","MANUELA","VIRGINIA"];

export function calcDeuda(r) {
  let total = 0;
  const pagos25 = r.pagos25 || {};
  const pagos26 = r.pagos26 || {};
  for (let m = 0; m < 12; m++) {
    if (pagos25[m] === "pendiente") total += 350;
  }
  total += Number(r.deuda_extra || r.deudaExtra || 0);
  const now = new Date();
  const maxM = now.getFullYear() >= 2026 ? now.getMonth() : 0;
  for (let m = 0; m < maxM; m++) {
    if (pagos26[m] === "pendiente") total += 400;
  }
  return total;
}

export function fmtMXN(n) {
  return "$" + Number(n || 0).toLocaleString("es-MX");
}

export function parseVal(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toUpperCase();
  if (!s || s === "NAN") return null;
  if (s === "CHECAR") return "pendiente";
  if (s === "VACIO" || s === "VACÍO") return "vacio";
  const n = parseFloat(s);
  return isNaN(n) ? "pendiente" : n;
}

export function parseExcelWorkbook(workbook, XLSX) {
  const result = [];
  for (const rawName of workbook.SheetNames) {
    const name = rawName.trim().toUpperCase();
    if (!CALLES.includes(name)) continue;
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[rawName], { header: 1, defval: null });
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 3) continue;
      const lote = String(row[0] ?? "").trim();
      const mza  = String(row[1] ?? "").trim();
      const res  = String(row[2] ?? "").trim();
      if (!res || res === "NaN" || res.toLowerCase() === "nan" || !lote || lote === "NaN") continue;
      if (res.toLowerCase().startsWith("terreno") || res.toLowerCase().startsWith("teereno")) continue;
      if (!isNaN(Number(res))) continue;

      const pagos25 = {}, pagos26 = {};
      for (let m = 0; m < 12; m++) {
        pagos25[m] = parseVal(row[3 + m]);
        pagos26[m] = parseVal(row[17 + m]);
      }
      const deudaExtra = parseFloat(row[16]) || 0;

      result.push({
        id: `${name}-${lote}-${mza}-${r}`,
        calle: name.charAt(0) + name.slice(1).toLowerCase(),
        lote, mza, residente: res,
        pagos25, pagos26, deudaExtra,
      });
    }
  }
  return result;
}
