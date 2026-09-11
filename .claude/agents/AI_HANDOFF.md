# AI Handoff

Read this first, every session, before touching anything. Update it before
you finish — write it for an agent (Claude, ChatGPT/Codex, or otherwise) who
has no memory of this conversation and only has the repo plus this file to go
on. Don't delete previous entries' hard-won context; if something here is
now wrong, correct it in place and say why.

## Last worked on

2026-09-11 — see "2026-09-11 MPA / Chopping Block tool (fifth tool, WIP)"
below — the newest and most involved entry, plus its several same-day
follow-up fixes/refinements from the user actually using it live (icon
caption, category-level select-all, "Own"→"In Base" wording, and — the
biggest one — a capgrader chain-order lock, all folded into that same entry
below since they're all part of the same tool's ongoing WIP polish). The
database-resync and Rubik's-Polisher-typo entries right below it are from
earlier the same day.

## 2026-09-11 MPA / Chopping Block tool (fifth tool, WIP)

Added a fifth tool to the hamburger nav (`data-tool="mpa"`), explicitly
marked **WIP** (a `.wip-badge` next to its name in the nav list, and the
shared `#wip-badge` element in the header — repurposed/generalized, see
below — shown whenever this tool is active) since the user asked for it to
read as still-in-progress. Full design doc (read this first if touching the
tool again): `.claude/plans/mpa-chopping-block-plan.md` — **not committed**,
`.claude/*` is gitignored except `.claude/agents/` (same as the existing
`.claude/plans/cheerful-splashing-dewdrop.md` reference from the Capgrader
Generator entry below), so that plan only exists in this local working tree
unless the user asks for it to be preserved elsewhere.

**What it does — two screens:**
1. **MPU/MPA/MPS browsing list** (the tool's landing view): every tracked
   upgrader's icon, name, and whichever of the three efficiency stats is
   toggled (MPU = multi^(1/length), MPA = multi^(1/area), MPS =
   multi^(1/time)), sorted ascending (worst at top, best at bottom) —
   confirmed by the user, not assumed.
2. **Chopping Block** (button top-right of the list): pick every upgrader
   you own, organized into Crate / Merchant-Achievement-Rebirth / P2W-by-pack
   / **Other** categories (see below for why a 4th "Other" category exists
   beyond the user's original 3), each subcategory with Select All/Deselect
   All, then a "Figure out what's getting chopped" button runs a worst-MPA-
   first keep/chop loop respecting combo/dependency locks.

**Data: `data/mpu-stats.js` (new, one-time hand-maintained seed, NOT
auto-regenerated)** — per the user's explicit decision, this does not run
through `database:sync`; it was built once from the spreadsheet's MPU sheet
(84 tabulated rows) plus Lunar Landing (computed from its real stats via the
standard formula — not in the MPU sheet, added because the user said it was
"pretty simple" to include) and structured Lambda/Incremental/Tiki/Dream
Machine/Dragon's Breath entries. 83 total items (82 choppable + 1 list-only
combo). Edit this file directly (or ask) to add/update items going forward —
see its own header comment for the full schema (`kind`:
straight/scalesWithUses/scalesWithEffects/scalesWithConfiguration/
comboInfoOnly).

**Key design decisions, confirmed with the user across a long back-and-forth
— read before changing any of this:**
- **Scope is Multiplicative/Mixed upgraders only.** Additive-type upgraders
  (17 of them — Whimsical Palace, Basic Upgrader, Oasis Cleanser, etc.) have
  no stacking multiplier, so MPU/MPA/MPS don't apply; they're excluded from
  both screens entirely, including Chopping Block's ownership toggle.
- **"Highest form only"**: one entry per item, whichever variant the MPU
  sheet itself already used (Shiny for Common-Epic and P2W items, Shiny
  Mythic for non-P2W Legendary/Secret) — mirrored as-is from the sheet's own
  Variant column, not re-derived.
- **Lambda Upgrader's MPA gets *worse* with more uses** (1.070 at 1 use →
  1.041 at 3), the opposite of Incremental (1.024→1.050, best at 3) and Tiki
  (1.031→1.046, best at 2). The browsing list shows Lambda's actual best (1
  use), with the 3-Lambda numbers folded into that row's note — do not
  "fix" this to show 3 uses as if it matched the other two; it's a real,
  confirmed-correct asymmetry, not a bug.
