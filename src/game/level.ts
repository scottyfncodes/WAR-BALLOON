import { P } from '../render/palette';
import { makeCanvas, pen } from '../render/ink';
import { paintBuilding, mix } from '../render/paint';
import { RNG, noise1 } from '../core/math';
import { BIOMES, type Biome } from './biomes';
import { overlayBuilding } from '../render/biomeArt';

export const GROUND = 500;
export const CEILING = 50;
export const WORLD_BOTTOM = 560;

export interface Building { x: number; w: number; h: number; top: number; canvas: HTMLCanvasElement; pad: number; chimney?: boolean; id: number; }

export interface BuildingSpec { x: number; w: number; h: number; chimney?: boolean; }

const ART = 1.25; // prerender resolution multiplier for gameplay-layer art

export class Terrain {
  length: number;
  buildings: Building[] = [];
  chunks: HTMLCanvasElement[] = [];
  chunkW = 1024;
  seed: number;
  biome: Biome;
  lava: [number, number][];
  constructor(length: number, seed: number, specs: BuildingSpec[], biome: Biome = BIOMES.city, lava: [number, number][] = []) {
    this.length = length; this.seed = seed; this.biome = biome; this.lava = lava;
    const rng = new RNG(seed);
    specs.sort((a, b) => a.x - b.x).forEach((s, i) => this.addBuilding(s, rng, i));
    for (let cx = 0; cx < length + 200; cx += this.chunkW) this.chunks.push(this.paintChunk(cx));
  }
  groundY(x: number) { return GROUND - 10 - noise1(x / 140 + this.seed) * 22 - noise1(x / 37 + 9) * 6; }
  /** Highest solid surface under x (smallest y). */
  /** Ground or water surface, whichever is higher. */
  floorY(x: number) { const g = this.groundY(x); return this.biome.water !== undefined ? Math.min(g, this.biome.water) : g; }
  surfaceY(x: number) {
    let y = this.floorY(x);
    for (const b of this.buildings) if (x >= b.x && x <= b.x + b.w && b.top < y) y = b.top;
    return y;
  }
  lavaAt(x: number) { return this.lava.some(([a, w]) => x > a && x < a + w); }
  buildingAt(x: number, y: number) { for (const b of this.buildings) if (x >= b.x && x <= b.x + b.w && y >= b.top) return b; return null; }
  private addBuilding(s: BuildingSpec, rng: RNG, i: number) {
    const pad = 30;
    const base = Math.max(this.groundY(s.x), this.groundY(s.x + s.w), this.groundY(s.x + s.w / 2)) + 14; // sunk into rubble
    const h = base - (this.groundY(s.x + s.w / 2) - s.h);
    const pal = rng.pick(this.biome.buildings);
    const cw = s.w + pad * 2, ch = h + 120;
    const [c, x] = makeCanvas(cw * ART, ch * ART);
    x.scale(ART, ART);
    x.translate(pad, ch - 4);
    paintBuilding(x, { w: s.w, h, base: pal[0], shade: pal[1], trim: pal[2], win: '#2a2426', lit: '#f5c76a', outline: 3, detail: 2, seed: rng.int(0, 99999), broken: false, flatTop: true, style: rng.int(0, 2), rust: true, vines: this.biome.id === 'city' && rng.chance(0.5) });
    overlayBuilding(x, this.biome, s.w, h, rng.int(0, 9999));
    pen.use(x, 0);
    // rooftop clutter (doesn't affect collision; sits on roof plane)
    if (s.chimney) {
      const cx2 = s.w * 0.5 - 16;
      pen.begin().rect(cx2, -h - 70, 32, 66).ink('#7a4a38', 3);
      for (let yy = -h - 64; yy < -h - 6; yy += 10) { x.fillStyle = 'rgba(40,20,10,0.3)'; x.fillRect(cx2 + 2, yy, 28, 2); }
      pen.begin().rect(cx2 - 4, -h - 78, 40, 10).ink(P.rustDark, 3);
    } else {
      const r = rng.next();
      if (r < 0.3) { // rooftop shack door
        pen.begin().rect(s.w * 0.65, -h - 30, 26, 24).ink(pal[1], 2.5); pen.begin().rect(s.w * 0.65 + 8, -h - 22, 10, 16).ink('#2a2426', 1.5);
      } else if (r < 0.55) { // vent pipes
        pen.begin().rect(s.w * 0.2, -h - 20, 10, 16).ink(P.steel, 2); pen.begin().ell(s.w * 0.2 + 5, -h - 20, 7, 3).ink(P.steelDark, 2);
      } else if (r < 0.7) { // tiny garden of survivors past
        for (let k = 0; k < 4; k++) { x.fillStyle = k % 2 ? P.olive : P.oliveLight; x.beginPath(); x.ellipse(s.w * 0.3 + k * 9, -h - 9, 6, 7, 0, 0, Math.PI * 2); x.fill(); }
      }
    }
    // base rubble
    for (let k = 0; k < 5; k++) { pen.begin().poly([[rng.range(-20, s.w + 10), 2], [rng.range(-10, s.w), -rng.range(4, 14)], [rng.range(0, s.w + 20), 2]]).ink(mix(pal[1], '#000000', 0.2), 2); }
    const b: Building = { x: s.x, w: s.w, h, top: base - h, canvas: c, pad, chimney: s.chimney, id: i };
    this.buildings.push(b);
  }
  private paintChunk(cx: number): HTMLCanvasElement {
    const W = this.chunkW, top = GROUND - 60, H = WORLD_BOTTOM - top + 20;
    const [c, x] = makeCanvas(W * ART, H * ART);
    x.scale(ART, ART);
    const rng = new RNG(this.seed * 31 + cx);
    pen.use(x, 0);
    const pts: number[][] = [];
    for (let i = 0; i <= W; i += 8) pts.push([i, this.groundY(cx + i) - top]);
    // soil body
    x.beginPath(); x.moveTo(0, H); pts.forEach((p) => x.lineTo(p[0], p[1])); x.lineTo(W, H); x.closePath();
    const g = x.createLinearGradient(0, 30, 0, H);
    const gp = this.biome.ground;
    g.addColorStop(0, gp.mid); g.addColorStop(0.3, gp.mid); g.addColorStop(1, gp.deep);
    x.fillStyle = g; x.fill();
    x.save(); x.clip();
    // strata + rubble
    for (let i = 0; i < 70; i++) {
      const rx = rng.range(0, W), ry = rng.range(40, H);
      x.fillStyle = rng.pick([...gp.bits, gp.deep]);
      x.beginPath(); x.ellipse(rx, ry, rng.range(3, 12), rng.range(2, 6), rng.range(0, 3), 0, Math.PI * 2); x.fill();
    }
    // buried pipes & slabs
    for (let i = 0; i < 3; i++) {
      const px = rng.range(0, W), py = rng.range(55, 85);
      x.save(); x.translate(px, py); x.rotate(rng.range(-0.3, 0.3));
      pen.begin().rect(-40, -6, 80, 12).ink(rng.pick([P.steelDark, P.rust]), 2);
      x.restore();
    }
    x.restore();
    // cracked asphalt topping
    x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    x.lineWidth = this.biome.id === 'frozen' ? 16 : 9; x.strokeStyle = gp.top; x.stroke();
    x.lineWidth = 3; x.strokeStyle = gp.edge; x.stroke();
    // lava pools
    for (const [lx, lw] of this.lava) {
      if (lx + lw < cx || lx > cx + W) continue;
      const a = lx - cx, gy0 = this.groundY(lx + lw / 2) - top;
      const lg = x.createLinearGradient(0, gy0 - 6, 0, gy0 + 14); lg.addColorStop(0, '#ffd070'); lg.addColorStop(0.4, '#ff7a2a'); lg.addColorStop(1, '#a8301a');
      pen.begin().m(a, gy0 + 4).q(a + lw / 2, gy0 - 10, a + lw, gy0 + 4).q(a + lw / 2, gy0 + 22, a, gy0 + 4).close().ink(lg, 3);
      for (let k = 0; k < lw / 20; k++) { x.fillStyle = 'rgba(255,240,180,0.7)'; x.beginPath(); x.ellipse(a + rng.range(8, lw - 8), gy0 + rng.range(-1, 6), rng.range(3, 7), 2, 0, 0, Math.PI * 2); x.fill(); }
    }
    // weeds & bits on top
    for (let i = 0; i < 40; i++) {
      const wx = rng.range(0, W); const wy = this.groundY(cx + wx) - top;
      if (rng.chance(0.6)) {
        x.strokeStyle = rng.pick(gp.tufts); x.lineWidth = 2;
        for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(wx + k * 2, wy); x.quadraticCurveTo(wx + k * 2 + rng.range(-4, 4), wy - 6, wx + k * 3 + rng.range(-6, 6), wy - rng.range(6, 14)); x.stroke(); }
      } else {
        pen.begin().poly([[wx - 6, wy + 2], [wx - 3, wy - rng.range(4, 9)], [wx + 6, wy - rng.range(2, 6)], [wx + 8, wy + 2]]).ink(rng.pick(gp.bits), 1.8);
      }
    }
    return c;
  }
  drawBuildings(ctx: CanvasRenderingContext2D, x0: number, x1: number) {
    for (const b of this.buildings) {
      if (b.x + b.w + b.pad < x0 || b.x - b.pad > x1) continue;
      const ch = b.h + 120;
      ctx.drawImage(b.canvas, b.x - b.pad, b.top + b.h - ch + 4, b.w + b.pad * 2, ch);
    }
  }
  drawGround(ctx: CanvasRenderingContext2D, x0: number, x1: number) {
    const top = GROUND - 60, H = WORLD_BOTTOM - top + 20;
    for (let i = 0; i < this.chunks.length; i++) {
      const cx = i * this.chunkW;
      if (cx + this.chunkW < x0 || cx > x1) continue;
      ctx.drawImage(this.chunks[i], cx, top, this.chunkW + 1, H);
    }
  }
}
