import type { SaveData } from '../core/save';
import { MISSIONS } from './missions';

export interface Achievement { id: string; name: string; desc: string; test: (s: SaveData) => boolean; }
const done = (s: SaveData, id: string) => !!s.missions[id]?.done;
const BOSS_IDS = ['m4', 'd3', 'f3', 'g3', 'z3', 'a3'];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'liftoff', name: 'Lift Off', desc: 'Complete your first mission.', test: (s) => done(s, 'm1') },
  { id: 'bombs', name: 'Bombs Away', desc: 'Drop 100 bombs.', test: (s) => s.stats.bombs >= 100 },
  { id: 'demo', name: 'Demolition Expert', desc: 'Destroy 50 machines and targets.', test: (s) => s.stats.destroyed >= 50 },
  { id: 'hooked', name: 'Hooked on Hooking', desc: 'Retrieve 50 things with the hook.', test: (s) => s.stats.hooked >= 50 },
  { id: 'mayor', name: 'Mayor of Haven', desc: 'Grow Haven to 10 residents.', test: (s) => s.population >= 10 },
  { id: 'penpal', name: 'Pen Pal', desc: 'Find 5 lost postcards.', test: (s) => s.postcards.length >= 5 },
  { id: 'wish', name: 'Wish You Were Here', desc: 'Find every lost postcard.', test: (s) => s.postcards.length >= MISSIONS.length },
  { id: 'giant', name: 'Giant Slayer', desc: 'Defeat a boss.', test: (s) => BOSS_IDS.some((id) => done(s, id)) },
  { id: 'bane', name: 'Scrap Baron\'s Bane', desc: 'Defeat all six bosses.', test: (s) => BOSS_IDS.every((id) => done(s, id)) },
  { id: 'flawless', name: 'Untouchable', desc: 'Beat a boss without taking a hit.', test: (s) => !!s.flags.flawless },
  { id: 'hardboss', name: 'Glutton for Punishment', desc: 'Beat a boss on Hard.', test: (s) => !!s.flags.hardBoss },
  { id: 'neighbour', name: 'Good Neighbour', desc: 'Earn a camp perk.', test: (s) => Object.values(s.camps).some((n) => n >= 3) },
  { id: 'loaded', name: 'Fully Loaded', desc: 'Buy 20 upgrade levels.', test: (s) => Object.values(s.levels).reduce((a, b) => a + b, 0) >= 20 },
  { id: 'gold', name: 'Gold Star Pilot', desc: 'Earn 3 stars on 10 missions.', test: (s) => Object.values(s.missions).filter((m) => m.stars >= 3).length >= 10 },
];

/** Marks newly earned achievements; returns their names. */
export function checkAchievements(s: SaveData): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) if (!s.ach.includes(a.id) && a.test(s)) { s.ach.push(a.id); out.push(a.name); }
  return out;
}
