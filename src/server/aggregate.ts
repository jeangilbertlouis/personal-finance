import type {
  SankeyLinkDatum,
  SankeyNodeDatum,
  SankeyResponse,
  Transaction,
} from "../shared/types.ts";

const BUDGET_ID = "budget";

/**
 * Turn transactions into a three-column flow:
 *   income categories → Budget → expense categories
 * plus a "Savings" sink when income exceeds spending, or a
 * "From savings" source when spending exceeds income.
 *
 * Each category is netted across the period (a refund reduces its expense),
 * and lands on the income or expense side based on the sign of that net.
 */
export function buildSankey(txs: Transaction[]): SankeyResponse {
  const netByCategory = new Map<string, number>();
  for (const t of txs) {
    netByCategory.set(t.category, (netByCategory.get(t.category) ?? 0) + t.amountMinor);
  }

  const nodes: SankeyNodeDatum[] = [{ id: BUDGET_ID, name: "Budget", kind: "budget" }];
  const links: SankeyLinkDatum[] = [];
  let incomeMinor = 0;
  let expensesMinor = 0;

  const sorted = [...netByCategory].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  for (const [category, net] of sorted) {
    if (net > 0) {
      const id = `income:${category}`;
      nodes.push({ id, name: category, kind: "income" });
      links.push({ source: id, target: BUDGET_ID, value: net });
      incomeMinor += net;
    } else if (net < 0) {
      const id = `expense:${category}`;
      nodes.push({ id, name: category, kind: "expense" });
      links.push({ source: BUDGET_ID, target: id, value: -net });
      expensesMinor += -net;
    }
  }

  const netMinor = incomeMinor - expensesMinor;
  if (netMinor > 0) {
    nodes.push({ id: "savings", name: "Saved", kind: "savings" });
    links.push({ source: BUDGET_ID, target: "savings", value: netMinor });
  } else if (netMinor < 0) {
    nodes.push({ id: "deficit", name: "From savings", kind: "deficit" });
    links.push({ source: "deficit", target: BUDGET_ID, value: -netMinor });
  }

  // A lone Budget node with no flows is not a diagram.
  if (links.length === 0) nodes.length = 0;

  return {
    nodes,
    links,
    totals: { incomeMinor, expensesMinor, netMinor },
    transactionCount: txs.length,
  };
}
