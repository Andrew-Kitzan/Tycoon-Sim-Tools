// Generates data/crate-luck-data.generated.js from the "Crates" sheet of
// data/Tycoon Sim Database.xlsx, for the Luck/Crate Simulator tool
// (luck-crate-generator.js). Unlike data/item-geometry-worksheet.json, this
// file needs no manual judgment calls — every field here (crate name, cost,
// per-item weight/rarity/size/variant) is mechanically present in the sheet,
// so it's a generated cache like data/items.generated.js, not a hand-maintained
// worksheet. Re-run this script any time the workbook's Crates sheet changes;
// never hand-edit the output.
//
// Sheet layout (verified directly against the real cell formulas, not
// guessed): repeated blocks of [crate name row] -> ... -> [header row
// containing "Item Type"/"Weight"/"Rarity"] -> one row per item *variant*
// (Base/Shiny/Mythic/Shiny Mythic each on their own row, grouped by
// consecutive matching Name) -> a totals row (blank "Item Type" cell) ->
// blank spacer rows -> next crate name row. The special "Any Crate" block
// works exactly the same way; its items get flagged anyCrate:true instead of
// being tied to one purchasable crate.

import fs from 'node:fs/promises';
import path from 'node:path';
import { openXlsx } from '../engine/xlsx-reader.mjs';

const root = path.resolve(import.meta.dirname, '..');
const workbookPath = path.join(root, 'data', 'Tycoon Sim Database.xlsx');
const outputPath = path.join(root, 'data', 'crate-luck-data.generated.js');

function clean(value) {
  return String(value ?? '').trim();
}

function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(clean(value).replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : null;
}

const HEADER = {
  itemType: 0, name: 3, variant: 5, rarity: 6, size: 7, weight: 9, odds: 24,
  obtainment: 25, mainStatType: 27, mainStat: 29, otherStats: 31, otherEffects: 33,
};

function isHeaderRow(row) {
  return clean(row?.[HEADER.itemType]) === 'Item Type' && clean(row?.[HEADER.weight]) === 'Weight';
}

function parseCrateBlocks(rows) {
  const blocks = [];
  let i = 0;
  while (i < rows.length) {
    const cell0 = clean(rows[i]?.[0]);
    // A crate-name row is a lone non-empty first cell that isn't itself a
    // header/label row we already know how to recognize.
    const isLegendLabel = /^(Shiny|Mythic|Unbox) Luck$/i.test(cell0);
    const isNumeric = cell0 !== '' && Number.isFinite(Number(cell0));
    if (cell0 && cell0 !== 'Crates' && !isLegendLabel && !isNumeric && !isHeaderRow(rows[i]) && !/^Cost:/i.test(cell0)) {
      const nameRow = i;
      // A real crate block always has a "Cost: X" line a few rows below the
      // name, before its header row — require that to reject false matches
      // (e.g. the "Shiny Luck"/"Mythic Luck"/"Unbox Luck" legend cells,
      // which have neither).
      const costRowLimit = Math.min(nameRow + 8, rows.length);
      let costRow = -1;
      for (let j = nameRow + 1; j < costRowLimit; j += 1) {
        if (/^Cost:/i.test(clean(rows[j]?.[0]))) { costRow = j; break; }
      }
      if (costRow === -1) { i += 1; continue; }
      let headerRow = -1;
      for (let j = costRow + 1; j < Math.min(costRow + 15, rows.length); j += 1) {
        if (isHeaderRow(rows[j])) { headerRow = j; break; }
      }
      if (headerRow === -1) { i += 1; continue; }
      const cost = clean(rows[costRow][0]).replace(/^Cost:\s*/i, '');
      const itemRows = [];
      let k = headerRow + 1;
      while (k < rows.length && clean(rows[k]?.[HEADER.itemType])) {
        itemRows.push(rows[k]);
        k += 1;
      }
      blocks.push({ name: cell0, cost, itemRows });
      i = k;
    } else {
      i += 1;
    }
  }
  return blocks;
}

