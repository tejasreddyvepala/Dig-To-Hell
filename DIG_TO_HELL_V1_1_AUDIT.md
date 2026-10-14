# Dig to Hell — v1.1 Gameplay Redesign Audit

*Audit date 2026-10-14 · code at `e26f3a9` (v1.0.0, same bundle hash as the shipped zip) · no source, asset, economy, save or release file was changed.*

**Evidence labels**
- **VERIFIED**: read in the code, or measured in the running game during this audit.
- **INFERRED**: follows from verified facts plus reasoning, but nobody has measured it directly.
- **UNCONFIRMED**: a hypothesis that needs CrazyGames analytics, a human playtest, or docs I could not reach.

**How the evidence was gathered**
- Four Playwright bots played the real dev build (`npm run dev`, `__dig.setSpeed(4)`) for 10 game-minutes each from a fresh save. Timings are game time (`S.stats.playSecs`), so the speed-up doesn't skew them. Logs and the script are in the session scratchpad: `/tmp/claude-0/-home-user-Dig-To-Hell/3278e636-931a-5532-97d2-778f90a0f8d7/scratchpad/` (`bot.mjs`, `run_best.log`, `run_noclaim.log`, `run_cheap.log`, `run_human.log`). There were 0 console errors in all runs.
- Boot timing was measured on the production build (`vite preview`) at desktop, portrait-phone and landscape-phone sizes (`boot.mjs`).

| Bot | Policy | Clicks |
|---|---|---|
| `best` | Taps the NEXT BEST card whenever it's affordable. Claims every trophy at once. Sells at once. | 4/s |
| `noclaim` | Same as `best`, but never claims a trophy. This is also what a player sees on a **second run after Start Over** (see §3). | 4/s |
| `cheap` | Ignores the card. Every few seconds it buys the cheapest affordable button on the site it's viewing, and browses sites every 6 s. | 4/s |
| `human` | Human stand-in: claims trophies late and rarely, browses a site every ~25 s, buys the cheapest affordable button there. | 3/s for 2 min, then 1.5/s, then 0.6/s after 5 min |

> **Bots are not players.** All four have perfect knowledge, react instantly and never misread the UI. They show what the economy *allows* and where the *structural* dead zones are. They don't show confusion, boredom or whether it's fun. The `human` bot is only a pacing stand-in. Everything about feelings and understanding below is INFERRED or UNCONFIRMED until a human playtest or CrazyGames data confirms it.

---

## 1. Current gameplay assessment

**What works**
- The production chain is visible and readable: material physically travels pile → cart → yard → truck → plot → building. VERIFIED (code and screenshots).
- The game reaches its "it's working" moment quickly. The first block is pressed at ~36 s and the first stage is paid at ~56 s. VERIFIED (all runs).
- Depth is a strong long-term goal. There are 14 layers to 1,000 m, the depth ruler shows "?" markers, and there is a real ending.
- Rating is 8.1/10. Average playtime is 7m18s even though 64% of players leave in the first minute. If those early leavers average ~30 s, the players who stay average **≈ 19–20 min**: (7.3 − 0.645 × 0.5) / 0.355. INFERRED.
  **The game holds people who get past minute one. Minute one is the problem.**

**What doesn't**

| Problem | Evidence |
|---|---|
| **The player's own verb, clicking, stops mattering within minutes.** | `cheap` clicked ~800 times and reached 274 m. `best` clicked ~2,300 times and reached 290 m. About 2.9× the clicks gave +6% depth. VERIFIED. After ~3 min the only active verb left is "buy". |
| **Buying is a one-tap loop on a single card.** | `best` made **80 purchases in 10 min** by tapping the same card. VERIFIED. |
| **Upgrade choice has almost no depth.** | Buying the cheapest item does nearly as well as the optimiser: 274 m vs 290 m, $51.7K vs $53.7K construction income. VERIFIED. |
| **Trophies, not construction, are the biggest early reward.** | For `best`, claimed trophy cash was **$33.9K**, against **$53.7K** from construction (39% of all cash). For `cheap` it was $41.6K against $51.7K (45%). VERIFIED. The design rule says cash comes from construction, but in practice the CLAIM button competes with selling a house. |
| **YARD and BUILD are places you watch, not places you play.** | Canvas clicks are ignored off the Mine: `src/main.ts:73` (`if (view.site !== 'mine' …) return`). The Best card buys yard and build upgrades from any site, and Sell is reachable from any site through the sale call-out. VERIFIED. **Navigating only matters for the tutorial and for spectating.** INFERRED. |
| **Nothing unexpected happens.** | There are no events. Spec §12 targets "something meaningfully different every ~20–45 s", and none of it is built. Finds are 8 banners at fixed depths that add +10% dig each (`src/sim.ts:60`, `src/config.ts:301`, `findMultBonus` 0.1). In the first 10 minutes a player sees 2–3 of them. VERIFIED. |

**Overall assessment**
- The game is a well-made, readable *optimisation toy* with a strong destination.
- It lacks **moment-to-moment play**: no reason to watch the mine, no surprises, no choices that change the outcome.
- v1.1 should add **one or two active mining moments** and **stop the game from playing itself through one card**. More upgrade rows won't help.

---

