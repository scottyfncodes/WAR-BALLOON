import { P } from './palette';
import { hash } from '../core/math';

/**
 * "Pen" — wraps a CanvasRenderingContext2D path API and adds hand-inked line boil:
 * every vertex is nudged by a deterministic jitter that changes ~10 times a second,
 * like re-traced animation cels. Static/prerendered art uses amp 0 (or a fixed seed).
 */
export class Pen {
  ctx!: CanvasRenderingContext2D;
  amp = 0.7;
  seed = 0;
  private k = 0;
  use(ctx: CanvasRenderingContext2D, amp = 0.7, seed = Boil.seed) { this.ctx = ctx; this.amp = amp; this.seed = seed; this.k = 0; return this; }
  private jx(v: number) { this.k++; return v + (hash(this.k * 13.37 + this.seed * 7.13) - 0.5) * 2 * this.amp; }
  begin() { this.ctx.beginPath(); return this; }
  m(x: number, y: number) { this.ctx.moveTo(this.jx(x), this.jx(y)); return this; }
  l(x: number, y: number) { this.ctx.lineTo(this.jx(x), this.jx(y)); return this; }
  q(cx: number, cy: number, x: number, y: number) { this.ctx.quadraticCurveTo(this.jx(cx), this.jx(cy), this.jx(x), this.jx(y)); return this; }
  c(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    this.ctx.bezierCurveTo(this.jx(c1x), this.jx(c1y), this.jx(c2x), this.jx(c2y), this.jx(x), this.jx(y)); return this;
  }
  close() { this.ctx.closePath(); return this; }
  /** Ellipse made of 4 cubic arcs so it boils. */
  ell(cx: number, cy: number, rx: number, ry: number) {
    const k = 0.5523;
    this.m(cx + rx, cy);
    this.c(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry);
    this.c(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy);
    this.c(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry);
    this.c(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy);
    this.close();
    return this;
  }
  rect(x: number, y: number, w: number, h: number) { return this.m(x, y).l(x + w, y).l(x + w, y + h).l(x, y + h).close(); }
  rrect(x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, w / 2, h / 2);
    this.m(x + r, y).l(x + w - r, y).q(x + w, y, x + w, y + r).l(x + w, y + h - r).q(x + w, y + h, x + w - r, y + h)
      .l(x + r, y + h).q(x, y + h, x, y + h - r).l(x, y + r).q(x, y, x + r, y).close();
    return this;
  }
  /** Smooth closed/open curve through points (Catmull-Rom). */
  smooth(pts: number[][], closed = true) {
    const n = pts.length;
    if (n < 2) return this;
    const g = (i: number) => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    this.m(pts[0][0], pts[0][1]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      this.c(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    if (closed) this.close();
    return this;
  }
  poly(pts: number[][], closed = true) {
    this.m(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) this.l(pts[i][0], pts[i][1]);
    if (closed) this.close();
    return this;
  }
  fill(c: string | CanvasGradient | CanvasPattern) { this.ctx.fillStyle = c; this.ctx.fill(); return this; }
  stroke(w = 3, c: string = P.ink) {
    const x = this.ctx; x.lineWidth = w; x.strokeStyle = c; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); return this;
  }
  /** Fill + ink outline in one go. */
  ink(fill: string | CanvasGradient | CanvasPattern | null, w = 3, c: string = P.ink) { if (fill) this.fill(fill); if (w > 0) this.stroke(w, c); return this; }
  clip() { this.ctx.clip(); return this; }
}

export const Boil = {
  seed: 0,
  t: 0,
  update(dt: number) { this.t += dt; this.seed = Math.floor(this.t * 9); },
};

export const pen = new Pen();

/** Draw cel-shading inside the current shape: call shape() to define path; shade() paints inside clip. */
export function cel(ctx: CanvasRenderingContext2D, shape: () => void, shade: () => void) {
  ctx.save();
  shape();
  ctx.clip();
  shade();
  ctx.restore();
}

/** Comic text with ink outline. */
export function inkText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, fill: string, opts: { align?: CanvasTextAlign; font?: string; outline?: number; shadow?: boolean; baseline?: CanvasTextBaseline; outlineColor?: string } = {}) {
  ctx.font = `${size}px ${opts.font ?? FONT_TITLE}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = opts.baseline ?? 'middle';
  ctx.lineJoin = 'round';
  const ow = opts.outline ?? Math.max(2, size * 0.14);
  if (opts.shadow !== false) {
    ctx.fillStyle = 'rgba(42,26,20,0.55)';
    ctx.fillText(s, x + size * 0.06, y + size * 0.09);
  }
  if (ow > 0) {
    ctx.lineWidth = ow; ctx.strokeStyle = opts.outlineColor ?? P.ink; ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}

export function bodyText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string = P.ink, align: CanvasTextAlign = 'left', baseline: CanvasTextBaseline = 'middle') {
  ctx.font = `${size}px ${FONT_BODY}`;
  ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillStyle = color; ctx.fillText(s, x, y);
}

/** Wrap text into lines that fit width. */
export function wrapText(ctx: CanvasRenderingContext2D, s: string, maxW: number, size: number, font = FONT_BODY): string[] {
  ctx.font = `${size}px ${font}`;
  const words = s.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export const FONT_TITLE = '"Luckiest Guy", "Arial Black", Impact, sans-serif';
export const FONT_BODY = '"Patrick Hand", "Comic Sans MS", "Chalkboard SE", sans-serif';

/** Make an offscreen canvas. */
export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const x = c.getContext('2d')!;
  return [c, x];
}

/** Paper grain pattern (prerendered noise). */
let grainCanvas: HTMLCanvasElement | null = null;
export function grain(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const [c, x] = makeCanvas(256, 256);
  const img = x.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random();
    const g = 120 + v * 120;
    img.data[i] = g; img.data[i + 1] = g * 0.92; img.data[i + 2] = g * 0.8;
    img.data[i + 3] = v > 0.5 ? 26 : 14;
  }
  x.putImageData(img, 0, 0);
  // fibres
  x.globalAlpha = 0.08; x.strokeStyle = '#3b2a1c';
  for (let i = 0; i < 70; i++) {
    x.lineWidth = Math.random() * 0.8 + 0.2;
    const sx = Math.random() * 256, sy = Math.random() * 256, a = Math.random() * Math.PI;
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * 14, sy + Math.sin(a) * 14); x.stroke();
  }
  grainCanvas = c;
  return c;
}

/** Painterly brush daub: soft irregular blob. Used in prerendered backgrounds. */
export function daub(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha = 0.5, seed = Math.random() * 1000) {
  x.save();
  x.globalAlpha = alpha;
  x.fillStyle = color;
  x.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.75 + hash(seed + i * 3.1) * 0.45);
    const px = cx + Math.cos(a) * rr * 1.3, py = cy + Math.sin(a) * rr * 0.8;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.closePath(); x.fill();
  x.restore();
}
