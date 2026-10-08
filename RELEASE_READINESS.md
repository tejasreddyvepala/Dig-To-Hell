# DIG TO HELL — RELEASE READINESS

Audit date: 2026-10-07 · Auditor: Claude · **Fix phase: 2026-10-07** (every issue below carries its fix and evidence in its Status line; the original audit findings are kept as written)
Evidence: audit in `playtest-captures/release-audit/`; fixes in `playtest-captures/release-fix/` (full-run logs R6/R7/R8, first-5-min log F1, cross-browser and layout sheets, before/after shots)

## Release Target

- First release: browser / HTML5, desktop.
- Primary portal: CrazyGames-style submission. Later: Poki, GameDistribution, Yandex Games, itch.io, own website.

## Current Build

*Updated after the fix phase. The audit-time state is in git history / the Executive Assessment below.*

- Version: **1.0.0** (bumped in the format check), shown in game under "Start over". Last commit `77b2eea`. **Everything since Visual Pass 2 plus the whole fix phase is uncommitted.**
- Stack: TypeScript + Vite 6, Canvas 2D world + DOM UI. 12.0k lines in `src/`. The only packages added are two font packages (`@fontsource/bungee`, `@fontsource/rubik`; bundled assets, OFL).
- Build:
  - `npm run build` → `dist/`: relative paths (`vite.config.ts` `base: './'`), 363 kB JS + 45 kB CSS + 4 woff2 (~71 kB), favicon. No external requests. No dev menu.
  - `npm run build:test` → `dist-test/` (tester build with the DEV menu).
- Saves: `digtohell_v6` (every 5 s, unload/pagehide, tab hidden), `digtohell_v6_prev` (rolling last-good), `digtohell_v6_backup_*` (unreadable saves, newest 2), `dth_ach`, `dth_tour`, `dth_best`, `dth_settings`, `dth_acc2`, `dth_meta` (analytics), `dth_dev` (tester only).
- Content: 14 geology layers to 1,000 m and a full ending. 12 construction projects, 4 worksites, 3 machines, 6 player tools, 6 crew-gear tiers, 50 achievements, guided tour.
- Release layer: portal adapter (`platform.ts`, no SDK yet), analytics hooks (`analytics.ts`, no-op), loading screen, fullscreen, favicon, release kit in `release/`.
- Not present (by decision): ads, a real analytics sink, a portal SDK implementation, a post-ending prestige loop.

## Fix Phase Summary (2026-10-07)

- **Fixed and verified:** all 5 critical blockers except the unreproduced hang, which is mitigated and needs one human soak. The portal adapter, release assets, browser coverage, fonts and cheat menu are also done, as are every first-session signal issue, the money stall, pacing, the frame hitches, and 7 of the 9 P3s.
- **Three complete fresh-save runs to the end card** (6×, optimal bot): no hang, no errors. The final run (R8) reached 1,000 m at 51.0 min with the longest stretch between purchases 81 s.
- **Production build verified** from a sub-folder in Chromium 154, Firefox 132 and WebKit 18.2 (Playwright): 0 errors, 0 failed or external requests. Layout checked at 800×600, 1024×600, 1280×720, 1920×1080 and 390×844.
- **Still needs a human (no automated tool can do these):**
  1. a 30–60 min real-time soak on a quiet machine;
  2. a 10-minute pass in real Safari 16.6 and Firefox;
  3. an audio listening pass;
  4. one real playthrough to confirm about 60 minutes to the Gates.
- **Still needs a decision:** which portal first (then its SDK behind `platform.ts`, verifying current requirements); the version number; the post-ending goal (deferred).

## Executive Assessment

The core loop works end to end, and the first five minutes are genuinely busy. Dig → cart → yard → truck → build → sell → reinvest, and a fresh player built the Yard at 0:48, sold the first property at 2:16 and blasted the Work Chamber at 4:15.

Systems are rich, and the world visibly changes:
- the bridges fill with crew;
- the machines arrive;
- the layer colours shift as you go down;
- the Hell finale lands.

Technically the build is clean: no console errors in play, good save sanitisation against bad values, and an offline cap.

It is **not ready for a portal submission**. The blockers are mostly release-engineering and portal work, not gameplay:
1. **No portal integration:** no SDK, no gameplay start/stop or loading events, no mute on ad/blur.
2. **Asset paths break under a sub-path:** the build uses absolute `/assets/` paths, which fail on any host that serves the game from a sub-folder (itch.io, GameDistribution, most CDNs).
3. **No release art:** no thumbnails, covers or icon.
4. **Progress lost in background tabs:** a tab sent to the background earns nothing while hidden, which hurts an idle game.
5. **Saves are wiped silently:** a corrupt save, or one from a newer build, is overwritten with a fresh game.
6. **UI collides at small embed sizes:** at 800×600 the top-left button bar overlaps the site tabs and the cash.
7. **Unexplained hang/crash in long sessions:** a long-session tab hang/crash was seen three times during automated runs and not yet reproduced (see Performance).

Gameplay-side, the biggest retention risks are first-session noise:
- the tour offer sits on the dig floor until answered;
- red BOTTLENECK pulses cover most of the panel;
- a stream of trophy banners and toasts.

There's also a mid-game money stall around 500 m, and pacing hasn't been re-measured since Crew Gear was added.

## Release Score

| Area | Score | Why |
|---|---|---|
| Core gameplay | 8/10 | (was 7) Complete physical loop; the tab keeps working in the background; no cash droughts; ending exists. |
| First 5 minutes | 7/10 | (was 6) One red tag at a time, batched banners, tour and track story after the first sale. Feel still unconfirmed by a human. |
| Retention | 7/10 | (was 6) Mid-game stall gone (instalments); about 51–60 min arc; still no goal after the ending (deferred). |
| Economy | 7/10 | (was 5) Pacing measured over 3 full runs and tuned; instalments conserve totals exactly; many overlapping multipliers remain. |
| UI/UX | 7/10 | (was 5) No overlap down to 800×600, ☰ menu, clear 'Your pickaxe / Your crew', collapsed finished rows, visible pile overflow. Panel still dense mid-game. |
| Visual quality | 8/10 | (was 7) Fossils revealed in lit caverns, yard framing on wide screens, intro readable, release art produced. |
| Audio | 6/10 | (was 5) Silenced on hidden tab and ad (hold-based); still never judged by ear. |
| Save reliability | 8/10 | (was 5) Backups + rolling copy + player notice; clamps; background-tab save. |
| Performance | 7/10 | (was 6) Geology stalls 4× lower; 60 fps in Hell at 1×; 3 full runs without a hang. Rare thread-starvation spikes on a loaded machine are unproven either way. |
| Portal readiness | 7/10 | (was 2) Relative paths, adapter, ad pause, assets, bundled fonts, no cheats, analytics hooks, 3 engines verified. Missing: the chosen portal's SDK and its checklist. |

**OVERALL RELEASE READINESS: 72/100** (audit: 54/100)

## Critical Blockers

### [P1] Absolute asset paths break any sub-path hosting

Category: Build / portal
Observed: `dist/index.html` loads `/assets/index-*.js` and `/assets/index-*.css`. Vite's default `base: '/'` is in use and there is no `vite.config`.
Why it matters: itch.io, GameDistribution and many portal CDNs serve the game from a sub-folder. Absolute paths then 404, which means a blank screen.
How to reproduce: `npm run build`, then serve `dist/` from a sub-path (e.g. `http://host/game/`). The JS and CSS 404.
Recommended fix: add `vite.config.ts` with `base: './'`, rebuild, and test from a nested folder and from a zip upload.
Release blocker: YES
Status: FIXED (2026-10-07). Added `vite.config.ts` with `base: './'`; `dist/index.html` now loads `./assets/…`. Verified: the build served from `http://localhost:8811/games/dig-to-hell/v1/` loads with 0 failed requests and 0 console errors. Note: opening `index.html` straight from disk (`file://`) still won't run (browsers block module scripts there); every portal serves over http, so that's fine.

### [P1] No progress while the tab is in the background

Category: Core / idle
Observed: `main.ts` advances the sim by `min(maxDt = 0.1 s, frame gap)` per animation frame. Browsers stop `requestAnimationFrame` in hidden tabs, so the time hidden is simply lost. Offline catch-up (`offlineAdvance`) only runs at page load. There is no `visibilitychange` handler.
Why it matters: portal players tab away constantly. For an idle game with crews and machines, "I came back and nothing happened" breaks the premise, and it's inconsistent with closing and reopening, which does pay out offline time.
How to reproduce: open the game with miners, switch tabs for 2 minutes, come back. Depth, rubble and cash have barely changed. Reload instead and an offline report appears.
Recommended fix: on `visibilitychange` → visible, run the same `offlineAdvance` for the hidden duration (with its existing cap and report). Also pause or suspend audio on hidden.
Release blocker: YES
Status: FIXED (2026-10-07). `main.ts` has a `visibilitychange` handler:
- on hidden: save, silence audio (`holdAudio('hidden')`) and call `gameplayStop()`;
- on visible: simulate the hidden time with `offlineAdvance(secs, true)` (new `full` flag: the crew digs even under 30 s; still capped at 8 h), rebuild the face if the floor moved, snap the camera, reset the dig-speed readout, and show the 'While you were away' card when the tab was away for 60 s or more.
- Skipped during the finale, after the ending, and during an ad pause.

