/* Gắp Thú (claw machine) — pure rules, no DOM, no three.js.
 * UMD: window.Rules['gap-thu'] in the browser, module.exports in Node (tests/gap-thu.test.js).
 *
 * The machine floor seen from above: x ∈ [−W, W] (right), z ∈ [−D, D] (toward the player). The prize chute is the
 * front-left corner (an opening of 2·HOLE around CHUTE); a clear guard keeps prizes out of KEEP_OUT around it.
 * Prizes lie on the floor as circles (radius r) that never overlap.
 *
 * One try (attempt):
 *   1. The claw drops at (x, z). The prize it closes on is the one whose centre is nearest, within reach = r + CLAW_R.
 *      Nothing in reach → "miss" (the prongs nudge the neighbours a little).
 *   2. align = 1 − d / reach. Gripping is best near the middle: alignF = clamp((align − A0) / (A1 − A0), 0, 1).
 *   3. The claw strength of this try is random (seeded): grip = G0 + GS · Exp(1), so most tries are weak and a few are strong.
 *      ratio = grip · alignF / weight.
 *        ratio ≥ 1      the claw holds all the way: the prize falls into the chute → "win"
 *        0.5 ≤ ratio < 1 it slips on the way, after f = 0.92 · (ratio − 0.5) / 0.5 of the trip: "drop". It lands there, nearer
 *                       the chute; if it lands over the opening it falls in anyway → "win" (lucky)
 *        ratio < 0.5    it slides out as soon as the claw lifts: "slip" (falls back where it was)
 *   4. Every try that wins nothing earns one ⭐; STARS_FOR_FREE ⭐ turn into one free try.
 *   5. A won prize is replaced: the attendant drops a new one (rarity by RARITY weights) at a free spot in the back half.
 * Payout of a prize = its rarity's multiple of the machine price in coins, plus tickets / gems for the rarer ones.
 * tests/gap-thu.test.js plays thousands of tries: the long-run return is 85–95% of the coins spent (coins + tickets × 500).
 */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['gap-thu'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 2.3, D = 1.65, CLAW_R = 0.3, A0 = 0.2, A1 = 0.62, G0 = 0.293, GS = 0.772;
  const CHUTE = { x: -W + 0.62, z: D - 0.62 }, HOLE = 0.55, LUCKY_IN = 0.36, KEEP_OUT = 0.68, N_PRIZES = 11, STARS_FOR_FREE = 10, TICKET_XU = 500;
  const HOME = { x: CHUTE.x, z: CHUTE.z };
  const CLAW_BOUNDS = { x0: -W + 0.28, x1: W - 0.28, z0: -D + 0.28, z1: D - 0.28 };

  const RARITY = {
    thuong: { name: 'Thường', w: 52, mult: 1.95, tickets: 0, gems: 0, color: '#6fbfff', dark: '#1f6fc0' },
    hiem: { name: 'Hiếm', w: 30, mult: 2.75, tickets: 2, gems: 0, color: '#5fd9ac', dark: '#168a60' },
    sieu: { name: 'Siêu hiếm', w: 14, mult: 6.7, tickets: 5, gems: 2, color: '#b79bff', dark: '#5f3fc9' },
    huyen: { name: 'Huyền thoại', w: 4, mult: 18.5, tickets: 15, gems: 10, color: '#ffc93c', dark: '#a86d00' },
  };
  /** Plushies. model: KayKit mini-game animal (assets/3d) or a procedural plush built in the 3D module. wt: weight. */
  const PRIZES = [
    { id: 'vit', name: 'Vịt Bầu', rarity: 'thuong', model: 'mini_duck', icon: 'emoji-fluent-3d/animals/duck.png', r: 0.4, wt: 1.0 },
    { id: 'ga', name: 'Gà Bông', rarity: 'thuong', model: 'proc:chick', icon: 'emoji-fluent-3d/animals/baby_chick.png', r: 0.36, wt: 1.0 },
    { id: 'heo', name: 'Heo Hồng', rarity: 'thuong', model: 'proc:pig', icon: 'emoji-fluent-3d/animals/pig_face.png', r: 0.41, wt: 1.0 },
    { id: 'cun', name: 'Cún Bông', rarity: 'hiem', model: 'mini_dog', icon: 'emoji-fluent-3d/animals/dog_face.png', r: 0.42, wt: 1.5 },
    { id: 'tho', name: 'Thỏ Bông', rarity: 'hiem', model: 'proc:bunny', icon: 'emoji-fluent-3d/animals/rabbit_face.png', r: 0.37, wt: 1.5 },
    { id: 'meo', name: 'Mèo Mướp', rarity: 'hiem', model: 'proc:cat', icon: 'emoji-fluent-3d/animals/cat_face.png', r: 0.39, wt: 1.5 },
    { id: 'gau', name: 'Gấu Bông', rarity: 'sieu', model: 'mini_bear', icon: 'emoji-fluent-3d/game/teddy_bear.png', r: 0.46, wt: 2.2 },
    { id: 'panda', name: 'Gấu Trúc', rarity: 'sieu', model: 'proc:panda', icon: 'emoji-fluent-3d/animals/panda.png', r: 0.44, wt: 2.2 },
    { id: 'heovang', name: 'Heo Vàng', rarity: 'huyen', model: 'proc:goldpig', icon: 'emoji-fluent-3d/animals/pig.png', r: 0.46, wt: 3.0 },
  ];
  const BY_ID = Object.fromEntries(PRIZES.map(p => [p.id, p]));
  /** Machines (rooms): price per try. */
  const TIERS = [
    { id: 'hong', name: 'Máy Hồng', price: 1000, color: '#ff6fa8', hex: 0xff8fbf },
    { id: 'xanh', name: 'Máy Xanh', price: 5000, color: '#3d9bff', hex: 0x6fbfff },
    { id: 'vang', name: 'Máy Vàng', price: 20000, color: '#ffb300', hex: 0xffc93c },
  ];
  const TIER = Object.fromEntries(TIERS.map(t => [t.id, t]));

  // ------------------------------------------------------------------ seeded random (state in a plain number: saveable)
  function rnd(M) { M.s = (M.s + 0x6D2B79F5) >>> 0; let t = M.s; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  const gauss = M => { let u = 0; while (u === 0) u = rnd(M); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd(M)); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ------------------------------------------------------------------ geometry
  const inKeepOut = (x, z, r = 0) => x - r < CHUTE.x + KEEP_OUT && z + r > CHUTE.z - KEEP_OUT;
  /** Prize centre over the opening (it falls in). */
  const overHole = (x, z) => Math.abs(x - CHUTE.x) < HOLE - LUCKY_IN && Math.abs(z - CHUTE.z) < HOLE - LUCKY_IN;
  function clampClaw(x, z) { return { x: clamp(x, CLAW_BOUNDS.x0, CLAW_BOUNDS.x1), z: clamp(z, CLAW_BOUNDS.z0, CLAW_BOUNDS.z1) }; }
  /** Keep a prize inside the walls and outside the chute guard. */
  function fence(p) {
    const r = BY_ID[p.id].r;
    p.x = clamp(p.x, -W + r, W - r); p.z = clamp(p.z, -D + r, D - r);
    if (inKeepOut(p.x, p.z, r)) {   // push out the shorter way: right of the guard or behind it
      const dx = CHUTE.x + KEEP_OUT + r - p.x, dz = p.z + r - (CHUTE.z - KEEP_OUT);
      if (dx < dz) p.x += dx; else p.z -= dz;
    }
  }
  /** Push overlapping prizes apart (a few passes), then fence them. `pin` stays put if possible. */
  function relax(M, pin) {
    const P = M.prizes;
    for (let it = 0; it < 80; it++) {
      let worst = 0;
      for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) {
        const A = P[a], B = P[b], ra = BY_ID[A.id].r, rb = BY_ID[B.id].r;
        let ex = B.x - A.x, ez = B.z - A.z, d = Math.hypot(ex, ez); const need = ra + rb + 0.02;
        if (d >= need) continue;
        if (d < 1e-6) { ex = 1; ez = 0.3; d = Math.hypot(ex, ez); }
        const pen = need - d, wa = A === pin && it < 40 ? 0.15 : 1, wb = B === pin && it < 40 ? 0.15 : 1, k = pen / (wa + wb) / d;
        A.x -= ex * k * wa; A.z -= ez * k * wa; B.x += ex * k * wb; B.z += ez * k * wb; worst = Math.max(worst, pen);
      }
      P.forEach(fence);
      if (worst < 0.008) break;
    }
  }
  function freeSpot(M, r, back) {
    for (let k = 0; k < 900; k++) {
      const x = -W + r + rnd(M) * (2 * W - 2 * r), z = back && k < 200 ? -D + r + rnd(M) * (D - r) : -D + r + rnd(M) * (2 * D - 2 * r);
      if (inKeepOut(x, z, r)) continue;
      if (M.prizes.every(p => Math.hypot(p.x - x, p.z - z) > BY_ID[p.id].r + r + 0.03)) return { x, z };
    }
    return null;
  }
  function pickPrizeId(M) {
    const tot = Object.values(RARITY).reduce((s, r) => s + r.w, 0); let x = rnd(M) * tot, rar = 'thuong';
    for (const [k, r] of Object.entries(RARITY)) { x -= r.w; if (x < 0) { rar = k; break; } }
    const list = PRIZES.filter(p => p.rarity === rar); return list[Math.floor(rnd(M) * list.length)].id;
  }
  const crowded = M => M.prizes.some((a, i) => M.prizes.some((b, j) => j > i && Math.hypot(a.x - b.x, a.z - b.z) < BY_ID[a.id].r + BY_ID[b.id].r - 0.005));
  /** Add one prize (the attendant drops it in, back half first). If there is no free spot it is squeezed in and the
   *  others make room; when even that fails the floor is full and nothing is added (returns null). */
  function restock(M, id, back = true) {
    id = id || pickPrizeId(M); const r = BY_ID[id].r;
    let s = freeSpot(M, r, back), squeezed = false;
    for (let k = 0; !s && k < 60; k++) { const x = -W + r + rnd(M) * (2 * W - 2 * r), z = -D + r + rnd(M) * (2 * D - 2 * r); if (!inKeepOut(x, z, r)) { s = { x, z }; squeezed = true; } }
    if (!s) return null;
    const p = { uid: M.nextUid++, id, x: s.x, z: s.z, yaw: rnd(M) * 6.283 }; M.prizes.push(p);
    if (squeezed) { const keep = M.prizes.map(q => [q.x, q.z]); relax(M, p); if (crowded(M)) { M.prizes.pop(); M.nextUid--; M.prizes.forEach((q, i) => { q.x = keep[i][0]; q.z = keep[i][1]; }); return null; } }
    return p;
  }
  function create(opts = {}) {
    const M = { v: 1, s: (opts.seed || 20261023) >>> 0, prizes: [], nextUid: 1, stars: 0, free: 0, tries: 0, wins: 0 };
    const n = opts.n || N_PRIZES;
    if (opts.layout) for (const [id, x, z] of opts.layout) { M.prizes.push({ uid: M.nextUid++, id, x, z, yaw: rnd(M) * 6.283 }); }
    else {
      // a fresh machine is stocked with at least one of each rarity
      for (const id of ['heovang', 'gau', 'cun', 'vit']) restock(M, id, false);
      while (M.prizes.length < n && restock(M, null, false)) {}
    }
    relax(M);
    return M;
  }

  // ------------------------------------------------------------------ one try
  /** The prize the claw would close on at (x, z). */
  function target(M, x, z) {
    let best = null;
    for (const p of M.prizes) {
      const reach = BY_ID[p.id].r + CLAW_R, d = Math.hypot(p.x - x, p.z - z);
      if (d < reach && (!best || d / reach < best.d / best.reach)) best = { prize: p, d, reach };
    }
    if (best) { best.align = 1 - best.d / best.reach; best.alignF = clamp((best.align - A0) / (A1 - A0), 0, 1); }
    return best;
  }
  const payout = (id, price) => { const R = RARITY[BY_ID[id].rarity]; const coins = Math.round(R.mult * price); return { coins, tickets: Math.round(R.tickets * price / 1000), gems: R.gems, value: coins + Math.round(R.tickets * price / 1000) * TICKET_XU }; };
  /** Chance that a perfectly centred grab on prize p ends in the chute (ignores lucky drops). */
  const holdChance = (p, alignF = 1) => alignF <= 0 ? 0 : Math.min(1, Math.exp(-Math.max(0, BY_ID[p.id].wt / alignF - G0) / GS));
  /** Lucky-drop chance too: the trip fraction beyond which a drop lands over the opening. */
  function winChance(M, p, alignF = 1) {
    if (alignF <= 0) return 0;
    const wt = BY_ID[p.id].wt / alignF, dist = Math.hypot(p.x - CHUTE.x, p.z - CHUTE.z);
    const fNeed = Math.max(0, (dist - (HOLE - LUCKY_IN)) / Math.max(dist, 1e-6));          // landing within the opening
    const rNeed = fNeed >= 0.92 ? 1 : 0.5 + 0.5 * fNeed / 0.92;
    return Math.min(1, Math.exp(-Math.max(0, wt * rNeed - G0) / GS));
  }

  /**
   * Drop the claw at (x, z). Mutates the machine. Returns:
   *   { kind: 'miss'|'slip'|'drop'|'win', lucky, claw:{x,z}, uid, id, from:{x,z}, land:{x,z}, f, grip, alignF, ratio,
   *     nudged:[{uid,x,z}], restocked: prize|null, star, freeEarned }
   */
  function attempt(M, x, z) {
    const c = clampClaw(x, z), out = { kind: 'miss', lucky: false, claw: c, nudged: [], restocked: null, star: false, freeEarned: false };
    M.tries++;
    const grip = G0 + GS * -Math.log(1 - rnd(M) * 0.999999);
    out.grip = grip;
    const tg = target(M, c.x, c.z);
    const before = new Map(M.prizes.map(p => [p.uid, [p.x, p.z]]));
    if (!tg) {
      // the open prongs brush the neighbours aside a little
      for (const p of M.prizes) { const d = Math.hypot(p.x - c.x, p.z - c.z), reach = BY_ID[p.id].r + CLAW_R + 0.3; if (d < reach && d > 1e-6) { const k = (reach - d) * 0.35 / d; p.x += (p.x - c.x) * k; p.z += (p.z - c.z) * k; } }
      relax(M);
    } else {
      const p = tg.prize; Object.assign(out, { uid: p.uid, id: p.id, from: { x: p.x, z: p.z }, alignF: tg.alignF, align: tg.align });
      const ratio = out.ratio = grip * tg.alignF / BY_ID[p.id].wt;
      if (ratio >= 1) { out.kind = 'win'; out.f = 1; }
      else if (ratio >= 0.5) {
        out.kind = 'drop'; out.f = 0.92 * (ratio - 0.5) / 0.5;
        const lx = p.x + (CHUTE.x - p.x) * out.f + gauss(M) * 0.06, lz = p.z + (CHUTE.z - p.z) * out.f + gauss(M) * 0.06;
        out.land = { x: lx, z: lz };
        if (overHole(lx, lz)) { out.kind = 'win'; out.lucky = true; }
        else { p.x = lx; p.z = lz; p.yaw += gauss(M) * 0.8; fence(p); relax(M, p); out.land = { x: p.x, z: p.z }; }
      } else {
        out.kind = 'slip'; out.f = 0;
        p.x += gauss(M) * 0.08; p.z += gauss(M) * 0.08; p.yaw += gauss(M) * 0.5; fence(p); relax(M, p); out.land = { x: p.x, z: p.z };
      }
      if (out.kind === 'win') {
        M.prizes = M.prizes.filter(q => q !== p); M.wins++;
        out.restocked = restock(M); relax(M);
      }
    }
    for (const p of M.prizes) { const b = before.get(p.uid); if (b && (Math.abs(b[0] - p.x) > 1e-4 || Math.abs(b[1] - p.z) > 1e-4) && p.uid !== out.uid) out.nudged.push({ uid: p.uid, x: p.x, z: p.z }); }
    if (out.kind !== 'win') { out.star = true; M.stars++; if (M.stars >= STARS_FOR_FREE) { M.stars = 0; M.free++; out.freeEarned = true; } }
    return out;
  }
  /** Pay for a try: uses a free try first. Returns 'free' | 'paid'. (The caller takes the coins.) */
  function useTry(M) { if (M.free > 0) { M.free--; return 'free'; } return 'paid'; }

  // ------------------------------------------------------------------ save / load
  function save(M) { return { v: 1, s: M.s, nextUid: M.nextUid, stars: M.stars, free: M.free, tries: M.tries, wins: M.wins, prizes: M.prizes.map(p => [p.uid, p.id, p.x, p.z, p.yaw]) }; }
  function load(o) {
    if (!o || o.v !== 1 || !Array.isArray(o.prizes)) return null;
    const M = { v: 1, s: o.s >>> 0, nextUid: o.nextUid | 0, stars: o.stars | 0, free: o.free | 0, tries: o.tries | 0, wins: o.wins | 0,
      prizes: o.prizes.filter(a => BY_ID[a[1]]).map(([uid, id, x, z, yaw]) => ({ uid, id, x: +x, z: +z, yaw: +yaw || 0 })) };
    if (!M.prizes.length) return null;
    M.nextUid = Math.max(M.nextUid, ...M.prizes.map(p => p.uid + 1));
    M.prizes.forEach(fence);       // a saved machine is already valid; this only guards against a damaged save
    return M;
  }

  // ------------------------------------------------------------------ simulated players (tests, demo, balance)
  /** Where a player of a given style drops the claw. smart: best expected value, aimed with σ = 0.05;
   *  typical: a random prize (a bit drawn to the cute rare ones), σ = 0.12; sloppy: σ = 0.22; random: anywhere. */
  const AIM = { perfect: 0, smart: 0.05, typical: 0.12, sloppy: 0.22 };
  function choose(M, style, price = 1000) {
    if (style === 'random') return { x: CLAW_BOUNDS.x0 + rnd(M) * (CLAW_BOUNDS.x1 - CLAW_BOUNDS.x0), z: CLAW_BOUNDS.z0 + rnd(M) * (CLAW_BOUNDS.z1 - CLAW_BOUNDS.z0) };
    let p;
    if (style === 'smart' || style === 'perfect') p = M.prizes.reduce((b, q) => { const v = winChance(M, q) * payout(q.id, price).value; return !b || v > b.v ? { q, v } : b; }, null).q;
    else { const w = M.prizes.map(q => ({ thuong: 1, hiem: 1.3, sieu: 1.7, huyen: 2.2 })[BY_ID[q.id].rarity]); let x = rnd(M) * w.reduce((a, b) => a + b, 0); p = M.prizes[0]; for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) { p = M.prizes[i]; break; } } }
    const s = AIM[style] || 0;
    return clampClaw(p.x + gauss(M) * s, p.z + gauss(M) * s);
  }
  function simulate(opts = {}) {
    const M = create({ seed: opts.seed || 1 }), tier = TIER[opts.tier || 'hong'], n = opts.tries || 10000, style = opts.player || 'smart';
    let spent = 0, ev = 0, coins = 0, tickets = 0, gems = 0, wins = 0, lucky = 0, free = 0, kinds = { miss: 0, slip: 0, drop: 0, win: 0 };
    const byRarity = {};
    for (let k = 0; k < n; k++) {
      if (useTry(M) === 'free') free++; else spent += tier.price;
      const aim = choose(M, style, tier.price), tg = target(M, aim.x, aim.z);
      if (tg) ev += winChance(M, tg.prize, tg.alignF) * payout(tg.prize.id, tier.price).value;   // expected value of this try
      const r = attempt(M, aim.x, aim.z);
      kinds[r.kind]++;
      if (r.kind === 'win') { const pay = payout(r.id, tier.price); coins += pay.coins; tickets += pay.tickets; gems += pay.gems; wins++; if (r.lucky) lucky++; const rar = BY_ID[r.id].rarity; byRarity[rar] = (byRarity[rar] || 0) + 1; }
    }
    const value = coins + tickets * TICKET_XU;
    return { tries: n, spent, coins, tickets, gems, value, rtp: value / spent, evRtp: ev / spent, coinRtp: coins / spent, wins, lucky, free, kinds, byRarity, M };
  }

  return { W, D, CLAW_R, A0, A1, G0, GS, CHUTE, HOLE, LUCKY_IN, KEEP_OUT, N_PRIZES, STARS_FOR_FREE, TICKET_XU, HOME, CLAW_BOUNDS,
    RARITY, PRIZES, BY_ID, TIERS, TIER, rnd, inKeepOut, overHole, clampClaw, fence, relax, restock, create, target, payout, holdChance, winChance,
    attempt, useTry, save, load, choose, simulate, AIM };
});
