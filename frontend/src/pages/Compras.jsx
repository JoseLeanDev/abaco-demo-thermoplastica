import { useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ReceiptPercentIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
  TagIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { usePeriodo } from '../context/PeriodoContext'
import { endpoints } from '../services/cfoApi'
import { PeriodoActivo } from '../components/common/FiltroPeriodo'
import { Leyenda } from '../components/common/leyendas'
import FiltroProducto, { FILTRO_VACIO, NIVELES_PRODUCTO } from '../components/ventas/FiltroProducto'
import { Delta, Kpi, TIPOS, exportarCSV, fmtInt, fmtM, fmtQ } from '../components/compras/comun'
import TabResumen from '../components/compras/TabResumen'
import TabProveedores from '../components/compras/TabProveedores'
import TabCategorias from '../components/compras/TabCategorias'
import TabPrecios from '../components/compras/TabPrecios'
import TabDetalle, { COLUMNAS_DETALLE } from '../components/compras/TabDetalle'
import Reposicion from '../components/compras/Reposicion'

const PESTANAS = [
  { id: 'resumen',     label: 'Resumen',     icon: ChartBarIcon },
  { id: 'proveedores', label: 'Proveedores', icon: BuildingOfficeIcon },
  { id: 'categorias',  label: 'Categorías',  icon: Squares2X2Icon },
  { id: 'precios',     label: 'Precios',     icon: TagIcon },
  { id: 'reposicion',  label: 'Reposición',  icon: ClipboardDocumentCheckIcon },
  { id: 'detalle',     label: 'Detalle',     icon: ReceiptPercentIcon },
]

export default function Compras() {
  const { params: periodo } = usePeriodo()
  const [tab, setTab] = useState('resumen')
  const [tipo, setTipo] = useState('')
  const [producto, setProducto] = useState(FILTRO_VACIO)
  const [proveedor, setProveedor] = useState(null) // { codigo, nombre }
  const [exportando, setExportando] = useState(false)

  // Filtros que aplican a todas las pestañas (menos Reposición)
  const filtros = {
    ...periodo,
    ...(tipo ? { tipo } : {}),
    ...Object.fromEntries(NIVELES_PRODUCTO.filter(n => producto[n.dim]).map(n => [n.dim, producto[n.dim]])),
    ...(proveedor ? { proveedor: proveedor.codigo } : {}),
  }
  const clave = JSON.stringify(filtros)

  const { data: rRes, isLoading, isPreviousData } = useQuery(
    ['compras-resumen', clave],
    () => endpoints.compras.resumen(filtros),
    { keepPreviousData: true }
  )
  const { data: pRes } = useQuery(
    ['compras-precios', clave],
    () => endpoints.compras.precios({ ...filtros, limit: 300 }),
    { keepPreviousData: true }
  )
  const r = rRes?.data || {}
  const precios = pRes?.data
  const cargando = isLoading || isPreviousData
  const hayFiltros = !!(tipo || proveedor || NIVELES_PRODUCTO.some(n => producto[n.dim]))

  const exportar = async () => {
    setExportando(true)
    try {
      const res = await endpoints.compras.detalle({ ...filtros, limit: 20000 })
      exportarCSV(`compras_${periodo.desde}_${periodo.hasta}.csv`, COLUMNAS_DETALLE, res?.data?.filas || [])
    } finally {
      setExportando(false)
    }
  }

  const ctx = { filtros, clave, r, precios, cargando, setTab, setTipo, tipo, producto, setProducto, proveedor, setProveedor }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="w-10 h-10 shrink-0 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors">
            <ArrowLeftIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-[#001639] flex items-center justify-center">
              <ShoppingCartIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold">Compras</h1>
              <p className="text-sm text-[var(--text-muted)]">
                {cargando ? 'Cargando…' : `${fmtInt(r.facturas)} facturas · ${fmtInt(r.proveedores)} proveedores · ${fmtInt(r.articulos)} artículos`}
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

      {/* Filtros: aplican a todo lo de abajo */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] mr-1">
            Tipo de compra <Leyenda k="tipo_compra" />
          </span>
          {[{ id: '', corto: 'Todas' }, ...TIPOS].map(t => {
            const activo = tipo === t.id
            return (
              <button
                key={t.id || 'todas'}
                onClick={() => setTipo(t.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  activo
                    ? 'border-[#001639] bg-[#001639] text-white'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                }`}
              >
                {t.color && <span className="w-2 h-2 rounded-full" style={{ background: activo ? '#fff' : t.color }} />}
                {t.corto}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <FiltroProducto value={producto} onChange={setProducto} fuente="compras" />
          {proveedor && (
            <span className="flex items-center gap-1 rounded-lg border border-[#001639] bg-[#001639] text-white px-2.5 py-1.5 text-sm">
              <span className="text-[10px] uppercase tracking-wide text-white/70">Proveedor</span>
              <span className="font-medium truncate max-w-[16rem]">{proveedor.nombre}</span>
              <button onClick={() => setProveedor(null)} className="ml-1 text-white/70 hover:text-white" aria-label="Quitar proveedor">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </span>
          )}
          {hayFiltros && (
            <button
              onClick={() => { setTipo(''); setProducto(FILTRO_VACIO); setProveedor(null) }}
              className="text-xs text-[var(--accent-blue)] hover:underline"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <KPIs r={r} precios={precios} cargando={cargando} onPrecios={() => setTab('precios')} onProveedores={() => setTab('proveedores')} />

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-[var(--border-default)] overflow-x-auto overflow-y-hidden">
        {PESTANAS.map(t => {
          const Icon = t.icon
          const activo = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activo ? 'border-[#001639] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-4 h-4" />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'resumen'     && <TabResumen {...ctx} />}
      {tab === 'proveedores' && <TabProveedores {...ctx} />}
      {tab === 'categorias'  && <TabCategorias {...ctx} />}
      {tab === 'precios'     && <TabPrecios {...ctx} />}
      {tab === 'reposicion'  && (
        <>
          <p className="text-xs text-[var(--text-muted)] -mt-2">
            La reposición mira hacia adelante desde hoy: usa el stock actual y el consumo de los últimos meses, no el filtro de fechas ni los de arriba.
          </p>
          <Reposicion />
        </>
      )}
      {tab === 'detalle'     && <TabDetalle {...ctx} />}

      <p className="text-xs text-[var(--text-muted)] italic">
        Fuente: facturas de compra del ERP (<code>vstCompras</code>), sincronizadas a diario. Montos sin IVA.
      </p>
    </div>
  )
}

function KPIs({ r, precios, cargando, onPrecios, onProveedores }) {
  if (cargando) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['Compras (sin IVA)', 'Variación de precios', 'Proveedores activos', 'Factura promedio'].map(l => (
          <div key={l} className="kpi-card">
            <span className="kpi-label">{l}</span>
            <span className="block h-7 w-24 mt-1 rounded bg-[var(--bg-tertiary)] animate-pulse" />
            <span className="block h-3 w-32 mt-2 rounded bg-[var(--bg-tertiary)] animate-pulse" />
          </div>
        ))}
      </div>
    )
  }
  const c = r.concentracion || {}
  const infl = precios?.inflacion_pct
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Kpi
        titulo="Compras (sin IVA)"
        leyenda="gasto_compras"
        valor={fmtM(r.gasto_sin_iva)}
        sub={<><Delta v={r.variacion_pct} /> vs {fmtM(r.gasto_prev_sin_iva)} año anterior</>}
      />
      <Kpi
        titulo="Variación de precios"
        leyenda="inflacion_compras"
        valor={infl === null || infl === undefined ? '—' : <Delta v={infl} invertir />}
        onClick={onPrecios}
        sub={precios
          ? precios.n_comparables > 0
            ? `${precios.efecto_precio >= 0 ? 'Pagaste ' + fmtM(precios.efecto_precio) + ' más' : 'Ahorraste ' + fmtM(-precios.efecto_precio)} por precio · ${fmtInt(precios.n_comparables)} artículos comparables`
            : 'Sin artículos comprados en ambos períodos'
          : '…'}
      />
      <Kpi
        titulo="Proveedores activos"
        leyenda="concentracion_proveedores"
        valor={fmtInt(r.proveedores)}
        onClick={onProveedores}
        sub={`${c.proveedores_80 ?? '—'} concentran el 80% · top 5 = ${c.top5_pct ?? 0}%`}
      />
      <Kpi
        titulo="Factura promedio"
        leyenda="factura_promedio"
        valor={r.factura_promedio ? fmtQ(r.factura_promedio) : '—'}
        sub={<>{fmtInt(r.facturas)} facturas · {fmtM(r.gasto_mensual_promedio)}/mes</>}
      />
    </div>
  )
}
