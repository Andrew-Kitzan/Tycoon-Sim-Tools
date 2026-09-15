# AI Handoff

Read this first, every session, before touching anything. Update it before
you finish — write it for an agent (Claude, ChatGPT/Codex, or otherwise) who
has no memory of this conversation and only has the repo plus this file to go
on. Don't delete previous entries' hard-won context; if something here is
now wrong, correct it in place and say why.

## Standing gotchas (read before adding/toggling any new tool or section)

**The `[hidden]` attribute vs. an author `display` rule.** This has caused
real, user-visible bugs three separate times now (`.topbar`, `.wiki-tool`
twice — see the 2026-09-13 entries below and 2026-09-11/2026-09-10 entries
further down). The browser's default UA rule `[hidden] { display: none; }`
has low specificity — any of your own rules that set `display` on that same
class (e.g. `.foo { display: flex; }`) beats it once written, so setting
`el.hidden = true` in JS silently does nothing and the element stays fully
visible and laid out. **Whenever you give a class its own `display` value
AND that element is ever toggled via `.hidden = ` in JS, you MUST also add
`.that-class[hidden] { display: none; }`** (see the many existing examples
in `styles.css` — search for `[hidden] { display: none; }`).
`tests/hidden-toggle-guard.test.mjs` (part of `npm test`) now statically
checks this automatically — it scans every JS file for `.hidden = ` toggles,
resolves the target element's CSS class, and fails if that class has a
non-`none` `display` rule with no matching `[hidden]` override. It already
caught and this session fixed one additional real latent instance
(`.live-dropper-control`) beyond the two everyone already knew about. It is
NOT a full CSS parser (see the file's own header comment for exactly what
it does and doesn't catch) — don't treat a clean run as absolute proof, but
it should catch the common "new tool section doesn't actually hide" case
going forward. If you add a new tool/section that gets toggled via
`.hidden`, run `npm test` before considering it done.

**If the player says a layout/spacing looks off but your own screenshot
shows it looking fine (or the reported gap/overlap doesn't match your
measured pixel values), ask whether they're zoomed in or out in their
browser before changing any CSS.** This has happened at least twice in this
project's history: once for the "TYCOON SIM" header being reported as
covered by the menu icon (turned out to be a zoom artifact, a padding fix
was applied then reverted), and again for the "Tool Menu" label gap looking
too wide after it had already been tightened and measured correctly via
`getBoundingClientRect()` (same cause, confirmed directly by the player:
"I didnt noticed i was zoomed out"). Browser zoom scales the whole page
including fixed-position elements and text together, so a real screenshot
comparison won't reveal it — you have to ask. Don't guess-and-shrink/adjust
a value further based on a single report without first ruling this out (or
stale cache — see the dev-server caching quirk noted elsewhere in this
file) as the cause.

## Last worked on

2026-09-14 — see "2026-09-14 Wiki home page: real navigation, all 13 tiles
backgrounded" below. Long session, all UI/content-scaffolding work on the
Wiki tool's home page — no other tool touched. The nav grid went from
static placeholder boxes to a real (if content-empty) page-switching
system, and every single tile now has a themed background image + accent
color supplied by the player one at a time over many turns. Session ended
here because the player was near their context limit and is continuing in
a new chat — this entry is written assuming zero shared memory with this
conversation.

2026-09-13 — see "2026-09-13 Wiki content-structure research (not yet
planned/built — reference for later)" below. Pure research, no code
changed: browsed a real fan wiki for structure/navigation ideas (category
pages vs. item pages, infobox pattern, the cross-page "navbox" footer link
pattern). Player doesn't have time to turn this into a plan yet — don't act
on it without checking in first.

2026-09-13 — see "2026-09-13 Wiki tool bleeding into other tools + tool-menu
label" below, then "2026-09-13 New Wiki tool (WIP), now the default tool"
below that. The wiki tool from earlier today had exactly the `[hidden]`-vs-
`display` bug described in "Standing gotchas" above — it doesn't hide, and
in the process it also fixed one more pre-existing latent instance
(`.live-dropper-control`) and added the regression test that now guards
against all of these. The player briefly thought the "Tool Menu" label gap
was still too wide after tightening — turned out to be their own browser
zoom, not a real issue (see that entry's "Resolved" bullet, and the new
"Standing gotchas" note about asking about zoom).

2026-09-13 — see "2026-09-13 New Wiki tool (WIP), now the default tool"
below. A brand-new fourth-wall-breaking tool: it doesn't use the shared
app-shell header/panel chrome at all, draws its own full-viewport page, and
is now what loads first for a new visitor instead of Base Builder. Only a
home-page demo exists so far — no actual wiki content/pages yet.

2026-09-13 — see "2026-09-13 Capgrader Generator: Base/Shiny variant badges
+ icons/items/ backfill" below. Small, low-risk polish on top of the
2026-09-11 variant-mixing work: the results table now visually distinguishes
Base vs Shiny per row, plus a handful of item icons that were missing from
`icons/items/` got copied in from the player's local icon folder.

2026-09-11 — see "2026-09-11 Capgrader Generator: mix Base/Shiny variants of
the same capgrader within one chain" below. A real capability gap, not a
small tweak — the search previously collapsed every capgrader to one "best"
owned variant for the whole chain, which made some real legal chains
(reported and verified by a player) structurally impossible to find.

## 2026-09-14 Wiki home page: real navigation, all 13 tiles backgrounded

Picks up directly from the 2026-09-13 Wiki tool entries below (read those
first for how the tool avoids the shared app-shell chrome, why it's the
default tool, and the `[hidden]`-vs-`display` bug that bit it twice).
Everything in this entry is still just the **home page** — no actual wiki
content/article system exists yet, see "Not done" at the bottom.

**1. Removed the left sidebar, added a "Navigate" heading.** The home page
previously had a `#wiki-sidebar` (title + empty "Navigation" placeholder box)
next to the main content — player asked to drop it entirely and put a plain
`<h2 class="wiki-nav-heading">Navigate</h2>` above the tile grid instead.
`.wiki-body` went back to a single-column flex layout (`.wiki-main` is now
its only child). If you see references to a sidebar in older parts of this
file or in git history, that's stale — it's gone.

**2. Real (if content-empty) page navigation now exists** — `wiki-tool.js`:
- `index.html` has two sibling divs inside `.wiki-main`:
  `#wiki-home-view` (the hero + nav grid + updates, what you see by default)
  and `#wiki-page-view` (`hidden` by default — a back button, a title, and a
  body), both new. **`.wiki-home-view[hidden]`/`.wiki-page-view[hidden]`
  needed the same explicit `{ display: none; }` override as everything else
  in the "Standing gotchas" section** — already added, don't remove it.
- Every nav tile is now a real `<button data-wiki-page="KEY">` (was a bare
  `<div>` before). `wiki-tool.js` has a `PAGES` object keyed by that same
  string, each entry `{ title, body }` (body is a raw HTML string, currently
  always just one `<p>...Not written yet.</p>`). Clicking a tile hides
  `#wiki-home-view`, shows `#wiki-page-view`, and fills in the title/body.
  The back button (`#wiki-page-back`) reverses that. **The 13 valid keys
  right now, in the order they appear in `index.html`**: `index`,
  `conveyor`, `decoration`, `mastery`, `rebirth`, `achievements`,
  `furnace-loot`, `events`, `merchant`, `enchanter`, `brewer`, `p2w`,
  `codes`. That's a player-specified order (see the "tile order" ask, not
  alphabetical or otherwise meaningful) — don't silently re-sort it.
