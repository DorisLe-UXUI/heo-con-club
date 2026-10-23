'use strict';
// node tests/sam-loc.test.js — Sâm Lốc rules, payouts and thousands of bot-vs-bot games.
const assert = require('assert');
const R = require('../js/games3d/rules/sam-loc.js');
let passed = 0, failed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n ', e.message); } }
const RI = r => R.RANKS.indexOf(r);
// "3s 3h 4" → ids (suit letter optional: s c d h). Pass a shared Set to deal distinct cards to several hands.
function ids(str, used = new Set()) {
  return str.trim().split(/\s+/).map(tok => {
    const m = tok.match(/^(10|[2-9JQKA])([scdh]?)$/); if (!m) throw new Error('bad card ' + tok);
    const r = RI(m[1]); let s = m[2] ? 'scdh'.indexOf(m[2]) : 0;
    if (!m[2]) while (used.has(r * 4 + s)) s++;
    const id = r * 4 + s; if (s > 3 || used.has(id)) throw new Error('dup ' + tok); used.add(id); return id;
  });
}
const A = s => R.analyze(ids(s));

// ---------------------------------------------------------------- combo detection
t('single', () => { const c = A('7'); assert.strictEqual(c.type, 'single'); assert.strictEqual(c.rank, RI('7')); });
t('pair', () => assert.strictEqual(A('9 9').type, 'pair'));
t('triple', () => assert.strictEqual(A('K K K').type, 'triple'));
t('tứ quý', () => assert.strictEqual(A('5 5 5 5').type, 'quad'));
t('straight 3', () => { const c = A('3 4 5'); assert.strictEqual(c.type, 'straight'); assert.strictEqual(c.n, 3); assert.strictEqual(c.rank, RI('5')); });
t('straight Q-K-A allowed', () => assert.strictEqual(A('Q K A').type, 'straight'));
t('straight 10 cards', () => assert.strictEqual(A('3 4 5 6 7 8 9 10 J Q').n, 10));
t('K-A-2 not a straight', () => assert.strictEqual(A('K A 2'), null));
t('A-2-3 not a straight', () => assert.strictEqual(A('A 2 3'), null));
t('2-3-4 not a straight', () => assert.strictEqual(A('2 3 4'), null));
t('gap not a straight', () => assert.strictEqual(A('3 4 6'), null));
t('two-card run is not a combo', () => assert.strictEqual(A('3 4'), null));
t('pair + single is not a combo', () => assert.strictEqual(A('3 3 4'), null));
t('duplicate id rejected', () => assert.strictEqual(R.analyze([5, 5]), null));
t('describe', () => { assert.strictEqual(R.describe(A('2')), 'Heo'); assert.strictEqual(R.describe(A('4 5 6 7')), 'Sảnh 4'); assert.strictEqual(R.describe(A('8 8 8 8')), 'Tứ quý 8'); });

// ---------------------------------------------------------------- beating
const beats = (a, b) => R.canBeat(A(a), A(b)).ok;
t('higher single beats', () => assert.ok(beats('9', '8')));
t('2 beats A', () => assert.ok(beats('2', 'A')));
t('same rank never beats (suits do not matter)', () => assert.ok(!beats('9h', '9s')));
t('lower single cannot beat', () => assert.ok(!beats('4', '5')));
t('higher pair beats pair', () => assert.ok(beats('J J', '10 10')));
t('pair cannot beat single', () => assert.ok(!beats('J J', '10')));
t('triple over triple', () => assert.ok(beats('4 4 4', '3 3 3')));
t('straight same length higher top', () => assert.ok(beats('4 5 6', '3 4 5')));
t('straight different length refused', () => { const r = R.canBeat(A('4 5 6 7'), A('3 4 5')); assert.ok(!r.ok); assert.strictEqual(r.reason, 'Phải cùng số lá'); });
t('Q-K-A is the top straight of 3', () => assert.ok(beats('Q K A', 'J Q K')));
t('tứ quý chặt heo', () => { const r = R.canBeat(A('6 6 6 6'), A('2')); assert.ok(r.ok && r.cut); });
t('tứ quý cannot beat đôi heo', () => assert.ok(!beats('6 6 6 6', '2 2')));
t('tứ quý cannot beat a single A', () => assert.ok(!beats('6 6 6 6', 'A')));
t('higher tứ quý beats lower', () => assert.ok(beats('7 7 7 7', '6 6 6 6')));
t('lead anything valid', () => assert.ok(R.canBeat(A('3 4 5 6'), null).ok));

