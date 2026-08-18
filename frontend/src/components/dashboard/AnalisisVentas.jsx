import { useState } from 'react'
import {
  ShoppingBagIcon,
  BuildingStorefrontIcon,
  UsersIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon,
  ChartPieIcon,
  FunnelIcon,
  CubeIcon,
  MapPinIcon,
  StarIcon
} from '@heroicons/react/24/outline'

// Format currency GTQ
const formatGTQ = (value) => {
  if (!value && value !== 0) return 'Q 0'
  return 'Q ' + value.toLocaleString('es-GT')
}

// ============================================
// DATOS DE PRODUCTOS - THERMOPLÁSTICA
// ============================================
const serviciosData = [
  { id: 1, nombre: 'Termoformados Alimentarios (bandejas/contenedores)', categoria: 'Alimentaria', volumenMensual: 8500, ingresos: 1062500, margen: 45, tendencia: 'up', capacidad: 'alta' },
  { id: 2, nombre: 'Envases PET para Bebidas (500ml/2L)', categoria: 'Bebidas', volumenMensual: 6200, ingresos: 775000, margen: 42, tendencia: 'up', capacidad: 'alta' },
  { id: 3, nombre: 'Laminaciones PVC/PVDC/Aluminio', categoria: 'Logística/Seguridad', volumenMensual: 650, ingresos: 292500, margen: 52, tendencia: 'up', capacidad: 'media' },
  { id: 4, nombre: 'Envases Polietileno Soplado (PE/PP)', categoria: 'Química/Cosmética', volumenMensual: 3200, ingresos: 272000, margen: 38, tendencia: 'stable', capacidad: 'alta' },
  { id: 5, nombre: 'Envases PET para Bebidas (500ml/2L)', categoria: 'Alimentaria', volumenMensual: 4200, ingresos: 189000, margen: 35, tendencia: 'down', capacidad: 'media' },
  { id: 6, nombre: 'Blísters Termoformados Farmacéuticos', categoria: 'Logística/Seguridad', volumenMensual: 450, ingresos: 168750, margen: 48, tendencia: 'up', capacidad: 'baja' },
  { id: 7, nombre: 'Contenedores Industriales Termoformados', categoria: 'Industrial', volumenMensual: 1200, ingresos: 180000, margen: 28, tendencia: 'stable', capacidad: 'alta' },
  { id: 8, nombre: 'Tapas y Válvulas para Envases', categoria: 'Farmacéutica', volumenMensual: 1800, ingresos: 162000, margen: 40, tendencia: 'up', capacidad: 'media' },
]

const sucursalesData = [
  { id: 1, nombre: 'Planta Industrial Zona 3', region: 'Guatemala', ventas: 4200000, transacciones: 1840, ticketPromedio: 2282, clientesUnicos: 42, meta: 4000000, cumplimiento: 105 },
  { id: 2, nombre: 'Bodega Zona 12', region: 'Guatemala', ventas: 2100000, transacciones: 1320, ticketPromedio: 1591, clientesUnicos: 35, meta: 2200000, cumplimiento: 95 },
  { id: 3, nombre: 'Bodega Zona 124', region: 'Guatemala', ventas: 2800000, transacciones: 1280, ticketPromedio: 2187, clientesUnicos: 38, meta: 2600000, cumplimiento: 108 },
  { id: 4, nombre: 'Centro de Distribución Mixco', region: 'Mixco', ventas: 1900000, transacciones: 950, ticketPromedio: 2000, clientesUnicos: 28, meta: 2000000, cumplimiento: 95 },
]

