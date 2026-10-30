-- Un usuario puede tener más de un rol (p. ej. Cobranza + CxP): `rol` es el principal
-- y `roles_adicionales` los demás. Los permisos son la unión (config/permisos.js).

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS roles_adicionales TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_roles_adicionales_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_roles_adicionales_check CHECK (roles_adicionales <@ ARRAY[
  'direccion', 'finanzas', 'gerente_linea', 'gerente_ventas', 'asistente_ventas',
  'ejecutivo_ventas', 'cobranza', 'cxp', 'compras', 'inventario', 'admin']::text[]);
