import { sql } from "@/db/client";

// Comprobación de salud: la app responde y la base de datos está accesible.
export async function GET() {
  try {
    await sql`select 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
