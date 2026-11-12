import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminCrud } from "./admin-crud";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

describe("AdminCrud", () => {
  it("requires a valid initial password and displays user creation errors", async () => {
    const user = userEvent.setup();
    const saveAction = vi.fn(async () => ({
      ok: false as const,
      error: "Ese correo ya tiene una cuenta.",
    }));

    render(
      <AdminCrud
        title="Usuarios"
        description="Administrar accesos"
        createLabel="Nuevo usuario"
        emptyLabel="Sin usuarios"
        fields={[
          {
            name: "password",
            label: "Contraseña",
            type: "password",
            required: true,
            minLength: 12,
          },
        ]}
        records={[]}
        saveAction={saveAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    const password = screen.getByLabelText("Contraseña") as HTMLInputElement;
    expect(password.required).toBe(true);
    expect(password.minLength).toBe(12);

    await user.type(password, "StrongPassword1");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Ese correo ya tiene una cuenta.",
      ),
    );
    expect(saveAction).toHaveBeenCalledOnce();
  });
});
