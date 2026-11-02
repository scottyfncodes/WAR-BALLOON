import { RNG } from '../core/math';
import type { MissionSpec, EntSpec, ObjectiveSpec } from './types';
import { BIOMES, type BiomeId } from './biomes';

type B = { x: number; w: number; h: number; chimney?: boolean };

interface Ctx { B: B[]; ents: EntSpec[]; rng: RNG; roof: (i: number) => number; add: (...e: EntSpec[]) => void; length: number; lava: [number, number][]; }

/** Shared builder: buildings + ambient loot/enemies, then mission-specific placements. */
function make(o: {
  id: string; biome: BiomeId; name: string; n: number; brief: string; giver: string; seed: number; length: number; wind: number;
  objectives: ObjectiveSpec[]; rewards: MissionSpec['rewards']; mapPos: [number, number]; requires: string; boss?: string; unlockPaint?: string;
  heights: [number, number]; gap?: [number, number]; enemies: string[]; enemyEvery: number; lava?: boolean;
}, build: (c: Ctx) => void): MissionSpec {
  const rng = new RNG(o.seed);
  const B: B[] = [];
  const end = o.boss ? o.length * 0.45 : o.length - 420;
  for (let x = 420; x < end; ) {
    const w = rng.range(100, 170);
    B.push({ x, w, h: rng.range(o.heights[0], o.heights[1]) });
    x += w + rng.range((o.gap ?? [80, 240])[0], (o.gap ?? [80, 240])[1]);
  }
  const lava: [number, number][] = [];
  if (o.lava) for (let i = 0; i < B.length - 1; i++) { const a = B[i].x + B[i].w + 20, b = B[i + 1].x - 20; if (b - a > 90 && rng.chance(0.7)) lava.push([a, b - a]); }
  const ents: EntSpec[] = [];
  const c: Ctx = { B, ents, rng, roof: (i) => B[Math.min(B.length - 1, Math.max(0, i))].x + B[Math.min(B.length - 1, Math.max(0, i))].w / 2, add: (...e) => ents.push(...e), length: o.length, lava };
  const bio = BIOMES[o.biome];
  const inLava = (x: number) => lava.some(([a, w]) => x > a - 20 && x < a + w + 20);
  // loot scattered on rooftops and ground (never in lava)
  for (let x = 500; x < end; x += rng.range(170, 300)) {
    if (inLava(x)) continue;
    c.add({ t: 'item', x, kind: rng.pick(bio.loot), alt: rng.chance(0.18) ? rng.range(180, 300) : undefined });
  }
  // ambient enemies
  for (let x = 900; x < end - 200; x += o.enemyEvery * rng.range(0.8, 1.2)) {
    const k = rng.pick(o.enemies);
    if ((k === 'buggy' || k === 'turret') && inLava(x)) continue;
    c.add({ t: 'enemy', x, kind: k, alt: k === 'buzzard' || k === 'gyro' || k === 'moth' ? rng.range(220, 300) : undefined, w: 140 });
  }
  // a power-up or two
  for (let x = 1300; x < end; x += rng.range(1300, 1900)) c.add({ t: 'power', x, kind: rng.pick(['cluster', 'shield', 'hotair', 'bombs']), alt: rng.range(240, 320) });
  build(c);
  return {
    id: o.id, name: o.name, subtitle: `Mission ${o.n} · ${bio.name}`, brief: o.brief, giver: o.giver, length: o.length, seed: o.seed, wind: o.wind,
    music: o.boss ? 'boss' : bio.music, mapPos: o.mapPos, rewards: o.rewards, requires: o.requires, buildings: B, ents, objectives: o.objectives,
    biome: o.biome, lava, boss: !!o.boss, bossCfg: o.boss, unlockPaint: o.unlockPaint,
  };
}

const postcard = (id: string): ObjectiveSpec => ({ id: 'pc', text: 'Find the lost postcard', type: 'postcard', optional: true });
const pcEnt = (x: number, id: string): EntSpec => ({ t: 'item', x, kind: 'postcard', alt: 330, id: 'pc-' + id });

