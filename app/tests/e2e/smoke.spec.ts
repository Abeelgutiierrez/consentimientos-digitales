import { expect, test } from "@playwright/test";

test("la portada carga en móvil y en español", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Consentimientos digitales");
  expect(errors).toEqual([]);
});

test("la comprobación de salud responde con la base de datos", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test("el formulario del cliente se puede usar en catalán", async ({ page }) => {
  await page.goto("/s/aguja-fina");
  await page.getByRole("button", { name: "CA", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ca");
  await expect(page.getByRole("heading", { name: "Les teves dades" })).toBeVisible();
  await expect(page.getByLabel("Cognoms")).toBeVisible();
  await page.getByRole("button", { name: "ES", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tus datos" })).toBeVisible();
});

test("la portada de pruebas muestra los estudios de demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Aguja Fina Tattoo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Formulario del cliente ↗" }).first()).toHaveAttribute("href", /\/s\//);
});
