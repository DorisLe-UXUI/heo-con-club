// Coin pusher physics tests (run: node tests/pusher.test.js)
'use strict';
const assert = require('assert');
const { Sim, KINDS } = require('../js/pusher-sim.js');
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
const live = s => s.items.filter(i => i.state === 'field' || i.state === 'shelf' || i.state === 'drop');
const count = (s, k) => live(s).filter(i => i.kind === k).length;
function run(s, sec, every, xFn) { let next = 0, dropped = 0; const ev = []; for (let t = 0; t < sec; t += 1 / 60) { if (every && t >= next) { s.drop(xFn ? xFn(dropped) : 0); dropped++; next += every; } s.step(1 / 60); ev.push(...s.takeEvents()); } return { ev, dropped }; }

// presets: someone-just-played machines have the pile at the edge
const fresh = new Sim({ seed: 1 }); fresh.fill('fresh');
const hot = new Sim({ seed: 1 }); hot.fill('hot');
ok(hot.edgeFill() > fresh.edgeFill() + 0.3, `hot machine is fuller at the edge (${hot.edgeFill().toFixed(2)} vs ${fresh.edgeFill().toFixed(2)})`);

// nothing overlaps much after settling and after a lot of pushing
function maxPen(s) { const f = s.items.filter(i => i.state === 'field'); let m = 0; for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) { const d = Math.hypot(f[a].x - f[b].x, f[a].z - f[b].z); m = Math.max(m, f[a].r + f[b].r - d); } return m; }
ok(maxPen(hot) < 0.12, 'settled pile has no deep overlaps: ' + maxPen(hot).toFixed(3));

// conservation: every coin is either still in the machine, won or lost
{
  const s = new Sim({ seed: 3 }); s.fill('fresh'); const c0 = count(s, 'coin');
  const rnd = require('../js/pusher-sim.js').mulberry32(9);
  const { ev, dropped } = run(s, 400, 0.55, () => (rnd() * 2 - 1) * 4.2);
  for (let i = 0; i < 120; i++) { s.step(1 / 60); ev.push(...s.takeEvents()); }
  const won = ev.filter(e => e.type === 'win' && e.kind === 'coin').length, lost = ev.filter(e => e.type === 'lost' && e.kind === 'coin').length;
  ok(c0 + dropped === won + lost + count(s, 'coin'), `coins conserved (${c0} + ${dropped} = ${won} won + ${lost} lost + ${count(s, 'coin')} left)`);
  const rate = (won) / dropped;
  ok(rate > 0.55 && rate < 1.05, 'long-run coin return between 55% and 105%: ' + (rate * 100).toFixed(1) + '%');
  ok(lost > 0, 'side chutes take some coins: ' + lost);
  ok(maxPen(s) < 0.2, 'no deep overlaps after 400 s of pushing: ' + maxPen(s).toFixed(3));
  ok(s.items.every(i => i.state === 'fall' || i.state === 'gone' || (Math.abs(i.x) <= s.W - i.r + 1e-6 && i.z >= 0)), 'everything stays inside the walls');
}

// timing: a coin dropped with the pusher fully back lands on the floor right in front of it; fully forward → on the shelf
{
  const s = new Sim({ seed: 4 }); s.fill('fresh');
  while (s.phase().k > 0.02) s.step(1 / 120); s.takeEvents();
  s.drop(0); let e; for (let i = 0; i < 40 && !e; i++) { s.step(1 / 60); e = s.takeEvents().find(x => x.type === 'land'); }
  ok(e && !e.shelf, 'drop while retracted → lands on the floor');
  while (s.phase().k < 0.98) s.step(1 / 120); s.takeEvents();
  s.drop(0); e = null; for (let i = 0; i < 40 && !e; i++) { s.step(1 / 60); e = s.takeEvents().find(x => x.type === 'land'); }
  ok(e && e.shelf, 'drop while pushed forward → lands on the shelf');
  run(s, 2 * s.PERIOD); ok(s.items.filter(i => i.state === 'shelf').length <= 12, 'the back wall scrapes shelf coins off');
}

