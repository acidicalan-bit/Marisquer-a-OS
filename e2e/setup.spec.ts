import { expect, test } from "@playwright/test";

test("muestra un acceso real o instalación pendiente, nunca datos simulados", async ({
  page,
}) => {
  await page.goto("/");

  const loginHeading = page.getByRole("heading", { name: "Bienvenido" });
  const setupHeading = page.getByRole("heading", {
    name: /el pulso completo/i,
  });
  await expect(loginHeading.or(setupHeading)).toBeVisible();

  if (await loginHeading.isVisible()) {
    await expect(loginHeading).toBeVisible();
    await expect(page.getByLabel("Correo")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    return;
  }

  await expect(setupHeading).toBeVisible();
  await expect(page.getByText(/configuración requerida/i)).toBeVisible();
  await page.getByRole("link", { name: /ver configuración/i }).click();
  await expect(
    page.getByRole("heading", { name: /estado de instalación/i }),
  ).toBeVisible();
});
