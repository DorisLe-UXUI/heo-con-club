'use strict';
// node tests/tai-xiu.test.js — rules for Tài Xỉu (js/games3d/rules/tai-xiu.js)
const assert = require('assert');
const R = require('../js/games3d/rules/tai-xiu.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.error('FAIL', name, '-', e.message); } }
const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

// ---- basics
t('sum / triple', () => { eq(R.sum([1, 2, 3]), 6); eq(R.isTriple([4, 4, 4]), true); eq(R.isTriple([4, 4, 5]), false); });
t('bad dice throw', () => { assert.throws(() => R.sum([1, 2])); assert.throws(() => R.sum([0, 2, 3])); assert.throws(() => R.sum([7, 2, 3])); assert.throws(() => R.sum([1.5, 2, 3])); assert.throws(() => R.payout('s3', 10, [1, 1, 1])); assert.throws(() => R.payout('tai', -1, [1, 2, 3])); });
t('sum odds exactly as specified', () => {
  eq(R.SUM_ODDS, { 4: 50, 5: 18, 6: 14, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 14, 16: 18, 17: 50 });
  for (let s = 4; s <= 17; s++) eq(R.SUM_ODDS[s], R.SUM_ODDS[21 - s], 'symmetric ' + s);
  eq(R.zone('tai').odds, 1); eq(R.zone('xiu').odds, 1); eq(R.zone('bao').odds, 24); eq(R.ZONES.length, 17);
});

// ---- verdicts
t('verdict labels', () => { eq(R.verdict([6, 5, 3]).label, 'TÀI 14'); eq(R.verdict([1, 2, 4]).label, 'XỈU 7'); eq(R.verdict([2, 2, 2]).label, 'BÃO!'); eq(R.verdict([5, 5, 1]).label, 'TÀI 11'); eq(R.verdict([4, 4, 2]).label, 'XỈU 10'); eq(R.verdict([6, 6, 6]).kind, 'bao'); });

// ---- Tài / Xỉu boundaries and the triple rule
t('Tài wins 11–17 without triple', () => { eq(R.payout('tai', 1000, [5, 5, 1]), 2000); eq(R.payout('tai', 1000, [6, 6, 5]), 2000); eq(R.payout('tai', 1000, [4, 4, 3]), 2000); eq(R.payout('tai', 1000, [4, 3, 3]), 0); eq(R.payout('tai', 1000, [4, 4, 2]), 0); });
t('Xỉu wins 4–10 without triple', () => { eq(R.payout('xiu', 1000, [1, 1, 2]), 2000); eq(R.payout('xiu', 1000, [4, 4, 2]), 2000); eq(R.payout('xiu', 1000, [5, 5, 1]), 0); });
t('both lose on every triple', () => { for (let v = 1; v <= 6; v++) { eq(R.payout('tai', 1000, [v, v, v]), 0, 'tai ' + v); eq(R.payout('xiu', 1000, [v, v, v]), 0, 'xiu ' + v); } });
t('Bão pays 1:24 on every triple only', () => { for (let v = 1; v <= 6; v++) eq(R.payout('bao', 1000, [v, v, v]), 25000); eq(R.payout('bao', 1000, [3, 3, 4]), 0); });
t('every non-triple pays exactly one of Tài/Xỉu', () => { for (const d of R.ALL) eq(R.wins('tai', d) + R.wins('xiu', d) + R.wins('bao', d), 1, d.join()); });

// ---- sum zones: every sum 4..17 pays its odds, triples included
for (let s = 4; s <= 17; s++) t(`sum ${s} pays 1:${R.SUM_ODDS[s]}`, () => {
  const d = R.diceFor(s); eq(R.sum(d), s); eq(R.payout('s' + s, 1000, d), 1000 * (1 + R.SUM_ODDS[s]));
  eq(R.payout('s' + s, 1000, R.diceFor(s === 4 ? 5 : 4)), 0);
});
t('sum zones also win on triples', () => { eq(R.payout('s6', 1000, [2, 2, 2]), 15000); eq(R.payout('s15', 1000, [5, 5, 5]), 15000); eq(R.payout('s9', 1000, [3, 3, 3]), 7000); });
t('sums 3 and 18 only pay Bão', () => { eq(R.settle({ tai: 1, xiu: 1, bao: 1, s4: 1, s17: 1 }, [1, 1, 1]).back, 25); eq(R.settle({ tai: 1, xiu: 1, bao: 1, s4: 1, s17: 1 }, [6, 6, 6]).back, 25); });
t('diceFor', () => { eq(R.diceFor(9, true), [3, 3, 3]); assert.throws(() => R.diceFor(10, true)); assert.throws(() => R.diceFor(2)); assert.throws(() => R.diceFor(3)); for (let s = 4; s <= 17; s++) assert.ok(!R.isTriple(R.diceFor(s))); });

// ---- settle
t('settle example from the rules screen', () => {
  const s = R.settle({ tai: 10000, xiu: 5000, s14: 1000, bao: 1000 }, [6, 5, 3]);
  eq(s, { staked: 17000, back: 20000 + 13000, net: 16000, per: { tai: 20000, xiu: 0, s14: 13000, bao: 0 } });
});
t('settle on a triple', () => { const s = R.settle({ tai: 10000, xiu: 10000, bao: 1000, s9: 1000 }, [3, 3, 3]); eq(s.back, 25000 + 7000); eq(s.net, 32000 - 22000); });
t('settle empty / zero', () => { eq(R.settle({}, [1, 2, 3]), { staked: 0, back: 0, net: 0, per: {} }); eq(R.settle({ tai: 0 }, [1, 2, 3]).staked, 0); });
t('settle rejects unknown zones', () => assert.throws(() => R.settle({ s18: 5 }, [6, 6, 6])));

// ---- exact probabilities: the house keeps an edge on every zone
t('probabilities from 216 outcomes', () => {
  eq(R.ALL.length, 216); eq(R.probability('bao'), 6 / 216); eq(R.probability('tai'), 105 / 216); eq(R.probability('xiu'), 105 / 216);
  eq(R.probability('s4'), 3 / 216); eq(R.probability('s10'), 27 / 216); eq(R.probability('s11'), 27 / 216);
  let tot = 0; for (let s = 4; s <= 17; s++) tot += R.probability('s' + s); eq(Math.round(tot * 216), 214);
});
t('every zone has a house edge', () => { for (const z of R.ZONES) assert.ok(R.expectedReturn(z.id) < 1, z.id + ' ' + R.expectedReturn(z.id)); });
t('roll covers 1..6 evenly', () => { const r = rng(5), c = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < 30000; i++) R.roll(r).forEach(v => c[v]++); for (let v = 1; v <= 6; v++) assert.ok(Math.abs(c[v] - 15000) < 900, v + ':' + c[v]); eq(c[0], 0); });

