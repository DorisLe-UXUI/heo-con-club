/* Cờ Tướng (Xiangqi) rules + AI — pure, no DOM. UMD: window.Rules['co-tuong'] in the browser, module.exports in Node.
 *
 * Board: 90 squares, index = row * 9 + col. Row 0 is Black's back rank (top of the screen), row 9 is Red's back rank.
 * Pieces: red > 0, black < 0, 0 = empty. |piece|: 1 general, 2 advisor, 3 elephant, 4 horse, 5 chariot, 6 cannon, 7 soldier.
 * Side to move: 1 = red (moves first), -1 = black.
 * Moves are ints: (from << 7) | to.
 * Rules: palace for generals/advisors, elephant eye + river, horse leg, cannon screen, soldiers sideways after the river,
 * flying generals, no move may leave your own general attacked. No legal move = loss for the side to move (checkmate AND stalemate).
 * Draws (game layer): 3-fold repetition, 120 plies without a capture, or neither side has an attacking piece left.
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['co-tuong'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const K = 1, A = 2, B = 3, N = 4, R = 5, C = 6, P = 7;
  const NAMES = ['', 'general', 'advisor', 'elephant', 'horse', 'chariot', 'cannon', 'soldier'];
  const VI = ['', 'Tướng', 'Sĩ', 'Tượng', 'Mã', 'Xe', 'Pháo', 'Tốt'];
  const rowOf = s => (s / 9) | 0, colOf = s => s % 9, sq = (r, c) => r * 9 + c;
  const onBoard = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;
  const mv = (f, t) => (f << 7) | t, mFrom = m => m >> 7, mTo = m => m & 127;
  const inPalace = (r, c, side) => c >= 3 && c <= 5 && (side > 0 ? r >= 7 && r <= 9 : r >= 0 && r <= 2);
  const ownHalf = (r, side) => (side > 0 ? r >= 5 : r <= 4);

  // ------------------------------------------------------------------ precomputed move tables
  const T = { king: [[], []], adv: [[], []], ele: [[], []], horse: [], horseAtk: [], pawn: [[], []], rays: [] };
  const si = side => (side > 0 ? 0 : 1);
  for (let s = 0; s < 90; s++) {
    const r = rowOf(s), c = colOf(s);
    for (const side of [1, -1]) {
      const k = si(side);
      T.king[k][s] = []; T.adv[k][s] = []; T.ele[k][s] = []; T.pawn[k][s] = [];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inPalace(r + dr, c + dc, side)) T.king[k][s].push(sq(r + dr, c + dc));
      for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (inPalace(r + dr, c + dc, side)) T.adv[k][s].push(sq(r + dr, c + dc));
      for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) if (onBoard(r + dr, c + dc) && ownHalf(r + dr, side)) T.ele[k][s].push([sq(r + dr, c + dc), sq(r + dr / 2, c + dc / 2)]);
      const fwd = side > 0 ? -1 : 1;
      if (onBoard(r + fwd, c)) T.pawn[k][s].push(sq(r + fwd, c));
      if (!ownHalf(r, side)) for (const dc of [-1, 1]) if (onBoard(r, c + dc)) T.pawn[k][s].push(sq(r, c + dc));
    }
    T.horse[s] = []; T.horseAtk[s] = [];
    for (const [dr, dc] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) {
      const leg = Math.abs(dr) === 2 ? sq(r + dr / 2, c) : sq(r, c + dc / 2);
      if (onBoard(r + dr, c + dc)) T.horse[s].push([sq(r + dr, c + dc), leg]);
      // a horse standing at h = s - (dr,dc) jumps onto s; its leg is next to h
      const hr = r - dr, hc = c - dc;
      if (onBoard(hr, hc)) T.horseAtk[s].push([sq(hr, hc), Math.abs(dr) === 2 ? sq(hr + dr / 2, hc) : sq(hr, hc + dc / 2)]);
    }
    T.rays[s] = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dr, dc]) => { const out = []; let rr = r + dr, cc = c + dc; while (onBoard(rr, cc)) { out.push(sq(rr, cc)); rr += dr; cc += dc; } return out; });
  }

  // ------------------------------------------------------------------ evaluation tables (red's view, row 0 = enemy back rank)
  const VAL = [0, 0, 120, 120, 270, 600, 285, 30];
  const PST = [null,
    /* K */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, -9, -9, -9, 0, 0, 0, 0, 0, 0, -4, -4, -4, 0, 0, 0, 0, 0, 0, 1, 5, 1, 0, 0, 0],
    /* A */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    /* B */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, -2, 0, 0, 0, -2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -2, 0, 0, 0, 4, 0, 0, 0, -2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    /* N */ [4, 8, 16, 12, 4, 12, 16, 8, 4, 4, 10, 28, 16, 8, 16, 28, 10, 4, 12, 14, 16, 20, 18, 20, 16, 14, 12, 8, 24, 18, 24, 20, 24, 18, 24, 8, 6, 16, 14, 18, 16, 18, 14, 16, 6,
      4, 12, 16, 14, 12, 14, 16, 12, 4, 2, 6, 8, 6, 10, 6, 8, 6, 2, 4, 2, 8, 8, 4, 8, 8, 2, 4, 0, 2, 4, 4, -2, 4, 4, 2, 0, 0, -4, 0, 0, 0, 0, 0, -4, 0],
    /* R */ [14, 14, 12, 18, 16, 18, 12, 14, 14, 16, 20, 18, 24, 26, 24, 18, 20, 16, 12, 12, 12, 18, 18, 18, 12, 12, 12, 12, 18, 16, 22, 22, 22, 16, 18, 12, 12, 14, 12, 18, 18, 18, 12, 14, 12,
      12, 16, 14, 20, 20, 20, 14, 16, 12, 6, 10, 8, 14, 14, 14, 8, 10, 6, 4, 8, 6, 14, 12, 14, 6, 8, 4, 8, 4, 8, 16, 8, 16, 8, 4, 8, -2, 10, 6, 14, 12, 14, 6, 10, -2],
    /* C */ [6, 4, 0, -10, -12, -10, 0, 4, 6, 2, 2, 0, -4, -14, -4, 0, 2, 2, 2, 2, 0, -10, -8, -10, 0, 2, 2, 0, 0, -2, 4, 10, 4, -2, 0, 0, 0, 0, 0, 2, 8, 2, 0, 0, 0,
      -2, 0, 4, 2, 6, 2, 4, 0, -2, 0, 0, 0, 2, 4, 2, 0, 0, 0, 4, 0, 8, 6, 10, 6, 8, 0, 4, 0, 2, 4, 6, 6, 6, 4, 2, 0, 0, 0, 2, 6, 6, 6, 2, 0, 0],
    /* P */ [5, 5, 10, 15, 20, 15, 10, 5, 5, 20, 30, 45, 55, 60, 55, 45, 30, 20, 20, 30, 40, 50, 55, 50, 40, 30, 20, 20, 27, 30, 40, 42, 40, 30, 27, 20, 10, 18, 22, 35, 40, 35, 22, 18, 10,
      3, 0, 4, 0, 7, 0, 4, 0, 3, 0, 0, -2, 0, 4, 0, -2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];
  /** value of a piece on a square, from red's point of view (black uses the mirrored square). */
  const pv = (p, s) => (p > 0 ? VAL[p] + PST[p][s] : -(VAL[-p] + PST[-p][89 - s]));

  // ------------------------------------------------------------------ zobrist hashing (two 32-bit keys)
  let seed = 0x2545F491;
  const rnd32 = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
  const Z1 = [], Z2 = [];
  for (let p = 0; p < 15; p++) { Z1[p] = new Int32Array(90); Z2[p] = new Int32Array(90); for (let s = 0; s < 90; s++) { Z1[p][s] = rnd32(); Z2[p][s] = rnd32(); } }
  const ZS1 = rnd32(), ZS2 = rnd32();
  const zi = p => p + 7;   // piece -7..7 → 0..14

  // ------------------------------------------------------------------ position
  class Pos {
    constructor(b, side) {
      this.b = new Int8Array(90); if (b) this.b.set(b);
      this.side = side || 1; this.ksq = [-1, -1]; this.score = 0; this.h1 = 0; this.h2 = 0;
      this.refresh();
    }
    refresh() {
      this.score = 0; this.h1 = 0; this.h2 = 0; this.ksq = [-1, -1];
      for (let s = 0; s < 90; s++) { const p = this.b[s]; if (!p) continue; this.score += pv(p, s); this.h1 ^= Z1[zi(p)][s]; this.h2 ^= Z2[zi(p)][s]; if (p === K) this.ksq[0] = s; else if (p === -K) this.ksq[1] = s; }
      if (this.side < 0) { this.h1 ^= ZS1; this.h2 ^= ZS2; }
    }
    clone() { return new Pos(this.b, this.side); }
    key() { return (this.h1 >>> 0).toString(36) + ':' + (this.h2 >>> 0).toString(36); }
    /** play move m (no legality check). Returns the captured piece (0 if none). */
    make(m) {
      const f = m >> 7, t = m & 127, b = this.b, p = b[f], cap = b[t];
      this.score += pv(p, t) - pv(p, f); this.h1 ^= Z1[zi(p)][f] ^ Z1[zi(p)][t]; this.h2 ^= Z2[zi(p)][f] ^ Z2[zi(p)][t];
      if (cap) { this.score -= pv(cap, t); this.h1 ^= Z1[zi(cap)][t]; this.h2 ^= Z2[zi(cap)][t]; }
      b[t] = p; b[f] = 0;
      if (p === K) this.ksq[0] = t; else if (p === -K) this.ksq[1] = t;
      this.side = -this.side; this.h1 ^= ZS1; this.h2 ^= ZS2;
      return cap;
    }
    unmake(m, cap) {
      const f = m >> 7, t = m & 127, b = this.b, p = b[t];
      this.side = -this.side; this.h1 ^= ZS1; this.h2 ^= ZS2;
      b[f] = p; b[t] = cap;
      if (p === K) this.ksq[0] = f; else if (p === -K) this.ksq[1] = f;
      this.score -= pv(p, t) - pv(p, f); this.h1 ^= Z1[zi(p)][f] ^ Z1[zi(p)][t]; this.h2 ^= Z2[zi(p)][f] ^ Z2[zi(p)][t];
      if (cap) { this.score += pv(cap, t); this.h1 ^= Z1[zi(cap)][t]; this.h2 ^= Z2[zi(cap)][t]; }
    }
    /** Is square s attacked by `by` (1 red / -1 black)? Includes the flying-general rule (the enemy general "sees" along an open file). */
    attacked(s, by) {
      const b = this.b, r = rowOf(s);
      // chariots, cannons, facing general along the four rays
      const rays = T.rays[s];
      for (let d = 0; d < 4; d++) {
        const ray = rays[d]; let i = 0;
        for (; i < ray.length; i++) { const p = b[ray[i]]; if (p) { if (p === R * by || (d < 2 && p === K * by)) return true; break; } }
        for (i++; i < ray.length; i++) { const p = b[ray[i]]; if (p) { if (p === C * by) return true; break; } }
      }
      // horses (leg next to the horse must be empty)
      const ha = T.horseAtk[s];
      for (let i = 0; i < ha.length; i++) if (b[ha[i][0]] === N * by && !b[ha[i][1]]) return true;
      // soldiers
      const pw = P * by, c = colOf(s);
      if (by > 0) { if (r < 9 && b[s + 9] === pw) return true; if (r <= 4 && ((c > 0 && b[s - 1] === pw) || (c < 8 && b[s + 1] === pw))) return true; }
      else { if (r > 0 && b[s - 9] === pw) return true; if (r >= 5 && ((c > 0 && b[s - 1] === pw) || (c < 8 && b[s + 1] === pw))) return true; }
      return false;
    }
    /** Is `side`'s general in check (or facing the other general)? */
    inCheck(side) { const k = this.ksq[side > 0 ? 0 : 1]; return k < 0 ? true : this.attacked(k, -side); }
    /** Pseudo-legal moves for the side to move (captures only if capsOnly). */
    pseudo(out, capsOnly) {
      const b = this.b, side = this.side, k = si(side);
      for (let s = 0; s < 90; s++) {
        const p = b[s] * side; if (p <= 0) continue;
        const add = t => { const q = b[t]; if (q * side > 0) return; if (capsOnly && !q) return; out.push((s << 7) | t); };
        switch (p) {
          case K: { const l = T.king[k][s]; for (let i = 0; i < l.length; i++) add(l[i]); break; }
          case A: { const l = T.adv[k][s]; for (let i = 0; i < l.length; i++) add(l[i]); break; }
          case B: { const l = T.ele[k][s]; for (let i = 0; i < l.length; i++) if (!b[l[i][1]]) add(l[i][0]); break; }
          case N: { const l = T.horse[s]; for (let i = 0; i < l.length; i++) if (!b[l[i][1]]) add(l[i][0]); break; }
          case P: { const l = T.pawn[k][s]; for (let i = 0; i < l.length; i++) add(l[i]); break; }
          case R: { const rays = T.rays[s]; for (let d = 0; d < 4; d++) { const ray = rays[d]; for (let i = 0; i < ray.length; i++) { const t = ray[i], q = b[t]; if (!q) { if (!capsOnly) out.push((s << 7) | t); } else { if (q * side < 0) out.push((s << 7) | t); break; } } } break; }
          case C: { const rays = T.rays[s]; for (let d = 0; d < 4; d++) { const ray = rays[d]; let i = 0; for (; i < ray.length; i++) { const t = ray[i]; if (!b[t]) { if (!capsOnly) out.push((s << 7) | t); } else break; } for (i++; i < ray.length; i++) { const q = b[ray[i]]; if (q) { if (q * side < 0) out.push((s << 7) | ray[i]); break; } } } break; }
        }
      }
      return out;
    }
    /** Fully legal moves for the side to move. */
    legal() {
      const ps = this.pseudo([], false), out = [], me = this.side;
      for (const m of ps) { const cap = this.make(m); if (!this.inCheck(me)) out.push(m); this.unmake(m, cap); }
      return out;
    }
    legalFrom(s) { return this.legal().filter(m => (m >> 7) === s); }
    isLegal(m) { return this.legal().includes(m); }
    hasAttackers(side) { for (let s = 0; s < 90; s++) { const p = this.b[s] * side; if (p === N || p === R || p === C || p === P) return true; } return false; }
  }

  // ------------------------------------------------------------------ FEN
  const FEN_CH = { k: K, a: A, b: B, e: B, n: N, h: N, r: R, c: C, p: P };
  const CH_FEN = ['', 'k', 'a', 'b', 'n', 'r', 'c', 'p'];
  const START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';
  function fromFen(fen) {
    const [rows, turn] = fen.trim().split(/\s+/), b = new Int8Array(90), rs = rows.split('/');
    if (rs.length !== 10) throw new Error('bad fen ' + fen);
    rs.forEach((row, r) => { let c = 0; for (const ch of row) { if (/\d/.test(ch)) c += +ch; else { const t = FEN_CH[ch.toLowerCase()]; if (!t) throw new Error('bad fen piece ' + ch); b[sq(r, c++)] = ch === ch.toUpperCase() ? t : -t; } } if (c !== 9) throw new Error('bad fen row ' + row); });
    return new Pos(b, turn === 'b' ? -1 : 1);
  }
  function toFen(pos) {
    const rows = [];
    for (let r = 0; r < 10; r++) { let s = '', e = 0; for (let c = 0; c < 9; c++) { const p = pos.b[sq(r, c)]; if (!p) { e++; continue; } if (e) { s += e; e = 0; } const ch = CH_FEN[Math.abs(p)]; s += p > 0 ? ch.toUpperCase() : ch; } if (e) s += e; rows.push(s); }
    return rows.join('/') + (pos.side > 0 ? ' w' : ' b');
  }

  function perft(pos, depth) {
    if (depth === 0) return 1;
    const ms = pos.pseudo([], false), me = pos.side; let n = 0;
    for (const m of ms) { const cap = pos.make(m); if (!pos.inCheck(me)) n += depth === 1 ? 1 : perft(pos, depth - 1); pos.unmake(m, cap); }
    return n;
  }

  // ------------------------------------------------------------------ game (history, end of game, draws)
  class Game {
    constructor(fen) { this.pos = fromFen(fen || START); this.hist = []; this.reps = new Map(); this.quiet = 0; this.bump(1); }
    bump(d) { const k = this.pos.key(); this.reps.set(k, (this.reps.get(k) || 0) + d); }
    get side() { return this.pos.side; }
    legal() { return this.pos.legal(); }
    /** Play a legal move. Returns { cap, check }. Throws on an illegal move. */
    play(m) {
      if (!this.pos.isLegal(m)) throw new Error('illegal move ' + m);
      const piece = this.pos.b[m >> 7], cap = this.pos.make(m);
      this.hist.push({ m, cap, piece, quiet: this.quiet }); this.quiet = cap ? 0 : this.quiet + 1; this.bump(1);
      return { cap, piece, check: this.pos.inCheck(this.pos.side) };
    }
    undo() { const h = this.hist.pop(); if (!h) return null; this.bump(-1); this.pos.unmake(h.m, h.cap); this.quiet = h.quiet; return h; }
    /** { over, winner (1 red, -1 black, 0 draw), reason: 'checkmate'|'stalemate'|'repetition'|'quiet'|'material' } */
    status() {
      const p = this.pos;
      if (!p.legal().length) return { over: true, winner: -p.side, reason: p.inCheck(p.side) ? 'checkmate' : 'stalemate' };
      if ((this.reps.get(p.key()) || 0) >= 3) return { over: true, winner: 0, reason: 'repetition' };
      if (this.quiet >= 120) return { over: true, winner: 0, reason: 'quiet' };
      if (!p.hasAttackers(1) && !p.hasAttackers(-1)) return { over: true, winner: 0, reason: 'material' };
      return { over: false };
    }
    seen() { const s = new Set(); for (const [k, n] of this.reps) if (n > 0) s.add(k); return s; }
  }

  // ------------------------------------------------------------------ search: negamax alpha-beta, iterative deepening, quiescence, TT, killers
  const MATE = 30000, INF = 32000;
  const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  const tt = { k: new Int32Array(TT_SIZE), m: new Int32Array(TT_SIZE), d: new Int8Array(TT_SIZE), s: new Int32Array(TT_SIZE), f: new Int8Array(TT_SIZE) };
  const MVV = [0, 1000, 20, 20, 40, 90, 45, 10];
  /**
   * Find a move for the side to move.
   * opts: { timeMs = 600, maxDepth = 8, maxNodes = 600000, seen: Set of position keys already played (repetition → draw), rand: () => [0,1), now }
   * Returns { move, score (side-to-move view), depth, nodes, pv }.
   */
  function search(pos0, opts = {}) {
    const pos = pos0.clone();
    const now = opts.now || (typeof performance !== 'undefined' ? () => performance.now() : () => Date.now());
    const t0 = now(), timeMs = opts.timeMs == null ? 600 : opts.timeMs, maxDepth = opts.maxDepth || 8, maxNodes = opts.maxNodes || 600000;
    const seen = opts.seen || new Set(), rand = opts.rand || Math.random;
    const killers = []; for (let i = 0; i < 64; i++) killers.push([0, 0]);
    const hist = new Int32Array(90 * 128);
    const path = [];
    let nodes = 0, stop = false;
    const timeUp = () => { if ((nodes & 1023) === 0 && (now() - t0 > timeMs || nodes > maxNodes)) stop = true; return stop; };
    const order = (ms, best, ply) => {
      const b = pos.b, sc = new Array(ms.length), k = killers[ply] || [0, 0];
      for (let i = 0; i < ms.length; i++) {
        const m = ms[i], cap = b[m & 127];
        sc[i] = m === best ? 1e9 : cap ? 1e6 + MVV[Math.abs(cap)] * 100 - MVV[Math.abs(b[m >> 7])] : m === k[0] ? 9e5 : m === k[1] ? 8e5 : hist[(m >> 7) * 128 + (m & 127)];
      }
      const idx = ms.map((_, i) => i).sort((a, c) => sc[c] - sc[a]);
      return idx.map(i => ms[i]);
    };
    function qs(alpha, beta, ply, qd) {
      nodes++; if (timeUp()) return 0;
      const me = pos.side, chk = pos.inCheck(me);
      if (!chk) { const stand = pos.score * me; if (stand >= beta) return stand; if (stand > alpha) alpha = stand; if (qd > 8) return stand; }
      else if (qd > 6) return pos.score * me;
      const ms = order(pos.pseudo([], !chk), 0, Math.min(ply, 63));
      let legal = 0;
      for (const m of ms) {
        const cap = pos.make(m);
        if (pos.inCheck(me)) { pos.unmake(m, cap); continue; }
        legal++;
        const v = cap === -K * me ? MATE - ply : -qs(-beta, -alpha, ply + 1, qd + 1);
        pos.unmake(m, cap);
        if (stop) return 0;
        if (v > alpha) { alpha = v; if (alpha >= beta) return alpha; }
      }
      if (chk && !legal) return -MATE + ply;
      return alpha;
    }
    function ab(depth, alpha, beta, ply) {
      if (ply > 0) { const k = pos.key(); if (seen.has(k) || path.includes(k)) return 0; }
      const me = pos.side, chk = pos.inCheck(me);
      if (chk && ply < 40) depth++;
      if (depth <= 0) return qs(alpha, beta, ply, 0);
      nodes++; if (timeUp()) return 0;
      const ti = pos.h1 & TT_MASK; let ttMove = 0;
      if (tt.k[ti] === pos.h2) {
        ttMove = tt.m[ti];
        if (ply > 0 && tt.d[ti] >= depth) { const s = tt.s[ti], f = tt.f[ti]; if (f === 0 || (f === 1 && s >= beta) || (f === 2 && s <= alpha)) return s; }
      }
      const ms = order(pos.pseudo([], false), ttMove, Math.min(ply, 63));
      const a0 = alpha; let best = -INF, bestM = 0, legal = 0;
      path.push(pos.key());
      for (const m of ms) {
        const cap = pos.make(m);
        if (pos.inCheck(me)) { pos.unmake(m, cap); continue; }
        legal++;
        const v = -ab(depth - 1, -beta, -alpha, ply + 1);
        pos.unmake(m, cap);
        if (stop) { path.pop(); return 0; }
        if (v > best) { best = v; bestM = m; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) { if (!cap) { const k = killers[Math.min(ply, 63)]; if (k[0] !== m) { k[1] = k[0]; k[0] = m; } hist[(m >> 7) * 128 + (m & 127)] += depth * depth; } break; }
      }
      path.pop();
      if (!legal) return -MATE + ply;          // checkmate or stalemate: the side to move loses
      tt.k[ti] = pos.h2; tt.m[ti] = bestM; tt.d[ti] = depth; tt.s[ti] = best; tt.f[ti] = best <= a0 ? 2 : best >= beta ? 1 : 0;
      return best;
    }
    // root: legal moves only, shuffled so equal moves vary from game to game
    let root = pos.legal();
    if (!root.length) return { move: 0, score: -MATE, depth: 0, nodes: 0 };
    for (let i = root.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [root[i], root[j]] = [root[j], root[i]]; }
    let bestMove = root[0], bestScore = -INF, depthDone = 0;
    const rootScores = new Map();
    for (let d = 1; d <= maxDepth; d++) {
      let alpha = -INF, curBest = 0, curScore = -INF;
      root = order(root, bestMove, 0);
      if (d > 1) root.sort((a, b) => (b === bestMove) - (a === bestMove) || (rootScores.get(b) || -INF) - (rootScores.get(a) || -INF));
      path.length = 0; path.push(pos.key());
      for (const m of root) {
        const cap = pos.make(m);
        let v;
        if (cap === -K * pos.side) v = MATE;   // never happens with legal moves, safety
        else if (curBest && d > 1) { v = -ab(d - 1, -alpha - 1, -alpha, 1); if (!stop && v > alpha) v = -ab(d - 1, -INF, -alpha, 1); }
        else v = -ab(d - 1, -INF, -alpha, 1);
        pos.unmake(m, cap);
        if (stop) break;
        rootScores.set(m, v);
        if (v > curScore) { curScore = v; curBest = m; }
        if (v > alpha) alpha = v;
      }
      if (stop && !curBest) break;
      if (curBest) { bestMove = curBest; bestScore = curScore; depthDone = d; }
      if (stop || Math.abs(bestScore) > MATE - 100 || now() - t0 > timeMs * .45) break;
    }
    return { move: bestMove, score: bestScore, depth: depthDone, nodes };
  }

  /** Would the bot (playing botSide, default: the side to move) accept a draw offer? Yes unless it is clearly ahead. */
  function acceptsDraw(pos, botSide, opts = {}) {
    if (botSide == null) botSide = pos.side;
    const r = search(pos, Object.assign({ timeMs: 250, maxDepth: 3, maxNodes: 120000 }, opts));
    const botScore = pos.side === botSide ? r.score : -r.score;
    return botScore < 60;
  }

  /** Short human-readable description, e.g. "Xe ăn Pháo". */
  function describe(pos, m) { const p = pos.b[m >> 7], q = pos.b[m & 127]; return VI[Math.abs(p)] + (q ? ' ăn ' + VI[Math.abs(q)] : ''); }

  return { K, A, B, N, R, C, P, NAMES, VI, START, MATE, Pos, Game, fromFen, toFen, perft, search, acceptsDraw, describe, mv, mFrom, mTo, sq, rowOf, colOf, VAL, inPalace };
});
