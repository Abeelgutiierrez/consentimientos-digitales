// Modelo de evidencias (igual que en la demo, ampliado):
// - `signHash` = SHA-256 del JSON canónico de TODO lo que la persona ha visto y firmado.
// - Se calcula una sola vez al firmar y NUNCA se recalcula ni se modifica lo firmado.
// - El JSON firmado se guarda tal cual (cifrado) para poder volver a verificar la huella.
// - Los cambios posteriores van al anexo, que genera un PDF nuevo con versión y hash propios.
import { canonicalJson, sha256Hex } from "./canonical";
import { legalContent, serviceLabel, type LegalLocale, type StudioLegalInfo } from "./content";
import type { ValidSubmission } from "./validation";

export const PAYLOAD_VERSION = 2;

export interface StudioSnapshot extends StudioLegalInfo {
  id: string;
  address: string;
  city: string;
  phone: string;
}

export interface SignedPayload {
  payloadVersion: number;
  consentId: string;
  consentVersion: string;
  locale: LegalLocale;
  studio: StudioSnapshot;
  client: ValidSubmission["person"];
  service: { key: string; label: string; zone: string; description: string; artistId: string; artistName: string };
  ageAtSigning: number;
  health: { answers: ValidSubmission["health"]; notes: string };
  checks: ValidSubmission["checks"];
  minor: ValidSubmission["minor"];
  legal: ReturnType<typeof legalContent>;
  signature: ValidSubmission["signature"];
  tutorSignature: ValidSubmission["tutorSignature"];
  signedAt: string;
}

export function buildSignedPayload(args: {
  consentId: string;
  studio: StudioSnapshot;
  submission: ValidSubmission;
  artistName: string;
  locale: LegalLocale;
  signedAt: Date;
}): { payload: SignedPayload; canonical: string; signHash: string } {
  const { submission: s } = args;
  const payload: SignedPayload = {
    payloadVersion: PAYLOAD_VERSION,
    consentId: args.consentId,
    consentVersion: legalContent(args.studio, s.service.service, args.locale).consentVersion,
    locale: args.locale,
    studio: args.studio,
    client: s.person,
    service: {
      key: s.service.service,
      label: serviceLabel(s.service.service, args.locale),
      zone: s.service.zone,
      description: s.service.description,
      artistId: s.service.artistId,
      artistName: args.artistName,
    },
    ageAtSigning: s.age,
    health: { answers: s.health, notes: s.healthNotes },
    checks: s.checks,
    minor: s.minor,
    legal: legalContent(args.studio, s.service.service, args.locale),
    signature: s.signature,
    tutorSignature: s.tutorSignature,
    signedAt: args.signedAt.toISOString(),
  };
  const canonical = canonicalJson(payload);
  return { payload, canonical, signHash: sha256Hex(canonical) };
}

/** Comprueba que el JSON firmado guardado sigue produciendo la huella registrada. */
export function verifySignHash(canonical: string, signHash: string): boolean {
  return sha256Hex(canonical) === signHash;
}
