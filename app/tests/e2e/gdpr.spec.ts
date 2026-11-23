import { expect, test } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import postgres from "postgres";
import { testEnv } from "../test-env";
import { loginAs } from "./helpers";

test.describe.configure({ mode: "serial" });

test("conservación: fijar plazo, revisar vencidos y purgar con confirmación", async ({ page }) => {
  // Datos ficticios: hacemos que el consentimiento de Oriol parezca de hace 8 años.
  const sql = postgres(testEnv.DATABASE_OWNER_URL!, { max: 1 });
  await sql`update consents c set signed_at = now() - interval '8 years' from clients k where k.id = c.client_id and k.first_name = 'Oriol'`;
  await sql.end();

  await loginAs(page, "marc@agujafina.example");
  await page.goto("/panel/ajustes");
  await page.getByRole("link", { name: "Conservación de los datos →" }).click();
  await expect(page.getByText("No hay ningún consentimiento con el plazo vencido.")).toBeVisible();
  await page.getByLabel("Plazo").selectOption({ label: "5 años" });
  await page.getByRole("button", { name: "Guardar plazo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Plazo de conservación guardado" })).toBeVisible();
  await expect(page.locator("tr", { hasText: "Oriol Sala Prat" })).toBeVisible();

  // El resumen avisa al dueño
  await page.goto("/panel");
  await expect(page.getByRole("link", { name: /Consentimientos con el plazo vencido: 1/ })).toBeVisible();

  // Sin marcar la confirmación no borra
  await page.goto("/panel/ajustes/conservacion");
  await page.getByRole("button", { name: "Eliminar los seleccionados" }).click();
  await expect(page.locator(".notice[role=alert]")).toHaveText("Marca la casilla de confirmación para eliminar.");
  await page.getByText("Entiendo que se eliminarán definitivamente").click();
  await page.getByRole("button", { name: "Eliminar los seleccionados" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Eliminados 1 consentimientos y 1 clientes." })).toBeVisible();
  await page.goto("/panel/clientes?q=oriol");
  await expect(page.getByText("No hay clientes con ese criterio.")).toBeVisible();
});

test("exportar los datos de un cliente y verlo en la auditoría", async ({ page }) => {
  await loginAs(page, "marc@agujafina.example");
  await page.goto("/panel/clientes?q=david");
  await page.getByRole("link", { name: "David Ribas Costa" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar sus datos (ZIP)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^datos-cl_\w+-\d{4}-\d{2}-\d{2}\.zip$/);
  const zip = unzipSync(new Uint8Array(await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c))));
  const data = JSON.parse(strFromU8(zip["datos.json"]!));
  expect(data.ficha.nombre).toBe("David");
  expect(data.consentimientos[0].loFirmado.health.notes).toContain("látex");

  await page.goto("/panel/auditoria?accion=client");
  const table = page.getByTestId("audit-table");
  await expect(table.getByText("Exportación de datos").first()).toBeVisible();
  await expect(table.getByText("Supresión de datos").first()).toBeVisible();
  await page.goto("/panel/auditoria?accion=consent");
  await expect(page.getByTestId("audit-table").getByText("Eliminado por conservación").first()).toBeVisible();
});

test("una artista no exporta ni ve la auditoría ni la conservación", async ({ page }) => {
  await loginAs(page, "laia@agujafina.example");
  await page.goto("/panel/clientes?q=david");
  await page.getByRole("link", { name: "David Ribas Costa" }).click();
  await expect(page).toHaveURL(/\/panel\/clientes\/cl_\w+$/);
  await expect(page.getByRole("link", { name: "Exportar sus datos (ZIP)" })).toHaveCount(0);
  const res = await page.request.get(page.url() + "/exportar", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toContain("prohibido=1");
  await page.goto("/panel/auditoria");
  await expect(page).toHaveURL(/prohibido=1/);
  await page.goto("/panel/ajustes/conservacion");
  await expect(page).toHaveURL(/prohibido=1/);
});
