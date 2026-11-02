import { Engine, type Scene } from '../core/engine';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { pen, inkText, bodyText, wrapText, makeCanvas, daub } from '../render/ink';
import { clamp, RNG, rand } from '../core/math';
import { UI, panel, fadeIn } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { CATEGORIES, UPGRADES, computeStats, upgradeName, type Category, type UpgradeDef } from '../game/upgrades';
import { DECOR, DECOR_SLOTS, TROPHIES, type Decor, type DecorSlot } from '../game/cosmetics';
import { BIOME_ORDER } from '../game/biomes';
import { resourceBar, drawMenuAirship, costRow, canAfford, pay } from './common';
import { drawTrophyMini } from '../render/airshipArt';
import { FX } from '../game/fx';
import { drawRotate } from './play';

const QUIPS = [
  'Granny Gert: "Bolt it, patch it, pray it holds."',
  'Granny Gert: "Bigger basket, more mouths. More hands, too."',
  'Granny Gert: "Bring me scrap and I\'ll bring you miracles."',
  'Granny Gert: "Spikes on the rim. Let \'em try climbing THAT."',
  'Granny Gert: "Every patch on that bag is a story, Jerry."',
];

let hangar: { c: HTMLCanvasElement; W: number } | null = null;
function paintHangar(W: number, H: number) {
  const [c, x] = makeCanvas(W, H);
  const rng = new RNG(42);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5a3f2b'); g.addColorStop(1, '#2f2018');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let px = 0; px < W; px += 46) {
    x.fillStyle = rng.pick(['#6b4a31', '#614330', '#704e35', '#5e412d']); x.fillRect(px, 0, 44, H);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px + 44, 0, 2, H);
    for (let k = 0; k < 3; k++) daub(x, px + 22, rng.range(0, H), 18, '#4a3322', 0.2, rng.next() * 99);
  }
  x.fillStyle = '#2a1d14'; x.fillRect(0, H * 0.86, W, H * 0.14);
  const lg = x.createRadialGradient(W * 0.22, 30, 10, W * 0.22, 220, H * 0.8); lg.addColorStop(0, 'rgba(255,220,150,0.35)'); lg.addColorStop(1, 'rgba(255,220,150,0)');
  x.fillStyle = lg; x.fillRect(0, 0, W, H);
  x.fillStyle = '#3a2a1c'; x.fillRect(0, 0, W, 22);
  return c;
}

type Tab = Category | 'decor';

