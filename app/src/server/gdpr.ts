import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { auditEvents, clients, consentAnnexes, consentPdfs, consents, emails, marketingEvents, studios } from "@/db/schema";
import { isoDateInMadrid } from "@/core/dates";
import { audit } from "./audit";
import { decryptDni, getClient } from "./clients";
import { getPdf, readSignedPayload } from "./consents";
import { assertOwner, type Scope } from "./tenant";

// RGPD: conservación (purga confirmada por el dueño/a, nunca automática), exportación de los datos
// de un cliente (derecho de acceso) y consulta del registro de auditoría.

export const MAX_RETENTION_YEARS = 30;

export class GdprError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/**
 * Cambia el plazo de conservación del estudio y recalcula la fecha de purga de todos sus
 * consentimientos (fecha de firma + N años). null = pendiente de definir: no se purga nada.
 */
export async function setRetention(scope: Scope, years: number | null, note: string) {
  assertOwner(scope);
  if (years !== null && (!Number.isInteger(years) || years < 1 || years > MAX_RETENTION_YEARS)) throw new GdprError("years");
  await scope.tx.update(studios).set({ retentionYears: years, retentionNote: note.trim().slice(0, 500), updatedAt: new Date() })
    .where(eq(studios.id, scope.studioId));
  await scope.tx.update(consents).set({
    purgeAfter: years === null
      ? null
      : sql`((${consents.signedAt} at time zone 'Europe/Madrid')::date + make_interval(years => ${years}))::date`,
  }).where(eq(consents.studioId, scope.studioId));
  await audit(scope, "studio.retention_updated", { type: "studio", id: scope.studioId }, { years: years ?? "pendiente" });
}

/** Consentimientos cuyo plazo de conservación ha vencido (para revisar antes de purgar). */
export async function purgeCandidates(scope: Scope, today = isoDateInMadrid()) {
  return scope.tx.select({
    id: consents.id, clientId: consents.clientId, service: consents.service, signedAt: consents.signedAt, purgeAfter: consents.purgeAfter,
    firstName: clients.firstName, lastName: clients.lastName,
  }).from(consents)
    .innerJoin(clients, and(eq(clients.id, consents.clientId), eq(clients.studioId, consents.studioId)))
    .where(and(eq(consents.studioId, scope.studioId), isNotNull(consents.purgeAfter), lte(consents.purgeAfter, today)))
    .orderBy(asc(consents.purgeAfter));
}

/**
 * Elimina definitivamente los consentimientos vencidos que el dueño/a ha confirmado (con sus PDFs
 * y anexos). Los clientes que se quedan sin consentimientos se eliminan también, con sus correos e
 * historial de marketing. En la auditoría queda constancia (solo identificadores).
 * Solo se purgan ids que sigan vencidos en el momento de confirmar.
 */
export async function purgeConsents(scope: Scope, ids: string[], today = isoDateInMadrid()) {
  assertOwner(scope);
  if (!ids.length) return { consents: 0, clients: 0 };
  const due = await scope.tx.select({ id: consents.id, clientId: consents.clientId }).from(consents)
    .where(and(eq(consents.studioId, scope.studioId), inArray(consents.id, ids.slice(0, 1000)), isNotNull(consents.purgeAfter), lte(consents.purgeAfter, today)));
  if (!due.length) return { consents: 0, clients: 0 };
  const dueIds = due.map((d) => d.id);
  await scope.tx.delete(consents).where(and(eq(consents.studioId, scope.studioId), inArray(consents.id, dueIds)));
  for (const d of due) await audit(scope, "consent.purged", { type: "consent", id: d.id });

  const touched = [...new Set(due.map((d) => d.clientId))];
  const stillUsed = (await scope.tx.select({ clientId: consents.clientId }).from(consents)
    .where(and(eq(consents.studioId, scope.studioId), inArray(consents.clientId, touched)))).map((r) => r.clientId);
  const orphan = touched.filter((c) => !stillUsed.includes(c));
  if (orphan.length) {
    await scope.tx.delete(emails).where(and(eq(emails.studioId, scope.studioId), inArray(emails.clientId, orphan)));
    await scope.tx.delete(clients).where(and(eq(clients.studioId, scope.studioId), inArray(clients.id, orphan)));
    for (const c of orphan) await audit(scope, "client.deleted", { type: "client", id: c }, { motivo: "conservacion" });
  }
  return { consents: dueIds.length, clients: orphan.length };
}

/**
 * Derecho de acceso: ZIP con todos los datos del cliente en este estudio (ficha, consentimientos
 * con lo firmado, anexos, historial de promociones, correos) y los PDFs. Queda en la auditoría.
 */
