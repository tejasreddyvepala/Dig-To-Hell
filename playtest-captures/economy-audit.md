# Dig to Hell — Economy Audit (BEFORE: read-only audit · AFTER: rebuild notes at the end)

Written for: Tejas, before rebalancing. Source of truth: `src/config.ts`, `src/economy.ts`, `src/surface.ts`, `src/construction.ts`, `src/workers.ts`, `src/sim.ts`, `src/cart.ts` at commit `4136d95`. Nothing was changed.

**Method.** Values were read from code. Behaviour was measured with headless simulations that import the real modules (scratchpad scripts `audit.mts`, `rates.mts`), 30 Hz steps:
- **Run A (main):** fresh save, player clicks 3×/s for 20 min, buys the **cheapest affordable item every 5 s**, sells each property immediately.
- **Run B:** same but buys **major items first** (tools, track, chamber, excavator).
- **Run C:** clicks 3×/s for 5 min, then **idle** (crew only) to 30 min.

Unit used throughout: **1 SP (Starter Payout) = $95**, the contractor's seed payment (`CFG.intro.seedCash`).

---

## 1. Current economy summary

**Cash sources (only three):** the contractor's one-time seed purchase of raw rubble ($95, plus a no-soft-lock safety net), **construction stage milestones** (8% of the property value, flat per stage), and **property sales** (Tiny Cabin $900, Two-Story Home $4,200; both × Block Quality).

**What decides income:** only *blocks reaching the plot* and the *Block Quality multiplier*. Rubble depth/material value (`valueAt`, up to ×14 at 270 m) is **ignored by construction**: it only affects what the contractor pays. Builders consume a fixed **3 blocks/s** (180/min) and **no upgrade changes that**. From ~minute 7 of an active session, **construction is the permanent bottleneck** and income becomes independent of digging, transport, processing, crew or clicking. In Run C (idle after 5 min) the player sold the same 6 properties by minute 20 as the fully active Run A.

**Shape over time:** money-starved for 2.5 min (≈$0–110 balance), then a **$900 spike** (cabin sale = 9.5 SP), then a **$6,300 spike** at ~6:30 (66 SP), then Two-Story Homes repeating every ~2:42, each worth $9–16k as Block Quality stacks. After ~7 min almost every purchase is trivially affordable except Steel Rail, the Jackhammer, and the escalating Digger/Block Quality levels. The 300 m content ends at ~10–13 min of active play (~17 min idle).

**Mathematical vs. player-perceived:** mathematically the chain is stable (no soft-locks, material conserved, purchases always become affordable). The **perceived** hierarchy is broken in several places. A tiny rubble pile pays more than a house foundation. A whole recycling plant costs the same as one worker. A hand tool costs twice an excavator and out-digs it 9×. Going deeper earns nothing.

---

## 2. Part 1 — narrated fresh game (Run A, actual values)

**00:00** — Cash $0 · Pickaxe (power 1, yield ×1) · 0 workers · Narrow Shaft · cart 50 capacity · Wood Track (safe load 70) · YARD + BUILD locked.
Digging dirt: a chunk has 3 HP, so the Pickaxe breaks one every 3 clicks → **2 rubble per break** (×2 on a 7% crit). At 3 clicks/s ≈ **146 rubble/min** (measured).

**00:03** — 8 rubble dug → the cart starts loading (3.5/s). It leaves when full (50) or when tapped.

**00:27** — **First cart departs** (YARD unlocks). Trip at ~10 m ≈ 4.6 s up.

