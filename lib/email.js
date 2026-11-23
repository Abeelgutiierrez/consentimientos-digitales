'use strict';
// Correos automáticos (felicitación de cumpleaños con descuento).
// Por defecto se "envían" a una bandeja de salida simulada que se ve en el panel.
// Si defines RESEND_API_KEY y RESEND_FROM en .env, además se envían de verdad con Resend.
const crypto = require('crypto');
const db = require('./db');
const { esc, id, fmtLongDate, daysToBirthday, todayIso } = require('./util');

function couponCode(client) {
  const base = (client.firstName || 'CLIENTE').normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6) || 'CLIENTE';
  return `CUMPLE-${base}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function fill(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function birthdayEmail(studio, client, now = new Date()) {
  const cfg = studio.birthday;
  const code = couponCode(client);
  const until = new Date(now.getTime() + cfg.validDays * 86400000);
  const vars = {
    nombre: client.firstName,
    estudio: studio.name,
    descuento: `${cfg.discount}%`,
    codigo: code,
    caducidad: fmtLongDate(todayIso(until)),
  };
  const subject = fill(cfg.subject, vars);
  const paragraphs = fill(cfg.body, vars).split(/\n\s*\n/).map((p) => `<p style="margin:0 0 14px;line-height:1.6">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const color = /^#[0-9a-f]{6}$/i.test(studio.color) ? studio.color : '#111111';
  const logo = studio.logo ? `<img src="${studio.logo}" alt="${esc(studio.name)}" style="max-height:56px;max-width:180px;margin-bottom:8px">` : `<div style="font-size:20px;font-weight:700;color:#fff">${esc(studio.name)}</div>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f3f2ef;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1d24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f2ef;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${color};padding:26px 28px;text-align:center">${logo}</td></tr>
<tr><td style="padding:30px 28px 10px;font-size:15px">
<div style="font-size:24px;font-weight:700;margin-bottom:14px">¡Feliz cumpleaños, ${esc(client.firstName)}!</div>
${paragraphs}
</td></tr>
<tr><td style="padding:6px 28px 26px" align="center">
<div style="border:2px dashed ${color};border-radius:12px;padding:18px;text-align:center">
<div style="font-size:13px;color:#6b6b76;text-transform:uppercase;letter-spacing:.08em">Tu regalo</div>
<div style="font-size:40px;font-weight:800;color:${color};line-height:1.2">${esc(cfg.discount)}% dto.</div>
<div style="font-family:Consolas,Menlo,monospace;font-size:18px;font-weight:700;letter-spacing:.06em;margin-top:6px">${esc(code)}</div>
<div style="font-size:12px;color:#6b6b76;margin-top:6px">Válido hasta el ${esc(vars.caducidad)}</div>
</div></td></tr>
<tr><td style="padding:0 28px 28px;font-size:12px;color:#8a8a94;line-height:1.5">
Recibes este correo porque aceptaste recibir comunicaciones de ${esc(studio.name)}. Si no quieres recibir más, responde a este correo con la palabra BAJA.
</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, code, validUntil: todayIso(until) };
}

async function deliver(msg) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) {
    msg.status = 'simulado';
    return msg;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html }),
    });
    msg.status = res.ok ? 'enviado' : 'error';
    if (!res.ok) msg.error = (await res.text()).slice(0, 300);
  } catch (err) {
    msg.status = 'error';
    msg.error = String(err.message || err);
  }
  return msg;
}

// Crea y entrega la felicitación. Devuelve { error } si no se puede enviar.
async function sendBirthday(studio, client, { manual = false, now = new Date() } = {}) {
  if (!client.marketing) return { error: `${client.firstName} no ha aceptado recibir comunicaciones comerciales, así que no se le puede enviar (RGPD).` };
  if (!client.email) return { error: `${client.firstName} no tiene correo electrónico.` };
  const mail = birthdayEmail(studio, client, now);
  const msg = {
    id: id('em_'), studioId: studio.id, clientId: client.id, kind: 'cumpleaños', manual,
    to: client.email, subject: mail.subject, html: mail.html, code: mail.code, validUntil: mail.validUntil,
    createdAt: now.toISOString(), year: now.getFullYear(),
  };
  await deliver(msg);
  db.get().outbox.push(msg);
  db.save();
  return { msg };
}

// Revisión automática: felicita a quien cumpla hoy (una vez al año).
async function runBirthdayJob(now = new Date()) {
  const state = db.get();
  let sent = 0;
  for (const studio of state.studios) {
    if (!studio.birthday?.enabled) continue;
    for (const client of db.q.clientsOf(studio.id)) {
      if (!client.marketing || !client.email) continue;
      if (daysToBirthday(client.birthDate, now) !== 0) continue;
      const already = state.outbox.some((m) => m.clientId === client.id && m.kind === 'cumpleaños' && !m.manual && m.year === now.getFullYear());
      if (already) continue;
      const r = await sendBirthday(studio, client, { now });
      if (r.msg) sent++;
    }
  }
  return sent;
}

module.exports = { birthdayEmail, sendBirthday, runBirthdayJob };
