import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'react-query'
import { ArrowDownTrayIcon, ArrowLeftIcon, ChevronRightIcon, InformationCircleIcon, ScaleIcon } from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { endpoints } from '../services/cfoApi'
import { fmtM, fmtQ, fmtMes, tooltipStyle } from '../components/analisis/formato'
import { Cargando, Seccion, Th, exportarCSV, ordenar, td } from '../components/compras/comun'

const NIVELES = [
  { dim: 'categoria',    singular: 'Categoría',    plural: 'categorías' },
  { dim: 'subcategoria', singular: 'Subcategoría', plural: 'subcategorías' },
  { dim: 'sublinea',     singular: 'Sublínea',     plural: 'sublíneas' },
]
const C_VENTAS = '#001639'
const C_COMPRAS = '#f59e0b'
const C_COSTO = '#10b981'

const varPct = (v, vp) => (vp ? (v - vp) / vp * 100 : null)
const fmtVar = (x) => (x === null || x === undefined ? null : `${x > 0 ? '+' : ''}${x.toFixed(1)}%`)
const fmtFecha = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })

function Kpi({ titulo, valor, sub, variacion, tono = '' }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{titulo}</span>
      <p className={`kpi-value tabular-nums ${tono}`}>{valor}</p>
      {sub && <p className="text-xs text-[var(--text-muted)] mt-1">{sub}</p>}
      {variacion && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{variacion}</p>}
    </div>
  )
}

