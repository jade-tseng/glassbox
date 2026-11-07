// Code heatmap model (PLAN §4.7). Pure function over a (scrubber-scoped) GraphState.
// - touches: experiments whose diff changed the file / tested a hypothesis aimed at the region
// - impact:  read_rows saved by KEPT experiments (before - after), split evenly across the files (or
//            hypotheses) involved
// - queries: per-query read_rows baseline -> current best, and which kept experiments moved each query

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

export type FileHeat = {
  file: string;
  touches: number;
  kept: number;
  impact: number;
  experiments: string[];
  regions: RegionHeat[];
  query: { name: string; baseline: number; current: number; movedBy: { experiment: string; saved: number }[] } | null;
};

export type Heatmap = { files: FileHeat[]; maxImpact: number; totalSaved: number };

const normFile = (f: string) => {
  const s = (f || "").trim().replace(/^\.\//, "");
  if (!s) return "schema.sql";
  if (s.endsWith("schema.sql")) return "schema.sql";
  const m = s.match(/(q\d+[\w-]*)\.sql$/);
  return m ? `queries/${m[1]}.sql` : s;
};
const normSymbol = (s: string) => (s || "unspecified").trim().replace(/\s+/g, " ");

export function buildHeatmap(g: GraphState): Heatmap {
  const files = new Map<string, FileHeat>();
  const ensure = (file: string): FileHeat => {
    let f = files.get(file);
    if (!f) {
      f = { file, touches: 0, kept: 0, impact: 0, experiments: [], regions: [], query: null };
      files.set(file, f);
    }
    return f;
  };
  ensure("schema.sql");
  const basePQ = g.metric.baselinePerQuery;
  for (const q of Object.keys(basePQ).sort()) {
    ensure(`queries/${q}.sql`).query = { name: q, baseline: basePQ[q], current: basePQ[q], movedBy: [] };
  }

  const regions = new Map<string, RegionHeat>();
  const current: Record<string, number> = { ...basePQ };

  for (const e of g.experiments) {
    const saved = e.outcome === "kept" && e.metricBefore !== null && e.metricAfter !== null ? Math.max(0, e.metricBefore - e.metricAfter) : 0;
    const changed = e.filesChanged.length ? e.filesChanged.map(normFile) : [];
    for (const file of changed) {
      const f = ensure(file);
      f.touches += 1;
      f.experiments.push(e.id);
      if (e.outcome === "kept") {
        f.kept += 1;
        f.impact += saved / changed.length;
      }
    }
    // Regions come from what the agent said it would change (code_region on the hypotheses tested).
    const hs = e.hypothesisIds.map((id) => g.hypotheses[id]).filter(Boolean);
    for (const h of hs) {
      const file = normFile(h.codeRegion.file);
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
        r.impact += saved / hs.length;
      }
    }
    // Per-query movement: only kept experiments change the "current" state.
    if (e.outcome === "kept") {
      for (const [q, v] of Object.entries(e.perQuery ?? {})) {
        const rowsNow = v?.read_rows;
        if (rowsNow === null || rowsNow === undefined || current[q] === undefined) continue;
        const delta = current[q] - rowsNow;
        const f = files.get(`queries/${q}.sql`);
        if (f?.query && Math.abs(delta) > 0) f.query.movedBy.push({ experiment: e.id, saved: delta });
        current[q] = rowsNow;
        if (f?.query) f.query.current = rowsNow;
      }
    }
  }

  // Hypotheses that were proposed but never benchmarked still mark their region (untested).
  for (const h of Object.values(g.hypotheses)) {
    if (h.tests.length) continue;
    const file = normFile(h.codeRegion.file);
    const symbol = normSymbol(h.codeRegion.symbol);
    const key = `${file}::${symbol.toLowerCase()}`;
    if (!regions.has(key)) regions.set(key, { key, file, symbol, touches: 0, kept: 0, impact: 0, hypotheses: [h.id] });
    else if (!regions.get(key)!.hypotheses.includes(h.id)) regions.get(key)!.hypotheses.push(h.id);
  }

  for (const r of regions.values()) ensure(r.file).regions.push(r);
  for (const f of files.values()) f.regions.sort((a, b) => b.impact - a.impact || b.touches - a.touches);

  const list = [...files.values()].sort((a, b) =>
    a.file === "schema.sql" ? -1 : b.file === "schema.sql" ? 1 : a.file.localeCompare(b.file),
  );
  const maxImpact = Math.max(1, ...list.map((f) => f.impact), ...[...regions.values()].map((r) => r.impact));
  const totalSaved = (g.metric.baseline ?? 0) - (g.metric.best ?? g.metric.baseline ?? 0);
  return { files: list, maxImpact, totalSaved };
}
