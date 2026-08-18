import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ChartBarIcon,
  ArrowLeftIcon,
  ShoppingBagIcon,
  MinusIcon,
  CubeIcon,
  CurrencyDollarIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  FunnelIcon,
  CalendarIcon,
  StarIcon,
} from '@heroicons/react/24/outline'

const formatGTQ = (value) => {
  if (!value && value !== 0) return 'Q 0'
  return 'Q ' + Math.round(value).toLocaleString('es-GT')
}

const formatNum = (value) => {
  if (!value && value !== 0) return '0'
  return value.toLocaleString('es-GT')
}

const lineas = ['todas', 'Alimentaria', 'Farmacéutica', 'Química/Cosmética', 'Logística/Seguridad', 'Bebidas', 'Industrial']

const coloresLinea = {
  'Alimentaria': '#2563EB',
  'Farmacéutica': '#059669',
  'Química/Cosmética': '#D97706',
  'Logística/Seguridad': '#7C3AED',
  'Bebidas': '#DC2626',
  'Industrial': '#0891B2',
}

// ============================================
// DATOS DE PRODUCTOS THERMOPLÁSTICA
// ============================================
const demoHistorialServicios = [
  // Alimentaria
  { id: 1, nombre: 'Termoformados Bandejas Alimentarias - Cervecería Centroamericana', linea: 'Alimentaria', precioVenta: 2.50, costoUnitario: 1.40, historial: [82000, 84500, 81000, 86000, 88000, 89500], margen: 44, proveedor: 'Operación propia' },
  { id: 2, nombre: 'Envases PET para Yogurt - Lácteos del Sur', linea: 'Alimentaria', precioVenta: 1.80, costoUnitario: 1.05, historial: [65000, 67000, 64000, 68000, 70000, 71000], margen: 42, proveedor: 'Operación propia' },
  { id: 3, nombre: 'Tapas Termoformadas para Helados - Helados Sarita', linea: 'Alimentaria', precioVenta: 0.85, costoUnitario: 0.48, historial: [38000, 39000, 37000, 40000, 41000, 42000], margen: 44, proveedor: 'Operación propia' },
  // Farmacéutica
  { id: 4, nombre: 'Blísters Termoformados para Medicamentos - Genfar Guatemala', linea: 'Farmacéutica', precioVenta: 3.20, costoUnitario: 1.92, historial: [28000, 29000, 27000, 30000, 31000, 32000], margen: 40, proveedor: 'Operación propia' },
  { id: 5, nombre: 'Envases PE para Suplementos - Pharma Latinoamérica', linea: 'Farmacéutica', precioVenta: 2.80, costoUnitario: 1.68, historial: [3500, 3800, 3400, 4000, 4200, 4500], margen: 40, proveedor: 'Operación propia' },
  // Química/Cosmética
  { id: 6, nombre: 'Envases Soplados PE para Detergentes - Empresas Diana', linea: 'Química/Cosmética', precioVenta: 4.50, costoUnitario: 2.70, historial: [28000, 29000, 27000, 30000, 31000, 32000], margen: 40, proveedor: 'Operación propia' },
  { id: 7, nombre: 'Envases PET para Cosméticos - Boticas Similares', linea: 'Química/Cosmética', precioVenta: 3.80, costoUnitario: 2.28, historial: [1200, 1250, 1100, 1300, 1350, 1400], margen: 40, proveedor: 'Operación propia' },
  // Logística/Seguridad
  { id: 8, nombre: 'Liners para Sellos de Seguridad - Transportes Galgos', linea: 'Logística/Seguridad', precioVenta: 0.45, costoUnitario: 0.27, historial: [150000, 155000, 148000, 160000, 165000, 170000], margen: 40, proveedor: 'Operación propia' },
  { id: 9, nombre: 'Laminación PVDC para Sellos - Aduanas del Istmo', linea: 'Logística/Seguridad', precioVenta: 6.50, costoUnitario: 3.90, historial: [800, 820, 750, 850, 880, 900], margen: 40, proveedor: 'Operación propia' },
  // Bebidas
  { id: 10, nombre: 'Botellas PET 500ml para Agua - Agua Pura Vida', linea: 'Bebidas', precioVenta: 1.20, costoUnitario: 0.72, historial: [52000, 54000, 51000, 56000, 58000, 60000], margen: 40, proveedor: 'Operación propia' },
  { id: 11, nombre: 'Botellas PET 2L para Refrescos - Gatorade Guatemala', linea: 'Bebidas', precioVenta: 2.40, costoUnitario: 1.44, historial: [3800, 4000, 3700, 4200, 4400, 4600], margen: 40, proveedor: 'Operación propia' },
  // Industrial
  { id: 12, nombre: 'Contenedores Termoformados Industriales - Cementos Progreso', linea: 'Industrial', precioVenta: 12.00, costoUnitario: 7.20, historial: [1100, 1150, 1050, 1200, 1250, 1300], margen: 40, proveedor: 'Operación propia' },
  { id: 13, nombre: 'Laminación Aluminio para Químicos - Química Centroamericana', linea: 'Industrial', precioVenta: 18.50, costoUnitario: 11.10, historial: [180, 190, 170, 200, 210, 220], margen: 40, proveedor: 'Operación propia' },
]

