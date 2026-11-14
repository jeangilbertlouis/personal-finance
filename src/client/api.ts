import type { PeriodQuery, PeriodsResponse, SankeyResponse } from "../shared/types.ts";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${path}`);
  return (await res.json()) as T;
}

const qs = ({ from, to }: PeriodQuery) => {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const fetchPeriods = () => getJson<PeriodsResponse>("/api/periods");
export const fetchSankey = (q: PeriodQuery) => getJson<SankeyResponse>(`/api/sankey${qs(q)}`);
