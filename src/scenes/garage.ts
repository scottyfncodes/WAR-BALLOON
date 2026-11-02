import { Engine, type Scene } from '../core/engine';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { pen, inkText, bodyText, wrapText, makeCanvas, daub } from '../render/ink';
import { clamp, RNG, easeOutBack, rand } from '../core/math';
import { UI, panel, fadeIn } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { CATEGORIES, UPGRADES, type Category, type UpgradeDef } from '../game/upgrades';
import { resourceBar, drawMenuBalloon, costRow, canAfford, pay } from './common';
import { drawItemIcon } from '../game/entities';
import { PAINTS } from '../render/balloonArt';
import { TRADES } from '../game/trades';
import { BIOMES, CAMP_NAMES } from '../game/biomes';
import { regionUnlocked } from './map';
import { RES_KEYS } from '../game/upgrades';
import { FX } from '../game/fx';
import { drawRotate } from './play';

const QUIPS = [
  'Granny Gert: "Bolt it, patch it, pray it holds."',
  'Granny Gert: "That burner sounds like a sick goose. I love it."',
  'Granny Gert: "Bring me scrap and I\'ll bring you miracles."',
  'Granny Gert: "Don\'t touch the red wire. Or do. I\'m not your mother."',
  'Granny Gert: "Every patch on that bag is a story, Jerry."',
];

let hangar: { c: HTMLCanvasElement; W: number } | null = null;
function paintHangar(W: number, H: number) {
  const [c, x] = makeCanvas(W, H);
  const rng = new RNG(42);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#5a3f2b'); g.addColorStop(1, '#2f2018');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // plank wall
  for (let px = 0; px < W; px += 46) {
    x.fillStyle = rng.pick(['#6b4a31', '#614330', '#704e35', '#5e412d']); x.fillRect(px, 0, 44, H);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px + 44, 0, 2, H);
    for (let k = 0; k < 3; k++) daub(x, px + 22, rng.range(0, H), 18, '#4a3322', 0.2, rng.next() * 99);
    x.fillStyle = '#3a2a1c'; x.beginPath(); x.arc(px + 8, rng.range(40, H - 40), 2, 0, 7); x.fill();
  }
  // big window with sky
  const wx = W * 0.08, wy = 60, ww = W * 0.36, wh = H * 0.5;
  const sg = x.createLinearGradient(0, wy, 0, wy + wh); sg.addColorStop(0, '#6aa7a8'); sg.addColorStop(1, '#f0c27a');
  x.fillStyle = sg; x.fillRect(wx, wy, ww, wh);
  x.fillStyle = 'rgba(120,130,150,0.6)'; for (let i = 0; i < 8; i++) { const bw = rng.range(20, 50), bh = rng.range(30, wh * 0.6); x.fillRect(wx + i * ww / 8, wy + wh - bh, bw, bh); }
  x.strokeStyle = '#2a1a14'; x.lineWidth = 8; x.strokeRect(wx, wy, ww, wh);
  x.lineWidth = 5; x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.moveTo(wx, wy + wh / 2); x.lineTo(wx + ww, wy + wh / 2); x.stroke();
  // tools on pegboard
  x.save(); x.translate(W * 0.47, 90);
  x.fillStyle = '#8a6a50'; x.fillRect(0, 0, 120, 150); x.strokeStyle = '#2a1a14'; x.lineWidth = 3; x.strokeRect(0, 0, 120, 150);
  x.fillStyle = '#5e412d'; for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) { x.beginPath(); x.arc(12 + i * 19, 12 + j * 20, 1.5, 0, 7); x.fill(); }
  x.strokeStyle = '#7d8a8c'; x.lineWidth = 5; x.beginPath(); x.moveTo(20, 20); x.lineTo(20, 90); x.stroke();
  x.beginPath(); x.moveTo(50, 20); x.lineTo(60, 100); x.stroke();
  x.strokeStyle = '#b8433a'; x.lineWidth = 7; x.beginPath(); x.moveTo(90, 30); x.lineTo(90, 70); x.stroke();
  x.restore();
  // floor
  x.fillStyle = '#2a1d14'; x.fillRect(0, H * 0.82, W, H * 0.18);
  x.fillStyle = 'rgba(255,220,160,0.08)'; x.beginPath(); x.ellipse(W * 0.27, H * 0.84, W * 0.22, 18, 0, 0, 7); x.fill();
  // hanging lamp glow
  const lg = x.createRadialGradient(W * 0.27, 30, 10, W * 0.27, 200, H * 0.8);
  lg.addColorStop(0, 'rgba(255,220,150,0.35)'); lg.addColorStop(1, 'rgba(255,220,150,0)');
  x.fillStyle = lg; x.fillRect(0, 0, W, H);
  // beams
  x.fillStyle = '#3a2a1c'; x.fillRect(0, 0, W, 22); x.fillRect(0, 22, W, 6);
  return c;
}

