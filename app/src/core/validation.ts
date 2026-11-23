// Validación del envío del formulario. Se valida SIEMPRE en el servidor aunque el navegador
// ya valide. Mismas reglas que la demo (lib/consents.js). Los errores son claves de traducción
// (messages/*.json → "validation.<clave>") para poder mostrarlos en español o catalán.
import { ageOn } from "./dates";
import { HEALTH_KEYS, type HealthKey, type ServiceKey, isServiceKey } from "./content";
import { type Signature, type SignatureError, normalizeSignature, validateSignature } from "./signature";

const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DNI_RE = /^[0-9XYZxyz][0-9]{7}[A-Za-z]$|^[A-Za-z0-9]{6,12}$/;
const normDoc = (v: unknown) => str(v, 20).toUpperCase().replace(/[\s-]/g, "");

export interface PersonData {
  firstName: string;
  lastName: string;
  dni: string;
  birthDate: string;
  email: string;
  phone: string;
  address: string;
}

export interface ServiceData {
  service: ServiceKey;
  zone: string;
  description: string;
  artistId: string;
}

export interface MinorData {
  tutorName: string;
  tutorDni: string;
  relation: string;
  maturityCert: boolean;
}

export interface Checks {
  read: boolean;
  privacy: boolean;
  marketing: boolean;
  images: boolean;
}

export interface ValidSubmission {
  person: PersonData;
  service: ServiceData;
  health: Record<HealthKey, boolean>;
  healthNotes: string;
  checks: Checks;
  minor: MinorData | null;
  signature: Signature;
  tutorSignature: Signature | null;
  age: number;
}

export type ValidationErrors = Record<string, string>;

export interface StudioRules {
  services: readonly string[];
  artistIds: readonly string[];
}

const sigError = (e: SignatureError) => `signature.${e}`;

export function validateSubmission(
  studio: StudioRules,
  body: unknown,
  now: Date = new Date(),
): { ok: true; value: ValidSubmission } | { ok: false; errors: ValidationErrors } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const errors: ValidationErrors = {};

  const person: PersonData = {
    firstName: str(b.firstName, 80),
    lastName: str(b.lastName, 120),
    dni: normDoc(b.dni),
    birthDate: str(b.birthDate, 10),
    email: str(b.email, 160).toLowerCase(),
    phone: str(b.phone, 30),
    address: str(b.address, 200),
  };
  if (!person.firstName) errors.firstName = "firstName";
  if (!person.lastName) errors.lastName = "lastName";
  if (!DNI_RE.test(person.dni)) errors.dni = "document";
  if (person.email && !EMAIL_RE.test(person.email)) errors.email = "email";
  if (person.phone.replace(/\D/g, "").length < 9) errors.phone = "phone";
  const age = ageOn(person.birthDate, now);
  if (age === null || age < 0 || age > 110) errors.birthDate = "birthDate";

  const serviceKey = str(b.service, 40);
  const artistId = str(b.artistId, 64);
  if (!isServiceKey(serviceKey) || !studio.services.includes(serviceKey)) errors.service = "service";
  const zone = str(b.zone, 120);
  if (!zone) errors.zone = "zone";
  if (!artistId || !studio.artistIds.includes(artistId)) errors.artistId = "artist";

  const rawHealth = (b.health && typeof b.health === "object" ? b.health : {}) as Record<string, unknown>;
  const health = {} as Record<HealthKey, boolean>;
  for (const key of HEALTH_KEYS) {
    const v = rawHealth[key];
    if (v !== true && v !== false) errors[`health.${key}`] = "healthAnswer";
    health[key] = v === true;
  }
  const healthNotes = str(b.healthNotes, 1000);
  if (Object.values(health).some(Boolean) && !healthNotes) errors.healthNotes = "healthNotes";

  const rawChecks = (b.checks && typeof b.checks === "object" ? b.checks : {}) as Record<string, unknown>;
  const checks: Checks = {
    read: rawChecks.read === true,
    privacy: rawChecks.privacy === true,
    marketing: rawChecks.marketing === true,
    images: rawChecks.images === true,
  };
  if (!checks.read) errors["checks.read"] = "checkRead";
  if (!checks.privacy) errors["checks.privacy"] = "checkPrivacy";
  if (checks.marketing && !person.email) errors["checks.marketing"] = "marketingNeedsEmail";

  let minor: MinorData | null = null;
  let tutorSignature: Signature | null = null;
  if (age !== null && age >= 0 && age < 18) {
    const m = (b.minor && typeof b.minor === "object" ? b.minor : {}) as Record<string, unknown>;
    minor = {
      tutorName: str(m.tutorName, 120),
      tutorDni: normDoc(m.tutorDni),
      relation: str(m.relation, 40),
      maturityCert: m.maturityCert === true,
    };
    if (!minor.tutorName) errors["minor.tutorName"] = "tutorName";
    if (!DNI_RE.test(minor.tutorDni)) errors["minor.tutorDni"] = "document";
    if (!minor.relation) errors["minor.relation"] = "relation";
    if (age < 16 && !minor.maturityCert) errors["minor.maturityCert"] = "maturityCert";
    const tErr = validateSignature(b.tutorSignature);
    if (tErr) errors.tutorSignature = sigError(tErr);
    else tutorSignature = normalizeSignature(b.tutorSignature as Signature);
  }

  const sErr = validateSignature(b.signature);
  if (sErr) errors.signature = sigError(sErr);

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      person,
      service: { service: serviceKey as ServiceKey, zone, description: str(b.description, 600), artistId },
      health,
      healthNotes,
      checks,
      minor,
      signature: normalizeSignature(b.signature as Signature),
      tutorSignature,
      age: age!,
    },
  };
}
