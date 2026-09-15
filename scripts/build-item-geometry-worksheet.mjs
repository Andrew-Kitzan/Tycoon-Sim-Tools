import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputPath = path.join(root, 'data', 'manual', 'item-geometry-worksheet.json');

// This script did ONE-TIME bootstrapping of data/manual/item-geometry-worksheet.json. That file is now
// hand-maintained (confirmed values, per-variant overrides, and item-specific fields like
// Wind-Up Dropper's formulaOverride are typed in by hand and are NOT reproducible by this script).
// Regenerating from scratch would silently destroy that work, so this script refuses to run at all
// once the file exists. If you genuinely need a fresh reference copy of "what the engine currently
// assumes" for comparison, write it to a different path — never point this at the real file again.
try {
  await fs.access(outputPath);
  console.error(`Refusing to run: ${outputPath} already exists and is now hand-maintained.`);
  console.error('This script would overwrite hand-typed confirmed values and per-item fields (like Wind-Up Dropper\'s formulaOverride). Not running.');
  process.exit(1);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const database = JSON.parse(await fs.readFile(path.join(root, 'data', 'items.index.json'), 'utf8'));
const rules = JSON.parse(await fs.readFile(path.join(root, 'rules', 'engine-rules.json'), 'utf8'));

const KNOWN_FORMULA_NAMES = new Set([
  'Tiki Evaluator',
  'Lambda Upgrader',
  'Incremental Upgrader',
  "Dragon's Breath",
  'Runic Array',
  'Crimson Pillars',
  'Krakatoa',
]);

function hasKnownFormula(name) {
  if (KNOWN_FORMULA_NAMES.has(name)) return true;
  if (/scanner/i.test(name)) return true;
  return false;
}

function isPortable(name) {
  return /portable/i.test(name);
}

function withoutSource({ source, ...rest }) {
  return rest;
}

// Picture every item facing south (ore/effects flowing top-to-bottom), regardless of which
// direction you'd actually place it in your base — (0,0) is that picture's top-left tile, x
// increases right, y increases downward toward the exit. y = 0 is the item's own first/entrance
// tile, y = (length - 1) is its own last tile, y = length is the first tile immediately past its
// exit, y = length + 1 is one further out, and so on. Same scale for every item type — a dropper's
// drop point sitting "past the exit" and an upgrader's beam sitting "on its own 2nd tile" are both
// just numbers on this one number line.

function dropSpawnDefaultFor(size) {
  return {
    x: (size.width - 1) / 2,
    y: size.length,
    source: 'frontCells(item, outside=true) in planner-core.js — always assumed for every dropper; no per-item override exists yet',
  };
}

function conveyorDefaultFor(size) {
  const width = size.width % 2 === 0 ? 2 : 1;
  const x = (size.width - width) / 2;
  return { x, width, source: 'computed default (internalTransportProfile: even item width -> belt width 2, else 1, centered)' };
}

function conveyorFor(name, size) {
  const override = rules.internalTransportOverrides?.[name];
  if (override) {
    return { x: override.northOffset, width: override.across, source: `rules.internalTransportOverrides["${name}"]` };
  }
  return conveyorDefaultFor(size);
}

function beamFor(name, size) {
  if (name === 'Portable Spinner') {
    return { shape: 'radius', radius: rules.portableSpinnerBeamRadius, source: 'rules.portableSpinnerBeamRadius' };
  }
  if (isPortable(name)) {
    const width = rules.defaultPortableBeamWidth;
    const length = rules.defaultPortableBeamLength;
    return {
      shape: 'rect',
      x: (size.width - width) / 2,
      y: size.length,
      width,
      length,
      source: 'rules.defaultPortableBeamWidth / defaultPortableBeamLength (generic default, centered, starting immediately past the portable’s own footprint — not verified per-item)',
    };
  }
  return null;
}

function zoneFor(name, size) {
  const override = rules.furnaceOverrides?.[name];
  const width = override?.across ?? rules.defaultFurnaceZone.across;
  const length = override?.depth ?? rules.defaultFurnaceZone.depth;
  const placement = override?.placement ?? rules.defaultFurnaceZone.placement;
  const source = override
    ? `rules.furnaceOverrides["${name}"]`
    : 'rules.defaultFurnaceZone (generic default, not verified per-item)';
  return {
    shape: 'rect',
    x: placement === 'front-corner' ? 0 : (size.width - width) / 2,
    y: size.length - length,
    width,
    length,
    source: placement === 'front-corner'
      ? `${source} — corner-anchored; which exact corner may depend on facing direction, verify in-game (x pinned to 0 as a starting guess)`
      : source,
  };
}

function variantEntry(record) {
  return {
    variant: record.variant,
    mainStat: record.mainStat,
    mainStatType: record.mainStatType,
    conveyorSpeed: record.conveyorSpeed,
    dropSpeed: record.dropSpeed,
    oreSize: record.oreSize,
    range: record.range,
    limitedUses: record.limitedUses,
    effects: record.effects,
    source: record.source,
    geometryOverrides: null,
  };
}

function groupByName(records) {
  const byName = new Map();
  for (const record of records) {
    const list = byName.get(record.name) ?? [];
    list.push(record);
    byName.set(record.name, list);
  }
  return [...byName.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function buildDroppers(records) {
  return groupByName(records.filter((record) => record.type === 'dropper')).map(([name, variants]) => {
    const current = dropSpawnDefaultFor(variants[0].size);
    return {
      name,
      type: 'dropper',
      size: variants[0].size,
      variants: variants.map(variantEntry),
      needsFormula: variants.some((record) => record.mainStat == null) && !hasKnownFormula(name),
      geometry: {
        dropSpawn: {
          current,
          confirmed: withoutSource(current),
          note: 'Pre-filled assuming the drop point is centered and at the front, matching every other dropper — please still check this one in-game. If it visually drops multiple ore at once from separate spots (not just one point spanning an even-width face), replace this with an array of {x, y} objects instead.',
        },
      },
    };
  });
}

function buildUpgraders(records) {
  return groupByName(records.filter((record) => record.type === 'upgrader')).map(([name, variants]) => {
    const size = variants[0].size;
    const portable = isPortable(name);
    const geometry = {};
    let beamConfirmed;
    let beamNote;
    if (portable) {
      const current = beamFor(name, size);
      beamConfirmed = withoutSource(current);
      beamNote = 'Pre-filled with the generic portable default (or the Portable Spinner radius) — please still check this one’s real reach and direction-lock behavior in-game.';
    } else {
      const conveyor = conveyorFor(name, size);
      geometry.conveyor = { current: conveyor, confirmed: null };
      beamConfirmed = {
        shape: 'rect',
        x: conveyor.x,
        y: 0,
        width: conveyor.width,
        length: size.length,
      };
      beamNote = 'Pre-filled assuming the beam covers the entire conveyor path (full length, same width/position as the belt above) — this was never actually modeled before, so please check in-game whether the real effect zone is narrower, offset, or shorter than the full belt.';
    }
    geometry.beam = { current: beamFor(name, size), confirmed: beamConfirmed, note: beamNote };
    if (name === 'Ore Replicator') {
      const dropCurrent = dropSpawnDefaultFor(size);
      geometry.dropSpawn = {
        current: dropCurrent,
        confirmed: withoutSource(dropCurrent),
        note: 'This upgrader also spawns a cloned ore like a dropper, but that was never modeled before at all — pre-filled here by borrowing the standard dropper assumption (centered, one tile past the exit). Please double-check this one specifically since it’s a guess by analogy, not an existing engine default.',
      };
    }
    return {
      name,
      type: 'upgrader',
      isPortable: portable,
      size,
      variants: variants.map(variantEntry),
      needsFormula: variants.some((record) => record.mainStat == null) && !hasKnownFormula(name),
      geometry,
    };
  });
}

function buildFurnaces(records) {
  return groupByName(records.filter((record) => record.type === 'furnace')).map(([name, variants]) => {
    const size = variants[0].size;
    const current = zoneFor(name, size);
    return {
      name,
      type: 'furnace',
      size,
      variants: variants.map(variantEntry),
      needsFormula: variants.some((record) => record.mainStat == null) && !hasKnownFormula(name),
      formulaNote: name === 'Krakatoa'
        ? 'Krakatoa’s formula IS implemented (engine/furnaces.mjs), but only the live-simulation code path uses it — the main planner economics in engine/compiler.mjs still multiplies by raw mainStat (null), which is a known unresolved bug, not a missing formula.'
        : null,
      geometry: {
        zone: {
          current,
          confirmed: withoutSource(current),
          note: current.source.includes('corner-anchored')
            ? 'Pre-filled, but the corner-anchored x is only a starting guess (pinned to 0) — this one especially needs in-game verification since the real corner may differ.'
            : 'Pre-filled from rules.furnaceOverrides / rules.defaultFurnaceZone — please still check this one in-game.',
        },
      },
    };
  });
}

function buildDecorations(records) {
  return groupByName(records.filter((record) => record.type === 'decoration')).map(([name, variants]) => ({
    name,
    type: 'decoration',
    variants: variants.map(variantEntry),
    geometry: null,
    note: 'Decorations have no footprint interaction with ore — no geometry fields apply.',
  }));
}

const worksheet = {
  _readme: {
    purpose: 'Working file to audit and fill in physical placement data (and any missing formulas) for every item before the engine/UI geometry revamp. One entry per item NAME, not per variant — size and geometry are identical across variants; only numeric stats differ, so those stay nested under "variants".',
    coordinateSystem: 'Plain x/y, like counting tiles on a grid: picture every item facing south (ore/effects flowing top-to-bottom), no matter which direction you would actually place it in your base — the engine handles rotating that picture to however it is really facing. (0,0) is that picture’s top-left tile, x increases right, y increases downward toward the exit. This is one fixed reference so the same number always means the same physical spot: y = 0 is the item’s own first/entrance tile, y = (length - 1) is its own last tile, y = length is the first tile immediately past its exit, y = length + 1 is one further out. A dropper’s drop point sitting "past the exit" and an upgrader’s beam sitting "on its own 2nd tile" are both just y-values on this one number line — no separate rule to remember per item type. A POINT (dropSpawn) is one {x, y} pair. A REGION (conveyor, beam, zone) is a rectangle: {x, y, width, length} — x/y is its top-left corner in this same picture, width/length is how big it is. Centering a width W on a total item width T is x = (T - W) / 2 — a whole number when that’s even, .5 when it lands on a tile seam.',
    howToFillBlanks: 'Every geometry field has a "current" value (what the engine already assumes today, with its source noted) and a "confirmed" value. Most "confirmed" values here are already PRE-FILLED with the best available assumption (furnace zones and portable beams from their real engine defaults; dropper drop points and regular-upgrader beams from reasonable guesses — centered/at-the-front for droppers, "matches the whole conveyor" for upgraders) so most of the file should already be right or close to it. Pre-filled does not mean verified — go through each one and check it in-game; if it is correct, leave it as-is (that alone is useful signal once you have actually looked); if it is wrong, overwrite "confirmed" with the real value. Each field’s "note" says whether it was a real engine default or just a reasonable guess, so you know how much scrutiny it deserves.',
    fields: {
      dropSpawn: 'Droppers, and Ore Replicator (it also spawns a cloned ore). Where the ore visually appears, as an {x, y} point. Usually centered (x = (width-1)/2) and one tile past its own exit (y = length). Some droppers may need multiple separate points instead of one — use an array of {x, y} objects for those.',
      conveyor: 'Every non-portable upgrader and furnace. The internal belt path ore rides across inside the item’s own footprint, as {x, width} — this one stays a simple pair rather than the full rectangle because a conveyor is always assumed to run the item’s entire length (y = 0 through length).',
      beam: 'Every upgrader, including portables. Where the item’s effect actually applies to ore, as {shape: "rect", x, y, width, length} or {shape: "radius", radius}. For non-portables this is currently just assumed to equal the conveyor path above — that assumption is unverified for every single item. For portables it is a separate rectangle that starts at or beyond the item’s own footprint (y >= its own length) and projects outward.',
      zone: 'Furnaces only (teleporter zones are a separate conveyor-lane feature, not tracked in this item file). Where ore must physically touch to be processed for cash, as {shape: "rect", x, y, width, length}.',
    },
    needsFormula: 'True when this item has no numeric mainStat for at least one variant and no formula is implemented in the engine yet (see engine/models.mjs, engine/value-distribution.mjs, engine/furnaces.mjs). The "effects" text for that variant below usually contains the real-game formula description to translate into code.',
    variantGeometryOverrides: 'The top-level "geometry" block is the assumed default for every variant of an item. Some items actually change physically by variant though (e.g. a dropper that drops 1 ore at Base/Shiny but 2 ore at Mythic/Shiny Mythic) — footprint SIZE never differs across variants (verified), but things like drop points, beam reach, or zone size might. When a specific variant genuinely differs from the shared default, fill in that variant’s "geometryOverrides" object with only the field(s) that differ (same shape as the top-level "geometry" entries) instead of duplicating the whole block. Leave it null when the variant matches the default.',
  },
  droppers: buildDroppers(database.records),
  upgraders: buildUpgraders(database.records),
  furnaces: buildFurnaces(database.records),
  decorations: buildDecorations(database.records),
};

await fs.writeFile(outputPath, `${JSON.stringify(worksheet, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`droppers: ${worksheet.droppers.length}, upgraders: ${worksheet.upgraders.length}, furnaces: ${worksheet.furnaces.length}, decorations: ${worksheet.decorations.length}`);
console.log(`droppers needing a formula: ${worksheet.droppers.filter((item) => item.needsFormula).length}`);
console.log(`upgraders needing a formula: ${worksheet.upgraders.filter((item) => item.needsFormula).length}`);
console.log(`furnaces needing a formula: ${worksheet.furnaces.filter((item) => item.needsFormula).length}`);
