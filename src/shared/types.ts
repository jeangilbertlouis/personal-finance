import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/**
 * One normalised transaction. Amounts are integer minor units (pence/cents):
 * positive = money in, negative = money out.
 */
export const TransactionSchema = z.object({
  id: z.string(),
  date: isoDate,
  amountMinor: z.number().int(),
  description: z.string(),
  account: z.string(),
  category: z.string(),
  subcategory: z.string().nullable(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const PeriodQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type PeriodQuery = z.infer<typeof PeriodQuerySchema>;

export type SankeyNodeKind = "income" | "budget" | "expense" | "savings" | "deficit";

export interface SankeyNodeDatum {
  id: string;
  name: string;
  kind: SankeyNodeKind;
}

export interface SankeyLinkDatum {
  source: string;
  target: string;
  /** Minor units, always positive. */
  value: number;
}

export interface SankeyResponse {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
  totals: { incomeMinor: number; expensesMinor: number; netMinor: number };
  transactionCount: number;
}

export interface PeriodsResponse {
  /** Distinct YYYY-MM months that have data, newest first. */
  months: string[];
}

/** What the entry form sends. The server assigns the id; account defaults to "Manual". */
export const TransactionInputSchema = z.object({
  date: isoDate,
  amountMinor: z
    .number()
    .int()
    .refine((n) => n !== 0, "amount can't be zero")
    .refine((n) => Math.abs(n) <= 1_000_000_000_00, "amount is too large"),
  description: z.string().trim().max(200).default(""),
  category: z.string().trim().min(1, "category is required").max(60),
});
export type TransactionInput = z.infer<typeof TransactionInputSchema>;

export interface CategoryUsage {
  name: string;
  kind: "income" | "expense";
  count: number;
}
