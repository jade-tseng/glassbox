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
6. When the evidence on a hypothesis is clear, `close_hypothesis` it as `confirmed`, `refuted`, or `abandoned`.
   Don't re-test closed hypotheses. When two ideas interact, `link_hypotheses` (`contradicts` / `depends_on` /
   `refines`).
7. One idea per experiment where possible, so the evidence stays attributable.

## Budget
- At most {MAX_EXPERIMENTS} benchmark runs. Stop earlier if you run out of credible ideas, and finish with
  `get_beliefs` and a short summary of what you learned.
- Work autonomously; don't ask questions. Keep messages short.
