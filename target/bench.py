"""Glassbox fixed evaluator. The agent runs this; it cannot edit it.

Usage:
  python bench.py --workdir <dir>          # benchmark <dir>/schema.sql + <dir>/queries/*.sql
  python bench.py --init-baseline          # record baseline hashes from target/ itself

Prints exactly one JSON line on stdout (the result). Metric: total read_rows (lower is better).
A run only counts if every baseline query exists, runs, and returns the same (canonicalized) result.
"""

import argparse
import hashlib
import json
import re
import sys
import time
import uuid
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from chclient import client

TARGET = Path(__file__).resolve().parent
BASELINE = TARGET / "baseline" / "hashes.json"
RUNS_PER_QUERY = 3
QUERY_TIMEOUT_S = 30
# Deterministic read_rows: no result cache, no query-condition cache (25.x remembers non-matching
# granules across runs, which would lower read_rows on repeat runs and fake improvements).
QUERY_SETTINGS = {
    "max_execution_time": QUERY_TIMEOUT_S,
    "use_query_cache": 0,
    "use_query_condition_cache": 0,
    "max_threads": 4,
}


def canonical(value):
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, Decimal):
        return round(float(value), 6)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return [canonical(v) for v in value]
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return value


def result_hash(rows) -> str:
    canon = sorted(json.dumps(canonical(list(r)), ensure_ascii=False, default=str) for r in rows)
    return hashlib.sha256("\n".join(canon).encode()).hexdigest()


def split_statements(sql: str) -> list[str]:
    sql = re.sub(r"--[^\n]*", "", sql)
    return [s.strip() for s in sql.split(";") if s.strip()]


def classify(err: Exception) -> str:
    msg = str(err)
    if "TIMEOUT_EXCEEDED" in msg or "code: 159" in msg.lower() or "Timeout exceeded" in msg:
        return "timeout"
    return "sql_error"


def short(err: Exception, n: int = 600) -> str:
    return re.sub(r"\s+", " ", str(err))[:n]


def raw_columns(ch) -> list[str]:
    return [r[0] for r in ch.query("SELECT name FROM system.columns WHERE database='raw' AND table='hits_raw' ORDER BY position").result_rows]


def rebuild(schema_sql: str) -> None:
    ch = client()
    ch.command("DROP DATABASE IF EXISTS bench SYNC")
    ch.command("CREATE DATABASE bench")
    bench = client("bench")
    for stmt in split_statements(schema_sql):
        bench.command(stmt)
    cols = ", ".join(raw_columns(ch))
    bench.command(f"INSERT INTO hits ({cols}) SELECT {cols} FROM raw.hits_raw")
    bench.command("OPTIMIZE TABLE hits FINAL")


