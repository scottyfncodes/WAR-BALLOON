import { P } from './palette';
import { makeCanvas, pen, daub } from './ink';
import { paintBuilding, paintCityLayer, mix } from './paint';
import { RNG, noise1 } from '../core/math';
import type { Biome } from '../game/biomes';

type Kind = 'far' | 'mid' | 'near';

/** Tileable parallax strip for any biome. Ground line at the bottom (H). */
export function paintBiomeLayer(b: Biome, kind: Kind, W: number, H: number, seed: number): HTMLCanvasElement {
  if (b.id === 'city') return paintCityLayer({ W, H, seed, kind });
  const [c, x] = makeCanvas(W, H);
  const rng = new RNG(seed + b.id.length * 101);
  pen.use(x, 0);
  // wraps any element horizontally so the strip tiles seamlessly
  const wrap = (bx: number, bw: number, fn: (ox: number) => void) => { fn(bx); if (bx + bw > W) fn(bx - W); if (bx < 0) fn(bx + W); };
  const ridge = (base: number, amp: number, freq: number, col: string, outline = 0, s = 0) => {
    x.beginPath(); x.moveTo(0, H);
    for (let i = 0; i <= W; i += 6) {
      // periodic noise so the ridge tiles
      const u = (i / W) * Math.PI * 2;
      const y = base - amp * (0.5 + 0.3 * Math.sin(u * freq + s) + 0.2 * Math.sin(u * freq * 2.3 + s * 2) * Math.cos(u * 3));
      x.lineTo(i, y);
    }
    x.lineTo(W, H); x.closePath(); x.fillStyle = col; x.fill();
    if (outline) { x.lineWidth = outline; x.strokeStyle = P.ink; x.stroke(); }
  };
  const building = (bx: number, bw: number, bh: number, pal: [string, string, string], detail: number, outline: number, broken = true) => wrap(bx, bw, (ox) => {
    x.save(); x.translate(ox, H);
    paintBuilding(x, { w: bw, h: bh, base: pal[0], shade: pal[1], trim: pal[2], win: mix(pal[1], '#000000', 0.3), lit: '#f2c66a', outline, detail, seed: rng.int(0, 99999), broken, rust: detail > 0 });
    x.restore();
  });
  const haze = (a: string, from = 0) => {
    const g = x.createLinearGradient(0, from, 0, H);
    g.addColorStop(0, a.replace(/[\d.]+\)$/, '0.15)')); g.addColorStop(1, a);
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
  };

  switch (b.id) {
    // ------------------------------------------------------------ DUSTLANDS
    case 'dust': {
      if (kind === 'far') {
        // mesas + half-buried skyline
        for (let i = 0; i < 4; i++) {
          const mx = rng.range(0, W), mw = rng.range(160, 300), mh = rng.range(H * 0.35, H * 0.6);
          wrap(mx, mw, (ox) => { x.fillStyle = '#c99068'; x.beginPath(); x.moveTo(ox, H); x.lineTo(ox + 30, H - mh); x.lineTo(ox + mw - 30, H - mh); x.lineTo(ox + mw, H); x.fill(); x.fillStyle = '#b57c58'; x.fillRect(ox + 30, H - mh, mw - 60, 8); });
        }
        for (let bx = 0; bx < W; bx += rng.range(80, 160)) building(bx, rng.range(40, 80), rng.range(H * 0.2, H * 0.5), ['#c9a07a', '#b88e6a', '#c9a07a'], 0, 0);
        ridge(H * 0.92, H * 0.18, 2, '#e2b984', 0, 1);
        haze(b.haze[0]);
      } else if (kind === 'mid') {
        // buried buildings sticking out of dunes, a crashed airliner tail
        for (let bx = 0; bx < W - 40; bx += rng.range(140, 260)) {
          const pal = rng.pick(b.buildings);
          building(bx, rng.range(60, 120), rng.range(H * 0.3, H * 0.65), pal, 1, 1.5, true);
        }
        const tx = W * 0.62;
        x.save(); x.translate(tx, H * 0.7); x.rotate(-0.25);
        pen.begin().m(0, 0).l(30, -110).l(70, -110).l(60, 0).close().ink('#d8d0c0', 2);
        pen.begin().m(34, -96).l(62, -96).l(60, -70).l(36, -70).close().fill(P.red);
        x.restore();
        ridge(H * 0.95, H * 0.3, 3, '#dcae74', 1.5, 2);
        haze(b.haze[1]);
      } else {
        ridge(H * 0.98, H * 0.45, 2, '#cf9c5e', 2.5, 4);
        // cacti & bleached pipes
        for (let i = 0; i < 7; i++) {
          const cx = rng.range(0, W), ch = rng.range(30, 60);
          wrap(cx - 20, 40, (ox) => {
            const bx = ox + 20, by = H - rng.range(10, 40);
            pen.begin().rrect(bx - 6, by - ch, 12, ch, 6).ink('#6f8a3a', 2);
            pen.begin().m(bx - 6, by - ch * 0.5).q(bx - 18, by - ch * 0.5, bx - 18, by - ch * 0.8).stroke(7, P.ink);
            pen.begin().m(bx - 6, by - ch * 0.5).q(bx - 18, by - ch * 0.5, bx - 18, by - ch * 0.8).stroke(4.5, '#6f8a3a');
          });
        }
        for (let i = 0; i < 3; i++) { const px = rng.range(0, W); wrap(px, 120, (ox) => { x.save(); x.translate(ox, H - 20); x.rotate(rng.range(-0.2, 0.2)); pen.begin().rrect(0, -14, 120, 22, 10).ink('#e8dcc4', 2); pen.begin().ell(120, -3, 6, 11).ink('#bfae90', 2); x.restore(); }); }
      }
      break;
    }
    // ------------------------------------------------------------ FLOOD
    case 'flood': {
      const water = (y: number, col: string, alpha: number) => {
        x.fillStyle = col; x.globalAlpha = alpha; x.fillRect(0, y, W, H - y); x.globalAlpha = 1;
        x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1.5;
        for (let i = 0; i < 40; i++) { const wx = rng.range(0, W), wy = rng.range(y + 4, H); x.beginPath(); x.moveTo(wx, wy); x.lineTo(wx + rng.range(10, 30), wy); x.stroke(); }
      };
      if (kind === 'far') {
        for (let bx = 0; bx < W; bx += rng.range(50, 110)) building(bx, rng.range(40, 90), rng.range(H * 0.3, H * 0.8), ['#8a9ca2', '#7a8c92', '#8a9ca2'], 0, 0, rng.chance(0.5));
        haze(b.haze[0]);
        water(H * 0.86, '#7f989c', 0.9);
      } else if (kind === 'mid') {
        for (let bx = 0; bx < W - 40; bx += rng.range(90, 170)) building(bx, rng.range(60, 120), rng.range(H * 0.35, H * 0.8), rng.pick(b.buildings), 1, 1.5, true);
        // rooftop boats & a ferris wheel
        const fx = W * 0.4, fy = H * 0.45;
        x.strokeStyle = 'rgba(42,26,20,0.6)'; x.lineWidth = 2;
        x.beginPath(); x.arc(fx, fy, 70, 0, Math.PI * 2); x.stroke();
        for (let a = 0; a < 12; a++) { const aa = (a / 12) * Math.PI * 2; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + Math.cos(aa) * 70, fy + Math.sin(aa) * 70); x.stroke(); x.fillStyle = a % 2 ? P.red : P.gold; x.fillRect(fx + Math.cos(aa) * 70 - 5, fy + Math.sin(aa) * 70, 10, 8); }
        haze(b.haze[1]);
        water(H * 0.78, '#4f6e74', 0.85);
      } else {
        // drifting debris: rafts, barrels, a capsized boat
        x.fillStyle = 'rgba(40,70,76,0.85)'; x.fillRect(0, H * 0.55, W, H * 0.45);
        for (let i = 0; i < 8; i++) {
          const dx = rng.range(0, W), dy = rng.range(H * 0.58, H * 0.9);
          wrap(dx, 70, (ox) => {
            const r = rng.next();
            if (r < 0.4) { pen.begin().rect(ox, dy - 8, 60, 10).ink(P.brownLight, 2); pen.begin().m(ox + 10, dy - 8).l(ox + 10, dy + 2).m(ox + 30, dy - 8).l(ox + 30, dy + 2).stroke(1.2, P.brown); }
            else if (r < 0.7) { pen.begin().rrect(ox, dy - 18, 22, 22, 4).ink(rng.pick([P.red, P.teal, P.olive]), 2); }
            else { pen.begin().m(ox, dy).q(ox + 35, dy + 22, ox + 70, dy).close().ink(P.parchmentShade, 2); }
          });
        }
        x.strokeStyle = 'rgba(255,255,255,0.4)'; x.lineWidth = 2;
        for (let i = 0; i < 30; i++) { const wx = rng.range(0, W), wy = rng.range(H * 0.6, H); x.beginPath(); x.moveTo(wx, wy); x.quadraticCurveTo(wx + 10, wy - 4, wx + 22, wy); x.stroke(); }
      }
      break;
    }
    // ------------------------------------------------------------ GREEN
    case 'green': {
      const tree = (tx: number, ty: number, s: number, col: string, outline: number) => {
        pen.begin().m(tx - 4 * s, ty).l(tx - 3 * s, ty - 40 * s).l(tx + 3 * s, ty - 40 * s).l(tx + 4 * s, ty).close().ink('#5a4430', outline);
        for (let k = 0; k < 5; k++) { const px = tx + rng.range(-22, 22) * s, py = ty - 40 * s - rng.range(0, 30) * s; pen.begin().ell(px, py, 20 * s, 15 * s).ink(col, outline); }
      };
      if (kind === 'far') {
        ridge(H * 0.7, H * 0.4, 2, '#8aa880', 0, 1);
        for (let bx = 0; bx < W; bx += rng.range(90, 170)) { building(bx, rng.range(40, 70), rng.range(H * 0.3, H * 0.6), ['#8fa48a', '#7f947a', '#8fa48a'], 0, 0); }
        for (let i = 0; i < 30; i++) { const tx = rng.range(0, W); wrap(tx - 20, 40, (ox) => { x.fillStyle = '#7a9a6e'; x.beginPath(); x.ellipse(ox + 20, H - rng.range(0, H * 0.25), 22, 16, 0, 0, Math.PI * 2); x.fill(); }); }
        haze(b.haze[0]);
      } else if (kind === 'mid') {
        for (let bx = 0; bx < W - 40; bx += rng.range(100, 180)) {
          const bw = rng.range(60, 110), bh = rng.range(H * 0.35, H * 0.75);
          building(bx, bw, bh, rng.pick(b.buildings), 1, 1.5, true);
          wrap(bx, bw, (ox) => { for (let k = 0; k < 4; k++) { x.fillStyle = rng.pick(['#5f8a3a', '#7aa04a', '#4f7a32']); x.beginPath(); x.ellipse(ox + rng.range(0, bw), H - bh + rng.range(-10, 20), rng.range(14, 26), rng.range(10, 18), 0, 0, Math.PI * 2); x.fill(); } });
        }
        for (let i = 0; i < 6; i++) { const tx = rng.range(0, W); wrap(tx - 40, 80, (ox) => tree(ox + 40, H, 1.4, '#6a9a44', 1.5)); }
        haze(b.haze[1]);
      } else {
        for (let i = 0; i < 9; i++) {
          const fx = rng.range(0, W);
          wrap(fx - 50, 100, (ox) => {
            // giant fern fronds
            for (let k = 0; k < 5; k++) {
              const a = -Math.PI / 2 + (k - 2) * 0.45;
              const ex = ox + 50 + Math.cos(a) * 80, ey = H + Math.sin(a) * 80;
              pen.begin().m(ox + 50, H).q(ox + 50 + Math.cos(a) * 30, H - 50, ex, ey).stroke(9, P.ink);
              pen.begin().m(ox + 50, H).q(ox + 50 + Math.cos(a) * 30, H - 50, ex, ey).stroke(6, rng.pick(['#4f7a2a', '#5f8a32', '#3f6a24']));
            }
          });
        }
      }
      break;
    }
    // ------------------------------------------------------------ FROZEN REACH
    case 'frozen': {
      const pine = (tx: number, ty: number, s: number, outline: number) => {
        for (let k = 0; k < 3; k++) { const w = (22 - k * 5) * s, y0 = ty - k * 16 * s; pen.begin().m(tx - w, y0).l(tx, y0 - 28 * s).l(tx + w, y0).close().ink(k % 2 ? '#3f5a4a' : '#355042', outline); pen.begin().m(tx - w * 0.6, y0 - 8 * s).l(tx, y0 - 28 * s).l(tx + w * 0.4, y0 - 12 * s).close().fill('#f2f5f8'); }
      };
      if (kind === 'far') {
        // jagged snowy mountains
        for (let i = 0; i < 5; i++) {
          const mx = rng.range(0, W), mw = rng.range(240, 420), mh = rng.range(H * 0.45, H * 0.9);
          wrap(mx, mw, (ox) => {
            x.fillStyle = '#9aaabc'; x.beginPath(); x.moveTo(ox, H); x.lineTo(ox + mw / 2, H - mh); x.lineTo(ox + mw, H); x.fill();
            x.fillStyle = '#f4f6f8'; x.beginPath(); x.moveTo(ox + mw / 2, H - mh); x.lineTo(ox + mw / 2 - mw * 0.14, H - mh * 0.7); x.lineTo(ox + mw / 2 - 8, H - mh * 0.76); x.lineTo(ox + mw / 2 + 10, H - mh * 0.66); x.lineTo(ox + mw / 2 + mw * 0.14, H - mh * 0.72); x.closePath(); x.fill();
          });
        }
        haze(b.haze[0]);
      } else if (kind === 'mid') {
        for (let bx = 0; bx < W - 40; bx += rng.range(130, 220)) {
          const bw = rng.range(60, 110), bh = rng.range(H * 0.25, H * 0.55);
          building(bx, bw, bh, rng.pick(b.buildings), 1, 1.5, false);
          wrap(bx, bw, (ox) => { x.fillStyle = '#f4f6f8'; x.fillRect(ox - 3, H - bh - 6, bw + 6, 8); });
        }
        // research domes & radar dish
        for (let i = 0; i < 2; i++) { const dx = rng.range(0, W); wrap(dx - 60, 120, (ox) => { pen.begin().m(ox, H).q(ox + 60, H - 140, ox + 120, H).close().ink('#dfe6ee', 2); for (let k = 1; k < 4; k++) pen.begin().m(ox + k * 30, H).q(ox + 60, H - 140, ox + 60, H - 70).stroke(1, '#a0b0c0'); }); }
        const rx = W * 0.7; pen.begin().m(rx, H).l(rx, H - 120).stroke(4); pen.begin().m(rx - 40, H - 150).q(rx, H - 90, rx + 40, H - 150).close().ink('#dfe6ee', 2);
        for (let i = 0; i < 6; i++) pine(rng.range(0, W), H, 1.2, 1.2);
        haze(b.haze[1]);
      } else {
        ridge(H * 1.0, H * 0.4, 3, '#eef2f6', 2, 3);
        for (let i = 0; i < 10; i++) { const tx = rng.range(0, W); wrap(tx - 30, 60, (ox) => pine(ox + 30, H - rng.range(0, 30), 1.6, 2)); }
      }
      break;
    }
    // ------------------------------------------------------------ ASHLANDS
    case 'ash': {
      if (kind === 'far') {
        // volcanoes with glowing calderas
        for (let i = 0; i < 3; i++) {
          const mx = rng.range(0, W), mw = rng.range(320, 480), mh = rng.range(H * 0.55, H * 0.9);
          wrap(mx, mw, (ox) => {
            x.fillStyle = '#5a3a36'; x.beginPath(); x.moveTo(ox, H); x.lineTo(ox + mw * 0.42, H - mh); x.lineTo(ox + mw * 0.58, H - mh); x.lineTo(ox + mw, H); x.fill();
            const g = x.createRadialGradient(ox + mw / 2, H - mh, 4, ox + mw / 2, H - mh, 70); g.addColorStop(0, 'rgba(255,140,60,0.9)'); g.addColorStop(1, 'rgba(255,90,40,0)');
            x.fillStyle = g; x.fillRect(ox + mw / 2 - 70, H - mh - 70, 140, 140);
            x.strokeStyle = 'rgba(255,110,50,0.6)'; x.lineWidth = 3; x.beginPath(); x.moveTo(ox + mw / 2, H - mh); x.quadraticCurveTo(ox + mw * 0.45, H - mh * 0.5, ox + mw * 0.38, H - mh * 0.1); x.stroke();
          });
        }
        haze(b.haze[0]);
      } else if (kind === 'mid') {
        for (let bx = 0; bx < W - 40; bx += rng.range(110, 200)) {
          const bw = rng.range(60, 110), bh = rng.range(H * 0.3, H * 0.7);
          building(bx, bw, bh, rng.pick(b.buildings), 1, 1.5, true);
          if (rng.chance(0.5)) wrap(bx, bw, (ox) => { pen.begin().rect(ox + bw * 0.3, H - bh - 70, 18, 70).ink('#3a2a26', 1.5); x.fillStyle = 'rgba(255,120,50,0.5)'; x.beginPath(); x.arc(ox + bw * 0.3 + 9, H - bh - 72, 8, 0, Math.PI * 2); x.fill(); });
        }
        // refinery tanks
        for (let i = 0; i < 2; i++) { const tx = rng.range(0, W); wrap(tx, 90, (ox) => { pen.begin().rrect(ox, H - 90, 90, 90, 10).ink('#4a3a34', 1.5); pen.begin().m(ox, H - 60).l(ox + 90, H - 60).stroke(1.5, '#2a2020'); }); }
        haze(b.haze[1]);
      } else {
        ridge(H * 1.0, H * 0.4, 3, '#2e2422', 2, 5);
        // glowing lava rivulets
        for (let i = 0; i < 6; i++) { const lx = rng.range(0, W); wrap(lx, 80, (ox) => { x.strokeStyle = '#ff7a2a'; x.lineWidth = 3; x.beginPath(); x.moveTo(ox, H - 10); x.quadraticCurveTo(ox + 40, H - 30, ox + 80, H - 8); x.stroke(); x.strokeStyle = 'rgba(255,200,90,0.8)'; x.lineWidth = 1; x.stroke(); }); }
      }
      break;
    }
  }
  return c;
}

