// Modelo de evidencias en la base de datos: huella inmutable, anexo con nueva versión del PDF,
// detección de manipulaciones y registro de auditoría.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sha256Hex } from "@/core/canonical";
import { auditFor } from "@/server/audit";
import { getClient } from "@/server/clients";
import { getConsentDetail, getPdf, readSignedPayload, saveAnnex, verifyIntegrity } from "@/server/consents";
import { withStudio } from "@/server/tenant";
import { appConn, createTestStudio, owner, ownerActor, signConsent, type TestStudio } from "./helpers";

let S: TestStudio;
const app = appConn();
const own = owner();
afterAll(async () => { await app.end(); await own.end(); });
beforeAll(async () => { S = await createTestStudio("Evidencias"); });

const asOwner = <T>(fn: Parameters<typeof withStudio<T>>[2]) => withStudio(S.id, ownerActor(S), fn, { ip: "192.0.2.20", userAgent: "Panel" });

describe("firma y huella", () => {
  it("guarda el JSON exacto firmado y su huella se puede volver a verificar", async () => {
    const { consentId } = await signConsent(S);
    const result = await asOwner(async (s) => {
      const d = await getConsentDetail(s, consentId);
      const { canonical } = readSignedPayload(d.row);
      return { d, canonical, integrity: await verifyIntegrity(s, consentId) };
    });
    expect(sha256Hex(result.canonical)).toBe(result.d.row.signHash);
    expect(result.d.payload.health.notes).toBe("Alergia ficticia al níquel");
    expect(result.d.payload.consentId).toBe(consentId);
    expect(result.d.row.pdfVersion).toBe(1);
    expect(result.integrity).toEqual({ signOk: true, pdfOk: true, pdfVersion: 1 });
  });

  it("el anexo genera un PDF nuevo (versión y hash nuevos) sin tocar lo firmado", async () => {
    const { consentId } = await signConsent(S, { dni: "44444444A" });
    const before = await asOwner((s) => getPdf(s, consentId));
    const r1 = await asOwner((s) => saveAnnex(s, consentId, { inks: [{ brand: "Marca", color: "Negro", lot: "L-1", expiry: "2027-01-31", aemps: "1-TAT" }], needles: "3RL" }));
    const r2 = await asOwner((s) => saveAnnex(s, consentId, { inks: [], notes: "Corrección" }));
    expect(r1).toEqual({ annexVersion: 1, pdfVersion: 2 });
    expect(r2).toEqual({ annexVersion: 2, pdfVersion: 3 });
    const after = await asOwner(async (s) => ({ pdf: await getPdf(s, consentId), detail: await getConsentDetail(s, consentId), v1: await getPdf(s, consentId, 1) }));
    expect(after.pdf.version).toBe(3);
    expect(after.pdf.sha256).not.toBe(before.sha256);
    expect(after.detail.row.signHash).toBe(before.consent.signHash);
    // Se conservan todas las versiones del PDF y del anexo.
    expect(after.detail.pdfs.map((p) => p.version)).toEqual([3, 2, 1]);
    expect(after.v1.sha256).toBe(before.sha256);
    expect(after.detail.annex?.notes).toBe("Corrección");
    expect(await asOwner((s) => verifyIntegrity(s, consentId))).toEqual({ signOk: true, pdfOk: true, pdfVersion: 3 });
  });
});

describe("inmutabilidad (permisos de la base de datos)", () => {
  it("el rol de la app no puede modificar las evidencias de un consentimiento", async () => {
    const { consentId } = await signConsent(S, { dni: "55555555K" });
    for (const col of ["sign_hash", "signed_payload_enc", "signed_at", "ip", "user_agent", "client_id", "studio_id"]) {
      await expect(app.begin(async (tx) => {
        await tx`select set_config('app.studio_id', ${S.id}, true)`;
        await tx.unsafe(`update consents set ${col} = ${col} where id = $1`, [consentId]);
      }), col).rejects.toThrow(/permission denied/);
    }
  });

  it("el registro de auditoría no se puede modificar ni borrar", async () => {
    for (const stmt of ["update audit_events set action = 'x'", "delete from audit_events"]) {
      await expect(app.begin(async (tx) => {
        await tx`select set_config('app.studio_id', ${S.id}, true)`;
        await tx.unsafe(stmt);
      }), stmt).rejects.toThrow(/permission denied/);
    }
  });

  it("el historial de PDFs y anexos no se puede reescribir", async () => {
    for (const stmt of ["update consent_pdfs set sha256 = 'x'", "delete from consent_pdfs", "update consent_annexes set notes = 'x'"]) {
      await expect(app.begin(async (tx) => {
        await tx`select set_config('app.studio_id', ${S.id}, true)`;
        await tx.unsafe(stmt);
      }), stmt).rejects.toThrow(/permission denied/);
    }
  });
});

