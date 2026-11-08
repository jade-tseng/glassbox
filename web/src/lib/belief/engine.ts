// View-model types for the landing-page belief components + an adapter over the shared engine.
import { buildGraph as coreBuildGraph, type GbEvent } from "@/lib/beliefEngine";

export type Direction = "decrease" | "increase";

export type RunEvent =
  | { seq: number; t: number; type: "run_started"; target?: string; model?: string }
  | {
      seq: number;
      t: number;
      type: "hypothesis_proposed";
      id: string;
      claim: string;
      topic: string;
      reason: string;
      prediction: { direction: Direction; confidence: number };
      code_region?: { file?: string; symbol?: string };
      retest?: boolean;
    }
  | { seq: number; t: number; type: "hypothesis_linked"; from: string; to: string; relation: LinkRelation; reason?: string }
  | {
      seq: number;
      t: number;
      type: "experiment_run";
      id: string;
      hypothesis_ids: string[];
      metric_before: number;
      metric_after: number;
      correct: boolean;
      beats_best: boolean;
      files_changed?: string[];
    }
  | { seq: number; t: number; type: "experiment_failed"; id: string; hypothesis_ids: string[]; error_kind: string }
  | { seq: number; t: number; type: "experiment_interpreted"; experiment_id: string; hypothesis_ids: string[]; kept: boolean; note: string }
  | { seq: number; t: number; type: "hypothesis_closed"; id: string; status: "confirmed" | "refuted" | "abandoned"; summary: string }
  | { seq: number; t: number; type: "gate_blocked"; tool?: string; command?: string; summary?: string }
  | { seq: number; t: number; type: "agent_action"; tool?: string; target?: string }
  | { seq: number; t: number; type: "run_finished"; best_read_rows?: number; baseline?: number };

export type LinkRelation = "contradicts" | "depends_on" | "refines";
export type HypStatus = "open" | "confirmed" | "refuted" | "abandoned";
export type EvidenceKind = "supports" | "refutes" | "weak" | "invalid";

export type Experiment = {
  id: string;
  seq: number;
  t: number;
  hypothesisIds: string[];
  before: number;
  after: number | null; // null when the run failed
  correct: boolean;
  failed: boolean;
  errorKind?: string;
  beatsBest: boolean;
  kept: boolean | null; // agent's interpretation, once recorded
  note?: string;
  evidence: EvidenceKind;
  files: string[];
};

export type Hypothesis = {
  id: string;
  seq: number;
  t: number;
  claim: string;
  topic: string;
  reason: string;
  symbol: string;
  file: string;
  prior: number; // latest stated prediction confidence
  firstPrior: number;
  direction: Direction;
  alpha: number;
  beta: number;
  belief: number; // displayed posterior (0 once refuted/abandoned)
  status: HypStatus;
  summary?: string;
  experiments: string[];
  history: { seq: number; t: number; belief: number }[];
};

export type GraphState = {
  seq: number;
  t: number;
  topics: string[]; // in order of first appearance
  hypotheses: Record<string, Hypothesis>;
  order: string[]; // hypothesis ids in proposal order
  experiments: Record<string, Experiment>;
  expOrder: string[];
  links: { from: string; to: string; relation: LinkRelation }[];
  gateBlocks: { seq: number; t: number }[];
  actions: { seq: number; t: number; tool?: string }[];
  baseline: number;
  best: number;
  newest: string | null; // id of the node the latest event touched
};

/**
 * View model for the landing-page belief components, derived from the shared engine
 * (`lib/beliefEngine.ts`, the same math the /run view uses). One implementation of the belief math.
 */