/** Biome-specific overlay painted onto gameplay buildings (snow caps, sand drifts, moss, water stains, scorch). */
export function overlayBuilding(x: CanvasRenderingContext2D, b: Biome, w: number, h: number, seed: number) {
  const rng = new RNG(seed);
  pen.use(x, 0);
  switch (b.overlay) {
    case 'snow':
      pen.begin().m(-6, -h - 4).q(w * 0.3, -h - 16, w * 0.6, -h - 10).q(w * 0.85, -h - 16, w + 6, -h - 4).l(w + 6, -h + 4).l(-6, -h + 4).close().ink('#f6f9fb', 2.5);
      for (let i = 0; i < Math.floor(w / 18); i++) { const ix = 6 + i * 18 + rng.range(-3, 3); const il = rng.range(6, 18); pen.begin().m(ix - 3, -h + 4).l(ix, -h + 4 + il).l(ix + 3, -h + 4).close().ink('#d8eef6', 1.2); }
      break;
    case 'sand':
      pen.begin().m(-20, 2).q(w * 0.2, -h * 0.25, w * 0.5, -h * 0.12).q(w * 0.8, -h * 0.05, w + 20, 2).close().ink('#e3b878', 2.5);
      for (let i = 0; i < 5; i++) { x.strokeStyle = 'rgba(160,110,60,0.4)'; x.lineWidth = 1.5; x.beginPath(); const yy = -rng.range(4, h * 0.12); x.moveTo(rng.range(0, w * 0.4), yy); x.quadraticCurveTo(w * 0.5, yy - 6, rng.range(w * 0.6, w), yy); x.stroke(); }
      break;
    case 'vines':
      for (let i = 0; i < 4 + Math.floor(w / 40); i++) {
        const vx = rng.range(0, w), len = rng.range(h * 0.3, h * 0.9);
        x.strokeStyle = '#3f6a24'; x.lineWidth = 3; x.beginPath(); x.moveTo(vx, -h); x.bezierCurveTo(vx + 10, -h + len * 0.3, vx - 10, -h + len * 0.6, vx + rng.range(-8, 8), -h + len); x.stroke();
        for (let k = 0; k < len; k += 10) { x.fillStyle = rng.pick(['#5f8a32', '#7aa04a', '#4f7a2a']); x.beginPath(); x.ellipse(vx + rng.range(-6, 6), -h + k, 5, 3, rng.range(0, 3), 0, Math.PI * 2); x.fill(); }
      }
      for (let k = 0; k < 4; k++) { x.fillStyle = rng.pick(['#5f8a32', '#7aa04a']); x.beginPath(); x.ellipse(rng.range(0, w), -h - 6, rng.range(12, 22), rng.range(8, 12), 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = P.ink; x.lineWidth = 1.5; x.stroke(); }
      break;
    case 'water': {
      x.fillStyle = 'rgba(30,50,55,0.35)'; x.fillRect(0, -h * 0.28, w, h * 0.28);
      x.strokeStyle = 'rgba(200,220,215,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -h * 0.28); x.lineTo(w, -h * 0.28); x.stroke();
      for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(60,100,70,0.5)'; x.fillRect(rng.range(0, w - 10), -h * 0.28, rng.range(6, 16), rng.range(8, 22)); }
      break;
    }
    case 'scorch':
      for (let i = 0; i < 6; i++) daub(x, rng.range(0, w), rng.range(-h, -h * 0.3), rng.range(10, 24), '#1a1210', 0.35, seed + i);
      for (let i = 0; i < 3; i++) { const ex = rng.range(8, w - 8), ey = rng.range(-h * 0.8, -h * 0.3); x.fillStyle = 'rgba(255,120,50,0.55)'; x.fillRect(ex, ey, 10, 8); }
      break;
  }
  void noise1;
}
