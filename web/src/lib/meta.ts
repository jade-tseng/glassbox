// Meta Model API (dev.meta.ai): Muse Spark models, OpenAI-compatible Responses API.
// The runner uses Meta through its Anthropic-compatible Messages API instead (glassbox/backends.py).
// Docs: https://dev.meta.ai/docs/quickstart · key env var MODEL_API_KEY (starts with LLM_).

const BASE_URL = process.env.META_BASE_URL ?? "https://api.meta.ai/v1";
export const META_MODEL = process.env.META_MODEL ?? "muse-spark-1.3";

export type Effort = "minimal" | "low" | "medium" | "high" | "xhigh"; // "none" is rejected by Muse Spark

export async function metaAsk(input: string, opts: { model?: string; effort?: Effort; maxOutputTokens?: number } = {}) {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set (Meta Model API key; see web/.env.example)");

  const res = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? META_MODEL,
      input,
      reasoning: { effort: opts.effort ?? "low" },
      ...(opts.maxOutputTokens ? { max_output_tokens: opts.maxOutputTokens } : {}),
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Meta ${res.status}: ${body.slice(0, 500)}`);
  const json = JSON.parse(body);
  const text = (json.output ?? [])
    .filter((o: { type: string }) => o.type === "message")
    .flatMap((o: { content: { type: string; text?: string }[] }) => o.content)
    .filter((c: { type: string }) => c.type === "output_text")
    .map((c: { text?: string }) => c.text ?? "")
    .join("");
  return { id: json.id as string, model: json.model as string, text, usage: json.usage };
}
