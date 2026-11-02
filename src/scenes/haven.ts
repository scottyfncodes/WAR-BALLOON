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
import { drawMenuAirship, resourceBar } from './common';
import { BIOMES, BIOME_ORDER, regionNeeds, type BiomeId } from '../game/biomes';
import { Z_INFO } from '../game/zombies';
import { drawZombie } from '../render/zombieArt';
import { drawResIcon } from '../game/resources';
import { drawCharacterMini } from '../render/crewArt';
import { computeStats, UPGRADES } from '../game/upgrades';
import { canAfford } from './common';
import { drawRotate } from './play';

/** Haven: Jerry's rooftop home. Pick a region, check the crew, launch. */
export class HavenScene implements Scene {
  t = 0; idx = 0; slide = 0;
  enter() {
    this.t = 0; Audio.playSong('haven');
    const s = Save.data;
    this.idx = Math.max(0, BIOME_ORDER.indexOf(s.region));
    if (!Save.regionUnlocked(this.idx, BIOME_ORDER)) this.idx = 0;
    // a freshly opened region is worth showing off, even if the balloon isn't ready yet
    for (let i = 5; i > this.idx; i--) if (Save.regionUnlocked(i, BIOME_ORDER) && !s.regions[BIOME_ORDER[i]]?.runs) { this.idx = i; break; }
  }
  update(dt: number) { this.t += dt; UI.update(); this.slide = Math.max(0, this.slide - dt * 4); }
  unlocked(i: number) { return Save.regionUnlocked(i, BIOME_ORDER); }
  launch() {
    const s = Save.data; const id = BIOME_ORDER[this.idx];
    s.region = id; Save.write();
    Audio.ignite();
    go(Scenes.play, { region: id });
  }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, t = this.t, s = Save.data;
    const region = BIOMES[BIOME_ORDER[this.idx]];
    drawBackdrop(ctx, W, H, t * 6, -60, t, { biome: BIOMES.suburbs });
    // rooftop of Haven
    const roofY = H * 0.86;
    pen.use(ctx, 0.3);
    pen.begin().rect(-10, roofY, W * 0.6 + 10, H - roofY + 10).ink('#6a5040', 3);
    for (let x = 0; x < W * 0.6; x += 18) pen.begin().rrect(x, roofY - 10, 17, 10, 4).ink(P.parchmentShade, 1.5);
    for (let x = 20; x < W * 0.6; x += 60) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x, roofY + 14, 40, 3); }
    // mooring mast
    const shipX = Math.max(W * 0.3, 230 + Engine.safe.l);
    pen.begin().m(shipX - 120, roofY - 8).l(shipX - 120, roofY - 210).stroke(5, P.brownDark);
    pen.begin().m(shipX - 120, roofY - 200).q(shipX - 70, roofY - 160, shipX - 10, roofY - 190).stroke(1.5, P.ink);
    const stats = computeStats(s.levels);
    const scale = [1.05, 1.0, 0.96, 0.93, 0.9][stats.tier];
    drawMenuAirship(ctx, shipX, roofY - 26 + Math.sin(t * 1.3) * 3 - 30 * scale, scale, t, { burner: Math.sin(t * 0.8) > 0.6 ? 0.6 : 0, expr: 'happy', arm: t % 7 < 1.5 ? 'wave' : 'rest' });
    // crew who stayed home
    const home = s.crew.filter((c) => !s.aboard.includes(c.id) && !s.missing[c.id]);
    home.slice(0, 7).forEach((c, i) => {
      const x = shipX + 130 + (i % 4) * 30 + (i >= 4 ? 14 : 0), y = roofY - (i >= 4 ? 4 : 0);
      if (x > W * 0.56) return;
      ctx.save(); ctx.translate(x, y); ctx.scale(0.8, 0.8); drawCharacterMini(ctx, c.look, c.role, t + i, c.injured > 0 ? 'ko' : (i + Math.floor(t / 3)) % 5 === 0 ? 'cheer' : 'idle', i % 2 ? -1 : 1); ctx.restore();
    });
    drawPost(ctx, W, H, t);
    // ---- top bar ----
    const T = 8 + Engine.safe.t * 0.5, Lx = 10 + Engine.safe.l;
    resourceBar(ctx, Lx, T, {}, Math.min(520, W * 0.55));
    inkText(ctx, 'HAVEN', Lx + 8, T + 66, 34, P.goldLight, { align: 'left', outline: 5 });
    bodyText(ctx, `${s.crew.length} survivors call it home · ${s.stats.expeditions} expeditions flown`, Lx + 10, T + 92, 15, P.parchment);
    // ---- region card ----
    const cw = clamp(W * 0.42, 330, 430), cx = W - cw - 12 - Engine.safe.r, cy = T + 4, ch = H - cy - 14 - Engine.safe.b * 0.5;
    panel(ctx, cx, cy, cw, ch, { color: P.parchment, tape: true });
    const unlocked = this.unlocked(this.idx);
    const k = easeOutBack(1 - this.slide);
    ctx.save(); ctx.globalAlpha = 0.3 + 0.7 * k;
    inkText(ctx, `REGION ${this.idx + 1}/6`, cx + cw / 2, cy + 22, 14, P.inkSoft, { outline: 0, shadow: false });
    inkText(ctx, region.name.toUpperCase(), cx + cw / 2, cy + 46, region.name.length > 18 ? 22 : 26, unlocked ? P.redDark : P.inkSoft, { outline: 0, shadow: false });
    bodyText(ctx, region.tagline, cx + cw / 2, cy + 70, 16, P.inkSoft, 'center');
    // danger skulls
    for (let i = 0; i < 6; i++) { const sx = cx + cw / 2 - 50 + i * 20, sy = cy + 92; pen.begin().ell(sx, sy, 7, 6.5).ink(i < region.danger ? P.redBright : 'rgba(42,26,20,0.2)', 1.5); if (i < region.danger) { ctx.fillStyle = P.ink; ctx.fillRect(sx - 3.5, sy - 1, 2.5, 2.5); ctx.fillRect(sx + 1, sy - 1, 2.5, 2.5); } }
    if (unlocked) {
      // the dead you'll meet
      const kinds = Object.keys(region.zombies) as (keyof typeof Z_INFO)[];
      const zw = Math.min(52, (cw - 30) / kinds.length);
      kinds.forEach((kd, i) => { ctx.save(); ctx.translate(cx + 15 + zw / 2 + i * zw, cy + 154); ctx.scale(1.05, 1.05); drawZombie(ctx, { kind: kd, pose: 'idle', t: t + i, facing: 1, seed: i * 7 }); ctx.restore(); });
      const newKinds = kinds.filter((kd) => this.idx === 0 || !(BIOMES[BIOME_ORDER[this.idx - 1]].zombies as any)[kd]);
      if (this.idx > 0 && newKinds.length) bodyText(ctx, 'NEW: ' + newKinds.map((kd) => Z_INFO[kd].name).join(', '), cx + cw / 2, cy + 166, 14, P.redDark, 'center');
      const lines = wrapText(ctx, region.intro, cw - 36, 15);
      lines.slice(0, 4).forEach((ln, i) => bodyText(ctx, ln, cx + 18, cy + 188 + i * 17, 15, P.ink));
      // loot
      const ly = cy + 188 + Math.min(4, lines.length) * 17 + 10;
      bodyText(ctx, 'Loot:', cx + 18, ly, 15, P.inkSoft);
      [...new Set(region.loot)].forEach((r, i) => { ctx.save(); ctx.translate(cx + 70 + i * 26, ly); ctx.scale(0.7, 0.7); drawResIcon(ctx, r, 11, t); ctx.restore(); });
      const rec = s.regions[region.id];
      const lost = s.crew.filter((c) => s.missing[c.id] === region.id);
      let info = rec?.beacon ? '★ Beacon lit' : '☆ Beacon not lit yet';
      if (rec?.runs) info += ` · ${rec.runs} trips`;
      bodyText(ctx, info, cx + 18, ly + 22, 14, rec?.beacon ? P.oliveDark : P.redDark);
      bodyText(ctx, `Survivors waiting: ${region.survivors[0]}–${region.survivors[1]} · Stops: ${region.pois.map((p) => p.toUpperCase()).join(', ')}`, cx + 18, ly + 58, 13, P.inkSoft);
      if (lost.length) bodyText(ctx, `Lost out here: ${lost.map((c) => c.name.split(' ')[0]).join(', ')}`, cx + 18, ly + 40, 14, P.redDark);
    } else {
      const prev = BIOMES[BIOME_ORDER[this.idx - 1]];
      pen.begin().rrect(cx + cw / 2 - 30, cy + 130, 60, 46, 8).ink(P.steelDark, 3);
      pen.begin().m(cx + cw / 2 - 18, cy + 130).q(cx + cw / 2 - 18, cy + 102, cx + cw / 2, cy + 102).q(cx + cw / 2 + 18, cy + 102, cx + cw / 2 + 18, cy + 130).stroke(6, P.steelDark);
      bodyText(ctx, 'LOCKED', cx + cw / 2, cy + 200, 22, P.redDark, 'center');
      bodyText(ctx, `Light the beacon in ${prev.name}`, cx + cw / 2, cy + 226, 16, P.ink, 'center');
      bodyText(ctx, region.advice, cx + cw / 2, cy + 250, 14, P.inkSoft, 'center');
    }
    ctx.restore();
    // arrows
    UI.button(ctx, 'prev', cx + 8, cy + 30, 40, 40, '◄', () => { if (this.idx > 0) { this.idx--; this.slide = 1; } }, { style: 'paper', size: 18, enabled: this.idx > 0, keys: ['ArrowLeft'] });
    UI.button(ctx, 'next', cx + cw - 48, cy + 30, 40, 40, '►', () => { if (this.idx < 5) { this.idx++; this.slide = 1; } }, { style: 'paper', size: 18, enabled: this.idx < 5, keys: ['ArrowRight'] });
    // launch
    const crew = Save.aboardCrew().slice(0, stats.seats);
    const cook = crew.some((c) => c.role === 'cook'), chef = crew.some((c) => c.special === 'chef');
    const food = chef ? 0 : Math.ceil(crew.length * (cook ? 0.5 : 1));
    const by = cy + ch - 66;
    const missing = unlocked ? regionNeeds(region.id, s.levels) : [];
    if (missing.length) {
      pen.use(ctx, 0.4).begin().rrect(cx + 16, by - 52, cw - 32, 44, 8).ink('#f3d8b0', 2, P.redDark);
      bodyText(ctx, 'Too dangerous for this balloon! Needs:', cx + cw / 2, by - 40, 14, P.redDark, 'center');
      inkText(ctx, missing.join(' + ').toUpperCase(), cx + cw / 2, by - 20, 15, P.redDark, { outline: 0, shadow: false });
    }
    const ready = unlocked && !missing.length;
    UI.button(ctx, 'launch', cx + 16, by, cw - 32, 54, unlocked ? (ready ? 'LAUNCH!' : 'UPGRADE FIRST') : 'LOCKED', () => (ready ? this.launch() : go(Scenes.workshop, { tab: 'basket' })), { style: ready ? 'red' : 'brass', size: ready ? 30 : 24, enabled: unlocked, keys: ['Enter'], sub: !ready ? (unlocked ? 'opens the Workshop' : undefined) : unlocked ? `${crew.length} crew aboard${food ? ` · eats ${food} food` : ''}${s.res.food < food ? ' (not enough! they\'ll go hungry)' : ''}` : undefined });
    // ---- hub buttons ----
    const bw = 150, bx = Lx, byy = T + 168;
    const canBuy = UPGRADES.some((u) => { const lv = s.levels[u.id] ?? 0; return lv < u.costs.length && canAfford(u.costs[lv]) && (!u.region || this.unlocked(u.region)) && (!u.requires || (s.levels[u.requires[0]] ?? 0) >= u.requires[1]); });
    UI.button(ctx, 'workshop', bx, byy - 58, bw, 50, 'WORKSHOP', () => go(Scenes.workshop), { style: 'brass', size: 22, keys: ['KeyU'] });
    if (canBuy) { const p = 0.5 + 0.5 * Math.sin(t * 6); pen.begin().ell(bx + bw - 4, byy - 56, 9 + p * 2, 9 + p * 2).ink(P.redBright, 2); inkText(ctx, '!', bx + bw - 4, byy - 55, 13, P.parchment, { outline: 2, shadow: false }); }
    UI.button(ctx, 'crew', bx + bw + 10, byy - 58, bw, 50, 'CREW', () => go(Scenes.crew), { style: 'teal', size: 22, keys: ['KeyR'] });
    if (s.crew.some((c) => c.injured > 0) && s.res.meds > 0) { pen.begin().ell(bx + bw * 2 + 6, byy - 56, 9, 9).ink(P.redBright, 2); inkText(ctx, '+', bx + bw * 2 + 6, byy - 55, 13, P.parchment, { outline: 2, shadow: false }); }
    UI.button(ctx, 'title', bx, H - 52 - Engine.safe.b * 0.5, 90, 38, 'MENU', () => go(Scenes.title), { style: 'ghost', size: 16, keys: ['Escape'] });
    if (Engine.portrait) drawRotate(ctx, W, H, t);
    fadeIn(ctx, t, W, H, 0.4);
  }
}
export type { BiomeId };
