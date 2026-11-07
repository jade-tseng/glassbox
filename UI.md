# UI.md — Design System

**This file is the source of truth for all frontend styling in this project.**
Every page, component and chart in the demo follows it. If something isn't covered here, pick the option that is calmer, more legible, and still moving.

Glassbox makes an agent's run visible: hypotheses, tool calls, gates, bench results. The UI should feel like **looking into a running instrument through glass**. It's built on an editorial base (hairlines, generous space, regular-weight type) with a cool palette and a layer of motion that never stops. The page is a live specimen, not a pitch: **no CTAs, no sign-up buttons, no marketing copy.**

> History: v1 of this file borrowed heavily from tokenizehq.com (cream paper, vermillion, earthy palette, pill buttons, brick terrain). v2 keeps only the general idea of hairline structure and drops their palette, shapes, illustration style and copy patterns.

---

## 1. The look in one paragraph

Cool, precise, alive. Pages sit on **frost** (`#F2F4F5`) and white, with **graphite** ink (`#121417`). One family (Geist + Geist Mono). Mono does a lot of work: labels, eyebrows, numbers, timestamps, event names. Structure comes from 1px hairlines and **6px-radius panels**. There are no pills and no shadows. Color comes from a **cool signal palette** (cobalt, cyan, mint, phosphor lime, violet), plus coral and amber kept only for failure and warning. One dark **scope** band per page is where the live trace runs. Something on screen is always gently moving: a scanline, a pulse, a stream of events, a number ticking. It reads as an instrument panel that happens to be a web page.

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

One full-bleed dark band per page. This is where live trace streams, terminals and the hero instrument go. It's our counterpart to a "feature" section, and it replaces any accent-colored block.

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

For chart series, event-type swatches, avatars and diagrams. Don't use these for large UI chrome.

| Order | Token | Hex | Typical meaning in Glassbox |
|---|---|---|---|
| 1 | `--color-cobalt` | `#3A4BFF` | Hypothesis / primary series |
| 2 | `--color-cyan` | `#22B8CF` | Tool call |
| 3 | `--color-violet` | `#8B7CF6` | Model / reasoning |
| 4 | `--color-mint` | `#7FE0C2` | Bench / measurement |
| 5 | `--color-ice` | `#A9C7FF` | Diff / file change |
| 6 | `--color-lime` | `#B8F23A` | Live |
| 7 | `--color-slate` | `#5C6B78` | Neutral / other |

**Semantic** (text-safe on light):
- success `#0F9D76`
- warning `#C98404` (amber, and fill `#FFB224`)
- danger `#E5484D` (coral, and fill `#FF6B5A`)

On the scope, use the fills (`#7FE0C2`, `#FFB224`, `#FF6B5A`) as text.

### 2.5 Color rules
- Sections alternate **frost → white → scope → frost**. A hairline sits between light sections. The scope needs no border.
- Each event type keeps its color everywhere (stream dot, chart series, legend, timeline segment).
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
Section labels are **mono, uppercase, 12px, with a leading index** like `01 / TRACE` or `02 / SIGNALS`. That's our pattern. Don't use the two-tone (black + gray) headline.

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
| **Live** | Data-driven change. Each movement means an event happened | new trace row slides in, number ticks, bar grows, pulse dot, typing caret | Yes, when data arrives (or simulated) |
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
| `TraceStream` | Live log of agent events | New row enters at top: y −8→0, opacity, with a lime left-edge flash that fades to the event color over 1.2s. Max ~8 rows visible, bottom row fades out under a mask |
| `Scanline` | Ambient sweep across the scope / instrument | 1px lime line with a 48px soft trail, translateY across the frame, 6s linear loop, 35% opacity |
| `SignalGrid` | Hero background | Dot grid (24px pitch, `--color-line`). A diagonal wave lightens dots to cobalt/lime and back, about 8s cycle, done in canvas or CSS with `background-position` |
| `Orbit` | Diagram nodes on dashed ellipses | 1px `--color-line` dashed orbits; 6px nodes travel at 24–40s per lap, each orbit a different speed |
| `Marquee` | Slow horizontal drift of labels or event types | 40s linear loop, edge-faded with a mask, pauses on hover |
| `Typewriter` | Model output appearing | ~30 chars/s, block caret in lime blinking at 1s `steps(1)` |
| `BarGrow` | Bars and proportion segments | `scaleX`/`scaleY` from 0 with origin at the baseline, `--dur-slow`, staggered |
| `LineDraw` | Sparklines and diagrams drawing in | `stroke-dasharray = length`, offset length→0, `--dur-slow`. For live sparklines, new points shift the path left with a `translateX` |
| `Shimmer` | Pending / loading | `--color-mist` block with a 1.2s light sweep. Don't use spinners |

