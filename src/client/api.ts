import type { CategoryUsage, Item, ItemInput, SankeyResponse, Settings } from "../shared/types.ts";

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

export const fetchSankey = () => request<SankeyResponse>("/api/sankey");
export const fetchItems = () => request<Item[]>("/api/items");
export const fetchCategories = () => request<CategoryUsage[]>("/api/categories");

export const createItem = (input: ItemInput) => request<Item>("/api/items", json("POST", input));
export const updateItem = (id: string, input: ItemInput) =>
  request<Item>(`/api/items/${encodeURIComponent(id)}`, json("PUT", input));
export const deleteItem = (id: string) =>
  request<void>(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });

export const fetchSettings = () => request<Settings>("/api/settings");
export const saveSettings = (settings: Settings) => request<Settings>("/api/settings", json("PUT", settings));
