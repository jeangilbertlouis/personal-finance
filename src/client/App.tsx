import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSankey } from "./api.ts";
import { Sankey, SankeyLegend } from "./Sankey.tsx";
import { ItemForm } from "./ItemForm.tsx";
import { ItemList } from "./ItemList.tsx";
import { formatMoney } from "../shared/config.ts";
import type { Item, SankeyResponse } from "../shared/types.ts";

export function App() {
  const sankey = useQuery({ queryKey: ["sankey"], queryFn: fetchSankey, placeholderData: (prev) => prev });
  const [editing, setEditing] = useState<Item | null>(null);
  const hasItems = (sankey.data?.itemCount ?? 0) > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Personal finance</h1>
        <p className="text-sm text-ink-3">A typical month: where the money comes from, and where it goes.</p>
      </header>

      {sankey.isError ? (
        <Notice title="Can't reach the API">
          Start everything with <code className="font-mono">npm run dev</code>, which runs the API on port 8787 alongside
          this page.
        </Notice>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="rounded-xl border border-line bg-surface p-5 lg:sticky lg:top-6">
            <ItemForm key={editing?.id ?? "new"} editing={editing} onDone={() => setEditing(null)} />
          </aside>

          <main className="min-w-0 space-y-6">
            {!sankey.data ? (
              <div className="h-96 animate-pulse rounded-xl bg-surface" />
            ) : !hasItems ? (
              <Notice title="Nothing entered yet">
                Add what comes in and goes out in a typical month: salary, rent, bills, groceries and so on. The
                cash-flow diagram appears as soon as there's something to show.
              </Notice>
            ) : (
              <>
                <Overview data={sankey.data} />
                <section className="rounded-xl border border-line bg-surface">
                  <ItemList editingId={editing?.id ?? null} onEdit={setEditing} />
                </section>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

function Overview({ data }: { data: SankeyResponse }) {
  const { incomeMinor, expensesMinor, netMinor } = data.totals;
  const rate = incomeMinor > 0 ? (netMinor / incomeMinor) * 100 : 0;
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Monthly totals">
        <StatTile label="Income per month" value={formatMoney(incomeMinor)} />
        <StatTile label="Spending per month" value={formatMoney(expensesMinor)} />
        <StatTile
          label={netMinor >= 0 ? "Left over per month" : "Shortfall per month"}
          value={formatMoney(Math.abs(netMinor))}
          note={
            incomeMinor <= 0
              ? undefined
              : netMinor >= 0
                ? `${rate.toFixed(1)}% of income`
                : `Spending is ${Math.abs(rate).toFixed(1)}% more than income`
          }
        />
      </section>

      <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Monthly cash flow</h2>
          <SankeyLegend hasDeficit={netMinor < 0} />
        </div>
        <Sankey data={data} />
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-sm text-ink-2">Table view</summary>
          <FlowTable data={data} />
        </details>
      </section>
    </>
  );
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {note && <div className="mt-0.5 text-sm text-ink-3">{note}</div>}
    </div>
  );
}

function FlowTable({ data }: { data: SankeyResponse }) {
  const income = data.totals.incomeMinor;
  const rows = data.links.map((l) => {
    const node = data.nodes.find((n) => n.id === (l.source === "budget" ? l.target : l.source))!;
    return { node, value: l.value };
  });
  const kindLabel = { income: "Income", expense: "Spending", savings: "Left over", deficit: "Shortfall", budget: "" };
  return (
    <div className="overflow-x-auto">
      <table className="mt-2 w-full text-sm">
        <thead className="text-left text-ink-3">
          <tr className="border-b border-line">
            <th className="py-2 font-normal">Category</th>
            <th className="py-2 font-normal">Type</th>
            <th className="py-2 text-right font-normal">Per month</th>
            <th className="py-2 text-right font-normal">% of income</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ node, value }) => (
            <tr key={node.id} className="border-b border-line last:border-0">
              <td className="py-2">{node.name}</td>
              <td className="py-2 text-ink-2">{kindLabel[node.kind]}</td>
              <td className="py-2 text-right">{formatMoney(value)}</td>
              <td className="py-2 text-right text-ink-2">
                {income > 0 ? `${((value / income) * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-16 text-center">
      <h2 className="font-medium">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">{children}</p>
    </div>
  );
}