// ======================================================================= DUSTLANDS
const D1 = make({ id: 'd1', biome: 'dust', n: 1, name: 'Sand in the Gears', giver: 'Caravan boss Dot', seed: 501, length: 5200, wind: 18, requires: 'm4', mapPos: [0.22, 0.6],
  brief: 'Our caravan is stuck without fuel. The old filling stations are buried, but their drums are still out there. Bring back what you can — and watch for sandstorms.',
  heights: [50, 160], enemies: ['buggy', 'buzzard', 'turret'], enemyEvery: 650,
  objectives: [{ id: 'o1', text: 'Collect 10 fuel', type: 'collect', kind: 'fuel', count: 10 }, { id: 'o2', text: 'Wreck 2 scavenger depots', type: 'destroy', tag: 'depot', count: 2, optional: true }, postcard('d1')],
  rewards: { scrap: 24, fuel: 14, water: 2, electronics: 2 } }, (c) => {
  c.add({ t: 'hint', x: 0, kind: 'info', text: 'The Dustlands! Sandstorms (tan swirls) shove you hard — ride them or fight them.', touchText: 'The Dustlands! Sandstorms shove you hard — ride them or fight them.' });
  [900, 1700, 2600, 3500, 4300].forEach((x) => c.add({ t: 'item', x, kind: 'fuel' }));
  c.add({ t: 'gust', x: 1400, w: 600, fx: 150, fy: -10, style: 'sand' }, { t: 'gust', x: 3000, w: 700, fx: -160, fy: 20, style: 'sand' });
  c.add({ t: 'target', x: 2200, kind: 'depot', tag: 'depot' }, { t: 'target', x: 3900, kind: 'depot', tag: 'depot' }, pcEnt(3200, 'd1'));
});
const D2 = make({ id: 'd2', biome: 'dust', n: 2, name: 'Buried Town', giver: 'Caravan boss Dot', seed: 502, length: 5600, wind: -14, requires: 'd1', mapPos: [0.5, 0.36],
  brief: 'A whole town is buried to the rooftops and folks are still up there. Hook them out, then blow up the scavenger watchtower bossing them around.',
  heights: [70, 190], enemies: ['buggy', 'gyro', 'buzzard', 'turret'], enemyEvery: 600,
  objectives: [{ id: 'o1', text: 'Rescue 3 survivors', type: 'rescue', count: 3 }, { id: 'o2', text: 'Topple the scav siren', type: 'destroy', tag: 'siren', count: 1 }, postcard('d2')],
  rewards: { scrap: 26, fabric: 8, food: 2, water: 3, electronics: 2 } }, (c) => {
  [2, 5, 8].forEach((i) => c.add({ t: 'item', x: c.roof(i), kind: 'survivor' }));
  c.add({ t: 'gust', x: 2000, w: 800, fx: 170, fy: -20, style: 'sand' }, { t: 'target', x: c.roof(6) + 120, kind: 'siren', tag: 'siren' }, pcEnt(4100, 'd2'));
});
const D3 = make({ id: 'd3', biome: 'dust', n: 3, name: 'The Dune Dredger', giver: 'Caravan boss Dot', seed: 503, length: 4600, wind: 10, requires: 'd2', mapPos: [0.78, 0.6], boss: 'dredger', unlockPaint: 'dune',
  brief: 'Something huge is chewing through the dunes toward our caravan. It\'s the Scrap Baron\'s Dune Dredger. Bomb its valves before it swallows us whole.',
  heights: [60, 150], enemies: ['buzzard', 'buggy'], enemyEvery: 700,
  objectives: [{ id: 'o1', text: 'Destroy the Dune Dredger', type: 'boss' }, postcard('d3'), { id: 'o3', text: 'Take no damage', type: 'nodamage', optional: true }],
  rewards: { scrap: 40, fuel: 16, electronics: 5, fabric: 8 } }, (c) => { c.add({ t: 'boss', x: 2350, w: 1700 }, pcEnt(1900, 'd3')); });

