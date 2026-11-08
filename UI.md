# UI.md — Design System

**This file is the source of truth for all frontend styling in this project.**
Every page, component and chart in the demo follows it. If something isn't covered here, pick the option that is calmer, more legible, and still moving.

Glassbox is a **belief layer for autoresearch loops** (see `PLAN.md`). Every experiment becomes a hypothesis with a reason, a prediction, a measured result, and a belief update. The UI's one job is to make **what the agent believed, why, and what it learned** legible at a glance, and to show it changing. It should feel like **looking into a running instrument through glass**. It's built on an editorial base (hairlines, generous space, regular-weight type) with a cool palette and a layer of motion that never stops. The page is a live specimen, not a pitch: **no CTAs, no sign-up buttons, no marketing copy.**

> **The one idea to communicate:** *the agent commits to a prediction before the harness measures it.* Every screen should make that visible: the ghost prediction drawn first, then the measured result landing on it, then the belief moving.

---

## 1. The look in one paragraph

Cool, precise, alive. Pages sit on **frost** (`#F2F4F5`) and white, with **graphite** ink (`#121417`). One family (Geist + Geist Mono). Mono does a lot of work: labels, eyebrows, numbers, timestamps, event names. Structure comes from 1px hairlines and **6px-radius panels**. There are no pills and no shadows. Color comes from a **cool signal palette** (cobalt, cyan, mint, phosphor lime, violet), plus coral and amber kept only for failure and warning. One dark **scope** surface holds the belief graph, where beliefs grow, strengthen and collapse. Something on screen is always gently moving: a scanline, a pulse, a stream of events, a number ticking. It reads as an instrument panel that happens to be a web page.

---

## 2. Color tokens

### 2.1 Core

| Token | Hex | Use |
|---|---|---|
| `--color-ink` | `#121417` | Text, strong outlines, icons. Never pure `#000`. |
| `--color-frost` | `#F2F4F5` | Page background, nav, footer. |
| `--color-white` | `#FFFFFF` | Panels and alternate sections. |
| `--color-mist` | `#E4E8EA` | Subtle fills, hovered rows, chart tracks, skeletons. |
| `--color-line` | `#C9CFD3` | Default hairline. |
| `--color-muted` | `#5F676C` | Secondary text, labels, axis ticks (4.9:1 on frost). |
| `--color-subtle` | `#8E969B` | Decorative/tertiary only (grid dots, disabled). Not for body text. |

### 2.2 The scope (dark surface)

One full-bleed dark band per page. This is where the belief graph, the activity strip and the hero instrument go. In the app, the graph canvas is the scope. It's our counterpart to a "feature" section, and it replaces any accent-colored block.

| Token | Value | Use |
|---|---|---|
| `--color-scope` | `#0E1114` | Background. |
| `--color-scope-raised` | `#161A1E` | Rows/panels inside the scope. |
| `--color-scope-line` | `rgba(230,234,236,.10)` | Hairlines on scope. |
| `--color-scope-text` | `#E6EAEC` | Primary text on scope. |
| `--color-scope-muted` | `#8A949A` | Secondary text on scope. |

### 2.3 Signal accents

| Token | Hex | Use |
|---|---|---|
| `--color-signal` | `#3A4BFF` | THE accent (cobalt). Focus rings, active state, the current event, links on hover, primary chart series. |
| `--color-live` | `#B8F23A` | Phosphor lime. **Only** for "this is happening right now": live dots, the scanline, the cursor, the newest row. Use it on scope, or on light surfaces as a fill under ink text. Never use it as text on light surfaces. |

### 2.4 Data palette (cool, glassy)

**Topics** get these colors, assigned in order of first appearance and stable for the run. Examples from `runs/bg2` are *ordering key*, *projections*, *time filters* and *skip indexes*. A topic's color marks its cluster hull, its hypotheses' left bars, its belief-timeline lines and its heatmap regions. Don't use these for large UI chrome. Mint, coral and amber are **not** topic colors; they're reserved for evidence and status (§2.5).

| Order | Token | Hex |
|---|---|---|
| 1 | `--color-cobalt` | `#3A4BFF` |
| 2 | `--color-cyan` | `#22B8CF` |
| 3 | `--color-violet` | `#8B7CF6` |
| 4 | `--color-ice` | `#A9C7FF` |
| 5 | `--color-slate` | `#5C6B78` |
| 6+ | cycle with dashed hulls | |

**Semantic** (text-safe on light):
- success `#0F9D76`
- warning `#C98404` (amber, and fill `#FFB224`)
- danger `#E5484D` (coral, and fill `#FF6B5A`)

On the scope, use the fills (`#7FE0C2`, `#FFB224`, `#FF6B5A`) as text.

### 2.5 Belief semantics (fixed meanings, used everywhere)

