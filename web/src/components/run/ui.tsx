"use client";

// Small self-contained primitives for the run view (UI.md §6.3, §7). Kept local so the run view doesn't depend
// on the landing page's motion components.

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EvidenceKind, HypStatus } from "@/lib/beliefEngine";

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-[12px] uppercase tracking-[0.08em] text-muted ${className}`}>{children}</div>;
}

export function PulseDot({ live, size = 8 }: { live: boolean; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden>
      {live && <span className="anim-pulse absolute inset-0 rounded-full bg-live" />}
      <span className={`relative inline-block rounded-full ${live ? "bg-live" : "bg-subtle"}`} style={{ width: size, height: size }} />
    </span>
  );
}

function prefersReduced() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Number ticking to its value (UI.md CountUp): tabular mono, re-ticks from the old value. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en-US") }: { value: number | null; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value ?? 0);
  const current = useRef(value ?? 0); // the value currently on screen
  useEffect(() => {
    if (value === null) return;
    if (prefersReduced()) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = current.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 600);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      current.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // rAF pauses in background tabs: guarantee we land on the true value.
    const settle = setTimeout(() => {
      cancelAnimationFrame(raf);
      current.current = value;
      setShown(value);
    }, 700);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [value]);
  return <span className="tabular-nums">{value === null ? "—" : format(shown)}</span>;
}

export const STATUS_STYLE: Record<HypStatus, { label: string; chip: string; bar: string; line: string }> = {
  untested: { label: "UNTESTED", chip: "border-line text-muted", bar: "var(--color-subtle)", line: "var(--color-scope-muted)" },
  open: { label: "OPEN", chip: "border-signal text-signal", bar: "var(--color-cobalt)", line: "var(--color-ice)" },
  confirmed: { label: "CONFIRMED", chip: "border-transparent bg-mint text-ink", bar: "var(--color-success)", line: "var(--color-mint)" },
  refuted: { label: "REFUTED", chip: "border-transparent bg-danger-fill text-ink", bar: "var(--color-danger)", line: "var(--color-danger-fill)" },
  abandoned: { label: "ABANDONED", chip: "border-line text-slate", bar: "var(--color-slate)", line: "var(--color-slate)" },
};

export const EVIDENCE_STYLE: Record<EvidenceKind, { glyph: string; cls: string; title: string }> = {
  supports: { glyph: "✓", cls: "border-success text-success", title: "supports" },
  refutes: { glyph: "✕", cls: "border-danger text-danger", title: "refutes" },
  weak: { glyph: "~", cls: "border-line text-muted", title: "weak (tiny change)" },
  invalid: { glyph: "!", cls: "border-transparent bg-danger-fill text-ink", title: "invalid (failed or wrong result)" },
};

export function Chip({ children, className = "", title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-px font-mono text-[11px] leading-[16px] ${className}`}>
      {children}
    </span>
  );
}

/** Compact number for any metric: 20.00M, 956.6k, 52, 0.4312. */
export const fmtNum = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  if (Number.isInteger(n)) return n.toLocaleString("en-US");
  return a >= 100 ? n.toFixed(1) : n.toPrecision(4);
};
/** @deprecated use fmtNum (kept for older call sites) */
export const fmtRows = fmtNum;

/**
 * Map a metric value to 0..1 "progress" from the baseline toward the best value seen, respecting whether
 * lower or higher is better. Log scale when every value is positive (big early wins don't flatten later ones).
 */
export function progressScale(baseline: number, values: number[], direction: "lower" | "higher") {
  const all = [baseline, ...values].filter((v) => Number.isFinite(v));
  const useLog = all.every((v) => v > 0);
  const f = (v: number) => (useLog ? Math.log(v) : v);
  const extreme = direction === "lower" ? Math.min(...all) : Math.max(...all);
  const span = Math.abs(f(extreme) - f(baseline)) || 1;
  return (v: number) => {
    const gain = direction === "lower" ? f(baseline) - f(v) : f(v) - f(baseline);
    return Math.max(-0.1, Math.min(1, gain / span));
  };
}

export const arrowFor = (d: string) => (d === "decrease" ? "↓" : d === "increase" ? "↑" : "=");

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
