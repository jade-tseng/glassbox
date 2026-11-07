"""Glassbox worker: runs cases created in the /new wizard on THIS machine (it needs the code + the agent CLI;
the website can't run agents).

  uv run python -m glassbox.worker              # poll forever
  uv run python -m glassbox.worker --once       # handle what's pending, then exit

Loop: dry_run_requested -> dry run (evaluate the untouched workspace once) -> ready | dry_run_failed | invalid
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

from .cases import CASES, build_target, dry_run, validate
from .events import ROOT

WORKER = f"{socket.gethostname()}:{os.getpid()}"


def db():
    load_dotenv(ROOT / "web" / ".env.local")
    return MongoClient(os.environ["MONGODB_URI"], appName="glassbox-worker")[os.environ.get("MONGODB_DB", "glassbox")]


def claim(cases, from_status: str, to_status: str):
    return cases.find_one_and_update(
        {"status": from_status},
        {"$set": {"status": to_status, "worker": WORKER, "updated_at": time.time()}},
        sort=[("updated_at", 1)],
        return_document=ReturnDocument.AFTER,
    )


def set_status(cases, cid: str, **fields) -> None:
    cases.update_one({"_id": cid}, {"$set": {**fields, "updated_at": time.time()}})


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
    print(f"[worker] {doc['_id']}: starting {run_id} (log: {log})")
    with log.open("w") as fh:
        rc = subprocess.run(cmd, cwd=ROOT, stdout=fh, stderr=subprocess.STDOUT).returncode
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
        if doc := claim(cases, "dry_run_requested", "dry_running"):
            handle_dry_run(cases, doc)
            did = True
        elif doc := claim(cases, "queued", "starting"):
            handle_run(cases, doc)
            did = True
        if a.once and not did:
            break
        if not did:
            time.sleep(a.interval)


if __name__ == "__main__":
    main()
