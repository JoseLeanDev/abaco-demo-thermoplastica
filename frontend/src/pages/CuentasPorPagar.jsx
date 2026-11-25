import { useRef, useState } from 'react'
import { useQuery } from 'react-query'
import { Link, useNavigate } from 'react-router-dom'
import { endpoints } from '../services/cfoApi'
import { usePeriodo } from '../context/PeriodoContext'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'
import { Leyenda } from '../components/common/leyendas'
import ThOrden from '../components/common/ThOrden'
import {
  ArrowTrendingDownIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  BuildingOfficeIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  UserGroupIcon,
  ChartBarIcon,
  InformationCircleIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { exportarExcel, traerTodo } from '../services/excel'
import { dec2 } from '../components/analisis/formato'

const fmtQ = (n) => `Q${(Number(n) || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })}`
const fmtM = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return fmtQ(v)
}
const fmtDate = (d) => {
  if (!d) return '—'
  return String(d).slice(0, 10)
}
// Montos en la moneda indicada (Q, US$ o EU). Con filtro de moneda el backend ya los manda en esa moneda.
const SIMBOLO = { Q: 'Q', 'US$': 'US$', EU: '€' }
const fmtMon = (n, m) => (m && m !== 'Q'
  ? `${SIMBOLO[m] || m}${(Number(n) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : fmtQ(n))
const fmtMonM = (n, m) => {
  if (!m || m === 'Q') return fmtM(n)
  const v = Number(n) || 0, sym = SIMBOLO[m] || m
  if (Math.abs(v) >= 1e6) return `${sym}${(v / 1e6).toFixed(2)}M`
  if (Math.abs(v) >= 1e3) return `${sym}${(v / 1e3).toFixed(1)}k`
  return fmtMon(v, m)
}
const NOMBRE_MONEDA = { Q: 'quetzales (Q)', 'US$': 'dólares (US$)', EU: 'euros (€)' }
const MONEDAS = [
  { id: '',    label: 'Todas' },
  { id: 'Q',   label: 'Quetzales' },
  { id: 'US$', label: 'Dólares' },
  { id: 'EU',  label: 'Euros' },
]
// Etiqueta de moneda extranjera junto al documento o proveedor
const ChipMoneda = ({ m }) => (m && m !== 'Q'
  ? <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--info-bg)] text-[var(--info)] align-middle">{m === 'mixta' ? 'Q + ext.' : m === 'EU' ? '€' : m}</span>
  : null)

// Nombre del proveedor que abre su ficha
const NombreProveedor = ({ id, nombre, className = 'max-w-[240px]' }) => (
  <Link
    to={`/tesoreria/cuentas-por-pagar/proveedor/${id}`}
    onClick={(e) => e.stopPropagation()}
    title="Ver ficha del proveedor"
    className={`block font-medium truncate hover:underline hover:text-[var(--accent-blue)] ${className}`}
  >
    {nombre}
  </Link>
)

const badgeForDias = (dias) => {
  if (dias <= 0)  return { label: 'Vigente',        color: 'badge-success', icon: CheckCircleIcon }
  if (dias <= 30) return { label: `${dias}d`,       color: 'badge-warning', icon: ClockIcon }
  if (dias <= 60) return { label: `${dias}d`,       color: 'badge-warning', icon: ExclamationCircleIcon }
  return                { label: `${dias}d`,       color: 'badge-danger',  icon: ExclamationCircleIcon }
}

// Filtros de la vista por proveedor
const FILTROS_PROV = [
  { id: 'todos',     label: 'Todos los proveedores', f: () => true },
  { id: 'saldo',     label: 'Con saldo',             f: r => r.saldo > 0 },
  { id: 'vencido',   label: 'Con saldo vencido',     f: r => r.vencido > 0 },
  { id: 'sin_saldo', label: 'Sin saldo',             f: r => !(r.saldo > 0) },
  { id: 'compras',   label: 'Con compras en el período', f: r => r.compras > 0 },
]

// Columnas del Excel
const COLUMNAS_CXP_PROVEEDORES = [
  { label: 'Código', get: r => r.codigo_proveedor },
  { label: 'Proveedor', get: r => r.proveedor },
  { label: 'NIT', get: r => r.nit },
  { label: 'Facturas abiertas', get: r => r.documentos },
  { label: 'Le debemos', get: r => r.saldo.toFixed(2) },
  { label: 'De eso en US$ (en dólares)', get: r => r.saldo_usd.toFixed(2) },
  { label: 'De eso en € (en euros)', get: r => r.saldo_eu.toFixed(2) },
  { label: '% del total', get: r => r.pct_saldo },
  { label: 'Vencido', get: r => r.vencido.toFixed(2) },
  { label: 'Facturas vencidas', get: r => r.documentos_vencidos },
  { label: 'Atraso máximo (días)', get: r => r.atraso_max },
  { label: 'Días de crédito', get: r => r.dias_credito },
  { label: 'Días en que le pagamos', get: r => r.dias_pago },
  { label: '% pagado a tiempo', get: r => r.pct_a_tiempo },
  { label: 'Compras del período (sin IVA)', get: r => r.compras.toFixed(2) },
  { label: 'Compras año anterior (sin IVA)', get: r => r.compras_prev.toFixed(2) },
  { label: 'Última compra', get: r => r.ultima_compra },
]
const COLUMNAS_CXP = [
  { label: 'Código proveedor', get: r => r.codigo_proveedor },
  { label: 'Proveedor', get: r => r.proveedor },
  { label: 'NIT', get: r => r.rif },
  { label: 'Sucursal', get: r => r.sucursal || r.codigo_sucursal },
  { label: 'Número interno', get: r => r.numero_interno },
  { label: 'Factura proveedor', get: r => r.factura_proveedor },
  { label: 'Emisión', get: r => r.fecha_emision && String(r.fecha_emision).slice(0, 10) },
  { label: 'Vencimiento', get: r => r.fecha_vencimiento && String(r.fecha_vencimiento).slice(0, 10) },
  { label: 'Días de atraso', get: r => r.dias_atraso },
  { label: 'Valor', get: r => r.valor.toFixed(2) },
  { label: 'Saldo', get: r => r.saldo.toFixed(2) },
  { label: 'Moneda', get: r => r.moneda },
  { label: 'Tasa', get: r => r.tasa },
  { label: 'Valor en moneda de la factura', get: r => r.valor_original !== null ? r.valor_original.toFixed(2) : '' },
  { label: 'Saldo en moneda de la factura', get: r => r.saldo_original !== null ? r.saldo_original.toFixed(2) : '' },
  { label: 'Forma de pago', get: r => r.forma_pago },
  { label: 'Estado', get: r => r.estado },
  { label: 'Último pago', get: r => r.fecha_ultimo_pago && String(r.fecha_ultimo_pago).slice(0, 10) },
]

export default function CuentasPorPagar() {
  const [busqueda, setBusqueda]     = useState('')
  const [bucket, setBucket]         = useState('todos')
  const [proveedorSel, setProveedor] = useState('')
  const [vista, setVista]           = useState('proveedores') // 'proveedores' | 'documentos'
  const [filtroProv, setFiltroProv] = useState('todos')
  const [moneda, setMoneda]         = useState('') // '' = todas (en Q) | 'Q' | 'US$' | 'EU'
  const tablaRef = useRef(null)
  const navigate = useNavigate()
  const irAProveedor = (id) => navigate(`/tesoreria/cuentas-por-pagar/proveedor/${id}`)
  const verVista = (v) => {
    setVista(v)
    tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const { params: periodo } = usePeriodo()
  const conMoneda = moneda ? { moneda } : {}
  const { data: cxpData, isLoading: loadingResumen } = useQuery(
    ['cxp', periodo, moneda], () => endpoints.tesoreria.cxp({ ...periodo, ...conMoneda }), { keepPreviousData: true }
  )

  const [orden, setOrden] = useState({ k: 'saldo', dir: 'desc' })
  const ord = { orden, setOrden }
  const detalleParams = { limit: 500, offset: 0, busqueda, bucket, proveedor: proveedorSel, orden: orden.k, dir: orden.dir, ...periodo, ...conMoneda }
  const { data: detalleData, isLoading: loadingDetalle, isFetching } = useQuery(
    ['cxp-detalle', busqueda, bucket, proveedorSel, orden, periodo, moneda],
    () => endpoints.tesoreria.cxpDetalle(detalleParams),
    { keepPreviousData: true, enabled: vista === 'documentos' }
  )
  const { data: provData, isLoading: loadingProv, isFetching: fetchingProv } = useQuery(
    ['cxp-proveedores', busqueda, periodo, moneda],
    () => endpoints.tesoreria.cxpProveedores({ busqueda, ...periodo, ...conMoneda }),
    { keepPreviousData: true, enabled: vista === 'proveedores' }
  )
  const todosProv = provData?.data?.filas || []
  const proveedores = todosProv.filter(FILTROS_PROV.find(f => f.id === filtroProv).f)

  const resumen       = cxpData?.data || {}
  const distribucion  = resumen.distribucion_aging || {}
  const topProv       = resumen.top_proveedores || []
  const proximos      = resumen.proximos_pagos || []
  const totalFacturas = resumen.facturas || 0
  // Moneda en que vienen los montos del resumen (la del filtro; sin filtro, quetzales)
  const unidad = resumen.moneda || 'Q'
  const f = (n) => fmtMon(n, unidad)
  const fM = (n) => fmtMonM(n, unidad)
  const porMoneda = resumen.por_moneda || []
  const totalQ = porMoneda.reduce((t, m) => t + m.saldo_q, 0)
  // Euros solo si hay facturas abiertas en euros (o ya está elegido)
  const monedasBtn = MONEDAS.filter(m => m.id !== 'EU' || moneda === 'EU' || porMoneda.some(x => x.moneda === 'EU'))

  const filas = detalleData?.data?.filas || []
  const totalFilas   = detalleData?.data?.total_filas || 0
  const sumaFiltrada = detalleData?.data?.suma_saldo || 0
  const sumaOriginal = detalleData?.data?.suma_saldo_original
  const sufijo = moneda ? `_${{ Q: 'q', 'US$': 'usd', EU: 'eur' }[moneda]}` : ''

  // Exporta la vista activa: proveedores (con su filtro) o documentos (búsqueda, antigüedad y proveedor)
  const [exportando, setExportando] = useState(false)
  const exportar = async () => {
    setExportando(true)
    try {
      const corte = periodo.hasta || 'hoy'
      if (vista === 'proveedores') {
        const cols = moneda
          ? COLUMNAS_CXP_PROVEEDORES.filter(c => !c.label.startsWith('De eso'))
              .map(c => ['Le debemos', 'Vencido', 'Compras del período (sin IVA)', 'Compras año anterior (sin IVA)'].includes(c.label) ? { ...c, label: `${c.label} (${moneda})` } : c)
          : COLUMNAS_CXP_PROVEEDORES
        await exportarExcel(`cxp_proveedores${sufijo}_${corte}.xlsx`, cols, proveedores, { hoja: 'Proveedores' })
      } else {
        const docs = await traerTodo(endpoints.tesoreria.cxpDetalle, { busqueda, bucket, proveedor: proveedorSel, orden: orden.k, dir: orden.dir, ...periodo, ...conMoneda })
        await exportarExcel(`cxp_documentos${sufijo}_${corte}.xlsx`, COLUMNAS_CXP, docs, { hoja: 'Por pagar' })
      }
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/tesoreria"
            className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
              <ArrowTrendingDownIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Cuentas por Pagar</h1>
              <p className="text-sm text-[var(--text-muted)]">
                {loadingResumen
                  ? 'Cargando…'
                  : `${totalFacturas.toLocaleString()} facturas abiertas · DPO promedio vencido ${resumen.promedio_dias_pago || 0} días · Crédito promedio pactado ${resumen.dias_credito_promedio || 0} días`}
              </p>
              <PeriodoActivo nota="saldos de facturas emitidas en el período" className="mt-1" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">Moneda <Leyenda k="cxp_moneda" /></span>
            <div className="flex rounded-lg border border-[var(--border-default)] overflow-hidden">
              {monedasBtn.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMoneda(m.id)}
                  className={`px-3 py-1.5 text-sm font-medium ${moneda === m.id ? 'bg-[#001639] text-white' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}
                >{m.label}</button>
              ))}
            </div>
          </div>
          <button onClick={exportar} disabled={exportando} className="btn-secondary flex items-center gap-2 disabled:opacity-60">
            <ArrowDownTrayIcon className="w-4 h-4" />
            {exportando ? 'Exportando…' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <span className="kpi-label flex items-center gap-1">Total por Pagar <Leyenda k="cxp_total" /></span>
          <p className="kpi-value">{f(resumen.total_cxp)}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {totalFacturas.toLocaleString()} facturas · {resumen.proveedores || 0} proveedores
            {unidad !== 'Q' && <> · ≈ {fmtQ(resumen.total_q)}</>}
          </p>
        </div>

        <div className="kpi-card card-hover">
          <span className="kpi-label flex items-center gap-1">Por Vencer <Leyenda k="por_vencer" /></span>
          <p className="kpi-value text-[var(--success)]">{f(distribucion.por_vencer?.monto)}</p>
          <p className="text-xs text-[var(--success)] mt-1">{distribucion.por_vencer?.porcentaje || 0}%</p>
        </div>

        <div className="kpi-card card-hover">
          <span className="kpi-label flex items-center gap-1">1-30 días vencido <Leyenda k="dias_vencido" /></span>
          <p className="kpi-value text-[var(--warning)]">{f(distribucion.v_1_30?.monto)}</p>
          <p className="text-xs text-[var(--warning)] mt-1">{distribucion.v_1_30?.porcentaje || 0}%</p>
        </div>

        <div className="kpi-card card-hover">
          <span className="kpi-label flex items-center gap-1">+60 días (riesgo) <Leyenda k="cxc_riesgo" /></span>
          <p className="kpi-value text-[var(--danger)]">{f((distribucion.v_61_90?.monto || 0) + (distribucion.v_90_mas?.monto || 0))}</p>
          <p className="text-xs text-[var(--danger)] mt-1">Atención requerida</p>
        </div>
      </div>

      {/* Desglose por moneda: clic para filtrar */}
      {!moneda && porMoneda.length > 1 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${porMoneda.length > 2 ? 'lg:grid-cols-3' : ''} gap-4`}>
          {porMoneda.map(m => (
            <button
              key={m.moneda}
              onClick={() => setMoneda(m.moneda)}
              className="card card-hover p-4 text-left flex items-start justify-between gap-4"
              title={`Ver solo facturas en ${NOMBRE_MONEDA[m.moneda] || m.moneda}`}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Facturas en {NOMBRE_MONEDA[m.moneda] || m.moneda}
                </p>
                <p className="text-xl font-semibold tabular-nums mt-1">{fmtMon(m.saldo_original, m.moneda)}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
                  {m.moneda !== 'Q' && <>≈ {fmtQ(m.saldo_q)} · </>}
                  {m.documentos.toLocaleString()} facturas · {m.proveedores.toLocaleString()} proveedores
                </p>
                {m.vencido_original > 0 && (
                  <p className="text-xs text-[var(--danger)] mt-0.5 tabular-nums">Vencido {fmtMon(m.vencido_original, m.moneda)}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-semibold tabular-nums text-[var(--text-secondary)]">
                  {totalQ > 0 ? Math.round(m.saldo_q / totalQ * 100) : 0}%
                </p>
                <p className="text-xs text-[var(--text-muted)]">del total en Q</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Aging */}
      <div className="card">
        <div className="section-header">
          <ChartBarIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Distribución por Antigüedad (vs fecha de vencimiento real)</h2>
          <Leyenda k="aging_cxp" />
          {moneda && <span className="text-xs text-[var(--text-muted)] ml-1">· solo facturas en {NOMBRE_MONEDA[moneda]}{moneda !== 'Q' ? `, montos en ${moneda === 'EU' ? '€' : moneda}` : ''}</span>}
        </div>
        <div className="p-5 pt-0 space-y-4">
          {[
            { key: 'por_vencer', label: 'Por vencer',            color: 'bg-emerald-500' },
            { key: 'v_1_30',     label: '1-30 días vencido',     color: 'bg-amber-500' },
            { key: 'v_31_60',    label: '31-60 días vencido',    color: 'bg-orange-500' },
            { key: 'v_61_90',    label: '61-90 días vencido',    color: 'bg-rose-500' },
            { key: 'v_90_mas',   label: '90+ días vencido',      color: 'bg-red-600' }
          ].map(r => {
            const val = distribucion[r.key]
            return (
              <div key={r.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">{r.label}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {f(val?.monto)} ({val?.porcentaje || 0}%)
                  </span>
                </div>
                <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.color} transition-all duration-700`}
                    style={{ width: `${val?.porcentaje || 0}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top proveedores + Próximos pagos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="section-header">
            <BuildingOfficeIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Top proveedores con saldo</h2>
          <Leyenda k="top_proveedores_cxp" />
          </div>
          <div className="p-5 pt-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--text-muted)] uppercase">
                  <th className="text-left  font-semibold pb-2">Proveedor</th>
                  <th className="text-right font-semibold pb-2">Facturas</th>
                  <th className="text-right font-semibold pb-2">Crédito <Leyenda k="dias_credito" /></th>
                  <th className="text-right font-semibold pb-2">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {topProv.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-sm text-[var(--text-muted)]">Cargando…</td></tr>
                )}
                {topProv.map((p) => (
                  <tr
                    key={p.codigo}
                    className={`text-sm hover:bg-[var(--bg-secondary)] cursor-pointer ${proveedorSel === p.codigo ? 'bg-[var(--bg-secondary)]' : ''}`}
                    onClick={() => {
                      setProveedor(p.codigo === proveedorSel ? '' : p.codigo)
                      verVista('documentos')
                    }}
                  >
                    <td className="py-2 pr-2">
                      <NombreProveedor id={p.proveedor_id} nombre={p.proveedor} />
                      <p className="text-xs text-[var(--text-muted)]">
                        {p.codigo}
                        {!moneda && <ChipMoneda m={p.moneda} />}
                        {p.facturas_vencidas > 0 && (
                          <span className="ml-1 text-[var(--danger)]">· {p.facturas_vencidas} vencidas</span>
                        )}
                      </p>
                    </td>
                    <td className="py-2 text-right tabular-nums">{p.facturas}</td>
                    <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
                      {p.dias_credito > 0 ? `${p.dias_credito}d` : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fM(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-[var(--text-muted)]">Clic en la fila muestra sus facturas abajo; clic en el nombre abre la ficha del proveedor.</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <button
                onClick={() => verVista('proveedores')}
                className="text-xs font-medium text-[var(--accent-blue)] hover:underline flex items-center gap-0.5"
              >
                Ver todos los proveedores <ChevronRightIcon className="w-3 h-3" />
              </button>
              {proveedorSel && (
                <button
                  onClick={() => setProveedor('')}
                  className="text-xs text-[var(--accent-blue)] hover:underline"
                >
                  Limpiar filtro de proveedor
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <ClockIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Próximos pagos (30 días)</h2>
          <Leyenda k="proximos_pagos" />
          </div>
          <div className="p-5 pt-0 overflow-x-auto">
            {proximos.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4 text-center">Sin pagos previstos en los próximos 30 días.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-[var(--text-muted)] uppercase">
                    <th className="text-left  font-semibold pb-2">Vence</th>
                    <th className="text-left  font-semibold pb-2">Proveedor</th>
                    <th className="text-right font-semibold pb-2">Días <Leyenda k="dias_restantes" /></th>
                    <th className="text-right font-semibold pb-2">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {proximos.slice(0, 12).map((p, i) => (
                    <tr key={`${p.numero_interno}-${i}`} className="text-sm hover:bg-[var(--bg-secondary)]">
                      <td className="py-2 pr-2 tabular-nums text-[var(--text-secondary)]">{fmtDate(p.fecha_vencimiento)}</td>
                      <td className="py-2 pr-2">
                        <NombreProveedor id={p.proveedor_id} nombre={p.proveedor} className="max-w-[220px]" />
                        <p className="text-xs text-[var(--text-muted)]">#{p.numero_interno}{!moneda && <ChipMoneda m={p.moneda} />}</p>
                      </td>
                      <td className={`py-2 text-right tabular-nums font-semibold ${
                        p.dias_restantes <= 7 ? 'text-[var(--danger)]' : p.dias_restantes <= 15 ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'
                      }`}>{p.dias_restantes}d</td>
                      <td className="py-2 text-right tabular-nums font-semibold">
                        {fM(p.monto)}
                        {!moneda && p.moneda !== 'Q' && p.monto_original !== null && (
                          <p className="text-xs font-normal text-[var(--text-muted)]">{fmtMonM(p.monto_original, p.moneda)}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div ref={tablaRef} className="flex flex-col sm:flex-row gap-4 scroll-mt-4">
        <div className="flex rounded-lg border border-[var(--border-default)] overflow-hidden shrink-0 self-start sm:self-auto">
          {[{ id: 'proveedores', label: 'Por proveedor' }, { id: 'documentos', label: 'Por factura' }].map(v => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`px-4 py-2 text-sm font-medium ${vista === v.id ? 'bg-[#001639] text-white' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}
            >{v.label}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={vista === 'proveedores' ? 'Buscar por proveedor, código, NIT o número de factura…' : 'Buscar por proveedor, código o número de factura…'}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input w-full pl-12"
          />
        </div>
        {vista === 'proveedores' && <select
          value={filtroProv}
          onChange={(e) => setFiltroProv(e.target.value)}
          className="input sm:w-auto shrink-0"
        >
          {FILTROS_PROV.map(f => (
            <option key={f.id} value={f.id}>{f.label} ({todosProv.filter(f.f).length})</option>
          ))}
        </select>}
        {vista === 'documentos' && <select
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          className="input sm:w-auto sm:min-w-[200px] shrink-0"
        >
          <option value="todos">Todos los buckets</option>
          <option value="por_vencer">Por vencer</option>
          <option value="v_1_30">1-30 días vencido</option>
          <option value="v_31_60">31-60 días vencido</option>
          <option value="v_61_90">61-90 días vencido</option>
          <option value="v_90_mas">90+ días vencido</option>
        </select>}
      </div>

      {vista === 'proveedores' && (
        <TablaProveedores
          filas={proveedores}
          cargando={loadingProv}
          actualizando={fetchingProv && !loadingProv}
          onClick={irAProveedor}
          moneda={provData?.data?.moneda || null}
        />
      )}

      {/* Tabla detalle */}
      {vista === 'documentos' && <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">
              {loadingDetalle ? 'Cargando…' : `${filas.length.toLocaleString()} de ${totalFilas.toLocaleString()} facturas`}
              {isFetching && !loadingDetalle && ' · actualizando…'}
            </span>
            {proveedorSel && (
              <button
                onClick={() => setProveedor('')}
                title="Quitar filtro de proveedor"
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Proveedor {proveedorSel} ✕
              </button>
            )}
          </div>
          <span className="text-sm font-semibold">
            Total filtrado: {moneda && moneda !== 'Q' && sumaOriginal !== null && sumaOriginal !== undefined
              ? <>{fmtMon(sumaOriginal, moneda)} <span className="font-normal text-[var(--text-muted)]">≈ {fmtQ(sumaFiltrada)}</span></>
              : fmtQ(sumaFiltrada)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr>
                <ThOrden k="proveedor" texto {...ord}>Proveedor</ThOrden>
                <ThOrden k="factura" {...ord}>Factura</ThOrden>
                <ThOrden k="emision" {...ord}>Emisión</ThOrden>
                <ThOrden k="vencimiento" {...ord}>Vencimiento</ThOrden>
                <ThOrden k="credito" align="center" {...ord}>Crédito <Leyenda k="credito_ficha_factura" /><br /><span className="normal-case font-normal">ficha · factura</span></ThOrden>
                <ThOrden k="saldo" align="right" {...ord}>Saldo</ThOrden>
                <ThOrden k="estado" texto align="center" {...ord}>Estado</ThOrden>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {loadingDetalle && filas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    Cargando facturas desde el ERP…
                  </td>
                </tr>
              )}
              {!loadingDetalle && filas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    No hay facturas que coincidan con el filtro.
                  </td>
                </tr>
              )}
              {filas.map(row => {
                const badge = badgeForDias(row.dias_atraso)
                const BadgeIcon = badge.icon
                const desviacion = row.dias_segun_facturas - row.dias_credito_ficha
                return (
                  <tr key={row.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                          <BuildingOfficeIcon className="w-4 h-4 text-[var(--text-muted)]" />
                        </div>
                        <div className="min-w-0">
                          <NombreProveedor id={row.proveedor_id} nombre={row.proveedor} />
                          <p className="text-xs text-[var(--text-muted)]">
                            {row.codigo_proveedor}
                            {row.sucursal && ` · ${row.sucursal}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">#{row.numero_interno}<ChipMoneda m={row.moneda} /></p>
                      {row.factura_proveedor && (
                        <p className="text-xs text-[var(--text-muted)]">Prov: {row.factura_proveedor}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[var(--text-secondary)] tabular-nums">{fmtDate(row.fecha_emision)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[var(--text-secondary)] tabular-nums">{fmtDate(row.fecha_vencimiento)}</p>
                      {row.dias_atraso > 0 && (
                        <p className="text-xs text-[var(--danger)] tabular-nums">{row.dias_atraso}d atraso</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <p className="text-sm tabular-nums">
                        <span className="text-[var(--text-muted)]">{row.dias_credito_ficha}d</span>
                        <span className="mx-1 text-[var(--text-muted)]">·</span>
                        <span className={`font-semibold ${
                          desviacion > 5 ? 'text-[var(--warning)]' :
                          desviacion < -5 ? 'text-[var(--success)]' : ''
                        }`}>{row.dias_segun_facturas}d</span>
                      </p>
                      {Math.abs(desviacion) > 5 && (
                        <p className={`text-xs tabular-nums ${desviacion > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
                          {desviacion > 0 ? '+' : ''}{desviacion}d
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.moneda !== 'Q' && row.saldo_original !== null ? <>
                        <span className="font-bold tabular-nums">{fmtMon(row.saldo_original, row.moneda)}</span>
                        <p className="text-xs text-[var(--text-muted)] tabular-nums">≈ {fmtQ(row.saldo)}{row.tasa ? ` · tasa ${row.tasa.toFixed(4)}` : ''}</p>
                        {row.valor_original !== null && Math.abs(row.valor_original - row.saldo_original) >= 0.01 && (
                          <p className="text-xs text-[var(--text-muted)] tabular-nums">Valor: {fmtMonM(row.valor_original, row.moneda)}</p>
                        )}
                      </> : <>
                        <span className="font-bold tabular-nums">{fmtQ(row.saldo)}</span>
                        {row.valor && row.valor !== row.saldo && (
                          <p className="text-xs text-[var(--text-muted)] tabular-nums">Valor: {fmtM(row.valor)}</p>
                        )}
                      </>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 ${badge.color}`}>
                        <BadgeIcon className="w-3.5 h-3.5" />
                        {row.estado || badge.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Nota metodológica */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 flex items-start gap-3">
        <InformationCircleIcon className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
          <p>
            Fuente: <code>vstAnalisisCxP</code> del ERP. La fecha de vencimiento es la real acordada con cada proveedor.
            Cada factura está en quetzales, dólares o euros; sin filtro de moneda los montos se suman en Q con la tasa de cada factura.
            La columna <em>Crédito</em> muestra días según ficha del proveedor · días efectivamente otorgados en la factura;
            las desviaciones {'>'} 5 días se marcan en color. Sincronización diaria via n8n.
          </p>
        </div>
      </div>
    </div>
  )
}

// Todos los proveedores con su resumen (mismas cifras que la ficha); cada fila abre la ficha
function TablaProveedores({ filas, cargando, actualizando, onClick, moneda }) {
  const fmt = (n) => fmtMon(n, moneda)
  const fmtC = (n) => fmtMonM(n, moneda)
  const [orden, setOrden] = useState({ k: 'saldo', dir: -1 })
  // Los vacíos (sin pagos o sin compras) siempre al final
  const ordenadas = [...filas].sort((a, b) => {
    const x = a[orden.k], y = b[orden.k]
    if (x === null || x === undefined) return (y === null || y === undefined) ? 0 : 1
    if (y === null || y === undefined) return -1
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * orden.dir
  })
  const conSaldo = filas.filter(r => r.saldo > 0).length
  const total = filas.reduce((t, r) => t + r.saldo, 0)
  const Th = ({ k, children, align = 'right', leyenda }) => (
    <th
      onClick={() => setOrden(o => ({ k, dir: o.k === k ? -o.dir : (align === 'left' ? 1 : -1) }))}
      className={`px-4 py-3 text-${align} text-xs font-semibold text-[var(--text-muted)] uppercase cursor-pointer select-none whitespace-nowrap hover:text-[var(--text-secondary)]`}
    >
      {children}{orden.k === k ? (orden.dir < 0 ? ' ↓' : ' ↑') : ''} {leyenda && <Leyenda k={leyenda} />}
    </th>
  )
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between gap-2 flex-wrap bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-muted)]">
            {cargando ? 'Cargando…' : `${filas.length.toLocaleString()} proveedores · ${conSaldo.toLocaleString()} con saldo · clic para ver su ficha`}
            {actualizando && ' · actualizando…'}
          </span>
          <Leyenda k="cxp_por_proveedor" />
        </div>
        <span className="text-sm font-semibold">Le debemos: {fmt(total)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
            <tr>
              <Th k="proveedor" align="left">Proveedor</Th>
              <Th k="saldo" leyenda="saldo_proveedor">Le debemos</Th>
              <Th k="vencido" leyenda="dias_vencido">Vencido</Th>
              <Th k="atraso_max">Atraso máx.</Th>
              <Th k="dias_credito" leyenda="dias_credito">Crédito</Th>
              <Th k="dias_pago" leyenda="dias_pago_proveedor">Le pagamos en</Th>
              <Th k="pct_a_tiempo" leyenda="pct_a_tiempo_prov">A tiempo</Th>
              <Th k="compras" leyenda="compras_proveedor">Compras</Th>
              <Th k="ultima_compra">Última compra</Th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {cargando && filas.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Cargando proveedores…</td></tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">No hay proveedores que coincidan.</td></tr>
            )}
            {ordenadas.map(r => {
              const lento = r.dias_pago !== null && r.dias_credito !== null && r.dias_pago > r.dias_credito + 5
              return (
                <tr key={r.proveedor_id} onClick={() => onClick(r.proveedor_id)} className="hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer group">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text-primary)] truncate max-w-[280px] group-hover:underline">{r.proveedor}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {r.codigo_proveedor}
                      {r.documentos > 0 && ` · ${r.documentos} factura${r.documentos === 1 ? '' : 's'} abierta${r.documentos === 1 ? '' : 's'}`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.saldo > 0 ? <>
                      <p className="font-bold tabular-nums">{fmt(r.saldo)}</p>
                      {!moneda && r.saldo_usd > 0 && <p className="text-xs text-[var(--info)] tabular-nums">incluye {fmtMonM(r.saldo_usd, 'US$')}</p>}
                      {!moneda && r.saldo_eu > 0 && <p className="text-xs text-[var(--info)] tabular-nums">incluye {fmtMonM(r.saldo_eu, 'EU')}</p>}
                      <p className="text-xs text-[var(--text-muted)] tabular-nums">{dec2(r.pct_saldo)}% del total</p>
                    </> : <span className="text-sm text-[var(--text-muted)]">—</span>}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums text-sm ${r.vencido > 0 ? 'text-[var(--danger)] font-semibold' : 'text-[var(--text-muted)]'}`}>
                    {r.vencido > 0 ? fmt(r.vencido) : '—'}
                    {r.documentos_vencidos > 0 && <p className="text-xs font-normal">{r.documentos_vencidos} factura{r.documentos_vencidos === 1 ? '' : 's'}</p>}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums text-sm ${r.atraso_max > 60 ? 'text-[var(--danger)] font-semibold' : r.atraso_max > 0 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>
                    {r.atraso_max > 0 ? `${r.atraso_max} d` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm text-[var(--text-secondary)]">{r.dias_credito !== null ? `${r.dias_credito} d` : '—'}</td>
                  <td className={`px-4 py-3 text-right tabular-nums text-sm ${lento ? 'text-[var(--warning)] font-semibold' : 'text-[var(--text-secondary)]'}`}>
                    {r.dias_pago !== null ? `${r.dias_pago} d` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums text-sm ${r.pct_a_tiempo === null ? 'text-[var(--text-muted)]' : r.pct_a_tiempo >= 80 ? 'text-[var(--success)]' : r.pct_a_tiempo >= 50 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}`}>
                    {r.pct_a_tiempo !== null ? `${dec2(r.pct_a_tiempo)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm">
                    {r.compras > 0 ? fmtC(r.compras) : <span className="text-[var(--text-muted)]">—</span>}
                    {r.variacion_compras_pct !== null && (
                      <p className="text-xs text-[var(--text-muted)]">{r.variacion_compras_pct > 0 ? '+' : ''}{r.variacion_compras_pct.toFixed(1)}% vs año ant.</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm text-[var(--text-secondary)] whitespace-nowrap">{fmtDate(r.ultima_compra)}</td>
                  <td className="pr-3"><ChevronRightIcon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
