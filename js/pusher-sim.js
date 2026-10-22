/*
 * Coin pusher simulation (no DOM, no three.js) — used by pusher.html and tests/pusher.test.js.
 *
 * Top-down 2D: x is left/right (−W..W), z grows towards the player. The back wall is at z = 0,
 * the moving pusher's front face sweeps between PZ_MIN and PZ_MAX, the playfield ends at FRONT.
 * Things pushed past FRONT fall into the prize tray (win) or, near the corners, into the side chutes (lost).
 * Coins dropped while the pusher is forward land on its top shelf; the back wall scrapes them off when it retracts.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PusherSim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KINDS = {
    coin: { r: 0.42, m: 1 },
    ticket: { r: 0.62, m: 2.4 },   // a roll of tickets lying across the field
    card: { r: 0.55, m: 1.8 },     // a gem card
    star: { r: 0.5, m: 1.5 },      // bonus: drops free coins
    gem: { r: 0.5, m: 1.5 },       // diamonds
    pig: { r: 0.78, m: 4 },        // golden pig jackpot
  };
  const PRIZE = { coin: { coins: 1 }, ticket: { tickets: 20 }, card: { tickets: 60 }, star: { free: 3, tickets: 5 }, gem: { gems: 5, tickets: 10 }, pig: { tickets: 300, free: 12 } };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  class Sim {
    constructor(opts = {}) {
      this.W = opts.W || 4.6;            // half width of the playfield
      this.FRONT = opts.FRONT || 9.2;    // front edge
      this.PZ_MIN = opts.PZ_MIN || 1.3;  // pusher face range
      this.PZ_MAX = opts.PZ_MAX || 3.7;
      this.PERIOD = opts.PERIOD || 3.2;  // seconds per push
      this.DROP_Z = opts.DROP_Z || 2.0;  // where the chute drops coins
      this.GUTTER = opts.GUTTER || 0.95; // corners that lead to the side chutes
      this.rand = mulberry32(opts.seed || 7);
      this.items = []; this.events = []; this.t = opts.t || 0; this.nextId = 1;
      this.pz = this.pusherZ(this.t);
      this.lucky = 0; // lucky lane x (moves slowly)
    }
    pusherZ(t) { return this.PZ_MIN + (this.PZ_MAX - this.PZ_MIN) * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / this.PERIOD)); }
    /** 0 = fully back, 1 = fully forward; moving > 0 while advancing. */
    phase() { const k = (this.pz - this.PZ_MIN) / (this.PZ_MAX - this.PZ_MIN); return { k, advancing: Math.sin(2 * Math.PI * this.t / this.PERIOD) > 0 }; }
    add(kind, x, z, extra = {}) {
      const K = KINDS[kind];
      const it = Object.assign({ id: this.nextId++, kind, x, z, r: K.r, m: K.m, state: 'field', y: 0, t: 0, rot: this.rand() * Math.PI * 2 }, extra);
      this.items.push(it); return it;
    }
    /** Drop from the chute at x. Returns the falling item. */
    drop(x, kind = 'coin') {
      const K = KINDS[kind];
      x = Math.max(-this.W + K.r, Math.min(this.W - K.r, x));
      const lucky = kind === 'coin' && Math.abs(x - this.lucky) < 0.45;
      return this.add(kind, x + (this.rand() - 0.5) * 0.08, this.DROP_Z, { state: 'drop', y: 4.2, vy: 0, lucky });
    }
    step(dt) {
      const sub = Math.max(1, Math.ceil(dt / (1 / 60)));
      for (let i = 0; i < sub; i++) this._step(dt / sub);
    }
    _step(dt) {
      this.t += dt;
      const prev = this.pz; this.pz = this.pusherZ(this.t); const dpz = this.pz - prev;
      this.lucky = Math.sin(this.t * 0.45) * (this.W - 1.1);
      const field = [], shelf = [];
      for (const it of this.items) {
        if (it.state === 'drop') {
          it.vy -= 22 * dt; it.y += it.vy * dt;
          if (it.y <= 0) {
            it.y = 0;
            if (this.pz > it.z + it.r * 0.6) { it.state = 'shelf'; }
            else { it.state = 'field'; it.z = Math.max(it.z, this.pz + it.r + 0.01); }
            this.events.push({ type: 'land', kind: it.kind, x: it.x, shelf: it.state === 'shelf', lucky: it.lucky, power: 1 - (it.z - this.PZ_MIN) / (this.PZ_MAX - this.PZ_MIN + 1e-9) });
          }
        } else if (it.state === 'shelf') {
          it.z += dpz;                                   // carried by the pusher
          if (it.z - it.r < 0) it.z = it.r;              // …unless the back wall holds it
          if (it.z > this.pz - it.r * 0.3) { it.state = 'field'; it.z = this.pz + it.r + 0.01; it.y = 0; }
          else shelf.push(it);
        } else if (it.state === 'field') field.push(it);
        else if (it.state === 'fall') {
          it.t += dt; it.vy -= 22 * dt; it.y += it.vy * dt; it.z += it.vz * dt; it.x += it.vx * dt;
          if (it.t > 0.7) { it.state = 'gone'; }
        }
      }
      // field: pusher face + walls + circle contacts, solved a few times
      this._solve(field, true);
      this._solve(shelf, false);
      // anything past the front edge falls
      for (const it of field) {
        if (it.z > this.FRONT + it.r * 0.15) {
          const win = Math.abs(it.x) < this.W - this.GUTTER;
          it.state = 'fall'; it.t = 0; it.vy = 0.5; it.vz = 2.2; it.vx = win ? 0 : Math.sign(it.x) * 1.5;
          this.events.push({ type: win ? 'win' : 'lost', kind: it.kind, x: it.x, prize: win ? PRIZE[it.kind] : null });
        }
      }
      if (this.items.length > 40 && this.items.some(i => i.state === 'gone')) this.items = this.items.filter(i => i.state !== 'gone');
    }
    _solve(list, isField) {
      const W = this.W, cell = 1.0, grid = new Map();
      const key = (cx, cz) => cx * 1000 + cz;
      for (let iter = 0; iter < 6; iter++) {
        grid.clear();
        for (const it of list) { const k = key(Math.floor(it.x / cell), Math.floor(it.z / cell)); let g = grid.get(k); if (!g) grid.set(k, g = []); g.push(it); }
        for (const a of list) {
          const cx = Math.floor(a.x / cell), cz = Math.floor(a.z / cell);
          for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            const g = grid.get(key(cx + dx, cz + dz)); if (!g) continue;
            for (const b of g) {
              if (b.id <= a.id) continue;
              let ex = b.x - a.x, ez = b.z - a.z, d2 = ex * ex + ez * ez; const rr = a.r + b.r;
              if (d2 >= rr * rr) continue;
              let d = Math.sqrt(d2); if (d < 1e-6) { ex = this.rand() - .5; ez = .01; d = Math.hypot(ex, ez); }
              const pen = (rr - d), wa = 1 / a.m, wb = 1 / b.m, s = pen / (wa + wb) / d;
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
    /** How close the pile is to the edge (0..1) — shown on the machine cards. */
    edgeFill() {
      const band = this.items.filter(i => i.state === 'field' && i.z > this.FRONT - 1.4);
      return Math.min(1, band.reduce((s, i) => s + i.r * 2, 0) / (2 * this.W));
    }
    takeEvents() { const e = this.events; this.events = []; return e; }
    save() { return { t: +this.t.toFixed(3), items: this.items.filter(i => i.state === 'field' || i.state === 'shelf').map(i => [i.kind, +i.x.toFixed(3), +i.z.toFixed(3), i.state === 'shelf' ? 1 : 0, +i.rot.toFixed(2)]) }; }
    load(s) {
      this.items = []; this.t = s.t || 0; this.pz = this.pusherZ(this.t);
      for (const [kind, x, z, sh, rot] of s.items || []) if (KINDS[kind]) this.add(kind, x, z, { state: sh ? 'shelf' : 'field', rot });
      this.settle(1.2);
    }
    /** Run the physics without the pusher moving, so a new layout starts without overlaps. */
    settle(sec = 1) {
      const t0 = this.t, pz0 = this.pusherZ(t0), f = this.pusherZ; this.pusherZ = () => pz0; this._settling = true;
      for (let i = 0; i < sec * 60; i++) this._step(1 / 60);
      this.pusherZ = f; this.t = t0; this.pz = pz0; this.events = []; this._settling = false;
    }
    /** Fill a machine. preset: 'fresh' (pile far back), 'hot' (someone just played: pile at the edge, tickets on the sides), 'rich' (prizes everywhere). */
    fill(preset) {
      const W = this.W, r = KINDS.coin.r;
      const zFrom = this.PZ_MAX + r, zTo = preset === 'fresh' ? this.FRONT - 2.6 : this.FRONT - 0.25;
      const cap = (zTo - zFrom) * 2 * W / (Math.PI * r * r);   // coins that fit in one layer
      const n = Math.round(cap * (preset === 'fresh' ? 0.7 : preset === 'hot' ? 0.8 : 0.7));
      const prizes = preset === 'fresh' ? [['ticket', 0, 5.6], ['card', -2.2, 5], ['ticket', 2.4, 5.2]]
        : preset === 'hot' ? [['ticket', -3.3, 8.55], ['ticket', 3.3, 8.6], ['card', -1.9, 8.2], ['star', 1.6, 7.9], ['ticket', 0.2, 6.6], ['gem', -0.9, 6.0]]
          : [['pig', 0, 7.2], ['ticket', -3, 7.8], ['ticket', 3.1, 7.7], ['card', -1.6, 6.3], ['card', 1.7, 6.2], ['gem', -3.4, 6.0], ['star', 3.3, 5.6], ['gem', 0.1, 5.2]];
      for (const [k, x, z] of prizes) this.add(k, x, z);
      const free = (x, z) => this.items.every(o => Math.hypot(o.x - x, o.z - z) > o.r + r * 0.55);
      for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) { const x = -W + r + this.rand() * (2 * W - 2 * r), z = zFrom + this.rand() * (zTo - zFrom); if (free(x, z)) { this.add('coin', x, z); i++; } }
      for (let i = 0; i < 8; i++) this.add('coin', -W + 1 + this.rand() * (2 * W - 2), 0.5 + this.rand() * (this.PZ_MIN - 0.6), { state: 'shelf' });
      this.settle(1.5);
    }
  }
  return { Sim, KINDS, PRIZE, mulberry32 };
});
