import { Engine, onAfterRender, type Scene } from '../core/engine';
import { irisOut } from './ui';
import { UI } from './ui';

let pending: { s: Scene; data?: any } | null = null;
let t = 0; let closing = false; let opening = 0;
export function go(s: Scene, data?: any, instant = false) {
  if (instant) { UI.reset(); Engine.setScene(s, data); return; }
  if (closing) return;
  pending = { s, data }; closing = true; t = 0;
}
export function transitioning() { return closing; }
onAfterRender.push((ctx) => {
  const dt = 1 / 60;
  const s = Engine.scale * Engine.dpr;
  if (closing) {
    t += dt;
    ctx.setTransform(s, 0, 0, s, Engine.offX * Engine.dpr, Engine.offY * Engine.dpr);
    irisOut(ctx, t / 0.35, Engine.W, Engine.H);
    if (t >= 0.38 && pending) { UI.reset(); Engine.setScene(pending.s, pending.data); pending = null; closing = false; opening = 0.0001; }
  } else if (opening > 0) {
    opening += dt;
    ctx.setTransform(s, 0, 0, s, Engine.offX * Engine.dpr, Engine.offY * Engine.dpr);
    irisOut(ctx, 1 - opening / 0.4, Engine.W, Engine.H);
    if (opening > 0.4) opening = 0;
  }
});
