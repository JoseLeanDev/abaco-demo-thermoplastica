const { ROLES_POR_KEY, modulosDeEndpoint } = require('../config/permisos');

// Va después de `authenticate`: deja pasar solo si el rol del usuario tiene
// alguno de los módulos que usan este endpoint (ver ENDPOINTS en config/permisos).
// Un endpoint sin mapear queda solo para admin, para que lo nuevo no se abra por omisión.
const autorizar = (req, res, next) => {
  const rol = ROLES_POR_KEY[req.user?.rol];
  if (req.user?.rol === 'admin') return next();

  const path = `${req.baseUrl}${req.path}`.replace(/^\/api/, '').replace(/\/$/, '');
  const regla = modulosDeEndpoint(path);
  const niveles = (regla?.modulos || []).map(m => rol?.permisos[m]?.nivel).filter(Boolean);

  const ok = regla?.escritura && req.method !== 'GET'
    ? niveles.includes('total')
    : regla?.todos ? niveles.length === regla.modulos.length : niveles.length > 0;

  if (!ok) {
    return res.status(403).json({
      status: 'error',
      message: 'Su rol no tiene acceso a este módulo',
    });
  }
  next();
};

module.exports = { autorizar };
