# WAR BALLOON

*Humanity has lost the ground. Jerry is still flying.*

A hand-inked, mobile-first cartoon survival game. Jerry pilots a tiny hot air balloon over a zombie-overrun world: dip low to scavenge rooftops and rescue survivors, shake off the dead when they grab the basket, fly home to Haven, and grow the balloon into a flying fortress full of crew.

**Fly. Scavenge. Rescue. Survive. Upgrade.**

## The loop
1. **Haven** — pick a region, check who's aboard, launch.
2. **Expedition** — fly out across the region. Low altitude means loot and survivors, but the dead reach up, stack into towers, leap from rooftops and **grab the basket**. Hangers weigh you down and climb aboard to attack the crew. **SHAKE** them off, climb into the thin high air, burn them off, or let the gunner pick them off.
3. **Rescue** — hover low over a survivor's roof and the rope ladder drops. Every survivor has a name, a trait, a role and sometimes a rare ability.
4. **Outpost & Beacon** — bank cargo and refuel at the mid-way outpost; light the radio beacon at the far end, then bring the signal home (or to the outpost) to open the next region. Each new region also demands a bigger balloon: Family Basket → Outrigger Platforms + Big Top → Two-Deck Gondola + Grand Envelope → Flying Fortress.
5. **Home** — loot only counts once it's back at Haven. Crash, and Jerry limps home with 30% of it; crew may get hurt or lost (you can find them again).
6. **Workshop** — every upgrade changes how the balloon looks *and* what it does: bigger envelopes, twin and triple burners, outrigger platforms, a two-deck gondola, a flying fortress with a cabin, spikes, plating, a shock rail, mounted guns, a belly turret, a flamethrower, firebombs and mines. Paint, basket materials, flags, lights, furniture and trophies add comfort, which makes the crew learn faster.

## Regions
| # | Region | New threats |
| --- | --- | --- |
| 1 | Suburban Outskirts | Walkers, Swarmers |
| 2 | Dustbowl Town | Climbers, Leapers |
| 3 | Smokestack Row | Brutes, Bloaters |
| 4 | Downtown Metropolis | Spitters |
| 5 | Quarantine Zone | Soldiers, Screamers |
| 6 | The Dead Zone | Everything |

## Crew
Mechanic (patches the envelope), Gunner (shoots hangers, mans the gun), Medic (heals, prevents injuries), Scavenger (more loot), Lookout (spots survivors & rare finds), Engineer (less fuel, more lift), Cook (half food cost, +1 HP for all). Crew level up with every trip; each seat is weight and a mouth to feed.

## Play
- **Touch (iPhone):** drag on the left half to fly (up = burner). Right side: **DROP** (bomb/firebomb/mine), **SHAKE**, **HOOK**, plus **FLAME** and **BOOST** once you own them. Wiggle the stick left-right to shake too. *Share → Add to Home Screen* for full screen.
- **Keyboard:** Arrows/WASD fly · B drop · H hook · X shake · F flame · Shift boost · C switch weapon · Esc pause.

## Develop
```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build to dist/
```
Debug: `?play=<region>` jumps into an expedition (`suburbs`, `town`, `industrial`, `downtown`, `military`, `deadzone`; add `&seed=N`), `?scene=haven|workshop|crew|title|intro|ending` opens a screen.

`npm run smoke` (with `vite preview` on port 4173) plays the full loop: grab & shake, rescue, hook, beacon, landing at Haven, saving, upgrading, crew boarding, reload, a crash, and boots every region.

## Balance
`node tools/balance.cjs` runs a scripted pilot through whole campaigns at high speed (`MODE=region` instead tests each region with expected and one-step-under gear; `SKILL`, `RUNS`, `REGIONS`, `GREEDY` tune it). Current targets: early regions near-certain for anyone, each new region risky when under-geared and ~90% with the expected balloon, campaign ≈ 25–30 trips with the Flying Fortress needed for the Dead Zone.

## Architecture
- Vite + TypeScript, a custom Canvas 2D engine (fixed 60 Hz step, 540-unit logical height, responsive width).
- All art is drawn procedurally in an "ink & paint" style with line boil. Backgrounds are painted once into parallax strips.
- All audio is synthesized with WebAudio. No audio files.
- Progress is saved in `localStorage` (`warballoon.save.v2`, with a care package for players of the old version). Save codes can be exported/imported from the title screen.

| Folder | Contents |
| --- | --- |
| `src/core` | engine loop, input, audio, save, math |
| `src/render` | ink pen, palette, balloon envelope & Jerry, airship gondola tiers, zombies, crew figures, painted backgrounds |
| `src/game` | expedition world, airship physics & boarding, zombie AI, crew, regions, upgrades, cosmetics, resources |
| `src/scenes` | title, intro, haven, workshop, crew, play (HUD/touch), report, ending |
