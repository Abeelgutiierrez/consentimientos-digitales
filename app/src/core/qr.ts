import QRCode from "qrcode";

/** Código QR en SVG (corrección de errores M, como la demo). */
export async function qrSvg(text: string, { size = 260, color = "#111111", margin = 2 } = {}): Promise<string> {
  const svg = await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin,
    width: size,
    color: { dark: color, light: "#ffffff" },
  });
  return svg.replace("<svg ", '<svg role="img" aria-label="Código QR" ');
}
