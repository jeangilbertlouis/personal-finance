import { describe, expect, it } from "vitest";
import { rankSuggestions } from "../src/client/CategoryInput.tsx";
import type { CategoryUsage } from "../src/shared/types.ts";

const cats: CategoryUsage[] = [
  { name: "Salary", kind: "income", count: 1 },
  { name: "Subscriptions", kind: "expense", count: 3 },
  { name: "Side job", kind: "income", count: 1 },
  { name: "Side job", kind: "expense", count: 1 },
  { name: "Transport", kind: "expense", count: 2 },
  { name: "Insurance", kind: "expense", count: 1 },
];
const names = (q: string, kind: CategoryUsage["kind"] = "expense") => rankSuggestions(cats, q, kind).map((s) => s.name);

describe("rankSuggestions", () => {
  it("suggests every existing category, of either type, when empty", () => {
    expect(names("")).toHaveLength(5);
  });

  it("puts the current type first, then most used", () => {
    expect(names("", "income").slice(0, 2)).toEqual(["Side job", "Salary"]);
    expect(names("", "expense")[0]).toBe("Subscriptions");
  });

  it("matches case-insensitively, prefix matches before substring matches", () => {
    expect(names("s")).toEqual(["Subscriptions", "Side job", "Salary", "Transport", "Insurance"]);
    expect(names("SUR")).toEqual(["Insurance"]);
  });

  it("offers income categories while entering an expense", () => {
    expect(names("sal", "expense")).toEqual(["Salary"]);
  });

  it("hides the list once the text exactly matches a category", () => {
    expect(names("transport")).toEqual([]);
  });

  it("merges a name used for both types into one suggestion", () => {
    const side = rankSuggestions(cats, "side", "expense");
    expect(side).toHaveLength(1);
    expect([...side[0]!.kinds].sort()).toEqual(["expense", "income"]);
  });
});
