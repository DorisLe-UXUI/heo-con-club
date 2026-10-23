/*
 * Phỏm (Tá Lả) rules + bots (pure, no DOM). UMD: window.Rules['phom'] in the browser, module.exports in Node.
 *
 * Cards are ids 0..51: rank = id >> 2 (0 = 'A' … 12 = 'K'), suit = id & 3 (♠ ♣ ♦ ♥). Points: A = 1 … K = 13.
 *
 * Rule choices (shown to the player in the module's rules text):
 *  - 4 players, 9 cards each, the first player 10. The other 15 cards are the draw pile.
 *  - A turn: "ăn" the previous player's last discard (only when it makes a phỏm with your own cards),
 *    otherwise draw from the pile; then discard one card. The first player only discards on the first turn.
 *  - Phỏm = 3-4 cards of the same rank, or 3+ consecutive cards of one suit (A low, K high, no wrap).
 *  - An eaten card is locked: it must end up in a phỏm, two eaten cards never share a phỏm, and it cannot be
 *    discarded. Being eaten costs the discarder 1 unit, or 4 units for the "chốt" (their 4th discard).
 *  - After everybody has discarded 4 times, everyone "hạ phỏm" (best arrangement suggested automatically),
 *    then "gửi bài": non-móm players lay off single cards onto other players' phỏm.
 *    Chế độ "Không gửi bài" (opts.send = false): nobody lays off, the score is what is left after hạ phỏm.
 *  - Score = points left. Lowest wins (ties: earlier in turn order). "Móm" (no phỏm) ranks last.
 *    Nhất gets 1 / 2 / 3 units from Nhì / Ba / Bét; a móm player pays 4 instead.
 *  - "Ù": right after taking a card, if 9 or 10 of your cards fit in phỏm you win at once: 5 units from each.
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['phom'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['♠', '♣', '♦', '♥'], SUIT_KEYS = ['spades', 'clubs', 'diamonds', 'hearts'];
  const PAY = { rank: [0, 1, 2, 3], mom: 4, u: 5, eat: 1, chot: 4 };
  const rankOf = id => id >> 2, suitOf = id => id & 3, pts = id => (id >> 2) + 1;
  const key = id => SUIT_KEYS[suitOf(id)] + '_' + RANKS[rankOf(id)];
  const label = id => RANKS[rankOf(id)] + SUITS[suitOf(id)];
  const sortIds = ids => [...ids].sort((a, b) => a - b);
  const bySuitRank = ids => [...ids].sort((a, b) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b));
  const popcount = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const sum = ids => ids.reduce((s, id) => s + pts(id), 0);

  function mulberry32(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffled(rng) { const d = Array.from({ length: 52 }, (_, i) => i); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }

  // ------------------------------------------------------------------ melds
  /** 'set' | 'run' | null */
  function meldKind(ids) {
    if (!ids || ids.length < 3 || new Set(ids).size !== ids.length) return null;
    const r0 = rankOf(ids[0]);
    if (ids.every(id => rankOf(id) === r0)) return ids.length <= 4 ? 'set' : null;
    const s0 = suitOf(ids[0]);
    if (!ids.every(id => suitOf(id) === s0)) return null;
    const rs = ids.map(rankOf).sort((a, b) => a - b);
    return rs.every((r, i) => i === 0 || r === rs[i - 1] + 1) ? 'run' : null;
  }
  const isMeld = ids => !!meldKind(ids);
  const orderMeld = m => (meldKind(m) === 'run' ? [...m].sort((a, b) => rankOf(a) - rankOf(b)) : sortIds(m));
  /** All meld candidates inside `hand` as bitmasks over hand indices. */
  function candidates(hand) {
    const out = [], byRank = {}, bySuit = [{}, {}, {}, {}];
    hand.forEach((id, i) => { (byRank[rankOf(id)] = byRank[rankOf(id)] || []).push(i); bySuit[suitOf(id)][rankOf(id)] = i; });
    for (const idx of Object.values(byRank)) {
      if (idx.length < 3) continue;
      for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) for (let c = b + 1; c < idx.length; c++) out.push((1 << idx[a]) | (1 << idx[b]) | (1 << idx[c]));
      if (idx.length === 4) out.push(idx.reduce((m, i) => m | (1 << i), 0));
    }
    for (const m of bySuit) for (let r = 0; r <= 10; r++) {
      if (m[r] == null) continue;
      let mask = 1 << m[r], len = 1;
      for (let e = r + 1; e <= 12 && m[e] != null; e++) { mask |= 1 << m[e]; len++; if (len >= 3) out.push(mask); }
    }
    return out;
  }
  /**
   * Best way to put `hand` into phỏm. locked = eaten cards (each must sit in a phỏm, at most one per phỏm).
   * obj 'pts': fewest points left (then most cards melded) · obj 'cnt': most cards melded (then fewest points).
   * → { melds: [[ids]], rest: [ids], pts, melded } or null when the locked cards cannot all be placed.
   */
  function solve(hand, locked = [], obj = 'pts') {
    const n = hand.length, full = (1 << n) - 1, L = new Set(locked);
    const lockedMask = hand.reduce((m, id, i) => (L.has(id) ? m | (1 << i) : m), 0);
    const byLow = Array.from({ length: n }, () => []);
    for (const m of candidates(hand)) { if (popcount(m & lockedMask) > 1) continue; let i = 0; while (!(m >> i & 1)) i++; byLow[i].push(m); }
    const memo = new Map();
    const better = (a, b) => !b || (obj === 'pts' ? (a.pts < b.pts || (a.pts === b.pts && a.cnt > b.cnt)) : (a.cnt > b.cnt || (a.cnt === b.cnt && a.pts < b.pts)));
    function rec(asg) {
      if (asg === full) return { pts: 0, cnt: 0, melds: [] };
      if (memo.has(asg)) return memo.get(asg);
      let i = 0; while (asg >> i & 1) i++;
      let best = null;
      if (!(lockedMask >> i & 1)) { const r = rec(asg | (1 << i)); if (r) best = { pts: r.pts + pts(hand[i]), cnt: r.cnt, melds: r.melds }; }
      for (const m of byLow[i]) {
        if (m & asg) continue;
        const r = rec(asg | m); if (!r) continue;
        const c = { pts: r.pts, cnt: r.cnt + popcount(m), melds: [m, ...r.melds] };
        if (better(c, best)) best = c;
      }
      memo.set(asg, best);
      return best;
    }
    const r = rec(0);
    if (!r) return null;
    const used = r.melds.reduce((a, m) => a | m, 0);
    return { melds: r.melds.map(m => orderMeld(hand.filter((_, i) => m >> i & 1))), rest: sortIds(hand.filter((_, i) => !(used >> i & 1))), pts: r.pts, melded: r.cnt };
  }
  /** Up to k different ways to hạ (maximal phỏm sets), fewest points first — offered to the player at the end. */
  function arrangements(hand, locked = [], k = 3) {
    const L = new Set(locked), lockedMask = hand.reduce((m, id, i) => (L.has(id) ? m | (1 << i) : m), 0);
    const cands = candidates(hand).filter(m => popcount(m & lockedMask) <= 1), found = [];
    (function dfs(start, used, chosen) {
      if (found.length > 400) return;
      let ext = false;
      for (let j = 0; j < cands.length; j++) {
        if (cands[j] & used) continue;
        ext = true;
        if (j >= start) dfs(j + 1, used | cands[j], [...chosen, cands[j]]);
      }
      if (!ext && (used & lockedMask) === lockedMask) found.push(chosen);
    })(0, 0, []);
    const out = [], seen = new Set();
    for (const ms of found) {
      const used = ms.reduce((a, m) => a | m, 0), rest = hand.filter((_, i) => !(used >> i & 1));
      const melds = ms.map(m => orderMeld(hand.filter((_, i) => m >> i & 1)));
      const sig = melds.map(m => sortIds(m).join('.')).sort().join('|');
      if (seen.has(sig)) continue; seen.add(sig);
      out.push({ melds, rest: sortIds(rest), pts: sum(rest), melded: hand.length - rest.length });
    }
    const best = solve(hand, locked, 'pts');
    if (best && !out.some(a => a.pts === best.pts)) out.push(best);
    return out.sort((a, b) => a.pts - b.pts || b.melded - a.melded).slice(0, k);
  }
  const canEat = (hand, locked, card) => !!solve([...hand, card], [...locked, card]);
  const canDiscard = (hand, locked, card) => hand.includes(card) && !locked.includes(card) && !!solve(hand.filter(id => id !== card), locked);
  /** Can `card` be laid off onto meld m? */
  const fits = (m, card) => !m.includes(card) && isMeld([...m, card]);

  // ------------------------------------------------------------------ game
  class Game {
    /** opts: { seed, starter = 0, send = true (gửi bài allowed), level = bot strength 0..3 (null = the tuned default) } */
    constructor(opts = {}) {
      this.rng = mulberry32(opts.seed != null ? opts.seed : (Math.random() * 2 ** 32) >>> 0);
      this.starter = opts.starter || 0;
      this.send = opts.send !== false; this.level = opts.level != null ? opts.level : null;
      this.events = []; this.over = false; this.phase = 'deal';
    }
    emit(e) { this.events.push(e); return e; }
    drain() { const e = this.events; this.events = []; return e; }
    next(p) { return (p + 1) % 4; }
    prev(p) { return (p + 3) % 4; }
    order() { return [0, 1, 2, 3].map(i => (this.starter + i) % 4); }
    /** hands: optional fixed hands (starter 10, others 9); deck: optional draw order (last element drawn first). */
    deal(hands, deck) {
      const d = shuffled(this.rng);
      if (hands) { const used = new Set(hands.flat()); this.hands = hands.map(h => [...h]); this.deck = deck ? [...deck] : d.filter(id => !used.has(id)); }
      else { this.hands = [[], [], [], []]; let k = 0; for (const p of this.order()) { const n = p === this.starter ? 10 : 9; this.hands[p] = d.slice(k, k + n); k += n; } this.deck = d.slice(k); }
      this.hands = this.hands.map(sortIds);
      this.locked = [[], [], [], []]; this.eaten = [[], [], [], []]; this.discards = [[], [], [], []]; this.discCount = [0, 0, 0, 0];
      this.transfers = []; this.units = [0, 0, 0, 0]; this.eats = [];
      this.turn = this.starter; this.phase = 'discard'; this.last = null; this.over = false; this.result = null;
      this.emit({ type: 'deal', starter: this.starter });
      if (this.checkU(this.starter)) return this.drain();
      this.emit({ type: 'turn', p: this.turn, phase: this.phase });
      return this.drain();
    }
    pay(from, to, u, why) { this.transfers.push({ from, to, units: u, why }); this.units[from] -= u; this.units[to] += u; }
    round(p) { return Math.min(4, this.discCount[p] + 1); }
    canEat(p) { return this.phase === 'take' && this.turn === p && !!this.last && this.last.by === this.prev(p) && canEat(this.hands[p], this.locked[p], this.last.card); }
    canDiscard(p, card) { return this.phase === 'discard' && this.turn === p && canDiscard(this.hands[p], this.locked[p], card); }
    eat(p) {
      if (!this.canEat(p)) return [{ type: 'invalid', p, reason: 'Lá này không ăn được' }];
      const { card, by } = this.last, chot = this.discCount[by] === 4;
      this.discards[by].pop();
      this.hands[p] = sortIds([...this.hands[p], card]); this.locked[p].push(card); this.eaten[p].push(card);
      const u = chot ? PAY.chot : PAY.eat;
      this.pay(by, p, u, chot ? 'an_chot' : 'an'); this.eats.push({ from: by, to: p, card, chot });
      this.last = null; this.phase = 'discard';
      this.emit({ type: 'eat', p, card, from: by, chot, units: u });
      if (!this.checkU(p)) this.emit({ type: 'turn', p, phase: 'discard' });
      return this.drain();
    }
    draw(p) {
      if (this.phase !== 'take' || this.turn !== p) return [{ type: 'invalid', p, reason: 'Chưa tới lượt bốc' }];
      if (!this.deck.length) return [{ type: 'invalid', p, reason: 'Hết bài để bốc' }];
      const card = this.deck.pop();
      this.hands[p] = sortIds([...this.hands[p], card]); this.last = null; this.phase = 'discard';
      this.emit({ type: 'draw', p, card, left: this.deck.length });
      if (!this.checkU(p)) this.emit({ type: 'turn', p, phase: 'discard' });
      return this.drain();
    }
    discard(p, card) {
      if (this.phase !== 'discard' || this.turn !== p) return [{ type: 'invalid', p, reason: 'Chưa tới lượt đánh' }];
      if (!this.hands[p].includes(card)) return [{ type: 'invalid', p, reason: 'Không có lá này' }];
      if (this.locked[p].includes(card)) return [{ type: 'invalid', p, reason: 'Lá đã ăn phải nằm trong phỏm' }];
      if (!canDiscard(this.hands[p], this.locked[p], card)) return [{ type: 'invalid', p, reason: 'Đánh lá này sẽ vỡ phỏm đã ăn' }];
      this.hands[p] = this.hands[p].filter(id => id !== card);
      this.discards[p].push(card); this.discCount[p]++; this.last = { card, by: p };
      this.emit({ type: 'discard', p, card, n: this.discCount[p] });
      if (this.discCount.every(n => n >= 4)) { this.phase = 'lay'; this.turn = -1; this.emit({ type: 'lay' }); return this.drain(); }
      this.turn = this.next(p); this.phase = 'take';
      if (!this.deck.length && !this.canEat(this.turn)) { this.phase = 'lay'; this.turn = -1; this.emit({ type: 'lay' }); return this.drain(); }   // safety net, cannot happen with 52 cards
      this.emit({ type: 'turn', p: this.turn, phase: 'take' });
      return this.drain();
    }
    checkU(p) {
      if (this.hands[p].length < 10) return false;
      const a = solve(this.hands[p], this.locked[p], 'cnt');
      if (!a || a.melded < 9) return false;
      this.over = true; this.phase = 'over';
      for (let q = 0; q < 4; q++) if (q !== p) this.pay(q, p, PAY.u, 'u');
      this.result = { kind: 'u', winner: p, laid: [0, 1, 2, 3].map(q => (q === p ? a.melds : [])), rest: [0, 1, 2, 3].map(q => (q === p ? a.rest : this.hands[q])), uHand: a, transfers: this.transfers, units: this.units, eats: this.eats };
      this.emit({ type: 'u', p, melds: a.melds });
      this.emit({ type: 'game_over', result: this.result });
      return true;
    }
    /** Suggested ways to hạ for p (best first). */
    suggestions(p) { return arrangements(this.hands[p], this.locked[p], 3); }
    /** Lay down, lay off and score in one go. choice: { [p]: melds } overrides the automatic best arrangement. */
    lay(choice = {}, opts = {}) {
      const ev = this.layDown(choice);
      if (ev.length && ev[0].type === 'invalid') return ev;
      return [...ev, ...this.finishLay(opts)];
    }
    /** Step 1 of the end: everyone hạ phỏm (in turn order). Afterwards phase = 'send'. */
    layDown(choice = {}) {
      if (this.phase !== 'lay') return [{ type: 'invalid', reason: 'Chưa tới lúc hạ' }];
      const laid = [[], [], [], []], rest = [[], [], [], []], mom = [false, false, false, false];
      for (const p of this.order()) {
        let a = null;
        if (choice[p]) a = this.validLay(p, choice[p]);
        if (!a) a = solve(this.hands[p], this.locked[p], 'pts');
        laid[p] = a.melds.map(orderMeld); rest[p] = [...a.rest]; mom[p] = !laid[p].length;
        this.emit({ type: 'ha', p, melds: laid[p].map(m => [...m]), rest: [...rest[p]], mom: mom[p] });
      }
      this.laid = laid; this.rest = rest; this.mom = mom; this.phase = 'send';
      return this.drain();
    }
    /** What p could lay off right now (preview for the player's GỬI BÀI button). */
    sendOptions(p) {
      if (!this.laid || this.mom[p] || !this.send) return [];
      const laid = this.laid.map(ms => ms.map(m => [...m])), rest = [...this.rest[p]], out = [];
      for (;;) {
        let best = null;
        for (const c of rest) for (let q = 0; q < 4; q++) { if (q === p) continue; laid[q].forEach((m, mi) => { if (fits(m, c) && (!best || pts(c) > pts(best.c))) best = { c, q, mi }; }); }
        if (!best) break;
        laid[best.q][best.mi].push(best.c); rest.splice(rest.indexOf(best.c), 1); out.push({ card: best.c, to: best.q, meld: best.mi });
      }
      return out;
    }
    /** Step 2: gửi bài in turn order (opts.skip[p] = true → p does not lay off), then score and pay. */
    finishLay(opts = {}) {
      if (this.phase !== 'send') return [{ type: 'invalid', reason: 'Chưa hạ phỏm' }];
      const { laid, rest, mom } = this, sent = [[], [], [], []], skip = opts.skip || {};
      // gửi bài: in turn order, each non-móm player lays off what fits onto the other players' phỏm (highest card first)
      for (const p of this.order()) {
        if (mom[p] || skip[p] || !this.send) continue;
        for (;;) {
          let best = null;
          for (const c of rest[p]) for (let q = 0; q < 4; q++) { if (q === p) continue; laid[q].forEach((m, mi) => { if (fits(m, c) && (!best || pts(c) > pts(best.c))) best = { c, q, mi }; }); }
          if (!best) break;
          laid[best.q][best.mi] = orderMeld([...laid[best.q][best.mi], best.c]);
          rest[p] = rest[p].filter(id => id !== best.c);
          sent[p].push({ card: best.c, to: best.q, meld: best.mi });
          this.emit({ type: 'gui', p, card: best.c, to: best.q, meld: best.mi });
        }
      }
      const score = rest.map(sum), seat = this.order();
      const ranking = [...seat].sort((a, b) => (mom[a] - mom[b]) || (score[a] - score[b]) || (seat.indexOf(a) - seat.indexOf(b)));
      const first = ranking[0];
      ranking.slice(1).forEach((q, i) => this.pay(q, first, mom[q] ? PAY.mom : PAY.rank[i + 1], mom[q] ? 'mom' : 'hang'));
      this.over = true; this.phase = 'over';
      this.result = { kind: 'normal', winner: first, ranking, score, mom, laid, rest, sent, transfers: this.transfers, units: this.units, eats: this.eats };
      this.emit({ type: 'game_over', result: this.result });
      return this.drain();
    }
    /** Check a player's own meld choice: melds valid, disjoint, from the hand, every eaten card in a different meld. */
    validLay(p, melds) {
      const hand = new Set(this.hands[p]), used = new Set(), L = new Set(this.locked[p]);
      for (const m of melds) { if (!isMeld(m) || m.filter(id => L.has(id)).length > 1) return null; for (const id of m) { if (!hand.has(id) || used.has(id)) return null; used.add(id); } }
      if ([...L].some(id => !used.has(id))) return null;
      const r = this.hands[p].filter(id => !used.has(id));
      return { melds: melds.map(m => [...m]), rest: sortIds(r), pts: sum(r), melded: used.size };
    }
    /** Recompute the payout of a finished game from its public record (tests + in-browser selftest). */
    static expectedUnits(res) {
      const u = [0, 0, 0, 0], pay = (f, t, x) => { u[f] -= x; u[t] += x; };
      for (const e of res.eats) pay(e.from, e.to, e.chot ? 4 : 1);
      if (res.kind === 'u') { for (let q = 0; q < 4; q++) if (q !== res.winner) pay(q, res.winner, 5); return u; }
      const [w, ...others] = res.ranking;
      others.forEach((q, i) => pay(q, w, res.mom[q] ? 4 : i + 1));
      return u;
    }

    // ---------------------------------------------------------------- bots
    /** Cards everybody can see out of play (discard piles + eaten cards). */
    visible() { return new Set([...this.discards.flat(), ...this.eaten.flat()]); }
    aiTake(p) { if (!this.canEat(p)) return 'draw'; return this.level === 0 && this.deck.length && this.rng() < .3 ? 'draw' : 'eat'; }   // easy bots miss some cards they could eat
    /** Choose a discard: keep phỏm, keep live "cạ" (two cards that wait for a third) early on, dump high cards. */
    aiDiscard(p) {
      const hand = this.hands[p], locked = this.locked[p], final = this.discCount[p] >= 3, vis = this.visible();
      if (this.level === 0 && this.rng() < .4) { const ok = hand.filter(c => !locked.includes(c) && canDiscard(hand, locked, c)); if (ok.length) return ok[Math.floor(this.rng() * ok.length)]; }   // easy bots: careless discards
      const k = [.3, .3, .15, .05][this.discCount[p]] || 0;   // weights tuned by self-play
      let best = null;
      for (const c of hand) {
        if (locked.includes(c)) continue;
        const rest = hand.filter(id => id !== c), a = solve(rest, locked, 'pts');
        if (!a) continue;
        let score = a.pts - pts(c) * .01;
        if (!final) for (const d of a.rest) if (liveCa(d, a.rest, vis, hand)) score -= k * pts(d) + 1;
        // the next player could eat it: small penalty when it matches a card they already ate or a live pattern of theirs
        const nx = this.next(p);
        if (this.eaten[nx].some(e => rankOf(e) === rankOf(c) || (suitOf(e) === suitOf(c) && Math.abs(rankOf(e) - rankOf(c)) <= 2))) score += 3;
        if (!best || score < best.score) best = { card: c, score };
      }
      return best ? best.card : hand.find(id => !locked.includes(id));
    }
  }
  /** Is deadwood card d part of a "cạ" that can still become a phỏm (the missing card is not visibly gone)? */
  function liveCa(d, rest, vis, hand) {
    const gone = id => vis.has(id) || hand.includes(id);
    for (const e of rest) {
      if (e === d) continue;
      if (rankOf(e) === rankOf(d)) { for (let s = 0; s < 4; s++) { const id = rankOf(d) * 4 + s; if (!gone(id)) return true; } }
      else if (suitOf(e) === suitOf(d)) {
        const lo = Math.min(rankOf(d), rankOf(e)), hi = Math.max(rankOf(d), rankOf(e)), s = suitOf(d);
        if (hi - lo === 1) { if ((lo > 0 && !gone((lo - 1) * 4 + s)) || (hi < 12 && !gone((hi + 1) * 4 + s))) return true; }
        else if (hi - lo === 2) { if (!gone((lo + 1) * 4 + s)) return true; }
      }
    }
    return false;
  }

  return { RANKS, SUITS, SUIT_KEYS, PAY, rankOf, suitOf, pts, key, label, sortIds, bySuitRank, meldKind, isMeld, orderMeld, candidates, solve, arrangements, canEat, canDiscard, fits, liveCa, mulberry32, shuffled, Game };
});
