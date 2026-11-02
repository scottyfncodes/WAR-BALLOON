import { P } from '../render/palette';
import { pen } from '../render/ink';
import { drawBalloon, type Expr, type ArmPose } from '../render/balloonArt';
import { clamp, dist, lerp, rand, damp } from '../core/math';
import { Audio } from '../core/audio';
import type { Stats } from './upgrades';
import type { World } from './world';
import { Item, ITEM_INFO } from './entities';
import { CEILING } from './level';

export const BAL_SCALE = 0.56;

export interface Controls { x: number; y: number; bomb: boolean; hook: boolean; boost: boolean; }

type Pt = { x: number; y: number; px: number; py: number };

export class Player {
  x: number; y: number; vx = 0; vy = 0;
  heat = 0.25; fuel: number; hp: number;
  stats: Stats; levels: Record<string, number>; paint: string;
  facing = 1; tilt = 0; squash = 0; squashV = 0; wobble = 0;
  invuln = 0; dead = false; deadT = 0; grounded = false; groundT = 0;
  bombs: number; reload = 0; bombCd = 0; bombQueued = false;
  boostCd = 0; boosting = 0;
  buoyUsed = false; patchT = 0;
  // power-ups
  clusterT = 0; hotairT = 0; shield = false;
  // hook
  rope: Pt[] = []; ropeLen = 6; hookState: 'stowed' | 'out' | 'reel' = 'stowed'; cargo: Item[] = []; grabT = 0; hookSpeed = 0;
  // character
  expr: Expr = 'neutral'; exprT = 0; arm: ArmPose = 'rest'; armT = 0; blinkT = 2; blink = false;
  scarf: Pt[] = []; propSpin = 0; burnerVis = 0; zapT = 0; t = 0;
  damageTaken = 0; lastHitBy = '';
  burnerOn = false; prevBurner = false;
  lookX = 1; lookY = 0;
  inflate = 0; launched = false; ice = 0; soakT = 0; inWater = false;

  constructor(x: number, y: number, stats: Stats, levels: Record<string, number>, paint: string, extraFuel = 0, extraHp = 0) {
    this.x = x; this.y = y; this.stats = stats; this.levels = levels; this.paint = paint;
    this.fuel = Math.min(stats.fuelCap + extraFuel, stats.fuelCap + extraFuel);
    this.maxFuel = stats.fuelCap + extraFuel;
    this.hp = Math.max(2, stats.maxHp + extraHp); this.maxHp = this.hp;
    this.bombs = stats.bombCap;
    const ax = this.anchor();
    for (let i = 0; i < 10; i++) this.rope.push({ x: ax.x, y: ax.y + i, px: ax.x, py: ax.y + i });
    const n = this.neck();
    for (let i = 0; i < 7; i++) this.scarf.push({ x: n.x - i * 4, y: n.y, px: n.x - i * 4, py: n.y });
  }
  maxFuel: number; maxHp: number;

  anchor() { return { x: this.x, y: this.y + 20 * BAL_SCALE * 1.7 }; }
  neck() { return { x: this.x + 2 * this.facing * BAL_SCALE, y: this.y - 27 * BAL_SCALE }; }
  /** Collision circles [x,y,r]: envelope + basket. */
  circles(): [number, number, number][] {
    const s = 1 + 0.08 * (this.levels.lift ?? 0);
    return [[this.x, this.y - 160 * BAL_SCALE * s, 38 * s], [this.x, this.y + 8, 16]];
  }
  hitTest(x: number, y: number, r: number) { return this.circles().some(([cx, cy, cr]) => (cx - x) ** 2 + (cy - y) ** 2 < (cr + r) ** 2); }
  cargoWeight() { return this.cargo.reduce((s, c) => s + c.weight, 0); }

  setExpr(e: Expr, t = 1) { this.expr = e; this.exprT = t; }
  setArm(a: ArmPose, t = 0.35) { this.arm = a; this.armT = t; }

