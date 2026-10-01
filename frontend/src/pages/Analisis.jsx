import { Link } from 'react-router-dom'
import {
  HeartIcon,
  ArrowPathIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import PageInsights from '../components/agents/PageInsights'
import ProyeccionVentas, { CardCargando } from '../components/analisis/ProyeccionVentas'
import FlujoCajaProyectado from '../components/analisis/FlujoCajaProyectado'
import { fmtM, fmtQ, fmtPct, fmtDias, fmtMes, tooltipStyle } from '../components/analisis/formato'
import { useSaludFinanciera, useProyeccionVentas, useFlujoCaja } from '../hooks/useCfoData'

/**
 * Salud financiera: la única vista que cruza cartera, inventario y proveedores.
 * Las métricas fijas salen de las vistas analitica.v_ciclo_caja,
 * v_ciclo_caja_mensual, v_inventario_salud y v_capital_trabajo; el analista
 * diario (playbook "salud") lee las mismas vistas.
 */
export default function Analisis() {
  const { data: saludRes, isLoading: cargandoSalud, error } = useSaludFinanciera()
  const { data: ventasRes, isLoading: cargandoVentas } = useProyeccionVentas(6)
  const { data: flujoRes, isLoading: cargandoFlujo } = useFlujoCaja(13)
  const salud = saludRes?.data

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
          <HeartIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Salud financiera</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Ciclo de caja, capital de trabajo y proyecciones
            {salud?.ciclo?.fecha_corte && <> · datos al {String(salud.ciclo.fecha_corte).slice(0, 10)}</>}
          </p>
        </div>
      </div>

      <PageInsights vertical="salud" maxInsights={4} />

      {error && (
        <div className="card p-5 text-sm text-[var(--danger)]">
          No se pudieron calcular las métricas. Verifica que la migración 015 esté aplicada.
        </div>
      )}

      {cargandoSalud ? <CardCargando titulo="Indicadores" /> : salud && (
        <>
          <Kpis salud={salud} />
          <CicloCaja ciclo={salud.ciclo} mensual={salud.ciclo_mensual} />
        </>
      )}

      <ProyeccionVentas data={ventasRes?.data} isLoading={cargandoVentas} />

      <FlujoCajaProyectado
        data={flujoRes?.data}
        isLoading={cargandoFlujo}
        acciones={
          <Link to="/tesoreria/proyecciones" className="text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1 ml-auto sm:ml-3 whitespace-nowrap">
            Ver en Tesorería <ArrowRightIcon className="w-3 h-3" />
          </Link>
        }
      />

      {salud && <CapitalInmovilizado inventario={salud.inventario} ciclo={salud.ciclo} />}

      {salud && <CalidadDatos ciclo={salud.ciclo} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPIs de cabecera
// ---------------------------------------------------------------------------
function Kpis({ salud }) {
  const { ciclo, capital_trabajo: ct, inventario } = salud
  const inmov = sumar(inventario.por_clase_estado.filter(r => r.estado === 'inmovilizado'))
  const lento = sumar(inventario.por_clase_estado.filter(r => r.estado === 'lento'))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="kpi-card card-hover">
        <span className="kpi-label">Ciclo de caja</span>
        <p className="kpi-value">{fmtDias(ciclo.ciclo_caja)}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Cobro {Math.round(ciclo.dso)} + inventario {Math.round(ciclo.dio)} − pago {Math.round(ciclo.dpo)}
        </p>
      </div>
      <div className="kpi-card card-hover">
        <span className="kpi-label">Capital de trabajo</span>
        <p className="kpi-value">{fmtM(ct.capital_trabajo)}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {fmtPct(ct.capital_trabajo_pct_ventas)} de las ventas anuales
        </p>
      </div>
      <div className="kpi-card card-hover">
        <span className="kpi-label">Inventario inmovilizado</span>
        <p className="kpi-value text-[var(--warning)]">{fmtM(inmov)}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">+ {fmtM(lento)} de rotación lenta</p>
      </div>
      <div className="kpi-card card-hover">
        <span className="kpi-label">Caja que pide el crecimiento</span>
        <p className="kpi-value">{fmtM(ct.caja_requerida_crecimiento)}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Si las ventas vuelven a crecer {fmtPct(ct.crecimiento_pct)} en 12 meses
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ciclo de conversión de efectivo
// ---------------------------------------------------------------------------
function CicloCaja({ ciclo, mensual }) {
  const componentes = [
    { nombre: 'Días de cobro', sub: 'Cartera / ventas diarias', dias: ciclo.dso, valorDia: ciclo.valor_dia_cobro, accion: 'cobrar 10 días antes', color: '#2563EB' },
    { nombre: 'Días de inventario', sub: 'Inventario / costo de venta diario', dias: ciclo.dio, valorDia: ciclo.valor_dia_inventario, accion: 'bajar 10 días de inventario', color: '#D97706' },
    { nombre: 'Días de pago', sub: 'Proveedores / compras diarias', dias: ciclo.dpo, valorDia: ciclo.valor_dia_pago, accion: 'pagar 10 días después', color: '#059669', resta: true },
  ]
  const max = Math.max(...componentes.map(c => c.dias || 0), 1)

  return (
    <div className="card">
      <div className="section-header">
        <ArrowPathIcon className="w-5 h-5 text-[var(--text-muted)]" />
        <h2 className="font-semibold">Ciclo de conversión de efectivo</h2>
        <span className="text-xs text-[var(--text-muted)] ml-auto">Últimos 12 meses</span>
      </div>

      <div className="px-5 pb-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Desde que se paga una compra hasta que se cobra la venta pasan <strong>{fmtDias(ciclo.ciclo_caja)}</strong>.
            Ese es el tiempo que el efectivo queda atrapado en la operación.
          </p>
          {componentes.map(c => (
            <div key={c.nombre}>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-sm font-medium">{c.resta ? '− ' : ''}{c.nombre}</span>
                  <span className="text-xs text-[var(--text-muted)] ml-2">{c.sub}</span>
                </div>
                <span className="font-semibold tabular-nums whitespace-nowrap ml-2">{fmtDias(c.dias)}</span>
              </div>
              <div className="mt-1.5 h-2.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(c.dias / max) * 100}%`, background: c.color }} />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Si se logra {c.accion}, se liberan <strong className="text-[var(--text-primary)]">{fmtM(c.valorDia * 10)}</strong> de caja.
              </p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-sm font-medium mb-1">Días reales de cobro y pago, mes a mes</p>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Facturas cobradas o pagadas cada mes, ponderadas por monto. Si la distancia entre las líneas crece,
            la empresa financia más a sus clientes de lo que la financian sus proveedores.
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={mensual} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="anio_mes" tickFormatter={fmtMes} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={35} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtMes}
                formatter={(v, k) => [fmtDias(v), k === 'dias_cobro_real' ? 'Cobro' : 'Pago']} />
              <Legend formatter={(k) => (k === 'dias_cobro_real' ? 'Días de cobro' : 'Días de pago')} wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="dias_cobro_real" stroke="#2563EB" strokeWidth={2} dot={{ r: 2 }} />
              <Line dataKey="dias_pago_real" stroke="#059669" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Promedio 12 meses: cobro {fmtDias(ciclo.dias_cobro_real)}, pago {fmtDias(ciclo.dias_pago_real)}.
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Capital inmovilizado en inventario
// ---------------------------------------------------------------------------
const CLASES = [
  { id: 'materia_prima', nombre: 'Materia prima' },
  { id: 'producto', nombre: 'Producto' },
  { id: 'sin_movimiento', nombre: 'Sin movimiento' },
]
const ESTADOS = [
  { id: 'activo', nombre: 'Activo', color: '#059669' },
  { id: 'lento', nombre: 'Lento (>180 días)', color: '#F59E0B' },
  { id: 'inmovilizado', nombre: 'Inmovilizado', color: '#DC2626' },
]

function CapitalInmovilizado({ inventario, ciclo }) {
  const porClase = CLASES.map(c => {
    const fila = { clase: c.nombre }
    ESTADOS.forEach(e => {
      fila[e.id] = sumar(inventario.por_clase_estado.filter(r => r.clase === c.id && r.estado === e.id))
    })
    return fila
  })
  const inmov = sumar(inventario.por_clase_estado.filter(r => r.estado === 'inmovilizado'))

  return (
    <div className="card">
      <div className="section-header">
        <CubeIcon className="w-5 h-5 text-[var(--text-muted)]" />
        <h2 className="font-semibold">Capital inmovilizado en inventario</h2>
        <span className="text-xs text-[var(--text-muted)] ml-auto">Inventario total {fmtM(ciclo.inventario)} a costo</span>
      </div>

      <div className="px-5 pb-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              <strong>{fmtM(inmov)}</strong> están quietos: producto sin ventas en 180 días, materia prima que no se
              recompra hace un año o artículos sin ningún movimiento registrado.
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porClase} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `Q${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <YAxis type="category" dataKey="clase" tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={105} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, k) => [fmtQ(v), ESTADOS.find(e => e.id === k)?.nombre]} />
                <Legend formatter={(k) => ESTADOS.find(e => e.id === k)?.nombre} wrapperStyle={{ fontSize: 12 }} />
                {ESTADOS.map(e => <Bar key={e.id} dataKey={e.id} stackId="inv" fill={e.color} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Líneas con más inventario quieto</p>
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="text-left font-medium py-1">Línea</th>
                  <th className="text-right font-medium py-1">Inmovilizado</th>
                  <th className="text-right font-medium py-1">Lento</th>
                  <th className="text-right font-medium py-1">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {inventario.por_linea.map(l => (
                  <tr key={l.linea}>
                    <td className="py-1.5 pr-2">{l.linea}</td>
                    <td className="py-1.5 text-right tabular-nums text-[var(--danger)]">{l.inmovilizado ? fmtM(l.inmovilizado) : '—'}</td>
                    <td className="py-1.5 text-right tabular-nums text-[var(--warning)]">{l.lento ? fmtM(l.lento) : '—'}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtM(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Artículos inmovilizados de mayor valor</p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-secondary)] text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Artículo</th>
                  <th className="text-left px-3 py-2 font-medium">Línea</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-right px-3 py-2 font-medium">Valor</th>
                  <th className="text-right px-3 py-2 font-medium">Último movimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {inventario.top_inmovilizado.map(a => (
                  <tr key={a.codigo_articulo}>
                    <td className="px-3 py-2">
                      <p className="truncate max-w-xs" title={a.articulo}>{a.articulo}</p>
                      <p className="text-xs text-[var(--text-muted)]">{a.codigo_articulo}</p>
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{a.linea || '—'}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{CLASES.find(c => c.id === a.clase)?.nombre}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQ(a.valor)}</td>
                    <td className="px-3 py-2 text-right text-xs text-[var(--text-muted)] whitespace-nowrap">{ultimoMovimiento(a)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function ultimoMovimiento(a) {
  if (a.clase === 'producto' && a.ultima_venta) return `Venta hace ${a.dias_sin_venta} días`
  if (a.clase === 'materia_prima' && a.ultima_compra) return `Compra hace ${a.dias_sin_compra} días`
  return 'Sin registro'
}

// ---------------------------------------------------------------------------
// Notas de calidad de datos
// ---------------------------------------------------------------------------
function CalidadDatos({ ciclo }) {
  if (!ciclo.cxp_por_depurar && !ciclo.cxc_dudosa) return null
  return (
    <div className="flex gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900">
      <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">Fuera de estos cálculos</p>
        {ciclo.cxp_por_depurar > 0 && (
          <p>
            {fmtM(ciclo.cxp_por_depurar)} en {Number(ciclo.facturas_por_depurar).toLocaleString('es-GT')} facturas de proveedor vencidas
            hace más de 90 días. Como los pagos reales se hacen a {fmtDias(ciclo.dias_pago_real)}, lo más probable es que sean
            facturas sin cerrar en el ERP y no deuda real. Conviene depurarlas.
          </p>
        )}
        {ciclo.cxc_dudosa > 0 && (
          <p>{fmtM(ciclo.cxc_dudosa)} de cartera vencida hace más de 90 días, tratada como cobro dudoso.</p>
        )}
      </div>
    </div>
  )
}

const sumar = (filas) => filas.reduce((s, r) => s + (Number(r.valor) || 0), 0)
