# AI Handoff

Read this first, every session, before touching anything. Update it before
you finish — write it for an agent (Claude, ChatGPT/Codex, or otherwise) who
has no memory of this conversation and only has the repo plus this file to go
on. Don't delete previous entries' hard-won context; if something here is
now wrong, correct it in place and say why.

## Last worked on

2026-08-27 — see "2026-08-27 Luck / Crate Simulator tool" below (a third tool
added alongside Base Builder and Capgrader Generator). Supersedes the
"2026-08-26 Capgrader Generator: beam-search quality fixes" section for
priority purposes (that section is still accurate, just not the most recent
work).

## 2026-08-27 Luck / Crate Simulator tool

Third tool added to the hamburger nav (`data-tool="luck"`), same
self-contained-IIFE pattern as the other two. Simulates the real crate-opening
luck system: player types in Unbox/Shiny/Mythic Luck + Roll Speed + Unbox
Slots, picks a crate, and sees exactly which item/variant they can pull and
the real combined odds, plus an expected "how long to get it" estimate.

**This was built from a real, previously-undocumented game system** — the
user supplied the actual production Lua (`UnboxUtils.GetLuckWeights` /
`RollFromCrate`) mid-conversation, and separately every formula was
cross-checked directly against the real cell formulas in `data/Tycoon Sim
Database.xlsx`'s "Crates" sheet (extracted from the raw worksheet XML via
`engine/xlsx-reader.mjs`'s `XlsxArchive`, not guessed from computed values) —
this is not reverse-engineered speculation, it was verified byte-for-byte
against the sheet's own "Odds" column for every item in the Basic Crate
before any UI was built. **If this math is ever touched again, re-verify
against the sheet the same way rather than trusting comments alone** — see
the git history around this date for the exact verification commands.

**Files:**
- `scripts/build-crate-luck-data.mjs` (new) — parses the Crates sheet's
  repeated blocks (crate-name row → `Cost:` row → header row → item variant
  rows grouped by Name → totals row → next crate) directly, emits
  `data/crate-luck-data.generated.js` (`globalThis.CrateLuckData`, same
  loading pattern as `data/items.generated.js`). **This is a generated file,
  never hand-edit it** — everything in it is mechanically derivable from the
  spreadsheet (unlike `data/item-geometry-worksheet.json`, which needed real
  manual judgment calls). Re-run the script if the workbook's Crates sheet
  changes. Watch for the same off-by-one parsing trap that bit this session
  twice: candidate "crate name" rows that are actually legend cells (`"Shiny
  Luck"`/`"Mythic Luck"`/`"Unbox Luck"` labels, or the bare numbers `20`/
  `100`/`1` beneath them) — both are explicitly excluded now, but if the
  sheet's legend layout ever changes, this parser needs re-checking against
  the raw rows, not just trusted.
- `luck-crate-generator.js` (new) — all the tool's logic: `getLuckWeights()`
  is a direct line-by-line port of the user's Lua (sort ascending by weight,
  power-formula raw chance, then the 30%-floor lock-and-rescale `while` loop
  — confirmed this loop runs on *every* calculation, not just rare edge
  cases). `variantChance()` implements the Shiny/Mythic combination math
  (verified algebraically that all 4 variants' probabilities sum back to the
  item's total chance). `timeToConfidence()` implements the "how long"
  popup math: `cycleTime = RollSpeed + 1.1` (the `1.1` is a **hardcoded**
  game constant — the forced wait after the roll animation — not
  player-adjustable), `attemptsPerSecond = UnboxSlots / cycleTime`,
  `attemptsNeeded = ln(1-confidence) / ln(1-p)`; verified this exact formula
  shape against the "Stats for Nerds" sheet's "How Long?" section (75%'s time
  is exactly 2× the 50% time, matching `ln(4)/ln(2)=2` precisely) and its
  exact constant (reproduced its reference row's 50/75/90% day-outputs to 5
  significant figures using this formula, including the `+1.1`).
- `index.html` — new `#luck-tool` section (crate-select view + crate-detail
  view, toggled by JS, not a dialog), new `#luck-item-dialog` for the
  per-item popup, new nav button, new `<script>` tags for the generated data
  file and `luck-crate-generator.js`.
- `app.js` — `activeTool` extended from a 2-way (`'builder'|'capgrader'`) to
  a 3-way (`+'luck'`) toggle; same `applyActiveToolUi()`/`loadActiveTool()`/
  `setActiveTool()` functions, just widened. The WIP badge is now `hidden`
  whenever `activeTool !== 'builder'` (was `=== 'capgrader'`) so it doesn't
  leak into the new tool either.
- `icons/items/` (new, ~402 PNGs) — copied from the user's local
  `Documents\Tycoon Sim\Icons` folder, matched by the existing `{Name}
  {Variant}.png` filename convention (Base has no suffix). **Explicitly NOT**
  using the user's real crate icons (`Documents\Tycoon Sim\Crates`) — the
  user said those aren't visually consistent — crate buttons use a small
  inline-SVG custom crate icon generated per-crate instead
  (`crateIconSvg()` in `luck-crate-generator.js`).
- `styles.css` — new `.luck-*` section. The item grid sits inside a
  `.luck-crate-frame` — a plain CSS-only decorative crate background (no
  imagery), per the user's request for a generic frame rather than a themed
  illustration.

