import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Cifrado a nivel de campo (AES-256-GCM) para datos de categoría especial y sensibles:
// salud, JSON firmado, firmas, DNI y PDFs.
//
// Formato del bloque cifrado (bytea):
//   [1 byte versión=1][1 byte longitud id clave][id clave][12 bytes IV][16 bytes tag][texto cifrado]
//
// AAD («datos asociados»): liga cada valor a su contexto (tabla, campo, estudio, fila). Si alguien
// copia el cifrado de un estudio a otro, o de un campo a otro, el descifrado falla.
//
// Claves: DATA_ENCRYPTION_KEYS="id1:base64,id0:base64". La activa (DATA_ENCRYPTION_ACTIVE_KEY)
// cifra; todas descifran. Así se puede rotar la clave sin perder lo cifrado antes.

const VERSION = 1;

interface KeyRing {
  active: string;
  keys: Map<string, Buffer>;
  blindKey: Buffer;
}

let ring: KeyRing | null = null;

function loadRing(): KeyRing {
  if (ring) return ring;
  const keys = new Map<string, Buffer>();
  for (const entry of (process.env.DATA_ENCRYPTION_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const i = entry.indexOf(":");
    const id = entry.slice(0, i);
    const key = Buffer.from(entry.slice(i + 1), "base64");
    if (i < 1 || !/^[\w-]{1,32}$/.test(id) || key.length !== 32) {
      throw new Error("DATA_ENCRYPTION_KEYS mal formada: se espera id:base64 con claves de 32 bytes.");
    }
    keys.set(id, key);
  }
  const active = process.env.DATA_ENCRYPTION_ACTIVE_KEY ?? "";
  if (!keys.has(active)) throw new Error("DATA_ENCRYPTION_ACTIVE_KEY no está en DATA_ENCRYPTION_KEYS.");
  const blindKey = Buffer.from(process.env.BLIND_INDEX_KEY ?? "", "base64");
  if (blindKey.length !== 32) throw new Error("BLIND_INDEX_KEY debe ser de 32 bytes en base64.");
  ring = { active, keys, blindKey };
  return ring;
}

/** Solo para tests: vuelve a leer las claves del entorno. */
export function resetKeyRingForTests() {
  ring = null;
}

export interface CryptoContext {
  table: string;
  field: string;
  studioId: string;
  rowId: string;
}

const aadOf = (c: CryptoContext) => Buffer.from(`${c.table}|${c.field}|${c.studioId}|${c.rowId}`, "utf8");

export function encryptBytes(plain: Uint8Array, ctx: CryptoContext): Buffer {
  const { active, keys } = loadRing();
  const key = keys.get(active)!;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aadOf(ctx));
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const id = Buffer.from(active, "utf8");
  return Buffer.concat([Buffer.from([VERSION, id.length]), id, iv, cipher.getAuthTag(), ct]);
}

export function decryptBytes(blob: Uint8Array, ctx: CryptoContext): Buffer {
  const buf = Buffer.from(blob);
  if (buf.length < 2 || buf[0] !== VERSION) throw new Error("Formato de cifrado desconocido");
  const idLen = buf[1]!;
  const id = buf.subarray(2, 2 + idLen).toString("utf8");
  const key = loadRing().keys.get(id);
  if (!key) throw new Error(`Falta la clave de cifrado «${id}»`);
  const off = 2 + idLen;
  const iv = buf.subarray(off, off + 12);
  const tag = buf.subarray(off + 12, off + 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aadOf(ctx));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buf.subarray(off + 28)), decipher.final()]);
}

export const encryptString = (text: string, ctx: CryptoContext) => encryptBytes(Buffer.from(text, "utf8"), ctx);
export const decryptString = (blob: Uint8Array, ctx: CryptoContext) => decryptBytes(blob, ctx).toString("utf8");
export const encryptJson = (value: unknown, ctx: CryptoContext) => encryptString(JSON.stringify(value), ctx);
export const decryptJson = <T>(blob: Uint8Array, ctx: CryptoContext): T => JSON.parse(decryptString(blob, ctx)) as T;

/** Id de la clave con la que está cifrado un bloque (para saber qué rotar). */
export function keyIdOf(blob: Uint8Array): string {
  const buf = Buffer.from(blob);
  return buf.subarray(2, 2 + buf[1]!).toString("utf8");
}

/**
 * Índice ciego: HMAC-SHA256 de un valor normalizado. Permite buscar y evitar duplicados
 * (p. ej. el DNI dentro de un estudio) sin guardar el valor en claro. Incluye el estudio
 * para que el mismo DNI no sea correlacionable entre estudios.
 */
export function blindIndex(purpose: string, studioId: string, value: string): string {
  return createHmac("sha256", loadRing().blindKey).update(`${purpose}|${studioId}|${value}`).digest("base64url");
}

/** Token aleatorio para URLs (enlaces de descarga, sesiones) y su hash para guardar en BD. */
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
