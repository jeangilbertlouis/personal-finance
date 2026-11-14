import type { ItemInput, SankeyLinkDatum, SankeyNodeDatum, SankeyResponse } from "../shared/types.ts";

const BUDGET_ID = "budget";

/**
 * Turn monthly items into a three-column flow:
 *   income categories → Budget → expense categories
 * plus a "Saved" sink when income exceeds spending, or a
 * "From savings" source when spending exceeds income.
 *
 * Items are summed per (type, category), so an income and an expense
 * that happen to share a category name stay separate.
 */
export function buildSankey(items: Pick<ItemInput, "amountMinor" | "category">[]): SankeyResponse {
  const income = new Map<string, number>();
  const expense = new Map<string, number>();
  for (const it of items) {
    const bucket = it.amountMinor > 0 ? income : expense;
    bucket.set(it.category, (bucket.get(it.category) ?? 0) + Math.abs(it.amountMinor));
  }

  const nodes: SankeyNodeDatum[] = [{ id: BUDGET_ID, name: "Budget", kind: "budget" }];
  const links: SankeyLinkDatum[] = [];
  const bySize = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]);

  let incomeMinor = 0;
  for (const [category, value] of bySize(income)) {
    const id = `income:${category}`;
    nodes.push({ id, name: category, kind: "income" });
    links.push({ source: id, target: BUDGET_ID, value });
    incomeMinor += value;
  }

  let expensesMinor = 0;
  for (const [category, value] of bySize(expense)) {
    const id = `expense:${category}`;
    nodes.push({ id, name: category, kind: "expense" });
    links.push({ source: BUDGET_ID, target: id, value });
    expensesMinor += value;
  }

  const netMinor = incomeMinor - expensesMinor;
  if (netMinor > 0) {
    nodes.push({ id: "savings", name: "Left over", kind: "savings" });
    links.push({ source: BUDGET_ID, target: "savings", value: netMinor });
  } else if (netMinor < 0) {
    nodes.push({ id: "deficit", name: "Shortfall", kind: "deficit" });
    links.push({ source: "deficit", target: BUDGET_ID, value: -netMinor });
  }

  // A lone Budget node with no flows is not a diagram.
  if (links.length === 0) nodes.length = 0;

  return { nodes, links, totals: { incomeMinor, expensesMinor, netMinor }, itemCount: items.length };
}
