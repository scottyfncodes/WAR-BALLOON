import { P } from './palette';
import { pen, cel } from './ink';
import { clamp, lerp } from '../core/math';

export type Expr = 'neutral' | 'happy' | 'panic' | 'hurt' | 'determined' | 'tired' | 'zapped' | 'cheer';
export type ArmPose = 'rest' | 'burn' | 'throw' | 'crank' | 'cheer' | 'wave';

export interface PaintScheme { id: string; name: string; a: string; b: string; aShade: string; bShade: string; pattern: 'stripes' | 'checks' | 'diamonds' | 'crown'; trim: string; }
export const PAINTS: PaintScheme[] = [
  { id: 'classic', name: 'Old Faithful', a: P.orange, b: P.parchment, aShade: P.orangeDark, bShade: P.parchmentShade, pattern: 'stripes', trim: P.red },
  { id: 'teal', name: 'Teal Diamond', a: P.teal, b: P.parchment, aShade: P.tealDark, bShade: P.parchmentShade, pattern: 'diamonds', trim: P.gold },
  { id: 'sunset', name: 'Sunset Checks', a: P.gold, b: P.red, aShade: P.goldDark, bShade: P.redDark, pattern: 'checks', trim: P.orangeDark },
  { id: 'storm', name: 'Storm Crown', a: P.purple, b: P.gold, aShade: P.purpleDark, bShade: P.goldDark, pattern: 'crown', trim: P.teal },
];
export const paintById = (id: string) => PAINTS.find((p) => p.id === id) ?? PAINTS[0];

export interface BalloonLook {
  t: number;
  facing: number; // 1 right, -1 left
  tilt: number; // radians
  squash: number; // + wide, - tall
  wobble: number; // 0..1 hit wobble
  burner: number; // 0..1 flame strength
  levels: Record<string, number>;
  paint: string;
  damage: number; // number of missing hp (tears)
  expr: Expr;
  arm: ArmPose;
  lookX: number; lookY: number; // pupil direction -1..1
  blink: boolean;
  scarf: number[][]; // local pts from neck
  bombs: number; bombCap: number;
  propSpin: number; // angle
  boosting: boolean;
  shield: boolean;
  flash: boolean; // invuln flash
  goggleDown: boolean;
  cargoNetFull?: boolean;
  zap?: number;
  inflate?: number; // 0 = flat on the ground, 1 = full
  dizzy?: boolean;
}

export const ENVELOPE_TOP = -228, MOUTH_Y = -92;

function envHalfWidth(hn: number, rx: number, mouth: number) {
  if (hn < 0.58) { const e = (hn - 0.58) / 0.58; return rx * Math.sqrt(Math.max(0, 1 - e * e)); }
  const k = (hn - 0.58) / 0.42;
  return mouth + (rx - mouth) * Math.pow(Math.cos((k * Math.PI) / 2), 1.25);
}

