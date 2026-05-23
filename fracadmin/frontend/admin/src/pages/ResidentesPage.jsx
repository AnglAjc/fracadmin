import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { calcDeuda, fmtMXN, CALLES, MESES } from "../lib/helpers";

const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function PayGrid({ r }) {
  const pagos25 = r.pagos25 || {};
  const pagos26 = r.pagos26 || {};
  const now = new Date();
  const maxM26 = now.getFullYear() >= 2026 ? now.getMonth() : 0;

  const cellClass = (val, year, m) => {
    if (year === 2026 && m >= maxM26) return "empty";
    if (val === "pendiente") return "pending";
    if (typeof val === "number" && val > 0) return "paid";
    if (val === "vacio") return "empty";
    return "empty";
  };
  const cellText = (val, year, m) => {
    if (year === 2026 && m >= maxM26) return "—";
    if (val === "pendiente") return "DEBE";
    if (typeof val === "number" && val > 0) return "✓";
    return "—";
  };

  return (
    <div className="pay-grid scroll-x">
      <div className="pay-year">2025</div>
      <table>
        <thead><tr>{MESES.map(m => <th key={m}>{m}</th>)}</tr></thead>
        <tbody><tr>{MESES.map((_, i) => <td key={i} className={cellClass(pagos25[i], 2025, i)}>{cellText(pagos25[i], 2025, i)}</td>)}</tr></tbody>
      </table>
      <div className="pay-year">2026</div>
      <table>
        <thead><tr>{MESES.map(m => <th key={m}>{m}</th>)}</tr></thead>
        <tbody><tr>{MESES.map((_, i) => <td key={i} className={cellClass(pagos26[i], 2026, i)}>{cellText(pagos26[i], 2026, i)}</td>)}</tr></tbody>
      </table>
    </div>
  );
}

export default function ResidentesPage() {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [calle, setCalle]         = useState("");
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("");
  const [selected, setSelected]   = useState(null);
  const [pagoYear, setPagoYear]   = useState("2026");
  const [pagoMes, setPagoMes]     = useState("0");
  const [pagoMonto, setPagoMonto] = useState("");
  const [toast, setToast]         = useState(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (calle) p.set("calle", calle);
    if (search) p.set("search", search);
    api.get(`/api/residents?${p}`)
      .then(r => setResidents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [calle, search]);

  useEffect(() => { load(); }, [load]);

  const filtered = residents.filter(r => {
    if (!statusFilter) return true;
    const d = calcDeuda(r);
    if (statusFilter === "moroso")   return d > 700;
    if (statusFilter === "leve")     return d > 0 && d <= 700;
    if (statusFilter === "corriente") return d === 0;
    return true;
  });

  const statusOf = (d) => d <= 0 ? "corriente" : d <= 700 ? "leve" : "moroso";
  const badgeClass = (st) => st === "corriente" ? "badge green" : st === "leve" ? "badge amber" : "badge red";
  const badgeLabel = (st) => st === "corriente" ? "Al corriente" : st === "leve" ? "Deuda leve" : "Moroso";

  const handleRowClick = (r) => {
    setSelected(r);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copiarNotificacion = (r) => {
    const deuda = calcDeuda(r);
    const nombre = r.residente.split("/")[0].trim();
    const msg = `Estimado/a *${nombre}*,\n\nLe recordamos que tiene una deuda pendiente de *$${deuda.toLocaleString()} MXN* correspondiente a mensualidades no pagadas.\n\nPuede registrar su pago en: https://formularioresidentes.onrender.com\n\n_Administración del Fraccionamiento_`;
    navigator.clipboard.writeText(msg).then(() => showToast("Mensaje copiado al portapapeles")).catch(() => showToast("Error al copiar", false));
  };

  return (
    <div style={{ padding: "2rem", flex: 1 }}>
      {toast && (
        <div className={`toast ${toast.ok ? "" : "error"}`} style={{ marginBottom: "1rem", borderRadius: "var(--radius)" }}>
          {toast.msg}
        </div>
      )}

      <div className="page-title">Residentes</div>
      <div className="page-sub">
        {filtered.length} residente{filtered.length !== 1 ? "s" : ""} · Gestión y seguimiento de pagos
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="detail-panel">
          <div className="detail-header">
            <div>
              <div className="name">{selected.residente.split("/")[0].trim()}</div>
              <div className="meta">{selected.calle} · Lote {selected.lote} · Mza {selected.mza}{selected.telefono ? ` · ${selected.telefono}` : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className={badgeClass(statusOf(calcDeuda(selected)))}>{badgeLabel(statusOf(calcDeuda(selected)))}</span>
              {calcDeuda(selected) > 0 && <span className="detail-deuda">${calcDeuda(selected).toLocaleString()} MXN</span>}
              <button className="btn-close" onClick={() => setSelected(null)}>✕</button>
            </div>
          </div>
          <PayGrid r={selected} />
          <div className="detail-actions">
            <button className="btn green" onClick={() => copiarNotificacion(selected)}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
              Copiar notificación WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <input type="text" placeholder="Buscar nombre, lote..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={calle} onChange={e => setCalle(e.target.value)}>
          <option value="">Todas las calles</option>
          {CALLES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="moroso">Morosos</option>
          <option value="leve">Deuda leve</option>
          <option value="corriente">Al corriente</option>
        </select>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Residente</th>
              <th>Calle</th>
              <th>Lote / Mza</th>
              <th>Estado</th>
              <th style={{ textAlign: "right" }}>Deuda</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: "center", padding: "3rem", color: "var(--text2)" }}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: "center", padding: "3rem", color: "var(--text2)" }}>Sin resultados</td></tr>
            ) : filtered.map(r => {
              const d = calcDeuda(r);
              const st = statusOf(d);
              return (
                <tr key={r.id} onClick={() => handleRowClick(r)}>
                  <td style={{ fontWeight: 500 }}>{r.residente.split("/")[0].trim()}</td>
                  <td style={{ color: "var(--text2)" }}>{r.calle}</td>
                  <td style={{ color: "var(--text3)" }}>L{r.lote} · Mza {r.mza}</td>
                  <td><span className={badgeClass(st)}>{badgeLabel(st)}</span></td>
                  <td className="right" style={{ fontWeight: 600, color: d > 0 ? "var(--red)" : "var(--green)" }}>
                    {d > 0 ? fmtMXN(d) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
