"use client";

// "Before" view (PLAN §4.9, demo step 1): what a plain experiment log gives you. One dot per experiment, in order:
// kept / discarded / invalid. No hypotheses, no reasons.

import type { GraphState } from "@/lib/beliefEngine";
import { Label, fmtNum as fmtRows, progressScale } from "./ui";

export function BeforeView({ graph }: { graph: GraphState }) {
  const exps = graph.experiments;
  const W = 900;
  const H = 260;
  const pad = 48;
  const base = graph.metric.baseline ?? 1;
  const vals = exps.map((e) => e.metricAfter ?? base);
  const prog = progressScale(base, vals, graph.task.metric.direction);
  const x = (i: number) => pad + (exps.length <= 1 ? 0.5 : i / (exps.length - 1)) * (W - pad * 2);
  const y = (v: number) => 24 + (1 - 0.9 * prog(v)) * (H - 64); // up = better
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label>What a plain experiment log gives you</Label>
        <span className="font-mono text-[11px] text-muted">
          {exps.filter((e) => e.outcome === "kept").length} kept · {exps.filter((e) => e.outcome === "discarded").length} discarded ·{" "}
          {exps.filter((e) => e.outcome === "invalid").length} invalid
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Experiments as keep/discard dots">
        <line x1={pad} x2={W - pad} y1={y(base)} y2={y(base)} stroke="var(--color-line)" strokeDasharray="3 4" />
        <text x={pad - 6} y={y(base) + 4} textAnchor="end" fontSize={11} className="font-mono" fill="var(--color-muted)">
          {fmtRows(base)}
        </text>
        {exps.map((e, i) => (
          <circle
            key={e.id}
            cx={x(i)}
            cy={y(e.metricAfter ?? base)}
            r={7}
            fill={e.outcome === "kept" ? "var(--color-success)" : e.outcome === "invalid" ? "var(--color-danger)" : "var(--color-subtle)"}
          >
            <title>{e.id}</title>
          </circle>
        ))}
        <text x={pad} y={H - 6} fontSize={11} className="font-mono" fill="var(--color-muted)">
          experiment →
        </text>
      </svg>
      <p className="font-mono text-[12px] text-muted">Green worked. Gray didn&apos;t. Why? What did it learn from the gray ones?</p>
    </div>
  );
}