  update(w: World, c: Controls, dt: number) {
    this.t += dt;
    const st = this.stats;
    if (this.dead) { this.updateDead(w, dt); return; }
    if (!this.launched) {
      // inflation / take-off moment: burner roars, the bag swells, then a little hop
      if (this.inflate === 0) Audio.ignite();
      this.inflate = Math.min(1, this.inflate + dt / 1.1);
      this.burnerVis = 1; Audio.burner(0.8); this.arm = 'burn'; this.expr = 'determined';
      this.wobble = (1 - this.inflate) * 0.8;
      if (Math.random() < 0.3) w.fx.puff(this.x + (Math.random() - 0.5) * 30, this.y - 40, 1, P.parchment, 6);
      if (this.inflate >= 1) {
        this.launched = true; this.vy = -70; this.heat = 0.5; this.squashV -= 4;
        Audio.voice('woo'); w.fx.burst(this.x + 40, this.y - 170, 'UP WE GO!', 22); w.fx.dust(this.x, this.y + 20, 8);
        this.setExpr('happy', 1);
      }
      this.updateAnim(w, { x: 0, y: 0, bomb: false, hook: false, boost: false }, dt);
      return;
    }
    // ---------- timers ----------
    this.invuln = Math.max(0, this.invuln - dt);
    this.bombCd = Math.max(0, this.bombCd - dt);
    this.boostCd = Math.max(0, this.boostCd - dt);
    this.boosting = Math.max(0, this.boosting - dt);
    this.clusterT = Math.max(0, this.clusterT - dt);
    this.hotairT = Math.max(0, this.hotairT - dt);
    this.zapT = Math.max(0, this.zapT - dt);
    // ---------- burner / heat ----------
    const wantUp = c.y < -0.25, wantDown = c.y > 0.35;
    const hasFuel = this.fuel > 0 || this.hotairT > 0;
    this.burnerOn = wantUp && hasFuel;
    if (this.burnerOn && !this.prevBurner) Audio.ignite();
    this.prevBurner = this.burnerOn;
    const upAmt = clamp(-c.y, 0, 1);
    if (this.burnerOn) {
      this.heat = Math.min(1, this.heat + 2.4 * st.burnerPower * upAmt * dt);
      if (this.hotairT <= 0) this.fuel = Math.max(0, this.fuel - 3.4 * st.burnerEfficiency * upAmt * dt);
    } else if (wantDown) this.heat = Math.max(0, this.heat - 1.4 * dt);
    else this.heat = lerp(this.heat, 0.22, 1 - Math.exp(-0.9 * dt));
    this.burnerVis = damp(this.burnerVis, this.burnerOn ? 1 : 0, 18, dt);
    Audio.burner(this.burnerVis * (0.7 + 0.3 * upAmt));
    // ---------- icing (Frozen Reach) ----------
    const iceAlt = w.terrain.biome.iceAlt;
    if (iceAlt !== undefined && this.y < iceAlt && !st.heater) {
      const before = this.ice;
      this.ice = Math.min(1, this.ice + dt * 0.22);
      if (before < 0.5 && this.ice >= 0.5) { w.fx.popup(this.x, this.y - 160, 'ICING UP!', P.tealLight, 18); Audio.voice('huh'); }
    } else this.ice = Math.max(0, this.ice - dt * (this.burnerOn ? 0.5 : 0.25));
    // ---------- forces ----------
    const cw = this.cargoWeight();
    const weight = 1 + (cw * 0.45) / (1 + st.cargoTolerance * 0.6) + this.ice * 0.9;
    let ay = 120 * weight - 360 * this.heat * st.liftMul;
    if (this.burnerOn) ay -= 70 * st.burnerPower * upAmt;
    if (wantDown) ay += 110 * clamp(c.y, 0, 1);
    const prop = 250 * st.propSpeed * (this.hotairT > 0 ? 1.35 : 1);
    let ax = c.x * prop;
    const wind = w.windAt(this.x, this.y);
    ax += wind * st.windMul * 0.9;
    const g = w.gustAt(this.x);
    if (g) { ax += g.fx * st.windMul; ay += g.fy * st.windMul; }
    if (Math.abs(c.x) > 0.2) this.facing = c.x > 0 ? 1 : -1;
    // boost
    if (c.boost && st.boost > 0 && this.boostCd <= 0 && (this.fuel > 3 || this.hotairT > 0)) {
      this.boosting = 0.45; this.boostCd = st.boost >= 2 ? 2.4 : 4;
      this.vx += this.facing * 360; this.vy -= 50;
      if (this.hotairT <= 0) this.fuel = Math.max(0, this.fuel - (st.boost >= 2 ? 5 : 8));
      Audio.boost(); w.fx.puff(this.x - this.facing * 30, this.y - 50, 6, P.smokeLight, 10);
      this.setExpr('determined', 0.8); this.squashV -= 3;
    }
    // integrate
    this.vy += ay * dt; this.vx += ax * dt;
    const hDrag = this.boosting > 0 ? 0.4 : 1.3;
    this.vx *= Math.exp(-hDrag * dt); this.vy *= Math.exp(-1.4 * dt);
    this.vy = clamp(this.vy, -260, 300);
    this.x += this.vx * dt; this.y += this.vy * dt;
    // ---------- world bounds ----------
    if (this.y < CEILING + 120) { this.vy += (CEILING + 120 - this.y) * 6 * dt; }
    if (this.x < 40) { this.x = 40; this.vx = Math.abs(this.vx) * 0.3; }
    if (this.x > w.length - 40) { this.x = w.length - 40; this.vx = -Math.abs(this.vx) * 0.3; }
    // ---------- collisions with buildings & ground ----------
    this.collideWorld(w, dt);
    // ---------- weapons ----------
    this.updateBombs(w, c, dt);
    this.updateHook(w, c, dt);
    // ---------- regen / fuel trickle ----------
    if (this.grounded && this.fuel < 25) { this.fuel = Math.min(25, this.fuel + 6 * dt); if (Math.random() < 0.1) Audio.ratchet(); this.setArm('crank', 0.2); }
    if (st.patchEvery > 0 && this.hp < this.maxHp) { this.patchT += dt; if (this.patchT > st.patchEvery) { this.patchT = 0; this.hp++; w.fx.popup(this.x, this.y - 140, '+1 PATCH', P.tealLight); Audio.pickup('fabric'); } }
    // ---------- animation ----------
    this.updateAnim(w, c, dt);
  }

