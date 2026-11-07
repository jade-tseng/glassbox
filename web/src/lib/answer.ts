// NL query answers (PLAN §4.8). SubQ Snap decides *which* evidence answers the question (calibrated
// probabilities, no generated text); this module composes the answer deterministically from the agent's own
// recorded words and the harness's numbers. Every line cites the node it comes from.

import type { ExperimentNode, GraphState, HypothesisNode } from "./beliefEngine";

export const INTENTS = {
  why_stopped: "Why the agent gave up on, refuted, abandoned or reverted an idea",
  belief_about: "What the agent currently believes about a topic or idea, and how confident it is",
  what_worked: "What worked: the changes that reduced read_rows the most",
  what_failed: "What failed: refuted hypotheses, discarded or invalid experiments, wrong results",
  evidence_for: "The evidence behind a specific hypothesis or experiment",
  calibration: "How well the agent's predictions matched outcomes; where it was surprised",
  overview: "A general summary of the run",
} as const;
export type Intent = keyof typeof INTENTS;

export type AnswerItem = { id: string; kind: "hypothesis" | "experiment"; title: string; lines: string[]; relevance: number };
export type Answer = { lead: string; items: AnswerItem[]; cited: string[]; intent: Intent; focus: string | null };

const pct = (x: number) => `${Math.round(x * 100)}%`;
export const rows = (n: number | null) =>
  n === null ? "n/a" : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);

function expLine(e: ExperimentNode): string {
  if (!e.correct) return `${e.id}: ${e.errorKind}${e.errorMessage ? ` (${e.errorMessage.slice(0, 140)})` : ""}`;
  const rel = e.relChange === null ? "" : ` (${e.relChange >= 0 ? "−" : "+"}${Math.abs(e.relChange * 100).toFixed(1)}%)`;
  return `${e.id}: read_rows ${rows(e.metricBefore)} → ${rows(e.metricAfter)}${rel}, ${e.outcome}`;
}

function hypItem(h: HypothesisNode, g: GraphState, relevance: number): AnswerItem {
  const exps = h.tests.map((id) => g.experiments.find((e) => e.id === id)).filter(Boolean) as ExperimentNode[];
  const lines = [
    `Claim: ${h.claim}`,
    `Status ${h.status}; confidence ${pct(h.prediction.confidence)} stated → ${pct(h.confidence)} after evidence (predicted read_rows ${h.prediction.direction}).`,
    `Why the agent thought so: ${h.reason}`,
    ...exps.map((e) => `${expLine(e)}${e.note ? ` — agent: “${e.note}”` : ""}`),
  ];
  if (h.summary) lines.push(`Closing summary: “${h.summary}”`);
  return { id: h.id, kind: "hypothesis", title: `${h.id} · ${h.topic}`, lines, relevance };
}

function expItem(e: ExperimentNode, relevance: number): AnswerItem {
  const lines = [expLine(e), `Tested: ${e.hypothesisIds.join(", ") || "no armed hypothesis"}; files: ${e.filesChanged.join(", ") || "none"}.`];
  if (e.note) lines.push(`Agent: “${e.note}”`);
  if (e.disagreement) lines.push(`Note: the agent's keep decision (${e.agentKept}) disagrees with the harness (beats best: ${e.beatsBest}).`);
  return { id: e.id, kind: "experiment", title: `${e.id} · ${e.outcome}`, lines, relevance };
}

/** Compose from SubQ's relevance scores. `rel` maps node id -> P(relevant). */
export function compose(g: GraphState, intent: Intent, focus: string | null, rel: Record<string, number>, threshold = 0.5): Answer {
  const hyps = Object.values(g.hypotheses);
  // Hypotheses selected by relevance, plus the focus; experiments only when they add something new.
  let selected = hyps.filter((h) => (rel[h.id] ?? 0) >= threshold || h.id === focus);
  if (intent === "what_worked")
    selected = [...selected].sort((a, b) => bestGain(b, g) - bestGain(a, g));
  else if (intent === "what_failed" || intent === "why_stopped")
    selected = [...selected].sort((a, b) => Number(b.status === "refuted" || b.status === "abandoned") - Number(a.status === "refuted" || a.status === "abandoned") || (rel[b.id] ?? 0) - (rel[a.id] ?? 0));
  else selected = [...selected].sort((a, b) => (b.id === focus ? 1 : 0) - (a.id === focus ? 1 : 0) || (rel[b.id] ?? 0) - (rel[a.id] ?? 0));
  selected = selected.slice(0, 5);
  const covered = new Set(selected.flatMap((h) => h.tests));
  const exps = g.experiments.filter((e) => (rel[e.id] ?? 0) >= threshold && !covered.has(e.id)).slice(0, 3);

  const items = [...selected.map((h) => hypItem(h, g, rel[h.id] ?? 1)), ...exps.map((e) => expItem(e, rel[e.id] ?? 0))];
  const cited = [...new Set([...items.map((i) => i.id), ...selected.flatMap((h) => h.tests)])];
  return { lead: lead(g, intent, selected, exps), items, cited, intent, focus };
}

function bestGain(h: HypothesisNode, g: GraphState): number {
  return Math.max(0, ...h.tests.map((id) => g.experiments.find((e) => e.id === id)?.relChange ?? 0));
}

function lead(g: GraphState, intent: Intent, hs: HypothesisNode[], es: ExperimentNode[]): string {
  if (!hs.length && !es.length) return "Nothing in the recorded beliefs answers that yet.";
  const refuted = hs.filter((h) => h.status === "refuted" || h.status === "abandoned");
  switch (intent) {
    case "why_stopped":
      return refuted.length
        ? `The agent dropped ${refuted.map((h) => h.id).join(", ")} because the harness measured no improvement: its predictions didn't hold.`
        : `None of the relevant ideas were dropped; ${hs.map((h) => h.id).join(", ")} are still ${hs.map((h) => h.status).join("/")}.`;
    case "belief_about": {
      const top = [...hs].sort((a, b) => b.confidence - a.confidence)[0];
      return `Strongest belief here: ${top.id} at ${pct(top.confidence)} (${top.status}). ${hs.length > 1 ? `${hs.length} related hypotheses below.` : ""}`;
    }
    case "what_worked": {
      const wins = hs.filter((h) => bestGain(h, g) > 0.01);
      return wins.length
        ? `${wins.length} idea${wins.length > 1 ? "s" : ""} moved the metric; biggest: ${wins[0].id} (−${(bestGain(wins[0], g) * 100).toFixed(1)}% read_rows in one step).`
        : "None of the relevant ideas reduced read_rows meaningfully.";
    }
    case "what_failed":
      return `${refuted.length} refuted or abandoned, ${es.filter((e) => e.outcome !== "kept").length} other failed or discarded experiments among the evidence.`;
    case "calibration":
      return `Run-level Brier score ${g.calibration.brier?.toFixed(2) ?? "n/a"} over ${g.calibration.n} first tests (0 = perfect).`;
    case "evidence_for":
      return `Evidence for ${hs.map((h) => h.id).concat(es.map((e) => e.id)).join(", ")}, as measured by the harness.`;
    default:
      return `Best read_rows ${rows(g.metric.best)} vs baseline ${rows(g.metric.baseline)} after ${g.experiments.length} experiments and ${Object.keys(g.hypotheses).length} hypotheses.`;
  }
}

/** Plain text for an LLM rewrite or copy/paste. */
export function answerText(a: Answer): string {
  return [a.lead, ...a.items.map((i) => `[${i.id}] ${i.lines.join(" ")}`)].join("\n");
}
