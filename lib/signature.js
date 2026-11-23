'use strict';
// Las firmas se guardan como trazos vectoriales: { w, h, strokes: [[[x, y], ...], ...] }.
// Así se dibujan nítidas tanto en pantalla (SVG) como en el PDF.

function validate(sig) {
  if (!sig || typeof sig !== 'object') return 'Falta la firma';
  const w = Number(sig.w);
  const h = Number(sig.h);
  if (!(w > 0 && h > 0) || !Array.isArray(sig.strokes)) return 'Firma no válida';
  if (sig.strokes.length > 200) return 'Firma demasiado compleja';
  let points = 0;
  let length = 0;
  for (const s of sig.strokes) {
    if (!Array.isArray(s)) return 'Firma no válida';
    for (let i = 0; i < s.length; i++) {
      const p = s[i];
      if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) return 'Firma no válida';
      if (i > 0) length += Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]);
    }
    points += s.length;
  }
  if (points > 20000) return 'Firma demasiado compleja';
  // Exigimos un mínimo de trazo para evitar "firmas" de un solo toque.
  if (length < Math.min(w, h) * 0.6) return 'La firma es demasiado corta. Firma de nuevo, por favor.';
  return null;
}

function normalize(sig) {
  const r = (n) => Math.round(n * 10) / 10;
  return {
    w: r(Number(sig.w)),
    h: r(Number(sig.h)),
    strokes: sig.strokes.filter((s) => s.length).map((s) => s.map(([x, y]) => [r(x), r(y)])),
  };
}

// Curvas cuadráticas por puntos medios para un trazo suave.
function toPath(sig, scale = 1, offsetX = 0, offsetY = 0) {
  const f = (n) => (Math.round(n * 100) / 100).toString();
  let d = '';
  for (const stroke of sig.strokes) {
    const pts = stroke.map(([x, y]) => [x * scale + offsetX, y * scale + offsetY]);
    if (pts.length === 1) {
      const [x, y] = pts[0];
      d += `M${f(x)} ${f(y)}L${f(x + 0.5)} ${f(y + 0.5)}`;
      continue;
    }
    d += `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(mx)} ${f(my)}`;
    }
    const last = pts[pts.length - 1];
    d += `L${f(last[0])} ${f(last[1])}`;
  }
  return d;
}

function toSvg(sig, { color = '#1b1f3b', width = 2.4 } = {}) {
  if (!sig) return '';
  // El área visible incluye el lienzo y cualquier trazo que se haya salido de él.
  const pts = sig.strokes.flat();
  const minX = Math.min(0, ...pts.map((p) => p[0])) - 4;
  const minY = Math.min(0, ...pts.map((p) => p[1])) - 4;
  const maxX = Math.max(sig.w, ...pts.map((p) => p[0])) + 4;
  const maxY = Math.max(sig.h, ...pts.map((p) => p[1])) + 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" class="sig-svg" role="img" aria-label="Firma"><path d="${toPath(sig)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

module.exports = { validate, normalize, toPath, toSvg };