  private collideWorld(w: World, dt: number) {
    this.grounded = false;
    for (let iter = 0; iter < 2; iter++) {
      for (const [cx, cy, r] of this.circles()) {
        for (const b of w.terrain.buildings) {
          if (cx + r < b.x || cx - r > b.x + b.w || cy + r < b.top) continue;
          const nx = clamp(cx, b.x, b.x + b.w), ny = clamp(cy, b.top, b.top + b.h);
          const dx = cx - nx, dy = cy - ny; const d = Math.hypot(dx, dy);
          if (d < r) {
            const ux = d > 0.01 ? dx / d : 0, uy = d > 0.01 ? dy / d : -1;
            const push = r - d;
            this.x += ux * push; this.y += uy * push;
            const vn = this.vx * ux + this.vy * uy;
            if (vn < 0) {
              const impact = -vn;
              this.vx -= vn * ux * 1.5; this.vy -= vn * uy * 1.5;
              if (impact > 60) { this.wobble = Math.min(1, this.wobble + impact / 300); this.squashV += impact / 60; Audio.boing(); w.fx.dust(nx, ny, 3); }
              if (impact > 210) this.hit(w, 1, nx, ny, 'crash');
              if (uy < -0.7) { this.grounded = true; }
            }
          }
        }
      }
    }
    // ground: basket bottom
    const by = this.y + 20;
    let gy = w.terrain.groundY(this.x);
    const water = w.terrain.biome.water;
    this.inWater = false;
    if (water !== undefined && by > water && gy > water) {
      if (this.stats.pontoons) gy = water - 2; // float!
      else {
        this.inWater = true;
        if (by > water + 2 && this.vy > 60) { w.fx.puff(this.x, water, 6, '#c8dcdc', 8); Audio.puff(); }
        this.vy -= 260 * dt; this.vx *= Math.exp(-2.5 * dt); this.heat = Math.max(0.2, this.heat - dt * 0.4);
        // every fresh dunk soaks you (with a short grace period), and lingering keeps soaking
        if (this.soakT <= 0) { this.soakT = 1.4; this.hit(w, 1, this.x, water + 40, 'water'); w.fx.burst(this.x, this.y - 30, 'SOAKED!', 18, P.tealLight); }
        gy = water + 18;
      }
    }
    this.soakT = Math.max(0, this.soakT - dt);
    if (by > gy - 2 && w.terrain.lavaAt(this.x) && water === undefined) {
      if (!this.stats.bucket || this.invuln <= 0) this.hit(w, 1, this.x, gy, 'lava');
      this.vy = -240; w.fx.burst(this.x, this.y - 20, 'YEEOWCH!', 20); for (let i = 0; i < 6; i++) w.fx.add({ kind: 'flame', x: this.x + (Math.random() - 0.5) * 30, y: gy, vx: 0, vy: -120, r: 8, life: 0.5, max: 0.5 });
    }
    if (by > gy) {
      this.y -= by - gy;
      if (this.vy > 0) {
        if (this.vy > 120) { Audio.thump(); w.fx.dust(this.x, gy, 6); this.squashV += this.vy / 70; this.wobble = Math.min(1, this.wobble + 0.3); }
        if (this.vy > 260) this.hit(w, 1, this.x, gy, 'crash');
        this.vy = -this.vy * 0.25;
      }
      this.vx *= Math.exp(-3 * dt);
      this.grounded = true;
    }
    if (this.grounded) this.groundT += dt; else this.groundT = 0;
  }

