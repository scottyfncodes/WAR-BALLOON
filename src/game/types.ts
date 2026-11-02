import type { ResKey } from './upgrades';
export type ItemKind = ResKey | 'crate' | 'supply' | 'mystery' | 'survivor' | 'postcard' | 'medicine';
export type PowerKind = 'cluster' | 'shield' | 'hotair' | 'bombs';
export type EnemyKind = 'buzzard' | 'turret' | 'buggy' | 'gyro' | 'mine' | 'snapper' | 'moth';
export type TargetKind = 'barricade' | 'junkpile' | 'siren' | 'cratestack' | 'depot';

export interface EntSpec {
  t: 'item' | 'power' | 'enemy' | 'target' | 'powerline' | 'gust' | 'exit' | 'boss' | 'hint' | 'storm' | 'vent';
  style?: 'wind' | 'sand' | 'snow';
  x: number;
  /** altitude above surface (for air things) */
  alt?: number;
  kind?: string;
  tag?: string;
  w?: number; // width for zones / patrol
  x2?: number; // powerline end
  text?: string; // hints
  touchText?: string;
  fx?: number; fy?: number; // gust force
  onRoof?: boolean;
  id?: string;
}

export interface ObjectiveSpec { id: string; text: string; type: 'destroy' | 'collect' | 'rescue' | 'retrieve' | 'boss' | 'nodamage' | 'postcard' | 'deliver'; tag?: string; kind?: string; count?: number; optional?: boolean; }

export interface MissionSpec {
  id: string; name: string; subtitle: string; brief: string; giver: string;
  length: number; seed: number;
  buildings: { x: number; w: number; h: number; chimney?: boolean }[];
  ents: EntSpec[];
  objectives: ObjectiveSpec[];
  rewards: Partial<Record<ResKey, number>>;
  music: string;
  wind: number;
  tutorial?: boolean;
  unlockPaint?: string;
  mapPos: [number, number];
  requires?: string;
  boss?: boolean;
  free?: boolean;
  biome?: string;
  lava?: [number, number][];
  bossCfg?: string;
}
