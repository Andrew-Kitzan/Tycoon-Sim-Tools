// Item icons are looked up as icons/items/{exact item name}.png. Windows
// ignores letter case, so a mismatch looks fine locally, but GitHub Pages is
// case-sensitive and the icon 404s on the live site. This happened with
// "White hat Dropper" (data) vs "White Hat Dropper.png" (file), 2026-10-21.
// This test fails if any tracked icon matches an item name only when case is
// ignored.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const files = execSync('git ls-files icons/items', { cwd: root, encoding: 'utf8' })
  .trim().split('\n').filter(Boolean).map((file) => file.replace('icons/items/', ''));
const exact = new Set(files);
const byLowerCase = new Map(files.map((file) => [file.toLowerCase(), file]));

const sandbox = {};
new Function('globalThis', fs.readFileSync(path.join(root, 'data', 'items.generated.js'), 'utf8'))(sandbox);
const names = new Set();
for (const record of sandbox.TycoonDatabase?.records ?? []) {
  names.add(`${record.name}${record.variant === 'Base' ? '' : ` ${record.variant}`}.png`);
}

const mismatches = [...names]
  .filter((name) => !exact.has(name) && byLowerCase.has(name.toLowerCase()))
  .map((name) => `${name} (file is ${byLowerCase.get(name.toLowerCase())})`);
assert.deepEqual(mismatches, [], `icon file names must match item names exactly, including letter case:\n${mismatches.join('\n')}`);
console.log(`Checked ${names.size} item icon names against icons/items for letter-case mismatches — none found.`);
