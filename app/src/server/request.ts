import "server-only";
import { headers } from "next/headers";
import type { RequestMeta } from "./tenant";

// IP y navegador de la petición, para evidencias y auditoría.
// Detrás de un proxy (producción) la IP real llega en X-Forwarded-For.
export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  let ip = (fwd ? fwd.split(",")[0] : h.get("x-real-ip")) ?? "";
  ip = ip.trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return { ip: ip.slice(0, 64), userAgent: (h.get("user-agent") ?? "").slice(0, 300) };
}
