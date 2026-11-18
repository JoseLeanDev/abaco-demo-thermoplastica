import { useState } from 'react'
import { useInfiniteQuery } from 'react-query'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts'
import {
  ArrowDownTrayIcon, MagnifyingGlassIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { endpoints } from '../../services/cfoApi'
import { useAuth } from '../../context/AuthContext'
import { Leyenda } from '../common/leyendas'
import { exportarExcel, traerTodo } from '../../services/excel'

// Piezas compartidas por las fichas de Ventas (vendedor y cliente).

export const fmtQ = (n) => `Q${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
export const fmtM = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return fmtQ(v)
}
export const fmtNum = (n) => Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })
export const fmtInt = (n) => Number(n || 0).toLocaleString('es-GT')
export const fmtPct = (n, d = 1) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(d)}%`)
export const fmtF = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: '2-digit' }) : '—')
export const fmtPeriod = (p) => {
  if (!p) return ''
  const [y, m] = p.split('-')
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${meses[+m - 1]} ${y.slice(2)}`
}
export const tooltipStyle = { background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }

export const margenTone = (pct) => {
  if (pct === null || pct === undefined) return 'text-[var(--text-muted)]'
  if (pct >= 40) return 'text-[var(--success)]'
  if (pct >= 25) return 'text-[var(--warning)]'
  return 'text-[var(--danger)]'
}

export const Var = ({ pct, nuevo }) => {
  if (nuevo) return <span className="text-xs font-semibold text-[var(--success)]">nuevo</span>
  if (pct === null || pct === undefined) return <span className="text-[var(--text-muted)]">—</span>
  const tone = pct > 0 ? 'text-[var(--success)]' : pct < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
  return <span className={`tabular-nums font-semibold ${tone}`}>{pct > 0 ? '+' : ''}{Number(pct).toFixed(1)}%</span>
}

export const SinCosto = ({ pct }) => (pct >= 1 ? (
  <p className="text-[10px] font-normal text-[var(--text-muted)] whitespace-nowrap" title="El margen % se calcula solo con las líneas que traen costo en el ERP">
    {Number(pct).toFixed(1)}% sin costo
  </p>
) : null)

const TONOS = { success: 'text-[var(--success)]', warning: 'text-[var(--warning)]', danger: 'text-[var(--danger)]' }

export function Kpi({ titulo, leyenda, valor, sub, tono, delta, className = '' }) {
  return (
    <div className={`kpi-card ${className}`}>
      <span className="kpi-label flex items-center gap-1">{titulo} {leyenda && <Leyenda k={leyenda} />}</span>
      <p className={`text-xl font-bold tabular-nums mt-1 ${tono ? TONOS[tono] : ''}`}>{valor}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">
        {delta !== undefined && delta !== null && (
          <span className={`font-semibold mr-1 ${delta >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
        {sub}
      </p>
    </div>
  )
}

export function Seccion({ icon: Icon, titulo, leyenda, extra, children, sinPadding }) {
  return (
    <div className="card overflow-hidden">
      <div className="section-header flex-wrap gap-2">
        {Icon && <Icon className="w-5 h-5 text-[var(--text-muted)]" />}
        <h2 className="font-semibold">{titulo}</h2>
        {leyenda && <Leyenda k={leyenda} />}
        {extra && <div className="ml-auto">{extra}</div>}
      </div>
      <div className={sinPadding ? '' : 'p-5 pt-0'}>{children}</div>
    </div>
  )
}

