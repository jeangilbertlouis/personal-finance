import { DEFAULT_DB_PATH, deleteByAccounts, insertTransactions, openDb } from "./db.ts";
import { SAMPLE_ACCOUNTS, generateSampleTransactions } from "./sampleData.ts";

// Twelve months ending with last month.
const now = new Date();
const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const lastMonth = last.toISOString().slice(0, 7);

const db = openDb();
// Only sample accounts are replaced; any real imported data is left alone.
const removed = deleteByAccounts(db, [...SAMPLE_ACCOUNTS]);
const inserted = insertTransactions(db, generateSampleTransactions(lastMonth));
console.log(`Seeded ${DEFAULT_DB_PATH}: removed ${removed} old sample rows, inserted ${inserted} (through ${lastMonth}).`);
db.close();
