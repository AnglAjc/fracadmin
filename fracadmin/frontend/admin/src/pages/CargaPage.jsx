import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import api from "../lib/api";

const CALLES = ["AMADA","BALVINA","MARBELLA","MANUELA","VIRGINIA"];
const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ── Parser Excel de residentes ─────────────────────────────────
// Layout de columnas (0-indexed):
//   0=LOTE  1=MZA  2=RESIDENTE
//   3..14  = pagos 2025 (Ene–Dic)
//   15     = TOTAL 2025 (ignorado)
//   16     = DEUDA EXTRA
//   17..28 = pagos 2026 (Ene–Dic)
//   29     = TELEFONO
function parseVal(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toUpperCase();
  if (!s || s === "NAN") return null;
  if (["CHECAR","N/A","NA"].includes(s)) return "pendiente";
  if (["VACIO","VACÍO"].includes(s)) return "vacio";
  const n = parseFloat(s);
  return isNaN(n) ? "pendiente" : n;
}

function parseExcel(wb) {
  const result = [];
  for (const rawName of wb.SheetNames) {
    const name = rawName.trim().toUpperCase();
    if (!CALLES.includes(name)) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[rawName], { header:1, defval:null, raw:false });
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 3) continue;
      const lote = String(row[0]??"").trim();
      const mza  = String(row[1]??"").trim();
      const res  = String(row[2]??"").trim();
      if (!res || ["NaN","nan","LOTE","RESIDENTE"].includes(res)) continue;
      if (!lote || lote === "NaN") continue;
      if (res.toLowerCase().startsWith("terreno") || res.toLowerCase().startsWith("teereno")) continue;
      if (!isNaN(Number(res))) continue;
      const pagos25 = {}, pagos26 = {};
      for (let m = 0; m < 12; m++) { pagos25[m] = parseVal(row[3+m]); pagos26[m] = parseVal(row[17+m]); }
      const telefono = String(row[29]??"").trim().replace(/\D/g,"") || null;
      result.push({ id:`${name}-${lote}-${mza}-${r}`, calle:name, lote, mza, residente:res,
                    pagos25, pagos26, deudaExtra: parseFloat(row[16])||0, telefono });
    }
  }
  return result;
}

// ── Parser CSV de WhatsForm ────────────────────────────────────
function parseWhatsformCSV(text) {
  const { data, errors } = Papa.parse(text.trim(), { header:true, skipEmptyLines:true });
  if (errors.length > 0 && data.length === 0) throw new Error("CSV inválido");

  const registros = [];
  const mesesMap  = {};
  MESES_FULL.forEach((m,i) => { mesesMap[m.toLowerCase()] = i+1; });

  for (const row of data) {
    const nombre   = row["Escriba su nombre empezando por Apellidos "]
                  || row["Nombre completo"] || row["Nombre"] || Object.values(row)[2] || "";
    const telefono = row["Número de Whatsapp o Número telefónico ☎️"]
                  || row["Numero de WhatsApp"] || row["Teléfono"] || Object.values(row)[3] || "";
    const calle    = row["¿De qué calle eres? 🛣"] || row["Calle"] || Object.values(row)[4] || "";
    const lote     = row["Número de casa 🏠"] || row["Numero de casa"] || Object.values(row)[5] || "";
    const mza      = row["Manzana"] || row["mza"] || Object.values(row)[6] || "";
    const monto    = row["¿Cuánto va a pagar? "] || row["Monto"] || Object.values(row)[7] || "";
    const comprobante = row["Agregue su comprobante aquí"] || row["Comprobante"] || "";
    const mesRaw   = row["¿Qué mes pago?"] || row["Mes"] || Object.values(row)[9] || "";
    const timestamp= row["Time"] || row["Marca temporal"] || Object.values(row)[1] || "";

    if (!nombre.trim() || !monto) continue;

    let mes = null, anio = null;
    const mesStr = String(mesRaw).trim();
    const matchMonthYear = mesStr.match(/([A-Za-záéíóúÁÉÍÓÚ]+)\s+(\d{4})/i);
    const matchNumYear   = mesStr.match(/(\d{1,2})[\/\-](\d{4})/);

    if (matchMonthYear) {
      mes  = mesesMap[matchMonthYear[1].toLowerCase()] || null;
      anio = parseInt(matchMonthYear[2]);
    } else if (matchNumYear) {
      mes  = parseInt(matchNumYear[1]);
      anio = parseInt(matchNumYear[2]);
    } else {
      mes  = mesesMap[mesStr.toLowerCase()] || null;
      anio = new Date().getFullYear();
    }

    if (!mes || !anio) continue;

    const montoNum = parseFloat(String(monto).replace(/[$,\s]/g,""));
    if (isNaN(montoNum) || montoNum <= 0) continue;

    registros.push({
      timestamp:   timestamp || new Date().toISOString(),
      nombre:      nombre.trim(),
      telefono:    String(telefono).trim().replace(/\D/g,""),
      calle:       calle.trim().toUpperCase(),
      lote:        lote.trim(),
      mza:         mza.trim(),
      mes,
      anio,
      monto:       montoNum,
      notas:       null,
      comprobante: comprobante.trim() || null,
    });
  }
  return registros;
}