export class WorkshopScene implements Scene {
  t = 0; tab: Tab = 'envelope'; slot: DecorSlot = 'paint'; page = 0; sel = ''; fx = new FX(); celebrate = 0; quip = 0; flash: Record<string, number> = {}; lastBought = '';
  enter(d?: { tab?: Tab }) { this.t = 0; this.page = 0; this.sel = ''; this.tab = d?.tab ?? 'envelope'; Audio.playSong('haven'); this.quip = Math.floor(rand(0, QUIPS.length)); }
  update(dt: number) {
    this.t += dt; UI.update(); this.fx.update(dt); this.celebrate = Math.max(0, this.celebrate - dt);
    for (const k of Object.keys(this.flash)) this.flash[k] = Math.max(0, this.flash[k] - dt * 2);
  }
  regionOk(u: UpgradeDef) { return !u.region || Save.regionUnlocked(u.region, BIOME_ORDER); }
  reqOk(u: UpgradeDef) { return !u.requires || (Save.data.levels[u.requires[0]] ?? 0) >= u.requires[1]; }
  buy(u: UpgradeDef) {
    const s = Save.data; const lv = s.levels[u.id] ?? 0;
    if (lv >= u.costs.length) return;
    const cost = u.costs[lv];
    if (!canAfford(cost) || !this.regionOk(u) || !this.reqOk(u)) { Audio.deny(); return; }
    pay(cost); s.levels[u.id] = lv + 1; Save.write();
    for (const k of Object.keys(cost)) this.flash[k] = 1;
    Audio.buy(); Audio.voice('woo');
    this.celebrate = 1.6; this.lastBought = upgradeName(u, lv + 1); this.sel = '';
    const W = Engine.W, H = Engine.H;
    this.fx.confetti(W * 0.22, H * 0.45, 40); this.fx.burst(W * 0.22, H * 0.18, 'UPGRADED!', 30);
  }
  buyDecor(d: Decor) {
    const s = Save.data;
    if (s.owned.includes(d.id)) { s.decor[d.slot] = d.id; Save.write(); Audio.click(); this.sel = ''; return; }
    if (!canAfford(d.cost)) { Audio.deny(); return; }
    if (d.slot === 'furniture' && computeStats(s.levels).tier < 1) { Audio.deny(); return; }
    pay(d.cost); s.owned.push(d.id); s.decor[d.slot] = d.id; Save.write();
    Audio.buy(); this.celebrate = 1.2; this.lastBought = d.name; this.sel = '';
    this.fx.confetti(Engine.W * 0.22, Engine.H * 0.45, 24);
  }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, s = Save.data, t = this.t;
    if (!hangar || hangar.W !== W) hangar = { c: paintHangar(W, H), W };
    ctx.drawImage(hangar.c, 0, 0);
    const T = 8 + Engine.safe.t * 0.5, Lx = 10 + Engine.safe.l;
    // ---- preview ----
    const levels = { ...s.levels };
    let decor = { ...s.decor };
    const selU = UPGRADES.find((u) => u.id === this.sel);
    const selD = DECOR.find((d) => d.id === this.sel);
    if (selU && (levels[selU.id] ?? 0) < selU.costs.length) levels[selU.id] = (levels[selU.id] ?? 0) + 1;
    if (selD) decor = { ...decor, [selD.slot]: selD.id };
    const st = computeStats(levels);
    const leftW = W * 0.42;
    const px = Lx + leftW * 0.48, py = H * 0.8;
    const scale = [1.2, 1.1, 0.95, 0.86, 0.74][st.tier];
    const cel = this.celebrate, hop = cel > 0 ? Math.abs(Math.sin(cel * 8)) * 10 * cel : 0;
    drawMenuAirship(ctx, px, py - 20 * scale - hop + Math.sin(t * 1.4) * 4, scale, t, { decor, burner: cel > 0 ? 1 : (Math.sin(t * 0.8) > 0.6 ? 0.6 : 0), expr: cel > 0 ? 'cheer' : 'happy', arm: cel > 0 ? 'cheer' : 'rest', wobble: cel * 0.5, gunAim: Math.sin(t) * 0.6 + 0.4, ladder: selU?.id === 'ladder' ? 60 + Math.sin(t * 2) * 10 : 0, flaming: selU?.id === 'flamer' && Math.sin(t * 2) > 0.3 ? 1 : 0 }, levels);
    if (selU || selD) inkText(ctx, 'PREVIEW', px, T + 64, 18, P.goldLight, { outline: 4 });
    // stats block
    const cur = computeStats(s.levels);
    const statLine = (label: string, a: number | string, b: number | string, y: number) => { bodyText(ctx, label, Lx + 8, y, 14, P.parchment); inkText(ctx, String(b), Lx + 128, y, 14, a !== b ? P.goldLight : P.parchment, { align: 'left', outline: 3, shadow: false }); };
    const sy = H - 92 - Engine.safe.b * 0.5;
    panel(ctx, Lx, sy - 14, 200, 84, { color: '#3b2a20', border: 2 });
    statLine('Crew seats', cur.seats, st.seats, sy); statLine('Lift', Math.round(cur.liftMul * 100) + '%', Math.round(st.liftMul * 100) + '%', sy + 18);
    statLine('Balloon HP', cur.envHp, st.envHp, sy + 36); statLine('Fuel', Math.round(cur.fuelCap), Math.round(st.fuelCap), sy + 54);
    const qText = cel > 0 ? `Granny Gert: "${this.lastBought}! Now THAT's engineering!"` : QUIPS[this.quip];
    const ql = wrapText(ctx, qText, leftW - 20, 15);
    ql.forEach((ln, i) => bodyText(ctx, ln, Lx + 6, T + 52 + i * 17, 15, 'rgba(241,223,184,0.9)'));
    // ---- right side ----
    const rw = Math.min(W - leftW - 20 - Engine.safe.r, 560), rx = W - rw - 10 - Engine.safe.r;
    resourceBar(ctx, Lx, T, this.flash, Math.min(leftW + 80, rx - Lx - 10));
    UI.button(ctx, 'back', rx + rw - 90, T, 90, 38, '◄ HAVEN', () => go(Scenes.haven), { style: 'ghost', size: 15, keys: ['Escape'] });
    const tabs: { id: Tab; name: string }[] = [...CATEGORIES.map((c) => ({ id: c.id as Tab, name: c.name })), { id: 'decor', name: 'Decor' }];
    const tw = (rw - 6) / 4;
    tabs.forEach((tb, i) => {
      const row = Math.floor(i / 4), col = i % 4;
      UI.button(ctx, 'tab' + tb.id, rx + col * (tw + 2), T + 44 + row * 38, tw - 2, 34, tb.name.toUpperCase(), () => { this.tab = tb.id; this.page = 0; this.sel = ''; }, { style: this.tab === tb.id ? 'red' : 'paper', size: 13 });
    });
    const listY = T + 124, listH = H - listY - 10 - Engine.safe.b * 0.5;
    panel(ctx, rx, listY, rw, listH, { color: P.parchment });
    if (this.tab === 'decor') this.drawDecor(ctx, rx, listY, rw, listH);
    else this.drawUpgrades(ctx, rx, listY, rw, listH);
    this.fx.draw(ctx); this.fx.drawText(ctx);
    if (Engine.portrait) drawRotate(ctx, W, H, t);
    fadeIn(ctx, t, W, H, 0.3);
  }

  private pager(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, total: number, per: number) {
    const pages = Math.ceil(total / per);
    if (pages <= 1) return;
    this.page = clamp(this.page, 0, pages - 1);
    UI.button(ctx, 'pgup', x + w - 44, y + 6, 36, 30, '▲', () => { this.page = Math.max(0, this.page - 1); }, { style: 'paper', size: 14, enabled: this.page > 0 });
    UI.button(ctx, 'pgdn', x + w - 44, y + h - 40, 36, 30, '▼', () => { this.page = Math.min(pages - 1, this.page + 1); }, { style: 'paper', size: 14, enabled: this.page < pages - 1 });
    bodyText(ctx, `${this.page + 1}/${pages}`, x + w - 26, y + h / 2, 13, P.inkSoft, 'center');
  }

  private drawUpgrades(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const s = Save.data;
    const list = UPGRADES.filter((u) => u.cat === this.tab);
    const rowH = 74, per = Math.max(1, Math.floor((h - 10) / rowH));
    this.pager(ctx, x, y, w, h, list.length, per);
    const cw = list.length > per ? w - 56 : w - 16;
    list.slice(this.page * per, this.page * per + per).forEach((u, i) => {
      const ry = y + 8 + i * rowH;
      const lv = s.levels[u.id] ?? 0; const max = lv >= u.costs.length;
      const lockR = !this.regionOk(u), lockQ = !this.reqOk(u);
      const selected = this.sel === u.id;
      UI.button(ctx, 'row' + u.id, x + 8, ry, cw, rowH - 6, '', () => { this.sel = selected ? '' : u.id; Audio.click(); }, { style: 'none' });
      pen.use(ctx, 0.4).begin().rrect(x + 8, ry, cw, rowH - 6, 8).ink(selected ? '#f7e3a8' : max ? '#d8e0b0' : P.paper, 2);
      inkText(ctx, upgradeName(u, Math.min(lv + (max ? 0 : 1), u.costs.length)).toUpperCase(), x + 18, ry + 15, 16, max ? P.oliveDark : P.redDark, { align: 'left', outline: 0, shadow: false });
      for (let k = 0; k < u.costs.length; k++) pen.begin().ell(x + cw - 6 - (u.costs.length - k) * 12, ry + 13, 4.5, 4.5).ink(k < lv ? P.gold : 'rgba(42,26,20,0.15)', 1.4);
      const desc = max ? u.desc[u.desc.length - 1] : u.desc[lv];
      const lines = wrapText(ctx, desc, cw - 130, 14);
      lines.slice(0, 2).forEach((ln, k) => bodyText(ctx, ln, x + 18, ry + 33 + k * 15, 14, P.ink));
      const bx = x + 8 + cw - 106;
      if (max) inkText(ctx, 'MAXED', bx + 50, ry + 44, 16, P.oliveDark, { outline: 0, shadow: false });
      else if (lockR) bodyText(ctx, `Reach region ${(u.region ?? 0) + 1}`, bx + 50, ry + 44, 13, P.redDark, 'center');
      else if (lockQ) bodyText(ctx, `Needs ${UPGRADES.find((q) => q.id === u.requires![0])!.name} ${u.requires![1]}`, bx + 50, ry + 44, 12, P.redDark, 'center');
      else {
        const cost = u.costs[lv]; const ok = canAfford(cost);
        ctx.save(); ctx.fillStyle = 'rgba(42,26,20,0.75)'; ctx.fillRect(x + 16, ry + rowH - 22, Math.min(cw - 130, 230), 14); ctx.restore();
        costRow(ctx, cost, x + 18, ry + rowH - 15, 13);
        UI.button(ctx, 'buy' + u.id, bx, ry + 26, 96, 36, 'BUY', () => this.buy(u), { style: ok ? 'olive' : 'paper', size: 18, enabled: ok });
      }
    });
  }

  private drawDecor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const s = Save.data;
    const sw = (w - 16) / (DECOR_SLOTS.length + 1);
    DECOR_SLOTS.forEach((sl, i) => UI.button(ctx, 'slot' + sl.id, x + 8 + i * sw, y + 8, sw - 4, 30, sl.name.toUpperCase(), () => { this.slot = sl.id; this.page = 0; this.sel = ''; }, { style: this.slot === sl.id ? 'teal' : 'paper', size: 12 }));
    UI.button(ctx, 'slottrophy', x + 8 + DECOR_SLOTS.length * sw, y + 8, sw - 4, 30, 'TROPHIES', () => { this.slot = 'trophy' as DecorSlot; this.page = 0; }, { style: (this.slot as string) === 'trophy' ? 'teal' : 'paper', size: 12 });
    const comfort = Save.comfort();
    bodyText(ctx, `Comfort ${comfort} · crew learn +${Math.min(60, comfort * 6)}% faster`, x + w / 2, y + 52, 14, P.inkSoft, 'center');
    if ((this.slot as string) === 'trophy') {
      const cols = 4, cw = (w - 20) / cols;
      TROPHIES.forEach((tr, i) => {
        const cx = x + 10 + (i % cols) * cw + cw / 2, cy = y + 90 + Math.floor(i / cols) * 62;
        const have = s.trophies.includes(tr.id);
        if (have) { ctx.save(); ctx.translate(cx, cy); ctx.scale(2.4, 2.4); drawTrophyMini(ctx, tr.id, 0, 0, this.t); ctx.restore(); }
        else inkText(ctx, '?', cx, cy, 26, 'rgba(42,26,20,0.25)', { outline: 0, shadow: false });
        bodyText(ctx, have ? tr.name : `Region ${tr.region + 1}`, cx, cy + 24, 12, have ? P.ink : P.inkSoft, 'center');
      });
      return;
    }
    const list = DECOR.filter((d) => d.slot === this.slot);
    const rowH = 52, top = y + 66, per = Math.max(1, Math.floor((h - 72) / rowH));
    this.pager(ctx, x, y + 40, w, h - 40, list.length, per);
    const cw = list.length > per ? w - 56 : w - 16;
    list.slice(this.page * per, this.page * per + per).forEach((d, i) => {
      const ry = top + i * rowH;
      const owned = s.owned.includes(d.id), equipped = s.decor[d.slot] === d.id, selected = this.sel === d.id;
      UI.button(ctx, 'drow' + d.id, x + 8, ry, cw, rowH - 6, '', () => { this.sel = selected ? '' : d.id; }, { style: 'none' });
      pen.use(ctx, 0.4).begin().rrect(x + 8, ry, cw, rowH - 6, 8).ink(selected ? '#f7e3a8' : equipped ? '#d8e0b0' : P.paper, 2);
      if (d.color) pen.begin().ell(x + 26, ry + 22, 10, 10).ink(d.color, 2);
      inkText(ctx, d.name.toUpperCase(), x + 44, ry + 14, 15, P.redDark, { align: 'left', outline: 0, shadow: false });
      if (d.desc) bodyText(ctx, d.desc, x + 44, ry + 32, 13, P.ink);
      const bx = x + 8 + cw - 100;
      if (equipped) inkText(ctx, 'ON', bx + 46, ry + 22, 16, P.oliveDark, { outline: 0, shadow: false });
      else if (owned) UI.button(ctx, 'eq' + d.id, bx, ry + 6, 92, 32, 'USE', () => this.buyDecor(d), { style: 'teal', size: 15 });
      else {
        const ok = canAfford(d.cost) && !(d.slot === 'furniture' && computeStats(s.levels).tier < 1);
        UI.button(ctx, 'bd' + d.id, bx, ry + 6, 92, 32, 'BUY', () => this.buyDecor(d), { style: ok ? 'olive' : 'paper', size: 15, enabled: ok });
        ctx.save(); ctx.fillStyle = 'rgba(42,26,20,0.75)'; ctx.fillRect(bx - 96, ry + 14, 92, 16); ctx.restore();
        costRow(ctx, d.cost, bx - 94, ry + 22, 12);
      }
    });
    if (this.slot === 'furniture' && computeStats(s.levels).tier < 1) bodyText(ctx, 'Furniture needs a bigger basket!', x + w / 2, y + h - 18, 14, P.redDark, 'center');
  }
}
