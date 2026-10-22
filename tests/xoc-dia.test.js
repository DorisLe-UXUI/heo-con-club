'use strict';
// node tests/xoc-dia.test.js — rules for Xóc Đĩa (js/games3d/rules/xoc-dia.js)
const assert = require('assert');
const R = require('../js/games3d/rules/xoc-dia.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.error('FAIL', name, '-', e.message); } }
const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);
const C = n => R.coinsFor(n);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

// ---- counting and parity
t('reds counts red faces', () => { eq(R.reds([true, false, true, false]), 2); eq(R.reds([true, true, true, true]), 4); eq(R.reds([false, false, false, false]), 0); eq(R.reds(3), 3); });
t('coinsFor builds a layout', () => { for (let k = 0; k <= 4; k++) eq(R.reds(C(k)), k); });
t('parity: 0/2/4 red is Chẵn, 1/3 is Lẻ', () => { eq([0, 1, 2, 3, 4].map(k => R.parity(C(k))), ['chan', 'le', 'chan', 'le', 'chan']); });
t('describe', () => { eq(R.describe(C(4)), '4 Đỏ'); eq(R.describe(C(0)), '4 Trắng'); eq(R.describe(C(3)), '3 Đỏ 1 Trắng'); eq(R.describe(C(1)), '1 Đỏ 3 Trắng'); eq(R.describe(C(2)), '2 Đỏ 2 Trắng'); });
t('bad inputs throw', () => { assert.throws(() => R.reds([true])); assert.throws(() => R.reds(5)); assert.throws(() => R.payout('nope', 10, C(1))); assert.throws(() => R.payout('chan', -5, C(2))); assert.throws(() => R.payout('chan', 1.5, C(2))); });

// ---- the full payout table: zone × red count → coins back for a 1000 stake
const TABLE = {
  //        0 red   1 red  2 red  3 red  4 red
  chan: [2000, 0, 2000, 0, 2000],
  le: [0, 2000, 0, 2000, 0],
  r4: [0, 0, 0, 0, 13000],
  w4: [13000, 0, 0, 0, 0],
  r3: [0, 0, 0, 4000, 0],
  w3: [0, 4000, 0, 0, 0],
};
for (const [z, row] of Object.entries(TABLE)) for (let k = 0; k <= 4; k++) t(`payout ${z} @${k} red`, () => eq(R.payout(z, 1000, C(k)), row[k]));
t('odds as specified', () => { eq(R.ZONES.map(z => [z.id, z.odds]), [['chan', 1], ['le', 1], ['r4', 12], ['w4', 12], ['r3', 3], ['w3', 3]]); });
t('every result pays exactly one of Chẵn/Lẻ', () => { for (let k = 0; k <= 4; k++) eq(R.wins('chan', C(k)) + R.wins('le', C(k)), 1); });
t('exactly one colour-count zone wins on 0/1/3/4 reds, none on 2', () => { for (let k = 0; k <= 4; k++) eq(['r4', 'w4', 'r3', 'w3'].filter(z => R.wins(z, C(k))).length, k === 2 ? 0 : 1); });

// ---- settle
t('settle mixes wins and losses', () => {
  const s = R.settle({ chan: 10000, le: 5000, r4: 1000, w3: 2000 }, C(4));
  eq(s, { staked: 18000, back: 20000 + 13000, net: 15000, per: { chan: 20000, le: 0, r4: 13000, w3: 0 } });
});
t('settle 3 red', () => { const s = R.settle({ le: 10000, r3: 5000, w3: 5000, w4: 1000 }, C(3)); eq(s.back, 20000 + 20000); eq(s.staked, 21000); eq(s.net, 19000); });
t('settle ignores zero stakes and empty bets', () => { eq(R.settle({}, C(2)), { staked: 0, back: 0, net: 0, per: {} }); eq(R.settle({ chan: 0 }, C(2)).staked, 0); eq(R.settle(null, C(2)).back, 0); });
t('settle rejects unknown zones', () => assert.throws(() => R.settle({ banana: 5 }, C(2))));

