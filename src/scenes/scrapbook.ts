import { Engine, type Scene } from '../core/engine';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { pen, inkText, bodyText, wrapText, makeCanvas } from '../render/ink';
import { paintSky } from '../render/paint';
import { paintBiomeLayer } from '../render/biomeArt';
import { UI, panel, fadeIn } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { MISSIONS } from '../game/missions';
import { BIOMES, type BiomeId } from '../game/biomes';
import { ACHIEVEMENTS } from '../game/achievements';
import { drawRotate } from './play';
import { star } from './map';

const art = new Map<string, HTMLCanvasElement>();
/** A little painted postcard of a region (cached). */
function postcardArt(id: BiomeId): HTMLCanvasElement {
  let c = art.get(id);
  if (c) return c;
  const b = BIOMES[id];
  const [cv, x] = makeCanvas(260, 160);
  x.drawImage(paintSky(260, 160, b.sky, 11), 0, 0);
  const far = paintBiomeLayer(b, 'far', 700, 200, 21), mid = paintBiomeLayer(b, 'mid', 700, 200, 23);
  x.drawImage(far, 0, 160 - 120, 420, 120);
  x.drawImage(mid, -40, 160 - 100, 420, 120);
  c = cv; art.set(id, c);
  return c;
}

export class ScrapbookScene implements Scene {
  t = 0; tab: 'cards' | 'ach' | 'stats' = 'cards';
  enter() { this.t = 0; Audio.playSong('haven'); }
  update(dt: number) { this.t += dt; UI.update(); }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, s = Save.data;
    // leather album cover background
    ctx.fillStyle = '#4a2e20'; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 6) { ctx.fillStyle = y % 12 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)'; ctx.fillRect(0, y, W, 3); }
    const px = 14 + Engine.safe.l, py = 58, pw = W - 28 - Engine.safe.l - Engine.safe.r, ph = H - 68;
    panel(ctx, px, py, pw, ph, { color: '#efe2c2' });
    inkText(ctx, 'JERRY\'S SCRAPBOOK', 22 + Engine.safe.l + 150, 30, 26, P.gold, { outline: 4 });
    const tabs: [typeof this.tab, string][] = [['cards', `POSTCARDS ${s.postcards.length}/${MISSIONS.length}`], ['ach', `ACHIEVEMENTS ${s.ach.length}/${ACHIEVEMENTS.length}`], ['stats', 'STATS']];
    const tw = Math.min(200, (W - 520) / 3);
    tabs.forEach(([id, label], i) => UI.button(ctx, 'tab' + id, 330 + Engine.safe.l + i * (tw + 6), 8, tw, 40, label, () => { this.tab = id; }, { style: this.tab === id ? 'red' : 'paper', size: tw < 170 ? 12 : 14 }));
    UI.button(ctx, 'back', W - 130 - Engine.safe.r, 8, 118, 40, 'BACK', () => go(Scenes.map), { style: 'olive', size: 16, keys: ['Escape'] });
    if (this.tab === 'cards') this.drawCards(ctx, px, py, pw, ph);
    else if (this.tab === 'ach') this.drawAch(ctx, px, py, pw, ph);
    else this.drawStats(ctx, px, py, pw, ph);
    if (Engine.portrait) drawRotate(ctx, W, H, this.t);
    fadeIn(ctx, this.t, W, H, 0.01);
  }
  private drawCards(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const s = Save.data;
    const cols = Math.max(4, Math.floor((w - 20) / 150)), cw = (w - 20) / cols, chh = Math.min(108, (h - 16) / Math.ceil(MISSIONS.length / cols));
    MISSIONS.forEach((m, i) => {
      const cx = x + 10 + (i % cols) * cw + cw / 2, cy = y + 10 + Math.floor(i / cols) * chh + chh / 2;
      const got = s.postcards.includes('pc-' + m.id);
      const cardW = Math.min(cw - 14, chh * 1.5), cardH = chh - 18;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(((i * 37) % 7 - 3) * 0.012);
      if (got) {
        ctx.fillStyle = 'rgba(30,15,10,0.3)'; ctx.fillRect(-cardW / 2 + 4, -cardH / 2 + 5, cardW, cardH);
        ctx.fillStyle = P.paper; ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
        ctx.drawImage(postcardArt((m.biome ?? 'city') as BiomeId), -cardW / 2 + 4, -cardH / 2 + 4, cardW - 8, cardH - 22);
        ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);
        bodyText(ctx, 'Greetings from ' + BIOMES[(m.biome ?? 'city') as BiomeId].name.replace('The ', ''), 0, cardH / 2 - 9, 12, P.ink, 'center');
        ctx.fillStyle = P.red; ctx.fillRect(cardW / 2 - 18, -cardH / 2 + 6, 12, 14);
      } else {
        ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(42,26,20,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH); ctx.setLineDash([]);
        inkText(ctx, '?', 0, -6, 24, 'rgba(42,26,20,0.3)', { outline: 0, shadow: false });
        bodyText(ctx, m.name, 0, cardH / 2 - 10, 11, 'rgba(42,26,20,0.5)', 'center');
      }
      ctx.restore();
    });
  }
  private drawAch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const s = Save.data;
    const cols = w > 900 ? 3 : 2, cw = (w - 24) / cols, rows = Math.ceil(ACHIEVEMENTS.length / cols), rh = Math.min(70, (h - 16) / rows);
    ACHIEVEMENTS.forEach((a, i) => {
      const ax = x + 12 + (i % cols) * cw, ay = y + 10 + Math.floor(i / cols) * rh;
      const got = s.ach.includes(a.id);
      pen.use(ctx, 0.5).begin().rrect(ax, ay, cw - 8, rh - 8, 8).ink(got ? '#f3e2a5' : 'rgba(255,255,255,0.35)', 2);
      // medal
      const mx = ax + 30, my = ay + (rh - 8) / 2;
      pen.begin().m(mx - 8, my - 22).l(mx - 2, my - 6).l(mx + 2, my - 6).l(mx + 8, my - 22).stroke(5, got ? P.red : P.parchmentShade);
      pen.begin().ell(mx, my + 4, 14, 14).ink(got ? P.gold : P.parchmentShade, 2.4);
      if (got) star(ctx, mx, my + 4, 8, P.goldLight);
      inkText(ctx, a.name.toUpperCase(), ax + 54, ay + 18, 14, got ? P.ink : 'rgba(42,26,20,0.5)', { align: 'left', outline: 0, shadow: false });
      const ln = wrapText(ctx, a.desc, cw - 74, 13);
      ln.slice(0, 2).forEach((l, k) => bodyText(ctx, l, ax + 54, ay + 36 + k * 14, 13, got ? P.inkSoft : 'rgba(42,26,20,0.45)'));
    });
  }
  private drawStats(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const s = Save.data;
    const done = Object.values(s.missions).filter((m) => m.done).length;
    const stars = Object.values(s.missions).reduce((a, m) => a + m.stars, 0);
    const lines: [string, string][] = [
      ['Missions completed', `${done} / ${MISSIONS.length}`], ['Stars earned', `${stars} / ${MISSIONS.length * 3}`],
      ['Sorties flown', String(s.totalRuns)], ['Bombs dropped', String(s.stats.bombs)], ['Things destroyed', String(s.stats.destroyed)],
      ['Things hooked', String(s.stats.hooked)], ['Haven residents', String(s.population)], ['Upgrade levels bought', String(Object.values(s.levels).reduce((a, b) => a + b, 0))],
      ['Camp perks earned', `${Object.values(s.camps).filter((n) => n >= 3).length} / 6`], ['Paint jobs', `${s.paintsUnlocked.length} / 9`], ['Difficulty', s.difficulty.toUpperCase()],
    ];
    const colW = w > 700 ? (w - 60) / 2 : w - 40;
    lines.forEach(([k, v], i) => {
      const col = w > 700 ? Math.floor(i / 6) : 0, row = w > 700 ? i % 6 : i;
      const lx = x + 30 + col * (colW + 20), ly = y + 34 + row * Math.min(42, (h - 40) / (w > 700 ? 6 : lines.length));
      bodyText(ctx, k, lx, ly, 19, P.inkSoft);
      inkText(ctx, v, lx + colW - 20, ly, 20, P.red, { align: 'right', outline: 0, shadow: false });
      ctx.strokeStyle = 'rgba(42,26,20,0.2)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(lx, ly + 14); ctx.lineTo(lx + colW - 20, ly + 14); ctx.stroke(); ctx.setLineDash([]);
    });
  }
}
