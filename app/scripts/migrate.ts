// Aplica las migraciones con el rol propietario.
//   npm run db:migrate            → aplica las pendientes
//   npm run db:reset              → BORRA la base de datos de desarrollo y la recrea (solo fuera de producción)
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";


export async function runMigrations(url: string, { reset = false } = {}) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    if (reset) {
      if (process.env.NODE_ENV === "production") throw new Error("db:reset no está permitido en producción.");
      await sql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      await sql.unsafe("DROP FUNCTION IF EXISTS app_studio_id() CASCADE;");
    }
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) throw new Error("Falta DATABASE_OWNER_URL (ver .env.example)");
  const reset = process.argv.includes("--reset");
  runMigrations(url, { reset })
    .then(() => console.log(reset ? "Base de datos recreada y migrada." : "Migraciones aplicadas."))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
