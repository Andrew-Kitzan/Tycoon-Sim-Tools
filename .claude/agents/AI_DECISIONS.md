# AI Decisions

Permanent architecture/design decisions for this repo. Do not re-litigate these
without the user explicitly reopening them. If a decision is superseded, edit
the entry in place and note what changed and why, rather than deleting it.

## Ore value rounding

The game ceils the ore's value to a whole number after every value-changing
step (drop, upgrade, furnace cash-out) — not just for display. The engine now
has `roundOreValue()` (ceil with a small epsilon guard) applied after every
step in `engine/models.mjs`, `engine/value-distribution.mjs`,
`engine/simulation.mjs`, and duplicated in `planner-core.js` (see "Known
architecture debt" below for why it has to be duplicated).

A related bug this surfaced: `value` was being recomputed from the carried
`valueDistribution` on every step, even for items that don't activate, causing
drift once branch values were rounded. Fixed by only recomputing when the
current item actually modifies the distribution.

## Item geometry worksheet

`data/manual/item-geometry-worksheet.json` is the **hand-maintained source of truth**
for every item's physical placement (drop points, conveyor belts, upgrade
beams, furnace processing zones) and, for items whose behavior a flat
`mainStat` can't express, a `formulaOverride`. It exists to stage and verify
this data *before* the engine/UI "geometry revamp" (see AI_TASKS.md) — it is
not wired into the live engine yet. See its own `_readme` block for the full
field-by-field spec; the summary:

- **Coordinate convention:** plain `x`/`y`, picture every item facing south
  (ore flows top-to-bottom) regardless of its real placement direction —
  `(0,0)` is that picture's top-left tile. `x`/`y` is the **starting edge**
  of a point or rectangle, never a center — `width`/`length` extend forward
  only (increasing x, increasing y) from that starting coordinate. This was
  briefly reconsidered as a center-anchored convention and explicitly reverted
  back to edge-anchored — see chat history if this comes up again, but treat
  it as settled.
- **One item entry per NAME, not per variant** — footprint size is identical
  across all variants (verified for every item in the database), geometry
  usually is too. Per-variant divergence goes in that variant's
  `geometryOverrides`, not a duplicated top-level block.
- **`current` vs `confirmed`:** `current` is what the engine's *existing* code
  assumes today (bugs included, with a `source` citing where) — never edit it.
  `confirmed` is the verified truth; it's pre-filled with a best-available
  starting guess (often identical to `current`) and should be overwritten once
  actually checked in-game. `confirmed` never carries a `source` key.
- **`formulaOverride`:** present (null by default) on every dropper/upgrader/
  furnace variant. No fixed shape is enforced — reuse an existing shape
  (`random-outcome-table`, `conditional-multiplier`, `piecewise-formula`,
  `multiplicative-factors`) when the item's real behavior matches one, invent
  a new one when it doesn't.
- **`scripts/build-item-geometry-worksheet.mjs`** did the one-time bootstrap
  and now **refuses to run** as long as the output file exists — this is
  intentional, so no script (including a future re-run of this one) can ever
  wipe hand-typed data. The only things that may edit the worksheet from here
  on are the user and an AI working with them directly in conversation.
- **Materials vs. effects:** Neon and Sandy are *materials*, not effects — an
  ore can only have one material at a time, mutually exclusive. Only Neon is
  currently modeled in `rules/engine-rules.json` (as `cosmetic-material`);
  Sandy isn't yet because the source spreadsheet hasn't been updated with it.
  A third "base/default" material (no special material) also exists. This
  needs its own proper category in the rules once the spreadsheet catches up
  — don't model Sandy as a one-off effect.
- **Facing-direction bugs found so far:** Parasitic Fiend and Portable
  Upgrader both have their 3D model's true front rotated 90° from their
  declared facing label (`size.width`/`size.length` as entered in the
  database are effectively swapped relative to reality). Fixed per-item by
  swapping `size` and recomputing `confirmed` geometry against the corrected
  axes, with an explanatory note. Watch for more of these while going through
  the rest of the upgraders — there is no reason to assume only these two are
  affected.
