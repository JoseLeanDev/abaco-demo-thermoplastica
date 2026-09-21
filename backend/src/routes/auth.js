const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../database/connection');
const { authenticate, generateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email y password son requeridos'
      });
    }

    // Buscar usuario
    const usuario = await db.getAsync(
      'SELECT id, nombre, email, password_hash, rol, avatar_url, activo FROM usuarios WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (!usuario) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

    if (!usuario.activo) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario inactivo. Contacte al administrador.'
      });
    }

    // Verificar password
    const validPassword = await bcrypt.compare(password, usuario.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas'
      });
    }

    // Actualizar último login
    await db.runAsync(
      'UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?',
      [usuario.id]
    );

    // Generar token
    const token = generateToken(usuario.id);

    // Responder (sin enviar password_hash)
    const { password_hash, ...userWithoutPassword } = usuario;

    res.json({
      status: 'success',
      message: 'Login exitoso',
      data: {
        user: userWithoutPassword,
        token
      }
    });

  } catch (error) {
    console.error('[AUTH LOGIN ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Error en el servidor'
    });
  }
});

// ==================== REGISTER ====================
// Reglas:
//   1. Si NO existen usuarios en la BD → cualquiera puede crear el PRIMER admin
//      (bootstrap una sola vez).
//   2. Si ya existen usuarios → solo un admin autenticado puede crear otros.
//   3. Solo un admin puede asignar rol 'admin'; cualquier otro rol es 'usuario'.
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    let { rol = 'usuario' } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Nombre, email y password son requeridos'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'La contraseña debe tener al menos 8 caracteres'
      });
    }

    // ¿Es el primer usuario del sistema?
    const total = await db.getAsync('SELECT COUNT(*)::int AS count FROM usuarios');
    const isBootstrap = parseInt(total?.count || 0) === 0;

    if (!isBootstrap) {
      // Ya hay usuarios: solo un admin autenticado puede registrar otros.
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          status: 'error',
          message: 'Registro requiere autenticación de administrador.'
        });
      }
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        const admin = await db.getAsync(
          'SELECT rol FROM usuarios WHERE id = ? AND activo = TRUE',
          [decoded.userId]
        );
        if (!admin || admin.rol !== 'admin') {
          return res.status(403).json({
            status: 'error',
            message: 'Solo administradores pueden registrar usuarios.'
          });
        }
      } catch (jwtErr) {
        return res.status(401).json({
          status: 'error',
          message: 'Token inválido.'
        });
      }
    } else {
      // Bootstrap: el primer usuario siempre queda como admin.
      rol = 'admin';
    }

    // Solo un admin autenticado (o bootstrap) puede crear otro admin.
    if (rol !== 'admin' && rol !== 'usuario') rol = 'usuario';

    // Verificar si el email ya existe
    const existing = await db.getAsync(
      'SELECT id FROM usuarios WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (existing) {
      return res.status(409).json({
        status: 'error',
        message: 'El email ya está registrado'
      });
    }

    // Hash de password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Crear usuario
    const result = await db.runAsync(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)',
      [nombre.trim(), email.toLowerCase().trim(), passwordHash, rol]
    );

    const newUser = await db.getAsync(
      'SELECT id, nombre, email, rol, activo, created_at FROM usuarios WHERE id = ?',
      [result.id || result.rows?.[0]?.id]
    );

    // Si no podemos obtener el ID de result, lo buscamos por email
    const user = newUser || await db.getAsync(
      'SELECT id, nombre, email, rol, activo, created_at FROM usuarios WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    const token = generateToken(user.id);

    res.status(201).json({
      status: 'success',
      message: 'Usuario creado exitosamente',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    console.error('[AUTH REGISTER ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Error en el servidor'
    });
  }
});

// ==================== ME (usuario actual) ====================
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('[AUTH ME ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Error en el servidor'
    });
  }
});

// ==================== LOGOUT (client-side, solo confirmación) ====================
router.post('/logout', authenticate, async (req, res) => {
  try {
    // El logout es client-side (eliminar token del storage)
    // Aquí podríamos agregar blacklisting de tokens si fuera necesario
    res.json({
      status: 'success',
      message: 'Logout exitoso'
    });
  } catch (error) {
    console.error('[AUTH LOGOUT ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Error en el servidor'
    });
  }
});

// ==================== LISTAR USUARIOS (solo admin) ====================
router.get('/usuarios', authenticate, async (req, res) => {
  try {
    // Solo admin puede ver todos los usuarios
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'No tiene permisos para ver usuarios'
      });
    }

    const usuarios = await db.allAsync(
      'SELECT id, nombre, email, rol, avatar_url, activo, ultimo_login, created_at FROM usuarios ORDER BY created_at DESC'
    );

    res.json({
      status: 'success',
      data: { usuarios }
    });

  } catch (error) {
    console.error('[AUTH USUARIOS ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Error en el servidor'
    });
  }
});

// ==================== ACTUALIZAR USUARIO ====================
router.patch('/usuarios/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rol, activo } = req.body;

    // Solo admin o el propio usuario puede actualizar
    if (req.user.rol !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({
        status: 'error',
        message: 'No tiene permisos para editar este usuario'
      });
    }

    // Solo admin puede cambiar rol o activo
    if ((rol !== undefined || activo !== undefined) && req.user.rol !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'No tiene permisos para cambiar rol o estado'
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 0;

    if (nombre !== undefined) {
      paramCount++;
      updates.push(`nombre = $${paramCount}`);
      values.push(nombre.trim());
    }
    if (rol !== undefined && req.user.rol === 'admin') {
      paramCount++;
      updates.push(`rol = $${paramCount}`);
      values.push(rol);
    }
    if (activo !== undefined && req.user.rol === 'admin') {
      paramCount++;
      updates.push(`activo = $${paramCount}`);
      values.push(activo);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No hay campos para actualizar'
      });
    }

    paramCount++;
    values.push(parseInt(id));

    const sql = `UPDATE usuarios SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount}`;
    await db.runAsync(sql, values);

    const usuario = await db.getAsync(
      'SELECT id, nombre, email, rol, avatar_url, activo, ultimo_login, created_at FROM usuarios WHERE id = ?',
      [parseInt(id)]
    );

    res.json({
      status: 'success',
      message: 'Usuario actualizado',
      data: { usuario }
    });

  } catch (error) {
    console.error('[AUTH UPDATE ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Error en el servidor'
    });
  }
});

// ==================== CAMBIAR PASSWORD ====================
router.post('/cambiar-password', authenticate, async (req, res) => {
  try {
    const { passwordActual, passwordNuevo } = req.body;

    if (!passwordActual || !passwordNuevo || passwordNuevo.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password actual y nuevo requeridos (mínimo 6 caracteres)'
      });
    }

    // Verificar password actual
    const usuario = await db.getAsync(
      'SELECT password_hash FROM usuarios WHERE id = ?',
      [req.user.id]
    );

    const validPassword = await bcrypt.compare(passwordActual, usuario.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Password actual incorrecto'
      });
    }

    // Hash nuevo password
    const newHash = await bcrypt.hash(passwordNuevo, 10);

    await db.runAsync(
      'UPDATE usuarios SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [newHash, req.user.id]
    );

    res.json({
      status: 'success',
      message: 'Password actualizado exitosamente'
    });

  } catch (error) {
    console.error('[AUTH PASSWORD ERROR]', error);
    res.status(500).json({
      status: 'error',
      message: 'Error en el servidor'
    });
  }
});

module.exports = router;
