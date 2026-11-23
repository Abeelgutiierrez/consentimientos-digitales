import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { LineCapStyle, PDFDocument, type PDFFont, type PDFImage, type PDFPage, type RGB, rgb } from "pdf-lib";
import { fmtDate, fmtDateTime } from "@/core/dates";
import type { SignedPayload } from "@/core/evidence";
import { type Signature, signaturePath } from "@/core/signature";

// PDF del consentimiento. Se dibuja SIEMPRE a partir del JSON firmado (lo que la persona vio)
// más el anexo del aplicador. Fuente Inter incrustada (OFL) para tener Unicode completo.

const A4: [number, number] = [595.28, 841.89];
const M = 48;

export interface Ink {
  brand: string;
  color: string;
  lot: string;
  expiry: string;
  aemps: string;
}

export interface AnnexData {
  inks: Ink[];
  needles: string;
  notes: string;
  applicator: string;
  createdAt: string;
}

export interface PdfInput {
  payload: SignedPayload;
  signHash: string;
  evidence: { ip: string; userAgent: string };
  branding: { color: string; logo: { bytes: Uint8Array; mime: string } | null };
  annex: AnnexData | null;
}

let fontCache: { regular: Buffer; bold: Buffer } | null = null;
function fontBytes() {
  if (!fontCache) {
    const dir = join(process.cwd(), "assets", "fonts");
    fontCache = { regular: readFileSync(join(dir, "Inter-Regular-latin.ttf")), bold: readFileSync(join(dir, "Inter-Bold-latin.ttf")) };
  }
  return fontCache;
}