const workbookBytes = await fs.readFile(workbookPath);
const workbook = openXlsx(workbookBytes);
const rows = workbook.readSheet('Crates', { maxRows: 2000 });
const blocks = parseCrateBlocks(rows);

// The Crates sheet's own "Other Effects"/mainStat columns are sometimes just
// a placeholder ("Refer to the 'Stats for Nerds' Page", or a blank mainStat
// for items whose real formula is too complex for one cell) — sync-database.mjs
// already resolves this properly (parseStatsForNerds) when building
// data/items.generated.js, which runs before this script in the normal
// `npm run database:sync && node scripts/build-crate-luck-data.mjs` pipeline.
// Reuse that already-resolved data instead of re-deriving/duplicating the
// resolution logic here.
const generatedPath = path.join(root, 'data', 'items.generated.js');
let resolvedByKey = new Map();
try {
  const generatedSource = await fs.readFile(generatedPath, 'utf8');
  const payload = JSON.parse(generatedSource.slice(generatedSource.indexOf('=') + 1, generatedSource.lastIndexOf(';')));
  for (const record of payload.records) {
    if (!resolvedByKey.has(record.key)) resolvedByKey.set(record.key, record);
  }
} catch {
  // data/items.generated.js missing or unreadable — fall back to the Crates
  // sheet's own (sometimes-placeholder) text below.
}

const items = {};
const crates = [];

for (const block of blocks) {
  const isAnyCrate = /^any crate$/i.test(block.name);
  const crateKey = block.name.replace(/\s*Crate$/i, '').trim();
  const itemKeys = [];

  // Group consecutive rows by Name — each item's Base/Shiny/Mythic/Shiny
  // Mythic variants are always adjacent in the sheet.
  let currentName = null;
  for (const row of block.itemRows) {
    const name = clean(row[HEADER.name]);
    const variant = clean(row[HEADER.variant]);
    if (!name || !variant) continue;
    if (!items[name]) {
      items[name] = {
        rarity: clean(row[HEADER.rarity]) || null,
        size: clean(row[HEADER.size]) || null,
        anyCrate: isAnyCrate,
        crates: [],
        variants: {},
      };
    }
    const item = items[name];
    if (isAnyCrate) item.anyCrate = true;
    if (!isAnyCrate && !item.crates.includes(crateKey)) item.crates.push(crateKey);
    const weight = numeric(row[HEADER.weight]);
    const resolved = resolvedByKey.get(`${name}::${variant}`.toLowerCase());
    const sheetEffects = clean(row[HEADER.otherEffects]) || null;
    const isPlaceholder = sheetEffects && /refer to (?:the )?["“]?stats for nerds/i.test(sheetEffects);
    item.variants[variant] = {
      weight: weight && weight > 0 ? weight : null,
      mainStat: resolved?.mainStat ?? numeric(row[HEADER.mainStat]),
      mainStatType: resolved?.mainStatType ?? (clean(row[HEADER.mainStatType]) || null),
      otherStats: clean(row[HEADER.otherStats]) || null,
      effects: (isPlaceholder ? resolved?.description || resolved?.effects : null) ?? sheetEffects,
      obtainment: clean(row[HEADER.obtainment]) || null,
      sheetOdds: clean(row[HEADER.odds]) || null,
    };
    if (currentName !== name) itemKeys.push(name);
    currentName = name;
  }

  if (!isAnyCrate) {
    crates.push({ name: crateKey, cost: block.cost, items: [...new Set(itemKeys)] });
  }
}

const payload = { generatedAt: new Date().toISOString(), sourceWorkbook: 'data/Tycoon Sim Database.xlsx', crates, items };
await fs.writeFile(outputPath, `globalThis.CrateLuckData = ${JSON.stringify(payload)};\n`);
console.log(`Wrote ${crates.length} crates and ${Object.keys(items).length} items to ${path.relative(root, outputPath)}.`);
