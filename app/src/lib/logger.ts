import "server-only";
import pino from "pino";

// Log estructurado. Regla del proyecto: NUNCA registrar datos personales ni de salud.
// Solo identificadores (ids de estudio, consentimiento, usuario). La redacción es una
// red de seguridad por si alguien pasa un objeto de más, no un permiso para hacerlo.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "*.health", "*.healthNotes", "*.signature", "*.tutorSignature", "*.dni", "*.email", "*.phone",
      "*.firstName", "*.lastName", "*.password", "*.token", "*.cookie", "req.headers.cookie",
      "body", "*.body",
    ],
    censor: "[oculto]",
  },
  base: undefined,
});
