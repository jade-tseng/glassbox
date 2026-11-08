"""Intake: turn a plain-language description into a case spec, asking the user only about real ambiguities.

Runs on the worker (it has the code and the agent login). A read-only Claude agent reads the conversation, may
look inside the workspace the user names (bench scripts, tests, how results are printed), and returns:
  {"summary": "...", "spec": {...partial CaseSpec...}, "questions": [{"field", "question", "suggestion"}]}
No questions + a valid spec -> the worker dry-runs it. Verification must be explicit: if the user didn't say how
correctness is checked, the agent proposes the best option it found and asks the user to confirm.
"""

from __future__ import annotations

import asyncio
import json
import re
import subprocess
from pathlib import Path
from typing import Any

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, TextBlock, query

from .cases import CASES, validate
from .events import ROOT

# Default: Meta's Muse Spark; if that run fails, the worker resumes it on Claude Opus 5.5 (subscription).
DEFAULT_BUDGET = {"max_experiments": 6, "backend": "meta", "model": "muse-spark-1.3", "budget_usd": 10,
                  "fallback": {"backend": "anthropic", "model": "claude-opus-5-5"}}

INSTRUCTIONS = """You set up Glassbox research runs. A user described, in their own words, something they want an AI
agent to improve. Turn it into a case spec, asking the user ONLY about things that are missing or ambiguous.

Case spec (JSON):
{
  "id": "short-slug", "name": "short title", "goal": "one or two sentences: what to improve and what must not change",
  "workspace": {"path": "/absolute/path/to/the/code"},
  "editable": ["files or globs the agent may change"],
  "measure": {"command": "shell command run in the workspace that prints the number",
              "parse": {"mode": "json_key" | "regex" | "last_number", "key": "for json_key", "pattern": "for regex"},
              "timeout_s": 300},
  "metric": {"label": "what the number is", "unit": "s / ms / % / ...", "direction": "lower" | "higher"},
  "verify": {"mode": "test_command" | "json_flag" | "same_output" | "none", "command": "...", "key": "..."},
  "budget": {"max_experiments": 6, "backend": "meta" | "anthropic", "model": "muse-spark-1.3", "budget_usd": 10,
             "fallback": {"backend": "anthropic", "model": "claude-opus-5-5"}},
  "evidence": {"commands": ["python3 traces.py"], "description": "what the agent can look at"},   # optional
  "hidden": ["heldout/", "evaluate.py"]                                                           # optional
}
evidence (optional): read-only commands the agent may run to LOOK at evidence (trace/log queries, probes of a black
box). Their outputs are recorded verbatim as observations. Use when the task is to understand or reconstruct something.
hidden (optional): top-level files/folders kept OUT of the agent's copy (held-out data, the scorer). If the measure
command needs them, call them by their ABSOLUTE path inside the workspace (the agent's copy won't contain them).
verify modes: test_command = a command that must exit 0 (e.g. pytest); json_flag = the measure output's JSON has a
true flag (key); same_output = a command whose output must stay identical to the baseline's; none = no check.

How to work:
- If a workspace path is given, look inside it (read-only: list files, read the benchmark/tests/README) to fill in
  details yourself: the measure command, how its output looks (pick the parse mode that matches), which files hold
  the logic (editable), and whether tests exist. Prefer facts from the code over guesses.
- Never invent a workspace path. If none is given, ask for it. (A GitHub URL is cloned for you; its local path is
  given as "Workspace detected".)
- If there is no benchmark script, propose a measure command built from what exists (e.g.
  `python3 -m timeit -s "from pkg import f" "f(...)"` with parse last_number, or a test run's timing), and ask the
  user to confirm it. Prefer the repo's own tests for verification (e.g. `python3 -m pytest -q`).
- If held-out data or a scorer is present, put them in "hidden" and reference them by absolute path in the
  measure command; if an evidence tool is present (e.g. a trace query script), list it in "evidence".
- VERIFICATION IS REQUIRED TO BE EXPLICIT: unless the user clearly said how correctness is checked (or said there
  is none), ask them to confirm, and put your best proposal in "suggestion" (e.g. the test command you found).
- Ask at most 3 questions, short and concrete, each with a suggested answer when you have one. Don't ask about
  things you could find in the code or that have sensible defaults (budget defaults are fine unless the user said otherwise).
- When the user answers, update the spec accordingly and only ask what is still unresolved.
- Model and budget: default backend "meta" + model "muse-spark-1.3" with fallback anthropic + claude-opus-5-5,
  6 experiments, budget_usd 10 (use the user's numbers if given). If the user asks for Opus: backend "anthropic",
  model "claude-opus-5-5"; for Sonnet: "anthropic" + "sonnet". Never ask about the model; use the default.

Finish with ONLY this JSON in a ```json fenced block:
{"summary": "2-3 sentences in plain words: what will be optimized, how it is measured, how correctness is checked",
 "spec": { ...as complete as you can... },
 "questions": [{"field": "verify", "question": "...", "suggestion": "..."}]}
"""

