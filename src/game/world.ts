import { P } from '../render/palette';
import { pen, inkText } from '../render/ink';
import { clamp, dist, rand, pick, RNG, damp } from '../core/math';
import { Audio } from '../core/audio';
import { Terrain, GROUND, CEILING } from './level';
import { Player, type Controls } from './player';
import { Item, PowerUp, Target, Enemy, Projectile, Bomb, PowerLine, Smokestack, Gust, Storm, Eruption, POWER_INFO, ITEM_INFO } from './entities';
import { biome as getBiome, CAMP_NAMES, type Biome } from './biomes';
import { BOSSES } from './boss';
import { Boss } from './boss';
import { FX } from './fx';
import type { MissionSpec, ObjectiveSpec, ItemKind, PowerKind, EnemyKind, TargetKind, EntSpec } from './types';
import type { Stats, ResKey } from './upgrades';

export interface ObjState { spec: ObjectiveSpec; progress: number; done: boolean; failed: boolean; }
export interface Hint { x: number; text: string; touchText?: string; kind: string; shown: boolean; done: boolean; t: number; doneT: number; }

export class World {
  spec: MissionSpec;
  terrain: Terrain; length: number;
  player: Player;
  items: Item[] = []; powerups: PowerUp[] = []; targets: Target[] = []; enemies: Enemy[] = [];
  projectiles: Projectile[] = []; bombs: Bomb[] = []; lines: PowerLine[] = []; stacks: Smokestack[] = []; gusts: Gust[] = [];
  boss: Boss | null = null;
  storms: Storm[] = [];
  eruptions: Eruption[] = [];
  biome: Biome;
  stormLevel = 1;
  /** enemy fire-rate multiplier from the difficulty setting */
  aggro = 1;
  exitX: number;
  fx = new FX();
  camX = 0; camY = 0; viewW = 960; viewH = 540;
  time = 0;
  wind: number;
  collected: Record<ResKey, number> = { fuel: 0, scrap: 0, fabric: 0, food: 0, water: 0, electronics: 0 };
  rescued = 0; destroyed: Record<string, number> = {}; retrieved: Record<string, number> = {}; postcard = false; bossDown = false;
  objectives: ObjState[];
  state: 'play' | 'complete' | 'failed' = 'play'; endT = 0;
  banners: { text: string; sub?: string; color?: string; t: number }[] = [];
  hints: Hint[] = []; activeHint: Hint | null = null;
  exitReady = false; exitNagT = 0;
  bombsDropped = 0; hookedCount = 0; kills = 0;
  bossArena: [number, number] | null = null;
  ventSpecs: number[] = [];
  constructor(spec: MissionSpec, stats: Stats, levels: Record<string, number>, paint: string, provisions: boolean, assist = 0) {
    this.spec = spec;
    this.length = spec.length;
    this.wind = spec.wind;
    this.biome = getBiome(spec.biome);
    this.terrain = new Terrain(spec.length, spec.seed, spec.buildings.map((b) => ({ ...b })), this.biome, spec.lava ?? []);
    const startY = this.terrain.floorY(190) - 20;
    this.player = new Player(190, startY, stats, levels, paint, provisions ? 30 : 0, (provisions ? 1 : 0) + assist);
    this.exitX = spec.length - 180;
    for (const e of spec.ents) this.spawn(e);
    for (const b of this.terrain.buildings) if (b.chimney) this.stacks.push(new Smokestack(b.x + b.w / 2, b.top - 78));
    for (const vx of this.ventSpecs) this.stacks.push(new Smokestack(vx, this.terrain.groundY(vx) - 4, true));
    this.objectives = spec.objectives.map((o) => ({ spec: o, progress: 0, done: false, failed: false }));
    this.camX = 0; this.camY = 0;
  }