// ======================================================================= FLOOD
const F1 = make({ id: 'f1', biome: 'flood', n: 1, name: 'High Water', giver: 'Ferryman Gus', seed: 601, length: 5400, wind: 8, requires: 'd3', mapPos: [0.2, 0.42],
  brief: 'The clinic rafts are out of medicine. Three crates are stranded on flooded rooftops. Keep the basket out of the water unless you fancy a swim — and stay clear of the storm clouds.',
  heights: [80, 200], enemies: ['mine', 'buzzard', 'turret', 'buggy'], enemyEvery: 520,
  objectives: [{ id: 'o1', text: 'Recover 3 medicine crates', type: 'retrieve', tag: 'medicine', count: 3 }, postcard('f1'), { id: 'o3', text: 'Take no damage', type: 'nodamage', optional: true }],
  rewards: { scrap: 26, fabric: 12, water: 4, food: 2, electronics: 2 } }, (c) => {
  c.add({ t: 'hint', x: 0, kind: 'info', text: 'Floodwater! Dunking the basket soaks you (damage). Pontoons in the garage let you land on water.', touchText: 'Floodwater! Dunking the basket hurts — Pontoons let you land on water.' });
  [2, 6, 10].forEach((i) => c.add({ t: 'item', x: c.roof(i), kind: 'medicine', tag: 'medicine' }));
  c.add({ t: 'storm', x: 1800, w: 600 }, { t: 'storm', x: 3600, w: 500 }, pcEnt(2900, 'f1'));
});
const F2 = make({ id: 'f2', biome: 'flood', n: 2, name: 'Mine Sweeper', giver: 'Ferryman Gus', seed: 602, length: 5800, wind: -12, requires: 'f1', mapPos: [0.48, 0.66],
  brief: 'Scavengers mined the ferry lanes. Bomb six mines so the boats can run again — and pick up the two folks clinging to driftwood.',
  heights: [70, 180], enemies: ['buzzard', 'gyro', 'turret'], enemyEvery: 700,
  objectives: [{ id: 'o1', text: 'Sink 6 sea mines', type: 'destroy', tag: 'mine', count: 6 }, { id: 'o2', text: 'Rescue 2 castaways', type: 'rescue', count: 2 }, postcard('f2')],
  rewards: { scrap: 28, fabric: 10, water: 4, electronics: 3 } }, (c) => {
  for (let i = 0; i < 8; i++) { const gapX = c.B[i] ? c.B[i].x + c.B[i].w + 40 : 800 + i * 500; c.add({ t: 'enemy', x: gapX, kind: 'mine', tag: 'mine' }); }
  c.add({ t: 'item', x: c.B[3].x + c.B[3].w + 60, kind: 'survivor' }, { t: 'item', x: c.B[9].x + c.B[9].w + 60, kind: 'survivor' });
  c.add({ t: 'storm', x: 2500, w: 700 }, pcEnt(4300, 'f2'));
});
const F3 = make({ id: 'f3', biome: 'flood', n: 3, name: 'Old Salty', giver: 'Ferryman Gus', seed: 603, length: 4700, wind: 6, requires: 'f2', mapPos: [0.8, 0.4], boss: 'salty', unlockPaint: 'sea',
  brief: 'Old Salty — the Baron\'s armoured paddle-steamer — is ramming our ferries. She swings an anchor the size of a house. Sink her.',
  heights: [80, 170], enemies: ['mine', 'buzzard'], enemyEvery: 600,
  objectives: [{ id: 'o1', text: 'Sink Old Salty', type: 'boss' }, postcard('f3'), { id: 'o3', text: 'Take no damage', type: 'nodamage', optional: true }],
  rewards: { scrap: 44, fabric: 14, electronics: 6, water: 4 } }, (c) => { c.add({ t: 'boss', x: 2400, w: 1700 }, { t: 'storm', x: 2500, w: 1400 }, pcEnt(1900, 'f3')); });

