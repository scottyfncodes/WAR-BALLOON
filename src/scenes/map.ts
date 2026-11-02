import { Engine, type Scene } from '../core/engine';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { pen, inkText, bodyText, wrapText, makeCanvas, grain, daub } from '../render/ink';
import { clamp, RNG, damp, easeOutBack } from '../core/math';
import { UI, panel, fadeIn } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { MISSIONS, makeScavenge, missionsIn } from '../game/missions';
import { BIOMES, BIOME_ORDER, type BiomeId, type Biome } from '../game/biomes';
import type { MissionSpec } from '../game/types';
import { resourceBar, drawMenuBalloon, canAfford } from './common';
import { UPGRADES } from '../game/upgrades';
import { drawItemIcon } from '../game/entities';
import { drawRotate } from './play';

let mapArt: { c: HTMLCanvasElement; w: number; h: number; id: string } | null = null;
export const CAMPS: Record<BiomeId, string> = { city: 'HAVEN', dust: 'CARAVAN', flood: 'FERRY RAFT', green: 'GREENHOUSE', frozen: 'STATION', ash: 'FORWARD CAMP' };
const SHORT: Record<BiomeId, string> = { city: 'CITY', dust: 'DUST', flood: 'FLOOD', green: 'GREEN', frozen: 'FROZEN', ash: 'ASH' };
export const regionUnlocked = (b: Biome) => !b.requires || !!Save.data.missions[b.requires]?.done;

function paintMap(w: number, h: number, b: Biome) {
  const [c, x] = makeCanvas(w, h);
  const rng = new RNG(808);
  // parchment base
  x.fillStyle = P.parchment; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 120; i++) daub(x, rng.range(0, w), rng.range(0, h), rng.range(20, 70), rng.chance(0.5) ? P.parchmentDark : '#f6e8c8', 0.25, i);
  x.fillStyle = x.createPattern(grain(), 'repeat')!; x.globalAlpha = 0.8; x.fillRect(0, 0, w, h); x.globalAlpha = 1;
  x.fillStyle = b.mapTint; x.fillRect(0, 0, w, h);
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
  // region doodles
  for (let i = 0; i < 26; i++) {
    const dx = rng.range(30, w - 30), dy = rng.range(60, h - 30);
    x.save(); x.translate(dx, dy); x.strokeStyle = 'rgba(42,26,20,0.45)'; x.fillStyle = 'rgba(42,26,20,0.25)'; x.lineWidth = 1.5;
    switch (b.id) {
      case 'dust': x.beginPath(); x.moveTo(-18, 0); x.quadraticCurveTo(0, -12, 18, 0); x.stroke(); break;
      case 'flood': x.beginPath(); x.moveTo(-14, 0); x.quadraticCurveTo(-7, -5, 0, 0); x.quadraticCurveTo(7, 5, 14, 0); x.stroke(); break;
      case 'green': x.fillStyle = 'rgba(80,120,40,0.4)'; x.beginPath(); x.arc(0, 0, 8, 0, 7); x.arc(8, 4, 6, 0, 7); x.fill(); break;
      case 'frozen': x.beginPath(); for (let k = 0; k < 3; k++) { x.rotate(Math.PI / 3); x.moveTo(-7, 0); x.lineTo(7, 0); } x.stroke(); break;
      case 'ash': x.fillStyle = 'rgba(160,60,30,0.4)'; x.beginPath(); x.moveTo(-12, 6); x.lineTo(0, -12); x.lineTo(12, 6); x.fill(); break;
      default: break;
    }
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
  x.font = '30px "Luckiest Guy"'; x.textAlign = 'center'; x.fillStyle = 'rgba(42,26,20,0.75)'; x.fillText(b.name.toUpperCase(), w * 0.5, 40);
  // border
  x.strokeStyle = P.ink; x.lineWidth = 4; x.strokeRect(6, 6, w - 12, h - 12);
  x.strokeStyle = 'rgba(42,26,20,0.4)'; x.lineWidth = 1.5; x.strokeRect(14, 14, w - 28, h - 28);
  return { c, w, h };
}

