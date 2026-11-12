import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WaiterCheckoutPanel } from "@/components/dashboard/waiter-checkout-panel";

vi.mock("@/app/dashboard/actions", () => ({
  collectWaiterSaleAction: vi.fn(async (previous: unknown) => previous),
}));

afterEach(cleanup);

describe("WaiterCheckoutPanel", () => {
  it("explica que no hay cuentas pendientes", () => {
    render(<WaiterCheckoutPanel accounts={[]} />);
    expect(screen.getByText(/no hay cuentas pendientes/i)).toBeInTheDocument();
  });

  it("permite registrar el cobro del mesero sin pedir una caja abierta", () => {
    render(
      <WaiterCheckoutPanel
        accounts={[
          {
            sessionId: "00000000-0000-4000-8000-000000000001",
            tableName: "Mesa 12",
            status: "check_requested",
            dueCents: 18950,
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Cuentas listas para cobrar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mesa 12" })).toBeInTheDocument();
    expect(screen.getByText("Pidió la cuenta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeEnabled();
    expect(screen.getByLabelText("Forma de pago")).toHaveValue("cash");
    expect(screen.getByLabelText("Recibido")).toHaveValue("189.50");
  });
});
