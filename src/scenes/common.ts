import { P } from '../render/palette';
import { pen, inkText, bodyText } from '../render/ink';
import { drawBalloon, type BalloonLook } from '../render/balloonArt';
import { drawItemIcon } from '../game/entities';
import { Save } from '../core/save';
import { RES_KEYS, type Cost, type ResKey } from '../game/upgrades';
import { panel } from './ui';

export function look(over: Partial<BalloonLook> = {}): BalloonLook {
  const s = Save.data;
  return {
    t: 0, facing: 1, tilt: 0, squash: 0, wobble: 0, burner: 0, levels: s.levels, paint: s.paint, damage: 0, expr: 'neutral', arm: 'rest',
    lookX: 1, lookY: 0, blink: false, scarf: [[2, -27], [-6, -25], [-14, -22], [-22, -20], [-30, -18], [-38, -15], [-45, -13]],
    bombs: 3, bombCap: 3 + 2 * (s.levels.rack ?? 0), propSpin: 0, boosting: false, shield: false, flash: false, goggleDown: false, ...over,
  };
}
/** Flutter the scarf procedurally for menu balloons. */
export function scarfAt(t: number, facing = 1): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i < 7; i++) pts.push([2 - i * 8, -27 + i * 2 + Math.sin(t * 6 - i * 0.8) * i * 0.9]);
  void facing; return pts;
}
export function drawMenuBalloon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, over: Partial<BalloonLook> = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  drawBalloon(ctx, look({ t, scarf: scarfAt(t), blink: (t % 3.3) < 0.12, propSpin: t * 10, ...over }));
  ctx.restore();
}

export const RES_LABEL: Record<ResKey, string> = { scrap: 'Scrap', fabric: 'Fabric', fuel: 'Fuel', food: 'Food', water: 'Water', electronics: 'Electronics' };

/** Top resource bar shown in menus. */
export function resourceBar(ctx: CanvasRenderingContext2D, x: number, y: number, flash: Partial<Record<ResKey, number>> = {}) {
  const s = Save.data;
  const w = RES_KEYS.length * 74 + 16;
  panel(ctx, x, y, w, 40, { color: '#3b2a20', border: 2.5 });
  RES_KEYS.forEach((k, i) => {
    const cx = x + 22 + i * 74;
    ctx.save(); ctx.translate(cx, y + 21); ctx.scale(0.85, 0.85); drawItemIcon(ctx, k, 11, 0); ctx.restore();
    const f = flash[k] ?? 0;
    inkText(ctx, String(s.res[k]), cx + 18, y + 22, 18 + f * 6, f > 0 ? P.goldLight : P.parchment, { align: 'left', outline: 3, shadow: false });
  });
  return w;
}

export function costRow(ctx: CanvasRenderingContext2D, cost: Cost, x: number, y: number, size = 15) {
  const s = Save.data; let cx = x;
  for (const k of RES_KEYS) {
    const n = cost[k]; if (!n) continue;
    const ok = s.res[k] >= n;
    ctx.save(); ctx.translate(cx + 9, y); ctx.scale(0.7, 0.7); drawItemIcon(ctx, k, 11, 0); ctx.restore();
    inkText(ctx, String(n), cx + 21, y + 1, size, ok ? P.parchment : P.redBright, { align: 'left', outline: 3, shadow: false });
    ctx.font = `${size}px "Luckiest Guy"`;
    cx += 30 + ctx.measureText(String(n)).width;
  }
  return cx - x;
}
export const canAfford = (cost: Cost) => RES_KEYS.every((k) => (Save.data.res[k] ?? 0) >= (cost[k] ?? 0));
export function pay(cost: Cost) { for (const k of RES_KEYS) Save.data.res[k] -= cost[k] ?? 0; }

/** Intertitle card (silent-film style). */
export function intertitle(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, lines: string[], size = 28) {
  pen.use(ctx, 0.4);
  pen.begin().rect(cx - w / 2, cy - h / 2, w, h).ink('#1d130e', 4, P.parchment);
  pen.begin().rect(cx - w / 2 + 10, cy - h / 2 + 10, w - 20, h - 20).stroke(2, P.parchmentDark);
  // corner flourishes
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x0 = cx + sx * (w / 2 - 22), y0 = cy + sy * (h / 2 - 22);
    pen.begin().m(x0, y0 - sy * 10).q(x0, y0, x0 - sx * 10, y0).stroke(2, P.parchmentDark);
    ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(x0, y0, 2.5, 0, 7); ctx.fill();
  }
  lines.forEach((ln, i) => bodyText(ctx, ln, cx, cy + (i - (lines.length - 1) / 2) * size * 1.25, size, P.parchment, 'center'));
}
