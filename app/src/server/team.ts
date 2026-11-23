import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { artists, users } from "@/db/schema";
import { audit } from "./audit";
import { revokeUserSessions } from "./auth";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "./passwords";
import { NotFoundError, assertOwner, newId, type Scope } from "./tenant";

// Equipo del estudio: usuarios del panel (dueño/artista) y artistas que aparecen en el formulario.
// Solo el dueño gestiona el equipo. Errores como claves de traducción ("team.errors.<clave>").

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class TeamError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export async function listTeam(scope: Scope) {
  const [u, a] = await Promise.all([
    scope.tx.select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active, lastLoginAt: users.lastLoginAt })
      .from(users).where(eq(users.studioId, scope.studioId)).orderBy(asc(users.name)),
    scope.tx.select().from(artists).where(eq(artists.studioId, scope.studioId)).orderBy(asc(artists.sort), asc(artists.name)),
  ]);
  return { users: u, artists: a };
}

function checkPassword(pw: string) {
  if (pw.length < MIN_PASSWORD_LENGTH) throw new TeamError("passwordShort");
}

export async function createUser(scope: Scope, input: { name: string; email: string; role: string; password: string; isArtist: boolean }) {
  assertOwner(scope);
  const name = input.name.trim().slice(0, 80);
  const email = input.email.trim().toLowerCase().slice(0, 160);
  const role = input.role === "owner" ? "owner" : "artist";
  if (!name) throw new TeamError("name");
  if (!EMAIL_RE.test(email)) throw new TeamError("email");
  checkPassword(input.password);
  const id = newId("us_");
  try {
    await scope.tx.insert(users).values({ id, studioId: scope.studioId, name, email, role, passwordHash: await hashPassword(input.password) });
  } catch (err) {
    // Drizzle envuelve el error de Postgres en err.cause (23505 = valor duplicado).
    const pg = (err as { cause?: { code?: string } }).cause ?? (err as { code?: string });
    if (pg.code === "23505") throw new TeamError("emailTaken");
    throw err;
  }
  if (input.isArtist) {
    await scope.tx.insert(artists).values({ id: newId("ar_"), studioId: scope.studioId, name, userId: id, sort: 100 });
  }
  await audit(scope, "user.created", { type: "user", id }, { role });
  return id;
}

async function activeOwners(scope: Scope, excludingUserId: string) {
  const [row] = await scope.tx.select({ n: sql<number>`count(*)::int` }).from(users)
    .where(and(eq(users.studioId, scope.studioId), eq(users.role, "owner"), eq(users.active, true), ne(users.id, excludingUserId)));
  return row?.n ?? 0;
}

export async function updateUser(scope: Scope, userId: string, input: { name?: string; role?: string; active?: boolean }) {
  assertOwner(scope);
  const [current] = await scope.tx.select().from(users).where(and(eq(users.studioId, scope.studioId), eq(users.id, userId)));
  if (!current) throw new NotFoundError();
  const role = input.role === undefined ? current.role : input.role === "owner" ? "owner" : "artist";
  const active = input.active ?? current.active;
  const me = scope.actor.type === "user" ? scope.actor.userId : "";
  if (userId === me && (!active || role !== "owner")) throw new TeamError("selfDemote");
  if (current.role === "owner" && current.active && (role !== "owner" || !active) && (await activeOwners(scope, userId)) === 0) {
    throw new TeamError("lastOwner");
  }
  const name = input.name?.trim().slice(0, 80) || current.name;
  await scope.tx.update(users).set({ name, role, active }).where(and(eq(users.studioId, scope.studioId), eq(users.id, userId)));
  if (!active) await revokeUserSessions(scope, userId);
  await audit(scope, "user.updated", { type: "user", id: userId }, { role, active });
}

/** El dueño pone una contraseña nueva a un usuario (se cierran sus sesiones). */
export async function resetPassword(scope: Scope, userId: string, password: string) {
  assertOwner(scope);
  checkPassword(password);
  const res = await scope.tx.update(users).set({ passwordHash: await hashPassword(password) })
    .where(and(eq(users.studioId, scope.studioId), eq(users.id, userId))).returning({ id: users.id });
  if (!res.length) throw new NotFoundError();
  await revokeUserSessions(scope, userId);
  await audit(scope, "user.updated", { type: "user", id: userId }, { password: true });
}

/** Cada usuario puede cambiar su propia contraseña (requiere la actual). */
export async function changeOwnPassword(scope: Scope, current: string, next: string) {
  if (scope.actor.type !== "user") throw new TeamError("forbidden");
  const userId = scope.actor.userId;
  const [u] = await scope.tx.select().from(users).where(and(eq(users.studioId, scope.studioId), eq(users.id, userId)));
  if (!u || !(await verifyPassword(u.passwordHash, current))) throw new TeamError("currentPassword");
  checkPassword(next);
  await scope.tx.update(users).set({ passwordHash: await hashPassword(next) }).where(and(eq(users.studioId, scope.studioId), eq(users.id, userId)));
  await revokeUserSessions(scope, userId);
  await audit(scope, "user.updated", { type: "user", id: userId }, { password: true });
}

export async function setLocale(scope: Scope, locale: string) {
  if (scope.actor.type !== "user") return;
  await scope.tx.update(users).set({ locale }).where(and(eq(users.studioId, scope.studioId), eq(users.id, scope.actor.userId)));
}

/** Artista sin acceso al panel (solo aparece en el formulario). */
export async function addArtist(scope: Scope, name: string) {
  assertOwner(scope);
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new TeamError("name");
  await scope.tx.insert(artists).values({ id: newId("ar_"), studioId: scope.studioId, name: clean, sort: 100 });
}

export async function setArtistActive(scope: Scope, artistId: string, active: boolean) {
  assertOwner(scope);
  const res = await scope.tx.update(artists).set({ active })
    .where(and(eq(artists.studioId, scope.studioId), eq(artists.id, artistId))).returning({ id: artists.id });
  if (!res.length) throw new NotFoundError();
}
