import { P } from '../render/palette';
import { pen, inkText, FONT_TITLE } from '../render/ink';
import { rand, pick, clamp, easeOutBack } from '../core/math';

interface Part {
  kind: 'smoke' | 'debris' | 'spark' | 'flame' | 'star' | 'ring' | 'flash' | 'dust' | 'feather' | 'drop' | 'confetti' | 'soot' | 'gring';
  x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; rot: number; vr: number; color: string; grav: number; drag: number;
}
interface Popup { x: number; y: number; text: string; color: string; life: number; max: number; size: number; vy: number; }
interface Burst { x: number; y: number; text: string; life: number; max: number; size: number; rot: number; color: string; }

export class FX {
  parts: Part[] = [];
  popups: Popup[] = [];
  bursts: Burst[] = [];
  shake = 0;
  hitstop = 0;
  hitstopCool = 0;
  flash = 0;

  add(p: Partial<Part> & { kind: Part['kind']; x: number; y: number }) {
    if (this.parts.length > 420) this.parts.shift();
    this.parts.push({ vx: 0, vy: 0, life: 1, max: 1, r: 6, rot: rand(0, 6), vr: 0, color: P.smoke, grav: 0, drag: 1, ...p } as Part);
  }
  explosion(x: number, y: number, size = 1, text?: string) {
    const s = size;
    this.add({ kind: 'flash', x, y, r: 40 * s, life: 0.12, max: 0.12, color: P.white });
    this.add({ kind: 'star', x, y, r: 46 * s, life: 0.32, max: 0.32, color: P.gold, rot: rand(0, 6) });
    this.add({ kind: 'star', x, y, r: 30 * s, life: 0.28, max: 0.28, color: P.flame2, rot: rand(0, 6) });
    this.add({ kind: 'ring', x, y, r: 10 * s, life: 0.35, max: 0.35, color: P.parchment });
    for (let i = 0; i < 9 * s + 3; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(30, 110) * s;
      this.add({ kind: 'smoke', x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 40, r: rand(10, 20) * Math.sqrt(s), life: rand(0.7, 1.3), max: 1.3, color: pick([P.smoke, P.smokeLight, '#6d5e58']), drag: 2.4, grav: -20 });
    }
    for (let i = 0; i < 8 * s; i++) {
      const a = rand(-Math.PI, 0), sp = rand(120, 320) * s;
      this.add({ kind: 'debris', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(2.5, 6), life: rand(0.8, 1.5), max: 1.5, color: pick([P.rust, P.steelDark, P.brownDark, P.ink, P.olive]), grav: 700, vr: rand(-12, 12), drag: 0.4 });
    }
    for (let i = 0; i < 10 * s; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(150, 380);
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2, life: rand(0.2, 0.45), max: 0.45, color: pick([P.flame1, P.gold]), grav: 300, drag: 2 });
    }
    if (text) this.burst(x, y - 30 * s, text, 26 + 10 * s);
    this.shake = Math.max(this.shake, 6 * s);
    this.stop(0.035 * s);
  }
  /** Brief freeze-frame for impact, rate limited so chains of explosions never stall the game. */
  stop(t: number) { if (this.hitstopCool > 0) return; this.hitstop = Math.max(this.hitstop, Math.min(t, 0.08)); this.hitstopCool = 0.25; }
  puff(x: number, y: number, n = 4, color = P.smokeLight, size = 8) {
    for (let i = 0; i < n; i++) this.add({ kind: 'smoke', x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-30, 30), vy: rand(-40, 0), r: rand(size * 0.6, size * 1.2), life: rand(0.4, 0.8), max: 0.8, color, drag: 2, grav: -20 });
  }
  /** Flat dust shockwave hugging the ground. */
  groundRing(x: number, y: number, r: number) {
    this.add({ kind: 'gring', x, y, r, life: 0.45, max: 0.45, color: P.parchmentShade });
    for (let i = 0; i < 10; i++) { const s = i % 2 ? 1 : -1; this.add({ kind: 'dust', x: x + s * Math.random() * 10, y: y - 4, vx: s * (140 + Math.random() * 160), vy: -Math.random() * 40, r: 6 + Math.random() * 6, life: 0.6, max: 0.6, color: P.parchmentShade, drag: 4 }); }
  }
  dust(x: number, y: number, n = 6) {
    for (let i = 0; i < n; i++) this.add({ kind: 'dust', x: x + rand(-14, 14), y, vx: rand(-60, 60), vy: rand(-50, -10), r: rand(5, 10), life: rand(0.4, 0.8), max: 0.8, color: P.parchmentShade, drag: 3 });
  }
  sparks(x: number, y: number, n = 8, color = P.electric) {
    for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), sp = rand(60, 260); this.add({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2, life: rand(0.15, 0.35), max: 0.35, color, drag: 3, grav: 200 }); }
  }
  feathers(x: number, y: number, n = 6) {
    for (let i = 0; i < n; i++) this.add({ kind: 'feather', x, y, vx: rand(-90, 90), vy: rand(-120, -20), r: 5, life: rand(1, 1.6), max: 1.6, color: pick([P.steel, P.steelLight, P.rust]), grav: 120, drag: 2.5, vr: rand(-6, 6) });
  }
  confetti(x: number, y: number, n = 30) {
    for (let i = 0; i < n; i++) { const a = rand(-Math.PI, 0), sp = rand(120, 320); this.add({ kind: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, life: rand(1.2, 2), max: 2, color: pick([P.gold, P.red, P.teal, P.orange, P.parchment]), grav: 260, drag: 1.5, vr: rand(-10, 10) }); }
  }
  popup(x: number, y: number, text: string, color: string = P.gold, size = 20) {
    this.popups.push({ x, y, text, color, life: 1.1, max: 1.1, size, vy: -50 });
  }
  burst(x: number, y: number, text: string, size = 34, color: string = P.goldLight) {
    this.bursts.push({ x, y, text, life: 0.8, max: 0.8, size, rot: rand(-0.25, 0.25), color });
  }
  update(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 30);
    this.hitstopCool = Math.max(0, this.hitstopCool - dt);
    this.flash = Math.max(0, this.flash - dt * 3);
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.grav * dt;
      const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.kind === 'smoke' || p.kind === 'soot') p.r += dt * 10;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.popups) { p.life -= dt; p.y += p.vy * dt; p.vy *= Math.exp(-2 * dt); }
    this.popups = this.popups.filter((p) => p.life > 0);
    for (const b of this.bursts) b.life -= dt;
    this.bursts = this.bursts.filter((b) => b.life > 0);
  }
  /** Draw world-space particles (camera transform already applied). */
  draw(ctx: CanvasRenderingContext2D, layer: 'back' | 'front' = 'front') {
    pen.use(ctx, 0.5);
    for (const p of this.parts) {
      const back = p.kind === 'smoke' || p.kind === 'dust' || p.kind === 'soot';
      if ((layer === 'back') !== back) continue;
      const t = clamp(p.life / p.max, 0, 1);
      switch (p.kind) {
        case 'smoke': case 'dust': case 'soot': {
          ctx.globalAlpha = Math.min(1, t * 1.6) * (p.kind === 'dust' ? 0.7 : 0.9);
          const r = p.r * (p.kind === 'smoke' ? (0.6 + (1 - t) * 0.6) : 1);
          pen.begin().ell(p.x, p.y, r, r * 0.9).ink(p.color, p.kind === 'smoke' ? 2 : 0);
          if (p.kind === 'smoke') { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.35, 0, 7); ctx.fill(); }
          ctx.globalAlpha = 1;
          break;
        }
        case 'debris':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          pen.begin().poly([[-p.r, -p.r * 0.6], [p.r, -p.r * 0.8], [p.r * 0.7, p.r * 0.7], [-p.r * 0.8, p.r * 0.5]]).ink(p.color, 1.5);
          ctx.restore(); break;
        case 'spark':
          ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); break;
        case 'flame':
          ctx.globalAlpha = t; pen.begin().ell(p.x, p.y, p.r * t + 1, (p.r * t + 1) * 1.3).ink(t > 0.5 ? P.flame2 : P.flame3, 1.5); ctx.globalAlpha = 1; break;
        case 'star': {
          const k = 1 - t; const r = p.r * (0.5 + easeOutBack(Math.min(1, k * 2.2)) * 0.7);
          const pts: number[][] = []; const n = 9;
          for (let i = 0; i < n * 2; i++) { const a = p.rot + (i / (n * 2)) * Math.PI * 2; const rr = i % 2 === 0 ? r : r * 0.55; pts.push([p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr]); }
          pen.begin().poly(pts).ink(p.color, 3);
          break;
        }
        case 'ring': {
          const k = 1 - t; ctx.globalAlpha = t; ctx.strokeStyle = p.color; ctx.lineWidth = 6 * t + 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + k * 90, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; break;
        }
        case 'gring': {
          const k = 1 - t; ctx.globalAlpha = t * 0.9; ctx.strokeStyle = P.parchment; ctx.lineWidth = 5 * t + 1;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * (0.4 + k * 1.4), p.r * (0.1 + k * 0.25), 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; break;
        }
        case 'flash':
          ctx.globalAlpha = t; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; break;
        case 'feather': case 'confetti':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, t * 2);
          ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
          ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.strokeRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
          ctx.restore(); ctx.globalAlpha = 1; break;
        case 'drop':
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); break;
      }
    }
  }
  drawText(ctx: CanvasRenderingContext2D) {
    for (const b of this.bursts) {
      const k = 1 - b.life / b.max;
      const sc = k < 0.2 ? easeOutBack(k / 0.2) : 1 + (k - 0.2) * 0.15;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.scale(sc, sc);
      ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      // comic burst plate
      const w = b.text.length * b.size * 0.42 + 26;
      const pts: number[][] = []; const n = 14;
      for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2; const rr = i % 2 === 0 ? 1 : 0.78; pts.push([Math.cos(a) * w * 0.62 * rr, Math.sin(a) * b.size * 0.95 * rr]); }
      pen.use(ctx, 0.8).begin().poly(pts).ink(P.red, 3);
      inkText(ctx, b.text, 0, 2, b.size, b.color, { font: FONT_TITLE });
      ctx.restore(); ctx.globalAlpha = 1;
    }
    for (const p of this.popups) {
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, t * 3);
      inkText(ctx, p.text, p.x, p.y, p.size, p.color, { outline: 4 });
      ctx.globalAlpha = 1;
    }
  }
}
