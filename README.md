# Personal finance

Local-only app for visualising personal income and spending as Sankey diagrams.
Everything is entered by hand in the web UI. There is no bank import.

## Quick start

```bash
npm install
npm run dev    # API on 127.0.0.1:8787, web UI on http://localhost:5180
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Hono API (`tsx watch`) + Vite dev server together |
| `npm test` | Vitest unit + API tests |
| `npm run typecheck` | `tsc` over client, server and tests |

## Layout

```
src/shared/   zod schemas, types, currency formatting (CURRENCY in config.ts)
src/server/   Hono API (transaction CRUD), SQLite (node:sqlite), Sankey aggregation
src/client/   React UI: entry form, transaction list, period picker, Sankey (d3-sankey)
tests/        Vitest
data/         SQLite DB. Gitignored, never committed.
```

## Privacy

- The API binds to `127.0.0.1` only, rejects non-local `Host` headers, and only
  accepts writes sent as JSON, so other websites open in your browser can't change your data.
- `data/` and `*.db` are gitignored, so your entries never reach git.

## Environment

| Variable | Default |
| --- | --- |
| `FINANCE_DB` | `data/finance.db` |
| `API_PORT` | `8787` |
| `WEB_PORT` | `5180` |
