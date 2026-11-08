"use client";

// Replays a recorded run (runs/bg3, labeled REPLAY) through the belief engine.
// Every belief view on the page reads the same seq, so scrubbing moves them all together.
// Later: swap the static events for the /api/events poll and keep the same context.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import bg3 from "@/lib/belief/bg3.json";
import { buildGraph, type GraphState, type RunEvent } from "@/lib/belief/engine";
import { usePrefersReducedMotion } from "@/components/motion/useInView";

const EVENTS = bg3 as unknown as RunEvent[];
const FAST = new Set(["agent_action", "run_started"]);
const STEP_MS = 650;
const FAST_MS = 110;
const HOLD_MS = 8000;

type Replay = {
  events: RunEvent[];
  index: number; // events[0..index] are applied
  setIndex: (i: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  atHead: boolean;
  state: GraphState;
  final: GraphState; // full run: used for stable layout
  runId: string;
};

const Ctx = createContext<Replay | null>(null);

/** `startAtEnd`: open on the finished run, paused (the page's first visual is the whole graph); Play replays it. */
export function ReplayProvider({ children, startAtEnd = false }: { children: ReactNode; startAtEnd?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(startAtEnd ? EVENTS.length - 1 : 0);
  const [playing, setPlayingRaw] = useState(!startAtEnd);
  const final = useMemo(() => buildGraph(EVENTS), []);
  const last = EVENTS.length - 1;
  const shownIndex = reduced && playing ? last : index;
  const state = useMemo(() => buildGraph(EVENTS, EVENTS[shownIndex].seq), [shownIndex]);

  useEffect(() => {
    if (!playing || reduced) return;
    const atEnd = index >= last;
    const next = EVENTS[Math.min(index + 1, last)];
    const delay = atEnd ? HOLD_MS : FAST.has(next.type) ? FAST_MS : STEP_MS;
    // Hidden tabs throttle timers on their own, so no extra visibility handling is needed.
    const id = setTimeout(() => setIndex((i) => (i >= last ? 0 : i + 1)), delay);
    return () => clearTimeout(id);
  }, [index, playing, reduced, last]);

  // Pressing play on a finished replay starts it over instead of holding at the end.
  const setPlaying = (p: boolean) => {
    if (p && index >= last) setIndex(0);
    setPlayingRaw(p);
  };

  const value: Replay = {
    events: EVENTS,
    index: shownIndex,
    setIndex,
    playing,
    setPlaying,
    atHead: playing,
    state,
    final,
    runId: "bg3",
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReplay() {
  const r = useContext(Ctx);
  if (!r) throw new Error("useReplay must be used inside <ReplayProvider>");
  return r;
}
