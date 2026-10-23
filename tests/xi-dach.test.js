'use strict';
const assert = require('assert'); const R = require('../js/games3d/rules/xi-dach.js');
const h = s => s.split(' ').map(r => ({ r, s: 'hearts' }));
let n = 0; const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };
eq(R.total(h('A K')), 21, 'A+K'); eq(R.total(h('A A')), 12, 'two aces'); eq(R.total(h('A 5 9')), 15, 'soft ace drops'); eq(R.total(h('A 9')), 20, 'A as 11');
eq(R.kind(h('A A')).name, 'Xì Bàng'); eq(R.kind(h('A Q')).name, 'Xì Dách'); eq(R.kind(h('10 9 5')).name, 'Quắc'); eq(R.kind(h('2 3 4 5 6')).name, 'Ngũ Linh'); eq(R.kind(h('2 3 4 5 9')).name, 'Quắc');
eq(R.settle(h('A A'), h('A K')), 2, 'xì bàng beats xì dách'); eq(R.settle(h('A K'), h('10 9')), 1.5, 'xì dách pays 1.5'); eq(R.settle(h('10 9'), h('A J')), -1.5, 'lose to dealer xì dách');
eq(R.settle(h('10 9 5'), h('10 9 4')), 0, 'both bust is a draw'); eq(R.settle(h('10 9 5'), h('10 8')), -1, 'bust loses'); eq(R.settle(h('10 8'), h('10 9 5')), 1, 'dealer bust');
eq(R.settle(h('10 9'), h('10 8')), 1, 'higher wins'); eq(R.settle(h('10 8'), h('10 8')), 0, 'tie'); eq(R.settle(h('2 3 4 5 6'), h('10 9')), 2, 'ngũ linh beats 19');
eq(R.settle(h('2 2 3 3 4'), h('2 3 4 5 6')), 2, 'smaller ngũ linh wins');
for (let i = 0; i < 2000; i++) { const hand = h(['2', '3', 'A', 'K', '9'].slice(0, 2 + (i % 4)).join(' ')); const v = R.settle(hand, h('10 7')); assert.ok([-2, -1.5, -1, 0, 1, 1.5, 2].includes(v)); n++; }
// ---- chế độ Làm cái: you are the bank
{
  const r = R.settleBank([h('A A'), h('10 8'), h('10 9 5')], [10000, 20000, 50000], h('10 9'));
  eq(r.mult, [2, -1, -1], 'bank vs xì bàng / 18 / quắc');
  eq(r.net, [20000, -20000, -50000], 'what each player wins or pays');
  eq(r.dealerNet, 50000, 'the bank collects the rest');
  const b = R.settleBank([h('A K'), h('2 3 4 5 6')], [10000, 10000], h('10 9 5'));
  eq(b.dealerNet, -35000, 'busted bank pays xì dách 1.5× and ngũ linh 2×');
  const rnd = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })(), R13 = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  for (let t = 0; t < 3000; t++) {
    const deal = k => Array.from({ length: k }, () => ({ r: R13[Math.floor(rnd() * 13)], s: 'hearts' }));
    const hands = [deal(2 + (t % 3)), deal(2 + (t % 4)), deal(2)], bets = [5000, 10000, 50000], d = deal(2 + (t % 2)), s = R.settleBank(hands, bets, d);
    assert.strictEqual(s.net.reduce((a, x) => a + x, 0) + s.dealerNet, 0, 'zero-sum'); n++;
    assert.ok(s.net.every((x, i) => x <= bets[i] * 2 && x >= -bets[i] * 2)); n++;
  }
  eq(R.capBets([50000, 50000, 50000], 1e6, [5000, 10000, 50000]), [50000, 50000, 50000], 'rich bank: bets unchanged');
  const c = R.capBets([50000, 50000, 10000], 150000, [5000, 10000, 50000]);
  assert.ok(c.reduce((a, x) => a + x * 2, 0) <= 150000); n++;
  eq(R.capBets([5000], 4000, [5000]), [0], 'a bank that cannot cover even the smallest stake takes no bet');
}
console.log(n + ' passed, 0 failed');
