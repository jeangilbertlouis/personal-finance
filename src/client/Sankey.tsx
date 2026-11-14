import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import type { SankeyNodeDatum, SankeyNodeKind, SankeyResponse } from "../shared/types.ts";
import { formatMoney } from "../shared/config.ts";

type Node = SankeyNode<SankeyNodeDatum, object>;
type Link = SankeyLink<SankeyNodeDatum, object>;

export const KIND_COLOR: Record<SankeyNodeKind, string> = {
  income: "var(--flow-income)",
  expense: "var(--flow-expense)",
  savings: "var(--flow-savings)",
  deficit: "var(--flow-savings)",
  budget: "var(--flow-budget)",
};

const NODE_WIDTH = 12;
const NODE_PADDING = 14;
const MARGIN = { top: 28, right: 190, bottom: 12, left: 170 };
const MIN_WIDTH = 720;

/** A link takes the colour of whichever end isn't the central Budget node. */
const linkKind = (l: Link) => {
  const s = l.source as Node;
  const t = l.target as Node;
  return s.kind === "budget" ? t.kind : s.kind;
};

interface Tooltip {
  x: number;
  y: number;
  title: string;
  value: number;
  share: string;
}

export function Sankey({ data }: { data: SankeyResponse }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<Tooltip | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(MIN_WIDTH, entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tallestColumn = Math.max(
    data.nodes.filter((n) => n.kind === "income" || n.kind === "deficit").length,
    data.nodes.filter((n) => n.kind === "expense" || n.kind === "savings").length,
  );
  const height = Math.max(360, tallestColumn * 40 + MARGIN.top + MARGIN.bottom);

  const graph = useMemo(() => {
    const layout = sankey<SankeyNodeDatum, object>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      // Keep the API's ordering (largest first) rather than d3's crossing minimisation.
      .nodeSort(null)
      .extent([
        [MARGIN.left, MARGIN.top],
        [width - MARGIN.right, height - MARGIN.bottom],
      ]);
    // d3-sankey mutates its input, so hand it copies.
    return layout({ nodes: data.nodes.map((n) => ({ ...n })), links: data.links.map((l) => ({ ...l })) });
  }, [data, width, height]);

  const income = data.totals.incomeMinor || 1;
  const pct = (v: number) => `${((v / income) * 100).toFixed(1)}% of income`;
  const path = sankeyLinkHorizontal();

  const showTip = (e: React.MouseEvent, title: string, value: number) => {
    const box = wrapRef.current!.getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title, value, share: pct(value) });
  };

  const isDimmed = (ids: string[]) => hover !== null && !ids.includes(hover);

  return (
    <div ref={wrapRef} className="relative w-full overflow-x-auto">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Sankey diagram of income flowing into the budget and out to spending categories and savings"
        onMouseLeave={() => {
          setHover(null);
          setTip(null);
        }}
      >
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--flow-savings)" opacity="0.35" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--flow-savings)" strokeWidth="3" />
          </pattern>
        </defs>

        <g fill="none">
          {graph.links.map((l, i) => {
            const s = l.source as Node;
            const t = l.target as Node;
            const id = `link:${s.id}->${t.id}`;
            const kind = linkKind(l);
            const dimmed = isDimmed([id, s.id, t.id]);
            const d = path(l) ?? undefined;
            return (
              <g key={i}>
                <path
                  d={d}
                  stroke={kind === "deficit" ? "url(#hatch)" : KIND_COLOR[kind]}
                  strokeWidth={Math.max(1, l.width ?? 1)}
                  strokeOpacity={
                    hover === id ? "var(--link-opacity-hover)" : dimmed ? 0.08 : "var(--link-opacity)"
                  }
                  style={{ transition: "stroke-opacity 120ms" }}
                />
                {/* Wider invisible hit target so thin flows are still hoverable. */}
                <path
                  d={d}
                  stroke="transparent"
                  strokeWidth={Math.max(10, l.width ?? 1)}
                  onMouseMove={(e) => {
                    setHover(id);
                    showTip(e, `${s.name} → ${t.name}`, l.value);
                  }}
                />
              </g>
            );
          })}
        </g>

        <g>
          {graph.nodes.map((n) => {
            const x0 = n.x0 ?? 0;
            const x1 = n.x1 ?? 0;
            const y0 = n.y0 ?? 0;
            const y1 = n.y1 ?? 0;
            const h = Math.max(1, y1 - y0);
            const onLeft = n.kind === "income" || n.kind === "deficit";
            const isBudget = n.kind === "budget";
            const labelX = isBudget ? (x0 + x1) / 2 : onLeft ? x0 - 8 : x1 + 8;
            const labelY = isBudget ? y0 - 10 : (y0 + y1) / 2;
            const anchor = isBudget ? "middle" : onLeft ? "end" : "start";
            const dimmed = isDimmed([n.id, ...graphNeighbours(n)]);
            return (
              <g
                key={n.id}
                opacity={dimmed ? 0.35 : 1}
                style={{ transition: "opacity 120ms" }}
                onMouseMove={(e) => {
                  setHover(n.id);
                  showTip(e, n.name, n.value ?? 0);
                }}
              >
                <rect
                  x={x0}
                  y={y0}
                  width={x1 - x0}
                  height={h}
                  rx={3}
                  fill={n.kind === "deficit" ? "url(#hatch)" : KIND_COLOR[n.kind]}
                  stroke="var(--surface-1)"
                  strokeWidth={1}
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={anchor}
                  dominantBaseline={isBudget ? "auto" : "middle"}
                  className="text-[13px]"
                >
                  <tspan fill="var(--text-primary)" fontWeight={500}>
                    {n.name}
                  </tspan>
                  <tspan fill="var(--text-secondary)" dx={6}>
                    {formatMoney(n.value ?? 0)}
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-lg"
          style={{ left: Math.min(tip.x + 14, width - 220), top: tip.y + 14 }}
        >
          <div className="font-medium text-ink">{tip.title}</div>
          <div className="text-ink">{formatMoney(tip.value)}</div>
          <div className="text-ink-3">{tip.share}</div>
        </div>
      )}
    </div>
  );
}

function graphNeighbours(n: Node): string[] {
  return [
    ...(n.sourceLinks ?? []).map((l) => (l.target as Node).id),
    ...(n.targetLinks ?? []).map((l) => (l.source as Node).id),
    ...(n.sourceLinks ?? []).map((l) => `link:${n.id}->${(l.target as Node).id}`),
    ...(n.targetLinks ?? []).map((l) => `link:${(l.source as Node).id}->${n.id}`),
  ];
}

export function SankeyLegend({ hasDeficit }: { hasDeficit: boolean }) {
  const items: { label: string; fill: string }[] = [
    { label: "Income", fill: KIND_COLOR.income },
    { label: "Spending", fill: KIND_COLOR.expense },
    hasDeficit ? { label: "From savings", fill: "url(#legend-hatch)" } : { label: "Saved", fill: KIND_COLOR.savings },
  ];
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2" aria-label="Legend">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden>
            <defs>
              <pattern id="legend-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="4" height="4" fill="var(--flow-savings)" opacity="0.35" />
                <line x1="0" y1="0" x2="0" y2="4" stroke="var(--flow-savings)" strokeWidth="2" />
              </pattern>
            </defs>
            <rect width="12" height="12" rx="3" fill={it.fill} />
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  );
}
