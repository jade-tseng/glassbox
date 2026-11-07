"use client";

// NL query (PLAN §4.8, §4.9 top). SubQ Snap picks the evidence; the answer is composed from the agent's own
// recorded words + harness numbers. Cited nodes light up in the graph.

import { useState } from "react";
import type { Answer } from "@/lib/answer";
import { Chip, Label } from "./ui";

type Result = { answer: Answer; confidence: number | null; seq: number; model: string; usage: { input_tokens: number } };

const EXAMPLES = ["What worked best?", "Why did ideas get refuted?", "What do you believe about projections?"];

export function QueryBox({
  runId,
  seq,
  onCite,
  onSelect,
}: {
  runId: string;
  seq: number | null; // scrubber position (null = head)
  onCite: (ids: string[]) => void;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setQ(question);
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, question, upToSeq: seq ?? undefined }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? r.statusText);
      setRes(j);
      onCite(j.answer.cited);
    } catch (e) {
      setErr((e as Error).message);
      setRes(null);
      onCite([]);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setRes(null);
    setErr(null);
    setQ("");
    onCite([]);
  }

  return (
    <div className="rounded-[6px] border border-line bg-white">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex items-center gap-3 px-4 py-3"
      >
        <Label className="shrink-0">Ask</Label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Why did you give up on rewriting the time filters?"
          className="min-w-0 flex-1 bg-transparent font-mono text-[14px] text-ink placeholder:text-subtle focus:outline-none"
          aria-label="Ask the run a question"
        />
        {loading ? (
          <span className="anim-shimmer h-2 w-16 rounded-[3px] bg-mist" aria-label="Thinking" />
        ) : res || err ? (
          <button type="button" onClick={clear} className="font-mono text-[12px] text-muted hover:text-ink">
            clear ✕
          </button>
        ) : (
          <button type="submit" className="font-mono text-[12px] text-signal hover:underline">
            ↵ ask
          </button>
        )}
      </form>

      {!res && !err && !loading && (
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-2.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => ask(ex)}
              className="rounded-[3px] border border-line px-2 py-0.5 font-mono text-[12px] text-muted transition-colors duration-150 hover:border-signal hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {err && <p className="border-t border-line px-4 py-3 font-mono text-[12px] text-danger">{err}</p>}

      {res && (
        <div className="border-t border-line px-4 py-4">
          <p className="anim-row-in text-[16px] leading-[24px] text-ink">{res.answer.lead}</p>
          <div className="mt-3 space-y-2">
            {res.answer.items.map((item, i) => (
              <div key={item.id} className="anim-row-in flex gap-3 rounded-[6px] border border-line p-3" style={{ animationDelay: `${(i + 1) * 60}ms` }}>
                <button type="button" onClick={() => onSelect(item.id)} className="shrink-0 self-start" title="Show in graph">
                  <Chip className="border-signal text-signal hover:bg-mist">
                    {item.id} ↗
                  </Chip>
                </button>
                <div className="min-w-0 space-y-1 text-[13px] leading-[19px]">
                  {item.lines.map((line, j) => (
                    <p key={j} className={j === 0 ? "text-ink" : "text-muted"}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 font-mono text-[11px] text-muted">
            Evidence selected by {res.model} · intent {res.answer.intent.replace("_", " ")}
            {res.confidence !== null ? ` (${Math.round(res.confidence * 100)}%)` : ""} · {res.usage.input_tokens.toLocaleString("en-US")} tokens · grounded in{" "}
            {res.answer.cited.length} nodes at seq {res.seq} · text = the agent&apos;s own records + harness numbers
          </div>
        </div>
      )}
    </div>
  );
}
