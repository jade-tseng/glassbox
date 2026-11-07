"use client";

// Hypothesis ledger (PLAN §4.9 right panel). Click a row to select; the selected hypothesis expands with its
// reason, every experiment that tested it (harness numbers + the agent's note), and the latest diff.

import type { GraphState } from "@/lib/beliefEngine";
import type { HackCheck } from "@/lib/hackChecks";
import { Chip, EVIDENCE_STYLE, Label, STATUS_STYLE, fmtRows } from "./ui";
import { FLAG_TEXT } from "./useChecks";

const pct = (p: number) => `${Math.round(p * 100)}%`;

export function Ledger({
  graph,
  selected,
  highlighted,
  onSelect,
  checks = {},
}: {
  graph: GraphState;
  selected: string | null;
  highlighted: Set<string>;
  onSelect: (id: string | null) => void;
  checks?: Record<string, HackCheck>;
}) {
  const hs = Object.values(graph.hypotheses).sort((a, b) => b.proposedSeq - a.proposedSeq);
  const exps = new Map(graph.experiments.map((e) => [e.id, e]));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <Label>Ledger</Label>
        <span className="font-mono text-[11px] text-muted">{hs.length} hypotheses</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {hs.length === 0 && <p className="p-4 font-mono text-[13px] text-muted">No hypotheses yet.</p>}
        {hs.map((h) => {
          const st = STATUS_STYLE[h.status];
          const open = selected === h.id;
          const evidence = graph.evidence.filter((e) => e.hypothesis === h.id);
          const flagged = h.tests.some((id) => checks[id]?.flags.length);
          return (
            <div key={h.id} className={`border-b border-line ${open ? "bg-frost" : ""}`}>
              <button
                type="button"
                onClick={() => onSelect(open ? null : h.id)}
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-mist ${highlighted.has(h.id) ? "bg-mist" : ""}`}
              >
                <span className="mt-px w-7 shrink-0 font-mono text-[12px] text-ink">{h.id}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13px] leading-[18px] text-ink ${open ? "" : "truncate"}`}>{h.claim}</span>
                  <span className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted">
                    <span className="truncate">{h.topic}</span>
                    <span>·</span>
                    <span className="tabular-nums">
                      {Math.round(h.prediction.confidence * 100)}→{Math.round(h.confidence * 100)}%
                    </span>
                    {evidence.map((e) => (
                      <span key={e.experiment} className={EVIDENCE_STYLE[e.kind].cls.split(" ").find((c) => c.startsWith("text-"))}>
                        {EVIDENCE_STYLE[e.kind].glyph}
                      </span>
                    ))}
                    {flagged && (
                      <span className="text-warning" title="SubQ Snap flagged an experiment: open for details">
                        ⚑
                      </span>
                    )}
                  </span>
                </span>
                <Chip className={`shrink-0 ${st.chip}`}>{st.label}</Chip>
              </button>

              {open && (
                <div className="space-y-3 px-4 pb-4 text-[13px] leading-[19px]">
                  <div>
                    <Label className="mb-1 text-[11px]">Reason</Label>
                    <p className="text-ink">{h.reason}</p>
                  </div>
                  <div className="font-mono text-[11px] text-muted">
                    {h.codeRegion.file} · {h.codeRegion.symbol}
                  </div>
                  {h.tests.map((eid) => {
                    const e = exps.get(eid);
                    if (!e) return null;
                    const ev = evidence.find((x) => x.experiment === eid);
                    return (
                      <div key={eid} className="rounded-[6px] border border-line bg-white p-3">
                        <div className="flex items-center justify-between font-mono text-[12px]">
                          <span className="flex items-center gap-2">
                            <span className="text-ink">{eid}</span>
                            {ev && <Chip className={EVIDENCE_STYLE[ev.kind].cls}>{EVIDENCE_STYLE[ev.kind].title.split(" ")[0]}</Chip>}
                            {e.measuredBy === "client" && (
                              <Chip className="border-line text-warning" title="Metric reported by the client, not measured by a Glassbox verifier">
                                client-reported
                              </Chip>
                            )}
                          </span>
                          <span className="tabular-nums text-muted">
                            {e.correct ? `${fmtRows(e.metricBefore)} → ${fmtRows(e.metricAfter)}` : e.errorKind}
                          </span>
                        </div>
                        {e.errorMessage && <p className="mt-1 font-mono text-[11px] text-danger">{e.errorMessage.slice(0, 220)}</p>}
                        {e.note && <p className="mt-2 text-ink">“{e.note}”</p>}
                        {checks[eid] && (
                          <div className="mt-2 border-t border-line pt-2 font-mono text-[11px] leading-[16px]">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
                              <span className="uppercase tracking-[0.08em]">Signals</span>
                              <span title="P(diff implements the hypothesis)">on-topic {pct(checks[eid].on_topic)}</span>
                              <span>·</span>
                              <span title="P(gain comes from places the hypothesis doesn't predict)">unexplained {pct(checks[eid].unexplained)}</span>
                              <span>·</span>
                              <span title="P(the change alters what is computed)">semantics {pct(checks[eid].semantics)}</span>
                            </div>
                            {checks[eid].flags.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {checks[eid].flags.map((f) => (
                                  <Chip key={f} className="border-transparent bg-warn-fill text-ink">
                                    ⚑ {FLAG_TEXT[f]}
                                  </Chip>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1 text-success">✓ tests what it claimed · {checks[eid].fit.label.toLowerCase()}</p>
                            )}
                          </div>
                        )}
                        {e.disagreement && (
                          <p className="mt-1 font-mono text-[11px] text-warning">Agent kept={String(e.agentKept)}; harness beats_best={String(e.beatsBest)}</p>
                        )}
                      </div>
                    );
                  })}
                  {h.summary && (
                    <div>
                      <Label className="mb-1 text-[11px]">Closing summary</Label>
                      <p className="text-ink">{h.summary}</p>
                    </div>
                  )}
                  {(() => {
                    const last = [...h.tests].reverse().map((id) => exps.get(id)).find((e) => e?.diff);
                    if (!last) return null;
                    return (
                      <div>
                        <Label className="mb-1 text-[11px]">Diff · {last.id}</Label>
                        <pre className="max-h-56 overflow-auto rounded-[6px] bg-scope p-3 font-mono text-[11px] leading-[16px] text-scope-text">
                          {last.diff.split("\n").map((line, i) => (
                            <div
                              key={i}
                              className={
                                line.startsWith("+") && !line.startsWith("+++")
                                  ? "text-mint"
                                  : line.startsWith("-") && !line.startsWith("---")
                                    ? "text-danger-fill"
                                    : line.startsWith("@@")
                                      ? "text-scope-muted"
                                      : ""
                              }
                            >
                              {line || " "}
                            </div>
                          ))}
                        </pre>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
