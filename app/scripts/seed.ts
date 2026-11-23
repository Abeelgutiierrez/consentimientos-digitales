/*
 * Datos de demostración (TODOS FICTICIOS), equivalentes a los de la demo:
 * 2 estudios, sus usuarios (dueño y artistas) y 14 clientes con consentimientos firmados.
 *   npm run db:seed      → vacía los datos y vuelve a cargar la demo (solo fuera de producción)
 * Las fechas se calculan respecto a hoy para que siempre haya cumpleaños próximos.
 * Contraseña de todos los usuarios de demo: demo1234
 */
import postgres from "postgres";
import { HEALTH_KEYS } from "@/core/content";
import { createConsent, saveAnnex } from "@/server/consents";
import { hashPassword } from "@/server/passwords";
import { newId, withStudio } from "@/server/tenant";
import type { BirthdaySettings } from "@/db/schema";


export const DEMO_PASSWORD = "demo1234";

const DEFAULT_BIRTHDAY: BirthdaySettings = {
  enabled: true,
  discount: 10,
  validDays: 365,
  subject: "¡Feliz cumpleaños, {nombre}! Tienes un {descuento} de regalo 🎁",
  body: "Hoy es tu día y en {estudio} queremos celebrarlo contigo.\n\nTe regalamos un {descuento} de descuento en tu próxima sesión. Solo tienes que enseñar el código al reservar.\n\n¡Te esperamos!",
};

function dni(n: number) {
  return String(n).padStart(8, "0") + "TRWAGMYFPDXBNJZSQVHLCKE"[n % 23];
}

// Firma sintética con aspecto manuscrito (determinista a partir de una semilla).
function fakeSignature(seed: number) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const strokes: [number, number][][] = [];
  const main: [number, number][] = [];
  const loops = 4 + Math.floor(rnd() * 3);
  const amp = 26 + rnd() * 20;
  for (let i = 0; i <= 140; i++) {
    const t = i / 140;
    const y = 112 - Math.sin(t * Math.PI * loops) * amp * (1 - t * 0.5) + Math.cos(t * Math.PI * loops * 2.1) * 12 - t * 18;
    main.push([60 + t * 330 + Math.sin(t * 40) * 6, y]);
  }
  strokes.push(main);
  const cap: [number, number][] = [];
  for (let i = 0; i <= 30; i++) { const t = i / 30; cap.push([48 + Math.sin(t * Math.PI * 1.6) * 18 + t * 10, 70 + t * 80]); }
  strokes.push(cap);
  const under: [number, number][] = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; under.push([80 + t * 340, 160 + Math.sin(t * Math.PI) * 6 - t * 10 + rnd() * 2]); }
  strokes.push(under);
  return { w: 500, h: 210, strokes };
}

const UA = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36",
];

