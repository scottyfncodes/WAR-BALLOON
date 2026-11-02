import { P } from '../render/palette';
import { pen } from '../render/ink';
import { drawAirship, airshipGeom, airshipLook, type Geom, type CrewDraw } from '../render/airshipArt';
import { MOUTH_Y, type Expr, type ArmPose } from '../render/balloonArt';
import { clamp, dist, lerp, rand, damp, pick, buzz } from '../core/math';
import { Audio } from '../core/audio';
import type { Stats } from './upgrades';
import type { Expedition, Loot } from './expedition';
import { Zombie, Z_INFO } from './zombies';
import { type CrewMember, roleMul, GRAB_LINES } from './crew';
import { CEILING } from './level';
import { drawResIcon } from './resources';

export const S = 0.8; // world scale of the airship art

export interface Controls { x: number; y: number; drop: boolean; hook: boolean; shake: boolean; flame: boolean; boost: boolean; cycle: boolean; }
export type Weapon = 'bomb' | 'fire' | 'mine';

/** A crew member while airborne. */
export class CrewSlot {
  m: CrewMember; hp: number; max: number; ko = false; cd = rand(0, 1); flash = 0; pose: CrewDraw['pose'] = 'idle'; poseT = 0; aim = 0; isNew: boolean; kills = 0;
  constructor(m: CrewMember, bonusHp: number, isNew = false) { this.m = m; this.max = 3 + bonusHp; this.hp = this.max; this.isNew = isNew; }
  get up() { return !this.ko; }
  setPose(p: CrewDraw['pose'], t: number) { this.pose = p; this.poseT = t; }
}

export interface Hanger { z: Zombie; slot: number; grip: number; climb: number; gnaw: number; fuse: number; }
export interface Boarder { z: Zombie; x: number; atk: number; }

type Pt = { x: number; y: number; px: number; py: number };

export class Airship {
  x: number; y: number; vx = 0; vy = 0; heat = 0.3; fuel: number; maxFuel: number;
  hp: number; maxHp: number; env: number; maxEnv: number;
  stats: Stats; levels: Record<string, number>; decor: Record<string, string>; trophies: string[];
  g: Geom;
  crew: CrewSlot[] = [];
  hangers: Hanger[] = []; boarders: Boarder[] = [];
  facing = 1; tilt = 0; squash = 0; squashV = 0; wobble = 0; swing = 0; swingV = 0;
  invuln = 0; dead = false; deadT = 0; grounded = false; inflate = 0; launched = false;
  burnerOn = false; prevBurner = false; burnerVis = 0;
  // weapons & gadgets
  weapon: Weapon = 'bomb'; ammo: Record<Weapon, number>; reload: Record<Weapon, number> = { bomb: 0, fire: 0, mine: 0 }; dropCd = 0;
  shakeCd = 0; boostCd = 0; boosting = 0; flameCd = 0; flaming = 0; teslaT = 0;
  gunCd = 0; gunCd2 = 0; turretCd = 0; gunAim = 0.6; gunAim2 = 2.5; gunFlash = 0; gunFlash2 = 0; turretAim = Math.PI / 2; turretFlash = 0; pistolCd = 0;
  wig: number[] = []; lastWigSign = 0;
  // hook
  rope: Pt[] = []; ropeLen = 6; hookState: 'stowed' | 'out' | 'reel' = 'stowed'; cargoHook: Loot[] = []; grabT = 0; hookSpeed = 0;
  // ladder
  ladder = 0; ladderTarget = 0;
  // character
  expr: Expr = 'neutral'; exprT = 0; arm: ArmPose = 'rest'; armT = 0; blinkT = 2; blink = false; scarf: Pt[] = []; propSpin = 0; t = 0; lookX = 1; lookY = 0; zapT = 0;
  swatCd = 0; damageTaken = 0;

  constructor(x: number, y: number, stats: Stats, levels: Record<string, number>, decor: Record<string, string>, trophies: string[], crew: CrewMember[], hpBonus: number) {
    this.x = x; this.y = y; this.stats = stats; this.levels = levels; this.decor = decor; this.trophies = trophies;
    this.g = airshipGeom(stats.tier);
    const cook = crew.some((c) => c.role === 'cook');
    const chef = crew.some((c) => c.special === 'chef');
    const bonus = (cook ? 1 : 0) + (chef ? 1 : 0);
    this.crew = crew.map((m) => new CrewSlot(m, bonus));
    this.maxHp = Math.max(1, stats.hp + bonus + hpBonus); this.hp = this.maxHp;
    this.maxEnv = stats.envHp; this.env = this.maxEnv;
    this.maxFuel = stats.fuelCap; this.fuel = this.maxFuel;
    this.ammo = { bomb: stats.bombCap, fire: stats.fireCap, mine: stats.mineCap };
    const a = this.anchor();
    for (let i = 0; i < 10; i++) this.rope.push({ x: a.x, y: a.y + i, px: a.x, py: a.y + i });
    for (let i = 0; i < 7; i++) this.scarf.push({ x: x - i * 4, y: y - 27 * S, px: x - i * 4, py: y - 27 * S });
  }

