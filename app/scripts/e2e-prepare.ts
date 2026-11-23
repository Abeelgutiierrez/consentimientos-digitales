// Prepara la base de datos de los tests end-to-end: la recrea y carga los datos de demo.
import { runMigrations } from "./migrate";
import { seed } from "./seed";

async function main() {
  const url = process.env.DATABASE_OWNER_URL ?? "";
  if (!/_test(\?|$)/.test(url)) throw new Error("e2e:prepare solo se ejecuta contra una base de datos *_test");
  await runMigrations(url, { reset: true });
  await seed(url, { log: () => {} });
  console.log("Base de datos de e2e lista.");
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
