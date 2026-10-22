'use strict';
/* node tests/co-caro.test.js — Cờ Caro rules + AI */
const assert = require('assert');
const R = require('../js/games3d/rules/co-caro.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); } }
const I = (r, c) => R.idx(r, c);
/** board from a list of [r, c, s] */
function B(list) { const b = new Int8Array(R.NN); for (const [r, c, s] of list) b[I(r, c)] = s; return b; }
const row = (r, c0, n, s) => Array.from({ length: n }, (_, k) => [r, c0 + k, s]);
const col = (c, r0, n, s) => Array.from({ length: n }, (_, k) => [r0 + k, c, s]);
const diag = (r0, c0, n, s) => Array.from({ length: n }, (_, k) => [r0 + k, c0 + k, s]);
const anti = (r0, c0, n, s) => Array.from({ length: n }, (_, k) => [r0 + k, c0 - k, s]);
let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---------------------------------------------------------------- five in a row, all directions
for (const [name, list, probe] of [
  ['horizontal at the top edge', row(0, 0, 5, 1), [0, 2]], ['horizontal at the right edge', row(9, 10, 5, 2), [9, 14]],
  ['vertical', col(14, 10, 5, 1), [12, 14]], ['vertical at the left edge', col(0, 0, 5, 2), [0, 0]],
  ['diagonal', diag(3, 3, 5, 1), [5, 5]], ['diagonal to the corner', diag(10, 10, 5, 1), [14, 14]],
  ['anti-diagonal', anti(2, 12, 5, 2), [4, 10]], ['anti-diagonal at the corner', anti(10, 4, 5, 1), [14, 0]],
]) t('five: ' + name, () => { const b = B(list); const l = R.winLine(b, I(...probe)); assert.ok(l && l.length === 5); assert.deepStrictEqual(R.findWinner(b).winner, list[0][2]); });
t('six in a row also wins', () => { const l = R.winLine(B(row(4, 2, 6, 1)), I(4, 4)); assert.strictEqual(l.length, 6); });
t('blocked five (both ends closed) still wins', () => { const b = B([...row(6, 3, 5, 1), [6, 2, 2], [6, 8, 2]]); assert.ok(R.winLine(b, I(6, 5))); });
t('four is not a win', () => { assert.strictEqual(R.winLine(B(row(4, 2, 4, 1)), I(4, 3)), null); assert.strictEqual(R.findWinner(B(diag(0, 0, 4, 2))), null); });
t('mixed colours are not a line', () => assert.strictEqual(R.winLine(B([...row(4, 2, 2, 1), [4, 4, 2], ...row(4, 5, 2, 1)]), I(4, 2)), null));
t('no wrap-around between rows', () => assert.strictEqual(R.findWinner(B([[0, 12, 1], [0, 13, 1], [0, 14, 1], [1, 0, 1], [1, 1, 1]])), null));
t('winLine on an empty cell', () => assert.strictEqual(R.winLine(new Int8Array(R.NN), 0), null));

// ---------------------------------------------------------------- game wrapper
t('game: turns, illegal moves, undo', () => {
  const g = new R.Game(); g.play(I(7, 7)); assert.strictEqual(g.turn, R.O); assert.throws(() => g.play(I(7, 7))); g.play(I(7, 8));
  g.undo(); assert.strictEqual(g.b[I(7, 8)], 0); assert.strictEqual(g.turn, R.O);
});
t('game: X wins with five', () => { const g = new R.Game(); const xs = [[7, 3], [7, 4], [7, 5], [7, 6], [7, 7]], os = [[0, 0], [0, 2], [0, 4], [0, 6]]; let r; for (let k = 0; k < 5; k++) { r = g.play(I(...xs[k])); if (k < 4) g.play(I(...os[k])); } assert.strictEqual(r.winner, R.X); assert.strictEqual(r.line.length, 5); assert.ok(!g.canPlay(I(9, 9))); });
t('game: full board without five is a draw', () => {
  const g = new R.Game();
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) g.b[I(r, c)] = (c + 2 * r) % 4 < 2 ? 1 : 2;
  assert.strictEqual(R.findWinner(g.b), null);
  const last = I(14, 14), s = g.b[last]; g.b[last] = 0; g.turn = s;
  const res = g.play(last); assert.deepStrictEqual(res, { winner: 0, line: null });
});

