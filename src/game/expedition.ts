import { P } from '../render/palette';
import { pen, inkText, bodyText } from '../render/ink';
import { clamp, dist, rand, pick, RNG, damp, buzz } from '../core/math';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { Terrain, CEILING, type Building, type BuildingSpec } from './level';
import { Airship, CrewSlot, S, type Controls, type Weapon } from './airship';
import { Zombie, Z_INFO, type ZKind } from './zombies';
import { BIOMES, BIOME_ORDER, type Biome, type BiomeId } from './biomes';
import { FX } from './fx';
import { computeStats } from './upgrades';
import { RES_KEYS, drawResIcon, type ResKey, type LootKind } from './resources';
import { makeSurvivor, levelFor, RESCUE_LINES, type CrewMember } from './crew';
import { TROPHIES, trophyById } from './cosmetics';
import { drawCharacterMini } from '../render/crewArt';

export class Loot {
  x: number; y: number; vx = 0; vy = 0; kind: LootKind; r: number; weight: number; hooked = false; dead = false; t = rand(0, 9); trophy?: string;
  constructor(x: number, y: number, kind: LootKind) {
    this.x = x; this.y = y; this.kind = kind;
    this.r = kind === 'cache' ? 17 : kind === 'crate' ? 14 : 11;
    this.weight = kind === 'cache' ? 1.1 : kind === 'crate' ? 0.7 : 0.25;
  }
  update(e: Expedition, dt: number) {
    this.t += dt;
    if (this.hooked) return;
    const sy = e.terrain.surfaceY(this.x) - this.r * 0.8;
    if (this.y < sy - 0.5 || this.vy < 0) {
      this.vy += 700 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      const s2 = e.terrain.surfaceY(this.x) - this.r * 0.8;
      if (this.y >= s2) { this.y = s2; this.vy = 0; this.vx *= 0.5; }
    } else this.y = sy;
  }
}

class Ordnance {
  kind: Weapon | 'bomblet'; x: number; y: number; vx: number; vy: number; dead = false; t = 0; stuck = false; armed = 0;
  constructor(kind: Weapon | 'bomblet', x: number, y: number, vx: number, vy: number) { this.kind = kind; this.x = x; this.y = y; this.vx = vx; this.vy = vy; }
}
interface Proj { kind: 'acid' | 'rubble'; x: number; y: number; vx: number; vy: number; dead: boolean; t: number; }
interface Fire { x: number; y: number; w: number; t: number; max: number; }
interface Tracer { x1: number; y1: number; x2: number; y2: number; t: number; }
export interface Survivor { x: number; y: number; bld: Building; m: CrewMember; state: 'wait' | 'climb' | 'aboard' | 'lost'; prog: number; hp: number; t: number; missing: boolean; full: number; line: string; }
interface POI { x: number; w: number; kind: string; name: string; bld: Building; }
interface Banner { text: string; sub?: string; color?: string; t: number; }

const POI_INFO: Record<string, { name: string; loot: LootKind[]; w: number; h: number; survivor?: boolean; chimney?: boolean }> = {
  gas: { name: 'GAS-N-GO', loot: ['fuel', 'fuel', 'fuel', 'fuel'], w: 190, h: 70 },
  market: { name: 'SUPERMART', loot: ['food', 'food', 'food', 'food', 'cache'], w: 210, h: 90 },
  clinic: { name: 'CLINIC', loot: ['meds', 'meds', 'meds'], w: 150, h: 110, survivor: true },
  hospital: { name: 'HOSPITAL', loot: ['meds', 'meds', 'meds', 'meds', 'cache'], w: 170, h: 230, survivor: true },
  factory: { name: 'FACTORY', loot: ['parts', 'parts', 'parts', 'parts', 'cache'], w: 200, h: 150, chimney: true },
  depot: { name: 'FUEL DEPOT', loot: ['fuel', 'fuel', 'fuel', 'parts', 'parts'], w: 180, h: 100 },
  armory: { name: 'ARMORY', loot: ['tech', 'tech', 'parts', 'parts', 'cache'], w: 180, h: 130, survivor: true },
  bank: { name: 'BANK', loot: ['scrap', 'scrap', 'scrap', 'tech', 'cache'], w: 160, h: 200 },
  lab: { name: 'LAB', loot: ['tech', 'tech', 'tech', 'meds', 'cache'], w: 170, h: 180, survivor: true },
};
const BASE_AMT: Record<ResKey, number> = { scrap: 3, fabric: 2, parts: 2, tech: 1, fuel: 2, food: 2, meds: 1 };

export interface Tip { id: string; text: string; touch?: string; }
const TIPS: Record<string, Tip> = {
  fly: { id: 'fly', text: 'Hold UP (or W) to fire the burner and climb. Left/right to drift.', touch: 'Drag on the left side to fly: drag UP for the burner.' },
  low: { id: 'low', text: 'Dip low over rooftops to HOOK supplies (H). Low = loot, but low = hands!', touch: 'Fly low over loot and tap HOOK. Low means loot — and grabby hands!' },
  grab: { id: 'grab', text: 'A zombie grabbed the basket! SHAKE (X key) or climb high to throw it off!', touch: 'A zombie grabbed the basket! Tap SHAKE (or wiggle the stick)!' },
  board: { id: 'board', text: 'One climbed aboard! Jerry and the crew will fight it — shake the rest off fast.', touch: 'One climbed aboard! Your crew fights back — shake the others off!' },
  survivor: { id: 'survivor', text: 'A survivor! Hover low over their roof — the rope ladder drops on its own.', touch: 'A survivor! Hover low over their roof and the ladder drops on its own.' },
  home: { id: 'home', text: 'Loot only counts once you fly it back to HAVEN (or bank it at the outpost).', touch: 'Loot only counts once you fly it home to HAVEN.' },
  bomb: { id: 'bomb', text: 'Too many below? Drop a BOMB (B). Crowds go flying.', touch: 'Big crowd? Tap DROP to bomb them.' },
};

export class Expedition {
  region: Biome; terrain: Terrain; length: number; ship: Airship; fx = new FX();
  zombies: Zombie[] = []; loot: Loot[] = []; survivors: Survivor[] = []; pois: POI[] = [];
  ord: Ordnance[] = []; projs: Proj[] = []; fires: Fire[] = []; tracers: Tracer[] = [];
  haven!: Building; outpost!: Building; beacon!: Building;
  cargo: Record<ResKey, number> = { scrap: 0, fabric: 0, parts: 0, tech: 0, fuel: 0, food: 0, meds: 0 };
  banked: Record<ResKey, number> = { scrap: 0, fabric: 0, parts: 0, tech: 0, fuel: 0, food: 0, meds: 0 };
  rescued: CrewMember[] = []; bankedRescued: CrewMember[] = []; trophies: string[] = []; bankedTrophies: string[] = [];
  state: 'play' | 'home' | 'crashed' = 'play'; endT = 0; crashWhy = '';
  camX = 0; camY = 0; viewW = 960; viewH = 540; time = 0;
  banners: Banner[] = []; tip: { tip: Tip; t: number } | null = null; tipsShown = new Set<string>(); tutorial: boolean;
  aggro = 1; zSpeed = 1; spawnT = 6; kills = 0; maxHangers = 0; shaken = 0; outbound = false; refueled = false;
  outpostT = 0; homeT = 0; beaconT = 0; beaconLit = false; beaconBanked = false; beaconWasLit: boolean; fullNagT = 0;
  rng: RNG; reveal = 600; cap = 70; distMax = 0; foodUsed = 0;
  /** only one ranged attack in the air at a time, so every shot is readable and dodgeable */
  rangedCd = 0;
  canRanged() { if (this.rangedCd > 0) return false; this.rangedCd = 2.6 - this.region.danger * 0.25; return true; }

