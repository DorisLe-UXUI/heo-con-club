/*
 * Coin pusher simulation (no DOM, no three.js) — used by pusher.html and tests/pusher.test.js.
 *
 * Top-down 2D: x is left/right (−W..W), z grows towards the player. The back wall is at z = 0,
 * the moving pusher's front face sweeps between PZ_MIN and PZ_MAX, the playfield ends at FRONT.
 * Things pushed past FRONT fall into the prize tray (win) or, near the corners, into the side chutes (lost).
 * Coins dropped while the pusher is forward land on its top shelf; the back wall scrapes them off when it retracts.
 *
 * Two layers:
 *   Sim  — the physics: coins, prizes, the pusher, the side chutes, plus the moving "ô may mắn" pocket on the
 *          pusher top (opt-in), the "Tường chắn" corner guides and the "Đẩy mạnh" longer stroke.
 *   Game — the arcade rules on top of one Sim: paid / free drops, prize payouts, the 3-reel slot fed by the pocket,
 *          the progressive "Hũ Heo Vàng" jackpot, card sets, Fever, prize restocking. Pure and seeded, so the page
 *          and the tests run exactly the same rules (the page only draws and plays sounds).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PusherSim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KINDS = {
    coin: { r: 0.42, m: 1 },
    ticket: { r: 0.62, m: 2.4 },   // a roll of tickets lying across the field
    card: { r: 0.55, m: 1.8 },     // a playing card (collect the sets)
    star: { r: 0.5, m: 1.5 },      // bonus: drops free coins
    gem: { r: 0.5, m: 1.5 },       // diamonds
    pig: { r: 0.78, m: 4 },        // golden pig
  };
  /** Physical prizes, tickets at the 1K machine (Game scales tickets by bet / 1000). */
  const PRIZE = { coin: { coins: 1 }, ticket: { tickets: 15 }, card: { tickets: 10 }, star: { free: 3, tickets: 5 }, gem: { gems: 5, tickets: 10 }, pig: { tickets: 300, free: 12 } };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  const WALL_LEN = 1.7;   // the corner guides run from (±W, FRONT − WALL_LEN) to the inner edge of the side chutes at FRONT

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
      this.extra = 0; this.extraTarget = 0;   // "Đẩy mạnh": extra stroke length, eased in and out
      this.walls = 0; this.wallsTarget = 0;   // "Tường chắn": 0 = down, 1 = fully up
      // "Ô may mắn": a cup on the pusher top, `lz` behind the pusher face, sliding left and right. A coin from the chute
      // that lands in it (centre within `catch`) drops through and Game turns it into a slot spin; coins sliding on the
      // shelf only bump into its rim (radius `rim`), so the pile resting at the back wall is not slowly eaten. The chute
      // drops at DROP_Z, so the cup lines up with it while pz ≈ DROP_Z − lz: drop with the pusher well forward.
      // Off unless opts.pocket, so plain Sim users keep every coin.
      this.pocket = { on: !!opts.pocket, open: true, x: 0, lz: -1.1, catch: 0.6, rim: 0.66, amp: 2.2, period: 7.3 };
      this.pz = this.pusherZ(this.t);
      this.lucky = 0; // lucky lane x (moves slowly)
      this.luckyRest = 0; this.LUCKY_REST = opts.LUCKY_REST != null ? opts.LUCKY_REST : 0;
    }
    stroke() { return this.PZ_MAX + this.extra; }
    pusherZ(t) { return this.PZ_MIN + (this.stroke() - this.PZ_MIN) * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / this.PERIOD)); }
    /** 0 = fully back, 1 = fully forward; moving > 0 while advancing. */
    phase() { const k = (this.pz - this.PZ_MIN) / (this.stroke() - this.PZ_MIN); return { k, advancing: Math.sin(2 * Math.PI * this.t / this.PERIOD) > 0 }; }
    add(kind, x, z, extra = {}) {
      const K = KINDS[kind];
      // every item gets the same fields in the same order: one hidden class keeps the solver loop fast
      const it = { id: this.nextId++, kind, x, z, r: K.r, m: K.m, state: 'field', y: 0, t: 0, rot: this.rand() * Math.PI * 2, vx: 0, vy: 0, vz: 0, lucky: false, free: false, card: null, dx: 0, dz: 0 };
      for (const k in extra) it[k] = extra[k];
      this.items.push(it); return it;
    }
    /** Drop from the chute at x. Returns the falling item. */
    drop(x, kind = 'coin', extra = {}) {
      const K = KINDS[kind];
      x = Math.max(-this.W + K.r, Math.min(this.W - K.r, x));
      // the lucky light pays once, then rests (dims) for a few seconds — otherwise tracking it with the mouse would pay every coin
      const lucky = kind === 'coin' && !extra.free && this.luckyRest <= 0 && Math.abs(x - this.lucky) < 0.45;
      if (lucky) this.luckyRest = this.LUCKY_REST;
      return this.add(kind, x + (this.rand() - 0.5) * 0.08, this.DROP_Z, Object.assign({ state: 'drop', y: 4.2, vy: 0, lucky }, extra));
    }
    /** Where the pocket is on the floor plan right now (world x, z). */
    pocketPos() { return { x: this.pocket.x, z: this.pz + this.pocket.lz }; }
    step(dt) {
      const sub = Math.max(1, Math.ceil(dt / (1 / 60)));
      for (let i = 0; i < sub; i++) this._step(dt / sub);
    }
    _step(dt) {
      this.t += dt;
      const ease = (v, to, rate) => v + Math.max(-rate * dt, Math.min(rate * dt, to - v));
      this.extra = ease(this.extra, this.extraTarget, 0.6);
      this.walls = ease(this.walls, this.wallsTarget, 2.5);
      const prev = this.pz; this.pz = this.pusherZ(this.t); const dpz = this.pz - prev;
      this.lucky = Math.sin(this.t * 0.45) * (this.W - 1.1);
      if (this.luckyRest > 0) this.luckyRest -= dt;
      this.pocket.x = Math.sin(this.t * 2 * Math.PI / this.pocket.period) * this.pocket.amp;
      const field = [], shelf = [];
      for (const it of this.items) {
        if (it.state === 'drop') {
          it.vy -= 22 * dt; it.y += it.vy * dt;
          if (it.y <= 0) {
            it.y = 0;
            const P = this.pocket;
            // prizes always land in front of the pusher: on the shelf they would sit against the back wall for good
            if (it.kind === 'coin' && this.pz > it.z + it.r * 0.6) { it.state = 'shelf'; }
            else { it.state = 'field'; it.z = Math.max(it.z, this.pz + it.r + 0.01); }
            if (it.state === 'shelf' && it.kind === 'coin' && P.on && P.open && Math.hypot(it.x - P.x, it.z - (this.pz + P.lz)) < P.catch) {
              it.state = 'pocket'; it.t = 0; it.dx = it.x - P.x; it.dz = it.z - (this.pz + P.lz);
              this.events.push({ type: 'pocket', x: it.x }); continue;
            }
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
        } else if (it.state === 'pocket') {            // sinking into the pocket, follows it
          it.t += dt; it.x = this.pocket.x + it.dx * Math.max(0, 1 - it.t * 4); it.z = this.pz + this.pocket.lz + it.dz * Math.max(0, 1 - it.t * 4); it.y = -Math.min(0.6, it.t * it.t * 6);
          if (it.t > 0.45) it.state = 'gone';
        }
      }
      // field: pusher face + walls + circle contacts, solved a few times
      this._solve(field, true);
      this._solve(shelf, false);
      // anything past the front edge falls
      for (const it of field) {
        if (it.z > this.FRONT + it.r * 0.15) {
          const win = this.walls > 0.5 || Math.abs(it.x) < this.W - this.GUTTER;
          it.state = 'fall'; it.t = 0; it.vy = 0.5; it.vz = 2.2; it.vx = win ? 0 : Math.sign(it.x) * 1.5;
          this.events.push({ type: win ? 'win' : 'lost', kind: it.kind, x: it.x, prize: win ? PRIZE[it.kind] : null, card: it.card });
        }
      }
      if (this.items.length > 40 && this.items.some(i => i.state === 'gone')) this.items = this.items.filter(i => i.state !== 'gone');
    }
    _solve(list, isField) {
      // Position-based contacts on flat arrays with a 1×1 cell grid (linked lists in typed arrays): this loop is the hot
      // spot of every frame and test, and plain objects + Map made it ~10× slower. Pairs are visited in list order, as before.
      const n = list.length; if (!n) return;
      const GX = 16, GZ = 16, OX = 8, OZ = 3, W = this.W;
      let B = this._buf;
      if (!B || B.cap < n) { const cap = Math.max(128, n * 2); B = this._buf = { cap, x: new Float64Array(cap), z: new Float64Array(cap), r: new Float64Array(cap), w: new Float64Array(cap), next: new Int32Array(cap), head: new Int32Array(GX * GZ) }; }
      const X = B.x, Z = B.z, R = B.r, IM = B.w, next = B.next, head = B.head;
      for (let i = 0; i < n; i++) { const it = list[i]; X[i] = it.x; Z[i] = it.z; R[i] = it.r; IM[i] = 1 / it.m; }
      const cellX = x => { const c = Math.floor(x) + OX; return c < 0 ? 0 : c >= GX ? GX - 1 : c; }, cellZ = z => { const c = Math.floor(z) + OZ; return c < 0 ? 0 : c >= GZ ? GZ - 1 : c; };
      // corner guides ("Tường chắn"): inward normal of the right-hand guide; the left one is its mirror image
      const gx = this.GUTTER + 0.05, gl = Math.hypot(WALL_LEN, gx), nx = -WALL_LEN / gl, nz = -gx / gl, zA = this.FRONT - WALL_LEN;
      const guides = isField && this.walls > 0.05, pz = this.pz, front = this.FRONT, settling = this._settling;
      const cup = !isField && this.pocket.on, cupX = this.pocket.x, cupZ = pz + this.pocket.lz, cupR = this.pocket.rim;
      for (let iter = 0; iter < 6; iter++) {
        head.fill(-1);
        for (let i = n - 1; i >= 0; i--) { const c = cellX(X[i]) + GX * cellZ(Z[i]); next[i] = head[c]; head[c] = i; }
        for (let a = 0; a < n; a++) {
          const cx = cellX(X[a]), cz = cellZ(Z[a]);
          for (let dx = -1; dx <= 1; dx++) {
            const x2 = cx + dx; if (x2 < 0 || x2 >= GX) continue;
            for (let dz = -1; dz <= 1; dz++) {
              const z2 = cz + dz; if (z2 < 0 || z2 >= GZ) continue;
              for (let b = head[x2 + GX * z2]; b !== -1; b = next[b]) {
                if (b <= a) continue;
                let ex = X[b] - X[a], ez = Z[b] - Z[a]; const d2 = ex * ex + ez * ez, rr = R[a] + R[b];
                if (d2 >= rr * rr) continue;
                let d = Math.sqrt(d2); if (d < 1e-6) { ex = this.rand() - .5; ez = .01; d = Math.hypot(ex, ez); }
                const wa = IM[a], wb = IM[b], s = (rr - d) / (wa + wb) / d;
                X[a] -= ex * s * wa; Z[a] -= ez * s * wa; X[b] += ex * s * wb; Z[b] += ez * s * wb;
              }
            }
          }
        }
        for (let i = 0; i < n; i++) {
          const r = R[i];
          if (guides && Z[i] > zA - r) {
            const sx = X[i] < 0 ? -1 : 1, d = (Math.abs(X[i]) - W) * nx + (Z[i] - zA) * nz, need = r - d;
            if (need > 0) { const k = Math.min(need, 0.05); X[i] += sx * nx * k; Z[i] += nz * k; }   // a rising wall sweeps coins in gently
          }
          if (X[i] < -W + r) X[i] = -W + r; else if (X[i] > W - r) X[i] = W - r;
          if (isField) { if (Z[i] < pz + r) Z[i] = pz + r; if (settling && Z[i] > front - r * .5) Z[i] = front - r * .5; }
          else {
            if (cup) { const ex = X[i] - cupX, ez = Z[i] - cupZ, d = Math.hypot(ex, ez), need = cupR + r - d; if (need > 0 && d > 1e-6) { X[i] += ex / d * need; Z[i] += ez / d * need; } }
            if (Z[i] < r) Z[i] = r; if (Z[i] > pz - r * 0.3) Z[i] = pz - r * 0.3;
          }
        }
      }
      for (let i = 0; i < n; i++) { list[i].x = X[i]; list[i].z = Z[i]; }
    }
    /** How close the pile is to the edge (0..1) — shown on the machine cards. */
    edgeFill() {
      const band = this.items.filter(i => i.state === 'field' && i.z > this.FRONT - 1.4);
      return Math.min(1, band.reduce((s, i) => s + i.r * 2, 0) / (2 * this.W));
    }
    takeEvents() { const e = this.events; this.events = []; return e; }
    save() { return { t: +this.t.toFixed(3), items: this.items.filter(i => i.state === 'field' || i.state === 'shelf').map(i => { const a = [i.kind, +i.x.toFixed(3), +i.z.toFixed(3), i.state === 'shelf' ? 1 : 0, +i.rot.toFixed(2)]; if (i.card) a.push(i.card); return a; }) }; }
    load(s) {
      this.items = []; this.t = s.t || 0; this.pz = this.pusherZ(this.t);
      for (const [kind, x, z, sh, rot, card] of s.items || []) if (KINDS[kind]) this.add(kind, x, z, card ? { state: sh ? 'shelf' : 'field', rot, card } : { state: sh ? 'shelf' : 'field', rot });
      this.settle(1.2);
    }
    /** Run the physics without the pusher moving, so a new layout starts without overlaps. */
    settle(sec = 1) {
      const t0 = this.t, pz0 = this.pusherZ(t0), f = this.pusherZ, on = this.pocket.on; this.pusherZ = () => pz0; this._settling = true; this.pocket.on = false;
      for (let i = 0; i < sec * 60; i++) this._step(1 / 60);
      this.pusherZ = f; this.t = t0; this.pz = pz0; this.events = []; this._settling = false; this.pocket.on = on;
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

  // =====================================================================================================================
  // Game rules
  // =====================================================================================================================
  /*
   * Economy — everything is counted in "coins" = one bet on this machine (1K / 5K / 20K xu). A ticket is worth 500 xu,
   * so ticket amounts are written for the 1K machine and multiplied by bet / 1000: every machine pays back the same
   * share of what it takes, only the stake differs.
   *
   * Where the value of a paid coin goes (long auto-drop sessions, measured with the Game below):
   *  • The pile. In the long run every coin that enters the field leaves it again: ~80 % into the tray, ~20 % into the
   *    corner chutes — that is the house edge. The lucky light pays +1 free coin and then rests LUCKY_REST seconds, so
   *    it adds ~4 % however you aim (without the rest, following it with the mouse paid on every single drop).
   *  • The pocket. A coin caught by the cup never reaches the pile; it buys one slot spin instead. Random drops send
   *    ~5 % of the coins there, a player who aims at the cup with the pusher forward ~25 %. So a spin must be worth
   *    about what that coin would have earned on the field (~0.8 coin), or hunting the cup would be a money printer:
   *        Mưa xu     2.5 % × 8 free coins × ~0.8 (they still go through the pile)   ≈ 0.16
   *        Vé         3.5 % × 8 vé = 4 coins                                         ≈ 0.14
   *        Thẻ bài    3.5 % × ~4.5 coins (a set pays 25–35 coins per ~6.5 cards)    ≈ 0.16
   *        Tường      2.5 % × ~5 coins kept out of the chutes in 20 s                ≈ 0.13
   *        Đẩy mạnh   3 %   × ~0 (empties the pile now, it fills up again later)     — pure show
   *        Jackpot    0.2 % × (seed 40 + 12 rain coins)                              ≈ 0.10  (the pool's growth is paid on top, below)
   *        Fever      every win lights 1 of 6 lamps; 10 s of ×2 coins ≈ +15 coins    ≈ 0.1–0.3 (more for quick win streaks)
   *      ≈ 0.75–0.95 per spin, so the cup is a different way to play, not a better one; the slot adds swing and show.
   *  • Prizes. One drops in every PRIZE_EVERY paid coins. Not "one per prize won": once a prize reaches the front it
   *    always falls out, so the drop-in rate IS the payout rate (≈ 7 coins of tickets each → ~5 %). Cards also feed the sets.
   *  • Hũ Heo Vàng: JP_RATE of every paid coin, all of it paid back when the pool pops.
   * Measured (coins back + tickets at 500 xu + pool growth) / coins paid, seeds 1–6: auto-drop 93.8 % (91–97 %) on a
   * played machine, 91.6 % on a fresh one; cup hunter 95.5 %; corners + timing 93.6 %; always-centre 98.0 % (the centre
   * loses fewer coins to the chutes). Machines preset with prizes (Máy Kim Cương's Heo Vàng) pay more until those are gone.
   * Free coins (stars, rain, lucky light) are machine money: they show up as coins won, not as coins spent.
   */
  const CFG = {
    LUCKY_FREE: 1,       // free coins for hitting the moving light on the back wall…
    LUCKY_REST: 12,      // …which then rests this many seconds
    JP_SEED: 40,         // Hũ Heo Vàng restarts at 40 coins after it pops…
    JP_RATE: 0.012,      // …and grows by 1.2 % of every paid coin
    JP_RAIN: 12,         // and a jackpot also rains this many free coins onto the field
    STOCK_MAX: 10,       // pending spins; the pocket closes while the stock is full
    SPIN_STOPS: [1.05, 1.5, 1.95],   // seconds until each reel stops
    REACH_EXTRA: 1.5,    // the third reel spins this much longer when the first two match ("REACH!")
    SPIN_SHOW: 0.85,     // result stays on screen before the next spin starts
    SHOWER: 8,           // "Mưa xu": free coins
    TICKET_BONUS: 8,     // "Vé": tickets (× bet / 1000)
    DUP_TICKETS: 4,      // a card you already have in every set it belongs to: tickets instead (× bet / 1000)
    WALL_T: 20,          // "Tường chắn" seconds
    PUSH_T: 20,          // "Đẩy mạnh" seconds
    PUSH_EXTRA: 1.0,     // longer stroke while "Đẩy mạnh"
    FEVER_T: 10,         // Fever seconds: every coin that drops into the tray pays double
    LAMPS: 6,            // Fever meter: every win (slot win, prize, set) lights one lamp; all lit → Fever…
    LAMP_DECAY: 45,      // …but with no new win for this long one lamp goes out (so: several wins in a short time)
    FEVER_COOL: 30,      // no new lamps for this long after a Fever ends
    PRIZE_EVERY: 130,    // a new prize drops in from the chute every this many paid coins…
    PRIZE_MAX: 8,        // …while the machine holds fewer prizes than this
    FREE_EVERY: 0.15,    // free coins drop this fast
  };
  /** Slot outcomes per spin (the rest is a miss). Symbols: heo, xu, ve, bai, tuong, day. */
  const OUTCOMES = [
    { id: 'jackpot', sym: 'heo', p: 0.002 },
    { id: 'shower', sym: 'xu', p: 0.025 },
    { id: 'tickets', sym: 've', p: 0.035 },
    { id: 'card', sym: 'bai', p: 0.035 },
    { id: 'wall', sym: 'tuong', p: 0.025 },
    { id: 'push', sym: 'day', p: 0.03 },
  ];
  const SYMBOLS = ['heo', 'xu', 've', 'bai', 'tuong', 'day'];
  /** Cards that drop as prizes, and the sets they complete. A♥ counts for both sets. */
  const CARD_IDS = ['AS', 'AC', 'AD', 'AH', '10H', 'JH', 'QH', 'KH'];
  const SETS = [
    { id: 'aces', name: 'Tứ Quý Át', cards: ['AS', 'AC', 'AD', 'AH'], coins: 25 },
    { id: 'royal', name: 'Sảnh Cơ', cards: ['10H', 'JH', 'QH', 'KH', 'AH'], coins: 35 },
  ];
  const CARD_NAME = { AS: 'Át Bích', AC: 'Át Chuồn', AD: 'Át Rô', AH: 'Át Cơ', '10H': '10 Cơ', JH: 'J Cơ', QH: 'Q Cơ', KH: 'K Cơ' };
  const RESTOCK = ['ticket', 'ticket', 'card', 'card', 'card', 'star', 'gem'];

  class Game {
    /** opts: { bet, seed, preset | save } */
    constructor(opts = {}) {
      this.bet = opts.bet || 1000; this.tscale = this.bet / 1000;
      const seed = opts.seed || 1;
      this.rand = mulberry32(seed * 2654435761 >>> 0);
      this.sim = new Sim({ seed, pocket: true, LUCKY_REST: CFG.LUCKY_REST });
      this.t = 0;
      this.pool = CFG.JP_SEED; this.stock = 0; this.spin = null; this.reels = ['heo', 'xu', 've']; this.gap = 0;
      this.cards = {}; for (const s of SETS) this.cards[s.id] = [];
      this.lamps = 0; this.lampT = 0; this.feverT = 0; this.coolUntil = 0; this.wallT = 0; this.pushT = 0;
      this.freeQ = 0; this.freeT = 0; this.restock = []; this.topup = 0;
      this.out = []; this.forced = [];
      this.stats = { paid: 0, free: 0, coins: 0, tickets: 0, gems: 0, lucky: 0, pocket: 0, spins: 0, wins: {}, prizes: {}, lostPrizes: 0, sets: 0, setCoins: 0, jackpots: 0, jpCoins: 0, fevers: 0, feverCoins: 0, cards: 0, lost: 0 };
      if (opts.save) this.load(opts.save); else if (opts.preset) this.fill(opts.preset);
    }
    // ---------------------------------------------------------------- setup & saving
    fill(preset) { this.sim.fill(preset); this._cardIds(); }
    load(s) {
      this.sim.load(s); const g = s.g || {};
      if (typeof g.pool === 'number' && g.pool >= CFG.JP_SEED) this.pool = g.pool;
      if (g.stock) this.stock = Math.max(0, Math.min(CFG.STOCK_MAX, g.stock | 0));
      for (const st of SETS) this.cards[st.id] = ((g.cards || {})[st.id] || []).filter(c => st.cards.includes(c));
      this._cardIds();
    }
    save() { const s = this.sim.save(); s.g = { pool: +this.pool.toFixed(3), stock: this.stock + (this.spin && !this.spin.done ? 1 : 0), cards: JSON.parse(JSON.stringify(this.cards)) }; return s; }
    _cardIds() { for (const it of this.sim.items) if (it.kind === 'card' && !CARD_IDS.includes(it.card)) it.card = this.drawCard(); }
    /** Next card: half the time one that is still missing from a set (so sets finish in ~6–8 cards, not ~17). */
    drawCard() {
      const missing = CARD_IDS.filter(c => SETS.some(s => s.cards.includes(c) && !this.cards[s.id].includes(c)));
      const pool = missing.length && this.rand() < 0.5 ? missing : CARD_IDS;
      return pool[Math.floor(this.rand() * pool.length)];
    }
    tickets(n) { return Math.round(n * this.tscale); }
    // ---------------------------------------------------------------- input
    /** A paid coin from the chute at x. */
    drop(x) {
      this.stats.paid++; this.pool += CFG.JP_RATE;
      // prizes come in at a fixed rate per paid coin, not when one is won: the field always lets prizes through
      // (that is the fun), so the rate they come in is the rate they go out, and that is what sets their share of the return
      if (++this.topup >= CFG.PRIZE_EVERY) { this.topup = 0; if (this.sim.items.filter(i => i.kind !== 'coin' && i.state !== 'fall' && i.state !== 'gone').length < CFG.PRIZE_MAX) this.restock.push(this.t + 0.3); }
      const it = this.sim.drop(x);
      if (it.lucky) { this.freeQ += CFG.LUCKY_FREE; this.stats.lucky++; this.out.push({ type: 'lucky', x, free: CFG.LUCKY_FREE }); }
      return it;
    }
    addSpins(n = 1) { this.stock = Math.min(CFG.STOCK_MAX, this.stock + n); }
    /** Tests, self-test and demo screenshots: add a spin whose outcome is fixed ('miss', 'jackpot', 'shower', …). */
    queueSpin(outcome) { this.forced.push(outcome); this.addSpins(1); }
    // ---------------------------------------------------------------- effects
    _lamp() {
      if (this.feverT > 0 || this.t < this.coolUntil) return;
      this.lamps++; this.lampT = 0;
      if (this.lamps >= CFG.LAMPS) this.startFever();
      else this.out.push({ type: 'lamp', n: this.lamps });
    }
    startFever(sec = CFG.FEVER_T) { this.lamps = 0; this.feverT = sec; this.stats.fevers++; this.out.push({ type: 'fever', on: true, sec }); }
    startWall(sec = CFG.WALL_T) { const was = this.wallT > 0; this.wallT = Math.min(40, this.wallT + sec); if (!was) this.out.push({ type: 'wall', on: true }); }
    startPush(sec = CFG.PUSH_T) { const was = this.pushT > 0; this.pushT = Math.min(40, this.pushT + sec); if (!was) this.out.push({ type: 'push', on: true }); }
    addCard(id, from) {
      this.stats.cards++;
      const got = SETS.filter(s => s.cards.includes(id) && !this.cards[s.id].includes(id));
      for (const s of got) this.cards[s.id].push(id);
      const ev = { type: 'card', card: id, name: CARD_NAME[id], from, dup: !got.length, tickets: got.length ? 0 : this.tickets(CFG.DUP_TICKETS) };
      this.stats.tickets += ev.tickets; this.out.push(ev);
      for (const s of got) {
        if (this.cards[s.id].length < s.cards.length) continue;
        this.cards[s.id] = []; this.stats.sets++; this.stats.setCoins += s.coins; this.stats.coins += s.coins;
        this.out.push({ type: 'set', set: s.id, name: s.name, coins: s.coins });
        this._lamp();
      }
    }
    _startSpin() {
      this.stock--; this.stats.spins++;
      let r = this.rand(), oc = null;
      for (const o of OUTCOMES) { if (r < o.p) { oc = o; break; } r -= o.p; }
      if (this.forced.length) { const f = this.forced.shift(); oc = OUTCOMES.find(o => o.id === f) || null; }
      const pickSym = (not) => { let s; do s = SYMBOLS[Math.floor(this.rand() * SYMBOLS.length)]; while (s === not); return s; };
      let reels;
      if (oc) reels = [oc.sym, oc.sym, oc.sym];
      else {
        // a miss: sometimes tease with two matching symbols (a "reach"), most often two pigs
        const teaser = this.rand();
        if (teaser < 0.14) { const s = this.rand() < 0.45 ? 'heo' : pickSym(); reels = [s, s, pickSym(s)]; }
        else { const a = pickSym(), b = pickSym(a); reels = [a, b, SYMBOLS[Math.floor(this.rand() * SYMBOLS.length)]]; }
      }
      const reach = reels[0] === reels[1];
      const stops = CFG.SPIN_STOPS.slice(); if (reach) stops[2] += CFG.REACH_EXTRA;
      this.spin = { t: 0, reels, reach, stops, outcome: oc ? oc.id : 'miss', done: false, end: stops[2] + CFG.SPIN_SHOW };
      this.out.push({ type: 'spin', reels, reach, stops: stops.slice(), outcome: this.spin.outcome });
    }
    _finishSpin() {
      const sp = this.spin; sp.done = true; this.reels = sp.reels.slice();
      const ev = { type: 'result', outcome: sp.outcome, reels: sp.reels };
      this.stats.wins[sp.outcome] = (this.stats.wins[sp.outcome] || 0) + 1;
      switch (sp.outcome) {
        case 'jackpot': {
          const coins = Math.round(this.pool); this.pool = CFG.JP_SEED;
          ev.coins = coins; ev.free = CFG.JP_RAIN; this.freeQ += CFG.JP_RAIN;
          this.stats.coins += coins; this.stats.jackpots++; this.stats.jpCoins += coins; break;
        }
        case 'shower': ev.free = CFG.SHOWER; this.freeQ += CFG.SHOWER; break;
        case 'tickets': ev.tickets = this.tickets(CFG.TICKET_BONUS); this.stats.tickets += ev.tickets; break;
        case 'wall': ev.sec = CFG.WALL_T; break;
        case 'push': ev.sec = CFG.PUSH_T; break;
        case 'card': ev.card = this.drawCard(); break;
      }
      this.out.push(ev);
      if (sp.outcome === 'wall') this.startWall();
      if (sp.outcome === 'push') this.startPush();
      if (sp.outcome === 'card') this.addCard(ev.card, 'slot');
      if (sp.outcome !== 'miss') this._lamp();
    }
    _prize(e) {
      const P = PRIZE[e.kind] || {}, ev = { type: 'prize', kind: e.kind, x: e.x, tickets: this.tickets(P.tickets || 0), gems: P.gems || 0, free: P.free || 0, card: e.card };
      this.stats.prizes[e.kind] = (this.stats.prizes[e.kind] || 0) + 1;
      this.stats.tickets += ev.tickets; this.stats.gems += ev.gems; this.freeQ += ev.free;
      this.out.push(ev);
      if (e.kind === 'card' && e.card) this.addCard(e.card, 'field');
      this._lamp();
    }
    // ---------------------------------------------------------------- time
    /** Advance dt seconds; returns the events for the page (and empties the queue). */
    step(dt) {
      const sim = this.sim;
      this.t += dt;
      sim.wallsTarget = this.wallT > 0 ? 1 : 0;
      sim.extraTarget = this.pushT > 0 ? CFG.PUSH_EXTRA : 0;
      sim.pocket.open = this.stock < CFG.STOCK_MAX;
      sim.step(dt);
      for (const e of sim.takeEvents()) {
        if (e.type === 'win') {
          if (e.kind === 'coin') { const coins = this.feverT > 0 ? 2 : 1; this.stats.coins += coins; if (coins > 1) this.stats.feverCoins += coins - 1; this.out.push({ type: 'coin', x: e.x, coins, fever: coins > 1 }); }
          else this._prize(e);
        } else if (e.type === 'lost') {
          if (e.kind === 'coin') this.stats.lost++; else this.stats.lostPrizes++;
          this.out.push({ type: 'lost', kind: e.kind, x: e.x });
        } else if (e.type === 'pocket') {
          this.stats.pocket++; this.addSpins(1);
          this.out.push({ type: 'pocket', x: e.x, stock: this.stock });
        } else this.out.push(e);
      }
      // timers
      const tick = (k, off) => { if (this[k] > 0 && (this[k] -= dt) <= 0) { this[k] = 0; this.out.push(off); } };
      if (this.feverT > 0 && this.feverT - dt <= 0) this.coolUntil = this.t + CFG.FEVER_COOL;
      tick('feverT', { type: 'fever', on: false }); tick('wallT', { type: 'wall', on: false }); tick('pushT', { type: 'push', on: false });
      if (this.lamps > 0 && (this.lampT += dt) >= CFG.LAMP_DECAY) { this.lamps--; this.lampT = 0; this.out.push({ type: 'lamp', n: this.lamps }); }
      // slot
      if (this.spin) {
        this.spin.t += dt;
        if (!this.spin.done && this.spin.t >= this.spin.stops[2]) this._finishSpin();
        if (this.spin.t >= this.spin.end) this.spin = null;
      } else if (this.stock > 0) this._startSpin();
      // free coins from the chute, new prizes
      if (this.freeQ > 0 && (this.freeT -= dt) <= 0) {
        this.freeQ--; this.freeT = CFG.FREE_EVERY; this.stats.free++;
        sim.drop(-sim.W + 0.6 + this.rand() * (2 * sim.W - 1.2), 'coin', { free: true });
      }
      while (this.restock.length && this.restock[0] <= this.t) {
        this.restock.shift();
        const k = RESTOCK[Math.floor(this.rand() * RESTOCK.length)];
        sim.drop(-3.2 + this.rand() * 6.4, k, k === 'card' ? { card: this.drawCard() } : {});
      }
      const out = this.out; this.out = []; return out;
    }
    /** What a session has paid back per paid coin, counting tickets at 500 xu and the jackpot pool's growth as owed. */
    returnRate(pool0 = CFG.JP_SEED) {
      const s = this.stats; if (!s.paid) return 0;
      return (s.coins + s.tickets * 500 / this.bet + (this.pool - pool0)) / s.paid;
    }
  }

  return { Sim, Game, KINDS, PRIZE, CFG, OUTCOMES, SYMBOLS, SETS, CARD_IDS, CARD_NAME, mulberry32 };
});
