import '@fontsource/luckiest-guy';
import '@fontsource/patrick-hand';
import { Engine } from './core/engine';
import { Input } from './core/input';
import { Audio } from './core/audio';
import { Save } from './core/save';
import { Scenes } from './scenes/registry';
import { TitleScene } from './scenes/title';
import { IntroScene } from './scenes/intro';
import { HavenScene } from './scenes/haven';
import { WorkshopScene } from './scenes/workshop';
import { CrewScene } from './scenes/crew';
import { PlayScene } from './scenes/play';
import { ReportScene } from './scenes/report';
import { EndingScene } from './scenes/ending';
import { go } from './scenes/router';
import { BIOMES, regionNeeds } from './game/biomes';
import { settle } from './game/expedition';
import { computeStats, UPGRADES } from './game/upgrades';
import { makeSurvivor } from './game/crew';
import { RNG } from './core/math';

async function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  try { await Promise.race([Promise.all([document.fonts.load('40px "Luckiest Guy"'), document.fonts.load('20px "Patrick Hand"')]), new Promise((r) => setTimeout(r, 2500))]); } catch { /* fonts optional */ }
  Engine.init(canvas);
  Input.init(canvas);
  Audio.musicOn = Save.data.music; Audio.sfxOn = Save.data.sfx;
  Input.onFirstGesture.push(() => Audio.unlock());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Audio.suspend(); else Audio.resume(); });
  Scenes.title = new TitleScene(); Scenes.intro = new IntroScene(); Scenes.haven = new HavenScene(); Scenes.workshop = new WorkshopScene();
  Scenes.crew = new CrewScene(); Scenes.play = new PlayScene(); Scenes.report = new ReportScene(); Scenes.ending = new EndingScene();
  document.getElementById('boot')?.remove();
  // Debug/test hooks: ?play=<region> jumps straight into an expedition, ?scene=<name> opens a menu.
  const q = new URLSearchParams(location.search);
  const m = q.get('play');
  if (m && (BIOMES as any)[m]) go(Scenes.play, { region: m, seed: q.get('seed') ? +q.get('seed')! : undefined }, true);
  else if (q.get('scene') && (Scenes as any)[q.get('scene')!]) go((Scenes as any)[q.get('scene')!], undefined, true);
  else go(Scenes.title, undefined, true);
  (window as any).__wb = { Engine, Save, Scenes, go, computeStats, UPGRADES, makeSurvivor, RNG, settleForSim: settle, regionNeeds, BIOMES };
}
boot();
