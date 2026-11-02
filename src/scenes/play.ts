import { Engine, type Scene } from '../core/engine';
import { Input } from '../core/input';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { P } from '../render/palette';
import { pen, inkText, bodyText, wrapText, FONT_BODY } from '../render/ink';
import { clamp, easeOutBack, TAU } from '../core/math';
import { World } from '../game/world';
import { computeStats } from '../game/upgrades';
import { drawItemIcon, POWER_INFO } from '../game/entities';
import type { Controls } from '../game/player';
import type { MissionSpec } from '../game/types';
import { drawBackdrop, drawPost, drawAmbient } from './backdrop';
import { TouchControls } from './touch';
import { UI, panel, ribbon, fadeIn } from './ui';
import { go } from './router';
import { Scenes } from './registry';

export class PlayScene implements Scene {
  w!: World; spec!: MissionSpec; touch = new TouchControls();
  paused = false; t = 0; ended = false; provisions = false; objH = 90;
  enter(data: { mission: MissionSpec }) {
    this.spec = data.mission;
    const s = Save.data;
    this.provisions = s.provisions && s.res.food >= 1 && s.res.water >= 1;
    if (this.provisions) { s.res.food--; s.res.water--; Save.write(); }
    const assist = (s.fails[this.spec.id] ?? 0) >= 2 ? 1 : 0;
    this.w = new World(this.spec, computeStats(s.levels), s.levels, s.paint, this.provisions, assist);
    this.w.viewW = Engine.W; this.w.viewH = Engine.H;
    this.touch = new TouchControls(); this.touch.visible = Engine.isTouch || Input.usingTouch;
    this.touch.boostEnabled = this.w.player.stats.boost > 0;
    this.paused = false; this.t = 0; this.ended = false;
    Audio.playSong(this.spec.music);
    this.w.banner(this.spec.name.toUpperCase(), this.spec.objectives.filter((o) => !o.optional).map((o) => o.text).join(' · ') || 'Grab everything & head home', P.parchment);
    if (assist) this.w.banner('SPARE PATCH!', 'Granny stitched an extra patch on for this try', P.tealLight);
    Save.data.totalRuns++; Save.write();
  }
  exit() { Audio.burner(0); Audio.wind(0); }
  onBlur() { if (!this.ended) this.paused = true; Audio.burner(0); }
  update(dt: number) {
    UI.update();
    this.t += dt;
    if (Input.hit('Escape', 'KeyP')) { this.paused = !this.paused; Audio.click(); }
    if (this.paused || Engine.portrait) { Audio.burner(0); Audio.wind(0); return; }
    this.w.viewW = Engine.W; this.w.viewH = Engine.H;
    const c: Controls = { x: 0, y: 0, bomb: false, hook: false, boost: false };
    c.x = (Input.down('ArrowRight', 'KeyD') ? 1 : 0) - (Input.down('ArrowLeft', 'KeyA') ? 1 : 0);
    c.y = (Input.down('ArrowDown', 'KeyS') ? 1 : 0) - (Input.down('ArrowUp', 'KeyW', 'Space') ? 1 : 0);
    c.bomb = Input.hit('KeyB', 'KeyJ', 'KeyX');
    c.hook = Input.hit('KeyH', 'KeyK', 'KeyC', 'KeyE');
    c.boost = Input.hit('ShiftLeft', 'ShiftRight', 'KeyL');
    this.touch.update(70 + Engine.safe.t);
    this.touch.merge(c);
    this.w.update(c, dt);
    if (this.w.state !== 'play' && this.w.endT > (this.w.state === 'complete' ? 2.4 : 2.8) && !this.ended) {
      this.ended = true;
      go(Scenes.results, { mission: this.spec, world: this.w, success: this.w.state === 'complete', provisions: this.provisions });
    }
  }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, w = this.w;
    const shake = w.fx.shake;
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    drawBackdrop(ctx, W, H, w.camX, w.camY, w.time, { biome: w.biome });
    ctx.save();
    ctx.translate(-Math.round(w.camX) + sx, -Math.round(w.camY) + sy);
    w.drawWorld(ctx);
    ctx.restore();
    drawAmbient(ctx, W, H, w.biome, w.time, w.camX, w.stormLevel * (Engine.quality < 1.6 ? 0.55 : 1), w.wind);
    if (w.stormLevel > 1.2) { ctx.fillStyle = w.biome.id === 'frozen' ? `rgba(240,245,250,${(w.stormLevel - 1) * 0.12})` : `rgba(220,170,100,${(w.stormLevel - 1) * 0.14})`; ctx.fillRect(0, 0, W, H); }
    if (w.fx.flash > 0) { ctx.fillStyle = `rgba(226,73,58,${w.fx.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
    drawPost(ctx, W, H, w.time);
    w.boss?.drawIntro(ctx, W, H);
    this.drawHUD(ctx);
    this.touch.boostEnabled = w.player.stats.boost > 0;
    this.touch.draw(ctx, { bombs: w.player.bombs, hookOut: w.player.hookState !== 'stowed', boostReady: w.player.boostCd <= 0 });
    if (w.state === 'complete' && w.endT > 0.3) ribbon(ctx, W / 2, H * 0.36, 380, 'MISSION COMPLETE!', P.olive, 34);
    if (w.state === 'failed' && w.endT > 0.6) ribbon(ctx, W / 2, H * 0.36, 320, 'BALLOON DOWN!', P.red, 34);
    if (this.paused) this.drawPause(ctx);
    if (Engine.portrait) drawRotate(ctx, W, H, this.t);
    fadeIn(ctx, this.t, W, H, 0.01);
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    const W = Engine.W, H = Engine.H, w = this.w, p = w.player;
    const L = 12 + Engine.safe.l, T = 10 + Engine.safe.t * 0.5;
    pen.use(ctx, 0.4);
    // ---------- gauge cluster (fuel dial + patches + bombs) ----------
    const gw = 96 + Math.max(p.maxHp * 22, p.stats.bombCap * 15, 66);
    panel(ctx, L, T, gw, 74, { color: '#3b2a20', border: 3, shadow: true });
    // fuel dial
    const gx = L + 38, gy = T + 40, gr = 28;
    pen.begin().ell(gx, gy, gr, gr).ink(P.parchment, 3);
    pen.begin().ell(gx, gy, gr + 4, gr + 4).stroke(3, P.brass);
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
    ctx.lineWidth = 5; ctx.strokeStyle = P.redBright; ctx.beginPath(); ctx.arc(gx, gy, gr - 6, a0, a0 + (a1 - a0) * 0.2); ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5;
    for (let i = 0; i <= 8; i++) { const a = a0 + (a1 - a0) * (i / 8); ctx.beginPath(); ctx.moveTo(gx + Math.cos(a) * (gr - 2), gy + Math.sin(a) * (gr - 2)); ctx.lineTo(gx + Math.cos(a) * (gr - 8), gy + Math.sin(a) * (gr - 8)); ctx.stroke(); }
    const fk = p.hotairT > 0 ? 1 : clamp(p.fuel / p.maxFuel, 0, 1);
    const na = a0 + (a1 - a0) * fk + Math.sin(w.time * 30) * 0.02 * (p.burnerOn ? 1 : 0);
    pen.begin().m(gx, gy).l(gx + Math.cos(na) * (gr - 6), gy + Math.sin(na) * (gr - 6)).stroke(3, P.red);
    pen.begin().ell(gx, gy, 4, 4).ink(P.brass, 1.5);
    bodyText(ctx, 'FUEL', gx, gy + 14, 11, P.ink, 'center');
    if (p.ice > 0.3) { ctx.fillStyle = `rgba(200,230,245,${0.4 + p.ice * 0.4})`; ctx.fillRect(gx - 30, gy + 30, 60 * p.ice, 4); if (Math.sin(w.time * 6) > 0) inkText(ctx, 'ICING!', gx + 60, T + 92, 13, P.tealLight, { outline: 3 }); }
    if (fk < 0.2 && Math.sin(w.time * 10) > 0) inkText(ctx, p.fuel <= 0 ? 'EMPTY!' : 'LOW FUEL', gx + 2, T + 92, 13, P.redBright, { outline: 3 });
    // patches (hp)
    bodyText(ctx, 'PATCHES', L + 78, T + 18, 13, P.parchment);
    for (let i = 0; i < p.maxHp; i++) {
      const px = L + 84 + i * 22, py = T + 36;
      const full = i < p.hp;
      ctx.save(); ctx.translate(px, py); ctx.rotate((i % 2 ? 1 : -1) * 0.12);
      pen.begin().rect(-8, -8, 16, 16).ink(full ? (i === 0 && p.hp === 1 && Math.sin(w.time * 8) > 0 ? P.redBright : P.orange) : 'rgba(0,0,0,0.3)', 2);
      if (full) { ctx.strokeStyle = P.parchment; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.strokeRect(-5, -5, 10, 10); ctx.setLineDash([]); }
      ctx.restore();
    }
    // bombs
    for (let i = 0; i < p.stats.bombCap; i++) {
      const bx = L + 84 + i * 15, by = T + 60;
      if (i < p.bombs) { pen.begin().ell(bx, by, 6, 6).ink(P.ink, 1.5); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(bx - 2, by - 2, 1.6, 0, 7); ctx.fill(); }
      else if (i === p.bombs) { ctx.strokeStyle = P.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 5, -Math.PI / 2, -Math.PI / 2 + TAU * (p.reload / p.stats.reloadTime)); ctx.stroke(); }
      else { ctx.strokeStyle = 'rgba(241,223,184,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, 5, 0, TAU); ctx.stroke(); }
    }
    // power-up timers + cargo info under cluster
    let py2 = T + 98;
    const timers: [string, number, number][] = [];
    if (p.clusterT > 0) timers.push([POWER_INFO.cluster.name, p.clusterT, POWER_INFO.cluster.dur]);
    if (p.hotairT > 0) timers.push([POWER_INFO.hotair.name, p.hotairT, POWER_INFO.hotair.dur]);
    if (p.shield) timers.push([POWER_INFO.shield.name, 1, 1]);
    for (const [name, tl, max] of timers) {
      ctx.fillStyle = 'rgba(42,26,20,0.7)'; ctx.fillRect(L, py2 - 9, 150, 18);
      ctx.fillStyle = P.gold; ctx.fillRect(L + 2, py2 + 5, 146 * (tl / max), 3);
      bodyText(ctx, name, L + 6, py2 - 1, 13, P.parchment); py2 += 22;
    }
    // collected resources this sortie
    const keys = ['scrap', 'fabric', 'fuel', 'food', 'water', 'electronics'] as const;
    let rx = L + 4;
    for (const k of keys) {
      const n = w.collected[k]; if (!n) continue;
      ctx.save(); ctx.translate(rx + 9, py2 + 4); ctx.scale(0.75, 0.75); drawItemIcon(ctx, k, 11, w.time); ctx.restore();
      inkText(ctx, String(n), rx + 24, py2 + 6, 15, P.parchment, { outline: 3, align: 'left', shadow: false });
      rx += 46;
    }
    // ---------- objectives (top center) ----------
    const objs = w.objectives;
    const ow = clamp(W * 0.27, 240, 300);
    {
      const ox = W - ow - 12 - Engine.safe.r - 54, oy = T;
      const lines = objs.slice(0, 4);
      panel(ctx, ox, oy, ow, 14 + lines.length * 19, { color: P.parchment, rot: 0, border: 2.5 });
      this.objH = oy + 14 + lines.length * 19;
      lines.forEach((o, i) => {
        const yy = oy + 16 + i * 19;
        const box = o.done ? P.olive : o.failed ? P.red : P.paper;
        pen.begin().rect(ox + 10, yy - 7, 13, 13).ink(box, 2);
        if (o.done) pen.begin().m(ox + 12, yy).l(ox + 16, yy + 4).l(ox + 22, yy - 6).stroke(2.5, P.parchment);
        if (o.failed) pen.begin().m(ox + 12, yy - 5).l(ox + 21, yy + 4).m(ox + 21, yy - 5).l(ox + 12, yy + 4).stroke(2, P.parchment);
        const need = o.spec.count ?? 1;
        const txt = (o.spec.optional ? '★ ' : '') + o.spec.text + (need > 1 ? `  ${o.progress}/${need}` : '');
        ctx.font = `15px ${FONT_BODY}`;
        let s = txt; while (ctx.measureText(s).width > ow - 40 && s.length > 4) s = s.slice(0, -2);
        if (s !== txt) s += '…';
        bodyText(ctx, s, ox + 30, yy + 1, 15, o.done ? P.oliveDark : o.failed ? P.redDark : P.ink);
      });
      if (w.exitReady && w.state === 'play' && objs.some((o) => !o.spec.optional)) {
        const k = 0.5 + 0.5 * Math.sin(w.time * 5);
        inkText(ctx, 'HEAD HOME →', ox + ow / 2, oy + 30 + lines.length * 19, 16, k > 0.5 ? P.goldLight : P.gold, { outline: 3 });
      }
    }
    // ---------- pause button ----------
    const pb = 46;
    UI.button(ctx, 'pause', W - pb - 12 - Engine.safe.r, T, pb, pb, '', () => { this.paused = !this.paused; }, { style: 'brass', keys: [] });
    pen.begin().rect(W - pb - 12 - Engine.safe.r + 15, T + 12, 5, 18).fill(P.ink);
    pen.begin().rect(W - pb - 12 - Engine.safe.r + 26, T + 12, 5, 18).fill(P.ink);
    // ---------- off-screen pointers ----------
    for (const ptr of w.pointers()) {
      const sx = ptr.x - w.camX, sy = ptr.y - w.camY;
      const cx = clamp(sx, 40, W - 40), cy = clamp(sy, 110, H - 40);
      const ang = Math.atan2(sy - cy, sx - cx);
      ctx.save(); ctx.translate(cx, cy);
      ctx.save(); ctx.rotate(ang);
      pen.begin().m(18, 0).l(2, -10).l(2, 10).close().ink(ptr.color, 2.5);
      ctx.restore();
      pen.begin().ell(0, 0, 14, 14).ink(P.ink, 0);
      inkText(ctx, ptr.label, 0, 1, ptr.label.length > 2 ? 9 : 14, ptr.color, { outline: 2, shadow: false });
      ctx.restore();
    }
    // ---------- tutorial hint ----------
    const h = w.activeHint;
    if (h && w.state === 'play') {
      const text = (this.touch.visible && h.touchText) ? h.touchText : h.text;
      const hw = clamp(W * 0.36, 300, 420);
      const lines = wrapText(ctx, text, hw - 70, 18);
      const hh = 20 + lines.length * 20;
      const k = clamp(h.t / 0.3, 0, 1);
      const hx = W - hw - 16 - Engine.safe.r, hy = this.objH + 14 + (w.exitReady ? 20 : 0);
      ctx.save();
      ctx.globalAlpha = h.done ? clamp(1 - h.doneT / 0.7, 0, 1) : 1;
      ctx.translate(hx + hw / 2, hy + hh / 2); ctx.scale(easeOutBack(k), easeOutBack(k)); ctx.translate(-hx - hw / 2, -(hy + hh / 2));
      panel(ctx, hx, hy, hw, hh, { color: P.paper, tape: true, rot: -0.01 });
      // Jerry's little pointing glove
      pen.begin().ell(hx + 30, hy + hh / 2, 13, 11).ink(P.glove, 2.5);
      pen.begin().m(hx + 40, hy + hh / 2 - 3).l(hx + 52 + Math.sin(w.time * 8) * 3, hy + hh / 2 - 3).stroke(5, P.ink);
      pen.begin().m(hx + 40, hy + hh / 2 - 3).l(hx + 51 + Math.sin(w.time * 8) * 3, hy + hh / 2 - 3).stroke(3, P.glove);
      lines.forEach((ln, i) => bodyText(ctx, ln, hx + 62, hy + 20 + i * 20, 18, h.done ? P.oliveDark : P.ink));
      ctx.restore();
    }
    // ---------- banners ----------
    const b = w.banners[0];
    if (b) {
      const k = 2.6 - b.t;
      const s = k < 0.3 ? easeOutBack(k / 0.3) : 1;
      const a = b.t < 0.4 ? b.t / 0.4 : 1;
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(clamp(W * 0.66, 330, W - 220), H * 0.42); ctx.scale(s, s);
      inkText(ctx, b.text, 0, 0, 40, b.color ?? P.gold, { outline: 6 });
      if (b.sub) { ctx.font = `20px ${FONT_BODY}`; inkText(ctx, b.sub, 0, 34, 20, P.parchment, { outline: 4, font: FONT_BODY }); }
      ctx.restore();
    }
  }

  private drawPause(ctx: CanvasRenderingContext2D) {
    const W = Engine.W, H = Engine.H;
    ctx.fillStyle = 'rgba(20,12,8,0.6)'; ctx.fillRect(0, 0, W, H);
    const pw = 340, ph = 330, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    panel(ctx, px, py, pw, ph, { tape: true });
    inkText(ctx, 'PAUSED', W / 2, py + 40, 38, P.gold, { outline: 6 });
    bodyText(ctx, this.spec.name + ' — ' + this.spec.subtitle, W / 2, py + 72, 16, P.inkSoft, 'center');
    const bw = 240, bx = W / 2 - bw / 2;
    UI.button(ctx, 'resume', bx, py + 92, bw, 50, 'RESUME', () => { this.paused = false; }, { style: 'olive', keys: ['Escape'] });
    UI.button(ctx, 'restart', bx, py + 150, bw, 44, 'RESTART', () => { this.paused = false; go(Scenes.play, { mission: this.spec }); }, { style: 'brass' });
    UI.button(ctx, 'abandon', bx, py + 202, bw, 44, 'BACK TO MAP', () => { this.paused = false; Audio.burner(0); go(Scenes.map); }, { style: 'red' });
    const s = Save.data;
    UI.button(ctx, 'music', bx, py + 258, 116, 40, s.music ? 'MUSIC ON' : 'MUSIC OFF', () => { s.music = !s.music; Audio.setMusic(s.music); Save.write(); }, { style: s.music ? 'teal' : 'paper', size: 16 });
    UI.button(ctx, 'sfx', bx + 124, py + 258, 116, 40, s.sfx ? 'SOUND ON' : 'SOUND OFF', () => { s.sfx = !s.sfx; Audio.setSfx(s.sfx); Save.write(); }, { style: s.sfx ? 'teal' : 'paper', size: 16 });
  }
}

export function drawRotate(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  ctx.fillStyle = '#2b1d16'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2 - 40);
  const a = Math.min(1, (t % 2.4) / 1.2) * Math.PI / 2;
  ctx.rotate(-a);
  pen.use(ctx, 0.6).begin().rrect(-40, -70, 80, 140, 12).ink(P.parchment, 4);
  pen.begin().rect(-30, -56, 60, 104).fill(P.teal);
  ctx.restore();
  inkText(ctx, 'TURN SIDEWAYS!', W / 2, H / 2 + 90, 34, P.gold, { outline: 5 });
  bodyText(ctx, 'War Balloon flies best in landscape.', W / 2, H / 2 + 128, 20, P.parchment, 'center');
}
