import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/useCfoData'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts'
import {
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UsersIcon,
  BuildingOfficeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  ShoppingBagIcon,
  TruckIcon,
  ChevronRightIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import PageInsights from '../components/agents/PageInsights'

const formatGTQ = (value) => {
  if (!value && value !== 0) return 'Q 0'
  return 'Q ' + value.toLocaleString('es-GT')
}

// ========== DATOS DEMO REALISTAS THERMOPLÁSTICA ==========

const ventasPorLinea = [
  { nombre: 'Termoformados Alim.', ventas: 1062500, presupuesto: 1000000, margen: 45 },
  { nombre: 'Envases PET Bebidas', ventas: 775000, presupuesto: 800000, margen: 42 },
  { nombre: 'Laminaciones PVC', ventas: 292500, presupuesto: 280000, margen: 52 },
  { nombre: 'Polietileno Soplado', ventas: 272000, presupuesto: 300000, margen: 38 },
  { nombre: 'Farmacéutica Blister', ventas: 168750, presupuesto: 150000, margen: 48 },
  { nombre: 'Industrial', ventas: 180000, presupuesto: 200000, margen: 28 },
]

const vendedores = [
  { nombre: 'Carlos Méndez', ventas: 1850000, meta: 1700000, clientes: 12, ticket: 41111, cobranza: 98 },
  { nombre: 'Ana López', ventas: 1420000, meta: 1400000, clientes: 10, ticket: 37368, cobranza: 95 },
  { nombre: 'Sofía Reyes', ventas: 980000, meta: 1100000, clientes: 8, ticket: 35000, cobranza: 92 },
  { nombre: 'Jorge Castañeda', ventas: 720000, meta: 800000, clientes: 6, ticket: 28000, cobranza: 88 },
]

const cxcAging = [
  { rango: 'Al Corriente', monto: 1850000, color: '#10b981' },
  { rango: '1-30 días', monto: 420000, color: '#f59e0b' },
  { rango: '31-60 días', monto: 180000, color: '#f97316' },
  { rango: '60+ días', monto: 85000, color: '#ef4444' },
]

const cxpProximas = [
  { proveedor: 'Resinas del Sur', monto: 285000, vence: '2 días', tipo: 'Materia Prima' },
  { proveedor: 'Equipos Industriales', monto: 145000, vence: '5 días', tipo: 'Mantenimiento' },
  { proveedor: 'Transportes Galgos', monto: 95000, vence: '7 días', tipo: 'Logística' },
  { proveedor: 'Servicios Eléctricos', monto: 68000, vence: '10 días', tipo: 'Servicios' },
]

const tendenciaVentas = [
  { mes: 'Ene', ventas: 4200000, presupuesto: 4000000 },
  { mes: 'Feb', ventas: 3850000, presupuesto: 4000000 },
  { mes: 'Mar', ventas: 4500000, presupuesto: 4200000 },
  { mes: 'Abr', ventas: 5100000, presupuesto: 4500000 },
  { mes: 'May', ventas: 4800000, presupuesto: 4600000 },
  { mes: 'Jun', ventas: 5200000, presupuesto: 4800000 },
  { mes: 'Jul', ventas: 5358000, presupuesto: 5000000 },
]

const produccionPipeline = [
  { etapa: 'Órdenes Nuevas', cantidad: 45, monto: 2850000 },
  { etapa: 'En Producción', cantidad: 32, monto: 1950000 },
  { etapa: 'Envasado/Empaque', cantidad: 18, monto: 1120000 },
  { etapa: 'Listo para Entrega', cantidad: 12, monto: 780000 },
]

const alertasCFO = [
  { tipo: 'critico', mensaje: 'CxP Resinas del Sur vence en 2 días (Q285K)', accion: 'Pagar ahora' },
  { tipo: 'warning', mensaje: 'Sofía Reyes está 8% bajo meta de ventas', accion: 'Revisar pipeline' },
  { tipo: 'warning', mensaje: 'Cartera 60+ días creció 15% (Q85K)', accion: 'Activar cobranza' },
  { tipo: 'info', mensaje: 'Ventas Julio superan presupuesto en 7.2%', accion: 'Ver detalle' },
]

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444']

export default function Dashboard() {
  const { data: dashboardData, isLoading } = useDashboard()
  const [animated, setAnimated] = useState(false)

  const tesoreria = dashboardData?.data?.tesoreria || {}
  const cxc = dashboardData?.data?.cxc || {}
  const cxp = dashboardData?.data?.cxp || {}
  const operacion = dashboardData?.data?.operacion || {}

  const totalVentasMes = ventasPorLinea.reduce((s, l) => s + l.ventas, 0)
  const totalPresupuesto = ventasPorLinea.reduce((s, l) => s + l.presupuesto, 0)
  const cumplimientoVentas = Math.round((totalVentasMes / totalPresupuesto) * 100)
  const margenPromedio = Math.round(ventasPorLinea.reduce((s, l) => s + l.margen, 0) / ventasPorLinea.length)
  const totalCxC = cxc.total || 2535000
  const totalCxP = cxp.total || 1850000
  const efectivo = tesoreria.total_gtq || 1250000
  const totalVencido = cxcAging.slice(1).reduce((s, a) => s + a.monto, 0)
  const pctVencido = Math.round((totalVencido / totalCxC) * 100)

  useEffect(() => { setTimeout(() => setAnimated(true), 100) }, [])

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-[var(--border-default)]">
        <p className="text-xs font-medium text-[var(--text-muted)] mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
            {p.name}: {formatGTQ(p.value)}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Panel Ejecutivo</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Thermoplástica, S.A. — Julio 2025</p>
        </div>
        <div className="flex items-center gap-2">
          {alertasCFO.filter(a => a.tipo === 'critico').length > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold flex items-center gap-1.5">
              <ExclamationTriangleIcon className="w-3.5 h-3.5" />
              {alertasCFO.filter(a => a.tipo === 'critico').length} alerta crítica
            </span>
          )}
          <span className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
            Última actualización: hoy 8:30 AM
          </span>
        </div>
      </div>

      {/* KPIs PRINCIPALES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Ventas Julio</span>
            <ChartBarIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value">{formatGTQ(totalVentasMes)}</div>
          <div className="flex items-center gap-1.5 mt-1">
            {cumplimientoVentas >= 100 ? (
              <ArrowTrendingUpIcon className="w-3.5 h-3.5 text-[var(--success)]" />
            ) : (
              <ArrowTrendingDownIcon className="w-3.5 h-3.5 text-[var(--warning)]" />
            )}
            <span className={`text-xs font-medium ${cumplimientoVentas >= 100 ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
              {cumplimientoVentas}% de presupuesto
            </span>
          </div>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Efectivo Disponible</span>
            <BanknotesIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value">{formatGTQ(efectivo)}</div>
          <span className="text-xs text-[var(--text-muted)]">3 bancos + caja</span>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">CxC Total</span>
            <UsersIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className={`kpi-value ${pctVencido > 20 ? 'text-[var(--danger)]' : ''}`}>{formatGTQ(totalCxC)}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-[var(--danger)] font-medium">{pctVencido}% vencido</span>
            <span className="text-xs text-[var(--text-muted)]">({formatGTQ(totalVencido)})</span>
          </div>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">CxP por Vencer</span>
            <BuildingOfficeIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value">{formatGTQ(totalCxP)}</div>
          <span className="text-xs text-[var(--text-muted)]">4 pagos próximos 7 días</span>
        </div>
      </div>

      {/* INSIGHTS DE IA - 2 COLUMNAS */}
      <PageInsights context="dashboard" maxInsights={4} title="Insights Inteligentes" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA PRINCIPAL */}
        <div className="lg:col-span-2 space-y-6">
          {/* VENTAS POR LÍNEA + TENDENCIA */}
          <div className="card">
            <div className="section-header">
              <ShoppingBagIcon className="w-5 h-5 text-[var(--accent-blue)]" />
              <h2 className="font-semibold">Ventas por Línea de Producto</h2>
              <Link to="/ventas" className="ml-auto text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1">
                Ver detalle <ChevronRightIcon className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-5">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ventasPorLinea} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `Q${(v/1000).toFixed(0)}K`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="ventas" name="Ventas Real" fill="#001639" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="presupuesto" name="Presupuesto" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[var(--border-default)]">
                <div className="text-center">
                  <p className="text-xs text-[var(--text-muted)]">Margen Promedio</p>
                  <p className="text-lg font-bold text-[var(--success)]">{margenPromedio}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[var(--text-muted)]">Líneas sobre meta</p>
                  <p className="text-lg font-bold">{ventasPorLinea.filter(l => l.ventas >= l.presupuesto).length}/6</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[var(--text-muted)]">Mejor línea</p>
                  <p className="text-lg font-bold">Termoformados</p>
                </div>
              </div>
            </div>
          </div>

          {/* TENDENCIA MENSUAL */}
          <div className="card">
            <div className="section-header">
              <ChartBarIcon className="w-5 h-5 text-[var(--accent-blue)]" />
              <h2 className="font-semibold">Tendencia de Ventas vs Presupuesto</h2>
            </div>
            <div className="p-5 pt-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tendenciaVentas} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    <Area type="monotone" dataKey="presupuesto" name="Presupuesto" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* DESARROLLO DE VENDEDORES */}
          <div className="card">
            <div className="section-header">
              <UsersIcon className="w-5 h-5 text-[var(--accent-blue)]" />
              <h2 className="font-semibold">Desempeño de Vendedores</h2>
              <Link to="/ventas" className="ml-auto text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1">
                Ver pipeline <ChevronRightIcon className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {vendedores.map((v, i) => {
                  const cumplimiento = Math.round((v.ventas / v.meta) * 100)
                  return (
                    <div key={i} className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#001639] text-white flex items-center justify-center text-xs font-bold">
                            {v.nombre.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{v.nombre}</p>
                            <p className="text-xs text-[var(--text-muted)]">{v.clientes} clientes</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          cumplimiento >= 100 ? 'bg-green-100 text-green-700' :
                          cumplimiento >= 90 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>{cumplimiento}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-[var(--text-muted)]">Ventas</span>
                        <span className="font-mono font-medium">{formatGTQ(v.ventas)}</span>
                      </div>
                      <div className="w-full h-2 bg-white rounded-full overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all duration-1000" style={{
                          width: animated ? `${Math.min(100, cumplimiento)}%` : '0%',
                          backgroundColor: cumplimiento >= 100 ? '#10b981' : cumplimiento >= 90 ? '#f59e0b' : '#ef4444'
                        }} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                        <span>Ticket: {formatGTQ(v.ticket)}</span>
                        <span>Cobranza: {v.cobranza}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendedores} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `Q${(v/1000).toFixed(0)}K`} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12, fill: '#374151' }} width={75} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="ventas" name="Ventas" fill="#001639" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="meta" name="Meta" fill="#cbd5e1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA LATERAL */}
        <div className="space-y-6">
          {/* CxC - AGING */}
          <div className="card">
            <div className="section-header">
              <UsersIcon className="w-5 h-5 text-[var(--text-muted)]" />
              <h2 className="font-semibold">Cuentas por Cobrar</h2>
              <Link to="/tesoreria/cuentas-por-cobrar" className="ml-auto text-xs text-[var(--accent-blue)] hover:underline">Ver →</Link>
            </div>
            <div className="p-5">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={cxcAging} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="monto">
                      {cxcAging.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {cxcAging.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: a.color }} />
                      <span className="text-[var(--text-secondary)]">{a.rango}</span>
                    </div>
                    <span className="font-mono font-medium">{formatGTQ(a.monto)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-800">Vencido total</span>
                  <span className="text-sm font-bold text-red-700">{formatGTQ(totalVencido)}</span>
                </div>
                <p className="text-xs text-red-600 mt-1">{pctVencido}% de cartera. Requiere acción de cobranza.</p>
              </div>
            </div>
          </div>

          {/* CxP PRÓXIMAS */}
          <div className="card">
            <div className="section-header">
              <BuildingOfficeIcon className="w-5 h-5 text-[var(--text-muted)]" />
              <h2 className="font-semibold">Cuentas por Pagar</h2>
              <Link to="/tesoreria/cuentas-por-pagar" className="ml-auto text-xs text-[var(--accent-blue)] hover:underline">Ver →</Link>
            </div>
            <div className="p-5 space-y-3">
              {cxpProximas.map((p, i) => (
                <div key={i} className={`p-3 rounded-lg border-l-4 ${
                  p.vence === '2 días' ? 'bg-red-50 border-red-500' : 'bg-[var(--bg-secondary)] border-amber-400'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{p.proveedor}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      p.vence === '2 días' ? 'bg-red-200 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}>{p.vence}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">{p.tipo}</span>
                    <span className="font-mono font-semibold">{formatGTQ(p.monto)}</span>
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-[var(--border-default)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total por pagar</span>
                  <span className="text-lg font-bold font-mono">{formatGTQ(totalCxP)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* PIPELINE PRODUCCIÓN */}
          <div className="card">
            <div className="section-header">
              <TruckIcon className="w-5 h-5 text-[var(--text-muted)]" />
              <h2 className="font-semibold">Pipeline de Producción</h2>
            </div>
            <div className="p-5 space-y-3">
              {produccionPipeline.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#001639] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {p.cantidad}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.etapa}</p>
                    <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full mt-1">
                      <div className="h-full bg-[#001639] rounded-full" style={{ width: `${(p.cantidad / 45) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-mono font-semibold whitespace-nowrap">{formatGTQ(p.monto)}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-[var(--border-default)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Backlog total</span>
                  <span className="text-lg font-bold font-mono">{formatGTQ(6700000)}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">107 órdenes en pipeline. Capacidad al 78%.</p>
              </div>
            </div>
          </div>

          {/* MARGEN POR LÍNEA */}
          <div className="card">
            <div className="section-header">
              <SparklesIcon className="w-5 h-5 text-[var(--accent-blue)]" />
              <h2 className="font-semibold">Margen por Línea</h2>
            </div>
            <div className="p-5 space-y-3">
              {ventasPorLinea.map((l, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.nombre}</p>
                    <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full mt-1">
                      <div className="h-full rounded-full transition-all duration-1000" style={{
                        width: animated ? `${l.margen}%` : '0%',
                        backgroundColor: l.margen >= 45 ? '#10b981' : l.margen >= 35 ? '#f59e0b' : '#ef4444'
                      }} />
                    </div>
                  </div>
                  <span className={`text-sm font-bold ml-3 whitespace-nowrap ${
                    l.margen >= 45 ? 'text-[var(--success)]' : l.margen >= 35 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'
                  }`}>{l.margen}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
