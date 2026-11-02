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
  const open = async (url, ms) => { await p.goto(url); await p.waitForFunction(() => window.__wb && window.__wb.Engine.scene && (!location.search.includes('play') || window.__wb.Engine.scene.w), null, { timeout: 20000 }); await p.waitForTimeout(ms); };
  // Mission 1: barricade -> supply crate -> Haven
  await open(base + '?play=m1', 2500);
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
  // Every mission boots and runs
  const all = await ev(`__wb.MISSIONS.map(m=>m.id)`);
  if (all.length < 19) fail('expected 19 missions, got ' + all.length);
  for (const m of all) {
    await open(base + '?play=' + m, 1600);
    if ((await ev(`${W}.state`)) !== 'play') fail(m + ' not running');
  }
  // Every boss can be beaten: blow all valves, wait for the wreck, objective completes
  for (const m of ['m4', 'd3', 'f3', 'g3', 'z3', 'a3']) {
    await open(base + '?play=' + m, 1500);
    await ev(`(()=>{const w=${W};const b=w.boss;w.player.x=b.arenaX+200;w.player.y=200;})()`);
    await p.waitForTimeout(700);
    await ev(`(()=>{const w=${W};const b=w.boss;b.intro=0;for(const v of b.valves){const q=b.valvePos(v);for(let i=0;i<6;i++)w.explode(q.x,q.y,1);} })()`);
    await p.waitForTimeout(4500);
    if (!(await ev(`${W}.bossDown`))) fail(m + ' boss not defeated');
  }
  // Region mechanics: flood dunk soaks, frozen altitude ices, lava burns
  await open(base + '?play=f1', 2000);
  await ev(`(()=>{const w=${W};const g=w.terrain.buildings;let x=900;while(g.some(b=>x>b.x-60&&x<b.x+b.w+60))x+=40;w.player.x=x;w.player.y=470;w.player.invuln=0;})()`);
  await p.keyboard.down('ArrowDown'); await p.waitForTimeout(3500); await p.keyboard.up('ArrowDown');
  if ((await ev(`${W}.player.damageTaken`)) < 1) fail('flood water did not soak');
  await open(base + '?play=z1', 2000);
  await ev(`(()=>{const w=${W};w.player.y=170;})()`); await p.keyboard.down('ArrowUp'); await p.waitForTimeout(2500); await p.keyboard.up('ArrowUp');
  if ((await ev(`${W}.player.ice`)) < 0.2) fail('frozen icing did not build');
  await open(base + '?play=a1', 2000);
  await ev(`(()=>{const w=${W};const [a,l]=w.terrain.lava[0];w.player.x=a+l/2;w.player.y=w.terrain.groundY(a+l/2)-30;w.player.vy=100;w.player.invuln=0;})()`); await p.waitForTimeout(800);
  if ((await ev(`${W}.player.damageTaken`)) < 1) fail('lava did not burn');
  // Camps: deliver all three Haven requests -> perk active (+1 bomb capacity)
  await open(base + '?scene=title', 500);
  await ev(`(()=>{const s=__wb.Save.data;s.res={fuel:50,scrap:80,fabric:40,food:10,water:10,electronics:10};s.camps={};__wb.Save.write();__wb.go(__wb.Scenes.camp,{region:'city'});})()`);
  await p.waitForTimeout(800);
  for (let i = 0; i < 3; i++) { await ev(`__wb.Engine.scene.fulfil()`); }
  if ((await ev(`__wb.Save.data.camps.city`)) !== 3) fail('camp requests not fulfilled');
  if (!(await ev(`__wb.Save.perks().includes('workshop')`))) fail('camp perk not granted');
  await open(base + '?play=m2', 600);
  if ((await ev(`${W}.player.stats.bombCap`)) !== 4) fail('workshop perk not applied to bombs');
  // Menus render
  for (const s of ['title', 'map', 'garage', 'ending', 'camp']) { await open(base + '?scene=' + s, 1200); }
  await b.close();
  if (errs.length) fail('page errors:\n' + errs.join('\n'));
  console.log('SMOKE OK');
})().catch((e) => fail(e.stack));