function birthIn(inDays: number, age: number) {
  const d = new Date();
  d.setDate(d.getDate() + inDays);
  return `${d.getFullYear() - age}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgo(n: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor((n * 37) % 60), 0, 0);
  // Nunca en el futuro (si se ejecuta de madrugada)
  return d.getTime() > Date.now() ? new Date(Date.now() - 60_000) : d;
}

type Person = [
  first: string, last: string, bdayIn: number, age: number, email: string, marketing: boolean, service: string,
  zone: string, description: string, artist: string, ago: number, hour: number,
  health?: Record<string, boolean> | null, notes?: string | null,
  minor?: { tutorName: string; tutorDni: string; relation: string; maturityCert: boolean },
];

const PEOPLE_A: Person[] = [
  ["Laura", "Puig Serra", 0, 29, "laura.puig@example.com", true, "tatuaje", "Antebrazo izquierdo", "Ramo de lavanda fine line, 12 cm", "Marc Soler", 2, 11],
  ["Jordi", "Vidal Roca", 2, 34, "jordi.vidal@example.com", true, "tatuaje", "Gemelo derecho", "Brújula realista en negro y grises", "Laia Ferrer", 5, 17],
  ["Marta", "Casals Riera", 9, 26, "marta.casals@example.com", true, "piercing", "Hélix oreja izquierda", "Aro de titanio 8 mm", "Àlex Mora", 1, 12],
  ["Sergi", "Font Bosch", 15, 41, "", false, "tatuaje", "Espalda (omóplato)", "Continuación de pieza japonesa, 2.ª sesión", "Marc Soler", 12, 10, { medicacion: true }, "Tomo ibuprofeno puntualmente por dolor lumbar. No lo he tomado hoy."],
  ["Núria", "Pons Martí", 22, 31, "nuria.pons@example.com", false, "tatuaje", "Clavícula", "Frase \"respira\" en lettering", "Laia Ferrer", 18, 16],
  ["Pau", "Grau Soler", 37, 23, "pau.grau@example.com", true, "tatuaje", "Muñeca derecha", "Línea de montañas minimalista", "Laia Ferrer", 0, 10],
  ["Aina", "Coll Vila", 48, 17, "aina.coll@example.com", true, "piercing", "Lóbulo derecho (2.º agujero)", "Pendiente de titanio", "Àlex Mora", 7, 18, null, null, { tutorName: "Montse Vila Prat", tutorDni: dni(38291045), relation: "Madre", maturityCert: false }],
  ["David", "Ribas Costa", 64, 38, "david.ribas@example.com", true, "tatuaje", "Brazo derecho (manga)", "Manga blackwork, 3.ª sesión", "Marc Soler", 25, 12, { alergias: true }, "Alergia leve al látex. El artista usa guantes de nitrilo."],
  ["Clara", "Mas Ferrer", 90, 27, "clara.mas@example.com", true, "tatuaje", "Costillas", "Golondrina neotradicional a color", "Laia Ferrer", 33, 15],
  ["Oriol", "Sala Prat", 130, 45, "oriol.sala@example.com", false, "tatuaje", "Tobillo izquierdo", "Retoque de tatuaje antiguo", "Marc Soler", 40, 11],
  ["Júlia", "Torres Camps", 180, 21, "julia.torres@example.com", true, "piercing", "Nostril", "Stud de titanio 2 mm", "Àlex Mora", 3, 19],
];

const PEOPLE_B: Person[] = [
  ["Rosa", "Batlle Pujol", 4, 47, "rosa.batlle@example.com", true, "micropigmentacion", "Cejas", "Microblading pelo a pelo, tono castaño", "Elena Rius", 6, 10],
  ["Anna", "Ventura Soler", 0, 39, "anna.ventura@example.com", true, "micropigmentacion", "Labios", "Labios acuarela, tono nude", "Elena Rius", 10, 12],
  ["Carme", "Valls Roig", 28, 55, "", false, "micropigmentacion", "Eyeliner superior", "Delineado fino", "Elena Rius", 21, 17, { coagulacion: true, medicacion: true }, "Tomo Adiro 100 mg. Consultado con mi médico, autoriza el tratamiento."],
];

const INK_BRANDS = [["World Famous", "Negro Lining"], ["Eternal Ink", "Triple Black"], ["Dynamic", "Gris medio"], ["Intenze", "Rojo cereza"]] as const;
const PMU_INK = [["Perma Blend", "Chocolate"], ["Li Pigments", "Nude"]] as const;

interface StudioSeed {
  slug: string; name: string; color: string; services: string[]; city: string; address: string; cif: string; phone: string; email: string;
  users: { name: string; email: string; role: "owner" | "artist"; artist: boolean }[];
}

const STUDIOS: StudioSeed[] = [
  {
    slug: "aguja-fina", name: "Aguja Fina Tattoo", color: "#111111", services: ["tatuaje", "piercing"],
    city: "08700 Igualada", address: "Carrer de l’Exemple, 12", cif: "B00000000", phone: "938 00 00 00", email: "hola@agujafina.example",
    users: [
      { name: "Marc Soler", email: "marc@agujafina.example", role: "owner", artist: true },
      { name: "Laia Ferrer", email: "laia@agujafina.example", role: "artist", artist: true },
      { name: "Àlex Mora", email: "alex@agujafina.example", role: "artist", artist: true },
    ],
  },
  {
    slug: "lumiere-estetica", name: "Lumière Estètica", color: "#8c5a4a", services: ["micropigmentacion"],
    city: "08700 Igualada", address: "Passeig de Prova, 5", cif: "B11111111", phone: "938 11 11 11", email: "info@lumiere.example",
    users: [{ name: "Elena Rius", email: "elena@lumiere.example", role: "owner", artist: true }],
  },
];

export async function seed(ownerUrl: string, { log = console.log } = {}) {
  if (process.env.NODE_ENV === "production") throw new Error("El seed de demo no se ejecuta en producción.");
  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const created: { id: string; seed: StudioSeed; artistIds: Map<string, string> }[] = [];
  try {
    await sql`truncate studios, login_attempts restart identity cascade`;
    for (const s of STUDIOS) {
      const studioId = newId("st_");
      await sql`insert into studios ${sql({
        id: studioId, slug: s.slug, name: s.name, color: s.color, services: s.services, city: s.city, address: s.address,
        cif: s.cif, phone: s.phone, email: s.email, birthday: sql.json(DEFAULT_BIRTHDAY as never), retention_note: "Pendiente de definir con el asesor legal.",
      })}`;
      const artistIds = new Map<string, string>();
      let sort = 0;
      for (const u of s.users) {
        const userId = newId("us_");
        await sql`insert into users ${sql({ id: userId, studio_id: studioId, email: u.email, name: u.name, role: u.role, password_hash: passwordHash })}`;
        if (u.artist) {
          const artistId = newId("ar_");
          await sql`insert into artists ${sql({ id: artistId, studio_id: studioId, name: u.name, user_id: userId, sort: sort++ })}`;
          artistIds.set(u.name, artistId);
        }
      }
      created.push({ id: studioId, seed: s, artistIds });
    }
  } finally {
    await sql.end();
  }

  let consentsCount = 0;
  for (const [i, people] of [PEOPLE_A, PEOPLE_B].entries()) {
    const st = created[i]!;
    const inks = i === 0 ? INK_BRANDS : PMU_INK;
    let n = 0;
    for (const [firstName, lastName, bdayIn, age, email, marketing, service, zone, description, artist, ago, hour, health, notes, minor] of people) {
      n++;
      const body = {
        firstName, lastName, dni: dni(45000000 + n * 7919 + firstName.length * 131 + i * 104729), birthDate: birthIn(bdayIn, age),
        email, phone: `6${String(10000000 + n * 1234567).slice(0, 8)}`, address: "",
        service, zone, description, artistId: st.artistIds.get(artist),
        health: { ...Object.fromEntries(HEALTH_KEYS.map((k) => [k, false])), ...(health ?? {}) }, healthNotes: notes ?? "",
        checks: { read: true, privacy: true, marketing, images: n % 3 === 0 },
        signature: fakeSignature(n * 97 + firstName.length),
        ...(minor ? { minor, tutorSignature: fakeSignature(n * 13 + 5) } : {}),
      };
      const signedAt = daysAgo(ago, hour);
      await withStudio(st.id, { type: "client" }, async (scope) => {
        const r = await createConsent(scope, body, { locale: "es", now: signedAt });
        if ("errors" in r) throw new Error(`Seed inválido para ${firstName}: ${JSON.stringify(r.errors)}`);
        consentsCount++;
        if (service !== "piercing" && ago >= 3) {
          const pick = inks.slice(0, 1 + (n % inks.length));
          await saveAnnex(
            { ...scope, actor: { type: "system" } },
            r.consentId,
            {
              inks: pick.map(([brand, color], j) => ({
                brand, color, lot: `L${24 + j}${String(1000 + n * 37).slice(0, 4)}`,
                expiry: `${new Date().getFullYear() + 1}-0${1 + (n % 8)}-15`, aemps: `${7810 + n + j}-TAT`,
              })),
              needles: service === "micropigmentacion" ? "Nanoagujas 0.18 mm, lote N2291" : "Cartuchos 3RL y 9M1, lote C5520",
              notes: "", applicator: artist,
            },
            new Date(signedAt.getTime() + 2 * 3600_000 > Date.now() ? Date.now() : signedAt.getTime() + 2 * 3600_000),
          );
        }
      }, { ip: `192.168.1.${30 + n}`, userAgent: UA[n % UA.length]! });
    }
  }
  log(`Demo cargada: ${created.length} estudios, ${consentsCount} consentimientos. Usuarios: ${STUDIOS.flatMap((s) => s.users.map((u) => u.email)).join(", ")} (contraseña ${DEMO_PASSWORD}).`);
  return created.map((c) => ({ id: c.id, slug: c.seed.slug }));
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) throw new Error("Falta DATABASE_OWNER_URL (ver .env.example)");
  seed(url)
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