  // ------------------------------------------------------------- geometry
  get basketY() { return this.y + this.g.bottom * S; }
  get halfW() { return (this.g.w / 2 + this.g.plat) * S; }
  get lift() { return this.g.lift + ([0.82, 1, 1.16, 1.32, 1.5][this.stats.envLevel] - 1) * 20; }
  envCircle(): [number, number, number] { const es = [0.82, 1, 1.16, 1.32, 1.5][this.stats.envLevel]; return [this.x, this.y + (MOUTH_Y - this.lift - 136 * es * 0.6) * S, 64 * es * S]; }
  anchor() { return { x: this.x, y: this.basketY }; }
  touchesHull(px: number, py: number, r = 0) { return px > this.x - this.halfW - r && px < this.x + this.halfW + r && py > this.y - 20 * S - r && py < this.basketY + r; }
  hitsEnvelope(px: number, py: number, r = 0) { const [cx, cy, cr] = this.envCircle(); return (px - cx) ** 2 + (py - cy) ** 2 < (cr + r) ** 2; }
  slotWorld(i: number) { const s = this.g.slots[i]; return { x: this.x + s.x * S, y: this.y + s.y * S }; }
  seatsFree() { return this.stats.seats - this.crew.length; }
  upCrew(role?: string) { return this.crew.filter((c) => c.up && (!role || c.m.role === role)); }
  crewMul(role: string) { return this.upCrew(role).reduce((m, c) => Math.max(m, roleMul(c.m)), 0); }
  hasSpecial(sp: string) { return this.upCrew().some((c) => c.m.special === sp); }
  weight() {
    const crewW = this.crew.length * 0.09;
    const hang = this.hangers.reduce((s, h) => s + Z_INFO[h.z.kind].weight, 0) + this.boarders.reduce((s, b) => s + Z_INFO[b.z.kind].weight * 0.8, 0);
    const cargo = this.cargoHook.reduce((s, c) => s + c.weight, 0);
    return this.stats.baseWeight + crewW + (hang + cargo) * (1 - this.stats.loadTol);
  }
  liftMul() { const eng = this.crewMul('engineer'); return this.stats.liftMul * (1 + (eng ? 0.05 + 0.03 * eng : 0)) * (this.hasSpecial('professor') ? 1.25 : 1); }

  setExpr(e: Expr, t = 1) { this.expr = e; this.exprT = t; }
  setArm(a: ArmPose, t = 0.35) { this.arm = a; this.armT = t; }

  // ------------------------------------------------------------- boarding
  attach(e: Expedition, z: Zombie) {
    if (this.dead || z.dead || z.attached) return;
    const used = new Set(this.hangers.map((h) => h.slot));
    let best = -1, bd = 1e9;
    this.g.slots.forEach((_, i) => { if (used.has(i)) return; const p = this.slotWorld(i); const d = (p.x - z.x) ** 2 + (p.y - z.y) ** 2; if (d < bd) { bd = d; best = i; } });
    if (best < 0) { // basket is fully mobbed: they climb straight onto the deck
      this.board(e, z); return;
    }
    z.state = 'hang'; z.sy = 0; z.bld = null; z.vx = 0; z.vy = 0;
    const plat = [1, 1.4, 1.8][this.stats.plating];
    this.hangers.push({ z, slot: best, grip: Z_INFO[z.kind].grip, climb: 0, gnaw: 0, fuse: z.kind === 'bloater' ? 6 : 0 });
    this.climbTime.set(z, Z_INFO[z.kind].climb * plat * rand(0.85, 1.15));
    this.wobble = Math.min(1, this.wobble + 0.25); this.swingV += (z.x < this.x ? -1 : 1) * 1.2; this.vy += 30;
    Audio.thump(); Audio.voice('yikes');
    e.onGrab(z);
    this.setExpr('panic', 0.8);
  }
  private climbTime = new Map<Zombie, number>();
  board(e: Expedition, z: Zombie) {
    z.state = 'board';
    const xs = [-this.g.w / 2 + 8, this.g.w / 2 - 8];
    this.boarders.push({ z, x: rand(xs[0], xs[1]), atk: 1.2 });
    e.onBoard(z);
  }
  detach(z: Zombie) {
    this.hangers = this.hangers.filter((h) => h.z !== z);
    this.boarders = this.boarders.filter((b) => b.z !== z);
    this.climbTime.delete(z);
  }
  /** Knock a hanger or boarder loose: it falls, flailing. */
  fling(e: Expedition, z: Zombie, power = 1) {
    const p = z.state === 'hang' ? this.slotWorld(this.hangers.find((h) => h.z === z)!.slot) : { x: this.x, y: this.y };
    this.detach(z);
    z.state = 'fall'; z.x = p.x; z.y = p.y + z.h; z.vx = (p.x - this.x) * 3 + rand(-60, 60) * power + this.vx * 0.5; z.vy = this.vy - rand(40, 140) * power; z.spinV = rand(-9, 9); z.stun = 0;
    e.fx.popup(p.x, p.y - 10, pick(['AAAH!', 'WHEEE!', 'BLAAH!', 'NOOO!', 'OOF!']), P.parchment, 13);
    Audio.boing();
  }

  shake(e: Expedition) {
    if (this.shakeCd > 0 || this.dead || !this.launched) return;
    this.shakeCd = this.stats.shakeCd;
    this.swingV += (this.swing >= 0 ? -1 : 1) * 9; this.wobble = 1; this.squashV += 4;
    Audio.boing(); Audio.clank();
    e.fx.shake = Math.max(e.fx.shake, 5);
    let n = 0;
    const power = this.stats.shakePower;
    for (const h of [...this.hangers]) {
      h.grip -= power * rand(0.8, 1.25);
      if (this.stats.tesla) h.z.hurt(e, 2, 0, 0, 'tesla');
      if (h.z.dead) { n++; continue; }
      if (h.grip <= 0) { this.fling(e, h.z, 1.2); n++; }
      else { h.z.flash = 0.2; e.fx.popup(this.slotWorld(h.slot).x, this.slotWorld(h.slot).y + 20, 'HNNG!', P.parchmentShade, 11); }
    }
    for (const b of [...this.boarders]) {
      if (this.stats.tesla) b.z.hurt(e, 1, 0, 0, 'tesla');
      if (!b.z.dead && b.z.kind !== 'brute' && Math.random() < 0.18) { this.fling(e, b.z, 1); n++; }
    }
    if (this.stats.tesla) { this.teslaT = 0.5; Audio.zap(); e.fx.sparks(this.x, this.basketY, 16); }
    for (const c of this.crew) if (c.up) c.setPose('cheer', 0.3);
    e.fx.burst(this.x + 60, this.y - 40, n > 1 ? `SHAKE x${n}!` : 'SHAKE!', 20, P.goldLight);
    e.onShake(n);
    this.setArm('cheer', 0.4); this.setExpr('determined', 0.6);
  }

