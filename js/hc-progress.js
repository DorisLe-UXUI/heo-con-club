/*
 * Heo Con progression, shared by every page: levels & XP, VIP, daily / weekly quests, achievements, the "Lễ hội Heo Con"
 * festival track, lucky wheel, piggy bank (heo đất), bankruptcy help, fish album and win streaks.
 *
 * Pages report what happened with HC.prog.track(type, data):
 *   round {game, net, bet}   one finished round / game (net = coins won minus coins put in, for the player)
 *   bet   {game, amount}     coins put on the table          win {game, amount}   coins paid back to the player
 *   catch {game:'ban-ca', id, tier, mult}                    combo {game, kind}   e.g. chat, chat_heo, toi_trang, u, kinh, ba_tay, jackpot, boss
 *   walk {m}  greet {name}  visit {key}  emote  daily        (town)
 * Everything is saved in the per-account store under 'prog'. Rewards go through HC.giveCoins(n) / HC.giveGems(n) when a page sets them,
 * otherwise straight into the store. Pure logic: node tests create it with a fake store and clock (tests/progress.test.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else { root.HCProgress = factory; if (root.HC && root.HC.store) root.HC.prog = factory(root.HC.store, { ui: true }); }
})(typeof self !== 'undefined' ? self : this, function createProgress(store, opts) {
  'use strict';
  opts = opts || {};
  const now = opts.now || (() => Date.now());
  const HC = (typeof window !== 'undefined' && window.HC) || {};
  const listeners = new Set();
  const emit = (type, data) => { for (const f of listeners) { try { f(type, data); } catch (e) {} } };

  // ------------------------------------------------------------------ calendar
  const pad = n => String(n).padStart(2, '0');
  const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const weekKey = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return 'W' + dayKey(d.getTime()); };
  const SEASON_EPOCH = new Date(2026, 9, 19).getTime(), SEASON_LEN = 14 * 864e5;        // festivals run two weeks, from Monday 19/10/2026
  const seasonNo = t => Math.floor((t - SEASON_EPOCH) / SEASON_LEN);
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ------------------------------------------------------------------ games
  const NAMES = { 'tien-len': 'Tiến Lên', phom: 'Phỏm', 'mau-binh': 'Mậu Binh', 'xi-dach': 'Xì Dách', poker: 'Poker', 'bai-cao': 'Bài Cào', 'sam-loc': 'Sâm Lốc',
    lieng: 'Liêng', 'bau-cua': 'Bầu Cua', 'xoc-dia': 'Xóc Đĩa', 'tai-xiu': 'Tài Xỉu', 'co-tuong': 'Cờ Tướng', 'co-ca-ngua': 'Cá Ngựa', 'co-caro': 'Cờ Caro',
    'bai-mau': 'Bài Màu', 'lo-to': 'Lô Tô', 'ban-ca': 'Bắn Cá', 'day-xu': 'Máy Đẩy Xu', 'gap-thu': 'Gắp Thú', 'xuc-ve': 'Máy Xúc Vé' };
  const CARD = ['tien-len', 'phom', 'mau-binh', 'xi-dach', 'poker', 'bai-cao', 'sam-loc', 'lieng', 'bai-mau'];
  const DICE = ['bau-cua', 'xoc-dia', 'tai-xiu'];
  const BOARD = ['co-tuong', 'co-ca-ngua', 'co-caro'];
  const ROUND_GAMES = Object.keys(NAMES).filter(k => k !== 'ban-ca' && k !== 'day-xu');

  // ------------------------------------------------------------------ levels, titles, VIP
  const need = lv => 100 + 30 * (lv - 1);                                   // XP to go from lv to lv+1
  const TITLES = [[1, 'Heo Con Mới Lớn'], [5, 'Heo Tập Sự'], [10, 'Tay Chơi Phố Heo'], [15, 'Cao Thủ Xóm Heo'], [20, 'Cao Thủ'], [30, 'Đại Gia'], [40, 'Huyền Thoại'], [50, 'Thần Bài']];
  const titleFor = lv => TITLES.filter(t => lv >= t[0]).pop()[1];
  const levelReward = lv => ({ coins: 20000 * lv, gems: lv % 5 === 0 ? 50 : 0 });
  const VIP_BET = [0, 1e6, 5e6, 2e7, 5e7, 1.5e8, 5e8, 2e9];                 // lifetime coins bet for VIP 1..8
  const vipFor = bet => VIP_BET.filter(v => bet >= v).length;

  // ------------------------------------------------------------------ quests
  // kind: what counts. Every template gives goal/reward per difficulty (0 easy, 1 medium, 2 hard). key fills {g} with a game.
  const QT = [
    { id: 'play', kind: 'round', ic: 'game/joystick', diff: [[3, 30000], [6, 60000], [10, 100000]], name: n => `Chơi ${n} ván bất kỳ` },
    { id: 'win', kind: 'roundwin', ic: 'game/trophy', diff: [[2, 40000], [4, 80000], [7, 140000]], name: n => `Thắng ${n} ván bất kỳ` },
    { id: 'cardwin', kind: 'roundwin', set: CARD, ic: 'game/spade_suit', diff: [[1, 40000], [3, 90000], [5, 150000]], name: n => `Thắng ${n} ván game bài` },
    { id: 'game', kind: 'round', game: true, ic: 'game/game_die', diff: [[2, 40000], [4, 70000], [6, 110000]], name: (n, g) => `Chơi ${n} ván ${NAMES[g]}` },
    { id: 'bet', kind: 'bet', ic: 'game/money_bag', diff: [[100000, 30000], [500000, 80000], [2000000, 150000]], name: n => `Cược tổng ${short(n)} xu` },
    { id: 'won', kind: 'won', ic: 'game/coin', diff: [[100000, 40000], [500000, 90000], [2000000, 160000]], name: n => `Thắng tổng ${short(n)} xu` },
    { id: 'fish', kind: 'catch', ic: 'sea/tropical_fish', diff: [[10, 30000], [30, 70000], [60, 120000]], name: n => `Bắt ${n} con cá ở Bắn Cá` },
    { id: 'boss', kind: 'boss', ic: 'sea/octopus', diff: [[1, 60000], [1, 60000], [2, 150000]], name: n => `Hạ ${n} trùm ở Bắn Cá` },
    { id: 'chat', kind: 'chat', ic: 'symbols/fire', diff: [[1, 60000], [1, 60000], [2, 140000]], name: n => `Chặt ${n} lần trong Tiến Lên` },
    { id: 'dice', kind: 'round', set: DICE, ic: 'game/game_die', diff: [[5, 30000], [10, 60000], [20, 110000]], name: n => `Chơi ${n} ván Bầu Cua, Xóc Đĩa hoặc Tài Xỉu` },
    { id: 'board', kind: 'round', set: BOARD, ic: 'game/crown', diff: [[1, 40000], [2, 70000], [3, 100000]], name: n => `Chơi ${n} ván cờ (Cờ Tướng, Caro, Cá Ngựa)` },
    { id: 'variety', kind: 'variety', ic: 'game/joker', diff: [[2, 40000], [3, 70000], [5, 130000]], name: n => `Chơi ${n} game khác nhau` },
    { id: 'bigwin', kind: 'bigwin', ic: 'game/gem_stone', diff: [[50000, 50000], [200000, 90000], [1000000, 170000]], name: n => `Thắng một ván lãi từ ${short(n)} xu` },
    { id: 'streak', kind: 'streak', ic: 'symbols/glowing_star', diff: [[2, 50000], [3, 90000], [4, 150000]], name: n => `Thắng ${n} ván liên tiếp` },
    { id: 'pusher', kind: 'pushbet', ic: 'game/admission_tickets', diff: [[20, 30000], [50, 60000], [100, 100000]], name: n => `Thả ${n} xu ở Máy Đẩy Xu` },
    { id: 'walk', kind: 'walk', ic: 'game/round_pushpin', diff: [[200, 20000], [400, 35000], [800, 60000]], name: n => `Dạo phố ${n} mét` },
    { id: 'social', kind: 'greet', ic: 'hands/waving_hand', diff: [[2, 20000], [4, 35000], [6, 50000]], name: n => `Chào hỏi ${n} người bạn trong thị trấn` },
  ];
  const DIFF_PTS = [20, 35, 60], DIFF_XP = [20, 40, 70], DIFF_NAME = ['Dễ', 'Vừa', 'Khó'];
  const WEEK_MULT = 6;

  const WEEK_GOAL = { boss: g => g * 3, chat: g => g * 3, bigwin: g => g * 2, bet: g => g * 3, won: g => g * 3, variety: g => Math.min(18, g + 4), streak: g => g + 1 };
  function makeQuest(t, d, r, weekly) {
    const [goal0, coins0] = t.diff[d];
    const goal = weekly ? (WEEK_GOAL[t.kind] || (g => g * WEEK_MULT))(goal0) : goal0;
    const q = { id: t.id, d, goal, n: 0, coins: coins0 * (weekly ? 4 : 1), pts: DIFF_PTS[d] * (weekly ? 3 : 1), xp: DIFF_XP[d] * (weekly ? 3 : 1), claimed: false, seen: [] };
    if (t.game) q.g = ROUND_GAMES[Math.floor(r() * ROUND_GAMES.length)];
    return q;
  }
  function pickQuests(seed, weekly, avoid = []) {
    const r = rng(hash(seed)), out = [], used = new Set(avoid);
    const diffs = weekly ? [1, 1, 2, 2] : [0, 1, 2];
    for (const d of diffs) {
      const pool = QT.filter(t => !used.has(t.id) && !(weekly && (t.kind === 'walk' || t.kind === 'greet')));
      const t = pool[Math.floor(r() * pool.length)]; used.add(t.id); out.push(makeQuest(t, d, r, weekly));
    }
    return out;
  }
  const tmpl = q => QT.find(t => t.id === q.id);
  function questName(q) { const t = tmpl(q); return t ? t.name(q.goal, q.g) : q.id; }
  function questIcon(q) { const t = tmpl(q); return 'emoji-fluent-3d/' + (t ? t.ic : 'game/scroll') + '.png'; }
  function questApplies(q, type, data) {
    const t = tmpl(q); if (!t) return 0;
    const g = data && data.game;
    if (t.set && !t.set.includes(g)) return 0;
    if (q.g && q.g !== g) return 0;
    switch (t.kind) {
      case 'round': return type === 'round' ? 1 : 0;
      case 'roundwin': return type === 'round' && data.net > 0 ? 1 : 0;
      case 'bet': return type === 'bet' ? data.amount : 0;                // negative for a refunded stake
      case 'won': return type === 'win' ? data.amount : 0;
      case 'catch': return type === 'catch' ? 1 : 0;
      case 'boss': return type === 'catch' && data.tier === 'boss' ? 1 : 0;
      case 'chat': return type === 'combo' && /^chat/.test(data.kind) ? 1 : 0;
      case 'variety': if (type === 'round' && g && !q.seen.includes(g)) { q.seen.push(g); return 1; } return 0;
      case 'bigwin': return type === 'round' && data.net >= q.goal ? q.goal : 0;
      case 'streak': return type === 'round' ? (data.net > 0 ? 'streak' : data.net < 0 ? 'reset' : 0) : 0;
      case 'pushbet': return type === 'bet' && g === 'day-xu' ? 1 : 0;
      case 'walk': return type === 'walk' ? data.m : 0;
      case 'greet': if (type === 'greet' && !q.seen.includes(data.name)) { q.seen.push(data.name); return 1; } return 0;
    }
    return 0;
  }

  // ------------------------------------------------------------------ achievements
  const ACH = [
    { id: 'rounds', name: 'Chiến binh bàn chơi', unit: 'ván đã chơi', stat: s => s.rounds, tiers: [10, 100, 500, 2000], ic: 'game/joystick' },
    { id: 'wins', name: 'Tay to', unit: 'ván thắng', stat: s => s.wins, tiers: [5, 50, 250, 1000], ic: 'game/trophy' },
    { id: 'won', name: 'Núi xu', unit: 'xu đã thắng', stat: s => s.won, tiers: [1e6, 1e7, 1e8, 1e9], ic: 'game/money_bag', money: true },
    { id: 'games', name: 'Khám phá thị trấn', unit: 'game đã chơi', stat: s => Object.keys(s.games).length, tiers: [3, 8, 14, 20], ic: 'game/house' },
    { id: 'streak', name: 'Chuỗi thắng', unit: 'ván thắng liền', stat: s => s.bestStreak, tiers: [3, 5, 8, 12], ic: 'symbols/glowing_star' },
    { id: 'fish', name: 'Ngư dân', unit: 'cá đã bắt', stat: s => s.catch, tiers: [50, 500, 2000, 10000], ic: 'sea/tropical_fish' },
    { id: 'boss', name: 'Thợ săn trùm', unit: 'trùm đã hạ', stat: s => s.boss, tiers: [1, 10, 50, 200], ic: 'sea/octopus' },
    { id: 'album', name: 'Bộ sưu tập đại dương', unit: 'loài cá', stat: (s, p) => Object.keys(p.album).length, tiers: [10, 20, 30, 42], ic: 'sea/spiral_shell' },
    { id: 'chat', name: 'Chặt chém', unit: 'lần chặt', stat: s => s.combos.chat || 0, tiers: [1, 10, 50, 200], ic: 'symbols/fire' },
    { id: 'level', name: 'Lên đời', unit: 'cấp', stat: (s, p) => p.lv, tiers: [5, 10, 25, 50], ic: 'game/crown' },
    { id: 'login', name: 'Chăm chỉ', unit: 'ngày ghé thị trấn', stat: s => s.days, tiers: [3, 7, 30, 100], ic: 'game/alarm_clock' },
  ];
  const ACH_GEMS = [10, 30, 80, 200], ACH_COINS = [50000, 200000, 800000, 3000000], ACH_TIER = ['Đồng', 'Bạc', 'Vàng', 'Kim cương'];

  // ------------------------------------------------------------------ festival track (free), wheel, piggy, help
  const SEASON_TIERS = 30, SEASON_STEP = 100;
  function seasonReward(i) {               // tier i = 1..30
    if (i === 30) return { coins: 3000000, gems: 300, title: 'Vua Lễ Hội' };
    if (i % 10 === 0) return { coins: 600000, gems: 100, spins: 2 };
    if (i % 5 === 0) return { gems: 50, spins: 1 };
    if (i % 3 === 0) return { spins: 1, coins: 50000 };
    return { coins: 30000 + i * 10000 };
  }
  const WHEEL = [{ coins: 20000, w: 28 }, { coins: 50000, w: 24 }, { gems: 10, w: 14 }, { coins: 100000, w: 14 }, { pts: 50, w: 8 }, { coins: 250000, w: 6 }, { spins: 1, w: 4 }, { coins: 1000000, w: 2 }];
  const PIGGY_RATE = .02, PIGGY_MIN = 50000, PIGGY_MAX = 5e6;
  const RESCUE_BELOW = 20000, RESCUE_AMOUNT = 200000, RESCUE_PER_DAY = 3;

  // ------------------------------------------------------------------ state
  const fresh = () => ({ v: 1, lv: Math.max(1, +store.get('lv', 1) || 1), xp: 0,
    stats: { rounds: 0, wins: 0, bet: 0, won: 0, catch: 0, boss: 0, streak: 0, bestStreak: 0, bestWin: 0, days: 0, games: {}, combos: {} },
    day: null, week: null, ach: {}, season: { no: -1, pts: 0, claimed: [] }, wheel: { d: '', used: 0, extra: 0 }, piggy: { amt: 0, broke: '' },
    rescue: { d: '', n: 0 }, album: {}, login: { last: '', streak: 0 }, titles: [] });
  let P = Object.assign(fresh(), store.get('prog', null) || {});
  const save = () => store.set('prog', P);

  function roll() {                                       // new day / week / festival
    const t = now(), d = dayKey(t), w = weekKey(t), sn = seasonNo(t), uid = (HC.auth && HC.auth.user && HC.auth.user()) || 'khach';
    let changed = false;
    if (!P.day || P.day.d !== d) {
      const prev = P.login.last, yest = dayKey(t - 864e5);
      P.login = { last: d, streak: prev === yest ? P.login.streak + 1 : 1 }; P.stats.days++;
      P.day = { d, q: pickQuests(uid + '|' + d, false), rr: 0, chest: false }; changed = true;
    }
    if (!P.week || P.week.w !== w) { P.week = { w, q: pickQuests(uid + '|' + w, true), chest: false }; changed = true; }
    if (P.season.no !== sn) { P.season = { no: sn, pts: 0, claimed: [] }; changed = true; }
    if (changed) save();
  }

  // ------------------------------------------------------------------ rewards
  function giveCoins(n) { if (!n) return; if (HC.giveCoins) HC.giveCoins(n); else store.set('coins', Math.max(0, (store.get('coins', 1250000) || 0) + n)); }
  function giveGems(n) { if (!n) return; if (HC.giveGems) HC.giveGems(n); else store.set('gems', (store.get('gems', 2480) || 0) + n); }
  function grant(r, why) {
    if (!r) return r;
    giveCoins(r.coins || 0); giveGems(r.gems || 0);
    if (r.spins) P.wheel.extra += r.spins;
    if (r.pts) addPts(r.pts);
    if (r.title && !P.titles.includes(r.title)) P.titles.push(r.title);
    if (r.xp) addXp(r.xp);
    save(); emit('reward', Object.assign({ why }, r));
    return r;
  }
  function addPts(n) { const before = Math.floor(P.season.pts / SEASON_STEP); P.season.pts += n; const after = Math.floor(P.season.pts / SEASON_STEP); if (after > before && before < SEASON_TIERS) emit('tier', Math.min(after, SEASON_TIERS)); }
  function addXp(n) {
    P.xp += Math.round(n);
    while (P.xp >= need(P.lv)) {
      P.xp -= need(P.lv); P.lv++;
      const r = levelReward(P.lv); giveCoins(r.coins); giveGems(r.gems);
      const t = TITLES.find(x => x[0] === P.lv); if (t && !P.titles.includes(t[1])) P.titles.push(t[1]);
      emit('level', { lv: P.lv, reward: r, title: t ? t[1] : null });
    }
    store.set('lv', P.lv); store.set('xp', Math.round(P.xp / need(P.lv) * 100)); save();
  }

  // ------------------------------------------------------------------ tracking
  function bumpQuests(list, type, data, weekly) {
    if (!list) return;
    for (const q of list) {
      if (q.claimed || q.n >= q.goal) continue;
      const v = questApplies(q, type, data);
      if (!v) continue;
      if (v === 'streak') q.n = Math.min(q.goal, P.stats.streak);
      else if (v === 'reset') q.n = 0;
      else q.n = Math.max(0, Math.min(q.goal, q.n + v));
      if (q.n >= q.goal) emit('quest', { q, name: questName(q), weekly });
    }
  }
  function track(type, data = {}) {
    roll();
    const s = P.stats, before = achSnapshot();
    if (type === 'round') {
      s.rounds++; s.games[data.game] = (s.games[data.game] || 0) + 1;
      if (data.net > 0) { s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); s.bestWin = Math.max(s.bestWin, data.net); if (s.streak >= 3) emit('streak', s.streak); }
      else if (data.net < 0) s.streak = 0;
      addPts(4); addXp(10 + (data.net > 0 ? 8 : 0) + Math.min(20, Math.floor((data.bet || 0) / 20000)));
    } else if (type === 'bet') {
      s.bet = Math.max(0, s.bet + data.amount); P.piggy.amt = Math.max(0, Math.min(PIGGY_MAX, P.piggy.amt + Math.round(data.amount * PIGGY_RATE)));   // refunds come in negative
      if (data.game && !(data.game in s.games)) s.games[data.game] = 0;            // counts as a game tried (Bắn Cá, Đẩy Xu have no rounds)
      const v = vipFor(s.bet); if (v > (P.vip || 1)) { P.vip = v; store.set('vip', v); emit('vip', v); }
    } else if (type === 'win') {
      s.won += data.amount;
    } else if (type === 'catch') {
      s.catch++; if (data.tier === 'boss') s.boss++;
      P.album[data.id] = (P.album[data.id] || 0) + 1;
      if (!('ban-ca' in s.games)) s.games['ban-ca'] = 0;
      addXp(1 + (data.tier === 'boss' ? 30 : data.tier === 'big' ? 6 : data.tier === 'medium' ? 2 : 0));
      if (data.tier === 'boss') addPts(15);
    } else if (type === 'combo') {
      const k = /^chat/.test(data.kind) ? 'chat' : data.kind; s.combos[k] = (s.combos[k] || 0) + 1;
    }
    bumpQuests(P.day && P.day.q, type, data, false);
    bumpQuests(P.week && P.week.q, type, data, true);
    save();
    for (const a of achSnapshot()) if (!before.includes(a)) emit('ach', a);
    emit('track', { type, data });
  }

  // ------------------------------------------------------------------ claims
  function claimQuest(weekly, i) {
    roll(); const box = weekly ? P.week : P.day, q = box && box.q[i];
    if (!q || q.claimed || q.n < q.goal) return null;
    q.claimed = true; save();
    return grant({ coins: q.coins, pts: q.pts, xp: q.xp }, 'Hoàn thành: ' + questName(q));
  }
  function chestReady(weekly) { const box = weekly ? P.week : P.day; return !!box && !box.chest && box.q.every(q => q.claimed); }
  function claimChest(weekly) {
    if (!chestReady(weekly)) return null; const box = weekly ? P.week : P.day; box.chest = true; save();
    return grant(weekly ? { gems: 120, coins: 500000, spins: 3, pts: 150 } : { gems: 20, spins: 1, pts: 40 }, weekly ? 'Rương tuần' : 'Rương ngày');
  }
  function reroll(i) {
    roll(); const q = P.day.q[i]; if (!q || q.claimed || P.day.rr >= 1) return false;
    const fresh = pickQuests(P.day.d + '|rr|' + i + '|' + now(), false, P.day.q.map(x => x.id))[q.d];
    P.day.q[i] = Object.assign(fresh, { d: q.d }); P.day.rr++; save(); return true;
  }
  function achState() {
    return ACH.map(a => { const v = a.stat(P.stats, P), done = a.tiers.filter(t => v >= t).length, got = P.ach[a.id] || 0;
      return { id: a.id, name: a.name, unit: a.unit, ic: 'emoji-fluent-3d/' + a.ic + '.png', value: v, tiers: a.tiers, done, got, money: !!a.money,
        next: a.tiers[Math.min(got, a.tiers.length - 1)], claimable: got < done, tierName: ACH_TIER[Math.min(got, 3)] }; });
  }
  function achSnapshot() { return ACH.map(a => a.id + ':' + a.tiers.filter(t => a.stat(P.stats, P) >= t).length); }
  function claimAch(id) {
    const a = achState().find(x => x.id === id); if (!a || !a.claimable) return null;
    const i = a.got; P.ach[id] = i + 1; save();
    return grant({ gems: ACH_GEMS[i], coins: ACH_COINS[i] }, `Thành tựu ${a.name} · ${ACH_TIER[i]}`);
  }
  function seasonState() {
    roll(); const t = now(), end = SEASON_EPOCH + (P.season.no + 1) * SEASON_LEN, tier = Math.min(SEASON_TIERS, Math.floor(P.season.pts / SEASON_STEP));
    return { no: P.season.no + 1, pts: P.season.pts, tier, step: SEASON_STEP, tiers: SEASON_TIERS, left: Math.max(0, end - t), claimed: P.season.claimed.slice(),
      rewards: Array.from({ length: SEASON_TIERS }, (_, i) => seasonReward(i + 1)) };
  }
  function claimTier(i) {      // 1-based
    const s = seasonState(); if (i < 1 || i > s.tier || P.season.claimed.includes(i)) return null;
    P.season.claimed.push(i); save(); return grant(seasonReward(i), `Lễ hội · mốc ${i}`);
  }
  function wheelState() { roll(); const free = P.wheel.d !== dayKey(now()); return { free, extra: P.wheel.extra, spins: (free ? 1 : 0) + P.wheel.extra, slices: WHEEL }; }
  function spin(r = Math.random) {
    const st = wheelState(); if (!st.spins) return null;
    if (st.free) P.wheel.d = dayKey(now()); else P.wheel.extra--;
    const tot = WHEEL.reduce((s, x) => s + x.w, 0); let x = r() * tot, i = 0;
    for (; i < WHEEL.length - 1; i++) { x -= WHEEL[i].w; if (x < 0) break; }
    const prize = Object.assign({}, WHEEL[i]); delete prize.w; save();
    grant(prize, 'Vòng quay may mắn'); return { index: i, prize };
  }
  function piggyState() { const today = dayKey(now()); return { amt: P.piggy.amt, min: PIGGY_MIN, max: PIGGY_MAX, can: P.piggy.amt >= PIGGY_MIN && P.piggy.broke !== today && P.lv >= 3, broke: P.piggy.broke === today, needLv: 3 }; }
  function breakPiggy() { const s = piggyState(); if (!s.can) return null; const amt = P.piggy.amt; P.piggy = { amt: 0, broke: dayKey(now()) }; save(); return grant({ coins: amt }, 'Đập heo đất'); }
  function rescueState(coins) { const d = dayKey(now()), n = P.rescue.d === d ? P.rescue.n : 0; return { can: coins < RESCUE_BELOW && n < RESCUE_PER_DAY, left: RESCUE_PER_DAY - n, amount: RESCUE_AMOUNT, below: RESCUE_BELOW }; }
  function rescue(coins) { const s = rescueState(coins); if (!s.can) return null; const d = dayKey(now()); P.rescue = { d, n: (P.rescue.d === d ? P.rescue.n : 0) + 1 }; save(); return grant({ coins: RESCUE_AMOUNT }, 'Quỹ cứu trợ Heo Con'); }

  function claimableCount() {
    roll(); let n = 0;
    for (const box of [P.day, P.week]) if (box) { n += box.q.filter(q => !q.claimed && q.n >= q.goal).length; if (!box.chest && box.q.every(q => q.claimed)) n++; }
    n += achState().filter(a => a.claimable).length;
    const s = seasonState(); for (let i = 1; i <= s.tier; i++) if (!s.claimed.includes(i)) n++;
    return n;
  }

  roll();
  const api = {
    track, on: f => { listeners.add(f); return () => listeners.delete(f); },
    level: () => P.lv, xp: () => P.xp, need: () => need(P.lv), xpPct: () => Math.floor(P.xp / need(P.lv) * 100), title: () => titleFor(P.lv),
    vip: () => Math.max(P.vip || 1, vipFor(P.stats.bet)), vipNext: () => VIP_BET[Math.min(7, vipFor(P.stats.bet))], stats: () => P.stats, state: () => P,
    daily: () => { roll(); return P.day; }, weekly: () => { roll(); return P.week; }, questName, questIcon, DIFF_NAME, claimQuest, claimChest, chestReady, reroll,
    achievements: achState, claimAch, season: seasonState, claimTier, wheel: wheelState, spin, piggy: piggyState, breakPiggy, rescueState, rescue,
    album: () => P.album, claimableCount, addXp: n => { addXp(n); }, titles: () => P.titles.slice(), NAMES, levelReward, needFor: need,
    _reset: () => { P = fresh(); save(); roll(); },
    /** Re-read the save after the player signs in or switches account (store keys depend on the session). */
    reload: () => { P = Object.assign(fresh(), store.get('prog', null) || {}); roll(); },
  };
  function short(n) { return n >= 1e6 ? (n / 1e6).toString().replace('.', ',') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n); }

  // ------------------------------------------------------------------ small notifications on any page
  if (opts.ui && typeof document !== 'undefined') {
    const QUIET = /[?&](shot|uitest|pose|selftest)=/.test(location.search);
    const css = `#hcNote{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);z-index:9998;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none}
#hcNote div{display:flex;align-items:center;gap:8px;padding:6px 14px 6px 8px;border-radius:999px;background:rgba(255,255,255,.95);border:2px solid #ffd0e4;box-shadow:0 4px 0 rgba(194,64,122,.25),0 8px 18px rgba(60,10,50,.18);font:800 clamp(12px,1.4vw,17px)/1.2 "Baloo 2",system-ui,sans-serif;color:#7a2a56;white-space:nowrap;animation:hcN .35s cubic-bezier(.2,1.5,.4,1) both}
#hcNote img{width:clamp(20px,2.2vw,30px);height:auto}#hcNote b{color:#c2407a}
@keyframes hcN{from{transform:translateY(-14px) scale(.8);opacity:0}}`;
    const box = () => { let b = document.getElementById('hcNote'); if (!b) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); b = document.createElement('div'); b.id = 'hcNote'; document.body.appendChild(b); } return b; };
    const A = p => (HC.A ? HC.A(p) : 'assets/' + p);
    api.note = (html, icon = 'emoji-fluent-3d/game/party_popper.png', ms = 3200) => {
      if (QUIET || !document.body) return;
      const d = document.createElement('div'); d.innerHTML = `<img src="${A(icon)}" alt=""><span>${html}</span>`; box().appendChild(d);
      setTimeout(() => { d.style.transition = 'opacity .4s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 450); }, ms);
    };
    api.on((type, d) => {
      if (api.silent) return;
      if (type === 'quest') api.note(`Xong nhiệm vụ: <b>${d.name}</b>`, 'emoji-fluent-3d/game/scroll.png');
      else if (type === 'level') api.note(`Lên cấp <b>${d.lv}</b>! +${short(d.reward.coins)} xu${d.title ? ` · danh hiệu <b>${d.title}</b>` : ''}`, 'emoji-fluent-3d/game/crown.png', 4200);
      else if (type === 'ach') { const a = achState().find(x => d.startsWith(x.id + ':')); if (a) api.note(`Thành tựu mới: <b>${a.name}</b>`, a.ic); }
      else if (type === 'streak') api.note(`Thắng <b>${d}</b> ván liên tiếp! 🔥`, 'emoji-fluent-3d/symbols/fire.png');
      else if (type === 'tier') api.note(`Lễ hội: lên mốc <b>${d}</b>`, 'emoji-fluent-3d/game/party_popper.png');
      else if (type === 'vip') api.note(`Lên <b>VIP ${d}</b>!`, `ui-premium-generated/badges/vip_${Math.min(8, d)}.png`);
    });
  }
  return api;
});
