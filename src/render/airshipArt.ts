import { P } from './palette';
import { pen, cel, inkText } from './ink';
import { drawBalloon, drawJerry, MOUTH_Y, type Expr, type ArmPose, type BalloonLook } from './balloonArt';
import { drawCharacterMini } from './crewArt';
import { drawZombie, type ZKindArt } from './zombieArt';
import { drawResIcon } from '../game/resources';
import { decorById } from '../game/cosmetics';
import type { CharLook } from './characters';
import type { Role } from '../game/crew';

/** Local airship geometry per basket tier. Units are pre-scale (origin = deck/rim centre). */
export interface Geom { tier: number; w: number; hullH: number; bottom: number; plat: number; seats: { x: number; y: number; lower: boolean }[]; slots: { x: number; y: number }[]; jerryX: number; lift: number; }
const geoms: Geom[] = [];
export function airshipGeom(tier: number): Geom {
  if (geoms[tier]) return geoms[tier];
  const W = [50, 70, 78, 112, 150][tier];
  const H = [32, 36, 38, 40, 46][tier];
  const lower = tier >= 3 ? (tier === 3 ? 34 : 38) : 0;
  const plat = tier === 2 ? 36 : 0;
  const bottom = H + lower;
  const seatsX: Record<number, { x: number; y: number; lower: boolean }[]> = {
    0: [{ x: 15, y: 0, lower: false }],
    1: [{ x: 6, y: 0, lower: false }, { x: 24, y: 0, lower: false }],
    2: [{ x: 18, y: 0, lower: false }, { x: -24, y: 0, lower: false }, { x: 56, y: 2, lower: false }, { x: -58, y: 2, lower: false }],
    3: [{ x: 18, y: 0, lower: false }, { x: 36, y: 0, lower: false }, { x: -22, y: 0, lower: false }, { x: -40, y: 0, lower: false }, { x: -24, y: H + 18, lower: true }, { x: 24, y: H + 18, lower: true }],
    4: [{ x: 20, y: 0, lower: false }, { x: 40, y: 0, lower: false }, { x: 60, y: 0, lower: false }, { x: -22, y: 0, lower: false }, { x: -52, y: -24, lower: true }, { x: -36, y: H + 20, lower: true }, { x: 4, y: H + 20, lower: true }, { x: 44, y: H + 20, lower: true }],
  };
  const slots: { x: number; y: number }[] = [];
  const bw = tier >= 3 ? W * 0.86 : W; // lower deck narrower
  const half = (plat ? W / 2 + plat : W / 2);
  slots.push({ x: -half - 3, y: plat ? 8 : H * 0.35 }, { x: half + 3, y: plat ? 8 : H * 0.35 });
  if (!plat) slots.push({ x: -W / 2 - 1, y: H * 0.75 }, { x: W / 2 + 1, y: H * 0.75 });
  const n = Math.max(2, Math.floor(bw / 17));
  for (let i = 0; i < n; i++) slots.push({ x: -bw / 2 + 8 + (i * (bw - 16)) / Math.max(1, n - 1), y: bottom + 1 });
  if (plat) for (const s of [-1, 1]) slots.push({ x: s * (W / 2 + plat * 0.5), y: 8 });
  if (lower) slots.push({ x: -bw / 2 - 2, y: H + lower * 0.5 }, { x: bw / 2 + 2, y: H + lower * 0.5 });
  const g: Geom = { tier, w: W, hullH: H, bottom, plat, seats: seatsX[tier], slots, jerryX: tier === 0 ? -5 : 0, lift: tier * 8 };
  geoms[tier] = g;
  return g;
}

export interface CrewDraw { look: CharLook; role: Role; pose: 'idle' | 'fight' | 'shoot' | 'cheer' | 'ko' | 'work'; hp: number; aim: number; flash: number; }
export interface HangerDraw { slot: number; kind: ZKindArt; t: number; seed: number; burn: number; flash: boolean; climb: number; }
export interface BoarderDraw { x: number; kind: ZKindArt; t: number; seed: number; flash: boolean; facing: number; }

