// Autenticación y equipo: login, límite de intentos, sesiones y reglas de permisos.
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { login } from "@/server/auth";
import { tokenHash } from "@/server/crypto";
import { ForbiddenError, withStudio, withoutStudio } from "@/server/tenant";
import { TeamError, changeOwnPassword, createUser, listTeam, resetPassword, updateUser } from "@/server/team";
import { TEST_PASSWORD, artistActor, createTestStudio, owner, ownerActor, type TestStudio } from "./helpers";

let S: TestStudio;
const ownerEmail = () => `dueno@${S.slug}.example`;
const req = (ip = "198.51.100.1") => ({ ip, userAgent: "Test" });

async function sessionFor(token: string) {
  return withoutStudio(async (tx) => (await tx.execute<{ user_id: string; studio_id: string }>(sql`select * from auth_get_session(${tokenHash(token)})`))[0] ?? null);
}

beforeAll(async () => { S = await createTestStudio("Auth"); });

describe("login", () => {
  it("entra con las credenciales correctas (sin distinguir mayúsculas en el correo)", async () => {
    const r = await login(ownerEmail().toUpperCase(), TEST_PASSWORD, req());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.user).toMatchObject({ id: S.ownerUserId, studioId: S.id, role: "owner" });
    expect(await sessionFor(r.token)).toEqual({ user_id: S.ownerUserId, studio_id: S.id, expires_at: expect.anything() });
  });

  it("solo se guarda el hash del token de sesión", async () => {
    const r = await login(ownerEmail(), TEST_PASSWORD, req());
    if (!r.ok) throw new Error("login");
    const own = owner();
    const rows = await own`select token_hash from sessions where user_id = ${S.ownerUserId}`;
    await own.end();
    expect(rows.map((x) => x.token_hash)).toContain(tokenHash(r.token));
    expect(rows.map((x) => x.token_hash)).not.toContain(r.token);
  });

  it("mismo error para correo inexistente y contraseña incorrecta", async () => {
    expect(await login("nadie@ejemplo.test", "x", req("198.51.100.2"))).toEqual({ ok: false, reason: "invalid" });
    expect(await login(ownerEmail(), "incorrecta", req("198.51.100.2"))).toEqual({ ok: false, reason: "invalid" });
  });

  it("bloquea tras 5 intentos fallidos con el mismo correo, aunque luego acierte", async () => {
    const st = await createTestStudio("Bloqueo");
    const email = `artista@${st.slug}.example`;
    for (let i = 0; i < 5; i++) await login(email, "mal", req(`198.51.100.${10 + i}`));
    expect(await login(email, TEST_PASSWORD, req("198.51.100.99"))).toEqual({ ok: false, reason: "locked" });
  });

  it("un usuario desactivado no puede entrar y pierde sus sesiones", async () => {
    const st = await createTestStudio("Baja");
    const email = `artista@${st.slug}.example`;
    const r = await login(email, TEST_PASSWORD, req("198.51.100.50"));
    if (!r.ok) throw new Error("login");
    await withStudio(st.id, ownerActor(st), (s) => updateUser(s, st.artistUserId, { active: false }));
    expect(await sessionFor(r.token)).toBeNull();
    expect(await login(email, TEST_PASSWORD, req("198.51.100.51"))).toEqual({ ok: false, reason: "invalid" });
  });

  it("una sesión caducada no sirve", async () => {
    const r = await login(ownerEmail(), TEST_PASSWORD, req());
    if (!r.ok) throw new Error("login");
    const own = owner();
    await own`update sessions set expires_at = now() - interval '1 minute' where token_hash = ${tokenHash(r.token)}`;
    await own.end();
    expect(await sessionFor(r.token)).toBeNull();
  });
});

describe("equipo", () => {
  it("solo el dueño puede gestionar el equipo", async () => {
    await expect(withStudio(S.id, artistActor(S), (s) => createUser(s, { name: "X", email: "x@ejemplo.test", role: "artist", password: "1234567890", isArtist: false })))
      .rejects.toBeInstanceOf(ForbiddenError);
    await expect(withStudio(S.id, artistActor(S), (s) => resetPassword(s, S.ownerUserId, "1234567890"))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("crea usuarios artistas que aparecen en el formulario y valida los datos", async () => {
    const id = await withStudio(S.id, ownerActor(S), (s) => createUser(s, { name: "Nueva Artista", email: `nueva@${S.slug}.example`, role: "artist", password: "contraseña-larga", isArtist: true }));
    const team = await withStudio(S.id, ownerActor(S), (s) => listTeam(s));
    expect(team.artists.find((a) => a.userId === id)?.name).toBe("Nueva Artista");
    const bad = (input: Partial<Parameters<typeof createUser>[1]>) => withStudio(S.id, ownerActor(S), (s) =>
      createUser(s, { name: "Y", email: `y${Math.random()}@ejemplo.test`, role: "artist", password: "contraseña-larga", isArtist: false, ...input }));
    await expect(bad({ password: "corta" })).rejects.toMatchObject({ code: "passwordShort" });
    await expect(bad({ email: "no-es-correo" })).rejects.toMatchObject({ code: "email" });
    await expect(bad({ email: `NUEVA@${S.slug}.example` })).rejects.toMatchObject({ code: "emailTaken" });
  });

  it("no se puede dejar el estudio sin dueño ni degradarse a uno mismo", async () => {
    await expect(withStudio(S.id, ownerActor(S), (s) => updateUser(s, S.ownerUserId, { active: false }))).rejects.toMatchObject({ code: "selfDemote" });
    const st = await createTestStudio("SinDueño");
    // Otro dueño del mismo estudio intenta desactivar al único dueño activo restante
    const second = await withStudio(st.id, ownerActor(st), (s) => createUser(s, { name: "Dueña 2", email: `d2@${st.slug}.example`, role: "owner", password: "contraseña-larga", isArtist: false }));
    await withStudio(st.id, ownerActor(st), (s) => updateUser(s, second, { active: false }));
    await expect(withStudio(st.id, { type: "user", userId: second, name: "Dueña 2", role: "owner" }, (s) => updateUser(s, st.ownerUserId, { role: "artist" })))
      .rejects.toBeInstanceOf(TeamError);
  });

  it("cambiar la propia contraseña exige la actual y cierra las sesiones", async () => {
    const st = await createTestStudio("Clave");
    const r = await login(`artista@${st.slug}.example`, TEST_PASSWORD, req("198.51.100.70"));
    if (!r.ok) throw new Error("login");
    await expect(withStudio(st.id, artistActor(st), (s) => changeOwnPassword(s, "mal", "otra-contraseña-larga"))).rejects.toMatchObject({ code: "currentPassword" });
    await withStudio(st.id, artistActor(st), (s) => changeOwnPassword(s, TEST_PASSWORD, "otra-contraseña-larga"));
    expect(await sessionFor(r.token)).toBeNull();
    expect((await login(`artista@${st.slug}.example`, "otra-contraseña-larga", req("198.51.100.71"))).ok).toBe(true);
  });

  it("un dueño no puede tocar usuarios de otro estudio", async () => {
    const other = await createTestStudio("Otro");
    await expect(withStudio(S.id, ownerActor(S), (s) => resetPassword(s, other.artistUserId, "contraseña-larga"))).rejects.toThrow(/No encontrado/);
    await expect(withStudio(S.id, ownerActor(S), (s) => updateUser(s, other.artistUserId, { active: false }))).rejects.toThrow(/No encontrado/);
  });
});
