// Automated tests for capgrader-generator.js's search logic. This file is a
// plain (non-module) browser script that reads globalThis.TycoonDatabase and
// globalThis.document directly (see AI_HANDOFF.md — no bundler in this
// project), so it's loaded here with `new Function('globalThis', src)` against
// a minimal DOM/localStorage/CSS stub, same technique used to debug the
// beam-search quality fixes (2026-08-26 handoff entry). It then reads
// globalThis.__cgDebug — a small hook the file exposes right after
// `optimizeCapgraderChain`'s closing brace specifically so real automated
// tests can call the real shipped algorithm instead of a hand-written
// reimplementation that could silently diverge from it.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

// ---- Minimal DOM stub -------------------------------------------------
// capgrader-generator.js runs its UI init synchronously at load time
// (`if (!document.querySelector('#capgrader-tool')?.hidden) initCapgraderTool()`).
// Every DOM lookup in this file is either guarded with `?.`/an explicit
// `if (!el) return`, or only reachable from UI event handlers this test suite
// never triggers — so a stub where querySelector/querySelectorAll always come
// back empty is sufficient to let the module finish loading (and attach
// __cgDebug) without needing a real HTML parser.
function makeStubElement() {
  const el = {
    dataset: {},
    style: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute: () => null,
    appendChild(child) { el.children.push(child); return child; },
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    contains: () => false,
    _innerHTML: '',
  };
  Object.defineProperty(el, 'innerHTML', { get: () => el._innerHTML, set: (value) => { el._innerHTML = value; } });
  return el;
}

function makeDomStub() {
  const store = new Map();
  return {
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => makeStubElement(),
      addEventListener() {},
      removeEventListener() {},
    },
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
    CSS: { escape: (value) => String(value) },
  };
}

async function loadCapgraderTool() {
  const databaseSource = await fs.readFile(path.join(root, 'data', 'items.generated.js'), 'utf8');
  const toolSource = await fs.readFile(path.join(root, 'capgrader-generator.js'), 'utf8');
  const { document, localStorage, CSS } = makeDomStub();
  const sandbox = { document, localStorage, CSS };
  sandbox.globalThis = sandbox;
  const run = new Function('globalThis', 'document', 'localStorage', 'CSS', `${databaseSource}\n${toolSource}\nreturn globalThis.__cgDebug;`);
  const debugHook = run(sandbox, document, localStorage, CSS);
  assert(debugHook, 'capgrader-generator.js must expose globalThis.__cgDebug for testing');
  return debugHook;
}

const { legalPool, optimizeCapgraderChain, getToggle, capgraderNames, additiveNames, scannerNames, lunarName, beltCapacity, oreFlow, variantsFor, syncedUnitsNeeded, syncedScannerPlan } = await loadCapgraderTool();

const allItemNames = [...capgraderNames, ...additiveNames, ...scannerNames, lunarName].filter(Boolean);
function ownEverything() {
  for (const name of allItemNames) getToggle(name).owned = true;
}
function ownNothing() {
  // Also clears variantCounts, not just `owned` — otherwise a later test
  // block's explicit per-variant overrides (e.g. { Base: 0 }) leak into
  // whichever test runs next against the same shared toggle object.
  for (const name of allItemNames) {
    const toggle = getToggle(name);
    toggle.owned = false;
    toggle.variantCounts = null;
  }
}

// ---- legalPool() --------------------------------------------------------

{
  const emptyPool = legalPool();
  assert.deepEqual(emptyPool, { capgraders: [], finishers: [], additives: [], lunar: null, scanners: [] }, 'nothing owned must produce an empty pool');
}