export interface AirshipLook {
  t: number; facing: number; tilt: number; swing: number; squash: number; wobble: number; burner: number; inflate: number;
  levels: Record<string, number>; decor: Record<string, string>; trophies: string[];
  envDamage: number; hullDamage: number; flash: boolean;
  expr: Expr; arm: ArmPose; lookX: number; lookY: number; blink: boolean; scarf: number[][]; goggleDown: boolean; zap: number; dizzy: boolean;
  crew: CrewDraw[]; hangers: HangerDraw[]; boarders: BoarderDraw[];
  gunAim: number; gunAim2: number; gunFlash: number; gunFlash2: number; turretAim: number; turretFlash: number;
  flaming: number; teslaT: number; ladder: number; propSpin: number; boosting: number; bombs: number; bombCap: number;
}

export function airshipLook(over: Partial<AirshipLook>): AirshipLook {
  return {
    t: 0, facing: 1, tilt: 0, swing: 0, squash: 0, wobble: 0, burner: 0, inflate: 1, levels: {}, decor: {}, trophies: [], envDamage: 0, hullDamage: 0, flash: false,
    expr: 'neutral', arm: 'rest', lookX: 1, lookY: 0, blink: false, scarf: [[2, -27], [-6, -25], [-14, -22], [-22, -20], [-30, -18], [-38, -15], [-45, -13]], goggleDown: false, zap: 0, dizzy: false,
    crew: [], hangers: [], boarders: [], gunAim: 0.6, gunAim2: 2.5, gunFlash: 0, gunFlash2: 0, turretAim: Math.PI / 2, turretFlash: 0, flaming: 0, teslaT: 0, ladder: 0, propSpin: 0, boosting: 0, bombs: 0, bombCap: 3,
    ...over,
  };
}

const ENV_SIZE = [0.82, 1.0, 1.16, 1.32, 1.5];