- **Beam `shape` vocabulary now includes moving beams, not just static
  rectangles:** `rect` (axis-aligned, static) and `radius` (circular, static)
  existed already for furnace zones and Portable Spinner. Added for scanners:
  `sweep` — a thin beam oscillating back and forth along one axis (`axis`,
  `width` = thickness, `y`/`length` fixed on the other axis, `speed` in
  **cycles/second**, i.e. full round trips per second — NOT degrees, even
  though it's periodic, because nothing is rotating; deliberately reconsidered
  and reverted away from degrees for this reason). `rotate` — a straight line
  beam pivoting around a fixed point (`x`/`y` = pivot, `length` = pivot-to-tip,
  `width` = thickness, `speed` in **degrees/second**, full continuous
  rotation). Both `speed` values were derived directly from each scanner's
  real Lua movement code (reading the argument to `CFrame.Angles`/the
  coefficient inside `math.sin`), not guessed — see chat history for the
  per-scanner derivations if more scanners need the same treatment.
- **The `effects` text field is not just documentation — sometimes it's
  load-bearing.** It's a verbatim copy of the database's raw item description,
  carried per-variant since the numbers inside differ by variant. Most of it
  (e.g. informal notes like "centered") is purely descriptive and unused by
  any code. But the literal substring **"scanner"** is actively regex-matched
  by the live engine (`models.mjs`, `value-distribution.mjs`:
  `/scanner/i.test(`${item.name} ${item.effects}`)`) to decide whether an item
  gets scanner-hit-chance behavior at all — do not strip "scanner" out of an
  item's `effects` text, even though the worksheet now also records its beam
  geometry in structured form. The engine's *current* scanner handling is
  itself just a flat approximate hit-chance percentage, not a real simulation
  of the beam passing over the ore — replacing that with a real formula
  derived from the beam geometry/motion is explicitly planned (see
  AI_TASKS.md "Scanner beam geometry + hit-chance experiment design").

## Scanner hit-chance formulas (derived from simulation, not yet in the worksheet)

A geometry-based kinematic simulator now exists — `scripts/scanner-hit-simulator.mjs`
(the model) and `scripts/scanner-hit-report.mjs` (renders a Markdown report from it,
`node scripts/scanner-hit-report.mjs [nOre] [nOffsets] > report.md`). It replaces
in-game empirical testing for the 4 real scanners by literally simulating the beam's
motion and a real sequential stream of dropped ore against it. **Not yet wired into
`data/manual/item-geometry-worksheet.json`'s `formulaOverride` fields or the engine — this
section exists so a future session can find and use it without re-deriving it.**

- **Model assumptions locked in with the user, do not re-litigate:** ore x-position
  never drifts once on a belt; ore size units are raw-database (2.5 raw = 1 tile,
  divide by 2.5 for tile diameter); `conveyorSpeed` is raw studs/sec (3 studs = 1
  tile, divide by 3); ore spacing on a belt = `max(oreSizeTiles, conveyorSpeed /
  dropSpeed)`; collision is checked once per `RunService.Stepped` tick (~1/60s), not
  continuously — this matters a lot for Azure specifically (see below).
- **Sweep scanners (Ancient, Star, Precision Ore Scanner):** beam center follows a
  sinusoid (`alpha = (sin(2*pi*speedCyc*t)+1)/2`), so at a random arrival phase its
  position follows an **arcsine distribution** — closed form:
  ```
  P(hit) = (asin(uHi) - asin(uLo)) / pi
  oreR          = (oreSizeRaw / 2.5) / 2
  laneX         = convX + laneFrac * convWidth
  dwell         = (oreSizeTiles + beamLenY) / conveyorSpeed
  peakBeamSpeed = pi * speedCyc * convWidth
  halfWidthEff  = oreR + beamWidthX/2 + 0.32 * dwell * peakBeamSpeed   # 0.32 = SWEEP_DWELL_K, fit empirically
  lo, hi        = clip([laneX - halfWidthEff, laneX + halfWidthEff], convX, convX+convWidth)
  uLo, uHi      = map [lo, hi] from [convX, convX+convWidth] onto [-1, 1]
  ```
  RMSE against the simulated data ≈ 5.7 percentage points.
