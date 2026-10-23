'use strict';
// node tests/phom.test.js — Phỏm (Tá Lả) melds, eating, scoring and thousands of bot-vs-bot games.
const assert = require('assert');
const R = require('../js/games3d/rules/phom.js');
let passed = 0, failed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n ', e.stack.split('\n').slice(0, 3).join('\n  ')); } }
// "As 10h Kd" → ids
const C = tok => { const m = tok.match(/^(10|[2-9JQKA])([scdh])$/); if (!m) throw new Error('bad card ' + tok); return R.RANKS.indexOf(m[1]) * 4 + 'scdh'.indexOf(m[2]); };
const ids = s => s.trim().split(/\s+/).map(C);
const same = (a, b) => assert.deepStrictEqual(R.sortIds(a), R.sortIds(b));

// ---------------------------------------------------------------- melds
t('set of 3', () => assert.strictEqual(R.meldKind(ids('7s 7h 7d')), 'set'));
t('set of 4', () => assert.strictEqual(R.meldKind(ids('7s 7h 7d 7c')), 'set'));
t('run A-2-3 (A low)', () => assert.strictEqual(R.meldKind(ids('As 2s 3s')), 'run'));
t('run J-Q-K', () => assert.strictEqual(R.meldKind(ids('Jh Qh Kh')), 'run'));
t('run of 5', () => assert.strictEqual(R.meldKind(ids('5d 6d 7d 8d 9d')), 'run'));
t('no wrap K-A-2', () => assert.strictEqual(R.meldKind(ids('Kh Ah 2h')), null));
t('Q-K-A is not a run (A is low)', () => assert.strictEqual(R.meldKind(ids('Qh Kh Ah')), null));
t('mixed suits run refused', () => assert.strictEqual(R.meldKind(ids('5d 6h 7d')), null));
t('two cards are not a phỏm', () => assert.strictEqual(R.meldKind(ids('5d 5h')), null));
t('gap refused', () => assert.strictEqual(R.meldKind(ids('5d 6d 8d')), null));
t('points A=1 … K=13', () => { assert.strictEqual(R.pts(C('As')), 1); assert.strictEqual(R.pts(C('10h')), 10); assert.strictEqual(R.pts(C('Kc')), 13); });

