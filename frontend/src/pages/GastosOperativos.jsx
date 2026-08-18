import { useState, useMemo } from 'react'
import {
  BanknotesIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BeakerIcon,
  UsersIcon,
  BoltIcon,
  WrenchIcon,
  BuildingOfficeIcon,
  TruckIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ChartBarIcon,
  CalculatorIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

const formatGTQ = (value) => {
  if (!value && value !== 0) return 'Q 0'
  return 'Q ' + Math.round(value).toLocaleString('es-GT')
}

const formatNum = (value) => {
  if (!value && value !== 0) return '0'
  return value.toLocaleString('es-GT')
}

const formatPct = (value) => {
  if (!value && value !== 0) return '0%'
  return value.toFixed(1) + '%'
}

// ============================================
// DATOS DE DEMO - GASTOS OPERATIVOS THERMOPLÁSTICA
// ============================================

const CATEGORIAS_GASTO = [
  {
    id: 'materias_primas',
    nombre: 'Materias Primas',
    icono: BeakerIcon,
    color: '#3B82F6',
    descripcion: 'Resinas PET, PVC, PVDC, polietileno, polipropileno, aluminio',
    proveedorPrincipal: 'Dow Chemical / Braskem',
    terminos: '2/10 n/30',
    frecuencia: 'semanal',
  },
  {
    id: 'nomina',
    nombre: 'Nómina y Salarios',
    icono: UsersIcon,
    color: '#10B981',
    descripcion: 'Salarios operarios, técnicos de extrusión, administrativos, cargas sociales',
    proveedorPrincipal: 'Nómina interna',
    terminos: 'quincenal',
    frecuencia: 'quincenal',
  },
  {
    id: 'servicios',
    nombre: 'Servicios Públicos',
    icono: BoltIcon,
    color: '#F59E0B',
    descripcion: 'Energía eléctrica (alta tensión), gas natural, agua industrial',
    proveedorPrincipal: 'EEGSA / TECO',
    terminos: 'n/15',
    frecuencia: 'mensual',
  },
  {
    id: 'mantenimiento',
    nombre: 'Mantenimiento Equipos',
    icono: WrenchIcon,
    color: '#EF4444',
    descripcion: 'Mantenimiento extrusoras, termoformadoras, impresoras flexográficas',
    proveedorPrincipal: 'Servicio Técnico Industrial GT',
    terminos: 'contado',
    frecuencia: 'mensual',
  },
  {
    id: 'alquiler',
    nombre: 'Alquiler Instalaciones',
    icono: BuildingOfficeIcon,
    color: '#8B5CF6',
    descripcion: 'Planta industrial Zona 3, bodega Zona 12, oficinas corporativas',
    proveedorPrincipal: 'Alquileres Metropolitanos',
    terminos: 'n/5',
    frecuencia: 'mensual',
  },
  {
    id: 'transporte',
    nombre: 'Transporte y Logística',
    icono: TruckIcon,
    color: '#06B6D4',
    descripcion: 'Entrega a clientes industriales, exportaciones, flete internacional',
    proveedorPrincipal: 'Transporte Express Cargo',
    terminos: 'n/15',
    frecuencia: 'semanal',
  },
  {
    id: 'marketing',
    nombre: 'Marketing y Ventas',
    icono: MegaphoneIcon,
    color: '#EC4899',
    descripcion: 'Ferias industriales, visitas comerciales, catálogos técnicos, web',
    proveedorPrincipal: 'Publicidad y Marketing 360°',
    terminos: 'n/15',
    frecuencia: 'mensual',
  },
  {
    id: 'seguros',
    nombre: 'Seguros y Otros',
    icono: ShieldCheckIcon,
    color: '#6366F1',
    descripcion: 'Seguro de maquinaria, responsabilidad civil, certificaciones ISO/SGS',
    proveedorPrincipal: 'Seguros El Roble, S.A.',
    terminos: 'n/30',
    frecuencia: 'mensual',
  },
]

// Datos de gastos históricos (6 meses)
const HISTORIAL_GASTOS = {
  materias_primas: [420000, 385000, 451000, 398000, 475000, 442000],
  nomina: [125000, 125000, 132000, 132000, 132000, 138000],
  servicios: [28000, 26500, 31000, 29500, 33500, 32000],
  mantenimiento: [15000, 8500, 22000, 12000, 18500, 9500],
  alquiler: [35000, 35000, 35000, 35000, 35000, 35000],
  transporte: [18500, 17200, 19800, 18500, 21000, 19500],
  marketing: [12000, 8500, 15000, 11000, 18000, 14000],
  seguros: [15000, 15000, 15000, 15000, 15000, 15000],
}

const MESES_HISTORIAL = ['Ene 2026', 'Feb 2026', 'Mar 2026', 'Abr 2026', 'May 2026', 'Jun 2026']

// Productos ofrecidos por Thermoplástica
const SERVICIOS = [
  { id: 1, nombre: 'Termoformados Alimentarios', descripcion: 'Bandejas, contenedores, tapas para industria alimentaria', precioBase: 2.50, unidad: 'unidad', volumenMensual: 85000, clientes: 14 },
  { id: 2, nombre: 'Envases PET para Bebidas', descripcion: 'Botellas, jarros, envases para líquidos', precioBase: 1.80, unidad: 'unidad', volumenMensual: 120000, clientes: 8 },
  { id: 3, nombre: 'Liners y Sellos de Seguridad', descripcion: 'Liner para sellos de seguridad, material cut-to-size', precioBase: 0.45, unidad: 'unidad', volumenMensual: 650000, clientes: 25 },
  { id: 4, nombre: 'Laminaciones Industriales', descripcion: 'Film laminado PVC, PVDC, aluminio para empaque', precioBase: 8.50, unidad: 'metro', volumenMensual: 32000, clientes: 12 },
  { id: 5, nombre: 'Envases Polietileno Soplado', descripcion: 'Contenedores soplados PE/PP para industria química/cosmética', precioBase: 4.20, unidad: 'unidad', volumenMensual: 42000, clientes: 6 },
  { id: 6, nombre: 'Equipos y Material Industrial', descripcion: 'Venta de maquinaria y equipos auxiliares', precioBase: 25000.00, unidad: 'equipo', volumenMensual: 3, clientes: 5 },
]

// ============================================
// MOTOR DE ANÁLISIS DE GASTOS
// ============================================

function calcularAnalisisGastos() {
  const datos = CATEGORIAS_GASTO.map(cat => {
    const historial = HISTORIAL_GASTOS[cat.id]
    const total6meses = historial.reduce((a, b) => a + b, 0)
    const promedioMensual = total6meses / 6
    const ultimoMes = historial[historial.length - 1]
    const primerMes = historial[0]
    const tendencia = ((ultimoMes - primerMes) / primerMes) * 100
    
    // Proyección 3 meses
    const proyeccion = [
      Math.round(promedioMensual * (1 + tendencia * 0.003)),
      Math.round(promedioMensual * (1 + tendencia * 0.005)),
      Math.round(promedioMensual * (1 + tendencia * 0.007)),
    ]
    
    return {
      ...cat,
      historial,
      total6meses,
      promedioMensual,
      tendencia,
      ultimoMes,
      proyeccion,
    }
  })
  
  const totalGastos6M = datos.reduce((s, d) => s + d.total6meses, 0)
  const promedioMensualTotal = totalGastos6M / 6
  
  return { datos, totalGastos6M, promedioMensualTotal }
}

function calcularAnalisisServicios() {
  return SERVICIOS.map(servicio => {
    const ingresoMensual = servicio.volumenMensual * servicio.precioBase
    const ingreso6M = ingresoMensual * 6
    const participacion = (ingresoMensual / SERVICIOS.reduce((s, srv) => s + srv.volumenMensual * srv.precioBase, 0)) * 100
    
    return {
      ...servicio,
      ingresoMensual,
      ingreso6M,
      participacion,
    }
  })
}

// ============================================
// COMPONENTE BARRA DE PROGRESO
// ============================================
function BarraGastos({ historial, maxValor, color = '#001639' }) {
  const max = maxValor || Math.max(...historial) * 1.1
  
  return (
    <div className="flex items-end gap-1 h-16">
      {historial.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t transition-all"
            style={{
              height: `${(v / max) * 100}%`,
              backgroundColor: color,
              opacity: 0.8,
            }}
          />
        </div>
      ))}
    </div>
  )
}

