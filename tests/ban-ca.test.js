'use strict';
/* node tests/ban-ca.test.js — Bắn Cá: HP model, prizes, economy simulation, swim paths. */
const assert = require('assert'); const path = require('path');
const R = require('../js/games3d/rules/ban-ca.js');
let passed = 0, failed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n ', e && e.stack || e); } }
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ------------------------------------------------------------------ tables
t('cannon levels map to 1k/2k/5k/10k/50k', () => { assert.deepStrictEqual([1, 2, 3, 4, 5].map(R.betOf), [1000, 2000, 5000, 10000, 50000]); assert.strictEqual(R.betOf(9), 50000); assert.strictEqual(R.betOf(0), 1000); });
t('multipliers per tier', () => {
  const range = { small: [2, 5], medium: [8, 15], big: [20, 50], boss: [80, 150] };
  for (const f of R.FISH) { const [a, b] = range[f.tier]; assert.ok(f.mult >= a && f.mult <= b, f.id + ' ×' + f.mult); }
  for (const tier of Object.keys(range)) assert.ok(R.FISH.some(f => f.tier === tier), 'has ' + tier);
  assert.deepStrictEqual(R.BOSSES.map(f => f.id).sort(), ['bach_tuoc', 'ca_map', 'ca_voi']);
});
t('every sprite fish has a texture in the ban-ca bundle', () => {
  global.window = global.window || {}; require(path.join(__dirname, '../assets/3d/js/tex_ban-ca.js'));
  for (const f of R.FISH) if (!f.look.startsWith('proc:')) assert.ok(window.HC_TEX[f.look], f.look);
  for (const k of ['bc_net', 'bc_bullet', 'bc_cannon_1', 'bc_cannon_5']) assert.ok(window.HC_TEX[k], k);
});

