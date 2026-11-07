"""Glassbox MCP tools (in-process, PLAN §4.3). The agent states beliefs here; numbers come from hooks."""

from __future__ import annotations

import difflib
import re
from typing import Any

from claude_agent_sdk import create_sdk_mcp_server, tool

from . import state
from .events import EventLog

DIRECTIONS = ("decrease", "increase", "no_change")
RELATIONS = ("contradicts", "depends_on", "refines")
CLOSE_STATUS = ("confirmed", "refuted", "abandoned")


def _ok(text: str) -> dict:
    return {"content": [{"type": "text", "text": text}]}


def _err(text: str) -> dict:
    return {"content": [{"type": "text", "text": f"Rejected: {text}"}], "is_error": True}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def build_server(log: EventLog):
    @tool(
        "propose_hypothesis",
        "State a hypothesis BEFORE running an experiment (the benchmark is blocked until you do). "
        "To re-test an existing hypothesis, pass its hypothesis_id. Prediction direction refers to total read_rows.",
        {
            "type": "object",
            "properties": {
                "claim": {"type": "string", "description": "What you believe, specific and testable."},
                "topic": {"type": "string", "description": "Short area name, e.g. 'ordering key', 'time filters'. Reuse existing topics."},
                "reason": {"type": "string", "description": "Why you believe it (evidence or mechanism)."},
                "direction": {"type": "string", "enum": list(DIRECTIONS), "description": "Predicted effect on total read_rows."},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1, "description": "Probability the prediction holds."},
                "file": {"type": "string", "description": "File you will change: schema.sql or queries/<name>.sql"},
                "symbol": {"type": "string", "description": "Region within the file, e.g. 'ORDER BY', 'column URL', 'q03 WHERE'."},
                "hypothesis_id": {"type": "string", "description": "Optional: existing id (e.g. H3) to re-test."},
            },
            "required": ["claim", "topic", "reason", "direction", "confidence", "file", "symbol"],
        },
    )
    async def propose_hypothesis(args: dict[str, Any]):
        hs = state.hypotheses(log.events)
        missing = [k for k in ("claim", "topic", "reason", "direction", "file", "symbol") if not str(args.get(k, "")).strip()]
        if missing:
            return _err(f"missing {', '.join(missing)}.")
        if args["direction"] not in DIRECTIONS:
            return _err(f"direction must be one of {DIRECTIONS}.")
        try:
            conf = float(args["confidence"])
        except (TypeError, ValueError):
            return _err("confidence must be a number between 0 and 1.")
        if not 0 <= conf <= 1:
            return _err("confidence must be between 0 and 1.")
        if len(args["claim"].split()) < 4:
            return _err("claim is too vague; state a specific, testable belief.")
        hid = args.get("hypothesis_id")
        if hid:
            if hid not in hs:
                return _err(f"unknown hypothesis_id {hid}. Known: {', '.join(hs) or 'none'}.")
            if hs[hid]["status"] != "open":
                return _err(f"{hid} is {hs[hid]['status']}; propose a new hypothesis instead of re-testing a closed one.")
        else:
            hid = f"H{len(hs) + 1}"
        topic = args["topic"].strip()
        warning = ""
        existing = state.topics(log.events)
        if topic not in existing:
            close = difflib.get_close_matches(_norm(topic), [_norm(t) for t in existing], n=1, cutoff=0.75)
            if close:
                match = next(t for t in existing if _norm(t) == close[0])
                warning = f" Note: topic '{topic}' looks like existing topic '{match}'; reuse it next time."
        log.emit("hypothesis_proposed", "mcp", id=hid, claim=args["claim"], topic=topic, reason=args["reason"],
                 prediction={"direction": args["direction"], "confidence": conf},
                 code_region={"file": args["file"], "symbol": args["symbol"]},
                 retest=bool(args.get("hypothesis_id")))
        return _ok(f"{hid} armed (topic '{topic}', predicts read_rows {args['direction']} @ {conf:.2f}). "
                   f"You may now run the benchmark.{warning}")

    @tool(
        "link_hypotheses",
        "Record how two hypotheses relate: contradicts, depends_on, or refines.",
        {
            "type": "object",
            "properties": {
                "from_id": {"type": "string"}, "to_id": {"type": "string"},
                "relation": {"type": "string", "enum": list(RELATIONS)}, "reason": {"type": "string"},
            },
            "required": ["from_id", "to_id", "relation", "reason"],
        },
    )
    async def link_hypotheses(args: dict[str, Any]):
        hs = state.hypotheses(log.events)
        for k in ("from_id", "to_id"):
            if args.get(k) not in hs:
                return _err(f"unknown {k} {args.get(k)}. Known: {', '.join(hs) or 'none'}.")
        if args["from_id"] == args["to_id"]:
            return _err("cannot link a hypothesis to itself.")
        if args.get("relation") not in RELATIONS:
            return _err(f"relation must be one of {RELATIONS}.")
        log.emit("hypothesis_linked", "mcp", **{"from": args["from_id"], "to": args["to_id"]},
                 relation=args["relation"], reason=args.get("reason", ""))
        return _ok(f"Linked {args['from_id']} {args['relation']} {args['to_id']}.")

    @tool(
        "record_result",
        "After each benchmark: give your interpretation of the last experiment and whether you kept the change.",
        {
            "type": "object",
            "properties": {
                "hypothesis_ids": {"type": "array", "items": {"type": "string"}},
                "kept": {"type": "boolean", "description": "Did you keep (commit) the change?"},
                "note": {"type": "string", "description": "What you learned, in one or two sentences."},
            },
            "required": ["hypothesis_ids", "kept", "note"],
        },
    )
    async def record_result(args: dict[str, Any]):
        last = state.last_experiment(log.events)
        if not last:
            return _err("no experiment has run yet.")
        hs = state.hypotheses(log.events)
        unknown = [h for h in args.get("hypothesis_ids", []) if h not in hs]
        if unknown:
            return _err(f"unknown hypothesis ids {unknown}.")
        log.emit("experiment_interpreted", "mcp", experiment_id=last["id"], hypothesis_ids=args["hypothesis_ids"],
                 kept=bool(args["kept"]), note=args.get("note", ""))
        return _ok(f"Recorded interpretation of {last['id']}.")

    @tool(
        "close_hypothesis",
        "Close a hypothesis once the evidence is clear.",
        {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "status": {"type": "string", "enum": list(CLOSE_STATUS)},
                "summary": {"type": "string"},
            },
            "required": ["id", "status", "summary"],
        },
    )
    async def close_hypothesis(args: dict[str, Any]):
        hs = state.hypotheses(log.events)
        if args.get("id") not in hs:
            return _err(f"unknown id {args.get('id')}.")
        if args.get("status") not in CLOSE_STATUS:
            return _err(f"status must be one of {CLOSE_STATUS}.")
        log.emit("hypothesis_closed", "mcp", id=args["id"], status=args["status"], summary=args.get("summary", ""))
        return _ok(f"{args['id']} closed as {args['status']}.")

    @tool("get_beliefs", "Your current beliefs: topics, hypotheses, evidence, and the best metric so far. Use it to plan.",
          {"type": "object", "properties": {}})
    async def get_beliefs(args: dict[str, Any]):
        return _ok(state.beliefs_summary(log.events))

    return create_sdk_mcp_server(
        "glassbox", "0.1.0",
        tools=[propose_hypothesis, link_hypotheses, record_result, close_hypothesis, get_beliefs],
    )


TOOL_NAMES = [f"mcp__glassbox__{n}" for n in
              ("propose_hypothesis", "link_hypotheses", "record_result", "close_hypothesis", "get_beliefs")]
