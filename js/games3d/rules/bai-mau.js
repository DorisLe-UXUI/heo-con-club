/* Bài Màu rules (UNO-style card game), pure: no DOM, no three.js.
 * Cards are { id, c: 'red'|'green'|'blue'|'yellow'|'wild', v: '0'..'9'|'skip'|'reverse'|'draw2'|'wild'|'draw4', key: texture key }.
 * A game is a plain state object mutated by play / drawTurn / pass / callUno / catchUno.
 * Seats are numbered 0..n-1; dir = +1 plays 0 → 1 → 2 → 3 (clockwise around the 3D table), dir = -1 the other way.
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['bai-mau'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const COLORS = ['red', 'green', 'blue', 'yellow'];
  const COLOR_NAME = { red: 'Đỏ', green: 'Xanh lá', blue: 'Xanh dương', yellow: 'Vàng', wild: 'Đổi màu' };
  const ACTIONS = ['skip', 'reverse', 'draw2'];
  const VALUE_NAME = { skip: 'Cấm', reverse: 'Đảo chiều', draw2: '+2', wild: 'Đổi màu', draw4: '+4' };
  const DECK_SIZE = 108;

  function mkCard(id, c, v) { return { id, c, v, key: c === 'wild' ? (v === 'wild' ? 'bm_wild' : 'bm_wild_draw4') : `bm_${c}_${v}` }; }
  /** Standard 108-card deck: per colour one 0, two each of 1–9, skip, reverse, draw2; plus 4 wild and 4 wild draw4. */
  function makeDeck() {
    const d = []; let id = 0;
    for (const c of COLORS) {
      d.push(mkCard(id++, c, '0'));
      for (let k = 0; k < 2; k++) {
        for (let n = 1; n <= 9; n++) d.push(mkCard(id++, c, String(n)));
        for (const a of ACTIONS) d.push(mkCard(id++, c, a));
      }
    }
    for (let k = 0; k < 4; k++) { d.push(mkCard(id++, 'wild', 'wild')); d.push(mkCard(id++, 'wild', 'draw4')); }
    return d;
  }
  function shuffle(a, rng = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  /** Small seeded PRNG (mulberry32) for reproducible games and tests. */
  function rng32(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const isAction = c => ACTIONS.includes(c.v);
  const isWild = c => c.c === 'wild';
  /** Points left in a hand at the end: numbers face value, skip/reverse/+2 = 20, wild/+4 = 50. */
  function points(c) { return isWild(c) ? 50 : isAction(c) ? 20 : +c.v; }
  function handPoints(h) { return h.reduce((s, c) => s + points(c), 0); }
  function cardName(c) { return isWild(c) ? VALUE_NAME[c.v] : `${VALUE_NAME[c.v] || c.v} ${COLOR_NAME[c.c]}`; }

  /** Is `c` playable on `top` with the current colour, holding `hand`?
   *  Wild: always. Wild +4: only when the hand has no card of the current colour (official rule, enforced instead of challenged).
   *  Others: same colour, or same number / symbol as the top card. */
  function isLegal(c, top, color, hand) {
    if (c.v === 'wild') return true;
    if (c.v === 'draw4') return !(hand || []).some(h => h.c === color);
    return c.c === color || (!!top && c.v === top.v);
  }

  const top = st => st.discard[st.discard.length - 1];
  const next = (st, p, k = 1) => (((p + st.dir * k) % st.n) + st.n) % st.n;
  /** Can player p play card c right now? (After drawing, only the drawn card may be played.) */
  function canPlay(st, p, c) { if (st.over || st.turn !== p) return false; if (st.drawnId >= 0 && c.id !== st.drawnId) return false; return isLegal(c, top(st), st.color, st.hands[p]); }
  function legalMoves(st, p) { return st.hands[p].filter(c => canPlay(st, p, c)); }

  /** Draw k cards for p (reshuffling the discard pile under the top card when the draw pile runs out). */
  function drawN(st, p, k) {
    const got = [];
    for (let i = 0; i < k; i++) {
      if (!st.draw.length) reshuffle(st);
      if (!st.draw.length) break;            // every card is in someone's hand: nothing to draw
      const c = st.draw.pop(); st.hands[p].push(c); got.push(c);
    }
    if (got.length) { st.unoCalled[p] = false; if (st.unoPending === p) st.unoPending = -1; }
    return got;
  }
  function reshuffle(st) {
    if (st.discard.length <= 1) return false;
    const t = st.discard.pop(); const rest = st.discard; st.discard = [t];
    st.draw = shuffle(rest, st.rng).concat(st.draw); st.reshuffles++;
    return true;
  }

  /** New game. opts: { players=4, handSize=7, dealer=n-1, rng, deck (top of the draw pile = last element), maxTurns=1500 }.
   *  The player after the dealer starts. A wild/+4 turned up as the first card goes back into the deck.
   *  A first skip skips that player, a first reverse lets the dealer start the other way, a first +2 makes the first player draw 2 and lose the turn. */
  function newGame(opts = {}) {
    const n = opts.players || 4, rng = opts.rng || Math.random, handSize = opts.handSize == null ? 7 : opts.handSize;
    const dealer = opts.dealer == null ? n - 1 : opts.dealer;
    const st = {
      n, rng, dealer, draw: opts.deck ? opts.deck.slice() : shuffle(makeDeck(), rng), discard: [], hands: Array.from({ length: n }, () => []),
      color: null, dir: 1, turn: 0, winner: -1, over: false, reason: null, turns: 0, reshuffles: 0, maxTurns: opts.maxTurns || 1500,
      unoCalled: Array(n).fill(false), unoPending: -1, drawnId: -1, start: null,
    };
    for (let k = 0; k < handSize; k++) for (let p = 0; p < n; p++) st.hands[(dealer + 1 + p) % n].push(st.draw.pop());
    let first, guard = 0;
    for (;;) {
      first = st.draw.pop();
      if (!isWild(first) || guard++ > 200) break;
      st.draw.splice(Math.floor(rng() * Math.max(1, st.draw.length - 10)), 0, first);   // back into the deck, away from the top
    }
    st.discard.push(first); st.color = first.c;
    const p1 = next(st, dealer);
    const ev = { type: 'start', card: first };
    if (first.v === 'skip') { ev.skipped = p1; st.turn = next(st, p1); }
    else if (first.v === 'reverse') { st.dir = -1; ev.reversed = true; st.turn = dealer; }   // the dealer starts, play goes the other way
    else if (first.v === 'draw2') { ev.victim = p1; ev.drawn = drawN(st, p1, 2); st.turn = next(st, p1); }
    else st.turn = p1;
    st.start = ev;
    return st;
  }

  /** Build a game in a given position (for tests and puzzles). */
  function setup({ hands, top: t, color, dir = 1, turn = 0, draw = [], discard = [], rng = Math.random, maxTurns = 1500 }) {
    const n = hands.length;
    return { n, rng, dealer: 0, draw: draw.slice(), discard: discard.concat([t]), hands: hands.map(h => h.slice()), color: color || t.c, dir, turn, winner: -1, over: false, reason: null, turns: 0, reshuffles: 0, maxTurns, unoCalled: Array(n).fill(false), unoPending: -1, drawnId: -1, start: null };
  }

  function closeUnoWindow(st, actor) { if (st.unoPending >= 0 && st.unoPending !== actor) st.unoPending = -1; }
  function checkLimit(st) {
    if (st.over || st.turns < st.maxTurns) return;
    // safety valve (never reached by normal play): lowest hand wins
    let best = 0; st.hands.forEach((h, i) => { if (handPoints(h) < handPoints(st.hands[best])) best = i; });
    st.over = true; st.winner = best; st.reason = 'limit';
  }

  /** Play card `id` from p's hand. chosen = colour for wild cards. Returns an event describing the effects. */
  function play(st, p, id, chosen) {
    if (st.over) throw new Error('game over');
    if (st.turn !== p) throw new Error('not your turn');
    const hand = st.hands[p], i = hand.findIndex(c => c.id === id);
    if (i < 0) throw new Error('card not in hand');
    const c = hand[i];
    if (!canPlay(st, p, c)) throw new Error('illegal card ' + c.key);
    closeUnoWindow(st, p);
    hand.splice(i, 1); st.discard.push(c); st.drawnId = -1; st.turns++;
    const ev = { type: 'play', p, card: c };
    st.color = isWild(c) ? (COLORS.includes(chosen) ? chosen : bestColor(hand, st.rng)) : c.c;
    ev.color = st.color;
    if (hand.length === 1) { if (st.unoCalled[p]) ev.uno = true; else { st.unoPending = p; ev.forgotUno = true; } }
    else st.unoCalled[p] = false;
    let nxt = next(st, p);
    if (c.v === 'skip') { ev.skipped = nxt; nxt = next(st, nxt); }
    else if (c.v === 'reverse') {
      if (st.n === 2) { ev.skipped = nxt; nxt = p; }         // two players: reverse works like skip
      else { st.dir = -st.dir; nxt = next(st, p); }
      ev.reversed = true; ev.dir = st.dir;
    } else if (c.v === 'draw2' || c.v === 'draw4') {
      ev.victim = nxt; ev.drawn = drawN(st, nxt, c.v === 'draw2' ? 2 : 4); nxt = next(st, nxt);
    }
    if (!hand.length) { st.over = true; st.winner = p; st.reason = 'empty'; st.unoPending = -1; }
    st.turn = nxt;
    checkLimit(st);
    return ev;
  }

  /** p cannot (or does not want to) play: draw one card. If it is playable the player may play it (play) or keep it (pass);
   *  otherwise the turn passes immediately. */
  function drawTurn(st, p) {
    if (st.over) throw new Error('game over');
    if (st.turn !== p) throw new Error('not your turn');
    if (st.drawnId >= 0) throw new Error('already drew');
    closeUnoWindow(st, p);
    const got = drawN(st, p, 1), c = got[0] || null;
    if (c && isLegal(c, top(st), st.color, st.hands[p])) { st.drawnId = c.id; return { type: 'draw', p, card: c, playable: true }; }
    st.turn = next(st, p); st.turns++; checkLimit(st);
    return { type: 'draw', p, card: c, playable: false };
  }
  /** Keep the playable card just drawn and end the turn. */
  function pass(st, p) {
    if (st.turn !== p || st.drawnId < 0) throw new Error('cannot pass');
    st.drawnId = -1; st.turn = next(st, p); st.turns++; checkLimit(st);
    return { type: 'pass', p };
  }

  /** Say "UNO!": with 2 cards on your turn (before playing), or with 1 card while you are still exposed. */
  function canCallUno(st, p) {
    const h = st.hands[p].length;
    if (st.over || st.unoCalled[p] && h <= 2) return false;
    return (h === 2 && st.turn === p && legalMoves(st, p).length > 0) || (h === 1 && st.unoPending === p);
  }
  function callUno(st, p) {
    if (!canCallUno(st, p)) return false;
    st.unoCalled[p] = true; if (st.unoPending === p) st.unoPending = -1;
    return true;
  }
  /** Someone else catches a player who went down to one card without saying UNO: that player draws 2. */
  function catchUno(st, catcher) {
    const t = st.unoPending;
    if (st.over || t < 0 || t === catcher || st.hands[t].length !== 1) return null;
    st.unoPending = -1;
    const cards = drawN(st, t, 2);
    return { target: t, catcher, cards };
  }

  /** Winner scores the points left in the other hands. */
  function score(st) {
    const per = st.hands.map(handPoints); let pts = 0;
    per.forEach((v, i) => { if (i !== st.winner) pts += v; });
    return { winner: st.winner, points: pts, per };
  }
  /** Everyone puts `stake` in the pot, the winner takes it: coin change per seat. */
  function settle(n, winner, stake) { return Array.from({ length: n }, (_, i) => (i === winner ? stake * (n - 1) : -stake)); }

  /** Colour a player should name: the colour worth most in the hand (random if only wilds left). */
  function bestColor(hand, rng = Math.random) {
    const w = { red: 0, green: 0, blue: 0, yellow: 0 };
    for (const c of hand) if (!isWild(c)) w[c.c] += 10 + points(c) / 4;
    const best = Math.max(...COLORS.map(c => w[c]));
    const top = COLORS.filter(c => w[c] === best);
    return top[Math.floor(rng() * top.length)];
  }
  /** Bot heuristic: returns { id, color } or null when nothing is playable (then draw).
   *  level (room tier) 0 = dễ: plays a random legal card half of the time and picks a random colour; undefined/1+ = heuristic. */
  function botMove(st, p, rng = Math.random, level) {
    const legal = legalMoves(st, p); if (!legal.length) return null;
    if (level === 0 && rng() < .5) { const c = legal[Math.floor(rng() * legal.length)]; return { id: c.id, color: isWild(c) ? COLORS[Math.floor(rng() * 4)] : null }; }
    const hand = st.hands[p], nextN = st.hands[next(st, p)].length, cnt = { red: 0, green: 0, blue: 0, yellow: 0 };
    for (const c of hand) if (!isWild(c)) cnt[c.c]++;
    let best = null, bestS = -1e9;
    for (const c of legal) {
      let s = points(c) * .6 + (isWild(c) ? 0 : cnt[c.c] * 4) + rng() * 3;
      if (isAction(c) || c.v === 'draw4') s += nextN <= 2 ? 45 : 4;          // attack a player close to winning
      if (isWild(c)) s -= legal.length > 1 && hand.length > 2 ? 60 : 0;       // keep wilds for later
      if (s > bestS) { bestS = s; best = c; }
    }
    const rest = hand.filter(c => c !== best);
    return { id: best.id, color: isWild(best) ? bestColor(rest, rng) : null };
  }
  function countCards(st) { return st.draw.length + st.discard.length + st.hands.reduce((s, h) => s + h.length, 0); }

  return { COLORS, COLOR_NAME, VALUE_NAME, ACTIONS, DECK_SIZE, makeDeck, mkCard, shuffle, rng32, points, handPoints, cardName, isLegal, isWild, isAction,
    newGame, setup, top, next, canPlay, legalMoves, play, drawTurn, pass, drawN, reshuffle, canCallUno, callUno, catchUno, score, settle, bestColor, botMove, countCards };
});
