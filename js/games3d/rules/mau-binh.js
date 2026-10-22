/*
 * Mậu Binh rules + bots (pure, no DOM). UMD: window.Rules['mau-binh'] in the browser, module.exports in Node.
 *
 * Cards are ids 0..51: rank = id >> 2 (0 = '2' … 12 = 'A'), suit = id & 3 (♠ ♣ ♦ ♥).
 *
 * Rule choices (shown to the player in the module's rules text):
 *  - 13 cards each, arranged into chi 1 (5 cards, strongest), chi 2 (5 cards) and chi 3 (3 cards, weakest).
 *  - Poker ranking: Thùng phá sảnh > Tứ quý > Cù lũ > Thùng > Sảnh > Sám cô > Thú > Đôi > Mậu thầu.
 *    Chi 3 only counts Sám cô > Đôi > Mậu thầu. A-2-3-4-5 is the lowest straight, 10-J-Q-K-A the highest.
 *    Suits never break ties: equal chi = draw.
 *  - Must have chi 1 ≥ chi 2 ≥ chi 3, otherwise "Binh lủng": loses 6 units to every valid opponent.
 *  - Against each opponent: ±1 unit per chi won/lost; winning all three ("sập 3 chi") pays double: 6 units.
 *  - "Mậu Binh" hands win at once against normal hands: Sảnh rồng (13 different ranks) 12 units;
 *    6 đôi, 3 thùng (5-5-3 of one suit each), 3 sảnh (5-5-3 straights) 6 units. Two special hands:
 *    Sảnh rồng > 6 đôi > 3 thùng > 3 sảnh, the higher one takes its own value, equal kinds draw.
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['mau-binh'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const SUITS = ['♠', '♣', '♦', '♥'], SUIT_KEYS = ['spades', 'clubs', 'diamonds', 'hearts'];
  const CAT = ['Mậu thầu', 'Đôi', 'Thú', 'Sám cô', 'Sảnh', 'Thùng', 'Cù lũ', 'Tứ quý', 'Thùng phá sảnh'];
  const SPECIAL = { sanh_rong: { label: 'Sảnh rồng', prio: 4, units: 12 }, '6_doi': { label: '6 đôi', prio: 3, units: 6 }, '3_thung': { label: '3 thùng', prio: 2, units: 6 }, '3_sanh': { label: '3 sảnh', prio: 1, units: 6 } };
  const SAP = 6, LUNG = 6;
  const rankOf = id => id >> 2, suitOf = id => id & 3;
  const key = id => SUIT_KEYS[suitOf(id)] + '_' + RANKS[rankOf(id)];
  const label = id => RANKS[rankOf(id)] + SUITS[suitOf(id)];
  const sortIds = ids => [...ids].sort((a, b) => a - b);
  function mulberry32(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffled(rng) { const d = Array.from({ length: 52 }, (_, i) => i); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }

  // ------------------------------------------------------------------ hand evaluation
  // score = cat << 20 | r1 << 16 | r2 << 12 | r3 << 8 | r4 << 4 | r5 with rank values 1 ('2') … 13 ('A'); 0 pads
  // 3-card hands, so 5-card and 3-card chi compare directly (chi 2 vs chi 3).
  const enc = (cat, rs) => { let s = cat; for (let i = 0; i < 5; i++) s = s * 16 + (rs[i] || 0); return s; };
  const catOf = s => Math.floor(s / 1048576), r1Of = s => Math.floor(s / 65536) % 16, r2Of = s => Math.floor(s / 4096) % 16;
  function groups(ids) {
    const c = {}; for (const id of ids) { const r = rankOf(id) + 1; c[r] = (c[r] || 0) + 1; }
    return Object.entries(c).map(([r, n]) => [+r, n]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  }
  /** {score, cat, name} for a 5-card or 3-card chi. */
  function evaluate(ids) {
    const g = groups(ids), n = ids.length, ranks = g.map(x => x[0]);
    let cat, rs;
    if (n === 3) {
      if (g[0][1] === 3) { cat = 3; rs = [ranks[0]]; }
      else if (g[0][1] === 2) { cat = 1; rs = [ranks[0], ranks[1]]; }
      else { cat = 0; rs = ranks; }
    } else {
      const flush = ids.every(id => suitOf(id) === suitOf(ids[0]));
      let straight = 0;
      if (g.length === 5) { if (ranks[0] - ranks[4] === 4) straight = ranks[0]; else if (ranks[0] === 13 && ranks[1] === 4) straight = 4; }
      if (straight && flush) { cat = 8; rs = [straight]; }
      else if (g[0][1] === 4) { cat = 7; rs = ranks; }
      else if (g[0][1] === 3 && g[1][1] === 2) { cat = 6; rs = ranks; }
      else if (flush) { cat = 5; rs = ranks; }
      else if (straight) { cat = 4; rs = [straight]; }
      else if (g[0][1] === 3) { cat = 3; rs = ranks; }
      else if (g[0][1] === 2 && g[1][1] === 2) { cat = 2; rs = ranks; }
      else if (g[0][1] === 2) { cat = 1; rs = ranks; }
      else { cat = 0; rs = ranks; }
    }
    return { score: enc(cat, rs), cat, name: CAT[cat] };
  }
  /** chi = [chi1 (5), chi2 (5), chi3 (3)] → chi1 ≥ chi2 ≥ chi3 ? */
  function isValid(chi) {
    if (!chi || chi.length !== 3 || chi[0].length !== 5 || chi[1].length !== 5 || chi[2].length !== 3) return false;
    const [a, b, c] = chi.map(x => evaluate(x).score);
    return a >= b && b >= c;
  }

  // ------------------------------------------------------------------ special hands ("Mậu Binh" / tới trắng)
  /** Special hand of 13 cards → {kind, label, prio, units, chi (display split)} | null */
  function special(hand) {
    const c = new Array(13).fill(0), bySuit = [[], [], [], []];
    for (const id of hand) { c[rankOf(id)]++; bySuit[suitOf(id)].push(id); }
    const mk = (kind, chi) => Object.assign({ kind }, SPECIAL[kind], { chi: chi || null });
    if (c.every(v => v === 1)) return mk('sanh_rong');
    if (c.reduce((s, v) => s + (v >> 1), 0) >= 6) return mk('6_doi');
    // 3 thùng: assign chi sizes 5,5,3 to suits so that every suit is used up exactly
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let d = 0; d < 4; d++) {
      const need = [0, 0, 0, 0]; need[a] += 5; need[b] += 5; need[d] += 3;
      if (need.every((v, s) => v === bySuit[s].length)) {
        const pool = bySuit.map(x => sortIds(x)), take = (s, n) => pool[s].splice(pool[s].length - n, n);
        return mk('3_thung', [take(a, 5), take(b, 5), take(d, 3)]);
      }
    }
    // 3 sảnh: two 5-card straights + a 3-card straight (rank level), then pick concrete cards
    const runs5 = [], runs3 = [];
    for (let s = -1; s <= 8; s++) runs5.push([0, 1, 2, 3, 4].map(i => (s + i + 13) % 13));   // s = -1 → A-2-3-4-5
    for (let s = -1; s <= 10; s++) runs3.push([0, 1, 2].map(i => (s + i + 13) % 13));
    const fits = (cnt, rs) => rs.every(r => cnt[r] > 0), minus = (cnt, rs) => { const x = cnt.slice(); rs.forEach(r => x[r]--); return x; };
    for (let i = 0; i < runs5.length; i++) {
      if (!fits(c, runs5[i])) continue;
      const c1 = minus(c, runs5[i]);
      for (let j = i; j < runs5.length; j++) {
        if (!fits(c1, runs5[j])) continue;
        const c2 = minus(c1, runs5[j]);
        const r3 = runs3.find(rs => fits(c2, rs) && minus(c2, rs).every(v => v === 0));
        if (!r3) continue;
        const pool = sortIds(hand), pick = rs => rs.map(r => { const k = pool.findIndex(id => rankOf(id) === r); return pool.splice(k, 1)[0]; });
        const A = pick(runs5[i]), B = pick(runs5[j]), C3 = pick(r3);
        const [x, y] = evaluate(A).score >= evaluate(B).score ? [A, B] : [B, A];
        return mk('3_sanh', [x, y, C3]);
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ arrangement search
  // Expected chance that a chi beats the opponent's chi in the same position, by (category, top rank).
  // Generated by iterated self-play (arrange 4700 hands, take each bucket's percentile in that position, repeat 3×).
  // WIN[position][category][top rank '2'..'A'] in percent; chi 3 rows stop at Sám cô.
  let WIN = [
    [[0,0,0,0,0,0,0,0,0,0,0,0,0],
     [0,0,0,0,0,0,0,1,1,1,2,2,3],
     [4,4,4,6,7,8,10,12,14,15,16,17,17],
     [17,17,17,18,18,18,18,18,18,18,18,19,19],
     [19,19,19,19,21,24,26,28,30,32,34,36,39],
     [40,40,40,40,40,40,40,41,42,43,46,51,62],
     [69,71,73,74,76,78,80,82,85,87,89,92,95],
     [96,97,97,97,97,97,98,98,98,98,98,99,99],
     [99,99,99,99,99,99,99,99,100,100,100,100,100]],
    [[0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,2,2,3,4,6,7,10,14,19,25,34,43],
     [48,48,49,50,52,54,56,59,61,63,64,65,67],
     [68,70,71,72,73,74,75,76,77,77,78,78,79],
     [79,79,80,80,82,84,86,87,89,90,91,92,93],
     [93,93,93,93,93,93,94,94,94,95,96,98,99],
     [100,100,100,100,100,100,100,100,100,100,100,100,100],
     [100,100,100,100,100,100,100,100,100,100,100,100,100],
     [100,100,100,100,100,100,100,100,100,100,100,100,100]],
    [[0,0,0,0,0,0,1,2,2,3,5,10,21],
     [30,33,35,38,41,46,52,59,66,74,83,90,96],
     [99,99,99,99,99,99,99,99,99,99,99,99,99],
     [99,100,100,100,100,100,100,100,100,100,100,100,100]]];
  function chiValue(pos, s) {
    const cat = catOf(s), r1 = r1Of(s), r2 = r2Of(s);
    const row = WIN[pos][Math.min(cat, WIN[pos].length - 1)];
    const v = row[Math.max(0, Math.min(12, r1 - 1))];
    return v / 100 + (r2 - 7) * .0015;
  }
  const C5 = [], C3of8 = [];
  (function () {
    for (let m = 0; m < 8192; m++) { let c = 0, x = m; while (x) { x &= x - 1; c++; } if (c === 5) C5.push(m); }
    for (let m = 0; m < 256; m++) { let c = 0, x = m; while (x) { x &= x - 1; c++; } if (c === 5) C3of8.push(m); }
  })();
  /**
   * Best arrangement of 13 cards: maximise the summed chi values subject to chi1 ≥ chi2 ≥ chi3.
   * opts.pick: 0 = best; bots pass a small random index into the top list for "good, not perfect" play.
   * → { chi: [[5],[5],[3]], value, scores }
   */
  function arrange(hand, opts = {}) {
    const n = hand.length; if (n !== 13) throw new Error('need 13 cards');
    const E = new Map(), ev = m => { let v = E.get(m); if (v === undefined) { const ids = []; for (let i = 0; i < 13; i++) if (m >> i & 1) ids.push(hand[i]); v = evaluate(ids).score; E.set(m, v); } return v; };
    const full = 8191, top = [], keep = opts.keep || 1;
    const bits = new Array(8);
    for (const m1 of C5) {
      const s1 = ev(m1), v1 = chiValue(0, s1), rem = full ^ m1;
      let k = 0; for (let i = 0; i < 13; i++) if (rem >> i & 1) bits[k++] = i;
      for (const sm of C3of8) {
        let m2 = 0; for (let i = 0; i < 8; i++) if (sm >> i & 1) m2 |= 1 << bits[i];
        const s2 = ev(m2); if (s2 > s1) continue;
        const m3 = rem ^ m2, s3 = ev(m3); if (s3 > s2) continue;
        const v = v1 + chiValue(1, s2) + chiValue(2, s3);
        if (top.length < keep || v > top[top.length - 1].v) {
          top.push({ v, m1, m2, m3 }); top.sort((a, b) => b.v - a.v); if (top.length > keep) top.pop();
        }
      }
    }
    const pickI = Math.min(top.length - 1, opts.pick || 0), b = top[pickI];
    const ids = m => hand.filter((_, i) => m >> i & 1);
    const chi = [ids(b.m1), ids(b.m2), ids(b.m3)].map(x => x.sort((p, q) => rankOf(q) - rankOf(p) || suitOf(q) - suitOf(p)));
    return { chi, value: b.v, scores: chi.map(x => evaluate(x).score) };
  }
  /** Bot arrangement: usually the best, sometimes the 2nd/3rd best. */
  function botArrange(hand, rng = Math.random) {
    const sp = special(hand); if (sp && sp.chi) return { chi: sp.chi, special: sp };
    const r = rng(), pick = r < .7 ? 0 : r < .9 ? 1 : 2;
    return arrange(hand, { keep: 3, pick });
  }

  // ------------------------------------------------------------------ settlement
  /** players: [{ chi: [[5],[5],[3]], special: special()|null }] → { units[], pairs[], valid[] } */
  function settle(players) {
    const n = players.length, units = new Array(n).fill(0), pairs = [];
    const info = players.map(p => ({ sp: p.special || null, valid: p.special ? true : isValid(p.chi), sc: p.special ? null : p.chi.map(x => evaluate(x).score) }));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = info[i], b = info[j], d = { i, j, chi: [0, 0, 0], u: 0, why: '' };
      if (a.sp || b.sp) {
        const pa = a.sp ? a.sp.prio : 0, pb = b.sp ? b.sp.prio : 0;
        if (pa > pb) { d.u = a.sp.units; d.why = 'mau_binh'; } else if (pb > pa) { d.u = -b.sp.units; d.why = 'mau_binh'; } else d.why = 'hoa';
      } else if (!a.valid || !b.valid) {
        if (a.valid) { d.u = LUNG; d.why = 'lung'; } else if (b.valid) { d.u = -LUNG; d.why = 'lung'; } else d.why = 'hoa';
      } else {
        for (let k = 0; k < 3; k++) d.chi[k] = Math.sign(a.sc[k] - b.sc[k]);
        const w = d.chi.filter(x => x > 0).length, l = d.chi.filter(x => x < 0).length;
        d.u = w === 3 ? SAP : l === 3 ? -SAP : w - l; d.why = w === 3 || l === 3 ? 'sap' : 'chi';
      }
      units[i] += d.u; units[j] -= d.u; pairs.push(d);
    }
    return { units, pairs, valid: info.map(x => x.valid) };
  }
  /** Deal 4 hands of 13. */
  function deal(rng) { const d = shuffled(rng); return [0, 1, 2, 3].map(p => sortIds(d.slice(p * 13, p * 13 + 13))); }

  return { RANKS, SUITS, SUIT_KEYS, CAT, SPECIAL, SAP, LUNG, rankOf, suitOf, key, label, sortIds, mulberry32, shuffled, deal, evaluate, isValid, special, arrange, botArrange, settle, chiValue, catOf, r1Of, setWinTable: t => { WIN = t; } };
});
