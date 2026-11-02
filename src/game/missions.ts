import { RNG } from '../core/math';
import type { MissionSpec, EntSpec } from './types';

type B = { x: number; w: number; h: number; chimney?: boolean };

/** Fill a stretch with ruined buildings, skipping reserved [a,b] ranges. */
function fill(from: number, to: number, seed: number, minH: number, maxH: number, keepClear: [number, number][] = [], gap: [number, number] = [70, 220]): B[] {
  const rng = new RNG(seed); const out: B[] = [];
  let x = from;
  while (x < to) {
    const w = rng.range(90, 170), h = rng.range(minH, maxH);
    const clash = keepClear.some(([a, b]) => x + w > a && x < b);
    if (!clash) out.push({ x, w, h });
    x += w + rng.range(gap[0], gap[1]);
  }
  return out;
}

const M1: MissionSpec = {
  id: 'm1', name: 'Lift Off', subtitle: 'Mission 1 · The Dead City', giver: 'Granny Gert',
  brief: 'A junk barricade is blocking the old supply drop. Blow it to smithereens, hook the supply crate, and bring it home to Haven.',
  length: 3700, seed: 11, wind: 6, music: 'flight', tutorial: true, mapPos: [0.2, 0.62], rewards: { scrap: 14, fabric: 8, fuel: 8, food: 1, water: 1 },
  buildings: [
    { x: 420, w: 110, h: 90 }, { x: 1160, w: 120, h: 210 }, { x: 1420, w: 170, h: 130 }, { x: 1700, w: 110, h: 250 },
    { x: 2060, w: 140, h: 160 }, { x: 2380, w: 120, h: 280 }, { x: 2650, w: 160, h: 120 }, { x: 3000, w: 120, h: 200 },
  ],
  ents: [
    { t: 'hint', x: 0, kind: 'climb', text: 'Hold ▲ (or W / SPACE) to fire the burner and rise!', touchText: 'Push the stick UP to fire the burner and rise!' },
    { t: 'hint', x: 140, kind: 'move', text: 'Press ► (or D) to drift east. Release ▲ to sink, ▼ vents hot air.', touchText: 'Push the stick RIGHT to fly east. Pull DOWN to vent and sink.' },
    { t: 'hint', x: 560, kind: 'bomb', text: 'Junk barricade ahead! Fly over it and press B (or J) to drop a bomb.', touchText: 'Junk barricade ahead! Fly over it and tap BOMB.' },
    { t: 'target', x: 900, kind: 'barricade', tag: 'barricade' },
    { t: 'item', x: 700, kind: 'scrap' }, { t: 'item', x: 980, kind: 'fabric' },
    { t: 'hint', x: 1180, kind: 'hook', text: 'Supply crate on the rooftop! Press H (or K) to lower the hook — swing it onto the crate.', touchText: 'Supply crate on the rooftop! Tap HOOK, hover low, and swing it onto the crate.' },
    { t: 'item', x: 1505, kind: 'supply', tag: 'supply' },
    { t: 'item', x: 1755, kind: 'scrap' }, { t: 'item', x: 1880, kind: 'fuel', alt: 230 },
    { t: 'hint', x: 1950, kind: 'info', text: 'Tin buzzard! Bomb it — or whack it with a swinging hook (lower the hook and turn hard).', touchText: 'Tin buzzard! Bomb it — or whack it with a swinging hook!' },
    { t: 'enemy', x: 2350, kind: 'buzzard', alt: 300 },
    { t: 'item', x: 2130, kind: 'water' }, { t: 'item', x: 2440, kind: 'scrap' },
    { t: 'power', x: 2560, kind: 'bombs', alt: 240 },
    { t: 'target', x: 2560, kind: 'junkpile' }, { t: 'target', x: 2860, kind: 'cratestack' },
    { t: 'item', x: 2950, kind: 'postcard', alt: 330, id: 'pc-m1' },
    { t: 'item', x: 3060, kind: 'food' },
    { t: 'hint', x: 3100, kind: 'info', text: 'Fly onto Haven\'s landing pad to finish the mission!', touchText: 'Fly onto Haven\'s landing pad to finish the mission!' },
  ],
  objectives: [
    { id: 'o1', text: 'Bomb the junk barricade', type: 'destroy', tag: 'barricade', count: 1 },
    { id: 'o2', text: 'Hook the supply crate', type: 'retrieve', tag: 'supply', count: 1 },
    { id: 'o3', text: 'Find the lost postcard', type: 'postcard', optional: true },
    { id: 'o4', text: 'Take no damage', type: 'nodamage', optional: true },
  ],
};

