import { buildGraph, type GbEvent } from "@/lib/beliefEngine";
import { getDb } from "@/lib/mongodb";
import { summarize } from "@/lib/runSummary";

// GET /api/runs -> { runs: RunSummary[] }   one row per run for the tracker, most recent first.
// Heavy fields (diffs, file snapshots) are left out; summaries only need beliefs and metrics.
export async function GET() {
  try {
    const db = await getDb();
    const metas = await db.collection("runs").find({}).sort({ started_at: -1 }).limit(60).toArray();
    const ids = metas.map((m) => m._id as unknown as string);
    const events = (await db
      .collection("events")
      .find({ run_id: { $in: ids } }, { projection: { _id: 0, diff: 0, files: 0, per_query: 0, breakdown: 0 } })
      .sort({ run_id: 1, seq: 1 })
      .toArray()) as unknown as GbEvent[];
    const byRun = new Map<string, GbEvent[]>();
    for (const ev of events) {
      const list = byRun.get(ev.run_id) ?? [];
      list.push(ev);
      byRun.set(ev.run_id, list);
    }
    const runs = metas
      .filter((m) => byRun.has(m._id as unknown as string))
      .map((m) => summarize(buildGraph(byRun.get(m._id as unknown as string)!), { status: m.status, started_at: m.started_at }));
    return Response.json({ runs });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
