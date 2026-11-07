import { subqChat, SUBQ_MODEL } from "@/lib/subq";

// GET /api/subq/ping — confirms SUBQ_API_KEY, base URL and model ID work with a tiny call.
export async function GET() {
  try {
    const { text, model, usage } = await subqChat([{ role: "user", content: "Reply with exactly: pong" }], {
      maxTokens: 16,
    });
    return Response.json({ ok: true, model: model ?? SUBQ_MODEL, reply: text.trim(), usage });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
