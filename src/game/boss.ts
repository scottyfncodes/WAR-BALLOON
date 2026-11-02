import { P } from '../render/palette';
import { pen, inkText, cel } from '../render/ink';
import { clamp, dist, rand, lerp } from '../core/math';
import { Audio } from '../core/audio';
import type { World } from './world';
import { Projectile, Enemy, Eruption } from './entities';

interface Valve { ox: number; hp: number; flash: number; }

export interface BossCfg { id: string; name: string; short: string; sub: string; hull: string; cab: string; arm: string; ball: 'ball' | 'anchor' | 'drill' | 'ice' | 'fire'; ship?: boolean; special?: 'geyser' | 'broadside' | 'vines' | 'breath' | 'firerain'; base?: 'treads' | 'roots' | 'skis' | 'walker'; head?: 'box' | 'flower' | 'furnace'; mortar: 'junk' | 'snow'; summon: 'buzzard' | 'moth'; speed: number; valveHp: number; }
export const BOSSES: Record<string, BossCfg> = {
  bertha: { id: 'bertha', name: 'BIG BERTHA', short: 'BIG BERTHA', sub: 'the Scrap Baron\'s crane-tank', hull: P.rust, cab: P.olive, arm: P.gold, ball: 'ball', mortar: 'junk', summon: 'buzzard', speed: 1, valveHp: 2 },
  dredger: { id: 'dredger', special: 'geyser', name: 'THE DUNE DREDGER', short: 'DREDGER', sub: 'eats sand, spits scrap', hull: '#c08a52', cab: P.teal, arm: P.red, ball: 'drill', mortar: 'junk', summon: 'buzzard', speed: 1.2, valveHp: 2 },
  salty: { id: 'salty', special: 'broadside', name: 'OLD SALTY', short: 'OLD SALTY', sub: 'a paddle-steamer with a grudge', hull: '#4f6670', cab: P.parchment, arm: P.steel, ball: 'anchor', ship: true, mortar: 'junk', summon: 'buzzard', speed: 1.1, valveHp: 3 },
  bramble: { base: 'roots', head: 'flower', id: 'bramble', special: 'vines', name: 'THE BRAMBLE KING', short: 'BRAMBLE KING', sub: 'a lawnmower that grew a crown', hull: '#5a6e3a', cab: '#8a5a2b', arm: '#4f7a2a', ball: 'ball', mortar: 'junk', summon: 'moth', speed: 1.25, valveHp: 3 },
  icebreaker: { base: 'skis', id: 'icebreaker', special: 'breath', name: 'THE ICEBREAKER', short: 'ICEBREAKER', sub: 'cracks glaciers for breakfast', hull: '#6a7a8a', cab: P.red, arm: '#dfe6ee', ball: 'ice', mortar: 'snow', summon: 'buzzard', speed: 1.3, valveHp: 3 },
  furnace: { base: 'walker', head: 'furnace', id: 'furnace', special: 'firerain', name: 'THE IRON FURNACE', short: 'IRON FURNACE', sub: 'the Scrap Baron\'s last stand', hull: '#3a3030', cab: '#7a2a1a', arm: '#c4841d', ball: 'fire', mortar: 'junk', summon: 'buzzard', speed: 1.45, valveHp: 4 },
};

