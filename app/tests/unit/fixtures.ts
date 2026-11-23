// Datos ficticios para los tests.
import { HEALTH_KEYS } from "@/core/content";

export function fakeSignature(seed = 1) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 80; i++) pts.push([40 + i * 4, 100 + Math.sin(i / 6 + seed) * 30]);
  return { w: 400, h: 200, strokes: [pts] };
}

export const noHealth = () => Object.fromEntries(HEALTH_KEYS.map((k) => [k, false])) as Record<string, boolean>;

export const studioRules = { services: ["tatuaje", "piercing"], artistIds: ["ar_1", "ar_2"] };

export const validBody = () => ({
  firstName: "Prueba", lastName: "Ficticia Uno", dni: "12345678z", birthDate: "1995-03-10",
  email: "Prueba@Example.com", phone: "600 111 222", address: "",
  service: "tatuaje", artistId: "ar_1", zone: "Antebrazo", description: "Línea fina",
  health: noHealth(), healthNotes: "",
  checks: { read: true, privacy: true, marketing: false, images: false },
  signature: fakeSignature(),
});

export const NOW = new Date("2026-11-23T12:00:00Z");