// ------------------------------------------------------------------ hit points
t('HP table: E[n] = mult / 0.95 exactly (stochastic rounding), prize per hit = 95% of the bet', () => {
  const rows = [];
  for (const f of R.FISH) {
    const rng = R.rng32(f.mult * 31 + 7); let sum = 0, mn = 1e9, mx = 0; const N = 200000;
    for (let i = 0; i < N; i++) { const n = R.drawHits(f, rng); assert.ok(Number.isInteger(n) && n >= 1); sum += n; mn = Math.min(mn, n); mx = Math.max(mx, n); }
    const mean = sum / N, target = f.mult / 0.95;
    assert.ok(Math.abs(mean / target - 1) < .01, `${f.id}: mean ${mean} vs ${target}`);
    // exact expectation of the draw: E[x] with x = target × U[1−s,1+s] (≥ 1 here), stochastic rounding keeps E[n] = E[x]
    assert.ok(target * (1 - R.SPREAD[f.tier]) >= 1, 'no clamping needed for ' + f.id);
    assert.ok(close(R.hp(f.mult) * 0.95, f.mult));
    rows.push(`${f.name.padEnd(20)} ×${String(f.mult).padStart(3)}  máu ${String(mn).padStart(3)}–${String(mx).padEnd(3)} TB ${mean.toFixed(2).padStart(6)} (đích ${target.toFixed(2)})  thưởng/phát ${(f.mult / mean * 100).toFixed(1)}%`);
  }
  console.log('  HP table:\n    ' + rows.join('\n    '));
});
t('small fish (×2–×5) die within 5 hits (~always)', () => {
  for (const f of R.FISH.filter(f => f.tier === 'small')) {
    const rng = R.rng32(f.mult); let over = 0; const N = 100000;
    for (let i = 0; i < N; i++) { const n = R.drawHits(f, rng); if (n > 5) over++; assert.ok(n >= 1 && n <= 6); }
    assert.ok(over / N < .005, `${f.id}: ${over} of ${N} need more than 5 hits`);
  }
});
t('the hit that empties the bar catches the fish and pays bet × mult (one cannon, one level)', () => {
  const f = R.BY_ID.rua, tg = R.newTarget(f, Math.random, 21);
  for (let i = 1; i < 21; i++) { const r = R.applyHit(tg, 0, 5000); assert.ok(!r.dead); assert.strictEqual(r.left, 21 - i); }
  const r = R.applyHit(tg, 0, 5000);
  assert.ok(r.dead); assert.deepStrictEqual(r.payouts, [{ shooter: 0, amount: 100000 }]); assert.strictEqual(r.killer, 0);
  assert.ok(R.applyHit(tg, 0, 5000).late, 'a dead fish takes no more hits');
});
t('prize is shared by coins put in: bots finishing your fish still pay you, bots never touch your wallet', () => {
  const tg = R.newTarget(R.BY_ID.cua, Math.random, 10);   // ×10, 10 hits
  for (let i = 0; i < 6; i++) R.applyHit(tg, 0, 2000);    // you: 12K in
  for (let i = 0; i < 3; i++) R.applyHit(tg, 2, 10000);   // bot 2: 30K in
  const r = R.applyHit(tg, 2, 10000);                      // bot 2 lands the last hit: 40K in
  assert.ok(r.dead); assert.strictEqual(r.killer, 2);
  const by = Object.fromEntries(r.payouts.map(p => [p.shooter, p.amount]));
  assert.strictEqual(by[0], 10 * 12000 / 10); assert.strictEqual(by[2], 10 * 40000 / 10);
  assert.strictEqual(R.prizeFor(tg, 0), 12000);
});
t('switching to a big bet for the last hit gains nothing (same return per coin)', () => {
  const m = 25, n = 26;
  const a = R.newTarget(R.BY_ID.tom_hum, Math.random, n); let inA = 0, outA = 0;
  for (let i = 0; i < n; i++) { const bet = i < n - 1 ? 1000 : 50000; inA += bet; const r = R.applyHit(a, 0, bet); if (r.dead) outA = r.payouts[0].amount; }
  assert.ok(Math.abs(outA - m * inA / n) <= .5, `prize ${outA} vs ${m * inA / n} (same ${(m / n).toFixed(4)} per coin, rounded to the coin)`);
  const b = R.newTarget(R.BY_ID.tom_hum, Math.random, n); let outB = 0;
  for (let i = 0; i < n; i++) { const r = R.applyHit(b, 0, 1000); if (r.dead) outB = r.payouts[0].amount; }
  assert.strictEqual(outB, m * 1000);
});
t('net slows a fish that was just hit; lock advice', () => {
  assert.strictEqual(R.speedFactor(.1), R.SLOW); assert.strictEqual(R.speedFactor(5), 1);
  const p = R.makePath(R.BY_ID.ca_voi, R.rng32(1)), tg = R.newTarget(R.BY_ID.ca_voi, Math.random, 150);
  assert.ok(R.worthLocking(tg, p, 0, .75, 5)); assert.ok(!R.worthLocking(tg, p, p.len - 1, .75, 5));
  assert.strictEqual(R.needed({ n: 5, hits: 2 }, 3), 0); assert.strictEqual(R.needed({ n: 5, hits: 2 }, 1), 2);
});

// ------------------------------------------------------------------ economy
t('exact model: every shot lands, every fish is finished → return = 95%', () => {
  // renewal-reward with one cannon: Σ prizes / Σ shots over many fish
  const rng = R.rng32(42); let shots = 0, back = 0;
  for (let i = 0; i < 200000; i++) { const f = R.pickType(rng), tg = R.newTarget(f, rng); for (let k = 0; k < tg.n; k++) { const r = R.applyHit(tg, 0, 1000); shots++; if (r.dead) back += r.payouts[0].amount; } }
  const rtp = back / (shots * 1000);
  console.log(`  finish-every-fish model: ${shots.toLocaleString()} shots · RTP ${(rtp * 100).toFixed(2)}%`);
  assert.ok(Math.abs(rtp - .95) < .005, 'rtp ' + rtp);
});
t('100k+ shots in the simulated world (homing, bots, escapes) return 90–98%', () => {
  const out = [];
  for (const [seed, smart] of [[1, false], [2, false], [3, true]]) {
    const r = R.simulateWorld({ shots: 120000, rng: R.rng32(seed), smart });
    out.push(`${smart ? 'TỰ BẮN-style' : 'random lock '} seed ${seed}: ${r.shots.toLocaleString()} shots · RTP ${(r.rtp * 100).toFixed(2)}% · ${r.kills} catches · hits lost on escaped fish ${(r.escapeShare * 100).toFixed(1)}% · refunds ${r.refunds} · ${r.seconds}s of play`);
    assert.ok(r.shots >= 120000);
    assert.ok(r.rtp >= .90 && r.rtp <= .98, 'rtp ' + r.rtp);
    assert.ok(r.escapeShare < .06, 'escape share ' + r.escapeShare);
  }
  console.log('  ' + out.join('\n  '));
});

