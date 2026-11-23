# Fuentes del PDF

`Inter-Regular-latin.ttf` e `Inter-Bold-latin.ttf` son un subconjunto de **Inter 4** (The Inter Project
Authors, licencia SIL Open Font License 1.1, ver `OFL-Inter.txt`), tomado del paquete
`@expo-google-fonts/inter@0.4.2`.

Rangos incluidos: U+0020-007E, U+00A0-024F (Latin-1 y latín extendido A/B), U+2010-2027, U+2030-203A,
U+20AC (€), U+2122 (™). Solo se conserva la característica `kern`.

Se recortan de antemano porque el *subsetting* integrado de pdf-lib (`subset: true`) genera PDFs
con glifos que faltan. Para regenerarlas:

```sh
pip install fonttools==4.55.3
pyftsubset Inter_400Regular.ttf --unicodes='U+0020-007E,U+00A0-024F,U+2010-2027,U+2030-203A,U+20AC,U+2122' \
  --layout-features='kern' --no-hinting --desubroutinize --name-IDs='*' --output-file=Inter-Regular-latin.ttf
```

Si se amplían los rangos, actualizar también `SUPPORTED` en `src/server/pdf.ts`.