| Thing | Value | Visual |
|---|---|---|
| Hypothesis **open** | ink/scope-text outline | Confidence bar animates; small `PulseDot` while an experiment for it is running |
| Hypothesis **confirmed** | mint `#7FE0C2` (text `#0F9D76` on light) | Solid outline, full-opacity card |
| Hypothesis **refuted** | coral `#FF6B5A` | Card drops to 45% opacity, claim struck through in muted, bar drained |
| Hypothesis **abandoned** | slate | 45% opacity, dashed outline |
| Evidence **supports** | mint | Solid edge experiment → hypothesis |
| Evidence **refutes** | coral | Solid edge |
| Evidence **weak** (tiny delta) | `--color-subtle` | Dotted edge |
| Experiment **invalid** (`incorrect_result`, SQL error, timeout) | coral fill with a white `×` | Gets no edge weight. Gets a ring, because it's the "faster but wrong" proof moment |
| Experiment dot **kept** / **discarded** | mint fill / hollow slate | Same as PLAN §4.9 |
| Agent `kept` ≠ harness `beats_best` | amber 4px corner tick on the dot | "Interesting, not an error" |
| **Gate blocked** | amber `#FFB224` | Small diamond marker on the timeline and next to the topic hull |
| **Prediction** (stated before the run) | dashed outline in the hypothesis's topic color, 50% opacity | Always drawn *before* the result. The result fills it in |
| Cross-link `contradicts` | coral dashed + label | |
| Cross-link `depends_on` | scope-muted solid + arrowhead + label | |
| Cross-link `refines` | ice dashed + label | |
| **Cited by a query answer** | `--color-signal` 2px ring + signal glow chip with the citation number | |

### 2.6 Color rules
- Sections alternate **frost → white → scope → frost**. A hairline sits between light sections. The scope needs no border.
- Each topic keeps its color everywhere (hull, card bar, timeline line, heatmap region).
- Status colors (mint/coral/amber) always mean the §2.5 belief semantics and nothing else.
- Lime is reserved for "now". If everything is lime, nothing is live. Use at most ~3 lime elements in a viewport.
- Never let color carry meaning alone. Pair every swatch with a mono label.

---

## 3. Typography

### 3.1 Families
- **Sans:** Geist, for headings and prose.
- **Mono:** Geist Mono for eyebrows, labels, numbers, timestamps, event names, code, table numerics, nav links. In Glassbox, mono is the *voice of the instrument*, so lean on it.
- Loaded through `next/font/google` in `layout.tsx` (`--font-geist-sans`, `--font-geist-mono`).

### 3.2 Weight
- 400 for body. **500 for headings** and the wordmark. Never 600 or 700.

### 3.3 Scale

| Role | Size / line-height | Tracking | Family |
|---|---|---|---|
| Display | 44px / 1.05 (32px mobile) | `-0.03em` | Sans 500 |
| H2 | 28px / 1.15 (24px mobile) | `-0.025em` | Sans 500 |
| H3 | 18px / 1.35 | `-0.01em` | Sans 500 |
| Body | 16px / 24px | normal | Sans 400 |
| Small | 14px / 20px | normal | Sans 400 |
| Label | 12px / 16px, UPPERCASE | `0.08em` | Mono 400 |
| Event row | 13px / 20px | normal | Mono 400 |
| Metric | 32–40px | `-0.04em` | Mono 400, tabular |
| Metric small | 20px | `-0.02em` | Mono 400, tabular |

### 3.4 Labels, not eyebrows
Section labels are **mono, uppercase, 12px, with a leading index** like `01 / REASONING` or `02 / SIGNALS`. That's our pattern. Don't use the two-tone (black + gray) headline.

---

## 4. Shape, borders, depth

- **Radius:** `6px` for panels, inputs, tiles and the instrument frame. `3px` for chips and tags. `50%` for dots. **No pill buttons.**
- **Borders:** `1px solid var(--color-line)`. Panels are outlined, not filled-and-shadowed.
- **Shadows:** none.
- **Glass:** exactly one translucent treatment, used *only* over moving backgrounds (the signal grid, the scope): `background: rgba(255,255,255,.62); backdrop-filter: blur(12px) saturate(1.2); border: 1px solid rgba(255,255,255,.7)`. On scope: `rgba(22,26,30,.6)` with `--color-scope-line`. Don't put glass on static, flat backgrounds, where it does nothing.
- **Gradients:** only as masks (edge fades on marquees/streams) and the scanline's soft trail. Never on fills or text.

---

## 5. Spacing & layout

- 4px base. Steps: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Gutter: 40px desktop, 16px mobile. Max width 1200px.
- Section padding: 96px desktop, 56px mobile.
- **Panel grids:** tiles share hairlines (`grid gap-px bg-line` with white cells, outer 6px radius + `overflow-hidden`).
- Left-aligned. The hero is left-aligned too.
- Breakpoints follow Tailwind defaults (`sm 640`, `md 768`, `lg 1024`, `xl 1280`).

---

## 6. Motion (the core of this system)

Motion is how Glassbox says "this is live". Every screen has three layers:

| Layer | What it is | Examples | Always on? |
|---|---|---|---|
| **Ambient** | Slow background life that implies a running system | signal grid shimmer, scanline sweep, orbiting nodes, drifting marquee | Yes, while in view |
| **Live** | Data-driven change. Each movement means an event happened | graph node appears and its edge draws in, signal flows along links, event row slides in, number ticks, bar grows, pulse dot, typing caret | Yes, when data arrives (or simulated) |
| **Response** | Direct feedback to the user | hover tint, press, focus ring, expand | On interaction |

### 6.1 Tokens

