"use client";

// Provenance marks: every piece of information in Glassbox is one of three kinds, and the UI always says which.
//   ● OBSERVED         measured by the harness: metric, correctness, diff, keep/revert. It happened.
//   ◇ AGENT            the agent's own words: predictions, reasons, notes, verdicts. What it believes or guesses.
//   ◆ GLASSBOX         computed by Glassbox from the observations: confidence, evidence, signals, checks.

import type { ReactNode } from "react";

export type ProvKind = "observed" | "agent" | "glassbox";

export const PROV: Record<ProvKind, { mark: string; label: string; help: string; text: string; rule: string; dashed?: boolean }> = {
  observed: {
    mark: "●",
    label: "Observed",
    help: "Measured by the harness (the evaluator the agent can't edit). These things happened.",
    text: "text-success",
    rule: "border-mint",
  },
  agent: {
    mark: "◇",
    label: "Agent",
    help: "The agent's own words: what it predicted, why, and what it concluded. Beliefs and guesses, not measurements.",
    text: "text-violet",
    rule: "border-violet",
  },
  glassbox: {
    mark: "◆",
    label: "Glassbox",
    help: "Computed by Glassbox from the observations (confidence, evidence) or checked by a model (signals). An inference, with its basis shown.",
    text: "text-signal",
    rule: "border-signal",
    dashed: true,
  },
};

/** Inline mark: "● OBSERVED", "◇ AGENT SAID", "◆ GLASSBOX". */
export function Mark({ kind, label, className = "" }: { kind: ProvKind; label?: string; className?: string }) {
  const p = PROV[kind];
  return (
    <span title={p.help} className={`inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] ${p.text} ${className}`}>
      <span aria-hidden>{p.mark}</span>
      {label ?? p.label}
    </span>
  );
}

/** A block of content of one provenance, with a colored left rule (dashed for Glassbox inferences). */
export function Prov({ kind, label, children, className = "" }: { kind: ProvKind; label: string; children: ReactNode; className?: string }) {
  const p = PROV[kind];
  return (
    <div className={`border-l-2 pl-3 ${p.rule} ${p.dashed ? "border-dashed" : ""} ${className}`}>
      <Mark kind={kind} label={label} />
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

/** One-line key, shown wherever marks appear. */
export function ProvKey({ tone = "light", className = "" }: { tone?: "light" | "scope"; className?: string }) {
  const muted = tone === "scope" ? "text-scope-muted" : "text-muted";
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] ${muted} ${className}`}>
      <span className="uppercase tracking-[0.08em]">How to read</span>
      {(Object.keys(PROV) as ProvKind[]).map((k) => (
        <span key={k} title={PROV[k].help} className="flex items-center gap-1.5">
          <span className={PROV[k].text}>
            {PROV[k].mark} {PROV[k].label.toLowerCase()}
          </span>
          <span>
            {k === "observed" ? "measured by the harness" : k === "agent" ? "what the agent said or guessed" : "inferred from the observations"}
          </span>
        </span>
      ))}
    </div>
  );
}