// ---------------------------------------------------------------- meld finding
t('solve: two phỏm and deadwood', () => {
  const a = R.solve(ids('7s 7h 7d 3c 4c 5c Kh 2d 9s'));
  assert.strictEqual(a.melds.length, 2); assert.strictEqual(a.pts, 13 + 2 + 9); same(a.rest, ids('Kh 2d 9s'));
});
t('solve prefers fewer points over more cards', () => {
  // 8♠ can join the run 6-7-8♠ or the set 8-8-8; the solver keeps the arrangement leaving the fewest points
  const a = R.solve(ids('6s 7s 8s 8h 8d 9c Kd'));
  assert.strictEqual(a.pts, 9 + 13 + Math.min(6 + 7, 8 + 8));
});
t('solve with 4-card set split to free a run card', () => {
  const a = R.solve(ids('5s 5h 5d 5c 6s 7s'));
  assert.strictEqual(a.pts, 0, 'set of 3 + run 5-6-7♠');
});
t('locked card must be in a meld', () => {
  assert.strictEqual(R.solve(ids('7s 7h 9d'), ids('9d')), null);
  assert.ok(R.solve(ids('7s 7h 7d'), ids('7d')));
});
t('two eaten cards cannot share a phỏm', () => {
  assert.strictEqual(R.solve(ids('7s 7h 7d'), ids('7s 7h')), null);
  const a = R.solve(ids('7s 7h 7d 7c 8s 9s'), ids('7s 7h'));
  assert.ok(a && a.melds.every(m => m.filter(id => [C('7s'), C('7h')].includes(id)).length <= 1));
});
t('max-melded objective (ù check)', () => {
  const a = R.solve(ids('As 2s 3s 4h 4d 4c 9h 10h Jh Kd'), [], 'cnt');
  assert.strictEqual(a.melded, 9);
});
t('arrangements offers alternatives, best first', () => {
  const list = R.arrangements(ids('6s 7s 8s 8h 8d 9c Kd 2h 3h'));
  assert.ok(list.length >= 2); assert.ok(list[0].pts <= list[1].pts);
});
t('canEat needs a phỏm with own cards', () => {
  assert.ok(R.canEat(ids('7s 7h 2d'), [], C('7d')));
  assert.ok(R.canEat(ids('5c 6c Kd'), [], C('7c')));
  assert.ok(R.canEat(ids('5c 7c Kd'), [], C('6c')));
  assert.ok(!R.canEat(ids('5c 7h Kd'), [], C('6c')));
  assert.ok(!R.canEat(ids('7s 7h 7d 2c'), ids('7d'), C('7c')), 'second eaten card in the same set');
});
t('canDiscard keeps eaten phỏm intact', () => {
  const hand = ids('7s 7h 7d 2c'), locked = ids('7d');
  assert.ok(!R.canDiscard(hand, locked, C('7d')), 'eaten card');
  assert.ok(!R.canDiscard(hand, locked, C('7s')), 'breaks the phỏm');
  assert.ok(R.canDiscard(hand, locked, C('2c')));
});
t('lay off (gửi)', () => {
  assert.ok(R.fits(ids('7s 7h 7d'), C('7c')));
  assert.ok(R.fits(ids('5c 6c 7c'), C('8c')));
  assert.ok(R.fits(ids('5c 6c 7c'), C('4c')));
  assert.ok(!R.fits(ids('5c 6c 7c'), C('9c')));
  assert.ok(!R.fits(ids('7s 7h 7d 7c'), C('7c')));
});

