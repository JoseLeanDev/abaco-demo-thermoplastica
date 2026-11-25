const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ROLES, MODULOS, puede, modulosDeEndpoint } = require('../src/config/permisos');
const { autorizar } = require('../src/middleware/permisos');

// Simula una llamada a la API y dice si el middleware la deja pasar
function pasa(rol, url, method = 'GET') {
  const [baseUrl, ...resto] = url.replace(/^\/api/, '').split('/').filter(Boolean);
  const req = { user: { rol }, method, baseUrl: `/api/${baseUrl}`, path: `/${resto.join('/')}` };
  let ok = false, status = 200;
  const res = { json: () => {}, status: (s) => { status = s; return { json: () => {} }; } };
  autorizar(req, res, () => { ok = true; });
  return ok && status === 200;
}

test('el catálogo tiene los 12 roles (11 de la hoja + Gerencia Operaciones) y solo usa módulos conocidos', () => {
  assert.equal(ROLES.length, 12);
  const keys = new Set(MODULOS.map(m => m.key));
  for (const r of ROLES) for (const m of Object.keys(r.permisos)) assert.ok(keys.has(m), `${r.key}.${m}`);
});

test('solo Admin sistema administra usuarios', () => {
  for (const r of ROLES) assert.equal(puede(r.key, 'usuarios'), r.key === 'admin', r.key);
});

test('matriz: algunos cruces de la hoja', () => {
  assert.ok(puede('cobranza', 'cxc'));
  assert.ok(!puede('cobranza', 'ventas'));
  assert.ok(!puede('cobranza', 'cxp'));
  assert.ok(puede('cxp', 'cxp'));
  assert.ok(puede('compras', 'cxp'));
  assert.ok(!puede('compras', 'ventas'));
  assert.ok(!puede('asistente_ventas', 'margenes'));
  assert.ok(puede('gerente_ventas', 'capital'));
  assert.ok(!puede('ejecutivo_ventas', 'capital'));
  assert.ok(!puede('inventario', 'insights'));
  assert.ok(!puede('gerente_linea', 'usuarios'));
  assert.ok(!puede('rol_inexistente', 'panel'));
  // Gerente de Línea: sin los módulos que no vienen por línea de producto
  for (const m of ['cxc', 'cxp', 'proyecciones', 'analisis', 'gastos', 'asistente']) assert.ok(!puede('gerente_linea', m), m);
  for (const m of ['ventas', 'margenes', 'compras', 'inventario', 'ventas_compras', 'capital']) assert.ok(puede('gerente_linea', m), m);
});

test('el middleware bloquea por módulo y deja pasar endpoints compartidos', () => {
  assert.ok(pasa('cobranza', '/api/tesoreria/cxc/cliente/12'));
  assert.ok(!pasa('cobranza', '/api/tesoreria/cxp'));
  // La posición de Tesorería cruza CxC y CxP: hace falta tener los dos
  assert.ok(!pasa('cobranza', '/api/tesoreria/posicion'));
  assert.ok(!pasa('compras', '/api/tesoreria/posicion'));
  assert.ok(pasa('finanzas', '/api/tesoreria/posicion'));
  assert.ok(!pasa('cobranza', '/api/ventas'));
  assert.ok(!pasa('compras', '/api/ventas/vendedores'));
  assert.ok(pasa('compras', '/api/compras/desglose'));
  assert.ok(pasa('compras', '/api/analisis/ventas-vs-compras'));
  assert.ok(!pasa('compras', '/api/analisis/salud'));
  // Márgenes usa /ventas/desglose para su filtro de producto
  assert.ok(pasa('ejecutivo_ventas', '/api/ventas/desglose'));
  // Ejecutivo de Ventas no tiene Márgenes (ningún vendedor salvo el gerente los ve)
  assert.ok(!pasa('ejecutivo_ventas', '/api/margenes/vendedores'));
  assert.ok(pasa('gerente_ventas', '/api/margenes/vendedores'));
  assert.ok(!pasa('asistente_ventas', '/api/margenes'));
  // Asistente IA bloqueado para Compras y Gerente de Línea (el agente ve todas las tablas)
  assert.ok(!pasa('compras', '/api/agents/chat-agente', 'POST'));
  assert.ok(!pasa('gerente_linea', '/api/agents/chat-agente', 'POST'));
  assert.ok(pasa('direccion', '/api/agents/chat-agente', 'POST'));
  assert.ok(!pasa('cobranza', '/api/agents/chat-agente', 'POST'));
});

