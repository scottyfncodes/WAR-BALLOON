import { P } from '../render/palette';
import { pen, inkText } from '../render/ink';
import { Input, type Ptr } from '../core/input';
import { Engine } from '../core/engine';
import { clamp } from '../core/math';
import type { Controls } from '../game/player';

interface TB { id: 'bomb' | 'hook' | 'boost'; x: number; y: number; r: number; label: string; color: string; }

/** On-screen controls: floating stick (left), action buttons (right). */
export class TouchControls {
  stick: { ptr: Ptr | null; ox: number; oy: number; vx: number; vy: number } = { ptr: null, ox: 0, oy: 0, vx: 0, vy: 0 };
  held: Record<string, Ptr | null> = { bomb: null, hook: null, boost: null };
  pressedNow: Record<string, boolean> = { bomb: false, hook: false, boost: false };
  visible = false;
  boostEnabled = false;
  flash: Record<string, number> = { bomb: 0, hook: 0, boost: 0 };
  buttons(): TB[] {
    const W = Engine.W, H = Engine.H, sr = Engine.safe.r, sb = Engine.safe.b;
    const b: TB[] = [
      { id: 'bomb', x: W - 92 - sr, y: H - 92 - sb * 0.5, r: 50, label: 'BOMB', color: P.red },
      { id: 'hook', x: W - 206 - sr, y: H - 66 - sb * 0.5, r: 40, label: 'HOOK', color: P.teal },
    ];
    if (this.boostEnabled) b.push({ id: 'boost', x: W - 178 - sr, y: H - 178 - sb * 0.5, r: 32, label: 'BOOST', color: P.orange });
    return b;
  }
  stickHome() { return { x: 112 + Engine.safe.l, y: Engine.H - 112 - Engine.safe.b * 0.5 }; }
  update(blockTopY = 90) {
    if (Input.usingTouch) this.visible = true;
    this.pressedNow = { bomb: false, hook: false, boost: false };
    const btns = this.buttons();
    for (const d of Input.downs) {
      if (d.claimed) continue;
      const b = btns.find((b) => (d.x - b.x) ** 2 + (d.y - b.y) ** 2 < (b.r + 16) ** 2);
      if (b) { d.claimed = 'btn:' + b.id; this.held[b.id] = d; this.pressedNow[b.id] = true; this.flash[b.id] = 0.15; continue; }
      if (d.x < Engine.W * 0.5 && d.y > blockTopY && !this.stick.ptr) {
        d.claimed = 'stick'; this.stick.ptr = d;
        // anchor at touch point, but keep the base fully on-screen
        this.stick.ox = clamp(d.x, 70 + Engine.safe.l, Engine.W * 0.45); this.stick.oy = clamp(d.y, 120, Engine.H - 70);
      }
    }
    for (const u of Input.ups) {
      if (this.stick.ptr && u.id === this.stick.ptr.id) { this.stick.ptr = null; }
      for (const k of Object.keys(this.held)) if (this.held[k] && this.held[k]!.id === u.id) this.held[k] = null;
    }
    if (this.stick.ptr) {
      const R = 56;
      let dx = this.stick.ptr.x - this.stick.ox, dy = this.stick.ptr.y - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { // drag the base along (floating stick)
        this.stick.ox += (dx / d) * (d - R); this.stick.oy += (dy / d) * (d - R);
        dx = this.stick.ptr.x - this.stick.ox; dy = this.stick.ptr.y - this.stick.oy;
      }
      const dz = 0.18;
      const nx = dx / R, ny = dy / R;
      this.stick.vx = Math.abs(nx) < dz ? 0 : clamp(nx, -1, 1);
      this.stick.vy = Math.abs(ny) < dz ? 0 : clamp(ny, -1, 1);
    } else { this.stick.vx = 0; this.stick.vy = 0; }
    for (const k of Object.keys(this.flash)) this.flash[k] = Math.max(0, this.flash[k] - 1 / 60);
  }
  merge(c: Controls) {
    if (this.stick.ptr) { c.x = this.stick.vx; c.y = this.stick.vy; }
    c.bomb = c.bomb || !!this.held.bomb;
    c.hook = c.hook || this.pressedNow.hook;
    c.boost = c.boost || this.pressedNow.boost;
  }
  draw(ctx: CanvasRenderingContext2D, info: { bombs: number; hookOut: boolean; boostReady: boolean }) {
    if (!this.visible) return;
    pen.use(ctx, 0.4);
    // stick
    const home = this.stickHome();
    const sx = this.stick.ptr ? this.stick.ox : home.x, sy = this.stick.ptr ? this.stick.oy : home.y;
    ctx.globalAlpha = this.stick.ptr ? 0.85 : 0.45;
    pen.begin().ell(sx, sy, 60, 60).ink('rgba(42,26,20,0.35)', 3);
    pen.begin().ell(sx, sy, 60, 60).stroke(2, P.brass);
    // direction ticks
    ctx.fillStyle = P.parchment;
    for (const [ax, ay, rot] of [[0, -44, 0], [44, 0, Math.PI / 2], [0, 44, Math.PI], [-44, 0, -Math.PI / 2]] as [number, number, number][]) {
      ctx.save(); ctx.translate(sx + ax, sy + ay); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 3); ctx.lineTo(-6, 3); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    const kx = sx + this.stick.vx * 56, ky = sy + this.stick.vy * 56;
    pen.begin().ell(kx, ky, 28, 28).ink(P.brass, 3);
    pen.begin().ell(kx - 6, ky - 6, 9, 7).fill('rgba(255,250,220,0.45)');
    if (!this.stick.ptr) inkText(ctx, 'FLY', sx, sy + 82, 14, P.parchment, { outline: 3 });
    ctx.globalAlpha = 1;
    for (const b of this.buttons()) {
      const held = !!this.held[b.id];
      const dim = (b.id === 'bomb' && info.bombs <= 0) || (b.id === 'boost' && !info.boostReady);
      ctx.globalAlpha = dim ? 0.45 : 0.85;
      const s = held ? 0.92 : 1 + this.flash[b.id];
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(s, s);
      pen.begin().ell(0, 4, b.r, b.r).fill(P.ink);
      pen.begin().ell(0, 0, b.r, b.r).ink(b.color, 3.5);
      pen.begin().ell(-b.r * 0.25, -b.r * 0.3, b.r * 0.45, b.r * 0.3).fill('rgba(255,250,230,0.25)');
      // icons
      if (b.id === 'bomb') { pen.begin().ell(0, -6, 13, 13).ink(P.ink, 2); pen.begin().m(7, -16).q(12, -24, 18, -20).stroke(2.5, P.brownLight); ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(18, -21, 3, 0, 7); ctx.fill(); }
      else if (b.id === 'hook') { pen.begin().m(0, -20).l(0, -2).q(0, 8, 8, 6).q(13, 3, 11, -3).stroke(5, P.ink); pen.begin().m(0, -20).l(0, -2).q(0, 8, 8, 6).q(13, 3, 11, -3).stroke(2.5, P.steelLight); }
      else { pen.begin().m(-10, 6).q(-12, -6, 0, -16).q(12, -6, 10, 6).close().ink(P.flame2, 2); }
      inkText(ctx, b.id === 'hook' && info.hookOut ? 'REEL' : b.label, 0, b.r * 0.5, b.r * 0.32, P.parchment, { outline: 3, shadow: false });
      if (b.id === 'bomb') inkText(ctx, String(info.bombs), b.r * 0.7, -b.r * 0.7, 16, P.gold, { outline: 3 });
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
