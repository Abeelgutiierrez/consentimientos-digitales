import { describe, expect, it } from "vitest";
import es from "../../messages/es.json";
import ca from "../../messages/ca.json";

function keys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("traducciones", () => {
  it("el catalán tiene exactamente las mismas claves que el español", () => {
    expect(keys(ca).sort()).toEqual(keys(es).sort());
  });

  it("no hay textos vacíos", () => {
    const leaves = (o: unknown): unknown[] => (o && typeof o === "object" ? Object.values(o).flatMap(leaves) : [o]);
    for (const messages of [es, ca]) {
      expect(leaves(messages).filter((v) => typeof v !== "string" || !v.trim())).toEqual([]);
    }
  });

  it("ninguna clave contiene puntos (next-intl los usa como separador)", () => {
    const bad = (o: unknown): string[] => (o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => [...(k.includes(".") ? [k] : []), ...bad(v)]) : []);
    expect(bad(es)).toEqual([]);
  });
});
