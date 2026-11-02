import { Engine, type Scene } from '../core/engine';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { pen, inkText, bodyText, wrapText, makeCanvas, grain, daub } from '../render/ink';
import { clamp, RNG, damp, easeOutBack } from '../core/math';
import { UI, panel, fadeIn } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { MISSIONS, makeScavenge } from '../game/missions';
import type { MissionSpec } from '../game/types';
import { resourceBar, drawMenuBalloon, canAfford } from './common';
import { UPGRADES } from '../game/upgrades';
import { drawItemIcon } from '../game/entities';
import { drawRotate } from './play';

let mapArt: { c: HTMLCanvasElement; w: number; h: number } | null = null;

function paintMap(w: number, h: number) {
  const [c, x] = makeCanvas(w, h);
  const rng = new RNG(808);
  // parchment base
  x.fillStyle = P.parchment; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 120; i++) daub(x, rng.range(0, w), rng.range(0, h), rng.range(20, 70), rng.chance(0.5) ? P.parchmentDark : '#f6e8c8', 0.25, i);
  x.fillStyle = x.createPattern(grain(), 'repeat')!; x.globalAlpha = 0.8; x.fillRect(0, 0, w, h); x.globalAlpha = 1;
  pen.use(x, 0);
  // river
  x.strokeStyle = 'rgba(63,127,134,0.55)'; x.lineWidth = 22; x.lineCap = 'round';
  x.beginPath(); x.moveTo(-20, h * 0.15); x.bezierCurveTo(w * 0.3, h * 0.3, w * 0.25, h * 0.7, w * 0.55, h * 0.8); x.bezierCurveTo(w * 0.8, h * 0.9, w * 0.9, h * 0.6, w + 20, h * 0.7); x.stroke();
  x.strokeStyle = 'rgba(42,90,97,0.6)'; x.lineWidth = 2; x.stroke();
  // city blocks (ruined)
  for (let i = 0; i < 90; i++) {
    const bx = rng.range(w * 0.08, w * 0.92), by = rng.range(h * 0.12, h * 0.9), bw = rng.range(10, 28), bh = rng.range(8, 22);
    x.fillStyle = rng.pick(['rgba(122,90,60,0.35)', 'rgba(94,70,50,0.3)', 'rgba(142,74,42,0.3)']);
    x.fillRect(bx, by, bw, bh);
    x.strokeStyle = 'rgba(42,26,20,0.4)'; x.lineWidth = 1; x.strokeRect(bx, by, bw, bh);
  }
  // roads
  x.strokeStyle = 'rgba(42,26,20,0.35)'; x.lineWidth = 3; x.setLineDash([2, 6]);
  for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(rng.range(0, w), 0); x.quadraticCurveTo(rng.range(0, w), h / 2, rng.range(0, w), h); x.stroke(); }
  x.setLineDash([]);
  // fog of war regions (other biomes) along the edges
  const regions = [
    { name: 'THE DUSTLANDS', x: w * 0.93, y: h * 0.2, col: 'rgba(196,132,29,0.35)' },
    { name: 'THE FLOOD', x: w * 0.92, y: h * 0.82, col: 'rgba(63,127,134,0.35)' },
    { name: 'THE GREEN', x: w * 0.06, y: h * 0.2, col: 'rgba(122,127,58,0.35)' },
  ];
  for (const r of regions) {
    for (let i = 0; i < 26; i++) daub(x, r.x + rng.range(-90, 90), r.y + rng.range(-70, 70), rng.range(26, 50), r.col.replace('0.35', '0.5'), 0.3, i + 99);
    x.save(); x.translate(r.x, r.y); x.rotate(-0.08);
    x.font = '17px "Luckiest Guy"'; x.textAlign = 'center'; x.fillStyle = 'rgba(42,26,20,0.55)'; x.fillText(r.name, 0, 0);
    x.font = '13px "Patrick Hand"'; x.fillText('beyond the storm wall', 0, 16);
    x.restore();
  }
  // compass rose
  x.save(); x.translate(w * 0.1, h * 0.84);
  x.strokeStyle = 'rgba(42,26,20,0.6)'; x.lineWidth = 2;
  x.beginPath(); x.arc(0, 0, 26, 0, Math.PI * 2); x.stroke();
  x.fillStyle = P.redDark; x.beginPath(); x.moveTo(0, -34); x.lineTo(6, 0); x.lineTo(0, 34); x.lineTo(-6, 0); x.closePath(); x.fill();
  x.fillStyle = P.ink; x.beginPath(); x.moveTo(-34, 0); x.lineTo(0, 6); x.lineTo(34, 0); x.lineTo(0, -6); x.closePath(); x.fill();
  x.font = '14px "Luckiest Guy"'; x.textAlign = 'center'; x.fillText('N', 0, -40);
  x.restore();
  // title
  x.font = '30px "Luckiest Guy"'; x.textAlign = 'center'; x.fillStyle = 'rgba(42,26,20,0.75)'; x.fillText('THE DEAD CITY', w * 0.5, 40);
  // border
  x.strokeStyle = P.ink; x.lineWidth = 4; x.strokeRect(6, 6, w - 12, h - 12);
  x.strokeStyle = 'rgba(42,26,20,0.4)'; x.lineWidth = 1.5; x.strokeRect(14, 14, w - 28, h - 28);
  return { c, w, h };
}