/** BIG BERTHA — the Scrap Baron's crane-tank. Bomb her three pressure valves. */
export class Boss {
  x: number; y: number; arenaX: number; arenaW: number;
  valves: Valve[] = [{ ox: -70, hp: 2, flash: 0 }, { ox: 0, hp: 2, flash: 0 }, { ox: 70, hp: 2, flash: 0 }];
  t = 0; dir = 1; dead = false; dying = 0; intro = 0; started = false; defeated = false;
  // wrecking ball pendulum
  ang = 0.4; angV = 0; chain = 170; ballX = 0; ballY = 0; ballR = 26;
  armSwing = 0;
  mortarCd = 3; summonCd = 8; hitFlash = 0; stompT = 0; specialCd = 4; breathT = 0;
  cfg: BossCfg;
  constructor(x: number, groundY: number, arenaX: number, arenaW: number, cfg: BossCfg = BOSSES.bertha) { this.x = x; this.y = groundY; this.arenaX = arenaX; this.arenaW = arenaW; this.cfg = cfg; this.valves.forEach((v) => (v.hp = cfg.valveHp)); }
  get alive() { return this.valves.filter((v) => v.hp > 0).length; }
  get phase() { return 3 - this.alive + 1; }
  armTip() { const f = this.dir; return { x: this.x + f * 60 + Math.sin(this.armSwing) * 20, y: this.y - 300 }; }
  update(w: World, dt: number) {
    this.t += dt; this.hitFlash = Math.max(0, this.hitFlash - dt);
    for (const v of this.valves) v.flash = Math.max(0, v.flash - dt);
    const p = w.player;
    if (!this.started) { if (p.x > this.arenaX + 40) { this.started = true; this.intro = 2.6; w.onBossStart(); } }
    if (this.dying > 0) {
      this.dying += dt;
      if (Math.random() < 0.25) { const ex = this.x + rand(-110, 110), ey = this.y - rand(20, 160); w.fx.explosion(ex, ey, rand(0.6, 1.1)); Audio.explosion(0.8); }
      if (this.dying > 2.6 && !this.dead) {
        this.dead = true; w.fx.explosion(this.x, this.y - 80, 2.4, 'KER-RASH!'); Audio.explosion(2); w.fx.confetti(this.x, this.y - 120, 50);
        w.onBossDefeated(this);
      }
      return;
    }
    if (!this.started) return;
    this.intro = Math.max(0, this.intro - dt);
    // movement: patrol toward player-ish
    const speed = (30 + this.phase * 18) * this.cfg.speed;
    const want = clamp(p.x, this.arenaX + 160, this.arenaX + this.arenaW - 160);
    if (Math.abs(want - this.x) > 40) this.dir = want > this.x ? 1 : -1;
    this.x += this.dir * speed * dt * (this.intro > 0 ? 0 : 1);
    this.x = clamp(this.x, this.arenaX + 150, this.arenaX + this.arenaW - 150);
    this.y = w.terrain.floorY(this.x) + (this.cfg.ship ? 10 + Math.sin(this.t * 1.5) * 4 : 0);
    this.stompT += dt * speed * 0.1;
    // pendulum: pump toward player
    const tip = this.armTip();
    const g = 900;
    const desired = clamp(Math.atan2(p.x - tip.x, (p.y - 60) - tip.y), -1.3, 1.3);
    const pump = Math.sign(desired - this.ang) * (2.2 + this.phase * 0.8);
    this.angV += (-(g / this.chain) * Math.sin(this.ang) + pump) * dt;
    this.angV *= Math.exp(-0.25 * dt);
    this.ang += this.angV * dt;
    this.ang = clamp(this.ang, -1.5, 1.5);
    this.armSwing += dt * 0.8;
    this.ballX = tip.x + Math.sin(this.ang) * this.chain; this.ballY = tip.y + Math.cos(this.ang) * this.chain;
    if (p.hitTest(this.ballX, this.ballY, this.ballR)) { p.hit(w, 1, this.ballX, this.ballY, 'boss'); Audio.clank(); }
    // body collision (treads/cab)
    if (p.hitTest(this.x, this.y - 70, 90)) p.hit(w, 1, this.x, this.y - 70, 'boss');
    // mortars from phase 2
    if (this.phase >= 2) {
      this.mortarCd -= dt * w.aggro;
      if (this.mortarCd <= 0) {
        this.mortarCd = this.phase >= 3 ? 2.0 : 3.0;
        const sx = this.x - this.dir * 50, sy = this.y - 190;
        const T = 1.2, gg = 380;
        const tx = p.x + p.vx * T, ty = p.y - 60;
        w.projectiles.push(new Projectile(sx, sy, (tx - sx) / T, (ty - sy - 0.5 * gg * T * T) / T, this.cfg.mortar, 4));
        w.fx.puff(sx, sy, 6, '#2f2624', 12); Audio.thump(); Audio.puff();
      }
    }
    if (this.phase >= 3) {
      this.summonCd -= dt;
      if (this.summonCd <= 0 && w.enemies.filter((e) => !e.dead && e.kind === this.cfg.summon).length < 2) {
        this.summonCd = 9;
        const e = new Enemy(this.x, this.y - 220, this.cfg.summon); e.active = true; e.state = 'approach'; w.enemies.push(e);
        Audio.squawk(); w.fx.burst(this.x, this.y - 240, 'SQUAWK!', 20);
      }
    }
    // signature attack
    if (this.cfg.special && this.intro <= 0) {
      this.specialCd -= dt * w.aggro;
      if (this.specialCd <= 0) { this.specialCd = Math.max(3.2, 6.5 - this.phase * 1.1); this.special(w); }
    }
    if (this.breathT > 0) {
      this.breathT -= dt;
      const f = this.dir, cx = this.x + f * 60, cy = this.y - 170;
      for (let i = 0; i < 3; i++) w.fx.add({ kind: 'smoke', x: cx, y: cy, vx: f * (380 + Math.random() * 120), vy: (Math.random() - 0.5) * 140, r: 8, life: 0.9, max: 0.9, color: '#eef6fa', drag: 0.8 });
      const dx = (p.x - cx) * f;
      if (dx > 0 && dx < 460 && Math.abs((p.y - 60) - cy) < 70 + dx * 0.35) {
        p.vx += f * 260 * dt;
        if (!p.stats.heater) p.ice = Math.min(1, p.ice + dt * 0.45);
      }
    }
    // smoke
    if (Math.random() < 0.3) w.fx.add({ kind: 'smoke', x: this.x - this.dir * 50, y: this.y - 190, vx: rand(-10, 10), vy: -60, r: 10, life: 1.2, max: 1.2, color: '#3b302c', drag: 0.8, grav: -10 });
  }
  private special(w: World) {
    const p = w.player;
    switch (this.cfg.special) {
      case 'geyser': case 'firerain': {
        const kind = this.cfg.special === 'geyser' ? 'sand' : 'fire';
        const n = this.cfg.special === 'firerain' ? 2 + this.phase : 1 + Math.min(2, this.phase - 1);
        for (let i = 0; i < n; i++) {
          const x = Math.max(this.arenaX + 40, Math.min(this.arenaX + this.arenaW - 40, p.x + p.vx * 0.9 + (i - (n - 1) / 2) * 150));
          w.eruptions.push(new Eruption(x, w.terrain.floorY(x), kind));
        }
        w.fx.burst(this.x, this.y - 230, kind === 'sand' ? 'RUMBLE!' : 'FWOOSH!', 20);
        break;
      }
      case 'broadside': {
        const sx = this.x, sy = this.y - 60;
        for (let i = -1; i <= 1; i++) {
          const a = Math.atan2(p.y - 60 - sy, p.x - sx) + i * 0.28;
          w.projectiles.push(new Projectile(sx, sy, Math.cos(a) * 280, Math.sin(a) * 280, 'flak', 1.3 + Math.abs(i) * 0.2));
        }
        w.fx.puff(sx, sy, 8, P.smokeLight, 12); Audio.thump(); Audio.explosion(0.5);
        w.fx.burst(sx, sy - 30, 'BROADSIDE!', 20);
        break;
      }
      case 'vines': {
        const n = Math.min(3, this.phase);
        for (let i = 0; i < n; i++) {
          const x = p.x + (i - (n - 1) / 2) * 110 + p.vx * 0.5;
          const e = new Enemy(x, w.terrain.surfaceY(x), 'snapper'); e.active = true; e.life = 7; e.cd = 0.3; e.style = 'green';
          w.enemies.push(e); w.fx.dust(x, w.terrain.surfaceY(x), 5);
        }
        w.fx.burst(this.x, this.y - 230, 'SPROUT!', 20); Audio.puff();
        break;
      }
      case 'breath': {
        this.breathT = 2.2; w.fx.burst(this.x, this.y - 230, 'HWOOOO!', 20); Audio.noiseBurst(2.2, { f: 2000, f2: 600, gain: 0.25, type: 'bandpass', q: 0.6 });
        break;
      }
    }
  }
  valvePos(v: Valve) { return { x: this.x + v.ox * this.dir, y: this.y - 132 }; }
  /** Returns true if a bomb at (x,y) should detonate on the boss. */
  bombHit(x: number, y: number) {
    if (this.dying > 0 || !this.started) return false;
    if (Math.abs(x - this.x) < 120 && y > this.y - 140 && y < this.y) return true;
    if (dist(x, y, this.ballX, this.ballY) < this.ballR) return true;
    return false;
  }
  blast(w: World, x: number, y: number, r: number) {
    if (this.dying > 0 || !this.started) return;
    let any = false;
    for (const v of this.valves) {
      if (v.hp <= 0) continue;
      const vp = this.valvePos(v);
      if (dist(x, y, vp.x, vp.y) < r * 0.75 + 14) { this.damageValve(w, v, 1); any = true; }
    }
    if (!any && Math.abs(x - this.x) < 130 && y > this.y - 160) { w.fx.burst(x, y - 20, 'CLANK!', 18, P.steelLight); Audio.clank(); }
  }
  hookHit(w: World, x: number, y: number, speed: number) {
    if (this.dying > 0 || !this.started || speed < 140) return;
    for (const v of this.valves) {
      if (v.hp <= 0 || v.flash > 0) continue;
      const vp = this.valvePos(v);
      if (dist(x, y, vp.x, vp.y) < 22) { this.damageValve(w, v, 1); w.fx.burst(vp.x, vp.y - 20, 'BONK!', 20); }
    }
  }
  private damageValve(w: World, v: Valve, n: number) {
    v.hp -= n; v.flash = 0.5; this.hitFlash = 0.2;
    const vp = this.valvePos(v);
    w.fx.sparks(vp.x, vp.y, 12, P.gold); w.fx.shake = Math.max(w.fx.shake, 8);
    Audio.clank();
    if (v.hp <= 0) {
      w.fx.explosion(vp.x, vp.y, 1.2, 'FSSSHH!'); Audio.explosion(1.2);
      for (let i = 0; i < 10; i++) w.fx.add({ kind: 'smoke', x: vp.x, y: vp.y, vx: rand(-40, 40), vy: rand(-200, -120), r: 12, life: 1.2, max: 1.2, color: P.parchment, drag: 1.5 });
      if (this.alive === 0) { this.dying = 0.01; Audio.voice('woo'); }
      else { w.fx.popup(this.x, this.y - 330, `${this.alive} VALVE${this.alive > 1 ? 'S' : ''} LEFT!`, P.gold, 22); w.onBossPhase(this.phase); }
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) {
      // wreck pile
      ctx.save(); ctx.translate(this.x, this.y); pen.use(ctx, 0.5);
      pen.begin().m(-140, 0).q(-90, -70, -20, -60).q(40, -90, 90, -50).q(130, -40, 150, 0).close().ink(P.rustDark, 3);
      pen.begin().m(-40, -60).l(30, -160).stroke(8, P.ink); pen.begin().m(-40, -60).l(30, -160).stroke(4, P.rust);
      ctx.restore(); return;
    }
    const f = this.dir;
    ctx.save(); ctx.translate(this.x, this.y);
    if (this.hitFlash > 0) ctx.translate(rand(-3, 3), rand(-2, 2));
    if (this.dying > 0) ctx.translate(rand(-4, 4), rand(-3, 3));
    pen.use(ctx, 0.9);
    // crane arm (behind)
    const tip = this.armTip();
    const ax = tip.x - this.x, ay = tip.y - this.y;
    pen.begin().m(-f * 20, -150).l(ax, ay).stroke(16, P.ink);
    pen.begin().m(-f * 20, -150).l(ax, ay).stroke(10, this.cfg.arm);
    for (let k = 0.1; k < 1; k += 0.12) { const lx = lerp(-f * 20, ax, k), ly = lerp(-150, ay, k); pen.begin().m(lx - 5, ly - 4).l(lx + 5, ly + 4).stroke(2, P.goldDark); }
    // chain
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3;
    const bx = this.ballX - this.x, by = this.ballY - this.y;
    for (let k = 0; k < 1; k += 0.08) { const lx = lerp(ax, bx, k), ly = lerp(ay, by, k); ctx.beginPath(); ctx.ellipse(lx, ly, 3, 5, this.ang, 0, Math.PI * 2); ctx.stroke(); }
    // wrecking ball
    this.drawBall(ctx, bx, by);
    if (this.cfg.ship) {
      // paddle-steamer hull + paddle wheel
      pen.begin().m(-150, -46).l(150, -46).q(140, 10, 100, 14).l(-110, 14).q(-145, 0, -150, -46).close().ink('#2e3c42', 3.2);
      ctx.save(); ctx.translate(-f * 120, -30); ctx.rotate(this.t * 2 * f);
      for (let k = 0; k < 6; k++) { ctx.rotate(Math.PI / 3); pen.begin().rect(-4, 0, 8, 34).ink(P.brownLight, 2); }
      ctx.restore();
    } else if (this.cfg.base === 'roots') {
      // four gnarled root-legs that shuffle
      for (let k = 0; k < 4; k++) {
        const lx = -95 + k * 63, ph = this.stompT * 2 + k * 1.6, lift = Math.max(0, Math.sin(ph)) * 10;
        const fx = lx + Math.cos(ph) * 10;
        pen.begin().m(lx - 10, -40).q(lx - 22, -18, fx - 8, -lift).l(fx + 14, -lift).q(lx + 10, -18, lx + 12, -40).close().ink('#5a4430', 3);
        pen.begin().m(fx - 8, -lift).l(fx - 18, 2 - lift).m(fx + 4, -lift).l(fx + 2, 4 - lift).m(fx + 14, -lift).l(fx + 24, 2 - lift).stroke(3, '#3e2e20');
      }
    } else if (this.cfg.base === 'skis') {
      pen.begin().rrect(-120, -40, 240, 30, 10).ink('#4f5a64', 3);
      for (const sy of [-6, 0]) pen.begin().m(-150, sy).l(140, sy).q(165, sy, 168, sy - 14).stroke(6, P.ink);
      pen.begin().m(-150, -3).l(140, -3).q(162, -3, 165, -15).stroke(3, P.steelLight);
      for (const sx of [-80, 0, 80]) pen.begin().m(sx, -12).l(sx, -2).stroke(5, P.steelDark);
      if (Math.random() < 0.4) { /* snow spray drawn via fx elsewhere */ }
    } else if (this.cfg.base === 'walker') {
      // two huge piston legs, stomping
      for (let k = 0; k < 2; k++) {
        const lx = k ? 70 : -70, ph = this.stompT * 1.6 + k * Math.PI, lift = Math.max(0, Math.sin(ph)) * 16;
        pen.begin().rect(lx - 14, -44, 28, 24 - lift).ink('#3a3030', 3);
        pen.begin().rect(lx - 9, -22 - lift, 18, 18).ink(P.steel, 2.4);
        pen.begin().rrect(lx - 30, -6 - lift, 60, 10, 4).ink('#2a2222', 3);
        ctx.fillStyle = 'rgba(255,120,50,0.6)'; ctx.fillRect(lx - 4, -40, 8, 14 - lift * 0.5);
      }
    } else {
      // treads
      pen.begin().rrect(-130, -42, 260, 42, 20).ink('#3a3436', 3.2);
      for (let i = 0; i < 9; i++) { const wx = -110 + i * 27.5; ctx.save(); ctx.translate(wx, -21); ctx.rotate(this.stompT); pen.begin().ell(0, 0, 11, 11).ink(P.steelDark, 2); pen.begin().m(-8, 0).l(8, 0).stroke(2, P.steel); ctx.restore(); }
    }
    // hull
    const hull = this.cfg.base === 'roots'
      ? () => pen.begin().m(-124, -40).q(-140, -100, -90, -132).q(0, -150, 90, -132).q(140, -100, 124, -40).close()
      : this.cfg.base === 'walker'
        ? () => pen.begin().m(-110, -40).l(-120, -136).l(120, -136).l(110, -40).close()
        : () => pen.begin().m(-120, -40).l(-104, -130).l(104, -130).l(122, -40).close();
    hull(); pen.ink(this.hitFlash > 0 ? P.white : this.cfg.hull, 3.4);
    cel(ctx, hull, () => {
      ctx.fillStyle = 'rgba(40,10,10,0.25)'; ctx.fillRect(40, -140, 100, 110);
      ctx.fillStyle = P.rustDark; for (let i = -100; i < 110; i += 20) { ctx.beginPath(); ctx.arc(i, -120, 2, 0, 7); ctx.arc(i, -50, 2, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,230,180,0.15)'; ctx.fillRect(-110, -128, 200, 8);
    });
    // signature silhouettes
    switch (this.cfg.id) {
      case 'dredger': // giant drill on the nose
        pen.begin().m(f * 118, -110).l(f * 200, -80).l(f * 118, -50).close().ink(P.steelLight, 3);
        for (let k = 0; k < 4; k++) { const xx = f * (128 + k * 18); pen.begin().m(xx, -104 + k * 6 + ((this.t * 60) % 6)).l(xx, -56 - k * 6).stroke(2, P.steelDark); }
        break;
      case 'bramble': // vines + a crown of thorns
        for (let k = 0; k < 6; k++) { const vx = -100 + k * 40; pen.begin().m(vx, -130).q(vx + 10, -90, vx - 6, -44).stroke(4, '#3f6a24'); pen.begin().ell(vx + 4, -96, 6, 4).fill('#7aa04a'); }
        break;
      case 'icebreaker': // plough blade + icicles
        pen.begin().m(f * 118, -120).q(f * 175, -80, f * 140, -10).l(f * 118, -40).close().ink('#dfe6ee', 3);
        for (let k = 0; k < 8; k++) { const ix = -100 + k * 27; pen.begin().m(ix - 4, -40).l(ix, -40 + 10 + (k % 3) * 5).l(ix + 4, -40).close().ink('#d8eef6', 1.2); }
        break;
      case 'furnace': // glowing grille
        ctx.fillStyle = `rgba(255,${120 + Math.sin(this.t * 8) * 40},40,0.85)`; ctx.fillRect(-60, -70, 120, 22);
        for (let k = -50; k <= 50; k += 14) pen.begin().m(k, -72).l(k, -46).stroke(3);
        break;
    }
    // painted name
    ctx.save(); ctx.scale(1, 1);
    inkText(ctx, this.cfg.short, 0, -86, this.cfg.short.length > 10 ? 20 : 26, P.parchment, { outline: 4, shadow: false });
    ctx.restore();
    // cab with angry face windows
    const cx = f * 40;
    const blink = Math.sin(this.t * 2) > 0.95;
    if (this.cfg.head === 'flower') {
      // a giant carnivorous bloom for a head
      for (let k = 0; k < 8; k++) { const a = k * 0.785 + Math.sin(this.t * 2) * 0.05; pen.begin().ell(cx + Math.cos(a) * 44, -170 + Math.sin(a) * 40, 22, 14).ink(k % 2 ? '#c84a6a' : '#e86a8a', 2.4); }
      pen.begin().ell(cx, -170, 40, 36).ink('#f2c840', 3);
      for (const ex of [-14, 14]) { pen.begin().ell(cx + ex, -178, 8, 9).ink(P.white, 2); if (!blink) { ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(cx + ex + f * 3, -177, 3.5, 0, 7); ctx.fill(); } }
      pen.begin().m(cx - 22, -192).l(cx - 6, -186).m(cx + 22, -192).l(cx + 6, -186).stroke(4);
      pen.begin().m(cx - 18, -158).q(cx, -144, cx + 18, -158).q(cx, -152, cx - 18, -158).close().ink(P.redDark, 2.4);
      for (let k = -12; k <= 12; k += 6) pen.begin().m(cx + k, -157).l(cx + k + 2, -151).stroke(1.6, P.white);
      // crown
      pen.begin().m(cx - 22, -206).l(cx - 22, -222).l(cx - 11, -212).l(cx, -228).l(cx + 11, -212).l(cx + 22, -222).l(cx + 22, -206).close().ink(P.gold, 2.4);
    } else if (this.cfg.head === 'furnace') {
      // a pot-bellied furnace with a fire for a mouth
      pen.begin().m(cx - 46, -128).q(cx - 56, -180, cx - 30, -206).l(cx + 30, -206).q(cx + 56, -180, cx + 46, -128).close().ink(this.cfg.cab, 3.2);
      for (const ex of [-18, 18]) { pen.begin().ell(cx + ex, -182, 10, 7).ink(blink ? this.cfg.cab : '#ffb040', 2.4); }
      pen.begin().m(cx - 34, -194).l(cx - 8, -184).m(cx + 34, -194).l(cx + 8, -184).stroke(4);
      const fl = 0.6 + 0.4 * Math.sin(this.t * 20);
      pen.begin().m(cx - 24, -142).q(cx, -166, cx + 24, -142).close().ink('#ff8a30', 2.6);
      ctx.fillStyle = `rgba(255,230,120,${fl})`; ctx.beginPath(); ctx.ellipse(cx, -148, 14, 6, 0, 0, 7); ctx.fill();
      for (let k = -18; k <= 18; k += 9) pen.begin().m(cx + k, -142).l(cx + k, -158).stroke(2.4, '#2a1a14');
    } else {
      pen.begin().rect(cx - 40, -200, 80, 72).ink(this.cfg.cab, 3.2);
      for (const ex of [-18, 18]) {
        pen.begin().rect(cx + ex - 12, -186, 24, 18).ink(blink ? this.cfg.cab : P.gold, 2.4);
        if (!blink) { ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(cx + ex + f * 4, -177, 4, 0, 7); ctx.fill(); }
      }
      pen.begin().m(cx - 32, -194).l(cx - 6, -186).m(cx + 32, -194).l(cx + 6, -186).stroke(4); // angry brows
      pen.begin().m(cx - 22, -146).l(cx - 12, -152).l(cx - 2, -146).l(cx + 8, -152).l(cx + 18, -146).stroke(3, P.ink); // teeth grille
    }
    // driver: the Scrap Baron (tiny, top hat)
    if (this.cfg.head) ctx.translate(0, -24);
    pen.begin().ell(cx, -212, 9, 9).ink(P.skin, 2.2);
    pen.begin().rect(cx - 9, -236, 18, 16).ink(P.ink, 2); pen.begin().rect(cx - 13, -222, 26, 4).ink(P.ink, 2);
    pen.begin().m(cx - 7, -208).q(cx, -203, cx + 7, -208).stroke(2); // moustache
    pen.begin().ell(cx + 4, -214, 3.5, 3.5).ink(P.brass, 1.6);
    if (this.cfg.head) ctx.translate(0, 24);
    // smokestack
    const sx = -f * 50;
    pen.begin().rect(sx - 14, -196, 28, 66).ink('#4a3d38', 3);
    pen.begin().rect(sx - 18, -204, 36, 10).ink(P.rustDark, 3);
    // valves
    for (const v of this.valves) {
      const vx = v.ox * f, vy = -132;
      if (v.hp <= 0) { pen.begin().ell(vx, vy, 12, 6).ink(P.ink, 2); continue; }
      const glow = 0.5 + 0.5 * Math.sin(this.t * 6 + v.ox);
      ctx.fillStyle = `rgba(255,59,47,${0.2 + glow * 0.3})`; ctx.beginPath(); ctx.arc(vx, vy - 10, 22, 0, 7); ctx.fill();
      pen.begin().rect(vx - 6, vy - 14, 12, 14).ink(P.brass, 2.4);
      pen.begin().ell(vx, vy - 18, 14, 7).ink(v.flash > 0 ? P.white : P.red, 2.6);
      pen.begin().m(vx - 10, vy - 18).l(vx + 10, vy - 18).m(vx, vy - 24).l(vx, vy - 12).stroke(2.2, P.redDark);
      if (v.hp === 1) { pen.begin().m(vx - 6, vy - 10).l(vx - 1, vy - 4).l(vx + 4, vy - 9).stroke(1.6); }
    }
    ctx.restore();
  }
  private drawBall(ctx: CanvasRenderingContext2D, bx: number, by: number) {
    const r = this.ballR;
    switch (this.cfg.ball) {
      case 'anchor':
        pen.begin().m(bx, by - r).l(bx, by + r * 0.8).stroke(7, P.ink); pen.begin().m(bx, by - r).l(bx, by + r * 0.8).stroke(4, P.steel);
        pen.begin().m(bx - r, by + 2).q(bx, by + r * 1.6, bx + r, by + 2).stroke(8, P.ink); pen.begin().m(bx - r, by + 2).q(bx, by + r * 1.6, bx + r, by + 2).stroke(4.5, P.steel);
        pen.begin().m(bx - r * 0.6, by - r * 0.5).l(bx + r * 0.6, by - r * 0.5).stroke(5, P.ink);
        pen.begin().ell(bx, by - r - 4, 6, 6).stroke(3);
        break;
      case 'drill':
        pen.begin().m(bx - r, by - r * 0.6).l(bx + r, by - r * 0.6).l(bx, by + r * 1.4).close().ink(P.steelLight, 3);
        for (let k = 0; k < 4; k++) { const yy = by - r * 0.4 + k * 10 + ((this.t * 40) % 10); pen.begin().m(bx - r * (1 - k * 0.22), yy).l(bx + r * (1 - k * 0.22), yy + 6).stroke(2, P.steelDark); }
        break;
      case 'ice':
        pen.begin().poly([[bx - r, by - 6], [bx - r * 0.4, by - r], [bx + r * 0.7, by - r * 0.8], [bx + r, by + 4], [bx + r * 0.3, by + r], [bx - r * 0.7, by + r * 0.7]]).ink('#cfe8f4', 3);
        pen.begin().m(bx - r * 0.4, by - r * 0.6).l(bx + r * 0.1, by + r * 0.3).stroke(2, P.white);
        break;
      case 'fire':
        pen.begin().ell(bx, by, r, r).ink('#3a2a26', 3.2);
        for (let k = 0; k < 5; k++) { const a = this.t * 6 + k * 1.25; pen.begin().ell(bx + Math.cos(a) * r, by + Math.sin(a) * r, 8, 10).ink(k % 2 ? P.flame2 : P.flame3, 1.5); }
        ctx.fillStyle = 'rgba(255,140,60,0.6)'; ctx.beginPath(); ctx.arc(bx, by, r * 0.6, 0, 7); ctx.fill();
        break;
      default:
        pen.begin().ell(bx, by, r, r).ink('#3a3436', 3.2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(bx - 9, by - 9, 7, 5, -0.6, 0, 7); ctx.fill();
        for (let a = 0; a < 6; a++) { const sx = bx + Math.cos(a) * 18, sy = by + Math.sin(a) * 18; ctx.fillStyle = P.steelDark; ctx.beginPath(); ctx.arc(sx, sy, 2, 0, 7); ctx.fill(); }
    }
  }
  drawIntro(ctx: CanvasRenderingContext2D, W: number, H: number) {
    if (this.intro <= 0) return;
    const k = this.intro;
    const a = k > 2.2 ? (2.6 - k) / 0.4 : k < 0.4 ? k / 0.4 : 1;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(42,26,20,0.75)'; ctx.fillRect(0, H * 0.32, W, H * 0.3);
    inkText(ctx, this.cfg.name, W / 2, H * 0.43, this.cfg.name.length > 12 ? 52 : 64, P.gold, { outline: 8 });
    inkText(ctx, this.cfg.sub, W / 2, H * 0.54, 22, P.parchment, { outline: 4, font: '"Patrick Hand", sans-serif' });
    ctx.restore();
  }
}
