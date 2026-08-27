# AI Tasks

Current todo list. Update this whenever a task starts, finishes, or a new one
is discovered — don't let it drift out of sync with reality. Move finished
items to AI_HANDOFF.md's "What I changed" rather than just deleting them here.

## In progress

- **Capgrader Generator tool — built and beam-search quality issues fixed,
  still no automated tests.** A second full tool alongside the Base Builder
  (new hamburger nav menu to switch between them), for finding the best
  capgrader chain for one or more droppers given which capgraders/
  additives/Lunar Landing/scanners the player owns. Full detail (files,
  architecture decisions, known gotchas) is in `AI_HANDOFF.md` → "2026-08-27
  Capgrader Generator tool + scanner formula finalization" for the original
  build, and → "2026-08-26 Capgrader Generator: beam-search quality fixes"
  for a round of real correctness bugs found and fixed in the search
  algorithm itself (terminal scoring, wide-range single-use items being
  wasted as mid-chain bridges, depth-aligned pruning unfairly penalizing
  many-small-steps chains) — read both before changing anything here, the
  second one especially before touching `optimizeCapgraderChain` or
  `candidateMoves`. User confirmed satisfied with current output quality
  ("that is perfect"); a small (~1-1.5%) gap to the true theoretical optimum
  remains and is flagged as a known, accepted limitation, not a bug to
  chase reflexively — see that section's item 4 before trying to close it,
  it would need a real search-architecture change (best-first/A*), not a
  parameter tweak. Nothing committed yet. No automated tests written for
  `capgrader-generator.js` itself — worth adding if this tool gets touched
  again, since it's had zero regression coverage so far beyond manual
  browser checks and ad hoc Node scratch scripts (see AI_HANDOFF.md for the
  debug-hook technique used to test the search logic directly against the
  real file).
- **Auditing `data/item-geometry-worksheet.json`'s `upgraders` section.**
  Droppers and furnaces are fully audited and fixed. Upgraders: every item has
  been bulk pre-filled with best-guess defaults (conveyor centered per
  `internalTransportProfile`, beam assumed to match the full conveyor path),
  but only a handful have been individually verified/corrected so far:
  Acid Plant, 8-Ball Refiner, Ore Replicator (drop point), Portable Upgrader
  (facing-direction size bug), Tiki Evaluator (has a real
  `internalTransportOverrides` entry). The rest of the 86 upgraders still need
  the user to check `confirmed` values in-game the same way.
- **Formula overrides for complex items.** Done so far: Wind-Up Dropper,
  Dyson Module, Obelisk Furnace, Enforced Furnace, Fungi Furnace, Toxic
  Wasteland, Mischievous Furnace, Parasitic Fiend, Periastron's Throne,
  Krakatoa. Still `needsFormula`-flagged or otherwise known-incomplete:
  Starlight Enhancer, Raceway Accelerator (both upgraders — formulas were
  discussed early in the geometry-revamp theory pass but not yet written into
  `formulaOverride`).
- **Scanner beam geometry + hit-chance experiment design.** Purpose: the
  live engine currently approximates every scanner as one flat
  `scannerHitChance` percentage (see `models.mjs`/`value-distribution.mjs`,
  detected via `/scanner/i` matching name+effects text) — a crude stand-in,
  not a real simulation of the beam physically passing over the ore. This
  work is specifically building the real replacement for that.
  **Status: instead of in-game empirical testing, a geometry-based kinematic
  simulator was built** (`scripts/scanner-hit-simulator.mjs` +
  `scripts/scanner-hit-report.mjs`) that directly computes hit chance from
  each scanner's real confirmed beam geometry — closed-form formulas have
  been derived and fit against the simulated data (arcsine-based formula for
  sweep scanners, expected-value linear fit for Azure below its guaranteed
  threshold). Full derivation, the formulas themselves, and validation status
  are written up in AI_DECISIONS.md "Scanner hit-chance formulas" — read that
  before touching this further. These formulas are now also the ones used
  live by the Capgrader Generator tool (see the "In progress" entry above /
  AI_HANDOFF.md) for its scanner math — keep both in sync if the formulas
  ever get refit again. **Not yet done:** writing these into the
  worksheet's `formulaOverride` fields (see AI_DECISIONS.md for the exact
  formula text to use) or wiring into the engine; the sweep-scanner model
  hasn't been checked against any real in-game measurement yet, and Azure's
  `pivotHeight` (1.1, eyeballed from one screenshot) is still the single
  biggest source of uncertainty in that model.

