// Correos de cumpleaños (RGPD: solo con consentimiento de marketing), baja y ajustes del estudio.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { blindIndex } from "@/server/crypto";
import { EmailError, birthdayEmail, listEmails, runBirthdayJob, sendBirthday, unsubscribe } from "@/server/email";
import { SettingsError, setLogo, updateStudioSettings } from "@/server/settings";
import { getStudio } from "@/server/studios";
import { ForbiddenError, withStudio } from "@/server/tenant";
import { artistActor, createTestStudio, owner, ownerActor, signConsent, type TestStudio } from "./helpers";

let S: TestStudio;
let withMarketing: string;
let noMarketing: string;
let noEmail: string;
const own = owner();
const NOW = new Date("2027-03-15T10:00:00Z");
const asOwner = <T>(fn: Parameters<typeof withStudio<T>>[2]) => withStudio(S.id, ownerActor(S), fn);

beforeAll(async () => {
  S = await createTestStudio("Correos");
  withMarketing = (await signConsent(S, { dni: "70000001R", firstName: "Cumple", birthDate: "1990-03-15", email: "cumple@example.com" })).clientId;
  noMarketing = (await signConsent(S, { dni: "70000002W", firstName: "SinPromo", birthDate: "1990-03-15", checks: { read: true, privacy: true, marketing: false, images: false } })).clientId;
  noEmail = (await signConsent(S, { dni: "70000003A", firstName: "SinCorreo", birthDate: "1990-03-15", email: "", checks: { read: true, privacy: true, marketing: false, images: false } })).clientId;
});
afterAll(() => own.end());

describe("felicitación de cumpleaños", () => {
  it("no se envía a quien no aceptó promociones ni a quien no tiene correo", async () => {
    await expect(asOwner((s) => sendBirthday(s, noMarketing))).rejects.toEqual(new EmailError("noMarketing"));
    await own`update clients set marketing = true where id = ${noEmail}`;
    await expect(asOwner((s) => sendBirthday(s, noEmail))).rejects.toEqual(new EmailError("noEmail"));
  });

  it("sin clave de Resend se simula y queda registrado con su código y la auditoría", async () => {
    const r = await asOwner((s) => sendBirthday(s, withMarketing, { manual: true, baseUrl: "https://ejemplo.test" }));
    expect(r.status).toBe("simulado");
    const mails = await asOwner((s) => listEmails(s, withMarketing));
    expect(mails[0]).toMatchObject({ id: r.id, toEmail: "cumple@example.com", status: "simulado", manual: true });
    expect(mails[0]!.code).toMatch(/^CUMPLE-CUMPLE-[0-9A-F]{4}$/);
    const [ev] = await own`select action from audit_events where entity_id = ${r.id}`;
    expect(ev?.action).toBe("email.sent");
  });

  it("la tarea automática felicita una sola vez al año y solo a quien toca", async () => {
    const first = await runBirthdayJob(NOW);
    expect(first).toBeGreaterThanOrEqual(1);
    const auto = await own`select client_id from emails where studio_id = ${S.id} and manual = false`;
    expect(auto.map((r) => r.client_id)).toEqual([withMarketing]);
    await runBirthdayJob(NOW);
    const again = await own`select count(*)::int as n from emails where studio_id = ${S.id} and manual = false`;
    expect(again[0]!.n).toBe(1);
  });

  it("si el estudio desactiva las felicitaciones, no se envía nada", async () => {
    const st = await createTestStudio("SinCumples");
    await signConsent(st, { dni: "70000004G", birthDate: "1991-03-15" });
    await own`update studios set birthday = jsonb_set(birthday, '{enabled}', 'false') where id = ${st.id}`;
    await runBirthdayJob(NOW);
    const [row] = await own`select count(*)::int as n from emails where studio_id = ${st.id}`;
    expect(row!.n).toBe(0);
  });

  it("escapa el HTML de nombres y plantillas", () => {
    const studio = { name: "<b>Estudio</b>", color: "#111111", slug: "x", logo: null, birthday: { enabled: true, discount: 10, validDays: 30, subject: "Hola {nombre}", body: "<script>alert(1)</script> {nombre}" } };
    const mail = birthdayEmail(studio, { firstName: "<img src=x onerror=alert(1)>" });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});

describe("baja de promociones", () => {
  it("el enlace del correo da de baja, queda en el historial y ya no se puede enviar", async () => {
    const token = blindIndex("baja", S.id, withMarketing);
    const mail = await own`select html from emails where client_id = ${withMarketing} and manual = true`;
    expect(mail[0]!.html).toContain(`https://ejemplo.test/baja/${token}`);
    expect(await unsubscribe(token)).toEqual({ studioName: "Correos" });
    const [c] = await own`select marketing from clients where id = ${withMarketing}`;
    expect(c!.marketing).toBe(false);
    const events = await own`select granted, source from marketing_events where client_id = ${withMarketing} order by id`;
    expect(events.at(-1)).toEqual({ granted: false, source: "baja" });
    await expect(asOwner((s) => sendBirthday(s, withMarketing))).rejects.toEqual(new EmailError("noMarketing"));
    expect(await unsubscribe(token)).toBeNull();
    expect(await unsubscribe("token-inventado-que-no-existe-123")).toBeNull();
  });
});

describe("ajustes del estudio", () => {
  it("solo el dueño puede cambiarlos", async () => {
    await expect(withStudio(S.id, artistActor(S), (s) => updateStudioSettings(s, { name: "X", cif: "", phone: "", address: "", city: "", email: "", color: "#000000", services: ["tatuaje"] })))
      .rejects.toBeInstanceOf(ForbiddenError);
  });

  it("valida nombre, correo, servicios y color", async () => {
    const base = { name: "Correos Renombrado", cif: "B1", phone: "", address: "", city: "", email: "hola@ejemplo.test", color: "#AABBCC", services: ["tatuaje", "inventado"] };
    await asOwner((s) => updateStudioSettings(s, base));
    const studio = await asOwner((s) => getStudio(s));
    expect(studio).toMatchObject({ name: "Correos Renombrado", color: "#aabbcc", services: ["tatuaje"] });
    await expect(asOwner((s) => updateStudioSettings(s, { ...base, services: [] }))).rejects.toEqual(new SettingsError("services"));
    await expect(asOwner((s) => updateStudioSettings(s, { ...base, email: "no" }))).rejects.toEqual(new SettingsError("email"));
    await asOwner((s) => updateStudioSettings(s, { ...base, color: "red;}" }));
    expect((await asOwner((s) => getStudio(s))).color).toBe("#aabbcc");
  });

  it("el logo tiene que ser un PNG o JPG de verdad y de menos de 400 KB", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    await asOwner((s) => setLogo(s, png));
    expect((await asOwner((s) => getStudio(s))).logoMime).toBe("image/png");
    await expect(asOwner((s) => setLogo(s, Buffer.from("<svg onload=alert(1)>")))).rejects.toEqual(new SettingsError("logoType"));
    await expect(asOwner((s) => setLogo(s, Buffer.concat([png, Buffer.alloc(400 * 1024)])))).rejects.toEqual(new SettingsError("logoSize"));
    await asOwner((s) => setLogo(s, null));
    expect((await asOwner((s) => getStudio(s))).logo).toBeNull();
  });
});
