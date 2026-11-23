import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

// Las migraciones se generan con drizzle-kit y se revisan a mano (incluyen RLS).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_OWNER_URL ?? "" },
  strict: true,
  verbose: true,
});