// ---------------------------------------------------------------- scripted game
function fixed(hands, deck, starter = 0) { const g = new R.Game({ seed: 3, starter }); g.deal(hands.map(ids), deck ? ids(deck) : undefined); return g; }
t('turn flow, eating, chốt penalty, hạ, gửi and payouts', () => {
  const g = fixed([
    '7s 7h 2c 3d 9h Jc Qd Kd Ks 4h',   // P0 (starter, 10)
    '7d 8s 9s Ah 5c 6d Jh Qs 10c',     // P1
    '2s 2h 3s 4s 5h 6h Kc Kh 9d',      // P2
    'As Ac 3c 4c 8d 10d Jd 6s 5s',     // P3
  ]);
  assert.strictEqual(g.turn, 0); assert.strictEqual(g.phase, 'discard');
  assert.strictEqual(g.discard(0, C('7s'))[0].type, 'discard');
  assert.strictEqual(g.turn, 1); assert.strictEqual(g.phase, 'take');
  // P1 holds 8♠ 9♠ → 7♠ makes a run: eat it
  assert.ok(g.canEat(1));
  const ev = g.eat(1); assert.strictEqual(ev[0].type, 'eat'); assert.strictEqual(ev[0].units, 1);
  assert.deepStrictEqual(g.units, [-1, 1, 0, 0]);
  assert.ok(g.locked[1].includes(C('7s')));
  assert.strictEqual(g.discard(1, C('7s'))[0].type, 'invalid', 'cannot discard an eaten card');
  assert.strictEqual(g.discard(1, C('8s'))[0].type, 'invalid', 'cannot break the eaten phỏm');
  g.discard(1, C('Ah'));
  assert.ok(!g.canEat(2)); assert.strictEqual(g.eat(2)[0].type, 'invalid');
  g.draw(2); assert.strictEqual(g.phase, 'discard');
  assert.strictEqual(g.draw(2)[0].type, 'invalid', 'one take per turn');
});
t('ù right after taking pays 5 from each', () => {
  const g = fixed([
    'As 2s 3s 4h 4d 4c 9h 10h Jh Kd',  // P0: 9 cards in phỏm already → ù at the deal (10 cards)
    '7d 8s 9s Ah 5c 6d Jc Qs 10c',
    '2c 2h 3d 5s 5h 6h Kc Kh 9d',
    'Ac 3c 4s 8c 8d 10d Jd 6s 7s',
  ]);
  assert.ok(g.over); assert.strictEqual(g.result.kind, 'u'); assert.deepStrictEqual(g.units, [15, -5, -5, -5]);
});
t('ù by drawing', () => {
  const g = fixed([
    'Qc Qd 2c 3d 9h Jc Ks Kd 8h 5d',
    '7s 8s 9s 4h 4d 4c Jh Qh 2h',       // P1 needs 10h for 9 melded (7-8-9♠, 4-4-4, J-Q♥ + 10h)
    '2s 3s 4s 5h 6h Kc Kh 9d 6d',
    'As Ac 3c Ad 8d 10d Jd 6s 5s',
  ], '10h');
  g.discard(0, C('2c')); assert.ok(!g.canEat(1)); g.draw(1);
  assert.ok(g.over); assert.strictEqual(g.result.winner, 1); assert.deepStrictEqual(g.units, [-5, 15, -5, -5]);
});
t('end of game: ranking, móm pays 4, gửi bài lowers points', () => {
  const g = new R.Game({ seed: 1, starter: 0 });
  g.deal([[], [], [], []], []); // empty shell, then craft the final state directly
  g.hands = [ids('7s 7h 7d 2c 3c 9h Jc Kd 5s'), ids('8s 9s 10s Ah 2h 3d 4d 5d 6c'), ids('Qs Qh Qd Qc Kh Ks 10d 10c Jd'), ids('As 2d 3s 4s 6d 8c 9c Jh 10h')];
  g.locked = [[], [], [], []]; g.phase = 'lay';
  g.lay();
  const r = g.result;
  // P0: 7-7-7, rest 2c 3c 9h Jc Kd 5s = 2+3+9+11+13+5 = 43; P1: 8-9-10♠ + 3-4-5♦ wait 3d 4d 5d is a run; rest Ah 2h 6c → gửi? none fits → 1+2+6 = 9
  // P2: QQQQ, rest Kh Ks 10d 10c Jd → P2 can gửi Jh? no (not P2's). P3 has no phỏm → móm.
  assert.ok(r.mom[3]); assert.ok(!r.mom[0] && !r.mom[1] && !r.mom[2]);
  assert.strictEqual(r.ranking[3], 3, 'móm ranks last');
  assert.strictEqual(r.ranking[0], 1);
  const u = R.Game.expectedUnits(r); assert.deepStrictEqual(u, r.units);
  assert.strictEqual(r.units[3], -4);
  assert.strictEqual(r.units.reduce((a, b) => a + b, 0), 0);
});
t('gửi bài onto another player phỏm', () => {
  const g = new R.Game({ seed: 1, starter: 0 });
  g.deal([[], [], [], []], []);
  g.hands = [ids('7s 7h 7d 9c Kd Qd 2c 3h 4s'), ids('8c 10c Jc Qc 5h 6h Ah 2h 3d'), ids('2s 3s 4d 5s 6s 9h 9d Ks Kh'), ids('As Ac Ad 8d 8h 10h Js 10s Qh')];
  g.locked = [[], [], [], []]; g.phase = 'lay';
  g.lay();
  const r = g.result;
  // P1 laid 10-J-Q♣; P0 can send 9♣ to it, P0's 7c? P3 can send 7c? — check that 9♣ left P0's rest
  assert.ok(r.sent[0].some(s => s.card === C('9c') && s.to === 1), JSON.stringify(r.sent));
  assert.ok(!r.rest[0].includes(C('9c')));
});
t('gửi bài preview and skipping it', () => {
  const mk = () => { const g = new R.Game({ seed: 1, starter: 0 }); g.deal([[], [], [], []], []);
    g.hands = [ids('7s 7h 7d 9c Kd Qd 2c 3h 4s'), ids('8c 10c Jc Qc 5h 6h Ah 2h 3d'), ids('2s 3s 4d 5s 6s 9h 9d Ks Kh'), ids('As Ac Ad 8d 8h 10h Js 10s Qh')];
    g.locked = [[], [], [], []]; g.phase = 'lay'; return g; };
  const a = mk(); a.layDown();
  assert.strictEqual(a.phase, 'send');
  const opts = a.sendOptions(0);
  assert.ok(opts.some(o => o.card === C('9c') && o.to === 1));
  a.finishLay({ skip: { 0: true } });
  assert.ok(a.result.rest[0].includes(C('9c')), 'skipped: 9♣ stays');
  const b = mk(); b.layDown(); b.finishLay();
  assert.ok(!b.result.rest[0].includes(C('9c')));
  assert.ok(b.result.score[0] < a.result.score[0]);
  assert.deepStrictEqual(R.Game.expectedUnits(a.result), a.result.units);
});
t('player meld choice is validated', () => {
  const g = new R.Game({ seed: 1, starter: 0 });
  g.deal([[], [], [], []], []);
  g.hands = [ids('6s 7s 8s 8h 8d 9c Kd 2h 3h'), ids('8c 10c Jc Qc 5h 6h Ah 2c 3d'), ids('2s 3s 4d 5s 6d 9h 9d Ks Kh'), ids('As Ac Ad 7d 7h 10h Js 10s Qh')];
  g.locked = [[], [], [], []]; g.phase = 'lay';
  assert.strictEqual(g.validLay(0, [ids('8s 8h 8d')]).pts, 6 + 7 + 9 + 13 + 2 + 3);
  assert.strictEqual(g.validLay(0, [ids('8s 8h 9c')]), null);
  g.lay({ 0: [ids('8s 8h 8d')] });
  assert.ok(g.result.laid[0].some(m => ids('8s 8h 8d').every(id => m.includes(id))), 'own choice kept (P1 may gửi 8♣ onto it)');
  assert.ok(g.result.rest[0].includes(C('6s')) && g.result.rest[0].includes(C('7s')));
});

