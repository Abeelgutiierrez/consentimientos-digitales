'use strict';
// Utilidades compartidas: escape HTML, ids, cookies, lectura de body, fechas.
const crypto = require('crypto');
const os = require('os');

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function id(prefix = '') {
  return prefix + crypto.randomBytes(6).toString('hex');
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// JSON con claves ordenadas: la misma información siempre produce el mismo hash.
function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { salt, hash };
}

function checkPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 32);
  const stored = Buffer.from(hash, 'hex');
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function readBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Cuerpo demasiado grande'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readForm(req) {
  const raw = await readBody(req);
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) return raw ? JSON.parse(raw) : {};
  const params = new URLSearchParams(raw);
  const out = {};
  for (const [k, v] of params) {
    if (k.endsWith('[]')) (out[k.slice(0, -2)] = out[k.slice(0, -2)] || []).push(v);
    else out[k] = v;
  }
  return out;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  let ip = (fwd ? fwd.split(',')[0] : req.socket.remoteAddress) || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

// Direcciones de la red local, la Wi‑Fi primero: es la que usará el móvil al escanear el QR.
// Se dejan al final los adaptadores virtuales (WSL, Hyper‑V, VirtualBox, Docker…) y se descartan
// las autoasignadas (169.254.x.x), que no sirven para conectar.
function lanAddresses() {
  const rank = (name, ip) => {
    if (/wi-?fi|wlan|wireless|inal[aá]mbrica/i.test(name)) return 0;
    if (/vethernet|virtual|vmware|vbox|wsl|hyper-v|docker|br-|vpn|tailscale|zerotier/i.test(name) || /^192\.168\.56\./.test(ip)) return 2;
    return 1;
  };
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push({ ip: a.address, r: rank(name, a.address) });
    }
  }
  return out.sort((a, b) => a.r - b.r).map((x) => x.ip);
}

function ageOn(birthDate, ref = new Date()) {
  const b = new Date(birthDate + 'T00:00:00');
  if (Number.isNaN(b.getTime())) return null;
  let age = ref.getFullYear() - b.getFullYear();
  const m = ref.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) age--;
  return age;
}

// Días que faltan para el próximo cumpleaños (0 = hoy).
function daysToBirthday(birthDate, ref = new Date()) {
  const b = new Date(birthDate + 'T00:00:00');
  if (Number.isNaN(b.getTime())) return null;
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  return Math.round((next - today) / 86400000);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value.length === 10 ? value + 'T00:00:00' : value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${fmtDate(value)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtLongDate(value) {
  const d = new Date(value.length === 10 ? value + 'T00:00:00' : value);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function todayIso(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = {
  esc, id, sha256, canonicalJson, hashPassword, checkPassword, parseCookies, readBody, readForm,
  clientIp, lanAddresses, ageOn, daysToBirthday, fmtDate, fmtDateTime, fmtLongDate, todayIso, MESES,
};