  constructor(regionId: BiomeId, seed = Math.floor(Math.random() * 1e9)) {
    const s = Save.data;
    this.region = BIOMES[regionId];
    this.rng = new RNG(seed);
    this.length = this.region.length;
    this.tutorial = !s.seenTutorial;
    this.aggro = s.difficulty === 'relaxed' ? 0.65 : s.difficulty === 'hard' ? 1.3 : 1;
    this.zSpeed = (s.difficulty === 'relaxed' ? 0.85 : s.difficulty === 'hard' ? 1.12 : 1) * (0.97 + 0.03 * this.region.danger);
    this.beaconWasLit = !!s.regions[regionId]?.beacon;
    const specs = this.generate();
    this.terrain = new Terrain(this.length, seed % 9973, specs, this.region);
    for (const b of this.terrain.buildings) { if (b.kind === 'haven') this.haven = b; if (b.kind === 'outpost') this.outpost = b; if (b.kind === 'beacon') this.beacon = b; }
    const stats = computeStats(s.levels);
    const crew = Save.aboardCrew().slice(0, stats.seats);
    const hpBonus = s.difficulty === 'relaxed' ? 2 : s.difficulty === 'hard' ? -1 : 0;
    const hx = this.haven.x + this.haven.w / 2;
    this.ship = new Airship(hx, 0, stats, s.levels, s.decor, s.trophies, crew, hpBonus);
    this.ship.y = this.haven.top - this.ship.g.bottom * S;
    this.populate();
    for (const z of this.zombies) this.toughen(z);
    this.cap = Math.round((50 + this.region.danger * 8) * (s.difficulty === 'hard' ? 1.2 : 1));
    this.camX = Math.max(0, hx - 400);
    this.updateReveal();
  }

  // ======================================================= generation
  private generate(): BuildingSpec[] {
    const r = this.region, rng = this.rng, L = this.length;
    const specs: BuildingSpec[] = [];
    specs.push({ x: 110, w: 190, h: 150, kind: 'haven' });
    const outX = Math.round(L * 0.52), beaconX = L - 380;
    const poiKinds = [...r.pois].sort(() => rng.next() - 0.5);
    const poiAt = [0.28, 0.66, 0.84].slice(0, poiKinds.length).map((f) => L * f);
    let x = 420, outDone = false;
    while (x < L - 520) {
      if (!outDone && x > outX - 260) { outDone = true; specs.push({ x: outX - 85, w: 170, h: 200, kind: 'outpost' }); x = outX + 85 + rng.range(r.gap[0], r.gap[1]) + 30; continue; }
      const pi = poiAt.findIndex((px) => px >= 0 && Math.abs(px - x) < 200);
      if (pi >= 0) {
        const k = poiKinds[pi]; const info = POI_INFO[k];
        specs.push({ x, w: info.w, h: info.h + rng.range(-10, 20), kind: 'poi:' + k, chimney: info.chimney });
        poiAt[pi] = -9999; x += info.w + rng.range(r.gap[0], r.gap[1]); continue;
      }
      const w = rng.range(r.bw[0], r.bw[1]), h = rng.range(r.bh[0], r.bh[1]);
      if (x + w < beaconX - 80) specs.push({ x, w, h, chimney: r.art === 'ash' && rng.chance(0.35) });
      x += w + rng.range(r.gap[0], r.gap[1]);
    }
    specs.push({ x: beaconX, w: 130, h: Math.max(200, r.bh[1] + 30), kind: 'beacon' });
    return specs;
  }

  pickKind(): ZKind {
    const z = this.region.zombies; const tot = Object.values(z).reduce((a, b) => a + (b ?? 0), 0);
    let k = this.rng.next() * tot;
    for (const [kind, w] of Object.entries(z)) { k -= w ?? 0; if (k <= 0) return kind as ZKind; }
    return 'walker';
  }
  /** deeper regions breed tougher dead (so guns alone can't carry a run) */
  toughen(z: Zombie) { if (z.tough) return; z.tough = true; if (z.kind !== 'swarmer' && z.kind !== 'bloater') z.hp += Math.floor((this.region.danger - 1) / 2); }
  /** The beacon only counts once its signal gets home safe (Haven or the outpost). */
  commitBeacon() {
    if (this.beaconBanked) return;
    this.beaconBanked = true;
    const rec = Save.data.regions[this.region.id] ?? { beacon: false, runs: 0, best: 0 };
    rec.beacon = true; Save.data.regions[this.region.id] = rec; Save.write();
  }
  isSafe(b: Building) { return b.kind === 'haven' || b.kind === 'outpost'; }

  private populate() {
    const r = this.region, rng = this.rng, s = Save.data;
    const normal = this.terrain.buildings.filter((b) => !b.kind || b.kind.startsWith('poi:'));
    // rooftop zombies & loot
    for (const b of this.terrain.buildings) {
      if (this.isSafe(b)) continue;
      const far = (b.x / this.length);
      let nz = Math.round((rng.int(r.roofZ[0], r.roofZ[1]) + (far > 0.6 ? 1 : 0)) * (r.danger >= 4 ? 0.8 : 1));
      if (b.kind === 'beacon') nz += 3 + r.danger;
      if (b.kind?.startsWith('poi:')) nz += 1 + Math.floor(r.danger / 2);
      for (let i = 0; i < nz; i++) this.zombies.push(new Zombie(rng.range(b.x + 8, b.x + b.w - 8), b.top, this.pickKind(), b));
      if (b.kind?.startsWith('poi:')) {
        const info = POI_INFO[b.kind.slice(4)];
        this.pois.push({ x: b.x, w: b.w, kind: b.kind.slice(4), name: info.name, bld: b });
        info.loot.forEach((k, i) => this.loot.push(new Loot(b.x + 16 + (i * (b.w - 32)) / Math.max(1, info.loot.length - 1), b.top - 14, k)));
      } else if (b.kind !== 'beacon' && rng.chance(0.6)) {
        this.loot.push(new Loot(rng.range(b.x + 14, b.x + b.w - 14), b.top - 12, rng.chance(0.25) ? 'crate' : rng.pick(r.loot)));
      }
    }
    // street hordes and street loot
    for (let x = 520; x < this.length - 300; x += rng.range(340, 560)) {
      const thin = r.danger >= 4 ? 0.75 : 1; // keep the screen readable (and phones cool) deep in
      const n = Math.round(rng.int(r.horde[0], r.horde[1]) * (0.7 + 0.6 * x / this.length) * thin);
      for (let i = 0; i < n; i++) this.spawnGround(x + rng.range(-60, 60), this.pickKind());
      if (rng.chance(0.55)) { const gx = this.gapNear(x); if (gx !== null) this.loot.push(new Loot(gx, this.terrain.groundY(gx) - 12, rng.chance(0.3) ? 'crate' : rng.pick(r.loot))); }
    }
    // survivors on rooftops (never the first couple of buildings)
    const pool = normal.filter((b) => b.x > 650 && b.w > 90);
    const want = rng.int(r.survivors[0], r.survivors[1]);
    const taken = s.crew.map((c) => c.name);
    const regionIdx = BIOME_ORDER.indexOf(r.id);
    const missing = s.crew.filter((c) => s.missing[c.id] === r.id);
    const picks = [...pool].sort(() => rng.next() - 0.5).slice(0, want + missing.length);
    picks.forEach((b, i) => {
      const poiSurv = b.kind?.startsWith('poi:') && POI_INFO[b.kind.slice(4)].survivor;
      const m = i < missing.length ? missing[i] : makeSurvivor(rng, r.danger + (poiSurv ? 1 : 0) + (b.x > this.length * 0.7 ? 1 : 0), taken, r.name);
      taken.push(m.name);
      // clear the roof a little around them
      const sx = b.x + b.w * rng.range(0.3, 0.7);
      this.zombies = this.zombies.filter((z) => !(z.bld === b && Math.abs(z.x - sx) < 40));
      this.survivors.push({ x: sx, y: b.top, bld: b, m, state: 'wait', prog: 0, hp: 3, t: rng.range(0, 9), missing: i < missing.length, full: 0, line: rng.pick(RESCUE_LINES) });
    });
    // one rare trophy hidden far out
    const found = s.trophies;
    const cands = TROPHIES.filter((t) => t.region === regionIdx && !found.includes(t.id));
    if (cands.length && rng.chance(0.55)) {
      const far = normal.filter((b) => b.x > this.length * 0.55);
      if (far.length) { const b = rng.pick(far); const it = new Loot(b.x + b.w / 2, b.top - 14, 'trophy'); it.trophy = rng.pick(cands).id; this.loot.push(it); }
    }
  }
  private gapNear(x: number): number | null {
    for (let k = 0; k < 8; k++) { const gx = x + k * 30; if (!this.terrain.buildings.some((b) => gx > b.x - 14 && gx < b.x + b.w + 14)) return gx; }
    return null;
  }
  spawnGround(x: number, kind: ZKind) {
    x = clamp(x, 420, this.length - 60);
    const b = this.terrain.buildings.find((q) => x > q.x - 4 && x < q.x + q.w + 4);
    const z = b ? (this.isSafe(b) ? null : new Zombie(clamp(x, b.x + 6, b.x + b.w - 6), b.top, kind, b)) : new Zombie(x, this.terrain.groundY(x), kind, null);
    if (!z) return;
    if (this.terrain) this.toughen(z);
    this.zombies.push(z);
  }

