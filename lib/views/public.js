'use strict';
const { esc, fmtDateTime } = require('../util');
const { page, jsonScript, icons } = require('./layout');
const { SERVICES, HEALTH_QUESTIONS, infoDocument, declarations } = require('../content');

function landing(studios, baseUrl) {
  const cards = studios.map((s) => `
    <div class="card studio-card" style="--c:${esc(s.color)}">
      <span class="badge">${esc(s.services.map((k) => SERVICES[k].label).join(' · '))}</span>
      <h2 style="margin-top:10px">${esc(s.name)}</h2>
      <p class="muted" style="margin:0">${esc(s.city || '')}</p>
      <div class="actions">
        <a class="btn" href="/s/${esc(s.slug)}" target="_blank">Formulario del cliente ${icons.ext.replace('<svg', '<svg width="15" height="15"')}</a>
        <a class="btn ghost" href="/panel/login?estudio=${esc(s.slug)}">Panel del estudio</a>
      </div>
    </div>`).join('');

  const body = `
  <main class="landing">
    <section class="hero">
      <span class="badge accent">Demo · Fase 1</span>
      <h1 style="margin-top:12px">Consentimientos digitales para estudios y centros de estética</h1>
      <p>El cliente escanea un QR, rellena sus datos desde su móvil y firma con el dedo. El estudio recibe el PDF firmado al instante, con trazabilidad de tintas y felicitaciones de cumpleaños automáticas.</p>
    </section>
    <div class="grid-2">${cards}</div>
    <div class="grid-2" style="margin-top:16px">
      <div class="card">
        <h2>Cómo hacer la demo</h2>
        <ol class="steps-list">
          <li>Abre el <b>panel</b> de un estudio (contraseña <code>demo1234</code>) y enseña el QR.</li>
          <li>Que el cliente lo escanee con su móvil (misma Wi‑Fi) y firme.</li>
          <li>Vuelve al panel: el consentimiento aparece con su PDF y la huella SHA‑256.</li>
          <li>Añade tintas y lotes y pulsa <b>Simular cumpleaños</b> para ver el correo con el 10%.</li>
        </ol>
      </div>
      <div class="card">
        <h2>Direcciones para el móvil</h2>
        <p class="muted">El móvil debe estar en la misma red que este ordenador.</p>
        <p class="mono" style="word-break:break-all">${esc(baseUrl)}</p>
        <p class="muted" style="margin:0;font-size:.85rem">Datos de demostración ficticios. No introduzcas datos reales de clientes en esta versión.</p>
      </div>
    </div>
  </main>`;
  return page({ title: 'Consentimientos digitales · Demo', body });
}

function healthQuestion(q) {
  return `
    <div class="q" data-field="health.${q.key}">
      <div class="q-row">
        <div>${esc(q.label)}</div>
        <div class="seg" role="radiogroup" aria-label="${esc(q.label)}">
          <label><input type="radio" name="h_${q.key}" value="no"><span>No</span></label>
          <label><input type="radio" name="h_${q.key}" value="si"><span>Sí</span></label>
        </div>
      </div>
      <div class="err"></div>
    </div>`;
}

function field(name, label, input, extra = '') {
  return `<label class="field" data-field="${name}"><span>${label}</span>${input}<div class="err"></div>${extra}</label>`;
}

