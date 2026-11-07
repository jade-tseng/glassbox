# Glassbox

**A drop-in belief layer for autoresearch loops.** An experiment log tells you *what* worked. Glassbox shows
*what the agent believed, why, and what it learned*, and lets you ask it in plain English.

Every experiment becomes a hypothesis with a reason, a prediction, a measured result and a belief update.
Hypotheses link to each other (refines / depends on / contradicts). Discarded experiments become evidence
instead of noise. Glassbox doesn't care what the agent is optimizing or which model drives it: a run describes
its own task and metric, and the UI is built from that.

**Live:** https://miniglass.vercel.app/run · example runs:
[bg3](https://miniglass.vercel.app/run/bg3) (ClickHouse, 25 experiments, 23 cross-links),
[bg2](https://miniglass.vercel.app/run/bg2)

![views](https://img.shields.io/badge/views-belief%20graph%20·%20ledger%20·%20timeline%20·%20heatmap%20·%20ask-3A4BFF)

---

## How it works

```
 your agent (any harness, any model)                     Glassbox
 ───────────────────────────────────                     ────────────────────────────────────────────
 states a hypothesis + prediction  ──►  event log  ──►  belief engine (pure, deterministic)
 runs an experiment                     (JSONL +         · Beta(α,β) confidence per hypothesis,
 reports / is measured                   MongoDB)          seeded by the agent's stated prior
 interprets, links, closes ideas                          · evidence: supports / refutes / weak / invalid
                                                          · calibration, topic stance, metric series
                                                         web app: belief graph · ledger · scrubber +
                                                         belief timeline · code heatmap · NL questions
```

Three rules hold no matter how you connect:

1. **The event log is the single source of truth.** Replays, scrubbing and questions all read events.
2. **The agent states beliefs; something else measures.** With the Glassbox runner, numbers come from your
   evaluator through a hook and the agent can't misreport them. With the bridge or client, numbers are
   client-reported and the UI labels them that way.
3. **Numbers are deterministic, words are the agent's.** Confidence is computed from events, not asked of a model.

---

## Ways to plug in

Pick the one that matches how your agent runs.

| | You bring | Who measures the metric | Enforced "hypothesis before experiment" |
|---|---|---|---|
| **A. Glassbox runner** | a target folder (task + evaluator) | your evaluator, via a hook (agent can't touch it) | hard gate (hook denies the eval command) |
| **B. MCP bridge** | any MCP-capable agent (Claude Code, Codex CLI, Gemini CLI, …) | the agent reports it | soft gate (report rejected + logged) |
| **C. Ingest API / Python client** | your own loop, any language | your code | up to you |

All three write the same events; the UI can't tell them apart except for the *client-reported* label.

### Or just describe it: `/new`

Write what you want improved in plain language, e.g. *"Make count_primes in /home/me/primes faster. bench.py
measures it."* A worker on the machine with the code picks it up:

1. **Intake agent** (read-only Claude) reads your description and the code, fills in the measure command, how to
   read the number, what may change, and how to verify correctness, then asks **only** what's unclear. It always
   confirms verification if you didn't state it.
2. **Dry run**: the untouched code is measured once through the generic evaluator
   ([`glassbox/adapter.py`](glassbox/adapter.py)): the number must parse and the check must pass.
3. **Start**: the runner (A) runs the case; you watch it in the run view, and it appears in `/run`.

```bash
uv run python -m glassbox.worker      # on the machine that has the code and your agent login
```

The generic evaluator wraps any command: metric from a JSON key, a regex or the last number printed; verification
by a test command (must exit 0), a JSON flag, unchanged output, or none (flagged as unverified). Structured
specs can also be posted directly: `POST /api/cases {"action": "dry_run", "spec": {...}}` (see
[`glassbox/cases.py`](glassbox/cases.py) for the spec).

### A. Glassbox runner (Claude Code via the Agent SDK, your own target)

The runner gives the agent in-process belief tools plus hooks: it **blocks your evaluator until a hypothesis is
armed**, restricts edits to your editable files, and records the evaluator's own numbers after every run.

1. **Make a target folder** (see [`target/`](target) for a full example):

   ```
   my-target/
   ├── target.json     # task, metric, editable files, evaluator
   ├── program.md      # the agent's brief (placeholders below)
   ├── <starting files>
   └── <your evaluator>
   ```

   `target.json`:

   ```json
   {
     "name": "Speed up the image pipeline",
     "description": "Make batch processing faster without changing outputs.",
     "metric": { "key": "seconds", "label": "seconds per batch", "short": "s", "unit": "s", "direction": "lower" },
     "breakdown": { "key": "per_stage", "field": "seconds", "label": "stage", "file_pattern": "stages/{name}.py" },
     "editable": ["pipeline.py", "stages/*.py"],
     "copy": ["pipeline.py", "stages"],
     "program": "program.md",
     "eval": {
       "command": "{python} {target}/evaluate.py --workdir .",
       "match": "evaluate.py",
       "result_file": "result.json",
       "correct_key": "correct",
       "error_key": "error"
     }
   }
   ```

   - `direction`: `"lower"` or `"higher"` is better. The UI, belief math and heatmap follow it.
   - `breakdown` is optional: per-component values (per query, per stage, per test…). With `file_pattern`, each
     component is shown on its file in the heatmap.
   - **Evaluator contract:** run in the agent's workdir, then write `<run dir>/<result_file>` (the parent of the
     workdir) as JSON with at least `metric.key`. Optional: `correct` (bool), `error` (`{kind, message}` or a
     string), `beats_best`, and the breakdown dict. Print whatever you like to stdout for the agent. Glassbox
     reads the file, so the agent piping or truncating stdout can't change the numbers.
   - `program.md` placeholders: `{EVAL_CMD}`, `{BASELINE}`, `{MAX_EXPERIMENTS}`. Tell the agent to call
     `propose_hypothesis` before each run, `record_result` after, `link_hypotheses` when ideas build on each
     other, and `close_hypothesis` when evidence is clear. [`target/program.md`](target/program.md) is a good template.

2. **Run it:**

   ```bash
   uv sync
   uv run python -m glassbox.runner --target my-target --run-id my-run-1 --max-experiments 20
   ```

   Each run gets `runs/<run_id>/work`, a fresh git repo with your starting files. If the agent stops early, the
   runner restarts it with its beliefs restored (`get_beliefs`). `--resume` continues a run.

3. **Choose the model backend** (`--backend`):

   | Backend | Flag | Needs |
   |---|---|---|
   | Anthropic (default) | `--backend anthropic --model sonnet` | `claude auth login`, or `ANTHROPIC_API_KEY` |
   | Meta Model API | `--backend meta --model muse-spark-1.3` | `MODEL_API_KEY` (Meta's Anthropic-compatible endpoint) |
   | Any other Anthropic-compatible endpoint | copy the `meta` entry in [`glassbox/backends.py`](glassbox/backends.py) | its base URL + key |

   The harness stays Claude Code; the backend only swaps where model calls go. For a different *harness*
   (Codex, Gemini CLI), use the bridge (B).

### B. MCP bridge: any MCP-capable agent

[`glassbox/mcp_bridge.py`](glassbox/mcp_bridge.py) exposes the belief tools as a standalone MCP server that
streams to a Glassbox deployment: `start_run`, `propose_hypothesis`, `report_experiment`, `record_result`,
`link_hypotheses`, `close_hypothesis`, `get_beliefs`, `finish_run`.

Environment for the bridge: `GLASSBOX_RUN_ID` (your run's id), `GLASSBOX_URL` (your deployment, e.g.
`https://miniglass.vercel.app`), `GLASSBOX_INGEST_TOKEN`, and optionally `GLASSBOX_AGENT` / `GLASSBOX_PROVIDER`
(shown in the UI).

**Claude Code** (`.mcp.json` in your project, or `--mcp-config`):

```json
{ "mcpServers": { "glassbox": {
    "command": "uv",
    "args": ["run", "--quiet", "--directory", "/path/to/glassbox", "python", "-m", "glassbox.mcp_bridge"],
    "env": { "GLASSBOX_RUN_ID": "my-run-1", "GLASSBOX_URL": "https://your-app.vercel.app", "GLASSBOX_INGEST_TOKEN": "..." }
} } }
```

**Codex CLI** (`~/.codex/config.toml`):

```toml
[mcp_servers.glassbox]
command = "uv"
args = ["run", "--quiet", "--directory", "/path/to/glassbox", "python", "-m", "glassbox.mcp_bridge"]
env = { GLASSBOX_RUN_ID = "my-run-1", GLASSBOX_URL = "https://your-app.vercel.app", GLASSBOX_INGEST_TOKEN = "...", GLASSBOX_AGENT = "Codex CLI", GLASSBOX_PROVIDER = "OpenAI" }
```

**Gemini CLI** (`~/.gemini/settings.json`, or `.gemini/settings.json` in the project):

```json
{ "mcpServers": { "glassbox": {
    "command": "uv",
    "args": ["run", "--quiet", "--directory", "/path/to/glassbox", "python", "-m", "glassbox.mcp_bridge"],
    "env": { "GLASSBOX_RUN_ID": "my-run-1", "GLASSBOX_URL": "https://your-app.vercel.app", "GLASSBOX_INGEST_TOKEN": "...",
             "GLASSBOX_AGENT": "Gemini CLI", "GLASSBOX_PROVIDER": "Google" }
} } }
```

Then give the agent a brief like [`examples/primes/program.md`](examples/primes/program.md): call `start_run`,
propose before each change, `report_experiment` after measuring, interpret, link, close, `finish_run`.
Check your tool's docs for exact config locations; the server itself is a plain stdio MCP server.

### C. Ingest API (any language) and the Python client

```python
from glassbox.client import Glassbox          # stdlib only; reads GLASSBOX_URL / GLASSBOX_INGEST_TOKEN

gb = Glassbox("my-run-1")
gb.start("Speed up the image pipeline", metric_label="seconds per batch", direction="lower", unit="s",
         baseline=12.4, agent="my-loop", provider="Google", model="gemini-4-argon")
h1 = gb.hypothesis("Decoding dominates; turbojpeg halves it", topic="decoding",
                   direction="decrease", confidence=0.7, reason="profile: 60% in PIL decode")
gb.experiment(7.9, files_changed=["pipeline.py"])      # attaches to h1 automatically
gb.interpret(kept=True, note="decode time fell 55%")
h2 = gb.hypothesis("Parallel decode helps further", topic="decoding", direction="decrease", confidence=0.5)
gb.link(h2, h1, "depends_on", "builds on the faster decoder")
gb.experiment(8.3)                                      # worse: not a new best
gb.close(h2, "refuted", "GIL-bound; threads don't help")
gb.finish()
```

Raw HTTP:

```bash
curl -X POST https://your-app.vercel.app/api/ingest \
  -H "Authorization: Bearer $GLASSBOX_INGEST_TOKEN" -H "Content-Type: application/json" \
  -d '{"run_id": "my-run-1", "events": [
        {"type": "hypothesis_proposed", "claim": "Caching the config avoids disk reads", "topic": "io",
         "reason": "profile", "prediction": {"direction": "decrease", "confidence": 0.7}},
        {"type": "experiment_run", "metric_after": 8.0, "files_changed": ["app.py"]}
      ]}'
```

The server assigns `seq`, fills `t`, assigns `H#`/`E#` ids when missing (returned in `accepted`), and attaches an
experiment without `hypothesis_ids` to the hypotheses proposed since the previous experiment. Invalid events
come back in `rejected` with a reason. Up to 500 events per request.

---

## Event schema

All events: `run_id`, `seq`, `t` (seconds since start), `type`, `source` (`mcp` / `hook` / `system` / `ingest`).

| type | key fields |
|---|---|
| `run_started` | `task {name, description, metric {key, label, short, unit, direction}, breakdown?, editable?}`, `agent`, `provider`, `model`, `baseline {value, breakdown?}`, `files {path: content}?` |
| `hypothesis_proposed` | `id?`, `claim`, `topic`, `reason`, `prediction {direction: decrease\|increase\|no_change, confidence 0–1}`, `code_region {file, symbol}` |
| `hypothesis_linked` | `from`, `to`, `relation: contradicts\|depends_on\|refines`, `reason` |
| `experiment_run` | `id?`, `hypothesis_ids?`, `metric_before?`, `metric_after`, `correct`, `beats_best?`, `diff?`, `files_changed?`, `breakdown?` |
| `experiment_failed` | `id?`, `hypothesis_ids?`, `error_kind` (e.g. `sql_error`, `timeout`, `incorrect_result`), `message` |
| `experiment_interpreted` | `experiment_id`, `kept`, `note` |
| `hypothesis_closed` | `id`, `status: confirmed\|refuted\|abandoned`, `summary` |
| `gate_blocked` | `kind`, `command` |
| `agent_action` / `agent_message` | `tool`, `target`, `summary` / `text` |
| `run_finished` | `status`, `best` |

`prediction.direction` is the predicted change in the metric's raw value; `task.metric.direction` says which
way is better. Confidence math: Beta(α, β) seeded from the stated prior (4 pseudo-observations); a correct
experiment moving the metric the predicted way adds to α, the other way to β, weighted by the size of the change;
changes under 1% are weak evidence; failed or incorrect runs carry no evidence and are flagged.

---

## Run your own deployment

The web app is Next.js on Vercel with MongoDB Atlas.

| Variable | Used for |
|---|---|
| `MONGODB_URI`, `MONGODB_DB` | event store (runner mirror + ingest + UI) |
| `GLASSBOX_INGEST_TOKEN` | auth for `POST /api/ingest` (any long random string) |
| `SUBQ_API_KEY` | NL questions: SubQ Snap picks the evidence; the answer is composed from the agent's own records |
| `MODEL_API_KEY` | optional: Meta Model API backend for the runner |
| `GEMINI_API_KEY` | optional: Gemini helpers (`docs/GEMINI.md`) |

```bash
cd web && npm install && npm run dev          # http://localhost:3000/run
```

Put the variables in `web/.env.local` (gitignored; `web/.env.example` lists the names) and in your Vercel
project. Pages show a static replay from `web/public/replays/<run_id>.json` instantly when one exists
(`uv run python -m glassbox.export_replay <run_id>`), then poll for newer events.

### The ClickBench example target

```bash
cd target && docker compose up -d && uv run python load_data.py   # needs target/data/hits_{0,1}.parquet
uv run python -m glassbox.runner --target target --run-id demo --max-experiments 25
```

Data: the first two partitions of ClickBench `hits`
(`https://datasets.clickhouse.com/hits_compatible/athena_partitioned/hits_{0,1}.parquet`), 2M rows.
`bench.py` rebuilds the table when `schema.sql` changes, measures `read_rows` from the query log, and checks every
query's result against baseline hashes.

---

## Repo layout

```
glassbox/            Python: runner (Agent SDK), tools, hooks, targets, event log, client, MCP bridge
target/              ClickBench example target (target.json, program.md, schema.sql, queries/, bench.py)
examples/primes/     tiny non-SQL example for the MCP bridge (seconds, lower is better)
web/                 Next.js app: belief engine, run view, ingest/events/query APIs
docs/                Gemini notes and feedback log
UI.md                design system (source of truth for frontend styling)
```

Built in one day at a hackathon (Nov 2026).
