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

  function scannerHitChance(name, oreSizeRaw) {
    const geometry = SCANNER_GEOMETRY[name];
    if (!geometry) return 0;
    return geometry.kind === 'azure' ? predictAzureHitChance(oreSizeRaw) : predictSweepHitChance(geometry, oreSizeRaw);
  }

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
    'Hydrothermal Vent', 'Observatory Refiner', 'Fine Point Upgrader', "Rubix's Polisher",
    'Rocketship Upgrader', 'Surfboard Polisher', 'Gumball Enhancer', 'Toybox Express',
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

  // ---- Toggle state: Map<name, { owned, ownedCount, ownedVariants }> -------

  const toggleState = new Map();
  function getToggle(name) {
    if (!toggleState.has(name)) toggleState.set(name, { owned: false, ownedCount: null, ownedVariants: null });
    return toggleState.get(name);
  }

  // ---- Persistence: keep dropper rows + toggles across tool switches and
  // page reloads, same idea as app.js's plannerMode/activeTool storage -------

  const CAPGRADER_STORAGE_KEY = 'tycoon-sim-2:capgrader-tool:v1';

  function persistCapgraderState() {
    try {
      const toggles = [...toggleState.entries()].map(([name, toggle]) => [name, {
        owned: toggle.owned,
        ownedCount: toggle.ownedCount,
        ownedVariants: toggle.ownedVariants ? [...toggle.ownedVariants] : null,
      }]);
      localStorage.setItem(CAPGRADER_STORAGE_KEY, JSON.stringify({ version: 1, dropperRows, nextRowId, toggles }));
    } catch {
      // Storage unavailable (private browsing, quota, etc.) — settings just won't persist.
    }
  }

  function restoreCapgraderState() {
    try {
      const saved = JSON.parse(localStorage.getItem(CAPGRADER_STORAGE_KEY));
      if (!saved || saved.version !== 1) return;
      if (Array.isArray(saved.dropperRows) && saved.dropperRows.length) {
        dropperRows = saved.dropperRows;
        nextRowId = Number.isFinite(saved.nextRowId) ? saved.nextRowId : Math.max(...dropperRows.map((row) => row.id)) + 1;
      }
      if (Array.isArray(saved.toggles)) {
        for (const [name, toggle] of saved.toggles) {
          toggleState.set(name, {
            owned: Boolean(toggle.owned),
            ownedCount: toggle.ownedCount ?? null,
            ownedVariants: Array.isArray(toggle.ownedVariants) ? new Set(toggle.ownedVariants) : null,
          });
        }
      }
    } catch {
      // Corrupt/missing saved state — just start fresh.
    }
  }

  // Effective per-item placement cap for the search: how many copies the
  // player can actually place = min(what they told us they own, the item's
  // own real limitedUses cap — e.g. Ore Flamethrower is capped at 3 no matter
  // what "unlimited" ownership means).
  function effectiveCap(record, toggle) {
    const owned = toggle.ownedCount == null ? Infinity : toggle.ownedCount;
    return Math.min(owned, integerUseLimit(record.limitedUses));
  }

  function bestOwnedVariant(name, toggle) {
    const all = variantsFor(name);
    const rank = ['Shiny Mythic', 'Mythic', 'Shiny', 'Base'];
    const allowed = toggle.ownedVariants ? all.filter((r) => toggle.ownedVariants.has(r.variant)) : all;
    if (!allowed.length) return null;
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
    return {
      value,
      oreSize: state.oreSize,
      hasFire,
      timeSeconds,
      length,
      uses: { ...state.uses, [record.name]: (state.uses[record.name] ?? 0) + count },
      chain: [...state.chain, { record, before, after: value, count, timeAfter: timeSeconds, lengthAfter: length }],
    };
  }

  function useAllowed(record, state, toggle, count = 1) {
    const used = state.uses[record.name] ?? 0;
    return used + count <= effectiveCap(record, toggle);
  }

  function withinRange(record, value) {
    const range = parseRange(record.range);
    return range && value >= range.minimum && value <= range.maximum;
  }

  // ---- Legal item pool built from the current toggle state ------------------

  // A "finisher" capgrader has a range floor of 0 and a ceiling so far above
  // every normal, tiered capgrader's ceiling that it's effectively usable at
  // any value — Toybox Express (0-1 octillion) and Rubix's Polisher (0-1
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
      const record = bestOwnedVariant(name, toggle);
      if (!record || !parseRange(record.range)) continue;
      (isFinisherRecord(record) ? pool.finishers : pool.capgraders).push(record);
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
    return [...best.values()].sort((a, b) => score(b) - score(a)).slice(0, width);
  }

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

  function optimizeCapgraderChain(initialValue, initialOreSize, pool, initialHasFire) {
    const initial = { value: initialValue, oreSize: initialOreSize, hasFire: initialHasFire, timeSeconds: 0, length: 0, uses: {}, chain: [] };
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
      additiveFrontier = prune(next, 60, (s) => Math.log(Math.max(1, s.value)) - s.timeSeconds * 0.002 - s.length * 0.0002);
    }

    let frontier = openingStates;
    const terminals = [];
    const score = (s) => Math.log(Math.max(1, s.value)) - s.timeSeconds * 0.002 - s.length * 0.0002;
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
      frontier = prune(next, 2000, score);
    }

    if (!terminals.length) return { chain: [], finalValue: initialValue };
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
    const terminalScore = (s) => Math.log(Math.max(1, s.value)) * 100 - s.timeSeconds * 2 - s.length * 0.3;
    let best = terminals.sort((a, b) => terminalScore(b) - terminalScore(a))[0];
    // Cascade every owned, still-eligible finisher on top, in ascending mainStat
    // order — order among finishers themselves never affects the total (each has
    // a range floor of 0, so none of them can be blocked by an earlier one's
    // result) and there's nothing after this to keep in range for.
    for (const finisher of [...pool.finishers].sort((a, b) => a.mainStat - b.mainStat)) {
      const toggle = getToggle(finisher.name);
      if (withinRange(finisher, best.value) && useAllowed(finisher, best, toggle)) {
        best = applyItem(finisher, best);
      }
    }
    return { chain: best.chain, finalValue: best.value };
  }

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
    dropperRowsEl.querySelectorAll('[data-remove-row]').forEach((button) => {
      button.addEventListener('click', () => {
        dropperRows = dropperRows.filter((r) => r.id !== Number(button.dataset.removeRow));
        renderDropperRows();
        updateSpreadWarning();
        persistCapgraderState();
      });
    });
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

  // ---- UI: toggle lists -------------------------------------------------

  function toggleItemHtml(name, rangeText) {
    return `
      <div class="capgrader-toggle-item" data-toggle-item="${name}">
        <span class="capgrader-toggle-name">${name}</span>
        ${rangeText ? `<span class="capgrader-toggle-range">${rangeText}</span>` : ''}
        <button type="button" class="capgrader-toggle-pill" data-toggle-name="${name}" aria-pressed="false">Off</button>
        <div class="capgrader-toggle-options">
          <label>Owned count <input type="number" min="0" step="1" placeholder="unlimited" data-count-name="${name}" /></label>
          <span class="capgrader-toggle-variants" data-variants-name="${name}"></span>
        </div>
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
        if (toggle.owned) renderVariantCheckboxes(name);
        if (item) updatePanelAccent(groupForElement(item));
        persistCapgraderState();
      });
    });
    document.querySelectorAll('[data-count-name]').forEach((input) => {
      input.addEventListener('input', () => {
        const toggle = getToggle(input.dataset.countName);
        toggle.ownedCount = input.value === '' ? null : Math.max(0, Number(input.value));
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
      if (owned) renderVariantCheckboxes(item.dataset.toggleItem);
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
      const countInput = document.querySelector(`[data-count-name="${CSS.escape(name)}"]`);
      if (countInput) countInput.value = toggle.ownedCount ?? '';
      if (toggle.owned) renderVariantCheckboxes(name);
    });
    updateAllPanelAccents();
  }

  function renderVariantCheckboxes(name) {
    const container = document.querySelector(`[data-variants-name="${CSS.escape(name)}"]`);
    if (!container) return;
    const variants = variantsFor(name).map((r) => r.variant);
    const toggle = getToggle(name);
    container.innerHTML = variants.map((variant) => `
      <label><input type="checkbox" data-variant-checkbox="${name}" value="${variant}" ${!toggle.ownedVariants || toggle.ownedVariants.has(variant) ? 'checked' : ''} /> ${variant}</label>
    `).join('');
    container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const boxes = [...container.querySelectorAll('input[type="checkbox"]')];
        const checked = boxes.filter((b) => b.checked).map((b) => b.value);
        toggle.ownedVariants = checked.length === boxes.length ? null : new Set(checked);
        persistCapgraderState();
      });
    });
  }

  // ---- Results rendering --------------------------------------------------

  function renderResultTable(dropperLabel, chain, startingValue) {
    const wrap = document.createElement('div');
    wrap.className = 'capgrader-result-table-wrap';
    const rows = chain.map((entry) => `
      <tr>
        <td>${entry.record.name}${entry.count > 1 ? ` &times;${entry.count}` : ''}</td>
        <td>${entry.record.variant}</td>
        <td>${compactNumber(entry.before)}</td>
        <td>${compactNumber(entry.after)}</td>
        <td>${entry.timeAfter.toFixed(1)}s</td>
        <td>${entry.lengthAfter} tiles</td>
      </tr>
    `).join('');
    wrap.innerHTML = `
      <p class="capgrader-result-heading">${dropperLabel} — starting at ${compactNumber(startingValue)}</p>
      <div class="capgrader-result-table-scroll">
        <table class="capgrader-result-table">
          <thead><tr><th>Upgrader</th><th>Variant</th><th>Value before</th><th>Value after</th><th>Time</th><th>Length</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">No legal capgrader chain found — toggle on more items you own.</td></tr>'}</tbody>
        </table>
      </div>
    `;
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
    for (const row of validRows) {
      const record = variantsFor(row.name).find((r) => r.variant === row.variant);
      const startingValue = Number(record.mainStat);
      const oreSize = Number(record.oreSize ?? 1);
      const startsOnFire = row.name === 'Fire Crystal Dropper';
      const result = optimizeCapgraderChain(startingValue, oreSize, pool, startsOnFire);
      resultsEl.appendChild(renderResultTable(`${row.name} (${row.variant})`, result.chain, startingValue));
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
    applyAllSearches();
    updateSpreadWarning();
  }
  document.addEventListener('capgrader-tool:activated', initCapgraderTool);
  if (!document.querySelector('#capgrader-tool')?.hidden) initCapgraderTool();
})();
