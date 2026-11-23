import { describe, expect, it } from "vitest";
import { installErrorRedaction, redactText } from "@/lib/redact-errors";

describe("errores sin datos personales en los logs", () => {
  it("oculta los parámetros de una consulta fallida", () => {
    const msg = 'Failed query: insert into "clients" (...) values ($1, $2)\nparams: Laura,Puig Serra,laura@example.com';
    expect(redactText(msg)).toBe('Failed query: insert into "clients" (...) values ($1, $2)\nparams: [oculto]');
  });

  it("se aplica a lo que se escribe con console.error, incluida la causa", () => {
    const received: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { received.push(...args); };
    installErrorRedaction();
    const err = new Error("Failed query: select 1\nparams: 12345678Z,Alergia ficticia");
    (err as { cause?: unknown }).cause = new Error("otra\nparams: dato@example.com");
    console.error(err);
    console.error = original;
    const e = received[0] as Error & { cause: Error };
    const out = [e.message, e.stack, e.cause.message, e.cause.stack].join("\n");
    expect(out).toContain("params: [oculto]");
    expect(out).not.toContain("12345678Z");
    expect(out).not.toContain("Alergia ficticia");
    expect(out).not.toContain("dato@example.com");
  });
});
