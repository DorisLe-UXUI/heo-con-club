'use strict';
// node tests/mau-binh.test.js — Mậu Binh hand ranking, arrangement validity, settlement and thousands of bot deals.
const assert = require('assert');
const R = require('../js/games3d/rules/mau-binh.js');
let passed = 0, failed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n ', e.stack.split('\n').slice(0, 3).join('\n  ')); } }
const C = tok => { const m = tok.match(/^(10|[2-9JQKA])([scdh])$/); if (!m) throw new Error('bad card ' + tok); return R.RANKS.indexOf(m[1]) * 4 + 'scdh'.indexOf(m[2]); };
const ids = s => s.trim().split(/\s+/).map(C);
const E = s => R.evaluate(ids(s));
const gt = (a, b) => assert.ok(E(a).score > E(b).score, `${a} should beat ${b}`);
const eq = (a, b) => assert.strictEqual(E(a).score, E(b).score, `${a} should tie ${b}`);

// ---------------------------------------------------------------- categories
const cats = [
  ['9h 10h Jh Qh Kh', 'Thùng phá sảnh'], ['Ah 2h 3h 4h 5h', 'Thùng phá sảnh'], ['7s 7h 7d 7c 2h', 'Tứ quý'], ['7s 7h 7d 2c 2h', 'Cù lũ'],
  ['2h 7h 9h Jh Kh', 'Thùng'], ['5s 6h 7d 8c 9h', 'Sảnh'], ['As 2h 3d 4c 5h', 'Sảnh'], ['10s Jh Qd Kc Ah', 'Sảnh'], ['7s 7h 7d 2c 9h', 'Sám cô'],
  ['7s 7h 2d 2c 9h', 'Thú'], ['7s 7h 3d 2c 9h', 'Đôi'], ['Ks 7h 3d 2c 9h', 'Mậu thầu'], ['Ks Kh Kd', 'Sám cô'], ['Ks Kh 2d', 'Đôi'], ['Ks Qh 2d', 'Mậu thầu'],
  ['Qs Kh Ah', 'Mậu thầu'], ['2h 3h 4h', 'Mậu thầu'],
];
for (const [h, name] of cats) t('category ' + h, () => assert.strictEqual(E(h).name, name));
t('J-Q-K-A-2 is not a straight', () => assert.strictEqual(E('Js Qh Kd Ac 2h').name, 'Mậu thầu'));

// ---------------------------------------------------------------- ordering
t('category order', () => {
  const order = ['9h 10h Jh Qh Kh', '7s 7h 7d 7c 2h', '7s 7h 7d 2c 2h', '2h 7h 9h Jh Kh', '5s 6h 7d 8c 9h', '7s 7h 7d 2c 9h', '7s 7h 2d 2c 9h', '7s 7h 3d 2c 9h', 'Ks 7h 3d 2c 9h'];
  for (let i = 0; i + 1 < order.length; i++) gt(order[i], order[i + 1]);
});
t('A-2-3-4-5 is the lowest straight', () => { gt('2s 3h 4d 5c 6h', 'As 2h 3d 4c 5h'); gt('10s Jh Qd Kc Ah', '9s 10h Jd Qc Kh'); });
t('straight flush order', () => gt('2h 3h 4h 5h 6h', 'Ah 2h 3h 4h 5h'));
t('full house compares the triple first', () => gt('8s 8h 8d 2c 2h', '7s 7h 7d Ac Ah'));
t('two pair kicker', () => { gt('Ks Kh 2d 2c 9h', 'Qs Qh Jd Jc Ah'); gt('Ks Kh 2d 2c 9h', 'Kd Kc 2s 2h 8h'); });
t('pair kickers', () => gt('9s 9h Ad 3c 2h', '9d 9c Kd Qc Jh'));
t('flush high card', () => gt('Ah 3h 5h 7h 9h', 'Ks Qs Js 9s 7s'));
t('suits never break ties', () => eq('Ah Kd 9c 7s 3s', 'Ac Ks 9h 7d 3h'));
t('3-card vs 5-card: pair with higher kicker beats same pair', () => gt('5s 5h Ad', '5d 5c Kh 9h 3s'));
t('3-card vs 5-card: same pair, 5-card has more kickers', () => gt('5d 5c Kh 9h 3s', '5s 5h Kd'));
t('3-card trips beats 5-card two pair', () => gt('2s 2h 2d', 'As Ah Kd Kc Qh'));