// ---------------------------------------------------------------- pattern classification
const C = R.CAT;
const catAt = (list, r, c, s) => Math.max(...R.cats(B(list), I(r, c), s, [0, 0, 0, 0]));
t('pattern: open four', () => assert.strictEqual(catAt(row(7, 4, 3, 1), 7, 7, 1), C.L4));
t('pattern: closed four', () => assert.strictEqual(catAt([...row(7, 4, 3, 1), [7, 3, 2]], 7, 7, 1), C.F4));
t('pattern: broken four X X _ X X', () => assert.strictEqual(catAt([[7, 3, 1], [7, 4, 1], [7, 6, 1]], 7, 7, 1), C.F4));
t('pattern: open three', () => assert.strictEqual(catAt(row(7, 5, 2, 1), 7, 7, 1), C.L3));
t('pattern: split open three', () => assert.strictEqual(catAt([[7, 4, 1], [7, 5, 1]], 7, 7, 1), C.L3));
t('pattern: three with walls at both ends is not open', () => assert.strictEqual(catAt([[7, 5, 1], [7, 6, 1], [7, 3, 2], [7, 9, 2]], 7, 7, 1), C.F3));
t('pattern: three with no room for five is dead', () => assert.strictEqual(catAt([[7, 5, 1], [7, 6, 1], [7, 4, 2], [7, 9, 2]], 7, 7, 1), 0));
t('pattern: dead four (no room for five)', () => assert.ok(catAt([[7, 4, 1], [7, 5, 1], [7, 6, 1], [7, 3, 2], [7, 8, 2]], 7, 7, 1) < C.F4));
t('pattern: five', () => assert.strictEqual(catAt(row(7, 3, 4, 2), 7, 7, 2), C.FIVE));
t('pattern table covers every shape', () => assert.strictEqual(R.TABLE.length, 6561));

// ---------------------------------------------------------------- AI tactics
const LV = ['de', 'vua', 'kho'];
t('AI takes the win (every level)', () => {
  const list = [...row(5, 5, 4, 2), [5, 4, 1], ...row(9, 5, 3, 1), [10, 6, 1]];
  for (const lv of LV) for (let k = 0; k < 5; k++) assert.strictEqual(R.bestMove(B(list), 2, lv, rnd), I(5, 9), lv);
});
t('AI takes a win in every direction', () => {
  for (const [list, want] of [[col(3, 2, 4, 2), [[1, 3], [6, 3]]], [diag(4, 4, 4, 2), [[3, 3], [8, 8]]], [anti(4, 10, 4, 2), [[3, 11], [8, 6]]]]) {
    const m = R.bestMove(B([...list, [12, 12, 1], [12, 13, 1]]), 2, 'vua', rnd); assert.ok(want.some(w => I(...w) === m));
  }
});
t('AI blocks a four (vua, kho)', () => {
  const list = [...row(7, 3, 4, 1), [7, 2, 2], [1, 1, 2]];
  for (const lv of ['vua', 'kho']) assert.strictEqual(R.bestMove(B(list), 2, lv, rnd), I(7, 7));
});
t('AI blocks a broken four X X _ X X', () => { const list = [[7, 3, 1], [7, 4, 1], [7, 6, 1], [7, 7, 1], [3, 3, 2]]; assert.strictEqual(R.bestMove(B(list), 2, 'kho', rnd), I(7, 5)); });
t('AI blocks an open three (vua, kho)', () => {
  const list = [...row(7, 5, 3, 1), [9, 9, 2], [1, 1, 1]];
  const ok = [I(7, 4), I(7, 8), I(7, 3), I(7, 9)];
  for (const lv of ['vua', 'kho']) for (let k = 0; k < 5; k++) assert.ok(ok.includes(R.bestMove(B(list), 2, lv, rnd)), lv);
});
t('AI blocks a diagonal open three', () => {
  const list = [...diag(5, 5, 3, 1), [3, 10, 2]];
  const ok = [I(4, 4), I(8, 8), I(3, 3), I(9, 9)];
  assert.ok(ok.includes(R.bestMove(B(list), 2, 'kho', rnd)));
});
t('AI prefers its own open four over blocking an open three', () => {
  const list = [...row(3, 5, 3, 2), ...row(10, 5, 3, 1)];
  for (const lv of ['vua', 'kho']) { const m = R.bestMove(B(list), 2, lv, rnd); assert.ok([I(3, 4), I(3, 8)].includes(m), lv + ' ' + m); }
});
t('AI wins with a double four', () => {
  const list = [...row(7, 7, 3, 2), [7, 6, 1], ...col(10, 8, 3, 2), [11, 10, 1], [0, 0, 1], [0, 1, 1]];
  assert.strictEqual(R.bestMove(B(list), 2, 'vua', rnd), I(7, 10));
});
t('Khó finds a two-step VCF and it really wins', () => {
  const list = [...row(7, 7, 3, 2), [7, 6, 1], [9, 10, 2], [10, 10, 2], [11, 10, 1], [9, 11, 2], [10, 12, 2], [11, 13, 1], [0, 0, 1], [0, 14, 1], [14, 0, 1]];
  const b = B(list);
  assert.strictEqual(R.cellScore(b, I(8, 10), 2) < R.W_WIN, true, 'no immediate double four');
  const v = R.vcf(Int8Array.from(b), 2); assert.ok(v >= 0, 'vcf found');
  // play it out: O follows its VCF, X blocks every five threat
  const g = Int8Array.from(b); let won = false;
  for (let step = 0; step < 10 && !won; step++) {
    const m = R.bestMove(g, 2, 'kho', rnd); g[m] = 2; if (R.winLine(g, m)) { won = true; break; }
    const threats = []; for (let i = 0; i < R.NN; i++) if (!g[i] && R.cellScore(g, i, 2) >= R.W_FIVE) threats.push(i);
    assert.ok(threats.length >= 1, 'every move is forcing');
    g[threats[0]] = 1;
  }
  assert.ok(won);
});
t('AI always returns an empty cell', () => {
  for (let k = 0; k < 40; k++) { const b = new Int8Array(R.NN); for (let j = 0; j < 60; j++) b[Math.floor(rnd() * R.NN)] = 1 + (j % 2); if (R.findWinner(b)) continue; for (const lv of LV) { const m = R.bestMove(b, 2, lv, rnd); assert.ok(m >= 0 && !b[m]); } }
});
t('AI opens in the centre', () => assert.strictEqual(R.bestMove(new Int8Array(R.NN), 1, 'kho', rnd), I(7, 7)));

