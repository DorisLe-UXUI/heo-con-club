/* Tài Xỉu rules (pure, no DOM). Three dice (values 1..6) are shaken under a bowl.
 * Zones: TÀI (sum 11–17) and XỈU (sum 4–10) pay 1:1 but both lose on any triple ("bão");
 * BÃO (any triple) pays 1:24; a sum zone N (4..17) pays SUM_ODDS[N] whenever the dice add up to N (triples included).
 * Payouts are "1 ăn N": a winning stake is returned plus stake × odds. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['tai-xiu'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SUM_ODDS = { 4: 50, 5: 18, 6: 14, 7: 12, 8: 8, 9: 6, 10: 6, 11: 6, 12: 6, 13: 8, 14: 12, 15: 14, 16: 18, 17: 50 };
  const ZONES = [
    { id: 'tai', name: 'Tài', odds: 1 },
    { id: 'xiu', name: 'Xỉu', odds: 1 },
    { id: 'bao', name: 'Bão', odds: 24 },
  ];
  for (let s = 4; s <= 17; s++) ZONES.push({ id: 's' + s, name: 'Tổng ' + s, odds: SUM_ODDS[s], sum: s });
  const BY_ID = {}; ZONES.forEach(z => { BY_ID[z.id] = z; });
  const zone = id => { const z = BY_ID[id]; if (!z) throw new Error('unknown zone ' + id); return z; };

  function check(dice) { if (!Array.isArray(dice) || dice.length !== 3 || dice.some(d => !(d >= 1 && d <= 6 && d % 1 === 0))) throw new Error('need 3 dice 1..6: ' + dice); return dice; }
  /** Roll three dice. rng() → [0,1). */
  function roll(rng = Math.random) { return [0, 1, 2].map(() => 1 + Math.floor(rng() * 6)); }
  const sum = dice => check(dice).reduce((a, b) => a + b, 0);
  const isTriple = dice => { check(dice); return dice[0] === dice[1] && dice[1] === dice[2]; };
  function wins(id, dice) {
    const z = zone(id), s = sum(dice), t = isTriple(dice);
    if (id === 'tai') return !t && s >= 11 && s <= 17;
    if (id === 'xiu') return !t && s >= 4 && s <= 10;
    if (id === 'bao') return t;
    return s === z.sum;
  }
  /** Coins handed back for one stake on one zone (0 when it loses). */
  function payout(id, stake, dice) {
    if (!(stake >= 0) || stake % 1) throw new Error('bad stake ' + stake);
    return wins(id, dice) ? stake * (1 + zone(id).odds) : 0;
  }
  /** Settle bets { zoneId: stake }. → { staked, back, net, per: { zoneId: back } } */
  function settle(bets, dice) {
    let staked = 0, back = 0; const per = {};
    for (const [id, stake] of Object.entries(bets || {})) { if (!stake) continue; staked += stake; per[id] = payout(id, stake, dice); back += per[id]; }
    return { staked, back, net: back - staked, per };
  }
  /** What the table shouts: { kind: 'tai'|'xiu'|'bao', sum, label: 'TÀI 14' | 'XỈU 7' | 'BÃO!' } */
  function verdict(dice) {
    const s = sum(dice);
    if (isTriple(dice)) return { kind: 'bao', sum: s, label: 'BÃO!' };
    return s >= 11 ? { kind: 'tai', sum: s, label: 'TÀI ' + s } : { kind: 'xiu', sum: s, label: 'XỈU ' + s };
  }
  /** All 216 outcomes (for exact probabilities). */
  const ALL = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) ALL.push([a, b, c]);
  const probability = id => ALL.filter(d => wins(id, d)).length / 216;
  const expectedReturn = id => probability(id) * (1 + zone(id).odds);
  /** Dice for a wanted sum (3..18), e.g. to force a demo result. */
  function diceFor(total, triple) {
    if (triple) { if (total % 3 || total < 3 || total > 18) throw new Error('no triple sums to ' + total); return [total / 3, total / 3, total / 3]; }
    const d = ALL.find(x => x[0] + x[1] + x[2] === total && !(x[0] === x[1] && x[1] === x[2]));
    if (!d) throw new Error('no dice sum to ' + total); return d.slice();
  }

  /** Bead road (same layout as Xóc Đĩa): top→bottom, left→right; whole old columns scroll off. */
  function road(results, rows = 6, cols = 8) {
    const n = results.length, colCount = Math.ceil(n / rows), first = Math.max(0, colCount - cols), start = first * rows, out = [];
    for (let i = start; i < n; i++) { const c = Math.floor((i - start) / rows); (out[c] = out[c] || []).push(results[i]); }
    return { start, cols: out };
  }
  function streak(kinds) { if (!kinds.length) return { side: null, len: 0 }; const side = kinds[kinds.length - 1]; let len = 0; for (let i = kinds.length - 1; i >= 0 && kinds[i] === side; i--) len++; return { side, len }; }

  /** How a bot bets. style: 'careful' | 'trend' | 'wild'; history: ['tai'|'xiu'|'bao', …]. → [{ zone, amount }] */
  function botPlan(rng, style, history, chips = [1000, 5000, 10000, 50000], budget = Infinity) {
    const pick = a => a[Math.floor(rng() * a.length)], out = [];
    const add = (z, a) => { if (a <= budget) { out.push({ zone: z, amount: a }); budget -= a; } };
    const tx = history.filter(k => k !== 'bao'), st = streak(tx), last6 = tx.slice(-6), nTai = last6.filter(k => k === 'tai').length;
    const small = chips.slice(0, 2), mid = chips.slice(1, 3), big = chips.slice(-2);
    if (style === 'careful') {
      add(nTai >= last6.length / 2 ? 'tai' : 'xiu', pick(small));
    } else if (style === 'trend') {
      const side = st.len >= 2 ? st.side : st.side ? (st.side === 'tai' ? 'xiu' : 'tai') : (rng() < .5 ? 'tai' : 'xiu');
      add(side, pick(mid));
      if (rng() < .45) add('s' + (side === 'tai' ? pick([11, 12, 13, 14]) : pick([7, 8, 9, 10])), chips[0]);
    } else {
      add(rng() < .5 ? 'tai' : 'xiu', pick(big));
      if (rng() < .5) add('bao', pick(small));
      const n = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) add('s' + (4 + Math.floor(rng() * 14)), small[0]);
    }
    return out;
  }
  return { SUM_ODDS, ZONES, zone, roll, sum, isTriple, wins, payout, settle, verdict, probability, expectedReturn, diceFor, road, streak, botPlan, ALL };
});