**Icon gap — resolved, not actually missing assets.** The initial pass found
14, then (after a `data/Tycoon Sim Database.xlsx` resync — see below) 5,
name+variant PNG lookups with no match in `icons/items/`. Every single one
turned out to be a **naming mismatch between the DB and the icon file**, not a
genuinely missing icon — fixed by renaming the icon files to match the DB
names exactly (not by editing the database): `Advanced ore Upgrader Shiny`→
`Advanced Ore Upgrader Shiny` (case), `Effecient Furnace`→`Efficient Furnace`,
`Quad Rays`→`Quad Rays Upgrader`, `Robotic Apocalypse`→`Robot Apocalypse`,
`Percision Ore Scanner`→`Precision Ore Scanner`, `Enforced Upgrader Mythic
Shiny`→`Enforced Upgrader Shiny Mythic` (variant word order). One went the
*other* direction: the DB's own name is `Rubik's Polisher` (not `Rubix's` —
this session initially misspelled it and had to revert), so the icon file's
original name was already correct. **0 of 101×~2.5 variant icon lookups
missing now** (verified by diffing every crate item+variant name against
`icons/items/`'s actual file list, not just spot-checking) — don't
re-introduce the `onerror`-hide-on-missing fallback logic in
`luck-crate-generator.js` as a sign something's still broken; it's
now-unused defensive code kept for whenever new items/icons are added later
and inevitably drift again.

**2026-08-27 database resync (same session, right after the above):** the
user supplied a corrected `Tycoon Sim Database (10).xlsx` mid-session
specifically because "i had some names wrong" (the Rubik's/Precision/etc.
typos above turned out to be from the *previous* workbook version — the new
one doesn't have them, though the *icon files* still needed the renames
above regardless of workbook version, since the file names themselves were
never sourced from the workbook). Copied over `data/Tycoon Sim Database.xlsx`
(sha256 verified to match the source exactly), then re-ran `npm run
database:sync`, `npm run database:index`, and `node
scripts/build-crate-luck-data.mjs` — 727 rows, 0 cross-sheet conflicts, 354
unique item variants, same 17 crates / 101 crate items as before. Re-verified
the luck math still reproduces the sheet's own Odds column exactly after the
resync (same Basic Crate check as the original verification pass).

**2026-08-27 "Any Crate" items — placeholder text, and a real merge-pool
bug fixed, one false alarm chased down.** All three found via the user
actually using the tool and reporting a screenshot, not from more static
formula reading:
1. `build-crate-luck-data.mjs` was pulling `effects` straight from the
   Crates sheet's own "Other Effects" column, which for many items (complex
   furnace formulas etc.) is literally the placeholder text `"Refer to the
   'Stats for Nerds' Page"` rather than real content. Fixed by cross-referencing
   `data/items.generated.js` (already has the real resolved formula text via
   `sync-database.mjs`'s `parseStatsForNerds`) whenever the Crates-sheet text
   is that exact placeholder — see the `resolvedByKey` lookup added to the
   script. Verified 0 of 254 item variants still carry the placeholder.
   `luck-crate-generator.js`'s item popup also no longer renders a bare "N/A"
   line for `otherStats` when that's literally all the sheet has.
2. **Real bug, fixed — went through 3 iterations, this is the correct one.**
   Any-crate items' odds should be pinned to a **fixed target raw chance**
   (e.g. Freedom Dropper = 1/150,000,000), calibrated once against Basic
   Crate — that number must reproduce exactly at 1x Unbox Luck no matter
   which crate you're viewing, but at any *other* luck value it legitimately
   varies crate to crate, since luck reshuffles odds based on an item's rank
   within whichever crate's own rarity ladder it's merged into. Confirmed
   directly by the user after two wrong intermediate attempts:
   - **Attempt 1 (wrong):** merged the any-crate item's raw stored weight
     unchanged into whichever crate was open, renormalized against that
     crate's own total. Made the "fixed at 1x luck" property crate-dependent
     too, which the user flagged with a screenshot (Tropic showing ~1/1B vs
     Basic's expected ~1/150M at the same settings).
   - **Attempt 2 (wrong):** overcorrected to *always* compute against Basic
     Crate's weights regardless of which crate was open — fully fixed at
     every luck value, not just 1x. Also wrong: at that point the user
     clarified with a screenshot that at high luck (~202, not the "152" first
     quoted — that was a value mixup, verified by solving for the luck that
     reproduces the user's exact numbers) the *real* odds do differ by crate.
   - **Correct version (current code):** `targetRawChance(name)` recovers the
     item's fixed target chance by reversing the original Basic-Crate
     calibration (`weight / (basicCrateTotal + weight)`). `computeChances()`
     then re-derives a fresh equivalent weight for whichever crate is
     currently open (`target * thatCrate'sNativeTotal / (1 - other active
     any-crate items' target chances)`) before feeding it into that crate's
     own `getLuckWeights` pool — mirroring the sheet's own `J15 = K15 *
     SUM(otherWeights) / (1 - ...)` pattern, just re-evaluated per crate
     instead of hardcoded to Basic. Verified: exactly 1/150M (Freedom) and
     1/183M (Twitchium) in *every* crate at 1x Unbox Luck; genuinely
     different (e.g. 1/1.05M in Basic vs 1/1.11M in Tropic) at luck 202,
     matching the user's real spreadsheet numbers at that luck value. If this
     needs touching again: the invariant to preserve is "identical across all
     crates at exactly 1x Unbox Luck, allowed to diverge at any other luck."

**Still open, not bugs:**
- No exact rarity color palette exists in the spreadsheet (checked: no
  per-cell fills or conditional-formatting rules on the Rarity column) — a
  reasonable default game palette was used (`RARITY_COLORS` in
  `luck-crate-generator.js`). Swap this out if the user has an exact palette.
- No automated tests written for `luck-crate-generator.js` beyond manual
  browser verification (same gap as `capgrader-generator.js` originally had).

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
