'use strict';
// Almacenamiento de la demo: un fichero JSON en data/db.json.
// Suficiente para enseñar el producto; en producción se sustituye por Postgres.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PDF_DIR = path.join(DATA_DIR, 'pdfs');

const EMPTY = () => ({ studios: [], clients: [], consents: [], outbox: [] });

let state = null;

function ensureDirs() {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

function load() {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    state = EMPTY();
    return state;
  }
  state = Object.assign(EMPTY(), JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  return state;
}

function save() {
  ensureDirs();
  const tmp = DB_FILE + '.tmp';
  const json = JSON.stringify(state, null, 2);
  fs.writeFileSync(tmp, json);
  try {
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    // En Windows un antivirus puede bloquear el rename: escribimos directamente.
    fs.writeFileSync(DB_FILE, json);
    try { fs.unlinkSync(tmp); } catch (_) { /* ignorar */ }
  }
}

function get() {
  return state || load();
}

function reset() {
  state = EMPTY();
  if (fs.existsSync(PDF_DIR)) {
    for (const f of fs.readdirSync(PDF_DIR)) fs.unlinkSync(path.join(PDF_DIR, f));
  }
  save();
  return state;
}

// Consultas de uso frecuente
const q = {
  studioBySlug: (slug) => get().studios.find((s) => s.slug === slug),
  studioById: (id) => get().studios.find((s) => s.id === id),
  client: (id) => get().clients.find((c) => c.id === id),
  consent: (id) => get().consents.find((c) => c.id === id),
  clientsOf: (studioId) => get().clients.filter((c) => c.studioId === studioId),
  consentsOf: (studioId) => get().consents
    .filter((c) => c.studioId === studioId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  consentsOfClient: (clientId) => get().consents
    .filter((c) => c.clientId === clientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  outboxOf: (studioId) => get().outbox
    .filter((m) => m.studioId === studioId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
};

module.exports = { load, save, get, reset, q, DATA_DIR, PDF_DIR, DB_FILE };
