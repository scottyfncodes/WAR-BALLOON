import { paintSky, paintCityLayer, cloudSprite, paintVignette, DEAD_CITY_SKY } from '../render/paint';
import { grain } from '../render/ink';
import { RNG } from '../core/math';

interface Cache { W: number; sky: HTMLCanvasElement; vignette: HTMLCanvasElement; }
let cache: Cache | null = null;
let layers: { c: HTMLCanvasElement; f: number; base: number; under: string }[] | null = null;
let clouds: { c: HTMLCanvasElement; x: number; y: number; speed: number; f: number }[] = [];
let grainPat: CanvasPattern | null = null;

function ensure(W: number, H: number) {
  if (!cache || cache.W !== W) cache = { W, sky: paintSky(W, H, DEAD_CITY_SKY), vignette: paintVignette(W, H) };
  if (!layers) {
    layers = [
      { c: paintCityLayer({ W: 1400, H: 300, seed: 5, kind: 'far' }), f: 0.1, base: 470, under: '#cfae86' },
      { c: paintCityLayer({ W: 1700, H: 330, seed: 9, kind: 'mid' }), f: 0.28, base: 500, under: '#6f5a48' },
      { c: paintCityLayer({ W: 1600, H: 220, seed: 13, kind: 'near' }), f: 0.55, base: 525, under: '#4a3428' },
    ];
    const rng = new RNG(77);
    clouds = [];
    for (let i = 0; i < 4; i++) clouds.push({ c: cloudSprite(rng.range(45, 80), DEAD_CITY_SKY, i * 31 + 7), x: i * 450 + rng.range(0, 200), y: rng.range(-10, 110), speed: rng.range(4, 12), f: rng.range(0.03, 0.08) });
  }
}

/** Painted parallax backdrop for the Dead City. camX/camY are world camera offsets. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number, camY: number, t: number, opts: { layers?: number } = {}) {
  ensure(W, H);
  ctx.drawImage(cache!.sky, 0, Math.max(-40, Math.min(0, -camY * 0.02 - 20)), W, H + 40);
  const span = W + 700;
  for (const cl of clouds) {
    let x = ((cl.x - camX * cl.f + t * cl.speed) % span + span) % span - 350;
    ctx.drawImage(cl.c, x, cl.y - camY * 0.04);
  }
  const n = opts.layers ?? 3;
  for (let i = 0; i < n; i++) {
    const L = layers![i];
    const bottom = L.base - camY * L.f;
    const top = bottom - L.c.height;
    if (top > H) continue;
    const tw = L.c.width;
    let ox = -((camX * L.f) % tw); if (ox > 0) ox -= tw;
    for (let x = ox; x < W; x += tw) ctx.drawImage(L.c, x, top);
    if (bottom < H) { ctx.fillStyle = L.under; ctx.fillRect(0, bottom - 1, W, H - bottom + 1); }
  }
}

export function drawPost(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  ensure(W, H);
  ctx.drawImage(cache!.vignette, 0, 0);
  if (!grainPat) grainPat = ctx.createPattern(grain(), 'repeat');
  if (grainPat) {
    ctx.save();
    const ox = Math.floor(t * 24) % 4 * 61, oy = Math.floor(t * 24) % 3 * 37;
    ctx.translate(-ox, -oy);
    ctx.globalAlpha = 0.55; ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
  }
  // projector flicker (very subtle)
  const fl = Math.sin(t * 50) * Math.sin(t * 13);
  if (fl > 0.85) { ctx.fillStyle = 'rgba(255,240,200,0.03)'; ctx.fillRect(0, 0, W, H); }
}
