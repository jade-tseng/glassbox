"use client";

// The belief view: Before | Beliefs over one canvas (experiment dots fly between them), then a topic glossary,
// the inspector and a compact replay bar. Focus (a hypothesis) and topic focus are shared.

import { useEffect, useState } from "react";
import { useInView } from "@/components/motion/useInView";
import { BeliefFlow, topicStroke } from "./BeliefFlow";
import { Inspector } from "./Inspector";
import { STATUS } from "./layout";
import { useReplay } from "./Replay";

const TABS = [
  { id: "before", label: "Before · what worked" },
  { id: "beliefs", label: "Beliefs · why" },
] as const;

const AUTO_MORPH_MS = 3200;

// Plain-language glosses for the agent's topic names (Glassbox's words, not the agent's).
const TOPIC_GLOSS: Record<string, string> = {
  "ordering key": "How rows are sorted on disk. Queries that filter on the leading columns skip whole ranges.",
  projections: "Extra copies of the table, pre-sorted or pre-aggregated for specific queries. Fewer rows read, more storage.",
  "time filters": "Rewriting date conditions so the sort order can be used instead of scanning.",
  granularity: "How many rows each index entry covers. Smaller blocks allow finer skipping.",
  "skip indexes": "Small per-block summaries (e.g. which words occur) that let a query skip blocks.",
};

/** Opens on Before, then flies to Beliefs once on its own (unless the viewer picked a tab first). */
export function BeliefSection() {
  const { final } = useReplay();
  const [mode, setMode] = useState<"before" | "beliefs">("before");
  const [touched, setTouched] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [topicFocus, setTopicFocus] = useState<string | null>(null);
  const { ref, seen } = useInView<HTMLDivElement>("0px");

  useEffect(() => {
    if (touched || !seen || mode !== "before") return;
    const id = setTimeout(() => {
      setMode("beliefs");
      setTouched(true);
    }, AUTO_MORPH_MS);
    return () => clearTimeout(id);
  }, [touched, seen, mode]);

  const beliefs = mode === "beliefs";

  return (
    <div ref={ref} className="flex flex-col gap-6">
      <div className="min-w-0">
        <div role="tablist" className="relative mb-4 flex gap-6 border-b border-scope-line font-mono text-[12px] uppercase tracking-[0.08em]">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={mode === t.id}
              onClick={() => {
                setTouched(true);
                setMode(t.id);
              }}
              className={`relative pb-2.5 transition-colors duration-150 ${mode === t.id ? "text-scope-text" : "text-scope-muted hover:text-scope-text"}`}
            >
              {t.label}
              <span
                className="absolute inset-x-0 -bottom-px h-px bg-scope-text transition-transform duration-[280ms]"
                style={{ transform: mode === t.id ? "scaleX(1)" : "scaleX(0)" }}
                aria-hidden
              />
            </button>
          ))}
        </div>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <BeliefFlow mode={mode} focus={beliefs ? focus : null} onFocus={setFocus} topicFocus={beliefs ? topicFocus : null} />
        </div>
        <ReplayBar />
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.08em] text-scope-muted">
          <li className="flex items-center gap-2">
            <svg width="10" height="10" aria-hidden><circle cx="5" cy="5" r="3.5" fill="#0E1114" stroke="#E6EAEC" strokeWidth={1.4} /></svg>
            predicted
          </li>
          <li className="flex items-center gap-2"><Mark fill={STATUS.supports} /> confirmed</li>
          <li className="flex items-center gap-2"><Mark fill={STATUS.refutes} /> refuted → 0</li>
          <li className="flex items-center gap-2"><Mark fill={STATUS.amber} /> claimed, not shown</li>
          <li className="flex items-center gap-2">
            <svg width="22" height="8" aria-hidden><line x1="0" y1="4" x2="22" y2="4" stroke="rgba(230,234,236,.5)" /></svg> refines
          </li>
          <li className="flex items-center gap-2">
            <svg width="22" height="8" aria-hidden><line x1="0" y1="4" x2="22" y2="4" stroke="#7FD6E4" strokeDasharray="1 3" /></svg> depends on
          </li>
          <li className="flex items-center gap-2">
            <svg width="22" height="8" aria-hidden><line x1="0" y1="4" x2="22" y2="4" stroke={STATUS.refutes} strokeDasharray="4 3" /></svg> contradicts
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Topic glossary: what the agent's topic names mean */}
        <ul className="divide-y divide-scope-line border-y border-scope-line" onMouseLeave={() => setTopicFocus(null)}>
          {final.topics.map((t) => {
            const n = final.order.filter((id) => final.hypotheses[id].topic === t).length;
            return (
              <li
                key={t}
                onMouseEnter={() => setTopicFocus(t)}
                className={`grid cursor-default grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-4 py-2.5 transition-opacity duration-150 ${
                  topicFocus && topicFocus !== t ? "opacity-40" : ""
                }`}
              >
                <span className="flex items-center gap-2 font-mono text-[12px]" style={{ color: topicStroke(final.topics, t) }}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: topicStroke(final.topics, t) }} aria-hidden />
                  {t} <span className="text-scope-muted">×{n}</span>
                </span>
                <span className="text-[13px] leading-5 text-scope-text/80">{TOPIC_GLOSS[t] ?? "A group of related hypotheses, named by the agent."}</span>
              </li>
            );
          })}
        </ul>
        <Inspector focus={beliefs ? focus : null} />
      </div>
    </div>
  );
}

function Mark({ fill }: { fill: string }) {
  return (
    <svg width="10" height="10" aria-hidden>
      <circle cx="5" cy="5" r="4" fill={fill} />
    </svg>
  );
}

function mmss(t: number) {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

/** Play / scrub the replay. Everything on the page reads the same position. */
function ReplayBar() {
  const { state, events, index, setIndex, playing, setPlaying } = useReplay();
  return (
    <div className="mt-3 flex items-center gap-3 font-mono text-[12px] text-scope-muted">
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        className="h-7 w-7 shrink-0 rounded-[3px] border border-scope-line text-scope-text transition-colors duration-150 hover:bg-scope-raised"
        aria-label={playing ? "Pause replay" : "Replay the run"}
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
        className="h-1 min-w-0 flex-1 cursor-pointer accent-[#E6EAEC]"
        aria-label="Scrub through the run"
      />
      <span className="shrink-0 tabular-nums">{mmss(state.t)}</span>
    </div>
  );
}