// ---------------------------------------------------------------- validity
t('valid arrangement', () => assert.ok(R.isValid([ids('7s 7h 7d 2c 2h'), ids('5s 6h 7c 8c 9h'), ids('Ks Kh 2d')])));
t('binh lủng: chi 2 stronger than chi 1', () => assert.ok(!R.isValid([ids('5s 6h 7c 8c 9h'), ids('7s 7h 7d 2c 2h'), ids('Ks Kh 2d')])));
t('binh lủng: chi 3 stronger than chi 2', () => assert.ok(!R.isValid([ids('7s 7h 7d 2c 2h'), ids('As Kh Jd 9c 4h'), ids('3s 3h 2d')])));
t('wrong sizes', () => assert.ok(!R.isValid([ids('7s 7h 7d 2c'), ids('As Kh Jd 9c 4h 5h'), ids('3s 3h 2d')])));

// ---------------------------------------------------------------- special hands
t('sảnh rồng', () => assert.strictEqual(R.special(ids('2s 3h 4d 5c 6h 7s 8h 9d 10c Jh Qs Kh Ad')).kind, 'sanh_rong'));
t('6 đôi', () => assert.strictEqual(R.special(ids('2s 2h 4d 4c 6h 6s 8h 8d 10c 10h Qs Qh Ad')).kind, '6_doi'));
t('3 thùng', () => { const s = R.special(ids('2h 5h 7h 9h Jh 3s 4s 8s 10s Ks 6d 9d Qd')); assert.strictEqual(s.kind, '3_thung'); assert.ok(s.chi[0].length === 5 && s.chi[2].length === 3); });
t('3 thùng from one long suit', () => assert.strictEqual(R.special(ids('2h 3h 5h 7h 9h Jh Qh Kh 3s 4s 8s 10s Ks')).kind, '3_thung'));
t('3 sảnh', () => { const s = R.special(ids('As 2h 3d 4c 5h 8s 9h 10d Jc Qh Jd Qs Kh')); assert.strictEqual(s.kind, '3_sanh'); assert.ok(s.chi.every(x => x.length >= 3)); });
t('no special', () => assert.strictEqual(R.special(ids('2s 2h 4d 7c 9h 9s Jh Jd Kc Kh As 3h 5d')), null));

// ---------------------------------------------------------------- settlement
const P = (a, b, c) => ({ chi: [ids(a), ids(b), ids(c)] });
t('chi by chi ±1', () => {
  const s = R.settle([P('7s 7h 7d 2c 2h', '5s 6h 7c 8c 9h', 'Ks Kh 2d'), P('8s 8h 8d 3c 3h', '4s 5h 6c 7d 8c', 'As Ah 3d')]);
  assert.deepStrictEqual(s.units, [-1, 1]);   // P0 loses chi 1 and chi 3, wins chi 2
});
t('sập 3 chi pays double', () => {
  const s = R.settle([P('7s 7h 7d 7c 2h', '5s 6h 7c 8c 9h', 'Ks Kh 2d'), P('As Ah Qd 3c 3h', '4s 4h 6c 9d 8c', 'Qs Jh 3d')]);
  assert.deepStrictEqual(s.units, [6, -6]);
});
t('binh lủng loses 6 to a valid hand, two lủng draw', () => {
  const lung = P('5s 6h 7c 8c 9h', '7s 7h 7d 2c 2h', 'Ks Kh 2d');
  const ok = P('As Ah Qd 3c 3h', '4s 4h 6c 9d 8c', 'Qs Jh 3d');
  assert.deepStrictEqual(R.settle([lung, ok]).units, [-6, 6]);
  assert.deepStrictEqual(R.settle([lung, P('Jd Jc 4s 4d 3c', '9d 10c Js Qd Kc', 'Ac Ad 6s')]).units, [0, 0]);
});
t('special beats normal and lủng; specials compare by kind', () => {
  const rong = { chi: [ids('2s 3h 4d 5c 6h'), ids('7s 8h 9d 10c Jh'), ids('Qs Kh Ad')], special: R.special(ids('2s 3h 4d 5c 6h 7s 8h 9d 10c Jh Qs Kh Ad')) };
  const doi = { chi: [ids('2c 2h 4s 4c 6d'), ids('6c 8s 8c 10s 10h'), ids('Qc Qh As')], special: R.special(ids('2c 2h 4s 4c 6d 6c 8s 8c 10s 10h Qc Qh As')) };
  const normal = P('As Ah Qd 3c 3h', '4s 4h 6c 9d 8c', 'Qs Jh 3d');
  assert.deepStrictEqual(R.settle([rong, normal]).units, [12, -12]);
  assert.deepStrictEqual(R.settle([doi, normal]).units, [6, -6]);
  assert.deepStrictEqual(R.settle([rong, doi]).units, [12, -12]);
  assert.deepStrictEqual(R.settle([doi, doi]).units, [0, 0]);
});

