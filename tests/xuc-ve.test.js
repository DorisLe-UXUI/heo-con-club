'use strict';
/* node tests/xuc-ve.test.js — Máy Xúc Vé: bin + scoop timing, shelf physics, save/load, long-run economy */
const assert = require('assert');
const R = require('../js/games3d/rules/xuc-ve.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); } }
const pct = x => (x * 100).toFixed(1) + '%';
const pileOf = arr => ({ s: 99, pile: arr.slice(), scoops: 0 });

// ---------------------------------------------------------------- tables
t('roll values are 10K 20K 50K 100K 200K 500K', () => assert.deepStrictEqual(R.ROLLS.map(r => r.value), [10000, 20000, 50000, 100000, 200000, 500000]));
t('rarer rolls are worth more, the golden 500K is the rarest', () => {
  for (let i = 1; i < R.ROLLS.length; i++) assert.ok(R.ROLLS[i].w < R.ROLLS[i - 1].w && R.ROLLS[i].value > R.ROLLS[i - 1].value);
  assert.ok(R.BY_ID.r500.gold && R.BY_ID.r500.w / R.W_TOTAL <= 0.005);
});
t('every scoop size costs the same per roll of capacity', () => { for (const tr of R.TIERS) assert.strictEqual(tr.price, tr.cap * R.PER_ROLL); assert.ok(R.TIERS[0].price < R.TIERS[1].price && R.TIERS[1].price < R.TIERS[2].price); });
t('roll table draws match the weights (200k draws)', () => {
  const M = pileOf(new Array(R.SLOTS).fill(0)), n = 200000, c = {};
  for (let i = 0; i < n; i++) { const k = R.drawKind(M); c[k] = (c[k] || 0) + 1; }
  for (const r of R.ROLLS) { const want = r.w / R.W_TOTAL, got = (c[r.id] || 0) / n; assert.ok(Math.abs(got - want) < Math.max(0.004, want * 0.15), `${r.id}: ${got} vs ${want}`); }
});

// ---------------------------------------------------------------- arm + timing quality
t('the arm swings inside ±ARC and repeats every SWING seconds', () => {
  for (let k = 0; k <= 200; k++) { const th = R.armAngle(k * 0.037); assert.ok(Math.abs(th) <= R.ARC + 1e-9); }
  assert.ok(Math.abs(R.armAngle(0.7) - R.armAngle(0.7 + R.SWING)) < 1e-9);
  assert.ok(Math.abs(R.armAngle(R.SWING / 4) - R.ARC) < 1e-9 && Math.abs(R.armAngle(3 * R.SWING / 4) + R.ARC) < 1e-9);
});
t('fill: 0 → 0, 1 → 1, rises with timing quality', () => {
  assert.strictEqual(R.fill(0), 0); assert.strictEqual(R.fill(1), 1); assert.strictEqual(R.fill(2), 1); assert.strictEqual(R.fill(-1), 0);
  for (let q = 0; q < 1; q += 0.05) assert.ok(R.fill(q + 0.05) > R.fill(q));
});
t('quality is 1 over a tall heap, 0 over an empty part of the bin', () => {
  const pile = new Array(R.SLOTS).fill(0); pile[4] = 6; pile[5] = 6; pile[6] = 6;
  assert.strictEqual(R.quality(pile, R.slotAngle(5)), 1);
  assert.strictEqual(R.quality(pile, R.slotAngle(15)), 0);
  assert.ok(R.quality(pile, R.slotAngle(7)) > 0 && R.quality(pile, R.slotAngle(7)) < 1);
  assert.ok(Math.abs(R.bestAngle(pile) - R.slotAngle(5)) < R.SLOT_W * 0.6);
});

// ---------------------------------------------------------------- scoop
t('a perfect scoop over a tall heap fills the scoop', () => {
  for (const tr of R.TIERS) {
    const pile = new Array(R.SLOTS).fill(0); for (let i = 3; i <= 8; i++) pile[i] = 8;
    const M = pileOf(pile), before = R.pileTotal(M), r = R.scoop(M, R.slotAngle(5.5 | 0), tr.id);
    assert.strictEqual(r.n, tr.cap, tr.id); assert.strictEqual(r.kinds.length, r.n); assert.strictEqual(R.pileTotal(M), before - r.n);
    assert.ok(r.kinds.every(k => R.BY_ID[k]));
  }
});
t('scooping empty air takes nothing', () => {
  const pile = new Array(R.SLOTS).fill(0); pile[0] = 5; pile[1] = 5;
  const M = pileOf(pile), r = R.scoop(M, R.slotAngle(14), 'to');
  assert.strictEqual(r.n, 0); assert.strictEqual(R.pileTotal(M), 10);
});
t('a scoop never takes more than its size, nor rolls that are not under it', () => {
  const M = R.create({ seed: 3, empty: true });
  for (let k = 0; k < 3000; k++) {
    const tier = R.TIERS[k % 3], th = R.armAngle(k * 0.173), before = M.pile.slice(), r = R.scoop(M, th, tier.id);
    assert.ok(r.n >= 0 && r.n <= tier.cap);
    for (const i of r.took) assert.ok(Math.abs(R.slotAngle(i) - th) < R.MOUTH * R.SLOT_W + 1e-9, 'took from under the mouth');
    for (let i = 0; i < R.SLOTS; i++) assert.ok(M.pile[i] >= 0 && M.pile[i] <= before[i]);
    R.refill(M);
    assert.ok(R.pileTotal(M) <= R.PILE_N && R.pileTotal(M) > R.PILE_N - R.BATCH);
  }
});
t('the hopper drops a batch at one spot (a new heap)', () => {
  const M = pileOf(new Array(R.SLOTS).fill(2)); M.pile[0] = 0;
  const h = R.hopper(M, R.BATCH); assert.strictEqual(h.slots.length, R.BATCH);
  const span = Math.max(...h.slots) - Math.min(...h.slots); assert.ok(span <= 7, 'spread ' + span);
});
t('better timing → more rolls (bin only, 20k scoops each)', () => {
  const f = p => R.binStats({ tier: 'vua', player: p, scoops: 20000, seed: 4 }).fillRate;
  const perfect = f('perfect'), typical = f('typical'), sloppy = f('sloppy'), random = f('random');
  assert.ok(perfect > typical && typical > sloppy && sloppy > random, [perfect, typical, sloppy, random].join(' '));
  assert.ok(perfect > 0.97 && random < 0.65);
});

// ---------------------------------------------------------------- shelf physics
const live = s => s.items.filter(i => i.state === 'field' || i.state === 'shelf' || i.state === 'drop');
function maxPen(s) { const f = s.items.filter(i => i.state === 'field'); let m = 0; for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) m = Math.max(m, f[a].r + f[b].r - Math.hypot(f[a].x - f[b].x, f[a].z - f[b].z)); return m; }
t('a new machine has a settled layer of rolls on the shelf and a full bin', () => {
  const M = R.create({ seed: 8 }); assert.ok(live(M.shelf).length >= 22, 'rolls ' + live(M.shelf).length); assert.ok(maxPen(M.shelf) < 0.12, 'overlap ' + maxPen(M.shelf)); assert.strictEqual(R.pileTotal(M), R.PILE_N);
});
t('rolls are conserved: on the shelf + paid + back to the bin = dropped + start', () => {
  const M = R.create({ seed: 9, H: 1 / 30 }), start = live(M.shelf).length; let dropped = 0, won = 0, lost = 0;
  for (let k = 0; k < 120; k++) {
    const r = R.scoop(M, R.bestAngle(M.pile), 'vua'); R.dumpX(M, r.n).forEach((x, i) => M.shelf.drop(x, r.kinds[i])); dropped += r.n; R.refill(M);
    M.shelf.step(3); for (const e of M.shelf.takeEvents()) { if (e.type === 'win') won++; else if (e.type === 'lost') lost++; }
  }
  assert.strictEqual(start + dropped, live(M.shelf).length + won + lost);
  assert.ok(won > 0 && lost > 0);
  assert.ok(maxPen(M.shelf) < 0.2, 'overlap ' + maxPen(M.shelf));
  assert.ok(M.shelf.items.every(i => i.state === 'fall' || i.state === 'gone' || (Math.abs(i.x) <= M.shelf.W - i.r + 1e-6 && i.z >= 0)), 'inside the walls');
});
t('win events pay the printed value; gutter events pay nothing', () => {
  const s = new R.Shelf({ seed: 2 });
  s.add('r200', 0, s.FRONT + 0.1); s.add('r50', s.W - 0.45, s.FRONT + 0.1);
  for (let i = 0; i < 6; i++) s.add('r10', (i - 2.5) * 0.9, s.FRONT - 1.0);
  for (let i = 0; i < 10; i++) s.drop((i % 5 - 2) * 1.2, 'r10', 0.2);
  let ev = []; for (let i = 0; i < 600; i++) { s.step(1 / 60); ev = ev.concat(s.takeEvents()); }
  const w = ev.filter(e => e.type === 'win'), l = ev.filter(e => e.type === 'lost');
  assert.ok(w.every(e => e.value === R.BY_ID[e.kind].value && Math.abs(e.x) < s.W - s.GUTTER));
  assert.ok(l.every(e => e.value === 0 && Math.abs(e.x) >= s.W - s.GUTTER));
  assert.ok(w.some(e => e.kind === 'r200' && e.value === 200000), 'the 200K roll in the middle of the edge pays'); assert.ok(l.some(e => e.kind === 'r50'), 'the 50K roll at the corner slides back');
});
t('a roll tipped while the pusher is forward lands on the pusher top, else in front of it', () => {
  const s = new R.Shelf({ seed: 5 });
  while (s.pusherZ(s.t) < s.PZ_MAX - 0.02) s.step(1 / 120); s.takeEvents();
  s.drop(0, 'r10', 0.4); let e = null; for (let i = 0; i < 60 && !e; i++) { s.step(1 / 60); e = s.takeEvents().find(x => x.type === 'land'); }
  assert.ok(e && e.shelf);
  while (s.pusherZ(s.t) > s.PZ_MIN + 0.02) s.step(1 / 120); s.takeEvents();
  s.drop(0, 'r10', 0.4); e = null; for (let i = 0; i < 60 && !e; i++) { s.step(1 / 60); e = s.takeEvents().find(x => x.type === 'land'); }
  assert.ok(e && !e.shelf);
});

