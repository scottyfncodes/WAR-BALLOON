import { P } from './palette';
import { pen } from './ink';
import { hash } from '../core/math';
import { Engine } from '../core/engine';

export type ZKindArt = 'walker' | 'swarmer' | 'climber' | 'leaper' | 'brute' | 'spitter' | 'bloater' | 'screamer' | 'soldier';
export type ZPose = 'walk' | 'reach' | 'climb' | 'crouch' | 'leap' | 'hang' | 'fall' | 'board' | 'stun' | 'scream' | 'spit' | 'throw' | 'idle';

export interface ZDraw { kind: ZKindArt; pose: ZPose; t: number; facing: number; seed: number; burn?: number; flash?: boolean; spin?: number; }

const SKINS = ['#9ab07a', '#8aa88a', '#a8b890', '#88a070', '#b0b88a', '#9aa898'];
const CLOTHES = [P.teal, P.purple, P.red, '#2f5f8a', P.olive, '#a8744a', P.orange, '#7a5a76', '#5a5a6a', P.parchmentShade];
const PANTS = ['#3a3a4a', '#4a3a2a', '#2f3f5a', '#5a4a3a'];

/** Size of each kind (feet to top of head) and body proportions. */
export const Z_SIZE: Record<ZKindArt, { h: number; w: number; arm: number }> = {
  walker: { h: 34, w: 11, arm: 13 }, soldier: { h: 35, w: 12, arm: 13 }, swarmer: { h: 22, w: 8, arm: 9 }, climber: { h: 40, w: 9, arm: 19 },
  leaper: { h: 30, w: 10, arm: 13 }, brute: { h: 54, w: 22, arm: 20 }, spitter: { h: 34, w: 12, arm: 11 }, bloater: { h: 38, w: 18, arm: 11 }, screamer: { h: 36, w: 9, arm: 13 },
};

