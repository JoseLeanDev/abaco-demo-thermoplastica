// Publica en una transacción la fuente y los costos calculados con el mismo CPP
// que usan las pantallas filtradas. Advisory lock compartido por instancias.
const { crearCalculador, LINEAS } = require('./cpp');
const { ultimoMesCerrado } = require('./laminados');
const trim = (v) => String(v ?? '').trim();
const key = (r) => JSON.stringify([trim(r.fact_num),trim(r.tipo_doc),trim(r.co_sucu),trim(r.codigo_articulo)]);
async function publicar(pool, {forzar=false} = {}) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const lock = await db.query('SELECT pg_try_advisory_xact_lock(87321022) AS ok');
    if (!lock.rows[0].ok) { await db.query('ROLLBACK'); return { omitida: 'publicacion_en_curso' }; }
    const corte = ultimoMesCerrado();
    const source = (await db.query(`SELECT i.* FROM thermoplastica.cpp_articulos_importacion i
      WHERE ($2::boolean OR NOT EXISTS(SELECT 1 FROM thermoplastica.cpp_articulos_publicacion p WHERE p.importacion_id=i.id AND p.corte=$1))
      AND i.id=(SELECT max(id) FROM thermoplastica.cpp_articulos_importacion)`, [corte,forzar])).rows[0];
    if (!source) { await db.query('ROLLBACK'); return { sin_cambios: true }; }
    const calc = crearCalculador(source.compras, { corte });
    const incompletas=calc.incidencias.filter((i)=>i.motivo!=='flete_anio_pendiente');
    if (incompletas.length) throw new Error(`Compras incompletas: ${incompletas.length}; se conserva la publicación anterior.`);
    // Solo altas necesarias para filas históricas recuperadas. No actualizar
    // atributos de artículos/clientes existentes ni tocar otros hechos.
    const add = async (tabla, codigo, nombre, rows, c, n) => {
      const mm = new Map(rows.map((r) => [trim(r[c]), trim(r[n]) || trim(r[c])]));
      mm.delete('');
      await db.query(`INSERT INTO thermoplastica.${tabla}(${codigo},${nombre}) SELECT codigo,nombre FROM jsonb_to_recordset($1::jsonb) AS x(codigo text,nombre text) ON CONFLICT(${codigo}) DO NOTHING`, [JSON.stringify([...mm].map(([codigo,nombre])=>({codigo,nombre})))]);
    };
    await add('dim_sucursal','codigo_sucursal','nombre',source.ventas,'co_sucu','sucursal');
    await add('dim_articulo','codigo_articulo','descripcion',source.ventas,'codigo_articulo','articulo');
    await add('dim_cliente','codigo_cliente','nombre',source.ventas,'codigo_cliente','cliente');
    const vendedores = [...new Set(source.ventas.map(r=>trim(r.nombre_vendedor)).filter(Boolean))];
    await db.query('INSERT INTO thermoplastica.dim_vendedor(nombre) SELECT nombre FROM jsonb_array_elements_text($1::jsonb) AS x(nombre) WHERE NOT EXISTS(SELECT 1 FROM thermoplastica.dim_vendedor d WHERE d.nombre=x.nombre)',[JSON.stringify(vendedores)]);
    const dim = async (t,c,id) => new Map((await db.query(`SELECT ${c} AS codigo,${id} AS id FROM thermoplastica.${t}`)).rows.map((r)=>[trim(r.codigo),r.id]));
    const suc = await dim('dim_sucursal','codigo_sucursal','sucursal_id');
    const art = await dim('dim_articulo','codigo_articulo','articulo_id');
    const cli = await dim('dim_cliente','codigo_cliente','cliente_id');
    const ven = await dim('dim_vendedor','nombre','vendedor_id');
    const groups = new Map();
    for (const r of source.ventas) {
      if (!LINEAS.slice(1).includes(trim(r.linea))) throw new Error('Importación contiene una línea fuera de productos terminados.');
      const k=key(r); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(r);
    }
    // Historial de claves, incluidas facturas ausentes del ERP actual. Nunca
    // reaparecen por un upsert del ETL incremental viejo.
    await db.query(`INSERT INTO thermoplastica.cpp_articulos_clave
      SELECT DISTINCT r.fact_num,btrim(r.tipo_doc),s.sucursal_id,a.articulo_id
      FROM raw_thermoplastica.ventas_lineas r
      JOIN thermoplastica.dim_sucursal s ON s.codigo_sucursal=btrim(r.co_sucu)
      JOIN thermoplastica.dim_articulo a ON a.codigo_articulo=btrim(r.codigo_articulo)
      WHERE btrim(r.linea) IN ('Empaques para alimentos','Tapas y Valvulas','Inyectables','tpFood') AND r.fec_emis >= $1 AND r.fec_emis <= $2
      ON CONFLICT DO NOTHING`, [source.desde_ventas,source.hasta]);
    await db.query('DELETE FROM thermoplastica.cpp_articulos_venta');
    const original = new Map((await db.query(`SELECT f.*,s.codigo_sucursal,a.codigo_articulo FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_sucursal s USING(sucursal_id) JOIN thermoplastica.dim_articulo a USING(articulo_id)`)).rows
      .map((r)=>[key({...r,co_sucu:r.codigo_sucursal}),r]));
    const rows=[], claves=[];
    for (const rr of groups.values()) {
      const r=rr[0], sid=suc.get(trim(r.co_sucu)), aid=art.get(trim(r.codigo_articulo)), cid=cli.get(trim(r.codigo_cliente));
      if(!sid || !aid || !cid) throw new Error('Falta dimensión para venta comercial.');
      if (new Set(rr.map((v)=>trim(v.codigo_cliente))).size>1) throw new Error('Clave ERP con varios clientes.');
      claves.push({fact_num:r.fact_num,tipo_doc:trim(r.tipo_doc),sucursal_id:sid,articulo_id:aid});
      if (new Set(rr.map(v=>trim(v.linea))).size>1) throw new Error('Clave ERP con varias líneas comerciales.');
      const cv=rr.map((v)=>calc.calcularVenta(v)).filter((v)=>!v.excluida);
      if (!cv.length) continue;
      if (cv.some((v)=>v.venta===null || v.cantidad===null)) throw new Error('Venta incompleta; se conserva la publicación anterior.');
      const sum=(k)=>rr.reduce((s,v)=>s+Number(v[k]||0),0);
      const eligible=cv.filter((v)=>v.costo_mp!==null);
      const base=eligible.reduce((s,v)=>s+v.venta,0);
      const cost=eligible.length ? eligible.reduce((s,v)=>s+v.costo_mp,0) : null;
      const margin=cost===null?null:base-cost;
      const old=original.get(key(r));
      rows.push({linea_cpp:trim(r.linea),venta_id:old?.venta_id || -1000000-rows.length,fact_num:r.fact_num,tipo_doc:trim(r.tipo_doc),sucursal_id:sid,cliente_id:cid,
        vendedor_id:ven.get(trim(cv[0].nombre_vendedor))||null,articulo_id:aid,fecha_emision:r.fec_emis,fel:r.fel,
        ...Object.fromEntries(['unidades','unidades_dev','total_sin_iva','total_sin_iva_dev','total_con_iva','total_con_iva_dev','iva','iva_dev'].map((k)=>[k,sum(k)])),
        saldo:Math.max(...rr.map((v)=>Number(v.saldo||0))),costo_promedio_facturado:rr.reduce((s,v)=>s+Number(v.costo_promedio_facturado||0),0)/rr.length,
        costo_ultimo_facturado:Math.max(...rr.map((v)=>Number(v.costo_ultimo_facturado||0))),
        costo_total_facturado:cost,margen_bruto:margin,margen_bruto_pct:base>0&&margin!==null?margin/base*100:null,
        tipo_cliente:r.tipo_cliente_desc,es_outlier_fecha:false,batch_id:old?.batch_id||null,created_at:old?.created_at||new Date(),
        ventas_base_margen:base,fuente_cpp:cv.map((v)=>({cpp:v.cpp,fuente:v.fuente_cpp,detalle:v.fuente}))});
    }
    if (!rows.length) throw new Error('Publicación vacía; se conserva la anterior.');
    await db.query('INSERT INTO thermoplastica.cpp_articulos_clave SELECT * FROM jsonb_populate_recordset(NULL::thermoplastica.cpp_articulos_clave,$1::jsonb) ON CONFLICT DO NOTHING',[JSON.stringify(claves)]);
    const conflicto=await db.query(`SELECT count(*) AS n FROM thermoplastica.cpp_articulos_clave k JOIN thermoplastica.cpp_laminados_venta l USING(fact_num,tipo_doc,sucursal_id,articulo_id)`);
    if(Number(conflicto.rows[0].n)>0) throw new Error('Claves comerciales coinciden con ventas publicadas de Laminados.');
    const cols=Object.keys(rows[0]);
    for(let i=0;i<rows.length;i+=250) {
      await db.query(`INSERT INTO thermoplastica.cpp_articulos_venta(${cols.join(',')}) SELECT ${cols.join(',')} FROM jsonb_populate_recordset(NULL::thermoplastica.cpp_articulos_venta,$1::jsonb)`,[JSON.stringify(rows.slice(i,i+250))]);
    }
    await db.query(`INSERT INTO thermoplastica.cpp_articulos_publicacion(singleton,importacion_id,corte) VALUES(true,$1,$2)
      ON CONFLICT(singleton) DO UPDATE SET importacion_id=EXCLUDED.importacion_id,corte=EXCLUDED.corte,publicado_en=now()`,[source.id,corte]);
    await db.query('UPDATE thermoplastica.cpp_articulos_importacion SET publicado_en=now() WHERE id=$1',[source.id]);
    await db.query('COMMIT');
    return { importacion_id:source.id,corte,filas:rows.length,compras:source.compras.length,desde_ventas:source.desde_ventas };
  } catch(e) { await db.query('ROLLBACK'); throw e; } finally {db.release();}
}
function iniciarPublicacion(pool) {
  const run=()=>publicar(pool).then((r)=>{if(!r.sin_cambios) console.log('[CPP artículos]',JSON.stringify(r));}).catch((e)=>console.error('[CPP artículos] publicación conservada:',e.message));
  run(); const timer=setInterval(run,5*60*1000);timer.unref();return timer;
}
module.exports={publicar,iniciarPublicacion};