Verified: a 2-minute hidden tab on a 10-miner save went 121 → 165 m (it stopped at the next find, as offline does), delivered 90 blocks, raised cash from $500 to $977 and showed the report card. No errors.

### [P1] Corrupt or unknown-version save is silently replaced by a fresh game

Category: Save
Observed: `loadState()` returns 0 when JSON parsing fails or `sanitize()` rejects the version. The fresh state then autosaves over the old key within 5 s. Both cases were tested:
- `corrupt-json` → "overwritten with fresh save (depth 0)";
- `version: 7` → overwritten with version 6, depth 0.

Why it matters: a crash mid-write, a storage quirk, or rolling back a release after a schema bump would irrecoverably destroy a player's mine.
How to reproduce: set `digtohell_v6` to `{"version":6,"cash":12` (or `{"version":7,...}`), reload, wait 5 s, read the key.
Recommended fix:
1. Before overwriting, copy any unparseable or unknown-version payload to `digtohell_backup_<timestamp>` (keep the last 2).
2. Never auto-save over a key you failed to load until the player confirms "start fresh".
3. Write saves as write-temp-then-swap, or keep a rotating `_prev` copy.

Release blocker: YES
Status: FIXED (2026-10-07). In `state.ts`:
- An unreadable save (bad JSON, or a version this build doesn't know) is first copied to `digtohell_v6_backup_<time>`; the newest 2 backups are kept.
- `saveState()` keeps a rolling `digtohell_v6_prev` copy of the last good save, refreshed at most once a minute. Loading falls back to it before starting fresh.
- The player is told what happened: a SAVE RESTORED card, or SAVE COULDN'T BE READ, which says the old save was kept.
- Both resets ('Start over' and 'Start a new mine') also clear `_prev`.

Verified (`savesafe.mjs`):
- corrupt save with a rolling copy → restored to 222 m and $4,321, backup kept;
- corrupt save, no rolling copy → new game, backup kept, card shown;
- a `version: 7` save → new game with the v7 payload kept as a backup;
- a good save → no card, no backup.

I didn't use write-temp-then-swap: localStorage.setItem replaces the value in one step, so the rolling copy covers the torn-write case.

### [P1] Unexplained tab hang/crash during long automated sessions (not reproduced)

Category: Performance / stability
Observed: three separate incidents during long bot runs:
1. "Target closed": the renderer died during a 70-game-min run.
2. The memory sampler froze after its first sample.
3. A 6× fresh-save run hung around 35 game-min / 500–580 m: `Runtime.callFunctionOn` timed out, so the main thread was blocked for more than 180 s.

A dedicated 4-minute watchdog on a similar save (575 m → 887 m, 6×, switching sites) did **not** reproduce it. The worst frame was 411 ms and the JS heap rose 16 → 70 MB. During the same period two of the user's own Chrome processes were at about 100% CPU, so starvation is possible.
Why it matters: if real, a freeze is a P0. It's unproven, so it's P1 until ruled out.
How to reproduce: unknown. Candidate: a long 6× run from a fresh save (`audit_human.mjs 6 2400`).
Recommended fix:
- Repeat a 60–90 min real-time soak on an idle machine with the Performance panel recording.
- Add a dev-only long-frame logger.
- Check unbounded growth: `glints` (≤ 40k entries), `geo` segment canvases (≤ 90), `rockwall` tiles (≤ 80), `crewPops`, `bufs` in `lava.ts`.

Release blocker: NO (was YES until ruled out; see status)
Status: NOT REPRODUCED; mitigations in place (2026-10-07). Downgraded from blocker pending one human soak.
- A complete fresh-save run at 6× from 0 m through the finale to the end card (49 game-min, `playtest-captures/release-fix/R6_fullrun_6x.log`) had **no hang**: every 60 s state poll answered (a 60 s watchdog was armed) and there were no errors. The JS heap ranged 12–79 MB, rising and falling with GC, with no upward trend after 20 min. So the caches are bounded, not leaking.
- At normal speed the Hell layer runs a steady 60 fps (p99 33 ms, worst 50 ms, 0 frames over 150 ms in 30 s with 40 crew and 3 machines).
- The 3 earlier incidents happened while two other Chrome processes held about 100% CPU, so starvation remains the likeliest explanation.

Added: a dev-only long-frame log (`__dig.longFrames()`), a heap probe (`__dig.heap()`) and a geology paint profile (`__geoProf`) for future soaks. The biggest stall source, geology painting, is fixed (see 'frame hitches').
A second full run (R7, 61 game-min) also finished with no hang, but logged one **8.4 s** gap around 600 m while other Chrome instances were starting on the same machine. Follow-up with per-stage frame timing (`__dig.longFrames()` now records the previous frame's sim/render/panel split and the heap): in quiet repros the rare 150–320 ms gaps (a few per minute at 6×) land on a **different** stage each time (world, crew, layer gems, even the simulation), all normally under 10 ms, with **no heap change**. That pattern is the browser thread being starved (load average 3.5–6.4 on 8 cores: Chrome at 40%, VS Code, Avast scanning). It isn't GC and it isn't game code. The game's own worst stage in a normal frame is about 40 ms (DOM panel refresh or crew drawing).
Remaining: one 30–60 min human session on a normal, quiet machine before submission (watch for any freeze).

### [P1] UI overlaps at small embed sizes (800×600)

Category: UI / responsive
Observed: at 800×600 the top-left tile bar (Sound/Economy/Trophies/Guide/Help) sits on top of the MINE/YARD/BUILD tabs and covers the cash readout ("…0 m" visible, "$0" hidden). At 1024×600 it's tight but OK.
Evidence: `release-audit/t_res_sheet.png`.
Why it matters: portal iframes are often around 800–1000 px wide. Cash is the main number.
How to reproduce: set the window to 800×600 and load.
Recommended fix: below about 1,000 px, move the tile bar into the side panel header or a ☰ menu, and let `#nav` start after it. Ensure `.top` (cash) is never covered.
Release blocker: YES (portal embed sizes)
Status: FIXED (2026-10-07). New `topbar.ts` places the site tabs in JS, centred in the world view but always to the right of the corner bar and inside the stage (no longer drifting over the panel/cash).
- When both don't fit (≈ under 1,000 px wide, and on phones), the corner bar collapses into one ☰ Menu button that drops down the same buttons with labels. It shows a red dot when Trophies or Economy want attention.
- The layout re-runs on resize, font load and tab-size change. The tabs never move while the menu is open.

Verified (`res.mjs`): no corner/tab overlap and no horizontal scroll at 800×600, 1024×600, 1280×720, 1366×768 and 390×844. All three tabs are visible at every size, including mobile, where they were previously cut off. Open-menu screenshot checked.

## Portal Blockers

### [P1] No portal SDK integration layer

Category: Portal
Observed: no SDK code. There are no hooks for loading start/finish, gameplay start/stop, ad-break pause/mute, or happy-time / achievement events. Audio has no global "portal mute" path beyond the settings mute.
Why it matters: CrazyGames, Poki, GameDistribution and Yandex all require some subset of these. Verify current platform requirements before submission.
How to reproduce: n/a (absence).
Recommended fix: add a thin `platform.ts` adapter (no-op by default) with:
- `loadingStart/Done`
- `gameplayStart/Stop`
- `pauseForAd/resume`: freeze `devSpeed`, suspend the AudioContext, stop music scheduling
- `happyTime`
- `saveData/loadData`: so saves can be routed to a portal data module if required

Call it from `main.ts` and the finale. Then implement per-portal SDKs behind it.
Release blocker: YES (for any portal)
Status: FIXED, adapter only (2026-10-07). No SDK is bundled, as planned. New `platform.ts`: a no-op-by-default `Portal` adapter (`setPortal()`) with `loadingStart/loadingDone`, `gameplayStart/gameplayStop` (idempotent) and `happyTime`, plus `pauseForAd()/resumeAfterAd()`.

Call sites:
- loading around boot;
- gameplayStart when digging starts, on load of a started game, and on tab return;
- gameplayStop on tab hidden, ad, and the end card;
- happyTime on every property sale and on finishing the game.

Ad pause freezes the simulation (`simPaused()` → dt 0) and holds audio via the new `holdAudio(reason)` in `audio.ts`, so user clicks can't resume sound during an ad.

Verified (`adtest.mjs`): during a 3 s ad, depth and the cart timer stayed frozen and the AudioContext was suspended (it stayed suspended after a click). After the ad, both resumed. Remaining: a per-portal SDK implementation behind `setPortal` once the portal is chosen (verify the current SDK version and required events). Save routing to a portal data API is not done: saves still go to localStorage via `state.ts` only.

### [P1] No release assets (icon, thumbnails, cover, screenshots, descriptions)

Category: Release assets
Observed: `<link rel="icon" href="data:,">`, and the production page still requests `/favicon.ico` (404 logged as a console error). There is no logo, loading screen, thumbnails, cover, store copy, credits or privacy note.
Why it matters: portals reject or bury submissions without them.
How to reproduce: run `vite preview`; the console shows the favicon 404.
Recommended fix: produce the asset list in "Release Assets" and add a real favicon. Verify current portal image sizes before producing.
Release blocker: YES
Status: FIXED (2026-10-07, final art). All release art now comes from Tejas's own art:
- **Covers** from the key art (`release/source/key_art_1672x941.png`) via `release/tools/make_covers_from_keyart.py`: landscape 1920×1080 and 1280×720, square 800×800 (centred on the logo), portrait 800×1200 (full art, sky extended above in its own colours, lava mirrored below).
- **Icon** from the icon art (`release/source/icon_art_1254x1254.png`): `icon_1024/512/256/128`. Checked down to 64 px: the pickaxe and title still read. Also a 180 px `apple-touch-icon.png` linked from `index.html`, served at 200 from a sub-folder build with 0 console errors.
- The browser-tab favicon now uses the icon art too (`favicon.ico` 16/32/48 + PNGs, links versioned `?v=2`; the old pickaxe SVG was removed at Tejas's request).
- Unchanged: loading screen, meta description, version label, 6 gameplay screenshots, `STORE_LISTING.md`.

The key art is 1672 px wide (the 1920 cover is a ×1.15 upscale); for larger portal banners, re-export the art bigger and re-run the script. Verify each portal's current image sizes before submission.
- **Covers now use Tejas's key art** (`release/source/key_art_1672x941.png`); `release/tools/make_covers_from_keyart.py` builds:
  - landscape 1920×1080 and 1280×720 (straight resize; the art is 16:9);
  - square 800×800 (full-height crop centred on the logo);
  - portrait 800×1200 (the full art with the logo at about 92% of the width, sky extended above in the art's own colours, lava mirrored below).
- Store icon: placeholder renamed `icon_512x512_PLACEHOLDER.png` until Tejas's GPT icon arrives.
- Unchanged: favicon (`public/favicon.svg`), inline loading screen, meta description, in-game version label, 6 gameplay screenshots, `STORE_LISTING.md`.

The key art is 1672 px wide, so the 1920 cover is a small upscale; for bigger portal banners, get a larger export and re-run the script. Verify each portal's current image sizes before submission.
- Favicon (`public/favicon.svg`; the 404 is gone), inline loading screen, meta description, and an in-game version label.
- `release/images/`: covers 1920×1080, 1280×720, portrait 800×1200, square 800×800, and a 512×512 icon. Composed from real 2×-resolution game captures with the Bungee wordmark.
- `release/screenshots/`: 6 gameplay shots at 1920×1080 with the UI hidden (early mine, gold, opal, Hell, yard, build).
- `release/STORE_LISTING.md`: title, short and long descriptions, controls, tags, age/content notes, a privacy-note draft, credits and font licences.
- `release/tools/`: the capture and cover scripts, to regenerate them.

Verify each portal's current image sizes before submission. Weakest asset: the icon (pickaxe + wordmark; fine at 512, the text will be illegible below about 128 px).
Done:
- real SVG favicon (`public/favicon.svg`, pickaxe on a lava gradient); the production console no longer logs the favicon 404;
- inline boot/loading screen (`#boot` in `index.html`, shows before the CSS/JS arrive, fades out when the loop starts);
- meta description and theme-color;
- version shown in game under 'Start over' (`v${package.json version}` via `__VERSION__`).

Verified: the sub-folder build loads with 0 failed requests and 0 console errors.
Next: release art (covers, thumbnails, icon) and store copy.

### [P2] External Google Fonts dependency

Category: Portal / build
Observed: `index.html` loads Bungee and Rubik from `fonts.googleapis.com`.
Why it matters: some portals or CSPs disallow third-party requests, and offline or slow networks fall back to Impact/system UI, which changes the layout. GDPR-sensitive portals may object to Google requests. Verify the platform requirement.
How to reproduce: block `fonts.googleapis.com` and reload.
Recommended fix: self-host the two font files (both OFL) in the bundle.
Release blocker: NO (likely YES for some portals; verify)
Status: FIXED (2026-10-07). Bungee and Rubik (400/500/700) are bundled from `@fontsource/*` (OFL), latin subsets only, about 71 kB of woff2. The Google Fonts links were removed from `index.html`. Verified: the sub-folder build makes **0 requests to any external host**; all four faces report loaded, and `document.fonts.check` passes for Bungee and Rubik 700.

### [P2] Cheat/dev menu reachable in production (Shift + D or `?dev`)

Category: Portal / integrity
Observed: `devmenu.ts` shows the DEV panel (+$1M, depth jumps, all machines, reset achievements) whenever Shift + D is pressed, `?dev` is in the URL, or `dth_dev=1`, including production builds.
Why it matters: trivial cheats, broken progression and achievements. A portal reviewer pressing Shift + D will find it.
How to reproduce: production build → press Shift + D.
Recommended fix: keep `?dev` only behind a build flag (`import.meta.env.DEV || __TESTER_BUILD__`) and remove the Shift + D toggle from public builds.
Release blocker: NO (YES for a portal build)
Status: FIXED (2026-10-07). The dev menu (including the Shift + D toggle and `?dev`) only exists in the dev server and in tester builds: `npm run build:test` builds to `dist-test/`, `npm run preview:test` serves it on :4174, and `.env.tester` sets `VITE_TESTER=1`. A public `npm run build` compiles it out. Verified: the strings 'Developer options' and 'Replay the ending' appear 0 times in `dist/assets/*.js` and once in `dist-test`. **For Tejas:** use `npm run build:test && npm run preview:test` (port 4174) when you want the DEV panel; the normal 4173 preview no longer has it.

## First 30 Seconds

Observed (fresh save, real-time, `A1.log`, `A1_early.png`):
- **0:00:** clean load in about 450 ms (production). Sunset surface, small miner, cart and a "Something is down here…" tease. Intro line, then a START DIGGING button.
- **0:00–0:15:** the "Click the rock to dig" hint, satisfying hit/break feedback (chips, dust, "+N RUBBLE" popups) and the digging-speed box.
- **0:10:** "RUBBLE ISN'T MONEY." / "GET IT TO THE SURFACE." The cart fills (15/50 at 0:30).
- **0:17:** first trophy banner and claim.

Verdict: good. Digging is obviously the first action, feedback is strong, and there's no wall of text.

### [P3] Intro line low contrast over the bright sky

Category: First 30s / UI
Observed: the intro line "Someone said there's something valuable underneath it." is white text over a pale sunset sky. It's hard to read at 1280+ widths (`t_res_sheet.png`).
Why it matters: it's the first sentence of the game.
How to reproduce: fresh save, first screen.
Recommended fix: add a dark text-shadow plate or semi-opaque band behind the intro lines.
Release blocker: NO
Status: FIXED (2026-10-07). Each intro line sits on a translucent dark plate (`rgba(9,14,22,.55)` with a slight blur), and both text styles got a tighter dark shadow. Checked on the pale sunset sky: both the big yellow line and the white sentence are clearly readable (`playtest-captures/release-fix/intro_contrast.png`).

## First 2 Minutes

Observed:
- 0:38 first cart.
- 0:48 Yard built with the contractor advance.
- 0:49–1:00: seven purchases in 12 s (miners, Iron Pickaxe, cart upgrades).
- 1:20 track-strain story.
- 1:28 first block.
- 1:37 first build stage.
- 2:16 first property sold.

The longest wait was 48 s (before the Yard). The NEXT BEST card is helpful and doesn't play the game for you. Prices are attainable.

### [P2] First-session signal overload (bottleneck pulses + trophy stream + toasts)

Category: UX / retention
Observed (all at 2:00, `A1_early.png` last frame):
- Five of the five visible Extraction rows pulse red with "⚠ BOTTLENECK", including the locked Heavy Pickaxe and both crew upgrades.
- The 🏆 badge and banners fire constantly: 30+ achievement claims in the first 5 minutes.
- Construction toasts ("FOUNDATION STARTED/COMPLETE…"), the track-strain story and the "New here?" offer all appear inside the same minute.

Why it matters: when everything pulses, nothing reads as important. A new player can't tell what to do. This is the root cause of several symptoms (red everywhere, banner fatigue, toasts covering the tabs).
How to reproduce: fresh save, play 2 minutes.
Recommended fix:
- Tag only the single best bottleneck purchase, the same one as NEXT BEST.
- Never tag locked or maxed rows.
- Batch achievement banners: one banner per 10 s, and "+3 trophies" when several unlock.
- Delay the tour offer and track story until after the first sale.

Release blocker: NO
Status: FIXED (2026-10-07).
- **Bottleneck tag:** only one button is ever tagged, the NEXT BEST purchase (new `key` on `bestNext()`), and only when it speeds up the slowest station. Never locked, hidden or maxed rows. The Economy tile pulses only while that fix is affordable.
- **Trophy banners:** at most one per 10 s. Unlocks that arrive together share one banner ('Heavy Hitter · +4 more trophies · rewards $1.86K'), best tier first, one sting.
- **Timing:** the tour offer and the track story wait for the first sale (see their entries).

Verified with a real-time fresh-save bot (`playtest-captures/release-fix/F1_first5min.log`, 5 min):
- red tags: at most 1 at any moment (was 5 of 5 visible rows);
- banners: 11 in 5 min, three of them combined (was 30+ separate);
- track story: never fired (2 sales, track never overloaded);
- tour chip: appeared at 2:18, 3 s after the first sale (2:16), shrank at 2:28.

The opening still carries the intro lines plus a construction toast per stage. That's acceptable, but a human should judge the feel.
Done:
- the red ⚠ BOTTLENECK tag now goes on **one** button: the NEXT BEST purchase (new `key` on `bestNext()`), and only when it speeds up the slowest station. Never on locked, hidden or maxed rows. The Economy tile pulses only while that one fix is affordable.
- trophy banners: at most one per 10 s; unlocks that arrive together share one banner ('+2 more trophies · rewards $X'), best tier first, with one sting.

Next: delay the tour offer and the track-strain story until after the first sale.

### [P2] Track-strain story fires at about 1:20, very early

Category: Onboarding
Observed: buying the first Cart Capacity levels (cheapest-first) overloads Wood Track within the first 90 s, and a three-line story plus a red badge interrupts the opening.
Why it matters: an extra system is introduced before the player has seen the Yard work.
How to reproduce: fresh save; buy Cart Capacity twice before the Yard's first block.
Recommended fix: raise Wood Track's safe load slightly or delay the story until after the first sale. Keep the mechanic.
Release blocker: NO
Status: FIXED (2026-10-07). New `trackGrace(s)` in `economy.ts`: until the first property is sold, an over-safe cart only counts as STRAINED. The world still creaks and drops dust as foreshadowing, but there's no −30% penalty, red MINE badge, OVERLOADED panel warning, Economy-page penalty or story. After the first sale the next overloaded trip plays the story as before. Verified: the 5-minute fresh run had no story and no red MINE badge in the opening.

## First 5 Minutes

Observed: 4:15 Work Chamber blast (big visible change). Crew on the bridges, ledge miners and machines start appearing. Layer banners: Clay at about 60 m, Stone at 130 m. Second property sold at 3:31. Depth 127 m at 5:00. 32 purchases in 5 minutes; the longest gap was 33 s after the Yard.

Verdict: "What is down there?" is alive: the next-layer pill, finds teased in the wall, and layer colour changes.

### [P2] "New here?" tour offer stays over the dig floor until answered

Category: Tutorial / UX
Observed: offered 2.5 s after the Yard is built. The card sits bottom-centre over the work floor and crew, and never times out. It was still visible at 35 game-minutes in the playtest (`A1_mid.png`, `A2_late.png`).
Why it matters: it covers the main action area. Players who ignore it lose part of the view for the whole session.
How to reproduce: fresh save, build the Yard, don't click Start/Skip.
Recommended fix: dock it as a small corner chip ("Take the tour ▶") that auto-collapses after 10 s. Never place it over the dig floor.
Release blocker: NO
Status: FIXED (2026-10-07). The offer appears after the **first property sale** (was: 2.5 s after the Yard, in the busiest minute). It's a small chip at the bottom-right of the world view, never centred over the dig floor; after 10 s it shrinks to a '▶ Tour ✕' pill until started or dismissed. Guide still starts the tour at any time. Verified: shown at 2:18 (first sale 2:16), pill at 2:28; screenshot `playtest-captures/release-fix/F1_2m30_tourpill.png`.

### [P2] Player tools vs crew gear naming is confusing

Category: UI / economy clarity
Observed: the Extraction list shows both "Heavy Pickaxe $450" (the player's tool) and "Heavy Picks $2.00K" (crew gear), and later "Diamond Drill" vs "Crew Diamond Drills" and "Crew Tools" vs "Crew Gear". All sit in one list with similar icons.
Why it matters: players buy the wrong thing or ignore both.
How to reproduce: 2–5 min into a fresh save, read the Extraction list (`A1_mid.png`).
Recommended fix: split the panel into **Your Tool** and **Crew** subsections. Rename crew gear to tier names ("Crew Gear: Iron Picks"). Fold the Crew Tools levels into the same card.
Release blocker: NO
Status: FIXED (2026-10-07). The Extraction list now has two small headings, **⛏ YOUR PICKAXE** (your tool) and **👷 YOUR CREW** (Recruit Miner, crew gear, Crew Tools, Crew Stamina). Crew gear always reads 'Crew gear: Iron Picks / Heavy Picks / Jackhammers / Diamond Drills / Hellforge Breakers' on the panel and in NEXT BEST, so 'Heavy Pickaxe' (yours) and 'Crew gear: Heavy Picks' can no longer look like the same item. Not done: folding Crew Tools levels into the gear card. Two crew cards is clear enough once they sit under the crew heading.

### [P2] Crew-gear card said "+3 → +3 rubble per break" (found during the fix phase)

Category: UI / economy clarity
Observed: the next gear tier's gain was rounded away. Iron Picks give 2.5 per break and Heavy Picks 3, but both rounded to 3, so the card read "+3 → +3", which looks like a $2,000 purchase that does nothing. Seen in the F1 bot run at 2:30.
Why it matters: players skip a purchase that does help, or feel cheated.
How to reproduce: own Iron Picks, look at the Heavy Picks card.
Recommended fix: show one decimal when needed.
Release blocker: NO
Status: FIXED (2026-10-07). Values are shown to one decimal (`dec1`): "+2.5 → +3".

### [P2] Delivery truck drove behind the block pile at the construction site (Tejas, 2026-10-07)

Category: Art / readability
Observed: the plot's block stack was drawn in the same layer as the builders, after the truck, so the truck on the road looked like it drove behind the pile.
Why it matters: the road is in front of the plot; the depth read wrong.
How to reproduce: watch a delivery arrive at BUILD with blocks on the plot.
Recommended fix: draw the stack before the truck; keep builders, crane and the block count after it.
Release blocker: NO
Status: FIXED (2026-10-07). New `drawSiteStack()` is drawn before `drawTruckLayer()`; scaffold, builders, crane and the "N blocks on site" label stay in front, so the count is readable while the truck unloads. Verified arriving and unloading with 248 blocks on the plot (`playtest-captures/release-fix/truck_in_front_of_pile.png`).

### [P2] A finished property was easy to miss (Tejas, 2026-10-07)

Category: UX / economy
Observed: a property ready to sell, the biggest payout in the game, was only signalled by a small yellow dot on BUILD, a panel button visible on the Build site, and a banner if the player happened to be watching BUILD.
Why it matters: players in the Mine sit on their biggest payout without knowing.
How to reproduce: let a project finish while on the MINE.
Recommended fix: a strong, positive call to action on every site.
Release blocker: NO
Status: FIXED (2026-10-07). While a property waits (`salecall.ts`):
- a gold call-out hangs under the BUILD tab on every site ("🏠 ONE-STORY HOUSE IS READY · Sell it for $4.71K · SELL ▸"), with a soft pulse and a hop every 4 s;
- the BUILD tab glows gold;
- the NEXT BEST card becomes "Sell the One-Story House · +$4.71K · your biggest payout";
- in the world, a gold "READY TO SELL" arrow bobs over the roof next to the FOR SALE sign;
- the panel's SELL PROPERTY button pulses;
- the red bottleneck tag is suppressed until it's sold.

One click on the call-out or the card sells it: from another site the camera flies to BUILD first, so the SOLD moment is seen. Respects reduced motion.
Verified: from the Mine, both the call-out and the NEXT BEST card sold the house (sold 2 → 3, cash $500 → $5,214), then every cue cleared; layout checked at 1366×768 and 800×600 (compact menu); no errors (`playtest-captures/release-fix/sale_guidance.png`).

## First 10 Minutes

Observed (earlier full-run data `playtest-captures/full-run/` plus this audit):
- 100 m at about 8–9 min (bot).
- Excavator at about 11–12 min.
- Great Hall at about 15 min.
- Construction projects advance every 2–4 minutes.

Machines, worksites, crew gear and layers arrive at a reasonable cadence. Automation contributes most of the output by 10 minutes. The Mine, Yard and Build relationship is visible (the cart dumps into the hopper, the truck drives to the plot). No P1 found in this window.

## 10–30 Minute Retention

### [P2] Mid-game money stall around 500 m

Category: Economy / retention
Observed (fresh-save 6× run, `A2_late.png`):
- Cash stayed at $5.02K across four consecutive captures (~1905–1951 game-s).
- NEXT BEST pointed at Construction Crew for $27.6K, which was out of reach.
- No purchase happened for about 150 game-s around 32–35 min.
- Construction was mid-project, so no sale payout arrived.

Why it matters: a 2–3 minute stretch with nothing to buy, mid-session, is where portal players leave.
How to reproduce: fresh save, play to about 500 m buying NEXT BEST.
Recommended fix: investigate before tuning.
- Log income per minute versus the cheapest available price over a full run.
- Likely levers: more frequent smaller stage payments on big projects, or a cheaper next item in the chain.

Release blocker: NO
Status: FIXED (2026-10-07). Root cause (R7 log): construction is the only income, and late-game stages take minutes, so cash sat **exactly flat** (e.g. $56,445 for over a minute at 37 min; $2,588 → $62,575 in one jump at 28–29 min) while the player waited.
Fix: stages of 200+ blocks pay in **progress instalments** at 25/50/75% built, plus the rest on completion. Total unchanged: the completion payment is the stage payment minus the instalments. Instalments show a small '+$X PROGRESS PAYMENT' at the building and a soft coin sound, with no toast. Saved as `build.stagePaid`.
Verified:
- headless (`instal.mts`): a 420-block stage paid 4,663 + 4,663 + 4,662 + 4,663 = **$18,651 = the old single payment**;
- full fresh-save 6× run R8 (`playtest-captures/release-fix/R8_fullrun_6x_final.log`): longest stretch without a purchase **81 s** (R6 153 s, R7 124 s), the top six gaps all 63–81 s, no errors.
Fix: stages of 200+ blocks pay in **progress instalments** at 25/50/75% built, plus the rest on completion. Total unchanged: the completion payment is the stage payment minus the instalments. Instalments show a small '+$X PROGRESS PAYMENT' at the building and a soft coin sound, with no toast. Saved as `build.stagePaid`.
Verified headless (`instal.mts`): a 420-block White House stage paid 4,663 + 4,663 + 4,662 + 4,663 = **$18,651 = the single payment**. Full-run check (R8) in progress.

### [P2] Pacing not re-measured since Crew Gear / worker upgrades

Category: Economy
Observed: the last complete fresh-save measurement reached 1,000 m in 56 min, but that was before Crew Gear (up to ×2 power, ×3 rubble per break) and the Next Best changes. This audit's fresh run reached 127 m at 5 min (real time) and about 580 m at 35 game-min, consistent with roughly 55–60 min. A full run to the end did not complete (see the hang above).
Why it matters: the 60-minute target is a core design promise.
How to reproduce: `v3flow.mjs 16 4200` or `audit_human.mjs` to the end.
Recommended fix: one complete measured run on an idle machine. Only tune with that evidence.
Release blocker: NO
Status: FIXED, pending human confirmation (2026-10-07).

Three complete fresh-save 6× bot runs to the end card:
- **R6, before tuning:** 1,000 m at 43.0 min of play. That breaks the one-hour promise.
- **Tuning:** depth per break ×0.82 for Stone/Cave and ×0.68 from Silver (270 m) to Hellstone. The opening (0–140 m, about 5 min) and income per second are unchanged.
- **R7:** 1,000 m at 52.8 min.
- **R8, final, with progress instalments:** **1,000 m at 51.0 min** (`playtest-captures/release-fix/R8_fullrun_6x_final.log`). Checkpoints: 241 m at 8 min, 325 m at 13, 515 m at 23, 688 m at 33, 865 m at 43, 1,000 m at 51. 11 sales, 223 purchases, no errors.

The bot is optimal (3 clicks/s, always the best buy, claims everything), so a real player should land around 55–65 min. Confirm with one human run; if it's long, the lever is `metersPerBreak` in `config.ts`.

Measured with two complete fresh-save 6× bot runs to the end card:
- R6, before tuning: **1,000 m at 43.0 min** of play. That breaks the one-hour promise (Crew Gear and trophy cash had sped the game up).
- Tuning: depth per break ×0.82 for Stone/Cave and ×0.68 from Silver (270 m) to Hellstone. The opening (0–140 m, about 5 min) and income per second are unchanged.
- R7, after: **1,000 m at 52.8 min** (`playtest-captures/release-fix/R7_fullrun_6x_paced.log`). Checkpoints: 215 m at 8 min, 301 m at 13, 483 m at 23, 643 m at 33, 812 m at 43, 967 m at 53. 11 sales, 222 purchases. Longest gap without a purchase: 124 s (R6: 153 s). No errors.

The bot is optimal (3 clicks/s, always the best buy, claims everything), so a real player should land around 55–65 min. Confirm with one human run.

### [P3] No goal after the ending

Category: Retention
Observed: after the finale the only option is "Start a new mine" (full reset; trophies and best time kept). There's no prestige, carry-over or second mine.
Why it matters: limits long-tail retention; not a launch blocker.
How to reproduce: finish the game.
Recommended fix: post-launch. A prestige "New Mine+" with a small permanent bonus, and a best-time challenge.
Release blocker: NO
Status: DEFERRED: design decision for Tejas (2026-10-07). What exists today: the end card shows your time, money, buildings and trophies, plus a best-time record (`dth_best`, flagged 'NEW RECORD'); trophies and claims survive 'Start a new mine'. A prestige loop (New Mine+, a permanent bonus) changes the economy and needs its own design and playtest milestone, per CLAUDE.md. Proposed: post-launch V3 'New Mine+' (+10% dig speed per completed run, best-time chase), ideally with a portal leaderboard.

## Core Gameplay

Verified:
- Click-dig works with keyboard (Space/Enter).
- Crew, machines, cart, yard, truck, construction, sales, achievements, finds, worksite expansion and the ending all work in a fresh run.
- Rapid clicking (200 clicks) and 30 rapid "Recruit" clicks produced no negative cash or duplicate purchases.
- Rapid Mine/Yard/Build switching (40 switches) produced no errors.

No core-gameplay P0/P1.

## Economy

Chain audit (code + runs): material carries `{qty, val, mix}` through pile → cart → hopper → press → truck → plot. Cash enters only via construction payments, sales, the contractor bootstrap and claimed trophy rewards. Two deliberate sinks:
- **Pile cap:** the dig-site pile is capped at 3 cart loads, and excess rubble is "backfilled", i.e. deleted. This is intentional, but it's invisible apart from the red pile count.
- **Rubble after Hell:** at 1,000 m, rubble is still quarried (the finale then ends the game).

### [P2] Rubble silently deleted when the pile is full

Category: Economy / clarity
Observed: `addRubble` discards rubble over `pileCap`. The only signal is the red pile number and, after 20 s with an affordable fix, a red MINE badge.
Why it matters: "World first" design rule. Players don't know output is being thrown away.
How to reproduce: a crew far outpacing the cart at any depth.
Recommended fix: show it in the world: rubble spilling down a chute or overflow heap, plus a "+N lost" puff. Keep the mechanic.
Release blocker: NO
Status: FIXED (2026-10-07). The mechanic is kept; it's now visible in the world.
- `strike()` counts what the full pile rejects (`DUG.lost`). At most every 1.6 s the pile shows a grey **'−N BACKFILLED · PILE FULL · the cart can't keep up'** popup with dust spilling off the pile.
- A full pile's count pill (and any full stack label) is now a solid red pill reading 'N · FULL'; it was a pale-orange number before.
- The red MINE badge rule is unchanged.

Verified on an over-full pile with 14 miners: popups of −12 to −18 every ~1.6 s and no errors. Sheet: `playtest-captures/release-fix/pile_backfill.png`.

### [P3] Machine count not clamped on load

Category: Save / economy
Observed: the `poisoned` save test loaded `crew.exc: 5`. `sanitize` clamps all crew to 0–10,000, but machines have `max: 1`, and machine output scales with the count.
Why it matters: only reachable by editing the save; a 5× output exploit.
How to reproduce: set `crew.exc` to 5 in localStorage and reload.
Recommended fix: clamp each crew type to its `max`.
Release blocker: NO
Status: FIXED (2026-10-07). `sanitize()` clamps every crew type to its `max`, so machines are 0–1. Verified: a save with `crew.exc: 5` loads as 1.

## Mine

Verified at 120 / 300 / 450 / 640 / 900+ m (earlier captures plus this audit):
- **Layers:** 14 distinct colour themes, and the Hell scene appears from 930 m.
- **Structure:** bridges and electrics every 16 m, worksites and machines readable, and the shaft history keeps its structures.
- **Labels:** depth markers and the next-layer pill are clear.

### [P2] 200–400 ms frame hitches while descending

Category: Performance
Observed: the watchdog logged 236, 289 and 411 ms frames during 6× descent. This matches the known cost of painting each new 5 m geology segment (CLAUDE.md known issue) plus the new layer textures.
Why it matters: visible stutter during the most satisfying moment (digging fast).
How to reproduce: `watchdog.mjs` (575 m, 6×).
Recommended fix: paint segments in smaller slices across frames, or `requestIdleCallback`. Pre-paint the next segment before it's on screen.
Release blocker: NO
Status: FIXED (2026-10-07). Geology segments are no longer painted in a single frame. `paintJob()` is a resumable generator (one pixel row per step):
- prefetch below the view runs within **3 ms** per frame;
- a visible segment that isn't ready yet (first load, a jump) shows its flat layer colour and paints within **8 ms** per frame. The fill is hidden by the rock walls (`playtest-captures/release-fix/geology_loadfill.png`).

Measured with identical instrumentation (time inside `drawGeology` per frame) during a 6× descent from 575 m, on a loaded machine: worst **55–62 ms before → 14–17 ms after**; prefetch work ≤ 6.4 ms per frame. The 150–950 ms frames in the 6× soak were the 6× simulation itself plus the finale. At 1× the Hell layer has none.

### [P3] Hell fossils mostly hidden behind the bridge frame

Category: Art
Observed: the giant rib cage and skull sit behind bridges, machines and darkness. The concept art shows them in open side caverns.
Why it matters: the final reveal undersells itself.
How to reproduce: dev jump to 990 m.
Recommended fix: open side caverns at the Hell layer (logged earlier).
Release blocker: NO
Status: FIXED (2026-10-07). The giant rib cage and the T-rex skull plus neck now sit in two **side caverns** opened in the wall above the room's ceiling rim, under the next bridge (`fossilSpots()` in `hellscene.ts`, anchored to the worksite ceiling and the real bridge positions). Each has a dark hollow with a lava-lit rim and its own warm lamp in the darkness pass, scaled to fit the gap. Nothing stands in front of them any more. Before/after: `playtest-captures/release-fix/hell_fossils_before.png` / `hell_fossils_after.png`.

## Worker Population

Verified: on-screen miners are capped. Floor crew show per worksite slot; extra miners go to fixed bridge posts, 0–4 per bridge (random but stable per level, counted up from the floor), and at most 16 are drawn on bridges. Scrolling shows the same people in the same places (`full-run/fixed_crew_scroll.png`). No giant clumps observed at 26–45 miners. This matches "I can find them working throughout my mine".

No issues opened.

## Yard

Verified: hopper → crusher → press → pallets → truck all animate with state. Silos, motors, forklift, gantry crane and gold trim appear with upgrades; office and diesel tank set dressing.

### [P3] Yard reads small and empty at low upgrade levels at 1920 px

Category: Art
Observed: at 1920×1080 the yard camera shows a lot of road and sky.
Why it matters: the yard is the least "busy" screen early.
How to reproduce: 1920×1080, the first Yard visit.
Recommended fix: a slightly tighter yard zoom on wide screens.
Release blocker: NO
Status: FIXED (2026-10-07). The YARD camera's zoom cap went from 1.0 to 1.35. A new height fit (`CFG.yard.fitHeightU = 9` worker units above the ground) keeps the silos and headframe in frame. At 1920×1080 the production line (headframe → hopper → crusher → press → silo → truck) now fills the width, much like 1366×768 (`playtest-captures/release-fix/yard_zoom_1920_1366.png`). Smaller screens are unchanged (they were already width-limited).

## Build

Verified:
- 12 projects with distinct buildings; staged construction with scaffold, crane and floodlights.
- SOLD flow and the town of sold buildings in the background.
- Current / Next Project cards.

No P0–P2 opened.

## Tutorial / Guide

Verified: a 13-step skippable spotlight tour with keyboard support and Back/Next/Skip, replayable from Guide and Help; the opening intro lines; follow hints. Issues: the tour offer placement (P2 above) and its timing inside the busiest minute (part of the signal-overload P2).

## Upgrade Recommendations

Verified:
- NEXT BEST applies each candidate to the state, re-runs the flow formulas and picks the best value per dollar.
- It routes chain-held items through their blocker and includes Crew Gear, machines, track and worksites.
- In play it recommended sensible purchases.

Issue: it can point at a far-off target during the stall (P2 above). It also uses the bottleneck tag inconsistently with the panel (part of the signal-overload P2).

## UI / UX

Covered above: overlap at 800×600 (P1), signal overload (P2), tour offer (P2), naming (P2).

### [P3] Panel density and long labels

Category: UI
Observed: Extraction alone shows 5–7 big cards by mid-game (tool, recruit, gear, crew tools, stamina, machines), and labels such as "Crew Tools (unlocks Processing Speed)" wrap to three lines in the NEXT BEST card (`A1_mid.png`).
Why it matters: scanning cost; slows decisions.
How to reproduce: about 5 min into a fresh save.
Recommended fix: collapse maxed or locked cards into a "more" row, and shorten the "(unlocks …)" text to a small chip.
Release blocker: NO
Status: FIXED (2026-10-07).
- Finished purchases collapse to one slim, dimmed, dashed line (`.btn.done`): maxed upgrades, owned machines, and Recruit Miner once the final room is full. In a late-game save, 5 rows collapsed and the live choices stand out (`playtest-captures/release-fix/panel_collapsed_rows.png`).
- NEXT BEST no longer puts '(unlocks …)' in the title. The title is just the purchase, and the subtitle says 'unlocks Processing Speed · best value now'.
- Extraction is split under 'Your pickaxe' and 'Your crew' (see the naming fix).

Not done: hiding locked far-off cards (e.g. Hellforge Breaker at 270 m). They're the 'there is more' signal the design asks for (Spec §5).

## Art / Animation

Coherent simplified implementation of the reference direction: painted backdrop, rock walls, timber and bridges, characters, machines, layers, real-looking lava. No obvious placeholder art in normal play. The weakest areas relative to the rest are the hidden Hell fossils (P3) and the early yard emptiness (P3). Finds use simple drawn icons, which is acceptable.

## Audio

### [P2] Audio not validated by ear, and keeps running in background tabs

Category: Audio / portal
Observed: SFX and music are synthesized; earlier logs only checked that they run. `music.ts` schedules notes from a 90 ms `setInterval`, and nothing suspends the AudioContext on `visibilitychange`. Mute and volumes persist (`dth_settings`).
Why it matters: portals generally require sound to stop when the tab or game is not visible, and during ads (verify the requirement). Unreviewed audio is a quality risk.
How to reproduce: start the game, switch tabs; read the code (no visibility handler).
Recommended fix:
- Suspend the AudioContext and stop the scheduler on hidden or ad; resume on visible.
- Do one human listening pass for levels and annoyance (repeated hits, sting frequency).

Release blocker: NO (YES for portals that require it; verify)
Status: PARTLY FIXED (2026-10-07). Audio now stops whenever the tab is hidden or an ad is showing: the AudioContext is suspended through `holdAudio`, and the music scheduler idles while the context isn't running. It resumes on return, and player clicks can't override a hold. Verified for the ad case with `adtest.mjs` (running → suspended → running); the hidden-tab case uses the same path.
Still open (needs a human): a listening pass for levels, repetition and sting frequency.

## Save / Offline

Verified:
- `sanitize()` clamps every number and rejects NaN/Infinity. In the poisoned-save test cash NaN → 0, depth −50 → 0, cartCap 1e9 → 30, rubble Infinity → 0, earned −100 → 0.
- Migrations exist for v2–v5. Old keys are deleted only after the new save is written.
- Offline catch-up is capped at 8 h. The 30-day-old save gave 8 h: +114 m and 690 blocks. A future `last` (clock rolled back) gives no offline time.
- Achievements and claims live in their own key and are claimed once ever.
- Start-over is a two-click confirm.

Issues: the silent wipe (P1 above) and the machine clamp (P3).

### [P3] Clock-forward gives a free 8 h offline payout

Category: Save / integrity
Observed: offline time trusts `Date.now()`. Moving the clock forward grants up to 8 h of progress.
Why it matters: minor single-player exploit.
How to reproduce: close the game, advance the system clock 8 h, reopen.
Recommended fix: acceptable for launch. If needed, use the portal server time later.
Release blocker: NO
Status: ACCEPTED FOR LAUNCH (2026-10-07). Single-player, local saves, no leaderboards, so nobody else is harmed, and the 8 h cap bounds it. Revisit if leaderboards, a server save (portal data API) or anything competitive arrives; then use the portal or server time for the offline delta.

## Performance

Verified:
- Typical frames 5–9 ms (DPR 1) in the mine and surface on an idle machine (earlier runs).
- The Hell scene adds about 3.3 ms.
- Heap 10 → 23 MB in a 90 s mid-game idle run, and 16 → 70 MB in a 4-minute 6× deep run. The relevant caches are bounded (geology ≤ 90 segments, rock tiles ≤ 80, glints ≤ 40k, shapes ≤ 600), so this is probably cache fill rather than a leak. Unverified.

Open: the hang (P1) and the hitches (P2).

## Browser Compatibility

Tested only with headless Chrome (system Chrome) through Puppeteer, at 800×600, 1024×600, 1280×720, 1366×768, 1440×900@2×, 1920×1080 and 390×844 mobile emulation. No horizontal scroll at any size.

### [P1] Not tested on Firefox, Safari or Edge

Category: Compatibility
Observed: no runs outside Chromium. The code uses `roundRect`, `color-mix()` in CSS, `ctx.imageSmoothingQuality`, Web Audio and `structuredClone`-free APIs. `roundRect` and `color-mix` need recent Safari/Firefox.
Why it matters: about a third of desktop portal traffic is not Chrome.
How to reproduce: open in Firefox and Safari.
Recommended fix: a manual pass in current Firefox, Safari and Edge. Add a `roundRect` fallback and a `color-mix` fallback if older versions matter.
Release blocker: YES
Status: FIXED, automated (2026-10-07). Tested with Playwright (`pw/xb.mjs`) against the **production build served from a sub-folder** in Chromium 154, **Firefox 132** and **WebKit 18.2** (Safari's engine). Each engine:
- loads with the fonts loaded;
- starts a fresh game and digs on click;
- loads a 455 m mid-game save ($25K, 20 crew, 2 machines);
- renders Mine, Yard and Build;
- opens Trophies and Economy.

No game errors in any engine; the only console lines came from the test harness. Sheet: `playtest-captures/release-fix/crossbrowser_firefox_webkit.png`. Edge is Chromium, so it's covered by the Chrome runs.

Hardening:
- `src/compat.ts` polyfills canvas `roundRect` (53 uses), so Safari < 16 / Firefox < 112 draw instead of throwing every frame. Verified by deleting the native method in Chrome: the game still renders with 0 errors.
- `-webkit-backdrop-filter` was added for Safari ≤ 17.
- No other Safari-16-risky APIs found (scanned for `ctx.filter`, `letterSpacing`, OffscreenCanvas, `.at()`, `structuredClone`, `:has`, `@container`, `color-mix`).

Still recommended (needs a human, about 10 min): one real-device pass in desktop Safari 16.6 (installed on this Mac) and a real Firefox window, checking that audio plays after the first click and that FPS feels smooth. Headless runs use software rendering, so their 8–11 FPS doesn't reflect real performance.

## Responsive / Mobile

### [P2] Mobile layout incomplete (desktop-first release)

Category: Responsive
Observed: at 390×844 the stacked layout works, but only the MINE tab is visible in the nav; YARD and BUILD are cut off. The corner bar overlaps the tabs (`t_res_sheet.png`).
Why it matters: desktop is the first target, but CrazyGames and Poki surface mobile traffic too.
How to reproduce: 390×844 touch emulation.
Recommended fix: declare the first build desktop-only on portals (verify the option). Fix nav wrapping before enabling mobile.
Release blocker: NO (desktop launch)
Status: PARTLY FIXED (2026-10-07). At 390×844 all three tabs now show (icons only), and the ☰ menu no longer covers them or the dig-speed box. Still open: no touch-specific pass (button sizes, the panel taking 44% of the screen). Launch desktop-first; verify each portal's mobile flag.

### [P3] No fullscreen button

Category: UI
Observed: no fullscreen control; portals usually provide their own (verify).
Why it matters: minor.
How to reproduce: n/a.
Recommended fix: an optional `requestFullscreen` toggle in Settings.
Release blocker: NO
Status: FIXED (2026-10-07). A '⛶ Fullscreen / Exit fullscreen' button sits in the Sound settings popover. It's only shown when `document.fullscreenEnabled` (hidden in portal iframes that don't allow it; portals usually add their own). Verified in Chrome: the button is visible, enters fullscreen, the label switches to 'Exit fullscreen', exits again, no errors.

## Analytics

### [P2] No analytics or event hooks

Category: Analytics
Observed: nothing measures sessions or funnel steps. Most requested events map onto existing code points:

| Event | Existing hook |
|---|---|
| `tutorial_start` / `tutorial_complete` | `tour.start` / `end` |
| `first_dig` | `intro` first break |
| `first_upgrade` | `buyUpgrade` / `buyTool` |
| `first_worker` | `hire('dig')` |
| `yard_unlock` | `nav.announceUnlocks` |
| `first_processing` | `stats.processed > 0` |
| `build_unlock` | `buildUnlocked` |
| `first_property_sale` | `sellProperty` |
| `depth_N` | the `lastMat` / depth checks in `main` |
| `game_reset` | the reset handler |
| ending | `finale.finish` |

No `game_start` or `session_2` tracking (no session counter), no session duration, no quit-point capture.
Why it matters: we can't learn where players quit after launch.
How to reproduce: n/a.
Recommended fix: an `analytics.ts` event bus (no-op by default) with the events above, a session counter and session-length in localStorage. Route it to the portal SDK or an analytics service later.
Release blocker: NO
Status: FIXED, hooks only (2026-10-07). New `src/analytics.ts`: `track(event, props)` with a **no-op sink by default** (nothing leaves the browser; `setAnalyticsSink()` for a portal or a reviewed service later). `dth_meta` keeps the session count, the per-player 'firsts' and total session time.

Events:
- `game_start`, `session_start {n}`, `session_end {secs, site, playSecs}` (the quit point, on pagehide);
- `tutorial_start` / `tutorial_complete` / `tutorial_skip {step}`;
- once per player: `first_dig`, `first_upgrade`, `first_worker`, `yard_unlock`, `first_processing`, `build_unlock`, `first_property_sale {secs}`, and `depth_100` to `depth_1000 {secs}`;
- `game_complete {secs}`, `game_reset`.

Every event carries `session` and `depth`. Milestones are read from the state in one place (`checkMilestones()` on the panel tick) rather than scattered through the code. Verified in dev: a fresh boot plus dig plus opening and skipping the tour logged game_start → session_start → first_dig → tutorial_start → tutorial_skip, and the firsts persisted. A privacy policy is needed before a real sink is attached.

## Monetization Readiness

POST-CORE-READINESS. Natural optional rewarded moments exist, none implemented:
1. **Offline report:** "Double offline earnings".
2. **The cart:** "Rush shipment": the next truck carries double or the cart makes an instant trip.
3. **Construction:** "Speed up this stage ×2 for 60 s".
4. **Finds banner:** "Extra appraisal" cash for a find.
5. **The ending card:** "Keep your trophies' bonus", for a future prestige.

Never interrupt active digging. Requires the platform adapter (P1 above) for pause and mute.

## Release Assets

| Asset | Status |
|---|---|
| Game title | ✅ "Dig to Hell" |
| Logo / wordmark | ✅ the key art's 'DIG TO HELL' rock wordmark on all covers (no separate transparent logo file yet; useful for a loading screen later) |
| Favicon / square icon | ✅ tab + home-screen icons from Tejas's icon art (`public/favicon.ico`, `favicon-32/192/512.png`, `apple-touch-icon.png`, links versioned `?v=2`); store icon `release/images/icon_{1024,512,256,128}.png` |
| Loading screen | ✅ inline `#boot` screen (wordmark + bar) until the loop starts |
| Thumbnail / horizontal cover / square icon | ✅ `release/images/`, all generated from Tejas's key art (`release/source/key_art_1672x941.png`) by `release/tools/make_covers_from_keyart.py` (verify sizes per portal) |
| Screenshots | ✅ `release/screenshots/` (6, UI hidden) |
| Short / long description | ✅ `release/STORE_LISTING.md` |
| Controls + instructions | ✅ in-game Help + store text |
| Age / content notes | ✅ in STORE_LISTING.md |
| Privacy policy | ⚠ draft note in STORE_LISTING.md; a real policy is needed once analytics/ads exist |
| Credits | ✅ STORE_LISTING.md |
| Third-party licenses | ✅ fonts Bungee + Rubik (OFL, now bundled) are the only third-party assets; listed in STORE_LISTING.md |
| Version number | ✅ shown under 'Start over' (from `package.json`; still 0.1.0, so bump before release) |

## CrazyGames

- Verify current platform requirements before submission: SDK version, required events, ads, data/save module, technical checklist, thumbnail sizes, mobile flag.
- Needs: the platform adapter (P1), sub-path-safe build (P1), assets (P1), background-tab handling (P1), mute on hidden/ad (P2), the cheat menu removed (P2), and fonts self-hosted (P2: verify CSP).
- Architecture note: everything runs from one `requestAnimationFrame` loop. Pausing for ads is easy, via `devSpeed = 0` plus audio suspend. Saves go only to `localStorage` through one module (`state.ts`), which is easy to reroute to a portal data API.

## Poki

- Verify current platform requirements before submission. Poki is known for strict SDK, loading and size expectations; confirm them.
- Same adapter. Likely requires a commercial-break hook and the loading flow.

## GameDistribution

- Verify current platform requirements before submission.
- The game is served from a sub-path, so the asset-path P1 is mandatory. Ad pause and mute via the adapter.

## Yandex

- Verify current platform requirements before submission: SDK, language and localization (the game is English-only, all strings hard-coded in TS and HTML), and the cloud-save API.
- Note: no localization layer exists. Adding one later touches `panel.ts`, `intro.ts`, `tour.ts`, `achievements.ts`, `config.ts` names and `index.html`.

## itch.io

- Verify current platform requirements before submission.
- An HTML zip upload is served from a sub-path, so the asset-path P1 is mandatory. No SDK needed. Embed size: choose 1280×720 or larger, given the 800×600 overlap.

## Nice-to-Have Polish

- **Docs:** ~~CLAUDE.md is stale~~ **FIXED 2026-10-07**: CLAUDE.md now documents the v6 save, backups and rolling copy; all storage keys; the release modules (`platform`, `analytics`, `topbar`, `compat`, finale/lava/hell); public vs tester builds; `release/`; the dev hooks; the new pacing; and the current task (release-fix phase). [P3]
- **Pile overflow feedback:** done (see Economy).
- **Hell caverns:** done (fossils in side caverns).
- **Ending:** a camera push-in / screen-shake on gate opening.
- **Yard zoom:** done.
- **Tool icons:** partly addressed by the 'Your pickaxe / Your crew' headings and 'Crew gear:' labels; distinct icons still optional.

## Verified Ready

- `npm install` (2 dev deps, no runtime deps), `npm run typecheck`, and `npm run build` all pass.
- Production `vite preview` loads in about 450 ms locally. The only console error is the favicon 404.
- Fresh load, hard refresh, reload during play: the save persists (5 s autosave plus unload and pagehide).
- Bad-value save sanitisation (NaN, Infinity, negative, out-of-range); migrations v2–v5; old key deleted only after the new one is written.
- Offline catch-up capped at 8 h; clock-back gives nothing.
- Rapid clicking, rapid purchases and rapid site switching: no negative cash, duplicates or errors.
- Insufficient-money, locked and maxed upgrade buttons are disabled and labelled.
- Very large numbers: `fmt` goes up to Qi, and $9M+ displays correctly.
- Deep mine: depth markers, fixed crew posts, scrolling and machines through 1,000 m. The ending runs end to end and shows the summary card.
- No horizontal scroll at any tested size. DPR 2 renders crisply.

## Submission Format Check (2026-10-07)

**Upload package:** `release/upload/dig-to-hell-v1.0.0.zip` (715 KB, rebuilt 2026-10-07 with the key-art loading screen and the ending fix) = the contents of `dist/` with `index.html` at the zip root. 16 files, 996 KB unpacked.

| Check | Result |
|---|---|
| `index.html` at the zip root, all paths relative (`./assets/…`) | ✅ |
| No external requests (fonts bundled, no CDN, no analytics or ads) | ✅ 0 requests outside the game's own origin |
| No source maps, no dev menu, no test hooks in the public build | ✅ (`__dig`, `Developer options`, `localhost`: 0 occurrences) |
| No `alert`/`confirm`/`prompt`, no parent/top-window access | ✅ |
| File names without spaces; small file count | ✅ 16 files |
| Version | ✅ **bumped 0.1.0 → 1.0.0** (shown in game) |
| Runs in a **cross-origin iframe** at 1280×720, 960×540 and 800×450 | ✅ boots, digging works, no scrollbars; the ☰ compact menu kicks in below ~1,000 px |
| **localStorage blocked** (throws) | ✅ still boots and plays (no saving, no errors) |
| **Sandboxed iframe** (`allow-scripts allow-same-origin allow-pointer-lock allow-popups`) | ✅ |
| Text selection while rapid-clicking / right-click menu | ✅ **fixed now**: `user-select:none` on the game and the context menu blocked (verified: a double-click selects nothing; contextmenu `defaultPrevented`) |
| Favicon / tab icon | ✅ (unused 478 KB `favicon-512.png` removed; 192 px and touch icons palette-compressed: build 1.2 MB → 676 KB) |
| Store images | ✅ PNG + **new JPG copies** in `release/images/jpg/` and `release/screenshots/jpg/` (all ≤ 687 KB) for portals with upload size limits |

**Final changes before the zip was rebuilt (2026-10-07):**
- **Loading screen:** shows the key art (`public/loading.jpg`, 320 KB) for at least 2.5 s with a filling progress bar. The world is frozen underneath, so the intro doesn't play unseen. On portrait screens the full art sits over a blurred fill. Verified up at 0.3 / 1.5 / 2.3 s and gone by 3.4 s, landscape and phone, no errors.
- **Ending audio:** once the Gates of Hell open, the mine, cart, yard and construction stop updating (no more pick strikes, rail clacks or hammering under the lava and behind the end card; clicks are ignored), and the music fades out over 2.5 s. Verified: the crew, cart, pile, cash, build progress and truck are identical 3 s apart during the ending; the ending still runs gate → pour → rise → flow → black → end card.
- Re-verified on the rebuilt zip: cross-origin iframe at 1280×720, 960×540 and 800×450, storage blocked, sandboxed iframe; no selection or context menu; 0 external requests.

**Still open (not format issues I can fix here):**
1. **CrazyGames SDK** not integrated. Implement it behind `platform.ts`: SDK script, init, loading/gameplay events, ad pause/mute, data module if required. Verify the current SDK version and requirements.
2. **Hover video** (15–20 s) not delivered (footage recorded; final cut pending).
3. Verify CrazyGames' current image sizes, video spec, file-size and loading-time limits on the submission form.
4. The human checks listed in the Fix Phase Summary.

## Final Submission Gate

*After the fix phase (2026-10-07). Audit counts in brackets.*

| | Count |
|---|---|
| P0 OPEN | 0 [0] |
| P1 OPEN | 1 [8]: the unreproduced hang, mitigated, waiting on a human soak (no longer marked a blocker) |
| P2 OPEN | 3 partial / pending a human [13]: audio listening pass, mobile polish (desktop-first), pacing confirmation |
| P3 OPEN | 0 [9]: 7 fixed, 1 deferred (post-ending goal), 1 accepted (clock-forward) |
| CRITICAL BLOCKERS | 0 [5] |
| PORTAL BLOCKERS | 1 [4]: the chosen portal's SDK behind `platform.ts` (verify current requirements) |

Before a CrazyGames submission:
1. A human does the four checks in the Fix Phase Summary.
2. Implement the CrazyGames SDK behind `platform.ts` and verify the current requirements (SDK version, required events, ads/data modules, image sizes, mobile flag).
3. ~~Bump the version~~ (done: 1.0.0).
4. Commit and tag.

CRAZY GAMES SUBMISSION READY: **NOT YET**. The engineering blockers are cleared; what's left is the portal SDK plus the human checks above.
GENERAL PUBLIC BUILD READY (own site / itch.io, no SDK needed): **YES, after the four human checks**. The build is sub-folder-safe, self-contained and verified in three engines.

Rule: no serious portal submission until P0 = 0 and every P1 that blocks the targeted portal = 0.
