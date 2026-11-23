import { getStudio, studioIdBySlug } from "@/server/studios";
import { withStudio } from "@/server/tenant";

// Logo público del estudio (aparece en el formulario, el panel y el QR).
export async function GET(_req: Request, ctx: RouteContext<"/s/[slug]/logo">) {
  const { slug } = await ctx.params;
  const studioId = await studioIdBySlug(slug);
  if (!studioId) return new Response("No encontrado", { status: 404 });
  const studio = await withStudio(studioId, { type: "system" }, (scope) => getStudio(scope));
  if (!studio.logo || !studio.logoMime) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(studio.logo), {
    headers: { "Content-Type": studio.logoMime, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
