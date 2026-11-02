// Balance simulator: a scripted pilot plays whole campaigns at high speed (steps the
// expedition directly, no rendering) and reports how the progression feels.
// Usage: node tools/balance.cjs [baseUrl] [campaigns=3] [maxRuns=40]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:4173/';
const campaigns = +(process.argv[3] || 3), maxRuns = +(process.argv[4] || 40);

const PAGE_SIM = String.raw`
window.__region = function(region, gear, crewN, crewLv, runs, skill, seed0, process_greedy) {
  const W = __wb; const S = W.Save; const out = [];
  for (let k = 0; k < runs; k++) {
    S.reset(); S.data.seenIntro = true; S.data.seenTutorial = true; S.data.levels = { ...gear };
    S.data.res.food = 99; const rng = new W.RNG(seed0 * 77 + k);
    for (let i = 0; i < crewN; i++) { const c = W.makeSurvivor(rng, 2, []); c.level = crewLv; S.data.crew.push(c); }
    const roles = ['gunner', 'mechanic', 'medic', 'engineer', 'scavenger', 'lookout', 'cook', 'gunner']; S.data.crew.forEach((c, i) => c.role = roles[i % roles.length]);
    S.data.aboard = S.data.crew.map(c => c.id);
    W.go(W.Scenes.play, { region, seed: seed0 * 1000 + k }, true); const e = W.Engine.scene.e; W.go(W.Scenes.title, undefined, true);
    const m = { home: false, grabT: -1, react: 0.45 + (1 - skill) * 0.8, t: 0, dist: 0, burn: 0, beaconFirst: !process_greedy }; m.dmg = {};
    const hj = e.ship.hurtJerry.bind(e.ship); e.ship.hurtJerry = (ee, d, src) => { if (e.ship.invuln <= 0) m.dmg['J:' + src] = (m.dmg['J:' + src] || 0) + d; hj(ee, d, src); };
    const he = e.ship.hurtEnv.bind(e.ship); e.ship.hurtEnv = (ee, d, src) => { m.dmg['E:' + src] = (m.dmg['E:' + src] || 0) + d; he(ee, d, src); };
    let steps = 0, grabs = 0, ph = 0, minFuel = 1, minEnv = 1, minHp = 9;
    m.trail = [];
    while (e.state === 'play' && steps < 60 * 600) { if (steps % 1800 === 0) m.trail.push(Math.round(e.ship.x / 100)); const pf = e.ship.fuel, px = e.ship.x; e.update(pilot(e, m, skill), 1 / 60); steps++; m.t += 1 / 60; m.burn += Math.max(0, pf - e.ship.fuel); m.dist += Math.abs(e.ship.x - px); const h = e.ship.hangers.length; if (h > ph) grabs += h - ph; ph = h; minFuel = Math.min(minFuel, e.ship.fuel / e.ship.maxFuel); minEnv = Math.min(minEnv, e.ship.env / e.ship.maxEnv); minHp = Math.min(minHp, e.ship.hp); }
    if (e.state === 'play') e.ship.crash(e, 'timeout');
    const loot = Object.values(e.cargo).reduce((a, b) => a + b, 0) + Object.values(e.banked).reduce((a, b) => a + b, 0);
    out.push({ ok: e.state === 'home', why: e.crashWhy, beacon: e.beaconLit, t: Math.round(m.t), grabs, loot: e.state === 'home' ? loot : Math.floor(loot * 0.3), resc: e.rescued.length + e.bankedRescued.length, minFuel: +minFuel.toFixed(2), minEnv: +minEnv.toFixed(2), minHp, dmg: m.dmg, kills: e.kills, homeWhy: m.homeWhy || '-', trail: m.trail.join(' ') });
  }
  return out;
};
window.__sim = async function(seed, maxRuns, skill) {
  const W = __wb; const S = W.Save;
  S.reset(); S.data.seenIntro = true; S.data.seenTutorial = true;
  const ORDER = ['suburbs','town','industrial','downtown','military','deadzone'];
  const PRIO = ['basket','envelope','burner','gun','tank','plating','shaker','spikes','bombs','ladder','storage','regulator','boost','skin','flamer','prop','firebomb','tesla','turret','floor','mines','hook','spyglass'];
  const can = (cost) => Object.keys(cost).every(k => S.data.res[k] >= cost[k]);
  const buyAll = () => { let bought = []; let again = true;
    // like a player reading the Haven card: save up for the balloon the next region demands
    let gate = null; for (let i = 1; i < 6; i++) if (S.regionUnlocked(i, ORDER) && W.regionNeeds(ORDER[i], S.data.levels).length) { gate = W.BIOMES[ORDER[i]].needs; break; }
    const list = gate ? PRIO.filter(id => (id === 'basket' && (S.data.levels.basket ?? 0) < (gate.basket ?? 0)) || (id === 'envelope' && (S.data.levels.envelope ?? 0) < (gate.envelope ?? 0)) || ['tank', 'burner'].includes(id) && false) : PRIO;
    while (again) { again = false;
    for (const id of list) { const u = W.UPGRADES.find(q => q.id === id); const lv = S.data.levels[id] ?? 0; if (lv >= u.costs.length) continue;
      if (u.region && !S.regionUnlocked(u.region, ORDER)) continue; if (u.requires && (S.data.levels[u.requires[0]] ?? 0) < u.requires[1]) continue;
      if (can(u.costs[lv])) { for (const k in u.costs[lv]) S.data.res[k] -= u.costs[lv][k]; S.data.levels[id] = lv + 1; bought.push(id + (lv + 1)); again = true; break; } } }
    // heal + seat crew
    for (const c of S.data.crew) if (c.injured && S.data.res.meds > 0) { S.data.res.meds--; c.injured = 0; }
    const seats = W.computeStats(S.data.levels).seats;
    S.data.aboard = S.data.crew.filter(c => !c.injured && !S.data.missing[c.id]).sort((a, b) => b.level - a.level).slice(0, seats).map(c => c.id);
    S.write(); return bought; };
  const log = [];
  let rng = seed; let farmLeft = 0;
  for (let run = 0; run < maxRuns; run++) {
    let ri = 0; for (let i = 0; i < 6; i++) if (S.regionUnlocked(i, ORDER) && !W.regionNeeds(ORDER[i], S.data.levels).length) ri = i;
    // like a player: after two crashes in a row at the frontier, farm the previous region for two trips
    const last = log.slice(-2);
    if (farmLeft > 0) { farmLeft--; ri = Math.max(0, ri - 1); }
    else if (ri > 0 && last.length === 2 && last.every(r => !r.ok && r.region === ORDER[ri])) { farmLeft = 1; ri--; }
    const region = ORDER[ri];
    W.go(W.Scenes.play, { region, seed: seed * 1000 + run }, true);
    const sc = W.Engine.scene; const e = sc.e;
    W.go(W.Scenes.title, undefined, true); // detach from the live loop; we step it ourselves
    const m = { home: false, grabT: -1, outpostDone: false, react: 0.45 + (1 - skill) * 0.8, maxH: 0, grabs: 0, prevH: 0, minFuel: 999, fuelAtBeacon: -1, t: 0, minEnv: 999, burn: 0, pf: 0, emptyT: -1 };
    const dt = 1 / 60; let steps = 0; m.dmg = {};
    const hj = e.ship.hurtJerry.bind(e.ship); e.ship.hurtJerry = (ee, d, src) => { if (e.ship.invuln <= 0) m.dmg['J:' + src] = (m.dmg['J:' + src] || 0) + d; hj(ee, d, src); };
    const he = e.ship.hurtEnv.bind(e.ship); e.ship.hurtEnv = (ee, d, src) => { m.dmg['E:' + src] = (m.dmg['E:' + src] || 0) + d; he(ee, d, src); };
    while (e.state === 'play' && steps < 60 * 600) {
      m.pf = e.ship.fuel; const c = pilot(e, m, skill); e.update(c, dt); steps++; m.t += dt; m.burn += Math.max(0, m.pf - e.ship.fuel); if (e.ship.fuel <= 0 && m.emptyT < 0) m.emptyT = m.t;
      const h = e.ship.hangers.length; if (h > m.prevH) m.grabs += h - m.prevH; m.prevH = h; m.maxH = Math.max(m.maxH, h);
      m.minFuel = Math.min(m.minFuel, e.ship.fuel / e.ship.maxFuel); m.minEnv = Math.min(m.minEnv, e.ship.env / e.ship.maxEnv);
      if (e.beaconLit && m.fuelAtBeacon < 0) m.fuelAtBeacon = e.ship.fuel / e.ship.maxFuel;
    }
    for (let i = 0; i < 200 && e.state !== 'play'; i++) e.update({ x: 0, y: 0 }, dt);
    if (e.state === 'play') { m.stuck = Math.round(e.ship.x) + '/' + Math.round(e.altitude()) + (m.home ? 'H' : ''); e.ship.crash(e, 'timeout'); }
    const r = W.settleForSim(e);
    const loot = Object.values(r.gains).reduce((a, b) => a + b, 0);
    const bought = buyAll();
    log.push({ run, region, ok: r.success, why: r.why, t: Math.round(m.t), loot, resc: r.rescued.length, grabs: m.grabs, maxH: m.maxH, minFuel: +m.minFuel.toFixed(2), fuelB: +m.fuelAtBeacon.toFixed(2), minEnv: +m.minEnv.toFixed(2), beacon: r.firstBeacon, crew: S.data.crew.length, lost: r.lost.length, bought: bought.join(' '), tier: S.data.levels.basket ?? 0, burnPm: Math.round(m.burn / m.t * 60), emptyT: Math.round(m.emptyT), stuck: m.stuck || '', dmg: Object.entries(m.dmg).map(([k, v]) => k + '=' + v).join(',') });
    if (S.data.regions.deadzone?.beacon) break;
  }
  return log;
};

function pilot(e, m, skill) {
  const s = e.ship; const c = { x: 0, y: 0, drop: false, hook: false, shake: false, flame: false, boost: false, cycle: false };
  if (!s.launched || s.dead) return c;
  const surf = (x) => e.terrain.surfaceY(x);
  const dist = (a) => Math.abs(a - s.x);
  // decide when to turn for home: beacon lit, or fuel needed to get back
  const back = s.x - (e.haven.x + e.haven.w / 2);
  const fuelPerUnit = m.dist > 800 ? m.burn / m.dist : 0.016 * s.stats.fuelUse;
  if (!m.home) { const w = e.beaconLit ? 'beacon' : s.fuel < back * fuelPerUnit * 1.15 + 6 ? 'fuel' : s.env / s.maxEnv < 0.3 ? 'env' : s.hp <= 1 ? 'hp' : m.t > 400 ? 'time' : ''; if (w) { m.home = true; m.homeWhy = w; } }
  const dir = m.home ? -1 : 1;
  let tx = m.home ? e.haven.x + e.haven.w / 2 : e.beacon.x + e.beacon.w / 2;
  let talt = 150; // cruise above rooftops, out of grabbing range
  let hover = false;
  if (m.home && dist(e.haven.x + e.haven.w / 2) < 160) { talt = 0; hover = true; }
  // outpost: bank & refuel on the way past
  const op = e.outpost.x + e.outpost.w / 2;
  if (!m.outpostDone && !(m.opT > 8) && dist(op) < 500 && ((s.fuel / s.maxFuel < 0.6 && !e.refueled) || Object.values(e.cargo).reduce((a, b) => a + b, 0) > 12 || s.crew.some(q => q.isNew))) { tx = op; talt = 6; hover = true; m.opT = (m.opT || 0) + 1 / 60; if (e.outpostT > 1.1) m.outpostDone = true; }
  else if (!m.home || dist(op) > 600) { if (e.outpostT === 0 && dist(op) > 700) m.outpostDone = false; }
  // survivors ahead: dip for them if there's a seat
  if (!hover && s.seatsFree() > 0) {
    const v = e.survivors.filter(v => (v.state === 'wait' || v.state === 'climb') && (v.x - s.x) * dir > -60 && dist(v.x) < (m.beaconFirst ? 260 : 420)).sort((a, b) => dist(a.x) - dist(b.x))[0];
    if (v && m.survTry?.v !== v) m.survTry = { v, t: m.t };
    if (v && m.t - m.survTry.t < 12) { tx = v.x; talt = 40 + 30 * s.stats.ladder; hover = dist(v.x) < 40; }
  }
  // loot ahead: dip and hook
  if (!hover && s.hookState === 'stowed') {
    const it = e.loot.filter(l => !l.hooked && (l.x - s.x) * dir > -30 && dist(l.x) < (m.beaconFirst ? 180 : 300)).sort((a, b) => dist(a.x) - dist(b.x))[0];
    if (it && (m.lootTry?.it !== it)) m.lootTry = { it, t: m.t };
    if (it && m.t - m.lootTry.t < 6) { tx = it.x; talt = Math.min(110, s.stats.ropeLen * 0.65); if (dist(it.x) < 18 && s.basketY < it.y - 30 && it.y - s.basketY < s.stats.ropeLen * 0.85) c.hook = true; }
  }
  if (s.hookState === 'out' && s.ropeLen >= s.stats.ropeLen - 1 && !s.cargoHook.length) c.hook = true; // reel in a miss
  // the beacon: hover beside the mast top
  if (!m.home && dist(e.beacon.x + e.beacon.w / 2) < 400) { tx = e.beacon.x + e.beacon.w / 2; }
  c.x = Math.max(-1, Math.min(1, (tx - s.x) / 90));
  if (hover && dist(tx) < 30) c.x *= 0.3;
  // altitude: aim for talt above the highest surface just ahead
  // clearance: when hovering on a target, only what's under the basket matters; in transit, look ahead
  let floor = surf(s.x);
  const hw = s.halfW + 12;
  if (hover || dist(tx) < 60) { for (let dx = -hw; dx <= hw; dx += 8) floor = Math.min(floor, surf(s.x + dx)); }
  else for (let dx = -hw; dx <= 160 + hw; dx += 16) floor = Math.min(floor, surf(s.x + Math.sign(c.x || dir) * dx));
  if (!m.home && dist(e.beacon.x + e.beacon.w / 2) < 140) floor = Math.min(floor, e.beacon.top - 70);
  const wobble = (1 - skill) * 40 * Math.sin(m.t * 0.7);
  const want = floor - talt + wobble;
  const err = s.basketY - want;
  if (err > 0 || s.vy > 70) c.y = -Math.min(1, 0.35 + err / 60); else if (err < -50 && s.vy < 40) c.y = 0.6;
  // zombies on the basket: react, shake, climb, burn
  const h = s.hangers.length;
  if (h > 0) { if (m.grabT < 0) m.grabT = m.t; if (m.t - m.grabT > m.react) { c.shake = true; c.y = -1; if (h >= 2) c.flame = true; if (h >= 3) c.boost = true; } }
  else m.grabT = -1;
  // crowd below: drop something
  const below = e.zombies.filter(z => !z.dead && !z.attached && Math.abs(z.x - s.x - s.vx * 0.4) < 40 && z.y > s.basketY).length;
  if (below >= 3 && Math.random() < 0.05 * skill) c.drop = true;
  return c;
}
`;

