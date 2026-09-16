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
      rebirthDataPromise = fetch('data/manual/rebirth-data.json', { cache: 'no-store' })
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

  // Turns any "Drillbit & Co." mention in a notes string into a link to the
  // game's real Roblox page — used by the P2W notes column, where several
  // entries reference owning gamepasses "in Drillbit & Co."
  const DRILLBIT_CO_URL = 'https://www.roblox.com/games/119296091834097/Drillbit-and-Co';
  function formatNotes(notes) {
    if (!notes) return '—';
    return escapeHtml(notes).replace(
      /Drillbit &amp; Co\./g,
      `<a class="wiki-notes-link" href="${DRILLBIT_CO_URL}" target="_blank" rel="noopener noreferrer">Drillbit &amp; Co.</a>`
    );
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
    // Trailing "potions" (plural, e.g. P2W's "5x tier 6 luck potions") maps
    // to the same entry as singular "potion" — every POTION_ICON_FILES key
    // ends in "potion" singular.
    return name.toLowerCase().replace(/\s+/g, '').replace(/potions$/, 'potion');
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

  // Turns a human-written duration string ("1 Min 30 Sec", "5 Min", "45
  // Sec") into total seconds, and back — used by the Enchanter page's
  // speed-adjusted time recalculation.
  function parseDurationToSeconds(text) {
    if (!text) return null;
    const str = String(text);
    let total = 0;
    let matched = false;
    const hourMatch = str.match(/([0-9]*\.?[0-9]+)\s*Hour/i);
    const minMatch = str.match(/([0-9]*\.?[0-9]+)\s*Min/i);
    const secMatch = str.match(/([0-9]*\.?[0-9]+)\s*Sec/i);
    if (hourMatch) { total += Number(hourMatch[1]) * 3600; matched = true; }
    if (minMatch) { total += Number(minMatch[1]) * 60; matched = true; }
    if (secMatch) { total += Number(secMatch[1]); matched = true; }
    return matched ? total : null;
  }

  function formatSecondsAsDuration(totalSeconds) {
    if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '—';
    const rounded = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(rounded / 3600);
    const mins = Math.floor((rounded % 3600) / 60);
    const secs = rounded % 60;
    const parts = [];
    if (hours) parts.push(`${hours} Hour${hours === 1 ? '' : 's'}`);
    if (mins) parts.push(`${mins} Min`);
    if (secs || parts.length === 0) parts.push(`${secs} Sec`);
    return parts.join(' ');
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
      <h3 class="wiki-section-heading">Rewards by Rebirth</h3>
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
      codesDataPromise = fetch('data/manual/codes-data.json', { cache: 'no-store' })
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
          Crystals
        </span>`;
      }
      // Cash amounts (e.g. "100qd cash" — an achievement reward, distinct
      // from Crystals) get the same icon+badge treatment as Crystals, using
      // the cash icon instead.
      const cashMatch = String(entry).match(/^([0-9][0-9.]*[a-zA-Z]*)\s*[Cc]ash$/);
      const cashAmount = cashMatch && parseAbbreviated(cashMatch[1]);
      if (cashMatch && cashAmount != null) {
        return `<span class="wiki-reward-chip">
          <span class="wiki-reward-icon-wrap">
            <img class="wiki-reward-icon wiki-reward-icon--uncommon" src="icons/wiki/cash-icon.png" alt="" onerror="this.parentElement.remove()">
            <span class="wiki-reward-badge">$${formatCompact(cashAmount)}</span>
          </span>
          Cash
        </span>`;
      }
      // Roll speed multipliers (e.g. "0.5x unbox speed") get the same
      // icon+badge treatment as crystals/potions instead of plain text.
      const rollSpeedMatch = String(entry).match(/^([0-9.]+x)\s+(?:unbox|roll)\s+speed$/i);
      if (rollSpeedMatch) {
        return `<span class="wiki-reward-chip">
          <span class="wiki-reward-icon-wrap">
            <img class="wiki-reward-icon" src="icons/wiki/roll-speed-icon.png" alt="" onerror="this.parentElement.remove()">
            <span class="wiki-reward-badge">${escapeHtml(rollSpeedMatch[1])}</span>
          </span>
          Roll Speed
        </span>`;
      }
      // Crystal MULTIPLIERS (e.g. "1.5x crystal multi", "2x crystals") reuse
      // crystal-icon.png same as the flat-amount case above, but with the
      // multiplier itself as the badge ("1.5x") instead of a "+N" amount.
      const crystalMultiMatch = String(entry).match(/^([0-9.]+x)\s+crystals?(?:\s+multi)?$/i);
      if (crystalMultiMatch) {
        return `<span class="wiki-reward-chip">
          <span class="wiki-reward-icon-wrap">
            <img class="wiki-reward-icon wiki-reward-icon--epic" src="icons/wiki/crystal-icon.png" alt="" onerror="this.parentElement.remove()">
            <span class="wiki-reward-badge">${escapeHtml(crystalMultiMatch[1])}</span>
          </span>
          Crystal Multi
        </span>`;
      }
      // Luck multipliers (e.g. "2x Luck") reuse the Luck stat icon from the
      // Rebirth page, with the multiplier as the badge.
      const luckMultiMatch = String(entry).match(/^([0-9.]+x)\s+luck$/i);
      if (luckMultiMatch) {
        return `<span class="wiki-reward-chip">
          <span class="wiki-reward-icon-wrap">
            <img class="wiki-reward-icon" src="icons/wiki/luck-icon.png" alt="" onerror="this.parentElement.remove()">
            <span class="wiki-reward-badge">${escapeHtml(luckMultiMatch[1])}</span>
          </span>
          Luck
        </span>`;
      }
      // Flat stat bonuses (e.g. "+2 Plot Size", same shape the Rebirth page's
      // own formatStatRewards() reads) reuse that same STAT_ICON_FILES
      // lookup, so a plain reward list (like Achievements) gets the same
      // icon treatment as the Rebirth page's dedicated Stat Rewards column.
      const statMatch = String(entry).match(/^([+-]\d+)\s+(.*)$/);
      const statIconFile = statMatch && STAT_ICON_FILES[statMatch[2].trim().toLowerCase()];
      if (statMatch && statIconFile) {
        const [, amountText, label] = statMatch;
        return `<span class="wiki-reward-chip">
          <span class="wiki-reward-icon-wrap">
            <img class="wiki-reward-icon" src="icons/wiki/${statIconFile}" alt="" onerror="this.parentElement.remove()">
            <span class="wiki-reward-badge">${escapeHtml(amountText)}</span>
          </span>
          ${escapeHtml(label)}
        </span>`;
      }
      // Walkspeed bonuses (e.g. "+8 walkspeed") get the same treatment.
      const walkspeedMatch = String(entry).match(/^\+?([0-9]+)\s+walkspeed$/i);
      if (walkspeedMatch) {
        return `<span class="wiki-reward-chip">
          <span class="wiki-reward-icon-wrap">
            <img class="wiki-reward-icon" src="icons/wiki/walkspeed-icon.png" alt="" onerror="this.parentElement.remove()">
            <span class="wiki-reward-badge">+${escapeHtml(walkspeedMatch[1])}</span>
          </span>
          Walkspeed
        </span>`;
      }
      // Unbox slot counts (e.g. "+2 unbox slots") reuse the Unbox Slot stat
      // icon from the Rebirth page, same icon+badge pattern.
      const unboxSlotMatch = String(entry).match(/^\+?([0-9]+)\s+unbox\s+slots?$/i);
      if (unboxSlotMatch) {
        return `<span class="wiki-reward-chip">
          <span class="wiki-reward-icon-wrap">
            <img class="wiki-reward-icon" src="icons/wiki/unbox-slot-icon.png" alt="" onerror="this.parentElement.remove()">
            <span class="wiki-reward-badge">+${escapeHtml(unboxSlotMatch[1])}</span>
          </span>
          Unbox Slots
        </span>`;
      }
      // A leading "[Tag]" (a chat-tag reward, e.g. "[MVP] chat tag") renders
      // the bracketed part in the tag's own color, matching how it actually
      // looks in-game chat, instead of plain text.
      const tagMatch = String(entry).match(/^(\[[^\]]+\])\s*(.*)$/);
      if (tagMatch) {
        const [, tag, rest] = tagMatch;
        return `<span class="wiki-reward-chip"><span class="wiki-chat-tag">${escapeHtml(tag)}</span>${rest ? ' ' + escapeHtml(rest) : ''}</span>`;
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
      geometryWorksheetPromise = fetch('data/manual/item-geometry-worksheet.json', { cache: 'no-store' })
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

  // Conveyor icons live in their own icons/conveyor/{Name}.png folder (not
  // icons/items/, same reasoning as icons/decoration/ — conveyors aren't
  // real database items either). Same onerror-degrade-to-plain-text pattern
  // as every other icon on this page for pieces that don't have one yet.
  //
  // "Normal Conveyor" is engine/coordinate-map.mjs's internal
  // conveyorDefinitions key (must stay exactly that for the planner to
  // resolve it) — the player confirmed the game itself just calls it
  // "Conveyor", so this maps engine name -> real display name for this
  // page only. Extend this if another conveyor's engine key ever turns out
  // to not match its real in-game name.
  const CONVEYOR_DISPLAY_NAMES = {
    'Normal Conveyor': 'Conveyor',
  };
  function formatConveyorName(name) {
    const displayName = CONVEYOR_DISPLAY_NAMES[name] ?? name;
    const safeName = escapeHtml(displayName);
    const iconSrc = `icons/conveyor/${encodeURIComponent(displayName)}.png`;
    return `<span class="wiki-reward-chip"><img class="wiki-reward-icon" src="${iconSrc}" alt="" onerror="this.remove()">${safeName}</span>`;
  }

  async function renderConveyorPage() {
    const worksheet = await loadGeometryWorksheet();
    const conveyors = worksheet?.conveyors ? Object.values(worksheet.conveyors) : [];
    const rows = conveyors.map((entry) => {
      const size = entry.size?.confirmed;
      const speed = entry.speed?.confirmed;
      return `
      <tr>
        <td>${formatConveyorName(entry.name)}</td>
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
      decorationDataPromise = fetch('data/manual/decoration-data.json', { cache: 'no-store' })
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

  // Brewer data lives in data/manual/brewer-data.json — same
  // plain-hand-edited-JSON convention as every other data/manual/ file.
  let brewerDataPromise = null;
  function loadBrewerData() {
    if (!brewerDataPromise) {
      brewerDataPromise = fetch('data/manual/brewer-data.json', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => null);
    }
    return brewerDataPromise;
  }

  function formatCrystalCost(amount) {
    const parsed = amount == null ? null : parseAbbreviated(amount);
    if (parsed == null) return '—';
    return `<span class="wiki-reward-chip">
      <span class="wiki-reward-icon-wrap">
        <img class="wiki-reward-icon wiki-reward-icon--epic" src="icons/wiki/crystal-icon.png" alt="" onerror="this.parentElement.remove()">
        <span class="wiki-reward-badge">${formatCompact(parsed)}</span>
      </span>
    </span>`;
  }

  function formatCashCost(amount) {
    const parsed = amount == null ? null : parseAbbreviated(amount);
    if (parsed == null) return '—';
    return `<span class="wiki-reward-chip">
      <span class="wiki-reward-icon-wrap">
        <img class="wiki-reward-icon wiki-reward-icon--uncommon" src="icons/wiki/cash-icon.png" alt="" onerror="this.parentElement.remove()">
        <span class="wiki-reward-badge">$${formatCompact(parsed)}</span>
      </span>
    </span>`;
  }

  // Robux costs get the same icon+badge chip treatment as Crystals/Cash,
  // but the caller passes in the already-formatted display text since
  // different pages want different precision — the Enchanter skip table
  // uses compact "3.19K"-style abbreviations (matching how the player gave
  // the data), while P2W wants the exact price spelled out in full since
  // real-money prices shouldn't get fuzzed by abbreviation.
  function formatRobuxCost(displayText) {
    if (displayText == null) return '—';
    return `<span class="wiki-reward-chip">
      <span class="wiki-reward-icon-wrap">
        <img class="wiki-reward-icon" src="icons/wiki/robux-icon.png" alt="" onerror="this.parentElement.remove()">
        <span class="wiki-reward-badge">R$${escapeHtml(displayText)}</span>
      </span>
    </span>`;
  }

  // Furnace Loot data lives in data/manual/furnace-loot-data.json — same
  // plain-hand-edited-JSON convention as every other data/manual/ file.
  let furnaceLootDataPromise = null;
  function loadFurnaceLootData() {
    if (!furnaceLootDataPromise) {
      furnaceLootDataPromise = fetch('data/manual/furnace-loot-data.json', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => null);
    }
    return furnaceLootDataPromise;
  }

  async function renderFurnaceLootPage() {
    const data = await loadFurnaceLootData();
    const denom = data?.dropChanceDenominator ?? 50;
    const minDrops = data?.minActiveDrops ?? 10;
    const maxDrops = data?.maxActiveDrops ?? 20;
    const baseStat = data?.baseFurnaceLootStat ?? 0;
    const maxStat = data?.maxFurnaceLootStat ?? 5;
    const tiers = data?.masteryTiers ?? [];
    const lootOdds = data?.lootOdds ?? [];
    const tierRows = tiers.map((tier) => {
      const dropChancePct = (tier.level / denom) * 100;
      const activeDropsCap = maxStat > baseStat
        ? minDrops + ((tier.level - baseStat) / (maxStat - baseStat)) * (maxDrops - minDrops)
        : minDrops;
      const costCell = tier.currency === 'crystals' ? formatCrystalCost(tier.cost)
        : tier.currency === 'cash' ? formatCashCost(tier.cost)
        : '—';
      return `
      <tr>
        <td>Level ${tier.level}</td>
        <td>${costCell}</td>
        <td>${dropChancePct % 1 === 0 ? dropChancePct : dropChancePct.toFixed(1)}%</td>
        <td>${Math.floor(activeDropsCap)}</td>
      </tr>`;
    }).join('');
    const oddsRows = lootOdds.map((entry) => {
      const iconCell = entry.icon
        ? `<span class="wiki-reward-chip"><img class="wiki-reward-icon" src="${escapeHtml(entry.icon)}" alt="" onerror="this.remove()">${escapeHtml(entry.reward)}</span>`
        : escapeHtml(entry.reward);
      return `
      <tr>
        <td>${iconCell}</td>
        <td>${escapeHtml(entry.odds)}</td>
        <td>${escapeHtml(entry.time50)}</td>
        <td>${escapeHtml(entry.time75)}</td>
        <td>${escapeHtml(entry.time90)}</td>
      </tr>`;
    }).join('');
    return `
      <p>Furnaces have a chance to roll bonus loot on top of whatever
      they're processing — but only if you've bought the
      <strong>"More Furnace Loot!"</strong> mastery. With no mastery at
      all, that chance is <strong>0%</strong> — this isn't a passive
      bonus, you have to buy into it. The mastery has 5 levels, and each
      level does two things at once: it raises your drop chance per roll,
      and it raises the max number of loot drops you can have queued up
      waiting to be collected at once (10 with no mastery, up to 20 fully
      maxed). <strong>The only other thing that affects the drop chance is
      an admin-only event multiplier the devs can trigger — players can't
      get it any other way, so treat the numbers below as the real rate.</strong>
      Once you hit your active-drops cap, you have to
      <strong>wait ${escapeHtml(data?.collectCooldownSeconds ?? 60)} seconds</strong>
      before you can collect again.</p>
      <h3 class="wiki-section-heading">Furnace Loot Mastery</h3>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Mastery</th>
            <th>Cost</th>
            <th>Drop Chance (per roll)</th>
            <th>Max Active Drops</th>
          </tr>
        </thead>
        <tbody>${tierRows || '<tr><td colspan="4">Not filled in yet.</td></tr>'}</tbody>
      </table>
      <h3 class="wiki-section-heading">Loot Odds &amp; Timing</h3>
      <p>What each drop can actually be, and the real odds — sourced from
      in-game testing rather than the raw script weights, since the drop
      pool has been tweaked since. Times assume fully maxed mastery
      (20 loot/min):</p>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Reward</th>
            <th>Odds</th>
            <th>50% Chance By</th>
            <th>75% Chance By</th>
            <th>90% Chance By</th>
          </tr>
        </thead>
        <tbody>${oddsRows || '<tr><td colspan="5">Not filled in yet.</td></tr>'}</tbody>
      </table>`;
  }

  async function renderBrewerPage() {
    const data = await loadBrewerData();
    const upcrafts = data?.upcrafts ?? [];
    const tiers = data?.potionTiers ?? [];
    const upcraftRows = upcrafts.map((entry) => `
      <tr>
        <td>${formatRarity(entry.from)}</td>
        <td>${formatRarity(entry.to)}</td>
        <td>5x ${escapeHtml(entry.from)} &rarr; 1x ${escapeHtml(entry.to)}</td>
        <td>${formatCrystalCost(entry.cost)}</td>
      </tr>`).join('');
    const tierRows = tiers.map((entry) => `
      <tr>
        <td>Tier ${escapeHtml(entry.tier)}</td>
        <td>${formatRarity(entry.rarity)}</td>
        <td>${entry.multiplier ? escapeHtml(entry.multiplier) : '—'}</td>
        <td>${entry.duration ? escapeHtml(entry.duration) : '—'}</td>
      </tr>`).join('');
    return `
      <p>The Brewer upcrafts potions: 5 lower-tier potions of the same type
      (Luck, Shiny Luck, Mythic Luck, or Roll Speed) combine into 1 potion of
      that same type, one rarity tier higher — for a crystal cost that goes
      up with each tier. <strong>Unbox Slot Potion is the only potion with
      just one tier</strong> — it has no lower/higher version, so it can't be
      upcrafted.</p>
      <h3 class="wiki-section-heading">Upcraft Costs</h3>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
            <th>Upcraft</th>
            <th>Cost (per upcraft)</th>
          </tr>
        </thead>
        <tbody>${upcraftRows || '<tr><td colspan="4">Not filled in yet.</td></tr>'}</tbody>
      </table>
      <h3 class="wiki-section-heading">Potion Effects by Tier</h3>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Tier</th>
            <th>Rarity</th>
            <th>Multiplier</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>${tierRows || '<tr><td colspan="4">Not filled in yet.</td></tr>'}</tbody>
      </table>`;
  }

  // Enchanter data lives in data/manual/enchanter-data.json — same
  // plain-hand-edited-JSON convention as every other data/manual/ file.
  let enchanterDataPromise = null;
  function loadEnchanterData() {
    if (!enchanterDataPromise) {
      enchanterDataPromise = fetch('data/manual/enchanter-data.json', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => null);
    }
    return enchanterDataPromise;
  }

  async function renderEnchanterPage() {
    const data = await loadEnchanterData();
    const mechanics = data?.mechanics ?? {};
    const variantMultipliers = data?.variantMultipliers ?? {};
    const paths = data?.upgradePaths ?? [];
    const skipCosts = data?.skipCosts ?? [];
    const skipRows = skipCosts.map((entry) => `
      <tr>
        <td>${escapeHtml(entry.timeRemaining)}</td>
        <td>${formatCrystalCost(entry.crystalCost)}</td>
        <td>${formatRobuxCost(entry.robuxCost == null ? null : formatCompact(parseAbbreviated(entry.robuxCost)))}</td>
      </tr>`).join('');
    const pathRows = paths.map((entry) => {
      const fromMulti = variantMultipliers[entry.from] ? escapeHtml(variantMultipliers[entry.from]) : '—';
      const toMulti = variantMultipliers[entry.to] ? escapeHtml(variantMultipliers[entry.to]) : '—';
      const baseSeconds = parseDurationToSeconds(entry.time);
      const timeCell = baseSeconds == null
        ? '<td class="wiki-enchant-time">—</td>'
        : `<td class="wiki-enchant-time" data-base-seconds="${baseSeconds}">${escapeHtml(entry.time)}</td>`;
      return `
      <tr>
        <td>${formatRarity(entry.rarity)}</td>
        <td>${escapeHtml(entry.from)} &rarr; ${escapeHtml(entry.to)}</td>
        <td>${fromMulti} &rarr; ${toMulti}</td>
        ${timeCell}
      </tr>`;
    }).join('');
    return `
      <p>The Enchanter upgrades an item into a better variant — <strong>no
      crystal cost, just time</strong>. Common through Epic items only ever
      have Base and Shiny forms, so there's just one upgrade:
      <strong>Base &rarr; Shiny</strong>. <strong>P2W items only ever have
      Base and Shiny forms too, even at Legendary rarity.</strong>
      Every non-P2W Legendary item and every Secret item can reach Shiny
      Mythic, but it's not a strict straight line — <strong>a Base item can be
      enchanted directly into either Shiny or Mythic</strong> (the player's
      choice), and <strong>whichever one it becomes can then be enchanted
      again into Shiny Mythic</strong>.</p>
      <p>The Enchanter has <strong>${escapeHtml(mechanics.slots ?? 3)}
      slots</strong>, so up to that many items can enchant at once. While
      you're online, enchanting runs at <strong>${escapeHtml(mechanics.onlineSpeedMultiplier ?? '1.5x')}
      speed</strong>; while you're offline it drops to
      <strong>${escapeHtml(mechanics.offlineSpeedMultiplier ?? '1x')}
      speed</strong>. The Enchanting mastery has
      ${escapeHtml(mechanics.masteryLevels ?? 3)} levels, and each level adds
      <strong>${escapeHtml(mechanics.masteryBonusPerLevel ?? '+0.5x')}</strong>
      onto your online enchant speed — mastery levels do
      <strong>not</strong> affect offline speed at all.</p>
      <div class="wiki-enchant-speed-control">
        <label for="wiki-enchant-speed-input">Your enchant speed</label>
        <input type="number" id="wiki-enchant-speed-input" min="0.1" step="0.1" value="1">
        <span class="wiki-enchant-speed-hint">e.g. 1.5, 3, 12 — times below update to match</span>
      </div>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Rarity</th>
            <th>Upgrade</th>
            <th>Multiplier</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>${pathRows || '<tr><td colspan="4">Not filled in yet.</td></tr>'}</tbody>
      </table>
      <h3 class="wiki-section-heading">Skipping the Wait</h3>
      <p>Don't want to wait? The Enchanter lets you skip the remaining time
      on an item that's currently enchanting, for a price — either
      <strong>Crystals or Robux</strong>, your choice, not both. The skip
      price is based on how much time is actually left, not the item's
      full enchant time, and it isn't a smooth scale — it drops in steps
      once the remaining time falls to each benchmark below (so an item
      with, say, 40 hours left still costs the 42-hour price until it
      drops under 36 hours).</p>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Time Remaining</th>
            <th>Crystal Cost</th>
            <th>Robux Cost</th>
          </tr>
        </thead>
        <tbody>${skipRows || '<tr><td colspan="3">Not filled in yet.</td></tr>'}</tbody>
      </table>`;
  }

  // Recalculates every .wiki-enchant-time cell's displayed duration based on
  // the speed the player types into #wiki-enchant-speed-input, using each
  // cell's data-base-seconds (the real 1x time) set when the page rendered.
  // The typed speed is the player's own input, not game content, so it's
  // remembered across visits via localStorage (see the cache-policy rule:
  // player input/state is the one thing allowed to persist client-side).
  const ENCHANT_SPEED_STORAGE_KEY = 'wiki-enchant-speed';
  function wireEnchanterSpeedInput() {
    const input = document.querySelector('#wiki-enchant-speed-input');
    if (!input) return;
    try {
      const saved = localStorage.getItem(ENCHANT_SPEED_STORAGE_KEY);
      if (saved) input.value = saved;
    } catch {
      // Best-effort only — private browsing / blocked storage just falls
      // back to the default 1x each visit.
    }
    function recalc() {
      const speed = Number(input.value);
      const effectiveSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
      document.querySelectorAll('.wiki-enchant-time[data-base-seconds]').forEach((cell) => {
        const baseSeconds = Number(cell.dataset.baseSeconds);
        cell.textContent = formatSecondsAsDuration(baseSeconds / effectiveSpeed);
      });
      try {
        localStorage.setItem(ENCHANT_SPEED_STORAGE_KEY, input.value);
      } catch {
        // Best-effort only.
      }
    }
    input.addEventListener('input', recalc);
    recalc();
  }

  // P2W (dev products + game passes) data lives in
  // data/manual/p2w-dev-products-data.json — same plain-hand-edited-JSON
  // convention as every other data/manual/ file.
  let p2wDataPromise = null;
  function loadP2wData() {
    if (!p2wDataPromise) {
      p2wDataPromise = fetch('data/manual/p2w-dev-products-data.json', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => []);
    }
    return p2wDataPromise;
  }

  async function renderP2wPage() {
    const products = await loadP2wData();
    const rows = products.map((entry) => `
      <tr>
        <td>${escapeHtml(entry.name)}</td>
        <td>${formatRobuxCost(entry.robuxCost == null ? null : formatNumber(entry.robuxCost))}</td>
        <td><span class="wiki-status-badge ${entry.obtainable ? 'is-active' : 'is-expired'}">${entry.obtainable ? 'Obtainable' : 'Unobtainable'}</span></td>
        <td>${formatCodeRewards(entry.gives)}</td>
        <td>${formatNotes(entry.notes)}</td>
      </tr>`).join('');
    return `
      <p>Real-money purchases — one-time dev products and permanent game
      passes, bought straight from the Premium Shop.</p>
      <p><strong>Robux prices shown are the base price.</strong> Roblox uses
      regional pricing, so what you actually pay can be lower depending on
      where you live — and <strong>Roblox Premium members pay less on top
      of that</strong>. Don't be surprised if your price differs from what's
      listed here.</p>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Cost</th>
            <th>Obtainable?</th>
            <th>Gives</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">Not filled in yet.</td></tr>'}</tbody>
      </table>`;
  }

  // Achievements data lives in data/manual/achievements-data.json — same
  // plain-hand-edited-JSON convention as every other data/manual/ file.
  // Shape: an array of { name, levels: [{ requirement, rewards }] } —
  // most achievements will have just one entry in `levels`, but some have
  // several (each with its own requirement and reward), so `levels` is
  // always an array even for single-tier achievements.
  let achievementsDataPromise = null;
  function loadAchievementsData() {
    if (!achievementsDataPromise) {
      achievementsDataPromise = fetch('data/manual/achievements-data.json', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => []);
    }
    return achievementsDataPromise;
  }

  async function renderAchievementsPage() {
    const achievements = await loadAchievementsData();
    const sorted = [...achievements].sort((a, b) => a.name.localeCompare(b.name));
    const rows = sorted.flatMap((achievement) => {
      const levels = achievement.levels?.length ? achievement.levels : [{ requirement: null, rewards: [] }];
      return levels.map((level, i) => `
      <tr>
        ${i === 0 ? `<td rowspan="${levels.length}">${escapeHtml(achievement.name)}</td>` : ''}
        ${i === 0 ? `<td rowspan="${levels.length}">${achievement.description ? escapeHtml(achievement.description) : '—'}</td>` : ''}
        <td>Level ${i + 1}</td>
        <td>${level.requirement ? escapeHtml(level.requirement) : '—'}</td>
        <td>${formatCodeRewards(level.rewards)}</td>
      </tr>`);
    }).join('');
    return `
      <p>Every achievement in the game, sorted alphabetically. Some
      achievements only have one tier — meet the requirement once and
      you're done. Others have multiple levels, each with its own
      (usually harder) requirement and its own reward; you get every
      level's reward the moment you meet that level's requirement,
      regardless of how many levels the achievement has. Each
      achievement's description stays the same across every level.</p>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Achievement</th>
            <th>Description</th>
            <th>Level</th>
            <th>Requirement</th>
            <th>Reward</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">Not filled in yet.</td></tr>'}</tbody>
      </table>`;
  }

  const PAGES = {
    // Not one of the 13 nav-grid tiles — only reachable via the "View All
    // Updates" button on the home page once the panel preview truncates.
    updates: {
      title: 'Update Log',
      body: renderUpdatesLogPage,
    },
    'game-updates': {
      title: 'Game Update Log',
      body: renderGameUpdatesLogPage,
    },
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
      body: renderAchievementsPage,
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
      body: renderFurnaceLootPage,
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
      body: renderEnchanterPage,
      after: wireEnchanterSpeedInput,
    },
    brewer: {
      title: 'Brewer',
      body: renderBrewerPage,
    },
    p2w: {
      title: 'P2W',
      body: renderP2wPage,
    },
    'crystals-farming': {
      title: 'Crystals Farming',
      body: '<p>The best ways to farm crystals. Not written yet.</p>',
    },
    'base-progression': {
      title: 'Base Design',
      body: '<p>How to design and grow your base over time. Not written yet.</p>',
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
        if (pageTitle.textContent !== page.title) return;
        pageBody.innerHTML = html;
        if (typeof page.after === 'function') page.after();
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

  // Both home-page update panels ("Wiki & Tools Updates" and "Game
  // Updates") share this exact preview+view-all pattern: show only the most
  // recent entries, with a "View All" button that opens a dedicated
  // full-log page for the rest instead of letting the home page grow
  // without bound. Add new entries newest-first, one entry per real
  // release/work session — don't split one release into several.
  //
  // "Wiki & Tools Updates" — a changelog of THIS companion site/tools, not
  // the actual game. data/wiki-updates-data.json, {date, summary} entries.
  // Lives in data/ rather than data/manual/ — unlike the manual/ files,
  // this one isn't meant for the player to hand-edit, it's maintained by
  // whoever's doing the wiki/tools work each session.
  function formatUpdateEntries(updates) {
    return updates.map((entry) => `
      <div class="wiki-update-entry">
        <div class="wiki-update-date">${escapeHtml(entry.date)}</div>
        <p class="wiki-update-summary">${escapeHtml(entry.summary)}</p>
      </div>`).join('');
  }

  async function renderUpdatesLogPage() {
    const updates = await fetch('data/wiki-updates-data.json', { cache: 'no-store' }).then((res) => res.json()).catch(() => []);
    if (!Array.isArray(updates) || !updates.length) {
      return '<p>Not filled in yet.</p>';
    }
    return `
      <p>The full history of updates to this wiki and its tools.</p>
      ${formatUpdateEntries(updates)}`;
  }

  // "Game Updates" — a changelog of the ACTUAL GAME's patches, sourced from
  // the dev's own public patch-notes repo
  // (github.com/foshesss/drillbit-patchnotes) since the game has no
  // in-wiki data source of its own. data/game-updates-data.json (lives in
  // data/ rather than data/manual/ for the same reason as
  // wiki-updates-data.json — not something the player hand-edits),
  // {version, title, highlights: [...]} entries — ordered by real release
  // order, which is NOT always the same as version-number order (v2.0.10
  // actually shipped after v2.1, confirmed by the player — don't "fix" that
  // ordering back to numeric just because it looks wrong). v2.0.10's
  // highlights also include real additions (a new Rebirth, 2 new Crates, a
  // new P2W bundle) that the source repo's own posted notes for that
  // version omitted — confirmed firsthand by the player, not guessed.
  function formatGameUpdateEntries(updates) {
    return updates.map((entry) => `
      <div class="wiki-update-entry">
        <div class="wiki-update-version">${escapeHtml(entry.version)}${entry.date ? ` <span class="wiki-update-date-inline">${escapeHtml(entry.date)}</span>` : ''}${entry.status ? ` <span class="wiki-status-badge is-pending">${escapeHtml(entry.status)}</span>` : ''}</div>
        <p class="wiki-update-title">${escapeHtml(entry.title)}</p>
        <ul class="wiki-update-highlights">${(entry.highlights ?? []).map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
      </div>`).join('');
  }

  async function renderGameUpdatesLogPage() {
    const updates = await fetch('data/game-updates-data.json', { cache: 'no-store' }).then((res) => res.json()).catch(() => []);
    if (!Array.isArray(updates) || !updates.length) {
      return '<p>Not filled in yet.</p>';
    }
    return `
      <p>The game's own patch history, sourced from the developer's public
      patch-notes repository.</p>
      ${formatGameUpdateEntries(updates)}`;
  }

  // Balances how many entries each of the two update panels previews so
  // their "View All Updates" buttons land close to level with each other,
  // instead of a fixed entry count per panel (which only looked right at
  // one screen width/content length — Game Updates' bullet-heavy entries
  // and Wiki & Tools' one-paragraph entries wrap very differently as the
  // column width changes). Re-measures on resize since column width
  // directly changes how tall each entry wraps to (most visibly at the
  // ~860px single-column breakpoint).
  //
  // Method: render each panel's FULL entry list once (in its real
  // container, so real width/padding/fonts apply) purely to measure each
  // entry's actual rendered height, then pick the largest entry count for
  // each panel such that neither panel's cumulative preview height exceeds
  // the other's by more than one entry — the finest granularity possible
  // without splitting an entry in half. Falls back to 1 entry per panel if
  // one side has no data at all.
  function measureEntryHeights(container, formatFn, data) {
    if (!data.length) return [];
    container.innerHTML = formatFn(data);
    return [...container.querySelectorAll('.wiki-update-entry')].map((el) => el.getBoundingClientRect().height);
  }

  function finalizePanel(container, formatFn, data, count, pageKey, buttonId) {
    if (!data.length) {
      container.innerHTML = '<p class="wiki-update-placeholder">Coming soon.</p>';
      return;
    }
    const preview = data.slice(0, count);
    // Entries wrapped in their own div so the container has exactly 2 flex
    // children (this list + the button) — with justify-content:space-between
    // that pins the button flush to the container's bottom edge and the
    // entry list flush to the top, so both panels' buttons start/end at the
    // exact same y position once the panels themselves are forced to equal
    // height below, regardless of how much slack either one has.
    container.innerHTML = `<div class="wiki-update-list">${formatFn(preview)}</div><button type="button" class="wiki-view-all-updates" id="${buttonId}">View All Updates &rarr;</button>`;
    document.querySelector(`#${buttonId}`)?.addEventListener('click', () => openPage(pageKey));
  }

  function balanceUpdatePanels(a, b, dataA, dataB) {
    if (!dataA.length && !dataB.length) {
      a.container.innerHTML = '<p class="wiki-update-placeholder">Coming soon.</p>';
      b.container.innerHTML = '<p class="wiki-update-placeholder">Coming soon.</p>';
      return;
    }
    const heightsA = measureEntryHeights(a.container, a.formatFn, dataA);
    const heightsB = measureEntryHeights(b.container, b.formatFn, dataB);
    const cumulative = (heights) => heights.reduce((acc, h) => {
      acc.push((acc[acc.length - 1] ?? 0) + h);
      return acc;
    }, []);
    const cumA = cumulative(heightsA); // cumA[n-1] = height of the first n entries
    const cumB = cumulative(heightsB);
    // Try every possible entry count for A (including 0 if that side has no
    // data), find the count for B that lands closest to it, and keep
    // whichever (i, j) pair anywhere across that whole search comes closest
    // overall — a real closest-fit instead of "first count that's tall
    // enough," which could overshoot by up to a whole entry's height.
    let bestI = Math.min(1, dataA.length);
    let bestJ = Math.min(1, dataB.length);
    let bestDiff = Infinity;
    for (let i = dataA.length ? 1 : 0; i <= dataA.length; i += 1) {
      const heightA = i === 0 ? 0 : cumA[i - 1];
      for (let j = dataB.length ? 1 : 0; j <= dataB.length; j += 1) {
        const heightB = j === 0 ? 0 : cumB[j - 1];
        const diff = Math.abs(heightA - heightB);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestI = i;
          bestJ = j;
        }
      }
    }
    finalizePanel(a.container, a.formatFn, dataA, bestI, a.pageKey, a.buttonId);
    finalizePanel(b.container, b.formatFn, dataB, bestJ, b.pageKey, b.buttonId);

    // Closest-fit entry counts still leave up to ~one entry's worth of
    // height difference (content only comes in whole-entry increments) —
    // force both panel boxes to the exact same height so their bottom
    // borders line up pixel-perfect, same as their top edges already do by
    // sitting in the same grid row. Clear any stale inline height first so
    // this doesn't compound on repeated resize-triggered re-balances.
    const panelA = a.container.closest('.wiki-update-panel');
    const panelB = b.container.closest('.wiki-update-panel');
    if (panelA && panelB) {
      panelA.style.height = '';
      panelB.style.height = '';
      const tallest = Math.max(panelA.getBoundingClientRect().height, panelB.getBoundingClientRect().height);
      panelA.style.height = `${tallest}px`;
      panelB.style.height = `${tallest}px`;
    }
  }

  function wireBalancedUpdatePanels(configA, configB) {
    const containerA = document.querySelector(configA.containerId);
    const containerB = document.querySelector(configB.containerId);
    if (!containerA || !containerB) return;
    Promise.all([
      fetch(configA.dataUrl, { cache: 'no-store' }).then((res) => res.json()).catch(() => []),
      fetch(configB.dataUrl, { cache: 'no-store' }).then((res) => res.json()).catch(() => []),
    ]).then(([dataA, dataB]) => {
      const a = { ...configA, container: containerA };
      const b = { ...configB, container: containerB };
      balanceUpdatePanels(a, b, dataA, dataB);
      let resizeTimer = null;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => balanceUpdatePanels(a, b, dataA, dataB), 200);
      });
    });
  }

  wireBalancedUpdatePanels(
    { containerId: '#wiki-tools-updates', dataUrl: 'data/wiki-updates-data.json', formatFn: formatUpdateEntries, pageKey: 'updates', buttonId: 'wiki-view-all-updates' },
    { containerId: '#game-updates', dataUrl: 'data/game-updates-data.json', formatFn: formatGameUpdateEntries, pageKey: 'game-updates', buttonId: 'game-view-all-updates' },
  );
})();
