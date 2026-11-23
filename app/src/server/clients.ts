import "server-only";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { clients, marketingEvents } from "@/db/schema";
import type { PersonData } from "@/core/validation";
import { blindIndex, decryptString, encryptString } from "./crypto";
import { NotFoundError, newId, type Scope } from "./tenant";

export type ClientRow = typeof clients.$inferSelect;

const dniCtx = (studioId: string, clientId: string) => ({ table: "clients", field: "dni", studioId, rowId: clientId });

export function decryptDni(c: Pick<ClientRow, "id" | "studioId" | "dniEnc">): string {
  return decryptString(c.dniEnc, dniCtx(c.studioId, c.id));
}

export function dniIndex(studioId: string, dni: string): string {
  return blindIndex("dni", studioId, dni.toUpperCase().replace(/[\s-]/g, ""));
}

/**
 * Crea o actualiza la ficha del cliente al firmar (se identifica por DNI dentro del estudio).
 * El consentimiento de marketing más reciente es el que vale: se puede dar o retirar al firmar.
 */
export async function upsertClientFromConsent(
  scope: Scope,
  person: PersonData,
  marketing: boolean,
  consentId: string,
  now: Date,
): Promise<ClientRow> {
  const hash = dniIndex(scope.studioId, person.dni);
  const [existing] = await scope.tx.select().from(clients)
    .where(and(eq(clients.studioId, scope.studioId), eq(clients.dniHash, hash)));
  const data = {
    firstName: person.firstName, lastName: person.lastName, birthDate: person.birthDate,
    email: person.email, phone: person.phone, address: person.address, updatedAt: now,
  };
  let client: ClientRow;
  if (existing) {
    const changed = existing.marketing !== marketing;
    const [row] = await scope.tx.update(clients)
      .set({ ...data, ...(changed ? { marketing, marketingAt: now } : {}) })
      .where(and(eq(clients.studioId, scope.studioId), eq(clients.id, existing.id)))
      .returning();
    client = row!;
    if (changed) await logMarketing(scope, client.id, marketing, "consentimiento", consentId, now);
  } else {
    const id = newId("cl_");
    const [row] = await scope.tx.insert(clients).values({
      id, studioId: scope.studioId, ...data,
      dniEnc: encryptString(person.dni, dniCtx(scope.studioId, id)), dniHash: hash,
      marketing, marketingAt: marketing ? now : null, createdAt: now,
    }).returning();
    client = row!;
    if (marketing) await logMarketing(scope, client.id, true, "consentimiento", consentId, now);
  }
  return client;
}

export async function logMarketing(
  scope: Scope, clientId: string, granted: boolean, source: "consentimiento" | "baja" | "panel", consentId: string | null, now = new Date(),
) {
  await scope.tx.insert(marketingEvents).values({ studioId: scope.studioId, clientId, granted, source, consentId, createdAt: now });
}

export async function getClient(scope: Scope, clientId: string): Promise<ClientRow> {
  const [row] = await scope.tx.select().from(clients).where(and(eq(clients.studioId, scope.studioId), eq(clients.id, clientId)));
  if (!row) throw new NotFoundError();
  return row;
}

/** Búsqueda por nombre, teléfono o correo (texto) o por DNI exacto (índice ciego). */
export async function listClients(scope: Scope, q = "") {
  const term = q.trim();
  const filters = [eq(clients.studioId, scope.studioId)];
  if (term) {
    const like = `%${term.toLowerCase()}%`;
    filters.push(or(
      sql`lower(${clients.firstName} || ' ' || ${clients.lastName}) like ${like}`,
      sql`lower(${clients.email}) like ${like}`,
      sql`regexp_replace(${clients.phone}, '\\D', '', 'g') like ${"%" + term.replace(/\D/g, "") + "%"} and ${term.replace(/\D/g, "").length >= 3}`,
      eq(clients.dniHash, dniIndex(scope.studioId, term)),
    )!);
  }
  return scope.tx.select().from(clients).where(and(...filters)).orderBy(asc(clients.lastName), asc(clients.firstName));
}
