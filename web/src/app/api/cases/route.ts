import { authorized, validateSpec, type CaseDoc, type CaseSpec } from "@/lib/cases";
import { getDb } from "@/lib/mongodb";

// GET  /api/cases                       -> { cases }   (most recent first)
// POST /api/cases  (Bearer access key)   { spec, action: "save" | "dry_run" | "start" }
//   save    -> status draft
//   dry_run -> status dry_run_requested   (the local worker evaluates the untouched workspace once)
//   start   -> status queued              (only after a passing dry run of the same spec)
export async function GET() {
  try {
    const db = await getDb();
    const cases = await db.collection<CaseDoc>("cases").find({}).sort({ updated_at: -1 }).limit(50).toArray();
    return Response.json({ cases });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized: enter the access key" }, { status: 401 });
  let body: { spec?: CaseSpec; action?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const spec = body.spec;
  const action = body.action ?? "save";
  if (!spec) return Response.json({ error: "spec is required" }, { status: 400 });
  const errors = validateSpec(spec);
  if (errors.length) return Response.json({ error: "invalid spec", errors }, { status: 400 });

  try {
    const db = await getDb();
    const col = db.collection<CaseDoc>("cases");
    const existing = await col.findOne({ _id: spec.id });
    if (existing && ["dry_running", "starting", "running"].includes(existing.status) && action !== "save") {
      return Response.json({ error: `case is ${existing.status}; wait for it to finish` }, { status: 409 });
    }
    const sameSpec = existing && JSON.stringify(existing.spec) === JSON.stringify(spec);
    let status: CaseDoc["status"];
    if (action === "dry_run") status = "dry_run_requested";
    else if (action === "start") {
      if (!sameSpec || !existing?.dry_run?.ok) {
        return Response.json({ error: "run a passing dry run of this exact spec before starting" }, { status: 409 });
      }
      status = "queued";
    } else status = existing && sameSpec ? existing.status : "draft";
    const update: Partial<CaseDoc> = { spec, status, updated_at: Date.now() / 1000, message: undefined };
    await col.updateOne(
      { _id: spec.id },
      { $set: update, ...(sameSpec || action === "start" ? {} : { $unset: { dry_run: "" } }) },
      { upsert: true },
    );
    return Response.json({ ok: true, case: await col.findOne({ _id: spec.id }) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
