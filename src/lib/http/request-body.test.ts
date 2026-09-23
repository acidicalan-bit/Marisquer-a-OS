import { describe, expect, it } from "vitest";

import {
  readJsonBody,
  readTextBody,
  RequestBodyTooLargeError,
} from "@/lib/http/request-body";

describe("límites de cuerpo HTTP", () => {
  it("acepta JSON dentro del límite", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });
    await expect(readJsonBody(request, 64)).resolves.toEqual({ ok: true });
  });

  it("rechaza content-length declarado fuera del límite", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-length": "1000" },
      body: "x",
    });
    await expect(readTextBody(request, 32)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("mide bytes UTF-8 aunque no exista content-length", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: "🦐🦐",
    });
    await expect(readTextBody(request, 7)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });
});
