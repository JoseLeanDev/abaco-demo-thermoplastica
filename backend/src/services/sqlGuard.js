/**
 * sqlGuard — Validacion del SQL que escribe el modelo.
 *
 * Esta es la SEGUNDA linea de defensa, no la primera. El muro real es el rol
 * de Postgres "agente_ia": solo tiene SELECT sobre el schema analitica y
 * corre con default_transaction_read_only = on. Aunque este validador tuviera
 * un hueco, la base rechaza igual cualquier escritura.
 *
 * Lo que hace aqui es distinto: atrapar el error ANTES de gastar un viaje a la
 * base, y dar un mensaje claro que el agente pueda usar para corregirse solo.
 */

// Palabras que no tienen nada que hacer en una consulta de lectura.
const PROHIBIDAS = [
  'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
  'grant', 'revoke', 'copy', 'vacuum', 'analyze', 'reindex', 'cluster',
  'call', 'do', 'execute', 'prepare', 'deallocate', 'discard',
  'set', 'reset', 'lock', 'listen', 'notify', 'unlisten',
  'begin', 'commit', 'rollback', 'savepoint', 'refresh', 'comment',
  'import', 'security', 'merge'
];

// Funciones que leen el sistema de archivos, la red o duermen el servidor.
const FUNCIONES_PROHIBIDAS = [
  'pg_read_file', 'pg_read_binary_file', 'pg_ls_dir', 'pg_stat_file',
  'lo_import', 'lo_export', 'dblink', 'pg_sleep', 'pg_terminate_backend',
  'pg_cancel_backend', 'pg_reload_conf', 'pg_rotate_logfile',
  'query_to_xml', 'pg_read_server_files'
];

// Solo puede mirar la capa semantica.
const SCHEMAS_PROHIBIDOS = ['pg_catalog', 'information_schema', 'public', 'pg_temp'];

const LIMITE_FILAS = 1000;

/**
 * Quita comentarios y el contenido de los literales de texto, para que las
 * palabras prohibidas no salten por lo que diga un dato.
 * Un proveedor llamado "Update S.A." no debe tumbar la consulta.
 */
function desnudar(sql) {
  let out = '';
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const c = sql[i];
    const sig = sql[i + 1];

    // Comentario de linea:  -- hasta el salto
    if (c === '-' && sig === '-') {
      while (i < n && sql[i] !== '\n') i++;
      out += ' ';
      continue;
    }
    // Comentario de bloque:  /* ... */  (Postgres los anida)
    if (c === '/' && sig === '*') {
      let prof = 1; i += 2;
      while (i < n && prof > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { prof++; i += 2; }
        else if (sql[i] === '*' && sql[i + 1] === '/') { prof--; i += 2; }
        else i++;
      }
      out += ' ';
      continue;
    }
    // Literal de texto:  'algo'   ('' escapa la comilla)
    if (c === "'") {
      i++;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; }
        if (sql[i] === "'") { i++; break; }
        i++;
      }
      out += " '' ";
      continue;
    }
    // Dollar quoting:  $$ ... $$  o  $tag$ ... $tag$
    if (c === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const fin = sql.indexOf(tag, i + tag.length);
        i = fin === -1 ? n : fin + tag.length;
        out += " '' ";
        continue;
      }
    }
    // Identificador entre comillas dobles:  "columna rara"
    if (c === '"') {
      i++;
      while (i < n && sql[i] !== '"') i++;
      i++;
      out += ' id ';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

class SQLRechazado extends Error {
  constructor(motivo) {
    super(motivo);
    this.name = 'SQLRechazado';
    this.esRechazoDeValidacion = true;
  }
}

/**
 * Valida y normaliza. Devuelve el SQL listo para ejecutar.
 * Lanza SQLRechazado con un mensaje que el agente pueda entender y corregir.
 */
function validar(sqlOriginal) {
  if (typeof sqlOriginal !== 'string' || !sqlOriginal.trim()) {
    throw new SQLRechazado('La consulta viene vacia.');
  }

  let sql = sqlOriginal.trim().replace(/;+\s*$/, '');
  const limpio = desnudar(sql).toLowerCase();

  // Una sola sentencia.
  if (limpio.includes(';')) {
    throw new SQLRechazado(
      'Solo se permite UNA sentencia por consulta. Quita el punto y coma del medio.'
    );
  }

  // Tiene que empezar leyendo.
  if (!/^\s*(select|with)\b/i.test(sql)) {
    throw new SQLRechazado(
      'La consulta debe empezar con SELECT o WITH. Solo se permite leer datos.'
    );
  }

  // Palabras de escritura.
  for (const p of PROHIBIDAS) {
    if (new RegExp(`\\b${p}\\b`, 'i').test(limpio)) {
      throw new SQLRechazado(
        `La palabra "${p.toUpperCase()}" no esta permitida: este agente solo puede leer.`
      );
    }
  }

  // Funciones peligrosas.
  for (const f of FUNCIONES_PROHIBIDAS) {
    if (new RegExp(`\\b${f}\\b`, 'i').test(limpio)) {
      throw new SQLRechazado(`La funcion "${f}" no esta permitida.`);
    }
  }

  // Otros schemas.
  for (const s of SCHEMAS_PROHIBIDOS) {
    if (new RegExp(`\\b${s}\\s*\\.`, 'i').test(limpio)) {
      throw new SQLRechazado(
        `No se puede consultar el schema "${s}". Usa solo las vistas de "analitica".`
      );
    }
  }

  // Tablas del sistema.
  if (/\bpg_[a-z_]+\b/i.test(limpio)) {
    throw new SQLRechazado(
      'No se pueden consultar los catalogos del sistema (pg_*). Usa las vistas de "analitica".'
    );
  }

  // El limite se impone envolviendo: no depende de adivinar donde va el LIMIT
  // del modelo ni de que haya escrito uno.
  const acotado = `SELECT * FROM (\n${sql}\n) AS resultado_agente LIMIT ${LIMITE_FILAS}`;

  return { sql: acotado, sqlOriginal: sql };
}

module.exports = { validar, SQLRechazado, LIMITE_FILAS, desnudar };
