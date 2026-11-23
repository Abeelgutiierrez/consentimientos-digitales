-- Aislamiento multi-tenant, permisos mínimos y funciones de acceso previo al estudio.
--
-- 1) Row-Level Security: cada fila solo es visible si su studio_id coincide con
--    current_setting('app.studio_id'), que la app fija por transacción (set_config(..., true)).
--    Sin contexto, las consultas devuelven 0 filas y los INSERT fallan.
-- 2) Permisos de columna: el rol de la app NO puede modificar las evidencias de un consentimiento
--    (JSON firmado, huella, IP, fecha…) ni el registro de auditoría.
-- 3) Funciones SECURITY DEFINER para lo que ocurre antes de saber el estudio (login, enlace
--    público, baja de marketing). Devuelven lo mínimo imprescindible.

CREATE OR REPLACE FUNCTION app_studio_id() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.studio_id', true), '') $$;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','artists','clients','marketing_events','consents','consent_annexes','consent_pdfs','audit_events','emails'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (studio_id = app_studio_id()) WITH CHECK (studio_id = app_studio_id())', t);
  END LOOP;
END $$;
--> statement-breakpoint

ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE studios FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON studios USING (id = app_studio_id()) WITH CHECK (id = app_studio_id());
--> statement-breakpoint

-- Sesiones: solo accesibles mediante funciones (RLS activo y sin política = nada visible).
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ---------------------------------------------------------------- permisos del rol de la app
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO consent_app;
--> statement-breakpoint
GRANT SELECT ON studios TO consent_app;
--> statement-breakpoint
GRANT UPDATE (name, cif, phone, address, city, email, color, logo, logo_mime, services, default_locale,
              retention_years, retention_note, birthday, updated_at) ON studios TO consent_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON users TO consent_app;
--> statement-breakpoint
GRANT UPDATE (email, name, role, password_hash, active, locale, last_login_at) ON users TO consent_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON login_attempts TO consent_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE login_attempts_id_seq TO consent_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON artists TO consent_app;
--> statement-breakpoint
GRANT UPDATE (name, user_id, active, sort) ON artists TO consent_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON clients TO consent_app;
--> statement-breakpoint
GRANT UPDATE (first_name, last_name, birth_date, email, phone, address, marketing, marketing_at,
              unsubscribe_token_hash, updated_at) ON clients TO consent_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON marketing_events TO consent_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE marketing_events_id_seq TO consent_app;
--> statement-breakpoint
-- Consentimientos: las evidencias no se pueden modificar; solo versión de PDF/anexo y conservación.
-- DELETE solo para la purga por conservación (confirmada por el dueño) y el derecho de supresión.
GRANT SELECT, INSERT, DELETE ON consents TO consent_app;
--> statement-breakpoint
GRANT UPDATE (pdf_version, annex_version, purge_after) ON consents TO consent_app;
--> statement-breakpoint
-- Historial de anexos y PDFs: solo se añade (se borran en cascada con el consentimiento).
GRANT SELECT, INSERT ON consent_annexes TO consent_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON consent_pdfs TO consent_app;
--> statement-breakpoint
-- Auditoría: solo añadir y leer. Ni UPDATE ni DELETE.
GRANT SELECT, INSERT ON audit_events TO consent_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE audit_events_id_seq TO consent_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON emails TO consent_app;
--> statement-breakpoint
GRANT UPDATE (status, error) ON emails TO consent_app;
--> statement-breakpoint

-- ---------------------------------------------------------------- funciones previas al estudio
-- Login: busca un usuario por correo (sin saber aún su estudio).
CREATE FUNCTION auth_find_user(p_email text)
RETURNS TABLE (id text, studio_id text, password_hash text, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT u.id, u.studio_id, u.password_hash, u.active FROM users u WHERE lower(u.email) = lower(p_email) LIMIT 1
$$;
--> statement-breakpoint

CREATE FUNCTION auth_create_session(p_token_hash text, p_user_id text, p_expires_at timestamptz, p_ip text, p_user_agent text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO sessions (token_hash, user_id, studio_id, expires_at, ip, user_agent)
  SELECT p_token_hash, u.id, u.studio_id, p_expires_at, left(p_ip, 64), left(p_user_agent, 300)
  FROM users u WHERE u.id = p_user_id AND u.active
$$;
--> statement-breakpoint

-- Devuelve la sesión válida (no caducada y con usuario activo) y renueva last_seen_at.
CREATE FUNCTION auth_get_session(p_token_hash text)
RETURNS TABLE (user_id text, studio_id text, expires_at timestamptz)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE sessions s SET last_seen_at = now()
  FROM users u
  WHERE s.token_hash = p_token_hash AND s.expires_at > now() AND u.id = s.user_id AND u.active
  RETURNING s.user_id, s.studio_id, s.expires_at
$$;
--> statement-breakpoint

CREATE FUNCTION auth_delete_session(p_token_hash text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM sessions WHERE token_hash = p_token_hash
$$;
--> statement-breakpoint

-- Cierra todas las sesiones de un usuario del estudio actual (al desactivarlo o cambiar su contraseña).
CREATE FUNCTION auth_delete_user_sessions(p_user_id text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM sessions WHERE user_id = p_user_id AND studio_id = app_studio_id()
$$;
--> statement-breakpoint

CREATE FUNCTION auth_purge_expired_sessions()
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM sessions WHERE expires_at < now()
$$;
--> statement-breakpoint

-- Formulario público: solo el id del estudio a partir del slug de la URL.
CREATE FUNCTION public_studio_id(p_slug text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id FROM studios WHERE slug = p_slug
$$;
--> statement-breakpoint

-- Enlace de descarga del cliente: consentimiento y estudio a partir del hash del token.
CREATE FUNCTION public_consent_by_token(p_token_hash text)
RETURNS TABLE (consent_id text, studio_id text, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id, studio_id, public_token_expires_at FROM consents WHERE public_token_hash = p_token_hash
$$;
--> statement-breakpoint

-- Baja de marketing desde el enlace del correo.
CREATE FUNCTION public_client_by_unsubscribe(p_token_hash text)
RETURNS TABLE (client_id text, studio_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id, studio_id FROM clients WHERE unsubscribe_token_hash = p_token_hash
$$;
--> statement-breakpoint

-- Tareas programadas (cumpleaños): lista de estudios a recorrer, cada uno con su contexto.
CREATE FUNCTION system_studio_ids()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id FROM studios ORDER BY created_at
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION auth_find_user(text), auth_create_session(text, text, timestamptz, text, text),
  auth_get_session(text), auth_delete_session(text), auth_delete_user_sessions(text), auth_purge_expired_sessions(),
  public_studio_id(text), public_consent_by_token(text), public_client_by_unsubscribe(text), system_studio_ids() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_find_user(text), auth_create_session(text, text, timestamptz, text, text),
  auth_get_session(text), auth_delete_session(text), auth_delete_user_sessions(text), auth_purge_expired_sessions(),
  public_studio_id(text), public_consent_by_token(text), public_client_by_unsubscribe(text), system_studio_ids(), app_studio_id() TO consent_app;
