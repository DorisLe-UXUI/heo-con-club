/* Cờ Cá Ngựa (Ludo) rules + bot — pure, no DOM. UMD: window.Rules['co-ca-ngua'] in the browser, module.exports in Node.
 *
 * 4 players (0 red = you, 1 green, 2 yellow, 3 blue), 4 horses each, play clockwise. Shared track of 52 cells; player k
 * enters it at cell 13·k. A horse's progress p: -1 in the stable, 0..50 on the track (cell (13k + p) mod 52),
 * 51..55 in its own home column, 56 = reached the final cell (home).
 *  - Leave the stable with a 1 or a 6 (the horse goes to its start cell).
 *  - Move exactly the rolled number. Entering the home column needs no special roll, but the final cell must be reached
 *    exactly: a roll that would overshoot 56 cannot move that horse.
 *  - Horses may pass over any horse. A horse may not land on another horse of the same colour (except home, 56).
 *  - Landing on an opponent's horse ("đá") sends it back to its stable. Horses in a home column are safe.
 *  - Rolling a 6 gives another roll (even if no horse could move). No limit on consecutive sixes.
 *  - No legal move: the turn passes. First player with all 4 horses home wins.
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['co-ca-ngua'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const PLAYERS = 4, HORSES = 4, TRACK = 52, LAST_TRACK = 50, HOME_FIRST = 51, FINISH = 56, START = [0, 13, 26, 39];
  const EXIT_ROLLS = [1, 6];
  const COLORS = ['red', 'green', 'yellow', 'blue'];
  const VI = ['Đỏ', 'Xanh lá', 'Vàng', 'Xanh dương'];

  const newState = () => ({ horses: Array.from({ length: PLAYERS }, () => [-1, -1, -1, -1]), turn: 0 });
  const clone = st => ({ horses: st.horses.map(h => h.slice()), turn: st.turn });
  /** Track cell (0..51) of progress p for player pl, or -1 if not on the shared track. */
  const cellOf = (pl, p) => (p >= 0 && p <= LAST_TRACK ? (START[pl] + p) % TRACK : -1);
  /** Who stands on track cell c? → { pl, h } or null. */
  function occupant(st, c) {
    for (let pl = 0; pl < PLAYERS; pl++) for (let h = 0; h < HORSES; h++) if (cellOf(pl, st.horses[pl][h]) === c) return { pl, h };
    return null;
  }
  /** Legal moves for player pl with die value roll: [{ h, from, to, kick: {pl,h}|null, exit, finish, enterHome }] */
  function legalMoves(st, pl, roll) {
    const out = [], hs = st.horses[pl];
    for (let h = 0; h < HORSES; h++) {
      const p = hs[h]; let to;
      if (p === FINISH) continue;
      if (p === -1) { if (!EXIT_ROLLS.includes(roll)) continue; to = 0; }
      else { to = p + roll; if (to > FINISH) continue; }
      let kick = null;
      if (to <= LAST_TRACK) {
        const o = occupant(st, cellOf(pl, to));
        if (o) { if (o.pl === pl) continue; kick = o; }
      } else if (to < FINISH) { if (hs.some((q, k) => k !== h && q === to)) continue; }
      out.push({ h, from: p, to, kick, exit: p === -1, finish: to === FINISH, enterHome: p <= LAST_TRACK && to >= HOME_FIRST });
    }
    return out;
  }
  /** Moves with different outcomes only (two stable horses leaving are the same move). */
  function distinctMoves(moves) { const seen = new Set(); return moves.filter(m => { const k = m.from + '>' + m.to; if (seen.has(k)) return false; seen.add(k); return true; }); }
  /** Apply a move (mutates st). Returns the move. */
  function apply(st, pl, m) {
    if (m.kick) st.horses[m.kick.pl][m.kick.h] = -1;
    st.horses[pl][m.h] = m.to;
    return m;
  }
  const nextPlayer = (pl, roll) => (roll === 6 ? pl : (pl + 1) % PLAYERS);
  const homeCount = (st, pl) => st.horses[pl].filter(p => p === FINISH).length;
  const winner = st => { for (let pl = 0; pl < PLAYERS; pl++) if (homeCount(st, pl) === HORSES) return pl; return -1; };
  /** Total progress (for ranking players who did not win). */
  const progress = (st, pl) => st.horses[pl].reduce((a, p) => a + (p + 1), 0);

  /** How many opponent horses could land on track cell c with their next roll. */
  function danger(st, pl, c) {
    let n = 0;
    for (let q = 0; q < PLAYERS; q++) {
      if (q === pl) continue;
      for (const p of st.horses[q]) {
        if (p === -1) { if (START[q] === c) n++; continue; }
        if (p > LAST_TRACK) continue;
        const d = (c - cellOf(q, p) + TRACK) % TRACK;
        if (d >= 1 && d <= 6 && p + d <= LAST_TRACK) n++;
      }
    }
    return n;
  }
  /** Bot choice: finish > kick > leave the stable > reach the home column > run from danger, avoid danger, advance. */
  function chooseMove(st, pl, roll, moves, rand = Math.random) {
    if (!moves || !moves.length) return null;
    let best = moves[0], bestV = -Infinity;
    for (const m of moves) {
      let v = 0;
      if (m.finish) v += 120;
      if (m.kick) v += 90 + Math.max(0, st.horses[m.kick.pl][m.kick.h]) * 1.2;
      if (m.exit) v += 70;
      if (m.enterHome) v += 60;
      if (m.to <= LAST_TRACK) {
        const after = clone(st); apply(after, pl, m);
        v -= danger(after, pl, cellOf(pl, m.to)) * 38;
      }
      if (m.from >= 0 && m.from <= LAST_TRACK) v += danger(st, pl, cellOf(pl, m.from)) * 30;
      v += m.to * .6 + rand() * 6;
      if (v > bestV) { bestV = v; best = m; }
    }
    return best;
  }

  /** Play a whole game with bots in every seat (used by tests and the simulation). Returns { winner, turns, rolls }. */
  function simulate(rand = Math.random, opts = {}) {
    const st = newState(), maxTurns = opts.maxTurns || 20000; let pl = 0, turns = 0, rolls = 0;
    while (turns < maxTurns) {
      const roll = 1 + Math.floor(rand() * 6); rolls++;
      const moves = legalMoves(st, pl, roll);
      if (moves.length) { const m = opts.random ? moves[Math.floor(rand() * moves.length)] : chooseMove(st, pl, roll, moves, rand); apply(st, pl, m); if (opts.check) opts.check(st, pl, roll, m); }
      const w = winner(st); if (w >= 0) return { winner: w, turns, rolls, st };
      const n = nextPlayer(pl, roll); if (n !== pl) turns++; pl = n;
    }
    return { winner: -1, turns, rolls, st };
  }
  /** Invariants: no two horses share a track cell, own horses never share a home-column cell. Throws if broken. */
  function check(st) {
    const seen = new Map();
    for (let pl = 0; pl < PLAYERS; pl++) for (let h = 0; h < HORSES; h++) {
      const p = st.horses[pl][h];
      if (!(p === -1 || (p >= 0 && p <= FINISH) || false) || !Number.isInteger(p)) throw new Error('bad progress ' + p);
      const key = p <= LAST_TRACK && p >= 0 ? 't' + cellOf(pl, p) : p > LAST_TRACK && p < FINISH ? 'h' + pl + '_' + p : null;
      if (key) { if (seen.has(key)) throw new Error('two horses on ' + key); seen.set(key, 1); }
    }
    return true;
  }

  return { PLAYERS, HORSES, TRACK, LAST_TRACK, HOME_FIRST, FINISH, START, EXIT_ROLLS, COLORS, VI, newState, clone, cellOf, occupant, legalMoves, distinctMoves, apply, nextPlayer, homeCount, winner, progress, danger, chooseMove, simulate, check };
});