// ======================================================================= GREEN
const G1 = make({ id: 'g1', biome: 'green', n: 1, name: 'Seed Vault', giver: 'Gardener Ottoline', seed: 701, length: 5400, wind: 4, requires: 'f3', mapPos: [0.22, 0.6],
  brief: 'There\'s a seed vault on top of the old botanical tower. Fetch it and Haven eats for a year. The plants up here bite. Literally.',
  heights: [100, 240], enemies: ['snapper', 'moth', 'moth', 'turret'], enemyEvery: 520,
  objectives: [{ id: 'o1', text: 'Hook the seed vault', type: 'retrieve', tag: 'seeds', count: 1 }, { id: 'o2', text: 'Collect 6 food', type: 'collect', kind: 'food', count: 6 }, postcard('g1')],
  rewards: { scrap: 28, food: 6, fabric: 10, electronics: 3 } }, (c) => {
  c.add({ t: 'hint', x: 0, kind: 'info', text: 'Snapper plants lunge up when you hover low over them. Bomb them — or keep your basket high.', touchText: 'Snapper plants lunge up at low balloons. Bomb them or stay high!' });
  const vi = Math.floor(c.B.length * 0.6);
  c.add({ t: 'item', x: c.roof(vi), kind: 'supply', tag: 'seeds' }, { t: 'enemy', x: c.roof(vi) - 40, kind: 'snapper' }, { t: 'enemy', x: c.roof(vi) + 45, kind: 'snapper' });
  [3, 6, 9, 12].forEach((i) => c.add({ t: 'item', x: c.roof(i) + 30, kind: 'food' }));
  c.add(pcEnt(3800, 'g1'));
});
const G2 = make({ id: 'g2', biome: 'green', n: 2, name: 'Weed Whacker', giver: 'Gardener Ottoline', seed: 702, length: 5800, wind: -6, requires: 'g1', mapPos: [0.5, 0.34],
  brief: 'Snappers have taken over the rooftop allotments and two of my gardeners are stuck. Weed the place out — with explosives.',
  heights: [90, 220], enemies: ['moth', 'gyro', 'snapper', 'buzzard'], enemyEvery: 600,
  objectives: [{ id: 'o1', text: 'Whack 5 snapper plants', type: 'destroy', tag: 'snapper', count: 5 }, { id: 'o2', text: 'Rescue 2 gardeners', type: 'rescue', count: 2 }, postcard('g2')],
  rewards: { scrap: 30, food: 5, fabric: 12, electronics: 3 } }, (c) => {
  [1, 3, 5, 7, 9, 11].forEach((i) => c.add({ t: 'enemy', x: c.roof(i), kind: 'snapper', tag: 'snapper' }));
  c.add({ t: 'item', x: c.roof(4) + 40, kind: 'survivor' }, { t: 'item', x: c.roof(10) - 40, kind: 'survivor' }, pcEnt(4400, 'g2'));
});
const G3 = make({ id: 'g3', biome: 'green', n: 3, name: 'The Bramble King', giver: 'Gardener Ottoline', seed: 703, length: 4700, wind: 4, requires: 'g2', mapPos: [0.8, 0.58], boss: 'bramble', unlockPaint: 'ivy',
  brief: 'The Baron left a giant mower out here and the jungle crowned it king. It calls moths to fight for it. Prune it down to the stump.',
  heights: [100, 200], enemies: ['moth', 'snapper'], enemyEvery: 600,
  objectives: [{ id: 'o1', text: 'Dethrone the Bramble King', type: 'boss' }, postcard('g3'), { id: 'o3', text: 'Take no damage', type: 'nodamage', optional: true }],
  rewards: { scrap: 46, food: 8, fabric: 14, electronics: 6 } }, (c) => { c.add({ t: 'boss', x: 2400, w: 1700 }, pcEnt(1900, 'g3')); });

