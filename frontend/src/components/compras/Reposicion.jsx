import { useState } from 'react'
import { useQuery } from 'react-query'
import {
  ArrowUpRightIcon,
  BoltIcon,
  ClipboardDocumentCheckIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  FireIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline'
import { endpoints } from '../../services/cfoApi'
import { Leyenda } from '../common/leyendas'

const fmtNum = (n) => Number(n || 0).toLocaleString('es-GT')

// Pestaña "Reposición" de Compras. Mira hacia adelante desde hoy: no depende del
// filtro de fechas (usa el consumo de los últimos N meses).
export default function Reposicion() {
  const [params, setParams] = useState({ horizonte_meses: 3, meses_consumo: 6, lead_time: 45 })
  const { data, isLoading } = useQuery(
    ['compras-recomendaciones', params.horizonte_meses, params.meses_consumo, params.lead_time],
    () => endpoints.compras.recomendaciones(params),
    { keepPreviousData: true, staleTime: 60_000 }
  )
  return <RecomendacionesSection reco={data?.data || {}} loading={isLoading} params={params} setParams={setParams} />
}

// =========================================================================
// RECOMENDACIONES DE REPOSICIÓN
// =========================================================================
const PRIORIDAD = {
  urgente: { label: 'Urgente', bg: 'bg-rose-500/10',   text: 'text-rose-600',   ring: 'ring-rose-500/40',   dot: 'bg-rose-500'  },
  alta:    { label: 'Alta',    bg: 'bg-amber-500/10',  text: 'text-amber-600',  ring: 'ring-amber-500/40',  dot: 'bg-amber-500' },
  media:   { label: 'Media',   bg: 'bg-sky-500/10',    text: 'text-sky-600',    ring: 'ring-sky-500/40',    dot: 'bg-sky-500'   },
  ok:      { label: 'OK',      bg: 'bg-emerald-500/10',text: 'text-emerald-600',ring: 'ring-emerald-500/40',dot: 'bg-emerald-500'},
}

function RecomendacionesSection({ reco, loading, params, setParams }) {
  const [tab, setTab] = useState('urgentes') // 'urgentes' | 'lineas' | 'todos'
  const [filtroLinea, setFiltroLinea] = useState('')
  const kpis = reco?.kpis || {}
  const lineas = reco?.lineas || []
  const urgentes = reco?.urgentes || []

  const urgentesFiltrados = filtroLinea
    ? urgentes.filter(u => u.linea === filtroLinea)
    : urgentes

  if (loading && !reco?.kpis) {
    return (
      <div className="card p-8">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-[var(--bg-secondary)] rounded w-1/3" />
          <div className="grid grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-20 bg-[var(--bg-secondary)] rounded" />)}
          </div>
          <div className="h-64 bg-[var(--bg-secondary)] rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Header con gradient */}
      <div className="bg-gradient-to-r from-[#001639] via-[#001a45] to-[#003a7a] p-5 text-white">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-amber-300" />
              <h2 className="text-lg font-bold text-white flex items-center gap-1.5">Recomendación de reposición <Leyenda k="reposicion" claro /></h2>
            </div>
            <p className="text-xs text-white/60 mt-1">
              Basado en consumo de {params.meses_consumo}m · lead time {params.lead_time}d · horizonte {params.horizonte_meses}m · safety stock 30%
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5">
              <span className="text-white/60">Horizonte</span>
              <select
                value={params.horizonte_meses}
                onChange={(e) => setParams(p => ({ ...p, horizonte_meses: +e.target.value }))}
                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs"
              >
                <option value={1}>1 mes</option>
                <option value={2}>2 meses</option>
                <option value={3}>3 meses</option>
                <option value={6}>6 meses</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-white/60">Lead</span>
              <select
                value={params.lead_time}
                onChange={(e) => setParams(p => ({ ...p, lead_time: +e.target.value }))}
                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs"
              >
                <option value={15}>15 días</option>
                <option value={30}>30 días</option>
                <option value={45}>45 días</option>
                <option value={60}>60 días</option>
                <option value={90}>90 días</option>
              </select>
            </label>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <RecoKpi
            label="SKUs urgentes"
            leyenda="prioridad_reposicion"
            value={kpis.skus_urgentes ?? 0}
            sublabel={`de ${kpis.skus_activos || 0} activos`}
            icon={FireIcon}
            tone="rose"
          />
          <RecoKpi
            label="Alta prioridad"
            leyenda="prioridad_reposicion"
            value={kpis.skus_alta ?? 0}
            sublabel="< 1.5x lead time"
            icon={ExclamationTriangleIcon}
            tone="amber"
          />
          <RecoKpi
            label="Valor sugerido"
            leyenda="reposicion"
            value={fmtQm(kpis.valor_sugerido_total)}
            sublabel={`Cobertura prom ${kpis.cobertura_promedio_dias || 0}d`}
            icon={BoltIcon}
            tone="emerald"
            isValue
          />
          <RecoKpi
            label="Inventario actual"
            leyenda="reposicion"
            value={fmtQm(kpis.valor_inventario_total)}
            sublabel={`${kpis.skus_ok || 0} SKUs OK · ${kpis.skus_media || 0} media`}
            icon={CubeIcon}
            tone="sky"
            isValue
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border-default)] flex items-center gap-1 px-4 bg-[var(--bg-secondary)]">
        <TabBtn active={tab === 'urgentes'} onClick={() => setTab('urgentes')} icon={FireIcon} count={kpis.skus_urgentes + kpis.skus_alta}>
          Acción inmediata
        </TabBtn>
        <TabBtn active={tab === 'lineas'} onClick={() => setTab('lineas')} icon={Squares2X2Icon} count={lineas.length}>
          Por línea
        </TabBtn>
      </div>

      {/* Contenido de tab */}
      {tab === 'lineas' && (
        <div className="p-5 space-y-3">
          {lineas.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">Sin líneas con consumo en el período.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {lineas.map(l => (
                <LineaCard
                  key={l.linea}
                  linea={l}
                  onFocus={() => { setFiltroLinea(l.linea); setTab('urgentes') }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'urgentes' && (
        <div className="p-5">
          {/* filtro por línea si aplica */}
          {filtroLinea && (
            <div className="mb-3 flex items-center gap-2 text-xs">
              <span className="text-[var(--text-muted)]">Línea:</span>
              <span className="badge-warning">{filtroLinea}</span>
              <button
                onClick={() => setFiltroLinea('')}
                className="text-[var(--accent-blue)] hover:underline"
              >
                limpiar
              </button>
            </div>
          )}
          {urgentesFiltrados.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">Nada urgente en el filtro actual.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border-default)]">
                    <th className="text-left  font-semibold py-2">Prioridad <Leyenda k="prioridad_reposicion" /></th>
                    <th className="text-left  font-semibold py-2">Artículo</th>
                    <th className="text-left  font-semibold py-2">Línea</th>
                    <th className="text-right font-semibold py-2">Stock</th>
                    <th className="text-right font-semibold py-2">Cobertura <Leyenda k="reposicion" /></th>
                    <th className="text-right font-semibold py-2">Consumo/mes</th>
                    <th className="text-right font-semibold py-2">Sugerido (uds) <Leyenda k="reposicion" /></th>
                    <th className="text-right font-semibold py-2">Valor sugerido</th>
                    <th className="text-left  font-semibold py-2 pl-3">Proveedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {urgentesFiltrados.map((u, i) => (
                    <SkuUrgenteRow key={u.codigo + i} item={u} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon: Icon, count, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-[#001639] text-[var(--text-primary)]'
          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
      {count > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full tabular-nums ${
          active ? 'bg-[#001639] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

function RecoKpi({ label, value, sublabel, icon: Icon, tone, isValue, leyenda }) {
  const toneCls = tone === 'rose'    ? 'text-rose-300'
                : tone === 'amber'   ? 'text-amber-300'
                : tone === 'emerald' ? 'text-emerald-300'
                : tone === 'sky'     ? 'text-sky-300'
                :                       'text-white'
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-white/60 font-semibold flex items-center gap-1">{label} {leyenda && <Leyenda k={leyenda} claro />}</span>
        <Icon className={`w-4 h-4 ${toneCls}`} />
      </div>
      <p className={`text-2xl font-bold tabular-nums leading-tight ${toneCls}`}>{isValue ? value : Number(value).toLocaleString('es-GT')}</p>
      <p className="text-[10px] text-white/50 mt-1">{sublabel}</p>
    </div>
  )
}

function LineaCard({ linea, onFocus }) {
  const total = linea.skus || 1
  const pctUrgente = (linea.skus_urgentes / total) * 100
  const pctAlta    = (linea.skus_alta    / total) * 100
  const pctMedia   = (linea.skus_media   / total) * 100
  const pctOk      = (linea.skus_ok      / total) * 100
  const priorityCls = linea.skus_urgentes > 0
    ? 'border-rose-500/40 bg-gradient-to-br from-rose-500/5 to-transparent'
    : linea.skus_alta > 0
      ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-transparent'
      : 'border-[var(--border-default)]'

  return (
    <button
      onClick={onFocus}
      className={`text-left rounded-lg border ${priorityCls} p-4 hover:shadow-md transition-all bg-[var(--bg-primary)] card-hover`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{linea.linea}</p>
          <p className="text-[11px] text-[var(--text-muted)] truncate">{linea.proveedor_top || 'Sin proveedor principal'}</p>
        </div>
        {linea.skus_urgentes > 0 && (
          <span className="text-[10px] uppercase font-bold tracking-wider bg-rose-500/10 text-rose-600 px-1.5 py-0.5 rounded ring-1 ring-rose-500/30">
            {linea.skus_urgentes} urg
          </span>
        )}
      </div>

      {/* Stack bar por prioridad */}
      <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex mb-2">
        {pctUrgente > 0 && <div className="bg-rose-500 h-full" style={{ width: `${pctUrgente}%` }} />}
        {pctAlta    > 0 && <div className="bg-amber-500 h-full" style={{ width: `${pctAlta}%` }} />}
        {pctMedia   > 0 && <div className="bg-sky-500 h-full" style={{ width: `${pctMedia}%` }} />}
        {pctOk      > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${pctOk}%` }} />}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div>
          <p className="text-[var(--text-muted)]">SKUs</p>
          <p className="font-semibold tabular-nums">{linea.skus}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Cobertura</p>
          <p className={`font-semibold tabular-nums ${linea.cobertura_dias < 30 ? 'text-rose-500' : linea.cobertura_dias < 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {linea.cobertura_dias !== null ? `${linea.cobertura_dias}d` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Inventario</p>
          <p className="font-semibold tabular-nums">{fmtQm(linea.valor_inventario)}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Sugerido</p>
          <p className="font-bold tabular-nums text-[var(--accent-blue)]">{fmtQm(linea.valor_sugerido_total)}</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--border-default)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span>Ver detalle</span>
        <ArrowUpRightIcon className="w-3 h-3" />
      </div>
    </button>
  )
}

function SkuUrgenteRow({ item }) {
  const p = PRIORIDAD[item.prioridad] || PRIORIDAD.media
  const stockCritico = item.dias_cobertura !== null && item.dias_cobertura < item.lead_time_dias
  return (
    <tr className="text-xs hover:bg-[var(--bg-secondary)]">
      <td className="py-2 pr-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.bg} ${p.text} ring-1 ${p.ring}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
          {p.label}
        </span>
      </td>
      <td className="py-2 pr-3 max-w-[280px]">
        <p className="font-semibold truncate text-[var(--text-primary)]">{item.descripcion}</p>
        <p className="text-[10px] text-[var(--text-muted)]">{item.codigo}</p>
      </td>
      <td className="py-2 pr-2 text-[var(--text-secondary)]">
        <p className="truncate max-w-[110px]">{item.linea}</p>
      </td>
      <td className="py-2 text-right tabular-nums">
        <p className={`font-semibold ${stockCritico ? 'text-rose-500' : ''}`}>{fmtNum(Math.round(item.stock_actual))}</p>
        {item.stock_transito > 0 && (
          <p className="text-[10px] text-[var(--text-muted)]">+{fmtNum(Math.round(item.stock_transito))} tránsito</p>
        )}
      </td>
      <td className="py-2 text-right tabular-nums">
        {item.dias_cobertura === null ? (
          <span className="text-rose-500 font-bold">0d</span>
        ) : (
          <span className={`font-bold ${item.dias_cobertura < item.lead_time_dias ? 'text-rose-500' : item.dias_cobertura < item.lead_time_dias * 1.5 ? 'text-amber-500' : 'text-[var(--text-primary)]'}`}>
            {item.dias_cobertura}d
          </span>
        )}
        <p className="text-[10px] text-[var(--text-muted)]">vs {item.lead_time_dias}d lead</p>
      </td>
      <td className="py-2 text-right tabular-nums text-[var(--text-secondary)]">
        {fmtNum(Math.round(item.consumo_mensual))}
      </td>
      <td className="py-2 text-right tabular-nums font-semibold">
        {fmtNum(item.cantidad_sugerida)}
      </td>
      <td className="py-2 text-right tabular-nums font-bold text-[var(--accent-blue)]">
        {fmtQm(item.valor_sugerido)}
      </td>
      <td className="py-2 pl-3 max-w-[180px]">
        <p className="truncate text-[var(--text-secondary)]">{item.proveedor_sugerido}</p>
        {item.proveedor_dias_credito !== null && (
          <p className="text-[10px] text-[var(--text-muted)]">crédito {item.proveedor_dias_credito}d</p>
        )}
      </td>
    </tr>
  )
}

// Helper Q compact para recomendaciones
function fmtQm(n) {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `Q${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `Q${Math.round(v / 1e3)}k`
  return `Q${Math.round(v).toLocaleString('es-GT')}`
}
