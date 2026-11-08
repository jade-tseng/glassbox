"""Look at the visible runtime traces (the agent's only evidence). Read-only; the agent can't edit this tool.

  python3 traces.py list [N]                  first N traces: id, span count, total duration
  python3 traces.py show <i|trace_id> [N]     one trace as a call tree (start offset, duration, service, operation)
  python3 traces.py grep <text> [N]           spans whose service/operation/tags/events contain <text>
  python3 traces.py stats "<service> <op>"    count per trace, duration p50/p90/max (ms), error rate, sample tags
  python3 traces.py ops                       every distinct "service operation" (names only, no structure)

Every output is an observation of the real system; nothing here is inferred.
"""

import json
import statistics
import sys
from pathlib import Path

TRACES = Path(__file__).resolve().parent / "traces.jsonl"
if not TRACES.exists():
    TRACES = Path.cwd() / "traces.jsonl"


def load():
    return [json.loads(line) for line in TRACES.read_text().splitlines() if line.strip()]


def pick(traces, key):
    if key.isdigit():
        return traces[int(key)]
    return next(t for t in traces if t["trace_id"].startswith(key))


def name(s):
    return f"{s['service']} {s['operation']}"


def show(t, limit=60):
    kids = {}
    for s in t["spans"]:
        kids.setdefault(s["parent"], []).append(s)
    ids = {s["span"] for s in t["spans"]}
    roots = [s for s in t["spans"] if s["parent"] not in ids]
    out = []

    def walk(s, depth):
        if len(out) >= limit:
            return
        err = " ERROR" if s["tags"].get("error") in (True, "true") else ""
        ev = f"  events={s['events']}" if s["events"] else ""
        out.append(f"{s['start_us'] / 1000:9.1f}ms +{s['duration_us'] / 1000:8.1f}ms  {'  ' * depth}{name(s)}{err}{ev}")
        for c in sorted(kids.get(s["span"], []), key=lambda x: x["start_us"]):
            walk(c, depth + 1)

    for r in roots:
        walk(r, 0)
    print(f"trace {t['trace_id']}  ({len(t['spans'])} spans; showing {len(out)})")
    print("\n".join(out))


def main():
    traces = load()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    args = sys.argv[2:]
    if cmd == "list":
        n = int(args[0]) if args else 20
        print(f"{len(traces)} visible traces")
        for i, t in enumerate(traces[:n]):
            dur = max(s["start_us"] + s["duration_us"] for s in t["spans"]) / 1000
            print(f"{i:3d}  {t['trace_id'][:16]}  {len(t['spans']):3d} spans  {dur:8.1f}ms")
    elif cmd == "show":
        show(pick(traces, args[0]), int(args[1]) if len(args) > 1 else 60)
    elif cmd == "grep":
        needle, n = args[0].lower(), int(args[1]) if len(args) > 1 else 20
        hits = 0
        for i, t in enumerate(traces):
            for s in t["spans"]:
                blob = json.dumps([s["service"], s["operation"], s["tags"], s["events"]]).lower()
                if needle in blob:
                    print(f"trace {i:3d} {s['start_us'] / 1000:9.1f}ms +{s['duration_us'] / 1000:7.1f}ms  {name(s)}  tags={json.dumps(s['tags'])[:160]}  events={s['events'][:3]}")
                    hits += 1
                    if hits >= n:
                        return
        print(f"({hits} matches)")
    elif cmd == "stats":
        target = args[0]
        per_trace, durs, errs = [], [], 0
        sample = None
        for t in traces:
            spans = [s for s in t["spans"] if name(s) == target]
            per_trace.append(len(spans))
            for s in spans:
                durs.append(s["duration_us"] / 1000)
                errs += s["tags"].get("error") in (True, "true")
                sample = sample or s["tags"]
        if not durs:
            print(f"no spans named '{target}'. Try: python3 traces.py ops")
            return
        q = statistics.quantiles(durs, n=10) if len(durs) > 1 else [durs[0]] * 9
        print(f"{target}: {len(durs)} spans in {sum(1 for c in per_trace if c)}/{len(traces)} traces")
        print(f"  per trace: min {min(per_trace)}, median {statistics.median(per_trace)}, max {max(per_trace)}")
        print(f"  duration ms: p50 {statistics.median(durs):.1f}, p90 {q[8]:.1f}, max {max(durs):.1f}")
        print(f"  error rate: {errs / len(durs):.3f}")
        print(f"  sample tags: {json.dumps(sample)[:300]}")
    elif cmd == "ops":
        seen = sorted({name(s) for t in traces for s in t["spans"]})
        print("\n".join(seen))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