// tip 2 + 3: on a machine left with tickets at the edge, aiming at that side wins them quickly
{
  const s = new Sim({ seed: 5 }); s.fill('hot');
  const { ev } = run(s, 60, 0.6, () => -3.2);
  const left = ev.find(e => e.type === 'win' && e.kind === 'ticket' && e.x < 0);
  ok(!!left, 'aiming left on the "hot" machine pushes the left ticket roll off within 100 coins');
  const f = new Sim({ seed: 5 }); f.fill('fresh');
  const r2 = run(f, 60, 0.6, () => -3.2);
  ok(r2.ev.filter(e => e.type === 'win' && e.kind !== 'coin').length < ev.filter(e => e.type === 'win' && e.kind !== 'coin').length, 'the empty machine pays fewer prizes for the same coins');
}

// save / load keeps the machine as it was
{
  const s = new Sim({ seed: 6 }); s.fill('rich'); run(s, 20, 0.5, () => 0);
  const snap = s.save(); const t = new Sim({ seed: 6 }); t.load(JSON.parse(JSON.stringify(snap)));
  ok(live(t).length === snap.items.length && count(t, 'pig') === count(s, 'pig'), 'save → load keeps every item');
  ok(Math.abs(t.edgeFill() - s.edgeFill()) < 0.15, 'edge fill survives a reload');
}

// determinism
{
  const a = new Sim({ seed: 11 }); a.fill('hot'); const b = new Sim({ seed: 11 }); b.fill('hot');
  const ra = run(a, 30, 0.7, i => (i % 5) - 2), rb = run(b, 30, 0.7, i => (i % 5) - 2);
  ok(JSON.stringify(a.save()) === JSON.stringify(b.save()) && ra.ev.length === rb.ev.length, 'same seed, same drops → same result');
}
ok(Object.values(KINDS).every(k => k.r > 0 && k.m > 0), 'kinds are sane');

// =====================================================================================================================
// Game rules: pocket → slot, jackpot pool, card sets, Fever, walls, longer stroke, economy
// =====================================================================================================================
const { Game, CFG, OUTCOMES, SETS, mulberry32 } = require('../js/pusher-sim.js');
const stepFor = (g, sec, onEv) => { const ev = []; for (let t = 0; t < sec; t += 1 / 30) { const e = g.step(1 / 30); ev.push(...e); if (onEv) e.forEach(onEv); } return ev; };
const untilResult = (g, outcome, max = 20) => { for (let t = 0; t < max; t += 1 / 30) { const r = g.step(1 / 30).find(e => e.type === 'result' && e.outcome === outcome); if (r) return r; } return null; };
const waitPhase = (g, test) => { for (let i = 0; i < 400 && !test(g.sim.phase()); i++) g.step(1 / 60); };

// the pocket ("ô may mắn") only exists on Game machines; a coin dropped straight into the cup becomes a spin
{
  const plain = new Sim({ seed: 1 }); plain.fill('hot');
  const r = run(plain, 120, 0.4, i => Math.sin(i) * 3);
  ok(!r.ev.some(e => e.type === 'pocket'), 'a plain Sim has no pocket (old callers keep every coin)');
  const g = new Game({ bet: 1000, seed: 2, preset: 'fresh' }); g.step(0.1);
  let caught = 0;
  for (let k = 0; k < 6; k++) {
    // drop when the cup will be right under the chute on landing (~0.62 s later)
    let tries = 0;
    while (tries++ < 2000) { const t2 = g.sim.t + 0.62, pz2 = g.sim.pusherZ(t2); if (Math.abs(g.sim.DROP_Z - (pz2 + g.sim.pocket.lz)) < 0.15) break; g.step(1 / 120); }
    const P = g.sim.pocket; g.drop(Math.sin((g.sim.t + 0.62) * 2 * Math.PI / P.period) * P.amp);
    caught += stepFor(g, 1.2).filter(e => e.type === 'pocket').length;
  }
  ok(caught >= 5, `aiming at the cup with the pusher forward catches the coin (${caught}/6)`);
  ok(g.stats.pocket === caught && g.stats.spins + g.stock + (g.spin && !g.spin.done ? 0 : 0) >= caught, 'every caught coin is a spin (played or waiting)');
  const g2 = new Game({ bet: 1000, seed: 3, preset: 'fresh' }); g2.step(0.1); waitPhase(g2, p => p.k < 0.05);
  g2.drop(g2.sim.pocket.x); ok(!stepFor(g2, 1.0).some(e => e.type === 'pocket'), 'with the pusher pulled back the coin lands on the floor, not in the cup');
  // stock is capped and the cup closes while it is full
  const g3 = new Game({ bet: 1000, seed: 4, preset: 'fresh' }); g3.addSpins(50); g3.step(1 / 30);
  ok(g3.stock <= CFG.STOCK_MAX && !g3.sim.pocket.open, `pending spins capped at ${CFG.STOCK_MAX}; the cup closes when full`);
}

