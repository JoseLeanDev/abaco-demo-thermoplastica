const { crearCalculador, resumir, LINEAS, UNIDADES } = require('./cpp');
const { leerLaminados } = require('./cppDatos');
const { parsePeriodo } = require('./periodo');
const trim = (s) => String(s ?? '').trim();
const nombreCliente = (r) => {
  const n = trim(r.cliente), prefijo = `${trim(r.codigo_cliente)}-`;
  return n.startsWith(prefijo) ? n.slice(prefijo.length) : n;
};
const suma = (rows, campo) => rows.reduce((n, r) => n + Number(r[campo] || 0), 0);
const contar = (rows, campo) => new Set(rows.map((r) => r[campo]).filter((v) => v !== null && v !== undefined && v !== '')).size;
const { claveAlcance } = require('./alcance');
const cache = new Map();

function ultimoMesCerrado(now = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit' })
    .formatToParts(now).map((p) => [p.type, p.value]));
  return new Date(Date.UTC(Number(partes.year), Number(partes.month) - 1, 0)).toISOString().slice(0, 10);
}

function metricas(rows) {
  const s = resumir(rows);
  const unidades = suma(rows, 'cantidad');
  const unidadesConCosto = suma(rows.filter((r) => r.cpp !== null), 'cantidad');
  return { ...s, unidades, unidades_con_cpp: unidadesConCosto,
    precio_promedio: unidades > 0 && s.ventas_totales !== null ? s.ventas_totales / unidades : null,
    costo_unitario: unidadesConCosto > 0 && s.costo_mp !== null ? s.costo_mp / unidadesConCosto : null,
    pct_sin_costo: s.ventas_totales > 0 ? s.ventas_sin_cpp / s.ventas_totales * 100 : null,
    facturas: new Set(rows.map((r) => `${r.co_sucu}|${r.fact_num}|${r.tipo_doc}`)).size,
    clientes: contar(rows, 'codigo_cliente'), skus: contar(rows, 'codigo_articulo'),
  };
}

