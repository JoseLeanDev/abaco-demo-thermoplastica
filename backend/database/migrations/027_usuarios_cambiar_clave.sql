-- Usuarios con contraseña asignada por el administrador (genérica o de alta):
-- mientras esté en TRUE solo pueden cambiar su contraseña; el resto de la API responde 403.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_clave BOOLEAN NOT NULL DEFAULT FALSE;
