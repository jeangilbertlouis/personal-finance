import { useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createItem, fetchCategories, updateItem } from "./api.ts";
import { minorToInput, parseAmountToMinor } from "../shared/money.ts";
import type { Item, ItemInput } from "../shared/types.ts";

type Kind = "expense" | "income";

interface Props {
  /** When set, the form edits this item instead of adding a new one. */
  editing: Item | null;
  onDone: () => void;
}

export function ItemForm({ editing, onDone }: Props) {
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const listId = useId();
  const amountRef = useRef<HTMLInputElement>(null);

  // The parent remounts this form (via `key`) when `editing` changes, so the
  // initial state is all the syncing we need.
  const [kind, setKind] = useState<Kind>(editing && editing.amountMinor > 0 ? "income" : "expense");
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amountMinor) : "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setAmount("");
    setCategory("");
    setDescription("");
    setError(null);
  };

  const save = useMutation({
    mutationFn: (input: ItemInput) => (editing ? updateItem(editing.id, input) : createItem(input)),
    onSuccess: async () => {
      reset();
      onDone();
      amountRef.current?.focus();
      await queryClient.invalidateQueries();
    },
    onError: (err) => setError(err.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const minor = parseAmountToMinor(amount);
    if (minor === null) return setError("Enter an amount greater than zero, like 42 or 42.50.");
    if (!category.trim()) return setError("Choose or type a category.");
    save.mutate({
      amountMinor: kind === "income" ? minor : -minor,
      category: category.trim(),
      description: description.trim(),
    });
  };

  const suggestions = (categories.data ?? []).filter((c) => c.kind === kind);
  const field = "w-full rounded-md border border-line bg-page px-3 py-2 text-ink";

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{editing ? "Edit monthly item" : "Add monthly item"}</h2>
        {editing && (
          <button
            type="button"
            className="text-sm text-ink-2 hover:text-ink"
            onClick={() => {
              reset();
              onDone();
            }}
          >
            Cancel
          </button>
        )}
      </div>

      <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 rounded-md border border-line p-1 text-sm">
        {(["expense", "income"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`flex items-center justify-center gap-2 rounded px-3 py-1.5 ${
              kind === k ? "bg-page font-medium text-ink shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
          >
            <span
              aria-hidden
              className="size-2.5 rounded-sm"
              style={{ background: k === "income" ? "var(--flow-income)" : "var(--flow-expense)" }}
            />
            {k === "income" ? "Income" : "Expense"}
          </button>
        ))}
      </div>

      <label className="block space-y-1 text-sm text-ink-2">
        <span>Amount per month</span>
        <input
          ref={amountRef}
          className={field}
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
      </label>

      <label className="block space-y-1 text-sm text-ink-2">
        <span>Category</span>
        <input
          className={field}
          list={listId}
          placeholder={kind === "income" ? "e.g. Salary" : "e.g. Groceries"}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          maxLength={60}
        />
        <datalist id={listId}>
          {suggestions.map((c) => (
            <option key={c.name} value={c.name} />
          ))}
        </datalist>
      </label>

      <label className="block space-y-1 text-sm text-ink-2">
        <span>
          Description <span className="text-ink-3">(optional)</span>
        </span>
        <input
          className={field}
          placeholder={kind === "income" ? "e.g. Day job" : "e.g. Netflix"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={save.isPending}
        className="w-full rounded-md bg-ink px-4 py-2 text-sm font-medium text-page hover:opacity-90 disabled:opacity-50"
      >
        {save.isPending ? "Saving…" : editing ? "Save changes" : "Add"}
      </button>
    </form>
  );
}
