// Luck / Crate Simulator — a third standalone mini-tool alongside Base Builder
// and Capgrader Generator. Plain script (no ES modules), reads
// globalThis.CrateLuckData (built by scripts/build-crate-luck-data.mjs from the
// real "Crates" sheet), same self-contained-IIFE pattern as
// capgrader-generator.js. The unbox-odds math is a direct port of the real
// game's Lua UnboxUtils.GetLuckWeights (user-supplied), and the variant
// (Shiny/Mythic) combination math was verified byte-for-byte against the
// reference spreadsheet's own computed "Odds" column for every item in the
// Basic Crate before this file was written — see AI_HANDOFF.md for the
// verification notes if this ever needs re-deriving.

(function () {
  const data = globalThis.CrateLuckData;
  if (!data) return;

  const RARITY_COLORS = {
    Common: '#8a97a0',
    Uncommon: '#4caf6b',
    Rare: '#3f8ee0',
    Epic: '#9b59f2',
    Legendary: '#f0a93a',
    Secret: '#e0483f',
  };
  const VARIANTS = ['Base', 'Shiny', 'Mythic', 'Shiny Mythic'];
  const FIXED_ROLL_WAIT_SECONDS = 1.1; // hardcoded game constant, not player-adjustable
  const MIN_CHANCE_RATIO = 0.3;

  // ---- Formatting -----------------------------------------------------------

  function compactOdds(value) {
    if (!Number.isFinite(value)) return '—';
    const units = [[1e30, 'No'], [1e27, 'Oc'], [1e24, 'Sp'], [1e21, 'Sx'], [1e18, 'Qn'], [1e15, 'Qd'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    const [divisor, suffix] = units.find(([minimum]) => value >= minimum) ?? [1, ''];
    return `${Math.round((value / divisor) * 100) / 100}${suffix}`;
  }

  function formatDuration(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';
    let remaining = Math.round(totalSeconds);
    const days = Math.floor(remaining / 86400); remaining -= days * 86400;
    const hours = Math.floor(remaining / 3600); remaining -= hours * 3600;
    const minutes = Math.floor(remaining / 60); remaining -= minutes * 60;
    const seconds = remaining;
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (days || hours) parts.push(`${hours}h`);
    if (days || hours || minutes) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
  }

  // ---- Unbox Luck: direct port of UnboxUtils.GetLuckWeights -----------------
  // items: [{ id, weight }] with weight normalized so the crate's weights sum
  // to 1. Returns { [id]: finalChance }.
  function getLuckWeights(items, luckInput) {
    const luck = Math.max(1, luckInput);
    const sorted = [...items].sort((a, b) => a.weight - b.weight);
    const groups = [];
    let lastWeight = null;
    for (const item of sorted) {
      const group = groups[groups.length - 1];
      if (group && lastWeight === item.weight) {
        group.ids.push(item.id);
        group.weight += item.weight;
      } else {
        groups.push({ ids: [item.id], weight: item.weight, lowestPossibleChance: 0, rawChance: 0, finalChance: 0, locked: false });
      }
      lastWeight = item.weight;
    }
    for (const group of groups) group.lowestPossibleChance = group.weight * MIN_CHANCE_RATIO;

    let worseOrEqualWeight = 1;
    for (const group of groups) {
      const worseWeight = Math.max(worseOrEqualWeight - group.weight, 0);
      group.rawChance = worseOrEqualWeight ** luck - worseWeight ** luck;
      group.finalChance = group.rawChance;
      worseOrEqualWeight = worseWeight;
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let remainingChance = 1;
      let remainingRawChance = 0;
      for (const group of groups) {
        if (group.locked) remainingChance -= group.lowestPossibleChance;
        else remainingRawChance += group.rawChance;
      }
      if (remainingRawChance <= 0) break;
      const scale = remainingChance / remainingRawChance;
      let lockedNew = false;
      for (const group of groups) {
        if (!group.locked && group.rawChance * scale < group.lowestPossibleChance) {
          group.finalChance = group.lowestPossibleChance;
          group.locked = true;
          lockedNew = true;
        }
      }
      if (!lockedNew) {
        for (const group of groups) if (!group.locked) group.finalChance = group.rawChance * scale;
        break;
      }
    }

    const result = {};
    for (const group of groups) {
      const perId = group.finalChance / group.ids.length;
      for (const id of group.ids) result[id] = perId;
    }
    return result;
  }

  // ---- Variant combination (Shiny/Mythic Luck) -------------------------------
  // baseChance = this item's chance of being picked at all (from getLuckWeights).
  // shinyLuck/mythicLuck are the "1 in X" inputs. Returns the probability of
  // landing on `variant` specifically, or null if the item doesn't have that
  // variant at all.
  function variantChance(baseChance, variant, hasShiny, hasMythic, shinyLuck, mythicLuck) {
    if (variant === 'Shiny' && !hasShiny) return null;
    if ((variant === 'Mythic' || variant === 'Shiny Mythic') && !hasMythic) return null;
    const A = Math.max(1.0001, shinyLuck);
    const B = Math.max(1.0001, mythicLuck);
    if (variant === 'Shiny Mythic') return baseChance * (1 / A) * (1 / B);
    if (variant === 'Mythic') return baseChance * (1 - 1 / A) * (1 / B);
    if (variant === 'Shiny') return baseChance * (1 / A) * (hasMythic ? (1 - 1 / B) : 1);
    // Base
    return baseChance * (1 - 1 / A) * (hasMythic ? (1 - 1 / B) : 1);
  }

  // ---- "How long" (item detail popup) ---------------------------------------
  function timeToConfidence(probability, confidence, rollSpeedSeconds, unboxSlots) {
    if (!Number.isFinite(probability) || probability <= 0) return Infinity;
    const cycleTime = Math.max(0.0001, rollSpeedSeconds) + FIXED_ROLL_WAIT_SECONDS;
    const attemptsPerSecond = Math.max(0.0001, unboxSlots) / cycleTime;
    const attemptsNeeded = Math.log(1 - confidence) / Math.log(1 - probability);
    return attemptsNeeded / attemptsPerSecond;
  }

  // ---- State / persistence ---------------------------------------------------

  const STORAGE_KEY = 'tycoon-sim-2:luck-tool:v1';
  const state = {
    unboxLuck: 1,
    shinyLuck: 20,
    mythicLuck: 100,
    rollSpeed: 0.7,
    unboxSlots: 1,
    anyCrateOwned: {},
    currentCrate: null,
    currentVariant: 'Base',
  };

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        unboxLuck: state.unboxLuck,
        shinyLuck: state.shinyLuck,
        mythicLuck: state.mythicLuck,
        rollSpeed: state.rollSpeed,
        unboxSlots: state.unboxSlots,
        anyCrateOwned: state.anyCrateOwned,
      }));
    } catch {
      // Storage unavailable (private browsing, quota) — non-fatal, just won't persist.
    }
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return;
      if (Number.isFinite(saved.unboxLuck)) state.unboxLuck = saved.unboxLuck;
      if (Number.isFinite(saved.shinyLuck)) state.shinyLuck = saved.shinyLuck;
      if (Number.isFinite(saved.mythicLuck)) state.mythicLuck = saved.mythicLuck;
      if (Number.isFinite(saved.rollSpeed)) state.rollSpeed = saved.rollSpeed;
      if (Number.isFinite(saved.unboxSlots)) state.unboxSlots = saved.unboxSlots;
      if (saved.anyCrateOwned && typeof saved.anyCrateOwned === 'object') state.anyCrateOwned = saved.anyCrateOwned;
    } catch {
      // Corrupt/missing saved state — start fresh.
    }
  }

  // ---- DOM references ---------------------------------------------------------

  const unboxLuckInput = document.querySelector('#luck-unbox-luck');
  const shinyLuckInput = document.querySelector('#luck-shiny-luck');
  const mythicLuckInput = document.querySelector('#luck-mythic-luck');
  const rollSpeedInput = document.querySelector('#luck-roll-speed');
  const unboxSlotsInput = document.querySelector('#luck-unbox-slots');
  const anyCrateListEl = document.querySelector('#luck-anycrate-list');
  const crateGridEl = document.querySelector('#luck-crate-grid');
  const selectViewEl = document.querySelector('#luck-select-view');
  const detailViewEl = document.querySelector('#luck-detail-view');
  const detailCrateNameEl = document.querySelector('#luck-detail-crate-name');
  const backButton = document.querySelector('#luck-back-button');
  const itemGridEl = document.querySelector('#luck-item-grid');
  const variantButtons = [...document.querySelectorAll('[data-luck-variant]')];
  const itemDialog = document.querySelector('#luck-item-dialog');
  const itemDialogTitle = document.querySelector('#luck-item-dialog-title');
  const itemDialogRarity = document.querySelector('#luck-item-dialog-rarity');
  const itemDialogBody = document.querySelector('#luck-item-dialog-body');

  // ---- Crate icon (custom-drawn, not the user's real crate art) -------------

  function crateIconSvg(index) {
    const hue = (index * 47) % 360;
    const lid = `hsl(${hue}, 38%, 46%)`;
    const body = `hsl(${hue}, 30%, 34%)`;
    const band = `hsl(${hue}, 45%, 62%)`;
    return `
      <svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true">
        <rect x="6" y="24" width="52" height="32" rx="3" fill="${body}" stroke="#0006" stroke-width="1.5" />
        <rect x="4" y="14" width="56" height="14" rx="3" fill="${lid}" stroke="#0006" stroke-width="1.5" />
        <rect x="28" y="14" width="8" height="42" fill="${band}" opacity="0.85" />
        <rect x="6" y="38" width="52" height="6" fill="${band}" opacity="0.6" />
      </svg>
    `;
  }

  // ---- Item icon resolution ---------------------------------------------------

  function iconPathFor(name, variant) {
    const suffix = variant === 'Base' ? '' : ` ${variant}`;
    return `icons/items/${encodeURIComponent(`${name}${suffix}`)}.png`;
  }

  function itemIconHtml(name, variant) {
    const src = iconPathFor(name, variant);
    return `<img src="${src}" alt="" class="luck-item-icon" loading="lazy" onerror="this.style.display='none'" />`;
  }

  // ---- Pool building: this crate's items + toggled-on any-crate items -------

  function poolForCrate(crateName) {
    const crate = data.crates.find((c) => c.name === crateName);
    if (!crate) return [];
    const names = new Set(crate.items);
    for (const [name, owned] of Object.entries(state.anyCrateOwned)) {
      if (owned && data.items[name]) names.add(name);
    }
    return [...names].filter((name) => data.items[name]?.variants?.Base?.weight != null);
  }

  // An any-crate item's stored Weight (e.g. Freedom Dropper's 9.667e-7) was
  // itself back-solved from a fixed target raw chance (1/150,000,000),
  // calibrated once against Basic Crate's own total at 1x Unbox Luck — that's
  // where the "1/150M" figure comes from, and why it should never look
  // *worse* than that at 1x luck specifically. Reusing that stored weight
  // unchanged in a different crate's much bigger (or smaller) total would
  // distort that calibration, so instead this recovers the item's fixed
  // target chance once (`targetRawChance`) and re-derives an equivalent
  // weight fresh for whichever crate is actually open, the same way the
  // sheet's own `J15 = K15 * SUM(otherCrateWeights) / (1 - ...)` formula
  // converts a target chance into a weight for a specific pool. The result:
  // at 1x Unbox Luck the item is always exactly 1/150M in every crate (by
  // construction), but at any other luck its real odds legitimately vary
  // crate to crate, since luck reshuffles chances based on an item's rank
  // within whichever crate's own rarity ladder it's merged into.
  function targetRawChance(name) {
    const basicCrate = data.crates.find((c) => c.name === 'Basic');
    const basicTotal = basicCrate.items.reduce((sum, n) => sum + data.items[n].variants.Base.weight, 0);
    const weight = data.items[name].variants.Base.weight;
    return weight / (basicTotal + weight);
  }

  function computeChances(crateName) {
    const crate = data.crates.find((c) => c.name === crateName);
    if (!crate) return {};
    const anyCrateNames = Object.entries(data.items).filter(([, item]) => item.anyCrate).map(([name]) => name);
    const activeAnyNames = anyCrateNames.filter((name) => state.anyCrateOwned[name]);
    const nativeNames = crate.items.filter((name) => data.items[name]?.variants?.Base?.weight != null);
    const nativeTotalWeight = nativeNames.reduce((sum, name) => sum + data.items[name].variants.Base.weight, 0);

    const sumOtherActiveTargets = activeAnyNames.reduce((sum, name) => sum + targetRawChance(name), 0);
    const derivedWeight = {};
    for (const name of activeAnyNames) {
      derivedWeight[name] = (targetRawChance(name) * nativeTotalWeight) / Math.max(1e-15, 1 - sumOtherActiveTargets);
    }

    const pool = [...nativeNames, ...activeAnyNames];
    const totalWeight = nativeTotalWeight + activeAnyNames.reduce((sum, name) => sum + derivedWeight[name], 0);
    if (!(totalWeight > 0)) return {};
    const weighted = pool.map((name) => ({
      id: name,
      weight: (data.items[name].anyCrate ? derivedWeight[name] : data.items[name].variants.Base.weight) / totalWeight,
    }));
    return getLuckWeights(weighted, state.unboxLuck);
  }

  // ---- Rendering: stats panel -------------------------------------------------

  function syncStatsInputs() {
    unboxLuckInput.value = state.unboxLuck;
    shinyLuckInput.value = state.shinyLuck;
    mythicLuckInput.value = state.mythicLuck;
    rollSpeedInput.value = state.rollSpeed;
    unboxSlotsInput.value = state.unboxSlots;
  }

  function onStatInput() {
    state.unboxLuck = Number(unboxLuckInput.value) || 1;
    state.shinyLuck = Number(shinyLuckInput.value) || 1;
    state.mythicLuck = Number(mythicLuckInput.value) || 1;
    state.rollSpeed = Math.max(0, Number(rollSpeedInput.value) || 0);
    state.unboxSlots = Math.max(1, Number(unboxSlotsInput.value) || 1);
    persist();
    if (state.currentCrate) renderCrateDetail(state.currentCrate);
  }
  [unboxLuckInput, shinyLuckInput, mythicLuckInput, rollSpeedInput, unboxSlotsInput].forEach((input) => {
    input?.addEventListener('input', onStatInput);
  });

  // ---- Rendering: any-crate toggle list ---------------------------------------

  function renderAnyCrateList() {
    if (!anyCrateListEl) return;
    const anyCrateNames = Object.entries(data.items).filter(([, item]) => item.anyCrate).map(([name]) => name);
    anyCrateListEl.innerHTML = anyCrateNames.map((name) => `
      <div class="luck-anycrate-item" data-anycrate-item="${name}">
        <span>${name}</span>
        <button type="button" class="capgrader-toggle-pill" data-anycrate-toggle="${name}" aria-pressed="${Boolean(state.anyCrateOwned[name])}">
          ${state.anyCrateOwned[name] ? 'On' : 'Off'}
        </button>
      </div>
    `).join('');
    anyCrateListEl.querySelectorAll('[data-anycrate-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const name = button.dataset.anycrateToggle;
        state.anyCrateOwned[name] = !state.anyCrateOwned[name];
        button.setAttribute('aria-pressed', String(state.anyCrateOwned[name]));
        button.textContent = state.anyCrateOwned[name] ? 'On' : 'Off';
        persist();
        if (state.currentCrate) renderCrateDetail(state.currentCrate);
      });
    });
  }

  // ---- Rendering: crate select grid -------------------------------------------

  function renderCrateGrid() {
    if (!crateGridEl) return;
    crateGridEl.innerHTML = data.crates.map((crate, index) => `
      <button type="button" class="luck-crate-button" data-crate-name="${crate.name}">
        ${crateIconSvg(index)}
        <strong>${crate.name} Crate</strong>
        <span>Cost: ${crate.cost ?? 'N/A'}</span>
      </button>
    `).join('');
    crateGridEl.querySelectorAll('[data-crate-name]').forEach((button) => {
      button.addEventListener('click', () => openCrate(button.dataset.crateName));
    });
  }

  function openCrate(crateName) {
    state.currentCrate = crateName;
    state.currentVariant = 'Base';
    variantButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.luckVariant === 'Base')));
    selectViewEl.hidden = true;
    detailViewEl.hidden = false;
    renderCrateDetail(crateName);
  }

  backButton?.addEventListener('click', () => {
    state.currentCrate = null;
    detailViewEl.hidden = true;
    selectViewEl.hidden = false;
  });

  variantButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.currentVariant = button.dataset.luckVariant;
      variantButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      if (state.currentCrate) renderCrateDetail(state.currentCrate);
    });
  });

  // ---- Rendering: crate detail grid -------------------------------------------

  function renderCrateDetail(crateName) {
    detailCrateNameEl.textContent = `${crateName} Crate`;
    const chances = computeChances(crateName);
    const pool = poolForCrate(crateName);
    const variant = state.currentVariant;
    const cells = pool
      .map((name) => {
        const item = data.items[name];
        const hasShiny = Boolean(item.variants.Shiny);
        const hasMythic = Boolean(item.variants.Mythic);
        const p = variantChance(chances[name] ?? 0, variant, hasShiny, hasMythic, state.shinyLuck, state.mythicLuck);
        if (p == null) return null;
        return { name, item, probability: p };
      })
      .filter(Boolean)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 9);

    itemGridEl.innerHTML = cells.map(({ name, item, probability }) => {
      const color = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.Common;
      return `
        <button type="button" class="luck-item-cell" style="--rarity-color: ${color}" data-luck-item="${name}">
          ${itemIconHtml(name, variant)}
          <span class="luck-item-name">${name}</span>
          <span class="luck-item-odds">1/${compactOdds(1 / probability)}</span>
        </button>
      `;
    }).join('') || '<p class="capgrader-empty-note">No items have this variant in this crate — try Base or Shiny, or toggle on more any-crate items.</p>';

    itemGridEl.querySelectorAll('[data-luck-item]').forEach((cellButton) => {
      cellButton.addEventListener('click', () => {
        const name = cellButton.dataset.luckItem;
        const found = cells.find((c) => c.name === name);
        if (found) openItemDialog(found.name, found.item, variant, found.probability);
      });
    });
  }

  // ---- Item detail dialog -----------------------------------------------------

  function openItemDialog(name, item, variant, probability) {
    itemDialogTitle.textContent = `${name} — ${variant}`;
    itemDialogRarity.textContent = item.rarity ?? 'Unknown rarity';
    const variantData = item.variants[variant] ?? {};
    const timings = [0.5, 0.75, 0.9].map((confidence) => {
      const seconds = timeToConfidence(probability, confidence, state.rollSpeed, state.unboxSlots);
      return `<div class="luck-time-row"><span>${Math.round(confidence * 100)}% chance by</span><strong>${formatDuration(seconds)}</strong></div>`;
    }).join('');
    itemDialogBody.innerHTML = `
      <p class="luck-item-odds-line">Odds: <strong>1/${compactOdds(1 / probability)}</strong></p>
      ${variantData.mainStat != null ? `<p class="capgrader-panel-note">Main stat: ${variantData.mainStat}${variantData.mainStatType ? ` (${variantData.mainStatType})` : ''}</p>` : ''}
      ${variantData.otherStats && variantData.otherStats !== 'N/A' ? `<p class="capgrader-panel-note">${variantData.otherStats.replaceAll('\n', '<br />')}</p>` : ''}
      ${variantData.effects && variantData.effects !== 'N/A' ? `<p class="capgrader-panel-note">${variantData.effects}</p>` : ''}
      <div class="luck-time-list">
        <p class="panel-label">How long to roll it</p>
        ${timings}
      </div>
    `;
    itemDialog.showModal();
  }

  itemDialog?.querySelectorAll('[data-luck-item-action="close"]').forEach((button) => {
    button.addEventListener('click', () => itemDialog.close());
  });
  itemDialog?.addEventListener('click', (event) => {
    if (event.target === itemDialog) itemDialog.close();
  });

  // ---- Init --------------------------------------------------------------------

  let initialized = false;
  function initLuckTool() {
    if (initialized) return;
    initialized = true;
    restore();
    syncStatsInputs();
    renderAnyCrateList();
    renderCrateGrid();
  }
  document.addEventListener('luck-tool:activated', initLuckTool);
  if (!document.querySelector('#luck-tool')?.hidden) initLuckTool();
})();
