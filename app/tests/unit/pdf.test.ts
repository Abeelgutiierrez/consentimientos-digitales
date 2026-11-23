import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildSignedPayload } from "@/core/evidence";
import { qrSvg } from "@/core/qr";
import { validateSubmission } from "@/core/validation";
import { buildConsentPdf } from "@/server/pdf";
import { NOW, fakeSignature, studioRules, validBody } from "./fixtures";

const studio = { id: "st_1", name: "Estudi Ficticí", cif: "B00000000", email: "hola@ficticio.example", address: "Carrer Fals, 1", city: "08700 Igualada", phone: "930000000" };

function payload(patch: Record<string, unknown> = {}) {
  const r = validateSubmission(studioRules, { ...validBody(), ...patch }, NOW);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return buildSignedPayload({ consentId: "cs_test", studio, submission: r.value, artistName: "Artista Ficticio", locale: "es", signedAt: NOW });
}

describe("PDF del consentimiento", () => {
  it("genera un PDF válido con la huella en los metadatos", async () => {
    const { payload: p, signHash } = payload();
    const bytes = await buildConsentPdf({ payload: p, signHash, evidence: { ip: "192.0.2.1", userAgent: "Test" }, branding: { color: "#111111", logo: null }, annex: null });
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getKeywords()).toContain(signHash);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    // El título no lleva el nombre de la persona (datos personales fuera de los metadatos).
    expect(doc.getTitle()).not.toContain("Prueba");
  });

  it("admite nombres fuera de Latin-1, menores con tutor y anexo de tintas", async () => {
    const { payload: p, signHash } = payload({
      firstName: "Łucja", lastName: "Nowak Ñúñez", birthDate: "2011-01-01",
      minor: { tutorName: "Zoë Ğüler", tutorDni: "87654321X", relation: "Madre", maturityCert: true }, tutorSignature: fakeSignature(5),
    });
    const bytes = await buildConsentPdf({
      payload: p, signHash, evidence: { ip: "192.0.2.1", userAgent: "Mozilla/5.0 ".repeat(30) }, branding: { color: "#f5e6a0", logo: null },
      annex: { inks: [{ brand: "Marca Ficticia con nombre muy largo", color: "Negro", lot: "L-1", expiry: "2027-06-30", aemps: "0000-TAT" }], needles: "3RL", notes: "", applicator: "Artista", createdAt: NOW.toISOString() },
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(2);
  });
});

describe("fuente del PDF", () => {
  it("tiene glifo real para todos los caracteres de los textos legales y de nombres europeos", async () => {
    const { readFileSync } = await import("node:fs");
    const fontkit = (await import("@pdf-lib/fontkit")).default;
    const { legalContent } = await import("@/core/content");
    const legal = JSON.stringify(legalContent({ name: "Estudi Ficticí", cif: "B0", email: "a@b.cd" }, "tatuaje"));
    const names = "Łucja Zoë Ğüler Ștefan Țurcanu Dvořák Øyvind Æsa Şükrü Ñúñez Aïda l·l «» ¿¡ € – — … ’ “ ” · º ª";
    for (const file of ["Inter-Regular-latin.ttf", "Inter-Bold-latin.ttf"]) {
      const font = fontkit.create(readFileSync(`assets/fonts/${file}`));
      const missing = [...new Set(Array.from(legal + names + "SÍNO[X]"))].filter((ch) => ch.trim() && font.glyphForCodePoint(ch.codePointAt(0)!).id === 0);
      expect(missing, file).toEqual([]);
    }
  });
});

describe("QR", () => {
  it("genera un SVG accesible", async () => {
    const svg = await qrSvg("https://ejemplo.test/s/estudio-ficticio");
    expect(svg).toContain("<svg");
    expect(svg).toContain('aria-label="Código QR"');
  });
});