const clientesData = [
  { id: 1, nombre: 'Cervecería Centroamericana', tipo: 'Alimentaria', compras: 1850000, transacciones: 45, ticketPromedio: 41111, frecuencia: 'Semanal', tendencia: 'up' },
  { id: 2, nombre: 'Cementos Progreso', tipo: 'Alimentaria', compras: 1420000, transacciones: 38, ticketPromedio: 37368, frecuencia: 'Semanal', tendencia: 'up' },
  { id: 3, nombre: 'Transportes Galgos', tipo: 'Logística', compras: 980000, transacciones: 28, ticketPromedio: 35000, frecuencia: '2x semana', tendencia: 'stable' },
  { id: 4, nombre: 'Genfar Guatemala', tipo: 'Farmacéutica', compras: 720000, transacciones: 52, ticketPromedio: 13846, frecuencia: 'Semanal', tendencia: 'up' },
  { id: 5, nombre: 'Empresas Diana', tipo: 'Química', compras: 450000, transacciones: 85, ticketPromedio: 5294, frecuencia: '2x semana', tendencia: 'up' },
  { id: 6, nombre: 'Lácteos del Sur', tipo: 'Alimentaria', compras: 380000, transacciones: 18, ticketPromedio: 21111, frecuencia: 'Semanal', tendencia: 'stable' },
  { id: 7, nombre: 'Agua Pura Vida', tipo: 'Farmacéutica', compras: 290000, transacciones: 42, ticketPromedio: 6905, frecuencia: 'Semanal', tendencia: 'down' },
  { id: 8, nombre: 'Helados Sarita', tipo: 'Logística', compras: 195000, transacciones: 25, ticketPromedio: 7800, frecuencia: '2x semana', tendencia: 'up' },
]

const insightsData = [
  {
    tipo: 'oportunidad',
    titulo: 'Termoformados Alimentarios lideran con 44% margen',
    descripcion: 'El producto a industria alimentaria genera Q1.06M mensuales. Negociar contratos anuales con cervecería para mejorar margen al 48%.',
    icono: TrophyIcon
  },
  {
    tipo: 'alerta',
    titulo: 'Capacidad media en Envases PE Soplado',
    descripcion: 'Bodega Zona 120 opera al 85% de capacidad en envases polietileno. Considerar invertir en extrusoras adicionales adicionales.',
    icono: CubeIcon
  },
  {
    tipo: 'insight',
    titulo: 'Bodega Zona 124 supera meta en 8%',
    descripcion: 'Aunque es la 3ra en volumen, tiene el mejor cumplimiento (108%). Replicar estrategia de proceso de termoformado en otras sucursales.',
    icono: MapPinIcon
  },
  {
    tipo: 'alerta',
    titulo: 'Cliente "Agua Pura Vida" en tendencia negativa',
    descripcion: 'Ventas bajaron 15% vs mes anterior. Contactar para evaluar satisfacción y ofrecer contrato de exclusividad.',
    icono: UsersIcon
  }
]

