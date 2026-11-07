"""Glassbox MCP bridge: give ANY MCP-capable agent (Claude Code, Codex, Gemini CLI, ...) the belief tools,
streaming to a Glassbox deployment through the ingest API. No hooks needed in the agent.

  GLASSBOX_RUN_ID=my-run uv run --directory <glassbox> python -m glassbox.mcp_bridge    # stdio MCP server

Register it in your agent's MCP config, e.g. Claude Code:
  {"mcpServers": {"glassbox": {"command": "uv", "args": ["run", "--directory", "/path/to/glassbox",
      "python", "-m", "glassbox.mcp_bridge"], "env": {"GLASSBOX_RUN_ID": "my-run"}}}}

Without hooks, Glassbox can't measure the agent's experiments itself, so `report_experiment` numbers are
client-reported (shown as such in the UI). The bridge still enforces the core rule: an experiment can only be
reported while a hypothesis is armed; otherwise it's rejected and logged as a gate block.
"""

from __future__ import annotations

import os

from mcp.server.mcpserver import MCPServer

from . import state
from .client import Glassbox, GlassboxError

run_id = os.environ.get("GLASSBOX_RUN_ID") or "bridge-run"
gb = Glassbox(run_id)
mcp = MCPServer("glassbox")


def _events() -> list[dict]:
    return gb.events()


@mcp.tool()
def start_run(task: str, metric_label: str, direction: str = "lower", baseline: float | None = None,
              description: str = "", unit: str = "", agent: str = "MCP agent", model: str = "", provider: str = "") -> str:
    """Describe the task and metric before the first experiment. direction: 'lower' or 'higher' is better.
    agent/model/provider: who you are, e.g. agent='Codex CLI', model='gpt-5.5', provider='OpenAI'."""
    if direction not in ("lower", "higher"):
        return "Rejected: direction must be 'lower' or 'higher'."
    gb.start(task, description=description, metric_label=metric_label, direction=direction, unit=unit,
             baseline=baseline, agent=os.environ.get("GLASSBOX_AGENT", agent), model=model,
             provider=os.environ.get("GLASSBOX_PROVIDER", provider))
    return f"Run {run_id} started: {task} ({metric_label}, {direction} is better, baseline {baseline})."


@mcp.tool()
def propose_hypothesis(claim: str, topic: str, reason: str, direction: str, confidence: float,
                       file: str = "", symbol: str = "", hypothesis_id: str | None = None) -> str:
    """State a hypothesis BEFORE each experiment. direction = predicted effect on the metric:
    decrease | increase | no_change. confidence in [0, 1]. Pass hypothesis_id to re-test an existing one."""
    try:
        hid = gb.hypothesis(claim, topic, direction, confidence, reason=reason, file=file, symbol=symbol, id=hypothesis_id)
    except GlassboxError as e:
        return f"Rejected: {e}"
    return f"{hid} armed. Run your experiment, then call report_experiment. Link it if it builds on an earlier hypothesis."


@mcp.tool()
def report_experiment(metric_value: float, correct: bool = True, files_changed: list[str] | None = None,
                      diff: str = "", error: str = "") -> str:
    """Report the measured metric after an experiment. Requires an armed hypothesis (propose_hypothesis first).
    Set correct=false (and error) if the change broke something or produced a wrong result."""
    evs = _events()
    if not state.armed(evs):
        gb.gate_blocked("no_hypothesis", f"report_experiment({metric_value})")
        return "Blocked by Glassbox: state a hypothesis and prediction first (propose_hypothesis), then report."
    try:
        eid = gb.experiment(metric_value, correct=correct and not error, files_changed=files_changed, diff=diff,
                            error_kind="incorrect_result" if (error or not correct) else None, message=error)
    except GlassboxError as e:
        return f"Rejected: {e}"
    return f"{eid} recorded (metric {metric_value}). Now call record_result with your interpretation."


@mcp.tool()
def record_result(kept: bool, note: str, hypothesis_ids: list[str] | None = None) -> str:
    """Your interpretation of the last experiment and whether you kept the change."""
    gb.interpret(kept, note, hypothesis_ids=hypothesis_ids)
    return "Recorded."


@mcp.tool()
def link_hypotheses(from_id: str, to_id: str, relation: str, reason: str) -> str:
    """relation: contradicts | depends_on | refines."""
    try:
        gb.link(from_id, to_id, relation, reason)
    except GlassboxError as e:
        return f"Rejected: {e}"
    return f"Linked {from_id} {relation} {to_id}."


@mcp.tool()
def close_hypothesis(id: str, status: str, summary: str) -> str:
    """status: confirmed | refuted | abandoned."""
    try:
        gb.close(id, status, summary)
    except GlassboxError as e:
        return f"Rejected: {e}"
    return f"{id} closed as {status}."


@mcp.tool()
def get_beliefs() -> str:
    """Your current beliefs and evidence (also restores working memory after a restart)."""
    return state.beliefs_summary(_events())


@mcp.tool()
def finish_run(summary: str = "") -> str:
    """Call once at the end."""
    if summary:
        gb.message(summary)
    gb.finish()
    return f"Run {run_id} finished."


if __name__ == "__main__":
    mcp.run()
