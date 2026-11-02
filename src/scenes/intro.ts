import { Engine, type Scene } from '../core/engine';
import { Input } from '../core/input';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { pen, inkText, bodyText } from '../render/ink';
import { clamp, easeOutCubic, easeInOut } from '../core/math';
import { drawBackdrop, drawPost } from './backdrop';
import { UI } from './ui';
import { go } from './router';
import { Scenes } from './registry';
import { drawMenuBalloon, intertitle } from './common';
import { drawZombie } from '../render/zombieArt';

/** Storybook intro: silent-film intertitles + animated vignettes. */
const BEATS = [
  { dur: 4.2, card: ['Humanity has lost the ground.'] },
  { dur: 4.6, card: ['The dead fill every street and rooftop.', 'And they never, ever stop reaching up.'] },
  { dur: 4.4, card: ['The sky is the last safe place.', 'One man still flies it…'] },
  { dur: 5.2, card: ['JERRY.'] },
];

export class IntroScene implements Scene {
  t = 0; beat = 0; bt = 0; done = false;
    enter() { this.t = 0; this.beat = 0; this.bt = 0; this.done = false; Audio.playSong('haven'); }
  update(dt: number) {
    UI.update();
    this.t += dt; this.bt += dt;
    const skip = Input.downs.some((d) => !d.claimed) || Input.hit('Space', 'Enter', 'ArrowRight');
    if (skip && this.bt > 0.5) this.next();
    if (this.bt > BEATS[this.beat].dur) this.next();
  }
  next() {
    if (this.done) return;
    if (this.beat === 2) Audio.ignite();
    if (this.beat < BEATS.length - 1) { this.beat++; this.bt = 0; Audio.click(); return; }
    this.finish();
  }
  finish() {
    if (this.done) return; this.done = true;
    Save.data.seenIntro = true; Save.write();
    const firstTime = Save.data.stats.expeditions === 0;
    go(firstTime ? Scenes.play : Scenes.haven, firstTime ? { region: 'suburbs' } : undefined);
  }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, bt = this.bt;
    const b = BEATS[this.beat];
    ctx.fillStyle = '#140c08'; ctx.fillRect(0, 0, W, H);
    // vignette scene
    ctx.save();
    if (this.beat === 0) {
      drawBackdrop(ctx, W, H, 600 + bt * 14, -40, this.t);
      // drifting embers / debris
      for (let i = 0; i < 18; i++) { const x = (i * 97 + bt * 30) % W, y = (i * 53 + bt * 50) % H; ctx.fillStyle = i % 3 ? 'rgba(42,26,20,0.5)' : 'rgba(255,181,52,0.6)'; ctx.fillRect(x, y, 3, 3); }
    } else if (this.beat === 1) {
      drawBackdrop(ctx, W, H, 1400 + bt * 40, -60, this.t);
      // a horde shambling below
      for (let i = 0; i < 14; i++) { ctx.save(); ctx.translate(((i * 83 + bt * 25) % (W + 100)) - 50, H * 0.88 + (i % 3) * 6); ctx.scale(1.6, 1.6); drawZombie(ctx, { kind: i % 5 === 0 ? 'brute' : i % 3 === 0 ? 'swarmer' : 'walker', pose: i % 2 ? 'reach' : 'walk', t: this.t + i, facing: 1, seed: i * 11 }); ctx.restore(); }
    } else {
      drawBackdrop(ctx, W, H, 2200 + bt * 6, -20, this.t);
      if (this.beat === 2) {
        // close-up on Jerry tightening goggles
        const zoom = 2.6 + bt * 0.05;
        drawMenuBalloon(ctx, W * 0.5, H * 0.55 + 70 * zoom * 0.5, zoom, this.t, { expr: bt > 2.5 ? 'determined' : 'neutral', goggleDown: bt > 2.5, arm: bt > 1.6 && bt < 2.6 ? 'cheer' : 'rest', lookX: 0.6 });
      } else {
        // liftoff!
        const k = easeInOut(clamp((bt - 1.2) / 3.5, 0, 1));
        const y = H * 0.82 - k * H * 0.75;
        drawMenuBalloon(ctx, W * 0.5 + Math.sin(bt * 2) * 6, y, 1.0, this.t, { burner: bt > 0.8 ? 1 : 0, expr: bt > 1.5 ? 'happy' : 'determined', arm: bt > 1.5 ? 'wave' : 'burn', goggleDown: true });
        // launch pad
        ctx.fillStyle = P.brownDark; ctx.fillRect(W * 0.5 - 80, H * 0.86, 160, 10);
      }
    }
    drawPost(ctx, W, H, this.t);
    ctx.restore();
    // letterbox
    ctx.fillStyle = '#140c08'; ctx.fillRect(0, 0, W, 34); ctx.fillRect(0, H - 34, W, 34);
    // film scratches
    if (Math.random() < 0.3) { ctx.strokeStyle = 'rgba(255,240,210,0.25)'; ctx.lineWidth = 1; const x = Math.random() * W; ctx.beginPath(); ctx.moveTo(x, 34); ctx.lineTo(x + Math.random() * 6, H - 34); ctx.stroke(); }
    // intertitle card fades in over the vignette
    const cardIn = easeOutCubic(clamp(bt / 0.5, 0, 1));
    const cardOut = this.beat === 3 ? clamp((bt - 1.8) / 0.5, 0, 1) : 0;
    if (cardIn > 0 && cardOut < 1) {
      ctx.save(); ctx.globalAlpha = cardIn * (1 - cardOut);
      const big = this.beat === 3;
      if (big) {
        inkText(ctx, 'JERRY.', W / 2, H * 0.24, 86, P.gold, { outline: 10 });
      } else intertitle(ctx, W / 2, H * 0.2 + 10, Math.min(620, W - 60), 60 + b.card.length * 30, b.card, 26);
      ctx.restore();
    }
    if (this.beat === 3 && bt > 2.4) {
      const a = clamp((bt - 2.4) / 0.6, 0, 1);
      ctx.globalAlpha = a;
      bodyText(ctx, '…in a very small hot air balloon.', W / 2, H * 0.18, 26, P.parchment, 'center');
      ctx.globalAlpha = 1;
    }
    UI.button(ctx, 'skip', W - 120 - Engine.safe.r, 44, 100, 36, 'SKIP ►', () => this.finish(), { style: 'ghost', size: 15, keys: ['Escape'] });
    bodyText(ctx, 'tap to continue', W / 2, H - 17, 14, 'rgba(241,223,184,0.6)', 'center');
    // pips
    for (let i = 0; i < BEATS.length; i++) { ctx.fillStyle = i <= this.beat ? P.gold : 'rgba(241,223,184,0.3)'; ctx.beginPath(); ctx.arc(24 + i * 16 + Engine.safe.l, H - 17, 4, 0, 7); ctx.fill(); }
    pen.use(ctx, 0);
  }
}