/** Cartoon zombie, origin at the feet (or at the hands for 'hang'). Facing 1 = right. */
export function drawZombie(ctx: CanvasRenderingContext2D, z: ZDraw) {
  if (Engine.lite) { drawZombieLite(ctx, z); return; }
  const S = Z_SIZE[z.kind];
  const h1 = hash(z.seed), h2 = hash(z.seed + 3.3), h3 = hash(z.seed + 7.7);
  const skin = z.kind === 'bloater' ? '#b8c070' : z.kind === 'spitter' ? '#9ac080' : SKINS[Math.floor(h1 * SKINS.length)];
  const shirt = z.kind === 'soldier' ? '#5c6a4e' : z.kind === 'brute' ? (h2 > 0.5 ? '#6a5a4a' : P.redDark) : CLOTHES[Math.floor(h2 * CLOTHES.length)];
  const pants = z.kind === 'soldier' ? '#46503a' : PANTS[Math.floor(h3 * PANTS.length)];
  const t = z.t + h1 * 10;
  const f = z.facing;
  pen.use(ctx, 0.45, Math.floor(t * 8) + Math.floor(h1 * 99));
  ctx.save();
  ctx.scale(f, 1);
  const H = S.h, W = S.w;
  let lean = 0.18, legA = 0, armUp = 0, armFwd = 1, crouch = 0, jaw = 0.3;
  const walkCyc = Math.sin(t * (z.kind === 'swarmer' ? 16 : z.kind === 'brute' ? 5 : 8));
  switch (z.pose) {
    case 'walk': legA = walkCyc; armUp = 0.2 + Math.sin(t * 3) * 0.1; break;
    case 'idle': legA = 0; lean = 0.25 + Math.sin(t * 1.5) * 0.05; armUp = 0.1; armFwd = 0.7; jaw = 0.2 + Math.abs(Math.sin(t * 2)) * 0.3; break;
    case 'reach': legA = Math.sin(t * 12) * 0.3; lean = -0.1; armUp = 1; armFwd = 0.3 + Math.sin(t * 10) * 0.15; jaw = 0.5 + Math.abs(Math.sin(t * 9)) * 0.5; break;
    case 'climb': legA = Math.sin(t * 10); lean = -0.05; armUp = 1; armFwd = 0.5; break;
    case 'crouch': crouch = 0.35; lean = 0.5; armUp = -0.2; armFwd = 0.5; jaw = 0.8; break;
    case 'leap': legA = -0.8; lean = -0.3; armUp = 1; armFwd = 1.2; jaw = 1; break;
    case 'hang': legA = Math.sin(t * 9) * 0.8; lean = 0; armUp = 1.15; armFwd = 0; jaw = 0.5 + Math.abs(Math.sin(t * 7)) * 0.5; break;
    case 'fall': legA = Math.sin(t * 20) * 0.9; armUp = 1.2; armFwd = Math.sin(t * 18); jaw = 1; break;
    case 'board': legA = Math.sin(t * 6) * 0.2; lean = 0.1; armUp = 0.4 + Math.sin(t * 12) * 0.4; armFwd = 1.2; jaw = 0.4 + Math.abs(Math.sin(t * 12)) * 0.6; break;
    case 'stun': legA = 0; lean = -0.15; armUp = -0.3; armFwd = 0.3; jaw = 0.9; break;
    case 'scream': legA = 0; lean = -0.35; armUp = 0.6; armFwd = -0.3; jaw = 1.4; break;
    case 'spit': legA = 0; lean = Math.sin(t * 6) > 0 ? 0.4 : -0.2; armUp = 0; armFwd = 0.2; jaw = 1; break;
    case 'throw': legA = 0.3; lean = -0.2; armUp = 1.3; armFwd = 0.2; jaw = 0.7; break;
  }
  if (z.pose === 'hang') ctx.translate(0, H * 0.95);
  if (z.pose === 'fall') ctx.rotate((z.spin ?? 0));
  if (z.flash) ctx.globalAlpha = 0.55;
  const legH = H * (z.kind === 'climber' ? 0.42 : z.kind === 'brute' ? 0.3 : 0.36) * (1 - crouch);
  const hipY = -legH;
  // legs
  const legW = z.kind === 'brute' ? 6 : z.kind === 'swarmer' ? 2.6 : 3.4;
  for (const side of [-1, 1]) {
    const a = legA * side * 0.5;
    const kx = Math.sin(a) * legH * 0.5 + (crouch ? side * 4 : 0), ky = hipY + legH * 0.5;
    const fx = Math.sin(a) * legH, fy = 0;
    pen.begin().m(side * W * 0.25, hipY).q(kx + side * W * 0.25, ky, fx + side * 2, fy).stroke(legW + 2.4, P.ink);
    pen.begin().m(side * W * 0.25, hipY).q(kx + side * W * 0.25, ky, fx + side * 2, fy).stroke(legW, pants);
    pen.begin().ell(fx + side * 2 + 2, fy - 1, legW * 0.8, legW * 0.5).fill(P.ink);
  }
  ctx.save();
  ctx.translate(0, hipY); ctx.rotate(lean);
  const torsoH = H - legH - H * (z.kind === 'brute' ? 0.2 : 0.3);
  // back arm
  const shY = -torsoH * 0.88;
  const arm = (side: number, col: string) => {
    const reach = S.arm;
    const ang = -Math.PI / 2 * armUp + (1 - armUp) * 0.2;
    const hx = Math.cos(ang) * reach * armFwd * 0.9 + (armUp > 0.9 ? side * 3 : reach * 0.15), hy = shY + Math.sin(ang) * reach * (armUp > 0.5 ? 1.1 : 0.4) + (armUp < 0.2 ? reach * 0.5 : 0);
    const aw = z.kind === 'brute' ? 7 : z.kind === 'swarmer' ? 2.6 : 3.4;
    pen.begin().m(side * 2, shY).q((hx + side * 2) * 0.5 + 2, (shY + hy) * 0.5 - 2, hx, hy).stroke(aw + 2.4, P.ink);
    pen.begin().m(side * 2, shY).q((hx + side * 2) * 0.5 + 2, (shY + hy) * 0.5 - 2, hx, hy).stroke(aw, col);
    pen.begin().ell(hx, hy, aw * 0.75 + 1, aw * 0.75 + 1).ink(skin, 1.6);
    if (z.kind !== 'swarmer') pen.begin().m(hx, hy).l(hx + 2.5, hy - 3).m(hx + 1, hy + 1).l(hx + 4, hy - 1).stroke(1.2);
  };
  arm(-1, shirt);
  // torso
  if (z.kind === 'bloater') {
    pen.begin().ell(0, -torsoH * 0.45, W * 0.75, torsoH * 0.62).ink(skin, 2.4);
    ctx.fillStyle = 'rgba(160,200,60,0.5)'; ctx.beginPath(); ctx.ellipse(2, -torsoH * 0.45, W * 0.45, torsoH * 0.35, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#c8e070'; ctx.beginPath(); ctx.arc(-4 + i * 5, -torsoH * (0.3 + i * 0.15), 1.6 + Math.sin(t * 4 + i) * 0.6, 0, 7); ctx.fill(); }
    pen.begin().rect(-W * 0.6, -torsoH * 0.15, W * 1.2, 4).fill(shirt);
  } else if (z.kind === 'brute') {
    pen.begin().m(-W * 0.45, 0).q(-W * 0.62, -torsoH * 0.7, -W * 0.3, -torsoH).l(W * 0.4, -torsoH).q(W * 0.7, -torsoH * 0.6, W * 0.42, 0).close().ink(shirt, 2.8);
    pen.begin().m(-W * 0.2, -torsoH * 0.6).l(W * 0.25, -torsoH * 0.3).stroke(1.2, 'rgba(42,26,20,0.5)');
    pen.begin().ell(W * 0.15, -torsoH * 0.75, 4, 3).fill(skin); // hole in shirt
  } else {
    const tw = W * (z.kind === 'climber' ? 0.4 : 0.5);
    pen.begin().m(-tw, 0).q(-tw * 1.1, -torsoH * 0.6, -tw * 0.7, -torsoH).l(tw * 0.8, -torsoH).q(tw * 1.2, -torsoH * 0.5, tw, 0).close().ink(shirt, 2.2);
    // rips + tie
    pen.begin().m(-tw * 0.6, -torsoH * 0.2).l(-tw * 0.2, -torsoH * 0.35).l(0, -torsoH * 0.15).stroke(1.2, 'rgba(42,26,20,0.6)');
    if (h3 > 0.6 && z.kind === 'walker') pen.begin().m(tw * 0.15, -torsoH * 0.95).l(tw * 0.3, -torsoH * 0.4).l(-tw * 0.05, -torsoH * 0.45).close().ink(P.red, 1);
    if (z.kind === 'soldier') pen.begin().rect(-tw, -torsoH * 0.55, tw * 2, torsoH * 0.18).fill('#3e4a34');
    if (z.kind === 'spitter') { pen.begin().ell(tw * 0.4, -torsoH, tw * 0.9, tw * 0.75).ink('#a8d070', 2); }
  }
  // head
  const hr = z.kind === 'swarmer' ? 7 : z.kind === 'brute' ? 7.5 : z.kind === 'bloater' ? 7.5 : 8;
  const hx = z.kind === 'brute' ? W * 0.2 : 2, hy = -torsoH - hr * 0.75 + (z.kind === 'brute' ? 3 : 0);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.sin(t * 2.2) * 0.12 + (z.pose === 'scream' ? -0.3 : 0));
  const headPath = () => pen.begin().m(-hr, 0).q(-hr * 1.05, -hr * 1.15, 0, -hr * 1.1).q(hr * 1.1, -hr * 1.1, hr, -0.5).q(hr * 0.9, hr * 0.95, 0, hr).q(-hr * 0.95, hr * 0.9, -hr, 0).close();
  headPath(); pen.ink(skin, 2.2);
  // hair / helmet
  if (z.kind === 'soldier') pen.begin().m(-hr * 1.15, -hr * 0.2).q(-hr * 1.1, -hr * 1.5, 0, -hr * 1.45).q(hr * 1.2, -hr * 1.5, hr * 1.15, -hr * 0.2).close().ink('#5c6a4e', 2);
  else if (h2 > 0.35 && z.kind !== 'brute') { ctx.fillStyle = [P.ink, P.brownDark, '#dfe0e0', P.red][Math.floor(h3 * 4)]; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-hr * 0.6 + i * hr * 0.5, -hr * 0.95); ctx.lineTo(-hr * 0.4 + i * hr * 0.5 + 2, -hr * 1.45); ctx.lineTo(-hr * 0.2 + i * hr * 0.5, -hr * 0.9); ctx.fill(); } }
  // eyes: mismatched, droopy
  const e1 = hr * 0.32, e2 = hr * (0.2 + h1 * 0.16);
  pen.begin().ell(hr * 0.15, -hr * 0.25, e1, e1).ink(z.burn ? P.flame1 : '#f6f2c0', 1.4);
  pen.begin().ell(hr * 0.7, -hr * 0.2, e2, e2).ink(z.burn ? P.flame1 : '#f6f2c0', 1.4);
  ctx.fillStyle = z.kind === 'screamer' ? P.hot : P.ink;
  ctx.beginPath(); ctx.arc(hr * 0.22, -hr * 0.22, 1.4, 0, 7); ctx.arc(hr * 0.74, -hr * 0.17, 1.1, 0, 7); ctx.fill();
  pen.begin().m(-hr * 0.15, -hr * 0.62).l(hr * 0.4, -hr * 0.5).stroke(1.6);
  // mouth: jaw opens
  const mw = z.kind === 'screamer' ? hr * 0.75 : hr * 0.5;
  const mo = Math.max(1, jaw * hr * (z.kind === 'screamer' ? 0.8 : 0.45));
  pen.begin().m(hr * 0.05, hr * 0.3).l(hr * 0.05 + mw, hr * 0.28).l(hr * 0.05 + mw * 0.9, hr * 0.3 + mo).l(hr * 0.1, hr * 0.3 + mo * 0.9).close().ink(P.redDark, 1.4);
  ctx.fillStyle = P.white; ctx.fillRect(hr * 0.15, hr * 0.28, 2, 2); ctx.fillRect(hr * 0.15 + mw * 0.5, hr * 0.28, 2, 2.4);
  if (z.kind === 'spitter') { const d = (t * 2) % 1; ctx.fillStyle = '#9ad040'; ctx.beginPath(); ctx.arc(hr * 0.4, hr * 0.5 + mo + d * 6, 1.8, 0, 7); ctx.fill(); }
  // stitches / bandage
  if (h1 > 0.5) pen.begin().m(-hr * 0.7, -hr * 0.6).l(-hr * 0.2, -hr * 0.9).m(-hr * 0.55, -hr * 0.9).l(-hr * 0.5, -hr * 0.6).m(-hr * 0.35, -hr * 0.95).l(-hr * 0.3, -hr * 0.68).stroke(1, P.ink);
  ctx.restore();
  arm(1, shirt);
  ctx.restore();
  // fire
  if (z.burn && z.burn > 0) {
    for (let i = 0; i < 3; i++) {
      const fx = -W * 0.4 + i * W * 0.4, fy = -H * (0.4 + 0.25 * Math.sin(t * 13 + i));
      const fh = 8 + Math.sin(t * 20 + i * 2) * 3;
      pen.begin().m(fx - 4, fy).q(fx - 4, fy - fh * 0.6, fx, fy - fh).q(fx + 4, fy - fh * 0.6, fx + 4, fy).close().ink(P.flame2, 1.2);
      pen.begin().ell(fx, fy - 2, 2, 3).fill(P.flame1);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Cheap silhouette for slow devices: same size, colour and pose read, a quarter of the paths. */
function drawZombieLite(ctx: CanvasRenderingContext2D, z: ZDraw) {
  const S = Z_SIZE[z.kind];
  const h1 = hash(z.seed), h2 = hash(z.seed + 3.3);
  const skin = z.kind === 'bloater' ? '#b8c070' : SKINS[Math.floor(h1 * SKINS.length)];
  const shirt = z.kind === 'soldier' ? '#5c6a4e' : CLOTHES[Math.floor(h2 * CLOTHES.length)];
  const t = z.t + h1 * 10, H = S.h, W = S.w;
  ctx.save(); ctx.scale(z.facing, 1);
  if (z.pose === 'hang') ctx.translate(0, H * 0.95);
  if (z.pose === 'fall') ctx.rotate(z.spin ?? 0);
  const up = z.pose === 'reach' || z.pose === 'hang' || z.pose === 'climb' || z.pose === 'leap' || z.pose === 'fall';
  const leg = Math.sin(t * 8) * 3;
  ctx.lineCap = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(4, W * 0.4);
  ctx.beginPath(); ctx.moveTo(-2, -H * 0.36); ctx.lineTo(-3 + leg, 0); ctx.moveTo(2, -H * 0.36); ctx.lineTo(3 - leg, 0);
  const ay = up ? -H * 1.05 : -H * 0.62;
  ctx.moveTo(0, -H * 0.62); ctx.lineTo(S.arm * (up ? 0.3 : 0.9), ay); ctx.stroke();
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(0, -H * 0.5, W * 0.55, H * 0.22, 0, 0, 7); ctx.fill(); ctx.lineWidth = 1.8; ctx.stroke();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(2, -H * 0.82, H * 0.17, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = z.burn ? P.flame2 : '#f6f2c0'; ctx.fillRect(3, -H * 0.86, 3, 3);
  ctx.restore();
  if (z.burn && z.burn > 0) { ctx.fillStyle = P.flame2; ctx.beginPath(); ctx.arc(0, -H * 0.7, 5 + Math.sin(t * 20) * 2, 0, 7); ctx.fill(); }
}
