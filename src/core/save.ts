import type { ResKey } from '../game/resources';
import type { CrewMember } from '../game/crew';
import type { BiomeId } from '../game/biomes';
import type { DecorSlot } from '../game/cosmetics';

export interface RegionRecord { beacon: boolean; runs: number; best: number; }
export interface SaveData {
  v: number;
  res: Record<ResKey, number>;
  levels: Record<string, number>;
  crew: CrewMember[];
  aboard: string[];
  regions: Partial<Record<BiomeId, RegionRecord>>;
  region: BiomeId;
  /** crew lost when the balloon went down; they can be found again in that region */
  missing: Record<string, BiomeId>;
  decor: Record<DecorSlot, string>;
  owned: string[];
  trophies: string[];
  seenIntro: boolean; seenTutorial: boolean;
  music: boolean; sfx: boolean; lefty: boolean;
  difficulty: 'relaxed' | 'normal' | 'hard';
  stats: { expeditions: number; zombies: number; rescued: number; shaken: number; crashes: number; maxHangers: number; };
  ach: string[];
  veteran?: boolean;
  /** calm effects (no screen shake, softer flashes); unset = follow the device's reduced-motion setting */
  calm?: boolean;
}

const KEY = 'warballoon.save.v2';
const OLD_KEY = 'warballoon.save.v1';

export function freshSave(): SaveData {
  return {
    v: 2,
    res: { scrap: 10, fabric: 4, parts: 0, tech: 0, fuel: 4, food: 6, meds: 2 },
    levels: {}, crew: [], aboard: [], regions: { suburbs: { beacon: false, runs: 0, best: 0 } }, region: 'suburbs', missing: {},
    decor: { paint: 'classic', material: 'wicker', flag: 'noflag', lights: 'nolights', furniture: 'nofurn' },
    owned: ['classic', 'wicker', 'noflag', 'nolights', 'nofurn'], trophies: [],
    seenIntro: false, seenTutorial: false, music: true, sfx: true, lefty: false, difficulty: 'normal',
    stats: { expeditions: 0, zombies: 0, rescued: 0, shaken: 0, crashes: 0, maxHangers: 0 }, ach: [],
  };
}

function merge(d: any): SaveData {
  const f = freshSave();
  return { ...f, ...d, res: { ...f.res, ...(d.res || {}) }, stats: { ...f.stats, ...(d.stats || {}) }, decor: { ...f.decor, ...(d.decor || {}) }, regions: { ...f.regions, ...(d.regions || {}) } };
}

/** Pilots from the old machine-war version keep a care package. */
function migrate(old: any): SaveData {
  const s = freshSave();
  const r = old?.res || {};
  s.res.scrap += Math.min(60, r.scrap | 0); s.res.fabric += Math.min(30, r.fabric | 0); s.res.fuel += Math.min(20, r.fuel | 0);
  s.res.food += Math.min(10, r.food | 0); s.res.meds += Math.min(6, r.water | 0); s.res.tech += Math.min(6, r.electronics | 0);
  for (const p of (old?.paintsUnlocked || []) as string[]) if (!s.owned.includes(p)) s.owned.push(p);
  s.music = old?.music ?? true; s.sfx = old?.sfx ?? true; s.lefty = !!old?.lefty; s.veteran = true;
  return s;
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(JSON.parse(raw));
    const old = localStorage.getItem(OLD_KEY);
    if (old) return migrate(JSON.parse(old));
  } catch { /* corrupted or blocked storage: start fresh */ }
  return freshSave();
}

/** True when screen shake and flashes should be calmed (player choice, else prefers-reduced-motion). */
export function calmFx(): boolean {
  const c = Save.data.calm;
  if (typeof c === 'boolean') return c;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** M mutes everything; pressing it again brings music and sound back. */
export function toggleMute(): boolean {
  const s = Save.data; const on = !(s.music || s.sfx);
  s.music = on; s.sfx = on; Save.write(); return on;
}

export const Save = {
  data: load(),
  write() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage blocked: progress lives for this session */ } },
  reset() { this.data = freshSave(); this.write(); },
  reload() { this.data = load(); },
  exportCode(): string { return 'WB2.' + btoa(unescape(encodeURIComponent(JSON.stringify(this.data)))); },
  importCode(code: string): boolean {
    try {
      const c = code.trim(); if (!c.startsWith('WB2.')) return false;
      const d = JSON.parse(decodeURIComponent(escape(atob(c.slice(4)))));
      if (!d || typeof d !== 'object' || !d.res) return false;
      this.data = merge(d); this.write(); return true;
    } catch { return false; }
  },
  crewById(id: string) { return this.data.crew.find((c) => c.id === id); },
  aboardCrew() { return this.data.aboard.map((id) => this.crewById(id)).filter((c): c is CrewMember => !!c && c.injured <= 0); },
  regionUnlocked(i: number, order: string[]) { if (i === 0) return true; const prev = this.data.regions[order[i - 1] as BiomeId]; return !!prev?.beacon; },
  comfort() { return this.data.owned.filter((id) => !id.startsWith('no') && !['classic', 'wicker'].includes(id)).length + this.data.trophies.length; },
};
