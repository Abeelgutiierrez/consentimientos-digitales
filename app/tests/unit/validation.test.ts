import { describe, expect, it } from "vitest";
import { validateSubmission } from "@/core/validation";
import { NOW, fakeSignature, noHealth, studioRules, validBody } from "./fixtures";

const run = (patch: Record<string, unknown>) => validateSubmission(studioRules, { ...validBody(), ...patch }, NOW);
const errorsOf = (patch: Record<string, unknown>) => {
  const r = run(patch);
  return r.ok ? {} : r.errors;
};

describe("validación del formulario en el servidor", () => {
  it("acepta un envío correcto y normaliza documento y correo", () => {
    const r = run({});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.person.dni).toBe("12345678Z");
    expect(r.value.person.email).toBe("prueba@example.com");
    expect(r.value.age).toBe(31);
    expect(r.value.minor).toBeNull();
  });

  it("rechaza campos obligatorios vacíos o no válidos", () => {
    expect(errorsOf({ firstName: " ", dni: "1", phone: "123", email: "no-es-correo", birthDate: "2030-01-01", zone: "" })).toMatchObject({
      firstName: "firstName", dni: "document", phone: "phone", email: "email", birthDate: "birthDate", zone: "zone",
    });
  });

  it("solo admite servicios y artistas del propio estudio", () => {
    expect(errorsOf({ service: "micropigmentacion" })).toMatchObject({ service: "service" });
    expect(errorsOf({ artistId: "ar_de_otro_estudio" })).toMatchObject({ artistId: "artist" });
  });

  it("exige responder todas las preguntas de salud y detallar los «Sí»", () => {
    const { alergias: _omit, ...partial } = noHealth();
    expect(errorsOf({ health: partial })).toMatchObject({ "health.alergias": "healthAnswer" });
    expect(errorsOf({ health: { ...noHealth(), alergias: true }, healthNotes: "" })).toMatchObject({ healthNotes: "healthNotes" });
    expect(run({ health: { ...noHealth(), alergias: true }, healthNotes: "Alergia ficticia al níquel" }).ok).toBe(true);
  });

  it("las casillas obligatorias deben marcarse y las opcionales nunca se dan por marcadas", () => {
    expect(errorsOf({ checks: {} })).toMatchObject({ "checks.read": "checkRead", "checks.privacy": "checkPrivacy" });
    const r = run({ checks: { read: true, privacy: true, marketing: "true", images: 1 } });
    expect(r.ok && r.value.checks).toEqual({ read: true, privacy: true, marketing: false, images: false });
  });

  it("para recibir promociones hace falta correo", () => {
    expect(errorsOf({ email: "", checks: { read: true, privacy: true, marketing: true } })).toMatchObject({ "checks.marketing": "marketingNeedsEmail" });
  });

  it("menores: tutor obligatorio y, si tienen menos de 16, certificado de madurez", () => {
    const minor = { tutorName: "Tutora Ficticia", tutorDni: "87654321X", relation: "Madre", maturityCert: false };
    expect(errorsOf({ birthDate: "2011-01-01", minor: {}, tutorSignature: null })).toMatchObject({
      "minor.tutorName": "tutorName", "minor.tutorDni": "document", "minor.relation": "relation",
      "minor.maturityCert": "maturityCert", tutorSignature: "signature.missing",
    });
    expect(run({ birthDate: "2011-01-01", minor, tutorSignature: fakeSignature(2) }).ok).toBe(false);
    expect(run({ birthDate: "2011-01-01", minor: { ...minor, maturityCert: true }, tutorSignature: fakeSignature(2) }).ok).toBe(true);
    const sixteen = run({ birthDate: "2010-01-01", minor, tutorSignature: fakeSignature(2) });
    expect(sixteen.ok && sixteen.value.minor?.tutorName).toBe("Tutora Ficticia");
  });

  it("un adulto no arrastra datos de tutor aunque el navegador los envíe", () => {
    const r = run({ minor: { tutorName: "X" }, tutorSignature: fakeSignature(3) });
    expect(r.ok && r.value.minor).toBeNull();
    expect(r.ok && r.value.tutorSignature).toBeNull();
  });

  it("rechaza firmas ausentes, mal formadas o de un solo toque", () => {
    expect(errorsOf({ signature: undefined })).toMatchObject({ signature: "signature.missing" });
    expect(errorsOf({ signature: { w: 400, h: 200, strokes: [[[1, 1], [2, 2]]] } })).toMatchObject({ signature: "signature.tooShort" });
    expect(errorsOf({ signature: { w: 400, h: 200, strokes: "x" } })).toMatchObject({ signature: "signature.invalid" });
  });

  it("recorta textos largos", () => {
    const r = run({ description: "a".repeat(5000) });
    expect(r.ok && r.value.service.description.length).toBe(600);
  });
});
