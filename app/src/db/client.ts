import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Conexión con el rol de la aplicación (consent_app): sin superusuario y sujeto a RLS.
// Se reutiliza entre recargas en desarrollo para no agotar conexiones.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql = globalForDb.sql ?? postgres(env().DATABASE_URL, { max: 10, idle_timeout: 30, prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
