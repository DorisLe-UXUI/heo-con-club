'use strict';
/* node tests/gap-thu.test.js — Gắp Thú: claw targeting, grip vs weight, slips and drops, stars, restock, save/load, economy */
const assert = require('assert');
const R = require('../js/games3d/rules/gap-thu.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); } }
const pct = x => (x * 100).toFixed(1) + '%';
const clone = M => R.load(JSON.parse(JSON.stringify(R.save(M))));
/** A machine whose next claw strength is exactly `grip`: search seeds (the strength is the first random draw of a try). */
function withGrip(layout, lo, hi) {
  for (let seed = 1; seed < 5000; seed++) { const M = R.create({ seed, layout }), g = R.G0 + R.GS * -Math.log(1 - R.rnd(Object.assign({}, M)) * 0.999999); if (g >= lo && g < hi) return M; }
  throw new Error('no seed for grip ' + lo);
}
function overlaps(M) { const P = M.prizes; for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) if (Math.hypot(P[a].x - P[b].x, P[a].z - P[b].z) < R.BY_ID[P[a].id].r + R.BY_ID[P[b].id].r - 0.01) return true; return false; }
const legal = M => M.prizes.every(p => { const r = R.BY_ID[p.id].r; return Math.abs(p.x) <= R.W - r + 1e-6 && Math.abs(p.z) <= R.D - r + 1e-6 && !R.inKeepOut(p.x, p.z, r - 1e-6); });

// ---------------------------------------------------------------- tables
t('every prize has a rarity, a model and an icon; heavier = rarer', () => {
  for (const p of R.PRIZES) { assert.ok(R.RARITY[p.rarity] && p.model && /\.png$/.test(p.icon) && p.r > 0.3 && p.r < 0.6); }
  const wt = k => R.PRIZES.filter(p => p.rarity === k).map(p => p.wt);
  assert.ok(Math.max(...wt('thuong')) < Math.min(...wt('hiem')) && Math.max(...wt('hiem')) < Math.min(...wt('sieu')) && Math.max(...wt('sieu')) < Math.min(...wt('huyen')));
  assert.ok(R.PRIZES.some(p => p.model === 'mini_bear') && R.PRIZES.some(p => p.model === 'mini_dog') && R.PRIZES.some(p => p.model === 'mini_duck'));
});
t('three machines 1K / 5K / 20K; payouts scale with the price', () => {
  assert.deepStrictEqual(R.TIERS.map(x => x.price), [1000, 5000, 20000]);
  for (const p of R.PRIZES) { const a = R.payout(p.id, 1000), b = R.payout(p.id, 20000); assert.strictEqual(b.coins, a.coins * 20); assert.strictEqual(b.tickets, a.tickets * 20); assert.strictEqual(b.value, a.value * 20); }
  assert.ok(R.payout('heovang', 1000).value > R.payout('gau', 1000).value && R.payout('gau', 1000).value > R.payout('cun', 1000).value && R.payout('cun', 1000).value > R.payout('vit', 1000).value);
  assert.ok(R.payout('vit', 1000).tickets === 0 && R.payout('heovang', 1000).gems > 0);
});

// ---------------------------------------------------------------- a fresh machine
t('a fresh machine: N prizes, no overlaps, nothing in the chute, every rarity present', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const M = R.create({ seed }); assert.strictEqual(M.prizes.length, R.N_PRIZES); assert.ok(!overlaps(M), 'overlap ' + seed); assert.ok(legal(M), 'legal ' + seed);
    for (const k of Object.keys(R.RARITY)) assert.ok(M.prizes.some(p => R.BY_ID[p.id].rarity === k), k);
  }
});
t('the claw stays inside the machine', () => {
  const c = R.clampClaw(99, -99); assert.ok(c.x === R.CLAW_BOUNDS.x1 && c.z === R.CLAW_BOUNDS.z0);
  const M = R.create({ seed: 2 }), r = R.attempt(M, -50, 50); assert.ok(r.claw.x === R.CLAW_BOUNDS.x0 && r.claw.z === R.CLAW_BOUNDS.z1);
});

