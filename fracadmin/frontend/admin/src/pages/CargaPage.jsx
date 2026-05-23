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
    setStatus(null);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb     = XLSX.read(ev.target.result, { type: "array" });
        const parsed = parseExcelWorkbook(wb, XLSX);

        if (parsed.length === 0) {
          setStatus({ type: "error", msg: "No se encontraron residentes. Verifica que el archivo tenga las hojas: AMADA, BALVINA, MARBELLA, MANUELA, VIRGINIA." });
          return;
        }

        const forDB = parsed.map(r => ({
          id:         r.id,
          calle:      r.calle.toUpperCase(),
          lote:       r.lote,
          mza:        r.mza,
          residente:  r.residente,
          pagos25:    r.pagos25,
          pagos26:    r.pagos26,
          deudaExtra: r.deudaExtra,
        }));

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
      setStatus({
        type: "success",
        msg: `Importacion completada: ${data.inserted} nuevos · ${data.updated} actualizados · ${data.total} total`,
      });
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setStatus({ type: "error", msg: err.response?.data?.error || "Error al importar" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Cargar Excel</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text2)" }}>
        Importa el archivo Excel normalizado para actualizar los datos de residentes.
      </p>

      <div
        className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer hover:border-blue-400 transition-colors mb-5"
        style={{ borderColor: "var(--border2)" }}
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-4xl mb-3">📂</p>
        <p className="font-medium text-sm text-gray-600">Haz clic para seleccionar el archivo Excel</p>
        <p className="text-xs text-gray-400 mt-1">Formato: .xlsx normalizado</p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
      </div>

      {status && (
        <div className={`p-4 rounded-xl text-sm mb-5 ${
          status.type === "success"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {status.msg}
        </div>
      )}

      {preview && (
        <div className="bg-white border rounded-2xl p-5" style={{ borderColor: "var(--border)" }}>
          <p className="font-medium text-sm mb-3">
            Vista previa — <span className="text-gray-500">{preview.file}</span>
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl p-3" style={{ background: "var(--blue-bg)" }}>
              <p className="text-xs text-gray-500">Total residentes</p>
              <p className="text-2xl font-semibold" style={{ color: "var(--blue)" }}>
                {preview.residents.length}
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--surface2)" }}>
              <p className="text-xs text-gray-500">Calles</p>
              <p className="text-2xl font-semibold text-gray-700">{preview.calles.length}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-4">Calles: {preview.calles.join(", ")}</p>
          <button onClick={importar} disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-60"
                  style={{ background: "var(--blue)" }}>
            {loading ? "Importando..." : `Importar ${preview.residents.length} residentes`}
          </button>
          <button onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ""; }}
                  className="w-full mt-2 py-2 text-sm text-gray-400 hover:text-gray-600">
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
