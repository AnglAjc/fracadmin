import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CALLES = ["AMADA","BALVINA","MARBELLA","MANUELA","VIRGINIA"];
const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const CUOTA = { 2025: 350, 2026: 400 };

function getMesesOpciones() {
  const opciones = [];
  const now = new Date();
  for (let y = 2025; y <= now.getFullYear(); y++) {
    const maxM = y < now.getFullYear() ? 12 : now.getMonth() + 2;
    for (let m = 1; m <= maxM && m <= 12; m++)
      opciones.push({ label:`${MESES_FULL[m-1]} ${y}`, mes:m, anio:y, key:`${m}-${y}`, cuota: CUOTA[y]||400 });
  }
  return opciones.reverse();
}

async function fileToBase64(file) {
  return new Promise((res,rej) => {
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Persistencia de borrador ───────────────────────────────────
const DRAFT_KEY = "fracadmin_draft";
const saveDraft = (form, meses) => {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, meses, ts: Date.now() })); } catch {}
};
const loadDraft = () => {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY)||"null");
    if (!d) return null;
    if (Date.now() - d.ts > 2*60*60*1000) { sessionStorage.removeItem(DRAFT_KEY); return null; }
    return d;
  } catch { return null; }
};
const clearDraft = () => { try { sessionStorage.removeItem(DRAFT_KEY); } catch {} };