{
  ownEverything();
  const pool = legalPool();
  assert(pool.capgraders.length > 0, 'owning every capgrader must populate pool.capgraders');
  assert(pool.finishers.length > 0, "owning every capgrader must populate pool.finishers (Toybox Express / Rubik's Polisher)");
  assert(pool.additives.length > 0, 'owning every additive must populate pool.additives');
  assert(pool.scanners.length > 0, 'owning every scanner must populate pool.scanners');
  assert(pool.lunar, 'owning Lunar Landing must set pool.lunar');

  const finisherNames = pool.finishers.map((record) => record.name);
  assert(finisherNames.includes('Toybox Express'), 'Toybox Express (range 0 - 1 octillion) must be classified as a finisher');
  assert(finisherNames.includes("Rubik's Polisher"), "Rubik's Polisher (range 0 - 1 septillion) must be classified as a finisher");
  assert(!pool.capgraders.some((record) => finisherNames.includes(record.name)), 'finishers must never also appear in pool.capgraders');

  for (const record of pool.capgraders) {
    assert(record.range && String(record.range).toLowerCase() !== 'n/a', `${record.name} must have a parseable range to appear in the legal pool`);
  }
}

{
  // Owning only one capgrader (by name) must not accidentally pull in any
  // other capgrader — but SHOULD contribute one pool entry per variant of
  // that item by default (Base + Shiny, etc.), since every owned variant is
  // now independently usable (see legalPool()'s ownedVariantRecords) rather
  // than collapsed to a single "best" one.
  ownNothing();
  const soleCapgrader = capgraderNames[0];
  getToggle(soleCapgrader).owned = true;
  const pool = legalPool();
  const owned = [...pool.capgraders, ...pool.finishers];
  assert(owned.length > 0, 'the toggled-on capgrader should appear in the pool at least once');
  assert(owned.every((record) => record.name === soleCapgrader), 'only the toggled-on capgrader should appear in the pool');
  assert.equal(pool.additives.length, 0);
  assert.equal(pool.scanners.length, 0);
  assert.equal(pool.lunar, null);
}

{
  // Explicitly zeroing one variant's count excludes just that variant, not
  // the whole item — the other variant(s) stay usable.
  ownNothing();
  const mixedCapgrader = capgraderNames.find((name) => name === 'Fragrant Passage') ?? capgraderNames[0];
  const toggle = getToggle(mixedCapgrader);
  toggle.owned = true;
  toggle.variantCounts = { Base: 0 };
  const pool = legalPool();
  const variants = [...pool.capgraders, ...pool.finishers].filter((r) => r.name === mixedCapgrader).map((r) => r.variant);
  assert(!variants.includes('Base'), 'a variant explicitly set to 0 owned must not appear in the pool');
  assert(variants.includes('Shiny'), 'an untouched variant (default unlimited) must still appear in the pool');
}

{
  // The actual motivating case, end to end: there is a real ~350B-400B gap
  // in capgrader range coverage that only Base-then-Shiny Fragrant Passage
  // mixing can bridge into Sunflower Fields (500B-1T) — a real player
  // reported and verified this chain by hand before this test was written
  // (see AI_HANDOFF.md). With every relevant item owned (unlimited, both
  // variants — the default), the search must actually find a chain that
  // reaches Sunflower Fields' range, which was impossible before this
  // feature since only one "best" variant per item was ever considered.
  ownNothing();
  for (const name of [
    'Anchor Upgrader', 'Rocketship Upgrader', '8-Ball Refiner', 'Blocky Refiner',
    'Fragrant Passage', 'Sunflower Fields',
  ]) getToggle(name).owned = true;
  getToggle(lunarName).owned = true;
  const pool = legalPool();
  const fragrantBase = pool.capgraders.find((r) => r.name === 'Fragrant Passage' && r.variant === 'Base');
  const fragrantShiny = pool.capgraders.find((r) => r.name === 'Fragrant Passage' && r.variant === 'Shiny');
  assert(fragrantBase && fragrantShiny, 'both Fragrant Passage variants must be independently present in the pool');
  assert(fragrantBase.mainStat < fragrantShiny.mainStat, 'Base must be the weaker multiplier here');
  const result = optimizeCapgraderChain(37500000, 1.4, pool, false);
  assert(
    result.chain.some((entry) => entry.record.name === 'Sunflower Fields'),
    `expected the search to find a chain reaching Sunflower Fields, but it didn't — final value was ${result.finalValue}`,
  );
}

