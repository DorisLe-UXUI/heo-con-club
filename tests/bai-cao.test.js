'use strict';
// node tests/bai-cao.test.js — Bài Cào (Ba Cây) scoring, tie rule, payouts and random table simulations.
const assert = require('assert');
const C = require('../js/games3d/rules/cards-common.js');
const R = require('../js/games3d/rules/bai-cao.js');
let pass = 0, fail = 0;
const ok = (cond, msg) => { try { assert.ok(cond, msg); pass++; } catch (e) { fail++; console.error('FAIL', msg); } };
const eq = (a, b, msg) => { try { assert.deepStrictEqual(a, b, msg); pass++; } catch (e) { fail++; console.error('FAIL', msg, '→ got', a, 'expected', b); } };
const h = C.parse;

// ---- card points and scores
eq(R.pts('A'), 1, 'A = 1'); eq(R.pts('7'), 7, '7 = 7'); eq(R.pts('10'), 10, '10 = 10'); eq(R.pts('K'), 10, 'K = 10');
eq(R.score(h('A♦ 2♠ 3♣')).points, 6, 'A+2+3 = 6');
eq(R.score(h('9♦ 9♠ 9♣')).points, 7, '27 → 7 nút');
eq(R.score(h('5♦ 5♠ K♣')).name, 'Bù', '5+5+K = Bù');
eq(R.score(h('10♦ J♠ Q♣')).baTay, false, '10 is not a picture card');
eq(R.score(h('10♦ J♠ Q♣')).points, 0, '10 J Q = 0');
eq(R.score(h('J♦ Q♠ K♣')).name, 'Ba Tây', 'J Q K = Ba Tây');
eq(R.score(h('K♦ K♠ K♣')).baTay, true, 'K K K = Ba Tây');
eq(R.score(h('A♥ A♠ A♣')).name, '3 nút', 'A A A = 3 nút');
eq(R.score(h('4♥ 5♥ K♠')).name, '9 nút', '9 nút name');
eq(R.score(h('2♣ 3♣ 4♣')).top.r, '4', 'top card same suit: highest rank');
eq(R.score(h('2♦ K♣ A♠')).top.key, 'diamonds_2', 'top card: suit first (♦2 beats ♠A)');

// ---- ordering
ok(R.compare(h('J♣ Q♣ K♣'), h('4♦ 5♦ K♦')) > 0, 'Ba Tây beats 9 nút');
ok(R.compare(h('2♣ 3♣ 2♠'), h('A♣ A♠ 4♣')) > 0, '7 nút beats 6 nút');
ok(R.compare(h('A♣ 2♠ 3♣'), h('5♣ 5♠ K♣')) > 0, '6 nút beats Bù (0 is the lowest score)');
eq(Math.sign(R.compare(h('A♣ A♠ 8♣'), h('J♦ Q♦ 10♦'))), -1, 'two Bù: Q♦ beats A♠ (suit first)');
eq(Math.sign(R.compare(h('9♦ K♣ Q♣'), h('4♥ 5♥ K♠'))), 1, 'equal 9 nút: ♦ top beats ♥ top');
eq(Math.sign(R.compare(h('K♦ 4♣ 5♣'), h('A♦ 8♣ K♣'))), -1, 'equal 9 nút, both ♦ top: A♦ beats K♦');
eq(Math.sign(R.compare(h('4♦ 5♦ K♦'), h('4♠ 4♣ A♣'))), 1, 'equal 9 nút: K♦ beats 4♠');
eq(Math.sign(R.compare(h('2♦ 3♣ 4♣'), h('A♥ K♥ 8♥'))), 1, 'equal 9 nút: ♦2 beats ♥A (suit first, then rank)');
eq(Math.sign(R.compare(h('9♣ 9♠ A♣'), h('9♦ 10♠ Q♣'))), -1, 'equal 9 nút: 9♦ beats 9♠');
eq(Math.sign(R.compare(h('K♦ J♣ Q♣'), h('K♥ K♠ K♣'))), 1, 'two Ba Tây: K♦ beats K♥');
eq(Math.sign(R.compare(h('5♣ 5♠ 10♣'), h('5♦ 5♥ K♣'))), -1, 'two Bù: 5♦ beats 10♣? suit ♦ > ♣');

