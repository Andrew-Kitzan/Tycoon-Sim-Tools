// Capgrader Generator — a standalone mini-tool alongside the main Base Builder.
// Plain script (no ES modules), reads globalThis.TycoonDatabase directly, same
// as app.js/planner-core.js already do. Ported/trimmed from engine/optimizer.mjs
// `optimizeCapgraders` + engine/models.mjs `applyDeterministicItem` (only the
// branches this tool's restricted item pool can ever reach), since a real
// beam-search implementation of this exact algorithm already exists there —
// see AI_DECISIONS.md / AI_TASKS.md for why this is a hand-port rather than a
// shared module (no bundler in this project yet).

(function () {
  const database = globalThis.TycoonDatabase;
  if (!database) return;
  const records = database.records ?? [];

  // ---- Ported utilities (engine/utils.mjs, browser-safe subset) ----------------

  function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function moneyNumber(value) {
    if (typeof value === 'number') return value;
    const match = String(value ?? '').trim().replaceAll(',', '').match(/^\$?([\d.]+)\s*(K|M|B|T|Qd|Qn|Sx|Sp|Oc|No)?$/i);
    if (!match) return null;
    const powers = { '': 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12, qd: 1e15, qn: 1e18, sx: 1e21, sp: 1e24, oc: 1e27, no: 1e30 };
    return Number(match[1]) * powers[normalize(match[2])];
  }

  function parseRange(value) {
    if (!value || normalize(value) === 'n/a') return null;
    const [minimum, maximum] = String(value).replace(/[–—]/g, '-').split('-').map(moneyNumber);
    return Number.isFinite(minimum) && Number.isFinite(maximum) ? { minimum, maximum } : null;
  }

  function integerUseLimit(value) {
    if (value == null || /unlimited|n\/a/i.test(String(value))) return Infinity;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : Infinity;
  }

  function compactNumber(value) {
    const units = [[1e30, 'No'], [1e27, 'Oc'], [1e24, 'Sp'], [1e21, 'Sx'], [1e18, 'Qn'], [1e15, 'Qd'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    const [divisor, suffix] = units.find(([minimum]) => value >= minimum) ?? [1, ''];
    return `$${Math.floor((value / divisor) * 100) / 100}${suffix}`;
  }

  function roundOreValue(value) {
    return Number.isFinite(value) ? Math.ceil(value - 1e-6) : value;
  }

  function crossingSeconds(item) {
    const speed = Number(item.conveyorSpeed);
    return speed > 0 ? item.size.length * 3 / speed : 0;
  }

  // ---- Ore-limit throughput model (docs/BUILD_RULES.md "Expected cash per
  // minute") --------------------------------------------------------------
  // Cash/min = ore value × ores reaching the furnace per second. Two things
  // cap that second number, and both get worse when the chain is slow:
  //  1. The 100-ore base limit: with total drop rate D and total route time T,
  //     about D×T ores are on the base at once. Past 100, droppers pause and
  //     entries/sec become 100 ÷ T — so every extra second of chain directly
  //     costs throughput. Below 100, chain time costs nothing.
  //  2. Belt flow: a slow conveyor can only move so many ores per second.
  //     Estimated as conveyor speed (studs/s) ÷ ore diameter (studs), i.e.
  //     ores travelling back to back — optimistic, so real bunching is worse.
  //     This is what made Castle Fortress (speed 6) cut a fast-drop Fantasy
  //     base from 13T to 9T/min (2026-10-20, player-measured).
  // The chain is scored on log(value) + log(entries/sec) when speed matters,
  // so a slow item only wins if its value gain beats the throughput it costs.
  const ORE_CAP = 100;
  const STUDS_PER_ORE_SIZE = 1.2; // ore size × (1/2.5 tile) × 3 studs per tile

  function beltCapacity(record, oreSize) {
    const speed = Number(record.conveyorSpeed);
    return speed > 0 ? speed / (Math.max(0.1, oreSize) * STUDS_PER_ORE_SIZE) : Infinity;
  }

  function oreFlow(state, flow) {
    const routeSeconds = flow.restSeconds + state.timeSeconds;
    const capLimit = routeSeconds > 0 ? ORE_CAP / routeSeconds : Infinity;
    const entriesPerSecond = Math.min(flow.dropRate, capLimit, state.beltLimit);
    return {
      entriesPerSecond,
      activeOres: flow.dropRate * routeSeconds,
      limitedBy: entriesPerSecond === flow.dropRate ? 'drop rate' : entriesPerSecond === state.beltLimit ? 'belt speed' : 'ore limit',
    };
  }

  // ---- Scanner hit-chance formulas (see AI_DECISIONS.md "Scanner hit-chance
  // formulas" / scripts/scanner-hit-simulator.mjs — validated against
  // simulation, not the engine's old flat oreSize/4 fallback) -----------------

  const ORE_TO_TILE = 1 / 2.5;
  const SWEEP_DWELL_K = 0.32;
  const AZURE_EXPECTED_INTERCEPT = 1.81;
  const AZURE_EXPECTED_SLOPE = 28.47;
  const STUDS_PER_TILE = 3;

  const SCANNER_GEOMETRY = {
    'Ancient Scanner': { kind: 'sweep', convX: 1, convWidth: 2, beamY: 1.4, beamLenY: 0.125, beamWidthX: 0.2, speedCyc: 1.0345, conveyorSpeed: 15 / STUDS_PER_TILE },
    // Not a capgrader (not in SCANNER_NAMES), only here so the wiki's item
    // page can show its hit chance from the same formula.
    'Star Scanner': { kind: 'sweep', convX: 1, convWidth: 2, beamY: 1.3, beamLenY: 0.125, beamWidthX: 0.2, speedCyc: 0.159, conveyorSpeed: 12 / STUDS_PER_TILE },
    'Precision Ore Scanner': { kind: 'sweep', convX: 2, convWidth: 2, beamY: 1, beamLenY: 0.125, beamWidthX: 0.1, speedCyc: 1.0345, conveyorSpeed: 12 / STUDS_PER_TILE },
    'Azure Scanner': { kind: 'azure', guaranteedHitAtOrAboveRaw: 1.25 },
  };

  function predictSweepHitChance(cfg, oreSizeRaw, laneFrac = 0.5) {
    const oreSizeTiles = oreSizeRaw * ORE_TO_TILE;
    const oreR = oreSizeTiles / 2;
    const laneX = cfg.convX + laneFrac * cfg.convWidth;
    const dwell = (oreSizeTiles + cfg.beamLenY) / cfg.conveyorSpeed;
    const peakBeamSpeed = Math.PI * cfg.speedCyc * cfg.convWidth;
    const halfWidthEff = oreR + cfg.beamWidthX / 2 + SWEEP_DWELL_K * dwell * peakBeamSpeed;
    let lo = Math.max(laneX - halfWidthEff, cfg.convX);
    let hi = Math.min(laneX + halfWidthEff, cfg.convX + cfg.convWidth);
    if (hi <= lo) return 0;
    const uLo = (2 * (lo - cfg.convX)) / cfg.convWidth - 1;
    const uHi = (2 * (hi - cfg.convX)) / cfg.convWidth - 1;
    return (Math.asin(uHi) - Math.asin(uLo)) / Math.PI;
  }

  function predictAzureHitChance(oreSizeRaw) {
    if (oreSizeRaw >= SCANNER_GEOMETRY['Azure Scanner'].guaranteedHitAtOrAboveRaw) return 1;
    return Math.min(1, Math.max(0, (AZURE_EXPECTED_INTERCEPT + AZURE_EXPECTED_SLOPE * oreSizeRaw) / 100));
  }

  function scannerHitChance(name, oreSizeRaw, laneFrac = 0.5) {
    const geometry = SCANNER_GEOMETRY[name];
    if (!geometry) return 0;
    return geometry.kind === 'azure' ? predictAzureHitChance(oreSizeRaw) : predictSweepHitChance(geometry, oreSizeRaw, laneFrac);
  }

  // Shared with the wiki's scanner item pages (wiki-tool.js), so both tools
  // show the same hit chances from one copy of the formulas.
  globalThis.TycoonScanners = {
    geometry: SCANNER_GEOMETRY,
    hitChance: scannerHitChance,
    constants: { SWEEP_DWELL_K, AZURE_EXPECTED_INTERCEPT, AZURE_EXPECTED_SLOPE, ORE_TO_TILE, STUDS_PER_TILE },
  };

  // A blended expected-value multiplier (hitChance * mainStat + (1-hitChance))
  // is mathematically correct on average, but it's a fake number no single
  // ore ever actually has, and anything placed after a scanner in the chain
  // would be "starting from" a value that can't really happen — the ore
  // either got hit (jumps to before*mainStat) or it didn't (stays exactly
  // the same). Since this tool plans a physical belt layout, not a single
  // simulated ore, the fix is to place enough scanner UNITS in a row that a
  // hit is (for planning purposes) certain, then treat the chain as if that
  // one guaranteed hit happened — costing that many units' worth of
  // time/length, but producing a real, exact "before"/"after" pair for
  // whatever comes next. Uses the simple 1/hitChance rule of thumb (e.g. a
  // 30%-per-unit scanner needs 4 in a row) rather than a strict statistical
  // confidence bound — good enough for planning, and matches how a player
  // would actually reason about it in-game.
  function scanUnitsForGuarantee(hitChance) {
    if (hitChance >= 1) return 1;
    if (hitChance <= 0) return Infinity;
    return Math.ceil(1 / hitChance);
  }

  // ---- Item pools ---------------------------------------------------------

  // The runtime database (data/items.generated.js) only carries a single
  // `sheet` field per record (an item's primary sheet), not the richer
  // `sourceSheets` membership array that data/items.index.json has — so
  // Capgrader-sheet membership can't be detected from the loaded data here.
  // Hardcoded from that richer index instead (23 real capgraders; excludes
  // Nuclear Upgrader/Chartreuse Collider — destructive-effect items not
  // usable in this line — and the 3 scanners, kept as their own section).
  const CAPGRADER_NAMES = new Set([
    'Fusion Upgrader', 'Oil Well', 'Cookie Upgrader', '8-Ball Refiner', 'Desert Remains',
    'Martian Tech', 'Fairy Forest', 'Helio-Grader', 'Quad Rays Upgrader', 'Satellite Enhancer',
    'Orbital Messenger', 'Sugar Churner', 'Anchor Upgrader', 'Ore Purifier', 'Blocky Refiner',
    'Hydrothermal Vent', 'Observatory Refiner', 'Fine Point Upgrader', "Rubik's Polisher",
    'Rocketship Upgrader', 'Surfboard Polisher', 'Gumball Enhancer', 'Toybox Express',
    'Sunflower Fields', 'Fragrant Passage', 'Canyon Refiner', 'Fungal Enhancer', 'Glistening Falls',
  ]);
  const SCANNER_NAMES = new Set(['Ancient Scanner', 'Precision Ore Scanner', 'Azure Scanner']);

  function isCapgraderRecord(record) {
    return CAPGRADER_NAMES.has(record.name);
  }
  function isScannerCapgraderRecord(record) {
    return SCANNER_NAMES.has(record.name);
  }
  function isAdditiveRecord(record) {
    return record.type === 'upgrader' && normalize(record.mainStatType).includes('additive');
  }
  function isLunarLandingRecord(record) {
    return record.name === 'Lunar Landing';
  }
  function isDropperRecord(record) {
    return record.type === 'dropper';
  }

  const droppers = records.filter(isDropperRecord);
  const capgraderNames = [...new Set(records.filter(isCapgraderRecord).map((r) => r.name))].sort();
  const scannerNames = [...new Set(records.filter(isScannerCapgraderRecord).map((r) => r.name))].sort();
  const additiveNames = [...new Set(records.filter(isAdditiveRecord).map((r) => r.name))].sort();
  const lunarName = records.find(isLunarLandingRecord)?.name ?? null;

  // An item listed on multiple database sheets (e.g. an Upgraders entry that's
  // also on Capgrader and cited again on Crates for its source) produces one
  // near-duplicate record per sheet, differing only in `sheet`/`row` — keep
  // just the first record per variant.
  function variantsFor(name) {
    const seen = new Map();
    for (const record of records) {
      if (record.name === name && !seen.has(record.variant)) seen.set(record.variant, record);
    }
    return [...seen.values()];
  }

  // ---- Toggle state: Map<name, { owned, variantCounts }> -------------------
  // `variantCounts` is a plain object keyed by variant name, e.g.
  // `{ Base: 2, Shiny: null }` — a number is that many owned copies of that
  // specific variant, `null`/absent means "unlimited" (the default for any
  // variant the player hasn't explicitly set a count on). A variant is only
  // excluded from the search if its count is explicitly 0 — this is what
  // lets a player own, say, 2 Base + 1 Shiny of the same capgrader as two
  // independently-usable items, instead of collapsing to one "best" variant
  // for the whole chain (see the 2026-09-11 AI_HANDOFF entry on why this
  // matters: some legal chains only work by using a weaker variant first to
  // land precisely in a later capgrader's range, then a stronger one to
  // finish — impossible to find if only one variant is ever considered).

  // The player's "what matters" choices — see makeScorers(). restSeconds is
  // the travel time outside this capgrader section (dropper to chain, later
  // upgraders, into the furnace), needed for the 100-ore limit estimate.
  const priorities = { considerSpeed: true, considerDistance: true, restSeconds: 15 };

  const toggleState = new Map();
  function getToggle(name) {
    if (!toggleState.has(name)) toggleState.set(name, { owned: false, variantCounts: null });
    return toggleState.get(name);
  }

  // ---- Persistence: keep dropper rows + toggles across tool switches and
  // page reloads, same idea as app.js's plannerMode/activeTool storage -------

  const CAPGRADER_STORAGE_KEY = 'tycoon-sim-2:capgrader-tool:v1';

  function persistCapgraderState() {
    try {
      const toggles = [...toggleState.entries()].map(([name, toggle]) => [name, {
        owned: toggle.owned,
        variantCounts: toggle.variantCounts,
      }]);
      localStorage.setItem(CAPGRADER_STORAGE_KEY, JSON.stringify({ version: 2, dropperRows, nextRowId, toggles, priorities }));
    } catch {
      // Storage unavailable (private browsing, quota, etc.) — settings just won't persist.
    }
  }

  function restoreCapgraderState() {
    try {
      const saved = JSON.parse(localStorage.getItem(CAPGRADER_STORAGE_KEY));
      if (!saved) return;
      if (Array.isArray(saved.dropperRows) && saved.dropperRows.length) {
        dropperRows = saved.dropperRows;
        nextRowId = Number.isFinite(saved.nextRowId) ? saved.nextRowId : Math.max(...dropperRows.map((row) => row.id)) + 1;
      }
      if (saved.priorities && typeof saved.priorities === 'object') {
        priorities.considerSpeed = saved.priorities.considerSpeed !== false;
        priorities.considerDistance = saved.priorities.considerDistance !== false;
        const rest = Number(saved.priorities.restSeconds);
        if (Number.isFinite(rest) && rest >= 0) priorities.restSeconds = rest;
      }
      if (Array.isArray(saved.toggles)) {
        for (const [name, toggle] of saved.toggles) {
          if (saved.version === 2) {
            toggleState.set(name, {
              owned: Boolean(toggle.owned),
              variantCounts: toggle.variantCounts && typeof toggle.variantCounts === 'object' ? toggle.variantCounts : null,
            });
          } else {
            // Migrating from version 1 (one shared ownedCount + an
            // ownedVariants allow-list): apply that same count to every
            // variant that was allowed, and 0 to every variant that wasn't
            // — a reasonable one-time default, not a perfect equivalent,
            // since v1 could never actually distinguish "how many of each
            // variant" anyway. The player can refine per-variant counts
            // afterward same as anyone starting fresh.
            const allowed = Array.isArray(toggle.ownedVariants) ? new Set(toggle.ownedVariants) : null;
            const variantCounts = {};
            for (const record of variantsFor(name)) {
              variantCounts[record.variant] = !allowed || allowed.has(record.variant) ? (toggle.ownedCount ?? null) : 0;
            }
            toggleState.set(name, { owned: Boolean(toggle.owned), variantCounts });
          }
        }
      }
    } catch {
      // Corrupt/missing saved state — just start fresh.
    }
  }

  // How many of one specific variant the player told us they own — null
  // means unlimited (the default for a variant with no explicit count yet).
  function variantCount(toggle, variant) {
    const value = toggle.variantCounts?.[variant];
    return value == null ? null : value;
  }

  // Effective per-item-per-variant placement cap for the search: how many
  // copies of THIS SPECIFIC VARIANT the player can actually place = min(what
  // they told us they own of it, the item's own real limitedUses cap — e.g.
  // Ore Flamethrower is capped at 3 no matter what "unlimited" ownership
  // means). `limitedUses` is a BASE-GAME rule shared across every variant of
  // the item, not a per-variant allowance — a "Limited Uses: 1" item is only
  // ever usable once total, whether that one use is its Base or its Shiny
  // copy, never once each. Owned-copy counts, in contrast, genuinely are
  // per-variant (you can own 2 Base + 1 Shiny as distinguishable physical
  // items) — see useAllowed() below for how both constraints are enforced
  // together (per-variant owned cap AND the shared per-name limitedUses
  // cap, whichever binds first).
  function ownedVariantCap(record, toggle) {
    const owned = variantCount(toggle, record.variant);
    return owned == null ? Infinity : owned;
  }

  // Every variant the player hasn't explicitly zeroed out, as separate,
  // independently-usable records — used for capgraders, where mixing
  // variants of the same item within one chain is a real, legal strategy.
  function ownedVariantRecords(name, toggle) {
    return variantsFor(name).filter((record) => variantCount(toggle, record.variant) !== 0);
  }

  // Single "best" owned variant — still used for additives/Lunar Landing/
  // scanners, which (unlike capgraders) only ever get used once per chain
  // or as a one-off opening move, so there's no benefit to offering more
  // than the strongest legal choice.
  function bestOwnedVariant(name, toggle) {
    const allowed = ownedVariantRecords(name, toggle);
    if (!allowed.length) return null;
    const rank = ['Shiny Mythic', 'Mythic', 'Shiny', 'Base'];
    return [...allowed].sort((a, b) => rank.indexOf(a.variant) - rank.indexOf(b.variant))[0];
  }

  // ---- Deterministic item application (trimmed applyDeterministicItem) -----

  // `count` is how many physical copies of `record` this one move represents
  // — normally 1, but a scanner move places `scanUnitsForGuarantee(hitChance)`
  // units in a row so the single hit it then applies is a real, exact outcome
  // (see scanUnitsForGuarantee above) rather than a blended average. Time,
  // length, and uses all scale with `count`; the value transformation itself
  // does not (a "hit" is a hit regardless of how many units it took to get
  // one), except that scanners always apply their full mainStat exactly once.
  // Base and Shiny (etc.) copies of the same item are tracked as separate
  // usage buckets — see the toggle-state comment above for why (mixing
  // variants within one chain is a deliberate, legal strategy this tool
  // needs to be able to find).
  function usageKey(record) {
    return `${record.name}::${record.variant}`;
  }

  function applyItem(record, state, count = 1) {
    const before = state.value;
    let value = before;
    if (SCANNER_NAMES.has(record.name)) {
      value = before * Number(record.mainStat ?? 1);
    } else if (normalize(record.mainStatType).includes('additive')) {
      value = before + Number(record.mainStat ?? 0);
    } else {
      value = before * Number(record.mainStat ?? 1);
    }
    value = roundOreValue(value);
    let hasFire = state.hasFire;
    if (record.name === 'Ore Flamethrower') hasFire = true;
    if (record.name === 'Oasis Cleanser') hasFire = false;
    const timeSeconds = state.timeSeconds + crossingSeconds(record) * count;
    const length = state.length + record.size.length * count;
    const key = usageKey(record);
    const capacity = beltCapacity(record, state.oreSize);
    const slower = capacity < state.beltLimit;
    return {
      value,
      oreSize: state.oreSize,
      hasFire,
      timeSeconds,
      length,
      beltLimit: slower ? capacity : state.beltLimit,
      beltBottleneck: slower ? record : state.beltBottleneck,
      // Two separate counters: `uses` (per name+variant) enforces "you only
      // own N copies of THIS variant"; `nameUses` (per name only) enforces
      // the shared, base-game limitedUses cap across all variants combined
      // — see ownedVariantCap()'s comment for why both are needed.
      uses: { ...state.uses, [key]: (state.uses[key] ?? 0) + count },
      nameUses: { ...state.nameUses, [record.name]: (state.nameUses[record.name] ?? 0) + count },
      chain: [...state.chain, { record, before, after: value, count, timeAfter: timeSeconds, lengthAfter: length }],
    };
  }

  function useAllowed(record, state, toggle, count = 1) {
    const usedThisVariant = state.uses[usageKey(record)] ?? 0;
    if (usedThisVariant + count > ownedVariantCap(record, toggle)) return false;
    const usedThisName = state.nameUses[record.name] ?? 0;
    return usedThisName + count <= integerUseLimit(record.limitedUses);
  }

  function withinRange(record, value) {
    const range = parseRange(record.range);
    return range && value >= range.minimum && value <= range.maximum;
  }

  // ---- Legal item pool built from the current toggle state ------------------

  // A "finisher" capgrader has a range floor of 0 and a ceiling so far above
  // every normal, tiered capgrader's ceiling that it's effectively usable at
  // any value — Toybox Express (0-1 octillion) and Rubik's Polisher (0-1
  // septillion) are the only two in the current dataset. Because they're
  // single-use and legal almost anywhere, the beam search below used to grab
  // them opportunistically as mid-chain bridges between two narrower-range
  // capgraders, which "spends" a huge, once-only multiplier on a tiny base
  // value instead of the largest value the chain ever reaches. They're kept
  // out of the main search entirely and cascaded on top of its result
  // instead, so a normal (unlimited-use, narrower-range) capgrader has to do
  // the bridging job, freeing every finisher for the true end of the chain.
  const FINISHER_CEILING_THRESHOLD = 1e15;
  function isFinisherRecord(record) {
    const range = parseRange(record.range);
    return Boolean(range && range.minimum === 0 && range.maximum >= FINISHER_CEILING_THRESHOLD);
  }

  function legalPool() {
    const pool = { capgraders: [], finishers: [], additives: [], lunar: null, scanners: [] };
    for (const name of capgraderNames) {
      const toggle = getToggle(name);
      if (!toggle.owned) continue;
      // Every owned variant goes in as its own independently-usable
      // capgrader — NOT just the single "best" one — so the search can mix
      // e.g. Base and Shiny copies of the same item within one chain.
      for (const record of ownedVariantRecords(name, toggle)) {
        if (!parseRange(record.range)) continue;
        (isFinisherRecord(record) ? pool.finishers : pool.capgraders).push(record);
      }
    }
    for (const name of additiveNames) {
      const toggle = getToggle(name);
      if (!toggle.owned) continue;
      const record = bestOwnedVariant(name, toggle);
      if (record && Number.isFinite(record.mainStat)) pool.additives.push(record);
    }
    if (lunarName) {
      const toggle = getToggle(lunarName);
      if (toggle.owned) pool.lunar = bestOwnedVariant(lunarName, toggle);
    }
    for (const name of scannerNames) {
      const toggle = getToggle(name);
      if (!toggle.owned) continue;
      const record = bestOwnedVariant(name, toggle);
      if (record) pool.scanners.push(record);
    }
    return pool;
  }

  // ---- Search: ported/trimmed optimizeCapgraders ---------------------------

  function paretoKey(state) {
    return `${Math.round(Math.log10(Math.max(1, state.value)) * 100)}|${state.hasFire ? 'F' : ''}|${Object.entries(state.uses).sort().map(([n, c]) => `${n}:${c}`).join(',')}`;
  }
  function prune(states, width, score) {
    const best = new Map();
    for (const state of states) {
      const key = paretoKey(state);
      const prior = best.get(key);
      if (!prior || score(state) > score(prior)) best.set(key, state);
    }
    // Many survivors share the same value level and differ only in which
    // copies they used, so they crowd out other branches. Keeping just the
    // best few per value level leaves room in the beam for chains that are
    // lower at this depth but can climb more capgrader tiers later. Without
    // this, an "own everything" search missed a chain worth ~8x more
    // (2026-10-20).
    const perLevel = new Map();
    const diverse = [];
    for (const state of [...best.values()].sort((a, b) => score(b) - score(a))) {
      const level = Math.round(Math.log10(Math.max(1, state.value)) * 100);
      const kept = perLevel.get(level) ?? 0;
      if (kept >= PER_VALUE_LEVEL) continue;
      perLevel.set(level, kept + 1);
      diverse.push(state);
      if (diverse.length >= width) break;
    }
    return diverse;
  }
  const PER_VALUE_LEVEL = 2;

  const OASIS_NAME = 'Oasis Cleanser';
  const OIL_WELL_NAME = 'Oil Well';

  // Cap on how many times a single item can be batched into one candidate
  // move below — just a safety bound, real items exit their own range or use
  // cap long before this.
  const BATCH_REPEAT_CAP = 20;

  function candidateMoves(state, pool) {
    const moves = [];
    for (const record of pool.scanners) {
      if (!withinRange(record, state.value)) continue;
      const toggle = getToggle(record.name);
      const hitChance = scannerHitChance(record.name, state.oreSize);
      const unitsNeeded = scanUnitsForGuarantee(hitChance);
      // Not enough owned copies to guarantee a hit — this scanner can't be
      // used here at all (no partial/uncertain placement offered; see
      // scanUnitsForGuarantee above for why an exact outcome matters).
      if (!Number.isFinite(unitsNeeded) || !useAllowed(record, state, toggle, unitsNeeded)) continue;
      moves.push(applyItem(record, state, unitsNeeded));
    }
    const items = pool.capgraders;
    for (const record of items) {
      if (!withinRange(record, state.value)) continue;
      const toggle = getToggle(record.name);
      if (!useAllowed(record, state, toggle)) continue;
      if (record.name === OIL_WELL_NAME && state.hasFire) {
        const oasis = pool.additives.find((r) => r.name === OASIS_NAME);
        const oasisToggle = oasis ? getToggle(oasis.name) : null;
        if (oasis && useAllowed(oasis, state, oasisToggle)) {
          const afterOasis = applyItem(oasis, state);
          moves.push(applyItem(record, afterOasis));
        }
        continue; // never place Oil Well directly while on fire without Oasis first
      }
      // Offer applying this item once, AND (as separate candidate moves)
      // applying it 2, 3, ... times in a row while it's still legally within
      // its own range — an unlimited-use, wide-range item like Anchor
      // Upgrader or Surfboard Polisher can often be reused many times before
      // exiting its own range, and without this, each repeat use burns one
      // step of the search's limited depth budget just to keep reusing the
      // SAME item, starving the depth budget available to explore genuinely
      // different item choices deeper in the chain. Batching a same-item run
      // into one depth-step fixes that.
      let repeated = applyItem(record, state);
      moves.push(repeated);
      let repeatCount = 1;
      while (repeatCount < BATCH_REPEAT_CAP && withinRange(record, repeated.value) && useAllowed(record, repeated, toggle)) {
        repeated = applyItem(record, repeated);
        repeatCount += 1;
        moves.push(repeated);
      }
    }
    return moves;
  }

  // `options.considerSpeed` / `options.considerDistance` (both default true)
  // are the player's "do I care about chain time / chain length" toggles.
  // Both on = the original scoring (small time/length penalties keep chains
  // tidy) plus the ore-limit model above when `options.flow` is given. Speed
  // off drops the time penalty AND the ore-limit model; distance off drops
  // the length penalty. Both off = pure maximum final ore value.
  function makeScorers(options) {
    const considerSpeed = options.considerSpeed !== false;
    const considerDistance = options.considerDistance !== false;
    const flow = considerSpeed ? options.flow ?? null : null;
    const timeWeight = considerSpeed ? 1 : 0;
    const lengthWeight = considerDistance ? 1 : 0;
    // Tie-break only: among chains of equal value, prefer the shorter one.
    const tieBreak = (s) => (considerSpeed || considerDistance ? 0 : s.length * 1e-9);
    const throughput = (s) => (flow ? Math.log(Math.max(1e-9, oreFlow(s, flow).entriesPerSecond)) : 0);
    return {
      flow,
      search: (s) => Math.log(Math.max(1, s.value)) + throughput(s) - s.timeSeconds * 0.002 * timeWeight - s.length * 0.0002 * lengthWeight - tieBreak(s),
      terminal: (s) => (Math.log(Math.max(1, s.value)) + throughput(s)) * 100 - s.timeSeconds * 2 * timeWeight - s.length * 0.3 * lengthWeight - tieBreak(s),
    };
  }

  function optimizeCapgraderChain(initialValue, initialOreSize, pool, initialHasFire, options = {}) {
    const scorers = makeScorers(options);
    const initial = { value: initialValue, oreSize: initialOreSize, hasFire: initialHasFire, timeSeconds: 0, length: 0, beltLimit: Infinity, beltBottleneck: null, uses: {}, nameUses: {}, chain: [] };
    let openingStates = [initial];

    if (pool.lunar) {
      openingStates.push(applyItem(pool.lunar, initial));
    }
    const lunarGain = pool.lunar?.mainStat ?? 1;

    let additiveFrontier = [initial];
    for (let depth = 0; depth < 4; depth += 1) {
      const next = [];
      for (const state of additiveFrontier) {
        for (const additive of pool.additives) {
          if (additive.name === 'Ore Flamethrower' && !pool.additives.some((r) => r.name === OASIS_NAME)) continue;
          const toggle = getToggle(additive.name);
          if (!useAllowed(additive, state, toggle)) continue;
          const additiveGain = (state.value + additive.mainStat) / Math.max(1, state.value);
          const bestCapGain = pool.capgraders
            .filter((item) => withinRange(item, state.value))
            .reduce((best, item) => Math.max(best, item.mainStat), 1);
          if (additiveGain <= Math.max(lunarGain, bestCapGain)) continue;
          next.push(applyItem(additive, state));
        }
      }
      if (!next.length) break;
      openingStates.push(...next);
      additiveFrontier = prune(next, 60, scorers.search);
    }

    let frontier = openingStates;
    const terminals = [];
    const score = scorers.search;
    // Depth/width were originally 12/400 — too shallow once several
    // unlimited-use normal capgraders are all owned, since the truly best
    // chain often reuses 3-4 of them in a row before switching range tiers.
    // Bumping depth/width alone (tried up to 22/20000) plateaued short of the
    // real optimum, because comparing a state that took many small steps
    // against one that took few big steps, AT THE SAME DEPTH NUMBER, always
    // unfairly penalizes the "many small steps" branch — it just hasn't
    // caught up in value yet, so it gets pruned before it has a chance to pay
    // off. candidateMoves batching same-item reuse into one depth-step (see
    // above) fixes that directly, so a much smaller depth/width here is
    // actually enough to reliably match a far more exhaustive, unbatched
    // search, in a fraction of the time.
    for (let depth = 0; depth < 10; depth += 1) {
      const next = [];
      for (const state of frontier) {
        for (const candidate of candidateMoves(state, pool)) {
          terminals.push(candidate);
          if (!SCANNER_NAMES.has(candidate.chain[candidate.chain.length - 1].record.name)) next.push(candidate);
        }
      }
      if (!next.length) break;
      frontier = prune(next, options.beamWidth ?? 600, score);
    }

    if (!terminals.length) return { chain: [], finalValue: initialValue, flow: scorers.flow ? oreFlow(initial, scorers.flow) : null, bottleneck: null };
    // Finishers (see isFinisherRecord above) never appear in `terminals` — they're
    // excluded from candidateMoves entirely — so picking the highest-value terminal
    // here (lightly discounted for time/length, same reasoning as the tuning above)
    // directly maximizes the base the finisher cascade below multiplies from.
    // Weights of time*10/length*1 (tuned to stop the search padding a chain for
    // a sub-1% value gain) turned out to overcorrect: a real, legal extra step
    // — e.g. a Fusion Upgrader application that was still fully in-range and
    // worth +21% value — could lose to NOT taking it, because a couple of
    // extra seconds/tiles cost more raw score than a double-digit-percent
    // value gain was worth under those weights. time*2/length*0.3 keeps the
    // original sub-1%-gain case correctly rejected (extra cost still dwarfs
    // the log-value gain there) while letting genuinely worthwhile extra
    // steps win instead of being discarded for a minor space/time cost.
    // When speed and/or distance are toggled off (makeScorers), the matching
    // penalty below is zeroed, so the pick leans fully on value (+ throughput).
    const terminalScore = scorers.terminal;
    let best = terminals.sort((a, b) => terminalScore(b) - terminalScore(a))[0];
    // Cascade every owned, still-eligible finisher on top, in ascending mainStat
    // order — order among finisher NAMES never affects the total (each has
    // a range floor of 0, so none of them can be blocked by an earlier one's
    // result) and there's nothing after this to keep in range for.
    //
    // pool.finishers can now hold multiple variant-records per name (see the
    // 2026-09-11 variant-mixing change) — but a finisher's range floor is
    // always 0, so unlike a normal capgrader there's never a range reason to
    // prefer a weaker variant. Always apply the single strongest owned
    // variant per name, never split a shared limitedUses budget across
    // variants here (that would waste it on the weaker one first — a real
    // bug this fixed: Rubik's Polisher/Toybox Express are both
    // limitedUses:1, so naively trying Base before Shiny in mainStat order
    // burned the one shared use on Base and Shiny never got a turn).
    const variantRank = ['Shiny Mythic', 'Mythic', 'Shiny', 'Base'];
    const bestFinisherVariant = (name) => pool.finishers
      .filter((r) => r.name === name)
      .sort((a, b) => variantRank.indexOf(a.variant) - variantRank.indexOf(b.variant))[0];
    const finisherNames = [...new Set(pool.finishers.map((r) => r.name))]
      .sort((a, b) => bestFinisherVariant(a).mainStat - bestFinisherVariant(b).mainStat);
    for (const name of finisherNames) {
      const finisher = bestFinisherVariant(name);
      const toggle = getToggle(name);
      while (withinRange(finisher, best.value) && useAllowed(finisher, best, toggle)) {
        best = applyItem(finisher, best);
      }
    }
    return {
      chain: best.chain,
      finalValue: best.value,
      flow: scorers.flow ? oreFlow(best, scorers.flow) : null,
      bottleneck: best.beltBottleneck,
    };
  }

  // Exposes the search internals for tests/capgrader-generator.test.mjs to
  // call directly against this real shipped file (rather than a hand-written
  // reimplementation, which risks silently testing a subtly different
  // algorithm than the one that actually runs) — see AI_HANDOFF.md "How this
  // was debugged" under the 2026-08-26 Capgrader Generator entry. No-op in
  // the browser beyond this one property assignment.
  globalThis.__cgDebug = { legalPool, optimizeCapgraderChain, getToggle, capgraderNames, additiveNames, scannerNames, lunarName, beltCapacity, oreFlow, variantsFor };

  // ---- UI: dropper rows -----------------------------------------------------

  const dropperRowsEl = document.querySelector('#capgrader-dropper-rows');
  const addDropperButton = document.querySelector('#capgrader-add-dropper');
  const spreadWarningEl = document.querySelector('#capgrader-spread-warning');
  const generateButton = document.querySelector('#capgrader-generate');
  const editSetupButton = document.querySelector('#capgrader-edit-setup');
  const capgraderLayoutEl = document.querySelector('#capgrader-layout');
  const resultsEl = document.querySelector('#capgrader-results');

  // After generating, the setup panels (droppers/capgraders/additives/
  // scanners) get out of the way so the result can be read without a busy
  // toggle-list wall around it — "Edit setup" brings them back.
  function setResultsMode(isResultsMode) {
    capgraderLayoutEl?.classList.toggle('is-results-only', isResultsMode);
    if (generateButton) generateButton.hidden = isResultsMode;
    if (editSetupButton) editSetupButton.hidden = !isResultsMode;
    // Going back to "Edit setup" must hide the previous run's table, not just
    // bring the setup panels back — otherwise stale results stay visible
    // alongside the toggle lists until the next Generate.
    if (resultsEl) resultsEl.hidden = !isResultsMode;
  }
  editSetupButton?.addEventListener('click', () => setResultsMode(false));

  // Three independent toggle lists (capgraders / additives+Lunar / scanners),
  // each with its own search + select-all/none, sharing the same behavior.
  const toggleLists = {
    capgrader: {
      listEl: document.querySelector('#capgrader-toggle-list'),
      searchInput: document.querySelector('#capgrader-toggle-search'),
      emptyNote: document.querySelector('#capgrader-toggle-empty'),
      selectAllButton: document.querySelector('#capgrader-toggle-select-all'),
      selectNoneButton: document.querySelector('#capgrader-toggle-select-none'),
    },
    additive: {
      listEl: document.querySelector('#capgrader-additive-list'),
      searchInput: document.querySelector('#capgrader-additive-search'),
      emptyNote: document.querySelector('#capgrader-additive-empty'),
      selectAllButton: document.querySelector('#capgrader-additive-select-all'),
      selectNoneButton: document.querySelector('#capgrader-additive-select-none'),
    },
    scanner: {
      listEl: document.querySelector('#capgrader-scanner-list'),
      searchInput: null,
      emptyNote: null,
      selectAllButton: document.querySelector('#capgrader-scanner-select-all'),
      selectNoneButton: document.querySelector('#capgrader-scanner-select-none'),
    },
  };
  Object.values(toggleLists).forEach((group) => {
    group.panelEl = group.listEl?.closest('.capgrader-panel') ?? null;
  });

  // A panel gets the "accent" (green) treatment only once something inside it
  // is actually owned — the scanner panel used to be green by default, which
  // was misleading since scanners are a last-resort fallback, not something to
  // reach for. Now all three toggle panels behave the same way.
  function updatePanelAccent(group) {
    if (!group.panelEl || !group.listEl) return;
    const anyOwned = [...group.listEl.querySelectorAll('.capgrader-toggle-item')].some((item) => item.classList.contains('is-owned'));
    group.panelEl.classList.toggle('capgrader-panel-accent', anyOwned);
  }

  function updateAllPanelAccents() {
    Object.values(toggleLists).forEach(updatePanelAccent);
  }

  let dropperRows = [{ id: 1 }];
  let nextRowId = 2;

  function dropperOptionsHtml(selectedName) {
    const names = [...new Set(droppers.map((r) => r.name))].sort();
    return names.map((name) => `<option value="${name}" ${name === selectedName ? 'selected' : ''}>${name}</option>`).join('');
  }
  function variantOptionsHtml(name, selectedVariant) {
    return variantsFor(name).map((r) => `<option value="${r.variant}" ${r.variant === selectedVariant ? 'selected' : ''}>${r.variant}</option>`).join('');
  }

  function renderDropperRows() {
    if (!dropperRowsEl) return;
    dropperRowsEl.innerHTML = '';
    dropperRows.forEach((row, index) => {
      const names = [...new Set(droppers.map((r) => r.name))].sort();
      row.name = row.name ?? names[0];
      row.variant = row.variant ?? variantsFor(row.name)[0]?.variant ?? 'Base';
      const wrap = document.createElement('div');
      wrap.className = 'capgrader-dropper-row';
      wrap.innerHTML = `
        <select data-row-id="${row.id}" data-field="name" aria-label="Dropper">${dropperOptionsHtml(row.name)}</select>
        <select data-row-id="${row.id}" data-field="variant" aria-label="Dropper variant">${variantOptionsHtml(row.name, row.variant)}</select>
        ${priorities.considerSpeed ? `<label class="capgrader-dropper-count">&times; <input type="number" min="1" step="1" data-row-id="${row.id}" data-field="count" value="${dropperCount(row)}" aria-label="How many of this dropper" /></label>` : ''}
        ${dropperRows.length > 1 ? `<button type="button" data-remove-row="${row.id}">Remove</button>` : ''}
      `;
      dropperRowsEl.appendChild(wrap);
    });
    dropperRowsEl.querySelectorAll('select[data-field="name"]').forEach((select) => {
      select.addEventListener('change', () => {
        const row = dropperRows.find((r) => r.id === Number(select.dataset.rowId));
        row.name = select.value;
        row.variant = variantsFor(row.name)[0]?.variant ?? 'Base';
        renderDropperRows();
        updateSpreadWarning();
        persistCapgraderState();
      });
    });
    dropperRowsEl.querySelectorAll('select[data-field="variant"]').forEach((select) => {
      select.addEventListener('change', () => {
        const row = dropperRows.find((r) => r.id === Number(select.dataset.rowId));
        row.variant = select.value;
        updateSpreadWarning();
        persistCapgraderState();
      });
    });
    dropperRowsEl.querySelectorAll('input[data-field="count"]').forEach((input) => {
      input.addEventListener('input', () => {
        const row = dropperRows.find((r) => r.id === Number(input.dataset.rowId));
        const count = Math.floor(Number(input.value));
        row.count = Number.isFinite(count) && count >= 1 ? count : 1;
        persistCapgraderState();
      });
    });
    dropperRowsEl.querySelectorAll('[data-remove-row]').forEach((button) => {
      button.addEventListener('click', () => {
        dropperRows = dropperRows.filter((r) => r.id !== Number(button.dataset.removeRow));
        renderDropperRows();
        updateSpreadWarning();
        persistCapgraderState();
      });
    });
  }

  // How many copies of this dropper feed the line — only used for the
  // 100-ore limit / belt-flow estimate (total drop rate), not the chain itself.
  function dropperCount(row) {
    const count = Math.floor(Number(row.count));
    return Number.isFinite(count) && count >= 1 ? count : 1;
  }

  function totalDropRate(rows) {
    return rows.reduce((total, row) => {
      const record = variantsFor(row.name).find((r) => r.variant === row.variant);
      const dropSpeed = Number(record?.dropSpeed);
      return total + (Number.isFinite(dropSpeed) && dropSpeed > 0 ? dropSpeed : 0) * dropperCount(row);
    }, 0);
  }

  function dropperStartingValue(row) {
    const record = variantsFor(row.name).find((r) => r.variant === row.variant);
    return record ? Number(record.mainStat) : null;
  }

  function updateSpreadWarning() {
    if (!spreadWarningEl) return;
    const values = dropperRows.map(dropperStartingValue).filter((v) => Number.isFinite(v) && v > 0);
    if (values.length < 2) {
      spreadWarningEl.hidden = true;
      return;
    }
    const spread = Math.max(...values) / Math.min(...values);
    if (spread < 3) {
      spreadWarningEl.hidden = true;
      return;
    }
    const severity = spread >= 10 ? 'This is a big gap' : 'This is a moderate gap';
    spreadWarningEl.hidden = false;
    spreadWarningEl.textContent = `${severity} — your droppers start ${compactNumber(Math.min(...values))} to ${compactNumber(Math.max(...values))} apart (${spread.toFixed(1)}x). The wider that gap, the more capgraders (and space) it takes to cover all of them in one shared chain. Consider narrowing your dropper selection if you want a tighter, cheaper section.`;
  }

  addDropperButton?.addEventListener('click', () => {
    dropperRows.push({ id: nextRowId });
    nextRowId += 1;
    renderDropperRows();
    updateSpreadWarning();
    persistCapgraderState();
  });

  // ---- UI: "what matters" priorities ---------------------------------------

  const priorityButtons = {
    considerSpeed: document.querySelector('#capgrader-priority-speed'),
    considerDistance: document.querySelector('#capgrader-priority-distance'),
  };
  const oreLimitFieldsEl = document.querySelector('#capgrader-ore-limit-fields');
  const restSecondsInput = document.querySelector('#capgrader-rest-seconds');
  const priorityNoteEl = document.querySelector('#capgrader-priority-note');

  function priorityNoteText() {
    const { considerSpeed, considerDistance } = priorities;
    if (considerSpeed && considerDistance) return 'Balances ore value against chain time, length, and the 100-ore limit.';
    if (considerSpeed) return "Length is ignored — a longer chain is fine as long as it isn't slower or bad for the 100-ore limit.";
    if (considerDistance) return "Time is ignored — slow items and the 100-ore limit don't count against a chain, only its length.";
    return 'Time, length, and the 100-ore limit are all ignored — the chain just ends with as much ore value as possible.';
  }

  function syncPriorityDom() {
    for (const [key, button] of Object.entries(priorityButtons)) {
      if (!button) continue;
      button.setAttribute('aria-pressed', String(priorities[key]));
      button.textContent = priorities[key] ? 'On' : 'Off';
    }
    if (oreLimitFieldsEl) oreLimitFieldsEl.hidden = !priorities.considerSpeed;
    if (restSecondsInput) restSecondsInput.value = String(priorities.restSeconds);
    if (priorityNoteEl) priorityNoteEl.textContent = priorityNoteText();
  }

  for (const [key, button] of Object.entries(priorityButtons)) {
    button?.addEventListener('click', () => {
      priorities[key] = !priorities[key];
      syncPriorityDom();
      // The dropper count only feeds the ore-limit estimate, so it's only
      // shown (and asked for) while Speed is on.
      if (key === 'considerSpeed') renderDropperRows();
      persistCapgraderState();
    });
  }
  restSecondsInput?.addEventListener('input', () => {
    const rest = Number(restSecondsInput.value);
    priorities.restSeconds = Number.isFinite(rest) && rest >= 0 ? rest : 0;
    persistCapgraderState();
  });

  // ---- UI: toggle lists -------------------------------------------------

  function toggleItemHtml(name, rangeText) {
    return `
      <div class="capgrader-toggle-item" data-toggle-item="${name}">
        <span class="capgrader-toggle-name">${name}</span>
        ${rangeText ? `<span class="capgrader-toggle-range">${rangeText}</span>` : ''}
        <button type="button" class="capgrader-toggle-pill" data-toggle-name="${name}" aria-pressed="false">Off</button>
        <div class="capgrader-toggle-options" data-variant-counts="${name}"></div>
      </div>
    `;
  }

  function groupLabelHtml(text) {
    return `<div class="capgrader-toggle-group-label">${text}</div>`;
  }

  function groupForElement(el) {
    return Object.values(toggleLists).find((group) => group.listEl?.contains(el));
  }

  function renderToggleLists() {
    if (toggleLists.capgrader.listEl) {
      toggleLists.capgrader.listEl.innerHTML = capgraderNames.map((name) => toggleItemHtml(name, variantsFor(name)[0]?.range)).join('');
    }
    if (toggleLists.additive.listEl) {
      toggleLists.additive.listEl.innerHTML = [
        groupLabelHtml(`Additive upgraders (${additiveNames.length})`),
        ...additiveNames.map((name) => toggleItemHtml(name)),
        ...(lunarName ? [groupLabelHtml('Lunar Landing'), toggleItemHtml(lunarName)] : []),
      ].join('');
    }
    if (toggleLists.scanner.listEl) {
      toggleLists.scanner.listEl.innerHTML = scannerNames.map((name) => toggleItemHtml(name, variantsFor(name)[0]?.range)).join('');
    }
    document.querySelectorAll('[data-toggle-name]').forEach((button) => {
      button.addEventListener('click', () => {
        const name = button.dataset.toggleName;
        const toggle = getToggle(name);
        toggle.owned = !toggle.owned;
        button.setAttribute('aria-pressed', String(toggle.owned));
        button.textContent = toggle.owned ? 'On' : 'Off';
        const item = document.querySelector(`[data-toggle-item="${CSS.escape(name)}"]`);
        item?.classList.toggle('is-owned', toggle.owned);
        if (toggle.owned) renderVariantCounts(name);
        if (item) updatePanelAccent(groupForElement(item));
        persistCapgraderState();
      });
    });
  }

  // ---- Search filter — applies to whichever list has a search box wired -----

  function applyListSearch(group) {
    const { listEl, searchInput, emptyNote } = group;
    if (!listEl || !searchInput) return;
    const query = normalize(searchInput.value ?? '');
    const items = [...listEl.querySelectorAll('.capgrader-toggle-item')];
    let anyVisible = false;
    for (const item of items) {
      const matches = !query || normalize(item.dataset.toggleItem).includes(query);
      item.classList.toggle('is-search-hidden', !matches);
      if (matches) anyVisible = true;
    }
    // Hide a group label whenever every item under it (up to the next label) is hidden.
    const nodes = [...listEl.children];
    let currentLabel = null;
    let currentLabelHasVisible = false;
    for (const node of nodes) {
      if (node.classList.contains('capgrader-toggle-group-label')) {
        if (currentLabel) currentLabel.classList.toggle('is-search-hidden', !currentLabelHasVisible);
        currentLabel = node;
        currentLabelHasVisible = false;
      } else if (node.classList.contains('capgrader-toggle-item') && !node.classList.contains('is-search-hidden')) {
        currentLabelHasVisible = true;
      }
    }
    if (currentLabel) currentLabel.classList.toggle('is-search-hidden', !currentLabelHasVisible);
    if (emptyNote) emptyNote.hidden = anyVisible || !items.length;
  }

  function applyAllSearches() {
    Object.values(toggleLists).forEach(applyListSearch);
  }

  Object.values(toggleLists).forEach((group) => {
    group.searchInput?.addEventListener('input', () => applyListSearch(group));
  });

  // ---- Select all / deselect all (acts on currently-visible items only, so
  // it composes with the search filter — e.g. search "scanner" then select all) --

  function setOwnedForVisibleItems(container, owned) {
    const items = container ? [...container.querySelectorAll('.capgrader-toggle-item')] : [];
    for (const item of items) {
      if (item.classList.contains('is-search-hidden')) continue;
      const button = item.querySelector('[data-toggle-name]');
      const toggle = getToggle(item.dataset.toggleItem);
      if (toggle.owned === owned) continue;
      toggle.owned = owned;
      button.setAttribute('aria-pressed', String(owned));
      button.textContent = owned ? 'On' : 'Off';
      item.classList.toggle('is-owned', owned);
      if (owned) renderVariantCounts(item.dataset.toggleItem);
    }
    updatePanelAccent(groupForElement(container));
    persistCapgraderState();
  }

  Object.values(toggleLists).forEach((group) => {
    group.selectAllButton?.addEventListener('click', () => setOwnedForVisibleItems(group.listEl, true));
    group.selectNoneButton?.addEventListener('click', () => setOwnedForVisibleItems(group.listEl, false));
  });

  // Re-applies already-known toggle state onto freshly-rendered "Off" markup —
  // used after restoring saved settings, since renderToggleLists() always
  // builds each item starting from scratch.
  function syncToggleDomToState() {
    document.querySelectorAll('[data-toggle-name]').forEach((button) => {
      const name = button.dataset.toggleName;
      const toggle = getToggle(name);
      button.setAttribute('aria-pressed', String(toggle.owned));
      button.textContent = toggle.owned ? 'On' : 'Off';
      const item = document.querySelector(`[data-toggle-item="${CSS.escape(name)}"]`);
      item?.classList.toggle('is-owned', toggle.owned);
      if (toggle.owned) renderVariantCounts(name);
    });
    updateAllPanelAccents();
  }

  // One number input per variant the item has (Base/Shiny/Mythic/Shiny
  // Mythic, whichever actually exist) — blank means unlimited, 0 excludes
  // that variant from the search entirely, any other number is an exact
  // owned-copy cap for just that variant. Each is tracked independently so
  // a chain can legally mix e.g. Base and Shiny copies of the same item.
  function renderVariantCounts(name) {
    const container = document.querySelector(`[data-variant-counts="${CSS.escape(name)}"]`);
    if (!container) return;
    const toggle = getToggle(name);
    const variants = variantsFor(name).map((r) => r.variant);
    container.innerHTML = variants.map((variant) => `
      <label class="is-${variant.toLowerCase().replace(/\s+/g, '-')}">${variant} <input type="number" min="0" step="1" placeholder="unlimited"
        data-variant-count-name="${name}" data-variant-count-variant="${variant}"
        value="${variantCount(toggle, variant) ?? ''}" /></label>
    `).join('');
    container.querySelectorAll('input[type="number"]').forEach((input) => {
      input.addEventListener('input', () => {
        toggle.variantCounts = toggle.variantCounts ?? {};
        toggle.variantCounts[input.dataset.variantCountVariant] = input.value === '' ? null : Math.max(0, Number(input.value));
        persistCapgraderState();
      });
    });
  }

  // ---- Results rendering --------------------------------------------------

  // Shiny badges get one small sparkle that twinkles at a random spot inside
  // the badge, one at a time, with a random pause between twinkles (capped
  // so it never goes too long between sparkles).
  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function scheduleSparkle(el) {
    const pauseMs = randomBetween(300, 2200);
    setTimeout(() => {
      el.style.left = `${randomBetween(12, 82)}%`;
      el.style.top = `${randomBetween(15, 75)}%`;
      el.classList.add('is-active');
    }, pauseMs);
  }

  document.addEventListener('animationend', (event) => {
    if (!event.target.classList?.contains('capgrader-sparkle')) return;
    event.target.classList.remove('is-active');
    scheduleSparkle(event.target);
  });

  function initSparkles(root) {
    root.querySelectorAll('.capgrader-sparkle').forEach(scheduleSparkle);
  }

  function flowSummaryHtml(result) {
    if (!result.flow) return '';
    const { entriesPerSecond, activeOres, limitedBy } = result.flow;
    const oresText = `about ${Math.round(activeOres)} ores on your base${activeOres > ORE_CAP ? ` (capped at ${ORE_CAP})` : ''}`;
    let note = `${oresText} · ~${entriesPerSecond.toFixed(2)} ores/sec reach the furnace`;
    if (limitedBy === 'ore limit') note += ' — limited by the 100-ore limit, so a slower chain costs cash/min here';
    if (limitedBy === 'belt speed' && result.bottleneck) note += ` — limited by ${result.bottleneck.name}'s slow conveyor (speed ${result.bottleneck.conveyorSpeed})`;
    return `<p class="capgrader-flow-note">${note}</p>`;
  }

  function renderResultTable(dropperLabel, chain, startingValue, result = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'capgrader-result-table-wrap';
    const rows = chain.map((entry) => `
      <tr>
        <td>${entry.record.name}${entry.count > 1 ? ` &times;${entry.count}` : ''}</td>
        <td><span class="capgrader-variant-badge ${entry.record.variant.includes('Shiny') ? 'is-shiny' : 'is-base'}">${entry.record.variant}${entry.record.variant.includes('Shiny') ? '<span class="capgrader-sparkle"></span>' : ''}</span></td>
        <td>${compactNumber(entry.before)}</td>
        <td>${compactNumber(entry.after)}</td>
        <td>${entry.timeAfter.toFixed(1)}s</td>
        <td>${entry.lengthAfter} tiles</td>
      </tr>
    `).join('');
    wrap.innerHTML = `
      <p class="capgrader-result-heading">${dropperLabel} — starting at ${compactNumber(startingValue)}</p>
      ${flowSummaryHtml(result)}
      <div class="capgrader-result-table-scroll">
        <table class="capgrader-result-table">
          <thead><tr><th>Upgrader</th><th>Variant</th><th>Value before</th><th>Value after</th><th>Time</th><th>Length</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">No legal capgrader chain found — toggle on more items you own.</td></tr>'}</tbody>
        </table>
      </div>
    `;
    initSparkles(wrap);
    return wrap;
  }

  function runGenerate() {
    if (!resultsEl) return;
    resultsEl.innerHTML = '';
    const pool = legalPool();
    const validRows = dropperRows.filter((row) => Number.isFinite(dropperStartingValue(row)));
    if (!validRows.length) {
      resultsEl.innerHTML = '<p class="capgrader-empty-note">Pick at least one dropper first.</p>';
      return;
    }
    setResultsMode(true);
    // Every dropper row feeds the same line, so the ore limit and belt flow
    // use the combined drop rate of all of them.
    const options = {
      considerSpeed: priorities.considerSpeed,
      considerDistance: priorities.considerDistance,
      flow: { dropRate: totalDropRate(validRows), restSeconds: priorities.restSeconds },
    };
    for (const row of validRows) {
      const record = variantsFor(row.name).find((r) => r.variant === row.variant);
      const startingValue = Number(record.mainStat);
      const oreSize = Number(record.oreSize ?? 1);
      const startsOnFire = row.name === 'Fire Crystal Dropper';
      const result = optimizeCapgraderChain(startingValue, oreSize, pool, startsOnFire, options);
      resultsEl.appendChild(renderResultTable(`${row.name} (${row.variant})`, result.chain, startingValue, result));
    }
  }

  generateButton?.addEventListener('click', runGenerate);

  // ---- Init ----------------------------------------------------------------

  let initialized = false;
  function initCapgraderTool() {
    if (initialized) return;
    initialized = true;
    restoreCapgraderState();
    renderDropperRows();
    renderToggleLists();
    syncToggleDomToState();
    syncPriorityDom();
    applyAllSearches();
    updateSpreadWarning();
  }
  document.addEventListener('capgrader-tool:activated', initCapgraderTool);
  if (!document.querySelector('#capgrader-tool')?.hidden) initCapgraderTool();
})();
