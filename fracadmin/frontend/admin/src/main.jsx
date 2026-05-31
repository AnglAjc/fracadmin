import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Aplicar modo oscuro guardado antes de renderizar
const dark = localStorage.getItem("fracadmin_dark") === "true";
if (dark) {
  const r = document.documentElement;
  r.style.setProperty("--bg",       "#0f0f0e");
  r.style.setProperty("--surface",  "#1a1a18");
  r.style.setProperty("--surface2", "#242422");
  r.style.setProperty("--border",   "rgba(255,255,255,0.08)");
  r.style.setProperty("--border2",  "rgba(255,255,255,0.14)");
  r.style.setProperty("--text",     "#f0f0ed");
  r.style.setProperty("--text2",    "#a0a09a");
  r.style.setProperty("--text3",    "#666660");
  r.style.setProperty("--blue-bg",  "#0d2540");
  r.style.setProperty("--green-bg", "#0d2010");
  r.style.setProperty("--red-bg",   "#2a0d0d");
  r.style.setProperty("--amber-bg", "#2a1a00");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
