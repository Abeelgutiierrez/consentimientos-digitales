'use strict';
/*
 * Portada comercial (/) y demo guiada (/demo).
 * Pensadas para enseñar el producto a un estudio sin explicaciones previas:
 * el negocio prueba los dos lados (cliente y estudio) desde un solo navegador.
 */
const { esc } = require('../util');
const { page } = require('./layout');
const { SERVICES } = require('../content');

const ACCENT = '#c2410c';

const svg = (d, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 20),
  qr: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>'),
  pen: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  doc: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 15l2 2 4-4"/>'),
  users: svg('<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>'),
  drop: svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 14h6"/>'),
  shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9"/><path d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5"/>'),
  brush: svg('<path d="M9.5 14.5L20 4"/><path d="M7 15a3 3 0 0 0-3 3c0 1.5-1 2-2 2 1 1.5 3 2 4.5 2A3.5 3.5 0 0 0 10 18.5 3 3 0 0 0 7 15z"/>'),
  child: svg('<circle cx="12" cy="6" r="3"/><path d="M8 21v-6l-2-3 3-2h6l3 2-2 3v6"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 18),
  phone: svg('<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>'),
  monitor: svg('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', 20),
  chat: svg('<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/>', 20),
};

function nav({ demoLink = true } = {}) {
  return `
  <header class="lp-nav">
    <a class="lp-logo" href="/"><span class="lp-mark">${I.check}</span>Consentimientos<b>Digitales</b></a>
    <nav>
      <a href="/#como-funciona" class="hide-sm">Cómo funciona</a>
      <a href="/#funciones" class="hide-sm">Funciones</a>
      <a href="/#preguntas" class="hide-sm">Preguntas</a>
      ${demoLink ? '<a class="lp-btn small" href="/demo">Probar la demo</a>' : '<a class="lp-btn small ghost" href="/">Volver a la portada</a>'}
    </nav>
  </header>`;
}

function contactButtons(contact, { light = false } = {}) {
  const out = [];
  if (contact.whatsapp) out.push(`<a class="lp-btn ${light ? 'light' : ''}" href="${esc(contact.whatsapp)}" target="_blank" rel="noopener">${I.chat} Escríbenos por WhatsApp</a>`);
  if (contact.email) out.push(`<a class="lp-btn ${light ? 'ghost-light' : 'ghost'}" href="mailto:${esc(contact.email)}?subject=${encodeURIComponent('Quiero los consentimientos digitales en mi estudio')}">${I.mail} ${esc(contact.email)}</a>`);
  return out.join('');
}

// Ilustración del móvil de la portada (estática, sin datos reales).
const heroPhone = `
  <div class="lp-visual" aria-hidden="true">
    <div class="lp-phone">
      <div class="lp-phone-notch"></div>
      <div class="lp-phone-head"><b>Aguja Fina Tattoo</b><small>Consentimiento informado</small></div>
      <div class="lp-phone-body">
        <div class="lp-mini-steps"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i></div>
        <small class="lp-kicker">Paso 5 de 5</small>
        <div class="lp-mini-title">Firma</div>
        <div class="lp-mini-sig">
          <svg viewBox="0 0 220 90"><path class="lp-sig-path" d="M14 62c14-30 24-44 30-40 7 5-12 40-4 42 9 2 20-34 30-34 8 0 0 28 8 28s14-22 22-22c7 0 2 18 9 18 9 0 15-16 26-16 9 0 6 12 14 12 10 0 22-10 40-14"/></svg>
          <span>Laia Puig Ferrer</span>
        </div>
        <div class="lp-mini-btn">Firmar y enviar</div>
      </div>
    </div>
    <div class="lp-toast t1"><span class="lp-toast-ico">${I.doc}</span><div><b>Nuevo consentimiento firmado</b><small>Laia Puig · Tatuaje · hace 1 s</small></div></div>
    <div class="lp-toast t2"><span class="lp-toast-ico ok">${I.shield}</span><div><b>Integridad verificada</b><small>Huella SHA-256 correcta</small></div></div>
  </div>`;

