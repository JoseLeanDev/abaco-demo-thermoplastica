import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathRoundedSquareIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ChartPieIcon,
  LightBulbIcon,
  ListBulletIcon,
  BriefcaseIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { usePeriodo } from '../context/PeriodoContext'
import { endpoints } from '../services/cfoApi'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'
import { Leyenda } from '../components/common/leyendas'
import {
  Cargando, Delta, Kpi, Seccion, Th, exportarCSV, fmtFecha, fmtInt, fmtM, fmtMes, fmtQ, ordenar, td, th, tooltipStyle,
} from '../components/compras/comun'

/**
 * Gastos de Administración (subpágina de Gastos Operativos).
 *
 * El centro de costo "Administración" concentra ~74% del gasto operativo. En el
 * ERP cada gasto se registra con un artículo cuyo nombre es el concepto contable
 * (Alquileres, Agua y Energía Eléctrica…). Aquí se ven esos conceptos, agrupados
 * en rubros, y los cargos que se repiten todos los meses.
 * Ver GET /api/gastos/administracion.
 */

const COLORES = {
  instalaciones: '#001639',
  servicios: '#3b82f6',
  movilidad: '#f59e0b',
  personal: '#10b981',
  seguros: '#8b5cf6',
  oficina: '#06b6d4',
  otros: '#94a3b8',
}