/** Draw Jerry's airship in local coords (origin = rim centre). The star of the show. */
export function drawAirship(ctx: CanvasRenderingContext2D, a: AirshipLook) {
  const L = (id: string) => a.levels[id] ?? 0;
  const tier = L('basket');
  const g = airshipGeom(tier);
  const f = a.facing;
  const mat = decorById(a.decor.material ?? 'wicker') ?? decorById('wicker')!;
  const matA = mat.color!, matB = mat.color2!;
  const W = g.w, H = g.hullH;
  const envS = ENV_SIZE[L('envelope')];
  const lift = g.lift + (envS - 1) * 20;
  pen.use(ctx, 0.6);
  ctx.save();
  ctx.rotate(a.tilt);
  if (a.flash) ctx.globalAlpha = 0.5;

  // ---------------- envelope (shared ink & paint art) ----------------
  ctx.save();
  ctx.translate(0, -lift);
  const look: BalloonLook = {
    t: a.t, facing: f, tilt: 0, squash: a.squash, wobble: a.wobble, burner: 0, levels: { envelope: L('skin'), fins: 0, buoy: 0 }, paint: a.decor.paint ?? 'classic',
    damage: Math.round(a.envDamage * 4), expr: a.expr, arm: a.arm, lookX: a.lookX, lookY: a.lookY, blink: a.blink, scarf: a.scarf, bombs: 0, bombCap: 0, propSpin: 0, boosting: false,
    shield: false, flash: false, goggleDown: a.goggleDown, inflate: a.inflate, size: envS, envelopeOnly: true, zap: a.zap, dizzy: a.dizzy,
  };
  drawBalloon(ctx, look, 0.6);
  ctx.restore();
  const mouthY = MOUTH_Y - lift;
  const rx = 64 * envS * (0.55 + 0.45 * a.inflate);

  // ---------------- string lights along the rigging ----------------
  const lights = a.decor.lights;
  const rigEnds = [[-W / 2 + 3, 0], [W / 2 - 3, 0]];
  const rigTops = [[-rx * 0.62, mouthY - 20 * envS], [rx * 0.62, mouthY - 20 * envS]];
  // ---------------- rigging ----------------
  for (let i = 0; i < 2; i++) {
    const [x2, y2] = rigEnds[i], [x1, y1] = rigTops[i];
    pen.begin().m(x1, y1).q((x1 + x2) / 2, (y1 + y2) / 2, x2, y2).stroke(1.6, P.ink);
    pen.begin().m(i ? 15 : -15, mouthY).l(x2 * 0.85, y2).stroke(1.4, P.ink);
    if (g.plat) pen.begin().m(x1, y1).l((i ? 1 : -1) * (W / 2 + g.plat - 4), -16).stroke(1.2, P.inkSoft);
  }
  if (lights && lights !== 'nolights') {
    for (let i = 0; i < 2; i++) {
      const [x2, y2] = rigEnds[i], [x1, y1] = rigTops[i];
      for (let k = 1; k < 7; k++) {
        const u = k / 7; const lx = x1 + (x2 - x1) * u, ly = y1 + (y2 - y1) * u + Math.sin(u * Math.PI) * 4;
        if (lights === 'lanterns') { pen.begin().rrect(lx - 3, ly, 6, 7, 2).ink(k % 2 ? P.red : P.gold, 1); ctx.fillStyle = 'rgba(255,220,120,0.25)'; ctx.beginPath(); ctx.arc(lx, ly + 4, 7, 0, 7); ctx.fill(); }
        else { const on = Math.floor(a.t * 4 + k + i) % 2 === 0; ctx.fillStyle = on ? [P.goldLight, P.redBright, P.tealLight][k % 3] : '#6a5a4a'; ctx.beginPath(); ctx.arc(lx, ly + 2, 2.2, 0, 7); ctx.fill(); }
      }
    }
  }

  // ---------------- burners ----------------
  const burners = [1, 1, 2, 3][L('burner')];
  const by = mouthY + 14;
  const flick = Math.sin(a.t * 40) * 0.5 + Math.sin(a.t * 23) * 0.5;
  for (let i = 0; i < burners; i++) {
    const bx = (i - (burners - 1) / 2) * 12;
    if (a.burner > 0.02) {
      const fl = a.burner * (a.boosting > 0 ? 1.5 : 1);
      const fh = (22 + fl * 30 + flick * 4) * (L('burner') >= 3 ? 1.2 : 1), fw = 7 + fl * 4;
      pen.begin().m(bx - fw, by - 2).q(bx - fw * 1.2, by - fh * 0.5, bx + flick * 2, by - fh).q(bx + fw * 1.2, by - fh * 0.5, bx + fw, by - 2).close().ink(P.flame3, 2.2);
      pen.begin().m(bx - fw * 0.6, by - 3).q(bx - fw * 0.7, by - fh * 0.45, bx - flick * 1.5, by - fh * 0.75).q(bx + fw * 0.7, by - fh * 0.4, bx + fw * 0.6, by - 3).close().fill(P.flame2);
      pen.begin().m(bx - fw * 0.3, by - 4).q(bx, by - fh * 0.5, bx, by - fh * 0.42).q(bx + fw * 0.3, by - fh * 0.25, bx + fw * 0.3, by - 4).close().fill(P.flame1);
    } else pen.begin().ell(bx, by - 5, 2.5, 4 + flick).fill(P.flame2);
    pen.begin().rrect(bx - 6, by - 2, 12, 9, 2).ink(P.steel, 2);
  }
  pen.begin().m(-W / 2 + 6, 0).l(-10 - (burners - 1) * 6, by + 7).l(10 + (burners - 1) * 6, by + 7).l(W / 2 - 6, 0).stroke(2.5, P.steelDark);

  // ---------------- flag on a pole at the back ----------------
  const flag = decorById(a.decor.flag ?? 'noflag');
  if (flag && flag.id !== 'noflag') {
    const px = -f * (W / 2 - 4);
    pen.begin().m(px, 0).l(px, -58 - tier * 4).stroke(2.4, P.brownDark);
    const top = -58 - tier * 4, wv = Math.sin(a.t * 7) * 3, dir = -f;
    if (flag.id === 'hope') {
      pen.begin().m(px, top).q(px + dir * 22, top + 2 + wv, px + dir * 44, top).l(px + dir * 42, top + 18 + wv).q(px + dir * 22, top + 20, px, top + 18).close().ink(flag.color!, 1.8);
      ctx.save(); ctx.translate(px + dir * 22, top + 9 + wv * 0.5); ctx.font = '7px "Luckiest Guy", Impact'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.parchment; ctx.fillText('STILL FLYING', 0, 0); ctx.restore();
    } else {
      pen.begin().m(px, top).q(px + dir * 12, top + 2 + wv, px + dir * 24, top + 1).l(px + dir * 22, top + 15 + wv).q(px + dir * 11, top + 14, px, top + 15).close().ink(flag.color!, 1.8);
      if (flag.id === 'jolly') { pen.begin().ell(px + dir * 11, top + 7 + wv * 0.5, 4, 3.6).fill(flag.color2!); ctx.fillStyle = P.ink; ctx.fillRect(px + dir * 11 - 3, top + 6 + wv * 0.5, 6, 1.6); }
      else pen.begin().rect(px + dir * 4, top + 6 + wv * 0.5, dir * 16, 4).fill(flag.color2!);
    }
  }

  // ---------------- propeller (behind) ----------------
  if (L('prop')) {
    const px = -f * (W / 2 + (g.plat ? g.plat : 0) + 10), py = 14;
    pen.begin().m(-f * (W / 2 + g.plat), py).l(px, py).stroke(4, P.steelDark);
    const big = L('prop') >= 2, bl = big ? 24 : 18;
    if (big) pen.begin().rrect(px - 8, py - 7, 16, 14, 3).ink(P.olive, 2.2);
    for (let k = 0; k < (big ? 4 : 2); k++) { const an = a.propSpin + k * (Math.PI * 2) / (big ? 4 : 2); const ext = Math.sin(an) * bl; pen.begin().ell(px - f * 2, py + ext / 2, 4, Math.abs(ext) / 2 + 1).ink(P.brownLight, 1.8); }
    pen.begin().ell(px - f * 3, py, 3.5, 3.5).ink(P.brass, 1.8);
  }

  // ---------------- fortress cabin (behind the crew) ----------------
  if (tier >= 4) {
    const cx0 = -70, cw = 40;
    pen.begin().rect(cx0, -42, cw, 42).ink(matA, 2.4);
    pen.begin().m(cx0 - 6, -42).l(cx0 + cw / 2, -60).l(cx0 + cw + 6, -42).close().ink(P.redDark, 2.4);
    pen.begin().rect(cx0 + cw - 12, -62, 7, 14).ink(P.steelDark, 1.8);
    if (Math.sin(a.t * 3) > 0) { ctx.fillStyle = 'rgba(120,110,100,0.4)'; ctx.beginPath(); ctx.arc(cx0 + cw - 8, -68 - (a.t * 10) % 8, 4, 0, 7); ctx.fill(); }
    pen.begin().rect(cx0 + 8, -32, 24, 16).ink('#3a3030', 1.8);
  }

  // ---------------- furniture on deck ----------------
  const furn = a.decor.furniture;
  if (furn && furn !== 'nofurn' && tier >= 1) {
    const fx = tier >= 4 ? -82 : tier >= 2 ? -W / 2 - g.plat + 10 : -W / 2 + 8;
    ctx.save(); ctx.translate(fx, 0);
    if (furn === 'plant') { pen.begin().m(-5, 0).l(5, 0).l(4, -8).l(-4, -8).close().ink(P.rust, 1.5); for (let k = 0; k < 5; k++) pen.begin().m(0, -8).q(-8 + k * 4, -16, -10 + k * 5, -22 - (k % 2) * 4).stroke(2, P.olive); }
    if (furn === 'chair') { pen.begin().rrect(-8, -20, 16, 20, 4).ink(P.red, 1.8); pen.begin().rrect(-11, -10, 5, 10, 2).ink(P.redDark, 1.5); pen.begin().rrect(6, -10, 5, 10, 2).ink(P.redDark, 1.5); }
    if (furn === 'gramophone') { pen.begin().rect(-6, -8, 12, 8).ink(P.brown, 1.5); pen.begin().m(0, -8).l(4, -14).stroke(1.5); pen.begin().m(2, -14).q(10, -28, 16, -24).q(12, -18, 4, -12).close().ink(P.brass, 1.6); if (Math.sin(a.t * 3) > 0) inkText(ctx, '♪', 18 + Math.sin(a.t * 2) * 3, -30, 9, P.parchment, { outline: 2, shadow: false }); }
    ctx.restore();
  }

  // ---------------- crew & Jerry (behind rim) ----------------
  const upper = a.crew.map((c, i) => ({ c, s: g.seats[i] })).filter((o) => o.s && !o.s.lower);
  for (const { c, s } of upper) { ctx.save(); ctx.translate(s.x, s.y); drawCharacterMini(ctx, c.look, c.role, a.t + s.x * 0.1, c.pose, f, c.aim, c.flash); ctx.restore(); }
  ctx.save(); ctx.translate(g.jerryX, 0);
  drawJerry(ctx, { ...look, levels: {}, expr: a.expr, arm: a.arm }, f);
  ctx.restore();
  // boarders stand on deck, among the crew
  for (const b of a.boarders) { ctx.save(); ctx.translate(b.x, 2); drawZombie(ctx, { kind: b.kind, pose: 'board', t: b.t, facing: b.facing, seed: b.seed, flash: b.flash }); ctx.restore(); }

  // ---------------- outrigger platforms ----------------
  if (g.plat) {
    for (const s of [-1, 1]) {
      const x0 = s * (W / 2), x1 = s * (W / 2 + g.plat);
      pen.begin().m(x0, 4).l(x1, 4).l(x1, 10).l(x0, 10).close().ink(matB, 2.2);
      pen.begin().m(x1, 4).l(x1, -18).m((x0 + x1) / 2, 4).l((x0 + x1) / 2, -18).m(x0, -18).l(x1, -18).stroke(2, P.brownDark);
      pen.begin().m(x0 + s * 4, 10).l(x0 + s * 18, 26).stroke(2.4, P.brownDark);
    }
  }

  // ---------------- lower deck / crew quarters ----------------
  if (tier >= 3) {
    const lw = W * 0.86, ly = H - 4, lh = g.bottom - H + 4;
    pen.begin().m(-lw / 2, ly).l(lw / 2, ly).l(lw / 2 - 6, ly + lh).q(0, ly + lh + 5, -lw / 2 + 6, ly + lh).close().ink(matB, 2.6);
    for (const s of g.seats.filter((q) => q.lower && q.y > 0)) {
      pen.begin().ell(s.x, s.y, 9, 9).ink('#2a2420', 2.2);
      pen.begin().ell(s.x, s.y, 10.5, 10.5).stroke(2, P.brass);
    }
    // crew peeking through portholes
    a.crew.forEach((c, i) => { const s = g.seats[i]; if (!s || !s.lower || s.y < 0) return; ctx.save(); ctx.beginPath(); ctx.arc(s.x, s.y, 8.5, 0, 7); ctx.clip(); ctx.translate(s.x, s.y + 22); ctx.scale(0.9, 0.9); drawCharacterMini(ctx, c.look, c.role, a.t, c.pose === 'ko' ? 'ko' : 'idle', f, 0, c.flash); ctx.restore(); });
    if (L('floor')) pen.begin().m(-lw / 2 + 6, ly + lh - 3).l(lw / 2 - 6, ly + lh - 3).stroke(3, P.steelDark);
  }
  if (tier >= 4) a.crew.forEach((c, i) => { const s = g.seats[i]; if (!s || !s.lower || s.y > 0) return; ctx.save(); ctx.beginPath(); ctx.rect(-62, -32, 24, 16); ctx.clip(); ctx.translate(-50, -6); ctx.scale(0.85, 0.85); drawCharacterMini(ctx, c.look, c.role, a.t, 'idle', f, 0, c.flash); ctx.restore(); });

  // ---------------- main basket / hull ----------------
  const hullPath = () => pen.begin().m(-W / 2 - 2, 0).l(W / 2 + 2, 0).l(W / 2 - 4, H).q(0, H + 3, -W / 2 + 4, H).close();
  cel(ctx, hullPath, () => {
    ctx.fillStyle = matA; ctx.fillRect(-W, -2, W * 2, H + 8);
    if (mat.id === 'wicker') {
      ctx.strokeStyle = matB; ctx.lineWidth = 2.4;
      for (let r = 0; r < Math.floor(H / 8); r++) { const yy = 6 + r * 8; ctx.beginPath(); for (let xx = -W / 2; xx <= W / 2; xx += 6) { const o = ((xx / 6 + r) % 2 === 0) ? -1.5 : 1.5; if (xx === -W / 2) ctx.moveTo(xx, yy + o); else ctx.lineTo(xx, yy + o); } ctx.stroke(); }
      ctx.strokeStyle = P.brownDark; ctx.lineWidth = 1.5;
      for (let xx = -W / 2 + 6; xx <= W / 2 - 6; xx += 8) { ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx * 0.9, H); ctx.stroke(); }
    } else {
      ctx.strokeStyle = matB; ctx.lineWidth = 1.5;
      for (let yy = 8; yy < H; yy += 8) { ctx.beginPath(); ctx.moveTo(-W, yy); ctx.lineTo(W, yy); ctx.stroke(); }
      if (mat.id === 'brass') { ctx.fillStyle = P.brassDark; for (let yy = 4; yy < H; yy += 8) for (let xx = -W / 2 + 4; xx < W / 2; xx += 10) { ctx.beginPath(); ctx.arc(xx, yy, 1.1, 0, 7); ctx.fill(); } }
    }
    ctx.fillStyle = 'rgba(60,25,10,0.3)'; ctx.fillRect(W * 0.18, 0, W, H + 8);
    // plating panels
    if (L('plating') >= 1) {
      const rows = L('plating') >= 2 ? [[4, H - 8]] : [[H * 0.35, H * 0.4]];
      for (const [py, ph] of rows) for (let px = -W / 2 + 4; px < W / 2 - 8; px += 22) {
        ctx.fillStyle = P.steel; ctx.fillRect(px, py, 20, ph);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(px + 2, py + 2, 16, 3);
        ctx.strokeStyle = P.ink; ctx.lineWidth = 1.3; ctx.strokeRect(px, py, 20, ph);
        ctx.fillStyle = P.steelDark; for (const [qx, qy] of [[px + 3, py + 3], [px + 17, py + 3], [px + 3, py + ph - 3], [px + 17, py + ph - 3]]) { ctx.beginPath(); ctx.arc(qx, qy, 1.4, 0, 7); ctx.fill(); }
      }
    }
    // hull cracks when boarders/brutes do damage
    if (a.hullDamage > 0.2) { ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-W * 0.2, 2); ctx.lineTo(-W * 0.12, H * 0.4); ctx.lineTo(-W * 0.22, H * 0.7); ctx.stroke(); }
  });
  hullPath(); pen.stroke(3);
  pen.begin().rrect(-W / 2 - 5, -5, W + 10, 9, 4).ink(matB, 2.6);
  if (L('floor') && tier < 3) pen.begin().m(-W / 2 + 3, H - 2).l(W / 2 - 3, H - 2).stroke(3.5, P.steelDark);

  // ---------------- side gear: fuel tanks, cargo crates ----------------
  const tk = L('tank');
  for (let i = 0; i < tk; i++) { const tx = f * (W / 2 + 4 + i * 9), tyy = tier >= 3 ? H - 10 : 4; pen.begin().rrect(tx - 4, tyy, 8, 22, 4).ink(P.red, 1.8); pen.begin().m(tx - 4, tyy + 8).l(tx + 4, tyy + 8).stroke(1.2, P.redDark); }
  const st = L('storage');
  if (st) {
    const sx = -f * (W / 2 + (g.plat ? g.plat - 10 : 6));
    pen.begin().m(sx, 6).l(sx, 14).stroke(1.2);
    pen.begin().rect(sx - 8, 14, 16, 14).ink(P.brownLight, 2); pen.begin().m(sx - 8, 14).l(sx + 8, 28).stroke(1.2, P.brown);
    if (st >= 2) { ctx.strokeStyle = P.inkSoft; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-W / 2 + 4, H - 2); ctx.quadraticCurveTo(0, H + 24, W / 2 - 4, H - 2); ctx.stroke(); for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 9, H); ctx.lineTo(i * 7, H + 16 - Math.abs(i) * 2); ctx.stroke(); } drawResIcon(ctx, 'crate', 5, 0); }
  }
  // ---------------- spikes ----------------
  if (L('spikes')) {
    const bw = tier >= 3 ? W * 0.86 : W;
    for (let x = -bw / 2 + 4; x <= bw / 2 - 4; x += 8) pen.begin().m(x - 3, g.bottom - 1).l(x, g.bottom + 7).l(x + 3, g.bottom - 1).close().ink(P.steelLight, 1.2);
    for (const s of [-1, 1]) for (let y = 6; y < H; y += 10) pen.begin().m(s * (W / 2 - 1), y - 3).l(s * (W / 2 + 7), y).l(s * (W / 2 - 1), y + 3).close().ink(P.steelLight, 1.2);
  }
  // ---------------- trophies hanging from the hull ----------------
  a.trophies.slice(0, Math.min(6, 2 + tier)).forEach((id, i) => {
    const n = Math.min(a.trophies.length, 2 + tier);
    const tx = (-W / 2 + 10) + (i * (W - 20)) / Math.max(1, n - 1) + (n === 1 ? (W - 20) / 2 : 0), ty = g.bottom + 6 + Math.sin(a.t * 3 + i) * 1.5;
    pen.begin().m(tx, g.bottom - 2).l(tx, ty).stroke(1);
    drawTrophyMini(ctx, id, tx, ty + 5, a.t);
  });

  // ---------------- tesla coils ----------------
  if (L('tesla')) for (const s of [-1, 1]) {
    const cx = s * (W / 2 - 2);
    pen.begin().rect(cx - 3, -16, 6, 12).ink(P.brass, 1.6); pen.begin().ell(cx, -18, 5, 3).ink(P.steelLight, 1.4);
    if (a.teslaT > 0 || Math.random() < 0.05) { ctx.strokeStyle = P.electric; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, -18); for (let k = 0; k < 4; k++) ctx.lineTo(cx + (Math.random() - 0.5) * 14, -22 - k * 4); ctx.stroke(); }
  }
  // ---------------- mounted guns ----------------
  const gun = (gx: number, aim: number, flash: number) => {
    ctx.save(); ctx.translate(gx, -6);
    pen.begin().rect(-3, 0, 6, 8).ink(P.steelDark, 1.6);
    ctx.rotate(aim);
    pen.begin().rrect(-4, -4, 22, 8, 2).ink(P.steel, 1.8);
    pen.begin().rect(14, -2, 10, 4).ink(P.ink, 1);
    if (flash > 0) { pen.begin().m(24, 0).l(34, -5).l(31, 0).l(36, 5).close().ink(P.flame1, 1.2); }
    ctx.restore();
  };
  if (L('gun') >= 1) gun(W / 2 - 8, a.gunAim, a.gunFlash);
  if (L('gun') >= 3) gun(-W / 2 + 8, a.gunAim2, a.gunFlash2);
  if (L('turret')) {
    ctx.save(); ctx.translate(0, g.bottom + 2);
    pen.begin().m(-10, 0).q(-10, 10, 0, 11).q(10, 10, 10, 0).close().ink(P.steelDark, 2);
    ctx.rotate(a.turretAim); pen.begin().rrect(0, -2.5, 18, 5, 2).ink(P.steel, 1.5);
    if (a.turretFlash > 0) pen.begin().m(18, 0).l(26, -4).l(24, 0).l(28, 4).close().ink(P.flame1, 1);
    ctx.restore();
  }
  // ---------------- flamethrower nozzle ----------------
  if (L('flamer')) {
    pen.begin().rrect(-f * W / 2 - 4, 6, 8, 18, 3).ink(P.olive, 1.8);
    pen.begin().m(-f * W / 2, 24).q(-f * W / 3, g.bottom + 4, 0, g.bottom + 4).stroke(2.2, P.steelDark);
    pen.begin().rect(-4, g.bottom + 2, 8, 6).ink(P.brass, 1.4);
    if (a.flaming > 0) {
      const k = a.flaming;
      for (let i = 0; i < 5; i++) { const fx = Math.sin(a.t * 30 + i * 2) * 14, fh = 40 + 50 * k + i * 6; pen.begin().m(-8 + fx * 0.2, g.bottom + 8).q(fx - 20, g.bottom + fh * 0.5, fx, g.bottom + fh).q(fx + 20, g.bottom + fh * 0.5, 8, g.bottom + 8).close().ink(i % 2 ? P.flame3 : P.flame2, 1.4); }
    }
  }
  // ---------------- boost rockets ----------------
  if (L('boost')) for (const s of [-1, 1]) {
    const rx2 = s * (W / 2 - 10);
    pen.begin().rrect(rx2 - 4, H - 6, 8, 12, 2).ink(P.steelDark, 1.6);
    if (a.boosting > 0) pen.begin().m(rx2 - 4, H + 6).q(rx2, H + 30 + Math.random() * 10, rx2 + 4, H + 6).close().ink(P.flame2, 1.2);
  }
  // ---------------- bomb rack ----------------
  const shown = Math.min(7, a.bombCap);
  for (let i = 0; i < shown; i++) {
    const bx2 = -((shown - 1) * 7) / 2 + i * 7 + (L('turret') ? 22 : 0), by2 = g.bottom + 6;
    if (i < a.bombs) { pen.begin().ell(bx2, by2, 3.6, 3.6).fill(P.ink); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(bx2 - 1.2, by2 - 1.2, 1.1, 0, 7); ctx.fill(); }
  }

  // ---------------- rescue ladder ----------------
  if (a.ladder > 4) {
    const lx = f * 10, ln = a.ladder, sw = Math.sin(a.t * 3) * 4;
    pen.begin().m(lx - 6, g.bottom).q(lx - 6 + sw * 0.5, g.bottom + ln / 2, lx - 6 + sw, g.bottom + ln).stroke(1.8, P.brownDark);
    pen.begin().m(lx + 6, g.bottom).q(lx + 6 + sw * 0.5, g.bottom + ln / 2, lx + 6 + sw, g.bottom + ln).stroke(1.8, P.brownDark);
    for (let y = 8; y < ln; y += 9) { const u = y / ln; pen.begin().m(lx - 6 + sw * u, g.bottom + y).l(lx + 6 + sw * u, g.bottom + y).stroke(1.6, P.brownLight); }
  }

  // ---------------- zombies hanging off the basket ----------------
  for (const h of a.hangers) {
    const s = g.slots[h.slot]; if (!s) continue;
    ctx.save(); ctx.translate(s.x, s.y + 2 - h.climb * 14);
    ctx.rotate(Math.sin(h.t * 2.4 + h.seed) * 0.18 - a.swing * 1.6 - a.tilt);
    drawZombie(ctx, { kind: h.kind, pose: 'hang', t: h.t, facing: s.x > 0 ? -1 : 1, seed: h.seed, burn: h.burn, flash: h.flash });
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Tiny trophy doodles that dangle from the basket. */
export function drawTrophyMini(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + x) * 0.15);
  pen.use(ctx, 0.3);
  switch (id) {
    case 'gnome': pen.begin().m(-4, 4).l(4, 4).l(0, -8).close().ink(P.red, 1.2); pen.begin().ell(0, 1, 3, 3).ink(P.skin, 1); break;
    case 'teddy': pen.begin().ell(0, 2, 4, 4).ink(P.brownLight, 1.2); pen.begin().ell(0, -3, 3, 3).ink(P.brownLight, 1.2); break;
    case 'sheriff': case 'medal': { const pts: number[][] = []; for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 2 : 5; pts.push([Math.cos(an) * r, Math.sin(an) * r]); } pen.begin().poly(pts).ink(P.gold, 1.2); break; }
    case 'horseshoe': pen.begin().m(-4, 4).q(-5, -5, 0, -5).q(5, -5, 4, 4).stroke(2.4, P.steel); break;
    case 'cone': pen.begin().m(-4, 4).l(4, 4).l(0, -7).close().ink(P.orange, 1.2); pen.begin().m(-2, -1).l(2, -1).stroke(1.4, P.white); break;
    case 'hardhat': pen.begin().m(-5, 2).q(-5, -5, 0, -5).q(5, -5, 5, 2).close().ink(P.gold, 1.2); break;
    case 'key': pen.begin().ell(0, -3, 3, 3).stroke(1.6, P.gold); pen.begin().m(0, 0).l(0, 6).l(2, 6).stroke(1.6, P.gold); break;
    case 'disco': pen.begin().ell(0, 0, 5, 5).ink(P.steelLight, 1.2); ctx.fillStyle = Math.sin(t * 8) > 0 ? P.white : P.electric; ctx.fillRect(-2, -2, 2, 2); break;
    case 'dogtags': pen.begin().rrect(-3, -3, 6, 8, 2).ink(P.steelLight, 1.2); break;
    case 'vial': pen.begin().rrect(-2.5, -5, 5, 10, 2).ink('#9ad040', 1.2); ctx.fillStyle = 'rgba(160,240,80,0.35)'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); break;
    case 'crown': pen.begin().m(-5, 3).l(-5, -3).l(-2, 0).l(0, -5).l(2, 0).l(5, -3).l(5, 3).close().ink(P.gold, 1.2); break;
  }
  ctx.restore();
}
