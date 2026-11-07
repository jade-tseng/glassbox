"""Event log: the single source of truth (PLAN §3, §4.5).

Every event is appended to runs/<run_id>/events.jsonl synchronously (the loop's own memory) and mirrored to
MongoDB Atlas in a background thread for the web app. Mongo is never read by the loop; if it is unreachable
the run continues and the JSONL remains the replay backup.
"""

from __future__ import annotations

import json
import os
import queue
import sys
import threading
import time
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
RUNS = ROOT / "runs"

Source = Literal["mcp", "hook", "system"]
EVENT_TYPES = {
    "run_started", "hypothesis_proposed", "hypothesis_linked", "experiment_run", "experiment_failed",
    "experiment_interpreted", "hypothesis_closed", "gate_blocked", "agent_action", "agent_message", "run_finished",
}


class MongoMirror:
    """Fire-and-forget mirror of events into Atlas (db from MONGODB_DB, collections `events` and `runs`)."""

    def __init__(self) -> None:
        load_dotenv(ROOT / "web" / ".env.local")
        self.q: queue.Queue = queue.Queue()
        self.enabled = bool(os.environ.get("MONGODB_URI")) and os.environ.get("GLASSBOX_NO_MONGO") != "1"
        self.ok = False
        if self.enabled:
            threading.Thread(target=self._worker, daemon=True).start()

    def _worker(self) -> None:
        try:
            from pymongo import ASCENDING, MongoClient

            client = MongoClient(os.environ["MONGODB_URI"], appName="glassbox-runner", serverSelectionTimeoutMS=8000)
            db = client[os.environ.get("MONGODB_DB", "glassbox")]
            db.events.create_index([("run_id", ASCENDING), ("seq", ASCENDING)], unique=True)
            self.ok = True
        except Exception as e:  # noqa: BLE001
            print(f"[glassbox] Mongo mirror disabled: {e}", file=sys.stderr)
            return
        while True:
            kind, doc = self.q.get()
            for attempt in range(5):
                try:
                    if kind == "event":
                        db.events.replace_one({"run_id": doc["run_id"], "seq": doc["seq"]}, doc, upsert=True)
                    else:
                        db.runs.update_one({"_id": doc["_id"]}, {"$set": doc}, upsert=True)
                    break
                except Exception as e:  # noqa: BLE001
                    if attempt == 4:
                        print(f"[glassbox] Mongo write failed ({kind} {doc.get('seq', '')}): {e}", file=sys.stderr)
                    time.sleep(1 + attempt)
            self.q.task_done()

    def put(self, kind: str, doc: dict) -> None:
        if self.enabled:
            self.q.put((kind, json.loads(json.dumps(doc, default=str))))

    def flush(self, timeout: float = 15) -> None:
        if not self.enabled:
            return
        end = time.time() + timeout
        while self.q.unfinished_tasks and time.time() < end:
            time.sleep(0.2)


class EventLog:
    def __init__(self, run_id: str, mirror: MongoMirror | None = None) -> None:
        self.run_id = run_id
        self.dir = RUNS / run_id
        self.dir.mkdir(parents=True, exist_ok=True)
        self.path = self.dir / "events.jsonl"
        self.events: list[dict[str, Any]] = []
        if self.path.exists():  # resume: reload what we already logged
            self.events = [json.loads(line) for line in self.path.read_text().splitlines() if line.strip()]
        self.t0 = time.time() - (self.events[-1]["t"] if self.events else 0.0)
        self.mirror = mirror or MongoMirror()
        self._lock = threading.Lock()

    def emit(self, type: str, source: Source, **fields: Any) -> dict[str, Any]:
        assert type in EVENT_TYPES, type
        with self._lock:
            ev = {"run_id": self.run_id, "seq": len(self.events) + 1, "t": round(time.time() - self.t0, 2),
                  "type": type, "source": source, **fields}
            self.events.append(ev)
            with self.path.open("a") as f:
                f.write(json.dumps(ev, default=str) + "\n")
        self.mirror.put("event", ev)
        return ev

    def set_run(self, **fields: Any) -> None:
        self.mirror.put("run", {"_id": self.run_id, **fields})
