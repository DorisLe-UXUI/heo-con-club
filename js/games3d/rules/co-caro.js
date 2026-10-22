/* Cờ Caro (Gomoku) rules + AI — pure, no DOM. UMD: window.Rules['co-caro'] in the browser, module.exports in Node.
 *
 * Board: 15 × 15 cells, index = row * 15 + col. 0 empty, 1 = X (you, moves first), 2 = O (bot).
 * Win: 5 or more stones in a row (horizontal, vertical or diagonal). Blocked fives (both ends closed) still win; 6+ also wins.
 * Draw: the board is full.
 *
 * AI: line patterns around each empty cell are classified (five, open four, four, open three, three, open two, two) through a
 * precomputed table of every 9-cell line shape, then moves are chosen by tiers: win > block a five > make an unstoppable
 * threat (open four / four-four / four-three) > stop the opponent's unstoppable threat > best attack + defence score.
 * Khó adds a VCF search (win by continuous fours) for itself and checks that its move kills the opponent's VCF.
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['co-caro'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SIZE = 15, NN = SIZE * SIZE, X = 1, O = 2;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const idx = (r, c) => r * SIZE + c, rowOf = i => (i / SIZE) | 0, colOf = i => i % SIZE;
  const LEVELS = ['de', 'vua', 'kho'];

  /** Stones in a row through i (including i) in direction d, as a list of indices, for the stone colour at i. */
  function runAt(b, i, dr, dc) {
    const s = b[i], r = rowOf(i), c = colOf(i), out = [i];
    for (let k = 1; ; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE || b[idx(rr, cc)] !== s) break; out.push(idx(rr, cc)); }
    for (let k = 1; ; k++) { const rr = r - dr * k, cc = c - dc * k; if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE || b[idx(rr, cc)] !== s) break; out.unshift(idx(rr, cc)); }
    return out;
  }
  /** If the stone at i is part of 5+ in a row, return that line (indices, ordered), else null. */
  function winLine(b, i) {
    if (!b[i]) return null;
    for (const [dr, dc] of DIRS) { const run = runAt(b, i, dr, dc); if (run.length >= 5) return run; }
    return null;
  }
  /** Scan the whole board for a winner: { winner, line } or null. */
  function findWinner(b) { for (let i = 0; i < NN; i++) if (b[i]) { const l = winLine(b, i); if (l) return { winner: b[i], line: l }; } return null; }
  const isFull = b => { for (let i = 0; i < NN; i++) if (!b[i]) return false; return true; };

  // ------------------------------------------------------------------ pattern table
  // A line of 9 cells centred on the candidate cell (which counts as own): each other cell is 0 empty, 1 own, 2 blocked
  // (opponent stone or off the board). Category: 7 five, 6 open four, 5 four, 4 open three, 3 three, 2 open two, 1 two, 0 none.
  const FIVE = 7, L4 = 6, F4 = 5, L3 = 4, F3 = 3, L2 = 2, F2 = 1;
  function comps(L) {           // empty cells that complete five in a 5-window containing the centre
    let mask = 0, five = false;
    for (let s = 0; s <= 4; s++) {
      let ones = 0, empty = -1, bad = false;
      for (let k = s; k < s + 5; k++) { const v = L[k]; if (v === 2) { bad = true; break; } if (v === 1) ones++; else empty = k; }
      if (bad) continue;
      if (ones === 5) five = true; else if (ones === 4) mask |= 1 << empty;
    }
    return { five, n: popcount(mask) };
  }
  function popcount(m) { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; }
  function level3(L) {
    let best = 0;
    for (let e = 0; e < 9; e++) {
      if (L[e] !== 0) continue;
      L[e] = 1; const c = comps(L); L[e] = 0;
      if (c.n >= 2) return L3; if (c.n === 1) best = F3;
    }
    return best;
  }
  function classify(L) {
    const c = comps(L);
    if (c.five) return FIVE;
    if (c.n >= 2) return L4;
    if (c.n === 1) return F4;
    const t = level3(L); if (t) return t;
    let best = 0;
    for (let e = 0; e < 9; e++) {
      if (L[e] !== 0) continue;
      L[e] = 1; const t2 = level3(L); L[e] = 0;
      if (t2 === L3) return L2; if (t2 === F3) best = F2;
    }
    return best;
  }
  const TABLE = new Uint8Array(6561);
  (function build() {
    const L = new Array(9);
    for (let code = 0; code < 6561; code++) {
      let x = code;
      for (let k = 0; k < 9; k++) { if (k === 4) { L[k] = 1; continue; } L[k] = x % 3; x = (x / 3) | 0; }
      TABLE[code] = classify(L);
    }
  })();
  /** Categories (4 directions) if player s plays on empty cell i. */
  function cats(b, i, s, out) {
    const r = rowOf(i), c = colOf(i);
    for (let d = 0; d < 4; d++) {
      const dr = DIRS[d][0], dc = DIRS[d][1]; let code = 0, mul = 1;
      for (let k = -4; k <= 4; k++) {
        if (k === 0) continue;
        const rr = r + dr * k, cc = c + dc * k; let v;
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) v = 2; else { const q = b[rr * SIZE + cc]; v = q === 0 ? 0 : q === s ? 1 : 2; }
        code += v * mul; mul *= 3;
      }
      out[d] = TABLE[code];
    }
    return out;
  }
  const W_FIVE = 1e8, W_WIN = 2e6, W_43 = 1e6, W_33 = 2e5;
  const tmp = [0, 0, 0, 0];
  /** Attack value of playing s on i (higher = stronger threat). */
  function cellScore(b, i, s) {
    cats(b, i, s, tmp);
    let five = 0, l4 = 0, f4 = 0, l3 = 0, f3 = 0, l2 = 0, f2 = 0;
    for (let d = 0; d < 4; d++) switch (tmp[d]) { case FIVE: five++; break; case L4: l4++; break; case F4: f4++; break; case L3: l3++; break; case F3: f3++; break; case L2: l2++; break; case F2: f2++; break; }
    if (five) return W_FIVE;
    if (l4 || f4 >= 2) return W_WIN;
    if (f4 && l3) return W_43;
    if (l3 >= 2) return W_33;
    return f4 * 2600 + l3 * 2500 + f3 * 320 + l2 * 260 + f2 * 45 + 1;
  }
  /** Does s make (at least) a four by playing i? */
  function makesFour(b, i, s) { cats(b, i, s, tmp); for (let d = 0; d < 4; d++) if (tmp[d] >= F4) return true; return false; }

  /** Empty cells within distance `dist` of any stone (the centre if the board is empty). */
  function candidates(b, dist = 2) {
    const mark = new Uint8Array(NN), out = []; let any = false;
    for (let i = 0; i < NN; i++) {
      if (!b[i]) continue; any = true;
      const r = rowOf(i), c = colOf(i);
      for (let dr = -dist; dr <= dist; dr++) for (let dc = -dist; dc <= dist; dc++) {
        const rr = r + dr, cc = c + dc; if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
        const j = rr * SIZE + cc; if (!b[j] && !mark[j]) { mark[j] = 1; out.push(j); }
      }
    }
    if (!any) out.push(idx(7, 7));
    return out;
  }
  /** Cells where s would make five right now. */
  function fiveCells(b, s, cand) { const out = []; for (const i of cand || candidates(b, 1)) if (!b[i] && cellScore(b, i, s) >= W_FIVE) out.push(i); return out; }

  /** Victory by continuous fours for s (s to move). Returns the first move or -1. */
  function vcf(b, s, maxDepth = 12, budget = { n: 4000 }) {
    const opp = 3 - s;
    function rec(depth) {
      if (--budget.n < 0) return -1;
      const cand = candidates(b, 1);
      for (const i of cand) if (cellScore(b, i, s) >= W_FIVE) return i;
      if (depth >= maxDepth) return -1;
      if (fiveCells(b, opp, cand).length) return -1;         // opponent threatens five: our fours are not forcing any more
      for (const i of cand) {
        if (!makesFour(b, i, s)) continue;
        const sc = cellScore(b, i, s);
        b[i] = s;
        const blocks = fiveCells(b, s);
        if (sc >= W_WIN && blocks.length >= 2) { b[i] = 0; return i; }   // open four / double four: wins
        if (blocks.length === 1) {
          const k = blocks[0]; b[k] = opp;
          const oppFive = winLine(b, k);
          const r = oppFive ? -1 : rec(depth + 1);
          b[k] = 0; b[i] = 0;
          if (r >= 0) return i;
        } else b[i] = 0;
      }
      return -1;
    }
    return rec(0);
  }

  /**
   * Khó: small negamax over the most promising cells (threat-aware: forced blocks, fours, open fours are resolved exactly,
   * quiet positions are scored by the best attack values of both sides). Node budget keeps it well under a second.
   */
  const WIN = 1e9;
  const KHO = { depth: 6, width: 7, nodes: 14000, dw: 1, ms: 650 };
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function threatSearch(b, s, rootMoves, rand, depth = KHO.depth, width = KHO.width) {
    const budget = { n: KHO.nodes }, t0 = clock();
    function rowsFor(side) {
      const opp = 3 - side, cand = candidates(b, 2), rows = new Array(cand.length);
      for (let k = 0; k < cand.length; k++) { const i = cand[k]; rows[k] = { i, a: cellScore(b, i, side), d: cellScore(b, i, opp) }; }
      return rows;
    }
    function staticEval(rows) {
      let a1 = 0, a2 = 0, d1 = 0, d2 = 0;
      for (const x of rows) { if (x.a > a1) { a2 = a1; a1 = x.a; } else if (x.a > a2) a2 = x.a; if (x.d > d1) { d2 = d1; d1 = x.d; } else if (x.d > d2) d2 = x.d; }
      return (a1 + a2 * .5) * 1.2 - (d1 + d2 * KHO.dw);
    }
    function nm(side, d, alpha, beta, ply) {
      if ((--budget.n & 63) === 0 && clock() - t0 > KHO.ms) budget.n = -1;
      const rows = rowsFor(side);
      if (!rows.length) return 0;
      let maxA = 0; for (const x of rows) if (x.a > maxA) maxA = x.a;
      if (maxA >= W_FIVE) return WIN - ply;                              // we make five
      const forced = rows.filter(x => x.d >= W_FIVE);
      if (forced.length >= 2) return -(WIN - ply - 1);                   // two fives to block: lost
      let moves;
      if (forced.length === 1) moves = [forced[0].i];
      else {
        if (maxA >= W_WIN) return WIN - ply - 2;                         // open four / double four: wins next move
        if (d <= 0 || budget.n < 0) return staticEval(rows);
        const oppStrong = rows.some(x => x.d >= W_43);
        const val = x => x.a + x.d * (oppStrong ? 1.15 : .9);
        rows.sort((p, q) => val(q) - val(p));
        moves = rows.slice(0, width).map(x => x.i);
        if (oppStrong) for (const x of rows) if (x.a >= 2600 && !moves.includes(x.i)) moves.push(x.i);   // counter with our own fours
      }
      let best = -Infinity;
      for (const m of moves) {
        b[m] = side;
        const v = -nm(3 - side, forced.length === 1 && ply < 10 ? d : d - 1, -beta, -alpha, ply + 1);
        b[m] = 0;
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return best;
    }
    // iterative deepening: keep the best move of the deepest fully searched depth
    let order = rootMoves.slice(), best = order[0];
    for (let D = 2; D <= depth; D++) {
      const res = []; let alpha = -Infinity, complete = true;
      for (const m of order) {
        b[m] = s;
        const v = -nm(3 - s, D - 1, -Infinity, -alpha, 1) + rand() * 2;
        b[m] = 0;
        if (budget.n < 0) { complete = false; break; }
        res.push([m, v]); if (v > alpha) alpha = v;
      }
      if (!complete) break;
      res.sort((p, q) => q[1] - p[1]); order = res.map(r => r[0]); best = order[0];
      if (res[0][1] > WIN / 2 || res[0][1] < -WIN / 2) break;     // forced win found / everything loses
    }
    return best;
  }

  /**
   * Choose a move for player s. level: 'de' | 'vua' | 'kho'. rand: () => [0,1).
   * Returns a cell index (always an empty cell; -1 only if the board is full).
   */
  function bestMove(b0, s, level = 'vua', rand = Math.random) {
    const b = Int8Array.from(b0), opp = 3 - s;
    const cand = candidates(b, 2);
    if (!cand.length) return -1;
    const rows = cand.map(i => ({ i, a: cellScore(b, i, s), d: cellScore(b, i, opp), n: rand() }));
    const top = (arr, key) => arr.reduce((m, x) => (key(x) > key(m) ? x : m), arr[0]);
    // 1. win now
    const wins = rows.filter(x => x.a >= W_FIVE); if (wins.length) return wins[0].i;
    // 2. block the opponent's five
    const blocks = rows.filter(x => x.d >= W_FIVE);
    if (blocks.length && (level !== 'de' || rand() < .6)) return top(blocks, x => x.a + x.n).i;
    if (level === 'de') {
      const sorted = rows.map(x => ({ i: x.i, v: (x.a + x.d * .45) * (.7 + x.n * .6) })).sort((p, q) => q.v - p.v);
      return sorted[Math.floor(rand() * Math.min(4, sorted.length))].i;
    }
    // 3. Khó: win by continuous fours
    if (level === 'kho' && !blocks.length) { const v = vcf(b, s); if (v >= 0) return v; }
    // 4. unstoppable threat of our own (open four, four-four, four-three)
    if (!blocks.length) { const strong = rows.filter(x => x.a >= W_43); if (strong.length) return top(strong, x => x.a + x.d * .5 + x.n).i; }
    // 5. general value: attack + defence (defence weighted up when the opponent is about to make an unstoppable threat)
    const oppStrong = rows.some(x => x.d >= W_43);
    const value = x => x.a + x.d * (oppStrong ? 1.15 : .9) + x.n * 3;
    rows.sort((p, q) => value(q) - value(p));
    if (level === 'kho') return threatSearch(b, s, rows.slice(0, 10).map(x => x.i), rand);
    return rows[0].i;
  }

  /** Game wrapper used by the 3D module: history, undo, end detection. */
  class Game {
    constructor() { this.b = new Int8Array(NN); this.hist = []; this.turn = X; this.over = null; }
    canPlay(i) { return !this.over && i >= 0 && i < NN && !this.b[i]; }
    play(i) {
      if (!this.canPlay(i)) throw new Error('illegal move ' + i);
      const s = this.turn; this.b[i] = s; this.hist.push(i); this.turn = 3 - s;
      const line = winLine(this.b, i);
      if (line) this.over = { winner: s, line }; else if (isFull(this.b)) this.over = { winner: 0, line: null };
      return this.over;
    }
    undo() { const i = this.hist.pop(); if (i == null) return null; this.b[i] = 0; this.turn = 3 - this.turn; this.over = null; return i; }
  }

  return { KHO, SIZE, NN, X, O, LEVELS, idx, rowOf, colOf, winLine, findWinner, isFull, candidates, cellScore, cats, vcf, bestMove, Game, TABLE, CAT: { FIVE, L4, F4, L3, F3, L2, F2 }, W_FIVE, W_WIN };
});
