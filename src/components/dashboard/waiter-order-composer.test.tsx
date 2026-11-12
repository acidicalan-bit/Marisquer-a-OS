import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WaiterOrderComposer } from "@/components/dashboard/waiter-order-composer";

vi.mock("@/app/dashboard/actions", () => ({
  submitWaiterOrderAction: vi.fn(async (previous: unknown) => previous),
}));

const tables = [
  { id: "mesa-1", name: "Mesa 1", capacity: 4, status: "free", sectionName: "Terraza" },
];
const menu = Array.from({ length: 13 }, (_, index) => ({
  id: `item-${index + 1}`,
  name: `Platillo ${index + 1}`,
  description: "Recién preparado",
  priceCents: 12500,
  categoryId: "category-seafood",
  categoryName: "Mariscos",
  imageUrl: null,
  available: true,
}));

describe("WaiterOrderComposer", () => {
  it("guía al mesero por mesa, carta paginada y revisión de la comanda", async () => {
    const user = userEvent.setup();
    render(
      <WaiterOrderComposer
        tables={tables}
        menu={menu}
        initialOrderId="00000000-0000-4000-8000-000000000001"
        initialEventId="00000000-0000-4000-8000-000000000002"
        deviceId="00000000-0000-4000-8000-000000000003"
      />,
    );

    expect(screen.getByRole("heading", { name: "Selecciona la mesa" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /mesa 1.*terraza/i }));
    expect(screen.getByRole("heading", { name: "¿Qué van a ordenar?" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /platillo/i })).toHaveLength(12);
    expect(screen.getByText("página 1 de 2", { exact: false })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Agregar Platillo 1" }));
    await user.click(screen.getByRole("button", { name: "Revisar comanda" }));
    expect(screen.getByRole("heading", { name: "Revisa antes de enviar" })).toBeInTheDocument();
    expect(screen.getByText("1 × Platillo 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar y enviar a cocina" })).toBeEnabled();
  });

  it("permite navegar por las páginas de productos sin una lista interminable", async () => {
    const user = userEvent.setup();
    render(
      <WaiterOrderComposer
        tables={tables}
        menu={menu}
        initialOrderId="00000000-0000-4000-8000-000000000004"
        initialEventId="00000000-0000-4000-8000-000000000005"
        deviceId="00000000-0000-4000-8000-000000000006"
      />,
    );
    await user.click(screen.getByRole("button", { name: /mesa 1.*terraza/i }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Platillo 13" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Platillo 1" })).not.toBeInTheDocument();
  });
});
