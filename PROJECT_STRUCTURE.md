# Dig to Hell: project structure (for the CrazyGames final check)

**What it is:** a browser idle/clicker mining game. You dig a mine down to 1,000 m (the Gates of Hell). Rubble rides a cart to the surface, a Recycling Yard presses it into blocks, a truck delivers them to a construction plot, and finished buildings are sold for cash that buys upgrades. 14 geology layers, 12 buildings, 3 machines, 50 achievements, a full ending (the gates open, lava floods the mine, then an end card). About 50–60 min to finish.

**Target:** desktop HTML5 first (CrazyGames first, then Poki / GameDistribution / itch.io). Mobile works but isn't tuned.

**Stack:** TypeScript + Vite 6. Canvas 2D for the world, plain DOM for the UI. No framework, no game engine, no runtime JS libraries. All art is procedural canvas drawing; all sound and music is synthesized with Web Audio (no audio files).

---

## 1. Build and run

| Command | What it does |
|---|---|
| `npm install` | dev deps (`typescript`, `vite`) + two font packages (`@fontsource/bungee`, `@fontsource/rubik`; bundled into the build, SIL OFL) |
| `npm run dev` | dev server (has the dev menu and `window.__dig` test hooks) |
| `npm run build` | **public build** → `dist/` (typecheck first). No dev menu, no test hooks. |
| `npm run preview` | serves `dist/` on :4173 |
| `npm run build:test` / `preview:test` | tester build → `dist-test/` on :4174 (DEV menu enabled via `.env.tester`, Shift + D) |

**Production build (`dist/`), 996 KB total; upload zip `release/upload/dig-to-hell-v1.0.0.zip` (715 KB, `index.html` at the zip root):**
```
dist/
  index.html                 inline loading screen (key art ≥ 2.5 s + progress bar)
  loading.jpg                320 KB key art for the loading screen
  favicon.ico, favicon-32.png, favicon-192.png, apple-touch-icon.png
  assets/index-*.js          366 kB (133 kB gzip): the whole game
  assets/index-*.css          47 kB (11 kB gzip)
  assets/*.woff2 / *.woff    Bungee 400, Rubik 400/500/700 (latin subset)
```
- `vite.config.ts` sets `base: './'`, so all URLs are relative. Verified loading from a nested sub-folder with 0 failed requests.
- **Zero external network requests** (fonts are bundled; no CDN, no analytics, no ads).
- Opening `index.html` straight from disk (`file://`) won't run (module scripts); any http host is fine.

---

## 2. Repository layout

```
Dig-To-Hell/
├── index.html              DOM shell: canvas, site tabs, corner menu, panel, modals, boot/loading screen, favicon links
├── vite.config.ts          base './', __VERSION__ from package.json
├── package.json            version 1.0.0
├── tsconfig.json
├── .env.tester             VITE_TESTER=1 for the tester build only
├── public/                 favicons + apple-touch-icon (from the official icon art)
├── src/                    the game (~12.7k lines, listed below)
├── release/                store kit (covers, icon, screenshots, listing text, tools)
├── RELEASE_READINESS.md    full release audit: every issue, its fix and its evidence (score 72/100)
├── Spec.md                 design authority (economy rules, systems, decisions)
├── claude.md               engineering status / architecture notes for AI agents
├── AGENT_CONTEXT.md        older code map
├── addressed-changes.md    change log
├── change.md               older art-reference gap list
├── playtest-captures/      screenshots + bot logs used as evidence (not shipped)
└── dig-to-hell.html        the ORIGINAL single-file prototype (28 kB, pre-TypeScript; not used by the build; uses Google Fonts) → should be deleted or excluded before upload
```

### `src/`: game code by area

