import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecoveryFragmentHandler } from "./recovery-fragment-handler";

const replaceMock = vi.fn();
const setSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { setSession: setSessionMock },
  }),
}));

beforeEach(() => {
  replaceMock.mockReset();
  setSessionMock.mockReset();
  window.history.replaceState(null, "", "/login");
});

afterEach(cleanup);

describe("RecoveryFragmentHandler", () => {
  it("canjea el fragmento, lo elimina de la URL y abre el cambio", async () => {
    setSessionMock.mockResolvedValue({ error: null });
    window.history.replaceState(
      null,
      "",
      "/login?error=recovery_link_invalid#access_token=access&refresh_token=refresh&type=recovery",
    );

    render(<RecoveryFragmentHandler />);

    await waitFor(() => expect(window.location.hash).toBe(""));
    await waitFor(() =>
      expect(setSessionMock).toHaveBeenCalledWith({
        access_token: "access",
        refresh_token: "refresh",
      }),
    );
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/account/password"),
    );
  });

  it("rechaza una sesión que Supabase no puede validar", async () => {
    setSessionMock.mockResolvedValue({ error: new Error("expired") });
    window.history.replaceState(
      null,
      "",
      "/login#access_token=access&refresh_token=refresh&type=recovery",
    );

    render(<RecoveryFragmentHandler />);

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(
        "/login?error=recovery_link_invalid",
      ),
    );
  });

  it("ignora fragmentos que no contienen recuperación", () => {
    window.history.replaceState(null, "", "/login#type=signup");

    render(<RecoveryFragmentHandler />);

    expect(setSessionMock).not.toHaveBeenCalled();
  });
});