```css
--ease-out:    cubic-bezier(.2, .8, .2, 1);   /* default for entering things */
--ease-in-out: cubic-bezier(.65, 0, .35, 1);  /* things moving across the screen */
--ease-linear: linear;                         /* ambient loops only */

--dur-instant: 80ms;    /* press, toggle */
--dur-fast:    160ms;   /* hover, color */
--dur-base:    280ms;   /* row enter, expand */
--dur-slow:    600ms;   /* count-up, line draw, section enter */
--dur-ambient: 6s–40s;  /* loops: pulse 2s, scan 6s, orbit 24s, marquee 40s */

--stagger: 60ms;        /* between siblings entering together */
```

### 6.2 Rules
1. **Animate only `transform`, `opacity`, `filter`, `stroke-dashoffset` and `background-position`.** Never animate layout (width/height/top), except bars, which use `scaleX`/`scaleY` from an edge.
2. **No springs, no bounce, no overshoot.** Instruments are precise. Use ease-out to settle.
3. **Live motion must be truthful.** If something pulses, it's live. When the run stops, the pulse stops and the dot turns `--color-subtle`. Simulated data must be labeled `SAMPLE`.
4. **Budget per viewport:** at most 1 ambient background, 1 stream, and a handful of tickers or pulses. If two things compete for attention, slow one down.
5. **Pause offscreen.** Loops pause (`animation-play-state: paused`) when out of view or when the tab is hidden. Use the `useInView` hook.
6. **`prefers-reduced-motion: reduce`.** All ambient loops stop. Entrances become a plain opacity fade (≤150ms). Streams still update, but rows appear without sliding. Numbers jump straight to their value.
7. **Enter once.** Section entrances run once (fade + `translateY(12px)` + `blur(4px)` → 0, `--dur-slow`, `--ease-out`, children staggered by `--stagger`).

### 6.3 Motion primitives (all in `web/src/components/motion/`)

| Primitive | Behavior | Spec |
|---|---|---|
| `Reveal` | Section/child entrance on scroll | opacity 0→1, y 12→0, blur 4→0; `--dur-slow`; once; `delay = index × --stagger` |
| `PulseDot` | "Live" indicator | 8px lime dot plus a ring that scales 1→2.4 and fades, 2s loop. Grey and still when idle |
| `CountUp` | Number ticking to a value | `--dur-slow`, ease-out, tabular mono so width never jitters. Re-ticks from the old value when the value changes |
| `EventLog` | Raw feed of agent events (secondary, e.g. the hero instrument) | New row enters at top: y −8→0, opacity, with a lime left-edge flash that fades to the event color over 1.2s. Max ~8 rows visible, bottom row fades out under a mask |
| `Scanline` | Ambient sweep across the scope / instrument | 1px lime line with a 48px soft trail, translateY across the frame, 6s linear loop, 35% opacity |
| `SignalGrid` | Hero background | Dot grid (24px pitch, `--color-line`). A diagonal wave lightens dots to cobalt/lime and back, about 8s cycle, done in canvas or CSS with `background-position` |
| `Orbit` | Diagram nodes on dashed ellipses | 1px `--color-line` dashed orbits; 6px nodes travel at 24–40s per lap, each orbit a different speed |
| `Marquee` | Slow horizontal drift of labels or event types | 40s linear loop, edge-faded with a mask, pauses on hover |
| `Typewriter` | Model output appearing | ~30 chars/s, block caret in lime blinking at 1s `steps(1)` |
| `BarGrow` | Bars and proportion segments | `scaleX`/`scaleY` from 0 with origin at the baseline, `--dur-slow`, staggered |
| `LineDraw` | Sparklines and diagrams drawing in | `stroke-dasharray = length`, offset length→0, `--dur-slow`. For live sparklines, new points shift the path left with a `translateX` |
| `Shimmer` | Pending / loading | `--color-mist` block with a 1.2s light sweep. Don't use spinners |
| `GraphGrow` | Belief graph nodes and links appearing | Card enters with opacity + y 8→0, `--dur-slow`. Existing nodes tween to their new ELK positions (600ms `--ease-in-out`). Edges draw with `stroke-dashoffset` (pathLength 1). The newest card gets a lime outline that fades over 1.2s |
| `EdgeFlow` | Evidence travelling from experiment to hypothesis | 2px particle in the evidence color (mint supports, coral refutes, none for weak/invalid), 1 pass per 2.4s. Only on edges whose experiment is under 10s old (§6.5). Paused offscreen |
| `BeliefTween` | Confidence changing | The posterior fill tweens (600ms, `--ease-out`) from the old value to the new one, and its mono number `CountUp`s. The dashed prediction tick never moves |
| `Collapse` | Hypothesis refuted | The bar drains to 0 (600ms), then the card goes to 45% opacity, y +4px, and the claim is struck through (280ms). No bounce |
| `FlyTo` | Before → Graph morph | A FLIP tween of shared-id dots from the staircase chart to their graph positions, 600ms `--ease-in-out`, 30ms stagger |

### 6.4 Choreography of one experiment cycle
Motion follows the real event sequence (PLAN §4.5). Each step is triggered by its event, never by a timer:

