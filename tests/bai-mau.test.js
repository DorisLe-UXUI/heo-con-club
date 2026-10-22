'use strict';
/* node tests/bai-mau.test.js — rules of Bài Màu (UNO-style). */
const assert = require('assert'); const path = require('path'); const fs = require('fs');
const R = require('../js/games3d/rules/bai-mau.js');
let passed = 0, failed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n ', e && e.stack || e); } }
let uid = 5000; const K = s => { const [c, v] = s.split(':'); return R.mkCard(uid++, c, v); };   // 'red:5', 'wild:draw4'
const hand = s => s.split(' ').filter(Boolean).map(K);

// ------------------------------------------------------------------ deck
t('deck has 108 cards', () => assert.strictEqual(R.makeDeck().length, 108));
t('deck composition', () => {
  const d = R.makeDeck(), cnt = {};
  for (const c of d) cnt[c.c + ':' + c.v] = (cnt[c.c + ':' + c.v] || 0) + 1;
  for (const col of R.COLORS) {
    assert.strictEqual(cnt[col + ':0'], 1, col + ' 0');
    for (let n = 1; n <= 9; n++) assert.strictEqual(cnt[col + ':' + n], 2, col + ' ' + n);
    for (const a of ['skip', 'reverse', 'draw2']) assert.strictEqual(cnt[col + ':' + a], 2, col + ' ' + a);
    assert.strictEqual(d.filter(c => c.c === col).length, 25);
  }
  assert.strictEqual(cnt['wild:wild'], 4); assert.strictEqual(cnt['wild:draw4'], 4);
  assert.strictEqual(new Set(d.map(c => c.id)).size, 108, 'unique ids');
});
t('every card has a texture in the bai-mau bundle', () => {
  global.window = global.window || {}; require(path.join(__dirname, '../assets/3d/js/tex_bai-mau.js'));
  const keys = new Set(R.makeDeck().map(c => c.key)); assert.strictEqual(keys.size, 54);
  for (const k of keys) assert.ok(window.HC_TEX[k], 'missing texture ' + k);
  assert.ok(window.HC_TEX.bm_back);
});
t('points', () => {
  assert.strictEqual(R.points(K('red:7')), 7); assert.strictEqual(R.points(K('blue:0')), 0);
  for (const a of ['skip', 'reverse', 'draw2']) assert.strictEqual(R.points(K('green:' + a)), 20);
  assert.strictEqual(R.points(K('wild:wild')), 50); assert.strictEqual(R.points(K('wild:draw4')), 50);
  assert.strictEqual(R.handPoints(hand('red:9 blue:skip wild:wild yellow:3')), 82);
  assert.strictEqual(R.handPoints(R.makeDeck()), 4 * (2 * 45 + 6 * 20) + 8 * 50);
});

