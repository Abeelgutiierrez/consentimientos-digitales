import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "demo1234";

async function loginAs(page: Page, email: string, password = PASSWORD, { expectOk = true } = {}) {
  await page.goto("/login");
  await page.getByLabel(/correo electrónico/i).fill(email);
  await page.getByLabel(/contraseña/i).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  if (expectOk) await expect(page).toHaveURL(/\/panel$/);
}

// Next añade su propio role="alert" (anunciador de rutas): buscamos nuestros avisos.
const notice = (page: Page) => page.locator(".notice[role=alert]");

test("contraseña incorrecta: mensaje genérico y sin acceso", async ({ page }) => {
  await loginAs(page, "marc@agujafina.example", "incorrecta", { expectOk: false });
  await expect(notice(page)).toHaveText("Correo o contraseña incorrectos.");
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/login$/);
});

test("el dueño entra, ve el equipo y cierra sesión", async ({ page }) => {
  await loginAs(page, "marc@agujafina.example");
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hola, Aguja Fina Tattoo");
  await page.getByRole("link", { name: "Equipo" }).click();
  await expect(page.getByRole("heading", { name: "Usuarios del panel" })).toBeVisible();
  await expect(page.getByText("laia@agujafina.example")).toBeVisible();
  // Sin desbordamiento horizontal en móvil
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  // Otro estudio no aparece
  await expect(page.getByText("elena@lumiere.example")).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/panel/equipo");
  await expect(page).toHaveURL(/\/login$/);
});

test("una artista no ve ni puede abrir las páginas del dueño", async ({ page }) => {
  await loginAs(page, "laia@agujafina.example");
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("link", { name: "Equipo" })).toHaveCount(0);
  await page.goto("/panel/equipo");
  await expect(page).toHaveURL(/\/panel\?prohibido=1$/);
  await expect(notice(page)).toContainText("No tienes permiso");
});

test("el dueño crea un usuario y el idioma cambia a catalán", async ({ page }) => {
  await loginAs(page, "elena@lumiere.example");
  await page.goto("/panel/equipo");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Crear usuario" }) });
  await form.getByLabel("Nombre").fill("Artista Ficticia");
  await form.getByLabel("Correo").fill("ficticia@lumiere.example");
  await form.getByLabel("Contraseña inicial").fill("contraseña-larga-1");
  await form.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByRole("status")).toHaveText("Usuario creado.");
  await expect(page.getByText("ficticia@lumiere.example")).toBeVisible();
  await page.getByRole("button", { name: "CA", exact: true }).click();
  await expect(page.getByRole("link", { name: "Equip", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ca");
  await page.getByRole("button", { name: "ES", exact: true }).click();
  await expect(page.getByRole("link", { name: "Equipo", exact: true })).toBeVisible();
});
