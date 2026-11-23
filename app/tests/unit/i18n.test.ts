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
    for (const messages of [es, ca]) {
      const empty = keys(messages).filter((k) => {
        const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], messages);
        return typeof v !== "string" || !v.trim();
      });
      expect(empty).toEqual([]);
    }
  });
});
