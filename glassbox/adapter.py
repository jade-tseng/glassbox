"""Generic evaluator: wrap ANY measure command + a verification rule into Glassbox's result-file contract.

  python -m glassbox.adapter --case <case.json> --workdir . --out <run_dir>/result.json

case.json (see cases.py):
  "measure": {"command": "python3 bench.py", "parse": {"mode": "json_key", "key": "seconds"}, "timeout_s": 120}
      parse.mode: json_key (last JSON line on stdout, dotted key ok) | regex (first group) | last_number
  "verify":  {"mode": "json_flag", "key": "correct"}      the measure output's JSON has a truthy flag
           | {"mode": "test_command", "command": "pytest -q"}   must exit 0
           | {"mode": "same_output", "command": "python3 run.py"}  stdout must equal the baseline's stdout
           | {"mode": "none"}                                  no correctness check (UI warns)

Writes {"value", "correct", "error", "measured_at"} to --out and prints a compact line for the agent.
The baseline's reference output (same_output mode) is stored next to --out on the first run.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

NUM = r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?"


def run(cmd: str, cwd: Path, timeout: float) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=timeout)


def last_json(text: str) -> dict | None:
    for line in reversed(text.strip().splitlines()):
        line = line.strip()
        if line.startswith("{"):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def dig(obj: Any, dotted: str) -> Any:
    for part in dotted.split("."):
        if not isinstance(obj, dict) or part not in obj:
            return None
        obj = obj[part]
    return obj


def parse_metric(stdout: str, parse: dict) -> tuple[float | None, str | None]:
    mode = parse.get("mode", "last_number")
    if mode == "json_key":
        data = last_json(stdout)
        if data is None:
            return None, "measure output has no JSON line"
        v = dig(data, parse.get("key", "value"))
        if not isinstance(v, (int, float)) or isinstance(v, bool):
            return None, f"JSON key '{parse.get('key')}' is missing or not a number"
        return float(v), None
    if mode == "regex":
        m = re.search(parse.get("pattern", ""), stdout)
        if not m:
            return None, f"regex {parse.get('pattern')!r} did not match"
        try:
            return float(m.group(1) if m.groups() else m.group(0)), None
        except ValueError:
            return None, f"regex matched {m.group(0)!r}, not a number"
    nums = re.findall(NUM, stdout)
    return (float(nums[-1]), None) if nums else (None, "no number in measure output")


def evaluate(case: dict, workdir: Path, out: Path) -> dict:
    measure, verify = case["measure"], case.get("verify", {"mode": "none"})
    timeout = float(measure.get("timeout_s", 300))
    result: dict[str, Any] = {"value": None, "correct": False, "error": None, "measured_at": time.time()}
    try:
        p = run(measure["command"], workdir, timeout)
    except subprocess.TimeoutExpired:
        result["error"] = {"kind": "timeout", "message": f"measure command exceeded {timeout:.0f}s"}
        return result
    if p.returncode != 0:
        result["error"] = {"kind": "measure_failed", "message": (p.stderr or p.stdout)[-600:]}
        return result
    value, err = parse_metric(p.stdout, measure.get("parse", {}))
    if err:
        result["error"] = {"kind": "parse_error", "message": err}
        return result
    result["value"] = value

    mode = verify.get("mode", "none")
    if mode == "json_flag":
        flag = dig(last_json(p.stdout) or {}, verify.get("key", "correct"))
        if flag is not True:
            result["error"] = {"kind": "incorrect_result", "message": f"'{verify.get('key', 'correct')}' is {flag!r}"}
            return result
    elif mode in ("test_command", "same_output"):
        try:
            v = run(verify["command"], workdir, float(verify.get("timeout_s", timeout)))
        except subprocess.TimeoutExpired:
            result["error"] = {"kind": "timeout", "message": "verify command timed out"}
            return result
        if mode == "test_command" and v.returncode != 0:
            result["error"] = {"kind": "incorrect_result", "message": f"tests failed: {(v.stdout + v.stderr)[-500:]}"}
            return result
        if mode == "same_output":
            ref = out.parent / "baseline_output.sha256"
            digest = hashlib.sha256(v.stdout.encode()).hexdigest()
            if not ref.exists():
                ref.write_text(digest)  # first evaluation is the baseline
            elif ref.read_text().strip() != digest:
                result["error"] = {"kind": "incorrect_result", "message": "output differs from the baseline's output"}
                return result
    result["correct"] = True
    return result


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--case", type=Path, required=True)
    ap.add_argument("--workdir", type=Path, default=Path("."))
    ap.add_argument("--out", type=Path, help="result file (default: <workdir>/../result.json)")
    a = ap.parse_args()
    case = json.loads(a.case.read_text())
    workdir = a.workdir.resolve()
    out = (a.out or workdir.parent / "result.json").resolve()
    r = evaluate(case, workdir, out)
    out.write_text(json.dumps(r))
    label = case.get("metric", {}).get("label", "metric")
    print(json.dumps({label: r["value"], "correct": r["correct"], "error": r["error"]}))
    return 0 if r["correct"] else 1


if __name__ == "__main__":
    sys.exit(main())