def run_queries(query_dir: Path, names: list[str]):
    ch = client("bench")
    per_query, ids = {}, {}
    for name in names:
        path = query_dir / f"{name}.sql"
        if not path.exists():
            return per_query, {"kind": "incorrect_result", "query": name, "message": f"queries/{name}.sql is missing"}
        sql = path.read_text().strip().rstrip(";")
        ids[name], rows = [], None
        for _ in range(RUNS_PER_QUERY):
            qid = f"gb-{uuid.uuid4().hex[:12]}"
            try:
                res = ch.query(sql, settings={**QUERY_SETTINGS, "query_id": qid})
            except Exception as e:  # noqa: BLE001
                return per_query, {"kind": classify(e), "query": name, "message": short(e)}
            ids[name].append(qid)
            rows = rows if rows is not None else res.result_rows
        per_query[name] = {"hash": result_hash(rows), "rows": len(rows)}

    client().command("SYSTEM FLUSH LOGS")
    all_ids = [q for v in ids.values() for q in v]
    stats = {}
    for _ in range(10):  # query_log flush can lag slightly
        res = client().query(
            "SELECT query_id, read_rows, read_bytes, query_duration_ms FROM system.query_log "
            "WHERE type = 'QueryFinish' AND query_id IN %(ids)s", parameters={"ids": all_ids})
        stats = {r[0]: r[1:] for r in res.result_rows}
        if len(stats) == len(all_ids):
            break
        time.sleep(0.3)
    for name, qids in ids.items():
        s = [stats[q] for q in qids if q in stats]
        per_query[name]["read_rows"] = max(x[0] for x in s) if s else None
        per_query[name]["read_bytes"] = max(x[1] for x in s) if s else None
        per_query[name]["latency_ms"] = sorted(x[2] for x in s)[len(s) // 2] if s else None
    return per_query, None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workdir", type=Path)
    ap.add_argument("--state", type=Path, help="best-so-far state file (default: <workdir>/../bench_state.json)")
    ap.add_argument("--init-baseline", action="store_true")
    a = ap.parse_args()

    workdir = TARGET if a.init_baseline else (a.workdir or Path.cwd()).resolve()
    state_path = a.state or (workdir.parent / "bench_state.json")
    state = json.loads(state_path.read_text()) if (state_path.exists() and not a.init_baseline) else {}
    baseline = None if a.init_baseline else json.loads(BASELINE.read_text())
    names = sorted(p.stem for p in (workdir / "queries").glob("*.sql")) if a.init_baseline else sorted(baseline["queries"])

    out = {"ok": False, "correct": False, "beats_best": False, "error": None, "schema_rebuilt": False,
           "best_read_rows_before": state.get("best_read_rows")}
    t0 = time.time()

    schema_sql = (workdir / "schema.sql").read_text()
    schema_hash = hashlib.sha256(schema_sql.encode()).hexdigest()
    exists = client().command("EXISTS TABLE bench.hits") == 1
    if a.init_baseline or not exists or state.get("schema_hash") != schema_hash:
        try:
            rebuild(schema_sql)
        except Exception as e:  # noqa: BLE001
            state.pop("schema_hash", None)
            if not a.init_baseline:
                state_path.write_text(json.dumps(state, indent=2))
            out["error"] = {"kind": classify(e), "query": "schema.sql", "message": short(e)}
            print(json.dumps(out))
            return 1
        state["schema_hash"] = schema_hash
        out["schema_rebuilt"] = True

    per_query, err = run_queries(workdir / "queries", names)
    out["per_query"] = per_query
    if err:
        out["error"] = err
    else:
        if a.init_baseline:
            BASELINE.parent.mkdir(exist_ok=True)
            BASELINE.write_text(json.dumps({"queries": {n: {"hash": v["hash"], "rows": v["rows"]} for n, v in per_query.items()},
                                            "baseline_read_rows": sum(v["read_rows"] for v in per_query.values())}, indent=2))
        wrong = [n for n in names if per_query[n]["hash"] != baseline["queries"][n]["hash"]] if baseline else []
        zero = [n for n in names if not per_query[n].get("read_rows")]
        for n in names:
            per_query[n]["correct"] = n not in wrong and n not in zero
        if wrong or zero:
            msg = []
            if wrong:
                msg.append(f"results differ from baseline: {', '.join(wrong)}")
            if zero:
                msg.append(f"read 0 rows (queries must compute from the hits data): {', '.join(zero)}")
            out["error"] = {"kind": "incorrect_result", "query": (wrong or zero)[0], "message": "; ".join(msg)}
        else:
            out["correct"] = True

    total = sum(v.get("read_rows") or 0 for v in per_query.values())
    out["total_read_rows"] = total
    out["total_read_bytes"] = sum(v.get("read_bytes") or 0 for v in per_query.values())
    out["total_latency_ms"] = sum(v.get("latency_ms") or 0 for v in per_query.values())
    if baseline:
        out["baseline_read_rows"] = baseline["baseline_read_rows"]
    if out["correct"]:
        best = state.get("best_read_rows")
        out["beats_best"] = best is None or total < best
        if out["beats_best"]:
            state["best_read_rows"] = total
    out["ok"] = out["correct"]
    out["seconds"] = round(time.time() - t0, 2)
    for v in per_query.values():
        v.pop("hash", None)
    if not a.init_baseline:
        state_path.write_text(json.dumps(state, indent=2))
    print(json.dumps(out))
    return 0 if out["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