  private spawn(e: EntSpec) {
    const sy = this.terrain.surfaceY(e.x);
    switch (e.t) {
      case 'item': {
        const air = e.alt !== undefined;
        const it = new Item(e.x, air ? sy - (e.alt as number) : sy - 12, e.kind as ItemKind, air);
        it.tag = e.tag; it.id = e.id;
        this.items.push(it); break;
      }
      case 'power': this.powerups.push(new PowerUp(e.x, sy - (e.alt ?? 200), e.kind as PowerKind)); break;
      case 'target': this.targets.push(new Target(e.x, sy, e.kind as TargetKind, e.tag)); break;
      case 'enemy': {
        const kind = e.kind as EnemyKind;
        const y = kind === 'turret' || kind === 'buggy' ? sy : sy - (e.alt ?? 250);
        const en = new Enemy(e.x, kind === 'snapper' ? sy : y, kind, e.w ?? 200); en.tag = e.tag; en.style = this.biome.id; this.enemies.push(en); break;
      }
      case 'powerline': {
        const x2 = e.x2 as number;
        this.lines.push(new PowerLine(e.x, this.terrain.groundY(e.x) - (e.alt ?? 200), x2, this.terrain.groundY(x2) - (e.alt ?? 200)));
        break;
      }
      case 'gust': this.gusts.push(new Gust(e.x, e.w ?? 400, e.fx ?? 0, e.fy ?? 0, e.style ?? 'wind')); break;
      case 'storm': this.storms.push(new Storm(e.x, e.w ?? 500)); break;
      case 'vent': this.ventSpecs.push(e.x); break;
      case 'boss': {
        const aw = e.w ?? 1400;
        this.boss = new Boss(e.x + aw * 0.6, this.terrain.floorY(e.x + aw * 0.6), e.x, aw, BOSSES[this.spec.bossCfg ?? 'bertha']);
        this.bossArena = [e.x, e.x + aw];
        break;
      }
      case 'hint': this.hints.push({ x: e.x, text: e.text ?? '', touchText: e.touchText, kind: e.kind ?? 'info', shown: false, done: false, t: 0, doneT: 0 }); break;
      case 'exit': this.exitX = e.x; break;
    }
    // smokestacks come from chimney buildings

  }

  // ---------------------------------------------------------------- environment
  windAt(_x: number, y: number) { return this.wind * (1 + clamp((GROUND - y) / 700, 0, 1)) + Math.sin(this.time * 0.4) * 8; }
  gustAt(x: number) { return this.gusts.find((g) => g.contains(x)) ?? null; }
  dangerNear() {
    const p = this.player;
    for (const e of this.enemies) if (!e.dead && e.active && dist(e.x, e.y, p.x, p.y) < 320) return true;
    for (const pr of this.projectiles) if (dist(pr.x, pr.y, p.x, p.y) < 220) return true;
    return !!(this.boss && this.boss.started && !this.boss.dead);
  }
  lookTarget(): { x: number; y: number } | null {
    const p = this.player; let best: { x: number; y: number } | null = null; let bd = 380;
    for (const e of this.enemies) { if (e.dead || !e.active) continue; const d = dist(e.x, e.y, p.x, p.y); if (d < bd) { bd = d; best = { x: e.x, y: e.cy }; } }
    for (const pr of this.projectiles) { const d = dist(pr.x, pr.y, p.x, p.y); if (d < bd) { bd = d; best = pr; } }
    return best;
  }

