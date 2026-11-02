import { P } from '../render/palette';
import type { SkyStyle } from '../render/paint';
import type { ResKey } from './resources';
import type { ZKind } from './zombies';

export type BiomeId = 'suburbs' | 'town' | 'industrial' | 'downtown' | 'military' | 'deadzone';
export type ArtStyle = 'city' | 'dust' | 'flood' | 'green' | 'frozen' | 'ash';
export type Ambient = 'none' | 'sand' | 'rain' | 'spores' | 'snow' | 'ash';

/** A region of the zombie-overrun world. `art` picks which painted backdrop family it uses. */
export interface Biome {
  id: BiomeId; name: string; short: string; tagline: string; art: ArtStyle;
  sky: SkyStyle;
  buildings: [string, string, string][];
  overlay: 'none' | 'sand' | 'water' | 'vines' | 'snow' | 'scorch';
  ground: { top: string; mid: string; deep: string; edge: string; bits: string[]; tufts: string[] };
  ambient: Ambient;
  music: string;
  water?: number; iceAlt?: number;
  mapTint: string;
  haze: [string, string];
  under: [string, string, string];
  /** expedition generation */
  length: number;
  bh: [number, number]; // building height range
  bw: [number, number]; // building width range
  gap: [number, number]; // street gap range
  roofZ: [number, number]; // zombies per rooftop
  horde: [number, number]; // zombies per street horde
  zombies: Partial<Record<ZKind, number>>; // spawn weights
  loot: ResKey[];
  pois: string[];
  survivors: [number, number];
  danger: number; // 1..6
  intro: string;
  /** what the player must have to make the trip worthwhile */
  advice: string;
}

const NATURE_GROUND = { top: '#4f6a32', mid: '#5a4a32', deep: '#33281a', edge: P.ink, bits: ['#6a5a3a', '#4f6a3a'], tufts: ['#6f9a3a', '#8ab04a', '#4f7a2a'] };

