// Entorno de Vitest: base de datos de test y claves ficticias (ver tests/test-env.ts).
import { testEnv } from "./test-env";

Object.assign(process.env, testEnv);
