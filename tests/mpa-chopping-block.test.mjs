// Automated tests for mpa-chopping-block.js's data/logic — the MPA/Chopping
// Block tool. Same technique as tests/capgrader-generator.test.mjs: this is a
// plain (non-module) browser script that reads globalThis.MpuStatsData,
// globalThis.TycoonDatabase, and globalThis.document directly, so it's loaded
// here with `new Function('globalThis', ...)` against a minimal DOM stub and
// exercised via globalThis.__mpaDebug — the same test-hook pattern
// capgrader-generator.js uses (__cgDebug), exposed right before this file's
// closing IIFE parenthesis specifically so real automated tests can call the
// actual shipped logic instead of a hand-written reimplementation that could
// silently diverge from it. See AI_HANDOFF.md's "2026-09-11 MPA / Chopping
// Block tool" entry for the full design/decision history if this needs
// touching again.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

// ---- Minimal DOM stub -------------------------------------------------
// mpa-chopping-block.js queries a handful of real element IDs at load time,
// but every lookup either uses `?.` or is only reached from event handlers
// this suite never triggers, so a stub returning a fresh throwaway element
// for every querySelector call (and empty arrays for querySelectorAll) is
// enough to let the module finish loading and attach __mpaDebug.
function makeStubElement() {
  const el = {
    dataset: {}, style: {}, children: [], hidden: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, getAttribute: () => null,
    appendChild(child) { el.children.push(child); return child; },
    querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, contains: () => false, _innerHTML: '',
  };
  Object.defineProperty(el, 'innerHTML', { get: () => el._innerHTML, set: (value) => { el._innerHTML = value; } });
  return el;
}

function makeDomStub() {
  const store = new Map();
  return {
    document: {
      querySelector: () => makeStubElement(),
      querySelectorAll: () => [],
      createElement: () => makeStubElement(),
      addEventListener() {}, removeEventListener() {},
    },
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
    CSS: { escape: (value) => String(value) },
  };
}

async function loadMpaTool() {
  const databaseSource = await fs.readFile(path.join(root, 'data', 'items.generated.js'), 'utf8');
  const mpuStatsSource = await fs.readFile(path.join(root, 'data', 'mpu-stats.js'), 'utf8');
  const toolSource = await fs.readFile(path.join(root, 'mpa-chopping-block.js'), 'utf8');
  const { document, localStorage, CSS } = makeDomStub();
  const sandbox = { document, localStorage, CSS, window: { alert: () => {} } };
  sandbox.globalThis = sandbox;
  const run = new Function(
    'globalThis', 'document', 'localStorage', 'CSS', 'window',
    `${databaseSource}\n${mpuStatsSource}\n${toolSource}\nreturn globalThis.__mpaDebug;`,
  );
  const debugHook = run(sandbox, document, localStorage, CSS, sandbox.window);
  assert(debugHook, 'mpa-chopping-block.js must expose globalThis.__mpaDebug for testing');
  return debugHook;
}

const dbg = await loadMpaTool();

function resetOwnership() {
  for (const key of Object.keys(dbg.state.owned)) delete dbg.state.owned[key];
  for (const key of Object.keys(dbg.state.inputs)) delete dbg.state.inputs[key];
  dbg.resetKeptThisRun();
}

// ---- Coverage: every choppable item has a finite reference MPA -----------

{
  const missing = dbg.choppableItems.filter((item) => !Number.isFinite(dbg.referenceStatFor(item, 'mpa').value));
  assert.deepEqual(missing.map((item) => item.name), [], 'every choppable item must have a finite reference MPA');
}

// ---- Lambda Upgrader: MPA gets worse with more uses, opposite of ----------
// Incremental/Tiki. Browsing-list reference must be the best (1-use) value,
// with a note surfacing the 3-Lambda numbers too.

{
  const lambda = dbg.itemsByName.get('Lambda Upgrader');
  const ref = dbg.referenceStatFor(lambda, 'mpa');
  assert.equal(ref.value, 1.06951612, "Lambda Upgrader's reference MPA must be its 1-use value (its best)");
  assert(ref.note.includes('3 Lambdas'), 'Lambda note must surface the 3-Lambda stats');

  resetOwnership();
  dbg.state.owned['Lambda Upgrader'] = true;
  dbg.state.inputs['Lambda Upgrader'] = { uses: 1 };
  const oneUse = dbg.currentStatsFor('Lambda Upgrader').mpa;
  dbg.state.inputs['Lambda Upgrader'] = { uses: 3 };
  const threeUses = dbg.currentStatsFor('Lambda Upgrader').mpa;
  assert(threeUses < oneUse, 'Lambda Upgrader MPA must get worse with more uses');
}

// ---- Incremental Upgrader / Tiki Evaluator: MPA improves with more uses --