export async function exportClient(scope: Scope, clientId: string): Promise<{ zip: Uint8Array; filename: string }> {
  assertOwner(scope);
  const client = await getClient(scope, clientId);
  const rows = await scope.tx.select().from(consents)
    .where(and(eq(consents.studioId, scope.studioId), eq(consents.clientId, clientId))).orderBy(asc(consents.signedAt));
  const files: Record<string, Uint8Array> = {};
  const consentData = [];
  for (const row of rows) {
    const { payload } = readSignedPayload(row);
    const annexes = await scope.tx.select().from(consentAnnexes)
      .where(and(eq(consentAnnexes.studioId, scope.studioId), eq(consentAnnexes.consentId, row.id))).orderBy(asc(consentAnnexes.version));
    const pdfs = await scope.tx.select({ version: consentPdfs.version, sha256: consentPdfs.sha256, reason: consentPdfs.reason, createdAt: consentPdfs.createdAt })
      .from(consentPdfs).where(and(eq(consentPdfs.studioId, scope.studioId), eq(consentPdfs.consentId, row.id))).orderBy(asc(consentPdfs.version));
    const pdf = await getPdf(scope, row.id);
    files[`pdf/${row.id}-v${pdf.version}.pdf`] = new Uint8Array(pdf.bytes);
    consentData.push({
      id: row.id, firmado: row.signedAt.toISOString(), huellaSha256: row.signHash, ip: row.ip, dispositivo: row.userAgent,
      loFirmado: payload,
      anexos: annexes.map((a) => ({ version: a.version, tintas: a.inks, agujas: a.needles, observaciones: a.notes, aplicador: a.applicator, fecha: a.createdAt.toISOString() })),
      versionesPdf: pdfs.map((p) => ({ version: p.version, motivo: p.reason, sha256: p.sha256, fecha: p.createdAt.toISOString() })),
      conservarHasta: row.purgeAfter,
    });
  }
  const marketing = await scope.tx.select().from(marketingEvents)
    .where(and(eq(marketingEvents.studioId, scope.studioId), eq(marketingEvents.clientId, clientId))).orderBy(asc(marketingEvents.createdAt));
  const mails = await scope.tx.select({ fecha: emails.createdAt, asunto: emails.subject, para: emails.toEmail, codigo: emails.code, estado: emails.status })
    .from(emails).where(and(eq(emails.studioId, scope.studioId), eq(emails.clientId, clientId))).orderBy(asc(emails.createdAt));

  const data = {
    generado: new Date().toISOString(),
    ficha: {
      nombre: client.firstName, apellidos: client.lastName, documento: decryptDni(client), nacimiento: client.birthDate,
      correo: client.email, telefono: client.phone, direccion: client.address, clienteDesde: client.createdAt.toISOString(),
      aceptaPromociones: client.marketing,
    },
    historialPromociones: marketing.map((m) => ({ fecha: m.createdAt.toISOString(), acepta: m.granted, origen: m.source })),
    consentimientos: consentData,
    correosEnviados: mails.map((m) => ({ ...m, fecha: m.fecha.toISOString() })),
  };
  files["datos.json"] = strToU8(JSON.stringify(data, null, 2));
  files["LEEME.txt"] = strToU8([
    "Exportación de datos personales (derecho de acceso, art. 15 RGPD).",
    "",
    "datos.json  Ficha, consentimientos (incluido todo lo firmado y su huella SHA-256),",
    "            anexos de trazabilidad, historial de promociones y correos enviados.",
    "pdf/        Copia vigente en PDF de cada consentimiento.",
    "",
    "La huella SHA-256 permite comprobar que lo firmado no se ha modificado.",
  ].join("\r\n"));
  await audit(scope, "client.exported", { type: "client", id: clientId }, { consents: rows.length });
  return { zip: zipSync(files, { level: 6 }), filename: `datos-${clientId}-${isoDateInMadrid()}.zip` };
}

export const AUDIT_PAGE = 100;

export async function listAudit(scope: Scope, opts: { action?: string; userId?: string; page?: number } = {}) {
  assertOwner(scope);
  const filters = [eq(auditEvents.studioId, scope.studioId)];
  if (opts.action) filters.push(sql`${auditEvents.action} like ${opts.action.replace(/[%_\\]/g, "") + "%"}`);
  if (opts.userId) filters.push(eq(auditEvents.actorUserId, opts.userId));
  const page = Math.max(0, opts.page ?? 0);
  const rows = await scope.tx.select().from(auditEvents).where(and(...filters))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(AUDIT_PAGE + 1).offset(page * AUDIT_PAGE);
  return { rows: rows.slice(0, AUDIT_PAGE), hasMore: rows.length > AUDIT_PAGE, page };
}
