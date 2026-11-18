-- Rol nuevo: Gerencia Operaciones = Finanzas sin Tesorería › Conciliación bancaria
-- (permisos en src/config/permisos.js). Solo amplía las listas de roles válidos.

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN (
  'direccion', 'finanzas', 'gerencia_operaciones', 'gerente_linea', 'gerente_ventas', 'asistente_ventas',
  'ejecutivo_ventas', 'cobranza', 'cxp', 'compras', 'inventario', 'admin'));

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_roles_adicionales_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_roles_adicionales_check CHECK (roles_adicionales <@ ARRAY[
  'direccion', 'finanzas', 'gerencia_operaciones', 'gerente_linea', 'gerente_ventas', 'asistente_ventas',
  'ejecutivo_ventas', 'cobranza', 'cxp', 'compras', 'inventario', 'admin']::text[]);
