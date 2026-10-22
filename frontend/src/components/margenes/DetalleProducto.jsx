import { useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useMargenProductoDetalle } from '../../hooks/useCfoData'
import { usePeriodo } from '../../context/PeriodoContext'
import { Leyenda } from '../common/leyendas'
import { Cargando, fmtInt, fmtMes, fmtPrecio, fmtQ, tooltipStyle } from '../compras/comun'

const fmtPct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(1)}%`)

function Dato({ titulo, leyenda, valor, sub, tono = '' }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
      <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1">{titulo} {leyenda && <Leyenda k={leyenda} />}</p>
      <p className={`text-lg font-bold tabular-nums ${tono}`}>{valor}</p>
      {sub && <p className="text-xs text-[var(--text-muted)]">{sub}</p>}
    </div>
  )
}

// Ficha de un producto en un panel emergente: precio, costo y margen mes a mes
// (período seleccionado + el año previo, para ver de dónde viene el cambio).
export default function DetalleProducto({ producto: p, onClose }) {
  const { desde } = usePeriodo()
  const { data, isLoading } = useMargenProductoDetalle(p.id, p.es_cpp ? { categoria: p.categoria, corte_cpp: p.corte_cpp } : {})

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [onClose])

  const meses = (data?.data?.historial || []).map(h => ({
    mes: h.fecha.slice(0, 7),
    precio: h.precio_promedio_realizado || null,
    costo: h.costo_unitario || null,
    margen: h.unidades > 0 && h.costo_unitario > 0 ? h.margen_pct : null,
    unidades: h.unidades,
    ventas: h.ventas,
    en_periodo: h.fecha >= desde,
  }))
  const subeSugerido = p.precio_sugerido > p.precio_actual

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-xl bg-[var(--bg-primary)] shadow-2xl animate-fade-in">
        <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-default)] px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-muted)] truncate">{p.sku} · {p.categoria} › {p.subcategoria} › {p.sublinea}</p>
            <h2 className="text-lg font-semibold">{p.nombre}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]" aria-label="Cerrar">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Dato titulo="Ventas" valor={fmtQ(p.ventas)} sub={`${fmtInt(p.unidades_12m)} unidades`} />
            <Dato titulo={p.es_cpp ? p.unidad === 'millar' ? 'Margen sobre costo de compra' : 'Margen sobre materia prima' : 'Margen bruto'} leyenda={p.es_cpp ? 'margen_mp' : 'margen_bruto'} valor={p.margen_q === null ? 'N/D' : fmtQ(p.margen_q)} sub={`${fmtPct(p.margen_pct_actual)} sobre ventas con costo`} />
            <Dato
              titulo="Margen año anterior"
              leyenda="vs_anio_anterior"
              valor={fmtPct(p.margen_pct_historico)}
              sub={p.delta_puntos === null ? 'sin ventas el año anterior' : `${p.delta_puntos > 0 ? '+' : ''}${p.delta_puntos.toFixed(1)} pts`}
              tono={p.delta_puntos < -1 ? 'text-red-500' : ''}
            />
            <Dato titulo="Precio / costo unitario" leyenda={p.es_cpp ? 'costo_cpp' : 'costo_unitario'} valor={fmtPrecio(p.precio_actual)} sub={`costo ${p.costo_actual === null ? 'N/D' : fmtPrecio(p.costo_actual)}`} />
          </div>

          {subeSugerido && (
            <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-xs uppercase tracking-wide text-amber-700 flex items-center gap-1">Precio para volver al margen del año anterior <Leyenda k="precio_sugerido" /></p>
              <p className="text-xl font-bold text-amber-700 tabular-nums">{fmtPrecio(p.precio_sugerido)}</p>
              <p className="text-xs text-[var(--text-muted)]">vs {fmtPrecio(p.precio_actual)} hoy (+{((p.precio_sugerido / p.precio_actual - 1) * 100).toFixed(1)}%)</p>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Cargando /><Cargando /></div>
          ) : meses.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Sin historial mensual.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Precio vs costo unitario por mes</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={meses} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                      <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} stroke="var(--text-muted)" interval="preserveStartEnd" minTickGap={20} />
                      <YAxis tickFormatter={(v) => `Q${Math.round(v).toLocaleString('es-GT')}`} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={64} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtMes} formatter={(v, n) => [fmtPrecio(v), n]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="precio" name="Precio" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                      <Line type="monotone" dataKey="costo" name="Costo" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Margen % por mes</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={meses} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                      <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} stroke="var(--text-muted)" interval="preserveStartEnd" minTickGap={20} />
                      <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={44} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtMes} formatter={(v) => [fmtPct(v), 'Margen']} />
                      <Bar dataKey="margen" radius={[3, 3, 0, 0]}>
                        {meses.map(m => <Cell key={m.mes} fill={m.en_periodo ? '#001639' : '#cbd5e1'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-[var(--text-muted)]">En azul oscuro, los meses del período seleccionado; en gris, el año previo.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-[var(--text-muted)] uppercase border-b border-[var(--border-default)]">
                      <th className="text-left py-2 pr-3 font-semibold">Mes</th>
                      <th className="text-right py-2 px-3 font-semibold">Unidades</th>
                      <th className="text-right py-2 px-3 font-semibold">Ventas</th>
                      <th className="text-right py-2 px-3 font-semibold">Precio</th>
                      <th className="text-right py-2 px-3 font-semibold">Costo</th>
                      <th className="text-right py-2 pl-3 font-semibold">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {[...meses].reverse().map(m => (
                      <tr key={m.mes} className={m.en_periodo ? '' : 'text-[var(--text-muted)]'}>
                        <td className="py-1.5 pr-3">{fmtMes(m.mes)}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{fmtInt(m.unidades)}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{fmtQ(m.ventas)}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{fmtPrecio(m.precio)}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">{fmtPrecio(m.costo)}</td>
                        <td className="py-1.5 pl-3 text-right tabular-nums font-medium">{fmtPct(m.margen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
