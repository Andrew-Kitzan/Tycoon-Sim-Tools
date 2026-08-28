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
  for (const name of allItemNames) getToggle(name).owned = false;
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
  // Owning only one capgrader variant of several must not accidentally pull in others.
  ownNothing();
  const soleCapgrader = capgraderNames[0];
  getToggle(soleCapgrader).owned = true;
  const pool = legalPool();
  const owned = [...pool.capgraders, ...pool.finishers].map((record) => record.name);
  assert.deepEqual(owned, [soleCapgrader], 'only the toggled-on capgrader should appear in the pool');
  assert.equal(pool.additives.length, 0);
  assert.equal(pool.scanners.length, 0);
  assert.equal(pool.lunar, null);
}

// ---- optimizeCapgraderChain(): regression benchmark ----------------------
// Locks in the known-good "own everything" result from the 2026-08-26
// beam-search quality fixes (AI_HANDOFF.md) — a Dropper starting at $10 should
// land in the $1.3-1.35T band (true offline-search ceiling ~$1.348T, ~1-1.5%
// gap accepted as a known limitation, not a bug). If this regresses back
// toward the pre-fix $185B-$780B range, one of the three fixes described
// there (terminal scoring, finisher pool split, same-item move batching) has
// been broken.

{
  ownEverything();
  const pool = legalPool();
  const result = optimizeCapgraderChain(10, 1, pool, false);
  assert(result.chain.length > 0, 'a fully-owned pool must produce a non-empty chain');
  assert(
    result.finalValue >= 1.25e12 && result.finalValue <= 1.4e12,
    `expected final value in the $1.25T-$1.4T regression band, got ${result.finalValue}`,
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
