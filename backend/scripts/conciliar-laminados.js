// Compara el alcance comercial del workbook (Laminados + Almacén + Flexografía)
// con su referencia normalizada, sin cambiar la selección Laminados de la app.
// --referencia=/tmp/referencia.json --desde=2026-01-01 --hasta=2026-09-30
// --corte=2026-09-30 [--datos-erp=/tmp/exporte.json] [--salida=/tmp/resultado.json]
const fs = require('node:fs');
const { crearCalculador, resumir } = require('../src/services/cpp');
const { leerLaminados } = require('../src/services/cppDatos');
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  if (!a.startsWith('--') || i < 0) throw new Error('Usar argumentos --nombre=valor.');
  return [a.slice(2, i), a.slice(i + 1)];
}));
const lineas = ['Laminados','Almacén General','Flexografía'];
async function main() {
  if (!args.referencia || !args.desde || !args.hasta || !args.corte) throw new Error('Se requieren referencia, desde, hasta y corte.');
  const validador = crearCalculador([], { corte: args.corte });
  if (![args.desde,args.hasta].every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)) || args.desde > args.hasta || args.hasta > validador.corte) throw new Error('Período no válido.');
  const referencia = JSON.parse(fs.readFileSync(args.referencia, 'utf8'));
  let datos;
  if (args['datos-erp']) datos = JSON.parse(fs.readFileSync(args['datos-erp'], 'utf8'));
  else {
    require('dotenv').config({ quiet: true });
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized:false }, connectionTimeoutMillis:20000, statement_timeout:60000 });
    try { datos = await leerLaminados(pool, { desde:args.desde, hasta:args.hasta, corte:args.corte, lineas }); }
    finally { await pool.end(); }
  }
  const cpp = crearCalculador(datos.compras, { corte:args.corte });
  const ventas = datos.ventas.filter((r) => r.fec_emis.slice(0,10) >= args.desde && r.fec_emis.slice(0,10) <= args.hasta && lineas.includes(String(r.linea).trim()))
    .map((r) => cpp.calcularVenta({...r,linea_origen:r.linea,linea:'Laminados'})).filter((r) => !r.excluida);
  const categorias = referencia.categorias.map((ref) => {
    const s = resumir(ventas.filter((r) => String(r.categoria ?? '').trim() === ref.categoria));
    return { categoria:ref.categoria, ventas:s.ventas_totales, costo:s.costo_mp, margen_pct_pdf:s.margen_mp_pct,
      referencia_ventas:ref.ventas, referencia_costo:ref.costo,
      delta_ventas:s.ventas_totales-ref.ventas,
      delta_costo:ref.costo === null ? null : s.costo_mp-ref.costo,
      costo_coincide:ref.costo === null ? null : s.costo_mp !== null && Math.abs(s.costo_mp-ref.costo) < 0.005,
      referencia_sin_cpp_con_margen:ref.costo === null && ref.margen_pct !== null,
    };
  });
  const resultado = { fuente:args['datos-erp'] ? 'exporte_directo_erp' : 'postgres_snapshots_vigentes',
    creado_en:new Date().toISOString(), corte:args.corte, periodo:{desde:args.desde,hasta:args.hasta},
    alcance_comparacion:lineas, referencia:referencia.fuente,
    resumen:resumir(ventas), categorias_con_costo:categorias.filter((r) => r.referencia_costo !== null).length,
    categorias_costo_coincidente:categorias.filter((r) => r.costo_coincide).length, categorias };
  if (args.salida) fs.writeFileSync(args.salida, JSON.stringify(resultado,null,2)+'\n');
  console.log(JSON.stringify(resultado,null,2));
}
main().catch((e) => { console.error(e.message); process.exitCode=1; });