  // ======================================================= queries
  altitude() { return this.terrain.surfaceY(this.ship.x) - this.ship.basketY; }
  updateReveal() {
    const sp = this.ship.stats.radar, look = this.ship.crewMul('lookout');
    this.reveal = this.ship.hasSpecial('hawkeye') || sp >= 2 ? 1e9 : 520 + sp * 700 + (look ? 400 + 150 * look : 0);
  }
  revealed(x: number) { return Math.abs(x - this.ship.x) < this.reveal; }

  pickTarget(range: number, pistol: boolean, exclude?: Zombie, side = 0, below = false): Zombie | null {
    const s = this.ship;
    if (!below) for (const h of s.hangers) { if (h.z === exclude || h.z.dead || h.z.kind === 'bloater') continue; const sl = s.g.slots[h.slot]; if (side === 1 && sl.x < 0) continue; if (side === -1 && sl.x > 0) continue; return h.z; }
    let best: Zombie | null = null, bd = 1e9;
    for (const z of this.zombies) {
      if (z.dead || z.attached || z === exclude || z.sleeping) continue;
      if (side === 1 && z.x < s.x - 20) continue; if (side === -1 && z.x > s.x + 20) continue;
      if (below && z.y < s.basketY) continue;
      const d = dist(z.x, z.y - z.h * 0.6, s.x, s.y);
      if (d > range) continue;
      let score = d;
      if (z.state === 'leap' || z.state === 'crouch') score -= 400;
      else if (z.kind === 'screamer' || z.kind === 'spitter') score -= 200;
      else if (z.sy > 0 || z.reaching) score -= 120;
      if (pistol && z.state !== 'leap' && z.state !== 'crouch' && !z.reaching && d > 160) continue;
      if (score < bd) { bd = score; best = z; }
    }
    return best;
  }

  shoot(x: number, y: number, z: Zombie, dmg: number, by?: CrewSlot) {
    const ty = z.attached ? z.y - z.h * 0.5 : z.y - z.sy - z.h * 0.6;
    this.tracers.push({ x1: x, y1: y, x2: z.x + rand(-3, 3), y2: ty + rand(-3, 3), t: 0.08 });
    this.fx.sparks(z.x, ty, 3, P.gold);
    const wasHanger = z.state === 'hang';
    z.hurt(this, dmg, z.attached ? 0 : (z.x - x) * 0.6, z.attached ? 0 : -60, 'gun');
    if (z.dead && by) { by.kills++; if (wasHanger) this.fx.popup(z.x, z.y - 20, 'GOT IT!', P.goldLight, 12); }
    Audio.tone(220 + Math.random() * 60, 0.04, { type: 'square', gain: 0.05, filter: 1800 });
  }

  // ======================================================= events
  onGrab(z: Zombie) {
    const n = this.ship.hangers.length;
    this.maxHangers = Math.max(this.maxHangers, n);
    this.showTip('grab');
    if (n === 3) this.banner('THEY\'RE ALL OVER US!', 'Shake! Climb! Burn \'em off!', P.redBright);
    if (z.kind === 'bloater') this.banner('BLOATER ON THE BASKET!', 'Shake it off before it bursts!', P.oliveLight);
    if (z.kind === 'brute') this.banner('A BRUTE GRABBED ON!', 'It\'s heavy — shake hard or fly high!', P.redBright);
  }
  onBoard(z: Zombie) { this.showTip('board'); this.fx.burst(this.ship.x, this.ship.y - 40, 'BOARDED!', 20, P.redBright); Audio.voice('yikes'); void z; }
  onShake(n: number) { this.shaken += n; }
  onZombieKilled(z: Zombie, src: string) {
    this.kills++;
    if (z.kind === 'screamer') this.fx.popup(z.x, z.y - 50, 'SILENCED!', P.goldLight, 14);
    if (src === 'fall') return;
    if (Math.random() < 0.08 + (z.kind === 'brute' ? 0.6 : 0)) { const it = new Loot(z.x, z.y - 20, z.kind === 'brute' ? 'parts' : pick(this.region.loot)); it.vy = -200; it.vx = rand(-60, 60); this.loot.push(it); }
  }
  bloaterPop(x: number, y: number, attached: boolean) {
    this.fx.explosion(x, y, 1.1, 'SPLOOSH!');
    for (let i = 0; i < 14; i++) this.fx.add({ kind: 'smoke', x: x + rand(-20, 20), y: y + rand(-20, 20), vx: rand(-60, 60), vy: rand(-60, 10), r: rand(8, 16), life: 1.4, max: 1.4, color: '#a8c860', drag: 2 });
    Audio.explosion(1);
    this.blast(x, y, 80, 3, false);
    if (attached || dist(x, y, this.ship.x, this.ship.basketY) < 70) { this.ship.hurtEnv(this, 2, 'burst'); this.ship.hitSomeone(this, 1, 'burst'); }
  }
  scream(z: Zombie) {
    Audio.voice('yikes'); Audio.zap();
    this.fx.burst(z.x, z.y - 60, 'SKREEEE!', 24, P.redBright);
    for (const o of this.zombies) if (Math.abs(o.x - z.x) < 700) { o.noticed = true; if (o.state === 'wander') o.state = 'chase'; }
    for (let i = 0; i < 4 + this.region.danger; i++) this.spawnGround(z.x + rand(-260, 260), 'swarmer');
    this.banner('A SCREAMER!', 'The horde is coming — kill screamers first', P.redBright);
  }
  spit(z: Zombie) {
    const [cx, cy] = this.ship.envCircle();
    const T = 1.1; const tx = cx + this.ship.vx * T * 0.5, ty = cy + this.ship.vy * T * 0.5;
    this.projs.push({ kind: 'acid', x: z.x + z.facing * 6, y: z.y - z.h, vx: (tx - z.x) / T, vy: (ty - (z.y - z.h)) / T - 0.5 * 500 * T, dead: false, t: 0 });
    Audio.puff();
  }
  throwRubble(z: Zombie) {
    const s = this.ship; const T = 0.95; const tx = s.x + s.vx * T * 0.6, ty = s.basketY - 30 + s.vy * T * 0.6;
    this.projs.push({ kind: 'rubble', x: z.x, y: z.y - z.h - 10, vx: (tx - z.x) / T, vy: (ty - (z.y - z.h)) / T - 0.5 * 700 * T, dead: false, t: 0 });
    Audio.thump();
  }
  onCrash(why: string) {
    this.state = 'crashed'; this.endT = 0; this.crashWhy = why;
    this.banner(why === 'fuel' ? 'OUT OF FUEL!' : 'BALLOON DOWN!', why === 'envelope' ? 'The envelope gave out…' : why === 'fuel' ? 'Stranded on the ground…' : 'Jerry was overrun…', P.redBright);
  }
  banner(text: string, sub?: string, color?: string) { if (this.banners.length < 4) this.banners.push({ text, sub, color, t: 2.6 }); }
  showTip(id: string) {
    if (!this.tutorial || this.tipsShown.has(id)) return;
    this.tipsShown.add(id); this.tip = { tip: TIPS[id], t: 0 };
  }

