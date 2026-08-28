# AI Tasks

Current todo list. Update this whenever a task starts, finishes, or a new one
is discovered — don't let it drift out of sync with reality. Move finished
items to AI_HANDOFF.md's "What I changed" rather than just deleting them here.

## In progress

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
- **Scanner beam geometry + hit-chance — formulas done and in production use
  via Capgrader Generator; the original wider goal (live engine + worksheet)
  is still open.** Two genuinely different scopes here, worth keeping
  separate so this doesn't get marked "done" by mistake:
  - **Done:** a geometry-based kinematic simulator
    (`scripts/scanner-hit-simulator.mjs` + `scripts/scanner-hit-report.mjs`)
    computes hit chance from each scanner's real confirmed beam geometry;
    closed-form formulas were derived and fit against that simulated data
    (arcsine-based for sweep scanners, expected-value linear fit for Azure
    below its guaranteed threshold). Full derivation in AI_DECISIONS.md
    "Scanner hit-chance formulas". These are the formulas Capgrader
    Generator's own scanner math uses today — that consumer is finished and
    shipped.
  - **Still not done, original goal of this task:** the *live game engine*
    (`models.mjs`/`value-distribution.mjs`) still uses the old flat
    `scannerHitChance` approximation — these formulas were never wired in
    there, and were never written into the item-geometry-worksheet's
    `formulaOverride` fields either. The sweep-scanner model also hasn't
    been checked against any real in-game measurement yet, and Azure's
    `pivotHeight` (1.1, eyeballed from one screenshot) is still the single
    biggest source of uncertainty in that model. **Ask the user whether they
    still want this wider engine-wiring work or consider the Capgrader-tool
    use sufficient** before closing this out or continuing it.

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

- **Capgrader Generator tool.** Feature-complete, pushed, and now has real
  automated test coverage (`tests/capgrader-generator.test.mjs`, wired into
  `npm test`/`npm run check`) — this was the one thing keeping it open. Full
  detail in `AI_HANDOFF.md` → "2026-08-27 Capgrader Generator: automated test
  coverage" (how the DOM-stub test harness works, what's covered vs. not) and
  the two entries below it ("2026-08-27 Capgrader Generator tool + scanner
  formula finalization", "2026-08-26 Capgrader Generator: beam-search quality
  fixes" — read all three before touching `optimizeCapgraderChain`/
  `candidateMoves`/`legalPool`). Writing the tests also surfaced and fixed a
  real, significant bug: `CAPGRADER_NAMES` had a typo ("Rubix's Polisher"
  instead of the database's actual "Rubik's Polisher") that silently made
  that finisher item impossible to ever toggle on, costing more than 2x final
  value in the "own everything" scenario ($604B → $1.33T once fixed) — see
  the handoff entry for the measured numbers. A small (~1-1.5%) gap to the
  true theoretical search optimum remains a known, accepted limitation, not
  something to chase.
- Beam/zone coordinate convention (center-anchored vs. edge-anchored) — was
  briefly reconsidered, explicitly reverted back to edge-anchored. See
  AI_DECISIONS.md.
- `decorations` section — removed entirely from the worksheet at the user's
  request; not needed.
- `needsFormula` field — removed entirely from upgraders (superseded by
  `formulaOverride` alone); still present on droppers and furnaces.
- **Luck / Crate Simulator tool.** Built, verified against the real
  reference spreadsheet's own numbers (byte-for-byte at 1x luck, and against
  a live screenshot at luck 202), pushed (`b91278e`). Full detail in
  `AI_HANDOFF.md` → "2026-08-27 Luck / Crate Simulator tool" plus the three
  sections right after it — the "Any Crate" items fix especially, since it
  went through 3 attempts before landing on the correct invariant (odds
  identical across every crate at exactly 1x Unbox Luck, allowed to diverge
  at any other luck value) — re-verify against that invariant, not just
  against whatever the most recent screenshot showed, if this needs
  revisiting. No automated tests exist. The rarity color palette is a
  reasonable default guess, not sourced from the spreadsheet (confirmed no
  such data exists there — no per-cell fills or conditional formatting on
  the Rarity column).
- **Feedback widget.** A "Feedback" button visible on every tool, opening a
  form (bug report/feedback/suggestion + optional image/video attachment)
  that relays through FormSubmit since the site is static GitHub Pages with
  no backend. `feedback.js`. Fixed one real Android "forced dark mode" bug
  this surfaced live (form text was invisible on some phones — see
  AI_HANDOFF.md). Working live, no known open issues.
