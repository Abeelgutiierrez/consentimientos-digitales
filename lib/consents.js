'use strict';
// Lógica de negocio: validar y registrar un consentimiento firmado.
const db = require('./db');
const pdf = require('./pdf');
const signature = require('./signature');
const { SERVICES, HEALTH_QUESTIONS, CONSENT_VERSION, infoDocument, declarations } = require('./content');
const { id, sha256, canonicalJson, ageOn } = require('./util');

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DNI_RE = /^[0-9XYZxyz][0-9]{7}[A-Za-z]$|^[A-Za-z0-9]{6,12}$/;

function validate(studio, body) {
  const errors = {};
  const data = {
    firstName: str(body.firstName, 80),
    lastName: str(body.lastName, 120),
    dni: str(body.dni, 20).toUpperCase().replace(/[\s-]/g, ''),
    birthDate: str(body.birthDate, 10),
    email: str(body.email, 160).toLowerCase(),
    phone: str(body.phone, 30),
    address: str(body.address, 200),
    service: str(body.service, 40),
    zone: str(body.zone, 120),
    description: str(body.description, 600),
    artist: str(body.artist, 80),
    healthNotes: str(body.healthNotes, 1000),
  };
  if (!data.firstName) errors.firstName = 'Indica tu nombre';
  if (!data.lastName) errors.lastName = 'Indica tus apellidos';
  if (!DNI_RE.test(data.dni)) errors.dni = 'Documento no válido';
  if (data.email && !EMAIL_RE.test(data.email)) errors.email = 'Correo no válido';
  if (!data.phone || data.phone.replace(/\D/g, '').length < 9) errors.phone = 'Teléfono no válido';
  const age = ageOn(data.birthDate);
  if (age === null || age < 0 || age > 110) errors.birthDate = 'Fecha de nacimiento no válida';
  if (!SERVICES[data.service] || !(studio.services || []).includes(data.service)) errors.service = 'Elige un servicio';
  if (!data.zone) errors.zone = 'Indica la zona del cuerpo';
  if (!data.artist) errors.artist = 'Elige el aplicador';

  const health = {};
  for (const qn of HEALTH_QUESTIONS) {
    const v = body.health ? body.health[qn.key] : undefined;
    if (v !== true && v !== false) errors['health.' + qn.key] = 'Responde a esta pregunta';
    health[qn.key] = v === true;
  }
  if (Object.values(health).some(Boolean) && !data.healthNotes) {
    errors.healthNotes = 'Has respondido "Sí" a alguna pregunta: explica brevemente los detalles';
  }

  const checks = {
    read: body.checks?.read === true,
    privacy: body.checks?.privacy === true,
    marketing: body.checks?.marketing === true,
    images: body.checks?.images === true,
  };
  if (!checks.read) errors['checks.read'] = 'Debes confirmar que has leído la información';
  if (!checks.privacy) errors['checks.privacy'] = 'Debes aceptar el tratamiento de datos para continuar';
  if (checks.marketing && !data.email) errors.email = 'Para recibir promociones necesitamos tu correo';

  let minor = null;
  if (age !== null && age < 18) {
    minor = {
      tutorName: str(body.minor?.tutorName, 120),
      tutorDni: str(body.minor?.tutorDni, 20).toUpperCase().replace(/[\s-]/g, ''),
      relation: str(body.minor?.relation, 40),
      maturityCert: body.minor?.maturityCert === true,
    };
    if (!minor.tutorName) errors['minor.tutorName'] = 'Indica el nombre del representante legal';
    if (!DNI_RE.test(minor.tutorDni)) errors['minor.tutorDni'] = 'Documento no válido';
    if (!minor.relation) errors['minor.relation'] = 'Indica la relación';
    if (age < 16 && !minor.maturityCert) errors['minor.maturityCert'] = 'Los menores de 16 años deben aportar el certificado de madurez';
    const tErr = signature.validate(body.tutorSignature);
    if (tErr) errors.tutorSignature = tErr;
  }

  const sErr = signature.validate(body.signature);
  if (sErr) errors.signature = sErr;

  return { errors, data, health, checks, minor, age };
}

function upsertClient(studio, data, checks, now) {
  const state = db.get();
  let client = state.clients.find((c) => c.studioId === studio.id && c.dni === data.dni);
  if (!client) {
    client = { id: id('cl_'), studioId: studio.id, createdAt: now, marketing: false, marketingAt: null };
    state.clients.push(client);
  }
  Object.assign(client, {
    firstName: data.firstName, lastName: data.lastName, dni: data.dni, birthDate: data.birthDate,
    email: data.email, phone: data.phone, address: data.address, updatedAt: now,
  });
  // El consentimiento de marketing más reciente es el que vale (se puede retirar).
  if (checks.marketing !== client.marketing) {
    client.marketing = checks.marketing;
    client.marketingAt = now;
  }
  return client;
}

async function createConsent(studio, body, meta) {
  const v = validate(studio, body);
  if (Object.keys(v.errors).length) return { errors: v.errors };

  const now = (meta.now || new Date()).toISOString();
  const client = upsertClient(studio, v.data, v.checks, now);
  const consent = {
    id: id('cs_'),
    studioId: studio.id,
    clientId: client.id,
    createdAt: now,
    service: v.data.service,
    zone: v.data.zone,
    description: v.data.description,
    artist: v.data.artist,
    ageAtSigning: v.age,
    health: v.health,
    healthNotes: v.data.healthNotes,
    checks: v.checks,
    minor: v.minor,
    signature: signature.normalize(body.signature),
    tutorSignature: v.minor ? signature.normalize(body.tutorSignature) : null,
    annex: null,
    // Token para que la persona pueda descargar su copia sin entrar al panel.
    publicToken: id(),
    evidence: {
      signedAt: now,
      ip: meta.ip || '',
      userAgent: str(meta.userAgent, 300),
      consentVersion: CONSENT_VERSION,
    },
  };

  // Huella de todo lo que la persona ha visto y firmado (datos + texto + firma).
  const signedPayload = {
    studio: { id: studio.id, name: studio.name, cif: studio.cif || '' },
    client: v.data,
    health: consent.health,
    checks: consent.checks,
    minor: consent.minor,
    info: infoDocument(studio, consent.service),
    declarations: declarations(studio, consent.service),
    signature: consent.signature,
    tutorSignature: consent.tutorSignature,
    signedAt: now,
    consentVersion: CONSENT_VERSION,
  };
  consent.evidence.signHash = sha256(canonicalJson(signedPayload));

  db.get().consents.push(consent);
  await pdf.renderAndStore(consent);
  db.save();
  return { consent, client };
}

async function updateAnnex(consent, body) {
  const inks = [];
  const n = Math.max(...['brand', 'color', 'lot', 'expiry', 'aemps'].map((k) => (Array.isArray(body[k]) ? body[k].length : 0)), 0);
  for (let i = 0; i < n; i++) {
    const ink = {
      brand: str(body.brand?.[i], 60), color: str(body.color?.[i], 40), lot: str(body.lot?.[i], 40),
      expiry: str(body.expiry?.[i], 10), aemps: str(body.aemps?.[i], 40),
    };
    if (Object.values(ink).some(Boolean)) inks.push(ink);
  }
  consent.annex = {
    inks,
    needles: str(body.needles, 300),
    notes: str(body.notes, 1000),
    applicator: str(body.applicator, 80) || consent.artist,
    updatedAt: new Date().toISOString(),
  };
  await pdf.renderAndStore(consent);
  db.save();
}

module.exports = { createConsent, updateAnnex, validate };
