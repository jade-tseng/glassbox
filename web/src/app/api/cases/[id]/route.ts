import type { CaseDoc } from "@/lib/cases";
import { getDb } from "@/lib/mongodb";

// GET /api/cases/<id> -> { case }   (the wizard polls this while the worker dry-runs / runs it)
export async function GET(_request: Request, ctx: RouteContext<"/api/cases/[id]">) {
  const { id } = await ctx.params;
  try {
    const db = await getDb();
    const doc = await db.collection<CaseDoc>("cases").findOne({ _id: id });
    if (!doc) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ case: doc });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
