import { describe, expect, it } from "vitest";

import { AssistantUsageGuard } from "./usage-guard";

describe("AssistantUsageGuard", () => {
  it("permite hasta el límite y luego protege el crédito", () => {
    const guard = new AssistantUsageGuard();
    expect(guard.consume("a", { now: 0, limit: 2 }).allowed).toBe(true);
    expect(guard.consume("a", { now: 1, limit: 2 }).allowed).toBe(true);
    const blocked = guard.consume("a", { now: 2, limit: 2 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("aísla el consumo entre usuarios", () => {
    const guard = new AssistantUsageGuard();
    guard.consume("a", { now: 0, limit: 1 });
    expect(guard.consume("a", { now: 1, limit: 1 }).allowed).toBe(false);
    expect(guard.consume("b", { now: 1, limit: 1 }).allowed).toBe(true);
  });

  it("abre una ventana nueva al terminar el periodo", () => {
    const guard = new AssistantUsageGuard();
    guard.consume("a", { now: 0, limit: 1, windowMs: 100 });
    expect(
      guard.consume("a", { now: 100, limit: 1, windowMs: 100 }).allowed,
    ).toBe(true);
  });

  it("normaliza límites inválidos a una petición", () => {
    const guard = new AssistantUsageGuard();
    expect(guard.consume("a", { now: 0, limit: 0 }).allowed).toBe(true);
    expect(guard.consume("a", { now: 1, limit: 0 }).allowed).toBe(false);
  });
});
