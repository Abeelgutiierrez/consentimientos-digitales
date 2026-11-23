import { defineConfig, devices } from "@playwright/test";
import { testEnv } from "./tests/test-env";

const PORT = 3100;

// Flujo completo en vista móvil (el formulario del cliente es móvil primero)
// y el panel en escritorio.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
  },
  projects: [
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Base de datos de test con datos de demo recién cargados y la build de producción
    // (npm run test:e2e hace la build antes).
    command: `npm run e2e:prepare && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { ...testEnv, E2E: "1" },
  },
});
