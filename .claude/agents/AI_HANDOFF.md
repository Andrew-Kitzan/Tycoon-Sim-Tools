# AI Handoff

Read this first, every session, before touching anything. Update it before
you finish — write it for an agent (Claude, ChatGPT/Codex, or otherwise) who
has no memory of this conversation and only has the repo plus this file to go
on. Don't delete previous entries' hard-won context; if something here is
now wrong, correct it in place and say why.

## Last worked on

2026-08-26 — see "2026-08-26 Capgrader Generator: beam-search quality fixes"
below. Supersedes the "2026-08-27 Capgrader Generator tool + scanner formula
finalization" section for priority purposes (that section is still accurate
background/architecture, just not the most recent work).

## Last agent

Claude (Claude Code / Sonnet 5)

## What I changed

This session covered two large threads of work:

**1. Engine/UI bug fixes (committed, see `474a1c7 "QoL changes"`):**
- Fixed ore-value rounding to match the game's actual ceil-after-every-step
  behavior (was previously only rounding for display, or not at all in some
  paths). See AI_DECISIONS.md for the details and the distribution-drift bug
  it uncovered and fixed along the way.
- Restored delete-confirmation and save-overwrite-confirmation dialogs for
  saved loadouts (had been silently lost when the loadout-folder persistence
  feature was added).
- Fixed item click vs. drag-select conflict in the build grid (clicking an
  item to inspect it was broken by the box-select feature capturing the
  pointer).
- Made saved-loadouts folder access persist across reloads (IndexedDB-backed
  directory handle) instead of re-prompting for folder access constantly.
- Item-library category tabs now clear the search box but keep tier/variant
  filters and sort mode when you switch categories (previously cleared all
  three).
- The "Save Base" dialog no longer auto-fills a name from the current plan
  title.
- Fixed a git identity/push problem for the user — see AI_DECISIONS.md
  "Git identity."

**2. Item geometry worksheet (NOT yet committed — see "Uncommitted work"
below):**
- Built `data/item-geometry-worksheet.json` from scratch via a one-time
  generator script, then iterated heavily on its coordinate model with the
  user before locking it down as hand-maintained. Full spec lives in the
  worksheet's own `_readme` block and in AI_DECISIONS.md.
- Fully audited and fixed the `droppers` and `furnaces` sections (formatting
  bugs, wrong formula conditions, mislabeled fallback cases, a couple of real
  90°-facing-direction bugs — see AI_DECISIONS.md).
- Started auditing `upgraders` (86 items) — bulk pre-filled, several
  individually verified/fixed. See AI_TASKS.md "In progress" for exactly
  which ones and what's left.
- Set up this `.claude/agents/` handoff system per the user's request, based
  on a design worked out in a separate ChatGPT conversation (shared link in
  chat history if you need the original source).

## Files changed (uncommitted)

- `data/item-geometry-worksheet.json` (new)
- `scripts/build-item-geometry-worksheet.mjs` (new, now self-locking — see
  AI_DECISIONS.md)
- `.claude/agents/AI_HANDOFF.md`, `AI_DECISIONS.md`, `AI_TASKS.md` (new, this
  handoff system)
- `.claude/agents/AGENTS.md` (moved here from the repo root, updated with a
  pointer to this handoff system) — the real instructions file now.
- Root-level `AGENTS.md` is now a **1-paragraph stub** that just points here,
  so tools that auto-discover `AGENTS.md` at the repo root by convention
  (e.g. OpenAI Codex CLI) still find their way to the real content. Keep
  both in sync if the real file's purpose ever changes — the stub shouldn't
  need edits often, but if `.claude/agents/AGENTS.md` ever moves again,
  update the stub's pointer.
- `.gitignore` — was fully ignoring `.claude/`, which would have hidden this
  entire handoff system from git. Changed to `.claude/*` +
  `!.claude/agents/` so only `.claude/agents/` is tracked; local settings
  (`.claude/settings.json`, `.claude/launch.json`) stay ignored.

