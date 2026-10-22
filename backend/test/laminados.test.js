const { test } = require('node:test');
const assert = require('node:assert/strict');
const { seleccionarSnapshot } = require('../src/services/cppDatos');
const { construirReporte, obtenerReporte, ultimoMesCerrado } = require('../src/services/laminados');
const { adaptarVentas, adaptarMargenes, middlewareLaminados } = require('../src/services/laminadosHttp');
const { parsePeriodo } = require('../src/services/periodo');
const P = parsePeriodo({ query: { desde: '2026-01-01', hasta: '2026-09-30' } });
const venta = (r = {}) => ({ fec_emis: '2026-01-10', linea: 'Laminados', categoria: 'PVC', sublinea: '250 micras', color: 'Cristal', unidades: 10, total_sin_iva: 300, cliente: 'C1-Cliente externo', codigo_cliente: 'C1', codigo_articulo: 'SKU1', nombre_vendedor: 'Vendedor', co_sucu: '000', fact_num: 1, tipo_doc: 'FACT', ...r });
const compra = (r = {}) => ({ fec_emis: '2026-02-01', linea: 'Laminados', categoria: 'PVC', sublinea: '250 micras', color: 'Cristal', unidades: 100, total_sin_iva: 2000, proveedor: 'Otro', ...r });
const reporte = (ventas, compras = [compra()]) => construirReporte({ ventas, compras, articulos: [{ codigo_articulo: 'SKU1', articulo_id: 1 }] }, P, { corte: '2026-09-30' });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const batch = (r = {}) => ({ source_view: 'vstFacturas_Devoluciones', batch_id: 'a', started_at: '2026-09-18', finished_at: '2026-09-18', status: 'ok', window_from: '2026-01-01', window_to: '2026-09-18', ...r });

