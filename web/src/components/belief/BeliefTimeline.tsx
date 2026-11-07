"use client";

// Belief timeline + activity strip + scrubber — UI.md §7. Each hypothesis is a line that starts at its
// stated prior (hollow dot = the prediction) and steps with each experiment; refuted lines fall to 0 and stop.

import { STATUS } from "./layout";
import { useReplay } from "./Replay";

// Topic colors tuned for light surfaces (same hues as the graph).
const LIGHT = ["#3A4BFF", "#1595A9", "#7464E8", "#5A86D6", "#5C6B78"];

function mmss(t: number) {
  const m = Math.floor(t / 60);
  return `${String(m).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

export function BeliefTimeline({ focus, onFocus }: { focus: string | null; onFocus: (id: string | null) => void }) {
  const { state, final, events, index, setIndex, playing, setPlaying } = useReplay();
  const W = 1000;
  const H = 150;
  const x0 = 34;
  const x1 = W - 8;
  const y0 = 10;
  const y1 = H - 14;
  const T = final.t || 1;
  const sx = (t: number) => x0 + (t / T) * (x1 - x0);
  const sy = (v: number) => y1 - v * (y1 - y0);

  return (
    <div className="rounded-[6px] border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.08em] text-muted">
        <span>
          How its beliefs moved
          <span className="ml-3 hidden normal-case tracking-normal md:inline">
            Each line starts at the agent&apos;s prediction. Refuted ideas fall to zero.
          </span>
        </span>
        <span className="flex items-center gap-3 normal-case tracking-normal">
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="8" aria-hidden><circle cx="4" cy="4" r="3" fill="white" stroke="currentColor" /></svg> prediction
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="8" aria-hidden><circle cx="4" cy="4" r="3" fill={STATUS.refutes} /></svg> refuted
          </span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="block w-full min-w-[640px]" role="img" aria-label="Belief over time per hypothesis">
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={x0} x2={x1} y1={sy(v)} y2={sy(v)} stroke="var(--color-line)" strokeDasharray={v === 0 ? undefined : "2 4"} />
              <text x={x0 - 6} y={sy(v) + 4} textAnchor="end" className="font-mono" fontSize={10} fill="var(--color-muted)">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          {state.order.map((id) => {
            const h = state.hypotheses[id];
            const ti = Math.max(0, final.topics.indexOf(h.topic));
            const color = LIGHT[ti % LIGHT.length];
            const pts = h.history;
            if (!pts.length) return null;
            const dead = h.status === "refuted" || h.status === "abandoned";
            let d = `M${sx(pts[0].t)},${sy(pts[0].belief)}`;
            for (let i = 1; i < pts.length; i++) d += ` H${sx(pts[i].t)} V${sy(pts[i].belief)}`;
            if (!dead) d += ` H${sx(state.t)}`;
            const lit = !focus || focus === id;
            const last = pts[pts.length - 1];
            return (
              <g
                key={id}
                style={{ opacity: lit ? 1 : 0.15, transition: "opacity 280ms var(--ease-out)" }}
                onMouseEnter={() => onFocus(id)}
                onMouseLeave={() => onFocus(null)}
                className="cursor-pointer"
              >
                <path d={d} fill="none" stroke={dead ? STATUS.refutes : color} strokeWidth={focus === id ? 2.5 : 1.5} strokeOpacity={0.85} />
                <path d={d} fill="none" stroke="transparent" strokeWidth={10} />
                <circle cx={sx(pts[0].t)} cy={sy(pts[0].belief)} r={3} fill="white" stroke={color} strokeWidth={1.2} />
                {dead && <circle cx={sx(last.t)} cy={sy(0)} r={3} fill={STATUS.refutes} />}
                {focus === id && (
                  <text x={sx(pts[0].t) + 6} y={sy(pts[0].belief) - 6} className="font-mono" fontSize={11} fill="var(--color-ink)">
                    {id}
                  </text>
                )}
              </g>
            );
          })}
          {state.gateBlocks.map((g) => (
            <rect key={g.seq} x={sx(g.t) - 4} y={y1 - 4} width={8} height={8} transform={`rotate(45 ${sx(g.t)} ${y1})`} fill={STATUS.amber} />
          ))}
          {/* Activity strip */}
          {state.actions.map((a, i) => (
            <rect
              key={a.seq}
              x={sx(a.t)}
              y={H + 6}
              width={1.5}
              height={10}
              fill={i === state.actions.length - 1 ? "#7DB31A" : "var(--color-subtle)"}
            />
          ))}
          <line x1={sx(state.t)} x2={sx(state.t)} y1={y0} y2={H + 18} stroke="var(--color-signal)" strokeWidth={1} />
        </svg>
      </div>
      {/* Scrubber */}
      <div className="flex items-center gap-3 border-t border-line px-4 py-3 font-mono text-[12px]">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="h-7 w-7 shrink-0 rounded-[3px] border border-line text-ink transition-colors duration-150 hover:bg-mist"
          aria-label={playing ? "Pause replay" : "Play replay"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={events.length - 1}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
          className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--color-ink)]"
          aria-label="Scrub through the run"
        />
        <span className="shrink-0 tabular-nums text-muted">
          seq {state.seq} · {mmss(state.t)}
        </span>
        <span className="hidden shrink-0 uppercase tracking-[0.08em] sm:inline">
          {playing ? (
            <span className="text-ink">● replay</span>
          ) : (
            <button type="button" onClick={() => setPlaying(true)} className="text-signal hover:underline">
              paused · resume →
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
