import { useState, useRef, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CALLES = ["AMADA","BALVINA","MARBELLA","MANUELA","VIRGINIA"];
const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const CUOTA = { 2025:350, 2026:400 };

function getMesesOpciones() {
  const opciones = [];
  const now = new Date();
  for (let y = 2025; y <= now.getFullYear(); y++) {
    const maxM = y < now.getFullYear() ? 12 : now.getMonth() + 2;
    for (let m = 1; m <= maxM && m <= 12; m++)
      opciones.push({ label:`${MESES_FULL[m-1]} ${y}`, mes:m, anio:y, key:`${m}-${y}`, cuota:CUOTA[y]||400 });
  }
  return opciones.reverse();
}

async function fileToBase64(file) {
  return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
}

const DRAFT_KEY = "fracadmin_draft_v2";
const saveDraft = (data) => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({...data, ts:Date.now()})); } catch {} };
const loadDraft = () => {
  try { const d=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||"null"); if(!d) return null; if(Date.now()-d.ts>2*60*60*1000){sessionStorage.removeItem(DRAFT_KEY);return null;} return d; } catch{return null;}
};
const clearDraft = () => { try{sessionStorage.removeItem(DRAFT_KEY);}catch{} };

const emptyProp = () => ({ id:Date.now(), calle:"", lote:"", mza:"", resident_id:"", residentData:null });

const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>;
const PlusIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const TrashIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>;

