/* Liêng rules — pure, no DOM. Three cards each, everyone antes, one no-limit betting round (max 3 raises), showdown.
 * Hand classes, strongest first:
 *   Sáp   three of a kind (Sáp A > Sáp K > … > Sáp 2)
 *   Liêng three consecutive ranks, suits irrelevant (Q-K-A highest … 2-3-4, A-2-3 lowest; K-A-2 is not a Liêng)
 *   Ảnh   three picture cards J/Q/K that are not a Sáp or a Liêng
 *   Điểm  sum mod 10 (A = 1, 2..9, 10/J/Q/K = 0)
 * Ties inside a class (Liêng of the same ranks, two Ảnh, equal Điểm): compare the biggest card — rank first
 * (A > K > … > 2; for a Liêng the top card of the run, the 3 in A-2-3), then suit ♦ > ♥ > ♠ > ♣. Cards are unique,
 * so two hands never tie and a pot is never split (the engine still supports splitting). */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(require('./cards-common.js')); else (root.Rules = root.Rules || {})['lieng'] = f(root.Rules['cards-common']); })(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const FACE = ['J', 'Q', 'K'];
  const CLS = ['Điểm', 'Ảnh', 'Liêng', 'Sáp'];
  const pts = r => (r === 'A' ? 1 : r === '10' || FACE.includes(r) ? 0 : +r);
  const cardKey = c => C.hi(c.r) * 10 + C.SUIT_RANK[c.s];       // rank first, then suit
  const biggest = hand => hand.reduce((a, c) => (cardKey(c) > cardKey(a) ? c : a));
  /** Evaluate 3 cards → {cls (0..3), name, desc, points, score}. Bigger score wins. */
  function evaluate(hand) {
    if (hand.length !== 3) throw new Error('liêng needs 3 cards');
    const v = hand.map(c => C.hi(c.r)).sort((a, b) => a - b);
    if (v[0] === v[1] && v[1] === v[2]) return { cls: 3, name: 'Sáp', desc: 'Sáp ' + hand[0].r, points: null, score: 3e6 + v[2] * 10 };
    // runs: ace high (Q-K-A … 2-3-4) or ace low (A-2-3, the lowest)
    let seq = 0, topCard = null;
    if (v[1] === v[0] + 1 && v[2] === v[1] + 1) { seq = v[2] - 2; topCard = hand.find(c => C.hi(c.r) === v[2]); }
    else if (v[0] === 2 && v[1] === 3 && v[2] === 14) { seq = 1; topCard = hand.find(c => c.r === '3'); }
    if (seq) {
      const order = seq === 1 ? ['A', '2', '3'] : [v[0], v[1], v[2]].map(C.rankLabel);
      return { cls: 2, name: 'Liêng', desc: 'Liêng ' + order.join('-'), points: null, score: 2e6 + seq * 10 + C.SUIT_RANK[topCard.s] };
    }
    const big = biggest(hand);
    if (hand.every(c => FACE.includes(c.r))) return { cls: 1, name: 'Ảnh', desc: 'Ảnh (' + C.name(big) + ')', points: null, score: 1e6 + cardKey(big) };
    const p = hand.reduce((a, c) => a + pts(c.r), 0) % 10;
    return { cls: 0, name: p + ' điểm', desc: p + ' điểm (lá to ' + C.name(big) + ')', points: p, score: p * 1000 + cardKey(big) };
  }
  const compare = (a, b) => evaluate(a).score - evaluate(b).score;

  // ---------------------------------------------------------------- hand strength table (for bots)
  let TABLE = null;
  function strengthTable() {
    if (TABLE) return TABLE;
    const d = C.deck(), s = [];
    for (let i = 0; i < 52; i++) for (let j = i + 1; j < 52; j++) for (let k = j + 1; k < 52; k++) s.push(evaluate([d[i], d[j], d[k]]).score);
    s.sort((a, b) => a - b); TABLE = s; return s;
  }
  /** Fraction of all 22 100 three-card hands this hand beats (0..1). */
  function percentile(hand) {
    const s = strengthTable(), x = evaluate(hand).score; let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < x) lo = m + 1; else hi = m; }
    return lo / (s.length - 1);
  }

  /** Bot decision. o: {hand, legal (from C.legal), pot, nOpp, ante, unit, pers:{loose, aggr, bluff}}. Returns {type, to?}. */
  function botDecide(o, rng = Math.random) {
    const L = o.legal, pers = o.pers || { loose: .5, aggr: .5, bluff: .07 };
    const pct = percentile(o.hand);
    const win = Math.pow(pct, Math.max(1, o.nOpp) * 0.85) + (rng() - .5) * .1 + (pers.loose - .5) * .12;
    const odds = L.toCall / Math.max(1, o.pot + L.toCall);
    const unit = o.unit || 1000;
    const raiseTo = f => C.roundTo(L.currentBet + Math.max(o.ante || unit, f * (o.pot + L.toCall)), unit, L.raise.min, L.raise.max);
    const strong = win > .62 - .12 * pers.aggr, monster = pct > .97;
    if (L.raise && (monster || (strong && rng() < .45 + .45 * pers.aggr))) {
      const to = raiseTo(.4 + rng() * .6);
      return to >= L.raise.max * .8 ? { type: 'allin' } : { type: 'raise', to };
    }
    if (L.raise && L.toCall <= (o.ante || unit) * 2 && rng() < pers.bluff) return { type: 'raise', to: raiseTo(.35 + rng() * .3), bluff: true };
    if (L.toCall === 0) return { type: 'check' };
    const commit = L.toCall >= L.stack * .5 ? .12 : 0;
    if (win >= odds + .03 + commit || (L.toCall <= (o.ante || unit) && win > .18)) return { type: 'call' };
    return { type: 'fold' };
  }
  const PERSONAS = [{ loose: .35, aggr: .35, bluff: .03 }, { loose: .55, aggr: .7, bluff: .1 }, { loose: .7, aggr: .45, bluff: .08 }, { loose: .45, aggr: .55, bluff: .06 }];

  /** Showdown: given the betting table state and everyone's hand, pay the pots (side pots included). order = odd-chip order. */
  function showdown(st, hands, order) {
    const sc = hands.map(h => (h ? evaluate(h).score : -1));
    return C.award(st.players, C.pots(st.players), (i, j) => sc[i] - sc[j], order);
  }
  return { FACE, CLS, pts, cardKey, biggest, evaluate, compare, percentile, botDecide, PERSONAS, showdown, RAISE_CAP: 3 };
});
