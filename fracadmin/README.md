# FracAdmin — Sistema de Gestión de Fraccionamiento

Aplicación full-stack para gestión de pagos y morosos del fraccionamiento.

## Arquitectura

```
fracadmin/
├── backend/          # API Node.js + Express (desplegado en Render)
├── frontend/
│   ├── admin/        # Panel de administrador (React + Vite)
│   └── resident/     # Formulario de residentes (React + Vite)
└── shared/           # Tipos y utilidades compartidas
```

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js, Express, PostgreSQL (Neon) |
| Frontend Admin | React, Vite, TailwindCSS |
| Frontend Residente | React, Vite, TailwindCSS |
| Base de datos | NeonTech (PostgreSQL serverless) |
| Deploy | Render (backend + 2 frontends estáticos) |
| Notificaciones | WhatsApp Business API |

## Variables de entorno necesarias

Ver `backend/.env.example` y `frontend/admin/.env.example`

## Despliegue en Render

1. **Backend**: Web Service apuntando a `/backend`, build `npm install`, start `npm start`
2. **Admin**: Static Site apuntando a `/frontend/admin`, build `npm run build`, publish `dist`
3. **Residente**: Static Site apuntando a `/frontend/resident`, build `npm run build`, publish `dist`
