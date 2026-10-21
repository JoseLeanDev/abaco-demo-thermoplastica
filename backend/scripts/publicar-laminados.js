#!/usr/bin/env node
require('dotenv').config();
const {pool}=require('../database/connection');
require('../src/services/laminadosPublicacion').publicar(pool,{forzar:process.argv.includes('--forzar')})
 .then((r)=>console.log(JSON.stringify(r,null,2)))
 .catch((e)=>{console.error('No se publicó:',e.message);process.exitCode=1;})
 .finally(()=>pool.end());
