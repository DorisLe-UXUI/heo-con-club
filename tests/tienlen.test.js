// Run: node tests/tienlen.test.js
'use strict';
const TL = require('../js/tienlen-engine.js');
const { analyze, canBeat, instantWin, thoiOf, Game } = TL;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  ✗ ' + msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); }

// card helper: c('3♠'), c('10♥'), c('2♦')
const SUIT = { '♠': 0, '♣': 1, '♦': 2, '♥': 3, s: 0, c: 1, d: 2, h: 3 };
function c(str) { const s = str.slice(-1), r = str.slice(0, -1); return TL.RANKS.indexOf(r) * 4 + SUIT[s]; }
const cs = str => str.split(' ').map(c);
const A = str => analyze(cs(str));

console.log('— combos');
eq(A('3♠').type, 'single', 'single');
eq(A('5♦ 5♥').type, 'pair', 'pair');
eq(A('5♦ 6♥'), null, 'two different ranks is not a pair');
eq(A('9♠ 9♣ 9♥').type, 'triple', 'triple');
eq(A('J♠ J♣ J♦ J♥').type, 'quad', 'quad');
eq(A('3♠ 4♣ 5♦').type, 'straight', 'straight 3');
eq(A('10♠ J♣ Q♦ K♥ A♠').len, 5, 'straight 10-A');
eq(A('Q♠ K♣ A♦').type, 'straight', 'Q-K-A ok');
eq(A('K♠ A♣ 2♦'), null, 'K-A-2 is not a straight');
eq(A('A♠ 2♣ 3♦'), null, 'A-2-3 is not a straight');
eq(A('3♠ 4♣'), null, 'two-card run is not a straight');
eq(A('3♠ 3♣ 4♦ 4♥ 5♠ 5♣').type, 'pairseq', '3 đôi thông');
eq(A('3♠ 3♣ 4♦ 4♥ 5♠ 5♣ 6♦ 6♥').len, 4, '4 đôi thông');
eq(A('Q♠ Q♣ K♦ K♥ 2♠ 2♣'), null, 'no 2 in đôi thông');
eq(A('3♠ 3♣ 4♦ 4♥'), null, '2 pairs is not đôi thông');
eq(A('3♠ 3♣ 3♦ 4♥ 5♠ 5♣'), null, 'mixed shape invalid');

