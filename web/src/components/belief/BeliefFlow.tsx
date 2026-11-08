"use client";

// Belief flow — the run as a connected graph over time (UI.md §7).
//   x = time in the run, y = belief (0 = refuted, 1 = certain).
//   Each hypothesis is a short segment: it starts at the agent's stated prediction (hollow dot), steps when its
//   experiment lands, and ends with ✓ at its final belief, or falls to 0 when refuted.
//   Arcs connect a hypothesis to the earlier one it refines / depends on / contradicts, so lineages read left → right.
// `mode="before"` collapses it into the plain keep/discard chart; experiment dots fly between the two.

import { useMemo, type CSSProperties } from "react";
import { beliefAt, bestSoFar, fmtMetric, type Experiment, type Hypothesis, type LinkRelation } from "@/lib/belief/engine";
import { usePrefersReducedMotion } from "@/components/motion/useInView";
import { HypothesisCard } from "./HypothesisCard";
import { useReplay } from "./Replay";
import { STATUS } from "./layout";

const W = 1100;
const H = 400;
const PAD = { l: 64, r: 24, t: 26, b: 34 };
const EASE = "cubic-bezier(.2,.8,.2,1)";
const EASE_IO = "cubic-bezier(.65,0,.35,1)";
const MIN_SEG_S = 6; // a hypothesis proposed and closed in the same second still gets a visible segment

// Two kinds of link only: an idea builds on an earlier one (refines / depends on), or conflicts with it.
const LINK_STYLE: Record<LinkRelation, { stroke: string; dash?: string; label: string }> = {
  refines: { stroke: "rgba(230,234,236,.38)", label: "builds on" },
  depends_on: { stroke: "rgba(230,234,236,.38)", label: "builds on" },
  contradicts: { stroke: STATUS.refutes, dash: "4 3", label: "conflicts with" },
};

// Lines are colored by outcome, not by topic: held up, dropped, or still open.
const OPEN = "#C9CFD3";
const outcomeColor = (h: Hypothesis) =>
  h.status === "confirmed" ? STATUS.supports : h.status === "refuted" || h.status === "abandoned" ? STATUS.refutes : OPEN;

/** The chain behind a hypothesis: everything it builds on (recursively), plus the ideas that build directly on it. */
function lineageOf(links: { from: string; to: string }[], id: string) {
  const seen = new Set([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const l of links) {
      if (l.from === cur && !seen.has(l.to)) {
        seen.add(l.to);
        stack.push(l.to);
      }
    }
  }
  for (const l of links) if (l.to === id) seen.add(l.from);
  return seen;
}

