"use client";

import { useEffect, useRef, useState } from "react";
import type { GbEvent } from "@/lib/beliefEngine";

export type RunMeta = { _id: string; status?: string; model?: string; target?: string; best?: number } | null;
export type Feed = "loading" | "live" | "idle" | "replay" | "error";

/** Poll /api/events every 1.5s (PLAN §6: polling over change streams). Falls back to /replays/<id>.json offline. */
export function useRunEvents(runId: string) {
  const [events, setEvents] = useState<GbEvent[]>([]);
  const [meta, setMeta] = useState<RunMeta>(null);
  const [feed, setFeed] = useState<Feed>("loading");
  const [lastArrival, setLastArrival] = useState<number | null>(null);
  const after = useRef(0);

  useEffect(() => {
    after.current = 0;
    setEvents([]);
    setFeed("loading");
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function replay(): Promise<boolean> {
      try {
        const r = await fetch(`/replays/${runId}.json`);
        if (!r.ok) return false;
        const evs = (await r.json()) as GbEvent[];
        setEvents(evs);
        after.current = evs.at(-1)?.seq ?? 0;
        setFeed("replay");
        return true;
      } catch {
        return false;
      }
    }

    async function tick() {
      try {
        const r = await fetch(`/api/events?run=${encodeURIComponent(runId)}&after=${after.current}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
        const fresh = (j.events ?? []) as GbEvent[];
        if (fresh.length) {
          after.current = fresh[fresh.length - 1].seq;
          setEvents((prev) => [...prev, ...fresh.filter((e) => e.seq > (prev.at(-1)?.seq ?? 0))]);
          setLastArrival(Date.now());
        }
        setMeta(j.run ?? null);
        const running = j.run?.status === "running";
        setFeed(running ? "live" : "idle");
        if (!stopped) timer = setTimeout(tick, running ? 1500 : 6000);
      } catch {
        if (after.current === 0 && (await replay())) return; // offline: static replay, stop polling
        setFeed((f) => (f === "replay" ? f : "error"));
        if (!stopped) timer = setTimeout(tick, 4000);
      }
    }
    // Show a static replay instantly if one exists (cold Mongo connections can take seconds), then poll
    // the API only for events after it.
    (async () => {
      try {
        const r = await fetch(`/replays/${runId}.json`);
        if (r.ok && after.current === 0) {
          const evs = (await r.json()) as GbEvent[];
          if (after.current === 0 && evs.length) {
            after.current = evs.at(-1)!.seq;
            setEvents(evs);
            setFeed((f) => (f === "loading" ? "idle" : f));
          }
        }
      } catch {
        /* no replay: wait for the API */
      }
      tick();
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [runId]);

  return { events, meta, feed, lastArrival };
}