ABS_PATH = re.compile(r"(?<![\w.:/])(/(?:[\w.@+-]+/)*[\w.@+-]+)")
GIT_URL = re.compile(r"https?://(?:www\.)?(github\.com|gitlab\.com|bitbucket\.org)/([\w.-]+)/([\w.-]+?)(?:\.git)?(?=[/\s)#?]|$)")
WORKSPACES = ROOT / "workspaces"


def clone_repo(conversation: list[dict[str, str]]) -> Path | None:
    """A public repo URL in the conversation -> shallow clone under workspaces/ (reused if already cloned)."""
    for msg in reversed(conversation):
        if msg.get("role") != "user":
            continue
        m = GIT_URL.search(msg.get("text", ""))
        if not m:
            continue
        host, owner, repo = m.groups()
        dest = WORKSPACES / f"{owner}-{repo}".lower()
        if not (dest / ".git").exists():
            WORKSPACES.mkdir(parents=True, exist_ok=True)
            subprocess.run(["git", "clone", "--depth", "1", f"https://{host}/{owner}/{repo}.git", str(dest)],
                           check=True, capture_output=True, text=True, timeout=300)
        return dest
    return None


def find_workspace(conversation: list[dict[str, str]], spec: dict[str, Any] | None) -> Path | None:
    if spec and (p := (spec.get("workspace") or {}).get("path")) and Path(p).is_dir():
        return Path(p)
    if repo := clone_repo(conversation):
        return repo
    for msg in reversed(conversation):
        if msg.get("role") != "user":
            continue
        for cand in ABS_PATH.findall(msg.get("text", "")):
            p = Path(cand)
            if p.is_dir():
                return p
            if p.parent.is_dir() and p.suffix:  # a file inside the workspace was mentioned
                return p.parent
    return None


def transcript(conversation: list[dict[str, str]], spec: dict[str, Any] | None) -> str:
    lines = []
    for m in conversation:
        who = "USER" if m["role"] == "user" else "YOU (earlier)"
        lines.append(f"{who}: {m['text']}")
    if spec:
        lines.append(f"\nCURRENT SPEC (from earlier turns):\n{json.dumps(spec, indent=2)}")
    return "\n\n".join(lines)


def parse_reply(text: str) -> dict[str, Any] | None:
    blocks = re.findall(r"```json\s*(\{.*?\})\s*```", text, flags=re.S)
    for raw in reversed(blocks or [text]):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            continue
    return None


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "case"


async def _run_agent(prompt: str, cwd: Path, model: str) -> str:
    options = ClaudeAgentOptions(
        cwd=str(cwd),
        model=model,
        allowed_tools=["Read", "Glob", "Grep", "Bash(ls:*)", "Bash(cat:*)", "Bash(head:*)"],
        disallowed_tools=["Edit", "Write", "MultiEdit", "NotebookEdit", "WebFetch", "WebSearch", "Task"],
        setting_sources=[],
        max_turns=16,
    )
    out: list[str] = []
    async for msg in query(prompt=prompt, options=options):
        if isinstance(msg, AssistantMessage):
            out.extend(b.text for b in msg.content if isinstance(b, TextBlock))
    return "\n".join(out)


def interpret(case_id: str | None, conversation: list[dict[str, str]], spec: dict[str, Any] | None,
              model: str = "sonnet") -> dict[str, Any]:
    """-> {"summary", "spec", "questions", "errors"}; spec is complete+valid iff questions and errors are empty."""
    ws = find_workspace(conversation, spec)
    scratch = CASES / "_intake"
    scratch.mkdir(parents=True, exist_ok=True)
    if ws and not (spec or {}).get("workspace"):
        spec = {**(spec or {}), "workspace": {"path": str(ws)}}
    prompt = (f"{INSTRUCTIONS}\n\nWorkspace detected: {ws if ws else 'none given yet'}\n\n"
              f"CONVERSATION:\n{transcript(conversation, spec)}")
    text = asyncio.run(_run_agent(prompt, ws or scratch, model))
    reply = parse_reply(text) or {"summary": "", "spec": spec or {}, "questions": [
        {"field": "general", "question": "I couldn't interpret that. Could you describe the task again, including where the code is?",
         "suggestion": ""}]}
    new = {**(spec or {}), **(reply.get("spec") or {})}
    new["budget"] = {**DEFAULT_BUDGET, **(new.get("budget") or {})}
    new.setdefault("measure", {}).setdefault("timeout_s", 300)
    if not new.get("id"):
        new["id"] = case_id or slug(new.get("name", "case"))
    if case_id:
        new["id"] = case_id  # the case keeps its id across clarification rounds
    questions = [q for q in (reply.get("questions") or []) if q.get("question")][:3]
    errors = validate(new) if not questions else []
    if errors and not questions:  # the agent thought it was done but the spec is incomplete: ask about it
        questions = [{"field": "spec", "question": f"I still need: {'; '.join(errors)}", "suggestion": ""}]
    return {"summary": reply.get("summary", ""), "spec": new, "questions": questions, "errors": errors}
