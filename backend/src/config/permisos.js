// Roles y permisos por módulo — fuente única (backend y frontend).
// Transcribe la hoja "Usuarios y roles Abaco" (Permisos por módulo y rol).
//
// Nivel de acceso por módulo:
//   'total'   → ✅ acceso completo
//   'parcial' → 👁 acceso con alcance limitado; `alcance` dice cuál (texto de la hoja)
//   ausente   → ❌ sin acceso
//
// El acceso por módulo se aplica en menú, rutas y API (middleware/permisos.js).
// El recorte por fila de `alcance` (sus líneas, sus vendedores, sin costo, en
// unidades) lo aplica services/alcance.js.

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
//   lineas     → líneas de producto asignadas (gerente de línea) = categoría (marca del ERP)
//   vendedores → códigos de vendedor (ejecutivo: el suyo; gerente/asistente: su equipo, vacío = todos)
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
    // La hoja también le da 👁 en gastos, CxC, CxP, proyecciones, análisis, Asistente IA y
    // Agentes IA, pero esos datos no vienen por línea de producto (la bitácora de agentes
    // resume cartera, CxP y caja de toda la empresa): bloqueados hasta poder recortarlos.
    permisos: {
      panel: lineas, ventas: lineas, margenes: lineas, compras: lineas, inventario: lineas,
      ventas_compras: lineas, capital: lineas, insights: lineas,
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
      // Sin insights: se escriben sobre toda la empresa (otros vendedores, otros clientes)
      cxc: P('sus clientes'),
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
      // Asistente IA (👁 acceso restringido en la hoja) bloqueado: el agente SQL ve todas las
      // tablas, incluidas ventas y márgenes, hasta que se pueda acotar.
      panel: P('compras'), compras: T, inventario: T, cxp: T, ventas_compras: T, capital: T,
      insights: P('su área'),
    },
  },
  {
    key: 'inventario', nombre: 'Inventario',
    // Capital inmovilizado / Rotación (👁 en unidades en la hoja) bloqueado: esas páginas
    // están armadas sobre montos en Q y no hay vista en unidades todavía.
    permisos: {
      panel: P('compras'), inventario: P('en unidades, no en Q'),
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

// Un usuario puede tener roles adicionales (p. ej. Cobranza + CxP): ve la unión,
// y en cada módulo el nivel más amplio de sus roles.
function rolesDeUsuario(u) {
  return [u?.rol, ...(u?.roles_adicionales || [])].filter(r => ROLES_POR_KEY[r]);
}

function permisosDeUsuario(u) {
  const out = {};
  for (const rol of rolesDeUsuario(u)) {
    for (const [m, p] of Object.entries(permisosDeRol(rol))) {
      if (!out[m] || (out[m].nivel !== 'total' && p.nivel === 'total')) out[m] = p;
    }
  }
  return out;
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

module.exports = {
  MODULOS, ROLES, ROLES_POR_KEY, permisosDeRol, puede, rolesDeUsuario, permisosDeUsuario, modulosDeEndpoint,
};
