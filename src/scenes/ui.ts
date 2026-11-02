import { P } from '../render/palette';
import { pen, inkText, bodyText, FONT_TITLE, grain } from '../render/ink';
import { Input } from '../core/input';
import { Audio } from '../core/audio';
import { Engine } from '../core/engine';
import { clamp, easeOutBack } from '../core/math';

export type BtnStyle = 'brass' | 'paper' | 'red' | 'teal' | 'olive' | 'ghost' | 'none';
interface Btn { id: string; x: number; y: number; w: number; h: number; onClick: () => void; enabled: boolean; keys?: string[]; }

class UIImpl {
  private cur: Btn[] = [];
  private prev: Btn[] = [];
  pressed: string | null = null;
  focus = -1;
  private pressT: Record<string, number> = {};
  /** call at start of a scene's update */
  update() {
    for (const d of Input.downs) {
      if (d.claimed) continue;
      const b = this.prev.find((b) => b.enabled && d.x >= b.x && d.x <= b.x + b.w && d.y >= b.y && d.y <= b.y + b.h);
      if (b) { this.pressed = b.id; d.claimed = 'ui:' + b.id; }
    }
    for (const u of Input.ups) {
      if (u.claimed === 'ui:' + this.pressed) {
        const b = this.prev.find((b) => b.id === this.pressed);
        if (b && b.enabled && u.x >= b.x - 10 && u.x <= b.x + b.w + 10 && u.y >= b.y - 10 && u.y <= b.y + b.h + 10) this.fire(b);
        this.pressed = null;
      }
    }
    // keyboard
    for (const b of this.prev) if (b.enabled && b.keys && b.keys.some((k) => Input.pressed.has(k))) { this.fire(b); return; }
    const nav = this.prev.filter((b) => b.enabled);
    if (nav.length) {
      if (Input.hit('ArrowRight', 'ArrowDown', 'Tab')) { this.focus = (this.focus + 1) % nav.length; Audio.click(); }
      else if (Input.hit('ArrowLeft', 'ArrowUp')) { this.focus = (this.focus - 1 + nav.length) % nav.length; Audio.click(); }
      else if (Input.hit('Enter', 'Space') && this.focus >= 0 && nav[this.focus]) this.fire(nav[this.focus]);
    }
  }
  private fire(b: Btn) { this.pressT[b.id] = Engine.time; Audio.click(); b.onClick(); }
  /** call at start of render */
  begin() { this.prev = this.cur; this.cur = []; }
  reset() { this.prev = []; this.cur = []; this.pressed = null; this.focus = -1; }
  isFocused(id: string) { const nav = this.prev.filter((b) => b.enabled); return this.focus >= 0 && nav[this.focus]?.id === id; }

  button(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, label: string, onClick: () => void, opts: { style?: BtnStyle; enabled?: boolean; size?: number; keys?: string[]; icon?: (ctx: CanvasRenderingContext2D, cx: number, cy: number) => void; sub?: string } = {}) {
    const enabled = opts.enabled ?? true;
    this.cur.push({ id, x, y, w, h, onClick, enabled, keys: opts.keys });
    if (opts.style === 'none') return;
    const down = this.pressed === id;
    const hover = !Input.usingTouch && Input.lastPointer.x >= x && Input.lastPointer.x <= x + w && Input.lastPointer.y >= y && Input.lastPointer.y <= y + h;
    const focused = this.isFocused(id);
    const since = Engine.time - (this.pressT[id] ?? -9);
    const pop = since < 0.25 ? 1 + 0.08 * Math.sin((since / 0.25) * Math.PI) : 1;
    const style = (opts.style ?? 'brass') as Exclude<BtnStyle, 'none'>;
    const pal: Record<Exclude<BtnStyle, 'none'>, [string, string, string]> = {
      brass: [P.brass, P.brassDark, P.ink], paper: [P.parchment, P.parchmentShade, P.ink], red: [P.red, P.redDark, P.parchment],
      teal: [P.teal, P.tealDark, P.parchment], olive: [P.olive, P.oliveDark, P.parchment], ghost: ['rgba(241,223,184,0.15)', 'rgba(0,0,0,0.2)', P.parchment],
    };
    const [face, side, txt] = enabled ? pal[style] : [P.parchmentShade, '#9b8462', '#7a6650'];
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.scale(pop * (hover && enabled ? 1.03 : 1), pop * (hover && enabled ? 1.03 : 1)); ctx.translate(-w / 2, -h / 2);
    const dy = down ? 3 : 0;
    pen.use(ctx, 0.5);
    pen.begin().rrect(0, 5, w, h, 12).fill(P.ink);
    pen.begin().rrect(0, dy, w, h, 12).ink(side, 3);
    pen.begin().rrect(3, dy + 2, w - 6, h - 8, 10).fill(face);
    ctx.fillStyle = 'rgba(255,255,240,0.22)'; ctx.fillRect(10, dy + 5, w - 20, 3);
    if (style === 'brass' && enabled) { ctx.fillStyle = P.brassDark; for (const [rx, ry] of [[8, 8], [w - 8, 8]]) { ctx.beginPath(); ctx.arc(rx, ry + dy, 2, 0, 7); ctx.fill(); } }
    if (focused) { ctx.strokeStyle = P.goldLight; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.strokeRect(-4, dy - 4, w + 8, h + 8); ctx.setLineDash([]); }
    const size = opts.size ?? Math.min(26, h * 0.46);
    let tx = w / 2;
    if (opts.icon) { opts.icon(ctx, 26, dy + h / 2 - 2); tx = w / 2 + 12; }
    const ty = opts.sub ? dy + h * 0.38 : dy + h / 2 - 1;
    inkText(ctx, label, tx, ty, size, txt === P.ink ? P.parchment : txt, { outline: txt === P.ink ? Math.max(3, size * 0.16) : Math.max(2.5, size * 0.13), shadow: false, outlineColor: P.ink });
    if (opts.sub) bodyText(ctx, opts.sub, tx, dy + h * 0.72, Math.min(16, size * 0.7), txt === P.ink ? P.ink : P.parchment, 'center');
    ctx.restore();
  }
}
export const UI = new UIImpl();

