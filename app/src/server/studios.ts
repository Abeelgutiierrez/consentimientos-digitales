import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { artists, studios } from "@/db/schema";
import type { StudioSnapshot } from "@/core/evidence";
import { NotFoundError, type Scope, withoutStudio } from "./tenant";

export type StudioRow = typeof studios.$inferSelect;

export async function getStudio(scope: Scope): Promise<StudioRow> {
  const [row] = await scope.tx.select().from(studios).where(eq(studios.id, scope.studioId));
  if (!row) throw new NotFoundError();
  return row;
}

/** Id del estudio a partir del slug público de la URL (función SECURITY DEFINER). */
export async function studioIdBySlug(slug: string): Promise<string | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  return withoutStudio(async (tx) => {
    const rows = await tx.execute<{ id: string | null }>(sql`select public_studio_id(${slug}) as id`);
    return rows[0]?.id ?? null;
  });
}

export function studioSnapshot(s: StudioRow): StudioSnapshot {
  return { id: s.id, name: s.name, cif: s.cif, email: s.email, address: s.address, city: s.city, phone: s.phone };
}

export function studioBranding(s: StudioRow) {
  return { color: s.color, logo: s.logo && s.logoMime ? { bytes: s.logo, mime: s.logoMime } : null };
}

export async function listArtists(scope: Scope, { onlyActive = true } = {}) {
  const where = onlyActive
    ? and(eq(artists.studioId, scope.studioId), eq(artists.active, true))
    : eq(artists.studioId, scope.studioId);
  return scope.tx.select().from(artists).where(where).orderBy(asc(artists.sort), asc(artists.name));
}