## 2. Best Upgrade analysis and recommendation

### 2.1 Where it is (VERIFIED)
- **Engine:** `bestNext()` in `src/econpage.ts:88-139`.
- **UI card:** `#bestCard` in `index.html` ("NEXT BEST UPGRADE"). It sits above the per-site panels, so it shows on **every** site. It is driven by `updateBest()` in `src/panel.ts:277-292`.
- **Related signals:**
  - `tagBottleneck()` in `src/panel.ts:261-275` puts a red pulse on the same row and on the 📈 Economy button.
  - The Economy page has a "TOO SLOW!" station with a big button (`render()` / `bestFor()`, `src/econpage.ts:142-170`).
  - Tour step 'Next Best Upgrade' (`src/tour.ts:21`) tells players: "This card always shows the purchase that raises your income the most… one tap buys it."

### 2.2 What it calculates (VERIFIED)
1. It defines `value()` as `flowRates().perMin + 0.35 × geometric-mean(station rates) × $/block × 60`. That is income now, plus a share of how much the whole pipeline grows.
2. For each candidate it **applies the purchase to `S`, recomputes `value()`, and undoes it**. Score = gain ÷ price. Candidates:
   - the 9 chain upgrades (when one is chain-held, its blocker inherits its value)
   - Recruit Miner
   - machines
   - crew gear
   - next track tier
   - worksite expansion (valued as room plus its machine, or +4 miners)
3. It picks the highest score. If the top pick costs more than about 2× your cash, it switches to the best **affordable** one (`src/econpage.ts:135-137`).
4. **The player's own pickaxe is not a candidate.** There is no `TOOLS` entry. VERIFIED in code. In the bot run, `best` finished 10 minutes with `tool = 0` (still the starting Pickaxe, 0 of 5 tool upgrades), while `cheap` reached tool 3 and `human` tool 2.
   **Following the card quietly makes the player's own clicking weaker.**

### 2.3 Does it buy automatically?
- It does **not auto-purchase**. It is a **one-tap buy button** (`el.onclick = () => { … x.buy() }`, `src/panel.ts:291`). VERIFIED.
- In practice the effect is close to automatic. The card shows a gold fill as cash approaches the price and turns gold when affordable, so the loop becomes "wait → tap the gold card". `best` did this 80 times in 10 minutes. VERIFIED.

### 2.4 Does it make other decisions unnecessary?
**Yes, mostly.** VERIFIED by behaviour, INFERRED for players.
- The card is visible on every site and buys anything, so the three site panels and the Economy page are redundant for spending.
- It also removes the main reason to open YARD and BUILD after the tutorial.

### 2.5 Does the nine-upgrade chain make choices predictable?
**Yes.**
- `chainGate()` (`src/economy.ts:117-126`, `CFG.chainSlack = 2`) stops any chain upgrade from going more than 2 levels above the weakest unlocked link. At any moment only a handful of chain buys are legal.
- Costs grow 1.5–1.8× per level, so buying the cheapest item already round-robins the chain.
- That is why `cheap` performs within ~5% of the optimiser. VERIFIED.
- **The chain isn't the main problem**, though. It's a sensible guard against degenerate builds. The problem is that the upgrades are almost all "+X% throughput" on one serial pipe, and on a serial pipe the right answer is always "raise the slowest station". INFERRED.

### 2.6 Is the economy interesting without the button?
**Not much more.**
- Without the card, the best play is "buy the cheapest legal thing on whichever site you're looking at". `cheap` showed that costs you about 5%.
- Removing the card replaces a one-tap loop with a **scavenger hunt** across three panels. That is inconvenience, not decision-making. INFERRED from the `cheap` vs `best` result.

### 2.7 Options

| Option | Decisions gained | Risk | Verdict |
|---|---|---|---|
| **A. Remove the card entirely** | Small. Players then hunt for the cheapest row across 3 sites. | Players who relied on it, the tour and the bottleneck tag (shares `bestNext`) all need handling. Slower, more confused new players: UNCONFIRMED. | Not on its own. |
| **B. Turn it into a pointer (recommended)**: keep the engine, drop one-tap buying. The card names the slow station ("Haulage is holding you back"); tapping it flies to that site and pulses the row(s) there. The player taps the actual row. | Small to moderate. The player sees *which station*, goes there, and picks among that station's rows. Navigation regains a purpose. | Low. `bestNext()` and `flowRates()` stay as they are; only `updateBest()` and the card change. | **Yes, for v1.1.** |
| **C. Real trade-offs** (e.g., machines with drawbacks, project choice, risk/reward veins) | High | High for 1–2 days | Partially: see §6/§7. One real choice (Rich Vein) ships in v1.1, the rest later. |

**Recommendation.** Your instinct to remove Best Upgrade is right about the *one-tap buy*, but wrong if it means removing guidance altogether.
- **Remove the purchasing card and replace it with a non-purchasing bottleneck pointer (Option B).**
- Add the player's own tool to what the pointer can name, so following it never weakens clicking.
- Update the tour step.
- Removing the card alone won't make the game more interesting, because the economy itself has few choices. The real gain in v1.1 has to come from the active mining moments in §7.

---

## 3. Achievement reset root cause

