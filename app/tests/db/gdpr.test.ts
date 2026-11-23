// RGPD: conservación con purga confirmada, exportación (derecho de acceso) y consulta de la auditoría.
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sha256Hex } from "@/core/canonical";
import { sendBirthday } from "@/server/email";
import { exportClient, listAudit, purgeCandidates, purgeConsents, setRetention } from "@/server/gdpr";
import { ForbiddenError, NotFoundError, withStudio } from "@/server/tenant";
import { artistActor, createTestStudio, owner, ownerActor, signConsent, type TestStudio } from "./helpers";

let S: TestStudio;
const own = owner();
afterAll(() => own.end());
beforeAll(async () => { S = await createTestStudio("Rgpd"); });
const asOwner = <T>(fn: Parameters<typeof withStudio<T>>[2]) => withStudio(S.id, ownerActor(S), fn);

describe("conservación", () => {
  it("sin plazo definido no hay nada que purgar", async () => {
    await signConsent(S, { dni: "80000001V" });
    await own`update consents set signed_at = now() - interval '20 years' where studio_id = ${S.id}`;
    expect(await asOwner((s) => purgeCandidates(s))).toEqual([]);
  });

  it("al fijar el plazo se recalculan las fechas y aparecen los vencidos, sin borrar nada", async () => {
    await asOwner((s) => setRetention(s, 5, "Plazo provisional de prueba"));
    const due = await asOwner((s) => purgeCandidates(s));
    expect(due).toHaveLength(1);
    const [row] = await own`select purge_after::text as d, (signed_at at time zone 'Europe/Madrid')::date::text as s from consents where studio_id = ${S.id}`;
    expect(Number(row!.d.slice(0, 4)) - Number(row!.s.slice(0, 4))).toBe(5);
    const [n] = await own`select count(*)::int as n from consents where studio_id = ${S.id}`;
    expect(n!.n).toBe(1);
  });

  it("valida el plazo y solo el dueño puede cambiarlo o purgar", async () => {
    await expect(asOwner((s) => setRetention(s, 0, ""))).rejects.toMatchObject({ code: "years" });
    await expect(asOwner((s) => setRetention(s, 31, ""))).rejects.toMatchObject({ code: "years" });
    await expect(withStudio(S.id, artistActor(S), (s) => setRetention(s, 5, ""))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(withStudio(S.id, artistActor(S), (s) => purgeConsents(s, ["x"]))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("purga solo lo vencido y confirmado; borra al cliente huérfano con sus correos y lo deja en la auditoría", async () => {
    const recent = await signConsent(S, { dni: "80000002Q" });
    const oldClient = (await signConsent(S, { dni: "80000003V", email: "viejo@example.com" }));
    await own`update consents set signed_at = now() - interval '10 years' where id = ${oldClient.consentId}`;
    await asOwner((s) => setRetention(s, 5, ""));
    await asOwner((s) => sendBirthday(s, oldClient.clientId, { manual: true }));
    const due = (await asOwner((s) => purgeCandidates(s))).map((d) => d.id);
    expect(due).toContain(oldClient.consentId);
    expect(due).not.toContain(recent.consentId);

    // Intentar colar uno no vencido junto a los vencidos: se ignora
    const r = await asOwner((s) => purgeConsents(s, [...due, recent.consentId]));
    expect(r.consents).toBe(due.length);
    const left = await own`select id from consents where studio_id = ${S.id}`;
    expect(left.map((x) => x.id)).toEqual([recent.consentId]);
    expect(await own`select id from clients where id = ${oldClient.clientId}`).toHaveLength(0);
    expect(await own`select id from emails where client_id = ${oldClient.clientId}`).toHaveLength(0);
    expect(await own`select id from consent_pdfs where consent_id = ${oldClient.consentId}`).toHaveLength(0);
    const audit = await own`select action from audit_events where entity_id in (${oldClient.consentId}, ${oldClient.clientId})`;
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["consent.purged", "client.deleted"]));
  });

  it("no puede purgar consentimientos de otro estudio", async () => {
    const other = await createTestStudio("OtroRgpd");
    const c = await signConsent(other, { dni: "80000004H" });
    await own`update consents set purge_after = '2000-01-01' where id = ${c.consentId}`;
    expect(await asOwner((s) => purgeConsents(s, [c.consentId]))).toEqual({ consents: 0, clients: 0 });
    expect(await own`select id from consents where id = ${c.consentId}`).toHaveLength(1);
  });
});

describe("exportación de datos de un cliente", () => {
  it("ZIP con ficha (DNI incluido), lo firmado con su huella, anexos, promociones y PDFs", async () => {
    const c = await signConsent(S, { dni: "80000005L", firstName: "Exporta", healthNotes: "Alergia ficticia" });
    const { zip, filename } = await asOwner((s) => exportClient(s, c.clientId));
    expect(filename).toMatch(/^datos-cl_\w+-\d{4}-\d{2}-\d{2}\.zip$/);
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(expect.arrayContaining(["LEEME.txt", "datos.json"]));
    const data = JSON.parse(strFromU8(files["datos.json"]!));
    expect(data.ficha).toMatchObject({ nombre: "Exporta", documento: "80000005L" });
    const cs = data.consentimientos[0];
    expect(cs.loFirmado.health.notes).toBe("Alergia ficticia");
    expect(cs.huellaSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(data.historialPromociones[0]).toMatchObject({ acepta: true, origen: "consentimiento" });
    const pdfName = Object.keys(files).find((f) => f.startsWith("pdf/"))!;
    expect(strFromU8(files[pdfName]!.subarray(0, 5))).toBe("%PDF-");
    expect(cs.versionesPdf.at(-1).sha256).toBe(sha256Hex(files[pdfName]!));
    const [ev] = await own`select action from audit_events where entity_id = ${c.clientId} and action = 'client.exported'`;
    expect(ev).toBeDefined();
  });

  it("solo el dueño exporta y nunca clientes de otro estudio", async () => {
    const c = await signConsent(S, { dni: "80000006C" });
    await expect(withStudio(S.id, artistActor(S), (s) => exportClient(s, c.clientId))).rejects.toBeInstanceOf(ForbiddenError);
    const other = await createTestStudio("OtroExport");
    await expect(withStudio(other.id, ownerActor(other), (s) => exportClient(s, c.clientId))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("consulta de la auditoría", () => {
  it("filtra por tipo de acción y por usuario, solo del propio estudio", async () => {
    const consents = await asOwner((s) => listAudit(s, { action: "consent." }));
    expect(consents.rows.length).toBeGreaterThan(0);
    expect(consents.rows.every((r) => r.action.startsWith("consent.") && r.studioId === S.id)).toBe(true);
    const byOwner = await asOwner((s) => listAudit(s, { userId: S.ownerUserId }));
    expect(byOwner.rows.every((r) => r.actorUserId === S.ownerUserId)).toBe(true);
    await expect(withStudio(S.id, artistActor(S), (s) => listAudit(s))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
