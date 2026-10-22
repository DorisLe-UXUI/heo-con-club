/* Xóc Đĩa rules (pure, no DOM). Four two-sided coins (red / white) are shaken under a bowl.
 * A result is an array of 4 booleans (true = red face up); what matters is how many reds show (0..4).
 * Payouts are "1 ăn N": a winning stake is returned plus stake × odds. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['xoc-dia'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ZONES = [
    { id: 'chan', name: 'Chẵn', odds: 1, reds: [0, 2, 4] },
    { id: 'le', name: 'Lẻ', odds: 1, reds: [1, 3] },
    { id: 'r4', name: '4 Đỏ', odds: 12, reds: [4] },
    { id: 'w4', name: '4 Trắng', odds: 12, reds: [0] },
    { id: 'r3', name: '3 Đỏ 1 Trắng', odds: 3, reds: [3] },
    { id: 'w3', name: '3 Trắng 1 Đỏ', odds: 3, reds: [1] },
  ];
  const BY_ID = {}; ZONES.forEach(z => { BY_ID[z.id] = z; });
  const zone = id => { const z = BY_ID[id]; if (!z) throw new Error('unknown zone ' + id); return z; };

  /** Shake the four coins. rng() → [0,1). */
  function toss(rng = Math.random) { return [0, 1, 2, 3].map(() => rng() < .5); }
  /** Number of red faces up. Accepts the coin array or a number 0..4. */
  function reds(coins) {
    if (typeof coins === 'number') { if (!(coins >= 0 && coins <= 4 && coins % 1 === 0)) throw new Error('bad red count ' + coins); return coins; }
    if (!Array.isArray(coins) || coins.length !== 4) throw new Error('need 4 coins');
    return coins.filter(Boolean).length;
  }
  /** A coin layout (4 booleans, reds first) for a red count — handy to force a result. */
  function coinsFor(nRed) { reds(nRed); return [0, 1, 2, 3].map(i => i < nRed); }
  const parity = coins => (reds(coins) % 2 ? 'le' : 'chan');
  const wins = (id, coins) => zone(id).reds.includes(reds(coins));
  /** Coins handed back for one stake on one zone (0 when it loses). */
  function payout(id, stake, coins) {
    if (!(stake >= 0) || stake % 1) throw new Error('bad stake ' + stake);
    return wins(id, coins) ? stake * (1 + zone(id).odds) : 0;
  }
  /** Settle a set of bets { zoneId: stake }. → { staked, back, net, per: { zoneId: back } } */
  function settle(bets, coins) {
    let staked = 0, back = 0; const per = {};
    for (const [id, stake] of Object.entries(bets || {})) { if (!stake) continue; staked += stake; per[id] = payout(id, stake, coins); back += per[id]; }
    return { staked, back, net: back - staked, per };
  }
  /** Short Vietnamese description of a result, e.g. "2 Đỏ 2 Trắng". */
  function describe(coins) { const r = reds(coins); return r === 4 ? '4 Đỏ' : r === 0 ? '4 Trắng' : `${r} Đỏ ${4 - r} Trắng`; }
  /** Exact probability that a zone wins (fair coins). */
  function probability(id) { const C = [1, 4, 6, 4, 1]; return zone(id).reds.reduce((a, r) => a + C[r], 0) / 16; }
  /** Expected return per 1 coin staked (1 = break even). */
  const expectedReturn = id => probability(id) * (1 + zone(id).odds);

  /** Bead road: results ('chan'|'le') laid top→bottom, then left→right, `rows` per column, at most `cols` columns
   *  (older columns scroll off whole). → { start, cols: [[result…]…] } */
  function road(results, rows = 6, cols = 8) {
    const n = results.length, colCount = Math.ceil(n / rows), first = Math.max(0, colCount - cols), start = first * rows, out = [];
    for (let i = start; i < n; i++) { const c = Math.floor((i - start) / rows); (out[c] = out[c] || []).push(results[i]); }
    return { start, cols: out };
  }
  /** Current streak at the end of the history. → { side, len } */
  function streak(results) { if (!results.length) return { side: null, len: 0 }; const side = results[results.length - 1]; let len = 0; for (let i = results.length - 1; i >= 0 && results[i] === side; i--) len++; return { side, len }; }

  /**
   * How a bot bets this round. style: 'careful' | 'trend' | 'wild'. history: ['chan'|'le', …]. chips: allowed chip values (ascending).
   * Returns [{ zone, amount }] (amounts are chip values, never more than `budget`).
   */
  function botPlan(rng, style, history, chips = [1000, 5000, 10000, 50000], budget = Infinity) {
    const pick = a => a[Math.floor(rng() * a.length)], out = [];
    const add = (z, a) => { if (a <= budget) { out.push({ zone: z, amount: a }); budget -= a; } };
    const last6 = history.slice(-6), nChan = last6.filter(x => x === 'chan').length;
    const st = streak(history), other = s => (s === 'chan' ? 'le' : 'chan');
    const small = chips.slice(0, 2), mid = chips.slice(1, 3), big = chips.slice(-2);
    if (style === 'careful') {
      add(nChan >= last6.length / 2 ? 'chan' : 'le', pick(small));
      if (rng() < .25) add(rng() < .5 ? 'r3' : 'w3', chips[0]);
    } else if (style === 'trend') {
      // ride a streak ("cầu bệt"), otherwise expect the 1-1 zigzag ("cầu 1-1")
      const side = st.len >= 2 ? st.side : st.side ? other(st.side) : (rng() < .5 ? 'chan' : 'le');
      add(side, pick(mid));
      if (rng() < .4) add(side === 'chan' ? pick(['r4', 'w4']) : pick(['r3', 'w3']), chips[0]);
    } else {
      add(rng() < .5 ? 'chan' : 'le', pick(big));
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) add(pick(['r4', 'w4', 'r3', 'w3']), pick(small));
    }
    return out;
  }
  return { ZONES, zone, toss, reds, coinsFor, parity, wins, payout, settle, describe, probability, expectedReturn, road, streak, botPlan };
});