function Chip({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        activo ? 'border-[#001639] bg-[#001639] text-white' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Análisis › Ventas vs compras: cuánto se vendió contra cuánto se compró en un año
 * calendario, por categoría (con drill-down a subcategoría y sublínea).
 * No usa el filtro global de período: siempre es año calendario (el año en curso, a hoy).
 */
export default function VentasCompras() {
  const [anio, setAnio] = useState(null)
  const [compras, setCompras] = useState('materiales')
  const [path, setPath] = useState([]) // [{ dim, clave }]
  const [orden, setOrden] = useState({ col: 'ventas', dir: 'desc' })

  const filtros = Object.fromEntries(path.map(p => [p.dim, p.clave]))
  const { data, isLoading, error } = useQuery(
    ['ventas-vs-compras', anio, compras, JSON.stringify(filtros)],
    () => endpoints.analisis.ventasVsCompras({ ...(anio ? { anio } : {}), compras, ...filtros }),
    { keepPreviousData: true, staleTime: 5 * 60 * 1000 }
  )
  const d = data?.data
  const nivel = NIVELES.find(n => n.dim === d?.nivel) || NIVELES[0]
  const esHoja = path.length >= NIVELES.length - 1

  const items = useMemo(() => ordenar((d?.items || []).map(i => ({
    ...i,
    diferencia: i.ventas - i.compras,
    ratio: i.ventas > 0 ? i.compras / i.ventas * 100 : null,
    var_ventas: varPct(i.ventas, i.ventas_prev),
    var_compras: varPct(i.compras, i.compras_prev),
  })), orden), [d, orden])

  const grafica = useMemo(() => [...(d?.items || [])]
    .sort((a, b) => Math.max(b.ventas, b.compras) - Math.max(a.ventas, a.compras))
    .slice(0, 10)
    .map(i => ({ nombre: i.clave.length > 22 ? i.clave.slice(0, 21) + '…' : i.clave, completo: i.clave, ventas: i.ventas, compras: i.compras })), [d])

  if (error) return <div className="card p-6 text-sm text-[var(--danger)]">No se pudo cargar: {error.message}</div>

  const t = d?.totales
  const anioActual = d?.anios?.[0]
  const etiquetaCompras = compras === 'materiales' ? 'materiales e insumos' : 'todas las compras'
  const tramo = d ? (d.anio === anioActual ? `1 ene – ${fmtFecha(d.hasta)}` : `año completo ${d.anio}`) : ''
  const vsPrev = (v, vp) => (d?.prev && vp ? `${fmtVar(varPct(v, vp))} vs ${d.anio - 1} (${fmtM(vp)})` : null)

  const exportar = () => exportarCSV(`ventas_vs_compras_${d.anio}_${nivel.dim}.csv`, [
    { label: nivel.singular, get: i => i.clave },
    { label: 'Vendido', get: i => i.ventas },
    { label: `Comprado (${etiquetaCompras})`, get: i => i.compras },
    { label: 'Vendido − comprado', get: i => i.diferencia },
    { label: 'Compras / ventas %', get: i => (i.ratio === null ? '' : i.ratio.toFixed(1)) },
    { label: 'Costo de lo vendido', get: i => i.costo_ventas },
    { label: `Vendido ${d.anio - 1}`, get: i => i.ventas_prev ?? '' },
    { label: `Comprado ${d.anio - 1}`, get: i => i.compras_prev ?? '' },
  ], items)

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <Link to="/analisis" className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors shrink-0" title="Volver a Análisis">
          <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
        </Link>
        <div>
          <p className="text-xs text-[var(--text-muted)]"><Link to="/analisis" className="hover:underline">Análisis</Link> ›</p>
          <h1 className="text-2xl font-semibold">Ventas vs compras</h1>
          <p className="text-sm text-[var(--text-muted)]">Cuánto se vendió contra cuánto se compró, por categoría</p>
          {d && <p className="text-xs text-[var(--text-muted)] mt-1">{tramo}{d.prev ? ` · comparado con el mismo tramo de ${d.anio - 1}` : ''} · usa años calendario, no el filtro de período</p>}
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-muted)] mr-1">Año</span>
          {(d?.anios || []).map(y => (
            <Chip key={y} activo={d?.anio === y} onClick={() => setAnio(y)}>{y}{y === anioActual ? ' (a hoy)' : ''}</Chip>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-muted)] mr-1">Compras a contar</span>
          <Chip activo={compras === 'materiales'} onClick={() => setCompras('materiales')}>Materiales e insumos</Chip>
          <Chip activo={compras === 'todas'} onClick={() => setCompras('todas')}>Todas (incluye gastos, fletes y activo fijo)</Chip>
        </div>
      </div>

      {/* Ruta del drill-down */}
      {path.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap text-sm">
          <button onClick={() => setPath([])} className="px-2 py-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)]">Todas las categorías</button>
          {path.map((p, i) => (
            <span key={p.dim} className="flex items-center gap-1">
              <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <button onClick={() => setPath(path.slice(0, i + 1))} className={`px-2 py-1 rounded hover:bg-[var(--bg-secondary)] ${i === path.length - 1 ? 'font-semibold' : 'text-[var(--text-muted)]'}`}>
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mr-1">{NIVELES[i].singular}</span>{p.clave}
              </button>
            </span>
          ))}
        </div>
      )}

      {isLoading && !d ? (
        <div className="space-y-4"><Cargando alto="h-28" /><Cargando alto="h-72" /><Cargando alto="h-96" /></div>
      ) : d && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi titulo="Vendido" valor={fmtM(t.ventas)} sub="Facturas de venta sin IVA" variacion={vsPrev(t.ventas, t.ventas_prev)} />
            <Kpi titulo="Comprado" valor={fmtM(t.compras)} sub={`Facturas de compra sin IVA · ${etiquetaCompras}`} variacion={vsPrev(t.compras, t.compras_prev)} tono="text-amber-600" />
            <Kpi
              titulo="Vendido − comprado"
              valor={fmtM(t.ventas - t.compras)}
              sub={t.ventas > 0 ? `Por cada Q100 vendidos se compraron Q${Math.round(t.compras / t.ventas * 100)}` : null}
              tono={t.ventas - t.compras < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}
            />
            <Kpi
              titulo="Costo de lo vendido"
              valor={fmtM(t.costo_ventas)}
              sub={t.compras > t.costo_ventas
                ? `Se compró ${fmtM(t.compras - t.costo_ventas)} más de lo que salió vendido: el inventario creció`
                : `Se compró ${fmtM(t.costo_ventas - t.compras)} menos de lo que salió vendido: se usó inventario`}
            />
          </div>

          {/* Serie mensual */}
          <Seccion icon={ScaleIcon} titulo="Mes a mes" subtitulo={`Vendido y comprado cada mes de ${d.anio}; la línea es el costo de lo vendido`}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={d.meses} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <YAxis tickFormatter={fmtM} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={60} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtMes} formatter={(v, name) => [fmtQ(v), name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ventas" name="Vendido" fill={C_VENTAS} radius={[3, 3, 0, 0]} />
                <Bar dataKey="compras" name="Comprado" fill={C_COMPRAS} radius={[3, 3, 0, 0]} />
                <Line dataKey="costo_ventas" name="Costo de lo vendido" stroke={C_COSTO} strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
            {d.anio === anioActual && <p className="text-xs text-[var(--text-muted)]">El mes en curso va incompleto.</p>}
          </Seccion>

          {/* Por categoría */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 card p-5">
              <h3 className="font-semibold">Top {grafica.length} {nivel.plural}</h3>
              <p className="text-xs text-[var(--text-muted)] mb-3">Vendido vs comprado</p>
              <ResponsiveContainer width="100%" height={Math.max(260, grafica.length * 44)}>
                <BarChart data={grafica} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
                  <YAxis type="category" dataKey="nombre" width={130} tick={{ fontSize: 11 }} interval={0} stroke="var(--text-muted)" />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, p) => p?.[0]?.payload?.completo} formatter={(v, name) => [fmtQ(v), name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ventas" name="Vendido" fill={C_VENTAS} radius={[0, 3, 3, 0]} />
                  <Bar dataKey="compras" name="Comprado" fill={C_COMPRAS} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-3">
              <Seccion
                titulo={`Por ${nivel.singular.toLowerCase()}`}
                subtitulo={esHoja ? `${items.length} ${nivel.plural}` : `${items.length} ${nivel.plural} · clic para ver el detalle`}
                sinPadding
                extra={<button onClick={exportar} className="btn-secondary py-1.5 text-xs flex items-center gap-1"><ArrowDownTrayIcon className="w-4 h-4" /> CSV</button>}
              >
                <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-[var(--bg-secondary)] border-y border-[var(--border-default)] sticky top-0 z-10">
                      <tr>
                        <Th col="clave" orden={orden} setOrden={setOrden} align="left">{nivel.singular}</Th>
                        <Th col="ventas" orden={orden} setOrden={setOrden}>Vendido</Th>
                        <Th col="compras" orden={orden} setOrden={setOrden}>Comprado</Th>
                        <Th col="diferencia" orden={orden} setOrden={setOrden}>Diferencia</Th>
                        <Th col="ratio" orden={orden} setOrden={setOrden}>Compra / venta</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-default)]">
                      {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin datos.</td></tr>}
                      {items.map(i => (
                        <tr
                          key={i.clave}
                          onClick={() => !esHoja && setPath([...path, { dim: nivel.dim, clave: i.clave }])}
                          className={`hover:bg-[var(--bg-secondary)] ${esHoja ? '' : 'cursor-pointer'}`}
                        >
                          <td className={`${td} max-w-[220px]`}>
                            <div className="flex items-center gap-1">
                              <span className="font-medium truncate" title={i.clave}>{i.clave}</span>
                              {!esHoja && <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />}
                            </div>
                          </td>
                          <td className={`${td} text-right tabular-nums`}>
                            <p className="font-semibold">{fmtM(i.ventas)}</p>
                            {i.var_ventas !== null && <p className="text-[11px] text-[var(--text-muted)]">{fmtVar(i.var_ventas)} vs {d.anio - 1}</p>}
                          </td>
                          <td className={`${td} text-right tabular-nums`}>
                            <p className="font-semibold text-amber-700">{fmtM(i.compras)}</p>
                            {i.var_compras !== null && <p className="text-[11px] text-[var(--text-muted)]">{fmtVar(i.var_compras)} vs {d.anio - 1}</p>}
                          </td>
                          <td className={`${td} text-right tabular-nums font-medium ${i.diferencia < 0 ? 'text-[var(--danger)]' : ''}`}>{fmtM(i.diferencia)}</td>
                          <td className={`${td} text-right tabular-nums`}>
                            {i.ratio === null ? <span className="text-[var(--text-muted)]">solo compras</span> : (
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 rounded bg-[var(--bg-secondary)] overflow-hidden">
                                  <div className="h-full rounded" style={{ width: `${Math.min(100, i.ratio)}%`, background: i.ratio > 100 ? '#ef4444' : C_COMPRAS }} />
                                </div>
                                <span className={i.ratio > 100 ? 'text-[var(--danger)] font-semibold' : ''}>{Math.round(i.ratio)}%</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Seccion>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 flex gap-2.5 text-xs text-[var(--text-secondary)]">
            <InformationCircleIcon className="w-4 h-4 shrink-0 mt-0.5 text-[var(--text-muted)]" />
            <div className="space-y-1">
              <p><strong>Cómo leerlo.</strong> Vendido y comprado son montos sin IVA de las facturas del ERP. "Compra / venta" = comprado ÷ vendido: arriba de 100% se compró más de lo que se vendió en esa categoría.</p>
              <p>Las categorías que se fabrican (como Soplado y Termoformado) venden mucho y casi no compran: su materia prima, por ejemplo el polietileno, se compra bajo <em>Materia Prima (Insumos)</em>. Por eso conviene leerlas junto con esa categoría, o mirar el total.</p>
              <p>"Costo de lo vendido" es lo que costó la mercadería vendida. Si se compra más que eso, el dinero se queda en inventario.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