function home(studios, contact) {
  const hasContact = !!(contact.email || contact.whatsapp);
  const features = [
    [I.doc, 'PDF firmado al instante', 'Cada consentimiento llega a tu panel con los datos, el cuestionario de salud, la firma, la fecha y la hora. Lo descargas o lo imprimes cuando quieras.'],
    [I.users, 'Ficha de cada cliente', 'Historial de trabajos, consentimientos y datos de contacto. Encuentras a cualquiera en segundos, sin buscar en archivadores.'],
    [I.drop, 'Tintas y lotes', 'Apunta marca, color, lote, caducidad y nº AEMPS de cada tinta. Se añade como anexo al PDF, por si hay una alerta sanitaria.'],
    [I.child, 'Menores, bien hechos', 'Detecta la edad sola: pide datos y firma del tutor y, si tiene menos de 16 años, el certificado de madurez.'],
    [I.gift, 'Regalo de cumpleaños', 'Felicita a tus clientes con un descuento y un código único. Automático y solo si aceptaron recibir promociones.'],
    [I.brush, 'Con tu marca', 'Tu logo y tu color en el formulario, en el PDF y en los correos. Tus clientes ven tu estudio, no una app.'],
  ];
  const services = [...new Set(studios.flatMap((s) => s.services))].map((k) => SERVICES[k] && SERVICES[k].label).filter(Boolean);

  const body = `
  ${nav()}
  <main class="lp">
    <section class="lp-hero">
      <div class="lp-hero-text">
        <span class="lp-tag">Para estudios de ${esc(services.join(', ').toLowerCase() || 'tatuaje y piercing')}</span>
        <h1>Tus consentimientos, firmados en el móvil del cliente. <em>Sin papel.</em></h1>
        <p class="lp-lead">El cliente escanea un QR en el mostrador, rellena sus datos y firma con el dedo. Tú recibes el PDF firmado en tu panel al momento, con su ficha y la trazabilidad de tintas.</p>
        <div class="lp-cta-row">
          <a class="lp-btn lg" href="/demo">Probar la demo ahora ${I.arrow}</a>
          <a class="lp-btn lg ghost" href="#como-funciona">Ver cómo funciona</a>
        </div>
        <p class="lp-fine">Gratis y sin registro · 3 minutos · Datos de ejemplo</p>
      </div>
      ${heroPhone}
    </section>

    <section class="lp-band" aria-label="Ventajas principales">
      <div><b>2 min</b><span>tarda el cliente en rellenar y firmar</span></div>
      <div><b>0</b><span>papeles que archivar o escanear</span></div>
      <div><b>Al instante</b><span>el PDF en tu panel, listo para enseñar</span></div>
      <div><b>Decret 90/2008</b><span>pensado para la normativa catalana</span></div>
    </section>

    <section class="lp-section" id="problema">
      <div class="lp-head">
        <h2>¿Te suena?</h2>
        <p>El papel funciona… hasta que necesitas encontrar algo.</p>
      </div>
      <div class="lp-compare">
        <div class="lp-col bad">
          <h3>Con papel</h3>
          <ul>
            <li>${I.x} Letra ilegible y casillas sin marcar.</li>
            <li>${I.x} Archivadores que ocupan espacio y nadie encuentra.</li>
            <li>${I.x} Menores sin la firma del tutor o sin el certificado.</li>
            <li>${I.x} No sabes qué tinta y qué lote usaste con cada cliente.</li>
            <li>${I.x} Datos de salud en un cajón: un riesgo con el RGPD.</li>
          </ul>
        </div>
        <div class="lp-col good">
          <h3>Con Consentimientos Digitales</h3>
          <ul>
            <li>${I.check} El formulario no deja enviar nada incompleto.</li>
            <li>${I.check} Todo en tu panel, con buscador por nombre o DNI.</li>
            <li>${I.check} Tutor y certificado de madurez cuando toca, sin pensarlo.</li>
            <li>${I.check} Tintas y lotes anotados en cada consentimiento.</li>
            <li>${I.check} Acceso con contraseña y PDF con huella de integridad.</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="lp-section" id="como-funciona">
      <div class="lp-head">
        <h2>Cómo funciona</h2>
        <p>Tres pasos. Tu cliente no instala nada y tú tampoco.</p>
      </div>
      <ol class="lp-steps">
        <li><span class="lp-step-ico">${I.qr}</span><b>1 · Escanea el QR</b><p>Pones el QR en el mostrador. El cliente lo abre con la cámara de su móvil (o le pasas una tablet).</p></li>
        <li><span class="lp-step-ico">${I.pen}</span><b>2 · Rellena y firma</b><p>Datos, servicio, cuestionario de salud, información del procedimiento y firma con el dedo. Unos 2 minutos.</p></li>
        <li><span class="lp-step-ico">${I.doc}</span><b>3 · Lo recibes al momento</b><p>Aparece en tu panel con el PDF firmado. El cliente también puede descargarse su copia.</p></li>
      </ol>
    </section>

    <section class="lp-section" id="funciones">
      <div class="lp-head">
        <h2>Todo lo que necesita tu estudio</h2>
        <p>Más que un formulario: la ficha de tus clientes y la trazabilidad que te pide la normativa.</p>
      </div>
      <div class="lp-features">
        ${features.map(([ico, t, d]) => `<article class="lp-card"><span class="lp-card-ico">${ico}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}
      </div>
    </section>

    <section class="lp-section lp-demo-cta" id="demo">
      <div class="lp-demo-box">
        <div>
          <span class="lp-tag light">Demo completa · sin registro</span>
          <h2>Pruébalo tú mismo en 3 minutos</h2>
          <p>Haz de cliente y de estudio a la vez: firma un consentimiento y míralo llegar a tu panel. Puedes hacerlo desde el ordenador o escaneando un QR con tu móvil.</p>
          <ol class="lp-mini-list">
            <li>Firma como si fueras un cliente.</li>
            <li>Entra en el panel del estudio con un clic.</li>
            <li>Abre el PDF, anota las tintas y verifica la integridad.</li>
          </ol>
          <a class="lp-btn lg light" href="/demo">Empezar la demo ${I.arrow}</a>
        </div>
        <div class="lp-demo-sides" aria-hidden="true">
          <div><span>${I.phone}</span><b>Lado del cliente</b><small>Formulario en el móvil</small></div>
          <div><span>${I.monitor}</span><b>Lado del estudio</b><small>Panel, PDF y clientes</small></div>
        </div>
      </div>
    </section>

    <section class="lp-section" id="cumplimiento">
      <div class="lp-head">
        <h2>Tranquilidad ante una inspección</h2>
        <p>Diseñado desde el principio para la normativa de tatuaje, piercing y micropigmentación en Catalunya.</p>
      </div>
      <div class="lp-trust">
        <div><b>Decret 90/2008</b><p>Documento informativo, consentimiento, menores con tutor y certificado de madurez para menores de 16.</p></div>
        <div><b>RGPD y datos de salud</b><p>Casillas separadas para datos, promociones y fotos. Las opcionales nunca vienen marcadas.</p></div>
        <div><b>Firma con evidencias</b><p>Fecha, hora, dispositivo y una huella SHA-256 de todo lo firmado. Si alguien toca el PDF, se nota.</p></div>
      </div>
    </section>

    <section class="lp-section" id="preguntas">
      <div class="lp-head"><h2>Preguntas frecuentes</h2></div>
      <div class="lp-faq">
        <details><summary>¿Mis clientes tienen que instalar una app?</summary><p>No. Escanean el QR con la cámara y se abre una página web. Funciona en cualquier móvil.</p></details>
        <details><summary>¿Y si un cliente no tiene móvil o no quiere usarlo?</summary><p>Puedes dejar una tablet del estudio con el formulario abierto. Al terminar, el formulario se queda listo para el siguiente cliente.</p></details>
        <details><summary>¿Tiene validez la firma con el dedo?</summary><p>Es una firma electrónica simple acompañada de evidencias: fecha y hora, dispositivo, versión del texto y una huella que demuestra que el documento no se ha modificado. Los textos legales se revisan con un asesor antes de usarlos con clientes reales.</p></details>
        <details><summary>¿Puedo poner mi logo y mis colores?</summary><p>Sí. Desde «Ajustes del estudio» subes tu logo y eliges tu color, y se aplican al formulario, al PDF y a los correos. Puedes probarlo en la demo.</p></details>
        <details><summary>¿Qué pasa con los datos de salud?</summary><p>Son datos especialmente protegidos: se piden solo los necesarios, no se comparten con nadie y solo tu estudio puede verlos, con su usuario y contraseña.</p></details>
        <details><summary>¿Puedo seguir usando mis papeles mientras me adapto?</summary><p>Claro. Puedes empezar con un solo artista o un solo servicio y pasar el resto cuando te sientas cómodo.</p></details>
      </div>
    </section>

    <section class="lp-final">
      <h2>¿Lo probamos en tu estudio?</h2>
      <p>${hasContact ? 'Haz la demo y, si te encaja, te lo dejamos preparado con tu logo, tus artistas y tus servicios.' : 'Haz la demo completa en 3 minutos y comprueba cómo quedaría en tu estudio.'}</p>
      <div class="lp-cta-row center">
        <a class="lp-btn lg light" href="/demo">Probar la demo ${I.arrow}</a>
        ${contactButtons(contact, { light: true })}
      </div>
    </section>
  </main>
  <footer class="lp-foot">
    <span>Consentimientos Digitales · Para estudios de l'Anoia y de toda Catalunya</span>
    <span>Demo con datos ficticios · <a href="/panel/login">Acceso de estudios</a></span>
  </footer>`;

  return page({
    title: 'Consentimientos digitales para estudios de tatuaje y piercing',
    body,
    accent: ACCENT,
    bodyClass: 'lp-body',
    head: '<link rel="stylesheet" href="/static/landing.css"><meta name="description" content="El cliente escanea un QR, rellena sus datos y firma con el dedo. Tu estudio recibe el PDF firmado al instante. Prueba la demo gratis y sin registro.">',
  });
}

function demo(studios, studio, { phoneUrl, qr, lan, open }, contact) {
  const formSrc = `/s/${encodeURIComponent(studio.slug)}?demo=1`;
  const panelHref = open ? `/demo/entrar?estudio=${encodeURIComponent(studio.slug)}` : `/panel/login?estudio=${encodeURIComponent(studio.slug)}`;
  const tabs = studios.map((s) => `
    <a class="dm-tab ${s.id === studio.id ? 'on' : ''}" href="/demo?estudio=${encodeURIComponent(s.slug)}" style="--c:${esc(s.color)}">
      <b>${esc(s.name)}</b><small>${esc(s.services.map((k) => SERVICES[k] ? SERVICES[k].label : k).join(' · '))}</small>
    </a>`).join('');

  const body = `
  ${nav({ demoLink: false })}
  <main class="dm">
    <div class="dm-intro">
      <h1>Demo guiada</h1>
      <p>Vas a hacer de <b>cliente</b> (firmas el formulario del móvil) y de <b>estudio</b> (lo recibes en el panel). Todo es de prueba: usa datos inventados o pulsa «Rellenar con datos de ejemplo».</p>
      <div class="dm-tabs" role="list" aria-label="Elige un estudio de ejemplo">${tabs}</div>
    </div>

    <div class="dm-grid">
      <section class="dm-phone-col" aria-label="Formulario del cliente">
        <div class="dm-phone">
          <div class="lp-phone-notch"></div>
          <iframe id="dm-frame" src="${esc(formSrc)}" title="Formulario del cliente de ${esc(studio.name)}"></iframe>
        </div>
        <div class="dm-phone-tools">
          <button type="button" class="lp-btn small ghost" id="dm-restart">Empezar de nuevo</button>
          <a class="lp-btn small ghost" href="${esc(formSrc)}" target="_blank" rel="noopener">Abrir a pantalla completa</a>
        </div>
        <a class="lp-btn lg dm-open-mobile" href="${esc(formSrc)}">Abrir el formulario del cliente ${I.arrow}</a>
      </section>

      <section class="dm-guide" aria-label="Pasos de la demo">
        <ol class="dm-steps">
          <li class="dm-step" id="dm-s1" data-state="active">
            <div class="dm-num">1</div>
            <div>
              <h2>Firma como cliente</h2>
              <p>Rellena el formulario del móvil y firma con el ratón o con el dedo. Si quieres ver luego el regalo de cumpleaños, marca la casilla de <b>promociones</b> en el paso 4.</p>
              <p class="dm-status" id="dm-status" role="status">Esperando tu firma…</p>
            </div>
          </li>
          <li class="dm-step" id="dm-s2">
            <div class="dm-num">2</div>
            <div>
              <h2>Míralo como estudio</h2>
              <p>Entra en el panel de <b>${esc(studio.name)}</b> con un clic${open ? '' : ' (contraseña <code>demo1234</code>)'}. Tu consentimiento ya está ahí, con su PDF.</p>
              <a class="lp-btn" id="dm-panel" href="${esc(panelHref)}" target="_blank" rel="noopener">Abrir el panel del estudio ${I.arrow}</a>
            </div>
          </li>
          <li class="dm-step" id="dm-s3">
            <div class="dm-num">3</div>
            <div>
              <h2>Prueba lo que más te interese</h2>
              <ul class="dm-checklist">
                <li><b>Ver PDF</b> y <b>Verificar integridad</b>: la huella confirma que nadie lo ha tocado.</li>
                <li><b>Tintas y lotes</b>: anótalos en el consentimiento y el PDF se regenera con el anexo.</li>
                <li><b>Clientes</b> → abre uno → <b>Simular cumpleaños</b>: el correo con su descuento.</li>
                <li><b>Ajustes del estudio</b>: sube tu logo y tu color y vuelve a abrir el formulario.</li>
                <li><b>QR del mostrador</b>: el cartel que imprimirías para tu estudio.</li>
              </ul>
            </div>
          </li>
        </ol>

        <div class="dm-qr">
          <div class="dm-qr-img">${qr}</div>
          <div>
            <h3>¿Prefieres probarlo en tu móvil?</h3>
            <p>Escanea este QR con la cámara: es exactamente lo que verían tus clientes en el mostrador.</p>
            ${lan ? '<p class="dm-note">Tu móvil tiene que estar en la misma Wi‑Fi que este ordenador.</p>' : ''}
            <p class="dm-url">${esc(phoneUrl)}</p>
          </div>
        </div>

        ${contact.email || contact.whatsapp ? `<div class="dm-contact"><b>¿Te encaja?</b><span>Te lo dejamos listo con tu logo, tus artistas y tus servicios.</span><div class="lp-cta-row">${contactButtons(contact)}</div></div>` : ''}
      </section>
    </div>
  </main>`;

  const config = JSON.stringify({ slug: studio.slug, open }).replace(/</g, '\\u003c');
  return page({
    title: `Demo guiada · ${studio.name}`,
    body,
    accent: ACCENT,
    bodyClass: 'lp-body',
    head: '<link rel="stylesheet" href="/static/landing.css">',
    scripts: `<script>window.DEMO_CONFIG = ${config};</script><script src="/static/demo.js"></script>`,
  });
}

module.exports = { home, demo };
