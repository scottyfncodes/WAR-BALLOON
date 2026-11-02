import { Engine, type Scene } from '../core/engine';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { inkText, bodyText, pen } from '../render/ink';
import { clamp, easeOutBack } from '../core/math';
import { UI, panel, fadeIn, ribbon } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { drawBackdrop, drawPost } from './backdrop';
import { RES_KEYS, drawResIcon, RES_LABEL } from '../game/resources';
import { ROLE_INFO } from '../game/crew';
import { BIOMES, BIOME_ORDER, regionNeeds } from '../game/biomes';
import { trophyById } from '../game/cosmetics';
import { UPGRADES } from '../game/upgrades';
import { canAfford } from './common';
import { drawCharacterMini } from '../render/crewArt';
import { FX } from '../game/fx';
import type { Report } from '../game/expedition';

/** Expedition report: what came home, who came home, and what to buy next. */
export class ReportScene implements Scene {
  t = 0; r!: Report; fx = new FX(); ticked = 0;
  enter(d: { report: Report }) {
    this.r = d.report; this.t = 0; this.fx = new FX(); this.ticked = 0;
    Audio.playSong('haven');
    if (this.r.success) Audio.fanfare(); else Audio.sadTrombone();
  }
  update(dt: number) {
    this.t += dt; UI.update(); this.fx.update(dt);
    const n = Math.floor(this.t / 0.25);
    if (n > this.ticked && n <= 8) { this.ticked = n; Audio.coin(); }
    if (this.r.success && Math.random() < dt * 2 && this.t < 4) this.fx.confetti(Engine.W * Math.random(), 0, 8);
  }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, r = this.r, t = this.t;
    drawBackdrop(ctx, W, H, t * 10, -40, t, { biome: BIOMES[r.region] });
    ctx.fillStyle = 'rgba(30,18,12,0.45)'; ctx.fillRect(0, 0, W, H);
    drawPost(ctx, W, H, t);
    const T = 10 + Engine.safe.t * 0.5;
    ribbon(ctx, W / 2, T + 30, Math.min(420, W * 0.5), r.success ? 'WELCOME HOME!' : 'BALLOON DOWN', r.success ? P.olive : P.red, 28);
    const sub = r.success ? `${BIOMES[r.region].name} · ${r.kills} zombies dealt with · ${r.maxHangers} on the basket at once` : r.why === 'bail' ? 'Jerry bailed out and limped home with what fit in his pockets.' : r.why === 'envelope' ? 'The envelope tore open. Jerry crash-landed and crawled home.' : r.why === 'fuel' ? 'Out of fuel and stranded. Jerry walked home with what he could carry.' : 'The dead overran the basket. Jerry barely made it back.';
    bodyText(ctx, sub, W / 2, T + 70, 16, P.parchment, 'center');
    const pw = Math.min(W - 30, 900), px = W / 2 - pw / 2, py = T + 88, ph = H - py - 70 - Engine.safe.b * 0.5;
    const colW = pw / 3 - 8;
    // loot
    panel(ctx, px, py, colW, ph, { color: P.parchment });
    inkText(ctx, 'SUPPLIES', px + colW / 2, py + 20, 18, P.redDark, { outline: 0, shadow: false });
    let any = false;
    RES_KEYS.forEach((k, i) => {
      const n = r.gains[k]; if (!n) return; any = true;
      const kk = clamp((t - i * 0.25) / 0.3, 0, 1); if (kk <= 0) return;
      const yy = py + 46 + RES_KEYS.slice(0, i).filter((q) => r.gains[q]).length * 24;
      ctx.save(); ctx.translate(px + 26, yy); ctx.scale(0.8 * easeOutBack(kk), 0.8 * easeOutBack(kk)); drawResIcon(ctx, k, 11, t); ctx.restore();
      bodyText(ctx, RES_LABEL[k], px + 44, yy, 15, P.ink);
      inkText(ctx, '+' + n, px + colW - 16, yy, 17, P.oliveDark, { align: 'right', outline: 0, shadow: false });
    });
    if (!any) bodyText(ctx, 'Nothing made it back…', px + colW / 2, py + 60, 15, P.inkSoft, 'center');
    if (r.foodUsed) bodyText(ctx, `Crew ate ${r.foodUsed} food`, px + colW / 2, py + ph - 40, 13, P.inkSoft, 'center');
    if (r.trophies.length) bodyText(ctx, '★ ' + r.trophies.map((id) => trophyById(id)?.name).join(', '), px + colW / 2, py + ph - 20, 13, P.tealDark, 'center');
    // people
    const cx = px + colW + 12;
    panel(ctx, cx, py, colW, ph, { color: P.parchment });
    inkText(ctx, 'PEOPLE', cx + colW / 2, py + 20, 18, P.redDark, { outline: 0, shadow: false });
    let yy = py + 44;
    const line = (txt: string, col: string = P.ink, size = 14) => { if (yy < py + ph - 12) { bodyText(ctx, txt.length > 34 ? txt.slice(0, 33) + '…' : txt, cx + 12, yy, size, col); yy += size + 5; } };
    if (r.rescued.length) {
      r.rescued.forEach((m, i) => {
        if (yy > py + ph - 40) return;
        ctx.save(); ctx.translate(cx + 22, yy + 14); ctx.scale(0.6, 0.6); drawCharacterMini(ctx, m.look, m.role, t + i, 'cheer', 1); ctx.restore();
        bodyText(ctx, m.name, cx + 42, yy - 1, 14, m.rarity === 'common' ? P.ink : P.tealDark);
        bodyText(ctx, `${ROLE_INFO[m.role].name} joins Haven!`, cx + 42, yy + 14, 13, P.oliveDark);
        yy += 36;
      });
    } else line('No new survivors this time.', P.inkSoft);
    for (const x of r.xp) line(`${x.m.name.split(' ')[0]} +${x.gained} XP${x.leveled ? `  ▲ LEVEL ${x.m.level}!` : ''}`, x.leveled ? P.tealDark : P.ink);
    for (const m of r.injured) line(`${m.name.split(' ')[0]} is hurt (needs rest or meds)`, P.redDark, 13);
    for (const m of r.lost) line(`${m.name.split(' ')[0]} is LOST in ${BIOMES[r.region].short} — go find them!`, P.redDark, 13);
    // progress / next
    const nx = cx + colW + 12;
    panel(ctx, nx, py, colW, ph, { color: P.parchment });
    inkText(ctx, 'WHAT\'S NEXT', nx + colW / 2, py + 20, 18, P.redDark, { outline: 0, shadow: false });
    yy = py + 44;
    const nl = (txt: string, col: string = P.ink, size = 14) => { if (yy < py + ph - 12) { bodyText(ctx, txt, nx + 12, yy, size, col); yy += size + 6; } };
    if (r.firstBeacon) {
      const nxt = BIOME_ORDER[BIOME_ORDER.indexOf(r.region) + 1];
      nl('★ BEACON LIT!', P.oliveDark, 17);
      if (nxt) { nl(`Unlocked: ${BIOMES[nxt].name}`, P.tealDark, 15); const miss = regionNeeds(nxt, Save.data.levels); if (miss.length) nl(`…needs ${miss.join(' + ')}`, P.redDark, 13); } else nl('The Dead Zone is beaten!', P.tealDark, 15);
    } else if (r.beaconLost) { nl('Beacon lit… but the signal died', P.redDark, 15); nl('with the balloon. Get it HOME next time!', P.redDark, 14); }
    else if (!Save.data.regions[r.region]?.beacon) nl(`Beacon still dark (${Math.round(r.dist / BIOMES[r.region].length * 100)}% of the way)`, P.inkSoft);
    const s = Save.data;
    const affordable = UPGRADES.filter((u) => { const lv = s.levels[u.id] ?? 0; return lv < u.costs.length && canAfford(u.costs[lv]) && (!u.region || Save.regionUnlocked(u.region, BIOME_ORDER)) && (!u.requires || (s.levels[u.requires[0]] ?? 0) >= u.requires[1]); });
    if (affordable.length) { nl('You can afford:', P.ink, 15); for (const u of affordable.slice(0, 5)) nl('• ' + u.name, P.oliveDark); }
    else nl('Save up — every trip counts.', P.inkSoft);
    if (s.crew.length && s.aboard.length < 1) nl('Tip: put crew ABOARD in the Crew screen!', P.redDark, 13);
    // buttons
    const by = H - 58 - Engine.safe.b * 0.5;
    UI.button(ctx, 'haven', W / 2 - 240, by, 150, 48, 'HAVEN', () => go(Scenes.haven), { style: 'olive', size: 20, keys: ['Enter', 'Escape'] });
    UI.button(ctx, 'shop', W / 2 - 80, by, 160, 48, 'WORKSHOP', () => go(Scenes.workshop), { style: 'brass', size: 20, sub: affordable.length ? `${affordable.length} upgrades ready` : undefined });
    UI.button(ctx, 'again', W / 2 + 90, by, 150, 48, 'FLY AGAIN', () => { Audio.ignite(); go(Scenes.play, { region: r.region }); }, { style: 'red', size: 20 });
    if (r.firstBeacon && r.region === 'deadzone') UI.button(ctx, 'end', W / 2 - 75, by - 54, 150, 42, 'THE END?', () => go(Scenes.ending), { style: 'teal', size: 18 });
    this.fx.draw(ctx); this.fx.drawText(ctx);
    pen.use(ctx, 0);
    fadeIn(ctx, t, W, H, 0.3);
  }
}
