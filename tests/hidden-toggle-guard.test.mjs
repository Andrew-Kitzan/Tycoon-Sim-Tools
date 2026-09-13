// Regression guard for a bug class that has now bitten this project three
// times: an element gets toggled via the `hidden` attribute in JS
// (`el.hidden = true/false`), but its CSS class also has an author rule
// setting `display` to something other than `none` (e.g. `display: flex`
// for a layout container). The browser's default UA stylesheet rule
// `[hidden] { display: none; }` has low specificity, so any author rule of
// equal-or-higher specificity silently wins and the element never actually
// hides — it just sits there, invisible-looking in a quick glance at the
// markup but still fully laid out and (worse) visible if anything shifts.
//
// Past casualties, each caught by hand after real user-visible bleed-through:
// `.topbar`, `.wiki-tool` (twice — see AI_HANDOFF.md's 2026-09-13 entries).
//
// This is NOT a full CSS parser — it's a pragmatic static-analysis pass
// tuned to this codebase's convention of one-rule-per-line CSS with no
// nested selectors. It flattens `@media` blocks (deliberately: the display
// rule and its `[hidden]` override need to exist somewhere, condition
// aside) and only resolves `.class`/`#id` selectors bound to a JS variable
// that is later assigned `.hidden = `. It will not catch every possible
// case — treat it as a safety net for the common "toggle a whole
// tool/section" pattern, not a guarantee.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const jsFiles = [
  'app.js',
  'capgrader-generator.js',
  'luck-crate-generator.js',
  'abbrev-calculator.js',
  'mpa-chopping-block.js',
  'feedback.js',
  'help.js',
].filter((file) => fs.existsSync(path.join(root, file)));

const indexSource = read('index.html');
const stylesSource = read('styles.css');
const jsSource = jsFiles.map(read).join('\n');

// --- Step 1: find every selector that is ever toggled via `.hidden = ` ----
const varToSelector = new Map();
for (const match of jsSource.matchAll(/(?:const|let)\s+(\w+)\s*=\s*document\.querySelector\((['"`])(.*?)\2\)/g)) {
  varToSelector.set(match[1], match[3]);
}

const toggledSelectors = new Set();
for (const match of jsSource.matchAll(/\b(\w+)\??\.hidden\s*=/g)) {
  const selector = varToSelector.get(match[1]);
  if (selector) toggledSelectors.add(selector);
}
// Also catch the inline `document.querySelector('...').hidden = ` form.
for (const match of jsSource.matchAll(/document\.querySelector\((['"`])(.*?)\1\)\.hidden\s*=/g)) {
  toggledSelectors.add(match[2]);
}

// --- Step 2: resolve each selector down to the CSS class name(s) it needs -
function classesForSelector(selector) {
  if (selector.startsWith('.')) {
    const cls = selector.slice(1).split(/[.\s\[:]/)[0];
    return cls ? [cls] : [];
  }
  if (selector.startsWith('#')) {
    const id = selector.slice(1);
    const tagMatch = indexSource.match(new RegExp(`id=["']${id}["'][^>]*class=["']([^"']+)["']`))
      ?? indexSource.match(new RegExp(`class=["']([^"']+)["'][^>]*id=["']${id}["']`));
    return tagMatch ? tagMatch[1].split(/\s+/).filter(Boolean) : [];
  }
  return []; // attribute selectors etc. — not a container-toggle pattern, skip.
}

const toggledClasses = new Set();
for (const selector of toggledSelectors) {
  for (const cls of classesForSelector(selector)) toggledClasses.add(cls);
}

// --- Step 3: flatten styles.css into individual (selectorList, body) rules
// (comments stripped first — otherwise a `/* ... */` block sitting right
// before a rule gets swallowed into its "selector" text by the regex below).
const stylesNoComments = stylesSource.replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...stylesNoComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selectors: m[1].split(',').map((s) => s.trim()).filter(Boolean),
  body: m[2],
}));

const hiddenOverrides = new Set();
const displayOffenders = new Map(); // class -> example offending selector
for (const rule of rules) {
  for (const selector of rule.selectors) {
    const hiddenMatch = selector.match(/^\.([a-zA-Z0-9_-]+)\[hidden\]/);
    if (hiddenMatch) {
      hiddenOverrides.add(hiddenMatch[1]);
      continue;
    }
    if (selector.includes('[hidden]')) continue; // some other element's override, not this one's display rule.
    const displayMatch = rule.body.match(/display\s*:\s*([a-zA-Z-]+)/);
    if (!displayMatch || displayMatch[1] === 'none') continue;
    // `display` applies to whatever the selector actually matches, i.e. its
    // last compound (rightmost) part — a rule like `.item-tooltip strong`
    // sets display on the descendant <strong>, not on `.item-tooltip`
    // itself, so only look at the final whitespace-separated segment.
    const segments = selector.split(/\s+/).filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? '';
    for (const clsMatch of lastSegment.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
      if (!displayOffenders.has(clsMatch[1])) displayOffenders.set(clsMatch[1], selector);
    }
  }
}

// --- Step 4: any toggled class with a non-none display rule MUST also have
// a `.class[hidden] { display: none; }` override somewhere.
const violations = [];
for (const cls of toggledClasses) {
  if (displayOffenders.has(cls) && !hiddenOverrides.has(cls)) {
    violations.push(`.${cls} (display rule via "${displayOffenders.get(cls)}", toggled via .hidden in JS, no ".${cls}[hidden] { display: none; }" override found)`);
  }
}

assert.deepEqual(
  violations,
  [],
  `Found element(s) toggled via .hidden = in JS whose CSS class sets an author "display" property with no matching [hidden] override, so hiding them silently does nothing:\n  ${violations.join('\n  ')}\n\nFix: add ".class[hidden] { display: none; }" next to that class's rule.`,
);

console.log(`Checked ${toggledClasses.size} JS-toggled element classes against styles.css for the [hidden]-vs-display override bug — none regressed.`);
