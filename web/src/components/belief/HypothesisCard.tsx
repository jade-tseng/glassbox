"use client";

// What one hypothesis was and what it did, opened by clicking its dot in the belief flow.
// Agent words are sans; harness numbers are mono (UI.md §9).

import { fmtRows, isTension, type GraphState, type LinkRelation } from "@/lib/belief/engine";
import { STATUS } from "./layout";

const REL: Record<LinkRelation, string> = { refines: "builds on", depends_on: "builds on", contradicts: "conflicts with" };
const REL_BY: Record<LinkRelation, string> = { refines: "built on by", depends_on: "built on by", contradicts: "conflicts with" };
const STATUS_WORD: Record<string, string> = { open: "still open", confirmed: "held up", refuted: "dropped", abandoned: "dropped" };
const STATUS_CHIP: Record<string, string> = {
  open: "border-scope-line text-scope-text",
  confirmed: "border-transparent bg-mint text-ink",
  refuted: "border-transparent bg-danger-fill text-ink",
  abandoned: "border-scope-line text-scope-muted",
};

const short = (f: string) => f.replace(/^queries\//, "").replace(/\.sql$/, "");

export function HypothesisCard({ state, id, onClose }: { state: GraphState; id: string; onClose: () => void }) {
  const h = state.hypotheses[id];
  if (!h) return null;
  const parents = state.links.filter((l) => l.from === id);
  const children = state.links.filter((l) => l.to === id);
  const tension = isTension(h, state.experiments);
  const label = "font-mono text-[11px] uppercase tracking-[0.08em] text-scope-muted";

  return (
    <div
      role="dialog"
      aria-label={`${id}: what it was and what it did`}
      className="anim-glass-in w-[340px] max-w-[calc(100vw-32px)] rounded-[6px] border p-4 text-scope-text"
      style={{
        background: "rgba(22,26,30,.86)",
        backdropFilter: "blur(14px) saturate(1.2)",
        WebkitBackdropFilter: "blur(14px) saturate(1.2)",
        borderColor: "rgba(230,234,236,.16)",
      }}
    >
      <div className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.08em]">
        <span>{id}</span>
        <span className={`rounded-[3px] border px-1.5 py-px text-[11px] ${STATUS_CHIP[h.status]}`}>{STATUS_WORD[h.status] ?? h.status}</span>
        <button type="button" onClick={onClose} className="ml-auto text-[14px] text-scope-muted hover:text-scope-text" aria-label="Close">
          ✕
        </button>
      </div>

      <p className={`mt-3 ${label}`}>The idea</p>
      <p className="mt-1 text-[14px] leading-[21px]">{h.claim}</p>

      <p className={`mt-3 ${label}`}>What it did</p>
      {h.experiments.length === 0 && <p className="mt-1 text-[13px] text-scope-muted">Not tested yet.</p>}
      {h.experiments.map((eid) => {
        const e = state.experiments[eid];
        const pct = e.after !== null ? ((e.after - e.before) / e.before) * 100 : null;
        const c = e.failed || !e.correct ? STATUS.refutes : e.evidence === "supports" ? STATUS.supports : e.evidence === "weak" ? "#8A949A" : STATUS.refutes;
        return (
          <div key={eid} className="mt-1.5 border-l-2 pl-2.5" style={{ borderColor: c }}>
            {e.files.length > 0 && (
              <p className="font-mono text-[12px] text-scope-muted">
                changed {e.files.map(short).join(", ")}
              </p>
            )}
            <p className="font-mono text-[12px] tabular-nums">
              {e.failed ? (
                <span style={{ color: STATUS.refutes }}>run failed ({e.errorKind})</span>
              ) : (
                <>
                  rows scanned {fmtRows(e.before)} → {fmtRows(e.after!)}{" "}
                  <span style={{ color: c }}>({pct! > 0 ? "+" : ""}{pct!.toFixed(1)}%)</span>
                </>
              )}
              {e.kept !== null && <span className="text-scope-muted"> · {e.kept ? "kept" : "reverted"}</span>}
            </p>
            {e.note && <p className="mt-0.5 text-[12px] leading-[18px] text-scope-text/75">{e.note}</p>}
          </div>
        );
      })}

      <p className="mt-3 font-mono text-[12px] tabular-nums text-scope-muted">
        predicted {h.prior.toFixed(2)} → now{" "}
        <span style={{ color: h.belief >= h.prior ? STATUS.supports : STATUS.refutes }}>{h.belief.toFixed(2)}</span>
      </p>

      {(parents.length > 0 || children.length > 0) && (
        <p className="mt-1 font-mono text-[12px] text-scope-muted">
          {parents.map((l) => `${REL[l.relation]} ${l.to}`).join(" · ")}
          {parents.length > 0 && children.length > 0 ? " · " : ""}
          {children.map((l) => `${REL_BY[l.relation]} ${l.from}`).join(" · ")}
        </p>
      )}

      {tension && (
        <p className="mt-3 text-[12px] text-warn-fill">The agent called this a success, but the measurements barely back it.</p>
      )}
    </div>
  );
}