**Entry and loop**
| File | Lines | Role |
|---|---|---|
| `main.ts` | 319 | wiring + the requestAnimationFrame loop; load/offline report; background-tab catch-up (`visibilitychange`); dev hooks (DEV only) |
| `config.ts` | 566 | all tuning: 14 materials/layers, tools, crew, machines, worksites, upgrades, 12 projects, finds, timings |
| `state.ts` | 319 | save schema v6, `sanitize()` clamping, migrations v2–v5, **save safety** (backup + rolling `_prev` copy), save/load |
| `economy.ts` | 227 | pure formulas: rates, costs, chain gating, block value, stage payments, track stress |
| `util.ts`, `layout.ts`, `vite-env.d.ts`, `compat.ts` | small | helpers; work-floor layout; types; `roundRect` polyfill for older browsers |

**Simulation**
| File | Role |
|---|---|
| `sim.ts` | strikes, finds, offline/away simulation (capped 8 h) |
| `workers.ts`, `miner.ts`, `digface.ts`, `ladder.ts` | crew behaviour, player strikes, destructible dig face, climbing |
| `cart.ts`, `track.ts`, `trackfx.ts` | mine cart state machine, track strength + overload feedback |
| `surface.ts`, `construction.ts`, `expansion.ts` | yard processing + truck; construction stages (progress instalments) + sale; worksite blasts |
| `finale.ts` | the ending: gate → lava pour → rise → flow → end card |

**Rendering (Canvas 2D)**
| File | Role |
|---|---|
| `render.ts` | the mine scene, HUD on canvas, draw order |
| `view.ts` | canvas sizing/DPR, camera per site, coordinate transforms |
| `rockwall.ts`, `geo.ts`, `bedrock.ts`, `art.ts`, `draw.ts` | rock walls/bridges, painted geology (time-budgeted painting), shared art helpers |
| `rig.ts`, `characters.ts`, `sitecrew.ts` | people rig, machines (excavator, saw, drill), construction workers |
| `yard.ts`, `site.ts`, `buildings.ts`, `landscape.ts` | recycling yard + truck, construction site, 12 buildings, sky/mountains/day-night |
| `minelight.ts`, `lava.ts`, `hellscene.ts` | darkness + lamps, procedural lava, the Hell layer |
| `fx.ts`, `juice.ts` | particles/popups/banners; game events → effects + sounds |

**UI (DOM)**
| File | Role |
|---|---|
| `panel.ts` | side panel (upgrades per site, NEXT BEST card, bottleneck tag, sell button) |
| `nav.ts`, `topbar.ts` | MINE/YARD/BUILD tabs + attention badges; corner bar that collapses to ☰ when narrow |
| `econpage.ts`, `achievements.ts`, `tour.ts`, `intro.ts`, `toast.ts`, `sitehud.ts`, `salecall.ts` | Economy page + `bestNext()`, 50 trophies, skippable tutorial, intro lines, toasts, project HUD, "ready to sell" call-out |
| `devmenu.ts` | DEV menu: compiled out of the public build (dev + tester builds only) |
| `style.css` | all UI styling (with reduced-motion fallbacks) |

**Audio**
| File | Role |
|---|---|
| `audio.ts` | synthesized SFX; `holdAudio(reason)` suspends the AudioContext (tab hidden / ad) |
| `music.ts` | procedural music per site; volume/mute settings |

**Portal / release layer**
| File | Role |
|---|---|
| `platform.ts` | **portal adapter, no-op by default**: `loadingStart/loadingDone`, `gameplayStart/gameplayStop`, `happyTime`, `pauseForAd()/resumeAfterAd()` (freezes the sim + silences audio). `setPortal()` plugs in an SDK. **No CrazyGames SDK is integrated yet.** |
| `analytics.ts` | event bus, **no-op sink** (nothing leaves the browser): game_start, session_start/end, tutorial_*, first_dig/upgrade/worker, yard_unlock, first_property_sale, depth_100…1000, game_complete, game_reset |

Where the adapter is called today:
- `loadingStart` / `loadingDone`: around boot.
- `gameplayStart`: when digging starts, on load of a started game, and when the tab returns.
- `gameplayStop`: tab hidden, ad, end card.
- `happyTime`: every property sale and finishing the game.

---

## 3. Saves and storage (localStorage only)

