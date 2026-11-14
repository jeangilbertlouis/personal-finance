import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { openDb } from "../src/server/db.ts";
import type { CategoryUsage, PeriodsResponse, SankeyResponse, Transaction } from "../src/shared/types.ts";

const HOST = { host: "localhost:5180" };
const JSON_HEADERS = { ...HOST, "content-type": "application/json" };

function setup() {
  const app = createApp(openDb(":memory:"));
  const call = (path: string, init: RequestInit = {}) =>
    app.request(path, { ...init, headers: { ...JSON_HEADERS, ...(init.headers as object) } });
  const add = async (body: object) => {
    const res = await call("/api/transactions", { method: "POST", body: JSON.stringify(body) });
    return { res, tx: (await res.json()) as Transaction };
  };
  return { app, call, add };
}

const salary = { date: "2026-10-25", amountMinor: 300_000, category: "Salary" };
const rent = { date: "2026-10-01", amountMinor: -120_000, category: "Rent", description: "October" };

describe("transactions API", () => {
  it("starts empty", async () => {
    const { call } = setup();
    const periods = (await (await call("/api/periods")).json()) as PeriodsResponse;
    expect(periods.months).toEqual([]);
  });

  it("creates transactions and feeds them into the Sankey", async () => {
    const { call, add } = setup();
    const { res, tx } = await add(salary);
    expect(res.status).toBe(201);
    expect(tx).toMatchObject({ ...salary, description: "", account: "Manual" });
    await add(rent);

    const sankey = (await (await call("/api/sankey")).json()) as SankeyResponse;
    expect(sankey.totals).toEqual({ incomeMinor: 300_000, expensesMinor: 120_000, netMinor: 180_000 });
    const periods = (await (await call("/api/periods")).json()) as PeriodsResponse;
    expect(periods.months).toEqual(["2026-10"]);
  });

  it("lists newest first and suggests categories by kind", async () => {
    const { call, add } = setup();
    await add(rent);
    await add(salary);
    const list = (await (await call("/api/transactions")).json()) as Transaction[];
    expect(list.map((t) => t.category)).toEqual(["Salary", "Rent"]);
    const cats = (await (await call("/api/categories")).json()) as CategoryUsage[];
    expect(cats).toContainEqual({ name: "Rent", kind: "expense", count: 1 });
    expect(cats).toContainEqual({ name: "Salary", kind: "income", count: 1 });
  });

  it("updates and deletes", async () => {
    const { call, add } = setup();
    const { tx } = await add(rent);
    const upd = await call(`/api/transactions/${tx.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...rent, amountMinor: -125_000 }),
    });
    expect(((await upd.json()) as Transaction).amountMinor).toBe(-125_000);

    expect((await call(`/api/transactions/${tx.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await call(`/api/transactions/${tx.id}`, { method: "DELETE" })).status).toBe(404);
    expect(
      (await call(`/api/transactions/${tx.id}`, { method: "PUT", body: JSON.stringify(rent) })).status,
    ).toBe(404);
  });

  it.each([
    ["zero amount", { ...salary, amountMinor: 0 }],
    ["fractional minor units", { ...salary, amountMinor: 10.5 }],
    ["blank category", { ...salary, category: "   " }],
    ["bad date", { ...salary, date: "25/10/2026" }],
  ])("rejects %s", async (_, body) => {
    const { res } = await setup().add(body);
    expect(res.status).toBe(400);
  });

  it("rejects writes without a JSON content type (cross-site form posts)", async () => {
    const { app } = setup();
    const res = await app.request("/api/transactions", {
      method: "POST",
      headers: { ...HOST, "content-type": "text/plain" },
      body: JSON.stringify(salary),
    });
    expect(res.status).toBe(415);
  });

  it("rejects requests for a non-local Host (DNS rebinding)", async () => {
    const { app } = setup();
    const res = await app.request("/api/periods", { headers: { host: "evil.example:8787" } });
    expect(res.status).toBe(403);
  });
});
