import { z } from "zod";
import { CurrencyCodeSchema } from "./currency.ts";

/**
 * One recurring monthly amount, e.g. "Salary £3,200" or "Rent £1,150".
 * Amounts are integer minor units (pence/cents) per month:
 * positive = income, negative = expense.
 */
export const ItemInputSchema = z.object({
  amountMinor: z
    .number()
    .int()
    .refine((n) => n !== 0, "amount can't be zero")
    .refine((n) => Math.abs(n) <= 1_000_000_000_00, "amount is too large"),
  category: z.string().trim().min(1, "category is required").max(60),
  description: z.string().trim().max(200).default(""),
});
export type ItemInput = z.infer<typeof ItemInputSchema>;

export interface Item extends ItemInput {
  id: string;
}

export interface CategoryUsage {
  name: string;
  kind: "income" | "expense";
  count: number;
}

export type SankeyNodeKind = "income" | "budget" | "expense" | "savings" | "deficit";

export interface SankeyNodeDatum {
  id: string;
  name: string;
  kind: SankeyNodeKind;
}

export interface SankeyLinkDatum {
  source: string;
  target: string;
  /** Minor units per month, always positive. */
  value: number;
}

export interface SankeyResponse {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
  totals: { incomeMinor: number; expensesMinor: number; netMinor: number };
  itemCount: number;
}

export const SettingsSchema = z.object({
  currency: CurrencyCodeSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;