function consentForm(studio) {
  const services = studio.services.map((k) => ({ key: k, label: SERVICES[k].label }));
  const info = {};
  const decl = {};
  for (const k of studio.services) {
    info[k] = infoDocument(studio, k);
    decl[k] = declarations(studio, k);
  }
  const head = `<div class="pub-head">
      ${studio.logo ? `<img src="${esc(studio.logo)}" alt="">` : ''}
      <div class="name">${esc(studio.name)}</div>
      <div class="sub">Consentimiento informado</div>
    </div>`;

  const body = `
  <div class="public">
    ${head}
    <div class="pub-wrap">
      <form class="pub-card" id="consent-form" novalidate autocomplete="on">
        <div class="progress" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>

        <section class="step" data-step="0">
          <div class="step-kicker">Paso 1 de 5</div>
          <h2>Tus datos</h2>
          <p class="lead">Solo te llevará un par de minutos. Los usamos para tu ficha y para el consentimiento.</p>
          <div class="row">
            ${field('firstName', 'Nombre', '<input type="text" name="firstName" autocomplete="given-name" required>')}
            ${field('lastName', 'Apellidos', '<input type="text" name="lastName" autocomplete="family-name" required>')}
          </div>
          <div class="row">
            ${field('dni', 'DNI / NIE / Pasaporte', '<input type="text" name="dni" autocapitalize="characters" required>')}
            ${field('birthDate', 'Fecha de nacimiento', '<input type="date" name="birthDate" autocomplete="bday" required>')}
          </div>
          <div class="row">
            ${field('phone', 'Teléfono', '<input type="tel" name="phone" autocomplete="tel" inputmode="tel" required>')}
            ${field('email', 'Correo electrónico', '<input type="email" name="email" autocomplete="email" inputmode="email">')}
          </div>
          ${field('address', 'Dirección <small>(opcional)</small>', '<input type="text" name="address" autocomplete="street-address">')}
          <div id="minor-box" class="hidden">
            <div class="notice warn"><b>Eres menor de edad.</b> Necesitamos los datos y la firma de tu padre, madre o tutor legal.</div>
            <div class="row">
              ${field('minor.tutorName', 'Nombre del representante legal', '<input type="text" name="tutorName">')}
              ${field('minor.tutorDni', 'DNI del representante', '<input type="text" name="tutorDni" autocapitalize="characters">')}
            </div>
            ${field('minor.relation', 'Relación', '<select name="relation"><option value="">Elige…</option><option>Madre</option><option>Padre</option><option>Tutor/a legal</option></select>')}
            <div id="maturity-box" class="hidden" data-field="minor.maturityCert">
              <label class="check"><input type="checkbox" name="maturityCert"><div><b>Aporto el certificado de madurez</b><br><small>Obligatorio para menores de 16 años en Catalunya.</small></div></label>
              <div class="err"></div>
            </div>
          </div>
        </section>

        <section class="step hidden" data-step="1">
          <div class="step-kicker">Paso 2 de 5</div>
          <h2>¿Qué te vas a hacer?</h2>
          <p class="lead">Lo puedes completar junto a tu artista.</p>
          <div data-field="service">
            <div class="choice-grid">
              ${services.map((s, i) => `<label class="choice"><input type="radio" name="service" value="${esc(s.key)}" ${services.length === 1 || i === 0 ? 'checked' : ''}><span>${esc(s.label)}</span></label>`).join('')}
            </div>
            <div class="err"></div>
          </div>
          ${field('artist', 'Artista / aplicador', `<select name="artist"><option value="">Elige…</option>${studio.artists.map((a) => `<option>${esc(a)}</option>`).join('')}</select>`)}
          ${field('zone', 'Zona del cuerpo', '<input type="text" name="zone" placeholder="Ej.: antebrazo izquierdo">')}
          ${field('description', 'Descripción <small>(opcional)</small>', '<textarea name="description" placeholder="Ej.: rosa fine line de 8 cm"></textarea>')}
        </section>

        <section class="step hidden" data-step="2">
          <div class="step-kicker">Paso 3 de 5</div>
          <h2>Tu salud</h2>
          <p class="lead">Es confidencial y nos ayuda a saber si es seguro hacerte el servicio hoy.</p>
          ${HEALTH_QUESTIONS.map(healthQuestion).join('')}
          <div id="notes-box" class="hidden" style="margin-top:12px">
            ${field('healthNotes', 'Cuéntanos los detalles de lo que has marcado con "Sí"', '<textarea name="healthNotes"></textarea>')}
          </div>
        </section>

        <section class="step hidden" data-step="3">
          <div class="step-kicker">Paso 4 de 5</div>
          <h2>Información importante</h2>
          <p class="lead">Léela con calma. Si tienes dudas, pregunta a tu artista antes de firmar.</p>
          <div class="info-doc" id="info-doc"></div>
          <div data-field="checks.read">
            <label class="check"><input type="checkbox" name="c_read"><div id="decl-text"></div></label>
            <div class="err"></div>
          </div>
          <div data-field="checks.privacy">
            <label class="check"><input type="checkbox" name="c_privacy"><div>Acepto el tratamiento de mis datos, incluidos los de salud, según el apartado de protección de datos.</div></label>
            <div class="err"></div>
          </div>
          <div data-field="checks.marketing">
            <label class="check"><input type="checkbox" name="c_marketing"><div><span class="opt">Opcional</span><br>Quiero recibir promociones y un <b>regalo por mi cumpleaños</b> por correo electrónico.</div></label>
            <div class="err"></div>
          </div>
          <label class="check"><input type="checkbox" name="c_images"><div><span class="opt">Opcional</span><br>Autorizo publicar fotos del trabajo en las redes del estudio, sin que se me vea la cara.</div></label>
        </section>

        <section class="step hidden" data-step="4">
          <div class="step-kicker">Paso 5 de 5</div>
          <h2>Firma</h2>
          <p class="lead" id="sign-lead">Firma con el dedo dentro del recuadro.</p>
          <div class="sig-block" data-field="signature">
            <div class="label" id="sig-label">Firma</div>
            <div class="sig-pad" id="pad-main"><canvas></canvas><div class="line"></div><div class="hint">Firma aquí</div></div>
            <div class="sig-tools"><small class="muted" id="sig-date"></small><button type="button" data-clear="pad-main">Borrar</button></div>
            <div class="err"></div>
          </div>
          <div class="sig-block hidden" id="tutor-sig" data-field="tutorSignature">
            <div class="label">Firma del representante legal</div>
            <div class="sig-pad" id="pad-tutor"><canvas></canvas><div class="line"></div><div class="hint">Firma del padre, madre o tutor</div></div>
            <div class="sig-tools"><span></span><button type="button" data-clear="pad-tutor">Borrar</button></div>
            <div class="err"></div>
          </div>
          <div class="notice" style="font-size:.82rem">Al pulsar <b>Firmar y enviar</b> se generará tu consentimiento en PDF con la fecha, la hora y una huella digital que garantiza que no se puede modificar.</div>
          <div class="notice bad hidden" id="submit-error"></div>
        </section>

        <div class="nav">
          <button type="button" class="btn ghost hidden" id="prev">Atrás</button>
          <button type="button" class="btn lg" id="next">Continuar</button>
        </div>
      </form>
      <div class="legal-foot">${esc(studio.name)}${studio.cif ? ' · ' + esc(studio.cif) : ''} · Tus datos se tratan de forma confidencial.</div>
    </div>
  </div>`;

  const scripts = `<script>window.CONSENT_CONFIG = ${jsonScript({ slug: studio.slug, info, decl, questions: HEALTH_QUESTIONS.map((q) => q.key) })};</script>
<script src="/static/signature-pad.js"></script>
<script src="/static/form.js"></script>`;
  return page({ title: `Consentimiento · ${studio.name}`, body, accent: studio.color, scripts });
}

