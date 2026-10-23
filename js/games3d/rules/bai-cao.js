/* Bài Cào (Ba Cây) rules — pure, no DOM. Three cards each, bettors play against the dealer (nhà cái).
 *  - Score = sum of the cards mod 10 (A = 1, 2..9 face value, 10/J/Q/K = 10). 0 is called "Bù".
 *  - "Ba Tây": three picture cards (J/Q/K) beats any score.
 *  - Equal scores (or two Ba Tây): the hand holding the biggest single card wins. A card's strength is its suit first
 *    (♦ rô > ♥ cơ > ♠ bích > ♣ chuồn), then its rank (A > K > Q > J > 10 > … > 2). Cards are unique, so there is never a draw.
 *  - Payout vs the dealer: win 1:1, a winning Ba Tây pays 1:2. A losing bettor only loses the stake. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(require('./cards-common.js')); else (root.Rules = root.Rules || {})['bai-cao'] = f(root.Rules['cards-common']); })(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const FACE = ['J', 'Q', 'K'];
  /** Points of one card: A=1, 2..9, 10/J/Q/K = 10 (≡ 0). */
  const pts = r => (r === 'A' ? 1 : r === '10' || FACE.includes(r) ? 10 : +r);
  /** Strength of a single card for tie-breaks: suit first, then rank (A high). */
  const power = c => C.SUIT_RANK[c.s] * 20 + C.hi(c.r);
  function topCard(hand) { return hand.reduce((a, c) => (power(c) > power(a) ? c : a)); }
  /** Evaluate a 3-card hand → {baTay, points, top, key, name}. key orders hands totally (bigger wins). */
  function score(hand) {
    if (hand.length !== 3) throw new Error('bài cào needs 3 cards');
    const baTay = hand.every(c => FACE.includes(c.r));
    const points = hand.reduce((a, c) => a + pts(c.r), 0) % 10;
    const top = topCard(hand);
    const key = (baTay ? 10 : points) * 1000 + power(top);
    return { baTay, points, top, key, name: baTay ? 'Ba Tây' : points === 0 ? 'Bù' : points + ' nút' };
  }
  /** >0 when hand a beats hand b. */
  function compare(a, b) { return score(a).key - score(b).key; }
  /** Bettor vs dealer in stake units: +2 (won with Ba Tây), +1 (won), -1 (lost). */
  function settle(player, dealer) { const p = score(player), d = score(dealer); return p.key > d.key ? (p.baTay ? 2 : 1) : -1; }
  /** Coins handed back to a bettor who staked `bet` (the stake was already taken): stake + winnings, or 0. */
  const payout = (bet, mult) => (mult > 0 ? bet + bet * mult : 0);
  /** Net result for every bettor + the dealer. bets[i] is 0 for the dealer seat. Returns {mult[], net[], dealerNet}. Sum of nets is 0. */
  function settleTable(hands, bets, dealer) {
    const mult = hands.map((h, i) => (i === dealer ? 0 : settle(h, hands[dealer])));
    const net = mult.map((m, i) => (i === dealer ? 0 : m > 0 ? bets[i] * m : -bets[i]));
    const dealerNet = -net.reduce((a, b) => a + b, 0); net[dealer] = dealerNet;
    return { mult, net, dealerNet };
  }
  /** Bot stake: a few sensible levels, never more than ~8% of its coins. */
  function botBet(coins, rng = Math.random) {
    const lv = [5000, 10000, 20000, 50000, 100000].filter(v => v <= Math.max(5000, coins * 0.08));
    return lv[Math.floor(rng() * lv.length)];
  }
  /** Small talk for a revealed hand. */
  function quip(s, rng = Math.random) {
    const pick = a => a[Math.floor(rng() * a.length)];
    if (s.baTay) return pick(['Ba Tây nè! 😎', 'Ba Tây ăn hết! 👑', 'Tây tây tây! 🤩']);
    if (s.points === 9) return pick(['9 nút! 😆', 'Chín nút, ngon!', 'Nút to nhất 💪']);
    if (s.points >= 7) return pick([s.points + ' nút, cũng được 😏', 'Ổn áp ' + s.points + ' nút']);
    if (s.points === 0) return pick(['Bù rồi 😭', 'Bù sạch trơn…', 'Hic, bù 🥲']);
    return pick([s.points + ' nút thôi 😅', 'Hên xui ' + s.points + ' nút', 'Mong nhà cái thấp hơn 🙏']);
  }
  /** Who holds the bank next. withYou = chế độ "Xoay cái": the bank goes round all `n` seats (seat 0 is you); otherwise it
   *  only goes round the bots (seats 1..n-1). */
  function nextDealer(cur, n, withYou) { if (withYou) return (cur + 1) % n; const x = cur % (n - 1) + 1; return x >= n ? 1 : x; }
  /** You hold the bank: a winning Ba Tây takes 2× its stake, so shrink bot bets (to a lower allowed level, else 0) until the bank covers all of them. */
  function capBets(bets, bank, levels) {
    const out = bets.slice(), lv = levels.slice().sort((a, b) => a - b);
    for (let guard = 0; guard < 99 && out.reduce((a, b) => a + b * 2, 0) > bank; guard++) {
      const i = out.indexOf(Math.max(...out)), lower = lv.filter(v => v < out[i]);
      out[i] = lower.length ? lower[lower.length - 1] : 0;
    }
    return out;
  }
  return { FACE, pts, power, topCard, score, compare, settle, payout, settleTable, botBet, quip, nextDealer, capBets };
});