// ---- settle and payout
eq(R.settle(h('J♣ Q♣ K♣'), h('4♦ 5♦ K♦')), 2, 'bettor Ba Tây pays 1:2');
eq(R.settle(h('4♦ 5♦ K♦'), h('J♣ Q♣ K♣')), -1, 'dealer Ba Tây: bettor loses the stake only');
eq(R.settle(h('2♣ 3♣ 2♠'), h('A♣ A♠ 4♣')), 1, '7 nút beats 6 nút: 1:1');
eq(R.settle(h('A♣ A♠ 4♣'), h('2♣ 3♣ 2♠')), -1, '6 nút loses to 7 nút');
eq(R.payout(10000, 2), 30000, 'Ba Tây: stake back + 2×');
eq(R.payout(10000, 1), 20000, 'win: stake back + 1×');
eq(R.payout(10000, -1), 0, 'lose: nothing back');

// ---- exhaustive counts over all 22 100 hands
{
  const d = C.deck(); let ba = 0; const byPts = new Array(10).fill(0); const keys = new Set();
  for (let i = 0; i < 52; i++) for (let j = i + 1; j < 52; j++) for (let k = j + 1; k < 52; k++) {
    const s = R.score([d[i], d[j], d[k]]); if (s.baTay) ba++; else byPts[s.points]++;
  }
  eq(ba, 220, 'C(12,3) = 220 Ba Tây hands');
  eq(byPts.reduce((a, b) => a + b, 0) + ba, 22100, 'all hands counted');
  ok(byPts.every(x => x > 1500), 'every score 0..9 is common');
}

// ---- random tables: settlement is zero-sum, no draws, values in range
{
  const rng = C.seeded(12345); let draws = 0, baTayWins = 0;
  for (let t = 0; t < 20000; t++) {
    const deck = C.deck(rng), hands = [0, 1, 2, 3, 4].map(() => [deck.pop(), deck.pop(), deck.pop()]);
    const dealer = t % 5, bets = hands.map((_, i) => (i === dealer ? 0 : R.botBet(1e6, rng)));
    const r = R.settleTable(hands, bets, dealer);
    if (r.net.reduce((a, b) => a + b, 0) !== 0) throw new Error('not zero-sum at table ' + t);
    hands.forEach((hh, i) => {
      if (i === dealer) return;
      const c = R.compare(hh, hands[dealer]); if (c === 0) draws++;
      if (r.mult[i] === 2) { baTayWins++; if (!R.score(hh).baTay) throw new Error('mult 2 without Ba Tây'); }
      if (![-1, 1, 2].includes(r.mult[i])) throw new Error('bad mult');
      if (Math.sign(c) !== Math.sign(r.mult[i])) throw new Error('settle disagrees with compare');
      if (R.payout(bets[i], r.mult[i]) - bets[i] !== r.net[i]) throw new Error('payout disagrees with net');
    });
  }
  eq(draws, 0, 'no draws in 20 000 random tables (unique cards)');
  ok(baTayWins > 0, 'Ba Tây wins happen in simulation');
  pass++;   // zero-sum + consistency checks above passed for every table
}
// ---- antisymmetry & transitivity samples
{
  const rng = C.seeded(7);
  for (let t = 0; t < 3000; t++) {
    const d = C.deck(rng), a = d.slice(0, 3), b = d.slice(3, 6), c = d.slice(6, 9);
    if (Math.sign(R.compare(a, b)) !== -Math.sign(R.compare(b, a))) throw new Error('not antisymmetric');
    if (R.compare(a, b) > 0 && R.compare(b, c) > 0 && !(R.compare(a, c) > 0)) throw new Error('not transitive');
  }
  pass++;
}
// ---- bot bets
{ const rng = C.seeded(3); for (let i = 0; i < 2000; i++) { const b = R.botBet(50000 + i * 1000, rng); if (!(b >= 5000 && b <= 100000)) throw new Error('bot bet ' + b); } pass++; }
ok(typeof R.quip(R.score(h('J♣ Q♣ K♣'))) === 'string', 'quip text');

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
