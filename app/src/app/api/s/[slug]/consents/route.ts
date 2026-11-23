import { getLocale } from "next-intl/server";
import { createConsent } from "@/server/consents";
import { allow } from "@/server/rate-limit";
import { requestMeta } from "@/server/request";
import { studioIdBySlug } from "@/server/studios";
import { withStudio } from "@/server/tenant";
import { logger } from "@/lib/logger";

// Recepción del consentimiento firmado desde el móvil del cliente.
// Nunca se registran en logs los datos del formulario (salud incluida).
const MAX_BODY = 1_000_000; // la firma vectorial cabe de sobra

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request, ctx: RouteContext<"/api/s/[slug]/consents">) {
  const { slug } = await ctx.params;
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return json({ error: "tipo" }, 415);
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) return json({ error: "grande" }, 413);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "grande" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "json" }, 400);
  }

  // Máximo 30 envíos cada 10 minutos por conexión (evita spam; un estudio con wifi compartida firma
  // muchos menos). Los envíos con errores de validación también cuentan.
  const meta = await requestMeta();
  if (!allow(`firma|${meta.ip}`, 30, 10 * 60_000)) return json({ error: "limite" }, 429);

  const studioId = await studioIdBySlug(slug);
  if (!studioId) return json({ error: "estudio" }, 404);
  const locale = await getLocale();
  const result = await withStudio(studioId, { type: "client" }, (scope) => createConsent(scope, body, { locale }), meta);
  if ("errors" in result) return json({ errors: result.errors }, 422);

  logger.info({ event: "consent_signed", studioId, consentId: result.consentId }, "Consentimiento firmado");
  return json({ redirect: `/s/${slug}/gracias/${result.consentId}?t=${result.publicToken}` }, 201);
}
