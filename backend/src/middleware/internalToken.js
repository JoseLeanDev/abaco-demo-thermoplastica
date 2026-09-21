// Middleware para proteger endpoints administrativos / de mantenimiento.
// Requiere header  X-Internal-Token  igual a INTERNAL_ADMIN_TOKEN del entorno.
// Si INTERNAL_ADMIN_TOKEN no está configurado, el endpoint queda deshabilitado.

module.exports = function internalToken(req, res, next) {
  const expected = process.env.INTERNAL_ADMIN_TOKEN;
  if (!expected) {
    return res.status(503).json({
      status: 'error',
      message: 'Endpoint deshabilitado (INTERNAL_ADMIN_TOKEN no configurado en el servidor).'
    });
  }
  const provided = req.get('x-internal-token');
  if (!provided || provided !== expected) {
    return res.status(403).json({
      status: 'error',
      message: 'Prohibido: token interno inválido.'
    });
  }
  next();
};