const DIMENSIONES = {
  categoria: (r) => trim(r.linea), subcategoria: (r) => trim(r.categoria) || 'Sin subcategoría',
  sublinea: (r) => trim(r.sublinea) || 'Sin sublínea', articulo: (r) => trim(r.codigo_articulo),
  cliente: (r) => trim(r.codigo_cliente), vendedor: (r) => trim(r.nombre_vendedor) || 'Sin vendedor',
  sucursal: (r) => trim(r.sucursal) || 'Sin sucursal', tipo_cliente: (r) => trim(r.tipo_cliente_desc || r.tipo_cliente).replace(/^\d+\s*-\s*/, '') || 'Sin tipo',
};
function filtrar(rows, query) {
  return rows.filter((r) => Object.entries(DIMENSIONES).every(([k, fn]) => !query[k] || String(query[k]) === fn(r)));
}
function agrupar(rows, dim) {
  const groups = new Map();
  for (const r of rows) {
    const key = DIMENSIONES[dim](r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return groups;
}

function construirReporte(datos, P, { corte, query = {} }) {
  const linea = LINEAS.includes(query.categoria) ? query.categoria : 'Laminados';
  const c = crearCalculador(datos.compras, { corte });
  const ids = new Map((datos.articulos || []).map((r) => [trim(r.codigo_articulo), Number(r.articulo_id)]));
  const inicio = P.desde < P.prevDesde ? P.desde : P.prevDesde;
  const fin = P.hasta > P.prevHasta ? P.hasta : P.prevHasta;
  const filas = datos.ventas.filter((r) => trim(r.linea) === linea && r.fec_emis.slice(0, 10) >= inicio && r.fec_emis.slice(0, 10) <= fin).map((r) => c.calcularVenta({ ...r, codigo_articulo: trim(r.codigo_articulo), codigo_cliente: trim(r.codigo_cliente) }))
    .filter((r) => !r.excluida);
  const filtradas = filtrar(filas, query);
  const entre = (a, b) => filtradas.filter((r) => r.fec_emis.slice(0, 10) >= a && r.fec_emis.slice(0, 10) <= b);
  const actual = entre(P.desde, P.hasta), anterior = entre(P.prevDesde, P.prevHasta);
  const a = metricas(actual), h = metricas(anterior);
  const items = (dim) => {
    const aa = agrupar(actual, dim), hh = agrupar(anterior, dim);
    return [...new Set([...aa.keys(), ...hh.keys()])].map((clave) => {
      const rr = aa.get(clave) || [], pp = hh.get(clave) || [], r = rr[0] || pp[0];
      const x = metricas(rr), y = metricas(pp);
      return { clave, nombre: dim === 'articulo' ? trim(r.articulo) : dim === 'cliente' ? nombreCliente(r) : clave,
        es_cpp: true, corte_cpp: corte,
        extra: dim === 'vendedor' ? trim(r.codigo_vendedor) : dim === 'articulo' ? linea : null,
        ventas: x.ventas_totales, ventas_prev: y.ventas_totales, variacion: x.ventas_totales - y.ventas_totales,
        variacion_pct: y.ventas_totales > 0 ? (x.ventas_totales / y.ventas_totales - 1) * 100 : null,
        unidades: x.unidades, unidades_prev: y.unidades, facturas: x.facturas, clientes: x.clientes, clientes_prev: y.clientes, skus: x.skus,
        precio_promedio: x.precio_promedio, precio_promedio_prev: y.precio_promedio,
        costo: x.costo_mp, costo_unitario: x.costo_unitario,
        margen: x.margen_mp, margen_pct: x.margen_mp_pct, margen_pct_prev: y.margen_mp_pct,
        pct_sin_costo: x.pct_sin_costo, ventas_con_cpp: x.ventas_con_cpp, ventas_sin_cpp: x.ventas_sin_cpp,
        participacion: a.ventas_totales > 0 ? x.ventas_totales / a.ventas_totales * 100 : 0,
        ultima_venta: rr.length ? rr.map((r) => r.fec_emis.slice(0, 10)).sort().at(-1) : null,
        nuevo: x.ventas_totales > 0 && y.ventas_totales === 0, perdido: x.ventas_totales === 0 && y.ventas_totales > 0,
      };
    }).sort((a, b) => b.ventas - a.ventas || b.ventas_prev - a.ventas_prev);
  };
  const productos = items('articulo').filter((r) => r.ventas >= 1000 && r.unidades > 0).map((r) => {
    const raw = actual.find((v) => v.codigo_articulo === r.clave);
    const delta = r.margen_pct !== null && r.margen_pct_prev !== null ? r.margen_pct - r.margen_pct_prev : null;
    return { id: ids.get(r.clave), sku: r.clave, nombre: r.nombre, categoria: linea, unidad: UNIDADES[linea].unidad, es_cpp: true, corte_cpp: corte,
      subcategoria: trim(raw.categoria), sublinea: trim(raw.sublinea), ventas: r.ventas, margen_q: r.margen,
      precio_actual: r.precio_promedio, costo_actual: r.costo_unitario,
      margen_pct_actual: r.margen_pct, margen_pct_historico: r.margen_pct_prev, delta_puntos: delta,
      semaforo: delta === null ? null : delta >= -1 ? 'verde' : delta >= -5 ? 'ambar' : 'rojo',
      unidades_12m: r.unidades,
      precio_sugerido: r.costo_unitario !== null && r.margen_pct_prev !== null && r.margen_pct_prev < 90 && r.margen_pct_prev > r.margen_pct
        ? Math.min(r.costo_unitario / (1 - r.margen_pct_prev / 100), r.precio_promedio * 1.3) : r.precio_promedio,
    };
  });
  const meta = { metodologia: linea === 'Laminados' ? 'CPP_LAMINADOS_JONATHAN_2026_10_21' : 'CPP_COMPRAS_PROPIAS_2026_10_22', corte_cpp: corte, unidad: UNIDADES[linea].unidad,
    periodo_solicitado: P.ventana(), hasta_efectivo: P.hasta,
    fuente: 'snapshots_completos_erp', cargas: datos.metadata || [], incidencias_compras: c.incidencias,
    alcance: linea === 'Laminados' ? 'Solo linea original Laminados; Almacen General y Flexografia se concilian por separado.' : `${linea}: compras del mismo artículo; incluye sus compras anteriores disponibles.` };
  return { P, meta, actual, anterior, filas: filtradas, ids, items, metricas: a, metricas_previas: h,
    data: { metodologia: meta, resumen: { total_margen_bruto_q: a.margen_mp,
      margen_global_pct: a.margen_mp_pct, margen_global_pct_prev: h.margen_mp_pct,
      total_ventas_q: a.ventas_totales, ventas_con_cpp: a.ventas_con_cpp, ventas_sin_cpp: a.ventas_sin_cpp,
      costo_mp: a.costo_mp, pct_ventas_sin_costo: a.pct_sin_costo,
      productos_rojo: productos.filter((r) => r.semaforo === 'rojo').length,
      productos_ambar: productos.filter((r) => r.semaforo === 'ambar').length,
      productos_verde: productos.filter((r) => r.semaforo === 'verde').length, total_productos: productos.length }, productos },
  };
}

async function obtenerReporte(req, pool, { now = new Date(), cargar = leerLaminados } = {}) {
  const P = parsePeriodo(req), corte = req.query.corte_cpp || ultimoMesCerrado(now);
  // Valida también el cierre de mes; evita cortes futuros o meses abiertos.
  try { crearCalculador([], { corte }); }
  catch (e) { e.statusCode = 400; throw e; }
  if (corte > ultimoMesCerrado(now)) throw Object.assign(new Error('El CPP solo admite compras de meses cerrados.'), { statusCode: 400 });
  const desde = P.desde < P.prevDesde ? P.desde : P.prevDesde;
  const hasta = P.hasta > P.prevHasta ? P.hasta : P.prevHasta;
  const linea = LINEAS.includes(req.query.categoria) ? req.query.categoria : 'Laminados';
  const tabla = linea === 'Laminados' ? 'cpp_laminados_publicacion' : 'cpp_articulos_publicacion';
  const publicacion = cargar === leerLaminados ? (await pool.query(`SELECT importacion_id FROM thermoplastica.${tabla} WHERE singleton`)).rows[0]?.importacion_id : null;
  const key = JSON.stringify([linea, desde, hasta, corte, publicacion]) + claveAlcance();
  let cached = cache.get(key);
  if (cargar !== leerLaminados || !cached || cached.hasta < Date.now()) {
    const promise = cargar(pool, { desde, hasta, corte, ...(linea === 'Laminados' ? {} : {lineas:[linea]}) });
    cached = { hasta: Date.now() + 60000, promise };
    if (cargar === leerLaminados) {
      if (cache.size >= 24) cache.delete(cache.keys().next().value);
      cache.set(key, cached);
      promise.catch(() => cache.delete(key));
    }
  }
  return construirReporte(await cached.promise, P, { corte, query: req.query });
}

module.exports = { construirReporte, obtenerReporte, metricas, ultimoMesCerrado, DIMENSIONES };
