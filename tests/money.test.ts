import { describe, expect, it } from "vitest";
import { minorToInput, parseAmountToMinor } from "../src/shared/money.ts";
import { formatMoney } from "../src/shared/currency.ts";

describe("parseAmountToMinor", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.05", 1205],
    ["0.10", 10],
    ["1,234.56", 123456],
    ["1,234", 123400],
    [" £40 ", 4000],
    ["$1,234", 123400],
    ["€12", 1200],
    // European / Swedish conventions
    ["42,50", 4250],
    ["42,5", 4250],
    ["1.234,56", 123456],
    ["1 234,56 kr", 123456],
    ["1 234,56 kr", 123456],
    ["kr 99", 9900],
    ["250 SEK", 25000],
  ])("parses %j", (input, expected) => {
    expect(parseAmountToMinor(input)).toBe(expected);
  });

  it.each(["", "0", "0.00", "-5", "12.345", "1.234", "abc", "1e5", "12.", "12,", "1,2,3", "1,23,456", "kr"])(
    "rejects %j",
    (input) => {
      expect(parseAmountToMinor(input)).toBeNull();
    },
  );

  it("round-trips with minorToInput", () => {
    expect(minorToInput(-123456)).toBe("1234.56");
    expect(parseAmountToMinor(minorToInput(5))).toBe(5);
  });
});

describe("formatMoney", () => {
  // Intl may use narrow/no-break spaces; normalise them for readable assertions.
  const fmt = (minor: number, c: Parameters<typeof formatMoney>[1]) =>
    formatMoney(minor, c).replace(/[  ]/g, " ");

  it("formats each supported currency in its own convention", () => {
    expect(fmt(123456, "GBP")).toBe("£1,234.56");
    expect(fmt(123456, "USD")).toBe("$1,234.56");
    expect(fmt(123456, "EUR")).toBe("€1,234.56");
    expect(fmt(123456, "SEK")).toBe("1 234,56 kr");
  });
});
