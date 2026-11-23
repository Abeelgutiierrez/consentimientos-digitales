# Decisiones técnicas (v2)

Registro breve de decisiones y su porqué. Añadir una entrada nueva en vez de reescribir las antiguas.

## 2026-11-23 · Drizzle en lugar de Prisma
- Las migraciones son SQL revisable: permiten añadir **Row-Level Security** (políticas, `FORCE ROW LEVEL SECURITY`,
  permisos por rol) en el mismo flujo de migraciones.
- Cada petición abre una transacción con `set_config('app.studio_id', …, true)`; con Drizzle es directo.
  Con Prisma el aislamiento por transacción + RLS es incómodo y frágil.
- Sin motor binario: más simple en Windows y en el despliegue.

## 2026-11-23 · `cacheComponents: false`
Next 16 trae Cache Components activado por defecto en las plantillas nuevas. Lo desactivamos porque:
- el panel muestra datos de salud: preferimos que **todo** sea dinámico y que nada del panel se guarde en cachés
  de servidor (la documentación de Next advierte que las claves de caché se guardan en texto plano);
- reduce la superficie de errores de aislamiento entre estudios.
Si en el futuro se cachea algo, solo contenido público y nunca datos de un estudio.

## 2026-11-23 · Fuentes del sistema
Igual que la demo. Evita peticiones a Google Fonts (privacidad) y dependencias de red en la build.

## 2026-11-23 · Diseño heredado
`src/app/globals.css` reutiliza el CSS de la demo (mismos tokens y componentes) dentro de capas de Tailwind,
y expone los tokens a Tailwind (`bg-accent`, `text-muted`…) para las páginas nuevas.

## 2026-11-23 · Versiones fijadas
Dependencias con versión exacta y publicadas hace al menos dos semanas (protección frente a paquetes
comprometidos recién publicados). `npm audit` avisa de `esbuild` dentro de `drizzle-kit`: es una herramienta
solo de desarrollo que no levanta servidor; riesgo aceptado.

## 2026-11-23 · Respuestas del dueño del producto al plan
- Conservación: plazo configurable por estudio, valor provisional «pendiente de asesor»; la purga **nunca** es
  automática: el dueño revisa la lista y confirma.
- Se cifran: salud, JSON firmado completo, firmas, PDFs y DNI (con índice ciego HMAC). Nombre, teléfono y email
  quedan en claro para poder buscar.
- Artistas: ven todos los consentimientos del estudio (los necesitan para trabajar con seguridad), pero no
  exportan, no purgan, no cambian ajustes ni ven la auditoría.
- Enlace público del PDF para el cliente: caduca a los 30 días.

## 2026-11-23 · Fuente del PDF: Inter recortada a latín
El *subsetting* de pdf-lib (`subset: true`) generaba PDFs con la mayoría de glifos vacíos (comprobado
renderizando el PDF; los tests de «PDF válido» pasaban igualmente). Se incrusta la fuente entera, ya
recortada con fonttools a latín + latín extendido (64 KB por peso; PDF ≈ 100 KB). Hay un test que
comprueba que todos los caracteres de los textos legales tienen glifo. Ver `assets/fonts/LEEME.md`.

## 2026-11-23 · Multi-tenant: RLS + filtro explícito + permisos de columna
- Toda consulta de datos de un estudio va por `withStudio()` (transacción con `app.studio_id`) y además
  filtra por `studio_id` en el propio código.
- La app se conecta con `consent_app` (sin superusuario ni BYPASSRLS). Las migraciones y el seed de
  estudios/usuarios usan el rol propietario.
- Permisos de columna: el rol de la app no puede modificar las evidencias de un consentimiento, ni el
  historial de PDFs/anexos, ni la auditoría. Lo comprueban los tests de `tests/db/`.
- Lo que ocurre antes de conocer el estudio (login, sesiones, slug público, enlace del PDF del cliente,
  baja de marketing, tareas programadas) usa funciones `SECURITY DEFINER` que devuelven lo mínimo.

## 2026-11-23 · Lo firmado se guarda entero
Además de la huella, se guarda (cifrado) el JSON canónico exacto que se firmó. Así «Verificar
integridad» comprueba dos cosas: que lo firmado sigue dando la huella registrada y que el PDF vigente
coincide con su hash. En la demo solo se podía comprobar el PDF.
