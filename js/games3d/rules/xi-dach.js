/* Xì Dách rules (pure, no DOM). Cards are {r:'A'|'2'..'10'|'J'|'Q'|'K', s}. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['xi-dach'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const pts = r => (r === 'A' ? 1 : ['J', 'Q', 'K'].includes(r) ? 10 : +r);
  /** Best total: aces count 11 (or 10 when the hand has 3+ cards… kept simple: 11 if it fits, else 1). */
  function total(hand) { let t = 0, a = 0; for (const c of hand) { t += pts(c.r); if (c.r === 'A') a++; } while (a-- > 0 && t + 10 <= 21) t += 10; return t; }
  /** Hand class: 4 xì bàng, 3 xì dách, 2 ngũ linh, 1 normal ≤21, 0 quắc (bust). score orders hands of the same class. */
  function kind(hand) {
    const n = hand.length, t = total(hand);
    if (n === 2 && hand.every(c => c.r === 'A')) return { cls: 4, name: 'Xì Bàng', total: 21, mult: 2 };
    if (n === 2 && hand.some(c => c.r === 'A') && hand.some(c => ['10', 'J', 'Q', 'K'].includes(c.r))) return { cls: 3, name: 'Xì Dách', total: 21, mult: 1.5 };
    if (t > 21) return { cls: 0, name: 'Quắc', total: t, mult: 1 };
    if (n >= 5) return { cls: 2, name: 'Ngũ Linh', total: t, mult: 2 };
    return { cls: 1, name: t + ' điểm', total: t, mult: 1 };
  }
  /** Player result vs dealer in bet units: >0 win, <0 lose, 0 draw. A player standing under 16 ("non") loses unless the dealer busts… we never let the player stand under 16. */
  function settle(player, dealer) {
    const p = kind(player), d = kind(dealer);
    if (p.cls === 0 && d.cls === 0) return 0;                 // both bust: draw
    if (p.cls === 0) return -1;
    if (d.cls === 0) return p.mult;
    if (p.cls !== d.cls) return p.cls > d.cls ? p.mult : -d.mult;
    if (p.cls === 2) return p.total < d.total ? 2 : p.total > d.total ? -2 : 0;   // ngũ linh: smaller wins
    if (p.cls === 1) return p.total > d.total ? 1 : p.total < d.total ? -1 : 0;
    return 0;
  }
  /** Simple strategy for bots and the dealer. */
  function shouldHit(hand, isDealer) { const k = kind(hand); if (k.cls >= 2 || k.cls === 0) return false; const t = k.total; if (hand.length >= 5) return false; return t < (isDealer ? 16 : 16) || (t === 16 && Math.random() < .35) || (t === 17 && hand.length === 4 && Math.random() < .3); }
  return { total, kind, settle, shouldHit, pts };
});
