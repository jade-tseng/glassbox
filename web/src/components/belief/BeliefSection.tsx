"use client";

// The belief view: Before | Beliefs over one canvas (experiment dots fly between them), a replay bar and a legend.
// Hover a hypothesis to see its lineage; click it to open what it was and what it did.

import { useEffect, useState } from "react";
import { useInView } from "@/components/motion/useInView";
import { BeliefFlow } from "./BeliefFlow";
import { STATUS } from "./layout";
import { useReplay } from "./Replay";

const TABS = [
  { id: "before", label: "Before · what worked" },
  { id: "beliefs", label: "Beliefs · why" },
] as const;

const AUTO_MORPH_MS = 3200;

/** Opens on Before, then flies to Beliefs once on its own (unless the viewer picked a tab first). */
export function BeliefSection() {
  const [mode, setMode] = useState<"before" | "beliefs">("before");
  const [touched, setTouched] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const { ref, seen } = useInView<HTMLDivElement>("0px");

  useEffect(() => {
    if (touched || !seen || mode !== "before") return;
    const id = setTimeout(() => {
      setMode("beliefs");
      setTouched(true);
    }, AUTO_MORPH_MS);
    return () => clearTimeout(id);
  }, [touched, seen, mode]);

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPinned(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);

  const beliefs = mode === "beliefs";

  return (
    <div ref={ref} className="min-w-0">
      <div role="tablist" className="relative mb-4 flex gap-6 border-b border-scope-line font-mono text-[12px] uppercase tracking-[0.08em]">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => {
              setTouched(true);
              setMode(t.id);
              setPinned(null);
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
        {beliefs && (
          <span className="ml-auto hidden self-center pb-2.5 normal-case tracking-normal text-scope-muted md:inline">
            Click a dot to see what that idea was and what it did.
          </span>
        )}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        <BeliefFlow
          mode={mode}
          focus={beliefs ? focus : null}
          onFocus={setFocus}
          topicFocus={null}
          pinned={beliefs ? pinned : null}
          onPin={setPinned}
        />
      </div>
      <ReplayBar />
      {/* Legend: a handful of plain marks, per view */}
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.08em] text-scope-muted">
        {beliefs ? (
          <>
            <li className="flex items-center gap-2">
              <svg width="10" height="10" aria-hidden><circle cx="5" cy="5" r="3.5" fill="#0E1114" stroke="#E6EAEC" strokeWidth={1.4} /></svg>
              prediction
            </li>
            <li className="flex items-center gap-2"><Mark fill={STATUS.supports} /> held up</li>
            <li className="flex items-center gap-2"><Mark fill={STATUS.refutes} /> dropped → 0</li>
            <li className="flex items-center gap-2">
              <svg width="22" height="8" aria-hidden><line x1="0" y1="4" x2="22" y2="4" stroke="rgba(230,234,236,.5)" /></svg> builds on
            </li>
            <li className="flex items-center gap-2">
              <svg width="22" height="8" aria-hidden><line x1="0" y1="4" x2="22" y2="4" stroke={STATUS.refutes} strokeDasharray="4 3" /></svg> conflicts with
            </li>
          </>
        ) : (
          <>
            <li className="flex items-center gap-2"><Mark fill={STATUS.supports} /> change kept</li>
            <li className="flex items-center gap-2">
              <svg width="10" height="10" aria-hidden><circle cx="5" cy="5" r="3.5" fill="#0E1114" stroke="#7C8B98" strokeWidth={1.4} /></svg>
              change reverted
            </li>
          </>
        )}
      </ul>
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