### 3.1 Start Over flow (VERIFIED, `src/main.ts:145-158`)
1. The first click arms the button ("Click again to erase all progress"). A second click within 4 s confirms.
2. `saveState()` → `resetState()` (`Object.assign(S, fresh())`, `src/state.ts:317`) → `resetMilestones()` (clears analytics `dth_meta.firsts`, `src/analytics.ts:60`).
3. `localStorage.removeItem('digtohell_v6')` and `'digtohell_v6_prev'`.
4. `location.reload()`. On unload, `beforeunload`/`pagehide` call `saveState()` (`src/main.ts:57-58`), which writes the **fresh** state. That is correct.

### 3.2 Root cause (VERIFIED)
**Achievements live in a separate key, `dth_ach`, that nothing in the reset flow clears.** This is deliberate, but it's the wrong design for a Start Over:
- `src/achievements.ts:2`: "Stored in their own key (`dth_ach`) so they survive 'Start over'."
- `src/achievements.ts:103-106`: module-level load of `{ got, seen, claimed }` from `dth_ach`. `persist()` writes it back. There is no exported reset function.
- `src/finale.ts:259-265`: the end card's "Start a new mine" does the same reset and says **"Your trophies stay with you."** (`src/finale.ts:256`).
- The only code that clears it is the dev menu ("Reset achievements", `src/devmenu.ts:45`). The dev menu isn't in public builds.

### 3.3 Consequences
| Area | What happens after Start Over | Label |
|---|---|---|
| localStorage | `dth_ach` survives, with all `got` timestamps, `seen` and `claimed` | VERIFIED |
| Unlocked list and counters | Trophy page shows N/50 unlocked, tiers still counted, category counts full | VERIFIED (`renderGrid` reads `got`) |
| Claimed rewards | `claimed[id] = true` survives, so **rewards can never be claimed again** ("once, ever", `claim()` at `src/achievements.ts:109-113`) | VERIFIED |
| Economy of run 2 | Trophy cash was **39–45% of all cash in the first 10 min** of run 1 (`best` $33.9K, `cheap` $41.6K). Run 2 gets **none** of it. The `noclaim` bot stands in for run 2: $21.6K construction income vs $53.7K, first expansion at 5.4 min vs 2.7 min, and a **62-second stretch with nothing to buy right after the Yard (33 s → 95 s)**. | VERIFIED (bot), INFERRED (that this equals run 2) |
| Banners and fanfare | No unlock banners at all in run 2. `checkAchievements` skips ids already in `got`. | VERIFIED |
| In-memory state | Module variables `got/seen/claimed` keep old values until the reload. Harmless today because a reload follows and nothing new unlocks on a fresh `S`, but fragile. | VERIFIED |
| UI refresh | Fine after the reload. `initAchievements()` re-renders from storage. | VERIFIED |
| Finale card | Reads trophy count straight from `dth_ach` (`src/finale.ts:236`) | VERIFIED |
| Other keys that survive (probably fine) | `dth_tour` (tour seen), `dth_acc2` (open/closed panel sections), `dth_settings`, `dth_best` (best time) | VERIFIED |

### 3.4 Files that need to change (do not fix yet)
- `src/achievements.ts`: add `export function resetAchievements()`. It clears `got`, `claimed`, `seen` and the banner `queue` in memory, removes `dth_ach`, and calls `updateBadge()`. Update the header comment.
- `src/main.ts` (reset handler, ~l.153): call `resetAchievements()` before `location.reload()`.
- `src/finale.ts` (~l.256 and l.259-265): call `resetAchievements()` in "Start a new mine". Change the "Your trophies stay with you." copy. Optionally pass `achN` in rather than reading localStorage.
- **Product decision needed:** if you want a lifetime record ("Hall of Fame"), store it under a new key such as `dth_ach_life` that is never claimable. **Recommendation:** a full reset in both places, and keep only `dth_best` (best finish time) as the replay goal.

---

## 4. First 10-minute progression timeline

Times are game time. Sources are the four bot logs. "Player" means what a real player would be doing; bot behaviour is labelled where it differs.

### 0–30 s
| | |
|---|---|
| Before 0 | Page load → loading art. The boot screen is gone at **3.1–3.3 s** (forced minimum 2.5 s, `BOOT_MIN_MS`, `src/main.ts:287`). Two text lines play, and **START DIGGING appears at ~5.0 s** after page load (`src/intro.ts`, line 1 lasts 2.4 s, button 1.2 s into line 2). Same on desktop, portrait and landscape phone. VERIFIED. A tap on the canvas also starts the game (`src/main.ts:72`), but nothing tells the player that. |
| Actions | Click the rock. |
| Unlocks | None. "RUBBLE ISN'T MONEY." (~5 s) → "GET IT TO THE SURFACE." (~8 s, after 8 rubble). VERIFIED. |
| Rewards | Trophy "First Scratch" banner at ~6 s, **+$160 if claimed**. VERIFIED. |
| Repetitive | Click, click, click. No money yet. |
| Confusion (UNCONFIRMED) | The first message is a *negative* ("isn't money"). Nothing on screen gives a short-term goal or count. The banner says "tap to claim" when the player has nothing to spend on. |
| Reasons to continue | Satisfying impacts, the depth ruler with "?" marks, the cart filling. |
| **Abandonment risk** | **High.** About 5 s before input plus ~20 s of pure clicking for unexplained "rubble". This sits right inside CrazyGames' 1-minute conversion window (§ Task 6). UNCONFIRMED. |

