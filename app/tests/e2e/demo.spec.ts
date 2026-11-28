import { expect, test } from "@playwright/test";
import { drawSignature } from "./helpers";

// Demo en directo: guion de venta → formulario con datos de ejemplo → firma →
// «Verlo en el panel del estudio» abre el consentimiento sin pedir contraseña,
// y un panel ya abierto avisa solo del consentimiento nuevo.
test("demo en directo: del formulario al panel del estudio con un clic", async ({ page, browser }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Demo en directo" })).toBeVisible();
  await expect(page.getByTestId("demo-form-url")).toHaveText(/\/s\/aguja-fina$/);

  // El comerciante tiene el panel abierto en el ordenador.
  const desk = await browser.newPage();
  await desk.goto(new URL("/demo/entrar?estudio=aguja-fina", page.url()).toString());
  await expect(desk).toHaveURL(/\/panel$/);
  await expect(desk.getByText("En directo")).toBeVisible();

  // Y firma en su móvil.
  await page.goto("/s/aguja-fina");
  await page.getByRole("button", { name: "Rellenar con datos de ejemplo" }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await drawSignature(page, page.getByTestId("firma"));
  await page.getByRole("button", { name: "Firmar y enviar" }).click();
  await expect(page).toHaveURL(/\/gracias\/cs_\w+/);
  const consentId = /gracias\/(cs_\w+)/.exec(page.url())![1]!;

  // El panel del ordenador avisa sin recargar.
  await expect(desk.locator(".demo-live-toast")).toBeVisible({ timeout: 15_000 });

  // Desde el móvil, un clic lleva al consentimiento en el panel.
  await page.getByTestId("demo-next").getByRole("link", { name: "Verlo en el panel del estudio" }).click();
  await expect(page).toHaveURL(new RegExp(`/panel/consentimientos/${consentId}$`));
  await desk.close();
});

test("la entrada de demo solo acepta estudios de demo y rutas del panel", async ({ page }) => {
  await page.goto("/demo/entrar?estudio=no-existe");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/demo/entrar?estudio=aguja-fina&ir=https://example.com");
  await expect(page).toHaveURL(/\/panel$/);
});
