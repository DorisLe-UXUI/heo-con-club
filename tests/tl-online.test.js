'use strict';
/* node tests/tl-online.test.js — js/tl-online.js: Tiến Lên with friends (lockstep log, turned views, host duties). */
const assert = require('assert');
const TL = require('../js/tienlen-engine.js');
const N = require('../js/tl-online.js');
let passed = 0, failed = 0;
const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('log entries survive the trip through Firestore', () => {
  for (const [seat, a, cards] of [[0, 'p', [0]], [3, 'p', [4, 5, 6, 7]], [2, 'x', []]]) {
    const s = N.encode(seat, a, cards); assert.strictEqual(typeof s, 'string');
    assert.deepStrictEqual(N.decode(s), { seat, a, cards });
  }
  for (const bad of ['', '4p:1', '1p', '1q', '1p:a', null, '0x:1,2,3junk']) assert.strictEqual(N.decode(bad), null, bad);
});

t('seat turning is a bijection', () => {
  for (let me = 0; me < 4; me++) for (let g = 0; g < 4; g++) assert.strictEqual(N.toGlobal(N.toLocal(g, me), me), g);
  assert.strictEqual(N.toLocal(2, 2), 0); assert.strictEqual(N.toLocal(1, 2), 3); assert.strictEqual(N.toLocal(3, 2), 1);
});

// every player replays the same log on their own turned copy; all copies must agree with the table at every step
function playMatch(seed, opts, games = 3) {
  let st = null, winner = null;
  for (let gi = 0; gi < games; gi++) {
    const seats = [{ seat: 0, uid: 'a' }, { seat: 2, uid: 'b' }];
    let k = 0; st = N.nextState(st, seats, opts, winner, s => ({ name: 'bot' + s, ai: 1 }), () => ((seed * 7919 + gi * 104729 + (k++) * 31) % 1000) / 1000);
    const table = N.makeGame(TL, st, 0), views = [0, 1, 2, 3].map(me => N.makeGame(TL, st, me));
    const over = ev => { const o = ev.find(e => e.type === 'game_over'); return o || null; };
    let end = over(table.ev);
    views.forEach((v, me) => { const o = over(v.ev); assert.strictEqual(!!o, !!end, 'instant win seen by everyone'); if (o) assert.strictEqual(N.toGlobal(o.winner, me), end.winner); });
    for (let step = 0; !table.G.over && step < 400; step++) {
      const seat = table.G.turn;
      views.forEach((v, me) => assert.strictEqual(N.toGlobal(v.G.turn, me), seat, 'same turn'));
      const e = N.autoMove(table.G, seat, step % 3 ? 1 : null);
      assert.ok(N.valid(table.G, e), 'auto move is valid');
      const line = N.encode(e.seat, e.a, e.cards), d = N.decode(line);
      const evT = N.applyEntry(table.G, d, 0);
      views.forEach((v, me) => {
        const ev = N.applyEntry(v.G, d, me);
        assert.ok(!ev.some(x => x.type === 'invalid'), 'view accepts the move');
        for (let p = 0; p < 4; p++) assert.deepStrictEqual(v.G.hands[p], table.G.hands[N.toGlobal(p, me)]);
        const o = over(ev); if (o) { const ro = over(evT); assert.strictEqual(N.toGlobal(o.winner, me), ro.winner);
          const mine = o.results.map(r => [N.toGlobal(r.p, me), r.units, r.rank]).sort((a, b) => a[0] - b[0]);
          const ref = ro.results.map(r => [r.p, r.units, r.rank]).sort((a, b) => a[0] - b[0]);
          assert.deepStrictEqual(mine, ref, 'same results for everyone'); }
      });
      end = over(evT) || end;
    }
    assert.ok(table.G.over, 'game finished');
    winner = end.winner; st.log = [];
  }
  return st;
}
t('turned copies stay in step (Miền Nam, xếp hạng)', () => { for (let s = 1; s <= 60; s++) playMatch(s, { rules: 'nam', scoring: 'rank' }); });
t('turned copies stay in step (other modes)', () => {
  for (let s = 1; s <= 25; s++) { playMatch(s, { rules: 'bac', scoring: 'rank' }, 2); playMatch(s, { rules: 'nam', scoring: 'count' }, 2); playMatch(s, { rules: 'nam', scoring: 'all', mustPlay3s: false }, 2); }
});