### 30–60 s
| | |
|---|---|
| Actions | Follow the cart to the YARD (hint at **~23 s**). Contractor cutscene, then **build the Recycling Yard at 33–35 s**. Follow the truck to BUILD (~44 s). VERIFIED. |
| Unlocks | YARD (23 s), BUILD (34 s), "FIRST BLOCK" (36 s), "BUILD SOMETHING." (45 s), Foundation starts (~50 s). VERIFIED. |
| Upgrades | `best`: 11 purchases (trophy cash pays for them). `human`: 6. `noclaim`: **1**. VERIFIED. |
| Rewards | Contractor cash ($250 total), first stage payment +$58 at ~56 s. VERIFIED. |
| Confusion (UNCONFIRMED) | Two scene changes in 20 s. Players who haven't claimed trophies have $0 after the Yard and **nothing to do until ~95 s** (`noclaim` gap 33 → 95 s, VERIFIED for the bot). |
| Reasons to continue | Watching the yard machinery and truck. The world is clearly growing. |
| Abandonment risk | Medium. The chain is impressive, but the player is watching, not doing. |

### 1–2 min
| | |
|---|---|
| Actions | Back to the MINE to dig. Buy miners, cart and loading upgrades. Sell the Hut. |
| Unlocks | Stage payments +$99 (walls), +$82 (roof). **Hut sold at 89 s (`best`) / 99 s (`human`) / 107 s (`noclaim`).** VERIFIED. |
| Upgrades | `best` 10, `human` 6. VERIFIED. |
| Rewards | First sale (Hut base $450 × block value). Around 5 trophy claims for `best`. |
| Repetitive | Tap the gold card (`best`). |
| Reasons to continue | The house gets built in front of you. Next project preview (`#nextCard`). |
| Abandonment risk | Low to medium. |

### 2–3 min
| | |
|---|---|
| Actions | Buy upgrades. Tiny Cabin builds. |
| Unlocks | **Work Chamber blast at 2.7 min (`best` only).** `human` got it at 5.0 min, `cheap` at 6.0, `noclaim` at 5.4. Tiny Cabin sold at 2.7–3.2 min. Track reinforcement around now. VERIFIED. |
| Upgrades | About 8. |
| Rewards | Cabin stages (+$121…+$203) and the sale. |
| Confusion (UNCONFIRMED) | Track-strain storyline and chain-locked rows ("needs X first"). |
| Reasons to continue | Blast sequence, the first big world change. |
| Abandonment risk | Low for players who got this far. |

### 3–5 min
| | |
|---|---|
| Actions | Buy upgrades. One-Story House builds. Depth ~115 → 190 m (`best`), ~60 → 108 m (`human`). VERIFIED. |
| Unlocks | Excavator 4.7 min (`best`). One-Story House sold 4.5–5.0 min. Dinosaur-skull find at 165 m (~4.4 min for `best`, ~6.9 min for `human`). INFERRED from depth snapshots. |
| Upgrades | `best` ~10, `human` ~14 (`human` browses). |
| Rewards | Stages +$306…+$464. |
| Repetitive | **Decision gap of 55 s at 3.4–4.3 min (`best`) and 53 s at 3.8–4.7 min (`human`)**: nothing to buy, sell or claim. VERIFIED. |
| Abandonment risk | Medium. First real lull, with no event to fill it. |

### 5–7 min
| | |
|---|---|
| Actions | Buy upgrades. Two-Story Home (7 stages). |
| Unlocks | Two-Story Home sold 6.5 min (`best`) / 7.5 min (`human`). VERIFIED. |
| Upgrades | `best` 18 in 2 min (card taps), `human` 8. |
| Rewards | Stages +$447…+$716. |
| Repetitive | Watching stages fill. `human` had a 50 s gap at 5.1–6.0 min. VERIFIED. |
| Reasons to continue | Bigger building, new layers (Cave at 200 m). |
| Abandonment risk | Medium. This is around the 7m18s average playtime. INFERRED. |

### 7–10 min
| | |
|---|---|
| Actions | Buy upgrades. Farmhouse. |
| Unlocks | Silver (270 m) reached ~8.3 min (`best`). `human` got to 237 m. Farmhouse sold 9.6 min (`best`). VERIFIED. |
| Upgrades | `best` 23 in 3 min. |
| Rewards | Stages +$1.1K…+$1.9K. |
| Repetitive | **63 s gap at 6.75–7.8 min (`best`).** VERIFIED. Each house takes longer (~3 min) and nothing new happens while it builds. |
| Abandonment risk | Medium to high for casual players. INFERRED. |

**Summary**
- Structural dead zones:
  - ~33–95 s for anyone not claiming trophies, which includes everyone on a second run.
  - ~55 s around 3.5–4.5 min.
  - ~50–63 s around 5–8 min.
- Outside those gaps, the cadence of decisions comes almost entirely from the card and the CLAIM button. VERIFIED (bot).

---

## 5. Top 10 gameplay weaknesses

