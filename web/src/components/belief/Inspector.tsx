"use client";

// Ledger detail for one hypothesis — UI.md §7 Ledger. Agent words are sans; harness numbers are mono.

import { fmtRows } from "@/lib/belief/engine";
import { isTension } from "./BeliefGraph";
import { STATUS, topicColor } from "./layout";
import { useReplay } from "./Replay";

const STATUS_CHIP: Record<string, string> = {
  open: "border-scope-line text-scope-text",
  confirmed: "border-transparent bg-mint text-ink",
  refuted: "border-transparent bg-danger-fill text-ink",
  abandoned: "border-scope-line text-scope-muted",
};

export function Inspector({ focus }: { focus: string | null }) {
  const { state, final } = useReplay();
  // Follow the focused hypothesis, else the one the latest event touched.
  const newestHyp =
    state.newest && state.hypotheses[state.newest]
      ? state.newest
      : state.newest && state.experiments[state.newest]
        ? state.experiments[state.newest].hypothesisIds[0]
        : state.order[state.order.length - 1];
  const id = focus && state.hypotheses[focus] ? focus : newestHyp;
  const h = id ? state.hypotheses[id] : null;

  if (!h) {
    return (
      <div className="rounded-[6px] border border-scope-line bg-scope-raised p-5">
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-scope-muted">Waiting for the first hypothesis</p>
        <div className="anim-shimmer mt-4 h-20 rounded-[3px] opacity-10" />
      </div>
    );
  }
  const { text } = topicColor(final.topics, h.topic);
  const tension = isTension(h, state.experiments);

  return (
    <div className="rounded-[6px] border border-scope-line bg-scope-raised p-5" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[12px] uppercase tracking-[0.08em]">
        <span className="text-scope-text">{h.id}</span>
        <span style={{ color: text }}>{h.topic}</span>
        <span className={`rounded-[3px] border px-1.5 py-px text-[11px] ${STATUS_CHIP[h.status]}`}>{h.status}</span>
        {!focus && <span className="ml-auto text-scope-muted normal-case tracking-normal">following latest</span>}
      </div>

      <p className="mt-3 text-[15px] leading-6 text-scope-text">{h.claim}</p>

      <dl className="mt-4 space-y-3 text-[13px] leading-5">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-scope-muted">Why it tried this (agent)</dt>
          <dd className="mt-0.5 text-scope-text/85">{h.reason}</dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-scope-muted">Prediction</dt>
            <dd className="mt-0.5 font-mono tabular-nums">
              {h.direction === "decrease" ? "↓" : "↑"} read_rows · {h.prior.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-scope-muted">What the numbers say (harness)</dt>
            <dd className="mt-0.5 font-mono tabular-nums" style={{ color: h.belief >= h.prior ? STATUS.supports : STATUS.refutes }}>
              {h.belief.toFixed(2)}
            </dd>
          </div>
        </div>
        {h.experiments.length > 0 && (
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-scope-muted">Evidence</dt>
            <dd className="mt-1 space-y-2">
              {h.experiments.map((eid) => {
                const e = state.experiments[eid];
                const pct = e.after !== null ? ((e.after - e.before) / e.before) * 100 : null;
                const c = e.evidence === "supports" ? STATUS.supports : e.evidence === "weak" ? "#8A949A" : STATUS.refutes;
                return (
                  <div key={eid} className="border-l-2 pl-2.5" style={{ borderColor: c }}>
                    <p className="font-mono text-[12px] tabular-nums">
                      {eid} ·{" "}
                      {e.failed ? (
                        <span style={{ color: STATUS.refutes }}>failed ({e.errorKind})</span>
                      ) : (
                        <>
                          {fmtRows(e.before)} → {fmtRows(e.after!)}{" "}
                          <span className="text-scope-muted">({pct! > 0 ? "+" : ""}{pct!.toFixed(1)}%)</span>
                        </>
                      )}{" "}
                      · <span style={{ color: c }}>{e.evidence}</span>
                      {e.kept !== null && <span className="text-scope-muted"> · {e.kept ? "kept" : "discarded"}</span>}
                    </p>
                    {e.note && <p className="mt-0.5 text-[12px] text-scope-text/75">{e.note}</p>}
                  </div>
                );
              })}
            </dd>
          </div>
        )}
        {h.summary && (
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-scope-muted">What it concluded (agent)</dt>
            <dd className="mt-0.5 text-scope-text/85">{h.summary}</dd>
          </div>
        )}
        {tension && (
          <p className="rounded-[3px] border border-warn-fill/40 px-2.5 py-1.5 text-[12px] text-warn-fill">
            <span className="font-mono uppercase tracking-[0.08em]">Claimed, not shown.</span> The agent marked this
            confirmed. The measurements don&apos;t back it.
          </p>
        )}
      </dl>
    </div>
  );
}