// ── Icono check ────────────────────────────────────────────────
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ── Modal de selección de meses ────────────────────────────────
function MesesModal({ opciones, mesesSel, pendientes, onToggle, onClose, onConfirm }) {
  const total = mesesSel.reduce((s,m) => s + (m.cuota||400), 0);
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:50,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0 }}
         onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
           style={{ background:"var(--surface)",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:520,padding:"1.5rem 1.5rem 2rem",boxShadow:"0 -8px 32px rgba(0,0,0,0.18)",maxHeight:"80vh",overflowY:"auto" }}>

        {/* Handle */}
        <div style={{ width:40,height:4,background:"var(--border2)",borderRadius:2,margin:"0 auto 1.25rem",opacity:0.5 }}/>

        <div style={{ fontSize:16,fontWeight:600,marginBottom:4 }}>Selecciona los meses a pagar</div>
        <div style={{ fontSize:12,color:"var(--text3)",marginBottom:1.25*16 }}>
          Toca cada mes que estás pagando en esta ocasión
        </div>

        {/* Meses pendientes destacados */}
        {pendientes.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11,fontWeight:600,color:"var(--red)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8 }}>
              Pendientes de pago
            </div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
              {pendientes.map(op => {
                const sel = !!mesesSel.find(m=>m.key===op.key);
                return (
                  <button key={op.key} type="button" onClick={()=>onToggle(op)}
                          style={{ padding:"8px 14px",borderRadius:8,fontSize:13,fontWeight:sel?600:500,cursor:"pointer",display:"flex",alignItems:"center",gap:6,border:`1.5px solid ${sel?"var(--blue)":"var(--red)"}`,background:sel?"var(--blue-bg)":"var(--red-bg)",color:sel?"var(--blue-text)":"var(--red)",transition:"all 0.12s",fontFamily:"inherit" }}>
                    {sel && <CheckIcon/>}
                    {op.label}
                    <span style={{ fontSize:11,opacity:0.7 }}>${op.cuota}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Resto de meses */}
        <div style={{ fontSize:11,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8 }}>
          Otros meses
        </div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:20 }}>
          {opciones.filter(op=>!pendientes.find(p=>p.key===op.key)).map(op => {
            const sel = !!mesesSel.find(m=>m.key===op.key);
            return (
              <button key={op.key} type="button" onClick={()=>onToggle(op)}
                      style={{ padding:"7px 13px",borderRadius:8,fontSize:13,fontWeight:sel?600:400,cursor:"pointer",display:"flex",alignItems:"center",gap:6,border:`1px solid ${sel?"var(--blue)":"var(--border2)"}`,background:sel?"var(--blue-bg)":"var(--surface)",color:sel?"var(--blue-text)":"var(--text2)",transition:"all 0.12s",fontFamily:"inherit" }}>
                {sel && <CheckIcon/>}
                {op.label}
              </button>
            );
          })}
        </div>

        {/* Footer modal */}
        <div style={{ borderTop:"0.5px solid var(--border)",paddingTop:16,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12 }}>
          <div>
            {mesesSel.length > 0 ? (
              <div>
                <div style={{ fontSize:13,fontWeight:600,color:"var(--blue-text)" }}>{mesesSel.length} mes{mesesSel.length>1?"es":""} seleccionado{mesesSel.length>1?"s":""}</div>
                <div style={{ fontSize:11,color:"var(--text3)" }}>Total estimado: ${total.toLocaleString()} MXN</div>
              </div>
            ) : (
              <div style={{ fontSize:13,color:"var(--text3)" }}>Ningún mes seleccionado</div>
            )}
          </div>
          <button type="button" onClick={onConfirm} disabled={mesesSel.length===0}
                  style={{ padding:"10px 24px",borderRadius:8,fontSize:14,fontWeight:600,border:"none",background:mesesSel.length?"var(--blue)":"var(--surface2)",color:mesesSel.length?"#fff":"var(--text3)",cursor:mesesSel.length?"pointer":"not-allowed",fontFamily:"inherit",transition:"all 0.15s",flexShrink:0 }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────
export default function App() {
  const draft = loadDraft();
  const emptyForm = { nombre:"",telefono:"",calle:"",lote:"",mza:"",monto:"",notas:"",resident_id:"" };

  const [step, setStep]           = useState("form");
  const [form, setForm]           = useState(draft?.form || emptyForm);
  const [mesesSel, setMesesSel]   = useState(draft?.meses || []);
  const [residentFound, setResidentFound] = useState(null);
  const [pendientes, setPendientes] = useState([]); // meses con deuda del residente
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64]   = useState(null);
  const [showMesesModal, setShowMesesModal] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [dupWarning, setDupWarning] = useState([]); // meses con posible duplicado
  const searchTimer = useRef(null);
  const fileInputRef = useRef(null);
  const opciones = getMesesOpciones();

  const set = (k,v) => setForm(f=>({ ...f,[k]:v }));

  // Guardar borrador automáticamente
  useEffect(() => {
    saveDraft(form, mesesSel);
  }, [form, mesesSel]);

  // ── Autofill nombre ──────────────────────────────────────────
  const handleNombreChange = (v) => {
    set("nombre",v);
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

  const selectResident = async (r) => {
    setResidentFound(r);
    setSearchResults([]);
    setForm(f=>({...f, nombre:r.residente.split("/")[0].trim(), calle:r.calle, lote:r.lote, mza:r.mza, resident_id:r.id }));
    calcPendientes(r);
  };

  // ── Calcular meses pendientes del residente ──────────────────
  const calcPendientes = (r) => {
    const now = new Date();
    const maxM26 = now.getFullYear()>=2026 ? now.getMonth() : 0;
    const p = [];
    const p25 = r.pagos25||{};
    const p26 = r.pagos26||{};
    for (let m=0; m<12; m++) {
      if (p25[m]==="pendiente") p.push({ mes:m+1, anio:2025, key:`${m+1}-2025`, label:`${MESES_FULL[m]} 2025`, cuota:350 });
    }
    for (let m=0; m<maxM26; m++) {
      if (p26[m]==="pendiente") p.push({ mes:m+1, anio:2026, key:`${m+1}-2026`, label:`${MESES_FULL[m]} 2026`, cuota:400 });
    }
    setPendientes(p);
    // Auto-seleccionar el mes más reciente pendiente
    if (p.length > 0 && mesesSel.length === 0) {
      setMesesSel([p[p.length-1]]);
    }
  };

  // ── Autofill por ubicación ───────────────────────────────────
  const tryAutofill = async (calle, lote, mza) => {
    if (!calle||!lote) return;
    try {
      const p = new URLSearchParams({calle,lote});
      if (mza) p.set("mza",mza);
      const { data } = await axios.get(`${API}/api/residents/by-location?${p}`);
      if (data) {
        setResidentFound(data);
        setForm(f=>({...f, resident_id:data.id, nombre:f.nombre||data.residente.split("/")[0].trim()}));
        calcPendientes(data);
      }
    } catch {}
  };

  // ── Imagen ───────────────────────────────────────────────────
  const handleImage = async (file) => {
    if (!file) return;
    if (file.size > 5*1024*1024) { setError("La imagen no debe superar 5 MB"); return; }
    const b64 = await fileToBase64(file);
    setImageBase64(b64);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  };

  // ── Toggle mes ───────────────────────────────────────────────
  const toggleMes = (op) => {
    setMesesSel(prev => prev.find(m=>m.key===op.key)
      ? prev.filter(m=>m.key!==op.key)
      : [...prev, op]);
  };

  // ── Verificar duplicados antes de enviar ─────────────────────
  const checkDuplicates = async () => {
    if (!form.resident_id || mesesSel.length===0) return [];
    try {
      const checks = await Promise.all(mesesSel.map(op =>
        axios.get(`${API}/api/payments/check-duplicate?resident_id=${form.resident_id}&mes=${op.mes}&anio=${op.anio}`)
          .then(r => r.data.exists ? op : null)
          .catch(() => null)
      ));
      return checks.filter(Boolean);
    } catch { return []; }
  };

  // ── Envío ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (mesesSel.length===0) { setError("Selecciona al menos un mes para continuar"); return; }
    if (!form.nombre.trim()) { setError("Escribe tu nombre"); return; }
    if (!form.telefono.trim()) { setError("Escribe tu número de WhatsApp"); return; }
    if (!form.calle||!form.lote) { setError("Selecciona tu calle y número de casa"); return; }
    if (!form.monto || Number(form.monto)<=0) { setError("Indica el monto pagado"); return; }

    setLoading(true);

    // Verificar duplicados
    const dups = await checkDuplicates();
    if (dups.length > 0) {
      setDupWarning(dups);
      setLoading(false);
      return;
    }

    await submitPagos();
  };

  const submitPagos = async () => {
    setLoading(true);
    setDupWarning([]);
    try {
      await Promise.all(mesesSel.map(op =>
        axios.post(`${API}/api/payments/submit`, {
          resident_id:     form.resident_id||null,
          nombre:          form.nombre.trim(),
          telefono:        form.telefono.trim(),
          calle:           form.calle,
          lote:            form.lote.trim(),
          mza:             form.mza.trim(),
          mes:             op.mes,
          anio:            op.anio,
          monto:           Number(form.monto),
          comprobante_b64: imageBase64||null,
          notas:           form.notas.trim()||null,
        })
      ));
      clearDraft();
      setStep("success");
    } catch {
      setError("Hubo un problema al enviar. Intenta de nuevo.");
    } finally { setLoading(false); }
  };

  const reset = () => {
    clearDraft();
    setStep("form"); setForm(emptyForm); setResidentFound(null);
    setImagePreview(null); setImageBase64(null); setMesesSel([]);
    setPendientes([]); setError(""); setDupWarning([]);
  };

  const totalEstimado = mesesSel.reduce((s,m)=>s+(m.cuota||Number(form.monto)||400),0);

  // ── Pantalla éxito ───────────────────────────────────────────
  if (step==="success") return (
    <div style={{ minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem" }}>
      <div style={{ background:"var(--surface)",border:"0.5px solid var(--border)",borderRadius:20,width:"100%",maxWidth:420,padding:"3rem 2rem",textAlign:"center",boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ width:72,height:72,borderRadius:"50%",background:"var(--green-bg)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:32 }}>✅</div>
        <div style={{ fontSize:20,fontWeight:700,marginBottom:8,color:"var(--text)" }}>¡Pago registrado!</div>
        <p style={{ fontSize:14,color:"var(--text2)",lineHeight:1.7,marginBottom:8 }}>
          Tu comprobante fue enviado correctamente a la administración.
        </p>
        <p style={{ fontSize:13,color:"var(--text3)",marginBottom:28 }}>
          Recibirás una notificación por WhatsApp al número <strong>{form.telefono}</strong> una vez que sea revisado.
        </p>
        <div style={{ background:"var(--surface2)",borderRadius:10,padding:"12px 16px",marginBottom:24,textAlign:"left" }}>
          {mesesSel.sort((a,b)=>a.anio-b.anio||a.mes-b.mes).map(m=>(
            <div key={m.key} style={{ fontSize:13,color:"var(--text2)",padding:"3px 0",display:"flex",justifyContent:"space-between" }}>
              <span>{m.label}</span>
              <span style={{ fontWeight:500 }}>${Number(form.monto).toLocaleString()}</span>
            </div>
          ))}
          <div style={{ borderTop:"0.5px solid var(--border)",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between",fontWeight:600,fontSize:14 }}>
            <span>Total</span>
            <span style={{ color:"var(--blue)" }}>${(Number(form.monto)*mesesSel.length).toLocaleString()} MXN</span>
          </div>
        </div>
        <button onClick={reset}
                style={{ width:"100%",padding:"12px",borderRadius:10,border:"none",background:"var(--blue)",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
          Registrar otro pago
        </button>
      </div>
    </div>
  );

  // ── Formulario principal ─────────────────────────────────────
  const inp = { width:"100%",padding:"10px 12px",borderRadius:10,border:"0.5px solid var(--border2)",fontSize:14,background:"var(--surface)",color:"var(--text)",outline:"none",fontFamily:"inherit",boxSizing:"border-box",transition:"border-color 0.15s" };
  const lbl = { display:"block",fontSize:12,fontWeight:600,color:"var(--text2)",marginBottom:6,letterSpacing:"0.01em" };

  return (
    <div style={{ minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",padding:"2rem 1rem 4rem" }}>

      {/* Header de la app */}
      <div style={{ width:"100%",maxWidth:480,marginBottom:20 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:36,height:36,borderRadius:10,background:"var(--blue)",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div>
            <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>Fraccionamiento</div>
            <div style={{ fontSize:11,color:"var(--text3)" }}>Registro de cuotas mensuales</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ width:"100%",maxWidth:480,display:"flex",flexDirection:"column",gap:0 }}>

        {/* Error general */}
        {error && (
          <div style={{ background:"var(--red-bg)",color:"var(--red)",borderRadius:10,padding:"11px 14px",fontSize:13,marginBottom:14,display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ fontSize:16 }}>⚠️</span> {error}
          </div>
        )}

        {/* Aviso duplicado */}
        {dupWarning.length > 0 && (
          <div style={{ background:"var(--amber-bg)",color:"var(--amber)",borderRadius:10,padding:"14px",fontSize:13,marginBottom:14 }}>
            <div style={{ fontWeight:600,marginBottom:6 }}>⚠️ Posible pago duplicado</div>
            <p style={{ marginBottom:10,lineHeight:1.5 }}>
              Ya existe un pago enviado para: <strong>{dupWarning.map(m=>m.label).join(", ")}</strong>.
              ¿Deseas enviarlo de todas formas?
            </p>
            <div style={{ display:"flex",gap:8 }}>
              <button type="button" onClick={()=>setDupWarning([])}
                      style={{ padding:"7px 14px",borderRadius:8,border:"0.5px solid var(--border2)",background:"var(--surface)",fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>
                Cancelar
              </button>
              <button type="button" onClick={submitPagos} disabled={loading}
                      style={{ padding:"7px 14px",borderRadius:8,border:"none",background:"var(--amber)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                {loading?"Enviando...":"Sí, enviar de todas formas"}
              </button>
            </div>
          </div>
        )}

        {/* SECCIÓN 1: Datos personales */}
        <div style={{ background:"var(--surface)",border:"0.5px solid var(--border)",borderRadius:16,overflow:"hidden",marginBottom:12 }}>
          <div style={{ padding:"14px 16px",borderBottom:"0.5px solid var(--border)",background:"var(--surface2)" }}>
            <div style={{ fontSize:13,fontWeight:600,color:"var(--text)",display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ width:22,height:22,borderRadius:"50%",background:"var(--blue)",color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>1</span>
              Tus datos
            </div>
          </div>
          <div style={{ padding:"16px" }}>

            {/* Nombre + autocomplete */}
            <div style={{ marginBottom:14,position:"relative" }}>
              <label style={lbl}>Nombre completo *</label>
              <input style={inp} value={form.nombre} onChange={e=>handleNombreChange(e.target.value)}
                     placeholder="Escribe tu nombre para buscarte..." autoFocus />
              {searching && (
                <div style={{ fontSize:11,color:"var(--text3)",marginTop:4 }}>Buscando...</div>
              )}
              {searchResults.length>0 && (
                <div style={{ position:"absolute",left:0,right:0,top:"100%",marginTop:4,background:"var(--surface)",border:"0.5px solid var(--border2)",borderRadius:10,boxShadow:"0 4px 20px rgba(0,0,0,0.12)",zIndex:20,overflow:"hidden" }}>
                  {searchResults.map(r=>(
                    <button key={r.id} type="button" onClick={()=>selectResident(r)}
                            style={{ display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",textAlign:"left",padding:"11px 14px",fontSize:13,borderBottom:"0.5px solid var(--border)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",gap:8 }}
                            onMouseOver={e=>e.currentTarget.style.background="var(--blue-bg)"}
                            onMouseOut={e=>e.currentTarget.style.background="none"}>
                      <span style={{ fontWeight:500,color:"var(--text)" }}>{r.residente.split("/")[0].trim()}</span>
                      <span style={{ fontSize:11,color:"var(--text3)",flexShrink:0 }}>{r.calle} · L{r.lote}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Chip residente encontrado + deuda */}
            {residentFound && (
              <div style={{ borderRadius:10,border:"1px solid var(--green-border)",background:"var(--green-bg)",padding:"10px 12px",marginBottom:14 }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:8 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <div style={{ width:28,height:28,borderRadius:"50%",background:"var(--green)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                      <CheckIcon/>
                    </div>
                    <div>
                      <div style={{ fontSize:12,fontWeight:600,color:"var(--green)" }}>Residente encontrado</div>
                      <div style={{ fontSize:11,color:"var(--text2)" }}>{residentFound.calle} · Lote {residentFound.lote} · Mza {residentFound.mza}</div>
                    </div>
                  </div>
                  <button type="button" onClick={()=>{ setResidentFound(null); set("resident_id",""); setPendientes([]); setMesesSel([]); }}
                          style={{ background:"none",border:"none",cursor:"pointer",color:"var(--green)",fontSize:18,lineHeight:1,padding:"2px 4px" }}>✕</button>
                </div>
                {pendientes.length>0 && (
                  <div style={{ marginTop:10,paddingTop:10,borderTop:"0.5px solid var(--green-border)" }}>
                    <div style={{ fontSize:11,color:"var(--red)",fontWeight:600,marginBottom:6 }}>
                      ⚠️ {pendientes.length} mes{pendientes.length>1?"es":""} con pago pendiente:
                    </div>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
                      {pendientes.map(m=>(
                        <span key={m.key} style={{ fontSize:11,background:"var(--red-bg)",color:"var(--red)",padding:"2px 8px",borderRadius:5,fontWeight:500 }}>
                          {m.label} · ${m.cuota}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Teléfono */}
            <div style={{ marginBottom:0 }}>
              <label style={lbl}>Número de WhatsApp *</label>
              <input style={inp} type="tel" value={form.telefono} onChange={e=>set("telefono",e.target.value)}
                     placeholder="55 1234 5678" />
              <div style={{ fontSize:11,color:"var(--text3)",marginTop:5 }}>Recibirás la confirmación aquí</div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: Domicilio */}
        <div style={{ background:"var(--surface)",border:"0.5px solid var(--border)",borderRadius:16,overflow:"hidden",marginBottom:12 }}>
          <div style={{ padding:"14px 16px",borderBottom:"0.5px solid var(--border)",background:"var(--surface2)" }}>
            <div style={{ fontSize:13,fontWeight:600,color:"var(--text)",display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ width:22,height:22,borderRadius:"50%",background:"var(--blue)",color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>2</span>
              Tu domicilio
            </div>
          </div>
          <div style={{ padding:"16px" }}>
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Calle *</label>
              <select style={{ ...inp,cursor:"pointer" }} value={form.calle}
                      onChange={e=>{ set("calle",e.target.value); tryAutofill(e.target.value,form.lote,form.mza); }}>
                <option value="">Selecciona tu calle...</option>
                {CALLES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <div>
                <label style={lbl}>Número de casa *</label>
                <input style={inp} value={form.lote} onChange={e=>{ set("lote",e.target.value); tryAutofill(form.calle,e.target.value,form.mza); }} placeholder="Ej: 12"/>
              </div>
              <div>
                <label style={lbl}>Manzana</label>
                <input style={inp} value={form.mza} onChange={e=>{ set("mza",e.target.value); tryAutofill(form.calle,form.lote,e.target.value); }} placeholder="Ej: 3"/>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: Pago */}
        <div style={{ background:"var(--surface)",border:"0.5px solid var(--border)",borderRadius:16,overflow:"hidden",marginBottom:12 }}>
          <div style={{ padding:"14px 16px",borderBottom:"0.5px solid var(--border)",background:"var(--surface2)" }}>
            <div style={{ fontSize:13,fontWeight:600,color:"var(--text)",display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ width:22,height:22,borderRadius:"50%",background:"var(--blue)",color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>3</span>
              Detalle del pago
            </div>
          </div>
          <div style={{ padding:"16px" }}>

            {/* Selector de meses — botón */}
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Meses que estás pagando *</label>
              <button type="button" onClick={()=>setShowMesesModal(true)}
                      style={{ width:"100%",padding:"11px 14px",borderRadius:10,border:`1.5px solid ${mesesSel.length?"var(--blue)":"var(--border2)"}`,background:mesesSel.length?"var(--blue-bg)":"var(--surface)",color:mesesSel.length?"var(--blue-text)":"var(--text3)",fontSize:14,fontWeight:mesesSel.length?600:400,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s" }}>
                <span>
                  {mesesSel.length===0
                    ? "Seleccionar meses..."
                    : mesesSel.length===1
                      ? mesesSel[0].label
                      : `${mesesSel.length} meses seleccionados`}
                </span>
                <span style={{ fontSize:16,opacity:0.6 }}>▾</span>
              </button>

              {/* Chips de meses seleccionados */}
              {mesesSel.length>0 && (
                <div style={{ marginTop:8,display:"flex",flexWrap:"wrap",gap:5 }}>
                  {mesesSel.sort((a,b)=>a.anio-b.anio||a.mes-b.mes).map(m=>(
                    <span key={m.key} style={{ fontSize:12,background:"var(--blue-bg)",color:"var(--blue-text)",padding:"3px 10px",borderRadius:6,display:"inline-flex",alignItems:"center",gap:5,fontWeight:500 }}>
                      {m.label}
                      <button type="button" onClick={()=>toggleMes(m)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--blue)",fontSize:13,lineHeight:1,padding:0,marginLeft:2 }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Monto */}
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Monto pagado (MXN) *</label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--text3)",fontSize:15,fontWeight:500 }}>$</span>
                <input style={{ ...inp,paddingLeft:26 }} type="number" min="1" step="1" value={form.monto}
                       onChange={e=>set("monto",e.target.value)} placeholder="350"/>
              </div>
              {mesesSel.length>1 && form.monto && (
                <div style={{ marginTop:6,padding:"8px 12px",background:"var(--blue-bg)",borderRadius:8,fontSize:12,color:"var(--blue-text)",fontWeight:500 }}>
                  Total a pagar: <strong>${(Number(form.monto)*mesesSel.length).toLocaleString()} MXN</strong> ({mesesSel.length} meses × ${Number(form.monto).toLocaleString()})
                </div>
              )}
            </div>

            {/* Comprobante */}
            <div style={{ marginBottom:0 }}>
              <label style={lbl}>Comprobante de pago</label>
              {!imagePreview ? (
                <div onClick={()=>fileInputRef.current?.click()}
                     style={{ border:"1.5px dashed var(--border2)",borderRadius:10,padding:"20px",textAlign:"center",cursor:"pointer",background:"var(--surface2)",transition:"all 0.15s" }}
                     onMouseOver={e=>{ e.currentTarget.style.borderColor="var(--blue)"; e.currentTarget.style.background="var(--blue-bg)"; }}
                     onMouseOut={e=>{ e.currentTarget.style.borderColor="var(--border2)"; e.currentTarget.style.background="var(--surface2)"; }}
                     onDrop={e=>{ e.preventDefault(); handleImage(e.dataTransfer.files[0]); }}
                     onDragOver={e=>e.preventDefault()}>
                  <div style={{ fontSize:28,marginBottom:6 }}>📷</div>
                  <div style={{ fontSize:13,color:"var(--text2)",fontWeight:500,marginBottom:3 }}>Toca para adjuntar tu comprobante</div>
                  <div style={{ fontSize:11,color:"var(--text3)" }}>JPG, PNG o PDF · Máx 5 MB</div>
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf" style={{ display:"none" }} onChange={e=>handleImage(e.target.files[0])}/>
                </div>
              ) : (
                <div style={{ position:"relative",borderRadius:10,overflow:"hidden",border:"0.5px solid var(--border2)" }}>
                  <img src={imagePreview} alt="Comprobante" style={{ width:"100%",maxHeight:180,objectFit:"cover",display:"block" }}/>
                  <div style={{ position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.5),transparent)",display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"10px 12px" }}>
                    <span style={{ fontSize:12,color:"#fff",fontWeight:500 }}>✓ Comprobante adjunto</span>
                    <button type="button" onClick={()=>{ setImagePreview(null); setImageBase64(null); }}
                            style={{ padding:"4px 10px",borderRadius:6,background:"rgba(255,255,255,0.2)",color:"#fff",border:"1px solid rgba(255,255,255,0.4)",fontSize:11,cursor:"pointer",fontFamily:"inherit" }}>
                      Cambiar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: Notas (colapsable) */}
        <div style={{ background:"var(--surface)",border:"0.5px solid var(--border)",borderRadius:16,overflow:"hidden",marginBottom:20 }}>
          <div style={{ padding:"14px 16px" }}>
            <label style={{ ...lbl,marginBottom:8 }}>Notas adicionales (opcional)</label>
            <textarea style={{ ...inp,resize:"none",height:72 }} value={form.notas}
                      onChange={e=>set("notas",e.target.value)}
                      placeholder="Ej: Pago en efectivo, referencia del banco, abono parcial..."/>
          </div>
        </div>

        {/* Botón enviar */}
        <button type="submit" disabled={loading}
                style={{ width:"100%",padding:"14px",borderRadius:12,border:"none",background:loading?"var(--surface2)":"var(--blue)",color:loading?"var(--text3)":"#fff",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",transition:"all 0.15s",boxShadow:loading?"none":"0 4px 14px rgba(24,95,165,0.3)" }}>
          {loading ? "Enviando..." : mesesSel.length===0 ? "Selecciona al menos un mes" : `Enviar pago${mesesSel.length>1?` (${mesesSel.length} meses)`:""}`}
        </button>

        <div style={{ textAlign:"center",fontSize:11,color:"var(--text3)",marginTop:14,lineHeight:1.6 }}>
          Al enviar confirmas que la información es correcta.<br/>
          Recibirás confirmación por WhatsApp al aprobar tu pago.
        </div>

      </form>

      {/* Modal de meses */}
      {showMesesModal && (
        <MesesModal
          opciones={opciones}
          mesesSel={mesesSel}
          pendientes={pendientes}
          onToggle={toggleMes}
          onClose={()=>setShowMesesModal(false)}
          onConfirm={()=>setShowMesesModal(false)}
        />
      )}
    </div>
  );
}
