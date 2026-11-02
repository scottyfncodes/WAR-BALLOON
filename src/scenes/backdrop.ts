import { paintSky, cloudSprite, paintVignette } from '../render/paint';
import { paintBiomeLayer } from '../render/biomeArt';
import { grain } from '../render/ink';
import { RNG } from '../core/math';
import { BIOMES, type Biome } from '../game/biomes';

interface BiomeCache { W: number; sky: HTMLCanvasElement; layers: { c: HTMLCanvasElement; f: number; base: number; under: string }[]; clouds: { c: HTMLCanvasElement; x: number; y: number; speed: number; f: number }[]; }
const caches = new Map<string, BiomeCache>();
let vignette: { W: number; c: HTMLCanvasElement } | null = null;
let grainPat: CanvasPattern | null = null;

function ensure(b: Biome, W: number, H: number): BiomeCache {
  let c = caches.get(b.id);
  if (c && c.W === W) return c;
  // keep memory in check on phones: only hold two biomes at once
  if (!c && caches.size >= 2) { const first = caches.keys().next().value as string; caches.delete(first); }
  const layers = c?.layers ?? [
    { c: paintBiomeLayer(b, 'far', 1400, 300, 5), f: 0.1, base: 470, under: b.under[0] },
    { c: paintBiomeLayer(b, 'mid', 1700, 330, 9), f: 0.28, base: 500, under: b.under[1] },
    { c: paintBiomeLayer(b, 'near', 1600, 220, 13), f: 0.55, base: 525, under: b.under[2] },
  ];
  let clouds = c?.clouds;
  if (!clouds) {
    const rng = new RNG(77 + b.id.length);
    clouds = [];
    const n = b.id === 'flood' || b.id === 'ash' ? 6 : 4;
    for (let i = 0; i < n; i++) clouds.push({ c: cloudSprite(rng.range(45, b.id === 'flood' ? 110 : 80), b.sky, i * 31 + 7), x: i * 450 + rng.range(0, 200), y: rng.range(-10, 110), speed: rng.range(4, 12), f: rng.range(0.03, 0.08) });
  }
  c = { W, sky: paintSky(W, H, b.sky, 3 + b.id.length), layers, clouds };
  caches.set(b.id, c);
  return c;
}

/** Painted parallax backdrop. camX/camY are world camera offsets. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number, camY: number, t: number, opts: { layers?: number; biome?: Biome } = {}) {
  const b = opts.biome ?? BIOMES.city;
  const c = ensure(b, W, H);
  ctx.drawImage(c.sky, 0, Math.max(-40, Math.min(0, -camY * 0.02 - 20)), W, H + 40);
  const span = W + 700;
  for (const cl of c.clouds) {
    const x = ((cl.x - camX * cl.f + t * cl.speed) % span + span) % span - 350;
    ctx.drawImage(cl.c, x, cl.y - camY * 0.04);
  }
  const n = opts.layers ?? 3;
  for (let i = 0; i < n; i++) {
    const L = c.layers[i];
    const bottom = L.base - camY * L.f;
    const top = bottom - L.c.height;
    if (top > H) continue;
    const tw = L.c.width;
    let ox = -((camX * L.f) % tw); if (ox > 0) ox -= tw;
    for (let x = ox; x < W; x += tw) ctx.drawImage(L.c, x, top);
    if (bottom < H) { ctx.fillStyle = L.under; ctx.fillRect(0, bottom - 1, W, H - bottom + 1); }
  }
}

/** Screen-space weather: sand, rain, spores, snow or ash. intensity 0..2 (storms). */
export function drawAmbient(ctx: CanvasRenderingContext2D, W: number, H: number, b: Biome, t: number, camX: number, intensity = 1, wind = 0) {
  if (b.ambient === 'none') return;
  const n = Math.floor((b.ambient === 'rain' ? 70 : 45) * intensity);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const seed = i * 97.13;
    const sp = 0.6 + (i % 7) / 7;
    switch (b.ambient) {
      case 'rain': {
        const x = ((seed * 13 - camX * 0.9 + t * (wind * 2 - 60) * sp) % (W + 40) + W + 40) % (W + 40) - 20;
        const y = ((seed * 7 + t * 620 * sp) % (H + 40)) - 20;
        ctx.strokeStyle = 'rgba(210,225,230,0.45)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4 - wind * 0.05, y + 16); ctx.stroke();
        break;
      }
      case 'snow': {
        const x = ((seed * 13 - camX * 0.7 + t * (wind + 20) * sp + Math.sin(t * 1.5 + i) * 20) % (W + 40) + W + 40) % (W + 40) - 20;
        const y = ((seed * 7 + t * 50 * sp) % (H + 40)) - 20;
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x, y, 1.5 + sp * 1.6, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'sand': {
        const x = ((seed * 13 - camX * 0.8 + t * (180 + wind * 3) * sp) % (W + 80) + W + 80) % (W + 80) - 40;
        const y = (seed * 7 + Math.sin(t * 2 + i) * 14) % H;
        ctx.strokeStyle = `rgba(230,190,130,${0.25 + 0.2 * sp})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14 * sp, y + 1); ctx.stroke();
        break;
      }
      case 'spores': {
        const x = ((seed * 13 - camX * 0.6 + t * 12 * sp + Math.sin(t * 0.8 + i) * 30) % (W + 40) + W + 40) % (W + 40) - 20;
        const y = ((seed * 7 - t * 14 * sp) % H + H) % H;
        ctx.fillStyle = i % 3 ? 'rgba(255,250,200,0.6)' : 'rgba(200,240,140,0.6)';
        ctx.beginPath(); ctx.arc(x, y, 1.5 + sp, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'ash': {
        const x = ((seed * 13 - camX * 0.7 + t * (wind + 10) * sp + Math.sin(t + i) * 16) % (W + 40) + W + 40) % (W + 40) - 20;
        const y = ((seed * 7 + t * 36 * sp) % (H + 20)) - 10;
        const ember = i % 6 === 0;
        ctx.fillStyle = ember ? `rgba(255,${140 + (i % 4) * 20},60,0.85)` : 'rgba(70,60,58,0.6)';
        ctx.beginPath(); ctx.arc(x, ember ? H - ((seed * 3 + t * 40 * sp) % H) : y, ember ? 1.8 : 2.2, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
  }
  ctx.restore();
}

export function drawPost(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  if (!vignette || vignette.W !== W) vignette = { W, c: paintVignette(W, H) };
  ctx.drawImage(vignette.c, 0, 0);
  if (!grainPat) grainPat = ctx.createPattern(grain(), 'repeat');
  if (grainPat) {
    ctx.save();
    const ox = Math.floor(t * 24) % 4 * 61, oy = Math.floor(t * 24) % 3 * 37;
    ctx.translate(-ox, -oy);
    ctx.globalAlpha = 0.55; ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
  }
  const fl = Math.sin(t * 50) * Math.sin(t * 13);
  if (fl > 0.85) { ctx.fillStyle = 'rgba(255,240,200,0.03)'; ctx.fillRect(0, 0, W, H); }
}