**00:37** — **Contractor seed:** he buys **28.0 raw rubble** at `unit value × $3` (unit value 1.23 at ~7 m → ~$3.39/unit) **until the player holds $95**, leaving the rest for the yard. **Cash $0 → $95.**
→ **Recycling Yard −$80 → $15** (the only thing affordable; the tutorial's forced buy). The leftover raw rubble becomes the **first block** at 0:39 (BUILD unlocks).

**00:51** — First truck at the plot: ~18 blocks.

**01:12** — **Foundation auto-starts** (needs 30 on the plot; second truck). **01:22 Foundation complete +$72 → $87.**

**01:23–02:28** — Each Tiny Cabin stage pays **$72** regardless of size (Frame 30 blocks, Walls 40, Roof 30, Finishing 20). Between stages the player can afford one cheap item per stage: Loading Speed Lv1 $50, **Iron Pickaxe $75** (1:48; doubles player output: 146 → 296/min), Processing Speed Lv1 $75, Loading Speed Lv2 $78. Balance never exceeds $110.

**02:31** — **Tiny Cabin complete → SALE +$900 → $997.** Total cabin income: 5 × $72 + $900 = **$1,260 for 150 blocks ($8.40/block)**.
The spike buys in the next 40 s: Digger #1 $80 (adds only ~18 rubble/min), Cart Capacity Lv1 $80 (cart 73 → **overloads Wood Track**, trips −30%), Cart Speed Lv1 $100, Digger #2 $103, Processing Lv2 $120, Loading Lv3 $121, Cart Capacity Lv2 $128 (95), Digger #3 $132.

**02:53** — Two-Story Home starts (Foundation 60 blocks). **3:13 Foundation +$336.** Block Quality becomes visible after the first sale: **Lv1 $140** → every future stage and the sale are now ×1.25 (stages $420). Reinforced Wood Track $150 (3:19) fixes the overload (safe load 140).

**03:13–06:26** — Home stages pay $336 → $420 → $504 as Block Quality rises mid-project. Work Chamber becomes *available* at 2:53 (2 diggers) for **$450**, but in the cheapest-first run it is not bought until 7:14 because it is never the cheapest item. Heavy Pickaxe $260 at 6:19 (player 296 → 618/min).

**06:26** — **Two-Story Home SALE +$6,300** (BQ Lv2: $4,200 × 1.5) → **$6,985**. Total for that house: $6,300 + stages ≈ **$9,200 for 460 blocks**. The spike buys 16 items in ~90 s: Diggers #6–#9, Cart Capacity/Speed/Loading Lv4–7, Raw Storage Lv3–4, Processing Lv4–5, Block Quality Lv3, **Work Chamber $450** (7:14), **Iron Rail $700** (7:54).

**From ~07:00** — Construction consumes 169–173 blocks/min (the 180/min cap minus auto-start gaps) and never more, while the plot pile and yard block pile grow without limit. **Excavator $900** (9:29) adds ~300 rubble/min to a dig pile that is already 1,900 and climbing. **Jackhammer $1,800** (12:15). **Steel Rail $2,500** (14:46).

**Depth:** 20 m @1:00 · 78 m @3:00 · 121 m @5:00 · 253 m @10:00 · **300 m (end of content) @~12:45** (Run A). Run B reached 300 m at ~10 min; Run C (idle after 5 min) at ~17:30.

**Later loop:** the Two-Story Home repeats forever (no Project #3). Each repetition: sale $4,200 × (1 + 0.25 × BQ) + 7 stages at 8%; one every ~2:42.

---

## 3. Part 2 — full income table

| Source | When | Player effort / requirement | Material | Time / progression | Cash | Repeatable | Notes |
|---|---|---|---|---|---|---|---|
| Contractor seed | First cart reaches the surface (~0:37) | Dig ~28 rubble + send a cart | ~28 raw rubble (taken until you hold $95) | ~35 s | **$95** (capped by `seedCash`) | Once | Price per unit = depth value × $3 × (1 + 0.25·BQ). The only income that uses depth value. |
| Contractor safety net | Only while no yard and cash < $80 | none | raw rubble | — | ~$3–4/unit | While cash < $80 | Never triggers in normal play (the seed covers the $80 yard). |
| Tiny Cabin stage ×5 | Each stage completes (auto) | Deliver the stage's blocks | 30 / 30 / 40 / 30 / 20 blocks | ~10–25 s each | **$72 each** (8% of $900) | Once (cabin is only built once) | Flat: Finishing (20 blocks) pays the same as Walls (40). |
| Tiny Cabin sale | Cabin complete | Press SELL | 150 blocks total | ~2:31 | **$900** | Once | Cabin total $1,260 = **$8.40/block** |
| Two-Story Home stage ×7 | Each stage completes (auto) | Deliver blocks | 60 / 70 / 80 / 80 / 70 / 60 / 40 | ~20–45 s each | **$336** × BQ factor ($420 @BQ1 … $840 @BQ6) | Every house | Flat per stage again: Landscaping (40) = Upper Floor (80). |
| Two-Story Home sale | Home complete | Press SELL | 460 blocks total | first ~6:26, then every ~2:42 | **$4,200** × (1 + 0.25·BQ) ($6,300 @BQ2, $10,500 @BQ6) | **Forever** (Project #2 repeats) | House total @BQ0 $6,552 = **$14.24/block**; @BQ6 $16,380 = **$35.6/block** |
| Finds (coin 12 m, car 45 m) | Depth | — | — | — | $0 | — | +10% dig power each, no cash. |

Nothing else creates cash: no truck income, no processing income, no depth reward.

---

## 4. Part 2 — full expense table

Costs: Digger `80 × 1.28^owned`; level upgrades `ceil(base × growth^level)`; Track/Tools/Yard/Chamber/Excavator fixed.

| Purchase | Unlock | Level | Cost | What it physically does | Numeric benefit | Likely affordable (Run A) | Repeatable | Next level |
|---|---|---|---|---|---|---|---|---|
| Recycling Yard | Contractor seed | — | **$80** | Hopper, crusher, auger, press, block stack, truck | Enables ALL construction income | 0:37 (forced) | Once | — |
| Iron Pickaxe | Yard built | 1 | $75 | Heavier pick | power ×1.5, yield ×1.5 → player 146 → 296 rubble/min (dirt, 3 cps) | 1:24 | Once | Heavy $260 |
| Heavy Pickaxe | 25 m | 2 | $260 | Big pick | power 2.25, yield 2.5 → 618/min | 2:35 | Once | Jackhammer $1,800 |
| Jackhammer | 75 m | 3 | **$1,800** | Burst tool | 4 × 1.4 power per click, yield 3.5 → **2,741/min** at dirt, 900/min at cave | 6:30 | Once | — |
| Digger | Yard built | n | $80, 103, 132, 168, 215, 275, 352, 451, 577, 739, 945, 1,209, 1,548, 1,981 … | One more worker | **~18 rubble/min at dirt, 11 clay, 8 stone, 5 cave** (rests 15%) | #1 at 1:24 | Unlimited (×1.28) | ×1.28 |
| Work Chamber | ≥ 2 diggers | 1 | **$450** | Blast the shaft into a chamber | No direct production; unlocks the Excavator, 5 visible diggers | 2:53 (available and affordable) | Once | — |
| Excavator | Work Chamber | 1 | **$900** | Heavy machine | ~**300 rubble/min at any depth** (one whole chunk per 2.4 s bite × 12) | immediately after the chamber | Once (max 1) | — |
| Cart Capacity | Yard | L | 80, 128, 205, 328, 525, 839, 1,343, 2,148 … | Bigger cart | +45% of base per level (50 → 73 → 95 → 118 …) | 1:24 | 30 levels | ×1.6 |
| Cart Speed | Yard | L | 100, 160, 256, 410, 656, 1,049, 1,678 … | Faster cart | +25% of base per level | 1:48 | 30 | ×1.6 |
| Loading Speed | Yard | L | 50, 78, 121, 187, 289, 448, 694, 1,075, 1,666 … | Faster loading | +35% of base per level | 1:24 | 30 | ×1.55 |
| Track Strength | Yard | 1 / 2 / 3 | **$150 / $700 / $2,500** | Rebuild the track | Safe load 70 → 140 → 260 → 450; speed ×1.15 / 1.3 / 1.5; removes the −30% overload | Reinforced 2:36 · Iron 6:30 · Steel 9:18 | 3 tiers | — |
| Processing Speed | Yard | L | 75, 120, 192, 308, 492, 787, 1,259, 2,014 … | Faster crusher/press | +35% of 2/s per level | 1:24 | 30 | ×1.6 |
| Raw Storage | raw ≥ 50% of cap (appears ~4 min) | L | 110, 182, 300, 495, 816, 1,346 … | Bigger hopper | +50% of 120 per level | 4:12 | 30 | ×1.65 |
| Block Quality | After the first property sale | L | **140, 245, 429, 751, 1,313, 2,298 …** | Better blocks (sign/board/weigh station) | **+25% of base property value per level, applied to every future stage AND the sale (at sale time)** | 2:36 | 30 | ×1.75 |

Not purchasable: construction speed, builders, truck capacity/speed, new projects. There are **no construction-related upgrades** in code.

---

## 5. Part 3 — representative cash ledger (Run A, cheapest-first, actual values)

```
  0:00  START                                                        $0
  0:37  CONTRACTOR buys 28.0 raw rubble (seed)       +     $95  →      $95   ← 1.00 SP
  0:37  BUY Recycling Yard                           -     $80  →      $15   (forced; enables everything)
  1:22  STAGE Tiny Cabin · Foundation                +     $72  →      $87   ← smaller than the seed
  1:23  BUY Loading Speed Lv1                        -     $50  →      $37
  1:47  STAGE Tiny Cabin · Frame                     +     $72  →     $109
  1:48  BUY Iron Pickaxe                             -     $75  →      $34
  2:12  STAGE Tiny Cabin · Walls                     +     $72  →     $106
  2:13  BUY Processing Speed Lv1                     -     $75  →      $31   (processing is idle: zero effect)
  2:23  STAGE Tiny Cabin · Roof                      +     $72  →     $103
  2:28  BUY Loading Speed Lv2                        -     $78  →      $25
  2:31  STAGE Tiny Cabin · Finishing                 +     $72  →      $97
  2:31  SALE Tiny Cabin (#1)                         +    $900  →     $997   ← SPIKE (9.5 SP) → 8 buys in 40 s
  2:33  BUY Digger #1                                -     $80  →     $917
  2:38  BUY Cart Capacity Lv1                        -     $80  →     $837   (cart 73 > track 70: overload)
  2:43  BUY Cart Speed Lv1                           -    $100  →     $737
  2:48  BUY Digger #2                                -    $103  →     $634   (Work Chamber now available, $450)
  2:53  BUY Processing Speed Lv2                     -    $120  →     $514
  2:58  BUY Loading Speed Lv3                        -    $121  →     $393
  3:03  BUY Cart Capacity Lv2                        -    $128  →     $265
  3:08  BUY Digger #3                                -    $132  →     $133
  3:13  STAGE Two-Story Home · Foundation            +    $336  →     $469
  3:13  BUY Block Quality Lv1                        -    $140  →     $329   ← +$1,050 on this house's sale alone
  3:19  BUY Reinforced Wood Track                    -    $150  →     $179
  3:24  BUY Cart Speed Lv2                           -    $160  →      $19
  4:09  STAGE Two-Story Home · Ground Floor          +    $420  →     $439
  4:09  BUY Raw Storage Lv1                          -    $110  →     $329   (storage never fills: zero effect)
  4:14  BUY Digger #4                                -    $168  →     $161
  4:52  STAGE Two-Story Home · Upper Floor           +    $420  →     $581
  4:54  BUY Raw Storage Lv2                          -    $182  →     $399
  4:59  BUY Loading Speed Lv4                        -    $187  →     $212
  5:04  BUY Processing Speed Lv3                     -    $193  →      $19
  5:19  STAGE Two-Story Home · Walls & Siding        +    $420  →     $439
  5:24  BUY Cart Capacity Lv3                        -    $205  →     $234
  5:29  BUY Digger #5                                -    $215  →      $19
  5:51  STAGE Two-Story Home · Roof                  +    $420  →     $439
  5:54  BUY Block Quality Lv2                        -    $245  →     $194   ← +$1,050 more on this sale
  6:12  STAGE Two-Story Home · Windows & Doors       +    $504  →     $698
  6:14  BUY Cart Speed Lv3                           -    $257  →     $441
  6:19  BUY Heavy Pickaxe                            -    $260  →     $181
  6:26  STAGE Two-Story Home · Landscaping           +    $504  →     $685
  6:26  SALE Two-Story Home (#2)                     +  $6,300  →   $6,985   ← SPIKE (66 SP) → 16 buys in 90 s
  6:29  BUY Digger #6                                -    $275  →   $6,710
  6:34  BUY Loading Speed Lv5                        -    $289  →   $6,421
  6:39  BUY Raw Storage Lv3                          -    $300  →   $6,121
  6:44  BUY Processing Speed Lv4                     -    $308  →   $5,813
  6:48  STAGE Two-Story Home · Foundation            +    $504  →   $6,317
  6:49  BUY Cart Capacity Lv4                        -    $328  →   $5,989
  6:54  BUY Digger #7                                -    $352  →   $5,637
  6:59  BUY Cart Speed Lv4                           -    $410  →   $5,227
  7:04  BUY Block Quality Lv3                        -    $429  →   $4,798
  7:09  BUY Loading Speed Lv6                        -    $448  →   $4,350
  7:14  BUY Work Chamber                             -    $450  →   $3,900   (blast the mine open: same price as Loading Lv6)
  7:15  STAGE Two-Story Home · Ground Floor          +    $588  →   $4,488
  7:19  BUY Digger #8                                -    $451  →   $4,037
  7:24  BUY Processing Speed Lv5                     -    $492  →   $3,545
  7:29  BUY Raw Storage Lv4                          -    $495  →   $3,050
  7:34  BUY Cart Capacity Lv5                        -    $525  →   $2,525
  7:39  BUY Digger #9                                -    $577  →   $1,948
  7:44  BUY Cart Speed Lv5                           -    $656  →   $1,292
  7:48  STAGE Two-Story Home · Upper Floor           +    $588  →   $1,880
  7:49  BUY Loading Speed Lv7                        -    $694  →   $1,186
  7:54  BUY Iron Rail                                -    $700  →     $486
  8:16  STAGE Two-Story Home · Walls & Siding        +    $588  →   $1,074
  8:19  BUY Digger #10                               -    $738  →     $336   (10th digger costs more than Iron Rail; adds ~8/min)
  8:41  STAGE Two-Story Home · Roof                  +    $588  →     $924
  8:44  BUY Block Quality Lv4                        -    $751  →     $173
  9:02  STAGE Two-Story Home · Windows & Doors       +    $672  →     $845
  9:04  BUY Processing Speed Lv6                     -    $787  →      $58
  9:16  STAGE Two-Story Home · Landscaping           +    $672  →     $730
  9:16  SALE Two-Story Home (#3)                     +  $8,400  →   $9,130
  9:19  BUY Raw Storage Lv5                          -    $816  →   $8,314
  9:24  BUY Cart Capacity Lv6                        -    $839  →   $7,475
  9:29  BUY Excavator                                -    $900  →   $6,575   (≈ Digger #11; ~16–60 diggers of output)
  9:34  BUY Digger #11                               -    $945  →   $5,630
  9:38  STAGE Two-Story Home · Foundation            +    $672  →   $6,302
 10:00  BUY Block Quality Lv5                        -  $1,314  →     $396
 11:58  SALE Two-Story Home (#4)                     +  $9,450  →  $11,693
 12:15  BUY Jackhammer                               -  $1,800  →   $5,001   (2× the Excavator's price)
 14:46  BUY Steel Rail                               -  $2,500  → (most expensive item in the game)
```

**Payoff → what it enables → cash left**
- Seed $95 → Recycling Yard → $15 left (exactly one forced purchase).
- Cabin stages $72 each → one cheap upgrade each (Loading/Iron Pick/Processing) → ~$25–35 left after each.
- Cabin sale $900 → 8 purchases (2 diggers + all transport Lv1–2 + Processing Lv2) → $133 left.
- Home #1 stages $336–504 → one or two items each.
- Home #1 sale $6,300 → 16 purchases including Work Chamber + Iron Rail → still ~$500 left.
- Home #2+ sales $8,400–13,000 → anything in the shop (Excavator, Jackhammer, Steel Rail) within a minute.

Run B (majors first) reaches the same income curve. Heavy Pickaxe at 2:31, Reinforced Track 2:36, Work Chamber 4:52, Jackhammer/Excavator/Iron/Steel all within 20 s of the 6:38 home sale. Its house sales land at almost the same times as Run A, because construction is the cap.

---

## 6. Part 6 — normalized to the Starter Payout (1 SP = $95)

| Item | Cash | SP |
|---|---|---|
| **Contractor seed (income)** | $95 | **1.00** |
| Tiny Cabin stage (income, each) | $72 | **0.76** |
| Tiny Cabin sale (income) | $900 | 9.47 |
| Tiny Cabin total (income) | $1,260 | 13.3 |
| Two-Story stage @BQ0 (income) | $336 | 3.54 |
| Two-Story sale @BQ0 (income) | $4,200 | 44.2 |
| Two-Story total @BQ0 (income) | $6,552 | 69.0 |
| Two-Story total @BQ6 (income, repeats every ~2:42) | $16,380 | 172 |
| Loading Speed Lv1 | $50 | 0.53 |
| Iron Pickaxe | $75 | 0.79 |
| Processing Speed Lv1 | $75 | 0.79 |
| **Recycling Yard** | $80 | **0.84** |
| Digger #1 | $80 | 0.84 |
| Cart Capacity Lv1 | $80 | 0.84 |
| Cart Speed Lv1 | $100 | 1.05 |
| Raw Storage Lv1 | $110 | 1.16 |
| Block Quality Lv1 | $140 | 1.47 |
| Reinforced Wood Track | $150 | 1.58 |
| Digger #5 | $215 | 2.26 |
| Heavy Pickaxe | $260 | 2.74 |
| **Work Chamber** | $450 | **4.74** |
| Iron Rail | $700 | 7.37 |
| Digger #10 | $739 | 7.78 |
| **Excavator** | $900 | **9.47** |
| Block Quality Lv5 | $1,314 | 13.8 |
| **Jackhammer** | $1,800 | **18.9** |
| Steel Rail | $2,500 | 26.3 |

---

## 7. Part 4 — physical scale vs economic scale

| Action / object | Perceived physical scale | Perceived difficulty | Game cost | Game payout | Relative economic importance (in code) |
|---|---|---|---|---|---|
| Starter rubble pile sold | Tiny (one cart) | Trivial (~35 s) | — | $95 | **Higher than any cabin stage** |
| Pickaxe upgrade (Iron) | Tiny | — | $75 | +150 rubble/min | Highest value per $ in the early game |
| Loading/Cart/Track levels | Small | — | $50–$2,500 | transport | Matters ~2–7 min, then irrelevant |
| Worker (Digger) | Small (a person) | — | $80 → $1,981 | +5–18 rubble/min | **Weakest purchase in the game** |
| **Recycling Yard (industrial plant + truck)** | **Medium/Large** | — | **$80** | enables all income | **Priced like one worker** |
| Processing Speed / Raw Storage | Medium (crusher, hopper) | — | $75–$2,000 | ~0 (never the bottleneck) | Zero effect while it's being bought |
| Track rebuild (Reinforced) | Medium | — | $150 | removes −30% | Fair |
| Steel Rail | Medium | — | **$2,500** | removes overload | **Most expensive thing in the game** |
| Work Chamber (blast the mine open) | Large | — | $450 | none directly | Cheaper than Iron Rail; ≈ Loading Speed Lv6 |
| Excavator | Large machine | — | $900 | ~300 rubble/min | Same price as the 11th worker; half a hand tool |
| Jackhammer | Small hand tool | — | **$1,800** | **~2,700 rubble/min at dirt** | 2× the excavator's price, 9× its output |
| House foundation (Cabin) | Large | 30 blocks | — | **$72** | **< starter rubble pile** |
| Cabin finishing (20 blocks) vs walls (40) | — | 2× effort for walls | — | $72 = $72 | Effort not rewarded |
| Finished cabin | Large | 150 blocks | — | $900 (+$360 stages) | ≈ Excavator price |
| Two-Story Home | Very large | 460 blocks | — | $4,200–$10,500 (+stages) | Dwarfs everything; repeats forever |

---

## 8. Part 7 — value ladder: code order vs expected order

| # | **Code order (by $)** | $ | **What a player would expect (by physical importance)** |
|---|---|---|---|
| 1 | Loading Speed Lv1 | 50 | starter rubble pile sale (tiny) |
| 2 | **Tiny Cabin stage (income)** | 72 | basic tool upgrade (Iron Pickaxe) |
| 3 | Iron Pickaxe / Processing Lv1 | 75 | loading/cart small upgrades |
| 4 | **Recycling Yard / Digger #1 / Cart Capacity Lv1** | 80 | a worker |
| 5 | **Contractor rubble sale (income)** | 95 | a construction stage (income) |
| 6 | Cart Speed Lv1 | 100 | track rebuild |
| 7 | Raw Storage Lv1 | 110 | processing upgrades |
| 8 | Block Quality Lv1 | 140 | **Recycling Yard (industrial plant)** |
| 9 | Reinforced Track | 150 | Heavy Pickaxe |
| 10 | Heavy Pickaxe | 260 | Work Chamber (blasting the mine) |
| 11 | Two-Story stage (income) | 336 | Jackhammer |
| 12 | **Work Chamber** | 450 | **Excavator** |
| 13 | Iron Rail | 700 | finished cabin (income) |
| 14 | Digger #10 | 739 | Steel Rail / industrial track |
| 15 | **Excavator = Tiny Cabin sale** | 900 | Two-Story Home stage (income) |
| 16 | **Jackhammer** | 1,800 | Two-Story Home (income) |
| 17 | Steel Rail | 2,500 | |
| 18 | Two-Story sale | 4,200+ | |

The biggest mismatches: the Recycling Yard sits 4th in the code but should be near the Work Chamber. The cabin stage sits 2nd as income but should be well above the rubble sale. The Jackhammer sits above the Excavator but should be below it. Steel Rail is the most expensive item, above the Excavator.

---

## 9. Part 5 — economic absurdities by category

**A. Payout inversion**
- Contractor: ~28 raw rubble, ~35 s → **$95**. Foundation: 30 processed blocks, plus the yard, truck and builders → **$72**. The game communicates that unprocessed rubble is worth more than a finished foundation. Per unit: raw rubble $3.39 vs Foundation $2.40/block.
- The whole Tiny Cabin (stages + sale) pays $8.40/block. That is only 2.5× the raw contractor price, despite crushing, pressing, trucking and building.
- Within a project every stage pays the same 8%: Cabin Finishing (20 blocks) = Walls (40); Home Landscaping (40) = Upper Floor (80).

**B. Cost inversion**
- **Recycling Yard $80 = Digger #1 = Cart Capacity Lv1**, and cheaper than Cart Speed Lv1 ($100), Raw Storage Lv1 ($110) and Block Quality Lv1 ($140). The entire industrial chain is the cheapest building in the game.
- **Jackhammer $1,800 = 2 × Excavator $900.** A hand tool costs twice the heavy machine.
- **Steel Rail $2,500** is the most expensive purchase, nearly 3× the Excavator and 5.6× the Work Chamber.
- **Iron Rail $700 > Work Chamber $450.** Re-railing costs more than blasting the mine open.
- The Excavator ($900) costs about the same as the 11th Digger ($945).

**C. Progression inversion**
- **Depth gives nothing economically.** Material value grows ×14 by 270 m but only the contractor uses it. Deeper chunks are harder, so a clicking player drops from 146 to 53 rubble/min (Pickaxe, dirt → cave) and a Digger from 18 to 5/min. Going deeper strictly lowers output. The material banner no longer claims a value increase, but Spec's "Beyond 300 m" section still says depth value "continues".
- **Diggers get worse while getting more expensive**: cost ×1.28 each, output per digger falls with depth.
- The Two-Story Home repeats forever with no Project #3. The later economy is the same house, re-sold at a growing multiplier.

**D. Effort / payoff mismatch**
- Cabin, 150 blocks: $1,260. Home, 460 blocks (3.1× the blocks): $6,552 (5.2×). That's a reasonable escalation, but it comes from the base values, not from any "bigger achievement" rule.
- After ~minute 7, active clicking adds nothing to income: Run C (idle from 5 min) sold the same 6 houses by minute 20 as the active Run A. Every dig/transport upgrade bought after ~7 min has zero effect on income.

**E. Upgrade value problems**
- **Processing Speed**: processing (2/s) is never the bottleneck while it's being bought. The raw pile sits at ~0 most of the time because the cart delivers less than 2/s until mid-game, and later construction caps everything anyway. Cheapest-first players buy it at 2:13 for no benefit.
- **Raw Storage**: the 120-unit hopper never fills in any run (raw maximum ~240 with upgrades). It's bought for no benefit.
- **Digger**: $80 for ~18 rubble/min, against Iron Pickaxe $75 for ~150/min. That's 8× worse per $ early, and 30× worse at depth.
- **Work Chamber**: $450 with no direct production effect. Its only economic effect is unlocking the Excavator.
- **Excavator**: ~300 rubble/min arrives when the dig-site pile already holds thousands and income is capped by construction. Its output is mostly wasted.

**F. Money spike**
- Cabin sale $900 (9.5 SP) at 2:31 → 8 purchases in 40 s.
- First home sale $6,300 (66 SP) at 6:26 → 16 purchases in 90 s.
- Later houses pay $8.4–13k every ~2:42, making nearly every purchase instant.
- **Block Quality** is a compounding spike engine. $140 adds +$1,050 to the next house's sale plus +$84 per stage, it applies retroactively at sale time (buy it one second before selling), and it repeats on every future house, with 30 levels available.

**G. Money starvation**
- 0:37–2:31: the balance never exceeds ~$110 and each $72 stage buys exactly one small item. Interesting decisions are impossible: the Heavy Pickaxe ($260) and Reinforced Track ($150) are out of reach until the cabin sells.
- Reinforced Track: available from the start, affordable only at ~2:36 (Run A). By then the overload has already happened, so the fix lands immediately after the problem (OK).
- Iron Rail waited 185 s and Steel Rail 80 s in Run A. Run B (majors first) bought both right after a sale.

**Display / offline mismatch (mathematical, not perceived)**
- The UI's crew rate and offline progress use the analytic `crewRubbleRate`. For the Excavator that gives **528/min at dirt and 144/min at cave**. Its real in-game output is **~290–325/min at every depth** (one whole chunk per bite). So the panel over-states it at shallow depth and under-states it deep, and offline progress differs from online.

---

## 10. Part 8 — time to afford (Run A: from "visible in the panel" to "cash ≥ cost")

| Purchase | Visible | First affordable | Wait | Verdict |
|---|---|---|---|---|
| Recycling Yard | 0:37 | 0:37 | 0 s | forced (the seed is sized for it) |
| Iron Pickaxe | 0:37 | 1:24 | 45 s | fine (first stage pays it) |
| Digger #1 | 0:37 | 1:24 | 45 s | fine, but a poor buy |
| Cart Capacity Lv1 | 0:37 | 1:24 | 45 s | fine |
| Loading Speed Lv1 | 0:37 | 1:24 | 45 s | fine |
| Processing Speed Lv1 | 0:37 | 1:24 | 45 s | affordable early, useless early |
| Cart Speed Lv1 | 0:37 | 1:48 | 70 s | slightly slow |
| Reinforced Wood Track | 0:37 | 2:36 | 116 s | slow, but only needed after Cart Capacity Lv1 (2:38) → effectively 0 s |
| Heavy Pickaxe | 1:54 (25 m) | 2:36 | 40 s | fine (cabin sale) |
| Block Quality Lv1 | 2:36 (after sale) | 2:36 | 0 s | instant: too cheap for its power |
| Work Chamber | 2:53 (2 diggers) | 2:53 | 0 s | "expensive but exciting" by design, yet instantly affordable |
| Raw Storage Lv1 | 4:00 | 4:12 | 10 s | fine, useless |
| Iron Rail | 3:24 | 6:30 | **185 s** | annoyingly slow if overloaded; fixed by the house sale |
| Jackhammer | 6:24 (75 m) | 6:30 | 5 s | arrives with a sale spike |
| Excavator | 7:18 (chamber) | 7:18 | 0 s | instant: no anticipation |
| Steel Rail | 8:00 | 9:18 | 80 s | fine |

From zero income (no construction) almost nothing is affordable: there is no income besides construction.

---

## 11. Part 9 — economic power curve and bottleneck timeline (Run A)

| Time | Cash income | Rubble dug / min | Into the yard (transport) / min | Blocks pressed / min | Construction / min | Largest reasonable purchase | Bottleneck |
|---|---|---|---|---|---|---|---|
| 0:00 | $0 | ~146 (player) | 0 | 0 | 0 | — | **Digging** (and the tutorial cart) |
| 1:00 | ~$0–72 | 130 | ~20–100 | 20 | 0 | Yard ($80, forced) | **Transport** (cart 50, loading 3.5/s) + waiting for 30 blocks |
| 3:00 | ~$500/min avg (incl. cabin sale) | 320 | ~100 | 96 | 108 | Cabin sale → 8 small items | **Transport** (dig pile 312 and rising; raw 0; processing idle) |
| 5:00 | ~$840/min (stages only) | 244 | ~150 | 156 | 128 | ~$200 items | **Transport → construction** handover (plot pile builds up) |
| 10:00 | ~$4–6k/min avg (house every 2:42) | 695 (+Excavator) | ~220 | 216 | **169 (cap)** | anything | **Construction (3 blocks/s, fixed)**: dig pile 1,900, yard blocks and plot piling up |
| 15:00 | ~$5.7k/min avg | 1,277 (Jackhammer) | ~340 | 340 | **169 (cap)** | anything | **Construction** + the truck (~244/min max): yard blocks 250 → 800 |
| 20:00 (300 m, content end) | ~$6.3k/min avg | ~1,300 | ~350 | 350 | **169 (cap)** | anything | **Construction** (permanent) |

**Bottleneck movement:** Digging (0:00–0:30) → **Transport (0:30–~6:00)** → **Construction (~7:00 onward, permanently)**. Processing is never the bottleneck. The truck becomes a secondary bottleneck around 12–15 min. Construction dominates for the rest of the session, and no purchase can move it.

---

## 12. Top 10 economic inconsistencies

1. **Seed $95 > every Tiny Cabin stage ($72)**: raw rubble out-earns construction per unit ($3.39 vs $2.40).
2. **Flat 8% per stage**: effort (block count) has no effect on the stage reward.
3. **Recycling Yard $80** = one Digger = Cart Capacity Lv1, and cheaper than Cart Speed Lv1, Raw Storage Lv1 and Block Quality Lv1.
4. **Jackhammer $1,800 vs Excavator $900**, and the hand tool out-produces the machine ~9× at shallow depth.
5. **Construction rate 3 blocks/s is fixed and un-upgradable**: from ~7 min it caps all income, so active play = idle play and every dig/transport purchase stops paying off.
6. **Block Quality** ($140 → +25% of every future property, retroactive at sale, 30 levels): the dominant purchase and the main cause of the late-game money flood.
7. **Depth is economically worthless**: the value ×14 is ignored by construction, harder rock reduces output, and the Spec still says deeper material is worth more.
8. **Diggers**: ~18 rubble/min (5 at depth) for $80 rising ×1.28. Much weaker per $ than tools, and eventually more expensive than an Excavator that does 16–60× the work.
9. **Processing Speed and Raw Storage** are bought at times when they have zero effect. Processing is never the bottleneck; the hopper never fills.
10. **Money spikes** at sales ($900 → $6,300 → $8–13k every ~2.7 min) followed by **no sinks**. The Two-Story Home repeats forever and the shop's top items cost less than one house.

Also worth noting: Steel Rail ($2,500) is the most expensive item in the game, the Work Chamber ($450) is cheaper than Iron Rail ($700), and the Excavator's UI/offline rate disagrees with its real rate.

---

## 13. The 5 numbers that most need review (no replacement values proposed)

| # | Current value | Why it looks suspicious | Conflicts with |
|---|---|---|---|
| 1 | `CFG.intro.seedCash` = **$95** (contractor seed; buys raw at depth value × $3 × (1+0.25·BQ)) | The very first, smallest action pays more than any cabin construction stage and more per unit than built blocks. | Cabin stage $72 (`stagePay` × $900); Foundation 30 blocks; per-block construction value $2.40–$8.40 |
| 2 | `CFG.build.stagePay` = **0.08 flat per stage** | Stage reward is independent of stage size and of the project's effort; small stages pay the same as big ones; cabin stages sit below the seed. | Stage block counts (20–80); seed $95; Spec §3 "~8–10%" |
| 3 | `CFG.yard.cost` = **$80** (Recycling Yard) | The largest physical installation in the early game costs the same as one worker and less than several minor upgrade levels. | Digger #1 $80, Cart Capacity Lv1 $80, Cart Speed Lv1 $100, Raw Storage Lv1 $110, Work Chamber $450 |
| 4 | Block Quality: `UPGRADES.contractValue` base **$140**, growth 1.75, and `CFG.yard.price.perLevel` = **0.25** of property value (applied at sale time, 30 levels) | +25% of every future house for $140, retroactive, compounding. It produces the money flood, and it's shared with the contractor's price via the same config field. | House values $900/$4,200; every other upgrade's cost/benefit; contractor price (same `price.perLevel`) |
| 5 | `CFG.build.rate` = **3 blocks/s**, with no upgrade path | It silently becomes the only thing that determines income after ~7 min, so digging, crew, tools, transport and processing stop mattering economically. | All extraction/transport purchases; truck ~244/min; processing up to 500+/min; dig output up to 1,300+/min |

Runners-up: Jackhammer $1,800 vs Excavator $900 (cost and power); Digger `dps` 0.6 with cost growth 1.28; `valueAt` depth value unused by construction; Steel Rail $2,500 as the top price.

---

## 14. Spec.md vs implementation discrepancies

- **Spec §3**: stage milestone "~8–10%". **Code**: exactly 8%, flat per stage.
- **Spec §9**: Block Quality = "value of the material the blocks carry into construction". **Code**: a flat ×(1 + 0.25·level) on the whole property value, unrelated to material or depth. It reuses `CFG.yard.price.perLevel` (also the contractor's price factor).
- **Spec §13 / later-depth section** ("value `(1 + d/valueDiv)^valueExp` continues"): **code** uses depth value only for the contractor seed. Construction income ignores it. Deeper rock lowers output.
- **Spec §18 targets**: first property at 4:30–5:00, Work Chamber relevance ~3:30. **Measured**: first sale 2:31, Work Chamber available at 2:53.
- **Spec §7.3**: Excavator "≈12 per bucket". **Code**: 2 × 6 = 12 per bite (matches). But the analytic rate in the UI/offline differs from the real rate.
- **Spec §10**: escalating project ladder. **Code**: the Two-Story Home repeats forever after its first sale (no Project #3, by V2-1 scope).
- **Spec §7.8**: Track tiers (match the code exactly: 70/140/260/450, $150/$700/$2,500).
- **claude.md "Current Economy"**: matches the code.

---

# AFTER REBALANCE (economy rebuild pass)

Everything above is the **BEFORE** audit (commit `4136d95`). This section records what changed and what one representative simulation measured afterwards. **Scope of verification:** typecheck/build, material conservation (8-min headless run: error ~1e-10), v5→v6 save migration, and **one** 15-min active-player simulation (3 clicks/s, cheapest-first buying). Automation-leaning, infrastructure-first and idle simulations and a human playtest were **not** run yet. The Construction Crew reveal threshold was raised from 40 to 120 waiting blocks *after* that simulation.

## Before → after values

| Item / action | Before | After | Why | Expected player effect |
|---|---|---|---|---|
| First contractor money | $95 "seed" for ~28 rubble | **sample 20 rubble at market (~$62)** + **CONTRACT ADVANCE** up to $250 | rubble's real value is shown honestly; the bootstrap is labelled as an advance | "rubble isn't worth much; the contractor is backing me" |
| Recycling Yard | $80 | **$250** | the first real industrial installation | buying it feels like starting an operation |
| Material value | used only by the contractor | **every block carries `V(d)=1+d/120` × Block Quality** into the building | depth must matter through the material chain | deeper houses sell for more (×1.14 cabin → ×1.6–3.5 homes) |
| Cabin stage payments | $72 each (flat 8%) | **$98 / $126–131 / $184 / $145** by size × block value | size and material decide pay | Walls pays more than Finishing; Foundation > the rubble sample |
| Cabin sale | $900 | **≈ $1,370** (base $1,200 × ×1.14) | anchor for the first payoff | first "real money" moment at ~2:40 |
| Two-Story stage payments | $336 each (flat) | **$300–750** by size × block value | same rule | bigger stages pay more |
| Two-Story sale | $4,200 × (1+0.25·BQ) | **base $3,500 × block value × repeat factor** ($5.6k → $6.9k → $8.1k → $8.5k in the sim) | no runaway multiplier; temporary repeat decay | one sale ≈ one major purchase |
| Block Quality | $140 ×1.75, +25% whole-property value, retroactive, 30 levels | **$400 ×1.8, +8% per block pressed after purchase, 10 levels** | no retroactive exploit, no money flood | a long-term investment, not a must-buy |
| Construction rate | 3 blocks/s fixed | **Construction Crew: +1 builder each (1.25/s), $400 ×1.7, truck runs scale too** | no permanent cap | more builders on site; income keeps responding |
| Digger | $80 ×1.28, 0.6 power/s | **$120 ×1.22, 1.2 power/s** | real automated value | worth it for hands-off production |
| Iron / Heavy / Jackhammer | $75 / $260 / $1,800 (yield 1.5 / 2.5 / 3.5; 4×1.4 burst) | **$60 / $450 / $2,500** (yield 1.25 / 1.6 / 2.0; 3×1.2 burst) | smoother tool ladder; the Jackhammer no longer out-digs machines | each tool a clear step |
| Work Chamber | $450 | **$900** | a major physical expansion | "I expanded the mine" |
| Excavator | $900, ~300 rubble/min, UI/offline mismatch | **$4,000, ~750 rubble/min at any depth**, one formula for live/UI/offline | the top machine is priced and produces like one | the big industrial milestone |
| Track Strength | $150 / $700 / $2,500 | **$250 / $1,200 / $5,000** | matches the cart-capacity tier where each is needed | |
| Cart Capacity / Speed / Loading | $80 ×1.6 / $100 ×1.6 / $50 ×1.55 | **$120 ×1.55 / $90 ×1.55 / $50 ×1.5** | | |
| Processing Speed | 2/s base, $75 ×1.6 | **1.5/s base, $100 ×1.55** | processing actually becomes a bottleneck | hopper fills → upgrade has a visible effect |
| Raw Storage | $110 ×1.65 | **$150 ×1.6** | revealed when the hopper is half full | buys buffering when it is needed |

## Fresh-save timing (active player, 3 clicks/s)

| Beat | Before | After |
|---|---|---|
| First cart departs | 0:27 | 0:24 |
| Contractor → Yard bought | 0:37 | 0:36 |
| First block | 0:39 | 0:37 |
| Construction begins | 1:12 | 1:05 |
| Tiny Cabin sold | 2:31 ($900) | 2:39 (≈$1,370) |
| First Two-Story sold | 6:26 ($6,300) | 6:40 (≈$5,560) |
| 300 m reached | ~12:45 | ~11:30 |

## Income and money spikes
- **Before:** $95 → five × $72 → $900 spike → $336–504 stages → $6,300 spike → $8.4k–13k sales every ~2:42, with almost every shop item instantly affordable.
- **After:** $62 sample + $188 advance (= the Yard) → cabin stages $98–184 → **$1,367** → home stages $304–491 → **$5,556** → houses $6.9k / $8.1k / $8.5k (repeat decay slowing the climb). The largest purchases ($4k Excavator, $5k Steel Rail, crew/BQ levels at $1–2k+) stay meaningful against a sale.

## Throughput and bottlenecks (same run)
- **Before:** digging → transport (until ~6 min) → **construction permanently** (3 blocks/s); active and idle players earned the same after ~7 min.
- **After:** processing (min 1, hopper filling) → transport (2–9 min) → processing (10) → transport (11) → construction (12) → processing (13) → construction (14) → transport (15). Construction is no longer a permanent cap; the bottleneck keeps moving as the bot buys crew, processing and transport.

## Remaining suspicious values / known limitations
- The cheapest-first bot never saved $4,000 for the **Excavator** in 15 min (the price may be high for typical players, or that's just how this bot plays; it needs the majors/automation sims or a human).
- **300 m is still reached by ~11–12 min** of active play: content runs out before the economy's later tiers matter.
- The dig-site pile still grows into the hundreds or thousands: transport is the most common limit and is unflagged unless the track overloads.
- **Repeat decay** on the Two-Story Home is a temporary patch until more projects exist.
- Old saves with more than 10 Block Quality levels are clamped to 10 (×1.8 block value).
- Not yet run: automation-leaning, infrastructure-first and idle simulations, mobile UI check, human playtest.
