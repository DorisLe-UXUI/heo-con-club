/*
 * T3 rooms + lobby ("Chọn bàn") for play3d.html. Loaded after js/table3d.js.
 *
 * Every game gets 4–5 tiers (Tập Sự, Bình Dân, Cao Thủ, Đại Gia, Hoàng Gia). A tier says which stakes the chip picker may
 * offer, the minimum coins to sit, the player level it needs, how strong the bots are and how rich they are.
 * Defaults come from the game's kind (KIND below); a module can override them in its T3.register def:
 *   rooms: [{ id, name, stakes: [...], min, lv, ai, bank: [lo, hi], scene }]   (merged over the default tier with the same id/index)
 *   modes: [{ id, name, desc, rules: '<html>', minMul }]                          (tabs in the lobby when there are 2+)
 *   stakeName: 'Mù nhỏ' | 'Tiền gà' | 'Đạn' | 'Giá vé' | 'Cược'                 (label in front of the stakes)
 *   botLabel: false                                                               (hide "Bot Khó" for luck games)
 * The chosen tier and mode land on ctx.room / ctx.mode before def.start(ctx) runs (null with ?selftest, ?shot, ?demo).
 */
(function () {
  'use strict';
  const T3 = window.T3;
  const K = 1000, M = 1e6;
  /** Look of each tier. scene = assets/bg-tables-generated/with-table/table_scene_<scene>.png (the user's table pictures). */
  const TIERS = [
    { id: 'tap-su', name: 'Tập Sự', lv: 1, ai: 0, scene: 'mint', color: '#1f9a70', grad: ['#c9f6e6', '#5fd9ac'], bank: [80 * K, 600 * K], pop: [900, 2600] },
    { id: 'binh-dan', name: 'Bình Dân', lv: 1, ai: 1, scene: 'sakura', color: '#c2407a', grad: ['#ffd1e3', '#ff8fbf'], bank: [500 * K, 4 * M], pop: [1500, 4200] },
    { id: 'cao-thu', name: 'Cao Thủ', lv: 5, ai: 2, scene: 'lavender', color: '#6c4bd1', grad: ['#e6dcff', '#ad8cff'], bank: [3 * M, 20 * M], pop: [500, 1600] },
    { id: 'dai-gia', name: 'Đại Gia', lv: 10, ai: 2, scene: 'classic', color: '#167a4f', grad: ['#d2f3df', '#47bd83'], bank: [12 * M, 70 * M], pop: [140, 600] },
    { id: 'hoang-gia', name: 'Hoàng Gia', lv: 15, ai: 3, scene: 'tet', color: '#b8262f', grad: ['#ffe6a6', '#ff7a6b'], bank: [50 * M, 250 * M], pop: [30, 160] },
  ];
  /** Stakes + minimum coins per kind of game, one row per tier. */
  const STAKES = {
    bet: [[[1 * K, 5 * K, 10 * K], 10 * K], [[5 * K, 10 * K, 50 * K], 100 * K], [[10 * K, 50 * K, 100 * K], 500 * K], [[50 * K, 100 * K, 500 * K], 2 * M], [[100 * K, 500 * K, 1 * M], 10 * M]],
    unit: [[[1 * K, 5 * K], 20 * K], [[10 * K, 50 * K], 200 * K], [[50 * K, 100 * K], 1 * M], [[100 * K, 500 * K], 4 * M], [[500 * K, 1 * M], 20 * M]],
    blind: [[[1 * K], 20 * K], [[5 * K, 10 * K], 200 * K], [[10 * K, 50 * K], 1 * M], [[50 * K, 100 * K], 4 * M], [[100 * K, 500 * K], 20 * M]],
    board: [[[5 * K, 10 * K], 10 * K], [[10 * K, 50 * K], 100 * K], [[50 * K, 100 * K], 500 * K], [[100 * K, 500 * K], 2 * M], [[500 * K, 1 * M], 10 * M]],
    ticket: [[[1 * K, 5 * K], 10 * K], [[5 * K, 10 * K], 100 * K], [[10 * K, 50 * K], 500 * K], [[50 * K, 100 * K], 2 * M], [[100 * K, 500 * K], 10 * M]],
    // Bắn Cá: five cannon levels per room (the 95% RTP model pays bet × multiplier, so it does not depend on the ladder)
    fish: [[[1 * K, 2 * K, 3 * K, 4 * K, 5 * K], 20 * K], [[5 * K, 10 * K, 20 * K, 30 * K, 50 * K], 200 * K], [[50 * K, 100 * K, 200 * K, 300 * K, 500 * K], 2 * M], [[100 * K, 200 * K, 300 * K, 500 * K, 1 * M], 5 * M]],
  };
  const KIND = { phom: 'unit', 'sam-loc': 'unit', 'mau-binh': 'unit', 'bai-mau': 'unit', 'xi-dach': 'bet', 'bai-cao': 'bet', 'bau-cua': 'bet', 'xoc-dia': 'bet', 'tai-xiu': 'bet',
    poker: 'blind', lieng: 'blind', 'co-tuong': 'board', 'co-caro': 'board', 'co-ca-ngua': 'board', 'lo-to': 'ticket', 'ban-ca': 'fish' };
  const LUCK = { bet: true, ticket: true, fish: true };
  const POPULAR = { 'tien-len': 1.6, 'ban-ca': 1.4, 'tai-xiu': 1.3, phom: 1.2, 'xoc-dia': 1.1, 'bau-cua': 1.1, 'mau-binh': 1, 'xi-dach': 1, 'bai-cao': .9, 'sam-loc': .9, poker: .8, lieng: .8, 'lo-to': .7, 'bai-mau': .7, 'co-tuong': .6, 'co-caro': .5, 'co-ca-ngua': .5 };
  const AI_NAME = ['Dễ', 'Vừa', 'Khó', 'Siêu khó'];

  /** The tiers for one game (defaults by kind, then the module's own `rooms` merged on top). */
  function roomsFor(key, def = {}) {
    const kind = def.roomKind || KIND[key] || 'bet', rows = STAKES[kind] || STAKES.bet;
    const base = rows.map((r, i) => Object.assign({}, TIERS[i], { stakes: r[0].slice(), min: r[1], kind }));
    let out = base;
    if (Array.isArray(def.rooms)) out = def.rooms.map((o, i) => Object.assign({}, base.find(b => b.id === o.id) || base[i] || TIERS[Math.min(i, TIERS.length - 1)], { kind }, o));
    return out.map((r, i) => Object.assign(r, { index: i, aiName: AI_NAME[Math.max(0, Math.min(3, r.ai | 0))] }));
  }
  function modesFor(def = {}) { return Array.isArray(def.modes) ? def.modes : []; }
  /** "1K – 10K" / "5K". */
  function stakeText(r) { const s = r.stakes || []; if (!s.length) return ''; const a = Math.min(...s), b = Math.max(...s); return a === b ? HC.short(a) : HC.short(a) + ' – ' + HC.short(b); }
  const playerLevel = () => { try { return (window.HC && HC.prog && HC.prog.level) ? HC.prog.level() : 1; } catch (e) { return 1; } };
  /** Why the player cannot sit at room r (null = can sit). */
  function lockReason(r, mode, coins = HC.store.get('coins', 1250000), lv = playerLevel()) {
    if (lv < (r.lv || 1)) return `Cần cấp ${r.lv}`;
    const need = Math.round((r.min || 0) * ((mode && mode.minMul) || 1));
    if (coins < need) return `Cần ${HC.fmt(need)} xu`;
    return null;
  }
  /** A plausible number of people at this tier right now (stable for 5 minutes). */
  function online(key, r) {
    const slot = Math.floor(Date.now() / 300000), s = `${key}|${r.id}|${slot}`;
    let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    const [lo, hi] = r.pop || [100, 900], f = POPULAR[key] || 1;
    return Math.round((lo + ((h >>> 0) % 1000) / 1000 * (hi - lo)) * f);
  }
  /** Rules popup: the module's rules plus one section per mode. */
  function rulesHtml(def, mode) {
    const modes = modesFor(def);
    if (modes.length < 2) return def.rules || '';
    return (def.rules || '') + `<h3 style="font:400 34px 'Grandstander Black';color:#c2407a;margin:22px 0 6px">Chế độ chơi</h3>` +
      modes.map(m => `<div style="margin:8px 0;padding:10px 18px;border-radius:22px;background:${mode && mode.id === m.id ? '#fff3c4' : '#fff4f9'}"><b>${m.name}</b>${mode && mode.id === m.id ? ' <span style="color:#1f9a70">(đang chơi)</span>' : ''} — ${m.rules || m.desc || ''}</div>`).join('');
  }

  // ==================================================================== lobby UI
  const CSS = `
  #lobby{position:fixed;inset:0;z-index:0;overflow:hidden;background:#ffd6e8}
  #lobby .lob-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  #lobby .lob-st{position:absolute;left:0;transform-origin:0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
  .lob-head{display:flex;align-items:center;justify-content:center;gap:20px}
  .lob-title{position:relative;width:520px;height:112px;flex:none}
  .lob-title img{width:100%;height:100%}
  .lob-title span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-bottom:20px;font:400 46px "Grandstander Black";color:#fff;-webkit-text-stroke:8px #c2407a;paint-order:stroke fill;white-space:nowrap}
  .lob-lv{display:flex;align-items:center;gap:8px;padding:6px 22px 6px 8px;border-radius:30px;background:rgba(255,255,255,.92);box-shadow:0 5px 0 #f0bcd2;font:400 26px "Grandstander Black";color:#9b2c5e;white-space:nowrap}
  .lob-lv img{width:44px}.lob-lv small{font:800 20px "Baloo 2";color:#a07090;margin-left:6px}
  .lob-tabs{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
  .lob-tab{padding:8px 26px;border-radius:30px;background:rgba(255,255,255,.9);box-shadow:0 5px 0 #f0bcd2;font:400 28px "Grandstander Black";color:#c2407a;cursor:pointer;white-space:nowrap;transition:transform .12s}
  .lob-tab:hover{transform:translateY(-3px)}
  .lob-tab.on{background:linear-gradient(#ff9cc4,#ff5c9a);color:#fff;box-shadow:0 5px 0 #c2407a}
  .lob-desc{max-width:1500px;padding:6px 26px;border-radius:24px;background:rgba(255,255,255,.82);font:800 23px "Baloo 2";color:#7a3a5c;text-align:center}
  .lob-grid{display:flex;flex-wrap:wrap;gap:26px;justify-content:center}
  .lob-room{position:relative;width:330px;border-radius:44px;padding:16px 16px 20px;cursor:pointer;transition:transform .18s cubic-bezier(.2,1.5,.4,1);animation:lobIn .45s cubic-bezier(.2,1.6,.4,1) both}
  .lob-room:hover{transform:translateY(-10px) rotate(-1deg)}
  .lob-room.last{outline:6px solid #fff27a;outline-offset:4px}
  .lob-room .thumb{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:30px;box-shadow:inset 0 0 0 4px rgba(255,255,255,.6);background:rgba(255,255,255,.4)}
  .lob-room .nm{margin-top:10px;text-align:center;font:400 44px "Grandstander Black";color:#fff;-webkit-text-stroke:8px var(--rc);paint-order:stroke fill;white-space:nowrap;line-height:1.15}
  .lob-room .info{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:4px;font:800 27px "Baloo 2";color:#fff;text-shadow:0 2px 0 var(--rc);white-space:nowrap}
  .lob-room .info img{width:52px}
  .lob-room .min{text-align:center;font:800 21px "Baloo 2";color:rgba(255,255,255,.97);text-shadow:0 1px 0 var(--rc);margin-top:2px;white-space:nowrap}
  .lob-room .online{position:absolute;left:28px;top:28px;font:800 19px "Baloo 2";color:#fff;background:rgba(47,174,122,.95);border-radius:14px;padding:0 12px;box-shadow:0 3px 0 #1f9a70;white-space:nowrap}
  .lob-room .lockic{position:absolute;right:24px;top:20px;width:66px;display:none;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25))}
  .lob-room.lock{filter:grayscale(.7);opacity:.85}
  .lob-room.lock .lockic{display:block}
  .lob-room .go{position:relative;margin:12px auto 0;width:232px;height:78px}
  .lob-room .go img{width:100%;height:100%}
  .lob-room .go span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-bottom:8px;font:400 30px "Grandstander Black";color:#fff;-webkit-text-stroke:6px #1f9a70;paint-order:stroke fill;white-space:nowrap}
  .lob-room.lock .go span{-webkit-text-stroke-color:#8a8496;font-size:25px}
  .lob-quick{position:relative;margin-top:14px;width:460px;height:128px;cursor:pointer;transition:transform .12s;animation:lobPulse 1.6s ease-in-out infinite}
  .lob-quick:hover{transform:scale(1.04)}
  .lob-quick img{width:100%;height:100%}
  .lob-quick span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-bottom:14px;font:400 56px "Grandstander Black";color:#fff;-webkit-text-stroke:10px #c2407a;paint-order:stroke fill}
  @keyframes lobIn{from{transform:scale(.4);opacity:0}}
  @keyframes lobPulse{0%,100%{scale:1}50%{scale:1.04}}
  body.lobby-on #me,body.lobby-on #gameui{display:none}
  body.lobby-shot .lob-room,body.lobby-shot .lob-quick{animation:none!important}`;

  const CW = 330, CH = 440, GAP = 26, PAD = 40;
  /**
   * Show the lobby. o: { key, def, topPx: () => pixels covered by the top bar, last: {room, mode}, toast(msg) }.
   * Resolves with { room, mode } when the player sits down.
   */
  function show(o) {
    if (!document.getElementById('lobCss')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'lobCss', textContent: CSS }));
    const { key, def } = o, rooms = roomsFor(key, def), modes = modesFor(def);
    const A = HC.A, el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
    let mode = modes.find(m => o.last && m.id === o.last.mode) || modes[0] || null;
    const root = el('div', null, null); root.id = 'lobby';
    document.body.insertBefore(root, document.getElementById('ui'));
    document.body.classList.add('lobby-on'); if (/[?&]shot=/.test(location.search)) document.body.classList.add('lobby-shot');
    const bg = el('img', 'lob-bg', root); bg.src = A('ui-premium-generated/lobby-backgrounds/lobby_dream_1920x1080.png');
    const st = el('div', 'lob-st', root);
    const head = el('div', 'lob-head', st);
    el('div', 'lob-title', head, `<img src="${A('ui-premium-generated/ribbons/ribbon_pink.png')}"><span>Chọn bàn</span>`);
    const lv = playerLevel(), title = (() => { try { return HC.prog && HC.prog.title ? HC.prog.title() : ''; } catch (e) { return ''; } })();
    el('div', 'lob-lv', head, `<img src="${A('emoji-fluent-3d/game/crown.png')}">Cấp ${lv}${title ? `<small>${title}</small>` : ''}`);
    const tabs = modes.length > 1 ? el('div', 'lob-tabs', st) : null;
    const desc = modes.length > 1 ? el('div', 'lob-desc', st) : null;
    const grid = el('div', 'lob-grid', st);
    const quick = el('div', 'lob-quick', st, `<img src="${A('ui-premium-generated/buttons/pill_pink.png')}"><span>Chơi ngay!</span>`);
    let resolve; const done = new Promise(r => { resolve = r; });
    const sfx = n => { try { HC.sfx(n); } catch (e) {} };
    const sit = r => {
      const why = lockReason(r, mode);
      if (why) { sfx('error'); o.toast && o.toast(why + ' để vào bàn ' + r.name); return; }
      sfx('accept'); cleanup(); resolve({ room: r, mode });
    };
    function drawTabs() {
      if (!tabs) return;
      tabs.innerHTML = '';
      modes.forEach(m => { const t = el('div', 'lob-tab' + (m === mode ? ' on' : ''), tabs); t.textContent = m.name; t.onclick = () => { if (m === mode) return; mode = m; sfx('click'); drawTabs(); drawRooms(); }; });
      desc.innerHTML = mode.desc || '';
    }
    function drawRooms() {
      grid.innerHTML = '';
      const coins = HC.store.get('coins', 1250000), lvNow = playerLevel(), showAi = def.botLabel !== false && !LUCK[rooms[0] && rooms[0].kind];
      rooms.forEach((r, i) => {
        const why = lockReason(r, mode, coins, lvNow);
        const d = el('div', 'lob-room' + (why ? ' lock' : '') + (o.last && o.last.room === r.id && !why ? ' last' : ''), grid);
        d.style.cssText = `--rc:${r.color};background:linear-gradient(${r.grad[0]},${r.grad[1]});box-shadow:0 12px 0 ${r.color},0 22px 36px rgba(80,20,60,.25);animation-delay:${i * 60}ms`;
        d.dataset.room = r.id;
        const th = el('img', 'thumb', d); th.src = A(`bg-tables-generated/with-table/table_scene_${r.scene || 'mint'}.png`);
        el('div', 'online', d, '● ' + HC.fmt(online(key, r)) + ' đang chơi');
        const lk = el('img', 'lockic', d); lk.src = A('emoji-fluent-3d/game/locked.png');
        el('div', 'nm', d).textContent = r.name;
        const top = Math.max(...r.stakes), chip = { 1e3: '1k', 5e3: '5k', 1e4: '10k', 5e4: '50k', 1e5: '100k', 5e5: '500k', 1e6: '1m', 1e7: '10m' }[top];   // a price with no matching chip shows a coin
        el('div', 'info', d, `<img src="${A(chip ? `games/card-shared/chips/chip_${chip}.png` : 'emoji-fluent-3d/game/coin.png')}"><span>${def.stakeName || 'Cược'} ${stakeText(r)}</span>`);
        const need = Math.round(r.min * ((mode && mode.minMul) || 1));
        el('div', 'min', d).textContent = [need ? 'Tối thiểu ' + HC.short(need) + ' xu' : 'Không cần vốn', showAi ? 'Bot ' + r.aiName : r.lv > 1 && !why ? 'Từ cấp ' + r.lv : ''].filter(Boolean).join(' · ');
        el('div', 'go', d, `<img src="${A(why ? 'ui-premium-generated/buttons/pill_grey.png' : 'ui-premium-generated/buttons/pill_mint.png')}"><span>${why || 'Vào bàn'}</span>`);
        d.onclick = () => sit(r);
      });
      fit();
    }
    quick.onclick = () => {
      const ok = rooms.filter(r => !lockReason(r, mode));
      if (!ok.length) { sfx('error'); o.toast && o.toast('Chưa đủ xu cho bàn nào, về thị trấn nhận xu cứu trợ nhé'); return; }
      const last = o.last && ok.find(r => r.id === o.last.room);
      sit(last || ok[Math.min(ok.length - 1, 1)]);
    };
    /** Pick the column count that gives the biggest cards for this window. */
    function fit() {
      if (!root.isConnected) return;
      const W0 = innerWidth, top = Math.max(0, (o.topPx ? o.topPx() : 0)) + 6, H0 = Math.max(200, innerHeight - top - 6), n = rooms.length;
      const headH = 112 + (tabs ? 16 + Math.max(56, tabs.offsetHeight) + 16 + 44 : 0) + 16, footH = 16 + 128;
      let best = { s: 0, c: n };
      for (let c = 1; c <= n; c++) {
        const rows = Math.ceil(n / c), w = c * CW + (c - 1) * GAP + PAD * 2, h = headH + rows * CH + (rows - 1) * GAP + footH + 30;
        const s = Math.min(W0 / w, H0 / h);
        if (s > best.s + .01) best = { s, c };
      }
      const s = Math.min(1.25, best.s);
      grid.style.width = best.c * CW + (best.c - 1) * GAP + 'px';
      st.style.top = top + 'px'; st.style.width = W0 / s + 'px'; st.style.height = H0 / s + 'px'; st.style.transform = `scale(${s})`;
    }
    function cleanup() { removeEventListener('resize', fit); root.remove(); document.body.classList.remove('lobby-on', 'lobby-shot'); }
    addEventListener('resize', fit);
    drawTabs(); drawRooms();
    return { done, refresh: drawRooms, close: cleanup };
  }

  Object.assign(T3, { TIERS, ROOM_STAKES: STAKES, ROOM_KIND: KIND, roomsFor, modesFor, stakeText, lockReason, playerLevel, roomOnline: online, rulesHtml, lobby: show, AI_NAME });
})();