  private updateBombs(w: World, c: Controls, dt: number) {
    const st = this.stats;
    if (this.bombs < st.bombCap) { this.reload += dt; if (this.reload >= st.reloadTime) { this.reload = 0; this.bombs++; Audio.ratchet(); } } else this.reload = 0;
    if (c.bomb) this.bombQueued = true;
    if (this.bombQueued && this.bombCd <= 0) {
      this.bombQueued = false;
      if (this.bombs > 0) {
        this.bombs--; this.bombCd = 0.22;
        const cluster = st.cluster || this.clusterT > 0;
        w.dropBomb(this.x + this.facing * 6, this.y + 26, this.vx * 0.9, Math.max(this.vy, 0) + 30, cluster);
        this.setArm('throw', 0.3); Audio.bombDrop();
        this.squashV += 1.2;
      } else { Audio.deny(); w.fx.popup(this.x, this.y - 150, 'RE-ARMING…', P.parchment, 15); this.bombCd = 0.4; }
    }
  }

  private updateHook(w: World, c: Controls, dt: number) {
    const st = this.stats;
    const maxLen = st.ropeLen;
    if (c.hook) {
      if (this.hookState === 'stowed') { this.hookState = 'out'; Audio.hookOut(); this.grabT = 0; }
      else { this.hookState = 'reel'; }
    }
    const reelSpeed = (190 * st.winchSpeed) / (1 + (this.cargoWeight() * 0.7) / (1 + st.cargoTolerance * 0.5));
    if (this.hookState === 'out') {
      this.ropeLen = Math.min(maxLen, this.ropeLen + 300 * st.winchSpeed * dt);
      if (this.cargo.length > 0) { this.grabT += dt; if (this.cargo.length >= st.cargoCap || this.grabT > 1.4) this.hookState = 'reel'; }
      if (Math.random() < 0.4 && this.ropeLen < maxLen) Audio.ratchet();
    } else if (this.hookState === 'reel') {
      this.ropeLen = Math.max(6, this.ropeLen - reelSpeed * dt);
      if (Math.random() < 0.5) Audio.ratchet();
      this.setArm('crank', 0.15);
      if (this.ropeLen <= 6) {
        this.hookState = 'stowed';
        if (this.cargo.length) { for (const it of this.cargo) w.collect(it); this.cargo = []; }
      }
    }
    // verlet rope
    const N = this.rope.length;
    const a = this.anchor();
    const seg = this.ropeLen / (N - 1);
    const endMass = 1 + this.cargoWeight() * 2;
    for (let i = 1; i < N; i++) {
      const p = this.rope[i];
      const vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + 900 * dt * dt;
    }
    for (let it = 0; it < 10; it++) {
      this.rope[0].x = a.x; this.rope[0].y = a.y;
      for (let i = 0; i < N - 1; i++) {
        const p = this.rope[i], q = this.rope[i + 1];
        const dx = q.x - p.x, dy = q.y - p.y; const d = Math.hypot(dx, dy) || 0.001;
        const diff = (d - seg) / d;
        const wp = i === 0 ? 0 : 1, wq = i + 1 === N - 1 ? 1 / endMass : 1;
        const sum = wp + wq;
        p.x += dx * diff * (wp / sum); p.y += dy * diff * (wp / sum);
        q.x -= dx * diff * (wq / sum); q.y -= dy * diff * (wq / sum);
      }
      for (let i = 1; i < N; i++) {
        const p = this.rope[i]; const sy = w.terrain.surfaceY(p.x) - 3;
        if (p.y > sy) { p.y = sy; p.px = lerp(p.px, p.x, 0.3); }
      }
    }
    const end = this.rope[N - 1];
    this.hookSpeed = Math.hypot(end.x - end.px, end.y - end.py) / dt;
    // carry cargo
    this.cargo.forEach((it, i) => { it.x = end.x; it.y = end.y + it.r + 4 + i * 12; });
    // grabbing
    if (this.hookState !== 'stowed' && this.ropeLen > 20 && this.cargo.length < st.cargoCap) {
      const magR = st.magnet ? 95 : 42;
      for (const it of w.items) {
        if (it.dead || it.hooked) continue;
        const d = dist(end.x, end.y, it.x, it.y);
        if (magR && d < magR && d > 4) { // magnet tug
          const k = (1 - d / magR) * (st.magnet ? 260 : 140) * dt;
          it.x += ((end.x - it.x) / d) * k; it.y += ((end.y - it.y) / d) * k; it.vy = Math.min(it.vy, 0);
          if (st.magnet && Math.random() < 0.2) w.fx.sparks(it.x, it.y, 1, P.electric);
        }
        if (d < it.r + 18) {
          it.hooked = true; it.floating = false; this.cargo.push(it); this.grabT = 0;
          Audio.grab(); w.fx.popup(it.x, it.y - 20, 'HOOKED!', P.parchment, 14);
          if (it.kind === 'survivor') Audio.voice('yay');
          if (this.cargo.length >= st.cargoCap) this.hookState = 'reel';
          if (this.cargo.length >= st.cargoCap) break;
        }
      }
    }
    // hook as a weapon
    if (this.hookState !== 'stowed' && this.ropeLen > 30 && this.hookSpeed > 140) {
      const dmg = st.magnet ? 2 : 1;
      for (const e of w.enemies) {
        if (e.dead || e.dying > 0 || e.hookCd > 0) continue;
        if (dist(end.x, end.y, e.x, e.cy) < e.r + 10) { e.hookCd = 0.5; e.damage(w, dmg, 'hook'); w.fx.sparks(end.x, end.y, 8, P.gold); Audio.clank(); w.fx.shake = Math.max(w.fx.shake, 4); }
      }
      if (w.boss) w.boss.hookHit(w, end.x, end.y, this.hookSpeed);
    }
  }

