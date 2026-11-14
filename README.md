# Personal finance

Local-only app for visualising personal income and spending as Sankey diagrams.

## Quick start

```bash
npm install
npm run seed   # loads 12 months of sample data into data/finance.db
npm run dev    # API on 127.0.0.1:8787, web UI on http://localhost:5180
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Hono API (`tsx watch`) + Vite dev server together |
| `npm run seed` | Replaces the sample accounts' rows; real data is untouched |
| `npm test` | Vitest unit + API tests |
| `npm run typecheck` | `tsc` over client, server and tests |

## Layout

```
src/shared/   zod schemas, types, currency formatting (CURRENCY in config.ts)
src/server/   Hono API, SQLite (node:sqlite), Sankey aggregation, sample data
src/client/   React UI: period picker, totals, Sankey (d3-sankey), table view
tests/        Vitest
data/         SQLite DB and raw exports. Gitignored, never committed.
```

## Privacy

- The API binds to `127.0.0.1` only.
- `data/`, `*.db`, `*.csv`, `*.ofx` and `*.qfx` are gitignored, so bank exports
  never reach git.

## Environment

| Variable | Default |
| --- | --- |
| `FINANCE_DB` | `data/finance.db` |
| `API_PORT` | `8787` |
| `WEB_PORT` | `5180` |
