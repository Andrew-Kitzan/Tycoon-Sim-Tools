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

  function formatList(list) {
    return Array.isArray(list) && list.length ? list.map(escapeHtml).join(', ') : '—';
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
  // "tier N word word potion" key to the exact real filename for every
  // potion that currently appears in rebirth-data.json. Add an entry here
  // whenever a new potion name shows up in that file.
  const POTION_ICON_FILES = {
    'tier3luckpotion': 'Tier3 Luck Potion.png',
    'tier3shinyluckpotion': 'Tier3 Shiny Luck Potion.png',
    'tier3rollspeedpotion': 'Tier3 Roll Speed Potion.png',
    'tier4luckpotion': 'tier4 Luck Potion.png',
    'tier4shinyluckpotion': 'tier4 Shiny Luck Potion.png',
    'tier4rollspeedpotion': 'tier4 Roll Speed Potion.png',
    'tier5luckpotion': 'Tier5 Luck Potion.png',
    'tier5shinyluckpotion': 'Tier5 Shiny Luck Potion.png',
    'tier5mythicluckpotion': 'Tier5 Mythic Luck Potion.png',
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

  async function renderRebirthPage() {
    const rows = await loadRebirthData();
    const tableRows = rows.map((row) => {
      const cost = row.cost == null ? null : parseAbbreviated(row.cost);
      const crystals = row.crystalReward == null ? null : parseAbbreviated(row.crystalReward);
      return `
      <tr>
        <td>${formatNumber(row.rebirth)}</td>
        <td>${cost == null ? '—' : '$' + formatCompact(cost)}</td>
        <td>${formatItemRewards(row.itemRewards)}</td>
        <td>${crystals == null ? '—' : formatCompact(crystals)}</td>
        <td>${formatList(row.statRewards)}</td>
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
      body: '<p>Active and expired codes. Not written yet.</p>',
    },
    decoration: {
      title: 'Decoration',
      body: '<p>Decorative base items. Not written yet.</p>',
    },
    conveyor: {
      title: 'Conveyor',
      body: '<p>Conveyor types and how routing works. Not written yet.</p>',
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
