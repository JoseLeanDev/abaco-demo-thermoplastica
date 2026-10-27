const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ROLES, MODULOS, puede, modulosDeEndpoint } = require('../src/config/permisos');
const { autorizar } = require('../src/middleware/permisos');

// Simula una llamada a la API y dice si el middleware la deja pasar
function pasa(rol, url, method = 'GET') {
  const [baseUrl, ...resto] = url.replace(/^\/api/, '').split('/').filter(Boolean);
  const req = { user: { rol }, method, baseUrl: `/api/${baseUrl}`, path: `/${resto.join('/')}` };
  let ok = false, status = 200;
  const res = { status: (s) => { status = s; return { json: () => {} }; } };
  autorizar(req, res, () => { ok = true; });
  return ok && status === 200;
}

test('el catálogo tiene los 11 roles de la hoja y solo usa módulos conocidos', () => {
  assert.equal(ROLES.length, 11);
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
  assert.ok(pasa('ejecutivo_ventas', '/api/margenes/vendedores'));
  assert.ok(!pasa('asistente_ventas', '/api/margenes'));
  assert.ok(pasa('compras', '/api/agents/chat-agente', 'POST'));
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
