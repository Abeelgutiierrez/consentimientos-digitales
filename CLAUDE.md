# CLAUDE.md · Consentimientos Digitales

Contexto permanente para Claude Code. Léelo antes de tocar nada.

## Qué es
SaaS de consentimientos informados digitales para estudios de tatuaje, piercing y micropigmentación
(y más adelante centros de estética no médicos). Mercado inicial: Igualada y l'Anoia (Catalunya),
regulado por el Decret 90/2008. El cliente escanea un QR, rellena el formulario en su móvil, firma
con el dedo y el estudio recibe el PDF firmado. Valor añadido: ficha de clientes, trazabilidad de
tintas/lotes y automatizaciones (felicitación de cumpleaños con descuento, solo con consentimiento
de marketing).

## Estado actual: demo Fase 1 (Node puro, sin dependencias)
- Arrancar: `node server.js` → http://localhost:3000 · panel en `/panel` (contraseña demo `demo1234`).
- Reiniciar datos de demo: `npm run reset` (fechas relativas a hoy).
- Almacenamiento: `data/db.json` + `data/pdfs/` (ignorados en Git).
- Librerías incluidas en `lib/vendor/` (pdf-lib y QR, MIT) porque no había acceso a npm.

### Mapa del código
- `server.js` rutas HTTP (público, API, panel con sesión por cookie).
- `lib/consents.js` validación + registro. **`evidence.signHash`** = SHA-256 del JSON canónico de todo
  lo firmado (datos, salud, textos mostrados, firma, fecha). Nunca recalcularlo ni modificar lo firmado:
  los cambios posteriores van al **anexo** (`annex`) y regeneran el PDF con `pdfVersion` + `pdfHash` nuevos.
- `lib/pdf.js` PDF con pdf-lib (fuentes estándar → solo WinAnsi, usar `clean()`).
- `lib/content.js` textos legales, cuestionario de salud, servicios. Versionados con `CONSENT_VERSION`.
- `lib/signature.js` firma vectorial `{w,h,strokes}` → SVG / PDF.
- `lib/email.js` cumpleaños (bandeja simulada o Resend si hay `RESEND_API_KEY`).
- `lib/views/*` HTML renderizado en servidor; `public/` CSS y JS del navegador.

## Versión 2 (piloto): carpeta `app/`
- Next.js 16 (App Router, `cacheComponents: false`) + TypeScript estricto + Tailwind 4 + Drizzle + Postgres (Docker, puerto 5433).
  Leer `app/README.md` (arranque y variables) y `app/docs/decisiones.md` (por qué) antes de tocarla.
- `app/AGENTS.md`: esta versión de Next tiene cambios; consultar `app/node_modules/next/dist/docs/` antes de usar APIs.
- Toda consulta de datos de un estudio pasa por `withStudio()` / `withUser()` (RLS + filtro explícito). Nunca usar
  `db` directamente para datos de estudios. Lo previo al estudio va por funciones `SECURITY DEFINER` (`drizzle/0001_rls.sql`).
- Evidencias: `src/core/evidence.ts` (payload firmado v2, se guarda entero y cifrado). Mismo `canonicalJson` que la demo
  (test `tests/unit/compat-demo.test.ts`). El rol de la app no puede modificar columnas de evidencia ni la auditoría.
- Cifrado: `src/server/crypto.ts` (AAD = tabla|campo|estudio|fila). Textos de la interfaz en `app/messages/{es,ca}.json`
  (claves sin puntos; mismas claves en ambos idiomas). Textos legales en `src/core/content.ts` (solo castellano hasta revisión).
- Verificar: `npm run check` (Vitest, necesita Docker) y `npm run test:e2e` (Playwright móvil, flujo completo).
- La demo de la raíz no se toca: se sigue usando para enseñarla a clientes.

## Reglas del proyecto
- Interfaz, textos y comentarios **en español** (más adelante, versión en catalán).
- Datos de salud = categoría especial RGPD: minimizar, no registrarlos en logs, nunca en URLs.
- Marketing/cumpleaños **solo** si `client.marketing === true`; casillas opcionales nunca premarcadas.
- Menores: tutor obligatorio; menores de 16, certificado de madurez.
- Escapar siempre el HTML generado (`esc()`); validar en servidor aunque el cliente ya valide.
- Usar solo datos ficticios en pruebas y seeds.
- No borrar `data/` ni PDFs firmados sin confirmación explícita.
- Antes de dar algo por terminado: arrancar el servidor, recorrer el flujo completo
  (formulario → firma → panel → PDF → verificar integridad) y comprobar que no hay errores en consola.

## Hoja de ruta
- **Fase 2 · Piloto:** Postgres en la UE, cifrado de datos de salud, copias de seguridad, registro de
  accesos, plazos de conservación, contrato de encargado del tratamiento, textos revisados por un asesor.
- **Fase 3 · Producto:** Next.js + TypeScript, multi-tenant real, plantillas por tipo de negocio,
  integración con agente de reservas por WhatsApp, recordatorio de cuidados y petición de reseñas.
- **Fase 4:** planes de pago (básico / pro) y expansión al resto de Catalunya.
