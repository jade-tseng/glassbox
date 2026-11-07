"""Hooks (PLAN §4.4), as Agent SDK callbacks in the runner process.

- gate:     PreToolUse Bash  — deny bench.py unless a hypothesis is armed (gate_blocked)
- scope:    PreToolUse Edit/Write — only schema.sql and queries/*.sql (gate_blocked kind=scope)
- capture:  PostToolUse Bash — parse bench.py's JSON line from tool_response.stdout -> experiment_run/failed
- trace:    PostToolUse (non-glassbox tools) -> agent_action
"""

from __future__ import annotations

import difflib
import json
from pathlib import Path
from typing import Any

from claude_agent_sdk import HookMatcher

from . import state
from .events import EventLog

EDIT_TOOLS = ("Edit", "Write", "MultiEdit", "NotebookEdit")


def snapshot(workdir: Path) -> dict[str, str]:
    files = {"schema.sql": (workdir / "schema.sql").read_text() if (workdir / "schema.sql").exists() else ""}
    for p in sorted((workdir / "queries").glob("*.sql")):
        files[f"queries/{p.name}"] = p.read_text()
    return files


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


def is_bench(cmd: str) -> bool:
    return "bench.py" in cmd


def parse_bench(stdout: str) -> dict | None:
    for line in reversed(stdout.strip().splitlines()):
        line = line.strip()
        if line.startswith("{"):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
    return None


def build_hooks(log: EventLog, workdir: Path) -> dict[str, list[HookMatcher]]:
    workdir = workdir.resolve()
    allowed = {workdir / "schema.sql"}
    last_snapshot = {"files": snapshot(workdir)}

    async def gate(inp: dict[str, Any], tool_use_id: str | None, ctx: Any) -> dict:
        cmd = inp.get("tool_input", {}).get("command", "")
        if is_bench(cmd) and not state.armed(log.events):
            log.emit("gate_blocked", "hook", kind="no_hypothesis", command=cmd[:200])
            return deny("Blocked by Glassbox: state a hypothesis and prediction first "
                        "(call mcp__glassbox__propose_hypothesis), then run the benchmark.")
        return {}

    async def scope(inp: dict[str, Any], tool_use_id: str | None, ctx: Any) -> dict:
        raw = inp.get("tool_input", {}).get("file_path") or inp.get("tool_input", {}).get("notebook_path") or ""
        p = (workdir / raw).resolve() if raw and not Path(raw).is_absolute() else Path(raw).resolve()
        ok = p in allowed or (p.parent == workdir / "queries" and p.suffix == ".sql")
        if not ok:
            log.emit("gate_blocked", "hook", kind="scope", tool=inp.get("tool_name"), file=str(raw)[:200])
            return deny("Blocked by Glassbox: you may only edit schema.sql and queries/*.sql in this directory.")
        return {}

    async def capture(inp: dict[str, Any], tool_use_id: str | None, ctx: Any) -> dict:
        cmd = inp.get("tool_input", {}).get("command", "")
        if not is_bench(cmd):
            return {}
        resp = inp.get("tool_response") or {}
        stdout = resp.get("stdout", "") if isinstance(resp, dict) else str(resp)
        stderr = resp.get("stderr", "") if isinstance(resp, dict) else ""
        now = snapshot(workdir)
        diff, changed = unified_diff(last_snapshot["files"], now)
        last_snapshot["files"] = now
        hyp = state.armed(log.events)
        eid = f"E{len(state.experiments(log.events)) + 1}"
        out = parse_bench(stdout)
        if out is None:
            log.emit("experiment_failed", "hook", id=eid, hypothesis_ids=hyp, error_kind="crash",
                     message=(stderr or stdout)[-600:], diff=diff, files_changed=changed)
            return {}
        before = out.get("best_read_rows_before") or state.best_metric(log.events)
        per_query = {k: {"read_rows": v.get("read_rows"), "latency_ms": v.get("latency_ms"), "correct": v.get("correct")}
                     for k, v in (out.get("per_query") or {}).items()}
        common = dict(id=eid, hypothesis_ids=hyp, diff=diff, files_changed=changed, per_query=per_query,
                      metric_before=before, metric_after=out.get("total_read_rows"),
                      baseline=out.get("baseline_read_rows"), latency_ms=out.get("total_latency_ms"),
                      schema_rebuilt=out.get("schema_rebuilt"))
        if out.get("correct"):
            log.emit("experiment_run", "hook", correct=True, beats_best=bool(out.get("beats_best")), **common)
        else:
            err = out.get("error") or {}
            log.emit("experiment_failed", "hook", correct=False, error_kind=err.get("kind", "unknown"),
                     query=err.get("query"), message=str(err.get("message", ""))[:600], **common)
        return {}

    async def trace(inp: dict[str, Any], tool_use_id: str | None, ctx: Any) -> dict:
        name = inp.get("tool_name", "")
        if name.startswith("mcp__glassbox__"):
            return {}
        ti = inp.get("tool_input", {}) or {}
        target = ti.get("file_path") or ti.get("command") or ti.get("pattern") or ti.get("path") or ""
        if isinstance(target, str) and target.startswith(str(workdir)):
            target = target[len(str(workdir)) + 1:]
        log.emit("agent_action", "hook", tool=name, target=str(target)[:200], summary=str(ti.get("description", ""))[:200])
        return {}

    return {
        "PreToolUse": [HookMatcher(matcher="Bash", hooks=[gate]),
                       HookMatcher(matcher="|".join(EDIT_TOOLS), hooks=[scope])],
        "PostToolUse": [HookMatcher(matcher="Bash", hooks=[capture]),
                        HookMatcher(matcher=".*", hooks=[trace])],
    }