// ------------------------------------------------------------------ spawn & paths
t('spawn picks only regular fish, roughly by weight', () => {
  const rng = R.rng32(11), cnt = {}; for (let i = 0; i < 50000; i++) { const f = R.pickType(rng); cnt[f.id] = (cnt[f.id] || 0) + 1; assert.notStrictEqual(f.tier, 'boss'); }
  const tot = R.FISH.reduce((s, f) => s + f.weight, 0);
  for (const f of R.FISH) if (f.weight) assert.ok(Math.abs(cnt[f.id] / 50000 - f.weight / tot) < .01, f.id);
  assert.strictEqual(R.pickBoss(rng).tier, 'boss');
  for (let i = 0; i < 100; i++) { const d = R.nextBossDelay(rng); assert.ok(d >= 50 && d <= 70); }
  for (const f of R.FISH) for (let i = 0; i < 50; i++) { const n = R.schoolSize(f, rng); assert.ok(n >= f.school[0] && n <= f.school[1]); }
});
t('swim paths start and end off-field, cross the field, and stay inside bounds ± margin', () => {
  const rng = R.rng32(2026);
  const boundsList = [R.DEFAULT_BOUNDS, { x0: -8, x1: 8, z0: -6.5, z1: 6.5 }, { x0: -12.5, x1: 12.5, z0: -7, z1: 7 }];
  let paths = 0;
  for (const b of boundsList) for (const f of R.FISH) for (let k = 0; k < 120; k++) {
    const p = R.makePath(f, rng, b), m = R.margin(f), spread = R.schoolSpread(f);
    assert.ok(spread < m, 'school spread fits in the margin');
    const a = R.pathAt(p, 0), z = R.pathAt(p, p.len);
    assert.ok(!R.inside(a.x, a.z, b, f.r), 'starts off-field'); assert.ok(!R.inside(z.x, z.z, b, f.r), 'ends off-field');
    let inn = 0;
    for (let i = 0; i <= 60; i++) {
      const q = R.pathAt(p, p.len * i / 60);
      assert.ok(R.inside(q.x, q.z, b, m + 1e-9), `inside bounds±margin (${q.x.toFixed(2)},${q.z.toFixed(2)})`);
      for (const o of [-spread, spread]) assert.ok(R.inside(q.x - q.dz * o, q.z + q.dx * o, b, m + spread + 1e-9));
      if (R.inside(q.x, q.z, b)) inn++;
      assert.ok(Math.abs(Math.hypot(q.dx, q.dz) - 1) < 1e-6, 'unit tangent');
    }
    assert.ok(inn >= 18, 'spends a good part of the path on the field: ' + inn);
    paths++;
  }
  console.log('  ' + paths + ' paths checked');
});
t('constant speed along the path (arc-length table)', () => {
  const p = R.makePath(R.BY_ID.ca_vang, R.rng32(5)); let prev = R.pathAt(p, 0); const steps = [];
  for (let i = 1; i <= 200; i++) { const q = R.pathAt(p, p.len * i / 200); steps.push(Math.hypot(q.x - prev.x, q.z - prev.z)); prev = q; }
  const avg = p.len / 200; for (const s of steps) assert.ok(Math.abs(s - avg) / avg < .08, 'step ' + s + ' vs ' + avg);
});
t('boss paths cross side to side', () => {
  const rng = R.rng32(9); for (const f of R.BOSSES) for (let i = 0; i < 50; i++) { const p = R.makePath(f, rng); const a = R.pathAt(p, 0), z = R.pathAt(p, p.len); assert.ok(Math.sign(a.x) === -Math.sign(z.x)); }
});

console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