### 6.4 Choreography of a live event
When the agent emits an event (e.g. `tool_call · bench.sh`):
1. **0ms.** The row slides into `TraceStream` with a lime edge.
2. **+60ms.** The related metric `CountUp`s (e.g. `events` +1, `read_rows` → 123).
3. **+120ms.** The timeline/proportion bar segment for that event type grows.
4. **+1200ms.** The lime edge settles to the event-type color. Only the newest row stays lime.

A denied gate (`gate · denied`) uses coral for the edge, and the row does a single 2px horizontal shake (`--dur-base`). That's the only "shake" in the system.

---

## 7. Components

### Nav
56px, frost, sticky, 1px bottom hairline. Left: the wordmark (glass cube glyph + `glassbox`, 500). Right: mono 12px status like `● LIVE · run 0412` using `PulseDot`. **No CTA buttons, no "log in".** Section anchors are optional, in mono 12px.

### Hero (instrument)
- Left: display-size name or a one-line descriptor (≤8 words, period), then a mono label row (`SAMPLE RUN · 12 events · 00:41`).
- Right or below: the **instrument frame**, a 6px-radius panel on scope with `Scanline`, a mini `TraceStream`, and a `CountUp` row.
- Background: `SignalGrid`.
- **No buttons, no "✓ no setup required" rows, no subheading pitch.**

### Panel / tile
White, 1px line, 6px radius, padding 20–24px. A mono label at the top (`TOOL CALLS`), then the content. A tile that holds live data shows a `PulseDot` in its top-right corner.

### Metric tile
Mono label (12px, muted) → `CountUp` value (mono 32–40px) → delta (12px mono, success/danger color with `↑`/`↓`). Tiles are separated by hairlines in a row.

### Trace row
Height 32px; 13px mono. Columns: `time` (muted, `00:12.4`) · 8px event-type dot · event name · detail (muted, truncated) · right-aligned value. On scope: `--color-scope-raised` hover.

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
- Describe, don't sell: `Hypothesis opened.` beats `Supercharge your agents.`
- Prefer real (or clearly `SAMPLE`) values over adjectives.
- Headlines end with a period. Keep them under 8 words.

---

## 9. Implementation

Tokens live in `web/src/app/globals.css` (`:root` + Tailwind v4 `@theme inline`). Tailwind names are `ink`, `frost`, `mist`, `line`, `muted`, `subtle`, `scope`, `scope-raised`, `scope-text`, `scope-muted`, `signal`, `live`, `cobalt`, `cyan`, `violet`, `mint`, `ice`, `slate`, `success`, `warning`, `danger`, `warn-fill`, `danger-fill`. Keyframes and motion utility classes (`.anim-pulse`, `.anim-scan`, `.anim-marquee`, `.anim-caret`, `.anim-row-in`, `.anim-shake`, `.reveal`) are in `globals.css` too. Each one respects reduced motion and `[data-paused]`.

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

## 10. Checklist before shipping any screen
- [ ] No CTA buttons, sign-up prompts or marketing copy.
- [ ] Palette is frost/white/graphite plus the cool signal palette. No cream, no vermillion, no earthy tones.
- [ ] Panels have a 6px radius, there are no pills, and there are no shadows.
- [ ] Labels and numbers are in Geist Mono, and numbers use tabular figures.
- [ ] At least one ambient and one live motion element are visible on first load.
- [ ] Lime appears only on things that are live right now.
- [ ] Everything still reads with `prefers-reduced-motion: reduce`, and loops pause offscreen.
- [ ] Only transform, opacity, filter and stroke properties are animated.
- [ ] Simulated data is labeled `SAMPLE`.