// ======================================================================= FROZEN REACH
const Z1 = make({ id: 'z1', biome: 'frozen', n: 1, name: 'Cold Storage', giver: 'Dr. Penny Frost', seed: 801, length: 5400, wind: 12, requires: 'g3', mapPos: [0.22, 0.4],
  brief: 'My old research station is full of electronics. Grab what you can, but don\'t fly too high — ice will build up on your envelope and drag you down.',
  heights: [60, 170], enemies: ['buggy', 'buzzard', 'turret', 'gyro'], enemyEvery: 580,
  objectives: [{ id: 'o1', text: 'Collect 6 electronics', type: 'collect', kind: 'electronics', count: 6 }, postcard('z1'), { id: 'o3', text: 'Take no damage', type: 'nodamage', optional: true }],
  rewards: { scrap: 30, electronics: 6, fuel: 10, fabric: 8 } }, (c) => {
  c.add({ t: 'hint', x: 0, kind: 'info', text: 'Fly high and ice builds up (heavier balloon). Burn the burner low down to melt it. The Envelope Heater stops it entirely.', touchText: 'Fly high and ice builds up! Stay low to melt it. The Envelope Heater stops it.' });
  [2, 4, 6, 8, 10, 12, 13].forEach((i) => c.add({ t: 'item', x: c.roof(i), kind: 'electronics' }));
  c.add({ t: 'gust', x: 2200, w: 700, fx: -150, fy: 30, style: 'snow' }, pcEnt(3000, 'z1'));
});
const Z2 = make({ id: 'z2', biome: 'frozen', n: 2, name: 'Radio Silence', giver: 'Dr. Penny Frost', seed: 802, length: 5800, wind: -16, requires: 'z1', mapPos: [0.5, 0.64],
  brief: 'Scavenger jammers are drowning out every radio in the Reach. Knock down three of them and fetch my lab assistant, Hollis — he\'s on a roof somewhere, probably sulking.',
  heights: [70, 190], enemies: ['buggy', 'gyro', 'turret', 'buzzard'], enemyEvery: 560,
  objectives: [{ id: 'o1', text: 'Topple 3 jammer towers', type: 'destroy', tag: 'jammer', count: 3 }, { id: 'o2', text: 'Rescue Hollis', type: 'rescue', count: 1 }, postcard('z2')],
  rewards: { scrap: 32, electronics: 8, fabric: 10, food: 3 } }, (c) => {
  [1500, 3000, 4400].forEach((x) => c.add({ t: 'target', x, kind: 'siren', tag: 'jammer' }));
  c.add({ t: 'item', x: c.roof(Math.floor(c.B.length * 0.7)), kind: 'survivor' }, { t: 'storm', x: 2000, w: 600 }, { t: 'gust', x: 3400, w: 700, fx: 160, fy: 0, style: 'snow' }, pcEnt(3800, 'z2'));
});
const Z3 = make({ id: 'z3', biome: 'frozen', n: 3, name: 'The Icebreaker', giver: 'Dr. Penny Frost', seed: 803, length: 4700, wind: 10, requires: 'z2', mapPos: [0.8, 0.42], boss: 'icebreaker', unlockPaint: 'glacier',
  brief: 'The Icebreaker is cracking open the glacier to get at the Baron\'s old fuel cache. It throws snowballs that ice you up. Break it first.',
  heights: [60, 160], enemies: ['buggy', 'buzzard'], enemyEvery: 650,
  objectives: [{ id: 'o1', text: 'Shatter the Icebreaker', type: 'boss' }, postcard('z3'), { id: 'o3', text: 'Take no damage', type: 'nodamage', optional: true }],
  rewards: { scrap: 48, electronics: 10, fuel: 14, fabric: 10 } }, (c) => { c.add({ t: 'boss', x: 2400, w: 1700 }, pcEnt(1900, 'z3')); });

