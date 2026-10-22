'use strict';
// node tests/poker.test.js — Texas Hold'em: evaluator (every category, kickers, wheel), fast scorer vs evaluator vs
// brute force, blinds/positions, no-limit betting, side pots, and thousands of simulated hands with bots.
const assert = require('assert');
const C = require('../js/games3d/rules/cards-common.js');
const P = require('../js/games3d/rules/poker.js');
let pass = 0, fail = 0;
const ok = (cond, msg) => { try { assert.ok(cond, msg); pass++; } catch (e) { fail++; console.error('FAIL', msg); } };
const eq = (a, b, msg) => { try { assert.deepStrictEqual(a, b, msg); pass++; } catch (e) { fail++; console.error('FAIL', msg, '→ got', JSON.stringify(a), 'expected', JSON.stringify(b)); } };
const h = C.parse, E = s => P.evaluate(h(s));
const cmp = (a, b) => Math.sign(E(a).score - E(b).score);

// ---- every category (7 cards)
eq(E('A♥ K♥ Q♥ J♥ 10♥ 2♣ 3♦').name, 'Thùng phá sảnh', 'royal flush');
eq(E('A♥ K♥ Q♥ J♥ 10♥ 2♣ 3♦').desc, 'Thùng phá sảnh lớn (A)', 'royal flush description');
eq(E('5♠ 4♠ 3♠ 2♠ A♠ K♦ Q♦').desc, 'Thùng phá sảnh tới 5', 'steel wheel A-2-3-4-5 suited');
eq(E('9♣ 9♦ 9♥ 9♠ K♦ 2♣ 3♣').name, 'Tứ quý', 'four of a kind');
eq(E('8♣ 8♦ 8♥ 3♠ 3♦ 2♣ K♣').desc, 'Cù lũ 8 – 3', 'full house');
eq(E('2♥ 7♥ 9♥ J♥ K♥ A♣ A♦').name, 'Thùng', 'flush beats a pair of aces');
eq(E('9♣ 8♦ 7♥ 6♠ 5♦ 2♣ 2♦').desc, 'Sảnh tới 9', 'straight');
eq(E('A♣ 2♦ 3♥ 4♠ 5♦ 9♣ K♦').desc, 'Sảnh tới 5', 'wheel A-2-3-4-5');
eq(E('7♣ 7♦ 7♥ K♠ 2♦ 9♣ 4♦').name, 'Sám cô', 'three of a kind');
eq(E('J♣ J♦ 4♥ 4♠ A♦ 9♣ 2♦').desc, 'Thú J – 4', 'two pair');
eq(E('Q♣ Q♦ 4♥ 7♠ A♦ 9♣ 2♦').desc, 'Đôi Q', 'one pair');
eq(E('A♣ J♦ 4♥ 7♠ 3♦ 9♣ 2♦').name, 'Mậu thầu', 'high card');
eq(E('K♠ Q♦').name, 'Mậu thầu', 'two cards: high card');
eq(E('K♠ K♦').desc, 'Đôi K', 'two cards: pocket pair');

// ---- category order
const ladder = ['A♥ K♥ Q♥ J♥ 10♥', '9♣ 9♦ 9♥ 9♠ K♦', '8♣ 8♦ 8♥ 3♠ 3♦', '2♥ 7♥ 9♥ J♥ K♥', '9♣ 8♦ 7♥ 6♠ 5♦', '7♣ 7♦ 7♥ K♠ 2♦', 'J♣ J♦ 4♥ 4♠ A♦', 'Q♣ Q♦ 4♥ 7♠ A♦', 'A♣ J♦ 4♥ 7♠ 3♦'];
for (let i = 0; i + 1 < ladder.length; i++) ok(cmp(ladder[i], ladder[i + 1]) > 0, `${P.CAT[8 - i]} > ${P.CAT[7 - i]}`);