{
  // limitedUses is a base-game rule SHARED across every variant of an item —
  // real bug (caught by the user, not this test suite, the first time this
  // shipped): owning both Base and Shiny of a limitedUses:1 item must never
  // let it be used twice (once per variant). Toybox Express/Rubik's
  // Polisher are both limitedUses:1 finishers — cascading both variants of
  // each on top of a chain must still only apply ONE of them, total.
  ownNothing();
  getToggle('Toybox Express').owned = true;
  getToggle("Rubik's Polisher").owned = true;
  const pool = legalPool();
  assert(
    pool.finishers.filter((r) => r.name === 'Toybox Express').length === 2,
    'both Toybox Express variants should be in the pool (this is fine — the shared cap is enforced at use time, not pool membership)',
  );
  const result = optimizeCapgraderChain(10, 1, pool, false);
  for (const name of ['Toybox Express', "Rubik's Polisher"]) {
    const uses = result.chain.filter((entry) => entry.record.name === name).length;
    assert(uses <= 1, `${name} is limitedUses:1 shared across variants — must appear at most once total in the chain, appeared ${uses} times`);
  }
  // And it must be the STRONGER (Shiny) variant that gets used, not
  // whichever one a naive ascending-mainStat cascade order happens to try
  // first — a finisher's range floor of 0 means there's never a reason to
  // prefer the weaker one.
  const toybox = result.chain.find((entry) => entry.record.name === 'Toybox Express');
  if (toybox) assert.equal(toybox.record.variant, 'Shiny', 'the finisher cascade must pick the strongest owned variant, not the first one tried');
}

// ---- optimizeCapgraderChain(): regression benchmark ----------------------
// Locks in the known-good "own everything" result from the 2026-08-26
// beam-search quality fixes (AI_HANDOFF.md) — a Dropper starting at $10
// originally landed in the $1.25T-$1.4T band (true offline-search ceiling
// ~$1.348T, ~1-1.5% gap accepted as a known limitation, not a bug). If this
// regresses back toward the pre-fix $185B-$780B range, one of the three
// fixes described there (terminal scoring, finisher pool split, same-item
// move batching) has been broken.
//
// Band raised to $3.0T-$3.3T on 2026-09-10 after 5 new capgraders from the
// nature-update database (Sunflower Fields 500B-1T, Fragrant Passage
// 150B-350B, Canyon Refiner 1T-3T, Fungal Enhancer 1T-3T, Glistening Falls
// 6T-10T) were added to CAPGRADER_NAMES — real new bridging options that
// legitimately extend the optimal chain further before falling back to
// generic multi-spam, not a search-quality change.
//
// Band adjusted to $3.3T-$3.6T on 2026-09-11 after legalPool() started
// offering every owned VARIANT of a capgrader as an independently-usable
// item (ownedVariantRecords), instead of collapsing to one "best" variant
// per name — a real player found a legal chain that only works by mixing
// Base and Shiny copies of the same capgrader (weaker Base first to land
// precisely in a later range, Shiny to finish), which was structurally
// impossible to find before this change.
//
// This band went through two wrong values before landing here, both from
// the same real bug (caught by the user, not by this test — worth noting):
// an initial pass first measured ~$20.56T, but that number was itself
// inflated by a genuine correctness bug — `limitedUses` is a BASE-GAME rule
// shared across every variant of an item (e.g. Rubik's Polisher/Toybox
// Express are limitedUses:1 TOTAL, not 1-per-variant), and the finisher
// cascade at the end of optimizeCapgraderChain() was applying finishers in
// raw ascending-mainStat order across ALL variant-records, which let a
// weak Base copy burn a shared single-use slot before the stronger Shiny
// copy ever got a turn. Fixing that (finisher cascade now always uses the
// single best owned variant per finisher NAME, since a finisher's range
// floor of 0 means there's never a range reason to prefer a weaker variant
// there) dropped the measured value to ~$2.83T — LOWER than the original
// pre-mixing $3.15T baseline, which was the tell that something was still
// off, since correct variant-mixing should only ever add options, never
// remove them. Root cause of that second wrong number turned out to be the
// same bug, just not fully diagnosed yet: it takes a moment of "wait, this
// went down, that's backwards" to catch. Once the shared-limitedUses fix
// was in fully, the correct measured result came out to ~$3.43T — legitimately
// a bit above the $3.15T pre-mixing baseline (from mid-chain, unlimited-use
// capgraders like Fragrant Passage still benefiting from mixing), not the
// dramatic jump the buggy number suggested. **If this number is ever "too
// high" again, suspect a finisher/limited-use variant being double-counted
// before suspecting the search itself.**
//
// Band raised to $27T-$30T on 2026-10-20 by a real search-quality fix, not a
// counting bug: prune() now keeps at most 2 states per value level, so the
// beam stops filling up with near-duplicates that differ only in which
// copies they used. The old search stopped at ~$472B before the finishers
// and never reached the Sunflower Fields (500B-1T) / Fungal Enhancer (1T-3T)
// tiers. The new ~$28.6T chain was checked step by step: every capgrader in
// range, every limitedUses respected (Rubik's/Toybox once each), every
// multiplication exact.

{
  ownEverything();
  const pool = legalPool();
  const result = optimizeCapgraderChain(10, 1, pool, false);
  assert(result.chain.length > 0, 'a fully-owned pool must produce a non-empty chain');
  assert(
    result.finalValue >= 2.7e13 && result.finalValue <= 3.0e13,
    `expected final value in the $27T-$30T regression band, got ${result.finalValue}`,
  );

  // Every step must be legal: value must move the expected direction (up for
  // multiplicative items, up-or-down-is-fine only for additive since a
  // negative additive would still be "legal" if one ever existed), and the
  // recorded running value must chain correctly entry to entry.
  let runningValue = 10;
  for (const entry of result.chain) {
    assert(entry.after >= entry.before || entry.record.mainStatType?.toLowerCase().includes('additive'), `${entry.record.name} must not decrease value unless additive`);
    runningValue = entry.after;
  }
  assert(runningValue === result.finalValue, "chain's last recorded value must equal finalValue");

  // Finishers must be the very last entries in the chain (cascaded on top),
  // in ascending mainStat order, per isFinisherRecord()/the cascade step.
  const finisherIndices = result.chain
    .map((entry, index) => ({ name: entry.record.name, index }))
    .filter(({ name }) => name === 'Toybox Express' || name === "Rubik's Polisher");
  if (finisherIndices.length === 2) {
    assert(finisherIndices[0].index < finisherIndices[1].index, 'finishers must be cascaded in ascending mainStat order');
    assert(finisherIndices[1].index === result.chain.length - 1, 'the last finisher must be the final chain entry');
  }
}

// ---- optimizeCapgraderChain(): finisher-as-mid-chain-bridge regression ----
// Regression for quality bug #2 in the 2026-08-26 handoff entry: a
// single-use, wide-range "finisher" (Toybox Express / Rubik's Polisher) must
// never be spent as a mid-chain bridge — it should only ever appear cascaded
// at the very end, after every normal capgrader move.

{
  ownNothing();
  getToggle('Toybox Express').owned = true;
  const narrowCapgrader = capgraderNames.find((name) => name !== 'Toybox Express' && name !== "Rubik's Polisher");
  assert(narrowCapgrader, 'test setup needs at least one non-finisher capgrader');
  getToggle(narrowCapgrader).owned = true;
  const pool = legalPool();
  assert(pool.finishers.some((record) => record.name === 'Toybox Express'));
  const result = optimizeCapgraderChain(10, 1, pool, false);
  const toyboxIndex = result.chain.findIndex((entry) => entry.record.name === 'Toybox Express');
  if (toyboxIndex !== -1) {
    assert.equal(toyboxIndex, result.chain.length - 1, 'Toybox Express must only ever be the final chain entry, never a mid-chain bridge');
  }
}

// ---- optimizeCapgraderChain(): empty pool must not throw -----------------

{
  ownNothing();
  const emptyResult = optimizeCapgraderChain(10, 1, legalPool(), false);
  assert.deepEqual(emptyResult.chain, [], 'an empty legal pool must produce no chain');
  assert.equal(emptyResult.finalValue, 10, 'an empty legal pool must return the starting value unchanged');
}

// ---- Speed / distance toggles (2026-10-20) --------------------------------
// Both on (the default) is the original scoring. Turning a toggle off only
// removes a penalty, so it can never end on a LOWER value; both off is pure
// maximum final value.

