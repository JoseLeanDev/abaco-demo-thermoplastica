// Lógica compartida de la página de Inventario. El backend (/inventario/analitica)
// manda una fila por artículo; aquí se filtra y se agrega en el navegador.

import { NIVELES_PRODUCTO } from '../ventas/FiltroProducto'

export const CLASES = [
  { id: 'producto',       label: 'Producto terminado', corto: 'Producto',       color: '#001639' },
  { id: 'materia_prima',  label: 'Materia prima',      corto: 'Materia prima',  color: '#3b82f6' },
  { id: 'sin_movimiento', label: 'Sin movimiento',     corto: 'Sin movimiento', color: '#94a3b8' },
]
export const CLASE = Object.fromEntries(CLASES.map(c => [c.id, c]))

export const ESTADOS = [
  { id: 'activo',       label: 'Activo',       color: '#10b981', cls: 'text-emerald-600 bg-emerald-500/10 ring-emerald-500/30' },
  { id: 'lento',        label: 'Lento',        color: '#f59e0b', cls: 'text-amber-600 bg-amber-500/10 ring-amber-500/30' },
  { id: 'inmovilizado', label: 'Inmovilizado', color: '#f43f5e', cls: 'text-rose-600 bg-rose-500/10 ring-rose-500/30' },
  { id: 'sin_stock',    label: 'Sin stock',    color: '#94a3b8', cls: 'text-slate-500 bg-slate-500/10 ring-slate-500/30' },
]
export const ESTADO = Object.fromEntries(ESTADOS.map(e => [e.id, e]))

export const ABCS = [
  { id: 'A', label: 'A', desc: '80% de la salida',   color: '#001639' },
  { id: 'B', label: 'B', desc: 'siguiente 15%',      color: '#3b82f6' },
  { id: 'C', label: 'C', desc: 'último 5%',          color: '#7dd3fc' },
  { id: 'N', label: 'Sin salida', desc: 'no se vendió ni compró en el período', color: '#cbd5e1' },
]
export const ABC = Object.fromEntries(ABCS.map(a => [a.id, a]))

// Tramos de cobertura (días de inventario de cada artículo con stock)
export const TRAMOS = [
  { id: 't30',  label: '< 30 días',     hasta: 30,       color: '#f43f5e' },
  { id: 't60',  label: '30–60',         hasta: 60,       color: '#f59e0b' },
  { id: 't90',  label: '60–90',         hasta: 90,       color: '#10b981' },
  { id: 't180', label: '90–180',        hasta: 180,      color: '#3b82f6' },
  { id: 't365', label: '180–365',       hasta: 365,      color: '#6366f1' },
  { id: 'tmas', label: '> 1 año',       hasta: Infinity, color: '#8b5cf6' },
  { id: 'tsin', label: 'Sin salida',    hasta: null,     color: '#94a3b8' },
]
export function tramoDe(f) {
  if (!(f.valor > 0)) return null
  if (f.dias_cobertura === null) return 'tsin'
  return TRAMOS.find(t => t.hasta !== null && f.dias_cobertura < t.hasta)?.id || 'tmas'
}

export const OBJETIVOS = [60, 90, 120, 180]

// Columnas → objetos
export function hidratar(data) {
  if (!data?.columnas) return []
  const cols = data.columnas
  return data.filas.map(arr => {
    const o = {}
    for (let i = 0; i < cols.length; i++) o[cols[i]] = arr[i]
    o.tramo = tramoDe(o)
    return o
  })
}

// Exceso: valor por encima de `objetivo` días de cobertura. Sin salida = todo es exceso.
export const excesoDe = (f, dias, objetivo) =>
  f.valor > 0 ? Math.max(0, f.valor - (f.salida / dias) * objetivo) : 0