// ---------------------------------------------------------------- targeting + grip
const ONE = [['vit', 0.6, -0.6]];
t('dropping on empty floor is a miss and earns a star', () => {
  const M = R.create({ seed: 3, layout: ONE }), r = R.attempt(M, 1.9, 1.2);
  assert.strictEqual(r.kind, 'miss'); assert.strictEqual(r.uid, undefined); assert.ok(r.star); assert.strictEqual(M.stars, 1);
});
t('the claw picks the prize it is most centred on', () => {
  const M = R.create({ seed: 3, layout: [['vit', 0, 0], ['heo', 0.9, 0]] });
  assert.strictEqual(R.target(M, 0.1, 0).prize.id, 'vit'); assert.strictEqual(R.target(M, 0.8, 0.05).prize.id, 'heo');
  assert.strictEqual(R.target(M, 0, 0).alignF, 1); assert.ok(R.target(M, 0.5, 0) === null || R.target(M, 0.5, 0).alignF < 1);
});
t('centring matters: off-centre grabs grip less', () => {
  const M = R.create({ seed: 3, layout: ONE }), p = M.prizes[0], reach = R.BY_ID.vit.r + R.CLAW_R;
  const at = d => R.target(M, p.x + d, p.z);
  assert.strictEqual(at(0).alignF, 1); assert.ok(at(reach * 0.5).alignF < 1 && at(reach * 0.5).alignF > 0); assert.strictEqual(at(reach * 0.85).alignF, 0);
});
t('a strong claw on a centred light prize wins it', () => {
  const M = withGrip(ONE, 1.05, 3), r = R.attempt(M, 0.6, -0.6);
  assert.strictEqual(r.kind, 'win'); assert.ok(r.ratio >= 1); assert.strictEqual(M.wins, 1);
  assert.ok(!M.prizes.some(p => p.uid === r.uid), 'the won prize left the machine');
  assert.ok(r.restocked && M.prizes.length === 1, 'restocked'); assert.ok(!r.star);
});
t('the same strong claw cannot hold the heavy golden pig', () => {
  const M = withGrip([['heovang', 0.6, -0.6]], 1.05, 1.4), r = R.attempt(M, 0.6, -0.6);
  assert.notStrictEqual(r.kind, 'win'); assert.ok(r.ratio < 0.5 ? r.kind === 'slip' : r.kind === 'drop');
});
t('a weak claw slips at once: the prize stays about where it was', () => {
  const M = withGrip(ONE, 0.29, 0.45), r = R.attempt(M, 0.6, -0.6);
  assert.strictEqual(r.kind, 'slip'); assert.ok(Math.hypot(r.land.x - 0.6, r.land.z + 0.6) < 0.35); assert.ok(M.prizes.some(p => p.uid === r.uid));
});
t('a medium claw drops the prize part of the way: it ends up nearer the chute', () => {
  const M = withGrip([['vit', 1.6, -1.0]], 0.7, 0.9), r = R.attempt(M, 1.6, -1.0);
  assert.strictEqual(r.kind, 'drop'); assert.ok(r.f > 0 && r.f < 1);
  const d0 = Math.hypot(1.6 - R.CHUTE.x, -1.0 - R.CHUTE.z), p = M.prizes.find(q => q.uid === r.uid), d1 = Math.hypot(p.x - R.CHUTE.x, p.z - R.CHUTE.z);
  assert.ok(d1 < d0 - 0.3, `${d1} < ${d0}`); assert.ok(legal(M));
});
t('a drop that lands over the opening falls in: lucky win', () => {
  let found = null;
  for (let seed = 1; seed < 20000 && !found; seed++) { const M = R.create({ seed, layout: [['ga', R.CHUTE.x + 1.25, R.CHUTE.z - 0.05]] }); const r = R.attempt(M, M.prizes[0].x, M.prizes[0].z); if (r.lucky) found = r; }
  assert.ok(found && found.kind === 'win' && R.overHole(found.land.x, found.land.z));
});
t('prizes never end up overlapping, in the chute guard or outside the walls (5000 tries)', () => {
  const M = R.create({ seed: 77 });
  for (let k = 0; k < 5000; k++) { const a = R.choose(M, k % 3 ? 'typical' : 'random'); R.attempt(M, a.x, a.z); assert.ok(!overlaps(M), 'overlap at ' + k); assert.ok(legal(M), 'legal at ' + k); assert.strictEqual(M.prizes.length, R.N_PRIZES); }
});
t('10 stars turn into a free try, which is used before coins', () => {
  const M = R.create({ seed: 5, layout: ONE });
  for (let k = 0; k < R.STARS_FOR_FREE; k++) R.attempt(M, 1.9, 1.2);
  assert.strictEqual(M.stars, 0); assert.strictEqual(M.free, 1);
  assert.strictEqual(R.useTry(M), 'free'); assert.strictEqual(M.free, 0); assert.strictEqual(R.useTry(M), 'paid');
});
t('the hold chance falls with weight and with bad centring', () => {
  const p = { id: 'vit' }, q = { id: 'heovang' };
  assert.ok(R.holdChance(p) > R.holdChance({ id: 'cun' }) && R.holdChance({ id: 'cun' }) > R.holdChance({ id: 'gau' }) && R.holdChance({ id: 'gau' }) > R.holdChance(q));
  assert.ok(R.holdChance(p, 0.5) < R.holdChance(p, 1)); assert.strictEqual(R.holdChance(p, 0), 0);
  // the formula matches what the machine does
  let wins = 0, held = 0; const n = 20000; for (let s = 1; s <= n; s++) { const M = R.create({ seed: s, layout: ONE }); const r = R.attempt(M, 0.6, -0.6); if (r.kind === 'win') { wins++; if (!r.lucky) held++; } }
  assert.ok(Math.abs(held / n - R.holdChance(p)) < 0.015, `held ${held / n} vs ${R.holdChance(p)}`);
  const M0 = R.create({ seed: 1, layout: ONE }); assert.ok(Math.abs(wins / n - R.winChance(M0, M0.prizes[0])) < 0.02, `won ${wins / n} vs ${R.winChance(M0, M0.prizes[0])}`);
});

