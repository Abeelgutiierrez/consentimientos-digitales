import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

// Acceso a datos de un estudio. TODA lectura o escritura de datos de un estudio pasa por
// withStudio(): abre una transacción y fija app.studio_id para que las políticas RLS de
// Postgres solo dejen ver ese estudio. Además, cada consulta filtra por studio_id de forma
// explícita (doble barrera: si una falla, la otra sigue protegiendo).

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Actor =
  | { type: "user"; userId: string; name: string; role: "owner" | "artist" }
  | { type: "client" }
  | { type: "system" };

export interface RequestMeta {
  ip: string;
  userAgent: string;
}

export interface Scope {
  readonly studioId: string;
  readonly tx: Tx;
  readonly actor: Actor;
  readonly req: RequestMeta;
}

const NO_REQ: RequestMeta = { ip: "", userAgent: "" };

export async function withStudio<T>(
  studioId: string,
  actor: Actor,
  fn: (scope: Scope) => Promise<T>,
  req: RequestMeta = NO_REQ,
): Promise<T> {
  if (!/^st_[\w-]+$/.test(studioId)) throw new Error("Identificador de estudio no válido");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.studio_id', ${studioId}, true)`);
    return fn({ studioId, tx, actor, req });
  });
}

/** Ejecuta sin contexto de estudio: solo para las funciones SECURITY DEFINER previas al estudio. */
export async function withoutStudio<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx));
}

/** Identificadores con prefijo legible (como en la demo): cs_, cl_, st_… */
export function newId(prefix: string): string {
  return prefix + randomBytes(10).toString("hex");
}

export function assertOwner(scope: Scope): void {
  if (scope.actor.type !== "user" || scope.actor.role !== "owner") {
    throw new ForbiddenError();
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("No tienes permiso para esta acción");
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("No encontrado");
  }
}