1. **The first minute is passive and opens on a negative.** Start appears ~5 s after load, then ~20 s of clicking for "rubble that isn't money", with no short-term goal. VERIFIED (timing). Its effect on conversion is UNCONFIRMED.
2. **The player's own clicking stops mattering.** About 2.9× the clicks gave +6% depth (`cheap` vs `best`). VERIFIED. There is no active skill moment after the opening.
3. **One-tap Best card.** 80 buys in 10 min from one button. It is never the pickaxe. It makes the site panels redundant. VERIFIED.
4. **Little upgrade decision depth.** Cheapest-first comes within ~5% of the optimiser. VERIFIED.
5. **No events or surprises.** Spec §12 isn't built. 2–3 find banners in 10 min. VERIFIED.
6. **Trophy cash outweighs construction**, at 39–45% of early cash. VERIFIED. This undercuts "construction creates value" and makes the reset bug hit harder.
7. **Start Over keeps trophies and claims.** Run 2 loses ~40% of early cash and every banner (§3). VERIFIED.
8. **YARD and BUILD are spectator sites.** No input there (`src/main.ts:73`). Their only purpose is buying, which the card makes unnecessary. VERIFIED. Whether players understand *why* they should visit after the tutorial is UNCONFIRMED.
9. **Lulls of 50–63 s from minute 3 onward** while long builds run. VERIFIED (bot).
10. **Weak return hooks.** The game is a finite ~60-minute run. Offline progress exists (8 h cap, `src/config.ts:439`), but nothing on leaving or returning gives a reason to come back tomorrow. The finale's only replay goal is best time. VERIFIED (code). Its effect on the 3.49% D1 is UNCONFIRMED.

Technical, related to the crash rates:
- **A single exception freezes the game for good.** `frame()` re-arms `requestAnimationFrame` at the end with no try/catch (`src/main.ts:212-281`).
- **The loading screen never lifts if boot code throws.** The code that lifts it is registered *after* all module-level init (`src/main.ts:288`), and there is no `window.onerror` or `unhandledrejection` handler anywhere. VERIFIED.
- We therefore have no visibility into crash causes. `analytics.ts` is a no-op sink.

---

## 6. Top 10 improvement opportunities

Each proposal covers: what the player does · why it's fun · loop change · frequency · economy · time · risk · test.

### 6.1 Rich Vein (interactive mining event) ★ strongest
- **Player:**
  - On the MINE, a glowing seam cracks open across the dig face with 3–5 pulsing weak points.
  - The player has ~8 s to tap them.
  - Each hit bursts gem-coloured rubble.
  - Getting all of them gives a "MOTHERLODE!" crit cascade.
- **Why fun:** A skill moment with a timer and big feedback. It brings back the clicking verb, which is currently dead, and reuses the crit and hit-stop juice that already feels good.
- **Loop:** Gives a reason to watch the MINE and to keep a decent pickaxe. It also makes the pointer naming the pickaxe meaningful.
- **Frequency:** Every 45–90 s of *active* time on the MINE (player clicked in the last ~10 s). Never within 20 s of a find, layer change or blast (Spec §12 rule). Never offline.
- **Economy:**
  - Vein rubble enters `S.rubble` at **×2.5 value** for the current depth.
  - Quantity ≈ 0.5 × cart capacity.
  - Cash still comes only from construction, because the material flows through the chain.
  - Note: the pile is capped at 3 cart loads (`pileCap`). Vein material must be added within that cap or allowed to exceed it for this one event. Decide this in code.
  - Missed weak points simply give less. No penalty.
- **Time:** 5–7 h, including FX and sound.
- **Risk:** Low to medium.
  - Tap targets on a moving face.
  - Mobile hit sizes.
  - Interaction with the Excavator and machines occupying the face.
- **Test:**
  - Bot plus human.
  - Event cadence logged.
  - Material conservation (dug + vein = held + built).
  - No events while off-site, during a blast or during the finale.
  - Phone tap test at 390 px.

### 6.2 Bottleneck pointer instead of the one-tap Best card
Covered in §2.7, Option B.
- **Player:** Sees "Haulage is the slowest link". Tapping it flies to that site, and the right row(s) pulse there.
- **Why fun:** Turns spending into a choice among a station's rows, and gives navigation a purpose.
- **Frequency:** Always visible.
- **Economy:** None.
- **Time:** 2–3 h.
- **Risk:** Low.
- **Test:** The pointer always names a reachable row. The tour step is updated. Nothing is purchasable from the card.

### 6.3 Opening rework: first-minute goal (no new systems)
- **Player:**
  - Taps START (or anywhere) within ~2 s.
  - Sees "Fill the cart: 3/8" over the cart.
  - The line becomes **"Rubble → blocks → buildings → $$$. Fill the cart!"** instead of "RUBBLE ISN'T MONEY".
  - The first cart departure is a mini-celebration.
- **Why fun:** A goal from second one, plus quick success.
- **Loop:** Same loop, explained earlier.
- **Frequency:** Once.
- **Economy:** None.
- **Time:** 2–3 h.
- **Risk:** Low.
- **Test:** Time from load to first input, and from load to Yard. A human first-time playtest with 3–5 people.

