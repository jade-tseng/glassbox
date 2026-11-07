# Gemini feedback log

Running notes for the Google team (onsite all day; also gemini-developer-feedback@google.com).
Add a line the moment something happens: date/time, model ID, what you tried, and what you saw. Specific beats polished.

## What worked

- _e.g. 14:10 · gemini-3.5-flash-lite · per-event hypothesis-vs-diff check returned in ~Xms, structured output parsed first try_

## What broke / surprised us

- _e.g. 15:30 · gemini-4-argon · background interaction stayed `queued` for N min on Vercel; error text was …_

## What we wish existed

- _e.g. a way to … so that …_

## Where we used Gemini in Glassbox

| Feature | Model | Status |
|---|---|---|
| Hack-signal check (does the diff match the stated hypothesis?) | `gemini-3.5-flash-lite` | planned |
| NL query over the belief graph | `gemini-4-argon` | planned |
| Second agent through the same MCP server (drop-in proof) | `gemini-4-argon` / `antigravity-preview-09-2026` | stretch |
| Voice questions in the demo | `gemini-3.8-live` | stretch |