  // ------------------------------------------------------------- update
  update(e: Expedition, c: Controls, dt: number) {
    this.t += dt;
    if (this.dead) { this.updateDead(e, dt); return; }
    if (!this.launched) {
      if (this.inflate === 0) Audio.ignite();
      this.inflate = Math.min(1, this.inflate + dt / 1.1);
      this.burnerVis = 1; Audio.burner(0.8); this.arm = 'burn'; this.expr = 'determined';
      this.wobble = (1 - this.inflate) * 0.8;
      if (this.inflate >= 1) { this.launched = true; this.vy = -80; this.heat = 0.55; this.squashV -= 4; Audio.voice('woo'); e.fx.burst(this.x + 40, this.y - 120, 'UP WE GO!', 22); this.setExpr('happy', 1); }
      this.updateAnim(e, c, dt);
      return;
    }
    const st = this.stats;
    for (const k of ['shakeCd', 'boostCd', 'flameCd', 'dropCd', 'invuln', 'teslaT', 'zapT', 'gunFlash', 'gunFlash2', 'turretFlash', 'swatCd'] as const) this[k] = Math.max(0, this[k] - dt);
    this.boosting = Math.max(0, this.boosting - dt);
    // wiggle the stick left-right to shake
    const sgn = c.x > 0.6 ? 1 : c.x < -0.6 ? -1 : 0;
    if (sgn && sgn !== this.lastWigSign) { this.wig.push(this.t); this.lastWigSign = sgn; }
    this.wig = this.wig.filter((t) => this.t - t < 0.75);
    if (this.wig.length >= 3 && this.hangers.length) { this.wig = []; c.shake = true; }
    if (c.shake) this.shake(e);
    // ---- burner / heat ----
    const wantUp = c.y < -0.25, wantDown = c.y > 0.35;
    const eng = this.crewMul('engineer');
    const fuelUse = st.fuelUse * (eng ? 1 - (0.12 + 0.04 * eng) : 1);
    this.burnerOn = wantUp && this.fuel > 0;
    if (this.burnerOn && !this.prevBurner) Audio.ignite();
    this.prevBurner = this.burnerOn;
    const upAmt = clamp(-c.y, 0, 1);
    if (this.burnerOn) { this.heat = Math.min(1, this.heat + 2.2 * st.burnerPower * upAmt * dt); this.fuel = Math.max(0, this.fuel - 2.2 * fuelUse * upAmt * dt); }
    else if (wantDown) this.heat = Math.max(0, this.heat - 1.4 * dt);
    else this.heat = lerp(this.heat, 0.3, 1 - Math.exp(-0.8 * dt));
    // pilot light keeps a little fuel ticking
    this.fuel = Math.max(0, this.fuel - 0.12 * fuelUse * dt);
    this.burnerVis = damp(this.burnerVis, this.burnerOn ? 1 : 0, 18, dt);
    Audio.burner(this.burnerVis * (0.7 + 0.3 * upAmt));
    // ---- forces ----
    const w = this.weight();
    const lm = this.liftMul();
    let ay = 150 * w - 330 * this.heat * lm;
    if (this.burnerOn) ay -= 80 * st.burnerPower * upAmt * lm;
    if (wantDown) ay += 120 * clamp(c.y, 0, 1);
    if (this.fuel <= 0) ay += 40;
    const prop = 220 * st.propSpeed / Math.sqrt(w);
    let ax = c.x * prop;
    if (Math.abs(c.x) > 0.2) this.facing = c.x > 0 ? 1 : -1;
    // boost
    if (c.boost && st.boost > 0 && this.boostCd <= 0 && this.fuel > 6) {
      this.boosting = 0.6; this.boostCd = st.boost >= 2 ? 5 : 9; this.vy = Math.min(this.vy, 0) - 380; this.fuel -= 6;
      Audio.boost(); e.fx.puff(this.x, this.basketY + 10, 8, P.smokeLight, 12); this.squashV -= 4; this.setExpr('determined', 1);
      for (const h of [...this.hangers]) { h.grip -= st.boost >= 2 ? 160 : 70; if (h.grip <= 0) this.fling(e, h.z, 1.4); }
      e.fx.burst(this.x, this.y - 60, 'AFTERBURNER!', 20, P.orangeLight);
    }
    // flamethrower
    if (c.flame && st.flamer > 0 && this.flameCd <= 0 && this.fuel > 4) {
      this.flaming = st.flamer >= 2 ? 1.3 : 1; this.flameCd = st.flamer >= 2 ? 4.5 : 7; this.fuel -= 4;
      Audio.boost(); Audio.sizzle(); e.fx.burst(this.x, this.basketY + 60, 'FWOOSH!', 22, P.flame2);
    }
    if (this.flaming > 0) { this.flaming = Math.max(0, this.flaming - dt); e.flameTick(dt); }
    this.vy += ay * dt; this.vx += ax * dt;
    this.vx *= Math.exp(-(this.boosting > 0 ? 0.5 : 1.3) * dt); this.vy *= Math.exp(-1.4 * dt);
    this.vy = clamp(this.vy, -300, 280);
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.y < CEILING - 60) this.vy += (CEILING - 60 - this.y) * 6 * dt;
    if (this.x < 60) { this.x = 60; this.vx = Math.abs(this.vx) * 0.3; }
    if (this.x > e.length - 60) { this.x = e.length - 60; this.vx = -Math.abs(this.vx) * 0.3; }
    this.collideWorld(e, dt);
    this.updateHangers(e, dt);
    this.updateBoarders(e, dt);
    this.updateCrew(e, dt);
    this.updateWeapons(e, c, dt);
    this.updateHook(e, c, dt);
    this.updateLadder(e, dt);
    this.updateAnim(e, c, dt);
  }

  private collideWorld(e: Expedition, dt: number) {
    this.grounded = false;
    const hw = this.halfW;
    for (const b of e.terrain.buildings) {
      if (this.x + hw < b.x || this.x - hw > b.x + b.w) continue;
      // basket vs roof / walls
      if (this.basketY > b.top && this.y - 20 * S < b.top + b.h) {
        const overTop = this.basketY - b.top;
        const left = this.x + hw - b.x, right = b.x + b.w - (this.x - hw);
        if (overTop < Math.min(left, right) + 2 || this.vy > 0 && overTop < 24) {
          this.y -= overTop;
          if (this.vy > 0) { if (this.vy > 120) { Audio.thump(); e.fx.dust(this.x, b.top, 5); this.squashV += this.vy / 70; } if (this.vy > 260) this.hurtEnv(e, 1, 'crash'); this.vy = -this.vy * 0.2; }
          this.grounded = true; this.vx *= Math.exp(-3 * dt);
        } else if (left < right) { this.x -= left; if (this.vx > 0) { if (this.vx > 180) this.hurtEnv(e, 1, 'crash'); this.vx = -this.vx * 0.3; Audio.boing(); } }
        else { this.x += right; if (this.vx < 0) { if (this.vx < -180) this.hurtEnv(e, 1, 'crash'); this.vx = -this.vx * 0.3; Audio.boing(); } }
      }
      // envelope bumping into a taller building side
      const [cx, cy, cr] = this.envCircle();
      if (cy + cr > b.top && cx + cr > b.x && cx - cr < b.x + b.w) {
        const nx = clamp(cx, b.x, b.x + b.w), ny = clamp(cy, b.top, b.top + b.h); const dx = cx - nx, dy = cy - ny; const d = Math.hypot(dx, dy);
        if (d < cr && d > 0.01) { this.x += (dx / d) * (cr - d); this.y += (dy / d) * (cr - d); const vn = this.vx * dx / d + this.vy * dy / d; if (vn < 0) { this.vx -= vn * dx / d * 1.4; this.vy -= vn * dy / d * 1.4; this.wobble = Math.min(1, this.wobble + 0.3); } }
      }
    }
    const gy = e.terrain.groundY(this.x);
    if (this.basketY > gy) {
      this.y -= this.basketY - gy;
      if (this.vy > 0) { if (this.vy > 120) { Audio.thump(); e.fx.dust(this.x, gy, 6); } if (this.vy > 260) this.hurtEnv(e, 1, 'crash'); this.vy = -this.vy * 0.2; }
      this.vx *= Math.exp(-3 * dt); this.grounded = true;
    }
  }

  private updateHangers(e: Expedition, dt: number) {
    const st = this.stats;
    const alt = e.altitude();
    for (const h of [...this.hangers]) {
      const z = h.z; z.t += dt; z.flash = Math.max(0, z.flash - dt);
      const p = this.slotWorld(h.slot); z.x = p.x; z.y = p.y + z.h;
      if (z.burn > 0) { z.burn -= dt; if (Math.floor(z.t * 2) !== Math.floor((z.t - dt) * 2)) z.hurt(e, 1, 0, 0, 'fire'); if (z.dead) continue; }
      // wind shear at altitude & during fast climbs loosens their grip
      if (alt > 250) h.grip -= 16 * dt;
      if (this.vy < -110) h.grip -= 28 * dt;
      if (st.spikes) { h.grip -= 8 * dt; h.gnaw += dt; if (h.gnaw > 2) { h.gnaw = 0; z.hurt(e, 1, 0, 0, 'spikes'); if (z.dead) continue; } }
      if (h.grip <= 0) { this.fling(e, z, 0.8); continue; }
      if (z.kind === 'bloater') {
        h.fuse -= dt;
        if (h.fuse < 2 && Math.floor(h.fuse * 6) % 2 === 0) z.flash = 0.1;
        if (h.fuse <= 0) { z.die(e, 0, 0, 'burst'); continue; }
        continue;
      }
      if (z.kind === 'brute') {
        h.gnaw += dt;
        if (h.gnaw > 2.2) { h.gnaw = 0; this.swingV += 3; e.fx.shake = Math.max(e.fx.shake, 4); if (Math.random() < (st.plating >= 2 ? 0.5 : 1)) this.hitSomeone(e, 1, 'brute'); Audio.clank(); }
      }
      const ct = this.climbTime.get(z) ?? 4;
      h.climb += dt / ct;
      if (h.climb >= 1) { this.hangers = this.hangers.filter((q) => q !== h); this.board(e, z); }
    }
  }

  private updateBoarders(e: Expedition, dt: number) {
    for (const b of [...this.boarders]) {
      const z = b.z; z.t += dt; z.flash = Math.max(0, z.flash - dt);
      z.x = this.x + b.x * S; z.y = this.y;
      b.atk -= dt;
      if (b.atk <= 0) {
        b.atk = z.kind === 'brute' ? 1.4 : 1.9;
        if (this.stats.floor >= 2 && Math.random() < 0.3) { e.fx.popup(z.x, z.y - 30, 'BLOCKED!', P.steelLight, 12); continue; }
        this.hitSomeone(e, 1, z.kind);
      }
    }
    // Jerry swats boarders with his trusty frying pan
    if (this.boarders.length && this.swatCd <= 0) {
      this.swatCd = 1.3;
      const b = this.boarders[0];
      this.setArm('throw', 0.3); Audio.clank();
      e.fx.popup(this.x, this.y - 40, pick(['BONK!', 'CLANG!', 'WHAP!']), P.goldLight, 14);
      b.z.hurt(e, 1, 0, 0, 'jerry');
      if (!b.z.dead && Math.random() < 0.25 && b.z.kind !== 'brute') this.fling(e, b.z, 1);
    }
  }

  /** A boarder or brute lands a blow: crew first, Jerry if nobody else. */
  hitSomeone(e: Expedition, dmg: number, src: string) {
    const targets = this.crew.filter((c) => c.up);
    if (targets.length && Math.random() < 0.65) {
      const c = pick(targets); c.hp -= dmg; c.flash = 0.6; Audio.hurt();
      e.fx.popup(this.x, this.y - 50, `${c.m.name.split(' ')[0]} hit!`, P.redBright, 13);
      if (c.hp <= 0) { c.ko = true; c.hp = 0; c.setPose('ko', 99); e.banner(`${c.m.name.split(' ')[0].toUpperCase()} IS DOWN!`, 'A medic can patch them up', P.redBright); }
    } else this.hurtJerry(e, dmg, src);
  }
  hurtJerry(e: Expedition, dmg: number, src: string) {
    if (this.invuln > 0 || this.dead) return;
    this.hp -= dmg; this.invuln = 1.2; this.damageTaken += dmg;
    this.wobble = 1; e.fx.shake = Math.max(e.fx.shake, 8); e.fx.flash = 0.3;
    Audio.hurt(); Audio.voice(this.hp <= 1 ? 'yikes' : 'ugh'); this.setExpr('hurt', 0.9);
    buzz(60);
    if (this.hp <= 0) this.crash(e, src === 'crash' ? 'crash' : 'overrun');
  }
  hurtEnv(e: Expedition, dmg: number, src: string) {
    if (this.dead) return;
    const d = src === 'crash' ? dmg : dmg * (1 - this.stats.envResist);
    this.env -= d; this.wobble = Math.min(1, this.wobble + 0.5); e.fx.puff(this.x, this.envCircle()[1], 4, P.parchment, 7);
    Audio.puff(); if (src !== 'crash') e.fx.popup(this.x + 30, this.envCircle()[1], 'HSSSS!', P.oliveLight, 14);
    if (this.env <= 0) { this.env = 0; this.crash(e, 'envelope'); }
  }
  crash(e: Expedition, why: string) {
    if (this.dead) return;
    this.dead = true; this.deadT = 0; this.setExpr('panic', 99); Audio.sadTrombone();
    e.onCrash(why);
  }

  private updateCrew(e: Expedition, dt: number) {
    const medic = this.upCrew('medic');
    for (const c of this.crew) {
      c.flash = Math.max(0, c.flash - dt); c.poseT -= dt;
      if (c.poseT <= 0 && !c.ko) c.pose = this.boarders.length ? 'fight' : 'idle';
      if (c.ko) { c.pose = 'ko'; continue; }
      c.cd -= dt;
      const mul = roleMul(c.m);
      switch (c.m.role) {
        case 'mechanic':
          if (this.env < this.maxEnv && c.cd <= 0) { c.cd = 5 / mul / (c.m.special === 'wrench' ? 2 : 1); this.env = Math.min(this.maxEnv, this.env + 1); c.setPose('work', 0.8); e.fx.popup(this.x - 30, this.envCircle()[1] + 20, '+PATCH', P.tealLight, 12); Audio.ratchet(); }
          break;
        case 'medic':
          if (c.cd <= 0) {
            const hurt = this.crew.find((o) => o !== c && (o.ko && c.m.special === 'revive' || (!o.ko && o.hp < o.max)));
            if (hurt) { c.cd = 7 / mul; if (hurt.ko) { hurt.ko = false; hurt.hp = 1; e.fx.popup(this.x, this.y - 50, 'BACK ON YOUR FEET!', P.tealLight, 12); } else hurt.hp++; c.setPose('work', 0.6); Audio.pickup('meds'); }
            else if (this.hp < this.maxHp) { c.cd = 12 / mul; this.hp++; e.fx.popup(this.x, this.y - 60, '+1 JERRY', P.tealLight, 13); c.setPose('work', 0.6); Audio.pickup('meds'); }
          }
          break;
        case 'gunner':
          if (st_gun(this) === 0 && c.cd <= 0) {
            const tgt = e.pickTarget(220, true);
            if (tgt) {
              c.cd = 1.5 / mul; c.aim = Math.atan2(tgt.y - this.y, (tgt.x - this.x) * this.facing); c.setPose('shoot', 0.35);
              e.shoot(this.x, this.y - 20 * S, tgt, 1, c);
              if (c.m.special === 'boomstick') { const t2 = e.pickTarget(220, true, tgt); if (t2) e.shoot(this.x, this.y - 20 * S, t2, 1, c); }
            }
          }
          if (c.m.special === 'strongman' && this.boarders.length && c.cd <= 0) { c.cd = 2.5 / mul; c.setPose('fight', 0.5); this.fling(e, this.boarders[0].z, 1.5); e.fx.burst(this.x, this.y - 50, 'HEAVE-HO!', 16); }
          break;
      }
      // everyone brawls when the dead climb aboard
      if (this.boarders.length && c.cd <= 0) {
        c.cd = c.m.role === 'gunner' ? 1.1 : 1.7;
        const b = this.boarders[Math.floor(Math.random() * this.boarders.length)];
        b.z.hurt(e, c.m.role === 'gunner' ? 2 : 1, 0, 0, 'crew'); c.setPose('fight', 0.5);
        if (b.z.dead) { c.kills++; e.fx.popup(this.x, this.y - 30, pick(GRAB_LINES), P.parchment, 12); }
      }
    }
    void medic;
  }

  private updateWeapons(e: Expedition, c: Controls, dt: number) {
    const st = this.stats;
    const caps: Record<Weapon, number> = { bomb: st.bombCap, fire: st.fireCap, mine: st.mineCap };
    const times: Record<Weapon, number> = { bomb: st.bombReload, fire: 6, mine: 8 };
    for (const w of ['bomb', 'fire', 'mine'] as Weapon[]) {
      if (this.ammo[w] < caps[w]) { this.reload[w] += dt; if (this.reload[w] >= times[w]) { this.reload[w] = 0; this.ammo[w]++; if (w === this.weapon) Audio.ratchet(); } } else this.reload[w] = 0;
    }
    if (c.cycle) {
      const order: Weapon[] = (['bomb', 'fire', 'mine'] as Weapon[]).filter((w) => caps[w] > 0);
      this.weapon = order[(order.indexOf(this.weapon) + 1) % order.length]; Audio.click();
    }
    if (caps[this.weapon] <= 0) this.weapon = 'bomb';
    if (c.drop && this.dropCd <= 0) {
      if (this.ammo[this.weapon] > 0) {
        this.ammo[this.weapon]--; this.dropCd = 0.25;
        e.drop(this.weapon, this.x + this.facing * 6, this.basketY + 6, this.vx * 0.9, Math.max(this.vy, 0) + 30);
        this.setArm('throw', 0.3); Audio.bombDrop(); this.squashV += 1.2;
      } else { Audio.deny(); e.fx.popup(this.x, this.y - 70, 'RE-ARMING…', P.parchment, 14); this.dropCd = 0.4; }
    }
    // mounted guns
    const gunner = this.crewMul('gunner');
    if (st.gun > 0) {
      const rate = [0, 0.45, 0.3, 0.3][st.gun] * (gunner ? 0.62 / (1 + 0.1 * (gunner - 1)) : 1);
      const range = [0, 260, 320, 340][st.gun];
      this.gunCd -= dt; this.gunCd2 -= dt;
      if (this.gunCd <= 0) {
        const tgt = e.pickTarget(range, false, undefined, st.gun >= 3 ? 1 : 0);
        if (tgt) { this.gunCd = rate; this.gunAim = Math.atan2(tgt.y - (this.y - 6 * S), tgt.x - (this.x + this.g.w / 2 * S)) * 1; e.shoot(this.x + (this.g.w / 2 - 8) * S, this.y - 6 * S, tgt, 1, this.upCrew('gunner')[0]); this.gunFlash = 0.06; Audio.tone?.(180, 0.05, { type: 'square', gain: 0.06, filter: 1600 }); }
      }
      if (st.gun >= 3 && this.gunCd2 <= 0) {
        const tgt = e.pickTarget(range, false, undefined, -1);
        if (tgt) { this.gunCd2 = rate; this.gunAim2 = Math.atan2(tgt.y - (this.y - 6 * S), tgt.x - (this.x - this.g.w / 2 * S)); e.shoot(this.x - (this.g.w / 2 - 8) * S, this.y - 6 * S, tgt, 1, this.upCrew('gunner')[0]); this.gunFlash2 = 0.06; }
      }
    }
    if (st.turret) {
      this.turretCd -= dt;
      if (this.turretCd <= 0) {
        const tgt = e.pickTarget(250, false, undefined, 0, true);
        if (tgt) { this.turretCd = 0.38; this.turretAim = Math.atan2(tgt.y - this.basketY, tgt.x - this.x); e.shoot(this.x, this.basketY + 4, tgt, 1); this.turretFlash = 0.06; }
      }
    }
  }

  private updateHook(e: Expedition, c: Controls, dt: number) {
    const st = this.stats;
    const scav = this.crewMul('scavenger');
    const winch = st.winch * (scav ? 1.2 : 1);
    if (c.hook) {
      if (this.hookState === 'stowed') { this.hookState = 'out'; Audio.hookOut(); this.grabT = 0; }
      else this.hookState = 'reel';
    }
    const cw = this.cargoHook.reduce((s, it) => s + it.weight, 0);
    if (this.hookState === 'out') {
      this.ropeLen = Math.min(st.ropeLen, this.ropeLen + 300 * winch * dt);
      if (this.cargoHook.length) { this.grabT += dt; if (this.cargoHook.length >= st.cargoCap || this.grabT > 1.2) this.hookState = 'reel'; }
      if (Math.random() < 0.4 && this.ropeLen < st.ropeLen) Audio.ratchet();
    } else if (this.hookState === 'reel') {
      this.ropeLen = Math.max(6, this.ropeLen - (200 * winch) / (1 + cw * 0.6) * dt);
      if (Math.random() < 0.5) Audio.ratchet();
      this.setArm('crank', 0.15);
      if (this.ropeLen <= 6) { this.hookState = 'stowed'; for (const it of this.cargoHook) e.collect(it); this.cargoHook = []; }
    }
    const N = this.rope.length, a = this.anchor(), seg = this.ropeLen / (N - 1), endMass = 1 + cw * 2;
    for (let i = 1; i < N; i++) { const p = this.rope[i]; const vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985; p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + 900 * dt * dt; }
    for (let it = 0; it < 8; it++) {
      this.rope[0].x = a.x; this.rope[0].y = a.y;
      for (let i = 0; i < N - 1; i++) {
        const p = this.rope[i], q = this.rope[i + 1];
        const dx = q.x - p.x, dy = q.y - p.y; const d = Math.hypot(dx, dy) || 0.001; const diff = (d - seg) / d;
        const wp = i === 0 ? 0 : 1, wq = i + 1 === N - 1 ? 1 / endMass : 1, sum = wp + wq;
        p.x += dx * diff * (wp / sum); p.y += dy * diff * (wp / sum); q.x -= dx * diff * (wq / sum); q.y -= dy * diff * (wq / sum);
      }
      for (let i = 1; i < N; i++) { const p = this.rope[i]; const sy = e.terrain.surfaceY(p.x) - 3; if (p.y > sy) { p.y = sy; p.px = lerp(p.px, p.x, 0.3); if (i === N - 1) p.x += (a.x - p.x) * 0.04; } }
    }
    const end = this.rope[N - 1];
    this.hookSpeed = Math.hypot(end.x - end.px, end.y - end.py) / dt;
    this.cargoHook.forEach((it, i) => { it.x = end.x; it.y = end.y + it.r + 4 + i * 12; });
    if (this.hookState !== 'stowed' && this.ropeLen > 20 && this.cargoHook.length < st.cargoCap) {
      const magR = st.magnet ? 90 : 46;
      for (const it of e.loot) {
        if (it.dead || it.hooked) continue;
        const d = dist(end.x, end.y, it.x, it.y);
        if (d < magR && d > 4) { const k = (1 - d / magR) * (st.magnet ? 240 : 120) * dt; it.x += ((end.x - it.x) / d) * k; it.y += ((end.y - it.y) / d) * k; }
        if (d < it.r + 24) {
          it.hooked = true; this.cargoHook.push(it); this.grabT = 0; Audio.grab(); e.fx.popup(it.x, it.y - 20, 'HOOKED!', P.parchment, 13);
          if (this.cargoHook.length >= st.cargoCap) { this.hookState = 'reel'; break; }
        }
      }
    }
    // swing the hook into zombies' heads
    if (this.hookState !== 'stowed' && this.ropeLen > 30 && this.hookSpeed > 150) {
      for (const z of e.zombies) { if (z.dead || z.attached || z.flash > 0) continue; if (dist(end.x, end.y, z.x, z.y - z.h * 0.7) < 16) { z.hurt(e, 1, (end.x - end.px) * 20, -150, 'hook'); e.fx.sparks(end.x, end.y, 6, P.gold); Audio.clank(); } }
    }
  }

  private updateLadder(e: Expedition, dt: number) {
    this.ladder = damp(this.ladder, this.ladderTarget, 8, dt);
    this.ladderTarget = 0;
    void e;
  }

  private updateAnim(e: Expedition, c: Controls, dt: number) {
    this.squashV += (-this.squash * 90 - this.squashV * 9) * dt; this.squash += this.squashV * dt * 0.08; this.squash = clamp(this.squash, -0.3, 0.3);
    this.swingV += (-this.swing * 40 - this.swingV * 4) * dt - this.vx * 0.0002; this.swing += this.swingV * dt * 0.1; this.swing = clamp(this.swing, -0.35, 0.35);
    this.wobble = Math.max(0, this.wobble - dt * 1.2);
    this.tilt = damp(this.tilt, clamp(this.vx * 0.0009, -0.18, 0.18), 6, dt) ;
    this.propSpin += dt * (8 + Math.abs(c.x) * 30);
    this.exprT -= dt; this.armT -= dt;
    this.blinkT -= dt; if (this.blinkT < 0) { this.blink = !this.blink; this.blinkT = this.blink ? 0.12 : rand(1.5, 4); }
    if (this.exprT <= 0) this.expr = this.hp <= 1 || this.hangers.length >= 3 || this.boarders.length ? 'panic' : this.hangers.length || e.altitude() < 70 ? 'determined' : 'neutral';
    if (this.armT <= 0) this.arm = this.burnerOn ? 'burn' : this.hookState === 'reel' ? 'crank' : 'rest';
    const n = { x: this.x + 2 * this.facing * S, y: this.y - 27 * S };
    for (let i = 1; i < this.scarf.length; i++) {
      const p = this.scarf[i]; const vx = (p.x - p.px) * 0.9, vy = (p.y - p.py) * 0.9; p.px = p.x; p.py = p.y;
      p.x += vx + (-this.vx * 0.9 - this.facing * 40) * dt * dt * 30 + Math.sin(this.t * 9 + i) * 0.25;
      p.y += vy + (60 - this.vy * 0.6) * dt * dt * 10;
    }
    for (let it = 0; it < 4; it++) {
      this.scarf[0].x = n.x; this.scarf[0].y = n.y;
      for (let i = 0; i < this.scarf.length - 1; i++) { const p = this.scarf[i], q = this.scarf[i + 1]; const dx = q.x - p.x, dy = q.y - p.y; const d = Math.hypot(dx, dy) || 0.001; const diff = (d - 4.2 * S) / d; if (i === 0) { q.x -= dx * diff; q.y -= dy * diff; } else { p.x += dx * diff * 0.5; p.y += dy * diff * 0.5; q.x -= dx * diff * 0.5; q.y -= dy * diff * 0.5; } }
    }
  }

  private updateDead(e: Expedition, dt: number) {
    this.deadT += dt;
    this.inflate = Math.max(0.3, this.inflate - dt * 0.5);
    this.vy = Math.min(this.vy + 300 * dt, 240); this.vx *= Math.exp(-dt);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.tilt = clamp(this.tilt + dt * this.facing, -0.5, 0.5);
    if (Math.random() < 0.5) e.fx.puff(this.x, this.y - 60, 1, P.smoke, 8);
    Audio.burner(0);
    const gy = e.terrain.surfaceY(this.x);
    if (this.basketY > gy) { this.y -= this.basketY - gy; this.vy = 0; this.vx = 0; }
  }

  draw(ctx: CanvasRenderingContext2D, e: Expedition) {
    // hook rope
    const N = this.rope.length;
    if (this.ropeLen > 8) {
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(this.rope[0].x, this.rope[0].y); for (let i = 1; i < N; i++) ctx.lineTo(this.rope[i].x, this.rope[i].y); ctx.stroke();
      ctx.strokeStyle = P.parchmentShade; ctx.lineWidth = 0.9; ctx.stroke();
      for (const it of this.cargoHook) { ctx.save(); ctx.translate(it.x, it.y); drawResIcon(ctx, it.kind, it.r, e.time); ctx.restore(); }
      const end = this.rope[N - 1], prev = this.rope[N - 2];
      ctx.save(); ctx.translate(end.x, end.y); ctx.rotate(Math.atan2(end.y - prev.y, end.x - prev.x) - Math.PI / 2);
      pen.use(ctx, 0.4).begin().m(0, 0).l(0, 9).q(0, 15, 5, 14).q(9, 12, 8, 8).stroke(4, P.ink); pen.begin().m(0, 0).l(0, 9).q(0, 15, 5, 14).q(9, 12, 8, 8).stroke(2, P.steelLight);
      ctx.restore();
    }
    ctx.save(); ctx.translate(this.x, this.y); ctx.scale(S, S);
    const n = { x: this.x + 2 * this.facing * S, y: this.y - 27 * S };
    const scarf = this.scarf.map((p) => [((p.x - n.x) / S + 2 * this.facing) * this.facing, (p.y - n.y) / S - 27]);
    drawAirship(ctx, airshipLook({
      t: this.t, facing: this.facing, tilt: this.tilt + this.swing * 0.4, swing: this.swing, squash: this.squash, wobble: this.wobble, burner: this.burnerVis, inflate: this.inflate,
      levels: this.levels, decor: this.decor, trophies: this.trophies, envDamage: 1 - this.env / this.maxEnv, hullDamage: 1 - this.hp / this.maxHp, flash: this.invuln > 0 && Math.floor(this.t * 14) % 2 === 0 && !this.dead,
      expr: this.zapT > 0 ? 'zapped' : this.expr, arm: this.arm, lookX: this.lookX, lookY: this.lookY, blink: this.blink, scarf, goggleDown: this.boosting > 0 || this.expr === 'determined', zap: this.zapT, dizzy: this.dead,
      crew: this.crew.map((c) => ({ look: c.m.look, role: c.m.role, pose: c.pose, hp: c.hp / c.max, aim: c.aim, flash: c.flash })),
      hangers: this.hangers.map((h) => ({ slot: h.slot, kind: h.z.kind, t: h.z.t, seed: h.z.seed, burn: h.z.burn, flash: h.z.flash > 0, climb: h.climb })),
      boarders: this.boarders.map((b) => ({ x: b.x, kind: b.z.kind, t: b.z.t, seed: b.z.seed, flash: b.z.flash > 0, facing: b.x > 0 ? -1 : 1 })),
      gunAim: this.gunAim, gunAim2: this.gunAim2, gunFlash: this.gunFlash, gunFlash2: this.gunFlash2, turretAim: this.turretAim, turretFlash: this.turretFlash,
      flaming: this.flaming, teslaT: this.teslaT, ladder: this.ladder / S, propSpin: this.propSpin, boosting: this.boosting, bombs: this.ammo.bomb, bombCap: this.stats.bombCap,
    }));
    ctx.restore();
    // grip meters over hangers
    for (const h of this.hangers) {
      const p = this.slotWorld(h.slot);
      const k = clamp(h.grip / Z_INFO[h.z.kind].grip, 0, 1);
      ctx.fillStyle = 'rgba(42,26,20,0.6)'; ctx.fillRect(p.x - 9, p.y + h.z.h + 6, 18, 4);
      ctx.fillStyle = h.z.kind === 'bloater' ? P.oliveLight : k > 0.5 ? P.redBright : P.gold; ctx.fillRect(p.x - 8, p.y + h.z.h + 7, 16 * (h.z.kind === 'bloater' ? clamp(h.fuse / 6, 0, 1) : k), 2);
      if (h.climb > 0.6 && h.z.kind !== 'bloater') { ctx.fillStyle = Math.sin(this.t * 14) > 0 ? P.redBright : P.gold; ctx.font = '12px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.fillText('!', p.x, p.y - 6); }
    }
  }
}

const st_gun = (s: Airship) => s.stats.gun;
