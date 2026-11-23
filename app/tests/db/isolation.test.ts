// Multi-tenant: un estudio NO puede ver ni tocar los datos de otro.
// Se comprueba en dos niveles: la base de datos (RLS, con el rol real de la app) y los servicios.
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listClients } from "@/server/clients";
import { getConsentDetail, getPdf, listConsents, saveAnnex, verifyIntegrity } from "@/server/consents";
import { NotFoundError, withStudio } from "@/server/tenant";
import { appConn, createTestStudio, ownerActor, signConsent, type TestStudio } from "./helpers";

const TENANT_TABLES = ["users", "artists", "clients", "marketing_events", "consents", "consent_annexes", "consent_pdfs", "audit_events", "emails"];

let A: TestStudio;
let B: TestStudio;
let consentA: string;
let consentB: string;
let sql: postgres.Sql;

beforeAll(async () => {
  A = await createTestStudio("Estudio A");
  B = await createTestStudio("Estudio B");
  consentA = (await signConsent(A, { dni: "11111111H" })).consentId;
  consentB = (await signConsent(B, { dni: "22222222J", firstName: "SoloDeB" })).consentId;
  await withStudio(B.id, ownerActor(B), (s) => saveAnnex(s, consentB, { inks: [{ brand: "X", color: "Negro", lot: "L1", expiry: "", aemps: "" }] }));
  sql = appConn();
});
afterAll(() => sql.end());

/** Ejecuta SQL directo con el rol de la app y el contexto de un estudio (como hace withStudio). */
async function asStudio<T>(studioId: string | null, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    if (studioId) await tx`select set_config('app.studio_id', ${studioId}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

describe("aislamiento en la base de datos (RLS con el rol de la app)", () => {
  it("sin contexto de estudio no se ve ninguna fila de ninguna tabla", async () => {
    // (sessions ni siquiera es legible: ver el test «la tabla de sesiones no es accesible»)
    for (const table of [...TENANT_TABLES, "studios"]) {
      const [row] = await asStudio(null, (tx) => tx.unsafe(`select count(*)::int as n from ${table}`));
      expect(row!.n, table).toBe(0);
    }
  });

  it("con el contexto de A solo se ven filas de A, aunque la consulta no filtre", async () => {
    for (const table of TENANT_TABLES) {
      const rows = await asStudio(A.id, (tx) => tx.unsafe(`select studio_id from ${table}`));
      expect(rows.every((r) => r.studio_id === A.id), table).toBe(true);
    }
    const studios = await asStudio(A.id, (tx) => tx`select id from studios`);
    expect(studios.map((s) => s.id)).toEqual([A.id]);
  });

  it("A no puede leer un consentimiento de B ni sabiendo su id", async () => {
    const rows = await asStudio(A.id, (tx) => tx`select id from consents where id = ${consentB}`);
    expect(rows).toHaveLength(0);
    const pdfs = await asStudio(A.id, (tx) => tx`select id from consent_pdfs where consent_id = ${consentB}`);
    expect(pdfs).toHaveLength(0);
  });

  it("A no puede modificar ni borrar datos de B", async () => {
    const upd = await asStudio(A.id, (tx) => tx`update consents set pdf_version = 99 where id = ${consentB}`);
    expect(upd.count).toBe(0);
    const del = await asStudio(A.id, (tx) => tx`delete from clients where studio_id = ${B.id}`);
    expect(del.count).toBe(0);
  });

  it("A no puede insertar filas a nombre de B", async () => {
    await expect(asStudio(A.id, (tx) => tx`insert into audit_events (studio_id, actor_type, action, entity_type, entity_id)
      values (${B.id}, 'system', 'x', 'consent', 'x')`)).rejects.toThrow(/row-level security/);
  });

  it("A no puede cambiar una fila suya para pasarla a B", async () => {
    await expect(asStudio(A.id, (tx) => tx`update artists set name = name where studio_id = ${A.id} returning id`)).resolves.toBeDefined();
    // studio_id no está entre las columnas que el rol de la app puede actualizar.
    await expect(asStudio(A.id, (tx) => tx`update artists set studio_id = ${B.id}`)).rejects.toThrow(/permission denied/);
  });

  it("la tabla de sesiones no es accesible directamente", async () => {
    await expect(asStudio(A.id, (tx) => tx`select * from sessions`)).rejects.toThrow(/permission denied/);
  });
});

describe("aislamiento en los servicios", () => {
  const asA = <T>(fn: Parameters<typeof withStudio<T>>[2]) => withStudio(A.id, ownerActor(A), fn);

  it("el listado de A solo contiene sus consentimientos", async () => {
    const list = await asA((s) => listConsents(s));
    expect(list.map((c) => c.id)).toEqual([consentA]);
    const search = await asA((s) => listConsents(s, { q: "SoloDeB" }));
    expect(search).toEqual([]);
  });

  it("detalle, PDF, verificación y anexo de un consentimiento de B → no encontrado", async () => {
    await expect(asA((s) => getConsentDetail(s, consentB))).rejects.toBeInstanceOf(NotFoundError);
    await expect(asA((s) => getPdf(s, consentB))).rejects.toBeInstanceOf(NotFoundError);
    await expect(asA((s) => verifyIntegrity(s, consentB))).rejects.toBeInstanceOf(NotFoundError);
    await expect(asA((s) => saveAnnex(s, consentB, {}))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("buscar por el DNI de un cliente de B desde A no encuentra nada", async () => {
    expect(await asA((s) => listClients(s, "22222222J"))).toEqual([]);
    expect((await withStudio(B.id, ownerActor(B), (s) => listClients(s, "22222222J"))).map((c) => c.firstName)).toEqual(["SoloDeB"]);
  });

  it("el mismo DNI en dos estudios son dos fichas independientes", async () => {
    await signConsent(A, { dni: "33333333P", firstName: "EnA" });
    await signConsent(B, { dni: "33333333P", firstName: "EnB" });
    const inA = await asA((s) => listClients(s, "33333333P"));
    const inB = await withStudio(B.id, ownerActor(B), (s) => listClients(s, "33333333P"));
    expect(inA.map((c) => c.firstName)).toEqual(["EnA"]);
    expect(inB.map((c) => c.firstName)).toEqual(["EnB"]);
    expect(inA[0]!.dniHash).not.toBe(inB[0]!.dniHash);
  });

  it("rechaza identificadores de estudio mal formados", async () => {
    await expect(withStudio("st_x' or '1'='1", ownerActor(A), async () => 1)).rejects.toThrow(/no válido/);
  });
});
