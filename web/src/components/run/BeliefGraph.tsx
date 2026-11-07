"use client";

// Belief graph (PLAN §4.9, UI.md §7). Topic lanes of hypothesis cards; each card shows the agent's stated prior,
// the evidence-weighted posterior, and the experiments that bear on it. Cross-links are dashed, labeled curves.
// Layout is deterministic (lanes in topic order, cards in proposal order) so it stays stable while the run is live.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GraphState, HypothesisNode } from "@/lib/beliefEngine";
import { Chip, EVIDENCE_STYLE, Label, STATUS_STYLE } from "./ui";

type Props = {
  graph: GraphState;
  selected: string | null;
  highlighted: Set<string>;
  newestId: string | null;
  live: boolean;
  onSelect: (id: string | null) => void;
};

const RELATION_LABEL = { contradicts: "contradicts", depends_on: "depends on", refines: "refines" } as const;

export function BeliefGraph({ graph, selected, highlighted, newestId, live, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [boxes, setBoxes] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const [size, setSize] = useState({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const root = wrap.current;
    if (!root) return;
    const rb = root.getBoundingClientRect();
    const next: typeof boxes = {};
    cards.current.forEach((el, id) => {
      const b = el.getBoundingClientRect();
      next[id] = { x: b.left - rb.left + root.scrollLeft, y: b.top - rb.top + root.scrollTop, w: b.width, h: b.height };
    });
    setBoxes(next);
    setSize({ w: root.scrollWidth, h: root.scrollHeight });
  }, []);

  useLayoutEffect(measure, [graph, measure]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [measure]);

  // Pan the selected / highlighted card into view (NL query, ledger clicks).
  useEffect(() => {
    const id = selected ?? [...highlighted][0];
    if (id) cards.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selected, highlighted]);

  if (!graph.topics.length) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 text-center">
        <div className="anim-shimmer h-2 w-40 rounded-[3px] bg-mist" />
        <p className="font-mono text-[13px] text-muted">Waiting for the first hypothesis.</p>
      </div>
    );
  }

  return (
    <div ref={wrap} className="relative overflow-x-auto pb-2" onClick={(e) => e.target === e.currentTarget && onSelect(null)}>
      <div className="relative flex min-w-max gap-4 p-1">
        {graph.topics.map((topic, ti) => (
          <section key={topic.name} className="w-[236px] shrink-0">
            <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-line pb-2">
              <Label className="truncate">
                {String(ti + 1).padStart(2, "0")} / {topic.name}
              </Label>
              <span className="shrink-0 font-mono text-[11px] text-muted" title="hypotheses · refuted">
                {topic.hypothesisIds.length}h{topic.refuted ? ` · ${topic.refuted}✕` : ""}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {topic.hypothesisIds.map((id) => (
                <HypothesisCard
                  key={id}
                  h={graph.hypotheses[id]}
                  graph={graph}
                  stance={topic.stance === id}
                  selected={selected === id}
                  dim={(selected !== null && selected !== id && !highlighted.has(id)) || (highlighted.size > 0 && !highlighted.has(id) && selected !== id)}
                  glow={highlighted.has(id)}
                  newest={live && newestId === id}
                  onSelect={onSelect}
                  refCb={(el) => (el ? cards.current.set(id, el) : cards.current.delete(id))}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Cross-links overlay */}
      <svg className="pointer-events-none absolute left-0 top-0" width={size.w} height={size.h} aria-hidden>
        {graph.links.map((l, i) => {
          const a = boxes[l.from];
          const b = boxes[l.to];
          if (!a || !b) return null;
          const leftToRight = a.x <= b.x;
          const x1 = leftToRight ? a.x + a.w : a.x;
          const x2 = leftToRight ? b.x : b.x + b.w;
          const sameLane = Math.abs(a.x - b.x) < 4;
          const y1 = a.y + 24;
          const y2 = b.y + 24;
          const bend = sameLane ? 36 : Math.max(40, Math.abs(x2 - x1) / 2);
          const sx = sameLane ? a.x + a.w : x1;
          const ex = sameLane ? b.x + b.w : x2;
          const c1 = sameLane ? sx + bend : leftToRight ? x1 + bend : x1 - bend;
          const c2 = sameLane ? ex + bend : leftToRight ? x2 - bend : x2 + bend;
          const d = `M ${sx} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${ex} ${y2}`;
          const color = l.relation === "contradicts" ? "var(--color-danger)" : l.relation === "depends_on" ? "var(--color-violet)" : "var(--color-cyan)";
          const mx = sameLane ? sx + bend * 0.75 : (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const active = selected === l.from || selected === l.to || highlighted.has(l.from) || highlighted.has(l.to);
          return (
            <g key={i} opacity={selected && !active ? 0.25 : 1} className="transition-opacity duration-300">
              <path d={d} fill="none" stroke={color} strokeWidth={active ? 1.5 : 1} strokeDasharray="4 4" />
              <circle cx={ex} cy={y2} r={2.5} fill={color} />
              <rect x={mx - 36} y={my - 9} width={72} height={18} rx={3} fill="var(--color-white)" stroke={color} strokeWidth={1} />
              <text x={mx} y={my + 4} textAnchor="middle" className="font-mono" fontSize={10} fill={color}>
                {RELATION_LABEL[l.relation] ?? l.relation}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HypothesisCard({
  h,
  graph,
  stance,
  selected,
  dim,
  glow,
  newest,
  onSelect,
  refCb,
}: {
  h: HypothesisNode;
  graph: GraphState;
  stance: boolean;
  selected: boolean;
  dim: boolean;
  glow: boolean;
  newest: boolean;
  onSelect: (id: string | null) => void;
  refCb: (el: HTMLElement | null) => void;
}) {
  const st = STATUS_STYLE[h.status];
  const evidence = graph.evidence.filter((e) => e.hypothesis === h.id);
  const delta = h.confidence - h.prediction.confidence;
  return (
    <button
      ref={refCb}
      type="button"
      onClick={() => onSelect(selected ? null : h.id)}
      className={[
        "anim-row-in relative w-full overflow-hidden rounded-[6px] border bg-white p-3 text-left transition-[opacity,border-color] duration-200",
        selected ? "border-signal" : glow ? "border-signal" : "border-line hover:border-muted",
        dim ? "opacity-35" : "opacity-100",
      ].join(" ")}
      style={glow ? { outline: "2px solid var(--color-signal)", outlineOffset: 2 } : undefined}
    >
      {newest && <span className="anim-edge absolute inset-y-0 left-0 w-[3px] bg-live" aria-hidden />}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Chip className="border-line text-ink">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cobalt" />
            {h.id}
          </Chip>
          <Chip className={st.chip}>{st.label}</Chip>
          {stance && <Chip className="border-line text-muted" title="strongest surviving hypothesis in this topic">STANCE</Chip>}
        </div>
        <span className="font-mono text-[13px] tabular-nums text-ink">{Math.round(h.confidence * 100)}%</span>
      </div>

      <p className="mt-2 line-clamp-3 text-[13px] leading-[18px] text-ink">{h.claim}</p>

      {/* Confidence: prior tick vs posterior bar */}
      <div className="mt-3">
        <div className="relative h-1.5 overflow-hidden rounded-[3px] bg-mist">
          <div
            className="absolute inset-y-0 left-0 w-full origin-left rounded-[3px] transition-transform duration-[600ms]"
            style={{ transform: `scaleX(${h.confidence})`, background: st.bar, transitionTimingFunction: "var(--ease-out)" }}
          />
        </div>
        <div className="relative h-2">
          <span className="absolute top-0 h-2 w-px bg-ink" style={{ left: `${h.prediction.confidence * 100}%` }} title="stated prior" />
        </div>
        <div className="flex justify-between font-mono text-[11px] text-muted">
          <span>
            prior {Math.round(h.prediction.confidence * 100)}% · {h.prediction.direction === "decrease" ? "↓ rows" : h.prediction.direction === "increase" ? "↑ rows" : "= rows"}
          </span>
          {evidence.length > 0 && (
            <span className={delta >= 0 ? "text-success" : "text-danger"}>
              {delta >= 0 ? "+" : ""}
              {Math.round(delta * 100)} pts
            </span>
          )}
        </div>
      </div>

      {evidence.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {evidence.map((e) => {
            const es = EVIDENCE_STYLE[e.kind];
            return (
              <Chip key={e.experiment} className={es.cls} title={`${e.experiment}: ${es.title}`}>
                {e.experiment} {es.glyph}
              </Chip>
            );
          })}
        </div>
      )}

      <div className="mt-2 truncate font-mono text-[11px] text-subtle">
        {h.codeRegion.file} · {h.codeRegion.symbol}
      </div>
    </button>
  );
}
