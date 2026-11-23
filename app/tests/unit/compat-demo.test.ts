// Compatibilidad con la demo (Fase 1): se ejecuta el código de la demo y se compara con la v2.
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Hex } from "@/core/canonical";
import { SERVICE_KEYS, declarations, healthQuestions, infoDocument, serviceLabel } from "@/core/content";
import { normalizeSignature, signaturePath, validateSignature } from "@/core/signature";

const require = createRequire(import.meta.url);
const demoUtil = require("../../../lib/util.js");
const demoContent = require("../../../lib/content.js");
const demoSignature = require("../../../lib/signature.js");

const studio = { name: "Estudio Ficticio Tattoo", cif: "B00000000", email: "hola@ficticio.example" };

describe("JSON canónico y huella", () => {
  const fixtures: unknown[] = [
    null, 0, -1.5, "texto con ñ, à, l·l y \"comillas\"", true, [], {},
    { b: 1, a: [3, { z: null, y: undefined, x: "é" }], c: { nested: { deep: [1, 2, [3]] } } },
    { firma: { w: 500, h: 210, strokes: [[[1.5, 2], [3, 4.25]]] }, signedAt: "2026-11-23T10:00:00.000Z" },
  ];

  it.each(fixtures.map((f) => [JSON.stringify(f) ?? "undefined", f]))("produce el mismo texto que la demo: %s", (_label, value) => {
    expect(canonicalJson(value)).toBe(demoUtil.canonicalJson(value));
  });

  it("reproduce exactamente la huella de un consentimiento firmado con la demo", () => {
    // Mismo cálculo que lib/consents.js createConsent()
    const service = "tatuaje";
    const demoStudio = { id: "st_demo", name: studio.name, cif: studio.cif, email: studio.email };
    const signedPayload = {
      studio: { id: demoStudio.id, name: demoStudio.name, cif: demoStudio.cif },
      client: { firstName: "Laura", lastName: "Puig Serra", dni: "45000000T", birthDate: "1997-11-23", email: "laura@example.com", phone: "600000000", address: "", service, zone: "Antebrazo", description: "", artist: "Marc Soler", healthNotes: "" },
      health: Object.fromEntries(healthQuestions().map((q) => [q.key, false])),
      checks: { read: true, privacy: true, marketing: true, images: false },
      minor: null,
      info: demoContent.infoDocument(demoStudio, service),
      declarations: demoContent.declarations(demoStudio, service),
      signature: { w: 400, h: 200, strokes: [[[10, 10], [200, 120]]] },
      tutorSignature: null,
      signedAt: "2026-11-23T10:00:00.000Z",
      consentVersion: demoContent.CONSENT_VERSION,
    };
    const demoHash = demoUtil.sha256(demoUtil.canonicalJson(signedPayload));
    // La v2, con su propio contenido legal, produce el mismo documento y la misma huella.
    const v2Payload = { ...signedPayload, info: infoDocument(studio, service), declarations: declarations(studio, service) };
    expect(sha256Hex(canonicalJson(v2Payload))).toBe(demoHash);
    expect(demoHash).toBe(createHash("sha256").update(demoUtil.canonicalJson(signedPayload)).digest("hex"));
  });
});

describe("contenido legal", () => {
  it("el documento informativo y las declaraciones son idénticos a los de la demo", () => {
    for (const key of SERVICE_KEYS) {
      expect(infoDocument(studio, key)).toEqual(demoContent.infoDocument(studio, key));
      expect(declarations(studio, key)).toEqual(demoContent.declarations(studio, key));
      expect(serviceLabel(key)).toBe(demoContent.SERVICES[key].label);
    }
  });

  it("el cuestionario de salud es idéntico (claves, orden y textos)", () => {
    expect(healthQuestions()).toEqual(demoContent.HEALTH_QUESTIONS);
  });

  it("la versión del texto no ha cambiado", () => {
    expect(demoContent.CONSENT_VERSION).toBe("v1 · 2026-11");
  });
});

describe("firma", () => {
  const sig = { w: 400, h: 200, strokes: [[[10.123, 10.987], [50.55, 60.04], [120, 80], [200, 120]], [[30, 30]]] as [number, number][][] };

  it("normaliza y dibuja igual que la demo", () => {
    expect(normalizeSignature(sig)).toEqual(demoSignature.normalize(sig));
    expect(signaturePath(sig, 0.5, 3, -2)).toBe(demoSignature.toPath(sig, 0.5, 3, -2));
  });

  it("acepta y rechaza los mismos casos que la demo", () => {
    const cases: unknown[] = [null, {}, { w: 0, h: 1, strokes: [] }, { w: 400, h: 200, strokes: [[[1, 1], [2, 2]]] }, sig, { w: 400, h: 200, strokes: [[[1, "x"]]] }];
    for (const c of cases) expect(validateSignature(c) === null).toBe(demoSignature.validate(c) === null);
  });
});