// the slot: reels stop left to right, three of a kind = the outcome, reach when the first two match
{
  const g = new Game({ bet: 1000, seed: 5, preset: 'fresh' });
  for (const o of ['jackpot', 'shower', 'tickets', 'card', 'wall', 'push', 'miss']) g.queueSpin(o);
  const spins = [], results = [];
  stepFor(g, 7 * 5, e => { if (e.type === 'spin') spins.push(e); if (e.type === 'result') results.push(e); });
  const order = results.slice(0, 7).map(r => r.outcome).join();   // (rain from the jackpot may land in the cup and add spins after these)
  ok(order === 'jackpot,shower,tickets,card,wall,push,miss', 'queued outcomes play in order: ' + order);
  ok(spins.every(s => s.stops[0] < s.stops[1] && s.stops[1] < s.stops[2]), 'reels stop one after another');
  ok(spins.slice(0, 6).every(s => s.reach && s.reels.every(x => x === OUTCOMES.find(o => o.id === s.outcome).sym)), 'a win shows three matching symbols (and a reach)');
  ok(spins[0].stops[2] - spins[0].stops[1] > 1, '"REACH!": the last reel spins longer when the first two match');
  ok(new Set(spins[6].reels).size > 1, 'a miss never shows three of a kind');
  // random spins: the outcome mix follows OUTCOMES
  const h = new Game({ bet: 1000, seed: 6 }), cnt = {}; let n = 0;
  for (let i = 0; i < 20000; i++) { h.stock = 1; h._startSpin(); cnt[h.spin.outcome] = (cnt[h.spin.outcome] || 0) + 1; n++; h.spin = null; }
  const pWin = OUTCOMES.reduce((s, o) => s + o.p, 0);
  ok(Math.abs((n - cnt.miss) / n - pWin) < 0.012, `win rate per spin ≈ ${(pWin * 100).toFixed(1)}% (measured ${((n - cnt.miss) / n * 100).toFixed(1)}%)`);
}

// outcomes do what they say
{
  const g = new Game({ bet: 5000, seed: 7, preset: 'hot' });
  const pool0 = g.pool; for (let i = 0; i < 200; i++) { g.drop((i % 9) - 4); g.step(0.05); }
  ok(Math.abs(g.pool - (pool0 + 200 * CFG.JP_RATE)) < 1e-6, `every paid coin grows the jackpot pool by ${CFG.JP_RATE} coin`);
  while (g.spin) g.step(1 / 30);   // let a spin from the cup finish first
  const before = g.pool, c0 = g.stats.coins; g.queueSpin('jackpot');
  const jp = untilResult(g, 'jackpot');
  ok(jp && jp.coins === Math.round(before) && g.pool === CFG.JP_SEED && g.stats.coins - c0 >= jp.coins, `the jackpot pays the whole pool (${jp && jp.coins} coins) and restarts at ${CFG.JP_SEED}`);
  ok(jp.free === CFG.JP_RAIN, 'a jackpot also rains free coins onto the field');
  const s = g.save(); const g2 = new Game({ bet: 5000, seed: 8, save: JSON.parse(JSON.stringify(s)) });
  ok(Math.abs(g2.pool - g.pool) < 0.01 && JSON.stringify(g2.cards) === JSON.stringify(g.cards), 'pool and card sets survive save → load');
  // tickets scale with the bet
  g.queueSpin('tickets'); const tkEv = untilResult(g, 'tickets');
  ok(tkEv.tickets === CFG.TICKET_BONUS * 5, 'ticket bonus is scaled by the machine (5K machine: ×5)');
  // shower: free coins come out of the chute
  stepFor(g, 3); g.queueSpin('shower'); untilResult(g, 'shower'); const f0 = g.stats.free; stepFor(g, 3);
  ok(g.stats.free - f0 >= CFG.SHOWER, `"Mưa xu" drops ${CFG.SHOWER} free coins`);
}

