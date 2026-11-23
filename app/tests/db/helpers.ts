// Utilidades para tests de base de datos (datos ficticios).
import postgres from "postgres";
import { createConsent } from "@/server/consents";
import { hashPassword } from "@/server/passwords";
import { newId, withStudio, type Actor } from "@/server/tenant";
import { fakeSignature, noHealth } from "../unit/fixtures";

export const owner = () => postgres(process.env.DATABASE_OWNER_URL!, { max: 1, onnotice: () => {} });
export const appConn = () => postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

export const TEST_PASSWORD = "contraseña-de-prueba";
let cachedHash: Promise<string> | null = null;
const testPasswordHash = () => (cachedHash ??= hashPassword(TEST_PASSWORD));

const BIRTHDAY ={ enabled: true, discount: 10, validDays: 365, subject: "Feliz cumple {nombre}", body: "Regalo {descuento}" };

export interface TestStudio {
  id: string;
  slug: string;
  ownerUserId: string;
  artistUserId: string;
  artistId: string;
}

export async function createTestStudio(name: string, services = ["tatuaje", "piercing"]): Promise<TestStudio> {
  const sql = owner();
  try {
    const id = newId("st_");
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${id.slice(-6)}`;
    const ownerUserId = newId("us_");
    const artistUserId = newId("us_");
    const artistId = newId("ar_");
    await sql`insert into studios ${sql({ id, slug, name, services, birthday: sql.json(BIRTHDAY), cif: "B00000000", email: `hola@${slug}.example` })}`;
    const hash = await testPasswordHash();
    await sql`insert into users ${sql({ id: ownerUserId, studio_id: id, email: `dueno@${slug}.example`, name: `Dueño ${name}`, role: "owner", password_hash: hash })}`;
    await sql`insert into users ${sql({ id: artistUserId, studio_id: id, email: `artista@${slug}.example`, name: `Artista ${name}`, role: "artist", password_hash: hash })}`;
    await sql`insert into artists ${sql({ id: artistId, studio_id: id, name: `Artista ${name}`, user_id: artistUserId })}`;
    return { id, slug, ownerUserId, artistUserId, artistId };
  } finally {
    await sql.end();
  }
}

export const ownerActor = (st: TestStudio): Actor => ({ type: "user", userId: st.ownerUserId, name: "Dueño", role: "owner" });
export const artistActor = (st: TestStudio): Actor => ({ type: "user", userId: st.artistUserId, name: "Artista", role: "artist" });

export function consentBody(st: TestStudio, patch: Record<string, unknown> = {}) {
  return {
    firstName: "Persona", lastName: "Ficticia", dni: "12345678Z", birthDate: "1990-05-05",
    email: "persona@example.com", phone: "600000000", address: "",
    service: "tatuaje", artistId: st.artistId, zone: "Antebrazo", description: "Prueba",
    health: { ...noHealth(), alergias: true }, healthNotes: "Alergia ficticia al níquel",
    checks: { read: true, privacy: true, marketing: true, images: false },
    signature: fakeSignature(),
    ...patch,
  };
}

export async function signConsent(st: TestStudio, patch: Record<string, unknown> = {}) {
  return withStudio(st.id, { type: "client" }, async (scope) => {
    const r = await createConsent(scope, consentBody(st, patch), { locale: "es" });
    if ("errors" in r) throw new Error(JSON.stringify(r.errors));
    return r;
  }, { ip: "192.0.2.10", userAgent: "Test/1.0" });
}
