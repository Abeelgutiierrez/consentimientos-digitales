-- Se ejecuta solo la primera vez que se crea el volumen.
-- consent_owner (superusuario del contenedor) aplica migraciones.
-- consent_app es el rol con el que se conecta la aplicación: sin superusuario
-- y sin BYPASSRLS, de modo que las políticas Row-Level Security se aplican siempre.
CREATE ROLE consent_app LOGIN PASSWORD 'consent_app_dev' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- Base de datos separada para los tests automáticos.
CREATE DATABASE consentimientos_test OWNER consent_owner;

GRANT CONNECT ON DATABASE consentimientos TO consent_app;
GRANT CONNECT ON DATABASE consentimientos_test TO consent_app;
