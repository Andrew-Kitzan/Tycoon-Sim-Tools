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

const { legalPool, optimizeCapgraderChain, getToggle, capgraderNames, additiveNames, scannerNames, lunarName } = await loadCapgraderTool();

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

{
  ownEverything();
  const pool = legalPool();
  const result = optimizeCapgraderChain(10, 1, pool, false);
  assert(result.chain.length > 0, 'a fully-owned pool must produce a non-empty chain');
  assert(
    result.finalValue >= 3.3e12 && result.finalValue <= 3.6e12,
    `expected final value in the $3.3T-$3.6T regression band, got ${result.finalValue}`,
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
  assert.deepEqual(emptyResult, { chain: [], finalValue: 10 }, 'an empty legal pool must return the starting value unchanged');
}

console.log('Validated capgrader-generator.js legalPool()/optimizeCapgraderChain() search logic.');
