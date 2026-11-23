import "server-only";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttempts } from "@/db/schema";
import { runBirthdayJob } from "./email";
import { withoutStudio } from "./tenant";
import { logger } from "@/lib/logger";

/** Tareas periódicas: felicitaciones de cumpleaños y limpieza de sesiones e intentos caducados. */
export async function runJobs(now = new Date()) {
  const baseUrl = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "") || undefined;
  const birthdays = await runBirthdayJob(now, baseUrl);
  await withoutStudio((tx) => tx.execute(sql`select auth_purge_expired_sessions()`));
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(now.getTime() - 24 * 3600_000)));
  logger.info({ event: "jobs_done", birthdays }, "Tareas programadas completadas");
  return { birthdays };
}
