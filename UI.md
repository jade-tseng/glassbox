# UI.md — Design System

**This file is the source of truth for all frontend styling in this project.**
Every page, component and chart in the demo follows it. If something isn't covered here, pick the option that's quieter, flatter and more editorial.

Reference: the visual language of [tokenizehq.com](https://www.tokenizehq.com/) (analyzed 2026-11-07). We borrow the *style* (palette approach, type, flatness, layout rhythm). We don't copy their logo, artwork SVGs, copy, or brand name.

---

## 1. The look in one paragraph

Warm, calm, editorial. Most of the page is cream paper (`#F5F2EC`) and white. There's near-black ink (`#202020`), one typeface family (Geist + Geist Mono), all text at **regular weight (400)**, and big headings with tight negative tracking. **No shadows, no gradients on UI, and no rounded cards.** Structure comes from **1px hairline rules** and grid lines. Only buttons and pills are rounded, and they're **fully round (9999px)**. Color comes in only in two ways: (a) big blocks of illustration made from a muted, earthy palette (amber, vermillion, sage, rose, lilac…), and (b) one full-bleed accent section in vermillion. Numbers and data use the **mono** font. The whole thing feels like a well-printed annual report that happens to be software.

---

## 2. Color tokens

### 2.1 Core (used for 95% of the UI)

| Token | Hex | Use |
|---|---|---|
| `--color-black` | `#202020` | All text, primary buttons, strong borders. Never use pure `#000`. |
| `--color-cream` | `#F5F2EC` | Page background, nav, footer, showcase sections. Text color on dark/accent surfaces. |
| `--color-white` | `#FFFFFF` | Alternate section background, cards inside cream sections, secondary button fill. |
| `--color-sand` | `#E8E3D9` | Hero gradient top, subtle fills, hovered rows, chart tracks. |
| `--color-stone` | `#B9BAB5` | Default hairline borders/dividers (the most common border on the site). |
| `--color-muted` | `#797979` | Secondary text, labels, axis ticks (≈ `color(srgb .475 .475 .475)`). |
| `--color-subtle` | `#848484` | Tertiary text, placeholder text. |

### 2.2 Accent

| Token | Hex | Use |
|---|---|---|
| `--color-accent` (`vermillion`) | `#D14F35` | THE brand accent. Full-bleed "results"/stat sections, key highlights, focus rings, destructive/alert states. Use it sparingly. One accent block per page is the right amount. |

### 2.3 Illustration / data palette (earthy, muted)

Use these for illustrations, chart series, avatars, tag dots and category swatches. **Don't** use them for text or for large UI chrome (apart from the single accent section).

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `--color-amber` | `#F2C247` | | `--color-sage` | `#BDDDD0` |
| `--color-orange` | `#E98F3E` | | `--color-sky` | `#8DC3E7` |
| `--color-vermillion` | `#D14F35` | | `--color-teal` | `#347980` |
| `--color-blush` | `#E9C1AC` | | `--color-pine` | `#183A38` |
| `--color-rose` | `#E599BB` | | `--color-emerald` | `#6ABF79` |
| `--color-lilac` | `#BFBBDC` | | `--color-forest` | `#30693A` |
| `--color-camel` | `#C59968` | | `--color-lime` | `#D8DE58` |
| `--color-umber` | `#8B5831` | | `--color-crimson` | `#A93551` |
| `--color-plum` | `#581D3C` | | | |

**Chart series order** (good contrast against cream/white, still calm). This matches the dashboard on the reference site:
1. `#9FB4B4` (slate sage, the default single-series bar color; a darker sage)
2. `--color-lilac` `#BFBBDC`
3. `--color-amber` `#F2C247`
4. `--color-sage` `#BDDDD0`
5. `--color-rose` `#E599BB`
6. `--color-orange` `#E98F3E`
7. `--color-teal` `#347980`

**Semantic:** success = `--color-emerald` `#6ABF79` (checkmarks, "up is good"). Warning = `--color-amber`. Danger / negative delta = `--color-vermillion`.

### 2.4 Color rules
- Background alternates **cream → white → cream** between sections. That alternation, plus a hairline rule, *is* the section divider.
- Text is always `--color-black` on light surfaces and `--color-cream` on black or vermillion surfaces. On vermillion, secondary text is cream at 85% opacity and labels are cream at 72%.
- Hairlines: `--color-stone` for neutral dividers, `--color-black` for emphasized outlines (secondary buttons, table frames, the window chrome on product screenshots). On dark/accent surfaces use `rgba(245,242,236,.18)`.
- No color-only meaning: pair swatches with labels.

---

## 3. Typography

### 3.1 Families
- **Sans:** [Geist](https://vercel.com/font) for everything.
- **Mono:** Geist Mono for numbers, metrics, currency, token counts, code, timestamps, and table numeric columns.
- Load them with `next/font` (`import { GeistSans } from 'geist/font/sans'`) or Google Fonts (`family=Geist:wght@400;500&family=Geist+Mono:wght@400;500`).

### 3.2 Weight
- **400 for nearly everything, headings included.** The site gets hierarchy from size and tracking, not weight.
- 500 is allowed only for small UI labels that need a bit of presence (e.g. trust-badge labels, active nav item, table header).
- **Never use 600/700.** Bold headings break the look immediately.

### 3.3 Scale

| Role | Size / line-height | Tracking | Notes |
|---|---|---|---|
| Display (H1) | 50px / 50px (1.0) | `-0.02em` | Hero only. Max ~14 words, 2 lines. |
| H2 large | 35–37px / 40px | `-0.02em` to `-0.035em` | Section headlines, often centered. |
| H2 | 28px / 32–36px | `-0.035em` | Pillar headlines. |
| H3 | 20–24px / 28–32px | `-0.01em` | Card titles. |
| Body L | 18px / 26px | normal | Lead paragraphs. |
| Body | 16px / 24px | normal | Default. |
| Small | 14px / 20px | normal | Nav, buttons, captions, table cells. |
| XS | 12–13px / 16px | normal | Meta, axis labels. |
| Eyebrow | 14px, UPPERCASE | `0.14em` (≈1.96px) | Section labels like "RESULTS". Muted color. |
| Metric (mono) | 36–37px | `-0.03em` | Big stat numbers in Geist Mono. |
| Metric small (mono) | 20–24px | `-0.01em` | Dashboard KPI tiles. |

On mobile, scale display down to ~36px and H2 to ~28px.

### 3.4 The two-tone headline
A signature pattern: the **lead phrase in black and the rest in muted gray**, same size, one paragraph:

```html
<h2 class="text-[28px] leading-[1.15] tracking-[-0.035em]">
  Observe. <span class="text-muted">See where AI is being used, what it costs, and which work creates the most value.</span>
</h2>
```

Use it for feature or pillar intros.

---

## 4. Shape, borders, depth

- **Radius:** two values only.
  - `0` for cards, panels, sections, tables, images, inputs-in-tables.
  - `9999px` (pill) for buttons, tags, chips, toggles, avatar circles (`50%`).
  - Optional exception for app UI: form inputs and the product "window" frame may use `6px` when a pill reads wrong. Keep it consistent.
- **Borders:** `1px solid`. Everything is defined by hairlines. Prefer dividers between list items (`border-bottom`) over boxes around them.
- **Shadows: none.** The site has zero `box-shadow`. Don't add elevation. Overlays (menus, modals) are white with a `1px solid --color-black` border, or a stone border plus a backdrop of `rgba(32,32,32,.12)`.
- **Gradients:** only one, the hero background `linear-gradient(#E8E3D9 0%, #FFFFFF 100%)`. No gradient buttons and no glassmorphism.

---

## 5. Spacing & layout

- Base unit is **4px**. Common steps: 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 120.
- **Page gutter:** 40px desktop, 16px mobile.
- **Max content width:** ~1200px for full layouts. **640–760px** for centered header blocks (headline + subcopy).
- **Section padding:** 80px vertical desktop (`py-20`), 48px mobile.
- **Grid with visible lines:** feature grids, stat grids and trust strips are laid out as cells that share 1px borders (like a table), with no gaps between cards. Build it as `grid gap-px bg-stone` with white/cream cells, or as cells with `border-r border-b`.
- **List rows:** `py-3` (12px), `border-b border-stone`, 16px text. Used for feature lists.
- **Bento:** asymmetric grids (one tall 2-column tile + several small tiles) with 1px outlined tiles and generous inner padding (24–32px).
- Left-align by default. Center only the showcase/CTA header blocks.

Breakpoints: `xs 480`, `sm 640`, `md 768`, `lg 1024`, `xl 1440`.

---

## 6. Components

### Navigation bar
- Height ~56px, background cream, sticky, with a `1px` bottom hairline (stone). No blur and no shadow.
- Left: wordmark (small glyph + lowercase name, ~20px, weight 500). Center: 14px links, with dropdown chevrons for menus. Right: text link ("Log in") and a **small black pill** CTA.

### Buttons
| Variant | Style |
|---|---|
| Primary | bg `#202020`, text `#F5F2EC`, pill, 16px text, height 48px, padding `0 28px`. |
| Secondary | bg white, text `#202020`, `1px solid #202020`, pill, same size. |
| Small (nav) | Same as primary, height 30px, padding `0 16px`, 14px text. |
| Ghost/link | Text only, 14px, underline on hover. |
| On accent | bg cream, text black (inverse of primary). |

Hover: primary goes to `#000` or opacity .9; secondary goes to sand fill. Transitions are 150ms ease. **No** scale or lift effects. Focus: `outline: 2px solid var(--color-accent); outline-offset: 2px`.

Under the hero CTAs, put a row of small reassurance items: 14px text with an emerald ✓ (e.g. "✓ No setup required").

### Eyebrow + headline + body block
Eyebrow (uppercase, tracked, muted) → H2 (regular weight, tight tracking) → 16px body in black or muted, max-width ~60ch.

### Cards / tiles
White (or cream on white sections), `1px solid --color-stone`, radius 0, padding 24–32px. Title 20px/400, body 14–16px muted. No icons in colored circles. If you need an icon, use a 16–20px line icon in black.

### Stat block (hero metrics)
Large mono number (36px, `-0.03em`) above a 16px label at 85% opacity. Lay them out in a 2×N grid separated by hairlines. Best used inside the **vermillion accent section** with cream text.

### KPI tile (dashboard)
- Label: 12–13px, muted (e.g. "Total Spend").
- Value: Geist Mono 20–24px, black (e.g. `$91,734.70`).
- Delta: 12px mono with a small arrow. Vermillion for bad (cost up), emerald for good.
- Tiles sit in a row divided by vertical hairlines. No boxes.

### Tables
- Header row 12–13px muted, sentence case, `border-b`.
- Rows 14px, `py-2.5`, `border-b border-stone/60`, hover `bg-sand/50`.
- Numeric columns are **right-aligned and mono**.
- Leading avatar: 20px circle in a palette color with a 1-letter initial.
- Legend/category rows: 8px square swatch + label + mono value right-aligned.

### Stacked proportion bar
A signature data viz: a 6–8px-tall horizontal bar split into segments in palette colors, with no gaps or rounded ends. Put a legend list below it. Use it for "breakdown by provider / team / category".

### Tags / pills
Pill radius, 12–13px, `1px solid --color-stone`, padding `2px 10px`, transparent fill. Status pills may use a palette color at full saturation as fill with black text (e.g. amber "Pending").

### Trust / logo strip
A full-width row of equal cells separated by vertical hairlines, each holding a centered 16px line icon + 16px/500 label.

### Integration marquee
A horizontally scrolling row of `icon + name` items separated by small `•` bullets, faded at both edges with a mask gradient.

### FAQ accordion
Rows separated by hairlines, question at 18px/400, `+`/`−` on the right, answer at 16px muted. No boxes.

### Product "window" frame
To show app screenshots or embedded demo UI, wrap them in a frame: `1px solid --color-stone` border, top bar ~28px tall with three 8px **outlined** (not colored) circles, and a cream-white inner surface. This is the main way to present the demo on a landing page.

### App shell (for the actual demo app)
- **Sidebar** (~220px): cream-white background, right hairline, org switcher at top (avatar circle + name + chevron). Nav groups have small muted group labels (e.g. "Observe", "Optimize", "Govern") and 14px items with 16px line icons. Active item gets black text and a sand background; others are muted.
- **Top bar:** page title 16–18px left, time-range dropdown ("Last 30 days ⌄") right, hairline below.
- **Tabs:** 14px text, active tab has a 1px black underline.
- **Notice banner:** full-width row with a 1px stone border, a small icon, 14px text, and a right-aligned "Review" link.
- **Panels** are separated by hairlines in a grid. Don't put floating cards with gaps on the app canvas.

### Charts
- Bars: single color `#9FB4B4` (or the palette order for multi-series), square corners, 2px gaps.
- Lines: 1.5px, vermillion or rose for "trend/average" overlays.
- Gridlines: dashed `--color-stone` at 50% opacity, or none. Axis labels 11–12px muted, values in mono.
- No chart shadows, 3D effects or gradient fills. Tooltips are white with a black 1px border and mono values.

---

## 7. Illustration & imagery

The reference site's personality comes from **large, flat, geometric illustrations** in the earthy palette:

1. **Isometric block / brick terrain.** A field of rectangular cells (like stacked tokens or bricks) in amber, vermillion, sage, rose, blush and cream. Each cell has a thin `#202020` 1px outline and diagonal edges that suggest 3D steps. It runs full-bleed along the bottom of the hero and the top of the footer.
2. **Line-art diagrams.** Thin (1px) stone-gray circles, ellipses and dashed orbits on white, with small outlined nodes, used as abstract visuals for each feature pillar.

**How to make our own (original) version:**
- Build an SVG grid of rectangles (e.g. 48×28px cells) with `stroke="#202020" stroke-width="1"`, fill each with a palette color chosen by a simple height-map function, and add parallelogram "side faces" in a darker tint for the stepped look. Keep 3–5 colors per composition.
- For line art, use `<circle>`/`<ellipse>` with `fill="none" stroke="#B9BAB5"` and a few `stroke-dasharray="4 4"` orbits, plus 10px outlined node circles.
- Optional subtle motion: slow drifting nodes along orbits (20–40s loops) or cells that fill in on scroll. Keep it calm and respect `prefers-reduced-motion`.

No stock photos, no 3D renders, no emoji and no gradient blobs.

---

## 8. Motion
- 150–200ms `ease-out` for hovers and color changes. 250–300ms for accordions and dropdowns.
- On scroll, content fades up 8–12px, once only.
- No bouncy springs, parallax or scale-on-hover.

---

## 9. Voice (UI copy)
- Sentence case everywhere (buttons, headings, nav). Only eyebrows are uppercase.
- Short and declarative: "Observe. Optimize. Govern."
- Headlines end with a period.

---

## 10. Implementation

### 10.1 CSS variables (drop into `globals.css`)

```css
:root {
  /* core */
  --color-black: #202020;
  --color-cream: #f5f2ec;
  --color-white: #ffffff;
  --color-sand: #e8e3d9;
  --color-stone: #b9bab5;
  --color-muted: #797979;
  --color-subtle: #848484;
  --color-accent: #d14f35;

  /* illustration / data palette */
  --color-amber: #f2c247;
  --color-orange: #e98f3e;
  --color-vermillion: #d14f35;
  --color-blush: #e9c1ac;
  --color-rose: #e599bb;
  --color-lilac: #bfbbdc;
  --color-camel: #c59968;
  --color-umber: #8b5831;
  --color-plum: #581d3c;
  --color-sage: #bdddd0;
  --color-sky: #8dc3e7;
  --color-teal: #347980;
  --color-pine: #183a38;
  --color-emerald: #6abf79;
  --color-forest: #30693a;
  --color-lime: #d8de58;
  --color-crimson: #a93551;
  --color-chart-1: #9fb4b4;

  /* semantic */
  --color-foreground: var(--color-black);
  --color-background: var(--color-cream);
  --color-surface: var(--color-white);
  --color-border: var(--color-stone);
  --color-border-strong: var(--color-black);
  --color-success: var(--color-emerald);
  --color-warning: var(--color-amber);
  --color-danger: var(--color-vermillion);

  --radius-pill: 9999px;
  --font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
}

html { background: var(--color-background); color: var(--color-foreground); }
body { font-family: var(--font-sans); font-weight: 400; font-size: 16px; line-height: 24px;
       -webkit-font-smoothing: antialiased; }
h1, h2, h3, h4 { font-weight: 400; }
.num, td.num, .metric { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
```

### 10.2 Tailwind v4 (`@theme`)

```css
@import "tailwindcss";
@theme {
  --color-ink: #202020;
  --color-cream: #f5f2ec;
  --color-sand: #e8e3d9;
  --color-stone: #b9bab5;
  --color-muted: #797979;
  --color-accent: #d14f35;
  --color-amber: #f2c247;
  --color-orange: #e98f3e;
  --color-blush: #e9c1ac;
  --color-rose: #e599bb;
  --color-lilac: #bfbbdc;
  --color-sage: #bdddd0;
  --color-sky: #8dc3e7;
  --color-teal: #347980;
  --color-emerald: #6abf79;
  --color-chart: #9fb4b4;
  --font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --radius-pill: 9999px;
}
```

### 10.3 Component class recipes (Tailwind)

```txt
btn-primary   inline-flex h-12 items-center rounded-full bg-ink px-7 text-base text-cream transition-colors hover:bg-black
btn-secondary inline-flex h-12 items-center rounded-full border border-ink bg-white px-7 text-base text-ink transition-colors hover:bg-sand
btn-sm        h-[30px] px-4 text-sm
eyebrow       text-sm uppercase tracking-[0.14em] text-muted
h1            text-[36px] leading-none tracking-[-0.02em] md:text-[50px]
h2            text-[28px] leading-[1.15] tracking-[-0.035em] md:text-[35px]
card          border border-stone bg-white p-6 md:p-8
row           border-b border-stone py-3
kpi-label     text-xs text-muted
kpi-value     font-mono text-2xl tracking-[-0.01em]
metric        font-mono text-[37px] tracking-[-0.03em]
pill-tag      rounded-full border border-stone px-2.5 py-0.5 text-xs
section       px-4 py-12 md:px-10 md:py-20
```

---

## 11. Checklist before shipping any screen
- [ ] Background is cream or white. No grays and no dark mode unless we decide to add one.
- [ ] No font-weight above 500 anywhere.
- [ ] Headlines have negative letter-spacing.
- [ ] All numbers and money are in Geist Mono with tabular figures.
- [ ] No `box-shadow`, no rounded cards. Only buttons and tags are pills.
- [ ] Sections and panels are separated by 1px hairlines, not gaps and shadows.
- [ ] Vermillion appears at most once as a big surface, and otherwise only as small accents.
- [ ] Chart colors come from the palette order in §2.3.
- [ ] Copy is in sentence case and headlines end with a period.
