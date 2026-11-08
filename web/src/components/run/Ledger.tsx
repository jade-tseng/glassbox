"use client";

// Hypothesis ledger (PLAN §4.9 right panel). Click a row to select; the selected hypothesis expands with its
// reason, every experiment that tested it (harness numbers + the agent's note), and the latest diff.

import type { Direction, EvidenceEdge, EvidenceKind, GraphState, HypothesisNode } from "@/lib/beliefEngine";
import type { HackCheck } from "@/lib/hackChecks";
import { Mark, Prov } from "./provenance";
import { Chip, EVIDENCE_STYLE, Label, STATUS_STYLE, arrowFor, fmtRows } from "./ui";
import { FLAG_TEXT } from "./useChecks";

const pct = (p: number) => `${Math.round(p * 100)}%`;
const signedPct = (x: number) => (Math.abs(x) < 0.0005 ? "0%" : `${x < 0 ? "−" : "+"}${Math.abs(x * 100).toFixed(1)}%`);

/** Change in Glassbox confidence caused by the experiment at `seq` (null if it didn't move it). */
function confidenceDelta(h: HypothesisNode, seq: number): number | null {
  const i = h.history.findIndex((p) => p.seq === seq);
  if (i <= 0) return null;
  return h.history[i].confidence - h.history[i - 1].confidence;
}

/** Why the observation counts as this kind of evidence, in plain words. */
function evidenceWhy(kind: EvidenceKind, predicted: Direction, observed: Direction | null): string {
  const said = predicted.replace("_", " ");
  const saw = observed ? observed.replace("_", " ") : "no valid result";
  if (kind === "supports") return `predicted ${said}, observed ${saw}`;
  if (kind === "refutes") return `predicted ${said}, observed ${saw}`;
  if (kind === "weak") return `predicted ${said}, observed less than 1% change`;
  return "the run was rejected, so it says nothing about the idea";
}

function tally(ev: EvidenceEdge[]): string {
  const n = (k: EvidenceKind) => ev.filter((e) => e.kind === k).length;
  const parts = [`${n("supports")} for`, `${n("refutes")} against`];
  if (n("weak")) parts.push(`${n("weak")} weak`);
  if (n("invalid")) parts.push(`${n("invalid")} rejected`);
  return `based on ${parts.join(", ")}`;
}