/** Draw Jerry's balloon in local coords: origin at basket rim center. */
export function drawBalloon(ctx: CanvasRenderingContext2D, b: BalloonLook, amp = 0.7) {
  // (b may be shallow-copied below for deflated wobble)
  const L = (id: string) => b.levels[id] ?? 0;
  const s = 1 + 0.08 * L('lift');
  const paint = paintById(b.paint);
  const f = b.facing;
  pen.use(ctx, amp);
  ctx.save();
  ctx.rotate(b.tilt);
  if (b.flash) ctx.globalAlpha = 0.45;

  const inf = b.inflate ?? 1;
  const top = MOUTH_Y - (MOUTH_Y - ENVELOPE_TOP) * s * (0.32 + 0.68 * inf), bot = MOUTH_Y;
  const rx = 64 * s * (1 + b.squash * 0.6) * (0.55 + 0.45 * inf), mouth = 15;
  if (inf < 1) b = { ...b, wobble: Math.max(b.wobble, (1 - inf) * 0.9) };
  const H = bot - top;
  const N = 22;
  const sq = 1 - b.squash * 0.4;
  const yAt = (hn: number) => bot - (1 - hn) * H * sq;
  const hwAt = (hn: number, i = 0) => envHalfWidth(hn, rx, mouth) * (1 + b.wobble * 0.07 * Math.sin(hn * 9 + b.t * 16 + i));

  // --- tail fin (behind) ---
  if (L('fins')) {
    const fx = -f * (rx * 0.8);
    const fy = yAt(0.5);
    pen.begin().m(fx, fy - 22).q(fx - f * 30, fy - 30, fx - f * 40, fy - 4).q(fx - f * 26, fy + 4, fx - f * 4, fy + 14).close().ink(paint.trim, 3);
    pen.begin().m(fx - f * 4, fy - 6).l(fx - f * 34, fy - 4).stroke(1.5, P.inkSoft);
  }

  // --- envelope outline points ---
  const outline: number[][] = [];
  for (let i = 0; i <= N; i++) { const hn = i / N; outline.push([hwAt(hn), yAt(hn)]); }
  for (let i = N; i >= 0; i--) { const hn = i / N; outline.push([-hwAt(hn, 2), yAt(hn)]); }
  const envPath = () => { pen.begin().poly(outline.map((p) => [p[0], p[1]]), true); };

  // gores
  cel(ctx, envPath, () => {
    const G = 8;
    for (let g = 0; g < G; g++) {
      const k1 = Math.sin(-Math.PI / 2 + (g / G) * Math.PI), k2 = Math.sin(-Math.PI / 2 + ((g + 1) / G) * Math.PI);
      const segs = 10;
      for (let r = 0; r < segs; r++) {
        const h1 = r / segs, h2 = (r + 1) / segs;
        let colA: string;
        const even = g % 2 === 0;
        if (paint.pattern === 'stripes') colA = even ? paint.a : paint.b;
        else if (paint.pattern === 'checks') colA = (g + r) % 2 === 0 ? paint.a : paint.b;
        else if (paint.pattern === 'diamonds') colA = (g + r) % 2 === 0 ? paint.b : (r > 2 && r < 8 && (g + r) % 4 === 1 ? paint.a : paint.b);
        else colA = r < 3 ? paint.b : even ? paint.a : P.purpleLight;
        if (paint.pattern === 'diamonds' && (g + r) % 2 === 1) colA = paint.a;
        ctx.beginPath();
        ctx.moveTo(hwAt(h1) * k1, yAt(h1)); ctx.lineTo(hwAt(h1) * k2, yAt(h1));
        ctx.lineTo(hwAt(h2) * k2, yAt(h2)); ctx.lineTo(hwAt(h2) * k1, yAt(h2)); ctx.closePath();
        ctx.fillStyle = colA; ctx.fill();
      }
    }
    // trim band near mouth
    ctx.fillStyle = paint.trim;
    ctx.fillRect(-rx * 1.2, yAt(0.86), rx * 2.4, (yAt(0.93) - yAt(0.86)));
    // cel shade crescent (light from upper-left)
    ctx.beginPath();
    ctx.rect(-300, -400, 600, 500);
    ctx.ellipse(-rx * 0.2, yAt(0.5) - 10, rx * 0.95, H * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(60,20,30,0.28)';
    ctx.fill('evenodd');
    // hatch lines in shade
    ctx.strokeStyle = 'rgba(42,26,20,0.25)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { const yy = yAt(0.35 + i * 0.08); ctx.beginPath(); ctx.moveTo(rx * 0.72, yy); ctx.lineTo(rx * 0.95, yy - 8); ctx.stroke(); }
    // highlight
    ctx.fillStyle = 'rgba(255,250,235,0.38)';
    ctx.beginPath(); ctx.ellipse(-rx * 0.42, yAt(0.25), rx * 0.2, H * 0.14, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,235,0.7)';
    ctx.beginPath(); ctx.ellipse(-rx * 0.5, yAt(0.16), rx * 0.06, H * 0.04, -0.5, 0, Math.PI * 2); ctx.fill();
    // meridian seams
    ctx.strokeStyle = 'rgba(42,26,20,0.55)'; ctx.lineWidth = 1.4;
    for (let g = 1; g < 8; g++) {
      const k = Math.sin(-Math.PI / 2 + (g / 8) * Math.PI);
      ctx.beginPath();
      for (let r = 0; r <= 12; r++) { const hn = r / 12; const x = hwAt(hn) * k, y = yAt(hn); if (r === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // reinforced envelope: leather straps / netting
    if (L('envelope') >= 1) {
      ctx.strokeStyle = P.brownDark; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-rx * 1.1, yAt(0.58)); ctx.quadraticCurveTo(0, yAt(0.58) + 16, rx * 1.1, yAt(0.58)); ctx.stroke();
      ctx.strokeStyle = P.brown; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = P.brassLight;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * rx * 0.3, yAt(0.58) + 14 * (1 - (i / 3.3) ** 2) + 1, 2, 0, 7); ctx.fill(); }
    }
    if (L('envelope') >= 2) {
      ctx.strokeStyle = 'rgba(94,59,26,0.85)'; ctx.lineWidth = 1.3;
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath(); ctx.moveTo(i * 22 - 80, top); ctx.lineTo(i * 22 + 80, bot); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i * 22 + 80, top); ctx.lineTo(i * 22 - 80, bot); ctx.stroke();
      }
    }
    // damage: tears & patches
    for (let d = 0; d < b.damage; d++) {
      const px = [-rx * 0.4, rx * 0.35, -rx * 0.1, rx * 0.5][d % 4], py = yAt([0.4, 0.28, 0.66, 0.52][d % 4]);
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.moveTo(px - 8, py - 3); ctx.lineTo(px - 2, py - 7); ctx.lineTo(px + 1, py - 2); ctx.lineTo(px + 8, py - 5); ctx.lineTo(px + 5, py + 4); ctx.lineTo(px - 3, py + 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = P.parchment; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px - 10, py - 1); ctx.lineTo(px - 6, py + 3); ctx.moveTo(px + 6, py - 8); ctx.lineTo(px + 10, py - 3); ctx.stroke();
    }
    // stitched patch (character)
    ctx.save(); ctx.translate(rx * 0.3, yAt(0.72)); ctx.rotate(0.2);
    ctx.fillStyle = P.olive; ctx.fillRect(-9, -7, 18, 14);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.strokeRect(-9, -7, 18, 14);
    ctx.strokeStyle = P.parchment; ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i += 4) { ctx.beginPath(); ctx.moveTo(i, -9); ctx.lineTo(i + 1, -5); ctx.moveTo(i, 5); ctx.lineTo(i + 1, 9); ctx.stroke(); }
    ctx.restore();
  });
  envPath(); pen.stroke(3.4);
  // crown cap
  pen.begin().ell(0, top + 4, 14, 5).ink(paint.trim, 2.5);
  if (L('buoy')) {
    pen.begin().ell(0, top - 6, 11, 9).ink(P.gold, 2.5);
    pen.begin().m(-5, top - 9).q(0, top - 14, 5, top - 9).stroke(1.5, P.white);
    pen.begin().m(-11, top - 6).l(11, top - 6).stroke(1.5, P.brownDark);
  }

  // --- rigging ---
  const rimW = 26;
  const mouthY = yAt(1);
  ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6;
  const rig = [[-mouth, mouthY, -rimW + 3, 0], [mouth, mouthY, rimW - 3, 0], [-rx * 0.62, yAt(0.82), -rimW, 0], [rx * 0.62, yAt(0.82), rimW, 0]];
  for (const [x1, y1, x2, y2] of rig) { pen.begin().m(x1, y1).q((x1 + x2) / 2 + (x1 < 0 ? 2 : -2), (y1 + y2) / 2, x2, y2).stroke(1.6, P.ink); }

  // --- burner & flame ---
  const burners = 1 + Math.max(0, L('burner') - 1);
  const by = mouthY + 14;
  const flick = Math.sin(b.t * 40) * 0.5 + Math.sin(b.t * 23) * 0.5;
  for (let i = 0; i < burners; i++) {
    const bx = (i - (burners - 1) / 2) * 12;
    if (b.burner > 0.02) {
      const fl = b.burner * (b.boosting ? 1.35 : 1);
      const fh = (22 + fl * 30 + flick * 4) * (L('burner') >= 3 ? 1.2 : 1);
      const fw = 7 + fl * 4;
      pen.begin().m(bx - fw, by - 2).q(bx - fw * 1.2, by - fh * 0.5, bx + flick * 2, by - fh).q(bx + fw * 1.2, by - fh * 0.5, bx + fw, by - 2).close().ink(P.flame3, 2.2);
      pen.begin().m(bx - fw * 0.6, by - 3).q(bx - fw * 0.7, by - fh * 0.45, bx - flick * 1.5, by - fh * 0.75).q(bx + fw * 0.7, by - fh * 0.4, bx + fw * 0.6, by - 3).close().fill(P.flame2);
      pen.begin().m(bx - fw * 0.3, by - 4).q(bx, by - fh * 0.5, bx, by - fh * 0.42).q(bx + fw * 0.3, by - fh * 0.25, bx + fw * 0.3, by - 4).close().fill(P.flame1);
    } else {
      pen.begin().ell(bx, by - 5, 2.5, 4 + flick).fill(P.flame2);
    }
    pen.begin().rrect(bx - 6, by - 2, 12, 9, 2).ink(P.steel, 2);
    pen.begin().m(bx - 4, by + 2).l(bx + 4, by + 2).stroke(1.2, P.steelDark);
  }
  // burner frame
  pen.begin().m(-rimW + 3, 0).l(-10 - (burners - 1) * 6, by + 7).l(10 + (burners - 1) * 6, by + 7).l(rimW - 3, 0).stroke(2.5, P.steelDark);

  // --- propeller (behind basket, back side) ---
  if (L('prop')) {
    const px = -f * (rimW + 10), py = 14;
    pen.begin().m(-f * rimW, py).l(px, py).stroke(4, P.steelDark);
    const big = L('prop') >= 2;
    if (big) pen.begin().rrect(px - 8, py - 7, 16, 14, 3).ink(P.olive, 2.2);
    const bl = big ? 24 : 18;
    for (let k = 0; k < (big ? 4 : 2); k++) {
      const a = b.propSpin + k * (Math.PI * 2) / (big ? 4 : 2);
      const ext = Math.sin(a) * bl;
      pen.begin().ell(px - f * 2, py + ext / 2, 4, Math.abs(ext) / 2 + 1).ink(P.brownLight, 1.8);
    }
    pen.begin().ell(px - f * 3, py, 3.5, 3.5).ink(P.brass, 1.8);
    if (big) { ctx.strokeStyle = 'rgba(255,250,235,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px - f * 2, py, bl, 0, Math.PI * 2); ctx.stroke(); }
  }

  // --- Jerry (behind basket front) ---
  drawJerry(ctx, b, f);

  // --- basket ---
  const bw = 52, bh = 34;
  const basketPath = () => pen.begin().m(-bw / 2 - 2, 0).l(bw / 2 + 2, 0).l(bw / 2 - 4, bh).q(0, bh + 3, -bw / 2 + 4, bh).close();
  cel(ctx, basketPath, () => {
    ctx.fillStyle = P.brownLight; ctx.fillRect(-40, -2, 80, 40);
    // weave
    ctx.strokeStyle = P.brown; ctx.lineWidth = 2.4;
    for (let r = 0; r < 4; r++) {
      const yy = 6 + r * 8;
      ctx.beginPath();
      for (let xx = -30; xx <= 30; xx += 6) { const o = ((xx / 6 + r) % 2 === 0) ? -1.5 : 1.5; if (xx === -30) ctx.moveTo(xx, yy + o); else ctx.lineTo(xx, yy + o); }
      ctx.stroke();
    }
    ctx.strokeStyle = P.brownDark; ctx.lineWidth = 1.5;
    for (let xx = -24; xx <= 24; xx += 8) { ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx * 0.9, bh); ctx.stroke(); }
    ctx.fillStyle = 'rgba(60,25,10,0.3)'; ctx.fillRect(bw * 0.18, 0, 30, 40);
    if (L('plating') >= 1) {
      const plates = L('plating') >= 2 ? [[-26, 4, 24, 26], [0, 4, 26, 26]] : [[-12, 8, 24, 20]];
      for (const [x, y, w, h] of plates) {
        ctx.fillStyle = P.steel; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 2, y + 2, w - 4, 4);
        ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = P.steelDark; for (const [rx2, ry2] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]]) { ctx.beginPath(); ctx.arc(rx2, ry2, 1.6, 0, 7); ctx.fill(); }
      }
    }
  });
  basketPath(); pen.stroke(3);
  // rim roll
  pen.begin().rrect(-bw / 2 - 5, -5, bw + 10, 9, 4).ink(P.brown, 2.6);
  pen.begin().m(-bw / 2, -2).l(bw / 2, -2).stroke(1.2, P.brownLight);

  // --- fuel tank (front side) ---
  if (L('tank')) {
    const tx = f * (bw / 2 + 4);
    if (L('tank') >= 2) { pen.begin().rrect(tx - 6, 2, 12, 26, 5).ink(P.red, 2.2); pen.begin().m(tx - 6, 10).l(tx + 6, 10).m(tx - 6, 20).l(tx + 6, 20).stroke(1.5, P.redDark); }
    else { pen.begin().rrect(tx - 5, 6, 10, 18, 2).ink(P.olive, 2.2); pen.begin().m(tx - 3, 9).l(tx + 3, 21).m(tx + 3, 9).l(tx - 3, 21).stroke(1.2, P.oliveDark); }
  }
  // fire bucket (back side)
  if (L('bucket')) {
    const ux = -f * (bw / 2 + 2);
    pen.begin().m(ux - 7, 4).l(ux + 7, 4).l(ux + 5, 18).l(ux - 5, 18).close().ink(P.red, 2);
    pen.begin().m(ux - 7, 4).q(ux, -6, ux + 7, 4).stroke(1.5, P.ink);
  }
  // patch kit spool on rim
  if (L('patchkit')) { pen.begin().rrect(-bw / 2 + 2, -11, 8, 7, 1).ink(P.teal, 1.6); pen.begin().m(-bw / 2 + 6, -11).q(-bw / 2 + 12, -16, -bw / 2 + 14, -8).stroke(1, P.red); }

  // --- bomb rack under basket (visible ammo) ---
  const shown = Math.min(7, b.bombCap);
  for (let i = 0; i < shown; i++) {
    const bx2 = -((shown - 1) * 7) / 2 + i * 7, by2 = bh + 6;
    if (i < b.bombs) {
      pen.begin().ell(bx2, by2, 3.6, 3.6).ink(P.ink, 0);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(bx2 - 1.2, by2 - 1.2, 1.1, 0, 7); ctx.fill();
    } else {
      pen.begin().ell(bx2, by2, 3, 3).stroke(1, 'rgba(42,26,20,0.4)');
    }
  }
  pen.begin().m(-((shown - 1) * 7) / 2 - 5, bh + 1.5).l(((shown - 1) * 7) / 2 + 5, bh + 1.5).stroke(2, P.steelDark);
  // cargo net
  if (L('net')) {
    ctx.strokeStyle = P.inkSoft; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-bw / 2 + 2, bh - 2); ctx.quadraticCurveTo(0, bh + 22 + L('net') * 4, bw / 2 - 2, bh - 2); ctx.stroke();
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 7, bh); ctx.lineTo(i * 5, bh + 14 + L('net') * 3 - Math.abs(i)); ctx.stroke(); }
  }

  // shield bubble
  if (b.shield) {
    ctx.save(); ctx.globalAlpha = 0.5 + 0.15 * Math.sin(b.t * 8);
    pen.begin().ell(0, (top + bh) / 2, rx * 1.25, (bh - top) / 2 + 20).stroke(4, P.electric);
    ctx.globalAlpha = 0.12; pen.fill(P.electric);
    ctx.restore();
  }
  ctx.restore();
}