| Event | What moves (≤ 600ms each, `--ease-out`) |
|---|---|
| `hypothesis_proposed` | A card fades and rises into its topic cluster (the ELK layout re-flows existing nodes with a 600ms position tween, never a jump). The **prediction** draws as a dashed ghost: `↓ read_rows · 70%`. The confidence bar fills from 0 to the stated prior. Lime flash on the card |
| `gate_blocked` | An amber diamond drops onto the timeline at `t`, and the topic hull does one 2px shake. That's the only shake in the system |
| `experiment_run` | An experiment dot appears next to the hypothesis with a lime ring. The edge **draws** from dot to card (stroke-dashoffset). A particle travels along it in the evidence color. The metric staircase steps down (or not) as a `CountUp` |
| `experiment_failed` / invalid | The dot lands in coral with an `×`. The edge stays dotted and weightless. A coral ring pulses three times, then stops |
| `experiment_interpreted` | The agent's note types into the ledger row (`Typewriter`). The kept/beats_best mismatch tick appears if they disagree |
| (belief engine update) | The confidence bar **tweens** to the new posterior. If it crosses 0.5, the number flips color. The belief-timeline line extends with `LineDraw` |
| `hypothesis_closed` | Confirmed: the card outline settles to mint. Refuted: the card **collapses**: the bar drains to 0 over 600ms, then the card fades to 45% opacity and drops 4px (gravity, not bounce). The claim is struck through |
| `hypothesis_linked` | The cross-link draws between the two cards, then its label fades in |

When the scrubber moves, the same transitions play **in reverse or skip forward**: everything is a pure function of `seq` (`buildGraph(events, upToSeq)`), and the view tweens between states (280ms), so rewinding feels like rewinding.

### 6.5 Motion semantics (every motion means something)
- **Growing or filling** means belief gained.
- **Draining or dropping** means belief lost.
- **Something travelling along a link** means evidence flowing from experiment to belief.
- **A lime flash** means "this just happened".
- **A signal ring** means "the answer cites this".
- **Shake** happens once per gate block, and nowhere else.

Ambient loops (signal grid, orbit, scanline) are only for the landing page and empty states. **In the app, nothing moves unless an event caused it**, except the `LIVE` pulse and the particles on edges whose experiment is less than 10s old.

---

## 7. Components

### Nav
56px, frost, sticky, 1px bottom hairline. Left: the wordmark (glass cube glyph + `glassbox`, 500). Right: mono 12px status like `● LIVE · run 0412` using `PulseDot`. **No CTA buttons, no "log in".** Section anchors are optional, in mono 12px.

### Hero (instrument)
- Left: display-size name or a one-line descriptor (≤8 words, period), then a mono label row (`SAMPLE RUN · 12 events · 00:41`).
- Right or below: the **instrument frame**, a 6px-radius panel on scope replaying a real run (`runs/bg2`, labeled `REPLAY`). It holds a `Scanline`, a `CountUp` of best `read_rows` (from 20,000,000), the metric staircase, and a `CountUp` row (hypotheses, experiments, refuted). It replaces the event log. Implemented in `components/belief/RunSummary.tsx`.
- Background: `SignalGrid`.
- **No buttons, no "✓ no setup required" rows, no subheading pitch.**

### Panel / tile
White, 1px line, 6px radius, padding 20–24px. A mono label at the top (`TOOL CALLS`), then the content. A tile that holds live data shows a `PulseDot` in its top-right corner.

### Metric tile
Mono label (12px, muted) → `CountUp` value (mono 32–40px) → delta (12px mono, success/danger color with `↑`/`↓`). Tiles are separated by hairlines in a row.

### App shell (the demo app, PLAN §4.9)
```
┌──────────────────────────────────────────────────────────────────────┐
│ ◇ glassbox   run bg2 ▾      [ Ask: why did you give up on H6? ]  ● LIVE │  56px nav + query box
├────────────────────────────────────────────────┬─────────────────────┤
│  GRAPH | HEATMAP | BEFORE                      │  LEDGER             │
│                                                │  H9  projections  ▮▮▮▯ 0.71 │
│   scope canvas: topic hulls, hypothesis        │  H8  skip indexes ▮▮▮▮ 0.86 │
│   cards, experiment dots, cross-links          │  H6  projections  ▯▯▯▯ ✕    │
│                                                │  …                  │
│                                                │  answer panel (when asked) │
├────────────────────────────────────────────────┴─────────────────────┤
│ BELIEF TIMELINE  (confidence lines per hypothesis, gate diamonds)       │
│ ACTIVITY ▏▏▏ ▏▏  ▏▏▏▏ ▏                                                  │
│ ◀ ━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━  seq 54 / 70   00:02:16          │  scrubber
└──────────────────────────────────────────────────────────────────────┘
```
- The graph canvas is the scope (dark). The ledger and timeline are light (white panels on frost). One dark surface only.
- The right ledger is 320px and collapses to a bottom sheet under `lg`.
- Tabs are mono 12px uppercase. The active tab has a 1px ink underline, which slides between tabs (`--dur-base`).

