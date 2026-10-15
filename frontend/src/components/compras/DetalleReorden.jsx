import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea,
} from 'recharts'
import { endpoints } from '../../services/cfoApi'
import { Cargando, fmtMes, fmtPrecio, fmtQ, tooltipStyle } from './comun'

const SERVICIOS = [90, 95, 97.5, 99]
const n0 = (x) => Math.round(Number(x) || 0).toLocaleString('es-GT')
const n1 = (x, d = 1) => Number(x || 0).toLocaleString('es-GT', { maximumFractionDigits: d, minimumFractionDigits: d })
const DIA_MS = 86400000
const fmtDia = (dia) => new Date(Date.now() + dia * DIA_MS).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })

// Simula el inventario hacia adelante con la política (ROP, Q): consume d̄ por día;
// cuando la posición (disponible + pedidos en camino) toca el ROP se emite un pedido
// que llega L días después y sube la posición hasta ROP + Q.
function simular(c, L) {
  const d = c.demanda_diaria
  if (!(d > 0)) return { puntos: [], pedidos: [] }
  const ciclo = c.lote / d
  const H = Math.min(365, Math.max(120, Math.ceil(L + ciclo * 2.5)))
  let inv = c.posicion
  const enCamino = []
  const pedidos = []
  const puntos = []
  for (let dia = 0; dia <= H; dia++) {
    for (const p of enCamino.filter(p => p.llega === dia)) inv += p.q
    for (let i = enCamino.length - 1; i >= 0; i--) if (enCamino[i].llega === dia) enCamino.splice(i, 1)
    puntos.push({ dia, inv })
    const posicion = inv + enCamino.reduce((s, p) => s + p.q, 0)
    if (posicion <= c.rop) {
      const q = c.rop + c.lote - posicion
      const p = { emite: dia, llega: dia + L, q }
      enCamino.push(p)
      pedidos.push(p)
    }
    inv = Math.max(0, inv - d) // sin stock no se consume: venta perdida, no pendiente
  }
  return { puntos, pedidos: pedidos.filter(p => p.emite <= H), H }
}

function Formula({ nombre, expr, sustitucion, resultado, nota }) {
  return (
    <div className="py-2.5 border-b border-[var(--border-default)] last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm"><span className="font-semibold">{nombre}</span> <span className="font-mono text-[13px] text-[var(--text-secondary)]">= {expr}</span></p>
        <p className="font-mono text-sm tabular-nums">
          <span className="text-[var(--text-muted)]">= {sustitucion} =</span> <span className="font-bold text-[var(--text-primary)]">{resultado}</span>
        </p>
      </div>
      {nota && <p className="text-xs text-[var(--text-muted)] mt-0.5">{nota}</p>}
    </div>
  )
}

function Variable({ simbolo, nombre, valor, sub }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
      <p className="text-[11px] text-[var(--text-muted)]"><span className="font-mono font-semibold text-[var(--text-primary)]">{simbolo}</span> · {nombre}</p>
      <p className="text-base font-bold tabular-nums">{valor}</p>
      {sub && <p className="text-[11px] text-[var(--text-muted)]">{sub}</p>}
    </div>
  )
}