Everything else from this session's engine/UI fixes is already committed
(`474a1c7`). Do not assume `git log` alone tells the whole story — the
worksheet and this handoff system are real, current work that git doesn't
know about yet.

## Important decisions

See `AI_DECISIONS.md` — don't duplicate that content here, just know it
exists and read it before making a call that might contradict something
already settled.

## Current problem / state

Nothing is actively broken. The geometry worksheet is a working document
mid-audit, not a bug. The main thing to know: **the worksheet is not wired
into the engine yet** — none of this geometry/formula data affects actual
gameplay simulation until the "revamp" work in AI_TASKS.md happens.

## Next suggested task

**Immediate/active thread: scanner beam hit-chance testing** (see the
dedicated section below — this is what the user was mid-conversation on when
this handoff was last updated). Once that's far enough along, fall back to
the general upgraders audit (AI_TASKS.md → "In progress"), item by item, the
same way droppers and furnaces were done: user provides in-game
observations/screenshots, agent proposes the JSON, user pastes it in or asks
the agent to write it directly.

## Scanner beam hit-chance testing (current focus)

**Why:** the live engine currently approximates every scanner as one flat
`scannerHitChance` percentage — not a real simulation of the beam passing
over the ore. This work is building the real replacement: model the beam's
actual geometry/motion, design an in-game test to measure real hit rates,
fit a formula from that data, put it in the scanner's `formulaOverride`. See
AI_DECISIONS.md "Beam shape vocabulary" and "effects text field" entries, and
AI_TASKS.md "Scanner beam geometry + hit-chance experiment design."

**Beam shapes settled and in the schema** (see AI_DECISIONS.md for full
field definitions): `sweep` (linear, oscillates via `sin()`, `speed` in
cycles/second) and `rotate` (straight line pivoting at constant angular
velocity, `speed` in degrees/second). Both units were deliberately chosen
after back-and-forth with the user — `speed` should always be a *raw* stat
(no pre-converted ms values), and for `sweep` specifically it must be
cycles/second, not degrees, since nothing is actually rotating (this was
tried and explicitly reverted once — don't re-suggest degrees for `sweep`).

**4 real scanners, what's known about each:**
- **Azure Scanner** — confirmed `rotate` type. Source: `scanner.CFrame =
  scannerCF * CFrame.Angles(math.pi * os.clock(), 0, 0)` → `speed: 180`
  (π rad/s = 180°/s).
- **Two more scanners** (names not yet confirmed by the user — could be
  Ancient Scanner, Star Scanner, and/or Precision Ore Scanner, in some
  order) are `sweep` type, using `left:Lerp(right, alpha)` where
  `alpha = (math.sin(t * K) + 1) / 2`:
  - One with `K = 6.5` → `speed ≈ 1.0345` cycles/second.
  - One with plain `sin(t)` (`K = 1`) → `speed ≈ 0.159` cycles/second.
  - **Which named scanner is which is not yet confirmed** — ask the user
    before writing these into the worksheet under a specific item name.
- **4th scanner's movement code has not been shared yet.**

**Test methodology designed (not yet run):** one-variable-at-a-time sweeps
across ore size, beam speed, beam width, conveyor speed — separately for
`sweep` vs `rotate` since they're different motions — plus a "step 0" check
that was added after realizing neither beam moves at constant speed across
its own range: for `sweep`, ore's *lane position* across the belt likely
matters (beam lingers at the edges, moves fastest through the middle); for
`rotate`, ore's *radial distance from the pivot* likely matters (linear speed
= angular speed × radius, so near-pivot points get more effective dwell
time). Recommended to test whether position matters at all before committing
to the full 4-variable matrix. No actual test data has been collected yet —
this is 100% still in the design phase.

## Things NOT to change

- Do not re-run `scripts/build-item-geometry-worksheet.mjs` — it will refuse,
  by design, but don't try to work around that refusal either.
- Do not add a `decorations` section back to the worksheet — removed
  intentionally, decorations have no geometry to track.
