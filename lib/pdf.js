'use strict';
// Generación del PDF del consentimiento con pdf-lib (MIT, incluida en lib/vendor).
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb, LineCapStyle } = require('./vendor/pdf-lib.min.js');
const { SERVICES, HEALTH_QUESTIONS, infoDocument, declarations } = require('./content');
const signature = require('./signature');
const { fmtDate, fmtDateTime, sha256 } = require('./util');
const db = require('./db');

const A4 = [595.28, 841.89];
const M = 48; // margen

// Las fuentes estándar de PDF usan WinAnsi: sustituimos lo que no se puede representar.
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function clean(text) {
  return String(text ?? '')
    .replace(/[\r\t]/g, ' ')
    .split('')
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (ch === '\n') return ch;
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.includes(ch)) return ch;
      return '?';
    })
    .join('');
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return rgb(0.1, 0.1, 0.15);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

class Writer {
  constructor(doc, fonts, accent) {
    this.doc = doc;
    this.f = fonts;
    this.accent = accent;
    this.pages = [];
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    this.y = A4[1] - M;
  }

  ensure(h) {
    if (this.y - h < M + 24) this.newPage();
  }

  wrap(text, font, size, width) {
    const lines = [];
    for (const para of clean(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        if (!word) continue;
        const test = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(test, size) <= width) {
          line = test;
        } else {
          if (line) lines.push(line);
          // Palabras más largas que la línea (hashes, user agents): cortar a la fuerza
          let w = word;
          while (font.widthOfTextAtSize(w, size) > width) {
            let i = w.length;
            while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
            lines.push(w.slice(0, i));
            w = w.slice(i);
          }
          line = w;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(str, { size = 9.5, bold = false, color = rgb(0.15, 0.15, 0.2), x = M, width = A4[0] - 2 * M, gap = 3 } = {}) {
    const font = bold ? this.f.bold : this.f.regular;
    const lh = size * 1.35;
    for (const line of this.wrap(str, font, size, width)) {
      this.ensure(lh);
      this.page.drawText(line, { x, y: this.y - size, size, font, color });
      this.y -= lh;
    }
    this.y -= gap;
  }

  heading(str) {
    this.ensure(34);
    this.y -= 8;
    this.page.drawRectangle({ x: M, y: this.y - 16, width: 3, height: 14, color: this.accent });
    this.page.drawText(clean(str).toUpperCase(), { x: M + 10, y: this.y - 13, size: 10, font: this.f.bold, color: rgb(0.1, 0.1, 0.15) });
    this.y -= 24;
  }

  // Tabla de dos columnas etiqueta / valor
  fields(rows, cols = 2) {
    const colW = (A4[0] - 2 * M) / cols;
    for (let i = 0; i < rows.length; i += cols) {
      const chunk = rows.slice(i, i + cols);
      const heights = chunk.map(([, v]) => this.wrap(v || '—', this.f.regular, 9.5, colW - 10).length);
      const h = 12 + Math.max(...heights) * 12.8 + 6;
      this.ensure(h);
      chunk.forEach(([label, value], j) => {
        const x = M + j * colW;
        this.page.drawText(clean(label).toUpperCase(), { x, y: this.y - 8, size: 6.8, font: this.f.bold, color: rgb(0.45, 0.45, 0.52) });
        let yy = this.y - 21;
        for (const line of this.wrap(value || '—', this.f.regular, 9.5, colW - 10)) {
          this.page.drawText(line, { x, y: yy, size: 9.5, font: this.f.regular, color: rgb(0.12, 0.12, 0.18) });
          yy -= 12.8;
        }
      });
      this.y -= h;
    }
  }

  rule() {
    this.ensure(10);
    this.page.drawLine({ start: { x: M, y: this.y - 4 }, end: { x: A4[0] - M, y: this.y - 4 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.88) });
    this.y -= 10;
  }
}

async function embedLogo(doc, dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const bytes = Buffer.from(m[2], 'base64');
  try {
    return m[1].toLowerCase() === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch (_) {
    return null;
  }
}

function drawSignature(w, sig, label, sub, boxX, boxW) {
  const boxH = 92;
  const page = w.page;
  page.drawRectangle({ x: boxX, y: w.y - boxH, width: boxW, height: boxH, borderColor: rgb(0.82, 0.82, 0.86), borderWidth: 0.7, color: rgb(0.985, 0.985, 0.99) });
  if (sig) {
    // Encajamos el contorno real de los trazos (aunque se salgan del lienzo) dentro del recuadro.
    const pts = sig.strokes.flat();
    if (pts.length) {
      const xs = pts.map((pt) => pt[0]);
      const ys = pts.map((pt) => pt[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const bw = Math.max(Math.max(...xs) - minX, 1);
      const bh = Math.max(Math.max(...ys) - minY, 1);
      const pad = 10;
      const availW = boxW - 2 * pad;
      const availH = boxH - 30 - pad;
      const scale = Math.min(availW / bw, availH / bh, 0.9);
      const offX = boxX + pad + (availW - bw * scale) / 2;
      const top = w.y - pad - (availH - bh * scale) / 2;
      page.drawSvgPath(signature.toPath(sig, scale, -minX * scale, -minY * scale), {
        x: offX, y: top, borderColor: rgb(0.08, 0.1, 0.3), borderWidth: 1.3, borderLineCap: LineCapStyle.Round,
      });
    }
  }
  page.drawText(clean(label), { x: boxX + 8, y: w.y - boxH + 15, size: 8, font: w.f.bold, color: rgb(0.2, 0.2, 0.28) });
  page.drawText(clean(sub), { x: boxX + 8, y: w.y - boxH + 5, size: 7, font: w.f.regular, color: rgb(0.45, 0.45, 0.52) });
  return boxH;
}

async function buildConsentPdf(consent) {
  const studio = db.q.studioById(consent.studioId);
  const client = db.q.client(consent.clientId);
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const accent = hexToRgb(studio.color);
  const w = new Writer(doc, fonts, accent);
  const service = SERVICES[consent.service] || SERVICES.tatuaje;

  doc.setTitle(`Consentimiento ${service.label} - ${client.firstName} ${client.lastName}`);
  doc.setAuthor(clean(studio.name));
  doc.setSubject('Consentimiento informado');
  doc.setCreator('Consentimientos Digitales (demo)');
  doc.setProducer('Consentimientos Digitales (demo)');
  doc.setKeywords([consent.id, consent.evidence.signHash]);
  doc.setCreationDate(new Date(consent.createdAt));

  // Cabecera
  const logo = await embedLogo(doc, studio.logo);
  const headerTop = w.y;
  let textX = M;
  if (logo) {
    const s = Math.min(46 / logo.height, 110 / logo.width);
    w.page.drawImage(logo, { x: M, y: headerTop - logo.height * s, width: logo.width * s, height: logo.height * s });
    textX = M + logo.width * s + 14;
  }
  w.page.drawText(clean(studio.name), { x: textX, y: headerTop - 16, size: 15, font: fonts.bold, color: rgb(0.08, 0.08, 0.12) });
  const sub = [studio.address, studio.city].filter(Boolean).join(' · ');
  if (sub) w.page.drawText(clean(sub), { x: textX, y: headerTop - 30, size: 8.5, font: fonts.regular, color: rgb(0.4, 0.4, 0.46) });
  const sub2 = [studio.cif, studio.phone, studio.email].filter(Boolean).join(' · ');
  if (sub2) w.page.drawText(clean(sub2), { x: textX, y: headerTop - 41, size: 8.5, font: fonts.regular, color: rgb(0.4, 0.4, 0.46) });
  w.y = headerTop - 58;
  w.page.drawRectangle({ x: M, y: w.y - 34, width: A4[0] - 2 * M, height: 34, color: accent });
  w.page.drawText(clean(`CONSENTIMIENTO INFORMADO · ${service.label.toUpperCase()}`), { x: M + 12, y: w.y - 21.5, size: 12, font: fonts.bold, color: rgb(1, 1, 1) });
  const ref = clean(`Ref. ${consent.id.toUpperCase()}`);
  w.page.drawText(ref, { x: A4[0] - M - 12 - fonts.regular.widthOfTextAtSize(ref, 8.5), y: w.y - 21, size: 8.5, font: fonts.regular, color: rgb(1, 1, 1) });
  w.y -= 44;

  // Datos personales
  w.heading('Datos de la persona');
  w.fields([
    ['Nombre y apellidos', `${client.firstName} ${client.lastName}`],
    ['DNI / NIE / Pasaporte', client.dni],
    ['Fecha de nacimiento', `${fmtDate(client.birthDate)} (${consent.ageAtSigning} años)`],
    ['Teléfono', client.phone],
    ['Correo electrónico', client.email],
    ['Dirección', client.address],
  ]);

  if (consent.minor) {
    w.heading('Representante legal (menor de edad)');
    w.fields([
      ['Nombre y apellidos', consent.minor.tutorName],
      ['DNI / NIE', consent.minor.tutorDni],
      ['Relación', consent.minor.relation],
      ['Certificado de madurez', consent.ageAtSigning < 16 ? (consent.minor.maturityCert ? 'Aportado' : 'No aportado') : 'No requerido (16 o 17 años)'],
    ]);
  }

  w.heading('Servicio');
  w.fields([
    ['Tipo', service.label],
    ['Aplicador/a', consent.artist],
    ['Zona del cuerpo', consent.zone],
    ['Fecha del servicio', fmtDate(consent.createdAt)],
    ['Descripción', consent.description],
  ]);

  // Salud
  w.heading('Cuestionario de salud');
  for (const qn of HEALTH_QUESTIONS) {
    const yes = !!consent.health[qn.key];
    const lines = w.wrap(qn.label, fonts.regular, 9, A4[0] - 2 * M - 50);
    const h = lines.length * 12 + 3;
    w.ensure(h);
    let yy = w.y - 9;
    for (const line of lines) {
      w.page.drawText(line, { x: M, y: yy, size: 9, font: fonts.regular, color: rgb(0.2, 0.2, 0.26) });
      yy -= 12;
    }
    const ans = yes ? 'SÍ' : 'NO';
    w.page.drawText(clean(ans), {
      x: A4[0] - M - fonts.bold.widthOfTextAtSize(clean(ans), 9), y: w.y - 9, size: 9, font: fonts.bold,
      color: yes ? rgb(0.75, 0.2, 0.15) : rgb(0.35, 0.55, 0.38),
    });
    w.y -= h;
  }
  if (consent.healthNotes) {
    w.y -= 4;
    w.text('Observaciones de salud:', { bold: true, size: 9, gap: 0 });
    w.text(consent.healthNotes, { size: 9 });
  }

  // Documento informativo
  w.heading('Información facilitada');
  for (const s of infoDocument(studio, consent.service)) {
    w.text(s.title, { bold: true, size: 9, gap: 0 });
    w.text(s.text, { size: 8.6, color: rgb(0.25, 0.25, 0.3) });
  }

  // Declaraciones y autorizaciones
  w.heading('Declaraciones y autorizaciones');
  const check = (ok, label) => w.text(`${ok ? '[X]' : '[  ]'}  ${label}`, { size: 9 });
  for (const d of declarations(studio, consent.service)) check(true, d);
  check(consent.checks.privacy, 'Acepto el tratamiento de mis datos, incluidos los de salud, para las finalidades indicadas en el apartado de protección de datos.');
  check(consent.checks.marketing, 'Acepto recibir comunicaciones comerciales (promociones y felicitación de cumpleaños) por correo electrónico. Opcional y revocable en cualquier momento.');
  check(consent.checks.images, 'Autorizo la publicación de fotografías del trabajo realizado en las redes sociales del estudio, sin mostrar mi cara. Opcional.');

  // Firmas
  w.heading('Firma');
  w.ensure(100);
  const fullW = A4[0] - 2 * M;
  if (consent.minor) {
    const half = (fullW - 12) / 2;
    const topY = w.y;
    drawSignature(w, consent.signature, `${client.firstName} ${client.lastName}`, 'Persona usuaria', M, half);
    w.y = topY;
    drawSignature(w, consent.tutorSignature, consent.minor.tutorName, 'Representante legal', M + half + 12, half);
  } else {
    drawSignature(w, consent.signature, `${client.firstName} ${client.lastName}`, `Firmado el ${fmtDateTime(consent.evidence.signedAt)}`, M, Math.min(300, fullW));
  }
  w.y -= 104;

  // Anexo del aplicador (tintas y lotes)
  if (consent.annex) {
    const a = consent.annex;
    w.heading('Anexo del aplicador · trazabilidad');
    w.text(`Añadido por ${a.applicator || 'el aplicador'} el ${fmtDateTime(a.updatedAt)}. No modifica lo firmado por la persona usuaria.`, { size: 8.5, color: rgb(0.4, 0.4, 0.46) });
    if (a.inks && a.inks.length) {
      const cols = [['Marca', 0], ['Color', 130], ['Lote', 230], ['Caducidad', 320], ['Nº registro AEMPS', 400]];
      w.ensure(18);
      for (const [label, dx] of cols) w.page.drawText(clean(label.toUpperCase()), { x: M + dx, y: w.y - 8, size: 6.8, font: fonts.bold, color: rgb(0.45, 0.45, 0.52) });
      w.y -= 14;
      for (const ink of a.inks) {
        w.ensure(14);
        const vals = [ink.brand, ink.color, ink.lot, fmtDate(ink.expiry) || ink.expiry, ink.aemps];
        cols.forEach(([, dx], i) => w.page.drawText(clean(vals[i] || '—').slice(0, 26), { x: M + dx, y: w.y - 9, size: 9, font: fonts.regular, color: rgb(0.12, 0.12, 0.18) }));
        w.y -= 14;
      }
      w.y -= 4;
    }
    if (a.needles) w.fields([['Agujas / material', a.needles]], 1);
    if (a.notes) w.fields([['Observaciones del aplicador', a.notes]], 1);
  }

  // Evidencias de la firma electrónica (bloque entero en la misma página)
  w.ensure(170);
  w.heading('Evidencias de la firma electrónica');
  const e = consent.evidence;
  w.text(`Documento firmado electrónicamente (firma electrónica simple, Reglamento UE 910/2014 eIDAS) mediante firma manuscrita digitalizada en el dispositivo de la persona usuaria.`, { size: 8.3, color: rgb(0.3, 0.3, 0.36) });
  w.fields([
    ['Fecha y hora de firma', fmtDateTime(e.signedAt) + ' (hora local del servidor)'],
    ['Dirección IP', e.ip],
    ['Versión del texto', e.consentVersion],
    ['Identificador', consent.id],
    ['Dispositivo', e.userAgent],
    ['Huella SHA-256 de los datos firmados', e.signHash],
  ]);

  // Pie de página
  const total = w.pages.length;
  w.pages.forEach((p, i) => {
    const left = clean(`${studio.name} · Consentimiento ${consent.id.toUpperCase()}`);
    const right = `Página ${i + 1} de ${total}`;
    p.drawLine({ start: { x: M, y: 34 }, end: { x: A4[0] - M, y: 34 }, thickness: 0.4, color: rgb(0.85, 0.85, 0.88) });
    p.drawText(left, { x: M, y: 22, size: 7.5, font: fonts.regular, color: rgb(0.5, 0.5, 0.56) });
    p.drawText(clean(right), { x: A4[0] - M - fonts.regular.widthOfTextAtSize(clean(right), 7.5), y: 22, size: 7.5, font: fonts.regular, color: rgb(0.5, 0.5, 0.56) });
  });

  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

// Genera el PDF, lo guarda en data/pdfs y registra su hash en el consentimiento.
async function renderAndStore(consent) {
  const bytes = await buildConsentPdf(consent);
  consent.pdfVersion = (consent.pdfVersion || 0) + 1;
  const file = `${consent.id}-v${consent.pdfVersion}.pdf`;
  fs.writeFileSync(path.join(db.PDF_DIR, file), bytes);
  consent.pdfFile = file;
  consent.pdfHash = sha256(bytes);
  return bytes;
}

function readStoredPdf(consent) {
  const file = path.join(db.PDF_DIR, consent.pdfFile || '');
  if (!consent.pdfFile || !fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

module.exports = { buildConsentPdf, renderAndStore, readStoredPdf };
