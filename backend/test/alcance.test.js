const { test } = require('node:test');
const assert = require('node:assert/strict');
const { permisosDeUsuario } = require('../src/config/permisos');
const { alcanceDeUsuario, reescribirSql, limpiar, patronPara, filtroInsights } = require('../src/services/alcance');

const GL = { rol: 'gerente_linea', alcance: { lineas: ['Laminados', "O'Brien"] } };
const EJ = { rol: 'ejecutivo_ventas', alcance: { vendedores: ['018'] } };

test('roles adicionales: Cobranza + CxP ve la unión', () => {
  const p = permisosDeUsuario({ rol: 'cobranza', roles_adicionales: ['cxp'] });
  assert.ok(p.cxc && p.cxp);
  assert.ok(!p.ventas);
});

test('alcance por rol', () => {
  assert.equal(alcanceDeUsuario({ rol: 'direccion' }), null);
  assert.equal(alcanceDeUsuario({ rol: 'cobranza', roles_adicionales: ['direccion'] }), null);
  assert.deepEqual(alcanceDeUsuario(GL).lineas, ['Laminados', "O'Brien"]);
  assert.deepEqual(alcanceDeUsuario(EJ).vendedores, ['018']);
  // Ejecutivo sin vendedor asignado no ve ventas de nadie
  assert.deepEqual(alcanceDeUsuario({ rol: 'ejecutivo_ventas' }).vendedores, []);
  // Gerente de ventas sin equipo asignado = todos
  assert.equal(alcanceDeUsuario({ rol: 'gerente_ventas' }).vendedores, null);
  assert.deepEqual(alcanceDeUsuario({ rol: 'gerente_ventas', alcance: { vendedores: ['014'] } }).vendedores, ['014']);
});

test('reescribe tablas con y sin alias, y no toca lo demás', () => {
  const A = alcanceDeUsuario(GL);
  const r1 = reescribirSql('SELECT SUM(x) FROM thermoplastica.v_ventas_costeadas f JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id', A);
  assert.match(r1, /FROM \(SELECT \* FROM thermoplastica\.v_ventas_costeadas WHERE articulo_id IN \(.*\)\) f JOIN thermoplastica\.dim_cliente c/);
  const r2 = reescribirSql('SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_inventario_snapshot)', A);
  assert.match(r2, /\) fact_inventario_snapshot\)$/);
  const r3 = reescribirSql('SELECT * FROM thermoplastica.v_ventas_costeadas WHERE tipo_doc = 1', A);
  assert.match(r3, /\) v_ventas_costeadas WHERE tipo_doc = 1$/);
  const r4 = reescribirSql('SELECT * FROM thermoplastica.v_ventas_costeadas AS v', A);
  assert.match(r4, /\) AS v$/);
  // Comillas escapadas
  assert.match(reescribirSql('SELECT 1 FROM thermoplastica.dim_articulo a', A), /'O''Brien'/);
  // Escrituras y funciones no se tocan
  const w = 'INSERT INTO thermoplastica.fact_ventas_linea (a) VALUES (1)';
  assert.equal(reescribirSql(w, A), w);
  assert.equal(reescribirSql('SELECT thermoplastica.f(1)', A), 'SELECT thermoplastica.f(1)');
  // Sin alcance o tabla sin regla: igual
  const q = 'SELECT * FROM thermoplastica.v_ventas_costeadas f';
  assert.equal(reescribirSql(q, null), q);
  assert.equal(reescribirSql('SELECT * FROM thermoplastica.dim_proveedor p', A), 'SELECT * FROM thermoplastica.dim_proveedor p');
  // El gerente de línea no recorta CxC por vendedor
  const cxc = 'SELECT * FROM thermoplastica.fact_cxc_snapshot_diario s';
  assert.equal(reescribirSql(cxc, A), cxc);
});

test('ejecutivo: ventas por vendedor y CxC de sus clientes', () => {
  const A = alcanceDeUsuario(EJ);
  assert.match(reescribirSql('SELECT 1 FROM thermoplastica.v_ventas_costeadas f', A), /vendedor_id IN \(SELECT vendedor_id FROM thermoplastica\.dim_vendedor WHERE codigo_vendedor = ANY\(ARRAY\['018'\]/);
  assert.match(reescribirSql('SELECT 1 FROM thermoplastica.fact_cxc_factura x', A), /cliente_id IN \(SELECT cliente_id FROM thermoplastica\.fact_ventas_linea/);
  // Inventario no se recorta por vendedor (ven existencias de todo)
  const inv = 'SELECT 1 FROM thermoplastica.fact_inventario_snapshot s';
  assert.equal(reescribirSql(inv, A), inv);
});

test('limpia montos según rol y endpoint, sin tocar textos', () => {
  const asis = alcanceDeUsuario({ rol: 'asistente_ventas' });
  const re = patronPara(asis, '/ventas/detalle');
  const out = limpiar({ data: { ventas_sin_iva: 10, costo_total: '5', margen_pct: 3.2, filas: [{ cliente: 'X', margen_bruto: 2, unidades: 4 }] } }, re);
  assert.equal(out.data.ventas_sin_iva, 10);
  assert.equal(out.data.costo_total, null);
  assert.equal(out.data.margen_pct, null);
  assert.equal(out.data.filas[0].margen_bruto, null);
  assert.equal(out.data.filas[0].unidades, 4);
  assert.equal(patronPara(asis, '/compras'), null);

  const inv = patronPara(alcanceDeUsuario({ rol: 'inventario' }), '/inventario/analitica');
  const o2 = limpiar({ valor: 'Laminados', valor_inventario: 100, stock_actual: 7, costo_promedio: 3 }, inv);
  assert.equal(o2.valor, 'Laminados');
  assert.equal(o2.valor_inventario, null);
  assert.equal(o2.costo_promedio, null);
  assert.equal(o2.stock_actual, 7);
  // Formato columnar
  const o3 = limpiar({ columnas: ['codigo', 'stock', 'valor', 'costo'], filas: [['A1', 5, 100, 20]] }, inv);
  assert.deepEqual(o3.filas, [['A1', 5, null, null]]);
});

test('insights por área', () => {
  assert.equal(filtroInsights({ rol: 'finanzas' }), null);
  assert.deepEqual(filtroInsights({ rol: 'cobranza' }).params, ['playbook:cartera']);
  assert.deepEqual(filtroInsights({ rol: 'cxp' }).params, ['playbook:compras']);
  assert.equal(filtroInsights({ rol: 'inventario' }).sql, 'FALSE');
  const gl = filtroInsights({ rol: 'gerente_linea', alcance: { lineas: ['Liners', 'Flexografía'] } });
  assert.ok(gl.params.includes('%liner%'));
  assert.ok(gl.params.includes('%flexografia%'));
});
