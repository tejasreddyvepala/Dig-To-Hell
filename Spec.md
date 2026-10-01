1. Beat sheet: 0–300 m
Economy should be tuned to this pacing, not the other way around.
Depth	Target time	Beat	Player sees / hears
0 m	0:00	Start	One miner, pickaxe, dirt face. First click immediately cracks dirt. Heavy THOK, debris, +$1.
5 m	0:12	First break	Larger dirt slab breaks free and tumbles down. Shaft visibly extends.
12 m	0:25	FIND #1: Rusty Coin	Gold glint → workers stop → dirt brushed away → coin flips toward HUD. TING! + discovery sting. Permanent +10% digging.
20 m	0:45	Digger unlock	Hire button pulses. Purchase makes a miner rappel/drop into shaft and immediately swing.
30 m	1:05	Gold Vein interruption	Gold streak suddenly exposed in wall. 8-second click frenzy. Higher-pitched impacts + coin shower.
45 m	1:30	FIND #2: Buried Car	Metal roof appears → workers stare → uncover rusty car → horn unexpectedly BEEP-BEEP. Cash reward.
60 m	1:55	Minecart unlock	Rails rapidly assemble from side; cart rolls in and worker catches it. Automation visibly speeds up.
75 m	2:20	Clay layer warning	Dirt becomes reddish/wetter over several meters. Impacts become duller. Small CLAY — 75 m banner.
90 m	2:45	Cave-in interruption	Ceiling shakes → rocks drop onto dig face → player rapidly clears highlighted rubble for bonus.
105 m	3:10	Jackhammer unlock	Tool crate drops on cable. Miner opens it, throws pick aside, jackhammer starts with BRRRT.
120 m	3:35	FIND #3: Dinosaur Skull	Curved white shape → brushing → enormous skull revealed → jaw drops open. Permanent crew-speed bonus.
140 m	4:00	Critical Pocket	Wall begins sparkling. 10 seconds where well-timed clicks create giant crit fractures.
155 m	4:25	STONE LAYER	Major breakthrough. Clay wall collapses; gray stone appears; dust rolls outward; music gains percussion.
175 m	4:55	Foreman unlock	Foreman descends elevator cable, whistles; nearby workers briefly speed up. New crew behavior.
195 m	5:25	FIND #4: Sealed Elevator	Straight metal line appears → workers uncover old elevator doors embedded impossibly underground → doors twitch but don't open.
215 m	5:55	Gas Pocket interruption	Greenish crack/hiss appears. Player clicks 3 valves/cracks to vent it before timer expires. Successful vent = production frenzy.
235 m	6:25	Excavator unlock	Platform widens; workers scatter; compact excavator is lowered in, lands heavily, bucket slams wall.
250 m	6:55	CAVE ROCK	Wall breaks into dark natural cavern. Echo added to impacts. Background suddenly opens beyond shaft.
265 m	7:25	FIND #5: Underground House	Wallpaper → window → entire tiny room embedded in rock. Lamp inside flickers on by itself.
280 m	7:55	Rich Vein interruption	Large multi-mineral seam. 15-second smash sequence with escalating particles/rewards.
292 m	8:25	Warning	Workers slow. Dig face has unnatural black stone. Music strips away. Low rumble every few seconds.
300 m	8:50	FIND #6: THE RED DOOR	Final wall breaks. Gigantic ancient door revealed. Workers stop. Red light leaks underneath. Three knocks come from the other side. End slice.


