// SubQ Snap (Subquadratic): a *decision* model, not a chat model. You send a `state` (text/object)
// plus named questions (yes/no, choice, score) and get calibrated probabilities back. 384K context,
// input-only pricing ($0.04/1M), no generated text. Docs: https://docs.subq.ai/endpoints/decisions-api/
// Glassbox use: cheap structured checks over events/runs, e.g. "does this diff test the stated hypothesis?"

const BASE_URL = process.env.SUBQ_BASE_URL ?? "https://api.subq.ai/v1";
export const SUBQ_MODEL = process.env.SUBQ_MODEL ?? "subq-snap-1.1";

export type Question =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> } // 2–255 options
  | { type: "score"; instructions: string; criteria: string[] }; // 2–10 levels, lowest → highest

export type Answer =
  | { type: "noul"; noul: number } // probability of yes, 0–1
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  | {
      type: "score";
      score: number; // probability-weighted level index, can fall between levels
      legend: Record<string, string>;
      probabilities: Record<string, number>;
      confidence: number;
    };

export type Image = { mediaType: "image/png" | "image/jpeg" | "image/webp"; base64: string };

/** Ask 1–128 named questions about `state`. Answers come back keyed by the same names. */
export async function decide<Q extends Record<string, Question>>(
  state: string | object,
  questions: Q,
  opts: { model?: string; images?: Image[] } = {},
) {
  const apiKey = process.env.SUBQ_API_KEY;
  if (!apiKey) throw new Error("SUBQ_API_KEY is not set (see web/.env.example)");

  const res = await fetch(`${BASE_URL}/systemone`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? SUBQ_MODEL,
      state,
      questions,
      ...(opts.images?.length ? { images: opts.images } : {}),
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`SubQ ${res.status}: ${body.slice(0, 500)}`);
  const json = JSON.parse(body);
  return {
    model: json.model as string,
    answers: json.answers as { [K in keyof Q]: Answer },
    usage: json.usage as { input_tokens: number; output_tokens: number },
  };
}