export class MapScene implements Scene {
  t = 0; sel = 0; balloonX = 0; balloonY = 0; selT = 0;
  list: MissionSpec[] = [];
  region: BiomeId = 'city'; introT = 0;
  setRegion(id: BiomeId) {
    this.region = id;
    const b = BIOMES[id];
    const first = missionsIn(id)[0];
    const scav = makeScavenge(Date.now() % 100000, id);
    scav.requires = first.id;
    this.list = [...missionsIn(id), scav];
    const s = Save.data;
    const idx = this.list.findIndex((m) => this.unlocked(m) && !s.missions[m.id]?.done && !m.free);
    this.sel = idx >= 0 ? idx : 0; this.selT = 0;
    const pos = this.nodePos(this.list[this.sel]); this.balloonX = pos.x; this.balloonY = pos.y - 60;
    if (!s.seenRegions.includes(id) && b.intro) { this.introT = 0.001; }
    Audio.playSong(id === 'city' ? 'haven' : b.music);
  }
  enter() {
    this.t = 0; Audio.playSong('haven');
    // open the furthest unlocked region
    const open = BIOME_ORDER.filter((id) => regionUnlocked(BIOMES[id]));
    const s = Save.data;
    const pick = open.find((id) => missionsIn(id).some((m) => !s.missions[m.id]?.done)) ?? open[open.length - 1];
    this.setRegion(pick);
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
    if (!mapArt || mapArt.w !== Math.round(r.w) || mapArt.h !== Math.round(r.h) || mapArt.id !== this.region) mapArt = { ...paintMap(Math.round(r.w), Math.round(r.h), BIOMES[this.region]), id: this.region };
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(r.x + 8, r.y + 10, r.w, r.h); ctx.restore();
    ctx.drawImage(mapArt.c, r.x, r.y);
    // Haven settlement (garage)
    const hv = { x: r.x + r.w * 0.12, y: r.y + r.h * 0.5 };
    pen.use(ctx, 0.6);
    // route lines
    ctx.strokeStyle = P.redDark; ctx.lineWidth = 3; ctx.setLineDash([8, 7]); ctx.lineDashOffset = -this.t * 12;
    ctx.beginPath(); ctx.moveTo(hv.x, hv.y);
    for (const m of this.list) { if (m.free || !this.unlocked(m)) break; const p = this.nodePos(m); ctx.lineTo(p.x, p.y); }
    ctx.stroke(); ctx.setLineDash([]);
    // haven icon
    pen.begin().m(hv.x - 22, hv.y + 8).l(hv.x - 22, hv.y - 10).l(hv.x, hv.y - 26).l(hv.x + 22, hv.y - 10).l(hv.x + 22, hv.y + 8).close().ink(P.orange, 2.5);
    pen.begin().rect(hv.x - 6, hv.y - 4, 12, 12).ink(P.brownDark, 2);
    inkText(ctx, CAMPS[this.region], hv.x, hv.y + 22, 15, P.parchment, { outline: 3 });
    const reqLeft = 3 - (s.camps[this.region] ?? 0);
    UI.button(ctx, 'camp', hv.x - 40, hv.y + 34, 80, 28, 'VISIT', () => go(Scenes.camp, { region: this.region }), { style: 'brass', size: 13 });
    if (reqLeft > 0 && Math.sin(this.t * 5) > 0) inkText(ctx, '!', hv.x + 28, hv.y - 24, 20, P.redBright, { outline: 4 });
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
    // ---------- region tabs ----------
    const tw = Math.min(118, (r.w - 24) / BIOME_ORDER.length);
    BIOME_ORDER.forEach((id, i) => {
      const b = BIOMES[id]; const un = regionUnlocked(b); const on = id === this.region;
      const done = missionsIn(id).every((m) => s.missions[m.id]?.done);
      UI.button(ctx, 'reg' + id, r.x + 12 + i * tw, r.y + r.h - 46, tw - 6, 36, un ? SHORT[id] + (done ? ' ✓' : '') : '🔒', () => { if (un) { this.setRegion(id); Audio.click(); } else Audio.deny(); }, { style: on ? 'red' : un ? 'paper' : 'ghost', size: tw < 90 ? 12 : 15 });
    });
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
    if (s.missions.m1?.done && Object.keys(s.levels).length === 0 && affordable) {
      // coach mark: point at the garage the first time you can afford something
      const gx = W - gw - 70 - Engine.safe.r - 14 + Math.sin(this.t * 6) * 5, gy = 30;
      panel(ctx, gx - 214, gy - 16, 180, 32, { color: P.paper });
      bodyText(ctx, 'Spend your scrap here!', gx - 124, gy, 16, P.ink, 'center');
      pen.begin().ell(gx - 20, gy, 11, 9).ink(P.glove, 2.5);
      pen.begin().m(gx - 12, gy - 2).l(gx + 2, gy - 2).stroke(5, P.ink); pen.begin().m(gx - 12, gy - 2).l(gx + 1, gy - 2).stroke(3, P.glove);
    }
    UI.button(ctx, 'home', W - 58 - Engine.safe.r, 8, 46, 44, '⌂', () => go(Scenes.title), { style: 'brass', size: 22, keys: ['Escape'] });
    if (this.introT > 0) this.drawRegionIntro(ctx, W, H);
    if (Engine.portrait) drawRotate(ctx, W, H, this.t);
    fadeIn(ctx, this.t, W, H, 0.01);
  }
  private drawRegionIntro(ctx: CanvasRenderingContext2D, W: number, H: number) {
    this.introT += 1 / 60;
    UI.begin(); // modal: only the card's button is clickable
    const b = BIOMES[this.region];
    ctx.fillStyle = 'rgba(20,12,8,0.65)'; ctx.fillRect(0, 0, W, H);
    const k = easeOutBack(clamp(this.introT / 0.4, 0, 1));
    const pw = Math.min(520, W - 60), ph = 260, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
    panel(ctx, px, py, pw, ph, { tape: true, color: P.paper });
    bodyText(ctx, 'NEW REGION', W / 2, py + 30, 18, P.redDark, 'center');
    inkText(ctx, b.name.toUpperCase(), W / 2, py + 66, 38, P.orange, { outline: 6 });
    bodyText(ctx, b.tagline, W / 2, py + 98, 18, P.inkSoft, 'center');
    wrapText(ctx, b.intro, pw - 50, 17).forEach((l, i) => bodyText(ctx, l, W / 2, py + 130 + i * 20, 17, P.ink, 'center'));
    UI.button(ctx, 'introok', W / 2 - 90, py + ph - 62, 180, 48, 'LET\'S FLY!', () => { this.introT = 0; if (!Save.data.seenRegions.includes(this.region)) { Save.data.seenRegions.push(this.region); Save.write(); } }, { style: 'red', size: 22, keys: ['Enter', 'Escape'] });
    ctx.restore();
  }
}

export function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  const pts: number[][] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2; const rr = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  pen.begin().poly(pts).ink(col, 1.8);
}