// ---------------------------------------------------------------- tới trắng
t('tứ quý heo', () => assert.strictEqual(R.instantWin(ids('2 2 2 2 3 5 7 9 J K')).kind, 'tu_quy_heo'));
t('5 đôi', () => assert.strictEqual(R.instantWin(ids('3 3 5 5 7 7 9 9 K K')).kind, '5_doi'));
t('5 đôi with a tứ quý', () => assert.strictEqual(R.instantWin(ids('3 3 3 3 7 7 9 9 K K')).kind, '5_doi'));
t('3 sám', () => assert.strictEqual(R.instantWin(ids('4 4 4 8 8 8 J J J 2')).kind, '3_sam'));
t('sảnh rồng 10', () => assert.strictEqual(R.instantWin(ids('5 6 7 8 9 10 J Q K A')).kind, 'sanh_rong'));
t('no instant', () => assert.strictEqual(R.instantWin(ids('3 4 5 6 7 9 9 J Q 2')), null));
t('4 pairs + 2 singles is not 5 đôi', () => assert.strictEqual(R.instantWin(ids('3 3 5 5 7 7 9 9 K A')), null));

// ---------------------------------------------------------------- scripted games & payouts
function scripted(hands, starter) { const used = new Set(); const g = new R.Game({ seed: 1, starter }); g.deal(hands.map(h => ids(h, used))); return g; }
const pick = (g, p, str) => { const out = []; for (const r of str.split(' ').map(RI)) { const id = g.hands[p].find(x => R.rankOf(x) === r && !out.includes(x)); if (id == null) throw new Error('no ' + str); out.push(id); } return out; };
const noBao = g => { while (g.phase === 'bao') g.declare(g.baoTurn, false); };
t('normal end payouts: cóng 15, thối heo 5', () => {
  const g = scripted(['3 4 5 6 7 8 9 10 Q Q', '3 4 5 6 7 9 9 J K A', '3 3 6 8 8 10 J K A 2', '4 4 6 7 9 J K A 2 2'], 0); noBao(g);
  assert.strictEqual(g.turn, 0);
  const ev = g.play(0, pick(g, 0, '3 4 5 6 7 8 9 10'));
  assert.ok(!ev.some(e => e.type === 'invalid'), JSON.stringify(ev));
  g.pass(1); g.pass(2); g.pass(3);
  assert.strictEqual(g.turn, 0); assert.strictEqual(g.current, null, 'round resets after three passes');
  g.play(0, pick(g, 0, 'Q Q'));
  assert.ok(g.over); const r = g.result;
  assert.strictEqual(r.kind, 'normal'); assert.strictEqual(r.winner, 0);
  assert.deepStrictEqual(r.units, [60, -15, -20, -25]);   // P1 cóng; P2 cóng + 1 heo; P3 cóng + 2 heo
  assert.deepStrictEqual(R.Game.expectedUnits(r), r.units);
});
t('cards-left payment when the loser has played', () => {
  const g = scripted(['3 4 5 9 9 J J K K A', '6 7 8 10 10 Q Q 2 5 4', '3 3 6 8 8 10 J K A 2', '4 6 7 9 J K A 2 2 5'], 0); noBao(g);
  g.play(0, pick(g, 0, '3 4 5'));
  g.play(1, pick(g, 1, '6 7 8'));
  g.pass(2); g.pass(3); g.pass(0);
  assert.strictEqual(g.turn, 1);
  for (const s of ['4', '10 10', 'Q Q', '5']) { g.play(1, pick(g, 1, s)); g.pass(2); g.pass(3); g.pass(0); }
  g.play(1, pick(g, 1, '2'));
  assert.ok(g.over);
  assert.deepStrictEqual(g.result.units, [-7, 52, -20, -25]);   // P0 has 7 cards left
});
t('pass locks the player out of the round', () => {
  const g = scripted(['3 5 7 9 J K A 2 4 6', '4 6 8 10 Q A 2 3 5 7', '3 5 7 9 J K A 2 4 6', '8 9 10 J Q K 4 6 8 10'], 0); noBao(g);
  g.play(0, pick(g, 0, '3')); g.pass(1); g.play(2, pick(g, 2, '5')); g.play(3, pick(g, 3, '8'));
  assert.strictEqual(g.turn, 0);
  g.play(0, pick(g, 0, '9'));
  assert.strictEqual(g.turn, 2, 'P1 passed, so P2 is next');
  assert.strictEqual(g.play(1, pick(g, 1, 'A'))[0].type, 'invalid');
});
t('tứ quý chặt heo in a game', () => {
  const g = scripted(['2 3 4 5 7 8 9 10 J Q', '6 6 6 6 3 4 5 K K Q', '3 4 5 7 8 9 10 Q K A', '3 7 8 9 10 J Q K A 2'], 0); noBao(g);
  g.play(0, pick(g, 0, '2'));
  const pl = g.play(1, pick(g, 1, '6 6 6 6')).find(e => e.type === 'play');
  assert.ok(pl && pl.cut && pl.cut.victim === 0);
});
t('báo sâm success: +20 from each', () => {
  const g = scripted(['2 2 2 Q K A 10 J Q K', '3 4 5 6 7 8 9 10 J 3', '3 4 5 6 7 8 9 10 J 4', '3 4 5 6 7 8 9 9 5 K'], 0);
  assert.strictEqual(g.phase, 'bao'); assert.strictEqual(g.baoTurn, 0);
  g.declare(0, true);
  assert.strictEqual(g.sam, 0); assert.strictEqual(g.turn, 0);
  g.play(0, pick(g, 0, '10 J Q K A')); g.pass(1); g.pass(2); g.pass(3);
  assert.strictEqual(g.play(0, pick(g, 0, 'Q K'))[0].type, 'invalid');
  g.play(0, pick(g, 0, '2 2 2')); g.pass(1); g.pass(2); g.pass(3);
  g.play(0, pick(g, 0, 'Q')); g.pass(1); g.pass(2); g.pass(3);
  g.play(0, pick(g, 0, 'K'));
  assert.ok(g.over); assert.strictEqual(g.result.kind, 'sam'); assert.deepStrictEqual(g.result.units, [60, -20, -20, -20]);
});
t('báo sâm blocked: declarer pays 20 to each, game stops', () => {
  const g = scripted(['3 4 5 6 7 8 9 10 J 2', 'K K A A 2 2 3 4 5 6', '3 4 5 6 7 8 9 10 Q Q', 'K K A A 2 7 8 9 10 J'], 1);
  g.declare(1, false); g.declare(2, true);
  assert.strictEqual(g.turn, 2);
  g.play(2, pick(g, 2, '3'));
  const ev = g.play(3, pick(g, 3, '7'));
  assert.ok(g.over); assert.strictEqual(g.result.kind, 'sam_fail'); assert.deepStrictEqual(g.result.units, [20, 20, -60, 20]);
  assert.ok(ev.some(e => e.type === 'game_over'));
});
t('tới trắng at the deal pays 20 each, first in turn order wins', () => {
  const g = scripted(['3 4 5 6 7 8 9 10 J Q', '2 2 2 2 3 4 5 6 7 8', '3 4 5 6 7 8 9 10 J Q', 'K K A A 9 J Q K A 10'], 0);
  assert.ok(g.over); assert.strictEqual(g.result.kind, 'instant'); assert.strictEqual(g.result.winner, 0);
  assert.deepStrictEqual(g.result.units, [60, -20, -20, -20]);
  const g2 = scripted(['3 4 5 6 7 8 9 10 J Q', '2 2 2 2 3 4 5 6 7 8', '3 4 5 6 7 8 9 10 J Q', 'K K A A 9 J Q K A 10'], 1);
  assert.strictEqual(g2.result.winner, 1);
});
t('first game: lowest card leads', () => { const g = new R.Game({ seed: 7 }); g.deal(); const lo = Math.min(...g.dealt); assert.ok(g.hands[g.starter].includes(lo)); });
t('invalid plays are refused', () => {
  const g = scripted(['3 4 5 6 7 8 9 10 Q Q', '3 4 5 6 7 9 9 J K A', '3 3 6 8 8 10 J K A 2', '4 4 6 7 9 J K A 2 2'], 0); noBao(g);
  assert.strictEqual(g.play(1, [g.hands[1][0]])[0].type, 'invalid', 'not your turn');
  assert.strictEqual(g.play(0, pick(g, 0, '3 4 6'))[0].type, 'invalid', 'not a combo');
  assert.strictEqual(g.pass(0)[0].type, 'invalid', 'leader cannot pass');
  assert.strictEqual(g.play(0, [g.hands[1][0]])[0].type, 'invalid', 'card not in hand');
});

