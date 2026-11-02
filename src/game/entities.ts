import { P } from '../render/palette';
import { pen, inkText, cel } from '../render/ink';
import { clamp, dist, rand, pick, lerp, TAU } from '../core/math';
import { Audio } from '../core/audio';
import type { World } from './world';
import type { ItemKind, PowerKind, EnemyKind, TargetKind } from './types';
import { GROUND } from './level';

// ===================================================================
// ITEMS (hookable loot)
// ===================================================================
export const ITEM_INFO: Record<ItemKind, { r: number; weight: number; label: string }> = {
  scrap: { r: 11, weight: 0.3, label: 'Scrap' },
  fuel: { r: 11, weight: 0.35, label: 'Fuel' },
  fabric: { r: 11, weight: 0.25, label: 'Fabric' },
  food: { r: 10, weight: 0.25, label: 'Food' },
  water: { r: 10, weight: 0.3, label: 'Water' },
  electronics: { r: 11, weight: 0.3, label: 'Electronics' },
  crate: { r: 16, weight: 1.0, label: 'Crate' },
  supply: { r: 17, weight: 1.1, label: 'Supply Crate' },
  mystery: { r: 15, weight: 0.8, label: 'Mystery Crate' },
  survivor: { r: 14, weight: 0.8, label: 'Survivor' },
  postcard: { r: 12, weight: 0.1, label: 'Postcard' },
  medicine: { r: 13, weight: 0.5, label: 'Medicine' },
};