  // ---------------------------------------------------------------- actions
  dropBomb(x: number, y: number, vx: number, vy: number, cluster: boolean) {
    this.bombs.push(new Bomb(x, y, vx, vy, cluster)); this.bombsDropped++; this.hintEvent('bomb');
  }
  explode(x: number, y: number, scale = 1) {
    const r = 54 * this.player.stats.blastMul * scale;
    this.fx.explosion(x, y, 0.8 * scale * Math.sqrt(this.player.stats.blastMul), scale >= 1 ? pick(['KA-BOOM!', 'BOOM!', 'WHAM!', 'BLAM!', 'KRAK!']) : undefined);
    Audio.explosion(scale);
    try { navigator.vibrate?.(25); } catch { /* unsupported */ }
    this.fx.groundRing(x, Math.min(y, this.terrain.surfaceY(x)), r);
    for (const e of this.enemies) {
      if (e.dead || e.dying > 0) continue;
      const d = dist(x, y, e.x, e.cy) - e.r;
      if (d < r) e.damage(this, d < r * 0.45 ? 2 : 1, 'bomb');
    }
    for (const t of this.targets) {
      if (t.dead) continue;
      if (t.contains(x, y, r * 0.45)) t.damage(this, 2);
      else if (t.contains(x, y, r * 0.9)) t.damage(this, 1);
    }
    for (const pr of this.projectiles) if (!pr.dead && dist(x, y, pr.x, pr.y) < r) { pr.dead = true; this.fx.puff(pr.x, pr.y, 3); this.fx.popup(pr.x, pr.y - 10, 'SHOT DOWN!', P.gold, 13); }
    for (const it of this.items) if (!it.hooked && !it.floating && dist(x, y, it.x, it.y) < r) { it.vy = -rand(180, 260); it.vx = (it.x - x) * 2 + rand(-40, 40); }
    this.boss?.blast(this, x, y, r);
    this.fx.dust(x, y, 6);
  }
  spawnDrop(x: number, y: number, kind: ItemKind, n = 1) {
    for (let i = 0; i < n; i++) { const it = new Item(x + rand(-10, 10), y - 10, kind); it.vx = rand(-140, 140); it.vy = rand(-320, -180); this.items.push(it); }
  }
  collect(it: Item) {
    it.dead = true;
    const p = this.player;
    const add = (k: ResKey, n: number) => { this.collected[k] += n; };
    let text = ''; let col: string = P.gold;
    switch (it.kind) {
      case 'scrap': add('scrap', 2); text = '+2 SCRAP'; break;
      case 'fuel': add('fuel', 2); p.fuel = Math.min(p.maxFuel, p.fuel + 40 * p.stats.fuelPickup); text = '+FUEL'; col = P.orangeLight; break;
      case 'fabric': add('fabric', 2); text = '+2 FABRIC'; col = P.tealLight; if (p.hp < p.maxHp) { p.hp++; text = 'PATCHED UP!'; } break;
      case 'food': add('food', 1); text = '+1 FOOD'; break;
      case 'water': add('water', 1); text = '+1 WATER'; col = P.tealLight; break;
      case 'electronics': add('electronics', 1); text = '+1 ELECTRONICS'; col = P.electric; break;
      case 'crate': add('scrap', 4); add(pick(['fabric', 'food', 'water', 'fuel'] as ResKey[]), 2); text = 'CRATE! +4 SCRAP'; break;
      case 'supply': add('scrap', 3); add('food', 1); add('water', 1); text = 'SUPPLIES SECURED!'; break;
      case 'medicine': text = 'MEDICINE SECURED!'; col = P.redBright; break;
      case 'mystery': {
        const r = Math.random();
        if (r < 0.35) { add('electronics', 2); text = 'MYSTERY: +2 ELECTRONICS'; col = P.electric; }
        else if (r < 0.7) { const pk = pick(['cluster', 'shield', 'hotair'] as PowerKind[]); this.applyPower(pk); text = 'MYSTERY: ' + POWER_INFO[pk].name; }
        else { add('scrap', 6); add('fabric', 3); text = 'MYSTERY: JACKPOT!'; }
        this.retrieved['mystery'] = (this.retrieved['mystery'] ?? 0) + 1;
        break;
      }
      case 'survivor': this.rescued++; text = 'RESCUED!'; col = P.goldLight; this.fx.confetti(p.x, p.y, 16); break;
      case 'postcard': this.postcard = true; text = 'LOST POSTCARD!'; col = P.tealLight; this.fx.confetti(p.x, p.y, 20); break;
    }
    if (it.tag) this.retrieved[it.tag] = (this.retrieved[it.tag] ?? 0) + 1;
    this.hookedCount++;
    this.fx.popup(p.x, p.y - 150, text, col, 18);
    Audio.pickup(it.kind);
    p.setExpr('happy', 1.1);
    if (it.kind === 'survivor' || it.kind === 'postcard' || it.kind === 'supply' || it.kind === 'mystery') { Audio.voice('woo'); p.setArm('cheer', 0.9); }
    p.squashV -= 2;
  }
  applyPower(k: PowerKind) {
    const p = this.player;
    if (k === 'cluster') p.clusterT = POWER_INFO.cluster.dur;
    if (k === 'shield') p.shield = true;
    if (k === 'hotair') { p.hotairT = POWER_INFO.hotair.dur; p.fuel = p.maxFuel; }
    if (k === 'bombs') p.bombs = p.stats.bombCap;
    this.fx.burst(p.x, p.y - 190, POWER_INFO[k].name, 24, P.goldLight);
    Audio.pickup('power'); Audio.voice('yay'); p.setExpr('happy', 1.2);
  }

