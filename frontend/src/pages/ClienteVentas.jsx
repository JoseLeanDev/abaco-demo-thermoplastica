import { useState } from 'react'
import { useQuery } from 'react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeftIcon, ArrowTrendingUpIcon, BuildingStorefrontIcon,
  ChartBarIcon, CubeIcon, ReceiptPercentIcon, UserIcon,
} from '@heroicons/react/24/outline'
import { endpoints } from '../services/cfoApi'
import { usePeriodo } from '../context/PeriodoContext'
import { useAuth } from '../context/AuthContext'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'
import { Leyenda } from '../components/common/leyendas'
import FiltroProducto, { FILTRO_VACIO } from '../components/ventas/FiltroProducto'
import { Puente } from '../components/ventas/TabCategorias'
import {
  fmtM, fmtNum, fmtInt, fmtPct, fmtF, margenTone, Var, SinCosto,
  Kpi, Seccion, Senales, Pestanas, GraficaHistorial, LeyendaGrafica, HistorialLineas,
} from '../components/ventas/ficha'

// Resumen de ventas de un cliente: cuánto compra, cómo evoluciona, qué compra,
// con qué frecuencia y quién se lo vende. (Su cuenta por cobrar está en Tesorería.)

const TABS = [
  { id: 'resumen',   label: 'Resumen',             icon: ChartBarIcon },
  { id: 'productos', label: 'Productos',           icon: CubeIcon },
  { id: 'historial', label: 'Historial de compras', icon: ReceiptPercentIcon },
]

export default function ClienteVentas() {
  const { codigo } = useParams()
  const sinMargen = useAuth().oculta('/ventas', 'margen')
  const { desde, hasta } = usePeriodo()
  const [tab, setTab] = useState('resumen')
  const [producto, setProducto] = useState(FILTRO_VACIO)
  const prodParams = Object.fromEntries(Object.entries(producto).filter(([, v]) => v))

  const { data, isLoading, isError, error, isFetching } = useQuery(
    ['ventas-cliente', codigo, desde, hasta, JSON.stringify(prodParams)],
    () => endpoints.ventas.cliente(codigo, { desde, hasta, ...prodParams }),
    { keepPreviousData: true, retry: (n, e) => e?.response?.status !== 404 && n < 2 }
  )
  const d = data?.data
  // Con keepPreviousData, al cambiar de cliente no se muestra la ficha del anterior
  const vigente = d && d.cliente.codigo === codigo

  if (isError) {
    return (
      <div className="max-w-7xl space-y-4">
        <Volver />
        <div className="card p-10 text-center text-sm text-[var(--text-muted)]">
          No se pudo cargar el cliente. {error?.response?.data?.message || error?.message}
        </div>
      </div>
    )
  }
  if (isLoading || !vigente) return <Esqueleto />

  const { cliente: c, resumen: r, empresa: e } = d
  const senales = calcularSenales(d)

  return (
    <div className={`space-y-6 animate-fade-in max-w-7xl ${isFetching ? 'opacity-80' : ''}`}>
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <Volver />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BuildingStorefrontIcon className="w-5 h-5 text-[var(--text-muted)] shrink-0 hidden sm:block" />
              <h1 className="text-xl sm:text-2xl font-semibold leading-tight sm:truncate">{c.nombre}</h1>
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1 flex flex-wrap gap-x-2">
              <span>Código {c.codigo}</span>
              {c.sector && <span>· {c.sector}</span>}
              {c.tipo_cliente && <span>· {c.tipo_cliente}</span>}
              {c.vendedor && <span>· Vendedor principal: {c.vendedor}</span>}
            </p>
            <p className="text-sm text-[var(--text-muted)] flex flex-wrap gap-x-2">
              <span>Cliente desde {fmtF(c.primera_compra)}</span>
              <span>· Última compra: {fmtF(c.ultima_compra)} (hace {c.dias_sin_comprar} días)</span>
            </p>
            <PeriodoActivo className="mt-1" />
          </div>
        </div>
        <FiltroProducto value={producto} onChange={setProducto} />
      </div>

      <Senales senales={senales} leyenda="senales_cliente" />

      {/* KPIs */}
      <div className={`grid grid-cols-2 lg:grid-cols-3 gap-4 ${sinMargen ? 'xl:grid-cols-5' : 'xl:grid-cols-6'}`}>
        <Kpi titulo="Compras del período" leyenda="ventas" valor={fmtM(r.ventas)}
          delta={r.nuevo ? null : r.variacion_pct} sub={r.nuevo ? 'no compró en el año anterior' : `vs ${fmtM(r.ventas_prev)} año ant.`} />
        <Kpi titulo="% de las ventas" leyenda="participacion" valor={fmtPct(r.participacion, 2)}
          sub={r.posicion ? `#${r.posicion} de ${fmtInt(r.n_clientes)} clientes` : 'sin compras en el período'} />
        <Kpi titulo="Margen bruto" leyenda="margen_bruto" valor={fmtPct(r.margen_pct)} className="col-margen"
          tono={r.margen_pct === null || e.margen_pct === null ? undefined : r.margen_pct >= e.margen_pct ? 'success' : 'warning'}
          sub={<>empresa {fmtPct(e.margen_pct)}{r.margen_pct_prev !== null && <> · año ant. {fmtPct(r.margen_pct_prev)}</>}</>} />
        <Kpi titulo="Ticket promedio" leyenda="ticket_promedio" valor={r.ticket_promedio === null ? '—' : fmtM(r.ticket_promedio)}
          sub={`${fmtInt(r.facturas)} facturas`} />
        <Kpi titulo="Frecuencia de compra" leyenda="frecuencia_compra"
          valor={r.intervalo_compra === null ? '—' : `cada ${r.intervalo_compra} d`}
          sub={`${fmtInt(r.dias_compra)} días con compra en el período`} />
        <Kpi titulo="Productos comprados" leyenda="productos_skus" valor={fmtInt(r.skus)}
          sub={<>{d.n_articulos_nuevos} nuevos · {d.n_articulos_perdidos} dejó de comprar</>} />
      </div>

      <Pestanas tabs={TABS} tab={tab} onTab={setTab} />

      {tab === 'resumen'   && <TabResumen d={d} />}
      {tab === 'productos' && <TabProductos d={d} />}
      {tab === 'historial' && (
        <HistorialLineas filtro={{ codigo_cliente: c.codigo }} params={{ desde, hasta, ...prodParams }} quien="vendedor"
          archivo={c.codigo} placeholder="Buscar por artículo, factura o FEL…" />
      )}
    </div>
  )
}