// ── Modal de selección de meses ────────────────────────────────
function MesesModal({ opciones, mesesSel, pendientes, onToggle, onClose }) {
  const total = mesesSel.reduce((s,m)=>s+(m.cuota||400),0);
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:50,display:"flex",alignItems:"flex-end",justifyContent:"center" }}
         onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
           style={{ background:"var(--surface)",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:520,padding:"1.5rem 1.5rem 2.5rem",boxShadow:"0 -8px 32px rgba(0,0,0,0.18)",maxHeight:"82vh",overflowY:"auto" }}>
        <div style={{ width:40,height:4,background:"var(--border2)",borderRadius:2,margin:"0 auto 1.25rem",opacity:0.4 }}/>
        <div style={{ fontSize:16,fontWeight:700,marginBottom:4 }}>Selecciona los meses a pagar</div>
        <div style={{ fontSize:12,color:"var(--text3)",marginBottom:20 }}>Toca cada mes que estás pagando en esta ocasión</div>

        {pendientes.length>0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11,fontWeight:700,color:"var(--red)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10 }}>⚠️ Meses con deuda pendiente</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
              {pendientes.map(op=>{ const sel=!!mesesSel.find(m=>m.key===op.key); return (
                <button key={op.key} type="button" onClick={()=>onToggle(op)}
                        style={{ padding:"8px 14px",borderRadius:9,fontSize:13,fontWeight:sel?700:500,cursor:"pointer",display:"flex",alignItems:"center",gap:6,border:`1.5px solid ${sel?"var(--blue)":"var(--red)"}`,background:sel?"var(--blue-bg)":"var(--red-bg)",color:sel?"var(--blue-text)":"var(--red)",fontFamily:"inherit",transition:"all 0.12s" }}>
                  {sel&&<CheckIcon/>}{op.label}<span style={{ fontSize:11,opacity:0.7 }}>${op.cuota}</span>
                </button>
              ); })}
            </div>
          </div>
        )}

        <div style={{ fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10 }}>
          {pendientes.length>0?"Otros meses":"Selecciona el mes"}
        </div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:24 }}>
          {opciones.filter(op=>!pendientes.find(p=>p.key===op.key)).map(op=>{ const sel=!!mesesSel.find(m=>m.key===op.key); return (
            <button key={op.key} type="button" onClick={()=>onToggle(op)}
                    style={{ padding:"7px 13px",borderRadius:9,fontSize:13,fontWeight:sel?600:400,cursor:"pointer",display:"flex",alignItems:"center",gap:6,border:`1px solid ${sel?"var(--blue)":"var(--border2)"}`,background:sel?"var(--blue-bg)":"var(--surface)",color:sel?"var(--blue-text)":"var(--text2)",fontFamily:"inherit",transition:"all 0.12s" }}>
              {sel&&<CheckIcon/>}{op.label}
            </button>
          ); })}
        </div>

        <div style={{ borderTop:"0.5px solid var(--border)",paddingTop:16,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12 }}>
          <div>
            {mesesSel.length>0
              ? <><div style={{ fontSize:13,fontWeight:600,color:"var(--blue-text)" }}>{mesesSel.length} mes{mesesSel.length>1?"es":""} seleccionado{mesesSel.length>1?"s":""}</div><div style={{ fontSize:11,color:"var(--text3)" }}>Cuota estimada: ${total.toLocaleString()} MXN</div></>
              : <div style={{ fontSize:13,color:"var(--text3)" }}>Ningún mes seleccionado</div>}
          </div>
          <button type="button" onClick={onClose} disabled={mesesSel.length===0}
                  style={{ padding:"10px 24px",borderRadius:9,fontSize:14,fontWeight:600,border:"none",background:mesesSel.length?"var(--blue)":"var(--surface2)",color:mesesSel.length?"#fff":"var(--text3)",cursor:mesesSel.length?"pointer":"not-allowed",fontFamily:"inherit",flexShrink:0 }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fila de una propiedad ──────────────────────────────────────
function PropiedadRow({ prop, onChange, onRemove, onAutofill, canRemove, pendientes }) {
  const inp = { width:"100%",padding:"9px 11px",borderRadius:9,border:"0.5px solid var(--border2)",fontSize:13,background:"var(--surface)",color:"var(--text)",outline:"none",fontFamily:"inherit",boxSizing:"border-box" };
  const r = prop.residentData;
  return (
    <div style={{ background:"var(--surface2)",borderRadius:12,padding:"14px",marginBottom:10,border:`1px solid ${r?"var(--green-border)":"var(--border)"}` }}>
      {/* Encabezado fila */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
        <div style={{ fontSize:12,fontWeight:600,color:"var(--text2)" }}>
          {r ? (
            <span style={{ color:"var(--green)",display:"flex",alignItems:"center",gap:5 }}>
              <CheckIcon/> {r.residente.split("/")[0].trim()} · {r.calle} L{r.lote}
            </span>
          ) : "Ingresa los datos de la propiedad"}
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove}
                  style={{ background:"var(--red-bg)",border:"none",color:"var(--red)",borderRadius:7,cursor:"pointer",padding:"4px 8px",display:"flex",alignItems:"center",gap:4,fontSize:11,fontFamily:"inherit" }}>
            <TrashIcon/> Quitar
          </button>
        )}
      </div>

      {/* Campos */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
        <div>
          <div style={{ fontSize:11,fontWeight:600,color:"var(--text2)",marginBottom:4 }}>Calle *</div>
          <select style={{ ...inp,cursor:"pointer" }} value={prop.calle}
                  onChange={e=>{ onChange("calle",e.target.value); onAutofill(e.target.value,prop.lote,prop.mza); }}>
            <option value="">Calle...</option>
            {CALLES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:11,fontWeight:600,color:"var(--text2)",marginBottom:4 }}>Casa *</div>
          <input style={inp} value={prop.lote} placeholder="Ej: 12"
                 onChange={e=>{ onChange("lote",e.target.value); onAutofill(prop.calle,e.target.value,prop.mza); }}/>
        </div>
        <div>
          <div style={{ fontSize:11,fontWeight:600,color:"var(--text2)",marginBottom:4 }}>Manzana</div>
          <input style={inp} value={prop.mza} placeholder="Ej: 3"
                 onChange={e=>{ onChange("mza",e.target.value); onAutofill(prop.calle,prop.lote,e.target.value); }}/>
        </div>
      </div>

      {/* Meses pendientes de esta propiedad */}
      {r && pendientes[prop.id]?.length>0 && (
        <div style={{ marginTop:10,paddingTop:10,borderTop:"0.5px solid var(--green-border)" }}>
          <div style={{ fontSize:11,color:"var(--red)",fontWeight:600,marginBottom:5 }}>Meses pendientes:</div>
          <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
            {pendientes[prop.id].map(m=>(
              <span key={m.key} style={{ fontSize:11,background:"var(--red-bg)",color:"var(--red)",padding:"2px 8px",borderRadius:5,fontWeight:500 }}>
                {m.label} · ${m.cuota}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── App principal ──────────────────────────────────────────────
export default function App() {
  const draft = loadDraft();
  const emptyForm = { nombre:"", telefono:"", monto:"", notas:"" };

  const [step, setStep]       = useState("form");
  const [form, setForm]       = useState(draft?.form || emptyForm);
  const [propiedades, setPropiedades] = useState(draft?.propiedades || [emptyProp()]);
  const [mesesSel, setMesesSel]       = useState(draft?.meses || []);
  const [pendientes, setPendientes]   = useState({}); // { propId: [{mes,anio,...}] }
  const [allPendientes, setAllPendientes] = useState([]); // union de todos para el modal
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]     = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64]   = useState(null);
  const [showMesesModal, setShowMesesModal] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [dupWarning, setDupWarning] = useState([]);
  const searchTimer = useRef(null);
  const fileInputRef = useRef(null);
  const opciones = getMesesOpciones();

  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  // Guardar borrador
  useEffect(() => { saveDraft({ form, propiedades, meses:mesesSel }); }, [form, propiedades, mesesSel]);

  // Recalcular todos los pendientes cuando cambian las propiedades
  useEffect(() => {
    const now = new Date();
    const maxM26 = now.getFullYear()>=2026 ? now.getMonth() : 0;
    const byProp = {};
    const all = [];
    propiedades.forEach(p => {
      if (!p.residentData) return;
      const r = p.residentData;
      const list = [];
      for(let m=0;m<12;m++) if(r.pagos25[m]==="pendiente") { const op={mes:m+1,anio:2025,key:`${m+1}-2025-${p.id}`,label:`${MESES_FULL[m]} 2025`,cuota:350}; list.push(op); all.push({...op,key:`${m+1}-2025`}); }
      for(let m=0;m<maxM26;m++) if(r.pagos26[m]==="pendiente") { const op={mes:m+1,anio:2026,key:`${m+1}-2026-${p.id}`,label:`${MESES_FULL[m]} 2026`,cuota:400}; list.push(op); all.push({...op,key:`${m+1}-2026`}); }
      byProp[p.id] = list;
    });
    setPendientes(byProp);
    // Deduplicar por key para el modal
    const unique = all.filter((v,i,a)=>a.findIndex(x=>x.key===v.key)===i);
    setAllPendientes(unique);
    // Si no hay meses seleccionados aún, preseleccionar el más reciente pendiente
    if(mesesSel.length===0 && unique.length>0) setMesesSel([unique[unique.length-1]]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propiedades]);

  // ── Autofill nombre ──────────────────────────────────────────
  const handleNombreChange = (v) => {
    setF("nombre",v);
    clearTimeout(searchTimer.current);
    if(v.length<3){setSearchResults([]);return;}
    setSearching(true);
    searchTimer.current = setTimeout(async()=>{
      try{const{data}=await axios.get(`${API}/api/residents/search?q=${encodeURIComponent(v)}`);setSearchResults(data);}
      catch{setSearchResults([]);}finally{setSearching(false);}
    },400);
  };

  const selectResident = (r) => {
    setSearchResults([]);
    setF("nombre", r.residente.split("/")[0].trim());
    // Rellenar la primera propiedad sin residente asignado, o la primera
    setPropiedades(prev=>{
      const idx = prev.findIndex(p=>!p.residentData);
      const target = idx>=0 ? idx : 0;
      return prev.map((p,i)=>i===target ? {...p,calle:r.calle,lote:r.lote,mza:r.mza,resident_id:r.id,residentData:r} : p);
    });
  };

  // ── Gestión de propiedades ────────────────────────────────────
  const updateProp = (id, key, val) => setPropiedades(prev=>prev.map(p=>p.id===id?{...p,[key]:val}:p));
  const addProp    = () => setPropiedades(prev=>[...prev, emptyProp()]);
  const removeProp = (id) => setPropiedades(prev=>prev.filter(p=>p.id!==id));

  const autofillProp = async (id, calle, lote, mza) => {
    if(!calle||!lote) return;
    try {
      const p=new URLSearchParams({calle,lote}); if(mza) p.set("mza",mza);
      const{data}=await axios.get(`${API}/api/residents/by-location?${p}`);
      if(data) {
        setPropiedades(prev=>prev.map(p=>p.id===id?{...p,resident_id:data.id,residentData:data,calle:data.calle,lote:data.lote,mza:data.mza}:p));
        if(!form.nombre) setF("nombre", data.residente.split("/")[0].trim());
      }
    } catch {}
  };

  // ── Imagen ───────────────────────────────────────────────────
  const handleImage = async (file) => {
    if(!file) return;
    if(file.size>5*1024*1024){setError("La imagen no debe superar 5 MB");return;}
    setImageBase64(await fileToBase64(file));
    setImagePreview(URL.createObjectURL(file));
    setError("");
  };

  // ── Toggle mes ───────────────────────────────────────────────
  const toggleMes = (op) => setMesesSel(prev=>prev.find(m=>m.key===op.key)?prev.filter(m=>m.key!==op.key):[...prev,op]);

  // ── Validación y envío ────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault(); setError("");
    if(!form.nombre.trim()) return setError("Escribe tu nombre completo");
    if(!form.telefono.trim()) return setError("Escribe tu número de WhatsApp");
    const propsValidas = propiedades.filter(p=>p.calle&&p.lote);
    if(propsValidas.length===0) return setError("Agrega al menos una propiedad con calle y número de casa");
    if(mesesSel.length===0) return setError("Selecciona al menos un mes a pagar");
    if(!form.monto||Number(form.monto)<=0) return setError("Indica el monto pagado por mes");
    setLoading(true);

    // Verificar duplicados para cada propiedad × mes
    const dups = [];
    for(const prop of propsValidas) {
      if(!prop.resident_id) continue;
      for(const op of mesesSel) {
        try {
          const{data}=await axios.get(`${API}/api/payments/check-duplicate?resident_id=${prop.resident_id}&mes=${op.mes}&anio=${op.anio}`);
          if(data.exists) dups.push(`${op.label} (${prop.calle} L${prop.lote})`);
        } catch {}
      }
    }
    if(dups.length>0){ setDupWarning(dups); setLoading(false); return; }
    await doSubmit(propsValidas);
  };

  const doSubmit = async (propsValidas) => {
    setLoading(true); setDupWarning([]);
    const pvs = propsValidas || propiedades.filter(p=>p.calle&&p.lote);
    try {
      // Una petición por cada propiedad × mes
      await Promise.all(
        pvs.flatMap(prop=>
          mesesSel.map(op=>
            axios.post(`${API}/api/payments/submit`,{
              resident_id:     prop.resident_id||null,
              nombre:          form.nombre.trim(),
              telefono:        form.telefono.trim(),
              calle:           prop.calle,
              lote:            prop.lote.trim(),
              mza:             prop.mza.trim(),
              mes:             op.mes,
              anio:            op.anio,
              monto:           Number(form.monto),
              comprobante_b64: imageBase64||null,
              notas:           form.notas.trim()||null,
            })
          )
        )
      );
      clearDraft();
      setStep("success");
    } catch { setError("Hubo un problema al enviar. Intenta de nuevo."); }
    finally { setLoading(false); }
  };

  const reset = () => {
    clearDraft();
    setStep("form"); setForm(emptyForm); setPropiedades([emptyProp()]);
    setImagePreview(null); setImageBase64(null); setMesesSel([]);
    setPendientes({}); setAllPendientes([]); setError(""); setDupWarning([]);
  };

  const propsValidas = propiedades.filter(p=>p.calle&&p.lote);
  const totalEnvios  = propsValidas.length * mesesSel.length;
  const totalMonto   = Number(form.monto||0) * totalEnvios;

  // ── Éxito ────────────────────────────────────────────────────
  if(step==="success") return (
    <div style={{ minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem" }}>
      <div style={{ background:"var(--surface)",border:"0.5px solid var(--border)",borderRadius:20,width:"100%",maxWidth:420,padding:"2.5rem 2rem",textAlign:"center",boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ width:72,height:72,borderRadius:"50%",background:"var(--green-bg)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:32 }}>✅</div>
        <div style={{ fontSize:20,fontWeight:700,marginBottom:8 }}>¡Pago registrado!</div>
        <p style={{ fontSize:13,color:"var(--text2)",lineHeight:1.7,marginBottom:20 }}>
          Tu comprobante fue enviado a la administración.<br/>
          Recibirás confirmación por WhatsApp al <strong>{form.telefono}</strong>.
        </p>
        {/* Resumen */}
        <div style={{ background:"var(--surface2)",borderRadius:12,padding:"14px 16px",marginBottom:24,textAlign:"left" }}>
          {propsValidas.map(prop=>(
            <div key={prop.id} style={{ marginBottom:mesesSel.length>1?10:0 }}>
              <div style={{ fontSize:12,fontWeight:600,color:"var(--text2)",marginBottom:4 }}>
                📍 {prop.calle} · L{prop.lote}{prop.mza?` Mza ${prop.mza}`:""}
              </div>
              {mesesSel.sort((a,b)=>a.anio-b.anio||a.mes-b.mes).map(m=>(
                <div key={m.key} style={{ display:"flex",justifyContent:"space-between",fontSize:13,color:"var(--text)",padding:"2px 0 2px 12px" }}>
                  <span>{m.label}</span>
                  <span style={{ fontWeight:500 }}>${Number(form.monto).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ borderTop:"0.5px solid var(--border)",marginTop:10,paddingTop:10,display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:14 }}>
            <span>Total</span>
            <span style={{ color:"var(--blue)" }}>${totalMonto.toLocaleString()} MXN</span>
          </div>
        </div>
        <button onClick={reset}
                style={{ width:"100%",padding:"12px",borderRadius:10,border:"none",background:"var(--blue)",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
          Registrar otro pago
        </button>
      </div>
    </div>
  );

  // ── Formulario ───────────────────────────────────────────────
  const inp = { width:"100%",padding:"10px 12px",borderRadius:10,border:"0.5px solid var(--border2)",fontSize:14,background:"var(--surface)",color:"var(--text)",outline:"none",fontFamily:"inherit",boxSizing:"border-box",transition:"border-color 0.15s" };
  const lbl = { display:"block",fontSize:12,fontWeight:600,color:"var(--text2)",marginBottom:6,letterSpacing:"0.01em" };
  const section = { background:"var(--surface)",border:"0.5px solid var(--border)",borderRadius:16,overflow:"hidden",marginBottom:12 };
  const secHead = (n,t) => (
    <div style={{ padding:"13px 16px",borderBottom:"0.5px solid var(--border)",background:"var(--surface2)",display:"flex",alignItems:"center",gap:8 }}>
      <span style={{ width:22,height:22,borderRadius:"50%",background:"var(--blue)",color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{n}</span>
      <span style={{ fontSize:13,fontWeight:600 }}>{t}</span>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",padding:"2rem 1rem 5rem" }}>

      {/* App header */}
      <div style={{ width:"100%",maxWidth:500,marginBottom:20 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:38,height:38,borderRadius:10,background:"var(--blue)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="19" height="19"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div>
            <div style={{ fontSize:16,fontWeight:700,color:"var(--text)" }}>Fraccionamiento</div>
            <div style={{ fontSize:11,color:"var(--text3)" }}>Registro de cuotas mensuales</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ width:"100%",maxWidth:500,display:"flex",flexDirection:"column" }}>

        {/* Error */}
        {error && (
          <div style={{ background:"var(--red-bg)",color:"var(--red)",borderRadius:10,padding:"11px 14px",fontSize:13,marginBottom:14,display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ fontSize:16,flexShrink:0 }}>⚠️</span>{error}
          </div>
        )}

        {/* Duplicado warning */}
        {dupWarning.length>0 && (
          <div style={{ background:"var(--amber-bg)",color:"var(--amber)",borderRadius:10,padding:"14px",fontSize:13,marginBottom:14 }}>
            <div style={{ fontWeight:700,marginBottom:6 }}>⚠️ Posible pago duplicado</div>
            <p style={{ marginBottom:10,lineHeight:1.5 }}>Ya existe un pago registrado para: <strong>{dupWarning.join(", ")}</strong>. ¿Enviar de todas formas?</p>
            <div style={{ display:"flex",gap:8 }}>
              <button type="button" onClick={()=>setDupWarning([])} style={{ padding:"7px 14px",borderRadius:8,border:"0.5px solid var(--border2)",background:"var(--surface)",fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>Cancelar</button>
              <button type="button" onClick={()=>doSubmit()} disabled={loading} style={{ padding:"7px 14px",borderRadius:8,border:"none",background:"var(--amber)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>{loading?"Enviando...":"Sí, enviar"}</button>
            </div>
          </div>
        )}

        {/* ── SECCIÓN 1: Datos personales ── */}
        <div style={section}>
          {secHead(1,"Tus datos")}
          <div style={{ padding:"16px" }}>

            {/* Nombre + autocomplete */}
            <div style={{ marginBottom:14,position:"relative" }}>
              <label style={lbl}>Nombre completo *</label>
              <input style={inp} value={form.nombre} autoFocus
                     onChange={e=>handleNombreChange(e.target.value)}
                     placeholder="Escribe tu nombre para buscarte..."/>
              {searching && <div style={{ fontSize:11,color:"var(--text3)",marginTop:4 }}>Buscando...</div>}
              {searchResults.length>0 && (
                <div style={{ position:"absolute",left:0,right:0,top:"100%",marginTop:4,background:"var(--surface)",border:"0.5px solid var(--border2)",borderRadius:10,boxShadow:"0 4px 20px rgba(0,0,0,0.12)",zIndex:20,overflow:"hidden" }}>
                  {searchResults.map(r=>(
                    <button key={r.id} type="button" onClick={()=>selectResident(r)}
                            style={{ display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"11px 14px",fontSize:13,borderBottom:"0.5px solid var(--border)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",gap:8 }}
                            onMouseOver={e=>e.currentTarget.style.background="var(--blue-bg)"}
                            onMouseOut={e=>e.currentTarget.style.background="none"}>
                      <span style={{ fontWeight:500,color:"var(--text)" }}>{r.residente.split("/")[0].trim()}</span>
                      <span style={{ fontSize:11,color:"var(--text3)",flexShrink:0 }}>{r.calle} · L{r.lote}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Teléfono */}
            <div>
              <label style={lbl}>Número de WhatsApp *</label>
              <input style={inp} type="tel" value={form.telefono} onChange={e=>setF("telefono",e.target.value)} placeholder="55 1234 5678"/>
              <div style={{ fontSize:11,color:"var(--text3)",marginTop:5 }}>Recibirás la confirmación aquí</div>
            </div>
          </div>
        </div>

        {/* ── SECCIÓN 2: Propiedades ── */}
        <div style={section}>
          {secHead(2, propiedades.length===1 ? "Tu domicilio" : `Tus propiedades (${propiedades.length})`)}
          <div style={{ padding:"16px" }}>
            <div style={{ fontSize:12,color:"var(--text3)",marginBottom:12,lineHeight:1.5 }}>
              ¿Tienes más de una casa o lote en el fraccionamiento? Agrégalos aquí para pagar todos a la vez.
            </div>

            {propiedades.map((prop,idx)=>(
              <PropiedadRow
                key={prop.id}
                prop={prop}
                onChange={(k,v)=>updateProp(prop.id,k,v)}
                onRemove={()=>removeProp(prop.id)}
                onAutofill={(c,l,m)=>autofillProp(prop.id,c,l,m)}
                canRemove={propiedades.length>1}
                pendientes={pendientes}
              />
            ))}

            {/* Botón agregar propiedad */}
            <button type="button" onClick={addProp}
                    style={{ width:"100%",padding:"10px",borderRadius:10,border:"1.5px dashed var(--border2)",background:"transparent",color:"var(--blue)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.15s" }}
                    onMouseOver={e=>{ e.currentTarget.style.borderColor="var(--blue)"; e.currentTarget.style.background="var(--blue-bg)"; }}
                    onMouseOut={e=>{ e.currentTarget.style.borderColor="var(--border2)"; e.currentTarget.style.background="transparent"; }}>
              <PlusIcon/> Agregar otra propiedad
            </button>
          </div>
        </div>

        {/* ── SECCIÓN 3: Pago ── */}
        <div style={section}>
          {secHead(3,"Detalle del pago")}
          <div style={{ padding:"16px" }}>

            {/* Meses — botón que abre modal */}
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Meses que estás pagando *</label>
              <button type="button" onClick={()=>setShowMesesModal(true)}
                      style={{ width:"100%",padding:"11px 14px",borderRadius:10,border:`1.5px solid ${mesesSel.length?"var(--blue)":"var(--border2)"}`,background:mesesSel.length?"var(--blue-bg)":"var(--surface)",color:mesesSel.length?"var(--blue-text)":"var(--text3)",fontSize:14,fontWeight:mesesSel.length?600:400,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s" }}>
                <span>{mesesSel.length===0?"Seleccionar meses...":mesesSel.length===1?mesesSel[0].label:`${mesesSel.length} meses seleccionados`}</span>
                <span style={{ fontSize:16,opacity:0.5 }}>▾</span>
              </button>
              {mesesSel.length>0 && (
                <div style={{ marginTop:8,display:"flex",flexWrap:"wrap",gap:5 }}>
                  {mesesSel.sort((a,b)=>a.anio-b.anio||a.mes-b.mes).map(m=>(
                    <span key={m.key} style={{ fontSize:12,background:"var(--blue-bg)",color:"var(--blue-text)",padding:"3px 10px",borderRadius:6,display:"inline-flex",alignItems:"center",gap:5,fontWeight:500 }}>
                      {m.label}
                      <button type="button" onClick={()=>toggleMes(m)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--blue)",fontSize:13,lineHeight:1,padding:0 }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Monto */}
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Monto pagado por mes (MXN) *</label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--text3)",fontSize:15,fontWeight:500 }}>$</span>
                <input style={{ ...inp,paddingLeft:26 }} type="number" min="1" step="1" value={form.monto} onChange={e=>setF("monto",e.target.value)} placeholder="350"/>
              </div>
              {/* Resumen de cuentas */}
              {totalEnvios>1 && form.monto && (
                <div style={{ marginTop:8,padding:"10px 12px",background:"var(--blue-bg)",borderRadius:9,fontSize:12,color:"var(--blue-text)" }}>
                  <div style={{ fontWeight:600,marginBottom:4 }}>Resumen del pago:</div>
                  {propsValidas.map(p=>(
                    <div key={p.id} style={{ display:"flex",justifyContent:"space-between",padding:"1px 0" }}>
                      <span>{p.calle} L{p.lote} · {mesesSel.length} mes{mesesSel.length>1?"es":""}</span>
                      <span style={{ fontWeight:600 }}>${(Number(form.monto)*mesesSel.length).toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ borderTop:"0.5px solid rgba(24,95,165,0.2)",marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontWeight:700 }}>
                    <span>Total</span>
                    <span>${totalMonto.toLocaleString()} MXN</span>
                  </div>
                </div>
              )}
            </div>

            {/* Comprobante */}
            <div>
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
                  <div style={{ position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.55),transparent)",display:"flex",alignItems:"flex-end",justifyContent:"space-between",padding:"10px 12px" }}>
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

        {/* ── SECCIÓN 4: Notas ── */}
        <div style={section}>
          <div style={{ padding:"14px 16px" }}>
            <label style={{ ...lbl,marginBottom:8 }}>Notas adicionales (opcional)</label>
            <textarea style={{ ...inp,resize:"none",height:68 }} value={form.notas} onChange={e=>setF("notas",e.target.value)}
                      placeholder="Ej: Pago en efectivo, referencia del banco, abono parcial..."/>
          </div>
        </div>

        {/* Botón enviar */}
        <button type="submit" disabled={loading}
                style={{ width:"100%",padding:"14px",borderRadius:12,border:"none",background:loading?"var(--surface2)":"var(--blue)",color:loading?"var(--text3)":"#fff",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",transition:"all 0.15s",boxShadow:loading?"none":"0 4px 16px rgba(24,95,165,0.28)",marginBottom:14 }}>
          {loading ? "Enviando..." : mesesSel.length===0||propsValidas.length===0 ? "Completa los campos para continuar" : totalEnvios===1 ? "Enviar comprobante de pago" : `Enviar pago · ${totalEnvios} registro${totalEnvios>1?"s":""} · $${totalMonto.toLocaleString()} MXN`}
        </button>

        <div style={{ textAlign:"center",fontSize:11,color:"var(--text3)",lineHeight:1.6 }}>
          Al enviar confirmas que la información es correcta.<br/>
          Recibirás confirmación por WhatsApp al aprobar tu pago.
        </div>
      </form>

      {/* Modal meses */}
      {showMesesModal && (
        <MesesModal opciones={opciones} mesesSel={mesesSel} pendientes={allPendientes}
                    onToggle={toggleMes} onClose={()=>setShowMesesModal(false)}/>
      )}
    </div>
  );
}
