import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { clients, consents } from "@/db/schema";
import { daysToBirthday } from "@/core/dates";
import { audit } from "./audit";
import { type ClientRow, decryptDni, getClient } from "./clients";
import { listConsents } from "./consents";
import type { Scope } from "./tenant";

// Datos del resumen del panel (mismas métricas que la demo).
export async function dashboardData(scope: Scope) {
  const tz = sql.raw(`'Europe/Madrid'`);
  const [counts] = await scope.tx.select({
    today: sql<number>`count(*) filter (where (${consents.signedAt} at time zone ${tz})::date = (now() at time zone ${tz})::date)::int`,
    week: sql<number>`count(*) filter (where ${consents.signedAt} >= now() - interval '7 days')::int`,
    month: sql<number>`count(*) filter (where date_trunc('month', ${consents.signedAt} at time zone ${tz}) = date_trunc('month', now() at time zone ${tz}))::int`,
    total: sql<number>`count(*)::int`,
    pendingAnnex: sql<number>`count(*) filter (where ${consents.service} <> 'piercing' and ${consents.annexVersion} = 0)::int`,
  }).from(consents).where(eq(consents.studioId, scope.studioId));
  const [cl] = await scope.tx.select({
    total: sql<number>`count(*)::int`,
    marketing: sql<number>`count(*) filter (where ${clients.marketing})::int`,
  }).from(clients).where(eq(clients.studioId, scope.studioId));
  const recent = await listConsents(scope, { limit: 8 });
  const upcoming = await upcomingBirthdays(scope, 30, 6);
  return {
    stats: {
      ...counts!,
      clients: cl!.total,
      marketingPct: cl!.total ? Math.round((cl!.marketing / cl!.total) * 100) : 0,
    },
    recent,
    upcoming,
  };
}

export async function upcomingBirthdays(scope: Scope, withinDays: number, limit = 100, now = new Date()) {
  const rows = await scope.tx.select({
    id: clients.id, firstName: clients.firstName, lastName: clients.lastName, birthDate: clients.birthDate,
    marketing: clients.marketing, email: clients.email,
  }).from(clients).where(eq(clients.studioId, scope.studioId));
  return rows
    .map((c) => ({ client: c, days: daysToBirthday(c.birthDate, now) }))
    .filter((x): x is { client: typeof x.client; days: number } => x.days !== null && x.days <= withinDays)
    .sort((a, b) => a.days - b.days)
    .slice(0, limit);
}

/** Ficha del cliente (con DNI descifrado) y sus consentimientos. Queda en la auditoría. */
export async function clientDetail(scope: Scope, clientId: string) {
  const client: ClientRow = await getClient(scope, clientId);
  const list = await listConsents(scope, { clientId });
  await audit(scope, "client.viewed", { type: "client", id: clientId });
  return { client, dni: decryptDni(client), consents: list };
}

export async function consentCountsByClient(scope: Scope) {
  const rows = await scope.tx.select({ clientId: consents.clientId, n: sql<number>`count(*)::int` })
    .from(consents).where(and(eq(consents.studioId, scope.studioId))).groupBy(consents.clientId);
  return new Map(rows.map((r) => [r.clientId, r.n]));
}
