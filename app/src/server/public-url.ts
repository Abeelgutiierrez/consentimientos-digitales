import "server-only";
import { networkInterfaces } from "node:os";
import { headers } from "next/headers";

// Adaptadores virtuales (WSL, Hyper-V, VirtualBox, VMware, Docker): el móvil no llega a ellos.
const VIRTUAL = /vethernet|wsl|hyper-v|virtualbox|vmware|vmnet|docker|loopback|bluetooth/i;

/** IP de la red local a la que puede conectar un móvil: primero la Wi-Fi, luego una red real. */
export function lanAddress(): string {
  const candidates = Object.entries(networkInterfaces()).flatMap(([name, list]) =>
    (list ?? []).filter((a) => a.family === "IPv4" && !a.internal).map((a) => ({ name, address: a.address })),
  );
  const score = ({ name, address }: { name: string; address: string }) =>
    (/wi-?fi|wlan|wireless/i.test(name) ? 4 : 0) +
    (VIRTUAL.test(name) ? -4 : 0) +
    // Los adaptadores «solo anfitrión» de las máquinas virtuales suelen ser la .1 de su red.
    (address.endsWith(".1") ? -1 : 1);
  return candidates.sort((a, b) => score(b) - score(a))[0]?.address ?? "localhost";
}

// Dirección pública que se codifica en el QR. En producción: PUBLIC_URL.
// En local (como la demo): la IP de la Wi-Fi para que el móvil pueda conectar.
export async function publicBaseUrl(): Promise<{ url: string; lan: boolean }> {
  const fixed = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
  if (fixed) return { url: fixed, lan: false };
  const host = (await headers()).get("host") ?? "localhost:3000";
  const port = host.includes(":") ? host.split(":").pop() : "";
  return { url: `http://${lanAddress()}${port ? `:${port}` : ""}`, lan: true };
}
