'use strict';
const { esc, fmtDate, fmtDateTime, fmtLongDate, daysToBirthday, ageOn } = require('../util');
const { page, icons, jsonScript } = require('./layout');
const { SERVICES, HEALTH_QUESTIONS } = require('../content');
const signature = require('../signature');

const NAV = [
  ['resumen', '/panel', 'Resumen', icons.home],
  ['consentimientos', '/panel/consentimientos', 'Consentimientos', icons.doc],
  ['clientes', '/panel/clientes', 'Clientes', icons.users],
  ['qr', '/panel/qr', 'QR del mostrador', icons.qr],
  ['cumpleanos', '/panel/cumpleanos', 'Cumpleaños', icons.gift],
  ['correos', '/panel/correos', 'Correos enviados', icons.mail],
  ['ajustes', '/panel/ajustes', 'Ajustes del estudio', icons.cog],
];

function shell(studio, { active, title, sub = '', actions = '', content, flash = null, scripts = '', demo = false }) {
  const initials = studio.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const body = `
  <div class="panel">
    <aside class="side">
      <div class="brand">
        <div class="dot">${studio.logo ? `<img src="${esc(studio.logo)}" alt="">` : esc(initials)}</div>
        <div><b>${esc(studio.name)}</b><small>Panel del estudio</small></div>
      </div>
      <nav>${NAV.map(([key, href, label, icon]) => `<a href="${href}" class="${key === active ? 'on' : ''}">${icon}<span>${label}</span></a>`).join('')}</nav>
      <div class="bottom">
        <p><a href="/s/${esc(studio.slug)}" target="_blank">Abrir formulario ↗</a></p>
        <form method="post" action="/panel/logout"><button class="btn ghost small" style="color:#c9c8d3;border-color:#33333f">Cerrar sesión</button></form>
      </div>
    </aside>
    <main class="main">
      ${demo ? `<div class="demo-bar"><span><b>Modo demo</b> · Datos ficticios: todo lo que hagas aquí es de prueba.</span><a href="/demo?estudio=${esc(studio.slug)}">← Volver a la guía</a></div>` : ''}
      <div class="topbar">
        <div><h1>${esc(title)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div>
      </div>
      ${content}
    </main>
  </div>
  ${flash ? `<div class="notice ${esc(flash.type || 'ok')} flash" role="status">${esc(flash.text)}</div><script>setTimeout(function(){var f=document.querySelector('.flash');if(f)f.remove()},5000)</script>` : ''}
  <script>
    document.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-href]');
      if (tr && !e.target.closest('a,button,form')) window.location.href = tr.getAttribute('data-href');
    });
  </script>`;
  return page({ title: `${title} · ${studio.name}`, body, accent: studio.color, scripts });
}

const svcLabel = (k) => (SERVICES[k] ? SERVICES[k].label : k);
const fullName = (c) => `${c.firstName} ${c.lastName}`;

function birthdayBadge(days) {
  if (days === null) return '';
  if (days === 0) return '<span class="badge warn">¡Hoy!</span>';
  if (days === 1) return '<span class="badge accent">Mañana</span>';
  return `<span class="badge">En ${days} días</span>`;
}

