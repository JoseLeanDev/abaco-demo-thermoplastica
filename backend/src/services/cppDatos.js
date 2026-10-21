// Snapshots completos de las vistas del ERP. Una fila ausente de una carga
// posterior que cubre su fecha deja de estar vigente; no rescatar su hash viejo.
const FUENTES = Object.freeze({
  compras_lineas: 'vstCompras', ventas_lineas: 'vstFacturas_Devoluciones',
});

function consultaSnapshot(tabla, filtro = '') {
  const fuente = FUENTES[tabla];
  if (!fuente) throw new Error('Fuente CPP no admitida.');
  return `WITH fechas AS MATERIALIZED (
    SELECT DISTINCT fec_emis FROM raw_thermoplastica.${tabla}
    WHERE fec_emis BETWEEN $1::date AND $2::date
  ), vigentes AS (
    SELECT f.fec_emis,b.batch_id FROM fechas f
    JOIN LATERAL (
      SELECT batch_id FROM raw_thermoplastica.batches
      WHERE source_view='${fuente}' AND status='ok' AND finished_at IS NOT NULL
        AND window_from <= f.fec_emis AND window_to >= f.fec_emis
      ORDER BY started_at DESC,finished_at DESC,batch_id DESC LIMIT 1
    ) b ON true
  )
  SELECT r.*,r.fec_emis::text AS fec_emis
  FROM raw_thermoplastica.${tabla} r JOIN vigentes v USING(fec_emis,batch_id)
  WHERE r.fec_emis BETWEEN $1::date AND $2::date ${filtro}`;
}

// Equivalente puro para auditorías offline y pruebas con cargas vacías/fallidas.
function seleccionarSnapshot(rows, batches, fuente) {
  const validos = batches.filter((b) => b.source_view === fuente && b.status === 'ok' && b.finished_at && b.window_from && b.window_to)
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)) || String(b.finished_at).localeCompare(String(a.finished_at)) || String(b.batch_id).localeCompare(String(a.batch_id)));
  const porFecha = new Map();
  return rows.filter((r) => {
    const f = String(r.fec_emis).slice(0, 10);
    if (!porFecha.has(f)) porFecha.set(f, validos.find((b) => String(b.window_from).slice(0, 10) <= f && String(b.window_to).slice(0, 10) >= f)?.batch_id);
    return r.batch_id === porFecha.get(f) && porFecha.get(f) !== undefined;
  });
}

async function leerLaminados(pool, { desde, hasta, corte, lineas = ['Laminados'] }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '20s'");
    const publicado = (await client.query(`SELECT i.*,p.corte::text AS corte_publicado FROM thermoplastica.cpp_laminados_publicacion p
        JOIN thermoplastica.cpp_laminados_importacion i ON i.id=p.importacion_id WHERE singleton`)).rows[0];
    if (lineas.length === 1 && lineas[0] === 'Laminados') {
      if (publicado) {
        const articulos=(await client.query('SELECT articulo_id,codigo_articulo FROM thermoplastica.dim_articulo')).rows;
        await client.query('ROLLBACK');
        return { ventas:publicado.ventas.filter((r)=>r.fec_emis>=desde && r.fec_emis<=hasta),compras:publicado.compras,articulos,
          metadata:[{importacion_id:publicado.id,desde_disponible:publicado.desde_ventas,ultima_carga:publicado.extraido_en,corte_publicado:publicado.corte_publicado}] };
      }
    }
    let ventas = (await client.query(consultaSnapshot('ventas_lineas', 'AND btrim(r.linea)=ANY($3::text[])'), [desde, hasta, lineas])).rows;
    const categorias = [...new Set(ventas.map((r) => String(r.categoria ?? '').trim()))];
    let compras = (await client.query(consultaSnapshot('compras_lineas', 'AND btrim(r.categoria)=ANY($3::text[])'), [`${Number(desde.slice(0, 4)) - 1}-01-01`, corte, categorias])).rows;
    if (publicado && lineas.includes('Laminados')) {
      ventas=[...ventas.filter((r)=>String(r.linea).trim()!=='Laminados'),...publicado.ventas.filter((r)=>r.fec_emis>=desde && r.fec_emis<=hasta)];
      const cc=new Set(publicado.ventas.map((r)=>String(r.categoria??'').trim()));
      const a=publicado.desde_compras.toISOString().slice(0,10),b=publicado.hasta.toISOString().slice(0,10);
      compras=[...compras.filter((r)=>!cc.has(String(r.categoria??'').trim()) || r.fec_emis<a || r.fec_emis>b),
        ...publicado.compras.filter((r)=>r.fec_emis<=corte && r.fec_emis>=`${Number(desde.slice(0,4))-1}-01-01`)];
    }
    const articulos = (await client.query('SELECT articulo_id,codigo_articulo FROM thermoplastica.dim_articulo')).rows;
    const metadata = (await client.query(`SELECT source_view,min(window_from)::text AS desde_disponible,max(finished_at)::text AS ultima_carga
      FROM raw_thermoplastica.batches WHERE status='ok' AND finished_at IS NOT NULL
        AND source_view=ANY($1::text[]) GROUP BY source_view`, [Object.values(FUENTES)])).rows;
    await client.query('ROLLBACK');
    return { ventas, compras, articulos, metadata };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

module.exports = { consultaSnapshot, seleccionarSnapshot, leerLaminados };
