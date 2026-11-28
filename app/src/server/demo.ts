import "server-only";

// Modo demo: lo que hace falta para enseñar el producto en directo en un comercio
// (QR al móvil del comerciante, entrar al panel con un clic, panel que se actualiza solo).
// Activo fuera de producción, en los tests E2E o si se arranca con DEMO_MODE=1.
// En un despliegue real para clientes NO se pone DEMO_MODE.
export function demoEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.E2E === "1" || process.env.DEMO_MODE === "1";
}

// Propietario de cada estudio de demostración (mismos datos que scripts/seed.ts).
// Entrar con un clic usa el acceso normal con la contraseña pública de demo: no hay
// ningún atajo que se salte la autenticación.
export const DEMO_OWNERS: Record<string, string> = {
  "aguja-fina": "marc@agujafina.example",
  "lumiere-estetica": "elena@lumiere.example",
};
export const DEMO_PASSWORD = "demo1234";

export function isDemoStudio(slug: string): boolean {
  return demoEnabled() && Object.hasOwn(DEMO_OWNERS, slug);
}

/** Enlace que abre el panel del estudio de demo (y, si se indica, una página concreta). */
export function demoPanelHref(slug: string, path = "/panel"): string {
  return `/demo/entrar?estudio=${encodeURIComponent(slug)}&ir=${encodeURIComponent(path)}`;
}
