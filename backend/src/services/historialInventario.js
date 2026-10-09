// Historial diario del inventario.
//
// La ingesta reemplaza thermoplastica.fact_inventario_snapshot todos los días con
// el stock del momento: no queda historia. Para medir la rotación con el
// inventario PROMEDIO de un período se guarda aquí una foto por día
// (analitica.hist_inventario). La primera foto es del 2026-10-09; los períodos
// anteriores usan el inventario de hoy como aproximación.
//
// capturar() es idempotente: reescribe la foto del día del último snapshot.

async function asegurarTabla(db) {
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS analitica.hist_inventario (
      fecha        date          NOT NULL,
      articulo_id  integer       NOT NULL,
      stock        numeric       NOT NULL,
      valor        numeric(18,2) NOT NULL,
      capturado_en timestamptz   NOT NULL DEFAULT now(),
      PRIMARY KEY (fecha, articulo_id)
    )`, []);
}

async function capturar(db) {
  await asegurarTabla(db);
  const ult = `(SELECT max(fecha_snapshot) FROM thermoplastica.fact_inventario_snapshot)`;
  await db.runAsync(`
    INSERT INTO analitica.hist_inventario (fecha, articulo_id, stock, valor)
    SELECT fecha_snapshot::date, articulo_id, stock_actual, coalesce(valor_inventario, 0)
    FROM thermoplastica.fact_inventario_snapshot
    WHERE stock_actual > 0 AND fecha_snapshot = ${ult}
    ON CONFLICT (fecha, articulo_id) DO UPDATE
      SET stock = EXCLUDED.stock, valor = EXCLUDED.valor, capturado_en = now()`, []);
  // Artículos que se quedaron sin stock después de una captura anterior del mismo día
  await db.runAsync(`
    DELETE FROM analitica.hist_inventario h
    WHERE h.fecha = ${ult}::date
      AND NOT EXISTS (
        SELECT 1 FROM thermoplastica.fact_inventario_snapshot s
        WHERE s.fecha_snapshot = ${ult} AND s.articulo_id = h.articulo_id AND s.stock_actual > 0)`, []);
  const r = await db.getAsync(`SELECT ${ult}::date AS fecha, count(*) AS n FROM analitica.hist_inventario WHERE fecha = ${ult}::date`, []);
  return r;
}

// Cada 4 horas (la ingesta corre una vez al día; capturar de más no duplica)
function programar(db) {
  const cron = require('node-cron');
  cron.schedule('20 */4 * * *', async () => {
    try {
      const r = await capturar(db);
      console.log(`[hist_inventario] foto ${r?.fecha?.toISOString?.().slice(0, 10) || r?.fecha}: ${r?.n} artículos`);
    } catch (e) {
      console.error('[hist_inventario] error:', e.message);
    }
  }, { timezone: process.env.TZ || 'America/Guatemala' });
}

module.exports = { asegurarTabla, capturar, programar };
