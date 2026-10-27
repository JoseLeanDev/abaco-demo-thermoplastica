// Roles y permisos por módulo — fuente única (backend y frontend).
// Transcribe la hoja "Usuarios y roles Abaco" (Permisos por módulo y rol).
//
// Nivel de acceso por módulo:
//   'total'   → ✅ acceso completo
//   'parcial' → 👁 acceso con alcance limitado; `alcance` dice cuál (texto de la hoja)
//   ausente   → ❌ sin acceso
//
// Fase 1 aplica el acceso por módulo (menú, rutas y API). El recorte por fila
// que describe `alcance` (solo sus líneas, sus clientes, sin costo…) es fase 2:
// mientras tanto un rol parcial ve el módulo completo.

const MODULOS = [
  { key: 'panel',        nombre: 'Panel (dashboard)' },
  { key: 'ventas',       nombre: 'Ventas' },
  { key: 'margenes',     nombre: 'Márgenes' },
  { key: 'compras',      nombre: 'Compras (incluye variación de precios)' },
  { key: 'inventario',   nombre: 'Inventario' },
  { key: 'gastos',       nombre: 'Gastos operativos / Administración' },
  { key: 'cxc',          nombre: 'Tesorería: CxC y ficha de cliente' },
  { key: 'cxp',          nombre: 'Tesorería: CxP' },
  { key: 'proyecciones', nombre: 'Tesorería: proyecciones / flujo' },
  { key: 'analisis',     nombre: 'Análisis (salud financiera, ciclo de caja)' },
  { key: 'ventas_compras', nombre: 'Ventas vs compras' },
  { key: 'capital',      nombre: 'Capital inmovilizado / Rotación' },
  { key: 'asistente',    nombre: 'Asistente IA' },
  { key: 'insights',     nombre: 'Insights de IA' },
  { key: 'agentes',      nombre: 'Agentes IA (bitácora)' },
  { key: 'usuarios',     nombre: 'Usuarios' },
];

const T = { nivel: 'total' };
const P = (alcance) => ({ nivel: 'parcial', alcance });
const lineas = P('solo sus líneas');
const todo = Object.fromEntries(MODULOS.map(m => [m.key, T]));

// `alcance` del usuario (columna usuarios.alcance):
//   lineas     → líneas de producto asignadas (gerente de línea)
//   vendedores → códigos de vendedor (ejecutivo: el suyo; gerente: su equipo)
const ROLES = [
  {
    key: 'direccion', nombre: 'Dirección',
    permisos: { ...todo, insights: { nivel: 'total', alcance: 'todas' }, agentes: P('solo lectura'), usuarios: undefined },
  },
  {
    key: 'finanzas', nombre: 'Finanzas',
    permisos: { ...todo, insights: { nivel: 'total', alcance: 'todas' }, agentes: P('solo lectura'), usuarios: undefined },
  },
  {
    key: 'gerente_linea', nombre: 'Gerente de Línea', alcance: ['lineas'],
    permisos: {
      panel: lineas, ventas: lineas, margenes: lineas, compras: lineas, inventario: lineas,
      gastos: P('solo sus líneas; operativos, no administrativos'),
      cxc: lineas, cxp: lineas, proyecciones: lineas, analisis: lineas, ventas_compras: lineas,
      capital: lineas, asistente: lineas, insights: lineas, agentes: P('solo lectura'),
    },
  },
  {
    key: 'gerente_ventas', nombre: 'Gerente Ventas', alcance: ['vendedores'],
    permisos: {
      panel: P('ventas'), ventas: P('sin costo'), margenes: P('sus vendedores, no general'),
      inventario: P('existencias'), cxc: P('sus clientes'), capital: T, insights: P('su área'),
    },
  },
  {
    key: 'asistente_ventas', nombre: 'Asistente de Ventas', alcance: ['vendedores'],
    permisos: {
      panel: P('ventas (sin márgenes)'), ventas: P('sin costo y sin márgenes'),
      inventario: P('existencias'), cxc: P('sus clientes'), capital: T, insights: P('su área'),
    },
  },
  {
    key: 'ejecutivo_ventas', nombre: 'Ejecutivo de Ventas', alcance: ['vendedores'],
    permisos: {
      panel: P('solo sus ventas'), ventas: P('solo sus ventas'),
      margenes: P('solo sus clientes y productos'), inventario: P('existencias'),
      cxc: P('sus clientes'), insights: P('su área'),
    },
  },
  {
    key: 'cobranza', nombre: 'Cobranza',
    permisos: { panel: P('cartera'), cxc: T, insights: P('su área') },
  },
  {
    key: 'cxp', nombre: 'CxP',
    permisos: { panel: P('cartera'), cxp: T, insights: P('su área') },
  },
  {
    key: 'compras', nombre: 'Compras',
    permisos: {
      panel: P('compras'), compras: T, inventario: T, cxp: T, ventas_compras: T, capital: T,
      asistente: P('acceso restringido'), insights: P('su área'),
    },
  },
  {
    key: 'inventario', nombre: 'Inventario',
    permisos: {
      panel: P('compras'), inventario: P('en unidades, no en Q'), capital: P('en unidades, no en Q'),
    },
  },
  {
    key: 'admin', nombre: 'Admin sistema',
    permisos: todo,
  },
];