// ---------------------------------------------------------------- whole games
function playGame(lvX, lvO) {
  const g = new R.Game(); let n = 0, maxMs = 0;
  while (!g.over) { const t0 = Date.now(); const m = R.bestMove(g.b, g.turn, g.turn === 1 ? lvX : lvO, rnd); maxMs = Math.max(maxMs, Date.now() - t0); assert.ok(g.canPlay(m)); g.play(m); n++; assert.ok(n <= 225); }
  return { winner: g.over.winner, n, maxMs };
}
t('Khó beats Dễ (as O, moving second)', () => { let w = 0, slow = 0; for (let k = 0; k < 12; k++) { const r = playGame('de', 'kho'); if (r.winner === 2) w++; slow = Math.max(slow, r.maxMs); } assert.ok(w >= 10, 'kho won ' + w + '/12'); assert.ok(slow < 1000, 'slowest move ' + slow + ' ms'); });
t('Vừa beats Dễ most of the time', () => { let w = 0; for (let k = 0; k < 12; k++) if (playGame('de', 'vua').winner === 2) w++; assert.ok(w >= 8, 'vua won ' + w + '/12'); });
t('Khó beats Vừa (fixed node budget, deterministic)', () => {
  const saved = Object.assign({}, R.KHO); Object.assign(R.KHO, { nodes: 6000, ms: Infinity });
  let w = 0, l = 0;
  for (let k = 0; k < 6; k++) { const khoSide = k < 4 ? 2 : 1; const r = playGame(khoSide === 1 ? 'kho' : 'vua', khoSide === 2 ? 'kho' : 'vua'); if (r.winner === khoSide) w++; else if (r.winner) l++; }
  Object.assign(R.KHO, saved);
  assert.ok(w >= 4 && w > l, `kho ${w} – vua ${l}`);
});
t('random-ish games always finish', () => { for (let k = 0; k < 20; k++) { const r = playGame('de', 'de'); assert.ok([0, 1, 2].includes(r.winner)); } });

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
