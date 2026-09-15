# MPA / Chopping Block — missing icons

Computed once while building `data/manual/mpu-stats.js` (2026-09-11) by checking
every tracked item+variant's expected `icons/items/{Name} {Variant}.png`
path against what actually exists. The tool itself never breaks on a missing
icon — it just renders a blank slot (same `onerror`-hide pattern the Luck
Simulator uses) — but leaving a static list here so these can be filled in
without having to re-scan for them.

**Update (2026-09-10):** 11 of the original 12 were filled in from the user's
local `Tycoon Sim/Icons` source folder. Also found and fixed a real
pre-existing bug while doing this: `icons/items/MVP Upgrader.png` /
`MVP Upgrader.png Shiny` existed in the repo, but the database's actual item
name is just **"MVP"** (no "Upgrader") — so MVP's icon had been silently
broken (blank slot) for both variants, everywhere on the site, not just in
this tool. Renamed to `MVP.png` / `MVP Shiny.png` and removed the stray
incorrectly-named files.

Only one item remains genuinely missing — not present anywhere in the
source icon folder yet, so nothing to copy in until the user has it:

- `icons/items/Ore Pollinator Shiny.png`

If new items are added to `data/manual/mpu-stats.js` later, this list won't
auto-update — re-check manually (compare each tracked item+variant's
expected icon path against `icons/items/`) if it matters again.