const demoMesesHistorial = ['Dic 2025', 'Ene 2026', 'Feb 2026', 'Mar 2026', 'Abr 2026', 'May 2026']

// ============================================
// GRÁFICA DE BARRAS VERTICAL (histórico por mes)
// ============================================
function GraficaHistorial({ historial, color, maxValor, meses }) {
  const max = maxValor || Math.max(...historial) * 1.1
  return (
    <div className="flex items-end gap-1 h-16">
      {historial.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div
            className="w-full rounded-t transition-all"
            style={{ height: `${(v / max) * 100}%`, backgroundColor: color, opacity: 0.8 }}
          />
          {/* Tooltip */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#001639] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
            {formatNum(v)} kg
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// GRÁFICA COMPARATIVA POR LÍNEA
// ============================================
function GraficaComparativaLineas({ datosPorLinea, meses }) {
  let max = 0
  Object.values(datosPorLinea).forEach(arr => {
    max = Math.max(max, ...arr)
  })
  max = max * 1.1

  return (
    <div className="space-y-3">
      {Object.entries(datosPorLinea).map(([linea, valores]) => {
        const total = valores.reduce((a, b) => a + b, 0)
        return (
          <div key={linea} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium" style={{ color: coloresLinea[linea] }}>{linea}</span>
              <span className="font-mono text-[var(--text-muted)]">{formatNum(total)} kg</span>
            </div>
            <div className="flex items-end gap-0.5 h-8">
              {valores.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm transition-all"
                  style={{ height: `${(v / max) * 100}%`, backgroundColor: coloresLinea[linea], opacity: 0.7 }}
                />
              ))}
            </div>
          </div>
        )
      })}
      <div className="flex gap-0.5 pt-1">
        {meses.map((m, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[9px] text-[var(--text-muted)]">{m.split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HistorialServicios() {
  const [lineaSeleccionada, setLineaSeleccionada] = useState('todas')
  const [vista, setVista] = useState('tarjetas')

  // Filtrar servicios
  const serviciosFiltrados = useMemo(() => {
    const base = lineaSeleccionada === 'todas'
      ? demoHistorialServicios
      : demoHistorialServicios.filter(s => s.linea === lineaSeleccionada)
    return base.map(s => {
      const totalVolumen = s.historial.reduce((a, b) => a + b, 0)
      const totalIngresos = s.historial.reduce((a, b) => a + b * s.precioVenta, 0)
      const promedioMensual = Math.round(totalVolumen / 6)
      const tendencia = s.historial[5] > s.historial[0] ? 'up' : s.historial[5] < s.historial[0] ? 'down' : 'stable'
      const crecimiento = s.historial[0] > 0
        ? (((s.historial[5] - s.historial[0]) / s.historial[0]) * 100).toFixed(1)
        : '0.0'
      return { ...s, totalVolumen, totalIngresos, promedioMensual, tendencia, crecimiento: parseFloat(crecimiento) }
    }).sort((a, b) => b.totalIngresos - a.totalIngresos)
  }, [lineaSeleccionada])

  // KPIs globales
  const totalVolumen = serviciosFiltrados.reduce((s, srv) => s + srv.totalVolumen, 0)
  const totalIngresos = serviciosFiltrados.reduce((s, srv) => s + srv.totalIngresos, 0)
  const totalMargen = serviciosFiltrados.reduce((s, srv) => s + srv.totalIngresos * (srv.margen / 100), 0)
  const servicioTop = serviciosFiltrados[0]

  // Datos por línea para gráfica comparativa
  const datosPorLinea = useMemo(() => {
    const resultado = {}
    demoHistorialServicios.forEach(s => {
      if (!resultado[s.linea]) resultado[s.linea] = [0, 0, 0, 0, 0, 0]
      s.historial.forEach((v, i) => { resultado[s.linea][i] += v })
    })
    return resultado
  }, [])

  // Totales por mes
  const totalesPorMes = useMemo(() => {
    const meses = [0, 0, 0, 0, 0, 0]
    serviciosFiltrados.forEach(s => {
      s.historial.forEach((v, i) => { meses[i] += v })
    })
    return meses
  }, [serviciosFiltrados])

  const maxValorHistorial = useMemo(() => {
    let max = 0
    serviciosFiltrados.forEach(s => {
      max = Math.max(max, ...s.historial)
    })
    return max * 1.1
  }, [serviciosFiltrados])

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* BREADCRUMBS + HEADER */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Link to="/analisis" className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
            <ChartBarIcon className="w-4 h-4" />
            Análisis
          </Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-medium">Historial de Servicios</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#001639] flex items-center justify-center shadow-lg">
              <ChartBarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Historial de Servicios por Línea</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Análisis de productos Thermoplástica — 6 meses de historial
              </p>
            </div>
          </div>

          <Link
            to="/analisis"
            className="btn-secondary text-sm flex items-center gap-2 self-start sm:self-auto"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Volver a Análisis
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Total Volumen 6M</span>
            <CubeIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value">{formatNum(totalVolumen)} kg</div>
          <span className="text-xs text-[var(--text-muted)]">
            {serviciosFiltrados.length} servicios
          </span>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Ingresos Totales 6M</span>
            <CurrencyDollarIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value">{formatGTQ(totalIngresos)}</div>
          <span className="text-xs text-[var(--text-muted)]">Servicios acumulados</span>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Margen Bruto 6M</span>
            <ChartBarIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value text-[var(--success)]">{formatGTQ(totalMargen)}</div>
          <span className="text-xs text-[var(--text-muted)]">
            {totalIngresos > 0 ? ((totalMargen / totalIngresos) * 100).toFixed(1) : 0}% del ingreso
          </span>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Servicio #1</span>
            <StarIcon className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <div className="kpi-value text-lg">{servicioTop ? formatGTQ(servicioTop.totalIngresos) : 'Q 0'}</div>
          <span className="text-xs text-[var(--text-muted)] truncate">
            {servicioTop ? servicioTop.nombre.slice(0, 25) + '...' : '—'}
          </span>
        </div>
      </div>

      {/* GRÁFICA COMPARATIVA POR LÍNEA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="section-header">
            <ChartPieIcon className="w-5 h-5 text-[var(--accent-blue)]" />
            <h2 className="font-semibold">Comparativa de Servicios por Línea</h2>
            <span className="ml-auto text-xs text-[var(--text-muted)]">Volumen por mes (kg)</span>
          </div>
          <div className="p-5 pt-0">
            <GraficaComparativaLineas datosPorLinea={datosPorLinea} meses={demoMesesHistorial} />
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <CalendarIcon className="w-5 h-5 text-[var(--accent-orange)]" />
            <h2 className="font-semibold">Volumen por Mes</h2>
          </div>
          <div className="p-5 pt-0 space-y-3">
            {totalesPorMes.map((v, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-14 text-xs text-[var(--text-muted)]">{demoMesesHistorial[i]}</span>
                <div className="flex-1 h-2.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(v / Math.max(...totalesPorMes)) * 100}%`,
                      backgroundColor: '#001639',
                    }}
                  />
                </div>
                <span className="w-16 text-right text-xs font-mono">{formatNum(v)} kg</span>
              </div>
            ))}
            <div className="pt-2 border-t border-[var(--border-default)] flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-primary)]">Total 6 meses</span>
              <span className="text-sm font-bold font-mono">{formatNum(totalVolumen)} kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTROS + VISTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <FunnelIcon className="w-4 h-4 text-[var(--text-muted)]" />
          {lineas.map(linea => (
            <button
              key={linea}
              onClick={() => setLineaSeleccionada(linea)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                lineaSeleccionada === linea
                  ? 'bg-[#001639] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-strong)]'
              }`}
            >
              {linea === 'todas' ? 'Todas' : linea}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setVista('tarjetas')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              vista === 'tarjetas'
                ? 'bg-[#001639] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-strong)]'
            }`}
          >
            Tarjetas
          </button>
          <button
            onClick={() => setVista('tabla')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              vista === 'tabla'
                ? 'bg-[#001639] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-strong)]'
            }`}
          >
            Tabla detallada
          </button>
        </div>
      </div>

      {/* VISTA TARJETAS */}
      {vista === 'tarjetas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {serviciosFiltrados.map((servicio, idx) => {
            const color = coloresLinea[servicio.linea] || '#001639'
            return (
              <div key={servicio.id} className="card card-hover">
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
                        <span className="text-xs font-bold" style={{ color }}>{idx + 1}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-medium text-[var(--text-muted)]">{servicio.linea}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {servicio.tendencia === 'up' ? (
                        <ArrowTrendingUpIcon className="w-4 h-4 text-[var(--success)]" />
                      ) : servicio.tendencia === 'down' ? (
                        <ArrowTrendingDownIcon className="w-4 h-4 text-[var(--danger)]" />
                      ) : (
                        <MinusIcon className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                      <span className={`text-xs font-mono ${servicio.crecimiento > 0 ? 'text-[var(--success)]' : servicio.crecimiento < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>
                        {servicio.crecimiento > 0 ? '+' : ''}{servicio.crecimiento}%
                      </span>
                    </div>
                  </div>

                  {/* Nombre */}
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-3 line-clamp-2">
                    {servicio.nombre}
                  </p>

                  {/* Gráfica */}
                  <GraficaHistorial
                    historial={servicio.historial}
                    color={color}
                    maxValor={maxValorHistorial}
                    meses={demoMesesHistorial}
                  />
                  <div className="flex gap-1 mt-1">
                    {demoMesesHistorial.map((m, i) => (
                      <div key={i} className="flex-1 text-center">
                        <span className="text-[9px] text-[var(--text-muted)]">{m.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[var(--border-default)]">
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase">Total 6M</p>
                      <p className="text-sm font-bold font-mono">{formatNum(servicio.totalVolumen)} kg</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase">Prom/Mes</p>
                      <p className="text-sm font-bold font-mono">{formatNum(servicio.promedioMensual)} kg</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase">Ingresos</p>
                      <p className="text-sm font-bold font-mono">{formatGTQ(servicio.totalIngresos)}</p>
                    </div>
                  </div>

                  {/* Margen y precio */}
                  <div className="mt-3 p-2 bg-[var(--bg-secondary)] rounded-lg">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)]">Margen:</span>
                      <span className="font-mono font-medium" style={{ color }}>{servicio.margen}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-[var(--text-muted)]">Precio:</span>
                      <span className="font-mono">Q {servicio.precioVenta} / kg</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-[var(--text-muted)]">Costo:</span>
                      <span className="font-mono">Q {servicio.costoUnitario} / kg</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VISTA TABLA */}
      {vista === 'tabla' && (
        <div className="card">
          <div className="section-header">
            <ChartBarIcon className="w-5 h-5 text-[var(--text-primary)]" />
            <h2 className="font-semibold">Detalle de Servicios por Línea</h2>
            <span className="ml-auto text-xs text-[var(--text-muted)]">6 meses de historial</span>
          </div>

          <div className="table-container mx-5 mb-5">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Servicio</th>
                  <th>Línea</th>
                  {demoMesesHistorial.map(m => (
                    <th key={m} className="text-right">{m.split(' ')[0]}</th>
                  ))}
                  <th className="text-right">Total Vol</th>
                  <th className="text-right">Ingresos</th>
                  <th className="text-right">Margen</th>
                  <th className="text-center">Tendencia</th>
                </tr>
              </thead>
              <tbody>
                {serviciosFiltrados.map((servicio, idx) => (
                  <tr key={servicio.id}>
                    <td>
                      <span className="text-xs text-[var(--text-muted)]">{idx + 1}</span>
                    </td>
                    <td>
                      <p className="font-medium text-sm">{servicio.nombre}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Q {servicio.precioVenta} venta · Q {servicio.costoUnitario} costo
                      </p>
                    </td>
                    <td>
                      <span
                        className="badge text-[10px]"
                        style={{
                          backgroundColor: coloresLinea[servicio.linea] + '15',
                          color: coloresLinea[servicio.linea],
                        }}
                      >
                        {servicio.linea}
                      </span>
                    </td>
                    {servicio.historial.map((v, i) => (
                      <td key={i} className="text-right font-mono text-sm">
                        <span className={v > servicio.promedioMensual * 1.2 ? 'text-[var(--success)] font-medium' : v < servicio.promedioMensual * 0.8 ? 'text-[var(--danger)]' : ''}>
                          {formatNum(v)}
                        </span>
                      </td>
                    ))}
                    <td className="text-right font-mono font-semibold">{formatNum(servicio.totalVolumen)} kg</td>
                    <td className="text-right font-mono font-medium">{formatGTQ(servicio.totalIngresos)}</td>
                    <td className="text-right font-mono text-sm">
                      <span className="text-[var(--success)]">{formatGTQ(servicio.totalIngresos * (servicio.margen / 100))}</span>
                    </td>
                    <td className="text-center">
                      {servicio.tendencia === 'up' ? (
                        <span className="badge-success text-[10px] flex items-center justify-center gap-1">
                          <ArrowTrendingUpIcon className="w-3 h-3" /> +{servicio.crecimiento}%
                        </span>
                      ) : servicio.tendencia === 'down' ? (
                        <span className="badge-danger text-[10px] flex items-center justify-center gap-1">
                          <ArrowTrendingDownIcon className="w-3 h-3" /> {servicio.crecimiento}%
                        </span>
                      ) : (
                        <span className="badge-neutral text-[10px]">→ Estable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="px-5 pb-5">
            <div className="p-4 bg-[var(--bg-secondary)] rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase">Total Volumen</p>
                  <p className="text-lg font-bold font-mono">{formatNum(totalVolumen)} kg</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase">Ingresos Totales</p>
                  <p className="text-lg font-bold font-mono text-[var(--accent-orange)]">{formatGTQ(totalIngresos)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase">Margen Bruto</p>
                  <p className="text-lg font-bold font-mono text-[var(--success)]">{formatGTQ(totalMargen)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase">Margen %</p>
                  <p className="text-lg font-bold font-mono">
                    {totalIngresos > 0 ? ((totalMargen / totalIngresos) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
