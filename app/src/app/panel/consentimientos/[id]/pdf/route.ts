import { audit } from "@/server/audit";
import { withUser } from "@/server/auth";
import { getPdf } from "@/server/consents";
import { NotFoundError } from "@/server/tenant";
import { normText } from "@/core/text";
import { isoDateInMadrid } from "@/core/dates";
import { clients } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// PDF desde el panel: ver o descargar (vigente o una versión concreta). Cada acceso se audita.
export async function GET(req: Request, ctx: RouteContext<"/panel/consentimientos/[id]/pdf">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const download = url.searchParams.has("descargar");
  const v = Number(url.searchParams.get("v"));
  try {
    const { pdf, name } = await withUser(async (scope) => {
      const pdf = await getPdf(scope, id, Number.isInteger(v) && v > 0 ? v : undefined);
      await audit(scope, download ? "consent.pdf_downloaded" : "consent.pdf_viewed", { type: "consent", id }, { pdfVersion: pdf.version });
      const [cl] = await scope.tx.select({ firstName: clients.firstName, lastName: clients.lastName }).from(clients)
        .where(and(eq(clients.studioId, scope.studioId), eq(clients.id, pdf.consent.clientId)));
      const who = cl ? normText(`${cl.firstName}-${cl.lastName}`).replace(/[^a-z0-9]+/g, "-") : id;
      return { pdf, name: `consentimiento-${who}-${isoDateInMadrid(pdf.consent.signedAt)}-v${pdf.version}.pdf` };
    });
    return new Response(new Uint8Array(pdf.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return new Response("No encontrado", { status: 404 });
    throw err;
  }
}