// Texto comparable: minúsculas y sin tildes
export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function filtrar(filas, { producto, clase, abc, proveedor, busqueda }) {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean)
  return filas.filter(f =>
    NIVELES_PRODUCTO.every(n => !producto[n.dim] || f[n.dim] === producto[n.dim]) &&
    (!clase || f.clase === clase) &&
    (!abc || f.abc === abc) &&
    (!proveedor || (proveedor.codigo ? f.proveedor_codigo === proveedor.codigo : !f.proveedor_codigo)) &&
    (!palabras.length || palabras.every(p => normalizar(`${f.codigo} ${f.descripcion} ${f.proveedor || ''}`).includes(p)))
  )
}

// Métricas de un grupo de artículos.
// Días de inventario del grupo: valor ÷ costo de ventas diario; si el grupo no
// vende nada (solo materia prima) se usa lo comprado (consumo). Igual que Rotación
// de inventarios: no se suman ambos para no contar dos veces la materia prima.
export function resumir(rs, dias, objetivo) {
  let valor = 0, transito = 0, cogs = 0, consumo = 0, salida = 0, quieto = 0, inmovilizado = 0, lento = 0
  let exceso = 0, skus = 0, quiebres = 0, salidaQuiebres = 0, skusExceso = 0
  for (const f of rs) {
    valor += f.valor
    transito += f.valor_transito
    cogs += f.cogs
    consumo += f.consumo_mp
    salida += f.salida
    if (f.valor > 0) skus++
    if (f.estado === 'lento') lento += f.valor
    if (f.estado === 'inmovilizado') inmovilizado += f.valor
    const e = excesoDe(f, dias, objetivo)
    exceso += e
    if (e > 0) skusExceso++
    if (f.quiebre) { quiebres++; salidaQuiebres += f.salida }
  }
  quieto = lento + inmovilizado
  const flujo = cogs > 0 ? cogs : consumo
  const diasInv = flujo > 0 && valor > 0 ? Math.round(valor / (flujo / dias)) : null
  return {
    articulos: rs.length, skus, valor, transito, cogs, consumo, salida,
    base: cogs > 0 ? 'costo_ventas' : consumo > 0 ? 'consumo' : null,
    dias_inventario: diasInv,
    rotacion: diasInv ? Math.round(365 / diasInv * 10) / 10 : null,
    lento, inmovilizado, quieto,
    pct_quieto: valor > 0 ? Math.round(quieto / valor * 1000) / 10 : 0,
    exceso, skus_exceso: skusExceso,
    pct_exceso: valor > 0 ? Math.round(exceso / valor * 1000) / 10 : 0,
    quiebres, salida_quiebres: salidaQuiebres,
  }
}

// Agrupa por una dimensión y resume cada grupo
export function agrupar(rs, key, dias, objetivo, nombre = (f) => f[key]) {
  const m = new Map()
  for (const f of rs) {
    const k = f[key] ?? ''
    if (!m.has(k)) m.set(k, { clave: k, nombre: nombre(f), filas: [] })
    m.get(k).filas.push(f)
  }
  const total = rs.reduce((s, f) => s + f.valor, 0)
  return [...m.values()].map(g => {
    const r = resumir(g.filas, dias, objetivo)
    return { clave: g.clave, nombre: g.nombre, ...r, pct: total > 0 ? Math.round(r.valor / total * 1000) / 10 : 0 }
  })
}

// Siguiente nivel de la jerarquía a mostrar
export function nivelSiguiente(producto) {
  const i = NIVELES_PRODUCTO.findIndex(n => !producto[n.dim])
  return i === -1 ? { dim: 'articulo', singular: 'Artículo', plural: 'Artículos' } : NIVELES_PRODUCTO[i]
}

// Opciones del filtro de producto a partir de las filas cargadas
export function opcionesProducto(filas) {
  return (dim, arriba) => {
    const m = new Map()
    for (const f of filas) {
      if (!Object.entries(arriba).every(([k, v]) => !v || f[k] === v)) continue
      m.set(f[dim], (m.get(f[dim]) || 0) + 1)
    }
    return [...m.keys()].map(k => ({ clave: k, nombre: k }))
  }
}

export const fmtDias = (d) => (d === null || d === undefined ? '—' : `${Math.round(d).toLocaleString('es-GT')} d`)
export const fmtNum = (n) => Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })
