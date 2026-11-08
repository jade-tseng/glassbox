"""Start a Glassbox-instrumented autoresearch run (Claude Code via the Agent SDK). Target-agnostic.

  uv run python -m glassbox.runner --target target --run-id demo1 --max-experiments 20
  uv run python -m glassbox.runner --run-id demo1 --resume      # continue after a stop / context reset

A target is a directory with target.json (task, metric, editable files, evaluator), program.md and starting
files; see target/ for the ClickBench example. Each run gets runs/<run_id>/work, a fresh git repo with the
target's files. Events go to runs/<run_id>/events.jsonl and MongoDB. The run describes itself in run_started,
so the web UI never needs to know what the target is.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock, query

from . import backends, state
from .events import ROOT, EventLog
from .hooks import build_hooks
from .target import Target
from .tools import TOOL_NAMES, build_server

GIT_CMDS = ["status", "diff", "add", "commit", "checkout", "restore", "log", "show", "reset", "stash"]
AGENT = "Claude Code (Agent SDK)"


def sh(args: list[str], cwd: Path) -> str:
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout


def fmt(v: float | None) -> str:
    return "n/a" if v is None else f"{v:,.0f}" if float(v).is_integer() else f"{v:,.4g}"


def setup_workdir(target: Target, run_dir: Path, max_experiments: int) -> tuple[Path, dict]:
    work = run_dir / "work"
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    for item in target.copy:
        src = target.dir / item
        (shutil.copytree if src.is_dir() else shutil.copy)(src, work / item)
    for stale in (run_dir / target.eval.get("result_file", "result.json"), run_dir / "bench_state.json"):
        stale.unlink(missing_ok=True)
    base = subprocess.run(target.eval_command.split(), cwd=work, capture_output=True, text=True)
    result_file = run_dir / target.eval.get("result_file", "result.json")
    raw = json.loads(result_file.read_text()) if result_file.exists() else None
    if raw is None:
        raise SystemExit(f"Baseline evaluation produced no result: {base.stderr[-500:] or base.stdout[-500:]}")
    baseline = target.normalize(raw)
    if not baseline["correct"] or baseline["value"] is None:
        raise SystemExit(f"Baseline evaluation failed: {baseline['error']}")
    program = (target.dir / target.program).read_text()
    for key, val in {"{EVAL_CMD}": target.eval_command, "{BENCH_CMD}": target.eval_command,
                     "{BASELINE:,}": fmt(baseline["value"]), "{BASELINE}": fmt(baseline["value"]),
                     "{MAX_EXPERIMENTS}": str(max_experiments)}.items():
        program = program.replace(key, val)
    (work / "program.md").write_text(program)
    (work / ".gitignore").write_text("program.md\n")
    sh(["git", "init", "-q", "-b", "main"], work)
    sh(["git", "config", "user.name", "glassbox-agent"], work)
    sh(["git", "config", "user.email", "agent@glassbox.local"], work)
    sh(["git", "add", "-A"], work)
    sh(["git", "commit", "-q", "-m", "baseline"], work)
    return work, baseline


async def run(args: argparse.Namespace) -> None:
    backend = backends.resolve(args.backend, args.model)
    args.model = backend.model
    target = Target.load(Path(args.target))
    log = EventLog(args.run_id)
    work = log.dir / "work"
    if args.resume:
        if not log.events:
            raise SystemExit(f"Nothing to resume in {log.dir}")
        prompt = ("You are resuming an autoresearch session after a restart. Re-read program.md, call get_beliefs to "
                  "restore your working memory, check `git log --oneline` and `git status`, then continue the loop.")
    else:
        if log.events:
            raise SystemExit(f"Run {args.run_id} already has events; use --resume or a new --run-id")
        work, baseline = setup_workdir(target, log.dir, args.max_experiments)
        log.emit("run_started", "system", task=target.meta(), agent=AGENT, provider=backend.provider, model=args.model,
                 baseline={"value": baseline["value"], "breakdown": baseline["breakdown"]},
                 files=target.snapshot(work), max_experiments=args.max_experiments)
        prompt = "Read program.md in the current directory and follow it. Start now."
    log.set_run(status="running", model=args.model, agent=AGENT, provider=backend.provider, task=target.name, metric=target.metric,
                started_at=time.time(), baseline=state.baseline_metric(log.events))

    allowed = TOOL_NAMES + ["Read", "Glob", "Grep", "Edit", "Write", "MultiEdit", f"Bash({target.eval_command})"]
    allowed += [f"Bash(git {c}:*)" for c in GIT_CMDS] + ["Bash(ls:*)", "Bash(cat:*)", "Bash(head:*)", "Bash(wc:*)"]
    allowed += target.raw.get("allow", [])  # target-specific evidence tools, e.g. a trace query script
    options = ClaudeAgentOptions(
        cwd=str(work),
        model=args.model,
        env=backend.env,
        mcp_servers={"glassbox": build_server(log)},
        hooks=build_hooks(log, work, target),
        allowed_tools=allowed,
        disallowed_tools=["WebFetch", "WebSearch", "Task", "NotebookEdit"],
        setting_sources=[],
        max_turns=args.max_turns,
        max_budget_usd=args.budget_usd,
    )

    status = "finished"
    result: ResultMessage | None = None
    cost = 0.0
    try:
        for session in range(1 + args.max_continuations):
            async for msg in query(prompt=prompt, options=options):
                if isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, TextBlock) and block.text.strip():
                            log.emit("agent_message", "system", text=block.text.strip()[:2000], session=session)
                            print(f"[agent] {block.text.strip()[:300]}", flush=True)
                elif isinstance(msg, ResultMessage):
                    result = msg
                    cost += msg.total_cost_usd or 0.0
            done = len(state.experiments(log.events))
            if done >= args.max_experiments or cost >= args.budget_usd:
                break
            # The agent stopped early: start a fresh session; get_beliefs restores its working memory (PLAN §7).
            print(f"[glassbox] agent stopped after {done}/{args.max_experiments} runs; continuing (session {session + 1})")
            log.emit("agent_message", "system", text=f"[harness] Session restarted after {done} runs.", session=session + 1)
            prompt = (f"You have used {done} of {args.max_experiments} evaluation runs; keep going until all are used. "
                      "Re-read program.md, call get_beliefs to restore your working memory, check `git log --oneline`, "
                      "then continue the loop with your next hypothesis. Do not stop early.")
    except (KeyboardInterrupt, asyncio.CancelledError):
        status = "interrupted"
    except Exception as e:  # noqa: BLE001
        status = "error"
        print(f"[glassbox] run error: {e}", file=sys.stderr)
    finally:
        exps = state.experiments(log.events)
        best, base = state.best_metric(log.events), state.baseline_metric(log.events)
        log.emit("run_finished", "system", status=status, best=best, baseline=base, experiments=len(exps),
                 hypotheses=len(state.hypotheses(log.events)), cost_usd=round(cost, 4),
                 turns=getattr(result, "num_turns", None))
        log.set_run(status=status, finished_at=time.time(), best=best)
        log.mirror.flush()
        print(f"[glassbox] {status}: {len(exps)} experiments, best {fmt(best)} (baseline {fmt(base)}); events in {log.path}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", default=str(ROOT / "target"), help="target directory containing target.json")
    ap.add_argument("--run-id", default=time.strftime("run-%m%d-%H%M"))
    ap.add_argument("--backend", choices=["anthropic", "meta"], default="anthropic",
                    help="model provider behind the same harness (meta = Meta Model API, needs MODEL_API_KEY)")
    ap.add_argument("--model", default=None, help="default: sonnet (anthropic) / muse-spark-1.3 (meta)")
    ap.add_argument("--max-experiments", type=int, default=20)
    ap.add_argument("--max-turns", type=int, default=250)
    ap.add_argument("--budget-usd", type=float, default=15.0)
    ap.add_argument("--max-continuations", type=int, default=5, help="restart the agent if it stops early")
    ap.add_argument("--resume", action="store_true")
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
