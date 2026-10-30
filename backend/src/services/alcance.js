// Alcance por fila del usuario (el 👁 de la hoja "Usuarios y roles Abaco").
//
// En vez de tocar cada consulta, el middleware deja el alcance del usuario en un
// AsyncLocalStorage y el wrapper de la base (database/connection.js) reescribe
// las tablas sensibles como subconsultas ya filtradas:
//   FROM thermoplastica.v_ventas_costeadas f
//   → FROM (SELECT * FROM thermoplastica.v_ventas_costeadas WHERE <alcance>) f
// Así toda consulta de la petición (también las que se agreguen después) queda
// recortada. Sin alcance (Dirección, Finanzas, admin, tareas de fondo) no se toca nada.
//
// Además `ocultar` dice qué montos se quitan de la respuesta JSON (sin costo,
// sin márgenes, en unidades): ver limpiarRespuesta.

const { AsyncLocalStorage } = require('async_hooks');
const { rolesDeUsuario, permisosDeUsuario } = require('../config/permisos');

const als = new AsyncLocalStorage();

const SIN_RECORTE = ['direccion', 'finanzas', 'admin'];

// Qué montos oculta cada rol y en qué endpoints (prefijo bajo /api)
const OCULTAR = {
  gerente_ventas:   [{ en: ['/ventas', '/dashboard'], que: ['costo'] }, { en: ['/inventario'], que: ['montos'] }],
  asistente_ventas: [{ en: ['/ventas', '/dashboard'], que: ['costo', 'margen'] }, { en: ['/inventario'], que: ['montos'] }],
  ejecutivo_ventas: [{ en: ['/inventario'], que: ['montos'] }],
  inventario:       [{ en: ['/inventario', '/dashboard'], que: ['montos'] }],
};

// Alcance efectivo: null = sin recorte.
//   lineas     → marcas que puede ver (gerente de línea)
//   vendedores → códigos de vendedor (ejecutivo: los suyos; gerente/asistente: su equipo si se asignó)
//   ocultar    → [{ en, que }] montos que se quitan de la respuesta
//   verticales → áreas de insights que puede ver (null = todas)
function alcanceDeUsuario(u) {
  const roles = rolesDeUsuario(u);
  if (roles.some(r => SIN_RECORTE.includes(r))) return null;
  const a = u?.alcance || {};
  const out = { lineas: null, vendedores: null, ocultar: [], verticales: null };

  if (roles.includes('gerente_linea')) out.lineas = a.lineas || [];
  if (roles.includes('ejecutivo_ventas')) out.vendedores = a.vendedores || [];
  else if (roles.some(r => r === 'gerente_ventas' || r === 'asistente_ventas') && a.vendedores?.length) {
    out.vendedores = a.vendedores;
  }
  for (const r of roles) out.ocultar.push(...(OCULTAR[r] || []));
  return out;
}

// ---------------------------------------------------------------- reescritura SQL

const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const arr = (xs) => `ARRAY[${xs.map(lit).join(',') || "''"}]::text[]`;

const artIn = (A) => `articulo_id IN (SELECT articulo_id FROM thermoplastica.dim_articulo WHERE TRIM(marca) = ANY(${arr(A.lineas)}))`;
const vendIn = (A) => `vendedor_id IN (SELECT vendedor_id FROM thermoplastica.dim_vendedor WHERE codigo_vendedor = ANY(${arr(A.vendedores)}))`;
// "Sus clientes": a quienes les vendió o los que el ERP le tiene asignados en la cartera
const cliIn = (A) => `cliente_id IN (SELECT cliente_id FROM thermoplastica.fact_ventas_linea WHERE ${vendIn(A)}
                       UNION SELECT cliente_id FROM thermoplastica.fact_cxc_snapshot_diario WHERE ${vendIn(A)})`;
// Vistas analíticas sin articulo_id: se cruzan por la descripción del artículo
const descIn = (A) => `articulo IN (SELECT descripcion FROM thermoplastica.dim_articulo WHERE TRIM(marca) = ANY(${arr(A.lineas)}))`;

const porLinea = (A) => (A.lineas ? artIn(A) : null);
const porLineaYVendedor = (A) => [A.lineas && artIn(A), A.vendedores && vendIn(A)].filter(Boolean).join(' AND ') || null;

// tabla → condición según el alcance (null = no se recorta)
const TABLAS = {
  'thermoplastica.dim_articulo':             (A) => (A.lineas ? `TRIM(marca) = ANY(${arr(A.lineas)})` : null),
  'thermoplastica.v_ventas_costeadas':       porLineaYVendedor,
  'thermoplastica.fact_ventas_linea':        porLineaYVendedor,
  'thermoplastica.cpp_articulos_venta':      porLineaYVendedor,
  'thermoplastica.cpp_laminados_venta':      porLineaYVendedor,
  'analitica.v_ventas':                      porLineaYVendedor,
  'thermoplastica.fact_compras_linea':       porLinea,
  'thermoplastica.fact_inventario_snapshot': porLinea,
  'thermoplastica.fact_ventas_mensuales':    porLinea,
  'thermoplastica.cpp_articulos_clave':      porLinea,
  'thermoplastica.cpp_laminados_clave':      porLinea,
  'analitica.hist_inventario':               porLinea,
  'analitica.v_inventario':                  porLinea,
  'analitica.v_inventario_salud':            porLinea,
  'analitica.v_compras':                     (A) => (A.lineas ? descIn(A) : null),
  'analitica.v_ventas_mensuales':            (A) => (A.lineas ? descIn(A) : null),
  'thermoplastica.fact_cxc_snapshot_diario': (A) => (A.vendedores ? vendIn(A) : null),
  'thermoplastica.fact_cxc_factura':         (A) => (A.vendedores ? cliIn(A) : null),
  'analitica.v_cxc':                         (A) => (A.vendedores ? cliIn(A) : null),
};

