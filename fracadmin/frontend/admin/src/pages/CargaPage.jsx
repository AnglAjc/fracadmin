import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import api from "../lib/api";
import { parseExcelWorkbook } from "../lib/helpers";

export default function CargaPage() {
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus(null); setPreview(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const parsed = parseExcelWorkbook(wb, XLSX);
        if (parsed.length === 0) {
          setStatus({ type: "error", msg: "No se encontraron residentes. Verifica que el archivo tenga las hojas: AMADA, BALVINA, MARBELLA, MANUELA, VIRGINIA." });
          return;
        }
        const forDB = parsed.map(r => ({ id: r.id, calle: r.calle.toUpperCase(), lote: r.lote, mza: r.mza, residente: r.residente, pagos25: r.pagos25, pagos26: r.pagos26, deudaExtra: r.deudaExtra }));
        const calles = [...new Set(forDB.map(r => r.calle))];
        setPreview({ residents: forDB, file: file.name, calles });
      } catch (err) {
        setStatus({ type: "error", msg: "Error al leer el archivo: " + err.message });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const importar = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const { data } = await api.post("/api/residents/import", { residents: preview.residents });
      setStatus({ type: "success", msg: `✓ Importación completada: ${data.inserted} nuevos · ${data.updated} actualizados · ${data.total} total` });
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setStatus({ type: "error", msg: err.response?.data?.error || "Error al importar" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", flex: 1 }}>
      <div className="page-title">Cargar datos</div>
      <div className="page-sub">Importa tu archivo Excel del fraccionamiento</div>

      {status && <div className={`alert ${status.type === "success" ? "success" : "error"}`}>{status.msg}</div>}

      {!preview && (
        <div className="upload-zone" onClick={() => inputRef.current?.click()}>
          <div className="icon">📂</div>
          <h3>Haz clic para seleccionar tu archivo</h3>
          <p>Formato .xlsx · Compatible con el formato del fraccionamiento</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
        </div>
      )}

      {preview && (
        <div className="card">
          <div className="card-header"><h3>Vista previa — {preview.file}</h3></div>
          <div className="card-body">
            <div className="metrics" style={{ marginBottom: "1rem" }}>
              <div className="metric blue"><label>Total residentes</label><div className="val">{preview.residents.length}</div></div>
              <div className="metric"><label>Calles</label><div className="val">{preview.calles.length}</div></div>
            </div>
            <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: "1rem" }}>Calles: {preview.calles.join(", ")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn primary" onClick={importar} disabled={loading}>
                {loading ? "Importando..." : `Importar ${preview.residents.length} residentes`}
              </button>
              <button className="btn" onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ""; }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header"><h3>Formato esperado del archivo</h3></div>
        <div className="card-body">
          <p style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>
            El Excel debe tener hojas con los nombres de las calles: <strong>AMADA, BALVINA, MARBELLA, MANUELA, VIRGINIA</strong>.
            Cada hoja con columnas: LOTE · MZA · RESIDENTE · 12 meses 2025 · [deuda extra] · [vacío] · 12 meses 2026
          </p>
          <div className="format-box">LOTE | MZA | RESIDENTE | ENE | FEB | ... | DIC | [deuda] | [vacío] | ENE26 | ... | DIC26</div>
          <p style={{ color: "var(--text3)", fontSize: 12, marginTop: 8 }}>Los valores "CHECAR" se detectan como pago pendiente. "VACIO" como unidad desocupada.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-body">
          <p style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
            Los residentes registran sus pagos directamente usando el formulario en línea.
            Aprueba cada pago en la sección <strong>Pagos</strong> para mantener el sistema al día.
          </p>
          <a href="https://formularioresidentes.onrender.com" target="_blank" rel="noreferrer" className="btn wa">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            Abrir formulario de residentes
          </a>
        </div>
      </div>
    </div>
  );
}
