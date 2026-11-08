# Rebuild a system from its runtime traces

You have **runtime traces** from an unknown microservice system: no source code, no documentation. Each trace is
one user request, recorded as spans (service, operation, start offset, duration, parent span, tags, events).
Reconstruct how the system works, as precisely as the evidence allows.

## Your evidence (observations)
`traces.jsonl` holds 90 traces. Look at them with the read-only tool (every output is a recorded observation):

    python3 traces.py list [N]               python3 traces.py show <i> [N]
    python3 traces.py grep <text> [N]        python3 traces.py stats "<service> <operation>"
    python3 traces.py ops

## Your reconstruction: `model.json` (the only file you may edit)

    {
      "services": ["..."],
      "calls": [{"parent": "<service> <operation>", "child": "<service> <operation>",
                 "per_trace": 10, "parallel": true, "max_concurrency": 3}],
      "latency_ms": {"<service> <operation>": {"p50": 12.0, "p90": 30.0}},
      "error_rate": {"<service> <operation>": 0.05}
    }

Names are exactly `service operation` as printed by the tool. `per_trace` = how many times the child span appears
under that parent operation per request; `parallel` = whether those child calls overlap in time; `max_concurrency`
= the most that run at once.

## The metric
- `{EVAL_CMD}` scores model.json against **held-out traces you never see** (higher is better, 0-100):
  services 10 · call edges 30 · calls per trace 20 · parallelism 15 · latency 15 · error rates 10.
  It reports sub-scores and how many call edges are matched / missing / extra, never the answers.
- Baseline (empty model): {BASELINE}.

## The loop (Glassbox rules, required)
1. Look first: use traces.py to observe. Then call `propose_hypothesis` with ONE specific claim about how the
   system works (e.g. "the driver service retries GetDriver after redis timeouts, ~2 retries per request"), your
   reason (cite what you observed), the predicted effect on the score (`increase` / `no_change` / `decrease`),
   your confidence, file `model.json` and the part you'll change (e.g. `calls: driver -> redis GetDriver`).
2. Encode that claim in model.json, run `{EVAL_CMD}`, then `record_result` (kept or not, what you learned).
3. Keep with `git add -A && git commit -m "<id>: <claim>"`, or revert with `git checkout -- model.json`.
4. Link hypotheses that build on, refine or contradict earlier ones (`link_hypotheses`); close them when the
   evidence is clear. Prefer one claim per experiment so each result is attributable.
5. Be explicit about uncertainty: low confidence for guesses, high only for what you have clearly observed.

## Budget
{MAX_EXPERIMENTS} evaluations. Use them; refuted hypotheses are useful. Work autonomously; keep messages short.
At the end, call `get_beliefs` and summarize the system you reconstructed and what you are still unsure about.
