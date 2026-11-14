import { describe, expect, it } from "vitest";
import { buildSankey } from "../src/server/aggregate.ts";

const item = (category: string, amountMinor: number) => ({ category, amountMinor });

describe("buildSankey", () => {
  it("routes income through Budget to expenses and what's left over", () => {
    const res = buildSankey([item("Salary", 300_000), item("Rent", -100_000), item("Groceries", -50_000)]);
    expect(res.totals).toEqual({ incomeMinor: 300_000, expensesMinor: 150_000, netMinor: 150_000 });
    expect(res.links).toEqual([
      { source: "income:Salary", target: "budget", value: 300_000 },
      { source: "budget", target: "expense:Rent", value: 100_000 },
      { source: "budget", target: "expense:Groceries", value: 50_000 },
      { source: "budget", target: "savings", value: 150_000 },
    ]);
  });

  it("adds a shortfall source when spending exceeds income, keeping Budget balanced", () => {
    const res = buildSankey([item("Salary", 100_000), item("Rent", -250_000)]);
    const into = res.links.filter((l) => l.target === "budget").reduce((s, l) => s + l.value, 0);
    const out = res.links.filter((l) => l.source === "budget").reduce((s, l) => s + l.value, 0);
    expect(into).toBe(out);
    expect(res.nodes.find((n) => n.kind === "deficit")?.name).toBe("Shortfall");
    expect(res.nodes.find((n) => n.kind === "savings")).toBeUndefined();
  });

  it("sums items in the same category", () => {
    const res = buildSankey([item("Salary", 100_000), item("Subscriptions", -1_100), item("Subscriptions", -999)]);
    expect(res.links).toContainEqual({ source: "budget", target: "expense:Subscriptions", value: 2_099 });
  });

  it("keeps an income and an expense with the same category name separate", () => {
    const res = buildSankey([item("Side job", 50_000), item("Side job", -10_000)]);
    expect(res.totals).toMatchObject({ incomeMinor: 50_000, expensesMinor: 10_000 });
  });

  it("returns an empty diagram when there are no items", () => {
    expect(buildSankey([])).toMatchObject({ nodes: [], links: [], itemCount: 0 });
  });
});
