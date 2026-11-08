"""Glassbox worker: runs cases created in the /new wizard on THIS machine (it needs the code + the agent CLI;
the website can't run agents).

  uv run python -m glassbox.worker              # poll forever
  uv run python -m glassbox.worker --once       # handle what's pending, then exit

Loop: intake_requested  -> intake agent interprets the plain-language description -> needs_input (questions)
                           or straight on to a dry run when nothing is ambiguous
      dry_run_requested -> dry run (evaluate the untouched workspace once) -> ready | dry_run_failed | invalid
      queued            -> build target -> run the Glassbox runner (events stream to the run view) -> finished | failed
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
import time

from dotenv import load_dotenv
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import AutoReconnect, NetworkTimeout, ServerSelectionTimeoutError

TRANSIENT = (AutoReconnect, NetworkTimeout, ServerSelectionTimeoutError)


def retry(fn, attempts: int = 5):
    """Atlas drops idle connections (e.g. during a long run); retry transient errors with backoff."""
    for i in range(attempts):
        try:
            return fn()
        except TRANSIENT as e:
            if i == attempts - 1:
                raise
            print(f"[worker] transient Mongo error, retrying: {e}")
            time.sleep(1 + 2 * i)

from .cases import CASES, build_target, dry_run, validate
from .intake import interpret
from .events import ROOT, EventLog

WORKER = f"{socket.gethostname()}:{os.getpid()}"


def db():
    load_dotenv(ROOT / "web" / ".env.local")
    return MongoClient(os.environ["MONGODB_URI"], appName="glassbox-worker")[os.environ.get("MONGODB_DB", "glassbox")]


def claim(cases, from_status: str, to_status: str):
    return retry(lambda: cases.find_one_and_update(
        {"status": from_status},
        {"$set": {"status": to_status, "worker": WORKER, "updated_at": time.time()}},
        sort=[("updated_at", 1)],
        return_document=ReturnDocument.AFTER,
    ))


def set_status(cases, cid: str, **fields) -> None:
    retry(lambda: cases.update_one({"_id": cid}, {"$set": {**fields, "updated_at": time.time()}}))


def handle_intake(cases, doc) -> None:
    conv = doc.get("conversation") or []
    try:
        r = interpret(doc["_id"], conv, doc.get("spec"))
    except Exception as e:  # noqa: BLE001
        set_status(cases, doc["_id"], status="needs_input", questions=[{"field": "general", "question":
                   f"Interpreting failed ({e}). Could you rephrase or add detail?", "suggestion": ""}])
        return
    qs = r["questions"]
    reply = r["summary"] + ("".join(f"\n- {q['question']}" + (f" (suggested: {q['suggestion']})" if q.get("suggestion") else "")
                                    for q in qs) if qs else "")
    retry(lambda: cases.update_one({"_id": doc["_id"]}, {"$push": {"conversation": {"role": "glassbox", "text": reply.strip(), "at": time.time()}}}))
    set_status(cases, doc["_id"], spec=r["spec"], summary=r["summary"], questions=qs,
               status="needs_input" if qs else "dry_run_requested")
    print(f"[worker] {doc['_id']}: interpreted; {len(qs)} question(s)")


def handle_dry_run(cases, doc) -> None:
    spec = doc["spec"]
    errs = validate(spec)
    if errs:
        set_status(cases, doc["_id"], status="invalid", dry_run={"ok": False, "errors": errs, "value": None,
                                                                   "correct": False, "error": None})
        print(f"[worker] {doc['_id']}: invalid: {errs}")
        return
    r = dry_run(spec)
    set_status(cases, doc["_id"], status="ready" if r["ok"] else "dry_run_failed", dry_run=r)
    print(f"[worker] {doc['_id']}: dry run {'ok' if r['ok'] else 'FAILED'}: value={r.get('value')} error={r.get('error')}")


def needs_fallback(run_id: str, rc: int) -> bool:
    """The primary model failed: non-zero exit, an errored/interrupted finish, or no experiment recorded."""
    path = ROOT / "runs" / run_id / "events.jsonl"
    if rc != 0 or not path.exists():
        return True
    events = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    finished = [e for e in events if e["type"] == "run_finished"]
    experiments = [e for e in events if e["type"] in ("experiment_run", "experiment_failed")]
    return not finished or finished[-1].get("status") != "finished" or not experiments


def handle_run(cases, doc) -> None:
    spec = doc["spec"]
    try:
        tdir = build_target(spec)
    except ValueError as e:
        set_status(cases, doc["_id"], status="invalid", message=str(e))
        return
    runs = doc.get("runs") or []
    run_id = f"{spec['id']}-{len(runs) + 1}"
    set_status(cases, doc["_id"], status="running", run_id=run_id, runs=runs + [run_id])
    b = spec.get("budget") or {}
    cmd = [sys.executable, "-m", "glassbox.runner", "--target", str(tdir), "--run-id", run_id,
           "--backend", b.get("backend", "anthropic"), "--max-experiments", str(b.get("max_experiments", 10)),
           "--budget-usd", str(b.get("budget_usd", 5))]
    if b.get("model"):
        cmd += ["--model", b["model"]]
    log = CASES / spec["id"] / f"{run_id}.log"
    print(f"[worker] {doc['_id']}: starting {run_id} on {b.get('backend', 'anthropic')} {b.get('model', '')} (log: {log})")
    with log.open("w") as fh:
        rc = subprocess.run(cmd, cwd=ROOT, stdout=fh, stderr=subprocess.STDOUT).returncode
    fb = b.get("fallback")
    if fb and needs_fallback(run_id, rc):
        # Resume the SAME run on the fallback model, so the UI keeps one continuous run.
        EventLog(run_id).emit("agent_message", "system", text=(
            f"[harness] {b.get('model')} ({b.get('backend')}) stopped early or failed; "
            f"resuming this run on {fb['model']} ({fb['backend']})."))
        print(f"[worker] {doc['_id']}: falling back to {fb['backend']} {fb['model']}")
        resume = [sys.executable, "-m", "glassbox.runner", "--target", str(tdir), "--run-id", run_id, "--resume",
                  "--backend", fb["backend"], "--model", fb["model"],
                  "--max-experiments", str(b.get("max_experiments", 10)), "--budget-usd", str(b.get("budget_usd", 5))]
        with log.open("a") as fh:
            rc = subprocess.run(resume, cwd=ROOT, stdout=fh, stderr=subprocess.STDOUT).returncode
    tail = log.read_text()[-400:]
    set_status(cases, doc["_id"], status="finished" if rc == 0 else "failed", message=None if rc == 0 else tail)
    print(f"[worker] {doc['_id']}: {run_id} exited {rc}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--interval", type=float, default=3.0)
    a = ap.parse_args()
    cases = db()["cases"]
    print(f"[worker] {WORKER} polling for cases (Ctrl-C to stop)")
    while True:
        did = False
        try:
            if doc := claim(cases, "intake_requested", "interpreting"):
                handle_intake(cases, doc)
                did = True
            elif doc := claim(cases, "dry_run_requested", "dry_running"):
                handle_dry_run(cases, doc)
                did = True
            elif doc := claim(cases, "queued", "starting"):
                handle_run(cases, doc)
                did = True
        except KeyboardInterrupt:
            raise
        except Exception as e:  # noqa: BLE001  one bad case or network blip must not kill the worker
            print(f"[worker] error: {e!r}; continuing")
            time.sleep(a.interval)
        if a.once and not did:
            break
        if not did:
            time.sleep(a.interval)


if __name__ == "__main__":
    main()