// Palabras que pueden seguir a una tabla sin ser su alias
const NO_ALIAS = new Set(('where join left right inner full cross natural on using group order limit offset ' +
  'union except intersect having window fetch for returning set values lateral').split(' '));

function reescribirSql(sql, A) {
  if (!A || (!A.lineas && !A.vendedores) || typeof sql !== 'string') return sql;
  return sql.replace(/\b(thermoplastica|analitica)\.([a-z_][a-z0-9_]*)\b(?!\s*\()/gi, (m, esq, tabla, offset, full) => {
    const f = TABLAS[`${esq}.${tabla}`.toLowerCase()];
    const cond = f && f(A);
    if (!cond) return m;
    // No tocar destinos de escritura
    if (/\b(into|update|table)\s*$/i.test(full.slice(Math.max(0, offset - 12), offset))) return m;
    const sig = /^\s+(?:as\s+)?([a-z_][a-z0-9_]*)/i.exec(full.slice(offset + m.length));
    const tieneAlias = sig && !NO_ALIAS.has(sig[1].toLowerCase());
    return `(SELECT * FROM ${m} WHERE ${cond})${tieneAlias ? '' : ' ' + tabla}`;
  });
}

// Reescribe con el alcance de la petición en curso (si hay)
const reescribir = (sql) => reescribirSql(sql, als.getStore());

// Para las cachés en memoria: los datos recortados no se mezclan con los completos
function claveAlcance() {
  const A = als.getStore();
  return A && (A.lineas || A.vendedores) ? `|${JSON.stringify([A.lineas, A.vendedores])}` : '';
}

// ---------------------------------------------------------------- insights

// Área de cada insight del analista diario (agent_source = 'playbook:<vertical>')
// y el módulo que hay que tener para verla. "Compras y pagos" le sirve también a CxP.
const VERTICALES = { cartera: ['cxc'], ventas: ['ventas'], margenes: ['margenes'], compras: ['compras', 'cxp'], salud: ['analisis'] };

const sinAcentos = (s) => `TRANSLATE(LOWER(${s}), 'áéíóúü', 'aeiouu')`;

// Insights que ve el usuario ("su área"; gerente de línea: los que nombran sus líneas).
// Devuelve { sql, params } para agregar al WHERE de insights_historico (con ?), o null = todos.
function filtroInsights(u) {
  const roles = rolesDeUsuario(u);
  if (roles.some(r => SIN_RECORTE.includes(r))) return null;
  const permisos = permisosDeUsuario(u);
  const verticales = Object.entries(VERTICALES).filter(([, mods]) => mods.some(m => permisos[m])).map(([v]) => v);
  if (!verticales.length) return { sql: 'FALSE', params: [] };

  const params = verticales.map(v => `playbook:${v}`);
  let sql = `agent_source IN (${verticales.map(() => '?').join(', ')})`;
  const A = alcanceDeUsuario(u);
  if (A?.lineas) {
    // El insight tiene que nombrar alguna de sus líneas en la categoría
    const ls = A.lineas.map(l => l.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/s$/, ''));
    if (!ls.length) return { sql: 'FALSE', params: [] };
    sql += ` AND (${ls.map(() => `${sinAcentos('category')} LIKE ?`).join(' OR ')})`;
    params.push(...ls.map(l => `%${l}%`));
  }
  return { sql, params };
}

// ---------------------------------------------------------------- respuesta JSON

const PATRONES = {
  costo:  /costo|cpp|sin_costo|utilidad/i,
  margen: /margen|rentab|utilidad/i,
  // "En unidades, no en Q": cualquier monto en quetzales
  montos: /costo|cpp|cogs|valor|precio|margen|monto|importe|capital|inmoviliz|saldo|utilidad|^salida|consumo_mp|^ventas$|^compras$|ventas_q|compras_q|_q$/i,
};

const esNumero = (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));

// Quita (pone en null) los campos numéricos cuyo nombre calza con los patrones.
// Los textos se dejan: un campo "valor" que es la etiqueta de un filtro no se toca.
function limpiar(x, re) {
  if (Array.isArray(x)) return x.map(v => limpiar(v, re));
  if (!x || typeof x !== 'object' || x instanceof Date) return x;
  // Formato columnar ({ columnas: [...], filas: [[...]] }, p. ej. /inventario/analitica)
  if (Array.isArray(x.columnas) && Array.isArray(x.filas) && x.filas.every(Array.isArray)) {
    const quitar = x.columnas.map((c, i) => (typeof c === 'string' && re.test(c) ? i : -1)).filter(i => i >= 0);
    const filas = x.filas.map(f => f.map((v, i) => (quitar.includes(i) && (esNumero(v) || v === null) ? null : v)));
    return { ...limpiar({ ...x, filas: undefined }, re), filas };
  }
  const out = {};
  for (const [k, v] of Object.entries(x)) {
    if (re.test(k) && (esNumero(v) || v === null)) out[k] = null;
    else if (re.test(k) && v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(esNumero)) out[k] = null;
    else out[k] = limpiar(v, re);
  }
  return out;
}

function patronPara(A, path) {
  const que = new Set();
  for (const regla of A?.ocultar || []) {
    if (regla.en.some(pre => path === pre || path.startsWith(pre + '/') || path.startsWith(pre + '-'))) regla.que.forEach(q => que.add(q));
  }
  if (!que.size) return null;
  return new RegExp([...que].map(q => PATRONES[q].source).join('|'), 'i');
}

module.exports = { als, alcanceDeUsuario, reescribirSql, reescribir, claveAlcance, filtroInsights, limpiar, patronPara };
