import { compose, INTENTS, type Intent } from "@/lib/answer";
import { buildGraph, serializeForQuery, type GbEvent } from "@/lib/beliefEngine";
import { getDb } from "@/lib/mongodb";
import { decide, type Question } from "@/lib/subq";

// POST /api/query  { runId, question, upToSeq? }  (PLAN §4.8)
// 1. Rebuild the belief graph up to the scrubber position.
// 2. SubQ Snap: classify the question's intent, pick the focus hypothesis/topic, and score every node's
//    relevance (calibrated probabilities; one call; input-only cost).
// 3. Compose the answer from the agent's recorded words + harness numbers; cite node IDs (only IDs in the graph).
export async function POST(request: Request) {
  try {
    const { runId, question, upToSeq } = (await request.json()) as { runId: string; question: string; upToSeq?: number };
    if (!runId || !question?.trim()) return Response.json({ error: "runId and question are required" }, { status: 400 });

    const db = await getDb();
    const events = (await db
      .collection("events")
      .find({ run_id: runId, ...(upToSeq ? { seq: { $lte: upToSeq } } : {}) }, { projection: { _id: 0 } })
      .sort({ seq: 1 })
      .toArray()) as unknown as GbEvent[];
    const g = buildGraph(events, upToSeq ?? Number.POSITIVE_INFINITY);
    const hyps = Object.values(g.hypotheses);
    if (!hyps.length) return Response.json({ answer: { lead: "No hypotheses recorded yet.", items: [], cited: [], intent: "overview", focus: null } });

    const questions: Record<string, Question> = {
      intent: { type: "choice", instructions: "What is the user's question asking for?", criteria: { ...INTENTS } },
      focus: {
        type: "choice",
        instructions: "Which single hypothesis is the user's question mainly about? Answer none if it isn't about one.",
        criteria: {
          none: "The question is not about one specific hypothesis",
          ...Object.fromEntries(hyps.map((h) => [h.id, `${h.claim.slice(0, 180)} (topic: ${h.topic})`])),
        },
      },
    };
    const nodes = [...hyps.map((h) => ({ id: h.id, text: `hypothesis ${h.id} (${h.status}): ${h.claim.slice(0, 200)}` })),
      ...g.experiments.map((e) => ({ id: e.id, text: `experiment ${e.id} (${e.outcome}) testing ${e.hypothesisIds.join(",")}${e.note ? `: ${e.note.slice(0, 160)}` : ""}` }))]
      .slice(0, 125);
    for (const n of nodes) {
      questions[`rel_${n.id}`] = {
        type: "noul",
        instructions: `Is ${n.text} directly relevant evidence for answering the user's question?`,
        criteria: { true: "It is needed to answer the question", false: "It is unrelated to the question" },
      };
    }

    const state = `${serializeForQuery(g)}\n\nUSER QUESTION: ${question.trim()}`;
    const { answers, usage, model } = await decide(state, questions);
    const intentAns = answers.intent;
    const focusAns = answers.focus;
    const intent = (intentAns?.type === "choice" ? intentAns.choice : "overview") as Intent;
    const focus = focusAns?.type === "choice" && focusAns.choice !== "none" && g.hypotheses[focusAns.choice] ? focusAns.choice : null;
    const rel: Record<string, number> = {};
    for (const n of nodes) {
      const a = answers[`rel_${n.id}`];
      if (a?.type === "noul") rel[n.id] = a.noul;
    }
    // Relevant = P >= 0.5. If nothing clears it, fall back to the single best node (if it's at least plausible).
    const top = Object.entries(rel).sort((a, b) => b[1] - a[1]);
    const threshold = top.some(([, p]) => p >= 0.5) ? 0.5 : Math.max(0.15, top[0]?.[1] ?? 1);
    const answer = compose(g, intent in INTENTS ? intent : "overview", focus, rel, threshold);
    answer.cited = answer.cited.filter((id) => g.hypotheses[id] || g.experiments.some((e) => e.id === id)); // drop unknown IDs

    return Response.json({
      answer,
      relevance: rel,
      confidence: intentAns?.type === "choice" ? intentAns.confidence : null,
      seq: g.seq,
      model,
      usage,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
