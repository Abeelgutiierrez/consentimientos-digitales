import { afterEach, describe, expect, it } from "vitest";
import {
  blindIndex, decryptBytes, decryptJson, decryptString, encryptBytes, encryptJson, encryptString, keyIdOf,
  newToken, resetKeyRingForTests, tokenHash,
} from "@/server/crypto";

const ctx = { table: "consents", field: "signed_payload", studioId: "st_A", rowId: "cs_1" };
const KEYS = process.env.DATA_ENCRYPTION_KEYS!;

afterEach(() => {
  process.env.DATA_ENCRYPTION_KEYS = KEYS;
  process.env.DATA_ENCRYPTION_ACTIVE_KEY = "t1";
  resetKeyRingForTests();
});

describe("cifrado de campos", () => {
  it("cifra y descifra texto, JSON y binario", () => {
    const secret = "Alergia ficticia al níquel · l·l";
    const blob = encryptString(secret, ctx);
    expect(blob.includes(Buffer.from("níquel"))).toBe(false);
    expect(decryptString(blob, ctx)).toBe(secret);
    expect(decryptJson(encryptJson({ a: [1, true] }, ctx), ctx)).toEqual({ a: [1, true] });
    const bin = Buffer.from([0, 1, 2, 255]);
    expect(decryptBytes(encryptBytes(bin, ctx), ctx).equals(bin)).toBe(true);
  });

  it("cada cifrado es distinto (IV aleatorio)", () => {
    expect(encryptString("x", ctx).equals(encryptString("x", ctx))).toBe(false);
  });

  it("no se puede descifrar en otro estudio, otra fila u otro campo (AAD)", () => {
    const blob = encryptString("dato de salud ficticio", ctx);
    expect(() => decryptString(blob, { ...ctx, studioId: "st_B" })).toThrow();
    expect(() => decryptString(blob, { ...ctx, rowId: "cs_2" })).toThrow();
    expect(() => decryptString(blob, { ...ctx, field: "otro" })).toThrow();
  });

  it("detecta manipulaciones del texto cifrado", () => {
    const blob = encryptString("dato", ctx);
    blob[blob.length - 1]! ^= 1;
    expect(() => decryptString(blob, ctx)).toThrow();
  });

  it("rotación de claves: lo cifrado con la clave antigua se sigue leyendo", () => {
    process.env.DATA_ENCRYPTION_ACTIVE_KEY = "t0";
    resetKeyRingForTests();
    const old = encryptString("antiguo", ctx);
    expect(keyIdOf(old)).toBe("t0");
    process.env.DATA_ENCRYPTION_ACTIVE_KEY = "t1";
    resetKeyRingForTests();
    expect(decryptString(old, ctx)).toBe("antiguo");
    expect(keyIdOf(encryptString("nuevo", ctx))).toBe("t1");
  });

  it("falla con un mensaje claro si falta la clave", () => {
    const blob = encryptString("x", ctx);
    process.env.DATA_ENCRYPTION_KEYS = "t0:" + Buffer.alloc(32, 2).toString("base64");
    process.env.DATA_ENCRYPTION_ACTIVE_KEY = "t0";
    resetKeyRingForTests();
    expect(() => decryptString(blob, ctx)).toThrow(/Falta la clave de cifrado «t1»/);
  });

  it("rechaza configuraciones de clave mal formadas", () => {
    process.env.DATA_ENCRYPTION_KEYS = "t1:corta";
    resetKeyRingForTests();
    expect(() => encryptString("x", ctx)).toThrow(/32 bytes/);
  });
});

describe("índice ciego y tokens", () => {
  it("el mismo DNI da el mismo índice en un estudio y distinto en otro", () => {
    expect(blindIndex("dni", "st_A", "12345678Z")).toBe(blindIndex("dni", "st_A", "12345678Z"));
    expect(blindIndex("dni", "st_A", "12345678Z")).not.toBe(blindIndex("dni", "st_B", "12345678Z"));
    expect(blindIndex("dni", "st_A", "12345678Z")).not.toContain("12345678");
  });

  it("los tokens son largos y solo se guarda su hash", () => {
    const t = newToken();
    expect(t.length).toBeGreaterThanOrEqual(43);
    expect(tokenHash(t)).not.toBe(t);
    expect(tokenHash(t)).toBe(tokenHash(t));
  });
});
