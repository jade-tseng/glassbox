import { randomBytes } from "node:crypto";
import { authorized, ID_RE, validateSpec, type CaseDoc, type CaseSpec } from "@/lib/cases";
import { getDb } from "@/lib/mongodb";

// GET  /api/cases                         -> { cases } (most recent first)
// POST /api/cases  (Bearer access key)
//   Plain language (the /new page):
//     { action: "intake",  text }            -> new case, status intake_requested (worker's intake agent interprets it)
//     { action: "clarify", id, text }        -> answer / correction, back to intake_requested
//     { action: "start",   id }              -> queued (only after a passing dry run)
//   Structured (API users who already have a spec):
//     { action: "dry_run", spec }  /  { action: "save", spec }
export async function GET() {
  try {
    const db = await getDb();
    const cases = await db.collection<CaseDoc>("cases").find({}).sort({ updated_at: -1 }).limit(50).toArray();
    return Response.json({ cases });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

const BUSY = ["intake_requested", "interpreting", "dry_run_requested", "dry_running", "queued", "starting", "running"];
const now = () => Date.now() / 1000;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28);

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized: enter the access key" }, { status: 401 });
  let body: { action?: string; text?: string; id?: string; spec?: CaseSpec };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const action = body.action ?? "intake";

  try {
    const db = await getDb();
    const col = db.collection<CaseDoc>("cases");

    if (action === "intake") {
      const text = (body.text ?? "").trim();
      if (text.length < 10) return Response.json({ error: "describe the task in a sentence or two" }, { status: 400 });
      if (text.length > 8000) return Response.json({ error: "keep the description under 8000 characters" }, { status: 400 });
      const words = text.split(/\s+/).slice(0, 5).join(" ");
      const id = `${slug(words) || "case"}-${randomBytes(2).toString("hex")}`;
      const doc = {
        _id: id,
        status: "intake_requested",
        conversation: [{ role: "user", text, at: now() }],
        updated_at: now(),
      } as unknown as CaseDoc;
      await col.insertOne(doc);
      return Response.json({ ok: true, case: doc });
    }

    if (action === "clarify" || action === "start") {
      if (!ID_RE.test(body.id ?? "")) return Response.json({ error: "id is required" }, { status: 400 });
      const existing = await col.findOne({ _id: body.id! });
      if (!existing) return Response.json({ error: "case not found" }, { status: 404 });
      if (BUSY.includes(existing.status)) return Response.json({ error: `case is ${existing.status.replace(/_/g, " ")}; wait a moment` }, { status: 409 });
      if (action === "clarify") {
        const text = (body.text ?? "").trim();
        if (!text) return Response.json({ error: "write an answer or a correction" }, { status: 400 });
        await col.updateOne(
          { _id: existing._id },
          {
            $push: { conversation: { role: "user", text: text.slice(0, 4000), at: now() } },
            $set: { status: "intake_requested", updated_at: now() },
            $unset: { dry_run: "" },
          },
        );
      } else {
        if (existing.status !== "ready" || !existing.dry_run?.ok) {
          return Response.json({ error: "the case needs a passing dry run before it can start" }, { status: 409 });
        }
        await col.updateOne({ _id: existing._id }, { $set: { status: "queued", updated_at: now() } });
      }
      return Response.json({ ok: true, case: await col.findOne({ _id: existing._id }) });
    }

    if (action === "dry_run" || action === "save") {
      const spec = body.spec;
      if (!spec) return Response.json({ error: "spec is required" }, { status: 400 });
      const errors = validateSpec(spec);
      if (errors.length) return Response.json({ error: "invalid spec", errors }, { status: 400 });
      const existing = await col.findOne({ _id: spec.id });
      if (existing && BUSY.includes(existing.status)) return Response.json({ error: `case is ${existing.status}` }, { status: 409 });
      await col.updateOne(
        { _id: spec.id },
        { $set: { spec, status: action === "dry_run" ? "dry_run_requested" : "draft", updated_at: now() }, $unset: { dry_run: "" } },
        { upsert: true },
      );
      return Response.json({ ok: true, case: await col.findOne({ _id: spec.id }) });
    }

    return Response.json({ error: `unknown action '${action}'` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