- **Azure Scanner is a genuinely different mechanic** — its beam rotates in a
  VERTICAL plane (belt-width x, height z), not the ground plane, confirmed directly
  by the user against real screenshots. It's a full diameter through the pivot
  (`beamHalfLen: 1`, i.e. 2 tiles total, always reaches both belt edges when
  horizontal), fixed at one belt-length position (`pivotY: 1`) and one height
  (`pivotHeight: 1.1`, eyeballed against a known ore size in a screenshot — still
  imprecise, the single biggest remaining uncertainty in this model), with real
  thickness along the belt direction (`beamThicknessY: 0.125`) that is NOT zero —
  omitting that thickness was an early modeling bug that underpredicted hit chance
  by ~2x. **Any ore with raw size ≥ 1.25 is a guaranteed hit** (confirmed
  empirically — the ore is tall enough to reach the beam at basically any angle).
  Below that threshold, hit/miss is **genuinely resonance/phase-lock sensitive**:
  the same ore size + drop speed can range from 0% to 100% hit rate depending
  purely on what phase the beam happened to be at when the base started running
  (drop speeds that are simple fractions of Azure's 2-second rotation period — 0.25,
  1, 1.5, 2, 3, 4 — are especially prone to locking; 1.2 avoids this best of the
  commonly-available drop speeds). There is no clean per-config formula for this the
  way there is for sweep scanners — only an **expected value** fit as a straight
  line against the simulated averages (R² = 0.96):
  ```
  P(hit) = 1                              if oreSizeRaw >= 1.25
  P(hit) = (1.81 + 28.47 * oreSizeRaw) / 100   otherwise (expected value across random session-start phase, NOT a per-base guarantee)
  ```
  **Superseded 2026-10-20:** refit to `(7.95 + 42.12 * oreSizeRaw) / 100`
  (R² 0.967, RMSE 2.4 points) after pivotHeight was recalibrated from 1.1 to
  0.57 to match in-game results (see the synced-beams bullet below). Same
  method: average over lanes 0.25/0.5/0.75 and all arrival phases. Lanes
  differ a lot. At size 1 the center lane hits ~66% and the sides ~40%; the
  formula gives the ~49% average.
- **Overall average hit chance** (collapsing every tested ore size/drop
  speed/lane into one number per scanner — NOT weighted by real-play
  frequency): Ancient 44.5%, Star 29.7%, Precision Ore Scanner 46.4%, Azure
  51.4%.
- **Expected multiplier** (`hitChance * mainStat + (1 - hitChance) * 1`, i.e.
  treating a miss as a 1x no-op): using the overall averages above against each
  scanner's Base `mainStat` — Ancient 1.2225x, Star 1.5346x, Precision Ore
  Scanner 1.2320x, Azure 1.3084x. Star has the lowest hit chance of the four but
  the highest expected multiplier, since its 2.8x payoff outweighs missing 70%
  of the time.
- **Validation status (updated 2026-10-10):** the player says the scanner
  formulas have now been proven by in-game testing. Original note, kept for
  history: the sweep-scanner model had not been checked against a
  real in-game measurement yet. The Azure model WAS corrected against one real
  data point (oreSize raw 1, dropSpeed 1, center lane → user observed 62/85 =
  72.9% hits) but that data point is itself confounded by the drop-speed-1
  resonance lock described above, so it only validates the model's rough
  direction, not its precision — a cleaner re-test at drop speed 1.2 (see
  above) was requested but not yet confirmed back. Treat all of this as a
  strong first-pass model, not ground truth, until more real data comes in.
- **Same-type scanners have synced beams (player-confirmed).** Every
  scanner of one type shares one beam clock, so copies in a row are not
  independent rolls. Player's in-game evidence: 4 Precision or 4 Azure back
  to back were never enough. The Capgrader Generator simulates the copies as
  placed (copy k meets the ore later on the shared clock by its distance ÷
  belt speed, with per-tick hit tests ported from
  scripts/scanner-hit-simulator.mjs) and adds copies until 99% of arrival
  phases are hit (`syncedUnitsNeeded()`). **Gaps (2026-10-20, player
  reopened this the same day):** `syncedScannerPlan()` tries plain-conveyor
  gaps of 0–12 tiles (12 studs/s, Normal/Half/Quarter Conveyor) and keeps
  the shortest layout. Precision back to back shifts ~0.52 of a sweep per
  copy, so a centered ore meets a mirrored beam and repeats its result
  (about 18 copies needed). With gaps, at ore size 1 in the center lane:
  Precision 3 copies with a 3-tile gap (a 1-tile gap gives 5), Azure 2 with
  a 2-tile gap, Ancient 4 back to back. **Precision is CONFIRMED IN GAME
  (2026-10-20):** 3 Precision with 3-tile gaps (5 tiles beam to beam, beams
  centered in each 2-tile scanner, straight plain conveyor, all facing the
  same way) hit every ore from Stone (size 1, drop 1), Iron (size 1, drop 2)
  and King Dropper (size 1, drop 3). The model covers every arrival phase,
  so drop speed shouldn't matter. **Azure is also CONFIRMED IN GAME
  (2026-10-20):** 2 Azure with a 2-tile gap hit every size-1 ore. The model
  first predicted 5, so Azure's beam pivotHeight was recalibrated from the
  eyeballed 1.1 to 0.57 (in both capgrader-generator.js and
  scripts/scanner-hit-simulator.mjs). That fits the in-game results: 2 with a
  2-tile gap = 100%, 4 back to back never enough (model ~96%, 5 needed), and
  1 Azure ~65% (the older 62/85 = 73% measurement is drop-speed-confounded).
  0.55 matched the 73% better but made 4 back to back "enough", which the
  player said never happened. It
  also makes size 1.2+ hit with a single Azure, matching the simulator's
  note. The wiki's Azure single-hit formula was refit to match (see the
  Azure bullet above): (7.95 + 42.12 × size)%. **Ancient is also CONFIRMED IN GAME
  (2026-10-20):** 4 back to back is best for size-1 ore, matching the
  model. So all three scanners are verified at ore size 1. Not yet tested: off-center ore (the
  model says up to ~6 Precision) and other ore sizes. Odd
  Precision gaps (1, 3, 5) work well and even ones don't. Results hold for
  beam speeds 0.98–1.07 sweeps/s, but at exactly 1.00 Precision, every
  whole-tile gap fails for centered ore.

