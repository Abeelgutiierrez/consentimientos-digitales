# Consentimientos Digitales · v2 (piloto)

Versión para el piloto con 1–2 estudios. Tiene todo lo de la demo (Fase 1) y añade base de datos
Postgres, cifrado de datos de salud, varios usuarios por estudio, aislamiento real entre estudios,
registro de auditoría, conservación configurable, exportación de datos y preparación para catalán.

> La demo sigue en la carpeta raíz y se arranca igual que siempre con `node server.js`.

---

## Arrancar en local

Requisitos: **Node.js 20.9 o superior** (probado con 24) y **Docker Desktop** abierto.

```powershell
cd "C:\Users\abelg\Proyecto DIgitalizacion Consentimiento\app"
npm install
npm run setup:env        # crea .env.local con claves de cifrado aleatorias (solo la primera vez)
docker compose up -d     # Postgres 17 en el puerto 5433
npm run db:reset         # crea las tablas y carga los datos de demostración (ficticios)
npm run dev              # http://localhost:3000
```

- Panel: http://localhost:3000/login · usuarios de demo (contraseña `demo1234`):
  - `marc@agujafina.example` (dueño de Aguja Fina Tattoo) · `laia@agujafina.example` y `alex@agujafina.example` (artistas)
  - `elena@lumiere.example` (dueña de Lumière Estètica)
- Formulario del cliente: http://localhost:3000/s/aguja-fina (o escanea el QR del panel desde el móvil, en la misma Wi‑Fi).
- Los días siguientes basta con `docker compose up -d` y `npm run dev`.

## Variables de entorno

Se leen de `.env.local` (no se sube a Git). `.env.example` está comentado línea a línea.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión con el rol de la app `consent_app` (sin superusuario, sujeto a RLS). |
| `DATABASE_OWNER_URL` | Para migrar | Rol propietario: migraciones y datos de demo. |
| `DATA_ENCRYPTION_KEYS` | Sí | Claves AES‑256 `id:base64` separadas por comas (la activa cifra, todas descifran). |
| `DATA_ENCRYPTION_ACTIVE_KEY` | Sí | Id de la clave con la que se cifra lo nuevo. |
| `BLIND_INDEX_KEY` | Sí | Clave HMAC (32 bytes base64) para buscar por DNI y para los enlaces de baja. |
| `PUBLIC_URL` | En producción | Dirección pública (QR, enlaces de los correos). Vacía en local = IP de la Wi‑Fi. |
| `RESEND_API_KEY`, `RESEND_FROM` | No | Envío real de correos. Sin ellas los correos se simulan. |
| `JOBS_IN_PROCESS` | No | `1` = el servidor ejecuta las tareas programadas cada hora. |
| `LOG_LEVEL` | No | `info` por defecto. |
| `TEST_DATABASE_URL`, `TEST_DATABASE_OWNER_URL` | Tests | Base de datos `consentimientos_test` (la crea Docker). |

> ⚠️ **Si se pierde la clave de cifrado, se pierden los datos de salud, las firmas y los PDFs.**
> Guarda las claves en un gestor de secretos, **separadas** de las copias de seguridad de la base de datos.
> Para rotar: añade una clave nueva a `DATA_ENCRYPTION_KEYS`, ponla como activa y conserva la antigua.

## Comandos