// Señales automáticas a partir de los números de la ficha
function calcularSenales(d) {
  const { resumen: r, empresa: e, cliente: c } = d
  const s = []
  if (r.nuevo) s.push({ tipo: 'bien', texto: 'Cliente nuevo: no compró en el mismo período del año anterior.' })
  else if (r.variacion_pct !== null) {
    if (r.variacion_pct <= -10) s.push({ tipo: 'alerta', texto: `Compra ${fmtPct(Math.abs(r.variacion_pct))} menos que en el mismo período del año anterior (${fmtM(r.ventas_prev)} → ${fmtM(r.ventas)}).` })
    else if (r.variacion_pct >= 10) s.push({ tipo: 'bien', texto: `Compra ${fmtPct(r.variacion_pct)} más que en el mismo período del año anterior.` })
  }
  if (r.margen_pct !== null && e.margen_pct !== null) {
    const dif = r.margen_pct - e.margen_pct
    if (dif <= -5) s.push({ tipo: 'aviso', texto: `Su margen (${fmtPct(r.margen_pct)}) está ${Math.abs(dif).toFixed(1)} pts debajo del promedio de la empresa (${fmtPct(e.margen_pct)}).` })
    else if (dif >= 5) s.push({ tipo: 'bien', texto: `Su margen (${fmtPct(r.margen_pct)}) está ${dif.toFixed(1)} pts arriba del promedio de la empresa.` })
  }
  if (r.intervalo_compra !== null && c.dias_sin_comprar > 30 && c.dias_sin_comprar > r.intervalo_compra * 1.5) {
    s.push({ tipo: 'alerta', texto: `Lleva ${c.dias_sin_comprar} días sin comprar; en el período compró en promedio cada ${r.intervalo_compra} días.` })
  } else if (r.ventas === 0 && c.dias_sin_comprar > 30) {
    s.push({ tipo: 'alerta', texto: `No compra desde hace ${c.dias_sin_comprar} días.` })
  }
  if (d.n_articulos_perdidos > 0 && d.venta_perdida > 0) {
    s.push({ tipo: d.venta_perdida > r.ventas_prev * 0.15 ? 'alerta' : 'aviso', texto: `Dejó de comprar ${d.n_articulos_perdidos} productos que compró el año anterior (por ${fmtM(d.venta_perdida)}).` })
  }
  if (r.concentracion_top_articulo !== null && r.concentracion_top_articulo >= 50 && r.skus > 1) {
    s.push({ tipo: 'aviso', texto: `Un solo producto (${d.articulos[0].descripcion}) es el ${fmtPct(r.concentracion_top_articulo)} de lo que compra.` })
  }
  return s
}