// ---------------------------------------------------------------- arrangement search
t('arrange: valid, uses the tứ quý in chi 1', () => {
  const a = R.arrange(ids('9s 9h 9d 9c 2h 5s 6d 7c Jh Qs Kh Ad 3c'));
  assert.ok(R.isValid(a.chi)); assert.strictEqual(R.evaluate(a.chi[0]).name, 'Tứ quý');
});
t('arrange keeps all 13 cards', () => { const h = ids('2s 3h 5d 7c 9h Js Kh Ad 4c 6c 8d 10s Qc'); const a = R.arrange(h); assert.deepStrictEqual(R.sortIds(a.chi.flat()), R.sortIds(h)); });
t('arrange beats a naive "sorted" arrangement on average', () => {
  const rng = R.mulberry32(5); let better = 0, n = 0;
  for (let g = 0; g < 60; g++) {
    const hands = R.deal(rng);
    const naive = h => { const s = [...h].sort((a, b) => R.rankOf(b) - R.rankOf(a)); const ch = [s.slice(0, 5), s.slice(5, 10), s.slice(10)]; return R.isValid(ch) ? ch : R.arrange(h).chi; };
    const s = R.settle([{ chi: R.arrange(hands[0]).chi }, { chi: naive(hands[1]) }]);
    better += s.units[0]; n++;
  }
  assert.ok(better > 0, 'units ' + better);
});

// ---------------------------------------------------------------- random deals
// independent re-implementation of the payout for cross-checking
function refSettle(ps) {
  const u = ps.map(() => 0);
  for (let i = 0; i < ps.length; i++) for (let j = 0; j < ps.length; j++) {
    if (i === j) continue;
    const a = ps[i], b = ps[j]; let x = 0;
    if (a.special || b.special) { const pa = a.special ? a.special.prio : 0, pb = b.special ? b.special.prio : 0; x = pa > pb ? a.special.units : pa < pb ? -b.special.units : 0; }
    else {
      const va = R.isValid(a.chi), vb = R.isValid(b.chi);
      if (!va || !vb) x = va === vb ? 0 : va ? 6 : -6;
      else { let w = 0, l = 0; for (let k = 0; k < 3; k++) { const d = R.evaluate(a.chi[k]).score - R.evaluate(b.chi[k]).score; if (d > 0) w++; else if (d < 0) l++; } x = w === 3 ? 6 : l === 3 ? -6 : w - l; }
    }
    u[i] += x;
  }
  return u;
}
const stats = { deals: 0, special: 0, sap: 0, lung: 0 };
t('thousands of bot deals: valid arrangements, cards conserved, units conserved and recomputed', () => {
  const rng = R.mulberry32(2024);
  for (let g = 0; g < 2000; g++) {
    const hands = R.deal(rng);
    const all = hands.flat(); if (new Set(all).size !== 52) throw new Error('deal');
    const players = hands.map(h => {
      const a = R.botArrange(h, rng);
      const got = R.sortIds(a.chi.flat()); if (got.join() !== R.sortIds(h).join()) throw new Error('arrangement lost cards');
      if (!a.special && !R.isValid(a.chi)) throw new Error('bot made binh lủng');
      return { chi: a.chi, special: a.special || null };
    });
    // a deliberately broken hand now and then to exercise lủng
    if (g % 10 === 0 && !players[1].special) { const c = players[1].chi; players[1] = { chi: [c[1], c[0], c[2]] }; }
    const s = R.settle(players);
    if (s.units.reduce((a, b) => a + b, 0) !== 0) throw new Error('units not conserved');
    assert.deepStrictEqual(s.units, refSettle(players), 'deal ' + g);
    stats.deals++; stats.special += players.filter(p => p.special).length; stats.sap += s.pairs.filter(p => p.why === 'sap').length; stats.lung += s.valid.filter(v => !v).length;
    passed++;
  }
});
console.log('stats', JSON.stringify(stats));
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