// "Tường chắn": while the walls are up nothing is lost into the corner chutes
{
  const run2 = (walls) => {
    const g = new Game({ bet: 1000, seed: 9, preset: 'hot' }); if (walls) g.startWall(40);   // (capped at 40 s)
    let lost = 0, wonN = 0; const rnd = mulberry32(3);
    for (let t = 0; t < 38; t += 1 / 30) { if ((t * 30 | 0) % 15 === 0) g.drop(rnd() < .5 ? -4 : 4); for (const e of g.step(1 / 30)) { if (e.type === 'lost' && e.kind === 'coin') lost++; if (e.type === 'coin') wonN++; } }
    return { lost, won: wonN, g };
  };
  const a = run2(false), b = run2(true);
  ok(a.lost > 5, 'aiming at the corners loses coins into the side chutes: ' + a.lost);
  ok(b.lost === 0 && b.g.sim.walls === 1, 'with "Tường chắn" up, no coin is lost (' + b.won + ' won, 0 lost)');
  ok(b.g.sim.items.every(i => i.state !== 'field' || Math.abs(i.x) <= b.g.sim.W - i.r + 1e-6), 'the guides keep coins inside the field');
}

// "Đẩy mạnh": longer stroke, eased in and out
{
  const g = new Game({ bet: 1000, seed: 10, preset: 'fresh' }); let maxPz = 0;
  for (let t = 0; t < 4; t += 1 / 60) { g.step(1 / 60); maxPz = Math.max(maxPz, g.sim.pz); }
  g.startPush(10); let maxPz2 = 0, jump = 0, prev = g.sim.pz;
  for (let t = 0; t < 8; t += 1 / 60) { g.step(1 / 60); maxPz2 = Math.max(maxPz2, g.sim.pz); jump = Math.max(jump, Math.abs(g.sim.pz - prev)); prev = g.sim.pz; }
  ok(maxPz2 > maxPz + 0.8 * CFG.PUSH_EXTRA, `the pusher reaches further while "Đẩy mạnh" (${maxPz.toFixed(2)} → ${maxPz2.toFixed(2)})`);
  ok(jump < 0.1, 'no sudden jump when the stroke changes');
  stepFor(g, 6); ok(g.pushT === 0 && g.sim.extra < 0.05, 'and goes back to normal afterwards');
}

// card sets
{
  const g = new Game({ bet: 20000, seed: 11 }); const ev = [];
  const add = id => { g.addCard(id, 'slot'); ev.push(...g.out); g.out = []; };
  ['AS', 'AC', 'AD'].forEach(add); ok(!ev.some(e => e.type === 'set') && g.cards.aces.length === 3, 'three aces: not yet');
  add('AH'); const set = ev.find(e => e.type === 'set');
  ok(set && set.set === 'aces' && set.coins === SETS[0].coins && g.cards.aces.length === 0, `four aces complete "Tứ Quý Át" (+${SETS[0].coins} coins) and the row restarts`);
  ok(g.cards.royal.includes('AH'), 'Át Cơ also counts for "Sảnh Cơ"');
  ['10H', 'JH', 'QH'].forEach(add); ev.length = 0; add('QH');
  ok(ev[0].dup && ev[0].tickets === CFG.DUP_TICKETS * 20, 'a duplicate card turns into tickets (scaled by the machine)');
  add('KH'); ok(ev.some(e => e.type === 'set' && e.set === 'royal'), '10-J-Q-K-A of hearts completes "Sảnh Cơ"');
  // the "missing card" bias keeps sets reachable
  const h = new Game({ bet: 1000, seed: 12 }); let draws = 0, sets = 0;
  while (draws < 600) { const id = h.drawCard(); draws++; h.addCard(id, 'slot'); sets += h.out.filter(e => e.type === 'set').length; h.out = []; }
  ok(draws / sets < 9, `about one set per ${(draws / sets).toFixed(1)} cards`);
  // prize cards carry their card through save / load
  const k = new Game({ bet: 1000, seed: 13, preset: 'rich' }); const cards = k.sim.items.filter(i => i.kind === 'card').map(i => i.card).sort().join();
  const k2 = new Game({ bet: 1000, seed: 14, save: JSON.parse(JSON.stringify(k.save())) });
  ok(cards && k2.sim.items.filter(i => i.kind === 'card').map(i => i.card).sort().join() === cards, 'cards on the field keep their face after a reload: ' + cards);
}

