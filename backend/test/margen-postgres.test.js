// Ejecutar con DATABASE_URL: solo VALUES en una transacción READ ONLY.
require('dotenv').config({quiet:true});
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const M=require('../src/services/margen');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},max:1});
after(()=>pool.end());
const close=(a,b)=>assert.ok(Math.abs(Number(a)-b)<1e-8,`${a} != ${b}`);
async function calc(rows,cond) {
 const db=await pool.connect();
 try {
  await db.query('BEGIN READ ONLY');
  const r=await db.query(`SELECT ${M.margen('f',cond)} AS margen,${M.costo('f',cond)} AS costo,
   ${M.pct('f',cond)} AS pct,${M.base('f',cond)} AS base,${M.pctSinCosto('f',cond)} AS sin_costo
   FROM jsonb_to_recordset($1::jsonb) AS f(es_cpp boolean,total_sin_iva numeric,
    costo_total_facturado numeric,margen_bruto numeric,ventas_base_margen numeric,grupo text)`,[JSON.stringify(rows)]);
  return r.rows[0];
 } finally {await db.query('ROLLBACK');db.release();}
}
const row=(cpp,venta,costo,base,grupo='actual')=>({es_cpp:cpp,total_sin_iva:venta,costo_total_facturado:costo,
 margen_bruto:costo===null?null:(cpp?base:venta)-costo,ventas_base_margen:base,grupo});
test('total mixto suma CPP conocido y extrapolación ERP sin prestar margen a Laminados',async()=>{
 const r=await calc([row(true,300,200,300),row(true,700,null,0),row(false,1000,600,1000),row(false,1000,0,0)]);
 close(r.margen,900);close(r.costo,1400);close(r.base,2300);close(r.pct,900/2300*100);close(r.sin_costo,1700/3000*100);
});
test('otras líneas conservan exactamente la fórmula anterior',async()=>{
 const r=await calc([row(false,1000,600,1000),row(false,1000,0,0)]);
 close(r.margen,800);close(r.costo,1200);close(r.pct,40);
});
test('Laminados sin CPP conserva N/D y no tiene margen estimado',async()=>{
 const r=await calc([row(true,700,null,0)]);assert.equal(r.margen,null);assert.equal(r.costo,null);assert.equal(r.pct,null);close(r.sin_costo,100);
});
test('devoluciones con costo negativo contribuyen y respetan el filtro del período',async()=>{
 const r=await calc([row(true,300,200,300),row(true,-60,-40,-60),row(true,1000,1,1000,'anterior')],"f.grupo='actual'");
 close(r.margen,80);close(r.costo,160);close(r.base,240);close(r.pct,100/3);
});
test('un grupo mixto sin costo ERP no inventa margen para esas ventas',async()=>{
 const r=await calc([row(true,300,200,300),row(false,1000,0,0)]);close(r.margen,100);close(r.base,300);close(r.pct,100/3);
});
