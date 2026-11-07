import type { GbEvent } from "@/lib/beliefEngine";
import { checkExperiment, experimentStates, type HackCheck } from "@/lib/hackChecks";
import { getDb } from "@/lib/mongodb";

// GET /api/checks?run=<run_id>  -> { checks: { [experiment_id]: HackCheck }, computed, tokens }
// Hack signals for every measured experiment of a run (any harness). Each experiment is checked once by
// SubQ Snap and cached in Mongo (`checks`), so polling this is cheap; new experiments get checked as they land.
export async function GET(request: Request) {
  const run = new URL(request.url).searchParams.get("run");
  if (!run) return Response.json({ error: "run is required" }, { status: 400 });
  try {
    const db = await getDb();
    let events = (await db
      .collection("events")
      .find({ run_id: run }, { projection: { _id: 0 } })
      .sort({ seq: 1 })
      .toArray()) as unknown as GbEvent[];
    if (!events.length) {
      // Static replays (public/replays/<id>.json) aren't in Mongo; read them over HTTP from this deployment.
      const r = await fetch(new URL(`/replays/${encodeURIComponent(run)}.json`, request.url));
      if (r.ok) events = (await r.json()) as GbEvent[];
    }

    const col = db.collection<HackCheck & { _id: string; run_id: string }>("checks");
    const cached = await col.find({ run_id: run }).toArray();
    const have = new Set(cached.map((c) => c.experiment_id));
    const todo = experimentStates(events).filter((p) => !have.has(String(p.exp.id)));

    const fresh: HackCheck[] = [];
    for (let i = 0; i < todo.length; i += 6) {
      const batch = await Promise.all(todo.slice(i, i + 6).map((p) => checkExperiment(p).catch(() => null)));
      for (const c of batch) if (c) fresh.push(c);
    }
    if (fresh.length) {
      await col.bulkWrite(
        fresh.map((c) => ({
          replaceOne: { filter: { _id: `${run}:${c.experiment_id}` }, replacement: { ...c, run_id: run }, upsert: true },
        })),
      );
    }

    const checks: Record<string, HackCheck> = {};
    for (const c of [...cached, ...fresh]) {
      const { _id, run_id, ...rest } = c as HackCheck & { _id?: string; run_id?: string };
      void _id;
      void run_id;
      checks[c.experiment_id] = rest;
    }
    return Response.json({ checks, computed: fresh.length, tokens: fresh.reduce((n, c) => n + c.input_tokens, 0) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
