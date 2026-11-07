"use client";

// The belief view: Before | Beliefs tabs over one canvas (dots fly between them),
// inspector beside it, timeline + scrubber below. Focus is shared across all three.

import { useState } from "react";
import { BeliefGraph } from "./BeliefGraph";
import { BeliefTimeline } from "./BeliefTimeline";
import { Inspector } from "./Inspector";
import { STATUS } from "./layout";

const TABS = [
  { id: "before", label: "Before · keep/discard" },
  { id: "beliefs", label: "Beliefs" },
] as const;

export function BeliefSection() {
  const [mode, setMode] = useState<"before" | "beliefs">("beliefs");
  const [focus, setFocus] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div role="tablist" className="relative mb-4 flex gap-6 border-b border-scope-line font-mono text-[12px] uppercase tracking-[0.08em]">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={mode === t.id}
                onClick={() => setMode(t.id)}
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
            <BeliefGraph mode={mode} focus={mode === "beliefs" ? focus : null} onFocus={setFocus} />
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.08em] text-scope-muted">
            <li className="flex items-center gap-2">
              <svg width="26" height="12" aria-hidden>
                <rect x="1" y="4" width="24" height="4" fill="rgba(230,234,236,.12)" />
                <rect x="1" y="4" width="15" height="4" fill="#E6EAEC" />
                <line x1="19" x2="19" y1="1" y2="11" stroke="#E6EAEC" strokeDasharray="2 1.5" />
              </svg>
              belief vs prediction
            </li>
            <li className="flex items-center gap-2"><Dot fill={STATUS.supports} /> kept</li>
            <li className="flex items-center gap-2"><Dot fill="transparent" stroke="#7C8B98" /> discarded</li>
            <li className="flex items-center gap-2"><Dot fill={STATUS.refutes} /> failed / invalid</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 bg-warn-fill" /> agent ≠ harness</li>
            <li className="flex items-center gap-2">
              <svg width="20" height="6" aria-hidden><line x1="0" y1="3" x2="20" y2="3" stroke="#A9C7FF" strokeDasharray="2 3" /></svg>
              same code region
            </li>
          </ul>
        </div>
        <Inspector focus={mode === "beliefs" ? focus : null} />
      </div>
      <BeliefTimeline focus={focus} onFocus={setFocus} />
    </div>
  );
}

function Dot({ fill, stroke }: { fill: string; stroke?: string }) {
  return (
    <svg width="10" height="10" aria-hidden>
      <circle cx="5" cy="5" r="4" fill={fill} stroke={stroke ?? fill} strokeWidth={1.2} />
    </svg>
  );
}