- **Star Scanner spacing (2026-10-20). CONFIRMED IN GAME at ore size 1:** 5
  Stars with 2-tile gaps hit every size-1 ore, matching the model. Other
  sizes are still model-only.
  Star is limited to 1 use per ore, so extra copies never double-upgrade.
  Its beam is slow (0.159 sweeps/s), so its plans swing a lot with small
  speed errors (ore size 1 center: at 0.15 → 8 copies, 0.159 → 5 with a 2-tile
  gap, 0.17 → 7). Current predictions (center lane): size 0.6 = 13 back to
  back, 1 = 5 with 2-tile gaps, 1.5 = 4 back to back, 2 = 3 with 1-tile gaps,
  2.7 = 2 with 3-tile gaps. Star is in SYNC_GEOMETRY only for the wiki, and
  the Capgrader Generator never uses it.
- **Wiki scanner Stats for Nerds (2026-10-20):** all 4 scanners have a
  "Scanner distance" Stats for Nerds section (`scannerSpacingEntry()` in
  wiki-item-mechanics.js) with an ore size + lane calculator and a size
  table. They read `globalThis.TycoonScanners.spacing()` from
  capgrader-generator.js, so the wiki and the generator always agree.

## Capgrader ranges are inclusive (2026-10-21, player-confirmed in game)

An ore worth **exactly** a capgrader's upper threshold still gets the
upgrade (screenshots: $15K into a 15K-cap capgrader was upgraded). Only a
value above the threshold is out of range. The code already used
`value <= range.maximum` everywhere (capgrader-generator.js `withinRange`,
engine/optimizer.mjs, engine/coordinate-map.mjs, planner-core.js, app.js), and
the engine's near-cap score already treats ratio 1.0 (exactly at the cap) as
best. Only docs/BUILD_RULES.md wrongly said "without reaching" and used a
134.999K example; it was corrected. Never change these checks to `<`.
A test in tests/capgrader-generator.test.mjs locks it (15K in, 15,001 out).

## Known architecture debt

- **`planner-core.js` is a hand-maintained duplicate of `engine/*.mjs`** for
  the browser, not a shared module. Every engine bug fix this session
  (rounding, item-click-vs-drag) had to be patched in both places. The
  intended fix — bundling `engine/*.mjs` directly for the browser instead of
  hand-porting — has not been done. Don't "forget" the `planner-core.js` half
  of a fix; check for the twin implementation whenever touching engine logic.
- **Furnace formula inconsistency:** Krakatoa's real effect-based formula is
  implemented in `engine/furnaces.mjs`, but `engine/compiler.mjs` (the main
  planner economics) still multiplies by raw `mainStat` (null for Krakatoa),
  bypassing it. Live simulation and planner economics can disagree for this
  item. Not yet fixed — noted per-item in the worksheet's `formulaNote`.

## Git identity

Commits in this repo should use `andrew-kitzan` /
`71672408+Andrew-Kitzan@users.noreply.github.com` (global git config). The
user's real email is blocked by GitHub's "block command line pushes that
expose my email" privacy setting — use the noreply address, not the real one.
