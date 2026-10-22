/* Lô Tô rules (pure, no DOM): 90 balls, tickets of 3 rows × 9 columns with 5 numbers per row.
 * Column c holds numbers from its decade: 1–9, 10–19, …, 70–79, 80–90; every column holds at least one number
 * and numbers grow from top to bottom inside a column. The first player with a fully marked row ("KINH!") wins;
 * the pot is every ticket sold, the winners share 90% of it and the house keeps the rest. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else (root.Rules = root.Rules || {})['lo-to'] = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const COLS = [[1, 9], [10, 19], [20, 29], [30, 39], [40, 49], [50, 59], [60, 69], [70, 79], [80, 90]];
  const ROWS = 3, PER_ROW = 5, HOUSE_PCT = 10;
  function colOf(n) { if (!(n >= 1 && n <= 90 && n % 1 === 0)) throw new Error('bad number ' + n); return n < 10 ? 0 : n >= 80 ? 8 : Math.floor(n / 10); }
  /** Seeded generator (mulberry32) so tests and demos can replay a game. */
  function rngFrom(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /**
   * A fresh ticket → { rows: [[n|null × 9] × 3], nums: [15 sorted numbers] }.
   * 1) how many numbers each column gets: 1 each, then 6 extra (max 3 per column);
   * 2) which rows they sit in: columns with most numbers first, each takes the rows with most room left
   *    (Ryser's construction — always succeeds because a column never needs more than 3 rows and 6 extras force ≥3 columns of 2+);
   * 3) the numbers: distinct picks from the column's decade, sorted top → bottom.
   */
  function makeTicket(rng = Math.random) {
    const count = COLS.map(() => 1);
    for (let k = 0; k < 6; k++) { const open = count.map((c, i) => (c < 3 ? i : -1)).filter(i => i >= 0); count[open[Math.floor(rng() * open.length)]]++; }
    const room = [PER_ROW, PER_ROW, PER_ROW], cells = COLS.map(() => []);
    const order = shuffle(COLS.map((_, i) => i), rng).sort((a, b) => count[b] - count[a]);
    for (const c of order) {
      const rows = shuffle([0, 1, 2], rng).sort((a, b) => room[b] - room[a]).slice(0, count[c]);
      for (const r of rows) { if (room[r] <= 0) throw new Error('ticket layout failed'); room[r]--; cells[c].push(r); }
    }
    const rows = [0, 1, 2].map(() => Array(9).fill(null));
    COLS.forEach(([lo, hi], c) => {
      const pool = []; for (let n = lo; n <= hi; n++) pool.push(n);
      const nums = shuffle(pool, rng).slice(0, count[c]).sort((a, b) => a - b);
      cells[c].sort((a, b) => a - b).forEach((r, i) => { rows[r][c] = nums[i]; });
    });
    return { rows, nums: rows.flat().filter(n => n != null).sort((a, b) => a - b) };
  }
  /** Every rule a ticket must respect. → [] when valid, else a list of problems. */
  function validateTicket(t) {
    const err = [];
    if (!t || !Array.isArray(t.rows) || t.rows.length !== ROWS) return ['need 3 rows'];
    const seen = new Set();
    t.rows.forEach((row, r) => {
      if (!Array.isArray(row) || row.length !== 9) { err.push(`row ${r} needs 9 cells`); return; }
      const n = row.filter(x => x != null).length; if (n !== PER_ROW) err.push(`row ${r} has ${n} numbers`);
      row.forEach((x, c) => {
        if (x == null) return;
        if (!(x >= 1 && x <= 90 && x % 1 === 0)) { err.push(`bad number ${x}`); return; }
        if (colOf(x) !== c) err.push(`${x} is in column ${c}`);
        if (seen.has(x)) err.push(`${x} twice`); seen.add(x);
      });
    });
    if (err.length) return err;
    for (let c = 0; c < 9; c++) {
      const col = t.rows.map(r => r[c]).filter(x => x != null);
      if (!col.length) err.push(`column ${c} is empty`);
      for (let i = 1; i < col.length; i++) if (col[i] <= col[i - 1]) err.push(`column ${c} not sorted`);
    }
    if (t.nums && (t.nums.length !== 15 || t.nums.some(n => !seen.has(n)))) err.push('nums mismatch');
    return err;
  }
  const rowNums = (t, r) => t.rows[r].filter(n => n != null);
  const has = (s, n) => (s instanceof Set ? s.has(n) : s.includes(n));
  /** Missing numbers per row given the marked set. */
  const missing = (t, marked) => [0, 1, 2].map(r => rowNums(t, r).filter(n => !has(marked, n)).length);
  /** How many numbers the best row still waits for ("chờ N số"). */
  const waiting = (t, marked) => Math.min(...missing(t, marked));
  const completeRows = (t, marked) => [0, 1, 2].filter(r => rowNums(t, r).every(n => has(marked, n)));
  /** A KINH claim is valid when some row is fully marked AND every number in it has really been drawn. */
  function canKinh(t, marked, drawn) {
    for (let r = 0; r < ROWS; r++) { const ns = rowNums(t, r); if (ns.every(n => has(marked, n) && has(drawn, n))) return { ok: true, row: r, nums: ns }; }
    return { ok: false, row: -1, nums: [] };
  }
  /** With perfect marking: after how many draws of `order` does the ticket first complete a row? */
  function drawsToWin(t, order) { const d = new Set(); for (let i = 0; i < order.length; i++) { d.add(order[i]); if (completeRows(t, d).length) return i + 1; } return Infinity; }
  function drawOrder(rng = Math.random) { const a = []; for (let n = 1; n <= 90; n++) a.push(n); return shuffle(a, rng); }
  /** Pot split: winners share (100 − HOUSE_PCT)% of all tickets, rounded down; the house keeps the rest. */
  function prize(price, players, winners, housePct = HOUSE_PCT) {
    if (!(price >= 0 && price % 1 === 0) || !(players >= 1)) throw new Error('bad pot');
    const pot = price * players, total = Math.floor(pot * (100 - housePct) / 100), share = winners > 0 ? Math.floor(total / winners) : 0;
    return { pot, total, share, house: pot - share * winners };
  }

  // ------------------------------------------------------------- the caller ("người hô lô tô")
  const U = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  /** Vietnamese words for 1..90: 21 → "hai mươi mốt", 15 → "mười lăm", 24 → "hai mươi tư". */
  function words(n) {
    colOf(n);
    if (n < 10) return U[n];
    const t = Math.floor(n / 10), u = n % 10;
    const head = t === 1 ? 'mười' : U[t] + ' mươi';
    if (!u) return head;
    const tail = u === 5 ? 'lăm' : u === 1 && t > 1 ? 'mốt' : u === 4 && t > 1 ? 'tư' : U[u];
    return head + ' ' + tail;
  }
  const SPECIAL = {
    1: 'Một mình một cõi', 2: 'Hai con vịt bầu', 3: 'Ba chú heo con', 5: 'Năm ngón tay xinh', 7: 'Bảy sắc cầu vồng', 8: 'Tám chuyện cả ngày',
    9: 'Chín người mười ý', 10: 'Mười phân vẹn mười', 11: 'Hai cây cột điện', 12: 'Mười hai con giáp', 22: 'Hai con vịt bơi', 39: 'Thần tài nhỏ',
    44: 'Bốn bốn tám chân', 55: 'Năm năm tròn trịa', 66: 'Lộc lộc đầy nhà', 68: 'Lộc phát lộc phát', 79: 'Thần tài lớn', 86: 'Phát lộc tới nơi',
    88: 'Phát phát cả năm', 90: 'Số to nhất bàn',
  };
  const TPL = ['Lô tô lô tô, con số {w}!', 'Số gì đây ta? {W}!', 'Ai có {w} thì dò nha!', 'Tròn tròn xinh xinh, số {w}!', 'Hô to lên nào: {W}!', 'Bà con ơi, {w} nè!'];
  /** A short, fun call for a drawn number. */
  function callPhrase(n, rng = Math.random) {
    const w = words(n), cap = w[0].toUpperCase() + w.slice(1);
    if (SPECIAL[n] && rng() < .7) return `${SPECIAL[n]}… ${cap}!`;
    return TPL[Math.floor(rng() * TPL.length)].replace('{w}', w).replace('{W}', cap);
  }
  return { COLS, ROWS, PER_ROW, HOUSE_PCT, colOf, rngFrom, shuffle, makeTicket, validateTicket, rowNums, missing, waiting, completeRows, canKinh, drawsToWin, drawOrder, prize, words, callPhrase, SPECIAL };
});
