import { P } from './palette';
import { pen, cel } from './ink';

export interface CharLook { skin: string; coat: string; hair: string; hat: 'bun' | 'scarf' | 'sailor' | 'straw' | 'hood' | 'mask'; glasses?: 'round' | 'shades' | 'goggles'; beard?: boolean; flower?: boolean; soot?: boolean; }

/** Half-length cartoon portrait for camp leaders. Origin = bottom centre. */
export function drawCharacter(ctx: CanvasRenderingContext2D, c: CharLook, t: number, talking: boolean, cheer = 0) {
  pen.use(ctx, 0.6);
  const bob = Math.sin(t * 2) * 2 - (cheer > 0 ? Math.abs(Math.sin(cheer * 9)) * 12 : 0);
  ctx.save(); ctx.translate(0, bob);
  // shoulders / coat
  pen.begin().m(-62, 0).q(-60, -70, 0, -78).q(60, -70, 62, 0).close().ink(c.coat, 3);
  pen.begin().m(0, -76).l(0, 0).stroke(1.6, 'rgba(42,26,20,0.4)');
  for (const by of [-50, -30, -10]) pen.begin().ell(6, by, 3, 3).ink(P.brass, 1.2);
  if (cheer > 0) for (const sx of [-1, 1]) { // arms flung up in delight
    pen.begin().m(sx * 46, -56).q(sx * 74, -96, sx * 64, -150 - Math.sin(t * 14) * 6).stroke(16, P.ink);
    pen.begin().m(sx * 46, -56).q(sx * 74, -96, sx * 64, -150 - Math.sin(t * 14) * 6).stroke(11, c.coat);
    pen.begin().ell(sx * 64, -156 - Math.sin(t * 14) * 6, 10, 9).ink(P.glove, 2.4);
  }
  // neck + head
  pen.begin().rect(-10, -92, 20, 18).ink(c.skin, 2.4);
  const head = () => pen.begin().m(-34, -120).q(-36, -168, 0, -170).q(36, -168, 34, -120).q(32, -86, 0, -84).q(-32, -86, -34, -120).close();
  head(); pen.ink(c.skin, 3);
  cel(ctx, head, () => { ctx.fillStyle = 'rgba(160,80,50,0.22)'; ctx.beginPath(); ctx.ellipse(22, -120, 16, 36, 0, 0, 7); ctx.fill(); });
  if (c.soot) { ctx.fillStyle = 'rgba(42,26,20,0.35)'; for (const [sx, sy] of [[-20, -108], [16, -100], [-8, -96]]) { ctx.beginPath(); ctx.ellipse(sx, sy, 7, 4, 0.3, 0, 7); ctx.fill(); } }
  // eyes + brows
  const blink = (t % 3.7) < 0.12;
  for (const ex of [-13, 13]) {
    if (cheer > 0) { pen.begin().m(ex - 7, -124).q(ex, -134, ex + 7, -124).stroke(3); continue; }
    if (blink) { pen.begin().m(ex - 7, -126).l(ex + 7, -126).stroke(2.6); continue; }
    pen.begin().ell(ex, -126, 7, 9).ink(P.white, 2.2);
    pen.begin().ell(ex + 1.5, -125, 3.4, 4.2).fill(P.ink);
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(ex + 3, -127, 1.2, 0, 7); ctx.fill();
  }
  pen.begin().m(-21, -141).q(-13, -146, -5, -140).m(5, -140).q(13, -146, 21, -141).stroke(3, c.hair === P.white ? P.inkSoft : c.hair);
  // glasses
  if (c.glasses === 'round') { for (const ex of [-13, 13]) pen.begin().ell(ex, -126, 11, 11).stroke(2.4, P.brassDark); pen.begin().m(-2, -126).l(2, -126).stroke(2, P.brassDark); }
  if (c.glasses === 'shades') { for (const ex of [-13, 13]) pen.begin().rrect(ex - 11, -134, 22, 14, 4).ink(P.ink, 2); pen.begin().m(-2, -128).l(2, -128).stroke(2); }
  if (c.glasses === 'goggles') { pen.begin().m(-34, -150).l(34, -150).stroke(5, P.brownDark); for (const ex of [-12, 12]) { pen.begin().ell(ex, -152, 10, 9).ink(P.brass, 2.4); pen.begin().ell(ex, -152, 7, 6).fill(P.tealLight); } }
  // nose + mouth
  pen.begin().ell(0, -112, 7, 6).ink(c.skin, 2.4);
  const open = talking ? Math.abs(Math.sin(t * 14)) : 0;
  pen.begin().m(-12, -100).q(0, -94 + open * 6, 12, -100).q(0, -96 + open * 10, -12, -100).close().ink(talking ? P.redDark : c.skin, 2.2);
  if (c.beard) pen.begin().m(-30, -112).q(-30, -78, 0, -74).q(30, -78, 30, -112).q(18, -96, 0, -96).q(-18, -96, -30, -112).close().ink(c.hair, 2.4);
  // hats / hair
  switch (c.hat) {
    case 'bun':
      pen.begin().m(-36, -128).q(-40, -176, 0, -176).q(40, -176, 36, -128).q(20, -160, 0, -160).q(-20, -160, -36, -128).close().ink(c.hair, 2.6);
      pen.begin().ell(0, -182, 16, 12).ink(c.hair, 2.6); pen.begin().m(-6, -192).l(10, -176).stroke(2.5, P.steel);
      break;
    case 'scarf':
      pen.begin().m(-38, -132).q(-40, -182, 0, -182).q(40, -182, 38, -132).q(20, -150, 0, -152).q(-20, -150, -38, -132).close().ink(c.hair, 2.6);
      pen.begin().m(-36, -100).q(0, -80, 36, -100).l(34, -86).q(0, -66, -34, -86).close().ink(c.hair, 2.4);
      break;
    case 'sailor':
      pen.begin().m(-36, -146).q(0, -160, 36, -146).l(30, -172).q(0, -182, -30, -172).close().ink(P.white, 2.6);
      pen.begin().m(-38, -146).q(0, -156, 38, -146).l(40, -140).q(0, -150, -40, -140).close().ink(P.tealDark, 2);
      pen.begin().ell(0, -166, 6, 5).ink(P.gold, 1.5);
      break;
    case 'straw':
      pen.begin().ell(0, -150, 58, 12).ink(P.goldLight, 2.6);
      pen.begin().m(-28, -150).q(-28, -182, 0, -184).q(28, -182, 28, -150).close().ink(P.goldLight, 2.6);
      pen.begin().m(-28, -156).q(0, -160, 28, -156).stroke(5, P.red);
      if (c.flower) { for (let k = 0; k < 5; k++) { const a = k * 1.256; pen.begin().ell(30 + Math.cos(a) * 6, -160 + Math.sin(a) * 6, 4, 4).ink(P.white, 1.2); } pen.begin().ell(30, -160, 3, 3).fill(P.gold); }
      break;
    case 'hood':
      pen.begin().m(-48, -100).q(-52, -192, 0, -194).q(52, -192, 48, -100).q(36, -150, 0, -156).q(-36, -150, -48, -100).close().ink(c.coat, 2.6);
      for (let k = -40; k <= 40; k += 10) pen.begin().ell(k, -150 - Math.cos(k / 40) * 30, 7, 6).ink(P.parchment, 1.4);
      break;
    case 'mask':
      pen.begin().m(-36, -128).q(-40, -170, 0, -172).q(40, -170, 36, -128).q(20, -152, 0, -154).q(-20, -152, -36, -128).close().ink(c.hair, 2.6);
      pen.begin().rrect(-30, -196, 60, 34, 6).ink(P.steelDark, 2.6); pen.begin().rect(-20, -186, 40, 10).ink(P.ink, 1.5);
      break;
  }
  ctx.restore();
}