{
  ownEverything();
  const pool = legalPool();
  const both = optimizeCapgraderChain(10, 1, pool, false);
  const explicitBoth = optimizeCapgraderChain(10, 1, pool, false, { considerSpeed: true, considerDistance: true });
  assert.equal(explicitBoth.finalValue, both.finalValue, 'both toggles on must match the default scoring exactly');
  const noDistance = optimizeCapgraderChain(10, 1, pool, false, { considerDistance: false });
  const noSpeed = optimizeCapgraderChain(10, 1, pool, false, { considerSpeed: false });
  const neither = optimizeCapgraderChain(10, 1, pool, false, { considerSpeed: false, considerDistance: false });
  assert(noDistance.finalValue >= both.finalValue * 0.999, 'distance off must not end on a lower value than both on');
  assert(noSpeed.finalValue >= both.finalValue * 0.999, 'speed off must not end on a lower value than both on');
  // Beam search is a heuristic, so allow a 0.1% wobble between modes.
  assert(neither.finalValue >= Math.max(noDistance.finalValue, noSpeed.finalValue) * 0.999, 'both off must end on the highest value');
  assert.equal(neither.flow, null, 'speed off must ignore the ore limit entirely');
}

// ---- Ore limit / belt flow (2026-10-20) -------------------------------------
// Player-measured: Castle Fortress (additive, conveyor speed 6) cut a
// fast-drop Fantasy base from 13T to 9T/min. In this Fantasy-era pool, both
// openings (Castle Fortress or Enforced Upgrader) end near the same capgrader
// ceiling, so with 20 ores/sec and the base at the 100-ore limit, the
// slower Castle opening must lose; at 2 ores/sec (no limit) it may win.

{
  ownNothing();
  for (const name of ['Castle Fortress', 'Enforced Upgrader', 'Oasis Cleanser', 'Waste Refiner', 'Fine Point Upgrader', 'Quad Rays Upgrader', 'Oil Well', 'Desert Remains', 'Fairy Forest', 'Observatory Refiner']) {
    getToggle(name).owned = true;
  }
  const pool = legalPool();
  const usesCastle = (result) => result.chain.some((entry) => entry.record.name === 'Castle Fortress');
  const fast = optimizeCapgraderChain(350, 1, pool, false, { flow: { dropRate: 20, restSeconds: 15 } });
  assert(!usesCastle(fast), 'a fast-drop setup at the ore limit must not route ore through Castle Fortress');
  assert.equal(fast.flow.limitedBy, 'ore limit', '20 ores/sec over a ~25s route must be ore-limit bound');
  assert(fast.flow.entriesPerSecond <= 100 / 15, 'entries/sec can never beat 100 ores over the route time');
  const slow = optimizeCapgraderChain(350, 1, pool, false, { flow: { dropRate: 2, restSeconds: 15 } });
  assert.equal(slow.flow.limitedBy, 'drop rate', '2 ores/sec must stay under the ore limit');
  const valueOnly = optimizeCapgraderChain(350, 1, pool, false, { considerSpeed: false, considerDistance: false });
  assert(valueOnly.finalValue >= Math.max(fast.finalValue, slow.finalValue), 'value-only mode must end on the most value');
}

// Belt flow: a speed-6 conveyor (Castle Fortress) carrying size-1 ore moves
// at most 6 / 1.2 = 5 ores/sec back to back, so it caps a 20 ores/sec setup
// even when the 100-ore limit isn't the tighter constraint.
{
  const castle = variantsFor('Castle Fortress').find((record) => record.variant === 'Base');
  assert(Math.abs(beltCapacity(castle, 1) - 5) < 1e-9, 'speed 6 / (size 1 x 1.2 studs) = 5 ores/sec');
  const state = { timeSeconds: 1.5, beltLimit: beltCapacity(castle, 1) };
  const flow = oreFlow(state, { dropRate: 20, restSeconds: 2 });
  assert.equal(flow.limitedBy, 'belt speed');
  assert.equal(flow.entriesPerSecond, 5);
  const unchoked = oreFlow({ timeSeconds: 1.5, beltLimit: Infinity }, { dropRate: 3, restSeconds: 2 });
  assert.equal(unchoked.limitedBy, 'drop rate');
  assert.equal(unchoked.entriesPerSecond, 3);
}

