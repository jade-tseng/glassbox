"""Evaluator for the primes example: median runtime of count_primes(N) over 3 runs, plus a correctness check.
Prints one line: {"seconds": ..., "correct": ...}. Agents may not edit this file."""
import importlib, json, statistics, sys, time
sys.path.insert(0, ".")
N, EXPECTED = 300_000, 25_997
mod = importlib.import_module("primes")
times, results = [], []
for _ in range(3):
    t = time.perf_counter(); results.append(mod.count_primes(N)); times.append(time.perf_counter() - t)
print(json.dumps({"seconds": round(statistics.median(times), 4), "correct": all(r == EXPECTED for r in results)}))
