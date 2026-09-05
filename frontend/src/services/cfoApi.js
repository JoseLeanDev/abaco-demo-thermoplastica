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
  dashboard: () => cfoApi.get('/dashboard'),
  tesoreria: {
    proyeccion: (semanas = 13) => cfoApi.get('/tesoreria/proyeccion', { params: { semanas } }),
    posicion: () => cfoApi.get('/tesoreria/posicion'),
    cxc: () => cfoApi.get('/tesoreria/cxc'),
    cxcDetalle: (params = {}) => cfoApi.get('/tesoreria/cxc/detalle', { params }),
    cxp: () => cfoApi.get('/tesoreria/cxp')
  },
  compras: {
    resumen: (params = {}) => cfoApi.get('/compras', { params }),
    categorias: (params = {}) => cfoApi.get('/compras/categorias', { params }),
    proveedores: (params = {}) => cfoApi.get('/compras/proveedores', { params }),
    detalle: (params = {}) => cfoApi.get('/compras/detalle', { params })
  },
  gastos: {
    resumen: (params = {}) => cfoApi.get('/gastos', { params }),
    centrosCosto: (params = {}) => cfoApi.get('/gastos/centros-costo', { params }),
    proveedores: (params = {}) => cfoApi.get('/gastos/proveedores', { params }),
    detalle: (params = {}) => cfoApi.get('/gastos/detalle', { params })
  },
  contabilidad: {
    libroDiario: (params) => cfoApi.get('/contabilidad/libro_diario', { params }),
    conciliacion: (banco) => cfoApi.get('/contabilidad/conciliacion', { params: { banco } }),
    iniciarCierre: (mes) => cfoApi.post('/contabilidad/cierre/iniciar', { mes }),
    estadoCierre: (cierreId) => cfoApi.get('/contabilidad/cierre/estado', { params: { cierre_id: cierreId } })
  },
  analisis: {
    rentabilidad: (dimension) => cfoApi.get('/analisis/rentabilidad', { params: { dimension } }),
    presupuesto: (periodo) => cfoApi.get('/analisis/presupuesto', { params: { periodo } }),
    ratios: () => cfoApi.get('/analisis/ratios'),
    tendencias: (metrica) => cfoApi.get('/analisis/tendencias', { params: { metrica } }),
    insights: (context = 'all') => cfoApi.get('/analisis/insights', { params: { context } }),
    insightsHistorico: (params) => cfoApi.get('/analisis/insights/historico', { params }),
    dismissInsight: (id) => cfoApi.patch(`/analisis/insights/${id}/dismiss`, {}),
    workingCapital: (params = {}) => cfoApi.get('/analisis/working-capital', { params })
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
    status: () => cfoApi.get('/agents/status'),
    history: () => cfoApi.get('/agents/history'),
    clear: () => cfoApi.post('/agents/clear'),
    logs: (params) => cfoApi.get('/agents/logs', { params }),
    createLog: (data) => cfoApi.post('/agents/logs', data)
  },
  // Márgenes
  margenes: {
    resumen: () => cfoApi.get('/margenes'),
    detalleProducto: (id) => cfoApi.get(`/margenes/producto/${id}/detalle`),
    vendedores: () => cfoApi.get('/margenes/vendedores'),
    clientes: () => cfoApi.get('/margenes/clientes'),
    lineas: () => cfoApi.get('/margenes/lineas'),
  }
}

// Helper para chat de agentes
export const chatWithAgents = (message) => endpoints.agents.chat(message)

export default cfoApi
