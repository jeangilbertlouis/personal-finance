import { z } from "zod";

/**
 * Supported display currencies. Picking one changes how amounts are shown;
 * stored amounts are not converted.
 */
export const CURRENCIES = {
  GBP: { label: "Pounds", symbol: "£", locale: "en-GB" },
  USD: { label: "Dollars", symbol: "$", locale: "en-US" },
  EUR: { label: "Euros", symbol: "€", locale: "en-IE" },
  SEK: { label: "Kronor", symbol: "kr", locale: "sv-SE" },
} as const;

export const CurrencyCodeSchema = z.enum(["GBP", "USD", "EUR", "SEK"]);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;
export const DEFAULT_CURRENCY: CurrencyCode = "GBP";

const formatters = new Map<CurrencyCode, Intl.NumberFormat>();

export function formatMoney(minor: number, currency: CurrencyCode): string {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(CURRENCIES[currency].locale, { style: "currency", currency });
    formatters.set(currency, f);
  }
  return f.format(minor / 100);
}
