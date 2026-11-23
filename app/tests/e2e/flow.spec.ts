// Flujo completo exigido en CLAUDE.md: formulario → firma → panel → PDF → verificar integridad.
import { expect, test } from "@playwright/test";
import { fillConsentForm, loginAs } from "./helpers";

test.describe.configure({ mode: "serial" });

let consentUrl = "";

test("formulario → firma → panel → PDF → verificar integridad → anexo", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", (r) => { if (r.status() === 404) errors.push("404 " + new URL(r.url()).pathname); });

  // 1) El cliente firma en su móvil
  await page.goto("/s/aguja-fina");
  await fillConsentForm(page, { firstName: "Íñigo", lastName: "Núñez Ficticio", dni: "45678901G", birthDate: "1990-09-09", phone: "600444555", email: "inigo@example.com" },
    { healthYes: "Alergia ficticia a un desinfectante" });
  await page.getByRole("button", { name: "Firmar y enviar" }).click();
  await expect(page.getByRole("heading", { name: "¡Listo, Íñigo!" })).toBeVisible();

  // 2) El estudio lo ve en el panel (búsqueda sin acentos)
  await loginAs(page, "marc@agujafina.example");
  await expect(page.getByRole("link", { name: "Íñigo Núñez Ficticio" })).toBeVisible();
  await page.goto("/panel/consentimientos?q=nunez");
  await expect(page.getByText("1 resultado")).toBeVisible();
  await page.getByRole("link", { name: "Íñigo Núñez Ficticio" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tatuaje · Íñigo Núñez Ficticio");
  consentUrl = page.url();
  await expect(page.getByText("Alergia ficticia a un desinfectante")).toBeVisible();
  const signHash = await page.getByTestId("sign-hash").textContent();
  const pdfHashV1 = await page.getByTestId("pdf-hash").textContent();
  expect(signHash).toMatch(/^[0-9a-f]{64}$/);

  // 3) PDF desde el panel (con la sesión)
  const pdf = await page.request.get(`${consentUrl}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const pdfV1 = await pdf.body();

  // 4) Verificar integridad
  await page.getByRole("link", { name: "Verificar integridad" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Íntegro" })).toBeVisible();

  // 5) Anexo de tintas → PDF nuevo, misma huella de lo firmado
  await page.getByLabel("Marca 1").fill("Marca Ficticia");
  await page.getByLabel("Color 1").fill("Negro");
  await page.getByLabel("Lote 1").fill("L-E2E-1");
  await page.getByRole("button", { name: "+ Añadir tinta" }).click();
  await page.getByLabel("Marca 2").fill("Otra Marca");
  await page.getByRole("button", { name: "Guardar y regenerar PDF" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Anexo guardado y PDF regenerado." })).toBeVisible();
  await expect(page.getByTestId("sign-hash")).toHaveText(signHash!);
  await expect(page.getByTestId("pdf-hash")).not.toHaveText(pdfHashV1!);
  await expect(page.getByText(/Huella SHA‑256 del PDF \(versión 2\)/)).toBeVisible();
  await expect(page.getByLabel("Lote 1")).toHaveValue("L-E2E-1");
  await page.getByRole("link", { name: "Verificar integridad" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Íntegro" })).toBeVisible();

  // 6) Historial de accesos (auditoría)
  const history = page.getByTestId("history");
  for (const action of ["Firma", "Consulta", "Ver PDF", "Verificación", "Anexo guardado"]) {
    await expect(history.getByText(action, { exact: true }).first()).toBeVisible();
  }
  await expect(history.getByText("Marc Soler").first()).toBeVisible();

  // 7) Comprobar una copia: el PDF v1 descargado coincide; uno alterado no
  await page.goto("/panel/consentimientos");
  await page.getByLabel("Comprobar una copia en PDF").setInputFiles({ name: "copia.pdf", mimeType: "application/pdf", buffer: pdfV1 });
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "(versión 1 del PDF)" })).toBeVisible();
  const altered = Buffer.from(pdfV1);
  altered.writeUInt8(altered.readUInt8(altered.length - 10) ^ 1, altered.length - 10);
  await page.getByLabel("Comprobar una copia en PDF").setInputFiles({ name: "alterada.pdf", mimeType: "application/pdf", buffer: altered });
  await page.getByRole("button", { name: "Comprobar", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "no coincide" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("clientes y QR", async ({ page }) => {
  await loginAs(page, "marc@agujafina.example");
  await page.goto("/panel/clientes?q=45678901g");
  await page.getByRole("link", { name: "Íñigo Núñez Ficticio" }).click();
  await expect(page.getByText("45678901G")).toBeVisible();
  await page.goto("/panel/qr");
  await expect(page.getByTestId("form-url")).toHaveText(/\/s\/aguja-fina$/);
  await expect(page.locator("#poster svg")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("una artista ve el consentimiento pero no el historial de accesos", async ({ page }) => {
  await loginAs(page, "laia@agujafina.example");
  await page.goto(consentUrl);
  await expect(page.getByText("Alergia ficticia a un desinfectante")).toBeVisible();
  await expect(page.getByTestId("history")).toHaveCount(0);
});

test("otro estudio no puede abrir el consentimiento ni su PDF", async ({ page }) => {
  await loginAs(page, "elena@lumiere.example");
  const res = await page.goto(consentUrl);
  expect(res?.status()).toBe(404);
  expect((await page.request.get(`${consentUrl}/pdf`)).status()).toBe(404);
  await page.goto("/panel/consentimientos?q=nunez");
  await expect(page.getByText("0 resultados")).toBeVisible();
});
