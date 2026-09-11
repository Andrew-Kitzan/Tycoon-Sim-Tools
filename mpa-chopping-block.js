// MPA / Chopping Block — fifth standalone mini-tool, same self-contained-IIFE
// pattern as capgrader-generator.js / luck-crate-generator.js / abbrev-calculator.js.
// Reads globalThis.MpuStatsData (data/mpu-stats.js, a one-time hand-maintained
// seed from the spreadsheet's MPU sheet — NOT auto-regenerated, see that
// file's own header comment) and globalThis.TycoonDatabase (data/items.generated.js)
// for full item stats/descriptions. WORK IN PROGRESS — see
// .claude/plans/mpa-chopping-block-plan.md for the full design and open
// questions, and .claude/agents/AI_HANDOFF.md for build notes.
//
// Three views inside one tool section:
//   1. MPU/MPA/MPS browsing list (#mpa-list-view) — every tracked upgrader,
//      sorted ascending by whichever stat is toggled.
//   2. Chopping Block ownership toggle (#mpa-select-view) — every tracked
//      upgrader, grouped into Crate / Merchant-Achievement-Rebirth / P2W /
//      Other categories and subcategories, with select-all/deselect-all.
//   3. Chopping Block keep/chop decisions (#mpa-decision-view) — worst-MPA
//      first, respecting combo/dependency locks and per-item configuration
//      checks (e.g. Dragon's Breath looped vs. separate).

