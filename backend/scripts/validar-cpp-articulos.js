#!/usr/bin/env node
// Solo lectura: fuente publicada, cálculo por SKU y vistas consumidas por la app.
require('dotenv').config({quiet:true});
const assert=require('node:assert/strict');
const {pool}=require('../database/connection');
const {crearCalculador,LINEAS,resumir}=require('../src/services/cpp');
const {obtenerReporte}=require('../src/services/laminados');
const M=require('../src/services/margen');
const close=(a,b)=>{if(a===null||b===null)assert.equal(a,b);else assert.ok(Math.abs(Number(a)-Number(b))<1e-6,`${a} != ${b}`);};
(async()=>{try{
 const p=(await pool.query(`SELECT i.*,p.corte::text AS corte FROM thermoplastica.cpp_articulos_publicacion p
   JOIN thermoplastica.cpp_articulos_importacion i ON i.id=p.importacion_id WHERE singleton`)).rows[0];
 assert.ok(p,'Falta publicación de artículos');
 const desde=p.corte.slice(0,4)+'-01-01',calc=crearCalculador(p.compras,{corte:p.corte}),resultados={};
 for(const linea of LINEAS.slice(1)){
  const raw=resumir(p.ventas.filter(v=>v.linea.trim()===linea&&v.fec_emis>=desde&&v.fec_emis<=p.corte).map(v=>calc.calcularVenta(v)));
  const r=await obtenerReporte({query:{desde,hasta:p.corte,categoria:linea}},pool);
  const s=(await pool.query(`SELECT SUM(f.total_sin_iva) AS ventas,${M.margen('f')} AS margen,
   ${M.costo('f')} AS costo,${M.pct('f')} AS pct,${M.base('f')} AS base
   FROM thermoplastica.v_ventas_costeadas f JOIN thermoplastica.cpp_articulos_venta a
   USING(fact_num,tipo_doc,sucursal_id,articulo_id)
   WHERE a.linea_cpp=$1 AND f.tipo_doc='FACT' AND f.fecha_emision BETWEEN $2 AND $3`,[linea,desde,p.corte])).rows[0];
  close(s.ventas,raw.ventas_totales);close(s.margen,raw.margen_mp);close(s.costo,raw.costo_mp);close(s.pct,raw.margen_mp_pct);
  close(r.metricas.margen_mp,raw.margen_mp);close(r.metricas.ventas_totales,raw.ventas_totales);
  for(const dim of ['articulo','cliente','vendedor','subcategoria'])close(r.items(dim).reduce((n,i)=>n+(i.margen||0),0),raw.margen_mp);
  // El catálogo permite los mismos filtros en las rutas generales y en la IA.
  const agrupado=(await pool.query(`SELECT SUM(f.total_sin_iva) AS ventas,${M.margen('f')} AS margen
   FROM thermoplastica.v_ventas_costeadas f JOIN thermoplastica.dim_articulo a USING(articulo_id)
   WHERE btrim(a.marca)=$1 AND f.tipo_doc='FACT' AND f.fecha_emision BETWEEN $2 AND $3`,[linea,desde,p.corte])).rows[0];
  close(agrupado.ventas,raw.ventas_totales);close(agrupado.margen,raw.margen_mp);
  resultados[linea]={...s,unidad:r.meta.unidad,ventas_sin_cpp:raw.ventas_sin_cpp,cobertura:raw.cobertura_ventas_pct};
 }
 const duplicadas=(await pool.query(`SELECT count(*) AS n FROM (SELECT fact_num,tipo_doc,sucursal_id,articulo_id
  FROM thermoplastica.v_ventas_costeadas GROUP BY 1,2,3,4 HAVING count(*)>1) x`)).rows[0];
 assert.equal(Number(duplicadas.n),0,'Ventas duplicadas en la fuente canónica');
 console.log(JSON.stringify({ok:true,corte:p.corte,lineas:resultados,claves_duplicadas:0},null,2));
}finally{await pool.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
