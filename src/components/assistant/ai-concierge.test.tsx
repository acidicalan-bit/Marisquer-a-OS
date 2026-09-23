import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiConcierge } from "./ai-concierge";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function ask(message: string) {
  const user = userEvent.setup();
  render(<AiConcierge />);
  await user.click(screen.getByRole("button", { name: "Abrir copiloto" }));
  await user.type(screen.getByLabelText("Mensaje para Mar"), message);
  await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
}

describe("AiConcierge", () => {
  it("muestra de forma explícita una respuesta del cerebro local", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          answer: "Respuesta calculada localmente.",
          mode: "local",
        }),
      }),
    );

    await ask("¿Qué debo vender?");

    expect(
      await screen.findByText("Respuesta calculada localmente."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cerebro local inteligente · sin consumo de crédito"),
    ).toBeInTheDocument();
    expect(screen.getByText("Respuesta del cerebro local")).toBeInTheDocument();
  });

  it("indica cuando OpenAI respondió y conserva el respaldo local", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ answer: "Respuesta generativa.", mode: "openai" }),
      }),
    );

    await ask("Ayúdame");

    expect(
      await screen.findByText("Respuesta generativa."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("OpenAI conectado · respaldo local listo"),
    ).toBeInTheDocument();
  });

  it("presenta el error funcional devuelto por el servidor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Sesión requerida" }),
      }),
    );

    await ask("Hola");

    expect(await screen.findByText("Sesión requerida")).toBeInTheDocument();
    expect(
      screen.getByText("IA + cerebro local de respaldo"),
    ).toBeInTheDocument();
  });

  it("distingue una caída del servidor de una respuesta local", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await ask("Hola");

    expect(
      await screen.findByText(/El servidor local no está disponible/i),
    ).toBeInTheDocument();
  });

  it("envía ruta, mensaje e historial sin incluir secretos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: "Listo", mode: "local" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await ask("Estado de mesas");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      message: "Estado de mesas",
      page: "/admin",
    });
    expect(String(init.body)).not.toContain("OPENAI_API_KEY");
  });
});
