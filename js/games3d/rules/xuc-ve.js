/* Máy Xúc Vé (ticket-roll scoop machine) — pure rules, no DOM, no three.js.
 * UMD: window.Rules['xuc-ve'] in the browser, module.exports in Node (tests/xuc-ve.test.js).
 *
 * The machine, seen from above (x right, z toward the player):
 *   BIN    behind the shelf: a heap of ticket rolls lying along the arc the scoop swings over. The heap is kept as
 *          SLOTS columns of roll counts along the arm angle θ ∈ [−ARC, ARC].
 *   ARM    swings θ(t) = ARC · sin(2πt / SWING). Pressing stops it and the scoop digs at θ.
 *          Timing quality q = (rolls under the scoop mouth) / FULL, capped at 1: a tall heap under the mouth = 1.
 *          The scoop keeps n = cap · fill(q) rolls on average (stochastic rounding; fill(1) = 1, fill(0) = 0).
 *          The kinds come from the machine's weighted roll table (seeded random), so the bin is always "mixed".
 *          A hopper tops the bin back up toward PILE_N rolls in batches of BATCH, each batch at one new random spot (a new heap).
 *   SHELF  a coin-pusher shelf, same physics as js/pusher-sim.js (copied here, that file is not touched):
 *          the scoop tips its rolls around DROP_Z; the pusher face sweeps PZ_MIN..PZ_MAX; rolls pushed past FRONT fall.
 *          In the middle they pay their printed value; at the two corners (GUTTER wide) they slide back into the bin.
 *          Rolls that stay on the shelf wait for the next scoops, so the shelf fills up like a real machine.
 *
 * Economy (tests/xuc-ve.test.js simulates thousands of scoops): price per scoop = PER_ROLL × cap, so every scoop size has
 * the same return. Long-run return ≈ 92–94% with perfect timing, ≈ 86–87% for a normal player, ≈ 50% when pressing blindly.
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['xuc-ve'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------ tables
  /** Ticket rolls: printed value, table weight (per 1000), colours (top, ring, text). */
  const ROLLS = [
    { id: 'r10', value: 10000, w: 690, label: '10K', name: 'Cuộn 10K', top: '#ffd6e8', ring: '#ff6fa8', ink: '#c2407a', side: 0xff8fc0 },
    { id: 'r20', value: 20000, w: 190, label: '20K', name: 'Cuộn 20K', top: '#d6f3ff', ring: '#3d9bff', ink: '#1f6fc0', side: 0x6fbfff },
    { id: 'r50', value: 50000, w: 80, label: '50K', name: 'Cuộn 50K', top: '#d8fbe9', ring: '#2fc58e', ink: '#168a60', side: 0x5fd9ac },
    { id: 'r100', value: 100000, w: 30, label: '100K', name: 'Cuộn 100K', top: '#ece3ff', ring: '#8d6bff', ink: '#5f3fc9', side: 0xb79bff },
    { id: 'r200', value: 200000, w: 8, label: '200K', name: 'Cuộn 200K', top: '#ffe3d3', ring: '#ff8f5c', ink: '#b8542a', side: 0xffb38a },
    { id: 'r500', value: 500000, w: 2, label: '500K', name: 'Cuộn Vàng 500K', top: '#fff3b0', ring: '#ffb300', ink: '#a86d00', side: 0xffc93c, gold: true },
  ];
  const BY_ID = Object.fromEntries(ROLLS.map(r => [r.id, r]));
  const W_TOTAL = ROLLS.reduce((s, r) => s + r.w, 0);
  const AVG_VALUE = ROLLS.reduce((s, r) => s + r.value * r.w, 0) / W_TOTAL;
  const PER_ROLL = 15000;                                   // price of one roll of scoop capacity
  /** Scoop sizes (rooms). */
  const TIERS = [
    { id: 'nho', name: 'Muỗng Nhỏ', cap: 2, price: 2 * PER_ROLL, color: '#ff6fa8' },
    { id: 'vua', name: 'Muỗng Vừa', cap: 4, price: 4 * PER_ROLL, color: '#3d9bff' },
    { id: 'to', name: 'Muỗng Lớn', cap: 8, price: 8 * PER_ROLL, color: '#ffb300' },
  ];
  const TIER = Object.fromEntries(TIERS.map(t => [t.id, t]));

  // ------------------------------------------------------------------ bin + arm
  const SLOTS = 19, ARC = 1.05, SWING = 3.2, PILE_N = 50, BATCH = 8, FULL = 7, MOUTH = 2.0;   // MOUTH: half-width of the scoop in slots
  const SLOT_W = 2 * ARC / (SLOTS - 1), DUMP_SPREAD = 1.7;
  const slotAngle = i => -ARC + i * SLOT_W;
  /** Arm angle at time t (seconds of swinging). */
  const armAngle = t => ARC * Math.sin(2 * Math.PI * t / SWING);
  const mouthW = (theta, i) => Math.max(0, 1 - Math.abs(theta - slotAngle(i)) / (MOUTH * SLOT_W));
  /** Rolls under the scoop mouth at θ (weighted). */
  function under(pile, theta) { let s = 0; for (let i = 0; i < SLOTS; i++) s += pile[i] * mouthW(theta, i); return s; }
  const quality = (pile, theta) => Math.min(1, under(pile, theta) / FULL);
  const fill = q => 1 - Math.pow(1 - Math.max(0, Math.min(1, q)), 2);
  /** Angle where the heap is tallest (for the demo, the bot and the timing bar). */
  function bestAngle(pile) { let best = 0, bq = -1; for (let k = 0; k <= 200; k++) { const th = -ARC + 2 * ARC * k / 200, q = under(pile, th); if (q > bq + 1e-9) { bq = q; best = th; } } return best; }

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /** Seeded random kept in a plain number so a machine can be saved and reloaded mid-stream. */
  function rnd(M) { M.s = (M.s + 0x6D2B79F5) >>> 0; let t = M.s; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  const gauss = M => { let u = 0, v = 0; while (u === 0) u = rnd(M); v = rnd(M); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  function drawKind(M) { let x = rnd(M) * W_TOTAL; for (const r of ROLLS) { x -= r.w; if (x < 0) return r.id; } return ROLLS[0].id; }

  /** Drop `n` rolls into the bin around one random spot (the hopper). Returns the slots that got a roll. */
  function hopper(M, n) {
    const c = 1 + rnd(M) * (SLOTS - 3), got = [];
    for (let k = 0; k < n; k++) { const i = Math.max(0, Math.min(SLOTS - 1, Math.round(c + gauss(M) * 1.3))); M.pile[i]++; got.push(i); }
    return { center: c, slots: got };
  }
  const pileTotal = M => M.pile.reduce((a, b) => a + b, 0);
  /** The hopper tops the bin up in batches of BATCH rolls, each batch at one new random spot (a fresh heap). */
  function refill(M) {
    const out = { center: null, slots: [] };
    while (PILE_N - pileTotal(M) >= BATCH) { const h = hopper(M, BATCH); out.center = h.center; out.slots.push(...h.slots); }
    return out;
  }

  /** Scoop at angle θ with scoop size `tier`. Mutates the bin. Returns { q, n, kinds, took: [slot per roll] }. */
  function scoop(M, theta, tierId) {
    const t = TIER[tierId] || TIERS[0];
    theta = Math.max(-ARC, Math.min(ARC, theta));
    const q = quality(M.pile, theta);
    let n = Math.max(0, Math.min(t.cap, Math.floor(t.cap * fill(q) + rnd(M))));   // stochastic rounding: E[n] = cap · fill(q)
    const took = [];
    for (let k = 0; k < n; k++) {
      let bi = -1, bw = 0;
      for (let i = 0; i < SLOTS; i++) { const w = M.pile[i] * mouthW(theta, i); if (w > bw + 1e-9) { bw = w; bi = i; } }
      if (bi < 0) break;
      M.pile[bi]--; took.push(bi);
    }
    n = took.length;
    const kinds = took.map(() => drawKind(M));
    M.scoops++;
    return { q, n, kinds, took, theta };
  }
  /** Where the scoop tips each roll on the shelf (x), spread around the middle. */
  function dumpX(M, n) { const out = []; for (let i = 0; i < n; i++) out.push((rnd(M) * 2 - 1) * DUMP_SPREAD); return out; }

  // ------------------------------------------------------------------ shelf physics (adapted copy of js/pusher-sim.js)
  const R_ROLL = 0.42;
  class Shelf {
    constructor(opts = {}) {
      this.W = opts.W || 3.4;            // half width
      this.FRONT = opts.FRONT || 6.6;    // front edge
      this.PZ_MIN = opts.PZ_MIN || 1.0;  // pusher face range
      this.PZ_MAX = opts.PZ_MAX || 2.6;
      this.PERIOD = opts.PERIOD || 3.0;  // seconds per push
      this.DROP_Z = opts.DROP_Z || 1.7;  // where the scoop tips its rolls
      this.GUTTER = opts.GUTTER || 1.22;  // corners that lead back into the bin
      this.H = opts.H || 1 / 60;         // physics step
      this.rand = mulberry32(opts.seed || 7);
      this.items = []; this.events = []; this.t = opts.t || 0; this.nextId = 1;
      this.pz = this.pusherZ(this.t);
    }
    pusherZ(t) { return this.PZ_MIN + (this.PZ_MAX - this.PZ_MIN) * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / this.PERIOD)); }
    add(kind, x, z, extra = {}) {
      const gold = BY_ID[kind] && BY_ID[kind].gold;
      const it = Object.assign({ id: this.nextId++, kind, x, z, r: gold ? R_ROLL * 1.08 : R_ROLL, m: gold ? 1.3 : 1, state: 'field', y: 0, t: 0, rot: this.rand() * Math.PI * 2 }, extra);
      this.items.push(it); return it;
    }
    /** A roll tipped out of the scoop at x (falls from height y). */
    drop(x, kind, y = 1.6) { x = Math.max(-this.W + R_ROLL, Math.min(this.W - R_ROLL, x)); return this.add(kind, x, this.DROP_Z + (this.rand() - 0.5) * 0.3, { state: 'drop', y, vy: 0 }); }
    step(dt) { const sub = Math.max(1, Math.ceil(dt / this.H - 1e-9)); for (let i = 0; i < sub; i++) this._step(dt / sub); }
    _step(dt) {
      this.t += dt;
      const prev = this.pz; this.pz = this.pusherZ(this.t); const dpz = this.pz - prev;
      const field = [], shelf = [];
      for (const it of this.items) {
        if (it.state === 'drop') {
          it.vy -= 22 * dt; it.y += it.vy * dt;
          if (it.y <= 0) {
            it.y = 0;
            if (this.pz > it.z + it.r * 0.6) it.state = 'shelf';
            else { it.state = 'field'; it.z = Math.max(it.z, this.pz + it.r + 0.01); }
            this.events.push({ type: 'land', kind: it.kind, id: it.id, x: it.x, shelf: it.state === 'shelf' });
          }
        } else if (it.state === 'shelf') {
          it.z += dpz;
          if (it.z - it.r < 0) it.z = it.r;
          if (it.z > this.pz - it.r * 0.3) { it.state = 'field'; it.z = this.pz + it.r + 0.01; it.y = 0; }
          else shelf.push(it);
        } else if (it.state === 'field') field.push(it);
        else if (it.state === 'fall') {
          it.t += dt; it.vy -= 22 * dt; it.y += it.vy * dt; it.z += it.vz * dt; it.x += it.vx * dt;
          if (it.t > 0.7) it.state = 'gone';
        }
      }
      this._solve(field, true);
      this._solve(shelf, false);
      for (const it of field) {
        if (it.z > this.FRONT + it.r * 0.15) {
          const win = Math.abs(it.x) < this.W - this.GUTTER;
          it.state = 'fall'; it.t = 0; it.vy = 0.5; it.vz = 2.2; it.vx = win ? 0 : Math.sign(it.x) * 1.5;
          this.events.push({ type: win ? 'win' : 'lost', kind: it.kind, id: it.id, x: it.x, value: win ? BY_ID[it.kind].value : 0 });
        }
      }
      if (this.items.length > 40 && this.items.some(i => i.state === 'gone')) this.items = this.items.filter(i => i.state !== 'gone');
    }
    _solve(list, isField) {
      const W = this.W, cell = 1.0, grid = new Map(), key = (cx, cz) => cx * 1000 + cz;
      for (let iter = 0; iter < 6; iter++) {
        grid.clear();
        for (const it of list) { const k = key(Math.floor(it.x / cell), Math.floor(it.z / cell)); let g = grid.get(k); if (!g) grid.set(k, g = []); g.push(it); }
        for (const a of list) {
          const cx = Math.floor(a.x / cell), cz = Math.floor(a.z / cell);
          for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            const g = grid.get(key(cx + dx, cz + dz)); if (!g) continue;
            for (const b of g) {
              if (b.id <= a.id) continue;
              let ex = b.x - a.x, ez = b.z - a.z; const d2 = ex * ex + ez * ez, rr = a.r + b.r;
              if (d2 >= rr * rr) continue;
              let d = Math.sqrt(d2); if (d < 1e-6) { ex = this.rand() - .5; ez = .01; d = Math.hypot(ex, ez); }
              const pen = rr - d, wa = 1 / a.m, wb = 1 / b.m, s = pen / (wa + wb) / d;
              a.x -= ex * s * wa; a.z -= ez * s * wa; b.x += ex * s * wb; b.z += ez * s * wb;
            }
          }
        }
        for (const it of list) {
          if (it.x < -W + it.r) it.x = -W + it.r; else if (it.x > W - it.r) it.x = W - it.r;
          if (isField) { if (it.z < this.pz + it.r) it.z = this.pz + it.r; if (this._settling && it.z > this.FRONT - it.r * .5) it.z = this.FRONT - it.r * .5; }
          else { if (it.z < it.r) it.z = it.r; if (it.z > this.pz - it.r * 0.3) it.z = this.pz - it.r * 0.3; }
        }
      }
    }
    live() { return this.items.filter(i => i.state === 'field' || i.state === 'shelf' || i.state === 'drop'); }
    /** How crowded the front edge is (0..1). */
    edgeFill() { const band = this.items.filter(i => i.state === 'field' && i.z > this.FRONT - 1.3); return Math.min(1, band.reduce((s, i) => s + i.r * 2, 0) / (2 * this.W)); }
    takeEvents() { const e = this.events; this.events = []; return e; }
    settle(sec = 1) {
      const t0 = this.t, pz0 = this.pusherZ(t0), f = this.pusherZ; this.pusherZ = () => pz0; this._settling = true;
      for (let i = 0; i < sec * 60; i++) this._step(1 / 60);
      this.pusherZ = f; this.t = t0; this.pz = pz0; this.events = []; this._settling = false;
    }
  }

  // ------------------------------------------------------------------ machine
  /** A new machine. A fresh shelf already holds a layer of rolls (like a machine just switched on). */
  function create(opts = {}) {
    const M = { s: (opts.seed || 20261023) >>> 0, pile: new Array(SLOTS).fill(0), scoops: 0 };
    M.shelf = new Shelf({ seed: (opts.seed || 1) + 11, H: opts.H });
    hopper(M, PILE_N / 2); hopper(M, PILE_N - pileTotal(M));
    if (opts.empty) return M;
    const sh = M.shelf, zFrom = sh.PZ_MAX + R_ROLL, zTo = sh.FRONT - 0.55, n = opts.fill != null ? opts.fill : 26;
    const free = (x, z) => sh.items.every(o => Math.hypot(o.x - x, o.z - z) > o.r + R_ROLL * .9);
    for (let i = 0, tries = 0; i < n && tries < n * 40; tries++) { const x = -sh.W + R_ROLL + rnd(M) * (2 * sh.W - 2 * R_ROLL), z = zFrom + rnd(M) * (zTo - zFrom); if (free(x, z)) { sh.add(drawKind(M), x, z); i++; } }
    for (let i = 0; i < 5; i++) sh.add(drawKind(M), -sh.W + 1 + rnd(M) * (2 * sh.W - 2), 0.5 + rnd(M) * (sh.PZ_MIN - 0.6), { state: 'shelf' });
    sh.settle(1.2);
    // run the machine in for a while (the house's own scoops) so the pile reaches the front edge like a machine in use
    const warm = opts.warm != null ? opts.warm : 24;
    for (let k = 0; k < warm; k++) { for (const x of dumpX(M, 4)) sh.drop(x, drawKind(M)); sh.step(3); }
    sh.items = sh.items.filter(i => i.state === 'field' || i.state === 'shelf'); sh.events = [];
    return M;
  }
  /** Value of everything still on the shelf (it pays out sooner or later). */
  const shelfValue = M => M.shelf.live().reduce((s, i) => s + BY_ID[i.kind].value, 0);
  function save(M) {
    return { v: 1, s: M.s, pile: M.pile.slice(), scoops: M.scoops, t: +M.shelf.t.toFixed(3),
      items: M.shelf.live().map(i => [i.kind, +i.x.toFixed(3), +(i.state === 'drop' ? M.shelf.DROP_Z : i.z).toFixed(3), i.state === 'shelf' ? 1 : 0, +i.rot.toFixed(2)]) };
  }
  function load(o, opts = {}) {
    if (!o || o.v !== 1 || !Array.isArray(o.pile) || o.pile.length !== SLOTS) return null;
    const M = { s: o.s >>> 0, pile: o.pile.map(n => Math.max(0, n | 0)), scoops: o.scoops | 0 };
    M.shelf = new Shelf({ seed: 7, H: opts.H, t: o.t || 0 });
    for (const [kind, x, z, sh, rot] of o.items || []) if (BY_ID[kind]) M.shelf.add(kind, x, z, { state: sh ? 'shelf' : 'field', rot });
    M.shelf.settle(1);
    return M;
  }

  // ------------------------------------------------------------------ long-run simulation (tests + balance checks)
  /** Press timing of a simulated player: perfect = always at the tallest heap; good / typical = that, plus a timing error
   *  (σ in seconds, turned into an angle error by the arm speed there); random = presses at a random moment. */
  const PLAYERS = { perfect: 0, good: 0.06, typical: 0.12, sloppy: 0.22 };
  function pressAngle(M, player) {
    if (player === 'random') return armAngle(rnd(M) * SWING);
    const best = bestAngle(M.pile), sigma = PLAYERS[player] || 0;
    if (!sigma) return best;
    // arm speed at that angle: dθ/dt = ARC·ω·cos(phase)
    const ph = Math.asin(Math.max(-1, Math.min(1, best / ARC))), speed = ARC * 2 * Math.PI / SWING * Math.abs(Math.cos(ph));
    return Math.max(-ARC, Math.min(ARC, best + gauss(M) * sigma * Math.max(.25, speed)));
  }
  /** Play `scoops` scoops, `cycle` seconds of pushing each. Returns money in/out (warm-up excluded). */
  function simulate(opts = {}) {
    const M = create({ seed: opts.seed || 1, H: opts.H || 1 / 30 }), tier = TIER[opts.tier || 'vua'], cycle = opts.cycle || 3, warm = opts.warm == null ? 150 : opts.warm;
    let spent = 0, paid = 0, lost = 0, scooped = 0, won = 0, qSum = 0, gold = 0, bigWin = 0;
    const byKind = {};
    for (let k = 0; k < warm + opts.scoops; k++) {
      const count = k >= warm;
      const res = scoop(M, pressAngle(M, opts.player || 'perfect'), tier.id);
      dumpX(M, res.n).forEach((x, i) => M.shelf.drop(x, res.kinds[i]));
      refill(M);
      M.shelf.step(cycle);
      const ev = M.shelf.takeEvents();
      if (!count) continue;
      spent += tier.price; scooped += res.n; qSum += res.q;
      let round = 0;
      for (const e of ev) { if (e.type === 'win') { paid += e.value; round += e.value; won++; byKind[e.kind] = (byKind[e.kind] || 0) + 1; if (e.kind === 'r500') gold++; } else if (e.type === 'lost') lost++; }
      bigWin = Math.max(bigWin, round);
    }
    return { scoops: opts.scoops, spent, paid, rtp: paid / spent, scooped, won, lost, avgQ: qSum / opts.scoops, perScoop: scooped / opts.scoops, gold, bigWin, byKind, shelf: M.shelf.live().length, M };
  }

  /** The bin alone (no shelf physics): how many rolls a player style gets per scoop. Fast enough for 100k scoops. */
  function binStats(opts = {}) {
    const M = create({ seed: opts.seed || 1, empty: true }), tier = TIER[opts.tier || 'vua'], n = opts.scoops || 20000;
    let rolls = 0, q = 0, zero = 0, full = 0;
    for (let k = 0; k < n; k++) { const r = scoop(M, pressAngle(M, opts.player || 'perfect'), tier.id); refill(M); rolls += r.n; q += r.q; if (!r.n) zero++; if (r.n === tier.cap) full++; }
    return { scoops: n, perScoop: rolls / n, fillRate: rolls / n / tier.cap, avgQ: q / n, zero: zero / n, full: full / n };
  }

  return { ROLLS, BY_ID, TIERS, TIER, PER_ROLL, AVG_VALUE, W_TOTAL, SLOTS, ARC, SWING, PILE_N, BATCH, FULL, MOUTH, SLOT_W, R_ROLL, DUMP_SPREAD,
    slotAngle, armAngle, under, quality, fill, bestAngle, scoop, dumpX, hopper, refill, pileTotal, drawKind, rnd, mulberry32,
    Shelf, create, save, load, shelfValue, simulate, binStats, pressAngle, PLAYERS };
});
