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
console.log(n + ' passed, 0 failed');