const M2: MissionSpec = {
  id: 'm2', name: 'Scrap Happy', subtitle: 'Mission 2 · The Dead City', giver: 'Granny Gert', requires: 'm1',
  brief: 'Haven needs scrap to fix the water pump. Scavenger flak guns guard the old rail yard — knock out two of them and haul back as much metal as you can.',
  length: 5400, seed: 22, wind: 14, music: 'flight', mapPos: [0.38, 0.4], rewards: { scrap: 18, fabric: 6, electronics: 2, fuel: 8 }, unlockPaint: 'teal',
  buildings: [
    ...fill(380, 1500, 201, 90, 230, [[700, 1000]]),
    { x: 1600, w: 140, h: 140 }, { x: 2000, w: 150, h: 200 },
    ...fill(2300, 3600, 202, 100, 260, [[2700, 3000]]),
    { x: 3800, w: 160, h: 150 }, { x: 4150, w: 120, h: 240 },
    ...fill(4400, 5100, 203, 80, 200, [[4600, 4800]]),
  ],
  ents: [
    { t: 'item', x: 520, kind: 'scrap' }, { t: 'item', x: 640, kind: 'scrap' },
    { t: 'enemy', x: 850, kind: 'turret', tag: 'turret' },
    { t: 'target', x: 980, kind: 'junkpile' },
    { t: 'powerline', x: 1100, x2: 1560, alt: 150 },
    { t: 'item', x: 1300, kind: 'fuel', alt: 300 },
    { t: 'item', x: 1670, kind: 'mystery', tag: 'mystery' },
    { t: 'enemy', x: 1800, kind: 'buzzard', alt: 280 },
    { t: 'item', x: 2070, kind: 'scrap' },
    { t: 'enemy', x: 2400, kind: 'buggy', w: 180 },
    { t: 'target', x: 2600, kind: 'junkpile' },
    { t: 'enemy', x: 2850, kind: 'turret', tag: 'turret' },
    { t: 'power', x: 2850, kind: 'cluster', alt: 360 },
    { t: 'powerline', x: 3050, x2: 3500, alt: 210 },
    { t: 'item', x: 3300, kind: 'electronics', alt: 340 },
    { t: 'item', x: 3640, kind: 'postcard', alt: 330, id: 'pc-m2' },
    { t: 'target', x: 3700, kind: 'cratestack' },
    { t: 'enemy', x: 3880, kind: 'turret', tag: 'turret' },
    { t: 'enemy', x: 4100, kind: 'buzzard', alt: 300 },
    { t: 'item', x: 4210, kind: 'scrap' }, { t: 'item', x: 4400, kind: 'fabric' },
    { t: 'target', x: 4700, kind: 'junkpile' }, { t: 'item', x: 4900, kind: 'scrap' },
  ],
  objectives: [
    { id: 'o1', text: 'Destroy 2 flak guns', type: 'destroy', tag: 'turret', count: 2 },
    { id: 'o2', text: 'Collect 16 scrap', type: 'collect', kind: 'scrap', count: 16 },
    { id: 'o3', text: 'Hook the mystery crate', type: 'retrieve', tag: 'mystery', optional: true },
    { id: 'o4', text: 'Find the lost postcard', type: 'postcard', optional: true },
  ],
};

const M3: MissionSpec = {
  id: 'm3', name: 'Rooftop Rescue', subtitle: 'Mission 3 · The Dead City', giver: 'Mayor Pim', requires: 'm2',
  brief: 'Three survivors are stranded on rooftops past the smokestacks. Hook them up gently, dodge the soot, and fly them home.',
  length: 5800, seed: 33, wind: -10, music: 'flight', mapPos: [0.56, 0.6], rewards: { scrap: 20, fabric: 10, food: 3, water: 3, electronics: 3 },
  buildings: [
    { x: 400, w: 120, h: 120 }, { x: 700, w: 130, h: 180, chimney: true }, { x: 1000, w: 150, h: 230 },
    { x: 1350, w: 120, h: 140 }, { x: 1650, w: 140, h: 200, chimney: true }, { x: 1950, w: 170, h: 280 },
    { x: 2350, w: 130, h: 160 }, { x: 2650, w: 120, h: 210 }, { x: 2950, w: 150, h: 170, chimney: true },
    { x: 3300, w: 130, h: 250 }, { x: 3650, w: 160, h: 300 }, { x: 4050, w: 120, h: 150 },
    { x: 4350, w: 140, h: 220, chimney: true }, { x: 4700, w: 150, h: 180 }, { x: 5050, w: 110, h: 130 },
  ],
  ents: [
    { t: 'item', x: 460, kind: 'water' },
    { t: 'item', x: 1075, kind: 'survivor' },
    { t: 'enemy', x: 1300, kind: 'buggy', w: 120 },
    { t: 'item', x: 1410, kind: 'fabric' },
    { t: 'enemy', x: 1800, kind: 'gyro', alt: 300 },
    { t: 'gust', x: 2200, w: 500, fx: -110, fy: -20 },
    { t: 'item', x: 2030, kind: 'food' },
    { t: 'item', x: 2715, kind: 'survivor' },
    { t: 'power', x: 2500, kind: 'shield', alt: 340 },
    { t: 'target', x: 3150, kind: 'siren', tag: 'siren' },
    { t: 'enemy', x: 3200, kind: 'buzzard', alt: 300 }, { t: 'enemy', x: 3450, kind: 'buzzard', alt: 300 },
    { t: 'item', x: 3380, kind: 'electronics' },
    { t: 'item', x: 3720, kind: 'postcard', alt: 330, id: 'pc-m3' },
    { t: 'enemy', x: 3900, kind: 'turret' },
    { t: 'item', x: 4110, kind: 'survivor' },
    { t: 'enemy', x: 4500, kind: 'gyro', alt: 280 },
    { t: 'enemy', x: 4600, kind: 'buggy', w: 150 },
    { t: 'item', x: 4770, kind: 'fuel' }, { t: 'item', x: 5100, kind: 'scrap' },
  ],
  objectives: [
    { id: 'o1', text: 'Rescue 3 stranded survivors', type: 'rescue', count: 3 },
    { id: 'o2', text: 'Silence the siren tower', type: 'destroy', tag: 'siren', optional: true },
    { id: 'o3', text: 'Find the lost postcard', type: 'postcard', optional: true },
  ],
};

