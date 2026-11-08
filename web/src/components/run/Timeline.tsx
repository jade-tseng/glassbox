"use client";

// Scrubber + belief timeline + agent activity strip (PLAN §4.9 bottom; UI.md scope band).
// x = event seq. Lines = each hypothesis's confidence over time; the cyan step line = best metric so far (up = better).

import { useEffect, useRef, useState } from "react";
import type { GraphState } from "@/lib/beliefEngine";
import { Label, PulseDot, STATUS_STYLE, fmtNum as fmtRows, fmtTime, progressScale } from "./ui";

const PAD_L = 44;
const PAD_R = 64;
const CH = 150; // chart height
const TOP = 10;

export function Timeline({
  full,
  cursor,
  live,
  running,
  selected,
  onScrub,
}: {
  full: GraphState; // graph over all events (for histories and domain)
  cursor: number; // current seq
  live: boolean; // following the head
  running: boolean;
  selected: string | null;
  onScrub: (seq: number | null) => void; // null = follow live head
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width)));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(2, full.maxSeq);
  const x = (seq: number) => PAD_L + ((seq - 1) / (max - 1)) * (w - PAD_L - PAD_R);
  const y = (c: number) => TOP + (1 - c) * CH;
  const base = full.metric.baseline ?? 1;
  const prog = progressScale(base, full.metric.series.map((s) => s.best ?? base), full.task.metric.direction);
  const yM = (v: number) => TOP + (1 - 0.92 * prog(v)) * CH; // up = better, whichever direction the metric improves
  const cx = x(Math.min(cursor, max));
  const exps = full.experiments;
  const expSeqs = exps.map((e) => e.seq);
  const tAtCursor = [...full.actions, ...full.metric.series, ...full.messages].filter((a) => a.seq <= cursor).reduce((m, a) => Math.max(m, a.t), 0);

  const step = (dir: 1 | -1) => {
    const target = dir > 0 ? expSeqs.find((s) => s > cursor) : [...expSeqs].reverse().find((s) => s < cursor);
    if (target) onScrub(target);
    else if (dir > 0) onScrub(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label className="text-scope-muted">03 / Timeline</Label>
        <div className="flex items-center gap-2 font-mono text-[12px]">
          <button type="button" onClick={() => step(-1)} className="rounded-[3px] border border-scope-line px-2 py-1 text-scope-text hover:bg-scope-raised" aria-label="Previous experiment">
            ◀ exp
          </button>
          <button type="button" onClick={() => step(1)} className="rounded-[3px] border border-scope-line px-2 py-1 text-scope-text hover:bg-scope-raised" aria-label="Next experiment">
            exp ▶
          </button>
          <button
            type="button"
            onClick={() => onScrub(null)}
            className={`flex items-center gap-2 rounded-[3px] border px-2 py-1 ${live ? "border-live text-live" : "border-scope-line text-scope-muted hover:bg-scope-raised"}`}
          >
            <PulseDot live={live && running} size={6} />
            {running ? "LIVE" : "HEAD"}
          </button>
          <span className="tabular-nums text-scope-muted">
            seq {cursor}/{full.maxSeq} · {fmtTime(tAtCursor)}
          </span>
        </div>
      </div>

      <div ref={box} className="relative">
        <svg width={w} height={CH + TOP + 58} className="block" aria-label="Belief timeline">
          {/* grid */}
          {[0, 0.5, 1].map((c) => (
            <g key={c}>
              <line x1={PAD_L} x2={w - PAD_R} y1={y(c)} y2={y(c)} stroke="var(--color-scope-line)" strokeDasharray="3 4" />
              <text x={PAD_L - 8} y={y(c) + 4} textAnchor="end" fontSize={10} className="font-mono" fill="var(--color-scope-muted)">
                {Math.round(c * 100)}%
              </text>
            </g>
          ))}
          {/* metric: best so far, progress scale (up = better), right axis */}
          {full.metric.series.length > 0 && (
            <>
              <path
                d={(() => {
                  let d = `M ${PAD_L} ${yM(base)}`;
                  for (const s of full.metric.series) {
                    if (s.seq > cursor) break;
                    d += ` H ${x(s.seq)} V ${yM(s.best ?? base)}`;
                  }
                  return `${d} H ${cx}`;
                })()}
                fill="none"
                stroke="var(--color-cyan)"
                strokeWidth={1.5}
              />
              <text x={w - PAD_R + 6} y={yM(base) + 4} fontSize={10} className="font-mono" fill="var(--color-cyan)">
                {fmtRows(base)}
              </text>
              {(() => {
                const cur = [...full.metric.series].reverse().find((s) => s.seq <= cursor)?.best;
                return cur ? (
                  <text x={w - PAD_R + 6} y={yM(cur) + 4} fontSize={10} className="font-mono" fill="var(--color-cyan)">
                    {fmtRows(cur)}
                  </text>
                ) : null;
              })()}
            </>
          )}
          {/* hypothesis confidence lines */}
          {Object.values(full.hypotheses).map((h) => {
            if (h.proposedSeq > cursor) return null;
            const pts = h.history.filter((p) => p.seq <= cursor);
            let d = `M ${x(pts[0].seq)} ${y(pts[0].confidence)}`;
            for (const p of pts.slice(1)) d += ` H ${x(p.seq)} V ${y(p.confidence)}`;
            d += ` H ${cx}`;
            const last = pts[pts.length - 1];
            const isSel = selected === h.id;
            return (
              <g key={h.id} opacity={selected && !isSel ? 0.25 : 0.9}>
                <path d={d} fill="none" stroke={STATUS_STYLE[h.status].line} strokeWidth={isSel ? 2.5 : 1.5} />
                <text x={cx + 4} y={y(last.confidence) + 3} fontSize={9} className="font-mono" fill={STATUS_STYLE[h.status].line}>
                  {h.id}
                </text>
              </g>
            );
          })}
          {/* experiment markers */}
          {exps.map((e) => (
            <circle
              key={e.id}
              cx={x(e.seq)}
              cy={TOP + CH + 14}
              r={e.seq <= cursor ? 4 : 2.5}
              fill={e.outcome === "kept" ? "var(--color-mint)" : e.outcome === "invalid" ? "var(--color-danger-fill)" : "var(--color-scope-muted)"}
              opacity={e.seq <= cursor ? 1 : 0.35}
            >
              <title>
                {e.id}: {e.outcome} {e.correct ? `${fmtRows(e.metricBefore)} → ${fmtRows(e.metricAfter)}` : e.errorKind}
              </title>
            </circle>
          ))}
          <text x={PAD_L - 8} y={TOP + CH + 18} textAnchor="end" fontSize={10} className="font-mono" fill="var(--color-mint)">
            ● EXP
          </text>
          {/* activity strip */}
          {full.actions.map((a) => (
            <rect key={a.seq} x={x(a.seq)} y={TOP + CH + 30} width={1} height={10} fill="var(--color-cyan)" opacity={a.seq <= cursor ? 0.7 : 0.2} />
          ))}
          {full.observations.map((o) => (
            <rect key={`o${o.seq}`} x={x(o.seq) - 1} y={TOP + CH + 29} width={2.5} height={12} fill="var(--color-mint)" opacity={o.seq <= cursor ? 1 : 0.3}>
              <title>observed: {o.command}</title>
            </rect>
          ))}
          {full.messages.map((m) => (
            <rect key={m.seq} x={x(m.seq)} y={TOP + CH + 30} width={1.5} height={10} fill="var(--color-violet)" opacity={m.seq <= cursor ? 0.9 : 0.25} />
          ))}
          {full.gateBlocks.map((g) => (
            <rect key={g.seq} x={x(g.seq) - 2} y={TOP + CH + 28} width={4} height={14} rx={1} fill="var(--color-warn-fill)">
              <title>Gate blocked: {g.kind}</title>
            </rect>
          ))}
          <text x={PAD_L - 8} y={TOP + CH + 39} textAnchor="end" fontSize={10} className="font-mono" fill="var(--color-mint)">
            ● ACT
          </text>
          <text x={PAD_L} y={TOP - 2} fontSize={10} className="font-mono" fill="var(--color-ice)">
            ◆ Glassbox confidence per hypothesis (inferred from observed results)
          </text>
          {/* cursor */}
          <line x1={cx} x2={cx} y1={TOP - 4} y2={TOP + CH + 44} stroke={live && running ? "var(--color-live)" : "var(--color-scope-text)"} strokeWidth={1} />
        </svg>
        <input
          type="range"
          min={1}
          max={max}
          value={Math.min(cursor, max)}
          onChange={(e) => {
            const v = Number(e.target.value);
            onScrub(v >= full.maxSeq ? null : v);
          }}
          className="absolute top-0 h-full cursor-ew-resize opacity-0"
          style={{ left: PAD_L - 8, width: w - PAD_L - PAD_R + 16 }}
          aria-label="Scrub through the run"
        />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-scope-muted">
        <span className="uppercase tracking-[0.08em]">◆ confidence:</span>
        <Legend color="var(--color-ice)" label="open" />
        <Legend color="var(--color-mint)" label="confirmed / kept" />
        <Legend color="var(--color-danger-fill)" label="refuted / invalid" />
<Legend color="var(--color-cyan)" label={`best ${full.task.metric.label} (up = better)`} />
        <Legend color="var(--color-violet)" label="◇ agent message" />
        <Legend color="var(--color-mint)" label="● observation (evidence looked at)" />
        <Legend color="var(--color-warn-fill)" label="gate blocked" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
