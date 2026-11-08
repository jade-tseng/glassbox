"use client";

// One run, told as a story (UI.md §7): what it set out to prove → how it went (Before → Beliefs) → ask it.
// Same components as the landing page, fed by the run's own events (polled live). The dense tracker view
// (ledger, heatmap, signals) stays one click away at /run/<id>/detail.

import Link from "next/link";
import { useMemo, useState } from "react";
import { QueryBox } from "@/components/run/QueryBox";
import { useRunEvents } from "@/components/run/useRunEvents";
import { GlassCube } from "@/components/motion/GlassCube";
import { PulseDot } from "@/components/motion/primitives";
import { fmtMetric, type RunEvent } from "@/lib/belief/engine";
import { BeliefSection } from "./BeliefSection";
import { ReplayProvider, useReplay } from "./Replay";

const mono = "font-mono text-[12px] uppercase tracking-[0.08em]";

function mmss(t: number) {
  return `${Math.floor(t / 60)}m ${String(Math.floor(t % 60)).padStart(2, "0")}s`;
}

export function RunStory({ runId }: { runId: string }) {
  const { events, feed } = useRunEvents(runId);
  const live = feed === "live";

  return (
    <div className="min-h-screen bg-frost text-ink">
      <header className="sticky top-0 z-30 border-b border-scope-line bg-scope text-scope-text">
        <nav className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 md:px-10">
          <Link href="/" className="flex items-center gap-2 text-[18px] font-medium tracking-[-0.02em]">
            <GlassCube size={18} stroke="var(--color-scope-text)" />
            glassbox
          </Link>
          <div className={`flex gap-6 ${mono} text-scope-muted`}>
            <Link href="/run" className="transition-colors duration-150 hover:text-scope-text">Runs</Link>
            <Link href={`/run/${runId}/detail`} className="transition-colors duration-150 hover:text-scope-text">Full detail</Link>
          </div>
        </nav>
      </header>

      {feed === "error" && events.length === 0 ? (
        <Message>Couldn&apos;t load run {runId}.</Message>
      ) : events.length === 0 ? (
        <Message>
          <span className="anim-shimmer inline-block h-4 w-48 rounded-[3px] opacity-20" aria-label="Loading run" />
        </Message>
      ) : (
        <ReplayProvider events={events as unknown as RunEvent[]} runId={runId} live={live}>
          <Story runId={runId} feed={feed} />
        </ReplayProvider>
      )}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-scope px-4 py-20 text-scope-text md:px-10">
      <div className="mx-auto max-w-[1200px] text-[15px] text-scope-muted">{children}</div>
    </section>
  );
}

function Story({ runId, feed }: { runId: string; feed: string }) {
  const { final, state, following } = useReplay();
  const [cited, setCited] = useState<string[]>([]);
  const [openRequest, setOpenRequest] = useState<{ id: string; n: number } | null>(null);

  const task = final.task;
  const m = task.metric;
  const running = feed === "live" && !final.finished;
  const hyps = final.order.map((id) => final.hypotheses[id]);
  const held = hyps.filter((h) => h.status === "confirmed").length;
  const dropped = hyps.filter((h) => h.status === "refuted" || h.status === "abandoned").length;
  const change = final.baseline ? ((final.best - final.baseline) / Math.abs(final.baseline)) * 100 : null;

  // Cited experiments light up the hypotheses they tested.
  const highlight = useMemo(() => {
    const s = new Set(cited);
    for (const id of cited) state.experiments[id]?.hypothesisIds.forEach((h) => s.add(h));
    return [...s];
  }, [cited, state]);

  const status = running ? "Live" : feed === "replay" ? "Replay" : "Finished";

  return (
    <>
      <section className="bg-scope px-4 pt-8 pb-14 text-scope-text md:px-10 md:pt-12 md:pb-20">
        <div className="mx-auto max-w-[1200px]">
          <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${mono} text-scope-muted`}>
            <PulseDot size={6} live={running} />
            <span className={running ? "text-scope-text" : ""}>{status}</span>
            <span>· {task.agent}{task.model ? ` (${task.model})` : ""}</span>
            <span>· {mmss(final.t)}</span>
            <span>· run {runId}</span>
          </p>
          <h1 className="mt-4 text-[32px] font-medium leading-[1.05] tracking-[-0.03em] md:text-[44px]">{task.name}.</h1>

          {task.description && (
            <p className="mt-6 max-w-[70ch] text-[15px] leading-6 text-scope-text/85">
              <span className={`${mono} text-scope-muted`}>Main hypothesis · </span>
              {task.description}
            </p>
          )}

          {/* Three numbers: how far it got, what it believed, how much it tried */}
          <dl className="mt-8 mb-8 grid grid-cols-1 gap-px overflow-hidden rounded-[6px] border border-scope-line bg-scope-line sm:grid-cols-3">
            <div className="bg-scope px-4 py-3">
              <dt className={`${mono} text-scope-muted`}>{m.label}</dt>
              <dd className="mt-1 font-mono text-[18px] tabular-nums">
                {fmtMetric(final.baseline, m)} → {fmtMetric(final.best, m)}
                {change !== null && (
                  <span className="ml-2 text-[14px] text-mint">
                    {change > 0 ? "+" : ""}
                    {change.toFixed(1)}%
                  </span>
                )}
              </dd>
            </div>
            <div className="bg-scope px-4 py-3">
              <dt className={`${mono} text-scope-muted`}>Ideas</dt>
              <dd className="mt-1 font-mono text-[18px] tabular-nums">
                {hyps.length} <span className="text-[14px] text-mint">· {held} held up</span>{" "}
                <span className="text-[14px] text-danger-fill">· {dropped} dropped</span>
              </dd>
            </div>
            <div className="bg-scope px-4 py-3">
              <dt className={`${mono} text-scope-muted`}>Experiments</dt>
              <dd className="mt-1 font-mono text-[18px] tabular-nums">{final.expOrder.length}</dd>
            </div>
          </dl>

          <div id="belief-graph">
            <BeliefSection highlight={highlight} openRequest={openRequest} />
          </div>
          {running && !following && (
            <p className={`mt-3 ${mono} text-scope-muted`}>Scrubbing back · new events keep arriving</p>
          )}
        </div>
      </section>

      {/* Ask the run */}
      <section className="bg-frost px-4 py-12 md:px-10 md:py-16">
        <div className="mx-auto max-w-[1200px]">
          <p className={`${mono} text-muted`}>Ask the run</p>
          <div className="mt-4">
            <QueryBox
              runId={runId}
              seq={following ? null : state.seq}
              onCite={setCited}
              onSelect={(id) => {
                const hid = state.hypotheses[id] ? id : state.experiments[id]?.hypothesisIds[0];
                if (!hid) return;
                setOpenRequest({ id: hid, n: Date.now() });
                document.getElementById("belief-graph")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </div>
          <p className="mt-8 font-mono text-[12px] text-muted">
            Where in the code it mattered, the full ledger and trust signals:{" "}
            <Link href={`/run/${runId}/detail`} className="text-ink underline decoration-line underline-offset-4 hover:text-signal">
              full detail →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
