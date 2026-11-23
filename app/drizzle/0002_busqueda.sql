-- Búsqueda sin distinguir acentos ni mayúsculas («nuria» encuentra «Núria»), como en la demo.
CREATE OR REPLACE FUNCTION norm_txt(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(translate(coalesce(t, ''),
    'ÁÀÄÂáàäâÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔóòöôÚÙÜÛúùüûÑñÇç·',
    'AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNnCc.'))
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION norm_txt(text) TO consent_app;