  private updateAnim(w: World, c: Controls, dt: number) {
    // squash spring
    this.squashV += (-this.squash * 90 - this.squashV * 9) * dt;
    this.squash += this.squashV * dt * 0.08;
    this.squash = clamp(this.squash, -0.3, 0.3);
    this.wobble = Math.max(0, this.wobble - dt * 1.2);
    this.tilt = damp(this.tilt, clamp(this.vx * 0.0011, -0.22, 0.22) + (this.burnerOn ? -0.01 : 0), 6, dt);
    this.propSpin += dt * (8 + Math.abs(c.x) * 30 + (this.boosting > 0 ? 40 : 0));
    // timers
    this.exprT -= dt; this.armT -= dt;
    this.blinkT -= dt; if (this.blinkT < 0) { this.blink = !this.blink; this.blinkT = this.blink ? 0.12 : rand(1.5, 4); }
    if (this.exprT <= 0) {
      let e: Expr = 'neutral';
      if (this.hp <= 1 || (this.fuel <= 0 && !this.grounded && this.hotairT <= 0) || this.vy > 200) e = 'panic';
      else if (this.boosting > 0 || w.dangerNear()) e = 'determined';
      this.expr = e;
    }
    if (this.armT <= 0) this.arm = this.burnerOn ? 'burn' : this.hookState === 'reel' ? 'crank' : 'rest';
    // look direction: toward nearest danger or velocity
    const tgt = w.lookTarget();
    if (tgt) { const dx = tgt.x - this.x, dy = tgt.y - (this.y - 30); const d = Math.hypot(dx, dy) || 1; this.lookX = (dx / d) * this.facing; this.lookY = dy / d; }
    else { this.lookX = damp(this.lookX, 1, 4, dt); this.lookY = damp(this.lookY, clamp(this.vy / 200, -1, 1), 4, dt); }
    // scarf verlet
    const n = this.neck();
    const wind = w.windAt(this.x, this.y);
    for (let i = 1; i < this.scarf.length; i++) {
      const p = this.scarf[i];
      const vx = (p.x - p.px) * 0.9, vy = (p.y - p.py) * 0.9;
      p.px = p.x; p.py = p.y;
      p.x += vx + (-this.vx * 0.9 + wind * 0.8 - this.facing * 40) * dt * dt * 30 + Math.sin(this.t * 9 + i) * 0.25;
      p.y += vy + (60 - this.vy * 0.6) * dt * dt * 10 + Math.cos(this.t * 7 + i * 1.3) * 0.2;
    }
    for (let it = 0; it < 4; it++) {
      this.scarf[0].x = n.x; this.scarf[0].y = n.y;
      for (let i = 0; i < this.scarf.length - 1; i++) {
        const p = this.scarf[i], q = this.scarf[i + 1];
        const dx = q.x - p.x, dy = q.y - p.y; const d = Math.hypot(dx, dy) || 0.001; const diff = (d - 4.2) / d;
        if (i === 0) { q.x -= dx * diff; q.y -= dy * diff; }
        else { p.x += dx * diff * 0.5; p.y += dy * diff * 0.5; q.x -= dx * diff * 0.5; q.y -= dy * diff * 0.5; }
      }
    }
  }