// ======================================================================= ASHLANDS
const A1 = make({ id: 'a1', biome: 'ash', n: 1, name: 'Fire Walk', giver: 'Granny Gert', seed: 901, length: 5600, wind: 6, requires: 'z3', mapPos: [0.2, 0.62], lava: true,
  brief: 'We\'re close to the Baron\'s forge now. The lava fields are thick with scrap — haul 24 home and don\'t let that basket touch the glowing stuff.',
  heights: [80, 200], enemies: ['turret', 'gyro', 'buzzard', 'buggy'], enemyEvery: 520,
  objectives: [{ id: 'o1', text: 'Collect 24 scrap', type: 'collect', kind: 'scrap', count: 24 }, postcard('a1'), { id: 'o3', text: 'Take no damage', type: 'nodamage', optional: true }],
  rewards: { scrap: 30, electronics: 6, fuel: 12, fabric: 10 } }, (c) => {
  c.add({ t: 'hint', x: 0, kind: 'info', text: 'Lava pools burn the basket, and fire vents erupt after a red warning. The Fire Bucket keeps you safe from vents.', touchText: 'Lava burns the basket! Fire vents erupt after a red warning.' });
  for (let i = 0; i < c.B.length; i += 2) c.add({ t: 'item', x: c.roof(i), kind: 'scrap' }, { t: 'target', x: c.roof(i + 1), kind: 'junkpile' });
  c.lava.slice(0, 4).forEach(([a, w]) => c.add({ t: 'vent', x: a + w / 2 }));
  c.add(pcEnt(3400, 'a1'));
});
const A2 = make({ id: 'a2', biome: 'ash', n: 2, name: 'The Forge Gates', giver: 'Granny Gert', seed: 902, length: 6000, wind: -8, requires: 'a1', mapPos: [0.5, 0.36], lava: true,
  brief: 'The Baron\'s fuel dumps power the whole forge. Blow three of them sky-high and free the two mechanics he\'s got chained to the gatehouse.',
  heights: [90, 230], enemies: ['turret', 'gyro', 'buzzard', 'turret'], enemyEvery: 480,
  objectives: [{ id: 'o1', text: 'Blow up 3 fuel dumps', type: 'destroy', tag: 'depot', count: 3 }, { id: 'o2', text: 'Free 2 mechanics', type: 'rescue', count: 2 }, postcard('a2')],
  rewards: { scrap: 36, electronics: 8, fuel: 14, fabric: 12 } }, (c) => {
  [3, 7, 11].forEach((i) => c.add({ t: 'target', x: c.roof(i), kind: 'depot', tag: 'depot' }));
  c.add({ t: 'item', x: c.roof(5), kind: 'survivor' }, { t: 'item', x: c.roof(9), kind: 'survivor' });
  c.lava.slice(0, 5).forEach(([a, w]) => c.add({ t: 'vent', x: a + w / 2 }));
  c.add(pcEnt(4600, 'a2'));
});
const A3 = make({ id: 'a3', biome: 'ash', n: 3, name: 'The Iron Furnace', giver: 'Granny Gert', seed: 903, length: 4800, wind: 4, requires: 'a2', mapPos: [0.8, 0.6], boss: 'furnace', lava: true, unlockPaint: 'ember',
  brief: 'This is it, Jerry. The Scrap Baron himself, in the Iron Furnace. Four valves, a flaming wrecking ball and a very bad attitude. Bring him down and the skies are ours.',
  heights: [90, 200], enemies: ['turret', 'buzzard'], enemyEvery: 560,
  objectives: [{ id: 'o1', text: 'Defeat the Scrap Baron', type: 'boss' }, postcard('a3'), { id: 'o3', text: 'Take no damage', type: 'nodamage', optional: true }],
  rewards: { scrap: 60, electronics: 12, fuel: 16, fabric: 16 } }, (c) => { c.add({ t: 'boss', x: 2450, w: 1700 }, pcEnt(1900, 'a3')); });

export const REGION_MISSIONS: MissionSpec[] = [D1, D2, D3, F1, F2, F3, G1, G2, G3, Z1, Z2, Z3, A1, A2, A3];