function drawJerry(ctx: CanvasRenderingContext2D, b: BalloonLook, f: number) {
  ctx.save();
  ctx.scale(f, 1);
  const zap = (b.zap ?? 0) > 0 && Math.floor(b.t * 20) % 2 === 0;
  // scarf (drawn first, flows behind) — points are in balloon-local space; mirror x
  if (b.scarf.length > 1) {
    const pts = b.scarf.map((p) => [p[0] * f, p[1]]);
    const left: number[][] = [], right: number[][] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const dx = q[0] - o[0], dy = q[1] - o[1]; const d = Math.hypot(dx, dy) || 1;
      const w = lerp(4.5, 3, i / pts.length);
      left.push([p[0] - (dy / d) * w, p[1] + (dx / d) * w]); right.push([p[0] + (dy / d) * w, p[1] - (dx / d) * w]);
    }
    pen.begin().poly([...left, ...right.reverse()], true).ink(P.redBright, 2.2);
    // stripes
    for (let i = 2; i < pts.length - 1; i += 2) { const p = pts[i]; pen.begin().ell(p[0], p[1], 2, 2).fill(P.gold); }
    // fringe
    const e = pts[pts.length - 1];
    pen.begin().m(e[0], e[1]).l(e[0] - 4, e[1] + 6).m(e[0], e[1]).l(e[0] + 2, e[1] + 7).stroke(1.5, P.redDark);
  }
  // torso
  pen.begin().m(-13, 4).q(-15, -20, -6, -27).l(10, -27).q(16, -18, 14, 4).close().ink(zap ? P.white : P.brown, 2.8);
  pen.begin().m(2, -26).l(3, 2).stroke(1.4, P.brownDark);
  // fur collar
  pen.begin().m(-9, -27).q(-3, -21, 3, -26).q(9, -21, 13, -27).q(6, -31, 2, -30).q(-4, -32, -9, -27).close().ink(P.parchment, 2);

  // arm (front)
  const arm = b.arm;
  let hx = 14, hy = -4; // hand position (local, facing right)
  const sh = [8, -22]; // shoulder
  if (arm === 'burn') { hx = 2; hy = -62; }
  else if (arm === 'throw') { hx = 24; hy = 6; }
  else if (arm === 'crank') { const a = b.t * 14; hx = 18 + Math.cos(a) * 5; hy = -6 + Math.sin(a) * 5; }
  else if (arm === 'cheer' || arm === 'wave') { hx = 26 + (arm === 'wave' ? Math.sin(b.t * 12) * 5 : 0); hy = -66; }
  const elbow = arm === 'cheer' || arm === 'wave' ? [24, -36] : [(sh[0] + hx) / 2 + 6, (sh[1] + hy) / 2 + 4];
  pen.begin().m(sh[0], sh[1]).q(elbow[0], elbow[1], hx, hy).stroke(9, P.ink);
  pen.begin().m(sh[0], sh[1]).q(elbow[0], elbow[1], hx, hy).stroke(5.5, P.brown);
  if (arm === 'cheer') { // other arm up too
    pen.begin().m(-8, -22).q(-22, -36, -20, -64).stroke(9, P.ink);
    pen.begin().m(-8, -22).q(-22, -36, -20, -64).stroke(5.5, P.brown);
    glove(-20, -66);
  }

  // head
  const hX = 2, hY = -44;
  const headPath = () => pen.begin().m(hX - 13, hY + 2).q(hX - 14, hY - 15, hX, hY - 15).q(hX + 14, hY - 15, hX + 13, hY + 1).q(hX + 12, hY + 14, hX, hY + 14).q(hX - 12, hY + 14, hX - 13, hY + 2).close();
  headPath(); pen.ink(zap ? P.white : P.skin, 2.8);
  cel(ctx, headPath, () => { ctx.fillStyle = 'rgba(160,80,50,0.25)'; ctx.beginPath(); ctx.ellipse(hX - 12, hY + 6, 9, 12, 0, 0, 7); ctx.fill(); });
  if (zap) { // skeleton flash — classic cartoon electrocution
    pen.begin().m(hX - 5, hY - 4).l(hX - 1, hY).m(hX - 1, hY - 4).l(hX - 5, hY).m(hX + 3, hY - 4).l(hX + 7, hY).m(hX + 7, hY - 4).l(hX + 3, hY).stroke(2, P.ink);
    pen.begin().m(-8, -20).l(10, -20).m(-8, -14).l(10, -14).m(-8, -8).l(10, -8).m(1, -26).l(1, 2).stroke(2, P.ink);
  }
  // stubble
  ctx.fillStyle = 'rgba(42,26,20,0.35)';
  for (const [sx, sy] of [[-4, 10], [0, 11], [5, 10], [9, 8], [-7, 8], [2, 12]]) { ctx.beginPath(); ctx.arc(hX + sx, hY + sy, 0.7, 0, 7); ctx.fill(); }
  // ear
  pen.begin().ell(hX - 9, hY + 1, 3.5, 4.5).ink(P.skin, 2);

  // eyes
  const ex1 = hX + 2, ex2 = hX + 10, ey = hY - 2;
  const e = b.expr;
  if (!zap) {
    if (e === 'happy' || e === 'cheer') {
      pen.begin().m(ex1 - 4, ey + 1).q(ex1, ey - 4, ex1 + 4, ey + 1).stroke(2.4);
      pen.begin().m(ex2 - 4, ey + 1).q(ex2, ey - 4, ex2 + 4, ey + 1).stroke(2.4);
    } else if (e === 'hurt') {
      pen.begin().m(ex1 - 4, ey - 4).l(ex1 + 3, ey).l(ex1 - 4, ey + 3).stroke(2.4);
      pen.begin().m(ex2 + 4, ey - 4).l(ex2 - 3, ey).l(ex2 + 4, ey + 3).stroke(2.4);
    } else {
      const big = e === 'panic' ? 1.3 : 1;
      const lx = clamp(b.lookX, -1, 1) * 1.6, ly = clamp(b.lookY, -1, 1) * 1.6;
      for (const ex of [ex1, ex2]) {
        pen.begin().ell(ex, ey, 4 * big, 5.2 * big).ink(P.white, 2);
        if (b.blink) { pen.begin().ell(ex, ey, 4 * big, 5.2 * big).fill(P.skin); pen.begin().m(ex - 4, ey).l(ex + 4, ey).stroke(2); continue; }
        const pr = e === 'panic' ? 1.3 : 2.1;
        pen.begin().ell(ex + lx + 0.8, ey + ly + 0.5, pr, pr * 1.2).fill(P.ink);
        if (e === 'tired') { pen.begin().m(ex - 4.5, ey - 1).q(ex, ey - 3, ex + 4.5, ey - 1).l(ex + 4, ey - 5).l(ex - 4, ey - 5).close().ink(P.skinShade, 1.5); }
      }
    }
    // brows
    const browY = ey - 8 * (e === 'panic' ? 1.2 : 1);
    if (e === 'determined' || e === 'hurt') {
      pen.begin().m(ex1 - 4, browY - 1).l(ex1 + 4, browY + 2).stroke(2.8);
      pen.begin().m(ex2 - 4, browY + 2).l(ex2 + 4, browY - 1).stroke(2.8);
    } else if (e === 'panic' || e === 'tired') {
      pen.begin().m(ex1 - 4, browY + 1).l(ex1 + 3, browY - 2).stroke(2.8);
      pen.begin().m(ex2 - 3, browY - 2).l(ex2 + 4, browY + 1).stroke(2.8);
    } else {
      pen.begin().m(ex1 - 4, browY).q(ex1, browY - 3, ex1 + 4, browY).stroke(2.6);
      pen.begin().m(ex2 - 4, browY).q(ex2, browY - 3, ex2 + 4, browY).stroke(2.6);
    }
  }
  // nose (big bulb)
  pen.begin().ell(hX + 15, hY + 4, 6, 5).ink(P.skinShade, 2.4);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(hX + 14, hY + 2, 1.5, 0, 7); ctx.fill();
  // mouth
  const mx = hX + 8, my = hY + 10;
  if (e === 'happy' || e === 'cheer') { pen.begin().m(mx - 6, my - 2).q(mx, my + 7, mx + 6, my - 3).q(mx, my + 1, mx - 6, my - 2).close().ink(P.redDark, 2); }
  else if (e === 'panic' || e === 'zapped') { pen.begin().ell(mx + 1, my + 1, 3, 4).ink(P.redDark, 2); }
  else if (e === 'hurt') { pen.begin().m(mx - 6, my).l(mx - 3, my - 2).l(mx, my).l(mx + 3, my - 2).l(mx + 6, my).stroke(2); }
  else if (e === 'tired') { pen.begin().m(mx - 5, my + 1).q(mx, my - 1, mx + 5, my + 1).stroke(2); }
  else if (e === 'determined') { pen.begin().m(mx - 5, my + 1).q(mx + 1, my + 2, mx + 6, my - 2).stroke(2.2); }
  else { pen.begin().m(mx - 5, my).q(mx, my + 3, mx + 5, my - 1).stroke(2.2); }
  // sweat drop when panicking
  if (e === 'panic') { const sy = hY - 8 + ((b.t * 30) % 10); pen.begin().m(hX - 6, sy).q(hX - 9, sy + 6, hX - 6, sy + 7).q(hX - 3, sy + 6, hX - 6, sy).close().ink(P.tealLight, 1.5); }

  // leather cap + ear flap
  pen.begin().m(hX - 14, hY - 1).q(hX - 15, hY - 18, hX + 1, hY - 18).q(hX + 15, hY - 18, hX + 14, hY - 5).q(hX + 3, hY - 10, hX - 14, hY - 1).close().ink(P.brownDark, 2.6);
  pen.begin().m(hX - 13, hY - 1).q(hX - 16, hY + 9, hX - 8, hY + 10).q(hX - 6, hY + 3, hX - 8, hY - 3).close().ink(P.brownDark, 2.2);
  // goggles
  if (b.goggleDown) {
    pen.begin().m(hX - 13, ey).l(hX + 13, ey).stroke(3.5, P.brownDark);
    for (const ex of [ex1, ex2]) { pen.begin().ell(ex, ey, 5.5, 5.5).ink(P.brass, 2.4); pen.begin().ell(ex, ey, 3.8, 3.8).fill(P.tealLight); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(ex - 1.5, ey - 1.5, 1.3, 0, 7); ctx.fill(); }
  } else {
    pen.begin().m(hX - 14, hY - 9).q(hX, hY - 13, hX + 14, hY - 9).stroke(3.5, P.brownDark);
    for (const gx of [hX + 1, hX + 11]) {
      pen.begin().ell(gx, hY - 12, 6, 5.5).ink(P.brass, 2.4);
      pen.begin().ell(gx, hY - 12, 4, 3.6).fill(P.tealLight);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(gx - 1.5, hY - 13.5, 1.3, 0, 7); ctx.fill();
    }
  }
  glove(hx, hy);
  if (b.dizzy) {
    for (let i = 0; i < 3; i++) {
      const a = b.t * 5 + (i * Math.PI * 2) / 3;
      const sx = hX + Math.cos(a) * 18, sy = hY - 22 + Math.sin(a) * 5;
      const pts: number[][] = [];
      for (let k = 0; k < 10; k++) { const aa = -Math.PI / 2 + (k / 10) * Math.PI * 2; const rr = k % 2 ? 2.2 : 5; pts.push([sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr]); }
      pen.begin().poly(pts).ink(P.gold, 1.4);
    }
  }
  ctx.restore();

  function glove(x: number, y: number) {
    pen.begin().ell(x, y, 5, 4.6).ink(P.glove, 2.2);
    pen.begin().m(x - 1, y - 3).l(x - 1, y + 1).m(x + 2, y - 3).l(x + 2, y + 1).stroke(1, P.inkSoft);
  }
}