// -------------------------------------------------------------------
// TAB: RESUMEN
// -------------------------------------------------------------------
function TabResumen({ d }) {
  const maxCat = Math.max(...d.categorias.map(c => c.ventas), 1)

  return (
    <div className="space-y-6">
      <Seccion icon={ChartBarIcon} titulo="Historial de compras (24 meses)" leyenda="historial_cliente" extra={<LeyendaGrafica />}>
        <GraficaHistorial serie={d.serie} ventana={d.ventana} detalle={(p) => (
          <p className="tabular-nums text-[var(--text-muted)]">{fmtInt(p.facturas)} facturas · {fmtInt(p.skus)} productos</p>
        )} />
      </Seccion>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Seccion icon={ArrowTrendingUpIcon} titulo="¿Por qué cambiaron sus compras?" leyenda="puente">
          {d.puente && d.puente.anterior > 0 ? (
            <Puente puente={d.puente} />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin compras en el período anterior para comparar.</p>
          )}
        </Seccion>

        <Seccion icon={CubeIcon} titulo="Compras por categoría" leyenda="jerarquia_producto">
          {d.categorias.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin compras en el período.</p>
          ) : (
            <div className="space-y-3">
              {d.categorias.map(c => (
                <div key={c.clave}>
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="nombre-articulo font-medium">{c.nombre}</span>
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="font-semibold">{fmtM(c.ventas)}</span>
                      <span className="text-xs text-[var(--text-muted)] ml-2">{fmtPct(c.participacion)}</span>
                      <span className="text-xs ml-2"><Var pct={c.variacion_pct} nuevo={c.nuevo} /></span>
                      <span className={`text-xs ml-2 col-margen ${margenTone(c.margen_pct)}`}>mg {fmtPct(c.margen_pct)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] mt-1">
                    <div className="h-1.5 rounded-full bg-[#001639]" style={{ width: `${(c.ventas / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Seccion>
      </div>

      <Seccion icon={UserIcon} titulo="Quién le vende" leyenda="vendedores_cliente" sinPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
              <tr className="text-xs text-[var(--text-muted)] uppercase">
                <th className="px-4 py-2.5 text-left font-semibold">Vendedor</th>
                <th className="px-3 py-2.5 text-right font-semibold">Facturas</th>
                <th className="px-3 py-2.5 text-right font-semibold">Ventas</th>
                <th className="px-3 py-2.5 text-right font-semibold">Año ant.</th>
                <th className="px-3 py-2.5 text-right font-semibold">Var.</th>
                <th className="px-4 py-2.5 text-right font-semibold">% del cliente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {d.vendedores.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Sin ventas.</td></tr>
              )}
              {d.vendedores.map(v => (
                <tr key={v.clave} className="text-sm hover:bg-[var(--bg-secondary)]">
                  <td className="px-4 py-2 font-medium">{v.vendedor}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(v.facturas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{v.ventas ? fmtM(v.ventas) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]">{v.ventas_prev ? fmtM(v.ventas_prev) : '—'}</td>
                  <td className="px-3 py-2 text-right">{v.perdido ? <span className="text-xs text-[var(--text-muted)]">sin ventas</span> : <Var pct={v.variacion_pct} nuevo={v.nuevo} />}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-[var(--text-secondary)]">{fmtPct(v.participacion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  )
}

// -------------------------------------------------------------------
// TAB: PRODUCTOS (los que compra y los que dejó de comprar)
// -------------------------------------------------------------------
function TabProductos({ d }) {
  const [verPerdidos, setVerPerdidos] = useState(false)
  const lista = verPerdidos ? d.articulos_perdidos : d.articulos

  return (
    <Seccion icon={CubeIcon} sinPadding
      titulo={verPerdidos ? `Productos que dejó de comprar (${fmtInt(d.n_articulos_perdidos)})` : `Productos que compra (${fmtInt(d.articulos.length)})`}
      leyenda={verPerdidos ? 'productos_dejo_comprar' : 'productos_skus'}
      extra={
        <div className="flex gap-1 text-xs">
          <button onClick={() => setVerPerdidos(false)} className={`px-3 py-1 rounded-md ${!verPerdidos ? 'bg-[var(--bg-tertiary)] font-semibold' : 'text-[var(--text-muted)]'}`}>Compra</button>
          <button onClick={() => setVerPerdidos(true)} className={`px-3 py-1 rounded-md ${verPerdidos ? 'bg-[var(--bg-tertiary)] font-semibold' : 'text-[var(--text-muted)]'}`}>
            Dejó de comprar {d.venta_perdida > 0 && `· ${fmtM(d.venta_perdida)}`}
          </button>
        </div>
      }>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
            <tr className="text-xs text-[var(--text-muted)] uppercase">
              <th className="px-4 py-2.5 text-left font-semibold">Artículo</th>
              <th className="px-3 py-2.5 text-left font-semibold">Categoría</th>
              {!verPerdidos && <th className="px-3 py-2.5 text-right font-semibold">Unidades <Leyenda k="unidades" /></th>}
              {!verPerdidos && <th className="px-3 py-2.5 text-right font-semibold">Precio prom. <Leyenda k="precio_promedio" /></th>}
              {!verPerdidos && <th className="px-3 py-2.5 text-right font-semibold">Compras</th>}
              <th className="px-3 py-2.5 text-right font-semibold">Año ant.</th>
              {!verPerdidos && <th className="px-3 py-2.5 text-right font-semibold">Var.</th>}
              {!verPerdidos && <th className="px-3 py-2.5 text-right font-semibold col-margen">Margen%</th>}
              {!verPerdidos && <th className="px-3 py-2.5 text-right font-semibold">% del cliente</th>}
              <th className="px-4 py-2.5 text-right font-semibold">{verPerdidos ? 'Precio prom. año ant.' : 'Última compra'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {lista.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{verPerdidos ? 'No dejó de comprar ningún producto.' : 'Sin compras en el período.'}</td></tr>
            )}
            {lista.map(a => (
              <tr key={a.codigo} className="text-sm hover:bg-[var(--bg-secondary)]">
                <td className="px-4 py-2">
                  <p className="font-medium nombre-articulo max-w-[340px]">{a.descripcion}</p>
                  <p className="text-xs text-[var(--text-muted)]">{a.codigo}</p>
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{a.categoria || '—'}</td>
                {!verPerdidos && <td className="px-3 py-2 text-right tabular-nums">{fmtNum(a.unidades)}</td>}
                {!verPerdidos && <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{a.precio_promedio === null ? '—' : `Q${fmtNum(a.precio_promedio)}`}</td>}
                {!verPerdidos && <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtM(a.ventas)}</td>}
                <td className={`px-3 py-2 text-right tabular-nums ${verPerdidos ? 'font-semibold text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>{a.ventas_prev ? fmtM(a.ventas_prev) : '—'}</td>
                {!verPerdidos && <td className="px-3 py-2 text-right"><Var pct={a.variacion_pct} nuevo={a.nuevo} /></td>}
                {!verPerdidos && (
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold col-margen ${margenTone(a.margen_pct)}`}>
                    {fmtPct(a.margen_pct)}
                    <SinCosto pct={a.pct_sin_costo} />
                  </td>
                )}
                {!verPerdidos && <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{fmtPct(a.participacion)}</td>}
                <td className="px-4 py-2 text-right tabular-nums text-[var(--text-secondary)] whitespace-nowrap">
                  {verPerdidos ? (a.precio_promedio_prev === null ? '—' : `Q${fmtNum(a.precio_promedio_prev)}`) : fmtF(a.ultima_venta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Seccion>
  )
}

// -------------------------------------------------------------------
// Piezas
// -------------------------------------------------------------------
function Volver() {
  return (
    <Link
      to="/ventas?tab=clientes"
      title="Volver a Clientes"
      className="w-10 h-10 shrink-0 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors"
    >
      <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
    </Link>
  )
}

function Esqueleto() {
  return (
    <div className="space-y-6 max-w-7xl animate-pulse">
      <div className="flex gap-4"><Volver /><div className="space-y-2"><div className="h-7 w-72 rounded bg-[var(--bg-tertiary)]" /><div className="h-4 w-96 max-w-full rounded bg-[var(--bg-tertiary)]" /></div></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-[var(--bg-tertiary)]" />)}
      </div>
      <div className="h-80 rounded-xl bg-[var(--bg-tertiary)]" />
    </div>
  )
}
