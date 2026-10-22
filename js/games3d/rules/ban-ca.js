/* Bắn Cá rules (pure, no DOM / three.js): fish table, HP model, cannon bets, swim paths, economy simulation.
 *
 * Economy (hit-point model):
 *   - Every shot costs the cannon's bet. Bullets lock onto a fish and home in, so a shot almost always lands.
 *   - When a fish spawns it draws how many hits it can take: n ≈ U[1−s, 1+s] × mult / RTP, stochastically rounded so that
 *     E[n] = mult / RTP exactly (s = 0.2 small, 0.35 medium, 0.4 big/boss → small fish die in 1–5 hits).
 *   - The hit that empties the HP bar catches the fish. The prize is mult × (coins put into the fish) / n for every cannon
 *     that shot it — for one cannon at one level that is exactly bet × mult. Splitting by coins put in keeps it fair when a
 *     bot finishes your fish, and makes switching to a big bet for the last hit pointless.
 *   - Expected prize per hit = mult × bet / E[n] = RTP × bet (size-biased: a random hit lands on a fish with n hits with
 *     probability ∝ n). Fish that escape with damage pay nothing: that, plus the 5%, is the house edge.
 *   - A stray bullet that never touches a fish is refunded.
 *   - A fish that was just hit swims slower for a moment (the net holds it), so locked fish rarely escape.
 * The playfield is the rectangle bounds = { x0, x1, z0, z1 } on the swim plane (x right, z toward the player).
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['ban-ca'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RTP = 0.95;
  const BETS = [1000, 2000, 5000, 10000, 50000];            // cannon level 1..5
  const TIERS = { small: 'Cá nhỏ', medium: 'Cá vừa', big: 'Cá lớn', boss: 'Trùm' };
  const SPREAD = { small: .2, medium: .35, big: .4, boss: .4 };
  const STUN = .6, SLOW = .3;                                // a hit slows the fish to 30% speed for 0.6 s (the net holds it)
  /** r = hit radius (world units), speed = units/s, weight = spawn weight (bosses are scheduled), school = [min,max] group size.
   *  look: 'proc:<style>' for procedural 3D fish, otherwise a sprite texture key from the ban-ca bundle. upright = sprite never mirrors/tilts. */
  const FISH = [
    { id: 'ca_vang', name: 'Cá Vàng', tier: 'small', mult: 2, r: .5, speed: 3.2, weight: 15, school: [4, 7], look: 'proc:gold' },
    { id: 'ca_hong', name: 'Cá Hồng', tier: 'small', mult: 3, r: .55, speed: 3.0, weight: 12, school: [3, 6], look: 'proc:pink' },
    { id: 'ca_he', name: 'Cá Hề', tier: 'small', mult: 3, r: .6, speed: 2.8, weight: 10, school: [2, 4], look: 'proc:clown' },
    { id: 'ca_xanh', name: 'Cá Xanh', tier: 'small', mult: 4, r: .65, speed: 2.6, weight: 8, school: [2, 4], look: 'sea_fish' },
    { id: 'tom', name: 'Tôm', tier: 'small', mult: 4, r: .6, speed: 2.4, weight: 7, school: [2, 3], look: 'sea_shrimp' },
    { id: 'ca_noc', name: 'Cá Nóc', tier: 'medium', mult: 8, r: .85, speed: 1.9, weight: 5, school: [1, 2], look: 'sea_blowfish' },
    { id: 'cua', name: 'Cua', tier: 'medium', mult: 10, r: .85, speed: 1.7, weight: 4.5, school: [1, 2], look: 'sea_crab', upright: true },
    { id: 'sua', name: 'Sứa', tier: 'medium', mult: 12, r: .9, speed: 1.4, weight: 4, school: [1, 3], look: 'sea_jellyfish', upright: true },
    { id: 'ca_than_tien', name: 'Cá Thần Tiên', tier: 'medium', mult: 15, r: .95, speed: 1.8, weight: 3.5, school: [1, 2], look: 'sea_tropical_fish' },
    { id: 'muc', name: 'Mực', tier: 'medium', mult: 15, r: 1.0, speed: 1.6, weight: 3, school: [1, 1], look: 'sea_squid', upright: true },
    { id: 'rua', name: 'Rùa Biển', tier: 'big', mult: 20, r: 1.3, speed: 1.2, weight: 2.2, school: [1, 1], look: 'sea_turtle' },
    { id: 'tom_hum', name: 'Tôm Hùm', tier: 'big', mult: 25, r: 1.25, speed: 1.2, weight: 1.8, school: [1, 1], look: 'sea_lobster', upright: true },
    { id: 'hai_cau', name: 'Hải Cẩu', tier: 'big', mult: 30, r: 1.4, speed: 1.3, weight: 1.5, school: [1, 1], look: 'sea_seal' },
    { id: 'ca_heo', name: 'Cá Heo', tier: 'big', mult: 40, r: 1.45, speed: 1.5, weight: 1.1, school: [1, 1], look: 'sea_dolphin' },
    { id: 'ca_rong', name: 'Cá Rồng Vàng', tier: 'big', mult: 50, r: 1.5, speed: 1.3, weight: .9, school: [1, 1], look: 'proc:dragon' },
    { id: 'bach_tuoc', name: 'Bạch Tuộc Khổng Lồ', tier: 'boss', mult: 80, r: 2.0, speed: .85, weight: 0, school: [1, 1], look: 'sea_octopus', upright: true },
    { id: 'ca_map', name: 'Cá Mập Trắng', tier: 'boss', mult: 100, r: 2.15, speed: .9, weight: 0, school: [1, 1], look: 'sea_shark' },
    { id: 'ca_voi', name: 'Cá Voi Xanh', tier: 'boss', mult: 150, r: 2.4, speed: .75, weight: 0, school: [1, 1], look: 'sea_whale' },
  ];
  const BY_ID = Object.fromEntries(FISH.map(f => [f.id, f]));
  const BOSSES = FISH.filter(f => f.tier === 'boss');
  const DEFAULT_BOUNDS = { x0: -12, x1: 12, z0: -6.5, z1: 6.5 };

  function rng32(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function betOf(level) { return BETS[Math.max(1, Math.min(BETS.length, level)) - 1]; }

  // ------------------------------------------------------------------ hit points & prizes
  /** Average hits a fish takes ("HP"): mult / RTP. */
  function hp(mult) { return mult / RTP; }
  /** Hits this particular fish can take: U[1−s,1+s] × mult/RTP, stochastically rounded (E[n] = mult/RTP exactly), at least 1. */
  function drawHits(f, rng = Math.random) {
    const s = SPREAD[f.tier] || .4, x = Math.max(1, hp(f.mult) * (1 - s + 2 * s * rng())), k = Math.floor(x);
    return k + (rng() < x - k ? 1 : 0);
  }
  /** Economic state of one swimming fish. */
  function newTarget(f, rng = Math.random, n) { return { type: f, n: n || drawHits(f, rng), hits: 0, stake: {}, dead: false }; }
  /** One bullet lands on fish t, fired by `shooter` (0 = you, 1..3 = bots) with `bet`. Returns { dead, hits, left, payouts }.
   *  payouts: [{ shooter, amount }] — every cannon that shot this fish gets mult × (its coins in the fish) / n. */
  function applyHit(t, shooter, bet) {
    if (t.dead) return { dead: false, hits: t.hits, left: 0, payouts: [], late: true };
    t.hits++; t.stake[shooter] = (t.stake[shooter] || 0) + bet;
    if (t.hits < t.n) return { dead: false, hits: t.hits, left: t.n - t.hits, payouts: [] };
    t.dead = true;
    const payouts = Object.keys(t.stake).map(s => ({ shooter: +s, amount: Math.round(t.type.mult * t.stake[s] / t.n) }));
    return { dead: true, hits: t.hits, left: 0, payouts, killer: shooter };
  }
  function prizeFor(t, shooter) { return Math.round(t.type.mult * (t.stake[shooter] || 0) / t.n); }

  // ------------------------------------------------------------------ spawning
  function pickType(rng = Math.random) {
    const list = FISH.filter(f => f.weight > 0), tot = list.reduce((s, f) => s + f.weight, 0);
    let x = rng() * tot; for (const f of list) { x -= f.weight; if (x < 0) return f; }
    return list[list.length - 1];
  }
  function pickBoss(rng = Math.random) { return BOSSES[Math.floor(rng() * BOSSES.length)]; }
  function nextBossDelay(rng = Math.random) { return 52 + rng() * 16; }
  function schoolSize(f, rng = Math.random) { return f.school[0] + Math.floor(rng() * (f.school[1] - f.school[0] + 1)); }
  function margin(f) { return f.r + 1.6; }
  function schoolSpread(f) { return Math.min(1.2, .55 + f.r * .5); }

  /** A smooth swim path: cubic Bézier from outside one edge to outside the opposite (or a neighbouring) edge,
   *  with both inner control points inside the field, so the whole curve stays within bounds ± margin. */
  function makePath(f, rng = Math.random, b = DEFAULT_BOUNDS) {
    const m = margin(f), W = b.x1 - b.x0, D = b.z1 - b.z0;
    const inX = t => b.x0 + 1 + t * (W - 2), inZ = t => b.z0 + 1 + t * (D - 2);
    const edge = (side, t) => side === 0 ? [b.x0 - m, inZ(t)] : side === 1 ? [b.x1 + m, inZ(t)] : side === 2 ? [inX(t), b.z0 - m] : [inX(t), b.z1 + m];
    const r = rng();
    let s0, s1;
    if (r < .78) { s0 = rng() < .5 ? 0 : 1; s1 = rng() < .8 ? 1 - s0 : (rng() < .5 ? 2 : 3); }
    else { s0 = 2; s1 = rng() < .55 ? 3 : (rng() < .5 ? 0 : 1); }
    if (f.tier === 'boss') { s0 = rng() < .5 ? 0 : 1; s1 = 1 - s0; }
    const p0 = edge(s0, .1 + rng() * .8), p3 = edge(s1, .1 + rng() * .8);
    const ip = () => [inX(.1 + rng() * .8), inZ(.1 + rng() * .8)];
    let p1 = ip(), p2 = ip();
    if (f.tier === 'boss') { p1 = [inX(.3), inZ(.25 + rng() * .5)]; p2 = [inX(.7), inZ(.25 + rng() * .5)]; if (s0 === 1) [p1, p2] = [p2, p1]; }
    const path = { p: [p0, p1, p2, p3], m };
    const N = 48, lut = [0]; let prev = bez(path.p, 0), len = 0;
    for (let i = 1; i <= N; i++) { const q = bez(path.p, i / N); len += Math.hypot(q[0] - prev[0], q[1] - prev[1]); lut.push(len); prev = q; }
    path.len = len; path.lut = lut;
    return path;
  }
  function bez(p, u) { const v = 1 - u, a = v * v * v, c = 3 * v * v * u, d = 3 * v * u * u, e = u * u * u; return [a * p[0][0] + c * p[1][0] + d * p[2][0] + e * p[3][0], a * p[0][1] + c * p[1][1] + d * p[2][1] + e * p[3][1]]; }
  function bezD(p, u) { const v = 1 - u; return [3 * v * v * (p[1][0] - p[0][0]) + 6 * v * u * (p[2][0] - p[1][0]) + 3 * u * u * (p[3][0] - p[2][0]), 3 * v * v * (p[1][1] - p[0][1]) + 6 * v * u * (p[2][1] - p[1][1]) + 3 * u * u * (p[3][1] - p[2][1])]; }
  /** Point at travelled distance d (clamped). Returns { x, z, dx, dz } with a unit tangent. */
  function pathAt(path, d) {
    const lut = path.lut, N = lut.length - 1; d = Math.max(0, Math.min(path.len, d));
    let lo = 0, hi = N; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lut[mid] < d) lo = mid; else hi = mid; }
    const seg = lut[hi] - lut[lo], u = (lo + (seg > 0 ? (d - lut[lo]) / seg : 0)) / N;
    const q = bez(path.p, u), t = bezD(path.p, u), l = Math.hypot(t[0], t[1]) || 1;
    return { x: q[0], z: q[1], dx: t[0] / l, dz: t[1] / l };
  }
  function inside(x, z, b, pad = 0) { return x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad; }
  /** Speed multiplier right after a hit. */
  function speedFactor(sinceHit) { return sinceHit < STUN ? SLOW : 1; }
  /** Seconds a fish has left before it swims off-field (at full speed). */
  function timeLeft(path, d, speed) { return Math.max(0, path.len - d) / speed; }
  /** Is it worth locking onto this fish? (enough time left to finish it at `rate` hits/s) */
  function worthLocking(t, path, d, speed, rate) { const need = (t.n - t.hits) / rate; return timeLeft(path, d, speed * SLOW) > need * 1.1 || t.n - t.hits <= 2; }

  /** Shots still needed on a fish once the bullets already flying at it land (the cannon holds fire instead of overkilling). */
  function needed(t, incoming) { return t.n - t.hits - incoming; }

  /** Whole-game economy simulation, mirroring the 3D game: fish spawn and swim; you lock onto a fish and fire `rate` shots/s
   *  (homing: a shot lands `flight` s later; if its fish is already gone it re-targets your current lock, or another fish,
   *  or is refunded); the cannon holds fire when the bullets in flight already finish the fish; three bots shoot too.
   *  Fish that leave the field with damage are lost (house edge). Returns your return-to-player. */
  function simulateWorld(opts = {}) {
    const rng = opts.rng || Math.random, b = opts.bounds || DEFAULT_BOUNDS, shots = opts.shots || 100000, dt = .05;
    const rate = opts.rate || 5, flight = opts.flight || .35, bet = opts.bet || 10000, bots = opts.bots == null ? 3 : opts.bots, smart = !!opts.smart;
    const fish = [], flying = [];
    let t = 0, spent = 0, back = 0, fired = 0, refunds = 0, escapedHits = 0, lock = null, nextShot = 0, spawnT = 0, bossT = 30, kills = 0, botNext = [1, 1.3, 1.7];
    const add = (type, path, d, off) => { const f = { type, path, d, off, speed: type.speed * (.92 + rng() * .16), t: newTarget(type, rng), hitAt: -9, hitsBy0: 0 }; fish.push(f); return f; };
    const spawn = () => { const type = pickType(rng), path = makePath(type, rng, b), n = schoolSize(type, rng); for (let i = 0; i < n; i++) add(type, path, -i * type.r * 1.6, 0); };
    for (let i = 0; i < 12; i++) { const type = pickType(rng), path = makePath(type, rng, b); add(type, path, path.len * (.1 + rng() * .6), 0); }
    const pos = f => pathAt(f.path, f.d);
    const onField = f => { const q = pos(f); return f.d > 0 && inside(q.x, q.z, b, -.3); };
    const visible = f => { const q = pos(f); return f.d > 0 && inside(q.x, q.z, b, f.type.r * .6); };   // a locked fish is followed until it is off screen
    const land = (f, who) => {
      const r = applyHit(f.t, who, bet); f.hitAt = t;
      if (who === 0) f.hitsBy0++;
      if (r.dead) { kills++; for (const p of r.payouts) if (p.shooter === 0) back += p.amount; fish.splice(fish.indexOf(f), 1); }
    };
    while (fired < shots || flying.length) {
      t += dt;
      // spawning
      spawnT -= dt; if (spawnT <= 0 && fish.length < 24) { spawn(); spawnT = .4 + rng() * .8; }
      bossT -= dt; if (bossT <= 0 && !fish.some(f => f.type.tier === 'boss')) { const bt = pickBoss(rng); add(bt, makePath(bt, rng, b), 0, 0); bossT = nextBossDelay(rng); }
      // swimming; fish leaving with damage are lost
      for (let i = fish.length - 1; i >= 0; i--) { const f = fish[i]; f.d += f.speed * speedFactor(t - f.hitAt) * dt; if (f.d > f.path.len) { escapedHits += f.hitsBy0; fish.splice(i, 1); } }
      const field = fish.filter(onField);
      const relock = () => { const ok = smart ? field.filter(f => worthLocking(f.t, f.path, f.d, f.speed, rate)) : field; lock = ok.length ? ok[Math.floor(rng() * ok.length)] : null; };
      if (!lock || !fish.includes(lock) || !visible(lock)) relock();
      // bullets in flight
      for (let i = flying.length - 1; i >= 0; i--) {
        const s = flying[i]; if (t < s.at) continue;
        if (fish.includes(s.f)) { flying.splice(i, 1); s.f.incoming--; land(s.f, s.who); continue; }
        if (s.who === 0 && !s.retried && lock && fish.includes(lock)) { s.f = lock; lock.incoming = (lock.incoming || 0) + 1; s.at = t + flight * .6; s.retried = true; continue; }   // homes onto your new lock
        flying.splice(i, 1);
        const alt = fish.filter(onField);
        if (alt.length) land(alt[Math.floor(rng() * alt.length)], s.who); else if (s.who === 0) { back += bet; refunds++; }
      }
      // you
      if (lock && !fish.includes(lock)) relock();
      if (fired < shots && lock && t >= nextShot) {
        if (needed(lock.t, lock.incoming || 0) > 0) { spent += bet; fired++; nextShot = t + 1 / rate; lock.incoming = (lock.incoming || 0) + 1; flying.push({ f: lock, who: 0, at: t + flight }); }
        else { nextShot = t + .05; }
      }
      // bots: about one shot a second each, biased toward big fish (like the game)
      for (let k = 0; k < bots; k++) { botNext[k] -= dt; if (botNext[k] <= 0 && field.length) { botNext[k] = .5 + rng() * .9; const byMult = field.slice().sort((a, c) => c.type.mult - a.type.mult), f = byMult[Math.floor(Math.pow(rng(), 1.6) * byMult.length)]; if (needed(f.t, f.incoming || 0) > 0) { f.incoming = (f.incoming || 0) + 1; flying.push({ f, who: k + 1, at: t + flight }); } } }
    }
    return { shots: fired, spent, back, rtp: back / spent, kills, refunds, escapedHits, escapeShare: escapedHits / fired, seconds: Math.round(t) };
  }

  return { RTP, BETS, TIERS, SPREAD, STUN, SLOW, FISH, BY_ID, BOSSES, DEFAULT_BOUNDS, rng32, betOf, hp, drawHits, newTarget, applyHit, prizeFor,
    pickType, pickBoss, nextBossDelay, schoolSize, margin, schoolSpread, makePath, pathAt, bez, inside, speedFactor, timeLeft, worthLocking, needed, simulateWorld };
});
