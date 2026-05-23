import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { calcDeuda, fmtMXN, CALLES } from "../lib/helpers";

const STATUS_BADGE = {
  corriente: "bg-green-100 text-green-700",
  leve:      "bg-amber-100 text-amber-700",
  moroso:    "bg-red-100 text-red-700",
};

export default function ResidentesPage() {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [calle, setCalle]         = useState("");
  const [search, setSearch]       = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (calle)  params.set("calle",  calle);
    if (search) params.set("search", search);
    api.get(`/api/residents?${params}`)
      .then(r => setResidents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [calle, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-1">Residentes</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text2)" }}>
        {residents.length} residentes cargados
      </p>

      {/* Filtros */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select value={calle} onChange={e => setCalle(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                style={{ borderColor: "var(--border2)" }}>
          <option value="">Todas las calles</option>
          {CALLES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
               placeholder="Buscar residente..."
               className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 flex-1 min-w-[180px]"
               style={{ borderColor: "var(--border2)" }} />
      </div>

      {loading ? (
        <div className="text-gray-400">Cargando...</div>
      ) : residents.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📂</p>
          <p>No hay residentes cargados. Ve a <strong>Cargar Excel</strong>.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Residente</th>
                  <th>Calle</th>
                  <th>Lote / Mza</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th className="text-right">Deuda</th>
                </tr>
              </thead>
              <tbody>
                {residents.map(r => {
                  const deuda = calcDeuda(r);
                  const st    = deuda <= 0 ? "corriente" : deuda <= 700 ? "leve" : "moroso";
                  return (
                    <tr key={r.id}>
                      <td className="font-medium text-sm">
                        {r.residente.split("/")[0].trim()}
                      </td>
                      <td className="text-sm text-gray-500">{r.calle}</td>
                      <td className="text-sm text-gray-400">L{r.lote} · Mza {r.mza}</td>
                      <td className="text-sm text-gray-400">{r.telefono || "—"}</td>
                      <td>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[st]}`}>
                          {st === "corriente" ? "Al corriente" : st === "leve" ? "Deuda leve" : "Moroso"}
                        </span>
                      </td>
                      <td className="text-right font-semibold text-sm"
                          style={{ color: deuda > 0 ? "var(--red)" : "var(--green)" }}>
                        {deuda > 0 ? fmtMXN(deuda) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
