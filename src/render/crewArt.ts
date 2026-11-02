import { P } from './palette';
import { pen } from './ink';
import type { CharLook } from './characters';
import type { Role } from '../game/crew';

/** Small full-body crew member standing in the basket (origin = feet at deck level, roughly Jerry-sized). */
export function drawCharacterMini(ctx: CanvasRenderingContext2D, c: CharLook, role: Role, t: number, pose: 'idle' | 'fight' | 'shoot' | 'cheer' | 'ko' | 'work', facing: number, aim = 0, flash = 0) {
  pen.use(ctx, 0.5);
  ctx.save();
  ctx.scale(facing, 1);
  if (flash > 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.5;
  const bob = pose === 'cheer' ? -Math.abs(Math.sin(t * 9)) * 5 : pose === 'ko' ? 10 : Math.sin(t * 2) * 0.8;
  ctx.translate(0, bob);
  if (pose === 'ko') ctx.rotate(-0.5);
  // torso
  pen.begin().m(-10, 4).q(-12, -16, -5, -22).l(7, -22).q(13, -14, 11, 4).close().ink(c.coat, 2.4);
  // arms
  const sh = [4, -18];
  let hx = 12, hy = -2;
  if (pose === 'fight') { hx = 16 + Math.sin(t * 14) * 5; hy = -14 + Math.cos(t * 14) * 4; }
  else if (pose === 'cheer') { hx = 12; hy = -40; }
  else if (pose === 'shoot') { hx = 4 + Math.cos(aim) * 14; hy = -16 + Math.sin(aim) * 14; }
  else if (pose === 'work') { hx = 10 + Math.sin(t * 10) * 3; hy = -6; }
  else if (pose === 'ko') { hx = 14; hy = 6; }
  pen.begin().m(sh[0], sh[1]).q((sh[0] + hx) / 2 + 3, (sh[1] + hy) / 2 + 3, hx, hy).stroke(7, P.ink);
  pen.begin().m(sh[0], sh[1]).q((sh[0] + hx) / 2 + 3, (sh[1] + hy) / 2 + 3, hx, hy).stroke(4, c.coat);
  if (pose === 'cheer') { pen.begin().m(-4, -18).q(-14, -28, -10, -40).stroke(7, P.ink); pen.begin().m(-4, -18).q(-14, -28, -10, -40).stroke(4, c.coat); pen.begin().ell(-10, -41, 3.5, 3.5).ink(P.glove, 1.5); }
  // role prop in hand
  ctx.save(); ctx.translate(hx, hy);
  switch (role) {
    case 'mechanic': ctx.rotate(-0.6 + (pose === 'work' ? Math.sin(t * 10) * 0.5 : 0)); pen.begin().rrect(-1.5, -12, 3, 12, 1).ink(P.steelLight, 1.2); pen.begin().m(-3, -12).l(-3, -15).m(3, -12).l(3, -15).stroke(2.2, P.steelLight); break;
    case 'gunner': ctx.rotate(pose === 'shoot' ? aim : -0.3); pen.begin().rrect(-3, -2.5, 18, 5, 1.5).ink(P.brownDark, 1.2); pen.begin().rect(10, -1.5, 9, 3).fill(P.steelDark); break;
    case 'medic': pen.begin().rrect(-5, -2, 10, 8, 2).ink(P.white, 1.2); pen.begin().rect(-1, -1, 2, 6).fill(P.red); pen.begin().rect(-3, 1, 6, 2).fill(P.red); break;
    case 'scavenger': pen.begin().m(-4, 0).q(-7, 12, 0, 12).q(7, 12, 4, 0).close().ink(P.parchmentShade, 1.2); break;
    case 'lookout': ctx.rotate(-0.5); pen.begin().rrect(-2, -14, 4, 14, 1).ink(P.brass, 1.2); break;
    case 'engineer': pen.begin().ell(0, -2, 5, 5).ink(P.brass, 1.2); pen.begin().ell(0, -2, 1.8, 1.8).fill(P.ink); break;
    case 'cook': ctx.rotate(-0.4); pen.begin().m(0, 0).l(0, -12).stroke(2, P.steelLight); pen.begin().ell(0, -14, 4, 3).ink(P.steelLight, 1.2); break;
  }
  pen.begin().ell(0, 0, 3.6, 3.4).ink(P.glove, 1.5);
  ctx.restore();
  // head
  const hX = 1, hY = -33;
  pen.begin().ell(hX, hY, 10, 10.5).ink(c.skin, 2.2);
  // face
  if (pose === 'ko') {
    pen.begin().m(hX + 1, hY - 2).l(hX + 5, hY + 1).m(hX + 5, hY - 2).l(hX + 1, hY + 1).m(hX + 7, hY - 2).l(hX + 10, hY + 1).stroke(1.4);
  } else if (pose === 'cheer') {
    pen.begin().m(hX + 1, hY - 1).q(hX + 3, hY - 4, hX + 5, hY - 1).m(hX + 6, hY - 1).q(hX + 8, hY - 4, hX + 10, hY - 1).stroke(1.6);
  } else {
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.ellipse(hX + 3, hY - 1, 2.6, 3.2, 0, 0, 7); ctx.ellipse(hX + 8, hY - 1, 2.4, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(hX + 3.8, hY - 0.5, 1.3, 0, 7); ctx.arc(hX + 8.6, hY - 0.5, 1.2, 0, 7); ctx.fill();
    if (pose === 'fight') pen.begin().m(hX + 1, hY - 5).l(hX + 5, hY - 3.5).m(hX + 6.5, hY - 3.5).l(hX + 10, hY - 5).stroke(1.6);
  }
  pen.begin().ell(hX + 10, hY + 2, 2.6, 2.2).ink(c.skin, 1.4);
  const mo = pose === 'fight' || pose === 'cheer' ? 2.5 : 0.5;
  pen.begin().m(hX + 3, hY + 5).q(hX + 6, hY + 6 + mo, hX + 9, hY + 4.5).stroke(1.4);
  if (c.beard) pen.begin().m(hX - 8, hY + 1).q(hX - 6, hY + 13, hX + 2, hY + 11).q(hX + 8, hY + 12, hX + 10, hY + 6).q(hX + 4, hY + 8, hX - 8, hY + 1).close().ink(c.hair, 1.4);
  if (c.glasses === 'round') { pen.begin().ell(hX + 3, hY - 1, 3.4, 3.4).stroke(1.2, P.brassDark); pen.begin().ell(hX + 8.5, hY - 1, 3.2, 3.2).stroke(1.2, P.brassDark); }
  if (c.glasses === 'shades') pen.begin().rrect(hX, hY - 4, 12, 5, 2).ink(P.ink, 1);
  // hair / hat
  switch (c.hat) {
    case 'cap': pen.begin().m(hX - 10, hY - 3).q(hX - 10, hY - 13, hX, hY - 13).q(hX + 10, hY - 13, hX + 10, hY - 4).close().ink(c.coat, 1.8); pen.begin().m(hX + 4, hY - 5).l(hX + 16, hY - 3).l(hX + 4, hY - 2).close().ink(c.coat, 1.4); break;
    case 'beanie': pen.begin().m(hX - 10, hY - 3).q(hX - 11, hY - 15, hX, hY - 15).q(hX + 11, hY - 15, hX + 10, hY - 3).close().ink(P.red, 1.8); pen.begin().ell(hX, hY - 16, 3, 3).ink(P.parchment, 1.2); break;
    case 'helmet': pen.begin().m(hX - 12, hY - 2).q(hX - 12, hY - 16, hX, hY - 16).q(hX + 12, hY - 16, hX + 12, hY - 2).close().ink('#5c6a4e', 1.8); break;
    case 'chef': pen.begin().rrect(hX - 8, hY - 16, 16, 8, 2).ink(P.white, 1.6); for (const dx of [-5, 0, 5]) pen.begin().ell(hX + dx, hY - 18, 5, 5).ink(P.white, 1.4); break;
    case 'bandana': pen.begin().m(hX - 10, hY - 3).q(hX - 10, hY - 13, hX, hY - 13).q(hX + 10, hY - 13, hX + 10, hY - 3).close().ink(P.red, 1.8); pen.begin().m(hX - 9, hY - 5).l(hX - 15, hY - 1).l(hX - 12, hY - 7).close().ink(P.red, 1.2); break;
    case 'straw': pen.begin().ell(hX, hY - 8, 15, 3.5).ink(P.goldLight, 1.6); pen.begin().m(hX - 7, hY - 8).q(hX - 7, hY - 17, hX, hY - 17).q(hX + 7, hY - 17, hX + 7, hY - 8).close().ink(P.goldLight, 1.6); break;
    case 'hood': pen.begin().m(hX - 13, hY + 6).q(hX - 14, hY - 18, hX, hY - 18).q(hX + 12, hY - 18, hX + 11, hY - 6).q(hX + 2, hY - 12, hX - 6, hY - 4).q(hX - 9, hY + 4, hX - 13, hY + 6).close().ink(c.coat, 1.8); break;
    case 'sailor': pen.begin().m(hX - 9, hY - 7).q(hX, hY - 10, hX + 9, hY - 7).l(hX + 7, hY - 15).q(hX, hY - 17, hX - 7, hY - 15).close().ink(P.white, 1.6); break;
    case 'scarf': case 'mask': pen.begin().m(hX - 10, hY - 2).q(hX - 11, hY - 14, hX, hY - 14).q(hX + 11, hY - 14, hX + 10, hY - 4).q(hX + 2, hY - 8, hX - 10, hY - 2).close().ink(c.hair, 1.6); pen.begin().m(hX - 8, hY + 7).q(hX + 2, hY + 12, hX + 10, hY + 7).stroke(4, c.hair); break;
    case 'bun': pen.begin().m(hX - 10, hY - 2).q(hX - 11, hY - 14, hX, hY - 14).q(hX + 11, hY - 14, hX + 10, hY - 4).q(hX + 2, hY - 8, hX - 10, hY - 2).close().ink(c.hair, 1.6); pen.begin().ell(hX - 4, hY - 15, 5, 4).ink(c.hair, 1.4); break;
    default: pen.begin().m(hX - 10, hY - 1).q(hX - 11, hY - 14, hX, hY - 14).q(hX + 11, hY - 14, hX + 10, hY - 4).q(hX + 2, hY - 9, hX - 10, hY - 1).close().ink(c.hair, 1.6);
  }
  if (c.flower) { ctx.fillStyle = P.white; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(hX - 8 + Math.cos(k * 1.26) * 2.2, hY - 10 + Math.sin(k * 1.26) * 2.2, 1.6, 0, 7); ctx.fill(); } ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(hX - 8, hY - 10, 1.2, 0, 7); ctx.fill(); }
  ctx.restore();
  ctx.globalAlpha = 1;
}
