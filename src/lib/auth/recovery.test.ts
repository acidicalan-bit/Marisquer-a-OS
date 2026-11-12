import { afterEach, describe, expect, it } from "vitest";

import { getCanonicalAppOrigin, parseRecoveryTokens } from "./recovery";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

describe("parseRecoveryTokens", () => {
  it("acepta una sesión implícita de recuperación", () => {
    expect(
      parseRecoveryTokens(
        "#access_token=access&refresh_token=refresh&type=recovery",
      ),
    ).toEqual({ accessToken: "access", refreshToken: "refresh" });
  });

  it("rechaza fragmentos incompletos o de otro tipo", () => {
    expect(
      parseRecoveryTokens("#type=recovery&access_token=access"),
    ).toBeNull();
    expect(
      parseRecoveryTokens(
        "#type=signup&access_token=access&refresh_token=refresh",
      ),
    ).toBeNull();
  });
});

describe("getCanonicalAppOrigin", () => {
  it("usa la URL pública configurada", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3210";
    expect(getCanonicalAppOrigin("http://0.0.0.0:3210/auth/callback")).toBe(
      "http://127.0.0.1:3210",
    );
  });

  it("nunca entrega 0.0.0.0 como destino navegable", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getCanonicalAppOrigin("http://0.0.0.0:3210/auth/callback")).toBe(
      "http://127.0.0.1:3210",
    );
  });
});