| Comando | Para qué |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run db:migrate` | Aplica migraciones pendientes (también en producción). |
| `npm run db:reset` | Borra la BD de desarrollo y carga la demo (bloqueado en producción). |
| `npm run db:seed` | Vuelve a cargar los datos de demo. |
| `npm run jobs` | Tareas programadas: cumpleaños y limpieza de sesiones. En producción, con cron a diario. |
| `npm run check` | Tipos + lint + tests de lógica y base de datos (Vitest). |
| `npm run test:e2e` | Compila y ejecuta el flujo completo en vista móvil (Playwright). La primera vez: `npx playwright install chromium`. |

## Demo en directo (visita comercial)

Pensada para enseñarlo en un estudio en 3–4 minutos, con el móvil del propio comerciante.

1. Abre **`/demo`** en el portátil. Muestra el QR del formulario (con la IP de la wifi del portátil) y el guion.
2. Pulsa **«Abrir el panel del estudio»**: entra en el panel de la demo con un clic (acceso normal con la
   contraseña pública `demo1234`). El panel muestra «En directo» y se actualiza solo.
3. El comerciante escanea el QR, pulsa **«Rellenar con datos de ejemplo»**, avanza los pasos y firma con el dedo.
4. En el portátil salta el aviso «Nuevo consentimiento firmado» y la fila aparece en la lista.
   En el móvil, la pantalla final ofrece **«Verlo en el panel del estudio»**, que abre ese consentimiento.

El modo demo está activo fuera de producción, en los tests E2E o con `DEMO_MODE=1`. **No pongas `DEMO_MODE`
en un despliegue con clientes reales.** El móvil y el portátil tienen que estar en la misma wifi y Windows
tiene que permitir Node en la red privada. Si la demo está publicada, define `PUBLIC_URL` para el QR.

## Qué hay dentro

```
app/
  src/core/        Lógica pura: JSON canónico y huella, contenido legal, validación, firma, fechas, QR
  src/server/      Acceso a datos y servicios (solo servidor): cifrado, RLS (withStudio), consentimientos,
                   PDF, auth, equipo, correos, RGPD, auditoría
  src/app/         Páginas (Next.js App Router): /s/[slug] formulario, /panel/*, /login, /baja, API
  src/db/          Esquema Drizzle y cliente
  drizzle/         Migraciones SQL (0001 = RLS, permisos y funciones de acceso)
  messages/        Textos de la interfaz: es.json y ca.json
  tests/unit|db|e2e  Vitest (lógica y BD) y Playwright (móvil)
  docs/decisiones.md  Por qué se ha hecho cada cosa así
```

### Garantías principales
- **Evidencias**: la huella SHA‑256 del JSON canónico de lo firmado se calcula una vez y **no se puede modificar**
  (el rol de la app no tiene permiso de UPDATE sobre esas columnas). Se guarda el JSON exacto (cifrado) para volver a
  comprobar la huella. El anexo de tintas crea una versión nueva del PDF con su propio hash; se conservan todas.
  Es el mismo cálculo que la demo (un test lo compara ejecutando el código de la demo).
- **Cifrado** AES‑256‑GCM por campo: salud y todo lo firmado, firmas, DNI (con índice ciego para buscar) y PDFs.
  Cada valor va ligado a su estudio y registro: copiarlo a otro estudio no sirve.
- **Multi‑tenant**: Row‑Level Security en Postgres + filtro explícito por estudio en cada consulta. Los tests de
  `tests/db/isolation.test.ts` y los e2e lo comprueban.
- **Auditoría** de consultas, descargas (panel y cliente), verificaciones, anexos, exportaciones, purgas y accesos.
- **Sin datos personales en logs ni en URLs** (los errores de consulta se registran sin parámetros).

## Producción (UE) — checklist antes del piloto
- [ ] Postgres gestionado en una región de la UE, con copias de seguridad cifradas y prueba de restauración.
- [ ] Crear el rol `consent_app` (ver `docker/initdb/01-roles.sql`) y ejecutar `npm run db:migrate` con el rol propietario.
- [ ] Claves de cifrado en un gestor de secretos; `PUBLIC_URL` con HTTPS; `NODE_ENV=production`.
- [ ] `npm run jobs` programado a diario (o `JOBS_IN_PROCESS=1` si hay un solo servidor).
- [ ] Dominio verificado en Resend (región UE) y `RESEND_FROM`.
- [ ] Crear el estudio real y su dueño/a (por ahora con SQL como propietario; no hay alta autoservicio).
- [ ] **Revisión legal**: textos del consentimiento, plazo de conservación, texto y enlace de baja de los correos,
      contrato de encargado del tratamiento con cada estudio, versión en catalán de los textos legales.

## Limitaciones conocidas
- Los textos legales solo están en castellano; la interfaz está en castellano y catalán (con aviso en el formulario).
- El límite de envíos del formulario y de intentos de login es por servidor (en memoria / BD). Con varias instancias, revisar.
- Firma electrónica simple con evidencias; sin sellado de tiempo cualificado.
- No hay alta de estudios desde la web ni recuperación de contraseña por correo (el dueño/a pone una nueva desde «Equipo»).
