"""Target manifest: what the agent works on and how it's scored. Glassbox itself is target-agnostic.

A target directory holds `target.json` (see target/target.json), a `program.md` brief, the editable starting
files, and an evaluator. The evaluator contract: after each run it writes a JSON result file (in the run dir)
with at least the metric key; optional correctness, "beats best", error and per-component breakdown keys.
"""

from __future__ import annotations

import fnmatch
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class Target:
    dir: Path
    name: str
    description: str
    metric: dict[str, Any]  # key, label, short, unit, direction ("lower" | "higher")
    breakdown: dict[str, Any] | None
    editable: list[str]
    copy: list[str]
    program: str
    eval: dict[str, Any]
    raw: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def load(cls, path: Path) -> "Target":
        path = path.resolve()
        m = json.loads((path / "target.json").read_text())
        metric = {"label": m["metric"]["key"], "short": "metric", "unit": "", "direction": "lower", **m["metric"]}
        return cls(dir=path, name=m["name"], description=m.get("description", ""), metric=metric,
                   breakdown=m.get("breakdown"), editable=m["editable"], copy=m.get("copy", m["editable"]),
                   program=m.get("program", "program.md"), eval=m["eval"], raw=m)

    # --- files ---------------------------------------------------------------------------------------------
    def is_editable(self, rel: str) -> bool:
        return any(fnmatch.fnmatch(rel, pat) for pat in self.editable)

    def snapshot(self, workdir: Path) -> dict[str, str]:
        files: dict[str, str] = {}
        for p in sorted(workdir.rglob("*")):
            if p.is_file() and ".git" not in p.parts:
                rel = p.relative_to(workdir).as_posix()
                if self.is_editable(rel):
                    files[rel] = p.read_text(errors="replace")
        return files

    # --- evaluator -----------------------------------------------------------------------------------------
    @property
    def eval_command(self) -> str:
        return self.eval["command"].format(python=sys.executable, target=self.dir)

    def is_eval(self, cmd: str) -> bool:
        return self.eval.get("match", "") in cmd

    def better(self, a: float | None, b: float | None) -> bool:
        """Is a strictly better than b?"""
        if a is None:
            return False
        if b is None:
            return True
        return a < b if self.metric["direction"] == "lower" else a > b

    def normalize(self, out: dict[str, Any]) -> dict[str, Any]:
        """Evaluator result -> {value, correct, beats_best, error, breakdown{name: number}, extra}."""
        bd = {}
        if self.breakdown:
            for name, v in (out.get(self.breakdown["key"]) or {}).items():
                bd[name] = v.get(self.breakdown.get("field", "value")) if isinstance(v, dict) else v
        err = out.get(self.eval.get("error_key", "error"))
        if isinstance(err, str):
            err = {"kind": "error", "message": err}
        correct_key = self.eval.get("correct_key")
        return {
            "value": out.get(self.metric["key"]),
            "correct": bool(out.get(correct_key, True)) if correct_key else err is None,
            "beats_best": out.get(self.eval.get("beats_best_key", "beats_best")),
            "error": err or None,
            "breakdown": bd,
        }

    def meta(self) -> dict[str, Any]:
        """Self-description written into run_started, so the UI never needs to know the target."""
        return {"name": self.name, "description": self.description, "metric": self.metric,
                "breakdown": self.breakdown, "editable": self.editable}
