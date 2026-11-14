import type { PeriodQuery } from "../shared/types.ts";

export interface PeriodOption {
  key: string;
  label: string;
  query: PeriodQuery;
}

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

const lastDay = (ym: string) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/** "Last 12 months", each calendar year, and each month — built from months that have data. */
export function buildPeriodOptions(months: string[]): { all: PeriodOption[]; years: PeriodOption[]; months: PeriodOption[] } {
  const all: PeriodOption[] = [{ key: "all", label: "All time", query: {} }];
  if (months.length > 0) {
    const newest = months[0]!;
    const twelveBack = months[Math.min(11, months.length - 1)]!;
    all.unshift({ key: "last12", label: "Last 12 months", query: { from: `${twelveBack}-01`, to: lastDay(newest) } });
  }
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].map((y) => ({
    key: y,
    label: y,
    query: { from: `${y}-01-01`, to: `${y}-12-31` },
  }));
  return {
    all,
    years,
    months: months.map((m) => ({ key: m, label: monthLabel(m), query: { from: `${m}-01`, to: lastDay(m) } })),
  };
}
