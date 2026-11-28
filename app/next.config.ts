import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Cabeceras de seguridad para todas las respuestas.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // En producción (siempre detrás de HTTPS) obliga al navegador a usar HTTPS.
  ...(process.env.NODE_ENV === "production" && process.env.E2E !== "1"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

// Demo en directo: el móvil del comerciante abre el formulario por la IP de la Wi-Fi.
// En desarrollo, Next bloquea los recursos pedidos desde otro origen si no se permiten aquí.
const localAddresses = Object.values(networkInterfaces()).flatMap((list) =>
  (list ?? []).filter((a) => a.family === "IPv4").map((a) => a.address),
);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", ...localAddresses],
  // Cache Components desactivado a propósito: el panel maneja datos de salud y
  // preferimos que todo sea dinámico, sin cachés de servidor cuyas claves se
  // guardan en texto plano. Ver docs/decisiones.md.
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "pino"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