const M4: MissionSpec = {
  id: 'm4', name: 'Big Bertha', subtitle: 'Mission 4 · The Dead City', giver: 'Mayor Pim', requires: 'm3', boss: true,
  brief: 'The Scrap Baron\'s crane-tank, Big Bertha, is crushing everything between us and the Dustlands. Bomb her three pressure valves before she flattens Haven.',
  length: 4600, seed: 44, wind: 8, music: 'flight', mapPos: [0.78, 0.38], rewards: { scrap: 40, fabric: 12, electronics: 6, fuel: 10 }, unlockPaint: 'storm',
  buildings: [...fill(380, 2100, 401, 100, 240, [[900, 1100]])],
  ents: [
    { t: 'item', x: 600, kind: 'fuel', alt: 250 }, { t: 'enemy', x: 1000, kind: 'turret' },
    { t: 'power', x: 1300, kind: 'shield', alt: 320 }, { t: 'enemy', x: 1500, kind: 'buzzard', alt: 300 },
    { t: 'item', x: 1800, kind: 'fabric', alt: 260 }, { t: 'power', x: 2150, kind: 'bombs', alt: 260 },
    { t: 'item', x: 2050, kind: 'postcard', alt: 330, id: 'pc-m4' },
    { t: 'boss', x: 2350, w: 1700 },
  ],
  objectives: [
    { id: 'o1', text: 'Destroy Big Bertha', type: 'boss' },
    { id: 'o2', text: 'Find the lost postcard', type: 'postcard', optional: true },
    { id: 'o3', text: 'Take no damage', type: 'nodamage', optional: true },
  ],
};

/** Free-flight scavenging run — regenerated every launch. */
export function makeScavenge(seed: number): MissionSpec {
  const rng = new RNG(seed);
  const length = 6000;
  const buildings = fill(400, length - 400, seed, 80, 280, [], [60, 200]);
  const ents: EntSpec[] = [];
  const kinds = ['scrap', 'scrap', 'scrap', 'fabric', 'fuel', 'food', 'water', 'electronics', 'crate', 'mystery'];
  for (let x = 500; x < length - 400; x += rng.range(140, 260)) ents.push({ t: 'item', x, kind: rng.pick(kinds), alt: rng.chance(0.2) ? rng.range(200, 380) : undefined });
  const enemies = ['buzzard', 'turret', 'buggy', 'gyro', 'buzzard'];
  for (let x = 900; x < length - 500; x += rng.range(450, 750)) { const k = rng.pick(enemies); ents.push({ t: 'enemy', x, kind: k, alt: k === 'buzzard' || k === 'gyro' ? rng.range(250, 380) : undefined, w: 150 }); }
  for (let x = 1200; x < length - 600; x += rng.range(900, 1400)) ents.push({ t: 'target', x, kind: rng.pick(['junkpile', 'cratestack', 'depot']) });
  for (let x = 1500; x < length - 600; x += rng.range(1200, 1800)) ents.push({ t: 'power', x, kind: rng.pick(['cluster', 'shield', 'hotair', 'bombs']), alt: rng.range(260, 380) });
  if (rng.chance(0.6)) { const x = rng.range(1500, 4000); ents.push({ t: 'powerline', x, x2: x + 420, alt: rng.range(150, 230) }); }
  return {
    id: 'scav', name: 'Scavenger Run', subtitle: 'Free Flight · The Dead City', giver: 'Granny Gert', free: true,
    brief: 'No orders, no fuss. Fly out, grab everything that isn\'t nailed down (and bomb what is), then come home. The city reshuffles every run.',
    length, seed, wind: rng.range(-12, 14), music: 'flight', mapPos: [0.3, 0.84], rewards: { scrap: 4 }, requires: 'm1',
    buildings, ents,
    objectives: [{ id: 'o1', text: 'Collect 20 scrap', type: 'collect', kind: 'scrap', count: 20, optional: true }],
  };
}

export const MISSIONS: MissionSpec[] = [M1, M2, M3, M4];
export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);
