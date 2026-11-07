"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RunDoc = { _id: string; status?: string; model?: string; best?: number; baseline?: number };

// Run index: most recent runs from Mongo.
export default function RunsPage() {
  const [runs, setRuns] = useState<RunDoc[] | null>(null);
  useEffect(() => {
    fetch("/api/events", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRuns(j.runs ?? []))
      .catch(() => setRuns([]));
  }, []);
  return (
    <main className="mx-auto min-h-screen max-w-[900px] bg-frost px-4 py-14 md:px-10">
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">Runs</div>
      <h1 className="mt-2 text-[32px] font-medium tracking-[-0.03em]">Autoresearch runs.</h1>
      <div className="mt-6 overflow-hidden rounded-[6px] border border-line bg-white">
        {runs === null && <div className="anim-shimmer h-10 bg-mist" />}
        {runs?.map((r) => (
          <Link key={r._id} href={`/run/${r._id}`} className="flex h-10 items-center justify-between border-b border-line px-4 font-mono text-[13px] hover:bg-mist">
            <span>{r._id}</span>
            <span className="text-muted">
              {r.status} · {r.model ?? ""} · best {r.best?.toLocaleString("en-US") ?? "—"}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
