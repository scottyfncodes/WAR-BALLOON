import { P } from '../render/palette';
import { pen, inkText, bodyText } from '../render/ink';
import { drawBalloon, type BalloonLook } from '../render/balloonArt';
import { drawAirship, airshipLook, type AirshipLook, type CrewDraw } from '../render/airshipArt';
import { Save } from '../core/save';
import { RES_KEYS, drawResIcon, type Cost, type ResKey } from '../game/resources';
import { computeStats } from '../game/upgrades';
import { panel } from './ui';

export { RES_LABEL } from '../game/resources';

export function look(over: Partial<BalloonLook> = {}): BalloonLook {
  const s = Save.data;
  return {
    t: 0, facing: 1, tilt: 0, squash: 0, wobble: 0, burner: 0, levels: {}, paint: s.decor.paint, damage: 0, expr: 'neutral', arm: 'rest',
    lookX: 1, lookY: 0, blink: false, scarf: scarfAt(0), bombs: 0, bombCap: 0, propSpin: 0, boosting: false, shield: false, flash: false, goggleDown: false, ...over,
  };
}
export function scarfAt(t: number): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i < 7; i++) pts.push([2 - i * 8, -27 + i * 2 + Math.sin(t * 6 - i * 0.8) * i * 0.9]);
  return pts;
}
/** Classic tiny balloon (intro). */
export function drawMenuBalloon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, over: Partial<BalloonLook> = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  drawBalloon(ctx, look({ t, scarf: scarfAt(t), blink: (t % 3.3) < 0.12, propSpin: t * 10, ...over }));
  ctx.restore();
}
/** The player's actual airship, exactly as upgraded, with the selected crew aboard. */
export function drawMenuAirship(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, over: Partial<AirshipLook> = {}, levels = Save.data.levels) {
  const sv = Save.data;
  const st = computeStats(levels);
  const crew: CrewDraw[] = Save.aboardCrew().slice(0, st.seats).map((c) => ({ look: c.look, role: c.role, pose: 'idle', hp: 1, aim: 0, flash: 0 }));
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  drawAirship(ctx, airshipLook({ t, levels, decor: sv.decor, trophies: sv.trophies, crew, scarf: scarfAt(t), blink: (t % 3.3) < 0.12, propSpin: t * 10, bombs: st.bombCap, bombCap: st.bombCap, ...over }));
  ctx.restore();
}

/** Top resource bar shown in menus. */
export function resourceBar(ctx: CanvasRenderingContext2D, x: number, y: number, flash: Partial<Record<ResKey, number>> = {}, maxW = 9999) {
  const s = Save.data;
  const step = Math.min(70, (maxW - 16) / RES_KEYS.length);
  const w = RES_KEYS.length * step + 12;
  panel(ctx, x, y, w, 38, { color: '#3b2a20', border: 2.5 });
  RES_KEYS.forEach((k, i) => {
    const cx = x + 20 + i * step;
    ctx.save(); ctx.translate(cx, y + 20); ctx.scale(0.8, 0.8); drawResIcon(ctx, k, 11, 0); ctx.restore();
    const f = flash[k] ?? 0;
    inkText(ctx, String(s.res[k]), cx + 15, y + 21, 17 + f * 6, f > 0 ? P.goldLight : P.parchment, { align: 'left', outline: 3, shadow: false });
  });
  return w;
}

export function costRow(ctx: CanvasRenderingContext2D, cost: Cost, x: number, y: number, size = 15) {
  const s = Save.data; let cx = x;
  for (const k of RES_KEYS) {
    const n = cost[k]; if (!n) continue;
    const ok = s.res[k] >= n;
    ctx.save(); ctx.translate(cx + 9, y); ctx.scale(0.66, 0.66); drawResIcon(ctx, k, 11, 0); ctx.restore();
    inkText(ctx, String(n), cx + 20, y + 1, size, ok ? P.parchment : P.redBright, { align: 'left', outline: 3, shadow: false });
    ctx.font = `${size}px "Luckiest Guy"`;
    cx += 28 + ctx.measureText(String(n)).width;
  }
  if (cx === x) bodyText(ctx, 'free', x, y, size, P.parchment);
  return cx - x;
}
export const canAfford = (cost: Cost) => RES_KEYS.every((k) => (Save.data.res[k] ?? 0) >= (cost[k] ?? 0));
export function pay(cost: Cost) { for (const k of RES_KEYS) Save.data.res[k] -= cost[k] ?? 0; }

/** Intertitle card (silent-film style). */
export function intertitle(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, lines: string[], size = 28) {
  pen.use(ctx, 0.4);
  pen.begin().rect(cx - w / 2, cy - h / 2, w, h).ink('#1d130e', 4, P.parchment);
  pen.begin().rect(cx - w / 2 + 10, cy - h / 2 + 10, w - 20, h - 20).stroke(2, P.parchmentDark);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x0 = cx + sx * (w / 2 - 22), y0 = cy + sy * (h / 2 - 22);
    pen.begin().m(x0, y0 - sy * 10).q(x0, y0, x0 - sx * 10, y0).stroke(2, P.parchmentDark);
    ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(x0, y0, 2.5, 0, 7); ctx.fill();
  }
  lines.forEach((ln, i) => bodyText(ctx, ln, cx, cy + (i - (lines.length - 1) / 2) * size * 1.25, size, P.parchment, 'center'));
}

/** Little crew badge: role-coloured circle with a portrait head. */
export function roleBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, label: string) {
  pen.use(ctx, 0.3).begin().ell(x, y, r, r).ink(color, 2);
  inkText(ctx, label, x, y + 1, r * 0.9, P.parchment, { outline: 2, shadow: false });
}