  // ======================================================= actions
  drop(w: Weapon, x: number, y: number, vx: number, vy: number) { this.ord.push(new Ordnance(w, x, y, vx, vy)); }
  /** Damage + knockback in a radius. */
  blast(x: number, y: number, r: number, dmg: number, hurtShip = true) {
    for (const z of this.zombies) {
      if (z.dead) continue;
      const d = dist(x, y, z.x, z.y - z.sy - z.h * 0.5);
      if (d > r) continue;
      const k = 1 - d / r;
      if (z.attached) { z.hurt(this, dmg, 0, 0, 'bomb'); continue; }
      z.hurt(this, d < r * 0.5 ? dmg : Math.max(1, dmg - 1), (z.x - x) * 4 + rand(-40, 40), -220 - 260 * k, 'bomb');
    }
    for (const it of this.loot) if (!it.hooked && dist(x, y, it.x, it.y) < r) { it.vy = -rand(160, 240); it.vx = (it.x - x) * 2; }
    for (const s of this.survivors) if (s.state === 'wait' && dist(x, y, s.x, s.y) < r * 0.7) { s.hp -= 1; this.fx.popup(s.x, s.y - 40, 'HEY! WATCH IT!', P.parchment, 13); }
    if (hurtShip && dist(x, y, this.ship.x, this.ship.basketY) < r * 0.6) { this.ship.swingV += 5; this.ship.wobble = 1; this.fx.popup(this.ship.x, this.ship.y - 60, 'WHOA!', P.parchment, 14); }
  }
  explode(x: number, y: number, scale = 1) {
    const r = 64 * scale * this.ship.stats.blastMul;
    this.fx.explosion(x, y, 0.85 * scale, pick(['KA-BOOM!', 'BOOM!', 'WHAM!', 'BLAM!', 'KRAK!']));
    this.fx.groundRing(x, Math.min(y, this.terrain.surfaceY(x)), r);
    Audio.explosion(scale);
    buzz(25);
    this.blast(x, y, r, 2);
  }
  flameTick(dt: number) {
    const s = this.ship;
    for (const h of [...s.hangers]) { h.z.burn = 3; h.z.die(this, rand(-120, 120), -80, 'fire'); }
    if (Math.random() < dt * 4) for (const b of [...s.boarders]) b.z.hurt(this, 1, 0, 0, 'fire');
    for (const z of this.zombies) {
      if (z.dead || z.attached) continue;
      const dy = z.y - s.basketY; const reach = s.stats.flamer >= 2 ? 200 : 160;
      if (dy > -10 && dy < reach && Math.abs(z.x - s.x) < 40 + dy * 0.45) z.burn = 4;
    }
    if (Math.random() < 0.6) this.fx.add({ kind: 'flame', x: s.x + rand(-20, 20), y: s.basketY + rand(20, 90), vx: rand(-40, 40), vy: 120, r: 10, life: 0.4, max: 0.4 });
  }
  collect(it: Loot) {
    it.dead = true;
    const s = this.ship;
    const scav = s.crewMul('scavenger');
    const mul = 1 + (scav ? 0.2 + 0.12 * (scav - 1) : 0);
    const add = (k: ResKey, n: number) => { let v = Math.max(1, Math.round(n * mul)); if (k === 'tech' && s.hasSpecial('magpie')) v *= 2; this.cargo[k] += v; return v; };
    let text = '';
    switch (it.kind) {
      case 'crate': { const a = pick(this.region.loot), b = pick(this.region.loot); add(a, BASE_AMT[a] + 1); add(b, BASE_AMT[b] + 1); text = 'CRATE!'; break; }
      case 'cache': { for (let i = 0; i < 4; i++) { const k = pick(this.region.loot); add(k, BASE_AMT[k] + 1); } text = 'SUPPLY CACHE!'; this.fx.confetti(s.x, s.y, 20); Audio.voice('woo'); break; }
      case 'trophy': { if (it.trophy) { this.trophies.push(it.trophy); text = 'RARE FIND: ' + trophyById(it.trophy)!.name.toUpperCase() + '!'; this.fx.confetti(s.x, s.y, 30); this.banner('RARE FIND!', trophyById(it.trophy)!.name + ' — get it home safe!', P.goldLight); Audio.objective(); } break; }
      default: {
        const k = it.kind as ResKey; const n = add(k, BASE_AMT[k]);
        text = `+${n} ${k.toUpperCase()}`;
        if (k === 'fuel') { s.fuel = Math.min(s.maxFuel, s.fuel + 30); text = '+FUEL'; }
        if (k === 'meds' && s.hp < s.maxHp) { s.hp++; text = '+1 HEALTH'; }
      }
    }
    this.fx.popup(s.x, s.y - 110, text, P.goldLight, 16);
    Audio.pickup(it.kind as string); s.setExpr('happy', 1);
    this.showTip('home');
  }

