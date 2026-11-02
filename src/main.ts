import '@fontsource/luckiest-guy';
import '@fontsource/patrick-hand';
import { Engine } from './core/engine';
import { Input } from './core/input';
import { Audio } from './core/audio';
import { Save } from './core/save';
import { Scenes } from './scenes/registry';
import { TitleScene } from './scenes/title';
import { IntroScene } from './scenes/intro';
import { MapScene } from './scenes/map';
import { GarageScene } from './scenes/garage';
import { PlayScene } from './scenes/play';
import { ResultsScene } from './scenes/results';
import { go } from './scenes/router';
import { missionById } from './game/missions';

async function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  // Wait (briefly) for the cartoon fonts so prerendered art gets the right lettering.
  try { await Promise.race([Promise.all([document.fonts.load('40px "Luckiest Guy"'), document.fonts.load('20px "Patrick Hand"')]), new Promise((r) => setTimeout(r, 2500))]); } catch { /* fonts optional */ }
  Engine.init(canvas);
  Input.init(canvas);
  Audio.musicOn = Save.data.music; Audio.sfxOn = Save.data.sfx;
  Input.onFirstGesture.push(() => Audio.unlock());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Audio.suspend(); else Audio.resume(); });
  Scenes.title = new TitleScene(); Scenes.intro = new IntroScene(); Scenes.map = new MapScene();
  Scenes.garage = new GarageScene(); Scenes.play = new PlayScene(); Scenes.results = new ResultsScene();
  document.getElementById('boot')?.remove();
  // Debug/test hooks: ?play=m2 jumps straight into a mission.
  const q = new URLSearchParams(location.search);
  const m = q.get('play');
  if (m && missionById(m)) go(Scenes.play, { mission: missionById(m) }, true);
  else if (q.get('scene') && (Scenes as any)[q.get('scene')!]) go((Scenes as any)[q.get('scene')!], undefined, true);
  else go(Scenes.title, undefined, true);
  (window as any).__wb = { Engine, Save, Scenes, go, missionById };
}
boot();
