import { describe, expect, it } from "vitest";

import { formatMoney, moneyToCents } from "./money";

describe("moneyToCents", () => {
  it.each([
    ["0", 0],
    ["1", 100],
    ["12.5", 1250],
    ["1250.99", 125099],
  ])("convierte %s sin usar flotantes", (input, expected) => {
    expect(moneyToCents(input)).toBe(expected);
  });

  it.each(["", "-1", "1.234", "hola", "999999999"])("rechaza %s", (input) =>
    expect(() => moneyToCents(input)).toThrow(),
  );
});

describe("formatMoney", () => {
  it("formatea centavos como MXN", () => {
    expect(formatMoney(125050)).toContain("1,250.50");
  });
});
