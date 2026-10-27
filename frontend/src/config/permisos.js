// Qué módulo habilita cada página. Los permisos del usuario llegan del backend
// (/auth/me → user.permisos, definidos en backend/src/config/permisos.js).
// `todos: true` = hacen falta todos los módulos listados (no basta uno).

const RUTAS = [
  ['/tesoreria/cuentas-por-cobrar', ['cxc']],
  ['/tesoreria/cuentas-por-pagar', ['cxp']],
  ['/tesoreria/proyecciones', ['proyecciones']],
  ['/tesoreria', ['cxc', 'cxp'], { todos: true }],
  ['/analisis/capital-inmovilizado', ['capital']],
  ['/analisis/rotacion-inventario', ['capital']],
  ['/analisis/ventas-vs-compras', ['ventas_compras']],
  ['/analisis', ['analisis']],
  ['/gastos-operativos', ['gastos']],
  ['/compras', ['compras']],
  ['/ventas', ['ventas']],
  ['/inventario', ['inventario']],
  ['/margenes', ['margenes']],
  ['/asistente', ['asistente']],
  ['/insights', ['insights']],
  ['/log-actividades', ['agentes']],
  ['/usuarios', ['usuarios']],
  ['/', ['panel']],
]

export function puedeVerRuta(permisos, pathname) {
  const hit = RUTAS.find(([pre]) => pathname === pre || (pre !== '/' && pathname.startsWith(pre + '/')))
  if (!hit) return false
  const [, modulos, { todos } = {}] = hit
  return todos ? modulos.every(m => permisos?.[m]) : modulos.some(m => permisos?.[m])
}

// Nombre legible del rol (el catálogo completo vive en el backend; esto es solo para mostrar)
export const NOMBRE_ROL = {
  direccion: 'Dirección', finanzas: 'Finanzas', gerente_linea: 'Gerente de Línea',
  gerente_ventas: 'Gerente Ventas', asistente_ventas: 'Asistente de Ventas',
  ejecutivo_ventas: 'Ejecutivo de Ventas', cobranza: 'Cobranza', cxp: 'CxP',
  compras: 'Compras', inventario: 'Inventario', admin: 'Admin sistema',
}