// ------------------------------------------------------------------ legality of every card type
t('legality: colour, number, symbol, wilds', () => {
  const top = K('red:5'), h = hand('red:1 blue:5 blue:7 green:skip yellow:draw2 wild:wild wild:draw4');
  const L = c => R.isLegal(c, top, 'red', h);
  assert.ok(L(K('red:1')), 'same colour'); assert.ok(L(K('blue:5')), 'same number'); assert.ok(!L(K('blue:7')), 'nothing matches');
  assert.ok(L(K('red:skip')), 'red action on red'); assert.ok(!L(K('green:skip')), 'green skip on red 5');
  assert.ok(L(K('wild:wild')), 'wild always'); assert.ok(!L(K('wild:draw4')), '+4 not allowed while holding red');
  assert.ok(R.isLegal(K('wild:draw4'), top, 'red', hand('blue:5 green:1')), '+4 allowed without the current colour');
  assert.ok(R.isLegal(K('wild:draw4'), top, 'red', hand('blue:5 red:1').filter(c => c.c !== 'red').concat(hand('blue:9'))));
});
t('legality: symbols match across colours', () => {
  for (const a of ['skip', 'reverse', 'draw2']) {
    assert.ok(R.isLegal(K('blue:' + a), K('green:' + a), 'green', []), a + ' on ' + a);
    assert.ok(!R.isLegal(K('blue:' + a), K('green:3'), 'green', []), a + ' on a number');
    assert.ok(R.isLegal(K('green:' + a), K('green:3'), 'green', []), a + ' same colour');
  }
});
t('legality: after a wild only the named colour matches', () => {
  assert.ok(R.isLegal(K('blue:3'), K('wild:wild'), 'blue', []));
  assert.ok(!R.isLegal(K('red:3'), K('wild:wild'), 'blue', []));
  assert.ok(!R.isLegal(K('red:draw2'), K('wild:draw4'), 'yellow', []));
  assert.ok(R.isLegal(K('wild:wild'), K('wild:draw4'), 'yellow', []));
});
t('after drawing only the drawn card may be played', () => {
  const st = R.setup({ hands: [hand('red:1 blue:9'), hand('green:2'), hand('green:3'), hand('green:4')], top: K('red:5'), draw: [K('red:8')] });
  const ev = R.drawTurn(st, 0); assert.ok(ev.playable); assert.strictEqual(st.turn, 0);
  assert.ok(!R.canPlay(st, 0, st.hands[0][0]), 'red 1 blocked after drawing'); assert.ok(R.canPlay(st, 0, ev.card));
  assert.throws(() => R.play(st, 0, st.hands[0][0].id));
  R.pass(st, 0); assert.strictEqual(st.turn, 1); assert.strictEqual(st.hands[0].length, 3);
});
t('drawing an unplayable card passes the turn', () => {
  const st = R.setup({ hands: [hand('blue:9'), hand('green:2'), hand('green:3'), hand('green:4')], top: K('red:5'), draw: [K('green:8')] });
  const ev = R.drawTurn(st, 0); assert.ok(!ev.playable); assert.strictEqual(st.turn, 1); assert.strictEqual(st.hands[0].length, 2);
  assert.throws(() => R.drawTurn(st, 0), /not your turn/);
});
t('illegal plays and wrong turn are rejected', () => {
  const st = R.setup({ hands: [hand('blue:9 red:2'), hand('green:2'), hand('green:3'), hand('green:4')], top: K('red:5') });
  assert.throws(() => R.play(st, 0, st.hands[0][0].id), /illegal/);
  assert.throws(() => R.play(st, 1, st.hands[1][0].id), /not your turn/);
});