describe("detección de manipulaciones (alguien con acceso directo a la BD)", () => {
  it("detecta un PDF alterado", async () => {
    const { consentId } = await signConsent(S, { dni: "66666666Q" });
    await own`update consent_pdfs set bytes_enc = overlay(bytes_enc placing '\\xff'::bytea from 60 for 1) where consent_id = ${consentId}`;
    expect(await asOwner((s) => verifyIntegrity(s, consentId))).toMatchObject({ signOk: true, pdfOk: false });
  });

  it("detecta una huella sustituida o un JSON firmado alterado", async () => {
    const a = (await signConsent(S, { dni: "77777777B" })).consentId;
    await own`update consents set sign_hash = ${"0".repeat(64)} where id = ${a}`;
    expect(await asOwner((s) => verifyIntegrity(s, a))).toMatchObject({ signOk: false });
    const b = (await signConsent(S, { dni: "88888888Y" })).consentId;
    await own`update consents set signed_payload_enc = overlay(signed_payload_enc placing '\\x00'::bytea from 80 for 1) where id = ${b}`;
    expect(await asOwner((s) => verifyIntegrity(s, b))).toMatchObject({ signOk: false });
  });

  it("detecta un JSON firmado copiado de otro consentimiento", async () => {
    const a = (await signConsent(S, { dni: "99999999R" })).consentId;
    const b = (await signConsent(S, { dni: "10101010Z" })).consentId;
    await own`update consents set signed_payload_enc = (select signed_payload_enc from consents where id = ${a}) where id = ${b}`;
    expect(await asOwner((s) => verifyIntegrity(s, b))).toMatchObject({ signOk: false });
  });
});

describe("auditoría y ficha del cliente", () => {
  it("registra firma, consulta, anexo y verificación con quién y desde dónde", async () => {
    const { consentId } = await signConsent(S, { dni: "12121212J" });
    await asOwner(async (s) => {
      await getConsentDetail(s, consentId);
      await saveAnnex(s, consentId, { needles: "3RL" });
      await verifyIntegrity(s, consentId);
    });
    const events = await asOwner((s) => auditFor(s, "consent", consentId));
    expect(events.map((e) => e.action).reverse()).toEqual(["consent.signed", "consent.viewed", "consent.annex_saved", "consent.verified"]);
    const viewed = events.find((e) => e.action === "consent.viewed")!;
    expect(viewed).toMatchObject({ actorType: "user", actorUserId: S.ownerUserId, ip: "192.0.2.20", userAgent: "Panel" });
    expect(events.find((e) => e.action === "consent.signed")).toMatchObject({ actorType: "client", ip: "192.0.2.10" });
    expect(JSON.stringify(events)).not.toContain("níquel");
  });

  it("un segundo consentimiento con el mismo DNI reutiliza la ficha y el último marketing manda", async () => {
    const first = await signConsent(S, { dni: "13131313V", checks: { read: true, privacy: true, marketing: true, images: false } });
    const second = await signConsent(S, { dni: "13 131 313-v", phone: "611111111", checks: { read: true, privacy: true, marketing: false, images: false } });
    expect(second.clientId).toBe(first.clientId);
    const c = await asOwner((s) => getClient(s, first.clientId));
    expect(c.marketing).toBe(false);
    expect(c.phone).toBe("611111111");
    const events = await own`select granted, source from marketing_events where client_id = ${first.clientId} order by id`;
    expect(events.map((e) => e.granted)).toEqual([true, false]);
  });
});