export const BIOMES: Record<BiomeId, Biome> = {
  suburbs: {
    id: 'suburbs', name: 'Suburban Outskirts', short: 'SUBURBS', tagline: 'Picket fences & shamblers', art: 'green', ambient: 'spores', music: 'flight', overlay: 'vines',
    sky: { top: '#5f8a8a', mid: '#a8c2a0', horizon: '#f0d898', sun: '#fff1c4', glow: '#f2c070', cloud: '#f6ecd0', cloudShade: '#b8a88e' },
    buildings: [['#c9845a', '#9a6040', P.parchment], ['#8aa0a8', '#68808a', P.parchment], ['#d6b070', '#a88a50', P.parchment], ['#a07a9a', '#7a5a76', P.parchment], ['#7a9a6a', '#5a7a4c', P.parchment]],
    ground: NATURE_GROUND,
    mapTint: 'rgba(110,150,60,0.2)', haze: ['rgba(220,225,170,0.55)', 'rgba(190,210,150,0.5)'], under: ['#c0c898', '#6a7a4a', '#3a4a2a'],
    length: 5400, bh: [60, 130], bw: [110, 170], gap: [70, 160], roofZ: [0, 1], horde: [3, 6], zombies: { walker: 10, swarmer: 3 },
    loot: ['food', 'food', 'scrap', 'scrap', 'fabric', 'meds', 'fuel'], pois: ['market', 'gas'], survivors: [3, 4], danger: 1,
    intro: 'Lawns gone to seed and shamblers in their slippers. Fly low for loot — but if they grab the basket, SHAKE them off!',
    advice: 'A gentle start. Learn to dip low, grab, and climb away.',
  },
  town: {
    id: 'town', name: 'Dustbowl Town', short: 'TOWN', tagline: 'Main Street, mostly dead', art: 'dust', ambient: 'sand', music: 'desert', overlay: 'sand',
    sky: { top: '#c9824a', mid: '#e8b070', horizon: '#f6dca0', sun: '#fff1c4', glow: '#f0a050', cloud: '#f7e3bd', cloudShade: '#d29a70' },
    buildings: [['#c08a52', '#9a6a3a', P.parchment], ['#a8744a', '#83573a', P.parchment], ['#d0a066', '#a87a48', P.parchment], ['#9a7a5a', '#7a5e44', P.parchment]],
    ground: { top: '#e3b878', mid: '#d6a564', deep: '#9a6a3a', edge: '#6b4524', bits: ['#c7965a', '#b5824a', '#e8c890'], tufts: ['#8a8a3a', '#a0963e', '#6f7a3a'] },
    mapTint: 'rgba(214,150,70,0.25)', haze: ['rgba(246,210,150,0.65)', 'rgba(240,190,120,0.55)'], under: ['#e8c48c', '#c89460', '#a87444'],
    length: 6000, bh: [80, 170], bw: [100, 160], gap: [60, 140], roofZ: [0, 2], horde: [4, 8], zombies: { walker: 10, swarmer: 4, climber: 3, leaper: 2 },
    loot: ['fuel', 'scrap', 'scrap', 'food', 'parts', 'fabric'], pois: ['gas', 'market', 'clinic'], survivors: [3, 5], danger: 2,
    intro: 'A dusty main street. CLIMBERS scale walls in seconds and LEAPERS jump from rooftops straight at your basket.',
    advice: 'Climbers and Leapers. Keep an eye on rooftops.',
  },
  industrial: {
    id: 'industrial', name: 'Smokestack Row', short: 'INDUSTRY', tagline: 'Factories, fumes & big lads', art: 'ash', ambient: 'ash', music: 'ash', overlay: 'scorch',
    sky: { top: '#4a3a3e', mid: '#8a5a44', horizon: '#e0905a', sun: '#ffc080', glow: '#e07a3a', cloud: '#9a7a6a', cloudShade: '#5a4642' },
    buildings: [['#5a4a46', '#40322e', '#b09080'], ['#6a5040', '#4c382c', '#b09080'], ['#4e4a4a', '#363434', '#b09080'], ['#6e5a48', '#524234', '#b09080']],
    ground: { top: '#3e3430', mid: '#4a3a32', deep: '#241a16', edge: P.ink, bits: ['#5a4a40', '#6a4a30', '#3a3030'], tufts: ['#5a5a3a', '#4a4a30'] },
    mapTint: 'rgba(160,80,40,0.25)', haze: ['rgba(200,130,90,0.55)', 'rgba(160,100,70,0.5)'], under: ['#a87a5a', '#5a4038', '#2e2220'],
    length: 6800, bh: [100, 210], bw: [110, 190], gap: [60, 130], roofZ: [1, 3], horde: [5, 10], zombies: { walker: 9, swarmer: 5, climber: 3, leaper: 3, brute: 2, bloater: 2 },
    loot: ['parts', 'parts', 'scrap', 'scrap', 'fuel', 'fuel', 'tech'], pois: ['factory', 'gas', 'depot'], survivors: [3, 5], danger: 3,
    intro: 'BRUTES hurl rubble and weigh a ton when they grab on. BLOATERS pop — shake them off over a crowd for a free blast.',
    advice: 'Brutes and Bloaters. A mounted gun helps a lot here.',
  },
  downtown: {
    id: 'downtown', name: 'Downtown Metropolis', short: 'DOWNTOWN', tagline: 'Skyscrapers swarming with dead', art: 'city', ambient: 'none', music: 'jungle', overlay: 'none',
    sky: { top: '#4f7f86', mid: '#9cb8a6', horizon: '#f0c27a', sun: '#ffe0a0', glow: '#f2a65a', cloud: '#f6e2bf', cloudShade: '#c99a86' },
    buildings: [[P.tealDark, '#2a4c51', P.parchmentDark], ['#7d5a47', '#5f4334', P.parchmentDark], ['#6e6a4a', '#55513a', P.parchmentDark], ['#8a6a50', '#6b503b', P.parchmentDark], ['#596a6e', '#46555a', P.parchmentDark]],
    ground: { top: '#4a4440', mid: '#7a5a3e', deep: '#3a281c', edge: P.ink, bits: ['#8b7d70', '#6f625a', '#9a5a40'], tufts: [P.olive, P.oliveLight, P.oliveDark] },
    mapTint: 'rgba(0,0,0,0)', haze: ['rgba(240,194,122,0.55)', 'rgba(240,194,122,0.5)'], under: ['#cfae86', '#6f5a48', '#4a3428'],
    length: 7600, bh: [150, 290], bw: [100, 170], gap: [50, 110], roofZ: [1, 4], horde: [6, 12], zombies: { walker: 8, swarmer: 6, climber: 4, leaper: 4, brute: 2, bloater: 2, spitter: 3 },
    loot: ['scrap', 'parts', 'tech', 'meds', 'food', 'fabric', 'fuel'], pois: ['hospital', 'market', 'bank'], survivors: [4, 6], danger: 4,
    intro: 'Towers full of the dead. SPITTERS lob acid at your envelope from far away — take them out before they melt your bag.',
    advice: 'Spitters attack the envelope. Envelope upgrades & a mechanic.',
  },
  military: {
    id: 'military', name: 'Quarantine Zone', short: 'QUARANTINE', tagline: 'Where the army made its last stand', art: 'frozen', ambient: 'snow', music: 'ice', overlay: 'snow',
    sky: { top: '#6f8aa8', mid: '#b4c6d4', horizon: '#eae6dc', sun: '#ffffff', glow: '#d0d8e0', cloud: '#f4f6f8', cloudShade: '#a8b4c4' },
    buildings: [['#7a8a6a', '#5c6a4e', '#f4f6f8'], ['#8a96a4', '#6a7684', '#f4f6f8'], ['#6a7258', '#505842', '#f4f6f8'], ['#7a6a6a', '#5e5252', '#f4f6f8']],
    ground: { top: '#f2f5f8', mid: '#c8d4dc', deep: '#7a8a98', edge: '#3a4a5a', bits: ['#dfe6ec', '#b8c4d0'], tufts: ['#5a6a5a', '#4a5a4a'] },
    mapTint: 'rgba(150,180,210,0.3)', haze: ['rgba(230,236,244,0.7)', 'rgba(210,220,232,0.55)'], under: ['#dfe6ee', '#a0b0c0', '#7a8a9a'],
    length: 8400, bh: [90, 220], bw: [120, 200], gap: [60, 130], roofZ: [2, 4], horde: [7, 13], zombies: { walker: 5, soldier: 6, swarmer: 6, climber: 4, leaper: 4, brute: 3, bloater: 2, spitter: 3, screamer: 2 },
    loot: ['tech', 'tech', 'parts', 'meds', 'meds', 'fuel', 'scrap'], pois: ['armory', 'hospital', 'depot'], survivors: [4, 6], danger: 5,
    intro: 'Armoured SOLDIER zombies shrug off hits and SCREAMERS call the whole horde. Silence screamers fast.',
    advice: 'Screamers and armoured soldiers. Bring a full crew.',
  },
  deadzone: {
    id: 'deadzone', name: 'The Dead Zone', short: 'DEAD ZONE', tagline: 'The heart of the outbreak', art: 'flood', ambient: 'rain', music: 'boss', overlay: 'water',
    sky: { top: '#3a3050', mid: '#6a5a7a', horizon: '#b0a0a0', sun: '#e8e0d0', glow: '#9a8aa0', cloud: '#9a90a8', cloudShade: '#5a5068' },
    buildings: [['#4f5a66', '#3a434e', '#b0b8c0'], ['#5e5660', '#46404a', '#b0b8c0'], ['#4a5a56', '#384442', '#b0b8c0'], ['#665a50', '#4c423a', '#b0b8c0']],
    ground: { top: '#3b4240', mid: '#343a38', deep: '#1c2220', edge: P.ink, bits: ['#4d5a54', '#3a4642'], tufts: ['#4f5a4a', '#5f6a52'] },
    mapTint: 'rgba(80,60,110,0.3)', haze: ['rgba(150,140,170,0.6)', 'rgba(120,110,140,0.5)'], under: ['#8a8898', '#4a4a5a', '#2a2a36'],
    length: 9200, bh: [160, 320], bw: [100, 170], gap: [40, 100], roofZ: [2, 5], horde: [9, 16], zombies: { walker: 6, soldier: 4, swarmer: 8, climber: 5, leaper: 5, brute: 3, bloater: 3, spitter: 4, screamer: 2 },
    loot: ['tech', 'tech', 'parts', 'parts', 'meds', 'fabric', 'scrap'], pois: ['hospital', 'armory', 'lab'], survivors: [5, 7], danger: 6,
    intro: 'Ground zero. Everything that crawls, climbs, leaps and spits — all at once. Only a true flying fortress makes it back.',
    advice: 'Everything at once. Only for a flying fortress.',
  },
};
export const BIOME_ORDER: BiomeId[] = ['suburbs', 'town', 'industrial', 'downtown', 'military', 'deadzone'];
export const biome = (id?: string) => BIOMES[(id as BiomeId) ?? 'suburbs'] ?? BIOMES.suburbs;
export const nextRegion = (id: BiomeId): BiomeId | null => BIOME_ORDER[BIOME_ORDER.indexOf(id) + 1] ?? null;
