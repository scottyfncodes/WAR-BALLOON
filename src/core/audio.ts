/**
 * WAR BALLOON audio — fully synthesized with WebAudio (no sample files, instant load).
 * Theatrical-cartoon flavoured SFX + a little oom-pah sequencer for music.
 */
type Song = { bpm: number; steps: number; chords: string[]; melody: string[]; style: 'march' | 'waltz' | 'boss' };

const NOTE: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function freq(n: string): number {
  const m = /^([A-G][b#]?)(\d)$/.exec(n);
  if (!m) return 0;
  const midi = 12 * (parseInt(m[2]) + 1) + NOTE[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}
const CHORD: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], dim: [0, 3, 6] };
function chordNotes(c: string): { root: number; tones: number[] } {
  const m = /^([A-G][b#]?)(.*)$/.exec(c)!;
  const root = NOTE[m[1]];
  return { root, tones: CHORD[m[2]] ?? CHORD[''] };
}
const midiF = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const SONGS: Record<string, Song> = {
  desert: {
    bpm: 118, steps: 8, style: 'march',
    chords: ['Dm', 'Eb', 'Dm', 'C', 'Dm', 'Eb', 'C', 'Dm'],
    melody: ('D5 - Eb5 F5 A5 - G5 F5 | Eb5 - D5 - C5 - D5 . | F5 G5 A5 - Bb5 A5 G5 F5 | E5 - G5 - C5 - . . | ' +
      'D5 . D5 Eb5 F5 - A5 . | G5 F5 Eb5 - D5 - C5 . | E5 F5 G5 - C6 - Bb5 G5 | D5 - - - . . . .').split(/\s+/).filter((x) => x !== '|'),
  },
  sea: {
    bpm: 138, steps: 6, style: 'waltz',
    chords: ['G', 'Em', 'C', 'D7', 'G', 'Em', 'Am', 'D7'],
    melody: ('D5 - G5 - B5 - | B5 - A5 - G5 - | E5 - G5 - C6 - | A5 - - - F#5 - | D5 - G5 - B5 - | D6 - C6 - B5 - | A5 - C6 - E5 - | D5 - - - . .').split(/\s+/).filter((x) => x !== '|'),
  },
  jungle: {
    bpm: 140, steps: 8, style: 'march',
    chords: ['Am', 'G', 'F', 'E7', 'Am', 'G', 'F', 'E7'],
    melody: ('A4 C5 E5 A5 - G5 E5 . | D5 - G5 - B5 - D5 . | C5 F5 A5 - C6 A5 F5 . | E5 G#5 B5 - - . E5 . | ' +
      'A5 . A5 G5 E5 - C5 . | B4 D5 G5 - D5 - B4 . | A4 C5 F5 - A5 - C6 . | B5 - G#5 - E5 - . .').split(/\s+/).filter((x) => x !== '|'),
  },
  ice: {
    bpm: 112, steps: 6, style: 'waltz',
    chords: ['Em', 'C', 'G', 'B7', 'Em', 'Am', 'B7', 'Em'],
    melody: ('B5 - - - G5 - | E5 - G5 - C6 - | B5 - D6 - B5 - | A5 - - - F#5 - | G5 - B5 - E6 - | C6 - B5 - A5 - | F#5 - A5 - D#6 - | E6 - - - . .').split(/\s+/).filter((x) => x !== '|'),
  },
  ash: {
    bpm: 146, steps: 8, style: 'boss',
    chords: ['Cm', 'Cm', 'Ab', 'G7', 'Cm', 'Bb', 'Ab', 'G7'],
    melody: ('C5 . C5 Eb5 G5 . F5 Eb5 | D5 . B4 . C5 - - . | C5 Eb5 Ab5 - G5 F5 Eb5 C5 | D5 F5 B5 - G5 - - . | ' +
      'G5 . G5 . Ab5 G5 F5 Eb5 | F5 - D5 - Bb4 - D5 . | Eb5 F5 G5 Ab5 C6 - Ab5 . | G5 - D5 - B4 - . .').split(/\s+/).filter((x) => x !== '|'),
  },
  flight: {
    bpm: 132, steps: 8, style: 'march',
    chords: ['F', 'F', 'C7', 'C7', 'Bb', 'F', 'C7', 'F', 'Dm', 'Dm', 'Bb', 'C7', 'F', 'Dm', 'C7', 'F'],
    melody: (
      'A4 C5 F5 - E5 F5 G5 - | A5 - G5 F5 C5 - - . | Bb4 C5 E5 - D5 E5 G5 - | Bb5 - A5 G5 E5 - - . | ' +
      'D5 F5 Bb5 - A5 G5 F5 D5 | C5 - A4 C5 F5 - - . | E5 G5 Bb5 - A5 G5 E5 C5 | F5 - - . C5 . F4 . | ' +
      'D5 . F5 . A5 - G5 F5 | E5 - D5 - . . A4 . | Bb4 D5 F5 - Bb5 - A5 G5 | G5 - E5 - C5 - - . | ' +
      'F5 A5 C6 - A5 F5 C5 A4 | D5 - F5 - A5 - . . | G5 A5 Bb5 - G5 E5 C5 E5 | F5 - - - . . . .'
    ).split(/\s+/).filter((x) => x !== '|'),
  },
  haven: {
    bpm: 150, steps: 6, style: 'waltz',
    chords: ['C', 'Am', 'F', 'G7', 'C', 'Am', 'F', 'C', 'F', 'C', 'Dm', 'G7', 'C', 'Am', 'G7', 'C'],
    melody: (
      'E5 - G5 - C6 - | B5 - A5 - E5 - | F5 - A5 - C6 - | B5 - - - G5 - | E5 - G5 - C6 - | E6 - D6 - C6 - | A5 - B5 - D6 - | C6 - - - . . | ' +
      'A5 - C6 - F6 - | E6 - D6 - C6 - | D6 - F5 - A5 - | G5 - - - B5 - | C6 - E5 - G5 - | A5 - C6 - E6 - | D6 - B5 - G5 - | C6 - - - . .'
    ).split(/\s+/).filter((x) => x !== '|'),
  },
  boss: {
    bpm: 150, steps: 8, style: 'boss',
    chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A7'],
    melody: (
      'D5 . D5 F5 A5 . G5 F5 | E5 . C5 . D5 - - . | D5 F5 Bb5 - A5 G5 F5 D5 | E5 G5 C6 - Bb5 A5 G5 E5 | ' +
      'A5 . A5 . A5 G5 F5 E5 | D5 - F5 - A5 - D6 . | Bb5 A5 G5 F5 G5 A5 Bb5 . | A5 - C#5 - E5 - A5 .'
    ).split(/\s+/).filter((x) => x !== '|'),
  },
};

class AudioImpl {
  ctx: AudioContext | null = null;
  master!: GainNode; sfx!: GainNode; music!: GainNode;
  noise!: AudioBuffer;
  musicOn = true; sfxOn = true;
  private burnerGain: GainNode | null = null;
  private burnerFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private song: Song | null = null; private songName = '';
  private step = 0; private nextT = 0; private timer: any = null;
  private lastPlay: Record<string, number> = {};

  unlock() {
    if (!this.ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx!;
      this.master = c.createGain(); this.master.gain.value = 0.8;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = this.sfxOn ? 1 : 0; this.sfx.connect(this.master);
      this.music = c.createGain(); this.music.gain.value = this.musicOn ? 0.42 : 0; this.music.connect(this.master);
      const len = c.sampleRate * 2;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // silent kick for iOS
      const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
      this.setupLoops();
      if (this.songName) { const n = this.songName; this.songName = ''; this.playSong(n); }
    }
    if (this.ctx!.state === 'suspended') this.ctx!.resume().catch(() => {});
  }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  setMusic(on: boolean) { this.musicOn = on; if (this.ctx) this.music.gain.setTargetAtTime(on ? 0.42 : 0, this.t, 0.05); }
  setSfx(on: boolean) { this.sfxOn = on; if (this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.t, 0.05); }
  suspend() { this.ctx?.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }

  private setupLoops() {
    const c = this.ctx!;
    const mk = () => { const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; };
    // burner: roaring band-passed noise + low rumble
    const bs = mk();
    this.burnerFilter = c.createBiquadFilter(); this.burnerFilter.type = 'bandpass'; this.burnerFilter.frequency.value = 600; this.burnerFilter.Q.value = 0.7;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    this.burnerGain = c.createGain(); this.burnerGain.gain.value = 0;
    bs.connect(this.burnerFilter); this.burnerFilter.connect(lp); lp.connect(this.burnerGain); this.burnerGain.connect(this.sfx); bs.start();
    // wind
    const ws = mk();
    this.windFilter = c.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 350; this.windFilter.Q.value = 3;
    this.windGain = c.createGain(); this.windGain.gain.value = 0;
    ws.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.sfx); ws.start();
  }
  burner(level: number) {
    if (!this.ctx || !this.burnerGain) return;
    this.burnerGain.gain.setTargetAtTime(level * 0.55, this.t, level > 0 ? 0.03 : 0.08);
    this.burnerFilter!.frequency.setTargetAtTime(420 + level * 500 + Math.random() * 80, this.t, 0.05);
  }
  wind(level: number) {
    if (!this.ctx || !this.windGain) return;
    this.windGain.gain.setTargetAtTime(Math.min(0.5, level) * 0.35, this.t, 0.3);
    this.windFilter!.frequency.setTargetAtTime(250 + level * 500, this.t, 0.3);
  }

  // ---------- primitives ----------
  private env(g: GainNode, t: number, a: number, peak: number, dur: number, rel = 0.05) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(a, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  tone(f: number, dur: number, opts: { type?: OscillatorType; gain?: number; t?: number; slide?: number; attack?: number; dest?: AudioNode; filter?: number; vib?: number; detune?: number } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = opts.t ?? c.currentTime;
    const o = c.createOscillator(); o.type = opts.type ?? 'square';
    o.frequency.setValueAtTime(f, t);
    if (opts.detune) o.detune.value = opts.detune;
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
    const g = c.createGain();
    this.env(g, t, opts.attack ?? 0.005, opts.gain ?? 0.2, dur);
    let node: AudioNode = o;
    if (opts.filter) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = opts.filter; o.connect(fl); node = fl; }
    if (opts.vib) { const l = c.createOscillator(); l.frequency.value = 5.5; const lg = c.createGain(); lg.gain.value = opts.vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    node.connect(g); g.connect(opts.dest ?? this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noiseBurst(dur: number, opts: { gain?: number; t?: number; type?: BiquadFilterType; f?: number; f2?: number; q?: number; attack?: number; dest?: AudioNode } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = opts.t ?? c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = opts.type ?? 'lowpass'; fl.frequency.setValueAtTime(opts.f ?? 1200, t);
    if (opts.f2) fl.frequency.exponentialRampToValueAtTime(opts.f2, t + dur);
    fl.Q.value = opts.q ?? 1;
    const g = c.createGain(); this.env(g, t, opts.attack ?? 0.003, opts.gain ?? 0.3, dur, dur * 0.6);
    s.connect(fl); fl.connect(g); g.connect(opts.dest ?? this.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  private throttle(key: string, gap: number) { const now = performance.now(); if ((this.lastPlay[key] ?? 0) + gap > now) return true; this.lastPlay[key] = now; return false; }

  // ---------- SFX library ----------
  ignite() { this.noiseBurst(0.25, { f: 3000, f2: 500, gain: 0.25, type: 'bandpass', q: 0.8 }); this.tone(90, 0.18, { type: 'sine', gain: 0.25, slide: 60 }); }
  bombDrop() { this.tone(1400, 0.55, { type: 'sine', gain: 0.07, slide: 500 }); this.tone(300, 0.05, { type: 'square', gain: 0.08, filter: 1200 }); }
  explosion(size = 1) {
    if (this.throttle('boom', 40)) return;
    const s = Math.min(2, size);
    this.noiseBurst(0.5 + s * 0.4, { f: 2400, f2: 120, gain: 0.5 * Math.min(1.3, 0.6 + s * 0.4), q: 0.5 });
    this.tone(110, 0.4 + s * 0.2, { type: 'sine', gain: 0.5, slide: 30 });
    this.tone(70, 0.6, { type: 'triangle', gain: 0.3, slide: 25 });
  }
  pop() { this.tone(500, 0.08, { type: 'sine', gain: 0.25, slide: 1200 }); }
  pickup(kind = 'scrap') {
    if (this.throttle('pick', 60)) return;
    const base: Record<string, number> = { scrap: 660, fuel: 523, fabric: 587, food: 698, water: 784, electronics: 880, power: 988, postcard: 1046, survivor: 523 };
    const f = base[kind] ?? 660;
    [1, 1.25, 1.5, 2].forEach((m, i) => this.tone(f * m, 0.12, { type: 'square', gain: 0.09, t: this.t + i * 0.05, filter: 3500 }));
    if (kind === 'scrap' || kind === 'electronics') this.tone(2400, 0.06, { type: 'triangle', gain: 0.08, t: this.t + 0.02 });
  }
  coin() { this.tone(988, 0.08, { type: 'square', gain: 0.08, filter: 4000 }); this.tone(1318, 0.18, { type: 'square', gain: 0.08, t: this.t + 0.07, filter: 4000 }); }
  hookOut() { this.tone(220, 0.05, { type: 'square', gain: 0.12, filter: 900 }); this.noiseBurst(0.3, { f: 3000, f2: 800, gain: 0.08, type: 'bandpass', q: 3 }); }
  ratchet() { if (this.throttle('ratchet', 70)) return; this.tone(1800 + Math.random() * 300, 0.02, { type: 'square', gain: 0.05, filter: 3000 }); }
  clank() { if (this.throttle('clank', 50)) return; this.tone(820, 0.15, { type: 'square', gain: 0.1, slide: 600, filter: 2600 }); this.tone(1230, 0.25, { type: 'triangle', gain: 0.08 }); this.noiseBurst(0.05, { f: 5000, gain: 0.12, type: 'highpass' }); }
  grab() { this.tone(160, 0.12, { type: 'square', gain: 0.15, filter: 700 }); this.clank(); }
  hurt() {
    if (this.throttle('hurt', 120)) return;
    this.tone(300, 0.35, { type: 'sawtooth', gain: 0.12, slide: 120, filter: 1400 });
    this.noiseBurst(0.12, { f: 1800, gain: 0.25 });
    this.tone(700, 0.3, { type: 'triangle', gain: 0.1, slide: 1300, t: this.t + 0.05, vib: 40 });
  }
  boing() { this.tone(180, 0.35, { type: 'sine', gain: 0.2, slide: 520, vib: 30 }); }
  zap() { if (this.throttle('zap', 150)) return; for (let i = 0; i < 6; i++) this.tone(60 + Math.random() * 1600, 0.04, { type: 'sawtooth', gain: 0.1, t: this.t + i * 0.035 }); this.noiseBurst(0.3, { f: 4000, type: 'highpass', gain: 0.15 }); }
  thump() { if (this.throttle('thump', 60)) return; this.tone(140, 0.12, { type: 'sine', gain: 0.35, slide: 50 }); this.noiseBurst(0.12, { f: 900, gain: 0.2 }); }
  puff() { if (this.throttle('puff', 50)) return; this.noiseBurst(0.25, { f: 1400, f2: 300, gain: 0.25 }); }
  squawk() { if (this.throttle('sq', 300)) return; this.tone(900, 0.18, { type: 'sawtooth', gain: 0.07, slide: 520, filter: 2400, vib: 60 }); this.tone(700, 0.12, { type: 'sawtooth', gain: 0.06, slide: 900, t: this.t + 0.16, filter: 2400 }); }
  propeller(level: number) { /* folded into wind loop */ void level; }
  boost() { this.noiseBurst(0.6, { f: 400, f2: 3000, gain: 0.25, type: 'bandpass', q: 1.2 }); this.tone(200, 0.5, { type: 'sawtooth', gain: 0.08, slide: 600, filter: 1200 }); }
  sizzle() { if (this.throttle('sizzle', 200)) return; this.noiseBurst(0.4, { f: 6000, type: 'highpass', gain: 0.07 }); }
  click() { this.tone(660, 0.04, { type: 'square', gain: 0.07, filter: 3000 }); this.tone(990, 0.04, { type: 'square', gain: 0.05, t: this.t + 0.03, filter: 3000 }); }
  deny() { this.tone(220, 0.12, { type: 'square', gain: 0.08, filter: 900 }); this.tone(165, 0.18, { type: 'square', gain: 0.08, t: this.t + 0.1, filter: 900 }); }
  buy() {
    const t = this.t;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, { type: 'square', gain: 0.08, t: t + i * 0.06, filter: 4000 }));
    this.tone(2093, 0.4, { type: 'triangle', gain: 0.08, t: t + 0.26 });
    this.noiseBurst(0.08, { f: 6000, type: 'highpass', gain: 0.1, t: t + 0.26 });
  }
  objective() { const t = this.t; [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', gain: 0.14, t: t + i * 0.08, vib: 8 })); }
  fanfare() {
    const t = this.t; const seq = [[523, 0], [523, 0.12], [523, 0.24], [659, 0.36], [784, 0.6], [659, 0.84], [784, 0.96], [1046, 1.2]];
    seq.forEach(([f, d]) => { this.tone(f, 0.22, { type: 'sawtooth', gain: 0.09, t: t + d, filter: 2400, vib: 6 }); this.tone(f / 2, 0.22, { type: 'square', gain: 0.05, t: t + d, filter: 900 }); });
    this.tone(1046, 0.8, { type: 'sawtooth', gain: 0.08, t: t + 1.2, filter: 2400, vib: 10 });
  }
  sadTrombone() {
    const t = this.t; const notes = [392, 370, 349, 330];
    notes.forEach((f, i) => this.tone(f, i === 3 ? 1.1 : 0.4, { type: 'sawtooth', gain: 0.12, t: t + i * 0.45, filter: 1200, vib: i === 3 ? 18 : 4, slide: i === 3 ? f * 0.96 : undefined }));
  }
  /** Gibberish cartoon voice: a few formant-filtered syllables. */
  voice(kind: 'woo' | 'yikes' | 'hmph' | 'yay' | 'ugh' | 'huh') {
    if (!this.ctx || this.throttle('voice', 450)) return;
    const c = this.ctx, t = c.currentTime;
    const sylls: Record<string, [number, number, number][]> = {
      woo: [[260, 520, 0.28], [520, 700, 0.3]],
      yikes: [[700, 900, 0.1], [900, 500, 0.22]],
      hmph: [[180, 140, 0.18]],
      yay: [[400, 600, 0.12], [600, 820, 0.25]],
      ugh: [[220, 150, 0.3]],
      huh: [[240, 340, 0.2]],
    };
    let tt = t;
    for (const [f1, f2, d] of sylls[kind]) {
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f1, tt); o.frequency.exponentialRampToValueAtTime(f2, tt + d);
      const g = c.createGain(); this.env(g, tt, 0.02, 0.18, d, 0.06);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(kind === 'woo' || kind === 'ugh' ? 700 : 1300, tt); f.Q.value = 4;
      const f2n = c.createBiquadFilter(); f2n.type = 'bandpass'; f2n.frequency.value = 2400; f2n.Q.value = 6;
      const g2 = c.createGain(); g2.gain.value = 0.4;
      o.connect(f); f.connect(g); o.connect(f2n); f2n.connect(g2); g2.connect(g); g.connect(this.sfx);
      o.start(tt); o.stop(tt + d + 0.05);
      tt += d * 0.9;
    }
  }

  // ---------- music sequencer ----------
  playSong(name: string) {
    if (name === this.songName) return;
    this.songName = name;
    if (!this.ctx) return;
    this.song = SONGS[name] ?? null;
    this.step = 0; this.nextT = this.t + 0.12;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }
  stopSong() { this.songName = ''; this.song = null; }
  private schedule() {
    if (!this.ctx || !this.song || this.ctx.state !== 'running') return;
    const s = this.song, stepDur = 60 / s.bpm / 2;
    while (this.nextT < this.t + 0.15) {
      this.playStep(s, this.step, this.nextT, stepDur);
      this.nextT += stepDur; this.step++;
    }
  }
  private playStep(s: Song, i: number, t: number, d: number) {
    const total = s.chords.length * s.steps;
    const k = i % total;
    const bar = Math.floor(k / s.steps), st = k % s.steps;
    const ch = chordNotes(s.chords[bar]);
    const swing = (s.style !== 'waltz' && st % 2 === 1) ? d * 0.18 : 0;
    const tt = t + swing;
    const dest = this.music;
    // bass / oom-pah
    if (s.style === 'waltz') {
      if (st === 0) this.tone(midiF(36 + ch.root), d * 1.6, { type: 'triangle', gain: 0.5, t: tt, dest });
      if (st === 2 || st === 4) ch.tones.slice(0, 3).forEach((iv) => this.tone(midiF(60 + ch.root + iv), d * 0.7, { type: 'square', gain: 0.045, t: tt, dest, filter: 1500, detune: 6 }));
    } else {
      if (st === 0 || st === 4) {
        const n = st === 0 ? ch.root : ch.root + 7;
        this.tone(midiF(36 + n), d * 1.3, { type: 'triangle', gain: 0.5, t: tt, dest });
        this.tone(midiF(48 + n), d * 1.0, { type: 'sawtooth', gain: 0.05, t: tt, dest, filter: 500 });
      }
      if (st === 2 || st === 6) ch.tones.slice(0, 3).forEach((iv) => this.tone(midiF(60 + ch.root + iv), d * 0.55, { type: 'square', gain: 0.04, t: tt, dest, filter: 1700, detune: 7 }));
      if (s.style === 'boss' && st % 2 === 1) this.tone(midiF(48 + ch.root), d * 0.4, { type: 'sawtooth', gain: 0.04, t: tt, dest, filter: 900 });
    }
    // percussion: brush snare + woodblock
    if (s.style !== 'waltz') {
      if (st === 2 || st === 6) this.noiseBurst(0.09, { f: 3800, type: 'bandpass', q: 0.7, gain: 0.12, t: tt, dest });
      if (st % 2 === 1) this.noiseBurst(0.03, { f: 7000, type: 'highpass', gain: 0.04, t: tt, dest });
      if (st === 0) this.tone(100, 0.12, { type: 'sine', gain: 0.25, slide: 45, t: tt, dest });
    } else if (st === 0) this.tone(1200, 0.04, { type: 'triangle', gain: 0.05, t: tt, dest });
    // melody (clarinet-ish)
    const mel = s.melody[k % s.melody.length];
    if (mel && mel !== '-' && mel !== '.') {
      let len = 1; while (s.melody[(k + len) % s.melody.length] === '-' && len < 8) len++;
      const f = freq(mel);
      this.tone(f, d * len * 0.95, { type: 'square', gain: 0.055, t: tt, dest, filter: 2200, vib: f * 0.012, attack: 0.02 });
      this.tone(f * 2, d * len * 0.9, { type: 'triangle', gain: 0.025, t: tt, dest, attack: 0.03 });
    }
  }
}

export const Audio = new AudioImpl();
