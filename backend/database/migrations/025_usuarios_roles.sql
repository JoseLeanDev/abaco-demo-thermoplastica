-- Roles de usuario (hoja "Usuarios y roles Abaco"). El catálogo vive en
-- backend/src/config/permisos.js; aquí solo se restringe el valor de `rol`
-- y se agrega el alcance asignado a cada usuario:
--   alcance = { "lineas": ["Laminados", ...], "vendedores": ["014", ...] }
-- El rol genérico 'usuario' desaparece: si quedara alguno, pasa al rol más acotado
-- (inventario) e inactivo, hasta que un admin le asigne el que corresponde.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS alcance JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE usuarios SET rol = 'inventario', activo = FALSE
 WHERE rol IS NULL OR rol NOT IN ('direccion', 'finanzas', 'gerente_linea', 'gerente_ventas',
   'asistente_ventas', 'ejecutivo_ventas', 'cobranza', 'cxp', 'compras', 'inventario', 'admin');

ALTER TABLE usuarios ALTER COLUMN rol DROP DEFAULT;
ALTER TABLE usuarios ALTER COLUMN rol SET NOT NULL;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN (
  'direccion', 'finanzas', 'gerente_linea', 'gerente_ventas', 'asistente_ventas',
  'ejecutivo_ventas', 'cobranza', 'cxp', 'compras', 'inventario', 'admin'));
