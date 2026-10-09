import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const cfoApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Version': '1.0.0'
  },
  timeout: 30000
})

// Request interceptor
cfoApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('cfo_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor
cfoApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cfo_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Endpoints específicos
export const endpoints = {
  dashboard: (params = {}) => cfoApi.get('/dashboard', { params }),
  tesoreria: {
    proyeccion: (semanas = 13) => cfoApi.get('/tesoreria/proyeccion', { params: { semanas } }),
    posicion: (params = {}) => cfoApi.get('/tesoreria/posicion', { params }),
    cxc: (params = {}) => cfoApi.get('/tesoreria/cxc', { params }),
    cxcDetalle: (params = {}) => cfoApi.get('/tesoreria/cxc/detalle', { params }),
    cxcClientes: (params = {}) => cfoApi.get('/tesoreria/cxc/clientes', { params }),
    cxcCliente: (id, params = {}) => cfoApi.get(`/tesoreria/cxc/cliente/${id}`, { params }),
    cxp: (params = {}) => cfoApi.get('/tesoreria/cxp', { params }),
    cxpDetalle: (params = {}) => cfoApi.get('/tesoreria/cxp/detalle', { params })
  },
  compras: {
    resumen: (params = {}) => cfoApi.get('/compras', { params }),
    categorias: (params = {}) => cfoApi.get('/compras/categorias', { params }),
    proveedores: (params = {}) => cfoApi.get('/compras/proveedores', { params }),
    detalle: (params = {}) => cfoApi.get('/compras/detalle', { params }),
    recomendaciones: (params = {}) => cfoApi.get('/compras/recomendaciones', { params })
  },
  gastos: {
    resumen: (params = {}) => cfoApi.get('/gastos', { params }),
    centrosCosto: (params = {}) => cfoApi.get('/gastos/centros-costo', { params }),
    proveedores: (params = {}) => cfoApi.get('/gastos/proveedores', { params }),
    detalle: (params = {}) => cfoApi.get('/gastos/detalle', { params })
  },
  inventario: {
    resumen: (params = {}) => cfoApi.get('/inventario', { params }),
    detalle: (params = {}) => cfoApi.get('/inventario/detalle', { params }),
  },
  ventas: {
    resumen: (params = {}) => cfoApi.get('/ventas', { params }),
    clientes: (params = {}) => cfoApi.get('/ventas/clientes', { params }),
    vendedores: (params = {}) => cfoApi.get('/ventas/vendedores', { params }),
    articulos: (params = {}) => cfoApi.get('/ventas/articulos', { params }),
    lineas: (params = {}) => cfoApi.get('/ventas/lineas', { params }),
    serieVendedores: (params = {}) => cfoApi.get('/ventas/serie-vendedores', { params }),
    serieLineas: (params = {}) => cfoApi.get('/ventas/serie-lineas', { params }),
    detalle: (params = {}) => cfoApi.get('/ventas/detalle', { params }),
    desglose: (params = {}) => cfoApi.get('/ventas/desglose', { params }),
    desgloseSerie: (params = {}) => cfoApi.get('/ventas/desglose-serie', { params }),
    matriz: (params = {}) => cfoApi.get('/ventas/matriz', { params }),
  },
  contabilidad: {
    libroDiario: (params) => cfoApi.get('/contabilidad/libro_diario', { params }),
    conciliacion: (banco) => cfoApi.get('/contabilidad/conciliacion', { params: { banco } }),
    iniciarCierre: (mes) => cfoApi.post('/contabilidad/cierre/iniciar', { mes }),
    estadoCierre: (cierreId) => cfoApi.get('/contabilidad/cierre/estado', { params: { cierre_id: cierreId } })
  },
  analisis: {
    insights: (context = 'all') => cfoApi.get('/analisis/insights', { params: { context } }),
    insightsHistorico: (params) => cfoApi.get('/analisis/insights/historico', { params }),
    dismissInsight: (id) => cfoApi.patch(`/analisis/insights/${id}/dismiss`, {}),
    salud: (params = {}) => cfoApi.get('/analisis/salud', { params }),
    inventarioQuieto: (params = {}) => cfoApi.get('/analisis/inventario-quieto', { params }),
    rotacionInventario: (params = {}) => cfoApi.get('/analisis/rotacion-inventario', { params }),
    proyeccionVentas: (meses = 6) => cfoApi.get('/analisis/proyeccion-ventas', { params: { meses } }),
    flujoCaja: (semanas = 13) => cfoApi.get('/analisis/flujo-caja', { params: { semanas } })
  },
  sat: {
    calendario: () => cfoApi.get('/sat/calendario'),
    calculoIva: (mes) => cfoApi.get('/sat/calculo/iva', { params: { mes } }),
    calculoIsr: (tipo, periodo) => cfoApi.get('/sat/calculo/isr', { params: { tipo, periodo } }),
    dteValidacion: () => cfoApi.get('/sat/dte/validacion'),
    prepararDeclaracion: (obligacion) => cfoApi.post('/sat/declaracion/preparar', { obligacion })
  },
  alertas: () => cfoApi.get('/alertas'),
  // Multi-Agent System
  agents: {
    chat: (message) => cfoApi.post('/agents/chat', { message }),
    // El agente SQL da varias vueltas al modelo: 10-25s es normal, por eso
    // lleva su propio timeout en vez del de 30s del cliente general.
    chatAgente: (message, historial = [], periodo = {}) =>
      cfoApi.post('/agents/chat-agente', { message, historial, ...periodo }, { timeout: 120000 }),
    saludAgente: () => cfoApi.get('/agents/chat-agente/salud'),
    status: () => cfoApi.get('/agents/status'),
    history: () => cfoApi.get('/agents/history'),
    clear: () => cfoApi.post('/agents/clear'),
    logs: (params) => cfoApi.get('/agents/logs', { params }),
    createLog: (data) => cfoApi.post('/agents/logs', data)
  },
  // Márgenes
  margenes: {
    resumen: (params = {}) => cfoApi.get('/margenes', { params }),
    detalleProducto: (id, params = {}) => cfoApi.get(`/margenes/producto/${id}/detalle`, { params }),
    vendedores: (params = {}) => cfoApi.get('/margenes/vendedores', { params }),
    clientes: (params = {}) => cfoApi.get('/margenes/clientes', { params }),
    lineas: (params = {}) => cfoApi.get('/margenes/lineas', { params }),
  }
}

// Helper para chat de agentes
export const chatWithAgents = (message) => endpoints.agents.chat(message)
export const chatConAgenteSQL = (message, historial, periodo) => endpoints.agents.chatAgente(message, historial, periodo)
export const saludAgenteSQL = () => endpoints.agents.saludAgente()

export default cfoApi