| Key | Content |
|---|---|
| `digtohell_v6` | the game (every 5 s, on pagehide/unload, when the tab is hidden) |
| `digtohell_v6_prev` | rolling copy of the last good save (≤ 1/min) |
| `digtohell_v6_backup_<time>` | an unreadable or unknown-version save is copied here before anything overwrites it (newest 2 kept); the player is told |
| `dth_ach`, `dth_tour`, `dth_best`, `dth_settings`, `dth_acc2`, `dth_meta` | trophies, tutorial seen, best time, audio settings, panel accordions, analytics session counters |
| `dth_dev` | tester builds only |

All saving goes through `state.ts`, so it can be rerouted to a portal data API if required.

---

## 4. Release kit (`release/`)

| Path | Content |
|---|---|
| `source/key_art_1672x941.png` | master key art (16:9) |
| `source/icon_art_1254x1254.png` | master icon art |
| `images/cover_1920x1080.png`, `cover_1280x720.png` | landscape covers (key art) |
| `images/cover_portrait_800x1200.png`, `cover_square_800x800.png` | portrait / square covers (generated from the key art) |
| `images/icon_1024/512/256/128.png` | icon |
| `images/jpg/`, `screenshots/jpg/` | JPG copies of every image (≤ 687 KB each) for upload size limits |
| `upload/dig-to-hell-v1.0.0.zip` | **the file to upload**: `dist/` contents, `index.html` at the root |
| `screenshots/*.png` | 6 gameplay screenshots, 1920×1080, UI hidden: early mine, gold layer, opal layer, Hell, yard, build |
| `STORE_LISTING.md` | title, short/long description, controls, tags, age notes, privacy-note draft, credits, licences |
| `tools/` | `make_covers_from_keyart.py` (regenerates covers), capture scripts |
| `video/` | **empty: the 15–20 s hover video isn't finished yet** (footage was recorded; the final cut wasn't made) |

---

## 5. Controls and UX facts (for the listing check)

- Mouse: click/tap the rock to dig. Space/Enter also digs. Mouse wheel/swipe scrolls up the shaft.
- MINE / YARD / BUILD tabs switch sites; the side panel holds the upgrades.
- Top-left: Sound (volumes, mute, fullscreen), Economy, Trophies, Guide (tutorial any time), Help.
- No text input, no chat, no external links, no accounts, no ads, no in-app purchases.
- No text selection while playing; the right-click menu is disabled over the game.
- Verified inside a cross-origin iframe (1280×720, 960×540, 800×450), in a sandboxed iframe, and with localStorage blocked: boots and plays, no errors.
- Pausing on blur: audio is suspended when the tab is hidden; progress is simulated on return.
- Tested layouts: 800×600, 1024×600, 1280×720, 1366×768, 1920×1080, 390×844 (no overlap, no horizontal scroll).
- Browsers verified (automated, production build from a sub-folder): Chromium 154, Firefox 132, WebKit 18.2 (Safari engine). 0 errors.

---

## 6. Known gaps before a CrazyGames submission

1. **CrazyGames SDK not integrated.** Implement it behind `platform.ts`: loading, gameplay start/stop, ad-break pause and mute, happytime, and the data module if required. Verify the current SDK version and requirements.
2. **Hover video (15–20 s) not delivered yet**, and a longer gameplay video if required.
3. ~~Version~~ bumped to 1.0.0.
4. `dig-to-hell.html` (old prototype) sits in the repo root. It isn't part of `dist/`, but don't upload it.
5. Human checks still pending (see RELEASE_READINESS.md): a 30–60 min real-time soak, a real Safari/Firefox pass, an audio listening pass, and a human playthrough to confirm about 60 min to the end.
6. Mobile is playable but not tuned (desktop-first).
7. No post-ending meta/prestige (deliberately deferred).

**Ask for the reviewer:**
- Check this against the current CrazyGames requirements: technical checklist, SDK events, file size and loading, image and video specs, content rating, mobile flag.
- List anything missing or non-compliant.
