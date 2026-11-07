"use client";

// Belief graph — UI.md §7. Topic hulls, hypothesis cards with prediction-vs-belief bars,
// experiment dots, implicit same-region links. `mode="before"` collapses it into the plain
// autoresearch keep/discard chart; switching modes flies each dot between the two (FlyTo).

import { useMemo, type CSSProperties } from "react";
import { bestSoFar, fmtRows, sameRegionPairs, type Experiment, type Hypothesis } from "@/lib/belief/engine";
import { usePrefersReducedMotion } from "@/components/motion/useInView";
import { useReplay } from "./Replay";
import { CARD_H, CARD_W, STATUS, computeLayout, shortLabel, topicColor } from "./layout";

const BAR_W = 78;
const EASE = "cubic-bezier(.2,.8,.2,1)";
const EASE_IO = "cubic-bezier(.65,0,.35,1)";

export function isTension(h: Hypothesis, exps: Record<string, Experiment>) {
  if (h.status !== "confirmed") return false;
  const supported = h.experiments.some((e) => exps[e]?.evidence === "supports");
  return h.belief < 0.5 || !supported;
}

export function BeliefGraph({
  mode,
  focus,
  onFocus,
}: {
  mode: "beliefs" | "before";
  focus: string | null;
  onFocus: (id: string | null) => void;
}) {
  const { state, final } = useReplay();
  const reduced = usePrefersReducedMotion();
  const layout = useMemo(() => computeLayout(final), [final]);
  const pairs = useMemo(() => sameRegionPairs(final.order.map((id) => final.hypotheses[id])), [final]);
  const W = layout.width;
  const H = layout.height + 8;
  const before = mode === "before";

  // Before-view scales: x = experiment index, y = log(read_rows).
  const N = final.expOrder.length;
  const chart = { x0: 70, x1: W - 20, y0: 30, y1: H - 40 };
  const lo = Math.log10(final.best * 0.8);
  const hi = Math.log10(final.baseline * 1.05);
  const sx = (i: number) => chart.x0 + (i / Math.max(1, N - 1)) * (chart.x1 - chart.x0);
  const sy = (v: number) => chart.y1 - ((Math.log10(v) - lo) / (hi - lo)) * (chart.y1 - chart.y0);

  const visibleExp = final.expOrder.filter((id) => state.experiments[id]);
  const bests = bestSoFar(state);
  const steps = visibleExp.map((_, i) => [sx(i), sy(bests[i])] as const);
  const stepPath = steps.length
    ? `M${chart.x0},${sy(final.baseline)} ` + steps.map(([x, y], i) => `${i ? `H${x}` : `H${x}`} V${y}`).join(" ")
    : "";

  const focusSet = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    for (const [a, b] of pairs) {
      if (a === focus) s.add(b);
      if (b === focus) s.add(a);
    }
    return s;
  }, [focus, pairs]);

  const dotPos = (e: Experiment, i: number) => {
    if (before) return { x: sx(i), y: sy(e.after ?? e.before) };
    const hid = e.hypothesisIds[0];
    const card = layout.cards[hid];
    const h = state.hypotheses[hid];
    const k = h ? h.experiments.indexOf(e.id) : 0;
    return { x: card.x + CARD_W - 12 - k * 13, y: card.y + CARD_H - 13 };
  };

  const fade = (on: boolean): CSSProperties => ({
    opacity: on ? 1 : 0,
    transition: `opacity 280ms ${EASE} ${before ? "0ms" : "450ms"}`,
    pointerEvents: on ? "auto" : "none",
  });

  return (
    <svg
      viewBox={`-2 -2 ${W + 4} ${H + 4}`}
      className="block w-full min-w-[760px]"
      role="img"
      aria-label={before ? "Keep/discard chart of read_rows per experiment" : "Belief graph of hypotheses grouped by topic"}
      onMouseLeave={() => onFocus(null)}
    >
      {/* ---- Before view: plain keep/discard chart ---- */}
      <g style={fade(before)}>
        {[final.baseline, 1e7, 3e6, 1e6].filter((v) => v >= final.best * 0.8).map((v) => (
          <g key={v}>
            <line x1={chart.x0} x2={chart.x1} y1={sy(v)} y2={sy(v)} stroke="rgba(230,234,236,.10)" strokeDasharray="2 4" />
            <text x={chart.x0 - 10} y={sy(v) + 4} textAnchor="end" className="font-mono" fontSize={11} fill="#8A949A">
              {fmtRows(v)}
            </text>
          </g>
        ))}
        <text x={chart.x0} y={14} className="font-mono" fontSize={11} letterSpacing="0.08em" fill="#8A949A">
          ROWS SCANNED (LOG SCALE) · BEST SO FAR
        </text>
        <text x={chart.x1} y={H - 14} textAnchor="end" className="font-mono" fontSize={11} letterSpacing="0.08em" fill="#8A949A">
          EXPERIMENTS →
        </text>
        <path d={stepPath} fill="none" stroke="#7FE0C2" strokeOpacity={0.6} strokeWidth={1.5} />
      </g>

      {/* ---- Belief view: topic hulls ---- */}
      <g style={fade(!before)}>
        {layout.hulls.map((hl) => {
          const members = final.order.filter((id) => final.hypotheses[id].topic === hl.topic);
          const shown = members.filter((id) => state.hypotheses[id]);
          const refuted = shown.filter((id) => state.hypotheses[id].status === "refuted").length;
          return (
            <g key={hl.topic} style={{ opacity: shown.length ? 1 : 0, transition: `opacity 600ms ${EASE}` }}>
              <rect x={hl.x} y={hl.y} width={hl.w} height={hl.h} rx={12} fill={hl.color} fillOpacity={0.05} stroke={hl.color} strokeOpacity={0.4} />
              <text x={hl.x + 12} y={hl.y + 17} className="font-mono" fontSize={11} letterSpacing="0.08em" fill={hl.text}>
                {hl.topic.toUpperCase()} · {shown.length}
                {refuted ? ` · ${refuted}✕` : ""}
              </text>
            </g>
          );
        })}

        {/* Implicit same-region links (e.g. H6 ↔ H9 both edit PROJECTION p_src) */}
        {pairs.map(([a, b]) => {
          if (!state.hypotheses[a] || !state.hypotheses[b]) return null;
          const A = layout.cards[a];
          const B = layout.cards[b];
          const lit = focus === a || focus === b;
          const ax = A.x + CARD_W / 2;
          const bx = B.x + CARD_W / 2;
          const ay = A.y + CARD_H / 2;
          const by = B.y + CARD_H / 2;
          const bend = (ax === bx ? 1 : 0) * 40 + 14;
          return (
            <g key={`${a}-${b}`} style={{ opacity: focus && !lit ? 0.1 : lit ? 1 : 0.45, transition: `opacity 280ms ${EASE}` }}>
              <path
                d={`M${ax},${ay} C${ax + bend},${(ay + by) / 2 - bend} ${bx + bend},${(ay + by) / 2 - bend} ${bx},${by}`}
                fill="none"
                stroke="#A9C7FF"
                strokeDasharray="2 3"
              />
              {lit && (
                <text x={(ax + bx) / 2 + bend} y={(ay + by) / 2 - bend} className="font-mono" fontSize={10} fill="#A9C7FF">
                  same region
                </text>
              )}
            </g>
          );
        })}

        {/* Hypothesis cards */}
        {final.order.map((id) => {
          const h = state.hypotheses[id];
          const pos = layout.cards[id];
          if (!h) return null;
          const { color } = topicColor(final.topics, h.topic);
          const dead = h.status === "refuted" || h.status === "abandoned";
          const dim = focusSet ? !focusSet.has(id) : false;
          const isNew = state.newest === id || h.experiments.includes(state.newest ?? "");
          const tension = isTension(h, state.experiments);
          const outline =
            h.status === "confirmed" ? STATUS.supports : dead ? STATUS.refutes : "rgba(230,234,236,.18)";
          const barColor = dead ? STATUS.refutes : h.status === "confirmed" ? STATUS.supports : "#E6EAEC";
          return (
            <g
              key={id}
              role="button"
              tabIndex={0}
              aria-label={`${id} ${h.status}: ${h.claim}`}
              onMouseEnter={() => onFocus(id)}
              onFocus={() => onFocus(id)}
              onClick={() => onFocus(id)}
              className="cursor-pointer outline-none"
              style={{
                opacity: dim ? 0.3 : dead ? 0.5 : 1,
                transform: dead ? "translateY(4px)" : "none",
                transition: `opacity 280ms ${EASE}, transform 600ms ${EASE}`,
              }}
            >
              <g className="anim-card-in">
                <rect x={pos.x} y={pos.y} width={CARD_W} height={CARD_H} rx={6} fill="#161A1E" stroke={focus === id ? "#3A4BFF" : outline} strokeWidth={focus === id ? 2 : 1} strokeDasharray={h.status === "abandoned" ? "4 3" : undefined} />
                <rect x={pos.x} y={pos.y + 9} width={2} height={CARD_H - 18} fill={color} />
                {isNew && !reduced && (
                  <rect key={`flash-${state.seq}`} x={pos.x - 3} y={pos.y - 3} width={CARD_W + 6} height={CARD_H + 6} rx={8} fill="none" className="anim-node-flash" />
                )}
                <text x={pos.x + 10} y={pos.y + 15} className="font-mono" fontSize={10} fill="#8A949A">
                  <tspan fill="#E6EAEC">{id}</tspan> · {h.status.toUpperCase()}
                </text>
                {tension && <polygon points={`${pos.x + CARD_W - 14},${pos.y + 6} ${pos.x + CARD_W - 6},${pos.y + 6} ${pos.x + CARD_W - 10},${pos.y + 13}`} fill={STATUS.amber} />}
                <text
                  x={pos.x + 10}
                  y={pos.y + 31}
                  className="font-mono"
                  fontSize={11}
                  fill={dead ? "#8A949A" : "#E6EAEC"}
                  textDecoration={dead ? "line-through" : undefined}
                >
                  {shortLabel(h)}
                </text>
                {/* Prediction (dashed tick, stated before) vs belief (fill, measured after) */}
                <rect x={pos.x + 10} y={pos.y + 40} width={BAR_W} height={4} rx={1} fill="rgba(230,234,236,.12)" />
                <rect
                  x={pos.x + 10}
                  y={pos.y + 40}
                  width={BAR_W}
                  height={4}
                  rx={1}
                  fill={barColor}
                  style={{ transform: `scaleX(${h.belief})`, transformBox: "fill-box", transformOrigin: "left", transition: `transform 600ms ${EASE}` }}
                />
                <line
                  x1={pos.x + 10 + BAR_W * h.prior}
                  x2={pos.x + 10 + BAR_W * h.prior}
                  y1={pos.y + 36}
                  y2={pos.y + 48}
                  stroke="#E6EAEC"
                  strokeDasharray="2 1.5"
                />
              </g>
            </g>
          );
        })}
      </g>

      {/* ---- Experiment dots: shared by both views, they fly between them ---- */}
      {final.expOrder.map((id, i) => {
        const e = state.experiments[id];
        if (!e) return null;
        const p = dotPos(e, i);
        const dim = !before && focusSet ? !e.hypothesisIds.some((h) => focusSet.has(h)) : false;
        const fill = e.failed || !e.correct ? STATUS.refutes : e.kept === true ? STATUS.supports : e.kept === false ? "transparent" : "#E6EAEC";
        const stroke = e.failed || !e.correct ? STATUS.refutes : e.kept === false ? "#7C8B98" : fill;
        const mismatch = e.kept !== null && !e.failed && e.kept !== e.beatsBest;
        const r = before ? 5 : 4;
        return (
          <g
            key={id}
            style={{
              transform: `translate(${p.x}px, ${p.y}px)`,
              transition: reduced ? "none" : `transform 600ms ${EASE_IO} ${i * 30}ms, opacity 280ms ${EASE}`,
              opacity: dim ? 0.25 : 1,
            }}
          >
            <title>
              {`${e.id} · ${e.failed ? `failed (${e.errorKind})` : `read_rows ${fmtRows(e.before)} → ${fmtRows(e.after ?? e.before)}`} · ${e.evidence}${e.kept === null ? "" : e.kept ? " · kept" : " · discarded"}`}
            </title>
            {state.newest === id && !reduced && <circle r={r} fill="none" stroke={STATUS.live} className="anim-ring" />}
            <circle r={r} fill={fill} stroke={stroke} strokeWidth={1.2} />
            {(e.failed || !e.correct) && (
              <path d={`M${-r / 2},${-r / 2} L${r / 2},${r / 2} M${r / 2},${-r / 2} L${-r / 2},${r / 2}`} stroke="#0E1114" strokeWidth={1.4} />
            )}
            {mismatch && <rect x={r - 1} y={-r - 2} width={4} height={4} fill={STATUS.amber} />}
          </g>
        );
      })}
    </svg>
  );
}