t('the table refuses moves out of turn, passes when leading and bad cards', () => {
  const st = N.nextState(null, [{ seat: 0, uid: 'a' }], {}, null, () => ({ ai: 1 }), () => .5);
  const { G } = N.makeGame(TL, st, 0); if (G.over) return;
  const seat = G.turn, other = (seat + 1) % 4;
  assert.ok(!N.valid(G, { seat: other, a: 'p', cards: [G.hands[other][0]] }), 'not your turn');
  assert.ok(!N.valid(G, { seat, a: 'x', cards: [] }), 'leader cannot pass');
  assert.ok(!N.valid(G, { seat, a: 'p', cards: [G.hands[other][0]] }), 'card not in hand');
  assert.ok(N.valid(G, N.autoMove(G, seat)), 'auto move ok');
  assert.ok(!N.valid(G, null));
});

t('next deal: humans keep seats, bots fill and stay, winner starts', () => {
  let n = 0; const mk = s => ({ name: 'B' + s + '_' + (n++), ai: 2 });
  const a = N.nextState(null, [{ seat: 0, uid: 'x' }, { seat: 1, uid: 'y' }], { rules: 'nam' }, null, mk, () => .25);
  assert.strictEqual(a.no, 1); assert.strictEqual(a.first, true); assert.strictEqual(a.starter, null);
  assert.deepStrictEqual(a.humans, { 0: 'x', 1: 'y' }); assert.deepStrictEqual(Object.keys(a.bots), ['2', '3']);
  const b = N.nextState(a, [{ seat: 0, uid: 'x' }], { rules: 'nam' }, 3, mk, () => .5);
  assert.strictEqual(b.no, 2); assert.strictEqual(b.first, false); assert.strictEqual(b.starter, 3);
  assert.strictEqual(b.bots[2].name, a.bots[2].name, 'same bot keeps its seat'); assert.ok(b.bots[1], 'left seat gets a bot');
  assert.deepStrictEqual(b.log, []);
  const c = N.nextState(b, [{ seat: 0, uid: 'x' }, { seat: 1, uid: 'z' }], { rules: 'nam' }, 0, mk);
  assert.ok(!c.bots[1] && c.humans[1] === 'z', 'a newcomer replaces the bot');
});

// ---------------------------------------------------------------- the browser controller against an in-memory backend
function server() {
  const rooms = {}, moves = {}, roomL = {}, moveL = {};
  const clone = v => JSON.parse(JSON.stringify(v));
  const fire = code => setTimeout(() => (roomL[code] || []).forEach(f => f(rooms[code] ? clone(rooms[code]) : null)), 1);
  return { rooms, client(uid, name) {
    const me = { uid, name };
    return {
      user: () => me,
      async createRoom(game, o) { const code = String(100000 + Object.keys(rooms).length); rooms[code] = { game, host: uid, open: true, max: 4, stake: o.stake, mode: o.mode, seats: [{ uid, name, av: '', fr: 'pink', coins: 1e6, seat: 0 }], state: null, updated: Date.now() }; fire(code); return code; },
      async joinRoom(code) { const r = rooms[code]; if (!r || !r.open) throw new Error('no room'); if (!r.seats.some(s => s.uid === uid)) { const used = new Set(r.seats.map(s => s.seat)); let s = 0; while (used.has(s)) s++; r.seats.push({ uid, name, av: '', fr: 'mint', coins: 5e5, seat: s }); } fire(code); return clone(r); },
      async leaveRoom(code) { const r = rooms[code]; if (!r) return; r.seats = r.seats.filter(s => s.uid !== uid); if (r.host === uid && r.seats[0]) r.host = r.seats[0].uid; r.hb = Date.now(); fire(code); },
      async claimHost(code, seen) { const r = rooms[code]; if ((r.hb || r.updated) !== seen) return false; r.host = uid; r.hb = Date.now() + 1; fire(code); return true; },
      watchRoom(code, cb) { (roomL[code] = roomL[code] || []).push(cb); setTimeout(() => cb(rooms[code] ? clone(rooms[code]) : null), 1); return () => { roomL[code] = roomL[code].filter(f => f !== cb); }; },
      async setRoom(code, patch) { if (rooms[code].host !== uid && Object.keys(patch).some(k => !['seats', 'updated', 'open', 'host', 'hb'].includes(k))) throw new Error('permission-denied ' + uid); Object.assign(rooms[code], clone(patch), { updated: Date.now() }); fire(code); },
      async sendMove(code, move) { const m = { by: uid, t: Date.now(), move: clone(move) }; (moves[code] = moves[code] || []).push(m); setTimeout(() => (moveL[code] || []).forEach(f => f(clone(m))), 1); },
      watchMoves(code, cb) { (moveL[code] = moveL[code] || []).push(cb); return () => { moveL[code] = moveL[code].filter(f => f !== cb); }; },
    };
  } };
}
function seatPlayer(srv, uid, name, opts = {}) {
  const P = { uid, games: 0, over: [], moves: 0, G: null, results: [] };
  const act = () => { if (!P.G || P.G.over || P.G.turn !== 0 || opts.silent) return; setTimeout(() => { if (P.G.over || P.G.turn !== 0) return; const e = N.autoMove(P.G, 0, 1); P.net.send(e.a, e.cards); }, 2); };
  P.net = N.controller({ TL, online: srv.client(uid, name), think: [0, 1], patience: 40, hooks: {
    onGame(st, G, ev, players) { P.G = G; P.games++; P.players = players; const o = ev.find(e => e.type === 'game_over'); if (o) P.results.push(o); act(); },
    onMove(p, a, cards, ev) { P.moves++; const o = ev.find(e => e.type === 'game_over'); if (o) P.results.push(o); act(); return new Promise(r => setTimeout(r, 1)); },
    onRoom(r, info) { P.info = info; },
    onClosed(m) { P.closed = m; },
    makeBot: s => ({ name: 'Máy ' + s, av: '', fr: 'sky', coins: 3e5, ai: 1 }),
  } });
  return P;
}
const until = (f, ms = 8000) => new Promise((res, rej) => { const t0 = Date.now(); const k = () => { if (f()) return res(); if (Date.now() - t0 > ms) return rej(new Error('timeout')); setTimeout(k, 5); }; k(); });

