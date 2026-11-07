"""Spike: Agent SDK with an in-process MCP tool + PreToolUse gate + PostToolUse capture.

Run: uv run python glassbox/spike.py <workdir>
Verifies (PLAN §11 open items 1-2): deny format, tool naming, and which PostToolUse field holds Bash output.
"""

import asyncio
import json
import sys
from pathlib import Path

from claude_agent_sdk import (
    ClaudeAgentOptions,
    HookMatcher,
    ResultMessage,
    create_sdk_mcp_server,
    query,
    tool,
)

workdir = Path(sys.argv[1]).resolve()
(workdir / "bench.sh").write_text("echo '{\"read_rows\": 123}'\n")
log: list[dict] = []
state = {"open": False}


@tool("propose_hypothesis", "Open a hypothesis before running an experiment.", {"claim": str, "direction": str})
async def propose_hypothesis(args):
    state["open"] = True
    log.append({"event": "mcp", "args": args})
    return {"content": [{"type": "text", "text": f"opened: {args['claim']}"}]}


async def gate(input_data, tool_use_id, context):
    log.append({"event": "pre", "keys": sorted(input_data), "tool_input": input_data.get("tool_input")})
    cmd = input_data.get("tool_input", {}).get("command", "")
    if "bench" in cmd and not state["open"]:
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "State a hypothesis first (glassbox propose_hypothesis).",
            }
        }
    return {}


async def capture(input_data, tool_use_id, context):
    log.append({"event": "post", "tool": input_data.get("tool_name"), "keys": sorted(input_data),
                "tool_response": input_data.get("tool_response")})
    return {}


async def main():
    server = create_sdk_mcp_server("glassbox", "0.1.0", tools=[propose_hypothesis])
    options = ClaudeAgentOptions(
        cwd=str(workdir),
        model="haiku",
        mcp_servers={"glassbox": server},
        allowed_tools=["Bash(bash bench.sh)", "mcp__glassbox__propose_hypothesis"],
        hooks={
            "PreToolUse": [HookMatcher(matcher="Bash", hooks=[gate])],
            "PostToolUse": [HookMatcher(matcher="Bash|mcp__glassbox__.*", hooks=[capture])],
        },
        setting_sources=[],  # don't load the user's own settings/hooks
        max_turns=8,
    )
    prompt = ("Run the shell command `bash bench.sh` and report its output. If a hook blocks you, follow its "
              "instruction (call the glassbox propose_hypothesis tool with any claim and direction 'down'), then run it again.")
    async for msg in query(prompt=prompt, options=options):
        if isinstance(msg, ResultMessage):
            print("RESULT:", (msg.result or "")[:200], "| cost:", msg.total_cost_usd, "| turns:", msg.num_turns)
    for entry in log:
        print(json.dumps(entry, default=str)[:400])


asyncio.run(main())
