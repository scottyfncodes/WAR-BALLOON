# WAR BALLOON

*The world has fallen apart. Jerry is still flying.*

A hand-inked, mobile-first arcade adventure. Pilot Jerry's beat-up hot air balloon across six regions — bomb scavenger machines, hook supplies and stranded survivors, and turn the balloon into an absurdly capable flying machine.

| Region | Hazard | Boss |
| --- | --- | --- |
| The Dead City | power lines, soot stacks | Big Bertha |
| The Dustlands | sandstorms | The Dune Dredger |
| The Flood | floodwater, sea mines, lightning | Old Salty |
| The Green | snapper plants, mutant moths | The Bramble King |
| The Frozen Reach | icing at altitude, blizzards, snowballs | The Icebreaker |
| The Ashlands | lava pools, fire vents | The Iron Furnace |

## Play
- **Touch (iPhone):** drag anywhere on the left half of the screen to steer (up = burner, down = vent). Use the right-hand buttons for BOMB, HOOK and BOOST. For full-screen play, use *Share → Add to Home Screen*.
- **Keyboard:** Arrows/WASD fly · Space burner · B/J bomb · H/K hook · Shift boost · Esc pause.

## Develop
```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build to dist/
```
Debug shortcut: `?play=<id>` jumps straight into a mission (`m1`–`m4`, `d1`–`d3`, `f1`–`f3`, `g1`–`g3`, `z1`–`z3`, `a1`–`a3`).

`npm run smoke` (with `vite preview` on port 4173) plays mission 1, boots all 19 missions, beats every boss and checks each region's hazard.

## Architecture
- Vite + TypeScript, a custom Canvas 2D engine (fixed 60 Hz step, 540-unit logical height, responsive width).
- All art is drawn procedurally in an "ink & paint" style. Characters are drawn live with line boil; backgrounds are painted once into parallax strips.
- All audio is synthesized with WebAudio (SFX + an oom-pah music sequencer). There are no audio files.
- Progress is saved in `localStorage`. No login.

| Folder | Contents |
| --- | --- |
| `src/core` | engine loop, input, audio, save, math |
| `src/render` | ink pen, palette, balloon/Jerry art, painted backgrounds |
| `src/game` | world, player physics & hook, entities, boss, missions, upgrades |
| `src/scenes` | title, intro, map, garage, play (HUD/touch), results |