/** Paper panel with ink border, slight tilt option and tape. */
export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts: { color?: string; tape?: boolean; rot?: number; shadow?: boolean; border?: number } = {}) {
  ctx.save();
  if (opts.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(opts.rot); ctx.translate(-x - w / 2, -y - h / 2); }
  pen.use(ctx, 0.6);
  if (opts.shadow !== false) { ctx.fillStyle = 'rgba(30,15,10,0.35)'; ctx.fillRect(x + 6, y + 8, w, h); }
  pen.begin().m(x, y + 4).l(x + w * 0.3, y).l(x + w * 0.7, y + 2).l(x + w, y).l(x + w - 2, y + h * 0.5).l(x + w, y + h).l(x + w * 0.6, y + h - 2).l(x + w * 0.2, y + h).l(x, y + h - 3).l(x + 2, y + h * 0.5).close();
  pen.fill(opts.color ?? P.parchment);
  ctx.save(); ctx.clip();
  ctx.globalAlpha = 0.7; ctx.fillStyle = ctx.createPattern(grain(), 'repeat')!; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,70,30,0.25)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
  pen.stroke(opts.border ?? 3);
  if (opts.tape) {
    for (const [tx, rot] of [[x + 18, -0.5], [x + w - 18, 0.5]]) {
      ctx.save(); ctx.translate(tx, y + 2); ctx.rotate(rot);
      ctx.fillStyle = 'rgba(230,215,170,0.8)'; ctx.fillRect(-20, -8, 40, 16);
      ctx.strokeStyle = 'rgba(42,26,20,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(-20, -8, 40, 16);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Banner ribbon with text. */
export function ribbon(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, text: string, color: string = P.red, size = 28) {
  pen.use(ctx, 0.6);
  const h = size * 1.6;
  for (const s of [-1, 1]) pen.begin().m(cx + s * w / 2 - s * 10, cy - h / 2 + 8).l(cx + s * (w / 2 + 30), cy - h / 2 + 8).l(cx + s * (w / 2 + 18), cy + 6).l(cx + s * (w / 2 + 30), cy + h / 2 + 8).l(cx + s * w / 2 - s * 10, cy + h / 2 + 8).close().ink(color === P.red ? P.redDark : color, 3);
  pen.begin().rrect(cx - w / 2, cy - h / 2, w, h, 4).ink(color, 3);
  inkText(ctx, text, cx, cy + 2, size, P.parchment, { outline: size * 0.15 });
}

export function fadeIn(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, dur = 0.5) {
  if (t >= dur) return;
  // iris-in (classic cartoon circle wipe)
  const k = clamp(t / dur, 0, 1);
  const r = easeOutBack(k) * Math.hypot(W, H) * 0.6;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, Math.max(0.1, r), 0, Math.PI * 2, true);
  ctx.fillStyle = '#140c08'; ctx.fill('evenodd');
  ctx.restore();
}
export function irisOut(ctx: CanvasRenderingContext2D, k: number, W: number, H: number, cx = W / 2, cy = H / 2) {
  const r = (1 - clamp(k, 0, 1)) * Math.hypot(W, H) * 0.7;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2, true);
  ctx.fillStyle = '#140c08'; ctx.fill('evenodd');
  ctx.restore();
}
export { FONT_TITLE };
