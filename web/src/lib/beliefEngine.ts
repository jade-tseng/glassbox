// Belief engine (PLAN §4.6): a pure function over the event log. Numbers are deterministic; nothing here
// asks a model. Runs on the client so the scrubber is instant.
//
//   buildGraph(events, upToSeq) -> GraphState

export type Direction = "decrease" | "increase" | "no_change";
export type HypStatus = "untested" | "open" | "confirmed" | "refuted" | "abandoned";
export type EvidenceKind = "supports" | "refutes" | "weak" | "invalid";
export type Relation = "contradicts" | "depends_on" | "refines";

// Loose event shape (see glassbox/events.py and PLAN §4.5).
export type GbEvent = {
  run_id: string;
  seq: number;
  t: number;
  type: string;
  source: "mcp" | "hook" | "system";
  [key: string]: unknown;
};

export type HypothesisNode = {
  id: string;
  topic: string;
  claim: string;
  reason: string;
  prediction: { direction: Direction; confidence: number };
  codeRegion: { file: string; symbol: string };
  status: HypStatus;
  summary?: string;
  alpha: number;
  beta: number;
  confidence: number; // posterior mean α/(α+β)
  history: { seq: number; t: number; confidence: number }[];
  tests: string[]; // experiment ids
  proposedSeq: number;
};

export type ExperimentNode = {
  id: string;
  seq: number;
  t: number;
  hypothesisIds: string[];
  outcome: "kept" | "discarded" | "invalid";
  correct: boolean;
  errorKind?: string;
  errorMessage?: string;
  metricBefore: number | null;
  metricAfter: number | null;
  relChange: number | null; // (before - after) / before; positive = fewer rows read
  observed: Direction | null;
  beatsBest: boolean;
  agentKept: boolean | null; // from record_result
  note?: string;
  disagreement: boolean; // agent's "kept" vs harness "beats best"
  filesChanged: string[];
  diff: string;
  perQuery: Record<string, { read_rows: number | null; latency_ms: number | null; correct?: boolean }>;
};

export type EvidenceEdge = { experiment: string; hypothesis: string; kind: EvidenceKind; weight: number };
export type LinkEdge = { from: string; to: string; relation: Relation; reason: string; seq: number };

export type TopicNode = {
  name: string;
  hypothesisIds: string[];
  stance: string | null; // id of strongest surviving hypothesis
  refuted: number;
  brier: number | null; // calibration: mean (confidence - outcome)^2 over first tests
};

export type GraphState = {
  runId: string | null;
  seq: number; // last event included
  maxSeq: number;
  t: number;
  topics: TopicNode[];
  hypotheses: Record<string, HypothesisNode>;
  experiments: ExperimentNode[];
  evidence: EvidenceEdge[];
  links: LinkEdge[];
  gateBlocks: { seq: number; t: number; kind: string; detail: string }[];
  actions: { seq: number; t: number; tool: string; target: string }[];
  messages: { seq: number; t: number; text: string }[];
  metric: {
    baseline: number | null;
    best: number | null;
    series: { seq: number; t: number; experiment: string; after: number | null; best: number | null; outcome: ExperimentNode["outcome"] }[];
  };
  calibration: { brier: number | null; n: number };
  finished: boolean;
};

const PRIOR_STRENGTH = 4; // pseudo-observations behind the agent's stated confidence
const WEAK_THRESHOLD = 0.01; // |relative change| below 1% is weak evidence

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

function observedDirection(rel: number | null): Direction | null {
  if (rel === null) return null;
  if (rel > WEAK_THRESHOLD) return "decrease";
  if (rel < -WEAK_THRESHOLD) return "increase";
  return "no_change";
}

