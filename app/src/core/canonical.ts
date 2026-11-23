import { createHash } from "node:crypto";

// JSON con claves ordenadas: la misma información siempre produce el mismo texto y,
// por tanto, el mismo hash. Es IDÉNTICO al de la demo (lib/util.js) y un test lo garantiza.
// No cambiar nunca: invalidaría la verificación de los consentimientos ya firmados.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(obj)
        .sort()
        .filter((k) => obj[k] !== undefined)
        .map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}