// ---------------------------------------------------------------- bot planning
t('plan keeps a straight together', () => { const p = R.plan(R.counts(ids('3 4 5 6 7 9 9 K K 2'))); assert.ok(p.groups.some(g => g.type === 'straight' && g.n === 5)); assert.strictEqual(p.groups.length, 4); });
t('beatable: single 2 only by a tứ quý', () => { const c = new Array(13).fill(1); assert.ok(!R.beatable(c, { type: 'single', rank: R.HEO, n: 1 })); c[3] = 4; assert.ok(R.beatable(c, { type: 'single', rank: R.HEO, n: 1 })); });
t('beatable: Q-K-A never', () => assert.ok(!R.beatable(new Array(13).fill(4), { type: 'straight', rank: R.ACE, n: 3 })));
t('sâm chance ordering', () => {
  const g = scripted(['10 J Q K A 2 2 2 A A', '3 4 5 6 7 8 9 10 J 3', '3 4 5 6 7 8 9 10 J 4', '3 4 5 6 7 8 9 Q Q 5'], 0);
  const strong = g.samChance(0, 200);
  const g2 = scripted(['3 5 7 9 J K 4 6 8 10', 'A A 2 2 Q Q K K 3 4', 'A 2 Q K 5 6 7 8 9 10', '3 4 5 6 7 8 9 10 J J'], 0);
  const weak = g2.samChance(0, 200);
  assert.ok(strong > .9, 'strong ' + strong); assert.ok(weak < .05, 'weak ' + weak);
});

