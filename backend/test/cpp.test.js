const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearCalculador, resumir, fleteCompra } = require('../src/services/cpp');

const compra = (r = {}) => ({ fec_emis: '2026-02-01', tipo_doc: 'FACT', codigo_articulo: 'SKU1', linea: 'Laminados', categoria: 'PVC', sublinea: '250 micras', color: 'Cristal', unidades: 100, total_sin_iva: 2000, proveedor: 'Otro', ...r });
const venta = (r = {}) => ({ fec_emis: '2026-01-10', codigo_articulo: 'SKU1', linea: 'Laminados', categoria: 'PVC', sublinea: '250 micras', color: 'Cristal', unidades: 10, total_sin_iva: 300, cliente: 'Externo', ...r });
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
test('la confirmación de millares no cambia la unidad de Laminados ni activa transformación', () => {
  const c = engine([compra({ linea: 'Inyectables' })]);
  assert.equal(c.calcularVenta(venta()).unidad, 'kg');
  assert.equal(c.calcularVenta(venta()).estado_unidad, 'documentada_pdf');
  assert.equal(c.calcularVenta(venta({ linea: 'Inyectables' })).estado_unidad, 'confirmada_usuario');
  assert.equal(c.calcularVenta(venta({ linea: 'Soplado' })).excluida, true);
});
for (const linea of ['Empaques para alimentos', 'Tapas y Valvulas', 'Inyectables']) {
  test(`${linea}: pondera compras y ventas en millares sin convertir otra vez por 1,000`, () => {
    const c = engine([
      compra({ linea, unidades: 2.5, total_sin_iva: 2500 }),
      compra({ linea, unidades: 7.5, total_sin_iva: 8250 }),
    ]);
    const r = c.calcularVenta(venta({ linea, unidades: 0.4, total_sin_iva: 600 }));
    assert.equal(r.unidad, 'millar');
    assert.equal(r.estado_unidad, 'confirmada_usuario');
    assert.equal(r.es_provisional, false);
    close(r.cantidad, 0.4); close(r.cpp, 1075); close(r.costo_mp, 430);
    close(r.margen_mp, 170); close(r.margen_mp_pct, 170 / 600 * 100);
  });
}
test('excluye ventas internas sin tildes y reasigna Colgate', () => {
  const c = engine([compra()]);
  assert.equal(c.calcularVenta(venta({ cliente: '5779022-Thermoplástica S.A.' })).motivo, 'venta_interna');
  assert.equal(c.calcularVenta(venta({ cliente: 'Termoplastica' })).motivo, 'venta_interna');
  assert.equal(c.calcularVenta(venta({ cliente: 'Colgate-Palmolive' })).nombre_vendedor, 'Gerencia Laminados');
  assert.equal(c.calcularVenta(venta({linea:'Inyectables',cliente:'Colgate-Palmolive',nombre_vendedor:'Vendedor original'})).nombre_vendedor,'Vendedor original');
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
for (const linea of ['Empaques para alimentos', 'Tapas y Valvulas', 'Inyectables']) {
  test(`${linea}: usa compras anteriores propias antes que compras actuales de otros artículos`, () => {
    const c = engine([
      compra({ linea, codigo_articulo: 'SKU2', total_sin_iva: 10000 }),
      compra({ linea, fec_emis: '2025-08-01', total_sin_iva: 60000 }),
    ]);
    const r = c.calcularVenta(venta({ linea }));
    close(r.cpp, 600);
    assert.equal(r.fuente_cpp, 'SKU_H2_ANTERIOR');
    assert.equal(r.fuente.nivel, 'articulo');
    assert.deepEqual(r.fuente.llave, ['SKU1']);
    assert.equal(r.es_provisional, false);
  });
}
test('por artículo pondera solo sus compras actuales aunque cambie su categoría', () => {
  const linea = 'Inyectables';
  const c = engine([
    compra({ linea, codigo_articulo: 'SKU2', total_sin_iva: 100000 }),
    compra({ linea, codigo_articulo: ' SKU1 ', categoria: 'Anterior', unidades: 10, total_sin_iva: 100 }),
    compra({ linea, unidades: 90, total_sin_iva: 2700 }),
    compra({ linea, fec_emis: '2025-08-01', total_sin_iva: 60000 }),
  ]);
  const r = c.buscar(venta({ linea }));
  close(r.cpp, 28); assert.equal(r.fuente_cpp, 'SKU_ANIO');
});
test('por artículo elige el año anterior más reciente disponible, incluso anterior a A-1', () => {
  const linea = 'Tapas y Valvulas';
  const c = engine([
    compra({ linea, fec_emis: '2023-08-01', total_sin_iva: 3000 }),
    compra({ linea, fec_emis: '2024-02-01', total_sin_iva: 4000 }),
    compra({ linea, fec_emis: '2024-08-01', total_sin_iva: 6000 }),
    compra({ linea, codigo_articulo: 'SKU2', fec_emis: '2025-08-01', total_sin_iva: 10000 }),
  ]);
  const r = c.buscar(venta({ linea }));
  close(r.cpp, 60); assert.equal(r.fuente.anio, 2024); assert.equal(r.fuente.ventana, 'h2');
});
test('por artículo usa el año anterior completo cuando no hubo compra propia en H2', () => {
  const linea = 'Empaques para alimentos';
  const c = engine([
    compra({ linea, fec_emis: '2025-02-01', total_sin_iva: 3000 }),
    compra({ linea, codigo_articulo: 'SKU2', fec_emis: '2025-08-01', total_sin_iva: 9000 }),
    compra({ linea, fec_emis: '2024-08-01', total_sin_iva: 1000 }),
  ]);
  const r = c.buscar(venta({ linea }));
  close(r.cpp, 30); assert.equal(r.fuente_cpp, 'SKU_ANIO_ANTERIOR'); assert.equal(r.fuente.anio, 2025);
});
test('sin compras propias no toma CPP de otros artículos ni manuales de Laminados', () => {
  const linea = 'Inyectables';
  for (const categoria of ['PVC', 'Aluminio Impreso', 'Foil de Aluminio']) {
    const campos = { linea, categoria, sublinea: '25 micras', color: 'Mate' };
    const r = engine([compra({ ...campos, codigo_articulo: 'SKU2' })]).calcularVenta(venta(campos));
    assert.equal(r.cpp, null); assert.equal(r.fuente_cpp, 'sin_cpp'); assert.equal(r.margen_mp, null);
  }
  const r = engine([compra({ linea, codigo_articulo: '' })]).buscar(venta({ linea, codigo_articulo: null }));
  assert.equal(r.fuente_cpp, 'articulo_sin_codigo'); assert.equal(r.cpp, null);
});
test('una compra incompleta de otro artículo no bloquea el CPP propio', () => {
  const linea = 'Inyectables';
  const c = engine([compra({ linea }), compra({ linea, codigo_articulo: 'SKU2', unidades: null })]);
  close(c.buscar(venta({ linea })).cpp, 20);
});
test('una llave No Aplica no se presenta sin advertencia', () => {
  const campos = { categoria: 'No Aplica', sublinea: 'No Aplica', color: 'No Aplica' };
  const r = engine([compra(campos)]).calcularVenta(venta(campos));
  assert.ok(r.advertencias.includes('clave_totalmente_generica'));
  assert.equal(r.es_provisional, true);
});

test('no inventa el flete 2023 para respaldos históricos fuera de los años del PDF',()=>{
 const c=crearCalculador([{fec_emis:'2023-11-01',linea:'Laminados',categoria:'Prueba',sublinea:'',color:'',unidades:100,total_sin_iva:1000,proveedor:'BESEL'}],{corte:'2026-09-30'});
 const v=c.calcularVenta({fec_emis:'2024-01-01',linea:'Laminados',categoria:'Prueba',sublinea:'',color:'',unidades:1,total_sin_iva:20,cliente:'Externo'});
 assert.equal(v.cpp,null);assert.equal(v.fuente_cpp,'datos_compra_pendientes');
 assert.ok(v.motivos.includes('flete_anio_pendiente'));
});
