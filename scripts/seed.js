'use strict';
/*
 * Datos de demostración (todos ficticios).
 *   node scripts/seed.js        → borra los datos actuales y vuelve a cargar la demo
 * Las fechas se calculan respecto al día de hoy para que siempre haya cumpleaños próximos.
 */
const db = require('../lib/db');
const util = require('../lib/util');
const consents = require('../lib/consents');

const DEFAULT_BIRTHDAY = {
  enabled: true,
  discount: 10,
  validDays: 365,
  subject: '¡Feliz cumpleaños, {nombre}! Tienes un {descuento} de regalo 🎁',
  body: 'Hoy es tu día y en {estudio} queremos celebrarlo contigo.\n\nTe regalamos un {descuento} de descuento en tu próxima sesión. Solo tienes que enseñar el código al reservar.\n\n¡Te esperamos!',
};

function studio({ slug, name, color, services, artists, city, address, cif, phone, email }) {
  const pw = util.hashPassword('demo1234');
  return {
    id: util.id('st_'), slug, name, color, services, artists, city, address, cif, phone, email,
    logo: null, salt: pw.salt, passwordHash: pw.hash,
    birthday: { ...DEFAULT_BIRTHDAY }, createdAt: new Date().toISOString(),
  };
}

function dni(n) {
  return String(n).padStart(8, '0') + 'TRWAGMYFPDXBNJZSQVHLCKE'[n % 23];
}

// Firma sintética con aspecto manuscrito (trazos deterministas a partir de una semilla).
function fakeSignature(seed) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const w = 500;
  const h = 210;
  const strokes = [];
  const main = [];
  const loops = 4 + Math.floor(rnd() * 3);
  const amp = 26 + rnd() * 20;
  for (let i = 0; i <= 140; i++) {
    const t = i / 140;
    const x = 60 + t * 330;
    const y = 112 - Math.sin(t * Math.PI * loops) * amp * (1 - t * 0.5) + Math.cos(t * Math.PI * loops * 2.1) * 12 - t * 18;
    main.push([x + Math.sin(t * 40) * 6, y]);
  }
  strokes.push(main);
  const cap = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    cap.push([48 + Math.sin(t * Math.PI * 1.6) * 18 + t * 10, 70 + t * 80]);
  }
  strokes.push(cap);
  const under = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    under.push([80 + t * 340, 160 + Math.sin(t * Math.PI) * 6 - t * 10 + rnd() * 2]);
  }
  strokes.push(under);
  return { w, h, strokes };
}

const NO_HEALTH = { alergias: false, piel: false, diabetes: false, coagulacion: false, cardiaco: false, epilepsia: false, inmunidad: false, embarazo: false, medicacion: false, sustancias: false, desmayos: false };

const UA = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
];

