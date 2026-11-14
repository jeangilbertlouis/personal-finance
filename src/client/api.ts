import type {
  CategoryUsage,
  PeriodQuery,
  PeriodsResponse,
  SankeyResponse,
  Transaction,
  TransactionInput,
} from "../shared/types.ts";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    const detail = Array.isArray(body?.error)
      ? body.error.map((i: { message?: string }) => i.message).join(", ")
      : typeof body?.error === "string"
        ? body.error
        : res.statusText;
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const qs = ({ from, to }: PeriodQuery) => {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const fetchPeriods = () => request<PeriodsResponse>("/api/periods");
export const fetchSankey = (q: PeriodQuery) => request<SankeyResponse>(`/api/sankey${qs(q)}`);
export const fetchTransactions = (q: PeriodQuery) => request<Transaction[]>(`/api/transactions${qs(q)}`);
export const fetchCategories = () => request<CategoryUsage[]>("/api/categories");

export const createTransaction = (input: TransactionInput) =>
  request<Transaction>("/api/transactions", json("POST", input));
export const updateTransaction = (id: string, input: TransactionInput) =>
  request<Transaction>(`/api/transactions/${encodeURIComponent(id)}`, json("PUT", input));
export const deleteTransaction = (id: string) =>
  request<void>(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE" });