// ---------------------------------------------------------------- random full games
const stats = { games: 0, normal: 0, sam: 0, sam_fail: 0, instant: 0, cut: 0, turns: 0, cong: 0 };
t('thousands of bot games finish with valid moves, conserved cards and coins', () => {
  for (let i = 0; i < 4000; i++) {
    const g = new R.Game({ seed: 1000 + i, starter: i % 5 === 0 ? null : i % 4 });
    let ev = g.deal(), steps = 0;
    while (!g.over) {
      if (++steps > 600) throw new Error('game ' + i + ' did not finish');
      if (g.phase === 'bao') { const p = g.baoTurn; ev = g.declare(p, g.aiBao(p)); }
      else {
        const p = g.turn, m = g.aiMove(p);
        if (m.action === 'play') {
          const chk = g.check(p, m.cards); if (!chk.ok) throw new Error('bot made an illegal play: ' + chk.reason + ' ' + m.cards.map(R.label).join(' '));
          ev = g.play(p, m.cards);
        } else { if (!g.current) throw new Error('bot passed while leading'); ev = g.pass(p); }
        if (ev.some(e => e.type === 'invalid')) throw new Error('invalid event ' + JSON.stringify(ev));
        if (ev.some(e => e.type === 'play' && e.cut)) stats.cut++;
      }
      // cards conserved: hands + played == dealt, no duplicates
      const all = [...g.hands.flat(), ...g.gone];
      if (all.length !== 40 || new Set(all).size !== 40 || !all.every(id => g.dealt.includes(id))) throw new Error('cards not conserved in game ' + i);
    }
    const r = g.result;
    if (r.units.reduce((a, b) => a + b, 0) !== 0) throw new Error('coins not conserved');
    if (r.transfers.reduce((s, x) => s + x.units, 0) !== r.units.filter(u => u > 0).reduce((a, b) => a + b, 0)) throw new Error('transfers mismatch');
    assert.deepStrictEqual(R.Game.expectedUnits(r), r.units, 'payout recomputation, game ' + i);
    if (r.kind === 'normal' && g.hands[r.winner].length !== 0) throw new Error('winner still has cards');
    stats.games++; stats[r.kind]++; stats.turns += steps; stats.cong += r.played.filter(x => x === 0).length;
    passed++;
  }
});
// ---------------------------------------------------------------- chế độ Solo (2 người đối mặt) + bot strength
function botGame(opts) {
  const g = new R.Game(opts); g.deal();
  for (let steps = 0; !g.over; steps++) {
    if (steps > 600) throw new Error('solo game did not finish');
    if (g.phase === 'bao') { const p = g.baoTurn; g.declare(p, g.aiBao(p)); continue; }
    const p = g.turn, m = g.aiMove(p);
    if (!g.present(p)) throw new Error('an empty seat got the turn');
    if (m.action === 'play') { const chk = g.check(p, m.cards); if (!chk.ok) throw new Error('illegal bot play ' + chk.reason); g.play(p, m.cards); }
    else { if (!g.current) throw new Error('passed while leading'); g.pass(p); }
  }
  return g;
}
t('solo: two seats face to face, 10 cards each, the other 32 out of play', () => {
  const g = new R.Game({ seed: 4, seats: [0, 2] }); g.deal();
  assert.deepStrictEqual(g.hands.map(h => h.length), [10, 0, 10, 0]);
  assert.strictEqual(new Set(g.dealt).size, 20);
  assert.ok([0, 2].includes(g.starter), 'the holder of the lowest dealt card leads');
  if (g.phase === 'bao') assert.deepStrictEqual(g.baoOrder.slice().sort(), [0, 2], 'only the two players are asked to báo sâm');
});
t('solo: scripted round — after one pass the round goes straight back to the leader', () => {
  const g = new R.Game({ seed: 1, starter: 0, seats: [0, 2] });
  g.deal([ids('3s 4c 5d 9s 9c Js Kc Kd Ah 7h'), [], ids('6s 7c 8d Qh Kh As 2h 10c 10d 4h'), []]);
  if (g.phase === 'bao') { g.declare(0, false); g.declare(2, false); }
  assert.strictEqual(g.turn, 0);
  g.play(0, ids('3s 4c 5d'));
  assert.strictEqual(g.turn, 2, 'turn skips the empty seats 1 and 3');
  g.play(2, ids('6s 7c 8d'));
  assert.strictEqual(g.turn, 0);
  const ev = g.pass(0);
  assert.ok(ev.some(e => e.type === 'round_end' && e.winner === 2), 'round won by seat 2');
  assert.strictEqual(g.turn, 2);
});
t('solo: 1500 bot games, coins conserved, the loser pays 1 per card (+5 per heo, cóng 15)', () => {
  let kinds = {};
  for (let i = 0; i < 1500; i++) {
    const g = botGame({ seed: 50000 + i, seats: [0, 2], starter: i % 3 === 0 ? null : [0, 2][i % 2] }), r = g.result;
    assert.deepStrictEqual([r.units[1], r.units[3]], [0, 0], 'empty seats never pay');
    assert.strictEqual(r.units[0] + r.units[2], 0);
    assert.deepStrictEqual(R.Game.expectedUnits(r), r.units, 'payout recomputation, solo game ' + i);
    if (r.kind === 'normal') { const loser = r.winner === 0 ? 2 : 0, left = r.left[loser], heo = left.filter(id => R.rankOf(id) === R.HEO).length; assert.strictEqual(-r.units[loser], (r.played[loser] ? left.length : 15) + 5 * heo); }
    kinds[r.kind] = (kinds[r.kind] || 0) + 1;
  }
  assert.ok(kinds.normal > 1300, JSON.stringify(kinds));
});
t('bot levels: easy and hard bots finish legal games; hard bots beat easy bots', () => {
  let hardWins = 0, games = 0;
  for (let i = 0; i < 600; i++) {
    const g = new R.Game({ seed: 70000 + i, seats: [0, 2], level: 0 }); g.deal();
    const lv = { 0: 0, 2: 3 };   // seat 0 easy, seat 2 hard (level is per game, so drive the moves by hand)
    for (let steps = 0; !g.over && steps < 600; steps++) {
      if (g.phase === 'bao') { const p = g.baoTurn; g.declare(p, g.aiBao(p)); continue; }
      const p = g.turn; g.level = lv[p]; const m = g.aiMove(p);
      if (m.action === 'play') { assert.ok(g.check(p, m.cards).ok); g.play(p, m.cards); } else g.pass(p);
    }
    assert.ok(g.over); games++; if (g.result.winner === 2) hardWins++;
  }
  assert.ok(hardWins / games > .5, `hard bots win ${hardWins} of ${games}`);
});
console.log('stats', JSON.stringify(stats), 'avg steps', (stats.turns / stats.games).toFixed(1));
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