// ------------------------------------------------------------------ action effects
const four = (h0, top, opts = {}) => R.setup(Object.assign({ hands: [hand(h0), hand('green:1 green:2 green:3'), hand('green:4 green:5 green:6'), hand('green:7 green:8 green:9')], top: K(top), draw: hand('blue:1 blue:2 blue:3 blue:4 blue:5 blue:6 blue:7 blue:8') }, opts));
const play = (st, p, key, color) => { const c = st.hands[p].find(x => x.key === key); assert.ok(c, 'p' + p + ' has ' + key); return R.play(st, p, c.id, color); };
t('number card: next player, colour follows the card', () => { const st = four('red:3 red:4', 'red:5'); play(st, 0, 'bm_red_3'); assert.strictEqual(st.turn, 1); assert.strictEqual(st.color, 'red'); });
t('skip: next player loses the turn', () => { const st = four('red:skip red:4', 'red:5'); const ev = play(st, 0, 'bm_red_skip'); assert.strictEqual(ev.skipped, 1); assert.strictEqual(st.turn, 2); });
t('reverse with 4 players reverses direction', () => {
  const st = four('red:reverse red:4', 'red:5'); const ev = play(st, 0, 'bm_red_reverse');
  assert.ok(ev.reversed); assert.strictEqual(st.dir, -1); assert.strictEqual(st.turn, 3);
});
t('reverse with 2 players acts like skip', () => {
  const st = R.setup({ hands: [hand('red:reverse red:4'), hand('green:1')], top: K('red:5') }); play(st, 0, 'bm_red_reverse'); assert.strictEqual(st.turn, 0);
});
t('+2: next player draws 2 and loses the turn', () => {
  const st = four('red:draw2 red:4', 'red:5'); const ev = play(st, 0, 'bm_red_draw2');
  assert.strictEqual(ev.victim, 1); assert.strictEqual(ev.drawn.length, 2); assert.strictEqual(st.hands[1].length, 5); assert.strictEqual(st.turn, 2);
});
t('wild: chosen colour', () => { const st = four('wild:wild red:4', 'red:5'); play(st, 0, 'bm_wild', 'blue'); assert.strictEqual(st.color, 'blue'); assert.strictEqual(st.turn, 1); });
t('+4: chosen colour, next draws 4 and loses the turn', () => {
  const st = four('wild:draw4 blue:4', 'red:5'); const ev = play(st, 0, 'bm_wild_draw4', 'yellow');
  assert.strictEqual(st.color, 'yellow'); assert.strictEqual(ev.drawn.length, 4); assert.strictEqual(st.hands[1].length, 7); assert.strictEqual(st.turn, 2);
});
t('wild without a colour names the best colour of the hand', () => { const st = four('wild:wild green:4 green:7 red:1', 'red:5'); play(st, 0, 'bm_wild'); assert.strictEqual(st.color, 'green'); });
t('chain: reverse → skip → +2 → reverse → +4 → skip', () => {
  const st = R.setup({ hands: [hand('red:reverse wild:draw4 blue:9 blue:1'), hand('red:draw2 green:2 green:3'), hand('yellow:1 yellow:2 yellow:3'), hand('red:skip red:reverse yellow:4 blue:skip')], top: K('red:5'),
    draw: hand('blue:1 blue:2 blue:3 blue:4 blue:5 blue:6 blue:7 blue:8 blue:9 green:1') });
  play(st, 0, 'bm_red_reverse'); assert.deepStrictEqual([st.dir, st.turn], [-1, 3]);          // 0 reverses: 3 is next (counter-clockwise)
  play(st, 3, 'bm_red_skip'); assert.strictEqual(st.turn, 1);                                // 3 skips 2
  const e = play(st, 1, 'bm_red_draw2'); assert.strictEqual(e.victim, 0); assert.strictEqual(st.hands[0].length, 5); assert.strictEqual(st.turn, 3);   // 0 draws 2, loses the turn
  play(st, 3, 'bm_red_reverse'); assert.deepStrictEqual([st.dir, st.turn], [1, 0]);          // direction back to clockwise, 0 is next
  assert.strictEqual(st.color, 'red');
  const e4 = play(st, 0, 'bm_wild_draw4', 'blue');                                          // 0 holds no red → +4 legal
  assert.strictEqual(e4.victim, 1); assert.strictEqual(st.hands[1].length, 6); assert.strictEqual(st.turn, 2);
  assert.ok(!R.canPlay(st, 2, st.hands[2][0]));                                              // yellow on blue: must draw
  const d = R.drawTurn(st, 2); if (d.playable) R.pass(st, 2); assert.strictEqual(st.turn, 3);
  play(st, 3, 'bm_blue_skip'); assert.strictEqual(st.turn, 1);                                // 3 skips 0
  assert.strictEqual(R.countCards(st), 1 + 4 + 3 + 3 + 4 + 10);
});
t('last card +2 still makes the next player draw; winner scores', () => {
  const st = R.setup({ hands: [hand('red:draw2'), hand('green:1 green:9'), hand('yellow:skip'), hand('wild:wild blue:3')], top: K('red:5'), draw: hand('blue:5 blue:6') });
  st.unoCalled[0] = true; const ev = play(st, 0, 'bm_red_draw2');
  assert.ok(st.over); assert.strictEqual(st.winner, 0); assert.strictEqual(st.hands[1].length, 4); assert.strictEqual(ev.drawn.length, 2);
  const sc = R.score(st); assert.strictEqual(sc.points, 1 + 9 + 5 + 6 + 20 + 50 + 3); assert.strictEqual(sc.per[0], 0);
  assert.throws(() => R.drawTurn(st, 1), /game over/);
});
t('stake settlement: winner takes the pot', () => {
  assert.deepStrictEqual(R.settle(4, 2, 10000), [-10000, -10000, 30000, -10000]);
  assert.strictEqual(R.settle(4, 0, 5000).reduce((a, b) => a + b, 0), 0);
});
t('draw pile reshuffles the discard pile (top card stays)', () => {
  const st = R.setup({ hands: [hand('blue:9'), hand('green:2'), hand('green:3'), hand('green:4')], top: K('red:5'), discard: hand('red:1 red:2 red:3'), draw: [] });
  const total = R.countCards(st); const topBefore = R.top(st);
  R.drawTurn(st, 0); assert.strictEqual(R.top(st), topBefore); assert.strictEqual(st.discard.length, 1); assert.strictEqual(st.draw.length, 2); assert.strictEqual(R.countCards(st), total);
});
t('nothing left to draw: the turn still passes (no deadlock)', () => {
  const st = R.setup({ hands: [hand('blue:9'), hand('green:2'), hand('green:3'), hand('green:4')], top: K('red:5'), draw: [] });
  const ev = R.drawTurn(st, 0); assert.strictEqual(ev.card, null); assert.strictEqual(st.turn, 1);
});
t('start card effects', () => {
  const deckWithStart = (key) => { const d = R.makeDeck(); const i = d.findIndex(c => c.key === key); const [c] = d.splice(i, 1); d.splice(d.length - 28, 0, c); return d; };   // 28 cards dealt first
  let st = R.newGame({ deck: deckWithStart('bm_red_skip'), dealer: 3 }); assert.strictEqual(R.top(st).key, 'bm_red_skip'); assert.strictEqual(st.turn, 1);
  st = R.newGame({ deck: deckWithStart('bm_red_reverse'), dealer: 3 }); assert.strictEqual(st.dir, -1); assert.strictEqual(st.turn, 3);
  st = R.newGame({ deck: deckWithStart('bm_red_draw2'), dealer: 3 }); assert.strictEqual(st.hands[0].length, 9); assert.strictEqual(st.turn, 1);
  st = R.newGame({ deck: deckWithStart('bm_red_7'), dealer: 3 }); assert.strictEqual(st.turn, 0); assert.strictEqual(st.color, 'red');
  st = R.newGame({ deck: deckWithStart('bm_wild_draw4'), dealer: 1, rng: R.rng32(3) }); assert.notStrictEqual(R.top(st).c, 'wild'); assert.strictEqual(R.countCards(st), 108);
});
t('7 cards each after the deal', () => { const st = R.newGame({ rng: R.rng32(1) }); st.hands.forEach(h => assert.strictEqual(h.length >= 7, true)); assert.strictEqual(R.countCards(st), 108); });