export function buildGraph(events: GbEvent[], upToSeq: number = Number.POSITIVE_INFINITY): GraphState {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const maxSeq = sorted.length ? sorted[sorted.length - 1].seq : 0;
  const state: GraphState = {
    runId: sorted[0]?.run_id ?? null,
    seq: 0,
    maxSeq,
    t: 0,
    topics: [],
    hypotheses: {},
    experiments: [],
    evidence: [],
    links: [],
    gateBlocks: [],
    actions: [],
    messages: [],
    metric: { baseline: null, best: null, series: [] },
    calibration: { brier: null, n: 0 },
    finished: false,
  };
  const expById = new Map<string, ExperimentNode>();
  const firstTestScored = new Set<string>();
  const brierByTopic = new Map<string, number[]>();

  for (const ev of sorted) {
    if (ev.seq > upToSeq) break;
    state.seq = ev.seq;
    state.t = ev.t;

    switch (ev.type) {
      case "run_started": {
        const base = num((ev.baseline as { total_read_rows?: number } | undefined)?.total_read_rows);
        state.metric.baseline = base;
        state.metric.best = base;
        break;
      }
      case "hypothesis_proposed": {
        const id = str(ev.id);
        const pred = (ev.prediction ?? {}) as { direction?: Direction; confidence?: number };
        const c = Math.min(0.99, Math.max(0.01, num(pred.confidence) ?? 0.5));
        const existing = state.hypotheses[id];
        if (existing) {
          // Re-test: keep accumulated evidence; refresh the stated prediction text.
          existing.status = existing.tests.length ? "open" : "untested";
          break;
        }
        const h: HypothesisNode = {
          id,
          topic: str(ev.topic, "misc"),
          claim: str(ev.claim),
          reason: str(ev.reason),
          prediction: { direction: (pred.direction ?? "decrease") as Direction, confidence: c },
          codeRegion: (ev.code_region as { file: string; symbol: string }) ?? { file: "", symbol: "" },
          status: "untested",
          alpha: c * PRIOR_STRENGTH,
          beta: (1 - c) * PRIOR_STRENGTH,
          confidence: c,
          history: [{ seq: ev.seq, t: ev.t, confidence: c }],
          tests: [],
          proposedSeq: ev.seq,
        };
        state.hypotheses[id] = h;
        let topic = state.topics.find((tp) => tp.name === h.topic);
        if (!topic) {
          topic = { name: h.topic, hypothesisIds: [], stance: null, refuted: 0, brier: null };
          state.topics.push(topic);
        }
        topic.hypothesisIds.push(id);
        break;
      }
      case "experiment_run":
      case "experiment_failed": {
        const correct = ev.type === "experiment_run" && ev.correct !== false;
        const before = num(ev.metric_before);
        const after = num(ev.metric_after);
        const rel = correct && before && after !== null ? (before - after) / before : null;
        const observed = correct ? observedDirection(rel) : null;
        const exp: ExperimentNode = {
          id: str(ev.id),
          seq: ev.seq,
          t: ev.t,
          hypothesisIds: (ev.hypothesis_ids as string[]) ?? [],
          outcome: !correct ? "invalid" : ev.beats_best ? "kept" : "discarded",
          correct,
          errorKind: correct ? undefined : str(ev.error_kind, "unknown"),
          errorMessage: correct ? undefined : str(ev.message),
          metricBefore: before,
          metricAfter: after,
          relChange: rel,
          observed,
          beatsBest: Boolean(ev.beats_best),
          agentKept: null,
          disagreement: false,
          filesChanged: (ev.files_changed as string[]) ?? [],
          diff: str(ev.diff),
          perQuery: (ev.per_query as ExperimentNode["perQuery"]) ?? {},
        };
        state.experiments.push(exp);
        expById.set(exp.id, exp);
        if (correct && after !== null && (state.metric.best === null || after < state.metric.best)) {
          state.metric.best = after;
        }
        state.metric.series.push({ seq: ev.seq, t: ev.t, experiment: exp.id, after, best: state.metric.best, outcome: exp.outcome });

        for (const hid of exp.hypothesisIds) {
          const h = state.hypotheses[hid];
          if (!h) continue;
          h.tests.push(exp.id);
          if (h.status === "untested") h.status = "open";
          let kind: EvidenceKind;
          let weight = 0;
          if (!correct || observed === null || rel === null) {
            kind = "invalid";
          } else if (Math.abs(rel) < WEAK_THRESHOLD && h.prediction.direction !== "no_change") {
            kind = "weak";
            weight = 0.25;
            h.beta += weight; // a predicted effect that didn't show up nudges belief down
          } else {
            weight = Math.min(1, 0.4 + Math.abs(rel) * 3);
            kind = observed === h.prediction.direction ? "supports" : "refutes";
            if (kind === "supports") h.alpha += 1 + 2 * weight;
            else h.beta += 1 + 2 * weight;
          }
          state.evidence.push({ experiment: exp.id, hypothesis: hid, kind, weight });
          h.confidence = h.alpha / (h.alpha + h.beta);
          h.history.push({ seq: ev.seq, t: ev.t, confidence: h.confidence });

          if (!firstTestScored.has(hid) && (kind === "supports" || kind === "refutes" || kind === "weak")) {
            firstTestScored.add(hid);
            const outcome = kind === "supports" ? 1 : 0;
            const b = (h.prediction.confidence - outcome) ** 2;
            brierByTopic.set(h.topic, [...(brierByTopic.get(h.topic) ?? []), b]);
          }
        }
        break;
      }
      case "experiment_interpreted": {
        const exp = expById.get(str(ev.experiment_id));
        if (exp) {
          exp.agentKept = Boolean(ev.kept);
          exp.note = str(ev.note);
          exp.disagreement = exp.correct ? exp.agentKept !== exp.beatsBest : exp.agentKept;
        }
        break;
      }
      case "hypothesis_linked":
        state.links.push({
          from: str(ev.from),
          to: str(ev.to),
          relation: str(ev.relation) as Relation,
          reason: str(ev.reason),
          seq: ev.seq,
        });
        break;
      case "hypothesis_closed": {
        const h = state.hypotheses[str(ev.id)];
        if (h) {
          h.status = str(ev.status) as HypStatus;
          h.summary = str(ev.summary);
        }
        break;
      }
      case "gate_blocked":
        state.gateBlocks.push({
          seq: ev.seq,
          t: ev.t,
          kind: str(ev.kind),
          detail: str(ev.command) || str(ev.file),
        });
        break;
      case "agent_action":
        state.actions.push({ seq: ev.seq, t: ev.t, tool: str(ev.tool), target: str(ev.target) });
        break;
      case "agent_message":
        state.messages.push({ seq: ev.seq, t: ev.t, text: str(ev.text) });
        break;
      case "run_finished":
        state.finished = true;
        break;
    }
  }

  // Topic stance + calibration.
  const allBrier: number[] = [];
  for (const topic of state.topics) {
    const hs = topic.hypothesisIds.map((id) => state.hypotheses[id]);
    topic.refuted = hs.filter((h) => h.status === "refuted").length;
    const surviving = hs.filter((h) => h.status !== "refuted" && h.status !== "abandoned" && h.tests.length > 0);
    surviving.sort((a, b) => b.confidence - a.confidence);
    topic.stance = surviving[0]?.id ?? null;
    const scores = brierByTopic.get(topic.name) ?? [];
    topic.brier = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : null;
    allBrier.push(...scores);
  }
  state.calibration = {
    brier: allBrier.length ? allBrier.reduce((s, x) => s + x, 0) / allBrier.length : null,
    n: allBrier.length,
  };
  return state;
}

