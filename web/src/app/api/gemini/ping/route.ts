import { ask, MODELS } from "@/lib/gemini";

// GET /api/gemini/ping — confirms GEMINI_API_KEY works with a cheap low-thinking call.
export async function GET() {
  try {
    const { text } = await ask("Reply with exactly: pong", { model: MODELS.argon, thinking: "low" });
    return Response.json({ ok: true, model: MODELS.argon, reply: text.trim() });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
