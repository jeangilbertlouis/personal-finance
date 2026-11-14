import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { PeriodQuery, Transaction } from "../shared/types.ts";

export const DEFAULT_DB_PATH = resolve(process.env.FINANCE_DB ?? "data/finance.db");

export function openDb(path: string = DEFAULT_DB_PATH): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS transactions (
      id           TEXT PRIMARY KEY,
      date         TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      description  TEXT NOT NULL,
      account      TEXT NOT NULL,
      category     TEXT NOT NULL,
      subcategory  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  `);
  return db;
}

interface Row {
  id: string;
  date: string;
  amount_minor: number;
  description: string;
  account: string;
  category: string;
  subcategory: string | null;
}

const toTransaction = (r: Row): Transaction => ({
  id: r.id,
  date: r.date,
  amountMinor: r.amount_minor,
  description: r.description,
  account: r.account,
  category: r.category,
  subcategory: r.subcategory,
});

export function insertTransactions(db: DatabaseSync, txs: Transaction[]): number {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO transactions (id, date, amount_minor, description, account, category, subcategory)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  let inserted = 0;
  db.exec("BEGIN");
  try {
    for (const t of txs) {
      const res = stmt.run(t.id, t.date, t.amountMinor, t.description, t.account, t.category, t.subcategory);
      inserted += Number(res.changes);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return inserted;
}

export function listTransactions(db: DatabaseSync, { from, to }: PeriodQuery = {}): Transaction[] {
  const rows = db
    .prepare(
      `SELECT * FROM transactions
       WHERE (:from IS NULL OR date >= :from) AND (:to IS NULL OR date <= :to)
       ORDER BY date, id`,
    )
    .all({ from: from ?? null, to: to ?? null }) as unknown as Row[];
  return rows.map(toTransaction);
}

export function listMonths(db: DatabaseSync): string[] {
  const rows = db
    .prepare(`SELECT DISTINCT substr(date, 1, 7) AS month FROM transactions ORDER BY month DESC`)
    .all() as unknown as { month: string }[];
  return rows.map((r) => r.month);
}

export function deleteByAccounts(db: DatabaseSync, accounts: string[]): number {
  const stmt = db.prepare(`DELETE FROM transactions WHERE account = ?`);
  return accounts.reduce((n, a) => n + Number(stmt.run(a).changes), 0);
}
