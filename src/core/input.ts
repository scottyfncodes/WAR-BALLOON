import { Engine, onAfterUpdate, onBeforeUpdate } from './engine';

export interface Ptr { id: number; x: number; y: number; sx: number; sy: number; t: number; claimed: string | null; down: boolean; }

class InputImpl {
  keys = new Set<string>();
  pressed = new Set<string>();
  ptrs = new Map<number, Ptr>();
  downs: Ptr[] = []; // pointer downs this frame
  ups: Ptr[] = []; // pointer ups this frame
  private pendingDowns: Ptr[] = [];
  private pendingUps: Ptr[] = [];
  private pendingPressed: string[] = [];
  lastPointer = { x: -999, y: -999 };
  onFirstGesture: Array<() => void> = [];
  private gestured = false;
  usingTouch = false;

  init(canvas: HTMLCanvasElement) {
    const gesture = () => { if (!this.gestured) { this.gestured = true; this.onFirstGesture.forEach((f) => f()); } else this.onFirstGesture.forEach((f) => f()); };
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pendingPressed.push(e.code);
      this.keys.add(e.code);
      this.usingTouch = false;
      gesture();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.ptrs.clear(); });
    const pos = (e: PointerEvent) => Engine.toLogical(e.clientX, e.clientY);
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
      const p = pos(e);
      const ptr: Ptr = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, t: Engine.time, claimed: null, down: true };
      this.ptrs.set(e.pointerId, ptr);
      this.pendingDowns.push(ptr);
      this.lastPointer = p;
      if (e.pointerType === 'touch') this.usingTouch = true; else if (e.pointerType === 'mouse') this.usingTouch = false;
      gesture();
    }, { passive: false });
    canvas.addEventListener('pointermove', (e) => {
      const p = pos(e);
      this.lastPointer = p;
      const ptr = this.ptrs.get(e.pointerId);
      if (ptr) { ptr.x = p.x; ptr.y = p.y; }
    });
    const up = (e: PointerEvent) => {
      const ptr = this.ptrs.get(e.pointerId);
      if (ptr) { const p = pos(e); ptr.x = p.x; ptr.y = p.y; ptr.down = false; this.pendingUps.push(ptr); this.ptrs.delete(e.pointerId); }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', (e) => { const ptr = this.ptrs.get(e.pointerId); if (ptr) { ptr.down = false; ptr.claimed = 'cancelled'; this.pendingUps.push(ptr); this.ptrs.delete(e.pointerId); } });
    // stop iOS gestures
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    // per-step bookkeeping: expose events for exactly one update step
    onAfterUpdate.push(() => { this.downs = []; this.ups = []; this.pressed.clear(); });
    const flush = () => {
      if (this.pendingDowns.length) { this.downs.push(...this.pendingDowns); this.pendingDowns = []; }
      if (this.pendingUps.length) { this.ups.push(...this.pendingUps); this.pendingUps = []; }
      if (this.pendingPressed.length) { this.pendingPressed.forEach((k) => this.pressed.add(k)); this.pendingPressed = []; }
    };
    // flush before each update step via microtask on frame: hook into update order
    onBeforeUpdate.push(flush);
  }
  down(...codes: string[]) { return codes.some((c) => this.keys.has(c)); }
  hit(...codes: string[]) { return codes.some((c) => this.pressed.has(c)); }
}

export const Input = new InputImpl();
