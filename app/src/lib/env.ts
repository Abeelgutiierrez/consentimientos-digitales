import "server-only";
import { z } from "zod";

// Variables de entorno validadas al primer uso. Fallar pronto y con un mensaje claro
// es mejor que descubrir en producción que falta la clave de cifrado.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATA_ENCRYPTION_KEYS: z.string().min(1),
  DATA_ENCRYPTION_ACTIVE_KEY: z.string().min(1),
  BLIND_INDEX_KEY: z.string().min(1),
  PUBLIC_URL: z.string().url().optional().or(z.literal("")),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuración incompleta. Revisa .env.local (variables: ${missing}). Ver README.`);
  }
  cached = parsed.data;
  return cached;
}