// ---------------------------------------------------------------- determinism, save / load
t('same seed + same presses → same machine', () => {
  const run = () => { const M = R.create({ seed: 21 }); const out = []; for (let k = 0; k < 40; k++) { const r = R.scoop(M, R.armAngle(k * 0.41), 'nho'); R.dumpX(M, r.n).forEach((x, i) => M.shelf.drop(x, r.kinds[i])); R.refill(M); M.shelf.step(2); out.push(r.n + r.kinds.join(), M.shelf.takeEvents().length); } return JSON.stringify([out, R.save(M)]); };
  assert.strictEqual(run(), run());
});
t('save → load keeps the bin, the random stream and every roll on the shelf', () => {
  const M = R.create({ seed: 31 }); for (let k = 0; k < 15; k++) { const r = R.scoop(M, R.bestAngle(M.pile), 'vua'); R.dumpX(M, r.n).forEach((x, i) => M.shelf.drop(x, r.kinds[i])); R.refill(M); M.shelf.step(2.5); }
  const snap = JSON.parse(JSON.stringify(R.save(M))), B = R.load(snap);
  assert.deepStrictEqual(B.pile, M.pile); assert.strictEqual(B.s, M.s); assert.strictEqual(live(B.shelf).length, live(M.shelf).length);
  assert.strictEqual(R.shelfValue(B), R.shelfValue(M));
  const a = R.scoop(M, 0.3, 'to'), b = R.scoop(B, 0.3, 'to'); assert.deepStrictEqual(a.kinds, b.kinds);
  assert.strictEqual(R.load(null), null); assert.strictEqual(R.load({ v: 1, pile: [1, 2] }), null);
});

