# Guía de Despliegue — FracAdmin

## 1. Base de datos en Neon Tech

1. Ve a https://neon.tech y crea un proyecto llamado `fracadmin`
2. Copia la connection string (formato `postgresql://...`)
3. Pégala en `backend/.env` como `DATABASE_URL`
4. Ejecuta la migración una sola vez:
   ```bash
   cd backend
   npm install
   npm run db:migrate
   npm run db:seed
   ```

---

## 2. Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/fracadmin.git
git push -u origin main
```

---

## 3. Desplegar en Render

### A) Backend (Web Service)

| Campo | Valor |
|---|---|
| Name | `fracadmin-api` |
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Node Version | 18 |

**Variables de entorno en Render:**

```
DATABASE_URL      = (tu string de Neon, con sslmode=require)
JWT_SECRET        = (string largo y aleatorio)
ADMIN_EMAIL       = admin@fraccionamiento.com
ADMIN_PASSWORD    = (tu contraseña segura)
WHATSAPP_TOKEN    = (lo agregas después)
WHATSAPP_PHONE_ID = (lo agregas después)
WHATSAPP_VERIFY_TOKEN = fracadmin_verify_2024
ADMIN_URL         = https://fracadmin-admin.onrender.com
RESIDENT_URL      = https://fracadmin-residente.onrender.com
NODE_ENV          = production
```

### B) Frontend Admin (Static Site)

| Campo | Valor |
|---|---|
| Name | `fracadmin-admin` |
| Root Directory | `frontend/admin` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

**Variables de entorno:**
```
VITE_API_URL = https://fracadmin-api.onrender.com
```

### C) Frontend Residente (Static Site)

| Campo | Valor |
|---|---|
| Name | `fracadmin-residente` |
| Root Directory | `frontend/resident` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

**Variables de entorno:**
```
VITE_API_URL = https://fracadmin-api.onrender.com
```

---

## 4. Configurar WhatsApp Business API

1. Ve a https://developers.facebook.com y crea una app de tipo Business
2. Agrega el producto **WhatsApp**
3. En **API Setup** copia:
   - `Access Token` → `WHATSAPP_TOKEN`
   - `Phone number ID` → `WHATSAPP_PHONE_ID`
4. En **Webhooks** configura:
   - URL: `https://fracadmin-api.onrender.com/api/whatsapp/webhook`
   - Verify Token: `fracadmin_verify_2024`
5. Actualiza las variables en Render y redeploy

---

## 5. Flujo completo de uso

```
Residente llena formulario
      ↓
POST /api/payments/submit
      ↓
Admin ve pago en "Pagos → Pendientes"
      ↓
Admin revisa comprobante
      ↓
  [Aprobar]              [Rechazar]
      ↓                      ↓
Pago aplicado a BD    Sin cambios en BD
      ↓                      ↓
WhatsApp: "Aprobado"  WhatsApp: "Rechazado + motivo"
```

---

## 6. Desarrollo local

```bash
# Terminal 1 — Backend
cd backend
cp .env.example .env   # rellena DATABASE_URL y JWT_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev            # Puerto 3001

# Terminal 2 — Admin
cd frontend/admin
cp .env.example .env
npm install
npm run dev            # Puerto 5173

# Terminal 3 — Residente
cd frontend/resident
cp .env.example .env
npm install
npm run dev            # Puerto 5174
```