- Do not "helpfully" commit `data/item-geometry-worksheet.json` or
  `scripts/build-item-geometry-worksheet.mjs` without the user explicitly
  asking — this is a large, actively-changing hand-edited file and the user
  has been deliberate about what goes into each commit.
- Do not reintroduce a center-anchored beam/zone coordinate convention —
  explicitly settled on edge-anchored. See AI_DECISIONS.md.

## 2026-08-16 follow-up

- Updated `data/item-geometry-worksheet.json` for Krakatoa: the Mythic and
  Shiny Mythic `geometryOverrides.zone.confirmed` entries retain the base
  rectangle's x, y, and width while using a length of `0.5`. JSON parsing and
  focused assertions for both overrides and the unchanged base zone passed.
- Added a shared tile-mapping note to `_readme.fields.dropSpawn`: integer
  coordinates are tile boundaries and decimal coordinates are inside their
  containing tile; this is a typical geometry interpretation and ore size can
  affect overlap. No item geometry values changed.

## 2026-08-26 Capgrader Generator: beam-search quality fixes

**This is the current active thread — read this section fully before
touching `capgrader-generator.js` again.** Builds directly on the
"Capgrader Generator tool" section below (same file, same architecture) —
read that first for context if you haven't already, then come back here.
Nothing from this session is committed; `capgrader-generator.js` is still
untracked (`git status`).

