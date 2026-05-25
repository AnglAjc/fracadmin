import { useState, useRef } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const CALLES = ["AMADA", "BALVINA", "MARBELLA", "MANUELA", "VIRGINIA"];
const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function getMesesOpciones() {
  const opciones = [];
  const now = new Date();
  for (let y = 2025; y <= now.getFullYear(); y++) {
    const maxM = y < now.getFullYear() ? 12 : now.getMonth() + 2;
    for (let m = 1; m <= maxM && m <= 12; m++) {
      opciones.push({ label: `${MESES_FULL[m - 1]} ${y}`, mes: m, anio: y });
    }
  }
  return opciones;
}

const S = {
  wrap: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" },
  card: { background: "var(--surface)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 480, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  header: { padding: "1.25rem 1.5rem", borderBottom: "0.5px solid var(--border)" },
  body: { padding: "1.5rem" },
  label: { display: "block", fontSize: 12, fontWeight: 500, color: "var(--text2)", marginBottom: 6 },
  input: { width: "100%", padding: "8px 11px", borderRadius: "var(--radius)", border: "0.5px solid var(--border2)", fontSize: 13, background: "var(--surface)", color: "var(--text)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  hint: { fontSize: 11, color: "var(--text3)", marginTop: 5 },
  group: { marginBottom: "1rem" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1rem" },
  chip: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: "var(--radius)", background: "var(--green-bg)", color: "var(--green)", fontSize: 13, marginBottom: "1rem" },
  dropdown: { position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, background: "var(--surface)", border: "0.5px solid var(--border2)", borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 20, overflow: "hidden" },
  dropItem: { display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13, borderBottom: "0.5px solid var(--border)", background: "none", cursor: "pointer", borderLeft: "none", borderRight: "none", borderTop: "none", fontFamily: "inherit", color: "var(--text)" },
  submitBtn: { width: "100%", padding: "11px", borderRadius: "var(--radius)", border: "none", background: "var(--blue)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8, fontFamily: "inherit", transition: "background 0.15s" },
  footer: { textAlign: "center", fontSize: 11, color: "var(--text3)", marginTop: 14 },
};

export default function App() {
  const [step, setStep]           = useState("form");
  const [loading, setLoading]     = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [residentFound, setResidentFound] = useState(null);
  const searchTimer = useRef(null);

  const emptyForm = { nombre:"", telefono:"", calle:"", lote:"", mza:"", mes:"", anio:"", monto:"", comprobante_url:"", notas:"", resident_id:"" };
  const [form, setForm] = useState(emptyForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleNombreChange = (v) => {
    set("nombre", v);
    clearTimeout(searchTimer.current);
    if (v.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API}/api/residents/search?q=${encodeURIComponent(v)}`);
        setSearchResults(data);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const selectResident = (r) => {
    setResidentFound(r);
    setSearchResults([]);
    setForm(f => ({ ...f, nombre: r.residente.split("/")[0].trim(), calle: r.calle, lote: r.lote, mza: r.mza, resident_id: r.id }));
  };

  const handleCalleOrLote = async (newCalle, newLote, newMza) => {
    if (!newCalle || !newLote) return;
    try {
      const params = new URLSearchParams({ calle: newCalle, lote: newLote });
      if (newMza) params.set("mza", newMza);
      const { data } = await axios.get(`${API}/api/residents/by-location?${params}`);
      if (data) {
        setResidentFound(data);
        setForm(f => ({ ...f, resident_id: data.id, nombre: f.nombre || data.residente.split("/")[0].trim() }));
      }
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/api/payments/submit`, {
        resident_id: form.resident_id || null,
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim(),
        calle: form.calle,
        lote: form.lote.trim(),
        mza: form.mza.trim(),
        mes: form.mes,
        anio: Number(form.anio),
        monto: Number(form.monto),
        comprobante_url: form.comprobante_url.trim() || null,
        notas: form.notas.trim() || null,
      });
      setStep("success");
    } catch { setStep("error"); }
    finally { setLoading(false); }
  };

  const opciones = getMesesOpciones();

  // ── Pantalla de éxito ──
  if (step === "success") return (
    <div style={S.wrap}>
      <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>¡Pago registrado!</div>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24, lineHeight: 1.6 }}>
          Tu comprobante fue enviado a la administración.<br />
          Recibirás una notificación por WhatsApp una vez que sea revisado y aprobado.
        </p>
        <button style={S.submitBtn} onClick={() => { setStep("form"); setForm(emptyForm); setResidentFound(null); }}>
          Registrar otro pago
        </button>
      </div>
    </div>
  );

  // ── Pantalla de error ──
  if (step === "error") return (
    <div style={S.wrap}>
      <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Algo salió mal</div>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>No pudimos registrar tu pago. Por favor intenta de nuevo.</p>
        <button style={S.submitBtn} onClick={() => setStep("form")}>Intentar de nuevo</button>
      </div>
    </div>
  );

  // ── Formulario principal ──
  return (
    <div style={S.wrap}>
      <div style={S.card}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--blue-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" width="17" height="17"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Registro de Pago</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>Fraccionamiento · Administración de cuotas</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={S.body}>

          {/* Nombre + autocompletar */}
          <div style={{ ...S.group, position: "relative" }}>
            <label style={S.label}>Nombre completo *</label>
            <input
              style={S.input} required autoFocus
              value={form.nombre}
              onChange={e => handleNombreChange(e.target.value)}
              placeholder="Busca tu nombre o escríbelo..."
            />
            {searching && <div style={S.hint}>Buscando...</div>}
            {searchResults.length > 0 && (
              <div style={S.dropdown}>
                {searchResults.map(r => (
                  <button key={r.id} type="button" style={S.dropItem}
                          onMouseOver={e => e.target.style.background = "var(--blue-bg)"}
                          onMouseOut={e => e.target.style.background = "none"}
                          onClick={() => selectResident(r)}>
                    <span style={{ fontWeight: 500 }}>{r.residente.split("/")[0].trim()}</span>
                    <span style={{ color: "var(--text3)", fontSize: 12, marginLeft: 8 }}>{r.calle} · L{r.lote}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chip residente encontrado */}
          {residentFound && (
            <div style={S.chip}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ flex: 1, fontSize: 12 }}>
                Residente encontrado: <strong>{residentFound.calle}</strong> · L{residentFound.lote} Mza {residentFound.mza}
              </span>
              <button type="button" onClick={() => { setResidentFound(null); set("resident_id", ""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--green)", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>✕</button>
            </div>
          )}

          {/* Teléfono */}
          <div style={S.group}>
            <label style={S.label}>Número de WhatsApp *</label>
            <input style={S.input} type="tel" required value={form.telefono}
                   onChange={e => set("telefono", e.target.value)}
                   placeholder="10 dígitos: 55 1234 5678" />
            <div style={S.hint}>Aquí recibirás la confirmación de tu pago</div>
          </div>

          {/* Calle */}
          <div style={S.group}>
            <label style={S.label}>Calle *</label>
            <select style={{ ...S.input, cursor: "pointer" }} required value={form.calle}
                    onChange={e => { set("calle", e.target.value); handleCalleOrLote(e.target.value, form.lote, form.mza); }}>
              <option value="">Selecciona tu calle...</option>
              {CALLES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Lote + Mza */}
          <div style={S.row}>
            <div>
              <label style={S.label}>Número de casa *</label>
              <input style={S.input} required value={form.lote}
                     onChange={e => { set("lote", e.target.value); handleCalleOrLote(form.calle, e.target.value, form.mza); }}
                     placeholder="Ej: 12, 37-B" />
            </div>
            <div>
              <label style={S.label}>Manzana</label>
              <input style={S.input} value={form.mza}
                     onChange={e => { set("mza", e.target.value); handleCalleOrLote(form.calle, form.lote, e.target.value); }}
                     placeholder="Ej: 3" />
            </div>
          </div>

          {/* Mes de pago */}
          <div style={S.group}>
            <label style={S.label}>Mes que estás pagando *</label>
            <select style={{ ...S.input, cursor: "pointer" }} required
                    value={`${form.mes}-${form.anio}`}
                    onChange={e => { const [m, a] = e.target.value.split("-"); setForm(f => ({ ...f, mes: m, anio: a })); }}>
              <option value="-">Selecciona el mes...</option>
              {opciones.map(o => (
                <option key={`${o.mes}-${o.anio}`} value={`${o.mes}-${o.anio}`}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Monto */}
          <div style={S.group}>
            <label style={S.label}>Monto pagado (MXN) *</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 13 }}>$</span>
              <input style={{ ...S.input, paddingLeft: 22 }} type="number" min="1" step="1" required
                     value={form.monto} onChange={e => set("monto", e.target.value)}
                     placeholder="350" />
            </div>
          </div>

          {/* Comprobante */}
          <div style={S.group}>
            <label style={S.label}>Enlace del comprobante</label>
            <input style={S.input} type="url" value={form.comprobante_url}
                   onChange={e => set("comprobante_url", e.target.value)}
                   placeholder="https://drive.google.com/..." />
            <div style={S.hint}>Sube tu foto a Google Drive y pega el enlace aquí</div>
          </div>

          {/* Notas */}
          <div style={S.group}>
            <label style={S.label}>Notas (opcional)</label>
            <textarea style={{ ...S.input, resize: "none", height: 64 }}
                      value={form.notas} onChange={e => set("notas", e.target.value)}
                      placeholder="Ej: Pago parcial, pago con cheque..." />
          </div>

          {/* Separador */}
          <div style={{ borderTop: "0.5px solid var(--border)", margin: "4px 0 16px" }} />

          <button type="submit" disabled={loading}
                  style={{ ...S.submitBtn, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Enviando..." : "Enviar comprobante de pago"}
          </button>

          <div style={S.footer}>
            Recibirás confirmación por WhatsApp una vez que la administración apruebe tu pago.
          </div>
        </form>
      </div>
    </div>
  );
}
