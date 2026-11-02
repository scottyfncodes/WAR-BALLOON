import { P } from './palette';
import { makeCanvas, daub, pen } from './ink';
import { RNG, lerp } from '../core/math';

/** Mix two hex colors. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

export interface SkyStyle { top: string; mid: string; horizon: string; sun: string; glow: string; cloud: string; cloudShade: string; }
export const DEAD_CITY_SKY: SkyStyle = { top: '#4f7f86', mid: '#9cb8a6', horizon: '#f0c27a', sun: '#ffe0a0', glow: '#f2a65a', cloud: '#f6e2bf', cloudShade: '#c99a86' };

/** Painted sky backdrop (screen-space, prerendered). */
export function paintSky(W: number, H: number, st: SkyStyle, seed = 3): HTMLCanvasElement {
  const [c, x] = makeCanvas(W, H);
  const rng = new RNG(seed);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, st.top); g.addColorStop(0.5, st.mid); g.addColorStop(0.85, st.horizon); g.addColorStop(1, st.glow);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // painterly horizontal brush strokes to break the gradient
  for (let i = 0; i < 260; i++) {
    const y = rng.range(0, H), t = y / H;
    const col = t < 0.5 ? mix(st.top, st.mid, t * 2) : mix(st.mid, st.horizon, (t - 0.5) * 2);
    x.globalAlpha = 0.18; x.fillStyle = mix(col, rng.chance(0.5) ? '#ffffff' : '#000000', 0.06);
    x.beginPath(); x.ellipse(rng.range(0, W), y, rng.range(40, 180), rng.range(3, 9), 0, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
  // sun with halo rings (theatrical)
  const sx = W * 0.72, sy = H * 0.62;
  for (let i = 6; i > 0; i--) { x.globalAlpha = 0.07; x.fillStyle = st.sun; x.beginPath(); x.arc(sx, sy, 50 + i * 26, 0, Math.PI * 2); x.fill(); }
  x.globalAlpha = 1; x.fillStyle = st.sun; x.beginPath(); x.arc(sx, sy, 46, 0, Math.PI * 2); x.fill();
  x.globalAlpha = 0.5; x.fillStyle = '#fff6da'; x.beginPath(); x.arc(sx - 8, sy - 8, 30, 0, Math.PI * 2); x.fill();
  x.globalAlpha = 1;
  // distant cloud banks
  for (let k = 0; k < 5; k++) paintCloud(x, rng.range(-50, W + 50), rng.range(H * 0.08, H * 0.4), rng.range(50, 110), st, rng.next() * 1000, 0.55);
  return c;
}

export function paintCloud(x: CanvasRenderingContext2D, cx: number, cy: number, size: number, st: SkyStyle, seed: number, alpha = 1) {
  const rng = new RNG(Math.floor(seed) + 1);
  const n = 7 + Math.floor(size / 30);
  const puffs: number[][] = [];
  for (let i = 0; i < n; i++) puffs.push([cx + rng.range(-size, size), cy + rng.range(-size * 0.25, size * 0.15), rng.range(size * 0.25, size * 0.5)]);
  x.save(); x.globalAlpha = alpha;
  for (const [px, py, r] of puffs) { x.fillStyle = st.cloudShade; x.beginPath(); x.ellipse(px + r * 0.1, py + r * 0.25, r * 1.1, r * 0.7, 0, 0, Math.PI * 2); x.fill(); }
  for (const [px, py, r] of puffs) { x.fillStyle = st.cloud; x.beginPath(); x.ellipse(px, py, r, r * 0.62, 0, 0, Math.PI * 2); x.fill(); }
  for (const [px, py, r] of puffs) { x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.ellipse(px - r * 0.25, py - r * 0.25, r * 0.45, r * 0.25, 0, 0, Math.PI * 2); x.fill(); }
  x.restore();
}

/** Cloud sprite for drifting layer. */
export function cloudSprite(size: number, st: SkyStyle, seed: number): HTMLCanvasElement {
  const [c, x] = makeCanvas(size * 3, size * 1.6);
  paintCloud(x, size * 1.5, size * 0.9, size, st, seed, 1);
  return c;
}

export interface BuildingOpts {
  w: number; h: number; base: string; shade: string; trim: string; win: string; lit: string;
  outline: number; detail: number; seed: number; broken: boolean; flatTop?: boolean; style?: number; rust?: boolean; vines?: boolean;
}

/** Paint a ruined building into ctx with its base at (0,0) going up to -h. Returns roof decoration height. */
export function paintBuilding(x: CanvasRenderingContext2D, o: BuildingOpts) {
  const rng = new RNG(o.seed);
  const { w, h } = o;
  pen.use(x, 0);
  // silhouette top
  const top: number[][] = [];
  if (o.flatTop || !o.broken) { top.push([0, -h], [w, -h]); }
  else {
    const steps = 4 + rng.int(0, 4);
    for (let i = 0; i <= steps; i++) {
      const tx = (i / steps) * w;
      const dip = rng.chance(0.5) ? rng.range(0, h * 0.18) : 0;
      top.push([tx, -h + dip]);
      if (i < steps && rng.chance(0.4)) top.push([tx + w / steps * 0.5, -h + rng.range(h * 0.05, h * 0.25)]);
    }
  }
  const poly = [[0, 0], ...top, [w, 0]];
  x.save();
  pen.begin().poly(poly).fill(o.base);
  x.clip();
  // vertical light falloff + texture daubs
  const g = x.createLinearGradient(0, -h, 0, 0);
  g.addColorStop(0, 'rgba(255,240,200,0.12)'); g.addColorStop(1, 'rgba(30,15,10,0.25)');
  x.fillStyle = g; x.fillRect(0, -h - 10, w, h + 10);
  for (let i = 0; i < 6 + o.detail * 8; i++) daub(x, rng.range(0, w), rng.range(-h, 0), rng.range(8, 30), rng.chance(0.5) ? o.shade : mix(o.base, '#ffffff', 0.15), 0.18, rng.next() * 999);
  // cel shade right face
  x.fillStyle = 'rgba(25,12,20,0.22)';
  x.fillRect(w * 0.72, -h - 10, w * 0.3, h + 10);
  // floors + windows
  const style = o.style ?? rng.int(0, 2);
  const floorH = style === 0 ? 26 : style === 1 ? 32 : 22;
  const cols = Math.max(2, Math.floor(w / (style === 1 ? 26 : 20)));
  const mx = w * 0.1, cw = (w - mx * 2) / cols;
  for (let fy = -floorH; fy > -h + 12; fy -= floorH) {
    if (o.detail > 0) { x.fillStyle = 'rgba(30,15,10,0.18)'; x.fillRect(0, fy + floorH - 3, w, 2); }
    for (let cI = 0; cI < cols; cI++) {
      const wx = mx + cI * cw + cw * 0.2, wy = fy + floorH * 0.22, ww = cw * 0.6, wh = floorH * 0.55;
      const r = rng.next();
      if (r < 0.08) continue;
      if (r < 0.14) { x.fillStyle = o.lit; x.fillRect(wx, wy, ww, wh); x.fillStyle = 'rgba(255,240,180,0.25)'; x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4); continue; }
      if (r < 0.24 && o.detail > 1) { // boarded
        x.fillStyle = o.win; x.fillRect(wx, wy, ww, wh);
        x.strokeStyle = P.brownLight; x.lineWidth = 2.5; x.beginPath(); x.moveTo(wx - 1, wy + 2); x.lineTo(wx + ww + 1, wy + wh - 3); x.stroke();
        x.strokeStyle = P.brown; x.beginPath(); x.moveTo(wx - 1, wy + wh - 2); x.lineTo(wx + ww + 1, wy + 3); x.stroke();
        continue;
      }
      x.fillStyle = o.win; x.fillRect(wx, wy, ww, wh);
      if (o.detail > 0 && r > 0.7) { // broken glass glint
        x.fillStyle = 'rgba(200,230,230,0.35)';
        x.beginPath(); x.moveTo(wx, wy); x.lineTo(wx + ww * 0.6, wy); x.lineTo(wx, wy + wh * 0.6); x.closePath(); x.fill();
      }
      if (o.detail > 1) { x.fillStyle = mix(o.base, '#ffffff', 0.25); x.fillRect(wx - 1, wy + wh, ww + 2, 2); }
    }
  }
  // rust streaks
  if (o.rust !== false) {
    for (let i = 0; i < 3 + o.detail * 2; i++) {
      const sx = rng.range(0, w), sy = rng.range(-h, -h * 0.3);
      const sg = x.createLinearGradient(0, sy, 0, sy + 60);
      sg.addColorStop(0, 'rgba(142,74,42,0.45)'); sg.addColorStop(1, 'rgba(142,74,42,0)');
      x.fillStyle = sg; x.fillRect(sx, sy, rng.range(2, 5), rng.range(30, 70));
    }
  }
  // cracks
  if (o.detail > 0) {
    x.strokeStyle = 'rgba(30,15,10,0.5)'; x.lineWidth = 1.2;
    for (let i = 0; i < 2 + o.detail; i++) {
      let cx = rng.range(0, w), cy = rng.range(-h, 0);
      x.beginPath(); x.moveTo(cx, cy);
      for (let k = 0; k < 4; k++) { cx += rng.range(-10, 10); cy += rng.range(4, 14); x.lineTo(cx, cy); }
      x.stroke();
    }
  }
  x.restore();
  // ink outline
  if (o.outline > 0) { pen.begin().poly(poly).stroke(o.outline); }
  // roof trim (parapet)
  if (o.flatTop) {
    pen.begin().rect(-3, -h - 6, w + 6, 8).ink(o.trim, o.outline);
  }
  // vines
  if (o.vines && o.detail > 0) {
    for (let i = 0; i < 3; i++) {
      const vx = rng.range(4, w - 4); const len = rng.range(20, h * 0.5);
      x.strokeStyle = P.oliveDark; x.lineWidth = 2;
      x.beginPath(); x.moveTo(vx, -h); x.quadraticCurveTo(vx + rng.range(-10, 10), -h + len / 2, vx + rng.range(-6, 6), -h + len); x.stroke();
      for (let k = 0; k < len; k += 9) { x.fillStyle = rng.chance(0.5) ? P.olive : P.oliveLight; x.beginPath(); x.ellipse(vx + rng.range(-4, 4), -h + k, 3.5, 2.2, rng.range(0, 3), 0, Math.PI * 2); x.fill(); }
    }
  }
}

