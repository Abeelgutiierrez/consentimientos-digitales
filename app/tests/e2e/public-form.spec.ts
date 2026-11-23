import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { testEnv } from "../test-env";
import { drawSignature, fillConsentForm } from "./helpers";

test("un cliente rellena el formulario en el móvil, firma y descarga su copia", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/s/aguja-fina");
  await expect(page.locator(".pub-head .name")).toHaveText("Aguja Fina Tattoo");

  // Validación por pasos: no deja avanzar con el paso 1 vacío
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("[data-field=firstName] .err")).toHaveText("Indica tu nombre");

  await fillConsentForm(page, {
    firstName: "Prueba", lastName: "Movil Ficticia", dni: "12345678Z", birthDate: "1994-06-15", phone: "600123123", email: "prueba.movil@example.com",
  }, { healthYes: "Alergia ficticia al níquel", marketing: true });

  // Sin firma no se envía
  await page.getByRole("button", { name: "Borrar" }).first().click();
  await page.getByRole("button", { name: "Firmar y enviar" }).click();
  await expect(page.locator("[data-field=signature] .err")).toHaveText("Falta la firma");
  await drawSignature(page, page.getByTestId("firma"));

  await page.getByRole("button", { name: "Firmar y enviar" }).click();
  await expect(page).toHaveURL(/\/s\/aguja-fina\/gracias\/cs_\w+\?t=/);
  await expect(page.getByRole("heading", { name: "¡Listo, Prueba!" })).toBeVisible();
  await expect(page.getByText(/El enlace de descarga caduca el/)).toBeVisible();

  const href = await page.getByRole("link", { name: "Descargar mi copia (PDF)" }).getAttribute("href");
  const pdf = await request.get(href!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  // Con un token cambiado no hay PDF
  expect((await request.get(href!.replace(/t=.{6}/, "t=XXXXXX"))).status()).toBe(404);

  // Sin desbordamiento horizontal y sin errores en consola
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("menor de 16: pide tutor, certificado de madurez y segunda firma", async ({ page }) => {
  await page.goto("/s/aguja-fina");
  const year = new Date().getFullYear() - 15;
  await page.getByLabel("Fecha de nacimiento").fill(`${year}-01-10`);
  await expect(page.getByText("Eres menor de edad.")).toBeVisible();
  await page.reload();
  await fillConsentForm(page, { firstName: "Menor", lastName: "Ficticio", dni: "23456789D", birthDate: `${year}-01-10`, phone: "600222333" },
    { tutor: { name: "Tutora Ficticia", dni: "87654321X", maturity: true } });
  await expect(page.getByText("Firma del representante legal")).toBeVisible();
  await page.getByRole("button", { name: "Firmar y enviar" }).click();
  await expect(page.getByRole("heading", { name: "¡Listo, Menor!" })).toBeVisible();
});

test("el enlace del cliente caduca", async ({ page, request }) => {
  await page.goto("/s/lumiere-estetica");
  await fillConsentForm(page, { firstName: "Caduca", lastName: "Ficticia", dni: "34567890V", birthDate: "1980-02-02", phone: "600333444" });
  await page.getByRole("button", { name: "Firmar y enviar" }).click();
  await expect(page.getByRole("heading", { name: "¡Listo, Caduca!" })).toBeVisible();
  const id = /gracias\/(cs_\w+)/.exec(page.url())![1]!;
  const sql = postgres(testEnv.DATABASE_OWNER_URL!, { max: 1 });
  await sql`update consents set public_token_expires_at = now() - interval '1 day' where id = ${id}`;
  await sql.end();
  const href = await page.getByRole("link", { name: "Descargar mi copia (PDF)" }).getAttribute("href");
  expect((await request.get(href!)).status()).toBe(410);
});

test("la API rechaza envíos no válidos y artistas de otro estudio", async ({ request }) => {
  const url = "/api/s/aguja-fina/consents";
  expect((await request.post(url, { data: "x", headers: { "Content-Type": "text/plain" } })).status()).toBe(415);
  expect((await request.post(url, { data: { firstName: "x" } })).status()).toBe(422);
  const big = await request.post(url, { data: { pad: "x".repeat(1_100_000) } });
  expect(big.status()).toBe(413);
  expect((await request.post("/api/s/no-existe/consents", { data: {} })).status()).toBe(404);
  const r = await request.post(url, { data: { artistId: "ar_de_otro" } });
  expect((await r.json()).errors.artistId).toBe("artist");
});