t('two friends and two bots finish games together', async () => {
  const srv = server(), A = seatPlayer(srv, 'ua', 'An'), B = seatPlayer(srv, 'ub', 'Bình');
  const code = await A.net.create({ tier: 1, mode: 'nam' });
  await B.net.join(code);
  await until(() => A.net.room && A.net.room.seats.length === 2 && B.net.seat === 1);
  assert.ok(A.net.isHost && !B.net.isHost);
  assert.strictEqual(await B.net.deal({ rules: 'nam' }), false, 'only the host deals');
  await A.net.deal({ rules: 'nam', scoring: 'rank', mustPlay3s: true });
  for (let g = 1; g <= 3; g++) {
    await until(() => A.results.length >= g && B.results.length >= g, 15000);
    const ra = A.results[g - 1], rb = B.results[g - 1];
    const norm = (o, me) => o.results.map(r => [N.toGlobal(r.p, me), r.units]).sort((x, y) => x[0] - y[0]);
    assert.deepStrictEqual(norm(ra, 0), norm(rb, 1), 'both screens show the same result');
    assert.strictEqual(A.players[0].name, 'An'); assert.strictEqual(A.players[1].name, 'Bình'); assert.ok(A.players[2].bot && A.players[3].bot);
    assert.strictEqual(B.players[0].name, 'Bình'); assert.strictEqual(B.players[3].name, 'An');
    if (g < 3) await A.net.deal();
  }
  assert.ok(srv.rooms[code].state.log.length > 10);
  assert.strictEqual(srv.rooms[code].state.no, 3);
  await B.net.leave(); await A.net.leave();
  assert.strictEqual(srv.rooms[code].seats.length, 0);
});

t('the host plays for a friend who stops answering, and a bad move is ignored', async () => {
  const srv = server(), A = seatPlayer(srv, 'ua', 'An'), B = seatPlayer(srv, 'ub', 'Bình', { silent: true });
  const code = await A.net.create({ tier: 0 }); await B.net.join(code);
  await until(() => A.net.room && A.net.room.seats.length === 2);
  await A.net.deal({ rules: 'nam' });
  await until(() => B.G);
  await srv.client('ub', 'Bình').sendMove(code, { no: 1, i: 99, e: '1p:0' });         // stale index → ignored
  await until(() => A.results.length >= 1 && B.results.length >= 1, 15000);
  const log = srv.rooms[code].state.log;
  assert.ok(log.some(l => l.startsWith('1')) || A.results[0].instant, 'seat 1 was played by the host');
  await A.net.leave(); await B.net.leave();
});

t('if the host leaves, the friend takes over and the game goes on', async () => {
  const srv = server(), A = seatPlayer(srv, 'ua', 'An'), B = seatPlayer(srv, 'ub', 'Bình');
  const code = await A.net.create({ tier: 0 }); await B.net.join(code);
  await until(() => A.net.room && A.net.room.seats.length === 2);
  await A.net.deal({ rules: 'nam' });
  await until(() => B.moves >= 3 || B.results.length);
  await A.net.leave();
  await until(() => B.net.isHost);
  await until(() => B.results.length >= 1, 15000);
  assert.ok(B.net.isHost);
  await B.net.deal();
  await until(() => B.results.length >= 2, 15000);
  await B.net.leave();
});

(async () => {
  for (const [name, fn] of tests) { try { await fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n ', e && e.stack || e); } }
  console.log(`tl-online: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
