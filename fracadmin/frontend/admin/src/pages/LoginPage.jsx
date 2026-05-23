import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="bg-white border rounded-2xl p-10 w-full max-w-sm shadow-sm" style={{ borderColor: "var(--border)" }}>
        <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--blue)" }}>FracAdmin</h1>
        <p className="text-sm mb-8" style={{ color: "var(--text2)" }}>Panel de Administración</p>

        {error && (
          <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: "var(--red-bg)", color: "var(--red)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>
              Correo electrónico
            </label>
            <input
              type="email" required autoFocus
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors"
              style={{ borderColor: "var(--border2)" }}
              placeholder="admin@fraccionamiento.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text2)" }}>
              Contraseña
            </label>
            <input
              type="password" required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors"
              style={{ borderColor: "var(--border2)" }}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: "var(--blue)" }}
          >
            {loading ? "Entrando..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
