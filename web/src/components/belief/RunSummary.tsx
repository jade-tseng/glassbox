"use client";

// Hero instrument + "where it mattered" panels, all derived from the replayed run.

import { CountUp, Marquee, Paused, PulseDot, Scanline } from "@/components/motion/primitives";
import { bestSoFar, fmtRows } from "@/lib/belief/engine";
import { STATUS, topicColor } from "./layout";
import { useReplay } from "./Replay";

/** Metric staircase: best read_rows so far, one step per kept experiment (log scale). */
export function Staircase({ height = 120 }: { height?: number }) {
  const { state, final } = useReplay();
  const W = 520;
  const H = height;
  const N = final.expOrder.length;
  const lo = Math.log10(final.best * 0.8);
  const hi = Math.log10(final.baseline * 1.05);
  const sx = (i: number) => 8 + (i / Math.max(1, N - 1)) * (W - 16);
  const sy = (v: number) => H - 8 - ((Math.log10(v) - lo) / (hi - lo)) * (H - 16);
  const bests = bestSoFar(state);
  const d = `M8,${sy(final.baseline)}` + bests.map((b, i) => ` H${sx(i)} V${sy(b)}`).join("");
  const dots = state.expOrder.map((id, i) => {
    const e = state.experiments[id];
    return { id, x: sx(i), y: sy(e.after ?? e.before), e };
  });
  const last = dots[dots.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-label="Best read_rows so far">
      <path d={d} fill="none" stroke={STATUS.supports} strokeWidth={1.5} />
      {dots.map(({ id, x, y, e }) => (
        <circle
          key={id}
          cx={x}
          cy={y}
          r={3}
          fill={e.failed ? STATUS.refutes : e.kept === false ? "transparent" : STATUS.supports}
          stroke={e.failed ? STATUS.refutes : e.kept === false ? "#7C8B98" : STATUS.supports}
         
        />
      ))}
      {last && <circle cx={last.x} cy={last.y} r={6} fill="none" stroke={STATUS.live} className="anim-ring" key={last.id} />}
    </svg>
  );
}

