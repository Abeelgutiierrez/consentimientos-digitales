import { withUser } from "@/server/auth";
import { exportClient } from "@/server/gdpr";
import { NotFoundError } from "@/server/tenant";

// Derecho de acceso: descarga un ZIP con todos los datos del cliente (solo dueño/a, auditado).
export async function GET(_req: Request, ctx: RouteContext<"/panel/clientes/[id]/exportar">) {
  const { id } = await ctx.params;
  try {
    const { zip, filename } = await withUser((scope) => exportClient(scope, id), { ownerOnly: true });
    return new Response(new Uint8Array(zip), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return new Response("No encontrado", { status: 404 });
    throw err;
  }
}
