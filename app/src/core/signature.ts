// Firmas vectoriales: { w, h, strokes: [[[x, y], ...], ...] }. Nítidas en pantalla (SVG) y en el PDF.
// Misma lógica que la demo (lib/signature.js).

export type Point = [number, number];
export interface Signature {
  w: number;
  h: number;
  strokes: Point[][];
}

export type SignatureError = "missing" | "invalid" | "tooComplex" | "tooShort";

export function validateSignature(sig: unknown): SignatureError | null {
  if (!sig || typeof sig !== "object") return "missing";
  const s = sig as { w?: unknown; h?: unknown; strokes?: unknown };
  const w = Number(s.w);
  const h = Number(s.h);
  if (!(w > 0 && h > 0) || !Array.isArray(s.strokes)) return "invalid";
  if (s.strokes.length > 200) return "tooComplex";
  let points = 0;
  let length = 0;
  for (const stroke of s.strokes as unknown[]) {
    if (!Array.isArray(stroke)) return "invalid";
    for (let i = 0; i < stroke.length; i++) {
      const p = stroke[i] as unknown;
      if (!Array.isArray(p) || p.length !== 2 || !p.every((n) => typeof n === "number" && Number.isFinite(n))) return "invalid";
      if (i > 0) {
        const prev = stroke[i - 1] as Point;
        length += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      }
    }
    points += stroke.length;
  }
  if (points > 20000) return "tooComplex";
  // Un mínimo de trazo para evitar «firmas» de un solo toque.
  if (length < Math.min(w, h) * 0.6) return "tooShort";
  return null;
}

/** Redondea a 1 decimal y elimina trazos vacíos. Solo para firmas ya validadas. */
export function normalizeSignature(sig: Signature): Signature {
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    w: r(Number(sig.w)),
    h: r(Number(sig.h)),
    strokes: sig.strokes.filter((s) => s.length).map((s) => s.map(([x, y]) => [r(x), r(y)] as Point)),
  };
}

/** Trazado SVG con curvas cuadráticas por puntos medios. */
export function signaturePath(sig: Signature, scale = 1, offsetX = 0, offsetY = 0): string {
  const f = (n: number) => (Math.round(n * 100) / 100).toString();
  let d = "";
  for (const stroke of sig.strokes) {
    const pts = stroke.map(([x, y]) => [x * scale + offsetX, y * scale + offsetY] as Point);
    if (pts.length === 0) continue;
    const first = pts[0]!;
    if (pts.length === 1) {
      d += `M${f(first[0])} ${f(first[1])}L${f(first[0] + 0.5)} ${f(first[1] + 0.5)}`;
      continue;
    }
    d += `M${f(first[0])} ${f(first[1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      d += `Q${f(a[0])} ${f(a[1])} ${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)}`;
    }
    const last = pts[pts.length - 1]!;
    d += `L${f(last[0])} ${f(last[1])}`;
  }
  return d;
}

/** viewBox que incluye el lienzo y cualquier trazo que se haya salido de él. */
export function signatureViewBox(sig: Signature): string {
  const pts = sig.strokes.flat();
  const minX = Math.min(0, ...pts.map((p) => p[0])) - 4;
  const minY = Math.min(0, ...pts.map((p) => p[1])) - 4;
  const maxX = Math.max(sig.w, ...pts.map((p) => p[0])) + 4;
  const maxY = Math.max(sig.h, ...pts.map((p) => p[1])) + 4;
  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
}
