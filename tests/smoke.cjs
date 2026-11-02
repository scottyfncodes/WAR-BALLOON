// Plays through mission 1 headlessly and checks every mission boots without errors.
// Usage: node tests/smoke.cjs [baseUrl]   (default http://localhost:4173/)
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:4173/';
const fail = (m) => { console.error('SMOKE FAIL:', m); process.exit(1); };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1170, height: 540 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const W = '__wb.Engine.scene.w';
  const ev = (js) => p.evaluate(js);
  // Mission 1: barricade -> supply crate -> Haven
  await p.goto(base + '?play=m1'); await p.waitForTimeout(2500);
  await ev(`(()=>{const w=${W};w.player.x=880;w.player.y=330;w.player.vx=0;w.player.vy=0;})()`);
  for (let i = 0; i < 4; i++) { await p.keyboard.press('KeyB'); await p.waitForTimeout(700); }
  if (!(await ev(`${W}.objectives[0].done`))) fail('barricade not destroyed');
  await ev(`(()=>{const w=${W};const b=w.terrain.buildings.find(b=>1505>=b.x&&1505<=b.x+b.w);w.player.x=1505;w.player.y=b.top-100;w.player.vx=0;w.player.vy=0;})()`);
  await p.keyboard.press('KeyH'); await p.waitForTimeout(3500);
  if (!(await ev(`${W}.objectives[1].done`))) fail('supply crate not retrieved');
  await ev(`(()=>{const w=${W};w.player.x=w.exitX-40;w.player.y=360;})()`);
  await p.waitForTimeout(500);
  if ((await ev(`${W}.state`)) !== 'complete') fail('mission did not complete');
  await p.waitForTimeout(3500);
  if (!(await ev(`!!__wb.Save.data.missions.m1?.done`))) fail('progress not saved');
  // Every mission boots and runs for a few seconds
  for (const m of ['m2', 'm3', 'm4']) {
    await p.goto(base + '?play=' + m); await p.waitForTimeout(3000);
    if ((await ev(`${W}.state`)) !== 'play') fail(m + ' not running');
  }
  // Menus render
  for (const s of ['title', 'map', 'garage']) { await p.goto(base + '?scene=' + s); await p.waitForTimeout(1200); }
  await b.close();
  if (errs.length) fail('page errors:\n' + errs.join('\n'));
  console.log('SMOKE OK');
})().catch((e) => fail(e.stack));
