import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

// PNG de 1×1 px (rojo), datos ficticios.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

test("cumpleaños: simular, bloqueo RGPD y baja desde el enlace del correo", async ({ page }) => {
  await loginAs(page, "marc@agujafina.example");
  await page.goto("/panel/cumpleanos");
  // Sergi no aceptó promociones: el botón está desactivado
  const sergi = page.locator("tr", { hasText: "Sergi Font Bosch" });
  await expect(sergi.getByRole("button", { name: "Simular" })).toBeDisabled();
  // Laura cumple hoy y acepta promociones
  await page.locator("tr", { hasText: "Laura Puig Serra" }).getByRole("button", { name: "Simular" }).click();
  await expect(page).toHaveURL(/\/panel\/correos\/em_/);
  await expect(page.getByRole("status").filter({ hasText: "Felicitación enviada" })).toBeVisible();
  await expect(page.getByText("laura.puig@example.com")).toBeVisible();
  const html = await page.locator("iframe.mail-frame").getAttribute("srcdoc");
  expect(html).toContain("¡Feliz cumpleaños, Laura!");
  const unsubscribe = /href="([^"]+\/baja\/[^"]+)"/.exec(html!)?.[1];
  expect(unsubscribe).toBeTruthy();

  // La clienta se da de baja (confirmando con el botón)
  await page.goto(new URL(unsubscribe!).pathname);
  await page.getByRole("button", { name: "Confirmar la baja" }).click();
  await expect(page.getByText("no recibirás más promociones de Aguja Fina Tattoo")).toBeVisible();

  // Ya no se le puede enviar
  await page.goto("/panel/cumpleanos");
  await expect(page.locator("tr", { hasText: "Laura Puig Serra" }).getByRole("button", { name: "Simular" })).toBeDisabled();
});

test("ajustes: color y logo se ven en el formulario del cliente", async ({ page }) => {
  await loginAs(page, "elena@lumiere.example");
  await page.goto("/panel/ajustes");
  await page.getByRole("button", { name: "Color #1f4d3a" }).click();
  await page.getByLabel("Logo (PNG o JPG, máx. 400 KB)").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ajustes guardados." })).toBeVisible();

  await page.goto("/s/lumiere-estetica");
  await expect(page.locator(".pub-head")).toHaveCSS("background-color", "rgb(31, 77, 58)");
  await expect(page.locator(".pub-head img")).toBeVisible();
  const logo = await page.request.get("/s/lumiere-estetica/logo");
  expect(logo.headers()["content-type"]).toBe("image/png");

  // Un archivo que no es imagen se rechaza
  await page.goto("/panel/ajustes");
  await page.getByLabel("Logo (PNG o JPG, máx. 400 KB)").setInputFiles({ name: "falso.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") });
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator(".notice[role=alert]")).toHaveText("El logo debe ser PNG o JPG.");
});

test("una artista no puede abrir los ajustes ni simular cumpleaños", async ({ page }) => {
  await loginAs(page, "laia@agujafina.example");
  await page.goto("/panel/ajustes");
  await expect(page).toHaveURL(/prohibido=1/);
  await page.goto("/panel/cumpleanos");
  await expect(page.getByRole("button", { name: "Simular" })).toHaveCount(0);
  await expect(page.getByText("Solo el dueño/a puede cambiar esta configuración.")).toBeVisible();
});
