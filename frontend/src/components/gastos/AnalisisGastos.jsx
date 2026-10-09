import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathRoundedSquareIcon,
  ArrowTopRightOnSquareIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ChartPieIcon,
  LightBulbIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  ReceiptPercentIcon,
  ScaleIcon,
  Squares2X2Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { usePeriodo } from '../../context/PeriodoContext'
import { endpoints } from '../../services/cfoApi'
import { PeriodoActivo } from '../common/FiltroPeriodo'
import { Leyenda } from '../common/leyendas'
import PageInsights from '../agents/PageInsights'
import {
  Cargando, Delta, Kpi, Seccion, Th, exportarCSV, fmtFecha, fmtInt, fmtM, fmtMes, fmtQ, ordenar, td, th, tooltipStyle,
} from '../compras/comun'

/**
 * Análisis de gastos operativos: lo usan la página de Gastos Operativos (todos los
 * centros de costo, con el centro como filtro) y la subpágina de Administración
 * (centro fijo). Ver GET /api/gastos/analisis.
 *
 * En el ERP cada gasto es un artículo de "Gastos de Operación" cuyo nombre es el
 * concepto contable y cuyo código trae centro de costo + cuenta. Los conceptos se
 * agrupan por cuenta (iguales entre centros) y en rubros (agrupación propia).
 */

