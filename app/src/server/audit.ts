import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { auditEvents } from "@/db/schema";
import type { Scope } from "./tenant";

// Registro de auditoría: quién vio, descargó o cambió qué y cuándo.
// Solo se añade (el rol de la app no puede modificar ni borrar filas). Sin datos personales:
// identificadores y detalles técnicos; el nombre del usuario del panel sí (es quien accede).
export type AuditAction =
  | "consent.signed"
  | "consent.viewed"
  | "consent.pdf_viewed"
  | "consent.pdf_downloaded"
  | "consent.pdf_client_download"
  | "consent.verified"
  | "consent.annex_saved"
  | "consent.purged"
  | "client.viewed"
  | "client.exported"
  | "client.deleted"
  | "client.marketing_changed"
  | "email.sent"
  | "studio.settings_updated"
  | "studio.retention_updated"
  | "user.login"
  | "user.created"
  | "user.updated";

export async function audit(
  scope: Scope,
  action: AuditAction,
  entity: { type: "consent" | "client" | "studio" | "user" | "email"; id: string },
  meta: Record<string, string | number | boolean> = {},
): Promise<void> {
  const a = scope.actor;
  await scope.tx.insert(auditEvents).values({
    studioId: scope.studioId,
    actorType: a.type,
    actorUserId: a.type === "user" ? a.userId : null,
    actorName: a.type === "user" ? a.name : a.type === "client" ? "Cliente (enlace)" : "Sistema",
    action,
    entityType: entity.type,
    entityId: entity.id,
    ip: scope.req.ip.slice(0, 64),
    userAgent: scope.req.userAgent.slice(0, 300),
    meta,
  });
}

export async function auditFor(scope: Scope, entityType: string, entityId: string) {
  return scope.tx.select().from(auditEvents)
    .where(and(eq(auditEvents.studioId, scope.studioId), eq(auditEvents.entityType, entityType), eq(auditEvents.entityId, entityId)))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id));
}
