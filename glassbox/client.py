"""Glassbox ingest client: stream an agent's beliefs from ANY harness into Glassbox (standard library only).

    from glassbox.client import Glassbox
    gb = Glassbox("my-run-1")                                   # GLASSBOX_URL / GLASSBOX_INGEST_TOKEN from env
    gb.start("Speed up the image pipeline", metric_label="seconds per batch", direction="lower", unit="s", baseline=12.4)
    h = gb.hypothesis("Decoding dominates; switching to turbojpeg halves it", topic="decoding",
                      direction="decrease", confidence=0.7, reason="profile shows 60% in PIL decode")
    gb.experiment(7.9, files_changed=["pipeline.py"])           # attaches to h (proposed since last experiment)
    gb.interpret(kept=True, note="decode time fell 55%")
    gb.close(h, "confirmed", "turbojpeg decode is ~2x faster")
    gb.finish()

Numbers sent this way are reported by your harness (source "ingest"); the UI shows them as client-reported.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def _load_env() -> None:
    env = Path(__file__).resolve().parent.parent / "web" / ".env.local"
    if env.exists():  # local convenience; in other setups just export the variables
        for line in env.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


class GlassboxError(RuntimeError):
    pass


class Glassbox:
    def __init__(self, run_id: str, url: str | None = None, token: str | None = None, timeout: float = 20):
        _load_env()
        self.run_id = run_id
        self.url = (url or os.environ.get("GLASSBOX_URL") or "https://miniglass.vercel.app").rstrip("/")
        self.token = token or os.environ.get("GLASSBOX_INGEST_TOKEN")
        if not self.token:
            raise GlassboxError("GLASSBOX_INGEST_TOKEN is not set")
        self.timeout = timeout
        self.direction = "lower"
        self.best: float | None = None
        self.last_experiment: str | None = None

    # --- transport -----------------------------------------------------------------------------------------
    def send(self, *events: dict[str, Any]) -> list[dict]:
        req = urllib.request.Request(
            f"{self.url}/api/ingest",
            data=json.dumps({"run_id": self.run_id, "events": list(events)}).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.token}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                out = json.loads(r.read())
        except urllib.error.HTTPError as e:
            raise GlassboxError(f"{e.code}: {e.read().decode()[:400]}") from None
        if out.get("rejected"):
            raise GlassboxError(f"rejected: {out['rejected']}")
        return out["accepted"]

    def events(self) -> list[dict]:
        with urllib.request.urlopen(f"{self.url}/api/events?run={self.run_id}&after=0", timeout=self.timeout) as r:
            return json.loads(r.read()).get("events", [])

    # --- beliefs -------------------------------------------------------------------------------------------
    def start(self, task: str, *, description: str = "", metric_label: str = "metric", direction: str = "lower",
              unit: str = "", baseline: float | None = None, breakdown: dict[str, float] | None = None,
              agent: str = "custom harness", model: str = "", provider: str = "", files: dict[str, str] | None = None,
              breakdown_label: str | None = None, editable: list[str] | None = None) -> None:
        self.direction, self.best = direction, baseline
        self.send({
            "type": "run_started", "agent": agent, "model": model, "provider": provider,
            "task": {"name": task, "description": description,
                     "metric": {"key": "value", "label": metric_label, "short": metric_label.split()[0], "unit": unit,
                                "direction": direction},
                     "breakdown": {"label": breakdown_label} if breakdown_label else None,
                     "editable": editable or sorted((files or {}).keys())},
            "baseline": {"value": baseline, "breakdown": breakdown or {}},
            "files": files or {},
        })

    def hypothesis(self, claim: str, topic: str, direction: str, confidence: float, *, reason: str = "",
                   file: str = "", symbol: str = "", id: str | None = None) -> str:
        ev = {"type": "hypothesis_proposed", "claim": claim, "topic": topic, "reason": reason,
              "prediction": {"direction": direction, "confidence": confidence},
              "code_region": {"file": file, "symbol": symbol}}
        if id:
            ev.update(id=id, retest=True)
        return self.send(ev)[0]["id"]

    def link(self, from_id: str, to_id: str, relation: str, reason: str = "") -> None:
        self.send({"type": "hypothesis_linked", "from": from_id, "to": to_id, "relation": relation, "reason": reason})

    def experiment(self, metric_after: float, *, hypothesis_ids: list[str] | None = None, correct: bool = True,
                   diff: str = "", files_changed: list[str] | None = None, breakdown: dict[str, float] | None = None,
                   error_kind: str | None = None, message: str = "") -> str:
        before = self.best
        better = before is None or (metric_after < before if self.direction == "lower" else metric_after > before)
        ev: dict[str, Any] = {"metric_before": before, "metric_after": metric_after, "diff": diff,
                              "files_changed": files_changed or [], "breakdown": breakdown or {}}
        if hypothesis_ids is not None:
            ev["hypothesis_ids"] = hypothesis_ids
        if correct and error_kind is None:
            ev.update(type="experiment_run", correct=True, beats_best=better)
            if better:
                self.best = metric_after
        else:
            ev.update(type="experiment_failed", correct=False, error_kind=error_kind or "incorrect_result", message=message)
        self.last_experiment = self.send(ev)[0]["id"]
        return self.last_experiment

    def interpret(self, kept: bool, note: str = "", experiment_id: str | None = None, hypothesis_ids: list[str] | None = None) -> None:
        self.send({"type": "experiment_interpreted", "experiment_id": experiment_id or self.last_experiment,
                   "kept": kept, "note": note, "hypothesis_ids": hypothesis_ids or []})

    def close(self, id: str, status: str, summary: str = "") -> None:
        self.send({"type": "hypothesis_closed", "id": id, "status": status, "summary": summary})

    def action(self, tool: str, target: str = "", summary: str = "") -> None:
        self.send({"type": "agent_action", "tool": tool, "target": target, "summary": summary})

    def message(self, text: str) -> None:
        self.send({"type": "agent_message", "text": text[:2000]})

    def gate_blocked(self, kind: str, detail: str = "") -> None:
        self.send({"type": "gate_blocked", "kind": kind, "command": detail[:200]})

    def finish(self, status: str = "finished") -> None:
        self.send({"type": "run_finished", "status": status, "best": self.best})
