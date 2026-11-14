import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteTransaction, fetchTransactions } from "./api.ts";
import { formatMoney } from "../shared/config.ts";
import type { PeriodQuery, Transaction } from "../shared/types.ts";

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

interface Props {
  period: PeriodQuery;
  periodLabel: string;
  editingId: string | null;
  onEdit: (t: Transaction) => void;
}

export function TransactionList({ period, periodLabel, editingId, onEdit }: Props) {
  const queryClient = useQueryClient();
  const txs = useQuery({
    queryKey: ["transactions", period],
    queryFn: () => fetchTransactions(period),
    placeholderData: (prev) => prev,
  });

  const remove = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const rows = txs.data ?? [];

  return (
    <div>
      <div className="flex items-baseline justify-between px-6 pt-5 pb-3">
        <h2 className="font-medium">Transactions</h2>
        <span className="text-sm text-ink-3">
          {periodLabel} · {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 pb-8 pt-4 text-center text-sm text-ink-3">Nothing entered for this period.</p>
      ) : (
        <div className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-ink-3">
              <tr className="border-b border-line">
                <th className="py-2 pl-6 font-normal">Date</th>
                <th className="py-2 font-normal">Category</th>
                <th className="hidden py-2 font-normal md:table-cell">Description</th>
                <th className="py-2 text-right font-normal">Amount</th>
                <th className="py-2 pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className={`border-b border-line last:border-0 ${editingId === t.id ? "bg-page" : ""}`}
                >
                  <td className="whitespace-nowrap py-2 pl-6 text-ink-2">{dateLabel(t.date)}</td>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{ background: t.amountMinor > 0 ? "var(--flow-income)" : "var(--flow-expense)" }}
                      />
                      {t.category}
                    </span>
                  </td>
                  <td className="hidden max-w-56 truncate py-2 text-ink-2 md:table-cell">{t.description}</td>
                  <td className="whitespace-nowrap py-2 text-right">
                    <span className="sr-only">{t.amountMinor > 0 ? "Income" : "Expense"} </span>
                    {t.amountMinor > 0 ? "+" : "−"}
                    {formatMoney(Math.abs(t.amountMinor))}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-6 text-right">
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-ink-2 hover:bg-page hover:text-ink"
                      onClick={() => onEdit(t)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-ink-2 hover:bg-page hover:text-ink disabled:opacity-50"
                      disabled={remove.isPending}
                      onClick={() => {
                        const what = `${t.category} ${formatMoney(Math.abs(t.amountMinor))} on ${dateLabel(t.date)}`;
                        if (window.confirm(`Delete ${what}? This can't be undone.`)) remove.mutate(t.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