The important part is the rhythm:
click reward → discovery → purchase → event → discovery → machine → environment change → mystery.
Never upgrade → wait → upgrade → wait.
2. Finds: exact reveals
12 m — Rusty Coin
0.0s: pick hits something with metallic TING.
0.2s: tiny gold glint inside dirt.
0.5s: worker stops and looks.
0.8s: three quick brush/scrape animations expose coin.
1.4s: coin spins toward camera/HUD.
1.8s: RUSTY COIN FOUND
Reward: +10% permanent digging for this run.
This teaches finds.
45 m — Buried Car
First reveal is only a curved piece of metal.
Workers uncover roof → windshield → entire crushed rusty compact car sideways in the earth.
Headlight flickers.
Then:
BEEP!
Worker jumps backward.
Reward: large cash injection, roughly 30–45 seconds of normal income.
120 m — Dinosaur Skull
Pick exposes white bone.
Workers stop.
Brush dirt.
Camera subtly pulls back as the skull keeps getting bigger.
Finally the entire jaw falls open:
CLACK.
One miner jumps inside the mouth for half a second before being pulled back.
Reward: +15% crew speed.
The tiny comedy matters.
195 m — Sealed Elevator
Perfectly straight metal edge appears.
More digging reveals:
elevator doors.
At 195 meters underground.
Old floor indicator:
↓
Bell:
DING.
Doors attempt to open 2 cm.
Blackness.
They slam shut.
Reward: cash + add elevator to Mysteries collection.
Do not explain it.
265 m — Underground House
Pick breaks through wallpaper.
Not rock.
Workers uncover:
window
wall
lamp
table
It's a tiny furnished room buried inside the earth.
Nobody inside.
Lamp suddenly:
click
Turns on.
One worker slowly backs away.
Reward: major cash + +10% Find Chance for this run.
300 m — THE RED DOOR
This ends the prototype.
At ~292 m, normal cave rock starts becoming almost black.
At 298:
pickaxe strikes it.
Instead of rock:
GONG.
Workers stop.
Player breaks surrounding stone.
Something enormous emerges.
A red metal/stone door filling almost the entire shaft.
Symbols.
Chains.
No handle.
Cash UI subtly dims.
Music stops.
Silence.
Then:
KNOCK.
2-second pause.
KNOCK.
1-second pause.
KNOCK.
Red dust falls from ceiling.
Hairline red light appears underneath.
Text:
300 m
then:
SOMETHING IS BELOW.
Don't open it in this slice.
That is the first-run ending.
3. Dig face specification
Every dig face consists of 6–10 visual chunks across the working area. Damage is localized around the hit position.
Dirt — 0–74 m
3 crack stages.
Hit 1: indentation + 1–2 hairline cracks
Hit 2: 3–5 branching cracks
Hit 3: chunk detaches
Break produces 5–8 irregular chunks, 10–18 dust particles and 3–6 tiny grains.
Palette: brown/tan dust.
Chunks fall with gravity, rotate, bounce once, fade after ~0.8 s.
Clay — 75–154 m
Feels heavier.
4 stages.
Clay dents before cracking.
Stages 1–2: compression/deformation
Stage 3: thick dark crack
Stage 4: slab tears loose
Break: 3–5 larger chunks, sticky clumps, ~8 fine particles.
Color: burnt orange/red-brown.
Sound is lower and duller than dirt.
Stone — 155–249 m
4 stages.
No deformation.
Hit 1: white impact mark
Hit 2: sharp radial crack
Hit 3: multiple fracture lines
Hit 4: violent break
6–12 angular fragments, gray dust, occasional spark.
Chunks ricochet harder.
This should make the Jackhammer/Excavator feel fantastic.
Cave rock — 250–300 m
Irregular dark bluish-gray rock.
5 stages, but equipment should now hit hard enough that it doesn't necessarily take five manual clicks.
Cracks expose faint darkness/glow behind the wall.
Break:
- 8–14 fragments
- small pebbles
- dust cloud
- echoing debris falling into unseen space
From 292 m onward, particles gradually acquire faint dark-red flecks.
Critical hit
Do not merely show CRIT!.
Impact freezes animation for 35–50 ms.
Bright impact star.
KRAK!
Crack instantly advances 2 stages.
2× normal debris.
Short radial shock ring.
Tiny ~2 px camera impulse.
Reward number:
+$18!
larger than ordinary income.
Crits should be identifiable without reading text.
4. Four interruptions
Event	Trigger	Duration	Player does	Reward
Gold Vein	Eligible after 25 m; guaranteed first at 30 m	8s	Rapidly click exposed gold nodes	10–20× normal click income
Cave-In	After 70 m; cannot occur within 45s of another event	10–15s	Break 5–8 fallen rocks	Cash + 20s crew frenzy
Critical Pocket	After 120 m	10s	Time clicks when fracture pulses bright	Perfect hits = huge dig damage + gems/cash
Gas Pocket	After 180 m	8s	Click 3 flashing vents/cracks before gauge fills	Success = 30s ×2 production; failure = no bonus, no punishment


