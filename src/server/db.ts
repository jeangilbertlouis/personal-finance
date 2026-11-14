import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { SettingsSchema, type CategoryUsage, type Item, type ItemInput, type Settings } from "../shared/types.ts";
import { DEFAULT_CURRENCY } from "../shared/currency.ts";

export const DEFAULT_DB_PATH = resolve(process.env.FINANCE_DB ?? "data/finance.db");

export function openDb(path: string = DEFAULT_DB_PATH): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS items (
      id           TEXT PRIMARY KEY,
      category     TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      amount_minor INTEGER NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  migrateDatedTransactions(db);
  return db;
}

/**
 * Earlier versions stored dated transactions. Carry each one over as a monthly
 * item (dropping the date) and keep the old table as `transactions_backup`
 * rather than deleting it.
 */
function migrateDatedTransactions(db: DatabaseSync) {
  const exists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'transactions'`).get();
  if (!exists) return;
  db.exec("BEGIN");
  try {
    db.exec(`
      INSERT OR IGNORE INTO items (id, category, description, amount_minor)
        SELECT id, category, description, amount_minor FROM transactions ORDER BY date, rowid;
      DROP TABLE IF EXISTS transactions_backup;
      ALTER TABLE transactions RENAME TO transactions_backup;
    `);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

interface Row {
  id: string;
  category: string;
  description: string;
  amount_minor: number;
}

const toItem = (r: Row): Item => ({
  id: r.id,
  category: r.category,
  description: r.description,
  amountMinor: r.amount_minor,
});

/** Income first, then expenses; largest amounts first within each. */
export function listItems(db: DatabaseSync): Item[] {
  const rows = db
    .prepare(`SELECT * FROM items ORDER BY amount_minor < 0, ABS(amount_minor) DESC, rowid`)
    .all() as unknown as Row[];
  return rows.map(toItem);
}

export function createItem(db: DatabaseSync, input: ItemInput): Item {
  const item: Item = { id: randomUUID(), ...input };
  db.prepare(`INSERT INTO items (id, category, description, amount_minor) VALUES (?, ?, ?, ?)`).run(
    item.id,
    item.category,
    item.description,
    item.amountMinor,
  );
  return item;
}

/** Returns the updated item, or null if no item has that id. */
export function updateItem(db: DatabaseSync, id: string, input: ItemInput): Item | null {
  const res = db
    .prepare(`UPDATE items SET category = ?, description = ?, amount_minor = ? WHERE id = ?`)
    .run(input.category, input.description, input.amountMinor, id);
  if (Number(res.changes) === 0) return null;
  return toItem(db.prepare(`SELECT * FROM items WHERE id = ?`).get(id) as unknown as Row);
}

export function deleteItem(db: DatabaseSync, id: string): boolean {
  return Number(db.prepare(`DELETE FROM items WHERE id = ?`).run(id).changes) > 0;
}

/** Categories already in use, most used first, so the form can suggest them. */
export function listCategories(db: DatabaseSync): CategoryUsage[] {
  const rows = db
    .prepare(
      `SELECT category AS name,
              CASE WHEN amount_minor > 0 THEN 'income' ELSE 'expense' END AS kind,
              COUNT(*) AS count
       FROM items GROUP BY name, kind ORDER BY count DESC, name`,
    )
    .all() as unknown as CategoryUsage[];
  return rows.map((r) => ({ name: r.name, kind: r.kind, count: Number(r.count) }));
}

const DEFAULT_SETTINGS: Settings = { currency: DEFAULT_CURRENCY };

/** Stored settings merged over defaults; unknown or invalid values fall back to the default. */
export function getSettings(db: DatabaseSync): Settings {
  const rows = db.prepare(`SELECT key, value FROM settings`).all() as unknown as { key: string; value: string }[];
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const parsed = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...stored });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export function saveSettings(db: DatabaseSync, settings: Settings): Settings {
  const stmt = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
  for (const [key, value] of Object.entries(settings)) stmt.run(key, String(value));
  return getSettings(db);
}
