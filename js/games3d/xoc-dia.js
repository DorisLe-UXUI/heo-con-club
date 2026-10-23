/* Xóc Đĩa 3D — the dealer shakes four red/white coins under a bowl, everyone bets, then the bowl is lifted.
 * Bet zones: CHẴN / LẺ (1 ăn 1), 4 ĐỎ / 4 TRẮNG (1 ăn 12), 3 ĐỎ 1 TRẮNG / 3 TRẮNG 1 ĐỎ (1 ăn 3).
 * Pure rules: js/games3d/rules/xoc-dia.js (tests: tests/xoc-dia.test.js). */
(function () {
  'use strict';
  // ---- table layout (table units; the rect table is 18 × 11, camera side = +z)
  const PZ = -3.05, PLATE_R = 1.75, BOWL = { x: 4.1, z: -3.45 }, BANK = { x: -4.1, z: -3.45 };
  const ZD = {
    chan: { x: -4.3, z: .35, w: 7.7, d: 2.5, c1: '#ffa6cb', c2: '#ff4f95', ink: '#a8245f', title: 'CHẴN', sub: '0 · 2 · 4 đỏ' },
    le: { x: 4.3, z: .35, w: 7.7, d: 2.5, c1: '#9ad6ff', c2: '#3d8bff', ink: '#1a56a6', title: 'LẺ', sub: '1 · 3 đỏ' },
    r4: { x: -6.25, z: 3.15, w: 3.75, d: 1.95, c1: '#ffe27a', c2: '#ffb21c', ink: '#9a5a00', title: '4 ĐỎ', coins: [1, 1, 1, 1] },
    w4: { x: -2.35, z: 3.15, w: 3.75, d: 1.95, c1: '#efe9f7', c2: '#ab9ec6', ink: '#4f4369', title: '4 TRẮNG', coins: [0, 0, 0, 0] },
    r3: { x: 2.35, z: 3.15, w: 3.75, d: 1.95, c1: '#ffbb94', c2: '#ff7a3d', ink: '#a8400f', title: '3 ĐỎ 1 TRẮNG', coins: [1, 1, 1, 0] },
    w3: { x: 6.25, z: 3.15, w: 3.75, d: 1.95, c1: '#d2c0ff', c2: '#8d6bff', ink: '#4f2fb8', title: '3 TRẮNG 1 ĐỎ', coins: [0, 0, 0, 1] },
  };
  const CHIPS = [1000, 5000, 10000, 50000, 100000, 500000];
  const COIN_SPOTS = [[-.6, -.45], [.58, -.52], [-.52, .58], [.64, .5]], COIN_R = .5;
  const TALK = {
    careful: { tag: 'Cẩn thận', bet: z => [`${z} thôi, chắc ăn 😌`, 'Đánh nhỏ cho vui nha', `Ủng hộ ${z} một chút`], win: ['Ăn ít mà chắc 😊', 'Cẩn thận là hơn hết!'], lose: ['Không sao, mất tí xíu 😅', 'Huhu, lần sau 🥲'] },
    trend: { tag: 'Theo cầu', bet: z => [`Cầu đẹp, theo ${z}! 📈`, `Soi cầu thấy ${z} rồi 😎`, `${z} chắc luôn!`], win: ['Cầu chuẩn không cần chỉnh 😎', 'Theo cầu là ăn!'], lose: ['Gãy cầu rồi 😭', 'Cầu lừa mình…'] },
    wild: { tag: 'Máu liều', bet: z => [`Tất tay ${z}! 🔥`, 'Hên xui mà 😜', `${z} về đi mà 🙏`], win: ['ĂN ĐẬM! 🤑', 'Biết ngay mà! 🎉'], lose: ['Bay màu rồi 💸', 'Ván sau gỡ! 😤'] },
  };

  T3.register('xoc-dia', {
    title: 'Xóc Đĩa', sub: 'Chẵn Lẻ · 4 đồng xu đỏ trắng',
    table: 'rect', theme: 'peach', tex: ['xoc-dia', 'chips'], scripts: ['js/games3d/rules/xoc-dia.js'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    cam: { pos: [0, 11.4, 15.6], look: [0, 0, -.35] },
    rules: `<p>Nhà cái úp bát lên đĩa có <b>4 đồng xu</b> (một mặt <b>đỏ</b>, một mặt <b>trắng</b>) rồi xóc. Bạn chọn mệnh giá phỉnh bên trái, chạm vào ô để đặt cược (đặt được nhiều ô), rồi bấm <b>MỞ BÁT</b>.</p>
      <ul><li><b>CHẴN</b>: 0, 2 hoặc 4 mặt đỏ ngửa · <b>1 ăn 1</b></li><li><b>LẺ</b>: 1 hoặc 3 mặt đỏ ngửa · <b>1 ăn 1</b></li>
      <li><b>4 ĐỎ</b> hoặc <b>4 TRẮNG</b> · <b>1 ăn 12</b></li><li><b>3 ĐỎ 1 TRẮNG</b> hoặc <b>3 TRẮNG 1 ĐỎ</b> · <b>1 ăn 3</b></li></ul>
      <p>Thắng thì được trả lại tiền cược cộng tiền thắng (ví dụ cược 10.000 vào 4 ĐỎ và trúng: nhận 130.000). Ô thua thì mất tiền cược ô đó.</p>
      <p>Bảng <b>Cầu</b> bên phải ghi kết quả các ván trước: <b>C</b> = Chẵn, <b>L</b> = Lẻ, xếp từ trên xuống, từ trái sang.</p>
      <p>Ở bàn chơi, đồng hồ trên cùng đếm ngược thời gian đặt cược; hết giờ nhà cái tự mở bát (kể cả khi bạn chưa đặt).</p>`,
    modes: [
      { id: 'thuong', name: 'Thường', desc: 'Mỗi ván có 30 giây đặt cược. Đặt xong có thể bấm MỞ BÁT sớm.', rules: '30 giây đặt cược mỗi ván, hết giờ nhà cái tự mở bát.' },
      { id: 'nhanh', name: 'Nhanh', desc: 'Chỉ 12 giây đặt cược, hết giờ nhà cái tự mở bát — ván nối ván liên tục.', rules: '12 giây đặt cược mỗi ván, mở bát xong là sang ván mới ngay.' },
    ],
    async start(ctx) {
      const g = await setup(ctx, false);
      await g.newRound();
      if (ctx.Q.has('demo')) await g.demo();
    },
    async selftest(ctx) { const g = await setup(ctx, true); return g.selftest(); },
  });

  // ------------------------------------------------------------------ helpers
  function css(id, text) { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = text; document.head.appendChild(s); }
  const loadImg = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  /** Keep the whole table in view on narrow windows: move the camera back along its view line. */
  function fitCamera(ctx, base) {
    const apply = () => {
      const cam = ctx.camera, asp = cam.aspect, tanV = Math.tan(cam.fov * Math.PI / 360), need = Math.tan(20 * Math.PI / 180) * 16 / 9;
      const k = Math.max(1, need / (tanV * asp)), t = Math.max(0, Math.min(1, (16 / 9 - asp) / (16 / 9 - 1)));
      const off = base.pos.map((p, i) => p - base.look[i]), horiz = Math.hypot(off[0], off[2]) || 1, len = Math.hypot(...off) * k * (1 - t * .1);
      const el = Math.atan2(off[1], horiz) + t * .28, look = [base.look[0], base.look[1], base.look[2] + t * .9];   // narrow windows: look a bit more from above
      ctx.camTo({ pos: [look[0] + off[0] / horiz * Math.cos(el) * len, look[1] + Math.sin(el) * len, look[2] + off[2] / horiz * Math.cos(el) * len], look }, 0);
    };
    const orig = ctx.resize.bind(ctx); ctx.resize = (...a) => { orig(...a); apply(); }; apply();
  }

  /** Frame-driven animation (scaled like ctx.tween in test / screenshot mode). step(k) gets 0..1. */
  const anim = (ctx, ms, step) => new Promise(res => { const t0 = performance.now(), dur = Math.max(1, ms * ctx.timeScale); ctx.onFrame(() => { const k = Math.min(1, (performance.now() - t0) / dur); step(k); if (k >= 1) { res(); return false; } }); });
  function outlineText(x, text, cx, cy, size, ink, font = 'Grandstander Black') {
    x.font = `400 ${size}px "${font}"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.strokeStyle = '#fff'; x.lineWidth = size * .34; x.strokeText(text, cx, cy);
    x.strokeStyle = ink; x.lineWidth = size * .2; x.strokeText(text, cx, cy);
    x.fillStyle = '#fff'; x.fillText(text, cx, cy);
  }

  /** A label target that stays clear of the top bar (title box, coin pill, buttons): first a small sideways nudge, else it slides down. */
  function clearOfTopBar(ctx, el, base, extraTop = 18) {
    const T = ctx.THREE, sel = ['#back', '#where', '#top .pill', '#rulesBtn', '#sndBtn'];
    return () => {
      const p = ctx.toUI(base), w = el.offsetWidth || 220, hgt = (el.offsetHeight || 80) + extraTop, u = ctx.uiScale || 1;
      const rects = sel.map(s => document.querySelector(s)).filter(Boolean).map(n => { const r = n.getBoundingClientRect(); return { l: r.left / u - 8, r: r.right / u + 8, b: r.bottom / u + 8 }; });
      const hits = (x, y) => rects.filter(r => y - hgt < r.b && x + w / 2 > r.l && x - w / 2 < r.r);
      const now = hits(p.x, p.y);
      if (!now.length) return base;
      for (const r of now) for (const nx of [r.l - w / 2, r.r + w / 2]) {
        if (Math.abs(nx - p.x) > 90 || hits(nx, p.y).length) continue;
        const q = ctx.toUI(new T.Vector3(base.x + 1, base.y, base.z)), ppx = q.x - p.x || 1;
        return new T.Vector3(base.x + (nx - p.x) / ppx, base.y, base.z);
      }
      const minY = Math.max(...now.map(r => r.b + hgt)), q = ctx.toUI(new T.Vector3(base.x, base.y - 1, base.z)), ppu = Math.max(1, q.y - p.y);
      return new T.Vector3(base.x, base.y - (minY - p.y) / ppu, base.z);
    };
  }

  /** Simulate a finger tap on the canvas at a 3D point (exercises the real picking path in self-tests). */
  function tapAt(ctx, v3) {
    const cv = ctx.el.canvas, r = cv.getBoundingClientRect(), v = v3.clone().project(ctx.camera);
    const o = { clientX: r.left + (v.x + 1) / 2 * r.width, clientY: r.top + (1 - v.y) / 2 * r.height, bubbles: true, pointerId: 1, pointerType: 'mouse' };
    cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o));
  }

  // ------------------------------------------------------------------ the game
  async function setup(ctx, test) {
    const T = ctx.THREE, H = ctx.H, R = window.Rules['xoc-dia'], rand = ctx.rand;
    ctx.music('dice');
    fitCamera(ctx, ctx.def.cam);
    css('xd-css', `
      .xd-road{position:absolute;right:16px;top:132px;padding:12px 14px 14px;border-radius:30px;display:flex;flex-direction:column;gap:8px;align-items:center}
      .xd-road .hd{display:flex;align-items:center;gap:12px;font:400 26px "Grandstander Black";color:#b8542a}
      .xd-road .hd span{display:flex;align-items:center;gap:4px;font:400 22px "Grandstander Black";color:#7a5a6e}.xd-road .hd img{width:26px;height:26px}
      .xd-road .grid{display:grid;grid-template-rows:repeat(6,30px);grid-auto-flow:column;grid-auto-columns:30px;gap:4px;padding:8px;border-radius:18px;background:#fff4ec;box-shadow:inset 0 0 0 3px #ffe0cc}
      .xd-road .grid img,.xd-road .grid i{width:30px;height:30px;display:block;border-radius:50%}
      .xd-road .grid i{background:rgba(255,200,170,.25)}
      .xd-road .grid img.new{animation:xdpulse 1s ease-in-out infinite alternate;filter:drop-shadow(0 0 6px #ffd23c)}
      @keyframes xdpulse{to{transform:scale(1.18)}}
      .xd-road .last{display:flex;align-items:center;gap:6px;font:800 20px "Baloo 2";color:#8a6a80}.xd-road .last img{width:28px}
      .xd-bet{padding:2px 14px;border-radius:16px;font:400 24px "Grandstander Black";color:#fff;background:linear-gradient(#ff9cc4,#ff4f95);box-shadow:0 4px 0 #c2407a;border:3px solid #fff}
      .xd-res{padding:8px 26px;border-radius:30px;font:400 40px "Grandstander Black";color:#fff;border:4px solid #fff;box-shadow:0 6px 0 rgba(0,0,0,.18),0 10px 22px rgba(60,10,50,.25);display:flex;align-items:center;gap:12px}
      .xd-res small{font:800 24px "Baloo 2";opacity:.95}
      .xd-res.chan{background:linear-gradient(#ffb3d1,#ff4f95)}.xd-res.le{background:linear-gradient(#a8dcff,#3d8bff)}
    `);
    await Promise.race([Promise.all(['400 80px "Grandstander Black"', '800 40px "Baloo 2"', '400 40px "Grandstander Black"'].map(f => document.fonts.load(f))), ctx.wait(1500)]);
    const [imRed, imWhite] = await Promise.all([loadImg((window.HC_TEX || {}).xd_red), loadImg((window.HC_TEX || {}).xd_white)]);

    // ---- bet zones: rounded tiles with a painted face
    const zones = {};
    for (const z of R.ZONES) {
      const d = ZD[z.id], g = new T.Group(); g.position.set(d.x, 0, d.z);
      const base = new T.Mesh(H.roundedBox(d.w, .22, d.d, .16, 2), ctx.mat(0xfffaf3, { roughness: .45 })); base.position.y = .11; base.castShadow = true; base.receiveShadow = true; g.add(base);
      const PX = 128, cw = Math.round(d.w * PX), ch = Math.round(d.d * PX);
      const faceTex = T3.canvasTex(cw, ch, (x, w, h) => {
        const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, d.c1); gr.addColorStop(1, d.c2);
        x.fillStyle = gr; T3.rr(x, 4, 4, w - 8, h - 8, 34); x.fill();
        x.fillStyle = 'rgba(255,255,255,.22)'; T3.rr(x, 18, 14, w - 36, h * .4, 26); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 6; T3.rr(x, 8, 8, w - 16, h - 16, 30); x.stroke();
        const odds = `1 ăn ${z.odds}`;
        if (d.coins) {
          const s = h * .26, gap = s * 1.1, x0 = w / 2 - gap * 1.5;
          d.coins.forEach((c, i) => { const im = c ? imRed : imWhite, cx = x0 + i * gap, cy = h * .27; x.save(); x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 6; x.shadowOffsetY = 3; if (im) x.drawImage(im, cx - s / 2, cy - s / 2, s, s); else { x.fillStyle = c ? '#ff5a5a' : '#fff'; x.beginPath(); x.arc(cx, cy, s / 2, 0, 7); x.fill(); } x.restore(); });
          outlineText(x, d.title, w / 2, h * .58, d.title.length > 6 ? h * .17 : h * .22, d.ink);
          x.font = '800 30px "Baloo 2"'; const tw = x.measureText(odds).width + 34; x.fillStyle = 'rgba(255,255,255,.92)'; T3.rr(x, w / 2 - tw / 2, h * .74, tw, 42, 21); x.fill();
          x.fillStyle = d.ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(odds, w / 2, h * .74 + 22);
        } else {
          outlineText(x, d.title, w / 2, h * .44, h * .4, d.ink);
          x.font = '800 34px "Baloo 2"'; const label = `${odds} · ${d.sub}`, tw = x.measureText(label).width + 40; x.fillStyle = 'rgba(255,255,255,.92)'; T3.rr(x, w / 2 - tw / 2, h * .74, tw, 48, 24); x.fill();
          x.fillStyle = d.ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, w / 2, h * .74 + 25);
        }
      });
      const face = new T.Mesh(new T.PlaneGeometry(d.w - .12, d.d - .12), new T.MeshStandardMaterial({ map: faceTex, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: .16, roughness: .6, transparent: true }));
      face.rotation.x = -Math.PI / 2; face.position.y = .225; face.receiveShadow = true; g.add(face);
      // winner rim: a bright frame peeking out under the tile
      const glow = new T.Mesh(H.roundedBox(d.w + .4, .16, d.d + .4, .2, 2), new T.MeshBasicMaterial({ color: 0xfff06a, transparent: true, opacity: 0, toneMapped: false }));
      glow.position.y = .08; g.add(glow);
      ctx.add(g);
      const zo = zones[z.id] = { id: z.id, def: d, rule: z, g, base, face, glow, spots: [[], [], [], []], label: null };
      ctx.pickable(g, () => placeBet(z.id), on => { base.material.emissive.setHex(on ? 0x553311 : 0); });
      zo.label = ctx.label(() => { const p = spot(z.id, 0), n = zo.spots[0].length; return new T.Vector3(p.x, .5 + Math.min(n, 10) * .1, p.z); }, '', '');
    }
    /** Where an owner's chips sit on a zone (0 = you, 1..3 = bots). */
    function spot(id, o) { const d = ZD[id], f = [[-.27, .2], [.27, .2], [.27, -.22], [-.27, -.22]][o]; return { x: d.x + f[0] * d.w, z: d.z + f[1] * d.d }; }

    // ---- plate, coins, bowl, the dealer's chip bank
    const rig = new T.Group(); rig.position.set(0, 0, PZ); ctx.add(rig);
    rig.add(ctx.plate(0xfffaf5, PLATE_R));
    const coins = [0, 1, 2, 3].map(i => { const c = ctx.coin2('xd_red', 'xd_white', COIN_R); c.children.slice(0, 2).forEach(m => { m.material.emissive.setHex(0xffffff); m.material.emissiveMap = m.material.map; m.material.emissiveIntensity = .12; m.material.roughness = .62; }); c.rotation.order = 'YXZ'; c.position.set(COIN_SPOTS[i][0], .255, COIN_SPOTS[i][1]); c.rotation.y = rand() * 6; c.traverse(m => { if (m.isMesh) m.castShadow = true; }); rig.add(c); return c; });
    const showCoins = (res, jitter = true) => coins.forEach((c, i) => { c.rotation.set(res[i] ? 0 : Math.PI, rand() * 6, 0); c.position.set(COIN_SPOTS[i][0] + (jitter ? (rand() - .5) * .22 : 0), .255, COIN_SPOTS[i][1] + (jitter ? (rand() - .5) * .22 : 0)); });
    showCoins([true, false, true, false]);
    const bowl = ctx.bowl(0xff8f7a, 1.55); bowl.position.set(BOWL.x, 0, BOWL.z); bowl.traverse(m => { if (m.isMesh) m.castShadow = true; }); ctx.add(bowl);
    const bank = new T.Group(); bank.position.set(BANK.x, 0, BANK.z); ctx.add(bank);
    const tray = new T.Mesh(H.roundedBox(2.9, .2, 1.6, .12, 2), ctx.mat(0xfff1e6, { roughness: .5 })); tray.position.y = .1; tray.castShadow = tray.receiveShadow = true; bank.add(tray);
    ['100k', '50k', '10k', '5k', '1k'].forEach((k, i) => { for (let j = 0; j < 3 + ((i * 7) % 4); j++) { const c = ctx.chip(k); c.position.set(-1.0 + i * .5, .25 + j * .1, (i % 2 ? .3 : -.25)); c.rotation.y = rand() * 6; bank.add(c); } });

    // ---- players
    const seats = await ctx.seats(4, { angles: [90, 235, 270, 305], r: 8.2 });
    const me = seats[0], bots = seats.slice(1);
    const styles = ctx.shuffle(['careful', 'trend', 'wild']);
    bots.forEach((b, i) => {
      b.style = styles[i]; b.idx = i + 1;
      const a = b.angle, bx = Math.cos(a) * 9.4, bz = Math.sin(a) * 9.4;
      b.hand = new T.Vector3(Math.cos(a) * 7.2, 1.4, Math.sin(a) * 7.2);
      const ly = (b.key.startsWith('mini') ? 2.3 : 2.7) - (Math.abs(bx) < 1 ? .3 : 0);
      b.label.target = clearOfTopBar(ctx, b.label.el, new T.Vector3(bx, ly, bz));
      b.label.el.insertAdjacentHTML('beforeend', `<i>${TALK[b.style].tag}</i>`);
      const side = bx < -1 ? 1 : bx > 1 ? -1 : 1;
      b._bub = ctx.label(() => new T.Vector3(bx + side * 2.6, 1.5, bz + 1), '', 'bub3');   // speech bubble beside the head, not under the HUD
    });

    // ---- HUD: chip picker, bead road, actions
    const picker = ctx.ui.chipPicker(CHIPS, null, 2);
    // betting clock at a lobby table: Thường 30 s, Nhanh 12 s; when it runs out the dealer opens anyway
    const fast = ctx.mode && ctx.mode.id === 'nhanh', BET_SEC = ctx.room && !test ? (fast ? 12 : 30) : 0;
    let clock = null;
    const startClock = () => { if (!BET_SEC) return; clock = ctx.ui.countdown(BET_SEC, () => { clock = null; if (!ctx.SHOT) openAndContinue(null, true); }); };
    const hist = []; for (let i = 0; i < 14; i++) hist.push(R.reds(R.toss(rand)));   // the table has been running for a while
    const road = ctx.ui.h('div', { class: 'xd-road glass' }, ctx.ui.root);
    function drawRoad() {
      const res = hist.map(r => (r % 2 ? 'le' : 'chan')), rd = R.road(res, 6, 8), nC = res.filter(x => x === 'chan').length;
      const cells = []; rd.cols.forEach(col => col.forEach(x => cells.push(x)));
      let html = `<div class="hd">Cầu<span><img src="${HC.A('games/xoc-dia/history_chan.png')}">${nC}</span><span><img src="${HC.A('games/xoc-dia/history_le.png')}">${res.length - nC}</span></div><div class="grid">`;
      for (let i = 0; i < 48; i++) html += i < cells.length ? `<img class="${i === cells.length - 1 ? 'new' : ''}" src="${HC.A(cells[i] === 'chan' ? 'games/xoc-dia/history_chan.png' : 'games/xoc-dia/history_le.png')}">` : '<i></i>';
      const last = hist[hist.length - 1], lc = R.coinsFor(last);
      html += `</div><div class="last">Ván trước: ${lc.map(c => `<img src="${HC.A(c ? 'games/xoc-dia/coin_red.png' : 'games/xoc-dia/coin_white.png')}">`).join('')}</div>`;
      road.innerHTML = html;
    }
    drawRoad();

    // ---- state
    let phase = 'idle', roundNo = 0, myBets = {}, myOrder = [], lastOrder = [], botBets = [], resTag = null;
    const myTotal = () => Object.values(myBets).reduce((a, b) => a + b, 0);
    const acts = ctx.ui.actions([
      { id: 'clear', label: 'Xoá cược', cls: 'grey', onClick: () => clearMine() },
      { id: 'again', label: 'Đặt lại', cls: 'sky', onClick: () => rebet() },
      { id: 'open', label: 'MỞ BÁT!', cls: 'pink', icon: 'games/xoc-dia/coin_red.png', onClick: () => openAndContinue() },
    ]);
    function refresh() {
      const betting = phase === 'betting', tot = myTotal();
      acts.set('open', { disabled: !betting || !tot }); acts.set('clear', { disabled: !betting || !tot }); acts.set('again', { disabled: !betting || !lastOrder.length || tot > 0 });
      for (const id in zones) { const v = myBets[id] || 0; zones[id].label.el.innerHTML = v ? `<div class="xd-bet">${HC.short(v)}</div>` : ''; }
      if (phase === 'shaking') ctx.ui.status('Nhà cái đang xóc đĩa… xóc xóc xóc 🎶');
      else if (betting) ctx.ui.status(tot ? `Bạn cược <b>${HC.fmt(tot)}</b> · bấm <b>MỞ BÁT</b> khi sẵn sàng` : 'Mời đặt cược! Chọn phỉnh bên trái rồi chạm vào ô');
      else if (phase === 'opening') ctx.ui.status('Mở bát nào… 👀');
    }

    // ---- chips
    function chipAt(id, o, amount, from) {
      const st = zones[id].spots[o], n = st.length, p = spot(id, o), c = ctx.chip(ctx.chipKey(amount));
      const tx = p.x + Math.floor(n / 10) * .3, ty = .27 + (n % 10) * .1;
      c.rotation.y = rand() * 6; c.userData.amount = amount; st.push(c); ctx.add(c);
      if (from) { c.position.copy(from); ctx.tween(c, { x: tx, y: ty, z: p.z, arc: 1.2 }, 420, 'out'); }
      else { c.position.set(tx, ty + (test ? 0 : 2.2), p.z); if (!test) ctx.tween(c, { y: ty }, 260, 'bounce'); }
      return c;
    }
    function placeBet(id, amount) {
      if (phase !== 'betting') { if (phase === 'shaking') ctx.ui.toast('Đợi nhà cái xóc xong đã nha 😊', 'emoji-fluent-3d/game/game_die.png'); return false; }
      amount = amount || picker.value;
      if (!ctx.spend(amount)) return false;
      myBets[id] = (myBets[id] || 0) + amount; myOrder.push([id, amount]);
      chipAt(id, 0, amount); ctx.sfx('chip', .4); refresh();
      return true;
    }
    function clearMine() {
      if (phase !== 'betting') return;
      const tot = myTotal(); if (!tot) return;
      for (const id in zones) { zones[id].spots[0].forEach(c => ctx.tween(c, { x: 0, y: 2, z: 7.5, arc: 1 }, 380, 'io').then(() => ctx.remove(c))); zones[id].spots[0] = []; }
      myBets = {}; myOrder = [];
      ctx.refund(tot, new T.Vector3(0, 1, 3));       // stake handed back
      refresh();
    }
    function rebet() { if (phase !== 'betting' || myTotal()) return; for (const [id, a] of lastOrder) if (!placeBet(id, a)) break; }
    async function botsBet(round) {
      await Promise.all(bots.map(async (b, i) => {
        await ctx.wait(250 + i * 380 + rand() * 900);
        if (phase !== 'betting' || round !== roundNo) return;
        const plan = R.botPlan(rand, b.style, hist.map(r => (r % 2 ? 'le' : 'chan')), ctx.room ? ctx.room.stakes : [1000, 5000, 10000, 50000], b.coins);
        if (plan.length) { const zn = R.zone(plan[0].zone).name; b.say(ctx.pick(TALK[b.style].bet(zn))); if (b.style === 'wild') b.anim('cheer'); }
        for (const bet of plan) {
          if (phase !== 'betting' || round !== roundNo) return;
          b.setCoins(b.coins - bet.amount);
          botBets.push({ b, zone: bet.zone, amount: bet.amount, chip: chipAt(bet.zone, b.idx, bet.amount, b.hand) });
          ctx.sfx('chip', .25);
          await ctx.wait(260 + rand() * 520);
        }
      }));
    }

    // ---- shake: cover the plate, lift plate + bowl together, rattle, set down
    async function newRound() {
      phase = 'shaking'; roundNo++; refresh();
      if (resTag) { resTag.remove(); resTag = null; }
      for (const id in zones) { const z = zones[id]; z.glow.material.opacity = 0; z.face.material.color.setHex(0xffffff); z.face.material.emissiveIntensity = .16; }
      await ctx.tween(bowl, { x: 0, y: .22, z: PZ, rx: 0, rz: 0, arc: 1.8 }, 520, 'io');
      rig.attach(bowl);
      ctx.sfx('dice', .55);
      await ctx.tween(rig, { y: 1.5 }, 260, 'out');
      for (let i = 0; i < 10; i++) {
        const s = i % 2 ? -1 : 1;
        coins.forEach(c => { c.rotation.x = rand() < .5 ? 0 : Math.PI; });          // hidden under the bowl: just jumble them
        if (i % 3 === 0) ctx.sfx('dice', .45);
        await ctx.tween(rig, { x: s * .32, z: PZ + (i % 3 - 1) * .15, rz: s * .16, rx: (i % 4 - 1.5) * .06, y: 1.5 + (i % 3) * .12 }, 75, 'io');
      }
      await ctx.tween(rig, { x: 0, z: PZ, rz: 0, rx: 0, y: 0 }, 300, 'bounce');
      ctx.scene.attach(bowl);
      phase = 'betting'; refresh(); startClock();
      bots.forEach(b => { if (ctx.topUp(b, 60000, 500000)) b.say('Nạp thêm xu chơi tiếp nè 😅'); });   // bots never go broke
      botsBet(roundNo);
    }

    // ---- open: lift the bowl, the coins spin on their edges and fall flat showing the result
    async function reveal(res) {
      coins.forEach((c, i) => { c.rotation.set(Math.PI / 2, rand() * 6, 0); c.position.set(COIN_SPOTS[i][0] + (rand() - .5) * .2, .22 + COIN_R, COIN_SPOTS[i][1] + (rand() - .5) * .2); });
      ctx.sfx('diceThrow', .5);
      await ctx.tween(bowl, { y: .75 }, 420, 'io');                  // peek…
      const spins = coins.map((c, i) => (async () => {
        await ctx.wait(i * 140);
        const ry0 = c.rotation.y, turns = 6 + rand() * 4, target = res[i] ? 0 : Math.PI, from = Math.PI / 2;
        await anim(ctx, 1000 + rand() * 300, k => {
          const tilt = from + (target - from) * (k * k * k), wob = Math.sin(k * 26) * .06 * (1 - k);
          c.rotation.y = ry0 + turns * Math.PI * 2 * (1 - (1 - k) * (1 - k));
          c.rotation.x = tilt + wob;
          const flat = Math.min(Math.abs(c.rotation.x), Math.abs(Math.PI - c.rotation.x));
          c.position.y = .22 + COIN_R * Math.sin(flat) + .03 * Math.cos(flat);
        });
        c.rotation.x = target; c.position.y = .255; ctx.sfx('chip', .3);
      })());
      await ctx.tween(bowl, { x: BOWL.x, y: 0, z: BOWL.z, arc: 2.6 }, 650, 'io');
      await Promise.all(spins);
    }

    async function open(forced, timeUp) {
      if (phase !== 'betting' || (!myTotal() && !timeUp)) return null;
      if (clock) { clock.stop(); clock = null; }
      phase = 'opening'; refresh();
      const res = forced ? forced.slice() : R.toss(rand), nRed = R.reds(res), par = R.parity(res);
      if (myOrder.length) lastOrder = myOrder.slice();
      await reveal(res);
      phase = 'result';
      // shout the result
      hist.push(nRed); drawRoad();
      const word = par === 'chan' ? 'CHẴN' : 'LẺ';
      resTag = ctx.label(new T.Vector3(0, 1.05, PZ - 1.1), `<div class="xd-res ${par}">${word}<small>${R.describe(res)}</small></div>`, '');
      ctx.ui.callout(word + '!', par === 'chan' ? '#c2407a' : '#1f62b0');
      ctx.sfx('pop', .5);
      const winners = Object.keys(zones).filter(id => R.wins(id, res));
      for (const id in zones) {
        const z = zones[id], w = winners.includes(id);
        z.glow.material.opacity = w ? 1 : 0; if (!w) { z.face.material.color.setHex(0xb8b0b8); z.face.material.emissiveIntensity = .04; }
        if (w) ctx.tween(z.g, { y: .3 }, 160, 'out').then(() => ctx.tween(z.g, { y: 0 }, 260, 'bounce'));
      }
      const mine = R.settle(myBets, res);
      const result = { coins: res, reds: nRed, parity: par, bets: Object.assign({}, myBets), back: mine.back, net: mine.net, staked: mine.staked };
      if (mine.staked) { ctx.track('round', { net: mine.net, bet: mine.staked }); if (nRed === 0 || nRed === 4) ctx.track('combo', { kind: 'tu_tu' }); } ctx.roundBet = 0;
      ctx.ui.status(`Ra <b>${R.describe(res)}</b> · ${word} · ${mine.net > 0 ? `bạn lời <b>+${HC.fmt(mine.net)}</b> 🎉` : mine.net < 0 ? (mine.back ? `thu về ${HC.fmt(mine.back)}, lỗ ${HC.fmt(-mine.net)}` : `bạn mất ${HC.fmt(-mine.net)} 🥲`) : 'hoà vốn'}`);
      if (ctx.SHOT && ctx.Q.has('demo')) return result;          // keep the reveal on screen for the screenshot
      await ctx.wait(700);
      // losing chips go to the dealer, winning ones get paid and fly home
      const flights = [];
      for (const id in zones) {
        const z = zones[id], w = winners.includes(id);
        z.spots.forEach((st, o) => {
          if (!st.length) return;
          if (!w) { st.forEach((c, k) => flights.push(ctx.wait(k * 25).then(() => ctx.tween(c, { x: BANK.x + (rand() - .5), y: .4, z: BANK.z, arc: 1.4 }, 520, 'io')).then(() => ctx.remove(c)))); return; }
          const stake = st.reduce((a, c) => a + c.userData.amount, 0), p = spot(id, o);
          const pay = ctx.stack(stake * z.rule.odds, BANK.x, BANK.z); pay.position.y = .25;
          flights.push(ctx.moveStack(pay, p.x + .55, p.z + .1, 520).then(async () => {
            await ctx.wait(350);
            const dest = o === 0 ? { x: 0, y: 2.2, z: 8 } : { x: bots[o - 1].hand.x, y: 1.8, z: bots[o - 1].hand.z };
            await Promise.all([ctx.tween(pay, Object.assign({ arc: 1 }, dest), 560, 'io').then(() => ctx.remove(pay)), ...st.map(c => ctx.tween(c, Object.assign({ arc: 1 }, dest), 560, 'io').then(() => ctx.remove(c)))]);
          }));
        });
      }
      ctx.sfx('chips', .4);
      await Promise.all(flights);
      for (const id in zones) zones[id].spots = [[], [], [], []];
      // bots
      for (const b of bots) {
        const mineB = {}; botBets.filter(x => x.b === b).forEach(x => { mineB[x.zone] = (mineB[x.zone] || 0) + x.amount; });
        const s = R.settle(mineB, res); if (!s.staked) continue;
        b.setCoins(b.coins + s.back);
        if (s.net > 0) { b.anim('cheer'); if (rand() < .7) b.say(ctx.pick(TALK[b.style].win)); } else if (s.net < 0) { b.anim('sad'); if (rand() < .5) b.say(ctx.pick(TALK[b.style].lose)); }
      }
      botBets = [];
      // you
      if (mine.back) ctx.win(mine.back, new T.Vector3(0, 1, 4));
      const big = mine.net > 0 && (mine.per.r4 || mine.per.w4 || mine.net >= mine.staked * 3);
      if (mine.net > 0) { setTimeout(() => ctx.ui.callout(big ? 'ĂN ĐẬM!' : 'THẮNG!'), 500); ctx.sfx('win', .5); if (big) ctx.ui.confetti(); }
      else if (mine.net < 0) { ctx.sfx('lose', .3); ctx.ui.toast(`Ra ${R.describe(res)} · ${mine.back ? `thu về ${HC.fmt(mine.back)}` : 'không trúng ô nào'} 🥲`, mine.back ? 'emoji-fluent-3d/game/coin.png' : 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); }
      myBets = {}; myOrder = [];
      await ctx.wait(test ? 150 : fast ? 900 : 1800);
      return result;
    }
    let busy = false;
    async function openAndContinue(forced, timeUp) {
      if (busy || phase !== 'betting') return null;
      busy = true;
      try { const r = await open(forced, timeUp); if (r && !(ctx.SHOT && ctx.Q.has('demo'))) await newRound(); return r; }
      catch (e) { console.error(e); ctx.ui.toast('Lỗi: ' + e.message); }
      finally { busy = false; }
    }

    // ---- demo (screenshots): a few bets, bots join, open
    async function demo() {
      placeBet('chan', 50000); placeBet('chan', 10000); placeBet('r3', 10000); placeBet('w4', 5000);
      await ctx.wait(3200);
      await openAndContinue([true, true, false, false]);
    }

    // ---- self-test: forced results, exact coin accounting
    async function selftest() {
      const out = { pass: 0, fail: 0, rounds: [] };
      const check = (name, ok, info) => { out.rounds.push(Object.assign({ name, ok }, info)); if (!ok) out.fail++; };
      await newRound();
      // round 1: 4 red → Chẵn and 4 Đỏ win
      let c0 = ctx.coins;
      placeBet('chan', 10000); placeBet('chan', 5000); placeBet('r4', 1000); placeBet('le', 5000); placeBet('w3', 1000);
      let spent = c0 - ctx.coins, r = await openAndContinue([true, true, true, true]);
      check('4 đỏ', spent === 22000 && r.back === 15000 * 2 + 1000 * 13 && ctx.coins === c0 - 22000 + 43000, { spent, back: r.back, delta: ctx.coins - c0 });
      // round 2: 3 red → Lẻ and 3 Đỏ 1 Trắng win
      c0 = ctx.coins;
      placeBet('le', 10000); placeBet('r3', 5000); placeBet('w3', 5000); placeBet('w4', 1000);
      spent = c0 - ctx.coins; r = await openAndContinue([true, false, true, true]);
      check('3 đỏ 1 trắng', spent === 21000 && r.back === 20000 + 20000 && ctx.coins === c0 + 19000 && r.parity === 'le', { spent, back: r.back, delta: ctx.coins - c0 });
      // round 3: clear refunds exactly, "Đặt lại" replays the last bets, then 4 white → 4 Trắng wins, Lẻ/3Đ1T lose
      c0 = ctx.coins;
      placeBet('chan', 50000); clearMine();
      const refundOk = ctx.coins === c0;
      rebet(); spent = c0 - ctx.coins;
      r = await openAndContinue([false, false, false, false]);
      check('clear + đặt lại + 4 trắng', refundOk && spent === 21000 && r.back === 13000 && ctx.coins === c0 - 21000 + 13000, { refundOk, spent, back: r.back, delta: ctx.coins - c0 });
      // tapping a tile on screen places the selected chip there (real raycast path)
      c0 = ctx.coins; tapAt(ctx, new T.Vector3(ZD.le.x, .25, ZD.le.z)); tapAt(ctx, new T.Vector3(ZD.r4.x + .9, .25, ZD.r4.z));
      check('chạm ô để cược', myBets.le === picker.value && myBets.r4 === picker.value && ctx.coins === c0 - 2 * picker.value, { le: myBets.le, r4: myBets.r4 });
      clearMine();
      // round 4: no bet → cannot open; random result settles by the rules
      const none = await openAndContinue();
      c0 = ctx.coins; placeBet('chan', 1000); placeBet('le', 1000);
      r = await openAndContinue();
      check('chẵn+lẻ hoà vốn', none === null && r.back === 2000 && ctx.coins === c0, { reds: r.reds });
      out.history = hist.length; out.botsCoins = bots.map(b => b.coins);
      out.checks = out.rounds.length; out.pass = out.fail ? 0 : 1;
      return out;
    }
    return { newRound, demo, selftest, placeBet, open: openAndContinue };
  }
})();
