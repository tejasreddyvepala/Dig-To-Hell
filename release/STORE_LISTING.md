# Dig to Hell: store listing kit

Image sizes below are what we produced. **Verify each portal's current required sizes before submission**; re-run `covers.mjs` (session scratchpad) or crop from `screenshots/` if a portal wants a different size.

## Title
Dig to Hell

## Short description (≤ 140 chars)
Dig a mine 1,000 m down to the Gates of Hell. Haul the rubble, press it into blocks, build bigger and bigger and sell to dig deeper.

## Long description
Start with one miner, one pickaxe and a hole in the ground. Somewhere below, something is waiting.

Every swing breaks real rock, and every rock goes somewhere. A cart hauls the rubble to the surface, the Recycling Yard crushes it and presses it into building blocks, and the truck drives them to your construction site. Build huts, homes, office towers and mansions. Every finished stage pays you, and every sale funds a deeper dig.

Grow from a narrow shaft into a roaring underground operation: hire miners, blast open bigger chambers, bring in the excavator, the diamond saw and the deep drill rig. Dig through 14 layers of the earth (clay, caves, silver, crystal, gold, ruby, emerald, diamond, rainbow opal, obsidian, magma) until the rock turns to Hellstone and the Gates of Hell stand in front of you.

What happens when you open them?

- 14 hand-painted layers down to 1,000 m
- A full production chain you can watch: cart → yard → truck → building
- 12 buildings to construct, from a hut to a palace
- Miners, machines and crew gear that visibly change your mine
- 50 achievements with cash rewards
- Keeps working while you're away
- A real ending (about an hour of play)

## Controls
- **Click / tap the rock** (or press Space / Enter) to dig.
- **Mouse wheel / swipe** scrolls up the mine shaft.
- **MINE / YARD / BUILD** tabs switch sites.
- Buy upgrades in the side panel. The **Next Best Upgrade** card suggests a good buy.
- ☰ / top-left buttons: Sound, Economy, Trophies, Guide (tutorial), Help.

## Genre / tags (suggested)
Idle, Clicker, Incremental, Mining, Building, Management, Casual, Singleplayer

## Platform
Desktop browser (first release). Mobile works but isn't tuned yet, so mark the game desktop-only where a portal asks.

## Age / content notes
Cartoon style, no violence against people, no gore, no text chat, no user-generated content. Theme: "Hell" as a fantasy underground place (lava, a demon-styled gate, fossil bones and skulls in the rock). Suitable for general audiences; check each portal's rating questionnaire.

## Saves and data
Progress is saved locally in the browser (localStorage). No accounts, no personal data, no network calls at all (fonts are bundled). No analytics or ads in this build.

## Privacy note (draft)
"Dig to Hell stores your game progress only in your own browser. It does not collect personal information. If a game portal hosts this game, that portal's own privacy policy applies to the portal and its advertising." Replace this with a real policy before adding analytics or ads.

## Credits
Game design and development: Tejas Reddy Vepala.
All art is procedural/hand-coded and all music and sound are synthesized in the game. No third-party art or audio.

## Third-party licenses
- Fonts: **Bungee** (David Jonathan Ross) and **Rubik** (Hubert & Fischer et al.), both SIL Open Font License 1.1.
- No runtime code dependencies.

## Files
All covers are generated from the key art `source/key_art_1672x941.png` by `tools/make_covers_from_keyart.py` (re-run it after replacing the key art).

| File | Size | Use |
|---|---|---|
| `source/key_art_1672x941.png` | 1672×941 | master key art (16:9) |
| `images/cover_1920x1080.png` | 1920×1080 | landscape cover / banner (key art, high-quality upscale ×1.15) |
| `images/cover_1280x720.png` | 1280×720 | landscape thumbnail |
| `images/cover_portrait_800x1200.png` | 800×1200 | portrait cover: the full key art with the logo at ~92% width; sky extended above (gradient in the art's sky colours), lava mirrored below |
| `images/cover_square_800x800.png` | 800×800 | square thumbnail (full-height crop centred on the logo) |
| `source/icon_art_1254x1254.png` | 1254×1254 | master icon art |
| `images/icon_1024x1024.png`, `icon_512x512.png`, `icon_256x256.png`, `icon_128x128.png` | square | app / store icon (from the icon art) |
| `public/favicon.ico` (16/32/48), `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png` (180) | in the game build | browser-tab and home-screen icons, all from the icon art (links carry `?v=2` to beat favicon caching; bump it when the icon changes) |
| `screenshots/*.png` | 1920×1080 | gameplay screenshots (UI hidden): early mine, gold layers, opal layers, Hell, yard, build |

Note: the source is 1672 px wide, so the 1920×1080 cover is slightly upscaled. If a portal wants larger art (e.g. 2560 px or more), get a higher-resolution export of the key art and re-run the script.
