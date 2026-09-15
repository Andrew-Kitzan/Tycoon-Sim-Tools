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

  async function renderRebirthPage() {
    const rows = await loadRebirthData();
    const tableRows = rows.map((row) => `
      <tr>
        <td>${formatNumber(row.rebirth)}</td>
        <td>${row.cost == null ? '—' : formatNumber(row.cost)}</td>
        <td>${formatList(row.itemRewards)}</td>
        <td>${row.crystalReward == null ? '—' : formatNumber(row.crystalReward)}</td>
        <td>${formatList(row.statRewards)}</td>
        <td>${formatList(row.potionRewards)}</td>
      </tr>`).join('');
    return `
      <p>Rebirthing resets your cash to $0 in exchange for permanent rewards —
      it's the game's core prestige loop. Since cash is the only thing you
      lose (see below), the optimal time to rebirth isn't the moment you
      first qualify — spend as much as you can on crates from the Merchant
      first, then rebirth once you've got just enough cash left to cover the
      cost.</p>
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
            <th>Crystals</th>
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
