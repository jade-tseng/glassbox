"use client";

// New case, in plain language (PLAN §13). The user describes what they want improved; the worker's intake agent
// interprets it (it may read the code), asks only about real ambiguities (verification must be explicit), then
// dry-runs it. Styling per UI.md.

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CaseDoc } from "@/lib/cases";

const KEY_STORAGE = "glassbox.accessKey";
const WORKING = ["intake_requested", "interpreting", "dry_run_requested", "dry_running", "queued", "starting"];
const PLACEHOLDER =
  "e.g. Make count_primes in /Users/me/code/primes faster. bench.py prints the seconds as JSON. It must still return 25,997 for 300,000.";

const STATUS_TEXT: Record<string, string> = {
  intake_requested: "Waiting for the worker…",
  interpreting: "Reading your description and the code…",
  needs_input: "A few questions before this can run.",
  dry_run_requested: "Queued for a dry run…",
  dry_running: "Dry run: measuring the untouched code once…",
  ready: "Dry run passed. Ready to start.",
  dry_run_failed: "The dry run failed. Tell me what to change.",
  invalid: "Something is still missing. Tell me what to change.",
  queued: "Queued…",
  starting: "Starting the agent…",
  running: "Running.",
  finished: "Finished.",
  failed: "The run failed.",
};