export interface Leader { name: string; title: string; look: CharLook; }
export const LEADERS: Record<string, Leader> = {
  city: { name: 'Granny Gert', title: 'Mechanic of Haven', look: { skin: P.skin, coat: P.olive, hair: '#dfe0e0', hat: 'bun', glasses: 'round' } },
  dust: { name: 'Dot', title: 'Caravan boss', look: { skin: '#d8a070', coat: '#a8744a', hair: P.red, hat: 'scarf', glasses: 'shades' } },
  flood: { name: 'Ferryman Gus', title: 'Keeper of the Ferry Raft', look: { skin: P.skin, coat: '#2f5f8a', hair: '#8a6a50', hat: 'sailor', beard: true } },
  green: { name: 'Ottoline', title: 'Head Gardener', look: { skin: '#a8724a', coat: P.olive, hair: P.ink, hat: 'straw', flower: true } },
  frozen: { name: 'Dr. Penny Frost', title: 'Station scientist', look: { skin: '#f2d4c0', coat: '#5a7a9a', hair: P.gold, hat: 'hood', glasses: 'goggles' } },
  ash: { name: 'Rook', title: 'Forge-hand (ex-Baron crew)', look: { skin: '#c8906a', coat: '#4a3a36', hair: P.ink, hat: 'mask', soot: true } },
};
