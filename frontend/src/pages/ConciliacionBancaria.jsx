import { useEffect, useRef, useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import {
  ArrowLeftIcon, BuildingLibraryIcon, ScaleIcon, ClockIcon, ExclamationTriangleIcon,
  CheckCircleIcon, CalendarDaysIcon, ListBulletIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { endpoints } from '../services/cfoApi'
import { usePeriodo } from '../context/PeriodoContext'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'
import { Leyenda } from '../components/common/leyendas'

// Conciliación bancaria: movimientos de bancos de Profit (vst_ConciliacionBancaria) con su
// marca de conciliación. Saldos al corte (= fin del período del filtro global), en la
// moneda de cada cuenta. Backend: routes/conciliacionBancaria.js.

const SIMBOLO = { Q: 'Q', 'US$': 'US$', EU: '€' }
const fmtMon = (n, moneda = 'Q') => {
  const v = Number(n) || 0
  const s = Math.abs(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? '−' : ''}${SIMBOLO[moneda] || moneda} ${s}`
}
const fmtFecha = (d) => {
  if (!d) return '—'
  const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, dd).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
}
const diasEntre = (desde, hasta) => {
  if (!desde || !hasta) return null
  return Math.round((new Date(`${String(hasta).slice(0, 10)}T00:00:00`) - new Date(`${String(desde).slice(0, 10)}T00:00:00`)) / 864e5)
}
const ESTADO = {
  CONCILIADO: { label: 'Conciliado', cls: 'bg-emerald-50 text-emerald-700' },
  ANULADO: { label: 'Anulado', cls: 'bg-gray-100 text-gray-500' },
  DEPOSITO_EN_TRANSITO: { label: 'Depósito en tránsito', cls: 'bg-amber-50 text-amber-700' },
  CREDITO_PENDIENTE: { label: 'Crédito pendiente', cls: 'bg-amber-50 text-amber-700' },
  DEBITO_PENDIENTE: { label: 'Débito pendiente', cls: 'bg-rose-50 text-rose-700' },
  CHEQUE_EN_CIRCULACION: { label: 'Cheque en circulación', cls: 'bg-rose-50 text-rose-700' },
}
const Estado = ({ e }) => {
  const x = ESTADO[e] || { label: e || '—', cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${x.cls}`}>{x.label}</span>
}
const TRAMOS = ['0-30', '31-60', '61-90', '91-180', '180+']
const POR_PAGINA = 200

export default function ConciliacionBancaria() {
  const { params: periodo } = usePeriodo()
  const { data, isLoading, isError } = useQuery(
    ['conciliacion-bancaria', periodo], () => endpoints.tesoreria.conciliacion(periodo), { keepPreviousData: true }
  )
  const r = data?.data || {}
  const cuentas = r.cuentas || []
  const totales = r.totales_moneda || []
  const pendientes = r.pendientes || []
  const sospechosas = r.fechas_sospechosas || []
  const monedas = totales.map(t => t.moneda)
  const corte = r.corte

  // Movimientos del período (filtrables)
  const [cuenta, setCuenta] = useState('')
  const [estado, setEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [buscar, setBuscar] = useState('')
  const [limite, setLimite] = useState(POR_PAGINA)
  const [verSospechosas, setVerSospechosas] = useState(false)
  const movRef = useRef(null)
  useEffect(() => { const t = setTimeout(() => setBuscar(busqueda), 350); return () => clearTimeout(t) }, [busqueda])
  useEffect(() => { setLimite(POR_PAGINA) }, [cuenta, estado, buscar, periodo])
  const { data: movData, isFetching: cargandoMov } = useQuery(
    ['conciliacion-movimientos', periodo, cuenta, estado, buscar, limite],
    () => endpoints.tesoreria.conciliacionMovimientos({ ...periodo, cuenta, estado, busqueda: buscar, limit: limite }),
    { keepPreviousData: true }
  )
  const movs = movData?.data?.filas || []
  const totalMovs = movData?.data?.total_filas || 0
  const verCuenta = (cod) => {
    setCuenta(cod)
    movRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // KPI: la cuenta más atrasada en conciliación
  const atrasada = cuentas.filter(c => c.ultima_conciliacion).sort((a, b) => a.ultima_conciliacion.localeCompare(b.ultima_conciliacion))[0]
  const antig = (tramo, moneda) => (r.antiguedad || []).find(a => a.tramo === tramo && a.moneda === moneda)

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link to="/tesoreria" className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors">
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#001639] flex items-center justify-center">
              <BuildingLibraryIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Conciliación bancaria</h1>
              <p className="text-sm text-[var(--text-muted)] flex items-center gap-1">
                {isLoading ? 'Cargando…' : `${cuentas.length} cuentas · saldos al ${fmtFecha(corte)}`}
                {r.actualizado_en && <> · datos del ERP de {new Date(r.actualizado_en).toLocaleString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' })}</>}
                <Leyenda k="conc_actualizacion" />
              </p>
              <PeriodoActivo nota="saldos al cierre del período; movimientos con fecha en el período" className="mt-1" />
            </div>
          </div>
        </div>
      </div>

      {isError && <div className="card p-5 text-sm text-[var(--danger)]">No se pudo cargar la conciliación bancaria.</div>}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card card-hover">
          <span className="kpi-label flex items-center gap-1">Partidas pendientes al corte <Leyenda k="conc_pendientes" /></span>
          <p className={`kpi-value ${r.pendientes_total ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>{(r.pendientes_total || 0).toLocaleString('es-GT')}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {totales.filter(t => t.pendiente_n).map(t => fmtMon(t.diferencia, t.moneda)).join(' · ') || 'Todo conciliado'}
          </p>
        </div>
        <div className="kpi-card card-hover">
          <span className="kpi-label flex items-center gap-1">Conciliado en el período <Leyenda k="conc_pct" /></span>
          <p className="kpi-value">{r.periodo?.pct_conciliado != null ? `${r.periodo.pct_conciliado}%` : '—'}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {(r.periodo?.conciliados || 0).toLocaleString('es-GT')} de {(r.periodo?.movimientos || 0).toLocaleString('es-GT')} movimientos · {(r.periodo?.anulados || 0).toLocaleString('es-GT')} anulados
          </p>
        </div>
        <div className="kpi-card card-hover">
          <span className="kpi-label flex items-center gap-1">Última conciliación (más atrasada) <Leyenda k="conc_ultima" /></span>
          <p className="kpi-value">{atrasada ? fmtFecha(atrasada.ultima_conciliacion) : '—'}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {atrasada ? `${atrasada.banco} ${atrasada.cod_cta} · ${diasEntre(atrasada.ultima_conciliacion, corte)} días antes del corte` : ''}
          </p>
        </div>
        <div className="kpi-card card-hover">
          <span className="kpi-label flex items-center gap-1">Fechas por revisar en el ERP <Leyenda k="conc_sospechosas" /></span>
          <p className={`kpi-value ${sospechosas.length ? 'text-[var(--danger)]' : ''}`}>{sospechosas.length}</p>
          {sospechosas.length > 0 && (
            <button type="button" onClick={() => setVerSospechosas(v => !v)} className="text-xs text-[var(--accent-blue)] hover:underline mt-1">
              {verSospechosas ? 'Ocultar lista' : 'Ver movimientos'}
            </button>
          )}
        </div>
      </div>

      {/* Totales por moneda */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {totales.map(t => (
          <div key={t.moneda} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">{t.moneda === 'EU' ? 'Euros' : t.moneda === 'US$' ? 'Dólares' : 'Quetzales'}</span>
              <span className="text-xs text-[var(--text-muted)]">{t.cuentas} {t.cuentas === 1 ? 'cuenta' : 'cuentas'}</span>
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--text-secondary)] flex items-center gap-1">Saldo en libros <Leyenda k="conc_saldo_libros" /></dt><dd className="tabular-nums font-semibold">{fmtMon(t.saldo_libros, t.moneda)}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--text-secondary)] flex items-center gap-1">Según banco (est.) <Leyenda k="conc_saldo_banco" /></dt><dd className="tabular-nums">{fmtMon(t.saldo_banco, t.moneda)}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--text-secondary)] flex items-center gap-1">Diferencia <Leyenda k="conc_diferencia" /></dt><dd className={`tabular-nums ${t.diferencia ? 'text-[var(--warning)] font-medium' : 'text-[var(--success)]'}`}>{fmtMon(t.diferencia, t.moneda)}</dd></div>
            </dl>
          </div>
        ))}
      </div>

      {/* Fechas sospechosas */}
      {verSospechosas && (
        <div className="card">
          <div className="section-header">
            <ExclamationTriangleIcon className="w-5 h-5 text-[var(--danger)]" />
            <h2 className="font-semibold">Movimientos con fecha por revisar</h2>
            <Leyenda k="conc_sospechosas" />
          </div>
          <div className="p-5 pt-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--text-muted)] uppercase">
                  <th className="text-left font-semibold pb-2">Fecha en ERP</th>
                  <th className="text-left font-semibold pb-2">Registrado</th>
                  <th className="text-left font-semibold pb-2">Cuenta</th>
                  <th className="text-left font-semibold pb-2">Documento</th>
                  <th className="text-left font-semibold pb-2">Estado</th>
                  <th className="text-right font-semibold pb-2">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {sospechosas.map(s => (
                  <tr key={s.id_movimiento} className="text-sm">
                    <td className="py-2 pr-2 tabular-nums text-[var(--danger)]">{fmtFecha(s.fecha)}</td>
                    <td className="py-2 pr-2 tabular-nums text-[var(--text-secondary)]">{fmtFecha(s.fecha_registro)}</td>
                    <td className="py-2 pr-2">{s.banco} <span className="text-[var(--text-muted)]">{s.cod_cta}</span></td>
                    <td className="py-2 pr-2"><span className="font-medium">{s.doc_num}</span> <span className="text-xs text-[var(--text-muted)]">{s.tipo_operacion}</span><p className="text-xs text-[var(--text-muted)] truncate max-w-[320px]">{s.descripcion}</p></td>
                    <td className="py-2 pr-2"><Estado e={s.estado_conciliacion} /></td>
                    <td className="py-2 text-right tabular-nums">{fmtMon(s.monto_neto, s.moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Por cuenta */}
      <div className="card">
        <div className="section-header">
          <ScaleIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Libros vs banco por cuenta</h2>
          <span className="text-xs text-[var(--text-muted)]">al {fmtFecha(corte)}</span>
        </div>
        <div className="p-5 pt-0 overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="text-left font-semibold pb-2">Cuenta</th>
                <th className="text-right font-semibold pb-2"><span className="inline-flex items-center gap-1">Libros <Leyenda k="conc_saldo_libros" /></span></th>
                <th className="text-right font-semibold pb-2"><span className="inline-flex items-center gap-1">Según banco <Leyenda k="conc_saldo_banco" /></span></th>
                <th className="text-right font-semibold pb-2"><span className="inline-flex items-center gap-1">Diferencia <Leyenda k="conc_diferencia" /></span></th>
                <th className="text-right font-semibold pb-2"><span className="inline-flex items-center gap-1">Pendientes <Leyenda k="conc_pendientes" /></span></th>
                <th className="text-right font-semibold pb-2"><span className="inline-flex items-center gap-1">Última conciliación <Leyenda k="conc_ultima" /></span></th>
                <th className="text-right font-semibold pb-2"><span className="inline-flex items-center gap-1">Entradas / salidas período <Leyenda k="conc_movimientos" /></span></th>
                <th className="text-right font-semibold pb-2"><span className="inline-flex items-center gap-1">% concil. <Leyenda k="conc_pct" /></span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {isLoading && <tr><td colSpan={8} className="py-3 text-sm text-[var(--text-muted)]">Cargando…</td></tr>}
              {cuentas.map(c => {
                const dias = diasEntre(c.ultima_conciliacion, corte)
                return (
                  <tr key={c.cod_cta} onClick={() => verCuenta(c.cod_cta)} className={`text-sm hover:bg-[var(--bg-secondary)] cursor-pointer ${cuenta === c.cod_cta ? 'bg-[var(--bg-secondary)]' : ''}`}>
                    <td className="py-2 pr-2">
                      <p className="font-medium">{c.banco}</p>
                      <p className="text-xs text-[var(--text-muted)]">{c.cod_cta} · {c.num_cta} · {c.moneda}</p>
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fmtMon(c.saldo_libros, c.moneda)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtMon(c.saldo_banco, c.moneda)}</td>
                    <td className={`py-2 text-right tabular-nums ${c.diferencia ? 'text-[var(--warning)] font-medium' : 'text-[var(--text-muted)]'}`}>{fmtMon(c.diferencia, c.moneda)}</td>
                    <td className="py-2 text-right tabular-nums">{c.pendiente_n || <CheckCircleIcon className="w-4 h-4 inline text-[var(--success)]" />}</td>
                    <td className="py-2 text-right tabular-nums">
                      {fmtFecha(c.ultima_conciliacion)}
                      {dias != null && <p className={`text-xs ${dias > 31 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>{dias === 0 ? 'al corte' : `${dias} d antes`}</p>}
                    </td>
                    <td className="py-2 text-right tabular-nums text-xs">
                      <p className="text-[var(--success)]">+{fmtMon(c.entradas_periodo, c.moneda)}</p>
                      <p className="text-[var(--text-secondary)]">−{fmtMon(c.salidas_periodo, c.moneda)}</p>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {c.pct_conciliado != null ? `${c.pct_conciliado}%` : '—'}
                      <p className="text-xs text-[var(--text-muted)]">{c.mov_periodo.toLocaleString('es-GT')} mov.</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-[var(--text-muted)]">Clic en una cuenta filtra sus movimientos abajo. Montos en la moneda de cada cuenta.</p>
        </div>
      </div>

      {/* Antigüedad + pendientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="section-header">
            <ClockIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Antigüedad sin conciliar</h2>
            <Leyenda k="conc_antiguedad" />
          </div>
          <div className="p-5 pt-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--text-muted)] uppercase">
                  <th className="text-left font-semibold pb-2">Días</th>
                  {monedas.map(m => <th key={m} className="text-right font-semibold pb-2">{m}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {TRAMOS.map(tr => (
                  <tr key={tr} className="text-sm">
                    <td className="py-2 pr-2 text-[var(--text-secondary)]">{tr}</td>
                    {monedas.map(m => {
                      const a = antig(tr, m)
                      return (
                        <td key={m} className="py-2 text-right tabular-nums">
                          {a ? <>{fmtMon(a.monto, m)}<p className="text-xs text-[var(--text-muted)]">{a.n} {a.n === 1 ? 'partida' : 'partidas'}</p></> : <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="section-header">
            <CalendarDaysIcon className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold">Partidas en tránsito al {fmtFecha(corte)}</h2>
            <Leyenda k="conc_pendientes" />
          </div>
          <div className="p-5 pt-0 overflow-x-auto">
            {!isLoading && pendientes.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4 text-center">Sin partidas pendientes al corte.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-[var(--text-muted)] uppercase">
                    <th className="text-left font-semibold pb-2">Fecha</th>
                    <th className="text-left font-semibold pb-2">Cuenta</th>
                    <th className="text-left font-semibold pb-2">Documento</th>
                    <th className="text-left font-semibold pb-2">Estado</th>
                    <th className="text-right font-semibold pb-2">Días</th>
                    <th className="text-right font-semibold pb-2">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {pendientes.map(p => (
                    <tr key={p.id_movimiento} className="text-sm">
                      <td className="py-2 pr-2 tabular-nums whitespace-nowrap">
                        <span className={p.fecha_sospechosa ? 'text-[var(--danger)]' : ''}>{fmtFecha(p.fecha)}</span>
                        {p.fecha_sospechosa && <ExclamationTriangleIcon className="w-3.5 h-3.5 inline ml-1 text-[var(--danger)]" title="Fecha mal digitada en el ERP" />}
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap">{p.cod_cta} <span className="text-xs text-[var(--text-muted)]">{p.moneda}</span></td>
                      <td className="py-2 pr-2"><span className="font-medium">{p.doc_num}</span><p className="text-xs text-[var(--text-muted)] truncate max-w-[260px]">{p.descripcion || p.tercero}</p></td>
                      <td className="py-2 pr-2">
                        <Estado e={p.conciliado ? 'CONCILIADO' : p.estado_conciliacion} />
                        {p.conciliado && <p className="text-xs text-[var(--text-muted)]">después del corte ({fmtFecha(p.fecha_conciliacion)})</p>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{p.dias.toLocaleString('es-GT')}</td>
                      <td className={`py-2 text-right tabular-nums ${p.monto_neto < 0 ? 'text-[var(--danger)]' : ''}`}>{fmtMon(p.monto_neto, p.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Movimientos del período */}
      <div className="card" ref={movRef}>
        <div className="section-header">
          <ListBulletIcon className="w-5 h-5 text-[var(--text-muted)]" />
          <h2 className="font-semibold">Movimientos del período</h2>
          <span className="text-xs text-[var(--text-muted)]">{totalMovs.toLocaleString('es-GT')} movimientos{cargandoMov ? ' · actualizando…' : ''}</span>
        </div>
        <div className="px-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Buscar por documento, tercero o descripción…" value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)} className="input w-full pl-12" />
          </div>
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className="input sm:w-auto shrink-0">
            <option value="">Todas las cuentas</option>
            {cuentas.map(c => <option key={c.cod_cta} value={c.cod_cta}>{c.banco} {c.cod_cta} ({c.moneda})</option>)}
          </select>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input sm:w-auto shrink-0">
            <option value="todos">Todos los estados</option>
            <option value="conciliado">Conciliados al corte</option>
            <option value="pendiente">Pendientes al corte</option>
            <option value="anulado">Anulados</option>
          </select>
        </div>
        <div className="p-5 overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="text-left font-semibold pb-2">Fecha</th>
                <th className="text-left font-semibold pb-2">Cuenta</th>
                <th className="text-left font-semibold pb-2">Documento</th>
                <th className="text-left font-semibold pb-2">Tercero / descripción</th>
                <th className="text-left font-semibold pb-2">Estado</th>
                <th className="text-right font-semibold pb-2">Conciliado</th>
                <th className="text-right font-semibold pb-2">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {movs.length === 0 && !cargandoMov && <tr><td colSpan={7} className="py-4 text-sm text-center text-[var(--text-muted)]">Sin movimientos con estos filtros.</td></tr>}
              {movs.map(m => (
                <tr key={m.id_movimiento} className={`text-sm ${m.anulado ? 'opacity-60' : ''}`}>
                  <td className="py-2 pr-2 tabular-nums whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                  <td className="py-2 pr-2 whitespace-nowrap">{m.cod_cta} <span className="text-xs text-[var(--text-muted)]">{m.moneda}</span></td>
                  <td className="py-2 pr-2"><span className="font-medium">{m.doc_num || '—'}</span><p className="text-xs text-[var(--text-muted)]">{m.tipo_operacion}</p></td>
                  <td className="py-2 pr-2"><p className="truncate max-w-[300px]">{m.tercero || m.descripcion || '—'}</p>{m.tercero && m.descripcion && <p className="text-xs text-[var(--text-muted)] truncate max-w-[300px]">{m.descripcion}</p>}</td>
                  <td className="py-2 pr-2"><Estado e={m.estado_conciliacion} /></td>
                  <td className="py-2 pr-2 text-right tabular-nums text-[var(--text-secondary)] whitespace-nowrap">{m.conciliado ? fmtFecha(m.fecha_conciliacion) : '—'}</td>
                  <td className={`py-2 text-right tabular-nums whitespace-nowrap ${m.anulado ? 'line-through' : m.monto_neto < 0 ? 'text-[var(--text-secondary)]' : 'text-[var(--success)]'}`}>
                    {fmtMon(m.anulado ? (m.entrada || -m.salida) : m.monto_neto, m.moneda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {movs.length < totalMovs && (
            <div className="mt-4 text-center">
              <button type="button" onClick={() => setLimite(l => l + POR_PAGINA)} disabled={cargandoMov} className="btn-secondary disabled:opacity-60">
                {cargandoMov ? 'Cargando…' : `Ver más (${movs.length.toLocaleString('es-GT')} de ${totalMovs.toLocaleString('es-GT')})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