export function Senales({ senales, leyenda }) {
  if (!senales.length) return null
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2 flex items-center gap-1">Señales <Leyenda k={leyenda} /></p>
      <ul className="space-y-1.5">
        {senales.map((s, i) => {
          const Icon = s.tipo === 'bien' ? CheckCircleIcon : s.tipo === 'alerta' ? ExclamationTriangleIcon : InformationCircleIcon
          const color = s.tipo === 'bien' ? 'text-[var(--success)]' : s.tipo === 'alerta' ? 'text-[var(--danger)]' : 'text-[var(--warning)]'
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
              <span className="text-[var(--text-secondary)]">{s.texto}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Pestanas({ tabs, tab, onTab }) {
  return (
    <div className="flex gap-1 border-b border-[var(--border-default)] overflow-x-auto">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === t.id
              ? 'border-[#001639] text-[var(--text-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <t.icon className="w-4 h-4" />
          {t.label}
        </button>
      ))}
    </div>
  )
}

// Barras de ventas por mes (oscuras dentro del período) + línea de margen %.
// `detalle(p)` agrega renglones al tooltip.
export function GraficaHistorial({ serie, ventana, detalle }) {
  const sinMargen = useAuth().oculta('/ventas', 'margen')
  const enPeriodo = (p) => p >= ventana.desde.slice(0, 7) && p <= ventana.hasta.slice(0, 7)
  // Eje de margen en marcas de 25%; baja de 0 solo si algún mes tuvo margen negativo
  const minPct = Math.min(0, ...serie.map(m => m.margen_pct ?? 0))
  const ticksPct = []
  for (let t = Math.floor(minPct / 25) * 25; t <= 100; t += 25) ticksPct.push(t)

  if (serie.length === 0) {
    return <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin ventas en los últimos 24 meses.</p>
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={serie} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
        <XAxis dataKey="periodo" tickFormatter={fmtPeriod} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
        <YAxis yAxisId="q" tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={60} />
        {!sinMargen && <YAxis yAxisId="pct" orientation="right" domain={[ticksPct[0], 100]} ticks={ticksPct} allowDataOverflow tickFormatter={(x) => `${x}%`} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={42} />}
        <Tooltip
          cursor={{ fill: 'var(--bg-secondary)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload
            return (
              <div style={tooltipStyle} className="px-3 py-2 space-y-0.5">
                <p className="font-semibold">{fmtPeriod(p.periodo)}</p>
                <p className="tabular-nums">Ventas {fmtQ(p.ventas)}</p>
                {!sinMargen && <p className="tabular-nums">Margen {fmtPct(p.margen_pct)}</p>}
                {detalle && detalle(p)}
              </div>
            )
          }}
        />
        <Bar yAxisId="q" dataKey="ventas" radius={[4, 4, 0, 0]}>
          {serie.map(m => <Cell key={m.periodo} fill={enPeriodo(m.periodo) ? '#001639' : '#94a3b8'} />)}
        </Bar>
        {!sinMargen && <Line yAxisId="pct" dataKey="margen_pct" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function LeyendaGrafica() {
  return (
    <div className="text-xs text-[var(--text-muted)] flex items-center gap-3">
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#001639] rounded-sm" /> En el período</span>
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-[#94a3b8] rounded-sm" /> Fuera</span>
      <span className="flex items-center gap-1 col-margen"><span className="inline-block w-4 h-0.5 bg-amber-500" /> Margen %</span>
    </div>
  )
}

// -------------------------------------------------------------------
// Líneas de factura paginadas (historial de un vendedor o de un cliente)
// `filtro`: { vendedor } o { codigo_cliente }; `quien`: columna que se muestra
// además del artículo ('cliente' o 'vendedor').
// -------------------------------------------------------------------
const PAGINA = 100

const COLUMNAS_LINEAS = [
  { label: 'Fecha', get: f => String(f.fecha_emision).slice(0, 10) },
  { label: 'Documento', get: f => `${f.tipo_doc} ${f.fact_num}` },
  { label: 'Código cliente', get: f => f.codigo_cliente },
  { label: 'Cliente', get: f => f.cliente },
  { label: 'Vendedor', get: f => f.vendedor },
  { label: 'Sucursal', get: f => f.sucursal },
  { label: 'Código artículo', get: f => f.codigo_articulo },
  { label: 'Artículo', get: f => f.articulo },
  { label: 'Subcategoría', get: f => f.linea },
  { label: 'Unidades', get: f => f.unidades },
  { label: 'Total sin IVA', get: f => f.total_sin_iva.toFixed(2) },
  { label: 'Total con IVA', get: f => f.total_con_iva.toFixed(2) },
  { label: 'Margen bruto', get: f => (f.margen_bruto === null ? '' : f.margen_bruto.toFixed(2)) },
  { label: 'Margen %', get: f => (f.margen_bruto_pct === null ? '' : Number(f.margen_bruto_pct).toFixed(1)) },
]

export function HistorialLineas({ filtro, params, quien, archivo, placeholder }) {
  const sinMargen = useAuth().oculta('/ventas', 'margen')
  const [busqueda, setBusqueda] = useState('')
  const [exportando, setExportando] = useState(false)
  const filtros = { ...params, ...filtro, busqueda }

  const { data, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(
    ['ventas-ficha-detalle', JSON.stringify(filtros)],
    ({ pageParam = 0 }) => endpoints.ventas.detalle({ ...filtros, limit: PAGINA, offset: pageParam }),
    {
      keepPreviousData: true,
      getNextPageParam: (ult, paginas) => {
        const cargadas = paginas.reduce((s, p) => s + (p?.data?.filas?.length || 0), 0)
        return cargadas < (ult?.data?.total_filas || 0) ? cargadas : undefined
      },
    }
  )
  const filas = (data?.pages || []).flatMap(p => p?.data?.filas || [])
  const total = data?.pages?.[0]?.data?.total_filas || 0
  const suma = data?.pages?.[0]?.data?.suma_ventas || 0

  const exportar = async () => {
    setExportando(true)
    try {
      const lineas = await traerTodo(endpoints.ventas.detalle, filtros)
      const columnas = sinMargen ? COLUMNAS_LINEAS.filter(c => !/costo|margen/i.test(c.label)) : COLUMNAS_LINEAS
      await exportarExcel(`ventas_${archivo.replace(/\s+/g, '_')}_${params.desde}_${params.hasta}.xlsx`, columnas, lineas, { hoja: 'Ventas' })
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={placeholder}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input w-full pl-12"
          />
        </div>
        <button onClick={exportar} disabled={exportando || total === 0} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowDownTrayIcon className="w-4 h-4" />
          {exportando ? 'Exportando…' : 'Exportar a Excel'}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)] flex-wrap gap-2">
          <span className="text-sm text-[var(--text-muted)]">
            {isFetching && !isFetchingNextPage ? 'Actualizando…' : `${fmtInt(filas.length)} de ${fmtInt(total)} líneas`}
          </span>
          <span className="text-sm font-semibold">Total sin IVA: {fmtM(suma)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="px-3 py-3 text-left font-semibold">Fecha</th>
                <th className="px-3 py-3 text-left font-semibold">Factura</th>
                <th className="px-3 py-3 text-left font-semibold">{quien === 'vendedor' ? 'Vendedor' : 'Cliente'}</th>
                <th className="px-3 py-3 text-left font-semibold">Artículo</th>
                <th className="px-3 py-3 text-right font-semibold">Unid.</th>
                <th className="px-3 py-3 text-right font-semibold">Sin IVA</th>
                <th className="px-3 py-3 text-right font-semibold col-margen">Margen% <Leyenda k="margen_bruto" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filas.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{isFetching ? 'Cargando…' : 'Sin líneas que coincidan.'}</td></tr>
              )}
              {filas.map(f => (
                <tr key={f.id} className="hover:bg-[var(--bg-secondary)] transition-colors text-sm">
                  <td className="px-3 py-2 text-[var(--text-secondary)] tabular-nums whitespace-nowrap">{String(f.fecha_emision).slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{f.tipo_doc} {f.fact_num}</p>
                    {f.sucursal && <p className="text-xs text-[var(--text-muted)]">{f.sucursal}</p>}
                  </td>
                  <td className="px-3 py-2 max-w-[220px]">
                    {quien === 'vendedor' ? (
                      <p className="font-medium truncate">{f.vendedor || 'Sin vendedor'}</p>
                    ) : (
                      <>
                        <p className="font-medium truncate">{f.cliente}</p>
                        <p className="text-xs text-[var(--text-muted)]">{f.codigo_cliente}</p>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[260px]">
                    <p className="nombre-articulo">{f.articulo}</p>
                    <p className="text-xs text-[var(--text-muted)]">{f.codigo_articulo}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(f.unidades)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtM(f.total_sin_iva)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold col-margen ${margenTone(f.margen_bruto_pct)}`}>
                    {f.margen_bruto_pct !== null ? `${f.margen_bruto_pct.toFixed(1)}%` : (
                      <span className="text-xs font-normal text-[var(--text-muted)]" title="El ERP no trae costo para esta línea">sin costo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasNextPage && (
          <div className="p-3 border-t border-[var(--border-default)] text-center">
            <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="btn-secondary text-sm">
              {isFetchingNextPage ? 'Cargando…' : `Cargar ${Math.min(PAGINA, total - filas.length)} más`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
