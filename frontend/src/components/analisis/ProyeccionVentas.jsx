import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { fmtM, fmtQ, fmtPct, fmtMes, tooltipStyle } from './formato'
import { Leyenda } from '../common/leyendas'

/**
 * Proyección de ventas mensuales (sin IVA): historia real, lo que el modelo habría
 * dicho en los últimos meses (backtest) y los próximos meses con su rango.
 * `data` es el payload de /api/analisis/proyeccion-ventas.
 */
export default function ProyeccionVentas({ data, isLoading }) {
  if (isLoading) return <CardCargando titulo="Proyección de ventas" />
  if (!data) return null

  const backtest = new Map(data.backtest.map(b => [b.mes, b.pronostico]))
  const ultimoReal = data.historia[data.historia.length - 1]
  const serie = [
    ...data.historia.map(h => ({
      mes: h.mes,
      real: h.real,
      modelo: backtest.get(h.mes) ?? null,
      // Une la línea proyectada con el último mes real para que no quede un hueco.
      pronostico: h.mes === ultimoReal?.mes ? h.real : null,
    })),
    ...data.proyeccion.map(p => ({
      mes: p.mes,
      pronostico: p.pronostico,
      base: p.minimo,
      banda: p.maximo - p.minimo,
      parcial: p.real_parcial,
    })),
  ]

  const variacion = data.total_mismo_periodo_anterior
    ? (data.total_proyectado / data.total_mismo_periodo_anterior - 1) * 100
    : null
  const n = data.proyeccion.length
  const primero = data.proyeccion[0]

  return (
    <div className="card">
      <div className="section-header">
        <ArrowTrendingUpIcon className="w-5 h-5 text-[var(--text-muted)]" />
        <h2 className="font-semibold">Proyección de ventas</h2>
        <Leyenda k="proyeccion_ventas" />
        <span className="hidden sm:inline text-xs text-[var(--text-muted)] ml-auto">Sin IVA · próximos {n} meses</span>
      </div>

      <div className="px-5 pb-5 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Dato titulo={`Próximos ${n} meses`} leyenda="proyeccion_ventas" valor={fmtM(data.total_proyectado)}
            nota={variacion !== null ? `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}% vs mismo periodo año anterior` : null} />
          <Dato titulo="Crecimiento interanual" leyenda="crecimiento_interanual" valor={fmtPct(data.crecimiento_interanual_pct)}
            nota="Últimos 12 meses vs los 12 anteriores" />
          <Dato titulo="Error típico del modelo" leyenda="error_modelo" valor={`±${fmtPct(data.error_tipico_pct, 0)}`}
            nota={data.mape_backtest_pct !== null ? `Error medio de los últimos 6 meses: ${fmtPct(data.mape_backtest_pct)}` : null} />
          <Dato
            titulo={primero ? `Cierre ${primero.etiqueta}${primero.real_parcial != null ? ' (en curso)' : ''}` : 'Próximo mes'}
            valor={fmtM(primero?.pronostico)}
            nota={primero
              ? (primero.real_parcial != null
                ? `Llevan ${fmtM(primero.real_parcial)} · rango ${fmtM(primero.minimo)} – ${fmtM(primero.maximo)}`
                : `Rango ${fmtM(primero.minimo)} – ${fmtM(primero.maximo)}`)
              : null} />
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={serie} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
            <YAxis tickFormatter={(v) => `Q${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={55} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={fmtMes}
              formatter={(v, k, item) => {
                if (k === 'banda') return [`${fmtQ(item.payload.base)} – ${fmtQ(item.payload.base + v)}`, 'Rango probable']
                return [fmtQ(v), LEYENDA[k] || k]
              }}
            />
            <Legend formatter={(k) => LEYENDA[k] || k} payload={LEYENDA_ITEMS} wrapperStyle={{ fontSize: 12 }} />
            <Area dataKey="base" stackId="rango" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" tooltipType="none" />
            <Area dataKey="banda" stackId="rango" stroke="none" fill="#2563EB" fillOpacity={0.12} isAnimationActive={false} />
            <Line dataKey="real" stroke="#001639" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
            <Line dataKey="modelo" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls={false} />
            <Line dataKey="pronostico" stroke="#2563EB" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 2 }} connectNulls />
            <Line dataKey="parcial" stroke="none" dot={{ r: 4, fill: '#D97706' }} />
          </ComposedChart>
        </ResponsiveContainer>

        <p className="text-xs text-[var(--text-muted)]">
          Método: {data.metodo}. Datos al {data.fecha_corte}; el último mes completo es {fmtMes(data.ultimo_mes_completo)}.
          La línea gris muestra lo que el modelo habría pronosticado un mes antes, para juzgar su precisión.
        </p>
      </div>
    </div>
  )
}

const LEYENDA = {
  real: 'Real',
  modelo: 'Modelo (a un mes vista)',
  pronostico: 'Proyección',
  banda: 'Rango probable (~80%)',
  parcial: 'Real a la fecha (mes en curso)',
}
const LEYENDA_ITEMS = [
  { value: 'real', type: 'line', color: '#001639' },
  { value: 'modelo', type: 'line', color: '#9CA3AF' },
  { value: 'pronostico', type: 'line', color: '#2563EB' },
  { value: 'banda', type: 'square', color: '#BFD3F9' },
  { value: 'parcial', type: 'circle', color: '#D97706' },
]

export function Dato({ titulo, valor, nota, tono, leyenda }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">{titulo} {leyenda && <Leyenda k={leyenda} />}</p>
      <p className={`text-lg font-semibold tabular-nums ${tono || ''}`}>{valor}</p>
      {nota && <p className="text-xs text-[var(--text-muted)] mt-0.5">{nota}</p>}
    </div>
  )
}

export function CardCargando({ titulo }) {
  return (
    <div className="card p-5">
      <p className="font-semibold mb-3">{titulo}</p>
      <div className="h-48 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
    </div>
  )
}