  // ---------------------------------------------------------------- callbacks
  onTargetDestroyed(t: Target) {
    this.fx.explosion(t.x, t.y - t.h / 2, 1.2, pick(['KA-BLOOEY!', 'KRUNCH!', 'KA-BOOM!']));
    Audio.explosion(1.2);
    const key = t.tag ?? t.kind;
    this.destroyed[key] = (this.destroyed[key] ?? 0) + 1;
    if (t.tag && t.tag !== t.kind) this.destroyed[t.kind] = (this.destroyed[t.kind] ?? 0) + 1;
    this.kills++;
    const drops: Record<TargetKind, ItemKind[]> = { barricade: ['scrap', 'scrap'], junkpile: ['scrap', 'scrap', 'scrap'], cratestack: ['crate', 'food', 'water'], siren: ['electronics', 'electronics', 'scrap'], depot: ['fuel', 'fuel', 'scrap', 'scrap'] };
    for (const k of drops[t.kind]) this.spawnDrop(t.x, t.y - t.h, k);
    this.player.setExpr('happy', 0.8); Audio.voice('yay');
  }
  onEnemyDestroyed(e: Enemy) {
    this.kills++;
    const key = e.tag ?? e.kind;
    this.destroyed[key] = (this.destroyed[key] ?? 0) + 1;
    if (e.tag && e.tag !== e.kind) this.destroyed[e.kind] = (this.destroyed[e.kind] ?? 0) + 1;
    const drops: Record<EnemyKind, ItemKind[]> = { buzzard: ['scrap'], turret: ['scrap', 'scrap'], buggy: ['scrap', 'fuel'], gyro: ['scrap', Math.random() < 0.4 ? 'electronics' : 'fabric'], mine: [], snapper: ['food', 'fabric'], moth: ['fabric'] };
    for (const k of drops[e.kind]) this.spawnDrop(e.x, e.y - 10, k);
    this.player.setExpr('happy', 0.8);
  }
  onPlayerHit() { /* objectives evaluate damage */ }
  onPlayerDown() { this.state = 'failed'; this.endT = 0; }
  onBossStart() { Audio.playSong('boss'); this.fx.shake = 10; Audio.voice('yikes'); }
  onBossPhase(ph: number) { this.banner(ph >= 3 ? 'SHE\'S FURIOUS!' : 'KEEP IT UP!', ph >= 3 ? 'Last valve! She\'s calling buzzards!' : 'Bertha is lobbing junk now!'); }
  onBossDefeated(b: Boss) {
    this.bossDown = true;
    for (let i = 0; i < 6; i++) this.spawnDrop(b.x, b.y - 80, 'scrap');
    this.spawnDrop(b.x, b.y - 80, 'electronics', 3); this.spawnDrop(b.x, b.y - 80, 'fabric', 2);
    Audio.playSong('flight'); Audio.voice('woo');
    this.player.setExpr('cheer', 2); this.player.setArm('cheer', 2);
  }
  banner(text: string, sub?: string, color?: string) { this.banners.push({ text, sub, color, t: 2.6 }); }
  hintEvent(kind: string) { for (const h of this.hints) if (h.kind === kind && h.shown) h.done = true; }

