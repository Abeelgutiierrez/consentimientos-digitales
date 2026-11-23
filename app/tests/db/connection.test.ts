import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
afterAll(() => sql.end());

describe("conexión de la aplicación", () => {
  it("usa un rol sin superusuario y sin BYPASSRLS (las políticas RLS se aplican)", async () => {
    const [role] = await sql<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]>`
      select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user`;
    expect(role).toEqual({ rolname: "consent_app", rolsuper: false, rolbypassrls: false });
  });
});