// ------------------------------------------------------------------ UNO call / catch
t('forgetting UNO can be caught: +2 cards', () => {
  const st = four('red:3 red:4', 'red:5'); const ev = play(st, 0, 'bm_red_3');
  assert.ok(ev.forgotUno); assert.strictEqual(st.unoPending, 0);
  const c = R.catchUno(st, 2); assert.ok(c); assert.strictEqual(c.target, 0); assert.strictEqual(st.hands[0].length, 3); assert.strictEqual(st.unoPending, -1);
  assert.strictEqual(R.catchUno(st, 1), null, 'only once');
});
t('calling UNO before playing protects you', () => {
  const st = four('red:3 red:4', 'red:5'); assert.ok(R.canCallUno(st, 0)); assert.ok(R.callUno(st, 0));
  const ev = play(st, 0, 'bm_red_3'); assert.ok(ev.uno); assert.strictEqual(st.unoPending, -1); assert.strictEqual(R.catchUno(st, 1), null);
});
t('late UNO call before being caught still counts', () => {
  const st = four('red:3 red:4', 'red:5'); play(st, 0, 'bm_red_3'); assert.ok(R.canCallUno(st, 0)); R.callUno(st, 0); assert.strictEqual(R.catchUno(st, 1), null);
});
t('the catch window closes when the next player acts', () => {
  const st = four('red:3 red:4', 'red:5'); play(st, 0, 'bm_red_3'); R.drawTurn(st, 1);
  assert.strictEqual(st.unoPending, -1); assert.strictEqual(R.catchUno(st, 2), null);
});
t('cannot call UNO with many cards or off-turn', () => { const st = four('red:3 red:4 red:6', 'red:5'); assert.ok(!R.canCallUno(st, 0)); assert.ok(!R.canCallUno(st, 1)); });

