"use client";

// Code heatmap tab (PLAN §4.7). Target-agnostic: tile tint = metric improvement from kept edits to that file.
// If the target declares a per-component breakdown, components are shown on their file (when the target maps
// them to one) or in their own list. Click a file to see its regions (as the agent named them in code_region).

import { useMemo, useState } from "react";
import type { GraphState } from "@/lib/beliefEngine";
import { buildHeatmap, type ComponentHeat, type FileHeat } from "@/lib/heatmap";
import { Chip, Label, STATUS_STYLE, fmtNum } from "./ui";

export function HeatmapView({ graph, onSelectHypothesis }: { graph: GraphState; onSelectHypothesis: (id: string) => void }) {
  const hm = useMemo(() => buildHeatmap(graph), [graph]);
  const [active, setActive] = useState<string | null>(null);
  const file = hm.files.find((f) => f.file === active) ?? hm.files[0];
  const m = graph.task.metric;
  const lower = m.direction !== "higher";
  const compLabel = graph.task.breakdown?.label ?? "component";

  if (!hm.files.length || graph.metric.baseline === null) {
    return <p className="font-mono text-[13px] text-muted">No experiments yet.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label>Where it mattered</Label>
        <span className="font-mono text-[11px] text-muted">
          tint = {m.label} improvement from kept edits · {fmtNum(hm.totalImprovement)} {m.unit} {lower ? "less" : "more"} in total
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-line bg-line sm:grid-cols-3 xl:grid-cols-4">
        {hm.files.map((f) => (
          <FileTile key={f.file} f={f} max={hm.maxImpact} active={f.file === file?.file} lower={lower} onClick={() => setActive(f.file)} />
        ))}
        {Array.from({ length: (4 - (hm.files.length % 4)) % 4 }, (_, i) => (
          <div key={`fill-${i}`} className="hidden bg-white xl:block" aria-hidden />
        ))}
      </div>

      {file && (
        <div className="rounded-[6px] border border-line">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
            <span className="font-mono text-[13px] text-ink">{file.file}</span>
            <span className="font-mono text-[11px] text-muted">
              {file.touches} experiment{file.touches === 1 ? "" : "s"} changed it · {file.kept} kept · improvement {fmtNum(file.impact)}
            </span>
          </div>

          {file.component && (
            <div className="border-b border-line px-4 py-3">
              <Label className="mb-2 text-[11px]">
                This {compLabel}&apos;s {m.label}
              </Label>
              <ComponentBar c={file.component} lower={lower} />
            </div>
          )}

          {file.regions.length === 0 ? (
            <p className="px-4 py-3 font-mono text-[12px] text-muted">No hypothesis targeted this file directly.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                  <th className="px-4 py-2 font-normal">Region</th>
                  <th className="px-2 py-2 text-right font-normal">Touches</th>
                  <th className="px-2 py-2 text-right font-normal">Kept</th>
                  <th className="px-2 py-2 text-right font-normal">Improvement</th>
                  <th className="px-4 py-2 font-normal">Hypotheses</th>
                </tr>
              </thead>
              <tbody>
                {file.regions.map((r) => (
                  <tr key={r.key} className="border-b border-line last:border-b-0 hover:bg-mist">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 shrink-0 rounded-[2px] border border-line" style={{ background: heat(r.impact / hm.maxImpact, r.touches > 0) }} aria-hidden />
                        <span className="font-mono text-[13px] text-ink">{r.symbol}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[13px] tabular-nums">{r.touches}</td>
                    <td className="px-2 py-2 text-right font-mono text-[13px] tabular-nums">{r.kept}</td>
                    <td className="px-2 py-2 text-right font-mono text-[13px] tabular-nums">{r.impact ? fmtNum(r.impact) : "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.hypotheses.map((id) => {
                          const h = graph.hypotheses[id];
                          return (
                            <button key={id} type="button" onClick={() => onSelectHypothesis(id)} title={h?.claim}>
                              <Chip className={h ? STATUS_STYLE[h.status].chip : "border-line"}>{id}</Chip>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {hm.unmappedComponents.length > 0 && (
        <div className="rounded-[6px] border border-line p-4">
          <Label className="mb-3">
            {m.label} by {compLabel}
          </Label>
          <div className="space-y-3">
            {hm.unmappedComponents.map((c) => (
              <div key={c.name}>
                <div className="mb-1 font-mono text-[12px] text-ink">{c.name}</div>
                <ComponentBar c={c} lower={lower} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function heat(ratio: number, touched: boolean): string {
  if (!touched) return "var(--color-white)";
  if (ratio <= 0) return "var(--color-mist)";
  return `rgba(58, 75, 255, ${(0.08 + 0.62 * Math.sqrt(Math.min(1, ratio))).toFixed(3)})`;
}

const basename = (f: string) => f.split("/").pop() ?? f;

function FileTile({ f, max, active, lower, onClick }: { f: FileHeat; max: number; active: boolean; lower: boolean; onClick: () => void }) {
  const ratio = f.impact / max;
  const strong = Math.sqrt(ratio) > 0.55;
  const c = f.component;
  const scale = c ? Math.min(c.baseline, c.current) / Math.max(c.baseline, c.current, 1e-12) : 1;
  return (
    <button
      type="button"
      onClick={onClick}
      title={f.file}
      className={`relative min-h-[92px] p-3 text-left transition-[filter] duration-150 hover:brightness-95 ${active ? "outline outline-2 -outline-offset-2 outline-ink" : ""}`}
      style={{ background: heat(ratio, f.touches > 0) }}
    >
      <div className={`truncate font-mono text-[12px] ${strong ? "text-white" : "text-ink"}`}>{basename(f.file)}</div>
      <div className={`mt-1 font-mono text-[11px] ${strong ? "text-white/80" : "text-muted"}`}>
        {f.touches ? `${f.touches} touch · ${f.kept} kept` : "untouched"}
        {f.impact > 0 ? ` · ${lower ? "−" : "+"}${fmtNum(f.impact)}` : ""}
      </div>
      {c && (
        <div className="mt-2">
          <div className="h-1 overflow-hidden rounded-[2px] bg-white/70">
            <div className="h-full origin-left bg-ink/70 transition-transform duration-[600ms]" style={{ transform: `scaleX(${lower ? scale : 1})` }} />
          </div>
          <div className={`mt-1 font-mono text-[10px] ${strong ? "text-white/80" : "text-muted"}`}>
            {fmtNum(c.baseline)} → {fmtNum(c.current)}
          </div>
        </div>
      )}
    </button>
  );
}

function ComponentBar({ c, lower }: { c: ComponentHeat; lower: boolean }) {
  const max = Math.max(Math.abs(c.baseline), Math.abs(c.current), 1e-12);
  const moved = c.movedBy.filter((x) => x.improvement !== 0);
  return (
    <div className="space-y-1">
      {[
        ["baseline", c.baseline, "bg-mist"],
        ["now", c.current, "bg-cobalt"],
      ].map(([label, v, color]) => (
        <div key={label as string} className="flex items-center gap-3 font-mono text-[11px] text-muted">
          <span className="w-16">{label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-[2px] bg-frost">
            <div className={`h-full origin-left rounded-[2px] ${color} transition-transform duration-[600ms]`} style={{ transform: `scaleX(${Math.max(0.004, Math.abs(v as number) / max)})` }} />
          </div>
          <span className="w-16 text-right tabular-nums text-ink">{fmtNum(v as number)}</span>
        </div>
      ))}
      {moved.length > 0 && (
        <p className="pt-1 font-mono text-[11px] text-muted">
          moved by{" "}
          {moved.map((x) => `${x.experiment} (${x.improvement > 0 ? (lower ? "−" : "+") : lower ? "+" : "−"}${fmtNum(Math.abs(x.improvement))})`).join(" · ")}
        </p>
      )}
    </div>
  );
}
