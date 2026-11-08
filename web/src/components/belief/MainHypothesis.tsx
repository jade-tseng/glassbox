"use client";

// The run's main hypothesis. Clicking it opens a glass panel over the graph where a visitor can describe a
// different scenario; it's sent to the same intake as /new (the worker's intake agent interprets it), then the
// conversation continues on /new?case=<id>.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const KEY_STORAGE = "glassbox.accessKey"; // shared with /new

export function MainHypothesis({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const openPanel = () => {
    try {
      setKey(localStorage.getItem(KEY_STORAGE) ?? "");
    } catch {
      /* storage unavailable */
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    area.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit() {
    setErr(null);
    if (text.trim().length < 10) return setErr("Describe the scenario in a sentence or two.");
    if (!key.trim()) return setErr("Enter the access key to start a run.");
    setBusy(true);
    try {
      try {
        localStorage.setItem(KEY_STORAGE, key.trim());
      } catch {
        /* storage unavailable */
      }
      const r = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key.trim()}` },
        body: JSON.stringify({ action: "intake", text: text.trim() }),
      });
      const j = await r.json();
      if (!r.ok || !j.case?._id) throw new Error(j.error ?? `request failed (${r.status})`);
      router.push(`/new?case=${encodeURIComponent(j.case._id)}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPanel}
        className="group block max-w-[70ch] cursor-text rounded-[6px] text-left text-[15px] leading-6 text-scope-text/85 transition-colors duration-150 hover:text-scope-text"
        aria-label="Main hypothesis. Click to try a different scenario."
      >
        <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-scope-muted">Main hypothesis · </span>
        <span className="underline decoration-scope-line decoration-dashed underline-offset-4 transition-colors duration-150 group-hover:decoration-scope-muted">
          {children}
        </span>
        <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.08em] text-scope-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          ✎ try another
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Try a different scenario"
          className="anim-glass-in absolute inset-x-0 top-0 z-30 max-w-[760px] rounded-[6px] border p-5 md:p-6"
          style={{
            background: "rgba(22,26,30,.62)",
            backdropFilter: "blur(14px) saturate(1.2)",
            WebkitBackdropFilter: "blur(14px) saturate(1.2)",
            borderColor: "rgba(230,234,236,.16)",
          }}
        >
          <div className="flex items-center justify-between">
            <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-scope-muted">Main hypothesis · your scenario</p>
            <button type="button" onClick={() => setOpen(false)} className="font-mono text-[14px] text-scope-muted hover:text-scope-text" aria-label="Close">
              ✕
            </button>
          </div>
          <textarea
            ref={area}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
            rows={4}
            placeholder="e.g. count_primes in /Users/me/code/primes can be 10× faster while still returning 25,997 for 300,000. bench.py prints the seconds as JSON."
            className="mt-3 w-full resize-y rounded-[6px] border bg-transparent p-3 text-[15px] leading-6 text-scope-text placeholder:text-scope-muted/70 focus:outline-none"
            style={{ borderColor: "rgba(230,234,236,.16)" }}
          />
          <p className="mt-2 text-[13px] text-scope-muted">What to improve, where the code is, how to measure it, and how to tell it still works.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Access key"
              aria-label="Access key"
              className="h-9 w-40 rounded-[6px] border bg-transparent px-3 font-mono text-[12px] text-scope-text placeholder:text-scope-muted/70 focus:outline-none"
              style={{ borderColor: "rgba(230,234,236,.16)" }}
            />
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="h-9 rounded-[6px] border border-scope-text px-4 font-mono text-[12px] uppercase tracking-[0.08em] text-scope-text transition-colors duration-150 hover:bg-scope-text hover:text-scope [&:disabled]:opacity-50"
            >
              {busy ? "Sending…" : "Map this →"}
            </button>
            <span className="font-mono text-[11px] text-scope-muted">⌘↵</span>
          </div>
          {err && <p className="mt-3 text-[13px] text-danger-fill">{err}</p>}
        </div>
      )}
    </div>
  );
}
