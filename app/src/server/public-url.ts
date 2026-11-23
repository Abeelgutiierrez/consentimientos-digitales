import "server-only";
import { networkInterfaces } from "node:os";
import { headers } from "next/headers";

// Dirección pública que se codifica en el QR. En producción: PUBLIC_URL.
// En local (como la demo): la IP de la Wi-Fi para que el móvil pueda conectar.
export async function publicBaseUrl(): Promise<{ url: string; lan: boolean }> {
  const fixed = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
  if (fixed) return { url: fixed, lan: false };
  const host = (await headers()).get("host") ?? "localhost:3000";
  const port = host.includes(":") ? host.split(":").pop() : "";
  const ip = Object.values(networkInterfaces()).flat().find((a) => a && a.family === "IPv4" && !a.internal)?.address ?? "localhost";
  return { url: `http://${ip}${port ? `:${port}` : ""}`, lan: true };
}