test('bitácora de agentes: lectura para Dirección, ejecutar solo admin', () => {
  assert.ok(pasa('direccion', '/api/agents/logs'));
  assert.ok(!pasa('direccion', '/api/agents/execute', 'POST'));
  assert.ok(!pasa('direccion', '/api/scheduler/trigger', 'POST'));
  assert.ok(pasa('admin', '/api/agents/execute', 'POST'));
  assert.ok(!pasa('cobranza', '/api/agents/logs'));
});

test('endpoint sin mapear: solo admin', () => {
  assert.equal(modulosDeEndpoint('/nuevo-modulo'), null);
  assert.ok(!pasa('direccion', '/api/nuevo-modulo'));
  assert.ok(pasa('admin', '/api/nuevo-modulo'));
  assert.ok(!pasa('finanzas', '/api/contabilidad/libro_diario'));
});

// Qué store deja el middleware para la petición (database/connection.js lee limiteMs)
function storeDe(user, query, method = 'GET') {
  const { als } = require('../src/services/alcance');
  const req = { user, method, baseUrl: '/api/ventas', path: '/desglose', query };
  const res = { json: () => {}, status: () => ({ json: () => {} }) };
  let store = 'no pasó';
  autorizar(req, res, () => { store = als.getStore(); });
  return store;
}

test('lecturas con tope por sentencia; el filtro de producto ya no fuerza el plan', () => {
  const GET = { limiteMs: 35000 };
  for (const rol of ['finanzas', 'direccion', 'admin']) {
    assert.deepEqual(storeDe({ rol }, {}), GET, rol);
    assert.deepEqual(storeDe({ rol }, { categoria: 'Liners', subcategoria: 'Induccion', sublinea: 'X' }), GET, rol);
  }
  const gl = { rol: 'gerente_linea', alcance: { lineas: ['Liners'] } };
  const s = storeDe(gl, { categoria: 'Liners', subcategoria: 'Induccion' });
  assert.deepEqual(s.lineas, ['Liners']);
  assert.equal(s.limiteMs, 35000);
  assert.equal(s.sinNestloop, undefined);
});

test('tope por sentencia solo en lecturas: los POST (agentes, cierre) no lo llevan', () => {
  assert.equal(storeDe({ rol: 'admin' }, {}, 'POST'), undefined);
  assert.equal(storeDe({ rol: 'admin' }, { categoria: 'A', subcategoria: 'B' }, 'POST'), undefined);
});

test('conciliación bancaria: solo dirección, finanzas y admin', () => {
  for (const r of ROLES) {
    const esperado = ['direccion', 'finanzas', 'admin'].includes(r.key);
    assert.equal(puede(r.key, 'bancos'), esperado, r.key);
    assert.equal(pasa(r.key, '/api/conciliacion-bancaria'), esperado, r.key);
    assert.equal(pasa(r.key, '/api/conciliacion-bancaria/movimientos'), esperado, r.key);
    // Resumen de bancos que usa la página Tesorería: mismo módulo, aunque el rol vea Tesorería
    assert.equal(pasa(r.key, '/api/conciliacion-bancaria/resumen'), esperado, r.key);
  }
  // No se confunde con el módulo viejo /conciliador (solo admin)
  assert.deepEqual(modulosDeEndpoint('/conciliacion-bancaria').modulos, ['bancos']);
  assert.ok(!pasa('finanzas', '/api/conciliador/conciliaciones/1/2026/1'));
});

test('sin uso en la plataforma y con datos de demostración: /alertas y el chat viejo, solo admin', () => {
  for (const r of ROLES) {
    const esperado = r.key === 'admin';
    assert.equal(pasa(r.key, '/api/alertas'), esperado, r.key);
    assert.equal(pasa(r.key, '/api/agents/chat', 'POST'), esperado, r.key);
  }
  assert.ok(pasa('gerencia_operaciones', '/api/agents/chat-agente', 'POST'));
  assert.ok(!pasa('gerencia_operaciones', '/api/conciliacion-bancaria/resumen'));
});
