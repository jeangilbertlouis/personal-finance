import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { CategoryUsage, PeriodQuery, Transaction, TransactionInput } from "../shared/types.ts";

export const MANUAL_ACCOUNT = "Manual";

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
       ORDER BY date DESC, rowid DESC`,
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

export function createTransaction(db: DatabaseSync, input: TransactionInput): Transaction {
  const t: Transaction = { id: randomUUID(), account: MANUAL_ACCOUNT, subcategory: null, ...input };
  insertTransactions(db, [t]);
  return t;
}

/** Returns the updated row, or null if no transaction has that id. */
export function updateTransaction(db: DatabaseSync, id: string, input: TransactionInput): Transaction | null {
  const res = db
    .prepare(`UPDATE transactions SET date = ?, amount_minor = ?, description = ?, category = ? WHERE id = ?`)
    .run(input.date, input.amountMinor, input.description, input.category, id);
  if (Number(res.changes) === 0) return null;
  return toTransaction(db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id) as unknown as Row);
}

export function deleteTransaction(db: DatabaseSync, id: string): boolean {
  return Number(db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id).changes) > 0;
}

/** Categories already in use, most used first, so the form can suggest them. */
export function listCategories(db: DatabaseSync): CategoryUsage[] {
  const rows = db
    .prepare(
      `SELECT category AS name,
              CASE WHEN amount_minor > 0 THEN 'income' ELSE 'expense' END AS kind,
              COUNT(*) AS count
       FROM transactions GROUP BY name, kind ORDER BY count DESC, name`,
    )
    .all() as unknown as CategoryUsage[];
  return rows.map((r) => ({ name: r.name, kind: r.kind, count: Number(r.count) }));
}
