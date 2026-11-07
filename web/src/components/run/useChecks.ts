"use client";

import { useEffect, useState } from "react";
import type { HackCheck } from "@/lib/hackChecks";

/** Hack signals per experiment. Refetches whenever the number of experiments grows (the server caches checks). */
export function useChecks(runId: string, experimentCount: number) {
  const [checks, setChecks] = useState<Record<string, HackCheck>>({});
  useEffect(() => {
    if (!experimentCount) return;
    let cancelled = false;
    fetch(`/api/checks?run=${encodeURIComponent(runId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.checks) setChecks(j.checks);
      })
      .catch(() => {
        /* signals are optional: the ledger works without them */
      });
    return () => {
      cancelled = true;
    };
  }, [runId, experimentCount]);
  return checks;
}

export const FLAG_TEXT: Record<HackCheck["flags"][number], string> = {
  off_topic: "diff doesn't match the hypothesis",
  unexplained_gain: "gain where the hypothesis predicts none",
  changes_semantics: "may change what is computed",
  bundled: "bundled with unrelated changes",
};
