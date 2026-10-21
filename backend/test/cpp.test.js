const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearCalculador, resumir, fleteCompra } = require('../src/services/cpp');

const compra = (r = {}) => ({ fec_emis: '2026-02-01', tipo_doc: 'FACT', linea: 'Laminados', categoria: 'PVC', sublinea: '250 micras', color: 'Cristal', unidades: 100, total_sin_iva: 2000, proveedor: 'Otro', ...r });
const venta = (r = {}) => ({ fec_emis: '2026-01-10', linea: 'Laminados', categoria: 'PVC', sublinea: '250 micras', color: 'Cristal', unidades: 10, total_sin_iva: 300, cliente: 'Externo', ...r });
const engine = (rows) => crearCalculador(rows, { corte: '2026-09-30' });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('CPP pondera cantidades y aplica un mismo CPP del año a ventas de distintos meses', () => {
  const c = engine([compra({ unidades: 10, total_sin_iva: 100 }), compra({ unidades: 90, total_sin_iva: 2700, fec_emis: '2026-09-01' })]);
  close(c.buscar(venta()).cpp, 28);
  close(c.buscar(venta({ fec_emis: '2026-08-01' })).cpp, 28);
});
test('se agota el año actual antes de elegir un color exacto del año anterior', () => {
  const c = engine([compra({ color: 'Mate', total_sin_iva: 4000 }), compra({ fec_emis: '2025-08-01', total_sin_iva: 1000 })]);
  const r = c.buscar(venta());
  assert.equal(r.fuente_cpp, 'L2'); close(r.cpp, 40);
});
test('H2 anterior tiene prioridad sobre el año anterior completo', () => {
  const c = engine([compra({ fec_emis: '2025-02-01', total_sin_iva: 1000 }), compra({ fec_emis: '2025-08-01', total_sin_iva: 3000 })]);
  const r = c.buscar(venta());
  assert.equal(r.fuente_cpp, 'L4'); close(r.cpp, 30);
});
test('compras futuras al corte no cambian el CPP', () => {
  const c = engine([compra(), compra({ fec_emis: '2026-10-01', total_sin_iva: 100000 })]);
  close(c.buscar(venta()).cpp, 20);
});
test('flete de Maximore cambia por año y no se multiplica por una cantidad de unidad desconocida', () => {
  close(fleteCompra(compra({ proveedor: 'MAXIMORE', fec_emis: '2025-01-01' })).por_unidad, 2.34);
  close(fleteCompra(compra({ proveedor: 'M&M PACKAGING' })).por_unidad, 3.9);
  assert.equal(fleteCompra(compra({ proveedor: 'BESEL', linea: 'Inyectables' })).por_unidad, null);
  close(engine([compra({ proveedor: 'BESEL' })]).buscar(venta()).cpp, 23.9);
});
test('Foil 25 micras Mate 2026 siempre utiliza 75.99', () => {
  const campos = { categoria: 'Foil de Aluminio', sublinea: '25 micras', color: 'Mate' };
  const r = engine([compra({ ...campos, total_sin_iva: 3000 })]).buscar(venta(campos));
  assert.equal(r.fuente_cpp, 'manual_override'); close(r.cpp, 75.99);
});
test('82 y 70.40 son respaldos, no reemplazan un CPP encontrado', () => {
  close(engine([]).buscar(venta({ categoria: 'Aluminio Impreso' })).cpp, 82);
  close(engine([]).buscar(venta({ categoria: 'Foil aluminio blister impreso' })).cpp, 70.4);
  close(engine([compra({ categoria: 'Aluminio Impreso' })]).buscar(venta({ categoria: 'Aluminio Impreso' })).cpp, 20);
});
test('sin CPP se conserva la venta y se excluye de ambos componentes del margen', () => {
  const c = engine([compra()]);
  const rr = [c.calcularVenta(venta()), c.calcularVenta(venta({ categoria: 'Sin compras', total_sin_iva: 700 }))];
  const r = resumir(rr);
  close(r.ventas_totales, 1000); close(r.ventas_con_cpp, 300);
  close(r.costo_mp, 200); close(r.margen_mp, 100); close(r.margen_mp_pct, 100 / 3);
  close(r.ventas_sin_cpp, 700);
  assert.equal(rr[1].margen_mp, null);
  assert.equal(resumir([rr[1]]).margen_mp_pct, null);
});
test('margen y costo en quetzales son aditivos, incluso con grupos sin CPP', () => {
  const c = engine([compra()]);
  const a = [c.calcularVenta(venta())], b = [c.calcularVenta(venta({ unidades: 3, total_sin_iva: 120 })), c.calcularVenta(venta({ categoria: 'Sin compras' }))];
  close(resumir([...a, ...b]).margen_mp, resumir(a).margen_mp + resumir(b).margen_mp);
  close(resumir([...a, ...b]).costo_mp, resumir(a).costo_mp + resumir(b).costo_mp);
});
test('una devolución negativa suma su margen Q y no un porcentaje individual', () => {
  const c = engine([compra()]);
  const a = c.calcularVenta(venta()), b = c.calcularVenta(venta({ unidades: -2, total_sin_iva: -60 }));
  assert.equal(b.margen_mp_pct, null);
  close(resumir([a, b]).costo_mp, 160); close(resumir([a, b]).margen_mp, 80);
});
test('no utiliza promedios con cantidad o costo total no positivos', () => {
  assert.equal(engine([compra({ unidades: 0 })]).buscar(venta()).cpp, null);
  assert.equal(engine([compra({ total_sin_iva: 0 })]).buscar(venta()).cpp, null);
});
test('una compra incompleta bloquea su grupo en lugar de esconderla', () => {
  const r = engine([compra(), compra({ unidades: null })]).buscar(venta());
  assert.equal(r.cpp, null); assert.equal(r.fuente_cpp, 'datos_compra_pendientes');
});
test('normaliza espacios y nulos de las llaves sin cambiar su significado', () => {
  const c = engine([compra({ color: null, sublinea: '250 micras  ' })]);
  assert.equal(c.buscar(venta({ color: '' })).fuente_cpp, 'L1');
});
test('las unidades no confirmadas quedan visibles y no se aplica el método a transformación', () => {
  const c = engine([compra({ linea: 'Inyectables' })]);
  assert.equal(c.calcularVenta(venta({ linea: 'Inyectables' })).estado_unidad, 'pendiente_confirmacion');
  assert.equal(c.calcularVenta(venta({ linea: 'Soplado' })).excluida, true);
});
test('excluye ventas internas sin tildes y reasigna Colgate', () => {
  const c = engine([compra()]);
  assert.equal(c.calcularVenta(venta({ cliente: '5779022-Thermoplástica S.A.' })).motivo, 'venta_interna');
  assert.equal(c.calcularVenta(venta({ cliente: 'Termoplastica' })).motivo, 'venta_interna');
  assert.equal(c.calcularVenta(venta({ cliente: 'Colgate-Palmolive' })).nombre_vendedor, 'Gerencia Laminados');
});
test('no redondea el CPP antes de aplicar la cantidad y exige un corte cerrado', () => {
  close(engine([compra({ unidades: 3, total_sin_iva: 10 })]).calcularVenta(venta({ unidades: 3 })).costo_mp, 10);
  assert.throws(() => crearCalculador([], { corte: '2026-09-29' }), /mes cerrado/);
});
test('los datos de venta incompletos no producen totales ni cobertura saludables', () => {
  const c = engine([compra()]);
  const r = resumir([c.calcularVenta(venta()), c.calcularVenta(venta({ total_sin_iva: null }))]);
  assert.equal(r.filas_sin_importe, 1); assert.equal(r.ventas_totales, null);
  assert.equal(r.cobertura_ventas_pct, null); assert.equal(r.ventas_sin_cpp, null);
});
test('la procedencia conserva las líneas mezcladas para revisión', () => {
  const c = engine([compra(), compra({ linea: 'Almacén General' })]);
  const r = c.buscar(venta());
  assert.deepEqual(r.advertencias, ['grupo_cpp_con_varias_lineas']);
  assert.deepEqual(r.fuente.lineas, ['Almacén General', 'Laminados']);
});
test('un respaldo por categoría en Inyectables se identifica como provisional', () => {
  const c = engine([compra({ linea: 'Inyectables', sublinea: 'Otra presentación', color: 'Ambar' })]);
  const r = c.calcularVenta(venta({ linea: 'Inyectables' }));
  assert.equal(r.fuente_cpp, 'L3');
  assert.equal(r.es_provisional, true);
  assert.ok(r.advertencias.includes('respaldo_categoria_en_linea_no_validada'));
  assert.equal(resumir([r]).ventas_pendientes_revision, 300);
});
test('una llave No Aplica no se presenta sin advertencia', () => {
  const campos = { categoria: 'No Aplica', sublinea: 'No Aplica', color: 'No Aplica' };
  const r = engine([compra(campos)]).calcularVenta(venta(campos));
  assert.ok(r.advertencias.includes('clave_totalmente_generica'));
  assert.equal(r.es_provisional, true);
});