test('una carga completa posterior elimina una factura ausente y conserva todas las filas partidas', () => {
  const rows = [venta({ batch_id: 'a', id: 'eliminada' }), venta({ batch_id: 'b', id: 'parte1' }), venta({ batch_id: 'b', id: 'parte2' })];
  const batches = [batch(), batch({ batch_id: 'b', started_at: '2026-10-01', finished_at: '2026-10-01', window_to: '2026-10-01' })];
  assert.deepEqual(seleccionarSnapshot(rows, batches, 'vstFacturas_Devoluciones').map((r) => r.id), ['parte1','parte2']);
});
test('una carga vacía completa reemplaza la ventana, pero una fallida o de otra fuente no', () => {
  const rows = [venta({ batch_id: 'a' })];
  const nueva = batch({ batch_id: 'b', started_at: '2026-10-01', finished_at: '2026-10-01', window_to: '2026-10-01' });
  assert.equal(seleccionarSnapshot(rows, [batch(), nueva], 'vstFacturas_Devoluciones').length, 0);
  for (const cambio of [{status:'error'}, {finished_at:null}, {source_view:'vstCompras'}, {window_from:'2026-07-01'}]) {
    assert.equal(seleccionarSnapshot(rows, [batch(), {...nueva,...cambio}], 'vstFacturas_Devoluciones').length, 1);
  }
});
test('el cierre de mes usa Guatemala incluso en el cambio de mes UTC', () => {
  assert.equal(ultimoMesCerrado(new Date('2026-11-01T01:00:00Z')), '2026-09-30');
  assert.equal(ultimoMesCerrado(new Date('2026-11-01T07:00:00Z')), '2026-10-31');
});
test('resumen, vendedores, categorías y matriz usan la misma base con CPP, sin extrapolar', () => {
  const r = reporte([venta(), venta({ categoria: 'Sin compras', codigo_articulo: 'SKU2', unidades: 2, total_sin_iva: 700, fact_num: 2 })]);
  const a = adaptarVentas(r, '/', {});
  close(a.ventas_sin_iva, 1000); close(a.margen_bruto, 100); close(a.costo_total, 200); close(a.margen_bruto_pct, 100 / 3);
  close(adaptarVentas(r, '/vendedores', {}).vendedores[0].margen, 100);
  close(adaptarMargenes(r, '/vendedores')[0].margen_pct_actual, 100 / 3);
  const m = adaptarVentas(r, '/matriz', { filas:'categoria', columnas:'vendedor' });
  close(m.filas[0].celdas.Vendedor.margen_pct, 100 / 3);
  close(r.data.resumen.total_margen_bruto_q, a.margen_bruto);
});
test('ventas sin CPP permanecen N/D y una devolución con costo sí suma', () => {
  const r = reporte([venta({ unidades: -2, total_sin_iva: -60 }), venta({ unidades: 10, total_sin_iva: 300 }), venta({ categoria: 'Otro', total_sin_iva: 2000, codigo_articulo:'SKU2' })]);
  close(r.metricas.margen_mp, 80); close(r.metricas.ventas_con_cpp, 240);
  const p = r.data.productos.find((r) => r.sku === 'SKU2');
  assert.equal(p.costo_actual, null); assert.equal(p.margen_pct_actual, null); assert.equal(p.margen_q, null);
});
test('excluye internas y ventas fuera del período; Colgate se reasigna a Gerencia', () => {
  const r = reporte([venta({ cliente:'C1-Thermoplástica' }), venta({ cliente:'C2-COLGATE', codigo_cliente:'C2' }), venta({ fec_emis:'2026-10-01' }), venta({ linea:'Inyectables' })]);
  assert.equal(r.actual.length, 1); assert.equal(r.items('vendedor')[0].nombre, 'Gerencia Laminados');
});
test('precio/volumen/nuevos/perdidos reconcilian exactamente la variación de ventas', () => {
  const r = reporte([venta(), venta({ fec_emis:'2025-01-10', unidades: 5, total_sin_iva: 100 }), venta({ codigo_articulo:'SKU2', total_sin_iva: 150 }), venta({ fec_emis:'2025-01-10', codigo_articulo:'SKU3', total_sin_iva: 40 })]);
  const p = adaptarVentas(r, '/desglose', {}).puente;
  close(p.anterior + p.precio + p.volumen + p.nuevos + p.perdidos + p.otros, p.actual);
});
test('el detalle mensual incluye los meses intermedios y excluye años fuera del período', () => {
  const r = reporte([venta({ total_sin_iva:2000 }), venta({fec_emis:'2025-11-10'}), venta({fec_emis:'2024-11-10'})]);
  const d = adaptarMargenes(r, '/producto/1/detalle');
  assert.deepEqual(d.historial.map((r) => r.fecha), ['2025-11-01','2026-01-01']);
});
test('el detalle mantiene números exportables y no expone metadatos internos de ingesta', () => {
  const r = reporte([venta({total_con_iva:'336.00',iva:'36.00',batch_id:'interno',source_row_hash:'interno'})]);
  const d = adaptarVentas(r, '/detalle', {}).filas[0];
  assert.equal(typeof d.iva, 'number'); assert.equal(typeof d.total_con_iva, 'number');
  assert.equal(d.batch_id, undefined); assert.equal(d.source_row_hash, undefined);
});
test('el middleware requiere Laminados explícito y comparte el resultado entre los contratos', async () => {
  let llamadas = 0;
  const cargar = async () => { llamadas += 1; return reporte([venta()]); };
  const res = { json(v) { this.body=v; return this; }, status(v) { this.code=v; return this; } };
  let siguientes = 0;
  const handler = middlewareLaminados('ventas', null, cargar);
  await handler({method:'GET',path:'/',query:{categoria:'Soplado'}},res,()=>siguientes++);
  await handler({method:'GET',path:'/filtros',query:{categoria:'Laminados'}},res,()=>siguientes++);
  assert.equal(siguientes, 2); assert.equal(llamadas, 0);
  await handler({method:'GET',path:'/',query:{categoria:'Laminados'}},res,()=>siguientes++);
  assert.equal(res.body.data.metodologia.unidad, 'kg'); close(res.body.data.margen_bruto, 100);
});
for (const categoria of ['Empaques para alimentos','Tapas y Valvulas','Inyectables']) {
 test(`${categoria}: todos los contratos comparten compras propias en millares y no incorporan Laminados`,async()=>{
  const datos={ventas:[venta({linea:categoria,unidades:2,total_sin_iva:3000}),
    venta({linea:categoria,codigo_articulo:'SINCOMPRA',unidades:1,total_sin_iva:1500}),
    venta({linea:'Laminados',total_sin_iva:9999})],
    compras:[compra({linea:categoria,codigo_articulo:'SKU1',fec_emis:'2022-08-01',unidades:10,total_sin_iva:10000}),
      compra({linea:categoria,codigo_articulo:'OTRO',total_sin_iva:100})],
    articulos:[{codigo_articulo:'SKU1',articulo_id:1},{codigo_articulo:'SINCOMPRA',articulo_id:2}]};
  const r=construirReporte(datos,P,{corte:'2026-09-30',query:{categoria}});
  assert.equal(r.meta.unidad,'millar');close(r.metricas.ventas_totales,4500);
  close(r.metricas.ventas_con_cpp,3000);close(r.metricas.costo_mp,2000);close(r.metricas.margen_mp,1000);
  const p=r.data.productos.find(p=>p.sku==='SINCOMPRA');assert.equal(p.costo_actual,null);assert.equal(p.margen_pct_actual,null);
  assert.equal(r.data.productos[0].categoria,categoria);
  const v=adaptarVentas(r,'/',{});close(v.margen_bruto,r.metricas.margen_mp);
  close(adaptarMargenes(r,'/vendedores')[0].margen_pct_actual,100/3);
  close(adaptarVentas(r,'/matriz',{filas:'categoria',columnas:'vendedor'}).filas[0].celdas.Vendedor.margen_pct,100/3);
  let categoriaRecibida;
  const cargar=async(req)=>{categoriaRecibida=req.query.categoria;return r;};
  const res={json(v){this.body=v;return this;},status(){return this;}};
  await middlewareLaminados('ventas',null,cargar)({method:'GET',path:'/',query:{categoria}},res,()=>assert.fail('No debe usar el contrato ERP'));
  assert.equal(categoriaRecibida,categoria);assert.equal(res.body.metodologia.unidad,'millar');
 });
}
test('no acepta un corte abierto ni usa el filtro de producto para reducir compras', async () => {
  let opciones;
  const req = {query:{desde:'2026-01-01',hasta:'2026-09-30',categoria:'Laminados',subcategoria:'PVC'}};
  await obtenerReporte(req, null, { now:new Date('2026-10-21T12:00:00Z'), cargar:async (_pool, args) => { opciones=args; return {ventas:[venta()],compras:[compra()],articulos:[]}; } });
  assert.deepEqual(Object.keys(opciones).sort(), ['corte','desde','hasta']);
  await assert.rejects(obtenerReporte({query:{...req.query,corte_cpp:'2026-10-31'}}, null, {now:new Date('2026-10-21T12:00:00Z')}), /cerrados/);
});

test('mes abierto conserva ventas y deja el CPP pendiente sin sustituir costo ERP',()=>{
 const p=parsePeriodo({query:{desde:'2026-01-01',hasta:'2026-10-21'}});
 const r=construirReporte({ventas:[venta(),venta({fec_emis:'2026-10-10',total_sin_iva:900})],compras:[compra()]},p,{corte:'2026-09-30'});
 close(r.metricas.ventas_totales,1200);close(r.metricas.ventas_con_cpp,300);close(r.metricas.ventas_sin_cpp,900);
 close(r.metricas.margen_mp,100);assert.equal(r.actual[1].fuente_cpp,'fuera_de_corte');
});