// ---- kickers and ties
eq(cmp('A♣ A♦ K♥ 7♠ 3♦ 2♣ 4♦', 'A♥ A♠ Q♥ J♠ 9♦ 2♦ 4♣'), 1, 'pair of aces: K kicker beats Q kicker');
eq(cmp('A♣ A♦ K♥ 9♠ 3♦', 'A♥ A♠ K♣ 8♠ 7♦'), 1, 'pair: third kicker decides (9 vs 8)');
eq(cmp('A♣ A♦ K♥ 9♠ 3♦', 'A♥ A♠ K♣ 9♦ 3♣'), 0, 'identical ranks split');
eq(cmp('J♣ J♦ 4♥ 4♠ A♦', 'J♥ J♠ 4♣ 4♦ K♦'), 1, 'two pair: kicker A beats K');
eq(cmp('J♣ J♦ 4♥ 4♠ 2♦', 'J♥ J♠ 5♣ 5♦ 2♣'), -1, 'two pair: second pair 5 beats 4');
eq(cmp('K♣ K♦ 3♥ 3♠ 2♦', 'Q♥ Q♠ J♣ J♦ A♣'), 1, 'two pair: top pair decides first');
eq(E('K♣ K♦ 7♥ 7♠ 5♦ 5♣ 4♦').desc, 'Thú K – 7', 'three pairs: best two pairs');
eq(E('K♣ K♦ 7♥ 7♠ 5♦ 5♣ 4♦').ranks, [13, 7, 5], 'three pairs: the third pair can be the kicker');
eq(cmp('7♣ 7♦ 7♥ A♠ 2♦', '7♣ 7♦ 7♥ K♠ Q♦'), 1, 'trips kicker');
eq(cmp('9♥ 8♦ 7♥ 6♠ 5♦', 'A♣ 2♦ 3♥ 4♠ 5♣'), 1, '9-high straight beats the wheel');
eq(cmp('6♥ 5♦ 4♥ 3♠ 2♦', 'A♣ 2♦ 3♥ 4♠ 5♣'), 1, '6-high straight beats the wheel (ace plays low)');
eq(cmp('A♥ K♦ Q♥ J♠ 10♦', 'K♣ Q♦ J♥ 10♠ 9♣'), 1, 'broadway is the top straight');
eq(E('K♦ A♣ 2♦ 3♥ 4♠').name, 'Mậu thầu', 'no wrap-around straight K-A-2-3-4');
eq(cmp('A♥ 9♥ 7♥ 4♥ 2♥', 'K♥ Q♥ J♥ 9♥ 7♥'), 1, 'flush: ace high wins');
eq(cmp('A♥ 9♥ 7♥ 4♥ 3♥', 'A♣ 9♣ 7♣ 4♣ 2♣'), 1, 'flush: fifth card decides');
eq(cmp('A♥ 9♥ 7♥ 4♥ 3♥', 'A♣ 9♣ 7♣ 4♣ 3♣'), 0, 'flush: suits never break ties');
eq(cmp('9♣ 9♦ 9♥ 2♠ 2♦', '8♣ 8♦ 8♥ A♠ A♦'), 1, 'full house: trips decide first');
eq(cmp('9♣ 9♦ 9♥ 3♠ 3♦', '9♠ 9♦ 9♥ 2♠ 2♣'), 1, 'full house: then the pair');
eq(E('9♣ 9♦ 9♥ 4♠ 4♦ 4♣ 2♦').desc, 'Cù lũ 9 – 4', 'two trips make a full house');
eq(E('Q♣ Q♦ Q♥ Q♠ 9♦ 9♣ 9♥').ranks, [12, 9], 'quads + trips: quads with the best kicker');
eq(cmp('5♣ 5♦ 5♥ 5♠ A♦', '5♣ 5♦ 5♥ 5♠ K♦'), 1, 'quads kicker');
eq(cmp('9♠ 8♠ 7♠ 6♠ 5♠', '8♦ 7♦ 6♦ 5♦ 4♦'), 1, 'straight flush ladder');
eq(cmp('5♠ 4♠ 3♠ 2♠ A♠', 'A♣ A♦ A♥ A♠ K♦'), 1, 'steel wheel beats quad aces');
eq(E('A♥ K♥ Q♥ J♥ 10♥ 9♥ 2♣').desc, 'Thùng phá sảnh lớn (A)', '6 suited cards: best straight flush');
eq(E('7♥ 6♥ 5♥ 4♥ 3♥ 2♥ A♣').desc, 'Thùng phá sảnh tới 7', 'longer suited run picks the top');
eq(E('7♥ 6♥ 5♥ 4♥ 3♠ 2♥ 8♣').desc, 'Thùng ♥ 7', 'straight and flush (not a straight flush): the flush ranks higher');
eq(E('7♥ 6♥ 5♥ 4♣ 3♠ 2♥ 8♣').desc, 'Sảnh tới 8', 'two straights: the higher one');
// best five cards really make the hand
{
  const r = E('8♣ 8♦ 8♥ 3♠ 3♦ 2♣ K♣');
  eq(r.best.length, 5, 'best has 5 cards');
  eq(r.best.map(c => c.r).sort().join(''), '33888', 'best five = 8 8 8 3 3');
  const r2 = E('A♣ 2♦ 3♥ 4♠ 5♦ 9♣ K♦');
  eq(r2.best.map(c => c.r).join(' '), '5 4 3 2 A', 'wheel best five in order');
}
// board plays: everyone splits
{
  const board = h('A♣ K♦ Q♥ J♠ 10♦'), a = P.evaluate([...h('2♣ 3♦'), ...board]), b = P.evaluate([...h('4♥ 4♠'), ...board]);
  eq(a.score, b.score, 'the board plays: broadway for both');
}