// ============================================
// PÁGINA PRINCIPAL
// ============================================
export default function GastosOperativos() {
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('todas')
  const [vistaExpandida, setVistaExpandida] = useState(false)
  const [mostrarSoloAltos, setMostrarSoloAltos] = useState(false)

  const { datos: datosGastos, totalGastos6M, promedioMensualTotal } = useMemo(() => calcularAnalisisGastos(), [])
  const datosServicios = useMemo(() => calcularAnalisisServicios(), [])

  const categoriasFiltradas = categoriaSeleccionada === 'todas'
    ? datosGastos
    : datosGastos.filter(g => g.id === categoriaSeleccionada)

  const gastosAltos = mostrarSoloAltos
    ? categoriasFiltradas.filter(g => g.tendencia > 5)
    : categoriasFiltradas

  // KPIs globales
  const categoriaMayorGasto = [...datosGastos].sort((a, b) => b.total6meses - a.total6meses)[0]
  const tendenciaGeneral = ((datosGastos[0].ultimoMes - datosGastos[0].historial[0]) / datosGastos[0].historial[0] * 100)
  const totalGastosUltimoMes = datosGastos.reduce((s, g) => s + g.ultimoMes, 0)
  const proyeccion3M = datosGastos.reduce((s, g) => s + g.proyeccion.reduce((a, b) => a + b, 0), 0)

  // Alertas de gastos elevados (top 5 categorías con mayor tendencia de aumento)
  const alertasGastos = [...datosGastos]
    .filter(g => g.tendencia > 5)
    .sort((a, b) => b.tendencia - a.tendencia)
    .slice(0, 5)

  const getTendenciaStyles = (tendencia) => {
    if (tendencia > 10) return 'bg-red-50 text-red-700 border-red-200'
    if (tendencia > 5) return 'bg-orange-50 text-orange-700 border-orange-200'
    if (tendencia > 0) return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    return 'bg-green-50 text-green-700 border-green-200'
  }

  const getTendenciaIcon = (tendencia) => {
    if (tendencia > 5) return <ArrowTrendingUpIcon className="w-4 h-4 text-red-500" />
    if (tendencia > 0) return <ArrowTrendingUpIcon className="w-4 h-4 text-orange-500" />
    if (tendencia < -5) return <ArrowTrendingDownIcon className="w-4 h-4 text-green-500" />
    return <MinusIcon className="w-4 h-4 text-gray-400" />
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* ============================================
          HEADER
      ============================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#001639] flex items-center justify-center shadow-lg">
            <BanknotesIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Gastos Operativos</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Análisis de costos · Proyección · Control de gastos de Thermoplástica
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Análisis actualizado:</span>
          <span className="badge-success text-[10px] flex items-center gap-1">
            <CheckCircleIcon className="w-3 h-3" />
            {new Date().toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ============================================
          KPIs PRINCIPALES
      ============================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Total Gastos 6M</span>
            <BanknotesIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value">{formatGTQ(totalGastos6M)}</div>
          <span className="text-xs text-[var(--text-muted)]">{datosGastos.length} categorías</span>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Promedio Mensual</span>
            <ChartBarIcon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="kpi-value">{formatGTQ(promedioMensualTotal)}</div>
          <span className="text-xs text-[var(--text-muted)]">Gasto mensual promedio</span>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Gasto Mayor</span>
            <ExclamationTriangleIcon className="w-4 h-4 text-[var(--danger)]" />
          </div>
          <div className="kpi-value text-[var(--danger)]">{categoriaMayorGasto.nombre}</div>
          <span className="text-xs text-[var(--text-muted)]">
            {formatGTQ(categoriaMayorGasto.total6meses)} en 6M
          </span>
        </div>

        <div className="kpi-card card-hover">
          <div className="flex items-center justify-between mb-2">
            <span className="kpi-label">Proyección 3M</span>
            <SparklesIcon className="w-4 h-4 text-[var(--accent-orange)]" />
          </div>
          <div className="kpi-value text-[var(--accent-orange)]">{formatGTQ(proyeccion3M)}</div>
          <span className="text-xs text-[var(--text-muted)]">Próximo trimestre</span>
        </div>
      </div>

      {/* ============================================
          ALERTAS DE GASTOS ELEVADOS
      ============================================ */}
      {alertasGastos.length > 0 && (
        <div className="card border-l-4 border-l-[var(--danger)]">
          <div className="section-header">
            <ExclamationTriangleIcon className="w-5 h-5 text-[var(--danger)]" />
            <h2 className="font-semibold text-[var(--danger)]">⚠️ Alertas de Gastos Elevados</h2>
            <span className="ml-auto badge-danger text-[10px]">{alertasGastos.length} categorías</span>
          </div>
          <div className="p-5 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {alertasGastos.map((gasto) => (
                <div key={gasto.id} className="p-4 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)]/20">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--danger)] uppercase">{gasto.nombre}</span>
                    <span className="badge-danger text-[10px]">+{gasto.tendencia.toFixed(1)}%</span>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2">{gasto.descripcion}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">Último mes: <b>{formatGTQ(gasto.ultimoMes)}</b></span>
                    <span className="text-xs font-mono text-[var(--danger)] font-medium">
                      +{formatGTQ(gasto.ultimoMes - gasto.historial[0])}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          FILTRO POR CATEGORÍA
      ============================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCategoriaSeleccionada('todas')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              categoriaSeleccionada === 'todas'
                ? 'bg-[#001639] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-strong)]'
            }`}
          >
            Todas
          </button>
          {datosGastos.map(gasto => (
            <button
              key={gasto.id}
              onClick={() => setCategoriaSeleccionada(gasto.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                categoriaSeleccionada === gasto.id
                  ? 'bg-[#001639] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-strong)]'
              }`}
            >
              {gasto.nombre}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarSoloAltos(!mostrarSoloAltos)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              mostrarSoloAltos
                ? 'bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--danger)]/30'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-strong)]'
            }`}
          >
            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
            Solo aumentos
          </button>
          <button
            onClick={() => setVistaExpandida(!vistaExpandida)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-strong)] transition-all"
          >
            {vistaExpandida ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
            {vistaExpandida ? 'Compactar' : 'Expandir'}
          </button>
        </div>
      </div>

      {/* ============================================
          ANÁLISIS POR CATEGORÍA: HISTÓRICO
      ============================================ */}
      <div className="card">
        <div className="section-header">
          <ChartBarIcon className="w-5 h-5 text-[var(--accent-blue)]" />
          <h2 className="font-semibold">Análisis de Gastos por Categoría</h2>
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            Histórico 6 meses
          </span>
        </div>
        
        <div className={`p-5 pt-0 grid gap-4 ${vistaExpandida ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
          {categoriasFiltradas.map((gasto) => {
            const Icono = gasto.icono
            return (
              <div key={gasto.id} className="p-4 bg-[var(--bg-secondary)] rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: gasto.color + '20' }}>
                      <Icono className="w-4 h-4" style={{ color: gasto.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{gasto.nombre}</h3>
                      <p className="text-xs text-[var(--text-muted)]">{gasto.proveedorPrincipal}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`badge text-[10px] ${getTendenciaStyles(gasto.tendencia)}`}>
                      {gasto.tendencia > 0 ? '+' : ''}{gasto.tendencia.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                {/* Gráfica mini */}
                <BarraGastos
                  historial={gasto.historial}
                  color={gasto.color}
                />
                
                {/* Labels */}
                <div className="flex gap-1 mt-1 mb-3">
                  {MESES_HISTORIAL.map((m, i) => (
                    <div key={i} className="flex-1 text-center">
                      <span className="text-[9px] text-[var(--text-muted)]">{m.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
                
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white rounded">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase">Total 6M</p>
                    <p className="text-sm font-bold font-mono">{formatGTQ(gasto.total6meses)}</p>
                  </div>
                  <div className="p-2 bg-white rounded">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase">Prom. Mensual</p>
                    <p className="text-sm font-bold font-mono">{formatGTQ(gasto.promedioMensual)}</p>
                  </div>
                  <div className="p-2 bg-white rounded">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase">Tendencia</p>
                    <p className={`text-sm font-bold font-mono ${gasto.tendencia > 5 ? 'text-[var(--danger)]' : gasto.tendencia < -5 ? 'text-[var(--success)]' : 'text-[var(--text-primary)]'}`}>
                      {gasto.tendencia > 0 ? '+' : ''}{gasto.tendencia.toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                {/* % del total */}
                <div className="mt-3 p-2 bg-white rounded">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[var(--text-muted)]">% del total de gastos</span>
                    <span className="font-mono font-medium">
                      {((gasto.total6meses / totalGastos6M) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(gasto.total6meses / totalGastos6M) * 100}%`,
                        backgroundColor: gasto.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ============================================
          TABLA DE GASTOS DETALLADA
      ============================================ */}
      <div className="card">
        <div className="section-header">
          <CalculatorIcon className="w-5 h-5 text-[var(--accent-orange)]" />
          <h2 className="font-semibold">Detalle de Gastos por Categoría</h2>
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            <SparklesIcon className="w-3.5 h-3.5 inline mr-1" />
            Último mes vs promedio
          </span>
        </div>
        
        <div className="table-container mx-5 mb-5">
          <table className="table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th className="text-right">Último Mes</th>
                <th className="text-right">Prom. Mensual</th>
                <th className="text-right">Total 6M</th>
                <th className="text-right">% del Total</th>
                <th className="text-center">Tendencia</th>
                <th>Proveedor</th>
                <th className="text-center">Frecuencia</th>
              </tr>
            </thead>
            <tbody>
              {categoriasFiltradas.map((gasto) => (
                <tr key={gasto.id} className={gasto.tendencia > 10 ? 'bg-red-50/50' : ''}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: gasto.color }} />
                      <div>
                        <p className="font-medium text-sm">{gasto.nombre}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{gasto.descripcion.slice(0, 40)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right font-mono text-sm">{formatGTQ(gasto.ultimoMes)}</td>
                  <td className="text-right font-mono text-sm">{formatGTQ(gasto.promedioMensual)}</td>
                  <td className="text-right font-mono text-sm">{formatGTQ(gasto.total6meses)}</td>
                  <td className="text-right font-mono text-sm">
                    {((gasto.total6meses / totalGastos6M) * 100).toFixed(1)}%
                  </td>
                  <td className="text-center">
                    <span className={`badge text-[10px] ${getTendenciaStyles(gasto.tendencia)}`}>
                      {gasto.tendencia > 0 ? '+' : ''}{gasto.tendencia.toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <span className="text-xs text-[var(--text-secondary)]">{gasto.proveedorPrincipal}</span>
                  </td>
                  <td className="text-center">
                    <span className="badge-neutral text-[10px] capitalize">{gasto.frecuencia}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Resumen consolidado */}
        <div className="px-5 pb-5">
          <div className="p-4 bg-[var(--accent-orange-subtle)] rounded-lg border border-[var(--accent-orange)]/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <CalculatorIcon className="w-5 h-5 text-[var(--accent-orange)]" />
                <div>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">Gasto Total del Período</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {categoriasFiltradas.length} categorías activas
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-[var(--text-muted)]">Último Mes</p>
                  <p className="text-lg font-bold font-mono text-[var(--accent-orange)]">
                    {formatGTQ(totalGastosUltimoMes)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--text-muted)]">Total 6 Meses</p>
                  <p className="text-xl font-bold font-mono text-[var(--accent-orange)]">
                    {formatGTQ(totalGastos6M)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================
          PRODUCTOS OFRECIDOS (THERMOPLÁSTICA)
      ============================================ */}
      <div className="card">
        <div className="section-header">
          <InformationCircleIcon className="w-5 h-5 text-[var(--accent-blue)]" />
          <h2 className="font-semibold">Productos Ofrecidos por Thermoplástica</h2>
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            Ingresos por línea de servicio
          </span>
        </div>
        <div className="p-5 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {datosServicios.map((servicio) => (
            <div key={servicio.id} className="p-4 bg-[var(--bg-secondary)] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{servicio.nombre}</span>
                <span className="badge text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  {servicio.clientes} clientes
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-2">{servicio.descripcion}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Precio base:</span>
                  <span className="font-mono">Q{servicio.precioBase}/{servicio.unidad}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Volumen mensual:</span>
                  <span className="font-mono">{formatNum(servicio.volumenMensual)} {servicio.unidad}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Ingreso mensual:</span>
                  <span className="font-mono font-semibold text-[var(--success)]">
                    {formatGTQ(servicio.ingresoMensual)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Participación:</span>
                  <span className="font-mono">{servicio.participacion.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================
          LEYENDA
      ============================================ */}
      <div className="px-5 pb-5">
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
            <span>Aumento {'>'} 10% (revisar)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-orange-100 border border-orange-300" />
            <span>Aumento {'>'} 5% (monitorear)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
            <span>Estable o a la baja</span>
          </div>
          <div className="flex items-center gap-1.5">
            <InformationCircleIcon className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Datos basados en histórico de 6 meses</span>
          </div>
        </div>
      </div>
    </div>
  )
}
