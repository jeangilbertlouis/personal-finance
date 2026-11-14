import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/server/app.ts";
import { listItems, openDb } from "../src/server/db.ts";
import type { CategoryUsage, Item, SankeyResponse } from "../src/shared/types.ts";

const HOST = { host: "localhost:5180" };
const JSON_HEADERS = { ...HOST, "content-type": "application/json" };

function setup() {
  const app = createApp(openDb(":memory:"));
  const call = (path: string, init: RequestInit = {}) =>
    app.request(path, { ...init, headers: { ...JSON_HEADERS, ...(init.headers as object) } });
  const add = async (body: object) => {
    const res = await call("/api/items", { method: "POST", body: JSON.stringify(body) });
    return { res, item: (await res.json()) as Item };
  };
  return { app, call, add };
}

const salary = { amountMinor: 300_000, category: "Salary" };
const rent = { amountMinor: -120_000, category: "Rent", description: "Flat" };

describe("items API", () => {
  it("creates items and feeds them into the Sankey", async () => {
    const { call, add } = setup();
    const { res, item } = await add(salary);
    expect(res.status).toBe(201);
    expect(item).toMatchObject({ ...salary, description: "" });
    await add(rent);

    const sankey = (await (await call("/api/sankey")).json()) as SankeyResponse;
    expect(sankey.totals).toEqual({ incomeMinor: 300_000, expensesMinor: 120_000, netMinor: 180_000 });
    expect(sankey.itemCount).toBe(2);
  });

  it("lists income first, largest first, and suggests categories by type", async () => {
    const { call, add } = setup();
    await add({ amountMinor: -5_000, category: "Phone" });
    await add(rent);
    await add(salary);
    const list = (await (await call("/api/items")).json()) as Item[];
    expect(list.map((i) => i.category)).toEqual(["Salary", "Rent", "Phone"]);
    const cats = (await (await call("/api/categories")).json()) as CategoryUsage[];
    expect(cats).toContainEqual({ name: "Rent", kind: "expense", count: 1 });
    expect(cats).toContainEqual({ name: "Salary", kind: "income", count: 1 });
  });

  it("updates and deletes", async () => {
    const { call, add } = setup();
    const { item } = await add(rent);
    const upd = await call(`/api/items/${item.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...rent, amountMinor: -125_000 }),
    });
    expect(((await upd.json()) as Item).amountMinor).toBe(-125_000);

    expect((await call(`/api/items/${item.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await call(`/api/items/${item.id}`, { method: "DELETE" })).status).toBe(404);
    expect((await call(`/api/items/${item.id}`, { method: "PUT", body: JSON.stringify(rent) })).status).toBe(404);
  });

  it.each([
    ["zero amount", { ...salary, amountMinor: 0 }],
    ["fractional minor units", { ...salary, amountMinor: 10.5 }],
    ["blank category", { ...salary, category: "   " }],
    ["missing amount", { category: "Salary" }],
  ])("rejects %s", async (_, body) => {
    const { res } = await setup().add(body);
    expect(res.status).toBe(400);
  });

  it("rejects writes without a JSON content type (cross-site form posts)", async () => {
    const res = await setup().app.request("/api/items", {
      method: "POST",
      headers: { ...HOST, "content-type": "text/plain" },
      body: JSON.stringify(salary),
    });
    expect(res.status).toBe(415);
  });

  it("rejects requests for a non-local Host (DNS rebinding)", async () => {
    const res = await setup().app.request("/api/items", { headers: { host: "evil.example:8787" } });
    expect(res.status).toBe(403);
  });
});

describe("migration from dated transactions", () => {
  it("carries old transactions over as monthly items and keeps a backup table", () => {
    const dir = mkdtempSync(join(tmpdir(), "finance-"));
    const path = join(dir, "old.db");
    try {
      const old = new DatabaseSync(path);
      old.exec(`
        CREATE TABLE transactions (id TEXT PRIMARY KEY, date TEXT, amount_minor INTEGER, description TEXT,
                                   account TEXT, category TEXT, subcategory TEXT);
        INSERT INTO transactions VALUES ('a', '2026-11-14', 5000000, '', 'Manual', 'Salary', NULL),
                                        ('b', '2026-11-14', -500000, 'Loan', 'Manual', 'Car', NULL);
      `);
      old.close();

      const db = openDb(path);
      expect(listItems(db)).toEqual([
        { id: "a", category: "Salary", description: "", amountMinor: 5_000_000 },
        { id: "b", category: "Car", description: "Loan", amountMinor: -500_000 },
      ]);
      const backup = db.prepare("SELECT COUNT(*) AS n FROM transactions_backup").get() as { n: number };
      expect(Number(backup.n)).toBe(2);
      db.close();

      // Re-opening is a no-op.
      const again = openDb(path);
      expect(listItems(again)).toHaveLength(2);
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