### 6.4 Buried treasure chunks (collection)
- **Player:**
  - Occasionally a dig-face chunk has an object poking out (coin purse, lantern, old helmet, gem, fossil fragment).
  - It takes a few extra hits.
  - It pops out with a reveal and goes into a **Collection** shelf with 3–4 items per layer.
- **Why fun:** Curiosity, plus "gotta catch them all" across 14 layers. A reason to visit deeper layers and to come back.
- **Frequency:** ~1 per 20–30 m.
- **Economy:**
  - Each item gives a small permanent bonus *through construction*: "displayed in your next building, +3% sale value".
  - Alternatively, purely cosmetic plus the existing +dig multiplier.
- **Time:** 8–12 h with art, so a v1.2 candidate. A cut-down version (6 items, drawn with existing find painters) is ~6 h.
- **Risk:** Medium. Needs save fields (a new optional field keeps saves compatible).
- **Test:** Save migration (old save gets an empty collection), item rates, no double award offline.

### 6.5 Cave-in (light hazard)
- **Player:**
  - Rocks fall on the rail and the cart stops.
  - Tap the 4–6 boulders to clear them.
  - If ignored, the crew clears them in ~20 s.
- **Why fun:** An urgent, physical "fix it" moment that the world shows first (Spec §7.8).
- **Frequency:** Every 2–4 min, only once the track exists.
- **Economy:** Short haul delay, no losses. Bonus rubble from boulders.
- **Time:** 5–7 h.
- **Risk:** Medium. Touches the cart state machine.
- **Test:** The cart state machine is never stuck, offline behaviour is unchanged, and the cart is never blocked during the tutorial.

### 6.6 Next-project choice
- **Player:** After a sale, picks between two next projects. For example a "Quick flip" (fewer blocks, lower value) or a "Showcase" (more blocks, +25% value, unlocks a town landmark).
- **Why fun:** The first real economic trade-off between tempo and payout.
- **Frequency:** Every sale (~1.5–3 min).
- **Economy:** Large. Needs pacing re-runs.
- **Time:** 6–10 h.
- **Risk:** Medium to high. `PROJECTS` ladder and `projSchema`.
- **Test:** Full 60-min pacing bot for both branches, plus save migration.

### 6.7 Layer arrival moments
- **Player:** Crossing into a new layer gives a short world beat: the colour wash changes, there's a sting, a "NEW: SILVER VEIN · blocks worth ×1.3" stamp, and the first Rich Vein of the layer is guaranteed.
- **Why fun:** Makes the 14 layers into 14 rewards.
- **Frequency:** 14 per run, roughly every 3–5 min.
- **Economy:** None, or the guaranteed vein.
- **Time:** 2–3 h if built on top of 6.1.
- **Risk:** Low.
- **Test:** Fires once per layer, survives a reload, and doesn't fire offline.

### 6.8 Return hook: "Your mine kept digging"
- **Player:** On return, sees the overnight haul physically: blocks stacked at the plot and the crew waving, plus one ready Rich Vein waiting.
- **Why fun:** Returning pays off right away.
- **Frequency:** Each return after 10 min or more away.
- **Economy:** Existing offline model, plus one vein.
- **Time:** 3–4 h.
- **Risk:** Low to medium.
- **Test:** The offline report still matches. No double vein on a quick reload.

### 6.9 Fossil Excavation (Spec V2-2)
- **Player:** Assign workers to brush out a big skeleton. Trade-off: those workers stop mining. Sell it to a collector.
- **Why fun:** The signature discovery fantasy. A real trade-off.
- **Frequency:** 3–5 per run.
- **Economy:** Large.
- **Time:** 2–3 days.
- **Risk:** High.
- **Verdict:** **Postpone.**

### 6.10 New-mine perks (prestige-lite, after the finale)
- **Player:** After reaching Hell, starts a new mine with one chosen perk: Rich Veins ×2, start with the Yard, faster carts, and so on. Best time is tracked per perk.
- **Why fun:** Replay with variety. A reason to start run 2 instead of quitting.
- **Frequency:** Per run.
- **Economy:** Run-scoped.
- **Time:** 1 day.
- **Risk:** Medium.
- **Verdict:** **Postpone.** Depends on the reset fix.

*Rejected as superficial:* daily login calendars, a second currency, more upgrade rows, more achievement tiers, notification spam.

---

## 7. Recommended v1.1 features (1–2 days)

**Theme: "the first minute is clearer, the mine has moments, the game doesn't play itself."**

| Pri | Item | Est. |
|---|---|---|
| **P0** | Achievement reset (§3.4): full reset of trophies and claims on Start Over and on "Start a new mine"; fix finale copy | 1–1.5 h |
| **P0** | Crash resilience: try/catch around `frame()` work (log and keep the rAF going); guarantee the loading screen lifts (try/finally around init, or move the timer first); `window.onerror` / `unhandledrejection` → `analytics.track('error', …)` + console | 1.5–2 h |
| **P1** | Opening rework (§6.3): `BOOT_MIN_MS` 2500 → ~1000 (keep the art while assets load), START visible immediately, positive first line, "Fill the cart x/8" goal | 2–3 h |
| **P1** | **Rich Vein event** (§6.1) | 5–7 h |
| **P1** | Best card → bottleneck pointer (§2.7 B, §6.2), including the pickaxe; tour step updated | 2–3 h |
| **P1** | CrazyGames SDK behind `platform.ts` (`loadingStart/Stop`, `gameplayStart/Stop`, `happytime`; ad pause hooks already exist). Needed for accurate conversion data and the next launch stage. Requirements are UNCONFIRMED; check the current SDK docs first. | 2–4 h |
| **P2** | Layer arrival stamp plus guaranteed first vein (§6.7), if time allows | 2–3 h |
| **P2** | Vein FX/SFX polish; mobile tap-size pass | 1–2 h |