  // ---------------------------------------------------------------- update
  update(c: Controls, dt: number) {
    if (this.fx.hitstop > 0) { this.fx.hitstop -= dt; this.fx.hitstopCool = Math.max(this.fx.hitstopCool, 0.2); return; }
    this.time += dt;
    const p = this.player;
    // boss arena walls
    if (this.boss && this.boss.started && !this.boss.dead && this.bossArena) {
      if (p.x < this.bossArena[0] + 40) { p.x = this.bossArena[0] + 40; p.vx = Math.abs(p.vx) * 0.5; }
      if (p.x > this.bossArena[1] - 40) { p.x = this.bossArena[1] - 40; p.vx = -Math.abs(p.vx) * 0.5; }
    }
    const ctrl = this.state === 'play' ? c : { x: 0, y: this.state === 'complete' ? -0.6 : 0, bomb: false, hook: false, boost: false };
    p.update(this, ctrl, dt);
    if (c.hook) this.hintEvent('hook');
    for (const it of this.items) it.update(this, dt);
    for (const pu of this.powerups) {
      pu.update(this, dt);
      const end = p.rope[p.rope.length - 1];
      if (p.hitTest(pu.x, pu.y, pu.r) || (p.hookState !== 'stowed' && dist(end.x, end.y, pu.x, pu.y) < pu.r + 10)) { pu.dead = true; this.applyPower(pu.kind); }
    }
    // floating items: grab by touching balloon body too
    for (const it of this.items) if (it.floating && !it.hooked && !it.dead && p.hitTest(it.x, it.y, it.r)) this.collect(it);
    for (const t of this.targets) t.update(this, dt);
    for (const e of this.enemies) {
      e.update(this, dt);
      if (!e.dead && e.dying === 0 && e.active && (e.kind === 'buzzard' || e.kind === 'gyro' || e.kind === 'moth') && p.hitTest(e.x, e.y, e.r * 0.8)) {
        p.hit(this, 1, e.x, e.y, e.kind);
        if (e.kind === 'buzzard' || e.kind === 'moth') e.damage(this, 1, 'ram');
        else { e.vx = (e.x - p.x) * 3; e.vy = -100; }
      }
    }
    for (const pr of this.projectiles) pr.update(this, dt);
    for (const b of this.bombs) b.update(this, dt);
    for (const l of this.lines) l.update(this, dt);
    for (const s of this.stacks) s.update(this, dt);
    for (const st of this.storms) st.update(this, dt);
    for (const e of this.eruptions) e.update(this, dt);
    this.eruptions = this.eruptions.filter((e) => !e.dead);
    const g = this.gustAt(p.x); this.stormLevel = damp(this.stormLevel, g && g.style !== 'wind' ? 2.4 : 1, 2, dt);
    this.boss?.update(this, dt);
    this.items = this.items.filter((i) => !i.dead);
    this.powerups = this.powerups.filter((i) => !i.dead);
    this.targets = this.targets.filter((i) => !i.dead);
    this.enemies = this.enemies.filter((i) => !i.dead);
    this.projectiles = this.projectiles.filter((i) => !i.dead);
    this.bombs = this.bombs.filter((i) => !i.dead);
    this.fx.update(dt);
    this.updateObjectives(dt);
    this.updateHints(dt);
    this.updateCamera(dt);
    for (const b of this.banners) b.t -= dt;
    this.banners = this.banners.filter((b) => b.t > 0);
    Audio.wind(Math.abs(p.vx) / 300 + Math.abs(this.wind) / 200 + (p.boosting > 0 ? 0.4 : 0));
    if (this.state !== 'play') this.endT += dt;
  }

