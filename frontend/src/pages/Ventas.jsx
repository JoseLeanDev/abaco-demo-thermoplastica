import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, LineChart, Line
} from 'recharts'
import {
  ShoppingBagIcon,
  UsersIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon,
  ChartBarIcon,
  BuildingStorefrontIcon,
  StarIcon,
  ChevronRightIcon,
  FunnelIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

const formatGTQ = (value) => {
  if (!value && value !== 0) return 'Q 0'
  return 'Q ' + value.toLocaleString('es-GT')
}

// ========== DATOS REALISTAS THERMOPLÁSTICA ==========

const ventasMensuales = [
  { mes: 'Ene', ventas: 4200000, meta: 4000000, costos: 2940000 },
  { mes: 'Feb', ventas: 3850000, meta: 4000000, costos: 2733500 },
  { mes: 'Mar', ventas: 4500000, meta: 4200000, costos: 3150000 },
  { mes: 'Abr', ventas: 5100000, meta: 4500000, costos: 3570000 },
  { mes: 'May', ventas: 4800000, meta: 4600000, costos: 3360000 },
  { mes: 'Jun', ventas: 5200000, meta: 4800000, costos: 3536000 },
  { mes: 'Jul', ventas: 5358000, meta: 5000000, costos: 3643000 },
]

const ventasPorLinea = [
  { id: 1, nombre: 'Termoformados Alimentarios', categoria: 'Alimentaria', ventas: 1062500, meta: 1000000, margen: 45, unidades: 8500, tendencia: 'up' },
  { id: 2, nombre: 'Envases PET Bebidas', categoria: 'Bebidas', ventas: 775000, meta: 800000, margen: 42, unidades: 6200, tendencia: 'stable' },
  { id: 3, nombre: 'Laminaciones PVC/Aluminio', categoria: 'Logística', ventas: 292500, meta: 280000, margen: 52, unidades: 650, tendencia: 'up' },
  { id: 4, nombre: 'Polietileno Soplado', categoria: 'Química', ventas: 272000, meta: 300000, margen: 38, unidades: 3200, tendencia: 'down' },
  { id: 5, nombre: 'Blíster Farmacéutico', categoria: 'Farmacéutica', ventas: 168750, meta: 150000, margen: 48, unidades: 450, tendencia: 'up' },
  { id: 6, nombre: 'Industrial Termoformado', categoria: 'Industrial', ventas: 180000, meta: 200000, margen: 28, unidades: 1200, tendencia: 'stable' },
  { id: 7, nombre: 'Tapas y Válvulas', categoria: 'Farmacéutica', ventas: 162000, meta: 160000, margen: 40, unidades: 1800, tendencia: 'up' },
  { id: 8, nombre: 'Envases PET Alimentaria', categoria: 'Alimentaria', ventas: 189000, meta: 180000, margen: 35, unidades: 4200, tendencia: 'down' },
]

const vendedores = [
  {
    id: 1, nombre: 'Carlos Méndez', avatar: 'CM', departamento: 'Ventas Guatemala',
    ventasMes: 1850000, metaMes: 1700000, ventasYTD: 12400000, metaYTD: 11500000,
    clientes: 12, nuevosClientes: 2, tickets: 48, ticketPromedio: 38542,
    cobranza: 98, efectividad: 87, comision: 55500, tendencia: 'up',
    historial: [1550000, 1480000, 1620000, 1700000, 1780000, 1850000]
  },
  {
    id: 2, nombre: 'Ana López', avatar: 'AL', departamento: 'Ventas Guatemala',
    ventasMes: 1420000, metaMes: 1400000, ventasYTD: 9800000, metaYTD: 9500000,
    clientes: 10, nuevosClientes: 1, tickets: 38, ticketPromedio: 37368,
    cobranza: 95, efectividad: 82, comision: 42600, tendencia: 'up',
    historial: [1200000, 1150000, 1280000, 1350000, 1380000, 1420000]
  },
  {
    id: 3, nombre: 'Sofía Reyes', avatar: 'SR', departamento: 'Ventas Mixco',
    ventasMes: 980000, metaMes: 1100000, ventasYTD: 7200000, metaYTD: 7500000,
    clientes: 8, nuevosClientes: 3, tickets: 28, ticketPromedio: 35000,
    cobranza: 92, efectividad: 75, comision: 29400, tendencia: 'stable',
    historial: [950000, 880000, 920000, 960000, 970000, 980000]
  },
  {
    id: 4, nombre: 'Jorge Castañeda', avatar: 'JC', departamento: 'Ventas Mixco',
    ventasMes: 720000, metaMes: 800000, ventasYTD: 5100000, metaYTD: 5600000,
    clientes: 6, nuevosClientes: 0, tickets: 22, ticketPromedio: 32727,
    cobranza: 88, efectividad: 71, comision: 21600, tendencia: 'down',
    historial: [780000, 750000, 760000, 740000, 730000, 720000]
  },
  {
    id: 5, nombre: 'Diana Flores', avatar: 'DF', departamento: 'Ventas B2B',
    ventasMes: 650000, metaMes: 600000, ventasYTD: 4200000, metaYTD: 3800000,
    clientes: 7, nuevosClientes: 4, tickets: 35, ticketPromedio: 18571,
    cobranza: 96, efectividad: 79, comision: 19500, tendencia: 'up',
    historial: [480000, 520000, 550000, 580000, 620000, 650000]
  },
]

const clientesTop = [
  { id: 1, nombre: 'Cervecería Centroamericana', sector: 'Alimentaria', compras: 1850000, transacciones: 45, ticketPromedio: 41111, vendedor: 'Carlos Méndez', tendencia: 'up' },
  { id: 2, nombre: 'Cementos Progreso', sector: 'Alimentaria', compras: 1420000, transacciones: 38, ticketPromedio: 37368, vendedor: 'Ana López', tendencia: 'up' },
  { id: 3, nombre: 'Transportes Galgos', sector: 'Logística', compras: 980000, transacciones: 28, ticketPromedio: 35000, vendedor: 'Sofía Reyes', tendencia: 'stable' },
  { id: 4, nombre: 'Genfar Guatemala', sector: 'Farmacéutica', compras: 720000, transacciones: 52, ticketPromedio: 13846, vendedor: 'Diana Flores', tendencia: 'up' },
  { id: 5, nombre: 'Empresas Diana', sector: 'Química', compras: 450000, transacciones: 85, ticketPromedio: 5294, vendedor: 'Jorge Castañeda', tendencia: 'up' },
  { id: 6, nombre: 'Lácteos del Sur', sector: 'Alimentaria', compras: 380000, transacciones: 18, ticketPromedio: 21111, vendedor: 'Carlos Méndez', tendencia: 'stable' },
  { id: 7, nombre: 'Agua Pura Vida', sector: 'Farmacéutica', compras: 290000, transacciones: 42, ticketPromedio: 6905, vendedor: 'Ana López', tendencia: 'down' },
  { id: 8, nombre: 'Helados Sarita', sector: 'Logística', compras: 195000, transacciones: 25, ticketPromedio: 7800, vendedor: 'Sofía Reyes', tendencia: 'up' },
]

const pipelineVentas = [
  { etapa: 'Cotización', cantidad: 24, valor: 1850000, probabilidad: 35 },
  { etapa: 'Negociación', cantidad: 18, valor: 1420000, probabilidad: 60 },
  { etapa: 'Orden Confirmada', cantidad: 12, valor: 980000, probabilidad: 85 },
  { etapa: 'En Producción', cantidad: 8, valor: 720000, probabilidad: 95 },
]

const insightsVentas = [
  { tipo: 'oportunidad', titulo: 'Cervecería Centroamericana +18% vs mes anterior', descripcion: 'El cliente más grande está creciendo. Propuesta: contrato anual con descuento escalonado por volumen.', icono: 'trophy' },
  { tipo: 'alerta', titulo: 'Jorge Castañeda 10% bajo meta YTD', descripcion: 'Desempeño descendente 3 meses consecutivos. Evaluar coaching o redistribución de cartera.', icono: 'warning' },
  { tipo: 'insight', titulo: 'Línea Farmacéutica tiene el mejor margen (48%)', descripcion: 'Blíster y Tapas generan 48% y 40% de margen. Priorizar leads en sector farmacéutico.', icono: 'lightbulb' },
  { tipo: 'alerta', titulo: 'Polietileno Soplado 9% bajo meta', descripcion: 'Ventas bajaron Q28K vs meta. Competencia de precios reportada por Jorge Castañeda.', icono: 'warning' },
]

const COLORS_MARGEN = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
const COLORS_PIPELINE = ['#94a3b8', '#f59e0b', '#10b981', '#001639']

// ========== COMPONENTES ==========

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-[var(--border-default)]">
      <p className="text-xs font-medium text-[var(--text-muted)] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value >= 1000000 ? formatGTQ(p.value) : p.value.toLocaleString('es-GT')}
        </p>
      ))}
    </div>
  )
}

