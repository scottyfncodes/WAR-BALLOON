import { Engine, type Scene } from '../core/engine';
import { Input } from '../core/input';
import { Audio } from '../core/audio';
import { P } from '../render/palette';
import { inkText, bodyText } from '../render/ink';
import { clamp, easeOutCubic } from '../core/math';
import { drawBackdrop, drawPost } from './backdrop';
import { UI } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { drawMenuBalloon, intertitle } from './common';
import { PAINTS } from '../render/balloonArt';
import { Save } from '../core/save';
import { BIOMES } from '../game/biomes';

const CARDS = [
  ['The Iron Furnace went cold.'],
  ['One by one, the camps lit their lamps:', 'the Caravan, the Ferry Raft, the Greenhouse, the Station.'],
  ['The skies belonged to the balloonists again.'],
  ['And Jerry?'],
];

/** Finale after defeating the Scrap Baron. */
export class EndingScene implements Scene {
  t = 0;
  enter() { this.t = 0; Audio.playSong('haven'); Audio.fanfare(); }
  update(dt: number) { this.t += dt; UI.update(); if (this.t > 2 && (Input.hit('Enter', 'Space') || Input.downs.some((d) => !d.claimed)) && this.t > 15) go(Scenes.map); }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, t = this.t;
    drawBackdrop(ctx, W, H, t * 40, -60, t, { biome: BIOMES.city });
    // a whole flotilla of balloons in every paint Jerry earned
    const owned = PAINTS.filter((p) => Save.data.paintsUnlocked.includes(p.id));
    owned.forEach((p, i) => {
      const k = easeOutCubic(clamp((t - 1 - i * 0.6) / 4, 0, 1));
      const x = W * (0.1 + (i % 5) * 0.2) + Math.sin(t * 0.5 + i) * 20;
      const y = H * 1.3 - k * H * (0.55 + (i % 3) * 0.12);
      drawMenuBalloon(ctx, x, y, 0.35 + (i % 2) * 0.08, t + i, { paint: p.id, burner: Math.sin(t * 2 + i) > 0.3 ? 1 : 0 });
    });
    // Jerry front and centre
    drawMenuBalloon(ctx, W / 2, H * 0.84 - Math.min(1, t / 6) * 60 + Math.sin(t) * 6, 0.9, t, { expr: 'cheer', arm: t % 4 < 2 ? 'wave' : 'cheer', burner: 1, goggleDown: true });
    drawPost(ctx, W, H, t);
    const idx = Math.min(CARDS.length, Math.floor(t / 3.2));
    if (idx < CARDS.length) {
      const a = clamp((t % 3.2) / 0.4, 0, 1) * clamp((3.2 - (t % 3.2)) / 0.4, 0, 1);
      ctx.globalAlpha = a; intertitle(ctx, W / 2, H * 0.18, Math.min(640, W - 60), 60 + CARDS[idx].length * 30, CARDS[idx], 24); ctx.globalAlpha = 1;
    } else {
      const a = clamp((t - CARDS.length * 3.2) / 1, 0, 1);
      ctx.globalAlpha = a;
      inkText(ctx, 'JERRY IS STILL FLYING.', W / 2, H * 0.18, 46, P.gold, { outline: 7 });
      bodyText(ctx, 'Thanks for playing WAR BALLOON', W / 2, H * 0.28, 20, P.parchment, 'center');
      ctx.globalAlpha = 1;
      if (t > 15) bodyText(ctx, 'tap to keep flying', W / 2, H - 20, 16, 'rgba(241,223,184,0.8)', 'center');
    }
    UI.button(ctx, 'skip', W - 120 - Engine.safe.r, 14, 100, 36, 'MAP ►', () => go(Scenes.map), { style: 'ghost', size: 15, keys: ['Escape'] });
  }
}
