'use strict';
/* node tests/co-tuong.test.js — Cờ Tướng rules + AI */
const assert = require('assert');
const R = require('../js/games3d/rules/co-tuong.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); } }
const S = (r, c) => R.sq(r, c);
const M = (r1, c1, r2, c2) => R.mv(S(r1, c1), S(r2, c2));
/** destinations of the piece on (r,c) as sorted "r,c" strings */
function dests(fen, r, c) { const p = R.fromFen(fen); return p.legalFrom(S(r, c)).map(m => R.rowOf(m & 127) + ',' + R.colOf(m & 127)).sort(); }
const set = a => a.slice().sort();

// ---------------------------------------------------------------- perft (known xiangqi values from the start position)
t('fen round trip', () => assert.strictEqual(R.toFen(R.fromFen(R.START)), R.START));
t('perft 1 = 44', () => assert.strictEqual(R.perft(R.fromFen(R.START), 1), 44));
t('perft 2 = 1920', () => assert.strictEqual(R.perft(R.fromFen(R.START), 2), 1920));
t('perft 3 = 79666', () => assert.strictEqual(R.perft(R.fromFen(R.START), 3), 79666));
t('perft 4 = 3290240', () => assert.strictEqual(R.perft(R.fromFen(R.START), 4), 3290240));
t('start position score is symmetric', () => assert.strictEqual(R.fromFen(R.START).score, 0));

// ---------------------------------------------------------------- horse + leg
t('horse: free moves', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/4N4/9/9/9/3K5 w', 5, 4), set(['3,3', '3,5', '7,3', '7,5', '4,2', '6,2', '4,6', '6,6'])));
t('horse: leg blocked upward', () => assert.deepStrictEqual(dests('5k3/9/9/9/4P4/4N4/9/9/9/3K5 w', 5, 4), set(['7,3', '7,5', '4,2', '6,2', '4,6', '6,6'])));
t('horse: leg blocked by enemy piece too', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/3pN4/9/9/9/3K5 w', 5, 4), set(['3,3', '3,5', '7,3', '7,5', '4,6', '6,6'])));
t('horse: all four legs blocked', () => assert.deepStrictEqual(dests('5k3/9/9/9/4P4/3PNP3/4P4/9/9/3K5 w', 5, 4), []));
t('horse: captures enemy, not own', () => assert.deepStrictEqual(dests('5k3/9/9/3r1P3/9/4N4/9/9/9/4K4 w', 5, 4), set(['3,3', '7,3', '7,5', '4,2', '6,2', '4,6', '6,6'])));
t('horse: edge of board', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/9/9/9/9/N2K5 w', 9, 0), set(['7,1', '8,2'])));

// ---------------------------------------------------------------- elephant: eye + river
t('elephant: free', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/9/9/4B4/9/3K5 w', 7, 4), set(['5,2', '5,6', '9,2', '9,6'])));
t('elephant: eye blocked', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/9/3P5/4B4/9/3K5 w', 7, 4), set(['5,6', '9,2', '9,6'])));
t('elephant: cannot cross the river (red)', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/2B6/9/9/9/3K5 w', 5, 2), set(['7,0', '7,4'])));
t('elephant: cannot cross the river (black)', () => assert.deepStrictEqual(dests('5k3/9/9/9/2b6/9/9/9/9/3K5 b', 4, 2), set(['2,0', '2,4'])));

// ---------------------------------------------------------------- advisor + general: palace
t('advisor: centre of palace', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/9/9/9/4A4/3K5 w', 8, 4), set(['7,3', '7,5', '9,5'])));
t('advisor: corner of palace', () => assert.deepStrictEqual(dests('4k4/9/9/9/9/9/9/3A5/9/5K3 w', 7, 3), ['8,4']));
t('black advisor stays in its palace', () => assert.deepStrictEqual(dests('3a5/4k4/9/9/9/9/9/9/9/5K3 b', 0, 3), []));
t('general: palace corner', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/9/9/9/9/3K5 w', 9, 3), set(['8,3', '9,4'])));
t('general: palace edge (cannot leave)', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/9/9/3K5/9/9 w', 7, 3), set(['7,4', '8,3'])));

// ---------------------------------------------------------------- chariot
t('chariot: slides, captures first enemy only', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/R1p1p4/9/9/9/3K5 w', 5, 0), set(['5,1', '5,2', '4,0', '3,0', '2,0', '1,0', '0,0', '6,0', '7,0', '8,0', '9,0'])));
t('chariot: blocked by own piece', () => assert.deepStrictEqual(dests('5k3/9/9/9/P8/RP7/P8/9/9/3K5 w', 5, 0), []));

// ---------------------------------------------------------------- cannon
t('cannon: moves like a chariot, captures by jumping one screen', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/C2p2n2/9/9/9/3K5 w', 5, 0), set(['5,1', '5,2', '5,6', '4,0', '3,0', '2,0', '1,0', '0,0', '6,0', '7,0', '8,0', '9,0'])));
t('cannon: cannot capture without a screen', () => assert.ok(!dests('5k3/9/9/9/9/C1n6/9/9/9/3K5 w', 5, 0).includes('5,2')));
t('cannon: cannot jump two screens', () => assert.ok(!dests('5k3/9/9/9/9/C1PP1n3/9/9/9/3K5 w', 5, 0).includes('5,5')));
t('cannon: own piece beyond the screen is not capturable', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/C1p1P4/9/9/9/3K5 w', 5, 0).filter(d => d.startsWith('5,')), ['5,1']));
t('cannon gives check through a screen', () => assert.ok(R.fromFen('4k4/9/9/4p4/9/9/4C4/9/9/3K5 b').inCheck(-1)));
t('cannon without screen does not check', () => assert.ok(!R.fromFen('4k4/9/9/9/9/9/4C4/9/9/3K5 b').inCheck(-1)));

// ---------------------------------------------------------------- soldier
t('soldier before river: forward only', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/9/4P4/9/9/3K5 w', 6, 4), ['5,4']));
t('soldier on own river bank: forward only', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/4P4/9/9/9/3K5 w', 5, 4), ['4,4']));
t('soldier after river: forward + sideways', () => assert.deepStrictEqual(dests('5k3/9/9/9/4P4/9/9/9/9/3K5 w', 4, 4), set(['3,4', '4,3', '4,5'])));
t('red soldier on the top rank moves sideways only', () => assert.deepStrictEqual(dests('P4k3/9/9/9/9/9/9/9/9/3K5 w', 0, 0), ['0,1']));
t('black soldier moves down, sideways after river', () => assert.deepStrictEqual(dests('5k3/9/9/9/9/4p4/9/9/9/3K5 b', 5, 4), set(['6,4', '5,3', '5,5'])));
t('black soldier before river', () => assert.deepStrictEqual(dests('5k3/9/9/4p4/9/9/9/9/9/3K5 b', 3, 4), ['4,4']));
t('soldier attacks forward/sideways only', () => { const p = R.fromFen('9/9/9/9/3pk4/9/9/9/9/3K5 w'); assert.ok(!p.inCheck(-1)); const q = R.fromFen('9/9/9/4k4/4P4/9/9/9/9/3K5 b'); assert.ok(q.inCheck(-1)); });

// ---------------------------------------------------------------- flying generals, check, pins
t('flying general: pinned piece may only move along the file', () => assert.deepStrictEqual(dests('4k4/9/9/9/9/4C4/9/9/9/4K4 w', 5, 4), set(['1,4', '2,4', '3,4', '4,4', '6,4', '7,4', '8,4'])));
t('flying general: pinned horse has no move', () => assert.deepStrictEqual(dests('4k4/9/9/9/9/4N4/9/9/9/4K4 w', 5, 4), []));
t('flying general: king may not step onto the open file', () => assert.deepStrictEqual(dests('4k4/9/9/9/9/9/9/9/9/3K5 w', 9, 3), ['8,3']));
t('facing generals count as check', () => assert.ok(R.fromFen('4k4/9/9/9/9/9/9/9/9/4K4 w').inCheck(1)));
t('a piece between the generals blocks', () => assert.ok(!R.fromFen('4k4/9/9/9/4p4/9/9/9/9/4K4 w').inCheck(1)));
t('must answer a check', () => {
  const p = R.fromFen('4k4/9/9/9/9/9/9/9/9/r2K5 w'); assert.ok(p.inCheck(1));
  const ms = p.legal().map(m => R.rowOf(m & 127) + ',' + R.colOf(m & 127)); assert.deepStrictEqual(set(ms), set(['8,3']));
});
t('horse check respects the leg', () => { assert.ok(R.fromFen('4k4/9/9/9/9/9/9/4n4/9/3K5 w').inCheck(1)); assert.ok(!R.fromFen('4k4/9/9/9/9/9/9/4n4/4A4/3K5 w').inCheck(1)); assert.ok(R.fromFen('4k4/9/9/9/9/9/9/4n4/3A5/3K5 w').inCheck(1)); });
t('no legal move may leave the general attacked', () => {
  // random walk: every legal move leaves the mover safe, every rejected pseudo move does not
  let p = R.fromFen(R.START); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 400; i++) {
    const me = p.side, legal = p.legal(); if (!legal.length) break;
    for (const m of p.pseudo([], false)) { const cap = p.make(m); const ok = !p.inCheck(me); p.unmake(m, cap); assert.strictEqual(ok, legal.includes(m)); }
    p.make(legal[Math.floor(rnd() * legal.length)]);
  }
});

// ---------------------------------------------------------------- end of game
t('checkmate: double chariot', () => { const g = new R.Game('R3k4/8R/9/9/9/9/9/9/9/3K5 b'); const s = g.status(); assert.deepStrictEqual([s.over, s.winner, s.reason], [true, 1, 'checkmate']); });
t('stalemate loses for the side to move', () => { const g = new R.Game('3k5/8R/9/9/9/9/9/9/9/4K4 b'); assert.ok(!g.pos.inCheck(-1)); const s = g.status(); assert.deepStrictEqual([s.over, s.winner, s.reason], [true, 1, 'stalemate']); });
t('mate: chariot protected by a soldier, escape square covered by the facing general', () => { const g = new R.Game('3k5/2PR5/9/9/9/9/9/9/9/4K4 b'); const s = g.status(); assert.ok(s.over && s.winner === 1); });
t('not mate when the king can capture the checker', () => { const g = new R.Game('4k4/4R4/9/9/9/9/9/9/9/3K5 b'); assert.ok(!g.status().over); });
t('start position not over', () => assert.ok(!new R.Game().status().over));
t('draw by repetition', () => {
  const g = new R.Game('3k5/9/9/9/9/9/9/9/9/R3K4 w');
  const seq = [M(9, 0, 8, 0), M(0, 3, 1, 3), M(8, 0, 9, 0), M(1, 3, 0, 3)];
  let st; for (let i = 0; i < 8; i++) { g.play(seq[i % 4]); st = g.status(); if (st.over) break; }
  assert.deepStrictEqual([st.over, st.winner, st.reason], [true, 0, 'repetition']);
});
t('draw when no attackers left', () => { const g = new R.Game('3ak4/9/9/9/9/9/9/9/4A4/3K5 w'); assert.deepStrictEqual(g.status().reason, 'material'); });
t('120 quiet plies is a draw', () => { const g = new R.Game('3k5/9/9/9/9/9/9/9/9/R3K4 w'); g.quiet = 120; assert.deepStrictEqual(g.status().reason, 'quiet'); });
t('undo restores the position', () => { const g = new R.Game(); const f0 = R.toFen(g.pos); g.play(M(7, 1, 7, 4)); g.play(M(0, 1, 2, 2)); g.undo(); g.undo(); assert.strictEqual(R.toFen(g.pos), f0); assert.strictEqual(g.hist.length, 0); });
t('illegal move throws', () => { const g = new R.Game(); assert.throws(() => g.play(M(9, 0, 4, 0))); });
t('incremental score/hash match a fresh position', () => {
  let p = R.fromFen(R.START); let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 300; i++) { const l = p.legal(); if (!l.length) break; p.make(l[Math.floor(rnd() * l.length)]); const q = new R.Pos(p.b, p.side); assert.strictEqual(p.score, q.score); assert.strictEqual(p.key(), q.key()); }
});

// ---------------------------------------------------------------- AI
t('AI finds mate in one', () => { const p = R.fromFen('4k4/8R/R8/9/9/9/9/9/9/3K5 w'); const r = R.search(p, { timeMs: 2000, maxDepth: 4 }); assert.strictEqual(r.move, M(2, 0, 0, 0)); assert.ok(r.score > R.MATE - 10); });
t('AI takes a free chariot', () => { const p = R.fromFen('4k4/9/9/3r5/9/4N4/9/9/9/5K3 w'); const r = R.search(p, { timeMs: 2000, maxDepth: 3 }); assert.strictEqual(r.move, M(5, 4, 3, 3)); });
t('AI (black) escapes a mate threat / never returns an illegal move', () => { const p = R.fromFen('4k4/9/9/9/9/9/9/9/4R4/R2K5 b'); const r = R.search(p, { timeMs: 500, maxDepth: 4 }); assert.ok(p.legal().includes(r.move)); });
t('AI respects the node budget', () => { const r = R.search(R.fromFen(R.START), { timeMs: 1e9, maxDepth: 20, maxNodes: 50000 }); assert.ok(r.nodes < 60000 && r.move); });
t('AI search under 1 s at default settings', () => { const t0 = Date.now(); R.search(R.fromFen(R.START)); assert.ok(Date.now() - t0 < 1000, 'took ' + (Date.now() - t0)); });
t('draw offer: refused when the bot is a chariot up', () => assert.ok(!R.acceptsDraw(R.fromFen('3k5/9/9/r8/9/9/9/9/9/4K4 b'))));
t('draw offer: accepted in an equal position', () => assert.ok(R.acceptsDraw(R.fromFen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b'))));
t('draw offer: accepted when the bot is losing', () => assert.ok(R.acceptsDraw(R.fromFen('3k5/9/9/R8/9/9/9/9/9/4K4 b'))));
t('draw offer asked on the player\'s turn (bot = black, red to move)', () => { assert.ok(!R.acceptsDraw(R.fromFen('3k5/9/9/r8/9/9/9/9/9/4K4 w'), -1)); assert.ok(R.acceptsDraw(R.fromFen(R.START), -1)); });

// ---------------------------------------------------------------- full games: AI (black) vs random-legal player (red), and AI vs AI
t('full games AI vs random complete without illegal moves', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tally = { ai: 0, random: 0, draw: 0 };
  for (let gi = 0; gi < 24; gi++) {
    const g = new R.Game(), aiSide = gi % 2 ? 1 : -1;
    let st = g.status(), plies = 0;
    while (!st.over) {
      const legal = g.legal();
      let m;
      if (g.side === aiSide) { m = R.search(g.pos, { timeMs: 1e9, maxDepth: 2, maxNodes: 15000, seen: g.seen(), rand: rnd }).move; assert.ok(legal.includes(m), 'AI illegal move'); }
      else m = legal[Math.floor(rnd() * legal.length)];
      g.play(m); plies++; st = g.status();
      assert.ok(plies < 1000, 'game too long');
    }
    if (st.winner === 0) tally.draw++; else if (st.winner === aiSide) tally.ai++; else tally.random++;
  }
  assert.ok(tally.ai >= 20, 'AI should crush a random player: ' + JSON.stringify(tally));
  assert.strictEqual(tally.random, 0, 'random player beat the AI');
});
t('full AI vs AI games terminate', () => {
  let seed = 999; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let gi = 0; gi < 4; gi++) {
    const g = new R.Game(); let st = g.status(), plies = 0;
    while (!st.over) { const r = R.search(g.pos, { timeMs: 1e9, maxDepth: 2, maxNodes: 8000, seen: g.seen(), rand: rnd }); assert.ok(g.legal().includes(r.move)); g.play(r.move); st = g.status(); plies++; assert.ok(plies < 1500); }
  }
});

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
