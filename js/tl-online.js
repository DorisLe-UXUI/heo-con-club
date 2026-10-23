/*
 * Tiến Lên with friends: one table shared through a Firestore room (js/hc-online.js), bots in the empty seats.
 *
 * Lockstep: every player runs the same js/tienlen-engine.js game. The host publishes the deal (a seed) and an ordered move
 * log in rooms/{code}.state; each player replays the log on a copy of the game turned so that they sit at seat 0, which
 * is what tien-len.html draws. Players send their own moves to rooms/{code}/moves; only the host checks them and appends
 * them to the log, so everyone applies the same moves in the same order. The host also plays the bots and anyone who
 * left or stopped answering. If the host disappears, the next player takes over (each player keeps the unturned game too).
 *
 *   state = { no, seed, first, starter, opts: {rules, scoring, mustPlay3s}, humans: {seat: uid}, bots: {seat: {...}}, log: ['2p:4,5', '3x', ...] }
 *
 * Seats in the room and in the log are table seats 0..3; the page only sees local seats (0 = me).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.TLNet = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const N = 4;
  const toLocal = (g, me) => (g - me + N) % N;
  const toGlobal = (p, me) => (p + me) % N;
  /** A log entry as a string (Firestore has no nested arrays): '2p:4,5,6' plays, '3x' passes. */
  const encode = (seat, a, cards) => seat + a + (a === 'p' ? ':' + cards.join(',') : '');
  function decode(s) { const m = /^([0-3])([px])(?::([\d,]+))?$/.exec(s || ''); return m && (m[2] === 'x' || m[3]) ? { seat: +m[1], a: m[2], cards: m[3] ? m[3].split(',').map(Number) : [] } : null; }

  /** The four hands of a deal, by table seat. */
  function dealHands(TL, seed) { const g = new TL.Game({ seed }); g.deal(); return g.hands.map(h => [...h]); }
  /** The game of state `st` seen from table seat `me` (me = 0 gives the table's own view). Returns { G, ev } like G.deal(). */
  function makeGame(TL, st, me) {
    const hands = dealHands(TL, st.seed), o = st.opts || {};
    const G = new TL.Game({ seed: st.seed, firstGame: !!st.first, starter: st.starter == null ? null : toLocal(st.starter, me), mustPlay3s: o.mustPlay3s !== false, rules: o.rules, scoring: o.scoring });
    const ev = G.deal([0, 1, 2, 3].map(p => hands[toGlobal(p, me)]));
    return { G, ev };
  }
  /** Apply one decoded entry to a game seen from seat `me`; returns the engine events. */
  function applyEntry(G, e, me) { const p = toLocal(e.seat, me); return e.a === 'p' ? G.play(p, e.cards) : G.pass(p); }
  /** Would the table accept this move now? `eng` is the table's own view (me = 0). */
  function valid(eng, e) {
    if (!e || eng.over || e.seat !== eng.turn) return false;
    return e.a === 'x' ? !!eng.current : eng.check(e.seat, e.cards).ok;
  }
  /** The move played for a bot, or for a player who ran out of time / left. */
  function autoMove(eng, seat, level) {
    if (level == null) { if (eng.current) return { seat, a: 'x', cards: [] }; const o = eng.options(seat); return { seat, a: 'p', cards: o[0].combo.cards }; }
    const m = eng.aiMove(seat, level);
    return m.action === 'play' ? { seat, a: 'p', cards: m.cards } : { seat, a: 'x', cards: [] };
  }
  /** The state for the next deal. `prev` is the finished state (or null), `seats` the room seats, `winner` a table seat. */
  function nextState(prev, seats, opts, winner, makeBot, rand = Math.random) {
    const humans = {}, bots = {};
    seats.forEach(s => { if (s.seat < N) humans[s.seat] = s.uid; });
    for (let k = 0; k < N; k++) if (humans[k] == null) bots[k] = prev && prev.bots && prev.bots[k] ? prev.bots[k] : makeBot(k);
    return { no: (prev ? prev.no : 0) + 1, seed: Math.floor(rand() * 2 ** 31), first: !prev, starter: prev && winner != null ? winner : null, opts, humans, bots, log: [] };
  }

  const core = { N, toLocal, toGlobal, encode, decode, dealHands, makeGame, applyEntry, valid, autoMove, nextState };

  /**
   * Browser side. hooks (all optional except onGame / onMove):
   *   onRoom(room, info)         every room change; info = { host, playing, waiting (a deal I am not in is still being played) }
   *   onGame(st, G, ev, players) a new deal; G is turned so that I sit at 0; players[localSeat] = { name, av, fr, coins, bot, uid }
   *   onMove(p, a, cards, ev)    a move from the log, local seat; return a promise that settles when it has been drawn
   *   onClosed(msg)              the room is gone
   *   makeBot(seat)              profile of a bot for an empty seat { name, av, fr, coins, ai }
   *   hidden()                   true while the page cannot animate (default: document.hidden); bots then move without waiting for it
   */
  function controller({ TL, online, hooks, think = [650, 1250], patience = 28000 }) {
    const H = hooks, ev0 = typeof addEventListener === 'function';
    const hidden = H.hidden || (() => typeof document !== 'undefined' && document.hidden);   // a hidden host tab must not hold up the table
    let code = null, room = null, st = null, eng = null, G = null, done = 0, mine = -1, host = false, me = null, winner = null;
    let unRoom = null, unMoves = null, hbT = null, watchT = null, botT = null, slowT = null, lastSeen = 0, chain = Promise.resolve(), busy = 0;
    const humanAt = seat => st && st.humans && st.humans[seat] != null && room && room.seats.some(s => s.uid === st.humans[seat] && s.seat === seat) ? st.humans[seat] : null;
    function players() {
      const seats = room ? room.seats : [];
      return [0, 1, 2, 3].map(p => { const g = toGlobal(p, mine), uid = st && st.humans[g], s = seats.find(x => x.uid === uid);
        if (uid != null) return { uid, name: s ? s.name : 'Bạn chơi', av: s ? s.av : '', fr: s && s.fr || 'pink', coins: s && s.coins || 0, bot: false, seat: g };
        return Object.assign({ bot: true, seat: g }, st && st.bots[g] || {}); });
    }
    function queue(fn) { busy++; chain = chain.then(fn).catch(e => console.warn('tl-online', e)).then(() => { busy--; if (!busy) hostTick(); }); }

    async function attach(c) {
      code = String(c); me = online.user(); lastSeen = Date.now();
      unRoom = online.watchRoom(code, onRoom);
      watchT = setInterval(checkHost, 5000);
      if (ev0) addEventListener('pagehide', bye);
      return code;
    }
    function bye() { if (code) online.leaveRoom(code); }
    function onRoom(r) {
      lastSeen = Date.now();
      if (!r) { const c = code; stop(); if (H.onClosed && c) H.onClosed('Phòng đã đóng.'); return; }
      room = r;
      const seat = r.seats.find(s => s.uid === me.uid);
      if (!seat) { stop(); if (H.onClosed) H.onClosed('Bạn đã rời phòng.'); return; }
      mine = seat.seat;
      const wasHost = host; host = r.host === me.uid;
      if (host && !wasHost) becomeHost();
      if (!host && wasHost) dropHost();
      const s = r.state;
      if (!s || !s.humans || s.humans[mine] !== me.uid) { st = null; eng = null; if (H.onRoom) H.onRoom(r, { waiting: !!(s && s.log && !isOver(s)), host, playing: false }); return; }
      if (!st || s.no !== st.no) {                     // new deal
        st = Object.assign({}, s, { log: [] }); done = 0;
        const t = makeGame(TL, st, 0); eng = t.G; winner = overOf(t.ev);
        const view = makeGame(TL, st, mine); G = view.G;
        const ps = players(), g0 = G, ev = view.ev;
        queue(() => H.onGame(st, g0, ev, ps));
      }
      st.humans = s.humans; st.bots = s.bots;
      const log = s.log || [];
      for (; done < log.length; done++) {
        const e = decode(log[done]); if (!e) continue;
        if (!valid(eng, e)) { console.warn('tl-online: bad entry', log[done]); continue; }
        const w = overOf(applyEntry(eng, e, 0)); if (w != null) winner = w; st.log.push(log[done]);
        const gv = G, p = toLocal(e.seat, mine);
        queue(() => H.onMove(p, e.a, e.cards, applyEntry(gv, e, mine)));   // the page's copy moves only when it is drawn
      }
      if (H.onRoom) H.onRoom(r, { waiting: false, host, playing: true });
      hostTick();
    }
    const overOf = ev => { const o = ev.find(x => x.type === 'game_over'); return o ? o.winner : null; };
    const isOver = s => { try { const g = makeGame(TL, s, 0).G; for (const x of s.log) { const e = decode(x); if (!valid(g, e)) return true; applyEntry(g, e, 0); } return g.over; } catch (e) { return true; } };

    // ---------------------------------------------------------------- host duties
    function becomeHost() {
      unMoves = online.watchMoves(code, onMoveDoc);
      hbT = setInterval(() => online.setRoom(code, { hb: Date.now() }).catch(() => {}), 15000);
    }
    function dropHost() { if (unMoves) unMoves(); unMoves = null; clearInterval(hbT); clearTimeout(botT); clearTimeout(slowT); }
    function append(e) {
      if (!host || !valid(eng, e)) return false;
      const log = st.log.concat([encode(e.seat, e.a, e.cards)]);
      clearTimeout(botT); clearTimeout(slowT); botT = slowT = null;
      online.setRoom(code, { state: Object.assign({}, st, { log }), hb: Date.now() }).catch(err => console.warn('tl-online append', err));
      return true;
    }
    function onMoveDoc(m) {
      if (!host || !st || !m.move) return;
      const s = room.seats.find(x => x.uid === m.by); const e = decode(m.move.e);
      if (!s || !e || e.seat !== s.seat || m.move.no !== st.no || m.move.i !== st.log.length) return;
      append(e);
    }
    function hostTick() {
      if (!host || !eng || eng.over || (busy && !hidden())) return;
      const seat = eng.turn, uid = humanAt(seat), n = st.log.length;
      if (uid === me.uid) return;                                       // my own turn: the page acts
      if (uid) { if (!slowT) slowT = setTimeout(() => { slowT = null; if (st.log.length === n && eng.turn === seat) append(autoMove(eng, seat)); }, patience); return; }
      if (botT) return;
      const b = st.bots[seat];
      botT = setTimeout(() => { botT = null; if (st.log.length === n && !eng.over && eng.turn === seat) append(autoMove(eng, seat, b ? (b.ai != null ? b.ai : 1) : 1)); }, think[0] + Math.random() * (think[1] - think[0]));
    }
    async function checkHost() {
      if (!room || host || Date.now() - lastSeen < 45000) return;
      lastSeen = Date.now();
      try { await online.claimHost(code, room.hb || room.updated); } catch (e) {}
    }

    // ---------------------------------------------------------------- what the page calls
    function stop() {
      if (unRoom) unRoom(); unRoom = null; dropHost(); clearInterval(watchT);
      if (ev0) removeEventListener('pagehide', bye);
      code = null; room = null; st = null; eng = null; G = null; done = 0; host = false; chain = Promise.resolve(); busy = 0;
    }
    return {
      core,
      get code() { return code; }, get room() { return room; }, get state() { return st; }, get seat() { return mine; },
      get isHost() { return host; }, get active() { return !!code; }, get playing() { return !!(st && eng && !eng.over); },
      get pending() { return busy; }, get table() { return eng; },
      players,
      async create(o) { const c = await online.createRoom('tien-len', { max: 4, stake: o.tier, mode: o.mode || '' }); return attach(c); },
      async join(c) { await online.joinRoom(String(c).trim()); return attach(c); },
      /** Host: deal the first or the next game. */
      deal(opts) {
        if (!host || !room) return Promise.resolve(false);
        const prev = st && eng && eng.over ? st : null;
        const ns = nextState(prev, room.seats, opts || (st && st.opts) || {}, prev ? winner : null, H.makeBot || (() => ({ name: 'Bot', ai: 1 })));
        return online.setRoom(code, { state: ns, open: true, hb: Date.now() }).then(() => true);
      },
      /** My move: checked by the host, then everyone (me too) draws it from the log. */
      send(a, cards) {
        if (!st || !eng) return false;
        const e = { seat: mine, a, cards: cards || [] };
        if (!valid(eng, e)) return false;
        if (host) return append(e);
        online.sendMove(code, { no: st.no, i: st.log.length, e: encode(e.seat, e.a, e.cards) }).catch(err => console.warn('tl-online send', err));
        return true;
      },
      async leave() { const c = code; stop(); if (c) await online.leaveRoom(c); },
    };
  }
  return Object.assign({ controller }, core);
});