export class MapScene implements Scene {
  t = 0; sel = 0; balloonX = 0; balloonY = 0; selT = 0;
  list: MissionSpec[] = [];
  enter() {
    this.t = 0; Audio.playSong('haven');
    this.list = [...MISSIONS, makeScavenge(Date.now() % 100000)];
    // auto-select first incomplete unlocked mission
    const s = Save.data;
    const idx = this.list.findIndex((m) => this.unlocked(m) && !s.missions[m.id]?.done && !m.free);
    this.sel = idx >= 0 ? idx : 0;
    const pos = this.nodePos(this.list[this.sel]);
    this.balloonX = pos.x; this.balloonY = pos.y;
  }
  unlocked(m: MissionSpec) { return !m.requires || !!Save.data.missions[m.requires]?.done; }
  mapRect() {
    const W = Engine.W, H = Engine.H;
    const cardW = Math.min(330, W * 0.36);
    const mw = W - cardW - 36 - Engine.safe.l - Engine.safe.r, mh = H - 80;
    return { x: 12 + Engine.safe.l, y: 62, w: mw, h: mh - 8, cardW };
  }
  nodePos(m: MissionSpec) { const r = this.mapRect(); return { x: r.x + m.mapPos[0] * r.w, y: r.y + m.mapPos[1] * r.h }; }
  update(dt: number) {
    this.t += dt; this.selT += dt;
    UI.update();
    const p = this.nodePos(this.list[this.sel]);
    this.balloonX = damp(this.balloonX, p.x, 4, dt); this.balloonY = damp(this.balloonY, p.y - 60, 4, dt);
  }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, s = Save.data;
    ctx.fillStyle = '#3b2a20'; ctx.fillRect(0, 0, W, H);
    // wood desk texture
    for (let y = 0; y < H; y += 28) { ctx.fillStyle = y % 56 ? '#43301f' : '#3a2a1c'; ctx.fillRect(0, y, W, 28); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, y + 26, W, 2); }
    const r = this.mapRect();
    if (!mapArt || mapArt.w !== Math.round(r.w) || mapArt.h !== Math.round(r.h)) mapArt = paintMap(Math.round(r.w), Math.round(r.h));
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(r.x + 8, r.y + 10, r.w, r.h); ctx.restore();
    ctx.drawImage(mapArt.c, r.x, r.y);
    // Haven settlement (garage)
    const hv = { x: r.x + r.w * 0.12, y: r.y + r.h * 0.5 };
    pen.use(ctx, 0.6);
    // route lines
    ctx.strokeStyle = P.redDark; ctx.lineWidth = 3; ctx.setLineDash([8, 7]); ctx.lineDashOffset = -this.t * 12;
    ctx.beginPath(); ctx.moveTo(hv.x, hv.y);
    for (const m of MISSIONS) { if (!this.unlocked(m)) break; const p = this.nodePos(m); ctx.lineTo(p.x, p.y); }
    ctx.stroke(); ctx.setLineDash([]);
    // haven icon
    pen.begin().m(hv.x - 22, hv.y + 8).l(hv.x - 22, hv.y - 10).l(hv.x, hv.y - 26).l(hv.x + 22, hv.y - 10).l(hv.x + 22, hv.y + 8).close().ink(P.orange, 2.5);
    pen.begin().rect(hv.x - 6, hv.y - 4, 12, 12).ink(P.brownDark, 2);
    inkText(ctx, 'HAVEN', hv.x, hv.y + 22, 15, P.parchment, { outline: 3 });
    // nodes
    this.list.forEach((m, i) => {
      const p = this.nodePos(m); const un = this.unlocked(m); const rec = s.missions[m.id];
      const selected = i === this.sel;
      const pulse = selected ? 1 + Math.sin(this.t * 5) * 0.06 : 1;
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(pulse, pulse);
      // wax seal
      const col = !un ? '#8b7d70' : m.boss ? P.purple : m.free ? P.teal : rec?.done ? P.olive : P.red;
      pen.begin().smooth(Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2; const rr = 22 + (k % 2 ? 2 : -1); return [Math.cos(a) * rr, Math.sin(a) * rr]; })).ink(col, 3);
      pen.begin().ell(0, 0, 15, 15).stroke(1.5, 'rgba(0,0,0,0.3)');
      const label = !un ? '🔒' : m.boss ? '☠' : m.free ? '∞' : String(i + 1);
      if (!un) { pen.begin().rrect(-7, -3, 14, 11, 2).ink(P.parchmentShade, 2); pen.begin().m(-4, -3).q(-4, -11, 0, -11).q(4, -11, 4, -3).stroke(2); }
      else inkText(ctx, label, 0, 2, 20, P.parchment, { outline: 3, shadow: false });
      if (rec?.done) for (let k = 0; k < 3; k++) star(ctx, -16 + k * 16, 30, 7, k < rec.stars ? P.gold : 'rgba(42,26,20,0.3)');
      ctx.restore();
      UI.button(ctx, 'node' + i, p.x - 30, p.y - 30, 60, 60, '', () => { if (this.sel !== i) { this.sel = i; this.selT = 0; Audio.click(); } }, { style: 'none' });
    });
    // repaint nodes over ghost buttons (ghost draws translucent) — draw names
    this.list.forEach((m, i) => {
      const p = this.nodePos(m);
      if (i === this.sel) inkText(ctx, m.name, p.x, p.y - 38, 16, P.goldLight, { outline: 3 });
    });
    // balloon marker
    drawMenuBalloon(ctx, this.balloonX, this.balloonY + Math.sin(this.t * 2) * 4, 0.28, this.t, { burner: Math.sin(this.t * 2) > 0 ? 0.7 : 0 });
    // ---------- mission card ----------
    const m = this.list[this.sel];
    const cx = W - r.cardW - 12 - Engine.safe.r, cy = 62, cw = r.cardW, ch = H - 74;
    const pop = easeOutBack(clamp(this.selT / 0.3, 0, 1));
    ctx.save(); ctx.translate(cx + cw / 2, cy + ch / 2); ctx.scale(0.95 + pop * 0.05, 0.95 + pop * 0.05); ctx.translate(-cx - cw / 2, -cy - ch / 2);
    panel(ctx, cx, cy, cw, ch, { tape: true, color: P.paper });
    inkText(ctx, m.name.toUpperCase(), cx + cw / 2, cy + 30, 26, m.boss ? P.purple : P.red, { outline: 4 });
    bodyText(ctx, m.subtitle, cx + cw / 2, cy + 54, 15, P.inkSoft, 'center');
    let y = cy + 76;
    const un = this.unlocked(m);
    const brief = un ? `“${m.brief}” — ${m.giver}` : 'Locked. Complete the previous mission to reach this part of the city.';
    for (const ln of wrapText(ctx, brief, cw - 30, 16)) { bodyText(ctx, ln, cx + 16, y, 16, P.ink); y += 18; }
    y += 6;
    if (un) {
      for (const o of m.objectives.slice(0, 4)) {
        pen.begin().rect(cx + 16, y - 6, 11, 11).ink(o.optional ? P.parchment : P.paper, 1.8);
        bodyText(ctx, (o.optional ? '★ ' : '') + o.text, cx + 33, y, 15, o.optional ? P.inkSoft : P.ink); y += 18;
      }
      y += 4;
      // rewards
      bodyText(ctx, 'Reward:', cx + 16, y + 2, 15, P.inkSoft);
      let rx = cx + 72;
      for (const [k, n] of Object.entries(m.rewards)) {
        if (rx > cx + cw - 40) break;
        ctx.save(); ctx.translate(rx + 8, y + 2); ctx.scale(0.7, 0.7); drawItemIcon(ctx, k, 11, this.t); ctx.restore();
        inkText(ctx, String(n), rx + 20, y + 3, 14, P.ink, { outline: 0, shadow: false, align: 'left' }); rx += 46;
      }
      y += 22;
    }
    // provisions toggle
    const canProv = s.res.food >= 1 && s.res.water >= 1;
    const by = cy + ch - 120;
    UI.button(ctx, 'prov', cx + 14, by, cw - 28, 42, s.provisions && canProv ? 'PROVISIONS: PACKED' : 'PROVISIONS: NONE', () => { if (canProv) { s.provisions = !s.provisions; Save.write(); } else Audio.deny(); },
      { style: s.provisions && canProv ? 'olive' : 'paper', size: 15, sub: canProv ? '1 food + 1 water → +30% fuel, +1 patch' : 'Need 1 food + 1 water', enabled: true });
    UI.button(ctx, 'launch', cx + 14, by + 50, cw - 28, 56, un ? (s.missions[m.id]?.done && !m.free ? 'FLY AGAIN' : 'LAUNCH!') : 'LOCKED', () => { if (!un) return; Audio.ignite(); go(Scenes.play, { mission: m }); }, { style: 'red', size: 28, enabled: un, keys: ['Enter'] });
    ctx.restore();
    // ---------- top bar ----------
    resourceBar(ctx, 12 + Engine.safe.l, 10);
    const affordable = UPGRADES.some((u) => { const lv = s.levels[u.id] ?? 0; return lv < u.costs.length && (!u.requires || s.levels[u.requires]) && canAfford(u.costs[lv]); });
    const gw = 150;
    UI.button(ctx, 'garage', W - gw - 70 - Engine.safe.r, 8, gw, 44, 'GARAGE', () => go(Scenes.garage), { style: 'teal', size: 20, keys: ['KeyG'] });
    if (affordable) { const k = Math.sin(this.t * 6) > 0; inkText(ctx, 'NEW!', W - 80 - Engine.safe.r, 12, 15, k ? P.goldLight : P.gold, { outline: 3 }); }
    UI.button(ctx, 'home', W - 58 - Engine.safe.r, 8, 46, 44, '⌂', () => go(Scenes.title), { style: 'brass', size: 22, keys: ['Escape'] });
    if (Engine.portrait) drawRotate(ctx, W, H, this.t);
    fadeIn(ctx, this.t, W, H, 0.01);
  }
}

export function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  const pts: number[][] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; const rr = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  pen.begin().poly(pts).ink(col, 1.8);
}
