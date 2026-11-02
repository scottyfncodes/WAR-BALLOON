import { Engine, type Scene } from '../core/engine';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { pen, inkText, bodyText, wrapText } from '../render/ink';
import { clamp, easeOutBack } from '../core/math';
import { UI, panel, fadeIn } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { drawBackdrop, drawPost } from './backdrop';
import { resourceBar, costRow, canAfford, pay } from './common';
import { drawCharacter, LEADERS } from '../render/characters';
import { CAMPS } from '../game/camps';
import { TRADES } from '../game/trades';
import { BIOMES, CAMP_NAMES, type BiomeId } from '../game/biomes';
import { missionsIn } from '../game/missions';
import { RES_KEYS } from '../game/upgrades';
import { drawItemIcon } from '../game/entities';
import { FX } from '../game/fx';
import { checkAchievements } from '../game/achievements';
import { drawRotate } from './play';

/** A camp: its leader, their running story, supply requests and trades. */
export class CampScene implements Scene {
  cheer = 0; t = 0; id: BiomeId = 'city'; fx = new FX(); typeT = 0; flash: Record<string, number> = {}; say = '';
  enter(d?: { region: BiomeId }) {
    this.id = d?.region ?? 'city'; this.t = 0; this.typeT = 0; this.fx = new FX();
    const done = missionsIn(this.id).filter((m) => Save.data.missions[m.id]?.done).length;
    this.say = CAMPS[this.id].story[Math.min(done, 3)];
    Audio.playSong(this.id === 'city' ? 'haven' : BIOMES[this.id].music);
  }
  update(dt: number) {
    this.t += dt; this.typeT += dt; this.cheer = Math.max(0, this.cheer - dt); UI.update(); this.fx.update(dt);
    for (const k of Object.keys(this.flash)) this.flash[k] = Math.max(0, this.flash[k] - dt * 2);
  }
  private fulfil() {
    const s = Save.data, camp = CAMPS[this.id];
    const n = s.camps[this.id] ?? 0; const r = camp.requests[n];
    if (!r || !canAfford(r.give)) { Audio.deny(); return; }
    pay(r.give); for (const k of RES_KEYS) s.res[k] += r.reward[k] ?? 0;
    s.camps[this.id] = n + 1; s.population += r.pop; checkAchievements(s); Save.write(); this.cheer = 1.6;
    for (const k of Object.keys(r.reward)) this.flash[k] = 1;
    Audio.buy(); Audio.voice('yay');
    const W = Engine.W, H = Engine.H;
    this.fx.confetti(W * 0.24, H * 0.45, 40);
    if (n + 1 >= 3) { this.say = `You've done right by us, Jerry. Take this: ${camp.perk.name}! ${camp.perk.desc}`; this.fx.burst(W * 0.24, H * 0.25, 'PERK EARNED!', 28); Audio.fanfare(); }
    else { this.say = 'That\'ll do nicely! Here — this is for your trouble.'; this.fx.burst(W * 0.24, H * 0.25, 'THANK YOU!', 26); }
    this.typeT = 0;
  }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, s = Save.data, b = BIOMES[this.id], camp = CAMPS[this.id], lead = LEADERS[this.id];
    drawBackdrop(ctx, W, H, 300 + this.t * 8, -40, this.t, { biome: b });
    ctx.fillStyle = 'rgba(30,18,12,0.25)'; ctx.fillRect(0, 0, W, H);
    // ground + leader
    ctx.fillStyle = b.ground.mid; ctx.fillRect(0, H * 0.9, W, H * 0.1);
    const lx = Math.max(W * 0.22, 160 + Engine.safe.l);
    ctx.save(); ctx.translate(lx, H * 0.95); ctx.scale(1.55, 1.55);
    drawCharacter(ctx, lead.look, this.t, this.typeT * 40 < this.say.length, this.cheer);
    ctx.restore();
    panel(ctx, lx - 110, H * 0.86, 220, 46, { color: '#3b2a20', border: 2.5 });
    inkText(ctx, lead.name.toUpperCase(), lx, H * 0.86 + 16, 17, P.goldLight, { outline: 3, shadow: false });
    bodyText(ctx, lead.title + ' · ' + CAMP_NAMES[this.id], lx, H * 0.86 + 34, 13, P.parchment, 'center');
    // speech bubble (typed)
    const bw = Math.min(380, W * 0.36), shown = this.say.slice(0, Math.floor(this.typeT * 40));
    const lines = wrapText(ctx, this.say, bw - 28, 17);
    const bh = 22 + lines.length * 20, bx = 14 + Engine.safe.l, by = 60;
    pen.use(ctx, 0.5);
    pen.begin().rrect(bx, by, bw, bh, 14).ink(P.paper, 3);
    pen.begin().m(lx - 20, by + bh - 2).l(lx - 4, by + bh + 26).l(lx + 10, by + bh - 2).close().ink(P.paper, 3);
    pen.begin().rect(lx - 22, by + bh - 6, 34, 6).fill(P.paper);
    let left = shown.length;
    lines.forEach((ln, i) => { const part = ln.slice(0, Math.max(0, left)); left -= ln.length + 1; bodyText(ctx, part, bx + 14, by + 20 + i * 20, 17, P.ink); });
    // ---------- right panel: requests + trades ----------
    const rw = Math.min(520, W * 0.5), rx = W - rw - 12 - Engine.safe.r, ry = 60, rh = H - 70;
    panel(ctx, rx, ry, rw, rh, { tape: true, color: P.parchment });
    inkText(ctx, 'SUPPLY REQUESTS', rx + rw / 2, ry + 26, 22, P.red, { outline: 3 });
    const n = s.camps[this.id] ?? 0;
    for (let i = 0; i < 3; i++) { pen.begin().rect(rx + rw / 2 - 40 + i * 28, ry + 44, 20, 12).ink(i < n ? P.olive : 'rgba(42,26,20,0.15)', 1.8); }
    const req = camp.requests[n];
    let y = ry + 68;
    if (req) {
      pen.begin().rrect(rx + 14, y, rw - 28, 96, 8).ink(P.paper, 2.4);
      bodyText(ctx, '“' + req.text + '”', rx + 26, y + 18, 17, P.ink);
      ctx.save(); ctx.fillStyle = 'rgba(42,26,20,0.85)'; ctx.fillRect(rx + 24, y + 36, rw - 190, 24); ctx.restore();
      const gw = costRow(ctx, req.give, rx + 28, y + 48, 14);
      inkText(ctx, '→', rx + 34 + gw, y + 49, 15, P.gold, { outline: 2, shadow: false, align: 'left' });
      let gx = rx + 54 + gw;
      for (const k of RES_KEYS) { const v = req.reward[k]; if (!v) continue; ctx.save(); ctx.translate(gx + 8, y + 48); ctx.scale(0.65, 0.65); drawItemIcon(ctx, k, 11, 0); ctx.restore(); inkText(ctx, '+' + v, gx + 18, y + 49, 14, P.goldLight, { align: 'left', outline: 3, shadow: false }); gx += 46; }
      bodyText(ctx, `+${req.pop} new resident${req.pop > 1 ? 's' : ''} for Haven`, rx + 26, y + 78, 14, P.inkSoft);
      const ok = canAfford(req.give);
      UI.button(ctx, 'fulfil', rx + rw - 150, y + 52, 124, 38, ok ? 'DELIVER' : 'NEED MORE', () => this.fulfil(), { style: ok ? 'red' : 'paper', size: 16, enabled: ok });
      y += 108;
    }
    // perk
    const earned = n >= 3;
    pen.begin().rrect(rx + 14, y, rw - 28, 46, 8).ink(earned ? '#e7d9a8' : P.paper, 2.2);
    inkText(ctx, (earned ? '★ ' : '🔒 ') + camp.perk.name.toUpperCase(), rx + 26, y + 16, 15, earned ? P.oliveDark : P.ink, { align: 'left', outline: 0, shadow: false });
    bodyText(ctx, earned ? camp.perk.desc + ' (active)' : camp.perk.desc + ' — complete all 3 requests', rx + 26, y + 34, 14, P.inkSoft);
    y += 58;
    // trades
    inkText(ctx, 'TRADES', rx + rw / 2, y + 8, 18, P.red, { outline: 3 });
    y += 22;
    for (const tr of TRADES.filter((x) => x.camp === this.id)) {
      if (y + 50 > ry + rh - 8) break;
      pen.begin().rrect(rx + 14, y, rw - 28, 46, 8).ink(P.paper, 2);
      ctx.save(); ctx.fillStyle = 'rgba(42,26,20,0.85)'; ctx.fillRect(rx + 22, y + 11, rw - 160, 24); ctx.restore();
      const gw = costRow(ctx, tr.give, rx + 26, y + 23, 14);
      inkText(ctx, '→', rx + 32 + gw, y + 24, 15, P.gold, { outline: 2, shadow: false, align: 'left' });
      let gx = rx + 52 + gw;
      for (const k of RES_KEYS) { const v = tr.get[k]; if (!v) continue; ctx.save(); ctx.translate(gx + 8, y + 23); ctx.scale(0.65, 0.65); drawItemIcon(ctx, k, 11, 0); ctx.restore(); inkText(ctx, '+' + v, gx + 18, y + 24, 14, P.goldLight, { align: 'left', outline: 3, shadow: false }); gx += 46; }
      const ok = canAfford(tr.give);
      UI.button(ctx, 'tr' + tr.id, rx + rw - 122, y + 6, 96, 34, 'TRADE', () => {
        if (!canAfford(tr.give)) { Audio.deny(); return; }
        pay(tr.give); for (const k of RES_KEYS) s.res[k] += tr.get[k] ?? 0; Save.write();
        for (const k of Object.keys(tr.get)) this.flash[k] = 1;
        Audio.coin(); this.say = tr.line; this.typeT = 0;
      }, { style: ok ? 'olive' : 'paper', size: 14, enabled: ok });
      y += 54;
    }
    // top bar
    resourceBar(ctx, 12 + Engine.safe.l, 10, this.flash);
    UI.button(ctx, 'map', W - 150 - Engine.safe.r, 8, 138, 44, 'TO THE MAP', () => go(Scenes.map), { style: 'olive', size: 16, keys: ['Escape'] });
    UI.button(ctx, 'garage', W - 290 - Engine.safe.r, 8, 130, 44, 'GARAGE', () => go(Scenes.garage), { style: 'teal', size: 16 });
    this.fx.draw(ctx); this.fx.drawText(ctx);
    drawPost(ctx, W, H, this.t);
    void clamp; void easeOutBack;
    if (Engine.portrait) drawRotate(ctx, W, H, this.t);
    fadeIn(ctx, this.t, W, H, 0.01);
  }
}
