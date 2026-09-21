#!/usr/bin/env node
/**
 * Aplica la capa semantica (Fase 1) a Postgres.
 *
 *   node database/setup/aplicar-capa-semantica.js "postgresql://..."
 *
 * Hace tres cosas:
 *   1. Crea el schema "analitica" con sus 9 vistas documentadas
 *   2. Crea el rol de solo lectura agente_ia con una password aleatoria
 *   3. Verifica que los permisos quedaron bien y te imprime la cadena
 *      de conexion que va en DATABASE_URL_READONLY
 *
 * Es idempotente: se puede correr varias veces. No modifica ni borra datos,
 * solo crea vistas (que son consultas guardadas, no copias de informacion).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const conn = process.argv[2] || process.env.DATABASE_URL;

if (!conn) {
  console.error(`
Falta la cadena de conexion.

  node database/setup/aplicar-capa-semantica.js "postgresql://usuario:password@host/basedatos"

La consigues en el dashboard de Render:
  Dashboard -> abaco-demo-thermoplastica-db -> Connections -> External Database URL
`);
  process.exit(1);
}

const leer = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

(async () => {
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows: [info] } = await client.query(
    'SELECT current_database() db, current_user usr, version() v'
  );
  console.log(`\nConectado a "${info.db}" como "${info.usr}"`);
  console.log(`${info.v.split(',')[0]}\n`);

  // ---- 1. Vistas -----------------------------------------------------------
  console.log('[1/3] Creando schema analitica y sus vistas...');
  await client.query(leer('../migrations/010_capa_semantica.sql'));

  const { rows: vistas } = await client.query(`
    SELECT table_name FROM information_schema.views
    WHERE table_schema = 'analitica' ORDER BY table_name
  `);
  console.log(`      ${vistas.length} vistas creadas: ${vistas.map(v => v.table_name).join(', ')}\n`);

  // ---- 2. Rol de solo lectura ---------------------------------------------
  console.log('[2/3] Creando rol de solo lectura agente_ia...');
  const password = crypto.randomBytes(24).toString('base64url');

  const rolSql = leer('rol_agente_ia.sql')
    .replace(/CAMBIAR_ESTA_PASSWORD/g, password)
    .replace(/GRANT CONNECT ON DATABASE \w+/, `GRANT CONNECT ON DATABASE ${info.db}`);

  await client.query(rolSql);
  console.log('      Rol creado.\n');

  // ---- 3. Verificacion -----------------------------------------------------
  console.log('[3/3] Verificando el candado...');
  const { rows: checks } = await client.query(`
    SELECT 'puede leer analitica.v_cxc' AS chequeo,
           has_table_privilege('agente_ia','analitica.v_cxc','SELECT') AS ok
    UNION ALL SELECT 'NO puede leer public.transacciones',
           NOT has_table_privilege('agente_ia','public.transacciones','SELECT')
    UNION ALL SELECT 'NO puede crear objetos en analitica',
           NOT has_schema_privilege('agente_ia','analitica','CREATE')
    UNION ALL SELECT 'NO puede crear objetos en public',
           NOT has_schema_privilege('agente_ia','public','CREATE')
  `);
  for (const c of checks) console.log(`      ${c.ok ? 'OK  ' : 'FALLO'}  ${c.chequeo}`);

  // ---- Prueba real de las vistas ------------------------------------------
  const { rows: [meta] } = await client.query('SELECT * FROM analitica.v_meta');
  const { rows: [kpi]  } = await client.query('SELECT * FROM analitica.v_kpis');
  console.log(`
Datos que ve el agente:
      fecha de corte      ${meta.fecha_corte.toISOString().slice(0,10)} (rezago de ${meta.dias_de_rezago} dias)
      cartera por cobrar  Q${Number(kpi.cxc_total).toLocaleString('es-GT')} en ${kpi.cxc_facturas} facturas
      vencida             Q${Number(kpi.cxc_vencida).toLocaleString('es-GT')}
      deuda proveedores   Q${Number(kpi.cxp_total).toLocaleString('es-GT')}
      efectivo            Q${Number(kpi.efectivo_gtq).toLocaleString('es-GT')} GTQ + $${Number(kpi.efectivo_usd).toLocaleString('es-GT')} USD
      runway              ${kpi.runway_dias} dias
`);

  // ---- Cadena de conexion de solo lectura ----------------------------------
  const u = new URL(conn);
  u.username = 'agente_ia';
  u.password = password;

  const todoOk = checks.every(c => c.ok);
  console.log(todoOk ? 'Listo. Fase 1 aplicada.\n' : 'ATENCION: alguna verificacion fallo, revisar arriba.\n');
  console.log('Guardar esta variable en Render (servicio abaco-demo-thermoplastica):\n');
  console.log(`DATABASE_URL_READONLY=${u.toString()}\n`);
  console.log('Es la unica copia de la password. Si se pierde, volver a correr este script.\n');

  await client.end();
})().catch(err => {
  console.error('\nError:', err.message);
  if (err.hint) console.error('Pista:', err.hint);
  process.exit(1);
});
