// SubQ (Subquadratic): long-context model (up to ~12M tokens), OpenAI-compatible chat API.
// Glassbox use: one-pass reads of a whole run (raw trace + diffs + bench output), cross-run memory.
// Our key's /v1/models lists: subq-snap-1.1, subq-snap-latest, subq-snap-preview (checked 2026-11-07).
// Override via SUBQ_MODEL / SUBQ_BASE_URL if needed.

const BASE_URL = process.env.SUBQ_BASE_URL ?? "https://api.subq.ai/v1";
export const SUBQ_MODEL = process.env.SUBQ_MODEL ?? "subq-snap-1.1";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function subqChat(messages: ChatMessage[], opts: { model?: string; maxTokens?: number } = {}) {
  const apiKey = process.env.SUBQ_API_KEY;
  if (!apiKey) throw new Error("SUBQ_API_KEY is not set (see web/.env.example)");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? SUBQ_MODEL,
      messages,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`SubQ ${res.status}: ${body.slice(0, 500)}`);
  const json = JSON.parse(body);
  return {
    text: (json.choices?.[0]?.message?.content as string | undefined) ?? "",
    model: json.model as string | undefined,
    usage: json.usage,
  };
}