### Belief flow (signature component)
The centerpiece: the run as a **connected graph over time** (`components/belief/BeliefFlow.tsx`). It isn't a board of boxes.
- **Axes:** x = time in the run (minute ticks), y = belief (`refuted` 0 · `unsure` 0.5 · `certain` 1).
- **Hypothesis = a short segment.** It starts at the agent's stated prediction (a hollow dot labeled `H#`), steps when its experiment lands, and ends at its final belief. **Colored by outcome only:** mint means held up, coral means dropped (it falls to 0), light gray means still open, with a faint dashed tail to "now". Topic names are never used as a visual category. "Claimed, not shown" appears only in the card text.
- **Links connect lineages, with two kinds only:** **builds on** (the agent's `refines` and `depends_on`) is a thin light line, and **conflicts with** (`contradicts`) is a dashed coral line that is always labeled. Each arc runs from the parent's point at the child's start (or the parent's end) to the child's start.
- **Legend:** five marks in Beliefs (prediction · held up · dropped → 0 · builds on · conflicts with), and two in Before (change kept · change reverted). Don't add more.
- **Hover a hypothesis:** its lineage lights up, and a one-line label says what the idea is ("H16 · Rewriting q07/q08 as an inner GROUP BY…"). The link labels also appear ("H16 builds on H12").
- **Click a hypothesis:** a glass card opens next to its dot (`HypothesisCard.tsx`) showing **the idea** (the agent's claim), **what it did** (files changed, rows scanned before → after, kept or reverted, the agent's note), predicted → now, and its relations ("builds on H12 · conflicts with H21"). Status words: held up · dropped · still open. Close it with ✕, Escape, or a click on empty canvas.
- **No topic jargon on the page.** The agent's topic names (ordering key, projections…) only color the lines. They mean nothing to a visitor, so the card explains each idea in its own words instead.
- **Before → Beliefs:** the same SVG. Experiment dots sit at (experiment #, rows scanned) in Before, and fly to (time, belief) on their hypothesis's segment in Beliefs. The view opens on Before and flies to Beliefs once, after about 3s.
- **Replay bar:** play and scrub. Every view on the page reads the same position. The page opens on the finished run, paused.
- **Data:** the landing page replays `bg3` (25 hypotheses, 23 explicit links), since lineage needs links.

### Belief timeline + scrubber
- X axis is time or seq. Each hypothesis is a 1.5px line in its topic color, starting at its proposal at the stated prior (a hollow dot marks the prediction) and stepping at each experiment. Confirmed lines end in a mint dot. Refuted lines **fall to 0 and stop** in coral, which is the "beliefs rising and collapsing" moment. Gate blocks are amber diamonds on the baseline.
- Below it sits a 6px **activity strip** of `agent_action` ticks (slate; lime for the newest).
- The scrubber is a 1px ink track with a 12px handle. Dragging tweens the whole UI. The `LIVE` badge shows only when the handle is at the head; drag away and it becomes `REPLAY · seq 54`, plus a mono `→ live` jump link.

### Metric staircase & the "before" view
- **Before (the demo hook):** the plain autoresearch view. A keep/discard dot chart of `read_rows` per experiment: mint filled dots for kept, hollow for discarded, with a step line for best-so-far on a log y-axis. No hypotheses, no words. It's deliberately flat.
- **Transition, Before → Graph:** each dot **flies** to its experiment position in the belief graph (600ms, `--ease-in-out`, 30ms stagger), then cards and links fade in around them. It's the single "wow" transition. Build it with shared ids and a FLIP tween.
- In the Graph tab, the staircase shrinks to a 48px-high sparkline in the ledger header, with each step labeled by the hypothesis that caused it.

### Ledger
A hairline-separated list on white, one row per hypothesis, newest first. Each row has: id, topic dot, a one-line claim, the mini prediction-vs-belief bar, and a status chip. Expanding a row shows reason → prediction → experiments (mono deltas) → the agent's interpretation notes → closing summary, as a vertical chain with 1px connectors. *Reason* and *note* text come from the agent (sans), and *numbers* come from the harness (mono). That separation is principle §3.2 made visible, so keep it strict.

### Query box & answer
- In the nav, a 40px input with 6px radius and 1px line, placeholder `Ask the run: why did you give up on H6?`, and mono `⌘K`.
- The answer streams into the top of the ledger panel at ~45 chars/s with a lime caret. Citations `[1]` are signal-colored chips that hover-link to nodes. Unknown ids are dropped silently (PLAN §4.8).

### Heatmap tab
- The files (`schema.sql`, `queries/*.sql`) are rendered as mono code on white, with line numbers muted.
- Each region (clause or symbol) gets a background tint. **Hue** is the topic color of the hypotheses that touched it, and **intensity** is the impact (sum of kept `read_rows` reduction), on a 5-step scale from 0% to 32% alpha. Touch count is a mono badge in the gutter.
- Regions touched only by refuted hypotheses get a coral hatch instead, as in "tried here, didn't help".
- Clicking a region lists its hypotheses. Tints tween as the scrubber moves.

### Event row (secondary)
Height 32px; 13px mono: `time` · dot · event · detail · value. Use it only in debug/expanded views and as the raw "what was it doing" list behind the activity strip. Never as a hero.

### Loop illustration (landing)
The orbit diagram stays, relabeled to the real loop: `PREDICT` (inner), `MEASURE` (middle), `UPDATE` (outer), with `GATE` at the center. Nothing reaches `MEASURE` without passing the gate.

### Chips / tags
3px radius, 12px mono, padding `2px 8px`, 1px line. Event-type chips have an 6px color dot inside. Status chips: `PASS` mint fill, `WARN` amber fill, `DENIED` coral fill, all with ink text.

### Timeline / proportion bar
8px tall, 3px radius on the outer ends only, and a 1px gap between segments in the background color. It's colored by event type and grows with `BarGrow`. Legend below: dot + mono label + mono count.

### Tables
Header 12px mono uppercase muted. Rows 14px, 40px tall, hairline separated, hover `--color-mist`. Numeric columns right-aligned mono.

### Charts
- Bars: cobalt (single series) or the data palette order; 2px radius top; animate with `BarGrow`.
- Lines: 1.5px, drawn with `LineDraw`. The live point is a lime `PulseDot`.
- Gridlines: dashed `--color-line` at 60%. Tooltips: white panel, 1px ink border, mono values.

### Glass cube (brand mark & illustration)
Our own mark is an isometric wireframe cube drawn with 1px ink strokes. Its faces are filled with translucent cobalt/cyan/ice at 12–20% opacity, and a small lime node sits inside it. As illustration, the cube can be large, rotate slowly (40s), and have event dots float through it. This replaces any "brick terrain" style art.

### Things we don't build
CTA buttons, pricing, testimonials, logo strips, FAQ accordions, "book a demo", newsletter forms, and marketing stats ("10× faster"). If a section exists only to persuade, cut it.

---

## 8. Voice
- Sentence case. Labels are mono uppercase.
- **Beliefs, not tool calls.** Glassbox is not an LLM tracing product (Langfuse, Braintrust). Don't use "trace", "span" or "observability" in the UI. The vocabulary is *hypothesis, prediction, evidence, belief, confirmed / refuted, topic, gate*.
- Agent words vs harness numbers: anything the agent said is quoted sans text. Anything the harness measured is mono. Never mix the two in one string.
- Describe, don't sell: `Hypothesis opened.` beats `Supercharge your agents.`
- Prefer real (or clearly `SAMPLE`) values over adjectives.
- Headlines end with a period. Aim for under 8 words; a contrast headline ("X shows what. Y shows why.") may run to 10.
- Each section may have **one context paragraph of at most 3 sentences** (≤ 65ch per line). Explaining the problem isn't marketing; selling is. See §9 for the exact copy.

---

## 9. Copy & story

This section fixes **what the page says and in what order**, not how it looks. Components stay as specified in §7. Text in quotes is the copy to ship; *italic notes* explain intent. When the run or data changes, keep the structure and swap the numbers.

### 9.1 The story in one breath
Agents can now run research loops by themselves. What they leave behind is a scoreboard, not a line of reasoning. Glassbox makes the agent say what it believes before each experiment, lets a harness measure what actually happened, and shows the beliefs moving. That's how you judge an agent's research, and the environment it was scored in.

*Glassbox is general: any task with a fixed verifier (a codebase + a benchmark, a dataset + an eval) can be the input. ClickHouse is just the first target. Don't say "RL environment" in the hero; save it for the closing section.*

### 9.2 Page order (the narrative arc)
**One visual first, few words.** The landing page opens straight on the graph; the argument is made in the talk, not on the page.

| # | Section | Job |
|---|---|---|
| 1 | `Agent Archaeology.` + "mapping agents' belief system under uncertainty" + the main hypothesis in 2–3 sentences (top, scope). **Clicking the main hypothesis opens a glass panel** (`MainHypothesis.tsx`) where a visitor describes a different scenario. It's sent to the same intake as /new, then continues on /new?case=<id>. | A real run opens on **Before** (the keep/discard chart), then flies to **Beliefs** on its own after ~3s. The inspector and timeline sit below it. |
| 2 | `02 / Runs` | Every real run as a compact table linking to its run view, plus `Describe a problem →` (/new) and `All runs →` (/run). |
| 3 | `03 / Impact` | Which ideas paid off, with one computed sentence per chart. |
| 4 | `04 / Loop` | The orbit: predict → measure → update, with the gate at the center. |

*Removed from the landing page (Nov 7, evening): the hero copy and instrument, `00 / Context`, `01 / The run`, `05 / Why it matters`. Their copy below (§9.3–9.5, §9.9) stays as talk-track and run-view reference.*

### 9.3 Hero
- Headline: "Autoresearch shows what worked. Glassbox shows why."
- Body (keep verbatim): "Glassbox plugs into an agent's research loop. Before every experiment, the agent must state a hypothesis and a prediction. The harness measures the result, and you see what it believed, what happened, and what it learned."
- Label row: `PREDICT · MEASURE · UPDATE`
- Instrument header: `REAL RUN · REPLAYED` (never `bg2` or other internal ids)
- Instrument caption: "Claude Code tuning a ClickHouse schema on 2M rows of web-analytics data. Goal: scan fewer rows, same results."
- Metric label: `ROWS SCANNED`, with the sub-label "lower is better · from 20,000,000"

### 9.4 `00 / Context` (problem + research taste)
- Headline: "A scoreboard isn't a research log."
- Body: "Agents can now run research loops on their own: change something, run the benchmark, keep or revert, repeat. What they leave behind is a list of experiments that stuck. It doesn't say what the agent expected, why it tried each idea, or what the failures taught it."
- Second beat, research taste: "The open question is no longer whether agents can do the engineering of research. It's whether they have research taste: choosing which ideas are worth testing, predicting what will happen, and changing their mind when they're wrong. Taste doesn't show up on a leaderboard. It shows up in the reasoning."
- Three mono facts, as a hairline row:
  - `AUTORESEARCH GIVES YOU` "keep / discard"
  - `GLASSBOX ADDS` "hypothesis → prediction → measured result → belief"
  - `ENFORCED BY` "a gate: no benchmark runs without a stated prediction"

*Don't name people or papers in the research-taste lines. Keep it about the question, not the debate's participants.*

### 9.5 `01 / The run`: lay out the main hypothesis first
Whenever a run starts (live or replayed), the **first thing shown is the main hypothesis**: the claim the whole run is trying to establish, before any sub-hypothesis appears. Everything after it is framed as "the hypotheses we're testing on the way".

Structure, top to bottom:
1. `MAIN HYPOTHESIS`: one sentence, phrased as a falsifiable claim, not a goal.
2. `TASK`: what the agent may change.
3. `VERIFIER`: what measures success, and what counts as failure.
4. `BASELINE` → `TARGET`: numbers in mono.
5. Then: "On the way, the agent proposes smaller hypotheses. Each one must carry a prediction before it's tested." This leads into §9.6.

Copy for the ClickBench target (`target/program.md`):
- Main hypothesis: "This dashboard's 10 queries can return exactly the same results while scanning a small fraction of the 20,000,000 rows they scan today."
- Task: "Change the table definition (`schema.sql`) and rewrite queries (`queries/*.sql`). Nothing else."
- Verifier: "The harness rebuilds the table, runs every query, and reads rows scanned from ClickHouse's own query log. Any changed result, SQL error or timeout is a failure, never a win."
- Baseline/target: `20,000,000 rows` → `as low as it goes, same answers`
- Closing line (after the run ends): "Verdict: supported. 20.0M → 0.96M rows scanned (−95%), all results identical, across 25 experiments and 22 hypotheses."

*Data note: the event log has no main-hypothesis field yet. Until `run_started` carries one (e.g. `goal` / `main_hypothesis`), derive it from the target's `program.md`. Its verdict is computed from the metric, not stated by the agent.*

### 9.6 `02 / Beliefs`: the hypotheses tested on the way
- Headline: "Same run. Now with its reasoning."
- How-to-read line, shown once above the graph: "Start on Before: that's what autoresearch normally shows. Switch to Beliefs: each dot becomes evidence for a hypothesis. ┆ is what the agent predicted; ▬ is what the measurements say now."
- Tab labels: "Before · what worked" / "Beliefs · why"
- Topic hulls keep the agent's topic names (they're its own words).
- Card status words: `OPEN`, `CONFIRMED`, `REFUTED`, `ABANDONED`.
- The "tension" marker is called **"Claimed, not shown"**. Inspector text: "The agent marked this confirmed. The measurements don't back it."
- Inspector field labels: `WHY IT TRIED THIS (agent)`, `PREDICTION`, `WHAT THE NUMBERS SAY (harness)`, `EVIDENCE`, `WHAT IT CONCLUDED (agent)`. The *(agent)* and *(harness)* tags are deliberate. They teach the reader whose words are whose.
- Timeline title: "How its beliefs moved". Caption: "Each line starts at the agent's prediction. Refuted ideas fall to zero."