function consentRows(consents, clientsById, { showClient = true } = {}) {
  if (!consents.length) return '<div class="empty">Todavía no hay consentimientos.</div>';
  return `<table class="list"><thead><tr>${showClient ? '<th>Cliente</th>' : ''}<th>Servicio</th><th>Artista</th><th>Fecha</th><th>Trazabilidad</th></tr></thead><tbody>
  ${consents.map((c) => {
    const cl = clientsById[c.clientId];
    const flags = Object.values(c.health).some(Boolean) ? ' <span class="badge warn" title="Ha marcado alguna pregunta de salud">Salud</span>' : '';
    const minor = c.minor ? ' <span class="badge accent">Menor</span>' : '';
    return `<tr class="link" data-href="/panel/consentimientos/${esc(c.id)}">
      ${showClient ? `<td><b>${esc(cl ? fullName(cl) : '—')}</b>${minor}${flags}<br><small class="muted">${esc(cl ? cl.dni : '')}</small></td>` : ''}
      <td>${esc(svcLabel(c.service))}<br><small class="muted">${esc(c.zone)}</small></td>
      <td>${esc(c.artist)}</td>
      <td>${esc(fmtDateTime(c.createdAt))}</td>
      <td>${c.annex && c.annex.inks.length ? '<span class="badge ok">Tintas anotadas</span>' : '<span class="badge">Pendiente</span>'}</td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

function dashboard(studio, { stats, recent, clientsById, upcoming }) {
  const content = `
  <div class="stats">
    <div class="stat"><div class="k">Firmados hoy</div><div class="v">${stats.today}</div><div class="s">${stats.week} en los últimos 7 días</div></div>
    <div class="stat"><div class="k">Este mes</div><div class="v">${stats.month}</div><div class="s">${stats.total} en total</div></div>
    <div class="stat"><div class="k">Clientes en la ficha</div><div class="v">${stats.clients}</div><div class="s">${stats.marketingPct}% aceptan promociones</div></div>
    <div class="stat"><div class="k">Tintas pendientes</div><div class="v">${stats.pendingAnnex}</div><div class="s">consentimientos sin lote anotado</div></div>
  </div>
  <div class="cols">
    <div class="card">
      <h2>Últimos consentimientos <a class="btn ghost small" href="/panel/consentimientos">Ver todos</a></h2>
      ${consentRows(recent, clientsById)}
    </div>
    <div>
      <div class="card">
        <h2>Próximos cumpleaños <a class="btn ghost small" href="/panel/cumpleanos">Configurar</a></h2>
        ${upcoming.length ? `<table class="list"><tbody>${upcoming.map(({ client, days }) => `
          <tr class="link" data-href="/panel/clientes/${esc(client.id)}"><td><b>${esc(fullName(client))}</b><br><small class="muted">${esc(fmtDate(client.birthDate).slice(0, 5))} · ${client.marketing ? 'recibirá el regalo' : 'sin permiso de promociones'}</small></td><td style="text-align:right">${birthdayBadge(days)}</td></tr>`).join('')}
        </tbody></table>` : '<div class="empty">Nadie cumple años en los próximos 30 días.</div>'}
      </div>
      <div class="card">
        <h2>Formulario del estudio</h2>
        <p class="muted" style="font-size:.9rem">Imprime el QR y déjalo en el mostrador, o abre el formulario en una tablet.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn small" href="/panel/qr">Ver QR</a><a class="btn ghost small" href="/s/${esc(studio.slug)}" target="_blank">Abrir formulario ↗</a></div>
      </div>
    </div>
  </div>`;
  return { title: `Hola, ${studio.name}`, sub: 'Resumen de la actividad del estudio', content };
}

function searchBox(action, q, placeholder) {
  return `<form class="search" method="get" action="${action}"><input type="search" name="q" value="${esc(q || '')}" placeholder="${esc(placeholder)}"><button class="btn ghost">Buscar</button>${q ? `<a class="btn ghost" href="${action}">Limpiar</a>` : ''}</form>`;
}

function consentsList(studio, { consents, clientsById, q }) {
  return {
    title: 'Consentimientos',
    sub: `${consents.length} ${consents.length === 1 ? 'resultado' : 'resultados'}`,
    content: `<div class="card">${searchBox('/panel/consentimientos', q, 'Buscar por nombre, DNI, zona o artista…')}${consentRows(consents, clientsById)}</div>`,
  };
}

function consentDetail(studio, { consent, client, verify }) {
  const c = consent;
  const a = c.annex || { inks: [], needles: '', notes: '', applicator: c.artist };
  const inks = a.inks.length ? a.inks : [{}];
  const inkRow = (ink) => `<tr>
    <td><input type="text" name="brand[]" value="${esc(ink.brand)}" placeholder="Marca"></td>
    <td><input type="text" name="color[]" value="${esc(ink.color)}" placeholder="Color"></td>
    <td><input type="text" name="lot[]" value="${esc(ink.lot)}" placeholder="Lote"></td>
    <td><input type="date" name="expiry[]" value="${esc(ink.expiry)}"></td>
    <td><input type="text" name="aemps[]" value="${esc(ink.aemps)}" placeholder="Nº AEMPS"></td>
  </tr>`;
  const yes = HEALTH_QUESTIONS.filter((qn) => c.health[qn.key]);
  const verifyHtml = verify
    ? (verify.ok ? '<div class="notice ok"><b>Íntegro.</b> El PDF guardado coincide con la huella registrada: no se ha modificado.</div>' : '<div class="notice bad"><b>Atención.</b> El PDF guardado no coincide con la huella registrada.</div>')
    : '';
  const content = `
  ${verifyHtml}
  <div class="cols">
    <div>
      <div class="card">
        <h2>Persona usuaria ${c.minor ? '<span class="badge accent">Menor de edad</span>' : ''}</h2>
        <dl class="kv">
          <dt>Nombre</dt><dd><a href="/panel/clientes/${esc(client.id)}">${esc(fullName(client))}</a></dd>
          <dt>Documento</dt><dd>${esc(client.dni)}</dd>
          <dt>Nacimiento</dt><dd>${esc(fmtDate(client.birthDate))} · ${esc(c.ageAtSigning)} años al firmar</dd>
          <dt>Contacto</dt><dd>${esc(client.phone)}${client.email ? ' · ' + esc(client.email) : ''}</dd>
          ${c.minor ? `<dt>Representante</dt><dd>${esc(c.minor.tutorName)} (${esc(c.minor.relation)}) · ${esc(c.minor.tutorDni)}${c.ageAtSigning < 16 ? ` · Certificado de madurez: ${c.minor.maturityCert ? 'aportado' : 'no'}` : ''}</dd>` : ''}
        </dl>
      </div>
      <div class="card">
        <h2>Servicio</h2>
        <dl class="kv">
          <dt>Tipo</dt><dd>${esc(svcLabel(c.service))}</dd>
          <dt>Zona</dt><dd>${esc(c.zone)}</dd>
          <dt>Artista</dt><dd>${esc(c.artist)}</dd>
          <dt>Descripción</dt><dd>${esc(c.description || '—')}</dd>
        </dl>
      </div>
      <div class="card">
        <h2>Salud ${yes.length ? `<span class="badge warn">${yes.length} ${yes.length === 1 ? 'respuesta' : 'respuestas'} con "Sí"</span>` : '<span class="badge ok">Sin incidencias</span>'}</h2>
        <ul class="health">${HEALTH_QUESTIONS.map((qn) => `<li><span>${esc(qn.label)}</span><b style="color:${c.health[qn.key] ? '#c2410c' : 'var(--ok)'}">${c.health[qn.key] ? 'Sí' : 'No'}</b></li>`).join('')}</ul>
        ${c.healthNotes ? `<div class="notice warn" style="margin:12px 0 0"><b>Observaciones:</b> ${esc(c.healthNotes)}</div>` : ''}
      </div>
      <form class="card" method="post" action="/panel/consentimientos/${esc(c.id)}/anexo">
        <h2>Trazabilidad de tintas y material <span class="muted" style="font-size:.8rem;font-weight:500">Se añade como anexo al PDF</span></h2>
        <div style="overflow-x:auto"><table class="list ink-table"><thead><tr><th>Marca</th><th>Color</th><th>Lote</th><th>Caducidad</th><th>Nº registro AEMPS</th></tr></thead><tbody id="inks">${inks.map(inkRow).join('')}</tbody></table></div>
        <button type="button" class="btn ghost small" id="add-ink" style="margin:8px 0 14px">+ Añadir tinta</button>
        <div class="row">
          <label class="field"><span>Aplicador/a</span><input type="text" name="applicator" value="${esc(a.applicator || c.artist)}"></label>
          <label class="field"><span>Agujas / material</span><input type="text" name="needles" value="${esc(a.needles)}" placeholder="Ej.: cartuchos 3RL y 7M1, lote 2291"></label>
        </div>
        <label class="field"><span>Observaciones</span><textarea name="notes">${esc(a.notes)}</textarea></label>
        <button class="btn">Guardar y regenerar PDF</button>
        ${c.annex ? `<small class="muted" style="margin-left:10px">Última actualización: ${esc(fmtDateTime(c.annex.updatedAt))}</small>` : ''}
      </form>
    </div>
    <div>
      <div class="card">
        <h2>Firma</h2>
        <div class="sig-view">${signature.toSvg(c.signature)}</div>
        ${c.tutorSignature ? `<p class="muted" style="margin:12px 0 6px;font-size:.85rem">Representante legal</p><div class="sig-view">${signature.toSvg(c.tutorSignature)}</div>` : ''}
        <p class="muted" style="margin-top:10px;font-size:.85rem">Firmado el ${esc(fmtDateTime(c.evidence.signedAt))} desde ${esc(c.evidence.ip || '—')}</p>
      </div>
      <div class="card">
        <h2>Autorizaciones</h2>
        <ul class="health">
          <li><span>Ha leído la información</span>${c.checks.read ? '<span class="badge ok">Sí</span>' : '<span class="badge bad">No</span>'}</li>
          <li><span>Tratamiento de datos</span>${c.checks.privacy ? '<span class="badge ok">Sí</span>' : '<span class="badge bad">No</span>'}</li>
          <li><span>Promociones y cumpleaños</span>${c.checks.marketing ? '<span class="badge ok">Sí</span>' : '<span class="badge">No</span>'}</li>
          <li><span>Fotos en redes</span>${c.checks.images ? '<span class="badge ok">Sí</span>' : '<span class="badge">No</span>'}</li>
        </ul>
      </div>
      <div class="card">
        <h2>Evidencias</h2>
        <p class="muted" style="font-size:.85rem;margin-bottom:6px">Huella SHA‑256 de los datos firmados</p>
        <div class="hash">${esc(c.evidence.signHash)}</div>
        <p class="muted" style="font-size:.85rem;margin:12px 0 6px">Huella SHA‑256 del PDF (versión ${esc(c.pdfVersion)})</p>
        <div class="hash">${esc(c.pdfHash)}</div>
        <p class="muted" style="font-size:.8rem;margin:12px 0 0">Dispositivo: ${esc(c.evidence.userAgent || '—')}</p>
      </div>
    </div>
  </div>`;
  const actions = `
    <a class="btn" href="/panel/consentimientos/${esc(c.id)}/pdf" target="_blank">Ver PDF</a>
    <a class="btn ghost" href="/panel/consentimientos/${esc(c.id)}/pdf?download=1">Descargar</a>
    <a class="btn ghost" href="/panel/consentimientos/${esc(c.id)}?verificar=1">Verificar integridad</a>`;
  const scripts = `<script>
    document.getElementById('add-ink').addEventListener('click', function () {
      var tb = document.getElementById('inks');
      var tr = tb.rows[tb.rows.length - 1].cloneNode(true);
      Array.prototype.forEach.call(tr.querySelectorAll('input'), function (i) { i.value = ''; });
      tb.appendChild(tr);
      tr.querySelector('input').focus();
    });
  </script>`;
  return { title: `${svcLabel(c.service)} · ${fullName(client)}`, sub: `Ref. ${esc(c.id.toUpperCase())} · ${esc(fmtDateTime(c.createdAt))}`, actions, content, scripts };
}

function clientsList(studio, { clients, q, countByClient }) {
  const rows = clients.length ? `<table class="list"><thead><tr><th>Cliente</th><th>Contacto</th><th>Cumpleaños</th><th>Promociones</th><th>Servicios</th></tr></thead><tbody>
    ${clients.map(({ client, days }) => `<tr class="link" data-href="/panel/clientes/${esc(client.id)}">
      <td><b>${esc(fullName(client))}</b><br><small class="muted">${esc(client.dni)}</small></td>
      <td>${esc(client.phone)}<br><small class="muted">${esc(client.email || 'sin correo')}</small></td>
      <td>${esc(fmtDate(client.birthDate).slice(0, 5))} ${days <= 30 ? birthdayBadge(days) : ''}</td>
      <td>${client.marketing ? '<span class="badge ok">Acepta</span>' : '<span class="badge">No</span>'}</td>
      <td>${countByClient[client.id] || 0}</td>
    </tr>`).join('')}</tbody></table>` : '<div class="empty">No hay clientes con ese criterio.</div>';
  return {
    title: 'Clientes',
    sub: `${clients.length} ${clients.length === 1 ? 'cliente' : 'clientes'} · se crean automáticamente al firmar`,
    content: `<div class="card">${searchBox('/panel/clientes', q, 'Buscar por nombre, DNI, teléfono o correo…')}${rows}</div>`,
  };
}

function clientDetail(studio, { client, consents, mails, clientsById }) {
  const days = daysToBirthday(client.birthDate);
  const content = `
  <div class="cols">
    <div>
      <div class="card"><h2>Consentimientos firmados</h2>${consentRows(consents, clientsById, { showClient: false })}</div>
      <div class="card"><h2>Correos enviados</h2>
        ${mails.length ? `<table class="list"><tbody>${mails.map((m) => `<tr class="link" data-href="/panel/correos/${esc(m.id)}"><td><b>${esc(m.subject)}</b><br><small class="muted">${esc(fmtDateTime(m.createdAt))} · código ${esc(m.code)}</small></td><td style="text-align:right"><span class="badge ${m.status === 'enviado' ? 'ok' : m.status === 'error' ? 'bad' : ''}">${esc(m.status)}</span></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Ningún correo enviado todavía.</div>'}
      </div>
    </div>
    <div>
      <div class="card"><h2>Ficha</h2>
        <dl class="kv">
          <dt>Documento</dt><dd>${esc(client.dni)}</dd>
          <dt>Nacimiento</dt><dd>${esc(fmtDate(client.birthDate))} (${esc(ageOn(client.birthDate))} años)</dd>
          <dt>Teléfono</dt><dd>${esc(client.phone)}</dd>
          <dt>Correo</dt><dd>${esc(client.email || '—')}</dd>
          <dt>Cliente desde</dt><dd>${esc(fmtDate(client.createdAt))}</dd>
          <dt>Promociones</dt><dd>${client.marketing ? `<span class="badge ok">Acepta</span> <small class="muted">desde ${esc(fmtDate(client.marketingAt))}</small>` : '<span class="badge">No acepta</span>'}</dd>
        </dl>
      </div>
      <div class="card"><h2>Cumpleaños ${birthdayBadge(days)}</h2>
        <p class="muted" style="font-size:.9rem">${esc(fmtLongDate(client.birthDate).replace(/ de \d{4}$/, ''))}. ${client.marketing ? 'Recibirá automáticamente su regalo ese día.' : 'No recibirá el regalo porque no aceptó las promociones.'}</p>
        <form method="post" action="/panel/clientes/${esc(client.id)}/cumpleanos"><button class="btn block">Simular cumpleaños ahora</button></form>
      </div>
    </div>
  </div>`;
  return { title: fullName(client), sub: `${consents.length} ${consents.length === 1 ? 'servicio' : 'servicios'} en el estudio`, content };
}

function qrPage(studio, { url, svg, lanNote }) {
  const content = `
  <div class="cols">
    <div class="qr-poster" id="poster">
      <div class="top">${studio.logo ? `<img src="${esc(studio.logo)}" alt="">` : ''}<div class="t">${esc(studio.name)}</div></div>
      <div class="body">
        ${svg}
        <div class="big">Escanea y firma tu consentimiento</div>
        <p class="muted">Abre la cámara del móvil, apunta al código y sigue los pasos. Tardarás menos de 3 minutos.</p>
      </div>
    </div>
    <div class="card no-print">
      <h2>Cómo usarlo</h2>
      <ol class="steps-list">
        <li>Imprime este cartel y déjalo en el mostrador.</li>
        <li>El cliente lo escanea con su móvil y rellena el formulario.</li>
        <li>El consentimiento aparece al instante en el panel.</li>
      </ol>
      <p class="label">Dirección del formulario</p>
      <div class="hash">${esc(url)}</div>
      ${lanNote ? `<div class="notice warn" style="margin-top:12px;font-size:.85rem">${lanNote}</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn" onclick="window.print()">Imprimir cartel</button><a class="btn ghost" href="${esc(url)}" target="_blank">Probar enlace ↗</a></div>
    </div>
  </div>`;
  return { title: 'QR del mostrador', sub: 'El cliente lo escanea y firma desde su móvil', content };
}

function birthdays(studio, { upcoming, sentThisYear }) {
  const b = studio.birthday;
  const content = `
  <div class="cols">
    <form class="card" method="post" action="/panel/cumpleanos">
      <h2>Felicitación automática</h2>
      <p class="muted" style="font-size:.9rem">El día del cumpleaños se envía un correo con un código de descuento a quien haya aceptado recibir promociones al firmar el consentimiento.</p>
      <label class="check"><input type="checkbox" name="enabled" ${b.enabled ? 'checked' : ''}><div><b>Activar felicitaciones automáticas</b><br><small class="muted">Se revisa cada hora mientras el servidor está encendido.</small></div></label>
      <div class="row">
        <label class="field"><span>Descuento (%)</span><input type="number" name="discount" min="1" max="100" value="${esc(b.discount)}"></label>
        <label class="field"><span>Validez del código (días)</span><input type="number" name="validDays" min="1" max="730" value="${esc(b.validDays)}"></label>
      </div>
      <label class="field"><span>Asunto</span><input type="text" name="subject" value="${esc(b.subject)}"></label>
      <label class="field"><span>Mensaje</span><textarea name="body" rows="7">${esc(b.body)}</textarea></label>
      <p class="muted" style="font-size:.8rem">Variables: <code>{nombre}</code> <code>{estudio}</code> <code>{descuento}</code> <code>{codigo}</code> <code>{caducidad}</code></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn">Guardar</button><a class="btn ghost" href="/panel/cumpleanos/vista-previa" target="_blank">Vista previa del correo ↗</a></div>
    </form>
    <div class="card">
      <h2>Próximos 60 días</h2>
      <p class="muted" style="font-size:.85rem">${sentThisYear} felicitaciones enviadas este año.</p>
      ${upcoming.length ? `<table class="list"><tbody>${upcoming.map(({ client, days }) => `
        <tr><td><a href="/panel/clientes/${esc(client.id)}"><b>${esc(fullName(client))}</b></a><br><small class="muted">${esc(fmtDate(client.birthDate).slice(0, 5))} · ${client.marketing ? 'acepta promociones' : '<span style="color:var(--bad)">no acepta promociones</span>'}</small></td>
        <td style="text-align:right">${birthdayBadge(days)}<form method="post" action="/panel/clientes/${esc(client.id)}/cumpleanos?volver=cumpleanos" style="margin-top:6px"><button class="btn ghost small" ${client.marketing && client.email ? '' : 'disabled title="Sin permiso de promociones o sin correo"'}>Simular</button></form></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nadie cumple años en los próximos 60 días.</div>'}
    </div>
  </div>`;
  return { title: 'Cumpleaños', sub: 'Fideliza con un regalo automático', content };
}

function outbox(studio, { mails, clientsById, live }) {
  const content = `
  ${live ? '' : '<div class="notice">Modo demo: los correos se guardan aquí en lugar de enviarse. Configura <code>RESEND_API_KEY</code> y <code>RESEND_FROM</code> en <code>.env</code> para enviarlos de verdad.</div>'}
  <div class="card">
    ${mails.length ? `<table class="list"><thead><tr><th>Para</th><th>Asunto</th><th>Código</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>
    ${mails.map((m) => `<tr class="link" data-href="/panel/correos/${esc(m.id)}">
      <td><b>${esc(clientsById[m.clientId] ? fullName(clientsById[m.clientId]) : '')}</b><br><small class="muted">${esc(m.to)}</small></td>
      <td>${esc(m.subject)}${m.manual ? ' <span class="badge">simulación</span>' : ''}</td>
      <td class="mono">${esc(m.code)}</td>
      <td>${esc(fmtDateTime(m.createdAt))}</td>
      <td><span class="badge ${m.status === 'enviado' ? 'ok' : m.status === 'error' ? 'bad' : ''}">${esc(m.status)}</span></td>
    </tr>`).join('')}</tbody></table>` : '<div class="empty">Todavía no se ha enviado ningún correo. Prueba a <a href="/panel/cumpleanos">simular un cumpleaños</a>.</div>'}
  </div>`;
  return { title: 'Correos enviados', sub: 'Felicitaciones de cumpleaños y promociones', content };
}

function mailView(studio, { mail, client }) {
  const content = `
  <div class="card" style="margin-bottom:18px">
    <dl class="kv"><dt>Para</dt><dd>${esc(client ? fullName(client) : '')} &lt;${esc(mail.to)}&gt;</dd><dt>Asunto</dt><dd>${esc(mail.subject)}</dd><dt>Código</dt><dd class="mono">${esc(mail.code)} · válido hasta ${esc(fmtDate(mail.validUntil))}</dd><dt>Estado</dt><dd>${esc(mail.status)}${mail.error ? ' · ' + esc(mail.error) : ''}</dd></dl>
  </div>
  <iframe class="mail-frame" sandbox="" srcdoc="${esc(mail.html)}" title="Vista del correo"></iframe>`;
  return { title: 'Correo de cumpleaños', sub: esc(fmtDateTime(mail.createdAt)), actions: '<a class="btn ghost" href="/panel/correos">← Volver</a>', content };
}

const PALETTE = ['#111111', '#7a1f2b', '#b4532a', '#1f4d3a', '#1e3a5f', '#5b3f8c', '#c2185b', '#d4a373'];

function settings(studio) {
  const content = `
  <form class="cols" method="post" action="/panel/ajustes" id="settings">
    <div class="card">
      <h2>Datos del estudio</h2>
      <p class="muted" style="font-size:.88rem">Aparecen en el formulario, en el PDF y en los correos.</p>
      <label class="field"><span>Nombre comercial</span><input type="text" name="name" value="${esc(studio.name)}" required></label>
      <div class="row">
        <label class="field"><span>CIF / NIF</span><input type="text" name="cif" value="${esc(studio.cif)}"></label>
        <label class="field"><span>Teléfono</span><input type="text" name="phone" value="${esc(studio.phone)}"></label>
      </div>
      <div class="row">
        <label class="field"><span>Dirección</span><input type="text" name="address" value="${esc(studio.address)}"></label>
        <label class="field"><span>Población</span><input type="text" name="city" value="${esc(studio.city)}"></label>
      </div>
      <label class="field"><span>Correo para ejercer derechos RGPD</span><input type="email" name="email" value="${esc(studio.email)}"></label>
      <label class="field"><span>Artistas / aplicadores (uno por línea)</span><textarea name="artists" rows="4">${esc(studio.artists.join('\n'))}</textarea></label>
      <div class="field"><span class="label">Servicios que ofrece</span>
        ${Object.entries(SERVICES).map(([k, s]) => `<label class="check"><input type="checkbox" name="services[]" value="${k}" ${studio.services.includes(k) ? 'checked' : ''}><div>${esc(s.label)}</div></label>`).join('')}
      </div>
    </div>
    <div class="card">
      <h2>Imagen de marca</h2>
      <div class="field"><span class="label">Color principal</span>
        <div style="display:flex;gap:10px;align-items:center"><input type="color" name="color" value="${esc(studio.color)}" style="width:54px;height:40px;padding:2px;border:1px solid var(--line);border-radius:8px"><code id="color-code">${esc(studio.color)}</code></div>
        <div class="swatches">${PALETTE.map((c) => `<button type="button" style="background:${c}" data-color="${c}" aria-label="Color ${c}"></button>`).join('')}</div>
      </div>
      <div class="field"><span class="label">Logo (PNG o JPG, máx. 400 KB)</span>
        <div id="logo-preview" style="background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:14px;text-align:center;min-height:80px;margin-bottom:8px">${studio.logo ? `<img src="${esc(studio.logo)}" style="max-height:70px;max-width:100%">` : '<span class="muted">Sin logo</span>'}</div>
        <input type="file" id="logo-file" accept="image/png,image/jpeg">
        <input type="hidden" name="logo" id="logo-data" value="${esc(studio.logo || '')}">
        <button type="button" class="btn ghost small" id="logo-remove" style="margin-top:8px">Quitar logo</button>
      </div>
      <button class="btn lg block">Guardar cambios</button>
      <p class="muted" style="font-size:.82rem;margin-top:12px">Los cambios se aplican a los consentimientos nuevos. Los ya firmados conservan su PDF original.</p>
    </div>
  </form>`;
  const scripts = `<script>
    (function () {
      var color = document.querySelector('input[name=color]');
      var code = document.getElementById('color-code');
      color.addEventListener('input', function () { code.textContent = color.value; document.documentElement.style.setProperty('--accent', color.value); });
      Array.prototype.forEach.call(document.querySelectorAll('[data-color]'), function (b) {
        b.addEventListener('click', function () { color.value = b.getAttribute('data-color'); color.dispatchEvent(new Event('input')); });
      });
      var file = document.getElementById('logo-file');
      var data = document.getElementById('logo-data');
      var prev = document.getElementById('logo-preview');
      file.addEventListener('change', function () {
        var f = file.files[0];
        if (!f) return;
        if (f.size > 400 * 1024) { alert('El logo pesa más de 400 KB. Usa una imagen más ligera.'); file.value = ''; return; }
        var r = new FileReader();
        r.onload = function () { data.value = r.result; prev.innerHTML = '<img src="' + r.result + '" style="max-height:70px;max-width:100%">'; };
        r.readAsDataURL(f);
      });
      document.getElementById('logo-remove').addEventListener('click', function () { data.value = ''; file.value = ''; prev.innerHTML = '<span class="muted">Sin logo</span>'; });
    })();
  </script>`;
  return { title: 'Ajustes del estudio', sub: 'Personaliza el formulario, el PDF y los correos', content, scripts };
}

module.exports = {
  shell, dashboard, consentsList, consentDetail, clientsList, clientDetail, qrPage, birthdays, outbox, mailView, settings, jsonScript,
};