// Fever: several wins in a short time → coins pay double for a while
{
  const g = new Game({ bet: 1000, seed: 15, preset: 'hot' }); const ev = [];
  for (let i = 0; i < CFG.LAMPS; i++) { g._lamp(); ev.push(...g.out); g.out = []; }
  ok(ev.some(e => e.type === 'fever' && e.on) && g.feverT === CFG.FEVER_T && g.lamps === 0, `${CFG.LAMPS} lamps start a ${CFG.FEVER_T} s Fever`);
  const coins = [];
  for (let t = 0; t < CFG.FEVER_T - 0.5; t += 1 / 30) { if ((t * 30 | 0) % 9 === 0) g.drop(((t * 7) % 6) - 3); coins.push(...g.step(1 / 30).filter(e => e.type === 'coin')); }
  ok(coins.length > 0 && coins.every(e => e.coins === 2 && e.fever), `every coin that drops during Fever pays double (${coins.length} coins)`);
  const after = stepFor(g, 4); ok(after.some(e => e.type === 'fever' && !e.on) && g.feverT === 0, 'Fever ends');
  g._lamp(); ok(g.lamps === 0, 'a short cool-down after a Fever');
  const h = new Game({ bet: 1000, seed: 16 }); h._lamp(); h._lamp(); stepFor(h, CFG.LAMP_DECAY + 1);
  ok(h.lamps === 1, 'lamps go out one by one when nothing is won for a while');
}

// determinism of the whole game
{
  const sess = () => { const g = new Game({ bet: 1000, seed: 21, preset: 'hot' }); const r = mulberry32(4); for (let t = 0; t < 60; t += 1 / 30) { if ((t * 30 | 0) % 12 === 0) g.drop((r() * 2 - 1) * 4); g.step(1 / 30); } return JSON.stringify([g.save(), g.stats]); };
  ok(sess() === sess(), 'same seed, same drops → same game');
}

// Economy: long sessions return 85–100 % of the coins spent (coins back + tickets at 500 xu + jackpot pool growth).
// The rules are tuned so that no playing style is a money printer — see the "Economy" comment in js/pusher-sim.js.
{
  const session = (style, coins, seed, preset) => {
    const g = new Game({ bet: 1000, seed, preset }), r = mulberry32(seed * 31 + 7), pool0 = g.pool; let cd = 0, n = 0;
    while (g.stats.paid < coins) {
      cd -= 1 / 30; const ph = g.sim.phase().k, P = g.sim.pocket;
      if (cd <= 0) {
        if (style === 'auto') { g.drop((r() * 2 - 1) * 4.2); cd = 0.6; }                                     // auto-drop, aim anywhere
        else if (style === 'cup' && ph > 0.6 && ph < 0.92) { g.drop(Math.sin((g.sim.t + 0.62) * 2 * Math.PI / P.period) * P.amp + (r() - .5) * .3); cd = 0.3; }   // hunts the pocket
        else if (style === 'edge' && ph < 0.18) { g.drop(n++ % 2 ? -3.2 : 3.2); cd = 0.3; }                   // textbook: retracted pusher, corners
      }
      g.step(1 / 30);
    }
    for (let i = 0; i < 300; i++) g.step(1 / 30);
    return { rate: g.returnRate(pool0), g };
  };
  const pct = x => (x * 100).toFixed(1) + '%';
  const t0 = Date.now();
  const a = session('auto', 2500, 8, 'hot');
  const s = a.g.stats;
  console.log(`  economy (auto-drop, 2 500 coins): returns ${pct(a.rate)} — coins ${pct(s.coins / s.paid)}, tickets ${pct(s.tickets * 0.5 / s.paid)}, pool +${(a.g.pool - CFG.JP_SEED).toFixed(1)}; ` +
    `${s.spins} spins (${pct(s.pocket / s.paid)} into the cup), ${Object.values(s.prizes).reduce((x, y) => x + y, 0)} prizes, ${s.sets} sets, ${s.fevers} Fevers, ${s.jackpots} jackpots`);
  ok(a.rate > 0.85 && a.rate < 1.0, 'a long auto-drop session returns 85–100 %: ' + pct(a.rate));
  const b = session('cup', 1200, 3, 'hot'), c = session('edge', 1200, 3, 'hot');
  console.log(`  pocket hunter: ${pct(b.rate)} (${pct(b.g.stats.pocket / b.g.stats.paid)} into the cup) · edge + timing: ${pct(c.rate)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  ok(b.rate > 0.8 && b.rate < 1.05 && c.rate > 0.8 && c.rate < 1.05, 'other playing styles stay in the same band (no money printer)');
  ok(b.g.stats.pocket / b.g.stats.paid > 0.15 && s.pocket / s.paid < 0.1, 'aiming at the cup pays off in spins; random drops rarely hit it');
}
console.log(pass + ' passed, 0 failed');
