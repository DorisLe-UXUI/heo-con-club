/*
 * Sâm Lốc rules + bots (pure, no DOM). UMD: window.Rules['sam-loc'] in the browser, module.exports in Node.
 *
 * Cards are ids 0..51: rank = id >> 2 (0 = '3' … 11 = 'A', 12 = '2'), suit = id & 3 (♠ ♣ ♦ ♥).
 * Suits never matter for combos or for beating; they only pick who leads the very first game.
 *
 * Rule choices (shown to the player in the module's rules text):
 *  - 4 players × 10 cards, the other 12 cards stay out of play. Chế độ "Solo": opts.seats = [0, 2] — two players
 *    sitting face to face, 10 cards each, 32 cards out of play; everything else is the same.
 *  - Combos: single, pair, triple, tứ quý (4 of a kind), straight of 3+ consecutive ranks.
 *    A '2' never sits in a straight; A may end one (Q-K-A); A-2-3 and K-A-2 are NOT straights.
 *  - Beat with the same type and the same number of cards but a higher (top) rank. Tứ quý also beats
 *    a single 2 ("chặt heo"). Passing locks you out until everyone else passed and the round resets.
 *  - Báo Sâm (before the first play): the declarer leads every round and must go out without anyone
 *    beating any of their plays → +20 units from each opponent. If anybody beats them, the game stops
 *    and the declarer pays 20 units to each opponent.
 *  - Normal end (first player out wins): every loser pays 1 unit per card left; "cóng" (never played a
 *    card) pays a flat 15 instead; on top, each 2 still in hand ("thối heo") costs 5 more units.
 *  - Tới trắng at the deal (tứ quý 2, 5 đôi, 3 sám, sảnh rồng 10 lá) wins at once: 20 units from each.
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['sam-loc'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const SUITS = ['♠', '♣', '♦', '♥'], SUIT_KEYS = ['spades', 'clubs', 'diamonds', 'hearts'];
  const HEO = 12, ACE = 11;
  const PAY = { sam: 20, instant: 20, cong: 15, heo: 5, perCard: 1 };
  const rankOf = id => id >> 2, suitOf = id => id & 3;
  const key = id => SUIT_KEYS[suitOf(id)] + '_' + RANKS[rankOf(id)];
  const label = id => RANKS[rankOf(id)] + SUITS[suitOf(id)];
  const sortIds = ids => [...ids].sort((a, b) => a - b);

  function mulberry32(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffled(rng, n = 52) { const d = Array.from({ length: n }, (_, i) => i); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }
  function counts(ids) { const c = new Array(13).fill(0); for (const id of ids) c[rankOf(id)]++; return c; }

  // ------------------------------------------------------------------ combos
  const TYPE_N = ['', 'single', 'pair', 'triple', 'quad'];
  /** Combo object {type, n, rank (top rank), len, cards} or null when the cards are not a legal combination. */
  function analyze(ids) {
    if (!ids || !ids.length || new Set(ids).size !== ids.length) return null;
    const cnt = counts(ids), n = ids.length, rs = [];
    for (let r = 0; r < 13; r++) if (cnt[r]) rs.push(r);
    const cards = sortIds(ids);
    if (rs.length === 1) return n <= 4 ? { type: TYPE_N[n], n, rank: rs[0], len: n, cards } : null;
    if (n >= 3 && rs.length === n && rs[n - 1] <= ACE && rs[n - 1] - rs[0] === n - 1) return { type: 'straight', n, rank: rs[n - 1], len: n, cards };
    return null;
  }
  /** Can combo a be played on top of combo b? → {ok, cut, reason}. cut = tứ quý chặt heo. */
  function canBeat(a, b) {
    if (!a) return { ok: false, reason: 'Bộ bài không hợp lệ' };
    if (!b) return { ok: true, cut: false };
    if (a.type === b.type && a.n === b.n) return a.rank > b.rank ? { ok: true, cut: false } : { ok: false, reason: 'Bài nhỏ hơn' };
    if (a.type === 'quad' && b.type === 'single' && b.rank === HEO) return { ok: true, cut: true };
    return { ok: false, reason: a.type === b.type ? 'Phải cùng số lá' : 'Không cùng loại bài' };
  }
  function describe(c) {
    if (!c) return '';
    if (c.type === 'single') return c.rank === HEO ? 'Heo' : 'Rác ' + RANKS[c.rank];
    if (c.type === 'pair') return c.rank === HEO ? 'Đôi heo' : 'Đôi ' + RANKS[c.rank];
    if (c.type === 'triple') return 'Sám ' + RANKS[c.rank];
    if (c.type === 'quad') return 'Tứ quý ' + RANKS[c.rank];
    return 'Sảnh ' + c.n;
  }
  /** Tới trắng at the deal. */
  function instantWin(hand) {
    const c = counts(hand);
    if (c[HEO] === 4) return { kind: 'tu_quy_heo', label: 'Tứ quý heo' };
    let run = 0; for (let r = 0; r <= ACE; r++) { run = c[r] ? run + 1 : 0; if (run >= 10) return { kind: 'sanh_rong', label: 'Sảnh rồng 10 lá' }; }
    if (c.filter(v => v >= 3).length >= 3) return { kind: '3_sam', label: '3 sám cô' };
    if (c.reduce((s, v) => s + (v >> 1), 0) >= 5 && hand.length === 10 && c.every(v => v % 2 === 0)) return { kind: '5_doi', label: '5 đôi' };
    return null;
  }

  /** Every combination (rank level: {type, n, rank, len, ranks}) that can be played on `cur` (or led when cur is null). */
  function rankCombos(cnt, cur) {
    const out = [];
    const add = (type, rank, n, ranks) => { const c = { type, rank, n, len: n, ranks }; if (!cur || canBeat(c, cur).ok) out.push(c); };
    for (let r = 0; r < 13; r++) { const k = cnt[r]; if (k >= 1) add('single', r, 1, [r]); if (k >= 2) add('pair', r, 2, [r, r]); if (k >= 3) add('triple', r, 3, [r, r, r]); if (k === 4) add('quad', r, 4, [r, r, r, r]); }
    for (let s = 0; s <= 9; s++) { if (!cnt[s]) continue; const ranks = [s]; for (let t = s + 1; t <= ACE && cnt[t]; t++) { ranks.push(t); if (ranks.length >= 3) add('straight', t, ranks.length, ranks.slice()); } }
    return out;
  }
  /** Concrete card ids from `hand` for a rank-level combo. */
  function cardsFor(hand, spec) {
    const pool = sortIds(hand), used = new Set(), out = [];
    for (const r of spec.ranks) { const id = pool.find(x => rankOf(x) === r && !used.has(x)); if (id == null) return null; used.add(id); out.push(id); }
    return out;
  }
  const sub = (cnt, ranks) => { const c = cnt.slice(); for (const r of ranks) c[r]--; return c; };

  // ------------------------------------------------------------------ hand planning (bots)
  /** Split a rank-count vector into combos with the lowest cost (fewest groups, few weak singles). Memoised. */
  const MEMO = new Map();
  const gcost = g => 10 + (g.type === 'single' ? 1.5 + (g.rank < 8 ? .5 : 0) : 0) - g.rank * .04 - (g.type === 'straight' ? g.n * .1 : 0);
  function plan(cnt) {
    const k = cnt.join('');
    const m = MEMO.get(k); if (m) return m;
    let r = 0; while (r < 13 && !cnt[r]) r++;
    if (r === 13) return { cost: 0, groups: [] };
    let best = null;
    const tryG = (g, rest) => { const s = plan(rest), cost = s.cost + gcost(g); if (!best || cost < best.cost) best = { cost, groups: [g, ...s.groups] }; };
    for (let n = 1; n <= cnt[r]; n++) tryG({ type: TYPE_N[n], rank: r, n, len: n, ranks: Array(n).fill(r) }, sub(cnt, Array(n).fill(r)));
    if (r <= 9) {
      const ranks = [r];
      for (let t = r + 1; t <= ACE && cnt[t]; t++) { ranks.push(t); if (ranks.length >= 3) tryG({ type: 'straight', rank: t, n: ranks.length, len: ranks.length, ranks: ranks.slice() }, sub(cnt, ranks)); }
    }
    if (MEMO.size > 300000) MEMO.clear();
    MEMO.set(k, best);
    return best;
  }
  /** Could cards with rank counts `c` produce a combo that beats group g? */
  function beatable(c, g) {
    if (g.type === 'straight') {
      for (let top = g.rank + 1; top <= ACE; top++) { let ok = true; for (let r = top - g.n + 1; r <= top; r++) if (r < 0 || !c[r]) { ok = false; break; } if (ok) return true; }
      return false;
    }
    for (let r = g.rank + 1; r < 13; r++) if (c[r] >= g.n) return true;
    if (g.type === 'single' && g.rank === HEO) return c.some(v => v === 4);
    return false;
  }

  // ------------------------------------------------------------------ game
  class Game {
    /** opts: { seed, starter (seat index or null = holder of the lowest card), samThreshold, samples,
     *          seats (seats in play, default [0,1,2,3]; Solo = [0,2]), level (bot strength 0..3, null = default) } */
    constructor(opts = {}) {
      this.rng = mulberry32(opts.seed != null ? opts.seed : (Math.random() * 2 ** 32) >>> 0);
      this.seats = (opts.seats || [0, 1, 2, 3]).slice().sort((a, b) => a - b);
      this.level = opts.level != null ? opts.level : null;
      this.starter = opts.starter != null ? opts.starter : null;
      this.samThreshold = opts.samThreshold != null ? opts.samThreshold : .72;
      this.samples = opts.samples || 40;
      this.events = []; this.over = false; this.phase = 'deal';
    }
    emit(e) { this.events.push(e); return e; }
    drain() { const e = this.events; this.events = []; return e; }
    order(from) { return [0, 1, 2, 3].map(i => (from + i) % 4).filter(p => this.present(p)); }
    present(p) { return this.seats.includes(p); }

    deal(hands) {
      const deck = shuffled(this.rng);
      if (hands) this.hands = hands.map((h, p) => (this.present(p) ? sortIds(h) : []));
      else { this.hands = [[], [], [], []]; this.seats.forEach((p, k) => { this.hands[p] = sortIds(deck.slice(k * 10, k * 10 + 10)); }); }
      this.dealt = this.hands.flat();
      this.gone = []; this.played = [0, 0, 0, 0]; this.passed = [false, false, false, false];
      this.current = null; this.leader = null; this.turn = null; this.sam = -1; this.over = false; this.result = null;
      if (this.starter == null) { const lo = Math.min(...this.dealt); this.starter = this.hands.findIndex(h => h.includes(lo)); }
      this.emit({ type: 'deal', starter: this.starter });
      for (const p of this.order(this.starter)) { const w = instantWin(this.hands[p]); if (w) { this.finish('instant', p, w); return this.drain(); } }
      this.phase = 'bao'; this.baoOrder = this.order(this.starter); this.baoIdx = 0;
      this.emit({ type: 'bao_turn', p: this.baoTurn });
      return this.drain();
    }
    get baoTurn() { return this.phase === 'bao' ? this.baoOrder[this.baoIdx] : -1; }
    /** Báo Sâm decision for the player whose turn it is to decide. */
    declare(p, yes) {
      if (this.phase !== 'bao' || p !== this.baoTurn) return [{ type: 'invalid', p, reason: 'Không phải lúc báo sâm' }];
      if (yes) { this.sam = p; this.phase = 'play'; this.emit({ type: 'sam', p }); this.startRound(p); return this.drain(); }
      this.emit({ type: 'no_sam', p });
      if (++this.baoIdx >= this.baoOrder.length) { this.phase = 'play'; this.startRound(this.starter); } else this.emit({ type: 'bao_turn', p: this.baoTurn });
      return this.drain();
    }
    startRound(leader) {
      this.current = null; this.passed = [false, false, false, false]; this.leader = leader; this.turn = leader;
      this.emit({ type: 'round', leader }); this.emit({ type: 'turn', p: leader, lead: true });
    }
    check(p, ids) {
      if (this.phase !== 'play') return { ok: false, reason: 'Chưa tới lúc đánh' };
      if (p !== this.turn) return { ok: false, reason: 'Chưa tới lượt' };
      if (!ids || !ids.length) return { ok: false, reason: 'Chưa chọn bài' };
      const hand = new Set(this.hands[p]);
      if (!ids.every(id => hand.has(id))) return { ok: false, reason: 'Không có lá này' };
      const combo = analyze(ids);
      if (!combo) return { ok: false, reason: 'Bộ bài không hợp lệ' };
      const r = canBeat(combo, this.current && this.current.combo);
      return r.ok ? { ok: true, combo, cut: !!r.cut } : { ok: false, reason: r.reason };
    }
    play(p, ids) {
      const v = this.check(p, ids);
      if (!v.ok) return [{ type: 'invalid', p, reason: v.reason }];
      const { combo } = v, s = new Set(combo.cards);
      this.hands[p] = this.hands[p].filter(id => !s.has(id));
      this.played[p] += combo.n; this.gone.push(...combo.cards);
      const prev = this.current;
      this.current = { combo, by: p }; this.leader = p;
      this.emit({ type: 'play', p, combo, cut: v.cut ? { victim: prev.by } : null, left: this.hands[p].length, beat: prev ? prev.by : null });
      if (this.sam >= 0 && p !== this.sam) { this.finish('sam_fail', p); return this.drain(); }
      if (!this.hands[p].length) { this.finish(this.sam === p ? 'sam' : 'normal', p); return this.drain(); }
      this.advance();
      return this.drain();
    }
    pass(p) {
      if (this.phase !== 'play' || p !== this.turn) return [{ type: 'invalid', p, reason: 'Chưa tới lượt' }];
      if (!this.current) return [{ type: 'invalid', p, reason: 'Bạn đi đầu vòng, phải đánh 1 bộ' }];
      this.passed[p] = true; this.emit({ type: 'pass', p });
      this.advance();
      return this.drain();
    }
    advance() {
      for (let k = 1; k <= 3; k++) {
        const q = (this.turn + k) % 4;
        if (q === this.leader) break;
        if (this.passed[q] || !this.present(q)) continue;
        this.turn = q; this.emit({ type: 'turn', p: q, lead: false }); return;
      }
      this.emit({ type: 'round_end', winner: this.leader });
      this.startRound(this.leader);
    }
    /** End the game and settle. kind: normal | sam | sam_fail | instant. */
    finish(kind, p, info) {
      this.over = true; this.phase = 'over';
      const transfers = [], notes = [[], [], [], []], units = [0, 0, 0, 0];
      const pay = (from, to, u, why) => { if (u <= 0) return; transfers.push({ from, to, units: u, why }); units[from] -= u; units[to] += u; };
      let winner = p;
      const others = x => this.seats.filter(q => q !== x);
      if (kind === 'instant') { for (const q of others(p)) { pay(q, p, PAY.instant, 'toi_trang'); notes[q].push('Thua tới trắng'); } notes[p].push('Tới trắng: ' + info.label); }
      else if (kind === 'sam') { for (const q of others(p)) { pay(q, p, PAY.sam, 'sam'); notes[q].push('Thua sâm'); } notes[p].push('Báo sâm thành công'); }
      else if (kind === 'sam_fail') { const d = this.sam; for (const q of others(d)) pay(d, q, PAY.sam, 'den_sam'); notes[d].push('Bị chặn sâm, đền ' + PAY.sam + ' mỗi nhà'); notes[p].push('Chặn sâm'); }
      else {
        for (const q of others(p)) {
          const left = this.hands[q].length, heo = counts(this.hands[q])[HEO], cong = this.played[q] === 0;
          const base = cong ? PAY.cong : left * PAY.perCard;
          pay(q, p, base, cong ? 'cong' : 'la');
          notes[q].push(cong ? 'Cóng (chưa đánh lá nào)' : left + ' lá');
          if (heo) { pay(q, p, heo * PAY.heo, 'thoi_heo'); notes[q].push('Thối ' + heo + ' heo'); }
        }
        notes[p].push('Về nhất');
      }
      this.result = { kind, winner, info: info || null, transfers, units, notes, sam: this.sam, left: this.hands.map(h => [...h]), played: [...this.played], seats: this.seats.slice() };
      this.emit({ type: 'game_over', result: this.result });
    }
    /** Expected units of the finished game recomputed from the final state (used by tests and the selftest). */
    static expectedUnits(res) {
      const u = [0, 0, 0, 0], w = res.winner, seats = res.seats || [0, 1, 2, 3];
      if (res.kind === 'instant' || res.kind === 'sam') { for (const q of seats) if (q !== w) { u[q] -= 20; u[w] += 20; } }
      else if (res.kind === 'sam_fail') { for (const q of seats) if (q !== res.sam) { u[q] += 20; u[res.sam] -= 20; } }
      else for (const q of seats) if (q !== w) { const v = (res.played[q] === 0 ? 15 : res.left[q].length) + 5 * res.left[q].filter(id => rankOf(id) === HEO).length; u[q] -= v; u[w] += v; }
      return u;
    }

    // ---------------------------------------------------------------- bots
    unseen(p) { const c = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]; for (const id of this.hands[p]) c[rankOf(id)]--; for (const id of this.gone) c[rankOf(id)]--; return c; }
    minOpp(p) { let m = 99; for (const q of this.seats) if (q !== p) m = Math.min(m, this.hands[q].length); return m; }
    /** Monte-Carlo chance that nobody can beat any group of p's best split (= Báo Sâm would succeed). */
    samChance(p, samples = this.samples) {
      const hand = this.hands[p], groups = plan(counts(hand)).groups, mine = new Set(hand);
      const unseen = []; for (let id = 0; id < 52; id++) if (!mine.has(id)) unseen.push(id);
      let ok = 0; const nOpp = this.seats.length - 1;
      for (let s = 0; s < samples; s++) {
        for (let i = unseen.length - 1; i > unseen.length - (10 * nOpp + 1); i--) { const j = Math.floor(this.rng() * (i + 1)); [unseen[i], unseen[j]] = [unseen[j], unseen[i]]; }
        let safe = true;
        for (let o = 0; o < nOpp && safe; o++) { const c = counts(unseen.slice(unseen.length - 10 * (o + 1), unseen.length - 10 * o)); if (groups.some(g => beatable(c, g))) safe = false; }
        if (safe) ok++;
      }
      return ok / samples;
    }
    aiBao(p) { return this.samChance(p) >= this.samThreshold; }
    /** Options to play now, cheapest first: [{spec, cards, cost}] (also used by the GỢI Ý button). */
    options(p) {
      const hand = this.hands[p], cnt = counts(hand), cur = this.current && this.current.combo;
      const base = plan(cnt).cost;
      return rankCombos(cnt, cur).map(spec => {
        const rest = sub(cnt, spec.ranks), after = plan(rest).cost, waste = after - base + gcost(spec);
        let cost = waste * 2 + spec.rank * .45;
        const heo = spec.ranks.filter(r => r === HEO).length;
        if (heo) cost += 7 * heo;
        if (spec.type === 'quad') cost += 10;
        if (spec.n === hand.length) cost = -100;
        return { spec, cards: cardsFor(hand, spec), cost };
      }).sort((a, b) => a.cost - b.cost);
    }
    /** Pick a move: {action:'play', cards} | {action:'pass'}. */
    aiMove(p) {
      const hand = this.hands[p], cnt = counts(hand), cur = this.current && this.current.combo;
      const whole = analyze(hand);
      if (whole && canBeat(whole, cur).ok) return { action: 'play', cards: whole.cards };
      if (this.sam >= 0) {
        if (p !== this.sam) { const o = this.options(p); return o.length ? { action: 'play', cards: o[0].cards } : { action: 'pass' }; }
        if (!cur) { const g = plan(cnt).groups.slice().sort((a, b) => b.rank - a.rank)[0]; return { action: 'play', cards: cardsFor(hand, g) }; }
        return { action: 'pass' };
      }
      if (this.level === 0 && this.rng() < .3) {   // easy bots: a random legal move now and then
        const o = this.options(p);
        if (!cur) return { action: 'play', cards: o[Math.floor(this.rng() * o.length)].cards };
        return o.length && this.rng() < .5 ? { action: 'play', cards: o[Math.floor(this.rng() * o.length)].cards } : { action: 'pass' };
      }
      if (!cur) return { action: 'play', cards: cardsFor(hand, this.leadChoice(p)) };
      const opts = this.options(p);
      if (!opts.length) return { action: 'pass' };
      const best = opts[0], danger = this.minOpp(p), owner = this.current.by;
      const threat = danger <= 2 || this.hands[owner].length <= 2;
      // after this play, could we finish from the lead? then always take the trick
      const restPlan = plan(sub(cnt, best.spec.ranks));
      if (restPlan.groups.length <= 1) return { action: 'play', cards: best.cards };
      if (best.spec.type === 'quad' && cur.type === 'single') return (threat || hand.length <= 6 || this.rng() < .5) ? { action: 'play', cards: best.cards } : { action: 'pass' };
      let passChance = 0;
      if (!threat) passChance = best.cost > 17 ? .8 : best.cost > 11 ? .4 : 0;
      if (this.rng() < passChance) return { action: 'pass' };
      return { action: 'play', cards: best.cards };
    }
    leadChoice(p) {
      const hand = this.hands[p], cnt = counts(hand), groups = plan(cnt).groups, unseen = this.unseen(p);
      if (groups.length === 1) return groups[0];
      const safe = groups.filter(g => !beatable(unseen, g));
      if (safe.length && safe.length >= groups.length - 1) return safe.sort((a, b) => a.rank - b.rank)[0];   // run the table
      const danger = this.minOpp(p);
      let pool = groups.filter(g => g.rank !== HEO && g.type !== 'quad');
      if (!pool.length) pool = groups;
      if (danger === 1) {
        const big = pool.filter(g => g.type !== 'single');
        if (big.length) pool = big;
        else { const top = Math.max(...hand.map(rankOf)); return { type: 'single', rank: top, n: 1, len: 1, ranks: [top] }; }
      }
      return pool.slice().sort((a, b) => (a.rank - b.rank) || (b.n - a.n))[0];
    }
  }

  return { RANKS, SUITS, SUIT_KEYS, HEO, ACE, PAY, rankOf, suitOf, key, label, sortIds, counts, analyze, canBeat, describe, instantWin, rankCombos, cardsFor, plan, beatable, mulberry32, shuffled, Game };
});
