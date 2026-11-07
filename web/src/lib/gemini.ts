import { GoogleGenAI } from "@google/genai";

// Model IDs from the hackathon builder guide (see /docs/GEMINI.md).
export const MODELS = {
  argon: "gemini-4-argon", // lead brain / orchestrator, 1M shared context
  flash: "gemini-3.8-flash", // fast parallel subagents & tool calls
  flashLite: "gemini-3.5-flash-lite", // routing, classification, guardrails
  live: "gemini-3.8-live", // real-time voice + camera
  tts: "gemini-3.8-flash-tts", // expressive speech
  image: "gemini-nano-banana-2.1", // UI assets, sprites, 4K images
  video: "gemini-omni-1.1-flash", // video with native audio (run in background)
  music: "lyria-3.5",
} as const;

export const AGENTS = {
  antigravity: "antigravity-preview-09-2026", // hosted sandbox agent
  deepResearch: "deep-research-preview-04-2026", // cited research report
} as const;

export type ThinkingLevel = "low" | "medium" | "high";

let client: GoogleGenAI | undefined;

export function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (see web/.env.example)");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/** One-shot text call on the Interactions API. No temperature/top_p/thinking_budget: Argon ignores them. */
export async function ask(
  input: string,
  opts: { model?: string; thinking?: ThinkingLevel; maxOutputTokens?: number; previousId?: string } = {},
) {
  const interaction = await gemini().interactions.create({
    model: opts.model ?? MODELS.argon,
    input,
    previous_interaction_id: opts.previousId,
    generation_config: {
      thinking_level: opts.thinking ?? "medium",
      ...(opts.maxOutputTokens ? { max_output_tokens: opts.maxOutputTokens } : {}),
    },
  });
  return { id: interaction.id, text: interaction.output_text ?? "" };
}
