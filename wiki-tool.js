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

  // ---- Cross-page navigation markers -----------------------------------------
  // anchorAttr marks a row/paragraph as a jump target ("decoration:crates")
  // for links and search results. linkAttrs marks a chip as something that
  // MIGHT link elsewhere — activateWikiLinks() checks each one after the
  // page renders and only makes the ones it can resolve clickable (an item
  // in the Index, a known decoration, a potion), so formatters don't need
  // to know what exists.
  function anchorAttr(kind, name) {
    if (name == null || name === '') return '';
    return ` data-wiki-anchor="${escapeHtml(`${kind}:${String(name).trim().toLowerCase()}`)}"`;
  }
  function linkAttrs(kind, ref, tier) {
    return ` data-wiki-link="${kind}" data-wiki-ref="${escapeHtml(ref)}"${tier ? ` data-wiki-tier="${escapeHtml(tier)}"` : ''}`;
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
      return `<span class="wiki-reward-chip"${linkAttrs('item', name)}><img class="wiki-reward-icon" src="${iconSrc}" alt="" onerror="this.remove()">${safeName}</span>`;
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
    // "Unbox Luck Potion" (the Index tier rewards' wording) is the same
    // potion as the plain "Luck Potion" every icon file is named after.
    return name.toLowerCase().replace(/\s+/g, '').replace(/potions$/, 'potion').replace(/unboxluckpotion$/, 'luckpotion');
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
      return `<span class="wiki-reward-chip"${linkAttrs('potion', name)}>
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
      <tr${anchorAttr('rebirth', row.rebirth)}>
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
        return `<span class="wiki-reward-chip"${linkAttrs('potion', name)}>
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
      // Luck multipliers (e.g. "2x Luck", or the Index tiers' "1.05x unbox
      // luck") reuse the Luck stat icon from the Rebirth page, with the
      // multiplier as the badge.
      const luckMultiMatch = String(entry).match(/^([0-9.]+x)\s+(unbox\s+)?luck$/i);
      if (luckMultiMatch) {
        return `<span class="wiki-reward-chip">
          <span class="wiki-reward-icon-wrap">
            <img class="wiki-reward-icon" src="icons/wiki/luck-icon.png" alt="" onerror="this.parentElement.remove()">
            <span class="wiki-reward-badge">${escapeHtml(luckMultiMatch[1])}</span>
          </span>
          ${luckMultiMatch[2] ? 'Unbox Luck' : 'Luck'}
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
      return `<span class="wiki-reward-chip"${linkAttrs('item', entry)}><img class="wiki-reward-icon" src="${iconSrc}" alt="" onerror="this.remove()">${safeName}</span>`;
    }).join('');
    return `<span class="wiki-reward-list">${chips}</span>`;
  }

  async function renderCodesPage() {
    const codes = await loadCodesData();
    const rows = codes.map((entry) => `
      <tr${anchorAttr('code', entry.code)}>
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
      <tr${anchorAttr('conveyor', entry.name)}>
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
    return `<span class="wiki-reward-chip"${linkAttrs('decoration', name)}><img class="wiki-reward-icon" src="${iconSrc}" alt="" onerror="this.remove()">${safeName}</span>`;
  }

  async function renderDecorationPage() {
    const decorations = await loadDecorationData();
    const rows = decorations.map((entry) => `
      <tr${anchorAttr('decoration', entry.name)}>
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
        ? `<span class="wiki-reward-chip"${linkAttrs('item', entry.reward)}><img class="wiki-reward-icon" src="${escapeHtml(entry.icon)}" alt="" onerror="this.remove()">${escapeHtml(entry.reward)}</span>`
        : escapeHtml(entry.reward);
      return `
      <tr${anchorAttr('loot', entry.reward)}>
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
      <tr${anchorAttr('potion-tier', entry.tier)}>
        <td>Tier ${escapeHtml(entry.tier)}</td>
        <td>${formatRarity(entry.rarity)}</td>
        <td>${entry.multiplier ? escapeHtml(entry.multiplier) : '—'}</td>
        <td>${entry.duration ? escapeHtml(entry.duration) : '—'}</td>
      </tr>`).join('');
    return `
      <p${anchorAttr('potion', 'unbox slot')}>The Brewer upcrafts potions: 5 lower-tier potions of the same type
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
      <tr${anchorAttr('p2w', entry.name)}>
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
      <tr${i === 0 ? anchorAttr('achievement', achievement.name) : ''}>
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

  // Traveling Merchant data lives in data/manual/merchant-data.json — same
  // plain-hand-edited-JSON convention as every other data/manual/ file.
  // Item/price/odds rows come from the player's spreadsheet ("Merchant"
  // sheet, "Sold by Traveling Merchant" rows only); the mechanic text comes
  // from the game's TravelingMerchant script plus the player's notes on
  // what changed after it (per-player seed, 2-hour restock).
  let merchantDataPromise = null;
  function loadMerchantData() {
    if (!merchantDataPromise) {
      merchantDataPromise = fetch('data/manual/merchant-data.json', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => null);
    }
    return merchantDataPromise;
  }

  // Potions are listed by name + rarity, but their icons are keyed by tier
  // ("Tier3 Luck Potion.png"), so map rarity to tier the same way the Brewer
  // page does. Tier 1 Mythic's file is "tier1 Mythic Potion.png" (no "Luck"),
  // hence the fallback key. Everything else uses the generic item-icon guess.
  const RARITY_TO_POTION_TIER = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, secret: 6 };
  function formatMerchantItem(item) {
    if (String(item.itemType).toLowerCase() === 'potion') {
      const tier = RARITY_TO_POTION_TIER[String(item.rarity).toLowerCase()];
      const key = `tier${tier}${normalizePotionKey(item.name)}`;
      const iconFile = POTION_ICON_FILES[key] ?? POTION_ICON_FILES[key.replace('mythicluckpotion', 'mythicpotion')];
      if (tier && iconFile) {
        return `<span class="wiki-reward-chip"${linkAttrs('potion', item.name, tier)}><img class="wiki-reward-icon" src="icons/items/${encodeURIComponent(iconFile)}" alt="" onerror="this.remove()">${escapeHtml(item.name)}</span>`;
      }
      return escapeHtml(item.name);
    }
    if (String(item.itemType).toLowerCase() === 'decoration') return formatDecorationName(item.name);
    return formatCodeRewards([item.name]);
  }

  async function renderMerchantPage() {
    const data = await loadMerchantData();
    const mechanics = data?.mechanics ?? {};
    const stock = data?.stock ?? [];
    const rows = stock.map((item) => {
      const currency = String(item.currency ?? '').trim().toLowerCase();
      const costCell = currency.startsWith('crystal') ? formatCrystalCost(item.cost)
        : currency === 'cash' ? formatCashCost(item.cost)
        : '—';
      return `
      <tr>
        <td>${formatMerchantItem(item)}</td>
        <td>${formatRarity(item.rarity)}</td>
        <td>${item.itemType ? escapeHtml(item.itemType) : '—'}</td>
        <td>${item.odds ? escapeHtml(item.odds) : '—'}</td>
        <td>${costCell}</td>
      </tr>`;
    }).join('');
    const restock = mechanics.restockRobuxCost != null
      ? ` for <strong>${formatNumber(mechanics.restockRobuxCost)} Robux</strong>`
      : ' with Robux';
    return `
      <p>The Traveling Merchant sells a rotating stock of potions, upgraders,
      droppers, furnaces and decorations. His stock is <strong>personal to you</strong>: every
      player gets their own stock, and it restocks every
      <strong>${escapeHtml(mechanics.restockInterval ?? '2 Hours')}</strong>.
      You can also restock early${restock}.</p>
      <h3 class="wiki-section-heading">How his stock is rolled</h3>
      <p>Each restock fills <strong>${escapeHtml(mechanics.slots ?? 6)}
      slots</strong>. Every slot rolls on its own, so you can get several
      items of the same rarity in one restock, but <strong>the same reward
      never appears twice in one stock</strong> — a duplicate is
      re-rolled. When a potion slot comes up, its type (Luck, Shiny Luck,
      Mythic Luck or Roll Speed) is picked at random. Potions and gear cost
      Crystals; decorations cost Cash. Every item is sold as its Base
      variant — Shiny and Mythic versions only come from the Enchanter.</p>
      <h3 class="wiki-section-heading">Everything he can sell</h3>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Rarity</th>
            <th>Type</th>
            <th>Odds</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">Not filled in yet.</td></tr>'}</tbody>
      </table>`;
  }

  // Events data lives in data/manual/events-data.json — same
  // plain-hand-edited-JSON convention as every other data/manual/ file.
  // Shape: an array of { name, effect, weight }. Weight is the game's raw
  // weighted-table weight; the Chance column is computed from it.
  let eventsDataPromise = null;
  function loadEventsData() {
    if (!eventsDataPromise) {
      eventsDataPromise = fetch('data/manual/events-data.json', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => []);
    }
    return eventsDataPromise;
  }

  // The game never runs the same event twice in a row (it re-rolls a repeat),
  // so an event's real long-run chance differs slightly from weight/total:
  // after event i, the next one is drawn from the remaining events in
  // proportion to their weights. This finds the long-run share of each event
  // for that rule by iterating the transition until it settles.
  function eventLongRunChances(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    const n = weights.length;
    if (n < 2 || total <= 0) return weights.map((w) => (total > 0 ? w / total : 0));
    let share = weights.map((w) => w / total);
    for (let step = 0; step < 2000; step += 1) {
      const next = new Array(n).fill(0);
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
          if (i !== j) next[j] += (share[i] * weights[j]) / (total - weights[i]);
        }
      }
      share = next;
    }
    return share;
  }

  async function renderEventsPage() {
    const events = (await loadEventsData()).filter((e) => e && e.name);
    const weights = events.map((e) => Number(e.weight) || 0);
    const total = weights.reduce((a, b) => a + b, 0);
    const longRun = eventLongRunChances(weights);
    const rows = events.map((event, i) => `
      <tr${anchorAttr('event', event.name)}>
        <td>${escapeHtml(event.name)}</td>
        <td>${event.effect ? escapeHtml(event.effect) : '—'}</td>
        <td>${weights[i] ? formatNumber(weights[i]) : '—'}</td>
        <td>${total > 0 ? `${(longRun[i] * 100).toFixed(1)}%` : '—'}</td>
      </tr>`).join('');
    return `
      <p>Events are short server-wide boosts that everyone in the game gets at
      the same time. The schedule runs on the real clock and works in
      <strong>15-minute slots</strong>: an event runs for one slot, then the
      next slot is always empty, then another event, and so on. That's an
      event starting at :00 and :30 of every hour, each lasting 15 minutes,
      with nothing running in between.</p>
      <h3 class="wiki-section-heading">How the next event is picked</h3>
      <p>Each event slot picks its event by weighted random, so a
      higher-weight event comes up more often. The pick is seeded from the
      slot's time, so every server lands on the same event at the same
      moment, and the in-game Event Schedule menu shows the same upcoming
      events for everyone. <strong>The same event never happens twice in a
      row</strong> — if the pick matches the event before it, the game
      re-rolls. That means the rarer events come up a touch more often than
      their weight alone suggests, which the Chance column below accounts
      for.</p>
      <h3 class="wiki-section-heading">Events</h3>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Effect</th>
            <th>Weight</th>
            <th>Chance</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4">Not filled in yet.</td></tr>'}</tbody>
      </table>
      <p>Chance is each event's long-run share of all events, including the
      no-repeat rule. The Alien Invasion was a one-off limited event added in
      a Post Launch Update. It was set to start at a fixed time instead of being
      rolled, and it is no longer in the rotation.</p>`;
  }

  // Mastery data lives in data/manual/mastery-data.json — same
  // plain-hand-edited-JSON convention as every other data/manual/ file.
  // Shape: an array of { name, description, levels: [{ currency, cost,
  // effect }] } — same overall pattern as Achievements, but a mastery
  // level is BOUGHT (currency + cost) rather than earned by meeting a
  // requirement, and what you get is a scaling stat `effect` rather than
  // a one-off item/potion/crystal reward list. A mastery that's already
  // fully documented on its own dedicated page (Furnace Loot, Enchanter)
  // skips `levels` entirely and instead sets `seeAlsoPage` (a PAGES key)
  // + `seeAlsoLabel`, rendered as a link to that page instead of a
  // duplicated table.
  let masteryDataPromise = null;
  function loadMasteryData() {
    if (!masteryDataPromise) {
      masteryDataPromise = fetch('data/manual/mastery-data.json', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => []);
    }
    return masteryDataPromise;
  }

  // Mastery names that reuse an existing icon from elsewhere on the site
  // (e.g. the same roll/unbox-speed and unbox-slot icons already used in
  // P2W reward chips) instead of getting their own dedicated asset.
  const MASTERY_ICON_FILES = {
    'unbox speed': 'roll-speed-icon.png',
    'unbox slot': 'unbox-slot-icon.png',
    'plot size': 'plot-size-icon.png',
    'unbox luck': 'luck-icon.png',
    'friend luck': 'luck-icon.png',
  };
  // Generic icon+badge+label chip, reused by both formatMasteryName's
  // multi-icon special case below and formatMasteryEffect.
  function masteryChip(iconFile, badgeText, label) {
    return `<span class="wiki-reward-chip">
      <span class="wiki-reward-icon-wrap">
        <img class="wiki-reward-icon" src="icons/wiki/${iconFile}" alt="" onerror="this.parentElement.remove()">
        ${badgeText != null ? `<span class="wiki-reward-badge">${escapeHtml(badgeText)}</span>` : ''}
      </span>
      ${label ? escapeHtml(label) : ''}
    </span>`;
  }

  function formatMasteryName(name) {
    // "Shiny/Mythic Luck" covers two separate stats at once, so it gets
    // both icons side by side instead of the single-icon lookup below.
    if (name.trim().toLowerCase() === 'shiny/mythic luck') {
      return `<span class="wiki-mastery-dual-icon">
        <img class="wiki-reward-icon" src="icons/wiki/shiny-luck-icon.png" alt="" onerror="this.remove()">
        <img class="wiki-reward-icon" src="icons/wiki/mythic-luck-icon.png" alt="" onerror="this.remove()">
        ${escapeHtml(name)}
      </span>`;
    }
    const iconFile = MASTERY_ICON_FILES[name.trim().toLowerCase()];
    if (!iconFile) return escapeHtml(name);
    return `<span class="wiki-reward-chip">
      <img class="wiki-reward-icon" src="icons/wiki/${iconFile}" alt="" onerror="this.remove()">
      ${escapeHtml(name)}
    </span>`;
  }

  // Same icon as the mastery's own name (formatMasteryName above), but for
  // the per-level Effect cell — a "+N Label" effect (e.g. "+1 Unbox Slot")
  // gets the icon+badge chip treatment, while a non-delta effect (e.g.
  // "Unbox Speed = 1s") just gets the icon next to the full text.
  function formatMasteryEffect(masteryName, effectText) {
    if (!effectText) return '—';
    // "Shiny/Mythic Luck" needs its own parsing since one level's text
    // covers both stats at once ("Shiny & Mythic Luck = 1/4096") while
    // later levels split them ("Shiny Luck = 1/40, Mythic Luck = 1/100").
    if (masteryName.trim().toLowerCase() === 'shiny/mythic luck') {
      const splitMatch = effectText.match(/Shiny Luck\s*=\s*([^,]+),\s*Mythic Luck\s*=\s*(.+)/i);
      if (splitMatch) {
        const [, shinyVal, mythicVal] = splitMatch;
        return `<span class="wiki-reward-list">${masteryChip('shiny-luck-icon.png', shinyVal.trim(), 'Shiny Luck')}${masteryChip('mythic-luck-icon.png', mythicVal.trim(), 'Mythic Luck')}</span>`;
      }
      const comboMatch = effectText.match(/Shiny\s*&\s*Mythic Luck\s*=\s*(.+)/i);
      if (comboMatch) {
        const value = comboMatch[1].trim();
        return `<span class="wiki-reward-list">${masteryChip('shiny-luck-icon.png', value, 'Shiny Luck')}${masteryChip('mythic-luck-icon.png', value, 'Mythic Luck')}</span>`;
      }
      return escapeHtml(effectText);
    }
    const iconFile = MASTERY_ICON_FILES[masteryName.trim().toLowerCase()];
    if (!iconFile) return escapeHtml(effectText);
    const deltaMatch = effectText.match(/^([+-]\d+)\s+(.*)$/);
    if (deltaMatch) {
      const [, amount, label] = deltaMatch;
      return masteryChip(iconFile, amount, label);
    }
    // Not a "+N Label" delta — an absolute value the stat gets SET to at
    // this level (e.g. Unbox Speed's "1s", "0.8s"), so it gets the same
    // icon+badge chip with the raw value as the badge, and the mastery's
    // own name as the label (matching the delta case's icon+badge+label
    // layout above).
    return masteryChip(iconFile, effectText, masteryName);
  }

  async function renderMasteryPage() {
    const masteries = await loadMasteryData();
    const sorted = [...masteries].sort((a, b) => a.name.localeCompare(b.name));
    const rows = sorted.flatMap((mastery) => {
      if (mastery.seeAlsoPage) {
        return [`
      <tr${anchorAttr('mastery', mastery.name)}>
        <td>${formatMasteryName(mastery.name)}</td>
        <td>${mastery.description ? escapeHtml(mastery.description) : '—'}</td>
        <td colspan="3"><button type="button" class="wiki-notes-link" data-wiki-page-link="${escapeHtml(mastery.seeAlsoPage)}">${mastery.seeAlsoLabel ? escapeHtml(mastery.seeAlsoLabel) : 'See its own page for details'}</button></td>
      </tr>`];
      }
      const levels = mastery.levels?.length ? mastery.levels : [{ currency: null, cost: null, effect: null }];
      return levels.map((level, i) => {
        const currency = String(level.currency ?? '').trim().toLowerCase();
        const isFree = typeof level.cost === 'string' && /^free$/i.test(level.cost.trim());
        const costCell = isFree ? masteryChip('cash-icon.png', 'Free', null)
          : currency.startsWith('crystal') ? formatCrystalCost(level.cost)
          : currency === 'cash' ? formatCashCost(level.cost)
          : currency === 'robux' ? formatRobuxCost(level.cost == null ? null : formatNumber(level.cost))
          : '—';
        return `
      <tr${i === 0 ? anchorAttr('mastery', mastery.name) : ''}>
        ${i === 0 ? `<td rowspan="${levels.length}">${formatMasteryName(mastery.name)}</td>` : ''}
        ${i === 0 ? `<td rowspan="${levels.length}">${mastery.description ? escapeHtml(mastery.description) : '—'}</td>` : ''}
        <td>Level ${i + 1}</td>
        <td>${costCell}</td>
        <td>${formatMasteryEffect(mastery.name, level.effect)}</td>
      </tr>`;
      });
    }).join('');
    return `
      <p>Every mastery in the game, sorted alphabetically. Masteries are
      bought level by level — each level costs more than the last and
      gives a bigger version of the same effect.</p>
      <table class="wiki-data-table">
        <thead>
          <tr>
            <th>Mastery</th>
            <th>Description</th>
            <th>Level</th>
            <th>Cost</th>
            <th>Effect</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">Not filled in yet.</td></tr>'}</tbody>
      </table>`;
  }

  // Wires up any [data-wiki-page-link] buttons in the current page body
  // (Mastery's Furnace Loot / Enchant Speed links, an item page's "See the
  // P2W page") to navigate via openPage().
  function wirePageLinks() {
    pageBody.querySelectorAll('[data-wiki-page-link]').forEach((el) => {
      el.addEventListener('click', () => openPage(el.dataset.wikiPageLink));
    });
  }

  // ---- Index page -------------------------------------------------------------
  // Every Dropper, Upgrader, and Furnace as ONE card per item (not one per
  // variant): hover a card for a variant picker, click it for the full
  // details panel with a variant switcher. Item stats come from the
  // already-loaded globalThis.TycoonDatabase (data/items.generated.js, the
  // spreadsheet's Droppers/Upgraders/Furnaces sheets — its Capgrader/Crates/
  // Rebirth/etc. copies of the same items are skipped as duplicates). Odds
  // come from globalThis.CrateLuckData's sheetOdds — the Crates sheet's own
  // new-luck-system Odds column at base luck, the same numbers the Luck
  // Simulator reproduces at its default stats. The item sheets' own Odds
  // column is the OLD luck system (the sheet's NOTICE says so) and is never
  // used. data/manual/index-data.json holds the hand-edited extras: index
  // tier rewards, items missing from the spreadsheet (Tornado Alley), crate
  // name aliases, and the "Items That Lie" in-game labels.
  let indexDataPromise = null;
  function loadIndexData() {
    if (!indexDataPromise) {
      indexDataPromise = fetch('data/manual/index-data.json', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => ({}));
    }
    return indexDataPromise;
  }

  const INDEX_VARIANTS = ['Base', 'Shiny', 'Mythic', 'Shiny Mythic'];
  const INDEX_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Secret'];
  const INDEX_TYPES = { dropper: 'Dropper', upgrader: 'Upgrader', furnace: 'Furnace' };
  const INDEX_ITEM_SHEETS = new Set(['Droppers', 'Upgraders', 'Furnaces']);
  // Some sheet "Extra Effects" cells hold a tag instead of an effect ("P2W",
  // "Exlusive" — a recurring typo, normalized here), sometimes followed by
  // a real effect ("P2W, Applies the Derp effect to ore").
  const INDEX_TAGS = { p2w: 'P2W', exlusive: 'Exclusive', exclusive: 'Exclusive' };
  const INDEX_FILTER_STORAGE_KEY = 'wiki-index-filters';
  const INDEX_DEFAULT_FILTERS = {
    search: '', type: '', rarity: '', statType: '', source: '', variant: '', uses: '', effectOnly: false, sort: 'name',
  };

  function isBlankIndexValue(value) {
    return value == null || ['', 'n/a', '?'].includes(String(value).trim().toLowerCase());
  }

  function splitIndexEffect(text) {
    let rest = String(text ?? '').trim();
    const tags = [];
    const match = rest.match(/^(p2w|exlusive|exclusive)\s*(?:,\s*|$)/i);
    if (match) {
      tags.push(INDEX_TAGS[match[1].toLowerCase()]);
      rest = rest.slice(match[0].length).trim();
    }
    // A bare "Centered" line (Alien Helper, Fine Point, Prismatic) is the
    // sheet's shorthand for "only upgrades ore that's centered on it".
    rest = rest.replace(/^centered$/gim, 'Ore must be centered on the upgrader for it to work.');
    // A bare "Scanner" line only documented that the beam moves — the
    // scanner's own Hit Chance section covers that now.
    rest = rest.replace(/^scanner$/gim, '').trim();
    return { tags, effect: isBlankIndexValue(rest) ? '' : rest };
  }

  function indexIconSrc(name, variant) {
    const suffix = variant === 'Base' ? '' : ` ${variant}`;
    return `icons/items/${encodeURIComponent(`${name}${suffix}`)}.png`;
  }

  function indexOddsText(v, fallback) {
    if (!v.odds) return fallback;
    return v.oddsNote ? `${v.odds} (assumed)` : v.odds;
  }

  // Non-crate items grouped for the Source filter. P2W comes from the P2W
  // page's own data (any item a dev product/gamepass `gives`); the rest are
  // read from the Base variant's Obtainment Method text (Shiny versions of
  // these are usually "Enchanter Exclusive", which isn't how you first get
  // the item).
  const INDEX_SOURCE_GROUPS = [
    ['merchant', 'Merchant', /traveling merchant/i],
    ['achievement', 'Achievements', /achievement/i],
    ['code', 'Codes', /\bcode\b/i],
    ['rebirth', 'Rebirth', /\brebirth\b/i],
    ['p2w', 'P2W', null],
  ];
  function indexSourceGroup(v, isP2w) {
    if (v.crate) return v.crate;
    if (isP2w) return 'p2w';
    return INDEX_SOURCE_GROUPS.find(([, , pattern]) => pattern?.test(v.source ?? ''))?.[0] ?? null;
  }

  // Case-insensitive literal find/replace pairs from index-data.json
  // `textFixes` — e.g. the sheet calls Neon an effect, but it's a material.
  // build-crate-luck-data.mjs applies the same list for the Luck Simulator.
  function applyTextFixes(text, fixes) {
    let out = String(text ?? '');
    for (const { find, replace } of fixes ?? []) {
      out = out.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replace);
    }
    return out;
  }

  // Effects and materials (index-data.json `oreModifiers`, from the sheet's
  // "Other Info" page): each item variant gets the ones its effect text
  // mentions, shown as tags with a hover/click explanation.
  let oreModifierNotes = [];
  function modifierTagsHtml(modifiers) {
    if (!modifiers.length) return '';
    const notesFor = (m) => oreModifierNotes.filter((note) => (
      (/fire and frost/i.test(note) && /^(fire|frost)$/i.test(m.name))
      || (/cosmetic/i.test(note) && /cosmetic/i.test(m.description))
      || (/\bmaterials?\b/i.test(note) && m.type === 'Material')
    ));
    // Each effect/material has its own outline color (index-data.json
    // `color`) so they're told apart at a glance; "rainbow" gets a
    // gradient outline instead of one color.
    const tagClass = (m) => `wiki-modifier-tag is-${m.type.toLowerCase()}${m.color === 'rainbow' ? ' is-rainbow' : ''}`;
    const tagStyle = (m) => (/^#[0-9a-f]{3,8}$/i.test(m.color ?? '') ? ` style="--modifier-color: ${m.color}"` : '');
    return `<div class="wiki-modifier-tags">${modifiers.map((m) => `
      <button type="button" class="${tagClass(m)}"${tagStyle(m)} aria-expanded="false">
        ${escapeHtml(m.name)} <span class="wiki-modifier-type">${escapeHtml(m.type)}</span>
        <span class="wiki-modifier-tip" role="tooltip">
          <strong>${escapeHtml(m.name)}</strong> <span class="wiki-modifier-type">${escapeHtml(m.type)}</span>
          <span class="wiki-modifier-desc">${escapeHtml(m.description)}</span>
          ${notesFor(m).map((note) => `<span class="wiki-modifier-note">${escapeHtml(note)}</span>`).join('')}
        </span>
      </button>`).join('')}</div>`;
  }

  // The item page's effect section heading follows its tags (player
  // request): only materials → "Material(s)", only effects → "Effect(s)",
  // both → "Effects/Materials". No tags (e.g. "Clones Ore") → "Effect".
  function effectHeading(modifiers) {
    const effects = modifiers.filter((m) => m.type !== 'Material').length;
    const materials = modifiers.length - effects;
    if (effects && materials) return 'Effects/Materials';
    if (materials) return materials > 1 ? 'Materials' : 'Material';
    return effects > 1 ? 'Effects' : 'Effect';
  }

  function buildIndexItems(manual, p2wProducts) {
    const productsFor = (name) => (p2wProducts ?? [])
      .filter((p) => (p.gives ?? []).some((g) => String(g).trim().toLowerCase() === name.toLowerCase()));
    const records = (globalThis.TycoonDatabase?.records ?? []).filter((r) => INDEX_ITEM_SHEETS.has(r.sheet));
    const crateData = globalThis.CrateLuckData ?? { crates: [], items: {} };
    const crateCost = new Map(crateData.crates.map((c) => [c.name, c.cost]));
    const aliases = manual.crateNameAliases ?? {};
    // "Items That Lie": what the in-game UI rounds a value to. realValue is
    // only given when the lie isn't the main stat itself (Dream Machine's
    // per-effect bonus, Incremental Upgrader's later passes) — otherwise
    // the real value is just the item's main stat.
    const labels = new Map((manual.inGameLabels ?? []).map((e) => [`${e.name}::${e.variant}`.toLowerCase(), e]));
    const extras = (manual.extraItems ?? []).map((r) => ({ ...r, isManual: true }));
    const modifiers = (manual.oreModifiers?.list ?? []).map((m) => ({ ...m, pattern: new RegExp(m.match, 'i') }));
    oreModifierNotes = manual.oreModifiers?.notes ?? [];
    // index-data.json `hiddenItems`: items nobody has properly obtained yet
    // (Tornado Alley) — the Index shows their icon and name, everything else
    // as "???". Their real data stays in the file for when they're revealed.
    const hiddenNames = new Set((manual.hiddenItems ?? []).map((n) => String(n).trim().toLowerCase()));
    const items = new Map();
    for (const rec of [...records, ...extras]) {
      const name = String(rec.name ?? '').trim();
      const variant = String(rec.variant ?? '').trim();
      if (!name || !INDEX_TYPES[rec.type] || !INDEX_VARIANTS.includes(variant)) continue;
      const key = `${rec.type}::${name.toLowerCase()}`;
      let item = items.get(key);
      if (!item) {
        const rarity = String(rec.rarity ?? '').trim();
        item = { key, name, type: rec.type, rarity: rarity ? rarity[0].toUpperCase() + rarity.slice(1).toLowerCase() : null, variants: {} };
        items.set(key, item);
      }
      if (item.variants[variant]) continue;
      const crateItem = crateData.items[aliases[name] ?? name];
      const crate = crateItem ? (crateItem.anyCrate ? 'Any Crate' : crateItem.crates[0] ?? null) : null;
      const { tags, effect: sheetEffect } = splitIndexEffect(rec.description || rec.effects);
      // Player-supplied effects the sheet leaves as "N/A" (index-data.json
      // `extraEffects`, by item name, applied to every variant).
      const effect = applyTextFixes([sheetEffect, manual.extraEffects?.[name]].filter(Boolean).join('\n'), manual.textFixes);
      item.variants[variant] = {
        variant,
        mainStat: typeof rec.mainStat === 'number' ? rec.mainStat : null,
        mainStatType: isBlankIndexValue(rec.mainStatType) ? null : rec.mainStatType,
        statUnknown: rec.isManual && typeof rec.mainStat !== 'number',
        size: rec.size ? `${rec.size.width}x${rec.size.length}` : null,
        dropSpeed: rec.dropSpeed ?? null,
        oreSize: rec.oreSize ?? null,
        conveyorSpeed: rec.conveyorSpeed ?? null,
        range: isBlankIndexValue(rec.range) ? null : rec.range,
        limitedUses: isBlankIndexValue(rec.limitedUses) ? null : String(rec.limitedUses),
        // Fix the sheet's recurring "Rebrith"/"Exlusive" typos for display.
        source: rec.source ? String(rec.source).replace(/\bRebrith\b/gi, 'Rebirth').replace(/\bExlusive\b/gi, 'Exclusive') : null,
        crate,
        crateCost: crate && crate !== 'Any Crate' ? crateCost.get(crate) ?? null : null,
        odds: crateItem?.variants?.[variant]?.sheetOdds ?? null,
        // Set by build-crate-luck-data.mjs for odds that are a guess, not a
        // real sheet weight (currently only Tornado Alley).
        oddsNote: crateItem?.oddsAssumed
          ? (typeof crateItem.oddsAssumed === 'string' ? crateItem.oddsAssumed : 'Assumed odds — the real odds aren\'t known yet.')
          : null,
        effect,
        // modifierExclusions: tags an item's text mentions but it doesn't
        // actually interact with (Acid Plant's Neon note).
        modifiers: modifiers.filter((m) => m.pattern.test(effect) && !(manual.modifierExclusions?.[name] ?? []).includes(m.name)),
        tags,
        inGameLabel: labels.get(`${name}::${variant}`.toLowerCase()) ?? null,
      };
    }
    for (const item of items.values()) {
      item.variantList = INDEX_VARIANTS.filter((v) => item.variants[v]);
      const base = item.variants.Base ?? item.variants[item.variantList[0]];
      item.base = base;
      item.tags = [...new Set(item.variantList.flatMap((v) => item.variants[v].tags))];
      item.hasEffect = item.variantList.some((v) => item.variants[v].effect);
      item.statType = item.type === 'upgrader' ? base.mainStatType : null;
      item.crate = base.crate;
      item.modifiers = [...new Map(item.variantList.flatMap((v) => item.variants[v].modifiers).map((m) => [m.name, m])).values()];
      item.p2wProducts = productsFor(item.name);
      item.sourceGroup = indexSourceGroup(base, item.p2wProducts.length > 0);
      item.hidden = hiddenNames.has(item.name.toLowerCase());
    }
    return [...items.values()];
  }

  function formatIndexStatNumber(value) {
    if (Math.abs(value) >= 1000) return formatCompact(value);
    return String(Number(value.toFixed(4)));
  }

  // The headline stat for one variant: Ore Value for droppers, a flat
  // "+N" for additive upgraders, an "Nx" multiplier for everything else.
  function indexMainStat(item, v) {
    const label = item.type === 'dropper' ? 'Ore Value'
      : item.type === 'upgrader' && v.mainStatType === 'Additive' ? 'Adds'
        : 'Multiplier';
    if (v.mainStat == null) return { label, text: v.statUnknown ? '?' : 'See effect' };
    const number = formatIndexStatNumber(v.mainStat);
    if (item.type === 'dropper') return { label, text: number };
    if (item.type === 'upgrader' && v.mainStatType === 'Additive') return { label, text: `+${number}` };
    return { label, text: `${number}x` };
  }

  function indexSourceLabel(crate) {
    return crate === 'Any Crate' ? 'Any Crate (limited time)' : `${crate} Crate`;
  }

  function readIndexFilters() {
    try {
      const saved = JSON.parse(localStorage.getItem(INDEX_FILTER_STORAGE_KEY));
      if (saved && typeof saved === 'object') return { ...INDEX_DEFAULT_FILTERS, ...saved };
    } catch {
      // Storage unavailable or corrupt — fall back to defaults.
    }
    return { ...INDEX_DEFAULT_FILTERS };
  }

  function saveIndexFilters(filters) {
    try {
      localStorage.setItem(INDEX_FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // Storage unavailable — filters just won't be remembered.
    }
  }

  // Index tier rewards live in their own hand-edited file,
  // data/manual/index-tier-data.json: [{ name, "Items Required",
  // "chat tag", Rewards: [...] }] — the player's own key names, kept as-is.
  let indexTierDataPromise = null;
  function loadIndexTierData() {
    if (!indexTierDataPromise) {
      indexTierDataPromise = fetch('data/manual/index-tier-data.json', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => []);
    }
    return indexTierDataPromise;
  }

  function renderIndexTiers(tiers) {
    if (!Array.isArray(tiers) || !tiers.length) {
      return '<p class="wiki-index-muted">Index tier rewards are coming soon.</p>';
    }
    const rows = tiers.map((tier) => {
      const tag = tier['chat tag'];
      return `
      <tr${anchorAttr('tier', tier.name)}>
        <td>${escapeHtml(tier.name ?? '—')}</td>
        <td>${formatNumber(parseAbbreviated(tier['Items Required']) ?? tier['Items Required'] ?? '—')}</td>
        <td>${tag ? `<span class="wiki-chat-tag wiki-index-tier-tag">[${escapeHtml(tag)}]</span>` : '—'}</td>
        <td>${formatCodeRewards(tier.Rewards)}</td>
      </tr>`;
    }).join('');
    return `
      <p>Discover enough items and you rank up an index tier, earning a chat
      tag plus rewards for each one.</p>
      <table class="wiki-data-table">
        <thead><tr><th>Tier</th><th>Items Required</th><th>Chat Tag</th><th>Rewards</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  let indexItems = [];
  async function renderIndexPage() {
    const [manual, p2wProducts, tiers] = await Promise.all([loadIndexData(), loadP2wData(), loadIndexTierData()]);
    indexItems = buildIndexItems(manual, p2wProducts);
    const crateNames = (globalThis.CrateLuckData?.crates ?? []).map((c) => c.name);
    const option = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    return `
      <h3 class="wiki-section-heading">Index Tiers</h3>
      ${renderIndexTiers(tiers)}
      <h3 class="wiki-section-heading">Item Index</h3>
      <p>Every Dropper, Upgrader, and Furnace in the game, one card per item.
      Hover a card to pick a variant, or click it to open its page. Odds
      are at base luck — use the Luck Simulator to see them at your own luck.</p>
      <div class="wiki-index-toolbar">
        <input class="wiki-index-search" type="search" data-index-filter="search" placeholder="Search items…" aria-label="Search items">
        <select data-index-filter="type" aria-label="Type">${option('', 'All types')}${Object.entries(INDEX_TYPES).map(([v, l]) => option(v, `${l}s`)).join('')}</select>
        <select data-index-filter="rarity" aria-label="Rarity">${option('', 'All rarities')}${INDEX_RARITIES.map((r) => option(r, r)).join('')}</select>
        <select data-index-filter="statType" aria-label="Stat type">${option('', 'All stat types')}${option('Additive', 'Additive')}${option('Multiplicative', 'Multiplicative')}${option('Mixed', 'Mixed')}</select>
        <select data-index-filter="source" aria-label="Source">${option('', 'All sources')}${crateNames.map((c) => option(c, `${c} Crate`)).join('')}${option('Any Crate', 'Any Crate (limited time)')}${INDEX_SOURCE_GROUPS.map(([value, label]) => option(value, label)).join('')}${option('none', 'Not from a crate')}</select>
        <select data-index-filter="variant" aria-label="Variants">${option('', 'Any variants')}${option('Shiny', 'Has Shiny')}${option('Mythic', 'Has Mythic')}${option('Base only', 'Base only')}</select>
        <select data-index-filter="uses" aria-label="Uses">${option('', 'Any uses')}${option('limited', 'Limited uses')}${option('unlimited', 'Unlimited uses')}</select>
        <label class="wiki-index-check"><input type="checkbox" data-index-filter="effectOnly"> Has a special effect</label>
        <select data-index-filter="sort" aria-label="Sort">${option('name', 'A–Z')}${option('name-desc', 'Z–A')}${option('rarity-asc', 'Rarity: Low to High')}${option('rarity-desc', 'Rarity: High to Low')}</select>
        <button type="button" class="wiki-index-reset">Reset</button>
        <span class="wiki-index-count" aria-live="polite"></span>
      </div>
      <div class="wiki-index-grid"></div>
      <div class="wiki-index-popover" hidden></div>`;
  }

  function indexItemMatches(item, f) {
    if (f.search && !item.name.toLowerCase().includes(f.search.trim().toLowerCase())) return false;
    if (f.rarity && item.rarity !== f.rarity) return false;
    // A hidden item only shows under filters its icons, name and rarity
    // already give away — otherwise the filter itself would leak its type etc.
    if (item.hidden) return !(f.type || f.statType || f.source || f.uses || f.effectOnly);
    if (f.type && item.type !== f.type) return false;
    if (f.statType && item.statType !== f.statType) return false;
    if (f.source === 'none' ? item.crate : f.source && item.sourceGroup !== f.source) return false;
    if (f.variant === 'Base only' && item.variantList.length > 1) return false;
    if ((f.variant === 'Shiny' || f.variant === 'Mythic') && !item.variants[f.variant]) return false;
    if (f.uses) {
      const uses = item.base.limitedUses;
      if (!uses) return false;
      if ((f.uses === 'unlimited') !== (uses.toLowerCase() === 'unlimited')) return false;
    }
    if (f.effectOnly && !item.hasEffect) return false;
    return true;
  }

  function sortIndexItems(list, sort) {
    const byName = (a, b) => a.name.localeCompare(b.name);
    const rank = (item) => INDEX_RARITIES.indexOf(item.rarity);
    const sorters = {
      name: byName,
      'name-desc': (a, b) => byName(b, a),
      'rarity-asc': (a, b) => rank(a) - rank(b) || byName(a, b),
      'rarity-desc': (a, b) => rank(b) - rank(a) || byName(a, b),
    };
    return [...list].sort(sorters[sort] ?? byName);
  }

  function indexVariantDots(item) {
    return item.variantList.filter((v) => v !== 'Base')
      .map((v) => `<span class="wiki-index-dot is-${v.toLowerCase().replace(' ', '-')}" title="${escapeHtml(v)}"></span>`).join('');
  }

  const HIDDEN_TEXT = '???';
  function indexCardHtml(item) {
    const color = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.Common;
    return `
      <button type="button" class="wiki-index-card" data-index-key="${escapeHtml(item.key)}" style="--rarity-color: ${color}">
        <span class="wiki-index-dots">${indexVariantDots(item)}</span>
        <img class="wiki-index-card-icon" src="${indexIconSrc(item.name, item.variantList[0])}" alt="" loading="lazy" onerror="this.classList.add('is-missing')">
        <span class="wiki-index-card-name">${escapeHtml(item.name)}</span>
      </button>`;
  }

  function indexVariantChips(item, active) {
    return item.variantList.map((v) => `
      <button type="button" class="wiki-index-variant-chip is-${v.toLowerCase().replace(' ', '-')}${v === active ? ' is-active' : ''}" data-index-variant="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('');
  }

  function indexPopoverPreview(item, variant) {
    const v = item.variants[variant];
    if (item.hidden) {
      return `
      <img class="wiki-index-popover-icon" src="${indexIconSrc(item.name, variant)}" alt="" onerror="this.classList.add('is-missing')">
      <div class="wiki-index-popover-stats">
        <div><span>${HIDDEN_TEXT}</span> <strong>${HIDDEN_TEXT}</strong></div>
        ${v.odds ? `<div><span>Odds</span> <strong>${escapeHtml(indexOddsText(v))}</strong></div>` : ''}
        <p>${HIDDEN_TEXT}</p>
      </div>`;
    }
    const stat = indexMainStat(item, v);
    return `
      <img class="wiki-index-popover-icon" src="${indexIconSrc(item.name, variant)}" alt="" onerror="this.classList.add('is-missing')">
      <div class="wiki-index-popover-stats">
        <div><span>${escapeHtml(stat.label)}</span> <strong>${escapeHtml(stat.text)}</strong></div>
        ${v.odds ? `<div><span>Odds</span> <strong>${escapeHtml(indexOddsText(v))}</strong></div>` : ''}
        ${v.effect ? `<p>${escapeHtml(v.effect)}</p>` : ''}
      </div>`;
  }

  function indexPopoverHtml(item, variant) {
    return `
      <div class="wiki-index-popover-head">
        <strong>${escapeHtml(item.name)}</strong>
        ${formatRarity(item.rarity)}
      </div>
      <div class="wiki-index-variant-row">${indexVariantChips(item, variant)}</div>
      <div class="wiki-index-popover-preview">${indexPopoverPreview(item, variant)}</div>
      <p class="wiki-index-popover-hint">Click for full details</p>`;
  }

  function indexStatTile(label, value) {
    return `<div class="wiki-index-stat"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
  }

  // P2W products that give this item (from the P2W page's own data), each
  // with its Robux cost and notes — formatNotes() turns a "Drillbit & Co."
  // mention into the same link button the P2W page shows.
  function itemP2wHtml(item) {
    if (!item.p2wProducts.length) return '';
    const rows = item.p2wProducts.map((product) => `
      <div class="wiki-item-p2w-row">
        <strong>${escapeHtml(product.name)}</strong>
        ${formatRobuxCost(product.robuxCost == null ? null : formatNumber(product.robuxCost))}
        ${product.notes ? `<span class="wiki-item-p2w-notes">${formatNotes(product.notes)}</span>` : ''}
      </div>`).join('');
    return `
      <div class="wiki-item-p2w">
        ${rows}
        <button type="button" class="wiki-notes-link" data-wiki-page-link="p2w">See the P2W page</button>
      </div>`;
  }

  // ---- Scanner hit chance (item pages) ----------------------------------------
  // The formulas and beam geometry come from capgrader-generator.js
  // (globalThis.TycoonScanners), fit against scripts/scanner-hit-simulator.mjs
  // — see AI_DECISIONS.md "Scanner hit-chance formulas". Ore sizes are raw
  // database units, the same as a dropper's Ore Size stat.
  const SCANNER_SAMPLE_SIZES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5];
  const SCANNER_SIDE_LANE = 0.25; // a quarter of the way in from either edge
  let scannerOreSize = 1;

  function scannerPercent(chance) {
    return `${Number((chance * 100).toFixed(1))}%`;
  }

  function scannerAvgMultiplier(chance, mainStat) {
    return `${Number((chance * mainStat + (1 - chance)).toFixed(3))}x`;
  }

  function scannerFormulaHtml(geometry) {
    const k = globalThis.TycoonScanners.constants;
    if (geometry.kind === 'azure') {
      const when = `if oreSize ≥ ${geometry.guaranteedHitAtOrAboveRaw}:`;
      return `
        <pre class="wiki-scanner-formula">${when}  hit chance = 100%
${'otherwise:'.padEnd(when.length)}  hit chance = (${k.AZURE_EXPECTED_INTERCEPT} + ${k.AZURE_EXPECTED_SLOPE} × oreSize) %</pre>`;
    }
    const n = (value) => Number(value.toFixed(4));
    return `
      <pre class="wiki-scanner-formula">oreTiles      = oreSize / 2.5
dwell         = (oreTiles + ${geometry.beamLenY}) / ${n(geometry.conveyorSpeed)}
beamSpeed     = π × ${geometry.speedCyc} × ${geometry.convWidth}
reach         = oreTiles / 2 + ${n(geometry.beamWidthX / 2)} + ${k.SWEEP_DWELL_K} × dwell × beamSpeed
lo, hi        = ore's lane ∓ reach, clipped to the belt
u             = the same lo, hi rescaled so the belt runs from -1 to 1
hit chance    = (asin(u_hi) − asin(u_lo)) / π</pre>`;
  }

  function scannerCalcResultHtml(item, v, geometry) {
    const hit = globalThis.TycoonScanners.hitChance;
    const size = scannerOreSize;
    if (!(size > 0)) return '<p class="wiki-index-muted">Enter an ore size above 0.</p>';
    if (geometry.kind === 'azure') {
      const chance = hit(item.name, size);
      return `<div class="wiki-index-stats">${indexStatTile('Hit Chance', scannerPercent(chance))}${indexStatTile('Avg Multiplier', scannerAvgMultiplier(chance, v.mainStat))}</div>`;
    }
    const center = hit(item.name, size, 0.5);
    const side = hit(item.name, size, SCANNER_SIDE_LANE);
    return `<div class="wiki-index-stats">
      ${indexStatTile('Center of Belt', scannerPercent(center))}
      ${indexStatTile('Side of Belt', scannerPercent(side))}
      ${indexStatTile('Avg Multiplier (Center)', scannerAvgMultiplier(center, v.mainStat))}
      ${indexStatTile('Avg Multiplier (Side)', scannerAvgMultiplier(side, v.mainStat))}
    </div>`;
  }

  function scannerSectionHtml(item, v) {
    const geometry = globalThis.TycoonScanners?.geometry?.[item.name];
    if (!geometry || typeof v.mainStat !== 'number') return '';
    const hit = globalThis.TycoonScanners.hitChance;
    const sweep = geometry.kind === 'sweep';
    const rows = SCANNER_SAMPLE_SIZES.map((size) => {
      if (!sweep) {
        const chance = hit(item.name, size);
        return `<tr><td>${size}</td><td>${scannerPercent(chance)}</td><td>${scannerAvgMultiplier(chance, v.mainStat)}</td></tr>`;
      }
      const center = hit(item.name, size, 0.5);
      const side = hit(item.name, size, SCANNER_SIDE_LANE);
      return `<tr><td>${size}</td><td>${scannerPercent(center)}</td><td>${scannerPercent(side)}</td><td>${scannerAvgMultiplier(center, v.mainStat)}</td><td>${scannerAvgMultiplier(side, v.mainStat)}</td></tr>`;
    }).join('');
    const head = sweep
      ? '<tr><th>Ore Size</th><th>Center</th><th>Side</th><th>Avg Mult. (Center)</th><th>Avg Mult. (Side)</th></tr>'
      : '<tr><th>Ore Size</th><th>Hit Chance</th><th>Avg Multiplier</th></tr>';
    const movement = sweep
      ? `<p>The beam sweeps side to side across the belt in a sine wave (${geometry.speedCyc} sweeps per second), slowing down at each edge and moving fastest through the middle. It only upgrades ore the beam touches as the ore passes under it.</p>
        <p class="wiki-index-lie"><strong>Tip:</strong> it's better to hit the ore on the sides of the belt instead of the center — the beam spends more of its time near the edges.</p>`
      : `<p>The beam spins in a full circle (180° per second) standing up across the belt, like a fan blade. Any ore with an Ore Size of ${geometry.guaranteedHitAtOrAboveRaw} or more is tall enough to always get hit. Smaller ore can miss, and where the ore is on the belt doesn't matter.</p>
        <p class="wiki-index-lie">For ore smaller than ${geometry.guaranteedHitAtOrAboveRaw}, the hit chance is an average, not a promise: the same ore and drop speed can hit almost every time or almost never, depending on when your base started running. Drop speeds that line up with the beam's 2-second spin (0.25, 1, 1.5, 2, 3, 4) are the most likely to get stuck that way; 1.2 avoids it best.</p>`;
    return `
      <h3 class="wiki-section-heading">Hit Chance</h3>
      ${movement}
      <label class="wiki-scanner-input">Your ore size
        <input type="number" min="0" step="0.05" value="${scannerOreSize}" data-scanner-ore-size aria-label="Ore size">
      </label>
      <div class="wiki-scanner-result">${scannerCalcResultHtml(item, v, geometry)}</div>
      <div class="wiki-scanner-scroll">
        <table class="wiki-data-table wiki-scanner-table">
          <thead>${head}</thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="wiki-index-muted">Avg multiplier counts a miss as 1x (the ore just isn't upgraded)${sweep ? '. "Side" is ore a quarter of the way in from either edge' : ''}. Ore Size is the same number as a dropper's Ore Size stat.</p>
      <h4 class="wiki-scanner-subheading">Formula</h4>
      <div class="wiki-scanner-scroll">${scannerFormulaHtml(geometry)}</div>`;
  }

  // The full item page (replaces the old Index side panel) — opened by
  // clicking a card, or from anywhere via openItemPage().
  // A hidden item's page: icon, name, rarity, variant switcher and odds only.
  function hiddenItemPageHtml(item, variant) {
    const v = item.variants[variant];
    return `
      <div class="wiki-item-page">
        <div class="wiki-item-hero">
          <div class="wiki-index-detail-art" style="--rarity-color: ${RARITY_COLORS[item.rarity] ?? RARITY_COLORS.Common}">
            <img src="${indexIconSrc(item.name, variant)}" alt="" onerror="this.classList.add('is-missing')">
          </div>
          <div class="wiki-item-summary">
            <div class="wiki-index-detail-tags">
              ${formatRarity(item.rarity)}
              <span class="wiki-index-tag">${HIDDEN_TEXT}</span>
            </div>
            <div class="wiki-index-variant-row" role="tablist" aria-label="Variant">${indexVariantChips(item, variant)}</div>
            <div class="wiki-index-stats">${[1, 2, 3, 4].map(() => indexStatTile(HIDDEN_TEXT, HIDDEN_TEXT)).join('')}</div>
          </div>
        </div>
        <h3 class="wiki-section-heading">Effect</h3>
        <p class="wiki-index-effect">${HIDDEN_TEXT}</p>
        <h3 class="wiki-section-heading">How to Get</h3>
        <p>${HIDDEN_TEXT}</p>
        ${v.odds ? `<div class="wiki-index-stats">${indexStatTile('Odds (Base Luck)', escapeHtml(indexOddsText(v)))}</div>` : ''}
        ${v.oddsNote ? `<p class="wiki-index-lie">${escapeHtml(v.oddsNote)}</p>` : ''}
      </div>`;
  }

  function itemPageHtml(item, variant) {
    if (item.hidden) return hiddenItemPageHtml(item, variant);
    const v = item.variants[variant];
    const color = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.Common;
    const stat = indexMainStat(item, v);
    const tiles = [indexStatTile(stat.label, escapeHtml(stat.text))];
    if (v.mainStatType && item.type === 'upgrader') tiles.push(indexStatTile('Stat Type', escapeHtml(v.mainStatType)));
    if (v.size) tiles.push(indexStatTile('Size', escapeHtml(v.size)));
    if (v.dropSpeed != null) tiles.push(indexStatTile('Drop Speed', escapeHtml(v.dropSpeed)));
    if (v.oreSize != null) tiles.push(indexStatTile('Ore Size', escapeHtml(v.oreSize)));
    if (v.conveyorSpeed != null) tiles.push(indexStatTile('Conveyor Speed', escapeHtml(v.conveyorSpeed)));
    if (v.range) tiles.push(indexStatTile('Range', escapeHtml(v.range)));
    if (v.limitedUses) tiles.push(indexStatTile('Uses', escapeHtml(v.limitedUses === '1' ? '1 (Limited)' : v.limitedUses)));

    const howToGet = [];
    // A P2W item's source text usually just repeats the P2W block below —
    // only keep it when it adds something ("Enchanter Exclusive").
    const sourceRepeatsP2w = item.p2wProducts.length && !/enchant/i.test(v.source ?? '');
    if (v.source && !sourceRepeatsP2w) howToGet.push(`<p>${escapeHtml(v.source)}</p>`);
    if (v.crate || v.odds) {
      const tilesGet = [];
      if (v.crate) tilesGet.push(indexStatTile('Crate', escapeHtml(indexSourceLabel(v.crate))));
      if (v.crateCost) tilesGet.push(indexStatTile('Crate Cost', escapeHtml(v.crateCost)));
      tilesGet.push(indexStatTile('Odds (Base Luck)', escapeHtml(indexOddsText(v, 'Unknown'))));
      howToGet.push(`<div class="wiki-index-stats">${tilesGet.join('')}</div>`);
      if (v.oddsNote) howToGet.push(`<p class="wiki-index-lie">${escapeHtml(v.oddsNote)}</p>`);
    }

    const anyOdds = item.variantList.some((name) => item.variants[name].odds);
    const compareRows = item.variantList.map((name) => {
      const row = item.variants[name];
      return `
        <tr class="${name === variant ? 'is-active' : ''}" data-index-variant="${escapeHtml(name)}">
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(indexMainStat(item, row).text)}</td>
          ${anyOdds ? `<td>${escapeHtml(indexOddsText(row, '—'))}</td>` : ''}
        </tr>`;
    }).join('');

    const p2w = itemP2wHtml(item);
    return `
      <div class="wiki-item-page">
        <div class="wiki-item-hero">
          <div class="wiki-index-detail-art" style="--rarity-color: ${color}">
            <img src="${indexIconSrc(item.name, variant)}" alt="" onerror="this.classList.add('is-missing')">
          </div>
          <div class="wiki-item-summary">
            <div class="wiki-index-detail-tags">
              ${formatRarity(item.rarity)}
              <span class="wiki-index-tag">${escapeHtml(INDEX_TYPES[item.type])}</span>
              ${item.tags.map((t) => `<span class="wiki-index-tag">${escapeHtml(t)}</span>`).join('')}
            </div>
            <div class="wiki-index-variant-row" role="tablist" aria-label="Variant">${indexVariantChips(item, variant)}</div>
            <div class="wiki-index-stats">${tiles.join('')}</div>
            ${v.inGameLabel ? `<p class="wiki-index-lie"><strong>In-game shows:</strong> ${escapeHtml(v.inGameLabel.label)} — the real value is <strong>${escapeHtml(v.inGameLabel.realValue ?? `${formatIndexStatNumber(v.mainStat)}x`)}</strong> (the game rounds it)</p>` : ''}
          </div>
        </div>
        ${v.effect ? `<h3 class="wiki-section-heading">${effectHeading(v.modifiers)}</h3>${modifierTagsHtml(v.modifiers)}<p class="wiki-index-effect">${escapeHtml(v.effect)}</p>` : ''}
        ${scannerSectionHtml(item, v)}
        <h3 class="wiki-section-heading">How to Get</h3>
        ${howToGet.join('') || (p2w ? '' : '<p>—</p>')}
        ${p2w}
        ${item.variantList.length > 1 ? `
          <h3 class="wiki-section-heading">All Variants</h3>
          <table class="wiki-data-table wiki-index-compare">
            <thead><tr><th>Variant</th><th>${escapeHtml(stat.label)}</th>${anyOdds ? '<th>Odds</th>' : ''}</tr></thead>
            <tbody>${compareRows}</tbody>
          </table>` : ''}
      </div>`;
  }

  function wireIndexPage() {
    const grid = pageBody.querySelector('.wiki-index-grid');
    const popover = pageBody.querySelector('.wiki-index-popover');
    const countEl = pageBody.querySelector('.wiki-index-count');
    const controls = [...pageBody.querySelectorAll('[data-index-filter]')];
    if (!grid) return;
    const byKey = new Map(indexItems.map((item) => [item.key, item]));
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let filters = readIndexFilters();
    let popoverKey = null;
    let hideTimer = null;

    function syncControls() {
      controls.forEach((el) => {
        const name = el.dataset.indexFilter;
        if (el.type === 'checkbox') el.checked = Boolean(filters[name]);
        else el.value = filters[name] ?? '';
        if (el.tagName === 'SELECT' && el.selectedIndex === -1) { el.selectedIndex = 0; filters[name] = el.value; }
      });
    }

    function renderGrid() {
      const list = sortIndexItems(indexItems.filter((item) => indexItemMatches(item, filters)), filters.sort);
      grid.innerHTML = list.length ? list.map(indexCardHtml).join('') : '<p class="wiki-index-muted">No items match these filters.</p>';
      countEl.textContent = `${list.length} of ${indexItems.length} items`;
    }

    function openDetail(key, variant) {
      hidePopover();
      openItemPage(key, variant);
    }

    function showPopover(card) {
      clearTimeout(hideTimer);
      const item = byKey.get(card.dataset.indexKey);
      if (!item) return;
      if (popoverKey !== item.key) {
        popoverKey = item.key;
        popover.innerHTML = indexPopoverHtml(item, item.variantList[0]);
      }
      popover.hidden = false;
      const rect = card.getBoundingClientRect();
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      let left = rect.right + 8;
      if (left + width > window.innerWidth - 8) left = rect.left - width - 8;
      left = Math.max(8, left);
      let top = rect.top;
      if (top + height > window.innerHeight - 8) top = window.innerHeight - height - 8;
      popover.style.left = `${left}px`;
      // 62px keeps it below the site's fixed Tool Menu / Feedback buttons,
      // which sit above the whole wiki layer (.wiki-body is its own stacking
      // context, so no z-index here can beat them).
      popover.style.top = `${Math.max(62, top)}px`;
    }

    function hidePopover() {
      clearTimeout(hideTimer);
      popover.hidden = true;
      popoverKey = null;
    }

    function scheduleHide() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hidePopover, 160);
    }

    controls.forEach((el) => {
      el.addEventListener(el.type === 'search' ? 'input' : 'change', () => {
        filters[el.dataset.indexFilter] = el.type === 'checkbox' ? el.checked : el.value;
        saveIndexFilters(filters);
        renderGrid();
      });
    });
    pageBody.querySelector('.wiki-index-reset')?.addEventListener('click', () => {
      filters = { ...INDEX_DEFAULT_FILTERS };
      saveIndexFilters(filters);
      syncControls();
      renderGrid();
    });

    grid.addEventListener('click', (event) => {
      const card = event.target.closest('.wiki-index-card');
      if (card) openDetail(card.dataset.indexKey, 'Base');
    });
    if (canHover) {
      grid.addEventListener('mouseover', (event) => {
        const card = event.target.closest('.wiki-index-card');
        if (card) showPopover(card);
      });
      grid.addEventListener('mouseout', (event) => {
        const card = event.target.closest('.wiki-index-card');
        if (card && !card.contains(event.relatedTarget)) scheduleHide();
      });
      popover.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      popover.addEventListener('mouseleave', scheduleHide);
      popover.addEventListener('mouseover', (event) => {
        const chip = event.target.closest('[data-index-variant]');
        const item = byKey.get(popoverKey);
        if (!chip || !item) return;
        popover.querySelectorAll('.wiki-index-variant-chip').forEach((el) => el.classList.toggle('is-active', el === chip));
        popover.querySelector('.wiki-index-popover-preview').innerHTML = indexPopoverPreview(item, chip.dataset.indexVariant);
      });
      popover.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-index-variant]');
        const active = popover.querySelector('.wiki-index-variant-chip.is-active');
        if (popoverKey) openDetail(popoverKey, (chip ?? active)?.dataset.indexVariant ?? 'Base');
      });
    }

    activeIndexPage = { hidePopover };

    syncControls();
    renderGrid();

    // Coming back from an item page: highlight the card they opened (the
    // navigation history restores the scroll position itself).
    if (indexReturnKey) {
      const card = grid.querySelector(`[data-index-key="${CSS.escape(indexReturnKey)}"]`);
      indexReturnKey = null;
      if (card) {
        card.classList.add('is-selected');
        card.focus({ preventScroll: true });
      }
    }
  }

  // Registered once (not per page open, which would stack a new listener
  // every visit) and routed to whichever Index page instance is current.
  let activeIndexPage = null;
  let indexReturnKey = null;
  // The hover popover is position:fixed, so any scroll would leave it
  // floating over the wrong card — just hide it.
  window.addEventListener('scroll', () => activeIndexPage?.hidePopover(), { passive: true });

  // Builds the item list without rendering the Index page, so an item page
  // can open straight from anywhere (another wiki page, a tool) even if the
  // Index was never visited this session.
  async function ensureIndexItems() {
    if (indexItems.length) return indexItems;
    const [manual, p2wProducts] = await Promise.all([loadIndexData(), loadP2wData()]);
    indexItems = buildIndexItems(manual, p2wProducts);
    return indexItems;
  }

  function findIndexItem(ref) {
    const needle = String(ref ?? '').trim().toLowerCase();
    return indexItems.find((item) => item.key === needle) ?? indexItems.find((item) => item.name.toLowerCase() === needle) ?? null;
  }

  // Renders one item's full page for a navigation entry
  // ({ kind: 'item', ref, variant }). `ref` is an item key ("upgrader::alien
  // invasion") or plain name ("Alien Invasion").
  async function renderItemEntry(entry, scrollY) {
    const token = ++pageToken;
    pageBody.onclick = null;
    pageBody.onkeydown = null;
    pageBody.oninput = null;
    homeView.hidden = true;
    pageView.hidden = false;
    await ensureIndexItems();
    if (token !== pageToken) return;
    const item = findIndexItem(entry.ref);
    if (!item) {
      pageTitle.textContent = 'Item not found';
      pageBody.innerHTML = `<p>No item named "${escapeHtml(entry.ref)}" is in the Index.</p>`;
      return;
    }
    let current = item.variants[entry.variant] ? entry.variant : item.variantList[0];
    pageTitle.textContent = item.name;
    if (navStack[navStack.length - 1]?.key === 'index') indexReturnKey = item.key;
    const render = () => {
      // Remember the variant on the history entry, so Back from a page
      // opened here returns to the same variant.
      entry.variant = current;
      pageBody.innerHTML = itemPageHtml(item, current);
      wirePageLinks();
    };
    render();
    finishRender(token, entry, scrollY);
    pageBody.onclick = (event) => {
      // Effect/material tags: hover shows the tip on desktop; a click
      // (the only option on touch) pins it open until clicked again.
      const tag = event.target.closest('.wiki-modifier-tag');
      if (tag) {
        const open = !tag.classList.contains('is-open');
        pageBody.querySelectorAll('.wiki-modifier-tag.is-open').forEach((el) => {
          el.classList.remove('is-open');
          el.setAttribute('aria-expanded', 'false');
        });
        tag.classList.toggle('is-open', open);
        tag.setAttribute('aria-expanded', String(open));
        return;
      }
      const pick = event.target.closest('[data-index-variant]');
      if (!pick || pick.dataset.indexVariant === current) return;
      current = pick.dataset.indexVariant;
      render();
    };
    // Scanner pages: the "Your ore size" box updates just its result tiles
    // (re-rendering the whole page would steal focus from the input).
    pageBody.oninput = (event) => {
      const input = event.target.closest?.('[data-scanner-ore-size]');
      if (!input) return;
      scannerOreSize = Number(input.value);
      const geometry = globalThis.TycoonScanners?.geometry?.[item.name];
      const result = pageBody.querySelector('.wiki-scanner-result');
      if (geometry && result) result.innerHTML = scannerCalcResultHtml(item, item.variants[current], geometry);
    };
    pageBody.onkeydown = (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (!event.target.closest?.('.wiki-index-variant-row')) return;
      const i = item.variantList.indexOf(current);
      current = item.variantList[(i + (event.key === 'ArrowRight' ? 1 : -1) + item.variantList.length) % item.variantList.length];
      render();
      pageBody.querySelector('.wiki-index-variant-chip.is-active')?.focus();
      event.preventDefault();
    };
  }

  // ---- Wiki links (item / potion / decoration chips on any page) ------------
  let decorationNames = new Set();
  let conveyorNames = new Set();
  // Rebirth data spells it "Reciever" — match conveyors spelling-insensitively.
  const normalizeConveyorName = (name) => String(name).trim().toLowerCase().replace(/reciever/g, 'receiver');
  async function loadLinkTargets() {
    const [, decorations, worksheet] = await Promise.all([ensureIndexItems(), loadDecorationData(), loadGeometryWorksheet()]);
    decorationNames = new Set(decorations.map((d) => String(d.name).trim().toLowerCase()));
    conveyorNames = new Set(Object.values(worksheet?.conveyors ?? {}).map((c) => normalizeConveyorName(c.name)));
  }

  // Where a chip should go, or null if it has nowhere to go:
  // - an Index item → its item page (Base)
  // - a decoration → its row on the Decoration page
  // - a potion → its tier's row on the Brewer page (Unbox Slot Potion,
  //   which has no tiers, → the Brewer intro that covers it)
  function resolveWikiLink(kind, ref, tier) {
    const name = String(ref ?? '').trim();
    const lower = name.toLowerCase();
    if (kind === 'item') {
      const item = findIndexItem(name);
      if (item) return { kind: 'item', ref: item.key, variant: 'Base' };
    }
    if ((kind === 'item' || kind === 'decoration') && decorationNames.has(lower)) {
      return { kind: 'page', key: 'decoration', anchor: `decoration:${lower}` };
    }
    if (kind === 'item' && conveyorNames.has(normalizeConveyorName(name))) {
      return { kind: 'page', key: 'conveyor', anchor: `conveyor:${normalizeConveyorName(name)}` };
    }
    if (kind === 'potion' || /potions?$/i.test(name)) {
      if (/(unbox|roll)\s*slot/i.test(name)) return { kind: 'page', key: 'brewer', anchor: 'potion:unbox slot' };
      const potionTier = tier ?? name.match(/tier\s*(\d)/i)?.[1];
      return { kind: 'page', key: 'brewer', anchor: potionTier ? `potion-tier:${potionTier}` : null };
    }
    return null;
  }

  // Runs after every page render: turns each [data-wiki-link] chip that
  // resolves somewhere into a clickable link. A chip that would just link
  // to the page it's already on (a decoration on the Decoration page) is
  // left alone.
  async function activateWikiLinks(token) {
    const chips = [...pageBody.querySelectorAll('[data-wiki-link]')];
    if (!chips.length) return;
    await loadLinkTargets();
    if (token !== pageToken) return;
    for (const chip of chips) {
      const target = resolveWikiLink(chip.dataset.wikiLink, chip.dataset.wikiRef, chip.dataset.wikiTier);
      if (!target) continue;
      if (target.kind === 'page' && navCurrent?.kind === 'page' && target.key === navCurrent.key) continue;
      chip.classList.add('is-wiki-link');
      chip.tabIndex = 0;
      chip.setAttribute('role', 'link');
      chip.title = target.kind === 'item'
        ? `Open ${findIndexItem(target.ref).name}'s page`
        : `Go to the ${PAGES[target.key].title} page`;
    }
  }

  function followWikiLink(chip) {
    const target = resolveWikiLink(chip.dataset.wikiLink, chip.dataset.wikiRef, chip.dataset.wikiTier);
    if (target) navigate(target);
  }
  pageBody.addEventListener('click', (event) => {
    const chip = event.target.closest('.is-wiki-link');
    if (!chip) return;
    event.preventDefault();
    followWikiLink(chip);
  });
  pageBody.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const chip = event.target.closest?.('.is-wiki-link');
    if (!chip) return;
    event.preventDefault();
    followWikiLink(chip);
  });

  function scrollToAnchor(anchor) {
    const el = anchor && pageBody.querySelector(`[data-wiki-anchor="${CSS.escape(anchor)}"]`);
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.classList.remove('wiki-anchor-flash');
    void el.offsetWidth; // restart the highlight animation
    el.classList.add('wiki-anchor-flash');
    return true;
  }

  // After a page/item renders: restore the scroll position (Back), else
  // jump to the linked row (anchor), else start at the top.
  function finishRender(token, entry, scrollY) {
    if (scrollY != null) window.scrollTo(0, scrollY);
    else if (!scrollToAnchor(entry.anchor)) window.scrollTo(0, 0);
    activateWikiLinks(token);
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
      body: renderIndexPage,
      after: wireIndexPage,
    },
    rebirth: {
      title: 'Rebirth',
      body: renderRebirthPage,
    },
    merchant: {
      title: 'Merchant',
      body: renderMerchantPage,
    },
    achievements: {
      title: 'Achievements',
      body: renderAchievementsPage,
    },
    mastery: {
      title: 'Mastery',
      body: renderMasteryPage,
      after: wirePageLinks,
    },
    events: {
      title: 'Events',
      body: renderEventsPage,
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
  };

  // ---- Navigation history ------------------------------------------------------
  // Every page view is an entry: { kind: 'page', key, anchor? } or
  // { kind: 'item', ref, variant }. Following a link pushes the current
  // entry (with its scroll position) onto navStack; Back pops it and puts
  // the player back exactly where they were. The home page clears it.
  // pageToken is bumped on every render, so a slow fetch for a page the
  // player already left never overwrites the page they're on now.
  let pageToken = 0;
  let navCurrent = null;
  const navStack = [];

  function navEntryLabel(entry) {
    if (entry.kind === 'item') return findIndexItem(entry.ref)?.name ?? 'the item';
    return PAGES[entry.key]?.title ?? 'the previous page';
  }
  function updateBackButton() {
    const previous = navStack[navStack.length - 1];
    if (backButton) backButton.textContent = previous ? `← Back to ${navEntryLabel(previous)}` : '← Back to Navigate';
  }

  function navigate(entry, { push = true, scrollY = null } = {}) {
    if (entry.kind === 'page' && !PAGES[entry.key]) return;
    if (push && navCurrent) navStack.push({ ...navCurrent, scrollY: window.scrollY });
    navCurrent = entry;
    activeIndexPage?.hidePopover();
    activeIndexPage = null;
    updateBackButton();
    if (entry.kind === 'item') renderItemEntry(entry, scrollY);
    else renderPageEntry(entry, scrollY);
  }

  function renderPageEntry(entry, scrollY) {
    const page = PAGES[entry.key];
    const token = ++pageToken;
    pageBody.onclick = null;
    pageBody.onkeydown = null;
    pageBody.oninput = null;
    pageTitle.textContent = page.title;
    homeView.hidden = true;
    pageView.hidden = false;
    if (typeof page.body === 'function') {
      pageBody.innerHTML = '<p>Loading…</p>';
      Promise.resolve(page.body()).then((html) => {
        if (token !== pageToken) return;
        pageBody.innerHTML = html;
        if (typeof page.after === 'function') page.after();
        finishRender(token, entry, scrollY);
      });
    } else {
      pageBody.innerHTML = page.body;
      finishRender(token, entry, scrollY);
    }
  }

  function openPage(key, anchor = null) {
    navigate({ kind: 'page', key, anchor });
  }
  function openItemPage(ref, variant = 'Base') {
    navigate({ kind: 'item', ref, variant });
  }

  function goHome() {
    pageToken += 1;
    navStack.length = 0;
    navCurrent = null;
    activeIndexPage?.hidePopover();
    activeIndexPage = null;
    pageView.hidden = true;
    homeView.hidden = false;
  }

  navTiles.forEach((tile) => {
    tile.addEventListener('click', () => {
      goHome();
      openPage(tile.dataset.wikiPage);
    });
  });
  backButton?.addEventListener('click', () => {
    const previous = navStack.pop();
    if (!previous) {
      goHome();
      return;
    }
    navigate(previous, { push: false, scrollY: previous.scrollY });
  });

  // Hook for cross-tool navigation (e.g. a Luck Simulator button that opens
  // an item's wiki page): TycoonWiki.openItem('Alien Invasion', 'Mythic'),
  // TycoonWiki.openPage('brewer', 'potion-tier:5'). These only render into
  // the wiki — switching the Tool Menu over to the wiki is the caller's job.
  globalThis.TycoonWiki = {
    openItem: (ref, variant) => openItemPage(ref, variant),
    openPage: (key, anchor) => openPage(key, anchor),
  };

  // ---- Wiki search bar ---------------------------------------------------------
  // One flat list of everything findable, built lazily on first use from the
  // same data files the pages render: pages (with keywords), Index items
  // (searchable by type, rarity, crate, source and effect text too),
  // potions, decorations, conveyors, codes, achievements, P2W products,
  // masteries, events, rebirths and index tiers. Each result navigates like
  // a wiki link, jumping straight to the matching row where there is one.
  const searchInput = document.querySelector('#wiki-search-input');
  const searchResults = document.querySelector('#wiki-search-results');
  const SEARCH_PAGE_KEYWORDS = {
    index: 'items droppers upgraders furnaces item index tiers chat tags collection',
    rebirth: 'rebirths rewards prestige',
    merchant: 'traveling merchant shop stock restock',
    achievements: 'achievements rewards',
    mastery: 'masteries upgrades levels',
    events: 'events event cycle lucky luck',
    'furnace-loot': 'furnace loot drops corium',
    codes: 'codes redeem promo free rewards',
    decoration: 'decorations cosmetic',
    conveyor: 'conveyors teleporters belts',
    enchanter: 'enchant enchanting enchanter shiny mythic variants skip upgrade',
    brewer: 'brewer potions upcraft craft',
    p2w: 'p2w robux gamepasses dev products premium shop',
    updates: 'wiki tools update log changelog',
    'game-updates': 'game update log patch notes changelog',
  };
  const SEARCH_KIND_ORDER = ['Page', 'Item', 'Potion'];
  const POTION_TYPES = ['Luck', 'Shiny Luck', 'Mythic Luck', 'Roll Speed'];

  let searchIndexPromise = null;
  function buildSearchIndex() {
    if (searchIndexPromise) return searchIndexPromise;
    searchIndexPromise = (async () => {
      const [, codes, achievements, products, masteries, events, rebirths, decorations, worksheet, tiers] = await Promise.all([
        ensureIndexItems(), loadCodesData(), loadAchievementsData(), loadP2wData(), loadMasteryData(),
        loadEventsData(), loadRebirthData(), loadDecorationData(), loadGeometryWorksheet(), loadIndexTierData(),
      ]);
      const entries = [];
      const add = (kind, label, sub, extra, target, icon = null) => {
        if (!label) return;
        entries.push({ kind, label: String(label), sub: sub ?? '', icon, target, hay: `${label} ${sub ?? ''} ${extra ?? ''} ${kind}`.toLowerCase() });
      };
      const page = (key, kind, name) => ({ kind: 'page', key, anchor: `${kind}:${String(name).trim().toLowerCase()}` });

      for (const [key, pageDef] of Object.entries(PAGES)) add('Page', pageDef.title, 'Wiki page', SEARCH_PAGE_KEYWORDS[key], { kind: 'page', key });
      for (const item of indexItems) {
        if (item.hidden) {
          add('Item', item.name, `${item.rarity} ${HIDDEN_TEXT}`, item.variantList.join(' '), { kind: 'item', ref: item.key, variant: 'Base' }, indexIconSrc(item.name, item.variantList[0]));
          continue;
        }
        const effects = item.variantList.map((v) => `${item.variants[v].effect} ${item.variants[v].source ?? ''}`).join(' ');
        add('Item', item.name, `${item.rarity} ${INDEX_TYPES[item.type]}${item.crate ? ` · ${indexSourceLabel(item.crate)}` : ''}`,
          `${item.variantList.join(' ')} ${item.tags.join(' ')} ${item.statType ?? ''} ${effects}`,
          { kind: 'item', ref: item.key, variant: 'Base' }, indexIconSrc(item.name, item.variantList[0]));
      }
      for (let tier = 1; tier <= 6; tier += 1) {
        for (const type of POTION_TYPES) {
          const key = `tier${tier}${normalizePotionKey(`${type} Potion`)}`;
          const iconFile = POTION_ICON_FILES[key] ?? POTION_ICON_FILES[key.replace('mythicluckpotion', 'mythicpotion')];
          add('Potion', `Tier ${tier} ${type} Potion`, 'Brewer', `${type} potions`, { kind: 'page', key: 'brewer', anchor: `potion-tier:${tier}` },
            iconFile ? `icons/items/${encodeURIComponent(iconFile)}` : null);
        }
      }
      add('Potion', 'Unbox Slot Potion', 'Brewer', 'roll slot potions', { kind: 'page', key: 'brewer', anchor: 'potion:unbox slot' },
        `icons/items/${encodeURIComponent(POTION_ICON_FILES.tier1unboxslotpotion)}`);
      for (const deco of decorations) {
        add('Decoration', deco.name, deco.rarity ?? 'Decoration', deco.obtain, page('decoration', 'decoration', deco.name),
          `icons/decoration/${encodeURIComponent(deco.name)}.png`);
      }
      for (const conveyor of Object.values(worksheet?.conveyors ?? {})) {
        const displayName = CONVEYOR_DISPLAY_NAMES[conveyor.name] ?? conveyor.name;
        add('Conveyor', displayName, 'Conveyor', conveyor.name, page('conveyor', 'conveyor', conveyor.name),
          `icons/conveyor/${encodeURIComponent(displayName)}.png`);
      }
      for (const code of codes) {
        add('Code', code.code, code.active ? 'Active code' : 'Expired code', (code.rewards ?? []).join(' '), page('codes', 'code', code.code));
      }
      for (const achievement of achievements) {
        const rewards = (achievement.levels ?? []).flatMap((l) => [l.requirement ?? '', ...(l.rewards ?? [])]).join(' ');
        add('Achievement', achievement.name, achievement.description ?? 'Achievement', rewards, page('achievements', 'achievement', achievement.name));
      }
      for (const product of products) {
        add('P2W', product.name, product.robuxCost != null ? `R$${formatNumber(product.robuxCost)}` : 'P2W', `${(product.gives ?? []).join(' ')} ${product.notes ?? ''} robux`, page('p2w', 'p2w', product.name));
      }
      for (const mastery of masteries) {
        add('Mastery', mastery.name, mastery.description ?? 'Mastery', '', page('mastery', 'mastery', mastery.name));
      }
      for (const event of events.filter((e) => e?.name)) {
        add('Event', event.name, event.effect ?? 'Event', '', page('events', 'event', event.name));
      }
      for (const row of rebirths) {
        add('Rebirth', `Rebirth ${row.rebirth}`, (row.itemRewards ?? []).join(', ') || 'Rebirth rewards',
          `${(row.potionRewards ?? []).join(' ')} ${(row.statRewards ?? []).join(' ')}`, page('rebirth', 'rebirth', row.rebirth));
      }
      for (const tier of tiers) {
        add('Index Tier', tier.name, `[${tier['chat tag']}] · ${tier['Items Required']} items`, (tier.Rewards ?? []).join(' '), page('index', 'tier', tier.name));
      }
      return entries;
    })();
    return searchIndexPromise;
  }

  function searchScore(entry, query, tokens) {
    const name = entry.label.toLowerCase();
    if (name === query) return 100;
    if (name.startsWith(query)) return 80;
    if (name.split(/[^a-z0-9]+/).some((word) => word.startsWith(query))) return 70;
    if (name.includes(query)) return 60;
    if (tokens.every((t) => name.includes(t))) return 50;
    if (tokens.every((t) => entry.hay.includes(t))) return 20;
    return 0;
  }

  function runSearch(entries, rawQuery) {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return [];
    const tokens = query.split(/\s+/);
    const kindRank = (kind) => {
      const i = SEARCH_KIND_ORDER.indexOf(kind);
      return i === -1 ? SEARCH_KIND_ORDER.length : i;
    };
    return entries
      .map((entry) => ({ entry, score: searchScore(entry, query, tokens) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || kindRank(a.entry.kind) - kindRank(b.entry.kind) || a.entry.label.localeCompare(b.entry.label))
      .map((r) => r.entry);
  }

  const SEARCH_LIMIT = 12;
  let searchMatches = [];
  let searchActive = -1;

  function closeSearch() {
    searchResults.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    searchActive = -1;
  }

  function renderSearchResults(total) {
    const shown = searchMatches.slice(0, SEARCH_LIMIT);
    if (!searchInput.value.trim()) {
      closeSearch();
      return;
    }
    searchResults.innerHTML = shown.length
      ? shown.map((entry, i) => `
        <button type="button" class="wiki-search-result${i === searchActive ? ' is-active' : ''}" role="option" aria-selected="${i === searchActive}" data-search-index="${i}">
          ${entry.icon ? `<img class="wiki-search-icon" src="${entry.icon}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="wiki-search-icon"></span>'}
          <span class="wiki-search-text">
            <span class="wiki-search-label">${escapeHtml(entry.label)}</span>
            <span class="wiki-search-sub">${escapeHtml(entry.sub)}</span>
          </span>
          <span class="wiki-search-kind">${escapeHtml(entry.kind)}</span>
        </button>`).join('') + (total > SEARCH_LIMIT ? `<p class="wiki-search-more">${total - SEARCH_LIMIT} more — keep typing to narrow it down</p>` : '')
      : '<p class="wiki-search-more">No matches.</p>';
    searchResults.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
  }

  function goToSearchResult(i) {
    const entry = searchMatches[i];
    if (!entry) return;
    closeSearch();
    searchInput.value = '';
    searchInput.blur();
    navigate(entry.target);
  }

  async function updateSearch() {
    const query = searchInput.value;
    const entries = await buildSearchIndex();
    if (query !== searchInput.value) return; // a newer keystroke already ran
    searchMatches = runSearch(entries, query);
    searchActive = searchMatches.length ? 0 : -1;
    renderSearchResults(searchMatches.length);
  }

  if (searchInput && searchResults) {
    searchInput.addEventListener('input', updateSearch);
    searchInput.addEventListener('focus', () => {
      buildSearchIndex();
      if (searchInput.value.trim()) updateSearch();
    });
    searchInput.addEventListener('keydown', (event) => {
      const count = Math.min(searchMatches.length, SEARCH_LIMIT);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!count) return;
        searchActive = (searchActive + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
        renderSearchResults(searchMatches.length);
        searchResults.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
        event.preventDefault();
      } else if (event.key === 'Enter') {
        if (searchActive >= 0) goToSearchResult(searchActive);
        event.preventDefault();
      } else if (event.key === 'Escape') {
        closeSearch();
      }
    });
    // mousedown (not click) so the input's blur doesn't close the list
    // before the click lands.
    searchResults.addEventListener('mousedown', (event) => {
      const result = event.target.closest('[data-search-index]');
      event.preventDefault();
      if (result) goToSearchResult(Number(result.dataset.searchIndex));
    });
    searchInput.addEventListener('blur', () => setTimeout(closeSearch, 120));
  }

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