// ── Tabs ──────────────────────────────────────────────────────
const TABS = [
  { key:"excel",    label:"Residentes (Excel)", icon:"📊" },
  { key:"whatsform",label:"Pagos WhatsForm (CSV)", icon:"💬" },
];

export default function CargaPage() {
  const [tab, setTab]         = useState("excel");
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef();

  const reset = () => { setStatus(null); setPreview(null); if(inputRef.current) inputRef.current.value=""; };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    reset();
    const reader = new FileReader();

    if (tab === "excel") {
      reader.onload = (ev) => {
        try {
          const wb     = XLSX.read(ev.target.result, { type:"array" });
          const parsed = parseExcel(wb);
          if (parsed.length === 0) {
            setStatus({ type:"error", msg:"No se encontraron residentes. Verifica las hojas: AMADA, BALVINA, MARBELLA, MANUELA, VIRGINIA." });
            return;
          }
          const calles = [...new Set(parsed.map(r=>r.calle))];
          const conTel = parsed.filter(r=>r.telefono).length;
          setPreview({ type:"excel", residents:parsed, file:file.name, calles, conTel });
        } catch (err) {
          setStatus({ type:"error", msg:"Error al leer el archivo: " + err.message });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (ev) => {
        try {
          const registros = parseWhatsformCSV(ev.target.result);
          if (registros.length === 0) {
            setStatus({ type:"error", msg:"No se encontraron pagos válidos en el CSV. Verifica que las columnas correspondan al formato de WhatsForm." });
            return;
          }
          setPreview({ type:"whatsform", registros, file:file.name });
        } catch (err) {
          setStatus({ type:"error", msg:"Error al leer el CSV: " + err.message });
        }
      };
      reader.readAsText(file, "UTF-8");
    }
  };

  const importarResidentes = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const { data } = await api.post("/api/residents/import", { residents: preview.residents });
      setStatus({ type:"success", msg:`✓ ${data.inserted} nuevos · ${data.updated} actualizados · ${data.total} total` });
      setPreview(null); if(inputRef.current) inputRef.current.value="";
    } catch (err) {
      setStatus({ type:"error", msg: err.response?.data?.error || "Error al importar" });
    } finally { setLoading(false); }
  };

  const importarPagos = async () => {
    if (!preview) return;
    setLoading(true);
    let ok = 0, fail = 0;
    try {
      for (const r of preview.registros) {
        try {
          await api.post("/api/payments/submit", {
            nombre:          r.nombre,
            telefono:        r.telefono,
            calle:           r.calle,
            lote:            r.lote,
            mza:             r.mza,
            mes:             r.mes,
            anio:            r.anio,
            monto:           r.monto,
            comprobante_url: r.comprobante || null,
            notas:           "[WhatsForm CSV]",
          });
          ok++;
        } catch { fail++; }
      }
      setStatus({ type:"success", msg:`✓ ${ok} pagos importados como "pendientes de revisión"${fail>0?` · ${fail} fallaron`:""}. Ve a la sección Pagos para aprobarlos.` });
      setPreview(null); if(inputRef.current) inputRef.current.value="";
    } catch (err) {
      setStatus({ type:"error", msg:"Error al importar pagos" });
    } finally { setLoading(false); }
  };

  const isExcel = tab === "excel";
  const accept  = isExcel ? ".xlsx,.xls" : ".csv";

  return (
    <div style={{ padding:"2rem", flex:1, maxWidth:720 }}>
      <div className="page-title">Cargar datos</div>
      <div className="page-sub">Importa residentes desde Excel o pagos desde WhatsForm CSV</div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom:"1.5rem" }}>
        {TABS.map(t=>(
          <button key={t.key} className={`tab ${tab===t.key?"active":""}`}
                  onClick={()=>{ setTab(t.key); reset(); }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {status && (
        <div className={`alert ${status.type==="success"?"success":"error"}`} style={{ marginBottom:"1rem" }}>
          {status.msg}
        </div>
      )}

      {/* Upload zone */}
      {!preview && (
        <div className="upload-zone" onClick={()=>inputRef.current?.click()}>
          <div className="icon">{isExcel?"📊":"💬"}</div>
          <h3>{isExcel?"Haz clic para seleccionar el Excel":"Haz clic para seleccionar el CSV de WhatsForm"}</h3>
          <p style={{ marginBottom:6 }}>
            {isExcel
              ? "Formato .xlsx — hojas AMADA, BALVINA, MARBELLA, MANUELA, VIRGINIA"
              : "Exporta el CSV desde WhatsForm y súbelo aquí"}
          </p>
          {!isExcel && (
            <p style={{ fontSize:12, color:"var(--text3)" }}>
              En WhatsForm → Respuestas → Descargar CSV
            </p>
          )}
          <input ref={inputRef} type="file" accept={accept} onChange={handleFile} style={{ display:"none" }}/>
        </div>
      )}

      {/* Preview Excel */}
      {preview?.type==="excel" && (
        <div className="card">
          <div className="card-header"><h3>Vista previa — {preview.file}</h3></div>
          <div className="card-body">
            <div className="metrics" style={{ marginBottom:"1rem" }}>
              <div className="metric blue"><label>Residentes</label><div className="val">{preview.residents.length}</div></div>
              <div className="metric"><label>Calles</label><div className="val">{preview.calles.length}</div></div>
              <div className="metric green"><label>Con teléfono</label><div className="val">{preview.conTel}</div></div>
            </div>
            <p style={{ fontSize:12,color:"var(--text2)",marginBottom:"1rem" }}>
              Calles: {preview.calles.join(", ")}
            </p>
            <div style={{ display:"flex",gap:8 }}>
              <button className="btn primary" onClick={importarResidentes} disabled={loading}>
                {loading?"Importando...":`Importar ${preview.residents.length} residentes`}
              </button>
              <button className="btn" onClick={reset}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview CSV WhatsForm */}
      {preview?.type==="whatsform" && (
        <div className="card">
          <div className="card-header">
            <h3>Vista previa — {preview.file}</h3>
            <span className="badge amber">{preview.registros.length} pagos detectados</span>
          </div>
          <div style={{ overflow:"hidden" }}>
            <div style={{ padding:"12px 16px",background:"var(--amber-bg)",fontSize:12,color:"var(--amber)",borderBottom:"0.5px solid var(--border)" }}>
              ⚠️ Los pagos se importarán como <strong>pendientes de revisión</strong>. Ve a la sección <strong>Pagos</strong> para aprobar o rechazar cada uno.
            </div>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Calle / Lote</th>
                    <th>Mes</th>
                    <th style={{ textAlign:"right" }}>Monto</th>
                    <th>Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.registros.slice(0,20).map((r,i)=>(
                    <tr key={i}>
                      <td style={{ fontWeight:500 }}>{r.nombre}</td>
                      <td style={{ fontSize:12,color:"var(--text2)" }}>{r.calle} · L{r.lote}{r.mza?` Mza ${r.mza}`:""}</td>
                      <td style={{ fontSize:12 }}>{MESES_FULL[r.mes-1]} {r.anio}</td>
                      <td style={{ textAlign:"right",fontWeight:600,color:"var(--blue)" }}>${r.monto.toLocaleString()}</td>
                      <td style={{ fontSize:12,color:"var(--text3)" }}>{r.telefono||"—"}</td>
                    </tr>
                  ))}
                  {preview.registros.length>20 && (
                    <tr><td colSpan="5" style={{ textAlign:"center",color:"var(--text3)",fontSize:12,padding:"10px" }}>
                      ... y {preview.registros.length-20} más
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding:"1rem 16px",display:"flex",gap:8 }}>
              <button className="btn primary" onClick={importarPagos} disabled={loading}>
                {loading?"Importando...":`Importar ${preview.registros.length} pagos`}
              </button>
              <button className="btn" onClick={reset}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Info cards */}
      {!preview && (
        <>
          {isExcel ? (
            <div className="card" style={{ marginTop:"1rem" }}>
              <div className="card-header"><h3>Formato del Excel</h3></div>
              <div className="card-body">
                <p style={{ color:"var(--text2)",fontSize:13,lineHeight:1.7,marginBottom:10 }}>
                  Hojas: <strong>AMADA, BALVINA, MARBELLA, MANUELA, VIRGINIA</strong>
                </p>
                <div className="format-box">
                  LOTE | MZA | RESIDENTE | ENE–DIC (2025) | TOTAL | DEUDA_EXTRA | ENE–DIC (2026) | TELEFONO
                </div>
                <p style={{ color:"var(--text3)",fontSize:12,marginTop:8 }}>
                  Valores válidos: número = pagado · CHECAR / N/A = pendiente · VACIO = desocupado
                </p>
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginTop:"1rem" }}>
              <div className="card-header"><h3>¿Cómo exportar desde WhatsForm?</h3></div>
              <div className="card-body">
                <ol style={{ color:"var(--text2)",fontSize:13,lineHeight:2,paddingLeft:18 }}>
                  <li>Entra a tu cuenta en <strong>whatsform.com</strong></li>
                  <li>Abre tu formulario de pagos</li>
                  <li>Ve a la sección <strong>Respuestas</strong></li>
                  <li>Clic en <strong>Exportar → CSV</strong></li>
                  <li>Sube el archivo aquí</li>
                </ol>
                <div className="alert amber" style={{ marginTop:12,fontSize:12 }}>
                  El sistema detecta automáticamente las columnas. Si las columnas de tu formulario tienen nombres diferentes, revisa que el mes esté en formato "Enero 2026" o "1/2026".
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}