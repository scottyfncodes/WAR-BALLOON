import { P } from '../render/palette';
import { pen, inkText } from '../render/ink';
import { Input, type Ptr } from '../core/input';
import { Engine } from '../core/engine';
import { clamp, buzz } from '../core/math';
import type { Controls, Weapon } from '../game/airship';

type BtnId = 'drop' | 'shake' | 'hook' | 'flame' | 'boost' | 'cycle';
interface TB { id: BtnId; x: number; y: number; r: number; label: string; color: string; }
export interface TouchInfo { weapon: Weapon; ammo: number; hookOut: boolean; shakeReady: number; flameReady: number; boostReady: number; hangers: number; canFlame: boolean; canBoost: boolean; canCycle: boolean; t: number; }

/** On-screen controls: floating stick (left), big tactile action buttons (right). */
export class TouchControls {
  stick: { ptr: Ptr | null; ox: number; oy: number; vx: number; vy: number } = { ptr: null, ox: 0, oy: 0, vx: 0, vy: 0 };
  held: Record<string, Ptr | null> = {};
  pressedNow: Record<string, boolean> = {};
  visible = false; lefty = false;
  canFlame = false; canBoost = false; canCycle = false;
  flash: Record<string, number> = {};
  buttons(): TB[] {
    const W = Engine.W, H = Engine.H, sr = Engine.safe.r, sb = Engine.safe.b * 0.5;
    const b: TB[] = [
      { id: 'drop', x: W - 88 - sr, y: H - 88 - sb, r: 54, label: 'DROP', color: P.red },
      { id: 'shake', x: W - 210 - sr, y: H - 70 - sb, r: 50, label: 'SHAKE', color: P.gold },
      { id: 'hook', x: W - 96 - sr, y: H - 212 - sb, r: 40, label: 'HOOK', color: P.teal },
    ];
    if (this.canFlame) b.push({ id: 'flame', x: W - 212 - sr, y: H - 186 - sb, r: 36, label: 'FLAME', color: P.orange });
    if (this.canBoost) b.push({ id: 'boost', x: W - 318 - sr, y: H - 58 - sb, r: 34, label: 'BOOST', color: P.purple });
    if (this.canCycle) b.push({ id: 'cycle', x: W - 30 - sr, y: H - 162 - sb, r: 22, label: '', color: P.brass });
    if (this.lefty) for (const k of b) k.x = W - k.x + (sr - Engine.safe.l);
    return b;
  }
  stickHome() { return { x: this.lefty ? Engine.W - 112 - Engine.safe.r : 112 + Engine.safe.l, y: Engine.H - 112 - Engine.safe.b * 0.5 }; }
  update(blockTopY = 90) {
    if (Input.usingTouch) this.visible = true;
    this.pressedNow = {};
    const btns = this.buttons();
    for (const d of Input.downs) {
      if (d.claimed) continue;
      const b = btns.find((b) => (d.x - b.x) ** 2 + (d.y - b.y) ** 2 < (b.r + 12) ** 2);
      if (b) { d.claimed = 'btn:' + b.id; this.held[b.id] = d; this.pressedNow[b.id] = true; this.flash[b.id] = 0.15; buzz(8); continue; }
      if ((this.lefty ? d.x > Engine.W * 0.5 : d.x < Engine.W * 0.5) && d.y > blockTopY && !this.stick.ptr) {
        d.claimed = 'stick'; this.stick.ptr = d;
        this.stick.ox = this.lefty ? clamp(d.x, Engine.W * 0.55, Engine.W - 70 - Engine.safe.r) : clamp(d.x, 70 + Engine.safe.l, Engine.W * 0.45); this.stick.oy = clamp(d.y, 120, Engine.H - 70);
      }
    }
    for (const u of Input.ups) {
      if (this.stick.ptr && u.id === this.stick.ptr.id) this.stick.ptr = null;
      for (const k of Object.keys(this.held)) if (this.held[k] && this.held[k]!.id === u.id) this.held[k] = null;
    }
    if (this.stick.ptr) {
      const R = 56;
      let dx = this.stick.ptr.x - this.stick.ox, dy = this.stick.ptr.y - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { this.stick.ox += (dx / d) * (d - R); this.stick.oy += (dy / d) * (d - R); dx = this.stick.ptr.x - this.stick.ox; dy = this.stick.ptr.y - this.stick.oy; }
      const dz = 0.18, nx = dx / R, ny = dy / R;
      this.stick.vx = Math.abs(nx) < dz ? 0 : clamp(nx, -1, 1);
      this.stick.vy = Math.abs(ny) < dz ? 0 : clamp(ny, -1, 1);
    } else { this.stick.vx = 0; this.stick.vy = 0; }
    for (const k of Object.keys(this.flash)) this.flash[k] = Math.max(0, this.flash[k] - 1 / 60);
  }
  merge(c: Controls) {
    if (this.stick.ptr) { c.x = this.stick.vx; c.y = this.stick.vy; }
    const p = this.pressedNow;
    c.drop ||= !!p.drop; c.hook ||= !!p.hook; c.shake ||= !!p.shake; c.flame ||= !!p.flame; c.boost ||= !!p.boost; c.cycle ||= !!p.cycle;
  }
  draw(ctx: CanvasRenderingContext2D, info: TouchInfo) {
    this.canFlame = info.canFlame; this.canBoost = info.canBoost; this.canCycle = info.canCycle;
    if (!this.visible) return;
    pen.use(ctx, 0.4);
    const home = this.stickHome();
    const sx = this.stick.ptr ? this.stick.ox : home.x, sy = this.stick.ptr ? this.stick.oy : home.y;
    ctx.globalAlpha = this.stick.ptr ? 0.85 : 0.45;
    pen.begin().ell(sx, sy, 60, 60).ink('rgba(42,26,20,0.35)', 3);
    pen.begin().ell(sx, sy, 60, 60).stroke(2, P.brass);
    ctx.fillStyle = P.parchment;
    for (const [ax, ay, rot] of [[0, -44, 0], [44, 0, Math.PI / 2], [0, 44, Math.PI], [-44, 0, -Math.PI / 2]] as [number, number, number][]) { ctx.save(); ctx.translate(sx + ax, sy + ay); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 3); ctx.lineTo(-6, 3); ctx.closePath(); ctx.fill(); ctx.restore(); }
    const kx = sx + this.stick.vx * 56, ky = sy + this.stick.vy * 56;
    pen.begin().ell(kx, ky, 28, 28).ink(P.brass, 3);
    if (!this.stick.ptr) inkText(ctx, 'FLY · wiggle to shake', sx, sy + 80, 12, P.parchment, { outline: 3 });
    ctx.globalAlpha = 1;
    for (const b of this.buttons()) {
      const held = !!this.held[b.id];
      const ready = b.id === 'shake' ? info.shakeReady : b.id === 'flame' ? info.flameReady : b.id === 'boost' ? info.boostReady : b.id === 'drop' ? (info.ammo > 0 ? 1 : 0) : 1;
      const urgent = b.id === 'shake' && info.hangers > 0 && ready >= 1;
      ctx.globalAlpha = ready < 1 ? 0.5 : 0.88;
      const s = (held ? 0.92 : 1 + (this.flash[b.id] ?? 0)) * (urgent ? 1 + 0.08 * Math.sin(info.t * 14) : 1);
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(s, s);
      if (urgent) { ctx.fillStyle = 'rgba(255,216,119,0.35)'; ctx.beginPath(); ctx.arc(0, 0, b.r + 12, 0, 7); ctx.fill(); }
      pen.begin().ell(0, 4, b.r, b.r).fill(P.ink);
      pen.begin().ell(0, 0, b.r, b.r).ink(b.color, 3.5);
      if (ready < 1) { ctx.fillStyle = 'rgba(42,26,20,0.5)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, b.r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ready)); ctx.closePath(); ctx.fill(); }
      pen.begin().ell(-b.r * 0.25, -b.r * 0.3, b.r * 0.45, b.r * 0.3).fill('rgba(255,250,230,0.25)');
      drawBtnIcon(ctx, b.id === 'drop' ? info.weapon : b.id, b.r);
      if (b.id === 'cycle') drawBtnIcon(ctx, 'cycle', b.r);
      else inkText(ctx, b.id === 'hook' && info.hookOut ? 'REEL' : b.label, 0, b.r * 0.52, Math.max(11, b.r * 0.3), P.parchment, { outline: 3, shadow: false });
      if (b.id === 'drop') inkText(ctx, String(info.ammo), b.r * 0.72, -b.r * 0.72, 17, P.gold, { outline: 3 });
      if (urgent) inkText(ctx, String(info.hangers), -b.r * 0.72, -b.r * 0.72, 17, P.redBright, { outline: 3 });
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

export function drawBtnIcon(ctx: CanvasRenderingContext2D, id: string, r: number) {
  const k = r / 50;
  ctx.save(); ctx.scale(k, k);
  switch (id) {
    case 'bomb': pen.begin().ell(0, -8, 14, 14).ink(P.ink, 2); pen.begin().m(8, -18).q(13, -26, 19, -22).stroke(2.5, P.brownLight); ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(19, -23, 3, 0, 7); ctx.fill(); break;
    case 'fire': pen.begin().rrect(-6, -22, 12, 26, 4).ink('#7aa868', 2); pen.begin().m(0, -22).l(0, -30).stroke(3, P.parchment); pen.begin().m(-5, -30).q(0, -44, 5, -30).close().ink(P.flame2, 1.5); break;
    case 'mine': pen.begin().ell(0, -6, 16, 9).ink(P.steelDark, 2); ctx.fillStyle = P.hot; ctx.beginPath(); ctx.arc(0, -13, 3.5, 0, 7); ctx.fill(); break;
    case 'shake': for (const s of [-1, 1]) pen.begin().m(s * 10, -26).q(s * 22, -10, s * 10, 4).stroke(3, P.ink); pen.begin().rrect(-9, -18, 18, 16, 3).ink(P.brownLight, 2); pen.begin().m(-4, -2).l(-7, 6).m(4, -2).l(7, 6).stroke(2.5); break;
    case 'hook': pen.begin().m(0, -24).l(0, -6).q(0, 4, 8, 2).q(13, -1, 11, -7).stroke(5, P.ink); pen.begin().m(0, -24).l(0, -6).q(0, 4, 8, 2).q(13, -1, 11, -7).stroke(2.5, P.steelLight); break;
    case 'flame': pen.begin().m(-12, 2).q(-14, -12, 0, -28).q(14, -12, 12, 2).close().ink(P.flame3, 2); pen.begin().m(-6, 0).q(-6, -10, 0, -18).q(6, -10, 6, 0).close().fill(P.flame1); break;
    case 'boost': pen.begin().m(0, -28).l(10, -10).l(4, -10).l(4, 4).l(-4, 4).l(-4, -10).l(-10, -10).close().ink(P.parchment, 2); break;
    case 'cycle': pen.begin().m(-14, -4).q(-14, -16, 0, -16).l(8, -16).stroke(5, P.ink); pen.begin().m(4, -24).l(14, -16).l(4, -8).close().fill(P.ink); pen.begin().m(14, 4).q(14, 16, 0, 16).l(-8, 16).stroke(5, P.ink); pen.begin().m(-4, 24).l(-14, 16).l(-4, 8).close().fill(P.ink); break;
  }
  ctx.restore();
}
