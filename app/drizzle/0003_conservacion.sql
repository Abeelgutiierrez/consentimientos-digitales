-- Purga por conservación (confirmada por el dueño/a): al eliminar a un cliente sin consentimientos
-- vigentes hay que borrar también los correos que se le enviaron (contienen nombre y correo).
GRANT DELETE ON emails TO consent_app;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS consents_purge_idx ON consents (studio_id, purge_after) WHERE purge_after IS NOT NULL;
