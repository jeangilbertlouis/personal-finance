import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteItem, fetchItems } from "./api.ts";
import { formatMoney } from "../shared/config.ts";
import type { Item } from "../shared/types.ts";

interface Props {
  editingId: string | null;
  onEdit: (item: Item) => void;
  onDeleted: (id: string) => void;
}

const actionBtn = "rounded px-2 py-1 text-ink-2 hover:bg-page hover:text-ink disabled:opacity-50";

export function ItemList({ editingId, onEdit, onDeleted }: Props) {
  const queryClient = useQueryClient();
  const items = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  // Confirmation happens inline in the row: native confirm() dialogs are
  // suppressed in some embedded browsers, which silently cancelled deletes.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: deleteItem,
    onSuccess: (_, id) => {
      setConfirmingId(null);
      onDeleted(id);
      return queryClient.invalidateQueries();
    },
  });

  const rows = items.data ?? [];

  return (
    <div>
      <div className="flex items-baseline justify-between px-6 pt-5 pb-3">
        <h2 className="font-medium">Monthly items</h2>
        <span className="text-sm text-ink-3">
          {rows.length} {rows.length === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-ink-3">
            <tr className="border-b border-line">
              <th className="py-2 pl-6 font-normal">Category</th>
              <th className="hidden py-2 font-normal md:table-cell">Description</th>
              <th className="py-2 text-right font-normal">Per month</th>
              <th className="py-2 pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.id} className={`border-b border-line last:border-0 ${editingId === it.id ? "bg-page" : ""}`}>
                <td className="py-2 pl-6">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ background: it.amountMinor > 0 ? "var(--flow-income)" : "var(--flow-expense)" }}
                    />
                    {it.category}
                  </span>
                </td>
                <td className="hidden max-w-56 truncate py-2 text-ink-2 md:table-cell">{it.description}</td>
                <td className="whitespace-nowrap py-2 text-right">
                  <span className="sr-only">{it.amountMinor > 0 ? "Income" : "Expense"} </span>
                  {it.amountMinor > 0 ? "+" : "−"}
                  {formatMoney(Math.abs(it.amountMinor))}
                </td>
                <td className="whitespace-nowrap py-2 pr-6 text-right">
                  {confirmingId === it.id ? (
                    <span className="inline-flex items-center gap-1" role="group" aria-label={`Delete ${it.category}?`}>
                      <span className="mr-1 text-ink-2">Delete?</span>
                      <button
                        type="button"
                        className="rounded bg-ink px-2 py-1 font-medium text-page hover:opacity-90 disabled:opacity-50"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(it.id)}
                        autoFocus
                      >
                        {remove.isPending ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button
                        type="button"
                        className={actionBtn}
                        disabled={remove.isPending}
                        onClick={() => setConfirmingId(null)}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <>
                      <button type="button" className={actionBtn} onClick={() => onEdit(it)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={actionBtn}
                        onClick={() => {
                          remove.reset();
                          setConfirmingId(it.id);
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {remove.isError && remove.variables === it.id && (
                    <div role="alert" className="mt-1 text-xs text-error">
                      Couldn't delete: {remove.error.message}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
