// Code heatmap model (PLAN §4.7). Pure function over a (scrubber-scoped) GraphState. Target-agnostic:
// files come from the run's declared editable files and the diffs; regions from the agent's code_region;
// "impact" = metric improvement from KEPT experiments (respecting whether lower or higher is better).

import type { GraphState } from "./beliefEngine";

export type RegionHeat = {
  key: string;
  file: string;
  symbol: string;
  touches: number;
  kept: number;
  impact: number;
  hypotheses: string[];
};

export type ComponentHeat = { name: string; baseline: number; current: number; movedBy: { experiment: string; improvement: number }[] };

export type FileHeat = {
  file: string;
  touches: number;
  kept: number;
  impact: number;
  experiments: string[];
  regions: RegionHeat[];
  component: ComponentHeat | null; // breakdown component that maps to this file, if the target says so
};

export type Heatmap = {
  files: FileHeat[];
  unmappedComponents: ComponentHeat[]; // breakdown components with no file of their own
  maxImpact: number;
  totalImprovement: number;
};

const clean = (f: string) => (f || "").trim().replace(/^\.\//, "");
const normSymbol = (s: string) => (s || "unspecified").trim().replace(/\s+/g, " ");

export function buildHeatmap(g: GraphState): Heatmap {
  const lowerIsBetter = g.task.metric.direction !== "higher";
  const improvement = (before: number, after: number) => Math.max(0, lowerIsBetter ? before - after : after - before);

  const files = new Map<string, FileHeat>();
  const ensure = (file: string): FileHeat => {
    let f = files.get(file);
    if (!f) {
      f = { file, touches: 0, kept: 0, impact: 0, experiments: [], regions: [], component: null };
      files.set(file, f);
    }
    return f;
  };
  // Resolve an agent-written file reference against the known files (suffix match), else keep as written.
  const resolve = (raw: string): string => {
    const f = clean(raw);
    if (!f) return "(unspecified)";
    const known = [...new Set([...g.files, ...files.keys()])];
    return known.find((k) => k === f || k.endsWith(`/${f}`) || f.endsWith(`/${k}`) || f.endsWith(k)) ?? f;
  };
  g.files.forEach(ensure);

  // Breakdown components (e.g. per-query values), optionally mapped to files by the target's file_pattern.
  const components = new Map<string, ComponentHeat>();
  const pattern = g.task.breakdown?.file_pattern;
  for (const [name, base] of Object.entries(g.metric.baselineBreakdown)) {
    const c: ComponentHeat = { name, baseline: base, current: base, movedBy: [] };
    components.set(name, c);
    if (pattern) ensure(resolve(pattern.replace("{name}", name))).component = c;
  }

  const regions = new Map<string, RegionHeat>();
  for (const e of g.experiments) {
    const kept = e.outcome === "kept" && e.metricBefore !== null && e.metricAfter !== null;
    const gain = kept ? improvement(e.metricBefore!, e.metricAfter!) : 0;
    const changed = e.filesChanged.map(resolve);
    for (const file of changed) {
      const f = ensure(file);
      f.touches += 1;
      f.experiments.push(e.id);
      if (e.outcome === "kept") {
        f.kept += 1;
        f.impact += gain / changed.length;
      }
    }
    const hs = e.hypothesisIds.map((id) => g.hypotheses[id]).filter(Boolean);
    for (const h of hs) {
      const file = resolve(h.codeRegion.file);
      const symbol = normSymbol(h.codeRegion.symbol);
      const key = `${file}::${symbol.toLowerCase()}`;
      let r = regions.get(key);
      if (!r) {
        r = { key, file, symbol, touches: 0, kept: 0, impact: 0, hypotheses: [] };
        regions.set(key, r);
      }
      r.touches += 1;
      if (!r.hypotheses.includes(h.id)) r.hypotheses.push(h.id);
      if (e.outcome === "kept") {
        r.kept += 1;
        r.impact += gain / hs.length;
      }
    }
    if (e.outcome === "kept") {
      for (const [name, v] of Object.entries(e.breakdown ?? {})) {
        const c = components.get(name);
        if (!c || v === null || v === undefined) continue;
        const d = lowerIsBetter ? c.current - v : v - c.current;
        if (d !== 0) c.movedBy.push({ experiment: e.id, improvement: d });
        c.current = v;
      }
    }
  }

  // Hypotheses never evaluated still mark their region.
  for (const h of Object.values(g.hypotheses)) {
    if (h.tests.length) continue;
    const file = resolve(h.codeRegion.file);
    const symbol = normSymbol(h.codeRegion.symbol);
    const key = `${file}::${symbol.toLowerCase()}`;
    const r = regions.get(key) ?? { key, file, symbol, touches: 0, kept: 0, impact: 0, hypotheses: [] };
    if (!r.hypotheses.includes(h.id)) r.hypotheses.push(h.id);
    regions.set(key, r);
  }
  for (const r of regions.values()) ensure(r.file).regions.push(r);
  for (const f of files.values()) f.regions.sort((a, b) => b.impact - a.impact || b.touches - a.touches);

  const list = [...files.values()].sort((a, b) => b.impact - a.impact || b.touches - a.touches || a.file.localeCompare(b.file));
  const mapped = new Set(list.map((f) => f.component?.name).filter(Boolean));
  const maxImpact = Math.max(1e-9, ...list.map((f) => f.impact), ...[...regions.values()].map((r) => r.impact));
  const base = g.metric.baseline;
  const best = g.metric.best;
  return {
    files: list,
    unmappedComponents: [...components.values()].filter((c) => !mapped.has(c.name)),
    maxImpact,
    totalImprovement: base !== null && best !== null ? improvement(base, best) : 0,
  };
}
