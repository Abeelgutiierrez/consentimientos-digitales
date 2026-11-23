import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, sql as dsql } from "drizzle-orm";
import { loginAttempts, users } from "@/db/schema";
import { db } from "@/db/client";
import { audit } from "./audit";
import { newToken, tokenHash } from "./crypto";
import { burnPasswordCheck, verifyPassword } from "./passwords";
import { requestMeta } from "./request";
import { type Actor, type RequestMeta, type Scope, withStudio, withoutStudio } from "./tenant";
import { logger } from "@/lib/logger";

// Autenticación del panel: sesiones guardadas en la base de datos (solo el hash del token),
// cookie httpOnly, límite de intentos y comprobación en cada página y acción (no en el layout).

export const SESSION_COOKIE = "sesion";
export const SESSION_HOURS = 12;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 20;
const FAIL_WINDOW_MIN = 15;

export interface SessionUser {
  id: string;
  studioId: string;
  name: string;
  email: string;
  role: "owner" | "artist";
  locale: string;
}

const attemptKey = (kind: "email" | "ip", value: string) => tokenHash(`${kind}|${value.toLowerCase()}`);

async function recentFailures(key: string): Promise<number> {
  const since = new Date(Date.now() - FAIL_WINDOW_MIN * 60_000);
  const [row] = await db.select({ n: dsql<number>`count(*)::int` }).from(loginAttempts)
    .where(and(eq(loginAttempts.keyHash, key), gt(loginAttempts.createdAt, since)));
  return row?.n ?? 0;
}

export type LoginResult = { ok: true; token: string; user: SessionUser } | { ok: false; reason: "invalid" | "locked" };

/** Comprueba credenciales y crea la sesión. No dice si el correo existe (mismo mensaje y tiempo). */
export async function login(email: string, password: string, req: RequestMeta): Promise<LoginResult> {
  const normEmail = email.trim().toLowerCase().slice(0, 160);
  const emailKey = attemptKey("email", normEmail);
  const ipKey = attemptKey("ip", req.ip || "desconocida");
  if ((await recentFailures(emailKey)) >= MAX_FAILS_PER_EMAIL || (await recentFailures(ipKey)) >= MAX_FAILS_PER_IP) {
    await burnPasswordCheck(password);
    return { ok: false, reason: "locked" };
  }

  const found = await withoutStudio(async (tx) => {
    const rows = await tx.execute<{ id: string; studio_id: string; password_hash: string; active: boolean }>(
      dsql`select * from auth_find_user(${normEmail})`,
    );
    return rows[0] ?? null;
  });

  const valid = found ? await verifyPassword(found.password_hash, password) : (await burnPasswordCheck(password), false);
  if (!found || !valid || !found.active) {
    await db.insert(loginAttempts).values([{ keyHash: emailKey }, { keyHash: ipKey }]);
    logger.info({ event: "login_failed" }, "Intento de acceso fallido");
    return { ok: false, reason: "invalid" };
  }

  const token = newToken();
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await withoutStudio((tx) => tx.execute(dsql`select auth_create_session(${tokenHash(token)}, ${found.id}, ${expires.toISOString()}::timestamptz, ${req.ip}, ${req.userAgent})`));
  await db.delete(loginAttempts).where(eq(loginAttempts.keyHash, emailKey));

  const user = await withStudio(found.studio_id, { type: "system" }, async (scope) => {
    const [u] = await scope.tx.update(users).set({ lastLoginAt: new Date() })
      .where(and(eq(users.studioId, scope.studioId), eq(users.id, found.id))).returning();
    const su = toSessionUser(u!);
    await audit({ ...scope, actor: actorOf(su) }, "user.login", { type: "user", id: su.id });
    return su;
  }, req);
  logger.info({ event: "login_ok", userId: user.id, studioId: user.studioId }, "Acceso al panel");
  return { ok: true, token, user };
}

function toSessionUser(u: typeof users.$inferSelect): SessionUser {
  return { id: u.id, studioId: u.studioId, name: u.name, email: u.email, role: u.role, locale: u.locale };
}

export function actorOf(u: SessionUser): Actor {
  return { type: "user", userId: u.id, name: u.name, role: u.role };
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

/** Usuario de la sesión actual o null. Se resuelve una vez por petición. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await withoutStudio(async (tx) => {
    const rows = await tx.execute<{ user_id: string; studio_id: string }>(dsql`select * from auth_get_session(${tokenHash(token)})`);
    return rows[0] ?? null;
  });
  if (!session) return null;
  return withStudio(session.studio_id, { type: "system" }, async (scope) => {
    const [u] = await scope.tx.select().from(users)
      .where(and(eq(users.studioId, scope.studioId), eq(users.id, session.user_id), eq(users.active, true)));
    return u ? toSessionUser(u) : null;
  });
});

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/panel?prohibido=1");
  return user;
}

/** Ejecuta con el estudio y la identidad del usuario de la sesión (para páginas y acciones del panel). */
export async function withUser<T>(fn: (scope: Scope, user: SessionUser) => Promise<T>, { ownerOnly = false } = {}): Promise<T> {
  const user = ownerOnly ? await requireOwner() : await requireUser();
  const req = await requestMeta();
  return withStudio(user.studioId, actorOf(user), (scope) => fn(scope, user), req);
}

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await withoutStudio((tx) => tx.execute(dsql`select auth_delete_session(${tokenHash(token)})`));
  store.delete(SESSION_COOKIE);
}

/** Cierra todas las sesiones de un usuario del estudio (al desactivarlo o cambiar su contraseña). */
export async function revokeUserSessions(scope: Scope, userId: string) {
  await scope.tx.execute(dsql`select auth_delete_user_sessions(${userId})`);
}