export class Item {
  x: number; y: number; vx = 0; vy = 0;
  kind: ItemKind; r: number; weight: number;
  hooked = false; dead = false; resting = false; floating: boolean;
  tag?: string; t = rand(0, 10); look = Math.floor(rand(0, 4)); id?: string;
  bob = rand(0, TAU);
  constructor(x: number, y: number, kind: ItemKind, floating = false) {
    this.x = x; this.y = y; this.kind = kind; this.floating = floating;
    this.r = ITEM_INFO[kind].r; this.weight = ITEM_INFO[kind].weight;
  }
  update(w: World, dt: number) {
    this.t += dt;
    if (this.hooked) return;
    if (this.floating) { // drifting on a tiny parachute / balloon
      this.y += Math.sin(this.t * 2 + this.bob) * 8 * dt;
      this.x += w.windAt(this.x, this.y) * 0.2 * dt;
      return;
    }
    const sy = w.terrain.surfaceY(this.x) - this.r * 0.8;
    if (this.y < sy - 0.5 || this.vy < 0) {
      this.vy += 700 * dt; this.vx *= Math.exp(-1 * dt);
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.resting = false;
      const sy2 = w.terrain.surfaceY(this.x) - this.r * 0.8;
      if (this.y >= sy2) { this.y = sy2; if (this.vy > 120) { w.fx.dust(this.x, this.y + this.r, 3); Audio.thump(); } this.vy = this.vy > 160 ? -this.vy * 0.3 : 0; this.vx *= 0.6; }
    } else { this.y = sy; this.vx *= Math.exp(-6 * dt); this.x += this.vx * dt; this.resting = true; }
  }
  draw(ctx: CanvasRenderingContext2D, w: World) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.floating) {
      // tiny chute
      pen.begin().m(-14, -26).q(0, -44, 14, -26).q(7, -29, 0, -26).q(-7, -29, -14, -26).close().ink(this.kind === 'postcard' ? P.teal : P.parchment, 2);
      pen.begin().m(-13, -26).l(-4, -6).m(13, -26).l(4, -6).stroke(1.2);
      ctx.rotate(Math.sin(this.t * 2) * 0.12);
    }
    drawItemIcon(ctx, this.kind, this.r, this.t, this.look, this.hooked);
    // shimmer marker for objectives
    if (this.tag && !this.hooked) {
      const a = 0.5 + 0.5 * Math.sin(this.t * 5);
      ctx.globalAlpha = 0.5 + a * 0.5;
      inkText(ctx, '!', 0, -this.r - 18 - a * 4, 20, P.gold, { outline: 4 });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

export function drawItemIcon(ctx: CanvasRenderingContext2D, kind: ItemKind | string, r: number, t: number, look = 0, hooked = false) {
  pen.use(ctx, 0.6);
  switch (kind) {
    case 'scrap': {
      // gear + bolt
      const n = 8; const pts: number[][] = [];
      for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU + t * 0.2; const rr = i % 2 ? r * 0.75 : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      pen.begin().poly(pts).ink(P.steel, 2.2);
      pen.begin().ell(0, 0, r * 0.38, r * 0.38).ink(P.steelDark, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.4, r * 0.18, 0, 7); ctx.fill();
      pen.begin().rrect(r * 0.3, r * 0.1, r * 0.9, r * 0.45, 2).ink(P.brass, 1.6);
      break;
    }
    case 'fuel': {
      pen.begin().rrect(-r * 0.75, -r, r * 1.5, r * 2, 3).ink(P.red, 2.2);
      pen.begin().m(-r * 0.5, -r * 0.6).l(r * 0.5, r * 0.6).m(r * 0.5, -r * 0.6).l(-r * 0.5, r * 0.6).stroke(1.6, P.redDark);
      pen.begin().rrect(r * 0.15, -r * 1.35, r * 0.45, r * 0.4, 1).ink(P.steel, 1.6);
      pen.begin().m(-r * 0.6, -r * 0.95).q(-r * 0.2, -r * 1.5, r * 0.1, -r * 0.95).stroke(2.2);
      break;
    }
    case 'fabric': {
      pen.begin().rrect(-r, -r * 0.6, r * 2, r * 1.2, r * 0.5).ink(P.teal, 2.2);
      pen.begin().ell(r * 0.85, 0, r * 0.3, r * 0.6).ink(P.tealLight, 1.8);
      pen.begin().m(-r * 0.6, -r * 0.6).l(-r * 0.6, r * 0.6).m(0, -r * 0.6).l(0, r * 0.6).stroke(1.4, P.parchment);
      break;
    }
    case 'food': {
      pen.begin().rrect(-r * 0.7, -r * 0.9, r * 1.4, r * 1.8, 2).ink(P.steelLight, 2.2);
      pen.begin().rect(-r * 0.7, -r * 0.45, r * 1.4, r * 0.9).ink(P.orange, 1.6);
      pen.begin().ell(0, 0, r * 0.3, r * 0.3).fill(P.parchment);
      break;
    }
    case 'water': {
      pen.begin().m(-r * 0.3, -r).l(r * 0.3, -r).l(r * 0.3, -r * 0.6).q(r * 0.9, -r * 0.4, r * 0.85, r * 0.3).q(r * 0.8, r, 0, r).q(-r * 0.8, r, -r * 0.85, r * 0.3).q(-r * 0.9, -r * 0.4, -r * 0.3, -r * 0.6).close().ink('rgba(170,215,220,0.9)', 2.2);
      pen.begin().m(-r * 0.7, r * 0.1).q(0, -r * 0.05, r * 0.7, r * 0.1).l(r * 0.6, r * 0.8).l(-r * 0.6, r * 0.8).close().fill(P.teal);
      pen.begin().rect(-r * 0.35, -r * 1.25, r * 0.7, r * 0.3).ink(P.brownLight, 1.5);
      break;
    }
    case 'electronics': {
      pen.begin().rrect(-r, -r * 0.7, r * 2, r * 1.4, 3).ink(P.brown, 2.2);
      pen.begin().ell(-r * 0.4, 0, r * 0.38, r * 0.38).ink(P.parchment, 1.6);
      pen.begin().m(-r * 0.4, 0).l(-r * 0.25, -r * 0.25).stroke(1.2);
      pen.begin().rect(r * 0.15, -r * 0.4, r * 0.6, r * 0.8).ink(P.steelDark, 1.4);
      pen.begin().m(r * 0.5, -r * 0.7).l(r * 0.9, -r * 1.4).stroke(1.6);
      ctx.fillStyle = Math.sin(t * 6) > 0 ? P.electric : P.tealLight; ctx.beginPath(); ctx.arc(r * 0.9, -r * 1.4, 2.2, 0, 7); ctx.fill();
      break;
    }
    case 'crate': case 'supply': case 'mystery': case 'medicine': {
      const col = kind === 'supply' ? P.olive : kind === 'medicine' ? P.parchment : P.brownLight;
      pen.begin().rect(-r, -r, r * 2, r * 2).ink(col, 2.6);
      pen.begin().m(-r, -r).l(r, r).m(-r + 3, -r).l(-r + 3, r).m(r - 3, -r).l(r - 3, r).stroke(1.6, kind === 'supply' ? P.oliveDark : P.brown);
      if (kind === 'supply') { pen.begin().rect(-r * 0.8, -r * 0.35, r * 1.6, r * 0.7).ink(P.parchment, 1.5); ctx.font = `${r * 0.4}px "Luckiest Guy", Impact`; ctx.fillStyle = P.redDark; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SUPPLY', 0, 1); }
      if (kind === 'medicine') { pen.begin().rect(-r * 0.2, -r * 0.6, r * 0.4, r * 1.2).fill(P.red); pen.begin().rect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.4).fill(P.red); }
      if (kind === 'mystery') { inkText(ctx, '?', 0, 2, r * 1.3, P.gold, { outline: 3, shadow: false }); }
      break;
    }
    case 'postcard': {
      ctx.save(); ctx.rotate(-0.1);
      pen.begin().rect(-r * 1.2, -r * 0.8, r * 2.4, r * 1.6).ink(P.paper, 2);
      pen.begin().rect(-r * 1.0, -r * 0.6, r * 1.1, r * 1.2).fill(P.tealLight);
      pen.begin().ell(-r * 0.45, -r * 0.1, r * 0.3, r * 0.3).fill(P.gold);
      pen.begin().m(r * 0.3, -r * 0.3).l(r, -r * 0.3).m(r * 0.3, 0).l(r, 0).m(r * 0.3, r * 0.3).l(r * 0.8, r * 0.3).stroke(1.2, P.inkSoft);
      pen.begin().rect(r * 0.65, -r * 0.65, r * 0.4, r * 0.35).fill(P.red);
      ctx.restore();
      break;
    }
    case 'survivor': {
      // little survivor waving (or clinging when hooked)
      const coats = [P.teal, P.olive, P.purple, P.red];
      const hair = [P.ink, P.brownDark, P.gold, P.steelLight];
      const wave = Math.sin(t * 9) * 0.6;
      // legs
      if (hooked) { const k = Math.sin(t * 14) * 4; pen.begin().m(-3, 8).l(-5 + k, 18).m(3, 8).l(5 - k, 18).stroke(3); }
      else pen.begin().m(-3, 8).l(-4, 14).m(3, 8).l(4, 14).stroke(3);
      pen.begin().m(-7, 9).q(-8, -4, 0, -5).q(8, -4, 7, 9).close().ink(coats[look % 4], 2.2);
      // arms
      if (hooked) pen.begin().m(-5, -2).l(-3, -14).m(5, -2).l(3, -14).stroke(3);
      else { pen.begin().m(5, -2).l(12, -12 + wave * 4).stroke(3); pen.begin().ell(12, -13 + wave * 4, 2.6, 2.6).ink(P.glove, 1.5); pen.begin().m(-5, -2).l(-8, 6).stroke(3); }
      pen.begin().ell(0, -11, 6.5, 6.5).ink(P.skin, 2);
      pen.begin().m(-6.5, -13).q(0, -21, 6.5, -13).q(0, -15, -6.5, -13).close().ink(hair[look % 4], 1.8);
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(-2, -11, 1.1, 0, 7); ctx.arc(2.5, -11, 1.1, 0, 7); ctx.fill();
      pen.begin().m(-2, -7.5).q(0.5, hooked ? -9 : -5.5, 3, -7.5).stroke(1.3);
      if (!hooked && Math.sin(t * 2.3) > 0.6) { inkText(ctx, 'HELP!', 0, -34, 13, P.parchment, { outline: 3, font: '"Luckiest Guy", Impact' }); }
      break;
    }
  }
}

// ===================================================================
// POWER-UPS (floating on tiny balloons)
// ===================================================================
export const POWER_INFO: Record<PowerKind, { name: string; color: string; dur: number }> = {
  cluster: { name: 'TRIPLE TROUBLE!', color: P.red, dur: 15 },
  shield: { name: 'TIN UMBRELLA!', color: P.teal, dur: 0 },
  hotair: { name: 'HOT AIR!', color: P.orange, dur: 10 },
  bombs: { name: 'BOMBS AWAY!', color: P.olive, dur: 0 },
};
export class PowerUp {
  x: number; y: number; kind: PowerKind; dead = false; t = rand(0, 6); r = 16; baseY: number;
  constructor(x: number, y: number, kind: PowerKind) { this.x = x; this.y = y; this.baseY = y; this.kind = kind; }
  update(_w: World, dt: number) { this.t += dt; this.y = this.baseY + Math.sin(this.t * 2.2) * 10; }
  draw(ctx: CanvasRenderingContext2D) {
    const info = POWER_INFO[this.kind];
    ctx.save(); ctx.translate(this.x, this.y);
    pen.use(ctx, 0.6);
    // little balloon
    pen.begin().m(0, -12).q(-4, -18, 0, -22).stroke(1.2);
    pen.begin().ell(0, -34, 11, 13).ink(info.color, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(-4, -38, 3, 4, -0.4, 0, 7); ctx.fill();
    // badge
    const s = 1 + Math.sin(this.t * 6) * 0.06;
    ctx.scale(s, s);
    pen.begin().ell(0, 0, 13, 13).ink(P.parchment, 2.4);
    pen.begin().ell(0, 0, 9.5, 9.5).stroke(1.2, info.color);
    if (this.kind === 'cluster') { for (const [bx, by] of [[-4, 3], [4, 3], [0, -4]]) { pen.begin().ell(bx, by, 3.6, 3.6).fill(P.ink); } }
    else if (this.kind === 'shield') { pen.begin().m(-8, 2).q(0, -12, 8, 2).close().ink(P.teal, 1.5); pen.begin().m(0, 2).l(0, 8).q(2, 10, 3, 8).stroke(1.5); }
    else if (this.kind === 'hotair') { pen.begin().m(-5, 6).q(-7, -2, 0, -9).q(7, -2, 5, 6).close().ink(P.flame2, 1.5); pen.begin().m(-2, 5).q(-3, 0, 0, -3).q(3, 0, 2, 5).close().fill(P.flame1); }
    else { pen.begin().ell(0, 1, 6, 6).fill(P.ink); pen.begin().m(3, -4).q(6, -8, 8, -6).stroke(1.5, P.brown); inkText(ctx, '+', 7, 6, 10, P.gold, { outline: 2, shadow: false }); }
    ctx.restore();
  }
}

// ===================================================================
// DESTRUCTIBLE TARGETS
// ===================================================================
export class Target {
  x: number; y: number; kind: TargetKind; hp: number; maxHp: number; dead = false; tag?: string;
  w: number; h: number; t = 0; hitFlash = 0; marked = false;
  constructor(x: number, y: number, kind: TargetKind, tag?: string) {
    this.x = x; this.y = y; this.kind = kind; this.tag = tag;
    const def: Record<TargetKind, [number, number, number]> = { barricade: [3, 90, 46], junkpile: [1, 70, 34], siren: [5, 44, 110], cratestack: [1, 54, 46], depot: [4, 100, 60] };
    [this.hp, this.w, this.h] = def[kind]; this.maxHp = this.hp;
    this.marked = !!tag;
  }
  get cx() { return this.x; } get cy() { return this.y - this.h / 2; }
  get r() { return Math.max(this.w, this.h) * 0.5; }
  contains(px: number, py: number, pad = 0) { return px > this.x - this.w / 2 - pad && px < this.x + this.w / 2 + pad && py > this.y - this.h - pad && py < this.y + pad; }
  damage(w: World, n: number) {
    if (this.dead) return;
    this.hp -= n; this.hitFlash = 0.15;
    w.fx.sparks(this.x + rand(-10, 10), this.y - this.h * 0.6, 5, P.gold);
    if (this.hp <= 0) {
      this.dead = true;
      w.onTargetDestroyed(this);
    } else Audio.clank();
  }
  update(_w: World, dt: number) { this.t += dt; this.hitFlash = Math.max(0, this.hitFlash - dt); }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.translate(this.x, this.y);
    if (this.hitFlash > 0) ctx.translate(rand(-2, 2), 0);
    pen.use(ctx, 0.6);
    const { w, h } = this;
    switch (this.kind) {
      case 'barricade': {
        // tyres, planks, a sign
        for (const [tx, ty] of [[-30, -10], [-12, -10], [-21, -26]]) { pen.begin().ell(tx, ty, 10, 10).ink('#2c2a2c', 2.4); pen.begin().ell(tx, ty, 4, 4).fill(P.brownDark); }
        pen.begin().poly([[-6, 0], [40, 0], [44, -30], [0, -34]]).ink(P.brownLight, 2.4);
        pen.begin().m(0, -12).l(42, -10).m(2, -24).l(43, -21).stroke(1.5, P.brown);
        ctx.save(); ctx.translate(26, -40); ctx.rotate(0.12);
        pen.begin().rect(-22, -12, 44, 22).ink(P.parchment, 2.2);
        ctx.font = '11px "Luckiest Guy", Impact'; ctx.fillStyle = P.red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('KEEP OUT', 0, 0);
        ctx.restore();
        pen.begin().m(-44, 0).l(-38, -20).l(-26, -40).stroke(3, P.rust);
        break;
      }
      case 'junkpile': {
        pen.begin().m(-w / 2, 0).q(-w / 4, -h, 0, -h).q(w / 4, -h, w / 2, 0).close().ink(P.rust, 2.4);
        for (let i = 0; i < 6; i++) { const a = i * 1.7; pen.begin().ell(Math.cos(a) * w * 0.25, -h * 0.4 + Math.sin(a) * h * 0.2, 5, 4).ink(pick([P.steel, P.steelDark, P.brass]), 1.4); }
        pen.begin().m(-8, -h + 4).l(6, -h - 10).stroke(3, P.steelDark);
        break;
      }
      case 'cratestack': {
        for (const [cx, cy, s] of [[-14, -11, 11], [12, -11, 11], [-1, -33, 11]]) { pen.begin().rect(cx - s, cy - s, s * 2, s * 2).ink(P.brownLight, 2.2); pen.begin().m(cx - s, cy - s).l(cx + s, cy + s).stroke(1.3, P.brown); }
        break;
      }
      case 'siren': {
        // scavenger siren tower: blares to call buzzards
        pen.begin().m(-18, 0).l(-6, -h + 20).l(6, -h + 20).l(18, 0).stroke(4, P.steelDark);
        pen.begin().m(-14, -20).l(14, -40).m(14, -20).l(-14, -40).m(-11, -50).l(11, -70).m(11, -50).l(-11, -70).stroke(2, P.steelDark);
        pen.begin().rect(-16, -h + 4, 32, 18).ink(P.red, 2.4);
        const blare = Math.sin(this.t * 10) > 0;
        pen.begin().m(16, -h + 8).l(30, -h + 2).l(30, -h + 26).l(16, -h + 18).close().ink(P.brass, 2.2);
        if (blare) { ctx.strokeStyle = P.gold; ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(30, -h + 14, i * 8, -0.6, 0.6); ctx.stroke(); } }
        ctx.fillStyle = blare ? P.hot : P.redDark; ctx.beginPath(); ctx.arc(0, -h + 2, 5, 0, 7); ctx.fill();
        break;
      }
      case 'depot': {
        pen.begin().rect(-w / 2, -h, w, h).ink(P.oliveDark, 3);
        for (let i = -2; i <= 2; i++) pen.begin().m(i * 18, -h).l(i * 18, 0).stroke(1.5, P.olive);
        pen.begin().m(-w / 2 - 6, -h).l(0, -h - 22).l(w / 2 + 6, -h).close().ink(P.rust, 3);
        pen.begin().rect(-16, -30, 32, 30).ink('#2a2426', 2);
        for (const bx of [-36, 36]) { pen.begin().rrect(bx - 9, -26, 18, 26, 4).ink(P.red, 2); pen.begin().m(bx - 9, -14).l(bx + 9, -14).stroke(1.5, P.redDark); }
        break;
      }
    }
    if (this.marked) {
      const a = 0.5 + 0.5 * Math.sin(this.t * 5);
      // target reticle
      ctx.strokeStyle = `rgba(226,73,58,${0.5 + a * 0.4})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -h / 2, Math.max(w, h) * 0.6 + a * 4, 0, TAU); ctx.stroke();
      inkText(ctx, '!', 0, -h - 30 - a * 4, 22, P.redBright, { outline: 4 });
    }
    if (this.hp < this.maxHp && this.maxHp > 1) {
      const bw = 40; ctx.fillStyle = P.ink; ctx.fillRect(-bw / 2 - 2, -h - 12, bw + 4, 7);
      ctx.fillStyle = P.redBright; ctx.fillRect(-bw / 2, -h - 10, bw * (this.hp / this.maxHp), 3);
    }
    ctx.restore();
  }
}

// ===================================================================
// ENEMIES
// ===================================================================
export class Enemy {
  x: number; y: number; vx = 0; vy = 0; kind: EnemyKind; hp: number; maxHp: number; dead = false; dying = 0;
  state = 'idle'; st = 0; cd = rand(1, 2.5); t = rand(0, 10); facing = -1; r: number; hitFlash = 0; aim = -Math.PI / 2;
  homeX: number; homeY: number; patrol: number; active = false; tag?: string; hookCd = 0;
  constructor(x: number, y: number, kind: EnemyKind, patrol = 200) {
    this.x = x; this.y = y; this.kind = kind; this.homeX = x; this.homeY = y; this.patrol = patrol;
    const hp: Record<EnemyKind, number> = { buzzard: 1, turret: 3, buggy: 3, gyro: 2, mine: 1, snapper: 2, moth: 1 };
    this.hp = this.maxHp = hp[kind];
    this.r = ({ buzzard: 15, turret: 22, buggy: 24, gyro: 22, mine: 15, snapper: 20, moth: 16 } as Record<EnemyKind, number>)[kind];
  }
  get cy() { return this.kind === 'turret' || this.kind === 'buggy' ? this.y - 16 : this.kind === 'snapper' ? this.y - 20 - this.lunge * 130 : this.y; }
  lunge = 0; style = 'city';
  damage(w: World, n: number, src: 'bomb' | 'hook' | 'ram' = 'bomb') {
    if (this.dead || this.dying > 0) return;
    this.hp -= n; this.hitFlash = 0.18;
    if (this.kind === 'buzzard') w.fx.feathers(this.x, this.y, 4);
    if (this.hp <= 0) {
      this.dying = 0.01;
      if (this.kind === 'buzzard' || this.kind === 'gyro' || this.kind === 'moth') { this.vy = -120; this.vx = rand(-60, 60); Audio.squawk(); }
      else { w.fx.explosion(this.x, this.cy, 1.1, pick(['KA-BLAM!', 'KRUNCH!', 'BOOM!'])); Audio.explosion(1.1); this.dead = true; w.onEnemyDestroyed(this); }
      if (src === 'hook') w.fx.burst(this.x, this.y - 20, 'WHACK!', 24);
    } else { Audio.clank(); if (src === 'hook') w.fx.burst(this.x, this.y - 20, 'BONK!', 20); }
  }
  update(w: World, dt: number) {
    this.t += dt; this.hitFlash = Math.max(0, this.hitFlash - dt); this.hookCd = Math.max(0, this.hookCd - dt);
    const p = w.player;
    const dx = p.x - this.x;
    if (!this.active) { if (Math.abs(dx) < w.viewW * 0.75) this.active = true; else return; }
    if (this.dying > 0) {
      // spiralling crash for flyers
      this.dying += dt; this.vy += 500 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (Math.random() < 0.5) w.fx.puff(this.x, this.y, 1, P.smoke, 6);
      if (this.y >= w.terrain.surfaceY(this.x) - 6 || this.dying > 3) {
        w.fx.explosion(this.x, this.y, 0.8, pick(['KRASH!', 'CLONK!', 'POW!'])); Audio.explosion(0.8);
        this.dead = true; w.onEnemyDestroyed(this);
      }
      return;
    }
    this.cd -= dt; this.st += dt;
    switch (this.kind) {
      case 'buzzard': this.updBuzzard(w, dt); break;
      case 'turret': this.updTurret(w, dt); break;
      case 'buggy': this.updBuggy(w, dt); break;
      case 'gyro': this.updGyro(w, dt); break;
      case 'mine': this.updMine(w, dt); break;
      case 'snapper': this.updSnapper(w, dt); break;
      case 'moth': this.updMoth(w, dt); break;
    }
  }
  private updBuzzard(w: World, dt: number) {
    const p = w.player; const tx = p.x, ty = p.y - 70;
    const d = dist(this.x, this.y, tx, ty);
    if (this.state === 'idle') {
      this.x = this.homeX + Math.sin(this.t * 0.8) * 60; this.y = this.homeY + Math.sin(this.t * 2.1) * 14;
      if (d < 460) { this.state = 'approach'; this.st = 0; Audio.squawk(); }
    } else if (this.state === 'approach') {
      const side = this.x < p.x ? -1 : 1;
      const gx = p.x + side * 150, gy = p.y - 150 + Math.sin(this.t * 3) * 20;
      this.vx = lerp(this.vx, (gx - this.x) * 2.2, 1 - Math.exp(-3 * dt));
      this.vy = lerp(this.vy, (gy - this.y) * 2.2, 1 - Math.exp(-3 * dt));
      this.vx = clamp(this.vx, -260, 260); this.vy = clamp(this.vy, -200, 200);
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.facing = p.x > this.x ? 1 : -1;
      if (this.st > 1.6 && Math.abs(gx - this.x) < 60) { this.state = 'windup'; this.st = 0; Audio.squawk(); }
    } else if (this.state === 'windup') {
      this.vx *= 0.9; this.vy = -30; this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.st > 0.65) {
        this.state = 'dive'; this.st = 0;
        const a = Math.atan2(ty - this.y, tx - this.x);
        this.vx = Math.cos(a) * 330; this.vy = Math.sin(a) * 330;
      }
    } else if (this.state === 'dive') {
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.st > 0.9) { this.state = 'recover'; this.st = 0; }
    } else if (this.state === 'recover') {
      this.vy = lerp(this.vy, -120, 1 - Math.exp(-3 * dt)); this.vx *= Math.exp(-1 * dt);
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.st > 1.1) { this.state = 'approach'; this.st = 0; }
    }
    const sy = w.terrain.surfaceY(this.x) - 20;
    if (this.y > sy) { this.y = sy; this.vy = -Math.abs(this.vy) * 0.5; }
  }
  private updTurret(w: World, dt: number) {
    const p = w.player;
    const tx = p.x + p.vx * 0.6, ty = p.y - 60 + p.vy * 0.4;
    const want = Math.atan2(ty - (this.y - 22), tx - this.x);
    const clampA = clamp(want, -Math.PI + 0.25, -0.25);
    this.aim = lerp(this.aim, clampA, 1 - Math.exp(-4 * dt));
    const d = dist(this.x, this.y, p.x, p.y);
    if (this.state === 'idle' && this.cd <= 0 && d < 560 && p.y < this.y - 40) { this.state = 'windup'; this.st = 0; }
    if (this.state === 'windup' && this.st > 0.75) {
      this.state = 'idle'; this.cd = rand(2.2, 3.0);
      const bx = this.x + Math.cos(this.aim) * 34, by = this.y - 22 + Math.sin(this.aim) * 34;
      const fuse = clamp(dist(bx, by, tx, ty) / 300, 0.4, 2.0);
      w.projectiles.push(new Projectile(bx, by, Math.cos(this.aim) * 300, Math.sin(this.aim) * 300, 'flak', fuse));
      w.fx.puff(bx, by, 4, P.smokeLight, 9); Audio.thump();
    }
  }
  private updBuggy(w: World, dt: number) {
    const p = w.player;
    const above = Math.abs(p.x - this.x) < 300 && p.y < this.y - 60;
    if (this.state === 'idle') {
      const speed = 70;
      if (this.vx === 0) this.vx = speed * this.facing;
      if (this.x < this.homeX - this.patrol) this.vx = speed; if (this.x > this.homeX + this.patrol) this.vx = -speed;
      this.facing = Math.sign(this.vx) || 1;
      this.x += this.vx * dt;
      if (above && this.cd <= 0) { this.state = 'windup'; this.st = 0; }
    } else if (this.state === 'windup') {
      if (this.st > 0.7) {
        this.state = 'idle'; this.cd = rand(2.6, 3.4);
        // ballistic lob toward player
        const T = 1.15, g = 380;
        const tx = p.x + p.vx * T, ty = p.y - 40 + p.vy * T * 0.5;
        const sx = this.x, sy = this.y - 30;
        const vx = (tx - sx) / T, vy = (ty - sy - 0.5 * g * T * T) / T;
        w.projectiles.push(new Projectile(sx, sy, vx, vy, this.style === 'frozen' ? 'snow' : 'mortar', 4));
        w.fx.puff(sx, sy, 4); Audio.thump();
      }
    }
    this.y = w.terrain.floorY(this.x);
  }
  private updMine(w: World, dt: number) {
    const sy = w.terrain.surfaceY(this.x);
    this.y = sy - 4 + Math.sin(this.t * 2) * 3;
    if (w.player.hitTest(this.x, this.y, this.r + 2)) {
      w.player.hit(w, 1, this.x, this.y, 'mine');
      this.hp = 0; this.dead = true; w.fx.explosion(this.x, this.y, 1, 'KA-SPLOOSH!'); Audio.explosion(1); w.onEnemyDestroyed(this);
    }
  }
  private updSnapper(w: World, dt: number) {
    const p = w.player;
    const by = p.y + 20; // basket bottom
    if (this.state === 'idle') {
      this.lunge = Math.max(0, this.lunge - dt * 2);
      if (this.cd <= 0 && Math.abs(p.x - this.x) < 80 && by > this.y - 190 && by < this.y) { this.state = 'windup'; this.st = 0; Audio.squawk(); }
    } else if (this.state === 'windup') {
      if (this.st > 0.55) { this.state = 'dive'; this.st = 0; Audio.puff(); }
    } else if (this.state === 'dive') {
      this.lunge = Math.min(1, this.lunge + dt * 6);
      if (p.hitTest(this.x, this.cy, 18)) { p.hit(w, 1, this.x, this.cy, 'snapper'); w.fx.burst(this.x, this.cy - 20, 'CHOMP!', 22); }
      if (this.st > 0.45) { this.state = 'idle'; this.cd = 1.6; }
    }
  }
  private updMoth(w: World, dt: number) {
    const p = w.player;
    const d = dist(this.x, this.y, p.x, p.y - 80);
    if (this.state === 'idle') { this.x = this.homeX + Math.sin(this.t * 0.7) * 50; this.y = this.homeY + Math.sin(this.t * 1.9) * 20; if (d < 420) this.state = 'approach'; return; }
    const ang = Math.atan2(p.y - 80 - this.y, p.x - this.x) + Math.sin(this.t * 3) * 0.9;
    const sp = this.state === 'dive' ? 190 : 95;
    this.vx = lerp(this.vx, Math.cos(ang) * sp, 1 - Math.exp(-2 * dt)); this.vy = lerp(this.vy, Math.sin(ang) * sp, 1 - Math.exp(-2 * dt));
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.facing = this.vx > 0 ? 1 : -1;
    if (this.state === 'approach' && d < 160 && this.st > 1.2) { this.state = 'dive'; this.st = 0; }
    if (this.state === 'dive' && this.st > 1.1) { this.state = 'approach'; this.st = 0; }
  }
  private updGyro(w: World, dt: number) {
    const p = w.player;
    const side = this.x < p.x ? -1 : 1;
    const gx = p.x + side * 260, gy = clamp(p.y - 120, -200, 330);
    this.vx = lerp(this.vx, clamp((gx - this.x) * 1.2, -150, 150), 1 - Math.exp(-2 * dt));
    this.vy = lerp(this.vy, clamp((gy - this.y) * 1.2, -100, 100), 1 - Math.exp(-2 * dt));
    this.x += this.vx * dt; this.y += this.vy * dt + Math.sin(this.t * 3) * 0.4;
    this.facing = p.x > this.x ? 1 : -1;
    if (this.state === 'idle' && this.cd <= 0 && Math.abs(p.x - this.x) < 420) { this.state = 'windup'; this.st = 0; }
    if (this.state === 'windup' && this.st > 0.6) {
      this.state = 'idle'; this.cd = rand(2.2, 3.0);
      const T = 0.9, g = 380;
      const tx = p.x + p.vx * T, ty = p.y - 50;
      const vx = (tx - this.x) / T, vy = (ty - this.y - 0.5 * g * T * T) / T;
      w.projectiles.push(new Projectile(this.x, this.y, vx, vy, 'wrench', 4));
    }
  }
  draw(ctx: CanvasRenderingContext2D, w: World) {
    ctx.save(); ctx.translate(this.x, this.y);
    if (this.hitFlash > 0) { ctx.translate(rand(-2, 2), rand(-2, 2)); }
    pen.use(ctx, 0.7);
    const wind = this.state === 'windup';
    switch (this.kind) {
      case 'buzzard': {
        // tin buzzard: riveted mechanical crow
        ctx.scale(this.facing, 1);
        if (this.dying > 0) ctx.rotate(this.dying * 8);
        if (this.state === 'dive') ctx.rotate(Math.atan2(this.vy, Math.abs(this.vx)) * 0.6);
        const flap = Math.sin(this.t * (this.state === 'dive' ? 4 : 16));
        // back wing
        pen.begin().m(-2, -4).q(-10, -18 - flap * 12, -26, -14 - flap * 18).q(-16, -6, -4, 2).close().ink(P.steelDark, 2.2);
        // body
        pen.begin().m(-20, 2).q(-14, -10, 2, -10).q(14, -10, 16, -2).q(10, 8, -6, 8).q(-14, 8, -20, 2).close().ink(this.hitFlash > 0 ? P.white : P.steel, 2.6);
        cel(ctx, () => pen.begin().m(-20, 2).q(-14, -10, 2, -10).q(14, -10, 16, -2).q(10, 8, -6, 8).q(-14, 8, -20, 2).close(), () => { ctx.fillStyle = 'rgba(30,20,30,0.3)'; ctx.fillRect(-22, 1, 44, 10); });
        ctx.fillStyle = P.steelDark; for (let i = -12; i < 10; i += 6) { ctx.beginPath(); ctx.arc(i, 0, 1.3, 0, 7); ctx.fill(); }
        // tail prop
        pen.begin().m(-20, 2).l(-28, -2).l(-28, 6).close().ink(P.rust, 2);
        // head + beak
        pen.begin().ell(14, -8, 8, 7).ink(P.steel, 2.4);
        pen.begin().m(20, -10).l(32, -6 + (wind ? 2 : 0)).l(20, -4).close().ink(P.gold, 2);
        if (wind) pen.begin().m(20, -6).l(30, -1).l(20, -3).close().ink(P.goldDark, 1.5);
        // eye
        pen.begin().ell(16, -10, 3.4, 3.4).ink(P.white, 1.5);
        ctx.fillStyle = wind || this.state === 'dive' ? P.hot : P.ink; ctx.beginPath(); ctx.arc(17, -10, 1.6, 0, 7); ctx.fill();
        pen.begin().m(11, -15).l(20, -12).stroke(2.4); // angry brow
        // front wing
        pen.begin().m(0, -4).q(-6, -20 - flap * 14, -20, -18 - flap * 20).q(-12, -6, 2, 2).close().ink(P.steelLight, 2.4);
        if (wind) { ctx.scale(this.facing, 1); inkText(ctx, '!', 0, -36, 20, P.redBright, { outline: 4 }); }
        break;
      }
      case 'turret': {
        // flak cannon on a sandbag ring
        ctx.save(); ctx.translate(0, -22); ctx.rotate(this.aim);
        const recoil = this.state === 'idle' && this.cd > 1.9 ? -6 : 0;
        pen.begin().rrect(recoil, -6, 38, 12, 3).ink(this.hitFlash > 0 ? P.white : P.oliveDark, 2.6);
        pen.begin().rect(recoil + 32, -8, 8, 16).ink(P.steelDark, 2.2);
        if (wind) { ctx.fillStyle = Math.sin(this.t * 30) > 0 ? P.flame2 : P.hot; ctx.beginPath(); ctx.arc(recoil + 40, 0, 5, 0, 7); ctx.fill(); }
        ctx.restore();
        pen.begin().m(-22, 0).q(-22, -30, 0, -30).q(22, -30, 22, 0).close().ink(P.olive, 2.6);
        pen.begin().ell(0, -22, 7, 7).ink(P.steel, 2);
        for (const sx of [-26, -12, 2, 16]) pen.begin().ell(sx + 5, -3, 9, 6).ink(P.parchmentShade, 2);
        // little scav gunner peeking
        pen.begin().ell(-10, -30, 6, 6).ink(P.skin, 1.8);
        pen.begin().m(-17, -31).q(-10, -42, -3, -31).close().ink(P.steelDark, 1.8);
        ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(-8, -29, 1.2, 0, 7); ctx.fill();
        if (wind) inkText(ctx, '!', 0, -58, 20, P.redBright, { outline: 4 });
        break;
      }
      case 'buggy': {
        ctx.scale(this.facing, 1);
        const bounce = Math.abs(Math.sin(this.t * 10)) * 2;
        ctx.translate(0, -bounce);
        // mortar tube
        ctx.save(); ctx.translate(-6, -26); ctx.rotate(wind ? -1.1 : -0.7);
        pen.begin().rrect(0, -5, 26, 10, 2).ink(P.steelDark, 2.2);
        ctx.restore();
        // body
        pen.begin().m(-30, -6).l(-26, -24).l(8, -24).l(16, -14).l(30, -12).l(30, -2).l(-30, -2).close().ink(this.hitFlash > 0 ? P.white : P.rust, 2.6);
        pen.begin().m(-20, -18).l(0, -18).stroke(2, P.rustDark);
        // driver
        pen.begin().ell(6, -32, 7, 7).ink(P.skin, 2);
        pen.begin().m(-1, -34).q(6, -44, 13, -34).close().ink(P.steelDark, 2);
        pen.begin().m(2, -33).l(12, -33).stroke(3, P.brass);
        // wheels
        if (this.style === 'flood') { pen.begin().m(-36, -4).l(36, -4).q(30, 10, 20, 10).l(-26, 10).q(-34, 6, -36, -4).close().ink(P.parchmentShade, 2.4); pen.begin().m(-30, 2).l(28, 2).stroke(1.5, P.red); }
        else for (const wx of [-20, 20]) { ctx.save(); ctx.translate(wx, -2); ctx.rotate(this.x / 10); pen.begin().ell(0, 0, 9, 9).ink('#2c2a2c', 2.4); pen.begin().m(-6, 0).l(6, 0).m(0, -6).l(0, 6).stroke(1.6, P.steel); ctx.restore(); }
        if (this.style === 'frozen') pen.begin().m(30, -2).l(40, -18).l(42, 2).close().ink(P.steelLight, 2);
        // exhaust
        if (Math.random() < 0.2) w.fx.puff(this.x - this.facing * 32, this.y - 8, 1, P.smoke, 4);
        if (wind) { ctx.scale(this.facing, 1); inkText(ctx, '!', 0, -56, 20, P.redBright, { outline: 4 }); }
        break;
      }
      case 'mine': {
        const r = 13;
        pen.begin().ell(0, 0, r, r).ink(this.style === 'flood' ? '#3a3436' : P.steelDark, 2.6);
        for (let a = 0; a < 8; a++) { const ca = Math.cos(a * 0.785), sa = Math.sin(a * 0.785); pen.begin().m(ca * r, sa * r).l(ca * (r + 6), sa * (r + 6)).stroke(3); }
        ctx.fillStyle = Math.sin(this.t * 6) > 0 ? P.hot : P.redDark; ctx.beginPath(); ctx.arc(0, -4, 3, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-5, -5, 3, 0, 7); ctx.fill();
        break;
      }
      case 'snapper': {
        const L = this.lunge * 130 + (wind ? Math.sin(this.t * 40) * 3 : 0);
        // leafy base
        for (const s2 of [-1, 1]) pen.begin().m(0, 0).q(s2 * 22, -6, s2 * 30, 4).q(s2 * 14, 6, 0, 0).close().ink('#4f7a2a', 2);
        // stem
        pen.begin().m(0, 0).q(Math.sin(this.t * 2) * 8, -L * 0.5 - 10, 0, -L - 20).stroke(7, P.ink);
        pen.begin().m(0, 0).q(Math.sin(this.t * 2) * 8, -L * 0.5 - 10, 0, -L - 20).stroke(4, '#5f8a32');
        // jaws
        ctx.save(); ctx.translate(0, -L - 26);
        const open = this.state === 'dive' ? 0.15 : wind ? 0.9 : 0.5 + Math.sin(this.t * 3) * 0.1;
        for (const s2 of [-1, 1]) {
          ctx.save(); ctx.rotate(s2 * open);
          pen.begin().m(0, 0).q(s2 * 4, -26, s2 * 20, -22).q(s2 * 14, -6, 0, 0).close().ink(this.hitFlash > 0 ? P.white : '#8ab04a', 2.4);
          pen.begin().m(0, -2).q(s2 * 4, -20, s2 * 16, -19).stroke(2, P.redBright);
          for (let k = 0; k < 4; k++) { const tx = s2 * (4 + k * 4), ty = -10 - k * 3; pen.begin().m(tx, ty).l(tx - s2 * 4, ty - 4).stroke(1.5, P.white); }
          ctx.restore();
        }
        ctx.restore();
        if (wind) inkText(ctx, '!', 0, -L - 70, 20, P.redBright, { outline: 4 });
        break;
      }
      case 'moth': {
        ctx.scale(this.facing, 1);
        if (this.dying > 0) ctx.rotate(this.dying * 6);
        const flap = Math.sin(this.t * 14);
        for (const s2 of [1, -1]) {
          pen.begin().m(0, 0).q(-10, -20 * s2 * (0.5 + flap * 0.5) - 6, -26, -18 * s2 * (0.4 + flap * 0.6)).q(-20, 4, 0, 4).close().ink(s2 > 0 ? '#c8a878' : '#a88858', 2.2);
          ctx.fillStyle = P.purple; ctx.beginPath(); ctx.arc(-14, -10 * s2 * (0.4 + flap * 0.6), 4, 0, 7); ctx.fill();
        }
        pen.begin().ell(2, 0, 12, 7).ink(this.hitFlash > 0 ? P.white : '#7a6a4a', 2.2);
        pen.begin().ell(14, -2, 6, 6).ink('#7a6a4a', 2);
        pen.begin().ell(16, -3, 2.6, 2.6).fill(P.hot);
        pen.begin().m(15, -7).q(20, -18, 26, -14).m(13, -7).q(14, -18, 20, -18).stroke(1.4);
        break;
      }
      case 'gyro': {
        ctx.scale(this.facing, 1);
        if (this.dying > 0) ctx.rotate(this.dying * 6);
        // rotor
        const rs = Math.sin(this.t * 40) * 34;
        pen.begin().m(0, -24).l(0, -32).stroke(2.5);
        pen.begin().ell(0, -33, Math.abs(rs) + 2, 2.5).ink(P.steelLight, 1.5);
        // cockpit tub
        pen.begin().m(-18, -10).q(-20, 12, 0, 12).q(18, 12, 20, -6).l(-18, -10).close().ink(this.hitFlash > 0 ? P.white : P.olive, 2.6);
        pen.begin().m(-18, -10).l(-34, -6).l(-36, -14).stroke(3, P.oliveDark);
        // tail rotor
        ctx.save(); ctx.translate(-36, -12); ctx.rotate(this.t * 30); pen.begin().m(-6, 0).l(6, 0).stroke(2); ctx.restore();
        // pilot
        pen.begin().ell(2, -16, 7, 7).ink(P.skin, 2);
        pen.begin().m(-5, -18).q(2, -28, 9, -18).close().ink(P.red, 2);
        pen.begin().ell(5, -17, 3, 3).ink(P.brass, 1.5);
        // throwing arm
        const ax = wind ? -10 : 12, ay = wind ? -30 : -6;
        pen.begin().m(4, -10).l(ax, ay).stroke(3.5);
        if (wind) { ctx.save(); ctx.translate(ax, ay); ctx.rotate(this.t * 4); drawWrench(ctx); ctx.restore(); }
        if (wind) { ctx.scale(this.facing, 1); inkText(ctx, '!', 0, -52, 20, P.redBright, { outline: 4 }); }
        break;
      }
    }
    ctx.restore();
    // health pips for multi-hp enemies
    if (this.maxHp > 1 && this.hp < this.maxHp && this.dying === 0) {
      ctx.fillStyle = P.ink; ctx.fillRect(this.x - 18, this.y - 62, 36, 6);
      ctx.fillStyle = P.redBright; ctx.fillRect(this.x - 16, this.y - 60, 32 * (this.hp / this.maxHp), 2);
    }
  }
}

function drawWrench(ctx: CanvasRenderingContext2D) {
  pen.begin().rrect(-10, -2, 20, 4, 1).ink(P.steel, 1.6);
  pen.begin().m(10, -5).l(14, -5).l(13, 0).l(14, 5).l(10, 5).close().ink(P.steel, 1.6);
}

// ===================================================================
// PROJECTILES
// ===================================================================
export class Projectile {
  x: number; y: number; vx: number; vy: number; kind: 'flak' | 'mortar' | 'wrench' | 'junk' | 'snow'; fuse: number; dead = false; t = 0; r: number; bursting = 0;
  constructor(x: number, y: number, vx: number, vy: number, kind: Projectile['kind'], fuse: number) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.kind = kind; this.fuse = fuse;
    this.r = kind === 'flak' ? 6 : kind === 'junk' ? 12 : 7;
  }
  update(w: World, dt: number) {
    this.t += dt;
    if (this.bursting > 0) { this.bursting -= dt; if (this.bursting <= 0) this.dead = true; return; }
    if (this.kind !== 'flak') this.vy += 380 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const p = w.player;
    if (this.kind === 'flak') {
      if (this.t >= this.fuse || p.hitTest(this.x, this.y, 10)) this.burst(w);
    } else {
      if (p.hitTest(this.x, this.y, this.r)) {
        this.dead = true;
        if (this.kind === 'snow') { p.ice = Math.min(1, p.ice + 0.35); p.vx += this.vx * 0.3; p.wobble = 1; w.fx.puff(this.x, this.y, 8, P.white, 9); w.fx.burst(this.x, this.y - 20, 'SPLAT!', 18, P.white); Audio.puff(); return; }
        p.hit(w, 1, this.x, this.y); w.fx.explosion(this.x, this.y, 0.4); Audio.explosion(0.4); return;
      }
      if (this.y > w.terrain.surfaceY(this.x) || this.t > this.fuse) { this.dead = true; if (this.kind === 'snow') { w.fx.puff(this.x, this.y, 6, P.white, 8); Audio.puff(); } else { w.fx.explosion(this.x, this.y, 0.45); Audio.explosion(0.4); } }
    }
  }
  burst(w: World) {
    this.bursting = 0.3; const R = 38;
    w.fx.add({ kind: 'star', x: this.x, y: this.y, r: R, life: 0.25, max: 0.25, color: P.ink });
    w.fx.add({ kind: 'star', x: this.x, y: this.y, r: R * 0.6, life: 0.22, max: 0.22, color: P.flame2 });
    w.fx.puff(this.x, this.y, 5, P.smoke, 12);
    Audio.puff(); Audio.thump();
    if (w.player.hitTest(this.x, this.y, R * 0.8)) w.player.hit(w, 1, this.x, this.y);
  }
  draw(ctx: CanvasRenderingContext2D) {
    if (this.bursting > 0) return;
    pen.use(ctx, 0.5);
    if (this.kind === 'flak') {
      pen.begin().ell(this.x, this.y, 6, 6).ink(P.ink, 0);
      ctx.fillStyle = Math.sin(this.t * 40) > 0 ? P.hot : P.flame2; ctx.beginPath(); ctx.arc(this.x, this.y, 2.5, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(42,26,20,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05); ctx.stroke();
    } else if (this.kind === 'snow') {
      pen.begin().ell(this.x, this.y, 8, 8).ink(P.white, 2); ctx.fillStyle = '#c8d8e8'; ctx.beginPath(); ctx.arc(this.x + 2, this.y + 2, 4, 0, 7); ctx.fill();
    } else if (this.kind === 'mortar' || this.kind === 'junk') {
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.t * 6);
      if (this.kind === 'junk') { pen.begin().poly([[-12, -8], [10, -11], [13, 7], [-6, 12], [-13, 3]]).ink(P.rust, 2.4); pen.begin().ell(0, 0, 4, 4).fill(P.steelDark); }
      else { pen.begin().ell(0, 0, 7, 7).ink(P.oliveDark, 2.2); ctx.fillStyle = Math.sin(this.t * 30) > 0 ? P.hot : P.gold; ctx.beginPath(); ctx.arc(0, -7, 2.5, 0, 7); ctx.fill(); }
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.t * 14); drawWrench(ctx); ctx.restore();
    }
  }
}

// ===================================================================
// PLAYER BOMBS
// ===================================================================
export class Bomb {
  x: number; y: number; vx: number; vy: number; dead = false; t = 0; scale: number; cluster: boolean; rot = 0;
  constructor(x: number, y: number, vx: number, vy: number, cluster: boolean, scale = 1) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.cluster = cluster; this.scale = scale; }
  update(w: World, dt: number) {
    this.t += dt;
    this.vy += 620 * dt; this.vx *= Math.exp(-0.4 * dt);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.rot = Math.atan2(this.vy, this.vx) - Math.PI / 2;
    const sy = w.terrain.surfaceY(this.x);
    if (this.cluster && sy - this.y < 90 && this.t > 0.15) {
      this.dead = true; Audio.pop();
      w.fx.puff(this.x, this.y, 3, P.smokeLight, 6);
      for (const dvx of [-110, 0, 110]) w.bombs.push(new Bomb(this.x, this.y, this.vx * 0.5 + dvx, this.vy * 0.6 - 60, false, 0.7));
      return;
    }
    let hit = this.y >= sy;
    if (!hit) for (const e of w.enemies) if (!e.dead && e.dying === 0 && dist(this.x, this.y, e.x, e.cy) < e.r + 6) { hit = true; break; }
    if (!hit) for (const t of w.targets) if (!t.dead && t.contains(this.x, this.y, 4)) { hit = true; break; }
    if (!hit && w.boss && w.boss.bombHit(this.x, this.y)) hit = true;
    if (hit) { this.dead = true; w.explode(this.x, Math.min(this.y, sy), this.scale); }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot); ctx.scale(this.scale, this.scale);
    pen.use(ctx, 0.5);
    pen.begin().m(-4, -10).l(-8, -16).l(8, -16).l(4, -10).close().ink(P.steelDark, 1.8);
    pen.begin().ell(0, 0, 8, 10).ink(P.ink, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-3, -3, 2, 3.5, 0.3, 0, 7); ctx.fill();
    if (this.cluster) { ctx.fillStyle = P.red; ctx.fillRect(-8, -2, 16, 3); }
    ctx.restore();
  }
}

// ===================================================================
// HAZARDS
// ===================================================================
export class PowerLine {
  x1: number; x2: number; y1: number; y2: number; sag: number; t = rand(0, 5); live = true;
  constructor(x1: number, y1: number, x2: number, y2: number) { this.x1 = x1; this.x2 = x2; this.y1 = y1; this.y2 = y2; this.sag = Math.abs(x2 - x1) * 0.12; }
  yAt(x: number) { const u = (x - this.x1) / (this.x2 - this.x1); return lerp(this.y1, this.y2, u) + Math.sin(u * Math.PI) * this.sag; }
  update(w: World, dt: number) {
    this.t += dt;
    if (Math.random() < 0.06) { const x = rand(this.x1, this.x2); w.fx.sparks(x, this.yAt(x), 3); }
    const p = w.player;
    for (const [cx, cy, r] of p.circles()) {
      if (cx > this.x1 && cx < this.x2 && Math.abs(this.yAt(cx) - cy) < r) { p.zapped(w); break; }
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    pen.use(ctx, 0);
    for (const [px, py] of [[this.x1, this.y1], [this.x2, this.y2]]) {
      const gy = GROUND - 10;
      pen.begin().m(px, gy).l(px, py - 6).stroke(6, P.ink);
      pen.begin().m(px, gy).l(px, py - 6).stroke(3, P.brownDark);
      pen.begin().m(px - 16, py).l(px + 16, py).stroke(4, P.brownDark);
      pen.begin().ell(px - 12, py - 3, 2.5, 3).ink(P.tealLight, 1.2); pen.begin().ell(px + 12, py - 3, 2.5, 3).ink(P.tealLight, 1.2);
    }
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = this.x1; x <= this.x2; x += 12) { const y = this.yAt(x); if (x === this.x1) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    // crackle
    ctx.strokeStyle = P.electric; ctx.lineWidth = 1.6;
    ctx.beginPath();
    const seg = Math.floor(this.t * 12) % 7;
    for (let x = this.x1 + seg * 18; x < this.x2; x += 130) {
      ctx.moveTo(x, this.yAt(x));
      for (let k = 1; k < 5; k++) { ctx.lineTo(x + k * 5, this.yAt(x + k * 5) + rand(-5, 5)); }
    }
    ctx.stroke();
  }
}

export class Smokestack {
  x: number; topY: number; t: number; period = 5.5; active = 0; warn = 0; cool: number; fire: boolean;
  constructor(x: number, topY: number, fire = false) { this.x = x; this.topY = topY; this.t = rand(0, 3); this.cool = rand(1.5, 3.5); this.fire = fire; }
  update(w: World, dt: number) {
    this.t += dt;
    if (this.active > 0) {
      this.active -= dt;
      for (let i = 0; i < 2; i++) w.fx.add({ kind: 'soot', x: this.x + rand(-14, 14), y: this.topY - rand(0, 10), vx: rand(-20, 20) + w.wind * 0.3, vy: rand(-260, -200), r: rand(14, 22), life: rand(0.9, 1.3), max: 1.3, color: this.fire ? pick(['#5a2a1a', '#3b302c', '#7a3a1a']) : pick(['#2f2624', '#3b302c', '#4a3d38']), drag: 0.6 });
      if (this.fire) for (let i = 0; i < 2; i++) w.fx.add({ kind: 'flame', x: this.x + rand(-12, 12), y: this.topY - rand(0, 30), vx: rand(-15, 15), vy: rand(-320, -220), r: rand(8, 14), life: rand(0.5, 0.8), max: 0.8, drag: 0.5 });
      if (this.active <= 0) this.cool = rand(2.5, 4);
      // damage + updraft
      const p = w.player;
      if (Math.abs(p.x - this.x) < 34 && p.y < this.topY + 20 && p.y > this.topY - 300) {
        p.vy -= 600 * dt;
        if (!p.stats.bucket) p.hit(w, 1, this.x, p.y - 40, this.fire ? 'fire' : 'soot');
      }
    } else if (this.warn > 0) {
      this.warn -= dt;
      if (Math.random() < 0.3) w.fx.sparks(this.x + rand(-12, 12), this.topY, 1, P.flame2);
      if (Math.random() < 0.15) w.fx.puff(this.x, this.topY - 4, 1, '#3b302c', 8);
      if (this.warn <= 0) { this.active = 2.2; Audio.noiseBurst(1.5, { f: 300, f2: 120, gain: 0.25 }); }
    } else {
      this.cool -= dt;
      if (Math.random() < 0.05) w.fx.puff(this.x, this.topY - 4, 1, '#5d504a', 6);
      if (this.cool <= 0) { this.warn = 1.2; }
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    if (this.fire) { // ground vent grate
      pen.use(ctx, 0.4);
      pen.begin().m(this.x - 26, this.topY + 6).q(this.x, this.topY - 14, this.x + 26, this.topY + 6).close().ink('#3a2c28', 2.5);
      ctx.fillStyle = this.warn > 0 || this.active > 0 ? '#ffb040' : '#a83a1a'; ctx.beginPath(); ctx.ellipse(this.x, this.topY - 2, 12, 4, 0, 0, 7); ctx.fill();
    }
    if (this.warn > 0) {
      const a = Math.sin(this.t * 20) > 0;
      ctx.fillStyle = a ? 'rgba(255,59,47,0.35)' : 'rgba(255,181,52,0.25)';
      ctx.fillRect(this.x - 30, this.topY - 260, 60, 260);
      inkText(ctx, '!', this.x, this.topY - 30, 22, P.redBright, { outline: 4 });
    }
  }
}

export class Gust {
  x: number; w: number; fx: number; fy: number; t = 0; style: 'wind' | 'sand' | 'snow';
  constructor(x: number, w: number, fx: number, fy: number, style: 'wind' | 'sand' | 'snow' = 'wind') { this.x = x; this.w = w; this.fx = fx; this.fy = fy; this.style = style; }
  contains(px: number) { return px > this.x && px < this.x + this.w; }
  draw(ctx: CanvasRenderingContext2D, top: number, t: number) {
    ctx.strokeStyle = this.style === 'sand' ? 'rgba(220,170,100,0.7)' : this.style === 'snow' ? 'rgba(255,255,255,0.8)' : 'rgba(255,250,235,0.55)'; ctx.lineWidth = this.style === 'wind' ? 2 : 3; ctx.lineCap = 'round';
    if (this.style !== 'wind') { ctx.fillStyle = this.style === 'sand' ? 'rgba(220,170,100,0.18)' : 'rgba(240,245,250,0.2)'; ctx.fillRect(this.x, top, this.w, 600); }
    for (let i = 0; i < (this.style === 'wind' ? 14 : 30); i++) {
      const lx = this.x + ((i * 97 + t * this.fx * 1.2) % this.w + this.w) % this.w;
      const ly = top + 60 + ((i * 53) % 380) + Math.sin(t * 2 + i) * 10 + t * this.fy * 0.3 % 50;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.quadraticCurveTo(lx + Math.sign(this.fx) * 20, ly - 6, lx + Math.sign(this.fx) * 40, ly); ctx.stroke();
    }
  }
}

/** Thunderhead that fires telegraphed lightning bolts at the balloon while it's underneath. */
export class Storm {
  x: number; w: number; y = 40; t = rand(0, 3); cd = rand(1.5, 3); warn = 0; strikeX = 0; bolt = 0; boltPts: number[][] = [];
  constructor(x: number, w: number) { this.x = x; this.w = w; }
  update(w: World, dt: number) {
    this.t += dt;
    const p = w.player;
    const under = p.x > this.x && p.x < this.x + this.w;
    this.bolt = Math.max(0, this.bolt - dt);
    if (this.warn > 0) {
      this.warn -= dt;
      if (this.warn <= 0) {
        this.bolt = 0.25;
        const gy = w.terrain.surfaceY(this.strikeX);
        this.boltPts = [];
        for (let yy = this.y + 20; yy < gy; yy += 26) this.boltPts.push([this.strikeX + rand(-14, 14), yy]);
        this.boltPts.push([this.strikeX, gy]);
        w.fx.flash = Math.max(w.fx.flash, 0.15); w.fx.shake = Math.max(w.fx.shake, 6);
        Audio.zap(); Audio.explosion(0.6);
        w.fx.sparks(this.strikeX, gy, 12, P.electric);
        if (Math.abs(p.x - this.strikeX) < 30) p.zapped(w);
      }
    } else if (under) {
      this.cd -= dt;
      if (this.cd <= 0) { this.warn = 1.1; this.strikeX = p.x + p.vx * 0.8; this.cd = rand(2.2, 3.4); }
    }
  }
  draw(ctx: CanvasRenderingContext2D, camY: number) {
    const cy = Math.max(this.y, camY + 30);
    pen.use(ctx, 0.6);
    const flick = this.warn > 0 && Math.sin(this.t * 40) > 0;
    for (let i = 0; i < Math.ceil(this.w / 70); i++) {
      const cx = this.x + 35 + i * 70;
      pen.begin().ell(cx, cy + Math.sin(i * 1.7) * 8, 52, 30).ink(flick ? '#8a8aa8' : '#4a4a5e', 2.5);
    }
    if (this.warn > 0) {
      ctx.strokeStyle = `rgba(159,243,255,${0.3 + 0.4 * Math.sin(this.t * 30)})`; ctx.setLineDash([8, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(this.strikeX, cy + 20); ctx.lineTo(this.strikeX, GROUND); ctx.stroke(); ctx.setLineDash([]);
    }
    if (this.bolt > 0 && this.boltPts.length) {
      for (const [wdt, col] of [[9, P.ink], [5, P.electric], [2, P.white]] as [number, string][]) {
        ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.lineJoin = 'miter';
        ctx.beginPath(); ctx.moveTo(this.strikeX, cy + 20); for (const [bx, by] of this.boltPts) ctx.lineTo(bx, by); ctx.stroke();
      }
    }
  }
}
