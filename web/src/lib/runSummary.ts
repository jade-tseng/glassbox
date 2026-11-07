// One row per run for the tracker (/run). Deterministic, computed from the same belief graph as the run view.
// Signals (PLAN §1b) are the "can I trust this run / this environment?" flags an RL-environment builder wants:
// unverified results, client-reported numbers, shortcuts the verifier caught, gains no hypothesis predicted,
// tasks where nothing gets confirmed, and agent-vs-harness disagreements.

import type { GraphState } from "./beliefEngine";

export type Signal = {
  kind: "unverified" | "client_reported" | "verifier_caught" | "unexplained_gain" | "nothing_confirmed" | "disagreement" | "gate_blocked";
  level: "info" | "warn" | "alert";
  label: string;
  detail: string;
  refs: string[]; // node ids to jump to
};

export type RunSummary = {
  runId: string;
  status: string; // running | finished | interrupted | error | ...
  task: string;
  agent: string;
  provider: string;
  model: string;
  metric: { label: string; unit: string; direction: "lower" | "higher" };
  verify: string; // short description of the correctness check
  baseline: number | null;
  best: number | null;
  improvement: number | null; // fraction, positive = better
  experiments: { total: number; kept: number; discarded: number; invalid: number };
  hypotheses: { total: number; confirmed: number; refuted: number; abandoned: number; open: number };
  links: number;
  gateBlocks: number;
  brier: number | null;
  durationS: number;
  startedAt: number | null;
  curve: { i: number; improvement: number }[]; // best-so-far improvement after each experiment
  signals: Signal[];
};

const UNEXPLAINED_GAIN = 0.15; // a ≥15% improvement the tested hypotheses didn't predict

export function summarize(g: GraphState, meta: { status?: string; started_at?: number } = {}): RunSummary {
  const lower = g.task.metric.direction !== "higher";
  const base = g.metric.baseline;
  const gain = (b: number, v: number) => (b === 0 ? 0 : (lower ? b - v : v - b) / Math.abs(b));
  const exps = g.experiments;
  const hs = Object.values(g.hypotheses);

  const curve: RunSummary["curve"] = [];
  let best = base;
  exps.forEach((e, i) => {
    if (e.correct && e.metricAfter !== null && (best === null || (lower ? e.metricAfter < best : e.metricAfter > best))) best = e.metricAfter;
    curve.push({ i: i + 1, improvement: base !== null && best !== null ? gain(base, best) : 0 });
  });

  const v = g.task.verify;
  const verify = !v
    ? "unknown"
    : v.mode === "none"
      ? "none"
      : v.description ?? (v.mode === "test_command" ? `tests: ${v.command}` : v.mode === "json_flag" ? `flag "${v.key}"` : v.mode === "same_output" ? "output unchanged" : v.mode);

  const signals: Signal[] = [];
  if (v?.mode === "none") {
    signals.push({ kind: "unverified", level: "alert", label: "no correctness check", detail: "Improvements are unverified: nothing checks the results are still correct.", refs: [] });
  }
  const client = exps.filter((e) => e.measuredBy === "client");
  if (client.length) {
    signals.push({ kind: "client_reported", level: "warn", label: "client-reported", detail: `${client.length} of ${exps.length} measurements came from the client, not a Glassbox verifier.`, refs: [] });
  } else if (!v && exps.length) {
    signals.push({ kind: "unverified", level: "warn", label: "check unknown", detail: "The run didn't declare how correctness is verified.", refs: [] });
  }
  const invalid = exps.filter((e) => e.outcome === "invalid");
  const caught = invalid.filter((e) => e.errorKind === "incorrect_result");
  if (caught.length) {
    signals.push({ kind: "verifier_caught", level: "alert", label: `verifier caught ${caught.length}`, detail: `Faster/better but wrong: ${caught.map((e) => e.id).join(", ")} produced incorrect results.`, refs: caught.map((e) => e.id) });
  }
  // Big kept gains that none of the armed hypotheses predicted (or no hypothesis at all).
  const unexplained = exps.filter((e) => {
    if (e.outcome !== "kept" || e.relChange === null || e.relChange < UNEXPLAINED_GAIN) return false;
    const preds = e.hypothesisIds.map((id) => g.hypotheses[id]).filter(Boolean);
    if (!preds.length) return true;
    const predicted = e.observed;
    return !preds.some((h) => h.prediction.direction === predicted);
  });
  if (unexplained.length) {
    signals.push({ kind: "unexplained_gain", level: "alert", label: `unexplained gain ×${unexplained.length}`, detail: `Large improvements no tested hypothesis predicted: ${unexplained.map((e) => `${e.id} (${Math.round((e.relChange ?? 0) * 100)}%)`).join(", ")}. Check the diff.`, refs: unexplained.map((e) => e.id) });
  }
  const confirmed = hs.filter((h) => h.status === "confirmed").length;
  const tested = hs.filter((h) => h.tests.length).length;
  if (tested >= 3 && confirmed === 0 && !hs.some((h) => h.status === "open" && h.confidence > 0.6)) {
    signals.push({ kind: "nothing_confirmed", level: "warn", label: "nothing confirmed", detail: `${tested} hypotheses tested, none confirmed: the task may be too hard, broken, or the metric noisy.`, refs: [] });
  }
  const disagree = exps.filter((e) => e.disagreement);
  if (disagree.length) {
    signals.push({ kind: "disagreement", level: "info", label: `agent ≠ harness ×${disagree.length}`, detail: `The agent's keep decision disagreed with the harness on ${disagree.map((e) => e.id).join(", ")}.`, refs: disagree.map((e) => e.id) });
  }
  if (g.gateBlocks.length) {
    signals.push({ kind: "gate_blocked", level: "info", label: `gate ×${g.gateBlocks.length}`, detail: "The agent tried to measure without stating a hypothesis.", refs: [] });
  }

  return {
    runId: g.runId ?? "",
    status: meta.status ?? (g.finished ? "finished" : "running"),
    task: g.task.name,
    agent: g.task.agent,
    provider: g.task.provider,
    model: g.task.model,
    metric: { label: g.task.metric.label, unit: g.task.metric.unit, direction: g.task.metric.direction },
    verify,
    baseline: base,
    best: g.metric.best,
    improvement: base !== null && g.metric.best !== null ? gain(base, g.metric.best) : null,
    experiments: {
      total: exps.length,
      kept: exps.filter((e) => e.outcome === "kept").length,
      discarded: exps.filter((e) => e.outcome === "discarded").length,
      invalid: invalid.length,
    },
    hypotheses: {
      total: hs.length,
      confirmed,
      refuted: hs.filter((h) => h.status === "refuted").length,
      abandoned: hs.filter((h) => h.status === "abandoned").length,
      open: hs.filter((h) => h.status === "open" || h.status === "untested").length,
    },
    links: g.links.length,
    gateBlocks: g.gateBlocks.length,
    brier: g.calibration.brier,
    durationS: g.t,
    startedAt: meta.started_at ?? null,
    curve,
    signals,
  };
}