const ROLES_POR_KEY = Object.fromEntries(ROLES.map(r => [r.key, r]));

// Permisos efectivos de un rol: { modulo: { nivel, alcance? } } solo con los módulos con acceso.
function permisosDeRol(rol) {
  const def = ROLES_POR_KEY[rol];
  if (!def) return {};
  return Object.fromEntries(Object.entries(def.permisos).filter(([, v]) => v));
}

function puede(rol, modulo) {
  return !!ROLES_POR_KEY[rol]?.permisos[modulo];
}

// Qué módulos habilitan cada endpoint de la API (prefijo bajo /api, primera coincidencia).
// Un endpoint compartido por varias páginas lista todos los módulos que lo usan.
// `escritura` exige nivel 'total' en métodos que no son GET (p. ej. ejecutar agentes).
// `todos` exige todos los módulos listados, no uno (la posición de Tesorería cruza CxC y CxP).
const ENDPOINTS = [
  ['/dashboard',                    ['panel']],
  ['/alertas',                      ['panel']],
  ['/ventas/desglose',              ['ventas', 'margenes']],   // filtro de producto de Márgenes
  ['/ventas',                       ['ventas']],
  ['/margenes',                     ['margenes']],
  ['/compras',                      ['compras']],
  ['/inventario',                   ['inventario']],
  ['/gastos',                       ['gastos']],
  ['/tesoreria/posicion',           ['cxc', 'cxp'], { todos: true }],
  ['/tesoreria/cxc',                ['cxc']],
  ['/tesoreria/cxp',                ['cxp']],
  ['/tesoreria/proyeccion',         ['proyecciones', 'analisis']],
  ['/analisis/insights',            ['insights']],
  ['/analisis/salud',               ['analisis']],
  ['/analisis/flujo-caja',          ['proyecciones', 'analisis']],
  ['/analisis/proyeccion-ventas',   ['proyecciones', 'analisis']],
  ['/analisis/inventario-quieto',   ['capital', 'analisis']],
  ['/analisis/rotacion-inventario', ['capital']],
  ['/analisis/ventas-vs-compras',   ['ventas_compras', 'analisis']],
  ['/agents/chat',                  ['asistente']],             // también /chat-agente
  ['/agents',                       ['agentes'], { escritura: true }],
  ['/scheduler',                    ['agentes'], { escritura: true }],
  // Módulos apagados en el menú (contabilidad, cierre, SAT): solo admin
  ['/contabilidad',                 ['usuarios']],
  ['/cierre',                       ['usuarios']],
  ['/conciliador',                  ['usuarios']],
  ['/sat',                          ['usuarios']],
];

function modulosDeEndpoint(path) {
  const hit = ENDPOINTS.find(([pre]) => path === pre || path.startsWith(pre + '/') || path.startsWith(pre + '-'));
  return hit ? { modulos: hit[1], ...(hit[2] || {}) } : null;
}

module.exports = { MODULOS, ROLES, ROLES_POR_KEY, permisosDeRol, puede, modulosDeEndpoint };
