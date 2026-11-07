import { metaAsk } from "@/lib/meta";

// GET /api/meta/ping — confirms MODEL_API_KEY works with a tiny low-effort Responses call.
export async function GET() {
  try {
    const { model, text, usage } = await metaAsk("Reply with exactly: pong", { effort: "low" });
    return Response.json({ ok: true, model, reply: text.trim(), usage });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
