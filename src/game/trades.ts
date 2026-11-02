import type { Cost } from './upgrades';
import type { BiomeId } from './biomes';

export interface Trade { id: string; camp: BiomeId; who: string; give: Cost; get: Cost; line: string; }

/** Each camp swaps what it has plenty of for what it needs — a reason to keep flying supply runs. */
export const TRADES: Trade[] = [
  { id: 'h1', camp: 'city', who: 'Granny Gert', give: { scrap: 12 }, get: { fabric: 4 }, line: 'I\'ll sew you patches for scrap.' },
  { id: 'h2', camp: 'city', who: 'Granny Gert', give: { food: 2, water: 2 }, get: { scrap: 10 }, line: 'Feed the workshop, it feeds you.' },
  { id: 'd1', camp: 'dust', who: 'Caravan boss Dot', give: { water: 3 }, get: { fuel: 12 }, line: 'Water\'s gold out here. Fuel isn\'t.' },
  { id: 'd2', camp: 'dust', who: 'Caravan boss Dot', give: { fuel: 10 }, get: { electronics: 2 }, line: 'Found some radios in a buried shop.' },
  { id: 'f1', camp: 'flood', who: 'Ferryman Gus', give: { scrap: 14 }, get: { water: 4, fabric: 3 }, line: 'Sails and drinking water, fair price.' },
  { id: 'f2', camp: 'flood', who: 'Ferryman Gus', give: { fabric: 8 }, get: { food: 3 }, line: 'Fish for canvas. Nets keep tearing.' },
  { id: 'g1', camp: 'green', who: 'Gardener Ottoline', give: { water: 4 }, get: { food: 5 }, line: 'Thirsty seedlings, hungry pilots.' },
  { id: 'g2', camp: 'green', who: 'Gardener Ottoline', give: { scrap: 16 }, get: { fabric: 8 }, line: 'Hemp canvas — tougher than it looks.' },
  { id: 'z1', camp: 'frozen', who: 'Dr. Penny Frost', give: { food: 3, fuel: 6 }, get: { electronics: 4 }, line: 'Science runs on soup and diesel.' },
  { id: 'z2', camp: 'frozen', who: 'Dr. Penny Frost', give: { electronics: 3 }, get: { scrap: 24 }, line: 'Spare parts by the crate.' },
  { id: 'a1', camp: 'ash', who: 'Forge-hand Rook', give: { electronics: 4 }, get: { scrap: 30 }, line: 'Melted down Baron junk, still warm.' },
  { id: 'a2', camp: 'ash', who: 'Forge-hand Rook', give: { scrap: 20 }, get: { fuel: 16 }, line: 'The forge brews fuel like coffee.' },
];