### 9.7 `03 / Impact`
- Headline: "Which ideas actually paid off."
- Lead sentence, computed from data: "One line, the ORDER BY, accounts for {12.4M} of the {19.0M} rows saved."
- Calibration: "When it was confident (≥ 0.7), it was right {5} of {5} times. Across all tested predictions: {11} of {20}."
- *Always show one computed insight sentence above a chart. Never ship a chart with only a label.*

### 9.8 `04 / Loop`
- Headline: "No measurement without a prediction."
- Body: "The agent states what it expects. A hook blocks the benchmark until it does. The harness, not the agent, reports the numbers, and the belief moves."
- Orbit labels stay `PREDICT` / `MEASURE` / `UPDATE` with `GATE` at the center.

### 9.9 `05 / Why it matters`: two levels
**Level 1, the argument (keep verbatim):**
- Headline: "Pass/fail says whether. Beliefs say how."
- Body: "Every autoresearch loop is an RL environment: a task, a state, and a verifier. When a score jumps and no hypothesis explains it, or a claim is confirmed that the numbers don't support, that's the signal environment builders need. Every belief here was stated before the experiment, measured by the harness, and can be replayed."

**Level 2, how it works underneath** (mono labels, sans text, one line each, as a hairline list under the argument):
- `TOOLS`: "The agent gets five tools: propose a hypothesis (claim, reason, predicted direction, confidence 0–1, the code it'll touch), link it to earlier ones (refines, depends on, contradicts), record what it learned, close it, and read its current beliefs."
- `GATE`: "A pre-tool hook denies any benchmark run until a hypothesis with a prediction is armed. A second hook blocks edits outside the allowed files."
- `HARNESS`: "The evaluator rebuilds the data, runs the queries, and checks every result against the baseline hash. The agent can't edit it, and it never reports its own numbers."
- `EVENT LOG`: "Every proposal, result, block and conclusion is an append-only, sequence-numbered event, mirrored to a database. That's what makes any run replayable to the exact step."
- `BELIEF MATH`: "Confidence starts from the agent's stated prior and updates with each measured result, weighted by how much the metric moved. Moves under 1% count as weak, and invalid runs count as no evidence. It's deterministic, with no model in the loop."
- `DROP-IN`: "It runs inside Claude Code via the Agent SDK; other agents can use the same tools."

