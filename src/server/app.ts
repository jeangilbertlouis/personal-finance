import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { PeriodQuerySchema, type PeriodsResponse } from "../shared/types.ts";
import { listMonths, listTransactions } from "./db.ts";
import { buildSankey } from "./aggregate.ts";

export function createApp(db: DatabaseSync) {
  const app = new Hono().basePath("/api");

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/periods", (c) => c.json<PeriodsResponse>({ months: listMonths(db) }));

  app.get("/sankey", (c) => {
    const parsed = PeriodQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    return c.json(buildSankey(listTransactions(db, parsed.data)));
  });

  app.get("/transactions", (c) => {
    const parsed = PeriodQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    return c.json(listTransactions(db, parsed.data));
  });

  return app;
}