console.log('— beating');
const beats = (a, b) => canBeat(A(a), A(b));
ok(beats('5♥', '5♦').ok, '5♥ beats 5♦ (suit order)');
ok(!beats('5♣', '5♦').ok, '5♣ does not beat 5♦');
ok(beats('6♠', '5♥').ok, 'higher rank beats');
ok(beats('2♠', 'A♥').ok, 'heo beats ace');
ok(beats('7♠ 7♥', '7♣ 7♦').ok, 'pair with ♥ beats pair with ♦');
ok(!beats('7♠ 7♦', '7♣ 7♥').ok, 'pair compare by highest card');
ok(beats('4♠ 5♠ 6♥', '4♣ 5♣ 6♦').ok, 'straight same len higher top');
ok(!beats('4♠ 5♠ 6♥ 7♠', '4♣ 5♣ 6♦').ok, 'straight must be same length');
ok(!beats('9♠ 9♣ 9♦', '8♠ 8♣').ok, 'different type cannot beat');
let r = beats('3♠ 3♣ 4♦ 4♥ 5♠ 5♣', '2♠'); ok(r.ok && r.cut, '3 đôi thông chặt 1 heo');
r = beats('6♠ 6♣ 6♦ 6♥', '2♥'); ok(r.ok && r.cut, 'tứ quý chặt 1 heo');
ok(!beats('3♠ 3♣ 4♦ 4♥ 5♠ 5♣', '2♠ 2♥').ok, '3 đôi thông KHÔNG chặt đôi heo');
r = beats('6♠ 6♣ 6♦ 6♥', '2♠ 2♥'); ok(r.ok && r.cut, 'tứ quý chặt đôi heo');
r = beats('3♠ 3♣ 4♦ 4♥ 5♠ 5♣ 6♦ 6♥', '2♠ 2♥'); ok(r.ok && r.cut, '4 đôi thông chặt đôi heo');
r = beats('6♠ 6♣ 6♦ 6♥', '3♠ 3♣ 4♦ 4♥ 5♠ 5♣'); ok(r.ok && r.cut, 'tứ quý chặt 3 đôi thông');
r = beats('4♠ 4♣ 5♦ 5♥ 6♠ 6♣', '3♠ 3♣ 4♦ 4♥ 5♠ 5♣'); ok(r.ok && r.cut, '3 đôi thông lớn chặt 3 đôi thông nhỏ');
r = beats('3♠ 3♣ 4♦ 4♥ 5♠ 5♣ 6♦ 6♥', '9♠ 9♣ 9♦ 9♥'); ok(r.ok && r.cut, '4 đôi thông chặt tứ quý');
ok(!beats('3♠ 3♣ 4♦ 4♥ 5♠ 5♣', '9♠ 9♣ 9♦ 9♥').ok, '3 đôi thông KHÔNG chặt tứ quý');
r = beats('10♠ 10♣ 10♦ 10♥', '9♠ 9♣ 9♦ 9♥'); ok(r.ok && r.cut, 'tứ quý lớn chặt tứ quý nhỏ');
ok(!beats('6♠ 6♣ 6♦ 6♥', 'A♥').ok, 'bomb cannot cut a normal single');
eq(TL.cutUnits(A('2♠')), 1, 'heo đen = 1');
eq(TL.cutUnits(A('2♥')), 2, 'heo đỏ = 2');
eq(TL.cutUnits(A('2♣ 2♦')), 3, 'đôi heo đen+đỏ = 3');

console.log('— tới trắng & thối');
eq(instantWin(cs('2♠ 2♣ 2♦ 2♥ 3♠ 4♣ 5♦ 7♥ 8♠ 9♣ 10♦ J♥ Q♠'), false).kind, 'tu_quy_heo', 'tứ quý heo');
eq(instantWin(cs('3♠ 4♣ 5♦ 6♥ 7♠ 8♣ 9♦ 10♥ J♠ Q♣ K♦ A♥ 3♥'), false).kind, 'sanh_rong', 'sảnh rồng');
eq(instantWin(cs('5♠ 5♣ 6♦ 6♥ 7♠ 7♣ 8♦ 8♥ 9♠ 9♣ J♦ K♥ 2♠'), false).kind, '5_doi_thong', '5 đôi thông');
eq(instantWin(cs('3♠ 3♣ 5♦ 5♥ 7♠ 7♣ 9♦ 9♥ J♠ J♣ K♦ K♥ 2♠'), false).kind, '6_doi', '6 đôi');
eq(instantWin(cs('3♠ 4♣ 5♠ 6♣ 7♠ 9♣ 10♠ J♣ Q♠ K♣ A♠ 2♣ 3♣'), false).kind, 'dong_mau', 'đồng màu đen');
eq(instantWin(cs('3♠ 3♣ 3♦ 3♥ 5♠ 7♥ 9♦ J♥ K♠ A♥ 2♦ 6♦ 8♥'), true).kind, 'tu_quy_3', 'tứ quý 3 ván đầu');
eq(instantWin(cs('3♠ 3♣ 3♦ 3♥ 5♠ 7♥ 9♦ J♥ K♠ A♥ 2♦ 6♦ 8♥'), false), null, 'tứ quý 3 không tính ván sau');
eq(instantWin(cs('3♠ 4♥ 6♦ 7♣ 9♠ 10♥ J♦ Q♣ K♠ 5♦ 8♥ 2♣ 3♦'), false), null, 'bài thường không tới trắng');
eq(thoiOf(cs('2♠ 2♥ 5♦')).units, 3, 'thối 2 heo = 3');
eq(thoiOf(cs('8♠ 8♣ 8♦ 8♥ 4♦')).units, 4, 'thối tứ quý = 4');

