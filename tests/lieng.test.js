'use strict';
// node tests/lieng.test.js — Liêng hand classes, tie rule, betting engine (antes, raise cap, all-ins, side pots) and
// thousands of simulated hands with bots.
const assert = require('assert');
const C = require('../js/games3d/rules/cards-common.js');
const R = require('../js/games3d/rules/lieng.js');
let pass = 0, fail = 0;
const ok = (cond, msg) => { try { assert.ok(cond, msg); pass++; } catch (e) { fail++; console.error('FAIL', msg); } };
const eq = (a, b, msg) => { try { assert.deepStrictEqual(a, b, msg); pass++; } catch (e) { fail++; console.error('FAIL', msg, '→ got', JSON.stringify(a), 'expected', JSON.stringify(b)); } };
const h = C.parse, E = s => R.evaluate(h(s));
const beats = (a, b, msg) => ok(E(a).score > E(b).score, msg || `${a} > ${b}`);

// ---- classes
eq(E('7♦ 7♠ 7♣').name, 'Sáp', 'three of a kind = Sáp');
eq(E('Q♦ K♠ A♣').name, 'Liêng', 'Q-K-A = Liêng');
eq(E('A♦ 2♠ 3♣').name, 'Liêng', 'A-2-3 = Liêng');
eq(E('4♣ 2♣ 3♣').desc, 'Liêng 2-3-4', 'run in any order, suits irrelevant');
eq(E('K♦ A♠ 2♣').cls, 0, 'K-A-2 is not a Liêng');
eq(E('J♦ Q♠ K♣').name, 'Liêng', 'J-Q-K counts as Liêng (above Ảnh)');
eq(E('J♦ J♠ K♣').name, 'Ảnh', 'J-J-K = Ảnh');
eq(E('Q♦ K♠ K♣').name, 'Ảnh', 'Q-K-K = Ảnh');
eq(E('10♦ J♠ Q♣').name, 'Liêng', '10-J-Q is a Liêng');
eq(E('10♦ J♠ K♣').cls, 0, '10 is not a picture card: 10-J-K is Điểm');
eq(E('10♦ J♠ K♣').points, 0, '10-J-K = 0 điểm');
eq(E('A♦ 4♠ 4♣').points, 9, 'A+4+4 = 9 điểm');
eq(E('9♦ 9♠ 2♣').points, 0, '9+9+2 = 20 → 0 điểm');
eq(E('5♦ 7♠ 8♣').points, 0, '5+7+8 = 20 → 0 điểm');
eq(E('6♦ 7♠ 8♣').name, 'Liêng', '6-7-8 run');

// ---- order between classes
beats('2♦ 2♠ 2♣', 'Q♦ K♠ A♣', 'Sáp 2 beats the best Liêng');
beats('A♦ A♠ A♣', 'K♦ K♠ K♣', 'Sáp A is the top Sáp');
beats('K♦ K♠ K♣', '2♦ 2♠ 2♥', 'Sáp K beats Sáp 2');
beats('A♦ 2♠ 3♣', 'K♦ K♠ Q♣', 'lowest Liêng beats the best Ảnh');
beats('J♦ J♠ Q♣', 'A♦ 4♠ 4♣', 'Ảnh beats 9 điểm');
beats('2♣ 3♣ 4♣', 'A♦ 2♠ 3♥', '2-3-4 beats A-2-3');
beats('Q♣ K♣ A♣', 'J♦ Q♦ K♦', 'Q-K-A beats J-Q-K');
beats('A♦ 4♠ 4♣', 'A♣ 3♠ 4♥', '9 điểm beats 8 điểm');
beats('A♣ 3♠ 4♥', 'K♦ K♠ 10♣', '8 điểm beats 0 điểm');

// ---- tie rule: biggest card (rank, then suit ♦ > ♥ > ♠ > ♣)
beats('4♣ 5♣ 6♦', '4♦ 5♦ 6♥', 'same Liêng: top card 6♦ beats 6♥');
beats('A♠ 2♠ 3♦', 'A♦ 2♦ 3♠', 'A-2-3 tie: decided by the 3 (♦ > ♠)');
beats('Q♣ K♣ A♥', 'Q♦ K♦ A♠', 'Q-K-A tie: decided by the ace');
beats('K♦ J♠ J♣', 'K♥ Q♦ Q♠', 'two Ảnh with K: K♦ beats K♥');
beats('K♣ J♠ J♥', 'Q♦ Q♠ J♦', 'Ảnh: K beats Q whatever the suits');
beats('A♦ 4♠ 4♣', 'A♣ 4♦ 4♥', 'equal 9 điểm: biggest card A♦ beats A♣');
beats('A♣ 4♠ 4♥', '5♦ 2♦ 2♠', 'equal 9 điểm: A (A high) beats 5');
beats('K♦ 5♣ 4♣', 'Q♦ 6♦ 3♦', 'equal 9 điểm: K beats Q');
beats('9♦ 10♣ K♣', '9♥ 10♠ Q♥', 'equal 9 điểm with same biggest-card rank (K vs Q)? K wins');

