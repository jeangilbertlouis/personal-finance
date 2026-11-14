/** ISO 4217 code used to format all amounts. Single-currency for now. */
export const CURRENCY = "GBP";
export const LOCALE = "en-GB";

export function formatMoney(minor: number, opts: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 2,
  }).format(minor / 100);
}