// Popup de Reposición: punto óptimo de reorden de un artículo, con la gráfica de
// dientes de sierra (existencias vs tiempo) y la fórmula con sus valores.
export default function DetalleReorden({ item, params, onClose }) {
  const [servicio, setServicio] = useState(95)
  const { data, isLoading, error } = useQuery(
    ['compras-reorden', item.codigo, params.meses_consumo, params.lead_time, params.horizonte_meses, servicio],
    () => endpoints.compras.reorden(item.codigo, { ...params, nivel_servicio: servicio }),
    { keepPreviousData: true, staleTime: 60_000 }
  )

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [onClose])

  const r = data?.data
  const c = r?.calculo
  const P = r?.parametros
  const L = P?.lead_time_dias || params.lead_time
  const sim = useMemo(() => (c ? simular(c, L) : { puntos: [], pedidos: [] }), [c, L])
  const primero = sim.pedidos[0]
  const mediaMensual = c?.demanda_mensual || 0
  const fuente = r?.fuente_demanda === 'ventas' ? 'ventas' : 'compras'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-xl bg-[var(--bg-primary)] shadow-2xl animate-fade-in">
        <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-default)] px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-muted)] truncate">{item.codigo} · {item.linea} · Punto de reorden</p>
            <h2 className="text-lg font-semibold">{item.descripcion}</h2>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <span className="text-[var(--text-muted)]">Nivel de servicio</span>
              <select value={servicio} onChange={(e) => setServicio(Number(e.target.value))} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-sm">
                {SERVICIOS.map(s => <option key={s} value={s}>{s}%</option>)}
              </select>
            </label>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]" aria-label="Cerrar">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error ? (
          <p className="p-6 text-sm text-red-500">No se pudo calcular: {error.message}</p>
        ) : isLoading || !c ? (
          <div className="p-6 space-y-4"><Cargando alto="h-72" /><Cargando alto="h-48" /></div>
        ) : !(c.demanda_diaria > 0) ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">Sin demanda en los últimos {P.meses_consumo} meses: no hay punto de reorden que calcular.</p>
        ) : (
          <div className="p-6 space-y-6">
            {/* Veredicto */}
            <div className={`p-4 rounded-lg border flex flex-wrap items-center gap-x-6 gap-y-2 ${c.posicion <= c.rop ? 'border-rose-500/30 bg-rose-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Punto de reorden</p>
                <p className="text-2xl font-bold tabular-nums">{n0(c.rop)} uds</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Posición hoy (stock + tránsito)</p>
                <p className="text-2xl font-bold tabular-nums">{n0(c.posicion)} uds</p>
              </div>
              <div className="flex-1 min-w-[240px]">
                {c.posicion <= c.rop ? (
                  <p className="text-sm"><span className="font-semibold text-rose-600">Pedir hoy {n0(c.cantidad_a_pedir)} uds</span> ({fmtQ(c.cantidad_a_pedir * c.costo_unitario)}). La posición está {n0(c.rop - c.posicion)} uds por debajo del punto de reorden{c.posicion < c.demanda_lead_time ? '; aun pidiendo hoy, el stock no alcanza a cubrir el lead time' : ''}.</p>
                ) : (
                  <p className="text-sm"><span className="font-semibold text-emerald-700">Pedir en ~{n0(c.dias_para_pedir)} días</span> (≈ {fmtDia(c.dias_para_pedir)}), cuando la posición baje a {n0(c.rop)} uds. Lote de {n0(c.lote)} uds.</p>
                )}
              </div>
            </div>

            {/* Gráfica dientes de sierra */}
            <div>
              <h3 className="text-sm font-semibold mb-1">Existencias proyectadas vs tiempo</h3>
              <p className="text-xs text-[var(--text-muted)] mb-2">
                Consumo constante de {n1(c.demanda_diaria)} uds/día desde hoy. Cuando la posición toca el punto de reorden se emite el pedido; llega {L} días después (lead time).
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={sim.puntos} margin={{ top: 20, right: 120, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                  <XAxis dataKey="dia" type="number" domain={[0, sim.H]} tickFormatter={fmtDia} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                  <YAxis tickFormatter={n0} tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={64} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => `${fmtDia(d)} (día ${d})`} formatter={(v) => [`${n0(v)} uds`, 'Existencias']} />
                  {primero && (
                    <ReferenceArea x1={primero.emite} x2={Math.min(primero.llega, sim.H)} fill="#001639" fillOpacity={0.06} label={{ value: `Lead time ${L}d`, position: 'insideTop', fontSize: 11, fill: 'var(--text-secondary)' }} />
                  )}
                  <ReferenceLine y={c.rop} stroke="#f59e0b" strokeDasharray="6 4" label={{ value: `Punto de reorden ${n0(c.rop)}`, position: 'right', fontSize: 11, fill: '#b45309' }} />
                  <ReferenceLine y={c.safety_stock} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `Stock de seguridad ${n0(c.safety_stock)}`, position: 'right', fontSize: 11, fill: '#b91c1c' }} />
                  {sim.pedidos.map((p, i) => (
                    <ReferenceLine key={`e${i}`} x={p.emite} stroke="#64748b" strokeDasharray="2 3" label={i === 0 ? { value: 'Pedido', position: 'top', fontSize: 10, fill: '#475569' } : undefined} />
                  ))}
                  {sim.pedidos.filter(p => p.llega <= sim.H).map((p, i) => (
                    <ReferenceLine key={`l${i}`} x={p.llega} stroke="#10b981" strokeDasharray="2 3" label={i === 0 ? { value: 'Recepción', position: 'top', fontSize: 10, fill: '#047857' } : undefined} />
                  ))}
                  <Line type="linear" dataKey="inv" stroke="#001639" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              {c.posicion < c.demanda_lead_time && (
                <p className="text-xs text-rose-600 mt-1">La línea toca cero antes de la primera recepción: con el stock actual habrá quiebre mientras llega el pedido.</p>
              )}
            </div>

            {/* Fórmula con valores */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                <h3 className="text-sm font-semibold mb-1">Fórmula usada</h3>
                <div className="p-3 rounded-lg bg-[#001639] text-white font-mono text-sm mb-2">
                  ROP = d̄ × L + SS &nbsp;&nbsp;&nbsp; SS = Z × σd × √L
                </div>
                <Formula
                  nombre="d̄ demanda diaria"
                  expr={`uds de ${fuente} en ${P.meses_consumo} meses ÷ (${P.meses_consumo} × 30)`}
                  sustitucion={`${n0(c.unidades_periodo)} ÷ ${P.meses_consumo * 30}`}
                  resultado={`${n1(c.demanda_diaria, 2)} uds/día`}
                />
                <Formula
                  nombre="σd desviación diaria"
                  expr="σ mensual ÷ √30"
                  sustitucion={`${n0(c.sigma_mensual)} ÷ 5.48`}
                  resultado={`${n1(c.sigma_diaria, 2)} uds/día`}
                  nota={`σ mensual = desviación estándar de las uds de ${fuente} en los últimos ${P.meses_consumo} meses completos.${c.coef_variacion !== null ? ` Coeficiente de variación ${n1(c.coef_variacion, 2)}${c.coef_variacion > 1 ? ': demanda muy irregular, por eso el stock de seguridad sale alto.' : '.'}` : ''}`}
                />
                <Formula
                  nombre="SS stock de seguridad"
                  expr="Z × σd × √L"
                  sustitucion={`${P.z} × ${n1(c.sigma_diaria, 2)} × √${L} (${n1(Math.sqrt(L), 2)})`}
                  resultado={`${n0(c.safety_stock)} uds`}
                />
                <Formula
                  nombre="Demanda en el lead time"
                  expr="d̄ × L"
                  sustitucion={`${n1(c.demanda_diaria, 2)} × ${L}`}
                  resultado={`${n0(c.demanda_lead_time)} uds`}
                />
                <Formula
                  nombre="ROP punto de reorden"
                  expr="d̄ × L + SS"
                  sustitucion={`${n0(c.demanda_lead_time)} + ${n0(c.safety_stock)}`}
                  resultado={`${n0(c.rop)} uds`}
                />
                <Formula
                  nombre="Q lote por pedido"
                  expr="d̄ × 30 × horizonte"
                  sustitucion={`${n1(c.demanda_diaria, 2)} × 30 × ${P.horizonte_meses}`}
                  resultado={`${n0(c.lote)} uds`}
                />
                <Formula
                  nombre="Pedido sugerido hoy"
                  expr="máx(0, ROP + Q − posición)"
                  sustitucion={`${n0(c.rop)} + ${n0(c.lote)} − ${n0(c.posicion)}`}
                  resultado={`${n0(c.cantidad_a_pedir)} uds`}
                  nota={`Valorizado a ${fmtPrecio(c.costo_unitario)} (último costo) = ${fmtQ(c.cantidad_a_pedir * c.costo_unitario)}.`}
                />
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Variables</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Variable simbolo="d̄" nombre="demanda diaria" valor={`${n1(c.demanda_diaria, 2)} uds`} sub={`${n0(c.demanda_mensual)} uds/mes`} />
                    <Variable simbolo="σd" nombre="desviación diaria" valor={`${n1(c.sigma_diaria, 2)} uds`} sub={`σ mensual ${n0(c.sigma_mensual)}`} />
                    <Variable simbolo="L" nombre="lead time" valor={`${L} días`} sub="selector Lead de la tabla" />
                    <Variable simbolo="Z" nombre="nivel de servicio" valor={P.z} sub={`${P.nivel_servicio}% de ciclos sin quiebre`} />
                    <Variable simbolo="N" nombre="meses de historia" valor={P.meses_consumo} sub={`demanda = ${fuente}`} />
                    <Variable simbolo="Pos." nombre="stock + tránsito" valor={`${n0(c.posicion)} uds`} sub={`${n0(c.stock_actual)} + ${n0(c.stock_transito)} tránsito`} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Demanda mensual ({fuente})</h3>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={r.serie} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                      <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 10 }} stroke="var(--text-muted)" interval="preserveStartEnd" minTickGap={16} />
                      <YAxis tickFormatter={n0} tick={{ fontSize: 10 }} stroke="var(--text-muted)" width={48} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtMes} formatter={(v) => [`${n0(v)} uds`, fuente === 'ventas' ? 'Vendido' : 'Comprado']} />
                      <ReferenceLine y={mediaMensual} stroke="#f59e0b" strokeDasharray="4 3" />
                      <Bar dataKey={fuente} fill="#001639" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-[11px] text-[var(--text-muted)]">Línea punteada: promedio {n0(mediaMensual)} uds/mes. El mes en curso va incompleto.</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)] border-t border-[var(--border-default)] pt-3">
              {fuente === 'ventas'
                ? 'La demanda se mide con las unidades vendidas (facturadas). '
                : 'Este artículo no se vende directo (materia prima o insumo): el ERP no registra su consumo, así que la demanda se aproxima con las unidades compradas. '}
              La tabla de reposición usa una regla más simple, stock de seguridad = 30% de la demanda en el lead time
              ({n0(c.safety_stock_tabla)} uds, punto de reorden {n0(c.rop_tabla)}); aquí se usa la fórmula estadística, que toma en cuenta qué tan irregular es la demanda.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
