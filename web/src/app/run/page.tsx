"use client";

// Experiment tracker (/run). Every run in one table: what it optimized, how far it got, how it reasoned, and
// whether to trust it (signals). Select runs to compare; click a row to see how the agent arrived at its beliefs.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CaseDoc } from "@/lib/cases";
import type { RunSummary, Signal } from "@/lib/runSummary";

type SortKey = "started" | "improvement" | "experiments" | "hypotheses" | "brier";
const PALETTE = ["#3A4BFF", "#22B8CF", "#8B7CF6", "#0F9D76", "#C98404", "#E5484D"];

const fmt = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  if (Number.isInteger(n)) return n.toLocaleString("en-US");
  return String(Number(n.toPrecision(3)));
};
const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);
const ago = (t: number | null) => {
  if (!t) return "";
  const s = Date.now() / 1000 - t;
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};

export default function TrackerPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [cases, setCases] = useState<CaseDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "flagged">("all");
  const [task, setTask] = useState("all");
  const [sort, setSort] = useState<SortKey>("started");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const load = () => {
      fetch("/api/runs", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => (j.error ? setError(j.error) : (setRuns(j.runs), setError(null))))
        .catch((e) => setError(String(e)));
      fetch("/api/cases", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setCases(j.cases ?? []))
        .catch(() => setCases([]));
    };
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  const tasks = useMemo(() => [...new Set((runs ?? []).map((r) => r.task))], [runs]);
  const shown = useMemo(() => {
    let list = runs ?? [];
    if (filter === "live") list = list.filter((r) => r.status === "running");
    if (filter === "flagged") list = list.filter((r) => r.signals.some((s) => s.level !== "info"));
    if (task !== "all") list = list.filter((r) => r.task === task);
    if (q.trim()) {
      const n = q.toLowerCase();
      list = list.filter((r) => [r.runId, r.task, r.agent, r.model, r.provider].join(" ").toLowerCase().includes(n));
    }
    const by: Record<SortKey, (r: RunSummary) => number> = {
      started: (r) => r.startedAt ?? 0,
      improvement: (r) => r.improvement ?? -1,
      experiments: (r) => r.experiments.total,
      hypotheses: (r) => r.hypotheses.total,
      brier: (r) => -(r.brier ?? 9),
    };
    return [...list].sort((a, b) => by[sort](b) - by[sort](a));
  }, [runs, filter, task, q, sort]);

  const live = (runs ?? []).filter((r) => r.status === "running").length;
  const flagged = (runs ?? []).filter((r) => r.signals.some((s) => s.level !== "info")).length;
  const compare = (runs ?? []).filter((r) => selected.includes(r.runId));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-6)));

  return (
    <div className="min-h-screen bg-frost text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-frost">
        <nav className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 md:px-10">
          <Link href="/" className="text-[18px] font-medium tracking-[-0.02em]">glassbox</Link>
          <span className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.08em] text-muted">
            <Dot live={live > 0} /> {live} live · {runs?.length ?? 0} runs
          </span>
        </nav>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-8 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Label>01 / Runs</Label>
            <h1 className="mt-2 text-[32px] font-medium leading-[1.05] tracking-[-0.03em] md:text-[44px]">Every run, and why to trust it.</h1>
            <p className="mt-2 font-mono text-[12px] text-muted">
              {runs?.length ?? 0} runs · {tasks.length} tasks · {flagged} flagged · click a run to see how the agent reasoned
            </p>
          </div>
          <Link href="/new" className="rounded-[6px] border border-ink px-4 py-2 font-mono text-[13px] hover:bg-ink hover:text-white">
            + New case
          </Link>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search runs, tasks, agents"
            className="h-9 w-64 rounded-[6px] border border-line bg-white px-3 font-mono text-[12px] placeholder:text-subtle focus:border-signal focus:outline-none"
          />
          <Seg value={filter} onChange={(v) => setFilter(v as typeof filter)} options={[["all", "All"], ["live", `Live ${live}`], ["flagged", `Flagged ${flagged}`]]} />
          <select value={task} onChange={(e) => setTask(e.target.value)} className="h-9 rounded-[6px] border border-line bg-white px-2 font-mono text-[12px]">
            <option value="all">All tasks</option>
            {tasks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 rounded-[6px] border border-line bg-white px-2 font-mono text-[12px]">
            <option value="started">Newest</option>
            <option value="improvement">Most improved</option>
            <option value="experiments">Most experiments</option>
            <option value="hypotheses">Most hypotheses</option>
            <option value="brier">Best calibrated</option>
          </select>
          {selected.length > 0 && (
            <span className="ml-auto flex items-center gap-2 font-mono text-[12px] text-muted">
              {selected.length} selected
              <button type="button" onClick={() => setSelected([])} className="text-ink hover:underline">
                clear
              </button>
            </span>
          )}
        </div>

        {compare.length >= 2 && <Compare runs={compare} />}
        {compare.length === 1 && <p className="font-mono text-[12px] text-muted">Select one more run to compare.</p>}

        {/* Table */}
        <div className="overflow-x-auto rounded-[6px] border border-line bg-white">
          {error && <p className="px-4 py-3 font-mono text-[12px] text-danger">{error}</p>}
          {runs === null && !error && <div className="anim-shimmer h-12 bg-mist" />}
          {runs && (
            <table className="w-full min-w-[1100px] text-left">
              <thead>
                <tr className="border-b border-line font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                  <th className="w-8 px-3 py-2 font-normal" />
                  <th className="px-2 py-2 font-normal">Run</th>
                  <th className="px-2 py-2 font-normal">Agent</th>
                  <th className="px-2 py-2 font-normal">Metric</th>
                  <th className="px-2 py-2 font-normal">Progress</th>
                  <th className="px-2 py-2 text-right font-normal">Exp</th>
                  <th className="px-2 py-2 text-right font-normal">Hyp</th>
                  <th className="px-2 py-2 text-right font-normal">Links</th>
                  <th className="px-2 py-2 text-right font-normal" title="Brier score of first predictions; lower is better">Calib.</th>
                  <th className="px-3 py-2 font-normal">Signals</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr
                    key={r.runId}
                    onClick={() => router.push(`/run/${r.runId}`)}
                    className={`cursor-pointer border-b border-line align-top last:border-b-0 hover:bg-mist ${selected.includes(r.runId) ? "bg-frost" : ""}`}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(r.runId)} onChange={() => toggle(r.runId)} aria-label={`Compare ${r.runId}`} className="accent-[var(--color-signal)]" />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2 font-mono text-[13px]">
                        {r.status === "running" && <Dot live />}
                        <span className="text-ink">{r.runId}</span>
                        {r.status !== "finished" && r.status !== "running" && <span className="text-[11px] text-warning">{r.status}</span>}
                      </div>
                      <div className="mt-0.5 max-w-[260px] truncate text-[13px] text-muted" title={r.task}>
                        {r.task}
                      </div>
                      <div className="font-mono text-[11px] text-subtle">{ago(r.startedAt)}</div>
                    </td>
                    <td className="px-2 py-3 font-mono text-[12px] text-muted">
                      <div className="max-w-[170px] truncate text-ink" title={r.agent}>
                        {r.agent}
                      </div>
                      <div>{[r.provider, r.model].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-2 py-3 font-mono text-[12px]">
                      <div className="text-muted">
                        {r.metric.label} {r.metric.direction === "lower" ? "↓" : "↑"}
                      </div>
                      <div className="tabular-nums">
                        {fmt(r.baseline)} → <span className="text-ink">{fmt(r.best)}</span>
                        {r.metric.unit && r.metric.unit !== r.metric.label ? ` ${r.metric.unit}` : ""}
                      </div>
                      <div className="text-[11px] text-subtle" title={`verification: ${r.verify}`}>
                        check: {r.verify.length > 28 ? `${r.verify.slice(0, 28)}…` : r.verify}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <Spark curve={r.curve} />
                        <span className={`font-mono text-[13px] tabular-nums ${(r.improvement ?? 0) > 0 ? "text-success" : "text-muted"}`}>{pct(r.improvement)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-[12px] tabular-nums">
                      <div className="text-ink">{r.experiments.total}</div>
                      <div className="text-[11px] text-muted">
                        <span className="text-success">{r.experiments.kept}</span>/{r.experiments.discarded}/<span className={r.experiments.invalid ? "text-danger" : ""}>{r.experiments.invalid}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-[12px] tabular-nums">
                      <div className="text-ink">{r.hypotheses.total}</div>
                      <div className="text-[11px] text-muted">
                        <span className="text-success">{r.hypotheses.confirmed}✓</span> <span className="text-danger">{r.hypotheses.refuted}✕</span> {r.hypotheses.open}?
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-[12px] tabular-nums">{r.links}</td>
                    <td className="px-2 py-3 text-right font-mono text-[12px] tabular-nums">{r.brier === null ? "—" : r.brier.toFixed(2)}</td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-[280px] flex-wrap gap-1">
                        {r.signals.length === 0 ? <span className="font-mono text-[11px] text-subtle">clean</span> : r.signals.map((s) => <SignalChip key={s.kind} s={s} />)}
                      </div>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-center font-mono text-[13px] text-muted">
                      No runs match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <p className="font-mono text-[11px] text-muted">
          Exp = kept/discarded/invalid · Hyp = confirmed ✓ refuted ✕ open ? · Calib. = Brier score of the agent&apos;s first predictions (0 = perfect) ·
          Signals: <span className="text-danger">alert</span> / <span className="text-warning">warn</span> / info; hover for detail.
        </p>

        {/* Cases */}
        <section>
          <Label className="mb-2">02 / Cases</Label>
          <div className="overflow-hidden rounded-[6px] border border-line bg-white">
            {cases === null && <div className="anim-shimmer h-10 bg-mist" />}
            {cases?.length === 0 && (
              <p className="px-4 py-3 font-mono text-[13px] text-muted">
                No cases yet. <Link href="/new" className="text-signal hover:underline">Describe one</Link>.
              </p>
            )}
            {cases?.map((c) => (
              <div key={c._id} className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 font-mono text-[13px] last:border-b-0">
                <Link href={`/new?case=${c._id}`} className="hover:underline">
                  {c._id}
                  <span className="ml-2 text-muted">{c.spec?.name ?? c.conversation?.[0]?.text.slice(0, 60)}</span>
                </Link>
                <span className="flex items-center gap-3 text-muted">
                  <span className={["failed", "dry_run_failed", "invalid"].includes(c.status) ? "text-danger" : c.status === "needs_input" ? "text-warning" : ""}>
                    {c.status.replace(/_/g, " ")}
                  </span>
                  {c.run_id && (
                    <Link href={`/run/${c.run_id}`} className="text-signal hover:underline">
                      {c.run_id} →
                    </Link>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Compare({ runs }: { runs: RunSummary[] }) {
  const W = 640;
  const H = 180;
  const maxI = Math.max(2, ...runs.map((r) => r.curve.length));
  const x = (i: number) => 36 + ((i - 0) / maxI) * (W - 56);
  const y = (v: number) => 12 + (1 - Math.max(0, Math.min(1, v))) * (H - 36);
  const rows: [string, (r: RunSummary) => React.ReactNode][] = [
    ["Task", (r) => r.task],
    ["Agent", (r) => [r.agent, r.model].filter(Boolean).join(" · ")],
    ["Metric", (r) => `${r.metric.label} (${r.metric.direction} is better)`],
    ["Baseline → best", (r) => `${fmt(r.baseline)} → ${fmt(r.best)}`],
    ["Improvement", (r) => pct(r.improvement)],
    ["Experiments", (r) => `${r.experiments.total} (${r.experiments.kept} kept, ${r.experiments.invalid} invalid)`],
    ["Hypotheses", (r) => `${r.hypotheses.total} (${r.hypotheses.confirmed} ✓, ${r.hypotheses.refuted} ✕)`],
    ["Cross-links", (r) => r.links],
    ["Calibration (Brier)", (r) => (r.brier === null ? "—" : r.brier.toFixed(2))],
    ["Verification", (r) => r.verify],
    ["Signals", (r) => (r.signals.length ? r.signals.map((s) => s.label).join(", ") : "clean")],
  ];
  return (
    <div className="grid gap-4 rounded-[6px] border border-signal bg-white p-4 lg:grid-cols-[minmax(0,640px)_1fr]">
      <div>
        <Label className="mb-2">Compare · improvement vs experiments</Label>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Improvement curves">
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={36} x2={W - 20} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray="3 4" />
              <text x={30} y={y(v) + 4} textAnchor="end" fontSize={10} className="font-mono" fill="var(--color-muted)">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}
          {runs.map((r, k) => {
            let d = `M ${x(0)} ${y(0)}`;
            for (const p of r.curve) d += ` H ${x(p.i)} V ${y(p.improvement)}`;
            return <path key={r.runId} d={d} fill="none" stroke={PALETTE[k % PALETTE.length]} strokeWidth={1.5} />;
          })}
          <text x={W - 20} y={H - 4} textAnchor="end" fontSize={10} className="font-mono" fill="var(--color-muted)">
            experiment →
          </text>
        </svg>
        <div className="mt-1 flex flex-wrap gap-3 font-mono text-[11px] text-muted">
          {runs.map((r, k) => (
            <span key={r.runId} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: PALETTE[k % PALETTE.length] }} />
              {r.runId}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-[12px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-[0.08em] text-muted">
              <th className="py-1.5 pr-3 font-normal" />
              {runs.map((r, k) => (
                <th key={r.runId} className="py-1.5 pr-3 font-normal" style={{ color: PALETTE[k % PALETTE.length] }}>
                  {r.runId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label} className="border-b border-line last:border-b-0">
                <td className="py-1.5 pr-3 text-muted">{label}</td>
                {runs.map((r) => (
                  <td key={r.runId} className="py-1.5 pr-3 text-ink">
                    {get(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Spark({ curve }: { curve: RunSummary["curve"] }) {
  const W = 72;
  const H = 22;
  if (curve.length === 0) return <span className="inline-block h-[22px] w-[72px] rounded-[2px] bg-mist" />;
  const n = Math.max(1, curve.length);
  let d = `M 0 ${H - 1}`;
  for (const p of curve) d += ` H ${(p.i / n) * W} V ${H - 1 - Math.max(0, Math.min(1, p.improvement)) * (H - 2)}`;
  return (
    <svg width={W} height={H} aria-hidden>
      <path d={d} fill="none" stroke="var(--color-cobalt)" strokeWidth={1.25} />
    </svg>
  );
}

function SignalChip({ s }: { s: Signal }) {
  const cls = s.level === "alert" ? "border-transparent bg-danger-fill text-ink" : s.level === "warn" ? "border-transparent bg-warn-fill text-ink" : "border-line text-muted";
  return (
    <span title={s.detail} className={`inline-flex rounded-[3px] border px-1.5 py-px font-mono text-[11px] leading-[16px] ${cls}`}>
      {s.label}
    </span>
  );
}

function Dot({ live }: { live: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {live && <span className="anim-pulse absolute inset-0 rounded-full bg-live" />}
      <span className={`relative inline-block h-2 w-2 rounded-full ${live ? "bg-live" : "bg-subtle"}`} />
    </span>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`font-mono text-[12px] uppercase tracking-[0.08em] text-muted ${className}`}>{children}</div>;
}

function Seg({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex h-9 overflow-hidden rounded-[6px] border border-line bg-white">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={`px-3 font-mono text-[12px] ${value === v ? "bg-ink text-white" : "text-muted hover:bg-mist"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
