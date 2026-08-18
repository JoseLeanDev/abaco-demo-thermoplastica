# 🚀 abaco Demo - Thermoplástica, S.A.

Demo de la plataforma abaco configurado para Thermoplástica, S.A., empresa de empaque y envase industrial con más de 53 años de experiencia.

## Requisitos Previos

- Node.js v18+ 
- npm o yarn

---

## ⚡ Instalación Rápida (3 pasos)

### 1. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend (en otra terminal)
cd frontend
npm install
```

### 2. Configurar base de datos

```bash
# En la carpeta backend
npm run migrate
npm run seed
```

### 3. Iniciar servidores

```bash
# Backend (puerto 3000)
npm run dev

# Frontend (puerto 3001)
npm run dev
```

---

## 🌐 Acceder a la aplicación

- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3000/api
- **Health Check:** http://localhost:3000/api/health

---

## 📁 Estructura del Proyecto

```
├── backend/
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── index.js         # Entry point
│   │   └── ...
│   ├── database/
│   │   ├── connection.js    # PostgreSQL/SQLite config
│   │   ├── migrate.js       # Crear tablas
│   │   └── seed.js          # Datos demo (Thermoplástica)
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/      # React components
    │   ├── pages/           # Page components
    │   ├── hooks/           # Custom hooks
    │   ├── services/        # API client
    │   └── ...
    └── package.json
```

---

## 🛠️ Comandos Útiles

### Backend
```bash
npm run dev         # Desarrollo con hot-reload
npm start           # Producción
npm run migrate     # Crear tablas
npm run seed        # Insertar datos demo
```

### Frontend
```bash
npm run dev         # Servidor de desarrollo
npm run build       # Build para producción
npm run preview     # Previsualizar build
```

---

## 🎨 Características del Diseño

- ✅ Glassmorphism en cards
- ✅ Gradientes modernos
- ✅ Animaciones fluidas (60fps)
- ✅ Micro-interacciones
- ✅ Tipografía premium (Inter)
- ✅ Colores semánticos suaves
- ✅ Layout responsive
- ✅ Iconografía consistente

---

## 📊 Datos Demo Incluidos (Thermoplástica)

La base de datos incluye:
- 1 empresa: Thermoplástica, S.A.
- 4 sucursales (central + 3 sucursales)
- 3 cuentas bancarias (GTQ/USD)
- 45 cuentas por cobrar (B2B y B2C)
- 35 cuentas por pagar
- ~500 transacciones (6 meses)
- 14 obligaciones SAT
- 12 logs de agentes IA

---

## 🔧 Solución de Problemas

### Error: Puerto ocupado
```bash
# Cambiar puerto del backend
PORT=3002 npm run dev

# Cambiar puerto del frontend
# Editar vite.config.js
```

### Limpiar base de datos
```bash
# PostgreSQL: crear nueva base
# SQLite: rm database/cfo_ai.db
npm run migrate
npm run seed
```

---

## 📞 Soporte

¿Problemas? Verifica:
1. Node.js >= 18 (`node --version`)
2. Puertos 3000 y 3001 disponibles
3. Dependencias instaladas (`npm list`)

---

*abaco - Demo Thermoplástica, S.A.*
