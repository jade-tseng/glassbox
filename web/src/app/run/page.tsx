"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CaseDoc } from "@/lib/cases";

type RunDoc = { _id: string; status?: string; model?: string; task?: string; best?: number; baseline?: number; source?: string };

// Runs (from Mongo) and cases (wizard-created specs the worker runs).
export default function RunsPage() {
  const [runs, setRuns] = useState<RunDoc[] | null>(null);
  const [cases, setCases] = useState<CaseDoc[] | null>(null);
  useEffect(() => {
    const load = () => {
      fetch("/api/events", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setRuns(j.runs ?? []))
        .catch(() => setRuns([]));
      fetch("/api/cases", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setCases(j.cases ?? []))
        .catch(() => setCases([]));
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="mx-auto min-h-screen max-w-[960px] space-y-10 bg-frost px-4 py-14 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">Glassbox</div>
          <h1 className="mt-2 text-[32px] font-medium tracking-[-0.03em]">Research runs.</h1>
        </div>
        <Link href="/new" className="rounded-[6px] border border-ink px-4 py-2 font-mono text-[13px] text-ink hover:bg-ink hover:text-white">
          + New case
        </Link>
      </div>

      <section>
        <div className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-muted">01 / Runs</div>
        <div className="overflow-hidden rounded-[6px] border border-line bg-white">
          {runs === null && <div className="anim-shimmer h-10 bg-mist" />}
          {runs?.length === 0 && <p className="px-4 py-3 font-mono text-[13px] text-muted">No runs yet.</p>}
          {runs?.map((r) => (
            <Link key={r._id} href={`/run/${r._id}`} className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 font-mono text-[13px] last:border-b-0 hover:bg-mist">
              <span>
                {r._id}
                {r.task && <span className="ml-2 text-muted">{r.task}</span>}
              </span>
              <span className="text-muted">
                {r.status === "running" ? <span className="text-success">● running</span> : r.status} {r.model ? `· ${r.model}` : ""}
                {r.source === "ingest" ? " · ingest" : ""}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-muted">02 / Cases</div>
        <div className="overflow-hidden rounded-[6px] border border-line bg-white">
          {cases === null && <div className="anim-shimmer h-10 bg-mist" />}
          {cases?.length === 0 && (
            <p className="px-4 py-3 font-mono text-[13px] text-muted">
              No cases yet. <Link href="/new" className="text-signal hover:underline">Create one</Link>.
            </p>
          )}
          {cases?.map((c) => (
            <div key={c._id} className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 font-mono text-[13px] last:border-b-0">
              <span>
                {c._id}
                <span className="ml-2 text-muted">{c.spec.name}</span>
              </span>
              <span className="flex items-center gap-3 text-muted">
                <span className={c.status === "failed" || c.status === "dry_run_failed" || c.status === "invalid" ? "text-danger" : ""}>{c.status.replace(/_/g, " ")}</span>
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
  );
}