export default function AnalisisVentas() {
  const [activeTab, setActiveTab] = useState('servicios')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroRegion, setFiltroRegion] = useState('todas')
  const [filtroTipoCliente, setFiltroTipoCliente] = useState('todos')

  // Calcular totales
  const totalIngresosServicios = serviciosData.reduce((sum, s) => sum + s.ingresos, 0)
  const totalVentasSucursales = sucursalesData.reduce((sum, s) => sum + s.ventas, 0)
  const totalComprasClientes = clientesData.reduce((sum, c) => sum + c.compras, 0)
  const ticketPromedioGlobal = Math.round(totalVentasSucursales / sucursalesData.reduce((sum, s) => sum + s.transacciones, 0))

  // Filtrar datos
  const serviciosFiltrados = filtroCategoria === 'todas' 
    ? serviciosData 
    : serviciosData.filter(s => s.categoria === filtroCategoria)
  
  const sucursalesFiltradas = filtroRegion === 'todas'
    ? sucursalesData
    : sucursalesData.filter(s => s.region === filtroRegion)
    
  const clientesFiltrados = filtroTipoCliente === 'todos'
    ? clientesData
    : clientesData.filter(c => c.tipo === filtroTipoCliente)

  // Ordenar por ingresos/ventas
  const serviciosOrdenados = [...serviciosFiltrados].sort((a, b) => b.ingresos - a.ingresos)
  const sucursalesOrdenadas = [...sucursalesFiltradas].sort((a, b) => b.ventas - a.ventas)
  const clientesOrdenados = [...clientesFiltrados].sort((a, b) => b.compras - a.compras)

  const getInsightStyles = (tipo) => {
    switch (tipo) {
      case 'oportunidad': return 'border-l-[var(--success)] bg-[var(--success-bg)]'
      case 'alerta': return 'border-l-[var(--warning)] bg-[var(--warning-bg)]'
      case 'insight': return 'border-l-[var(--accent-blue)] bg-[var(--info-bg)]'
      default: return 'border-l-[var(--accent-blue)] bg-[var(--info-bg)]'
    }
  }

  const tabs = [
    { id: 'servicios', label: 'Servicios', icon: ShoppingBagIcon },
    { id: 'sucursales', label: 'Sucursales', icon: BuildingStorefrontIcon },
    { id: 'clientes', label: 'Clientes', icon: UsersIcon },
  ]

  return (
    <div className="space-y-6">
      {/* Header con KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Ingresos Servicios</span>
            <ShoppingBagIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value">{formatGTQ(totalIngresosServicios)}</div>
          <span className="text-xs text-[var(--text-muted)]">{serviciosData.length} líneas de servicio</span>
        </div>
        
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Ventas por Sucursal</span>
            <BuildingStorefrontIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value">{formatGTQ(totalVentasSucursales)}</div>
          <span className="text-xs text-[var(--text-muted)]">{sucursalesData.length} sucursales</span>
        </div>
        
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Ticket Promedio</span>
            <ChartPieIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value">{formatGTQ(ticketPromedioGlobal)}</div>
          <span className="text-xs text-[var(--success)]">↑ 8.3% vs mes ant.</span>
        </div>
        
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Top Cliente</span>
            <StarIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value text-lg">{formatGTQ(clientesData[0].compras)}</div>
          <span className="text-xs text-[var(--text-muted)]">{clientesData[0].nombre.slice(0, 20)}...</span>
        </div>
      </div>

      {/* Insights automáticos */}
      <div className="card">
        <div className="section-header">
          <SparklesIcon className="w-5 h-5 text-[var(--accent-blue)]" />
          <h2 className="font-semibold">Insights de Servicios</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-5 pt-0">
          {insightsData.map((insight, idx) => {
            const Icon = insight.icono
            return (
              <div
                key={idx}
                className={`p-4 rounded-lg border-l-4 ${getInsightStyles(insight.tipo)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-[var(--text-primary)] text-sm">{insight.titulo}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{insight.descripcion}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] rounded-lg">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>
          
          {/* Filtros */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-4 h-4 text-[var(--text-muted)]" />
            {activeTab === 'servicios' && (
              <select 
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="input text-xs py-1.5 w-auto"
              >
                <option value="todas">Todas las categorías</option>
                <option value="Alimentaria">Alimentaria</option>
                <option value="Bebidas">Bebidas</option>
                <option value="Química/Cosmética">Química/Cosmética</option>
                <option value="Farmacéutica">Farmacéutica</option>
                <option value="Logística/Seguridad">Logística/Seguridad</option>
                <option value="Industrial">Industrial</option>
              </select>
            )}
            {activeTab === 'sucursales' && (
              <select 
                value={filtroRegion}
                onChange={(e) => setFiltroRegion(e.target.value)}
                className="input text-xs py-1.5 w-auto"
              >
                <option value="todas">Todas las regiones</option>
                <option value="Guatemala">Guatemala</option>
                <option value="Mixco">Mixco</option>
              </select>
            )}
            {activeTab === 'clientes' && (
              <select 
                value={filtroTipoCliente}
                onChange={(e) => setFiltroTipoCliente(e.target.value)}
                className="input text-xs py-1.5 w-auto"
              >
                <option value="todos">Todos los tipos</option>
                <option value="Alimentaria">Alimentaria</option>
                <option value="Logística">Logística</option>
                <option value="Farmacéutica">Farmacéutica</option>
                <option value="Química">Química</option>
              </select>
            )}
          </div>
        </div>

        {/* Contenido de Servicios */}
        {activeTab === 'servicios' && (
          <div className="p-5 space-y-4">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>Servicio</th>
                    <th>Categoría</th>
                    <th className="text-right">Volumen (kg/unid)</th>
                    <th className="text-right">Ingresos</th>
                    <th className="text-right">Margen</th>
                    <th className="text-center">Tendencia</th>
                    <th className="text-center">Capacidad</th>
                  </tr>
                </thead>
                <tbody>
                  {serviciosOrdenados.map((servicio, idx) => (
                    <tr key={servicio.id} className="group">
                      <td>
                        {idx < 3 ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                            idx === 1 ? 'bg-gray-100 text-gray-600' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {idx + 1}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)] ml-2">{idx + 1}</span>
                        )}
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-sm">{servicio.nombre}</p>
                          <div className="mt-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden w-32">
                            <div 
                              className="h-full bg-[#001639] rounded-full transition-all"
                              style={{ width: `${(servicio.ingresos / serviciosOrdenados[0].ingresos) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge-neutral text-[10px]">{servicio.categoria}</span>
                      </td>
                      <td className="text-right font-mono text-sm">{servicio.volumenMensual.toLocaleString()}</td>
                      <td className="text-right font-mono font-medium">{formatGTQ(servicio.ingresos)}</td>
                      <td className="text-right">
                        <span className={`font-mono text-sm ${servicio.margen >= 40 ? 'text-[var(--success)]' : servicio.margen >= 30 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}`}>
                          {servicio.margen}%
                        </span>
                      </td>
                      <td className="text-center">
                        {servicio.tendencia === 'up' ? (
                          <ArrowTrendingUpIcon className="w-4 h-4 text-[var(--success)] mx-auto" />
                        ) : servicio.tendencia === 'down' ? (
                          <ArrowTrendingDownIcon className="w-4 h-4 text-[var(--danger)] mx-auto" />
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">→</span>
                        )}
                      </td>
                      <td className="text-center">
                        <span className={`badge text-[10px] ${
                          servicio.capacidad === 'alta' ? 'badge-success' :
                          servicio.capacidad === 'media' ? 'badge-warning' :
                          'badge-danger'
                        }`}>
                          {servicio.capacidad === 'alta' ? 'Alta' : servicio.capacidad === 'media' ? 'Media' : 'Baja'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Resumen por categoría */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {['Alimentaria', 'Bebidas', 'Química/Cosmética', 'Logística/Seguridad'].map(cat => {
                const serviciosCat = serviciosData.filter(s => s.categoria === cat)
                const totalCat = serviciosCat.reduce((sum, s) => sum + s.ingresos, 0)
                const margenPromedio = serviciosCat.length > 0 
                  ? Math.round(serviciosCat.reduce((sum, s) => sum + s.margen, 0) / serviciosCat.length)
                  : 0
                return (
                  <div key={cat} className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                    <p className="text-xs text-[var(--text-muted)] uppercase font-medium">{cat}</p>
                    <p className="text-lg font-bold mt-1">{formatGTQ(totalCat)}</p>
                    <p className="text-xs text-[var(--text-muted)]">Margen promedio: {margenPromedio}%</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Contenido de Sucursales */}
        {activeTab === 'sucursales' && (
          <div className="p-5 space-y-4">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>Sucursal</th>
                    <th>Región</th>
                    <th className="text-right">Ventas</th>
                    <th className="text-right">Trans.</th>
                    <th className="text-right">Ticket Prom.</th>
                    <th className="text-right">Clientes</th>
                    <th className="text-center">Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {sucursalesOrdenadas.map((sucursal, idx) => (
                    <tr key={sucursal.id}>
                      <td>
                        <span className="text-xs text-[var(--text-muted)] ml-2">{idx + 1}</span>
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-sm">{sucursal.nombre}</p>
                          <div className="mt-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden w-32">
                            <div 
                              className="h-full bg-[#001639] rounded-full"
                              style={{ width: `${(sucursal.ventas / sucursalesOrdenadas[0].ventas) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge-neutral text-[10px]">{sucursal.region}</span>
                      </td>
                      <td className="text-right font-mono font-medium">{formatGTQ(sucursal.ventas)}</td>
                      <td className="text-right font-mono text-sm">{sucursal.transacciones}</td>
                      <td className="text-right font-mono text-sm">{formatGTQ(sucursal.ticketPromedio)}</td>
                      <td className="text-right font-mono text-sm">{sucursal.clientesUnicos}</td>
                      <td className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs font-medium ${sucursal.cumplimiento >= 100 ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                            {sucursal.cumplimiento}%
                          </span>
                          <div className="w-12 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${sucursal.cumplimiento >= 100 ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`}
                              style={{ width: `${Math.min(100, sucursal.cumplimiento)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Comparativa de sucursales */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                <p className="text-xs text-[var(--text-muted)] uppercase font-medium">Mejor Ticket Promedio</p>
                <p className="text-lg font-bold mt-1">{formatGTQ(Math.max(...sucursalesData.map(s => s.ticketPromedio)))}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {sucursalesData.find(s => s.ticketPromedio === Math.max(...sucursalesData.map(s => s.ticketPromedio)))?.nombre}
                </p>
              </div>
              <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                <p className="text-xs text-[var(--text-muted)] uppercase font-medium">Mayor Cumplimiento</p>
                <p className="text-lg font-bold mt-1">{Math.max(...sucursalesData.map(s => s.cumplimiento))}%</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {sucursalesData.find(s => s.cumplimiento === Math.max(...sucursalesData.map(s => s.cumplimiento)))?.nombre}
                </p>
              </div>
              <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                <p className="text-xs text-[var(--text-muted)] uppercase font-medium">Más Clientes Únicos</p>
                <p className="text-lg font-bold mt-1">{Math.max(...sucursalesData.map(s => s.clientesUnicos))}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {sucursalesData.find(s => s.clientesUnicos === Math.max(...sucursalesData.map(s => s.clientesUnicos)))?.nombre}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contenido de Clientes */}
        {activeTab === 'clientes' && (
          <div className="p-5 space-y-4">
            {/* Concentración de clientes - Pareto */}
            <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
              <h3 className="text-sm font-semibold mb-3">Concentración de Ingresos (Regla 80/20)</h3>
              <div className="space-y-2">
                {clientesOrdenados.map((cliente, idx) => {
                  const porcentaje = (cliente.compras / totalComprasClientes * 100).toFixed(1)
                  const acumulado = clientesOrdenados
                    .slice(0, idx + 1)
                    .reduce((sum, c) => sum + c.compras, 0) / totalComprasClientes * 100
                  return (
                    <div key={cliente.id} className="flex items-center gap-3">
                      <span className="w-6 text-xs text-[var(--text-muted)] text-right">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm truncate">{cliente.nombre}</span>
                          <span className="text-xs font-mono">{porcentaje}%</span>
                        </div>
                        <div className="h-2 bg-white rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${porcentaje * 3}%`,
                              backgroundColor: idx < 2 ? 'var(--danger)' : idx < 4 ? 'var(--warning)' : 'var(--success)'
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-mono text-[var(--text-muted)] w-12 text-right">
                        {acumulado.toFixed(0)}%
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-[var(--danger)]"></div>
                  <span>Alto riesgo {'>'}15%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-[var(--warning)]"></div>
                  <span>Medio riesgo 8-15%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-[var(--success)]"></div>
                  <span>Bajo riesgo {'<'}8%</span>
                </div>
              </div>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th className="text-right">Servicios</th>
                    <th className="text-right">Trans.</th>
                    <th className="text-right">Ticket Prom.</th>
                    <th className="text-center">Frecuencia</th>
                    <th className="text-center">Tendencia</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesOrdenados.map((cliente, idx) => (
                    <tr key={cliente.id}>
                      <td>
                        {idx < 3 ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                            idx === 1 ? 'bg-gray-100 text-gray-600' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {idx + 1}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)] ml-2">{idx + 1}</span>
                        )}
                      </td>
                      <td>
                        <p className="font-medium text-sm">{cliente.nombre}</p>
                      </td>
                      <td>
                        <span className={`badge text-[10px] ${
                          cliente.tipo === 'Alimentaria' ? 'badge-info' :
                          cliente.tipo === 'Logística' ? 'badge-success' :
                          cliente.tipo === 'Farmacéutica' ? 'badge-warning' :
                          'badge-neutral'
                        }`}>
                          {cliente.tipo}
                        </span>
                      </td>
                      <td className="text-right font-mono font-medium">{formatGTQ(cliente.compras)}</td>
                      <td className="text-right font-mono text-sm">{cliente.transacciones}</td>
                      <td className="text-right font-mono text-sm">{formatGTQ(cliente.ticketPromedio)}</td>
                      <td className="text-center">
                        <span className="text-xs text-[var(--text-muted)]">{cliente.frecuencia}</span>
                      </td>
                      <td className="text-center">
                        {cliente.tendencia === 'up' ? (
                          <span className="badge-success text-[10px]">↑ Creciendo</span>
                        ) : cliente.tendencia === 'down' ? (
                          <span className="badge-danger text-[10px]">↓ Baja</span>
                        ) : (
                          <span className="badge-neutral text-[10px]">→ Estable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