const GEAR = {
  suburbs: [{}, {}],
  town: [{}, { basket: 1, envelope: 1, burner: 1, tank: 1 }],
  industrial: [{ basket: 1, envelope: 1, burner: 1, tank: 1 }, { basket: 2, envelope: 2, burner: 2, tank: 1, gun: 1, plating: 1, shaker: 1, bombs: 1 }],
  downtown: [{ basket: 2, envelope: 2, burner: 2, tank: 1, gun: 1, plating: 1, shaker: 1, bombs: 1 }, { basket: 2, envelope: 3, burner: 2, tank: 2, gun: 2, plating: 1, shaker: 1, bombs: 1, spikes: 1, skin: 1, regulator: 1 }],
  military: [{ basket: 2, envelope: 3, burner: 2, tank: 2, gun: 2, plating: 1, shaker: 1, bombs: 1, spikes: 1, skin: 1, regulator: 1 }, { basket: 3, envelope: 3, burner: 2, tank: 2, gun: 2, plating: 2, shaker: 2, bombs: 2, spikes: 1, skin: 2, regulator: 1, flamer: 1, tesla: 1, boost: 1 }],
  deadzone: [{ basket: 3, envelope: 3, burner: 2, tank: 2, gun: 2, plating: 2, shaker: 2, bombs: 2, spikes: 1, skin: 2, regulator: 1, flamer: 1, tesla: 1, boost: 1 }, { basket: 4, envelope: 4, burner: 3, tank: 3, gun: 3, plating: 2, shaker: 2, bombs: 2, spikes: 1, skin: 2, regulator: 2, flamer: 2, tesla: 1, boost: 2, turret: 1, firebomb: 1 }],
};
const CREW = { suburbs: [0, 0, 1], town: [0, 2, 1], industrial: [2, 4, 2], downtown: [4, 4, 2], military: [4, 6, 3], deadzone: [6, 8, 3] };
async function regionMode(p) {
  const regions = (process.env.REGIONS || 'suburbs,town,industrial,downtown,military,deadzone').split(',');
  const runs = +(process.env.RUNS || 10), skill = +(process.env.SKILL || 0.7);
  for (const r of regions) for (const tier of [0, 1]) {
    const [under, exp, lv] = CREW[r];
    const res = await p.evaluate((a) => window.__region(...a), [r, GEAR[r][tier], tier ? exp : under, lv, runs, skill, 5 + tier, !!process.env.GREEDY]);
    const n = res.length, ok = res.filter(x => x.ok).length, bea = res.filter(x => x.beacon).length;
    const why = {}; for (const x of res) if (!x.ok) why[x.why] = (why[x.why] || 0) + 1;
    const dmg = {}; for (const x of res) for (const k in x.dmg) dmg[k] = +((dmg[k] || 0) + x.dmg[k] / n).toFixed(1);
    const avg = (f) => Math.round(res.reduce((a, x) => a + f(x), 0) / n);
    console.log(`${r.padEnd(10)} ${tier ? 'EXPECTED' : 'UNDER   '} home ${ok}/${n} beacon ${bea}/${n} t=${avg(x => x.t)}s loot=${avg(x => x.loot)} grabs=${avg(x => x.grabs)} kills=${avg(x => x.kills)} resc=${(res.reduce((a, x) => a + x.resc, 0) / n).toFixed(1)} fuelMin=${(res.reduce((a, x) => a + x.minFuel, 0) / n).toFixed(2)} envMin=${(res.reduce((a, x) => a + x.minEnv, 0) / n).toFixed(2)} hpMin=${(res.reduce((a, x) => a + x.minHp, 0) / n).toFixed(1)} close=${res.filter(x => x.minEnv < 0.25 || x.minHp <= 1).length} crashes=${JSON.stringify(why)} dmg/run=${JSON.stringify(dmg)}`);
    if (process.env.VERBOSE) for (const x of res) console.log(`    ${x.ok ? 'HOME' : 'CRASH ' + x.why} home:${x.homeWhy} t=${x.t} trail(x100): ${x.trail}`);
  }
}
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 844, height: 390 } });
  p.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  await p.goto(base + '?scene=title');
  await p.waitForFunction(() => window.__wb && window.__wb.Engine.scene);
  await p.addScriptTag({ content: PAGE_SIM });
  if (process.env.MODE === 'region') { await regionMode(p); await b.close(); return; }
  const all = [];
  for (let k = 0; k < campaigns; k++) {
    const skill = [0.85, 0.6, 0.4][k % 3];
    const log = await p.evaluate(([s, n, sk]) => window.__sim(s, n, sk), [k + 1, maxRuns, skill]);
    console.log(`\n=== campaign ${k + 1} (skill ${skill}) ===`);
    for (const r of log) console.log(`${String(r.run).padStart(2)} ${r.region.padEnd(10)} ${r.ok ? 'HOME ' : 'CRASH'} ${String(r.why || '').padEnd(8)} t=${String(r.t).padStart(3)} loot=${String(r.loot).padStart(3)} resc=${r.resc} grabs=${String(r.grabs).padStart(2)} maxH=${r.maxH} fuelMin=${r.minFuel} fuel@B=${r.fuelB} envMin=${r.minEnv} burn/min=${r.burnPm} empty@${r.emptyT} ${r.stuck}${r.beacon ? ' ★BEACON' : ''} crew=${r.crew} tier=${r.tier} [${r.dmg}] ${r.bought}`);
    all.push({ skill, log });
  }
  require('fs').writeFileSync(process.env.BAL_OUT || '/tmp/balance.json', JSON.stringify(all));
  await b.close();
})();