// ---------------------------------------------------------------- determinism, save / load
t('same seed + same drops → same results', () => {
  const run = () => { const M = R.create({ seed: 91 }), out = []; for (let k = 0; k < 300; k++) { const a = R.choose(M, 'typical'); out.push(R.attempt(M, a.x, a.z).kind); } return JSON.stringify([out, R.save(M)]); };
  assert.strictEqual(run(), run());
});
t('save → load continues exactly the same', () => {
  const A = R.create({ seed: 12 }); for (let k = 0; k < 40; k++) { const a = R.choose(A, 'smart'); R.attempt(A, a.x, a.z); }
  const B = clone(A);
  for (let k = 0; k < 60; k++) { const a = R.choose(A, 'typical'), b = R.choose(B, 'typical'); assert.deepStrictEqual(a, b); assert.strictEqual(JSON.stringify(R.attempt(A, a.x, a.z)), JSON.stringify(R.attempt(B, b.x, b.z))); }
  assert.strictEqual(R.load(null), null); assert.strictEqual(R.load({ v: 1, prizes: [] }), null); assert.strictEqual(R.load({ v: 1, prizes: [[1, 'nope', 0, 0, 0]] }), null);
});

// ---------------------------------------------------------------- economy
// Every simulated try also adds up its expected value (chance to win × payout, from the state right before the drop).
// That sum is a low-noise estimate of the long-run return; the real payouts must agree with it.
const T0 = Date.now(), res = {};
for (const p of ['smart', 'typical', 'sloppy', 'random']) res[p] = [1, 2, 3].map(seed => R.simulate({ tries: 20000, tier: 'hong', player: p, seed }));
const agg = p => { const rs = res[p], sp = rs.reduce((a, r) => a + r.spent, 0), n = rs.reduce((a, r) => a + r.tries, 0), w = rs.reduce((a, r) => a + r.wins, 0);
  return { rtp: rs.reduce((a, r) => a + r.value, 0) / sp, ev: rs.reduce((a, r) => a + r.evRtp * r.spent, 0) / sp, coin: rs.reduce((a, r) => a + r.coins, 0) / sp, win: w / n, free: rs.reduce((a, r) => a + r.free, 0) / n, lucky: rs.reduce((a, r) => a + r.lucky, 0) / Math.max(1, w) }; };
for (const p of ['smart', 'typical', 'sloppy', 'random']) { const a = agg(p); console.log(`  ${p.padEnd(8)} return ${pct(a.ev)} expected, ${pct(a.rtp)} paid (coins only ${pct(a.coin)}) · wins ${pct(a.win)} of tries · free tries ${pct(a.free)} · lucky drops ${pct(a.lucky)} of wins`); }
const vang = R.simulate({ tries: 20000, tier: 'vang', player: 'typical', seed: 4 });
console.log(`  Máy Vàng 20K, typical: ${pct(vang.evRtp)} expected, ${pct(vang.rtp)} paid · ${4 * 60000 + 20000} tries in ${Date.now() - T0} ms`);
t('the best play stays at or below 95% (coins + tickets × 500)', () => { const a = agg('smart'); assert.ok(a.ev <= 0.95 && a.ev >= 0.88 && a.rtp <= 0.97, pct(a.ev) + ' ' + pct(a.rtp)); });
t('a normal player gets back 85–93% in the long run', () => { const a = agg('typical'); assert.ok(a.ev >= 0.85 && a.ev <= 0.93, pct(a.ev)); assert.ok(a.rtp >= 0.82 && a.rtp <= 0.95, pct(a.rtp)); });
t('real payouts agree with the expected value (±4%)', () => { for (const p of ['smart', 'typical', 'sloppy', 'random']) { const a = agg(p); assert.ok(Math.abs(a.rtp - a.ev) < 0.04, p + ' ' + pct(a.rtp) + ' vs ' + pct(a.ev)); } });
t('sloppy aiming and random drops return much less', () => assert.ok(agg('sloppy').ev < agg('typical').ev - 0.1 && agg('random').ev < 0.4));
t('the 20K machine returns the same as the 1K one', () => assert.ok(Math.abs(vang.evRtp - agg('typical').ev) < 0.02, pct(vang.evRtp)));
t('roughly one try in five wins something for a good player', () => assert.ok(agg('smart').win > 0.15 && agg('smart').win < 0.3));

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
