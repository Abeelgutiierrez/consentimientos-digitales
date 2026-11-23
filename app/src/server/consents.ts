import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { clients, consentAnnexes, consentPdfs, consents, type InkRow } from "@/db/schema";
import { sha256Hex } from "@/core/canonical";
import { legalLocaleFor } from "@/core/content";
import { addDays, isoDateInMadrid } from "@/core/dates";
import { type SignedPayload, buildSignedPayload, verifySignHash } from "@/core/evidence";
import { type ValidationErrors, validateSubmission } from "@/core/validation";
import { audit } from "./audit";
import { dniIndex, upsertClientFromConsent } from "./clients";
import { likePattern } from "@/core/text";
import { decryptBytes, decryptJson, decryptString, encryptBytes, encryptJson, encryptString, newToken, tokenHash } from "./crypto";
import { type AnnexData, buildConsentPdf } from "./pdf";
import { getStudio, listArtists, studioBranding, studioSnapshot } from "./studios";
import { NotFoundError, newId, type Scope, withoutStudio } from "./tenant";

export const PUBLIC_LINK_DAYS = 30;

export type ConsentRow = typeof consents.$inferSelect;

const payloadCtx = (c: { studioId: string; id: string }) => ({ table: "consents", field: "signed_payload", studioId: c.studioId, rowId: c.id });
const flagsCtx = (c: { studioId: string; id: string }) => ({ table: "consents", field: "flags", studioId: c.studioId, rowId: c.id });
const pdfCtx = (studioId: string, pdfId: string) => ({ table: "consent_pdfs", field: "bytes", studioId, rowId: pdfId });

export interface ConsentFlags {
  healthYes: number;
}

/**
 * Registra un consentimiento firmado: valida en servidor, actualiza la ficha del cliente,
 * calcula la huella de lo firmado (una sola vez), lo guarda cifrado y genera el PDF v1.
 */
export async function createConsent(
  scope: Scope,
  body: unknown,
  opts: { locale: string; now?: Date } = { locale: "es" },
): Promise<{ errors: ValidationErrors } | { consentId: string; publicToken: string; clientId: string }> {
  const now = opts.now ?? new Date();
  const studio = await getStudio(scope);
  const activeArtists = await listArtists(scope);
  const v = validateSubmission({ services: studio.services, artistIds: activeArtists.map((a) => a.id) }, body, now);
  if (!v.ok) return { errors: v.errors };
  const s = v.value;

  const consentId = newId("cs_");
  const client = await upsertClientFromConsent(scope, s.person, s.checks.marketing, consentId, now);
  const artist = activeArtists.find((a) => a.id === s.service.artistId)!;
  const locale = legalLocaleFor(opts.locale);
  const { payload, canonical, signHash } = buildSignedPayload({
    consentId, studio: studioSnapshot(studio), submission: s, artistName: artist.name, locale, signedAt: now,
  });

  const publicToken = newToken();
  const ids = { studioId: scope.studioId, id: consentId };
  await scope.tx.insert(consents).values({
    id: consentId,
    studioId: scope.studioId,
    clientId: client.id,
    artistId: artist.id,
    service: s.service.service,
    zone: s.service.zone,
    artistName: artist.name,
    isMinor: s.minor !== null,
    locale,
    consentVersion: payload.consentVersion,
    signedAt: now,
    // Se guarda el JSON canónico EXACTO: así la huella se puede volver a comprobar siempre.
    signedPayloadEnc: encryptString(canonical, payloadCtx(ids)),
    signHash,
    ip: scope.req.ip.slice(0, 64),
    userAgent: scope.req.userAgent.slice(0, 300),
    flagsEnc: encryptJson({ healthYes: Object.values(s.health).filter(Boolean).length } satisfies ConsentFlags, flagsCtx(ids)),
    publicTokenHash: tokenHash(publicToken),
    publicTokenExpiresAt: new Date(now.getTime() + PUBLIC_LINK_DAYS * 86_400_000),
    purgeAfter: studio.retentionYears ? addDays(isoDateInMadrid(now), Math.round(studio.retentionYears * 365.25)) : null,
    createdAt: now,
  });
  await audit(scope, "consent.signed", { type: "consent", id: consentId }, { version: payload.consentVersion });
  await renderAndStorePdf(scope, consentId, "firma", now);
  return { consentId, publicToken, clientId: client.id };
}

async function getConsentRow(scope: Scope, consentId: string): Promise<ConsentRow> {
  const [row] = await scope.tx.select().from(consents).where(and(eq(consents.studioId, scope.studioId), eq(consents.id, consentId)));
  if (!row) throw new NotFoundError();
  return row;
}

export function readSignedPayload(row: ConsentRow): { payload: SignedPayload; canonical: string } {
  const canonical = decryptString(row.signedPayloadEnc, payloadCtx(row));
  return { payload: JSON.parse(canonical) as SignedPayload, canonical };
}

export function readFlags(row: Pick<ConsentRow, "studioId" | "id" | "flagsEnc">): ConsentFlags {
  return decryptJson<ConsentFlags>(row.flagsEnc, flagsCtx(row));
}