  private updateObjectives(dt: number) {
    if (this.state !== 'play') return;
    const p = this.player;
    for (const o of this.objectives) {
      const s = o.spec; const need = s.count ?? 1;
      let prog = 0;
      switch (s.type) {
        case 'destroy': prog = this.destroyed[s.tag!] ?? 0; break;
        case 'collect': prog = this.collected[s.kind as ResKey] ?? 0; break;
        case 'rescue': prog = this.rescued; break;
        case 'retrieve': case 'deliver': prog = this.retrieved[s.tag!] ?? 0; break;
        case 'boss': prog = this.bossDown ? 1 : 0; break;
        case 'postcard': prog = this.postcard ? 1 : 0; break;
        case 'nodamage': prog = 0; if (p.damageTaken > 0 && !o.failed) { o.failed = true; } break;
      }
      o.progress = Math.min(need, prog);
      if (!o.done && s.type !== 'nodamage' && prog >= need) {
        o.done = true; Audio.objective();
        this.banner(s.optional ? 'BONUS!' : 'OBJECTIVE COMPLETE', s.text, s.optional ? P.tealLight : P.gold);
        p.setExpr('cheer', 1.4); p.setArm('cheer', 1.2);
      }
    }
    const req = this.objectives.filter((o) => !o.spec.optional);
    const ready = req.every((o) => o.done);
    if (ready && !this.exitReady) {
      this.exitReady = true;
      if (req.length) this.banner('HEAD HOME!', `Fly to the ${CAMP_NAMES[this.biome.id].toLowerCase()} — follow the flare →`, P.goldLight);
    }
    this.exitNagT -= dt;
    if (Math.abs(p.x - this.exitX) < 90 && !p.dead) {
      if (this.exitReady) {
        this.state = 'complete'; this.endT = 0;
        for (const o of this.objectives) if (o.spec.type === 'nodamage' && !o.failed) { o.done = true; o.progress = 1; }
        Audio.fanfare(); Audio.voice('woo'); p.setExpr('cheer', 99); p.setArm('cheer', 99);
        this.fx.confetti(this.exitX, p.y - 60, 60);
      } else if (this.exitNagT <= 0) { this.exitNagT = 3; this.fx.popup(p.x, p.y - 160, 'Not yet — objectives first!', P.parchment, 16); Audio.deny(); }
    }
  }

  private updateHints(dt: number) {
    const p = this.player;
    for (const h of this.hints) {
      if (!h.shown && p.x >= h.x && (!this.activeHint || this.activeHint.done)) { h.shown = true; this.activeHint = h; h.t = 0; }
    }
    const h = this.activeHint;
    if (h) {
      h.t += dt;
      if (h.kind === 'climb' && p.y < this.terrain.groundY(p.x) - 120) h.done = true;
      if (h.kind === 'move' && p.x > h.x + 260) h.done = true;
      if (h.kind === 'info' && h.t > 6) h.done = true;
      if (h.kind === 'hook' && this.hookedCount > 0) h.done = true;
      if ((h.kind === 'bomb') && h.t > 14) h.done = true;
      if (h.done) { h.doneT += dt; if (h.doneT > 0.7) this.activeHint = null; }
    }
  }

  private updateCamera(dt: number) {
    const p = this.player;
    const look = clamp(p.vx * 0.5, -160, 160);
    let tx = p.x - this.viewW * 0.42 + look;
    let minX = 0, maxX = this.length - this.viewW;
    if (this.boss && this.boss.started && !this.boss.dead && this.bossArena) { minX = Math.max(minX, this.bossArena[0] - 40); maxX = Math.min(maxX, this.bossArena[1] - this.viewW + 40); if (maxX < minX) maxX = minX; }
    tx = clamp(tx, minX, maxX);
    this.camX = damp(this.camX, tx, 4, dt);
    const ty = clamp(Math.min(0, p.y - 205), CEILING - 70, 0);
    this.camY = damp(this.camY, ty, ty < this.camY ? 6 : 3, dt);
  }