/** Compact, ID-rich serialization for the NL query (PLAN §4.8). */
export function serializeForQuery(g: GraphState): string {
  const lines: string[] = [];
  lines.push(`Run ${g.runId} at seq ${g.seq}. Metric total read_rows: baseline ${g.metric.baseline}, best ${g.metric.best}.`);
  for (const topic of g.topics) {
    lines.push(`\nTOPIC "${topic.name}" (stance: ${topic.stance ?? "none"}, refuted: ${topic.refuted})`);
    for (const id of topic.hypothesisIds) {
      const h = g.hypotheses[id];
      lines.push(
        `[${h.id}] ${h.status} conf=${h.confidence.toFixed(2)} (prior ${h.prediction.confidence.toFixed(2)}, predicted ${h.prediction.direction}) ` +
          `region=${h.codeRegion.file}:${h.codeRegion.symbol}\n  claim: ${h.claim}\n  reason: ${h.reason}` +
          (h.summary ? `\n  closing summary: ${h.summary}` : ""),
      );
    }
  }
  lines.push("\nEXPERIMENTS");
  for (const e of g.experiments) {
    const delta = e.metricBefore !== null && e.metricAfter !== null ? `${e.metricBefore} -> ${e.metricAfter}` : "n/a";
    lines.push(
      `[${e.id}] tests ${e.hypothesisIds.join(",") || "-"}; ${e.outcome}${e.errorKind ? ` (${e.errorKind}: ${e.errorMessage?.slice(0, 160)})` : ""}; ` +
        `read_rows ${delta}; files ${e.filesChanged.join(",")}${e.note ? `; agent note: ${e.note}` : ""}` +
        (e.disagreement ? "; NOTE agent 'kept' disagrees with harness" : ""),
    );
  }
  if (g.links.length) {
    lines.push("\nLINKS");
    for (const l of g.links) lines.push(`${l.from} ${l.relation} ${l.to}: ${l.reason}`);
  }
  if (g.gateBlocks.length) lines.push(`\nGATE BLOCKS: ${g.gateBlocks.length} (agent tried to benchmark without a hypothesis)`);
  return lines.join("\n");
}
