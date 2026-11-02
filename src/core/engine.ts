import { Boil } from '../render/ink';

export interface Scene {
  enter?(data?: any): void;
  exit?(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  /** Called on pointer-up "click" in logical coords — scenes use ui helpers mostly. */
  onKey?(code: string): void;
  onBlur?(): void;
}

export const VIEW_H = 540;

class EngineImpl {
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  W = 960; H = VIEW_H;
  scale = 1; // css px per logical unit
  dpr = 1;
  quality = 2; // max dpr allowed
  offX = 0; offY = 0; // letterbox offset in css px
  safe = { l: 0, r: 0, t: 0, b: 0 }; // logical units
  scene: Scene | null = null;
  time = 0;
  portrait = false;
  private acc = 0;
  private last = 0;
  private fpsT = 0; private fpsN = 0; fps = 60;
  private lowFpsStreak = 0;
  /** simplified drawing when even the lowest resolution can't hold the frame rate */
  lite = false; private liteStreak = 0;
  isTouch = false;
  paused = false; // hard pause (tab hidden)

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.quality = Math.min(window.devicePixelRatio || 1, 2);
    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
    this.resize();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.scene?.onBlur?.(); }
      this.last = performance.now();
    });
    window.addEventListener('blur', () => this.scene?.onBlur?.());
    requestAnimationFrame((t) => { this.last = t; this.frame(t); });
  }

  resize() {
    const cw = window.innerWidth, ch = window.innerHeight;
    this.portrait = ch > cw * 1.05;
    const aspect = cw / ch;
    let W = VIEW_H * aspect;
    W = Math.max(760, Math.min(1320, W));
    this.W = Math.round(W);
    this.H = VIEW_H;
    this.scale = Math.min(cw / this.W, ch / this.H);
    this.offX = (cw - this.W * this.scale) / 2;
    this.offY = (ch - this.H * this.scale) / 2;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.quality);
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    const s = document.getElementById('safe');
    if (s) {
      const r = s.getBoundingClientRect();
      const toL = (px: number) => Math.max(0, px - 0) / this.scale;
      this.safe = { l: toL(r.left - this.offX), t: toL(r.top - this.offY), r: toL(cw - r.right - this.offX), b: toL(ch - r.bottom - this.offY) };
    }
  }

  /** css px -> logical */
  toLogical(px: number, py: number) { return { x: (px - this.offX) / this.scale, y: (py - this.offY) / this.scale }; }

  setScene(s: Scene, data?: any) {
    this.scene?.exit?.();
    this.scene = s;
    s.enter?.(data);
  }

  private frame(t: number) {
    requestAnimationFrame((tt) => this.frame(tt));
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    // perf monitor
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT > 2) {
      this.fps = this.fpsN / this.fpsT; this.fpsT = 0; this.fpsN = 0;
      if (this.fps < 48 && this.quality > 1.25) { if (++this.lowFpsStreak >= 2) { this.quality = Math.max(1.25, this.quality - 0.5); this.resize(); this.lowFpsStreak = 0; } }
      else this.lowFpsStreak = 0;
      if (this.fps < 45 && this.quality <= 1.25) { if (++this.liteStreak >= 2) this.lite = true; } else this.liteStreak = 0;
    }
    const STEP = 1 / 60;
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < 5) {
      this.time += STEP;
      Boil.update(STEP);
      onBeforeUpdate.forEach((f) => f());
      this.scene?.update(STEP);
      onAfterUpdate.forEach((f) => f());
      this.acc -= STEP; n++;
    }
    if (n === 5) this.acc = 0;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1c120d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, this.offX * this.dpr, this.offY * this.dpr);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, this.W, this.H); ctx.clip();
    this.scene?.render(ctx);
    ctx.restore();
    onAfterRender.forEach((f) => f(ctx));
  }
}

export const onBeforeUpdate: Array<() => void> = [];
export const onAfterUpdate: Array<() => void> = [];
export const onAfterRender: Array<(ctx: CanvasRenderingContext2D) => void> = [];
export const Engine = new EngineImpl();