**Total ≈ 15–22 h**, so 2 focused days. If only one day is available: both P0s + opening rework + Rich Vein.

**Deliberately not in v1.1:**
- Trophy reward rebalance. Trophies are 39–45% of early cash. Rebalancing would change pacing that you tuned with care. Fix the reset first, measure, and revisit in v1.2.
- `chainSlack` changes.
- Any save schema change.

**Save compatibility:** nothing above adds a save field. Rich Vein state is transient. VERIFIED by design: no `State` change needed.

---

## 8. Features to postpone (P3)

- Fossil Excavation (V2-2)
- Next-project choice
- Buried-treasure Collection (full version)
- Cave-in hazard
- New-mine perks / prestige-lite
- Side caves
- Sealed elevator / underground house cinematics
- Leaderboards
- Trophy reward rebalance
- A second construction plot
- Rest-area upgrades

Reason: each needs either save fields, a full 60-minute pacing re-tune, or more than a day on its own.

---

## 9. Exact affected files (v1.1 package)

| File | Change |
|---|---|
| `src/achievements.ts` | `resetAchievements()`; header comment |
| `src/main.ts` | Reset handler calls `resetAchievements()`; guarded `frame()`; boot lift guaranteed; `BOOT_MIN_MS`; global error handlers; call the vein update |
| `src/finale.ts` | "Start a new mine" resets trophies; copy change; trophy count |
| `src/intro.ts` | Immediate START, positive first line, cart-fill goal |
| `src/config.ts` | `intro` copy timings; new `vein` tuning block (cadence, weak points, window, value ×, qty share) |
| `src/vein.ts` (new) | Rich Vein state machine, spawn rules, hit test, rewards |
| `src/digface.ts` / `src/sim.ts` | Hook for tapping weak points; adding vein rubble (`addTo(S.rubble, …)`) within the pile rules |
| `src/render.ts` | Draw seam and weak points |
| `src/juice.ts`, `src/fx.ts`, `src/audio.ts` | Burst, MOTHERLODE cascade, sting |
| `src/panel.ts` | `updateBest()` → pointer (no `buy()`); `tagBottleneck()` unchanged or reused for pulsing rows |
| `src/econpage.ts` | Optionally add the tool as a pointer candidate; `bestNext()` engine otherwise unchanged |
| `src/tour.ts` | Rewrite the "Next Best Upgrade" step |
| `index.html`, `src/style.css` | Card label/markup; vein styles if DOM is used |
| `src/platform.ts` (+ new `src/crazygames.ts`) | SDK adapter |
| `src/analytics.ts` | `error` event |
| `claude.md`, `Spec.md`, `AGENT_CONTEXT.md` | Document reset semantics, Rich Vein, pointer |

---

## 10. Estimated implementation time

| Block | Hours |
|---|---|
| P0 achievements + crash resilience | 2.5–3.5 |
| Opening rework | 2–3 |
| Rich Vein | 5–7 |
| Bottleneck pointer | 2–3 |
| CrazyGames SDK | 2–4 |
| P2 layer stamp + polish | 3–5 |
| Regression and playtest passes | 3–4 |
| **Total** | **≈ 20–29 h** (P2 optional; core ≈ 17–24 h) |

---

## 11. Regression testing plan

1. **Build:** `npm run build` (tsc + vite). 0 type errors. Bundle size sanity check.
2. **Achievement reset:**
   - Fresh save → unlock and claim 3 trophies → Start Over (double click).
   - `dth_ach` is gone, the trophy page shows 0/50, the banner fires again for First Scratch, and CLAIM pays again.
   - Same through the finale's "Start a new mine" (use the dev menu at 990 m).
   - `dth_best` and `dth_settings` survive.
3. **Save compatibility:**
   - Load a v1.0.0 save (copy from the current build) → identical cash, depth, upgrades and trophies.
   - v5 → v6 migration path unchanged.
4. **Crash resilience:**
   - In the dev build, throw inside an update once → the game keeps running, the error is logged, `track('error')` fires.
   - Throw during init → the loading screen still lifts.
5. **Opening:**
   - Load → START visible ≤ 1.5 s after the boot art.
   - Load → first input → Yard. Compare against the baselines: 5.0 s to START, Yard at ~34 s game.
6. **Rich Vein:**
   - Bot run of 10 min at 4×: events every 45–90 s while active on the MINE, none off-site, none within 20 s of a find, layer change or blast, none during the finale, none offline.
   - Material conservation holds.
   - Manual phone test at 390×844 and 844×390: weak points tappable.
