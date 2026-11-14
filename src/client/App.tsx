import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPeriods, fetchSankey } from "./api.ts";
import { buildPeriodOptions } from "./periods.ts";
import { Sankey, SankeyLegend } from "./Sankey.tsx";
import { TransactionForm } from "./TransactionForm.tsx";
import { TransactionList } from "./TransactionList.tsx";
import { formatMoney } from "../shared/config.ts";
import type { SankeyResponse, Transaction } from "../shared/types.ts";

export function App() {
  const periods = useQuery({ queryKey: ["periods"], queryFn: fetchPeriods });
  const options = useMemo(() => buildPeriodOptions(periods.data?.months ?? []), [periods.data]);
  const flat = [...options.all, ...options.years, ...options.months];
  const [periodKey, setPeriodKey] = useState("last12");
  const period = flat.find((o) => o.key === periodKey) ?? flat[0]!;
  const [editing, setEditing] = useState<Transaction | null>(null);

  const sankey = useQuery({
    queryKey: ["sankey", period.query],
    queryFn: () => fetchSankey(period.query),
    enabled: periods.isSuccess,
    placeholderData: (prev) => prev,
  });

  const hasAnyData = (periods.data?.months.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Personal finance</h1>
          <p className="text-sm text-ink-3">Where the money came from, and where it went.</p>
        </div>
        {hasAnyData && (
          <label className="flex items-center gap-2 text-sm text-ink-2">
            Period
            <select
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-ink"
              value={period.key}
              onChange={(e) => setPeriodKey(e.target.value)}
            >
              {options.all.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
              <optgroup label="Year">
                {options.years.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Month">
                {options.months.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        )}
      </header>

      {periods.isError || sankey.isError ? (
        <Notice title="Can't reach the API">
          Start everything with <code className="font-mono">npm run dev</code>, which runs the API on port 8787 alongside
          this page.
        </Notice>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="rounded-xl border border-line bg-surface p-5 lg:sticky lg:top-6">
            <TransactionForm key={editing?.id ?? "new"} editing={editing} onDone={() => setEditing(null)} />
          </aside>

          <main className="min-w-0 space-y-6">
            {!periods.isSuccess ? (
              <div className="h-96 animate-pulse rounded-xl bg-surface" />
            ) : !hasAnyData ? (
              <Notice title="Nothing entered yet">
                Add your income and expenses with the form. The cash-flow diagram appears as soon as there's something
                to show.
              </Notice>
            ) : (
              sankey.data && <Overview data={sankey.data} />
            )}

            {hasAnyData && (
              <section className="rounded-xl border border-line bg-surface">
                <TransactionList
                  period={period.query}
                  periodLabel={period.label}
                  editingId={editing?.id ?? null}
                  onEdit={setEditing}
                />
              </section>
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
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Totals">
        <StatTile label="Income" value={formatMoney(incomeMinor)} />
        <StatTile label="Spending" value={formatMoney(expensesMinor)} />
        <StatTile
          label={netMinor >= 0 ? "Saved" : "Drawn from savings"}
          value={formatMoney(Math.abs(netMinor))}
          note={
            incomeMinor <= 0
              ? undefined
              : netMinor >= 0
                ? `${rate.toFixed(1)}% of income`
                : `Spent ${Math.abs(rate).toFixed(1)}% more than earned`
          }
        />
      </section>

      <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Cash flow</h2>
          {data.links.length > 0 && <SankeyLegend hasDeficit={netMinor < 0} />}
        </div>
        {data.links.length > 0 ? (
          <>
            <Sankey data={data} />
            <details className="mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer text-sm text-ink-2">Table view</summary>
              <FlowTable data={data} />
            </details>
          </>
        ) : (
          <p className="py-16 text-center text-ink-3">No transactions in this period.</p>
        )}
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
  const kindLabel = { income: "Income", expense: "Spending", savings: "Saved", deficit: "From savings", budget: "" };
  return (
    <div className="overflow-x-auto">
      <table className="mt-2 w-full text-sm">
        <thead className="text-left text-ink-3">
          <tr className="border-b border-line">
            <th className="py-2 font-normal">Category</th>
            <th className="py-2 font-normal">Type</th>
            <th className="py-2 text-right font-normal">Amount</th>
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
