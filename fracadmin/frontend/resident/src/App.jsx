import { useState, useRef, useEffect } from "react";
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
      opciones.push({ label: `${MESES_FULL[m - 1]} ${y}`, mes: m, anio: y, key: `${m}-${y}` });
    }
  }
  return opciones.reverse(); // más reciente primero
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

const S = {
  wrap: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "2rem 1rem" },
  card: { background: "var(--surface)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 500, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  header: { padding: "1.25rem 1.5rem", borderBottom: "0.5px solid var(--border)" },
  body: { padding: "1.5rem" },
  label: { display: "block", fontSize: 12, fontWeight: 500, color: "var(--text2)", marginBottom: 6 },
  input: { width: "100%", padding: "8px 11px", borderRadius: "var(--radius)", border: "0.5px solid var(--border2)", fontSize: 13, background: "var(--surface)", color: "var(--text)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  hint: { fontSize: 11, color: "var(--text3)", marginTop: 5 },
  group: { marginBottom: "1rem" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1rem" },
  chip: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: "var(--radius)", background: "var(--green-bg)", color: "var(--green)", fontSize: 12, marginBottom: "1rem" },
  dropdown: { position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, background: "var(--surface)", border: "0.5px solid var(--border2)", borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 20, overflow: "hidden" },
  dropItem: { display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13, borderBottom: "0.5px solid var(--border)", background: "none", cursor: "pointer", border: "none", borderBottomColor: "var(--border)", fontFamily: "inherit", color: "var(--text)" },
  submitBtn: { width: "100%", padding: "11px", borderRadius: "var(--radius)", border: "none", background: "var(--blue)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8, fontFamily: "inherit" },
  footer: { textAlign: "center", fontSize: 11, color: "var(--text3)", marginTop: 14 },
  divider: { borderTop: "0.5px solid var(--border)", margin: "4px 0 16px" },
};

export default function App() {
  const [step, setStep]           = useState("form");
  const [loading, setLoading]     = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [residentFound, setResidentFound] = useState(null);
  const [imagePreview, setImagePreview]   = useState(null);
  const [imageBase64, setImageBase64]     = useState(null);
  const [mesesSel, setMesesSel]   = useState([]);   // array de { mes, anio, key, label }
  const searchTimer = useRef(null);
  const fileInputRef = useRef(null);

  const emptyForm = { nombre:"", telefono:"", calle:"", lote:"", mza:"", monto:"", notas:"", resident_id:"" };
  const [form, setForm] = useState(emptyForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const opciones = getMesesOpciones();

  // ── Autofill nombre ──
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

  // ── Autofill por ubicación ──
  const tryAutofill = async (calle, lote, mza) => {
    if (!calle || !lote) return;
    try {
      const p = new URLSearchParams({ calle, lote });
      if (mza) p.set("mza", mza);
      const { data } = await axios.get(`${API}/api/residents/by-location?${p}`);
      if (data) {
        setResidentFound(data);
        setForm(f => ({ ...f, resident_id: data.id, nombre: f.nombre || data.residente.split("/")[0].trim() }));
      }
    } catch {}
  };

  // ── Imagen ──
  const handleImage = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("La imagen no debe superar 5 MB"); return; }
    const b64 = await fileToBase64(file);
    setImageBase64(b64);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImage(file);
  };

  // ── Selección de meses ──
  const toggleMes = (op) => {
    setMesesSel(prev => prev.find(m => m.key === op.key)
      ? prev.filter(m => m.key !== op.key)
      : [...prev, op]);
  };

  // ── Envío ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mesesSel.length === 0) { alert("Selecciona al menos un mes"); return; }
    setLoading(true);
    try {
      // Un request por mes seleccionado
      await Promise.all(mesesSel.map(op =>
        axios.post(`${API}/api/payments/submit`, {
          resident_id:     form.resident_id || null,
          nombre:          form.nombre.trim(),
          telefono:        form.telefono.trim(),
          calle:           form.calle,
          lote:            form.lote.trim(),
          mza:             form.mza.trim(),
          mes:             op.mes,
          anio:            op.anio,
          monto:           Number(form.monto),
          comprobante_b64: imageBase64 || null,
          notas:           form.notas.trim() || null,
        })
      ));
      setStep("success");
    } catch { setStep("error"); }
    finally { setLoading(false); }
  };

  const reset = () => { setStep("form"); setForm(emptyForm); setResidentFound(null); setImagePreview(null); setImageBase64(null); setMesesSel([]); };

  // ── Pantalla éxito ──
  if (step === "success") return (
    <div style={S.wrap}>
      <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem", marginTop: "2rem" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>¡Pago registrado!</div>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24, lineHeight: 1.6 }}>
          Tu comprobante fue enviado a la administración.<br />
          Recibirás una notificación por WhatsApp una vez que sea revisado y aprobado.
        </p>
        <button style={S.submitBtn} onClick={reset}>Registrar otro pago</button>
      </div>
    </div>
  );

  // ── Pantalla error ──
  if (step === "error") return (
    <div style={S.wrap}>
      <div style={{ ...S.card, textAlign: "center", padding: "3rem 2rem", marginTop: "2rem" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Algo salió mal</div>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>No pudimos registrar tu pago. Por favor intenta de nuevo.</p>
        <button style={S.submitBtn} onClick={() => setStep("form")}>Intentar de nuevo</button>
      </div>
    </div>
  );

  // ── Formulario ──
  return (
    <div style={S.wrap}>
      <div style={{ ...S.card, marginTop: "1.5rem", marginBottom: "2rem" }}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--blue-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" width="17" height="17"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Registro de Pago</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>Fraccionamiento · Administración de cuotas</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={S.body}>

          {/* Nombre */}
          <div style={{ ...S.group, position: "relative" }}>
            <label style={S.label}>Nombre completo *</label>
            <input style={S.input} required autoFocus value={form.nombre}
                   onChange={e => handleNombreChange(e.target.value)}
                   placeholder="Busca tu nombre o escríbelo..." />
            {searching && <div style={S.hint}>Buscando...</div>}
            {searchResults.length > 0 && (
              <div style={S.dropdown}>
                {searchResults.map(r => (
                  <button key={r.id} type="button" style={S.dropItem}
                          onMouseOver={e => e.currentTarget.style.background = "var(--blue-bg)"}
                          onMouseOut={e => e.currentTarget.style.background = "none"}
                          onClick={() => selectResident(r)}>
                    <span style={{ fontWeight: 500 }}>{r.residente.split("/")[0].trim()}</span>
                    <span style={{ color: "var(--text3)", fontSize: 11, marginLeft: 8 }}>{r.calle} · L{r.lote}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {residentFound && (
            <div style={S.chip}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ flex: 1 }}>Residente encontrado: <strong>{residentFound.calle}</strong> · L{residentFound.lote} Mza {residentFound.mza}</span>
              <button type="button" onClick={() => { setResidentFound(null); set("resident_id",""); }}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"var(--green)", fontSize:15, lineHeight:1 }}>✕</button>
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
                    onChange={e => { set("calle", e.target.value); tryAutofill(e.target.value, form.lote, form.mza); }}>
              <option value="">Selecciona tu calle...</option>
              {CALLES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Lote + Mza */}
          <div style={S.row}>
            <div>
              <label style={S.label}>Número de casa *</label>
              <input style={S.input} required value={form.lote}
                     onChange={e => { set("lote", e.target.value); tryAutofill(form.calle, e.target.value, form.mza); }}
                     placeholder="Ej: 12, 37-B" />
            </div>
            <div>
              <label style={S.label}>Manzana</label>
              <input style={S.input} value={form.mza}
                     onChange={e => { set("mza", e.target.value); tryAutofill(form.calle, form.lote, e.target.value); }}
                     placeholder="Ej: 3" />
            </div>
          </div>

          {/* Meses — selección múltiple */}
          <div style={S.group}>
            <label style={S.label}>Meses que estás pagando * {mesesSel.length > 0 && <span style={{ color: "var(--blue)", fontWeight: 600 }}>({mesesSel.length} seleccionado{mesesSel.length > 1 ? "s" : ""})</span>}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {opciones.map(op => {
                const sel = !!mesesSel.find(m => m.key === op.key);
                return (
                  <button key={op.key} type="button" onClick={() => toggleMes(op)}
                          style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: sel ? 600 : 400, cursor: "pointer", border: `0.5px solid ${sel ? "var(--blue)" : "var(--border2)"}`, background: sel ? "var(--blue-bg)" : "var(--surface)", color: sel ? "var(--blue-text)" : "var(--text2)", transition: "all 0.12s" }}>
                    {op.label}
                  </button>
                );
              })}
            </div>
            {mesesSel.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {mesesSel.sort((a,b) => a.anio - b.anio || a.mes - b.mes).map(m => (
                  <span key={m.key} style={{ fontSize: 11, background: "var(--blue-bg)", color: "var(--blue-text)", padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {m.label}
                    <button type="button" onClick={() => toggleMes(m)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--blue)", fontSize:12, lineHeight:1, padding:0 }}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Monto */}
          <div style={S.group}>
            <label style={S.label}>Monto por mes (MXN) *</label>
            <div style={{ position: "relative" }}>
              <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:"var(--text3)", fontSize:13 }}>$</span>
              <input style={{ ...S.input, paddingLeft: 22 }} type="number" min="1" step="1" required
                     value={form.monto} onChange={e => set("monto", e.target.value)} placeholder="350" />
            </div>
            {mesesSel.length > 1 && form.monto && (
              <div style={{ ...S.hint, color: "var(--blue-text)", fontWeight: 500 }}>
                Total: ${(Number(form.monto) * mesesSel.length).toLocaleString()} MXN ({mesesSel.length} meses)
              </div>
            )}
          </div>

          {/* Comprobante — subida de imagen */}
          <div style={S.group}>
            <label style={S.label}>Comprobante de pago</label>
            {!imagePreview ? (
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                style={{ border: "1.5px dashed var(--border2)", borderRadius: "var(--radius)", padding: "1.5rem", textAlign: "center", cursor: "pointer", background: "var(--surface2)", transition: "border-color 0.15s" }}
                onMouseOver={e => e.currentTarget.style.borderColor = "var(--blue)"}
                onMouseOut={e => e.currentTarget.style.borderColor = "var(--border2)"}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 3 }}>Toca para subir tu comprobante</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>JPG, PNG o PDF · Máx 5 MB</div>
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                       style={{ display: "none" }}
                       onChange={e => handleImage(e.target.files[0])} />
              </div>
            ) : (
              <div style={{ position: "relative", borderRadius: "var(--radius)", overflow: "hidden", border: "0.5px solid var(--border2)" }}>
                <img src={imagePreview} alt="Comprobante" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
                <button type="button" onClick={() => { setImagePreview(null); setImageBase64(null); }}
                        style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.6)", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontSize:12, padding:"4px 10px" }}>
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* Notas */}
          <div style={S.group}>
            <label style={S.label}>Notas (opcional)</label>
            <textarea style={{ ...S.input, resize:"none", height:60 }}
                      value={form.notas} onChange={e => set("notas", e.target.value)}
                      placeholder="Ej: Pago parcial, pago con cheque..." />
          </div>

          <div style={S.divider} />

          <button type="submit" disabled={loading || mesesSel.length === 0}
                  style={{ ...S.submitBtn, opacity: (loading || mesesSel.length === 0) ? 0.5 : 1, cursor: (loading || mesesSel.length === 0) ? "not-allowed" : "pointer" }}>
            {loading ? "Enviando..." : mesesSel.length === 0 ? "Selecciona al menos un mes" : `Enviar comprobante${mesesSel.length > 1 ? ` (${mesesSel.length} meses)` : ""}`}
          </button>

          <div style={S.footer}>
            Recibirás confirmación por WhatsApp una vez que la administración apruebe tu pago.
          </div>
        </form>
      </div>
    </div>
  );
}