7. **Pointer:**
   - Never buys.
   - Always names a station whose row exists and isn't chain-held (or names the blocker).
   - Tapping navigates and pulses.
   - Tour step works.
8. **Pacing:**
   - Repeat the four 10-min bot runs (`best`→pointer-follower, `noclaim`, `cheap`, `human`) and compare against this audit's numbers.
   - One 6× full run to 1,000 m: should remain ~50–55 min (Rich Vein adds value, so check it doesn't fall below ~45).
9. **Platform:**
   - Cross-origin iframe, storage blocked, sandboxed iframe (as in `RELEASE_READINESS.md`).
   - Firefox and WebKit via Playwright.
   - SDK event order logged with `__dig.portalLog()`.
10. **Human:** 3–5 first-time players, silent observation of the first 3 minutes. Note where they hesitate, whether they find the vein, whether they understand why to visit YARD and BUILD.

---

## 12. Proposed development order

1. P0 achievement reset, then test 2.
2. P0 crash resilience, then test 4.
3. Opening rework, then test 5.
4. Rich Vein (core mechanic first, then FX/SFX), then tests 6 and 8.
5. Bottleneck pointer, then test 7.
6. CrazyGames SDK (after checking current docs), then test 9.
7. P2 items if time allows.
8. Docs (`claude.md`, `Spec.md`, `AGENT_CONTEXT.md`), version bump to 1.1.0, rebuild the upload zip, human playtest (test 10), then submit.

Commit each step separately so any one can be reverted.

---

## Appendix A — Low gameplay conversion (35.54%) investigation

**Definition.** CrazyGames' Basic Launch docs (seen through a search summary; `docs.crazygames.com` was unreachable from this environment) define conversion as **the share of players who play at least one minute after starting the game**. They cite slow loads and confusing onboarding as causes, and give **80%+** as typical for top titles. This is a *first-minute engagement* metric. It is not retention. UNCONFIRMED in detail: exactly what "starting" means without the SDK.

**What the code shows (VERIFIED):**
- **No CrazyGames SDK.** `platform.ts` is a no-op adapter, so CrazyGames receives no `loadingStop` or `gameplayStart`. How they time "starting the game" for SDK-less builds is UNCONFIRMED. If it's from page load, our forced loading screen and intro text count against us.
- **Time to first input ≈ 5.0 s after page load** on all three viewports (3.1–3.3 s loading art, of which 2.5 s is a forced minimum, then text lines, then START). That comes on top of CrazyGames' own loader and any preroll ad. UNCONFIRMED.
- **The first 25 s are clicking without money**, opening with "RUBBLE ISN'T MONEY".
- Mobile portrait works: canvas 390×472, panel below, START button 220×54. Landscape phone works: canvas 544×390, panel at the side. Taps use pointer events with `touch-action:none`. No blocking issue found.
- **Boot fragility:** if any module-level init throws, the loading screen never lifts and the game hangs on the key art. There is no global error handler. This is a plausible part of the 1.00% load-crash rate. UNCONFIRMED.
- **Run-time fragility:** an exception inside `frame()` stops the loop for good, which a player experiences as a freeze. Plausible part of the 0.90% gameplay-crash rate. UNCONFIRMED.

**Funnel arithmetic (INFERRED, needs CrazyGames confirmation):**
- 79K impressions × 1.8% CTR ≈ 1,420 clicks, but only 908 plays.
- Either about 36% of clickers never reach a "play", or the metrics count differently.
- Ask CrazyGames or check the dashboard definitions.

**What needs CrazyGames analytics or humans:**
- How "play start" and the 1-minute window are measured without the SDK.
- Where in the first minute players leave.
- Device split. If mobile is large, check the phone flow with real thumbs.
- Error messages behind the crash rates.
- Whether the preroll ad length counts against us.

---

## Appendix B — Raw 10-minute bot results

| Metric (10 game-min) | best | noclaim | cheap | human |
|---|---|---|---|---|
| Recycling Yard built | 0.57 min | 0.55 | 0.58 | 0.58 |
| Sales (min) | 1.49, 2.70, 4.69, 6.53, 9.55 | 1.79, 3.12, 5.40, 8.64 | 1.47, 2.86, 4.49, 6.66, 9.58 | 1.65, 3.16, 4.95, 7.45 |
| Work Chamber | 2.7 min | 5.4 | 6.0 | 5.0 |
| Excavator | 4.7 min | 6.9 | 9.6 | – |
| Construction income | $53.7K | $21.6K | $51.7K | $23.5K |
| Trophy cash claimed | $33.9K | $0 | $41.6K | $5.0K |
| Purchases | 80 | 47 | 84 | 59 |
| Clicks | ~2,300 | ~2,300 | ~800 | ~300 |
| Final depth | 290 m | 257 m | 274 m | 237 m |
| Own tool level | **0** | **0** | 3 | 2 |
| Decision gaps ≥ 40 s | 55 s @3.4m, 63 s @6.75m | **62 s @0.55m**, 87 s @5.4m | – | 53 s @3.8m, 50 s @5.1m, 41 s @6.6m |
| Console errors | 0 | 0 | 0 | 0 |

*Prices in the `cheap`/`human` logs are the button's label after the click (the next level's price). Counts and timings are unaffected.*