export default function NewCasePage() {
  const [key, setKey] = useState("");
  const [text, setText] = useState("");
  const [doc, setDoc] = useState<CaseDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  // Restore access key and an in-progress case (?case=<id>) so the page can be reopened.
  useEffect(() => {
    try {
      setKey(localStorage.getItem(KEY_STORAGE) ?? "");
    } catch {
      /* storage unavailable */
    }
    const id = new URLSearchParams(location.search).get("case");
    if (id) fetch(`/api/cases/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => j.case && setDoc(j.case));
  }, []);

  // Poll while the worker is busy with this case.
  useEffect(() => {
    if (!doc || !(WORKING.includes(doc.status) || doc.status === "running")) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/cases/${doc._id}`, { cache: "no-store" });
      const j = await r.json();
      if (j.case) setDoc(j.case);
      setTick((n) => n + 1);
    }, 1500);
    return () => clearInterval(t);
  }, [doc]);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      localStorage.setItem(KEY_STORAGE, key);
    } catch {
      /* ignore */
    }
    try {
      const r = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.errors ? j.errors.join("; ") : j.error);
      setDoc(j.case);
      setText("");
      setWaitingSince(Date.now());
      history.replaceState(null, "", `/new?case=${j.case._id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const status = doc?.status;
  const working = status ? WORKING.includes(status) : false;
  const workerSlow = (status === "intake_requested" || status === "dry_run_requested" || status === "queued") && waitingSince !== null && Date.now() - waitingSince > 10000;
  void tick;
  const spec = doc?.spec;
  const canAnswer = !!doc && !working && status !== "running";

  return (
    <div className="min-h-screen bg-frost text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-frost">
        <nav className="mx-auto flex h-14 max-w-[860px] items-center justify-between px-4 md:px-10">
          <Link href="/" className="text-[18px] font-medium tracking-[-0.02em]">
            glassbox
          </Link>
          <Link href="/run" className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted hover:text-ink">
            All runs
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[860px] space-y-5 px-4 py-10 md:px-10">
        <div>
          <Label>New case</Label>
          <h1 className="mt-2 text-[32px] font-medium leading-[1.05] tracking-[-0.03em] md:text-[44px]">What should the agent improve?</h1>
          <p className="mt-2 max-w-[640px] text-[14px] leading-[20px] text-muted">
            Describe it in your own words: what to improve, where the code is, how you measure it, and how to tell it still works.
            Glassbox reads the code and only asks about what&apos;s unclear.
          </p>
        </div>

        {/* Conversation */}
        {doc?.conversation && doc.conversation.length > 0 && (
          <div className="space-y-3">
            {doc.conversation.map((m, i) => (
              <div key={i} className={`rounded-[6px] border p-4 ${m.role === "user" ? "border-line bg-white" : "border-signal/40 bg-white"}`}>
                <Label className="mb-1 text-[11px]">{m.role === "user" ? "You" : "Glassbox"}</Label>
                <p className="whitespace-pre-wrap text-[14px] leading-[21px]">{m.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Clarifying questions with clickable suggestions */}
        {status === "needs_input" && doc?.questions && doc.questions.length > 0 && (
          <div className="rounded-[6px] border border-signal bg-white p-4">
            <Label className="mb-2">Questions</Label>
            <ul className="space-y-3">
              {doc.questions.map((q, i) => (
                <li key={i} className="text-[14px] leading-[20px]">
                  <span className={q.field === "verify" ? "font-medium" : ""}>{q.question}</span>
                  {q.suggestion && (
                    <button
                      type="button"
                      onClick={() => {
                        setText((t) => (t ? `${t}\n` : "") + q.suggestion);
                        answerRef.current?.focus();
                      }}
                      className="mt-1 block rounded-[3px] border border-line px-2 py-0.5 text-left font-mono text-[12px] text-muted hover:border-signal hover:text-ink"
                    >
                      Use: {q.suggestion}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* What Glassbox understood */}
        {spec && spec.measure && (
          <div className="rounded-[6px] border border-line bg-white">
            <div className="border-b border-line px-4 py-3">
              <Label>What I understood</Label>
            </div>
            <dl className="divide-y divide-line text-[14px]">
              <Row k="Goal">{spec.name ? <b className="font-medium">{spec.name}. </b> : null}{spec.goal}</Row>
              <Row k="Code">{spec.workspace?.path || <Missing />}</Row>
              <Row k="May change">{spec.editable?.length ? spec.editable.join(", ") : <Missing />}</Row>
              <Row k="Measure">
                {spec.measure?.command ? (
                  <>
                    <code className="font-mono text-[13px]">{spec.measure.command}</code>
                    <span className="text-muted">
                      {" "}
                      → {spec.metric?.label || "?"}
                      {spec.metric?.unit ? ` (${spec.metric.unit})` : ""}
                      {spec.measure.parse?.mode === "json_key" ? ` from JSON key "${spec.measure.parse.key}"` : spec.measure.parse?.mode === "regex" ? ` via /${spec.measure.parse.pattern}/` : ", last number printed"}
                    </span>
                  </>
                ) : (
                  <Missing />
                )}
              </Row>
              <Row k="Better is">{spec.metric?.direction === "higher" ? "↑ higher" : spec.metric?.direction === "lower" ? "↓ lower" : <Missing />}</Row>
              <Row k="Verify" emphasis>
                {spec.verify?.mode === "test_command" && (
                  <>
                    tests must pass: <code className="font-mono text-[13px]">{spec.verify.command}</code>
                  </>
                )}
                {spec.verify?.mode === "json_flag" && <>the measure output must report &quot;{spec.verify.key}&quot;: true</>}
                {spec.verify?.mode === "same_output" && (
                  <>
                    output must not change: <code className="font-mono text-[13px]">{spec.verify.command}</code>
                  </>
                )}
                {spec.verify?.mode === "none" && <span className="text-warning">no correctness check (results will be unverified)</span>}
                {!spec.verify?.mode && <Missing />}
              </Row>
              <Row k="Budget">
                {spec.budget?.max_experiments} experiments · {spec.budget?.backend} {spec.budget?.model} · max ${spec.budget?.budget_usd}
              </Row>
            </dl>
          </div>
        )}

        {/* Status / dry run / start */}
        {doc && (
          <div className="flex flex-wrap items-center gap-3 rounded-[6px] border border-line bg-white px-4 py-3">
            {working && <span className="anim-shimmer h-2 w-16 rounded-[3px] bg-mist" aria-hidden />}
            <span className="font-mono text-[13px]">{STATUS_TEXT[doc.status] ?? doc.status}</span>
            {doc.dry_run?.ok && (
              <span className="font-mono text-[13px] text-success">
                baseline {doc.dry_run.value} {spec?.metric?.unit} · check ✓
              </span>
            )}
            {doc.dry_run && !doc.dry_run.ok && (
              <span className="font-mono text-[12px] text-danger">
                {doc.dry_run.errors?.join("; ") ?? `${doc.dry_run.error?.kind}: ${doc.dry_run.error?.message?.slice(0, 200)}`}
              </span>
            )}
            {status === "ready" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => call({ action: "start", id: doc._id })}
                className="ml-auto rounded-[6px] border border-ink bg-ink px-4 py-2 font-mono text-[13px] text-white hover:bg-black disabled:opacity-40"
              >
                Start run
              </button>
            )}
            {doc.run_id && (
              <Link href={`/run/${doc.run_id}`} className="ml-auto font-mono text-[13px] text-signal hover:underline">
                Watch {doc.run_id} →
              </Link>
            )}
          </div>
        )}
        {workerSlow && (
          <p className="font-mono text-[12px] text-warning">
            No worker has picked this up yet. Start one on the machine with the code: <code className="text-ink">uv run python -m glassbox.worker</code>
          </p>
        )}

        {/* Composer: first description, or answers / corrections */}
        {(!doc || canAnswer) && (
          <div className="space-y-3 rounded-[6px] border border-line bg-white p-4">
            <textarea
              ref={answerRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={doc ? "Answer the questions or correct anything above…" : PLACEHOLDER}
              className="min-h-[120px] w-full resize-y bg-transparent text-[15px] leading-[22px] placeholder:text-subtle focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Access key"
                autoComplete="off"
                className="w-48 rounded-[6px] border border-line px-3 py-1.5 font-mono text-[12px] focus:border-signal focus:outline-none"
              />
              <button
                type="button"
                disabled={busy || !key || text.trim().length < (doc ? 1 : 10)}
                onClick={() => call(doc ? { action: "clarify", id: doc._id, text } : { action: "intake", text })}
                className="ml-auto rounded-[6px] border border-ink px-4 py-2 font-mono text-[13px] hover:bg-ink hover:text-white disabled:opacity-40"
              >
                {doc ? "Send" : "Describe"}
              </button>
            </div>
            {err && <p className="font-mono text-[12px] text-danger">{err}</p>}
          </div>
        )}
      </main>
    </div>
  );
}

function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-[12px] uppercase tracking-[0.08em] text-muted ${className}`}>{children}</div>;
}

function Row({ k, children, emphasis }: { k: string; children: ReactNode; emphasis?: boolean }) {
  return (
    <div className={`grid grid-cols-[120px_1fr] gap-3 px-4 py-2.5 ${emphasis ? "bg-frost" : ""}`}>
      <dt className={`font-mono text-[11px] uppercase tracking-[0.08em] ${emphasis ? "text-signal" : "text-muted"}`}>{k}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="font-mono text-[12px] text-warning">not set yet</span>;
}