// ------------------------------------------------------------------ bots
t('bot only plays legal cards and names a real colour', () => {
  const rng = R.rng32(7);
  for (let g = 0; g < 300; g++) {
    const st = R.newGame({ rng }); const m = R.botMove(st, st.turn, rng);
    if (!m) { assert.strictEqual(R.legalMoves(st, st.turn).length, 0); continue; }
    const c = st.hands[st.turn].find(x => x.id === m.id); assert.ok(R.canPlay(st, st.turn, c));
    if (R.isWild(c)) assert.ok(R.COLORS.includes(m.color));
  }
});
t('bot attacks a player with one card', () => {
  const st = R.setup({ hands: [hand('red:9 red:draw2 blue:1'), hand('green:1'), hand('green:3 green:5'), hand('green:4 green:6')], top: K('red:5') });
  assert.strictEqual(st.hands[0].find(c => c.id === R.botMove(st, 0, () => .5).id).v, 'draw2');
});
t('bot keeps wild cards when it has other options', () => {
  const st = R.setup({ hands: [hand('wild:wild red:2 blue:1 green:4'), hand('green:1 green:2 green:8'), hand('green:3'), hand('green:4')], top: K('red:5') });
  assert.strictEqual(st.hands[0].find(c => c.id === R.botMove(st, 0, () => .5).id).key, 'bm_red_2');
});

// ------------------------------------------------------------------ thousands of bot-only games
t('3000 random bot games finish with cards conserved', () => {
  const rng = R.rng32(20261014); let limit = 0, turns = 0, maxT = 0, catches = 0;
  for (let g = 0; g < 3000; g++) {
    const st = R.newGame({ rng, players: g % 10 === 9 ? 2 + (g % 3) : 4, dealer: g % 4 % (g % 10 === 9 ? 2 : 4) });
    const n = st.n; let steps = 0;
    while (!st.over) {
      const p = st.turn; steps++;
      if (steps > 20000) throw new Error('game did not finish');
      if (R.canCallUno(st, p) && rng() < .8) R.callUno(st, p);
      const m = R.botMove(st, p, rng);
      if (m) R.play(st, p, m.id, m.color);
      else { const d = R.drawTurn(st, p); if (d.playable) { if (rng() < .85) { const c = d.card; if (R.canCallUno(st, p) && rng() < .8) R.callUno(st, p); R.play(st, p, c.id, R.isWild(c) ? R.bestColor(st.hands[p], rng) : null); } else R.pass(st, p); } }
      if (st.unoPending >= 0 && rng() < .5) { const c = R.catchUno(st, (st.unoPending + 1 + Math.floor(rng() * (n - 1))) % n); if (c) catches++; }
      if (g < 300) {
        assert.strictEqual(R.countCards(st), 108, 'cards conserved');
        const ids = new Set(); for (const pile of [st.draw, st.discard, ...st.hands]) for (const c of pile) { assert.ok(!ids.has(c.id), 'duplicate card'); ids.add(c.id); }
        assert.ok(R.COLORS.includes(st.color));
      }
    }
    assert.strictEqual(R.countCards(st), 108);
    if (st.reason === 'limit') limit++; else assert.strictEqual(st.hands[st.winner].length, 0, 'winner emptied the hand');
    const sc = R.score(st); assert.ok(sc.points >= 0);
    assert.strictEqual(R.settle(n, st.winner, 1000).reduce((a, b) => a + b, 0), 0);
    turns += st.turns; maxT = Math.max(maxT, st.turns);
  }
  assert.ok(limit <= 3, 'games ending on the turn limit: ' + limit);
  assert.ok(catches > 0, 'some UNO catches happened');
  console.log(`  3000 games: avg ${(turns / 3000).toFixed(1)} turns, max ${maxT}, turn-limit endings ${limit}, UNO catches ${catches}`);
});

console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
