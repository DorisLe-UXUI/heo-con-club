'use strict';
/* node tests/co-ca-ngua.test.js — Cờ Cá Ngựa (Ludo) rules + bot */
const assert = require('assert');
const R = require('../js/games3d/rules/co-ca-ngua.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); } }
let seed = 2024; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
/** state from horses arrays (missing players stay in the stable) */
function S(h0, h1, h2, h3) { const st = R.newState(); [h0, h1, h2, h3].forEach((h, i) => { if (h) st.horses[i] = h.slice(); }); return st; }
const tos = ms => ms.map(m => m.h + ':' + m.to).sort();

// ---------------------------------------------------------------- leaving the stable
t('stable: no move without 1 or 6', () => { for (const r of [2, 3, 4, 5]) assert.strictEqual(R.legalMoves(R.newState(), 0, r).length, 0); });
t('stable: a 6 lets any horse out onto the start cell', () => { const ms = R.legalMoves(R.newState(), 0, 6); assert.strictEqual(ms.length, 4); assert.ok(ms.every(m => m.to === 0 && m.exit)); assert.strictEqual(R.distinctMoves(ms).length, 1); });
t('stable: a 1 also lets a horse out', () => assert.strictEqual(R.distinctMoves(R.legalMoves(R.newState(), 2, 1)).length, 1));
t('start cells are 13 apart', () => assert.deepStrictEqual([0, 1, 2, 3].map(p => R.cellOf(p, 0)), [0, 13, 26, 39]));
t('cannot leave onto your own horse', () => assert.deepStrictEqual(tos(R.legalMoves(S([0, -1, -1, -1]), 0, 6)), ['0:6']));
t('leaving kicks an opponent sitting on the start cell', () => {
  const st = S([-1, -1, -1, -1], [39, -1, -1, -1]);          // green horse at progress 39 = cell 13+39 = 52 → 0 (red start)
  assert.strictEqual(R.cellOf(1, 39), 0);
  const m = R.legalMoves(st, 0, 6)[0]; assert.deepStrictEqual(m.kick, { pl: 1, h: 0 });
  R.apply(st, 0, m); assert.strictEqual(st.horses[1][0], -1); assert.strictEqual(st.horses[0][0], 0);
});

// ---------------------------------------------------------------- movement
t('moves exactly the roll', () => assert.deepStrictEqual(tos(R.legalMoves(S([10, -1, -1, -1]), 0, 4)), ['0:14']));
t('every roll 1..6 moves a track horse', () => { for (let r = 1; r <= 6; r++) assert.ok(R.legalMoves(S([20, 56, 56, 56]), 0, r).some(m => m.to === 20 + r)); });
t('cannot land on your own horse', () => assert.deepStrictEqual(tos(R.legalMoves(S([10, 14, -1, -1]), 0, 4)), ['1:18']));
t('can pass over any horse', () => { const st = S([10, 12, -1, -1], null, [38, -1, -1, -1]); assert.strictEqual(R.cellOf(2, 38), 13 - 1); const ms = R.legalMoves(st, 0, 5); assert.ok(ms.some(m => m.h === 0 && m.to === 15 && !m.kick)); });
t('track wraps around for later players', () => { assert.strictEqual(R.cellOf(1, 45), 6); assert.strictEqual(R.cellOf(3, 13), 0); assert.strictEqual(R.cellOf(2, 50), 24); });
t('horse in the stable or home is not on the track', () => { assert.strictEqual(R.cellOf(0, -1), -1); assert.strictEqual(R.cellOf(0, 51), -1); assert.strictEqual(R.cellOf(0, 56), -1); });

// ---------------------------------------------------------------- kicking ("đá")
t('landing on an opponent kicks it to its stable', () => {
  const st = S([20, -1, -1, -1]);
  st.horses[1][0] = (24 - 13 + 52) % 52;                      // green on cell 24 = red progress 24
  assert.strictEqual(R.cellOf(1, st.horses[1][0]), R.cellOf(0, 24));
  const m = R.legalMoves(st, 0, 4).find(x => x.h === 0); assert.ok(m.kick && m.kick.pl === 1);
  R.apply(st, 0, m); assert.strictEqual(st.horses[1][0], -1); R.check(st);
});
t('opponents in their home column are safe', () => {
  const st = S([45, -1, -1, -1], [53, -1, -1, -1]);
  for (let r = 1; r <= 6; r++) for (const m of R.legalMoves(st, 0, r)) assert.strictEqual(m.kick, null);
});
t('no kick when passing over', () => { const st = S([20, -1, -1, -1]); st.horses[2][0] = (22 - 26 + 52) % 52; const m = R.legalMoves(st, 0, 5)[0]; assert.strictEqual(m.kick, null); });

// ---------------------------------------------------------------- home column + final cell
t('enter the home column', () => { const m = R.legalMoves(S([48, -1, -1, -1]), 0, 5)[0]; assert.strictEqual(m.to, 53); assert.ok(m.enterHome); });
t('last track cell is 50, home column 51..55', () => { assert.strictEqual(R.legalMoves(S([49, -1, -1, -1]), 0, 1)[0].to, 50); assert.strictEqual(R.legalMoves(S([50, -1, -1, -1]), 0, 1)[0].to, 51); });
t('exact roll needed to reach home', () => { assert.strictEqual(R.legalMoves(S([53, 56, 56, 56]), 0, 4).length, 0); const m = R.legalMoves(S([53, 56, 56, 56]), 0, 3)[0]; assert.ok(m.finish && m.to === 56); });
t('overshoot from the track is not allowed', () => assert.strictEqual(R.legalMoves(S([52, 56, 56, 56]), 0, 6).length, 0));
t('own horse blocks a home-column cell', () => assert.deepStrictEqual(tos(R.legalMoves(S([51, 53, 56, 56]), 0, 2)), ['1:55']));
t('many horses may share the final cell', () => assert.strictEqual(R.legalMoves(S([54, 56, 56, 56]), 0, 2)[0].to, 56));
t('home column is private (no collision between colours)', () => { const st = S([53, -1, -1, -1], [53, -1, -1, -1]); R.check(st); });
t('finished horses never move', () => assert.strictEqual(R.legalMoves(S([56, 56, 56, 56]), 0, 6).length, 0));

// ---------------------------------------------------------------- turns, winner
t('a 6 gives another roll', () => { assert.strictEqual(R.nextPlayer(0, 6), 0); assert.strictEqual(R.nextPlayer(3, 6), 3); });
t('other rolls pass the turn clockwise', () => { for (let r = 1; r <= 5; r++) assert.strictEqual(R.nextPlayer(0, r), 1); assert.strictEqual(R.nextPlayer(3, 2), 0); });
t('winner needs all four horses home', () => { assert.strictEqual(R.winner(S([56, 56, 56, 55])), -1); assert.strictEqual(R.winner(S(null, null, [56, 56, 56, 56])), 2); });
t('homeCount / progress', () => { const st = S([56, 56, 10, -1]); assert.strictEqual(R.homeCount(st, 0), 2); assert.strictEqual(R.progress(st, 0), 57 + 57 + 11); });

// ---------------------------------------------------------------- bot
t('bot finishes when it can', () => { const st = S([53, 20, -1, -1]); const ms = R.legalMoves(st, 0, 3); assert.ok(R.chooseMove(st, 0, 3, ms, rnd).finish); });
t('bot kicks when it can', () => { const st = S([20, 5, -1, -1]); st.horses[1][0] = (24 - 13 + 52) % 52; const ms = R.legalMoves(st, 0, 4); for (let k = 0; k < 10; k++) assert.ok(R.chooseMove(st, 0, 4, ms, rnd).kick); });
t('bot leaves the stable on a 6 when nothing better', () => { const st = S([30, -1, -1, -1]); const ms = R.legalMoves(st, 0, 6); assert.ok(R.chooseMove(st, 0, 6, ms, rnd).exit); });
t('bot runs from danger', () => {
  const st = S([20, 2, -1, -1]); st.horses[1][0] = (17 - 13 + 52) % 52;    // green 3 cells behind red's horse at 20
  assert.ok(R.danger(st, 0, R.cellOf(0, 20)) >= 1);
  const m = R.chooseMove(st, 0, 5, R.legalMoves(st, 0, 5), () => .5); assert.strictEqual(m.h, 0);
});
t('bot returns null with no moves', () => assert.strictEqual(R.chooseMove(R.newState(), 0, 3, [], rnd), null));

// ---------------------------------------------------------------- simulations
t('3000 bot-vs-bot games finish with valid states', () => {
  let maxTurns = 0, wins = [0, 0, 0, 0];
  for (let g = 0; g < 3000; g++) {
    const r = R.simulate(rnd, { check: (st, pl, roll, m) => { R.check(st); assert.ok(m.to - Math.max(0, m.from) === (m.exit ? 0 : roll)); } });
    assert.ok(r.winner >= 0, 'game did not finish'); wins[r.winner]++; maxTurns = Math.max(maxTurns, r.turns);
  }
  assert.ok(maxTurns < 2000, 'max turns ' + maxTurns);
  assert.ok(wins.every(w => w > 400), 'every seat wins sometimes ' + wins);
});
t('1000 random-move games finish', () => { for (let g = 0; g < 1000; g++) { const r = R.simulate(rnd, { random: true, check: st => R.check(st) }); assert.ok(r.winner >= 0); } });
t('smart bot beats random movers', () => {
  let smart = 0; const N = 400;
  for (let g = 0; g < N; g++) {
    const st = R.newState(); let pl = 0, done = -1;
    for (let i = 0; i < 40000 && done < 0; i++) { const roll = 1 + Math.floor(rnd() * 6), ms = R.legalMoves(st, pl, roll); if (ms.length) R.apply(st, pl, pl === 0 ? R.chooseMove(st, pl, roll, ms, rnd) : ms[Math.floor(rnd() * ms.length)]); done = R.winner(st); pl = R.nextPlayer(pl, roll); }
    if (done === 0) smart++;
  }
  assert.ok(smart / N > .4, 'smart won ' + smart + '/' + N);
});

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
