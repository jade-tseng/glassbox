import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// GET /api/health — confirms the app can reach MongoDB.
export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return Response.json({ ok: true, db: db.databaseName });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
