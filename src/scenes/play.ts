import { Engine, type Scene } from '../core/engine';
import { Input } from '../core/input';
import { Audio } from '../core/audio';
import { Save, calmFx } from '../core/save';
import { P } from '../render/palette';
import { pen, inkText, bodyText, wrapText, FONT_BODY } from '../render/ink';
import { clamp, easeOutBack } from '../core/math';
import { Expedition, settle } from '../game/expedition';
import type { Controls } from '../game/airship';
import { S } from '../game/airship';
import { RES_KEYS, drawResIcon } from '../game/resources';
import { ROLE_INFO } from '../game/crew';
import { BIOMES, type BiomeId } from '../game/biomes';
import { drawBackdrop, drawPost, drawAmbient } from './backdrop';
import { TouchControls, drawBtnIcon } from './touch';
import { UI, panel, ribbon, fadeIn } from './ui';
import { go } from './router';
import { Scenes } from './registry';

export class PlayScene implements Scene {
  e!: Expedition; touch = new TouchControls(); region: BiomeId = 'suburbs';
  paused = false; t = 0; ended = false; confirmBail = false;
  /** kept for the debug/test hook */
  get w() { return this.e; }
  enter(data?: { region?: BiomeId; seed?: number }) {
    this.region = (data?.region && BIOMES[data.region]) ? data.region : Save.data.region;
    this.e = new Expedition(this.region, data?.seed);
    const s = Save.data;
    // feed the crew before take-off
    const crew = this.e.ship.crew;
    const chef = crew.some((c) => c.m.special === 'chef'), cook = crew.some((c) => c.m.role === 'cook');
    const food = chef ? 0 : Math.ceil(crew.length * (cook ? 0.5 : 1));
    this.e.foodUsed = Math.min(food, s.res.food); s.res.food -= this.e.foodUsed; Save.write();
    if (this.e.foodUsed < food) { for (const c of crew) c.hp = Math.max(1, c.max - 1); this.e.banner('HUNGRY CREW', 'Not enough food — everyone starts weak', P.redBright); }
    this.e.viewW = Engine.W; this.e.viewH = Engine.H;
    this.touch = new TouchControls(); this.touch.visible = Engine.isTouch || Input.usingTouch; this.touch.lefty = s.lefty;
    this.paused = false; this.t = 0; this.ended = false; this.confirmBail = false;
    Audio.playSong(this.e.region.music);
    this.e.banner(this.e.region.name.toUpperCase(), this.e.beaconWasLit ? 'Scavenge, rescue — and get home alive' : 'Light the BEACON at the far end · bring the signal home', P.parchment);
  }
  exit() { Audio.burner(0); Audio.wind(0); }
  onBlur() { if (!this.ended) this.paused = true; Audio.burner(0); }
  update(dt: number) {
    UI.update();
    this.t += dt;
    if (Input.hit('Escape', 'KeyP')) { this.paused = !this.paused; this.confirmBail = false; Audio.click(); }
    if (this.paused || Engine.portrait) { Audio.burner(0); Audio.wind(0); return; }
    const e = this.e;
    e.viewW = Engine.W; e.viewH = Engine.H;
    const c: Controls = { x: 0, y: 0, drop: false, hook: false, shake: false, flame: false, boost: false, cycle: false };
    c.x = (Input.down('ArrowRight', 'KeyD') ? 1 : 0) - (Input.down('ArrowLeft', 'KeyA') ? 1 : 0);
    c.y = (Input.down('ArrowDown', 'KeyS') ? 1 : 0) - (Input.down('ArrowUp', 'KeyW', 'Space') ? 1 : 0);
    c.drop = Input.hit('KeyB', 'KeyJ');
    c.hook = Input.hit('KeyH', 'KeyK');
    c.shake = Input.hit('KeyX', 'KeyQ', 'KeyE');
    c.flame = Input.hit('KeyF');
    c.boost = Input.hit('ShiftLeft', 'ShiftRight', 'KeyL');
    c.cycle = Input.hit('KeyC', 'Tab');
    this.touch.update(70 + Engine.safe.t);
    this.touch.merge(c);
    e.update(c, dt);
    if (e.state !== 'play' && e.endT > (e.state === 'home' ? 2.4 : 3) && !this.ended) {
      this.ended = true;
      const report = settle(e);
      go(Scenes.report, { report });
    }
  }
  render(ctx: CanvasRenderingContext2D) {
    UI.begin();
    const W = Engine.W, H = Engine.H, e = this.e;
    const calm = calmFx();
    const shake = calm ? 0 : e.fx.shake;
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    drawBackdrop(ctx, W, H, e.camX, e.camY, e.time, { biome: e.region });
    ctx.save();
    ctx.translate(-Math.round(e.camX) + sx, -Math.round(e.camY) + sy);
    e.drawWorld(ctx);
    ctx.restore();
    drawAmbient(ctx, W, H, e.region, e.time, e.camX, Engine.quality < 1.6 ? 0.55 : 1, 0);
    // danger tint when the balloon is mobbed
    const mob = e.ship.hangers.length + e.ship.boarders.length * 2;
    if (mob > 0) { ctx.fillStyle = `rgba(150,30,20,${Math.min(0.22, mob * 0.03) * (calm ? 0.85 : 0.7 + 0.3 * Math.sin(e.time * 8))})`; ctx.fillRect(0, 0, W, H); }
    if (e.fx.flash > 0) { ctx.fillStyle = `rgba(226,73,58,${e.fx.flash * (calm ? 0.12 : 0.35)})`; ctx.fillRect(0, 0, W, H); }
    drawPost(ctx, W, H, e.time);
    this.drawHUD(ctx);
    const s = e.ship, st = s.stats;
    this.touch.draw(ctx, {
      weapon: s.weapon, ammo: s.ammo[s.weapon], hookOut: s.hookState !== 'stowed', hangers: s.hangers.length, t: e.time,
      shakeReady: 1 - s.shakeCd / st.shakeCd, flameReady: st.flamer ? 1 - s.flameCd / (st.flamer >= 2 ? 4.5 : 7) : 0, boostReady: st.boost ? 1 - s.boostCd / (st.boost >= 2 ? 5 : 9) : 0,
      canFlame: st.flamer > 0, canBoost: st.boost > 0, canCycle: st.fireCap > 0 || st.mineCap > 0,
    });
    if (e.state === 'home' && e.endT > 0.3) ribbon(ctx, W / 2, H * 0.34, 360, 'SAFE AT HAVEN!', P.olive, 34);
    if (e.state === 'crashed' && e.endT > 0.6) ribbon(ctx, W / 2, H * 0.34, 320, 'BALLOON DOWN!', P.red, 34);
    if (this.paused) this.drawPause(ctx);
    if (Engine.portrait) drawRotate(ctx, W, H, this.t);
    fadeIn(ctx, this.t, W, H, 0.01);
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    const W = Engine.W, H = Engine.H, e = this.e, s = e.ship, st = s.stats;
    const L = 10 + Engine.safe.l, T = 8 + Engine.safe.t * 0.5;
    pen.use(ctx, 0.4);
    // ---------- vitals: Jerry, envelope, fuel ----------
    const pw = 190;
    panel(ctx, L, T, pw, 72, { color: '#3b2a20', border: 3 });
    for (let i = 0; i < s.maxHp; i++) {
      const hx = L + 18 + i * 19, hy = T + 17; const full = i < s.hp;
      const beat = full && s.hp === 1 ? 1 + 0.15 * Math.sin(e.time * 10) : 1;
      ctx.save(); ctx.translate(hx, hy); ctx.scale(beat, beat);
      pen.begin().m(0, 6).q(-10, -2, -7, -6).q(-3, -10, 0, -5).q(3, -10, 7, -6).q(10, -2, 0, 6).close().ink(full ? P.redBright : 'rgba(0,0,0,0.35)', 1.8);
      ctx.restore();
    }
    bodyText(ctx, 'JERRY', L + 26 + s.maxHp * 19, T + 17, 13, P.parchment);
    const bar = (y: number, k: number, col: string, label: string, warn: boolean) => {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(L + 62, y - 6, pw - 74, 11);
      ctx.fillStyle = warn && Math.sin(e.time * 10) > 0 ? P.redBright : col; ctx.fillRect(L + 63, y - 5, (pw - 76) * clamp(k, 0, 1), 9);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.strokeRect(L + 62, y - 6, pw - 74, 11);
      bodyText(ctx, label, L + 10, y, 13, P.parchment);
    };
    bar(T + 39, s.env / s.maxEnv, P.tealLight, 'BALLOON', s.env / s.maxEnv < 0.3);
    bar(T + 57, s.fuel / s.maxFuel, P.orangeLight, 'FUEL', s.fuel / s.maxFuel < 0.2);
    // ---------- altitude meter ----------
    this.drawAltimeter(ctx, L, T + 86, H - T - 86 - (this.touch.visible ? 210 : 40));
    // ---------- minimap ----------
    const mw = clamp(W * 0.34, 230, 380), mx = W / 2 - mw / 2 - 20, my = T;
    panel(ctx, mx, my, mw, 30, { color: P.parchment, border: 2.5 });
    const toX = (x: number) => mx + 10 + (x / e.length) * (mw - 20);
    ctx.fillStyle = 'rgba(42,26,20,0.25)'; ctx.fillRect(mx + 10, my + 15, mw - 20, 3);
    ctx.fillStyle = 'rgba(42,26,20,0.12)'; ctx.fillRect(toX(s.x - e.reveal), my + 6, Math.min(mw - 20, (e.reveal * 2 / e.length) * (mw - 20)), 20);
    const pip = (x: number, col: string, r = 4) => { pen.begin().ell(toX(x), my + 16, r, r).ink(col, 1.5); };
    pip(e.haven.x + e.haven.w / 2, P.teal, 5); pip(e.outpost.x + e.outpost.w / 2, P.tealLight, 4.5);
    pip(e.beacon.x + e.beacon.w / 2, e.beaconBanked || e.beaconWasLit ? P.goldLight : e.beaconLit ? P.orangeLight : P.redDark, 5);
    for (const v of e.survivors) if ((v.state === 'wait' || v.state === 'climb') && e.revealed(v.x)) { ctx.fillStyle = P.gold; ctx.fillRect(toX(v.x) - 2, my + 5, 4, 7); }
    for (const it of e.loot) if (it.kind === 'trophy' && e.revealed(it.x)) { ctx.fillStyle = P.electric; ctx.beginPath(); ctx.arc(toX(it.x), my + 24, 2.5, 0, 7); ctx.fill(); }
    ctx.save(); ctx.translate(toX(s.x), my + 15); pen.begin().ell(0, -3, 5, 6).ink(P.orange, 1.5); pen.begin().rect(-2.5, 3, 5, 4).ink(P.brown, 1); ctx.restore();
    // cargo carried (not yet banked)
    let cx = mx + 6; const cy = my + 44;
    const any = RES_KEYS.some((k) => e.cargo[k] > 0) || e.trophies.length;
    if (any) {
      ctx.fillStyle = 'rgba(42,26,20,0.55)'; ctx.fillRect(mx, cy - 11, mw, 22);
      for (const k of RES_KEYS) { const n = e.cargo[k]; if (!n) continue; ctx.save(); ctx.translate(cx + 9, cy); ctx.scale(0.6, 0.6); drawResIcon(ctx, k, 11, e.time); ctx.restore(); inkText(ctx, String(n), cx + 20, cy + 1, 14, P.parchment, { align: 'left', outline: 3, shadow: false }); cx += 44; }
      if (e.trophies.length) { ctx.save(); ctx.translate(cx + 9, cy); ctx.scale(0.55, 0.55); drawResIcon(ctx, 'trophy', 11, e.time); ctx.restore(); cx += 26; }
      bodyText(ctx, 'unbanked', mx + mw - 6, cy, 12, 'rgba(241,223,184,0.7)', 'right');
    }
    // ---------- crew strip + lift ----------
    const pb = 44, px = W - pb - 10 - Engine.safe.r;
    UI.button(ctx, 'pause', px, T, pb, pb, '', () => { this.paused = !this.paused; }, { style: 'brass', keys: [] });
    pen.begin().rect(px + 14, T + 12, 5, 17).fill(P.ink); pen.begin().rect(px + 25, T + 12, 5, 17).fill(P.ink);
    const seats = st.seats;
    const cw = 22, cx0 = px - 10 - seats * cw;
    for (let i = 0; i < seats; i++) {
      const c = s.crew[i]; const x = cx0 + i * cw + 11, y = T + 14;
      if (!c) { pen.begin().ell(x, y, 9, 9).stroke(1.5, 'rgba(241,223,184,0.4)'); continue; }
      const ri = ROLE_INFO[c.m.role];
      pen.begin().ell(x, y, 10, 10).ink(c.ko ? '#555' : ri.color, 2);
      ctx.fillStyle = c.m.look.skin; ctx.beginPath(); ctx.arc(x, y - 1, 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = c.m.look.hair; ctx.beginPath(); ctx.arc(x, y - 4, 5, Math.PI, 0); ctx.fill();
      if (c.ko) inkText(ctx, 'x', x, y, 12, P.redBright, { outline: 2, shadow: false });
      for (let k = 0; k < c.max; k++) { ctx.fillStyle = k < c.hp ? P.redBright : 'rgba(0,0,0,0.4)'; ctx.fillRect(x - 9 + k * (18 / c.max), y + 13, 18 / c.max - 1, 3); }
      if (c.isNew) inkText(ctx, 'NEW', x, y - 15, 9, P.goldLight, { outline: 2, shadow: false });
    }
    bodyText(ctx, `CREW ${s.crew.length}/${seats}`, cx0 + seats * cw / 2, T + 37, 12, P.parchment, 'center');
    // lift vs weight
    const lw = 120, lx = W - lw - 12 - Engine.safe.r, ly = T + 54;
    const ratio = (s.liftMul() * 330 + 80 * st.burnerPower * s.liftMul()) / (150 * s.weight());
    const k = clamp((ratio - 1) / 2, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(lx, ly, lw, 9);
    ctx.fillStyle = k < 0.25 ? P.redBright : k < 0.5 ? P.gold : P.oliveLight; ctx.fillRect(lx + 1, ly + 1, (lw - 2) * k, 7);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1.4; ctx.strokeRect(lx, ly, lw, 9);
    bodyText(ctx, k < 0.25 ? 'TOO HEAVY!' : 'LIFT', lx - 6, ly + 5, 12, k < 0.25 && Math.sin(e.time * 8) > 0 ? P.redBright : P.parchment, 'right');
    // weapon chip (keyboard players)
    if (!this.touch.visible) {
      const wx = W - 150 - Engine.safe.r, wy = H - 44;
      panel(ctx, wx, wy, 140, 34, { color: '#3b2a20', border: 2 });
      ctx.save(); ctx.translate(wx + 20, wy + 22); drawBtnIcon(ctx, s.weapon, 26); ctx.restore();
      bodyText(ctx, `${s.weapon.toUpperCase()} x${s.ammo[s.weapon]}  (C)`, wx + 38, wy + 17, 14, P.parchment);
    }
    // ---------- boarding alert ----------
    if (s.hangers.length || s.boarders.length) {
      const a = 0.6 + 0.4 * Math.sin(e.time * 10);
      ctx.globalAlpha = a;
      const txt = s.boarders.length ? `${s.boarders.length} ABOARD! ${s.hangers.length ? '+ ' + s.hangers.length + ' HANGING' : ''}` : `${s.hangers.length} ON THE BASKET — SHAKE!`;
      inkText(ctx, txt, W / 2, H - 30 - Engine.safe.b * 0.5, 22, P.redBright, { outline: 5 });
      ctx.globalAlpha = 1;
    }
    // ---------- off-screen pointers ----------
    for (const ptr of e.pointers()) {
      const sx = ptr.x - e.camX, sy = ptr.y - e.camY;
      const cx2 = clamp(sx, 76, W - 40), cy2 = clamp(sy, 110, H - 40);
      const ang = Math.atan2(sy - cy2, sx - cx2);
      ctx.save(); ctx.translate(cx2, cy2);
      ctx.save(); ctx.rotate(ang); pen.begin().m(18, 0).l(2, -10).l(2, 10).close().ink(ptr.color, 2.5); ctx.restore();
      pen.begin().ell(0, 0, 14, 14).ink(P.ink, 0);
      inkText(ctx, ptr.label, 0, 1, ptr.label.length > 2 ? 9 : 14, ptr.color, { outline: 2, shadow: false });
      ctx.restore();
    }
    // ---------- tutorial tip ----------
    const tp = e.tip;
    if (tp && e.state === 'play') {
      const text = (this.touch.visible && tp.tip.touch) ? tp.tip.touch : tp.tip.text;
      const hw = clamp(W * 0.4, 300, 440);
      const lines = wrapText(ctx, text, hw - 30, 17);
      const hh = 16 + lines.length * 19;
      const kk = clamp(tp.t / 0.3, 0, 1);
      const hx = W / 2 - hw / 2 - 20, hy = T + (any ? 64 : 42);
      ctx.save(); ctx.globalAlpha = tp.t > 6.4 ? clamp((7 - tp.t) / 0.6, 0, 1) : 1;
      ctx.translate(hx + hw / 2, hy + hh / 2); ctx.scale(easeOutBack(kk), easeOutBack(kk)); ctx.translate(-hx - hw / 2, -(hy + hh / 2));
      panel(ctx, hx, hy, hw, hh, { color: P.paper, tape: true });
      lines.forEach((ln, i) => bodyText(ctx, ln, hx + 15, hy + 17 + i * 19, 17, P.ink));
      ctx.restore();
    }
    // ---------- banners ----------
    const b = e.banners[0];
    if (b) {
      const kb = 2.6 - b.t;
      const sc = kb < 0.3 ? easeOutBack(kb / 0.3) : 1;
      ctx.save(); ctx.globalAlpha = b.t < 0.4 ? b.t / 0.4 : 1;
      ctx.translate(W / 2, H * 0.27); ctx.scale(sc, sc);
      inkText(ctx, b.text, 0, 0, 32, b.color ?? P.gold, { outline: 6 });
      if (b.sub) inkText(ctx, b.sub, 0, 32, 19, P.parchment, { outline: 4, font: FONT_BODY });
      ctx.restore();
    }
  }

  private drawAltimeter(ctx: CanvasRenderingContext2D, L: number, y0: number, h: number) {
    if (h < 120) return;
    const e = this.e, s = e.ship;
    const ground = e.terrain.surfaceY(s.x);
    const top = -40, span = ground - top;
    const toY = (wy: number) => y0 + clamp((wy - top) / span, 0, 1) * h;
    const x = L + 4, w = 16;
    const crit = ground - 70, low = ground - 230;
    ctx.fillStyle = 'rgba(80,140,170,0.75)'; ctx.fillRect(x, y0, w, toY(low) - y0);
    ctx.fillStyle = 'rgba(230,170,60,0.8)'; ctx.fillRect(x, toY(low), w, toY(crit) - toY(low));
    ctx.fillStyle = 'rgba(220,60,40,0.85)'; ctx.fillRect(x, toY(crit), w, y0 + h - toY(crit));
    ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.strokeRect(x, y0, w, h);
    ctx.save(); ctx.translate(x + w + 4, y0 + 4); ctx.font = `10px "Luckiest Guy"`; ctx.fillStyle = 'rgba(241,223,184,0.8)'; ctx.textAlign = 'left';
    ctx.fillText('HIGH', 0, 6); ctx.fillText('LOW', 0, toY(low) - y0 + 10); ctx.fillText('GRAB', 0, toY(crit) - y0 + 10); ctx.restore();
    // how high the dead can currently reach (tallest zombie tower nearby)
    let reach = ground;
    for (const z of e.zombies) if (!z.dead && !z.attached && Math.abs(z.x - s.x) < 140) reach = Math.min(reach, z.handY());
    if (reach < ground) { const ry = toY(reach); ctx.strokeStyle = P.redBright; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x - 3, ry); ctx.lineTo(x + w + 3, ry); ctx.stroke(); ctx.setLineDash([]); }
    const by = toY(s.basketY);
    const alt = ground - s.basketY;
    const danger = alt < 70;
    ctx.save(); ctx.translate(x + w / 2, by);
    pen.begin().m(-w / 2 - 6, 0).l(-w / 2 - 14, -6).l(-w / 2 - 14, 6).close().ink(danger && Math.sin(e.time * 12) > 0 ? P.redBright : P.parchment, 1.5);
    pen.begin().ell(0, -7, 7, 8).ink(P.orange, 1.6); pen.begin().rect(-3, 1, 6, 5).ink(P.brown, 1.2);
    ctx.restore();
    if (danger && e.state === 'play' && s.launched) inkText(ctx, 'GRAB ZONE!', x + w + 46, by, 13, P.redBright, { outline: 3 });
    void S;
  }

  private drawPause(ctx: CanvasRenderingContext2D) {
    const W = Engine.W, H = Engine.H;
    ctx.fillStyle = 'rgba(20,12,8,0.6)'; ctx.fillRect(0, 0, W, H);
    const pw = 340, ph = 408, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    panel(ctx, px, py, pw, ph, { tape: true });
    inkText(ctx, 'PAUSED', W / 2, py + 38, 38, P.gold, { outline: 6 });
    bodyText(ctx, this.e.region.name, W / 2, py + 70, 17, P.inkSoft, 'center');
    const bw = 250, bx = W / 2 - bw / 2;
    const s = Save.data;
    if (!this.confirmBail) {
      UI.button(ctx, 'resume', bx, py + 90, bw, 50, 'RESUME', () => { this.paused = false; }, { style: 'olive', keys: ['Escape'] });
      UI.button(ctx, 'bail', bx, py + 150, bw, 46, 'BAIL OUT', () => { this.confirmBail = true; }, { style: 'red', sub: 'lose most of your cargo', size: 20 });
    } else {
      bodyText(ctx, 'Abandon the expedition? You keep only', W / 2, py + 100, 16, P.ink, 'center');
      bodyText(ctx, '30% of what you carry. Crew may get lost.', W / 2, py + 120, 16, P.ink, 'center');
      UI.button(ctx, 'bailyes', bx, py + 140, 120, 46, 'BAIL', () => { this.paused = false; this.confirmBail = false; this.e.ship.crash(this.e, 'bail'); }, { style: 'red', size: 20 });
      UI.button(ctx, 'bailno', bx + 130, py + 140, 120, 46, 'KEEP FLYING', () => { this.confirmBail = false; }, { style: 'olive', size: 16 });
    }
    UI.button(ctx, 'music', bx, py + 210, 120, 40, s.music ? 'MUSIC ON' : 'MUSIC OFF', () => { s.music = !s.music; Audio.setMusic(s.music); Save.write(); }, { style: s.music ? 'teal' : 'paper', size: 16 });
    UI.button(ctx, 'sfx', bx + 130, py + 210, 120, 40, s.sfx ? 'SOUND ON' : 'SOUND OFF', () => { s.sfx = !s.sfx; Audio.setSfx(s.sfx); Save.write(); }, { style: s.sfx ? 'teal' : 'paper', size: 16 });
    UI.button(ctx, 'lefty', bx, py + 258, bw, 40, s.lefty ? 'CONTROLS: LEFT-HANDED' : 'CONTROLS: RIGHT-HANDED', () => { s.lefty = !s.lefty; this.touch.lefty = s.lefty; Save.write(); }, { style: 'paper', size: 15 });
    const calm = calmFx();
    UI.button(ctx, 'calm', bx, py + 306, bw, 40, calm ? 'EFFECTS: CALM' : 'EFFECTS: FULL', () => { s.calm = !calm; Save.write(); }, { style: calm ? 'teal' : 'paper', size: 15, sub: calm ? 'no screen shake, soft flashes' : 'screen shake and flashes' });
    if (!(Engine.isTouch || Input.usingTouch)) {
      bodyText(ctx, 'Keys: arrows fly · B drop · H hook · X shake', W / 2, py + ph - 38, 13, P.inkSoft, 'center');
      bodyText(ctx, 'F flame · Shift boost · C weapon · M mute', W / 2, py + ph - 20, 13, P.inkSoft, 'center');
    }
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