(function () {
  const data = globalThis.MpuStatsData;
  const db = globalThis.TycoonDatabase;
  if (!data || !db) return;

  const STORAGE_KEY = 'tycoon-sim-2:mpa-tool:v1';

  const CATEGORY_LABELS = {
    crate: 'Crate Upgraders',
    'merchant-achievement-rebirth': 'Merchant / Achievement / Rebirth Upgraders',
    p2w: 'P2W Upgraders',
    other: 'Other Upgraders',
  };
  const CRATE_ORDER = ['Basic', 'Advanced', 'Factory', 'Quarry', 'Futuristic', 'Toxic', 'Desert', 'Fantasy', 'Space', 'Periastron', 'Candy', 'Ancient', 'Alien', 'Tropic', 'Ocean', 'Trinket', 'Toy', 'Floral', 'Nature'];
  const MAR_ORDER = ['Merchant', 'Achievement', 'Rebirth', 'Codes'];
  const CATEGORY_ORDER = ['crate', 'merchant-achievement-rebirth', 'p2w', 'other'];

  const choppableItems = data.items.filter((item) => item.kind !== 'comboInfoOnly');
  const itemsByName = new Map(data.items.map((item) => [item.name, item]));

  // ---- persistence ------------------------------------------------------

  function browserStorage() {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  function defaultState() {
    return { activeStat: 'mpa', owned: {}, inputs: {} };
  }

  function loadState() {
    const storage = browserStorage();
    if (!storage) return defaultState();
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        activeStat: ['mpu', 'mpa', 'mps'].includes(parsed.activeStat) ? parsed.activeStat : 'mpa',
        owned: parsed.owned && typeof parsed.owned === 'object' ? parsed.owned : {},
        inputs: parsed.inputs && typeof parsed.inputs === 'object' ? parsed.inputs : {},
      };
    } catch {
      return defaultState();
    }
  }

  const state = loadState();
  // Transient, in-memory only — which items the player chose "Keep" on
  // during the current Chopping Block run. Resets every time the run
  // button is pressed, so a kept item is naturally re-suggested on the
  // next run (it's still the worst MPA among what's owned).
  let keptThisRun = new Set();

  function saveState() {
    const storage = browserStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Best-effort only.
    }
  }

  // ---- icon / formatting helpers -----------------------------------------

  function iconPathFor(name, variant) {
    const suffix = !variant || variant === 'Base' ? '' : ` ${variant}`;
    return `icons/items/${encodeURIComponent(`${name}${suffix}`)}.png`;
  }

  function itemIconHtml(name, variant, className) {
    const src = iconPathFor(name, variant);
    return `<img src="${src}" alt="" class="${className}" loading="lazy" onerror="this.style.display='none'" />`;
  }

  function formatStat(value) {
    if (!Number.isFinite(value)) return '—';
    return value.toFixed(3);
  }

  function findRecord(name, variant) {
    const records = db.records ?? [];
    return records.find((r) => r.name === name && r.variant === variant)
      ?? records.find((r) => r.name === name);
  }

  // ---- resolving a single reference value per item, for the browsing list ---
  // (Chopping Block computes its own live values from state.inputs instead —
  // see currentStatsFor below.)

  function formulaMultiForEffects(item, effects) {
    return 1 + effects * item.perEffectBonus;
  }

  function derivedFromMulti(multi, area, length, conveyorSpeed) {
    const mpu = length ? multi ** (1 / length) : null;
    const mpa = area ? multi ** (1 / area) : null;
    let mps = null;
    if (length && conveyorSpeed) {
      const time = (length * 3000) / conveyorSpeed / 1000;
      mps = time ? multi ** (1 / time) : null;
    }
    return { mpu, mpa, mps };
  }

  function referenceStatFor(item, stat) {
    if (item.kind === 'straight' || item.kind === 'comboInfoOnly') {
      return { value: item[stat], note: item.notes ?? null };
    }
    if (item.kind === 'scalesWithUses') {
      const best = item.uses.find((u) => u.uses === item.bestUses);
      if (!best) return { value: null, note: null };
      let note = `at ${item.bestUses} use${item.bestUses === 1 ? '' : 's'}`;
      if (item.name === 'Lambda Upgrader') {
        const three = item.uses.find((u) => u.uses === 3);
        if (three) note += ` — at 3 Lambdas: ${stat.toUpperCase()} ${formatStat(three[stat])}`;
      }
      return { value: best[stat], note };
    }
    if (item.kind === 'scalesWithEffects') {
      const tabulated = item.tabulated.find((t) => t.effects === item.maxEffects);
      if (tabulated) return { value: tabulated[stat], note: `at ${item.maxEffects} effects` };
      const multi = formulaMultiForEffects(item, item.maxEffects);
      const derived = derivedFromMulti(multi, item.area, item.length, item.conveyorSpeed);
      return { value: derived[stat], note: `at ${item.maxEffects} effects` };
    }
    if (item.kind === 'scalesWithConfiguration') {
      const best = item.configs.find((c) => c.id === item.bestConfig);
      if (!best) return { value: null, note: null };
      return { value: best[stat], note: best.label };
    }
    return { value: null, note: null };
  }

  // ---- Chopping Block: live stats from the player's own inputs --------------

  function currentStatsFor(name) {
    const item = itemsByName.get(name);
    if (!item) return null;
    const input = state.inputs[name] ?? {};
    if (item.kind === 'straight') {
      return { mpa: item.mpa, mpu: item.mpu, mps: item.mps, contextNote: item.notes ?? null };
    }
    if (item.kind === 'scalesWithUses') {
      const uses = Number.isFinite(input.uses) ? input.uses : item.bestUses;
      const row = item.uses.find((u) => u.uses === uses) ?? item.uses.find((u) => u.uses === item.bestUses);
      return { mpa: row.mpa, mpu: row.mpu, mps: row.mps, contextNote: `${uses} use${uses === 1 ? '' : 's'}`, uses };
    }
    if (item.kind === 'scalesWithEffects') {
      const effects = Number.isFinite(input.effects) ? Math.max(0, input.effects) : item.maxEffects;
      const tabulated = item.tabulated.find((t) => t.effects === effects);
      if (tabulated) return { mpa: tabulated.mpa, mpu: tabulated.mpu, mps: tabulated.mps, contextNote: `${effects} effects` };
      const multi = formulaMultiForEffects(item, effects);
      const derived = derivedFromMulti(multi, item.area, item.length, item.conveyorSpeed);
      return { ...derived, contextNote: `${effects} effects` };
    }
    if (item.kind === 'scalesWithConfiguration') {
      const configId = input.config ?? item.configs[0].id;
      const config = item.configs.find((c) => c.id === configId) ?? item.configs[0];
      return { mpa: config.mpa, mpu: config.mpu, mps: config.mps ?? null, contextNote: config.label, configId };
    }
    return null;
  }

  // ---- dependency locks ------------------------------------------------

  function isLocked(name) {
    for (const dep of data.dependencies) {
      if (!dep.requires.includes(name)) continue;
      if (!state.owned[dep.neededBy]) continue; // dependent isn't owned, no lock
      if (dep.requiresAny) {
        // Locked only while this item is the last one satisfying the
        // requirement — i.e. every other alternative is already gone.
        const othersStillOwned = dep.requires.some((n) => n !== name && state.owned[n]);
        if (!othersStillOwned) return dep;
      } else {
        return dep;
      }
    }
    return null;
  }

  // ---- categorization for the ownership toggle screen -----------------

  function subcategoryOrder(category) {
    if (category === 'crate') return CRATE_ORDER;
    if (category === 'merchant-achievement-rebirth') return MAR_ORDER;
    if (category === 'p2w') return Object.keys(data.packs);
    return ['Other'];
  }

  function groupedForSelection() {
    const groups = new Map();
    for (const category of CATEGORY_ORDER) groups.set(category, new Map());
    for (const item of choppableItems) {
      const bucket = groups.get(item.category);
      if (!bucket) continue;
      if (!bucket.has(item.subcategory)) bucket.set(item.subcategory, []);
      bucket.get(item.subcategory).push(item);
    }
    return groups;
  }

  // ---- DOM refs ----------------------------------------------------------

  const listViewEl = document.querySelector('#mpa-list-view');
  const selectViewEl = document.querySelector('#mpa-select-view');
  const decisionViewEl = document.querySelector('#mpa-decision-view');
  const listRowsEl = document.querySelector('#mpa-list-rows');
  const statToggleButtons = document.querySelectorAll('[data-mpa-stat]');
  const openChopBlockButton = document.querySelector('#mpa-open-chop-block');
  const selectBackButton = document.querySelector('#mpa-select-back');
  const runChopButton = document.querySelector('#mpa-run-chop');
  const categoriesEl = document.querySelector('#mpa-categories');
  const decisionBackButton = document.querySelector('#mpa-decision-back');
  const decisionCardEl = document.querySelector('#mpa-decision-card');
  const decisionEmptyEl = document.querySelector('#mpa-decision-empty');

  function setView(view) {
    if (listViewEl) listViewEl.hidden = view !== 'list';
    if (selectViewEl) selectViewEl.hidden = view !== 'select';
    if (decisionViewEl) decisionViewEl.hidden = view !== 'decision';
  }

  // ---- Browsing list ------------------------------------------------------

  function renderStatToggle() {
    statToggleButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mpaStat === state.activeStat));
    });
  }

  function renderList() {
    const stat = state.activeStat;
    const rows = data.items
      .map((item) => ({ item, ...referenceStatFor(item, stat) }))
      .filter((row) => Number.isFinite(row.value))
      .sort((a, b) => a.value - b.value);

    listRowsEl.innerHTML = rows.map(({ item, value, note }) => `
      <div class="mpa-list-row">
        ${itemIconHtml(item.name, item.variant, 'mpa-list-icon')}
        <div class="mpa-list-name">
          <span>${item.name}</span>
          ${note ? `<small>${note}</small>` : ''}
        </div>
        <strong class="mpa-list-value">${formatStat(value)}</strong>
      </div>
    `).join('');
  }

  // ---- Chopping Block: ownership toggle screen ---------------------------

  function specialInputHtml(item) {
    const input = state.inputs[item.name] ?? {};
    if (item.kind === 'scalesWithUses') {
      const max = item.maxUsesAllowed ?? item.uses[item.uses.length - 1].uses;
      const value = Number.isFinite(input.uses) ? input.uses : item.bestUses;
      return `<label>How many? <input type="number" min="1" max="${max}" step="1" value="${value}" data-mpa-input="uses" /></label>`;
    }
    if (item.kind === 'scalesWithEffects') {
      const value = Number.isFinite(input.effects) ? input.effects : item.maxEffects;
      return `<label>Effects going through <input type="number" min="0" step="1" value="${value}" data-mpa-input="effects" /></label>`;
    }
    if (item.kind === 'scalesWithConfiguration') {
      const value = input.config ?? item.configs[0].id;
      const options = item.configs.map((c) => `<option value="${c.id}" ${c.id === value ? 'selected' : ''}>${c.label}</option>`).join('');
      return `<label>Configuration <select data-mpa-input="config">${options}</select></label>`;
    }
    return '';
  }

  function toggleItemHtml(item) {
    const owned = Boolean(state.owned[item.name]);
    const needsInput = item.kind !== 'straight';
    return `
      <div class="capgrader-toggle-item mpa-toggle-item ${owned ? 'is-owned' : ''}" data-mpa-item="${item.name}">
        ${itemIconHtml(item.name, item.variant, 'mpa-toggle-icon')}
        <span class="capgrader-toggle-name">${item.name}</span>
        <button type="button" class="capgrader-toggle-pill" data-mpa-toggle aria-pressed="${owned}">${owned ? 'In Base' : 'Not in Base'}</button>
        ${needsInput ? `<div class="capgrader-toggle-options">${specialInputHtml(item)}</div>` : ''}
      </div>
    `;
  }

  function renderCategories() {
    const groups = groupedForSelection();
    categoriesEl.innerHTML = CATEGORY_ORDER.map((category) => {
      const bucket = groups.get(category);
      if (!bucket || bucket.size === 0) return '';
      const order = subcategoryOrder(category);
      const subHtml = order
        .filter((sub) => bucket.has(sub))
        .map((sub) => {
          const items = bucket.get(sub);
          return `
            <div class="mpa-subcategory" data-mpa-subcategory>
              <div class="mpa-subcategory-header">
                <h4>${sub}</h4>
                <div class="mpa-subcategory-actions">
                  <button type="button" class="capgrader-bulk-button" data-mpa-select-all>Select all</button>
                  <button type="button" class="capgrader-bulk-button" data-mpa-select-none>Deselect all</button>
                </div>
              </div>
              <div class="capgrader-toggle-list">
                ${items.map(toggleItemHtml).join('')}
              </div>
            </div>
          `;
        }).join('');
      return `
        <div class="mpa-category" data-mpa-category>
          <div class="mpa-category-header">
            <h3>${CATEGORY_LABELS[category]}</h3>
            <div class="mpa-category-actions">
              <button type="button" class="capgrader-bulk-button" data-mpa-category-select-all>Select all</button>
              <button type="button" class="capgrader-bulk-button" data-mpa-category-select-none>Deselect all</button>
            </div>
          </div>
          ${subHtml}
        </div>
      `;
    }).join('');
  }

  categoriesEl?.addEventListener('click', (event) => {
    const toggleButton = event.target.closest('[data-mpa-toggle]');
    if (toggleButton) {
      const row = toggleButton.closest('[data-mpa-item]');
      const name = row?.dataset.mpaItem;
      if (!name) return;
      const nextOwned = !state.owned[name];
      state.owned[name] = nextOwned;
      if (nextOwned && !state.inputs[name]) {
        const item = itemsByName.get(name);
        if (item?.kind === 'scalesWithUses') state.inputs[name] = { uses: item.bestUses };
        else if (item?.kind === 'scalesWithEffects') state.inputs[name] = { effects: item.maxEffects };
        else if (item?.kind === 'scalesWithConfiguration') state.inputs[name] = { config: item.configs[0].id };
      }
      saveState();
      renderCategories();
      return;
    }
    function applyBulkSelection(container, select) {
      const rows = container?.querySelectorAll('[data-mpa-item]') ?? [];
      rows.forEach((row) => {
        const name = row.dataset.mpaItem;
        state.owned[name] = select;
        if (select && !state.inputs[name]) {
          const item = itemsByName.get(name);
          if (item?.kind === 'scalesWithUses') state.inputs[name] = { uses: item.bestUses };
          else if (item?.kind === 'scalesWithEffects') state.inputs[name] = { effects: item.maxEffects };
          else if (item?.kind === 'scalesWithConfiguration') state.inputs[name] = { config: item.configs[0].id };
        }
      });
      saveState();
      renderCategories();
    }

    const subSelectAll = event.target.closest('[data-mpa-select-all]');
    const subSelectNone = event.target.closest('[data-mpa-select-none]');
    if (subSelectAll || subSelectNone) {
      applyBulkSelection(event.target.closest('[data-mpa-subcategory]'), Boolean(subSelectAll));
      return;
    }

    const catSelectAll = event.target.closest('[data-mpa-category-select-all]');
    const catSelectNone = event.target.closest('[data-mpa-category-select-none]');
    if (catSelectAll || catSelectNone) {
      applyBulkSelection(event.target.closest('[data-mpa-category]'), Boolean(catSelectAll));
    }
  });

  categoriesEl?.addEventListener('change', (event) => {
    const field = event.target.closest('[data-mpa-input]');
    if (!field) return;
    const row = field.closest('[data-mpa-item]');
    const name = row?.dataset.mpaItem;
    if (!name) return;
    const item = itemsByName.get(name);
    const kind = field.dataset.mpaInput;
    state.inputs[name] = state.inputs[name] ?? {};
    if (kind === 'uses') {
      const max = item.maxUsesAllowed ?? item.uses[item.uses.length - 1].uses;
      let value = Math.round(Number(field.value));
      if (!Number.isFinite(value) || value < 1) value = 1;
      if (value > max) {
        window.alert?.(`${item.name} isn't realistically used past ${max} — set to ${max}.`);
        value = max;
        field.value = String(max);
      }
      state.inputs[name].uses = value;
    } else if (kind === 'effects') {
      let value = Math.round(Number(field.value));
      if (!Number.isFinite(value) || value < 0) value = 0;
      state.inputs[name].effects = value;
    } else if (kind === 'config') {
      state.inputs[name].config = field.value;
    }
    saveState();
  });

  // ---- Chopping Block: decision loop --------------------------------------

  function ownedEligibleSorted() {
    return choppableItems
      .filter((item) => state.owned[item.name] && !keptThisRun.has(item.name) && !isLocked(item.name))
      .map((item) => ({ item, stats: currentStatsFor(item.name) }))
      .filter((row) => Number.isFinite(row.stats?.mpa))
      .sort((a, b) => a.stats.mpa - b.stats.mpa);
  }

  function describeChopEffect(item, stats) {
    if (item.kind === 'scalesWithUses' && item.name !== 'Lambda Upgrader') {
      return `Chopping this removes all ${stats.uses} from your base.`;
    }
    if (item.name === 'Lambda Upgrader') {
      const remaining = stats.uses - 1;
      return remaining > 0
        ? `Chopping this removes 1 Lambda — ${remaining} will remain.`
        : 'Chopping this removes your last Lambda.';
    }
    return null;
  }

  function statBlockHtml(record) {
    if (!record) return '';
    const lines = [];
    if (record.mainStat != null) lines.push(`Main stat: ${record.mainStat}${record.mainStatType ? ` (${record.mainStatType})` : ''}`);
    if (record.range) lines.push(`Range: ${record.range}`);
    if (record.limitedUses) lines.push(`Limited Uses: ${record.limitedUses}`);
    if (record.conveyorSpeed != null) lines.push(`Conveyor Speed: ${record.conveyorSpeed}`);
    return lines.map((line) => `<p class="capgrader-panel-note">${line}</p>`).join('');
  }

  function renderDecision() {
    const eligible = ownedEligibleSorted();
    if (eligible.length === 0) {
      decisionCardEl.innerHTML = '';
      decisionEmptyEl.hidden = false;
      return;
    }
    decisionEmptyEl.hidden = true;
    const { item, stats } = eligible[0];

    if (item.kind === 'scalesWithConfiguration' && stats.configId !== item.bestConfig) {
      const bestConfig = item.configs.find((c) => c.id === item.bestConfig);
      decisionCardEl.innerHTML = `
        <div class="mpa-decision-card-inner">
          <div class="mpa-decision-heading">
            ${itemIconHtml(item.name, item.variant, 'mpa-decision-icon')}
            <div>
              <h3>${item.name}</h3>
              <p class="capgrader-panel-note">Currently: ${stats.contextNote} (MPA ${formatStat(stats.mpa)})</p>
            </div>
          </div>
          <p class="capgrader-panel-note">Switching to <strong>${bestConfig.label}</strong> gives a better MPA (${formatStat(bestConfig.mpa)}) without chopping anything.</p>
          <div class="mpa-decision-actions">
            <button type="button" class="capgrader-generate" data-mpa-decision="switch-config" data-mpa-config="${item.bestConfig}">Switch to ${bestConfig.label}</button>
            <button type="button" class="capgrader-edit-setup" data-mpa-decision="evaluate-anyway">Evaluate for chopping anyway</button>
          </div>
        </div>
      `;
      return;
    }

    const record = findRecord(item.name, item.variant);
    const chopNote = describeChopEffect(item, stats);
    decisionCardEl.innerHTML = `
      <div class="mpa-decision-card-inner" data-mpa-item="${item.name}">
        <div class="mpa-decision-heading">
          ${itemIconHtml(item.name, item.variant, 'mpa-decision-icon')}
          <div>
            <h3>${item.name}</h3>
            <p class="capgrader-panel-note">${stats.contextNote ?? ''}</p>
          </div>
        </div>
        <p class="mpa-decision-mpa">MPA: <strong>${formatStat(stats.mpa)}</strong></p>
        ${statBlockHtml(record)}
        ${record?.effects ? `<p class="capgrader-panel-note">${record.effects}</p>` : ''}
        ${chopNote ? `<p class="mpa-decision-chop-note">${chopNote}</p>` : ''}
        <div class="mpa-decision-actions">
          <button type="button" class="capgrader-edit-setup" data-mpa-decision="keep">Keep</button>
          <button type="button" class="capgrader-generate mpa-chop-button" data-mpa-decision="chop">Chop</button>
        </div>
      </div>
    `;
  }

  decisionCardEl?.addEventListener('click', (event) => {
    const action = event.target.closest('[data-mpa-decision]')?.dataset.mpaDecision;
    if (!action) return;
    const card = event.target.closest('[data-mpa-item]');
    const eligible = ownedEligibleSorted();
    const current = eligible[0]?.item;
    if (!current) return;

    if (action === 'switch-config') {
      const configId = event.target.dataset.mpaConfig;
      state.inputs[current.name] = { ...state.inputs[current.name], config: configId };
      saveState();
      renderDecision();
      return;
    }
    if (action === 'evaluate-anyway') {
      // Render the normal keep/chop card for this same item without
      // changing its configuration — a one-off UI override, not persisted.
      const stats = currentStatsFor(current.name);
      const record = findRecord(current.name, current.variant);
      const chopNote = describeChopEffect(current, stats);
      decisionCardEl.innerHTML = `
        <div class="mpa-decision-card-inner" data-mpa-item="${current.name}">
          <div class="mpa-decision-heading">
            ${itemIconHtml(current.name, current.variant, 'mpa-decision-icon')}
            <div><h3>${current.name}</h3><p class="capgrader-panel-note">${stats.contextNote ?? ''}</p></div>
          </div>
          <p class="mpa-decision-mpa">MPA: <strong>${formatStat(stats.mpa)}</strong></p>
          ${statBlockHtml(record)}
          ${record?.effects ? `<p class="capgrader-panel-note">${record.effects}</p>` : ''}
          ${chopNote ? `<p class="mpa-decision-chop-note">${chopNote}</p>` : ''}
          <div class="mpa-decision-actions">
            <button type="button" class="capgrader-edit-setup" data-mpa-decision="keep">Keep</button>
            <button type="button" class="capgrader-generate mpa-chop-button" data-mpa-decision="chop">Chop</button>
          </div>
        </div>
      `;
      return;
    }
    if (!card) return;
    const name = card.dataset.mpaItem;
    if (action === 'keep') {
      keptThisRun.add(name);
      renderDecision();
      return;
    }
    if (action === 'chop') {
      const item = itemsByName.get(name);
      if (item.name === 'Lambda Upgrader') {
        const stats = currentStatsFor(name);
        const remaining = stats.uses - 1;
        if (remaining > 0) state.inputs[name] = { ...state.inputs[name], uses: remaining };
        else { state.owned[name] = false; delete state.inputs[name]; }
      } else {
        state.owned[name] = false;
        delete state.inputs[name];
      }
      saveState();
      renderDecision();
      renderCategories();
    }
  });

  // ---- wiring --------------------------------------------------------------

  statToggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.activeStat = button.dataset.mpaStat;
      saveState();
      renderStatToggle();
      renderList();
    });
  });

  openChopBlockButton?.addEventListener('click', () => {
    renderCategories();
    setView('select');
  });

  selectBackButton?.addEventListener('click', () => setView('list'));

  runChopButton?.addEventListener('click', () => {
    keptThisRun = new Set();
    renderDecision();
    setView('decision');
  });

  decisionBackButton?.addEventListener('click', () => setView('select'));

  let initialized = false;
  document.addEventListener('mpa-tool:activated', () => {
    if (!initialized) {
      initialized = true;
      renderStatToggle();
      renderList();
    }
  });

  // Test hook — same pattern as capgrader-generator.js's __cgDebug: lets
  // automated tests exercise the real logic without a browser. No-op in
  // production beyond one extra harmless global property.
  globalThis.__mpaDebug = {
    state, itemsByName, choppableItems, referenceStatFor, currentStatsFor,
    isLocked, ownedEligibleSorted, derivedFromMulti, formulaMultiForEffects,
    groupedForSelection, renderList, renderCategories, renderDecision, setView,
    getKeptThisRun: () => keptThisRun, resetKeptThisRun: () => { keptThisRun = new Set(); },
  };
})();
