"""Hooks (PLAN §4.4), as Agent SDK callbacks in the runner process. Target-agnostic (see target.py).

- gate:     PreToolUse Bash  — deny the evaluator unless a hypothesis is armed (gate_blocked)
- scope:    PreToolUse Edit/Write — only the target's editable files (gate_blocked kind=scope)
- capture:  PostToolUse Bash — read the evaluator's result file -> experiment_run / experiment_failed
- trace:    PostToolUse (non-glassbox tools) -> agent_action
"""

from __future__ import annotations

import difflib
import json
import time
from pathlib import Path
from typing import Any

from claude_agent_sdk import HookMatcher

from . import state
from .events import EventLog
from .target import Target

EDIT_TOOLS = ("Edit", "Write", "MultiEdit", "NotebookEdit")


def unified_diff(before: dict[str, str], after: dict[str, str]) -> tuple[str, list[str]]:
    chunks, changed = [], []
    for name in sorted(set(before) | set(after)):
        a, b = before.get(name, ""), after.get(name, "")
        if a != b:
            changed.append(name)
            chunks.extend(difflib.unified_diff(a.splitlines(), b.splitlines(), f"a/{name}", f"b/{name}", lineterm="", n=2))
    return "\n".join(chunks), changed


def deny(reason: str) -> dict:
    return {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                   "permissionDecisionReason": reason}}


def parse_last_json(stdout: str) -> dict | None:
    for line in reversed(stdout.strip().splitlines()):
        line = line.strip()
        if line.startswith("{"):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
    return None


def build_hooks(log: EventLog, workdir: Path, target: Target) -> dict[str, list[HookMatcher]]:
    workdir = workdir.resolve()
    last_snapshot = {"files": target.snapshot(workdir)}
    started: dict[str, float] = {}

    async def gate(inp: dict[str, Any], tool_use_id: str | None, ctx: Any) -> dict:
        cmd = inp.get("tool_input", {}).get("command", "")
        if not target.is_eval(cmd):
            return {}
        if not state.armed(log.events):
            log.emit("gate_blocked", "hook", kind="no_hypothesis", command=cmd[:200])
            return deny("Blocked by Glassbox: state a hypothesis and prediction first "
                        "(call mcp__glassbox__propose_hypothesis), then run the evaluation.")
        started[tool_use_id or "last"] = time.time()
        return {}

    async def scope(inp: dict[str, Any], tool_use_id: str | None, ctx: Any) -> dict:
        raw = inp.get("tool_input", {}).get("file_path") or inp.get("tool_input", {}).get("notebook_path") or ""
        p = (workdir / raw).resolve() if raw and not Path(raw).is_absolute() else Path(raw).resolve()
        try:
            rel = p.relative_to(workdir).as_posix()
        except ValueError:
            rel = None
        if rel is None or not target.is_editable(rel):
            log.emit("gate_blocked", "hook", kind="scope", tool=inp.get("tool_name"), file=str(raw)[:200])
            return deny(f"Blocked by Glassbox: you may only edit {', '.join(target.editable)} in this directory.")
        return {}

    async def capture(inp: dict[str, Any], tool_use_id: str | None, ctx: Any) -> dict:
        cmd = inp.get("tool_input", {}).get("command", "")
        if not target.is_eval(cmd):
            return {}
        resp = inp.get("tool_response") or {}
        stdout = resp.get("stdout", "") if isinstance(resp, dict) else str(resp)
        stderr = resp.get("stderr", "") if isinstance(resp, dict) else ""
        now = target.snapshot(workdir)
        diff, changed = unified_diff(last_snapshot["files"], now)
        last_snapshot["files"] = now
        hyp = state.armed(log.events)
        eid = f"E{len(state.experiments(log.events)) + 1}"
        # Numbers come from the evaluator's own result file, not from whatever the agent did to stdout.
        out = None
        result_file = workdir.parent / target.eval.get("result_file", "result.json")
        t_start = started.pop(tool_use_id or "last", 0.0)
        if result_file.exists() and result_file.stat().st_mtime >= t_start - 1:
            try:
                out = json.loads(result_file.read_text())
            except json.JSONDecodeError:
                out = None
        out = out or parse_last_json(stdout)
        if out is None:
            log.emit("experiment_failed", "hook", id=eid, hypothesis_ids=hyp, error_kind="crash",
                     message=(stderr or stdout)[-600:], diff=diff, files_changed=changed)
            return {}
        r = target.normalize(out)
        before = state.best_metric(log.events)
        common = dict(id=eid, hypothesis_ids=hyp, diff=diff, files_changed=changed, breakdown=r["breakdown"],
                      metric_before=before, metric_after=r["value"])
        if r["correct"] and r["value"] is not None:
            beats = r["beats_best"] if r["beats_best"] is not None else target.better(r["value"], before)
            log.emit("experiment_run", "hook", correct=True, beats_best=bool(beats), **common)
        else:
            err = r["error"] or {}
            log.emit("experiment_failed", "hook", correct=False, error_kind=err.get("kind", "unknown"),
                     where=err.get("query") or err.get("where"), message=str(err.get("message", ""))[:600], **common)
        return {}

    async def trace(inp: dict[str, Any], tool_use_id: str | None, ctx: Any) -> dict:
        name = inp.get("tool_name", "")
        if name.startswith("mcp__glassbox__"):
            return {}
        ti = inp.get("tool_input", {}) or {}
        tgt = ti.get("file_path") or ti.get("command") or ti.get("pattern") or ti.get("path") or ""
        if isinstance(tgt, str) and tgt.startswith(str(workdir)):
            tgt = tgt[len(str(workdir)) + 1:]
        log.emit("agent_action", "hook", tool=name, target=str(tgt)[:200], summary=str(ti.get("description", ""))[:200])
        return {}

    return {
        "PreToolUse": [HookMatcher(matcher="Bash", hooks=[gate]),
                       HookMatcher(matcher="|".join(EDIT_TOOLS), hooks=[scope])],
        "PostToolUse": [HookMatcher(matcher="Bash", hooks=[capture]),
                        HookMatcher(matcher=".*", hooks=[trace])],
    }
