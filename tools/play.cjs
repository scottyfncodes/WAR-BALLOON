// Usage: node tools/play.cjs <url> <outprefix> <w> <h> '<json steps>'
// steps: [["wait",ms],["key","ArrowUp",ms],["down","KeyD"],["up","KeyD"],["shot","name"],["click",x,y],["eval","js"]]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w, h, stepsJson] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
  await p.goto(url);
  await p.waitForTimeout(1200);
  for (const s of JSON.parse(stepsJson || '[]')) {
    if (s[0] === 'wait') await p.waitForTimeout(s[1]);
    else if (s[0] === 'key') { await p.keyboard.down(s[1]); await p.waitForTimeout(s[2]); await p.keyboard.up(s[1]); }
    else if (s[0] === 'down') await p.keyboard.down(s[1]);
    else if (s[0] === 'up') await p.keyboard.up(s[1]);
    else if (s[0] === 'shot') await p.screenshot({ path: `${out}-${s[1]}.png` });
    else if (s[0] === 'click') await p.mouse.click(s[1], s[2]);
    else if (s[0] === 'eval') console.log('eval:', JSON.stringify(await p.evaluate(s[1])));
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