  // ---------------------------------------------------------------- render
  drawWorld(ctx: CanvasRenderingContext2D) {
    const x0 = this.camX - 100, x1 = this.camX + this.viewW + 100;
    for (const g of this.gusts) if (g.x + g.w > x0 && g.x < x1) g.draw(ctx, this.camY, this.time);
    this.fx.draw(ctx, 'back');
    this.terrain.drawBuildings(ctx, x0, x1);
    for (const s of this.stacks) s.draw(ctx);
    for (const e of this.eruptions) e.draw(ctx);
    this.drawHaven(ctx, 70, false);
    this.drawHaven(ctx, this.exitX, true);
    this.terrain.drawGround(ctx, x0, x1);
    this.drawWater(ctx, x0, x1);
    for (const l of this.lines) l.draw(ctx);
    this.boss?.draw(ctx);
    for (const t of this.targets) if (t.x > x0 - 60 && t.x < x1 + 60) t.draw(ctx);
    for (const it of this.items) if (!it.hooked && it.x > x0 && it.x < x1) it.draw(ctx, this);
    for (const pu of this.powerups) if (pu.x > x0 && pu.x < x1) pu.draw(ctx);
    for (const e of this.enemies) if (e.x > x0 - 60 && e.x < x1 + 60) e.draw(ctx, this);
    this.player.draw(ctx, this);
    for (const b of this.bombs) b.draw(ctx);
    for (const pr of this.projectiles) pr.draw(ctx);
    for (const st of this.storms) if (st.x + st.w > x0 && st.x < x1) st.draw(ctx, this.camY);
    this.fx.draw(ctx, 'front');
    this.fx.drawText(ctx);
  }