export function BeliefFlow({
  mode,
  focus,
  onFocus,
  topicFocus,
  pinned,
  onPin,
  highlight = [],
}: {
  mode: "beliefs" | "before";
  focus: string | null;
  onFocus: (id: string | null) => void;
  topicFocus: string | null;
  pinned: string | null;
  onPin: (id: string | null) => void;
  highlight?: string[];
}) {
  const { state, final } = useReplay();
  const reduced = usePrefersReducedMotion();
  const before = mode === "before";
  const T = Math.max(final.t, 1);

  const sx = (t: number) => PAD.l + (t / T) * (W - PAD.l - PAD.r);
  const sy = (b: number) => PAD.t + (1 - b) * (H - PAD.t - PAD.b);

  // Before-view scales: x = experiment index, y = the run's metric (log scale when it spans orders of magnitude).
  const metric = final.task.metric;
  const N = final.expOrder.length;
  const vals = [final.baseline, ...final.expOrder.map((id) => final.experiments[id].after ?? final.experiments[id].before)].filter(
    (v) => Number.isFinite(v),
  );
  const vMin = Math.min(...vals, final.baseline || 1);
  const vMax = Math.max(...vals, final.baseline || 1);
  const useLog = vMin > 0 && vMax / vMin > 20;
  const f = (v: number) => (useLog ? Math.log10(Math.max(v, 1e-12)) : v);
  const lo = useLog ? f(vMin * 0.8) : vMin - (vMax - vMin) * 0.08;
  const hi = useLog ? f(vMax * 1.05) : vMax + (vMax - vMin) * 0.08 || vMax + 1;
  const bx = (i: number) => PAD.l + (i / Math.max(1, N - 1)) * (W - PAD.l - PAD.r);
  const by = (v: number) => H - PAD.b - ((f(v) - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  // Gridlines: 1-2-5 steps per decade on a log scale, four even steps otherwise.
  const ticks = useLog
    ? Array.from({ length: 24 }, (_, i) => [1, 2, 5].map((k) => k * 10 ** (Math.floor(lo) + Math.floor(i / 1) - 0)))
        .flat()
        .filter((v, i, a) => a.indexOf(v) === i && f(v) >= lo && f(v) <= hi)
        .filter((_, i, a) => a.length <= 6 || i % Math.ceil(a.length / 6) === 0)
    : [0, 1, 2, 3].map((k) => vMin + ((vMax - vMin) * k) / 3);

  const hyps = state.order.map((id) => state.hypotheses[id]);
  const bests = bestSoFar(state);
  const stepPath = bests.length ? `M${bx(0)},${by(final.baseline)} ` + bests.map((b, i) => `H${bx(i)} V${by(b)}`).join(" ") : "";

  // Segment geometry per hypothesis.
  const seg = useMemo(() => {
    const out: Record<
      string,
      { t0: number; t1: number; d: string; ext: string | null; end: { x: number; y: number }; dead: boolean; open: boolean }
    > = {};
    for (const h of hyps) {
      const pts = h.history;
      const dead = h.status === "refuted" || h.status === "abandoned";
      const open = h.status === "open";
      const t0 = pts[0]?.t ?? h.t;
      const lastT = pts[pts.length - 1]?.t ?? t0;
      const tEnd = Math.max(lastT, t0 + MIN_SEG_S); // where the evidence stops
      const t1 = open ? Math.max(tEnd, state.t) : tEnd;
      let d = `M${sx(t0)},${sy(pts[0]?.belief ?? h.prior)}`;
      for (let i = 1; i < pts.length; i++) d += ` H${sx(Math.max(pts[i].t, t0 + (i * MIN_SEG_S) / pts.length))} V${sy(pts[i].belief)}`;
      d += ` H${sx(tEnd)}`;
      // Still open: the stretch after its last evidence is drawn faint, so open ideas don't dominate the chart.
      const ext = open && t1 > tEnd ? `M${sx(tEnd)},${sy(h.belief)} H${sx(t1)}` : null;
      out[h.id] = { t0, t1, d, ext, end: { x: sx(t1), y: sy(h.belief) }, dead, open };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const lineage = useMemo(() => (focus ?? pinned) ? lineageOf(state.links, (focus ?? pinned)!) : highlight.length ? new Set(highlight) : null, [focus, pinned, state.links, highlight]);
  const lit = (h: Hypothesis) => {
    if (lineage) return lineage.has(h.id);
    if (topicFocus) return h.topic === topicFocus;
    return true;
  };

  // Links: from the parent's point at the child's start (or the parent's end, if it already closed) to the child's start.
  const links = state.links
    .filter((l) => seg[l.from] && seg[l.to])
    .map((l) => {
      const child = state.hypotheses[l.from];
      const parent = state.hypotheses[l.to];
      const cs = seg[child.id];
      const ps = seg[parent.id];
      const pt = Math.min(cs.t0, ps.t1);
      const x1 = sx(pt);
      const y1 = sy(beliefAt(parent, pt));
      const x2 = sx(cs.t0);
      const y2 = sy(child.prior);
      const mx = (x1 + x2) / 2;
      const d = `M${x1},${y1} C${mx + 18},${y1} ${mx - 18},${y2} ${x2},${y2}`;
      return { key: `${l.from}-${l.to}-${l.relation}`, d, rel: l.relation, child, parent, mid: { x: mx, y: (y1 + y2) / 2 } };
    });

  const dotPos = (e: Experiment, i: number) => {
    if (before) return { x: bx(i), y: by(e.after ?? e.before) };
    const h = state.hypotheses[e.hypothesisIds[0]];
    const t = Math.max(e.t, seg[h?.id ?? ""]?.t0 ?? e.t);
    return { x: sx(t), y: sy(h ? beliefAt(h, e.t + 0.01) : 0.5) };
  };

  const fade = (on: boolean, delay = 0): CSSProperties => ({
    opacity: on ? 1 : 0,
    transition: `opacity 280ms ${EASE} ${on ? delay : 0}ms`,
    pointerEvents: on ? "auto" : "none",
  });

  const minutes = Array.from({ length: Math.floor(T / 60) + 1 }, (_, m) => m * 60).filter((t) => t > 0);

  const pin = pinned && !before && seg[pinned] && state.hypotheses[pinned] ? { id: pinned, x: sx(seg[pinned].t0), y: sy(state.hypotheses[pinned].prior) } : null;

  return (
    <div className="relative min-w-[760px]">
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full"
      onClick={(e) => {
        if (e.target === e.currentTarget) onPin(null);
      }}
      role="img"
      aria-label={before ? `Keep/discard chart of ${metric.label} per experiment` : "Belief in each hypothesis over time, with links between related hypotheses"}
      onMouseLeave={() => onFocus(null)}
    >

      {/* ---- Before: the metric per experiment ---- */}
      <g style={fade(before)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={by(v)} y2={by(v)} stroke="rgba(230,234,236,.10)" strokeDasharray="2 4" />
            <text x={PAD.l - 10} y={by(v) + 4} textAnchor="end" className="font-mono" fontSize={11} fill="#8A949A">
              {fmtMetric(v)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={14} className="font-mono" fontSize={11} letterSpacing="0.08em" fill="#8A949A">
          {metric.label.toUpperCase()}{useLog ? " (LOG)" : ""} · PER EXPERIMENT · {metric.direction === "lower" ? "LOWER" : "HIGHER"} IS BETTER
        </text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="font-mono" fontSize={11} letterSpacing="0.08em" fill="#8A949A">
          EXPERIMENTS →
        </text>
        <path d={stepPath} fill="none" stroke={STATUS.supports} strokeOpacity={0.55} strokeWidth={1.5} />
      </g>

      {/* ---- Beliefs: axes ---- */}
      <g style={fade(!before, 450)}>
        {[
          { v: 1, l: "certain" },
          { v: 0.5, l: "unsure" },
          { v: 0, l: "refuted" },
        ].map(({ v, l }) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="rgba(230,234,236,.10)" strokeDasharray={v === 0 ? undefined : "2 4"} />
            <text x={PAD.l - 10} y={sy(v) + 4} textAnchor="end" className="font-mono" fontSize={11} fill="#8A949A">
              {l}
            </text>
          </g>
        ))}
        {minutes.map((t) => (
          <text key={t} x={sx(t)} y={H - 10} textAnchor="middle" className="font-mono" fontSize={10} fill="#8A949A">
            {t / 60}m
          </text>
        ))}
        {/* now line */}
        <line x1={sx(state.t)} x2={sx(state.t)} y1={PAD.t - 8} y2={H - PAD.b} stroke="rgba(184,242,58,.35)" />

        {/* Links between hypotheses */}
        {links.map((l) => {
          const st = LINK_STYLE[l.rel];
          const on = lit(l.child) && lit(l.parent);
          const show = focus === l.child.id || focus === l.parent.id || l.rel === "contradicts";
          return (
            <g key={l.key} style={{ opacity: on ? 1 : 0.12, transition: `opacity 280ms ${EASE}` }}>
              <path
                d={l.d}
                fill="none"
                stroke={st.stroke}
                strokeWidth={l.rel === "contradicts" ? 1.3 : 1}
                strokeDasharray={st.dash}
              />
              {show && (
                <text x={l.mid.x + 6} y={l.mid.y - 4} className="font-mono" fontSize={10} fill={l.rel === "contradicts" ? st.stroke : "#C9CFD3"}>
                  {l.child.id} {st.label} {l.parent.id}
                </text>
              )}
            </g>
          );
        })}

        {/* Hypothesis segments */}
        {hyps.map((h) => {
          const s = seg[h.id];
          const color = outcomeColor(h);
          const on = lit(h);
          const isNew = state.newest === h.id || h.experiments.includes(state.newest ?? "");
          return (
            <g
              key={h.id}
              role="button"
              tabIndex={0}
              aria-label={`${h.id} ${h.status}: ${h.claim}`}
              onMouseEnter={() => onFocus(h.id)}
              onFocus={() => onFocus(h.id)}
              onClick={(e) => {
                e.stopPropagation();
                onFocus(h.id);
                onPin(h.id);
              }}
              className="cursor-pointer outline-none"
              style={{ opacity: on ? (s.dead ? 0.7 : 1) : 0.12, transition: `opacity 280ms ${EASE}` }}
            >
              <path d={s.d} fill="none" stroke="transparent" strokeWidth={14} />
              {s.ext && <path d={s.ext} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 4" />}
              <path
                d={s.d}
                fill="none"
                stroke={color}
                strokeWidth={focus === h.id || pinned === h.id ? 3 : 2}
                strokeLinecap="round"
                pathLength={1}
                className={reduced ? undefined : "anim-draw"}
              />
              {/* prediction: hollow dot at the stated prior */}
              <circle cx={sx(s.t0)} cy={sy(h.history[0]?.belief ?? h.prior)} r={4} fill="#0E1114" stroke={color} strokeWidth={1.5} />
              <text x={sx(s.t0)} y={sy(h.history[0]?.belief ?? h.prior) - 9} textAnchor="middle" className="font-mono" fontSize={10} fill={focus === h.id ? "#E6EAEC" : "#8A949A"}>
                {h.id}
              </text>
              {/* outcome */}
              <circle cx={s.end.x} cy={s.end.y} r={s.open ? 3 : 5} fill={color} />
              {isNew && !reduced && <circle key={`ring-${state.seq}`} cx={s.end.x} cy={s.end.y} r={5} fill="none" stroke={STATUS.live} className="anim-ring" />}
            </g>
          );
        })}
        {/* Hover: one line saying what the idea is (click for the full card) */}
        {focus && !pinned && seg[focus] && state.hypotheses[focus] && (() => {
          const h = state.hypotheses[focus];
          const x0 = sx(seg[focus].t0);
          const y0 = sy(h.history[0]?.belief ?? h.prior);
          const text = `${h.id} · ${h.claim.length > 72 ? `${h.claim.slice(0, 71)}…` : h.claim}`;
          const w = text.length * 6.4 + 16;
          const x = Math.min(Math.max(x0 - w / 2, PAD.l), W - PAD.r - w);
          const y = y0 < 70 ? y0 + 14 : y0 - 40;
          return (
            <g pointerEvents="none">
              <rect x={x} y={y} width={w} height={22} rx={4} fill="#161A1E" stroke="rgba(230,234,236,.18)" />
              <text x={x + 8} y={y + 15} className="font-mono" fontSize={11} fill="#E6EAEC">
                {text}
              </text>
            </g>
          );
        })()}
      </g>

      {/* ---- Experiment dots: shared by both views, they fly between them ---- */}
      {final.expOrder.map((id, i) => {
        const e = state.experiments[id];
        if (!e) return null;
        const p = dotPos(e, i);
        const h = state.hypotheses[e.hypothesisIds[0]];
        const dim = !before && h ? !lit(h) : false;
        const bad = e.failed || !e.correct;
        const fill = !before ? "#E6EAEC" : bad ? STATUS.refutes : e.kept === true ? STATUS.supports : e.kept === false ? "#0E1114" : "#E6EAEC";
        const stroke = !before ? "#E6EAEC" : bad ? STATUS.refutes : e.kept === false ? "#7C8B98" : fill;
        const r = before ? 5 : 2.5;
        return (
          <g
            key={id}
            style={{
              transform: `translate(${p.x}px, ${p.y}px)`,
              transition: reduced ? "none" : `transform 600ms ${EASE_IO} ${i * 25}ms, opacity 280ms ${EASE}`,
              opacity: dim ? 0.15 : 1,
            }}
          >
            <title>
              {`${e.id} · ${e.failed ? `failed (${e.errorKind})` : `${metric.label} ${fmtMetric(e.before, metric)} → ${fmtMetric(e.after ?? e.before, metric)}`}${e.kept === null ? "" : e.kept ? " · kept" : " · discarded"}`}
            </title>
            <circle r={r} fill={fill} stroke={stroke} strokeWidth={1.2} style={{ transition: `r 600ms ${EASE_IO}` }} />
          </g>
        );
      })}
    </svg>
    {pin && (
      <div
        className="absolute z-20"
        style={{
          ...(pin.x / W > 0.55 ? { right: `${(1 - pin.x / W) * 100 + 1.2}%` } : { left: `${(pin.x / W) * 100 + 1.2}%` }),
          ...(pin.y / H > 0.5 ? { bottom: `${(1 - pin.y / H) * 100 - 4}%` } : { top: `${(pin.y / H) * 100 - 4}%` }),
        }}
      >
        <HypothesisCard state={state} id={pin.id} onClose={() => onPin(null)} />
      </div>
    )}
    </div>
  );
}