console.log('— scripted game flow');
// Build 4 hands: given cards per player, filled up to 13 from the rest of the deck (seeded),
// re-rolled until nobody has a tới-trắng hand.
function mk(spec, opts = {}) {
  const fixed = spec.map(x => (x ? cs(x) : []));
  const used = new Set(fixed.flat());
  for (let seed = 1; seed < 500; seed++) {
    const rest = TL.shuffled(TL.mulberry32(seed)).filter(id => !used.has(id));
    const hands = fixed.map(h => [...h]);
    for (const h of hands) while (h.length < 13) h.push(rest.pop());
    if (hands.some(h => instantWin(h, opts.firstGame !== false))) continue;
    if (!hands[0].includes(0) && opts.firstGame !== false) continue;
    const g = new Game({ seed: 1, ...opts });
    const ev = g.deal(hands);
    return { g, ev, hands };
  }
  throw new Error('could not build hands');
}
const types = list => list.map(e => e.type);
{
  const { g } = mk(['3♠ 4♣ 5♦ 9♠ 9♣', '6♠ 7♣ 8♦', '', '']);
  eq(g.turn, 0, '3♠ holder starts');
  eq(g.play(0, cs('9♠ 9♣'))[0].reason, 'Ván đầu phải đánh kèm 3♠', 'must include 3♠ on first play');
  ok(g.play(0, cs('3♠ 4♣ 5♦')).some(e => e.type === 'play'), 'p0 plays straight with 3♠');
  eq(g.turn, 1, 'turn passes to p1');
  eq(g.play(1, [cs('8♦')[0]])[0].type, 'invalid', 'single cannot answer a straight');
  ok(g.play(1, cs('6♠ 7♣ 8♦')).some(e => e.type === 'play'), 'p1 beats with higher straight');
  g.pass(2); g.pass(3);
  eq(g.turn, 0, 'p0 still in the round');
  const e = g.pass(0);
  ok(e.some(x => x.type === 'round_end' && x.winner === 1), 'round won by p1');
  eq(g.turn, 1, 'p1 leads next round');
  eq(g.pass(1)[0].type, 'invalid', 'leader cannot pass');
  eq(g.play(2, cs(g.hands[2].length ? TL.label(g.hands[2][0]) : '3♣'))[0].reason, 'Chưa tới lượt', 'cannot play out of turn');
}
{
  // chặt heo: p1 heo đen, p2 cuts with 3 đôi thông -> p1 pays 1 at round end
  const { g } = mk(['3♠', '2♠', '4♠ 4♥ 5♠ 5♣ 6♣ 6♦', '']);
  g.play(0, cs('3♠')); g.play(1, cs('2♠'));
  const e1 = g.play(2, cs('4♠ 4♥ 5♠ 5♣ 6♣ 6♦'));
  ok(e1.some(x => x.type === 'play' && x.cut && x.cut.victim === 1 && x.cut.units === 1), 'p2 chặt heo của p1');
  ok(!g.transfers.length, 'payment waits until the round ends');
  g.pass(3); g.pass(0); g.pass(1);
  const tr = g.transfers.find(t => t.why === 'chat');
  ok(tr && tr.from === 1 && tr.to === 2 && tr.units === 1, 'payment settled at round end: p1 -> p2 1 unit');
  eq(g.turn, 2, 'cutter leads next round');
}
{
  // chặt chồng: heo đỏ cut by 3 đôi thông, then by tứ quý -> p2 pays 2 + 3 = 5 to p3
  const { g } = mk(['3♠', '2♥', '4♠ 4♥ 5♠ 5♣ 6♣ 6♦', 'K♠ K♣ K♦ K♥']);
  g.play(0, cs('3♠')); g.play(1, cs('2♥'));
  g.play(2, cs('4♠ 4♥ 5♠ 5♣ 6♣ 6♦'));
  const e = g.play(3, cs('K♠ K♣ K♦ K♥'));
  const p = e.find(x => x.type === 'play');
  ok(p && p.cut && p.cut.stacked && p.cut.victim === 2 && p.cut.units === 5, 'chặt chồng: p2 owes heo đỏ 2 + 3 đôi thông 3 = 5');
  g.pass(0); g.pass(1); g.pass(2);
  const tr = g.transfers.find(t => t.why === 'chat_chong');
  ok(tr && tr.from === 2 && tr.to === 3 && tr.units === 5, 'chặt chồng settled p2 -> p3 5 units');
  ok(!g.transfers.some(t => t.from === 1), 'original heo owner pays nothing after chặt chồng');
}
{
  // đôi heo cannot be cut by 3 đôi thông but can by 4 đôi thông
  const { g } = mk(['3♠ 3♣', '2♠ 2♦', '4♠ 4♥ 5♠ 5♣ 6♣ 6♦', '7♠ 7♣ 8♦ 8♥ 9♠ 9♣ 10♦ 10♥']);
  g.play(0, cs('3♠ 3♣')); g.play(1, cs('2♠ 2♦'));
  eq(g.play(2, cs('4♠ 4♥ 5♠ 5♣ 6♣ 6♦'))[0].type, 'invalid', '3 đôi thông cannot cut đôi heo');
  g.pass(2);
  const e = g.play(3, cs('7♠ 7♣ 8♦ 8♥ 9♠ 9♣ 10♦ 10♥'));
  ok(e.some(x => x.type === 'play' && x.cut && x.cut.units === 3), '4 đôi thông cuts đôi heo (đen 1 + đỏ 2)');
  eq(g.turn, 0, 'p2 passed so the turn skips to p0');
}
{
  // p0 finishes first, the other three never played -> cóng
  const { g } = mk(['3♠ 4♣ 5♦ 6♥ 7♠ 8♣ 9♦ 10♥ J♠ Q♣ K♦ 2♠ 2♥', '', '', '']);
  g.play(0, cs('3♠ 4♣ 5♦ 6♥ 7♠ 8♣ 9♦ 10♥ J♠ Q♣ K♦'));
  g.pass(1); g.pass(2); g.pass(3);
  eq(g.turn, 0, 'p0 leads again');
  const e = g.play(0, cs('2♠ 2♥'));
  ok(e.some(x => x.type === 'finish' && x.p === 0 && x.rank === 1), 'p0 finishes first');
  eq(e.filter(x => x.type === 'cong').length, 3, 'all three others are cóng');
  const over = e.find(x => x.type === 'game_over');
  ok(over && over.winner === 0, 'game over, p0 nhất');
  eq(over && over.results.reduce((s, r) => s + r.units, 0), 0, 'results zero-sum (cóng)');
  eq(over && over.results.find(r => r.p === 0).units, 3 + 3 * 2 + 0, 'nhất gets rank pay + cóng extras');
}
// mid-game positions built by editing the state directly
function midGame(handStrs, leader = 0, opts = {}) {
  const g = new Game(Object.assign({ seed: 3, firstGame: false }, opts));
  g.deal(); g.drain();
  g.hands = handStrs.map(h => TL.sortIds(cs(h)));
  g.played = [9, 9, 9, 9];
  g.mustInclude3s = false;
  g.out = [0, 1, 2, 3].map(p => !g.present(p));
  g.startRound(leader); g.drain();
  return g;
}
{
  // hưởng sái: p0 finishes, nobody beats -> next player after p0 leads
  const g = midGame(['5♦', '3♣ 9♣', '4♥ 8♥', '6♦ 10♦']);
  const e = g.play(0, cs('5♦'));
  ok(e.some(x => x.type === 'finish' && x.p === 0), 'p0 out');
  g.pass(1); g.pass(2);
  const e2 = g.pass(3);
  ok(e2.some(x => x.type === 'round_end' && x.next === 1), 'hưởng sái: p1 leads after p0 finished');
  eq(g.turn, 1, 'turn is p1');
}
{
  // thối heo at the end
  const g = midGame(['5♦', '3♣', '4♥', '2♠ 2♥ 6♦']);
  g.play(0, cs('5♦')); g.pass(1); g.pass(2); g.pass(3);
  g.play(1, cs('3♣'));
  const e = g.play(2, cs('4♥'));
  const over = e.find(x => x.type === 'game_over');
  ok(e.some(x => x.type === 'thoi' && x.p === 3 && x.units === 3), 'p3 thối 2 heo (đen 1 + đỏ 2)');
  ok(over, 'game over after 3 finished');
  const R = Object.fromEntries(over.results.map(r => [r.p, r]));
  eq([R[0].rank, R[1].rank, R[2].rank, R[3].rank], [1, 2, 3, 4], 'ranks by finishing order');
  eq([R[0].units, R[1].units, R[2].units, R[3].units], [6, 1, -1, -6], 'payouts incl. thối');
}
{
  // leader cannot pass, out-of-turn blocked, wrong length straight blocked
  const g = midGame(['3♠ 4♠ 5♠ 6♠', '7♣ 8♣ 9♣', 'J♥', 'Q♦'], 0);
  eq(g.pass(0)[0].type, 'invalid', 'leader must play');
  g.play(0, cs('3♠ 4♠ 5♠ 6♠'));
  eq(g.play(1, cs('7♣ 8♣ 9♣'))[0].reason, 'Phải cùng số lá', 'straight length must match');
}