- This is intentionally the simplest possible thing that could work — no
  routing, no URL/history integration, no content beyond a placeholder
  sentence per page. Next real step (not started, player hasn't asked)
  would be an actual content-authoring system per page.

**3. Every tile now has its own background image + accent color** — this
was almost the entire session, one image at a time from the player's local
`Documents\Tycoon Sim\Spreadsheet Pic\` folder. The pattern, once
established, is genuinely reusable and cheap per tile:
- **Shared CSS base**: `.wiki-nav-tile-bg` (in `styles.css`, search for it)
  handles the `background-size: cover`, the dark gradient `::before` overlay
  for text legibility, and hover behavior via two CSS custom properties —
  `--tile-accent` (border color) and `--tile-accent-hover` (border/outline
  color on hover). A tile-specific class (e.g. `.wiki-nav-tile-rebirth`)
  just sets those two variables plus `background-image: url(...)` — nothing
  else needs touching per tile.
- **HTML per tile**: `<button class="wiki-nav-tile wiki-nav-tile-bg
  wiki-nav-tile-KEY" data-wiki-page="KEY"><span>Label</span></button>` — the
  `<span>` wrapper matters, `.wiki-nav-tile-bg span` is what gets the
  `z-index`/`text-shadow` treatment to stay legible over the image. A plain
  tile (no background yet) skips both extra classes and the `<span>` — just
  `<button class="wiki-nav-tile" data-wiki-page="KEY">Label</button>`. As of
  this entry **every tile has a background — there are no plain tiles left**
  (Merchant was the last one filled in this session).
- **The hover-drops-the-image bug and its real fix** (already covered in
  "Standing gotchas" above for the general `[hidden]` case, but this is a
  separate, tile-specific gotcha worth restating precisely since it'll bite
  again the moment someone adds a 14th tile by hand instead of copying the
  pattern): the *generic* hover rule for plain tiles
  (`.wiki-nav-tile:not(.wiki-nav-tile-bg):hover { background: rgba(...); }`)
  uses the `background` **shorthand**, which resets `background-image` to
  `none` on anything it matches. The fix is the `:not(.wiki-nav-tile-bg)`
  exclusion already in that selector — it must stay, and any new
  image-background tile MUST carry the `wiki-nav-tile-bg` class or it'll
  silently lose its image on hover exactly like Rebirth's flame gif did the
  first time (see the 2026-09-13 entry for the full debugging saga — turned
  out to be a stale browser stylesheet the first time it was investigated,
  but the *real*, permanent fix ended up being this `:not()` exclusion plus
  never re-declaring `background-image` inside a tile-specific `:hover`
  rule at all, since re-declaring the same url risked some browsers
  restarting a gif's animation on a dark first frame).
- **Full current tile → image → accent-color table** (all files are in
  `icons/wiki/`, all committed as real binary assets, not generated):

  | Tile (`data-wiki-page`) | Image file | Accent / hover accent |
  |---|---|---|
  | `index` | `index-bg.png` (two dragons) | `#c9541f` / `#ffb066` |
  | `conveyor` | `conveyor-bg.png` | `#b83fa0` / `#ff8fe0` |
  | `decoration` | `decoration-bg.png` (rubber ducks) | `#c9a227` / `#ffe066` |
  | `mastery` | `mastery-bg.png` | `#8fa3b3` / `#e8f2ff` |
  | `rebirth` | `index-icon.png` (furnace/loot pile — **note the filename is misleading, this was originally meant for Index, got moved to Rebirth, filename never renamed**) | `#b8802f` / `#ffcf7e` |
  | `achievements` | `achievements-bg.png` | `#7a3fa8` / `#d9a6ff` |
  | `furnace-loot` | `furnace-loot-bg.png` | `#6fae2e` / `#c6f26b` |
  | `events` | `events-bg.png` (**cropped**, see below) | `#8a5a2e` / `#e0a860` |
  | `merchant` | `merchant-bg.png` | `#b81f1f` / `#ff7a7a` |
  | `enchanter` | `enchanter-portal-bg.png` | `#2fd6a0` / `#8fffe0` |
  | `brewer` | `brewer-bg.png` | `#a03fd6` / `#e0a6ff` |
  | `p2w` | `enchanter-bg.png` (**note**: this was Enchanter's *original*
    background before the player asked for it to move to a new P2W tile and
    for Enchanter to get a different, new image — filename still says
    "enchanter" but it's P2W's image now) | `#2f8fd6` / `#8fd6ff` |
  | `codes` | `codes-bg.png` | `#d6337a` / `#ff85c0` |

  **`icons/wiki/index-icon.png` is unused by anything named "index"
  anymore** and `icons/wiki/enchanter-bg.png` is unused by anything named
  "enchanter" anymore — both filenames are now historical/misleading
  relative to what they're actually used for. Nobody has asked for a
  rename; don't do one unprompted since it'd just be churn, but don't be
  confused by the mismatch either.

- **Not every image was a clean crop.** Tiles are a wide `2.4/1`
  `aspect-ratio`, but not every source screenshot was landscape enough —
  `background-size: cover` center-crops hard on a portrait-ish source. The
  very first Index attempt (a different image, since replaced) and the
  first Enchanter attempt (`enchanter-bg.png`, now reused for P2W, ratio
  ~1.34:1) both lost their most interesting visual detail (a glowing
  archway, a crane arm) to the crop. Always mention this tradeoff to the
  player when a new image comes in portrait-ish rather than silently
  shipping a bad crop — they've been receptive to swapping for a better
  shot when told plainly, and even reused a "failed" crop for a different
  tile rather than discarding it (the P2W move).
- **Text removal technique, if it comes up again**: the raw
  `events-bg.png` source had real in-game UI text baked into the screenshot
  ("Index — View your collection!", "Luck Modifier — Toggle your luck!")
  overlaid across the top ~150px, which the player wanted gone while
  keeping everything else (an "Event Schedule" signpost, unrelated to that
  UI text) untouched. No image-editing tool was available in this
  environment (no PIL, no real ImageMagick — `C:\Windows\System32\convert.exe`
  is the Windows FAT→NTFS converter, NOT ImageMagick, don't be fooled by
  `which convert` finding it) — **`npm install jimp --no-save` in the
  scratchpad directory worked fine** (pure JS, no native build step) and a
  plain top-band crop (`img.crop({x:0,y:150,w,h:height-150})`) cleanly
  removed both text blocks without needing real inpainting, since
  everything below that y-coordinate in the source was already clean. Only
  works when the unwanted content is confined to a droppable band at an
  edge — for text/objects embedded mid-frame, this technique doesn't apply
  and a real inpainting tool would be needed (not available here).

**Not done**: still no actual per-page content beyond the placeholder
sentence, no search functionality behind the search bar, no decision made
on how a real content-authoring workflow should work for the eventual wiki
articles. The player was about to run low on context and said they'd
continue in a new chat — there was no specific "next step" queued beyond
that; take direction from whatever they ask for first in the new session
rather than assuming content-writing is next.

## 2026-09-13 Wiki content-structure research (not yet planned/built — reference for later)

Player wants to plan out actual wiki *content* structure (pages, item
templates, navigation) once they have time, separate from the home-page demo
above. Asked to browse a real MediaWiki-based fan wiki for a different game
(Ultimate Mining Tycoon, `https://umt.miraheze.org/wiki/Ultimate_Mining_Tycoon_Wiki`
— the same site whose home page was used as visual inspiration for this
project's own wiki home page demo) specifically for structure/flow/linking
patterns, not content to copy. Findings, kept here until the player is ready
to turn this into an actual plan:

- **Category pages ≠ item pages.** A page like "Ores" or "Machines" is one
  long article explaining the *mechanic* (how the category works, how it's
  obtained/used), not just a list of links. Skeleton: intro sentence → table
  of contents → mechanic sub-sections → a data table or icon-grid gallery of
  every item in that category (each name/icon links out to that item's own
  page) → a version-history/changelog section → a "Navigation" footer.
- **Individual item pages** get their own URL (e.g. `Tin_Ore`,
  `Guide:Tablet_Factory`), linked from the category table. Template: one
  intro sentence, an **infobox** top-right (icon + a stat block — fields
  vary sensibly per item type: ores show Value/Depth/Strength, other types
  would show their own relevant stats), then Obtaining → Usage → History
  (a per-item-filtered changelog) → Navigation.
- **The page-bottom "Navigation" section is a collapsible navbox** (MediaWiki
  calls this a "vte" template) listing every item across the whole related
  item-family (e.g. all Ores AND all Gems together under a "Minerals"
  group), so a reader can jump sideways between sibling items without going
  back through the category page first. This is the single most reusable
  idea found — worth adopting even if nothing else from this research is,
  since it solves real cross-page navigation cheaply.
- **Machines-style category pages** additionally split into named
  sub-groups by function (Metalwork, Stonework, Explosives, etc.), each
  with its own short blurb and an icon-card gallery (image + price per
  card) instead of a big table — better fit for tools/upgraders than the
  Ores-style table, probably the closer analog for this game's
  Upgraders/Machines pages if built.
- **Linking convention**: category pages hyperlink every proper-noun
  mechanic term inline on first mention (e.g. "sold through **Sellers**,"
  smelted into **Bars**"), and every item name in a table/gallery is always
  a live link even before that page exists (MediaWiki shows these as
  visually-distinct "redlinks" — worth deciding whether to do the same or
  only link pages that already exist, once a page system exists here).
- **Home page layout already matches** what was referenced when building
  this project's own wiki home-page demo (see the entry below) — search top
  center, hero welcome block, 3 external links, a tile-grid nav row, then a
  two-column updates block. The reference site's home page has more below
  that (Recent Changes / Wiki Statistics / Wiki Contribution Help) that the
  player explicitly said NOT to include here.

**Not done**: no plan has been written from this yet — the player said they
don't have time to review it right now. Next session should NOT start
building page templates/navigation logic from this alone; revisit with the
player first to turn it into an actual plan (which pages first, what fields
each of this game's item types needs in an infobox, whether to use the
navbox-footer pattern, etc.) before writing any code.

## 2026-09-13 Wiki tool bleeding into other tools + tool-menu label

Two follow-up fixes on top of the Wiki tool work below, both reported
directly by the player after trying it:

1. **The wiki bled onto every other tool.** `#wiki-tool`/`.wiki-tool` was
   toggled via `wikiToolSection.hidden = activeTool !== 'wiki'` in
   `applyActiveToolUi()` (`app.js`), but `.wiki-tool { display: flex; }` had
   no `[hidden]` override — see "Standing gotchas" at the top of this file,
   this is that exact bug, the second time it's hit this same tool in one
   day. Fixed with `.wiki-tool[hidden] { display: none; }`. Writing
   `tests/hidden-toggle-guard.test.mjs` (see "Standing gotchas") was a
   direct response to this happening again.
2. **Added a "Tool Menu" label** (`#tool-nav-toggle-label` /
   `.tool-nav-toggle-label` in `styles.css`) next to the fixed hamburger
   button, fixed-positioned at `top:20px; left:62px`. Originally
   Wiki-only (the empty space next to the hamburger only existed there,
   since the Wiki tool hides the shared `.topbar`), then the player asked
   for it on every tool for consistency — it's now unconditionally visible,
   no JS toggle needed at all.
   - **This required `.planner-brand { padding-left: ... }`** (plus a
     `max-width: 720px` override that drops to `padding-top: 44px` with no
     left padding instead, wrapping below the fixed buttons on a narrow
     phone screen). Without this, "TYCOON SIM" / the tool title sits
     directly under the fixed hamburger+label pair and gets visually
     clipped. Verified in-browser at a ~800px pane width, a real 1400px
     desktop width, and a 375px mobile emulation — no overlap in any of
     them. Value started at `165px` (generous), then tightened to `130px`
     after the player said it was too far away — `130px` gives only ~8px of
     clearance past the label's right edge (measured via
     `getBoundingClientRect()`), which is close to the practical floor: much
     less and the title starts overlapping the label again (verified this
     boundary directly, don't go below it without re-checking).
   - **Resolved**: the player initially reported the gap still looked too
     wide even after this tightening and a requested hard-refresh — turned
     out to be their own browser zoom level, not a caching or CSS issue
     (confirmed directly by the player: "I didnt noticed i was zoomed out").
     `130px` is correct and doesn't need revisiting on this basis alone. See
     the new "Standing gotchas" entry about asking about zoom before
     changing layout code in response to a visual report.
   - Don't reintroduce a bare `.planner-brand {}` rule without this padding
     if this ever gets refactored — the collision is real and was verified
     with a screenshot, not assumed (a near-identical-looking padding
     change earlier in this same project's history was tried, then
     reverted, because it had been requested to fix what turned out to be a
     browser-zoom artifact, not a real overlap — this one IS real, checked
     at multiple real viewport widths, not just eyeballed once).

**A mistake made and fixed while working on this**: while iterating on the
regression test above, a throwaway `sed -i` edit to `styles.css` (to
temporarily verify the test actually catches the bug) was undone with
`git checkout -- styles.css` — which discarded ALL of this session's
still-uncommitted `styles.css` work, not just the throwaway sed edit. Had to
manually redo the `.wiki-tool[hidden]`, `.live-dropper-control[hidden]`,
the entire `.tool-nav-toggle-label` block, and both `.planner-brand` rules
from memory/re-derivation. Everything was re-verified against `npm test`
and in-browser afterward and nothing was ultimately lost, but **the lesson
stands generally: never use `git checkout --`/`reset`/etc. to undo a small
in-progress experiment when there's other uncommitted work in the same
file — undo the specific edit instead, or commit good work before
experimenting with risky throwaway changes.**

## 2026-09-13 New Wiki tool (WIP), now the default tool

Player wants a wiki tool eventually (item info, guides, etc. — discussed but
not planned yet, see the "Not done" note in the 2026-09-13 icons entry
below). This session built just the **home page**, as a design demo, before
any real content/page system exists. Marked WIP in the tools menu
(`<span class="wip-badge">WIP</span>` next to "Wiki", same convention as
Base Builder's).

**It's now the default tool** (`app.js`'s `loadActiveTool()`/`setActiveTool()`
both fall back to `'wiki'` instead of `'builder'` when nothing is saved yet
in `localStorage`), matching the player's explicit ask — a new visitor lands
here first, not on Base Builder. Existing visitors with a saved
`tycoon-sim-2:active-tool:v1` are unaffected; this only changes the
first-ever-visit default.

**Why it doesn't use the shared app-shell header** (`.topbar`,
`#header-title`, etc., shared by every other tool): the player wants this
tool to look like an actual wiki homepage (reference: a screenshot of an
unrelated game's community wiki, used purely for layout inspiration, not
this game's content) — full-bleed background image, its own search bar and
title — not a small tool bolted under the game's usual top bar. So
`applyActiveToolUi()` in `app.js` now hides `.topbar` entirely
(`appTopbar.hidden = activeTool === 'wiki'`) whenever this tool is active,
and `#wiki-tool` draws a completely self-contained page. The fixed
hamburger tool-switcher button and Feedback button are OUTSIDE `<header>` in
the DOM, so they still work fine regardless — only the per-tool title bar
disappears.

**Full-bleed background — the trick and its gotcha** (`styles.css`,
`.wiki-tool`/`.wiki-frame`): every other tool lives inside `.app-shell`,
which is `max-width: 1740px; margin: 0 auto; padding: var(--shell-pad)`
(new CSS variable, default `28px`, `16px` under the existing 720px mobile
breakpoint — added specifically so this breakout math and `.app-shell`'s own
padding can never drift out of sync). To make the wiki's background image
fill the actual browser viewport instead of sitting in a smaller inset
panel, `.wiki-tool` uses the standard "breakout" hack:
`margin: calc(var(--shell-pad) * -1) calc(-50vw + 50%); width: 100vw;`.
**Gotcha hit and fixed**: `vw` units include the width a vertical scrollbar
would occupy, while `%` (based on the containing block) does not — when a
page has a vertical scrollbar these two disagree by the scrollbar's width,
which showed up as ~7px of stray horizontal scroll/cropped content on the
right edge. Fixed by adding `overflow-x: hidden` to `body` (comment left in
place explaining why). **If any future full-bleed/breakout element is added
elsewhere, expect the same issue** — either reuse this existing
`overflow-x: hidden`, or budget for it again.

**Content is entirely placeholder** — nothing here is wired to real data yet:
- Search bar (`#wiki-search-input`) is visual only, no search logic.
- The left sidebar's `.wiki-sidebar-list` and the `.wiki-nav-grid`'s six
  `.wiki-nav-tile` divs are empty, dashed-border placeholder boxes — meant to
  become real links to wiki pages once those exist. Don't build a page
  system on top of these without asking the player how they want pages
  structured first; this was explicitly "just the outlines for now."
- `.wiki-update-panel` "Game Updates" / "Wiki & Tools Updates" boxes just say
  "Coming soon." — no update-log data source exists yet.
- The 3 hero links (Play the Game / Roblox Group / Discord) ARE real,
  working links (`target="_blank" rel="noopener noreferrer"`) — those don't
  need revisiting.

**Credits/links used in the hero copy** (confirmed with the player directly,
not guessed): wiki run by **Minecraftwiner1**; game is **Tycoon Simulator**
(confirmed via the actual Roblox store listing — note this differs from
this repo's own internal name "Tycoon Sim 2", which is just this companion
tool's own branding, not the game's real title); made by **derpmonster83**
(owner, per the "Derp LLC" Roblox group page) and **Auxiliary_cord**
(builder — player corrected an initial wrong guess of "Auxinite" from
misreading a reference image). Game link:
`https://www.roblox.com/games/123076957357158/Tycoon-Simulator`. Group
link: `https://www.roblox.com/communities/35607303/Derp-LLC#!/about`.
Discord: `https://discord.gg/YWsMAMdftq`.

**Background image**: `icons/wiki/background.png` — an actual in-game
screenshot the player supplied (their local
`Tycoon Sim\Spreadsheet Pic\enviroment screenshot.png`, note the source
filename's typo'd spelling). **Lesson for next time**: a pasted/inline chat
image is NOT readable as a file — only a real filesystem path works. When a
player pastes an image and expects it used as an asset, ask for the actual
file path up front instead of assuming access, which costs a round trip.

**Not done**: no actual wiki pages/content, no search functionality, no
page-link data structure decided, no `wiki-tool.js` script exists yet
(everything so far is static HTML/CSS — no JS file was needed since nothing
is interactive besides real `<a>` tags). Player said they're still thinking
about how they want it to look/organized before requesting the next round of
implementation — don't build the page/content system speculatively.

## 2026-09-13 Capgrader Generator: Base/Shiny variant badges + icons/items/ backfill

**Variant badges (`capgrader-generator.js`, `styles.css`)**: now that chains
routinely mix Base and Shiny copies of the same capgrader (see the
2026-09-11 entries below), the results table's plain-text "Variant" column
was hard to scan at a glance. Each row's variant is now a colored pill:
white background + black text for Base, yellow background + black text for
Shiny (`.capgrader-variant-badge`, `.is-base` / `.is-shiny` in `styles.css`).
Mythic/Shiny Mythic fall into whichever bucket matches — anything with
"Shiny" in the name (`Shiny`, `Shiny Mythic`) gets the yellow treatment,
plain `Mythic` gets the white one, decided by
`entry.record.variant.includes('Shiny')` at render time.

**Sparkle effect on Shiny badges** — went through several iterations before
landing on something the player was happy with, worth recording so a future
session doesn't repeat the same misses:
1. First attempt used `::before`/`::after` radial-gradient "dots" with no
   `background-size` set — radial-gradient layers default to the size of
   their background box when unset, so each "dot" actually stretched to
   fill the whole badge, reading as one big pulsing glow blob that drowned
   out the "Shiny" text. **Lesson: always set `background-size` explicitly
   on small decorative radial-gradient dots, or they silently scale to the
   whole element.**
2. Fixed the sizing, then the player asked for the sparkle to look like an
   actual 4-point sparkle/star shape (reference: a "twinkle" glyph, one big
   star plus smaller ones), in white, not the soft circular dots. Solved
   with `clip-path: polygon(50% 0%, 62% 36%, 100% 50%, 62% 64%, 50% 100%,
   38% 64%, 0% 50%, 38% 36%)` on a plain white-background element — this
   polygon shape (4 outer spike points, 4 concave inner points) is the
   general recipe for a CSS sparkle/twinkle glyph if this is needed again
   elsewhere (e.g. a future Luck/Crate tool "lucky pull" celebration).
3. Player wanted only **one sparkle at a time**, appearing at a **random
   position inside the badge** (not fixed corners), with a **random pause
   between twinkles capped on the low side of "not too long"**. Pure CSS
   keyframes can't do true per-cycle randomness shared identically across
   every badge instance, so this moved to JS: each Shiny badge's markup now
   includes a child `<span class="capgrader-sparkle">` (added in
   `renderResultTable()`'s row template, only when
   `variant.includes('Shiny')`), and `capgrader-generator.js` has a small
   self-scheduling loop (`scheduleSparkle()` + a delegated
   `document.addEventListener('animationend', ...)` in the same file) that:
   picks a random `left`/`top` percentage inside the badge, adds
   `.is-active` to trigger a ~550ms CSS keyframe twinkle
   (`capgrader-sparkle-twinkle` in `styles.css`), then on
   `animationend` removes the class and reschedules after a random
   300ms-2200ms pause. `initSparkles(root)` is called once per rendered
   result table (inside `renderResultTable()`) to wire up any sparkles it
   just created.
4. Final size ended up much bigger than first guessed (22px, up from an
   initial 9px) — the player's screen genuinely couldn't see a small
   sparkle at a glance, and explicitly said it's fine for it to bleed
   outside the badge's rounded-pill bounds (`.capgrader-variant-badge` has
   `overflow: visible` for exactly this reason — don't add `overflow:
   hidden` back to it without checking this doesn't need it).

**`icons/items/` backfill**: the player pointed at their local
`Documents\Tycoon Sim\Icons` folder and asked to get it into the repo so
future tools can pull icons without needing their machine. Turned out
`icons/items/` already mirrored ~430 of 436 files from an earlier session's
sync (not otherwise documented in this file — found by direct comparison,
worth a future session double-checking git blame/history if the provenance
matters). That earlier sync had also **manually corrected a handful of typos
in the source folder's raw filenames** to match the game's real item names
from `data/items.generated.js` (e.g. source's "Percision Ore Scanner" →
repo's "Precision Ore Scanner", source's "Advanced ore Upgrader" → repo's
"Advanced Ore Upgrader", source's "MVP Upgrader" → repo's "MVP", source's
"Enforced Upgrader Mythic Shiny" → repo's "Enforced Upgrader Shiny Mythic").
**Don't blindly re-sync/overwrite `icons/items/` from the source folder in
one shot** — diff filenames first and only add genuinely missing ones, or
those corrections get silently reverted back to the typo'd names. This
session found and added exactly 6 genuinely-missing files by doing an exact
filename diff: Base variants for Carrot Mutator, Clover Garden, and Lush
Beanstock (only their Shiny versions existed before), plus all three
missing Holophase Device variants (Base/Shiny/Mythic — only Shiny Mythic
existed before).

**Not done**: no wiki/item-info tool exists yet. Discussed with the player
(not yet planned or started) — their instinct was to wait for the
in-progress item-geometry worksheet (`data/item-geometry-worksheet.json`,
still WIP and intentionally untracked — see the standing rule below) to be
finished first, thinking it'd tell them "how every item works." Clarified
this isn't the right dependency: the geometry worksheet encodes
placement/rotation/footprint priority rules for the **base-builder engine**,
not display facts a wiki page would show a reader. A stats/effects/icon
wiki could be built today entirely from `data/items.generated.js`,
`data/mpu-stats.js`, `data/crate-luck-data.generated.js`, and now-complete
`icons/items/` — geometry only becomes relevant if a wiki page should also
render a live footprint/placement preview per item, which is a distinct,
optional feature. Player is now thinking about how they want it to look
before requesting an implementation.

## 2026-09-11 Capgrader Generator: mix Base/Shiny variants of the same capgrader within one chain

**The bug, reported by a player:** a chain reaching Sunflower Fields
(500B-1T) was found by hand using **2x Base Fragrant Passage + 1x Shiny
Fragrant Passage** in a row (Base's weaker ×1.4 lands precisely, Shiny's
×1.54 finishes just past the 500B floor) — a real, verified-legal chain (see
the previous session's discovery of a genuine 350B-500B capgrader range gap
that only variant-mixing can bridge). The generator could never find it,
because `legalPool()` called `bestOwnedVariant()` for every capgrader,
collapsing straight to whichever single variant ranked highest (Shiny beats
Base) — the search literally never saw Base Fragrant Passage as a usable
move once Shiny was owned too.

**The fix — toggle state now tracks owned count per variant, not one shared
count + an allow-list:**
- Old shape: `{ owned, ownedCount, ownedVariants }` (one shared count, plus
  which variants are "allowed" — but only ever the single best allowed
  variant ever entered the search).
- New shape: `{ owned, variantCounts }` where `variantCounts` is `{ Base: 2,
  Shiny: null, ... }` — a number is an exact owned-copy cap for JUST that
  variant, `null`/absent means unlimited (the default), and explicit `0`
  excludes that variant. Every variant with a non-zero count is now pushed
  into `legalPool().capgraders` as its own independently-usable record
  (`ownedVariantRecords()`), not just one "best" pick.
- Usage tracking (`state.uses`) is now keyed by `` `${name}::${variant}` ``
  (`usageKey()`) instead of just `name`, so Base and Shiny copies of the
  same item track separate remaining-use budgets — this is what actually
  lets the beam search interleave e.g. 2 Base + 1 Shiny Fragrant Passage as
  three independent moves within one chain. `paretoKey()` needed no change,
  since it already just serializes whatever keys are present in `state.uses`.
- `bestOwnedVariant()` is kept (renamed usage: now built on top of
  `ownedVariantRecords()`) for additives, Lunar Landing, and scanners, which
  only ever apply once or as a one-time opening move — no benefit to
  offering more than the single strongest legal choice there, unlike
  capgraders which chain many times.
- **UI**: replaced the single shared "Owned count" input + a row of
  Base/Shiny/etc. checkboxes with **one number input per variant** directly
  (`renderVariantCounts()`, `data-variant-counts` container) — blank means
  unlimited, 0 excludes that variant, any other number is that variant's
  exact cap. Old `[data-count-name]`/`[data-variant-checkbox]` handlers and
  `renderVariantCheckboxes()` removed entirely.
- **Persistence bumped to version 2** (`tycoon-sim-2:capgrader-tool:v1`'s
  stored `version` field). `restoreCapgraderState()` migrates version-1 saves
  on the fly: the old shared `ownedCount` is applied to every variant that
  was in the old `ownedVariants` allow-list, and `0` to every variant that
  wasn't — a reasonable one-time default (not a perfect equivalent, since v1
  could never actually distinguish "how many of each variant" anyway), which
  the player can then refine per-variant same as anyone starting fresh.

**Verified three ways, not just "tests pass":**
1. Hand-computed the player's exact reported chain step-by-step against the
   real database ranges/mainStats first, confirming it's genuinely legal
   before writing any code (see the previous session's investigation).
2. New test in `tests/capgrader-generator.test.mjs`: with the relevant items
   owned at their defaults (unlimited, every variant — no manual variant
   restriction needed), `optimizeCapgraderChain()` must actually produce a
   chain that reaches Sunflower Fields — this is the real regression
   guard, not just a pool-membership check. It does, using exactly the
   Base-then-Shiny Fragrant Passage pattern, without any depth/width tuning
   being necessary.
3. Reproduced the player's *exact* chain (same items, same per-variant
   counts as they reported owning) via the debug hook outside the test
   suite — the generator's output matches their reported chain move-for-move
   and lands within a rounding hair of the hand-computed final value
   ($1,094,649,971,703).

**Real bug found and fixed while writing the new tests**: `ownNothing()`
only reset `toggle.owned`, not `toggle.variantCounts` — since toggle objects
are shared/persistent across test blocks in the same suite run, an earlier
test's explicit per-variant override (`{ Base: 0 }`) was silently leaking
into a later, unrelated test against the same item name. Fixed by having
`ownNothing()` reset both fields. Worth remembering if a future test in this
file behaves correctly in isolation but not as part of the full suite.

**Regression band raised again, for a real reason, not a quality
regression**: `tests/capgrader-generator.test.mjs`'s "own everything" search
ceiling moved from $3.0T-$3.3T to **$3.3T-$3.6T** (measured: ~$3.43T) —
"own everything" now has strictly more legal moves available than before
(every variant of every capgrader, not just one each), so a slightly higher
ceiling is the expected, correct outcome of this fix. (An initial version of
this change measured ~$20.56T here — that number was wrong, produced by the
`limitedUses`-sharing bug below; see that section for the real story of how
this number was arrived at.)

**Not done / worth considering later**: additives, Lunar Landing, and
scanners still collapse to one "best" owned variant each (unchanged
behavior) — flagged in the code as intentional for now, since none of them
chain repeatedly like a capgrader does, but revisit if a similar
variant-mixing case is ever reported for one of those.

## 2026-09-11 follow-up: variant-mixing broke the shared `limitedUses` rule (caught by the player, not the test suite)

**The bug, reported by the player with a screenshot**: a generated chain used
both Base and Shiny Rubik's Polisher, and both Base and Shiny Toybox
Express — each a `limitedUses: 1` item. In the real game, `limitedUses` is a
base-game rule on the item **name**, shared across every variant of it: you
can only ever use it once, total, no matter how many variants you own. The
first version of the variant-mixing fix above tracked usage per
`name::variant` only (`usageKey()`), so each variant got its own independent
`limitedUses` budget — letting a limited-use item fire twice. This is what
originally inflated the "own everything" regression figure to the wrong
~$20.56T noted above.

**The fix — two independent caps, checked together:**
- `effectiveCap()` renamed to `ownedVariantCap()` and narrowed back to *only*
  the per-variant owned-copy cap (how many copies of *this* variant you
  said you own) — no longer conflated with `limitedUses`.
- Added `state.nameUses` alongside the existing `state.uses`: `state.uses` is
  still keyed by `name::variant` (for the owned-copy cap), `state.nameUses`
  is keyed by `name` alone and sums uses across every variant (for the
  shared `limitedUses` cap). Both are updated together in `applyItem()`.
- `useAllowed()` now checks both: the move must stay under its variant's
  owned-copy cap *and* under the item name's total `limitedUses` ceiling
  before it's legal.

**A second bug this exposed, in the finisher cascade**: fixing the above
first produced ~$2.83T for "own everything" — *lower* than the $3.15T
pre-variant-mixing baseline, which made no sense (variant-mixing should only
add options, never remove value). Root cause: the end-of-chain finisher
cascade looped over every finisher **variant record** in raw ascending
`mainStat` order, so a weak Base copy of a `limitedUses: 1` finisher (e.g.
Rubik's Polisher, Toybox Express) could consume the item's one shared use
before the stronger Shiny copy was ever tried. Fixed by grouping the cascade
by finisher **name** and always applying the single best-ranked owned
variant (`bestFinisherVariant()`, rank order `Shiny Mythic > Mythic > Shiny >
Base`), repeated only as many times as both caps in `useAllowed()` allow.
This is what produced the final, correct ~$3.43T figure.

**New regression test** in `tests/capgrader-generator.test.mjs`: owns both
Base and Shiny of Toybox Express and Rubik's Polisher (both
`limitedUses: 1`), asserts each name appears **at most once total** across
both variants in a generated chain, and that when used, the chosen variant
is the stronger Shiny one — not whichever was tried first.

**Lesson for future variant-mixing-style features**: when an item property
is a base-game rule on the item name (not something that varies by
variant — `limitedUses` is the only one currently in the data), any per-variant
usage tracking added for one feature must still be checked against a
separate per-name aggregate for that property. Per-variant granularity for
"how many do you own" and per-name granularity for "how many times can this
ever be used" are not the same axis and must never be merged into one cap.

## 2026-09-10 MPA / Chopping Block graduates from WIP + a real Portable Upgrader bugfix
strictly chronological across sessions, trust the content) is still the one
to read first for the tool's original design/decisions.

## 2026-09-10 MPA / Chopping Block graduates from WIP + a real Portable Upgrader bugfix

Several unrelated fixes/polish items from one session, grouped here since
they touched a lot of the same files. Read each sub-section independently.

**MPA / Chopping Block is no longer marked WIP.** Removed the `.wip-badge`
from both the header (`app.js`'s `applyActiveToolUi` — `wipBadge.hidden`
reverted to `activeTool !== 'builder'` only, dropping the `'mpa'` special
case added when the tool first shipped) and the tools-menu list entry in
`index.html`. The tool's own intro paragraph still says "This is a work in
progress — data and behavior may still change" — left as-is since the user
only asked to remove the badge; flag to them if that sentence should go too.

**Real, root-cause fix for the long-standing "Base Portable Upgrader is 1x2;
expected 2x1" `engine.test.mjs` failure** (flagged as a known pre-existing
issue in every session back to 2026-08-27, never previously investigated).
Traced to an inverted rotation rule duplicated in **three** places —
`engine/coordinate-map.mjs`'s `rotatedSize()`, `engine/validate.mjs`'s
`validatePlan()`, and `app.js`'s hand-ported `validateCoordinateMap()` — all
three swapped width/length for north/south-facing portables and kept them
natural for east/west, the exact opposite of every other item type's
convention (which swaps on east/west, not north/south). Unified all three to
the normal rule. `npm test` is now fully green for the first time in this
project's tracked history — no other known failures remain. If this
regresses, check for a 4th hand-copy of the same swap logic before assuming
it's a new bug.

**5 new capgraders added** from the nature-update database (all clean,
non-destructive, unlimited-use multiplicative upgraders — verified their
effects text before adding): Sunflower Fields (500B-1T), Fragrant Passage
(150B-350B), Canyon Refiner (1T-3T), Fungal Enhancer (1T-3T), Glistening
Falls (6T-10T). Added to both `capgrader-generator.js`'s and
`mpa-chopping-block.js`'s `CAPGRADER_NAMES` sets (kept in sync per the
existing convention — also tightened that sync comment in
`mpa-chopping-block.js`, which was already stale before this session, since
its list has always included Nuclear Upgrader/Chartreuse Collider that
capgrader-generator.js's list deliberately excludes).
- Updated `tests/capgrader-generator.test.mjs`'s "own everything" regression
  band from $1.25T-$1.4T to **$3.0T-$3.3T** (measured actual: ~$3.1536T) —
  real new bridging capgraders legitimately extend the optimal chain
  further, not a search-quality regression.
- Updated `tests/mpa-chopping-block.test.mjs`'s decision-loop-ordering test,
  which had used "Sunflower Fields" as a plain non-capgrader example item —
  now that it's correctly capgrader-locked, swapped to a simpler 2-item
  fixture (Fusion Upgrader + Ore Wash) rather than hunting for a new item
  with the exact right MPA to sit "in between."
- **Discovered and confirmed a real, verified gap in capgrader range
  coverage**: nothing bridges 350B (Fragrant Passage's ceiling) to 500B
  (Sunflower Fields' floor) — checked all 26 pool capgraders by hand via the
  debug hook. A chain landing at ~441B after two Fragrant Passage
  applications correctly falls through to finishers instead of ever reaching
  Sunflower Fields, no matter the ordering. This is a data-content
  characteristic, not a generator bug — flagged to the user, unresolved
  (would need either game data confirming the gap is real, or a
  currently-unlisted item that closes it).

**Floral & Nature crate icons** (both crates' data was already generated in
an earlier session — this was pure asset work): copied 18 icon files from
the user's local `Tycoon Sim/Icons` folder into `icons/items/`, covering
every real item in both crates across all their variants. Verified rendering
in Luck Simulator for both crates. Still missing: `Ore Pollinator` (not in
the user's source folder yet). **Also fixed a real bonus bug found along the
way**: `icons/items/MVP Upgrader.png` / `MVP Upgrader Shiny.png` existed but
the database's actual item name is just **"MVP"** — its icon had been
silently broken (blank slot) everywhere on the site, not just in the new
work. Renamed to `MVP.png` / `MVP Shiny.png`, deleted the stray misnamed
files. `Tornado` (appears in the Nature crate's raw item list but not
anywhere in the real item database) is confirmed a genuine, intentional
developer placeholder in the source spreadsheet — every field is literally
`"?"`, weight `0` — not a parsing bug; already silently excluded from the
Luck Simulator's item grid with no code change needed.

**MPA layout centered for desktop** (previously left-floating in a huge
empty page on wide screens, per user screenshots — mobile was already fine
since its narrower viewport naturally fills the `max-width`): added
`margin: 0 auto` to `.mpa-decision-card`, `.mpa-list-rows`, and
`.mpa-list-toolbar` (the last one also brings the MPU/MPA/MPS stat toggle
and the "Chopping Block →" button in from the page edges to line up with the
now-centered list/card below them).

**Ore Replicator + Dual Plasma combo now has a real screenshot icon.** The
combo row's `name` ("Replicator + Dual Plasma (Combo)") never matched any
real item's icon path, so it always rendered blank. Added an `icon` field
directly on that one entry in `data/mpu-stats.js`
(`icons/combos/replicator-dual-plasma.png` — the user's real in-game
screenshot, sourced from their `Tycoon Sim/Spreadsheet Pic/Ore Dupe.png`,
not a generic icon) and taught `mpa-chopping-block.js`'s `itemIconHtml()` to
prefer `item.icon` over the normal name-derived path when present — refactor
touched all 5 call sites (list row, toggle row, 2 decision-card renders, the
config-switch decision render), now passing the full item object instead of
separate name/variant args. Also added a `.mpa-icon-screenshot` CSS modifier
class (auto-applied whenever `item.icon` is set) that renders roughly 3x
larger than a normal square item icon in every context it appears (list
~104x61, toggle ~88x52, decision card ~168x99) — a real screenshot has much
finer detail than a flat icon and was illegible at the normal 26-44px sizes.
Also trimmed that entry's player-facing `notes` text down to just the actual
description — it previously included internal implementation detail
("List-only per the user — excluded entirely from Chopping Block...") that
had no business being shown to players.

**Real cold-load init bug fixed in `mpa-chopping-block.js`**: `app.js`
dispatches `mpa-tool:activated` synchronously on every page load (not just
actual tool switches) from `applyActiveToolUi()`, but since this file's
`<script>` tag loads *after* `app.js`'s, its event listener wasn't
registered in time to catch that very first dispatch on a cold load where
MPA was already the persisted active tool — leaving the browsing list
permanently blank until the player manually switched tools away and back.
`capgrader-generator.js` already solved this exact problem
(`if (!document.querySelector('#capgrader-tool')?.hidden) initCapgraderTool();`
right after its event listener registration) — applied the identical fix
here (`initMpaTool()` extracted to a named function, called both from the
event listener and synchronously if `#mpa-tool` isn't hidden at load time).
**If a 6th tool is ever added with this same lazy-init-on-activation-event
pattern, give it this same synchronous fallback check up front — don't wait
for another user bug report to find it again.**

## 2026-09-11 MPA / Chopping Block tool (fifth tool, WIP)

Added a fifth tool to the hamburger nav (`data-tool="mpa"`), explicitly
marked **WIP** (a `.wip-badge` next to its name in the nav list, and the
shared `#wip-badge` element in the header — repurposed/generalized, see
below — shown whenever this tool is active) since the user asked for it to
read as still-in-progress. Full design doc (read this first if touching the
tool again): `.claude/plans/mpa-chopping-block-plan.md` — **not committed**,
`.claude/*` is gitignored except `.claude/agents/` (same as the existing
`.claude/plans/cheerful-splashing-dewdrop.md` reference from the Capgrader
Generator entry below), so that plan only exists in this local working tree
unless the user asks for it to be preserved elsewhere.

**What it does — two screens:**
1. **MPU/MPA/MPS browsing list** (the tool's landing view): every tracked
   upgrader's icon, name, and whichever of the three efficiency stats is
   toggled (MPU = multi^(1/length), MPA = multi^(1/area), MPS =
   multi^(1/time)), sorted ascending (worst at top, best at bottom) —
   confirmed by the user, not assumed.
2. **Chopping Block** (button top-right of the list): pick every upgrader
   you own, organized into Crate / Merchant-Achievement-Rebirth / P2W-by-pack
   / **Other** categories (see below for why a 4th "Other" category exists
   beyond the user's original 3), each subcategory with Select All/Deselect
   All, then a "Figure out what's getting chopped" button runs a worst-MPA-
   first keep/chop loop respecting combo/dependency locks.

**Data: `data/mpu-stats.js` (new, one-time hand-maintained seed, NOT
auto-regenerated)** — per the user's explicit decision, this does not run
through `database:sync`; it was built once from the spreadsheet's MPU sheet
(84 tabulated rows) plus Lunar Landing (computed from its real stats via the
standard formula — not in the MPU sheet, added because the user said it was
"pretty simple" to include) and structured Lambda/Incremental/Tiki/Dream
Machine/Dragon's Breath entries. 83 total items (82 choppable + 1 list-only
combo). Edit this file directly (or ask) to add/update items going forward —
see its own header comment for the full schema (`kind`:
straight/scalesWithUses/scalesWithEffects/scalesWithConfiguration/
comboInfoOnly).

**Key design decisions, confirmed with the user across a long back-and-forth
— read before changing any of this:**
- **Scope is Multiplicative/Mixed upgraders only.** Additive-type upgraders
  (17 of them — Whimsical Palace, Basic Upgrader, Oasis Cleanser, etc.) have
  no stacking multiplier, so MPU/MPA/MPS don't apply; they're excluded from
  both screens entirely, including Chopping Block's ownership toggle.
- **"Highest form only"**: one entry per item, whichever variant the MPU
  sheet itself already used (Shiny for Common-Epic and P2W items, Shiny
  Mythic for non-P2W Legendary/Secret) — mirrored as-is from the sheet's own
  Variant column, not re-derived.
- **Lambda Upgrader's MPA gets *worse* with more uses** (1.070 at 1 use →
  1.041 at 3), the opposite of Incremental (1.024→1.050, best at 3) and Tiki
  (1.031→1.046, best at 2). The browsing list shows Lambda's actual best (1
  use), with the 3-Lambda numbers folded into that row's note — do not
  "fix" this to show 3 uses as if it matched the other two; it's a real,
  confirmed-correct asymmetry, not a bug.
- **Lambda's uses are capped at 3 in this tool** even though the database
  says "Unlimited" — per the user, real play never goes past 3. If a player
  types 4+ in Chopping Block's input, the UI clamps it to 3 and shows an
  alert explaining why (`window.alert` in the `change` handler for
  `data-mpa-input="uses"` — the only item this clamp applies to, via
  `maxUsesAllowed`).
- **Dream Machine's formula is real, not guessed**: found in the "Stats for
  Nerds" sheet, `multiplier = 1 + effects × perEffectBonus` (perEffectBonus
  0.75 for the tracked Shiny Mythic variant), verified against all three
  tabulated sample rows (4/5/6 effects) before being written into the data
  file. 6 effects exist in-game but only 5 are simultaneously obtainable —
  that's the practical max shown on the browsing list, but Chopping Block
  still takes a live count since a player may have fewer active.
- **Dragon's Breath's best MPA configuration is "Looped" (1.193), not "2
  Uses" (1.159)** — looping one Dragon's Breath twice via routing has a
  smaller footprint (area 15 vs. 18) than owning two separately, for the
  same multiplier. Chopping Block checks this before ever offering removal:
  if the player's current configuration isn't the best one, it suggests
  switching configuration first (a real, distinct decision-card state,
  `switch-config`/`evaluate-anyway` actions) rather than jumping straight to
  keep/chop.
- **Portable Spinner — found in the spreadsheet while building this, never
  discussed with the user before being added.** Same `scalesWithConfiguration`
  shape as Dragon's Breath (1 Use vs. Looped), and here looping costs *zero*
  extra footprint (both configs are 2x2) while roughly doubling the
  multiplier (1.76 → 3.0976, almost exactly squared) — Looped is clearly
  correct as the best config, but this item was never explicitly confirmed
  with the user the way Dragon's Breath was. **Flag this to the user and
  confirm it's handled the way they'd expect** — noted in the item's own
  `notes` field in the data file too, so it isn't lost.
- **The Ore Replicator + Dual Plasma combo row is browsing-list-only** — one
  fixed MPU-sheet row (`kind: 'comboInfoOnly'`, `excludeFromChopping: true`),
  never appears in Chopping Block at all, per the user's explicit
  instruction after initially discussing giving it its own toggle logic.
  Ore Replicator and Dual Plasma Upgrader still each appear individually and
  normally in Chopping Block.
- **Combo/dependency locks** (`data.dependencies` in the data file): Ore
  Wash↔Acid Plant, Leviathans' Wrath↔Atlantis Remnant, and Hoarded
  Treasure/Electric Overdrive→Alien Invasion are **all the same simple
  rule** — every item in `requires` is locked while `neededBy` is owned,
  full stop, regardless of how many alternatives exist. **RESOLVED, not
  true OR semantics**: an earlier pass of this tool implemented the Alien
  Invasion entry as real OR logic (either Hoarded Treasure or Electric
  Overdrive choppable while the other remains, only the last one locks) —
  this was this agent's own inference, never confirmed by the user at the
  time. The user has since explicitly confirmed the real rule: **both stay
  locked as long as Alien Invasion itself is owned**, regardless of whether
  one or both of its listed items are present — Alien Invasion has to be
  gone first. Fixed by flipping that entry's `requiresAny` to `false` (no
  code change needed — `isLocked()`'s non-`requiresAny` branch already does
  exactly this). The `requiresAny` mechanism itself is kept in the code in
  case a genuinely different future combo needs real OR semantics, but as
  of now no dependency in the table actually uses `requiresAny: true`.
  Per the user, no more dependencies are coming beyond these three — this
  is the complete list, not a placeholder.
- **Capgrader chain-order lock (added 2026-09-11, same day, after the user
  hit this live)**: reported via a real screenshot — with both 8-Ball
  Refiner (range 10B-50B) and Blocky Refiner (30B-100B) in the base,
  Chopping Block was suggesting 8-Ball first, but 8-Ball is only useful as a
  bridge toward Blocky's range, so chopping it first would strand Blocky.
  Fixed by adding a second lock rule in `isLocked()` alongside the combo/
  dependency table: any of the 23 real capgraders (same hardcoded
  `CAPGRADER_NAMES` list as `capgrader-generator.js` — **keep both lists in
  sync if capgraders are ever added**) is locked while a *higher-range*
  capgrader is also in the base, ranges parsed from `TycoonDatabase`'s own
  `range` field (`"10B-50B"` → `{lo, hi}` via a small suffix parser mirroring
  the Calculator's unit table). **Excludes finisher capgraders** (Toybox
  Express, Rubik's Polisher — range floor 0, ceiling ≥ 1e15) in both
  directions, matching `capgrader-generator.js`'s own `isFinisherRecord()`
  distinction: they cascade on top at the end regardless of chain order, so
  they neither lock normal capgraders nor get chain-locked themselves.
  Verified with a smoke test extending the existing ad hoc suite (8-Ball
  locked while Blocky owned, unlocks once Blocky is gone, finishers exempt)
  and live in a real browser reproducing the exact screenshot scenario.
  Scanners (`SCANNER_NAMES` in capgrader-generator.js) are **not** included
  in this ordering — the user's report was specifically about capgraders,
  and scanners aren't part of the same sequential range chain the same way.
  **Immediate follow-up, same day**: per the user, Nuclear Upgrader and
  Chartreuse Collider are also finisher-type — added both to
  `CAPGRADER_NAMES` plus a new `MANUAL_FINISHER_NAMES` override in
  `isFinisherCapgrader()`, since Nuclear Upgrader's real range (0-50K) is
  far too low to trip the automatic ceiling-based finisher check (matches
  capgrader-generator.js's own reasoning for excluding both from its search
  entirely — they apply a destructive/overriding effect, Nuclear
  effect/Overcharged, instead of bridging cleanly). Verified neither locks
  other capgraders nor gets chain-locked itself, live and via the smoke
  test.
- **RESOLVED (2026-09-11, same day, right after the user reviewed the first
  build): the "Other" category and the Fidget Pack naming question are both
  fixed, not open anymore.** Checked both items' real obtainment text
  directly in the Upgraders sheet rather than guessing:
  - **Cupcake-inator**'s real source text is `"From code \"release\""` — a
    code-redemption item. Moved from `other`/`Other` to
    `merchant-achievement-rebirth`/**`Codes`** (a new 4th subcategory there,
    `MAR_ORDER` in `mpa-chopping-block.js` now `['Merchant', 'Achievement',
    'Rebirth', 'Codes']`).
  - **Portable Spinner**'s real source text is `"Buy Fidget Pack"`, and
    **Ore Rocker**'s is `"Buy the Horsey or Fidget Pack"` — confirming they
    share the same real pack. Moved Portable Spinner from `other`/`Other` to
    `p2w`/**`Fidget Pack`** (joining Ore Rocker), and added it to
    `data.packs['Fidget Pack']` in `data/mpu-stats.js` for consistency (the
    per-item `category`/`subcategory` fields are what actually drives
    rendering, but keeping `packs` accurate too). "Fidget Spinner" (the
    user's original name) never existed in the database — Portable Spinner
    was the real item meant.
  - With both moved out, the `other`/`Other` category is now empty and no
    longer renders at all (the existing `bucket.size === 0` skip in
    `renderCategories` handles this automatically — no code change needed
    beyond moving the two items' data). Chopping Block is back to exactly
    the user's original 3 categories, now with Codes as a 4th subcategory
    under Merchant/Achievement/Rebirth.
  - Verified via the same Playwright smoke-test approach as the initial
    build: category list is now exactly `['Crate Upgraders', 'Merchant /
    Achievement / Rebirth Upgraders', 'P2W Upgraders']`, Codes contains only
    Cupcake-inator, Fidget Pack contains both Ore Rocker and Portable
    Spinner.
- **P2W pack membership and crate/merchant/achievement/rebirth category
  membership are baked into `data/mpu-stats.js` at build time** (`category`/
  `subcategory` fields per item), derived once from
  `data/items.index.json`'s `sourceSheets` plus the hand-built `packs` map —
  not re-derived at runtime. If the source database's sourceSheets ever
  disagree with this later, these fields need manual re-checking, not
  automatic re-sync (consistent with the data file's own one-time-seed
  nature).
- **Keep/chop session state**: "kept" is transient, in-memory only
  (`keptThisRun`, reset each time "Figure out what's getting chopped" is
  pressed) — not persisted. Only the ownership toggle and per-item inputs
  persist to `localStorage` (`tycoon-sim-2:mpa-tool:v1`), matching the
  user's own description: a kept item naturally reappears on the *next run*
  because it's still the worst MPA among what's owned, with no separate
  "already decided" memory needed.

**Testing**: `tests/mpa-chopping-block.test.mjs` now exists, wired into both
`npm test` and `npm run check` (added same day, per the user's explicit
request — matches Capgrader Generator's own history of gaining tests in a
later pass). Same DOM-stub-plus-`new Function('globalThis', src)` technique
as `tests/capgrader-generator.test.mjs`, exercised through
`globalThis.__mpaDebug` (same hook pattern as `capgrader-generator.js`'s
`__cgDebug`). Covers: every choppable item has a finite reference MPA;
Lambda's best-is-1-use / Incremental's and Tiki's best-is-most-uses
behaviors; Dragon's Breath's and Portable Spinner's best-is-Looped behavior;
Dream Machine's formula against every tabulated row plus an untabulated
effect count; the simple dependency locks (Ore Wash/Acid Plant, Leviathans'
Wrath/Atlantis Remnant); the Alien Invasion dependency's confirmed-correct
"both stay locked until Alien Invasion itself is gone" behavior (see the
combo/dependency entry above — this used to be tested as OR semantics before
the user's correction); the capgrader chain-order lock (8-Ball Refiner/
Blocky Refiner) and finisher-exclusion (Toybox Express, Rubik's Polisher,
Nuclear Upgrader, Chartreuse Collider) in both directions; the
keep-advances-to-next-worst decision-loop behavior; Incremental-removes-all
vs. Lambda-removes-one chop semantics; and that `renderList`/
`renderCategories`/`renderDecision` don't throw against the stub. Also
smoke-tested live in a real browser via Playwright for every fix in this
session (`playwright` is available as a global npm package in this
environment, not a project dependency — `chromium-1194` under
`/opt/pw-browsers`, not `/opt/pw-browsers/chromium` despite what
`PLAYWRIGHT_BROWSERS_PATH` might suggest, needs the versioned subdirectory
path passed as `executablePath` explicitly): list sorts correctly by both
MPA and MPU, all 4 categories and 28 subcategories render (18 crates with
tracked items — not all 19 crates have one, e.g. nothing tracked comes from
Basic — 3 M/A/R plus Codes, 6 packs), select-all/toggle/run/keep/chop/back
all work with no JS errors (only expected 404s for the known-missing icons
below).

**Missing icons**: `docs/MPA_TOOL_MISSING_ICONS.md` lists 12 — mostly the
already-known nature-update items, plus one pre-existing gap (MVP Shiny).
The tool renders a blank slot for these (`onerror`-hide, same pattern as
`luck-crate-generator.js`), never breaks.

**Files**: `data/mpu-stats.js` (new), `mpa-chopping-block.js` (new, all tool
logic), `docs/MPA_TOOL_MISSING_ICONS.md` (new), `index.html` (nav button +
WIP badge, new `#mpa-tool` section with 3 inner views, new script tags for
both the data file and the tool script), `app.js` (`activeTool` widened to
5-way, `wipBadge` generalized to show for `'builder'` or `'mpa'` with a
tool-specific title, `mpa-tool:activated` event), `styles.css` (new
`.mpa-*` rules, reusing `.capgrader-*`/`.luck-*` classes wherever they
already fit rather than duplicating).

**Next suggested steps**: confirm the 3 flagged items above with the user
(Portable Spinner's looped-config handling, the OR-dependency interpretation,
the Fidget Pack/Whimsical Palace naming mismatch); write the permanent
automated test file; get the more complete combo/dependency list the user
said they'd send; fill in the missing icons.

## 2026-09-11 follow-up: fixed "Rubix's Polisher" typo at the source

The resync entry below flagged this as a still-open, harmless-for-now
spreadsheet typo and left it to the user. They asked to fix it immediately
after, so it's done — no longer an open item in AI_TASKS.md.

Found **two** occurrences of the misspelling once actually searched for (the
resync entry only mentioned the one in Ore SizeHeight): `Ore SizeHeight!K10`
and **`MPU!B78`** — the MPU sheet is the one the user said had just been
filled out with "each item now instead of just some," so the same typo had
propagated there too. Both cells shared the same shared-string index (321,
"Rubix's Polisher"); a correctly-spelled "Rubik's Polisher" already existed
elsewhere in the shared-string table at index 1421 (used by e.g. `Capgrader`
sheet), so the fix was repointing both cells' `t="s"` value from `321` to
`1421` — zero shared-string content touched, same targeted-zip-entry-patch
method as the resync entry's Dream Machine fix. Verified via `grep -o
't="s"><v>321</v>'` across all `xl/worksheets/*.xml` that those were the only
two references before patching, and that both now read "Rubik's Polisher" in
`data/items.generated.js` / `data/ore-size-height.index.json` after
resyncing. `database:sync`/`database:lint` still clean (390 records, 0
errors), same three test files still pass.

## 2026-09-09 Calculator tool

Fourth nav tool (`data-tool="calculator"`), same self-contained-IIFE pattern
as the other three. A scientific calculator that understands the game's
number abbreviations as input, so players can type things like `1.5B * 1.54`
directly instead of typing out full digit strings. (A prior session shipped
this without writing a handoff entry — this entry backfills that gap.)

**Files:** `abbrev-calculator.js` (new — the whole engine + UI wiring),
`index.html` (`#calc-tool` section, nav button, `#help-content-calculator`),
`styles.css` (`.calc-*` rules), `app.js` (`activeTool` extended to a 4th
value, `toolNavItemCalculator`, `calcToolSection`), `help.js`
(`contentByTool.calculator`).

**Engine:** hand-written tokenizer + recursive-descent parser (no libraries —
same zero-dependency philosophy as the rest of the site). Grammar:
`expression := term (('+'|'-') term)*`, `term := power (('*'|'/') power)*`,
`power := unary ('^' power)?` (right-associative), `unary := '-' unary |
primary`, `primary := number | '(' expression ')' | 'sqrt(' expression ')'`.
Numbers can carry an attached suffix (`1.5B`, `24sx`, case-insensitive) using
the **same suffix scale already used elsewhere on the site**
(K/M/B/T/Qd/Qn/Sx/Sp/Oc/No — see `app.js`'s `abbreviatedRate` and
`capgrader-generator.js`'s money-parsing `powers` map). As of the 2026-09-11
MPA tool work above, this file's own `UNITS`/`DISPLAY_UNITS` tables were
separately extended to Dc/Ud/Dd/Td (up to 1e42) — not yet reflected in
`app.js`/`capgrader-generator.js`'s copies, so those three places have now
drifted out of sync. If the scale needs to grow again, update all of them
together (or better, finally centralize this into one shared table — it's
duplicated in at least three files now). Uses plain `Number` (floating point) throughout —
deliberately NOT arbitrary-precision, per an explicit user choice
("good-enough estimates" over "exact precision at any scale") since ~15-16
significant digits covers every real in-game comparison and stays consistent
with how the rest of the site already does money math.

**UI decisions, several changed after initial ship based on user feedback:**
- **No equals/submit button.** Originally had one; removed because the result
  already live-updates on every keystroke, making it redundant for anything
  that parses successfully. Its only real job (surfacing an error for a
  genuinely broken expression) is now handled by a **600ms debounce timer**:
  typing keeps re-evaluating silently (clearing the result on failure without
  showing an error, since mid-typing is naturally often incomplete), and only
  shows an error banner if the expression is *still* invalid once typing
  pauses. Enter still forces an immediate check, bypassing the debounce.
- **Abbreviated result always shows exactly 2 decimal places** (`9.00`,
  `2.31B`), not trimmed — an explicit user correction from an earlier
  trailing-zero-trimming version.
- **Full number formatting** needed manual digit-string construction for
  values >= 1e21, since `Number.prototype.toFixed` silently switches to
  exponential-string behavior at that scale in the JS spec and can't be
  coerced back to a fixed decimal string normally — see
  `formatFullNumber`'s `toExponential(15)` + manual digit-padding logic if
  this needs touching.
- Button grid inserts text at the input's cursor position (not just
  appending), so typing and clicking can be freely mixed.

**Real hidden-attribute bug found and fixed — likely to bite again if not
watched for:** `.calc-tool { display: flex; ... }` had no `.calc-tool[hidden]
{ display: none; }` companion rule, so setting `calcToolSection.hidden = true`
(the mechanism every tool section uses to hide itself) did nothing — the
Calculator visually leaked in underneath whichever tool was actually active.
The other three top-level tool sections (`.workspace`, `.capgrader-tool`,
`.luck-tool`) already had this companion rule; `.calc-tool` was just missed
when it was added. **Root cause, worth remembering for any future new
section:** an author stylesheet's `display:` rule beats the browser's default
`[hidden] { display: none }` rule for elements toggled via the `.hidden`
property/attribute, *unless* you add an explicit `<selector>[hidden] {
display: none; }` override — CSS specificity alone doesn't save you here,
author-origin rules just win the cascade. **Any new top-level section (or any
other element ever toggled via `el.hidden = ...`) needs this companion rule,
or it will silently render even while "hidden."** (The MPA tool above already
got this right — worth double-checking if it or any future tool ever adds
another top-level section.) While tracking this down, the same class of bug
was found completely unrelated to the Calculator: `#capgrader-results`
(Capgrader Generator's results table) had never had this override either, and
`setResultsMode(false)` (the "Edit setup" button) never even toggled its
`hidden` attribute in the first place — so the previous run's table stayed
visible underneath the setup panels after clicking "Edit setup." Both fixed
together (commit `d8bc12b`): added the two missing `[hidden]` CSS overrides,
added `resultsEl.hidden` toggling to `setResultsMode`, and gave
`#capgrader-results` a default `hidden` attribute in the markup so it's not
visible before the first Generate either.

**Not covered:** no automated tests exist for this tool (same as Luck
Simulator) — verified manually in-browser only (parenthesized/power/sqrt
expressions, abbreviation parsing, division-by-zero error path, debounced
auto-error, button-click input path, >=1e21 full-number formatting).

**Commits:** `fbd6f24` (initial tool), `d8bc12b` (the hidden-attribute fixes
above — bundled with an unrelated capgrader-generator.js fix since both were
found in the same debugging session).

## 2026-09-11 Database resync (nature-update workbook)

User supplied a new `Tycoon Sim Database.xlsx` (a real in-game content
update — nature-themed items — not just a correction pass). Replaced
`data/Tycoon Sim Database.xlsx` and re-ran the full pipeline
(`sync-database.mjs`, `report-database-conflicts.mjs`,
`build-database-index.mjs`, `lint-database.mjs`,
`build-crate-luck-data.mjs`), then diffed every record against the prior
workbook (kept as a scratch backup during the session, not committed) rather
than trusting the sync tool's own conflict check alone.

**36 new item-variant rows, 0 removed:** Butterfly Dropper, Floral Frenzy,
Nature's Promise, Canyon Refiner, Carrot Mutator, Clover Garden, Fragrant
Passage, Fungal Enhancer, Glistening Falls, Holophase Device, Lush
Beanstock, Ore Pollinator, Potted Flower, Reclaimed Sanctum, Sunflower
Fields (2 new crates too: Floral, Nature — 19 crates / 113 crate items now,
up from 17/101). **None of these have icons yet** in `icons/items/` — that's
expected (icons come from the user separately, per the 2026-08-27 Luck tool
entry's process), not a database problem, just a follow-up if the user wants
these new items to render properly in the Luck Simulator.

**Two real data-entry errors found and fixed in the workbook itself** (both
were previously non-existent — confirmed by diffing against the prior
workbook, not just current-state lint):
1. **Dream Machine (Base), `Upgraders` sheet row 38** had "Limited Uses: 3"
   while the same item on the `Merchant` sheet (row 33) and every other
   Dream Machine variant on both sheets said "Limited Uses: 1". The row
   directly above it (Whimsical Palace Shiny, row 37) legitimately has
   "Limited Uses: 3" — this had clearly bled down into Dream Machine's row.
   User confirmed: fixed to 1. This was the sync tool's own
   `DATABASE_CONFLICT` check catching a real error, not a false positive.
2. **Krakatoa's "Rejected" ore size** on the `Ore SizeHeight` sheet came in
   blank in the new workbook; the prior workbook had it as `1.95` (paired
   with Acceptable `[2.4, 1.8]`). This is not something the conflict
   checker catches on its own (it's a single-sheet omission, not a
   cross-sheet disagreement) — only caught by diffing against the prior
   workbook. User confirmed: restored to `1.95`.

**How the xlsx was patched — do this again if editing this specific
workbook, not openpyxl full-rewrite:** the workbook is ~21-23MB, almost
certainly because of embedded images/rich content beyond plain cell data.
A test edit via `openpyxl.load_workbook(...).save(...)` silently shrank the
file to ~344KB — it does not round-trip whatever makes this file large, so
a full openpyxl rewrite is a silent-corruption risk for this specific file.
Caught before committing (compared file size before/after) and reverted.
The safe method that was actually used: unzip the `.xlsx`, edit only the
target cell in the specific `xl/worksheets/sheetN.xml`, then
`zip <file>.xlsx path/to/sheetN.xml` to patch just that zip entry in place
(verified afterward that the full entry list — 555 files — was byte-for-byte
unchanged except the two patched sheet XMLs). For the Dream Machine fix this
was even simpler than writing new XML: cell `N38` referenced shared-string
index 1697 ("...Limited Uses: 3..."); shared-string index 1690 already held
the exact desired text ("...Limited Uses: 1..." — same string other Dream
Machine variants already use), so the fix was just repointing `N38`'s
`<v>1697</v>` to `<v>1690</v>`, touching zero shared content. The Krakatoa
fix changed an empty self-closing `<c r="P13" s="188"/>` to
`<c r="P13" s="188"><v>1.95</v></c>` — a plain numeric cell, no shared string
involved.

**Pre-existing issues, NOT introduced by or fixed in this resync — flagging,
not touching:**
- `tests/engine.test.mjs` still fails on the already-documented "Base
  Portable Upgrader is 1x2; expected 2x1" geometry mismatch (see the
  2026-08-27 "Unrelated pre-existing issue" entry further down this file).
  Confirmed Portable Upgrader's size is identically `1x2` in both the old
  and new workbook, so this update didn't cause or change it either way.
  `tests/validate-planner.js`, `tests/regression-fixtures.test.mjs`, and
  `tests/capgrader-generator.test.mjs` all still pass standalone.
- **`Ore SizeHeight` sheet spells it "Rubix's Polisher"** (with an x) in its
  restrictions table, while every other sheet (and the item database) has
  the correct "Rubik's Polisher" — present in both the old and new workbook,
  so not new. This is the *same* typo class the 2026-08-27 session already
  found and fixed once in `capgrader-generator.js`'s hardcoded
  `CAPGRADER_NAMES` list, just in a different location (the source sheet
  itself this time). Currently harmless — nothing in `engine/*.mjs` cross-
  references `oreSizeHeight.restrictions[].name` against the item database
  yet (only `engine/database-lint.mjs` reads it, and only for
  acceptable/rejected presence, not name-matching) — but worth the user
  fixing at the source before anything is ever built that looks restrictions
  up by name.

**Verification run, all clean after the two fixes above:** `database:sync`
(0 cross-sheet conflicts), `database:lint` (`valid: true`, 390 records, 0
errors/warnings), `build-crate-luck-data.mjs`, `node --check` on every
engine/script file, and the three passing test files above.
`data/item-geometry-worksheet.json` and
`scripts/build-item-geometry-worksheet.mjs` (still deliberately uncommitted
per the "Things NOT to change" section below) were not touched.

## 2026-08-27 Capgrader Generator: automated test coverage

**Capgrader Generator can now move to Resolved in AI_TASKS.md** — it had zero
automated tests (only manual browser checks and ad hoc Node scratch scripts);
now `tests/capgrader-generator.test.mjs` exists and is wired into both
`npm test` and `npm run check`.

**How it tests a plain (non-module) browser script:** `capgrader-generator.js`
now permanently exposes `globalThis.__cgDebug = { legalPool,
optimizeCapgraderChain, getToggle, capgraderNames, additiveNames,
scannerNames, lunarName }` right after `optimizeCapgraderChain`'s closing
brace (previously this hook only ever existed in a throwaway scratch copy —
see the 2026-08-26 entry below). The test file loads `data/items.generated.js`
+ `capgrader-generator.js` together via `new Function(...)` against a minimal
hand-written `document`/`localStorage`/`CSS` stub (no jsdom dependency added —
this project is intentionally zero-npm-dependency) and pulls the hook off
`globalThis`. The stub works because every real DOM lookup in the file is
either `?.`-guarded or behind an `if (!el) return`, so a stub where
`document.querySelector`/`querySelectorAll` always return
`null`/`[]` is enough to let the module finish loading (and reach the
`__cgDebug` assignment) without a real HTML parser — verified by reading the
whole file's DOM-touching code paths, not assumed. **Do not remove the
`globalThis.__cgDebug` line — the test suite depends on it and it's a no-op in
production** (browsers just get one extra harmless global property).

**What's covered:** `legalPool()` (empty pool, fully-owned pool including
finisher/non-finisher split, owning exactly one item doesn't leak others in),
and `optimizeCapgraderChain()` (a regression band of $1.25T-$1.4T for the
"own everything, Dropper starting at $10" scenario from the 2026-08-26 quality
fixes below — catches all three fixes regressing at once; finishers only ever
cascade at the very end, never as a mid-chain bridge, per quality bug #2; an
empty pool returns the starting value unchanged without throwing).
**Not covered:** the UI rendering/event-wiring code (`renderDropperRows`,
`renderToggleLists`, etc.) — the DOM stub deliberately makes those all no-op,
so this is search-logic coverage only, not a full UI test. Scanner
hit-chance formulas (`predictSweepHitChance`/`predictAzureHitChance`) also
aren't unit-tested directly yet, only exercised indirectly through the
regression scenario when scanners are legal moves.

**Real bug found and fixed while writing these tests — significant, not
cosmetic:** `CAPGRADER_NAMES` had `"Rubix's Polisher"` (with an x) but the
actual database item is **"Rubik's Polisher"** (a Rubik's Cube reference) —
the typo silently meant this item could never be toggled on in the tool at
all, since `legalPool()` only ever looks up names from that hardcoded set.
Fixed in `capgrader-generator.js` (both the `CAPGRADER_NAMES` entry and the
comment above `isFinisherRecord`). Measured impact on the "own everything,
Dropper starting at $10" scenario: **$604B with the typo (old, broken) vs.
$1.33T fixed** — more than 2x, because Rubik's Polisher is a *finisher*
(range 0 - 1 septillion, single-use) that cascades on top of Toybox Express
at the very end of the chain (see quality bug #2 below), so losing it wasn't
just "one fewer option," it silently cut off one of exactly two
finisher-cascade multipliers the search could ever apply. If this tool felt
like it was underperforming for players who owned Rubik's Polisher, this was
why. The $1.25T-$1.4T regression band in the new test file already reflects
the fixed number — do not "fix" the test back down to ~$604B-780B if this
typo ever creeps back in; that would mean the bug regressed, not the test.

## 2026-08-27 Luck / Crate Simulator tool

Third tool added to the hamburger nav (`data-tool="luck"`), same
self-contained-IIFE pattern as the other two. Simulates the real crate-opening
luck system: player types in Unbox/Shiny/Mythic Luck + Roll Speed + Unbox
Slots, picks a crate, and sees exactly which item/variant they can pull and
the real combined odds, plus an expected "how long to get it" estimate.

**This was built from a real, previously-undocumented game system** — the
user supplied the actual production Lua (`UnboxUtils.GetLuckWeights` /
`RollFromCrate`) mid-conversation, and separately every formula was
cross-checked directly against the real cell formulas in `data/Tycoon Sim
Database.xlsx`'s "Crates" sheet (extracted from the raw worksheet XML via
`engine/xlsx-reader.mjs`'s `XlsxArchive`, not guessed from computed values) —
this is not reverse-engineered speculation, it was verified byte-for-byte
against the sheet's own "Odds" column for every item in the Basic Crate
before any UI was built. **If this math is ever touched again, re-verify
against the sheet the same way rather than trusting comments alone** — see
the git history around this date for the exact verification commands.

**Files:**
- `scripts/build-crate-luck-data.mjs` (new) — parses the Crates sheet's
  repeated blocks (crate-name row → `Cost:` row → header row → item variant
  rows grouped by Name → totals row → next crate) directly, emits
  `data/crate-luck-data.generated.js` (`globalThis.CrateLuckData`, same
  loading pattern as `data/items.generated.js`). **This is a generated file,
  never hand-edit it** — everything in it is mechanically derivable from the
  spreadsheet (unlike `data/item-geometry-worksheet.json`, which needed real
  manual judgment calls). Re-run the script if the workbook's Crates sheet
  changes. Watch for the same off-by-one parsing trap that bit this session
  twice: candidate "crate name" rows that are actually legend cells (`"Shiny
  Luck"`/`"Mythic Luck"`/`"Unbox Luck"` labels, or the bare numbers `20`/
  `100`/`1` beneath them) — both are explicitly excluded now, but if the
  sheet's legend layout ever changes, this parser needs re-checking against
  the raw rows, not just trusted.
- `luck-crate-generator.js` (new) — all the tool's logic: `getLuckWeights()`
  is a direct line-by-line port of the user's Lua (sort ascending by weight,
  power-formula raw chance, then the 30%-floor lock-and-rescale `while` loop
  — confirmed this loop runs on *every* calculation, not just rare edge
  cases). `variantChance()` implements the Shiny/Mythic combination math
  (verified algebraically that all 4 variants' probabilities sum back to the
  item's total chance). `timeToConfidence()` implements the "how long"
  popup math: `cycleTime = RollSpeed + 1.1` (the `1.1` is a **hardcoded**
  game constant — the forced wait after the roll animation — not
  player-adjustable), `attemptsPerSecond = UnboxSlots / cycleTime`,
  `attemptsNeeded = ln(1-confidence) / ln(1-p)`; verified this exact formula
  shape against the "Stats for Nerds" sheet's "How Long?" section (75%'s time
  is exactly 2× the 50% time, matching `ln(4)/ln(2)=2` precisely) and its
  exact constant (reproduced its reference row's 50/75/90% day-outputs to 5
  significant figures using this formula, including the `+1.1`).
- `index.html` — new `#luck-tool` section (crate-select view + crate-detail
  view, toggled by JS, not a dialog), new `#luck-item-dialog` for the
  per-item popup, new nav button, new `<script>` tags for the generated data
  file and `luck-crate-generator.js`.
- `app.js` — `activeTool` extended from a 2-way (`'builder'|'capgrader'`) to
  a 3-way (`+'luck'`) toggle; same `applyActiveToolUi()`/`loadActiveTool()`/
  `setActiveTool()` functions, just widened. The WIP badge is now `hidden`
  whenever `activeTool !== 'builder'` (was `=== 'capgrader'`) so it doesn't
  leak into the new tool either.
- `icons/items/` (new, ~402 PNGs) — copied from the user's local
  `Documents\Tycoon Sim\Icons` folder, matched by the existing `{Name}
  {Variant}.png` filename convention (Base has no suffix). **Explicitly NOT**
  using the user's real crate icons (`Documents\Tycoon Sim\Crates`) — the
  user said those aren't visually consistent — crate buttons use a small
  inline-SVG custom crate icon generated per-crate instead
  (`crateIconSvg()` in `luck-crate-generator.js`).
- `styles.css` — new `.luck-*` section. The item grid sits inside a
  `.luck-crate-frame` — a plain CSS-only decorative crate background (no
  imagery), per the user's request for a generic frame rather than a themed
  illustration.

**Icon gap — resolved, not actually missing assets.** The initial pass found
14, then (after a `data/Tycoon Sim Database.xlsx` resync — see below) 5,
name+variant PNG lookups with no match in `icons/items/`. Every single one
turned out to be a **naming mismatch between the DB and the icon file**, not a
genuinely missing icon — fixed by renaming the icon files to match the DB
names exactly (not by editing the database): `Advanced ore Upgrader Shiny`→
`Advanced Ore Upgrader Shiny` (case), `Effecient Furnace`→`Efficient Furnace`,
`Quad Rays`→`Quad Rays Upgrader`, `Robotic Apocalypse`→`Robot Apocalypse`,
`Percision Ore Scanner`→`Precision Ore Scanner`, `Enforced Upgrader Mythic
Shiny`→`Enforced Upgrader Shiny Mythic` (variant word order). One went the
*other* direction: the DB's own name is `Rubik's Polisher` (not `Rubix's` —
this session initially misspelled it and had to revert), so the icon file's
original name was already correct. **0 of 101×~2.5 variant icon lookups
missing now** (verified by diffing every crate item+variant name against
`icons/items/`'s actual file list, not just spot-checking) — don't
re-introduce the `onerror`-hide-on-missing fallback logic in
`luck-crate-generator.js` as a sign something's still broken; it's
now-unused defensive code kept for whenever new items/icons are added later
and inevitably drift again.

**2026-08-27 database resync (same session, right after the above):** the
user supplied a corrected `Tycoon Sim Database (10).xlsx` mid-session
specifically because "i had some names wrong" (the Rubik's/Precision/etc.
typos above turned out to be from the *previous* workbook version — the new
one doesn't have them, though the *icon files* still needed the renames
above regardless of workbook version, since the file names themselves were
never sourced from the workbook). Copied over `data/Tycoon Sim Database.xlsx`
(sha256 verified to match the source exactly), then re-ran `npm run
database:sync`, `npm run database:index`, and `node
scripts/build-crate-luck-data.mjs` — 727 rows, 0 cross-sheet conflicts, 354
unique item variants, same 17 crates / 101 crate items as before. Re-verified
the luck math still reproduces the sheet's own Odds column exactly after the
resync (same Basic Crate check as the original verification pass).

**2026-08-27 "Any Crate" items — placeholder text, and a real merge-pool
bug fixed, one false alarm chased down.** All three found via the user
actually using the tool and reporting a screenshot, not from more static
formula reading:
1. `build-crate-luck-data.mjs` was pulling `effects` straight from the
   Crates sheet's own "Other Effects" column, which for many items (complex
   furnace formulas etc.) is literally the placeholder text `"Refer to the
   'Stats for Nerds' Page"` rather than real content. Fixed by cross-referencing
   `data/items.generated.js` (already has the real resolved formula text via
   `sync-database.mjs`'s `parseStatsForNerds`) whenever the Crates-sheet text
   is that exact placeholder — see the `resolvedByKey` lookup added to the
   script. Verified 0 of 254 item variants still carry the placeholder.
   `luck-crate-generator.js`'s item popup also no longer renders a bare "N/A"
   line for `otherStats` when that's literally all the sheet has.
2. **Real bug, fixed — went through 3 iterations, this is the correct one.**
   Any-crate items' odds should be pinned to a **fixed target raw chance**
   (e.g. Freedom Dropper = 1/150,000,000), calibrated once against Basic
   Crate — that number must reproduce exactly at 1x Unbox Luck no matter
   which crate you're viewing, but at any *other* luck value it legitimately
   varies crate to crate, since luck reshuffles odds based on an item's rank
   within whichever crate's own rarity ladder it's merged into. Confirmed
   directly by the user after two wrong intermediate attempts:
   - **Attempt 1 (wrong):** merged the any-crate item's raw stored weight
     unchanged into whichever crate was open, renormalized against that
     crate's own total. Made the "fixed at 1x luck" property crate-dependent
     too, which the user flagged with a screenshot (Tropic showing ~1/1B vs
     Basic's expected ~1/150M at the same settings).
   - **Attempt 2 (wrong):** overcorrected to *always* compute against Basic
     Crate's weights regardless of which crate was open — fully fixed at
     every luck value, not just 1x. Also wrong: at that point the user
     clarified with a screenshot that at high luck (~202, not the "152" first
     quoted — that was a value mixup, verified by solving for the luck that
     reproduces the user's exact numbers) the *real* odds do differ by crate.
   - **Correct version (current code):** `targetRawChance(name)` recovers the
     item's fixed target chance by reversing the original Basic-Crate
     calibration (`weight / (basicCrateTotal + weight)`). `computeChances()`
     then re-derives a fresh equivalent weight for whichever crate is
     currently open (`target * thatCrate'sNativeTotal / (1 - other active
     any-crate items' target chances)`) before feeding it into that crate's
     own `getLuckWeights` pool — mirroring the sheet's own `J15 = K15 *
     SUM(otherWeights) / (1 - ...)` pattern, just re-evaluated per crate
     instead of hardcoded to Basic. Verified: exactly 1/150M (Freedom) and
     1/183M (Twitchium) in *every* crate at 1x Unbox Luck; genuinely
     different (e.g. 1/1.05M in Basic vs 1/1.11M in Tropic) at luck 202,
     matching the user's real spreadsheet numbers at that luck value. If this
     needs touching again: the invariant to preserve is "identical across all
     crates at exactly 1x Unbox Luck, allowed to diverge at any other luck."

**Still open, not bugs:**
- No exact rarity color palette exists in the spreadsheet (checked: no
  per-cell fills or conditional-formatting rules on the Rarity column) — a
  reasonable default game palette was used (`RARITY_COLORS` in
  `luck-crate-generator.js`). Swap this out if the user has an exact palette.
- No automated tests written for `luck-crate-generator.js` beyond manual
  browser verification (same gap as `capgrader-generator.js` originally had).

## Last agent

Claude (Claude Code / Sonnet 5)

## What I changed

This session covered two large threads of work:

**1. Engine/UI bug fixes (committed, see `474a1c7 "QoL changes"`):**
- Fixed ore-value rounding to match the game's actual ceil-after-every-step
  behavior (was previously only rounding for display, or not at all in some
  paths). See AI_DECISIONS.md for the details and the distribution-drift bug
  it uncovered and fixed along the way.
- Restored delete-confirmation and save-overwrite-confirmation dialogs for
  saved loadouts (had been silently lost when the loadout-folder persistence
  feature was added).
- Fixed item click vs. drag-select conflict in the build grid (clicking an
  item to inspect it was broken by the box-select feature capturing the
  pointer).
- Made saved-loadouts folder access persist across reloads (IndexedDB-backed
  directory handle) instead of re-prompting for folder access constantly.
- Item-library category tabs now clear the search box but keep tier/variant
  filters and sort mode when you switch categories (previously cleared all
  three).
- The "Save Base" dialog no longer auto-fills a name from the current plan
  title.
- Fixed a git identity/push problem for the user — see AI_DECISIONS.md
  "Git identity."

**2. Item geometry worksheet (NOT yet committed — see "Uncommitted work"
below):**
- Built `data/item-geometry-worksheet.json` from scratch via a one-time
  generator script, then iterated heavily on its coordinate model with the
  user before locking it down as hand-maintained. Full spec lives in the
  worksheet's own `_readme` block and in AI_DECISIONS.md.
- Fully audited and fixed the `droppers` and `furnaces` sections (formatting
  bugs, wrong formula conditions, mislabeled fallback cases, a couple of real
  90°-facing-direction bugs — see AI_DECISIONS.md).
- Started auditing `upgraders` (86 items) — bulk pre-filled, several
  individually verified/fixed. See AI_TASKS.md "In progress" for exactly
  which ones and what's left.
- Set up this `.claude/agents/` handoff system per the user's request, based
  on a design worked out in a separate ChatGPT conversation (shared link in
  chat history if you need the original source).

## Files changed (uncommitted) — UPDATED 2026-08-27, corrects a stale entry below

As of the end of the 2026-08-27 session, **everything is committed and pushed
to `origin/main`** (last push: commit `b91278e`, "Add Luck/Crate Simulator
tool and resync database") **except** these two, which stay uncommitted at
the user's explicit, repeated request (do not "helpfully" commit them):
- `data/item-geometry-worksheet.json`
- `scripts/build-item-geometry-worksheet.mjs`

`git status` should show only those two as untracked and nothing else
modified. If it shows more than that, something changed after this note was
written — trust `git status`/`git log` over this file in that case, and
update this section rather than leaving it stale again (see the paragraph
below this one for what NOT to do).

The paragraph that used to be here (something like "AGENTS.md move,
scanner-beam thread, files changed for that session") was from a much
earlier session and had gone stale — corrected in place per this file's own
instructions rather than deleted, so you know this section can and does drift
if not actively maintained every session.

## Important decisions

See `AI_DECISIONS.md` — don't duplicate that content here, just know it
exists and read it before making a call that might contradict something
already settled.

## Current problem / state

Nothing is actively broken. Three tools now exist (Base Builder — WIP badge,
Capgrader Generator, Luck/Crate Simulator — see the dated sections below for
each). The item-geometry worksheet is a working document mid-audit, not a
bug, and is **still not wired into the engine** — none of that geometry data
affects actual gameplay simulation yet (see AI_TASKS.md's "revamp" entry).

## Next suggested task

**Immediate: the user is about to test the Luck/Crate Simulator further and
give feedback in a new chat** — read the "2026-08-27 Luck / Crate Simulator
tool" section (and the two sections right after it) in full before touching
`luck-crate-generator.js` or `scripts/build-crate-luck-data.mjs`, especially
the "Any Crate items" fix's 3 attempts — the correct invariant is "identical
odds across all crates at exactly 1x Unbox Luck, allowed to diverge at any
other luck value." No automated tests exist for this tool yet; consider
adding some if it gets touched again, since it's had zero regression coverage
beyond manual browser checks so far.

Once that's stable, fall back to the general upgraders audit (AI_TASKS.md →
"In progress"), item by item, the same way droppers and furnaces were done:
user provides in-game
observations/screenshots, agent proposes the JSON, user pastes it in or asks
the agent to write it directly.

## Scanner beam hit-chance testing (current focus)

**Why:** the live engine currently approximates every scanner as one flat
`scannerHitChance` percentage — not a real simulation of the beam passing
over the ore. This work is building the real replacement: model the beam's
actual geometry/motion, design an in-game test to measure real hit rates,
fit a formula from that data, put it in the scanner's `formulaOverride`. See
AI_DECISIONS.md "Beam shape vocabulary" and "effects text field" entries, and
AI_TASKS.md "Scanner beam geometry + hit-chance experiment design."

**Beam shapes settled and in the schema** (see AI_DECISIONS.md for full
field definitions): `sweep` (linear, oscillates via `sin()`, `speed` in
cycles/second) and `rotate` (straight line pivoting at constant angular
velocity, `speed` in degrees/second). Both units were deliberately chosen
after back-and-forth with the user — `speed` should always be a *raw* stat
(no pre-converted ms values), and for `sweep` specifically it must be
cycles/second, not degrees, since nothing is actually rotating (this was
tried and explicitly reverted once — don't re-suggest degrees for `sweep`).

**4 real scanners, what's known about each:**
- **Azure Scanner** — confirmed `rotate` type. Source: `scanner.CFrame =
  scannerCF * CFrame.Angles(math.pi * os.clock(), 0, 0)` → `speed: 180`
  (π rad/s = 180°/s).
- **Two more scanners** (names not yet confirmed by the user — could be
  Ancient Scanner, Star Scanner, and/or Precision Ore Scanner, in some
  order) are `sweep` type, using `left:Lerp(right, alpha)` where
  `alpha = (math.sin(t * K) + 1) / 2`:
  - One with `K = 6.5` → `speed ≈ 1.0345` cycles/second.
  - One with plain `sin(t)` (`K = 1`) → `speed ≈ 0.159` cycles/second.
  - **Which named scanner is which is not yet confirmed** — ask the user
    before writing these into the worksheet under a specific item name.
- **4th scanner's movement code has not been shared yet.**

**Test methodology designed (not yet run):** one-variable-at-a-time sweeps
across ore size, beam speed, beam width, conveyor speed — separately for
`sweep` vs `rotate` since they're different motions — plus a "step 0" check
that was added after realizing neither beam moves at constant speed across
its own range: for `sweep`, ore's *lane position* across the belt likely
matters (beam lingers at the edges, moves fastest through the middle); for
`rotate`, ore's *radial distance from the pivot* likely matters (linear speed
= angular speed × radius, so near-pivot points get more effective dwell
time). Recommended to test whether position matters at all before committing
to the full 4-variable matrix. No actual test data has been collected yet —
this is 100% still in the design phase.

## Things NOT to change

- Do not re-run `scripts/build-item-geometry-worksheet.mjs` — it will refuse,
  by design, but don't try to work around that refusal either.
- Do not add a `decorations` section back to the worksheet — removed
  intentionally, decorations have no geometry to track.
- Do not "helpfully" commit `data/item-geometry-worksheet.json` or
  `scripts/build-item-geometry-worksheet.mjs` without the user explicitly
  asking — this is a large, actively-changing hand-edited file and the user
  has been deliberate about what goes into each commit.
- Do not reintroduce a center-anchored beam/zone coordinate convention —
  explicitly settled on edge-anchored. See AI_DECISIONS.md.

## 2026-08-16 follow-up

- Updated `data/item-geometry-worksheet.json` for Krakatoa: the Mythic and
  Shiny Mythic `geometryOverrides.zone.confirmed` entries retain the base
  rectangle's x, y, and width while using a length of `0.5`. JSON parsing and
  focused assertions for both overrides and the unchanged base zone passed.
- Added a shared tile-mapping note to `_readme.fields.dropSpawn`: integer
  coordinates are tile boundaries and decimal coordinates are inside their
  containing tile; this is a typical geometry interpretation and ore size can
  affect overlap. No item geometry values changed.

## 2026-08-26 Capgrader Generator: beam-search quality fixes

**This is the current active thread — read this section fully before
touching `capgrader-generator.js` again.** Builds directly on the
"Capgrader Generator tool" section below (same file, same architecture) —
read that first for context if you haven't already, then come back here.
Nothing from this session is committed; `capgrader-generator.js` is still
untracked (`git status`).

Across one long back-and-forth with the user (manually working out example
chains by hand and comparing against the tool's output), the beam search in
`optimizeCapgraderChain` went through several real quality bugs, each found
by the user noticing the tool's suggested chain was worse than something they
could build by hand. Fixing all of them took a Dropper starting at $10 from a
$185B best chain to a $1.32T best chain (all figures below are for that same
"own everything" scenario, useful as a regression check if this code is
touched again):

1. **Terminal scoring dominated by proximity-to-cap, not real value**
   (fixed first). The old `terminalScore` weighted "how close the chain
   landed to whatever capgrader happened to end it" at `ratio * 1e7` and
   `log(value) * 1e4`, vs. only `time * 10` and `length * 1` — a difference
   of literally hundreds of thousands to one. This meant the search would
   happily tack on extra unnecessary opening additives to nudge the final
   ratio a fraction of a percent closer to a cap, at a real cost of extra
   time/length for no practical benefit. Fixed by dropping both weights to
   `100` so they're light tie-breakers instead of dominant terms.
2. **Wide-range, single-use "finisher" items getting burned as mid-chain
   bridges instead of saved for the end** (the big one). Toybox Express
   (range 0 – 1 octillion) and Rubix's Polisher (range 0 – 1 septillion) are
   both `limitedUses: 1` but legal at almost any value, so the search would
   opportunistically grab one to bridge between two narrower-range
   capgraders — "spending" a huge once-only multiplier on a small base value
   instead of the largest value the chain ever reaches. Worse: the terminal
   score (even after fix #1) still favored ending on a narrow-range item
   like Blocky Refiner (cap ~100B) over ending on Toybox, because a chain
   could never look "in-band" against Toybox's astronomically large ceiling
   — so the search would rank a mathematically-worse chain higher. Fixed by
   introducing `isFinisherRecord()` (range floor 0 AND ceiling ≥
   `FINISHER_CEILING_THRESHOLD = 1e15`) to split `legalPool()`'s capgraders
   into `pool.capgraders` (normal) and a new `pool.finishers` field. The main
   beam search only ever sees `pool.capgraders`, so it's forced to find a
   *normal*, reusable item to do any mid-chain bridging (e.g. 8-Ball
   Refiner, Anchor Upgrader). After the main search picks its best terminal,
   every owned/eligible finisher is cascaded on top in ascending `mainStat`
   order (order between finishers never matters — they're all floor-0, so
   none can block another). This alone went from $448B to $780B-ish, and
   made the search dramatically faster (no longer wasting depth budget
   deciding whether to spend a finisher early).
3. **Depth-aligned beam-search pruning unfairly kills "many small steps"
   chains in favor of "few big steps" chains at the same step count** (the
   subtle one — found by the user's own hand-built chain beating the tool's
   output even after fix #2). Simply raising the old depth/width caps (12/
   400) did NOT help — tested up to depth 22 / width 20,000 (~7s) with zero
   change in output, proving it wasn't a search-breadth problem. The real
   issue: comparing a state that took 5 small-multiplier steps (e.g. Orbital
   Messenger ×3 → Anchor → Martian Tech) against a state that took 2
   big-multiplier steps (2× Anchor Upgrader), AT THE SAME NOMINAL DEPTH
   NUMBER, always penalizes the "many small steps" branch — it simply hasn't
   caught up in value yet at that comparison point, so it gets pruned before
   it has a chance to pay off later. Fixed by batching same-item reuse into
   ONE depth-step in `candidateMoves`: whenever an eligible item is still
   legal after applying it, the search also offers applying it again (2x,
   3x, ... up to `BATCH_REPEAT_CAP = 20`) as additional candidate moves at
   that same step, instead of spending a separate depth-step per repeat.
   This freed up enough real depth budget that depth/width could actually be
   turned back DOWN (18/8000 → 10/2000) while still beating the old, much
   more expensive search — $1.32T in ~0.4s vs. the old $1.32T-adjacent
   result taking 2+s.
4. **Known remaining gap (~1-1.5%), not fixed, don't be surprised by it.**
   Exhaustive offline testing (way beyond what's practical to ship, e.g.
   depth 25 / width 10,000+) found a true ceiling around $1.348T for the
   same test scenario — the shipped search lands around $1.32-1.33T. This is
   an inherent limitation of depth-aligned beam search with a greedy
   per-step score, not a bug: fully closing it would need a genuine
   architecture change (real best-first/A* search with a lookahead
   heuristic, not just parameter tuning or move-batching). Flagged as a
   possible future task, not started — the user was satisfied with the
   current state ("that is perfect") and this doc should not imply it's
   broken.

**How this was debugged (useful if the search regresses again):** the
in-browser tool result was cross-checked against a standalone reimplementation
in a scratch script for early hypothesis-testing, but the DEFINITIVE checks
(especially for #3, where the reimplementation and the real file initially
disagreed) were done by injecting a debug hook directly into a scratch COPY of
the real file — `globalThis.__cgDebug = { legalPool, optimizeCapgraderChain,
getToggle, capgraderNames, additiveNames, scannerNames, lunarName }` inserted
right after `optimizeCapgraderChain`'s closing brace, then driving it from
Node with a minimal `document`/`localStorage`/`CSS` stub and
`data/items.generated.js` loaded via `new Function('globalThis', src)`. This
is the reliable way to test this file's search logic in isolation without a
browser — a hand-written reimplementation of the algorithm is NOT a safe
substitute for testing against the real file, since it's easy to
accidentally fix a subtly different algorithm than the one actually shipped.

## 2026-08-27 Capgrader Generator tool + scanner formula finalization

Read this section for the tool's original architecture/gotchas (hamburger
nav, `CAPGRADER_NAMES` hardcoding, fire-effect safety logic, persistence key,
etc.) — still accurate. The section above is the most recent work on top of
this same file.

### 1. Scanner hit-chance formulas — finalized, see AI_DECISIONS.md

The scanner beam geometry/hit-chance work referenced in the "Scanner beam
hit-chance testing" section further down this file is **done and superseded**
by a full write-up in `AI_DECISIONS.md` under **"Scanner hit-chance
formulas"** — read that section, not the older notes below it in this file
(kept for history, but stale). Short version: a real kinematic simulator
(`scripts/scanner-hit-simulator.mjs` + `scripts/scanner-hit-report.mjs`)
replaced in-game testing entirely; closed-form formulas were derived and
validated (arcsine formula for sweep scanners — Ancient/Precision Ore
Scanner; guaranteed-above-1.25-else-linear-expected-value for Azure, whose
beam turned out to rotate in a *vertical* plane, not the ground plane, after
several rounds of correction against real screenshots). These formulas are
now the ones powering the Capgrader Generator's scanner math (see below) —
**do not use the engine's old flat `oreSize/4` fallback for scanners in any
new work**, use these derived formulas instead.

### 2. New tool: Capgrader Generator

Added a second full tool to the site (previously just the grid-based Base
Builder), reachable via a new hamburger menu (top-left, fixed position) —
plan approved and built in one continuous session, see
`.claude/plans/cheerful-splashing-dewdrop.md` for the original approved plan
(useful for the *why*, but the actual implementation has since evolved past
it in several UI-polish rounds — trust the live code over that plan file for
current layout details).

**Files:**
- `capgrader-generator.js` (new) — all of the tool's logic. Self-contained
  IIFE, plain script (no ES modules), reads `globalThis.TycoonDatabase`
  directly, same pattern as `app.js`/`planner-core.js`.
- `index.html` — hamburger button + nav `<dialog>` (`#tool-nav-menu`), new
  `#capgrader-tool` section, `<script src="capgrader-generator.js">`.
- `app.js` — `activeTool` state (`'builder' | 'capgrader'`), persisted the
  same way `plannerMode` is (`localStorage`), toggles which top-level section
  is visible and swaps the header title/hides Build-Builder-only controls
  (Load/Save Base, Build/Generation mode, Clear grid, tile count) when in
  Capgrader mode.
- `styles.css` — hamburger icon, nav dialog, toggle pills, 3-column layout
  (main + 2 sidebars), result tables.
- `tests/validate-planner.js` — one assertion count bumped (`&times;` count)
  for the new close button.

**What it does:** pick one or more droppers (each with its own owned
variant), toggle which capgraders / additive upgraders+Lunar Landing /
capgrader-scanners you own (with optional owned-count and owned-variant
refinement per item), hit Generate, and it runs a beam-search (ported/trimmed
from `engine/optimizer.mjs`'s `optimizeCapgraders` — a real algorithm that
already existed for the CLI's `solve-cap` command but was never wired into
the browser) to find the best chain toward the final capgrader's range
ceiling, shown as a per-dropper table: item, variant, value before/after,
cumulative time, cumulative length.

**Key architectural decisions/gotchas — read before touching this code:**
- **The runtime database (`data/items.generated.js`) does NOT have the
  `sourceSheets` membership array** that `data/items.index.json` has (it only
  has one `sheet` field per record). Capgrader-sheet detection can't be done
  from loaded data at runtime — `capgrader-generator.js` hardcodes the exact
  list of 23 real capgraders (`CAPGRADER_NAMES`) instead. If new capgraders
  get added to the database later, this list needs a manual update.
- **Items appear multiple times in the database** if listed on multiple
  sheets (e.g. a capgrader also cited on `Crates` for its source) — produces
  near-duplicate records differing only in `sheet`/`row`. `variantsFor()`
  dedupes by variant, picking the first match. If dropdowns or variant
  checkboxes ever show duplicates again, this is almost certainly why.
- **Nuclear Upgrader and Chartreuse Collider are excluded entirely** from the
  capgrader list — they apply destructive effects (Nuclear effect,
  Overcharged) that would kill the ore before the chain finishes, and this
  tool doesn't model removing them.
- **Fire-effect safety logic**: a `hasFire` flag on the search state starts
  `true` if the chosen dropper is `Fire Crystal Dropper`, becomes `true` after
  `Ore Flamethrower`, and `false` after `Oasis Cleanser`. `Oil Well` only
  destroys ore when `hasFire` is true *and* the ore's value is inside Oil
  Well's own range (5K–65K) — outside that range it's a no-op regardless of
  fire. The search only offers Oil Well while on fire if it can insert Oasis
  Cleanser immediately before it; `Ore Flamethrower` itself is only offered
  as a candidate when Oasis Cleanser is owned, so the search can't paint
  itself into a dead end.
- **Additive Upgraders & Lunar Landing are opening-only** (per real game
  rules — normal upgraders can't bridge capgrader ranges) — modeled as a
  greedy loop before the capgrader beam search starts, matching
  `optimizeCapgraders`'s existing opening-phase logic almost exactly.
- **Multi-dropper support**: pick 2+ droppers, get a spread-ratio warning
  (informational past ~3x, stronger past ~10x) since a wider value gap needs
  more capgraders/space to cover in one shared chain. Each dropper's chain is
  computed independently against the same owned-item pool (same physical
  base, same ownership).
- **Persistence**: dropper rows + all toggle state (owned/count/variants)
  save to `localStorage` (`tycoon-sim-2:capgrader-tool:v1`) on every change
  and restore on load — settings survive both tool-switching and full page
  reloads.
- **Layout is 3 columns side by side** (not stacked): main column
  (Droppers → Capgraders → Results), then Additive Upgraders & Lunar Landing,
  then Capgrader Scanners, each sidebar column sticky-positioned. This went
  through several rounds of user feedback (was originally one flat list, then
  2-column, now 3-column) — if asked to change grouping again, confirm
  exactly which panel goes where before assuming.
- **A real CSS trap was hit twice**: `[hidden]` on an element does nothing if
  a class selector elsewhere sets `display` on that same element (equal
  specificity, author stylesheet wins over the UA default). Both
  `.workspace` and `.capgrader-tool` needed explicit `.foo[hidden] {
  display: none; }` overrides. **Watch for this pattern on any future
  hide/show toggle** — if `.hidden = true` doesn't visually hide something,
  check for a competing `display` rule first.
- **The preview/browser-testing tool in this environment aggressively caches
  `app.js`/`capgrader-generator.js` across reloads** — a `force: true`
  navigate is sometimes NOT enough to see a real code change reflected. If a
  browser-based test looks like it's ignoring your latest edit, open a brand
  new tab (`tabs_create`) rather than trusting a reload, or cache-bust the
  script `src` with a throwaway `?v=` query param temporarily.

**Not yet done / possible next steps:** no automated test coverage for
`capgrader-generator.js` itself (only manual browser verification so far,
several rounds of it, all passing). Given how much this tool changed over
the session, a next session should re-verify the full flow once
(dropper → toggles → generate → results) before trusting it blindly.

### 3. Unrelated pre-existing issue, do not fix as a surprise tangent

`npm run check`'s `engine.test.mjs` fails with `Base Portable Upgrader is
1x2; expected 2x1` — traced to the `data/items.generated.js` database resync
run earlier this session (`npm run database:sync`, done to freshen the
ore-size sheet), unrelated to the Capgrader Generator work. `AI_DECISIONS.md`
already documents Portable Upgrader's facing-direction size swap as a known
issue in the hand-maintained geometry worksheet; this generated-database
copy apparently disagrees with a hardcoded test fixture now. Flagging, not
fixing — needs its own investigation.

## 2026-08-16 database workbook replacement

- Replaced `data/Tycoon Sim Database.xlsx` in place with the user-supplied
  `C:\Users\andre\Downloads\Tycoon Sim Database (9).xlsx`. This was the only
  `.xlsx` in the repository and is the documented authoritative database path.
- Verification: source and target SHA-256 both equal
  `A4A454AB8102A09BC1563D6F701A20A840403E1826E5F4B916CE627DBE6379D9`; the
  copied workbook opens as an XLSX ZIP with all required core entries and a
  parseable `xl/workbook.xml` containing 16 worksheets. `npm.cmd run
  verify:commit` passed (database lint: 354 records, zero errors/warnings;
  code checks, planner tests, engine tests, regression fixtures, and clean
  state check all passed).
- No generated files were changed and no commit or push was made. Existing
  unrelated uncommitted geometry-worksheet and handoff-system work remains.