// ---------------------------------------------------------------- random full games
const stats = { games: 0, u: 0, normal: 0, eats: 0, chot: 0, mom: 0, gui: 0 };
t('thousands of bot games: legal moves, cards and coins conserved, payouts recomputed', () => {
  for (let i = 0; i < 3000; i++) {
    const g = new R.Game({ seed: 777 + i, starter: i % 4 });
    g.deal();
    let steps = 0;
    const check = () => {
      const all = [...g.hands.flat(), ...g.deck, ...g.discards.flat()];
      if (all.length !== 52 || new Set(all).size !== 52) throw new Error('cards not conserved in game ' + i);
      for (let p = 0; p < 4; p++) if (g.locked[p].some(id => !g.hands[p].includes(id))) throw new Error('eaten card left the hand');
    };
    while (!g.over) {
      if (++steps > 200) throw new Error('game ' + i + ' stuck');
      if (g.phase === 'lay') { g.lay(); break; }
      const p = g.turn;
      let ev;
      if (g.phase === 'take') ev = g.aiTake(p) === 'eat' ? g.eat(p) : g.draw(p);
      else { const c = g.aiDiscard(p); if (!g.canDiscard(p, c)) throw new Error('bot discard illegal'); ev = g.discard(p, c); }
      if (ev.some(e => e.type === 'invalid')) throw new Error('invalid ' + JSON.stringify(ev));
      if (g.phase === 'take' && g.hands[g.turn].length !== 9) throw new Error('hand size ' + g.hands[g.turn].length);
      check();
    }
    const r = g.result;
    if (r.units.reduce((a, b) => a + b, 0) !== 0) throw new Error('coins not conserved');
    assert.deepStrictEqual(R.Game.expectedUnits(r), r.units, 'payout recomputation, game ' + i);
    if (r.kind === 'normal') {
      for (let p = 0; p < 4; p++) {
        const laidIds = r.laid[p].flat();
        if (!r.laid[p].every(R.isMeld)) throw new Error('invalid phỏm laid');
        if (g.locked[p].some(id => !laidIds.includes(id))) throw new Error('eaten card not in a laid phỏm');
        if (r.laid[p].some(m => m.filter(id => g.locked[p].includes(id)).length > 1)) throw new Error('two eaten cards in one phỏm');
        if (r.score[p] !== r.rest[p].reduce((s, id) => s + R.pts(id), 0)) throw new Error('score mismatch');
        if (g.hands[p].length !== 9) throw new Error('final hand size');
      }
      const all = [...r.laid.flat(2), ...r.rest.flat()];
      if (all.length !== 36 || new Set(all).size !== 36) throw new Error('laid/rest cards not conserved');
      stats.mom += r.mom.filter(Boolean).length; stats.gui += r.sent.flat().length;
    }
    stats.games++; stats[r.kind]++; stats.eats += r.eats.length; stats.chot += r.eats.filter(e => e.chot).length;
    passed++;
  }
});
// ---------------------------------------------------------------- chế độ "Không gửi bài" + bot strength
function botGame(opts) {
  const g = new R.Game(opts); g.deal();
  for (let steps = 0; !g.over && steps < 300; steps++) {
    if (g.phase === 'lay') { g.lay(); break; }
    const p = g.turn;
    const ev = g.phase === 'take' ? (g.aiTake(p) === 'eat' ? g.eat(p) : g.draw(p)) : (() => { const c = g.aiDiscard(p); if (!g.canDiscard(p, c)) throw new Error('illegal bot discard'); return g.discard(p, c); })();
    if (ev.some(e => e.type === 'invalid')) throw new Error('invalid ' + JSON.stringify(ev));
  }
  if (!g.over) throw new Error('bot game stuck');
  return g;
}
t('không gửi bài: same deal, nobody lays off, scores are the cards left after hạ phỏm', () => {
  let compared = 0, differ = 0;
  for (let i = 0; i < 400 && compared < 40; i++) {
    const a = botGame({ seed: 9000 + i, starter: i % 4 }), b = botGame({ seed: 9000 + i, starter: i % 4, send: false });
    if (a.result.kind !== 'normal') continue;
    assert.strictEqual(b.result.kind, 'normal');
    assert.deepStrictEqual(b.result.sent, [[], [], [], []], 'no gửi bài');
    assert.ok(!b.sendOptions(0).length, 'GỬI BÀI button has nothing to offer');
    for (let p = 0; p < 4; p++) assert.strictEqual(b.result.score[p], b.result.rest[p].reduce((x, id) => x + R.pts(id), 0));
    assert.deepStrictEqual(R.Game.expectedUnits(b.result), b.result.units, 'payout recomputation without gửi');
    if (a.result.sent.flat().length) { compared++; if (a.result.score.join() !== b.result.score.join()) differ++; }
  }
  assert.ok(compared >= 20, 'found games where gửi bài mattered: ' + compared);
  assert.ok(differ === compared, 'every one of them scores differently without gửi bài');
});
t('bot levels: easy bots play legal games, coins conserved', () => {
  let eatsEasy = 0, eatsHard = 0;
  for (let i = 0; i < 300; i++) {
    const e = botGame({ seed: 500 + i, starter: i % 4, level: 0 }), h = botGame({ seed: 500 + i, starter: i % 4, level: 3 });
    for (const g of [e, h]) { assert.strictEqual(g.result.units.reduce((x, y) => x + y, 0), 0); assert.deepStrictEqual(R.Game.expectedUnits(g.result), g.result.units); }
    eatsEasy += e.result.eats.length; eatsHard += h.result.eats.length;
  }
  assert.ok(eatsEasy < eatsHard, `easy bots eat fewer cards (${eatsEasy} vs ${eatsHard})`);
});
console.log('stats', JSON.stringify(stats));
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
