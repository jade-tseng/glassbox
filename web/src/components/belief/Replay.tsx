"use client";

// Feeds every belief view on a page from one position in an event log, so scrubbing moves them all together.
//   - static (default): the bundled recording of run bg3, replayed (landing page)
//   - live: events passed in by the page (polled from /api/events); follows the newest event until the viewer scrubs

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import bg3 from "@/lib/belief/bg3.json";
import { buildGraph, type GraphState, type RunEvent } from "@/lib/belief/engine";
import { usePrefersReducedMotion } from "@/components/motion/useInView";

const BG3 = bg3 as unknown as RunEvent[];
const FAST = new Set(["agent_action", "run_started", "agent_message"]);
const STEP_MS = 650;
const FAST_MS = 110;
const HOLD_MS = 8000;

type Replay = {
  events: RunEvent[];
  index: number; // events[0..index] are applied
  setIndex: (i: number) => void; // scrubbing stops following / playing
  playing: boolean;
  setPlaying: (p: boolean) => void;
  live: boolean; // events are still arriving
  following: boolean; // showing the newest event
  follow: () => void;
  state: GraphState;
  final: GraphState; // everything loaded so far: used for stable scales and layout
  runId: string;
};

const Ctx = createContext<Replay | null>(null);

export function ReplayProvider({
  children,
  startAtEnd = false,
  events: given,
  runId = "bg3",
  live = false,
}: {
  children: ReactNode;
  /** Open on the finished run, paused (the page's first visual is the whole graph). */
  startAtEnd?: boolean;
  /** Events from a run (live view). Omit to replay the bundled bg3 recording. */
  events?: RunEvent[];
  runId?: string;
  live?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const events = given ?? BG3;
  const external = given !== undefined;
  const last = Math.max(0, events.length - 1);

  const [index, setIndexRaw] = useState(startAtEnd || external ? last : 0);
  const [playing, setPlayingRaw] = useState(!startAtEnd && !external);
  const [following, setFollowing] = useState(external);

  const shown = following ? last : reduced && playing ? last : Math.min(index, last);
  const final = useMemo(() => buildGraph(events), [events]);
  const state = useMemo(() => (events.length ? buildGraph(events, events[shown].seq) : final), [events, shown, final]);

  useEffect(() => {
    if (!playing || reduced || following) return;
    const atEnd = index >= last;
    const next = events[Math.min(index + 1, last)];
    const delay = atEnd ? (external ? 0 : HOLD_MS) : next && FAST.has(next.type) ? FAST_MS : STEP_MS;
    const id = setTimeout(() => {
      if (atEnd && external) {
        // A real run: stop at the newest event and keep following it.
        setPlayingRaw(false);
        setFollowing(true);
      } else {
        setIndexRaw((i) => (i >= last ? 0 : i + 1));
      }
    }, delay);
    return () => clearTimeout(id);
  }, [index, playing, reduced, last, following, external, events]);

  const setIndex = (i: number) => {
    setFollowing(false);
    setIndexRaw(i);
  };
  // Pressing play on a finished replay starts it over instead of holding at the end.
  const setPlaying = (p: boolean) => {
    if (p) {
      setFollowing(false);
      setIndexRaw(shown >= last ? 0 : shown);
    }
    setPlayingRaw(p);
  };
  const follow = () => {
    setPlayingRaw(false);
    setFollowing(true);
  };

  const value: Replay = {
    events,
    index: shown,
    setIndex,
    playing,
    setPlaying,
    live,
    following,
    follow,
    state,
    final,
    runId,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReplay() {
  const r = useContext(Ctx);
  if (!r) throw new Error("useReplay must be used inside <ReplayProvider>");
  return r;
}
