import { describe, expect, it } from "vitest";
import { minorToInput, parseAmountToMinor } from "../src/shared/money.ts";

describe("parseAmountToMinor", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.05", 1205],
    ["0.10", 10],
    ["1,234.56", 123456],
    [" £40 ", 4000],
  ])("parses %j", (input, expected) => {
    expect(parseAmountToMinor(input)).toBe(expected);
  });

  it.each(["", "0", "0.00", "-5", "12.345", "abc", "1e5", "12."])("rejects %j", (input) => {
    expect(parseAmountToMinor(input)).toBeNull();
  });

  it("round-trips with minorToInput", () => {
    expect(minorToInput(-123456)).toBe("1234.56");
    expect(parseAmountToMinor(minorToInput(5))).toBe(5);
  });
});