Across one long back-and-forth with the user (manually working out example
chains by hand and comparing against the tool's output), the beam search in
`optimizeCapgraderChain` went through several real quality bugs, each found
by the user noticing the tool's suggested chain was worse than something they
could build by hand. Fixing all of them took a Dropper starting at $10 from a
$185B best chain to a $1.32T best chain (all figures below are for that same
"own everything" scenario, useful as a regression check if this code is
touched again):

1. **Terminal scoring dominated by proximity-to-cap, not real value**
   (fixed first). The old `terminalScore` weighted "how close the chain
   landed to whatever capgrader happened to end it" at `ratio * 1e7` and
   `log(value) * 1e4`, vs. only `time * 10` and `length * 1` — a difference
   of literally hundreds of thousands to one. This meant the search would
   happily tack on extra unnecessary opening additives to nudge the final
   ratio a fraction of a percent closer to a cap, at a real cost of extra
   time/length for no practical benefit. Fixed by dropping both weights to
   `100` so they're light tie-breakers instead of dominant terms.
2. **Wide-range, single-use "finisher" items getting burned as mid-chain
   bridges instead of saved for the end** (the big one). Toybox Express
   (range 0 – 1 octillion) and Rubix's Polisher (range 0 – 1 septillion) are
   both `limitedUses: 1` but legal at almost any value, so the search would
   opportunistically grab one to bridge between two narrower-range
   capgraders — "spending" a huge once-only multiplier on a small base value
   instead of the largest value the chain ever reaches. Worse: the terminal
   score (even after fix #1) still favored ending on a narrow-range item
   like Blocky Refiner (cap ~100B) over ending on Toybox, because a chain
   could never look "in-band" against Toybox's astronomically large ceiling
   — so the search would rank a mathematically-worse chain higher. Fixed by
   introducing `isFinisherRecord()` (range floor 0 AND ceiling ≥
   `FINISHER_CEILING_THRESHOLD = 1e15`) to split `legalPool()`'s capgraders
   into `pool.capgraders` (normal) and a new `pool.finishers` field. The main
   beam search only ever sees `pool.capgraders`, so it's forced to find a
   *normal*, reusable item to do any mid-chain bridging (e.g. 8-Ball
   Refiner, Anchor Upgrader). After the main search picks its best terminal,
   every owned/eligible finisher is cascaded on top in ascending `mainStat`
   order (order between finishers never matters — they're all floor-0, so
   none can block another). This alone went from $448B to $780B-ish, and
   made the search dramatically faster (no longer wasting depth budget
   deciding whether to spend a finisher early).
3. **Depth-aligned beam-search pruning unfairly kills "many small steps"
   chains in favor of "few big steps" chains at the same step count** (the
   subtle one — found by the user's own hand-built chain beating the tool's
   output even after fix #2). Simply raising the old depth/width caps (12/
   400) did NOT help — tested up to depth 22 / width 20,000 (~7s) with zero
   change in output, proving it wasn't a search-breadth problem. The real
   issue: comparing a state that took 5 small-multiplier steps (e.g. Orbital
   Messenger ×3 → Anchor → Martian Tech) against a state that took 2
   big-multiplier steps (2× Anchor Upgrader), AT THE SAME NOMINAL DEPTH
   NUMBER, always penalizes the "many small steps" branch — it simply hasn't
   caught up in value yet at that comparison point, so it gets pruned before
   it has a chance to pay off later. Fixed by batching same-item reuse into
   ONE depth-step in `candidateMoves`: whenever an eligible item is still
   legal after applying it, the search also offers applying it again (2x,
   3x, ... up to `BATCH_REPEAT_CAP = 20`) as additional candidate moves at
   that same step, instead of spending a separate depth-step per repeat.
   This freed up enough real depth budget that depth/width could actually be
   turned back DOWN (18/8000 → 10/2000) while still beating the old, much
   more expensive search — $1.32T in ~0.4s vs. the old $1.32T-adjacent
   result taking 2+s.
4. **Known remaining gap (~1-1.5%), not fixed, don't be surprised by it.**
   Exhaustive offline testing (way beyond what's practical to ship, e.g.
   depth 25 / width 10,000+) found a true ceiling around $1.348T for the
   same test scenario — the shipped search lands around $1.32-1.33T. This is
   an inherent limitation of depth-aligned beam search with a greedy
   per-step score, not a bug: fully closing it would need a genuine
   architecture change (real best-first/A* search with a lookahead
   heuristic, not just parameter tuning or move-batching). Flagged as a
   possible future task, not started — the user was satisfied with the
   current state ("that is perfect") and this doc should not imply it's
   broken.

**How this was debugged (useful if the search regresses again):** the
in-browser tool result was cross-checked against a standalone reimplementation
in a scratch script for early hypothesis-testing, but the DEFINITIVE checks
(especially for #3, where the reimplementation and the real file initially
disagreed) were done by injecting a debug hook directly into a scratch COPY of
the real file — `globalThis.__cgDebug = { legalPool, optimizeCapgraderChain,
getToggle, capgraderNames, additiveNames, scannerNames, lunarName }` inserted
right after `optimizeCapgraderChain`'s closing brace, then driving it from
Node with a minimal `document`/`localStorage`/`CSS` stub and
`data/items.generated.js` loaded via `new Function('globalThis', src)`. This
is the reliable way to test this file's search logic in isolation without a
browser — a hand-written reimplementation of the algorithm is NOT a safe
substitute for testing against the real file, since it's easy to
accidentally fix a subtly different algorithm than the one actually shipped.

## 2026-08-27 Capgrader Generator tool + scanner formula finalization

Read this section for the tool's original architecture/gotchas (hamburger
nav, `CAPGRADER_NAMES` hardcoding, fire-effect safety logic, persistence key,
etc.) — still accurate. The section above is the most recent work on top of
this same file.

### 1. Scanner hit-chance formulas — finalized, see AI_DECISIONS.md

The scanner beam geometry/hit-chance work referenced in the "Scanner beam
hit-chance testing" section further down this file is **done and superseded**
by a full write-up in `AI_DECISIONS.md` under **"Scanner hit-chance
formulas"** — read that section, not the older notes below it in this file
(kept for history, but stale). Short version: a real kinematic simulator
(`scripts/scanner-hit-simulator.mjs` + `scripts/scanner-hit-report.mjs`)
replaced in-game testing entirely; closed-form formulas were derived and
validated (arcsine formula for sweep scanners — Ancient/Precision Ore
Scanner; guaranteed-above-1.25-else-linear-expected-value for Azure, whose
beam turned out to rotate in a *vertical* plane, not the ground plane, after
several rounds of correction against real screenshots). These formulas are
now the ones powering the Capgrader Generator's scanner math (see below) —
**do not use the engine's old flat `oreSize/4` fallback for scanners in any
new work**, use these derived formulas instead.

### 2. New tool: Capgrader Generator

Added a second full tool to the site (previously just the grid-based Base
Builder), reachable via a new hamburger menu (top-left, fixed position) —
plan approved and built in one continuous session, see
`.claude/plans/cheerful-splashing-dewdrop.md` for the original approved plan
(useful for the *why*, but the actual implementation has since evolved past
it in several UI-polish rounds — trust the live code over that plan file for
current layout details).

**Files:**
- `capgrader-generator.js` (new) — all of the tool's logic. Self-contained
  IIFE, plain script (no ES modules), reads `globalThis.TycoonDatabase`
  directly, same pattern as `app.js`/`planner-core.js`.
- `index.html` — hamburger button + nav `<dialog>` (`#tool-nav-menu`), new
  `#capgrader-tool` section, `<script src="capgrader-generator.js">`.
- `app.js` — `activeTool` state (`'builder' | 'capgrader'`), persisted the
  same way `plannerMode` is (`localStorage`), toggles which top-level section
  is visible and swaps the header title/hides Build-Builder-only controls
  (Load/Save Base, Build/Generation mode, Clear grid, tile count) when in
  Capgrader mode.
- `styles.css` — hamburger icon, nav dialog, toggle pills, 3-column layout
  (main + 2 sidebars), result tables.
- `tests/validate-planner.js` — one assertion count bumped (`&times;` count)
  for the new close button.

**What it does:** pick one or more droppers (each with its own owned
variant), toggle which capgraders / additive upgraders+Lunar Landing /
capgrader-scanners you own (with optional owned-count and owned-variant
refinement per item), hit Generate, and it runs a beam-search (ported/trimmed
from `engine/optimizer.mjs`'s `optimizeCapgraders` — a real algorithm that
already existed for the CLI's `solve-cap` command but was never wired into
the browser) to find the best chain toward the final capgrader's range
ceiling, shown as a per-dropper table: item, variant, value before/after,
cumulative time, cumulative length.

**Key architectural decisions/gotchas — read before touching this code:**
- **The runtime database (`data/items.generated.js`) does NOT have the
  `sourceSheets` membership array** that `data/items.index.json` has (it only
  has one `sheet` field per record). Capgrader-sheet detection can't be done
  from loaded data at runtime — `capgrader-generator.js` hardcodes the exact
  list of 23 real capgraders (`CAPGRADER_NAMES`) instead. If new capgraders
  get added to the database later, this list needs a manual update.
- **Items appear multiple times in the database** if listed on multiple
  sheets (e.g. a capgrader also cited on `Crates` for its source) — produces
  near-duplicate records differing only in `sheet`/`row`. `variantsFor()`
  dedupes by variant, picking the first match. If dropdowns or variant
  checkboxes ever show duplicates again, this is almost certainly why.
- **Nuclear Upgrader and Chartreuse Collider are excluded entirely** from the
  capgrader list — they apply destructive effects (Nuclear effect,
  Overcharged) that would kill the ore before the chain finishes, and this
  tool doesn't model removing them.
- **Fire-effect safety logic**: a `hasFire` flag on the search state starts
  `true` if the chosen dropper is `Fire Crystal Dropper`, becomes `true` after
  `Ore Flamethrower`, and `false` after `Oasis Cleanser`. `Oil Well` only
  destroys ore when `hasFire` is true *and* the ore's value is inside Oil
  Well's own range (5K–65K) — outside that range it's a no-op regardless of
  fire. The search only offers Oil Well while on fire if it can insert Oasis
  Cleanser immediately before it; `Ore Flamethrower` itself is only offered
  as a candidate when Oasis Cleanser is owned, so the search can't paint
  itself into a dead end.
- **Additive Upgraders & Lunar Landing are opening-only** (per real game
  rules — normal upgraders can't bridge capgrader ranges) — modeled as a
  greedy loop before the capgrader beam search starts, matching
  `optimizeCapgraders`'s existing opening-phase logic almost exactly.
- **Multi-dropper support**: pick 2+ droppers, get a spread-ratio warning
  (informational past ~3x, stronger past ~10x) since a wider value gap needs
  more capgraders/space to cover in one shared chain. Each dropper's chain is
  computed independently against the same owned-item pool (same physical
  base, same ownership).
- **Persistence**: dropper rows + all toggle state (owned/count/variants)
  save to `localStorage` (`tycoon-sim-2:capgrader-tool:v1`) on every change
  and restore on load — settings survive both tool-switching and full page
  reloads.
- **Layout is 3 columns side by side** (not stacked): main column
  (Droppers → Capgraders → Results), then Additive Upgraders & Lunar Landing,
  then Capgrader Scanners, each sidebar column sticky-positioned. This went
  through several rounds of user feedback (was originally one flat list, then
  2-column, now 3-column) — if asked to change grouping again, confirm
  exactly which panel goes where before assuming.
- **A real CSS trap was hit twice**: `[hidden]` on an element does nothing if
  a class selector elsewhere sets `display` on that same element (equal
  specificity, author stylesheet wins over the UA default). Both
  `.workspace` and `.capgrader-tool` needed explicit `.foo[hidden] {
  display: none; }` overrides. **Watch for this pattern on any future
  hide/show toggle** — if `.hidden = true` doesn't visually hide something,
  check for a competing `display` rule first.
- **The preview/browser-testing tool in this environment aggressively caches
  `app.js`/`capgrader-generator.js` across reloads** — a `force: true`
  navigate is sometimes NOT enough to see a real code change reflected. If a
  browser-based test looks like it's ignoring your latest edit, open a brand
  new tab (`tabs_create`) rather than trusting a reload, or cache-bust the
  script `src` with a throwaway `?v=` query param temporarily.

**Not yet done / possible next steps:** no automated test coverage for
`capgrader-generator.js` itself (only manual browser verification so far,
several rounds of it, all passing). Given how much this tool changed over
the session, a next session should re-verify the full flow once
(dropper → toggles → generate → results) before trusting it blindly.

### 3. Unrelated pre-existing issue, do not fix as a surprise tangent

`npm run check`'s `engine.test.mjs` fails with `Base Portable Upgrader is
1x2; expected 2x1` — traced to the `data/items.generated.js` database resync
run earlier this session (`npm run database:sync`, done to freshen the
ore-size sheet), unrelated to the Capgrader Generator work. `AI_DECISIONS.md`
already documents Portable Upgrader's facing-direction size swap as a known
issue in the hand-maintained geometry worksheet; this generated-database
copy apparently disagrees with a hardcoded test fixture now. Flagging, not
fixing — needs its own investigation.

## 2026-08-16 database workbook replacement

- Replaced `data/Tycoon Sim Database.xlsx` in place with the user-supplied
  `C:\Users\andre\Downloads\Tycoon Sim Database (9).xlsx`. This was the only
  `.xlsx` in the repository and is the documented authoritative database path.
- Verification: source and target SHA-256 both equal
  `A4A454AB8102A09BC1563D6F701A20A840403E1826E5F4B916CE627DBE6379D9`; the
  copied workbook opens as an XLSX ZIP with all required core entries and a
  parseable `xl/workbook.xml` containing 16 worksheets. `npm.cmd run
  verify:commit` passed (database lint: 354 records, zero errors/warnings;
  code checks, planner tests, engine tests, regression fixtures, and clean
  state check all passed).
- No generated files were changed and no commit or push was made. Existing
  unrelated uncommitted geometry-worksheet and handoff-system work remains.