{
  resetOwnership();
  dbg.state.owned['Incremental Upgrader'] = true;
  dbg.state.inputs['Incremental Upgrader'] = { uses: 1 };
  const oneUse = dbg.currentStatsFor('Incremental Upgrader').mpa;
  dbg.state.inputs['Incremental Upgrader'] = { uses: 3 };
  const threeUses = dbg.currentStatsFor('Incremental Upgrader').mpa;
  assert(threeUses > oneUse, 'Incremental Upgrader MPA must improve with more uses');

  const tiki = dbg.itemsByName.get('Tiki Evaluator');
  const tikiRef = dbg.referenceStatFor(tiki, 'mpa');
  assert.equal(tikiRef.value, 1.04566674, "Tiki Evaluator's reference MPA must be its 2-use (best) value");
}

// ---- Dream Machine: real formula, matches every tabulated row exactly ----

{
  const dreamMachine = dbg.itemsByName.get('Dream Machine');
  for (const row of dreamMachine.tabulated) {
    const multi = dbg.formulaMultiForEffects(dreamMachine, row.effects);
    assert.equal(multi, row.multi, `Dream Machine formula must match the tabulated multi at ${row.effects} effects`);
  }
  // The formula must also work at an untabulated effect count (e.g. 3).
  const multiAt3 = dbg.formulaMultiForEffects(dreamMachine, 3);
  assert.equal(multiAt3, 1 + 3 * dreamMachine.perEffectBonus);
  const derived = dbg.derivedFromMulti(multiAt3, dreamMachine.area, dreamMachine.length, dreamMachine.conveyorSpeed);
  assert(Number.isFinite(derived.mpa), 'Dream Machine MPA must be computable at an untabulated effect count');
}

// ---- Dragon's Breath / Portable Spinner: Looped is the best config ------

{
  const dragonsBreath = dbg.itemsByName.get("Dragon's Breath");
  assert.equal(dragonsBreath.bestConfig, 'looped');
  const looped = dragonsBreath.configs.find((c) => c.id === 'looped');
  const twoUses = dragonsBreath.configs.find((c) => c.id === '2-uses');
  assert(looped.mpa > twoUses.mpa, "Dragon's Breath Looped must beat 2 Uses on MPA");

  const portableSpinner = dbg.itemsByName.get('Portable Spinner');
  assert.equal(portableSpinner.bestConfig, 'looped', 'Portable Spinner: Looped is confirmed correct as the best configuration');
  const psLooped = portableSpinner.configs.find((c) => c.id === 'looped');
  const psOneUse = portableSpinner.configs.find((c) => c.id === '1-use');
  assert(psLooped.mpa > psOneUse.mpa, 'Portable Spinner Looped must beat 1 Use on MPA');
}

// ---- Simple dependency lock: Ore Wash / Acid Plant -----------------------

{
  resetOwnership();
  dbg.state.owned['Ore Wash'] = true;
  assert(!dbg.isLocked('Ore Wash'), 'Ore Wash must not be locked while Acid Plant is not owned');
  dbg.state.owned['Acid Plant'] = true;
  assert(dbg.isLocked('Ore Wash'), 'Ore Wash must be locked while Acid Plant is owned');
  dbg.state.owned['Acid Plant'] = false;
  assert(!dbg.isLocked('Ore Wash'), 'Ore Wash must unlock once Acid Plant is chopped');
}

// ---- Simple dependency lock: Leviathans' Wrath / Atlantis Remnant --------

{
  resetOwnership();
  dbg.state.owned["Leviathans' Wrath"] = true;
  dbg.state.owned['Atlantis Remnant'] = true;
  assert(dbg.isLocked("Leviathans' Wrath"), "Leviathans' Wrath must be locked while Atlantis Remnant is owned");
  dbg.state.owned['Atlantis Remnant'] = false;
  assert(!dbg.isLocked("Leviathans' Wrath"), "Leviathans' Wrath must unlock once Atlantis Remnant is chopped");
}

// ---- Alien Invasion dependency: BOTH Hoarded Treasure and Electric -------
// Overdrive stay locked while Alien Invasion is owned — confirmed by the
// user this is not an "either one" release; Alien Invasion itself must be
// gone before either can be chopped, even if only one of the two is owned.

{
  resetOwnership();
  dbg.state.owned['Alien Invasion'] = true;
  dbg.state.owned['Hoarded Treasure'] = true;
  dbg.state.owned['Electric Overdrive'] = true;
  assert(dbg.isLocked('Hoarded Treasure'), 'Hoarded Treasure must be locked while Alien Invasion is owned, even with Electric Overdrive also owned');
  assert(dbg.isLocked('Electric Overdrive'), 'Electric Overdrive must be locked while Alien Invasion is owned, even with Hoarded Treasure also owned');

  dbg.state.owned['Electric Overdrive'] = false;
  assert(dbg.isLocked('Hoarded Treasure'), 'Hoarded Treasure must stay locked on its own while Alien Invasion is still owned');

  dbg.state.owned['Alien Invasion'] = false;
  assert(!dbg.isLocked('Hoarded Treasure'), 'Hoarded Treasure must unlock once Alien Invasion itself is chopped');
}

