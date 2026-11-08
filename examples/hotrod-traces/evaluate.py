"""Score a reconstruction (model.json) against HELD-OUT runtime traces the agent never sees.

  python3 evaluate.py --workdir .        writes ../result.json and prints a short line for the agent

model.json:
{
  "services": ["frontend", ...],
  "calls": [{"parent": "<service> <operation>", "child": "<service> <operation>",
             "per_trace": 10, "parallel": true, "max_concurrency": 3}, ...],
  "latency_ms": {"<service> <operation>": {"p50": 300, "p90": 900}, ...},
  "error_rate": {"<service> <operation>": 0.05, ...}
}

Score (0-100): services 10 · call edges 30 (F1) · calls per trace 20 · parallelism 15 · latency 15 · errors 10.
Feedback gives sub-scores and counts only; it never reveals the held-out ground truth.
"""

import argparse
import json
import statistics
import sys
import time
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
HELDOUT = HERE / "heldout" / "traces.jsonl"


def name(s):
    return f"{s['service']} {s['operation']}"


def truth():
    traces = [json.loads(line) for line in HELDOUT.read_text().splitlines() if line.strip()]
    services = {s["service"] for t in traces for s in t["spans"]}
    counts = defaultdict(list)  # (parent, child) -> per-trace count
    overlap = defaultdict(list)  # (parent, child) -> max concurrent children per parent span
    durs, errs = defaultdict(list), defaultdict(int)
    for t in traces:
        by_id = {s["span"]: s for s in t["spans"]}
        per = defaultdict(int)
        kids = defaultdict(list)
        for s in t["spans"]:
            durs[name(s)].append(s["duration_us"] / 1000)
            errs[name(s)] += s["tags"].get("error") in (True, "true")
            p = by_id.get(s["parent"])
            if p:
                per[(name(p), name(s))] += 1
                kids[(p["span"], name(p), name(s))].append(s)
        for e, c in per.items():
            counts[e].append(c)
        for (_, pn, cn), ch in kids.items():
            pts = sorted([(c["start_us"], 1) for c in ch] + [(c["start_us"] + c["duration_us"], -1) for c in ch])
            cur = peak = 0
            for _, d in pts:
                cur += d
                peak = max(peak, cur)
            overlap[(pn, cn)].append(peak)
    edges = set(counts)
    for e in edges:  # edges absent from a trace count as 0 there
        counts[e] += [0] * (len(traces) - len(counts[e]))
    lat = {k: (statistics.median(v), statistics.quantiles(v, n=10)[8] if len(v) > 1 else v[0]) for k, v in durs.items()}
    err = {k: errs[k] / len(durs[k]) for k in durs}
    conc = {e: max(v) for e, v in overlap.items()}
    return services, edges, {e: statistics.median(v) for e, v in counts.items()}, conc, lat, err


def close(pred, true, tol):
    if pred is None:
        return 0.0
    if true == 0:
        return 1.0 if abs(pred) <= tol else 0.0
    rel = abs(pred - true) / abs(true)
    return 1.0 if rel <= tol else max(0.0, 1 - (rel - tol) / (2 * tol + 0.5))


def score(model: dict) -> dict:
    services, edges, per_trace, conc, lat, err = truth()
    sub = {}
    ms = set(model.get("services", []))
    sub["services"] = len(ms & services) / len(ms | services) if ms | services else 0

    calls = {(c.get("parent", ""), c.get("child", "")): c for c in model.get("calls", []) if isinstance(c, dict)}
    hit = edges & set(calls)
    p = len(hit) / len(calls) if calls else 0
    r = len(hit) / len(edges)
    sub["call_edges"] = 2 * p * r / (p + r) if p + r else 0

    sub["calls_per_trace"] = sum(close(calls[e].get("per_trace"), per_trace[e], 0.1) for e in hit) / len(edges)

    multi = [e for e in edges if per_trace[e] >= 2]
    par = 0.0
    for e in multi:
        if e not in calls:
            continue
        truly_parallel = conc.get(e, 1) >= 2
        par += 0.6 * (bool(calls[e].get("parallel")) == truly_parallel)
        mc = calls[e].get("max_concurrency")
        par += 0.4 * (isinstance(mc, (int, float)) and abs(mc - conc.get(e, 1)) <= 1)
    sub["parallelism"] = par / len(multi) if multi else 1.0

    ml = model.get("latency_ms", {}) or {}
    sub["latency"] = sum(
        0.5 * close((ml.get(k) or {}).get("p50"), v[0], 0.25) + 0.5 * close((ml.get(k) or {}).get("p90"), v[1], 0.35)
        for k, v in lat.items()) / len(lat)

    me = model.get("error_rate", {}) or {}
    sub["errors"] = sum(1.0 if abs((me.get(k) or 0) - v) <= 0.03 else 0.0 for k, v in err.items()) / len(err)

    weights = {"services": 10, "call_edges": 30, "calls_per_trace": 20, "parallelism": 15, "latency": 15, "errors": 10}
    total = round(sum(weights[k] * sub[k] for k in weights), 2)
    return {"score": total, "breakdown": {k: round(v * 100, 1) for k, v in sub.items()},
            "edges": {"matched": len(hit), "missing": len(edges - set(calls)), "extra": len(set(calls) - edges)}}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workdir", type=Path, default=Path("."))
    a = ap.parse_args()
    out_path = a.workdir.resolve().parent / "result.json"
    result = {"score": None, "valid": False, "error": None, "finished_at": time.time()}
    try:
        model = json.loads((a.workdir / "model.json").read_text())
        if not isinstance(model, dict):
            raise ValueError("model.json must be a JSON object")
        result.update(score(model), valid=True)
    except Exception as e:  # noqa: BLE001  an unparseable model is an invalid experiment, not a crash
        result["error"] = {"kind": "invalid_model", "message": str(e)[:300]}
    out_path.write_text(json.dumps(result))
    print(json.dumps({k: result.get(k) for k in ("score", "valid", "breakdown", "edges", "error")}))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
