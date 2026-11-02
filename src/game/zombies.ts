import { P } from '../render/palette';
import { drawZombie, Z_SIZE, type ZKindArt, type ZPose } from '../render/zombieArt';
import { inkText } from '../render/ink';
import { clamp, rand, pick } from '../core/math';
import { Audio } from '../core/audio';
import type { Building } from './level';
import type { Expedition } from './expedition';

export type ZKind = ZKindArt;
export type ZState = 'wander' | 'chase' | 'climb' | 'crouch' | 'leap' | 'hang' | 'board' | 'fall' | 'dead' | 'scream' | 'spit' | 'throw';

export interface ZInfo { name: string; hp: number; speed: number; weight: number; grip: number; climb: number; desc: string; color: string; }
export const Z_INFO: Record<ZKind, ZInfo> = {
  walker: { name: 'Walker', hp: 2, speed: 30, weight: 0.17, grip: 100, climb: 4.5, desc: 'Shambles about. Grabs anything that flies too low.', color: '#9ab07a' },
  swarmer: { name: 'Swarmer', hp: 1, speed: 72, weight: 0.08, grip: 40, climb: 3, desc: 'Tiny and fast. Comes in packs. Stacks into towers.', color: '#a8b890' },
  climber: { name: 'Climber', hp: 2, speed: 46, weight: 0.14, grip: 150, climb: 2.2, desc: 'Scales walls in seconds. Climbs aboard fast.', color: '#88a070' },
  leaper: { name: 'Leaper', hp: 2, speed: 42, weight: 0.15, grip: 100, climb: 3.5, desc: 'Crouches, then JUMPS at your basket from rooftops.', color: '#8aa88a' },
  brute: { name: 'Brute', hp: 7, speed: 22, weight: 0.55, grip: 320, climb: 6, desc: 'Throws rubble. Hangs on like a ton of bricks and tears at the basket.', color: '#9aa898' },
  spitter: { name: 'Spitter', hp: 2, speed: 20, weight: 0.2, grip: 90, climb: 5, desc: 'Lobs acid at your envelope from afar.', color: '#9ac080' },
  bloater: { name: 'Bloater', hp: 2, speed: 16, weight: 0.3, grip: 60, climb: 99, desc: 'Explodes when popped. Hanging on, it swells... and BURSTS.', color: '#b8c070' },
  screamer: { name: 'Screamer', hp: 2, speed: 30, weight: 0.15, grip: 80, climb: 4, desc: 'Shrieks to call the whole horde. Silence it first!', color: '#b0b88a' },
  soldier: { name: 'Soldier', hp: 4, speed: 27, weight: 0.22, grip: 120, climb: 5, desc: 'Helmet and armour. Takes a beating.', color: '#5c6a4e' },
};

const G = 900;

export class Zombie {
  x: number; y: number; vx = 0; vy = 0;
  kind: ZKind; hp: number; state: ZState = 'wander'; facing = 1; t = rand(0, 10); seed = rand(0, 1000);
  bld: Building | null; stack = 0; burn = 0; stun = 0; cd = rand(0.5, 2.5); noticed = false; flash = 0; spin = 0; spinV = 0;
  dead = false; deadT = 0; grabCd = 0; stateT = 0; wanderX: number; sleeping = false; ground = true; screamed = false;
  /** stacked tower offset */
  sy = 0;
  constructor(x: number, y: number, kind: ZKind, bld: Building | null) {
    this.x = x; this.y = y; this.kind = kind; this.bld = bld; this.hp = Z_INFO[kind].hp; this.wanderX = x; this.facing = Math.random() < 0.5 ? -1 : 1;
  }
  get h() { return Z_SIZE[this.kind].h; }
  get attached() { return this.state === 'hang' || this.state === 'board'; }
  get airborne() { return this.state === 'fall' || this.state === 'leap' || this.state === 'dead'; }
  surface(e: Expedition) { return this.bld ? this.bld.top : e.terrain.groundY(this.x); }
  /** Highest point the zombie's hands reach while standing. */
  handY() { return this.y - this.sy - this.h - Z_SIZE[this.kind].arm * 0.9; }

  hurt(e: Expedition, dmg: number, kx = 0, ky = 0, src = '') {
    if (this.dead) return;
    this.hp -= dmg; this.flash = 0.15;
    if (this.hp <= 0) { this.die(e, kx, ky, src); return; }
    if ((kx || ky) && !this.attached) { this.state = 'fall'; this.vx = kx; this.vy = ky; this.spinV = rand(-8, 8); this.bld = null; this.sy = 0; }
  }
  die(e: Expedition, kx = 0, ky = -200, src = '') {
    if (this.dead) return;
    const wasAttached = this.attached;
    if (wasAttached) e.ship.detach(this);
    this.dead = true; this.state = 'dead'; this.deadT = 0; this.vx = kx || rand(-80, 80); this.vy = ky || -200; this.spinV = rand(-10, 10); this.sy = 0; this.bld = null;
    e.onZombieKilled(this, src);
    if (this.kind === 'bloater') e.bloaterPop(this.x, this.y - 20, wasAttached);
  }

