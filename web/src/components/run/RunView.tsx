"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildGraph } from "@/lib/beliefEngine";
import { BeforeView } from "./BeforeView";
import { BeliefGraph } from "./BeliefGraph";
import { HeatmapView } from "./HeatmapView";
import { Ledger } from "./Ledger";
import { ProvKey } from "./provenance";
import { QueryBox } from "./QueryBox";
import { Timeline } from "./Timeline";
import { CountUp, Label, PulseDot, fmtNum } from "./ui";
import { useChecks } from "./useChecks";
import { useRunEvents } from "./useRunEvents";

type Tab = "graph" | "heatmap" | "before";

export function RunView({ runId }: { runId: string }) {
  const { events, meta, feed } = useRunEvents(runId);
  const [scrub, setScrub] = useState<number | null>(null); // null = follow head
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("graph");
  const [cited, setCited] = useState<string[]>([]);

  const full = useMemo(() => buildGraph(events), [events]);
  const checks = useChecks(runId, full.experiments.length); // hack signals (SubQ Snap), cached server-side
  const cursor = scrub ?? full.maxSeq;
  const graph = useMemo(() => (scrub === null ? full : buildGraph(events, scrub)), [events, full, scrub]);
  const running = feed === "live" && !full.finished;
  // Cited experiments also light up the hypotheses they tested.
  const highlighted = useMemo(() => {
    const s = new Set(cited);
    for (const e of graph.experiments) if (s.has(e.id)) e.hypothesisIds.forEach((h) => s.add(h));
    return s;
  }, [cited, graph]);
  const following = scrub === null;

  const newestId = useMemo(() => {
    let best: { id: string; seq: number } | null = null;
    for (const h of Object.values(graph.hypotheses)) {
      const seq = Math.max(h.proposedSeq, h.history.at(-1)?.seq ?? 0);
      if (!best || seq > best.seq) best = { id: h.id, seq };
    }
    return best?.id ?? null;
  }, [graph]);

  const exps = graph.experiments;
  const hs = Object.values(graph.hypotheses);
  const lowerIsBetter = graph.task.metric.direction !== "higher";
  const reduction =
    graph.metric.baseline && graph.metric.best !== null
      ? (lowerIsBetter ? graph.metric.baseline - graph.metric.best : graph.metric.best - graph.metric.baseline) / Math.abs(graph.metric.baseline)
      : null;
  const lastMessage = graph.messages.at(-1);

  return (
    <div className="min-h-screen bg-frost text-ink">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-line bg-frost">
        <nav className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 md:px-10">
          <Link href="/" className="flex items-center gap-2 text-[18px] font-medium tracking-[-0.02em]">
            <CubeMark />
            glassbox
          </Link>
          <div className="flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.08em] text-muted">
            <PulseDot live={running} />
            <span>
              {feed === "replay" ? "REPLAY" : running ? "LIVE" : feed === "error" ? "OFFLINE" : feed === "loading" ? "LOADING" : "FINISHED"} · run {runId}
              {meta?.model ? ` · ${meta.model}` : ""}
            </span>
          </div>
        </nav>
      </header>

      {/* Header + metrics */}
      <section className="mx-auto max-w-[1440px] px-4 pt-8 md:px-10">
        <Label>01 / Run</Label>
        <h1 className="mt-2 text-[32px] font-medium leading-[1.05] tracking-[-0.03em] md:text-[44px]">What the agent believed.</h1>
        <p className={`mt-2 font-mono text-[12px] text-muted ${graph.seq === 0 ? "invisible" : ""}`}>
          {graph.task.agent}
          {graph.task.provider ? ` on ${graph.task.provider}` : ""}
          {graph.task.model ? ` (${graph.task.model})` : ""} · {graph.task.name} · metric {graph.task.metric.label} ({graph.task.metric.direction} is better)
        </p>
        {graph.task.description && <p className="mt-1 max-w-[760px] text-[14px] leading-[20px] text-muted">{graph.task.description}</p>}

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-line bg-line md:grid-cols-6">
          <Tile label="Baseline" value={<CountUp value={graph.metric.baseline} format={fmtNum} />} sub={<span>{graph.task.metric.unit || graph.task.metric.label}</span>} />
          <Tile label="Best" value={<CountUp value={graph.metric.best} format={fmtNum} />} live={running} sub={<span>{graph.task.metric.unit || graph.task.metric.label}</span>} />
          <Tile
            label="Improvement"
            value={<CountUp value={reduction === null ? null : reduction * 100} format={(n) => `${n.toFixed(1)}%`} />}
            sub={reduction ? <span className="text-success">{lowerIsBetter ? "↓" : "↑"} {graph.task.metric.label}</span> : null}
          />
          <Tile
            label="Experiments"
            value={<CountUp value={exps.length} />}
            sub={
              <span>
                <span className="text-success">{exps.filter((e) => e.outcome === "kept").length} kept</span> · {exps.filter((e) => e.outcome === "discarded").length} disc ·{" "}
                <span className="text-danger">{exps.filter((e) => e.outcome === "invalid").length} inv</span>
              </span>
            }
          />
          <Tile
            label="Hypotheses"
            value={<CountUp value={hs.length} />}
            sub={
              <span>
                <span className="text-success">{hs.filter((h) => h.status === "confirmed").length} conf</span> ·{" "}
                <span className="text-danger">{hs.filter((h) => h.status === "refuted").length} ref</span> · {hs.filter((h) => h.status === "open" || h.status === "untested").length} open
              </span>
            }
          />
          <Tile
            label="Calibration"
            value={<CountUp value={graph.calibration.brier} format={(n) => n.toFixed(2)} />}
            sub={<span>Brier · n={graph.calibration.n} · lower is better</span>}
          />
        </div>

        <div className="mt-6">
          <QueryBox
            runId={runId}
            seq={scrub}
            onCite={setCited}
            onSelect={(id) => {
              const exp = graph.experiments.find((e) => e.id === id);
              setTab("graph");
              setSelected(exp ? (exp.hypothesisIds[0] ?? null) : id);
            }}
          />
        </div>

        {/* Tabs */}
        <div className="mt-8 flex items-center gap-1 border-b border-line">
          {(
            [
              ["graph", "02 / Belief graph"],
              ["heatmap", "Heatmap"],
              ["before", "Before: dots only"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px border-b px-3 py-2 font-mono text-[12px] uppercase tracking-[0.08em] transition-colors duration-150 ${
                tab === key ? "border-signal text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
          {!following && (
            <span className="ml-auto font-mono text-[12px] text-warning">Viewing the past · seq {cursor}</span>
          )}
        </div>
        <ProvKey className="mt-3" />

        <div className="mt-4 grid gap-4 pb-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 rounded-[6px] border border-line bg-white p-4 md:p-5">
            {tab === "graph" ? (
              <BeliefGraph graph={graph} selected={selected} highlighted={highlighted} newestId={newestId} live={following} onSelect={setSelected} />
            ) : tab === "heatmap" ? (
              <HeatmapView
                graph={graph}
                onSelectHypothesis={(id) => {
                  setSelected(id);
                  setTab("graph");
                }}
              />
            ) : (
              <BeforeView graph={graph} />
            )}
          </div>
          <div className="h-[640px] overflow-hidden rounded-[6px] border border-line bg-white lg:sticky lg:top-20">
            <Ledger graph={graph} selected={selected} highlighted={highlighted} onSelect={setSelected} checks={checks} />
          </div>
        </div>
      </section>

      {/* Scope band: scrubber + belief timeline + activity */}
      <section className="bg-scope text-scope-text">
        <div className="mx-auto max-w-[1440px] space-y-4 px-4 py-8 md:px-10">
          <Timeline full={full} cursor={cursor} live={following} running={running} selected={selected} onScrub={setScrub} />
          {lastMessage && (
            <div className="flex gap-3 border-t border-scope-line pt-4 font-mono text-[13px] leading-[20px]">
              <span className="shrink-0 text-violet" title="The agent's own words">◇ agent ›</span>
              <span className="line-clamp-2 text-scope-text">{lastMessage.text}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, sub, live }: { label: string; value: React.ReactNode; sub?: React.ReactNode; live?: boolean }) {
  return (
    <div className="relative bg-white p-4">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {live && <PulseDot live size={6} />}
      </div>
      <div className="mt-2 font-mono text-[24px] tracking-[-0.03em] md:text-[28px]">{value}</div>
      {sub && <div className="mt-1 font-mono text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function CubeMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2 21 7v10l-9 5-9-5V7z" fill="var(--color-ice)" fillOpacity={0.25} stroke="var(--color-ink)" strokeWidth={1} />
      <path d="M3 7l9 5 9-5M12 12v10" fill="none" stroke="var(--color-ink)" strokeWidth={1} />
      <circle cx="12" cy="12" r="1.6" fill="var(--color-live)" />
    </svg>
  );
}