## Not started

- **The actual engine/UI geometry revamp.** The worksheet is currently pure
  staged data — nothing in `engine/*.mjs`, `planner-core.js`, or `app.js`
  reads it yet. Once the upgraders audit is far enough along, design and wire
  in: a real "affected zone" system (unifying furnace zones, portable beams,
  and now-regular-upgrader beams under one model instead of three separate ad
  hoc ones), drop-spawn points (currently every dropper assumes one generic
  centered point via `frontCells`, ignoring multi-point droppers entirely),
  and route-validation diagnostics for beams/zones an ore's path doesn't
  actually cross (portables already get this via `coordinate-map.mjs`;
  regular upgraders and furnaces don't).
- **De-duplicate `planner-core.js` against `engine/*.mjs`.** Bundle the real
  engine modules for the browser (esbuild/rollup) instead of hand-porting.
  Discussed as the highest-leverage fix for the recurring "fixed in engine,
  still broken in browser" bug class, but not started.
- **Model materials (Neon/Sandy/base) as a real category** in
  `rules/engine-rules.json`, separate from the effect list. Blocked on the
  user updating the source spreadsheet with Sandy first.
- **Teleporter zone geometry.** Explicitly out of scope for the item geometry
  worksheet (teleporters are conveyor-lane pieces via `teleporterRole`, not
  items in `items.index.json`). Would need its own pass if it's ever wanted.
- **Scan the rest of the upgraders for more facing-direction bugs** like
  Parasitic Fiend and Portable Upgrader. Only two have been found so far;
  nothing suggests those are the only two affected.

## Planned (longer-term roadmap, not started)

Roadmap items the user wants eventually, roughly in dependency order (each
later item leans on the data/work from the ones before it):

1. **Updated item info** — the user's current, active focus (this is the
   `data/item-geometry-worksheet.json` audit above, not a separate task).
2. **More in-app warnings for items/situations that could screw over the
   player** — e.g. limited-use items about to run out, destructive
   effect/material interactions, irreversible actions, anything a player
   could easily not realize is risky before it's too late. Needs design: what
   counts as "risky," where warnings surface (build UI vs. simulation
   output), and whether it's rule-driven (`rules/engine-rules.json`) or ad
   hoc per item.
3. **Correct conveyor paths based on where the dropper actually drops ore** —
   directly depends on the geometry revamp's drop-spawn work (see "Not
   started" above): right now every dropper is assumed to emit from one
   generic centered point via `frontCells`, and conveyor routing isn't
   actually checked against the real drop point. Needs the drop-spawn data
   from the worksheet wired into route validation.
4. **Clean up the website UI.** No specifics decided yet — general UI polish
   pass, scope not yet defined with the user.
5. **Give the planner enough data to suggest optimizations on a player's
   existing setup** — depends on the geometry/formula data actually being
   wired into the engine (not just staged in the worksheet) and probably on
   the `planner-core.js`/`engine` de-duplication being done first, since
   "suggest a better setup" needs the same simulation logic the build UI
   already uses to be trustworthy and consistent in one place.
6. **Build entire setups from player-inputted data end-to-end.** The
   `npm run plan:full` pipeline (see root `AGENTS.md`'s "Base-building
   workflow") already does a version of this for droppers/upgraders/
   furnaces/conveyors; this item is about making that capability more
   complete and more automated. Depends on the geometry/formula data being
   accurate and wired in — an auto-built setup is only as good as the engine
   simulating it.

## Resolved (kept for context, don't re-open without new information)

- Beam/zone coordinate convention (center-anchored vs. edge-anchored) — was
  briefly reconsidered, explicitly reverted back to edge-anchored. See
  AI_DECISIONS.md.
- `decorations` section — removed entirely from the worksheet at the user's
  request; not needed.
- `needsFormula` field — removed entirely from upgraders (superseded by
  `formulaOverride` alone); still present on droppers and furnaces.