Global rule:
No random interruption within 20 seconds of a Find or layer transition.
We don't want spectacle stepping on spectacle.
After the scripted introduction, random event cooldown:
45–90 seconds.
5. Upgrade arrivals
This is non-negotiable: purchases enter the physical world.
Digger: rope drops from top → miner slides down → lands with dust puff → helmet light clicks on → immediately swings. 1.2s.
Minecart: two rails snap into place from side → cart rockets in → brakes with sparks → worker catches handle. 1.5s.
Jackhammer: yellow tool crate descends → opens mid-drop → miner catches jackhammer → old pickaxe gets tossed aside → BRRRT. 1.4s.
Foreman: small lift drops → doors open → foreman steps out → blows whistle → workers briefly swing in sync. 1.7s.
Excavator: warning beep → workers run sideways → excavator platform descends → suspension compresses on landing → bucket immediately smashes wall. 1.9s.
For subsequent purchases, use abbreviated 0.5–0.8s arrivals so buying ten workers doesn't become annoying.
6. Web Audio sound list
Claude can synthesize all of this. No assets required initially.
Sound	Synthesis
Dirt hit	90–130 Hz sine/triangle thump, 60 ms decay + short brown-noise burst
Clay hit	70–100 Hz low-pass noise, ~100 ms, soft attack
Stone hit	180–350 Hz short triangle transient + high-pass noise crack
Cave hit	stone hit + quiet 80–120 ms delayed echo
Crit	1.2–2.5 kHz transient + noise crack + 70 Hz impact
Dirt break	filtered brown noise, 250–350 ms decay
Stone break	4–7 randomized short noise/transient bursts over ~300 ms
Falling debris	randomized 150–600 Hz tiny ticks, decreasing amplitude
Coin	two sine tones ~880 → 1320 Hz, ~120 ms
Cash popup	sine sweep ~600 → 950 Hz, 70 ms
Purchase	three ascending tones ~440/660/880 Hz
Find sting	~523 → 659 → 784 → 1047 Hz, staggered ~80 ms
Pick swing	high-pass noise whoosh, ~120 ms
Jackhammer	repeated 55–70 Hz impulses at ~16–22 Hz + filtered noise
Minecart	rolling noise + ~1–3 kHz wheel squeal at stop
Excavator engine	saw/triangle around 55–80 Hz with slow modulation
Excavator slam	45–65 Hz sine drop + broad noise burst
Foreman whistle	sine ~1.8 → 2.5 kHz → 2.0 kHz, ~350 ms
Gold vein start	bright arpeggio ~700–1400 Hz
Cave-in warning	50–80 Hz rumble + scattered rock ticks
Gas hiss	band-pass noise around 2–6 kHz
Layer breakthrough	low 50 Hz rumble → crack → rising tonal sting
Elevator ding	sine ~900 Hz + harmonic ~1800 Hz, 350 ms decay
Car horn	paired square/saw tones around ~400/500 Hz, two short bursts
Door impact	~45 Hz sine + low-pass noise, 800–1200 ms decay
Door knock	~60–90 Hz wood/stone transient + long cave echo
Mystery ambience	sparse 35–60 Hz sine pulses, extremely quiet


Add ±3–7% pitch randomization to repetitive impacts so the click loop doesn't become machine-gun identical.
7. The thing to double down on
The shaft is one continuous physical history of your descent.
That's the moat I would pursue.
Don't turn Dig to Hell into a conventional menu-based incremental game.
The player should be able to scroll upward through the actual hole they created.
At 12 m:
coin-find marker.
At 45:
rusted car still embedded in the wall.
At 120:
dinosaur excavation.
At 195:
elevator doors.
At 265:
the impossible house.
At 300:
the Red Door.
Machines, supports, lights, rails and workers accumulate throughout it.
After an hour, the shaft itself becomes a giant visual timeline:
I made this.

That is much harder to imitate effectively than another prestige tree because it requires the game's progression, rendering, discoveries, animations and environment to all be designed around the same continuous physical space.