# GEMINI.md — Gemini 4 Argon quick reference

Condensed from the hackathon's *Gemini 4 Argon 1-day builder guide* ([source doc](https://docs.google.com/document/d/1kN0n6hPNNTIHMVqf5-hDACrZuIg4KFrWiYpla4WQW8w/edit)). The model IDs here are mirrored in `web/src/lib/gemini.ts`.

## Which model for which job

| Job | Model / agent ID | Notes |
|---|---|---|
| Lead brain, orchestration, multi-file code, 3D (Three.js/WebGPU), video analysis | `gemini-4-argon` | 1M-token window shared by input, thinking and output |
| Hosted sandbox agent (writes and runs code, tests, MCP, web search) | `antigravity-preview-09-2026` | Pass `agent_config: { type: "antigravity", model: "gemini-4-argon" }` |
| Fast parallel subagents, tool calls, boilerplate | `gemini-3.8-flash` | Workers that Argon orchestrates |
| Routing, classification, guardrails | `gemini-3.5-flash-lite` | Lowest latency |
| Cited web research | `deep-research-preview-04-2026` | Runs in the background and returns a report |
| Real-time voice and camera | `gemini-3.8-live` | `gemini-3.8-live-extended-thinking` when it must reason while talking |
| Speech-to-text and translation | `gemini-3.5-transcribe-live`, `gemini-3.5-transcribe`, `gemini-3.5-live-translate-preview` | 70+ languages |
| Text-to-speech, voice design | `gemini-3.8-flash-tts` (`gemini-3.8-flash-lite-tts` is faster) | 130 languages |
| Images, UI assets, sprites | `gemini-nano-banana-2.1` (`gemini-3.1-flash-lite-image` for sub-second results) | Good text rendering, ratios up to 8:1 |
| Video with native audio | `gemini-omni-1.1-flash` | Run in the background |
| Music, vocals, loops | `lyria-3.5` (`lyria-3-clip-preview` for 30s loops) | 44.1 kHz stereo |
| Open / on-device | `gemma-4-31b-it` | E2B/E4B sizes run locally |

## Calling it (Interactions API)

- SDK: `@google/genai` ≥ 2.3.0 (we're on 3.x). The Interactions API is the recommended endpoint. It keeps state on the server (`previous_interaction_id`) and supports `background`.
- **`thinking_level`** goes under `generation_config`:
  - `"low"`: routing and extraction.
  - `"medium"`: the default, for interactive coding and tool use.
  - `"high"`: hard debugging, system design, maths.
- **Long outputs:** the default output cap is 65,536 tokens. To go past it, set `background: true` and a higher `max_output_tokens`, then poll `interactions.get(id)` while the status is `queued` or `in_progress`.
- **Don't send** `temperature`, `top_p`, `top_k` or `thinking_budget`. They are deprecated or ignored and return warnings. Don't call `cached_content` explicitly either, because caching happens automatically at a 95% discount on cached input.
- **Timeouts:** "high" prompts can take 15–20 minutes. Use `background: true` instead of a long HTTP request, especially on Vercel functions.
- **Pricing (intro, through 30 Nov 2026):** $2 per 1M input tokens, $10 per 1M output tokens.
- **Secrets for managed agents:** register them with the Credentials API (`client.credentials.create`) and restrict the sandbox network allowlist. Never paste secrets into prompts.

```ts
import { ask, MODELS } from "@/lib/gemini";
const { id, text } = await ask("Summarize this…", { thinking: "low" });
const follow = await ask("Now expand point 2", { previousId: id }); // server-side state
```

## Patterns worth using today

1. **Agree on intent first.** Have Argon raise questions and trade-offs before a long build, then let it run.
2. **Give it a verification loop.** Point it at tests, compiler output or a headless browser check, and iterate until everything passes.
3. **Use multimodal references.** Pass 1–2 reference images for UI work (our design rules live in `/UI.md`), or a screen recording when debugging.
4. **Orchestrate.** Argon is the architect and reviewer. Flash handles leaf tasks, and Nano Banana, Live, TTS and Lyria handle media.
5. **Capture quirks.** Write lessons into `AGENTS.md`/`CLAUDE.md` and make an architecture explainer before the demo.

## Hackathon logistics
- Claim the pre-provisioned account from the Google team at kickoff, then put the key in `web/.env.local` as `GEMINI_API_KEY` (and add it to Vercel).
- Google mentors are onsite all day. Feedback goes to gemini-developer-feedback@google.com.
- Links: aistudio.google.com/learn/gemini-4-argon-developer-guide · aistudio.google.com/build · antigravity.google · ai.google.dev/gemini-api/docs · github.com/google-gemini/cookbook · github.com/google-gemini/gemini-live-api-examples
