// Plays the core loop headlessly: launch, get grabbed, shake free, rescue a survivor, hook loot,
// light the beacon, fly home, check the save, buy an upgrade, reload, and boot every region.
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
  const E = '__wb.Engine.scene.e';
  const ev = (js) => p.evaluate(js);
  const open = async (q, ms) => { await p.goto(base + q); await p.waitForFunction(() => window.__wb && window.__wb.Engine.scene && (!location.search.includes('play') || window.__wb.Engine.scene.e), null, { timeout: 20000 }); await p.waitForTimeout(ms); };
  /** Pin the balloon at a spot for a while (the test plays the pilot). */
  const hover = async (js, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { await ev(`(()=>{const e=${E};const s=e.ship;${js};s.vx=0;s.vy=0;})()`); await p.waitForTimeout(100); } };

  // fresh save
  await open('?scene=title', 500);
  await ev(`localStorage.clear(); __wb.Save.reset()`);
  await open('?play=suburbs&seed=3', 2500);
  if (!(await ev(`${E}.ship.launched`))) fail('balloon did not take off');
  if ((await ev(`${E}.zombies.length`)) < 20) fail('too few zombies spawned');

  // 1. zombies grab the basket when it flies low over a horde, and SHAKE throws them off
  await hover(`const z=e.zombies.find(z=>!z.bld&&!z.dead&&z.x>700);s.x=z.x;s.y=e.terrain.groundY(z.x)-s.g.bottom*0.8-12;e.outbound=true`, 3000);
  const grabbed = await ev(`${E}.ship.hangers.length + ${E}.ship.boarders.length`);
  if (grabbed < 1) fail('no zombie grabbed the low basket');
  const hy = await ev(`${E}.ship.y - 280`);
  for (let i = 0; i < 4; i++) { await p.keyboard.press('KeyX'); await hover(`s.y=${hy}`, 1500); }
  if ((await ev(`${E}.ship.hangers.length`)) > 0) fail('shaking did not clear hangers');
  if ((await ev(`${E}.shaken + ${E}.kills`)) < 1) fail('shake removed nobody');

  // 2. rescue a survivor by hovering low over their roof
  await ev(`(()=>{const e=${E};const v=e.survivors[0];e.zombies=e.zombies.filter(z=>Math.abs(z.x-v.x)>300);})()`);
  await hover(`const v=e.survivors[0];s.x=v.x;s.y=v.y-s.g.bottom*0.8-40`, 3500);
  if ((await ev(`${E}.rescued.length`)) < 1) fail('survivor not rescued');
  if ((await ev(`${E}.ship.crew.length`)) !== 1) fail('rescued survivor not aboard');

  // 3. hook some loot
  const lootX = await ev(`(()=>{const e=${E};const it=e.loot.find(l=>l.kind!=='trophy'&&l.x>600);e.zombies=e.zombies.filter(z=>Math.abs(z.x-it.x)>250);return it.x})()`);
  const lootY = await ev(`${E}.loot.find(l=>Math.abs(l.x-${lootX})<2).y`);
  await hover(`s.x=${lootX};s.y=${lootY}-130`, 400);
  await p.keyboard.press('KeyH');
  await hover(`s.x=${lootX};s.y=${lootY}-130`, 3500);
  const carried = await ev(`Object.values(${E}.cargo).reduce((a,b)=>a+b,0)`);
  if (carried < 1) fail('hook brought nothing back ' + (await ev(`JSON.stringify({st:${E}.ship.hookState,len:${E}.ship.ropeLen|0,dead:${E}.ship.dead,state:${E}.state,ly:${lootY},end:[${E}.ship.rope[9].x|0,${E}.ship.rope[9].y|0],it:${E}.loot.filter(l=>Math.abs(l.x-${lootX})<40).map(l=>[l.x|0,l.y|0,l.hooked,l.dead]),sy:${E}.ship.y|0,h:${E}.ship.hangers.length})`)));

  // 4. light the beacon
  await ev(`(()=>{const e=${E};const b=e.beacon;e.zombies=e.zombies.filter(z=>Math.abs(z.x-b.x)>400);})()`);
  await hover(`const b=e.beacon;s.x=b.x+b.w/2;s.y=b.top-140`, 2500);
  if (!(await ev(`${E}.beaconLit`))) fail('beacon not lit');
  if (!(await ev(`__wb.Save.data.regions.suburbs.beacon`))) fail('beacon not saved');

  // 5. fly home -> report -> save
  await hover(`const h=e.haven;s.x=h.x+h.w/2;s.y=h.top-s.g.bottom*0.8-4;s.hangers.length=0`, 1500);
  if ((await ev(`${E}.state`)) !== 'home') fail('did not land at Haven');
  await p.waitForTimeout(3500);
  const sv = await ev(`JSON.stringify({crew:__wb.Save.data.crew.length,scrap:__wb.Save.data.res.scrap,exp:__wb.Save.data.stats.expeditions,scene:!!__wb.Engine.scene.r})`);
  const o = JSON.parse(sv);
  if (!o.scene) fail('report scene not shown');
  if (o.crew !== 1) fail('rescued survivor did not join the roster');
  if (o.exp !== 1) fail('expedition not recorded');

  // 6. upgrade the basket: more seats, visibly bigger
  await open('?scene=workshop', 800);
  await ev(`(()=>{const s=__wb.Save.data;s.res.scrap=200;s.res.fabric=50;s.res.parts=20;})()`);
  await ev(`(()=>{const sc=__wb.Engine.scene;sc.buy(__wb.UPGRADES.find(u=>u.id==='basket'));sc.buy(__wb.UPGRADES.find(u=>u.id==='gun'));})()`);
  if ((await ev(`__wb.computeStats(__wb.Save.data.levels).seats`)) !== 2) fail('basket upgrade did not add seats');

  // 7. crew aboard + reload keeps everything
  await open('?scene=crew', 600);
  await ev(`(()=>{const sc=__wb.Engine.scene;const c=__wb.Save.data.crew[0];if(!__wb.Save.data.aboard.includes(c.id))sc.toggle(c);})()`);
  await open('?scene=haven', 800);
  const after = await ev(`JSON.stringify({crew:__wb.Save.data.crew.length,aboard:__wb.Save.data.aboard.length,basket:__wb.Save.data.levels.basket,beacon:__wb.Save.data.regions.suburbs.beacon})`);
  const a = JSON.parse(after);
  if (a.crew !== 1 || a.aboard !== 1 || a.basket !== 1 || !a.beacon) fail('save did not survive reload: ' + after);

  // 8. crew fly along and the mounted gun shoots
  await open('?play=town&seed=9', 2500);
  if ((await ev(`${E}.ship.crew.length`)) !== 1) fail('crew not aboard on launch');
  await hover(`const z=e.zombies.find(z=>!z.dead&&z.x>900);s.x=z.x;s.y=z.y-260`, 3000);
  if ((await ev(`${E}.tracers.length + ${E}.kills`)) < 1 && (await ev(`${E}.ship.gunCd`)) <= 0) fail('mounted gun never fired');

  // 9. a crash keeps 30% and the expedition still settles
  await ev(`(()=>{const e=${E};e.cargo.scrap=10;e.ship.crash(e,'bail');})()`);
  await p.waitForTimeout(4200);
  if (!(await ev(`!!__wb.Engine.scene.r && __wb.Engine.scene.r.success===false`))) fail('crash did not produce a report');

  // 10. every region boots and runs
  for (const r of ['suburbs', 'town', 'industrial', 'downtown', 'military', 'deadzone']) {
    await open('?play=' + r, 1500);
    if ((await ev(`${E}.state`)) !== 'play') fail(r + ' not running');
  }
  // menus render
  for (const s of ['title', 'intro', 'haven', 'workshop', 'crew', 'ending']) await open('?scene=' + s, 900);
  await b.close();
  if (errs.length) fail('page errors:\n' + errs.join('\n'));
  console.log('SMOKE OK');
})().catch((e) => fail(e.stack));
