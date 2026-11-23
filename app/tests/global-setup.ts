// Antes de los tests: recrea la base de datos de test desde cero con todas las migraciones.
import { runMigrations } from "../scripts/migrate";
import { testEnv } from "./test-env";

export default async function setup() {
  Object.assign(process.env, testEnv);
  const url = testEnv.DATABASE_OWNER_URL!;
  if (!/_test(\?|$)/.test(url)) throw new Error("Los tests solo se ejecutan contra una base de datos *_test");
  await runMigrations(url, { reset: true });
}
