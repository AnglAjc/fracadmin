import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Layout        from "./components/Layout";
import LoginPage      from "./pages/LoginPage";
import DashboardPage  from "./pages/DashboardPage";
import ResidentesPage from "./pages/ResidentesPage";
import MorososPage    from "./pages/MorososPage";
import PagosPage      from "./pages/PagosPage";
import CargaPage      from "./pages/CargaPage";
import FinanzasPage   from "./pages/FinanzasPage";
import ConfigPage     from "./pages/ConfigPage";

function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"var(--text3)" }}>Cargando...</div>;
  if (!admin)  return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="residentes" element={<ResidentesPage />} />
          <Route path="morosos"    element={<MorososPage />} />
          <Route path="pagos"      element={<PagosPage />} />
          <Route path="finanzas"   element={<FinanzasPage />} />
          <Route path="carga"      element={<CargaPage />} />
          <Route path="config"     element={<ConfigPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
