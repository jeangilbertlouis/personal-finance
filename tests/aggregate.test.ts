import { describe, expect, it } from "vitest";
import { buildSankey } from "../src/server/aggregate.ts";
import type { Transaction } from "../src/shared/types.ts";

let n = 0;
const tx = (category: string, amountMinor: number): Transaction => ({
  id: String(n++),
  date: "2026-01-15",
  amountMinor,
  description: category.toUpperCase(),
  account: "Test",
  category,
  subcategory: null,
});

describe("buildSankey", () => {
  it("routes income through Budget to expenses and savings", () => {
    const res = buildSankey([tx("Salary", 300_000), tx("Rent", -100_000), tx("Groceries", -50_000)]);
    expect(res.totals).toEqual({ incomeMinor: 300_000, expensesMinor: 150_000, netMinor: 150_000 });
    expect(res.links).toEqual([
      { source: "income:Salary", target: "budget", value: 300_000 },
      { source: "budget", target: "expense:Rent", value: 100_000 },
      { source: "budget", target: "expense:Groceries", value: 50_000 },
      { source: "budget", target: "savings", value: 150_000 },
    ]);
  });

  it("balances flows into and out of Budget", () => {
    const res = buildSankey([tx("Salary", 100_000), tx("Holidays", -250_000), tx("Interest", 500)]);
    const into = res.links.filter((l) => l.target === "budget").reduce((s, l) => s + l.value, 0);
    const out = res.links.filter((l) => l.source === "budget").reduce((s, l) => s + l.value, 0);
    expect(into).toBe(out);
    expect(res.nodes.find((x) => x.kind === "deficit")).toBeDefined();
    expect(res.nodes.find((x) => x.kind === "savings")).toBeUndefined();
  });

  it("nets refunds against their category", () => {
    const res = buildSankey([tx("Salary", 100_000), tx("Shopping", -10_000), tx("Shopping", 4_000)]);
    expect(res.links).toContainEqual({ source: "budget", target: "expense:Shopping", value: 6_000 });
  });

  it("returns an empty diagram for no transactions", () => {
    expect(buildSankey([])).toMatchObject({ nodes: [], links: [], transactionCount: 0 });
  });
});