// La fuente es un subconjunto de Inter (assets/fonts/LEEME.md): latín básico, Latin-1, latín
// extendido A y B y puntuación. Cubre los nombres europeos. Lo que quede fuera (emojis, otros
// alfabetos) se sustituye por «?» en el PDF; el JSON firmado conserva el texto exacto.
// Ojo: el subsetting propio de pdf-lib rompe los glifos; por eso la fuente ya viene recortada.
const SUPPORTED = /[\n -~ -ɏ‐-‧‰-›€™]/u;
const clean = (text: unknown) =>
  Array.from(String(text ?? "").replace(/[\r\t]/g, " "))
    .map((ch) => (SUPPORTED.test(ch) ? ch : ch.charCodeAt(0) < 0x20 ? "" : "?"))
    .join("");

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return rgb(0.1, 0.1, 0.15);
  const n = parseInt(m[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

class Writer {
  page!: PDFPage;
  pages: PDFPage[] = [];
  y = 0;
  constructor(private doc: PDFDocument, readonly f: { regular: PDFFont; bold: PDFFont }, readonly accent: RGB) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    this.y = A4[1] - M;
  }

  ensure(h: number) {
    if (this.y - h < M + 24) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        if (!word) continue;
        const test = line ? line + " " + word : word;
        if (font.widthOfTextAtSize(test, size) <= width) {
          line = test;
        } else {
          if (line) lines.push(line);
          // Palabras más largas que la línea (hashes, user agents): cortar a la fuerza.
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

  text(str: string, o: { size?: number; bold?: boolean; color?: RGB; x?: number; width?: number; gap?: number } = {}) {
    const { size = 9.5, bold = false, color = rgb(0.15, 0.15, 0.2), x = M, width = A4[0] - 2 * M, gap = 3 } = o;
    const font = bold ? this.f.bold : this.f.regular;
    const lh = size * 1.35;
    for (const line of this.wrap(str, font, size, width)) {
      this.ensure(lh);
      this.page.drawText(line, { x, y: this.y - size, size, font, color });
      this.y -= lh;
    }
    this.y -= gap;
  }

  heading(str: string) {
    this.ensure(34);
    this.y -= 8;
    this.page.drawRectangle({ x: M, y: this.y - 16, width: 3, height: 14, color: this.accent });
    this.page.drawText(clean(str).toUpperCase(), { x: M + 10, y: this.y - 13, size: 10, font: this.f.bold, color: rgb(0.1, 0.1, 0.15) });
    this.y -= 24;
  }

  fields(rows: [string, string][], cols = 2) {
    const colW = (A4[0] - 2 * M) / cols;
    for (let i = 0; i < rows.length; i += cols) {
      const chunk = rows.slice(i, i + cols);
      const heights = chunk.map(([, v]) => this.wrap(v || "—", this.f.regular, 9.5, colW - 10).length);
      const h = 12 + Math.max(...heights) * 12.8 + 6;
      this.ensure(h);
      chunk.forEach(([label, value], j) => {
        const x = M + j * colW;
        this.page.drawText(clean(label).toUpperCase(), { x, y: this.y - 8, size: 6.8, font: this.f.bold, color: rgb(0.45, 0.45, 0.52) });
        let yy = this.y - 21;
        for (const line of this.wrap(value || "—", this.f.regular, 9.5, colW - 10)) {
          this.page.drawText(line, { x, y: yy, size: 9.5, font: this.f.regular, color: rgb(0.12, 0.12, 0.18) });
          yy -= 12.8;
        }
      });
      this.y -= h;
    }
  }
}

async function embedLogo(doc: PDFDocument, logo: PdfInput["branding"]["logo"]): Promise<PDFImage | null> {
  if (!logo) return null;
  try {
    return logo.mime === "image/png" ? await doc.embedPng(logo.bytes) : await doc.embedJpg(logo.bytes);
  } catch {
    return null;
  }
}

function drawSignature(w: Writer, sig: Signature | null, label: string, sub: string, boxX: number, boxW: number) {
  const boxH = 92;
  const page = w.page;
  page.drawRectangle({ x: boxX, y: w.y - boxH, width: boxW, height: boxH, borderColor: rgb(0.82, 0.82, 0.86), borderWidth: 0.7, color: rgb(0.985, 0.985, 0.99) });
  const pts = sig ? sig.strokes.flat() : [];
  if (sig && pts.length) {
    // Encajamos el contorno real de los trazos (aunque se salgan del lienzo) dentro del recuadro.
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
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
    page.drawSvgPath(signaturePath(sig, scale, -minX * scale, -minY * scale), {
      x: offX, y: top, borderColor: rgb(0.08, 0.1, 0.3), borderWidth: 1.3, borderLineCap: LineCapStyle.Round,
    });
  }
  page.drawText(clean(label), { x: boxX + 8, y: w.y - boxH + 15, size: 8, font: w.f.bold, color: rgb(0.2, 0.2, 0.28) });
  page.drawText(clean(sub), { x: boxX + 8, y: w.y - boxH + 5, size: 7, font: w.f.regular, color: rgb(0.45, 0.45, 0.52) });
}

export async function buildConsentPdf(input: PdfInput): Promise<Buffer> {
  const { payload: p, annex } = input;
  const studio = p.studio;
  const client = p.client;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const bytes = fontBytes();
  const fonts = {
    regular: await doc.embedFont(bytes.regular, { subset: false }),
    bold: await doc.embedFont(bytes.bold, { subset: false }),
  };
  const accent = hexToRgb(input.branding.color);
  const w = new Writer(doc, fonts, accent);
  const fullName = `${client.firstName} ${client.lastName}`;

  // Metadatos: sin datos personales más allá de lo imprescindible para identificar el documento.
  doc.setTitle(`Consentimiento ${p.service.label} - ${p.consentId}`);
  doc.setAuthor(clean(studio.name));
  doc.setSubject("Consentimiento informado");
  doc.setCreator("Consentimientos Digitales");
  doc.setProducer("Consentimientos Digitales");
  doc.setKeywords([p.consentId, input.signHash]);
  doc.setCreationDate(new Date(p.signedAt));
  doc.setModificationDate(annex ? new Date(annex.createdAt) : new Date(p.signedAt));

  // Cabecera
  const logo = await embedLogo(doc, input.branding.logo);
  const headerTop = w.y;
  let textX = M;
  if (logo) {
    const s = Math.min(46 / logo.height, 110 / logo.width);
    w.page.drawImage(logo, { x: M, y: headerTop - logo.height * s, width: logo.width * s, height: logo.height * s });
    textX = M + logo.width * s + 14;
  }
  w.page.drawText(clean(studio.name), { x: textX, y: headerTop - 16, size: 15, font: fonts.bold, color: rgb(0.08, 0.08, 0.12) });
  const sub = [studio.address, studio.city].filter(Boolean).join(" · ");
  if (sub) w.page.drawText(clean(sub), { x: textX, y: headerTop - 30, size: 8.5, font: fonts.regular, color: rgb(0.4, 0.4, 0.46) });
  const sub2 = [studio.cif, studio.phone, studio.email].filter(Boolean).join(" · ");
  if (sub2) w.page.drawText(clean(sub2), { x: textX, y: headerTop - 41, size: 8.5, font: fonts.regular, color: rgb(0.4, 0.4, 0.46) });
  w.y = headerTop - 58;
  w.page.drawRectangle({ x: M, y: w.y - 34, width: A4[0] - 2 * M, height: 34, color: accent });
  const accentInk = luminance(input.branding.color) > 0.62 ? rgb(0.09, 0.09, 0.11) : rgb(1, 1, 1);
  w.page.drawText(clean(`CONSENTIMIENTO INFORMADO · ${p.service.label.toUpperCase()}`), { x: M + 12, y: w.y - 21.5, size: 12, font: fonts.bold, color: accentInk });
  const ref = clean(`Ref. ${p.consentId.toUpperCase()}`);
  w.page.drawText(ref, { x: A4[0] - M - 12 - fonts.regular.widthOfTextAtSize(ref, 8.5), y: w.y - 21, size: 8.5, font: fonts.regular, color: accentInk });
  w.y -= 44;

  w.heading("Datos de la persona");
  w.fields([
    ["Nombre y apellidos", fullName],
    ["DNI / NIE / Pasaporte", client.dni],
    ["Fecha de nacimiento", `${fmtDate(client.birthDate)} (${p.ageAtSigning} años)`],
    ["Teléfono", client.phone],
    ["Correo electrónico", client.email],
    ["Dirección", client.address],
  ]);

  if (p.minor) {
    w.heading("Representante legal (menor de edad)");
    w.fields([
      ["Nombre y apellidos", p.minor.tutorName],
      ["DNI / NIE", p.minor.tutorDni],
      ["Relación", p.minor.relation],
      ["Certificado de madurez", p.ageAtSigning < 16 ? (p.minor.maturityCert ? "Aportado" : "No aportado") : "No requerido (16 o 17 años)"],
    ]);
  }

  w.heading("Servicio");
  w.fields([
    ["Tipo", p.service.label],
    ["Aplicador/a", p.service.artistName],
    ["Zona del cuerpo", p.service.zone],
    ["Fecha del servicio", fmtDate(p.signedAt)],
    ["Descripción", p.service.description],
  ]);

  w.heading("Cuestionario de salud");
  for (const qn of p.legal.healthQuestions) {
    const yes = !!p.health.answers[qn.key];
    const lines = w.wrap(qn.label, fonts.regular, 9, A4[0] - 2 * M - 50);
    const h = lines.length * 12 + 3;
    w.ensure(h);
    let yy = w.y - 9;
    for (const line of lines) {
      w.page.drawText(line, { x: M, y: yy, size: 9, font: fonts.regular, color: rgb(0.2, 0.2, 0.26) });
      yy -= 12;
    }
    const ans = yes ? "SÍ" : "NO";
    w.page.drawText(ans, {
      x: A4[0] - M - fonts.bold.widthOfTextAtSize(ans, 9), y: w.y - 9, size: 9, font: fonts.bold,
      color: yes ? rgb(0.75, 0.2, 0.15) : rgb(0.35, 0.55, 0.38),
    });
    w.y -= h;
  }
  if (p.health.notes) {
    w.y -= 4;
    w.text("Observaciones de salud:", { bold: true, size: 9, gap: 0 });
    w.text(p.health.notes, { size: 9 });
  }

  w.heading("Información facilitada");
  for (const s of p.legal.info) {
    w.text(s.title, { bold: true, size: 9, gap: 0 });
    w.text(s.text, { size: 8.6, color: rgb(0.25, 0.25, 0.3) });
  }

  w.heading("Declaraciones y autorizaciones");
  const check = (ok: boolean, label: string) => w.text(`${ok ? "[X]" : "[  ]"}  ${label}`, { size: 9 });
  for (const d of p.legal.declarations) check(p.checks.read, d);
  check(p.checks.privacy, p.legal.checkTexts.privacy);
  check(p.checks.marketing, p.legal.checkTexts.marketing);
  check(p.checks.images, p.legal.checkTexts.images);

  w.heading("Firma");
  w.ensure(100);
  const fullW = A4[0] - 2 * M;
  if (p.minor) {
    const half = (fullW - 12) / 2;
    const topY = w.y;
    drawSignature(w, p.signature, fullName, "Persona usuaria", M, half);
    w.y = topY;
    drawSignature(w, p.tutorSignature, p.minor.tutorName, "Representante legal", M + half + 12, half);
  } else {
    drawSignature(w, p.signature, fullName, `Firmado el ${fmtDateTime(p.signedAt)}`, M, Math.min(300, fullW));
  }
  w.y -= 104;

  if (annex) {
    w.heading("Anexo del aplicador · trazabilidad");
    w.text(`Añadido por ${annex.applicator || "el aplicador"} el ${fmtDateTime(annex.createdAt)}. No modifica lo firmado por la persona usuaria.`, { size: 8.5, color: rgb(0.4, 0.4, 0.46) });
    if (annex.inks.length) {
      const cols: [string, number, number][] = [["Marca", 0, 125], ["Color", 130, 95], ["Lote", 230, 85], ["Caducidad", 320, 75], ["Nº registro AEMPS", 400, 99]];
      w.ensure(18);
      for (const [label, dx] of cols) w.page.drawText(label.toUpperCase(), { x: M + dx, y: w.y - 8, size: 6.8, font: fonts.bold, color: rgb(0.45, 0.45, 0.52) });
      w.y -= 14;
      for (const ink of annex.inks) {
        w.ensure(14);
        const vals = [ink.brand, ink.color, ink.lot, fmtDate(ink.expiry) || ink.expiry, ink.aemps];
        cols.forEach(([, dx, maxW], i) => {
          const v = w.wrap(vals[i] || "—", fonts.regular, 9, maxW)[0] ?? "—";
          w.page.drawText(v, { x: M + dx, y: w.y - 9, size: 9, font: fonts.regular, color: rgb(0.12, 0.12, 0.18) });
        });
        w.y -= 14;
      }
      w.y -= 4;
    }
    if (annex.needles) w.fields([["Agujas / material", annex.needles]], 1);
    if (annex.notes) w.fields([["Observaciones del aplicador", annex.notes]], 1);
  }

  // Evidencias de la firma electrónica (bloque entero en la misma página)
  w.ensure(170);
  w.heading("Evidencias de la firma electrónica");
  w.text("Documento firmado electrónicamente (firma electrónica simple, Reglamento UE 910/2014 eIDAS) mediante firma manuscrita digitalizada en el dispositivo de la persona usuaria.", { size: 8.3, color: rgb(0.3, 0.3, 0.36) });
  w.fields([
    ["Fecha y hora de firma", `${fmtDateTime(p.signedAt)} (hora de Madrid)`],
    ["Dirección IP", input.evidence.ip],
    ["Versión del texto", p.consentVersion],
    ["Identificador", p.consentId],
    ["Dispositivo", input.evidence.userAgent],
    ["Huella SHA-256 de los datos firmados", input.signHash],
  ]);

  const total = w.pages.length;
  w.pages.forEach((page, i) => {
    const left = clean(`${studio.name} · Consentimiento ${p.consentId.toUpperCase()}`);
    const right = `Página ${i + 1} de ${total}`;
    page.drawLine({ start: { x: M, y: 34 }, end: { x: A4[0] - M, y: 34 }, thickness: 0.4, color: rgb(0.85, 0.85, 0.88) });
    page.drawText(left, { x: M, y: 22, size: 7.5, font: fonts.regular, color: rgb(0.5, 0.5, 0.56) });
    page.drawText(right, { x: A4[0] - M - fonts.regular.widthOfTextAtSize(right, 7.5), y: 22, size: 7.5, font: fonts.regular, color: rgb(0.5, 0.5, 0.56) });
  });

  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return 0;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
