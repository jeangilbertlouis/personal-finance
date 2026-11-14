import { createHash } from "node:crypto";
import type { Transaction } from "../shared/types.ts";

export const SAMPLE_ACCOUNTS = ["Sample Current Account", "Sample Credit Card"] as const;
const [CURRENT, CARD] = SAMPLE_ACCOUNTS;

/** Small deterministic PRNG so the sample data is the same on every run. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function transactionId(t: Omit<Transaction, "id">, seq: number): string {
  return createHash("sha256")
    .update([t.date, t.amountMinor, t.description, t.account, seq].join("|"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Twelve months of plausible transactions ending with `lastMonth` (YYYY-MM).
 * Includes a holiday month that overspends, so both the "Saved" and
 * "From savings" Sankey branches can be seen.
 */
export function generateSampleTransactions(lastMonth: string, seed = 42): Transaction[] {
  const rand = mulberry32(seed);
  const between = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) * 100);
  const out: Transaction[] = [];
  let seq = 0;

  const add = (
    date: string,
    pounds: number | [number, number],
    description: string,
    category: string,
    account: string = CURRENT,
    subcategory: string | null = null,
  ) => {
    const amountMinor = Array.isArray(pounds) ? -between(pounds[0], pounds[1]) : Math.round(pounds * 100);
    const t = { date, amountMinor, description, account, category, subcategory };
    out.push({ id: transactionId(t, seq++), ...t });
  };

  const [y, m] = lastMonth.split("-").map(Number) as [number, number];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const ym = d.toISOString().slice(0, 7);
    const day = (n: number) => `${ym}-${String(n).padStart(2, "0")}`;
    const monthIndex = d.getUTCMonth();

    // Income
    add(day(25), 3250, "ACME LTD SALARY", "Salary");
    if (rand() < 0.4) add(day(15), between(300, 900) / 100, "CLIENT INVOICE", "Freelance");
    add(day(28), between(4, 12) / 100, "INTEREST PAID", "Interest");
    if (monthIndex === 11) add(day(20), 1500, "ACME LTD BONUS", "Salary");

    // Fixed costs
    add(day(1), [1150, 1150], "LANDLORD RENT", "Housing", CURRENT, "Rent");
    add(day(5), [95, 160], "ENERGY CO", "Utilities", CURRENT, "Energy");
    add(day(6), [28, 28], "BROADBAND", "Utilities", CURRENT, "Internet");
    add(day(7), [15, 15], "MOBILE NETWORK", "Utilities", CURRENT, "Phone");
    add(day(3), [11, 11], "STREAMING SERVICE", "Subscriptions", CARD);
    add(day(9), [10, 10], "MUSIC SERVICE", "Subscriptions", CARD);
    add(day(2), [35, 35], "GYM MEMBERSHIP", "Health", CURRENT, "Gym");

    // Variable spending
    for (const wd of [4, 11, 18, 25]) add(day(wd), [55, 110], "SUPERMARKET", "Groceries", CARD);
    add(day(1), [140, 140], "MONTHLY TRAVEL PASS", "Transport", CURRENT, "Public transport");
    for (let k = 0; k < 3 + Math.floor(rand() * 4); k++) {
      add(day(1 + Math.floor(rand() * 27)), [12, 65], "RESTAURANT", "Eating out", CARD);
    }
    for (let k = 0; k < Math.floor(rand() * 4); k++) {
      add(day(1 + Math.floor(rand() * 27)), [20, 140], "ONLINE SHOP", "Shopping", CARD);
    }
    if (rand() < 0.3) add(day(14), [15, 60], "PHARMACY", "Health", CARD, "Pharmacy");

    // Occasional big items
    if (monthIndex === 7) add(day(10), [2400, 2400], "TRAVEL AGENT", "Holidays", CARD);
    if (monthIndex === 11) add(day(12), [350, 600], "GIFT SHOP", "Gifts", CARD);
    if (rand() < 0.15) add(day(16), [20, 80], "ONLINE SHOP REFUND", "Shopping", CARD);
  }

  // Refunds are money in: flip the sign generated above.
  for (const t of out) if (t.description.endsWith("REFUND")) t.amountMinor = -t.amountMinor;

  return out;
}
