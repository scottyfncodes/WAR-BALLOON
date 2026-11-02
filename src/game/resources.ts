import { P } from '../render/palette';
import { pen, inkText } from '../render/ink';
import { TAU } from '../core/math';

export type ResKey = 'scrap' | 'fabric' | 'parts' | 'tech' | 'fuel' | 'food' | 'meds';
export const RES_KEYS: ResKey[] = ['scrap', 'fabric', 'parts', 'tech', 'fuel', 'food', 'meds'];
export type Cost = Partial<Record<ResKey, number>>;
export const RES_LABEL: Record<ResKey, string> = { scrap: 'Scrap', fabric: 'Fabric', parts: 'Parts', tech: 'Rare Tech', fuel: 'Fuel', food: 'Food', meds: 'Meds' };
export const RES_COLOR: Record<ResKey, string> = { scrap: P.steelLight, fabric: P.tealLight, parts: P.brassLight, tech: P.electric, fuel: P.orangeLight, food: P.goldLight, meds: P.redBright };

/** Loot kinds that can lie around the world and be hooked. */
export type LootKind = ResKey | 'crate' | 'cache' | 'trophy';

export function drawResIcon(ctx: CanvasRenderingContext2D, kind: LootKind | string, r: number, t = 0) {
  pen.use(ctx, 0.5);
  switch (kind) {
    case 'scrap': {
      const n = 8; const pts: number[][] = [];
      for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU + t * 0.2; const rr = i % 2 ? r * 0.75 : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      pen.begin().poly(pts).ink(P.steel, 2.2);
      pen.begin().ell(0, 0, r * 0.38, r * 0.38).ink(P.steelDark, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.4, r * 0.18, 0, 7); ctx.fill();
      break;
    }
    case 'fuel': {
      pen.begin().rrect(-r * 0.75, -r, r * 1.5, r * 2, 3).ink(P.red, 2.2);
      pen.begin().m(-r * 0.5, -r * 0.6).l(r * 0.5, r * 0.6).m(r * 0.5, -r * 0.6).l(-r * 0.5, r * 0.6).stroke(1.6, P.redDark);
      pen.begin().rrect(r * 0.15, -r * 1.35, r * 0.45, r * 0.4, 1).ink(P.steel, 1.6);
      break;
    }
    case 'fabric': {
      pen.begin().rrect(-r, -r * 0.6, r * 2, r * 1.2, r * 0.5).ink(P.teal, 2.2);
      pen.begin().ell(r * 0.85, 0, r * 0.3, r * 0.6).ink(P.tealLight, 1.8);
      pen.begin().m(-r * 0.6, -r * 0.6).l(-r * 0.6, r * 0.6).m(0, -r * 0.6).l(0, r * 0.6).stroke(1.4, P.parchment);
      break;
    }
    case 'food': {
      pen.begin().rrect(-r * 0.7, -r * 0.9, r * 1.4, r * 1.8, 2).ink(P.steelLight, 2.2);
      pen.begin().rect(-r * 0.7, -r * 0.45, r * 1.4, r * 0.9).ink(P.orange, 1.6);
      pen.begin().ell(0, 0, r * 0.3, r * 0.3).fill(P.parchment);
      break;
    }
    case 'meds': {
      pen.begin().rrect(-r, -r * 0.75, r * 2, r * 1.5, 3).ink(P.white, 2.2);
      pen.begin().rect(-r * 0.18, -r * 0.55, r * 0.36, r * 1.1).fill(P.redBright);
      pen.begin().rect(-r * 0.55, -r * 0.18, r * 1.1, r * 0.36).fill(P.redBright);
      pen.begin().m(-r * 0.4, -r * 0.75).q(0, -r * 1.25, r * 0.4, -r * 0.75).stroke(2);
      break;
    }
    case 'parts': {
      // wrench crossed over a cog
      pen.begin().ell(0, 0, r * 0.75, r * 0.75).ink(P.brass, 2);
      pen.begin().ell(0, 0, r * 0.3, r * 0.3).ink(P.brassDark, 1.5);
      ctx.save(); ctx.rotate(-0.7);
      pen.begin().rrect(-r * 0.18, -r * 1.1, r * 0.36, r * 2.0, 2).ink(P.steelLight, 1.8);
      pen.begin().m(-r * 0.4, -r * 1.1).l(-r * 0.4, -r * 1.4).m(r * 0.4, -r * 1.1).l(r * 0.4, -r * 1.4).stroke(3, P.steelLight);
      ctx.restore();
      break;
    }
    case 'tech': {
      pen.begin().rrect(-r, -r * 0.7, r * 2, r * 1.4, 3).ink('#2f6a4a', 2.2);
      ctx.strokeStyle = P.goldLight; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.3); ctx.lineTo(-r * 0.2, -r * 0.3); ctx.lineTo(0, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(-r * 0.6, r * 0.35); ctx.lineTo(r * 0.3, r * 0.35); ctx.stroke();
      pen.begin().rect(-r * 0.15, -r * 0.5, r * 0.5, r * 0.4).ink(P.ink, 1);
      ctx.fillStyle = Math.sin(t * 6) > 0 ? P.electric : P.tealLight; ctx.beginPath(); ctx.arc(r * 0.65, -r * 0.4, r * 0.16, 0, 7); ctx.fill();
      break;
    }
    case 'crate': case 'cache': {
      const big = kind === 'cache';
      pen.begin().rect(-r, -r, r * 2, r * 2).ink(big ? P.olive : P.brownLight, 2.6);
      pen.begin().m(-r, -r).l(r, r).m(-r + 3, -r).l(-r + 3, r).m(r - 3, -r).l(r - 3, r).stroke(1.6, big ? P.oliveDark : P.brown);
      if (big) { pen.begin().rect(-r * 0.8, -r * 0.35, r * 1.6, r * 0.7).ink(P.parchment, 1.5); ctx.font = `${r * 0.42}px "Luckiest Guy", Impact`; ctx.fillStyle = P.redDark; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SUPPLY', 0, 1); }
      break;
    }
    case 'trophy': {
      const g = 0.5 + 0.5 * Math.sin(t * 4);
      ctx.fillStyle = `rgba(255,216,119,${0.2 + g * 0.25})`; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, 7); ctx.fill();
      pen.begin().m(-r * 0.7, -r * 0.8).l(r * 0.7, -r * 0.8).q(r * 0.7, r * 0.2, 0, r * 0.35).q(-r * 0.7, r * 0.2, -r * 0.7, -r * 0.8).close().ink(P.gold, 2.2);
      pen.begin().rect(-r * 0.15, r * 0.3, r * 0.3, r * 0.4).ink(P.goldDark, 1.5);
      pen.begin().rect(-r * 0.5, r * 0.7, r, r * 0.3).ink(P.brown, 1.5);
      inkText(ctx, '?', 0, -r * 0.25, r * 0.9, P.parchment, { outline: 2, shadow: false });
      break;
    }
  }
}
