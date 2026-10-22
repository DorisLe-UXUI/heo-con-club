/* Tài Xỉu 3D — three dice shaken under a bowl on a plate. Bet TÀI (11–17) / XỈU (4–10) at 1:1 (both lose on a triple),
 * BÃO (any triple) at 1:24, or an exact sum 4..17. Pure rules: js/games3d/rules/tai-xiu.js (tests: tests/tai-xiu.test.js). */
(function () {
  'use strict';
  const PZ = -3.1, PLATE_R = 1.7, BOWL = { x: 4.2, z: -3.5 }, BANK = { x: -4.2, z: -3.5 };
  const DIE = .78, DICE_SPOTS = [[-.62, .36], [.64, .3], [.02, -.6]];
  const CHIPS = [1000, 5000, 10000, 50000, 100000, 500000];
  const RED = { c1: '#ff9a9a', c2: '#ff4f6a', ink: '#a51f3a' }, BLUE = { c1: '#9ad6ff', c2: '#3d8bff', ink: '#1a56a6' }, GOLD = { c1: '#ffe27a', c2: '#ffb21c', ink: '#9a5a00' };
  const ZD = {
    tai: Object.assign({ x: -5.35, z: -.08, w: 6.3, d: 2.05, title: 'TÀI', sub: '11 – 17' }, RED),
    bao: Object.assign({ x: 0, z: -.08, w: 3.9, d: 2.05, title: 'BÃO', sub: 'bộ ba bất kỳ' }, GOLD),
    xiu: Object.assign({ x: 5.35, z: -.08, w: 6.3, d: 2.05, title: 'XỈU', sub: '4 – 10' }, BLUE),
  };
  for (let s = 4; s <= 17; s++) { const k = (s - 4) % 7, row = s <= 10 ? 0 : 1; ZD['s' + s] = Object.assign({ x: -7.26 + k * 2.42, z: 1.88 + row * 1.46, w: 2.3, d: 1.32, title: String(s), small: true }, s <= 10 ? { c1: '#d6ecff', c2: '#8cc4ff', ink: '#1a56a6' } : { c1: '#ffd6dc', c2: '#ff9aa8', ink: '#a51f3a' }); }
  const TALK = {
    careful: { tag: 'Cẩn thận', bet: z => [`${z} thôi, chắc ăn 😌`, 'Đánh nhỏ cho vui nha', `Ủng hộ ${z} một xíu`], win: ['Ăn ít mà chắc 😊', 'Cẩn thận là hơn hết!'], lose: ['Không sao, mất tí xíu 😅', 'Huhu, lần sau 🥲'] },
    trend: { tag: 'Theo cầu', bet: z => [`Cầu đẹp, theo ${z}! 📈`, `Soi cầu thấy ${z} rồi 😎`, `${z} chắc luôn!`], win: ['Cầu chuẩn không cần chỉnh 😎', 'Theo cầu là ăn!'], lose: ['Gãy cầu rồi 😭', 'Cầu lừa mình…'] },
    wild: { tag: 'Máu liều', bet: z => [`Tất tay ${z}! 🔥`, 'Hên xui mà 😜', 'Bão về đi bão ơi 🌪️'], win: ['ĂN ĐẬM! 🤑', 'Biết ngay mà! 🎉'], lose: ['Bay màu rồi 💸', 'Ván sau gỡ! 😤'] },
  };

  T3.register('tai-xiu', {
    title: 'Tài Xỉu', sub: '3 xúc xắc · Tài 11–17 · Xỉu 4–10',
    table: 'rect', theme: 'lavender', tex: ['chips'], scripts: ['js/games3d/rules/tai-xiu.js'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    cam: { pos: [0, 11.6, 15.4], look: [0, 0, -.25] },
    rules: `<p>Nhà cái úp bát lên đĩa có <b>3 xúc xắc</b> rồi lắc. Chọn mệnh giá phỉnh bên trái, chạm vào ô để đặt cược (đặt được nhiều ô), rồi bấm <b>MỞ BÁT</b>.</p>
      <ul><li><b>TÀI</b>: tổng 11–17 · <b>1 ăn 1</b>. <b>XỈU</b>: tổng 4–10 · <b>1 ăn 1</b>. Ra <b>bão</b> (3 con giống nhau) thì cả Tài lẫn Xỉu đều thua.</li>
      <li><b>BÃO</b>: 3 con giống nhau bất kỳ · <b>1 ăn 24</b>.</li>
      <li><b>Ô tổng</b> (đoán đúng tổng điểm, kể cả khi ra bão): 4 hoặc 17 · <b>1 ăn 50</b>; 5/16 · <b>1 ăn 18</b>; 6/15 · <b>1 ăn 14</b>; 7/14 · <b>1 ăn 12</b>; 8/13 · <b>1 ăn 8</b>; 9, 10, 11, 12 · <b>1 ăn 6</b>.</li></ul>
      <p>Thắng thì được trả lại tiền cược cộng tiền thắng (ví dụ cược 10.000 vào BÃO và trúng: nhận 250.000). Bảng <b>Cầu</b> bên phải: <b>T</b> = Tài, <b>X</b> = Xỉu, <b>B</b> = Bão.</p>`,
    async start(ctx) {
      const g = await setup(ctx, false);
      await g.newRound();
      if (ctx.Q.has('demo')) await g.demo();
    },
    async selftest(ctx) { const g = await setup(ctx, true); return g.selftest(); },
  });

  // ------------------------------------------------------------------ helpers
  function css(id, text) { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = text; document.head.appendChild(s); }
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

  function outlineText(x, text, cx, cy, size, ink, font = 'Grandstander Black') {
    x.font = `400 ${size}px "${font}"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.strokeStyle = '#fff'; x.lineWidth = size * .34; x.strokeText(text, cx, cy);
    x.strokeStyle = ink; x.lineWidth = size * .2; x.strokeText(text, cx, cy);
    x.fillStyle = '#fff'; x.fillText(text, cx, cy);
  }
  function pill(x, text, cx, y, size, ink) { x.font = `800 ${size}px "Baloo 2"`; const tw = x.measureText(text).width + size * 1.1, hh = size * 1.4; x.fillStyle = 'rgba(255,255,255,.92)'; T3.rr(x, cx - tw / 2, y, tw, hh, hh / 2); x.fill(); x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, cx, y + hh / 2 + size * .04); }
  function pips(x, v, cx, cy, s) {   // a tiny die drawn on canvas
    const P = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.27, .22], [.73, .22], [.27, .5], [.73, .5], [.27, .78], [.73, .78]] };
    x.save(); x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 6; x.shadowOffsetY = 3; x.fillStyle = '#fff'; T3.rr(x, cx - s / 2, cy - s / 2, s, s, s * .2); x.fill(); x.restore();
    for (const [a, b] of P[v]) { x.fillStyle = v === 1 || v === 4 ? '#ff3d6e' : '#3a2030'; x.beginPath(); x.arc(cx - s / 2 + a * s, cy - s / 2 + b * s, s * (v === 1 ? .14 : .095), 0, 7); x.fill(); }
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
    const T = ctx.THREE, H = ctx.H, R = window.Rules['tai-xiu'], rand = ctx.rand;
    ctx.music('dice');
    fitCamera(ctx, ctx.def.cam);
    css('tx-css', `
      .tx-road{position:absolute;right:16px;top:132px;padding:12px 14px 14px;border-radius:30px;display:flex;flex-direction:column;gap:8px;align-items:center}
      .tx-road .hd{display:flex;align-items:center;gap:10px;font:400 26px "Grandstander Black";color:#6c4bd1}
      .tx-road .hd span{display:flex;align-items:center;gap:3px;font:400 22px "Grandstander Black";color:#7a5a6e}.tx-road .hd img,.tx-road .hd b{width:26px;height:26px}
      .tx-road .grid{display:grid;grid-template-rows:repeat(6,30px);grid-auto-flow:column;grid-auto-columns:30px;gap:4px;padding:8px;border-radius:18px;background:#f6f1ff;box-shadow:inset 0 0 0 3px #e4daff}
      .tx-road .grid img,.tx-road .grid i,.tx-road .grid b{width:30px;height:30px;display:block;border-radius:50%}
      .tx-road .grid i{background:rgba(180,160,255,.18)}
      .tx-road b.bao{display:flex!important;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 30%,#fff3b0,#ffb81c 60%,#d98a00);color:#fff;font:400 18px "Grandstander Black";text-shadow:0 1px 0 #a86d00;box-shadow:inset 0 -3px 0 rgba(0,0,0,.15)}
      .tx-road .hd b.bao{width:26px;height:26px;border-radius:50%;font-size:15px}
      .tx-road .grid .new{animation:txpulse 1s ease-in-out infinite alternate;filter:drop-shadow(0 0 6px #ffd23c)}
      @keyframes txpulse{to{transform:scale(1.18)}}
      .tx-road .last{display:flex;align-items:center;gap:5px;font:800 20px "Baloo 2";color:#7a5a8e}.tx-road .last img{width:30px}.tx-road .last b{font:400 24px "Grandstander Black";color:#6c4bd1}
      .tx-bet{padding:2px 14px;border-radius:16px;font:400 24px "Grandstander Black";color:#fff;background:linear-gradient(#ff9cc4,#ff4f95);box-shadow:0 4px 0 #c2407a;border:3px solid #fff}
      .tx-res{padding:6px 26px;border-radius:30px;font:400 42px "Grandstander Black";color:#fff;border:4px solid #fff;box-shadow:0 6px 0 rgba(0,0,0,.18),0 10px 22px rgba(60,10,50,.25);display:flex;align-items:center;gap:12px}
      .tx-res img{width:40px}
      .tx-res.tai{background:linear-gradient(#ff9a9a,#ff3d5e)}.tx-res.xiu{background:linear-gradient(#a8dcff,#3d8bff)}.tx-res.bao{background:linear-gradient(#ffe68a,#ffa21c)}
    `);
    await Promise.race([Promise.all(['400 80px "Grandstander Black"', '800 40px "Baloo 2"', '400 40px "Grandstander Black"'].map(f => document.fonts.load(f))), ctx.wait(1500)]);

    // ---- bet zones
    const zones = {};
    for (const z of R.ZONES) {
      const d = ZD[z.id], g = new T.Group(); g.position.set(d.x, 0, d.z);
      const base = new T.Mesh(H.roundedBox(d.w, .22, d.d, d.small ? .12 : .16, 2), ctx.mat(0xfffaff, { roughness: .45 })); base.position.y = .11; base.castShadow = true; base.receiveShadow = true; g.add(base);
      const PX = 128, faceTex = T3.canvasTex(Math.round(d.w * PX), Math.round(d.d * PX), (x, w, h) => {
        const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, d.c1); gr.addColorStop(1, d.c2);
        x.fillStyle = gr; T3.rr(x, 4, 4, w - 8, h - 8, d.small ? 24 : 34); x.fill();
        x.fillStyle = 'rgba(255,255,255,.22)'; T3.rr(x, 14, 12, w - 28, h * .4, 20); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 6; T3.rr(x, 8, 8, w - 16, h - 16, d.small ? 20 : 30); x.stroke();
        if (d.small) {
          outlineText(x, d.title, w / 2, h * .4, h * .44, d.ink);
          pill(x, `1 ăn ${z.odds}`, w / 2, h * .7, 24, d.ink);
        } else if (z.id === 'bao') {
          outlineText(x, d.title, w / 2, h * .36, h * .32, d.ink);
          [1, 1, 1].forEach((_, i) => pips(x, [6, 6, 6][i], w / 2 + (i - 1) * h * .2, h * .64, h * .16));
          pill(x, '1 ăn 24', w / 2, h * .76, 28, d.ink);
        } else {
          outlineText(x, d.title, w / 2, h * .38, h * .42, d.ink);
          pill(x, `${d.sub} · 1 ăn 1 · bão thua`, w / 2, h * .72, 30, d.ink);
        }
      });
      const face = new T.Mesh(new T.PlaneGeometry(d.w - .1, d.d - .1), new T.MeshStandardMaterial({ map: faceTex, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: .16, roughness: .6, transparent: true }));
      face.rotation.x = -Math.PI / 2; face.position.y = .225; face.receiveShadow = true; g.add(face);
      const glow = new T.Mesh(H.roundedBox(d.w + (d.small ? .26 : .4), .16, d.d + (d.small ? .26 : .4), .18, 2), new T.MeshBasicMaterial({ color: 0xfff06a, transparent: true, opacity: 0, toneMapped: false }));
      glow.position.y = .08; g.add(glow);
      ctx.add(g);
      const zo = zones[z.id] = { id: z.id, def: d, rule: z, g, base, face, glow, chips: [] };
      ctx.pickable(g, () => placeBet(z.id), on => { base.material.emissive.setHex(on ? 0x332255 : 0); });
      zo.label = ctx.label(() => { const p = spot(z.id, 0), n = zo.chips.filter(c => c.userData.pile === 0).length; return new T.Vector3(p.x, .5 + Math.min(n, 10) * .1, p.z); }, '', '');
    }
    /** Piles on a zone: 0 = you; bots get their own piles on the big zones and share one on the small sum tiles. */
    const pileOf = (id, owner) => (ZD[id].small ? Math.min(owner, 1) : owner);
    function spot(id, pile) {
      const d = ZD[id];
      const f = d.small ? [[-.24, .04], [.24, .04]][pile] : [[-.3, .2], [.3, .2], [.3, -.22], [-.3, -.22]][pile];
      return { x: d.x + f[0] * d.w, z: d.z + f[1] * d.d };
    }

    // ---- plate, dice, bowl, bank
    const rig = new T.Group(); rig.position.set(0, 0, PZ); ctx.add(rig);
    rig.add(ctx.plate(0xffffff, PLATE_R));
    const diceG = new T.Group(); diceG.position.y = .22; rig.add(diceG);    // die.roll() works in local space, so the dice sit on the plate
    const dice = [0, 1, 2].map(i => { const d = ctx.die({ size: DIE }); d.position.set(DICE_SPOTS[i][0], DIE / 2, DICE_SPOTS[i][1]); d.setFace(i * 2); d.rotation.y = rand() * 6; diceG.add(d); return d; });
    const bowl = ctx.bowl(0xc7a6ff, 1.5); bowl.position.set(BOWL.x, 0, BOWL.z); bowl.traverse(m => { if (m.isMesh) m.castShadow = true; }); ctx.add(bowl);
    const bank = new T.Group(); bank.position.set(BANK.x, 0, BANK.z); ctx.add(bank);
    const tray = new T.Mesh(H.roundedBox(2.9, .2, 1.6, .12, 2), ctx.mat(0xf6f0ff, { roughness: .5 })); tray.position.y = .1; tray.castShadow = tray.receiveShadow = true; bank.add(tray);
    ['100k', '50k', '10k', '5k', '1k'].forEach((k, i) => { for (let j = 0; j < 3 + ((i * 7) % 4); j++) { const c = ctx.chip(k); c.position.set(-1.0 + i * .5, .25 + j * .1, (i % 2 ? .3 : -.25)); c.rotation.y = rand() * 6; bank.add(c); } });

    // ---- players
    const seats = await ctx.seats(4, { angles: [90, 235, 270, 305], r: 8.2 });
    const bots = seats.slice(1), styles = ctx.shuffle(['careful', 'trend', 'wild']);
    bots.forEach((b, i) => {
      b.style = styles[i]; b.idx = i + 1;
      const a = b.angle, bx = Math.cos(a) * 9.4, bz = Math.sin(a) * 9.4;
      b.hand = new T.Vector3(Math.cos(a) * 7.2, 1.4, Math.sin(a) * 7.2);
      const ly = (b.key.startsWith('mini') ? 2.3 : 2.7) - (Math.abs(bx) < 1 ? .3 : 0);
      b.label.target = clearOfTopBar(ctx, b.label.el, new T.Vector3(bx, ly, bz));
      b.label.el.insertAdjacentHTML('beforeend', `<i>${TALK[b.style].tag}</i>`);
      const side = bx > 1 ? -1 : 1;
      b._bub = ctx.label(() => new T.Vector3(bx + side * 2.6, 1.5, bz + 1), '', 'bub3');
    });

    // ---- HUD
    const picker = ctx.ui.chipPicker(CHIPS, null, 2);
    const hist = []; for (let i = 0; i < 15; i++) hist.push(R.roll(rand));
    const road = ctx.ui.h('div', { class: 'tx-road glass' }, ctx.ui.root);
    const IMG = { tai: 'games/tai-xiu/history_tai.png', xiu: 'games/tai-xiu/history_xiu.png' };
    const bead = (k, cls = '') => (k === 'bao' ? `<b class="bao ${cls}">B</b>` : `<img class="${cls}" src="${HC.A(IMG[k])}">`);
    function drawRoad() {
      const kinds = hist.map(d => R.verdict(d).kind), rd = R.road(kinds, 6, 8), cells = rd.cols.flat();
      const n = k => kinds.filter(x => x === k).length;
      let html = `<div class="hd">Cầu<span>${bead('tai')}${n('tai')}</span><span>${bead('xiu')}${n('xiu')}</span><span>${bead('bao')}${n('bao')}</span></div><div class="grid">`;
      for (let i = 0; i < 48; i++) html += i < cells.length ? bead(cells[i], i === cells.length - 1 ? 'new' : '') : '<i></i>';
      const last = hist[hist.length - 1];
      html += `</div><div class="last">Ván trước: ${last.map(v => `<img src="${HC.A(`games/tai-xiu/dice/white/die_${v}.png`)}">`).join('')}<b>= ${R.sum(last)}</b></div>`;
      road.innerHTML = html;
    }
    drawRoad();

    // ---- state
    let phase = 'idle', roundNo = 0, myBets = {}, myOrder = [], lastOrder = [], botBets = [], resTag = null;
    const myTotal = () => Object.values(myBets).reduce((a, b) => a + b, 0);
    const acts = ctx.ui.actions([
      { id: 'clear', label: 'Xoá cược', cls: 'grey', onClick: () => clearMine() },
      { id: 'again', label: 'Đặt lại', cls: 'sky', onClick: () => rebet() },
      { id: 'open', label: 'MỞ BÁT!', cls: 'pink', icon: 'emoji-fluent-3d/game/game_die.png', onClick: () => openAndContinue() },
    ]);
    function refresh() {
      const betting = phase === 'betting', tot = myTotal();
      acts.set('open', { disabled: !betting || !tot }); acts.set('clear', { disabled: !betting || !tot }); acts.set('again', { disabled: !betting || !lastOrder.length || tot > 0 });
      for (const id in zones) { const v = myBets[id] || 0; zones[id].label.el.innerHTML = v ? `<div class="tx-bet">${HC.short(v)}</div>` : ''; }
      if (phase === 'shaking') ctx.ui.status('Nhà cái đang lắc xúc xắc… lắc lắc lắc 🎲');
      else if (betting) ctx.ui.status(tot ? `Bạn cược <b>${HC.fmt(tot)}</b> · bấm <b>MỞ BÁT</b> khi sẵn sàng` : 'Mời đặt cược! Chọn phỉnh bên trái rồi chạm vào ô');
      else if (phase === 'opening') ctx.ui.status('Mở bát nào… 👀');
    }

    // ---- chips
    function chipAt(id, owner, amount, from) {
      const zo = zones[id], pile = pileOf(id, owner), n = zo.chips.filter(c => c.userData.pile === pile).length, p = spot(id, pile), c = ctx.chip(ctx.chipKey(amount));
      const tx = p.x + Math.floor(n / 10) * .28, ty = .27 + (n % 10) * .1;
      c.rotation.y = rand() * 6; c.userData = Object.assign(c.userData, { amount, owner, pile }); zo.chips.push(c); ctx.add(c);
      if (from) { c.position.copy(from); ctx.tween(c, { x: tx, y: ty, z: p.z, arc: 1.2 }, 420, 'out'); }
      else { c.position.set(tx, ty + (test ? 0 : 2.2), p.z); if (!test) ctx.tween(c, { y: ty }, 260, 'bounce'); }
      return c;
    }
    function placeBet(id, amount) {
      if (phase !== 'betting') { if (phase === 'shaking') ctx.ui.toast('Đợi nhà cái lắc xong đã nha 😊', 'emoji-fluent-3d/game/game_die.png'); return false; }
      amount = amount || picker.value;
      if (!ctx.spend(amount)) return false;
      myBets[id] = (myBets[id] || 0) + amount; myOrder.push([id, amount]);
      chipAt(id, 0, amount); ctx.sfx('chip', .4); refresh();
      return true;
    }
    function clearMine() {
      if (phase !== 'betting') return;
      const tot = myTotal(); if (!tot) return;
      for (const id in zones) { const zo = zones[id]; zo.chips.filter(c => c.userData.owner === 0).forEach(c => ctx.tween(c, { x: 0, y: 2, z: 7.5, arc: 1 }, 380, 'io').then(() => ctx.remove(c))); zo.chips = zo.chips.filter(c => c.userData.owner !== 0); }
      myBets = {}; myOrder = [];
      ctx.win(tot, new T.Vector3(0, 1, 3));          // stake handed back
      refresh();
    }
    function rebet() { if (phase !== 'betting' || myTotal()) return; for (const [id, a] of lastOrder) if (!placeBet(id, a)) break; }
    async function botsBet(round) {
      await Promise.all(bots.map(async (b, i) => {
        await ctx.wait(250 + i * 380 + rand() * 900);
        if (phase !== 'betting' || round !== roundNo) return;
        const plan = R.botPlan(rand, b.style, hist.map(d => R.verdict(d).kind), [1000, 5000, 10000, 50000], b.coins);
        if (plan.length) { const zn = R.zone(plan[0].zone).name; b.say(ctx.pick(TALK[b.style].bet(zn))); if (b.style === 'wild') b.anim('cheer'); }
        for (const bet of plan) {
          if (phase !== 'betting' || round !== roundNo) return;
          b.setCoins(b.coins - bet.amount);
          botBets.push({ b, zone: bet.zone, amount: bet.amount });
          chipAt(bet.zone, b.idx, bet.amount, b.hand); ctx.sfx('chip', .25);
          await ctx.wait(260 + rand() * 520);
        }
      }));
    }

    // ---- shake
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
        dice.forEach(d => { d.setFace(Math.floor(rand() * 6)); d.rotation.y = rand() * 6; });     // hidden: just jumble them
        if (i % 3 === 0) ctx.sfx('dice', .45);
        await ctx.tween(rig, { x: s * .32, z: PZ + (i % 3 - 1) * .15, rz: s * .16, rx: (i % 4 - 1.5) * .06, y: 1.5 + (i % 3) * .12 }, 75, 'io');
      }
      await ctx.tween(rig, { x: 0, z: PZ, rz: 0, rx: 0, y: 0 }, 300, 'bounce');
      ctx.scene.attach(bowl);
      phase = 'betting'; refresh();
      bots.forEach(b => { if (b.coins < 60000) { b.setCoins(b.coins + 500000); b.say('Nạp thêm xu chơi tiếp nè 😅'); } });   // bots never go broke
      botsBet(roundNo);
    }

    // ---- open: dice settle under the bowl, the bowl lifts, the dice give a last little hop
    async function reveal(res) {
      dice.forEach((d, i) => { d.setFace(res[i] - 1); d.rotation.y = (rand() - .5) * .9; d.position.set(DICE_SPOTS[i][0] + (rand() - .5) * .14, DIE / 2, DICE_SPOTS[i][1] + (rand() - .5) * .14); });
      ctx.sfx('diceThrow', .5);
      await ctx.tween(bowl, { y: .62 }, 480, 'io');                   // peek…
      await ctx.wait(220);
      const lift = ctx.tween(bowl, { x: BOWL.x, y: 0, z: BOWL.z, arc: 2.6 }, 650, 'io');
      await Promise.all(dice.map((d, i) => ctx.wait(i * 90).then(() => ctx.tween(d, { y: DIE / 2 + .5, ry: d.rotation.y + (rand() < .5 ? -1 : 1) * Math.PI / 2 }, 160, 'out')).then(() => ctx.tween(d, { y: DIE / 2 }, 360, 'bounce'))));
      await lift;
    }

    async function open(forced) {
      if (phase !== 'betting' || !myTotal()) return null;
      phase = 'opening'; refresh();
      const res = forced ? forced.slice() : R.roll(rand), v = R.verdict(res);
      lastOrder = myOrder.slice();
      await reveal(res);
      phase = 'result';
      hist.push(res); drawRoad();
      resTag = ctx.label(new T.Vector3(0, 1.1, PZ - 1.05), `<div class="tx-res ${v.kind}">${v.label}${res.map(x => `<img src="${HC.A(`games/tai-xiu/dice/white/die_${x}.png`)}">`).join('')}</div>`, '');
      ctx.ui.callout(v.label, v.kind === 'tai' ? '#a51f3a' : v.kind === 'xiu' ? '#1a56a6' : '#a86d00');
      ctx.sfx(v.kind === 'bao' ? 'power' : 'pop', .5);
      const winners = Object.keys(zones).filter(id => R.wins(id, res));
      for (const id in zones) {
        const z = zones[id], w = winners.includes(id);
        z.glow.material.opacity = w ? 1 : 0; if (!w) { z.face.material.color.setHex(0xb8b0c0); z.face.material.emissiveIntensity = .04; }
        if (w) ctx.tween(z.g, { y: .3 }, 160, 'out').then(() => ctx.tween(z.g, { y: 0 }, 260, 'bounce'));
      }
      const mine = R.settle(myBets, res);
      const result = { dice: res, verdict: v.label, bets: Object.assign({}, myBets), back: mine.back, net: mine.net, staked: mine.staked };
      ctx.ui.status(`Ra <b>${res.join(' · ')}</b> = ${v.sum} · ${v.kind === 'bao' ? 'BÃO' : v.kind === 'tai' ? 'TÀI' : 'XỈU'} · ${mine.net > 0 ? `bạn lời <b>+${HC.fmt(mine.net)}</b> 🎉` : mine.net < 0 ? (mine.back ? `thu về ${HC.fmt(mine.back)}, lỗ ${HC.fmt(-mine.net)}` : `bạn mất ${HC.fmt(-mine.net)} 🥲`) : 'hoà vốn'}`);
      if (ctx.SHOT && ctx.Q.has('demo')) return result;          // keep the reveal on screen for the screenshot
      await ctx.wait(700);
      // losing chips go to the dealer; winning piles get paid next to them, then everything flies home
      const flights = [];
      for (const id in zones) {
        const z = zones[id], w = winners.includes(id);
        if (!w) { z.chips.forEach((c, k) => flights.push(ctx.wait(k * 25).then(() => ctx.tween(c, { x: BANK.x + (rand() - .5), y: .4, z: BANK.z, arc: 1.4 }, 520, 'io')).then(() => ctx.remove(c)))); continue; }
        for (let owner = 0; owner <= 3; owner++) {
          const st = z.chips.filter(c => c.userData.owner === owner); if (!st.length) continue;
          const stake = st.reduce((a, c) => a + c.userData.amount, 0), p = spot(id, pileOf(id, owner));
          const pay = ctx.stack(stake * z.rule.odds, BANK.x, BANK.z); pay.position.y = .25;
          flights.push(ctx.moveStack(pay, p.x + (z.def.small ? 0 : .55), p.z + (z.def.small ? -.45 : .1), 520).then(async () => {
            await ctx.wait(350);
            const dest = owner === 0 ? { x: 0, y: 2.2, z: 8 } : { x: bots[owner - 1].hand.x, y: 1.8, z: bots[owner - 1].hand.z };
            await Promise.all([ctx.tween(pay, Object.assign({ arc: 1 }, dest), 560, 'io').then(() => ctx.remove(pay)), ...st.map(c => ctx.tween(c, Object.assign({ arc: 1 }, dest), 560, 'io').then(() => ctx.remove(c)))]);
          }));
        }
      }
      ctx.sfx('chips', .4);
      await Promise.all(flights);
      for (const id in zones) zones[id].chips = [];
      for (const b of bots) {
        const mb = {}; botBets.filter(x => x.b === b).forEach(x => { mb[x.zone] = (mb[x.zone] || 0) + x.amount; });
        const s = R.settle(mb, res); if (!s.staked) continue;
        b.setCoins(b.coins + s.back);
        if (s.net > 0) { b.anim('cheer'); if (rand() < .7) b.say(ctx.pick(TALK[b.style].win)); } else if (s.net < 0) { b.anim('sad'); if (rand() < .5) b.say(ctx.pick(TALK[b.style].lose)); }
      }
      botBets = [];
      if (mine.back) ctx.win(mine.back, new T.Vector3(0, 1, 4));
      const big = mine.net > 0 && (mine.per.bao || Object.keys(mine.per).some(k => k[0] === 's' && mine.per[k]) || mine.net >= mine.staked * 3);
      if (mine.net > 0) { setTimeout(() => ctx.ui.callout(big ? 'ĂN ĐẬM!' : 'THẮNG!'), 600); ctx.sfx('win', .5); if (big) ctx.ui.confetti(); }
      else if (mine.net < 0) { ctx.sfx('lose', .3); ctx.ui.toast(`${v.label} · ${mine.back ? `thu về ${HC.fmt(mine.back)}` : 'không trúng ô nào'} 🥲`, mine.back ? 'emoji-fluent-3d/game/coin.png' : 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); }
      myBets = {}; myOrder = [];
      await ctx.wait(test ? 150 : 1800);
      return result;
    }
    let busy = false;
    async function openAndContinue(forced) {
      if (busy || phase !== 'betting') return null;
      busy = true;
      try { const r = await open(forced); if (r && !(ctx.SHOT && ctx.Q.has('demo'))) await newRound(); return r; }
      catch (e) { console.error(e); ctx.ui.toast('Lỗi: ' + e.message); }
      finally { busy = false; }
    }

    async function demo() {
      placeBet('tai', 50000); placeBet('tai', 10000); placeBet('s14', 5000); placeBet('bao', 1000); placeBet('xiu', 5000);
      await ctx.wait(3200);
      await openAndContinue([6, 5, 3]);
    }

    async function selftest() {
      const out = { pass: 0, fail: 0, rounds: [] };
      const check = (name, ok, info) => { out.rounds.push(Object.assign({ name, ok }, info)); if (!ok) out.fail++; };
      await newRound();
      // 1) 6·5·3 = 14: Tài + sum 14 win
      let c0 = ctx.coins;
      placeBet('tai', 10000); placeBet('xiu', 5000); placeBet('s14', 1000); placeBet('bao', 1000);
      let spent = c0 - ctx.coins, r = await openAndContinue([6, 5, 3]);
      check('tài 14', spent === 17000 && r.back === 20000 + 13000 && ctx.coins === c0 + 16000 && r.verdict === 'TÀI 14', { spent, back: r.back, delta: ctx.coins - c0 });
      // 2) bão 3·3·3: Tài and Xỉu both lose, Bão 1:24, sum 9 1:6
      c0 = ctx.coins;
      placeBet('tai', 10000); placeBet('xiu', 10000); placeBet('bao', 1000); placeBet('s9', 1000); placeBet('s10', 5000);
      spent = c0 - ctx.coins; r = await openAndContinue([3, 3, 3]);
      check('bão', spent === 27000 && r.back === 25000 + 7000 && ctx.coins === c0 - 27000 + 32000 && r.verdict === 'BÃO!', { spent, back: r.back, delta: ctx.coins - c0 });
      // 3) clear refunds exactly; Đặt lại replays round 2; 1·1·2 = 4 → Xỉu + nothing else
      c0 = ctx.coins;
      placeBet('s4', 50000); clearMine(); const refundOk = ctx.coins === c0;
      rebet(); spent = c0 - ctx.coins; r = await openAndContinue([1, 1, 2]);
      check('clear + đặt lại + xỉu 4', refundOk && spent === 27000 && r.back === 20000 && ctx.coins === c0 - 7000 && r.verdict === 'XỈU 4', { refundOk, spent, back: r.back, delta: ctx.coins - c0 });
      // tapping tiles on screen places the selected chip (real raycast path)
      c0 = ctx.coins; tapAt(ctx, new T.Vector3(ZD.xiu.x, .25, ZD.xiu.z)); tapAt(ctx, new T.Vector3(ZD.s9.x, .25, ZD.s9.z));
      check('chạm ô để cược', myBets.xiu === picker.value && myBets.s9 === picker.value && ctx.coins === c0 - 2 * picker.value, { xiu: myBets.xiu, s9: myBets.s9 });
      clearMine();
      // 4) sum 17 pays 1:50; no-bet open is refused
      const none = await openAndContinue();
      c0 = ctx.coins; placeBet('s17', 1000); placeBet('tai', 1000);
      r = await openAndContinue([6, 6, 5]);
      check('tổng 17', none === null && r.back === 51000 + 2000 && ctx.coins === c0 + 51000, { back: r.back });
      // 5) a random round settles by the rules
      c0 = ctx.coins; placeBet('tai', 5000); placeBet('xiu', 5000); placeBet('s11', 1000);
      r = await openAndContinue();
      const exp = R.settle({ tai: 5000, xiu: 5000, s11: 1000 }, r.dice).back;
      check('ngẫu nhiên', r.back === exp && ctx.coins === c0 - 11000 + exp, { dice: r.dice, back: r.back });
      out.history = hist.length; out.botsCoins = bots.map(b => b.coins);
      out.checks = out.rounds.length; out.pass = out.fail ? 0 : 1;
      return out;
    }
    return { newRound, demo, selftest, placeBet, open: openAndContinue };
  }
})();