  hit(w: World, dmg: number, sx: number, sy: number, src = '') {
    if (this.dead || this.invuln > 0) return;
    if (this.shield) {
      this.shield = false; this.invuln = 1; Audio.clank(); w.fx.burst(this.x, this.y - 150, 'PLINK!', 22, P.electric); w.fx.sparks(sx, sy, 10, P.electric); return;
    }
    if (Math.random() < this.stats.deflect) {
      this.invuln = 0.6; Audio.clank(); w.fx.burst(this.x, this.y - 20, 'CLANG!', 20, P.steelLight); w.fx.sparks(this.x, this.y, 8, P.gold); return;
    }
    this.hp -= dmg; this.damageTaken += dmg; this.lastHitBy = src;
    this.invuln = 1.5;
    const dx = this.x - sx, dy = (this.y - 60) - sy; const d = Math.hypot(dx, dy) || 1;
    this.vx += (dx / d) * 160; this.vy += (dy / d) * 120;
    this.wobble = 1; this.squashV += 4;
    w.fx.shake = Math.max(w.fx.shake, 9); w.fx.stop(0.06); w.fx.flash = 0.3;
    w.fx.puff(this.x, this.y - 90, 4, P.parchment, 7);
    Audio.hurt(); Audio.voice(this.hp <= 1 ? 'yikes' : 'ugh');
    try { navigator.vibrate?.(70); } catch { /* unsupported */ }
    this.setExpr('hurt', 0.9);
    w.onPlayerHit();
    if (this.hp <= 0) {
      if (this.stats.buoy && !this.buoyUsed) {
        this.buoyUsed = true; this.hp = 1; this.vy = -280; this.invuln = 2.5;
        w.fx.burst(this.x, this.y - 170, 'PHEW!', 30, P.goldLight); Audio.boing(); Audio.voice('woo');
        w.fx.popup(this.x, this.y - 120, 'EMERGENCY BUOYANCY!', P.gold, 16);
        return;
      }
      this.dead = true; this.deadT = 0; this.setExpr('panic', 99); Audio.sadTrombone();
      w.onPlayerDown();
    }
  }
  zapped(w: World) {
    if (this.invuln > 0 || this.dead) return;
    this.zapT = 0.6; Audio.zap(); w.fx.sparks(this.x, this.y - 30, 14);
    this.hit(w, this.stats.bucket ? 0 : 1, this.x, this.y - 200, 'zap');
    if (this.stats.bucket && this.invuln < 1) this.invuln = 1;
    this.vy = Math.max(this.vy, 120);
  }
  private updateDead(w: World, dt: number) {
    this.deadT += dt;
    this.inflate = Math.max(0.28, this.inflate - dt * 0.5);
    this.vy = Math.min(this.vy + 300 * dt, 240); this.vx *= Math.exp(-1 * dt);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.tilt = Math.max(-0.55, Math.min(0.55, this.tilt + dt * 1.2 * this.facing)); this.squash = Math.min(0.3, this.squash + dt * 0.3);
    if (Math.random() < 0.5) w.fx.puff(this.x, this.y - 100, 1, P.smoke, 8);
    Audio.burner(0);
    const gy = w.terrain.surfaceY(this.x);
    if (this.y + 20 > gy) { this.y = gy - 20; this.vy = 0; this.vx = 0; }
  }

