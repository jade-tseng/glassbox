"use client";

// Code heatmap tab (PLAN §4.7). Tile tint = read_rows saved by kept edits to that file. Query tiles also show
// the query's own read_rows baseline -> current (often moved by schema changes, not query edits).
// Click a file to see its regions (as the agent named them in code_region) and the hypotheses behind them.

import { useMemo, useState } from "react";
import type { GraphState } from "@/lib/beliefEngine";
import { buildHeatmap, type FileHeat } from "@/lib/heatmap";
import { Chip, Label, STATUS_STYLE, fmtRows } from "./ui";

export function HeatmapView({ graph, onSelectHypothesis }: { graph: GraphState; onSelectHypothesis: (id: string) => void }) {
  const hm = useMemo(() => buildHeatmap(graph), [graph]);
  const [active, setActive] = useState<string>("schema.sql");
  const file = hm.files.find((f) => f.file === active) ?? hm.files[0];

  if (!hm.files.length || graph.metric.baseline === null) {
    return <p className="font-mono text-[13px] text-muted">No experiments yet.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label>Where it mattered</Label>
        <span className="font-mono text-[11px] text-muted">
          tint = read_rows saved by kept edits · {fmtRows(hm.totalSaved)} saved in total
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-line bg-line sm:grid-cols-3 xl:grid-cols-4">
        {hm.files.map((f) => (
          <FileTile key={f.file} f={f} max={hm.maxImpact} active={f.file === file?.file} onClick={() => setActive(f.file)} />
        ))}
        {/* White fillers so the hairline grid never shows a gray hole in the last row (sized for 4 columns). */}
        {Array.from({ length: (4 - (hm.files.length % 4)) % 4 }, (_, i) => (
          <div key={`fill-${i}`} className="hidden bg-white xl:block" aria-hidden />
        ))}
      </div>

      {file && (
        <div className="rounded-[6px] border border-line">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
            <span className="font-mono text-[13px] text-ink">{file.file}</span>
            <span className="font-mono text-[11px] text-muted">
              {file.touches} experiment{file.touches === 1 ? "" : "s"} changed it · {file.kept} kept · {fmtRows(Math.round(file.impact))} rows saved
            </span>
          </div>

          {file.query && (
            <div className="border-b border-line px-4 py-3">
              <Label className="mb-2 text-[11px]">This query&apos;s read_rows</Label>
              <QueryBar baseline={file.query.baseline} current={file.query.current} />
              {file.query.movedBy.length > 0 && (
                <p className="mt-2 font-mono text-[11px] text-muted">
                  moved by{" "}
                  {file.query.movedBy
                    .filter((m) => Math.abs(m.saved) > 0)
                    .map((m) => `${m.experiment} (${m.saved >= 0 ? "−" : "+"}${fmtRows(Math.abs(m.saved))})`)
                    .join(" · ")}
                </p>
              )}
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
                  <th className="px-2 py-2 text-right font-normal">Rows saved</th>
                  <th className="px-4 py-2 font-normal">Hypotheses</th>
                </tr>
              </thead>
              <tbody>
                {file.regions.map((r) => (
                  <tr key={r.key} className="border-b border-line last:border-b-0 hover:bg-mist">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 shrink-0 rounded-[2px] border border-line"
                          style={{ background: heat(r.impact / hm.maxImpact, r.touches > 0) }}
                          aria-hidden
                        />
                        <span className="font-mono text-[13px] text-ink">{r.symbol}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[13px] tabular-nums">{r.touches}</td>
                    <td className="px-2 py-2 text-right font-mono text-[13px] tabular-nums">{r.kept}</td>
                    <td className="px-2 py-2 text-right font-mono text-[13px] tabular-nums">{r.impact ? fmtRows(Math.round(r.impact)) : "—"}</td>
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
    </div>
  );
}

function heat(ratio: number, touched: boolean): string {
  if (!touched) return "var(--color-white)";
  if (ratio <= 0) return "var(--color-mist)";
  // Cobalt at 8%..70% opacity; sqrt so mid-sized wins stay visible next to the ordering key.
  return `rgba(58, 75, 255, ${(0.08 + 0.62 * Math.sqrt(Math.min(1, ratio))).toFixed(3)})`;
}

function FileTile({ f, max, active, onClick }: { f: FileHeat; max: number; active: boolean; onClick: () => void }) {
  const ratio = f.impact / max;
  const strong = Math.sqrt(ratio) > 0.55;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-[92px] p-3 text-left transition-[filter] duration-150 hover:brightness-95 ${active ? "outline outline-2 -outline-offset-2 outline-ink" : ""}`}
      style={{ background: heat(ratio, f.touches > 0) }}
    >
      <div className={`truncate font-mono text-[12px] ${strong ? "text-white" : "text-ink"}`}>{f.file.replace("queries/", "")}</div>
      <div className={`mt-1 font-mono text-[11px] ${strong ? "text-white/80" : "text-muted"}`}>
        {f.touches ? `${f.touches} touch · ${f.kept} kept` : "untouched"}
        {f.impact > 0 ? ` · −${fmtRows(Math.round(f.impact))}` : ""}
      </div>
      {f.query && (
        <div className="mt-2">
          <div className="h-1 overflow-hidden rounded-[2px] bg-white/70">
            <div
              className="h-full origin-left bg-ink/70 transition-transform duration-[600ms]"
              style={{ transform: `scaleX(${f.query.baseline ? f.query.current / f.query.baseline : 1})`, transitionTimingFunction: "var(--ease-out)" }}
            />
          </div>
          <div className={`mt-1 font-mono text-[10px] ${strong ? "text-white/80" : "text-muted"}`}>
            {fmtRows(f.query.baseline)} → {fmtRows(f.query.current)} rows
          </div>
        </div>
      )}
    </button>
  );
}

function QueryBar({ baseline, current }: { baseline: number; current: number }) {
  const r = baseline ? current / baseline : 1;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
        <span className="w-16">baseline</span>
        <div className="h-2 flex-1 rounded-[2px] bg-mist" />
        <span className="w-14 text-right tabular-nums">{fmtRows(baseline)}</span>
      </div>
      <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
        <span className="w-16">now</span>
        <div className="h-2 flex-1 overflow-hidden rounded-[2px] bg-frost">
          <div className="h-full origin-left rounded-[2px] bg-cobalt transition-transform duration-[600ms]" style={{ transform: `scaleX(${Math.max(0.004, r)})` }} />
        </div>
        <span className="w-14 text-right tabular-nums text-ink">{fmtRows(current)}</span>
      </div>
    </div>
  );
}
