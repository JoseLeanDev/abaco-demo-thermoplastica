const jwt = require('jsonwebtoken');
const db = require('../../database/connection');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET no está configurado. El servidor no puede firmar/verificar tokens.');
  throw new Error('JWT_SECRET missing');
}

// Middleware para verificar token JWT
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Token de autenticación requerido'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Verificar que el usuario existe y está activo
      const usuario = await db.getAsync(
        'SELECT id, nombre, email, rol, avatar_url, activo FROM usuarios WHERE id = ? AND activo = TRUE',
        [decoded.userId]
      );
      
      if (!usuario) {
        return res.status(401).json({
          status: 'error',
          message: 'Usuario no encontrado o inactivo'
        });
      }
      
      req.user = usuario;
      next();
    } catch (jwtError) {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido o expirado'
      });
    }
  } catch (error) {
    console.error('[AUTH ERROR]', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error en autenticación'
    });
  }
};

// Middleware opcional (no bloquea si no hay token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const usuario = await db.getAsync(
        'SELECT id, nombre, email, rol, avatar_url FROM usuarios WHERE id = ? AND activo = TRUE',
        [decoded.userId]
      );
      
      if (usuario) {
        req.user = usuario;
      }
    }
    
    next();
  } catch (error) {
    next(); // Continúa sin usuario autenticado
  }
};

// Generar token JWT
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = {
  authenticate,
  optionalAuth,
  generateToken,
  JWT_SECRET
};
