# Consentimientos Digitales · Demo (Fase 1)

Demo funcional para enseñar a estudios de tatuaje, piercing y micropigmentación:
el cliente escanea un QR, rellena sus datos en el móvil, firma con el dedo y el estudio
recibe al momento el PDF firmado en su panel.

> ⚠️ **Es una demo.** Usa solo datos ficticios. Antes de usarla con clientes reales hay que
> pasar a la Fase 2 (base de datos cifrada, contrato de encargado del tratamiento, revisión legal
> de los textos, copias de seguridad…).

---

## Arrancar en 1 minuto

Requisito: **Node.js 18 o superior** (`node -v` para comprobarlo). No hace falta `npm install`:
el proyecto no tiene dependencias externas.

En PowerShell (o en el terminal de VS Code, `Ctrl+ñ`):

```powershell
cd "C:\Users\abelg\Proyecto DIgitalizacion Consentimiento"
node server.js
```

Verás algo así:

```
  En este ordenador:   http://localhost:3000
  Desde el móvil:      http://192.168.1.50:3000
  Panel del estudio:   http://localhost:3000/panel   (contraseña: demo1234)
```

- La primera vez se cargan solos los **datos de demostración** (2 estudios, 14 clientes).
- Si Windows pregunta por el **firewall**, permite el acceso en **redes privadas** (si no, el móvil no podrá conectar).
- También puedes arrancarlo con **F5** en VS Code (configuración «Arrancar demo»).

| Comando | Para qué |
|---|---|
| `npm start` | Arranca el servidor |
| `npm run dev` | Arranca y se reinicia solo al guardar cambios |
| `npm run reset` | Borra todo y vuelve a cargar los datos de demo |
| `$env:PORT=3001; node server.js` | Usar otro puerto si el 3000 está ocupado |

## Guion para enseñarla a un estudio (5 minutos)

1. Abre `http://localhost:3000/panel`, entra en **Aguja Fina Tattoo** (`demo1234`).
2. **Resumen**: firmados hoy, tintas pendientes, próximos cumpleaños.
3. **QR del mostrador**: pídele que lo escanee con su móvil (misma Wi‑Fi) y que rellene y firme.
4. Vuelve a **Consentimientos**: aparece al instante. Abre el detalle → **Ver PDF**.
5. En el detalle, anota **tintas y lotes** → se regenera el PDF con el anexo de trazabilidad.
6. **Verificar integridad**: el sistema comprueba la huella SHA‑256 del PDF.
7. **Clientes** → un cliente → **Simular cumpleaños ahora** → correo con el 10% y su código.
   Prueba también con Sergi (no aceptó promociones): el sistema no deja enviarlo (RGPD).
8. **Ajustes del estudio**: sube su logo y pon su color. El formulario, el PDF y los correos
   cambian al momento. Así le enseñas la demo «con su marca».

## Qué incluye

**Formulario del cliente** (`/s/<estudio>`), pensado para móvil:
- 5 pasos: datos · servicio · cuestionario de salud · información y autorizaciones · firma.
- Menores: datos y firma del representante legal; menores de 16, certificado de madurez (Decret 90/2008).
- Casillas separadas para RGPD (obligatoria), promociones/cumpleaños (opcional) y fotos en redes (opcional).
- Firma vectorial con el dedo; copia en PDF descargable al terminar.

**PDF del consentimiento**
- Datos, servicio, cuestionario, documento informativo, declaraciones, firmas.
- Bloque de evidencias: fecha y hora, IP, dispositivo, versión del texto y **huella SHA‑256**
  de todo lo firmado (datos + textos + firma).
- Anexo del aplicador con marca, color, lote, caducidad y nº AEMPS de las tintas.

**Panel del estudio** (`/panel`)
- Resumen con métricas · listado y buscador de consentimientos y clientes · detalle con firma,
  salud y evidencias · verificación de integridad · QR imprimible · ajustes de marca.
- **Cumpleaños**: felicitación automática con % de descuento y código único (se revisa al
  arrancar y cada hora), plantilla editable y bandeja de correos enviados.
- Multiestudio: cada estudio solo ve sus datos.

## Estructura

```
server.js              Servidor HTTP y rutas
lib/
  consents.js          Validación y registro de consentimientos (huella SHA-256)
  pdf.js               Generación del PDF (pdf-lib)
  email.js             Correos de cumpleaños (simulados o con Resend)
  content.js           Textos: servicios, cuestionario, documento informativo
  signature.js         Firma vectorial → SVG / PDF
  qr.js                QR en SVG
  db.js                Almacenamiento en data/db.json
  views/               HTML del formulario, panel y páginas públicas
  vendor/              pdf-lib y generador QR (MIT), incluidos para no depender de npm
public/                CSS y JavaScript del navegador (firma y formulario por pasos)
scripts/seed.js        Datos de demostración
data/                  Se crea al arrancar: db.json y PDFs (no se sube a Git)
```

## Enviar correos de verdad (opcional)

Por defecto los correos se guardan en **Correos enviados**. Para enviarlos de verdad,
crea una cuenta en [Resend](https://resend.com), copia `.env.example` como `.env` y rellena
`RESEND_API_KEY` y `RESEND_FROM` (con un dominio verificado en Resend).

## Enseñarla fuera de tu Wi‑Fi (opcional)

Con un túnel (por ejemplo `cloudflared tunnel --url http://localhost:3000` o `ngrok http 3000`)
obtienes una URL pública. Ponla en `.env` como `PUBLIC_URL=https://…` para que el QR la use.

## Limitaciones conocidas (se resuelven en la Fase 2)

- Base de datos en un fichero JSON y PDFs en disco, sin cifrar. → Postgres en la UE + cifrado.
- Sesiones en memoria: al reiniciar el servidor hay que volver a entrar al panel.
- Sin copias de seguridad, registro de accesos ni política de conservación de datos.
- Firma electrónica simple con evidencias; sin sellado de tiempo cualificado.
- Textos legales de ejemplo para Catalunya: **deben revisarse con un asesor** antes de usarse.
- Pendiente: contrato de encargado del tratamiento con cada estudio y versión en catalán.
