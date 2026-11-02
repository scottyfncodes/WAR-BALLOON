import type { ResKey } from '../game/upgrades';

export interface MissionRecord { done: boolean; stars: number; best: number; }
export interface SaveData {
  v: number;
  res: Record<ResKey, number>;
  levels: Record<string, number>;
  missions: Record<string, MissionRecord>;
  postcards: string[];
  paint: string;
  paintsUnlocked: string[];
  seenIntro: boolean;
  music: boolean; sfx: boolean;
  provisions: boolean;
  totalRuns: number;
  stats: { bombs: number; destroyed: number; hooked: number; };
}

const KEY = 'warballoon.save.v1';

export function freshSave(): SaveData {
  return {
    v: 1,
    res: { fuel: 0, scrap: 0, fabric: 0, food: 1, water: 1, electronics: 0 },
    levels: {}, missions: {}, postcards: [], paint: 'classic', paintsUnlocked: ['classic'],
    seenIntro: false, music: true, sfx: true, provisions: false, totalRuns: 0,
    stats: { bombs: 0, destroyed: 0, hooked: 0 },
  };
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const d = JSON.parse(raw);
    const f = freshSave();
    return { ...f, ...d, res: { ...f.res, ...(d.res || {}) }, stats: { ...f.stats, ...(d.stats || {}) } };
  } catch { return freshSave(); }
}

export const Save = {
  data: load(),
  write() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage blocked: progress lives for this session */ } },
  reset() { this.data = freshSave(); this.write(); },
};