*Claim discipline: say "the signal you'd need". Never say "we detect reward hacking" (PLAN §1b).*

### 9.10 Glossary (first use on the page gets the plain gloss)
| Term in data | Say in prose | Gloss |
|---|---|---|
| `read_rows` | rows scanned | "how much data the dashboard reads; lower is better" |
| `hypothesis` | hypothesis | "a specific, testable claim with a predicted outcome" |
| `prediction.confidence` | prediction | "how sure the agent was, before testing" |
| belief / posterior | belief | "how well the measurements back the claim now" |
| `kept` / `discarded` | kept / discarded | the change stayed in, or was reverted |
| `invalid` / `incorrect_result` | failed | "faster but wrong, or broken; never counts as a win" |
| tension | claimed, not shown | agent says confirmed, numbers disagree |
| run id (`bg2`) | *never shown* | use "real run · replayed" |
| `gate_blocked` | blocked by the gate | "tried to benchmark without a prediction" |

### 9.11 Words
- Use: hypothesis, prediction, evidence, belief, verifier, harness, research taste, replay.
- Avoid: trace, span, observability (§8), "AI-powered", "insights", "supercharge", "magic", and any claim of detection or guarantees.
- Numbers: always real or labeled `REPLAY` / `SAMPLE`. Format large counts with separators (`20,000,000`) in prose, and abbreviate (`20.0M`) in labels.

