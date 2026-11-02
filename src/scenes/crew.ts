import { Engine, type Scene } from '../core/engine';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { pen, inkText, bodyText, wrapText } from '../render/ink';
import { clamp } from '../core/math';
import { UI, panel, fadeIn } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { resourceBar } from './common';
import { ROLE_INFO, SPECIALS, XP_LEVELS, MAX_LEVEL, type CrewMember } from '../game/crew';
import { computeStats } from '../game/upgrades';
import { BIOMES } from '../game/biomes';
import { drawCharacter } from '../render/characters';
import { drawCharacterMini } from '../render/crewArt';
import { drawBackdrop, drawPost } from './backdrop';
import { drawRotate } from './play';

const RAR_COL: Record<string, string> = { common: P.parchmentShade, rare: P.tealLight, legendary: P.goldLight };

/** Crew roster: who's flying, who's resting, who's lost out there. */
export class CrewScene implements Scene {
  t = 0; sel = ''; page = 0; talkT = 0;
  enter() { this.t = 0; this.page = 0; const s = Save.data; this.sel = s.crew[0]?.id ?? ''; Audio.playSong('haven'); }
  update(dt: number) { this.t += dt; this.talkT = Math.max(0, this.talkT - dt); UI.update(); }
  toggle(c: CrewMember) {
    const s = Save.data; const seats = computeStats(s.levels).seats;
    if (s.aboard.includes(c.id)) { s.aboard = s.aboard.filter((id) => id !== c.id); Audio.click(); }
    else {
      if (s.missing[c.id] || c.injured > 0) { Audio.deny(); return; }
      if (s.aboard.length >= seats) { Audio.deny(); return; }
      s.aboard.push(c.id); Audio.pickup('food'); this.talkT = 1.2;
    }
    Save.write();
  }
  heal(c: CrewMember) { const s = Save.data; if (c.injured > 0 && s.res.meds > 0) { s.res.meds--; c.injured = 0; Save.write(); Audio.pickup('meds'); this.talkT = 1.2; } else Audio.deny(); }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, s = Save.data, t = this.t;
    drawBackdrop(ctx, W, H, 200 + t * 4, -40, t, { biome: BIOMES.suburbs });
    ctx.fillStyle = 'rgba(30,18,12,0.55)'; ctx.fillRect(0, 0, W, H);
    drawPost(ctx, W, H, t);
    const T = 8 + Engine.safe.t * 0.5, Lx = 10 + Engine.safe.l;
    const seats = computeStats(s.levels).seats;
    resourceBar(ctx, Lx, T, {}, Math.min(520, W * 0.5));
    UI.button(ctx, 'back', W - 100 - Engine.safe.r, T, 90, 38, '◄ HAVEN', () => go(Scenes.haven), { style: 'ghost', size: 15, keys: ['Escape'] });
    inkText(ctx, 'THE CREW', Lx + 6, T + 64, 30, P.goldLight, { align: 'left', outline: 5 });
    const aboard = s.aboard.filter((id) => s.crew.some((c) => c.id === id)).length;
    bodyText(ctx, `Aboard ${aboard}/${seats} seats · tap a survivor, then ABOARD to bring them along`, Lx + 190, T + 64, 15, P.parchment);
    // ---- roster ----
    const lw = clamp(W * 0.5, 340, 520), ly = T + 86, lh = H - ly - 10 - Engine.safe.b * 0.5;
    panel(ctx, Lx, ly, lw, lh, { color: P.parchment });
    if (!s.crew.length) {
      const lines = wrapText(ctx, 'Nobody here yet but Jerry. Survivors wave from rooftops out in the world — hover low over them and they\'ll climb your rope ladder. Bring them home and they join the crew!', lw - 40, 17);
      lines.forEach((ln, i) => bodyText(ctx, ln, Lx + 20, ly + 40 + i * 20, 17, P.ink));
    }
    const cols = 2, cw = (lw - 24) / cols, rh = 58, per = Math.max(2, Math.floor((lh - 16) / rh) * cols);
    const pages = Math.ceil(s.crew.length / per); this.page = clamp(this.page, 0, Math.max(0, pages - 1));
    s.crew.slice(this.page * per, this.page * per + per).forEach((c, i) => {
      const cx = Lx + 8 + (i % cols) * cw, cy = ly + 8 + Math.floor(i / cols) * rh;
      const on = s.aboard.includes(c.id), lost = !!s.missing[c.id], sel = this.sel === c.id;
      UI.button(ctx, 'c' + c.id, cx, cy, cw - 6, rh - 6, '', () => { this.sel = c.id; this.talkT = 0.8; }, { style: 'none' });
      pen.use(ctx, 0.4).begin().rrect(cx, cy, cw - 6, rh - 6, 8).ink(sel ? '#f7e3a8' : on ? '#d8e8c0' : lost ? '#c8b8a8' : P.paper, sel ? 3 : 2, sel ? P.redDark : P.ink);
      ctx.save(); ctx.beginPath(); ctx.rect(cx + 2, cy + 2, 40, rh - 10); ctx.clip(); ctx.translate(cx + 22, cy + 66); ctx.scale(1.15, 1.15); drawCharacterMini(ctx, c.look, c.role, t + i, lost ? 'ko' : c.injured ? 'ko' : 'idle', 1); ctx.restore();
      const ri = ROLE_INFO[c.role];
      inkText(ctx, c.name.length > 18 ? c.name.slice(0, 17) + '…' : c.name, cx + 46, cy + 14, 13, c.rarity !== 'common' ? P.redDark : P.ink, { align: 'left', outline: 0, shadow: false });
      pen.begin().rrect(cx + 46, cy + 25, 70, 15, 4).ink(ri.color, 1.2);
      bodyText(ctx, ri.name.toUpperCase(), cx + 81, cy + 33, 12, P.parchment, 'center');
      bodyText(ctx, `Lv ${c.level}`, cx + 124, cy + 33, 13, P.ink);
      const tag = lost ? 'LOST' : c.injured ? 'HURT' : on ? 'ABOARD' : '';
      if (tag) inkText(ctx, tag, cx + cw - 12, cy + 42, 11, lost || c.injured ? P.redDark : P.oliveDark, { align: 'right', outline: 0, shadow: false });
      if (c.rarity !== 'common') { const p = 0.6 + 0.4 * Math.sin(t * 4); ctx.fillStyle = RAR_COL[c.rarity]; ctx.globalAlpha = p; ctx.beginPath(); ctx.arc(cx + cw - 16, cy + 12, 5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    });
    if (pages > 1) {
      UI.button(ctx, 'pu', Lx + lw - 80, ly + lh - 36, 34, 28, '▲', () => { this.page--; }, { style: 'paper', size: 13, enabled: this.page > 0 });
      UI.button(ctx, 'pd', Lx + lw - 42, ly + lh - 36, 34, 28, '▼', () => { this.page++; }, { style: 'paper', size: 13, enabled: this.page < pages - 1 });
    }
    // ---- detail ----
    const c = s.crew.find((q) => q.id === this.sel);
    const dx = Lx + lw + 10, dw = W - dx - 10 - Engine.safe.r, dy = ly, dh = lh;
    if (!c || dw < 200) return this.finish(ctx, W, H, t);
    panel(ctx, dx, dy, dw, dh, { color: P.paper, tape: true });
    const ri = ROLE_INFO[c.role];
    ctx.save(); ctx.beginPath(); ctx.rect(dx + 4, dy + 4, 130, 150); ctx.clip();
    ctx.translate(dx + 70, dy + 184); ctx.scale(0.8, 0.8); drawCharacter(ctx, c.look, t, this.talkT > 0, 0); ctx.restore();
    const tx = dx + 140;
    inkText(ctx, c.name, tx, dy + 24, c.name.length > 16 ? 15 : 19, P.redDark, { align: 'left', outline: 0, shadow: false });
    bodyText(ctx, `${c.rarity === 'common' ? '' : c.rarity.toUpperCase() + ' · '}${c.trait}`, tx, dy + 46, 15, c.rarity === 'common' ? P.inkSoft : P.tealDark);
    pen.use(ctx, 0.3).begin().rrect(tx, dy + 58, 96, 20, 5).ink(ri.color, 1.5);
    bodyText(ctx, ri.name.toUpperCase(), tx + 48, dy + 69, 14, P.parchment, 'center');
    // level + XP
    inkText(ctx, `LEVEL ${c.level}`, tx, dy + 96, 15, P.ink, { align: 'left', outline: 0, shadow: false });
    const next = XP_LEVELS[c.level] ?? XP_LEVELS[XP_LEVELS.length - 1], prev = XP_LEVELS[c.level - 1];
    const k = c.level >= MAX_LEVEL ? 1 : (c.xp - prev) / (next - prev);
    ctx.fillStyle = 'rgba(42,26,20,0.2)'; ctx.fillRect(tx + 70, dy + 90, dw - 160, 10); ctx.fillStyle = P.gold; ctx.fillRect(tx + 70, dy + 90, (dw - 160) * clamp(k, 0, 1), 10);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2; ctx.strokeRect(tx + 70, dy + 90, dw - 160, 10);
    bodyText(ctx, `${c.trips} trips · ${c.kills} zombies`, tx, dy + 118, 14, P.inkSoft);
    let yy = dy + 164;
    const para = (txt: string, col: string = P.ink, size = 15) => { for (const ln of wrapText(ctx, txt, dw - 28, size)) { if (yy > dy + dh - 74) return; bodyText(ctx, ln, dx + 14, yy, size, col); yy += size + 3; } yy += 4; };
    para(`"${c.bio}"`, P.inkSoft);
    para(`${ri.blurb} Level ${c.level}: ${ri.perLevel} (+${(c.level - 1) * 25}%).`);
    if (c.special) para(`★ ${SPECIALS[c.special].name}: ${SPECIALS[c.special].desc}`, P.tealDark);
    if (c.from) para(`Rescued in ${c.from}.`, P.inkSoft, 13);
    // actions
    const lost = s.missing[c.id];
    const by = dy + dh - 58;
    if (lost) bodyText(ctx, `Lost in ${BIOMES[lost].name}. Fly there to find them!`, dx + dw / 2, by + 22, 15, P.redDark, 'center');
    else {
      const on = s.aboard.includes(c.id);
      const full = !on && s.aboard.length >= seats;
      UI.button(ctx, 'tog', dx + 12, by, dw / 2 - 18, 46, on ? 'STAY HOME' : 'ABOARD', () => this.toggle(c), { style: on ? 'paper' : 'olive', size: 18, enabled: !c.injured && !full, sub: full ? 'no seats — upgrade basket' : undefined });
      if (c.injured) UI.button(ctx, 'heal', dx + dw / 2 + 6, by, dw / 2 - 18, 46, 'HEAL', () => this.heal(c), { style: 'red', size: 18, enabled: s.res.meds > 0, sub: `1 meds · hurt ${c.injured} trip${c.injured > 1 ? 's' : ''}` });
    }
    this.finish(ctx, W, H, t);
  }
  private finish(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
    if (Engine.portrait) drawRotate(ctx, W, H, t);
    fadeIn(ctx, t, W, H, 0.3);
  }
}