- **Lambda's uses are capped at 3 in this tool** even though the database
  says "Unlimited" — per the user, real play never goes past 3. If a player
  types 4+ in Chopping Block's input, the UI clamps it to 3 and shows an
  alert explaining why (`window.alert` in the `change` handler for
  `data-mpa-input="uses"` — the only item this clamp applies to, via
  `maxUsesAllowed`).
- **Dream Machine's formula is real, not guessed**: found in the "Stats for
  Nerds" sheet, `multiplier = 1 + effects × perEffectBonus` (perEffectBonus
  0.75 for the tracked Shiny Mythic variant), verified against all three
  tabulated sample rows (4/5/6 effects) before being written into the data
  file. 6 effects exist in-game but only 5 are simultaneously obtainable —
  that's the practical max shown on the browsing list, but Chopping Block
  still takes a live count since a player may have fewer active.
- **Dragon's Breath's best MPA configuration is "Looped" (1.193), not "2
  Uses" (1.159)** — looping one Dragon's Breath twice via routing has a
  smaller footprint (area 15 vs. 18) than owning two separately, for the
  same multiplier. Chopping Block checks this before ever offering removal:
  if the player's current configuration isn't the best one, it suggests
  switching configuration first (a real, distinct decision-card state,
  `switch-config`/`evaluate-anyway` actions) rather than jumping straight to
  keep/chop.
- **Portable Spinner — found in the spreadsheet while building this, never
  discussed with the user before being added.** Same `scalesWithConfiguration`
  shape as Dragon's Breath (1 Use vs. Looped), and here looping costs *zero*
  extra footprint (both configs are 2x2) while roughly doubling the
  multiplier (1.76 → 3.0976, almost exactly squared) — Looped is clearly
  correct as the best config, but this item was never explicitly confirmed
  with the user the way Dragon's Breath was. **Flag this to the user and
  confirm it's handled the way they'd expect** — noted in the item's own
  `notes` field in the data file too, so it isn't lost.
- **The Ore Replicator + Dual Plasma combo row is browsing-list-only** — one
  fixed MPU-sheet row (`kind: 'comboInfoOnly'`, `excludeFromChopping: true`),
  never appears in Chopping Block at all, per the user's explicit
  instruction after initially discussing giving it its own toggle logic.
  Ore Replicator and Dual Plasma Upgrader still each appear individually and
  normally in Chopping Block.
- **Combo/dependency locks** (`data.dependencies` in the data file): Ore
  Wash↔Acid Plant and Leviathans' Wrath↔Atlantis Remnant are simple
  single-prerequisite locks. Hoarded Treasure/Electric Overdrive→Alien
  Invasion is an OR-lock — **implemented as true OR semantics**: either one
  is choppable while the other still satisfies Alien Invasion's
  requirement, and only the *last remaining* one locks. (The plan doc's
  draft wording said "releases only once both are gone," which is stricter
  than this — that was this agent's own inference while writing the plan,
  never separately confirmed by the user, and true-OR is what real game
  logic calls for. Flagging this interpretation choice explicitly in case
  the user actually wanted the stricter version.) More dependencies are
  expected from the user later — this table is meant to be trivially
  appendable, not hardcoded per-item branches.
