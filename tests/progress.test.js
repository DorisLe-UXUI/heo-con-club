'use strict';
/* node tests/progress.test.js — js/hc-progress.js: quests, levels, achievements, festival track, wheel, piggy bank, help. */
const assert = require('assert');
const create = require('../js/hc-progress.js');
let passed = 0, failed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n ', e && e.stack || e); } }

function memStore(init = {}) { const m = Object.assign({}, init); return { get: (k, d) => (k in m ? JSON.parse(JSON.stringify(m[k])) : d), set: (k, v) => { m[k] = JSON.parse(JSON.stringify(v)); }, m }; }
const DAY = 864e5, T0 = new Date(2026, 9, 21, 10).getTime();      // Wednesday 21/10/2026, inside festival 1
function make(t0 = T0, init) { const st = memStore(Object.assign({ coins: 1000000, gems: 0 }, init)); let clock = t0; const p = create(st, { now: () => clock }); return { p, st, tick: ms => { clock += ms; }, set: v => { clock = v; } }; }
const finish = (p, q, game = 'tien-len') => {           // drive events until quest q (from p.daily().q) is done
  for (let i = 0; i < 400 && q.n < q.goal; i++) {
    switch (true) {
      case /^(play|game|dice|board|variety|win|cardwin|bigwin|streak)$/.test(q.id): {
        const g = q.g || (q.id === 'dice' ? 'bau-cua' : q.id === 'board' ? 'co-caro' : q.id === 'variety' ? ['phom', 'poker', 'lieng', 'bau-cua', 'co-caro', 'xi-dach'][i % 6] : game);
        p.track('round', { game: g, net: q.id === 'bigwin' ? q.goal : 50000, bet: 10000 }); break;
      }
      case q.id === 'bet': p.track('bet', { game, amount: 50000 }); break;
      case q.id === 'won': p.track('win', { game, amount: 50000 }); break;
      case q.id === 'fish': p.track('catch', { game: 'ban-ca', id: 'ca_vang', tier: 'small', mult: 2 }); break;
      case q.id === 'boss': p.track('catch', { game: 'ban-ca', id: 'ca_map', tier: 'boss', mult: 100 }); break;
      case q.id === 'chat': p.track('combo', { game: 'tien-len', kind: 'chat_heo' }); break;
      case q.id === 'pusher': p.track('bet', { game: 'day-xu', amount: 1000 }); break;
      case q.id === 'walk': p.track('walk', { m: 50 }); break;
      case q.id === 'social': p.track('greet', { name: 'npc' + i }); break;
      default: throw new Error('unknown quest ' + q.id);
    }
    q = p.daily().q.find(x => x.id === q.id && x.d === q.d) || p.weekly().q.find(x => x.id === q.id && x.d === q.d) || q;
  }
  return q;
};