export async function latestAnnex(scope: Scope, consentId: string) {
  const [row] = await scope.tx.select().from(consentAnnexes)
    .where(and(eq(consentAnnexes.studioId, scope.studioId), eq(consentAnnexes.consentId, consentId)))
    .orderBy(desc(consentAnnexes.version)).limit(1);
  return row ?? null;
}

async function renderAndStorePdf(scope: Scope, consentId: string, reason: "firma" | "anexo", now: Date) {
  const row = await getConsentRow(scope, consentId);
  const studio = await getStudio(scope);
  const { payload } = readSignedPayload(row);
  const annexRow = await latestAnnex(scope, consentId);
  const annex: AnnexData | null = annexRow
    ? { inks: annexRow.inks, needles: annexRow.needles, notes: annexRow.notes, applicator: annexRow.applicator, createdAt: annexRow.createdAt.toISOString() }
    : null;
  const bytes = await buildConsentPdf({
    payload, signHash: row.signHash, evidence: { ip: row.ip, userAgent: row.userAgent }, branding: studioBranding(studio), annex,
  });
  const version = row.pdfVersion + 1;
  const pdfId = newId("pdf_");
  await scope.tx.insert(consentPdfs).values({
    id: pdfId, studioId: scope.studioId, consentId, version, reason, sha256: sha256Hex(bytes), size: bytes.length,
    bytesEnc: encryptBytes(bytes, pdfCtx(scope.studioId, pdfId)), createdAt: now,
  });
  await scope.tx.update(consents).set({ pdfVersion: version })
    .where(and(eq(consents.studioId, scope.studioId), eq(consents.id, consentId)));
  return { version, bytes };
}

export interface AnnexInput {
  inks: InkRow[];
  needles: string;
  notes: string;
  applicator: string;
}

const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export function normalizeAnnex(input: Partial<AnnexInput>): AnnexInput {
  const inks = (Array.isArray(input.inks) ? input.inks : []).slice(0, 30).map((i) => ({
    brand: s(i?.brand, 60), color: s(i?.color, 40), lot: s(i?.lot, 40),
    expiry: /^\d{4}-\d{2}-\d{2}$/.test(s(i?.expiry, 10)) ? s(i?.expiry, 10) : "", aemps: s(i?.aemps, 40),
  })).filter((i) => Object.values(i).some(Boolean));
  return { inks, needles: s(input.needles, 300), notes: s(input.notes, 1000), applicator: s(input.applicator, 80) };
}

/** Guarda una nueva versión del anexo (sin tocar lo firmado) y genera un PDF nuevo. */
export async function saveAnnex(scope: Scope, consentId: string, input: Partial<AnnexInput>, now = new Date()) {
  const row = await getConsentRow(scope, consentId);
  const data = normalizeAnnex(input);
  const version = row.annexVersion + 1;
  await scope.tx.insert(consentAnnexes).values({
    id: newId("ax_"), studioId: scope.studioId, consentId, version, ...data,
    applicator: data.applicator || row.artistName,
    createdByUserId: scope.actor.type === "user" ? scope.actor.userId : null, createdAt: now,
  });
  await scope.tx.update(consents).set({ annexVersion: version })
    .where(and(eq(consents.studioId, scope.studioId), eq(consents.id, consentId)));
  const pdf = await renderAndStorePdf(scope, consentId, "anexo", now);
  await audit(scope, "consent.annex_saved", { type: "consent", id: consentId }, { annexVersion: version, pdfVersion: pdf.version });
  return { annexVersion: version, pdfVersion: pdf.version };
}

export async function getPdf(scope: Scope, consentId: string, version?: number) {
  const row = await getConsentRow(scope, consentId);
  const v = version ?? row.pdfVersion;
  const [pdf] = await scope.tx.select().from(consentPdfs)
    .where(and(eq(consentPdfs.studioId, scope.studioId), eq(consentPdfs.consentId, consentId), eq(consentPdfs.version, v)));
  if (!pdf) throw new NotFoundError();
  return { bytes: decryptBytes(pdf.bytesEnc, pdfCtx(scope.studioId, pdf.id)), version: pdf.version, sha256: pdf.sha256, consent: row };
}

export interface IntegrityResult {
  signOk: boolean;
  pdfOk: boolean;
  pdfVersion: number;
}

/**
 * Comprueba (1) que el JSON firmado guardado sigue dando la huella registrada y
 * (2) que el PDF vigente coincide con su hash. Cualquier manipulación del cifrado
 * también se detecta (el descifrado autenticado falla).
 */
export async function verifyIntegrity(scope: Scope, consentId: string): Promise<IntegrityResult> {
  const row = await getConsentRow(scope, consentId);
  let signOk = false;
  try {
    signOk = verifySignHash(readSignedPayload(row).canonical, row.signHash);
  } catch {
    signOk = false;
  }
  let pdfOk = false;
  try {
    const pdf = await getPdf(scope, consentId);
    pdfOk = sha256Hex(pdf.bytes) === pdf.sha256;
  } catch {
    pdfOk = false;
  }
  await audit(scope, "consent.verified", { type: "consent", id: consentId }, { signOk, pdfOk, pdfVersion: row.pdfVersion });
  return { signOk, pdfOk, pdfVersion: row.pdfVersion };
}

