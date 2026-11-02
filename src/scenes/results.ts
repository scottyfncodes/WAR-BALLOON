import { Engine, type Scene } from '../core/engine';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { pen, inkText, bodyText } from '../render/ink';
import { clamp, easeOutBack } from '../core/math';
import { UI, panel, fadeIn } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { drawBackdrop, drawPost } from './backdrop';
import { drawMenuBalloon } from './common';
import { drawItemIcon } from '../game/entities';
import { RES_KEYS, type ResKey, UPGRADES } from '../game/upgrades';
import { MISSIONS, missionById } from '../game/missions';
import { paintById } from '../render/balloonArt';
import type { MissionSpec } from '../game/types';
import type { World } from '../game/world';
import { FX } from '../game/fx';
import { star } from './map';
import { canAfford } from './common';

export class ResultsScene implements Scene {
  t = 0; spec!: MissionSpec; success = false; stars = 0; gains: Record<ResKey, number> = {} as any;
  objs: { text: string; done: boolean; optional: boolean; failed: boolean }[] = [];
  unlocks: string[] = []; fx = new FX(); finale = false; lastTick = 0; next: MissionSpec | null = null; hard = false;
  enter(d: { mission: MissionSpec; world: World; success: boolean }) {
    this.t = 0; this.spec = d.mission; this.success = d.success; this.unlocks = []; this.fx = new FX(); this.lastTick = 0;
    const w = d.world, s = Save.data;
    this.objs = w.objectives.map((o) => ({ text: o.spec.text, done: o.done, optional: !!o.spec.optional, failed: o.failed || (!o.done) }));
    this.gains = { fuel: 0, scrap: 0, fabric: 0, food: 0, water: 0, electronics: 0 };
    for (const k of RES_KEYS) {
      const c = w.collected[k];
      this.gains[k] = this.success ? Math.round((c + (this.spec.rewards[k] ?? 0)) * (s.difficulty === 'hard' ? 1.25 : 1)) : Math.floor(c * 0.5);
      s.res[k] += this.gains[k];
    }
    if (this.success) {
      // Haven's workshop: everyone you've rescued pitches in a little scrap each sortie
      const help = Math.min(12, s.population);
      if (help > 0) { this.gains.scrap += help; s.res.scrap += help; this.unlocks.push(`Haven's workshop chipped in +${help} scrap`); }
      if (w.rescued > 0) { s.population += w.rescued; this.unlocks.push(`${w.rescued} survivor${w.rescued > 1 ? 's' : ''} moved into Haven (pop. ${s.population})`); }
    }
    if (this.success) delete s.fails[this.spec.id]; else s.fails[this.spec.id] = (s.fails[this.spec.id] ?? 0) + 1;
    if (!this.success && s.fails[this.spec.id] >= 2) this.unlocks.push('Granny will stitch on a spare patch for your next try');
    const wasDone = !!s.missions[this.spec.id]?.done;
    this.stars = this.success ? Math.min(3, 1 + this.objs.filter((o) => o.optional && o.done).length) : 0;
    this.hard = w.player.damageTaken >= 2 || !!this.spec.boss;
    if (this.success) {
      const rec = s.missions[this.spec.id] ?? { done: false, stars: 0, best: 0 };
      rec.done = true; rec.stars = Math.max(rec.stars, this.stars); rec.best = Math.max(rec.best, w.collected.scrap);
      s.missions[this.spec.id] = rec;
      if (!wasDone && !this.spec.free) {
        const nxt = MISSIONS.find((m) => m.requires === this.spec.id);
        if (nxt) this.unlocks.push(`New mission: ${nxt.name}`);
        if (this.spec.id === 'm1') this.unlocks.push('Free Flight: Scavenger Run');
      }
      if (this.spec.unlockPaint && !s.paintsUnlocked.includes(this.spec.unlockPaint)) { s.paintsUnlocked.push(this.spec.unlockPaint); this.unlocks.push(`Paint job: ${paintById(this.spec.unlockPaint).name}`); }
    }
    // postcards persist even on failure (you did grab it!)
    const pc = this.spec.ents.find((e) => e.kind === 'postcard')?.id;
    if (w.postcard && pc && !s.postcards.includes(pc)) { s.postcards.push(pc); this.unlocks.push(`Postcard ${s.postcards.length}/${MISSIONS.length} found`); }
    if (s.postcards.length >= 3 && !s.paintsUnlocked.includes('sunset')) { s.paintsUnlocked.push('sunset'); this.unlocks.push('Paint job: Sunset Checks'); }
    s.stats.bombs += w.bombsDropped; s.stats.destroyed += w.kills; s.stats.hooked += w.hookedCount;
    Save.write();
    this.next = this.success ? (MISSIONS.find((m) => m.requires === this.spec.id && !s.missions[m.id]?.done) ?? null) : null;
    Audio.playSong('haven');
    const regionDone: Record<string, string> = { m4: 'The Dustlands', d3: 'The Flood', f3: 'The Green', g3: 'The Frozen Reach', z3: 'The Ashlands' };
    if (this.success && !wasDone && regionDone[this.spec.id]) this.unlocks.push(`NEW REGION: ${regionDone[this.spec.id]}!`);
    this.finale = this.success && this.spec.id === 'a3';
  }
  update(dt: number) {
    this.t += dt; UI.update(); this.fx.update(dt);
    const ticks = Math.floor((this.t - 0.5) / 0.25);
    if (ticks > this.lastTick && ticks <= this.objs.length + 1 && this.t > 0.5) { this.lastTick = ticks; Audio.coin(); }
    if (this.success && this.t > 0.5 && this.t < 0.52) { this.fx.confetti(Engine.W / 2, Engine.H * 0.2, 50); }
  }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, t = this.t;
    drawBackdrop(ctx, W, H, 400 + t * 20, -120, t);
    drawPost(ctx, W, H, t);
    ctx.fillStyle = 'rgba(30,18,12,0.35)'; ctx.fillRect(0, 0, W, H);
    // Jerry's reaction
    const bx = Math.max(W * 0.2, 130 + Engine.safe.l);
    if (this.success) drawMenuBalloon(ctx, bx, H * 0.78 + Math.sin(t * 2) * 8, 0.9, t, { expr: this.hard && t > 2.5 ? 'tired' : 'cheer', arm: this.hard && t > 2.5 ? 'rest' : 'cheer', burner: t < 2 ? 1 : 0 });
    else drawMenuBalloon(ctx, bx, H * 0.86, 0.9, t, { expr: 'hurt', squash: 0.25, damage: 3, tilt: 0.25, arm: 'rest' });
    // card
    const pw = Math.min(560, W * 0.6), px = W - pw - 24 - Engine.safe.r, py = 30, ph = H - 60;
    panel(ctx, px, py, pw, ph, { tape: true, color: P.paper });
    const k = easeOutBack(clamp(t / 0.5, 0, 1));
    ctx.save(); ctx.translate(px + pw / 2, py + 44); ctx.scale(k * 1.0, k); ctx.rotate(-0.04);
    // rubber stamp
    const col = this.success ? P.olive : P.red;
    pen.use(ctx, 1).begin().rrect(-190, -28, 380, 56, 8).stroke(5, col);
    inkText(ctx, this.success ? 'MISSION COMPLETE' : 'BALLOON DOWN', 0, 2, 36, col, { outline: 0, shadow: false });
    ctx.restore();
    bodyText(ctx, this.spec.name + ' — ' + this.spec.subtitle, px + pw / 2, py + 88, 17, P.inkSoft, 'center');
    if (this.success) for (let i = 0; i < 3; i++) { const sk = easeOutBack(clamp((t - 0.6 - i * 0.2) / 0.3, 0, 1)); if (sk > 0) { ctx.save(); ctx.translate(px + pw / 2 - 40 + i * 40, py + 120); ctx.scale(sk, sk); star(ctx, 0, 0, 16, i < this.stars ? P.gold : 'rgba(42,26,20,0.2)'); ctx.restore(); } }
    // objectives
    let y = py + (this.success ? 152 : 118);
    this.objs.forEach((o, i) => {
      if (t < 0.5 + i * 0.25) return;
      pen.begin().rect(px + 24, y - 8, 15, 15).ink(o.done ? P.olive : P.paper, 2);
      if (o.done) pen.begin().m(px + 27, y).l(px + 31, y + 4).l(px + 37, y - 6).stroke(2.5, P.parchment);
      else pen.begin().m(px + 27, y - 5).l(px + 36, y + 4).m(px + 36, y - 5).l(px + 27, y + 4).stroke(2, P.red);
      bodyText(ctx, (o.optional ? '★ ' : '') + o.text, px + 48, y, 17, o.done ? P.ink : P.inkSoft); y += 22;
    });
    // gains
    y += 6;
    const tallyStart = 0.6 + this.objs.length * 0.25;
    if (t > tallyStart) {
      bodyText(ctx, this.success ? 'Haul (incl. mission reward):' : 'Salvaged (half your haul):', px + 24, y, 17, P.inkSoft); y += 24;
      let gx = px + 28; const prog = clamp((t - tallyStart) / 0.9, 0, 1);
      for (const kk of RES_KEYS) {
        const n = this.gains[kk]; if (!n) continue;
        ctx.save(); ctx.translate(gx + 10, y); drawItemIcon(ctx, kk, 11, t); ctx.restore();
        inkText(ctx, '+' + Math.round(n * prog), gx + 26, y + 1, 18, P.orange, { align: 'left', outline: 3, shadow: false });
        gx += 72; if (gx > px + pw - 70) { gx = px + 28; y += 30; }
      }
      y += 30;
      this.unlocks.forEach((u, i) => { if (t > tallyStart + 1 + i * 0.3) { inkText(ctx, '✦ ' + u, px + 24, y, 16, P.redDark, { align: 'left', outline: 0, shadow: false }); y += 22; } });
    }
    // buttons
    const s = Save.data;
    const affordable = UPGRADES.some((u) => { const lv = s.levels[u.id] ?? 0; return lv < u.costs.length && (!u.requires || s.levels[u.requires]) && canAfford(u.costs[lv]); });
    const by = py + ph - 64, bw = (pw - 60) / 3;
    UI.button(ctx, 'garage', px + 20, by, bw, 50, 'GARAGE', () => go(Scenes.garage), { style: affordable ? 'red' : 'teal', size: 19, sub: affordable ? 'upgrade ready!' : undefined });
    UI.button(ctx, 'map', px + 30 + bw, by, bw, 50, 'MAP', () => go(Scenes.map), { style: 'brass', size: 19, keys: ['Escape'] });
    if (this.finale) UI.button(ctx, 'end', px + 40 + bw * 2, by, bw, 50, 'THE END', () => go(Scenes.ending), { style: 'olive', size: 19, keys: ['Enter'] });
    else if (this.success && this.next) UI.button(ctx, 'next', px + 40 + bw * 2, by, bw, 50, 'NEXT', () => go(Scenes.play, { mission: this.next! }), { style: 'olive', size: 19, keys: ['Enter'] });
    else UI.button(ctx, 'retry', px + 40 + bw * 2, by, bw, 50, this.success ? 'FLY AGAIN' : 'RETRY', () => go(Scenes.play, { mission: this.spec.free ? this.spec : missionById(this.spec.id)! }), { style: 'olive', size: 18, keys: ['Enter'] });
    this.fx.draw(ctx); this.fx.drawText(ctx);
    fadeIn(ctx, t, W, H, 0.01);
  }
}
