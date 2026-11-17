const { permisosDeUsuario, modulosDeEndpoint } = require('../config/permisos');
const { als, alcanceDeUsuario, limpiar, patronPara } = require('../services/alcance');

// Va después de `authenticate`: deja pasar solo si los roles del usuario tienen
// alguno de los módulos que usan este endpoint (ver ENDPOINTS en config/permisos).
// Un endpoint sin mapear queda solo para admin, para que lo nuevo no se abra por omisión.
// Luego corre la petición con el alcance del usuario (services/alcance.js): las
// consultas salen recortadas y los montos que su rol no ve se quitan de la respuesta.
// Sin nested loops (ver database/connection.js). Con recorte basta cualquier filtro
// de producto; sin recorte (Dirección, Finanzas, admin) el problema aparece desde
// el segundo nivel (categoría + subcategoría): Márgenes › Por Categoría al bajar a
// sublínea pasaba de 90 s y la pantalla se quedaba en "Cargando…". Con solo la
// categoría los nested loops sí ayudan y se dejan.
//
// Las lecturas (GET) corren además con un tope por sentencia (ver connection.js):
// un poco más que los 30 s del navegador, para no cortar algo que aún iba a llegar.
// Las escrituras y procesos (POST: agentes, cierre, scheduler) no llevan tope.
const LIMITE_GET_MS = 35000;
const filtroProfundo = (q = {}) => Boolean(q.subcategoria || q.sublinea);
const conFiltroProducto = (q = {}) => ['categoria', 'subcategoria', 'sublinea'].some(k => q[k]);

function correr(req, next, alcance) {
  const store = { ...(alcance || {}) };
  if (alcance ? conFiltroProducto(req.query) : filtroProfundo(req.query)) store.sinNestloop = true;
  if (req.method === 'GET') store.limiteMs = LIMITE_GET_MS;
  return Object.keys(store).length ? als.run(store, next) : next();
}

const autorizar = (req, res, next) => {
  if (req.user?.rol === 'admin') return correr(req, next, null);

  const permisos = permisosDeUsuario(req.user);
  const path = `${req.baseUrl}${req.path}`.replace(/^\/api/, '').replace(/\/$/, '');
  const regla = modulosDeEndpoint(path);
  const niveles = (regla?.modulos || []).map(m => permisos[m]?.nivel).filter(Boolean);

  const ok = regla?.escritura && req.method !== 'GET'
    ? niveles.includes('total')
    : regla?.todos ? niveles.length === regla.modulos.length : niveles.length > 0;

  if (!ok) {
    return res.status(403).json({
      status: 'error',
      message: 'Su rol no tiene acceso a este módulo',
    });
  }

  const alcance = alcanceDeUsuario(req.user);
  if (!alcance) return correr(req, next, null);
  req.alcance = alcance;

  const patron = patronPara(alcance, path);
  if (patron) {
    const json = res.json.bind(res);
    res.json = (body) => json(limpiar(body, patron));
  }
  // Recorte + filtro de producto de la pantalla: Postgres subestima las filas (ver
  // database/connection.js), así que esas consultas corren sin nested loops
  correr(req, next, alcance);
};

module.exports = { autorizar };
