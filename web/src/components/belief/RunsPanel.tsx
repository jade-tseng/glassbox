"use client";

// Compact list of real runs (from /api/runs, the same summaries the /run tracker uses), each linking to its run view.

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RunSummary } from "@/lib/runSummary";

// improvement > 0 means better: fewer for "lower" metrics, more for "higher" ones.
const pct = (x: number | null, dir: "lower" | "higher") =>
  x === null ? "—" : `${(dir === "lower") === x >= 0 ? "−" : "+"}${Math.abs(x * 100).toFixed(1)}%`;

/** `pinned`: the run replayed at the top of the page; always listed first, then the newest others. */
export function RunsPanel({ limit = 6, pinned = "bg3" }: { limit?: number; pinned?: string }) {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/runs", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => alive && setRuns((j.runs ?? []) as RunSummary[]))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  const head = "font-mono text-[11px] uppercase tracking-[0.08em] text-muted";
  return (
    <div className="overflow-hidden rounded-[6px] border border-line bg-white">
      <div className={`hidden grid-cols-[minmax(0,1fr)_130px_150px_110px_90px] gap-4 border-b border-line px-4 py-2.5 md:grid ${head}`}>
        <span>Task</span>
        <span>Agent</span>
        <span className="text-right">Metric</span>
        <span className="text-right">Hypotheses</span>
        <span className="text-right">Signals</span>
      </div>
      {runs === null && !error && (
        <div className="space-y-2 p-4" aria-label="Loading runs">
          {[0, 1, 2].map((i) => (
            <div key={i} className="anim-shimmer h-7 rounded-[3px]" />
          ))}
        </div>
      )}
      {error && <p className="p-4 font-mono text-[12px] text-muted">Runs are unavailable right now.</p>}
      {runs &&
        [...runs.filter((r) => r.runId === pinned), ...runs.filter((r) => r.runId !== pinned)].slice(0, limit).map((r) => {
        const alerts = r.signals.filter((s) => s.level !== "info").length;
        const live = r.status === "running";
        return (
          <Link
            key={r.runId}
            href={`/run/${r.runId}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-mist md:grid-cols-[minmax(0,1fr)_130px_150px_110px_90px]"
          >
            <span className="flex min-w-0 items-center gap-2">
              {live && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-live" aria-label="live" />}
              <span className="truncate text-[14px]">{r.task || r.runId}</span>
              <span className="hidden shrink-0 font-mono text-[11px] text-muted sm:inline">{r.runId}</span>
              {r.runId === pinned && (
                <span className="shrink-0 rounded-[3px] border border-line px-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                  shown above
                </span>
              )}
            </span>
            <span className="truncate font-mono text-[12px] text-muted md:order-none">{r.model}</span>
            <span className="whitespace-nowrap text-right font-mono text-[12px] tabular-nums">
              {pct(r.improvement, r.metric.direction)} <span className="text-muted">{r.metric.label}</span>
            </span>
            <span className="text-right font-mono text-[12px] tabular-nums">
              {r.hypotheses.total}
              <span className="text-muted">
                {" "}
                · <span className="text-success">{r.hypotheses.confirmed}✓</span> <span className="text-danger">{r.hypotheses.refuted}✕</span>
              </span>
            </span>
            <span className="text-right font-mono text-[12px] tabular-nums">
              {alerts ? <span className="text-warning">{alerts} flagged</span> : <span className="text-muted">—</span>}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
