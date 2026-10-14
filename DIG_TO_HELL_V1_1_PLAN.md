# Dig to Hell — v1.1 Basic Launch Improvement Sprint (plan)

*Updated 2026-10-14 · builds on `DIG_TO_HELL_V1_1_AUDIT.md` · baseline `e26f3a9` (v1.0.0) · working branch `claude/admiring-volta-jd4xn8`.*

**Goal:** improve the real player experience during CrazyGames **Basic Launch**: a clearer, more exciting first minute, fair restarts, one genuinely fun new mining moment, guidance that leaves the choices to the player, and a game that fails visibly instead of freezing. We are **not** optimising for Full Launch requirements yet.

Baseline (Oct 14, observations, not targets):
- 908 plays · 756 unique players
- 35.54% gameplay conversion
- 7m 18s average playtime
- 3.49% D1 retention · 4.23% returning users
- 8.1/10 rating

## Confirmed decisions
1. **No CrazyGames SDK in v1.1.** Deferred until after Basic Launch, unless we find a genuine Basic Launch requirement. Per the CrazyGames technical requirements, the SDK is optional for Basic Launch ([Requirements — Technical](https://docs.crazygames.com/requirements/technical/), read via search summary). No SDK code, script tag or dependency is added.
2. The Economy page keeps its per-station purchase buttons.
3. Rich Vein unlocks after the first construction sale.
4. Error reporting is local-only.
5. Focused two-day scope.
6. Existing saves and current progression are preserved.
7. No new upgrade systems, currencies or unrelated features.

## Working rules
- One milestone at a time, in this order. **Each milestone stops for approval** before the next starts.
- For each milestone:
  1. inspect the code
  2. make the smallest reliable change
  3. `npx tsc --noEmit` + `npm run build`
  4. automated tests
  5. play it in a real browser
  6. screenshots for visual changes
  7. report what changed, what passed, and what still needs a human
- No merge into `main`, no deploy to CrazyGames without explicit permission.
- Saves: additive only, no `saveVersion` bump. `sanitize()` drops unknown fields (`src/state.ts:145`), so v1.0 can still read a v1.1 save.

## Milestones

| # | Milestone | Est. | Status |
|---|---|---|---|
| 1 | First-minute experience | 3 h | **Implemented, awaiting approval** |
| 2 | Achievement reset (run vs lifetime, safe migration) | 3.5–4 h | Planned |
| 3 | Rich Vein (main new feature) | 5–6 h | Planned |
| 4 | Best Upgrade → bottleneck guidance | 2.5–3 h | Planned |
| 5 | Reliability (startup failure, fatal errors, local log) | 2.5–3 h | Planned |
| – | RC pass (full regression, docs, version 1.1.0, upload zip) | 1.5–2 h | Planned |
| | **Total** | **≈ 18–21 h** | |

---

### Milestone 1 — First-minute experience (implemented)

**Changes**
| File | Change |
|---|---|
| `src/main.ts` | Fixed 2.5 s loading minimum replaced by readiness: canvas fonts loaded + one frame drawn, with a floor of 0.4 s and a cap of 1.2 s. The first tap on the rock, or Space/Enter, at the start now **starts the game and lands a strike** (it used to only start). START also swings the pick. |
| `src/intro.ts` | Title and subtitle shown together with the **START DIGGING** button at once (kept for keyboard/accessibility; it used to appear after ~3.6 s). Positive copy: "NICE! KEEP DIGGING.", "UP IT GOES!", "Blocks build houses. Houses pay!" (replacing "RUBBLE ISN'T MONEY." / "GET IT TO THE SURFACE." / "Now this is useful."). New live objective: **"⛏ FILL THE CART n/50"** with a progress fill, matching the cart's own n/50 label. From 20 units it becomes **"CART READY! TAP/CLICK IT TO SEND ▲"**; the cart also leaves on its own, as before. The counter never ticks backwards. |
| `src/render.ts` | Before the first 3 strikes: pulsing gold tap rings where a strike lands, plus a "Tap/Click the rock to dig" label on a dark plate (touch vs mouse wording). Shown from the very first screen. |
| `src/juice.ts` | Contractor lines: "Nice haul! Press it into blocks…" / "…and blocks build houses. Houses pay!" |
| `src/achievements.ts` | Trophy banners wait until the Recycling Yard is built (they queued over the opening and, on phones, sat over the dig face). On touch devices banners don't take taps (they read "claim in 🏆 Trophies"), so a tap on the rock can never open the trophy page. Rewards and unlocks are unchanged. |
| `src/style.css` | Gold objective style (solid fill, not the red attention pulse). Phones/short screens: trophy banners at the top, intro lines lower so they don't overlap the objective. |
| `index.html` | Loading bar fills in 1 s (was 2.5 s). |
| `tests/e2e/onboarding.mjs` (new) | Plays a fresh production build on 5 viewports through boot → start (Space / START / tap) → fill the cart → follow it → build the Yard. Checks timings, objective text and console errors; takes screenshots. |

Unchanged: cart rules, economy, save format, tutorial step numbers (`S.tut`).

**Acceptance (all met, see the milestone report)**
- START visible ≤ 2.5 s after navigation. Measured 1.2–1.4 s; v1.0 was ~5.0 s.
- The first input strikes on all three start paths.
- Objective visible.
- No console errors.
- Yard built and progression after the opening unchanged (pacing bots).

**Needs a human:** real iPhone Safari + Android Chrome, sound on. 3 first-time players: seconds to first tap, whether "fill the cart" was understood, whether they followed the cart.

**Rollback:** revert the milestone commit. No save impact.

---

### Milestone 2 — Achievement reset

**Design**
- **Current-run trophies** move into the save: `S.ach = { got, claimed }`. Start Over and "Start a new mine" therefore reset them automatically through `fresh()`.
- **Lifetime** trophies live in a new key `dth_life = { v:1, got:{id:firstTs}, seen }` and are never reset.
- **Best time** stays in `dth_best` (unchanged).
- A reward pays only when `S.ach.got[id] && !S.ach.claimed[id]`, so once per run.
- **Migration** (pure, DOM-free `src/achcore.ts`, runs once):
  - lifetime = legacy `dth_ach.got`
  - the run's unlocks are re-derived from the loaded save (every `prog()` reads `S` only)
  - `claimed = legacy.claimed ∩ run unlocks`, so nothing is paid twice in the same run
  - if `dth_ach` is unreadable on a save with progress, everything currently met is marked claimed (conservative)
  - `dth_ach` itself is **left untouched**, so a rollback to v1.0 still works
- Trophy page: "This mine N/50 · Lifetime M/50". Finale copy: "Your lifetime trophies and best time stay with you."
- **Exploit review:**
  - Reset-farming gains nothing, because cash resets with the run.
  - Claim → reload can't duplicate: the claim and the cash are in the same save.
  - Two tabs stay consistent (trophies travel with the save).
  - Run 2 now matches run 1 instead of losing ~40% of early cash.

**Files:** `src/achcore.ts` (new), `src/achievements.ts`, `src/state.ts` (`ach` in `fresh`/`sanitize`), `src/main.ts`, `src/finale.ts`, `index.html`, `src/devmenu.ts`.

**Tests**
- Unit tests for migration cases:
  - (a) mid-run save with claims
  - (b) save behind its claims after a reset
  - (c) no `dth_ach`
  - (d) corrupt `dth_ach`
  - (e) finished save
- E2E: Start Over; finale restart (dev menu → 990 m); repeated restarts; old saves; v1.1 save loaded by the v1.0.0 build.
- Pacing: run 2 ≈ run 1.

**Save risk:** medium (new field), mitigated by sanitize + matrix tests.

**Rollback:** revert. v1.0 ignores `S.ach` and reads the untouched `dth_ach`.

---

### Milestone 3 — Rich Vein

**Design: "Crack the seam".** Tap weak points; no reaction timer.
- **Unlock and frequency:**
  - after the first sale
  - only on the MINE, tab visible, not during blast/finale/ad/modal/tour
  - cooldown 60–100 s of *active* mining (a strike in the last 15 s)
  - never within 20 s of a find, layer change, blast or track job
  - **0 while idle, offline or hidden**
  - ≥ 45 s after any load
- **Play:**
  - A glowing seam in the layer's gem colours cracks across the face with **4 weak points (5 from 300 m, 6 from 700 m)** on different chunks.
  - Each tap is a crit-style hit: hit-stop, burst of gem rubble, and the seam cracks toward the next point.
  - Cracking all of them gives **MOTHERLODE!** (+25%).
  - Space hits the nearest point.
- **Forgiving:**
  - fades only after 15 s without a hit, hard cap 45 s
  - leaving the MINE pauses the fade
  - points left over are collected by the crew at 40%
- **Economy:**
  - Total yield `clamp(0.45 × cart capacity × √tool yield, 10, 0.8 × cart capacity)` units at **2× the depth's unit value**, added to the rubble pile, so it flows haul → yard → truck → construction → cash.
  - Vein rubble may exceed the pile cap by at most that amount. Crew rubble keeps the cap.
  - Target: +8–15% construction income for an active player over 10 min; 0 for idle. The 6× run to 1,000 m stays 46–55 min.
- **Persistence:** no save fields. Awarded rubble is already in the saved pile; an open vein is lost on reload; cooldown restarts.
- **Mobile:** targets ≥ 44 CSS px; a tap on a weak point never triggers the site swipe or the cart send.
- **Abuse:** points spawn at random chunks; per-vein cap; no reload, offline or background farming; one vein at a time.

**Files:** `src/vein.ts` (new), `src/economy.ts` (`veinYield`), `src/config.ts` (`CFG.vein` + `features.vein` kill switch), `src/main.ts` (pointer routing), `src/nav.ts` (swipe guard), `src/render.ts`, `src/juice.ts` / `src/fx.ts` / `src/audio.ts`.

**Tests**
- Unit: yield bounds; eligibility; cooldown.
- E2E (dev hook forces a vein): tap all points on desktop + phone; leave → 40%; reload → no vein for 45 s.
- Pacing: active vs idle bots; material conservation; 6× full run.

**Save risk:** none.

**Rollback:** `features.vein = false`, or revert.

---

### Milestone 4 — Best Upgrade → bottleneck guidance

**Design**
- The card **never buys**.
- It shows the slowest station and the runner-up with live rates, one world-language reason, and **2–3 ways to fix it** with honest effects. No ranking, no "best".
- It adds an "or…" line when a different strategy is genuinely competitive.
- The **player's pickaxe** is included when Dig is the slowest station.
- **Tapping the card** goes to that station's site and outlines those rows; the player buys there.
- **Starter tips:** until the first sale + 5 purchases, it points at one specific row (still not purchasable from the card).
- "Sell the …" stays clickable.
- Economy page buttons are kept.
- Tour step rewritten.

**Files:** `src/panel.ts`, `src/econpage.ts` (`stationOptions()`; tool as a Dig option), `src/tour.ts`, `index.html`, `src/style.css`, `src/config.ts` (`features.guidance`).

**Tests**
- Unit: `stationOptions()` per station, including the chain-held case.
- E2E: a tap never changes cash; navigation + row outline; starter → station switch.
- Pacing: guide-following bot reaches the first sale within +15 s of v1.0 and ends 10 min with tool ≥ 2.

**Save risk:** none.

**Rollback:** `features.guidance = 'legacy'`, or revert.

---

### Milestone 5 — Reliability

**Design**
1. **`src/errors.ts`** (new, first import):
   - `window.onerror` + `unhandledrejection`
   - each error gets a short code (hash of message + top frame), plus where (boot/frame/event), version and a short user agent
   - last 5 kept in `localStorage.dth_err`; `console.error` with the full stack
   - **local only**
2. **Startup failure:**
   - An inline watchdog in `index.html` (classic script, so it works even if the module bundle fails) turns the loading screen into *"Dig to Hell couldn't start"* with the error code, **Reload** and **Copy details**.
   - It triggers if `__dthBooted` isn't set within 15 s or a boot error is reported.
   - `<script nomodule>` message for old browsers.
3. **Fatal gameplay error:**
   - The `frame()` body is guarded; on an exception the loop **stops** (no restart, no pretending).
   - The error is recorded and audio held.
   - The main save is **not** overwritten (last periodic save ≤ 5 s old); a sanitized snapshot goes to `digtohell_v6_crash`.
   - Overlay: *"Something went wrong. Your progress from a few seconds ago is saved."* with Reload + Copy details.
4. Dev/tester-only crash hooks for testing.

**Files:** `src/errors.ts` (new), `src/main.ts`, `index.html`, `src/style.css`, `src/platform.ts` (stop gameplay on fatal), `src/devmenu.ts`.

**Tests:** E2E with forced boot and frame errors: the panel/overlay appears, the main save is unchanged after the fatal error, reload restores it, and normal play leaves `dth_err` empty. Desktop + phone.

**Save risk:** low (separate crash key; main save never written on the fatal path).

**Rollback:** revert.

---

### RC pass
- Full onboarding e2e.
- Achievement matrix.
- Vein + guidance e2e.
- 10-min pacing bots (active, no-claim, cheapest, human-like, idle) + 6× full run.
- Platform checks from `RELEASE_READINESS.md` (iframe, storage blocked, sandbox, no external requests).
- v1.0 ↔ v1.1 save round trip.
- Docs: `claude.md`, `Spec.md`, `AGENT_CONTEXT.md`.
- Version 1.1.0; new upload zip; **the v1.0.0 zip is kept**.
- Stop for approval before merge or upload.

## Deferred (not v1.1)
- CrazyGames SDK
- Remote error reporting
- Fossils
- Next-project choice
- Collection / treasure
- Cave-ins
- New-mine perks
- Trophy reward rebalance
- Layer-arrival stamp

## Rollback strategy
- One commit per milestone (revert any alone).
- Kill switches for Rich Vein and guidance.
- Additive saves only; legacy `dth_ach` frozen; v1.0 reads v1.1 saves.
- The v1.0.0 upload zip stays available to re-upload.