// ---- evaluate(7) = brute-force best of 21, fastScore = evaluate, on many random hands
{
  const rng = C.seeded(31337); let bad = 0, badFast = 0; const cats = new Array(9).fill(0);
  for (let t = 0; t < 30000; t++) {
    const d = C.deck(rng), n = 5 + (t % 3), cs = d.slice(0, n), r = P.evaluate(cs);
    if (n === 7 && t % 3 === 2 && t < 15000) { const b = P.bestOf(cs); if (b.score !== r.score || b.cat !== r.cat) bad++; }
    if (P.fastScore(cs.map(P.code), n) !== r.score) badFast++;
    if (P.evaluate(r.best).score !== r.score) bad++;
    if (n === 7) cats[r.cat]++;
  }
  eq(bad, 0, 'evaluate() agrees with brute force best-of-21 and its own best five');
  eq(badFast, 0, 'fastScore() agrees with evaluate() on 30 000 hands');
  ok(cats[1] > cats[0] * .9 && cats[2] > cats[3] && cats[4] > cats[5] * .9 && cats[6] > cats[7], '7-card category frequencies look right ' + cats.join(','));
}
// ---- equity sanity
{
  const rng = C.seeded(5);
  const aa = P.equity(h('A♣ A♦'), [], 1, 4000, rng), s72 = P.equity(h('7♣ 2♦'), [], 1, 4000, rng);
  ok(aa > .82 && aa < .88, 'AA vs one random hand ≈ 85% (' + aa.toFixed(3) + ')');
  ok(s72 > .29 && s72 < .38, '72o vs one random hand ≈ 34% (' + s72.toFixed(3) + ')');
  const nuts = P.equity(h('A♥ K♥'), h('Q♥ J♥ 10♥'), 3, 300, rng);
  eq(nuts, 1, 'flopped royal flush: 100%');
  ok(P.chen(h('A♣ A♦')) === 20 && P.chen(h('7♣ 2♦')) === -1 && P.chen(h('A♥ K♥')) === 12, 'Chen scores AA=20, AKs=12, 72o=-1');
}
// ---- positions
{
  eq(P.positions([1, 1, 1, 1, 1], 0), { button: 0, sb: 1, bb: 2, firstPre: 3, firstPost: 1 }, '5 players');
  eq(P.positions([1, 1, 1, 1, 1], 4), { button: 4, sb: 0, bb: 1, firstPre: 2, firstPost: 0 }, 'button wraps');
  eq(P.positions([1, 0, 1, 0, 0], 0), { button: 0, sb: 0, bb: 2, firstPre: 0, firstPost: 2 }, 'heads-up: button is the small blind and acts first preflop');
  eq(P.positions([1, 0, 1, 1, 0], 1), { button: 2, sb: 3, bb: 0, firstPre: 2, firstPost: 3 }, 'button skips an empty seat');
}

