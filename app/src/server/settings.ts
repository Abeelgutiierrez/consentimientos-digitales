import "server-only";
import { eq } from "drizzle-orm";
import { type BirthdaySettings, studios } from "@/db/schema";
import { isServiceKey } from "@/core/content";
import { audit } from "./audit";
import { assertOwner, type Scope } from "./tenant";

// Ajustes del estudio (solo dueño/a). Los consentimientos ya firmados no cambian: su texto y los
// datos del estudio de ese momento están en lo firmado; el PDF nuevo (anexo) usa la marca actual.

export class SettingsError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
export const MAX_LOGO_BYTES = 400 * 1024;

export async function updateStudioSettings(scope: Scope, input: {
  name: string; cif: string; phone: string; address: string; city: string; email: string; color: string; services: string[];
}) {
  assertOwner(scope);
  const name = s(input.name, 80);
  if (!name) throw new SettingsError("name");
  const email = s(input.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new SettingsError("email");
  const services = input.services.filter(isServiceKey);
  if (!services.length) throw new SettingsError("services");
  const color = /^#[0-9a-f]{6}$/i.test(input.color) ? input.color.toLowerCase() : null;
  await scope.tx.update(studios).set({
    name, cif: s(input.cif, 20), phone: s(input.phone, 30), address: s(input.address, 120), city: s(input.city, 60), email, services,
    ...(color ? { color } : {}), updatedAt: new Date(),
  }).where(eq(studios.id, scope.studioId));
  await audit(scope, "studio.settings_updated", { type: "studio", id: scope.studioId });
}

/** Detecta PNG/JPEG por su firma (no por la extensión ni el tipo que dice el navegador). */
export function sniffImage(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

export async function setLogo(scope: Scope, bytes: Uint8Array | null) {
  assertOwner(scope);
  if (bytes === null) {
    await scope.tx.update(studios).set({ logo: null, logoMime: null, updatedAt: new Date() }).where(eq(studios.id, scope.studioId));
  } else {
    if (bytes.length > MAX_LOGO_BYTES) throw new SettingsError("logoSize");
    const mime = sniffImage(bytes);
    if (!mime) throw new SettingsError("logoType");
    await scope.tx.update(studios).set({ logo: Buffer.from(bytes), logoMime: mime, updatedAt: new Date() }).where(eq(studios.id, scope.studioId));
  }
  await audit(scope, "studio.settings_updated", { type: "studio", id: scope.studioId }, { logo: bytes !== null });
}

export async function updateBirthdaySettings(scope: Scope, input: { enabled: boolean; discount: unknown; validDays: unknown; subject: string; body: string }, current: BirthdaySettings) {
  assertOwner(scope);
  const clamp = (v: unknown, lo: number, hi: number, d: number) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const birthday: BirthdaySettings = {
    enabled: input.enabled,
    discount: clamp(input.discount, 1, 100, current.discount),
    validDays: clamp(input.validDays, 1, 730, current.validDays),
    subject: s(input.subject, 150) || current.subject,
    body: String(input.body ?? "").slice(0, 2000).trim() || current.body,
  };
  await scope.tx.update(studios).set({ birthday, updatedAt: new Date() }).where(eq(studios.id, scope.studioId));
  await audit(scope, "studio.settings_updated", { type: "studio", id: scope.studioId }, { birthday: true });
}