// ---- exhaustive class counts
{
  const d = C.deck(), cnt = [0, 0, 0, 0];
  for (let i = 0; i < 52; i++) for (let j = i + 1; j < 52; j++) for (let k = j + 1; k < 52; k++) cnt[R.evaluate([d[i], d[j], d[k]]).cls]++;
  eq(cnt[3], 52, '52 Sáp hands');
  eq(cnt[2], 12 * 64, '768 Liêng hands (12 runs × 4³ suits)');
  eq(cnt[1], 220 - 12 - 64, '144 Ảnh hands');
  eq(cnt[0], 22100 - 52 - 768 - 144, 'the rest are Điểm');
  ok(R.percentile(h('A♦ A♠ A♣')) > .999, 'Sáp A percentile ~1');
  ok(R.percentile(h('K♦ K♠ 10♣')) < .12, 'a low 0 điểm is weak');
  ok(R.percentile(h('A♦ 4♠ 4♣')) > R.percentile(h('A♣ 3♠ 4♥')), 'percentile follows strength');
}
// ---- no ties in real deals
{
  const rng = C.seeded(99); let ties = 0;
  for (let t = 0; t < 20000; t++) { const d = C.deck(rng); const sc = [0, 1, 2, 3, 4].map(i => R.evaluate(d.slice(i * 3, i * 3 + 3)).score); if (new Set(sc).size !== 5) ties++; }
  eq(ties, 0, 'no two hands tie in 20 000 five-player deals');
}

// ================================================================ betting engine
{
  // antes + a simple round: A bets, B calls, C folds
  const st = C.table([100000, 100000, 100000], { minRaise: 5000, raiseCap: 3, unit: 1000 });
  [0, 1, 2].forEach(i => C.ante(st, i, 5000)); C.street(st);
  eq(C.potTotal(st), 15000, 'antes in the pot');
  eq(C.legal(st, 0).check, true, 'first player may check (Theo with nothing to call)');
  eq(C.legal(st, 0).raise, { min: 5000, max: 95000 }, 'min raise = ante, max = stack');
  C.act(st, 0, { type: 'raise', to: 20000 });
  eq(C.nextActor(st, 0), 1, 'B to act');
  eq(C.legal(st, 1).call, 20000, 'B must call 20 000');
  eq(C.legal(st, 1).raise.min, 40000, 'min re-raise = 20 000 + 20 000');
  C.act(st, 1, { type: 'call' }); C.act(st, 2, { type: 'fold' });
  eq(C.nextActor(st, 2), -1, 'round over after call + fold');
  eq(C.potTotal(st), 55000, 'pot = 15 000 antes + 2 × 20 000');
  const hands = [h('A♦ A♠ A♣'), h('2♦ 3♦ 4♦'), h('K♦ K♠ 9♣')];
  const r = R.showdown(st, hands, [1, 2, 0]);
  eq(r.pay, [55000, 0, 0], 'Sáp A takes the whole pot (folded hand is ignored)');
  eq(C.chipsInPlay(st), 300000, 'chips conserved');
}
{
  // raise cap: 3 raises, then only call/fold
  const st = C.table([1e6, 1e6], { minRaise: 1000, raiseCap: 3, unit: 1000 }); C.ante(st, 0, 1000); C.ante(st, 1, 1000); C.street(st);
  C.act(st, 0, { type: 'raise', to: 2000 }); C.act(st, 1, { type: 'raise', to: 4000 }); C.act(st, 0, { type: 'raise', to: 8000 });
  eq(C.legal(st, 1).raise, null, 'raise cap reached: no 4th raise');
  C.act(st, 1, { type: 'raise', to: 50000 });   // engine converts an illegal raise into a call
  eq(st.players[1].bet, 8000, 'illegal raise becomes a call');
  eq(C.nextActor(st, 1), -1, 'round over');
}
{
  // short all-in does not re-open raising for a player who already acted
  const st = C.table([100000, 30000, 100000], { minRaise: 10000, unit: 1000 }); C.street(st);
  C.act(st, 0, { type: 'raise', to: 20000 });            // A bets 20k
  C.act(st, 1, { type: 'allin' });                       // B all-in 30k (raise of 10k < 20k: not a full raise)
  eq(st.players[1].allIn, true, 'B is all-in');
  eq(st.currentBet, 30000, 'level is now 30k');
  eq(C.legal(st, 2).raise.min, 50000, 'C (has not acted) may raise: min 30k + 20k');
  C.act(st, 2, { type: 'call' });
  eq(C.nextActor(st, 2), 0, 'A must respond to the extra 10k');
  eq(C.legal(st, 0).raise, null, 'A cannot re-raise after a short all-in');
  eq(C.legal(st, 0).call, 10000, 'A calls 10k more');
  C.act(st, 0, { type: 'call' });
  eq(C.nextActor(st, 0), -1, 'round over');
}
{
  // side pots: A all-in 10k, B all-in 30k, C calls 50k (D folds after putting 5k)
  const P = [{ i: 0, total: 10000 }, { i: 1, total: 30000 }, { i: 2, total: 50000 }, { i: 3, total: 5000, folded: true }].map(p => Object.assign({ folded: false, out: false }, p));
  const pots = C.pots(P);
  eq(pots.map(p => p.amount), [35000, 40000, 20000], 'main 4×… : 10k×3 + 5k dead, side 20k×2, uncalled 20k');
  eq(pots.map(p => p.eligible), [[0, 1, 2], [1, 2], [2]], 'eligibility');
  const best = { 0: 3, 1: 2, 2: 1 };      // A best, then B, then C
  const r = C.award(P, pots, (i, j) => best[i] - best[j]);
  eq(r.pay, [35000, 40000, 20000, 0], 'A wins main, B wins side, C gets the uncalled 20k back');
  // split with an odd coin
  const r2 = C.award(P, [{ amount: 10001, eligible: [0, 1, 2] }], () => 0, [2, 0, 1]);
  eq(r2.pay, [3334, 3333, 3334, 0], 'three-way split: odd coins go to the first winners in order');
}