## 10. Implementation

Tokens live in `web/src/app/globals.css` (`:root` + Tailwind v4 `@theme inline`). Tailwind names are `ink`, `frost`, `mist`, `line`, `muted`, `subtle`, `scope`, `scope-raised`, `scope-text`, `scope-muted`, `signal`, `live`, `cobalt`, `cyan`, `violet`, `mint`, `ice`, `slate`, `success`, `warning`, `danger`, `warn-fill`, `danger-fill`. Keyframes and motion utility classes (`.anim-pulse`, `.anim-scan`, `.anim-marquee`, `.anim-caret`, `.anim-row-in`, `.anim-shake`, `.reveal`) are in `globals.css` too. Each one respects reduced motion and `[data-paused]`.

**Libraries (PLAN §5):** use `@xyflow/react` for the graph with custom `nodeTypes`/`edgeTypes` only, and import none of xyflow's default CSS beyond the base. Use `elkjs` (`layered`, direction RIGHT, topic hulls as compound nodes) for layout, and animate between ELK layouts with a position tween rather than a re-render jump. Use `recharts` for the timeline and staircase, with custom ticks in mono, no default tooltip styling, and `isAnimationActive` off (we drive the tweens ourselves from `seq`).

**Data:** UI components take `GraphState` from `buildGraph(events, upToSeq)`. Landing/specimen visuals should replay a real recorded run (`runs/bg2/events.jsonl`) labeled `SAMPLE`, rather than invented data.

Class recipes:

```txt
label       font-mono text-[12px] uppercase tracking-[0.08em] text-muted
display     text-[32px] md:text-[44px] font-medium leading-[1.05] tracking-[-0.03em]
h2          text-[24px] md:text-[28px] font-medium leading-[1.15] tracking-[-0.025em]
panel       rounded-[6px] border border-line bg-white p-5 md:p-6
scope       bg-scope text-scope-text
metric      font-mono tabular-nums text-[36px] tracking-[-0.04em]
chip        rounded-[3px] border border-line px-2 py-0.5 font-mono text-[12px]
row         h-8 font-mono text-[13px] border-b border-line
section     px-4 py-14 md:px-10 md:py-24
```

---

## 11. Checklist before shipping any screen
- [ ] No CTA buttons, sign-up prompts or marketing copy.
- [ ] The page follows the §9 story order, and a run opens with its main hypothesis.
- [ ] Internal ids (`bg2`, raw event names) never appear in prose.
- [ ] Palette is frost/white/graphite plus the cool signal palette. No cream, no vermillion, no earthy tones.
- [ ] Panels have a 6px radius, there are no pills, and there are no shadows.
- [ ] Labels and numbers are in Geist Mono, and numbers use tabular figures.
- [ ] At least one ambient and one live motion element are visible on first load.
- [ ] Lime appears only on things that are live right now.
- [ ] Everything still reads with `prefers-reduced-motion: reduce`, and loops pause offscreen.
- [ ] Only transform, opacity, filter and stroke properties are animated.
- [ ] Simulated or replayed data is labeled `SAMPLE` / `REPLAY`.
- [ ] Every hypothesis shows its **prediction** (dashed) before its result (solid).
- [ ] Agent-stated text is sans and harness numbers are mono.
- [ ] In the app, every motion traces back to an event or the scrubber.
