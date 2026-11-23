import { describe, expect, it } from "vitest";
import { allow } from "@/server/rate-limit";

describe("límite de peticiones", () => {
  it("deja pasar hasta el máximo en la ventana y se recupera después", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(allow("prueba", 3, 1000, t0 + i)).toBe(true);
    expect(allow("prueba", 3, 1000, t0 + 10)).toBe(false);
    expect(allow("otra-ip", 3, 1000, t0 + 10)).toBe(true);
    expect(allow("prueba", 3, 1000, t0 + 1500)).toBe(true);
  });
});
