'use strict';
// Genera un código QR en SVG usando la librería QRCode de Kazuhiko Arase (MIT), incluida en lib/vendor.
const QRCode = require('./vendor/qrcode');
const QRErrorCorrectLevel = require('./vendor/qrcode/QRErrorCorrectLevel');

function qrSvg(text, { size = 320, color = '#111111', margin = 2 } = {}) {
  // La librería codifica bytes: pasamos el texto en UTF-8 como cadena "binaria".
  const bytes = Buffer.from(text, 'utf8').toString('latin1');
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(bytes);
  qr.make();
  const n = qr.getModuleCount();
  const total = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="${color}"/></svg>`;
}

module.exports = { qrSvg };
