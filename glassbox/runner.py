"""Start a Glassbox-instrumented autoresearch run (Claude Code via the Agent SDK).

  uv run python -m glassbox.runner --run-id demo1 --max-experiments 20
  uv run python -m glassbox.runner --run-id demo1 --resume      # continue after a stop / context reset

Creates runs/<run_id>/work (a fresh git repo with schema.sql, queries/, program.md), measures the baseline,
then lets the agent loop. Events go to runs/<run_id>/events.jsonl and MongoDB.
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

from . import state
from .events import ROOT, EventLog
from .hooks import build_hooks, snapshot
from .tools import TOOL_NAMES, build_server

TARGET = ROOT / "target"
PY = sys.executable
BENCH_CMD = f"{PY} {TARGET / 'bench.py'} --workdir ."
GIT_CMDS = ["status", "diff", "add", "commit", "checkout", "restore", "log", "show", "reset", "stash"]


def sh(args: list[str], cwd: Path) -> str:
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout


def setup_workdir(run_dir: Path, max_experiments: int) -> tuple[Path, dict]:
    work = run_dir / "work"
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    shutil.copy(TARGET / "schema.sql", work / "schema.sql")
    shutil.copytree(TARGET / "queries", work / "queries")
    (run_dir / "bench_state.json").unlink(missing_ok=True)
    base = subprocess.run(BENCH_CMD.split(), cwd=work, capture_output=True, text=True)
    result_file = run_dir / "last_bench.json"  # full harness result (stdout is the compact agent view)
    if not result_file.exists():
        raise SystemExit(f"Baseline benchmark produced no result: {base.stderr[-500:] or base.stdout[-500:]}")
    baseline = json.loads(result_file.read_text())
    if not baseline.get("correct"):
        raise SystemExit(f"Baseline benchmark failed: {baseline.get('error')}")
    program = (TARGET / "program.md").read_text()
    program = (program.replace("{BENCH_CMD}", BENCH_CMD)
               .replace("{BASELINE:,}", f"{baseline['total_read_rows']:,}")
               .replace("{MAX_EXPERIMENTS}", str(max_experiments)))
    (work / "program.md").write_text(program)
    (work / ".gitignore").write_text("program.md\n")
    sh(["git", "init", "-q", "-b", "main"], work)
    sh(["git", "config", "user.name", "glassbox-agent"], work)
    sh(["git", "config", "user.email", "agent@glassbox.local"], work)
    sh(["git", "add", "-A"], work)
    sh(["git", "commit", "-q", "-m", "baseline"], work)
    return work, baseline


async def run(args: argparse.Namespace) -> None:
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
        work, baseline = setup_workdir(log.dir, args.max_experiments)
        log.emit("run_started", "system", target="clickbench-hits-2m", model=args.model,
                 baseline={"total_read_rows": baseline["total_read_rows"],
                           "per_query": {k: v["read_rows"] for k, v in baseline["per_query"].items()}},
                 files=snapshot(work), max_experiments=args.max_experiments)
        prompt = "Read program.md in the current directory and follow it. Start now."
    log.set_run(status="running", model=args.model, target="clickbench-hits-2m", started_at=time.time(),
                baseline=state.baseline_metric(log.events))

    allowed = TOOL_NAMES + ["Read", "Glob", "Grep", "Edit", "Write", "MultiEdit", f"Bash({BENCH_CMD})"]
    allowed += [f"Bash(git {c}:*)" for c in GIT_CMDS] + ["Bash(ls:*)", "Bash(cat:*)", "Bash(head:*)", "Bash(wc:*)"]
    options = ClaudeAgentOptions(
        cwd=str(work),
        model=args.model,
        mcp_servers={"glassbox": build_server(log)},
        hooks=build_hooks(log, work),
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
            prompt = (f"You have used {done} of {args.max_experiments} benchmark runs; keep going until all are used. "
                      "Re-read program.md, call get_beliefs to restore your working memory, check `git log --oneline`, "
                      "then continue the loop with your next hypothesis. Do not stop early.")
    except (KeyboardInterrupt, asyncio.CancelledError):
        status = "interrupted"
    except Exception as e:  # noqa: BLE001
        status = "error"
        print(f"[glassbox] run error: {e}", file=sys.stderr)
    finally:
        exps = state.experiments(log.events)
        log.emit("run_finished", "system", status=status,
                 best_read_rows=state.best_metric(log.events), baseline=state.baseline_metric(log.events),
                 experiments=len(exps), hypotheses=len(state.hypotheses(log.events)),
                 cost_usd=round(cost, 4), turns=getattr(result, "num_turns", None))
        log.set_run(status=status, finished_at=time.time(), best=state.best_metric(log.events))
        log.mirror.flush()
        print(f"[glassbox] {status}: {len(exps)} experiments, best {state.best_metric(log.events):,} "
              f"(baseline {state.baseline_metric(log.events):,}); events in {log.path}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-id", default=time.strftime("run-%m%d-%H%M"))
    ap.add_argument("--model", default="sonnet")
    ap.add_argument("--max-experiments", type=int, default=20)
    ap.add_argument("--max-turns", type=int, default=250)
    ap.add_argument("--budget-usd", type=float, default=15.0)
    ap.add_argument("--max-continuations", type=int, default=5, help="restart the agent if it stops early")
    ap.add_argument("--resume", action="store_true")
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
