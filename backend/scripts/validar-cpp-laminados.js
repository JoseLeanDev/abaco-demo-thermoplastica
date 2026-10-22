#!/usr/bin/env node
// Verificación de solo lectura: publicado SQL vs CPP, dimensiones y otras líneas.
require('dotenv').config();
const assert=require('node:assert/strict');
const {pool}=require('../database/connection');
const M=require('../src/services/margen');
const {obtenerReporte,ultimoMesCerrado}=require('../src/services/laminados');
const close=(a,b)=>assert.ok(Math.abs(Number(a)-Number(b))<0.000001,`${a} != ${b}`);
(async()=>{
 try {
  const corte=ultimoMesCerrado(),desde=corte.slice(0,4)+'-01-01';
  const r=await obtenerReporte({query:{desde,hasta:corte,categoria:'Laminados'}},pool);
  const s=(await pool.query(`SELECT SUM(total_sin_iva) AS ventas,${M.margen()} AS margen,
    ${M.costo()} AS costo,${M.pct()} AS pct FROM thermoplastica.v_ventas_costeadas
    WHERE es_cpp AND tipo_doc='FACT' AND fecha_emision BETWEEN $1 AND $2
    AND EXISTS(SELECT 1 FROM thermoplastica.cpp_laminados_venta l WHERE
      (l.fact_num,l.tipo_doc,l.sucursal_id,l.articulo_id)=(v_ventas_costeadas.fact_num,v_ventas_costeadas.tipo_doc,v_ventas_costeadas.sucursal_id,v_ventas_costeadas.articulo_id))`,[desde,corte])).rows[0];
  close(s.ventas,r.metricas.ventas_totales);close(s.margen,r.metricas.margen_mp);
  close(s.costo,r.metricas.costo_mp);close(s.pct,r.metricas.margen_mp_pct);
  for(const dim of ['cliente','vendedor','articulo','subcategoria']) close(r.items(dim).reduce((n,v)=>n+(v.margen||0),0),s.margen);
  const otros=(await pool.query(`SELECT count(*) AS n FROM (
    (SELECT to_jsonb(f) AS fila FROM thermoplastica.fact_ventas_linea f WHERE NOT EXISTS (
      SELECT 1 FROM thermoplastica.cpp_laminados_clave k WHERE
      (k.fact_num,k.tipo_doc,k.sucursal_id,k.articulo_id)=(f.fact_num,f.tipo_doc,f.sucursal_id,f.articulo_id))
      AND NOT EXISTS(SELECT 1 FROM thermoplastica.cpp_articulos_clave k WHERE
      (k.fact_num,k.tipo_doc,k.sucursal_id,k.articulo_id)=(f.fact_num,f.tipo_doc,f.sucursal_id,f.articulo_id)))
    EXCEPT (SELECT to_jsonb(v)-'es_cpp'-'ventas_base_margen' FROM thermoplastica.v_ventas_costeadas v WHERE NOT es_cpp)
  ) x`)).rows[0];
  assert.equal(Number(otros.n),0);
  console.log(JSON.stringify({ok:true,desde,corte,laminados:s,otras_lineas_diferencias:0},null,2));
 } finally {await pool.end();}
})().catch((e)=>{console.error(e.message);process.exitCode=1;});