export const COLORES = {
  instalaciones: '#001639',
  servicios: '#3b82f6',
  logistica: '#ef4444',
  movilidad: '#f59e0b',
  personal: '#10b981',
  seguros: '#8b5cf6',
  oficina: '#06b6d4',
  otros: '#94a3b8',
}
const COLORES_CENTRO = ['#001639', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#94a3b8']

// Páginas propias de un centro de costo
const PAGINAS_CENTRO = { 'Administración': '/gastos-operativos/administracion' }

export default function AnalisisGastos({ centroFijo = null, titulo, icono: Icono, volver = '/', vertical }) {
  const { params: periodo } = usePeriodo()
  const [centroSel, setCentroSel] = useState('')
  const [rubro, setRubro] = useState('')
  const [proveedor, setProveedor] = useState(null) // { codigo, nombre }
  const [concepto, setConcepto] = useState(null)   // cuenta abierta en el panel
  const [exportando, setExportando] = useState(false)

  const centro = centroFijo || centroSel
  const general = !centroFijo
  const filtros = {
    ...periodo,
    ...(centro ? { centro } : {}),
    ...(rubro ? { rubro } : {}),
    ...(proveedor ? { proveedor: proveedor.codigo } : {}),
  }
  const clave = JSON.stringify(filtros)
  const { data, isLoading, isPreviousData } = useQuery(
    ['gastos-analisis', clave],
    () => endpoints.gastos.analisis(filtros),
    { keepPreviousData: true }
  )
  const d = data?.data
  const cargando = isLoading || isPreviousData

  const filtrosDetalle = {
    ...periodo,
    centro_costo: centro || '',
    rubro: rubro || '',
    codigo_proveedor: proveedor?.codigo || '',
  }
  const exportar = async () => {
    setExportando(true)
    try {
      const res = await endpoints.gastos.detalle({ ...filtrosDetalle, limit: 20000 })
      exportarCSV(`gastos_${(centro || 'operativos').toLowerCase().replace(/\W+/g, '_')}_${periodo.desde}_${periodo.hasta}.csv`, COLUMNAS_LINEAS, res?.data?.filas || [])
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link to={volver} className="w-10 h-10 shrink-0 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors">
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-[#001639] flex items-center justify-center">
              <Icono className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold">{titulo}</h1>
              <p className="text-sm text-[var(--text-muted)]">
                {cargando || !d ? 'Cargando…' : [
                  general && !centro ? `${fmtInt(d.n_centros)} centros de costo` : null,
                  `${fmtInt(d.n_conceptos)} conceptos`,
                  `${fmtInt(d.n_proveedores)} proveedores`,
                  `${fmtInt(d.facturas)} facturas`,
                ].filter(Boolean).join(' · ')}
              </p>
              <PeriodoActivo nota="comparado con el mismo período del año anterior" className="mt-1" />
            </div>
          </div>
        </div>
        <button onClick={exportar} disabled={exportando} className="btn-secondary flex items-center gap-2 disabled:opacity-60">
          <ArrowDownTrayIcon className="w-4 h-4" />
          {exportando ? 'Exportando…' : 'Exportar líneas'}
        </button>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        {general && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className={`relative flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm ${
              centroSel ? 'border-[#001639] bg-[#001639] text-white' : 'border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)]'
            }`}>
              <span className={`text-[10px] uppercase tracking-wide ${centroSel ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>Centro de costo</span>
              <select
                value={centroSel}
                onChange={(e) => setCentroSel(e.target.value)}
                className="bg-transparent outline-none cursor-pointer font-medium appearance-none pr-4 max-w-[14rem]"
              >
                <option value="" className="text-black">Todos</option>
                {(d?.centros_lista || []).map(c => <option key={c} value={c} className="text-black">{c}</option>)}
              </select>
              <span className={`pointer-events-none absolute right-2 text-[10px] ${centroSel ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>▾</span>
            </label>
            <Leyenda k="centros_costo" />
            {centroSel && PAGINAS_CENTRO[centroSel] && (
              <Link to={PAGINAS_CENTRO[centroSel]} className="text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1">
                Abrir página de {centroSel} <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] mr-1">Rubro <Leyenda k="rubro_admin" /></span>
          {[{ id: '', label: 'Todos' }, ...(d?.rubros_def || [])].map(r => {
            const activo = rubro === r.id
            return (
              <button
                key={r.id || 'todos'}
                onClick={() => setRubro(r.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  activo ? 'border-[#001639] bg-[#001639] text-white' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                }`}
              >
                {r.id && <span className="w-2 h-2 rounded-full" style={{ background: activo ? '#fff' : COLORES[r.id] }} />}
                {r.label}
              </button>
            )
          })}
          {proveedor && (
            <span className="ml-2 flex items-center gap-1 rounded-lg border border-[#001639] bg-[#001639] text-white px-2.5 py-1 text-xs">
              <span className="uppercase tracking-wide text-white/70 text-[10px]">Proveedor</span>
              <span className="font-medium truncate max-w-[14rem]">{proveedor.nombre}</span>
              <button onClick={() => setProveedor(null)} className="ml-1 text-white/70 hover:text-white" aria-label="Quitar proveedor">
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
        </div>
      </div>

      {!d ? (
        <div className="space-y-4"><Cargando alto="h-28" /><Cargando /><Cargando /></div>
      ) : (
        <div className={`space-y-6 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          <KPIs d={d} general={general && !centro} />
          <Hallazgos d={d} rubro={rubro} proveedor={proveedor} general={general && !centro} onConcepto={setConcepto} />
          {vertical && general && !centro && <PageInsights vertical={vertical} maxInsights={3} />}

          {general && !centro && <Centros d={d} onCentro={setCentroSel} />}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3"><Rubros d={d} rubro={rubro} setRubro={setRubro} /></div>
            <div className="lg:col-span-2"><Dona rubros={d.rubros} /></div>
          </div>

          <SerieMensual d={d} porCentroDisponible={general && !centro} />
          {general && <GastoVsVentas d={d} />}
          <Conceptos d={d} mostrarCentros={general && !centro} onConcepto={setConcepto} />
          <Recurrentes d={d} onConcepto={setConcepto} />
          <Proveedores items={d.proveedores} onProveedor={setProveedor} />
          <Lineas filtros={filtrosDetalle} mostrarCentro={general && !centro} />

          <p className="text-xs text-[var(--text-muted)] italic">
            Fuente: facturas de compra del ERP con artículos de “Gastos de Operación”
            {centro ? ` del centro de costo “${centro}”` : ''}. El concepto es el nombre del artículo de gasto y su código trae
            la cuenta contable (p. ej. 02GOA51106 → 5.1.1.06 Alquileres; el mismo concepto en otro centro tiene otra letra).
            Los rubros son una agrupación de la plataforma para leer los conceptos más fácil.
          </p>
        </div>
      )}

      {concepto && <PanelConcepto cuenta={concepto} filtros={filtros} mostrarCentros={!centro} onClose={() => setConcepto(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------

function KPIs({ d, general }) {
  const fijo = d.recurrentes.filter(r => r.estable).reduce((s, r) => s + r.mensual, 0)
  const deltaVentas = d.pct_ventas !== null && d.pct_ventas_prev !== null ? d.pct_ventas - d.pct_ventas_prev : null
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Kpi
        titulo={general ? 'Gasto operativo' : `Gasto de ${d.centro?.toLowerCase() || 'este filtro'}`}
        leyenda={general ? 'gasto_operativo' : 'gasto_admin'}
        valor={fmtM(d.gasto)}
        sub={<><Delta v={d.variacion_pct} invertir /> vs {fmtM(d.gasto_prev)} año anterior</>}
      />
      {general ? (
        <Kpi
          titulo="Por cada Q100 vendidos"
          leyenda="gasto_vs_ventas"
          valor={d.pct_ventas === null ? '—' : `Q${d.pct_ventas.toFixed(1)}`}
          sub={deltaVentas === null ? `ventas ${fmtM(d.ventas)}` : (
            <>
              <Delta v={deltaVentas} invertir sufijo=" pts" /> vs Q{d.pct_ventas_prev.toFixed(1)} el año anterior
            </>
          )}
        />
      ) : (
        <Kpi
          titulo="Del gasto operativo"
          leyenda="pct_operativo_admin"
          valor={d.pct_del_operativo === null ? '—' : `${d.pct_del_operativo}%`}
          sub={`de ${fmtM(d.gasto_operativo_total)} de gasto operativo total`}
        />
      )}
      <Kpi
        titulo="Promedio mensual"
        leyenda="gasto_mensual_admin"
        valor={fmtM(d.gasto_mensual)}
        sub={`≈ ${fmtM(d.gasto_mensual * 12)} al año a este ritmo`}
      />
      <Kpi
        titulo="Se repite cada mes"
        leyenda="recurrentes_admin"
        valor={<>{fmtM(d.recurrente_mensual)}<span className="text-sm font-medium text-[var(--text-muted)]">/mes</span></>}
        sub={`${d.pct_recurrente ?? 0}% del gasto · ${fmtM(fijo)} son montos fijos`}
      />
    </div>
  )
}

// Frases automáticas con lo más relevante del período
function Hallazgos({ d, rubro, proveedor, general, onConcepto }) {
  const items = []
  if (general && d.centros[0] && d.gasto > 0) {
    const c = d.centros[0]
    items.push(<><strong>{c.centro}</strong> concentra el {c.participacion}% del gasto operativo ({fmtM(c.mensual)}/mes).</>)
  }
  if (general && d.pct_ventas !== null && d.pct_ventas_prev !== null) {
    const sube = d.pct_ventas > d.pct_ventas_prev
    items.push(<>
      El gasto operativo equivale al <strong>{d.pct_ventas}% de las ventas</strong>
      {Math.abs(d.pct_ventas - d.pct_ventas_prev) >= 0.3
        ? <> ({sube ? 'sube' : 'baja'} desde {d.pct_ventas_prev}% el año anterior: el gasto creció {d.variacion_pct > 0 ? '+' : ''}{d.variacion_pct}% y las ventas {varTxt(d.ventas, d.ventas_prev)}).</>
        : <> (igual que el año anterior).</>}
    </>)
  }
  const top = d.rubros[0]
  if (top && !rubro && d.gasto > 0) {
    const cs = d.conceptos.filter(c => c.rubro === top.rubro).slice(0, 2).map(c => c.concepto)
    items.push(<><strong>{top.label}</strong> es el rubro más grande: {top.participacion}% del gasto ({fmtM(top.mensual)}/mes), sobre todo {cs.join(' y ')}.</>)
  }
  const suben = d.conceptos
    .filter(c => c.variacion >= 25000 && c.variacion_pct !== null && c.variacion_pct >= 20)
    .sort((a, b) => b.variacion - a.variacion)
    .slice(0, 3)
  if (suben.length) {
    items.push(<>
      Lo que más subió contra el año anterior:{' '}
      {suben.map((c, i) => (
        <span key={c.codigo}>
          {i > 0 && (i === suben.length - 1 ? ' y ' : ', ')}
          <button onClick={() => onConcepto(c.codigo)} className="font-semibold underline decoration-dotted hover:text-[#001639]">{c.concepto}</button>
          {' '}(+{fmtM(c.variacion)}, {c.variacion_pct > 0 ? '+' : ''}{c.variacion_pct}%)
        </span>
      ))}.
    </>)
  }
  const bajan = d.conceptos.filter(c => c.variacion <= -25000).sort((a, b) => a.variacion - b.variacion).slice(0, 2)
  if (bajan.length) {
    items.push(<>Bajaron: {bajan.map((c, i) => <span key={c.codigo}>{i > 0 && ' y '}<strong>{c.concepto}</strong> (−{fmtM(-c.variacion)})</span>)}.</>)
  }
  const principal = d.recurrentes[0]
  if (principal && !proveedor) {
    items.push(<>
      El cargo fijo más grande es <strong>{principal.concepto}</strong> con <strong>{principal.proveedor}</strong>:{' '}
      {fmtM(principal.mensual)} al mes ({fmtM(principal.anual)} al año).
    </>)
  }
  if (!items.length) return null
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <LightBulbIcon className="w-5 h-5 text-amber-500" />
        <h2 className="font-semibold">Lo más importante</h2>
      </div>
      <ul className="space-y-2 text-sm text-[var(--text-secondary)] list-disc pl-5">
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  )
}
const varTxt = (v, vp) => {
  if (!vp) return 'sin comparación'
  const p = Math.round((v - vp) / vp * 1000) / 10
  return `${p > 0 ? '+' : ''}${p}%`
}

// Centros de costo: barra apilada por rubro + conceptos principales
function Centros({ d, onCentro }) {
  const max = Math.max(...d.centros.map(c => c.gasto), 1)
  return (
    <Seccion icon={Squares2X2Icon} titulo="¿Dónde se gasta?" leyenda="centros_costo" subtitulo="Gasto por centro de costo, dividido por rubro · clic para ver solo ese centro">
      <div className="space-y-4">
        {d.centros.map(c => (
          <div key={c.centro} className="group">
            <div className="flex items-center justify-between gap-3 text-sm">
              <button onClick={() => onCentro(c.centro)} className="font-medium truncate text-left hover:text-[#001639] hover:underline">
                {c.centro}
              </button>
              <span className="flex items-baseline gap-2 whitespace-nowrap">
                {PAGINAS_CENTRO[c.centro] && (
                  <Link to={PAGINAS_CENTRO[c.centro]} className="hidden sm:inline text-xs text-[var(--accent-blue)] hover:underline mr-1">ver detalle →</Link>
                )}
                <span className="font-semibold tabular-nums">{fmtM(c.gasto)}</span>
                <span className="text-xs text-[var(--text-muted)] tabular-nums w-11 text-right">{c.participacion}%</span>
                {c.gasto_prev === 0
                  ? <span className="text-xs text-[var(--text-muted)] w-14 text-right">nuevo</span>
                  : <Delta v={c.variacion_pct} invertir className="text-xs w-14 text-right" />}
              </span>
            </div>
            <button onClick={() => onCentro(c.centro)} className="block w-full mt-1.5" aria-label={`Ver ${c.centro}`}>
              <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div className="h-full flex" style={{ width: `${Math.max((c.gasto / max) * 100, 0.5)}%` }}>
                  {Object.entries(c.rubros)
                    .filter(([, g]) => g > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([r, g]) => (
                      <div key={r} className="h-full" title={`${r}: ${fmtQ(g)}`} style={{ width: `${(g / c.gasto) * 100}%`, background: COLORES[r] }} />
                    ))}
                </div>
              </div>
            </button>
            <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
              {c.conceptos.map(x => `${x.concepto} ${fmtM(x.gasto)}`).join(' · ')}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4 text-xs text-[var(--text-secondary)]">
        {d.rubros_def.filter(r => d.rubros.some(x => x.rubro === r.id)).map(r => (
          <span key={r.id} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: COLORES[r.id] }} />{r.label}</span>
        ))}
      </div>
    </Seccion>
  )
}

function Rubros({ d, rubro, setRubro }) {
  return (
    <Seccion icon={ListBulletIcon} titulo="¿En qué se gasta?" leyenda="rubro_admin" subtitulo="Clic en un rubro para filtrar toda la página">
      <div className="space-y-4">
        {d.rubros.map(r => {
          const activo = rubro === r.rubro
          return (
            <button
              key={r.rubro}
              onClick={() => setRubro(activo ? '' : r.rubro)}
              className={`w-full text-left rounded-lg p-2 -m-2 transition-colors hover:bg-[var(--bg-secondary)] ${activo ? 'bg-[var(--bg-secondary)]' : ''}`}
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORES[r.rubro] }} />
                  <span className="font-medium truncate">{r.label}</span>
                </span>
                <span className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="font-semibold tabular-nums">{fmtM(r.gasto)}</span>
                  <span className="text-xs text-[var(--text-muted)] tabular-nums w-11 text-right">{r.participacion}%</span>
                  <Delta v={r.variacion_pct} invertir className="text-xs w-14 text-right" />
                </span>
              </div>
              <div className="h-2 mt-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(r.participacion, 0.5)}%`, background: COLORES[r.rubro] }} />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1 truncate" title={r.conceptos.join(', ')}>
                {r.conceptos.length ? r.conceptos.join(' · ') : r.desc}
              </p>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-4">La última columna es el cambio contra el año anterior (rojo = se gastó más).</p>
    </Seccion>
  )
}

function Dona({ rubros }) {
  const data = rubros.filter(r => r.gasto > 0)
  return (
    <Seccion icon={ChartPieIcon} titulo="Participación por rubro">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="gasto" nameKey="label" innerRadius="55%" outerRadius="85%" paddingAngle={1} stroke="none">
            {data.map(r => <Cell key={r.rubro} fill={COLORES[r.rubro]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n, p) => [`${fmtQ(v)} (${p.payload.participacion}%)`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center text-xs text-[var(--text-secondary)]">
        {data.map(r => (
          <span key={r.rubro} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: COLORES[r.rubro] }} />{r.label}
          </span>
        ))}
      </div>
    </Seccion>
  )
}

function SerieMensual({ d, porCentroDisponible }) {
  const [vista, setVista] = useState('rubro')
  const porCentro = porCentroDisponible && vista === 'centro'
  const serie = useMemo(() => (porCentro
    ? d.serie_mensual.map(m => ({ ...m, ...Object.fromEntries(Object.entries(m.centros).map(([k, v]) => [`c_${k}`, v])) }))
    : d.serie_mensual), [d, porCentro])
  const series = porCentro
    ? d.centros_serie.map((c, i) => ({ key: `c_${c}`, label: c, color: COLORES_CENTRO[i] || '#94a3b8' }))
    : d.rubros_def.filter(r => d.serie_mensual.some(m => m[r.id] > 0)).map(r => ({ key: r.id, label: r.label, color: COLORES[r.id] }))
  return (
    <Seccion
      icon={ChartBarIcon}
      titulo="Gasto por mes"
      leyenda="gasto_mensual_admin"
      subtitulo={`Barras: período actual por ${porCentro ? 'centro de costo' : 'rubro'} · línea: mismo mes del año anterior`}
      extra={porCentroDisponible && (
        <div className="flex rounded-lg border border-[var(--border-default)] overflow-hidden text-xs">
          {[['rubro', 'Por rubro'], ['centro', 'Por centro']].map(([id, l]) => (
            <button key={id} onClick={() => setVista(id)} className={`px-3 py-1.5 font-medium ${vista === id ? 'bg-[#001639] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}>{l}</button>
          ))}
        </div>
      )}
    >
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={serie} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
          <XAxis dataKey="periodo" tickFormatter={fmtMes} tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
          <YAxis tickFormatter={fmtM} tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={60} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtMes} formatter={(v, n) => [fmtQ(v), n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} />
          ))}
          <Line dataKey="total_prev" name="Año anterior" type="monotone" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </Seccion>
  )
}

// Gasto como % de las ventas de cada mes
function GastoVsVentas({ d }) {
  return (
    <Seccion
      icon={ScaleIcon}
      titulo="Gasto contra ventas"
      leyenda="gasto_vs_ventas"
      subtitulo="Cuánto del gasto operativo se lleva cada quetzal vendido, mes a mes"
    >
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={d.serie_mensual} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
          <XAxis dataKey="periodo" tickFormatter={fmtMes} tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
          <YAxis yAxisId="q" tickFormatter={fmtM} tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={60} />
          <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={44} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={fmtMes}
            formatter={(v, n) => [n.includes('%') ? (v === null ? '—' : `${v}%`) : fmtQ(v), n]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="q" dataKey="ventas" name="Ventas" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="q" dataKey="total" name="Gasto operativo" fill="#001639" radius={[4, 4, 0, 0]} />
          <Line yAxisId="pct" dataKey="pct_ventas" name="% de las ventas" type="monotone" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          <Line yAxisId="pct" dataKey="pct_ventas_prev" name="% año anterior" type="monotone" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-[var(--text-muted)] mt-2">
        En el período: <strong className="text-[var(--text-secondary)]">{d.pct_ventas ?? '—'}%</strong> de las ventas
        ({fmtM(d.gasto)} de gasto sobre {fmtM(d.ventas)} vendidos) · año anterior {d.pct_ventas_prev ?? '—'}%.
        Un mes alto puede ser un mes de ventas bajas, no necesariamente de más gasto.
      </p>
    </Seccion>
  )
}

function Conceptos({ d, mostrarCentros, onConcepto }) {
  const [orden, setOrden] = useState({ col: 'gasto', dir: 'desc' })
  const items = useMemo(() => ordenar(d.conceptos, orden), [d, orden])
  const exportar = () => exportarCSV('conceptos_gasto.csv', [
    { label: 'Cuenta', get: c => c.cuenta },
    { label: 'Concepto', get: c => c.concepto },
    { label: 'Rubro', get: c => c.rubro_label },
    { label: 'Gasto sin IVA', get: c => c.gasto.toFixed(2) },
    { label: 'Año anterior', get: c => c.gasto_prev.toFixed(2) },
    { label: 'Variación %', get: c => c.variacion_pct ?? '' },
    { label: '% del total', get: c => c.participacion },
    { label: 'Promedio mensual', get: c => c.mensual.toFixed(2) },
    { label: 'Facturas', get: c => c.facturas },
    { label: 'Centros de costo', get: c => c.centros },
    { label: 'Proveedores', get: c => c.proveedores },
    { label: 'Proveedor principal', get: c => c.proveedor_principal },
  ], items)
  return (
    <Seccion
      icon={ListBulletIcon}
      titulo="Conceptos de gasto"
      leyenda="concepto_gasto"
      subtitulo="Clic en un concepto para ver en qué consiste: proveedores, facturas y 24 meses de historia"
      sinPadding
      extra={<button onClick={exportar} className="btn-secondary py-1.5 text-xs flex items-center gap-1"><ArrowDownTrayIcon className="w-4 h-4" /> CSV</button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
            <tr>
              <Th col="concepto" orden={orden} setOrden={setOrden} align="left">Concepto</Th>
              <Th col="gasto" orden={orden} setOrden={setOrden}>Gasto</Th>
              <Th col="participacion" orden={orden} setOrden={setOrden}>%</Th>
              <Th col="variacion_pct" orden={orden} setOrden={setOrden}>vs año ant.</Th>
              <Th col="mensual" orden={orden} setOrden={setOrden}>Por mes</Th>
              <Th col="facturas" orden={orden} setOrden={setOrden}>Facturas</Th>
              {mostrarCentros && <Th col="centros" orden={orden} setOrden={setOrden}>Centros</Th>}
              <Th col="proveedor_principal" orden={orden} setOrden={setOrden} align="left">Proveedor principal</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin gastos en el filtro.</td></tr>
            )}
            {items.map(c => (
              <tr key={c.codigo} onClick={() => onConcepto(c.codigo)} className="hover:bg-[var(--bg-secondary)] cursor-pointer">
                <td className={`${td} max-w-[280px]`}>
                  <p className="font-medium truncate flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORES[c.rubro] }} />
                    <span className="truncate">{c.concepto}</span>
                    {c.nuevo && <span className="badge-info text-[10px]">Nuevo</span>}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] pl-3.5">Cuenta {c.cuenta} · {c.rubro_label}</p>
                </td>
                <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ(c.gasto)}</td>
                <td className={`${td} text-right tabular-nums`}>{c.participacion}%</td>
                <td className={`${td} text-right`}>
                  {c.nuevo ? <span className="text-xs text-[var(--text-muted)]">nuevo</span> : <Delta v={c.variacion_pct} invertir />}
                </td>
                <td className={`${td} text-right tabular-nums`}>{fmtQ(c.mensual)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtInt(c.facturas)}</td>
                {mostrarCentros && <td className={`${td} text-right tabular-nums`}>{c.centros}</td>}
                <td className={`${td} max-w-[240px]`}>
                  <p className="truncate" title={c.proveedor_principal || ''}>{c.proveedor_principal || '—'}</p>
                  {c.proveedores > 1 && (
                    <p className="text-xs text-[var(--text-muted)]">{c.pct_proveedor_principal}% · {c.proveedores} proveedores</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d.conceptos_dejados.length > 0 && (
        <p className="px-5 py-3 text-xs text-[var(--text-muted)] border-t border-[var(--border-default)]">
          Sin gasto este período (sí el año anterior): {d.conceptos_dejados.map(c => `${c.concepto} (${fmtQ(c.gasto_prev)})`).join(' · ')}.
        </p>
      )}
    </Seccion>
  )
}

function Recurrentes({ d, onConcepto }) {
  const [todos, setTodos] = useState(false)
  const items = todos ? d.recurrentes : d.recurrentes.slice(0, 10)
  const fijo = d.recurrentes.filter(r => r.estable).reduce((s, r) => s + r.mensual, 0)
  return (
    <Seccion
      icon={ArrowPathRoundedSquareIcon}
      titulo="Cargos que se repiten cada mes"
      leyenda="recurrentes_admin"
      subtitulo={d.recurrentes.length
        ? `${d.recurrentes.length} cargos · ${fmtM(d.recurrente_mensual)} al mes (${fmtM(fijo)} fijos, ${fmtM(d.recurrente_mensual - fijo)} variables) · ${fmtM(d.recurrente_mensual * 12)} al año`
        : null}
      sinPadding
    >
      {d.recurrentes.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-[var(--text-muted)]">
          {d.meses_completos < 3
            ? 'Hacen falta al menos 3 meses completos en el período para detectar cargos recurrentes.'
            : 'No hay cargos que se repitan todos los meses con este filtro.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
                <tr>
                  <th className={`${th} text-left`}>Concepto</th>
                  <th className={`${th} text-left`}>Proveedor</th>
                  <th className={`${th} text-right`}>Monto típico al mes</th>
                  <th className={`${th} text-right`}>Al año</th>
                  <th className={`${th} text-right`}>Meses con cargo</th>
                  <th className={`${th} text-left`}>Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {items.map(r => (
                  <tr key={`${r.codigo}-${r.proveedor_codigo}`} onClick={() => onConcepto(r.codigo)} className="hover:bg-[var(--bg-secondary)] cursor-pointer">
                    <td className={td}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: COLORES[r.rubro] }} />
                        <span className="font-medium">{r.concepto}</span>
                      </span>
                    </td>
                    <td className={`${td} max-w-[260px] truncate`} title={r.proveedor}>{r.proveedor}</td>
                    <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ(r.mensual)}</td>
                    <td className={`${td} text-right tabular-nums text-[var(--text-secondary)]`}>{fmtM(r.anual)}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.meses_con_cargo} de {r.meses_periodo}</td>
                    <td className={td}>
                      {r.estable
                        ? <span className="badge-neutral">Fijo</span>
                        : <span className="badge-warning" title="Variación típica entre meses">Variable ±{r.variacion_mensual_pct}%</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.recurrentes.length > 10 && (
            <div className="p-3 border-t border-[var(--border-default)] text-center">
              <button onClick={() => setTodos(v => !v)} className="text-xs text-[var(--accent-blue)] hover:underline">
                {todos ? 'Ver solo los 10 más grandes' : `Ver los ${d.recurrentes.length}`}
              </button>
            </div>
          )}
        </>
      )}
    </Seccion>
  )
}

function Proveedores({ items, onProveedor }) {
  const [todos, setTodos] = useState(false)
  const lista = todos ? items : items.slice(0, 12)
  return (
    <Seccion icon={BuildingOfficeIcon} titulo="Proveedores" leyenda="proveedores_admin" subtitulo="Clic en un proveedor para filtrar la página" sinPadding>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
            <tr>
              <th className={`${th} text-left`}>Proveedor</th>
              <th className={`${th} text-right`}>Gasto</th>
              <th className={`${th} text-right`}>%</th>
              <th className={`${th} text-right`}>vs año ant.</th>
              <th className={`${th} text-right`}>Facturas</th>
              <th className={`${th} text-left`}>Qué se le paga</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {lista.map(p => (
              <tr key={p.codigo} onClick={() => onProveedor({ codigo: p.codigo, nombre: p.nombre })} className="hover:bg-[var(--bg-secondary)] cursor-pointer">
                <td className={`${td} max-w-[260px]`}>
                  <p className="font-medium truncate" title={p.nombre}>{p.nombre}</p>
                  <p className="text-xs text-[var(--text-muted)]">{p.codigo}{p.generico ? ' · sin proveedor identificado (caja chica)' : ''}</p>
                </td>
                <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ(p.gasto)}</td>
                <td className={`${td} text-right tabular-nums`}>{p.participacion}%</td>
                <td className={`${td} text-right`}>{p.gasto_prev === 0 ? <span className="text-xs text-[var(--text-muted)]">nuevo</span> : <Delta v={p.variacion_pct} invertir />}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtInt(p.facturas)}</td>
                <td className={`${td} max-w-[320px]`}><p className="truncate text-[var(--text-secondary)]" title={p.conceptos}>{p.conceptos}</p></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > 12 && (
        <div className="p-3 border-t border-[var(--border-default)] text-center">
          <button onClick={() => setTodos(v => !v)} className="text-xs text-[var(--accent-blue)] hover:underline">
            {todos ? 'Ver menos' : `Ver los ${items.length}`}
          </button>
        </div>
      )}
    </Seccion>
  )
}

// ---------------------------------------------------------------------------
// Líneas de gasto (búsqueda y paginado)
// ---------------------------------------------------------------------------
const COLUMNAS_LINEAS = [
  { label: 'Fecha', get: f => String(f.fecha_emision).slice(0, 10) },
  { label: 'Documento', get: f => `${f.tipo_doc} ${f.fact_num}` },
  { label: 'Centro de costo', get: f => f.centro_costo },
  { label: 'Código concepto', get: f => f.codigo_articulo },
  { label: 'Concepto', get: f => f.articulo },
  { label: 'Código proveedor', get: f => f.codigo_proveedor },
  { label: 'Proveedor', get: f => f.proveedor },
  { label: 'Total sin IVA', get: f => f.total_sin_iva.toFixed(2) },
  { label: 'IVA', get: f => f.iva.toFixed(2) },
  { label: 'Total con IVA', get: f => f.total_con_iva.toFixed(2) },
]
const PAGINA = 100

function Lineas({ filtros, mostrarCentro }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [limite, setLimite] = useState(PAGINA)
  const clave = JSON.stringify(filtros)
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 300)
    return () => clearTimeout(t)
  }, [texto])
  useEffect(() => setLimite(PAGINA), [clave, busqueda])
  const { data, isFetching } = useQuery(
    ['gastos-lineas', clave, busqueda, limite],
    () => endpoints.gastos.detalle({ ...filtros, busqueda, limit: limite }),
    { keepPreviousData: true, enabled: abierto }
  )
  const d = data?.data
  const filas = d?.filas || []

  return (
    <Seccion
      icon={ReceiptPercentIcon}
      titulo="Facturas de gasto"
      subtitulo={abierto && d ? `${fmtInt(d.total_filas)} líneas · ${fmtQ(d.suma_sin_iva_filtrada)} sin IVA` : 'Cada línea registrada en el ERP con los filtros de arriba'}
      sinPadding
      extra={
        <button onClick={() => setAbierto(v => !v)} className="text-xs text-[var(--accent-blue)] hover:underline">
          {abierto ? 'Ocultar' : 'Ver facturas'}
        </button>
      }
    >
      {abierto && (
        <>
          <div className="px-5 pb-3">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setTexto('')}
                placeholder="Buscar por proveedor, concepto o número de factura…"
                className="input w-full pl-9 text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)]">
                <tr>
                  <th className={`${th} text-left`}>Fecha</th>
                  <th className={`${th} text-left`}>Documento</th>
                  {mostrarCentro && <th className={`${th} text-left`}>Centro</th>}
                  <th className={`${th} text-left`}>Concepto</th>
                  <th className={`${th} text-left`}>Proveedor</th>
                  <th className={`${th} text-right`}>Sin IVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filas.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">{isFetching ? 'Cargando…' : 'Sin facturas que coincidan.'}</td></tr>
                )}
                {filas.map(f => (
                  <tr key={f.id} className="hover:bg-[var(--bg-secondary)]">
                    <td className={`${td} tabular-nums text-[var(--text-secondary)]`}>{fmtFecha(f.fecha_emision)}</td>
                    <td className={td}>{f.tipo_doc} {f.fact_num}</td>
                    {mostrarCentro && <td className={`${td} text-[var(--text-secondary)]`}>{f.centro_costo}</td>}
                    <td className={`${td} max-w-[220px] truncate`} title={f.articulo}>{f.articulo}</td>
                    <td className={`${td} max-w-[260px] truncate`} title={f.proveedor}>{f.proveedor}</td>
                    <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ(f.total_sin_iva)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d && filas.length < d.total_filas && (
            <div className="p-3 border-t border-[var(--border-default)] text-center">
              <button onClick={() => setLimite(l => l + PAGINA)} disabled={isFetching} className="btn-secondary text-sm disabled:opacity-60">
                {isFetching ? 'Cargando…' : `Cargar ${fmtInt(Math.min(PAGINA, d.total_filas - filas.length))} más`}
              </button>
            </div>
          )}
        </>
      )}
    </Seccion>
  )
}

// ---------------------------------------------------------------------------
// Panel lateral con el detalle de un concepto
// ---------------------------------------------------------------------------
function PanelConcepto({ cuenta, filtros, mostrarCentros, onClose }) {
  const { data, isLoading } = useQuery(
    ['gastos-concepto', cuenta, JSON.stringify(filtros)],
    () => endpoints.gastos.concepto(cuenta, filtros),
  )
  const d = data?.data
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full overflow-y-auto bg-[var(--bg-primary)] shadow-2xl animate-fade-in">
        <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-default)] px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-muted)]">Cuenta {d?.cuenta || cuenta}{d?.rubro_label ? ` · ${d.rubro_label}` : ''}</p>
            <h2 className="text-lg font-semibold truncate">{d?.concepto || 'Cargando…'}</h2>
            {d && <p className="text-sm text-[var(--text-secondary)]">{fmtQ(d.gasto)} en el período · {fmtInt(d.lineas.length)}{d.lineas.length >= 200 ? '+' : ''} facturas</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]" aria-label="Cerrar">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {isLoading || !d ? (
          <div className="p-5 space-y-4"><Cargando alto="h-48" /><Cargando alto="h-40" /></div>
        ) : (
          <div className="p-5 space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Últimos 24 meses</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.serie} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                  <XAxis dataKey="periodo" tickFormatter={fmtMes} tick={{ fontSize: 10 }} stroke="var(--text-muted)" interval={2} />
                  <YAxis tickFormatter={fmtM} tick={{ fontSize: 10 }} stroke="var(--text-muted)" width={52} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtMes} formatter={(v) => [fmtQ(v), 'Gasto']} />
                  <Bar dataKey="gasto" radius={[3, 3, 0, 0]}>
                    {d.serie.map(m => <Cell key={m.periodo} fill={m.en_periodo ? '#001639' : '#cbd5e1'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-[var(--text-muted)]">En azul oscuro, los meses del período seleccionado.</p>
            </div>

            {mostrarCentros && d.centros.length > 1 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">En qué centros de costo</h3>
                <div className="space-y-1.5">
                  {d.centros.map(c => (
                    <div key={c.centro} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="truncate">{c.centro}</span>
                        <span className="whitespace-nowrap tabular-nums"><strong>{fmtQ(c.gasto)}</strong> <span className="text-xs text-[var(--text-muted)]">{c.participacion}%</span></span>
                      </div>
                      <div className="h-1.5 mt-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div className="h-full bg-[#3b82f6] rounded-full" style={{ width: `${c.participacion}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-2">A quién se le paga</h3>
              {d.proveedores.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Sin gasto en el período.</p> : (
                <div className="space-y-2">
                  {d.proveedores.map(p => (
                    <div key={p.codigo} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="truncate">{p.nombre}</span>
                        <span className="whitespace-nowrap tabular-nums"><strong>{fmtQ(p.gasto)}</strong> <span className="text-xs text-[var(--text-muted)]">{p.participacion}%</span></span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{p.facturas} facturas en {p.meses} {p.meses === 1 ? 'mes' : 'meses'} · última {fmtFecha(p.ultima)}</p>
                      <div className="h-1.5 mt-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div className="h-full bg-[#001639] rounded-full" style={{ width: `${p.participacion}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Facturas del período</h3>
              <div className="overflow-x-auto border border-[var(--border-default)] rounded-lg">
                <table className="w-full">
                  <thead className="bg-[var(--bg-secondary)]">
                    <tr>
                      <th className={`${th} text-left`}>Fecha</th>
                      <th className={`${th} text-left`}>Proveedor</th>
                      <th className={`${th} text-left`}>Factura</th>
                      <th className={`${th} text-right`}>Sin IVA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {d.lineas.map(l => (
                      <tr key={l.id}>
                        <td className={`${td} tabular-nums text-[var(--text-secondary)]`}>{fmtFecha(l.fecha)}</td>
                        <td className={`${td} max-w-[220px]`}>
                          <p className="truncate" title={l.proveedor}>{l.proveedor}</p>
                          {mostrarCentros && <p className="text-[10px] text-[var(--text-muted)]">{l.centro}</p>}
                        </td>
                        <td className={`${td} text-xs text-[var(--text-muted)]`}>
                          {l.fact_num}{l.factura_proveedor ? <span className="block">prov. {l.factura_proveedor}</span> : null}
                        </td>
                        <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ(l.total_sin_iva)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {d.lineas.length >= 200 && <p className="text-xs text-[var(--text-muted)] mt-1">Se muestran las 200 más recientes. Usá “Exportar líneas” para verlas todas.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