t('3 daily quests (easy / medium / hard) and 4 weekly ones, all different, same for the same day', () => {
  const a = make().p, b = make().p;
  const d = a.daily().q; assert.deepStrictEqual(d.map(q => q.d), [0, 1, 2]); assert.strictEqual(new Set(d.map(q => q.id)).size, 3);
  assert.deepStrictEqual(d.map(q => q.id + q.goal), b.daily().q.map(q => q.id + q.goal));
  const w = a.weekly().q; assert.strictEqual(w.length, 4); assert.strictEqual(new Set(w.map(q => q.id)).size, 4);
  for (const q of w) { assert.ok(q.id !== 'walk' && q.id !== 'social'); const daily = d.find(x => x.id === q.id && x.d === q.d); if (daily) assert.ok(q.goal > daily.goal); }
  for (const q of d.concat(w)) assert.ok(a.questName(q).length > 5 && !/undefined|NaN/.test(a.questName(q)), a.questName(q));
});
t('quests reset at midnight, weekly on Monday', () => {
  const { p, set } = make(); const d0 = p.daily().d, w0 = p.weekly().w;
  set(T0 + DAY); assert.notStrictEqual(p.daily().d, d0); assert.strictEqual(p.weekly().w, w0);
  set(new Date(2026, 9, 26, 1).getTime()); assert.notStrictEqual(p.weekly().w, w0);       // Monday 26/10
});
t('every quest template can be completed and claimed once; coins, festival points and XP are paid', () => {
  for (let k = 0; k < 40; k++) {
    const { p, st } = make(T0 + k * DAY);
    for (const [i, q0] of p.daily().q.entries()) {
      const q = finish(p, q0); assert.strictEqual(q.n, q.goal, p.questName(q));
      const c0 = st.m.coins, pts0 = p.season().pts, r = p.claimQuest(false, i);
      assert.ok(r && st.m.coins >= c0 + q.coins && p.season().pts >= pts0 + q.pts, 'paid ' + q.id);
      assert.strictEqual(p.claimQuest(false, i), null);
    }
    assert.ok(p.chestReady(false)); const s0 = p.wheel().spins; assert.ok(p.claimChest(false)); assert.strictEqual(p.wheel().spins, s0 + 1); assert.strictEqual(p.claimChest(false), null);
  }
});
t('a quest cannot be claimed before it is done; one free reroll a day', () => {
  const { p } = make(); assert.strictEqual(p.claimQuest(false, 0), null);
  const before = p.daily().q[1].id; assert.ok(p.reroll(1)); assert.notStrictEqual(p.daily().q[1].id, before);
  assert.strictEqual(new Set(p.daily().q.map(q => q.id)).size, 3); assert.strictEqual(p.reroll(0), false);
});
t('win streak quest resets on a loss but not on a draw', () => {
  const { p } = make();
  const w = p.weekly(); w.q[0] = { id: 'streak', d: 1, goal: 3, n: 0, coins: 1, pts: 1, xp: 1, claimed: false, seen: [] };
  p.track('round', { game: 'poker', net: 10 }); p.track('round', { game: 'poker', net: 0 }); p.track('round', { game: 'poker', net: 10 });
  assert.strictEqual(p.weekly().q[0].n, 2); p.track('round', { game: 'poker', net: -5 }); assert.strictEqual(p.weekly().q[0].n, 0);
  assert.strictEqual(p.stats().bestStreak, 2);
});
t('levels: XP from rounds, level-up pays coins (and gems every 5), titles unlock', () => {
  const { p, st } = make(); const ev = []; p.on((type, d) => type === 'level' && ev.push(d));
  const c0 = st.m.coins;
  for (let i = 0; i < 200; i++) p.track('round', { game: 'phom', net: i % 2 ? 1000 : -1000, bet: 20000 });
  assert.ok(p.level() >= 10, 'level ' + p.level()); assert.strictEqual(ev.length, p.level() - 1);
  const expect = ev.reduce((s, e) => s + e.reward.coins, 0); assert.ok(st.m.coins - c0 >= expect);
  assert.ok(st.m.gems >= 50 * Math.floor(p.level() / 5)); assert.ok(p.titles().includes('Tay Chơi Phố Heo'));
  assert.strictEqual(st.m.lv, p.level()); assert.ok(p.xpPct() >= 0 && p.xpPct() < 100);
});
t('VIP follows lifetime bets', () => {
  const { p } = make(); assert.strictEqual(p.vip(), 1);
  p.track('bet', { game: 'poker', amount: 5e6 }); assert.strictEqual(p.vip(), 3);
  p.track('bet', { game: 'poker', amount: 2e9 }); assert.strictEqual(p.vip(), 8);
});
t('achievements: tiers unlock in order and pay once each', () => {
  const { p, st } = make();
  for (let i = 0; i < 12; i++) p.track('round', { game: 'xi-dach', net: 10 });
  let a = p.achievements().find(x => x.id === 'rounds'); assert.strictEqual(a.done, 1); assert.ok(a.claimable);
  const g0 = st.m.gems; assert.ok(p.claimAch('rounds')); assert.strictEqual(st.m.gems, g0 + 10); assert.strictEqual(p.claimAch('rounds'), null);
  a = p.achievements().find(x => x.id === 'streak'); assert.strictEqual(a.value, 12); assert.strictEqual(a.done, 4);
  for (let i = 0; i < 4; i++) assert.ok(p.claimAch('streak')); assert.strictEqual(p.claimAch('streak'), null);
});
t('fish album and boss counter', () => {
  const { p } = make();
  p.track('catch', { game: 'ban-ca', id: 'ca_vang', tier: 'small' }); p.track('catch', { game: 'ban-ca', id: 'ca_vang', tier: 'small' }); p.track('catch', { game: 'ban-ca', id: 'ca_voi', tier: 'boss' });
  assert.deepStrictEqual(p.album(), { ca_vang: 2, ca_voi: 1 }); assert.strictEqual(p.stats().boss, 1); assert.ok('ban-ca' in p.stats().games);
});
t('festival track: 100 points a tier, each tier claimed once, resets with the next festival', () => {
  const { p, st, set } = make();
  for (let i = 0; i < 80; i++) p.track('round', { game: 'bau-cua', net: 0 });        // 4 pts each
  const s = p.season(); assert.strictEqual(s.tier, 3); assert.ok(s.left > 0 && s.left <= 14 * DAY);
  assert.strictEqual(p.claimTier(4), null); const c0 = st.m.coins; assert.ok(p.claimTier(1)); assert.ok(st.m.coins > c0); assert.strictEqual(p.claimTier(1), null);
  assert.ok(p.claimTier(3)); assert.ok(p.wheel().extra >= 1);                     // tier 3 gives a spin
  set(new Date(2026, 10, 3, 9).getTime()); assert.strictEqual(p.season().pts, 0); assert.strictEqual(p.season().no, 2);
});
t('wheel: one free spin a day plus extra spins; prizes follow the weights', () => {
  const { p, tick } = make(); assert.strictEqual(p.wheel().spins, 1);
  assert.ok(p.spin(() => 0)); assert.strictEqual(p.wheel().spins, 0); assert.strictEqual(p.spin(), null);
  tick(DAY); assert.strictEqual(p.wheel().spins, 1);
  const hist = new Array(8).fill(0); let r = 1; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  for (let i = 0; i < 4000; i++) { p.state().wheel.extra = 1; p.state().wheel.d = p.daily().d; hist[p.spin(rnd).index]++; }
  assert.ok(hist[0] > hist[7] * 5 && hist[7] > 0, hist.join(','));
});
t('piggy bank fills from bets, breaks once a day from level 3 and 50K', () => {
  const { p, st, tick } = make();
  p.track('bet', { game: 'poker', amount: 1e6 }); assert.strictEqual(p.piggy().amt, 20000); assert.strictEqual(p.piggy().can, false);
  p.track('bet', { game: 'poker', amount: 2e6 }); assert.strictEqual(p.piggy().can, false);          // level 1
  for (let i = 0; i < 30; i++) p.track('round', { game: 'phom', net: 1 }); assert.ok(p.level() >= 3);
  const c0 = st.m.coins, amt = p.piggy().amt; assert.ok(p.piggy().can); assert.ok(p.breakPiggy()); assert.strictEqual(st.m.coins, c0 + amt);
  p.track('bet', { game: 'poker', amount: 5e6 }); assert.strictEqual(p.piggy().can, false); tick(DAY); assert.strictEqual(p.piggy().can, true);
  p.track('bet', { game: 'poker', amount: 1e12 }); assert.strictEqual(p.piggy().amt, 5e6);
});
t('help when broke: 200K up to 3 times a day, only under 20K', () => {
  const { p, st, tick } = make(T0, { coins: 5000 });
  assert.strictEqual(p.rescueState(50000).can, false);
  for (let i = 0; i < 3; i++) { assert.ok(p.rescue(1000)); } assert.strictEqual(p.rescue(1000), null); assert.strictEqual(st.m.coins, 605000);
  tick(DAY); assert.ok(p.rescue(1000));
});
t('rewards go through HC.giveCoins when a page sets it', () => {
  global.window = { HC: { giveCoins: n => { got += n; } } }; let got = 0;
  delete require.cache[require.resolve('../js/hc-progress.js')];
  const p = require('../js/hc-progress.js')(memStore({ coins: 0 }), { now: () => T0 });
  for (let i = 0; i < 3; i++) p.track('round', { game: 'poker', net: 1 }); const q = p.daily().q.findIndex(q => q.n >= q.goal);
  if (q >= 0) { p.claimQuest(false, q); assert.ok(got > 0); } else { p.spin(() => .99); assert.ok(got > 0); }
  delete global.window;
});
t('claimable counter adds quests, chests, achievements and festival tiers', () => {
  const { p } = make(); assert.strictEqual(p.claimableCount(), 0);
  for (let i = 0; i < 30; i++) p.track('round', { game: 'bai-cao', net: 5 });
  assert.ok(p.claimableCount() >= 3);
});

t('reload switches to another account\'s save', () => {
  const m = {}; let user = 'a'; const st = { get: (k, d) => (user + k in m ? JSON.parse(m[user + k]) : d), set: (k, v) => { m[user + k] = JSON.stringify(v); } };
  const p = create(st, { now: () => T0 }); for (let i = 0; i < 5; i++) p.track('round', { game: 'poker', net: 1 });
  assert.strictEqual(p.stats().rounds, 5); user = 'b'; p.reload(); assert.strictEqual(p.stats().rounds, 0); user = 'a'; p.reload(); assert.strictEqual(p.stats().rounds, 5);
});

console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