// ================================================================ simulations
function simulate(hands, seed, mode, o = {}) {
  const rng = C.seeded(seed); let stacks = [400000, 250000, 120000, 60000, 30000], showdowns = 0, folds = 0, sidePots = 0, maxActs = 0;
  const pers = R.PERSONAS;
  for (let t = 0; t < hands; t++) {
    stacks = stacks.map(s => (s < 5000 ? 50000 + Math.floor(rng() * 400) * 1000 : s));   // rebuy
    const ante = [1000, 5000, 10000][t % 3];
    const st = C.table(stacks, { minRaise: ante, raiseCap: R.RAISE_CAP, unit: 1000, potLimit: !!o.potLimit });
    const chips0 = C.chipsInPlay(st);
    const deck = C.deck(rng), cards = stacks.map(() => [deck.pop(), deck.pop(), deck.pop()]);
    st.players.forEach((p, i) => C.ante(st, i, ante));
    C.street(st);
    const dealer = t % 5; let i = C.nextActor(st, dealer), acts = 0;
    while (i >= 0) {
      const Lg = C.legal(st, i);
      let a;
      if (mode === 'random') { const x = rng(); a = x < .2 ? { type: 'fold' } : x < .6 ? { type: 'call' } : x < .9 && Lg.raise ? { type: 'raise', to: Lg.raise.min + Math.floor(rng() * (Lg.raise.max - Lg.raise.min)) } : { type: 'allin' }; }
      else a = R.botDecide({ hand: cards[i], legal: Lg, pot: C.potTotal(st), nOpp: C.liveCount(st) - 1, ante, unit: 1000, pers: pers[i % 4], level: o.levels ? o.levels[i] : undefined }, rng);
      if (a.type === 'check' && Lg.toCall > 0) throw new Error('bot checked facing a bet');
      if (a.type === 'raise' && !Lg.raise) throw new Error('bot raised without the right to');
      const before = st.players[i].stack;
      const res = C.act(st, i, a);
      if (before - st.players[i].stack !== res.put) throw new Error('put mismatch');
      if (C.chipsInPlay(st) !== chips0) throw new Error('chips not conserved mid-round');
      if (st.raises > R.RAISE_CAP) throw new Error('raise cap broken');
      if (o.potLimit && res.type === 'raise' && res.to > Lg.raise.max) throw new Error('raise above the pot in pot-limit');
      i = C.nextActor(st, i);
      if (++acts > 60) throw new Error('betting round does not end');
    }
    maxActs = Math.max(maxActs, acts);
    const live = st.players.filter(C.inHand);
    if (live.some(p => !p.allIn && p.bet !== st.currentBet)) throw new Error('round ended with unmatched bets');
    const pots = C.pots(st.players);
    if (pots.reduce((a, p) => a + p.amount, 0) !== C.potTotal(st)) throw new Error('pots do not add up');
    if (pots.length > 1 && pots.filter(p => p.eligible.length > 1).length > 1) sidePots++;
    const r = R.showdown(st, cards.map((c, k) => (st.players[k].folded ? null : c)), [1, 2, 3, 4, 0].map(k => (dealer + k) % 5));
    if (r.pay.reduce((a, b) => a + b, 0) !== C.potTotal(st)) throw new Error('payout != pot');
    if (live.length > 1) showdowns++; else folds++;
    // the best live hand must win the main pot
    const bestLive = live.reduce((a, p) => (R.evaluate(cards[p.i]).score > R.evaluate(cards[a.i]).score ? p : a));
    if (!r.detail[0].winners.includes(bestLive.i) && r.detail[0].eligible.includes(bestLive.i)) throw new Error('main pot to the wrong player');
    stacks = st.players.map((p, k) => p.stack + r.pay[k]);
    if (stacks.reduce((a, b) => a + b, 0) !== chips0) throw new Error('chips not conserved after payout');
    if (stacks.some(s => s < 0)) throw new Error('negative stack');
  }
  return { showdowns, folds, sidePots, maxActs };
}
{
  const a = simulate(4000, 2024, 'bots');
  ok(a.showdowns > 300 && a.folds > 100, `bots: 4000 hands, ${a.showdowns} showdowns, ${a.folds} won by folds`);
  const b = simulate(4000, 77, 'random');
  ok(b.sidePots > 10, `random actions: 4000 hands, ${b.sidePots} hands with side pots`);
  ok(a.maxActs <= 20 && b.maxActs <= 25, 'betting rounds stay short with the raise cap');
}
// ---- chế độ "Tố tối đa bằng hũ" (pot-limit): each raise goes at most to the size of the pot
{
  const st = C.table([1e6, 1e6, 1e6, 1e6, 1e6], { minRaise: 5000, raiseCap: R.RAISE_CAP, unit: 1000, potLimit: true });
  st.players.forEach((p, i) => C.ante(st, i, 5000)); C.street(st);
  eq(C.legal(st, 1).raise, { min: 5000, max: 25000 }, 'pot-limit: first raise at most the 25K of antes');
  C.act(st, 1, { type: 'allin' });
  ok(st.players[1].bet === 25000 && !st.players[1].allIn, 'pot-limit: TẤT TAY becomes a pot-size raise');
  eq(C.legal(st, 2).raise.max, 100000, 'pot-limit re-raise: call 25K + pot 50K → raise to 100K');
  const free = C.table([1e6, 1e6, 1e6, 1e6, 1e6], { minRaise: 5000, raiseCap: R.RAISE_CAP, unit: 1000 });
  free.players.forEach((p, i) => C.ante(free, i, 5000)); C.street(free);
  eq(C.legal(free, 1).raise.max, 995000, 'tố tự do: the whole stack');
  const c = simulate(3000, 909, 'bots', { potLimit: true }), d = simulate(3000, 910, 'random', { potLimit: true });
  ok(c.showdowns > 200 && d.showdowns > 200, `pot-limit: 6000 hands, chips conserved, no raise above the pot (${c.showdowns + d.showdowns} showdowns)`);
}
// ---- bot strength (room tiers)
{
  const lv = simulate(1500, 31, 'bots', { levels: [0, 1, 2, 3, 3] });
  ok(lv.showdowns + lv.folds === 1500, 'bots at levels 0–3 play 1500 legal hands');
  const rng = C.seeded(8), plays = level => { let n = 0; for (let i = 0; i < 400; i++) { const a = R.botDecide({ hand: h('2♣ 7♦ 9♠'), legal: { toCall: 60000, stack: 5e5, currentBet: 60000, bet: 0, raise: { min: 65000, max: 5e5 }, check: false }, pot: 45000, nOpp: 3, ante: 5000, unit: 1000, level }, rng); if (a.type !== 'fold') n++; } return n; };
  ok(plays(0) > plays(3), `easy bots call a big bet with 8 điểm more often than hard bots (${plays(0)} vs ${plays(3)} of 400)`);
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
