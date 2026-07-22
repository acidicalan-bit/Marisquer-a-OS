import { expect, test } from "@playwright/test";

test("muestra instalación pendiente sin inventar datos", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /el pulso completo/i }),
  ).toBeVisible();
  await expect(page.getByText(/configuración requerida/i)).toBeVisible();
  await page.getByRole("link", { name: /ver configuración/i }).click();
  await expect(
    page.getByRole("heading", { name: /estado de instalación/i }),
  ).toBeVisible();
});
