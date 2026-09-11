# MPA / Chopping Block — missing icons

Computed once while building `data/mpu-stats.js` (2026-09-11) by checking
every tracked item+variant's expected `icons/items/{Name} {Variant}.png`
path against what actually exists. The tool itself never breaks on a missing
icon — it just renders a blank slot (same `onerror`-hide pattern the Luck
Simulator uses) — but leaving a static list here so these can be filled in
without having to re-scan for them.

Most of these are the recently-added nature-update items that already had no
icons before this tool existed (see the database-resync work in
`AI_HANDOFF.md`); `MVP Shiny` is the one pre-existing gap.

- `icons/items/Sunflower Fields Shiny.png`
- `icons/items/Glistening Falls Shiny.png`
- `icons/items/Lush Beanstock Shiny.png`
- `icons/items/Canyon Refiner Shiny.png`
- `icons/items/MVP Shiny.png`
- `icons/items/Fungal Enhancer Shiny.png`
- `icons/items/Carrot Mutator Shiny.png`
- `icons/items/Fragrant Passage Shiny.png`
- `icons/items/Ore Pollinator Shiny.png`
- `icons/items/Clover Garden Shiny.png`
- `icons/items/Reclaimed Sanctum Shiny Mythic.png`
- `icons/items/Holophase Device Shiny Mythic.png`

If new items are added to `data/mpu-stats.js` later, this list won't
auto-update — re-check manually (compare each tracked item+variant's
expected icon path against `icons/items/`) if it matters again.
