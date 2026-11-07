import { decide } from "@/lib/subq";

// GET /api/subq/ping — confirms SUBQ_API_KEY works with a tiny Glassbox-shaped decision:
// does an experiment's diff actually test the hypothesis the agent stated?
export async function GET() {
  try {
    const { model, answers, usage } = await decide(
      {
        hypothesis: "Adding EventDate to the ORDER BY key will cut read_rows for time-filtered queries.",
        diff: "- ORDER BY (CounterID)\n+ ORDER BY (CounterID, EventDate)",
      },
      {
        on_topic: {
          type: "noul",
          instructions: "Does the diff test the stated hypothesis?",
          criteria: { true: "The change is what the hypothesis describes", false: "The change is unrelated" },
        },
      },
    );
    return Response.json({ ok: true, model, answers, usage });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