/** Busca un PDF por su huella entre todas las versiones del estudio (para comprobar una copia). */
export async function findPdfByHash(scope: Scope, hash: string) {
  const [row] = await scope.tx.select({ consentId: consentPdfs.consentId, version: consentPdfs.version, createdAt: consentPdfs.createdAt })
    .from(consentPdfs).where(and(eq(consentPdfs.studioId, scope.studioId), eq(consentPdfs.sha256, hash.toLowerCase())));
  return row ?? null;
}

export interface ConsentListItem {
  id: string;
  clientId: string;
  clientName: string;
  service: string;
  zone: string;
  artistName: string;
  signedAt: Date;
  isMinor: boolean;
  annexVersion: number;
  healthYes: number;
}

export async function listConsents(scope: Scope, opts: { q?: string; clientId?: string; limit?: number } = {}): Promise<ConsentListItem[]> {
  const filters = [eq(consents.studioId, scope.studioId)];
  if (opts.clientId) filters.push(eq(consents.clientId, opts.clientId));
  const q = (opts.q ?? "").trim();
  if (q) {
    const like = likePattern(q);
    filters.push(sql`(norm_txt(${clients.firstName} || ' ' || ${clients.lastName}) like ${like}
      or norm_txt(${clients.email}) like ${like} or norm_txt(${consents.zone}) like ${like}
      or norm_txt(${consents.artistName}) like ${like} or norm_txt(${consents.service}) like ${like}
      or ${clients.dniHash} = ${dniIndex(scope.studioId, q)})`);
  }
  const rows = await scope.tx.select({
    id: consents.id, studioId: consents.studioId, clientId: consents.clientId, firstName: clients.firstName, lastName: clients.lastName,
    service: consents.service, zone: consents.zone, artistName: consents.artistName, signedAt: consents.signedAt,
    isMinor: consents.isMinor, annexVersion: consents.annexVersion, flagsEnc: consents.flagsEnc,
  }).from(consents)
    .innerJoin(clients, and(eq(clients.id, consents.clientId), eq(clients.studioId, consents.studioId)))
    .where(and(...filters)).orderBy(desc(consents.signedAt)).limit(opts.limit ?? 500);
  return rows.map((r) => ({
    id: r.id, clientId: r.clientId, clientName: `${r.firstName} ${r.lastName}`, service: r.service, zone: r.zone,
    artistName: r.artistName, signedAt: r.signedAt, isMinor: r.isMinor, annexVersion: r.annexVersion, healthYes: readFlags(r).healthYes,
  }));
}

/** Detalle completo (descifra lo firmado). Registra la consulta en la auditoría. */
export async function getConsentDetail(scope: Scope, consentId: string) {
  const row = await getConsentRow(scope, consentId);
  const { payload } = readSignedPayload(row);
  const annex = await latestAnnex(scope, consentId);
  const pdfs = await scope.tx.select({ version: consentPdfs.version, reason: consentPdfs.reason, sha256: consentPdfs.sha256, createdAt: consentPdfs.createdAt })
    .from(consentPdfs).where(and(eq(consentPdfs.studioId, scope.studioId), eq(consentPdfs.consentId, consentId))).orderBy(desc(consentPdfs.version));
  await audit(scope, "consent.viewed", { type: "consent", id: consentId });
  return { row, payload, annex, pdfs };
}

// ---------------------------------------------------------------- enlace público del cliente

export type PublicLink = { studioId: string; expiresAt: Date } | { expired: true } | null;

/** Valida el enlace de descarga del cliente: el token debe corresponder a ese consentimiento y no haber caducado. */
export async function resolvePublicLink(consentId: string, token: string, now = new Date()): Promise<PublicLink> {
  if (!/^cs_[0-9a-f]{20}$/.test(consentId) || !/^[\w-]{20,100}$/.test(token)) return null;
  const row = await withoutStudio(async (tx) => {
    const rows = await tx.execute<{ consent_id: string; studio_id: string; expires_at: string }>(
      sql`select * from public_consent_by_token(${tokenHash(token)})`,
    );
    return rows[0] ?? null;
  });
  if (!row || row.consent_id !== consentId) return null;
  const expiresAt = new Date(row.expires_at);
  if (expiresAt.getTime() < now.getTime()) return { expired: true };
  return { studioId: row.studio_id, expiresAt };
}

/** Datos mínimos para la página de agradecimiento (sin datos de salud). */
export async function publicSummary(scope: Scope, consentId: string) {
  const [row] = await scope.tx.select({ signedAt: consents.signedAt, firstName: clients.firstName })
    .from(consents).innerJoin(clients, and(eq(clients.id, consents.clientId), eq(clients.studioId, consents.studioId)))
    .where(and(eq(consents.studioId, scope.studioId), eq(consents.id, consentId)));
  if (!row) throw new NotFoundError();
  return row;
}
