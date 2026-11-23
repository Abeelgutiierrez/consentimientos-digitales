// Variables de entorno de los tests (Vitest y Playwright).
// Claves de cifrado FICTICIAS y fijas: solo protegen datos de prueba ficticios.
export const testEnv: Record<string, string> = {
  TZ: "Europe/Madrid",
  DATA_ENCRYPTION_KEYS: "t1:" + Buffer.alloc(32, 1).toString("base64") + ",t0:" + Buffer.alloc(32, 2).toString("base64"),
  DATA_ENCRYPTION_ACTIVE_KEY: "t1",
  BLIND_INDEX_KEY: Buffer.alloc(32, 3).toString("base64"),
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://consent_app:consent_app_dev@localhost:5433/consentimientos_test",
  DATABASE_OWNER_URL: process.env.TEST_DATABASE_OWNER_URL ?? "postgres://consent_owner:consent_owner_dev@localhost:5433/consentimientos_test",
  LOG_LEVEL: "silent",
  PUBLIC_URL: "http://localhost:3100",
};