- **Capgrader chain-order lock (added 2026-09-11, same day, after the user
  hit this live)**: reported via a real screenshot — with both 8-Ball
  Refiner (range 10B-50B) and Blocky Refiner (30B-100B) in the base,
  Chopping Block was suggesting 8-Ball first, but 8-Ball is only useful as a
  bridge toward Blocky's range, so chopping it first would strand Blocky.
  Fixed by adding a second lock rule in `isLocked()` alongside the combo/
  dependency table: any of the 23 real capgraders (same hardcoded
  `CAPGRADER_NAMES` list as `capgrader-generator.js` — **keep both lists in
  sync if capgraders are ever added**) is locked while a *higher-range*
  capgrader is also in the base, ranges parsed from `TycoonDatabase`'s own
  `range` field (`"10B-50B"` → `{lo, hi}` via a small suffix parser mirroring
  the Calculator's unit table). **Excludes finisher capgraders** (Toybox
  Express, Rubik's Polisher — range floor 0, ceiling ≥ 1e15) in both
  directions, matching `capgrader-generator.js`'s own `isFinisherRecord()`
  distinction: they cascade on top at the end regardless of chain order, so
  they neither lock normal capgraders nor get chain-locked themselves.
  Verified with a smoke test extending the existing ad hoc suite (8-Ball
  locked while Blocky owned, unlocks once Blocky is gone, finishers exempt)
  and live in a real browser reproducing the exact screenshot scenario.
  Scanners (`SCANNER_NAMES` in capgrader-generator.js) are **not** included
  in this ordering — the user's report was specifically about capgraders,
  and scanners aren't part of the same sequential range chain the same way.
- **RESOLVED (2026-09-11, same day, right after the user reviewed the first
  build): the "Other" category and the Fidget Pack naming question are both
  fixed, not open anymore.** Checked both items' real obtainment text
  directly in the Upgraders sheet rather than guessing:
  - **Cupcake-inator**'s real source text is `"From code \"release\""` — a
    code-redemption item. Moved from `other`/`Other` to
    `merchant-achievement-rebirth`/**`Codes`** (a new 4th subcategory there,
    `MAR_ORDER` in `mpa-chopping-block.js` now `['Merchant', 'Achievement',
    'Rebirth', 'Codes']`).
  - **Portable Spinner**'s real source text is `"Buy Fidget Pack"`, and
    **Ore Rocker**'s is `"Buy the Horsey or Fidget Pack"` — confirming they
    share the same real pack. Moved Portable Spinner from `other`/`Other` to
    `p2w`/**`Fidget Pack`** (joining Ore Rocker), and added it to
    `data.packs['Fidget Pack']` in `data/mpu-stats.js` for consistency (the
    per-item `category`/`subcategory` fields are what actually drives
    rendering, but keeping `packs` accurate too). "Fidget Spinner" (the
    user's original name) never existed in the database — Portable Spinner
    was the real item meant.
  - With both moved out, the `other`/`Other` category is now empty and no
    longer renders at all (the existing `bucket.size === 0` skip in
    `renderCategories` handles this automatically — no code change needed
    beyond moving the two items' data). Chopping Block is back to exactly
    the user's original 3 categories, now with Codes as a 4th subcategory
    under Merchant/Achievement/Rebirth.
  - Verified via the same Playwright smoke-test approach as the initial
    build: category list is now exactly `['Crate Upgraders', 'Merchant /
    Achievement / Rebirth Upgraders', 'P2W Upgraders']`, Codes contains only
    Cupcake-inator, Fidget Pack contains both Ore Rocker and Portable
    Spinner.
- **P2W pack membership and crate/merchant/achievement/rebirth category
  membership are baked into `data/mpu-stats.js` at build time** (`category`/
  `subcategory` fields per item), derived once from
  `data/items.index.json`'s `sourceSheets` plus the hand-built `packs` map —
  not re-derived at runtime. If the source database's sourceSheets ever
  disagree with this later, these fields need manual re-checking, not
  automatic re-sync (consistent with the data file's own one-time-seed
  nature).
- **Keep/chop session state**: "kept" is transient, in-memory only
  (`keptThisRun`, reset each time "Figure out what's getting chopped" is
  pressed) — not persisted. Only the ownership toggle and per-item inputs
  persist to `localStorage` (`tycoon-sim-2:mpa-tool:v1`), matching the
  user's own description: a kept item naturally reappears on the *next run*
  because it's still the worst MPA among what's owned, with no separate
  "already decided" memory needed.

**Testing**: no permanent automated test file yet (unlike Capgrader
Generator/`tests/capgrader-generator.test.mjs`) — flagged as a follow-up, not
done due to time. What *was* done: the file exposes `globalThis.__mpaDebug`
(same hook pattern as `capgrader-generator.js`'s `__cgDebug`) and was
exercised with an ad hoc Node script (DOM-stub loaded via `new
Function('globalThis', src)`, same technique) covering: every choppable item
has a finite reference MPA, Lambda's best-is-1-use behavior, Dragon's
Breath's best-is-Looped behavior, Dream Machine's formula at an untabulated
effect count, both dependency-lock shapes (simple and OR), the keep-advances-
to-next-worst behavior, and Incremental-removes-all vs. Lambda-removes-one
chop semantics — all passed. Also smoke-tested live in a real browser via
Playwright (`playwright` is available as a global npm package in this
environment, not a project dependency — `chromium-1194` under
`/opt/pw-browsers`, not `/opt/pw-browsers/chromium` despite what
`PLAYWRIGHT_BROWSERS_PATH` might suggest, needs the versioned subdirectory
path passed as `executablePath` explicitly): list sorts correctly by both
MPA and MPU, all 4 categories and 28 subcategories render (18 crates with
tracked items — not all 19 crates have one, e.g. nothing tracked comes from
Basic — 3 M/A/R, 6 packs, 1 Other), select-all/toggle/run/keep/chop/back all
work with no JS errors (only expected 404s for the known-missing icons
below). **A proper `tests/mpa-chopping-block.test.mjs` wired into `npm
test`/`npm run check` should still be written** — this is the gap to close
next if this tool gets touched again, same as Capgrader Generator's own
history (it also shipped once without tests, gained them in a later
session).

**Missing icons**: `docs/MPA_TOOL_MISSING_ICONS.md` lists 12 — mostly the
already-known nature-update items, plus one pre-existing gap (MVP Shiny).
The tool renders a blank slot for these (`onerror`-hide, same pattern as
`luck-crate-generator.js`), never breaks.

**Files**: `data/mpu-stats.js` (new), `mpa-chopping-block.js` (new, all tool
logic), `docs/MPA_TOOL_MISSING_ICONS.md` (new), `index.html` (nav button +
WIP badge, new `#mpa-tool` section with 3 inner views, new script tags for
both the data file and the tool script), `app.js` (`activeTool` widened to
5-way, `wipBadge` generalized to show for `'builder'` or `'mpa'` with a
tool-specific title, `mpa-tool:activated` event), `styles.css` (new
`.mpa-*` rules, reusing `.capgrader-*`/`.luck-*` classes wherever they
already fit rather than duplicating).

**Next suggested steps**: confirm the 3 flagged items above with the user
(Portable Spinner's looped-config handling, the OR-dependency interpretation,
the Fidget Pack/Whimsical Palace naming mismatch); write the permanent
automated test file; get the more complete combo/dependency list the user
said they'd send; fill in the missing icons.

## 2026-09-11 follow-up: fixed "Rubix's Polisher" typo at the source

The resync entry below flagged this as a still-open, harmless-for-now
spreadsheet typo and left it to the user. They asked to fix it immediately
after, so it's done — no longer an open item in AI_TASKS.md.

Found **two** occurrences of the misspelling once actually searched for (the
resync entry only mentioned the one in Ore SizeHeight): `Ore SizeHeight!K10`
and **`MPU!B78`** — the MPU sheet is the one the user said had just been
filled out with "each item now instead of just some," so the same typo had
propagated there too. Both cells shared the same shared-string index (321,
"Rubix's Polisher"); a correctly-spelled "Rubik's Polisher" already existed
elsewhere in the shared-string table at index 1421 (used by e.g. `Capgrader`
sheet), so the fix was repointing both cells' `t="s"` value from `321` to
`1421` — zero shared-string content touched, same targeted-zip-entry-patch
method as the resync entry's Dream Machine fix. Verified via `grep -o
't="s"><v>321</v>'` across all `xl/worksheets/*.xml` that those were the only
two references before patching, and that both now read "Rubik's Polisher" in
`data/items.generated.js` / `data/ore-size-height.index.json` after
resyncing. `database:sync`/`database:lint` still clean (390 records, 0
errors), same three test files still pass.

## Note: a Calculator tool exists but was never documented here

Between the last entry below (2026-08-27) and this session, a prior session
added a **fourth tool, the Calculator** (`abbrev-calculator.js`, commits
`fbd6f24` "Add Calculator tool: scientific calc with in-game number
abbreviations" and `d8bc12b` "Fix hidden-attribute bugs: Calculator leaking
into other tools, stale Capgrader results after Edit setup") — both already
on `main`. That session never wrote a handoff entry for it, so treat this
paragraph as the placeholder: read `abbrev-calculator.js` and the two commits
directly if you need the architecture, since nothing further is recorded
here. Wired in the same way as the other tools: `data-tool="calculator"` nav
button in `index.html`, `activeTool` in `app.js` (title "Calculator",
`calc-tool:activated` event, `calcToolSection.hidden`).

## 2026-09-11 Database resync (nature-update workbook)

User supplied a new `Tycoon Sim Database.xlsx` (a real in-game content
update — nature-themed items — not just a correction pass). Replaced
`data/Tycoon Sim Database.xlsx` and re-ran the full pipeline
(`sync-database.mjs`, `report-database-conflicts.mjs`,
`build-database-index.mjs`, `lint-database.mjs`,
`build-crate-luck-data.mjs`), then diffed every record against the prior
workbook (kept as a scratch backup during the session, not committed) rather
than trusting the sync tool's own conflict check alone.

**36 new item-variant rows, 0 removed:** Butterfly Dropper, Floral Frenzy,
Nature's Promise, Canyon Refiner, Carrot Mutator, Clover Garden, Fragrant
Passage, Fungal Enhancer, Glistening Falls, Holophase Device, Lush
Beanstock, Ore Pollinator, Potted Flower, Reclaimed Sanctum, Sunflower
Fields (2 new crates too: Floral, Nature — 19 crates / 113 crate items now,
up from 17/101). **None of these have icons yet** in `icons/items/` — that's
expected (icons come from the user separately, per the 2026-08-27 Luck tool
entry's process), not a database problem, just a follow-up if the user wants
these new items to render properly in the Luck Simulator.

**Two real data-entry errors found and fixed in the workbook itself** (both
were previously non-existent — confirmed by diffing against the prior
workbook, not just current-state lint):
1. **Dream Machine (Base), `Upgraders` sheet row 38** had "Limited Uses: 3"
   while the same item on the `Merchant` sheet (row 33) and every other
   Dream Machine variant on both sheets said "Limited Uses: 1". The row
   directly above it (Whimsical Palace Shiny, row 37) legitimately has
   "Limited Uses: 3" — this had clearly bled down into Dream Machine's row.
   User confirmed: fixed to 1. This was the sync tool's own
   `DATABASE_CONFLICT` check catching a real error, not a false positive.
2. **Krakatoa's "Rejected" ore size** on the `Ore SizeHeight` sheet came in
   blank in the new workbook; the prior workbook had it as `1.95` (paired
   with Acceptable `[2.4, 1.8]`). This is not something the conflict
   checker catches on its own (it's a single-sheet omission, not a
   cross-sheet disagreement) — only caught by diffing against the prior
   workbook. User confirmed: restored to `1.95`.

**How the xlsx was patched — do this again if editing this specific
workbook, not openpyxl full-rewrite:** the workbook is ~21-23MB, almost
certainly because of embedded images/rich content beyond plain cell data.
A test edit via `openpyxl.load_workbook(...).save(...)` silently shrank the
file to ~344KB — it does not round-trip whatever makes this file large, so
a full openpyxl rewrite is a silent-corruption risk for this specific file.
Caught before committing (compared file size before/after) and reverted.
The safe method that was actually used: unzip the `.xlsx`, edit only the
target cell in the specific `xl/worksheets/sheetN.xml`, then
`zip <file>.xlsx path/to/sheetN.xml` to patch just that zip entry in place
(verified afterward that the full entry list — 555 files — was byte-for-byte
unchanged except the two patched sheet XMLs). For the Dream Machine fix this
was even simpler than writing new XML: cell `N38` referenced shared-string
index 1697 ("...Limited Uses: 3..."); shared-string index 1690 already held
the exact desired text ("...Limited Uses: 1..." — same string other Dream
Machine variants already use), so the fix was just repointing `N38`'s
`<v>1697</v>` to `<v>1690</v>`, touching zero shared content. The Krakatoa
fix changed an empty self-closing `<c r="P13" s="188"/>` to
`<c r="P13" s="188"><v>1.95</v></c>` — a plain numeric cell, no shared string
involved.

**Pre-existing issues, NOT introduced by or fixed in this resync — flagging,
not touching:**
- `tests/engine.test.mjs` still fails on the already-documented "Base
  Portable Upgrader is 1x2; expected 2x1" geometry mismatch (see the
  2026-08-27 "Unrelated pre-existing issue" entry further down this file).
  Confirmed Portable Upgrader's size is identically `1x2` in both the old
  and new workbook, so this update didn't cause or change it either way.
  `tests/validate-planner.js`, `tests/regression-fixtures.test.mjs`, and
  `tests/capgrader-generator.test.mjs` all still pass standalone.
- **`Ore SizeHeight` sheet spells it "Rubix's Polisher"** (with an x) in its
  restrictions table, while every other sheet (and the item database) has
  the correct "Rubik's Polisher" — present in both the old and new workbook,
  so not new. This is the *same* typo class the 2026-08-27 session already
  found and fixed once in `capgrader-generator.js`'s hardcoded
  `CAPGRADER_NAMES` list, just in a different location (the source sheet
  itself this time). Currently harmless — nothing in `engine/*.mjs` cross-
  references `oreSizeHeight.restrictions[].name` against the item database
  yet (only `engine/database-lint.mjs` reads it, and only for
  acceptable/rejected presence, not name-matching) — but worth the user
  fixing at the source before anything is ever built that looks restrictions
  up by name.

**Verification run, all clean after the two fixes above:** `database:sync`
(0 cross-sheet conflicts), `database:lint` (`valid: true`, 390 records, 0
errors/warnings), `build-crate-luck-data.mjs`, `node --check` on every
engine/script file, and the three passing test files above.
`data/item-geometry-worksheet.json` and
`scripts/build-item-geometry-worksheet.mjs` (still deliberately uncommitted
per the "Things NOT to change" section below) were not touched.

## 2026-08-27 Capgrader Generator: automated test coverage

**Capgrader Generator can now move to Resolved in AI_TASKS.md** — it had zero
automated tests (only manual browser checks and ad hoc Node scratch scripts);
now `tests/capgrader-generator.test.mjs` exists and is wired into both
`npm test` and `npm run check`.

**How it tests a plain (non-module) browser script:** `capgrader-generator.js`
now permanently exposes `globalThis.__cgDebug = { legalPool,
optimizeCapgraderChain, getToggle, capgraderNames, additiveNames,
scannerNames, lunarName }` right after `optimizeCapgraderChain`'s closing
brace (previously this hook only ever existed in a throwaway scratch copy —
see the 2026-08-26 entry below). The test file loads `data/items.generated.js`
+ `capgrader-generator.js` together via `new Function(...)` against a minimal
hand-written `document`/`localStorage`/`CSS` stub (no jsdom dependency added —
this project is intentionally zero-npm-dependency) and pulls the hook off
`globalThis`. The stub works because every real DOM lookup in the file is
either `?.`-guarded or behind an `if (!el) return`, so a stub where
`document.querySelector`/`querySelectorAll` always return
`null`/`[]` is enough to let the module finish loading (and reach the
`__cgDebug` assignment) without a real HTML parser — verified by reading the
whole file's DOM-touching code paths, not assumed. **Do not remove the
`globalThis.__cgDebug` line — the test suite depends on it and it's a no-op in
production** (browsers just get one extra harmless global property).

**What's covered:** `legalPool()` (empty pool, fully-owned pool including
finisher/non-finisher split, owning exactly one item doesn't leak others in),
and `optimizeCapgraderChain()` (a regression band of $1.25T-$1.4T for the
"own everything, Dropper starting at $10" scenario from the 2026-08-26 quality
fixes below — catches all three fixes regressing at once; finishers only ever
cascade at the very end, never as a mid-chain bridge, per quality bug #2; an
empty pool returns the starting value unchanged without throwing).
**Not covered:** the UI rendering/event-wiring code (`renderDropperRows`,
`renderToggleLists`, etc.) — the DOM stub deliberately makes those all no-op,
so this is search-logic coverage only, not a full UI test. Scanner
hit-chance formulas (`predictSweepHitChance`/`predictAzureHitChance`) also
aren't unit-tested directly yet, only exercised indirectly through the
regression scenario when scanners are legal moves.

**Real bug found and fixed while writing these tests — significant, not
cosmetic:** `CAPGRADER_NAMES` had `"Rubix's Polisher"` (with an x) but the
actual database item is **"Rubik's Polisher"** (a Rubik's Cube reference) —
the typo silently meant this item could never be toggled on in the tool at
all, since `legalPool()` only ever looks up names from that hardcoded set.
Fixed in `capgrader-generator.js` (both the `CAPGRADER_NAMES` entry and the
comment above `isFinisherRecord`). Measured impact on the "own everything,
Dropper starting at $10" scenario: **$604B with the typo (old, broken) vs.
$1.33T fixed** — more than 2x, because Rubik's Polisher is a *finisher*
(range 0 - 1 septillion, single-use) that cascades on top of Toybox Express
at the very end of the chain (see quality bug #2 below), so losing it wasn't
just "one fewer option," it silently cut off one of exactly two
finisher-cascade multipliers the search could ever apply. If this tool felt
like it was underperforming for players who owned Rubik's Polisher, this was
why. The $1.25T-$1.4T regression band in the new test file already reflects
the fixed number — do not "fix" the test back down to ~$604B-780B if this
typo ever creeps back in; that would mean the bug regressed, not the test.

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

## Files changed (uncommitted) — UPDATED 2026-08-27, corrects a stale entry below

As of the end of the 2026-08-27 session, **everything is committed and pushed
to `origin/main`** (last push: commit `b91278e`, "Add Luck/Crate Simulator
tool and resync database") **except** these two, which stay uncommitted at
the user's explicit, repeated request (do not "helpfully" commit them):
- `data/item-geometry-worksheet.json`
- `scripts/build-item-geometry-worksheet.mjs`

`git status` should show only those two as untracked and nothing else
modified. If it shows more than that, something changed after this note was
written — trust `git status`/`git log` over this file in that case, and
update this section rather than leaving it stale again (see the paragraph
below this one for what NOT to do).

The paragraph that used to be here (something like "AGENTS.md move,
scanner-beam thread, files changed for that session") was from a much
earlier session and had gone stale — corrected in place per this file's own
instructions rather than deleted, so you know this section can and does drift
if not actively maintained every session.

## Important decisions

See `AI_DECISIONS.md` — don't duplicate that content here, just know it
exists and read it before making a call that might contradict something
already settled.

## Current problem / state

Nothing is actively broken. Three tools now exist (Base Builder — WIP badge,
Capgrader Generator, Luck/Crate Simulator — see the dated sections below for
each). The item-geometry worksheet is a working document mid-audit, not a
bug, and is **still not wired into the engine** — none of that geometry data
affects actual gameplay simulation yet (see AI_TASKS.md's "revamp" entry).

## Next suggested task

**Immediate: the user is about to test the Luck/Crate Simulator further and
give feedback in a new chat** — read the "2026-08-27 Luck / Crate Simulator
tool" section (and the two sections right after it) in full before touching
`luck-crate-generator.js` or `scripts/build-crate-luck-data.mjs`, especially
the "Any Crate items" fix's 3 attempts — the correct invariant is "identical
odds across all crates at exactly 1x Unbox Luck, allowed to diverge at any
other luck value." No automated tests exist for this tool yet; consider
adding some if it gets touched again, since it's had zero regression coverage
beyond manual browser checks so far.

Once that's stable, fall back to the general upgraders audit (AI_TASKS.md →
"In progress"), item by item, the same way droppers and furnaces were done:
user provides in-game
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
