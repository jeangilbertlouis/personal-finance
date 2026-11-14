import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { DEFAULT_DB_PATH, listMonths, openDb } from "./db.ts";

const port = Number(process.env.API_PORT ?? 8787);
const db = openDb();
const app = createApp(db);

// Bind to loopback only: this is personal data and should never be exposed on the network.
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => {
  console.log(`API listening on http://127.0.0.1:${port} (db: ${DEFAULT_DB_PATH})`);
  if (listMonths(db).length === 0) {
    console.log("Database is empty — run `npm run seed` to load sample data.");
  }
});
