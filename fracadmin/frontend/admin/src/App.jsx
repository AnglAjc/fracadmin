import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ResidentesPage from "./pages/ResidentesPage";
import MorososPage from "./pages/MorososPage";
import PagosPage from "./pages/PagosPage";
import CargaPage from "./pages/CargaPage";

function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Cargando...</div>;
  if (!admin)  return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="residentes" element={<ResidentesPage />} />
          <Route path="morosos"    element={<MorososPage />} />
          <Route path="pagos"      element={<PagosPage />} />
          <Route path="carga"      element={<CargaPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