// ---- Synced scanner beams, back to back (2026-10-20) ----------------------
// Same-type scanners share one beam clock, so copies in a row are not
// independent rolls. Player-measured: 4 Precision or 4 Azure back to back
// were never enough. The count must come from simulating the copies as
// placed (back to back) and reach ~99% of ore, not the old 1/hitChance rule.
{
  const base = (name) => variantsFor(name).find((record) => record.variant === 'Base');
  const precision = syncedUnitsNeeded(base('Precision Ore Scanner'), 1);
  assert(precision.units > 4, `4 Precision back to back must not be enough at ore size 1 (got ${precision.units})`);
  assert(precision.coverage >= 0.99, 'the chosen Precision count must hit at least 99% of ore');
  const azure = syncedUnitsNeeded(base('Azure Scanner'), 1);
  assert(azure.units > 4, `in-game confirmed: 4 Azure back to back are not enough at ore size 1 (got ${azure.units})`);
  assert.equal(syncedUnitsNeeded(base('Azure Scanner'), 1.25).units, 1, 'Azure always hits ore of size 1.25 or more');
  const ancient = syncedUnitsNeeded(base('Ancient Scanner'), 1);
  assert(ancient.units <= 5 && ancient.coverage >= 0.99, 'Ancient copies line up well back to back, so a few are enough');

  // A plain conveyor gap breaks the near-mirror repeat, so the chosen plan
  // must use a gap for Precision/Azure and be far shorter than back to back.
  const precisionPlan = syncedScannerPlan(base('Precision Ore Scanner'), 1);
  assert(precisionPlan.gapTiles > 0, 'Precision must use a gap between copies');
  assert(precisionPlan.units <= 6, `Precision with a gap needs at most 6 copies at ore size 1 (got ${precisionPlan.units})`);
  assert(precisionPlan.tiles < precision.units * 2, 'the gapped Precision layout must be shorter than back to back');
  assert.equal(precisionPlan.tiles, precisionPlan.units * 2 + (precisionPlan.units - 1) * precisionPlan.gapTiles, 'tiles must count scanners and gaps');
  const azurePlan = syncedScannerPlan(base('Azure Scanner'), 1);
  assert(azurePlan.gapTiles > 0 && azurePlan.units < azure.units, 'Azure must need fewer copies with a gap');
  assert.equal(syncedScannerPlan(base('Ancient Scanner'), 1).gapTiles, 0, 'Ancient is already best back to back');

  // Confirmed in game (2026-10-20): 3 Precision with 3-tile gaps hit every
  // ore from Stone, Iron and King Dropper (size 1, drop speeds 1-3).
  assert.equal(precisionPlan.units, 3, 'in-game confirmed: 3 Precision are enough at ore size 1');
  assert.equal(precisionPlan.gapTiles, 3, 'in-game confirmed: with 3-tile gaps between them');
  // Confirmed in game (2026-10-20): 2 Azure with a 2-tile gap hit every
  // size-1 ore. Azure's pivot height was recalibrated to match this.
  assert.equal(azurePlan.gapTiles, 2, 'in-game confirmed: Azure uses a 2-tile gap at ore size 1');
  assert.equal(azurePlan.units, 2, 'in-game confirmed: 2 Azure are enough at ore size 1');
  // Confirmed in game: 4 Ancient back to back is best at ore size 1.
  const ancientPlan = syncedScannerPlan(base('Ancient Scanner'), 1);
  assert.equal(ancientPlan.units, 4, 'in-game confirmed: 4 Ancient back to back at ore size 1');
  // Star Scanner isn't a capgrader, but the wiki shows its spacing from the
  // same model. Confirmed in game (2026-10-20): 5 Stars with 2-tile gaps hit
  // every size-1 ore.
  const starPlan = syncedScannerPlan(base('Star Scanner'), 1);
  assert.equal(starPlan.units, 5, 'in-game confirmed: 5 Star Scanners at ore size 1');
  assert.equal(starPlan.gapTiles, 2, 'in-game confirmed: with 2-tile gaps');
}

console.log('Validated capgrader-generator.js legalPool()/optimizeCapgraderChain() search logic.');
