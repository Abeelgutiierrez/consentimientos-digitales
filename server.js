'use strict';
/*
 * Consentimientos Digitales · Demo (Fase 1)
 * Servidor HTTP sin dependencias externas: solo necesita Node.js 18 o superior.
 *   node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

loadEnv(path.join(__dirname, '.env'));

const db = require('./lib/db');
const util = require('./lib/util');
const pdf = require('./lib/pdf');
const consents = require('./lib/consents');
const email = require('./lib/email');
const { qrSvg } = require('./lib/qr');
const pub = require('./lib/views/public');
const panel = require('./lib/views/panel');
const { SERVICES } = require('./lib/content');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_HOURS = 12;
const sessions = new Map();

// ---------------------------------------------------------------- utilidades HTTP

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function baseUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const ip = util.lanAddresses()[0] || 'localhost';
  return `http://${ip}:${PORT}`;
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function send(res, status, body, type = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...extra });
  res.end(body);
}
const html = (res, body, status = 200) => send(res, status, body);
const json = (res, obj, status = 200) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
const redirect = (res, to, extra = {}) => { res.writeHead(303, { Location: to, ...extra }); res.end(); };

const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(res, rel) {
  const file = path.normalize(path.join(__dirname, 'public', rel));
  if (!file.startsWith(path.join(__dirname, 'public') + path.sep) || !fs.existsSync(file) || !MIME[path.extname(file)]) {
    return send(res, 404, 'No encontrado', 'text/plain; charset=utf-8');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)], 'Cache-Control': 'no-cache', ...SECURITY_HEADERS });
  fs.createReadStream(file).pipe(res);
}

function sendPdf(res, bytes, filename, download) {
  send(res, 200, bytes, 'application/pdf', {
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename.replace(/[^\w.-]/g, '_')}"`,
  });
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Mensajes cortos tras una acción (?msg=clave)
const FLASH = {
  anexo: { type: 'ok', text: 'Anexo guardado y PDF regenerado.' },
  ajustes: { type: 'ok', text: 'Ajustes guardados.' },
  cumple_cfg: { type: 'ok', text: 'Configuración de cumpleaños guardada.' },
  cumple_ok: { type: 'ok', text: 'Felicitación enviada. La tienes en «Correos enviados».' },
};

// ---------------------------------------------------------------- sesiones

function currentStudio(req) {
  const sid = util.parseCookies(req).sid;
  const s = sid && sessions.get(sid);
  if (!s || s.exp < Date.now()) return null;
  return db.q.studioById(s.studioId) || null;
}

function startSession(res, studio) {
  const sid = util.id() + util.id();
  sessions.set(sid, { studioId: studio.id, exp: Date.now() + SESSION_HOURS * 3600000 });
  return `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_HOURS * 3600}`;
}

function renderPanel(res, studio, active, view, flashKey, extraFlash) {
  const flash = extraFlash || FLASH[flashKey] || null;
  html(res, panel.shell(studio, { active, flash, ...view }));
}

// ---------------------------------------------------------------- rutas

async function handle(req, res) {
  const url = new URL(req.url, 'http://local');
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const m = (re) => re.exec(p);
  const method = req.method;
  let r;

  if (method === 'GET' && p.startsWith('/static/')) return serveStatic(res, p.slice(8));
  if (method === 'GET' && p === '/health') return json(res, { ok: true });

  // --- Público
  if (method === 'GET' && p === '/') return html(res, pub.landing(db.get().studios, baseUrl()));

  if (method === 'GET' && (r = m(/^\/s\/([\w-]+)$/))) {
    const studio = db.q.studioBySlug(r[1]);
    return studio ? html(res, pub.consentForm(studio)) : html(res, pub.notFound('Estudio no encontrado'), 404);
  }

  if (method === 'POST' && (r = m(/^\/api\/s\/([\w-]+)\/consents$/))) {
    const studio = db.q.studioBySlug(r[1]);
    if (!studio) return json(res, { error: 'Estudio no encontrado' }, 404);
    let body;
    try {
      body = await util.readForm(req);
    } catch (err) {
      return json(res, { error: err.status === 413 ? 'La firma es demasiado grande' : 'Datos no válidos' }, err.status || 400);
    }
    const result = await consents.createConsent(studio, body, { ip: util.clientIp(req), userAgent: req.headers['user-agent'] });
    if (result.errors) return json(res, { errors: result.errors }, 422);
    console.log(`  ✔ Consentimiento firmado: ${result.client.firstName} ${result.client.lastName} (${studio.name})`);
    return json(res, { ok: true, redirect: `/s/${studio.slug}/gracias/${result.consent.id}?t=${result.consent.publicToken}` }, 201);
  }

  if (method === 'GET' && (r = m(/^\/s\/([\w-]+)\/gracias\/([\w]+)$/))) {
    const studio = db.q.studioBySlug(r[1]);
    const consent = db.q.consent(r[2]);
    if (!studio || !consent || consent.studioId !== studio.id || consent.publicToken !== url.searchParams.get('t')) {
      return html(res, pub.notFound(), 404);
    }
    return html(res, pub.thanks(studio, consent, db.q.client(consent.clientId)));
  }

  if (method === 'GET' && (r = m(/^\/c\/([\w]+)\/pdf$/))) {
    const consent = db.q.consent(r[1]);
    if (!consent || consent.publicToken !== url.searchParams.get('t')) return html(res, pub.notFound(), 404);
    const bytes = pdf.readStoredPdf(consent) || await pdf.renderAndStore(consent);
    return sendPdf(res, bytes, `consentimiento-${consent.id}.pdf`, false);
  }

  // --- Acceso al panel
  if (method === 'GET' && p === '/panel/login') {
    return html(res, pub.login(db.get().studios, { slug: url.searchParams.get('estudio') }));
  }
  if (method === 'POST' && p === '/panel/login') {
    const body = await util.readForm(req);
    const studio = db.q.studioBySlug(body.slug);
    if (!studio || !util.checkPassword(String(body.password || ''), studio.salt, studio.passwordHash)) {
      return html(res, pub.login(db.get().studios, { error: 'Contraseña incorrecta', slug: body.slug }), 401);
    }
    return redirect(res, '/panel', { 'Set-Cookie': startSession(res, studio) });
  }
  if (method === 'POST' && p === '/panel/logout') {
    const sid = util.parseCookies(req).sid;
    if (sid) sessions.delete(sid);
    return redirect(res, '/panel/login', { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
  }

  // --- Panel (requiere sesión)
  if (p === '/panel' || p.startsWith('/panel/')) {
    const studio = currentStudio(req);
    if (!studio) return redirect(res, '/panel/login');
    return handlePanel(req, res, url, p, studio);
  }

  return html(res, pub.notFound(), 404);
}

async function handlePanel(req, res, url, p, studio) {
  const method = req.method;
  const msg = url.searchParams.get('msg');
  const state = db.get();
  const clients = db.q.clientsOf(studio.id);
  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const own = (consent) => consent && consent.studioId === studio.id;
  let r;
  const m = (re) => (r = re.exec(p));

  // Resumen
  if (method === 'GET' && p === '/panel') {
    const all = db.q.consentsOf(studio.id);
    const now = new Date();
    const today = util.todayIso(now);
    const monthKey = today.slice(0, 7);
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const local = (c) => util.todayIso(new Date(c.createdAt));
    const stats = {
      today: all.filter((c) => local(c) === today).length,
      week: all.filter((c) => c.createdAt >= weekAgo).length,
      month: all.filter((c) => local(c).startsWith(monthKey)).length,
      total: all.length,
      clients: clients.length,
      marketingPct: clients.length ? Math.round((clients.filter((c) => c.marketing).length / clients.length) * 100) : 0,
      pendingAnnex: all.filter((c) => c.service !== 'piercing' && !(c.annex && c.annex.inks.length)).length,
    };
    const upcoming = clients.map((client) => ({ client, days: util.daysToBirthday(client.birthDate) }))
      .filter((x) => x.days !== null && x.days <= 30).sort((a, b) => a.days - b.days).slice(0, 6);
    return renderPanel(res, studio, 'resumen', panel.dashboard(studio, { stats, recent: all.slice(0, 8), clientsById, upcoming }), msg);
  }

  // Consentimientos
  if (method === 'GET' && p === '/panel/consentimientos') {
    const q = (url.searchParams.get('q') || '').trim();
    let list = db.q.consentsOf(studio.id);
    if (q) {
      const nq = norm(q);
      list = list.filter((c) => {
        const cl = clientsById[c.clientId] || {};
        return norm([cl.firstName, cl.lastName, cl.dni, cl.email, cl.phone, c.zone, c.artist, SERVICES[c.service]?.label].join(' ')).includes(nq);
      });
    }
    return renderPanel(res, studio, 'consentimientos', panel.consentsList(studio, { consents: list, clientsById, q }), msg);
  }

  if (method === 'GET' && m(/^\/panel\/consentimientos\/(\w+)$/)) {
    const consent = db.q.consent(r[1]);
    if (!own(consent)) return html(res, pub.notFound(), 404);
    let verify = null;
    if (url.searchParams.get('verificar')) {
      const bytes = pdf.readStoredPdf(consent);
      verify = { ok: !!bytes && util.sha256(bytes) === consent.pdfHash };
    }
    return renderPanel(res, studio, 'consentimientos', panel.consentDetail(studio, { consent, client: clientsById[consent.clientId], verify }), msg);
  }

  if (method === 'GET' && m(/^\/panel\/consentimientos\/(\w+)\/pdf$/)) {
    const consent = db.q.consent(r[1]);
    if (!own(consent)) return html(res, pub.notFound(), 404);
    const cl = clientsById[consent.clientId];
    const bytes = pdf.readStoredPdf(consent) || await pdf.renderAndStore(consent);
    const name = `consentimiento-${norm(cl.firstName + '-' + cl.lastName).replace(/\s+/g, '-')}-${util.todayIso(new Date(consent.createdAt))}.pdf`;
    return sendPdf(res, bytes, name, url.searchParams.has('download'));
  }

  if (method === 'POST' && m(/^\/panel\/consentimientos\/(\w+)\/anexo$/)) {
    const consent = db.q.consent(r[1]);
    if (!own(consent)) return html(res, pub.notFound(), 404);
    await consents.updateAnnex(consent, await util.readForm(req));
    return redirect(res, `/panel/consentimientos/${consent.id}?msg=anexo`);
  }

  // Clientes
  if (method === 'GET' && p === '/panel/clientes') {
    const q = (url.searchParams.get('q') || '').trim();
    const countByClient = {};
    for (const c of db.q.consentsOf(studio.id)) countByClient[c.clientId] = (countByClient[c.clientId] || 0) + 1;
    let list = clients;
    if (q) list = list.filter((c) => norm([c.firstName, c.lastName, c.dni, c.email, c.phone].join(' ')).includes(norm(q)));
    list = list.map((client) => ({ client, days: util.daysToBirthday(client.birthDate) }))
      .sort((a, b) => a.client.lastName.localeCompare(b.client.lastName, 'es'));
    return renderPanel(res, studio, 'clientes', panel.clientsList(studio, { clients: list, q, countByClient }), msg);
  }

  if (method === 'GET' && m(/^\/panel\/clientes\/(\w+)$/)) {
    const client = clientsById[r[1]];
    if (!client) return html(res, pub.notFound(), 404);
    const mails = db.q.outboxOf(studio.id).filter((x) => x.clientId === client.id);
    return renderPanel(res, studio, 'clientes', panel.clientDetail(studio, { client, consents: db.q.consentsOfClient(client.id), mails, clientsById }), msg);
  }

  if (method === 'POST' && m(/^\/panel\/clientes\/(\w+)\/cumpleanos$/)) {
    const client = clientsById[r[1]];
    if (!client) return html(res, pub.notFound(), 404);
    const result = await email.sendBirthday(studio, client, { manual: true });
    const back = url.searchParams.get('volver') === 'cumpleanos' ? '/panel/cumpleanos' : `/panel/clientes/${client.id}`;
    if (result.error) {
      const view = back === '/panel/cumpleanos' ? birthdaysView(studio, clients) : panel.clientDetail(studio, {
        client, consents: db.q.consentsOfClient(client.id), mails: db.q.outboxOf(studio.id).filter((x) => x.clientId === client.id), clientsById,
      });
      return renderPanel(res, studio, back === '/panel/cumpleanos' ? 'cumpleanos' : 'clientes', view, null, { type: 'bad', text: result.error });
    }
    return redirect(res, `/panel/correos/${result.msg.id}?msg=cumple_ok`);
  }

  // QR
  if (method === 'GET' && p === '/panel/qr') {
    const formUrl = `${baseUrl()}/s/${studio.slug}`;
    const lanNote = process.env.PUBLIC_URL ? '' : 'El móvil tiene que estar conectado a la misma Wi‑Fi que este ordenador. Si Windows pregunta por el firewall al arrancar, permite el acceso en redes privadas.';
    return renderPanel(res, studio, 'qr', panel.qrPage(studio, { url: formUrl, svg: qrSvg(formUrl, { size: 260 }), lanNote }), msg);
  }

  // Cumpleaños
  if (method === 'GET' && p === '/panel/cumpleanos') {
    return renderPanel(res, studio, 'cumpleanos', birthdaysView(studio, clients), msg);
  }
  if (method === 'POST' && p === '/panel/cumpleanos') {
    const body = await util.readForm(req);
    const clamp = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
    studio.birthday = {
      enabled: body.enabled === 'on',
      discount: clamp(body.discount, 1, 100, 10),
      validDays: clamp(body.validDays, 1, 730, 365),
      subject: String(body.subject || '').slice(0, 150) || studio.birthday.subject,
      body: String(body.body || '').slice(0, 2000) || studio.birthday.body,
    };
    db.save();
    return redirect(res, '/panel/cumpleanos?msg=cumple_cfg');
  }
  if (method === 'GET' && p === '/panel/cumpleanos/vista-previa') {
    const sample = clients.find((c) => c.marketing) || { firstName: 'Laura', lastName: 'Ejemplo' };
    return html(res, email.birthdayEmail(studio, sample).html);
  }

  // Correos
  if (method === 'GET' && p === '/panel/correos') {
    const live = !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
    return renderPanel(res, studio, 'correos', panel.outbox(studio, { mails: db.q.outboxOf(studio.id), clientsById, live }), msg);
  }
  if (method === 'GET' && m(/^\/panel\/correos\/(\w+)$/)) {
    const mail = state.outbox.find((x) => x.id === r[1] && x.studioId === studio.id);
    if (!mail) return html(res, pub.notFound(), 404);
    return renderPanel(res, studio, 'correos', panel.mailView(studio, { mail, client: clientsById[mail.clientId] }), msg);
  }

  // Ajustes
  if (method === 'GET' && p === '/panel/ajustes') return renderPanel(res, studio, 'ajustes', panel.settings(studio), msg);
  if (method === 'POST' && p === '/panel/ajustes') {
    const b = await util.readForm(req);
    const s = (v, n) => String(v || '').trim().slice(0, n);
    studio.name = s(b.name, 80) || studio.name;
    studio.cif = s(b.cif, 20);
    studio.phone = s(b.phone, 30);
    studio.address = s(b.address, 120);
    studio.city = s(b.city, 60);
    studio.email = s(b.email, 120);
    studio.color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : studio.color;
    const artists = String(b.artists || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 30);
    if (artists.length) studio.artists = artists;
    const services = (b.services || []).filter((k) => SERVICES[k]);
    if (services.length) studio.services = services;
    if (!b.logo) studio.logo = null;
    else if (/^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/.test(b.logo) && b.logo.length < 600000) studio.logo = b.logo;
    db.save();
    return redirect(res, '/panel/ajustes?msg=ajustes');
  }

  return html(res, pub.notFound(), 404);
}

function birthdaysView(studio, clients) {
  const upcoming = clients.map((client) => ({ client, days: util.daysToBirthday(client.birthDate) }))
    .filter((x) => x.days !== null && x.days <= 60).sort((a, b) => a.days - b.days);
  const year = new Date().getFullYear();
  const sentThisYear = db.q.outboxOf(studio.id).filter((x) => x.kind === 'cumpleaños' && x.year === year && !x.manual).length;
  return panel.birthdays(studio, { upcoming, sentThisYear });
}

// ---------------------------------------------------------------- arranque

async function main() {
  db.load();
  if (!db.get().studios.length) {
    console.log('Base de datos vacía: cargando los datos de demostración…');
    await require('./scripts/seed').seed();
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) send(res, 500, pub.notFound('Ha ocurrido un error inesperado'));
      else res.end();
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n✖ El puerto ${PORT} ya está en uso. Cierra la otra instancia o arranca con otro puerto:\n   $env:PORT=3001; node server.js\n`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, HOST, async () => {
    const lan = util.lanAddresses();
    console.log('\n  Consentimientos Digitales · Demo');
    console.log('  ─────────────────────────────────────────────');
    console.log(`  En este ordenador:   http://localhost:${PORT}`);
    for (const ip of lan) console.log(`  Desde el móvil:      http://${ip}:${PORT}`);
    console.log(`  Panel del estudio:   http://localhost:${PORT}/panel   (contraseña: demo1234)`);
    console.log('  ─────────────────────────────────────────────');
    console.log('  Pulsa Ctrl+C para detener.\n');
    const sent = await email.runBirthdayJob();
    if (sent) console.log(`  🎂 ${sent} felicitación(es) de cumpleaños enviada(s) hoy.`);
  });

  setInterval(() => { email.runBirthdayJob().catch(console.error); }, 3600000).unref();
}

if (require.main === module) main();

module.exports = { handle };
