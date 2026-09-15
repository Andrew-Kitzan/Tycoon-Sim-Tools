// Wiki tool — home page + basic per-category page switching. Self-contained
// IIFE, same pattern as every other tool script in this project. No content
// system yet (see AI_HANDOFF.md) — each page is just a placeholder until
// real content gets written page by page, starting with Rebirth.
(function () {
  const homeView = document.querySelector('#wiki-home-view');
  const pageView = document.querySelector('#wiki-page-view');
  const pageTitle = document.querySelector('#wiki-page-title');
  const pageBody = document.querySelector('#wiki-page-body');
  const backButton = document.querySelector('#wiki-page-back');
  const navTiles = document.querySelectorAll('[data-wiki-page]');
  if (!homeView || !pageView) return;

  // Rebirth reward data lives in data/manual/rebirth-data.json — a plain,
  // hand-edited JSON file (not a JS global like the other data/ files) so it
  // stays easy to open and fill in directly. Fetched once and cached; safe
  // under both the local `python -m http.server` dev setup and the real
  // static GitHub Pages deploy, since both serve it same-origin over http(s).
  let rebirthDataPromise = null;
  function loadRebirthData() {
    if (!rebirthDataPromise) {
      rebirthDataPromise = fetch('data/manual/rebirth-data.json')
        .then((res) => res.json())
        .catch(() => []);
    }
    return rebirthDataPromise;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  function formatNumber(value) {
    return typeof value === 'number' ? value.toLocaleString() : escapeHtml(value ?? '—');
  }

  // Item reward icons reuse the site-wide icons/items/{Name}.png convention
  // (same path shape as mpa-chopping-block.js's itemIconHtml — Base variant,
  // no suffix, since rebirth rewards aren't listed with a variant). No
  // currency/stat icons exist yet (player's call, not started), so only item
  // rewards get one — crystal/stat/potion cells stay plain text for now.
  // onerror hides a broken/missing icon instead of showing a broken-image
  // box, so a not-yet-added icon degrades to a plain chip, not visual noise.
  function formatItemRewards(list) {
    if (!Array.isArray(list) || !list.length) return '—';
    const chips = list.map((name) => {
      const safeName = escapeHtml(name);
      const iconSrc = `icons/items/${encodeURIComponent(name)}.png`;
      return `<span class="wiki-reward-chip"><img class="wiki-reward-icon" src="${iconSrc}" alt="" onerror="this.remove()">${safeName}</span>`;
    }).join('');
    return `<span class="wiki-reward-list">${chips}</span>`;
  }

  // Potion icons live under the same icons/items/{Name}.png convention, but
  // their real on-disk filenames mix "Tier3"/"tier4"-style casing and
  // spacing inconsistently (a pre-existing quirk of that folder, not
  // introduced here) — a generic encodeURIComponent(name) guess like the one
  // formatItemRewards() uses would miss half of them. This maps a normalized
  // "tier N word word potion" key to the exact real filename — every potion
  // across all 6 tiers is mapped (not just the tiers rebirth-data.json
  // happens to use), since codes-data.json can reference any tier too.
  const POTION_ICON_FILES = {
    'tier1luckpotion': 'Tier1 Luck Potion.png',
    'tier1shinyluckpotion': 'Tier1 Shiny Luck Potion.png',
    'tier1rollspeedpotion': 'Tier1 Roll Speed Potion.png',
    'tier1mythicpotion': 'tier1 Mythic Potion.png',
    'tier2luckpotion': 'tier2 Luck Potion.png',
    'tier2shinyluckpotion': 'tier2 Shiny Luck Potion.png',
    'tier2rollspeedpotion': 'tier2 Roll Speed Potion.png',
    'tier2mythicluckpotion': 'tier2 Mythic Luck Potion.png',
    'tier3luckpotion': 'Tier3 Luck Potion.png',
    'tier3shinyluckpotion': 'Tier3 Shiny Luck Potion.png',
    'tier3rollspeedpotion': 'Tier3 Roll Speed Potion.png',
    'tier3mythicluckpotion': 'Tier3 Mythic Luck Potion.png',
    'tier4luckpotion': 'tier4 Luck Potion.png',
    'tier4shinyluckpotion': 'tier4 Shiny Luck Potion.png',
    'tier4rollspeedpotion': 'tier4 Roll Speed Potion.png',
    'tier4mythicluckpotion': 'tier4 Mythic Luck Potion.png',
    'tier5luckpotion': 'Tier5 Luck Potion.png',
    'tier5shinyluckpotion': 'Tier5 Shiny Luck Potion.png',
    'tier5rollspeedpotion': 'Tier5 Roll Speed Potion.png',
    'tier5mythicluckpotion': 'Tier5 Mythic Luck Potion.png',
    'tier6luckpotion': 'tier6 Luck Potion.png',
    'tier6shinyluckpotion': 'tier6 Shiny Luck Potion.png',
    'tier6rollspeedpotion': 'tier6 Roll Speed Potion.png',
    'tier6mythicluckpotion': 'tier6 Mythic Luck Potion.png',
    // Filename is a leftover misnaming from when this icon was saved — the
    // player confirmed it's actually the Unbox Slot Potion icon, not
    // renamed on disk to avoid unrelated churn (same convention as the
    // index-icon.png/enchanter-bg.png mismatches noted in AI_HANDOFF.md).
    'tier1unboxslotpotion': 'tier1 Roll Slot Potion.png',
  };
  function normalizePotionKey(name) {
    return name.toLowerCase().replace(/\s+/g, '');
  }

  // Potion reward strings are "5x Tier 3 Luck Potion" — split the count off
  // so it can render as its own overlapping badge (bottom-left of the icon,
  // e.g. "+5") instead of baked into the image or left as plain text like
  // the source game screenshots had it. A name with no icon entry above (or
  // no leading count) still renders as plain text, same graceful-degrade as
  // formatItemRewards().
  function formatPotionRewards(list) {
    if (!Array.isArray(list) || !list.length) return '—';
    const chips = list.map((entry) => {
      const match = String(entry).match(/^(\d+)x\s+(.*)$/i);
      if (!match) return `<span class="wiki-reward-chip">${escapeHtml(entry)}</span>`;
      const [, countText, name] = match;
      const iconFile = POTION_ICON_FILES[normalizePotionKey(name)];
      if (!iconFile) return `<span class="wiki-reward-chip">${escapeHtml(entry)}</span>`;
      const iconSrc = `icons/items/${encodeURIComponent(iconFile)}`;
      return `<span class="wiki-reward-chip">
        <span class="wiki-reward-icon-wrap">
          <img class="wiki-reward-icon" src="${iconSrc}" alt="" onerror="this.parentElement.remove()">
          <span class="wiki-reward-badge">+${escapeHtml(countText)}</span>
        </span>
        ${escapeHtml(name)}
      </span>`;
    }).join('');
    return `<span class="wiki-reward-list">${chips}</span>`;
  }

  // Stat reward strings are "+2 Plot Size" / "+1 Luck" — only the stats with
  // a real icon below get the icon+badge treatment; anything else (Unbox
  // Slot, ...) stays plain text until an icon exists for it, same
  // graceful-degrade pattern as formatItemRewards()/formatPotionRewards().
  const STAT_ICON_FILES = {
    'luck': 'luck-icon.png',
    'plot size': 'plot-size-icon.png',
    'unbox slot': 'unbox-slot-icon.png',
  };
  function formatStatRewards(list) {
    if (!Array.isArray(list) || !list.length) return '—';
    const chips = list.map((entry) => {
      const match = String(entry).match(/^([+-]\d+)\s+(.*)$/);
      const iconFile = match && STAT_ICON_FILES[match[2].trim().toLowerCase()];
      if (!match || !iconFile) {
        return `<span class="wiki-reward-chip">${escapeHtml(entry)}</span>`;
      }
      const [, amountText, label] = match;
      return `<span class="wiki-reward-chip">
        <span class="wiki-reward-icon-wrap">
          <img class="wiki-reward-icon" src="icons/wiki/${iconFile}" alt="" onerror="this.parentElement.remove()">
          <span class="wiki-reward-badge">${escapeHtml(amountText)}</span>
        </span>
        ${escapeHtml(label)}
      </span>`;
    }).join('');
    return `<span class="wiki-reward-list">${chips}</span>`;
  }

  // Same suffix scale used elsewhere on the site for big cash/crystal numbers
  // (app.js's abbreviatedRate, abbrev-calculator.js's DISPLAY_UNITS,
  // capgrader-generator.js's money parser) — keep this in sync with those if
  // that table ever grows. Small values (below 1,000) render as a plain
  // comma-grouped number instead of e.g. "500.00" with no suffix.
  const ABBREV_UNITS = [
    [1e42, 'Td'], [1e39, 'Dd'], [1e36, 'Ud'], [1e33, 'Dc'],
    [1e30, 'No'], [1e27, 'Oc'], [1e24, 'Sp'], [1e21, 'Sx'], [1e18, 'Qn'],
    [1e15, 'Qd'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K'],
  ];
  function formatCompact(value) {
    const unit = ABBREV_UNITS.find(([minimum]) => value >= minimum);
    if (!unit) return value.toLocaleString();
    const [divisor, suffix] = unit;
    const truncated = Math.floor((value / divisor) * 100) / 100;
    return `${truncated.toFixed(2)}${suffix}`;
  }

  // Lets rebirth-data.json's cost/crystalReward be typed the same shorthand
  // way the Calculator tool accepts ("1.5M", "500k") instead of a long run of
  // zeros, since that's exactly what's easy to mistype by hand. A plain
  // number still works too (e.g. 500) — only strings get parsed here.
  const PARSE_UNITS_BY_LENGTH_DESC = [...ABBREV_UNITS]
    .map(([value, suffix]) => [suffix.toLowerCase(), value])
    .sort((a, b) => b[0].length - a[0].length);
  function parseAbbreviated(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(-?[0-9]*\.?[0-9]+)\s*([a-zA-Z]*)$/);
    if (!match) return null;
    const [, numberText, suffixText] = match;
    const num = Number(numberText);
    if (!Number.isFinite(num)) return null;
    if (!suffixText) return num;
    const unit = PARSE_UNITS_BY_LENGTH_DESC.find(([suffix]) => suffix === suffixText.toLowerCase());
    return unit ? num * unit[1] : null;
  }

  // Same overlapping-badge treatment as the potion icons: icons/wiki/crystal-icon.png
  // and icons/wiki/cash-icon.png are real edited assets (both source
  // screenshots had a baked-in count badge spanning almost the full width —
  // no clean corner to mirror from like the potion bottles had, so the
  // badge band was filled by stretching a thin strip from just above it
  // rather than mirroring, which avoided a duplicated-shape artifact). The
  // amount itself renders as our own badge, bottom-left of the icon.
  function formatCrystalReward(value) {
    if (value == null) return '—';
    const amount = parseAbbreviated(value);
    if (amount == null) return escapeHtml(value);
    return `<span class="wiki-reward-chip">
      <span class="wiki-reward-icon-wrap">
        <img class="wiki-reward-icon wiki-reward-icon--epic" src="icons/wiki/crystal-icon.png" alt="" onerror="this.parentElement.remove()">
        <span class="wiki-reward-badge">+${formatCompact(amount)}</span>
      </span>
    </span>`;
  }

  function formatCostReward(amount) {
    if (amount == null) return '—';
    return `<span class="wiki-reward-chip">
      <span class="wiki-reward-icon-wrap">
        <img class="wiki-reward-icon wiki-reward-icon--uncommon" src="icons/wiki/cash-icon.png" alt="" onerror="this.parentElement.remove()">
        <span class="wiki-reward-badge">$${formatCompact(amount)}</span>
      </span>
    </span>`;
  }

  async function renderRebirthPage() {
    const rows = await loadRebirthData();
    const tableRows = rows.map((row) => {
      const cost = row.cost == null ? null : parseAbbreviated(row.cost);
      return `
      <tr>
        <td>${formatNumber(row.rebirth)}</td>
        <td>${formatCostReward(cost)}</td>
        <td>${formatItemRewards(row.itemRewards)}</td>
        <td>${formatCrystalReward(row.crystalReward)}</td>
        <td>${formatStatRewards(row.statRewards)}</td>
        <td>${formatPotionRewards(row.potionRewards)}</td>
      </tr>`;
    }).join('');
    return `
      <p>Rebirthing resets your cash to $0 in exchange for permanent rewards —
      it's the game's core prestige loop. In general, rebirth as soon as
      you're able to — don't sit on the cash. The one exception is coming
      back from being AFK with a lot more cash than the rebirth costs: spend
      the excess on crates before you rebirth so that extra cash isn't
      wasted.</p>
      <p><strong>What you lose:</strong> your cash resets to $0 the moment
      you rebirth, no matter how much you had banked above the cost — there's
      no benefit to holding extra cash past what the next rebirth requires.
      That's the only thing rebirthing takes from you.</p>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Rebirth</th>
            <th>Cost</th>
            <th>Item Reward(s)</th>
            <th>Crystal Reward</th>
            <th>Stat Rewards</th>
            <th>Potion Rewards</th>
          </tr>
        </thead>
        <tbody>${tableRows || '<tr><td colspan="6">Not filled in yet.</td></tr>'}</tbody>
      </table>`;
  }

  // Codes reward data lives in data/manual/codes-data.json — same
  // plain-hand-edited-JSON convention as rebirth-data.json, fetched once and
  // cached the same way.
  let codesDataPromise = null;
  function loadCodesData() {
    if (!codesDataPromise) {
      codesDataPromise = fetch('data/manual/codes-data.json')
        .then((res) => res.json())
        .catch(() => []);
    }
    return codesDataPromise;
  }

  // Code rewards mix potion entries ("1x Tier 5 Luck Potion" — same
  // POTION_ICON_FILES icon+badge treatment as the Rebirth page), crystal
  // amounts ("50K Crystals" — same crystal-icon.png treatment as Rebirth's
  // Crystal Reward column), real items with a generic
  // icons/items/{Name}.png icon (Cupcake-inator, Intern Dropper), and plain
  // text ("Moonstone") that has no icon yet — the onerror fallback already
  // used everywhere else on this page degrades that last case automatically.
  function formatCodeRewards(list) {
    if (!Array.isArray(list) || !list.length) return '—';
    const chips = list.map((entry) => {
      const potionMatch = String(entry).match(/^(\d+)x\s+(.*)$/i);
      const potionIcon = potionMatch && POTION_ICON_FILES[normalizePotionKey(potionMatch[2])];
      if (potionMatch && potionIcon) {
        const [, countText, name] = potionMatch;
        const iconSrc = `icons/items/${encodeURIComponent(potionIcon)}`;
        return `<span class="wiki-reward-chip">
          <span class="wiki-reward-icon-wrap">
            <img class="wiki-reward-icon" src="${iconSrc}" alt="" onerror="this.parentElement.remove()">
            <span class="wiki-reward-badge">+${escapeHtml(countText)}</span>
          </span>
          ${escapeHtml(name)}
        </span>`;
      }
      const crystalMatch = String(entry).match(/^([0-9][0-9.]*[a-zA-Z]*)\s*Crystals?$/i);
      const crystalAmount = crystalMatch && parseAbbreviated(crystalMatch[1]);
      if (crystalMatch && crystalAmount != null) {
        return `<span class="wiki-reward-chip">
          <span class="wiki-reward-icon-wrap">
            <img class="wiki-reward-icon wiki-reward-icon--epic" src="icons/wiki/crystal-icon.png" alt="" onerror="this.parentElement.remove()">
            <span class="wiki-reward-badge">+${formatCompact(crystalAmount)}</span>
          </span>
        </span>`;
      }
      const safeName = escapeHtml(entry);
      const iconSrc = `icons/items/${encodeURIComponent(entry)}.png`;
      return `<span class="wiki-reward-chip"><img class="wiki-reward-icon" src="${iconSrc}" alt="" onerror="this.remove()">${safeName}</span>`;
    }).join('');
    return `<span class="wiki-reward-list">${chips}</span>`;
  }

  async function renderCodesPage() {
    const codes = await loadCodesData();
    const rows = codes.map((entry) => `
      <tr>
        <td class="wiki-code-text">${escapeHtml(entry.code)}</td>
        <td><span class="wiki-status-badge ${entry.active ? 'is-active' : 'is-expired'}">${entry.active ? 'Active' : 'Expired'}</span></td>
        <td>${formatCodeRewards(entry.rewards)}</td>
      </tr>`).join('');
    return `
      <p>Enter these for free rewards — you can input codes at the bottom of
      the Premium Shop window. Codes can be deactivated at any time — if one
      stops working, it's most likely expired rather than mistyped.</p>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Status</th>
            <th>Reward(s)</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="3">Not filled in yet.</td></tr>'}</tbody>
      </table>`;
  }

  // Conveyor page reads straight from data/manual/item-geometry-worksheet.json's
  // "conveyors" section (added this session) instead of its own separate
  // data file — the player explicitly asked not to duplicate the same
  // width/length/speed numbers in two places. That worksheet's job is
  // engine-verification, not wiki content, so this page adds its own
  // plain-language notes on top rather than editing that file's own note
  // fields for wiki-facing wording.
  let geometryWorksheetPromise = null;
  function loadGeometryWorksheet() {
    if (!geometryWorksheetPromise) {
      geometryWorksheetPromise = fetch('data/manual/item-geometry-worksheet.json')
        .then((res) => res.json())
        .catch(() => null);
    }
    return geometryWorksheetPromise;
  }

  function conveyorNotes(flags) {
    if (!flags) return '—';
    const notes = [];
    if (flags.centers) notes.push('Centers ore as it crosses.');
    if (flags.wall) notes.push('Solid wall — blocks routing, does not move ore.');
    if (flags.teleporterColor && flags.teleporterRole === 'sender') {
      notes.push(`Sends ore out via the ${flags.teleporterColor} teleporter.`);
    }
    if (flags.teleporterColor && flags.teleporterRole === 'receiver') {
      notes.push(`Receives ore from the ${flags.teleporterColor} teleporter.`);
    }
    return notes.length ? notes.map(escapeHtml).join(' ') : '—';
  }

  async function renderConveyorPage() {
    const worksheet = await loadGeometryWorksheet();
    const conveyors = worksheet?.conveyors ? Object.values(worksheet.conveyors) : [];
    const rows = conveyors.map((entry) => {
      const size = entry.size?.confirmed;
      const speed = entry.speed?.confirmed;
      return `
      <tr>
        <td>${escapeHtml(entry.name)}</td>
        <td>${size ? `${size.width}x${size.length}` : '—'}</td>
        <td>${speed == null ? '—' : formatNumber(speed)}</td>
        <td>${conveyorNotes(entry.flags)}</td>
      </tr>`;
    }).join('');
    return `
      <p>Every conveyor belt piece, with its footprint size and relative
      speed (higher moves ore faster — same value the planner tools use, not
      a fixed real-world unit). This is the exact same data tracked in the
      base-builder engine's own item-geometry worksheet, not a separate copy
      — editing one place keeps both in sync.</p>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Conveyor</th>
            <th>Size</th>
            <th>Speed</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4">Not filled in yet.</td></tr>'}</tbody>
      </table>`;
  }

  // Decoration data lives in data/manual/decoration-data.json — same
  // plain-hand-edited-JSON convention as rebirth-data.json/codes-data.json.
  let decorationDataPromise = null;
  function loadDecorationData() {
    if (!decorationDataPromise) {
      decorationDataPromise = fetch('data/manual/decoration-data.json')
        .then((res) => res.json())
        .catch(() => []);
    }
    return decorationDataPromise;
  }

  // Same rarity color scale as luck-crate-generator.js's RARITY_COLORS /
  // .luck-item-cell — this file already keeps its own copy for
  // crystal/cash's Epic/Uncommon icon tints, extended here to the full set
  // since Decoration items span every rarity.
  const RARITY_COLORS = {
    Common: '#8a97a0',
    Uncommon: '#4caf6b',
    Rare: '#3f8ee0',
    Epic: '#9b59f2',
    Legendary: '#f0a93a',
    Secret: '#e0483f',
  };
  function formatRarity(rarity) {
    if (!rarity) return '—';
    const color = RARITY_COLORS[rarity] ?? RARITY_COLORS.Common;
    return `<span class="wiki-rarity-pill" style="--rarity-color: ${color}">${escapeHtml(rarity)}</span>`;
  }

  // Decoration icons live in their own icons/decoration/{Name}.png folder
  // (not icons/items/, which is for real database items — decorations
  // aren't synced into the item database, see the "Not yet done" note in
  // AI_HANDOFF.md) — same onerror-degrade-to-plain-text pattern as every
  // other icon on this page for names that don't have one yet.
  function formatDecorationName(name) {
    const safeName = escapeHtml(name);
    const iconSrc = `icons/decoration/${encodeURIComponent(name)}.png`;
    return `<span class="wiki-reward-chip"><img class="wiki-reward-icon" src="${iconSrc}" alt="" onerror="this.remove()">${safeName}</span>`;
  }

  async function renderDecorationPage() {
    const decorations = await loadDecorationData();
    const rows = decorations.map((entry) => `
      <tr>
        <td>${formatDecorationName(entry.name)}</td>
        <td>${entry.size ? escapeHtml(entry.size) : '—'}</td>
        <td>${formatRarity(entry.rarity)}</td>
        <td>${entry.odds ? escapeHtml(entry.odds) : '—'}</td>
        <td>${entry.obtain ? escapeHtml(entry.obtain) : '—'}</td>
      </tr>`).join('');
    return `
      <p>Cosmetic base decorations — these don't affect production, they're
      purely for how your base looks.</p>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Decoration</th>
            <th>Size</th>
            <th>Rarity</th>
            <th>Odds</th>
            <th>How to Get</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">Not filled in yet.</td></tr>'}</tbody>
      </table>`;
  }

  const PAGES = {
    index: {
      title: 'Index',
      body: '<p>Every Dropper, Upgrader, and Furnace in the game, organized by index tier — plus what each tier rewards. Not written yet.</p>',
    },
    rebirth: {
      title: 'Rebirth',
      body: renderRebirthPage,
    },
    merchant: {
      title: 'Merchant',
      body: '<p>The traveling merchant’s rotating stock and prices. Not written yet.</p>',
    },
    achievements: {
      title: 'Achievements',
      body: '<p>Every achievement and how to earn it. Not written yet.</p>',
    },
    mastery: {
      title: 'Mastery',
      body: '<p>The mastery system and its rewards. Not written yet.</p>',
    },
    events: {
      title: 'Events',
      body: '<p>Past and current limited-time events. Not written yet.</p>',
    },
    'furnace-loot': {
      title: 'Furnace Loot',
      body: '<p>What every furnace can produce. Not written yet.</p>',
    },
    codes: {
      title: 'Codes',
      body: renderCodesPage,
    },
    decoration: {
      title: 'Decoration',
      body: renderDecorationPage,
    },
    conveyor: {
      title: 'Conveyor',
      body: renderConveyorPage,
    },
    enchanter: {
      title: 'Enchanter',
      body: '<p>The Enchanter and what it can do to your items. Not written yet.</p>',
    },
    brewer: {
      title: 'Brewer',
      body: '<p>The Brewer and what it produces. Not written yet.</p>',
    },
    p2w: {
      title: 'P2W',
      body: '<p>Pay-to-win items and purchases. Not written yet.</p>',
    },
  };

  function openPage(key) {
    const page = PAGES[key];
    if (!page) return;
    pageTitle.textContent = page.title;
    if (typeof page.body === 'function') {
      pageBody.innerHTML = '<p>Loading…</p>';
      Promise.resolve(page.body()).then((html) => {
        // Guard against a slow fetch resolving after the player has already
        // navigated away to a different page.
        if (pageTitle.textContent === page.title) pageBody.innerHTML = html;
      });
    } else {
      pageBody.innerHTML = page.body;
    }
    homeView.hidden = true;
    pageView.hidden = false;
  }

  function goHome() {
    pageView.hidden = true;
    homeView.hidden = false;
  }

  navTiles.forEach((tile) => {
    tile.addEventListener('click', () => openPage(tile.dataset.wikiPage));
  });
  backButton?.addEventListener('click', goHome);
})();
