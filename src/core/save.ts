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
  population: number;
  seenRegions: string[];
  fails: Record<string, number>;
  camps: Record<string, number>;
  difficulty: 'relaxed' | 'normal' | 'hard';
  ach: string[];
  flags: Record<string, boolean>;
  stats: { bombs: number; destroyed: number; hooked: number; };
}

const KEY = 'warballoon.save.v1';
const PERK_OF: Record<string, string> = { city: 'workshop', dust: 'fuelrich', flood: 'longrope', green: 'herbal', frozen: 'lab', ash: 'forge' };

export function freshSave(): SaveData {
  return {
    v: 1,
    res: { fuel: 0, scrap: 0, fabric: 0, food: 1, water: 1, electronics: 0 },
    levels: {}, missions: {}, postcards: [], paint: 'classic', paintsUnlocked: ['classic'],
    seenIntro: false, music: true, sfx: true, provisions: false, totalRuns: 0, population: 0, seenRegions: ['city'], fails: {}, camps: {}, difficulty: 'normal', ach: [], flags: {},
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
  /** Permanent perks earned by completing every request at a camp. */
  perks(): string[] { return Object.entries(PERK_OF).filter(([c]) => (this.data.camps[c] ?? 0) >= 3).map(([, p]) => p); },
  write() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage blocked: progress lives for this session */ } },
  reset() { this.data = freshSave(); this.write(); },
  /** Portable save code (survives clearing Safari data if you keep the code). */
  exportCode(): string { return 'WB1.' + btoa(unescape(encodeURIComponent(JSON.stringify(this.data)))); },
  importCode(code: string): boolean {
    try {
      const c = code.trim(); if (!c.startsWith('WB1.')) return false;
      const d = JSON.parse(decodeURIComponent(escape(atob(c.slice(4)))));
      if (!d || typeof d !== 'object' || !d.res) return false;
      const f = freshSave();
      this.data = { ...f, ...d, res: { ...f.res, ...d.res }, stats: { ...f.stats, ...(d.stats || {}) } };
      this.write(); return true;
    } catch { return false; }
  },
};
