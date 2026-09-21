-- ============================================================================
-- rol_agente_ia.sql
-- Crea el usuario de Postgres que usara el agente de IA.
--
-- NO se corre con el runner automatico: necesita una password real.
-- Correr a mano una sola vez desde psql, reemplazando CAMBIAR_ESTA_PASSWORD.
--
--   psql "$DATABASE_URL" -f database/setup/rol_agente_ia.sql
--
-- Este usuario es el unico candado que no depende de que el codigo este bien
-- escrito: aunque el modelo genere un DROP TABLE y la validacion falle,
-- Postgres lo rechaza porque el rol no tiene ese permiso.
-- ============================================================================

DO $crea$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agente_ia') THEN
    CREATE ROLE agente_ia LOGIN PASSWORD 'CAMBIAR_ESTA_PASSWORD';
    RAISE NOTICE 'Rol agente_ia creado';
  ELSE
    RAISE NOTICE 'Rol agente_ia ya existia';
  END IF;
END
$crea$;

-- Conectarse a la base: si.
GRANT CONNECT ON DATABASE abaco_thermoplastica_db TO agente_ia;

-- Ver el schema analitica: si. Leer sus vistas: si.
GRANT USAGE  ON SCHEMA analitica TO agente_ia;
GRANT SELECT ON ALL TABLES IN SCHEMA analitica TO agente_ia;
ALTER DEFAULT PRIVILEGES IN SCHEMA analitica GRANT SELECT ON TABLES TO agente_ia;

-- Tocar las tablas crudas: NO.
REVOKE ALL ON SCHEMA public FROM agente_ia;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM agente_ia;

-- Crear objetos en cualquier lado: NO.
REVOKE CREATE ON SCHEMA public   FROM agente_ia;
REVOKE CREATE ON SCHEMA analitica FROM agente_ia;

-- Que solo vea el schema analitica por defecto: un DROP TABLE transacciones
-- ni siquiera resuelve el nombre.
ALTER ROLE agente_ia SET search_path = analitica;

-- Topes a nivel de sesion, independientes del codigo de la app.
ALTER ROLE agente_ia SET statement_timeout        = '5s';
ALTER ROLE agente_ia SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE agente_ia SET default_transaction_read_only = on;

-- Verificacion
SELECT 'agente_ia puede leer v_cxc' AS chequeo,
       has_table_privilege('agente_ia','analitica.v_cxc','SELECT') AS resultado
UNION ALL
SELECT 'agente_ia NO puede leer public.transacciones',
       NOT has_table_privilege('agente_ia','public.transacciones','SELECT')
UNION ALL
SELECT 'agente_ia NO puede crear en analitica',
       NOT has_schema_privilege('agente_ia','analitica','CREATE');
