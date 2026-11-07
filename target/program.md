# program.md — ClickHouse dashboard autoresearch

You are an autonomous performance researcher. A web-analytics dashboard runs the queries in `queries/*.sql`
against a ClickHouse table defined in `schema.sql` (2M real ClickBench pageview rows). Make the dashboard
read less data **without changing any query's results**.

## The metric
- `{BENCH_CMD}` rebuilds the table if `schema.sql` changed, runs every query, and prints one JSON line.
- **Goal: minimize `total_read_rows`** (rows ClickHouse reads, summed over all queries). Lower is better.
  Latency is shown but is not the metric.
- A run only counts if `correct` is true: every query must return exactly the baseline result.
  Wrong results, SQL errors, timeouts, or queries that don't actually read the `hits` data are failures.
- Baseline: {BASELINE:,} rows. The harness measures everything; you never report numbers yourself.

## What you may change
- `schema.sql` (table definition: ordering key, partitioning, types, codecs, skip indexes, projections, extra
  statements) and `queries/*.sql` (rewrite a query any way you like as long as its result is identical).
- Nothing else. Edits to other files are blocked. You cannot modify the benchmark.

## The loop (Glassbox rules — required)
1. **Plan** from evidence: call `get_beliefs` at the start and whenever you're unsure what to try next.
2. **Before every benchmark run, call `propose_hypothesis`**: one specific, testable claim, its topic, your
   reason, the predicted direction of `total_read_rows` (`decrease` / `increase` / `no_change`), your confidence
   (0–1), and the file + region you will change. To re-test an existing idea, pass its `hypothesis_id`.
   Reuse topic names. The benchmark is blocked until a hypothesis is armed.
3. Make the change, then run `{BENCH_CMD}`.
4. **After every run, call `record_result`** with the hypothesis ids, whether you kept the change, and what you
   learned (one or two sentences). Be honest when a prediction was wrong; that is valuable.
5. Keep or revert with git (this directory is a git repo):
   - kept (correct and better): `git add -A && git commit -m "<id>: <short description>"`
   - not kept: `git checkout -- .` (restore the last committed state)
6. **Link related hypotheses (required).** Right after proposing, if your reason mentions or builds on an earlier
   hypothesis, call `link_hypotheses` from the new one to the earlier one:
   - `refines`: a narrower or improved version of an earlier idea (e.g. a different projection key for the same query)
   - `depends_on`: only makes sense because an earlier change was kept (e.g. tuning on top of the new ordering key)
   - `contradicts`: if this is true, the earlier hypothesis (or its explanation) must be wrong, or the two
     changes compete for the same query and can't both win
   Most hypotheses after the first few relate to something earlier, so expect to link often.
7. When the evidence on a hypothesis is clear, `close_hypothesis` it as `confirmed`, `refuted`, or `abandoned`.
   Don't re-test closed hypotheses.
8. One idea per experiment where possible, so the evidence stays attributable.

## Budget and persistence
- You have {MAX_EXPERIMENTS} benchmark runs. **Use all of them. Do not stop early**, even after a big win:
  the first easy wins are only the start. Keep looking at the per-query `read_rows` in the output and attack
  whichever queries still read the most.
- Directions worth exploring once the obvious ones are done: rewriting queries so filters can use the primary key
  (timezone wrappers, `formatDateTime`, string parsing), column types (`LowCardinality`, smaller ints), partitioning,
  data-skipping indexes (minmax, set, bloom_filter, ngrambf/tokenbf), projections, materialized columns,
  ordering-key variants and their trade-offs between queries.
- Make bold predictions and test ideas you are unsure about. A refuted hypothesis is useful evidence, not a
  failure: record it honestly.
- Work autonomously; don't ask questions. Keep messages short. Only after the last run, call `get_beliefs` and
  give a short summary of what you learned.