console.log('— AI vs AI simulation');
const N = 3000;
let games = 0, cuts = 0, stacked = 0, congs = 0, instant = 0, thoi = 0, maxSteps = 0, invalid = 0, tricks = 0;
for (let s = 1; s <= N; s++) {
  const g = new Game({ seed: s * 7919, firstGame: s % 5 === 1, starter: s % 4 });
  let ev = g.deal();
  let steps = 0, money = [0, 0, 0, 0];
  const handle = list => {
    for (const e of list) {
      if (e.type === 'invalid') invalid++;
      if (e.type === 'play' && e.cut) { cuts++; if (e.cut.stacked) stacked++; }
      if (e.type === 'cong') congs++;
      if (e.type === 'toi_trang') instant++;
      if (e.type === 'thoi') thoi++;
      if (e.type === 'round') tricks++;
      if (e.type === 'pay') { money[e.from] -= e.units; money[e.to] += e.units; }
    }
  };
  handle(ev);
  while (!g.over && steps < 500) {
    const p = g.turn;
    const m = g.aiMove(p, s % 3);
    const out = m.action === 'play' ? g.play(p, m.cards) : g.pass(p);
    if (out[0] && out[0].type === 'invalid') { invalid++; console.log('  invalid AI move', s, p, m, out[0].reason); break; }
    handle(out);
    steps++;
  }
  maxSteps = Math.max(maxSteps, steps);
  ok(g.over, `game ${s} finished`);
  const over = [...(g._lastOver || [])];
  // conservation: every card is in exactly one hand or was played
  const left = g.hands.reduce((a, h) => a + h.length, 0);
  const played = g.played.reduce((a, b) => a + b, 0);
  ok(left + played === 52 || instant, `cards conserved in game ${s}`);
  const tsum = g.transfers.reduce((a, t) => a + 0, 0);
  ok(money.reduce((a, b) => a + b, 0) === 0, `chặt payments zero-sum in game ${s}`);
  games++;
}
console.log(`  ${games} games · avg tricks ${(tricks / games).toFixed(1)} · max steps ${maxSteps} · chặt ${cuts} (chồng ${stacked}) · cóng ${congs} · tới trắng ${instant} · thối ${thoi} · invalid ${invalid}`);
ok(invalid === 0, 'AI never makes an invalid move');

