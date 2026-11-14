import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPeriods, fetchSankey } from "./api.ts";
import { buildPeriodOptions } from "./periods.ts";
import { Sankey, SankeyLegend } from "./Sankey.tsx";
import { formatMoney } from "../shared/config.ts";
import type { SankeyResponse } from "../shared/types.ts";

export function App() {
  const periods = useQuery({ queryKey: ["periods"], queryFn: fetchPeriods });
  const options = useMemo(() => buildPeriodOptions(periods.data?.months ?? []), [periods.data]);
  const flat = [...options.all, ...options.years, ...options.months];
  const [periodKey, setPeriodKey] = useState("last12");
  const period = flat.find((o) => o.key === periodKey) ?? flat[0]!;

  const sankey = useQuery({
    queryKey: ["sankey", period.query],
    queryFn: () => fetchSankey(period.query),
    enabled: periods.isSuccess,
    placeholderData: (prev) => prev,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Personal finance</h1>
          <p className="text-sm text-ink-3">Where the money came from, and where it went.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Period
          <select
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-ink"
            value={period.key}
            onChange={(e) => setPeriodKey(e.target.value)}
            disabled={!periods.isSuccess}
          >
            {options.all.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
            {options.years.length > 0 && (
              <optgroup label="Year">
                {options.years.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            )}
            {options.months.length > 0 && (
              <optgroup label="Month">
                {options.months.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      </header>

      {periods.isError || sankey.isError ? (
        <Notice title="Can't reach the API">
          Start everything with <code className="font-mono">npm run dev</code>, which runs the API on port 8787 alongside
          this page.
        </Notice>
      ) : periods.isSuccess && periods.data.months.length === 0 ? (
        <Notice title="No transactions yet">
          Load sample data with <code className="font-mono">npm run seed</code>, then refresh.
        </Notice>
      ) : sankey.data ? (
        <Dashboard data={sankey.data} />
      ) : (
        <div className="h-96 animate-pulse rounded-xl bg-surface" />
      )}
    </div>
  );
}

function Dashboard({ data }: { data: SankeyResponse }) {
  const { incomeMinor, expensesMinor, netMinor } = data.totals;
  const rate = incomeMinor > 0 ? (netMinor / incomeMinor) * 100 : 0;
  return (
    <div className="space-y-6">
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
          <SankeyLegend hasDeficit={netMinor < 0} />
        </div>
        {data.links.length > 0 ? (
          <Sankey data={data} />
        ) : (
          <p className="py-16 text-center text-ink-3">No transactions in this period.</p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <details>
          <summary className="cursor-pointer px-6 py-4 font-medium">Table view</summary>
          <FlowTable data={data} />
        </details>
      </section>
    </div>
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
  const income = data.totals.incomeMinor || 1;
  const rows = data.links.map((l) => {
    const node = data.nodes.find((n) => n.id === (l.source === "budget" ? l.target : l.source))!;
    return { node, value: l.value };
  });
  const kindLabel = { income: "Income", expense: "Spending", savings: "Saved", deficit: "From savings", budget: "" };
  return (
    <div className="overflow-x-auto px-6 pb-4">
      <table className="w-full text-sm">
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
              <td className="py-2 text-right text-ink-2">{((value / income) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-10 text-center">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-ink-2">{children}</p>
    </div>
  );
}