export default function Ventas() {
  const [activeTab, setActiveTab] = useState('general')
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState(null)
  const [filtroLinea, setFiltroLinea] = useState('todas')
  const [animated, setAnimated] = useState(false)

  useEffect(() => { setTimeout(() => setAnimated(true), 100) }, [])

  const totalVentasMes = ventasMensuales[ventasMensuales.length - 1].ventas
  const totalMetaMes = ventasMensuales[ventasMensuales.length - 1].meta
  const totalCostosMes = ventasMensuales[ventasMensuales.length - 1].costos
  const margenBruto = Math.round(((totalVentasMes - totalCostosMes) / totalVentasMes) * 100)
  const cumplimientoMes = Math.round((totalVentasMes / totalMetaMes) * 100)
  const ventasYTD = ventasMensuales.reduce((s, m) => s + m.ventas, 0)
  const metaYTD = ventasMensuales.reduce((s, m) => s + m.meta, 0)
  const cumplimientoYTD = Math.round((ventasYTD / metaYTD) * 100)
  const pipelineValor = pipelineVentas.reduce((s, p) => s + p.valor, 0)
  const pipelinePonderado = pipelineVentas.reduce((s, p) => s + p.valor * (p.probabilidad / 100), 0)

  const lineasFiltradas = filtroLinea === 'todas' ? ventasPorLinea : ventasPorLinea.filter(l => l.categoria === filtroLinea)

  const vendedorDetalle = vendedorSeleccionado ? vendedores.find(v => v.id === vendedorSeleccionado) : null

  const mesesLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun']
  const vendedoresChartData = vendedores.map(v => ({
    nombre: v.nombre.split(' ')[0],
    ventas: v.ventasMes,
    meta: v.metaMes,
    YTD: v.ventasYTD,
  }))

  return (
    <div className="space-y-6 max-w-7xl">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#001639] flex items-center justify-center shadow-lg">
            <ShoppingBagIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Ventas</h1>
            <p className="text-sm text-[var(--text-muted)]">Thermoplástica, S.A. — Análisis completo de ventas y desempeño comercial</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-success text-[10px] flex items-center gap-1">
            <CalendarDaysIcon className="w-3 h-3" />
            Julio 2025
          </span>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] rounded-lg w-fit">
        {[
          { id: 'general', label: 'General', icon: ChartBarIcon },
          { id: 'vendedores', label: 'Por Vendedor', icon: UsersIcon },
          { id: 'clientes', label: 'Por Cliente', icon: BuildingStorefrontIcon },
          { id: 'productos', label: 'Por Producto', icon: CubeIcon },
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setVendedorSeleccionado(null) }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ========== TAB: GENERAL ========== */}
      {activeTab === 'general' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="kpi-card card-hover">
              <div className="flex items-center justify-between mb-2">
                <span className="kpi-label">Ventas Julio</span>
                <BanknotesIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
              <div className="kpi-value">{formatGTQ(totalVentasMes)}</div>
              <div className="flex items-center gap-1.5 mt-1">
                {cumplimientoMes >= 100 ? (
                  <ArrowTrendingUpIcon className="w-3.5 h-3.5 text-[var(--success)]" />
                ) : (
                  <ArrowTrendingDownIcon className="w-3.5 h-3.5 text-[var(--warning)]" />
                )}
                <span className={`text-xs font-medium ${cumplimientoMes >= 100 ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                  {cumplimientoMes}% de meta
                </span>
              </div>
            </div>

            <div className="kpi-card card-hover">
              <div className="flex items-center justify-between mb-2">
                <span className="kpi-label">Margen Bruto</span>
                <ReceiptPercentIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
              <div className="kpi-value text-[var(--success)]">{margenBruto}%</div>
              <span className="text-xs text-[var(--text-muted)]">Q{formatGTQ(totalVentasMes - totalCostosMes).slice(2)} contribución</span>
            </div>

            <div className="kpi-card card-hover">
              <div className="flex items-center justify-between mb-2">
                <span className="kpi-label">Cumplimiento YTD</span>
                <CalendarDaysIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
              <div className={`kpi-value ${cumplimientoYTD >= 100 ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>{cumplimientoYTD}%</div>
              <span className="text-xs text-[var(--text-muted)]">{formatGTQ(ventasYTD)} acumulado</span>
            </div>

            <div className="kpi-card card-hover">
              <div className="flex items-center justify-between mb-2">
                <span className="kpi-label">Pipeline</span>
                <ChartBarIcon className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
              <div className="kpi-value">{formatGTQ(Math.round(pipelinePonderado))}</div>
              <span className="text-xs text-[var(--text-muted)]">{formatGTQ(pipelineValor)} potencial</span>
            </div>
          </div>

          {/* Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {insightsVentas.map((ins, i) => (
              <div key={i} className={`p-4 rounded-lg border-l-4 ${
                ins.tipo === 'oportunidad' ? 'bg-green-50 border-green-500' :
                ins.tipo === 'alerta' ? 'bg-red-50 border-red-500' :
                'bg-blue-50 border-blue-500'
              }`}>
                <div className="flex items-start gap-3">
                  {ins.tipo === 'oportunidad' ? <TrophyIcon className="w-5 h-5 text-green-600 flex-shrink-0" /> :
                   ins.tipo === 'alerta' ? <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" /> :
                   <SparklesIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                  <div>
                    <p className={`text-sm font-medium ${
                      ins.tipo === 'oportunidad' ? 'text-green-800' : ins.tipo === 'alerta' ? 'text-red-800' : 'text-blue-800'
                    }`}>{ins.titulo}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{ins.descripcion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* TENDENCIA VENTAS */}
            <div className="lg:col-span-2 card">
              <div className="section-header">
                <ChartBarIcon className="w-5 h-5 text-[var(--accent-blue)]" />
                <h2 className="font-semibold">Tendencia de Ventas vs Meta</h2>
              </div>
              <div className="p-5 pt-2">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ventasMensuales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#001639" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#001639" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `Q${(v/1000000).toFixed(1)}M`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#001639" strokeWidth={2.5} fill="url(#colorVentas)" />
                      <Area type="monotone" dataKey="meta" name="Meta" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* PIPELINE */}
            <div className="card">
              <div className="section-header">
                <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
                <h2 className="font-semibold">Pipeline de Ventas</h2>
              </div>
              <div className="p-5 space-y-3">
                {pipelineVentas.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: COLORS_PIPELINE[i] }}
                    >
                      {p.cantidad}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.etapa}</p>
                      <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full mt-1">
                        <div className="h-full rounded-full" style={{ width: `${p.probabilidad}%`, backgroundColor: COLORS_PIPELINE[i] }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-semibold">{formatGTQ(p.valor)}</span>
                      <p className="text-[10px] text-[var(--text-muted)]">{p.probabilidad}% prob.</p>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-[var(--border-default)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Valor ponderado</span>
                    <span className="text-lg font-bold font-mono">{formatGTQ(Math.round(pipelinePonderado))}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">62 oportunidades · 62% prob. promedio</p>
                </div>
              </div>
            </div>
          </div>

          {/* VENDEDORES RESUMEN */}
          <div className="card">
            <div className="section-header">
              <UsersIcon className="w-5 h-5 text-[var(--accent-blue)]" />
              <h2 className="font-semibold">Desempeño de Vendedores — Julio</h2>
              <button onClick={() => setActiveTab('vendedores')} className="ml-auto text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1">
                Ver detalle <ChevronRightIcon className="w-3 h-3" />
              </button>
            </div>
            <div className="p-5">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendedoresChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="nombre" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `Q${(v/1000).toFixed(0)}K`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="ventas" name="Ventas Real" fill="#001639" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="meta" name="Meta" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== TAB: VENDEDORES ========== */}
      {activeTab === 'vendedores' && (
        <>
          {!vendedorSeleccionado ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {vendedores.map((v) => {
                  const cumplimiento = Math.round((v.ventasMes / v.metaMes) * 100)
                  const cumplimientoYTD = Math.round((v.ventasYTD / v.metaYTD) * 100)
                  return (
                    <div
                      key={v.id}
                      onClick={() => setVendedorSeleccionado(v.id)}
                      className="card p-5 cursor-pointer hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#001639] text-white flex items-center justify-center text-sm font-bold">
                            {v.avatar}
                          </div>
                          <div>
                            <p className="font-semibold">{v.nombre}</p>
                            <p className="text-xs text-[var(--text-muted)]">{v.departamento}</p>
                          </div>
                        </div>
                        <span className={`badge text-[10px] px-2 py-1 ${
                          cumplimiento >= 100 ? 'bg-green-100 text-green-700' :
                          cumplimiento >= 90 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {cumplimiento}% mes
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-2 bg-[var(--bg-secondary)] rounded">
                          <p className="text-[10px] text-[var(--text-muted)] uppercase">Ventas Mes</p>
                          <p className="text-sm font-bold font-mono">{formatGTQ(v.ventasMes)}</p>
                        </div>
                        <div className="p-2 bg-[var(--bg-secondary)] rounded">
                          <p className="text-[10px] text-[var(--text-muted)] uppercase">Ventas YTD</p>
                          <p className="text-sm font-bold font-mono">{formatGTQ(v.ventasYTD)}</p>
                        </div>
                        <div className="p-2 bg-[var(--bg-secondary)] rounded">
                          <p className="text-[10px] text-[var(--text-muted)] uppercase">Clientes</p>
                          <p className="text-sm font-bold">{v.clientes} <span className="text-[10px] text-[var(--success)]">(+{v.nuevosClientes})</span></p>
                        </div>
                        <div className="p-2 bg-[var(--bg-secondary)] rounded">
                          <p className="text-[10px] text-[var(--text-muted)] uppercase">Cobranza</p>
                          <p className="text-sm font-bold">{v.cobranza}%</p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[var(--text-muted)]">Progreso vs Meta YTD</span>
                          <span className="font-mono font-medium">{cumplimientoYTD}%</span>
                        </div>
                        <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000" style={{
                            width: animated ? `${Math.min(100, cumplimientoYTD)}%` : '0%',
                            backgroundColor: cumplimientoYTD >= 100 ? '#10b981' : cumplimientoYTD >= 90 ? '#f59e0b' : '#ef4444'
                          }} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                        <span>Ticket: {formatGTQ(v.ticketPromedio)}</span>
                        <span>Efectividad: {v.efectividad}%</span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-[var(--border-default)] flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)]">Comisión estimada</span>
                        <span className="text-sm font-bold font-mono text-[var(--accent-orange)]">{formatGTQ(v.comision)}</span>
                      </div>

                      <div className="mt-3 text-center">
                        <span className="text-xs text-[var(--accent-blue)] group-hover:underline">Ver detalle completo →</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* COMPARATIVA VENDEDORES CHART */}
              <div className="card">
                <div className="section-header">
                  <ChartBarIcon className="w-5 h-5 text-[var(--accent-blue)]" />
                  <h2 className="font-semibold">Comparativa de Vendedores — YTD</h2>
                </div>
                <div className="p-5 pt-2">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={vendedoresChartData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `Q${(v/1000000).toFixed(1)}M`} />
                        <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12, fill: '#374151' }} width={75} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="YTD" name="Ventas YTD" fill="#001639" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="ventas" name="Ventas Mes" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <button
                onClick={() => setVendedorSeleccionado(null)}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                ← Volver a todos los vendedores
              </button>

              <div className="card p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-[#001639] text-white flex items-center justify-center text-xl font-bold">
                    {vendedorDetalle.avatar}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{vendedorDetalle.nombre}</h2>
                    <p className="text-sm text-[var(--text-muted)]">{vendedorDetalle.departamento}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg text-center">
                    <p className="text-xs text-[var(--text-muted)] uppercase">Ventas Mes</p>
                    <p className="text-xl font-bold font-mono">{formatGTQ(vendedorDetalle.ventasMes)}</p>
                    <p className="text-xs text-[var(--text-muted)]">Meta: {formatGTQ(vendedorDetalle.metaMes)}</p>
                  </div>
                  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg text-center">
                    <p className="text-xs text-[var(--text-muted)] uppercase">Ventas YTD</p>
                    <p className="text-xl font-bold font-mono">{formatGTQ(vendedorDetalle.ventasYTD)}</p>
                    <p className="text-xs text-[var(--text-muted)]">Meta: {formatGTQ(vendedorDetalle.metaYTD)}</p>
                  </div>
                  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg text-center">
                    <p className="text-xs text-[var(--text-muted)] uppercase">Ticket Promedio</p>
                    <p className="text-xl font-bold font-mono">{formatGTQ(vendedorDetalle.ticketPromedio)}</p>
                    <p className="text-xs text-[var(--text-muted)]">{vendedorDetalle.tickets} tickets</p>
                  </div>
                  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg text-center">
                    <p className="text-xs text-[var(--text-muted)] uppercase">Comisión</p>
                    <p className="text-xl font-bold font-mono text-[var(--accent-orange)]">{formatGTQ(vendedorDetalle.comision)}</p>
                    <p className="text-xs text-[var(--text-muted)]">3% sobre ventas</p>
                  </div>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vendedorDetalle.historial.map((v, i) => ({ mes: mesesLabels[i], ventas: v }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `Q${(v/1000).toFixed(0)}K`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="ventas" name="Ventas Mensuales" stroke="#001639" strokeWidth={2.5} dot={{ fill: '#001639', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========== TAB: CLIENTES ========== */}
      {activeTab === 'clientes' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card">
              <div className="section-header">
                <BuildingStorefrontIcon className="w-5 h-5 text-[var(--accent-blue)]" />
                <h2 className="font-semibold">Concentración de Clientes (Regla 80/20)</h2>
              </div>
              <div className="p-5">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clientesTop.map((c, i) => ({
                      nombre: c.nombre.split(' ').slice(0, 2).join(' '),
                      compras: c.compras,
                      acumulado: clientesTop.slice(0, i + 1).reduce((s, x) => s + x.compras, 0)
                    }))} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#6b7280' }} angle={-45} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `Q${(v/1000).toFixed(0)}K`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="compras" name="Compras" fill="#001639" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-header">
                <StarIcon className="w-5 h-5 text-[var(--text-muted)]" />
                <h2 className="font-semibold">Top 8 Clientes</h2>
              </div>
              <div className="p-5 space-y-3">
                {clientesTop.map((c, i) => {
                  const total = clientesTop.reduce((s, x) => s + x.compras, 0)
                  const pct = ((c.compras / total) * 100).toFixed(1)
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="w-5 text-xs text-[var(--text-muted)] text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.nombre}</p>
                        <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full mt-0.5">
                          <div className="h-full bg-[#001639] rounded-full" style={{ width: `${pct * 5}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-mono font-semibold whitespace-nowrap">{formatGTQ(c.compras)}</span>
                    </div>
                  )
                })}
                <div className="pt-3 border-t border-[var(--border-default)]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Concentración top 3</span>
                    <span className="font-bold">{((clientesTop.slice(0, 3).reduce((s, c) => s + c.compras, 0) / clientesTop.reduce((s, c) => s + c.compras, 0)) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <BuildingStorefrontIcon className="w-5 h-5 text-[var(--text-muted)]" />
              <h2 className="font-semibold">Detalle de Clientes</h2>
            </div>
            <div className="table-container mx-5 mb-5">
              <table className="table">
                <thead>
                  <tr>
                    <th>#Cliente</th>
                    <th>Sector</th>
                    <th className="text-right">Compras</th>
                    <th className="text-right">Trans.</th>
                    <th className="text-right">Ticket Prom.</th>
                    <th>Vendedor</th>
                    <th className="text-center">Tendencia</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesTop.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <p className="font-medium text-sm">{c.nombre}</p>
                      </td>
                      <td><span className="badge-neutral text-[10px]">{c.sector}</span></td>
                      <td className="text-right font-mono font-medium">{formatGTQ(c.compras)}</td>
                      <td className="text-right font-mono text-sm">{c.transacciones}</td>
                      <td className="text-right font-mono text-sm">{formatGTQ(c.ticketPromedio)}</td>
                      <td className="text-sm">{c.vendedor}</td>
                      <td className="text-center">
                        {c.tendencia === 'up' ? <span className="badge-success text-[10px]">↑ Creciendo</span> :
                         c.tendencia === 'down' ? <span className="badge-danger text-[10px]">↓ Baja</span> :
                         <span className="badge-neutral text-[10px]">→ Estable</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========== TAB: PRODUCTOS ========== */}
      {activeTab === 'productos' && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <FunnelIcon className="w-4 h-4 text-[var(--text-muted)]" />
            <select
              value={filtroLinea}
              onChange={(e) => setFiltroLinea(e.target.value)}
              className="input text-xs py-1.5 w-auto"
            >
              <option value="todas">Todas las categorías</option>
              <option value="Alimentaria">Alimentaria</option>
              <option value="Bebidas">Bebidas</option>
              <option value="Química">Química</option>
              <option value="Farmacéutica">Farmacéutica</option>
              <option value="Logística">Logística</option>
              <option value="Industrial">Industrial</option>
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="section-header">
                <ShoppingBagIcon className="w-5 h-5 text-[var(--accent-blue)]" />
                <h2 className="font-semibold">Ventas por Línea de Producto</h2>
              </div>
              <div className="p-5">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lineasFiltradas} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#6b7280' }} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `Q${(v/1000).toFixed(0)}K`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="ventas" name="Ventas Real" fill="#001639" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="meta" name="Presupuesto" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-header">
                <ReceiptPercentIcon className="w-5 h-5 text-[var(--accent-blue)]" />
                <h2 className="font-semibold">Margen por Línea</h2>
              </div>
              <div className="p-5">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={lineasFiltradas} cx="50%" cy="50%" outerRadius={100} dataKey="ventas" nameKey="nombre"
                        label={({ nombre, margen }) => `${nombre.split(' ')[0]}: ${margen}%`}
                        labelLine={{ stroke: '#6b7280', strokeWidth: 0.5 }}
                      >
                        {lineasFiltradas.map((entry, index) => (
                          <Cell key={index} fill={COLORS_MARGEN[index % COLORS_MARGEN.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <CubeIcon className="w-5 h-5 text-[var(--text-muted)]" />
              <h2 className="font-semibold">Detalle por Línea de Producto</h2>
            </div>
            <div className="table-container mx-5 mb-5">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th className="text-right">Unidades</th>
                    <th className="text-right">Ventas</th>
                    <th className="text-right">Meta</th>
                    <th className="text-right">Margen</th>
                    <th className="text-center">Cumplimiento</th>
                    <th className="text-center">Tendencia</th>
                  </tr>
                </thead>
                <tbody>
                  {lineasFiltradas.map((l) => {
                    const cumpl = Math.round((l.ventas / l.meta) * 100)
                    return (
                      <tr key={l.id}>
                        <td>
                          <p className="font-medium text-sm">{l.nombre}</p>
                        </td>
                        <td><span className="badge-neutral text-[10px]">{l.categoria}</span></td>
                        <td className="text-right font-mono text-sm">{l.unidades.toLocaleString()}</td>
                        <td className="text-right font-mono font-medium">{formatGTQ(l.ventas)}</td>
                        <td className="text-right font-mono text-sm text-[var(--text-muted)]">{formatGTQ(l.meta)}</td>
                        <td className="text-right">
                          <span className={`font-mono text-sm font-medium ${l.margen >= 45 ? 'text-[var(--success)]' : l.margen >= 35 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}`}>
                            {l.margen}%
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            cumpl >= 100 ? 'bg-green-100 text-green-700' : cumpl >= 90 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>{cumpl}%</span>
                        </td>
                        <td className="text-center">
                          {l.tendencia === 'up' ? <ArrowTrendingUpIcon className="w-4 h-4 text-[var(--success)] mx-auto" /> :
                           l.tendencia === 'down' ? <ArrowTrendingDownIcon className="w-4 h-4 text-[var(--danger)] mx-auto" /> :
                           <span className="text-xs text-[var(--text-muted)]">→</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
