import { expect, type Locator, type Page } from "@playwright/test";

export const PASSWORD = "demo1234";

export async function loginAs(page: Page, email: string, password = PASSWORD, { expectOk = true } = {}) {
  await page.goto("/login");
  await page.getByLabel(/correo electrónico/i).fill(email);
  await page.getByLabel(/contraseña/i).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  if (expectOk) await expect(page).toHaveURL(/\/panel$/);
}

/** Next añade su propio role="alert" (anunciador de rutas): buscamos nuestros avisos. */
export const notice = (page: Page) => page.locator(".notice[role=alert]");

/** Dibuja una firma en un lienzo con el puntero (como un dedo). */
export async function drawSignature(page: Page, canvas: Locator) {
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const y0 = box.y + box.height * 0.55;
  await page.mouse.move(box.x + 30, y0);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) {
    await page.mouse.move(box.x + 30 + i * ((box.width - 60) / 40), y0 + Math.sin(i / 4) * 30, { steps: 2 });
  }
  await page.mouse.up();
}

export interface Person {
  firstName: string;
  lastName: string;
  dni: string;
  birthDate: string;
  phone: string;
  email?: string;
}

/** Rellena el formulario público completo y firma. */
export async function fillConsentForm(page: Page, p: Person, opts: { healthYes?: string; marketing?: boolean; tutor?: { name: string; dni: string; maturity?: boolean } } = {}) {
  const cont = page.getByRole("button", { name: "Continuar" });
  // Paso 1
  await page.getByLabel("Nombre", { exact: true }).fill(p.firstName);
  await page.getByLabel("Apellidos").fill(p.lastName);
  await page.getByLabel("DNI / NIE / Pasaporte").fill(p.dni);
  await page.getByLabel("Fecha de nacimiento").fill(p.birthDate);
  await page.getByLabel("Teléfono", { exact: true }).fill(p.phone);
  if (p.email) await page.getByLabel("Correo electrónico", { exact: true }).fill(p.email);
  if (opts.tutor) {
    await page.getByLabel("Nombre del representante legal").fill(opts.tutor.name);
    await page.getByLabel("DNI del representante").fill(opts.tutor.dni);
    await page.getByLabel("Relación").selectOption({ label: "Madre" });
    if (opts.tutor.maturity) await page.getByText("Aporto el certificado de madurez").click();
  }
  await cont.click();
  // Paso 2
  await expect(page.getByRole("heading", { name: "¿Qué te vas a hacer?" })).toBeVisible();
  await page.getByLabel("Artista / aplicador").selectOption({ index: 1 });
  await page.getByLabel("Zona del cuerpo").fill("Antebrazo izquierdo");
  await cont.click();
  // Paso 3: salud
  await expect(page.getByRole("heading", { name: "Tu salud" })).toBeVisible();
  for (const group of await page.locator("section:not(.hidden) .seg").all()) {
    await group.getByText("No", { exact: true }).click();
  }
  if (opts.healthYes) {
    await page.locator("section:not(.hidden) .q").first().getByText("Sí", { exact: true }).click();
    await page.getByLabel(/Cuéntanos los detalles/).fill(opts.healthYes);
  }
  await cont.click();
  // Paso 4: información y autorizaciones
  await expect(page.getByRole("heading", { name: "Información importante" })).toBeVisible();
  await page.locator("input[name=c_read]").check();
  await page.locator("input[name=c_privacy]").check();
  if (opts.marketing) await page.locator("input[name=c_marketing]").check();
  await cont.click();
  // Paso 5: firma
  await expect(page.getByRole("heading", { name: "Firma", exact: true })).toBeVisible();
  await drawSignature(page, page.getByTestId("firma"));
  if (opts.tutor) await drawSignature(page, page.getByTestId("firma-tutor"));
}
