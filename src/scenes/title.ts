import { Engine, type Scene } from '../core/engine';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { inkText, bodyText, pen } from '../render/ink';
import { easeOutBack, clamp } from '../core/math';
import { drawBackdrop, drawPost } from './backdrop';
import { UI, panel, fadeIn } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { drawMenuAirship } from './common';
import { drawZombie } from '../render/zombieArt';
import { drawRotate } from './play';

export class TitleScene implements Scene {
  t = 0; confirmReset = false;
  enter() { this.t = 0; this.confirmReset = false; Audio.playSong('haven'); }
  update(dt: number) { this.t += dt; UI.update(); }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, t = this.t;
    drawBackdrop(ctx, W, H, t * 30, -80, t);
    // balloon drifting
    const bx = W * 0.27, by = H * 0.62 + Math.sin(t * 1.3) * 10;
    drawMenuAirship(ctx, bx, by - 40, 1.05, t, { burner: Math.sin(t * 0.9) > 0.3 ? 1 : 0, expr: 'determined', arm: (t % 6) < 2 ? 'wave' : 'rest', tilt: Math.sin(t * 0.7) * 0.05 });
    // the dead reaching up from the rooftops below
    pen.use(ctx, 0.4).begin().rect(bx - 150, H * 0.9, 300, 80).ink('#4a3a32', 3);
    for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(bx - 125 + i * 50 + Math.sin(t + i) * 4, H * 0.9); ctx.scale(1.4, 1.4); drawZombie(ctx, { kind: i === 3 ? 'brute' : i === 1 ? 'swarmer' : i === 4 ? 'climber' : 'walker', pose: 'reach', t: t + i, facing: i < 3 ? 1 : -1, seed: i * 13 }); ctx.restore(); }
    drawPost(ctx, W, H, t);
    // logo
    const lx = W * 0.64, ly = H * 0.26;
    const word = (s: string, x: number, y: number, size: number, col: string, delay: number) => {
      [...s].forEach((ch, i) => {
        const k = clamp((t - delay - i * 0.06) / 0.4, 0, 1);
        if (k <= 0) return;
        ctx.font = `${size}px "Luckiest Guy"`;
        const full = ctx.measureText(s).width;
        const off = ctx.measureText(s.slice(0, i)).width;
        const cx = x - full / 2 + off + ctx.measureText(ch).width / 2;
        const bob = Math.sin(t * 3 + i * 0.6) * 3;
        ctx.save(); ctx.translate(cx, y + bob); ctx.scale(easeOutBack(k), easeOutBack(k)); ctx.rotate(Math.sin(i * 1.7) * 0.06);
        inkText(ctx, ch, 0, 0, size, col, { outline: size * 0.14 });
        ctx.restore();
      });
    };
    // banner behind
    pen.use(ctx, 0.6);
    ctx.save(); ctx.translate(lx, ly + 66); ctx.rotate(-0.03);
    pen.begin().m(-200, -18).l(200, -22).l(212, 0).l(200, 20).l(-200, 18).l(-212, 0).close().ink(P.teal, 3);
    bodyText(ctx, 'Fly. Scavenge. Rescue. Survive. Upgrade.', 0, 0, 19, P.parchment, 'center');
    ctx.restore();
    word('WAR', lx, ly - 34, 64, P.redBright, 0.1);
    word('BALLOON', lx, ly + 22, 76, P.orangeLight, 0.35);
    // buttons
    const s = Save.data;
    const started = s.stats.expeditions > 0 || s.seenIntro;
    const bw = 230, bxp = lx - bw / 2;
    if (!this.confirmReset) {
      UI.button(ctx, 'play', bxp, H * 0.5, bw, 62, started ? 'CONTINUE' : 'FLY!', () => { Audio.ignite(); go(s.seenIntro ? Scenes.haven : Scenes.intro); }, { style: 'red', size: 32, keys: ['Enter'] });
      UI.button(ctx, 'music', bxp, H * 0.5 + 76, 110, 40, s.music ? 'MUSIC ♪' : 'MUSIC ✕', () => { s.music = !s.music; Audio.setMusic(s.music); Save.write(); }, { style: s.music ? 'teal' : 'paper', size: 16 });
      UI.button(ctx, 'sfx', bxp + 120, H * 0.5 + 76, 110, 40, s.sfx ? 'SOUND ♪' : 'SOUND ✕', () => { s.sfx = !s.sfx; Audio.setSfx(s.sfx); Save.write(); }, { style: s.sfx ? 'teal' : 'paper', size: 16 });
      const dl: Record<string, string> = { relaxed: 'RELAXED', normal: 'NORMAL', hard: 'HARD' };
      const nextD: Record<string, 'relaxed' | 'normal' | 'hard'> = { relaxed: 'normal', normal: 'hard', hard: 'relaxed' };
      UI.button(ctx, 'diff', bxp + bw + 12, H * 0.5 + 76, 120, 40, dl[s.difficulty], () => { s.difficulty = nextD[s.difficulty]; Save.write(); }, { style: s.difficulty === 'hard' ? 'red' : s.difficulty === 'relaxed' ? 'olive' : 'brass', size: 15, sub: 'difficulty' });
      bodyText(ctx, s.difficulty === 'relaxed' ? '+2 hearts, slower, gentler dead' : s.difficulty === 'hard' ? '−1 heart, hungrier horde, +25% loot' : 'as intended', bxp + bw + 72, H * 0.5 + 130, 13, 'rgba(241,223,184,0.9)', 'center');
      if (started) {
        UI.button(ctx, 'intro', bxp, H * 0.5 + 126, 110, 34, 'INTRO', () => go(Scenes.intro), { style: 'ghost', size: 14 });
        UI.button(ctx, 'reset', bxp + 120, H * 0.5 + 126, 110, 34, 'NEW GAME', () => { this.confirmReset = true; }, { style: 'ghost', size: 14 });
        UI.button(ctx, 'export', bxp, H * 0.5 + 166, 110, 34, 'SAVE CODE', () => {
          const code = Save.exportCode();
          try { navigator.clipboard?.writeText(code); } catch { /* ignore */ }
          window.prompt('Your save code (copied if allowed). Keep it somewhere safe:', code);
        }, { style: 'ghost', size: 14 });
      }
      {
        UI.button(ctx, 'import', bxp + (started ? 120 : 0), H * 0.5 + (started ? 166 : 126), 110, 34, 'LOAD CODE', () => {
          const code = window.prompt('Paste a War Balloon save code:');
          if (code) { if (Save.importCode(code)) { Audio.buy(); Audio.setMusic(Save.data.music); Audio.setSfx(Save.data.sfx); } else { Audio.deny(); window.alert('That code didn\'t work — check it was copied in full.'); } }
        }, { style: 'ghost', size: 14 });
      }
    } else {
      panel(ctx, lx - 170, H * 0.48, 340, 150, { tape: true });
      bodyText(ctx, 'Scrap ALL progress and start over?', lx, H * 0.48 + 36, 20, P.ink, 'center');
      UI.button(ctx, 'yes', lx - 150, H * 0.48 + 70, 140, 50, 'SCRAP IT', () => { Save.reset(); this.confirmReset = false; Audio.explosion(1); }, { style: 'red', size: 18 });
      UI.button(ctx, 'no', lx + 10, H * 0.48 + 70, 140, 50, 'KEEP', () => { this.confirmReset = false; }, { style: 'olive', size: 18, keys: ['Escape'] });
    }
    // controls hint
    const hint = Engine.isTouch ? 'Best in landscape · Add to Home Screen for full-screen' : 'Arrows/WASD fly · B drop · H hook · X shake · F flame · Shift boost · Esc pause';
    bodyText(ctx, hint, W / 2, H - 16 - Engine.safe.b * 0.5, 15, 'rgba(241,223,184,0.85)', 'center');
    if (Engine.portrait) drawRotate(ctx, W, H, t);
    fadeIn(ctx, t, W, H, 0.6);
  }
}
