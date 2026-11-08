"use client";

// The run's main hypothesis. Clicking it makes the same text editable in place (same block, same size, a glass
// tint), so a visitor can rewrite it as a different scenario. Submitting sends it to the same intake as /new
// (the worker's intake agent interprets it), then the conversation continues on /new?case=<id>.

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const KEY_STORAGE = "glassbox.accessKey"; // shared with /new

export function MainHypothesis({ text: original }: { text: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const field = useRef<HTMLSpanElement>(null);

  const start = () => {
    if (editing) return;
    try {
      setKey(localStorage.getItem(KEY_STORAGE) ?? "");
    } catch {
      /* storage unavailable */
    }
    setEditing(true);
  };

  const cancel = () => {
    if (field.current) field.current.textContent = original;
    setEditing(false);
    setErr(null);
  };

  // Select the text so typing replaces it.
  useLayoutEffect(() => {
    const el = field.current;
    if (!editing || !el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function submit() {
    setErr(null);
    const t = (field.current?.innerText ?? "").trim();
    if (t.length < 10 || t === original.trim()) return setErr("Rewrite it as your own scenario first.");
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
        body: JSON.stringify({ action: "intake", text: t }),
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
    <div className="max-w-[70ch]">
      <p
        onClick={start}
        className={`-mx-3 -my-2 rounded-[6px] border px-3 py-2 text-[15px] leading-6 transition-colors duration-150 ${
          editing
            ? "border-[rgba(230,234,236,.18)] bg-[rgba(22,26,30,.62)] text-scope-text backdrop-blur-md"
            : "cursor-text border-transparent text-scope-text/85 hover:bg-[rgba(22,26,30,.6)] hover:text-scope-text"
        }`}
      >
        <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-scope-muted">Main hypothesis · </span>
        <span
          ref={field}
          role={editing ? "textbox" : "button"}
          tabIndex={0}
          aria-label={editing ? "Your scenario" : "Main hypothesis. Click to rewrite it as a different scenario."}
          contentEditable={editing ? "plaintext-only" : false}
          suppressContentEditableWarning
          onKeyDown={(e) => {
            if (!editing && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              start();
            } else if (editing && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className="outline-none"
        >
          {original}
        </span>
      </p>

      {editing && (
        <div className="anim-glass-in mt-4 flex flex-wrap items-center gap-3 font-mono text-[12px]">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Access key"
            aria-label="Access key"
            className="h-8 w-36 rounded-[6px] border bg-transparent px-3 text-scope-text placeholder:text-scope-muted/70 focus:outline-none"
            style={{ borderColor: "rgba(230,234,236,.16)" }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="h-8 rounded-[6px] border border-scope-text px-3 uppercase tracking-[0.08em] text-scope-text transition-colors duration-150 hover:bg-scope-text hover:text-scope [&:disabled]:opacity-50"
          >
            {busy ? "Sending…" : "Map this →"}
          </button>
          <button type="button" onClick={cancel} className="uppercase tracking-[0.08em] text-scope-muted hover:text-scope-text">
            Cancel
          </button>
          {err && <span className="normal-case text-danger-fill">{err}</span>}
        </div>
      )}
    </div>
  );
}
