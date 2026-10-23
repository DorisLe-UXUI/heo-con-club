/* Texas Hold'em No-Limit rules — pure, no DOM. Best 5 of 7 evaluator with Vietnamese names, a fast numeric scorer
 * for Monte-Carlo equity, preflop (Chen) strength, button/blind helpers and a bot strategy.
 * Betting (blinds, raises, all-ins, side pots) lives in cards-common.js.
 * Categories: 8 Thùng phá sảnh, 7 Tứ quý, 6 Cù lũ, 5 Thùng, 4 Sảnh, 3 Sám cô, 2 Thú, 1 Đôi, 0 Mậu thầu.
 * Suits never break ties; equal hands split the pot (odd coins to the first winner left of the button). */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(require('./cards-common.js')); else (root.Rules = root.Rules || {})['poker'] = f(root.Rules['cards-common']); })(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const CAT = ['Mậu thầu', 'Đôi', 'Thú', 'Sám cô', 'Sảnh', 'Thùng', 'Cù lũ', 'Tứ quý', 'Thùng phá sảnh'];
  const v = C.hi, L = C.rankLabel;
  /** Highest straight in a rank bitmask (bit r for r = 2..14; the ace also plays low). 0 if none. */
  function straightHigh(mask) {
    if (mask & (1 << 14)) mask |= 1 << 1;
    for (let h = 14; h >= 5; h--) { const need = 0x1f << (h - 4); if ((mask & need) === need) return h; }
    return 0;
  }
  function pack(cat, ranks) { let s = cat; for (let i = 0; i < 5; i++) s = s * 15 + (ranks[i] || 0); return s; }
  const sortD = arr => arr.slice().sort((a, b) => v(b.r) - v(a.r) || C.SUIT_RANK[b.s] - C.SUIT_RANK[a.s]);
  function run(sorted, h) { const out = []; for (let r = h; r > h - 5; r--) { const rr = r === 1 ? 14 : r; out.push(sorted.find(c => v(c.r) === rr)); } return out; }
  /** Evaluate 1..7 cards → {cat, name, desc, score, best (up to 5 cards that make the hand), ranks}. Bigger score wins. */
  function evaluate(cards) {
    const byR = {}, byS = {};
    for (const c of cards) { (byR[v(c.r)] = byR[v(c.r)] || []).push(c); (byS[c.s] = byS[c.s] || []).push(c); }
    const mk = (cat, ranks, best, desc) => ({ cat, name: CAT[cat], desc, score: pack(cat, ranks), best, ranks });
    const kick = (excl, k) => sortD(cards.filter(c => !excl.includes(c))).slice(0, k);
    let flush = null;
    for (const s in byS) if (byS[s].length >= 5) flush = sortD(byS[s]);
    if (flush) {
      let m = 0; for (const c of flush) m |= 1 << v(c.r);
      const h = straightHigh(m);
      if (h) return mk(8, [h], run(flush, h), h === 14 ? 'Thùng phá sảnh lớn (A)' : 'Thùng phá sảnh tới ' + L(h));
    }
    const g = Object.keys(byR).map(Number).map(r => ({ r, cs: byR[r] })).sort((a, b) => b.cs.length - a.cs.length || b.r - a.r);
    const n0 = g[0] ? g[0].cs.length : 0, n1 = g[1] ? g[1].cs.length : 0;
    if (n0 === 4) { const k = kick(g[0].cs, 1); return mk(7, [g[0].r, k[0] ? v(k[0].r) : 0], [...g[0].cs, ...k], 'Tứ quý ' + L(g[0].r)); }
    if (n0 === 3 && n1 >= 2) { const p = sortD(g[1].cs).slice(0, 2); return mk(6, [g[0].r, g[1].r], [...g[0].cs, ...p], 'Cù lũ ' + L(g[0].r) + ' – ' + L(g[1].r)); }
    if (flush) { const b = flush.slice(0, 5); return mk(5, b.map(c => v(c.r)), b, 'Thùng ' + C.SUIT_SYM[b[0].s] + ' ' + L(v(b[0].r))); }
    let m = 0; for (const c of cards) m |= 1 << v(c.r);
    const h = straightHigh(m);
    if (h && cards.length >= 5) return mk(4, [h], run(sortD(cards), h), 'Sảnh tới ' + L(h));
    if (n0 === 3) { const k = kick(g[0].cs, 2); return mk(3, [g[0].r, ...k.map(c => v(c.r))], [...g[0].cs, ...k], 'Sám cô ' + L(g[0].r)); }
    if (n0 === 2 && n1 === 2) { const p = [...g[0].cs, ...g[1].cs], k = kick(p, 1); return mk(2, [g[0].r, g[1].r, k[0] ? v(k[0].r) : 0], [...p, ...k], 'Thú ' + L(g[0].r) + ' – ' + L(g[1].r)); }
    if (n0 === 2) { const k = kick(g[0].cs, 3); return mk(1, [g[0].r, ...k.map(c => v(c.r))], [...g[0].cs, ...k], 'Đôi ' + L(g[0].r)); }
    const b = sortD(cards).slice(0, 5); return mk(0, b.map(c => v(c.r)), b, 'Mậu thầu ' + L(v(b[0].r)));
  }
  /** Brute force: best 5-card subset (used by tests to check evaluate()). */
  function bestOf(cards) {
    let best = null; const n = cards.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const r = evaluate([cards[a], cards[b], cards[c], cards[d], cards[e]]); if (!best || r.score > best.score) best = r;
    }
    return best;
  }
  // ---------------------------------------------------------------- fast numeric scorer (codes = rank*4 + suit)
  const SUIT_I = { spades: 0, clubs: 1, diamonds: 2, hearts: 3 };
  const code = c => v(c.r) * 4 + SUIT_I[c.s];
  const RC = new Int32Array(15), SC = new Int32Array(4), SM = new Int32Array(4);
  /** Append the highest set ranks of `mask` to `out` until it holds k ranks. */
  function topBits(mask, k, out) { for (let r = 14; r >= 2 && out.length < k; r--) if (mask & (1 << r)) out.push(r); return out; }
  /** Same score as evaluate(cards).score, much faster. cs: array of codes, n: how many to use. */
  function fastScore(cs, n) {
    RC.fill(0); SC.fill(0); SM.fill(0); let mask = 0;
    for (let i = 0; i < n; i++) { const c = cs[i], r = c >> 2, s = c & 3; RC[r]++; SC[s]++; SM[s] |= 1 << r; mask |= 1 << r; }
    let fm = 0;
    for (let s = 0; s < 4; s++) if (SC[s] >= 5) { const h = straightHigh(SM[s]); if (h) return pack(8, [h]); fm = SM[s]; }
    let q = 0, t1 = 0, t2 = 0, p1 = 0, p2 = 0;
    for (let r = 14; r >= 2; r--) { const k = RC[r]; if (k === 4) q = r; else if (k === 3) { if (!t1) t1 = r; else if (!t2) t2 = r; } else if (k === 2) { if (!p1) p1 = r; else if (!p2) p2 = r; } }
    if (q) return pack(7, [q, topBits(mask & ~(1 << q), 1, [])[0] || 0]);
    if (t1 && (t2 || p1)) return pack(6, [t1, Math.max(t2, p1)]);
    if (fm) return pack(5, topBits(fm, 5, []));
    const h = n >= 5 ? straightHigh(mask) : 0; if (h) return pack(4, [h]);
    if (t1) return pack(3, topBits(mask & ~(1 << t1), 3, [t1]));
    if (p1 && p2) return pack(2, topBits(mask & ~(1 << p1) & ~(1 << p2), 3, [p1, p2]));
    if (p1) return pack(1, topBits(mask & ~(1 << p1), 4, [p1]));
    return pack(0, topBits(mask, 5, []));
  }
  const catOf = score => Math.floor(score / 759375);   // 15^5
  /** Monte-Carlo share of the pot vs nOpp random hands (ties count fractionally). */
  function equity(hole, board, nOpp, sims = 150, rng = Math.random) {
    const used = new Set([...hole, ...board].map(c => c.key));
    const rest = C.deck().filter(c => !used.has(c.key)).map(code), me = [...hole, ...board].map(code);
    const needB = 5 - board.length, need = needB + 2 * nOpp, cs = new Array(7), os = new Array(7);
    let tot = 0;
    for (let s = 0; s < sims; s++) {
      for (let k = 0; k < need; k++) { const j = k + Math.floor(rng() * (rest.length - k)); const t = rest[k]; rest[k] = rest[j]; rest[j] = t; }
      for (let i = 0; i < me.length; i++) cs[i] = me[i];
      for (let i = 0; i < needB; i++) cs[me.length + i] = rest[i];
      const my = fastScore(cs, 7);
      for (let i = 2; i < 7; i++) os[i] = cs[i];
      let best = 0, ties = 0;
      for (let o = 0; o < nOpp; o++) { os[0] = rest[needB + 2 * o]; os[1] = rest[needB + 2 * o + 1]; const sc = fastScore(os, 7); if (sc > best) { best = sc; ties = 0; } if (sc === my) ties++; }
      if (my > best) tot += 1; else if (my === best) tot += 1 / (ties + 1);
    }
    return tot / sims;
  }
  /** Chen formula for two hole cards (-1..20). */
  function chen(h) {
    const [a, b] = h.map(c => v(c.r)).sort((x, y) => y - x);
    const p = r => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
    if (a === b) return Math.max(5, p(a) * 2);
    let s = p(a); if (h[0].s === h[1].s) s += 2;
    const gap = a - b - 1; s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
    if (gap <= 1 && a < 12) s += 1;
    return Math.ceil(s);
  }
  /** Rough preflop equity vs nOpp opponents from the Chen score. */
  function preflopEquity(hole, nOpp) { const hu = Math.min(.86, .3 + .56 * (chen(hole) + 1) / 21); return Math.pow(hu, Math.pow(Math.max(1, nOpp), .78)); }

  // ---------------------------------------------------------------- table helpers
  /** Next seat after `i` that is still in the game (has chips). */
  function nextSeat(active, i) { const n = active.length; for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (active[j]) return j; } return -1; }
  /** Button, small blind, big blind and first actors for a hand. Heads-up: the button posts the small blind and acts first preflop. */
  function positions(active, button) {
    const btn = active[button] ? button : nextSeat(active, button);
    const count = active.filter(Boolean).length;
    const sb = count === 2 ? btn : nextSeat(active, btn), bb = nextSeat(active, sb);
    return { button: btn, sb, bb, firstPre: nextSeat(active, bb), firstPost: nextSeat(active, btn) };
  }

  // ---------------------------------------------------------------- bot strategy
  const PERSONAS = [{ loose: .35, aggr: .4, bluff: .04, tag: 'chặt' }, { loose: .6, aggr: .7, bluff: .09, tag: 'máu' }, { loose: .7, aggr: .35, bluff: .05, tag: 'lì' }, { loose: .5, aggr: .55, bluff: .07, tag: 'cân bằng' }];
  /** How much a bot misjudges its equity, by strength level 0 (dễ) … 3 (siêu khó); no level = the original ±5%. */
  const NOISE = [.36, .18, .1, .05];
  /** o: {hole, board, legal (C.legal), pot (all chips in the middle incl. current bets), nOpp, bb, unit, street 0..3, pers, sims, level}. → {type, to?, eq}. */
  function botDecide(o, rng = Math.random) {
    const Lg = o.legal, pers = o.pers || PERSONAS[3], unit = o.unit || 1;
    const eq0 = o.board.length ? equity(o.hole, o.board, Math.max(1, o.nOpp), o.sims || 150, rng) : preflopEquity(o.hole, o.nOpp);
    const e = eq0 + (rng() - .5) * (o.level == null ? .1 : NOISE[Math.max(0, Math.min(3, o.level))]) + (pers.loose - .5) * .08;
    const potAfter = o.pot + Lg.toCall, odds = Lg.toCall / Math.max(1, potAfter);
    const raiseTo = f => C.roundTo(Lg.currentBet + Math.max(o.bb, f * potAfter), unit, Lg.raise.min, Lg.raise.max);
    const share = 1 / (Math.max(1, o.nOpp) + 1);           // fair share of the pot
    const strong = e > Math.max(.5, share * 1.9) - .08 * pers.aggr;
    const pre = !o.board.length, ch = pre ? chen(o.hole) : 0;
    const big = pre ? ch >= 10 || (ch >= 8 && Lg.toCall <= o.bb && rng() < .4 + .4 * pers.aggr) : e > .8;
    if (Lg.raise && (big || strong) && rng() < .35 + .5 * pers.aggr) {
      const to = pre ? C.roundTo(Lg.currentBet + Math.max(o.bb * 2, Lg.currentBet * 2), unit, Lg.raise.min, Lg.raise.max) : raiseTo(.5 + rng() * .5);
      return { type: to >= Lg.raise.max * .7 ? 'allin' : 'raise', to, eq: eq0 };
    }
    if (Lg.toCall === 0) {
      if (!pre && Lg.raise && e > Math.max(.4, share * 1.5) && rng() < .3 + .4 * pers.aggr) return { type: 'raise', to: raiseTo(.45 + rng() * .3), eq: eq0 };
      if (Lg.raise && rng() < pers.bluff * (pre ? .5 : 1.3)) return { type: 'raise', to: raiseTo(.4 + rng() * .3), eq: eq0, bluff: true };
      return { type: 'check', eq: eq0 };
    }
    const commit = Lg.toCall >= Lg.stack * .45 ? .1 : 0;
    const cheap = Lg.toCall <= o.bb && e > share * .8;
    if (e >= odds + .04 + commit || cheap) return { type: 'call', eq: eq0 };
    if (Lg.raise && Lg.toCall <= o.bb * 3 && rng() < pers.bluff * .5) return { type: 'raise', to: raiseTo(.6), eq: eq0, bluff: true };
    return { type: 'fold', eq: eq0 };
  }
  /** Showdown: pay the pots from the betting state and 7-card hands (hands[i] = hole + board, null if folded). */
  function showdown(st, hands, order) {
    const sc = hands.map(h => (h ? evaluate(h).score : -1));
    return C.award(st.players, C.pots(st.players), (i, j) => sc[i] - sc[j], order);
  }
  return { CAT, straightHigh, evaluate, bestOf, fastScore, code, catOf, equity, chen, preflopEquity, nextSeat, positions, botDecide, PERSONAS, NOISE, showdown };
});