  draw(ctx: CanvasRenderingContext2D, w: World) {
    // hook rope
    pen.use(ctx, 0.4);
    const N = this.rope.length;
    if (this.ropeLen > 8) {
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(this.rope[0].x, this.rope[0].y);
      for (let i = 1; i < N; i++) ctx.lineTo(this.rope[i].x, this.rope[i].y);
      ctx.stroke();
      ctx.strokeStyle = P.parchmentShade; ctx.lineWidth = 0.9; ctx.stroke();
    }
    const end = this.rope[N - 1], prev = this.rope[N - 2];
    const ang = Math.atan2(end.y - prev.y, end.x - prev.x) - Math.PI / 2;
    for (const it of this.cargo) it.draw(ctx, w);
    ctx.save(); ctx.translate(this.ropeLen > 8 ? end.x : this.anchor().x, this.ropeLen > 8 ? end.y : this.anchor().y + 4); ctx.rotate(this.ropeLen > 8 ? ang : 0);
    if (this.stats.magnet) {
      pen.begin().m(-8, 0).l(-8, 10).q(-8, 18, 0, 18).q(8, 18, 8, 10).l(8, 0).l(4, 0).l(4, 10).q(4, 13, 0, 13).q(-4, 13, -4, 10).l(-4, 0).close().ink(P.red, 2);
      pen.begin().rect(-8, 0, 4, 4).fill(P.steelLight); pen.begin().rect(4, 0, 4, 4).fill(P.steelLight);
    } else {
      pen.begin().rect(-3, -2, 6, 5).ink(P.steelDark, 1.6);
      pen.begin().m(0, 3).l(0, 12).q(0, 19, 6, 18).q(10, 16, 9, 11).stroke(4.4, P.ink);
      pen.begin().m(0, 3).l(0, 12).q(0, 19, 6, 18).q(10, 16, 9, 11).stroke(2, P.steelLight);
    }
    ctx.restore();
    // balloon
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(BAL_SCALE, BAL_SCALE);
    const n = this.neck();
    const scarfLocal = this.scarf.map((p) => [((p.x - n.x) / BAL_SCALE + 2 * this.facing) * this.facing, (p.y - n.y) / BAL_SCALE - 27]);
    // invert tilt for scarf
    drawBalloon(ctx, {
      t: this.t, facing: this.facing, tilt: this.tilt, squash: this.squash, wobble: this.wobble, burner: this.burnerVis * (this.hotairT > 0 ? 1.2 : 1),
      levels: this.levels, paint: this.paint, damage: Math.max(0, this.maxHp - this.hp), expr: this.zapT > 0 ? 'zapped' : this.expr, arm: this.arm,
      lookX: this.lookX, lookY: this.lookY, blink: this.blink, scarf: scarfLocal, bombs: this.bombs, bombCap: this.stats.bombCap,
      propSpin: this.propSpin, boosting: this.boosting > 0, shield: this.shield, flash: this.invuln > 0 && Math.floor(this.t * 14) % 2 === 0 && !this.dead,
      goggleDown: this.boosting > 0 || this.hotairT > 0 || this.expr === 'determined', zap: this.zapT,
      inflate: this.inflate, dizzy: this.dead || this.expr === 'hurt', ice: this.ice,
    });
    ctx.restore();
    // hot air aura
    if (this.hotairT > 0 && Math.random() < 0.5) w.fx.add({ kind: 'flame', x: this.x + rand(-6, 6), y: this.y - 45, vx: -this.vx * 0.3, vy: 60, r: 5, life: 0.4, max: 0.4 });
  }
}

export const itemLabel = (k: string) => (ITEM_INFO as any)[k]?.label ?? k;
