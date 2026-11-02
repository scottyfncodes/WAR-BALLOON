import { P } from '../render/palette';
import type { SkyStyle } from '../render/paint';
import type { ResKey } from './upgrades';

export type BiomeId = 'city' | 'dust' | 'flood' | 'green' | 'frozen' | 'ash';
export type Ambient = 'none' | 'sand' | 'rain' | 'spores' | 'snow' | 'ash';

export interface Biome {
  id: BiomeId; name: string; tagline: string;
  sky: SkyStyle;
  /** gameplay building palettes [base, shade, trim] */
  buildings: [string, string, string][];
  overlay: 'none' | 'sand' | 'water' | 'vines' | 'snow' | 'scorch';
  ground: { top: string; mid: string; deep: string; edge: string; bits: string[]; tufts: string[] };
  ambient: Ambient;
  music: string;
  requires?: string; // mission id that unlocks the region
  water?: number; // flood water surface y
  iceAlt?: number; // y above which icing builds up
  lava?: boolean;
  mapTint: string; // map parchment tint
  /** background layer far/mid haze colours */
  haze: [string, string];
  under: [string, string, string];
  loot: ResKey[];
  intro: string;
}

export const BIOMES: Record<BiomeId, Biome> = {
  city: {
    id: 'city', name: 'The Dead City', tagline: 'Rust, ruin and rooftops', ambient: 'none', music: 'flight', overlay: 'none',
    sky: { top: '#4f7f86', mid: '#9cb8a6', horizon: '#f0c27a', sun: '#ffe0a0', glow: '#f2a65a', cloud: '#f6e2bf', cloudShade: '#c99a86' },
    buildings: [[P.tealDark, '#2a4c51', P.parchmentDark], ['#7d5a47', '#5f4334', P.parchmentDark], ['#6e6a4a', '#55513a', P.parchmentDark], ['#8a6a50', '#6b503b', P.parchmentDark], ['#596a6e', '#46555a', P.parchmentDark]],
    ground: { top: '#4a4440', mid: '#7a5a3e', deep: '#3a281c', edge: P.ink, bits: ['#8b7d70', '#6f625a', '#9a5a40'], tufts: [P.olive, P.oliveLight, P.oliveDark] },
    mapTint: 'rgba(0,0,0,0)', haze: ['rgba(240,194,122,0.55)', 'rgba(240,194,122,0.5)'], under: ['#cfae86', '#6f5a48', '#4a3428'],
    loot: ['scrap', 'scrap', 'fabric', 'fuel', 'food', 'water', 'electronics'], intro: '',
  },
  dust: {
    id: 'dust', name: 'The Dustlands', tagline: 'Sandstorms & buried towns', ambient: 'sand', music: 'desert', overlay: 'sand', requires: 'm4',
    sky: { top: '#c9824a', mid: '#e8b070', horizon: '#f6dca0', sun: '#fff1c4', glow: '#f0a050', cloud: '#f7e3bd', cloudShade: '#d29a70' },
    buildings: [['#c08a52', '#9a6a3a', P.parchment], ['#a8744a', '#83573a', P.parchment], ['#d0a066', '#a87a48', P.parchment], ['#9a7a5a', '#7a5e44', P.parchment]],
    ground: { top: '#e3b878', mid: '#d6a564', deep: '#9a6a3a', edge: '#6b4524', bits: ['#c7965a', '#b5824a', '#e8c890'], tufts: ['#8a8a3a', '#a0963e', '#6f7a3a'] },
    mapTint: 'rgba(214,150,70,0.28)', haze: ['rgba(246,210,150,0.65)', 'rgba(240,190,120,0.55)'], under: ['#e8c48c', '#c89460', '#a87444'],
    loot: ['fuel', 'fuel', 'scrap', 'scrap', 'water', 'electronics'],
    intro: 'Sand to the horizon and whole towns buried to their rooftops. Sandstorms shove you around — and the scavengers love a dune buggy.',
  },
  flood: {
    id: 'flood', name: 'The Flood', tagline: 'Drowned streets & storm clouds', ambient: 'rain', music: 'sea', overlay: 'water', requires: 'd3', water: 448,
    sky: { top: '#3d5a6e', mid: '#7f9aa3', horizon: '#c7d0c0', sun: '#eef0dc', glow: '#a9bdb4', cloud: '#d8dcd2', cloudShade: '#8a96a0' },
    buildings: [['#5d7a80', '#465e63', '#c9cfc0'], ['#6e6a62', '#55524b', '#c9cfc0'], ['#7c6a5a', '#5f5246', '#c9cfc0'], ['#4f6670', '#3c4f57', '#c9cfc0']],
    ground: { top: '#4b5650', mid: '#3e4a46', deep: '#26302e', edge: P.ink, bits: ['#5d6a64', '#4a5652'], tufts: ['#4f6a4a', '#5f7a52'] },
    mapTint: 'rgba(63,127,134,0.28)', haze: ['rgba(190,205,200,0.65)', 'rgba(170,190,190,0.55)'], under: ['#a8b8b4', '#5a7276', '#3a5258'],
    loot: ['water', 'fabric', 'fabric', 'scrap', 'food', 'electronics'],
    intro: 'Half the city went under. Dunk the basket and you\'ll be bailing water — mind the floating mines and the lightning.',
  },
  green: {
    id: 'green', name: 'The Green', tagline: 'Overgrown & hungry', ambient: 'spores', music: 'jungle', overlay: 'vines', requires: 'f3',
    sky: { top: '#5f8a6a', mid: '#a8c290', horizon: '#e8e0a0', sun: '#fff6c8', glow: '#c8d080', cloud: '#eef0d0', cloudShade: '#9ab08a' },
    buildings: [['#6a7a5a', '#525f45', '#d8d8a8'], ['#7a6a52', '#5e5240', '#d8d8a8'], ['#5a6e64', '#45554d', '#d8d8a8'], ['#8a7a5e', '#6b5e48', '#d8d8a8']],
    ground: { top: '#4f6a32', mid: '#5a4a32', deep: '#33281a', edge: P.ink, bits: ['#6a5a3a', '#4f6a3a'], tufts: ['#6f9a3a', '#8ab04a', '#4f7a2a'] },
    mapTint: 'rgba(110,150,60,0.28)', haze: ['rgba(200,220,160,0.6)', 'rgba(170,200,130,0.5)'], under: ['#b8c890', '#5a7244', '#3a4a2a'],
    loot: ['food', 'food', 'fabric', 'scrap', 'water', 'electronics'],
    intro: 'Nature took the city back and grew teeth. Snapper plants lurk on rooftops and the moths are the size of dogs.',
  },
  frozen: {
    id: 'frozen', name: 'The Frozen Reach', tagline: 'Ice, blizzards & research labs', ambient: 'snow', music: 'ice', overlay: 'snow', requires: 'g3', iceAlt: 250,
    sky: { top: '#6f8aa8', mid: '#b4c6d4', horizon: '#eae6dc', sun: '#ffffff', glow: '#d0d8e0', cloud: '#f4f6f8', cloudShade: '#a8b4c4' },
    buildings: [['#8a96a4', '#6a7684', '#f4f6f8'], ['#7a6a6a', '#5e5252', '#f4f6f8'], ['#9aa8a8', '#7a8888', '#f4f6f8'], ['#6a7a8a', '#526070', '#f4f6f8']],
    ground: { top: '#f2f5f8', mid: '#c8d4dc', deep: '#7a8a98', edge: '#3a4a5a', bits: ['#dfe6ec', '#b8c4d0'], tufts: ['#5a6a5a', '#4a5a4a'] },
    mapTint: 'rgba(150,180,210,0.3)', haze: ['rgba(230,236,244,0.7)', 'rgba(210,220,232,0.55)'], under: ['#dfe6ee', '#a0b0c0', '#7a8a9a'],
    loot: ['electronics', 'electronics', 'scrap', 'fuel', 'food', 'fabric'],
    intro: 'Abandoned research labs full of electronics. Fly too high and ice builds up on the envelope — it gets heavy fast.',
  },
  ash: {
    id: 'ash', name: 'The Ashlands', tagline: 'Lava, ash & the Scrap Baron\'s forge', ambient: 'ash', music: 'ash', overlay: 'scorch', requires: 'z3', lava: true,
    sky: { top: '#3a2a2e', mid: '#7a4a3a', horizon: '#d8784a', sun: '#ffb070', glow: '#e05a2a', cloud: '#8a6a62', cloudShade: '#4a3632' },
    buildings: [['#4a3a36', '#33282a', '#a08070'], ['#5a4038', '#402c26', '#a08070'], ['#3e3a3a', '#2a2828', '#a08070'], ['#5e4a3a', '#44342a', '#a08070']],
    ground: { top: '#2e2624', mid: '#3a2c28', deep: '#1e1614', edge: P.ink, bits: ['#4a3a34', '#5a3a2a', '#6a3a22'], tufts: ['#5a4a3a', '#4a3a2a'] },
    mapTint: 'rgba(160,60,30,0.3)', haze: ['rgba(200,110,70,0.6)', 'rgba(150,80,60,0.5)'], under: ['#a86a4a', '#5a3a30', '#2e2220'],
    loot: ['scrap', 'scrap', 'scrap', 'electronics', 'fuel'],
    intro: 'Volcanic ruins around the Scrap Baron\'s forge. Lava pools scorch the basket and fire vents erupt without much warning.',
  },
};
export const CAMP_NAMES: Record<BiomeId, string> = { city: 'HAVEN', dust: 'CARAVAN', flood: 'FERRY', green: 'GREENHOUSE', frozen: 'STATION', ash: 'CAMP' };
export const BIOME_ORDER: BiomeId[] = ['city', 'dust', 'flood', 'green', 'frozen', 'ash'];
export const biome = (id?: string) => BIOMES[(id as BiomeId) ?? 'city'] ?? BIOMES.city;
