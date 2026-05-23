import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001",
  timeout: 15000,
});

// Agrega el token JWT a cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fracadmin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el token expiró, redirige al login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("fracadmin_token");
      localStorage.removeItem("fracadmin_admin");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
