const { permisosDeUsuario, modulosDeEndpoint } = require('../config/permisos');
const { als, alcanceDeUsuario, limpiar, patronPara } = require('../services/alcance');

// Va después de `authenticate`: deja pasar solo si los roles del usuario tienen
// alguno de los módulos que usan este endpoint (ver ENDPOINTS en config/permisos).
// Un endpoint sin mapear queda solo para admin, para que lo nuevo no se abra por omisión.
// Luego corre la petición con el alcance del usuario (services/alcance.js): las
// consultas salen recortadas y los montos que su rol no ve se quitan de la respuesta.
const autorizar = (req, res, next) => {
  if (req.user?.rol === 'admin') return next();

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
  if (!alcance) return next();
  req.alcance = alcance;

  const patron = patronPara(alcance, path);
  if (patron) {
    const json = res.json.bind(res);
    res.json = (body) => json(limpiar(body, patron));
  }
  // Recorte + filtro de producto de la pantalla: Postgres subestima las filas (ver
  // database/connection.js), así que esas consultas corren sin nested loops
  const conFiltroProducto = ['categoria', 'subcategoria', 'sublinea'].some(k => req.query?.[k]);
  als.run(conFiltroProducto ? { ...alcance, sinNestloop: true } : alcance, next);
};

module.exports = { autorizar };
