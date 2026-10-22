// Auditoría local de las cuatro líneas comerciales. No activa rutas ni migra DB.
// Uso: node scripts/auditar-cpp.js --desde=2026-01-01 --hasta=2026-09-30 --corte=2026-09-30 --salida=/tmp/cpp.json
// --datos=/ruta/source.json permite repetir la prueba sin conexión (arrays raw).
const fs = require('node:fs');
const path = require('node:path');
const { LINEAS, UNIDADES, crearCalculador, resumir } = require('../src/services/cpp');
const { consultaSnapshot, seleccionarSnapshot } = require('../src/services/cppDatos');

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
    const ventas = (await db.query(consultaSnapshot('ventas_lineas', 'AND btrim(r.linea)=ANY($3::text[])'), [args.desde, args.hasta, LINEAS])).rows;
    const categorias = [...new Set(ventas.filter((r) => String(r.linea ?? '').trim() === 'Laminados').map((r) => String(r.categoria ?? '').trim()))];
    const articulos = [...new Set(ventas.filter((r) => String(r.linea ?? '').trim() !== 'Laminados').map((r) => String(r.codigo_articulo ?? '').trim()).filter(Boolean))];
    // Laminados conserva sus grupos de categoría. Las otras líneas recuperan
    // todo el historial de sus propios SKUs, incluso si cambió su clasificación.
    const compras = (await db.query(consultaSnapshot('compras_lineas', `AND
      ((r.fec_emis >= $5::date AND btrim(r.categoria)=ANY($3::text[])) OR btrim(r.codigo_articulo)=ANY($4::text[]))`), ['1900-01-01', args.corte, categorias, articulos, inicioCompras])).rows;
    const historial = (await db.query('SELECT min(fec_emis)::text AS primera_compra FROM raw_thermoplastica.compras_lineas')).rows[0];
    const laminados=(await db.query(`SELECT i.compras,i.ventas FROM thermoplastica.cpp_laminados_publicacion p
      JOIN thermoplastica.cpp_laminados_importacion i ON i.id=p.importacion_id WHERE singleton`)).rows[0];
    await db.query('ROLLBACK');
    return { compras, ventas, historial, laminados };
  } finally { await db.end(); }
}

async function main() {
  let datos;
  if (args.datos) {
    const d = JSON.parse(fs.readFileSync(args.datos, 'utf8'));
    const batches = d.batches || d[3];
    datos = batches ? {
      compras: seleccionarSnapshot(d.compras || d[0], batches, 'vstCompras'),
      ventas: seleccionarSnapshot(d.ventas || d[1], batches, 'vstFacturas_Devoluciones'), historial: null,
    } : { compras: ultimoBatch(d[0]), ventas: ultimoBatch(d[1]), historial: null,
      advertencia_snapshot: 'Archivo antiguo sin metadatos de cargas: no permite detectar bajas en la fuente. No usar para aprobar producción.' };
    datos.ventas = datos.ventas.filter((r) => LINEAS.includes(String(r.linea ?? '').trim()) && r.fec_emis.slice(0, 10) >= args.desde && r.fec_emis.slice(0, 10) <= args.hasta);
    const categorias = new Set(datos.ventas.filter((r) => String(r.linea ?? '').trim() === 'Laminados').map((r) => String(r.categoria ?? '').trim()));
    const articulos = new Set(datos.ventas.filter((r) => String(r.linea ?? '').trim() !== 'Laminados').map((r) => String(r.codigo_articulo ?? '').trim()).filter(Boolean));
    const inicioCompras = `${Number(args.desde.slice(0, 4)) - 1}-01-01`;
    datos.compras = datos.compras.filter((r) => r.fec_emis.slice(0, 10) <= args.corte &&
      ((r.fec_emis.slice(0, 10) >= inicioCompras && categorias.has(String(r.categoria ?? '').trim())) || articulos.has(String(r.codigo_articulo ?? '').trim())));
  } else datos = await leerPostgres();
  const cpp = crearCalculador(datos.compras, { corte: args.corte });
  const cppLam=datos.laminados ? crearCalculador(datos.laminados.compras,{corte:args.corte}) : cpp;
  const vv=datos.laminados ? [...datos.ventas.filter((r)=>String(r.linea).trim()!=='Laminados'),
    ...datos.laminados.ventas.filter((r)=>r.fec_emis>=args.desde && r.fec_emis<=args.hasta)] : datos.ventas;
  const filas = vv.map((v)=>(String(v.linea).trim()==='Laminados'?cppLam:cpp).calcularVenta(v));
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
    tipo: datos.laminados ? 'laminados_publicado_otras_lineas_provisionales' : 'auditoria_cpp_sin_activar_en_produccion', creado_en: new Date().toISOString(),
    periodo_ventas: { desde: args.desde, hasta: args.hasta }, corte_compras: cpp.corte,
    primera_compra_disponible: datos.historial?.primera_compra || cpp.primeraCompra,
    advertencia_snapshot: datos.advertencia_snapshot || null,
    criterio: 'Laminados conserva la jerarquía del PDF. Empaques, Tapas y Valvulas e Inyectables usan únicamente compras del mismo código: año de venta, luego años anteriores disponibles de más reciente a más antiguo, priorizando H2 antes del año completo.',
    pendiente: ['Completar el historial de compras propias anterior al inicio de la ingesta para los artículos que siguen sin CPP.', 'Revisar compras del mismo código que aparecen en varias líneas.', 'Aclarar la referencia del usuario a Laminados en millares frente a los kilos documentados en el PDF; conservar Laminados sin cambios mientras se aclara.', 'Mantener documentadas las diferencias de alcance y datos de Laminados frente al reporte de referencia.'],
    resumen: resumir(filas), lineas: grupos, incidencias_compras: cpp.incidencias,
    excluidas: filas.filter((r) => r.excluida).reduce((a, r) => { a[r.motivo] = (a[r.motivo] || 0) + 1; return a; }, {}),
  };
  if (args.salida) fs.writeFileSync(args.salida, JSON.stringify(salida, null, 2) + '\n');
  console.log(JSON.stringify({ periodo: salida.periodo_ventas, corte_compras: cpp.corte, primera_compra_disponible: salida.primera_compra_disponible, lineas: Object.fromEntries(Object.entries(grupos).map(([k, v]) => [k, { ...v, skus: v.skus.length }])), incidencias_compras: cpp.incidencias.length }, null, 2));
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
