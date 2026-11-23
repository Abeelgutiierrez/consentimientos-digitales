import { audit } from "@/server/audit";
import { getPdf, resolvePublicLink } from "@/server/consents";
import { requestMeta } from "@/server/request";
import { withStudio } from "@/server/tenant";

// Copia del cliente: PDF vigente mediante el enlace con token (caduca a los 30 días).
// Cada descarga queda en la auditoría como «Cliente (enlace)».
export async function GET(req: Request, ctx: RouteContext<"/c/[id]/pdf">) {
  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const link = await resolvePublicLink(id, token);
  if (!link) return new Response("No encontrado", { status: 404 });
  if ("expired" in link) return new Response("Este enlace ha caducado. Pide una copia al estudio.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const pdf = await withStudio(link.studioId, { type: "client" }, async (scope) => {
    const p = await getPdf(scope, id);
    await audit(scope, "consent.pdf_client_download", { type: "consent", id }, { pdfVersion: p.version });
    return p;
  }, await requestMeta());
  return new Response(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="consentimiento-${id}.pdf"`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