export function HeroInstrument() {
  const { state } = useReplay();
  const hyps = state.order.map((id) => state.hypotheses[id]);
  const refuted = hyps.filter((h) => h.status === "refuted").length;
  const label = "font-mono text-[12px] uppercase tracking-[0.08em] text-scope-muted";
  return (
    <div className="relative overflow-hidden rounded-[6px] border border-scope-line bg-scope text-scope-text">
      <div className="flex h-9 items-center justify-between border-b border-scope-line px-4 font-mono text-[12px] uppercase tracking-[0.08em] text-scope-muted">
        <span className="flex items-center gap-2">
          <PulseDot size={6} /> real run · replayed
        </span>
        <span className="hidden sm:inline">clickhouse · clickbench</span>
      </div>
      <Paused className="relative overflow-hidden px-4 pt-4">
        <Scanline distance={150} />
        <p className="text-[13px] leading-5 text-scope-text/85">
          Claude Code tuning a ClickHouse schema on 2M rows of web-analytics data. Goal: scan fewer rows, same results.
        </p>
        <p className={`mt-4 ${label}`}>Rows scanned</p>
        <p className="mt-1 text-[36px] tracking-[-0.04em] md:text-[40px]">
          <CountUp value={state.best} />
        </p>
        <p className="font-mono text-[12px] text-scope-muted">lower is better · from {state.baseline.toLocaleString("en-US")}</p>
        <div className="mt-3 pb-3">
          <Staircase height={130} />
        </div>
      </Paused>
      <dl className="grid grid-cols-3 border-t border-scope-line">
        {[
          { k: "Hypotheses", v: hyps.length },
          { k: "Experiments", v: state.expOrder.length },
          { k: "Refuted", v: refuted },
        ].map((m, i) => (
          <div key={m.k} className={`px-4 py-3 ${i ? "border-l border-scope-line" : ""}`}>
            <dt className={label}>{m.k}</dt>
            <dd className="mt-1 text-[24px] tracking-[-0.03em]">
              <CountUp value={m.v} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Impact by code region: rows saved by kept, correct experiments, per region the hypothesis named. */
export function RegionImpact() {
  const { state, final } = useReplay();
  const rows = new Map<string, { region: string; topic: string; saved: number; touches: number; refuted: number }>();
  for (const id of state.order) {
    const h = state.hypotheses[id];
    const sym = h.symbol.replace(/^SETTINGS\s+/, "");
    const region = h.file === "schema.sql" ? sym : `${h.file.replace(/^queries\//, "").replace(/\.sql$/, "")} · ${sym}`;
    const r = rows.get(region) ?? { region, topic: h.topic, saved: 0, touches: 0, refuted: 0 };
    r.touches += 1;
    if (h.status === "refuted") r.refuted += 1;
    for (const eid of h.experiments) {
      const e = state.experiments[eid];
      if (e.after !== null && e.correct && e.kept && e.after < e.before) r.saved += e.before - e.after;
    }
    rows.set(region, r);
  }
  const list = [...rows.values()].sort((a, b) => b.saved - a.saved).slice(0, 8);
  const max = Math.max(1, ...list.map((r) => r.saved));
  return (
    <ul className="divide-y divide-line">
      {list.map((r) => {
        const { color } = topicColor(final.topics, r.topic);
        return (
          <li key={r.region} className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-4 py-2.5 sm:grid-cols-[220px_minmax(0,1fr)_88px]">
            <span className="flex min-w-0 items-center gap-2 font-mono text-[12px]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
              <span className="truncate">{r.region}</span>
            </span>
            <span className="hidden h-2 overflow-hidden rounded-[2px] bg-mist sm:block">
              <span
                className="block h-full transition-transform duration-[600ms] ease-[cubic-bezier(.2,.8,.2,1)]"
                style={{
                  background: r.saved ? color : "transparent",
                  transform: `scaleX(${r.saved / max})`,
                  transformOrigin: "left",
                  backgroundImage: r.saved ? undefined : "repeating-linear-gradient(45deg, #FF6B5A55 0 2px, transparent 2px 5px)",
                }}
              />
            </span>
            <span className="text-right font-mono text-[12px] tabular-nums">
              {r.saved ? `−${fmtRows(r.saved)}` : r.refuted ? <span className="text-danger">refuted</span> : <span className="text-muted">0</span>}
              <span className="ml-1 text-muted">×{r.touches}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Prediction calibration: how often the agent's confident calls held up. */
export function Calibration() {
  const { state } = useReplay();
  const tested = state.order.map((id) => state.hypotheses[id]).filter((h) => h.experiments.some((e) => state.experiments[e].evidence !== "invalid"));
  const held = tested.filter((h) => h.belief >= 0.5).length;
  const confident = tested.filter((h) => h.firstPrior >= 0.7);
  const confHeld = confident.filter((h) => h.belief >= 0.5).length;
  const label = "font-mono text-[12px] uppercase tracking-[0.08em] text-muted";
  return (
    <dl className="grid grid-cols-2">
      <div className="pr-4">
        <dt className={label}>Predictions held</dt>
        <dd className="mt-1 text-[32px] tracking-[-0.04em]">
          <CountUp value={held} />
          <span className="text-[18px] text-muted">/{tested.length}</span>
        </dd>
      </div>
      <div className="border-l border-line pl-4">
        <dt className={label}>Confident ≥0.7</dt>
        <dd className="mt-1 text-[32px] tracking-[-0.04em]">
          <CountUp value={confHeld} />
          <span className="text-[18px] text-muted">/{confident.length}</span>
        </dd>
      </div>
    </dl>
  );
}

/** Slow drift of every hypothesis the run considered, topic-colored, struck through when refuted. */
export function HypothesisMarquee() {
  const { final } = useReplay();
  return (
    <Marquee>
      {final.order.map((id) => {
        const h = final.hypotheses[id];
        const { color } = topicColor(final.topics, h.topic);
        const dead = h.status === "refuted";
        return (
          <span key={id} className="mr-10 flex items-center gap-2 font-mono text-[12px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
            <span className="text-ink">{id}</span>
            <span className={dead ? "line-through" : ""}>{h.symbol}</span>
          </span>
        );
      })}
    </Marquee>
  );
}

/** Rows saved per code region (kept, correct, improving experiments only). */
function savedByRegion(state: ReturnType<typeof useReplay>["state"]) {
  const out = new Map<string, number>();
  for (const id of state.order) {
    const h = state.hypotheses[id];
    const region = h.symbol.replace(/^SETTINGS\s+/, "") || h.file;
    for (const eid of h.experiments) {
      const e = state.experiments[eid];
      if (e.after !== null && e.correct && e.kept && e.after < e.before) out.set(region, (out.get(region) ?? 0) + e.before - e.after);
    }
  }
  return out;
}

/** One computed insight sentence above the impact chart (UI.md §9.7). */
export function ImpactLead() {
  const { state } = useReplay();
  const saved = savedByRegion(state);
  const total = state.baseline - state.best;
  const top = [...saved.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || total <= 0) return <>Waiting for the first kept experiment.</>;
  const share = top[1] / total;
  return (
    <>
      {share >= 0.5 ? "One change" : "The biggest single change"}, the <span className="font-mono">{top[0]}</span>, accounts for{" "}
      <span className="font-mono">{fmtRows(top[1])}</span> of the <span className="font-mono">{fmtRows(total)}</span> rows saved.
    </>
  );
}

export function CalibrationLead() {
  const { state } = useReplay();
  const tested = state.order.map((id) => state.hypotheses[id]).filter((h) => h.experiments.some((e) => state.experiments[e].evidence !== "invalid"));
  const held = tested.filter((h) => h.belief >= 0.5).length;
  const confident = tested.filter((h) => h.firstPrior >= 0.7);
  const confHeld = confident.filter((h) => h.belief >= 0.5).length;
  if (!tested.length) return <>No predictions tested yet.</>;
  return (
    <>
      {confident.length > 0 && (
        <>
          When it was confident (≥ 0.7), it was right <span className="font-mono">{confHeld}</span> of{" "}
          <span className="font-mono">{confident.length}</span> times.{" "}
        </>
      )}
      Across all tested predictions: <span className="font-mono">{held}</span> of <span className="font-mono">{tested.length}</span>.
    </>
  );
}

/** Verdict on the main hypothesis, computed from the metric (never stated by the agent). */
export function RunVerdict() {
  const { state, final, index, events } = useReplay();
  const done = index >= events.length - 1;
  const exps = state.expOrder.length;
  const anyKept = state.best < state.baseline;
  const pct = Math.round((1 - state.best / state.baseline) * 100);
  const nHyp = state.order.length;
  if (!done) {
    return (
      <span>
        <span className="font-mono uppercase tracking-[0.08em] text-muted">Testing · </span>
        best so far <span className="font-mono">{fmtRows(state.best)}</span> rows scanned after{" "}
        <span className="font-mono">{exps}</span> of <span className="font-mono">{final.expOrder.length}</span> experiments.
      </span>
    );
  }
  return (
    <span>
      <span className="font-mono uppercase tracking-[0.08em] text-success">{anyKept ? "Supported. " : "Not supported. "}</span>
      <span className="font-mono">{(state.baseline / 1e6).toFixed(1)}M</span> →{" "}
      <span className="font-mono">{(state.best / 1e6).toFixed(2)}M</span> rows scanned
      (−{pct}%), all results identical, across <span className="font-mono">{exps}</span> experiments and{" "}
      <span className="font-mono">{nHyp}</span> hypotheses.
    </span>
  );
}
