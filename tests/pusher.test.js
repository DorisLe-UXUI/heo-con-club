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
console.log(pass + ' passed, 0 failed');