// ---- Capgrader chain lock: a lower-range capgrader is locked while a ------
// higher-range one is also in the base (8-Ball Refiner / Blocky Refiner is
// the exact scenario the user reported live).

{
  resetOwnership();
  dbg.state.owned['8-Ball Refiner'] = true;
  dbg.state.owned['Blocky Refiner'] = true;
  assert(dbg.isLocked('8-Ball Refiner'), '8-Ball Refiner (10B-50B) must be locked while Blocky Refiner (30B-100B) is also in the base');
  assert(!dbg.isLocked('Blocky Refiner'), 'Blocky Refiner must not be locked — nothing higher-range is owned');
  dbg.state.owned['Blocky Refiner'] = false;
  assert(!dbg.isLocked('8-Ball Refiner'), '8-Ball Refiner must unlock once Blocky Refiner is chopped');
}

// ---- Finisher capgraders are excluded from chain locking, both ways -----

{
  assert(dbg.isFinisherCapgrader('Toybox Express'));
  assert(dbg.isFinisherCapgrader("Rubik's Polisher"));
  assert(dbg.isFinisherCapgrader('Nuclear Upgrader'), 'Nuclear Upgrader must be a manual finisher override');
  assert(dbg.isFinisherCapgrader('Chartreuse Collider'), 'Chartreuse Collider must be a manual finisher override');

  resetOwnership();
  dbg.state.owned['8-Ball Refiner'] = true;
  dbg.state.owned['Toybox Express'] = true;
  assert(!dbg.isLocked('8-Ball Refiner'), 'A finisher capgrader must not lock a normal capgrader');
  assert(!dbg.isLocked('Toybox Express'), 'A finisher capgrader must never itself be chain-locked');

  resetOwnership();
  dbg.state.owned['Ore Purifier'] = true;
  dbg.state.owned['Nuclear Upgrader'] = true;
  assert(!dbg.isLocked('Ore Purifier'), 'Ore Purifier must not be locked by finisher Nuclear Upgrader');

  resetOwnership();
  dbg.state.owned['Blocky Refiner'] = true;
  dbg.state.owned['Chartreuse Collider'] = true;
  assert(!dbg.isLocked('Blocky Refiner'), 'Blocky Refiner must not be locked by finisher Chartreuse Collider');
}

// ---- Decision loop: worst MPA first, "Keep" advances to the next --------

{
  // Fusion Upgrader and Ore Wash are both plain non-capgrader upgraders with
  // a known, stable MPA order (Fusion lower, i.e. worse). Originally used
  // Sunflower Fields as a third "middle" item too, but it's now a real
  // capgrader (added 2026-09-10, see capgrader-generator.test.mjs's
  // regression-band comment) and gets chain-locked by the same rule as
  // Nuclear Upgrader/Chartreuse Collider above, which would make this test
  // exercise the lock instead of the plain worst-first/keep-advances
  // mechanic it's meant to check — two tiers is enough to prove that.
  resetOwnership();
  dbg.state.owned['Fusion Upgrader'] = true; // lowest MPA of the two
  dbg.state.owned['Ore Wash'] = true;

  let eligible = dbg.ownedEligibleSorted();
  assert.equal(eligible[0].item.name, 'Fusion Upgrader', 'the worst-MPA owned item must be suggested first');

  dbg.getKeptThisRun().add('Fusion Upgrader'); // simulate pressing "Keep"
  eligible = dbg.ownedEligibleSorted();
  assert.equal(eligible[0].item.name, 'Ore Wash', 'keeping an item must advance to the next-worst eligible one');
}

// ---- Chop semantics: Incremental/Tiki remove everything, Lambda removes 1 -

{
  resetOwnership();
  dbg.state.owned['Incremental Upgrader'] = true;
  dbg.state.inputs['Incremental Upgrader'] = { uses: 3 };
  const stats = dbg.currentStatsFor('Incremental Upgrader');
  assert.equal(stats.uses, 3, 'Incremental Upgrader must report its full owned use count for the chop-effect note');

  dbg.state.owned['Lambda Upgrader'] = true;
  dbg.state.inputs['Lambda Upgrader'] = { uses: 3 };
  const lambdaStats = dbg.currentStatsFor('Lambda Upgrader');
  assert.equal(lambdaStats.mpa, 1.040806008, 'Lambda Upgrader at 3 uses must report the worse tabulated MPA, not the 1-use best');
}

// ---- Rendering must not throw against the real data/DOM stub ------------

{
  resetOwnership();
  dbg.renderList();
  dbg.state.owned['Fusion Upgrader'] = true;
  dbg.renderCategories();
  dbg.resetKeptThisRun();
  dbg.renderDecision();
}

console.log('Validated mpa-chopping-block.js data/logic (MPU/MPA/MPS reference values, dependency and capgrader-chain locks, decision-loop ordering, chop semantics).');
