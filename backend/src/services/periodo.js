// Ventana de fechas común a todos los módulos.
//
// Todas las rutas leen ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD. Sin parámetros, la
// ventana es el AÑO EN CURSO (1 de enero → hoy), igual que el default del filtro
// global del frontend.
//
// El período de comparación es el mismo rango un año antes (YoY). Si la ventana
// dura más de un año, se usa el período inmediatamente anterior de igual largo
// para que no se traslapen.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 24 * 60 * 60 * 1000;

const iso = (d) => d.toISOString().slice(0, 10);
const parseISO = (s) => (s && ISO.test(s) && !isNaN(new Date(`${s}T00:00:00Z`)) ? new Date(`${s}T00:00:00Z`) : null);

function hoyUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

function restarAnio(d) {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() - 1);
  return r;
}

function parsePeriodo(req) {
  const hoy = hoyUTC();
  let hasta = parseISO(req.query.hasta) || hoy;
  let desde = parseISO(req.query.desde) || new Date(Date.UTC(hasta.getUTCFullYear(), 0, 1));
  if (desde > hasta) [desde, hasta] = [hasta, desde];

  const dias = Math.round((hasta - desde) / DIA_MS) + 1;

  let prevDesde, prevHasta;
  if (dias <= 366) {
    prevDesde = restarAnio(desde);
    prevHasta = restarAnio(hasta);
  } else {
    prevHasta = new Date(desde.getTime() - DIA_MS);
    prevDesde = new Date(prevHasta.getTime() - (dias - 1) * DIA_MS);
  }

  // Literales SQL listos para interpolar: vienen de Date.toISOString(), así que
  // solo pueden contener dígitos y guiones (no hay riesgo de inyección).
  const lit = (d) => `'${iso(d)}'::date`;

  return {
    D: lit(desde),
    H: lit(hasta),
    prevD: lit(prevDesde),
    prevH: lit(prevHasta),
    desde: iso(desde),
    hasta: iso(hasta),
    prevDesde: iso(prevDesde),
    prevHasta: iso(prevHasta),
    dias,
    ventana() {
      return { desde: this.desde, hasta: this.hasta, prev_desde: this.prevDesde, prev_hasta: this.prevHasta, dias: this.dias };
    },
  };
}

module.exports = { parsePeriodo };