// ---- road + bots
t('road keeps Bão beads', () => { const h = ['tai', 'xiu', 'bao', 'tai']; eq(R.road(h).cols, [h]); });
t('road scrolls', () => { const h = Array.from({ length: 61 }, (_, i) => (i % 2 ? 'tai' : 'xiu')); const r = R.road(h, 6, 8); eq(r.cols.length, 8); eq(r.cols.flat(), h.slice(r.start)); eq(r.cols[7].length, 1); });
t('bot plans are valid', () => {
  const r = rng(9), chips = [1000, 5000, 10000, 50000];
  for (let i = 0; i < 3000; i++) {
    const style = ['careful', 'trend', 'wild'][i % 3], hist = Array.from({ length: i % 15 }, () => ['tai', 'xiu', 'bao'][Math.floor(r() * 3)]);
    const plan = R.botPlan(r, style, hist, chips, i % 5 ? Infinity : 7000);
    let sum = 0; for (const b of plan) { assert.ok(R.zone(b.zone)); assert.ok(chips.includes(b.amount)); sum += b.amount; }
    if (i % 5) assert.ok(plan.length >= 1); else assert.ok(sum <= 7000);
  }
});
t('trend bot follows a streak (ignoring Bão)', () => { eq(R.botPlan(() => .9, 'trend', ['xiu', 'tai', 'bao', 'tai'])[0].zone, 'tai'); });

// ---- many random rounds
t('100k random rounds: payouts are whole stakes and the books balance', () => {
  const r = rng(21); let wallet = 0;
  for (let i = 0; i < 100000; i++) {
    const bets = {}; for (const z of R.ZONES) if (r() < .25) bets[z.id] = 1000;
    const d = R.roll(r), s = R.settle(bets, d);
    for (const [id, b] of Object.entries(s.per)) { const won = R.wins(id, d); assert.strictEqual(b, won ? 1000 * (1 + R.zone(id).odds) : 0); }
    wallet += s.net;
  }
  assert.ok(Number.isInteger(wallet));
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
