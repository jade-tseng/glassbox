import { timingSafeEqual } from "node:crypto";
import { MAX_EVENTS_PER_REQUEST, RUN_ID_RE, strip, validate, type IncomingEvent } from "@/lib/ingest";
import { getDb } from "@/lib/mongodb";

// POST /api/ingest   Authorization: Bearer <GLASSBOX_INGEST_TOKEN>
//   { "run_id": "my-run", "events": [ { "type": "run_started", ... }, ... ] }   (or a single "event")
// Any harness can stream beliefs into Glassbox. The server assigns seq, fills `t` if missing, assigns H#/E# ids
// when absent, and attaches experiments without hypothesis_ids to the hypotheses proposed since the last
// experiment (the same "armed" rule as the runner's gate). Experiments arriving here are marked
// `source: "ingest"`; the UI labels their numbers as reported by the client, not by Glassbox's own verifier.

function authorized(req: Request): boolean {
  const token = process.env.GLASSBOX_INGEST_TOKEN;
  if (!token) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Counter = { _id: string; seq: number; h: number; e: number; started_at?: number };

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized: send Authorization: Bearer <GLASSBOX_INGEST_TOKEN>" }, { status: 401 });
  }
  let body: { run_id?: string; events?: IncomingEvent[]; event?: IncomingEvent };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const runId = body.run_id ?? "";
  if (!RUN_ID_RE.test(runId)) return Response.json({ error: "run_id must match [A-Za-z0-9][A-Za-z0-9._-]{0,63}" }, { status: 400 });
  const incoming = body.events ?? (body.event ? [body.event] : []);
  if (!Array.isArray(incoming) || incoming.length === 0) return Response.json({ error: "send 'events' (array) or 'event'" }, { status: 400 });
  if (incoming.length > MAX_EVENTS_PER_REQUEST) return Response.json({ error: `at most ${MAX_EVENTS_PER_REQUEST} events per request` }, { status: 413 });

  const rejected: { index: number; error: string }[] = [];
  const valid: { index: number; ev: IncomingEvent }[] = [];
  incoming.forEach((ev, index) => {
    const err = validate(ev);
    if (err) rejected.push({ index, error: err });
    else valid.push({ index, ev: strip(ev) });
  });
  if (!valid.length) return Response.json({ ok: false, run_id: runId, accepted: [], rejected }, { status: 400 });

  try {
    const db = await getDb();
    const counters = db.collection<Counter>("ingest_counters");
    const events = db.collection("events");

    // Initialise the counter from what's already stored (e.g. a run started by the Python runner).
    let ctr = await counters.findOne({ _id: runId });
    if (!ctr) {
      const last = await events.find({ run_id: runId }).sort({ seq: -1 }).limit(1).next();
      const hs = await events.countDocuments({ run_id: runId, type: "hypothesis_proposed", retest: { $ne: true } });
      const es = await events.countDocuments({ run_id: runId, type: { $in: ["experiment_run", "experiment_failed"] } });
      const first = await events.findOne({ run_id: runId, seq: 1 });
      await counters.updateOne(
        { _id: runId },
        { $setOnInsert: { seq: (last?.seq as number) ?? 0, h: hs, e: es, started_at: first ? Date.now() / 1000 - (first.t as number) : undefined } },
        { upsert: true },
      );
      ctr = await counters.findOne({ _id: runId });
    }

    // Reserve a contiguous seq block atomically; reserve ids for events that need them.
    const needH = valid.filter((v) => v.ev.type === "hypothesis_proposed" && !v.ev.id).length;
    const needE = valid.filter((v) => (v.ev.type === "experiment_run" || v.ev.type === "experiment_failed") && !v.ev.id).length;
    const startsRun = valid.some((v) => v.ev.type === "run_started");
    const after = await counters.findOneAndUpdate(
      { _id: runId },
      {
        $inc: { seq: valid.length, h: needH, e: needE },
        ...(startsRun && !ctr?.started_at ? { $set: { started_at: Date.now() / 1000 } } : {}),
      },
      { returnDocument: "after" },
    );
    if (!after) throw new Error("counter update failed");
    let seq = after.seq - valid.length;
    let h = after.h - needH;
    let e = after.e - needE;
    const startedAt = after.started_at ?? Date.now() / 1000;

    // "Armed" hypotheses: proposed since the last experiment (stored + earlier in this batch).
    const lastExp = await events.find({ run_id: runId, type: { $in: ["experiment_run", "experiment_failed"] } }).sort({ seq: -1 }).limit(1).next();
    const armedStored = await events
      .find({ run_id: runId, type: "hypothesis_proposed", seq: { $gt: (lastExp?.seq as number) ?? 0 } }, { projection: { id: 1 } })
      .toArray();
    let armed = armedStored.map((d) => d.id as string);

    const docs = valid.map(({ ev }) => {
      seq += 1;
      const doc: Record<string, unknown> = { ...ev, run_id: runId, seq, source: "ingest" };
      if (typeof doc.t !== "number") doc.t = Math.max(0, Math.round((Date.now() / 1000 - startedAt) * 100) / 100);
      if (ev.type === "hypothesis_proposed") {
        if (!doc.id) doc.id = `H${++h}`;
        if (!armed.includes(doc.id as string)) armed.push(doc.id as string);
      }
      if (ev.type === "experiment_run" || ev.type === "experiment_failed") {
        if (!doc.id) doc.id = `E${++e}`;
        if (!Array.isArray(doc.hypothesis_ids)) doc.hypothesis_ids = armed;
        if (ev.type === "experiment_run" && doc.correct === undefined) doc.correct = true;
        armed = [];
      }
      if (ev.type === "hypothesis_closed") armed = armed.filter((x) => x !== doc.id);
      return doc;
    });
    await events.insertMany(docs, { ordered: true });

    // Keep the run document current for /run listings and live status.
    const started = docs.find((d) => d.type === "run_started");
    const finished = docs.find((d) => d.type === "run_finished");
    const set: Record<string, unknown> = { last_seq: seq, updated_at: Date.now() / 1000 };
    if (started) {
      const task = started.task as { name?: string; metric?: unknown };
      Object.assign(set, { status: "running", task: task?.name, metric: task?.metric, agent: started.agent, model: started.model, started_at: startedAt, source: "ingest" });
      const b = started.baseline as { value?: number } | undefined;
      if (b?.value !== undefined) set.baseline = b.value;
    }
    if (finished) Object.assign(set, { status: (finished.status as string) ?? "finished", finished_at: Date.now() / 1000, best: finished.best });
    await db.collection("runs").updateOne({ _id: runId as unknown as never }, { $set: set }, { upsert: true });

    return Response.json({
      ok: rejected.length === 0,
      run_id: runId,
      accepted: docs.map((d, i) => ({ index: valid[i].index, seq: d.seq, type: d.type, id: d.id ?? null })),
      rejected,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
