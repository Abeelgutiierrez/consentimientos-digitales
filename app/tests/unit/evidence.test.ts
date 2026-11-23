import { describe, expect, it } from "vitest";
import { canonicalJson } from "@/core/canonical";
import { buildSignedPayload, verifySignHash } from "@/core/evidence";
import { validateSubmission } from "@/core/validation";
import { NOW, studioRules, validBody } from "./fixtures";

const studio = { id: "st_1", name: "Estudio Ficticio", cif: "B00000000", email: "hola@ficticio.example", address: "Calle Falsa 1", city: "Igualada", phone: "930000000" };

function build(patch: Record<string, unknown> = {}) {
  const r = validateSubmission(studioRules, { ...validBody(), ...patch }, NOW);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return buildSignedPayload({ consentId: "cs_1", studio, submission: r.value, artistName: "Artista Ficticio", locale: "es", signedAt: NOW });
}

describe("huella de lo firmado", () => {
  it("es estable y verificable a partir del JSON guardado", () => {
    const a = build();
    const b = build();
    expect(a.signHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.signHash).toBe(b.signHash);
    expect(verifySignHash(a.canonical, a.signHash)).toBe(true);
    expect(canonicalJson(JSON.parse(a.canonical))).toBe(a.canonical);
  });

  it("cambia si cambia cualquier cosa firmada", () => {
    const base = build().signHash;
    expect(build({ zone: "Gemelo" }).signHash).not.toBe(base);
    expect(build({ checks: { read: true, privacy: true, marketing: false, images: true } }).signHash).not.toBe(base);
    expect(build({ healthNotes: "x", health: { ...validBody().health, piel: true } }).signHash).not.toBe(base);
  });

  it("detecta cualquier manipulación del JSON guardado", () => {
    const a = build();
    const tampered = a.canonical.replace('"zone":"Antebrazo"', '"zone":"Espalda"');
    expect(tampered).not.toBe(a.canonical);
    expect(verifySignHash(tampered, a.signHash)).toBe(false);
  });

  it("incluye los textos exactos que se mostraron (informativo, declaraciones, preguntas y casillas)", () => {
    const { payload } = build();
    expect(payload.legal.info.length).toBeGreaterThan(0);
    expect(payload.legal.healthQuestions).toHaveLength(11);
    expect(payload.legal.checkTexts.marketing).toContain("revocable");
    expect(payload.legal.declarations[2]).toContain("Estudio Ficticio");
    expect(payload.consentVersion).toBe("v1 · 2026-11");
  });
});
