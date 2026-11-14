const CURRENCY_AFFIX = /^(?:[£$€]|kr\.?|sek|usd|eur|gbp)\s*|\s*(?:[£$€]|kr\.?|sek|usd|eur|gbp)$/gi;

/**
 * Parse a user-typed amount into positive integer minor units, without going
 * through floating point. Accepts both English and European conventions:
 *   "42", "42.5", "1,234.56", "£40", "$1,234"
 *   "42,50", "1.234,56", "1 234,56 kr", "€12"
 * The decimal separator is whichever of "." / "," comes last; a lone comma is
 * a decimal separator only when followed by one or two digits ("42,50"), so
 * "1,234" is still one thousand two hundred and thirty-four.
 * Returns null for anything that isn't a plain positive amount.
 */
export function parseAmountToMinor(input: string): number | null {
  const s = input
    .replace(/[  ]/g, " ")
    .trim()
    .replace(CURRENCY_AFFIX, "")
    .trim();
  if (!s) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let decimalSep: "." | "," | null = null;
  if (lastDot >= 0 && lastComma >= 0) decimalSep = lastDot > lastComma ? "." : ",";
  else if (lastDot >= 0) decimalSep = ".";
  else if (/^[^,]*,\d{1,2}$/.test(s)) decimalSep = ",";

  const parts = decimalSep ? s.split(decimalSep) : [s];
  if (parts.length > 2) return null;
  const [intRaw = "", frac = ""] = parts;
  if (decimalSep && !/^\d{1,2}$/.test(frac)) return null;

  const intDigits = parseGroupedInteger(intRaw, decimalSep);
  if (intDigits === null) return null;

  const minor = Number(intDigits) * 100 + Number(frac.padEnd(2, "0"));
  return minor > 0 && Number.isSafeInteger(minor) ? minor : null;
}

/** "1234", "1,234", "1.234" or "1 234" → "1234"; anything else → null. */
function parseGroupedInteger(raw: string, decimalSep: "." | "," | null): string | null {
  if (/^\d+$/.test(raw)) return raw;
  const sep = [",", ".", " "].find((c) => c !== decimalSep && raw.includes(c));
  if (!sep) return null;
  const grouped = new RegExp(`^\\d{1,3}(?:${sep === "." ? "\\." : sep}\\d{3})+$`);
  return grouped.test(raw) ? raw.split(sep).join("") : null;
}

/** Inverse of parseAmountToMinor for pre-filling the form: 123456 → "1234.56". */
export function minorToInput(minor: number): string {
  const abs = Math.abs(minor);
  return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