// ---- probabilities (fair coins): Chẵn/Lẻ are even money, no zone pays more than it takes in the long run
t('probabilities', () => { eq(R.probability('chan'), .5); eq(R.probability('le'), .5); eq(R.probability('r4'), 1 / 16); eq(R.probability('r3'), 4 / 16); });
t('expected returns ≤ 1', () => { for (const z of R.ZONES) assert.ok(R.expectedReturn(z.id) <= 1 + 1e-12, z.id); eq(R.expectedReturn('r4'), 13 / 16); });
t('toss is fair-ish over 40k shakes', () => {
  const r = rng(7), cnt = [0, 0, 0, 0, 0]; for (let i = 0; i < 40000; i++) cnt[R.reds(R.toss(r))]++;
  const exp = [1, 4, 6, 4, 1].map(c => c / 16 * 40000); cnt.forEach((c, k) => assert.ok(Math.abs(c - exp[k]) < exp[k] * .08 + 60, `k=${k} ${c} vs ${exp[k]}`));
});

// ---- bead road
t('road fills columns of 6', () => { const h = 'cllcclccl'.split('').map(x => (x === 'c' ? 'chan' : 'le')); const r = R.road(h); eq(r.start, 0); eq(r.cols.length, 2); eq(r.cols[0].length, 6); eq(r.cols[1].length, 3); });
t('road scrolls whole columns', () => { const h = Array.from({ length: 50 }, (_, i) => (i % 3 ? 'chan' : 'le')); const r = R.road(h, 6, 8); eq(r.start, 6); eq(r.cols.length, 8); eq(r.cols.flat().length, 44); eq(r.cols[7].length, 2); eq(r.cols.flat(), h.slice(6)); });
t('road exactly full', () => { const h = Array(48).fill('le'); const r = R.road(h, 6, 8); eq(r.start, 0); eq(r.cols.length, 8); eq(R.road(Array(49).fill('le')).start, 6); eq(R.road([]).cols, []); });
t('streak', () => { eq(R.streak(['chan', 'le', 'le', 'le']), { side: 'le', len: 3 }); eq(R.streak([]), { side: null, len: 0 }); });

// ---- bots
t('bot plans are valid for every style', () => {
  const r = rng(3), chips = [1000, 5000, 10000, 50000];
  for (let i = 0; i < 3000; i++) {
    const style = ['careful', 'trend', 'wild'][i % 3], hist = Array.from({ length: i % 20 }, () => (r() < .5 ? 'chan' : 'le'));
    const plan = R.botPlan(r, style, hist, chips, i % 7 ? Infinity : 6000);
    assert.ok(plan.length >= (i % 7 ? 1 : 0));
    let sum = 0; for (const b of plan) { assert.ok(R.ZONES.some(z => z.id === b.zone)); assert.ok(chips.includes(b.amount)); sum += b.amount; }
    if (!(i % 7)) assert.ok(sum <= 6000);
  }
});
t('trend bot rides a streak', () => { const p = R.botPlan(() => .9, 'trend', ['le', 'chan', 'chan', 'chan']); eq(p[0].zone, 'chan'); });
t('trend bot plays the zigzag after a single result', () => { const p = R.botPlan(() => .9, 'trend', ['chan', 'le']); eq(p[0].zone, 'chan'); });

// ---- many random rounds: wallet accounting never drifts
t('100k random rounds keep the books balanced', () => {
  const r = rng(11); let wallet = 1e9, house = 0;
  for (let i = 0; i < 100000; i++) {
    const bets = {}; for (const z of R.ZONES) if (r() < .4) bets[z.id] = [1000, 5000, 10000][Math.floor(r() * 3)];
    const coins = R.toss(r), s = R.settle(bets, coins);
    assert.ok(s.back >= 0 && s.back % 1000 === 0); assert.strictEqual(s.net, s.back - s.staked);
    wallet += s.net; house -= s.net;
  }
  assert.strictEqual(wallet + house, 1e9);
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
