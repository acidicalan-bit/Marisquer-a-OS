import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TableFloor } from "@/components/dashboard/table-floor";

describe("TableFloor", () => {
  it("muestra mesa, sección, capacidad y estado en español", () => {
    render(
      <TableFloor
        tables={[
          {
            id: "mesa-7",
            name: "Mesa 7",
            capacity: 6,
            status: "free",
            section: { name: "Terraza" },
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /mesa 7/i })).toBeInTheDocument();
    expect(screen.getByText(/terraza · 6 lugares/i)).toBeInTheDocument();
    expect(screen.getByText("Libre")).toBeInTheDocument();
  });

  it("presenta un estado vacío útil", () => {
    render(<TableFloor tables={[]} />);
    expect(screen.getByText(/no hay mesas visibles/i)).toBeInTheDocument();
  });

  it("ofrece liberar una mesa pendiente de limpieza", () => {
    const markTableCleanAction = async () => {};
    render(
      <TableFloor
        tables={[
          {
            id: "mesa-8",
            name: "Mesa 8",
            capacity: 4,
            status: "needs_cleaning",
            section: null,
          },
        ]}
        markTableCleanAction={markTableCleanAction}
      />,
    );

    expect(screen.getByRole("button", { name: /marcar mesa limpia/i })).toBeInTheDocument();
  });
});
