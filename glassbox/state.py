"""Derived state over the event log (pure functions). Shared by tools and hooks in one process."""

from __future__ import annotations

from typing import Any

Event = dict[str, Any]


def hypotheses(events: list[Event]) -> dict[str, dict]:
    """id -> {claim, topic, reason, prediction, code_region, status, tests: [experiment ids], links}."""
    hs: dict[str, dict] = {}
    for ev in events:
        t = ev["type"]
        if t == "hypothesis_proposed":
            h = hs.setdefault(ev["id"], {"id": ev["id"], "tests": [], "links": [], "status": "open"})
            h.update({k: ev[k] for k in ("claim", "topic", "reason", "prediction", "code_region") if k in ev})
            h["status"] = "open"
        elif t in ("experiment_run", "experiment_failed"):
            for hid in ev.get("hypothesis_ids", []):
                if hid in hs:
                    hs[hid]["tests"].append(ev["id"])
        elif t == "hypothesis_linked":
            if ev["from"] in hs:
                hs[ev["from"]]["links"].append({"to": ev["to"], "relation": ev["relation"]})
        elif t == "hypothesis_closed" and ev["id"] in hs:
            hs[ev["id"]]["status"] = ev["status"]
            hs[ev["id"]]["summary"] = ev.get("summary")
    return hs


def armed(events: list[Event]) -> list[str]:
    """Hypotheses proposed (or re-proposed) since the last experiment. The gate requires at least one."""
    out: list[str] = []
    for ev in events:
        if ev["type"] == "hypothesis_proposed":
            if ev["id"] not in out:
                out.append(ev["id"])
        elif ev["type"] in ("experiment_run", "experiment_failed"):
            out = []
        elif ev["type"] == "hypothesis_closed" and ev["id"] in out:
            out.remove(ev["id"])
    return out


def experiments(events: list[Event]) -> list[Event]:
    return [ev for ev in events if ev["type"] in ("experiment_run", "experiment_failed")]


def last_experiment(events: list[Event]) -> Event | None:
    exps = experiments(events)
    return exps[-1] if exps else None


def topics(events: list[Event]) -> list[str]:
    seen: list[str] = []
    for ev in events:
        if ev["type"] == "hypothesis_proposed" and ev.get("topic") not in seen:
            seen.append(ev["topic"])
    return seen


def baseline_metric(events: list[Event]) -> int | None:
    for ev in events:
        if ev["type"] == "run_started":
            return ev.get("baseline", {}).get("total_read_rows")
    return None


def best_metric(events: list[Event]) -> int | None:
    best = baseline_metric(events)
    for ev in events:
        if ev["type"] == "experiment_run" and ev.get("correct") and ev.get("metric_after") is not None:
            best = ev["metric_after"] if best is None else min(best, ev["metric_after"])
    return best


def beliefs_summary(events: list[Event]) -> str:
    """Plain-text working memory for the agent (get_beliefs)."""
    hs = hypotheses(events)
    exps = {e["id"]: e for e in experiments(events)}
    base, best = baseline_metric(events), best_metric(events)
    lines = [f"Metric: total read_rows (lower is better). Baseline {base:,}; best so far {best:,}." if base and best else ""]
    arm = armed(events)
    lines.append(f"Armed for next experiment: {', '.join(arm) if arm else 'none (propose before running bench)'}")
    for topic in topics(events):
        lines.append(f"\n## Topic: {topic}")
        for h in (h for h in hs.values() if h.get("topic") == topic):
            p = h.get("prediction", {})
            lines.append(f"- {h['id']} [{h['status']}] {h.get('claim')} (predicted {p.get('direction')} @ {p.get('confidence')})")
            for eid in h["tests"]:
                e = exps.get(eid, {})
                if e.get("type") == "experiment_failed":
                    lines.append(f"    {eid}: FAILED {e.get('error_kind')}: {str(e.get('message', ''))[:120]}")
                else:
                    before, after = e.get("metric_before"), e.get("metric_after")
                    delta = f"{before:,} -> {after:,}" if before is not None and after is not None else "?"
                    lines.append(f"    {eid}: {delta}{' (new best)' if e.get('beats_best') else ''}")
            for link in h["links"]:
                lines.append(f"    link: {link['relation']} {link['to']}")
            if h.get("summary"):
                lines.append(f"    summary: {h['summary']}")
    if not hs:
        lines.append("No hypotheses yet.")
    return "\n".join(line for line in lines if line is not None)