// ---- preflop betting with blinds
function newHand(stacks, button, bb) {
  const pos = P.positions(stacks.map(s => s > 0), button);
  const st = C.table(stacks, { minRaise: bb, unit: bb / 2 });
  C.street(st); C.blind(st, pos.sb, bb / 2); C.blind(st, pos.bb, bb); C.street(st, { keepBets: true, level: bb });
  return { st, pos };
}
{
  const { st, pos } = newHand([1e5, 1e5, 1e5, 1e5, 1e5], 0, 2000);
  eq(C.potTotal(st), 3000, 'blinds posted');
  eq(C.nextActor(st, pos.bb), 3, 'UTG acts first preflop');
  eq(C.legal(st, 3).call, 2000, 'UTG calls the big blind');
  eq(C.legal(st, 3).raise.min, 4000, 'min raise to 2 BB');
  [3, 4, 0].forEach(i => C.act(st, i, { type: 'call' }));
  C.act(st, 1, { type: 'call' });
  eq(C.nextActor(st, 1), 2, 'big blind gets the option');
  eq(C.legal(st, 2).check, true, 'BB may check');
  C.act(st, 2, { type: 'check' });
  eq(C.nextActor(st, 2), -1, 'preflop over');
  C.street(st);
  eq(C.nextActor(st, pos.button), 1, 'small blind acts first after the flop');
  eq(C.legal(st, 1).raise.min, 2000, 'min bet postflop = 1 BB');
  C.act(st, 1, { type: 'raise', to: 7000 });
  eq(C.legal(st, 2).raise.min, 14000, 'min raise doubles the bet');
}
{
  // heads-up blinds
  const { st, pos } = newHand([5e4, 0, 5e4, 0, 0], 2, 2000);
  eq([pos.sb, pos.bb], [2, 0], 'heads-up: button 2 posts SB');
  eq(C.nextActor(st, pos.bb), 2, 'heads-up: button acts first preflop');
  eq(st.players[1].out && st.players[3].out, true, 'empty seats are out');
}
{
  // BB short: callers must still match the full big blind
  const { st } = newHand([1e5, 1e5, 1500, 1e5], 0, 2000);
  eq(st.players[2].allIn, true, 'short BB all-in for 1 500');
  eq(C.legal(st, 3).call, 2000, 'UTG still calls a full 2 000');
}
{
  // side pots in a full hand: three different all-ins
  const { st, pos } = newHand([10000, 30000, 60000, 60000, 0], 3, 2000);   // button 3 → sb 0, bb 1, UTG 2
  eq([pos.sb, pos.bb, pos.firstPre], [0, 1, 2], 'positions with an empty seat');
  C.act(st, 2, { type: 'raise', to: 60000 });   // all-in
  C.act(st, 3, { type: 'call' });                // all-in call
  C.act(st, 0, { type: 'allin' });               // 10k
  C.act(st, 1, { type: 'allin' });               // 30k
  eq(C.nextActor(st, 1), -1, 'everyone all-in');
  eq(C.bettingClosed(st), true, 'no more betting');
  const pots = C.pots(st.players);
  eq(pots.map(p => p.amount), [40000, 60000, 60000], 'main 4×10k, side 3×20k, side 2×30k');
  const board = h('2♣ 7♦ 9♥ J♠ 4♦');
  const hands = [h('A♣ A♦'), h('K♣ K♦'), h('Q♣ Q♦'), h('3♣ 8♦')].map(x => [...x, ...board]);
  const r = P.showdown(st, [...hands, null], [4, 0, 1, 2, 3]);
  eq(r.pay, [40000, 60000, 60000, 0, 0], 'AA wins main, KK side 1, QQ side 2');
  eq(r.pay.reduce((a, b) => a + b, 0), 160000, 'all chips paid');
}
{
  // uncalled bet is returned through a one-player pot
  const { st, pos } = newHand([1e5, 1e5, 1e5], 0, 2000);
  C.act(st, 0, { type: 'raise', to: 50000 }); C.act(st, 1, { type: 'fold' }); C.act(st, 2, { type: 'fold' });
  eq(C.liveCount(st), 1, 'one player left');
  const r = P.showdown(st, [h('2♣ 3♦'), null, null], [1, 2, 0]);
  eq(r.pay, [53000, 0, 0], 'winner collects his bet + blinds');
  eq(pos.button, 0, 'button');
}
{
  // split pot with odd coin
  const { st } = newHand([1e5, 1e5, 1e5, 1e5], 0, 2000);   // sb 1, bb 2, UTG 3
  C.act(st, 3, { type: 'call' }); C.act(st, 0, { type: 'call' }); C.act(st, 1, { type: 'fold' }); C.act(st, 2, { type: 'check' });
  eq(C.potTotal(st), 7000, 'pot 3 × 2 000 + the folded small blind');
  const board = h('A♣ K♦ Q♥ J♠ 10♦');
  const r = P.showdown(st, [[...h('2♣ 3♦'), ...board], null, [...h('4♥ 4♠'), ...board], [...h('5♥ 6♠'), ...board]], [1, 2, 3, 0]);
  eq(r.pay, [2333, 0, 2334, 2333], 'three-way split of 7 000: the odd coin goes to the first winner left of the button');
}

