/*
 * Tiến Lên Miền Nam — rules engine + AI (no DOM). Works in the browser (window.TL) and in Node (require).
 *
 * Cards are ids 0..51: rank = id >> 2 (0='3' … 11='A', 12='2'), suit = id & 3 (0 ♠ bích, 1 ♣ chuồn, 2 ♦ rô, 3 ♥ cơ).
 * A higher id always beats a lower id of the same shape, which matches the Southern rules
 * (rank first, then suit ♠ < ♣ < ♦ < ♥).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TL = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const SUITS = ['♠', '♣', '♦', '♥'];
  const SUIT_NAMES = ['spades', 'clubs', 'diamonds', 'hearts'];
  const rankOf = id => id >> 2;
  const suitOf = id => id & 3;
  const isRed = id => suitOf(id) >= 2;
  const label = id => RANKS[rankOf(id)] + SUITS[suitOf(id)];
  const sortIds = ids => [...ids].sort((a, b) => a - b);

  // ------------------------------------------------------------------ random
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(rng) {
    const d = Array.from({ length: 52 }, (_, i) => i);
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  // ------------------------------------------------------------------ combo analysis
  const TYPE_VI = { single: 'Rác', pair: 'Đôi', triple: 'Sám cô', quad: 'Tứ quý', straight: 'Sảnh', pairseq: 'Đôi thông' };

  function countByRank(ids) {
    const m = new Map();
    for (const id of ids) { const r = rankOf(id); if (!m.has(r)) m.set(r, []); m.get(r).push(id); }
    for (const v of m.values()) v.sort((a, b) => a - b);
    return m;
  }

  /** Returns a combo object or null if the cards do not form a legal combination. */
  function analyze(ids) {
    if (!ids || !ids.length) return null;
    const cards = sortIds(ids);
    if (new Set(cards).size !== cards.length) return null;
    const n = cards.length, top = cards[n - 1];
    const ranks = countByRank(cards);
    const base = { cards, n, top, rank: rankOf(top) };
    if (ranks.size === 1) {
      if (n === 1) return { ...base, type: 'single' };
      if (n === 2) return { ...base, type: 'pair' };
      if (n === 3) return { ...base, type: 'triple' };
      if (n === 4) return { ...base, type: 'quad' };
      return null;
    }
    const rs = [...ranks.keys()].sort((a, b) => a - b);
    const consecutive = rs.every((r, i) => i === 0 || r === rs[i - 1] + 1);
    if (!consecutive || rs[rs.length - 1] === 12) return null; // '2' (heo) is never part of a sequence
    if (n >= 3 && rs.length === n) return { ...base, type: 'straight', len: n };
    if (n >= 6 && n % 2 === 0 && rs.length === n / 2 && [...ranks.values()].every(v => v.length === 2)) return { ...base, type: 'pairseq', len: n / 2 };
    return null;
  }

  const isHeo = c => !!c && (c.type === 'single' || c.type === 'pair') && c.rank === 12;
  const isBomb = c => !!c && (c.type === 'quad' || (c.type === 'pairseq' && c.len >= 3));

  /**
   * Can combo `a` be played on top of `b`?  Returns {ok, cut, reason}.
   * cut = true when `a` "chặt" (cuts) a heo or a bomb, which triggers a penalty.
   */
  function canBeat(a, b) {
    if (!a) return { ok: false, reason: 'Bài không hợp lệ' };
    if (!b) return { ok: true, cut: false };
    if (a.type === b.type) {
      if ((a.type === 'straight' || a.type === 'pairseq') && a.len !== b.len) return { ok: false, reason: 'Phải cùng số lá' };
      if (a.top > b.top) return { ok: true, cut: isBomb(b) && isBomb(a) };
      return { ok: false, reason: 'Bài nhỏ hơn' };
    }
    // chặt rules
    if (b.type === 'single' && b.rank === 12 && isBomb(a)) return { ok: true, cut: true };              // 3 đôi thông / tứ quý / 4 đôi thông chặt 1 heo
    if (b.type === 'pair' && b.rank === 12 && (a.type === 'quad' || (a.type === 'pairseq' && a.len >= 4))) return { ok: true, cut: true }; // chặt đôi heo
    if (b.type === 'pairseq' && b.len === 3 && (a.type === 'quad' || (a.type === 'pairseq' && a.len >= 4))) return { ok: true, cut: true }; // chặt 3 đôi thông
    if (b.type === 'quad' && a.type === 'pairseq' && a.len >= 4) return { ok: true, cut: true };       // 4 đôi thông chặt tứ quý
    return { ok: false, reason: 'Không cùng loại bài' };
  }

  /** Penalty (in bet units) paid by the owner of combo `c` when it gets cut. */
  function cutUnits(c) {
    if (!c) return 0;
    if (isHeo(c)) return c.cards.reduce((s, id) => s + (isRed(id) ? 2 : 1), 0);
    if (c.type === 'pairseq') return c.len >= 4 ? 5 : 3;
    if (c.type === 'quad') return 4;
    return 0;
  }

  // ------------------------------------------------------------------ special hands
  function longestPairRun(ranks, exclude = new Set()) {
    let best = { start: -1, len: 0 }, cur = 0;
    for (let r = 0; r <= 11; r++) {
      if ((ranks.get(r) || []).filter(id => !exclude.has(id)).length >= 2) { cur++; if (cur > best.len) best = { start: r - cur + 1, len: cur }; } else cur = 0;
    }
    return best;
  }

  /** Tới trắng (instant win at the deal). */
  function instantWin(hand, firstGame) {
    const ranks = countByRank(hand);
    if ((ranks.get(12) || []).length === 4) return { kind: 'tu_quy_heo', label: 'Tứ quý heo' };
    if ([...Array(12).keys()].every(r => ranks.has(r))) return { kind: 'sanh_rong', label: 'Sảnh rồng' };
    if (longestPairRun(ranks).len >= 5) return { kind: '5_doi_thong', label: '5 đôi thông' };
    if ([...ranks.values()].reduce((s, v) => s + Math.floor(v.length / 2), 0) >= 6) return { kind: '6_doi', label: '6 đôi' };
    if (hand.every(isRed) || hand.every(id => !isRed(id))) return { kind: 'dong_mau', label: 'Đồng màu' };
    if (firstGame && (ranks.get(0) || []).length === 4) return { kind: 'tu_quy_3', label: 'Tứ quý 3 (ván đầu)' };
    return null;
  }

  /** Thối: heo / hàng left in the loser's hand at the end. */
  function thoiOf(hand) {
    const items = []; let units = 0;
    const ranks = countByRank(hand);
    for (const id of ranks.get(12) || []) { const u = isRed(id) ? 2 : 1; items.push(`Heo ${label(id)}`); units += u; }
    const used = new Set();
    for (const [r, v] of ranks) if (r !== 12 && v.length === 4) { items.push(`Tứ quý ${RANKS[r]}`); units += 4; v.forEach(id => used.add(id)); }
    const run = longestPairRun(ranks, used);
    if (run.len >= 3) { items.push(`${run.len} đôi thông`); units += run.len >= 4 ? 5 : 3; }
    return { units, items };
  }

  // ------------------------------------------------------------------ combo generation (AI + hints)
  function combosOf(hand) {
    const out = [];
    const ranks = countByRank(hand);
    const push = ids => { const c = analyze(ids); if (c) out.push(c); };
    for (const id of hand) push([id]);
    for (const [, v] of ranks) {
      for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) push([v[i], v[j]]);
      if (v.length >= 3) for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) for (let k = j + 1; k < v.length; k++) push([v[i], v[j], v[k]]);
      if (v.length === 4) push(v);
    }
    // straights: lowest card of each rank, every option for the top rank
    for (let start = 0; start <= 9; start++) {
      if (!ranks.has(start)) continue;
      const body = [];
      for (let r = start; r <= 11 && ranks.has(r); r++) {
        if (body.length >= 2) for (const topId of ranks.get(r)) push([...body, topId]);
        body.push(ranks.get(r)[0]);
      }
    }
    // pair sequences
    for (let start = 0; start <= 9; start++) {
      const body = [];
      for (let r = start; r <= 11 && (ranks.get(r) || []).length >= 2; r++) {
        const v = ranks.get(r);
        if (body.length >= 4) for (let t = 1; t < v.length; t++) push([...body, v[0], v[t]]);
        body.push(v[0], v[1]);
      }
    }
    return out;
  }

  /** Greedy split of a hand into playable groups (used by the AI to avoid breaking structures). */
  function decompose(hand) {
    let rest = sortIds(hand);
    const groups = [];
    const take = ids => { const s = new Set(ids); rest = rest.filter(x => !s.has(x)); groups.push(analyze(ids)); };
    let ranks = countByRank(rest);
    for (const [r, v] of [...ranks]) if (v.length === 4 && r !== 12) take(v);
    ranks = countByRank(rest);
    for (;;) {
      const run = longestPairRun(ranks);
      if (run.len < 3) break;
      const ids = [];
      for (let r = run.start; r < run.start + run.len; r++) ids.push(...ranks.get(r).slice(0, 2));
      take(ids); ranks = countByRank(rest);
    }
    // straights: prefer runs built from ranks that are singletons
    for (;;) {
      ranks = countByRank(rest);
      let best = null;
      for (let s = 0; s <= 9; s++) {
        let e = s; while (e <= 11 && ranks.has(e)) e++;
        const len = e - s;
        if (len >= 3) {
          const singles = [...Array(len).keys()].filter(i => ranks.get(s + i).length === 1).length;
          const score = singles * 2 + len - (len - singles) * 1.5;
          if (score > 2 && (!best || score > best.score)) best = { s, len, score };
        }
      }
      if (!best) break;
      const ids = [];
      for (let r = best.s; r < best.s + best.len; r++) ids.push(ranks.get(r)[0]);
      take(ids);
    }
    ranks = countByRank(rest);
    for (const [, v] of [...ranks]) {
      if (v.length >= 3) take(v.slice(0, 3));
      else if (v.length === 2) take(v);
    }
    ranks = countByRank(rest);
    for (const [, v] of [...ranks]) for (const id of v) take([id]);
    return groups.sort((a, b) => a.cards[0] - b.cards[0]);
  }

  // ------------------------------------------------------------------ game
  const RANK_PAY = [3, 1, -1, -3];      // Nhất, Nhì, Ba, Bét (bet units)
  const CONG_EXTRA = 2;                  // each "cóng" player pays this extra to Nhất
  const INSTANT_PAY = 4;                 // each player pays the tới-trắng winner

  class Game {
    /**
     * opts: { seed, firstGame=true, starter=null, mustPlay3s=true, names }
     */
    constructor(opts = {}) {
      this.rng = mulberry32(opts.seed != null ? opts.seed : (Math.random() * 2 ** 32) >>> 0);
      this.firstGame = opts.firstGame !== false;
      this.mustPlay3s = opts.mustPlay3s !== false;
      this.starter = opts.starter != null ? opts.starter : null;
      this.events = [];
      this.over = false;
    }
    emit(e) { this.events.push(e); return e; }
    drain() { const e = this.events; this.events = []; return e; }

    deal(hands) {
      const deck = shuffled(this.rng);
      this.hands = hands ? hands.map(h => sortIds(h)) : [0, 1, 2, 3].map(p => sortIds(deck.slice(p * 13, p * 13 + 13)));
      this.played = [0, 0, 0, 0];
      this.out = [false, false, false, false];
      this.passed = [false, false, false, false];
      this.finishOrder = [];
      this.cong = [];
      this.current = null;          // {combo, by}
      this.leader = null;
      this.chain = null;            // {victim, cutter, units, count}
      this.transfers = [];          // [{from, to, units, why}]
      this.trick = 0;
      this.mustInclude3s = this.firstGame && this.mustPlay3s;
      this.emit({ type: 'deal', hands: this.hands.map(h => [...h]) });
      // tới trắng
      const order = this.starterOrder();
      for (const p of order) {
        const w = instantWin(this.hands[p], this.firstGame);
        if (w) { this.instantWin(p, w); return this.drain(); }
      }
      const first = order[0];
      this.startRound(first, true);
      return this.drain();
    }
    starterOrder() {
      let s = this.starter;
      if (s == null || this.firstGame) s = this.hands.findIndex(h => h.includes(0));
      if (s < 0) s = 0;
      return [0, 1, 2, 3].map(i => (s + i) % 4);
    }
    instantWin(p, w) {
      this.over = true;
      const results = [0, 1, 2, 3].map(q => ({ p: q, rank: q === p ? 1 : null, units: q === p ? 3 * INSTANT_PAY : -INSTANT_PAY, notes: q === p ? [`Tới trắng: ${w.label}`] : ['Thua tới trắng'] }));
      for (const q of [0, 1, 2, 3]) if (q !== p) this.transfers.push({ from: q, to: p, units: INSTANT_PAY, why: 'toi_trang' });
      this.emit({ type: 'toi_trang', p, kind: w.kind, label: w.label });
      this.emit({ type: 'game_over', results, winner: p, instant: w });
    }
    active(p) { return !this.out[p]; }
    activeCount() { return this.out.filter(x => !x).length; }
    nextActive(from) { for (let k = 1; k <= 4; k++) { const q = (from + k) % 4; if (!this.out[q]) return q; } return -1; }

    startRound(leader, first = false) {
      this.current = null;
      this.passed = [false, false, false, false];
      this.leader = leader;
      this.turn = leader;
      this.trick++;
      this.emit({ type: 'round', leader, first });
      this.emit({ type: 'turn', p: leader, lead: true });
    }

    /** Validate a play without applying it. */
    check(p, ids) {
      if (this.over) return { ok: false, reason: 'Ván đã kết thúc' };
      if (p !== this.turn) return { ok: false, reason: 'Chưa tới lượt' };
      if (!ids.length) return { ok: false, reason: 'Chưa chọn bài' };
      const hand = new Set(this.hands[p]);
      if (!ids.every(id => hand.has(id))) return { ok: false, reason: 'Không có lá này' };
      const combo = analyze(ids);
      if (!combo) return { ok: false, reason: 'Bộ bài không hợp lệ' };
      if (!this.current && this.mustInclude3s && this.hands[p].includes(0) && !combo.cards.includes(0)) return { ok: false, reason: 'Ván đầu phải đánh kèm 3♠' };
      const r = canBeat(combo, this.current && this.current.combo);
      if (!r.ok) return { ok: false, reason: r.reason };
      return { ok: true, combo, cut: !!(this.current && r.cut) };
    }

    play(p, ids) {
      const v = this.check(p, ids);
      if (!v.ok) return [{ type: 'invalid', p, reason: v.reason }];
      const { combo, cut } = v;
      const s = new Set(combo.cards);
      this.hands[p] = this.hands[p].filter(id => !s.has(id));
      this.played[p] += combo.n;
      this.mustInclude3s = false;
      let cutInfo = null;
      if (cut) {
        const victim = this.current.by;
        const own = cutUnits(this.current.combo);
        const stacked = this.chain && this.chain.cutter === victim;
        this.chain = stacked ? { victim, cutter: p, units: this.chain.units + own, count: this.chain.count + 1 } : { victim, cutter: p, units: own, count: 1 };
        cutInfo = { victim, units: this.chain.units, stacked, victimCombo: this.current.combo };
      }
      this.current = { combo, by: p };
      this.leader = p;
      this.emit({ type: 'play', p, combo, cut: cutInfo, left: this.hands[p].length });
      if (this.hands[p].length === 0) this.finish(p);
      if (!this.over) this.advance();
      return this.drain();
    }

    pass(p) {
      if (this.over || p !== this.turn) return [{ type: 'invalid', p, reason: 'Chưa tới lượt' }];
      if (!this.current) return [{ type: 'invalid', p, reason: 'Bạn đi đầu vòng, phải đánh 1 bộ' }];
      this.passed[p] = true;
      this.emit({ type: 'pass', p });
      this.advance();
      return this.drain();
    }

    advance() {
      for (let k = 1; k <= 4; k++) {
        const q = (this.turn + k) % 4;
        if (this.out[q] || this.passed[q] || q === this.leader) continue;
        this.turn = q;
        this.emit({ type: 'turn', p: q, lead: false });
        return;
      }
      // everyone else passed -> round won by leader
      this.settleChain();
      const lead = this.out[this.leader] ? this.nextActive(this.leader) : this.leader;
      this.emit({ type: 'round_end', winner: this.leader, next: lead });
      this.startRound(lead);
    }

    settleChain() {
      if (!this.chain) return;
      const { victim, cutter, units, count } = this.chain;
      this.transfers.push({ from: victim, to: cutter, units, why: count > 1 ? 'chat_chong' : 'chat' });
      this.emit({ type: 'pay', from: victim, to: cutter, units, why: count > 1 ? 'chat_chong' : 'chat' });
      this.chain = null;
    }

    finish(p) {
      this.out[p] = true;
      this.finishOrder.push(p);
      this.emit({ type: 'finish', p, rank: this.finishOrder.length });
      if (this.finishOrder.length === 1) {
        for (let q = 0; q < 4; q++) if (!this.out[q] && this.played[q] === 0) { this.out[q] = true; this.cong.push(q); this.emit({ type: 'cong', p: q }); }
      }
      if (this.activeCount() <= 1) this.endGame();
    }

    endGame() {
      this.settleChain();
      const last = [0, 1, 2, 3].filter(q => !this.out[q]);
      const order = [...this.finishOrder, ...last, ...this.cong];
      const results = order.map((q, i) => ({ p: q, rank: i + 1, units: RANK_PAY[i], notes: [] }));
      const R = Object.fromEntries(results.map(r => [r.p, r]));
      const nhat = order[0];
      for (const q of this.cong) { R[q].units -= CONG_EXTRA; R[nhat].units += CONG_EXTRA; R[q].notes.push('Cóng (chưa đánh lá nào)'); }
      for (const q of last) {
        const t = thoiOf(this.hands[q]);
        if (t.units) { R[q].units -= t.units; R[nhat].units += t.units; R[q].notes.push('Thối: ' + t.items.join(', ')); this.emit({ type: 'thoi', p: q, units: t.units, items: t.items }); }
      }
      for (const r of results) { r.left = [...this.hands[r.p]]; }
      this.over = true;
      this.emit({ type: 'game_over', results, winner: nhat });
    }

    // ---------------------------------------------------------------- AI
    /** Options the player at `p` could play now, best first (also used for the human "Gợi ý" button). */
    options(p) {
      const hand = this.hands[p];
      let combos = combosOf(hand);
      if (!this.current && this.mustInclude3s && hand.includes(0)) combos = combos.filter(c => c.cards.includes(0));
      if (this.current) combos = combos.filter(c => canBeat(c, this.current.combo).ok);
      const groups = decompose(hand);
      const gid = new Map();
      groups.forEach((g, i) => g.cards.forEach(id => gid.set(id, i)));
      const danger = this.minOpponentCards(p);
      const scored = combos.map(c => {
        const touched = new Set(c.cards.map(id => gid.get(id)));
        let broken = 0;
        for (const gi of touched) { const g = groups[gi]; if (g.cards.some(id => !c.cards.includes(id))) broken++; }
        let cost = c.top / 4 + broken * 6;
        const twos = c.cards.filter(id => rankOf(id) === 12).length;
        if (twos) cost += danger <= 2 || hand.length <= 4 ? 2 : 14 * twos;
        if (isBomb(c)) cost += this.current && (isHeo(this.current.combo) || isBomb(this.current.combo)) ? -30 : 25;
        if (!this.current) cost -= c.n * 1.2; // when leading, dumping more cards is good
        if (c.n === hand.length) cost -= 100;  // finishing
        return { combo: c, cost };
      });
      scored.sort((a, b) => a.cost - b.cost);
      return scored;
    }
    minOpponentCards(p) {
      let m = 99;
      for (let q = 0; q < 4; q++) if (q !== p && !this.out[q]) m = Math.min(m, this.hands[q].length);
      return m;
    }

    /** Pick a move for player p. Returns {action:'play', cards} or {action:'pass'}. level: 0 easy … 2 hard */
    aiMove(p, level = 1) {
      const hand = this.hands[p];
      const whole = analyze(hand);
      if (whole && (!this.current || canBeat(whole, this.current.combo).ok) && !(this.mustInclude3s && hand.includes(0) && !whole.cards.includes(0))) return { action: 'play', cards: whole.cards };
      const opts = this.options(p);
      if (!this.current) {
        // leading: play a natural group, avoid singles when an opponent is on 1 card
        const danger = this.minOpponentCards(p);
        if (this.mustInclude3s && hand.includes(0)) return { action: 'play', cards: opts[0].combo.cards };
        const groups = decompose(hand).filter(g => !isBomb(g) && !g.cards.some(id => rankOf(id) === 12));
        let pickG = null;
        if (groups.length) {
          const pool = danger === 1 ? groups.filter(g => g.n > 1) : groups;
          if (pool.length) pickG = pool.slice().sort((a, b) => (a.cards[0] - b.cards[0]) || (b.n - a.n))[0];
          else pickG = groups.slice().sort((a, b) => b.top - a.top)[0]; // only singles: play the highest
          // if only one group remains besides strong cards, lead it
        }
        if (!pickG) pickG = opts.length ? opts[opts.length - 1 > 0 && danger === 1 ? opts.length - 1 : 0].combo : analyze([hand[0]]);
        if (level === 0 && this.rng() < 0.3) pickG = analyze([hand[0]]);
        return { action: 'play', cards: pickG.cards };
      }
      if (!opts.length) return { action: 'pass' };
      const best = opts[0];
      const cur = this.current.combo;
      const threat = this.hands[this.current.by].length <= 3 || this.minOpponentCards(p) <= 2;
      // always cut a heo / bomb when possible (it pays!)
      if ((isHeo(cur) || isBomb(cur)) && isBomb(best.combo)) return { action: 'play', cards: best.combo.cards };
      let passChance = 0;
      if (!threat) {
        if (best.cost > 18) passChance = 0.75;
        else if (best.cost > 12) passChance = 0.35;
        if (level === 2) passChance *= 0.6;
        if (level === 0) passChance = Math.min(0.9, passChance + 0.2);
      }
      if (this.rng() < passChance) return { action: 'pass' };
      return { action: 'play', cards: best.combo.cards };
    }
  }

  function describe(c) {
    if (!c) return '';
    if (c.type === 'straight') return `Sảnh ${c.len}`;
    if (c.type === 'pairseq') return `${c.len} đôi thông`;
    if (c.type === 'single' && c.rank === 12) return 'Heo';
    if (c.type === 'pair' && c.rank === 12) return 'Đôi heo';
    return TYPE_VI[c.type];
  }

  return { RANKS, SUITS, SUIT_NAMES, rankOf, suitOf, isRed, label, sortIds, analyze, canBeat, isHeo, isBomb, cutUnits, instantWin, thoiOf, combosOf, decompose, describe, mulberry32, shuffled, Game, RANK_PAY, CONG_EXTRA, INSTANT_PAY };
});
