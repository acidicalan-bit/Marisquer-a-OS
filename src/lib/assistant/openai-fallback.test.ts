import { describe, expect, it } from "vitest";

import { classifyAssistantFallback } from "./openai-fallback";

describe("classifyAssistantFallback", () => {
  it.each([
    [{ status: 401 }, "authentication"],
    [{ status: 403 }, "authentication"],
    [{ code: "invalid_api_key" }, "authentication"],
    [{ status: 402 }, "quota_or_rate_limit"],
    [{ status: 429 }, "quota_or_rate_limit"],
    [{ code: "insufficient_quota" }, "quota_or_rate_limit"],
    [{ code: "rate_limit_exceeded" }, "quota_or_rate_limit"],
    [Object.assign(new Error("timeout"), { name: "AbortError" }), "timeout"],
    [
      Object.assign(new Error("timeout"), {
        name: "APIConnectionTimeoutError",
      }),
      "timeout",
    ],
    [{ status: 500 }, "provider_error"],
    [null, "provider_error"],
  ] as const)("clasifica %# como %s", (error, expected) => {
    expect(classifyAssistantFallback(error)).toBe(expected);
  });
});