/** When the agent's own verdict and the evidence-based confidence point different ways. */
function verdictConflict(h: HypothesisNode): string | null {
  if (h.status === "confirmed" && h.confidence < 0.5) return "the agent says confirmed, but the observations don't support it";
  if (h.status === "refuted" && h.confidence > 0.6) return "the agent dropped it, but the observations mostly supported it";
  return null;
}

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
                  {/* Before: what the agent believed and predicted */}
                  <Prov kind="agent" label="Agent predicted · before">
                    <p className="text-ink">
                      {graph.task.metric.label} will {h.prediction.direction === "no_change" ? "not change" : h.prediction.direction} {arrowFor(h.prediction.direction)} · {pct(h.prediction.confidence)} sure
                    </p>
                    <p className="mt-1 text-muted">Because: {h.reason}</p>
                    <p className="mt-1 font-mono text-[11px] text-subtle">
                      will change {h.codeRegion.file} · {h.codeRegion.symbol}
                    </p>
                  </Prov>

                  {(["before", "while"] as const).map((when) => {
                    const obs = h.observations.filter((o) => o.when === when).map((o) => graph.observations.find((x) => x.seq === o.seq)).filter(Boolean);
                    if (!obs.length) return null;
                    return (
                      <Prov key={when} kind="observed" label={`Observed ${when === "before" ? "before proposing" : "while testing"} · ${obs.length}`}>
                        <p className="mb-1 text-[12px] text-muted">
                          {when === "before" ? "What the agent looked at that led to this belief:" : "What it looked at while this idea was being tested:"}
                        </p>
                        <div className="space-y-1">
                          {obs.map((o) => (
                            <details key={o!.seq} className="rounded-[3px] border border-line bg-white">
                              <summary className="cursor-pointer px-2 py-1 font-mono text-[11px] text-ink">{o!.command.replace(/^python3\s+/, "")}</summary>
                              <pre className="max-h-48 overflow-auto border-t border-line bg-frost px-2 py-1.5 font-mono text-[10.5px] leading-[15px] text-ink">
                                {o!.output || "(no output)"}
                                {o!.truncated ? "\n…(truncated)" : ""}
                              </pre>
                            </details>
                          ))}
                        </div>
                      </Prov>
                    );
                  })}

                  {h.tests.map((eid) => {
                    const e = exps.get(eid);
                    if (!e) return null;
                    const ev = evidence.find((x) => x.experiment === eid);
                    const delta = confidenceDelta(h, e.seq);
                    const ck = checks[eid];
                    return (
                      <div key={eid} className="space-y-2 rounded-[6px] border border-line bg-white p-3">
                        <div className="font-mono text-[12px] text-ink">{eid}</div>

                        <Prov kind="observed" label={e.measuredBy === "client" ? "Observed · reported by client" : "Observed · harness"}>
                          <p className="font-mono text-[12px] tabular-nums text-ink">
                            {e.correct
                              ? `${graph.task.metric.label} ${fmtRows(e.metricBefore)} → ${fmtRows(e.metricAfter)}${e.rawChange !== null ? ` (${signedPct(e.rawChange)})` : ""}`
                              : `${e.errorKind}: run rejected`}
                          </p>
                          <p className="font-mono text-[11px] text-muted">
                            {e.correct ? "results correct ✓" : "results not accepted"} · {e.beatsBest ? "new best" : e.correct ? "not better than best" : "no score"}
                            {e.filesChanged.length ? ` · changed ${e.filesChanged.join(", ")}` : ""}
                          </p>
                          {e.errorMessage && <p className="mt-1 font-mono text-[11px] text-danger">{e.errorMessage.slice(0, 220)}</p>}
                        </Prov>

                        {(e.note || e.agentKept !== null) && (
                          <Prov kind="agent" label="Agent concluded · after">
                            {e.note && <p className="text-ink">“{e.note}”</p>}
                            {e.agentKept !== null && <p className="font-mono text-[11px] text-muted">decided to {e.agentKept ? "keep" : "revert"} the change</p>}
                          </Prov>
                        )}

                        <Prov kind="glassbox" label="Glassbox infers">
                          {ev ? (
                            <p className="text-ink">
                              <Chip className={EVIDENCE_STYLE[ev.kind].cls}>{EVIDENCE_STYLE[ev.kind].title.split(" ")[0]}</Chip>{" "}
                              <span className="text-muted">{evidenceWhy(ev.kind, h.prediction.direction, e.observed)}</span>
                              {delta !== null && (
                                <span className={`block font-mono text-[11px] ${delta >= 0 ? "text-success" : "text-danger"}`}>
                                  → confidence {delta >= 0 ? "+" : "−"}
                                  {Math.abs(Math.round(delta * 100))} pts
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-muted">no evidence recorded</p>
                          )}
                          {e.disagreement && (
                            <p className="font-mono text-[11px] text-warning">
                              ⚠ the agent decided to {e.agentKept ? "keep" : "revert"}, but the harness says this {e.beatsBest ? "was" : "was not"} a new best
                            </p>
                          )}
                          {ck && (
                            <div className="mt-1 font-mono text-[11px] leading-[16px]">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
                                <span title="Model check (SubQ Snap) of the diff against the stated hypothesis">check:</span>
                                <span title="P(diff implements the hypothesis)">on-topic {pct(ck.on_topic)}</span>
                                <span>·</span>
                                <span title="P(gain comes from places the hypothesis doesn't predict)">unexplained {pct(ck.unexplained)}</span>
                                <span>·</span>
                                <span title="P(the change alters what is computed)">semantics {pct(ck.semantics)}</span>
                              </div>
                              {ck.flags.length > 0 ? (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {ck.flags.map((f) => (
                                    <Chip key={f} className="border-transparent bg-warn-fill text-ink">
                                      ⚑ {FLAG_TEXT[f]}
                                    </Chip>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1 text-success">✓ the diff tests what it claimed · {ck.fit.label.toLowerCase()}</p>
                              )}
                            </div>
                          )}
                        </Prov>
                      </div>
                    );
                  })}

                  {h.summary && (
                    <Prov kind="agent" label={`Agent's verdict · ${h.status}`}>
                      <p className="text-ink">“{h.summary}”</p>
                    </Prov>
                  )}

                  <Prov kind="glassbox" label="Glassbox infers · overall">
                    <p className="text-ink">
                      confidence <span className="font-mono tabular-nums">{pct(h.prediction.confidence)}</span> stated →{" "}
                      <span className="font-mono tabular-nums">{pct(h.confidence)}</span> after {h.tests.length} observation{h.tests.length === 1 ? "" : "s"}
                    </p>
                    <p className="font-mono text-[11px] text-muted">{tally(evidence)}</p>
                    {verdictConflict(h) && <p className="mt-1 font-mono text-[11px] text-warning">⚠ {verdictConflict(h)}</p>}
                  </Prov>
                  {(() => {
                    const last = [...h.tests].reverse().map((id) => exps.get(id)).find((e) => e?.diff);
                    if (!last) return null;
                    return (
                      <div>
                        <Mark kind="observed" label={`Observed · diff ${last.id}`} className="mb-1" />
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