  update(e: Expedition, dt: number) {
    this.t += dt; this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt); this.cd -= dt; this.grabCd -= dt; this.stun -= dt;
    if (this.burn > 0) {
      this.burn -= dt;
      if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) { this.hurt(e, 1, 0, 0, 'fire'); if (Math.random() < 0.3) e.fx.puff(this.x, this.y - this.h, 1, P.smoke, 5); }
      if (this.dead) return;
    }
    if (this.dead) {
      this.deadT += dt;
      if (this.vy !== 0 || this.y < e.terrain.groundY(this.x) - 2) {
        this.vy += G * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.spin += this.spinV * dt;
        const s = e.terrain.surfaceY(this.x);
        if (this.y >= s && this.vy > 0) { this.y = s; this.vy = 0; this.vx = 0; e.fx.dust(this.x, s, 2); }
      }
      return;
    }
    if (this.attached) return; // driven by the airship
    const ship = e.ship;
    const dx = ship.x - this.x;
    // airborne
    if (this.state === 'fall' || this.state === 'leap') {
      this.vy += G * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.spin += this.spinV * dt;
      if (this.state === 'leap' && ship.touchesHull(this.x, this.y - this.h * 0.6, 10)) { ship.attach(e, this); return; }
      const s = e.terrain.surfaceY(this.x);
      if (this.y >= s && this.vy > 0) {
        const impact = this.vy;
        this.y = s; this.vy = 0; this.vx = 0; this.spin = 0; this.sy = 0;
        this.bld = e.terrain.buildingAt(this.x, s + 1);
        if (this.bld && Math.abs(this.bld.top - s) > 2) this.bld = null;
        e.fx.dust(this.x, s, 3);
        if (impact > 620) { this.die(e, 0, -60, 'fall'); e.fx.popup(this.x, s - 30, 'SPLAT!', P.oliveLight, 14); return; }
        this.state = 'chase'; this.stun = 0.7; this.stateT = 0;
      }
      return;
    }
    // notice the balloon
    const alt = ship.basketY - this.y;
    if (!this.noticed && Math.abs(dx) < 430 && alt > -480) { this.noticed = true; if (this.state === 'wander') this.state = 'chase'; }
    if (this.stun > 0) return;
    // special actions
    if (this.state === 'scream' || this.state === 'spit' || this.state === 'throw') {
      // wind-up first, so the player gets a tell and a moment to dodge
      if (!this.thrown && this.state !== 'scream' && this.stateT > (this.state === 'throw' ? 0.55 : 0.35)) { this.thrown = true; if (this.state === 'throw') e.throwRubble(this); else e.spit(this); }
      if (this.stateT > (this.state === 'scream' ? 1.3 : 0.9)) { this.state = 'chase'; this.stateT = 0; }
      return;
    }
    if (this.state === 'crouch') {
      this.facing = dx > 0 ? 1 : -1;
      if (this.stateT > 0.45) this.launchLeap(e);
      return;
    }
    if (this.state === 'climb') {
      const b = this.bld!;
      this.y -= (this.kind === 'climber' ? 70 : 40) * dt;
      if (this.y <= b.top) { this.y = b.top; this.x = clamp(this.x, b.x + 4, b.x + b.w - 4); this.state = 'chase'; this.stateT = 0; }
      return;
    }
    // ----- walking (wander / chase) -----
    const info = Z_INFO[this.kind];
    let target = this.wanderX;
    if (this.state === 'chase' && this.noticed) target = ship.x + (this.kind === 'spitter' || this.kind === 'brute' ? -Math.sign(dx) * 140 : 0);
    else if (Math.abs(this.x - this.wanderX) < 6 || this.stateT > 4) { this.wanderX = this.x + rand(-90, 90); this.stateT = 0; }
    const burnRun = this.burn > 0 ? 1.8 : 1;
    const sp = info.speed * (this.state === 'chase' ? 1.5 : 0.6) * burnRun * e.zSpeed;
    const want = this.burn > 0 ? Math.sin(this.t * 3 + this.seed) : clamp((target - this.x) / 20, -1, 1);
    let mx = want * sp * dt;
    if (Math.abs(mx) > 0.05) this.facing = mx > 0 ? 1 : -1;
    if (this.sy > 0) mx = 0; // stacked zombies hold position
    let nx = this.x + mx;
    if (this.bld) {
      const b = this.bld;
      if (nx < b.x + 3 || nx > b.x + b.w - 3) {
        nx = clamp(nx, b.x + 3, b.x + b.w - 3);
        // the occasional lemming tumbles off the roof chasing the balloon
        if (this.state === 'chase' && Math.abs(dx) > 50 && Math.random() < dt * 0.25 && this.kind !== 'brute') { this.state = 'fall'; this.vx = Math.sign(dx) * 60; this.vy = -80; this.bld = null; this.spinV = rand(-5, 5); e.fx.popup(this.x, this.y - 40, pick(['WHOOPS!', 'AAAH!', 'BLEH!']), P.parchment, 12); }
      }
    } else {
      const wall = e.terrain.buildings.find((b) => nx > b.x - 2 && nx < b.x + b.w + 2 && !(this.x > b.x - 2 && this.x < b.x + b.w + 2));
      if (wall) {
        nx = this.x;
        const canClimb = !e.isSafe(wall) && (this.kind === 'climber' || (this.state === 'chase' && this.kind !== 'brute' && this.kind !== 'bloater' && Math.random() < dt * 0.04));
        if (canClimb) { this.state = 'climb'; this.bld = wall; this.x = this.x < wall.x ? wall.x - 2 : wall.x + wall.w + 2; this.stateT = 0; }
      }
    }
    this.x = nx;
    this.y = this.surface(e);
    if (this.state !== 'chase' || !this.noticed) return;
    // ----- attacks -----
    const adx = Math.abs(dx);
    if (this.kind === 'screamer' && !this.screamed && adx < 360) { this.screamed = true; this.state = 'scream'; this.stateT = 0; e.scream(this); return; }
    if (this.kind === 'spitter' && this.cd <= 0 && adx < 340 && alt < 60 && e.canRanged()) { this.cd = rand(5, 7) / e.aggro; this.state = 'spit'; this.stateT = 0; this.thrown = false; return; }
    if (this.kind === 'brute' && this.cd <= 0 && adx < 280 && adx > 60 && alt < 30 && -alt < 320 && e.canRanged()) { this.cd = rand(6.5, 9) / e.aggro; this.state = 'throw'; this.stateT = 0; this.thrown = false; return; }
    if (this.kind === 'leaper' && this.cd <= 0 && adx < 190 + 12 * e.region.danger && -alt > 25 && -alt < 190 + 12 * e.region.danger) { this.state = 'crouch'; this.stateT = 0; this.cd = rand(2.5, 4); return; }
    // grab the basket when it flies within reach
    if (this.grabCd <= 0 && adx < ship.halfW + 10) {
      const reachY = this.handY();
      if (ship.basketY >= reachY - 6 && ship.basketY < this.y - this.sy + 4) {
        this.grabCd = 0.35;
        if (Math.random() < (0.42 + 0.06 * e.region.danger) * e.aggro) ship.attach(e, this);
      }
    }
  }

  launchLeap(e: Expedition) {
    const s = e.ship;
    const T = 0.55;
    const tx = s.x + s.vx * T, ty = s.basketY - 8 + s.vy * T;
    this.vx = clamp((tx - this.x) / T, -460, 460);
    this.vy = clamp((ty - this.y) / T - 0.5 * G * T, -820, -120);
    this.state = 'leap'; this.stateT = 0; this.bld = null; this.sy = 0; this.spinV = 0;
    Audio.squawk(); e.fx.dust(this.x, this.y, 3);
  }

  pose(): ZPose {
    switch (this.state) {
      case 'climb': return 'climb';
      case 'crouch': return 'crouch';
      case 'leap': return 'leap';
      case 'fall': case 'dead': return 'fall';
      case 'scream': return 'scream';
      case 'spit': return 'spit';
      case 'throw': return 'throw';
      case 'board': return 'board';
      case 'hang': return 'hang';
      case 'wander': return 'walk';
      default: return this.stun > 0 ? 'stun' : this.reaching ? 'reach' : 'walk';
    }
  }
  reaching = false;
  thrown = true;
  tough = false;

  draw(ctx: CanvasRenderingContext2D, e: Expedition) {
    if (this.attached) return;
    ctx.save();
    ctx.translate(this.x, this.y - this.sy);
    if (this.state === 'dead') { ctx.globalAlpha = clamp(1.6 - this.deadT * 0.6, 0, 1); }
    if (this.state === 'climb') ctx.translate(0, 0);
    drawZombie(ctx, { kind: this.kind, pose: this.pose(), t: this.t, facing: this.state === 'climb' ? (this.bld && this.x < this.bld.x + this.bld.w / 2 ? 1 : -1) : this.facing, seed: this.seed, burn: this.burn, flash: this.flash > 0, spin: this.spin });
    if (this.state === 'crouch' || ((this.state === 'throw' || this.state === 'spit') && !this.thrown)) inkText(ctx, '!', 0, -this.h - 20, 22, P.redBright, { outline: 4 });
    if (this.state === 'scream') { ctx.strokeStyle = 'rgba(226,73,58,0.6)'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { const r = ((this.stateT * 120 + i * 40) % 120) + 10; ctx.beginPath(); ctx.arc(8, -this.h, r, -1.2, 0.4); ctx.stroke(); } }
    if (this.kind === 'bloater' && this.hp < Z_INFO.bloater.hp) { ctx.fillStyle = 'rgba(180,230,60,0.3)'; ctx.beginPath(); ctx.arc(0, -this.h * 0.5, 22 + Math.sin(this.t * 12) * 3, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.globalAlpha = 1;
    void e;
  }
}