export function buildGraph(events: RunEvent[], upToSeq = Infinity): GraphState {
  const g = coreBuildGraph(events as unknown as GbEvent[], upToSeq);
  const s: GraphState = {
    seq: g.seq,
    t: g.t,
    topics: g.topics.map((t) => t.name),
    hypotheses: {},
    order: [],
    experiments: {},
    expOrder: [],
    links: g.links.map((l) => ({ from: l.from, to: l.to, relation: l.relation })),
    gateBlocks: g.gateBlocks.map((b) => ({ seq: b.seq, t: b.t })),
    actions: g.actions.map((a) => ({ seq: a.seq, t: a.t, tool: a.tool })),
    baseline: g.metric.baseline ?? 20_000_000,
    best: g.metric.best ?? g.metric.baseline ?? 20_000_000,
    newest: null,
  };
  const evidenceOf = new Map<string, EvidenceKind>();
  for (const e of g.evidence) evidenceOf.set(e.experiment, e.kind);

  let best = s.baseline;
  for (const x of [...g.experiments].sort((a, b) => a.seq - b.seq)) {
    const failed = x.outcome === "invalid" && !!x.errorKind;
    s.experiments[x.id] = {
      id: x.id,
      seq: x.seq,
      t: x.t,
      hypothesisIds: x.hypothesisIds,
      before: x.metricBefore ?? best,
      after: failed ? null : x.metricAfter,
      correct: x.correct,
      failed,
      errorKind: x.errorKind,
      beatsBest: x.beatsBest,
      kept: x.agentKept,
      note: x.note,
      evidence: evidenceOf.get(x.id) ?? "invalid",
      files: x.filesChanged ?? [],
    };
    s.expOrder.push(x.id);
    if (x.correct && x.metricAfter !== null) best = Math.min(best, x.metricAfter);
  }

  const hyps = Object.values(g.hypotheses).sort((a, b) => a.proposedSeq - b.proposedSeq);
  for (const h of hyps) {
    const dead = h.status === "refuted" || h.status === "abandoned";
    const history = h.history.map((p) => ({ seq: p.seq, t: p.t, belief: p.confidence }));
    if (dead && history.length) history.push({ ...history[history.length - 1], belief: 0 });
    s.hypotheses[h.id] = {
      id: h.id,
      seq: h.proposedSeq,
      t: h.history[0]?.t ?? 0,
      claim: h.claim,
      topic: h.topic,
      reason: h.reason,
      symbol: h.codeRegion.symbol,
      file: h.codeRegion.file,
      prior: h.prediction.confidence,
      firstPrior: h.history[0]?.confidence ?? h.prediction.confidence,
      direction: h.prediction.direction === "increase" ? "increase" : "decrease",
      alpha: h.alpha,
      beta: h.beta,
      belief: dead ? 0 : h.confidence,
      status: h.status === "untested" ? "open" : h.status,
      summary: h.summary,
      experiments: h.tests,
      history,
    };
    s.order.push(h.id);
  }

  // The node the latest belief-relevant event touched (drives the lime flash and the inspector).
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i] as { seq: number; type: string; id?: string };
    if (ev.seq > upToSeq) continue;
    if (ev.type === "hypothesis_proposed" || ev.type === "hypothesis_closed" || ev.type === "experiment_run" || ev.type === "experiment_failed") {
      s.newest = ev.id ?? null;
      break;
    }
  }
  return s;
}

/** Hypotheses that touched the same code region (e.g. both edit `PROJECTION p_src`). */
export function sameRegionPairs(hyps: Hypothesis[]) {
  const key = (h: Hypothesis): string[] => {
    const m = h.symbol.match(/\bp_[a-z_]+/g);
    return m ? m : [];
  };
  const pairs: [string, string][] = [];
  for (let i = 0; i < hyps.length; i++) {
    for (let j = i + 1; j < hyps.length; j++) {
      const a = key(hyps[i]);
      const b = key(hyps[j]);
      if (a.some((x) => b.includes(x))) pairs.push([hyps[i].id, hyps[j].id]);
    }
  }
  return pairs;
}

export function fmtRows(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}

/** Best correct read_rows after each experiment, in experiment order. */
export function bestSoFar(s: GraphState): number[] {
  const out: number[] = [];
  let best = s.baseline;
  for (const id of s.expOrder) {
    const e = s.experiments[id];
    if (e.after !== null && e.correct) best = Math.min(best, e.after);
    out.push(best);
  }
  return out;
}

/** "Claimed, not shown": the agent closed it as confirmed, but the measurements don't back it. */
export function isTension(h: Hypothesis, exps: Record<string, Experiment>) {
  if (h.status !== "confirmed") return false;
  const supported = h.experiments.some((e) => exps[e]?.evidence === "supports");
  return h.belief < 0.5 || !supported;
}

/** Belief of a hypothesis at time t (last recorded point at or before t). */
export function beliefAt(h: Hypothesis, t: number) {
  let b = h.history[0]?.belief ?? h.prior;
  for (const p of h.history) {
    if (p.t <= t) b = p.belief;
    else break;
  }
  return b;
}
