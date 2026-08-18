# 🚀 PASO A PASO - Deploy Demo Thermoplástica

## 1. CREAR REPOSITORIO EN GITHUB (1 minuto)

### Opción A: Desde GitHub web
1. Ve a https://github.com/new
2. **Nombre:** `abaco-demo-thermoplastica`
3. **Descripción:** `Demo de abaco para Thermoplástica, S.A. - B2B/B2C con sucursales`
4. **Público** o **Privado** (como prefieras)
5. NO inicializar con README (ya lo tenemos)
6. Click **Create repository**

### Opción B: Con GitHub CLI (si lo tienes instalado)
```bash
gh repo create abaco-demo-thermoplastica --public --source=. --push
```

---

## 2. SUBIR CÓDIGO A GITHUB (2 minutos)

Después de crear el repo vacío, ejecuta estos comandos:

```bash
# Ir a la carpeta del proyecto
cd abaco-demo-thermoplastica

# Renombrar la rama a main (opcional, pero recomendado)
git branch -m main

# Agregar el remote de GitHub
# Reemplazá TU_USUARIO con tu usuario de GitHub
git remote add origin https://github.com/TU_USUARIO/abaco-demo-thermoplastica.git

# Subir el código
git push -u origin main
```

---

## 3. CREAR BASE DE DATOS EN RENDER (2 minutos)

1. Ve a https://dashboard.render.com
2. Click **New** → **PostgreSQL**
3. **Name:** `abaco-demo-thermoplastica-db`
4. **Region:** Ohio (o la que prefieras)
5. **Plan:** Free (o el que prefieras)
6. Click **Create Database**
7. **IMPORTANTE:** Copiar la **Internal Database URL** (se verá algo como:
   `postgresql://abaco_demo_thermoplastica_user:PASSWORD@dpg-XXXX.ohio-postgres.render.com/abaco_demo_thermoplastica_db`)

---

## 4. CREAR SERVICIO WEB EN RENDER (3 minutos)

1. En https://dashboard.render.com, click **New** → **Web Service**
2. Conecta tu repositorio de GitHub: `abaco-demo-thermoplastica`
3. **Name:** `abaco-demo-thermoplastica`
4. **Runtime:** Node
5. **Region:** Ohio (misma que la DB)
6. **Branch:** main
7. **Build Command:** `cd backend && npm install && npm run migrate && npm run seed && cd ../frontend && npm install && npm run build`
8. **Start Command:** `cd backend && npm start`
9. **Plan:** Free (o el que prefieras)
10. Click **Advanced** → **Add Environment Variable**:

### Variables de Entorno OBLIGATORIAS:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `DATABASE_URL` | *(pegar la URL de PostgreSQL del paso 3)* | Conexión a PostgreSQL |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` | Tu API key de OpenRouter |
| `JWT_SECRET` | *(generar un string largo)* | Secreto para autenticación |
| `NODE_ENV` | `production` | Modo producción |
| `PORT` | `10000` | Puerto de Render |
| `APP_URL` | `https://abaco-demo-thermoplastica.onrender.com` | URL del servicio |
| `DEFAULT_EMPRESA_ID` | `1` | ID empresa demo |
| `DEFAULT_USUARIO_ID` | `1` | ID usuario demo |
| `MONEDA_DEFAULT` | `GTQ` | Moneda quetzal |
| `TZ` | `America/Guatemala` | Timezone |

### Variables OPCIONALES (para alertas):

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `UMBRAL_LIQUIDEZ_CRITICO` | `100000` | Umbral liquidez crítico |
| `UMBRAL_LIQUIDEZ_ADVERTENCIA` | `500000` | Umbral advertencia |
| `GASTO_DIARIO_DEFAULT` | `35000` | Gasto diario estimado |
| `UMBRAL_CXC_CRITICO` | `500000` | Umbral CxC crítico |
| `CXC_DIAS_ATRASO_CRITICO` | `60` | Días atraso crítico |
| `CONCENTRACION_CLIENTE_CRITICO` | `0.20` | Concentración crítica |

11. Click **Create Web Service**

---

## 5. CREAR WORKER (Scheduler) EN RENDER (1 minuto)

1. Click **New** → **Background Worker**
2. Conecta el mismo repo: `abaco-demo-thermoplastica`
3. **Name:** `abaco-demo-thermoplastica-scheduler`
4. **Runtime:** Node
5. **Region:** Ohio (misma que el web service)
6. **Build Command:** `cd backend && npm install`
7. **Start Command:** `cd backend && node src/scheduler/run.js`
8. **Plan:** Free (o el que prefieras)
9. Agregar las mismas variables de entorno que el Web Service
10. Click **Create Background Worker**

---

## 6. VERIFICAR DEPLOY (5 minutos)

1. El deploy puede tardar 3-5 minutos
2. Render mostrará los logs en tiempo real
3. Una vez que diga "Your service is live", visita:
   - `https://abaco-demo-thermoplastica.onrender.com`

### Si hay errores:
- Revisar los logs en Render (pestaña "Logs")
- Verificar que `DATABASE_URL` esté correcto
- Verificar que `OPENROUTER_API_KEY` sea válida

---

## 7. PROBAR LA APP (2 minutos)

1. Abre la URL del servicio
2. Login con credenciales por defecto:
   - **Usuario:** `admin`
   - **Password:** `admin123`
3. Verificar que aparezca:
   - **Thermoplástica, S.A., S.A.** en el dashboard
   - **Datos de B2B y B2C** en cuentas por cobrar
   - **4 sucursales** en el contexto

---

## 📋 CHECKLIST DE VERIFICACIÓN

- [ ] Repositorio creado en GitHub
- [ ] Código subido (commit inicial visible)
- [ ] PostgreSQL creada en Render
- [ ] DATABASE_URL copiada correctamente
- [ ] Web Service creado en Render
- [ ] Variables de entorno configuradas
- [ ] Worker (scheduler) creado
- [ ] Deploy exitoso (URL accesible)
- [ ] Login funciona (admin/admin123)
- [ ] Dashboard muestra "Thermoplástica, S.A."
- [ ] Datos de clientes B2B/B2C visibles

---

## ⚠️ IMPORTANTE

- **NO subir el archivo `.env` real a GitHub** (ya está en .gitignore)
- **NO usar la base de datos del proyecto original** (cada demo tiene su propia DB)
- **OpenRouter API key:** Si no tienes, créala en https://openrouter.ai/keys
- **JWT_SECRET:** Generar con `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## 🆘 PROBLEMAS COMUNES

### Error "Database does not exist"
→ Verificar que `DATABASE_URL` esté correcto. Asegurarse de usar la **Internal Database URL**.

### Error " relation 'empresas' does not exist"
→ El `npm run migrate` no se ejecutó. En Render, ir a "Shell" y ejecutar manualmente:
```bash
cd backend && npm run migrate && npm run seed
```

### Error 500 en el backend
→ Revisar logs de Render. Probablemente falta `OPENROUTER_API_KEY` o `JWT_SECRET`.

---

## 📞 ¿Necesitás ayuda?

Envíame el mensaje de error exacto y revisamos juntos.
