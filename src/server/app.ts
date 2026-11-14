import { Hono } from "hono";
import type { DatabaseSync } from "node:sqlite";
import { ItemInputSchema } from "../shared/types.ts";
import { createItem, deleteItem, listCategories, listItems, updateItem } from "./db.ts";
import { buildSankey } from "./aggregate.ts";

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function createApp(db: DatabaseSync) {
  const app = new Hono().basePath("/api");

  /*
   * The API listens on loopback, but any web page open in the browser can still
   * send requests to it. Two cheap guards:
   *  - reject unexpected Host headers (blocks DNS-rebinding attacks);
   *  - require a JSON content type on writes, which forces a CORS preflight that
   *    this API never approves, so other sites can't create or edit data.
   */
  app.use("*", async (c, next) => {
    if (!LOCAL_HOST.test(c.req.header("host") ?? "")) return c.json({ error: "forbidden host" }, 403);
    if (c.req.method === "POST" || c.req.method === "PUT") {
      if (!(c.req.header("content-type") ?? "").startsWith("application/json")) {
        return c.json({ error: "expected application/json" }, 415);
      }
    }
    await next();
  });

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/sankey", (c) => c.json(buildSankey(listItems(db))));

  app.get("/categories", (c) => c.json(listCategories(db)));

  app.get("/items", (c) => c.json(listItems(db)));

  app.post("/items", async (c) => {
    const parsed = ItemInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    return c.json(createItem(db, parsed.data), 201);
  });

  app.put("/items/:id", async (c) => {
    const parsed = ItemInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const updated = updateItem(db, c.req.param("id"), parsed.data);
    return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
  });

  app.delete("/items/:id", (c) =>
    deleteItem(db, c.req.param("id")) ? c.body(null, 204) : c.json({ error: "not found" }, 404),
  );

  return app;
}