  /** Animated floodwater surface (The Flood). */
  private drawWater(ctx: CanvasRenderingContext2D, x0: number, x1: number) {
    const wy = this.biome.water; if (wy === undefined) return;
    ctx.fillStyle = 'rgba(52,92,100,0.82)'; ctx.fillRect(x0, wy, x1 - x0, 200);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = Math.floor(x0 / 12) * 12; x <= x1; x += 12) { const y = wy + Math.sin(x * 0.04 + this.time * 2) * 2.5; if (x === Math.floor(x0 / 12) * 12) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke(); ctx.strokeStyle = 'rgba(220,240,240,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(220,240,240,0.35)';
    for (let i = 0; i < 24; i++) { const x = x0 + ((i * 137 + this.time * 20) % (x1 - x0)); const y = wy + 12 + (i * 29) % 70; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y); ctx.stroke(); }
  }

  /** Haven landing pads: start (launch) and exit (destination). */
  private drawHaven(ctx: CanvasRenderingContext2D, x: number, exit: boolean) {
    if (x < this.camX - 200 || x > this.camX + this.viewW + 200) return;
    const gy = this.terrain.floorY(x);
    ctx.save(); ctx.translate(x, gy);
    pen.use(ctx, 0.5);
    // platform on stilts
    pen.begin().m(-70, 0).l(-60, -36).m(70, 0).l(60, -36).m(-60, 0).l(60, -36).m(60, 0).l(-60, -36).stroke(4, P.brownDark);
    pen.begin().rect(-80, -44, 160, 10).ink(P.brownLight, 3);
    for (let i = -70; i < 80; i += 16) pen.begin().m(i, -44).l(i, -34).stroke(1.2, P.brown);
    // flag poles
    for (const fxp of [-76, 76]) {
      pen.begin().m(fxp, -44).l(fxp, -120).stroke(3, P.ink);
      const wave = Math.sin(this.time * 6 + fxp) * 4;
      pen.begin().m(fxp, -120).q(fxp + 14, -118 + wave, fxp + 28, -114).l(fxp + 26, -100 + wave).q(fxp + 12, -104, fxp, -102).close().ink(exit ? P.gold : P.teal, 2);
    }
    // sign
    ctx.save(); ctx.translate(0, -62);
    pen.begin().rect(-40, -12, 80, 22).ink(P.parchment, 2.4);
    ctx.font = '15px "Luckiest Guy", Impact'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.redDark; const nm = CAMP_NAMES[this.biome.id]; ctx.font = `${nm.length > 7 ? 12 : 15}px "Luckiest Guy", Impact`; ctx.fillText(exit ? nm + ' →' : nm, 0, 0);
    ctx.restore();
    pen.begin().m(-30, -50).l(-30, -44).m(30, -50).l(30, -44).stroke(2);
    if (exit) {
      // flare + landing lights
      const on = this.exitReady;
      for (let i = -3; i <= 3; i++) { ctx.fillStyle = on && Math.floor(this.time * 4 + i) % 2 === 0 ? P.goldLight : P.brownDark; ctx.beginPath(); ctx.arc(i * 20, -48, 3.5, 0, 7); ctx.fill(); }
      if (on) {
        const fy = -160 - Math.sin(this.time * 2) * 30;
        ctx.fillStyle = 'rgba(255,90,60,0.25)'; ctx.beginPath(); ctx.arc(0, fy, 30 + Math.sin(this.time * 20) * 4, 0, 7); ctx.fill();
        ctx.fillStyle = P.hot; ctx.beginPath(); ctx.arc(0, fy, 8, 0, 7); ctx.fill();
        ctx.fillStyle = P.flame1; ctx.beginPath(); ctx.arc(0, fy, 4, 0, 7); ctx.fill();
        if (Math.random() < 0.4) this.fx.add({ kind: 'smoke', x: x + rand(-4, 4), y: gy + fy + 10, vx: rand(-10, 10), vy: 30, r: 6, life: 1.5, max: 1.5, color: '#f0b0a0', drag: 1 });
      }
      // survivors waving on the pad
      for (const [sx, k] of [[-40, 0], [-18, 1], [36, 2]] as [number, number][]) {
        ctx.save(); ctx.translate(sx, -56); ctx.scale(0.9, 0.9);
        const coats = [P.olive, P.purple, P.red];
        const wv = Math.sin(this.time * 8 + k * 2) * 4;
        pen.begin().m(-6, 12).q(-7, -2, 0, -3).q(7, -2, 6, 12).close().ink(coats[k], 2);
        pen.begin().m(5, 0).l(10, -10 + wv).stroke(2.6);
        pen.begin().ell(0, -9, 6, 6).ink(P.skin, 1.8);
        ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(-2, -9, 1, 0, 7); ctx.arc(2, -9, 1, 0, 7); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /** Off-screen indicator data for HUD. */
  pointers(): { x: number; y: number; color: string; label: string }[] {
    const out: { x: number; y: number; color: string; label: string }[] = [];
    const add = (x: number, y: number, color: string, label: string) => { if (x < this.camX || x > this.camX + this.viewW || y < this.camY || y > this.camY + this.viewH) out.push({ x, y, color, label }); };
    if (this.exitReady) add(this.exitX, this.terrain.floorY(this.exitX) - 80, P.gold, 'HOME');
    for (const t of this.targets) if (t.marked) add(t.x, t.y - 30, P.redBright, '!');
    for (const it of this.items) if (it.tag || it.kind === 'survivor') add(it.x, it.y, P.goldLight, it.kind === 'survivor' ? 'SOS' : '!');
    if (this.boss && !this.boss.started) add(this.boss.x, this.boss.y - 100, P.redBright, '☠');
    return out;
  }
}

export const RES_ICON: Record<ResKey, ItemKind> = { fuel: 'fuel', scrap: 'scrap', fabric: 'fabric', food: 'food', water: 'water', electronics: 'electronics' };
export { ITEM_INFO, inkText };
void RNG;