export default function GastosAdministracion() {
  const { params: periodo } = usePeriodo()
  const [rubro, setRubro] = useState('')
  const [proveedor, setProveedor] = useState(null) // { codigo, nombre }
  const [concepto, setConcepto] = useState(null)   // codigo abierto en el panel
  const [exportando, setExportando] = useState(false)

  const filtros = { ...periodo, ...(rubro ? { rubro } : {}), ...(proveedor ? { proveedor: proveedor.codigo } : {}) }
  const { data, isLoading, isPreviousData } = useQuery(
    ['gastos-admin', JSON.stringify(filtros)],
    () => endpoints.gastos.administracion(filtros),
    { keepPreviousData: true }
  )
  const d = data?.data
  const cargando = isLoading || isPreviousData

  const exportar = async () => {
    setExportando(true)
    try {
      const res = await endpoints.gastos.detalle({
        ...periodo, centro_costo: 'Administración', codigo_proveedor: proveedor?.codigo || '', limit: 20000,
      })
      const filas = (res?.data?.filas || [])
      exportarCSV(`gastos_administracion_${periodo.desde}_${periodo.hasta}.csv`, [
        { label: 'Fecha', get: f => String(f.fecha_emision).slice(0, 10) },
        { label: 'Documento', get: f => `${f.tipo_doc} ${f.fact_num}` },
        { label: 'Código concepto', get: f => f.codigo_articulo },
        { label: 'Concepto', get: f => f.articulo },
        { label: 'Código proveedor', get: f => f.codigo_proveedor },
        { label: 'Proveedor', get: f => f.proveedor },
        { label: 'Total sin IVA', get: f => f.total_sin_iva.toFixed(2) },
        { label: 'IVA', get: f => f.iva.toFixed(2) },
        { label: 'Total con IVA', get: f => f.total_con_iva.toFixed(2) },
      ], filas)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/gastos-operativos" className="w-10 h-10 shrink-0 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors" title="Volver a Gastos Operativos">
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-[#001639] flex items-center justify-center">
              <BriefcaseIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold">Gastos de Administración</h1>
              <p className="text-sm text-[var(--text-muted)]">
                {cargando || !d ? 'Cargando…' : `${fmtInt(d.n_conceptos)} conceptos · ${fmtInt(d.n_proveedores)} proveedores · ${fmtInt(d.facturas)} facturas`}
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

      {!d ? (
        <div className="space-y-4"><Cargando alto="h-28" /><Cargando /><Cargando /></div>
      ) : (
        <div className={`space-y-6 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          <KPIs d={d} />
          <Hallazgos d={d} rubro={rubro} proveedor={proveedor} onConcepto={setConcepto} />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3"><Rubros d={d} rubro={rubro} setRubro={setRubro} /></div>
            <div className="lg:col-span-2"><Dona rubros={d.rubros} /></div>
          </div>
          <SerieMensual serie={d.serie_mensual} rubros={d.rubros_def} />
          <Conceptos conceptos={d.conceptos} dejados={d.conceptos_dejados} onConcepto={setConcepto} />
          <Recurrentes d={d} onConcepto={setConcepto} />
          <Proveedores items={d.proveedores} onProveedor={setProveedor} />
          <p className="text-xs text-[var(--text-muted)] italic">
            Fuente: facturas de compra del ERP con artículos de “Gastos de Operación” y centro de costo (sublínea) “Administración”.
            El concepto es el nombre del artículo de gasto; su código trae la cuenta contable (p. ej. 02GOA51106 → 5.1.1.06 Alquileres).
            Los rubros son una agrupación de la plataforma para leer los conceptos más fácil.
          </p>
        </div>
      )}

      {concepto && <PanelConcepto codigo={concepto} filtros={filtros} onClose={() => setConcepto(null)} />}
    </div>
  )
}

function KPIs({ d }) {
  const fijo = d.recurrentes.filter(r => r.estable).reduce((s, r) => s + r.mensual, 0)
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Kpi
        titulo="Gasto de administración"
        leyenda="gasto_admin"
        valor={fmtM(d.gasto)}
        sub={<><Delta v={d.variacion_pct} invertir /> vs {fmtM(d.gasto_prev)} año anterior</>}
      />
      <Kpi
        titulo="Del gasto operativo"
        leyenda="pct_operativo_admin"
        valor={d.pct_del_operativo === null ? '—' : `${d.pct_del_operativo}%`}
        sub={`de ${fmtM(d.gasto_operativo_total)} de gasto operativo total`}
      />
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
function Hallazgos({ d, rubro, proveedor, onConcepto }) {
  const items = []
  const top = d.rubros[0]
  if (top && !rubro && d.gasto > 0) {
    const cs = d.conceptos.filter(c => c.rubro === top.rubro).slice(0, 2).map(c => c.concepto)
    items.push(<><strong>{top.label}</strong> es el {top.participacion}% del gasto ({fmtM(top.mensual)}/mes), sobre todo {cs.join(' y ')}.</>)
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

function Rubros({ d, rubro, setRubro }) {
  return (
    <Seccion icon={ListBulletIcon} titulo="¿Cómo se divide?" leyenda="rubro_admin" subtitulo="Clic en un rubro para filtrar toda la página">
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

function SerieMensual({ serie, rubros }) {
  const conDatos = rubros.filter(r => serie.some(m => m[r.id] > 0))
  return (
    <Seccion icon={ChartBarIcon} titulo="Gasto por mes" leyenda="gasto_mensual_admin" subtitulo="Barras: período actual por rubro · línea: mismo mes del año anterior">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={serie} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
          <XAxis dataKey="periodo" tickFormatter={fmtMes} tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
          <YAxis tickFormatter={fmtM} tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={60} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtMes} formatter={(v, n) => [fmtQ(v), n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {conDatos.map((r, i) => (
            <Bar key={r.id} dataKey={r.id} name={r.label} stackId="a" fill={COLORES[r.id]} radius={i === conDatos.length - 1 ? [4, 4, 0, 0] : 0} />
          ))}
          <Line dataKey="total_prev" name="Año anterior" type="monotone" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </Seccion>
  )
}

function Conceptos({ conceptos, dejados, onConcepto }) {
  const [orden, setOrden] = useState({ col: 'gasto', dir: 'desc' })
  const items = useMemo(() => ordenar(conceptos, orden), [conceptos, orden])
  const exportar = () => exportarCSV('conceptos_administracion.csv', [
    { label: 'Código', get: c => c.codigo },
    { label: 'Concepto', get: c => c.concepto },
    { label: 'Rubro', get: c => c.rubro_label },
    { label: 'Gasto sin IVA', get: c => c.gasto.toFixed(2) },
    { label: 'Año anterior', get: c => c.gasto_prev.toFixed(2) },
    { label: 'Variación %', get: c => c.variacion_pct ?? '' },
    { label: '% del total', get: c => c.participacion },
    { label: 'Promedio mensual', get: c => c.mensual.toFixed(2) },
    { label: 'Facturas', get: c => c.facturas },
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
              <Th col="proveedor_principal" orden={orden} setOrden={setOrden} align="left">Proveedor principal</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin gastos en el filtro.</td></tr>
            )}
            {items.map(c => (
              <tr key={c.codigo} onClick={() => onConcepto(c.codigo)} className="hover:bg-[var(--bg-secondary)] cursor-pointer">
                <td className={`${td} max-w-[280px]`}>
                  <p className="font-medium truncate flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORES[c.rubro] }} />
                    <span className="truncate">{c.concepto}</span>
                    {c.nuevo && <span className="badge-info text-[10px]">Nuevo</span>}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] pl-3.5">{c.codigo} · {c.rubro_label}</p>
                </td>
                <td className={`${td} text-right tabular-nums font-semibold`}>{fmtQ(c.gasto)}</td>
                <td className={`${td} text-right tabular-nums`}>{c.participacion}%</td>
                <td className={`${td} text-right`}>
                  {c.nuevo ? <span className="text-xs text-[var(--text-muted)]">nuevo</span> : <Delta v={c.variacion_pct} invertir />}
                </td>
                <td className={`${td} text-right tabular-nums`}>{fmtQ(c.mensual)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmtInt(c.facturas)}</td>
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
      {dejados.length > 0 && (
        <p className="px-5 py-3 text-xs text-[var(--text-muted)] border-t border-[var(--border-default)]">
          Sin gasto este período (sí el año anterior): {dejados.map(c => `${c.concepto} (${fmtQ(c.gasto_prev)})`).join(' · ')}.
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
      subtitulo={`${d.recurrentes.length} cargos · ${fmtM(d.recurrente_mensual)} al mes (${fmtM(fijo)} fijos, ${fmtM(d.recurrente_mensual - fijo)} variables) · ${fmtM(d.recurrente_mensual * 12)} al año`}
      sinPadding
    >
      {d.recurrentes.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-[var(--text-muted)]">Hacen falta al menos 3 meses completos en el período para detectar cargos recurrentes.</p>
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

// Panel lateral con el detalle de un concepto
function PanelConcepto({ codigo, filtros, onClose }) {
  const { data, isLoading } = useQuery(
    ['gastos-admin-concepto', codigo, JSON.stringify(filtros)],
    () => endpoints.gastos.conceptoAdmin(codigo, filtros),
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
            <p className="text-xs text-[var(--text-muted)]">{codigo}{d?.rubro_label ? ` · ${d.rubro_label}` : ''}</p>
            <h2 className="text-lg font-semibold truncate">{d?.concepto || 'Cargando…'}</h2>
            {d && <p className="text-sm text-[var(--text-secondary)]">{fmtQ(d.gasto)} en el período · {fmtInt(d.lineas.length)} facturas</p>}
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
                        <td className={`${td} max-w-[220px] truncate`} title={l.proveedor}>{l.proveedor}</td>
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
