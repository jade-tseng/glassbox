# Make count_primes fast

`primes.py` counts primes below 300,000. Make it as fast as possible while returning the same answer.

- Measure with: `python3 bench.py` (prints `{"seconds": ..., "correct": ...}`). Lower seconds is better.
- You may edit `primes.py` only. Pure Python standard library only (no numpy).

## Glassbox rules (required)
1. First call `start_run` (task "Make count_primes fast", metric_label "seconds", direction "lower", unit "s",
   baseline = the seconds from a first `python3 bench.py` run, agent "Claude Code CLI", provider "Anthropic").
2. Before each change, call `propose_hypothesis` (claim, topic, reason, predicted direction of seconds, confidence 0-1,
   file "primes.py", symbol = the function/part you change). Link it to earlier hypotheses when it builds on them.
3. Make the change, run `python3 bench.py`, then `report_experiment` with the seconds (correct=false if the count is wrong).
4. `record_result` (kept or not, what you learned). Revert with your editor if it got worse or wrong.
5. `close_hypothesis` when the evidence is clear. Do 5 experiments, then `finish_run` with a one-line summary.