// ================================================================ random full hands
function simulate(hands, seed, mode) {
  const rng = C.seeded(seed), bb = 2000; let stacks = [200000, 150000, 80000, 30000, 12000], button = 0;
  const stats = { showdowns: 0, folds: 0, sidePots: 0, allInRunouts: 0, splits: 0, maxActs: 0 };
  for (let t = 0; t < hands; t++) {
    stacks = stacks.map(s => (s < bb ? 40000 + Math.floor(rng() * 200) * 1000 : s));
    const { st, pos } = newHand(stacks, button, bb), chips0 = C.chipsInPlay(st);
    const deck = C.deck(rng), hole = stacks.map(() => [deck.pop(), deck.pop()]), board = [];
    let acts = 0, runout = false;
    for (let s = 0; s < 4; s++) {
      if (s > 0) { deck.pop(); for (let k = 0; k < (s === 1 ? 3 : 1); k++) board.push(deck.pop()); C.street(st); }
      let i = C.nextActor(st, s === 0 ? pos.bb : pos.button);
      while (i >= 0) {
        const Lg = C.legal(st, i); let a;
        if (mode === 'random') { const x = rng(); a = x < .15 ? { type: 'fold' } : x < .55 ? { type: Lg.check ? 'check' : 'call' } : x < .9 && Lg.raise ? { type: 'raise', to: Lg.raise.min + Math.floor(rng() * (Lg.raise.max - Lg.raise.min + 1)) } : { type: 'allin' }; }
        else a = P.botDecide({ hole: hole[i], board, legal: Lg, pot: C.potTotal(st), nOpp: C.liveCount(st) - 1, bb, unit: bb / 2, street: s, pers: P.PERSONAS[i % 4], sims: 16 }, rng);
        if (a.type === 'check' && Lg.toCall > 0) throw new Error('checked facing a bet');
        if (a.type === 'raise' && !Lg.raise) throw new Error('raised without the right to');
        if (a.type === 'raise' && mode !== 'random' && (a.to < Lg.raise.min || a.to > Lg.raise.max)) throw new Error('bot raise out of range ' + a.to + ' ' + JSON.stringify(Lg.raise));
        const before = st.players[i].stack, res = C.act(st, i, a);
        if (before - st.players[i].stack !== res.put) throw new Error('put mismatch');
        if (res.type === 'raise' && res.to < Lg.raise.min && !st.players[i].allIn) throw new Error('raise below minimum');
        if (C.chipsInPlay(st) !== chips0) throw new Error('chips not conserved');
        i = C.nextActor(st, i);
        if (++acts > 120) throw new Error('hand does not end');
      }
      const live = st.players.filter(C.inHand);
      if (live.some(p => !p.allIn && p.bet !== st.currentBet) && live.length > 1) throw new Error('street ended unmatched');
      if (C.liveCount(st) <= 1) break;
      if (C.bettingClosed(st) && s < 3 && live.length > 1 && !runout) { runout = true; stats.allInRunouts++; }
    }
    stats.maxActs = Math.max(stats.maxActs, acts);
    const hands7 = hole.map((hc, i) => (C.inHand(st.players[i]) ? [...hc, ...board] : null));
    const order = [1, 2, 3, 4, 5].map(k => (pos.button + k) % 5);
    const r = P.showdown(st, hands7, order);
    const pot = C.potTotal(st);
    if (r.pay.reduce((a, b) => a + b, 0) !== pot) throw new Error('payout != pot');
    if (C.liveCount(st) > 1) { stats.showdowns++; if (board.length !== 5) throw new Error('showdown without a full board'); } else stats.folds++;
    if (r.detail.filter(d => d.eligible.length > 1).length > 1) stats.sidePots++;
    if (r.detail.some(d => d.winners.length > 1)) stats.splits++;
    // every pot goes to the best eligible hand
    for (const d of r.detail) { if (d.eligible.length < 2) continue; const best = Math.max(...d.eligible.map(i => P.evaluate(hands7[i]).score)); if (d.winners.some(w => P.evaluate(hands7[w]).score !== best)) throw new Error('pot to a worse hand'); }
    stacks = st.players.map((p, k) => p.stack + r.pay[k]);
    if (stacks.reduce((a, b) => a + b, 0) !== chips0 || stacks.some(s => s < 0)) throw new Error('chips not conserved after the hand');
    button = P.nextSeat(stacks.map(s => s > 0), button);
  }
  return stats;
}
{
  const t0 = Date.now();
  const a = simulate(2500, 4242, 'bots');
  ok(a.showdowns > 200 && a.folds > 200, `bots: 2500 hands (${a.showdowns} showdowns, ${a.folds} won uncontested, ${a.sidePots} with side pots, ${a.splits} splits)`);
  const b = simulate(5000, 9, 'random');
  ok(b.sidePots > 100 && b.allInRunouts > 100 && b.splits > 5, `random actions: 5000 hands (${b.sidePots} side pots, ${b.allInRunouts} all-in run-outs, ${b.splits} splits)`);
  ok(Date.now() - t0 < 60000, 'simulations finish quickly');
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
