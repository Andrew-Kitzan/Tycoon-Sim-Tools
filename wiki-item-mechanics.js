// Wiki "Stats for Nerds" sections for item pages — the formulas, tables,
// calculators and how-to-use notes from the database's own "Stats for
// Nerds" sheet (data/Tycoon Sim Database.xlsx), plus the build rules in
// docs/BUILD_RULES.md (Crimson timing, chained Tikis, Lambda outcomes).
// Plain script, loaded before wiki-tool.js, which renders an entry's
// sections on that item's page and wires its calculator inputs.
//
// Each entry: { intro(ctx), calc?: { inputs, result(values, ctx) }, after?(ctx) }
// ctx = { name, variant, vm (variant multiplier), v (the Index variant record:
// mainStat, oreSize, dropSpeed, ...) }. All three return HTML strings.

(function () {
  const VARIANT_MULTI = { Base: 1, Shiny: 1.1, Mythic: 1.25, 'Shiny Mythic': 1.5 };
  // The formula's variantMulti line, filled in for the form selected on the page.
  const variantLine = (ctx) => `variantMulti = ${ctx.vm} for ${ctx.variant}   (Base 1, Shiny 1.1, Mythic 1.25, Shiny Mythic 1.5)`;

  // ---- Formatting / markup helpers -------------------------------------------
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const trim = (x, digits = 2) => String(Number(x.toFixed(digits)));
  const mult = (x, digits = 2) => `${trim(x, digits)}x`;
  const pct = (x) => `${trim(x * 100, 2)}%`;
  // An amount taken OFF a multiplier (Mischievous Furnace's per-upgrade
  // loss) — written "−1.32", never "1.32x", so it can't be read as a multiplier.
  const minus = (x, digits = 3) => `−${trim(x, digits)}`;
  function compact(n) {
    const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    const [div, suffix] = units.find(([min]) => Math.abs(n) >= min) ?? [1, ''];
    return `${trim(n / div, 2)}${suffix}`;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const p = (html) => `<p>${html}</p>`;
  const tip = (html) => `<p class="wiki-index-lie">${html}</p>`;
  const sub = (title) => `<h4 class="wiki-scanner-subheading">${esc(title)}</h4>`;
  const formula = (lines) => `<div class="wiki-scanner-scroll"><pre class="wiki-scanner-formula">${esc(lines.join('\n'))}</pre></div>`;
  const steps = (items) => `<ol class="wiki-mech-steps">${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
  const tiles = (pairs) => `<div class="wiki-index-stats">${pairs.map(([label, value]) => `<div class="wiki-index-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`;
  function table(headers, rows) {
    return `<div class="wiki-scanner-scroll"><table class="wiki-data-table wiki-scanner-table">
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }
  const figure = (file, caption) => `
    <figure class="wiki-mech-figure">
      <img src="icons/wiki/mechanics/${file}" alt="${esc(caption)}" loading="lazy" onerror="this.parentElement.remove()">
      <figcaption>${esc(caption)}</figcaption>
    </figure>`;
  const qa = (question, answer) => `${sub(question)}${p(answer)}`;

// ---- Scanner spacing -----------------------------------------------------------
  // Every scanner of the same type sweeps in sync (one shared beam clock), so
  // copies in a row are not separate rolls. The layout math lives in
  // capgrader-generator.js (globalThis.TycoonScanners.spacing): it simulates
  // the copies as placed and adds copies until ~99% of ore is hit, trying
  // plain-conveyor gaps of 0-12 tiles and keeping the shortest layout.
  const SPACING_SIZES = [0.6, 1, 1.5, 2, 2.7];
  const LANES = { center: 0.5, side: 0.25 };
  const spacingPlan = (name, size, lane) => globalThis.TycoonScanners?.spacing?.(name, size, LANES[lane] ?? 0.5) ?? null;
  const countText = (plan) => (Number.isFinite(plan.units) ? String(plan.units) : `more than ${plan.maxUnits}`);
  const gapText = (plan) => (!Number.isFinite(plan.units) ? '—' : plan.gapTiles ? `${plan.gapTiles} tile${plan.gapTiles === 1 ? '' : 's'}` : 'Back to back');

  function scannerSpacingEntry(name, { status }) {
    return {
      intro: () => [
        sub('Scanner distance'),
        p('Every scanner of the same type sweeps in sync: all their beams move together, on one shared clock. Placed back to back, the next copy often meets the ore at the same point in its sweep, so it misses the same ore the first one missed. Adding more copies right next to each other barely helps.'),
        p('A gap of plain conveyor between copies changes when the ore reaches the next beam, so each copy catches ore the earlier ones missed. Type your ore size below to see how many copies you need and how far apart to place them.'),
        tip(esc(status)),
      ].join(''),
      calc: {
        inputs: [
          { key: 'size', label: 'Your ore size', value: 1, step: 0.05, min: 0.05 },
          { key: 'lane', label: 'Where the ore is', type: 'select', value: 'center', options: [['center', 'Center of belt'], ['side', 'Side of belt']] },
        ],
        result: ({ size, lane }) => {
          const plan = size > 0 ? spacingPlan(name, size, lane) : null;
          if (!plan) return '<p class="wiki-index-muted">Enter an ore size above 0.</p>';
          if (!Number.isFinite(plan.units)) return `<p class="wiki-index-muted">Even ${plan.maxUnits} copies with up to a ${plan.maxGap}-tile gap can't reliably hit this ore. Try changing its size.</p>`;
          return tiles([
            ['Scanners Needed', countText(plan)],
            ['Gap Between Each', gapText(plan)],
            ['Beam to Beam', `${plan.beamToBeam} tiles`],
            ['Total Length', `${plan.tiles} tiles`],
            ['Back to Back Needs', Number.isFinite(plan.backToBackUnits) ? String(plan.backToBackUnits) : `${plan.maxUnits}+`],
          ]);
        },
      },
      after: () => {
        const rows = SPACING_SIZES.map((size) => {
          const plan = spacingPlan(name, size, 'center');
          if (!plan) return [String(size), '—', '—', '—'];
          return [String(size), countText(plan), gapText(plan), Number.isFinite(plan.units) ? `${plan.tiles} tiles` : '—'];
        });
        return [
          table(['Ore Size', 'Scanners', 'Gap Between Each', 'Total Length'], rows),
          p('"Gap" is the empty tiles between one scanner and the next, edge to edge. Fill it with straight Normal, Half or Quarter Conveyor (12 studs/s), with no turns and nothing faster, and point every copy the same way. A different speed or a turn changes the timing the gap depends on. "Beam to beam" is the scanner\'s length plus the gap.'),
          p('"Needed" means enough copies that about 99% of ore get hit at least once. The table assumes ore down the center of the belt; ore on the sides can need a different number.'),
        ].join('');
      },
    };
  }

  // ---- Formulas ----------------------------------------------------------------
  const throne = (age, vm) => clamp(50 - ((age - 15) / 45) * 35, 15, 50) * vm;
  const runic = (age, vm) => Math.min(3, 3 ** (Math.max(0, age) / 120)) * vm;
  const sugarbombExploded = (age) => clamp((age - 60) / 15, 0, 1);
  const parasitic = (base, vm) => (base < 1000 || base > 375000 ? 1 : 1 + ((base - 1000) * (30 * vm - 1)) / 374000);
  const raceway = (size, vm) => 1 + (5 * vm - 1) * ((1 - clamp(size, 0.25, 1)) / 0.75);
  const mischievous = (n, vm) => 1 + (100 * vm - 1) * (1 - clamp((n - 25) / 75, 0, 1));
  const crimsonCombusts = (seconds) => clamp((seconds - 1) / 14, 0, 1);
  function lambdaSurvival(n) {
    let s = 1;
    for (let k = 2; k <= n; k += 1) s *= 1.5 / k;
    return n >= 1 ? s : 1;
  }
  const lambdaGood = (n) => (16 / 19) ** n;
  const VARIANT_ORDER = ['Base', 'Shiny', 'Mythic', 'Shiny Mythic'];
  const CORIUM_MAX_EATS = 8;
  const UPGRADER_FIT_SIZE = 2.4;

  // ---- Entries -------------------------------------------------------------------
  const duplication = (role) => ({
    intro: (ctx) => [
      p(role === 'replicator'
        ? 'The Ore Replicator clones your ore. On its own the clone is just a copy, but it\'s the only kind of ore the Dual Plasma Upgrader will upgrade.'
        : `The Dual Plasma Upgrader only upgrades duplicated ore (made by an Ore Replicator) for ${mult(ctx.v.mainStat)}. Any original, non-duplicated ore that touches it is destroyed.`),
      sub('Keeping your original ore safe'),
      p('Because the Ore Replicator\'s upgrade part is 2 tiles long, the original ore and its new clone come out of it separated. That gap lets you split them onto different paths:'),
      steps([
        'Send the <strong>original</strong> ore into a teleporter right after the Ore Replicator, so it continues on through the rest of your base untouched.',
        'Let the <strong>clone</strong> continue straight on into the Dual Plasma Upgrader, which upgrades it.',
        'Nothing original ever touches the Dual Plasma, so nothing gets destroyed — you keep all of your original ore and get an upgraded clone on top.',
      ]),
      figure('ore-duplication.jpg', 'The originals drop into the teleporter below the Ore Replicator, while the clones continue right through the Dual Plasma Upgrader (from the database).'),
    ].join(''),
  });

  const ENTRIES = {
    "Periastron's Throne": {
      intro: (ctx) => [
        p(`Throne's multiplier depends on how old the ore is when it reaches the furnace (counted from when it was dropped). A ${esc(ctx.variant)} Throne stays at its max of ${mult(50 * ctx.vm)} until the ore is 15 seconds old, then drops in a straight line to its minimum of ${mult(15 * ctx.vm)} at 60 seconds — losing ${mult((35 / 4.5) * ctx.vm)} every 10 seconds.`),
        formula([
          'multiplier = (50 − ((oreAge − 15) / 45) × 35) × variantMulti',
          'oreAge under 15 s counts as 15 s, over 60 s counts as 60 s',
          variantLine(ctx),
        ]),
      ].join(''),
      calc: {
        inputs: [{ key: 'age', label: 'Ore age (seconds)', value: 45, step: 1 }],
        result: ({ age }, ctx) => tiles([['Multiplier', mult(throne(age, ctx.vm))]]),
      },
      after: (ctx) => [
        table(['Ore Age', `Multiplier (${ctx.variant})`], [15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((a) => [`${a} s`, mult(throne(a, ctx.vm))])),
        qa('Is Throne worth it?', `Most end-game setups take about 45 seconds for ore to reach the furnace, which gives a ${esc(ctx.variant)} Throne an average of ${mult(throne(45, ctx.vm))}. Every second counts after the first 15, so with Throne the faster your ore gets to the furnace, the better.`),
      ].join(''),
    },

    'Runic Array': {
      intro: (ctx) => [
        p(`Runic Array's multiplier grows with the ore's age (counted from when it was dropped). A ${esc(ctx.variant)} Runic Array starts at ${mult(ctx.vm)} and grows exponentially to ${mult(3 * ctx.vm)} at 2 minutes old, then stays at ${mult(3 * ctx.vm)}.`),
        formula([
          'multiplier = 3 ^ (oreAge / 120) × variantMulti',
          'capped at 3 × variantMulti from 120 s on',
          variantLine(ctx),
        ]),
      ].join(''),
      calc: {
        inputs: [{ key: 'age', label: 'Ore age (seconds)', value: 60, step: 1 }],
        result: ({ age }, ctx) => tiles([['Multiplier', mult(runic(age, ctx.vm), 3)]]),
      },
      after: (ctx) => [
        table(['Ore Age', `Multiplier (${ctx.variant})`], [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].map((a) => [`${a} s`, mult(runic(a, ctx.vm), 3)])),
        qa('Is it worth stalling for the max multi?', 'If you have the space and you\'re not hitting your ore limit, yes — it\'s worth stalling for a better multi. If you are at your ore limit, it isn\'t: getting ore to the furnace faster frees up your ore limit, which is worth more.'),
      ].join(''),
    },

    'Sugarbomb Dropper': {
      intro: () => [
        p('Sugarbomb ore has the Neon material and explodes at a random time between 60 and 75 seconds after it\'s dropped. Every moment in that window is equally likely, so the longer your ore takes to reach the furnace past 60 seconds, the more of it explodes on the way.'),
        formula([
          'explodes at = 60 + random(0 to 1) × 15 seconds',
          'chance it has exploded by oreAge = (oreAge − 60) / 15   (0% before 60 s, 100% from 75 s)',
        ]),
      ].join(''),
      calc: {
        inputs: [{ key: 'age', label: 'Seconds from drop to furnace', value: 65, step: 1 }],
        result: ({ age }) => tiles([['Survives', pct(1 - sugarbombExploded(age))], ['Explodes', pct(sugarbombExploded(age))]]),
      },
      after: () => [
        table(['Ore Age', 'Survives', 'Explodes'], [60, 62.5, 65, 67.5, 70, 72.5, 75].map((a) => [`${a} s`, pct(1 - sugarbombExploded(a)), pct(sugarbombExploded(a))])),
        qa('How long until Sugarbomb is useless?', 'Keep your base under 1 minute from drop to furnace and you won\'t lose any ore. Past about the 65-second mark you\'re losing a third of it or more, so try your best to stay under that.'),
      ].join(''),
    },

    'Parasitic Fiend': {
      intro: (ctx) => [
        p(`Parasitic Fiend's multiplier depends on the ore's starting value — what the dropper made it worth, before any upgrades. A ${esc(ctx.variant)} Parasitic Fiend scales in a straight line from 1x at 1K up to ${mult(30 * ctx.vm)} at 375K. Below 1K or above 375K it's only 1x.`),
        formula([
          'if startingValue < 1,000 or startingValue > 375,000:  multiplier = 1',
          'otherwise:  multiplier = 1 + (startingValue − 1,000) × (30 × variantMulti − 1) / 374,000',
          variantLine(ctx),
        ]),
      ].join(''),
      calc: {
        inputs: [{ key: 'base', label: 'Ore starting value', value: 337500, step: 1000 }],
        result: ({ base }, ctx) => tiles([['Multiplier', mult(parasitic(base, ctx.vm), 3)]]),
      },
      after: (ctx) => [
        table(['Starting Value', `Multiplier (${ctx.variant})`], [1000, 50000, 100000, 150000, 275000, 300000, 337500, 375000, 400000].map((b) => [compact(b), mult(parasitic(b, ctx.vm), 3)])),
        qa('Is it useful?', 'It can be with Kunzite or Sugarbomb ore. If your ore\'s starting value isn\'t above 300K and at most 375K, it\'s not worth using.'),
      ].join(''),
    },

    'Raceway Accelerator': {
      intro: (ctx) => [
        p(`The smaller the ore, the bigger the multi. On a ${esc(ctx.variant)} Raceway Accelerator, ore size 0.25 or under gets the full ${mult(5 * ctx.vm)}; ore size 1 or over gets 1x; in between it scales in a straight line.`),
        formula([
          'multiplier = 1 + (5 × variantMulti − 1) × ((1 − oreSize) / 0.75)',
          'oreSize under 0.25 counts as 0.25, over 1 counts as 1',
          variantLine(ctx),
        ]),
      ].join(''),
      calc: {
        inputs: [{ key: 'size', label: 'Ore size', value: 0.53, step: 0.01 }],
        result: ({ size }, ctx) => tiles([['Multiplier', mult(raceway(size, ctx.vm))]]),
      },
      after: (ctx) => [
        table(['Ore Size', `Multiplier (${ctx.variant})`], [0.25, 0.44, 0.53, 0.62, 0.75, 0.89, 0.98, 1].map((s) => [String(s), mult(raceway(s, ctx.vm))])),
        qa('Smaller the ore the better', 'Place it after your 5 shrinkers and before any expanders, while the ore is at its smallest.'),
      ].join(''),
    },

    'Mischievous Furnace': {
      intro: (ctx) => [
        p(`Mischievous Furnace rewards ore that went through few upgrades. On a ${esc(ctx.variant)} Mischievous Furnace, 25 or fewer upgrades gets the full ${mult(100 * ctx.vm)}, 100 or more gets 1x, and in between it scales in a straight line.`),
        formula([
          'multiplier = 1 + (100 × variantMulti − 1) × (1 − (upgrades − 25) / 75)',
          'upgrades under 25 counts as 25, over 100 counts as 100',
          variantLine(ctx),
        ]),
      ].join(''),
      calc: {
        inputs: [{ key: 'n', label: 'Upgrades the ore went through', value: 80, step: 1 }],
        result: ({ n }, ctx) => {
          const count = Math.round(n);
          const now = mischievous(count, ctx.vm);
          const next = mischievous(count + 1, ctx.vm);
          const breakEven = now / next;
          const pairs = [['Multiplier', mult(now)], ['One More Upgrade', mult(next)], ['Furnace Loses', now > next ? `${minus(now - next)} (${pct(1 - next / now)} of its multi)` : 'Nothing'], ['Break-even Upgrader', breakEven > 1 ? mult(breakEven, 3) : 'Any']];
          let list;
          if (count < 25) list = p(`Upgrades ${count + 1} through 25 are free — the furnace stays at its max, so use whatever you like.`);
          else if (count >= 100) list = p('The furnace is already down to 1x, so extra upgrades can\'t cost it anything more.');
          else {
            // Every form of every upgrader that falls short — a player might
            // own any of them, so a Base form that fails is listed even when
            // that item's Shiny form is fine.
            const bad = (ctx.upgraders ?? [])
              .map((u) => ({ name: u.name, forms: VARIANT_ORDER.filter((f) => u.variants[f] != null && u.variants[f] < breakEven).map((f) => [f, u.variants[f]]) }))
              .filter((u) => u.forms.length)
              .sort((a, b) => a.forms[0][1] - b.forms[0][1] || a.name.localeCompare(b.name));
            const formCount = bad.reduce((sum, u) => sum + u.forms.length, 0);
            list = bad.length
              ? `${p(`At ${count} upgrades, adding another upgrader takes ${trim(now - next, 3)} off the furnace's multi (${mult(now)} → ${mult(next)}). That's ${pct(1 - next / now)} of the furnace's multi, so the upgrader has to multiply your ore by at least ${mult(breakEven, 3)} to make up for it.`)}${p(`Check with ore worth 100 at the furnace: without the extra upgrader it sells for 100 × ${mult(now)} = ${Math.round(100 * now).toLocaleString()}. With a ${mult(breakEven, 3)} upgrader it's ${trim(100 * breakEven, 1)} × ${mult(next)} = ${Math.round(100 * breakEven * next).toLocaleString()} — the same. Anything below ${mult(breakEven, 3)} sells for less.`)}${p(formCount === 1 ? 'This upgrader form isn\'t worth it:' : `These ${formCount} upgrader forms (${bad.length} item${bad.length === 1 ? '' : 's'}) aren't worth it:`)}<ul class="wiki-mech-chips">${bad.map((u) => `<li>${esc(u.name)} <span>${u.forms.map(([f, m]) => `${esc(f)} ${mult(m, 3)}`).join(' · ')}</span></li>`).join('')}</ul>`
              : p(`At ${count} upgrades, any upgrader of at least ${mult(breakEven, 3)} is worth adding — every form of every multiplier upgrader clears that.`);
          }
          return tiles(pairs) + list;
        },
      },
      after: (ctx) => {
        const loss = (100 * ctx.vm - 1) / 75;
        return [
          sub('How much each upgrade costs the furnace'),
          p(`Between 25 and 100 upgrades, every upgrade the ore goes through takes the same flat amount off the furnace's multiplier: <strong>${minus(loss)}</strong> on a ${esc(ctx.variant)} Mischievous Furnace.`),
          table(['Variant', 'Max (≤ 25 upgrades)', 'Lost per Upgrade'], Object.entries(VARIANT_MULTI).map(([name, vm]) => [name === ctx.variant ? `${name} (selected)` : name, mult(100 * vm), minus((100 * vm - 1) / 75)])),
          sub('Why the break-even goes up when the loss is flat'),
          p('The furnace does lose the same flat amount every upgrade — but your ore\'s final value is all your upgraders multiplied together, then multiplied by the furnace. So what matters is what <em>fraction</em> of the furnace\'s multi each upgrade takes, and a flat loss is a bigger and bigger fraction as the multi shrinks. An upgrader is worth adding only if its own multiplier makes up for that fraction:'),
          formula([
            'worth it if  upgraderMulti > furnaceNow / furnaceAfter',
            `furnaceAfter = furnaceNow − ${trim(loss, 3)}   (${ctx.variant}, between 25 and 100 upgrades)`,
          ]),
          p(`On a ${esc(ctx.variant)} furnace: at 25 upgrades, ${mult(mischievous(25, ctx.vm))} → ${mult(mischievous(26, ctx.vm))} only loses ${pct(1 - mischievous(26, ctx.vm) / mischievous(25, ctx.vm))} of its multi, so anything above ${mult(mischievous(25, ctx.vm) / mischievous(26, ctx.vm), 3)} is worth it. At 97 upgrades, ${mult(mischievous(97, ctx.vm))} → ${mult(mischievous(98, ctx.vm))} loses the same ${minus(loss)}, but that's ${pct(1 - mischievous(98, ctx.vm) / mischievous(97, ctx.vm))} of its multi, so an upgrader now needs ${mult(mischievous(97, ctx.vm) / mischievous(98, ctx.vm), 3)}.`),
          p('Put your upgrade count in the calculator above to see every upgrader form that isn\'t worth using. Additive upgraders and ones whose multiplier depends on their effect aren\'t listed.'),
          table(['Upgrades', `Multiplier (${ctx.variant})`, 'Break-even for the next upgrader'], [25, 40, 50, 60, 75, 80, 90, 96, 99].map((n) => [String(n), mult(mischievous(n, ctx.vm)), mult(mischievous(n, ctx.vm) / mischievous(n + 1, ctx.vm), 3)])),
        ].join('');
      },
    },

    'Crimson Pillars': {
      intro: (ctx) => [
        p(`Crimson Pillars don't upgrade ore directly. They mark it, and each marked ore combusts at a random time 1–15 seconds after leaving the Pillars (if it hasn't reached the furnace yet). The ore is destroyed and leaves a phantom zone where it combusted for 30 seconds. Any ore passing through a phantom zone gets ${mult(ctx.v.mainStat)}, up to 3 times per ore (${mult(ctx.v.mainStat ** 3, 3)} max).`),
        sub('Best practice: feed it with a secondary dropper'),
        p('Since every ore that goes through the Pillars gets destroyed, don\'t run your main ore through them. Use a second, separate dropper just to make phantom zones:'),
        steps([
          'Put the Crimson Pillars on their own side track, fed by a secondary dropper. Its ore are only there to be turned into phantom zones, so it doesn\'t need to be valuable.',
          'Bring that side track onto your main track, so the marked ore combust on the main track and leave their phantom zones right where your main ore travels.',
          'Give the marked ore at least 15 seconds of route before the furnace, so all of them combust on the track instead of reaching the furnace first.',
          'Your main ore never go through the Pillars, so none of them get marked or destroyed — they just pick up the phantom zone boosts as they pass.',
        ]),
        figure('crimson-side-track.jpg', 'Crimson Pillars on a side track next to the main line (from the database).'),
        qa('Why do late-game players put Crimson Pillars on a side track?', 'Late-game routes already lose about 75% of their ore to Dragon and Lambdas. Running the main ore through the Pillars would destroy even more, so a side track saves a lot of ore that would otherwise be lost.'),
        sub('How many marked ore combust before the furnace'),
        formula([
          'combust before the furnace = (secondsToFurnace − 1) / 14',
          '0% under 1 s, 100% from 15 s (counted from leaving the Pillars)',
        ]),
      ].join(''),
      calc: {
        inputs: [{ key: 't', label: 'Seconds from the Pillars to the furnace', value: 15, step: 1 }],
        result: ({ t }) => tiles([['Combust on the Track', pct(crimsonCombusts(t))], ['Reach the Furnace', pct(1 - crimsonCombusts(t))]]),
      },
    },

    'Lambda Upgrader': {
      intro: (ctx) => {
        const vm = ctx.vm;
        const outcomes = [
          ['Explosion (ore destroyed)', '1/19', 'Bad'],
          ['Set value to 1', '1/19', 'Bad'],
          [`Fling (ore flung off) & ${mult(2.2 * vm)}`, '1/19', 'Bad'],
          [`+${compact(1000 * vm)}`, '1/19', 'Good'],
          [mult(2.2 * vm), '13/19', 'Good'],
          [mult(3.2 * vm), '1/19', 'Good'],
          [`${mult(6 * vm)} & Sparkle`, '1/19', 'Good'],
        ];
        return [
          sub('Destruction'),
          p('Every time a Lambda upgrades an ore, it first rolls to destroy it. The chance goes up with each Lambda the ore has been through: its 1st Lambda upgrade is always safe, the 2nd has a 25% chance to destroy it, the 3rd 50%, the 4th 62.5%, and so on.'),
          formula([
            'chance to destroy on the k-th Lambda upgrade = 1 − 1.5 / k',
            'chance to survive n Lambdas = 1.5^(n − 1) / n!',
          ]),
          sub('If it survives: picking the outcome'),
          p('An ore that survives then gets one random outcome, all from 19 equally likely slots: 13 of them are the normal multiplier, and the other 6 are one special outcome each. Every Lambda rolls again on its own, so 3 Lambdas means 3 separate outcomes.'),
          table(['Outcome', 'Chance', ''], outcomes),
          sub('Scaling with more Lambdas'),
          formula([
            'survives the destruction rolls = 1.5^(n − 1) / n!',
            'at least one bad outcome      = 1 − (16/19)^n',
            'all good outcomes             = (16/19)^n',
            'survives with all good        = 1.5^(n − 1) / n! × (16/19)^n',
          ]),
        ].join('');
      },
      calc: {
        inputs: [{ key: 'n', label: 'Number of Lambdas', value: 3, step: 1, min: 1 }],
        result: ({ n }) => {
          const count = Math.max(1, Math.round(n));
          return tiles([
            ['Survives Destruction', pct(lambdaSurvival(count))],
            ['Any Bad Outcome', pct(1 - lambdaGood(count))],
            ['All Good Outcomes', pct(lambdaGood(count))],
            ['Survives With All Good', pct(lambdaSurvival(count) * lambdaGood(count))],
          ]);
        },
      },
      after: () => [
        table(['Lambdas', 'Survives', 'Any Bad', 'All Good', 'Survives With All Good'], [1, 2, 3, 4, 5].map((n) => [String(n), pct(lambdaSurvival(n)), pct(1 - lambdaGood(n)), pct(lambdaGood(n)), pct(lambdaSurvival(n) * lambdaGood(n))])),
        qa('Why 3 Lambdas instead of 2 or 4?', 'The more Lambdas you have, the more multi you can get — but it also gets much more likely that something bad happens or the ore gets destroyed. 3 is the sweet spot between the two. Since Lambda can give the Sparkle effect, place it after Acid Plant if you can easily wipe effects with an Ore Washer.'),
      ].join(''),
    },

    'Ore Replicator': duplication('replicator'),
    'Dual Plasma Upgrader': duplication('dual-plasma'),

    'Corium Dropper': {
      intro: (ctx) => [
        p(`Corium ore eats every non-Corium ore it touches that has an effect. Each time it eats one, it grows 1.1x bigger and its value gets another 1.1x — but the value bonus stops after ${CORIUM_MAX_EATS} eats (${mult(1.1 ** CORIUM_MAX_EATS, 3)} max).`),
        formula([
          `value = dropperValue × 1.1 ^ eats   (eats capped at ${CORIUM_MAX_EATS} for value)`,
          `size  = ${ctx.v.oreSize ?? 1.25} × 1.1 ^ eats`,
        ]),
        sub('Limits'),
        steps([
          'It only eats ore that has an effect, and never other Corium ore.',
          `The value bonus maxes out at ${CORIUM_MAX_EATS} eats — anything it eats after that is wasted.`,
          `It keeps getting bigger as it eats. Most upgraders only fit ore under size ${UPGRADER_FIT_SIZE}, so a fully fed Corium needs shrinking (or fewer eats) to keep fitting.`,
        ]),
      ].join(''),
      calc: {
        inputs: [{ key: 'eats', label: 'Ores eaten', value: 8, step: 1, min: 0 }],
        result: ({ eats }, ctx) => {
          const count = Math.max(0, Math.round(eats));
          const valueMulti = 1.1 ** Math.min(count, CORIUM_MAX_EATS);
          const size = (ctx.v.oreSize ?? 1.25) * 1.1 ** count;
          return tiles([
            ['Value Multi', mult(valueMulti, 3)],
            ['Ore Value', typeof ctx.v.mainStat === 'number' ? compact(ctx.v.mainStat * valueMulti) : '—'],
            ['Ore Size', `${trim(size, 2)}${size >= UPGRADER_FIT_SIZE ? ' (too big for most upgraders)' : ''}`],
          ]);
        },
      },
      after: (ctx) => [
        table(['Eaten', 'Value Multi', 'Ore Value', 'Ore Size'], [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
          const valueMulti = 1.1 ** n;
          const size = (ctx.v.oreSize ?? 1.25) * 1.1 ** n;
          return [String(n), mult(valueMulti, 3), typeof ctx.v.mainStat === 'number' ? compact(ctx.v.mainStat * valueMulti) : '—', `${trim(size, 2)}${size >= UPGRADER_FIT_SIZE ? ' ⚠' : ''}`];
        })),
        p(`⚠ = size ${UPGRADER_FIT_SIZE} or bigger, too big for most upgraders.`),
        qa('Is it useful?', `If you can keep the ore small enough to still fit inside most upgraders (under size ${UPGRADER_FIT_SIZE}) and feed it just right so it hits the max multi and eats nothing extra, it could be a good strat. The problem is it takes up a lot of room, and current P2W plots don't have that room.`),
      ].join(''),
    },

    'Tiki Evaluator': {
      intro: (ctx) => {
        const m = ctx.v.mainStat;
        const add = m * 10000;
        return [
          p(`Every 5 seconds the Tiki switches phase, cycling through 3: <strong>Red X</strong> destroys every ore that touches it, <strong>Green Circle</strong> gives ${mult(m)}, and <strong>Yellow Triangle</strong> gives +${compact(add)}. Each phase is on a third of the time, so on its own a Tiki destroys 1 in 3 ore.`),
          sub('Using 2 or more: chain them'),
          p('Place your Tikis right next to each other in a chain, so an ore reaches the next Tiki while it\'s still in the same phase. Chained Tikis act as one: if the first is on Red X the ore was already destroyed, and if it\'s on Green or Yellow, every Tiki after it is too — so it only ever rolls the 1-in-3 destruction once.'),
          p('Spread apart, each Tiki is a separate roll and the losses stack up fast.'),
          formula([
            'chained:   survives = 2/3              (no matter how many Tikis)',
            'separate:  survives = (2/3)^n',
            `chained outcomes: 1/3 destroyed, 1/3 get ${trim(m)}^n x, 1/3 get +${compact(add)} × n`,
          ]),
        ].join('');
      },
      calc: {
        inputs: [
          { key: 'n', label: 'Number of Tikis', value: 2, step: 1, min: 1 },
          { key: 'setup', label: 'Setup', type: 'select', value: 'chained', options: [['chained', 'Chained'], ['separate', 'Spread apart']] },
        ],
        result: ({ n, setup }, ctx) => {
          const count = Math.max(1, Math.round(n));
          const m = ctx.v.mainStat;
          const survive = setup === 'separate' ? (2 / 3) ** count : 2 / 3;
          const pairs = [['Survives', pct(survive)], ['Destroyed', pct(1 - survive)]];
          if (setup !== 'separate') pairs.push(['Green Result', mult(m ** count, 3)], ['Yellow Result', `+${compact(m * 10000 * count)}`]);
          return tiles(pairs);
        },
      },
      after: () => [
        table(['Tikis', 'Survives (Chained)', 'Survives (Spread Apart)'], [1, 2, 3, 4].map((n) => [String(n), pct(2 / 3), pct((2 / 3) ** n)])),
        p('An ore that crosses right as the phase changes can still land in two different phases, so keep the chain tight.'),
        qa('Is it worth it?', 'Yes. Two placed next to each other keep the losses down to 1 in 3, and the multi is worth it — two 4.5x hits on Shiny Mythics.'),
      ].join(''),
    },

    'Dream Machine': {
      intro: (ctx) => {
        const per = 0.5 * ctx.vm;
        return [
          p(`Dream Machine starts at 1x and adds +${trim(per, 3)}x for every effect on the ore, so the more effects you stack before it, the bigger the multi.`),
          formula([
            'multiplier = 1 + effects × 0.5 × variantMulti',
            variantLine(ctx),
          ]),
        ].join('');
      },
      calc: {
        inputs: [{ key: 'effects', label: 'Effects on the ore', value: 6, step: 1, min: 0 }],
        result: ({ effects }, ctx) => tiles([['Multiplier', mult(1 + Math.max(0, Math.round(effects)) * 0.5 * ctx.vm, 3)]]),
      },
      after: (ctx) => [
        table(['Effects', `Multiplier (${ctx.variant})`], [0, 1, 2, 3, 4, 5, 6].map((e) => [String(e), mult(1 + e * 0.5 * ctx.vm, 3)])),
        sub('How many effects can I get?'),
        p('The effects are Fire, Frost, Acid, Nuclear, Overcharged, Rainbow, Sparkle, Derpy and Electrified — but not all of them can be on one ore:'),
        steps([
          'Fire and Frost can\'t be on the same ore — the ore gets destroyed.',
          'Overcharged doesn\'t help, since it removes all the other effects.',
          'Nuclear is too far out of range unless a newer item is added that can give it.',
          'Derpy can only come from the Derp Blaster or the Godly Stone Dropper.',
        ]),
        p('So the max right now is <strong>6 effects</strong>: Fire (or Frost), Acid, Rainbow, Sparkle, Derpy and Electrified. Because of the current effect items and conveyor speeds, the best way to get Sparkle onto the ore is 1 Lambda in this line.'),
        figure('dream-machine-line.jpg', 'An effect-stacking line (from the database).'),
      ].join(''),
    },

    'Wind-Up Dropper': {
      intro: (ctx) => {
        const vm = ctx.vm;
        const ores = [[50000, 1.1], [150000, 1.5], [1000000, 2]];
        const avg = (ores.reduce((sum, [value]) => sum + value, 0) / 3) * vm;
        return [
          p('Every time it drops, the Wind-Up Dropper picks one of 3 ores at random, each with an equal 1-in-3 chance. Its drop speed is always 1.5 (one ore every 1.5 seconds, 40 a minute), no matter which ore it picks.'),
          table(['Ore', 'Value', 'Size', 'Chance', 'Per Minute'], ores.map(([value, size], i) => [String(i + 1), compact(value * vm), String(size), '1/3', '13.33'])),
          formula([
            'each ore: chance = 1/3',
            `average value per ore = (${ores.map(([value]) => compact(value * vm)).join(' + ')}) / 3 = ${compact(avg)}`,
          ]),
          qa('Each ore has an equal chance to drop', 'That means your capgrader setup has to support all 3 ore types (their different values and sizes), or you give up on the weaker ores.'),
        ].join('');
      },
    },
    // ---- Scanner spacing (all 4 scanners) — see scannerSpacingEntry() ----------
    'Precision Ore Scanner': scannerSpacingEntry('Precision Ore Scanner', {
      status: 'Tested in game: 3 Precision with a 3-tile gap hit every size-1 ore from Stone, Iron and King Dropper. 4 back to back were never enough.',
    }),
    'Azure Scanner': scannerSpacingEntry('Azure Scanner', {
      status: 'Tested in game: 2 Azure with a 2-tile gap hit every size-1 ore. 4 back to back were never enough.',
    }),
    'Ancient Scanner': scannerSpacingEntry('Ancient Scanner', {
      status: 'Tested in game: 4 Ancient back to back is best for size-1 ore. A gap doesn\'t help Ancient.',
    }),
    'Star Scanner': scannerSpacingEntry('Star Scanner', {
      status: 'Tested in game: 5 Star Scanners with a 2-tile gap hit every size-1 ore. Star can only upgrade an ore once, so extra copies never double-upgrade. Its beam is slow (one sweep about every 6.3 seconds), so other ore sizes are less certain than for the other scanners.',
    }),
  };

  globalThis.TycoonItemMechanics = { entries: ENTRIES, variantMulti: VARIANT_MULTI };
})();
