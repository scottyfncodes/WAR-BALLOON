const { chromium, devices } = require('playwright');
(async () => {
  const [url, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await p.screenshot({ path: out + '-0.png' });
  // stick: touch left-bottom, drag up-right and hold
  await touch('touchStart', [{ x: 90, y: 300, id: 1 }]);
  await touch('touchMove', [{ x: 120, y: 250, id: 1 }]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '-1.png' });
  // tap bomb with second finger while holding stick
  await touch('touchStart', [{ x: 120, y: 250, id: 1 }, { x: 778, y: 323, id: 2 }]);
  await p.waitForTimeout(80);
  await touch('touchEnd', [{ x: 120, y: 250, id: 1 }]);
  await p.waitForTimeout(400);
  await p.screenshot({ path: out + '-2.png' });
  await touch('touchEnd', []);
  console.log(JSON.stringify(await p.evaluate(() => { const w = __wb.Engine.scene.w; return { x: w.player.x | 0, y: w.player.y | 0, bombs: w.player.bombs, dropped: w.bombsDropped, W: __wb.Engine.W }; })));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
