import { useQuery } from 'react-query'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import {
  ArrowsRightLeftIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline'
import { endpoints } from '../../services/cfoApi'
import PageInsights from '../agents/PageInsights'
import { NIVELES_PRODUCTO, cambiarNivel } from '../ventas/FiltroProducto'
import { Cargando, Delta, Seccion, TIPO, TIPOS, fmtM, fmtMes, fmtQ, tooltipStyle } from './comun'

// Siguiente nivel de la jerarquía de producto según el filtro activo
export function nivelSiguiente(producto) {
  const i = NIVELES_PRODUCTO.findIndex(n => !producto[n.dim])
  return i === -1 ? { dim: 'articulo', singular: 'Artículo', plural: 'Artículos' } : NIVELES_PRODUCTO[i]
}

export default function TabResumen({ filtros, clave, r, cargando, setTab, tipo, setTipo, producto, setProducto, setProveedor }) {
  const nivel = nivelSiguiente(producto)
  const { data: provRes } = useQuery(
    ['compras-desglose', 'proveedor', clave],
    () => endpoints.compras.desglose({ ...filtros, dim: 'proveedor', limit: 500 }),
    { keepPreviousData: true }
  )
  const { data: catRes } = useQuery(
    ['compras-desglose', nivel.dim, clave],
    () => endpoints.compras.desglose({ ...filtros, dim: nivel.dim, limit: 500 }),
    { keepPreviousData: true }
  )

  if (cargando && !r.serie_mensual) return <div className="space-y-4"><Cargando /><Cargando /></div>

  const serie = r.serie_mensual || []
  const c = r.concentracion || {}
  const tiposConDatos = TIPOS.filter(t => serie.some(m => m[t.id] > 0))
  const provs = (provRes?.data?.items || []).slice(0, 8)
  const cats = (catRes?.data?.items || []).slice(0, 8)

  return (
    <div className="space-y-6">
      <PageInsights vertical="compras" maxInsights={4} />

      {c.top1_pct >= 25 && c.top1 && (
        <div className="rounded-lg border border-[var(--warning)] bg-[var(--warning-bg,#fff7ed)] p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-[var(--warning)]">Alta dependencia de un proveedor</p>
            <p className="text-[var(--text-secondary)]">
              <strong>{c.top1.nombre}</strong> representa el <strong>{c.top1_pct}%</strong> de las compras del período.
              Un retraso o alza de precio de ese proveedor pega directo en la operación: conviene tener una segunda fuente aprobada.
            </p>
          </div>
        </div>
      )}

      {/* Serie mensual */}
      <Seccion
        icon={ChartBarIcon}
        titulo="Compras por mes"
        leyenda="compras_mensual"
        subtitulo="Barras: período actual por tipo de compra · línea: mismo mes del año anterior"
      >
        {serie.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--text-muted)]">Sin compras en el período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={serie} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="periodo" tickFormatter={fmtMes} tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
              <YAxis tickFormatter={fmtM} tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={64} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={fmtMes}
                formatter={(v, name) => [fmtQ(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {tiposConDatos.map((t, i) => (
                <Bar key={t.id} dataKey={t.id} name={t.corto} stackId="a" fill={t.color}
                  radius={i === tiposConDatos.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
              <Line dataKey="total_prev" name="Año anterior" type="monotone" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Seccion>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composición */}
        <Seccion icon={Squares2X2Icon} titulo="¿En qué se gasta?" leyenda="tipo_compra" subtitulo="Clic en un tipo para filtrar toda la página">
          <div className="space-y-3">
            {(r.composicion || []).filter(t => t.gasto > 0 || t.gasto_prev > 0).map(t => {
              const activo = tipo === t.tipo
              return (
                <button
                  key={t.tipo}
                  onClick={() => setTipo(activo ? '' : t.tipo)}
                  className={`w-full text-left space-y-1.5 rounded-lg p-2 -m-2 transition-colors hover:bg-[var(--bg-secondary)] ${activo ? 'bg-[var(--bg-secondary)]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TIPO[t.tipo]?.color }} />
                      <span className="truncate font-medium">{t.label}</span>
                    </span>
                    <span className="flex items-baseline gap-2 whitespace-nowrap">
                      <span className="font-semibold tabular-nums">{fmtM(t.gasto)}</span>
                      <span className="text-xs text-[var(--text-muted)] tabular-nums w-12 text-right">{t.participacion}%</span>
                      <Delta v={t.variacion_pct} className="text-xs w-14 text-right" />
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(t.participacion, 0.5)}%`, background: TIPO[t.tipo]?.color }} />
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-4">La última columna es el cambio contra el mismo período del año anterior.</p>
        </Seccion>

        {/* Puente */}
        <Puente p={r.puente} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Seccion
          icon={BuildingOfficeIcon}
          titulo="Principales proveedores"
          leyenda="top_proveedores"
          extra={<VerTodo onClick={() => setTab('proveedores')} />}
        >
          <ListaBarras
            items={provs}
            onClick={(i) => setProveedor({ codigo: i.clave, nombre: i.nombre })}
            vacio="Sin proveedores en el filtro."
          />
        </Seccion>
        <Seccion
          icon={Squares2X2Icon}
          titulo={`Principales ${nivel.plural.toLowerCase()}`}
          leyenda="categorias_compras"
          extra={<VerTodo onClick={() => setTab('categorias')} />}
        >
          <ListaBarras
            items={cats}
            onClick={nivel.dim === 'articulo' ? null : (i) => setProducto(cambiarNivel(producto, nivel.dim, i.clave))}
            vacio="Sin compras en el filtro."
          />
        </Seccion>
      </div>
    </div>
  )
}

function VerTodo({ onClick }) {
  return (
    <button onClick={onClick} className="text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-0.5">
      Ver todo <ChevronRightIcon className="w-3 h-3" />
    </button>
  )
}

function ListaBarras({ items, onClick, vacio }) {
  if (!items.length) return <p className="text-sm text-[var(--text-muted)]">{vacio}</p>
  const max = Math.max(...items.map(i => i.gasto), 1)
  return (
    <div className="space-y-2.5">
      {items.map((i, idx) => {
        const Tag = onClick ? 'button' : 'div'
        return (
          <Tag
            key={i.clave}
            onClick={onClick ? () => onClick(i) : undefined}
            className={`w-full text-left block space-y-1 ${onClick ? 'hover:opacity-80' : ''}`}
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-[var(--text-muted)] tabular-nums w-5">{idx + 1}</span>
                <span className="truncate">{i.nombre}</span>
                {i.nuevo && <span className="badge-success text-[10px]">Nuevo</span>}
              </span>
              <span className="flex items-baseline gap-2 whitespace-nowrap">
                <span className="font-semibold tabular-nums">{fmtM(i.gasto)}</span>
                <span className="text-xs text-[var(--text-muted)] tabular-nums w-11 text-right">{i.participacion}%</span>
                <Delta v={i.variacion_pct} className="text-xs w-14 text-right" />
              </span>
            </div>
            <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden ml-7">
              <div className="h-full rounded-full bg-[#001639]" style={{ width: `${(i.gasto / max) * 100}%` }} />
            </div>
          </Tag>
        )
      })}
    </div>
  )
}

// Por qué cambió el gasto contra el año anterior
function Puente({ p }) {
  if (!p) return <Cargando />
  const pasos = [
    { k: 'precio',    label: 'Precio',                          desc: 'mismos artículos, pagados más caros o más baratos' },
    { k: 'volumen',   label: 'Volumen',                         desc: 'mismos artículos, más o menos unidades' },
    { k: 'nuevos',    label: 'Artículos nuevos',                desc: 'no se compraron el año anterior' },
    { k: 'dejados',   label: 'Artículos que ya no se compraron', desc: 'se compraron el año anterior y este no' },
    { k: 'servicios', label: 'Servicios y gastos',              desc: 'gastos, producción, importación y activo fijo' },
  ].filter(s => Math.abs(p[s.k]) >= 1)
  const max = Math.max(...pasos.map(s => Math.abs(p[s.k])), 1)
  const cambio = p.actual - p.anterior

  return (
    <Seccion icon={ArrowsRightLeftIcon} titulo="¿Por qué cambió el gasto?" leyenda="puente_compras" subtitulo="De lo comprado el año anterior a lo comprado este período">
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--text-secondary)]">Año anterior</span>
          <span className="font-semibold tabular-nums">{fmtM(p.anterior)}</span>
        </div>
        {pasos.map(s => {
          const v = p[s.k]
          return (
            <div key={s.k} className="space-y-1">
              <div className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium">{s.label}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{s.desc}</span>
                </span>
                <span className={`font-semibold tabular-nums whitespace-nowrap ${v >= 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
                  {v >= 0 ? '+' : '−'}{fmtM(Math.abs(v))}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${v >= 0 ? 'bg-[var(--warning)]' : 'bg-[var(--success)]'}`}
                  style={{ width: `${(Math.abs(v) / max) * 100}%` }}
                />
              </div>
            </div>
          )
        })}
        <div className="flex justify-between border-t border-[var(--border-default)] pt-3">
          <span className="font-semibold">Período actual</span>
          <span className="font-bold tabular-nums">
            {fmtM(p.actual)}{' '}
            <span className="text-xs font-medium text-[var(--text-muted)]">({cambio >= 0 ? '+' : '−'}{fmtM(Math.abs(cambio))})</span>
          </span>
        </div>
        {p.inflacion_pct !== null && (
          <p className="text-xs text-[var(--text-muted)]">
            En los artículos comprados en ambos períodos, los precios {p.inflacion_pct >= 0 ? 'subieron' : 'bajaron'} en promedio{' '}
            <strong className="text-[var(--text-secondary)]">{Math.abs(p.inflacion_pct).toFixed(1)}%</strong>.
          </p>
        )}
      </div>
    </Seccion>
  )
}
