import { getDb } from "@/lib/mongodb";

// GET /api/events?run=<run_id>&after=<seq>  -> { run, events }   (poll every 1-2s; PLAN §4.9)
// GET /api/events                             -> { runs }         (most recent first)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const run = url.searchParams.get("run");
  const after = Number(url.searchParams.get("after") ?? 0) || 0;
  try {
    const db = await getDb();
    if (!run) {
      const runs = await db.collection("runs").find({}).sort({ started_at: -1 }).limit(20).toArray();
      return Response.json({ runs });
    }
    const [meta, events] = await Promise.all([
      db.collection("runs").findOne({ _id: run as unknown as never }),
      db
        .collection("events")
        .find({ run_id: run, seq: { $gt: after } }, { projection: { _id: 0 } })
        .sort({ seq: 1 })
        .limit(2000)
        .toArray(),
    ]);
    return Response.json({ run: meta, events });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
