import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { insertTransactions, openDb } from "../src/server/db.ts";
import { generateSampleTransactions } from "../src/server/sampleData.ts";
import type { PeriodsResponse, SankeyResponse } from "../src/shared/types.ts";

function setup() {
  const db = openDb(":memory:");
  insertTransactions(db, generateSampleTransactions("2026-10"));
  return createApp(db);
}

describe("API", () => {
  it("lists twelve months of sample data, newest first", async () => {
    const body = (await (await setup().request("/api/periods")).json()) as PeriodsResponse;
    expect(body.months).toHaveLength(12);
    expect(body.months[0]).toBe("2026-10");
    expect(body.months.at(-1)).toBe("2025-11");
  });

  it("filters the Sankey by date range", async () => {
    const app = setup();
    const all = (await (await app.request("/api/sankey")).json()) as SankeyResponse;
    const oct = (await (await app.request("/api/sankey?from=2026-10-01&to=2026-10-31")).json()) as SankeyResponse;
    expect(oct.transactionCount).toBeGreaterThan(0);
    expect(oct.transactionCount).toBeLessThan(all.transactionCount);
  });

  it("rejects malformed dates", async () => {
    const res = await setup().request("/api/sankey?from=October");
    expect(res.status).toBe(400);
  });

  it("re-inserting the same rows is a no-op", () => {
    const db = openDb(":memory:");
    const rows = generateSampleTransactions("2026-10");
    expect(insertTransactions(db, rows)).toBe(rows.length);
    expect(insertTransactions(db, rows)).toBe(0);
  });
});
