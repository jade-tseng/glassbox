"""Export a run's event log as a static replay for the web app (offline backup, PLAN §3.4 / §7).

  uv run python -m glassbox.export_replay bg2   ->  web/public/replays/bg2.json
The run view falls back to /replays/<id>.json when /api/events is unreachable.
"""

import json
import sys

from .events import ROOT, RUNS


def main() -> None:
    run_id = sys.argv[1]
    events = [json.loads(line) for line in (RUNS / run_id / "events.jsonl").read_text().splitlines() if line.strip()]
    out = ROOT / "web" / "public" / "replays" / f"{run_id}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(events, separators=(",", ":"), default=str))
    print(f"{len(events)} events -> {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
