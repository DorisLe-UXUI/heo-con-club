/* Shared pure helpers for the 52-card table games (Bài Cào, Liêng, Poker): deck, suit order, seeded RNG,
 * a no-limit betting engine (antes, blinds, raises, short all-ins, optional raise cap) and side pots.
 * No DOM, no three.js. Cards are {r:'A'|'2'..'10'|'J'|'Q'|'K', s:'spades'|'clubs'|'diamonds'|'hearts', key:'<s>_<r>'}
 * (the same shape as ctx.deck()). */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['cards-common'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SUITS = ['spades', 'clubs', 'diamonds', 'hearts'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  /** Vietnamese suit order used for tie-breaks: rô ♦ > cơ ♥ > bích ♠ > chuồn ♣. */
  const SUIT_RANK = { diamonds: 4, hearts: 3, spades: 2, clubs: 1 };
  const SUIT_SYM = { diamonds: '♦', hearts: '♥', spades: '♠', clubs: '♣' };
  /** Rank value with the ace high (2..14). */
  const hi = r => (r === 'A' ? 14 : r === 'K' ? 13 : r === 'Q' ? 12 : r === 'J' ? 11 : +r);
  const rankLabel = v => (v === 14 || v === 1 ? 'A' : v === 13 ? 'K' : v === 12 ? 'Q' : v === 11 ? 'J' : String(v));
  const card = (r, s) => ({ r, s, key: s + '_' + r });
  const LETTER = { d: 'diamonds', h: 'hearts', s: 'spades', c: 'clubs', '♦': 'diamonds', '♥': 'hearts', '♠': 'spades', '♣': 'clubs' };
  /** 'A♦ 10s Kh' → cards (handy in tests). */
  function parse(str) { return str.trim().split(/\s+/).map(t => { const s = LETTER[t.slice(-1)]; const r = t.slice(0, -1).toUpperCase(); if (!s || !RANKS.includes(r)) throw new Error('bad card ' + t); return card(r, s); }); }
  const name = c => c.r + SUIT_SYM[c.s];
  function shuffle(a, rng = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function deck(rng) { const d = []; for (const s of SUITS) for (const r of RANKS) d.push(card(r, s)); return rng ? shuffle(d, rng) : d; }
  /** Small seeded RNG (mulberry32) for reproducible tests. */
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ================================================================ no-limit betting engine
  // A hand: st = table(stacks, {minRaise, raiseCap, unit}). Each player: {i, stack, bet (this street), total (this hand),
  // folded, allIn, out, actedAt}. actedAt = the bet level the player last acted at (null = has not acted this street).
  // Only a full raise (≥ the last raise size) re-opens raising for players who already acted ("fullLevel").
  function table(stacks, o = {}) {
    return {
      players: stacks.map((s, i) => ({ i, stack: s, bet: 0, total: 0, folded: false, allIn: false, out: !(s > 0), actedAt: null })),
      currentBet: 0, minRaise: o.minRaise || 1, bigBlind: o.minRaise || 1, fullLevel: 0, raises: 0,
      raiseCap: o.raiseCap == null ? Infinity : o.raiseCap, unit: o.unit || 1,
    };
  }
  const inHand = p => !p.folded && !p.out;
  const canAct = p => inHand(p) && !p.allIn;
  function take(p, x) { x = Math.max(0, Math.min(x, p.stack)); p.stack -= x; p.total += x; if (p.stack === 0) p.allIn = true; return x; }
  /** Dead-money ante (does not count toward calling). Returns the amount actually posted. */
  function ante(st, i, amt) { const p = st.players[i]; return p.out ? 0 : take(p, amt); }
  /** Live blind: counts as this street's bet. */
  function blind(st, i, amt) { const p = st.players[i]; if (p.out) return 0; const x = take(p, amt); p.bet += x; st.currentBet = Math.max(st.currentBet, p.bet); return x; }
  /** Start a betting round. For preflop pass {level: bigBlind} after posting blinds so callers must match the full blind. */
  function street(st, o = {}) {
    if (!o.keepBets) for (const p of st.players) p.bet = 0;
    for (const p of st.players) p.actedAt = null;
    st.currentBet = o.level != null ? Math.max(o.level, ...st.players.map(p => p.bet)) : Math.max(0, ...st.players.map(p => p.bet));
    st.fullLevel = st.currentBet; st.raises = 0;
    if (o.minRaise) st.minRaise = st.bigBlind = o.minRaise; else st.minRaise = st.bigBlind;
  }
  function toCall(st, i) { const p = st.players[i]; return Math.max(0, Math.min(st.currentBet - p.bet, p.stack)); }
  function canRaise(st, i) {
    const p = st.players[i];
    if (!canAct(p) || st.raises >= st.raiseCap) return false;
    if (p.bet + p.stack <= st.currentBet) return false;                       // can only call (all-in)
    if (p.actedAt != null && st.fullLevel <= p.actedAt) return false;          // a short all-in did not re-open raising
    return st.players.some(q => q !== p && canAct(q));                         // someone must be able to answer
  }
  /** Legal options for player i: {fold, check, call (amount), raise: {min, max} | null, allIn (stack)}. Raise values are "raise to" levels. */
  function legal(st, i) {
    const p = st.players[i], tc = toCall(st, i);
    const L = { fold: true, check: tc === 0, call: tc, raise: null, allIn: p.stack, toCall: tc, bet: p.bet, stack: p.stack, currentBet: st.currentBet };
    if (canRaise(st, i)) { const max = p.bet + p.stack; L.raise = { min: Math.min(max, st.currentBet + Math.max(st.minRaise, st.unit)), max }; }
    return L;
  }
  /** Apply an action {type:'fold'|'check'|'call'|'raise'|'allin', to}. Raise amounts are clamped into the legal range.
   *  Returns {type, put (chips moved from stack to pot), to, allIn, full}. Throws if the player cannot act. */
  function act(st, i, a) {
    const p = st.players[i];
    if (!canAct(p)) throw new Error('player ' + i + ' cannot act');
    let type = a.type;
    const tc = toCall(st, i);
    if (type === 'allin') type = p.bet + p.stack > st.currentBet && canRaise(st, i) ? 'raise' : 'call';
    if (type === 'raise' && !canRaise(st, i)) type = 'call';
    if (type === 'check' && tc > 0) throw new Error('cannot check facing a bet');
    if (type === 'fold') { p.folded = true; p.actedAt = st.currentBet; return { type, put: 0 }; }
    if (type === 'check' || (type === 'call' && tc === 0)) { p.actedAt = st.currentBet; return { type: 'check', put: 0 }; }
    if (type === 'call') { const put = take(p, tc); p.bet += put; p.actedAt = st.currentBet; return { type, put, to: p.bet, allIn: p.allIn }; }
    // raise
    const max = p.bet + p.stack, min = Math.min(max, st.currentBet + Math.max(st.minRaise, st.unit));
    let to = a.type === 'allin' ? max : Math.round(a.to || 0);
    to = Math.max(min, Math.min(max, to));
    const put = take(p, to - p.bet); p.bet += put;
    const inc = p.bet - st.currentBet, full = inc >= st.minRaise;
    if (full) { st.minRaise = inc; st.fullLevel = p.bet; st.raises++; }
    st.currentBet = p.bet; p.actedAt = p.bet;
    return { type: 'raise', put, to: p.bet, allIn: p.allIn, full };
  }
  const needsAction = (st, p) => canAct(p) && (p.actedAt == null || p.bet < st.currentBet);
  function streetDone(st) {
    const live = st.players.filter(inHand);
    if (live.length <= 1) return true;
    const actors = live.filter(p => !p.allIn);
    if (!actors.length) return true;
    if (actors.length === 1 && actors[0].bet >= st.currentBet) return true;   // nobody left to bet against
    return !actors.some(p => needsAction(st, p));
  }
  /** Next player (after seat `from`) who still has to act this street, or -1 when the street is over. */
  function nextActor(st, from) {
    if (streetDone(st)) return -1;
    const n = st.players.length;
    for (let k = 1; k <= n; k++) { const j = (((from + k) % n) + n) % n; if (needsAction(st, st.players[j])) return j; }
    return -1;
  }
  /** True when at most one player can still bet: remaining streets are dealt without betting. */
  const bettingClosed = st => st.players.filter(canAct).length <= 1 && streetDone(st);
  const liveCount = st => st.players.filter(inHand).length;
  const potTotal = st => st.players.reduce((a, p) => a + p.total, 0);
  const chipsInPlay = st => st.players.reduce((a, p) => a + p.total + p.stack, 0);

  // ================================================================ side pots & payouts
  /** Split everyone's contributions into a main pot and side pots: [{amount, eligible:[seat]}]. Folded money stays in. */
  function pots(players) {
    const n = players.length, rem = players.map(p => p.total), res = [];
    for (let guard = 0; guard < 64; guard++) {
      const live = []; for (let i = 0; i < n; i++) if (inHand(players[i]) && rem[i] > 0) live.push(i);
      if (!live.length) {
        const left = rem.reduce((a, b) => a + b, 0);
        if (left > 0) { if (res.length) res[res.length - 1].amount += left; else res.push({ amount: left, eligible: players.filter(inHand).map(p => p.i) }); }
        break;
      }
      const m = Math.min(...live.map(i => rem[i]));
      let amt = 0; for (let i = 0; i < n; i++) { const x = Math.min(rem[i], m); amt += x; rem[i] -= x; }
      res.push({ amount: amt, eligible: live });
    }
    return res;
  }
  /** Award pots. cmp(i, j) > 0 when seat i's hand beats seat j's. Ties split evenly; odd coins go to winners in `order`
   *  (seats clockwise from the dealer's left). Returns {pay:[per seat], detail:[{amount, eligible, winners, share}]}. */
  function award(players, potList, cmp, order) {
    const pay = players.map(() => 0), detail = [];
    const ord = order || players.map((_, i) => i);
    for (const pot of potList) {
      let win = [];
      for (const i of pot.eligible) { if (!win.length) { win = [i]; continue; } const c = cmp(i, win[0]); if (c > 0) win = [i]; else if (c === 0) win.push(i); }
      if (!win.length) continue;
      const share = Math.floor(pot.amount / win.length); let odd = pot.amount - share * win.length;
      win.forEach(i => { pay[i] += share; });
      const w2 = ord.filter(i => win.includes(i));
      for (let k = 0; odd > 0; k++, odd--) pay[w2[k % w2.length]] += 1;
      detail.push({ amount: pot.amount, eligible: pot.eligible.slice(), winners: win.slice(), share });
    }
    return { pay, detail };
  }
  /** Round a chip amount to a multiple of `unit` (but never above `max`). */
  const roundTo = (x, unit, min, max) => Math.max(min, Math.min(max, Math.round(x / unit) * unit));

  return { SUITS, RANKS, SUIT_RANK, SUIT_SYM, hi, rankLabel, card, parse, name, shuffle, deck, seeded,
    table, ante, blind, street, toCall, canRaise, legal, act, streetDone, nextActor, needsAction, bettingClosed, liveCount, potTotal, chipsInPlay, inHand, canAct,
    pots, award, roundTo };
});