export interface LayerOpts { W: number; H: number; seed: number; kind: 'far' | 'mid' | 'near'; }

/** Tileable parallax strip of the Dead City. Ground line at H. */
export function paintCityLayer(o: LayerOpts): HTMLCanvasElement {
  const { W, H } = o;
  const [c, x] = makeCanvas(W, H);
  const rng = new RNG(o.seed);
  const drawWrapped = (bx: number, bw: number, fn: (ox: number) => void) => {
    fn(bx);
    if (bx + bw > W) fn(bx - W);
    if (bx < 0) fn(bx + W);
  };
  if (o.kind === 'far') {
    const hazeBase = '#8a90a0', hazeShade = '#767c8f';
    let bx = 0;
    while (bx < W) {
      const bw = rng.range(40, 110), bh = rng.range(H * 0.25, H * 0.8);
      const seed = rng.int(0, 99999);
      const spire = rng.chance(0.25);
      drawWrapped(bx, bw, (ox) => {
        x.save(); x.translate(ox, H);
        paintBuilding(x, { w: bw, h: bh, base: hazeBase, shade: hazeShade, trim: hazeBase, win: '#6f7488', lit: '#e9c98a', outline: 0, detail: 0, seed, broken: rng.chance(0.6), rust: false });
        if (spire) { x.fillStyle = hazeBase; x.beginPath(); x.moveTo(bw * 0.4, -bh); x.lineTo(bw * 0.5, -bh - 50); x.lineTo(bw * 0.6, -bh); x.fill(); }
        x.restore();
      });
      bx += bw * rng.range(0.7, 1.1);
    }
    // toppled leaning tower & dome
    x.save(); x.translate(W * 0.33, H); x.rotate(0.35); x.fillStyle = '#7f8598'; x.fillRect(-30, -H * 0.85, 60, H * 0.85); x.restore();
    x.fillStyle = '#7f8598'; x.beginPath(); x.ellipse(W * 0.7, H - H * 0.35, 70, 50, 0, Math.PI, 0); x.fill(); x.fillRect(W * 0.7 - 80, H - H * 0.35, 160, H * 0.35);
    // atmospheric haze over everything
    const hg = x.createLinearGradient(0, 0, 0, H);
    hg.addColorStop(0, 'rgba(240,200,140,0)'); hg.addColorStop(1, 'rgba(240,194,122,0.55)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = hg; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
  } else if (o.kind === 'mid') {
    let bx = 0;
    const palettes = [[P.tealDark, '#24484d', P.parchmentShade], ['#6b6a52', '#55543f', P.parchmentShade], ['#7b5c4f', '#5f463c', P.parchmentShade], ['#5c6b6b', '#495656', P.parchmentShade]];
    const items: (() => void)[] = [];
    while (bx < W - 40) {
      const bw = rng.range(60, 130), bh = rng.range(H * 0.22, H * 0.68);
      const pal = rng.pick(palettes);
      const seed = rng.int(0, 99999);
      const extra = rng.next();
      const myx = bx;
      items.push(() => drawWrapped(myx, bw, (ox) => {
        x.save(); x.translate(ox, H);
        paintBuilding(x, { w: bw, h: bh, base: pal[0], shade: pal[1], trim: pal[2], win: '#4a4448', lit: '#f2c66a', outline: 1.5, detail: 1, seed, broken: extra > 0.3, rust: true, vines: extra > 0.6 });
        if (extra < 0.18) { // water tower
          const tx = bw * 0.5, ty = -bh;
          pen.use(x, 0);
          pen.begin().m(tx - 14, ty).l(tx - 10, ty - 22).m(tx + 14, ty).l(tx + 10, ty - 22).stroke(2);
          pen.begin().rrect(tx - 18, ty - 46, 36, 26, 4).ink(P.rust, 2);
          pen.begin().m(tx - 20, ty - 46).l(tx, ty - 58).l(tx + 20, ty - 46).close().ink(P.rustDark, 2);
        } else if (extra < 0.3) { // antenna
          pen.use(x, 0); pen.begin().m(bw * 0.3, -bh).l(bw * 0.3, -bh - 40).m(bw * 0.3 - 8, -bh - 30).l(bw * 0.3 + 8, -bh - 30).stroke(2);
        }
        x.restore();
      }));
      bx += bw + rng.range(-10, 30);
    }
    // a billboard on stilts (original fake brand)
    items.splice(2, 0, () => {
      const bbx = W * 0.55, bby = H - H * 0.55;
      x.save(); x.translate(bbx, bby);
      pen.use(x, 0);
      pen.begin().m(20, 0).l(20, H * 0.55).m(120, 0).l(120, H * 0.55).stroke(5, P.ink);
      pen.begin().rect(0, -70, 140, 70).ink(P.parchment, 2.5);
      x.fillStyle = P.red; x.fillRect(4, -66, 132, 22);
      x.font = '22px "Luckiest Guy", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = P.parchment; x.fillText('FIZZO', 70, -54);
      x.font = '14px "Patrick Hand", sans-serif'; x.fillStyle = P.ink; x.fillText('the fizz that never quits!', 70, -30);
      x.fillStyle = P.teal; x.beginPath(); x.arc(20, -18, 9, 0, 7); x.fill();
      // torn corner
      x.fillStyle = 'rgba(0,0,0,0)';
      x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.moveTo(140, -70); x.lineTo(100, -70); x.lineTo(118, -50); x.lineTo(140, -40); x.fill(); x.globalCompositeOperation = 'source-over';
      x.restore();
    });
    items.forEach((f) => f());
    // haze
    const hg = x.createLinearGradient(0, 0, 0, H);
    hg.addColorStop(0, 'rgba(225,200,165,0.42)'); hg.addColorStop(1, 'rgba(240,194,122,0.5)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = hg; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
  } else {
    // near: rubble mounds, wrecked cars, girders, crane
    pen.use(x, 0);
    // crane
    const cx0 = W * 0.2;
    x.save(); x.translate(cx0, H);
    x.strokeStyle = P.rustDark; x.lineWidth = 3;
    for (let y = 0; y > -H * 0.8; y -= 18) { x.beginPath(); x.moveTo(-10, y); x.lineTo(10, y - 18); x.moveTo(10, y); x.lineTo(-10, y - 18); x.stroke(); }
    pen.begin().m(-10, 0).l(-10, -H * 0.8).m(10, 0).l(10, -H * 0.8).stroke(4, P.rust);
    pen.begin().m(-40, -H * 0.8).l(170, -H * 0.8 + 20).stroke(6, P.rust);
    pen.begin().m(150, -H * 0.8 + 18).l(150, -H * 0.4).stroke(1.5);
    pen.begin().m(144, -H * 0.4).q(150, -H * 0.4 + 14, 156, -H * 0.4).stroke(3);
    x.restore();
    for (let i = 0; i < 14; i++) {
      const mx2 = rng.range(0, W), mw = rng.range(80, 220), mh = rng.range(20, 60);
      const col = rng.pick([P.rustDark, '#4d3a30', '#5a4636', P.oliveDark]);
      drawWrapped(mx2 - mw / 2, mw, (ox) => {
        const cx = ox + mw / 2;
        pen.begin().m(cx - mw / 2, H).q(cx - mw / 4, H - mh, cx, H - mh * 1.05).q(cx + mw / 4, H - mh, cx + mw / 2, H).close().ink(col, 2);
        for (let k = 0; k < 6; k++) { x.fillStyle = mix(col, '#000000', 0.3); x.fillRect(cx + rng.range(-mw / 3, mw / 3), H - rng.range(5, mh * 0.8), rng.range(4, 12), rng.range(3, 8)); }
      });
    }
    // wrecked cars
    for (let i = 0; i < 3; i++) {
      const vx = rng.range(0, W);
      drawWrapped(vx - 40, 80, (ox) => {
        x.save(); x.translate(ox + 40, H - 18); x.rotate(rng.range(-0.25, 0.25));
        pen.begin().m(-38, 6).l(-36, -8).q(-22, -10, -16, -22).l(14, -22).q(22, -10, 36, -8).l(38, 6).close().ink(rng.pick([P.tealDark, P.redDark, P.oliveDark]), 2.5);
        pen.begin().m(-12, -18).l(-6, -10).l(10, -10).l(12, -18).close().ink('#2c2a2c', 1.5);
        pen.begin().ell(-22, 8, 8, 8).ink('#2c2a2c', 2); pen.begin().ell(22, 8, 8, 8).ink('#2c2a2c', 2);
        x.restore();
      });
    }
    // dark warm haze at bottom
    const hg = x.createLinearGradient(0, H * 0.4, 0, H);
    hg.addColorStop(0, 'rgba(60,30,20,0)'); hg.addColorStop(1, 'rgba(60,30,20,0.3)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = hg; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
  }
  return c;
}

/** Vignette overlay (screen space). */
export function paintVignette(W: number, H: number): HTMLCanvasElement {
  const [c, x] = makeCanvas(W, H);
  const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(40,20,10,0)'); g.addColorStop(1, 'rgba(40,20,10,0.5)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  return c;
}