// ---------------------------------------------------------------- economy (the long run)
// The return splits into: rolls scooped per coin (bin + timing, cheap to simulate a lot) × share of rolls that reach the
// paying middle of the front edge (shelf physics) × average printed value. Both parts are measured, then one full
// simulation with real printed values checks the product.
const T0 = Date.now();
const fills = {};
for (const tier of ['nho', 'vua', 'to']) for (const p of ['perfect', 'typical', 'sloppy', 'random']) fills[tier + p] = R.binStats({ tier, player: p, scoops: 30000, seed: 11 }).fillRate;
const phys = [1, 2].map(seed => R.simulate({ scoops: 450, warm: 80, tier: 'vua', player: 'typical', seed, H: 1 / 24 }));
const won = phys.reduce((a, r) => a + r.won, 0), lost = phys.reduce((a, r) => a + r.lost, 0), front = won / (won + lost);
const rtp = (tier, p) => fills[tier + p] * R.TIER[tier].cap * front * R.AVG_VALUE / R.TIER[tier].price;
const actual = phys.reduce((a, r) => a + r.paid, 0) / phys.reduce((a, r) => a + r.spent, 0);
console.log(`  front share ${pct(front)} · avg roll ${Math.round(R.AVG_VALUE)} xu · ${phys.reduce((a, r) => a + r.scoops, 0)} full scoops in ${Date.now() - T0} ms`);
for (const tier of ['nho', 'vua', 'to']) console.log(`  ${R.TIER[tier].name} ${R.TIER[tier].price / 1000}K: perfect ${pct(rtp(tier, 'perfect'))} · typical ${pct(rtp(tier, 'typical'))} · sloppy ${pct(rtp(tier, 'sloppy'))} · random ${pct(rtp(tier, 'random'))}`);
console.log(`  full simulation (typical, Muỗng Vừa, real printed values): ${pct(actual)} · gold rolls paid: ${phys.reduce((a, r) => a + r.gold, 0)}`);
t('most rolls that leave the shelf pay (front share 62–78%)', () => assert.ok(front > 0.62 && front < 0.78, pct(front)));
t('long-run return with perfect timing stays at or below ~95%', () => { for (const tier of ['nho', 'vua', 'to']) assert.ok(rtp(tier, 'perfect') <= 0.965 && rtp(tier, 'perfect') >= 0.88, tier + ' ' + pct(rtp(tier, 'perfect'))); });
t('a normal player gets back 84–93% in the long run', () => { for (const tier of ['nho', 'vua', 'to']) assert.ok(rtp(tier, 'typical') >= 0.84 && rtp(tier, 'typical') <= 0.93, tier + ' ' + pct(rtp(tier, 'typical'))); });
t('pressing blindly returns far less (timing matters)', () => { for (const tier of ['nho', 'vua', 'to']) assert.ok(rtp(tier, 'random') < 0.7 && rtp(tier, 'sloppy') < rtp(tier, 'typical'), tier); });
t('all scoop sizes return about the same', () => { const v = ['nho', 'vua', 'to'].map(x => rtp(x, 'typical')); assert.ok(Math.max(...v) - Math.min(...v) < 0.04, v.map(pct).join(' ')); });
t('the full simulation with real printed values agrees (75–102%, rare rolls make it noisy)', () => assert.ok(actual > 0.75 && actual < 1.02, pct(actual)));

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
