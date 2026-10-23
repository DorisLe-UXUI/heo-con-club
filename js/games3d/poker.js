/* Poker (Texas Hold'em No-Limit) 3D — you + 4 bots with their own stacks. Dealer button, small/big blinds,
 * preflop / flop / turn / river betting, side pots, showdown with the best five of seven cards.
 * Your stack is the shared wallet: every chip you put in goes through ctx.spend, winnings come back with ctx.win.
 * Rules: js/games3d/rules/poker.js (evaluator, bots), js/games3d/rules/cards-common.js (betting engine, side pots). */
(function () {
  'use strict';
  const ANGLES = [90, 200, 247, 293, 340], SEAT_R = 7.9;
  const CAM = { pos: [0, 12, 17], look: [0, 0, -2.3] };
  const BLINDS = [1000, 5000, 10000, 50000, 100000];           // small blind choices on real chip values (big blind = double)
  const MY = i => ({ x: (i - .5) * 1.62, y: 1.55, z: 5.1, rx: 1.0 });
  const BOARD = k => ({ x: (k - 2) * 1.38, z: -.82 });
  const POT = { x: 0, z: -2.75 }, ME_BET = { x: 2.75, z: 3.55 }, ME_BTN = { x: 3.9, z: 2.6 }, ME_BLIND = { x: -2.6, z: 4.0 }, ME_DECK = { x: 4.4, z: 1.3 };
  const STREET = ['Preflop', 'Flop', 'Turn', 'River'];

  T3.register('poker', {
    title: 'Poker', sub: "Texas Hold'em không giới hạn · mù nhỏ / mù lớn · hũ phụ",
    table: 'round', theme: 'mint', tex: ['cards', 'chips'], cam: CAM,
    scripts: ['js/games3d/rules/cards-common.js', 'js/games3d/rules/poker.js'],
    models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    rules: `<p>Mỗi người 2 lá tẩy, giữa bàn lật dần 5 lá chung. Ghép <b>5 lá đẹp nhất</b> trong 7 lá (2 tẩy + 5 chung).</p>
      <ul><li>Nút <b>D</b> (người chia) xoay vòng mỗi ván. Hai người kế tiếp đặt <b>mù nhỏ</b> (SB) và <b>mù lớn</b> (BB, gấp đôi mù nhỏ). Chọn mức mù nhỏ ở bên trái, áp dụng từ ván sau.</li>
      <li>Bốn vòng cược: <b>Preflop</b> (sau khi chia tẩy), <b>Flop</b> (3 lá chung), <b>Turn</b> (lá thứ 4), <b>River</b> (lá thứ 5).</li>
      <li><b>Xem</b> khi chưa ai cược, <b>Theo</b> cho bằng mức cao nhất, <b>Tố</b> ít nhất bằng lần tố trước (tối thiểu 1 mù lớn), <b>All-in</b> đẩy hết, <b>Bỏ</b> để thôi ván.</li>
      <li>Ai all-in chỉ ăn được phần hũ mà mình theo đủ — phần dư thành <b>hũ phụ</b> cho những người còn lại. Tiền cược không ai theo được trả lại.</li></ul>
      <p>Thứ tự bài từ cao xuống: <b>Thùng phá sảnh</b> › <b>Tứ quý</b> › <b>Cù lũ</b> › <b>Thùng</b> › <b>Sảnh</b> (A-2-3-4-5 là sảnh nhỏ nhất) › <b>Sám cô</b> › <b>Thú</b> (2 đôi) › <b>Đôi</b> › <b>Mậu thầu</b>. Cùng loại thì so các lá theo thứ tự (lá phụ / kicker). Chất không phân định thắng thua: bằng nhau thì <b>chia đều hũ</b> (xu lẻ cho người ngồi gần bên trái nút D nhất).</p>
      <p>Chồng xu của bạn chính là ví xu của bạn. Bot hết chip sẽ tự mua thêm.</p>`,
    stakeName: 'Mù nhỏ',
    modes: [
      { id: 'nl', name: 'Không giới hạn', desc: "No-Limit Hold'em: tố bao nhiêu cũng được, kể cả All-in cả chồng xu.", rules: 'mỗi lần tố tối thiểu bằng lần tố trước, tối đa là cả chồng xu (All-in).' },
      { id: 'pl', name: 'Giới hạn hũ', desc: "Pot-Limit Hold'em: mỗi lần tố tối đa bằng cả hũ — ván chậm hơn, ít All-in bất ngờ.",
        rules: 'mỗi lần tố tối đa lên tới <b>mức đang theo + cả hũ + số bạn phải theo</b> (tố bằng hũ). Ví dụ mù 5K/10K, người đầu tiên tố tối đa 35K. Nút <b>TỐ HŨ</b> thay cho All-in; chồng xu nhỏ hơn hũ thì vẫn All-in được.' },
    ],
    async start(ctx) { for (;;) await hand(ctx, null); },
    async selftest(ctx) {
      const C = window.Rules['cards-common'], P = window.Rules['poker'], checks = [];
      const run = async (label, opts, extra) => {
        if (ctx.coins < 400000) ctx.coins = 1250000;   // the all-in test may empty the (throw-away) test wallet
        const r = await hand(ctx, Object.assign({ auto: true, bb: 10000 }, opts));
        // replay the logged actions on a fresh engine and settle independently
        const st = C.table(r.stacks0, { minRaise: r.bb, unit: r.bb / 2, potLimit: r.potLimit });
        C.street(st); C.blind(st, r.pos.sb, r.bb / 2); C.blind(st, r.pos.bb, r.bb); C.street(st, { keepBets: true, level: r.bb });
        let street = 0;
        for (const e of r.log) { if (e.street != null) { if (e.street > 0) C.street(st); street = e.street; continue; } C.act(st, e.i, e.a); }
        const hands7 = r.hole.map((h, k) => (C.inHand(st.players[k]) ? [...h, ...r.board] : null));
        const sd = P.showdown(st, hands7, r.order);
        const want = sd.pay[0] - st.players[0].total, potOk = sd.pay.reduce((a, b) => a + b, 0) === C.potTotal(st);
        const c = { label, me: r.hole[0].map(C.name).join(' '), board: r.board.map(C.name).join(' '), put: st.players[0].total, pay: sd.pay[0], pots: sd.detail.length, coinsDelta: r.coinsDelta, want, ok: r.coinsDelta === want && potOk && r.chipsOk && street >= 0 };
        if (extra) extra(c, sd, r);
        checks.push(c);
      };
      await run('theo tới showdown', { policy: 'call', botPolicy: 'call' }, c => { c.ok = c.ok && c.board.split(' ').length === 5; });
      await run('all-in, hũ phụ', { policy: 'allin', botPolicy: 'call', botStacks: [30000, 80000, 2e6, 2e6] }, c => { c.ok = c.ok && c.pots >= 3; });
      await run('tứ quý ăn pot', { policy: 'call', botPolicy: 'call', rig: { me: 'A♠ A♥', board: 'A♦ A♣ K♠ 2♦ 7♣' } }, c => { c.ok = c.ok && c.pay > 0 && c.coinsDelta > 0; });
      await run('chia pot (bài chung)', { policy: 'call', botPolicy: 'call', rig: { me: '2♣ 3♦', board: 'A♣ K♦ Q♥ J♠ 10♦', bots: ['4♣ 4♦', '5♥ 6♥', '7♣ 8♦', '9♠ 2♦'] } }, (c, sd) => { c.ok = c.ok && sd.detail[0].winners.length === 5 && c.coinsDelta === 0; });
      await run('bỏ bài', { policy: 'fold' });
      await run('bot tự chơi', { policy: 'call' });
      const fail = checks.filter(c => !c.ok).length;
      return { pass: fail ? 0 : 1, fail, checks };
    },
  });

  let S = null;
  /** Chip stack flight. Replaces ctx.moveStack(): T3 tween() with `arc` but no `y` adds the arc to position.y on every
   *  step without resetting it, so stacks (and anything else tweened that way) drift upward. Always pass y. */
  const fly = (ctx, g, x, z, ms = 500, vanish = false) => { ctx.sfx('chips', .35); return ctx.tween(g, { x, y: 0, z, arc: 1.4 }, ms, 'io').then(() => { if (vanish) ctx.remove(g); }); };
  const anim = (s, name) => { if (s.anim) s.anim(name); };
  function css() {
    if (document.getElementById('pk3-css')) return;
    const st = document.createElement('style'); st.id = 'pk3-css';
    st.textContent = `.ct-amt{padding:3px 14px;border-radius:16px;background:rgba(30,40,50,.72);color:#ffe27a;font:400 22px "Grandstander Black";box-shadow:0 4px 10px rgba(0,0,0,.18)}
      .ct-pot{display:flex;align-items:center;gap:8px;padding:6px 20px 6px 8px;border-radius:26px;background:rgba(255,255,255,.95);border:3px solid #fff;box-shadow:0 5px 0 rgba(22,138,96,.3),0 8px 16px rgba(20,60,40,.2);font:400 28px "Grandstander Black";color:#a86d00}
      .ct-pot img{width:40px}.ct-pot small{font:800 18px "Baloo 2";color:#5f8a76;margin-right:4px}.ct-pot i{font:800 18px "Baloo 2";font-style:normal;color:#c2407a;margin-left:8px}
      .pk-info{display:flex;align-items:center;gap:10px;padding:4px 18px 4px 6px;border-radius:24px;background:rgba(255,255,255,.95);border:3px solid #fff;box-shadow:0 5px 0 rgba(22,138,96,.3),0 8px 16px rgba(20,60,40,.2);font:400 26px "Grandstander Black";color:#a86d00}
      .pk-info img{width:34px}.pk-info b{font:400 22px "Grandstander Black";color:#fff;background:#2fc58e;border-radius:16px;padding:1px 12px;box-shadow:0 3px 0 #1f9a70}.pk-info i{font:800 18px "Baloo 2";font-style:normal;color:#c2407a}
      .lbl3.al-r{translate:-50% 0}.lbl3.al-l{translate:50% 0}
      .bub3.bub-r{translate:50% 0}.bub3.bub-l{translate:-50% 0}
      .ct-bar .gbtn{min-width:140px;padding:0 22px;font-size:32px}.ct-bar .gbtn img{width:46px}
      .rz{position:absolute;left:100%;top:50%;transform:translateY(-50%);margin-left:14px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 18px 12px;border-radius:36px;white-space:nowrap}
      .rz .amt{font:400 32px "Grandstander Black";color:#a86d00;line-height:1}
      .rz input{width:290px;height:30px;accent-color:#ff4f95;cursor:pointer}
      .rz .pre{display:flex;gap:6px}.rz .pre b{font:800 19px "Baloo 2";color:#c2407a;background:#ffe3f0;border-radius:12px;padding:1px 11px;cursor:pointer}
      .rz .pre b:hover{background:#ffc6dd}.rz .pre b.all{color:#fff;background:#ff6fa8}.rz.off{display:none}`;
    document.head.appendChild(st);
  }
  function fitCam(ctx) {
    const apply = () => {
      const f = 1 + Math.max(0, 1.7 - innerWidth / innerHeight) * .42, L = CAM.look;
      const pos = CAM.pos.map((v, i) => L[i] + (v - L[i]) * f); pos[2] += (f - 1) * -12;
      ctx.camTo({ pos, look: L }, 0);
    };
    apply(); addEventListener('resize', apply);
  }
  /** Seat labels/bubbles clear of the HUD (see bai-cao.js). */
  function arrange(ctx, seats) {
    const T = ctx.THREE, R = SEAT_R + 1.2;
    for (const s of seats) {
      if (s.me) continue;
      const cx = Math.cos(s.angle), sz = Math.sin(s.angle), side = Math.abs(cx) > .7, dir = cx < 0 ? 1 : -1, mini = s.key && s.key.startsWith('mini');
      const hy = mini ? 2.6 : 3.1;
      if (side) s.label.target = () => new T.Vector3(cx * R + dir * .55, hy, sz * R);
      const lx = cx * R + (side ? dir * .55 : 0), bx = side ? lx + dir * 1.3 : lx - dir * 2.0, by = side ? hy - .95 : hy - .1;
      if (!s._bub) s._bub = ctx.label(() => new T.Vector3(bx, by, sz * R), '', 'bub3 ' + ((side ? dir : -dir) > 0 ? 'bub-r' : 'bub-l'));
    }
  }
  function pile(ctx, amount, x, z) {
    const T = ctx.THREE, g = new T.Group(); g.position.set(x, 0, z);
    const keys = ctx.chipsFor(amount, 40), cols = Math.max(1, Math.min(7, Math.ceil(keys.length / 5)));
    const off = [[0, 0], [.82, .12], [-.8, .18], [.38, .74], [-.42, -.7], [.5, -.66], [-.36, .78]];
    keys.forEach((k, i) => { const c = ctx.chip(k), col = i % cols, h = Math.floor(i / cols); c.position.set(off[col][0] + (Math.random() - .5) * .05, .05 + h * .1, off[col][1] + (Math.random() - .5) * .05); c.rotation.y = Math.random() * 6; g.add(c); });
    ctx.add(g); return g;
  }
  /** D / SB / BB button: a chunky disc with the marker texture, tilted towards the camera so the letters stay readable. */
  function marker(ctx, key, rim) {
    const T = ctx.THREE, g = new T.Group(), d = new T.Group(), r = .46;
    const side = new T.Mesh(new T.CylinderGeometry(r, r, .12, 40), ctx.mat(rim, { roughness: .4 })); side.castShadow = true; d.add(side);
    const t = ctx.tex(key);
    const top = new T.Mesh(new T.CircleGeometry(r * .98, 40), new T.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .35, roughness: .45, transparent: true, alphaTest: .2 }));
    top.rotation.x = -Math.PI / 2; top.position.y = .061; d.add(top);
    d.rotation.x = .6; d.position.y = r * Math.sin(.6) + .04; g.add(d);
    g.position.set(0, 0, 9); ctx.add(g); return g;
  }
  /** Raise slider + presets in a glass panel above the right end of the action bar. */
  function raiseBox(ctx, bar, fmtLabel, potLimit) {
    bar.el.classList.add('ct-bar');
    const box = ctx.ui.h('div', { class: 'rz glass off' }, bar.el);
    const amt = ctx.ui.h('div', { class: 'amt', text: '0' }, box);
    const rng = ctx.ui.h('input', { type: 'range', min: '0', max: '1000', value: '0' }, box);
    const pre = ctx.ui.h('div', { class: 'pre' }, box);
    let lim = null, val = 0;
    const show = () => { amt.textContent = (lim.prefix || '') + HC.short(val); fmtLabel(val); };
    const set = v => { if (!lim) return; val = Math.max(lim.min, Math.min(lim.max, v)); show(); rng.value = String(Math.round(Math.sqrt((val - lim.min) / Math.max(1, lim.max - lim.min)) * 1000)); };
    rng.addEventListener('input', () => { if (!lim) return; const t = (+rng.value / 1000) ** 2; let v = lim.min + (lim.max - lim.min) * t; v = v >= lim.max ? lim.max : Math.round(v / lim.unit) * lim.unit; val = Math.max(lim.min, Math.min(lim.max, v)); show(); });
    const presets = {};
    const mk = (id, text, cls) => { const b = ctx.ui.h('b', { text, class: cls || '' }, pre); b.onclick = () => { ctx.sfx('click', .3); presets[id] && set(presets[id]()); }; return b; };
    mk('min', 'Min'); mk('half', '½ Hũ'); mk('pot', 'Cả hũ'); mk('x3', '3 BB'); mk('max', potLimit ? 'Tối đa' : 'All-in', 'all');
    return {
      get value() { return val; },
      setLimits(l) {   // {min, max, unit, pot, currentBet, bb, prefix} or null
        lim = l; box.classList.toggle('off', !l);
        if (!l) return;
        const r = v => Math.round(v / l.unit) * l.unit;
        presets.min = () => l.min; presets.max = () => l.max; presets.x3 = () => r(Math.max(l.currentBet, l.bb) + l.bb * 2);
        presets.half = () => r(l.currentBet + l.pot * .5); presets.pot = () => r(l.currentBet + l.pot);
        set(l.def || l.min);
      },
    };
  }

  /** Keep the action bar + its raise panel between the "#me" card (bottom-left) and the right edge of the screen. */
  function fitBar(ctx, bar) {
    const el = bar.el, me = document.getElementById('me');
    const apply = () => {
      if (!el.isConnected) { removeEventListener('resize', apply); return; }
      const u = ctx.uiScale || 1, UW = ctx.UW, w = el.offsetWidth, rz = el.querySelector('.rz'), pw = 14 + Math.max(334, rz ? rz.offsetWidth : 0);
      const minL = me ? me.getBoundingClientRect().right / u + 16 : 16, maxR = UW - 16;
      let left = UW / 2 - w / 2;
      if (left + w + pw > maxR) left = Math.max(minL, maxR - w - pw);
      el.style.left = left + 'px'; el.style.transform = 'none';
    };
    apply(); addEventListener('resize', apply);
    return apply;
  }

  async function setup(ctx, test) {
    const T = ctx.THREE;
    css();
    ctx.music('cards');
    const seats = await ctx.seats(5, { angles: ANGLES, r: SEAT_R });
    arrange(ctx, seats); fitCam(ctx);
    const deckG = new T.Group();
    for (let i = 0; i < 10; i++) { const c = ctx.card(null); c.rotation.z = Math.PI; c.position.y = .02 + i * .022; c.rotation.y = .5 + (Math.random() - .5) * .12; deckG.add(c); }
    ctx.add(deckG);
    const mk = { d: marker(ctx, 'marker_d', 0xff6fa8), sb: marker(ctx, 'marker_sb', 0x3d9bff), bb: marker(ctx, 'marker_bb', 0xff8f5c) };
    const infoLbl = ctx.label(new T.Vector3(0, 0, 1.25), '', '');   // note: T3 rewrites label display every frame, so labels are hidden by emptying them
    const chips = ctx.ui.chipPicker(BLINDS, null, 1);
    S = { seats, deckG, mk, infoLbl, chips, button: 0, first: true, tags: [], stacks: seats.map(() => 0), street: '', potAmt: 0, side: 0 };
  }
  const V = (ctx, p) => new ctx.THREE.Vector3(p.x, 0, p.z);
  // Spots in front of a seat. Side seats (left/right) keep things in a line; far seats push their bet outward so the
  // centre column stays free for the pot. inS = the "along" sign that points towards the middle of the table.
  const far = s => Math.abs(Math.cos(s.angle)) < .7, inS = s => (Math.cos(s.angle) < 0 ? 1 : -1);
  const deckSpot = (ctx, s) => (s.me ? V(ctx, ME_DECK) : far(s) ? s.spot(-inS(s) * 2.2, 2.9) : s.spot(-1.15, 3.0));
  const btnSpot = (ctx, s) => (s.me ? V(ctx, ME_BTN) : far(s) ? s.spot(inS(s) * 1.55, 2.6) : s.spot(1.5, 2.7));
  const blindSpot = (ctx, s) => (s.me ? V(ctx, ME_BLIND) : far(s) ? s.spot(-inS(s) * 1.5, 1.85) : s.spot(-1.6, 1.85));
  const betSpot = (ctx, s) => (s.me ? V(ctx, ME_BET) : far(s) ? s.spot(-inS(s) * 1.0, 3.0) : s.spot(0, 2.8));
  const fromSpot = (ctx, s) => (s.me ? new ctx.THREE.Vector3(0, 0, 8) : s.pos);
  /** The pill between the board and your cards: current street + pot (+ side pots). */
  function info(street, amount, side) {
    const el = S.infoLbl.el;
    if (!street && !amount) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="pk-info"><img src="${HC.A('emoji-fluent-3d/game/money_bag.png')}">${street ? `<b>${street}</b>` : ''}${amount ? 'Hũ ' + HC.fmt(amount) : 'Mù ' + HC.short(S.bb / 2) + ' / ' + HC.short(S.bb)}${side ? `<i>+${side} hũ phụ</i>` : ''}</div>`;
  }
  function setPot(ctx, amount, side) {
    S.potAmt = amount; S.side = side; info(S.street, amount, side);
    if (S.pot) ctx.remove(S.pot);
    S.pot = amount ? pile(ctx, amount, POT.x, POT.z) : null;
    if (S.pot) { S.pot.scale.setScalar(.85); ctx.tween(S.pot, { s: 1 }, 260, 'back'); }
  }
  const buyIn = (ctx, bb) => bb * (80 + Math.floor(ctx.rand() * 70));

  async function hand(ctx, test) {
    if (!S) await setup(ctx, test);
    const T = ctx.THREE, C = window.Rules['cards-common'], P = window.Rules['poker'];
    const { seats, mk } = S, me = seats[0], N = seats.length;
    const auto = !!(test && test.auto), demo = ctx.Q.has('demo') && !auto, full = demo && ctx.Q.getAll('demo').includes('2');   // demo=2: play the hand out
    S.tags.forEach(t => t.remove()); S.tags = [];
    // ---- stakes; the first hand (or an empty wallet) waits for VÀO BÀN
    let bb = (test && test.bb) || S.chips.value * 2;
    if (S.first || ctx.coins < bb) {
      await new Promise(res => {
        ctx.ui.status(ctx.coins < bb && !S.first ? 'Không đủ xu cho mức mù này — chọn mức thấp hơn bên trái' : 'Chọn <b>mức mù nhỏ</b> bên trái rồi bấm <b>VÀO BÀN</b>');
        const a = ctx.ui.actions([{ id: 'go', label: 'VÀO BÀN', cls: 'pink', icon: 'emoji-fluent-3d/game/joker.png', onClick: () => {
          const v = (test && test.bb) || S.chips.value * 2;
          if (ctx.coins < v) { ctx.ui.toast('Không đủ xu cho mức mù này 😅', 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); ctx.sfx('error', .4); return; }
          bb = v; res();
        } }]);
        if (auto || demo) a.btn('go').click();
      });
      ctx.ui.clearActions();
    }
    const sb = bb / 2;
    S.bb = bb;
    // ---- bot stacks: buy in / top up at 100 big blinds
    seats.forEach((s, i) => {
      if (s.me) return;
      if (test && test.botStacks) S.stacks[i] = test.botStacks[i - 1];
      else if (S.stacks[i] < bb * 25) { const was = S.stacks[i]; S.stacks[i] = Math.max(S.stacks[i], buyIn(ctx, bb)); if (was > 0 && !auto) s.say('Mua thêm chip 💸', 1500); }
      s.setCoins(S.stacks[i]);
    });
    // ---- button and blinds
    S.button = S.first ? (demo || auto ? 0 : Math.floor(ctx.rand() * N)) : P.nextSeat(seats.map(() => true), S.button);
    S.first = false;
    const pos = P.positions(seats.map(() => true), S.button), order = [1, 2, 3, 4, 5].map(k => (pos.button + k) % N);
    const DECK = deckSpot(ctx, seats[pos.button]);
    const place = (m, s, spot) => { const p = spot(ctx, s); return ctx.tween(m, { x: p.x, y: 0, z: p.z, arc: .8 }, 420, 'io'); };
    place(mk.d, seats[pos.button], btnSpot); place(mk.sb, seats[pos.sb], blindSpot); place(mk.bb, seats[pos.bb], blindSpot);
    await Promise.all([ctx.tween(S.deckG, { x: DECK.x, y: 0, z: DECK.z, arc: .8 }, 420, 'io'), ctx.wait(450)]);
    const coinsStart = ctx.coins, stacks0 = seats.map((s, i) => (s.me ? ctx.coins : S.stacks[i]));
    const potLimit = !!(ctx.mode && ctx.mode.id === 'pl');
    const st = C.table(stacks0, { minRaise: bb, unit: sb, potLimit }), chips0 = C.chipsInPlay(st);
    const log = [];
    const sync = i => { if (!seats[i].me) seats[i].setCoins(st.players[i].stack); };
    const betG = seats.map(() => null), betL = seats.map(() => null);
    const showBet = (i, toss) => {
      const s = seats[i], amt = st.players[i].bet, p = betSpot(ctx, s);
      if (betG[i]) ctx.remove(betG[i]); betG[i] = null;
      if (betL[i]) betL[i].remove(); betL[i] = null;
      if (!amt) return;
      const g = betG[i] = ctx.stack(amt, p.x, p.z);
      if (toss) { const f = fromSpot(ctx, s); g.position.set(f.x, 1.5, f.z); ctx.tween(g, { x: p.x, y: 0, z: p.z, arc: .8 }, 360, 'out'); ctx.sfx('chips', .35); }
      betL[i] = ctx.label(p.clone().setY(1.0), `<div class="ct-amt">${HC.short(amt)}</div>`);
    };
    C.street(st);
    const putBlind = (i, amt) => { const x = C.blind(st, i, amt); if (seats[i].me) { if (!ctx.spend(x)) throw new Error('wallet out of sync'); } else sync(i); showBet(i, true); };
    putBlind(pos.sb, sb); putBlind(pos.bb, bb);
    C.street(st, { keepBets: true, level: bb });
    seats[pos.sb].say && !seats[pos.sb].me && seats[pos.sb].say('Mù nhỏ ' + HC.short(sb), 1300);
    seats[pos.bb].say && !seats[pos.bb].me && seats[pos.bb].say('Mù lớn ' + HC.short(bb), 1300);
    // ---- deal two hole cards each, starting with the small blind
    const deck = ctx.deck(), hole = seats.map(() => []), meshes = seats.map(() => []), board = [], boardM = [];
    const rig = { me: [], board: [], bots: [] };   // self-test: fixed cards
    if (test && test.rig) {
      const take = str => C.parse(str).map(c => deck.splice(deck.findIndex(d => d.key === c.key), 1)[0]);
      if (test.rig.me) rig.me = take(test.rig.me);
      if (test.rig.board) rig.board = take(test.rig.board);
      if (test.rig.bots) rig.bots = test.rig.bots.map(take);
    }
    ctx.sfx('shuffle', .45);
    for (let i = 0; i < 4; i++) await ctx.tween(S.deckG, { ry: i % 2 ? -.2 : .2, y: .12 }, 70, 'io');
    await ctx.tween(S.deckG, { ry: 0, y: 0 }, 90, 'out');
    const give = (i, k) => {
      const s = seats[i], c = (s.me ? rig.me[k] : rig.bots[i - 1] && rig.bots[i - 1][k]) || deck.pop(), m = ctx.card(c.key, s.me ? { w: 1.32 } : {});
      m.position.set(DECK.x, .3, DECK.z); m.rotation.set(0, s.me ? 0 : .5, Math.PI); ctx.add(m);
      hole[i].push(c); meshes[i].push(m);
      if (s.me) { const p = MY(k); ctx.sfx('card', .3); return ctx.tween(m, { x: p.x, y: p.y, z: p.z, rx: p.rx, ry: 0, rz: Math.PI, arc: .9 }, 360, 'out'); }
      const p = s.spot((k - .5) * .85, 1.95);
      return ctx.deal(m, { x: p.x, z: p.z, ry: s.facing, y: .02 + k * .006 }, 320, false);
    };
    const flights = [];
    for (let k = 0; k < 2; k++) for (const i of order) { flights.push(give(i, k)); await ctx.wait(100); }
    await Promise.all(flights);
    for (let k = 0; k < 2; k++) { const p = MY(k); ctx.tween(meshes[0][k], { rz: 0, arc: .3, y: p.y }, 300, 'io'); await ctx.wait(90); }
    let myTag = null;
    const showMyHand = () => {
      const e = P.evaluate([...hole[0], ...board]);
      const txt = board.length ? e.desc : e.cat === 1 ? e.desc : 'Mậu thầu ' + e.desc.split(' ').pop();
      if (!myTag) { myTag = ctx.label(new T.Vector3(-1.6, 2.25, 5.0), '', 'al-r'); S.tags.push(myTag); }
      myTag.el.innerHTML = `<div class="tag3 sky" style="font-size:26px">${txt}</div>`;
      return txt;
    };
    showMyHand();
    // ---- streets
    const dim = m => [m.userData.front, m.userData.back].forEach(x => { x.material.opacity = .5; });
    const foldCards = i => {
      const s = seats[i];
      meshes[i].forEach((m, k) => {
        const p = s.me ? { x: (k - .5) * .4, z: 4.2 } : s.spot((k - .5) * .3, 1.7);
        ctx.tween(m, { x: p.x, y: .03 + k * .012, z: p.z, rx: 0, ry: s.me ? 0 : s.facing, rz: Math.PI, arc: .6 }, 420, 'io').then(() => dim(m));
      });
      S.tags.push(ctx.label(s.me ? new T.Vector3(0, 1.0, 4.2) : s.spot(0, 1.7).setY(.9), '<div class="tag3 grey">Bỏ bài</div>'));
      if (s.me && myTag) { myTag.remove(); myTag = null; }
    };
    let turnRes = null, lastLegal = null;
    const bar = ctx.ui.actions([
      { id: 'fold', label: 'BỎ', cls: 'grey', icon: 'emoji-fluent-3d/hands/waving_hand.png', onClick: () => turnRes && turnRes({ type: 'fold' }) },
      { id: 'call', label: 'XEM', cls: 'mint', icon: 'emoji-fluent-3d/hands/thumbs_up.png', onClick: () => turnRes && turnRes({ type: 'call' }) },
      { id: 'raise', label: 'TỐ', cls: 'pink', icon: 'emoji-fluent-3d/symbols/fire.png', onClick: () => turnRes && turnRes(rz.value >= lastLegal.raise.max ? { type: 'allin' } : { type: 'raise', to: rz.value }) },
      { id: 'allin', label: potLimit ? 'TỐ HŨ' : 'ALL-IN', cls: 'lavender', onClick: () => turnRes && turnRes({ type: 'allin' }) },
    ]);
    const capped = L => potLimit && L && L.raise && L.raise.max < L.bet + L.stack;   // pot-limit: the max is the pot, not the stack
    const rz = raiseBox(ctx, bar, v => bar.set('raise', { label: lastLegal && lastLegal.raise && v >= lastLegal.raise.max ? (capped(lastLegal) ? 'TỐ HŨ' : 'ALL-IN') : (lastLegal && lastLegal.currentBet ? 'TỐ ' : 'CƯỢC ') + HC.short(v) }), potLimit);
    const refit = fitBar(ctx, bar);
    const lock = () => { ['fold', 'call', 'raise', 'allin'].forEach(id => bar.set(id, { disabled: true })); rz.setLimits(null); };
    lock();
    const myTurn = (L, street) => new Promise(res => {
      lastLegal = L;
      bar.set('fold', { disabled: false });
      bar.set('call', { disabled: false, label: L.toCall === 0 ? 'XEM' : L.toCall >= L.stack ? 'THEO HẾT' : 'THEO ' + HC.short(L.toCall) });
      bar.set('raise', { disabled: !L.raise });
      bar.set('allin', { disabled: !(L.raise || (L.toCall > 0 && L.toCall >= L.stack)), label: capped(L) ? 'TỐ HŨ ' + HC.short(L.raise.max) : 'ALL-IN' });
      rz.setLimits(L.raise ? { min: L.raise.min, max: L.raise.max, unit: sb, pot: C.potTotal(st) + L.toCall, currentBet: L.currentBet, bb } : null);
      if (!L.raise) bar.set('raise', { label: 'TỐ' });
      ctx.ui.status(`${STREET[street]} · ${L.toCall ? `cần theo <b>${HC.fmt(L.toCall)}</b>` : 'tới lượt bạn'} · ${showMyHand()}`);
      refit();
      ctx.sfx('turn', .3);
      turnRes = a => { turnRes = null; lock(); res(a); };
      if (auto || (demo && (street === 0 || full))) {
        const pol = demo ? 'call' : test.policy || 'call';
        setTimeout(() => turnRes && turnRes(pol === 'fold' ? { type: 'fold' } : pol === 'allin' ? { type: 'allin' } : { type: 'call' }), 30);
      }
    });
    const SAY = {
      check: ['Xem 👀', 'Qua', 'Check nhẹ 😌'], call: ['Theo!', 'Theo luôn 😏', 'Cho xem bài nào'], fold: ['Bỏ 😮‍💨', 'Thôi nhường…', 'Bài xấu quá 🥲'],
      raise: ['Tố {x}! 🔥', 'Lên {x} nè', 'Dám theo {x} không? 😎'], bet: ['Cược {x}', 'Thử {x} xem sao 😏'], allin: ['All-in! 🔥', 'Tất tay luôn! 😤'],
    };
    const sweep = async () => {
      let any = false;
      betG.forEach((g, k) => { if (g) { any = true; fly(ctx, g, POT.x, POT.z, 460, true); betG[k] = null; } if (betL[k]) { betL[k].remove(); betL[k] = null; } });
      if (any) await ctx.wait(500);
      const side = C.pots(st.players).filter(p => p.eligible.length > 1).length - 1;
      setPot(ctx, C.potTotal(st), side > 0 ? side : 0);
    };
    const streetTag = txt => { S.street = txt; info(txt, C.potTotal(st) - st.players.reduce((a, p) => a + p.bet, 0), S.side); };
    let revealed = false;
    const revealAll = async () => {
      if (revealed) return; revealed = true;
      for (const k of order) { if (seats[k].me || !C.inHand(st.players[k])) continue; for (const m of meshes[k]) { ctx.flip(m, true, 280); await ctx.wait(80); } }
      await ctx.wait(250);
    };
    let demoStep = 0;
    for (let street = 0; street < 4; street++) {
      if (street > 0) {
        await sweep();
        C.street(st);
        log.push({ street });
        // burn one, then deal the flop (3) / turn / river face down and turn them over
        deck.pop();
        const n = street === 1 ? 3 : 1, fresh = [], dealt = [];
        for (let j = 0; j < n; j++) {
          const c = rig.board[board.length] || deck.pop(), m = ctx.card(c.key, { w: 1.25 }), p = BOARD(board.length);
          m.position.set(DECK.x, .3, DECK.z); m.rotation.set(0, .5, Math.PI); ctx.add(m);
          board.push(c); boardM.push(m); fresh.push(m);
          dealt.push(ctx.deal(m, { x: p.x, z: p.z, ry: 0 }, 330, false)); await ctx.wait(140);
        }
        await Promise.all(dealt);
        await ctx.wait(200);
        for (const m of fresh) { ctx.flip(m, true, 300); await ctx.wait(120); }
        await ctx.wait(240);
        streetTag(STREET[street]);
        if (!st.players[0].folded) showMyHand();
      } else streetTag('Preflop');
      if (C.liveCount(st) <= 1) break;
      if (C.bettingClosed(st)) { await revealAll(); continue; }
      let i = C.nextActor(st, street === 0 ? pos.bb : pos.button);
      while (i >= 0) {
        const s = seats[i], L = C.legal(st, i);
        s.turn(true);
        let a;
        if (s.me) a = await myTurn(L, street);
        else {
          if (!auto) ctx.ui.status(`${STREET[street]} · <b>${s.name}</b> đang suy nghĩ…`);
          anim(s, 'think');
          await ctx.wait(480 + ctx.rand() * 420);
          const botPol = test && test.botPolicy;
          if (botPol === 'call') a = { type: 'call' };
          else if (demo) a = street === 0 ? { type: 'call' } : (() => { const plan = ['check', 'bet', 'call', 'fold'][demoStep++ % 4]; return plan === 'bet' && L.raise ? { type: 'raise', to: Math.min(L.raise.max, Math.max(L.raise.min, Math.round(C.potTotal(st) * .5 / sb) * sb)) } : { type: plan === 'fold' ? 'fold' : 'call' }; })();
          else { const lv = ctx.room ? ctx.aiLevel(1) : undefined; a = P.botDecide({ hole: hole[i], board, legal: L, pot: C.potTotal(st), nOpp: C.liveCount(st) - 1, bb, unit: sb, street, pers: P.PERSONAS[i % P.PERSONAS.length], sims: ctx.TEST ? 50 : lv == null ? 140 : [40, 90, 140, 220][lv], level: lv }, ctx.rand); }
        }
        const before = st.players[i].bet, cb = st.currentBet, r = C.act(st, i, a);
        log.push({ i, a: { type: a.type, to: a.to } });
        if (s.me) { if (r.put && !ctx.spend(r.put)) throw new Error('wallet out of sync'); } else sync(i);
        const kind = st.players[i].allIn && r.put ? 'allin' : r.type === 'raise' ? (cb ? 'raise' : 'bet') : r.type;
        if (r.type === 'fold') { foldCards(i); anim(s, 'sad'); }
        else { if (st.players[i].bet !== before) showBet(i, true); if (kind === 'raise' || kind === 'allin' || kind === 'bet') anim(s, 'cheer'); }
        if (!s.me) s.say(ctx.pick(SAY[kind]).replace('{x}', HC.short(st.players[i].bet)), 1500);
        s.turn(false);
        await ctx.wait(220);
        i = C.nextActor(st, i);
        if (demo && i === 0 && street > 0) { const b = seats.find(x => !x.me && st.players[x.i].bet === st.currentBet && st.currentBet > 0); if (b) b.say('Dám theo không? 😎', 1e9); }
      }
      if (C.liveCount(st) <= 1) break;
      if (C.bettingClosed(st) && street < 3) { await sweep(); await revealAll(); }
    }
    ctx.ui.clearActions();
    await sweep();
    streetTag('');
    const chipsOk = C.chipsInPlay(st) === chips0;
    // ---- showdown
    const live = st.players.filter(C.inHand).map(p => p.i);
    const hands7 = hole.map((h, k) => (C.inHand(st.players[k]) ? [...h, ...board] : null));
    const evals = hands7.map(h => (h && h.length >= 5 ? P.evaluate(h) : null));
    const res = P.showdown(st, hands7, order);
    const sdTag = [];
    if (live.length > 1) {
      ctx.ui.status('Lật bài!');
      await revealAll();
      for (const k of order) if (live.includes(k) && !seats[k].me) S.tags.push(sdTag[k] = ctx.label(seats[k].spot(0, 1.95).setY(.95), `<div class="tag3 sky">${evals[k].desc}</div>`));
      if (live.includes(0)) sdTag[0] = myTag;
      await ctx.wait(500);
    }
    // ---- award each pot (main first, then side pots)
    if (S.pot) { ctx.remove(S.pot); S.pot = null; }
    S.infoLbl.el.innerHTML = ''; S.street = ''; S.side = 0;
    const winners = [];
    for (let d = 0; d < res.detail.length; d++) {
      const det = res.detail[d];
      if (live.length > 1 && det.eligible.length > 1) {
        // light up the best five cards of the (first) winner of this pot
        const w = det.winners[0], best = new Set(evals[w].best.map(c => c.key));
        const all = [...boardM, ...meshes[w]];
        all.forEach(m => { const on = best.has(m.userData.key); if (on) ctx.tween(m, { y: m.position.y + (seats[w].me ? .25 : .18) }, 220, 'back'); });
        if (res.detail.length > 1) ctx.ui.status(`${d === 0 ? 'Hũ chính' : 'Hũ phụ ' + d} · ${HC.fmt(det.amount)} → <b>${det.winners.map(k => seats[k].name).join(', ')}</b> (${evals[w].name})`);
      }
      for (const w of det.winners) {
        if (!winners.includes(w)) winners.push(w);
        const p = betSpot(ctx, seats[w]), g = pile(ctx, Math.floor(det.amount / det.winners.length), POT.x, POT.z);
        fly(ctx, g, p.x, p.z, 560, false).then(() => ctx.wait(350)).then(() => { const f = fromSpot(ctx, seats[w]); return fly(ctx, g, f.x, f.z, 480, true); });
      }
      await ctx.wait(res.detail.length > 1 ? 900 : 300);
      if (live.length > 1 && det.eligible.length > 1) [...boardM, ...meshes[det.winners[0]]].forEach(m => { const base = boardM.includes(m) ? .02 : seats[det.winners[0]].me ? MY(0).y : .02; ctx.tween(m, { y: base }, 200, 'out'); });
    }
    for (const w of winners) {
      const s = seats[w], uncontested = live.length === 1;
      const name = uncontested ? 'Ăn hũ' : (res.detail.some(d => d.winners.includes(w) && d.winners.length > 1) ? 'Chia · ' : '') + evals[w].desc;
      const html = `<div class="tag3 lemon"${s.me ? ' style="font-size:26px"' : ''}>👑 ${name}</div>`;
      if (sdTag[w]) sdTag[w].el.innerHTML = html;
      else S.tags.push(ctx.label(s.me ? new T.Vector3(1.6, 2.25, 5.0) : s.spot(0, 1.95).setY(.95), html, s.me ? 'al-l' : ''));
      if (!s.me) { anim(s, 'cheer'); s.say(uncontested ? ctx.pick(['Hehe, ăn mù 😏', 'Không ai theo à? 😆']) : ctx.pick([evals[w].name + ' nè! 😎', 'Cảm ơn nha 💰', 'Bài đẹp quá 🤩']), 1800); }
    }
    for (const k of live) if (!winners.includes(k)) anim(seats[k], 'sad');
    await ctx.wait(600);
    seats.forEach((s, k) => { st.players[k].stack += res.pay[k]; if (!s.me) { S.stacks[k] = st.players[k].stack; sync(k); } });
    if (res.pay[0] > 0) ctx.win(res.pay[0], new T.Vector3(0, 1, 4));
    const myNet = res.pay[0] - st.players[0].total;
    if (myNet > 0) { ctx.ui.callout(live.length > 1 && evals[0].cat >= 4 ? evals[0].name.toUpperCase() + '!' : 'THẮNG!'); ctx.sfx('win', .5); if (evals[0] && evals[0].cat >= 6) ctx.ui.confetti(); }
    else if (myNet < 0) ctx.sfx('lose', .35);
    ctx.ui.status(myNet > 0 ? `Bạn ăn <b>${HC.fmt(res.pay[0])}</b> 🎉` : myNet < 0 ? `Mất <b>${HC.fmt(-myNet)}</b> ván này` : 'Hoà vốn');
    const rows = order.map(k => {
      const s = seats[k], p = st.players[k], shown = live.length > 1 && !p.folded;
      return { name: s.me && s.name === 'Bạn' ? 'Bạn' : s.name + (s.me ? ' (bạn)' : ''), avatar: s.avatar, me: s.me, amount: res.pay[k] - p.total,
        detail: `${p.folded ? 'Bỏ bài' : shown ? evals[k].desc + ' · ' + evals[k].best.map(C.name).join(' ') : s.me ? 'Không cần lật' : 'Không lật bài'} · đã cược ${HC.short(p.total)}${p.allIn ? ' · all-in' : ''}`,
        tag: winners.includes(k) ? (shown ? evals[k].name : 'Ăn hũ') : k === pos.button ? 'D' : null };
    });
    const result = { log, hole: hole.map(h => h.slice()), board: board.slice(), order, stacks0, bb, pos, potLimit, coinsDelta: ctx.coins - coinsStart, chipsOk };
    if (!auto) await ctx.ui.results(myNet > 0 ? 'Bạn thắng ' + HC.short(myNet) + '!' : winners.length ? seats[winners[0]].name + ' ăn hũ' : 'Kết thúc ván', rows, { again: 'Ván tiếp' });
    // ---- clear the table
    for (const m of [...meshes.flat(), ...boardM]) ctx.tween(m, { x: DECK.x, y: .3, z: DECK.z, rx: 0, arc: 1 }, 380, 'io').then(() => ctx.remove(m));
    betL.forEach(l => l && l.remove());
    await ctx.wait(450);
    return result;
  }
})();
