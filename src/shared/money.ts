/**
 * Parse a user-typed amount like "12", "12.5", "1,234.56" or "£40" into
 * positive integer minor units, without going through floating point.
 * Returns null for anything that isn't a plain positive amount.
 */
export function parseAmountToMinor(input: string): number | null {
  const s = input.trim().replace(/^[£$€]/, "").replace(/,/g, "");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return minor > 0 && Number.isSafeInteger(minor) ? minor : null;
}

/** Inverse of parseAmountToMinor for pre-filling the form: 123456 → "1234.56". */
export function minorToInput(minor: number): string {
  const abs = Math.abs(minor);
  return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