  // ======================================================= update
  update(c: Controls, dt: number) {
    if (this.fx.hitstop > 0) { this.fx.hitstop -= dt; this.fx.hitstopCool = Math.max(this.fx.hitstopCool, 0.2); return; }
    this.time += dt;
    const s = this.ship;
    const ctrl = this.state === 'play' ? c : { x: 0, y: this.state === 'home' ? 0.6 : 0, drop: false, hook: false, shake: false, flame: false, boost: false, cycle: false };
    s.update(this, ctrl, dt);
    if (this.state === 'home') { const top = this.haven.top; if (s.basketY > top - 2) { s.y = top - s.g.bottom * S; s.vy = 0; } s.vx *= 0.9; }
    if (s.x > 900) this.outbound = true;
    this.distMax = Math.max(this.distMax, s.x);
    if (this.time > 1.5) this.showTip('fly');
    // zombies
    const cx = this.camX + this.viewW / 2;
    let active = 0;
    for (const z of this.zombies) {
      z.sleeping = !z.attached && Math.abs(z.x - cx) > 1300;
      if (z.sleeping) continue;
      active++;
      z.update(this, dt);
    }
    this.stackPass(dt);
    this.zombies = this.zombies.filter((z) => !(z.dead && z.deadT > 2.6));
    // keep the pressure on: fresh groups shamble in from off-screen
    this.spawnT -= dt * this.aggro;
    if (this.spawnT <= 0 && s.launched && this.state === 'play') {
      this.spawnT = rand(5, 9) - this.region.danger * 0.4;
      if (active < this.cap && s.x > 700) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = side < 0 ? this.camX - 120 : this.camX + this.viewW + 120;
        const n = rand(2, 3 + this.region.danger);
        for (let i = 0; i < n; i++) this.spawnGround(x + rand(-40, 40), this.pickKind());
      }
    }
    this.rangedCd -= dt;
    for (const it of this.loot) it.update(this, dt);
    this.loot = this.loot.filter((i) => !i.dead);
    this.updateOrdnance(dt);
    this.updateProjs(dt);
    for (const f of this.fires) {
      f.t -= dt;
      for (const z of this.zombies) if (!z.dead && !z.attached && !z.airborne && Math.abs(z.x - f.x) < f.w / 2 && Math.abs(z.y - f.y) < 12) z.burn = Math.max(z.burn, 2.5);
      if (Math.random() < 0.5) this.fx.add({ kind: 'flame', x: f.x + rand(-f.w / 2, f.w / 2), y: f.y - 2, vx: 0, vy: -60, r: 7, life: 0.5, max: 0.5 });
    }
    this.fires = this.fires.filter((f) => f.t > 0);
    for (const t of this.tracers) t.t -= dt;
    this.tracers = this.tracers.filter((t) => t.t > 0);
    this.updateSurvivors(dt);
    this.updateStations(dt);
    this.fx.update(dt);
    this.updateCamera(dt);
    for (const b of this.banners) b.t -= dt;
    if (this.banners.length && this.banners[0].t <= 0) this.banners.shift();
    if (this.tip) { this.tip.t += dt; if (this.tip.t > 7) this.tip = null; }
    if (this.altitude() < 90 && this.time > 6) this.showTip('low');
    if (this.zombies.some((z) => !z.dead && !z.attached && Math.abs(z.x - s.x) < 160 && z.y > s.basketY) && this.time > 25) this.showTip('bomb');
    if (Math.floor(this.time) % 2 === 0) this.updateReveal();
    Audio.wind(Math.abs(s.vx) / 300 + (s.boosting > 0 ? 0.4 : 0) + clamp(-this.altitude() / -400, 0, 0.3));
    if (this.state !== 'play') this.endT += dt;
  }

  /** Zombie pyramids: when the balloon hovers low, the dead climb on each other to reach it. */
  private stackPass(dt: number) {
    const s = this.ship;
    const groups = new Map<number, Zombie[]>();
    for (const z of this.zombies) {
      if (z.dead || z.attached || z.sleeping) continue;
      const alt = z.y - s.basketY;
      const adx = Math.abs(z.x - s.x);
      z.reaching = z.state === 'chase' && adx < 120 && alt > 0 && alt < 210;
      const can = z.state === 'chase' && z.stun <= 0 && !z.airborne && z.kind !== 'brute' && z.kind !== 'spitter' && z.kind !== 'bloater' && adx < 34 && alt > 30 && alt < 200;
      if (!can) { z.sy = damp(z.sy, 0, 8, dt); continue; }
      const key = z.bld ? z.bld.id : -1;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(z);
    }
    for (const list of groups.values()) {
      if (list.length < 2) { for (const z of list) z.sy = damp(z.sy, 0, 8, dt); continue; }
      list.sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x));
      list.forEach((z, i) => {
        const lvl = Math.min(i, z.kind === 'swarmer' ? 6 : 4);
        z.sy = damp(z.sy, lvl * (z.kind === 'swarmer' ? 15 : 21), 5, dt);
        if (lvl > 0) z.x = damp(z.x, list[0].x + (i % 2 ? 4 : -4), 6, dt);
      });
    }
  }

  private updateOrdnance(dt: number) {
    for (const o of this.ord) {
      o.t += dt;
      if (o.stuck) {
        o.armed += dt;
        if (o.armed > 0.6 && this.zombies.some((z) => !z.dead && !z.attached && Math.abs(z.x - o.x) < 34 && Math.abs(z.y - z.sy - o.y) < 40)) { o.dead = true; this.explode(o.x, o.y - 8, 1.35); }
        if (o.armed > 40) o.dead = true;
        continue;
      }
      o.vy += 700 * dt; o.vx *= Math.exp(-0.6 * dt); o.x += o.vx * dt; o.y += o.vy * dt;
      // direct hits on zombies in mid-air or on stacks
      const sy = this.terrain.surfaceY(o.x);
      const hitZ = this.zombies.find((z) => !z.dead && !z.attached && Math.abs(z.x - o.x) < 10 && o.y > z.y - z.sy - z.h && o.y < z.y);
      if (o.y >= sy - 2 || hitZ) {
        if (o.kind === 'mine') { o.stuck = true; o.y = sy - 4; Audio.clank(); continue; }
        o.dead = true;
        if (o.kind === 'fire') {
          this.fires.push({ x: o.x, y: sy, w: this.ship.stats.fireCap >= 4 ? 140 : 110, t: this.ship.stats.fireCap >= 4 ? 6.5 : 5, max: 6 });
          this.fx.explosion(o.x, sy - 8, 0.6, 'FWOOSH!'); Audio.explosion(0.6); Audio.sizzle();
          this.blast(o.x, sy - 8, 40, 1, false);
        } else this.explode(o.x, Math.min(o.y, sy - 4), o.kind === 'bomblet' ? 0.6 : 1);
      }
    }
    this.ord = this.ord.filter((o) => !o.dead);
  }

  private updateProjs(dt: number) {
    const s = this.ship;
    for (const p of this.projs) {
      p.t += dt; p.vy += (p.kind === 'acid' ? 500 : 700) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'acid' && Math.random() < 0.5) this.fx.add({ kind: 'drop', x: p.x, y: p.y, vx: 0, vy: 30, r: 2, life: 0.3, max: 0.3, color: '#9ad040' });
      if (!s.dead && s.hitsEnvelope(p.x, p.y, 4)) { p.dead = true; s.hurtEnv(this, p.kind === 'acid' ? 0.75 : 1, p.kind); this.fx.sparks(p.x, p.y, 8, p.kind === 'acid' ? '#9ad040' : P.rust); continue; }
      if (!s.dead && s.touchesHull(p.x, p.y, 2)) { p.dead = true; if (p.kind === 'rubble') { s.swingV += 4; const plate = [0.3, 0.15, 0.06][s.stats.plating]; if (Math.random() < plate) s.hitSomeone(this, 1, 'rubble'); else { s.hurtEnv(this, 0.5, 'rubble'); this.fx.popup(p.x, p.y - 10, 'CLONK!', P.steelLight, 13); } } else if (Math.random() < 0.3) s.hitSomeone(this, 1, 'acid'); this.fx.dust(p.x, p.y, 3); Audio.clank(); continue; }
      if (p.y > this.terrain.surfaceY(p.x) || p.t > 4) p.dead = true;
    }
    this.projs = this.projs.filter((p) => !p.dead);
  }

  private updateSurvivors(dt: number) {
    const s = this.ship;
    this.fullNagT -= dt;
    for (const v of this.survivors) {
      v.t += dt;
      if (v.state === 'aboard' || v.state === 'lost') continue;
      if (Math.abs(v.x - s.x) < 500) this.showTip('survivor');
      // the dead on the same roof go for them
      const biter = this.zombies.find((z) => !z.dead && !z.attached && z.bld === v.bld && Math.abs(z.x - v.x) < 14);
      if (biter && !v.missing) { v.hp -= dt * 0.55; if (Math.random() < dt * 3) this.fx.popup(v.x, v.y - 40, 'HELP!!', P.redBright, 13); }
      if (v.hp <= 0) {
        v.state = 'lost';
        const z = new Zombie(v.x, v.y, 'walker', v.bld); z.noticed = true; z.state = 'chase'; this.zombies.push(z);
        this.banner('OH NO!', `${v.m.name} got bitten…`, P.redBright); Audio.sadTrombone();
        continue;
      }
      const alt = v.y - s.basketY;
      const lad = s.stats.ladder;
      const range = 80 + 50 * lad, wide = 46 + 12 * lad;
      const inRange = !s.dead && this.state === 'play' && alt > -10 && alt < range && Math.abs(s.x - v.x) < wide && Math.abs(s.vx) < 140;
      if (inRange) {
        if (s.seatsFree() <= 0) { if (this.fullNagT <= 0) { this.fullNagT = 2.5; this.fx.popup(v.x, v.y - 60, 'NO ROOM! (Upgrade the basket)', P.redBright, 14); Audio.deny(); } v.full = 1; continue; }
        v.state = 'climb';
        s.ladderTarget = Math.max(10, alt);
        v.prog += dt * (0.75 + 0.4 * lad);
        if (v.prog >= 1) {
          v.state = 'aboard';
          const slot = new CrewSlot(v.m, 0, true);
          s.crew.push(slot);
          if (v.missing) delete Save.data.missing[v.m.id];
          else this.rescued.push(v.m);
          this.fx.confetti(s.x, s.y, 24); Audio.objective(); Audio.voice('yay');
          this.banner(v.missing ? 'WELCOME BACK!' : 'RESCUED!', `${v.m.name} — ${v.m.role.toUpperCase()}${v.m.rarity !== 'common' ? ' (' + v.m.rarity.toUpperCase() + ')' : ''}`, P.goldLight);
          slot.setPose('cheer', 2); s.setExpr('cheer', 1.5);
          for (const c of s.crew) if (c.up && c !== slot) c.setPose('cheer', 1);
        }
      } else { if (v.state === 'climb') v.state = 'wait'; v.prog = Math.max(0, v.prog - dt * 0.35); v.full = 0; }
    }
  }

  private updateStations(dt: number) {
    const s = this.ship;
    if (this.state !== 'play' || s.dead || !s.launched) return;
    const near = (b: Building, wx = 80, up = 40) => Math.abs(s.x - (b.x + b.w / 2)) < wx && s.basketY > b.top - up && Math.abs(s.vy) < 140;
    // outpost: bank cargo, refuel once, patch up
    if (near(this.outpost, 85, 70)) {
      this.outpostT += dt;
      if (this.outpostT > 1 && this.outpostT - dt <= 1) {
        let banked = 0;
        for (const k of RES_KEYS) { banked += this.cargo[k]; this.banked[k] += this.cargo[k]; this.cargo[k] = 0; }
        const newbies = s.crew.filter((c) => c.isNew);
        this.bankedRescued.push(...newbies.map((c) => c.m)); this.rescued = this.rescued.filter((m) => !newbies.some((c) => c.m === m));
        s.crew = s.crew.filter((c) => !c.isNew);
        this.bankedTrophies.push(...this.trophies); this.trophies = [];
        let sub = banked ? `Banked ${banked} supplies` : 'Nothing to bank';
        if (this.beaconLit && !this.beaconBanked) { this.commitBeacon(); sub += ' · beacon locked in!'; }
        if (newbies.length) sub += ` · ${newbies.length} survivor${newbies.length > 1 ? 's' : ''} safe`;
        if (!this.refueled) { this.refueled = true; s.fuel = s.maxFuel; s.env = Math.min(s.maxEnv, s.env + s.maxEnv * 0.4); s.hp = Math.min(s.maxHp, s.hp + 1); for (const c of s.crew) { c.ko = false; c.hp = Math.max(c.hp, Math.ceil(c.max / 2)); } sub += ' · refuelled & patched'; }
        this.banner('OUTPOST', sub, P.tealLight); Audio.buy();
      }
    } else this.outpostT = 0;
    // beacon: light the radio mast to open the next region
    if (!this.beaconLit) {
      const mx = this.beacon.x + this.beacon.w / 2, my = this.beacon.top - 90;
      if (Math.abs(s.x - mx) < 120 && s.basketY > my - 190 && s.basketY < my + 50) {
        this.beaconT += dt;
        if (this.beaconT > 1.5) {
          this.beaconLit = true;
          this.fx.confetti(mx, my, 50); Audio.fanfare();
          this.banner('BEACON LIT!', this.beaconWasLit ? 'Still shining — now get home!' : 'Get it home (or to the outpost) to lock it in!', P.goldLight);
          this.loot.push(Object.assign(new Loot(mx, my - 20, 'cache'), { vy: -100 }));
        }
      } else this.beaconT = Math.max(0, this.beaconT - dt);
    }
    // home sweet home
    if (this.outbound && near(this.haven, 100, 90)) {
      this.homeT += dt;
      if (this.homeT > 0.6) { this.state = 'home'; this.endT = 0; Audio.fanfare(); Audio.voice('woo'); s.setExpr('cheer', 99); s.setArm('cheer', 99); this.fx.confetti(s.x, s.y - 40, 60); }
    } else this.homeT = 0;
  }

  private updateCamera(dt: number) {
    const s = this.ship;
    const look = clamp(s.vx * 0.5, -160, 160);
    const tx = clamp(s.x - this.viewW * 0.45 + look, 0, this.length - this.viewW);
    this.camX = damp(this.camX, tx, 4, dt);
    const ty = clamp(Math.min(0, s.y - 250), CEILING - 290, 0);
    this.camY = damp(this.camY, ty, ty < this.camY ? 6 : 3, dt);
  }

  // ======================================================= render
  drawWorld(ctx: CanvasRenderingContext2D) {
    const x0 = this.camX - 120, x1 = this.camX + this.viewW + 120;
    this.fx.draw(ctx, 'back');
    this.terrain.drawBuildings(ctx, x0, x1);
    for (const p of this.pois) if (p.x + p.w > x0 && p.x < x1) this.drawSign(ctx, p);
    this.drawHaven(ctx, this.haven, true);
    this.drawHaven(ctx, this.outpost, false);
    this.drawBeacon(ctx);
    this.terrain.drawGround(ctx, x0, x1);
    for (const f of this.fires) { ctx.fillStyle = `rgba(255,120,40,${0.25 * clamp(f.t, 0, 1)})`; ctx.beginPath(); ctx.ellipse(f.x, f.y - 4, f.w / 2, 10, 0, 0, 7); ctx.fill(); }
    for (const it of this.loot) if (!it.hooked && it.x > x0 && it.x < x1) { ctx.save(); ctx.translate(it.x, it.y); drawResIcon(ctx, it.kind, it.r, it.t); ctx.restore(); }
    for (const o of this.ord) this.drawOrd(ctx, o);
    for (const v of this.survivors) if (v.state !== 'aboard' && v.state !== 'lost' && v.x > x0 && v.x < x1) this.drawSurvivor(ctx, v);
    for (const z of this.zombies) if (!z.sleeping && z.x > x0 && z.x < x1) z.draw(ctx, this);
    this.ship.draw(ctx, this);
    for (const p of this.projs) {
      if (p.kind === 'acid') { pen.use(ctx, 0.4).begin().ell(p.x, p.y, 5, 4).ink('#9ad040', 1.5); }
      else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 8); pen.use(ctx, 0.4).begin().poly([[-6, -4], [5, -6], [7, 4], [-5, 6]]).ink(P.steelDark, 2); ctx.restore(); }
    }
    ctx.lineCap = 'round';
    for (const t of this.tracers) { ctx.strokeStyle = `rgba(255,230,140,${t.t / 0.08})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke(); }
    this.fx.draw(ctx, 'front');
    this.fx.drawText(ctx);
  }
  private drawOrd(ctx: CanvasRenderingContext2D, o: Ordnance) {
    pen.use(ctx, 0.4);
    ctx.save(); ctx.translate(o.x, o.y);
    if (o.kind === 'fire') { ctx.rotate(o.t * 6); pen.begin().rrect(-3, -7, 6, 12, 2).ink('#7aa868', 1.6); pen.begin().m(0, -7).l(0, -12).stroke(2, P.parchment); pen.begin().ell(0, -13, 2.5, 3).fill(P.flame2); }
    else if (o.kind === 'mine') { pen.begin().ell(0, 0, 7, 4).ink(P.steelDark, 1.6); ctx.fillStyle = o.stuck && Math.floor(o.armed * 4) % 2 === 0 ? P.hot : P.redDark; ctx.beginPath(); ctx.arc(0, -3, 2, 0, 7); ctx.fill(); }
    else { const r = o.kind === 'bomblet' ? 4 : 6; pen.begin().ell(0, 0, r, r).ink(P.ink, 1.5); pen.begin().m(r * 0.6, -r * 0.7).q(r, -r * 1.6, r * 1.6, -r * 1.3).stroke(1.6, P.brownLight); ctx.fillStyle = Math.random() < 0.5 ? P.gold : P.flame2; ctx.beginPath(); ctx.arc(r * 1.6, -r * 1.3, 1.8, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  private drawSurvivor(ctx: CanvasRenderingContext2D, v: Survivor) {
    ctx.save(); ctx.translate(v.x, v.y + 2);
    ctx.scale(0.8, 0.8);
    const pose = v.state === 'climb' ? 'cheer' : 'cheer';
    drawCharacterMini(ctx, v.m.look, v.m.role, v.t, v.hp < 2 ? 'fight' : pose, Math.sin(v.t) > 0 ? 1 : -1);
    ctx.restore();
    if (v.state === 'wait' && Math.sin(v.t * 2.3) > 0.2) {
      inkText(ctx, v.missing ? v.m.name.split(' ')[0].toUpperCase() + '!' : 'HELP!', v.x, v.y - 44 - Math.abs(Math.sin(v.t * 4)) * 3, 13, P.parchment, { outline: 3 });
    }
    if (v.m.rarity !== 'common') { ctx.fillStyle = v.m.rarity === 'legendary' ? 'rgba(255,216,119,0.35)' : 'rgba(159,243,255,0.3)'; ctx.beginPath(); ctx.arc(v.x, v.y - 18, 24 + Math.sin(v.t * 4) * 3, 0, 7); ctx.fill(); }
    if (v.state === 'climb') { ctx.fillStyle = 'rgba(42,26,20,0.7)'; ctx.fillRect(v.x - 20, v.y + 6, 40, 6); ctx.fillStyle = P.goldLight; ctx.fillRect(v.x - 19, v.y + 7, 38 * v.prog, 4); }
    // SOS flag on the roof
    pen.use(ctx, 0.4).begin().m(v.x - 22, v.y).l(v.x - 22, v.y - 36).stroke(2);
    pen.begin().m(v.x - 22, v.y - 36).l(v.x - 4, v.y - 32 + Math.sin(v.t * 5) * 2).l(v.x - 22, v.y - 26).close().ink(P.redBright, 1.5);
  }
  private drawSign(ctx: CanvasRenderingContext2D, p: POI) {
    const b = p.bld; const cx = b.x + b.w / 2, y = b.top - 34;
    pen.use(ctx, 0.3);
    pen.begin().m(cx - 30, b.top).l(cx - 30, y + 10).m(cx + 30, b.top).l(cx + 30, y + 10).stroke(2.5);
    ctx.font = '14px "Luckiest Guy", Impact'; const w = ctx.measureText(p.name).width + 18;
    pen.begin().rrect(cx - w / 2, y - 10, w, 22, 4).ink(p.kind === 'hospital' || p.kind === 'clinic' ? P.white : p.kind === 'gas' || p.kind === 'depot' ? P.red : P.parchment, 2.4);
    ctx.fillStyle = p.kind === 'gas' || p.kind === 'depot' ? P.parchment : P.redDark; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.name, cx, y + 2);
  }
  private drawHaven(ctx: CanvasRenderingContext2D, b: Building, home: boolean) {
    if (b.x > this.camX + this.viewW + 200 || b.x + b.w < this.camX - 200) return;
    const cx = b.x + b.w / 2, top = b.top;
    pen.use(ctx, 0.4);
    // sandbags & fence
    for (let x = b.x + 4; x < b.x + b.w - 4; x += 16) pen.begin().rrect(x, top - 9, 15, 9, 4).ink(P.parchmentShade, 1.6);
    pen.begin().rect(b.x - 4, top - 2, b.w + 8, 6).ink(P.brown, 2);
    // landing pad stripes
    for (let k = -2; k <= 2; k++) { ctx.fillStyle = k % 2 ? P.gold : P.ink; ctx.fillRect(cx + k * 14 - 7, top - 12, 14, 3); }
    for (const fx of [b.x + 6, b.x + b.w - 6]) {
      pen.begin().m(fx, top - 8).l(fx, top - 70).stroke(3);
      const wave = Math.sin(this.time * 6 + fx) * 4;
      pen.begin().m(fx, top - 70).q(fx + 14, top - 68 + wave, fx + 28, top - 64).l(fx + 26, top - 50 + wave).q(fx + 12, top - 54, fx, top - 52).close().ink(home ? P.teal : P.gold, 2);
    }
    ctx.save(); ctx.translate(cx, top + 26);
    pen.begin().rect(-50, -12, 100, 24).ink(P.parchment, 2.4);
    inkText(ctx, home ? 'HAVEN' : 'OUTPOST', 0, 1, 15, P.redDark, { outline: 0, shadow: false });
    ctx.restore();
    // residents waving
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.translate(b.x + 20 + i * 22 + (i > 1 ? 100 : 0), top - 8); ctx.scale(0.65, 0.65);
      drawCharacterMini(ctx, { skin: [P.skin, '#c8906a', '#8a5a3a'][i], coat: [P.olive, P.purple, P.red][i], hair: [P.ink, P.gold, '#dfe0e0'][i], hat: (['cap', 'none', 'beanie'] as const)[i] }, 'cook', this.time + i, 'cheer', i % 2 ? -1 : 1);
      ctx.restore();
    }
    if (home && this.outbound && this.state === 'play') {
      const fy = top - 130 - Math.sin(this.time * 2) * 20;
      ctx.fillStyle = 'rgba(255,90,60,0.25)'; ctx.beginPath(); ctx.arc(cx, fy, 26 + Math.sin(this.time * 20) * 4, 0, 7); ctx.fill();
      ctx.fillStyle = P.hot; ctx.beginPath(); ctx.arc(cx, fy, 7, 0, 7); ctx.fill();
    }
    if (!home && this.outpostT > 0 && this.outpostT < 1) { ctx.fillStyle = 'rgba(42,26,20,0.7)'; ctx.fillRect(cx - 30, top - 80, 60, 7); ctx.fillStyle = P.tealLight; ctx.fillRect(cx - 29, top - 79, 58 * this.outpostT, 5); }
  }
  private drawBeacon(ctx: CanvasRenderingContext2D) {
    const b = this.beacon; if (b.x > this.camX + this.viewW + 300 || b.x + b.w < this.camX - 300) return;
    const cx = b.x + b.w / 2, top = b.top;
    pen.use(ctx, 0.3);
    // lattice radio mast
    pen.begin().m(cx - 22, top).l(cx, top - 100).l(cx + 22, top).stroke(3, P.redDark);
    for (let k = 0; k < 5; k++) { const y = top - k * 20, w = 22 * (1 - k / 5); pen.begin().m(cx - w, y).l(cx + w * 0.8, y - 20).stroke(1.5, P.redDark); }
    const lit = this.beaconLit || this.beaconWasLit;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
    if (lit) { ctx.fillStyle = `rgba(255,216,119,${0.25 + pulse * 0.25})`; ctx.beginPath(); ctx.arc(cx, top - 100, 40 + pulse * 10, 0, 7); ctx.fill(); }
    pen.begin().ell(cx, top - 102, 7, 7).ink(lit ? P.goldLight : P.steelDark, 2);
    if (!lit) {
      inkText(ctx, 'BEACON', cx, top - 130, 16, P.goldLight, { outline: 3 });
      if (this.beaconT > 0) { ctx.fillStyle = 'rgba(42,26,20,0.7)'; ctx.fillRect(cx - 30, top - 150, 60, 7); ctx.fillStyle = P.goldLight; ctx.fillRect(cx - 29, top - 149, 58 * this.beaconT / 1.5, 5); }
    }
  }

  /** Off-screen markers for the HUD. */
  pointers(): { x: number; y: number; color: string; label: string }[] {
    const out: { x: number; y: number; color: string; label: string }[] = [];
    const add = (x: number, y: number, color: string, label: string) => { if (x < this.camX || x > this.camX + this.viewW || y < this.camY || y > this.camY + this.viewH) out.push({ x, y, color, label }); };
    for (const v of this.survivors) if ((v.state === 'wait' || v.state === 'climb') && this.revealed(v.x)) add(v.x, v.y - 20, P.goldLight, 'SOS');
    if (this.outbound) add(this.haven.x + this.haven.w / 2, this.haven.top - 30, P.tealLight, 'HOME');
    if (!this.beaconLit && !this.beaconWasLit && this.revealed(this.beacon.x)) add(this.beacon.x + this.beacon.w / 2, this.beacon.top - 100, P.gold, '★');
    return out;
  }
}

// ======================================================= settle results into the save
export interface Report {
  region: BiomeId; success: boolean; why: string;
  gains: Record<ResKey, number>; rescued: CrewMember[]; trophies: string[];
  xp: { m: CrewMember; gained: number; leveled: boolean }[]; lost: CrewMember[]; injured: CrewMember[];
  kills: number; maxHangers: number; beacon: boolean; firstBeacon: boolean; beaconLost: boolean; foodUsed: number; dist: number;
}
export function settle(e: Expedition): Report {
  const s = Save.data;
  const success = e.state === 'home';
  const gains = { scrap: 0, fabric: 0, parts: 0, tech: 0, fuel: 0, food: 0, meds: 0 } as Record<ResKey, number>;
  const bonus = s.difficulty === 'hard' ? 1.25 : 1;
  for (const k of RES_KEYS) { gains[k] = Math.round((e.banked[k] + (success ? e.cargo[k] : Math.floor(e.cargo[k] * 0.3))) * bonus); s.res[k] += gains[k]; }
  const rescued = [...e.bankedRescued, ...(success ? e.rescued : [])];
  const trophies = [...e.bankedTrophies, ...(success ? e.trophies : [])];
  for (const t of trophies) if (!s.trophies.includes(t)) s.trophies.push(t);
  const lost: CrewMember[] = [], injured: CrewMember[] = [];
  // the ones rescued this trip but lost in the crash scatter back into the region
  if (!success) for (const m of e.rescued) { s.crew.push(m); s.missing[m.id] = e.region.id; lost.push(m); }
  const seats = computeStats(s.levels).seats;
  for (const m of rescued) {
    if (!s.crew.some((c) => c.id === m.id)) s.crew.push(m);
    s.stats.rescued++;
    // new faces hop straight aboard if there's a free seat
    if (!s.aboard.includes(m.id) && s.aboard.length < seats) s.aboard.push(m.id);
  }
  // crew XP and consequences
  const comfort = 1 + Math.min(0.6, Save.comfort() * 0.06);
  const cookMul = e.ship.crew.some((c) => c.m.role === 'cook') ? 1.15 : 1;
  const xp: Report['xp'] = [];
  for (const c of e.ship.crew) {
    const m = c.m; const before = m.level;
    if (!s.crew.some((q) => q.id === m.id)) continue;
    const gained = Math.round((10 + (success ? 10 : 0) + c.kills * 2 + rescued.length * 3) * comfort * cookMul);
    m.xp += gained; m.level = levelFor(m.xp); m.trips++; m.kills += c.kills;
    xp.push({ m, gained, leveled: m.level > before });
    if (!success && !s.missing[m.id] && !c.isNew) {
      const medic = e.ship.crew.some((q) => q.m.role === 'medic' && q !== c);
      if (Math.random() < (medic ? 0.25 : 0.45)) { s.missing[m.id] = e.region.id; lost.push(m); }
      else { m.injured = 2; injured.push(m); }
    } else if (c.ko) { m.injured = Math.max(m.injured, 1); injured.push(m); }
  }
  // crew that stayed home rest up
  for (const m of s.crew) if (!e.ship.crew.some((c) => c.m === m) && m.injured > 0) m.injured--;
  s.aboard = s.aboard.filter((id) => !s.missing[id]);
  if (success && e.beaconLit) e.commitBeacon();
  const rec = s.regions[e.region.id] ?? { beacon: false, runs: 0, best: 0 };
  rec.runs++; rec.best = Math.max(rec.best, Math.round(e.distMax)); s.regions[e.region.id] = rec;
  s.stats.expeditions++; s.stats.zombies += e.kills; s.stats.shaken += e.shaken; s.stats.maxHangers = Math.max(s.stats.maxHangers, e.maxHangers);
  if (!success) s.stats.crashes++;
  if (success) s.seenTutorial = true;
  Save.write();
  return { region: e.region.id, success, why: e.crashWhy, gains, rescued, trophies, xp, lost, injured, kills: e.kills, maxHangers: e.maxHangers, beacon: e.beaconBanked, firstBeacon: e.beaconBanked && !e.beaconWasLit, beaconLost: e.beaconLit && !e.beaconBanked && !e.beaconWasLit, foodUsed: e.foodUsed, dist: e.distMax };
}
void bodyText;
