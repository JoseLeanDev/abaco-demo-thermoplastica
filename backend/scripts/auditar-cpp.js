// Auditoría local de las cuatro líneas comerciales. No activa rutas ni migra DB.
// Uso: node scripts/auditar-cpp.js --desde=2026-01-01 --hasta=2026-09-30 --corte=2026-09-30 --salida=/tmp/cpp.json
// --datos=/ruta/source.json permite repetir la prueba sin conexión (arrays raw).
const fs = require('node:fs');
const path = require('node:path');
const { LINEAS, UNIDADES, crearCalculador, resumir } = require('../src/services/cpp');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  if (!a.startsWith('--') || i < 0) throw new Error('Usar argumentos --nombre=valor.');
  return [a.slice(2, i), a.slice(i + 1)];
}));
function fecha(s) {
  const d = new Date(`${s}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
if (![args.desde, args.hasta, args.corte].every(fecha) || args.desde > args.hasta || args.hasta > args.corte) {
  throw new Error('Se requieren --desde, --hasta y --corte válidos; desde <= hasta <= corte.');
}

// El hash identifica factura/artículo, no una fila física. Conservar TODAS las
// filas del batch más reciente de cada hash para no perder cantidades partidas.
function ultimoBatch(rows) {
  const ultimo = new Map();
  for (const r of rows) {
    const actual = ultimo.get(r.source_row_hash);
    if (!actual || r.ingested_at > actual.ingested_at) ultimo.set(r.source_row_hash, r);
  }
  return rows.filter((r) => r.batch_id === ultimo.get(r.source_row_hash).batch_id);
}

async function leerPostgres() {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const { Client } = require('pg');
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000, statement_timeout: 60000 });
  await db.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const inicioCompras = `${Number(args.desde.slice(0, 4)) - 1}-01-01`;
    const campos = 'r.fact_num,r.fec_emis::text,r.tipo_doc,r.codigo_articulo,r.articulo,r.linea,r.categoria,r.sublinea,r.color,r.unidades,r.total_sin_iva';
    // Las compras usan el año completo disponible hasta corte; no la ventana de ventas.
    const baseRaw = (tabla, extra, filtro) => `
      WITH ultimo AS (
        SELECT DISTINCT ON (source_row_hash) source_row_hash,batch_id
        FROM raw_thermoplastica.${tabla}
        ORDER BY source_row_hash,ingested_at DESC,raw_id DESC
      )
      SELECT ${campos},${extra}
      FROM raw_thermoplastica.${tabla} r JOIN ultimo u USING(source_row_hash,batch_id)
      WHERE r.fec_emis BETWEEN $1::date AND $2::date ${filtro}`;
    const ventas = (await db.query(baseRaw('ventas_lineas', 'r.cliente,r.nombre_vendedor', 'AND btrim(r.linea)=ANY($3::text[])'), [args.desde, args.hasta, LINEAS])).rows;
    const categorias = [...new Set(ventas.map((r) => String(r.categoria ?? '').trim()))];
    // Una compra de otro artículo puede financiar el CPP del grupo. Se limita
    // por categoría, conservando todas las sublíneas/colores para L2/L3.
    const compras = (await db.query(baseRaw('compras_lineas', 'r.proveedor', 'AND btrim(r.categoria)=ANY($3::text[])'), [inicioCompras, args.corte, categorias])).rows;
    const historial = (await db.query('SELECT min(fec_emis)::text AS primera_compra FROM raw_thermoplastica.compras_lineas')).rows[0];
    await db.query('ROLLBACK');
    return { compras, ventas, historial };
  } finally { await db.end(); }
}

async function main() {
  let datos;
  if (args.datos) {
    const d = JSON.parse(fs.readFileSync(args.datos, 'utf8'));
    datos = { compras: ultimoBatch(d[0]), ventas: ultimoBatch(d[1]), historial: null };
    datos.ventas = datos.ventas.filter((r) => LINEAS.includes(String(r.linea ?? '').trim()) && r.fec_emis.slice(0, 10) >= args.desde && r.fec_emis.slice(0, 10) <= args.hasta);
    const categorias = new Set(datos.ventas.map((r) => String(r.categoria ?? '').trim()));
    datos.compras = datos.compras.filter((r) => categorias.has(String(r.categoria ?? '').trim()));
  } else datos = await leerPostgres();
  const cpp = crearCalculador(datos.compras, { corte: args.corte });
  const filas = datos.ventas.map(cpp.calcularVenta);
  const grupos = {};
  for (const linea of LINEAS) {
    const propias = filas.filter((r) => String(r.linea ?? '').trim() === linea && !r.excluida);
    const porSku = new Map();
    for (const r of propias) {
      if (!porSku.has(r.codigo_articulo)) porSku.set(r.codigo_articulo, []);
      porSku.get(r.codigo_articulo).push(r);
    }
    grupos[linea] = {
      ...resumir(propias), unidad: UNIDADES[linea],
      skus: [...porSku].map(([codigo, rr]) => ({ codigo, descripcion: rr[0].articulo, ...resumir(rr), cpp_y_fuentes: [...new Map(rr.map((r) => [JSON.stringify([r.cpp, r.fuente_cpp]), { cpp: r.cpp, fuente_cpp: r.fuente_cpp, compra: r.fuente, advertencias: r.advertencias }])).values()] })),
    };
  }
  const salida = {
    tipo: 'auditoria_cpp_sin_activar_en_produccion', creado_en: new Date().toISOString(),
    periodo_ventas: { desde: args.desde, hasta: args.hasta }, corte_compras: cpp.corte,
    primera_compra_disponible: datos.historial?.primera_compra || cpp.primeraCompra,
    criterio: 'Aplicación literal del documento de Laminados a modo de simulación; requiere validar los respaldos de categoría antes de extenderlos a otras líneas.',
    pendiente: ['Confirmar unidad común de compra y venta y homogeneidad de los grupos en las tres líneas distintas de Laminados.', 'Definir si es válido usar categoría completa antes de una compra anterior del mismo SKU/presentación en las otras tres líneas.', 'Revisar grupos de CPP que contienen compras de varias líneas.', 'Resolver diferencias de alcance y datos frente al reporte de referencia.'],
    resumen: resumir(filas), lineas: grupos, incidencias_compras: cpp.incidencias,
    excluidas: filas.filter((r) => r.excluida).reduce((a, r) => { a[r.motivo] = (a[r.motivo] || 0) + 1; return a; }, {}),
  };
  if (args.salida) fs.writeFileSync(args.salida, JSON.stringify(salida, null, 2) + '\n');
  console.log(JSON.stringify({ periodo: salida.periodo_ventas, corte_compras: cpp.corte, primera_compra_disponible: salida.primera_compra_disponible, lineas: Object.fromEntries(Object.entries(grupos).map(([k, v]) => [k, { ...v, skus: v.skus.length }])), incidencias_compras: cpp.incidencias.length }, null, 2));
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
