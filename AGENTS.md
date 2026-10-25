# AGENTS.md

Conventions for this repo — a static educational site (vanilla HTML/CSS/JS,
locally-vendored KaTeX) with three sections: Real Analysis, Optimization,
Statistics.

## Site structure

- `/real-analysis/`, `/optimization/`, `/statistics/` are separate standalone
  pages, each sharing root-level `style.css`, `script.js`, `vendor/katex/`
  via `../`-relative paths. `/index.html` just redirects to `/real-analysis/`.
- The hamburger subject-switcher (`<details class="menu-nav">`) is
  duplicated in each page's markup — no templating, so update all three
  files together if it changes. Each page hardcodes its own `.menu-item`
  as `active`.
- Every `.topic` needs a unique `id`. `script.js` uses `.topic[id]` to
  auto-add a heading permalink icon and a floating "on this page" TOC entry
  (hidden below 1280px viewport width) — don't hand-add anchors, a new
  topic gets both for free just by having an `id`.

## Diagrams

- Every `<svg>` needs `style="width:100%;max-width:Npx"`, where `Npx`
  matches its own `viewBox` width exactly. This keeps text at its declared
  `font-size` (1:1) whenever the page is wide enough, and shrinks fluidly
  below that — never a fixed `width:Npx` (doesn't shrink, causes page
  overflow on narrow screens) and never a shared CSS class for `max-width`
  (breaks the moment two diagrams have different `viewBox` widths).
- CSS Grid items (e.g. `.set-card`) need `min-width: 0`, or a fluid SVG
  child still won't be able to shrink the card around it.
- One `font-size` for all diagram text, site-wide: `12`. Use `font-weight`
  and `fill` for visual hierarchy, not size.
- Verify with Playwright: no horizontal page overflow at 375px
  (`document.documentElement.scrollWidth > window.innerWidth`), and every
  `<svg>`'s `rect.width / viewBox.width === 1` at 900px+ viewport width.

## Equations

- `$$...$$` display blocks only — no inline `$...$` delimiter is
  registered, so it silently renders as literal LaTeX text, not math. For
  a symbol inside a paragraph, use plain Unicode instead (`θ̂`, `μ₀`, `I₁(θ)`).
- Equations auto-shrink to fit their container and never scroll
  (`script.js`'s `fitMathBlocks()`, plus `.topic .math { overflow: hidden }`
  on *both* axes — `overflow-x` alone leaves `overflow-y` computing to
  `auto`, a guaranteed scrollbar since KaTeX's own layout struts always
  render a few px taller than the box). This is automatic; new `p.math`
  blocks need no manual handling.
- Copying a rendered formula copies its LaTeX source, not garbled text
  (`vendor/katex/copy-tex.min.js`, included on all three pages). Also
  automatic, no action needed.
- Verify with Playwright after touching equation-heavy content: no
  `.topic .math` has `scrollWidth > clientWidth`, and `getComputedStyle`
  reports `overflow-y: hidden` (not `auto`).

## Diagram color key

Colors are assigned by grammatical role, consistently across every topic:

- `#4078F2` blue — function names / metrics
- `#7B4B8C` purple — quantifiers / operators
- `#C18401` gold — named sets, drawn as the region/line that *is* the set —
  don't use for sets that aren't fillable intervals/regions (e.g. ℚ)
- `#1a1a1a` black — generic points, even when they're a member of a named
  set, *unless* there's no other gold element in the diagram to identify
  that set
- `#999` / `#ccc` muted gray — ambient space / secondary reference lines

## Workflow

- Verify every content or diagram change with Playwright before
  committing: paragraph/math overflow (`scrollWidth > clientWidth`), SVG
  text clipping (`getBBox()` vs `viewBox`), console/page errors.
- Commit after each logical change with a descriptive message explaining
  the "why," not just the "what."
