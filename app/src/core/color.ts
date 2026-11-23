// Color de marca del estudio y color de texto legible encima (igual que la demo).
export function safeColor(hex: string | null | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(hex ?? "") ? hex! : "#1f1f2e";
}

export function inkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#ffffff";
  const n = parseInt(m[1]!, 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? "#16161d" : "#ffffff";
}

export function accentStyle(hex: string | null | undefined): Record<string, string> {
  const c = safeColor(hex);
  return { "--accent": c, "--accent-ink": inkFor(c) };
}