// Fecha de nacimiento para que el cumpleaños caiga dentro de `inDays` días.
function birthIn(inDays, age) {
  const d = new Date();
  d.setDate(d.getDate() + inDays);
  return `${d.getFullYear() - age}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n, hour) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor((n * 37) % 60), 0, 0);
  return d;
}

const PEOPLE_A = [
  // nombre, apellidos, cumple en X días, edad, email, marketing, servicio, zona, descripción, artista, hace días, hora, salud, notas
  ['Laura', 'Puig Serra', 0, 29, 'laura.puig@example.com', true, 'tatuaje', 'Antebrazo izquierdo', 'Ramo de lavanda fine line, 12 cm', 'Marc Soler', 2, 11],
  ['Jordi', 'Vidal Roca', 2, 34, 'jordi.vidal@example.com', true, 'tatuaje', 'Gemelo derecho', 'Brújula realista en negro y grises', 'Laia Ferrer', 5, 17],
  ['Marta', 'Casals Riera', 9, 26, 'marta.casals@example.com', true, 'piercing', 'Hélix oreja izquierda', 'Aro de titanio 8 mm', 'Àlex Mora', 1, 12],
  ['Sergi', 'Font Bosch', 15, 41, '', false, 'tatuaje', 'Espalda (omóplato)', 'Continuación de pieza japonesa, 2.ª sesión', 'Marc Soler', 12, 10, { medicacion: true }, 'Tomo ibuprofeno puntualmente por dolor lumbar. No lo he tomado hoy.'],
  ['Núria', 'Pons Martí', 22, 31, 'nuria.pons@example.com', false, 'tatuaje', 'Clavícula', 'Frase "respira" en lettering', 'Laia Ferrer', 18, 16],
  ['Pau', 'Grau Soler', 37, 23, 'pau.grau@example.com', true, 'tatuaje', 'Muñeca derecha', 'Línea de montañas minimalista', 'Laia Ferrer', 0, 10],
  ['Aina', 'Coll Vila', 48, 17, 'aina.coll@example.com', true, 'piercing', 'Lóbulo derecho (2.º agujero)', 'Pendiente de titanio', 'Àlex Mora', 7, 18, null, null, { tutorName: 'Montse Vila Prat', tutorDni: dni(38291045), relation: 'Madre', maturityCert: false }],
  ['David', 'Ribas Costa', 64, 38, 'david.ribas@example.com', true, 'tatuaje', 'Brazo derecho (manga)', 'Manga blackwork, 3.ª sesión', 'Marc Soler', 25, 12, { alergias: true }, 'Alergia leve al látex. El artista usa guantes de nitrilo.'],
  ['Clara', 'Mas Ferrer', 90, 27, 'clara.mas@example.com', true, 'tatuaje', 'Costillas', 'Golondrina neotradicional a color', 'Laia Ferrer', 33, 15],
  ['Oriol', 'Sala Prat', 130, 45, 'oriol.sala@example.com', false, 'tatuaje', 'Tobillo izquierdo', 'Retoque de tatuaje antiguo', 'Marc Soler', 40, 11],
  ['Júlia', 'Torres Camps', 180, 21, 'julia.torres@example.com', true, 'piercing', 'Nostril', 'Stud de titanio 2 mm', 'Àlex Mora', 3, 19],
];

const PEOPLE_B = [
  ['Rosa', 'Batlle Pujol', 4, 47, 'rosa.batlle@example.com', true, 'micropigmentacion', 'Cejas', 'Microblading pelo a pelo, tono castaño', 'Elena Rius', 6, 10],
  ['Anna', 'Ventura Soler', 0, 39, 'anna.ventura@example.com', true, 'micropigmentacion', 'Labios', 'Labios acuarela, tono nude', 'Elena Rius', 10, 12],
  ['Carme', 'Valls Roig', 28, 55, '', false, 'micropigmentacion', 'Eyeliner superior', 'Delineado fino', 'Elena Rius', 21, 17, { coagulacion: true, medicacion: true }, 'Tomo Adiro 100 mg. Consultado con mi médico, autoriza el tratamiento.'],
];

const INK_BRANDS = [['World Famous', 'Negro Lining'], ['Eternal Ink', 'Triple Black'], ['Dynamic', 'Gris medio'], ['Intenze', 'Rojo cereza']];
const PMU_INK = [['Perma Blend', 'Chocolate'], ['Li Pigments', 'Nude']];

async function addPeople(st, people, inks, ipBase) {
  let n = 0;
  for (const [firstName, lastName, bdayIn, age, emailAddr, marketing, service, zone, description, artist, ago, hour, health, notes, minor] of people) {
    n++;
    const body = {
      firstName, lastName, dni: dni(45000000 + n * 7919 + firstName.length * 131), birthDate: birthIn(bdayIn, age),
      email: emailAddr, phone: `6${String(10000000 + n * 1234567).slice(0, 8)}`, address: '',
      service, zone, description, artist,
      health: { ...NO_HEALTH, ...(health || {}) }, healthNotes: notes || '',
      checks: { read: true, privacy: true, marketing, images: n % 3 === 0 },
      signature: fakeSignature(n * 97 + firstName.length),
    };
    if (minor) {
      body.minor = minor;
      body.tutorSignature = fakeSignature(n * 13 + 5);
    }
    const r = await consents.createConsent(st, body, { ip: `${ipBase}.${30 + n}`, userAgent: UA[n % UA.length], now: daysAgo(ago, hour) });
    if (r.errors) throw new Error(`Seed inválido para ${firstName}: ${JSON.stringify(r.errors)}`);
    // La mayoría de trabajos antiguos ya tienen las tintas anotadas.
    if (service !== 'piercing' && ago >= 3) {
      const pick = inks.slice(0, 1 + (n % inks.length));
      await consents.updateAnnex(r.consent, {
        brand: pick.map((x) => x[0]), color: pick.map((x) => x[1]),
        lot: pick.map((_, i) => `L${24 + i}${String(1000 + n * 37).slice(0, 4)}`),
        expiry: pick.map(() => `${new Date().getFullYear() + 1}-0${1 + (n % 8)}-15`),
        aemps: pick.map((_, i) => `${7810 + n + i}-TAT`),
        needles: service === 'micropigmentacion' ? 'Nanoagujas 0.18 mm, lote N2291' : 'Cartuchos 3RL y 9M1, lote C5520',
        notes: '', applicator: artist,
      });
    }
  }
}

async function seed() {
  db.load();
  const a = studio({
    slug: 'aguja-fina', name: 'Aguja Fina Tattoo', color: '#111111', services: ['tatuaje', 'piercing'],
    artists: ['Marc Soler', 'Laia Ferrer', 'Àlex Mora'], city: '08700 Igualada', address: 'Carrer de l’Exemple, 12',
    cif: 'B00000000', phone: '938 00 00 00', email: 'hola@agujafina.example',
  });
  const b = studio({
    slug: 'lumiere-estetica', name: 'Lumière Estètica', color: '#8c5a4a', services: ['micropigmentacion'],
    artists: ['Elena Rius'], city: '08700 Igualada', address: 'Passeig de Prova, 5',
    cif: 'B11111111', phone: '938 11 11 11', email: 'info@lumiere.example',
  });
  db.get().studios.push(a, b);
  db.save();
  await addPeople(a, PEOPLE_A, INK_BRANDS, '192.168.1');
  await addPeople(b, PEOPLE_B, PMU_INK, '192.168.1');
  db.save();
  console.log(`  Demo cargada: ${db.get().studios.length} estudios, ${db.get().clients.length} clientes, ${db.get().consents.length} consentimientos.`);
}

if (require.main === module) {
  db.load();
  db.reset();
  seed().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { seed };
