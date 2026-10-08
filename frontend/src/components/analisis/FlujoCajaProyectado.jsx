import { useState } from 'react'
import { BanknotesIcon, ChevronDownIcon, ChevronUpIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from 'recharts'
import { fmtM, fmtQ, fmtFechaCorta, tooltipStyle } from './formato'
import { Dato, CardCargando } from './ProyeccionVentas'
import { Leyenda } from '../common/leyendas'

const CERTEZA = {
  alta:  'badge-success',
  media: 'badge-warning',
  baja:  'badge',
}

/**
 * Flujo de caja operativo proyectado por semana. Es flujo NETO: no hay saldo
 * bancario en los datos, así que el acumulado parte de cero.
 * `data` es el payload de /api/analisis/flujo-caja o /api/tesoreria/proyeccion.
 */
export default function FlujoCajaProyectado({ data, isLoading, acciones }) {
  const [verTodo, setVerTodo] = useState(false)
  if (isLoading) return <CardCargando titulo="Flujo de caja proyectado" />
  if (!data) return null

  const { resumen, proyeccion, supuestos, excluido } = data
  const serie = proyeccion.map(p => ({
    ...p,
    etiqueta: `S${p.semana}`,
    // Las salidas se grafican hacia abajo.
    pagos_proveedores_neg: -p.pagos_proveedores,
    pagos_compras_proyectadas_neg: -p.pagos_compras_proyectadas,
  }))
  const filas = verTodo ? proyeccion : proyeccion.slice(0, 6)
  const negativas = resumen.semanas_con_neto_negativo || []

  return (
    <div className="card">
      <div className="section-header">
        <BanknotesIcon className="w-5 h-5 text-[var(--text-muted)]" />
        <h2 className="font-semibold">Flujo de caja proyectado</h2>
        <Leyenda k="flujo_neto" />
        <span className="hidden sm:inline text-xs text-[var(--text-muted)] ml-auto">{data.semanas} semanas · flujo neto, sin saldo inicial</span>
        {acciones}
      </div>

      <div className="px-5 pb-5 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Dato titulo="Entradas" leyenda="flujo_entradas" valor={fmtM(resumen.entradas_totales)} tono="text-[var(--success)]"
            nota="Cobro de cartera + ventas proyectadas" />
          <Dato titulo="Salidas" leyenda="flujo_salidas" valor={fmtM(resumen.salidas_totales)} tono="text-[var(--danger)]"
            nota="Proveedores + compras proyectadas" />
          <Dato titulo="Flujo neto acumulado" leyenda="flujo_neto" valor={fmtM(resumen.flujo_neto_total)}
            tono={resumen.flujo_neto_total >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}
            nota={`Punto más bajo: ${fmtM(resumen.flujo_acumulado_minimo)} (semana ${resumen.semana_minimo})`} />
          <Dato titulo="Semanas con salida neta" valor={`${negativas.length} de ${data.semanas}`}
            tono={negativas.length ? 'text-[var(--warning)]' : ''}
            nota={negativas.length ? `Semanas ${negativas.join(', ')}` : 'Todas las semanas entran más de lo que sale'} />
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={serie} stackOffset="sign" margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="etiqueta" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
            <YAxis tickFormatter={(v) => `Q${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={60} />
            <ReferenceLine y={0} stroke="var(--text-muted)" />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(_, items) => {
                const p = items?.[0]?.payload
                return p ? `Semana ${p.semana} · ${fmtFechaCorta(p.fecha_inicio)} – ${fmtFechaCorta(p.fecha_fin)}` : ''
              }}
              formatter={(v, k) => [fmtQ(Math.abs(v)), SERIES[k]?.nombre || k]}
            />
            <Legend formatter={(k) => SERIES[k]?.nombre || k} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="cobros_cartera" stackId="f" fill={SERIES.cobros_cartera.color} />
            <Bar dataKey="cobros_ventas_proyectadas" stackId="f" fill={SERIES.cobros_ventas_proyectadas.color} />
            <Bar dataKey="pagos_proveedores_neg" stackId="f" fill={SERIES.pagos_proveedores_neg.color} />
            <Bar dataKey="pagos_compras_proyectadas_neg" stackId="f" fill={SERIES.pagos_compras_proyectadas_neg.color} />
            <Line dataKey="flujo_acumulado" stroke="#001639" strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-secondary)] text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Semana</th>
                  <th className="text-right px-3 py-2 font-medium">Entradas</th>
                  <th className="text-right px-3 py-2 font-medium">Salidas</th>
                  <th className="text-right px-3 py-2 font-medium">Neto</th>
                  <th className="text-right px-3 py-2 font-medium">Acumulado</th>
                  <th className="text-right px-3 py-2 font-medium">Certeza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filas.map(p => (
                  <tr key={p.semana}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-medium">S{p.semana}</span>
                      <span className="text-xs text-[var(--text-muted)] ml-2">{fmtFechaCorta(p.fecha_inicio)} – {fmtFechaCorta(p.fecha_fin)}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--success)]">{fmtQ(p.entradas)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--danger)]">{fmtQ(p.salidas)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${p.neto >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                      {p.neto >= 0 ? '+' : '−'}{fmtQ(Math.abs(p.neto))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtQ(p.flujo_acumulado)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`${CERTEZA[p.certeza]} text-[10px]`} title={`${p.pct_documentado}% del movimiento ya existe como factura`}>
                        {p.certeza}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {proyeccion.length > 6 && (
            <button
              onClick={() => setVerTodo(!verTodo)}
              className="w-full py-2 text-sm text-[var(--accent-blue)] hover:bg-[var(--bg-secondary)] flex items-center justify-center gap-1"
            >
              {verTodo
                ? (<><ChevronUpIcon className="w-4 h-4" /> Mostrar menos</>)
                : (<><ChevronDownIcon className="w-4 h-4" /> Ver las {proyeccion.length} semanas</>)}
            </button>
          )}
        </div>

        <div className="flex gap-3 p-4 rounded-lg bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)]">
          <InformationCircleIcon className="w-5 h-5 flex-shrink-0 text-[var(--text-muted)]" />
          <div className="space-y-1">
            <p>
              <strong>No incluye:</strong> {excluido.no_disponible.join(', ')}. El flujo real será menor que el neto mostrado
              por lo que falta en salidas (sobre todo nómina e impuestos).
            </p>
            <p>
              <strong>Cómo se calcula:</strong> la cartera entra a su vencimiento más el atraso histórico de cada cliente;
              las ventas proyectadas se cobran a {supuestos.dias_cobro_ventas_nuevas} días y las compras se pagan a{' '}
              {supuestos.dias_pago_compras_nuevas} días (promedios reales de los últimos 12 meses). Lo ya vencido
              ({fmtM(supuestos.cobros_atrasados_repartidos)} por cobrar, {fmtM(supuestos.pagos_atrasados_repartidos)} por pagar)
              se reparte en las primeras {supuestos.semanas_reparto_atrasado} semanas.
            </p>
            <p>
              <strong>Excluido:</strong> {fmtM(excluido.cxp_por_depurar)} en {excluido.facturas_cxp_por_depurar.toLocaleString('es-GT')} facturas
              de proveedor vencidas a más de 90 días (por depurar en el ERP) y {fmtM(excluido.cxc_dudosa)} de cartera dudosa.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const SERIES = {
  cobros_cartera:                { nombre: 'Cobro de cartera',      color: '#059669' },
  cobros_ventas_proyectadas:     { nombre: 'Cobro ventas proyectadas', color: '#6EE7B7' },
  pagos_proveedores_neg:         { nombre: 'Pago a proveedores',    color: '#DC2626' },
  pagos_compras_proyectadas_neg: { nombre: 'Pago compras proyectadas', color: '#FCA5A5' },
  flujo_acumulado:               { nombre: 'Flujo neto acumulado',  color: '#001639' },
}
