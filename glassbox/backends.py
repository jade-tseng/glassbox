"""Model backends for the runner. Same harness (Claude Code via the Agent SDK), different model provider.

  anthropic  default; Claude models, billed to Anthropic.
  meta       Meta Model API (dev.meta.ai) through its Anthropic-compatible Messages API at https://api.meta.ai.
             Needs MODEL_API_KEY (in web/.env.local or the shell). Default model muse-spark-1.3.

The run records `agent` (harness) and `provider` in run_started, so the UI can show what produced each belief.
Note: the SDK's total_cost_usd is computed from Anthropic prices, so --budget-usd is only approximate on meta.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

from .events import ROOT

META_BASE_URL = "https://api.meta.ai"
META_DEFAULT_MODEL = "muse-spark-1.3"  # $1.25 / $4.25 per 1M; "-contributor" variant is ~12x cheaper but trains on data


@dataclass
class Backend:
    name: str  # "anthropic" | "meta"
    provider: str  # human-readable, shown in the UI
    model: str
    env: dict[str, str] = field(default_factory=dict)


def resolve(name: str, model: str | None) -> Backend:
    if name == "anthropic":
        return Backend("anthropic", "Anthropic", model or "sonnet")
    if name == "meta":
        load_dotenv(ROOT / "web" / ".env.local")
        key = os.environ.get("MODEL_API_KEY")
        if not key:
            raise SystemExit("--backend meta needs MODEL_API_KEY (Meta Model API key, starts with LLM_) "
                             "in web/.env.local or the environment")
        m = model if model and model not in ("sonnet", "opus", "haiku") else META_DEFAULT_MODEL
        return Backend("meta", "Meta Model API", m, env={
            "ANTHROPIC_BASE_URL": META_BASE_URL,
            "ANTHROPIC_AUTH_TOKEN": key,  # sent as Authorization: Bearer
            "ANTHROPIC_API_KEY": "",  # don't let a real Anthropic key take precedence
            # Claude Code makes small background calls with a "fast" model; route those to Meta too.
            "ANTHROPIC_MODEL": m,
            "ANTHROPIC_DEFAULT_HAIKU_MODEL": m,
            "ANTHROPIC_DEFAULT_SONNET_MODEL": m,
            "ANTHROPIC_DEFAULT_OPUS_MODEL": m,
            "ANTHROPIC_SMALL_FAST_MODEL": m,
            "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
        })
    raise SystemExit(f"Unknown --backend {name!r} (expected anthropic or meta)")