export class GarageScene implements Scene {
  t = 0; cat: Category | 'paint' | 'trade' = 'balloon'; fx = new FX(); celebrate = 0; quip = 0; flash: Record<string, number> = {}; lastBought = '';
  scroll = 0;
  enter() { this.t = 0; Audio.playSong('haven'); this.quip = Math.floor(rand(0, QUIPS.length)); this.celebrate = 0; }
  update(dt: number) {
    this.t += dt; UI.update(); this.fx.update(dt); this.celebrate = Math.max(0, this.celebrate - dt);
    for (const k of Object.keys(this.flash)) this.flash[k] = Math.max(0, this.flash[k] - dt * 2);
  }
  buy(u: UpgradeDef) {
    const s = Save.data; const lv = s.levels[u.id] ?? 0;
    if (lv >= u.costs.length) return;
    const cost = u.costs[lv];
    if (!canAfford(cost) || (u.requires && !s.levels[u.requires])) { Audio.deny(); return; }
    pay(cost); s.levels[u.id] = lv + 1; Save.write();
    for (const k of Object.keys(cost)) this.flash[k] = 1;
    Audio.buy(); Audio.voice('woo');
    this.celebrate = 1.6; this.lastBought = u.name;
    const W = Engine.W, H = Engine.H;
    this.fx.confetti(W * 0.27, H * 0.45, 40);
    this.fx.burst(W * 0.27, H * 0.2, 'UPGRADED!', 30);
  }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, s = Save.data;
    if (!hangar || hangar.W !== W) hangar = { c: paintHangar(W, H), W };
    ctx.drawImage(hangar.c, 0, 0);
    // preview balloon
    const px = Math.max(W * 0.24, 150 + Engine.safe.l), py = H * 0.86;
    const cel = this.celebrate;
    const hop = cel > 0 ? Math.abs(Math.sin(cel * 8)) * 10 * cel : 0;
    drawMenuBalloon(ctx, px, py - 40 - hop + Math.sin(this.t * 1.4) * 4, 1.12, this.t, {
      burner: cel > 0 ? 1 : (Math.sin(this.t * 0.8) > 0.6 ? 0.6 : 0), expr: cel > 0 ? 'cheer' : 'happy', arm: cel > 0 ? 'cheer' : (this.t % 7 < 1.5 ? 'wave' : 'rest'), wobble: cel > 0 ? cel * 0.6 : 0,
      squash: cel > 0 ? Math.sin(cel * 14) * 0.08 : 0,
    });
    // Haven residents (rescued survivors)
    const pop = Math.min(8, s.population);
    for (let i = 0; i < pop; i++) {
      const sx = px + 110 + (i % 4) * 26 + (i >= 4 ? 13 : 0), sy = H * 0.86 - (i >= 4 ? 18 : 0);
      if (sx > W - Math.min(560, W * 0.56) - 30) break;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(1.1, 1.1);
      const coats = [P.teal, P.olive, P.purple, P.red];
      const wv = Math.sin(this.t * 6 + i * 1.3) * 4;
      pen.begin().m(-6, 0).q(-7, -14, 0, -15).q(7, -14, 6, 0).close().ink(coats[i % 4], 2);
      if (i % 3 === 0) pen.begin().m(5, -11).l(10, -22 + wv).stroke(2.6);
      pen.begin().ell(0, -21, 6, 6).ink(P.skin, 1.8);
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(-2, -21, 1, 0, 7); ctx.arc(2, -21, 1, 0, 7); ctx.fill();
      ctx.restore();
    }
    if (s.population > 0) bodyText(ctx, `Haven pop. ${s.population} · +${Math.min(12, s.population)} scrap each mission`, px, H - 50, 15, P.parchment, 'center');
    // granny's quip
    const qText = this.celebrate > 0 ? `Granny Gert: "${this.lastBought}! Now THAT's engineering!"` : QUIPS[this.quip];
    const qw = Math.min(330, W * 0.38);
    const ql = wrapText(ctx, qText, qw - 24, 16);
    panel(ctx, 14 + Engine.safe.l, 60, qw, 16 + ql.length * 18, { color: P.paper, rot: -0.015 });
    ql.forEach((l, i) => bodyText(ctx, l, 26 + Engine.safe.l, 76 + i * 18, 16, P.ink));
    // ---------- right panel ----------
    const rw = Math.min(560, W * 0.56), rx = W - rw - 12 - Engine.safe.r, ry = 60, rh = H - 70;
    panel(ctx, rx, ry, rw, rh, { color: P.parchment, tape: true });
    // tabs
    const tabs: { id: Category | 'paint' | 'trade'; name: string }[] = [...CATEGORIES.map((c) => ({ id: c.id, name: c.id === 'propulsion' ? 'Engine' : c.id === 'retrieval' ? 'Hook' : c.id === 'firepower' ? 'Bombs' : c.name })), { id: 'paint', name: 'Paint' }, { id: 'trade', name: 'Trade' }];
    const tw = (rw - 20) / tabs.length;
    tabs.forEach((tb, i) => {
      const active = this.cat === tb.id;
      UI.button(ctx, 'tab' + tb.id, rx + 10 + i * tw, ry + 10, tw - 4, 36, tb.name.toUpperCase(), () => { this.cat = tb.id; this.scroll = 0; }, { style: active ? 'red' : 'paper', size: tw < 90 ? 12 : 14 });
    });
    const listY = ry + 56;
    if (this.cat === 'paint') this.drawPaints(ctx, rx, listY, rw);
    else if (this.cat === 'trade') this.drawTrades(ctx, rx, listY, rw, rh - 66);
    else {
      const ups = UPGRADES.filter((u) => u.cat === this.cat);
      const blurb = CATEGORIES.find((c) => c.id === this.cat)!.blurb;
      bodyText(ctx, blurb, rx + rw / 2, listY + 4, 15, P.inkSoft, 'center');
      const ch = Math.min(98, (rh - 76) / ups.length - 6);
      ups.forEach((u, i) => this.drawCard(ctx, u, rx + 12, listY + 16 + i * (ch + 6), rw - 24, ch));
    }
    // ---------- top bar ----------
    resourceBar(ctx, 12 + Engine.safe.l, 10, this.flash);
    UI.button(ctx, 'map', W - 170 - Engine.safe.r, 8, 158, 44, 'TO THE MAP', () => go(Scenes.map), { style: 'olive', size: 18, keys: ['Escape', 'KeyM'] });
    inkText(ctx, 'HAVEN GARAGE', W * 0.27, H - 22, 22, P.parchment, { outline: 4 });
    this.fx.draw(ctx); this.fx.drawText(ctx);
    if (Engine.portrait) drawRotate(ctx, W, H, this.t);
    fadeIn(ctx, this.t, W, H, 0.01);
  }
  private drawCard(ctx: CanvasRenderingContext2D, u: UpgradeDef, x: number, y: number, w: number, h: number) {
    const s = Save.data; const lv = s.levels[u.id] ?? 0; const max = u.costs.length;
    const maxed = lv >= max;
    const locked = !!u.requires && !s.levels[u.requires];
    pen.use(ctx, 0.5);
    pen.begin().rrect(x, y, w, h, 8).ink(maxed ? '#e7d9a8' : P.paper, 2.4);
    inkText(ctx, u.name.toUpperCase(), x + 12, y + 18, 18, maxed ? P.olive : P.ink, { align: 'left', outline: 0, shadow: false });
    // level pips
    for (let i = 0; i < max; i++) { pen.begin().rect(x + 14 + i * 18, y + 32, 13, 9).ink(i < lv ? P.orange : 'rgba(42,26,20,0.15)', 1.6); }
    const desc = maxed ? u.desc[max - 1] : u.desc[lv];
    const lines = wrapText(ctx, (maxed ? 'MAXED — ' : `Lv ${lv + 1}: `) + desc, w - 170, 15);
    lines.slice(0, Math.max(1, Math.floor((h - 46) / 16))).forEach((l, i) => bodyText(ctx, l, x + 14, y + 54 + i * 16, 15, P.inkSoft));
    if (!maxed) {
      const cost = u.costs[lv];
      const afford = canAfford(cost) && !locked;
      const bw = 136, bh = Math.min(44, h - 34);
      ctx.save(); ctx.fillStyle = 'rgba(42,26,20,0.85)'; ctx.fillRect(x + w - bw - 12, y + 8, bw, 22); ctx.restore();
      costRow(ctx, cost, x + w - bw - 8, y + 19, 14);
      UI.button(ctx, 'buy' + u.id, x + w - bw - 12, y + h - bh - 8, bw, bh, locked ? 'NEEDS RACK' : afford ? 'UPGRADE' : 'NEED MORE', () => this.buy(u), { style: afford ? 'red' : 'paper', size: 15, enabled: afford });
    } else {
      inkText(ctx, '✓', x + w - 40, y + h / 2, 30, P.olive, { outline: 3 });
    }
  }
  private drawTrades(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const s = Save.data;
    const open = TRADES.filter((t) => regionUnlocked(BIOMES[t.camp]));
    bodyText(ctx, 'Swap supplies with the camps you\'ve reached. New camps open new deals.', x + w / 2, y + 4, 15, P.inkSoft, 'center');
    const rows = Math.ceil(open.length / 2), cw = (w - 32) / 2, ch = Math.min(84, (h - 24) / Math.max(1, rows) - 6);
    open.forEach((t, i) => {
      const cx = x + 12 + (i % 2) * (cw + 8), cy = y + 18 + Math.floor(i / 2) * (ch + 6);
      pen.use(ctx, 0.5); pen.begin().rrect(cx, cy, cw, ch, 8).ink(P.paper, 2.2);
      inkText(ctx, CAMP_NAMES[t.camp], cx + 10, cy + 14, 13, P.redDark, { align: 'left', outline: 0, shadow: false });
      bodyText(ctx, '“' + t.line + '”', cx + 10, cy + 31, 13, P.inkSoft);
      ctx.save(); ctx.fillStyle = 'rgba(42,26,20,0.85)'; ctx.fillRect(cx + 8, cy + ch - 30, cw - 104, 24); ctx.restore();
      const gw2 = costRow(ctx, t.give, cx + 10, cy + ch - 18, 13);
      inkText(ctx, '→', cx + 16 + gw2, cy + ch - 17, 14, P.gold, { outline: 2, shadow: false, align: 'left' });
      let gx = cx + 36 + gw2;
      for (const k of RES_KEYS) { const n = t.get[k]; if (!n) continue; ctx.save(); ctx.translate(gx + 8, cy + ch - 18); ctx.scale(0.65, 0.65); drawItemIcon(ctx, k, 11, 0); ctx.restore(); inkText(ctx, '+' + n, gx + 18, cy + ch - 17, 13, P.goldLight, { align: 'left', outline: 3, shadow: false }); gx += 44; }
      const ok = canAfford(t.give);
      UI.button(ctx, 'trade' + t.id, cx + cw - 90, cy + ch - 38, 80, 32, 'TRADE', () => {
        if (!canAfford(t.give)) { Audio.deny(); return; }
        pay(t.give); for (const k of RES_KEYS) s.res[k] += t.get[k] ?? 0; Save.write();
        for (const k of Object.keys(t.get)) this.flash[k] = 1;
        Audio.coin(); Audio.pickup('scrap'); this.fx.popup(cx + cw / 2, cy + 10, 'DEAL!', P.gold, 18);
      }, { style: ok ? 'olive' : 'paper', size: 14, enabled: ok });
    });
  }
  private drawPaints(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
    const s = Save.data;
    bodyText(ctx, 'Cosmetic paint jobs — earned on your travels.', x + w / 2, y + 4, 15, P.inkSoft, 'center');
    const req: Record<string, string> = { classic: 'Jerry\'s original', teal: 'Complete "Scrap Happy"', sunset: 'Find 3 lost postcards', storm: 'Defeat Big Bertha', dune: 'Beat the Dune Dredger', sea: 'Sink Old Salty', ivy: 'Dethrone the Bramble King', glacier: 'Shatter the Icebreaker', ember: 'Defeat the Scrap Baron' };
    const cols = 3, cw = (w - 24 - (cols - 1) * 8) / cols, ch = 128;
    PAINTS.forEach((p, i) => {
      const cx = x + 12 + (i % cols) * (cw + 8), cy = y + 16 + Math.floor(i / cols) * (ch + 6);
      const owned = s.paintsUnlocked.includes(p.id);
      const on = s.paint === p.id;
      pen.use(ctx, 0.5);
      pen.begin().rrect(cx, cy, cw, ch, 8).ink(on ? '#f3e2a5' : P.paper, on ? 3.5 : 2.4);
      ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
      drawMenuBalloon(ctx, cx + 36, cy + ch - 12, 0.36, this.t + i, { paint: p.id, flash: !owned });
      ctx.restore();
      inkText(ctx, p.name.toUpperCase(), cx + 72, cy + 20, 13, P.ink, { align: 'left', outline: 0, shadow: false });
      const ls = wrapText(ctx, owned ? (on ? 'Currently flying' : 'Unlocked') : req[p.id], cw - 78, 13);
      ls.slice(0, 3).forEach((l, k) => bodyText(ctx, l, cx + 72, cy + 40 + k * 14, 13, owned ? P.oliveDark : P.redDark));
      if (owned && !on) UI.button(ctx, 'paint' + p.id, cx + 70, cy + ch - 42, cw - 78, 34, 'PAINT', () => { s.paint = p.id; Save.write(); Audio.buy(); this.celebrate = 1.2; this.lastBought = p.name; }, { style: 'teal', size: 15 });
    });
    void clamp; void easeOutBack;
  }
}