// ================================================================== variants (chế độ chơi)
function aiGame(opts, level = 1) {
  const g = new Game(opts); let ev = g.deal(), steps = 0; const money = [0, 0, 0, 0], seen = { cong: 0, toi: 0, bad: 0, thoi: 0, invalid: 0 };
  const handle = list => { for (const e of list) { if (e.type === 'pay') { money[e.from] -= e.units; money[e.to] += e.units; } if (e.type === 'cong') seen.cong++; if (e.type === 'toi_trang') seen.toi++; if (e.type === 'finish' && e.bad) seen.bad++; if (e.type === 'thoi') seen.thoi++; if (e.type === 'game_over') g._over = e; } };
  handle(ev);
  while (!g.over && steps < 600) {
    const p = g.turn; if (!g.present(p)) throw new Error('empty seat got the turn');
    const m = g.aiMove(p, level), out = m.action === 'play' ? g.play(p, m.cards) : g.pass(p);
    if (out[0] && out[0].type === 'invalid') { seen.invalid++; console.log('  invalid', JSON.stringify(opts), out[0].reason); break; }
    handle(out); steps++;
  }
  return { g, money, seen, over: g._over };
}
console.log('— Miền Bắc');
{
  const N = { north: true };
  eq(analyze(cs('7♦ 7♥'), N).type, 'pair', 'Bắc: đôi đỏ');
  eq(analyze(cs('7♠ 7♥'), N), null, 'Bắc: đôi lệch màu không hợp lệ');
  eq(analyze(cs('5♦ 6♦ 7♦'), N).type, 'straight', 'Bắc: sảnh đồng chất');
  eq(analyze(cs('5♦ 6♥ 7♦'), N), null, 'Bắc: sảnh khác chất không hợp lệ');
  eq(analyze(cs('3♠ 3♣ 4♦ 4♥ 5♠ 5♣'), N), null, 'Bắc: không có đôi thông');
  const B = (a, b) => canBeat(analyze(cs(a), N), analyze(cs(b), N), N);
  ok(B('9♥', '8♥').ok, 'Bắc: 9♥ chặn 8♥ (cùng chất)');
  ok(!B('9♠', '8♥').ok, 'Bắc: 9♠ không chặn được 8♥');
  ok(!B('8♠', '8♥').ok, 'Bắc: nhỏ hơn thì không chặn');
  ok(B('2♠', 'A♥').ok, 'Bắc: heo chặn mọi lá rác');
  ok(B('2♥', '2♠').ok && !B('2♠', '2♥').ok, 'Bắc: heo chặn heo chất nhỏ hơn');
  ok(B('9♦ 9♥', '7♦ 7♥').ok && !B('9♠ 9♣', '7♦ 7♥').ok, 'Bắc: đôi phải cùng màu');
  ok(B('8♠ 8♣ 8♥', '5♠ 5♣ 5♥').ok && !B('8♠ 8♦ 8♥', '5♠ 5♣ 5♥').ok, 'Bắc: sám cô phải cùng bộ chất');
  ok(B('6♣ 7♣ 8♣', '5♣ 6♣ 7♣').ok && !B('6♦ 7♦ 8♦', '5♣ 6♣ 7♣').ok && !B('6♣ 7♣ 8♣ 9♣', '5♣ 6♣ 7♣').ok, 'Bắc: sảnh cùng chất, cùng số lá');
  let r = B('9♠ 9♣ 9♦ 9♥', '2♥'); ok(r.ok && r.cut, 'Bắc: tứ quý chặt 1 heo');
  r = B('9♠ 9♣ 9♦ 9♥', '2♦ 2♥'); ok(r.ok && r.cut, 'Bắc: tứ quý chặt đôi heo');
  r = B('J♠ J♣ J♦ J♥', '9♠ 9♣ 9♦ 9♥'); ok(r.ok && r.cut, 'Bắc: tứ quý lớn chặt tứ quý nhỏ');
  ok(!B('9♠ 9♣ 9♦ 9♥', 'A♥').ok, 'Bắc: tứ quý không chặt lá thường');
  eq(instantWin(cs('2♠ 2♣ 2♦ 2♥ 3♠ 4♣ 5♦ 7♥ 8♠ 9♣ 10♦ J♥ Q♠'), false, N), null, 'Bắc: không có tới trắng');
  eq(thoiOf(cs('3♠ 3♣ 4♦ 4♥ 5♠ 5♣ 2♥'), N).units, 2, 'Bắc: thối chỉ tính heo và tứ quý');
  ok(TL.combosOf(cs('5♦ 6♦ 7♦ 7♥ 8♦'), N).every(c => c.type !== 'straight' || c.cards.every(id => TL.suitOf(id) === 2)), 'Bắc: gợi ý chỉ có sảnh đồng chất');
}
{
  // về bằng heo: allowed but ranked last ("xử thua chót")
  const g = midGame(['2♥', '3♣ 9♣', '4♥ 8♥', '6♦ 10♦'], 0, { rules: 'bac' });
  const v = g.check(0, cs('2♥')); ok(v.ok && v.badFinish, 'Bắc: about to go out with a heo is flagged');
  const e = g.play(0, cs('2♥'));
  ok(e.some(x => x.type === 'finish' && x.p === 0 && x.bad), 'Bắc: p0 out with a heo → bad finish');
  ok(!g.over && g.out[0] && g.finishOrder.length === 0, 'Bắc: the game goes on, nobody is nhất yet');
}
{
  const g = midGame(['2♥', '3♣', '4♥ 8♥', '6♦ 10♦'], 0, { rules: 'bac' });
  g.play(0, cs('2♥')); g.pass(1); g.pass(2); g.pass(3);         // p0 out (bad) — p1 leads (hưởng sái)
  eq(g.turn, 1, 'hưởng sái after a bad finish');
  const e1 = g.play(1, cs('3♣'));                                  // p1 out: nhất
  ok(e1.some(x => x.type === 'finish' && x.p === 1 && x.rank === 1), 'p1 is nhất');
  ok(!e1.some(x => x.type === 'cong'), 'Bắc: no cóng');
}
{
  // full ranking with a bad finisher
  const g = midGame(['2♥', '3♣', '4♥', '6♦ 10♦'], 0, { rules: 'bac' });
  g.play(0, cs('2♥')); g.pass(1); g.pass(2); g.pass(3);
  g.play(1, cs('3♣')); g.pass(2); g.pass(3);
  const e = g.play(2, cs('4♥'));
  const over = e.find(x => x.type === 'game_over');
  ok(over, 'game over when one player is left');
  const R = Object.fromEntries(over.results.map(r => [r.p, r]));
  eq([R[1].rank, R[2].rank, R[3].rank, R[0].rank], [1, 2, 3, 4], 'Bắc: về heo xếp bét, người còn bài xếp trên');
  eq(R[0].units, -3, 'Bắc: về heo trả như bét');
  eq(over.results.reduce((a, r) => a + r.units, 0), 0, 'zero-sum');
}
{
  let n = 0, bad = 0, cong = 0, toi = 0, inv = 0, zero = 0;
  for (let s = 1; s <= 1500; s++) {
    const r = aiGame({ seed: s * 104729, rules: 'bac', firstGame: s % 4 === 1, starter: s % 4 }, s % 3);
    n += r.g.over ? 1 : 0; bad += r.seen.bad; cong += r.seen.cong; toi += r.seen.toi; inv += r.seen.invalid;
    if (r.money.reduce((a, b) => a + b, 0) === 0 && r.over.results.reduce((a, x) => a + x.units, 0) === 0) zero++;
    if (r.g.hands.reduce((a, h) => a + h.length, 0) + r.g.played.reduce((a, b) => a + b, 0) !== 52) throw new Error('Bắc: cards not conserved');
  }
  eq(n, 1500, 'Bắc: 1500 AI games finish'); eq(inv, 0, 'Bắc: AI never plays an illegal move');
  eq(cong + toi, 0, 'Bắc: no cóng, no tới trắng'); eq(zero, 1500, 'Bắc: payouts zero-sum');
  console.log(`  1500 Bắc games · về heo/tứ quý ${bad}`);
}
console.log('— Đếm lá / Nhất ăn tất');
{
  const g = midGame(['5♦', '3♣ 9♣', '4♥ 8♥ 2♥', '6♦ 10♦ J♠ Q♠'], 0, { scoring: 'count' });
  const e = g.play(0, cs('5♦')), over = e.find(x => x.type === 'game_over');
  ok(over && g.over, 'Đếm lá: the game ends when the first player goes out');
  const R = Object.fromEntries(over.results.map(r => [r.p, r]));
  eq([R[1].units, R[2].units, R[3].units], [-2, -3 - 2, -4], 'Đếm lá: 1 per card left, thối heo đỏ +2');
  eq(R[0].units, 11, 'Đếm lá: the winner takes it all');
  eq([R[0].rank, R[1].rank, R[3].rank, R[2].rank], [1, 2, 3, 4], 'Đếm lá: losers ranked by what they pay');
}
{
  const g = midGame(['5♦', '3♣ 9♣', '4♥ 8♥', '6♦ 10♦'], 0, { scoring: 'count' });
  g.played = [9, 0, 9, 9];
  const over = g.play(0, cs('5♦')).find(x => x.type === 'game_over');
  eq(over.results.find(r => r.p === 1).units, -26, 'Đếm lá: cóng pays 26');
}
{
  const g = midGame(['5♦', '3♣ 9♣', '4♥ 8♥ 2♥ 2♦', '6♦ 10♦ J♠ Q♠'], 0, { scoring: 'all' });
  g.played = [9, 9, 0, 9];
  const over = g.play(0, cs('5♦')).find(x => x.type === 'game_over');
  const R = Object.fromEntries(over.results.map(r => [r.p, r]));
  eq([R[0].units, R[1].units, R[2].units, R[3].units], [12, -3, -6, -3], 'Nhất ăn tất: flat 3 each, cóng 6, no thối');
}
{
  for (const scoring of ['count', 'all']) {
    let zero = 0, inv = 0;
    for (let s = 1; s <= 800; s++) {
      const r = aiGame({ seed: s * 7907, scoring, firstGame: s % 5 === 1, starter: s % 4 }, s % 3);
      inv += r.seen.invalid;
      const res = r.over.results;
      if (r.over.instant || (res.filter(x => x.rank === 1).length === 1 && res.reduce((a, x) => a + x.units, 0) === 0 && r.money.reduce((a, b) => a + b, 0) === 0)) zero++;
      if (!r.over.instant && r.g.finishOrder.length !== 1) throw new Error(scoring + ': the game must stop at the first player out');
    }
    eq(zero + inv, 800, `${scoring === 'count' ? 'Đếm lá' : 'Nhất ăn tất'}: 800 AI games, zero-sum, one winner`);
  }
}
console.log('— Solo 2 người');
{
  const g = new Game({ seed: 5, seats: [0, 2], scoring: 'count' }); g.deal();
  eq(g.hands.map(h => h.length), [13, 0, 13, 0], 'Solo: 13 cards each, seats 0 and 2');
  const lo = Math.min(...g.hands.flat());
  ok(g.hands[g.turn].includes(lo) || g.over, 'Solo first game: the lowest dealt card leads');
  let n = 0, zero = 0, inv = 0, toi = 0;
  for (let s = 1; s <= 1500; s++) {
    const r = aiGame({ seed: s * 6271, seats: [0, 2], scoring: 'count', firstGame: s % 6 === 1, starter: [0, 2][s % 2] }, s % 3);
    n += r.g.over ? 1 : 0; inv += r.seen.invalid; toi += r.seen.toi;
    const res = r.over.results;
    if (res.length === 2 && res.every(x => x.p === 0 || x.p === 2) && res.reduce((a, x) => a + x.units, 0) === 0 && r.money[1] === 0 && r.money[3] === 0) zero++;
    if (r.g.hands.reduce((a, h) => a + h.length, 0) + r.g.played.reduce((a, b) => a + b, 0) !== 26) throw new Error('Solo: cards not conserved');
  }
  eq(n, 1500, 'Solo: 1500 AI games finish'); eq(inv, 0, 'Solo: AI never plays an illegal move'); eq(zero, 1500, 'Solo: only the two players pay, zero-sum');
  console.log(`  1500 solo games · tới trắng ${toi}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
