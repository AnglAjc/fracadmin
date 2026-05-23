import { createContext, useContext, useState, useEffect } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fracadmin_admin") || "null");
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("fracadmin_token");
    if (!token) { setLoading(false); return; }
    api.get("/api/auth/me")
      .then(r => setAdmin(r.data.admin))
      .catch(() => {
        localStorage.removeItem("fracadmin_token");
        localStorage.removeItem("fracadmin_admin");
        setAdmin(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("fracadmin_token", data.token);
    localStorage.setItem("fracadmin_admin", JSON.stringify(data.admin));
    setAdmin(data.admin);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("fracadmin_token");
    localStorage.removeItem("fracadmin_admin");
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
