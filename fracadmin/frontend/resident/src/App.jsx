import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const CALLES = ["AMADA", "BALVINA", "MARBELLA", "MANUELA", "VIRGINIA"];
const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Genera lista de opciones mes/año desde Ene 2025 hasta mes actual +1
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

export default function App() {
  const [step, setStep]           = useState("form");   // "form" | "success" | "error"
  const [loading, setLoading]     = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [residentFound, setResidentFound] = useState(null);
  const searchTimer = useRef(null);

  const [form, setForm] = useState({
    nombre:          "",
    telefono:        "",
    calle:           "",
    lote:            "",
    mza:             "",
    mes:             "",
    anio:            "",
    monto:           "",
    comprobante_url: "",
    notas:           "",
    resident_id:     "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Autofill por nombre
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
    setForm(f => ({
      ...f,
      nombre:      r.residente.split("/")[0].trim(),
      calle:       r.calle,
      lote:        r.lote,
      mza:         r.mza,
      resident_id: r.id,
    }));
  };

  // Autofill por calle + lote + mza
  const tryAutofillByLocation = async () => {
    if (!form.calle || !form.lote) return;
    try {
      const params = new URLSearchParams({ calle: form.calle, lote: form.lote });
      if (form.mza) params.set("mza", form.mza);
      const { data } = await axios.get(`${API}/api/residents/by-location?${params}`);
      if (data) {
        setResidentFound(data);
        set("resident_id", data.id);
        if (!form.nombre) set("nombre", data.residente.split("/")[0].trim());
      }
    } catch {}
  };

  useEffect(() => {
    if (form.calle && form.lote) tryAutofillByLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.calle, form.lote, form.mza]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.calle || !form.lote || !form.mes || !form.monto) return;

    setLoading(true);
    try {
      await axios.post(`${API}/api/payments/submit`, {
        resident_id:     form.resident_id || null,
        nombre:          form.nombre.trim(),
        telefono:        form.telefono.trim(),
        calle:           form.calle,
        lote:            form.lote.trim(),
        mza:             form.mza.trim(),
        mes:             form.mes,
        anio:            Number(form.anio),
        monto:           Number(form.monto),
        comprobante_url: form.comprobante_url.trim() || null,
        notas:           form.notas.trim() || null,
      });
      setStep("success");
    } catch (err) {
      console.error(err);
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const opciones = getMesesOpciones();

  if (step === "success") return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border p-8 max-w-sm w-full text-center shadow-sm"
           style={{ borderColor: "var(--border)" }}>
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-semibold mb-2">¡Pago registrado!</h2>
        <p className="text-sm text-gray-500 mb-6">
          Tu comprobante fue enviado a la administración.
          Recibirás una notificación por WhatsApp una vez que sea revisado y aprobado.
        </p>
        <button onClick={() => { setStep("form"); setForm({ nombre:"",telefono:"",calle:"",lote:"",mza:"",mes:"",anio:"",monto:"",comprobante_url:"",notas:"",resident_id:"" }); setResidentFound(null); }}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ background: "var(--blue)" }}>
          Registrar otro pago
        </button>
      </div>
    </div>
  );

  if (step === "error") return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border p-8 max-w-sm w-full text-center shadow-sm"
           style={{ borderColor: "var(--border)" }}>
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold mb-2">Algo salió mal</h2>
        <p className="text-sm text-gray-500 mb-6">No pudimos registrar tu pago. Por favor intenta de nuevo.</p>
        <button onClick={() => setStep("form")}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ background: "var(--blue)" }}>
          Intentar de nuevo
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-10">
      <div className="bg-white rounded-2xl border shadow-sm w-full max-w-md"
           style={{ borderColor: "var(--border)" }}>
        {/* Header */}
        <div className="px-6 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <h1 className="text-lg font-semibold" style={{ color: "var(--blue)" }}>
            Registro de Pago
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text3)" }}>
            Fraccionamiento · Administración de cuotas
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">

          {/* Nombre con autocompletar */}
          <div className="relative">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>
              Nombre completo *
            </label>
            <input
              value={form.nombre}
              onChange={e => handleNombreChange(e.target.value)}
              placeholder="Busca tu nombre o escríbelo..."
              className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              style={{ borderColor: "var(--border2)" }}
              required autoFocus
            />
            {searching && (
              <p className="text-xs text-gray-400 mt-1">Buscando...</p>
            )}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-lg z-20 overflow-hidden"
                   style={{ borderColor: "var(--border2)" }}>
                {searchResults.map(r => (
                  <button key={r.id} type="button" onClick={() => selectResident(r)}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 border-b last:border-0 transition-colors"
                          style={{ borderColor: "var(--border)" }}>
                    <span className="font-medium">{r.residente.split("/")[0].trim()}</span>
                    <span className="text-gray-400 text-xs ml-2">
                      {r.calle} · L{r.lote}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chip de residente encontrado */}
          {residentFound && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                 style={{ background: "var(--green-bg)", color: "var(--green)" }}>
              <span>✓</span>
              <span>
                Residente encontrado: <strong>{residentFound.calle}</strong> · L{residentFound.lote} Mza {residentFound.mza}
              </span>
              <button type="button" onClick={() => { setResidentFound(null); set("resident_id", ""); }}
                      className="ml-auto text-green-400 hover:text-green-600 text-xs">✕</button>
            </div>
          )}

          {/* Teléfono */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>
              Número de WhatsApp *
            </label>
            <input
              value={form.telefono}
              onChange={e => set("telefono", e.target.value)}
              placeholder="10 dígitos: 55 1234 5678"
              className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              style={{ borderColor: "var(--border2)" }}
              type="tel" required
            />
            <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
              Aquí recibirás la confirmación de tu pago
            </p>
          </div>

          {/* Calle + Lote + Mza */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>
              Calle *
            </label>
            <select value={form.calle} onChange={e => set("calle", e.target.value)}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    style={{ borderColor: "var(--border2)" }} required>
              <option value="">Selecciona tu calle...</option>
              {CALLES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>
                Número de casa *
              </label>
              <input value={form.lote} onChange={e => set("lote", e.target.value)}
                     placeholder="Ej: 12, 12-A, 37-B"
                     className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                     style={{ borderColor: "var(--border2)" }} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>
                Manzana
              </label>
              <input value={form.mza} onChange={e => set("mza", e.target.value)}
                     placeholder="Ej: 3"
                     className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                     style={{ borderColor: "var(--border2)" }} />
            </div>
          </div>

          {/* Mes de pago */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>
              Mes que estás pagando *
            </label>
            <select
              value={`${form.mes}-${form.anio}`}
              onChange={e => {
                const [m, a] = e.target.value.split("-");
                setForm(f => ({ ...f, mes: m, anio: a }));
              }}
              className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              style={{ borderColor: "var(--border2)" }} required
            >
              <option value="-">Selecciona el mes...</option>
              {opciones.map(o => (
                <option key={`${o.mes}-${o.anio}`} value={`${o.mes}-${o.anio}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Monto */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>
              Monto pagado (MXN) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input value={form.monto} onChange={e => set("monto", e.target.value)}
                     placeholder="350"
                     className="w-full border rounded-lg pl-7 pr-3 py-2.5 text-sm outline-none focus:border-blue-500"
                     style={{ borderColor: "var(--border2)" }}
                     type="number" min="1" step="1" required />
            </div>
          </div>

          {/* Comprobante URL */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>
              Enlace del comprobante
            </label>
            <input value={form.comprobante_url} onChange={e => set("comprobante_url", e.target.value)}
                   placeholder="https://drive.google.com/... o similar"
                   className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                   style={{ borderColor: "var(--border2)" }}
                   type="url" />
            <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
              Sube tu foto a Google Drive y pega el enlace aquí
            </p>
          </div>

          {/* Notas opcionales */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>
              Notas (opcional)
            </label>
            <textarea value={form.notas} onChange={e => set("notas", e.target.value)}
                      placeholder="Ej: Pago parcial, pago con cheque..."
                      className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 resize-none"
                      style={{ borderColor: "var(--border2)" }}
                      rows={2} />
          </div>

          <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60 mt-2"
                  style={{ background: "var(--blue)" }}>
            {loading ? "Enviando..." : "Enviar comprobante de pago"}
          </button>

          <p className="text-center text-xs mt-3" style={{ color: "var(--text3)" }}>
            Recibirás confirmación por WhatsApp una vez que la administración apruebe tu pago.
          </p>
        </form>
      </div>
    </div>
  );
}
