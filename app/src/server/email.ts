import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { clients, emails, studios } from "@/db/schema";
import { addDays, daysToBirthday, fmtLongDate, isoDateInMadrid } from "@/core/dates";
import { safeColor } from "@/core/color";
import { audit } from "./audit";
import { logMarketing } from "./clients";
import { blindIndex, tokenHash } from "./crypto";
import { getStudio, type StudioRow } from "./studios";
import { NotFoundError, newId, type Scope, withStudio, withoutStudio } from "./tenant";
import { logger } from "@/lib/logger";

// Correos de cumpleaños con descuento (solo a quien aceptó promociones).
// Sin RESEND_API_KEY + RESEND_FROM se simulan: se guardan en «Correos enviados».

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fill = (template: string, vars: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k]! : m));

export function couponCode(firstName: string): string {
  const base = (firstName || "CLIENTE").normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 6) || "CLIENTE";
  return `CUMPLE-${base}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export interface MailContent {
  subject: string;
  html: string;
  code: string;
  validUntil: string;
}

export function birthdayEmail(
  studio: Pick<StudioRow, "name" | "color" | "slug" | "birthday" | "logo">,
  client: { firstName: string },
  opts: { now?: Date; baseUrl?: string; unsubscribeUrl?: string } = {},
): MailContent {
  const cfg = studio.birthday;
  const code = couponCode(client.firstName);
  const validUntil = addDays(isoDateInMadrid(opts.now ?? new Date()), cfg.validDays);
  const vars = { nombre: client.firstName, estudio: studio.name, descuento: `${cfg.discount}%`, codigo: code, caducidad: fmtLongDate(validUntil) };
  const subject = fill(cfg.subject, vars);
  const paragraphs = fill(cfg.body, vars).split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const color = safeColor(studio.color);
  const logo = studio.logo && opts.baseUrl
    ? `<img src="${esc(`${opts.baseUrl}/s/${studio.slug}/logo`)}" alt="${esc(studio.name)}" style="max-height:56px;max-width:180px;margin-bottom:8px">`
    : `<div style="font-size:20px;font-weight:700;color:#fff">${esc(studio.name)}</div>`;
  const unsubscribe = opts.unsubscribeUrl
    ? `<a href="${esc(opts.unsubscribeUrl)}" style="color:#8a8a94">Darme de baja de las promociones</a>.`
    : "Puedes darte de baja en cualquier momento respondiendo a este correo.";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f3f2ef;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1d24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f2ef;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${color};padding:26px 28px;text-align:center">${logo}</td></tr>
<tr><td style="padding:30px 28px 10px;font-size:15px">
<div style="font-size:24px;font-weight:700;margin-bottom:14px">¡Feliz cumpleaños, ${esc(client.firstName)}!</div>
${paragraphs}
</td></tr>
<tr><td style="padding:6px 28px 26px" align="center">
<div style="border:2px dashed ${color};border-radius:12px;padding:18px;text-align:center">
<div style="font-size:13px;color:#6b6b76;text-transform:uppercase;letter-spacing:.08em">Tu regalo</div>
<div style="font-size:40px;font-weight:800;color:${color};line-height:1.2">${esc(cfg.discount)}% dto.</div>
<div style="font-family:Consolas,Menlo,monospace;font-size:18px;font-weight:700;letter-spacing:.06em;margin-top:6px">${esc(code)}</div>
<div style="font-size:12px;color:#6b6b76;margin-top:6px">Válido hasta el ${esc(vars.caducidad)}</div>
</div></td></tr>
<tr><td style="padding:0 28px 28px;font-size:12px;color:#8a8a94;line-height:1.5">
Recibes este correo porque aceptaste recibir comunicaciones de ${esc(studio.name)}. ${unsubscribe}
</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, code, validUntil };
}

export function emailMode(): "real" | "simulado" {
  return process.env.RESEND_API_KEY && process.env.RESEND_FROM ? "real" : "simulado";
}

async function deliver(to: string, mail: MailContent, unsubscribeUrl: string | null): Promise<{ status: "simulado" | "enviado" | "error"; error: string }> {
  if (emailMode() === "simulado") return { status: "simulado", error: "" };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: [to],
      subject: mail.subject,
      html: mail.html,
      ...(unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } } : {}),
    });
    if (error) return { status: "error", error: String(error.message ?? error).slice(0, 300) };
    return { status: "enviado", error: "" };
  } catch (err) {
    return { status: "error", error: String((err as Error).message ?? err).slice(0, 300) };
  }
}

export class EmailError extends Error {
  constructor(readonly code: "noMarketing" | "noEmail") {
    super(code);
  }
}

/** Envía (o simula) la felicitación. Exige consentimiento de marketing y correo (RGPD). */
export async function sendBirthday(scope: Scope, clientId: string, opts: { manual?: boolean; now?: Date; baseUrl?: string } = {}) {
  const now = opts.now ?? new Date();
  const [client] = await scope.tx.select().from(clients).where(and(eq(clients.studioId, scope.studioId), eq(clients.id, clientId)));
  if (!client) throw new NotFoundError();
  if (client.marketing !== true) throw new EmailError("noMarketing");
  if (!client.email) throw new EmailError("noEmail");
  const studio = await getStudio(scope);

  // Enlace de baja: token estable por cliente (HMAC con la clave secreta), así los enlaces de
  // correos anteriores siguen funcionando. En la base de datos solo se guarda su hash.
  const token = blindIndex("baja", scope.studioId, clientId);
  await scope.tx.update(clients).set({ unsubscribeTokenHash: tokenHash(token) })
    .where(and(eq(clients.studioId, scope.studioId), eq(clients.id, clientId)));
  const unsubscribeUrl = opts.baseUrl ? `${opts.baseUrl}/baja/${token}` : null;

  const mail = birthdayEmail(studio, client, { now, baseUrl: opts.baseUrl, unsubscribeUrl: unsubscribeUrl ?? undefined });
  const result = await deliver(client.email, mail, unsubscribeUrl);
  const id = newId("em_");
  await scope.tx.insert(emails).values({
    id, studioId: scope.studioId, clientId, kind: "cumpleanos", toEmail: client.email, subject: mail.subject, html: mail.html,
    code: mail.code, validUntil: mail.validUntil, status: result.status, error: result.error, manual: !!opts.manual,
    year: Number(isoDateInMadrid(now).slice(0, 4)), createdAt: now,
  });
  await audit(scope, "email.sent", { type: "email", id }, { status: result.status, manual: !!opts.manual });
  if (result.status === "error") logger.warn({ event: "email_error", studioId: scope.studioId, emailId: id }, "Error al enviar correo");
  return { id, status: result.status };
}

export async function listEmails(scope: Scope, clientId?: string) {
  const where = clientId ? and(eq(emails.studioId, scope.studioId), eq(emails.clientId, clientId)) : eq(emails.studioId, scope.studioId);
  return scope.tx.select({
    id: emails.id, clientId: emails.clientId, toEmail: emails.toEmail, subject: emails.subject, code: emails.code,
    status: emails.status, manual: emails.manual, createdAt: emails.createdAt,
  }).from(emails).where(where).orderBy(desc(emails.createdAt));
}

export async function getEmail(scope: Scope, id: string) {
  const [row] = await scope.tx.select().from(emails).where(and(eq(emails.studioId, scope.studioId), eq(emails.id, id)));
  if (!row) throw new NotFoundError();
  return row;
}

export async function automaticSentThisYear(scope: Scope, now = new Date()) {
  const [row] = await scope.tx.select({ n: sql<number>`count(*)::int` }).from(emails)
    .where(and(eq(emails.studioId, scope.studioId), eq(emails.kind, "cumpleanos"), eq(emails.manual, false), eq(emails.year, Number(isoDateInMadrid(now).slice(0, 4)))));
  return row?.n ?? 0;
}

/**
 * Tarea programada: felicita a quien cumple hoy (una vez al año, solo si el estudio lo tiene activado
 * y la persona aceptó promociones). Recorre cada estudio con su propio contexto.
 */
export async function runBirthdayJob(now = new Date(), baseUrl?: string): Promise<number> {
  const ids = await withoutStudio(async (tx) => (await tx.execute<{ id: string }>(sql`select system_studio_ids() as id`)).map((r) => r.id));
  let sent = 0;
  const year = Number(isoDateInMadrid(now).slice(0, 4));
  for (const studioId of ids) {
    sent += await withStudio(studioId, { type: "system" }, async (scope) => {
      const [studio] = await scope.tx.select({ birthday: studios.birthday }).from(studios).where(eq(studios.id, studioId));
      if (!studio?.birthday.enabled) return 0;
      const candidates = await scope.tx.select({ id: clients.id, birthDate: clients.birthDate }).from(clients)
        .where(and(eq(clients.studioId, studioId), eq(clients.marketing, true), sql`${clients.email} <> ''`));
      let n = 0;
      for (const c of candidates) {
        if (daysToBirthday(c.birthDate, now) !== 0) continue;
        const [already] = await scope.tx.select({ id: emails.id }).from(emails)
          .where(and(eq(emails.studioId, studioId), eq(emails.clientId, c.id), eq(emails.kind, "cumpleanos"), eq(emails.manual, false), eq(emails.year, year)));
        if (already) continue;
        await sendBirthday(scope, c.id, { now, baseUrl });
        n++;
      }
      return n;
    });
  }
  return sent;
}

/** Baja de promociones desde el enlace del correo. */
export async function unsubscribe(token: string, req = { ip: "", userAgent: "" }): Promise<{ studioName: string } | null> {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const found = await withoutStudio(async (tx) => (await tx.execute<{ client_id: string; studio_id: string }>(
    sql`select * from public_client_by_unsubscribe(${tokenHash(token)})`))[0] ?? null);
  if (!found) return null;
  return withStudio(found.studio_id, { type: "client" }, async (scope) => {
    const now = new Date();
    const [c] = await scope.tx.update(clients).set({ marketing: false, marketingAt: now, unsubscribeTokenHash: null, updatedAt: now })
      .where(and(eq(clients.studioId, scope.studioId), eq(clients.id, found.client_id))).returning({ id: clients.id });
    if (!c) return null;
    await logMarketing(scope, c.id, false, "baja", null, now);
    await audit(scope, "client.marketing_changed", { type: "client", id: c.id }, { marketing: false, source: "baja" });
    return { studioName: (await getStudio(scope)).name };
  }, req);
}
