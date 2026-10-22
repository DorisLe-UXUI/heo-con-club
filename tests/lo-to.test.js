'use strict';
// node tests/lo-to.test.js — rules for Lô Tô (js/games3d/rules/lo-to.js)
const assert = require('assert');
const R = require('../js/games3d/rules/lo-to.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.error('FAIL', name, '-', e.message); } }
const eq = (a, b, m) => assert.deepStrictEqual(a, b, m);

// ---- columns
t('column of each number', () => { eq(R.colOf(1), 0); eq(R.colOf(9), 0); eq(R.colOf(10), 1); eq(R.colOf(19), 1); eq(R.colOf(79), 7); eq(R.colOf(80), 8); eq(R.colOf(90), 8); assert.throws(() => R.colOf(0)); assert.throws(() => R.colOf(91)); assert.throws(() => R.colOf(2.5)); });
t('column ranges cover 1..90 once', () => { const all = []; R.COLS.forEach(([a, b]) => { for (let n = a; n <= b; n++) all.push(n); }); eq(all.length, 90); eq(new Set(all).size, 90); eq(Math.min(...all), 1); eq(Math.max(...all), 90); });

// ---- the generator: 10,000 tickets, every rule checked independently of validateTicket
t('10,000 generated tickets are all valid', () => {
  const rng = R.rngFrom(12345), colCounts = new Map(), numHits = new Array(91).fill(0);
  for (let i = 0; i < 10000; i++) {
    const tk = R.makeTicket(rng);
    const errs = R.validateTicket(tk); if (errs.length) throw new Error(`ticket ${i}: ${errs.join(', ')}`);
    // independent re-check
    assert.strictEqual(tk.rows.length, 3);
    for (const row of tk.rows) { assert.strictEqual(row.length, 9); assert.strictEqual(row.filter(x => x != null).length, 5); }
    const nums = tk.rows.flat().filter(x => x != null);
    assert.strictEqual(nums.length, 15); assert.strictEqual(new Set(nums).size, 15);
    eq(tk.nums, nums.slice().sort((a, b) => a - b));
    for (let c = 0; c < 9; c++) {
      const col = tk.rows.map(r => r[c]).filter(x => x != null), [lo, hi] = R.COLS[c];
      assert.ok(col.length >= 1 && col.length <= 3, 'column count');
      col.forEach((n, k) => { assert.ok(n >= lo && n <= hi, `${n} outside ${lo}-${hi}`); if (k) assert.ok(n > col[k - 1], 'sorted'); });
    }
    const key = tk.rows.map(r => r.map(x => (x == null ? 0 : 1)).join('')).join('|'); colCounts.set(key, (colCounts.get(key) || 0) + 1);
    nums.forEach(n => numHits[n]++);
  }
  assert.ok(colCounts.size > 300, 'layouts vary: ' + colCounts.size);
  for (let n = 1; n <= 90; n++) assert.ok(numHits[n] > 800, `number ${n} appears (${numHits[n]})`);
});
t('Math.random tickets are valid too', () => { for (let i = 0; i < 2000; i++) eq(R.validateTicket(R.makeTicket()), []); });
t('seeded generator replays', () => { eq(R.makeTicket(R.rngFrom(9)), R.makeTicket(R.rngFrom(9))); assert.notDeepStrictEqual(R.makeTicket(R.rngFrom(9)), R.makeTicket(R.rngFrom(10))); });

// ---- validateTicket catches broken tickets
const good = () => ({ rows: [[1, null, 20, null, 40, null, 60, null, 80], [null, 10, null, 30, null, 50, null, 70, 85], [5, 15, 25, 35, 45, null, null, null, null]] });
t('hand-made ticket is valid', () => eq(R.validateTicket(good()), []));
t('rejects 4 numbers in a row', () => { const k = good(); k.rows[0][0] = null; assert.ok(R.validateTicket(k).length); });
t('rejects a number in the wrong column', () => { const k = good(); k.rows[0][2] = 31; assert.ok(R.validateTicket(k).some(e => /column/.test(e))); });
t('rejects unsorted columns', () => { const k = good(); k.rows[0][0] = 6; assert.ok(R.validateTicket(k).some(e => /sorted/.test(e))); });
t('rejects duplicates', () => { const k = good(); k.rows[2][0] = 1; assert.ok(R.validateTicket(k).length); });
t('rejects an empty column', () => { const k = { rows: [[1, 10, 20, 30, 40, null, null, null, null], [2, 11, 21, 31, 41, null, null, null, null], [3, 12, 22, 32, 42, null, null, null, null]] }; assert.ok(R.validateTicket(k).some(e => /empty/.test(e))); });
t('rejects garbage', () => { assert.ok(R.validateTicket(null).length); assert.ok(R.validateTicket({ rows: [[1]] }).length); const k = good(); k.rows[1][8] = 91; assert.ok(R.validateTicket(k).length); });
t('90 lives in the last column', () => { const k = good(); k.rows[1][8] = 90; eq(R.validateTicket(k), []); });

// ---- marking, waiting, KINH
t('missing / waiting / complete rows', () => {
  const k = good(), m = new Set([1, 20, 40, 60, 10, 30]);
  eq(R.missing(k, m), [1, 3, 5]); eq(R.waiting(k, m), 1); eq(R.completeRows(k, m), []);
  m.add(80); eq(R.completeRows(k, m), [0]); eq(R.waiting(k, m), 0);
  eq(R.missing(k, [5, 15]), [5, 5, 3]);
});
t('KINH needs a fully marked row', () => { const k = good(), drawn = new Set([1, 20, 40, 60, 80, 99]); eq(R.canKinh(k, new Set([1, 20, 40, 60]), drawn).ok, false); const ok = R.canKinh(k, new Set([1, 20, 40, 60, 80]), drawn); eq(ok, { ok: true, row: 0, nums: [1, 20, 40, 60, 80] }); });
t('KINH rejects marks that were never drawn', () => { const k = good(); eq(R.canKinh(k, new Set([1, 20, 40, 60, 80]), new Set([1, 20, 40, 60])).ok, false); });
t('KINH on the second or third row', () => { const k = good(); eq(R.canKinh(k, [5, 15, 25, 35, 45], [5, 15, 25, 35, 45]).row, 2); eq(R.canKinh(k, [10, 30, 50, 70, 85], [10, 30, 50, 70, 85, 3]).row, 1); });
t('extra marks never hurt', () => { const k = good(); const all = Array.from({ length: 90 }, (_, i) => i + 1); eq(R.canKinh(k, all, all).ok, true); eq(R.completeRows(k, all), [0, 1, 2]); });
t('drawsToWin', () => {
  const k = good(); eq(R.drawsToWin(k, [1, 20, 40, 60, 80]), 5); eq(R.drawsToWin(k, [2, 3, 1, 20, 40, 60, 80]), 7); eq(R.drawsToWin(k, [2, 3]), Infinity);
  const rng = R.rngFrom(4); for (let i = 0; i < 2000; i++) { const tk = R.makeTicket(rng), o = R.drawOrder(rng), d = R.drawsToWin(tk, o); assert.ok(d >= 5 && d <= 90); eq(R.completeRows(tk, o.slice(0, d)).length > 0, true); eq(R.completeRows(tk, o.slice(0, d - 1)).length, 0); }
});
t('draw order is a permutation of 1..90', () => { const o = R.drawOrder(R.rngFrom(1)); eq(o.length, 90); eq(o.slice().sort((a, b) => a - b), Array.from({ length: 90 }, (_, i) => i + 1)); });

// ---- simulated 4-player games: someone always wins, winners = players complete at the deciding draw
t('2,000 simulated games', () => {
  const rng = R.rngFrom(77); let total = 0;
  for (let g = 0; g < 2000; g++) {
    const tks = [0, 1, 2, 3].map(() => R.makeTicket(rng)), order = R.drawOrder(rng), d = tks.map(tk => R.drawsToWin(tk, order)), first = Math.min(...d);
    assert.ok(first >= 5 && first < 90); const winners = d.filter(x => x === first).length; assert.ok(winners >= 1);
    const drawn = new Set(order.slice(0, first)); tks.forEach((tk, i) => eq(R.canKinh(tk, drawn, drawn).ok, d[i] === first));
    total += first;
  }
  const avg = total / 2000; assert.ok(avg > 40 && avg < 60, 'average game length ' + avg);   // ~51 draws with 4 tickets
});

// ---- pot split
t('prize: one winner gets 90%', () => eq(R.prize(10000, 4, 1), { pot: 40000, total: 36000, share: 36000, house: 4000 }));
t('prize: split between two', () => eq(R.prize(10000, 4, 2), { pot: 40000, total: 36000, share: 18000, house: 4000 }));
t('prize: odd split rounds down to the house', () => { const p = R.prize(1000, 4, 3); eq(p, { pot: 4000, total: 3600, share: 1200, house: 400 }); eq(R.prize(5000, 4, 3).share * 3 + R.prize(5000, 4, 3).house, 20000); const q = R.prize(7000, 4, 3); eq(q.share, 8400); eq(q.house, 28000 - 8400 * 3); });
t('prize is integer for all prices', () => { for (const p of [1000, 5000, 10000, 50000, 100000, 333, 1]) for (let w = 1; w <= 4; w++) { const r = R.prize(p, 4, w); assert.ok(Number.isInteger(r.share) && Number.isInteger(r.house) && r.house >= 0); eq(r.share * w + r.house, p * 4); } });
t('prize rejects bad input', () => { assert.throws(() => R.prize(-1, 4, 1)); assert.throws(() => R.prize(1.5, 4, 1)); assert.throws(() => R.prize(10, 0, 1)); });

// ---- the caller
t('number words', () => {
  eq(R.words(1), 'một'); eq(R.words(5), 'năm'); eq(R.words(10), 'mười'); eq(R.words(11), 'mười một'); eq(R.words(14), 'mười bốn'); eq(R.words(15), 'mười lăm');
  eq(R.words(20), 'hai mươi'); eq(R.words(21), 'hai mươi mốt'); eq(R.words(24), 'hai mươi tư'); eq(R.words(25), 'hai mươi lăm'); eq(R.words(55), 'năm mươi lăm'); eq(R.words(90), 'chín mươi'); eq(R.words(87), 'tám mươi bảy');
});
t('every number has a call phrase', () => { const rng = R.rngFrom(2); for (let n = 1; n <= 90; n++) for (let k = 0; k < 5; k++) { const p = R.callPhrase(n, rng); assert.ok(p.length > 5 && p.length < 60, p); assert.ok(p.toLowerCase().includes(R.words(n)), p); } });

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