function thanks(studio, consent, client, { demo = false, panelHref = null } = {}) {
  const again = `/s/${esc(studio.slug)}${demo ? '?demo=1' : ''}`;
  const body = `
  <div class="public">
    <div class="pub-head">${studio.logo ? `<img src="${esc(studio.logo)}" alt="">` : ''}<div class="name">${esc(studio.name)}</div><div class="sub">Consentimiento informado</div></div>
    <div class="pub-wrap">
      <div class="pub-card done">
        <div class="tick">${icons.check}</div>
        <h2>¡Listo, ${esc(client.firstName)}!</h2>
        <p class="muted">Tu consentimiento se ha firmado correctamente el ${esc(fmtDateTime(consent.createdAt))}.</p>
        <p><span class="badge">Ref. ${esc(consent.id.toUpperCase())}</span></p>
        <a class="btn block lg" href="/c/${esc(consent.id)}/pdf?t=${esc(consent.publicToken)}" target="_blank">Descargar mi copia (PDF)</a>
        <p style="margin-top:16px" class="muted">Ya puedes devolver el dispositivo al estudio.</p>
        ${panelHref ? `<div class="demo-fill" style="text-align:left"><span><b>Demo</b> · Ahora mira cómo lo recibe el estudio.</span><a class="btn small" href="${esc(panelHref)}" target="_blank" rel="noopener">Ver en el panel</a></div>` : ''}
        <a class="btn ghost block" href="${again}">Nuevo consentimiento</a>
      </div>
    </div>
  </div>`;
  return page({ title: `Consentimiento firmado · ${studio.name}`, body, accent: studio.color });
}

function notFound(message = 'Página no encontrada') {
  return page({ title: message, body: `<main class="login"><div class="card"><h1>${esc(message)}</h1><p class="muted">Revisa la dirección o vuelve al inicio.</p><a class="btn" href="/">Ir al inicio</a></div></main>` });
}

function login(studios, { error, slug } = {}) {
  const body = `
  <main class="login">
    <form class="card" method="post" action="/panel/login">
      <h1>Panel del estudio</h1>
      <p class="muted">Accede para ver los consentimientos firmados.</p>
      ${error ? `<div class="notice bad">${esc(error)}</div>` : ''}
      <label class="field"><span>Estudio</span><select name="slug">${studios.map((s) => `<option value="${esc(s.slug)}" ${s.slug === slug ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Contraseña</span><input type="password" name="password" autocomplete="current-password" required autofocus></label>
      <button class="btn block lg">Entrar</button>
      <div class="demo-hint">Demo: la contraseña de todos los estudios es <code>demo1234</code></div>
      <p style="margin:14px 0 0;text-align:center"><a class="muted" href="/">← Volver al inicio</a></p>
    </form>
  </main>`;
  return page({ title: 'Acceso · Panel del estudio', body });
}

module.exports = { landing, consentForm, thanks, notFound, login };
