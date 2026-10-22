/* Liêng 3D — you + 4 bots, everyone antes, three cards each, one betting round (Theo / Tố / Úp bài, max 3 raises),
 * showdown. Your stack is the shared wallet: chips go in with ctx.spend and come back with ctx.win.
 * Rules in js/games3d/rules/lieng.js, betting engine + side pots in js/games3d/rules/cards-common.js. */
(function () {
  'use strict';
  const ANGLES = [90, 200, 247, 293, 340], SEAT_R = 7.9;
  const CAM = { pos: [0, 12, 17], look: [0, 0, -2.3] };
  const LEVELS = [1000, 5000, 10000, 50000, 100000];
  const MY = i => ({ x: (i - 1) * 1.62, y: 1.55, z: 5.1, rx: 1.0 });
  const POT = { x: 0, z: -1.0 }, ME_BET = { x: -3.35, z: 3.45 }, ME_BTN = { x: 3.3, z: 3.55 }, ME_DECK = { x: 3.7, z: 1.9 };

  T3.register('lieng', {
    title: 'Liêng', sub: 'Sáp › Liêng › Ảnh › Điểm · Theo, Tố hay Úp',
    table: 'round', theme: 'lavender', tex: ['cards', 'chips'], cam: CAM,
    scripts: ['js/games3d/rules/cards-common.js', 'js/games3d/rules/lieng.js'],
    models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    rules: `<p>Mỗi người bỏ <b>tiền gà</b> (ante) bằng mức cược đã chọn, rồi được chia 3 lá. Sau đó cược một vòng bắt đầu từ người bên trái người chia (nút <b>D</b>):</p>
      <ul><li><b>Theo</b>: bỏ thêm cho bằng mức cược cao nhất (chưa ai tố thì là <b>Xem</b>, không mất gì).</li>
      <li><b>Tố</b>: nâng mức cược, ít nhất bằng lần tố trước (lần đầu ít nhất bằng tiền gà). Mỗi vòng tối đa <b>3 lần tố</b>. Ai bị tố lại thì phải theo, tố tiếp hoặc úp.</li>
      <li><b>Úp bài</b>: bỏ ván, mất số đã bỏ vào. Chỉ còn một người thì người đó ăn hết, không phải lật bài.</li>
      <li>Hết xu khi đang theo thì được <b>theo hết</b> (all-in) và chỉ ăn phần hũ tương ứng (hũ phụ).</li></ul>
      <p>Lật bài: mạnh nhất là <b>Sáp</b> (3 lá giống nhau, Sáp A lớn nhất) › <b>Liêng</b> (3 lá liên tiếp, không cần đồng chất: Q-K-A lớn nhất, A-2-3 nhỏ nhất, K-A-2 không phải Liêng) › <b>Ảnh</b> (3 lá J/Q/K) › <b>Điểm</b> (tổng 3 lá lấy hàng đơn vị: A = 1, 10/J/Q/K = 0).</p>
      <p><b>Bằng nhau</b> (cùng Liêng, cùng Ảnh, cùng điểm): so <b>lá to nhất</b> — xét số trước (A › K › Q › … › 2; Liêng A-2-3 thì lá to là 3), cùng số thì xét chất ♦ › ♥ › ♠ › ♣. Vì vậy không bao giờ hoà, hũ không bị chia.</p>`,
    async start(ctx) { for (;;) await hand(ctx, null); },
    async selftest(ctx) {
      const C = window.Rules['cards-common'], R = window.Rules['lieng'], checks = [];
      const run = async (label, opts) => {
        const r = await hand(ctx, Object.assign({ auto: true, ante: 5000 }, opts));
        // replay the logged actions on a fresh engine and settle independently
        const st = C.table(r.stacks0, { minRaise: r.ante, raiseCap: R.RAISE_CAP, unit: 1000 });
        r.log.filter(e => e.ante != null).forEach(e => C.ante(st, e.i, r.ante)); C.street(st);
        let myPut = st.players[0].total;
        for (const e of r.log) if (e.a) { const x = C.act(st, e.i, e.a); if (e.i === 0) myPut += x.put; }
        const sd = R.showdown(st, r.hands.map((h, k) => (st.players[k].folded ? null : h)), r.order);
        const want = sd.pay[0] - myPut, potOk = sd.pay.reduce((a, b) => a + b, 0) === C.potTotal(st);
        checks.push({ label, me: r.hands[0].map(C.name).join(' '), myPut, pay: sd.pay[0], coinsDelta: r.coinsDelta, want, ok: r.coinsDelta === want && potOk && r.chipsOk });
      };
      await run('Sáp A, theo tới cùng', { policy: 'call', rig: 'A♦ A♠ A♣' });
      await run('tố một lần rồi theo', { policy: 'raise' });
      await run('úp bài ngay', { policy: 'fold' });
      const fail = checks.filter(c => !c.ok).length;
      return { pass: fail ? 0 : 1, fail, checks };
    },
  });

  let S = null;
  /** Chip stack flight. Replaces ctx.moveStack(): T3 tween() with `arc` but no `y` adds the arc to position.y on every
   *  step without resetting it, so stacks (and anything else tweened that way) drift upward. Always pass y. */
  const fly = (ctx, g, x, z, ms = 500, vanish = false) => { ctx.sfx('chips', .35); return ctx.tween(g, { x, y: 0, z, arc: 1.4 }, ms, 'io').then(() => { if (vanish) ctx.remove(g); }); };
  const anim = (s, name) => { if (s.anim) s.anim(name); };   // seat 0 (you) has no 3D body
  function css() {
    if (document.getElementById('ct3-css')) return;
    const st = document.createElement('style'); st.id = 'ct3-css';
    st.textContent = `.ct-amt{padding:3px 14px;border-radius:16px;background:rgba(50,22,60,.72);color:#ffe27a;font:400 22px "Grandstander Black";box-shadow:0 4px 10px rgba(0,0,0,.18)}
      .ct-pot{display:flex;align-items:center;gap:8px;padding:6px 20px 6px 8px;border-radius:26px;background:rgba(255,255,255,.95);border:3px solid #fff;box-shadow:0 5px 0 rgba(95,63,201,.3),0 8px 16px rgba(60,10,50,.2);font:400 28px "Grandstander Black";color:#a86d00}
      .ct-pot img{width:40px}.ct-pot small{font:800 18px "Baloo 2";color:#8a6a80;margin-right:4px}
      .bub3.bub-r{translate:50% 0}.bub3.bub-l{translate:-50% 0}
      .ct-bar .gbtn{min-width:180px;padding:0 26px}
      .rz{position:absolute;left:100%;top:50%;transform:translateY(-50%);margin-left:14px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 18px 12px;border-radius:36px;white-space:nowrap}
      .rz .amt{font:400 32px "Grandstander Black";color:#a86d00;line-height:1}
      .rz input{width:300px;height:30px;accent-color:#ff4f95;cursor:pointer}
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
  /** A heap of chips worth `amount`, spread over a few columns. */
  function pile(ctx, amount, x, z) {
    const T = ctx.THREE, g = new T.Group(); g.position.set(x, 0, z);
    const keys = ctx.chipsFor(amount, 40), cols = Math.max(1, Math.min(7, Math.ceil(keys.length / 5)));
    const off = [[0, 0], [.82, .12], [-.8, .18], [.38, .74], [-.42, -.7], [.5, -.66], [-.36, .78]];
    keys.forEach((k, i) => { const c = ctx.chip(k), col = i % cols, h = Math.floor(i / cols); c.position.set(off[col][0] + (Math.random() - .5) * .05, .05 + h * .1, off[col][1] + (Math.random() - .5) * .05); c.rotation.y = Math.random() * 6; g.add(c); });
    ctx.add(g); return g;
  }
  /** Dealer button: a chunky disc with the marker texture, tilted towards the camera so the letter stays readable. */
  function marker(ctx, key, rim = 0xff6fa8) {
    const T = ctx.THREE, g = new T.Group(), d = new T.Group(), r = .46;
    const side = new T.Mesh(new T.CylinderGeometry(r, r, .12, 40), ctx.mat(rim, { roughness: .4 })); side.castShadow = true; d.add(side);
    const t = ctx.tex(key);
    const top = new T.Mesh(new T.CircleGeometry(r * .98, 40), new T.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .35, roughness: .45, transparent: true, alphaTest: .2 }));
    top.rotation.x = -Math.PI / 2; top.position.y = .061; d.add(top);
    d.rotation.x = .6; d.position.y = r * Math.sin(.6) + .04; g.add(d);
    ctx.add(g); return g;
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

  async function setup(ctx) {
    const T = ctx.THREE;
    css();
    ctx.music('cards');
    const seats = await ctx.seats(5, { angles: ANGLES, r: SEAT_R });
    arrange(ctx, seats); fitCam(ctx);
    const deckG = new T.Group();
    for (let i = 0; i < 10; i++) { const c = ctx.card(null); c.rotation.z = Math.PI; c.position.y = .02 + i * .022; c.rotation.y = .5 + (Math.random() - .5) * .12; deckG.add(c); }
    ctx.add(deckG);
    const btn = marker(ctx, 'marker_d');
    const potLbl = ctx.label(new T.Vector3(POT.x, .55, POT.z), '', '');   // T3 rewrites label display every frame: hide by emptying
    const chips = ctx.ui.chipPicker(LEVELS, null, 1);
    S = { seats, deckG, btn, potLbl, chips, dealer: 0, first: true, tags: [] };
  }
  const deckSpot = (ctx, s) => (s.me ? new ctx.THREE.Vector3(ME_DECK.x, 0, ME_DECK.z) : s.spot(-1.15, 3.05));
  const btnSpot = (ctx, s) => (s.me ? new ctx.THREE.Vector3(ME_BTN.x, 0, ME_BTN.z) : s.spot(1.55, 2.75));
  const betSpot = (ctx, s) => (s.me ? new ctx.THREE.Vector3(ME_BET.x, 0, ME_BET.z) : s.spot(0, 3.35));
  const fromSpot = (ctx, s) => (s.me ? new ctx.THREE.Vector3(0, 0, 8) : s.pos);
  function setPot(ctx, amount, label) {
    const el = S.potLbl.el;
    el.innerHTML = amount ? `<div class="ct-pot"><img src="${HC.A('emoji-fluent-3d/game/money_bag.png')}"><small>${label || 'Tổng cược'}</small>${HC.fmt(amount)}</div>` : '';
    if (S.pot) ctx.remove(S.pot);
    S.pot = amount ? pile(ctx, amount, POT.x, POT.z) : null;
    if (S.pot) { S.pot.scale.setScalar(.85); ctx.tween(S.pot, { s: 1 }, 260, 'back'); }
  }

  /** Raise slider + presets placed inside the action bar. */
  function raiseBox(ctx, bar, fmtLabel) {
    bar.el.classList.add('ct-bar');
    const box = ctx.ui.h('div', { class: 'rz glass off' }, bar.el);
    const amt = ctx.ui.h('div', { class: 'amt', text: '0' }, box);
    const rng = ctx.ui.h('input', { type: 'range', min: '0', max: '1000', value: '0' }, box);
    const pre = ctx.ui.h('div', { class: 'pre' }, box);
    let lim = null, val = 0;
    const show = () => { amt.textContent = (lim.prefix || '') + HC.short(val - (lim.base || 0)); fmtLabel(val); };
    const set = v => { if (!lim) return; val = Math.max(lim.min, Math.min(lim.max, v)); show(); rng.value = String(Math.round(Math.sqrt((val - lim.min) / Math.max(1, lim.max - lim.min)) * 1000)); };
    rng.addEventListener('input', () => { if (!lim) return; const t = (+rng.value / 1000) ** 2; let v = lim.min + (lim.max - lim.min) * t; v = v >= lim.max ? lim.max : Math.round(v / lim.unit) * lim.unit; val = Math.max(lim.min, Math.min(lim.max, v)); show(); });
    const presets = {};
    const mk = (id, text, cls) => { const b = ctx.ui.h('b', { text, class: cls || '' }, pre); b.onclick = () => { ctx.sfx('click', .3); presets[id] && set(presets[id]()); }; return b; };
    mk('min', 'Min'); mk('half', '½ hũ'); mk('pot', 'Cả hũ'); mk('max', 'Tất tay', 'all');
    return {
      get value() { return val; },
      setLimits(l) {   // {min, max, unit, pot, currentBet, base (chips already in this round), prefix} or null
        lim = l; box.classList.toggle('off', !l);
        if (!l) { amt.textContent = '—'; return; }
        presets.min = () => l.min; presets.max = () => l.max;
        presets.half = () => Math.round((l.currentBet + l.pot * .5) / l.unit) * l.unit; presets.pot = () => Math.round((l.currentBet + l.pot) / l.unit) * l.unit;
        set(l.def || l.min);
      },
    };
  }

  async function hand(ctx, test) {
    if (!S) await setup(ctx);
    const T = ctx.THREE, C = window.Rules['cards-common'], R = window.Rules['lieng'];
    const { seats } = S, me = seats[0], N = seats.length;
    const auto = !!(test && test.auto), demo = ctx.Q.has('demo') && !auto, full = demo && ctx.Q.getAll('demo').includes('2');   // demo=2: play the hand out
    S.tags.forEach(t => t.remove()); S.tags = [];
    // ---- dealer button
    S.dealer = S.first ? (demo || auto ? 0 : Math.floor(ctx.rand() * N)) : (S.dealer + 1) % N; S.first = false;
    const bs = btnSpot(ctx, seats[S.dealer]), DECK = deckSpot(ctx, seats[S.dealer]);
    ctx.tween(S.btn, { x: bs.x, y: 0, z: bs.z, arc: .8 }, 420, 'io');
    const deckMove = ctx.tween(S.deckG, { x: DECK.x, y: 0, z: DECK.z, arc: .8 }, 420, 'io');
    for (const s of seats) if (!s.me && s.coins < 300000) { s.setCoins(s.coins + 1500000); s.say('Nạp thêm xu nè 😅', 1500); }
    // ---- choose the ante
    let ante = 0;
    await new Promise(res => {
      ctx.ui.status('Chọn <b>tiền gà</b> bên trái rồi bấm <b>VÀO VÁN</b>');
      const a = ctx.ui.actions([{ id: 'go', label: 'VÀO VÁN', cls: 'pink', icon: 'emoji-fluent-3d/game/joker.png', onClick: () => {
        const v = (test && test.ante) || S.chips.value;
        if (ctx.coins < v) { ctx.ui.toast('Không đủ xu cho mức này 😅', 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); ctx.sfx('error', .4); return; }
        ante = v; res();
      } }]);
      if (auto || demo) a.btn('go').click();
    });
    ctx.ui.clearActions();
    // ---- engine state; your stack is the wallet
    const coinsStart = ctx.coins, stacks0 = seats.map(s => (s.me ? ctx.coins : s.coins));
    const st = C.table(stacks0, { minRaise: ante, raiseCap: R.RAISE_CAP, unit: 1000 }), chips0 = C.chipsInPlay(st);
    const log = [], order = [1, 2, 3, 4, 5].map(k => (S.dealer + k) % N);
    const sync = i => { const s = seats[i]; if (!s.me) s.setCoins(st.players[i].stack); };
    // antes fly into the pot
    ctx.ui.status(`Mỗi người bỏ tiền gà <b>${HC.fmt(ante)}</b>`);
    ctx.sfx('chips', .4);
    const flying = [];
    seats.forEach((s, i) => {
      const put = C.ante(st, i, ante); log.push({ i, ante: put });
      if (s.me) { if (!ctx.spend(put)) throw new Error('wallet out of sync'); } else sync(i);
      const f = fromSpot(ctx, s), g = ctx.stack(put, f.x, f.z); g.position.y = 1.4;
      flying.push(ctx.tween(g, { x: POT.x + (ctx.rand() - .5) * .6, y: 0, z: POT.z + (ctx.rand() - .5) * .6, arc: 1.3 }, 520 + i * 60, 'io').then(() => ctx.remove(g)));
    });
    await Promise.all(flying);
    setPot(ctx, C.potTotal(st));
    C.street(st);
    // ---- deal three cards each from the deck, starting left of the dealer
    const deck = ctx.deck();
    let rigged = null;
    if (test && test.rig) rigged = C.parse(test.rig).map(c => deck.splice(deck.findIndex(d => d.key === c.key), 1)[0]);
    const hands = seats.map(() => []), meshes = seats.map(() => []);
    await deckMove;   // T3 tween() drops an overlapping tween on the same object without resolving it
    ctx.sfx('shuffle', .45);
    for (let i = 0; i < 4; i++) await ctx.tween(S.deckG, { ry: i % 2 ? -.2 : .2, y: .12 }, 70, 'io');
    await ctx.tween(S.deckG, { ry: 0, y: 0 }, 90, 'out');
    const give = (i, k) => {
      const s = seats[i], c = s.me && rigged ? rigged[k] : deck.pop(), m = ctx.card(c.key, s.me ? { w: 1.32 } : {});
      m.position.set(DECK.x, .3, DECK.z); m.rotation.set(0, s.me ? 0 : .5, Math.PI); ctx.add(m);
      hands[i].push(c); meshes[i].push(m);
      if (s.me) { const p = MY(k); ctx.sfx('card', .3); return ctx.tween(m, { x: p.x, y: p.y, z: p.z, rx: p.rx, ry: 0, rz: Math.PI, arc: .9 }, 360, 'out'); }
      const p = s.spot((k - 1) * .82, 2.0);
      return ctx.deal(m, { x: p.x, z: p.z, ry: s.facing, y: .02 + k * .006 }, 320, false);
    };
    const flights = [];
    for (let k = 0; k < 3; k++) for (const i of order) { flights.push(give(i, k)); await ctx.wait(100); }
    await Promise.all(flights);
    // look at your cards
    for (let k = 0; k < 3; k++) { const p = MY(k); ctx.tween(meshes[0][k], { rz: 0, arc: .3, y: p.y }, 300, 'io'); await ctx.wait(90); }
    await ctx.wait(260);
    const myEval = R.evaluate(hands[0]);
    const myTag = ctx.label(new T.Vector3(0, 3.0, 5.0), `<div class="tag3 sky" style="font-size:26px">${myEval.desc}</div>`); S.tags.push(myTag);
    // ---- betting round
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
    const dim = m => [m.userData.front, m.userData.back].forEach(x => { x.material.opacity = .5; });
    const foldCards = i => {
      const s = seats[i];
      meshes[i].forEach((m, k) => {
        const p = s.me ? { x: (k - 1) * .35, z: 4.2 } : s.spot((k - 1) * .3, 1.75);
        ctx.tween(m, { x: p.x, y: .03 + k * .012, z: p.z, rx: 0, ry: s.me ? 0 : s.facing, rz: Math.PI, arc: .6 }, 420, 'io').then(() => dim(m));
      });
      const tg = ctx.label(s.me ? new T.Vector3(0, 1.0, 4.2) : s.spot(0, 1.75).setY(.9), '<div class="tag3 grey">Úp bài</div>'); S.tags.push(tg);
      if (s.me) myTag.remove();
    };
    let turnRes = null;
    let lastLegal = null;
    const bar = ctx.ui.actions([
      { id: 'fold', label: 'ÚP BÀI', cls: 'grey', icon: 'emoji-fluent-3d/hands/waving_hand.png', onClick: () => turnRes && turnRes({ type: 'fold' }) },
      { id: 'call', label: 'THEO', cls: 'mint', icon: 'emoji-fluent-3d/hands/thumbs_up.png', onClick: () => turnRes && turnRes({ type: 'call' }) },
      { id: 'raise', label: 'TỐ', cls: 'pink', icon: 'emoji-fluent-3d/symbols/fire.png', onClick: () => turnRes && turnRes(rz.value >= lastLegal.raise.max ? { type: 'allin' } : { type: 'raise', to: rz.value }) },
    ]);
    const rz = raiseBox(ctx, bar, v => bar.set('raise', { label: v >= (lastLegal && lastLegal.raise ? lastLegal.raise.max : Infinity) ? 'TẤT TAY' : 'TỐ ' + HC.short(v - (lastLegal ? lastLegal.bet : 0)) }));
    const refit = fitBar(ctx, bar);
    const lock = () => { ['fold', 'call', 'raise'].forEach(id => bar.set(id, { disabled: true })); rz.setLimits(null); };
    lock();
    const myTurn = L => new Promise(res => {
      lastLegal = L;
      bar.set('fold', { disabled: false });
      bar.set('call', { disabled: false, label: L.toCall === 0 ? 'XEM' : L.toCall >= L.stack ? 'THEO HẾT ' + HC.short(L.toCall) : 'THEO ' + HC.short(L.toCall) });
      bar.set('raise', { disabled: !L.raise, label: 'TỐ' });
      rz.setLimits(L.raise ? { min: L.raise.min, max: L.raise.max, unit: 1000, pot: C.potTotal(st) + L.toCall, currentBet: L.currentBet, base: L.bet, prefix: '+' } : null);
      ctx.ui.status(L.toCall ? `Tới lượt bạn · cần theo <b>${HC.fmt(L.toCall)}</b> · ${myEval.desc}` : `Tới lượt bạn · ${myEval.desc}`);
      refit();
      ctx.sfx('turn', .3);
      turnRes = a => { turnRes = null; lock(); res(a); };
      if (auto || full) {
        const pol = (test && test.policy) || 'call', raisedYet = log.some(e => e.i === 0 && e.a && e.a.type === 'raise');
        setTimeout(() => turnRes && turnRes(pol === 'fold' ? { type: 'fold' } : pol === 'raise' && L.raise && !raisedYet ? { type: 'raise', to: L.raise.min } : { type: 'call' }), 30);
      }
    });
    const SAY = {
      check: ['Xem 👀', 'Qua lượt', 'Từ từ đã 😌'], call: ['Theo!', 'Theo luôn 😏', 'Sợ gì, theo!'], fold: ['Úp bài 😮‍💨', 'Thôi bỏ…', 'Bài xấu quá 🥲'],
      raise: ['Tố {x}! 🔥', 'Tố thêm {x} nè', 'Dám theo không? {x} 😎'], allin: ['Tất tay! 🔥', 'All-in luôn! 😤'],
    };
    let i = C.nextActor(st, S.dealer), demoStep = 0;
    while (i >= 0) {
      const s = seats[i], L = C.legal(st, i);
      s.turn(true);
      let a;
      if (s.me) {
        if (demo) { const b = seats.find(x => !x.me && st.players[x.i].bet === st.currentBet && st.currentBet > 0); if (b) b.say('Dám theo không? 😎', 1e9); }
        a = await myTurn(L);
      } else {
        if (!auto) ctx.ui.status(`<b>${s.name}</b> đang suy nghĩ…`);
        anim(s, 'think');
        await ctx.wait(480 + ctx.rand() * 420);
        if (demo) { const plan = ['call', 'raise', 'call', 'fold'][demoStep++ % 4]; a = plan === 'raise' && L.raise ? { type: 'raise', to: Math.min(L.raise.max, Math.max(L.raise.min, ante * 4)) } : { type: plan === 'fold' ? 'fold' : 'call' }; }
        else a = R.botDecide({ hand: hands[i], legal: L, pot: C.potTotal(st), nOpp: C.liveCount(st) - 1, ante, unit: 1000, pers: R.PERSONAS[i % R.PERSONAS.length] }, ctx.rand);
      }
      const before = st.players[i].bet, r = C.act(st, i, a);
      log.push({ i, a: { type: a.type, to: a.to } });
      if (s.me) { if (r.put && !ctx.spend(r.put)) throw new Error('wallet out of sync'); } else sync(i);
      // show it
      const kind = r.type === 'raise' ? (st.players[i].allIn ? 'allin' : 'raise') : r.type === 'call' && st.players[i].allIn ? 'allin' : r.type;
      if (r.type === 'fold') { foldCards(i); anim(s, 'sad'); }
      else { if (st.players[i].bet !== before) showBet(i, true); if (kind === 'raise' || kind === 'allin') anim(s, 'cheer'); }
      if (!s.me) s.say(ctx.pick(SAY[kind]).replace('{x}', HC.short(st.players[i].bet)), 1500);
      else ctx.ui.status(kind === 'fold' ? 'Bạn úp bài' : kind === 'check' ? 'Bạn xem' : `Bạn ${kind === 'raise' ? 'tố' : 'theo'} · đã bỏ <b>${HC.fmt(st.players[i].total)}</b>`);
      s.turn(false);
      await ctx.wait(240);
      i = C.nextActor(st, i);
    }
    ctx.ui.clearActions();
    // ---- sweep the bets into the pot
    let swept = false;
    betG.forEach((g, k) => { if (g) { swept = true; fly(ctx, g, POT.x, POT.z, 480, true); } if (betL[k]) betL[k].remove(); });
    if (swept) await ctx.wait(520);
    setPot(ctx, C.potTotal(st));
    const chipsOk = C.chipsInPlay(st) === chips0;
    // ---- showdown
    const live = st.players.filter(C.inHand).map(p => p.i);
    const res = R.showdown(st, hands.map((h, k) => (st.players[k].folded ? null : h)), order);
    const evals = hands.map(h => R.evaluate(h));
    const sdTag = [];
    if (live.includes(0)) sdTag[0] = myTag;
    if (live.length > 1) {
      ctx.ui.status('Lật bài!');
      for (const k of order) {
        if (!live.includes(k) || seats[k].me) continue;
        for (const m of meshes[k]) { ctx.flip(m, true, 280); await ctx.wait(90); }
        await ctx.wait(200);
        S.tags.push(sdTag[k] = ctx.label(seats[k].spot(0, 2.0).setY(.95), `<div class="tag3 sky">${evals[k].cls ? evals[k].desc : evals[k].name}</div>`));
        await ctx.wait(260);
      }
      await ctx.wait(300);
    }
    // ---- award (main pot then side pots)
    if (S.pot) { ctx.remove(S.pot); S.pot = null; }
    S.potLbl.el.innerHTML = '';
    const potW = res.detail.map(d => d.winners);
    for (const d of res.detail) {
      for (const w of d.winners) {
        const p = betSpot(ctx, seats[w]), g = pile(ctx, Math.floor(d.amount / d.winners.length), POT.x, POT.z);
        fly(ctx, g, p.x, p.z, 560, false).then(() => ctx.wait(300)).then(() => { const f = fromSpot(ctx, seats[w]); return fly(ctx, g, f.x, f.z, 480, true); });
      }
      await ctx.wait(260);
    }
    const winners = [...new Set(potW.flat())];
    for (const w of winners) {
      const s = seats[w];
      const name = live.length > 1 ? (s.me || evals[w].cls ? evals[w].desc : evals[w].name) : 'Ăn hũ', html = `<div class="tag3 lemon"${s.me ? ' style="font-size:26px"' : ''}>👑 ${name}</div>`;
      if (sdTag[w] && live.length > 1) sdTag[w].el.innerHTML = html;
      else S.tags.push(ctx.label(s.me ? new T.Vector3(0, 3.0, 5.0) : s.spot(0, 2.0).setY(.95), html));
      if (!s.me) { anim(s, 'cheer'); s.say(live.length > 1 ? ctx.pick(['Ăn hết nha 😎', 'Bài đẹp quá 🤩', 'Hehe cảm ơn 💰']) : ctx.pick(['Úp hết rồi à? 😏', 'Ăn gà nhé 🐔']), 1800); }
    }
    for (const k of live) if (!winners.includes(k) && !seats[k].me) anim(seats[k], 'sad');
    await ctx.wait(700);
    seats.forEach((s, k) => { st.players[k].stack += res.pay[k]; if (!s.me) sync(k); });
    if (res.pay[0] > 0) ctx.win(res.pay[0], new T.Vector3(0, 1, 4));
    const myNet = res.pay[0] - st.players[0].total;
    if (myNet > 0) { ctx.ui.callout(live.length > 1 && myEval.cls >= 2 ? myEval.name.toUpperCase() + '!' : 'THẮNG!'); ctx.sfx('win', .5); if (myEval.cls === 3) ctx.ui.confetti(); }
    else if (myNet < 0) ctx.sfx('lose', .35);
    ctx.ui.status(myNet > 0 ? `Bạn ăn <b>${HC.fmt(res.pay[0])}</b> 🎉` : myNet < 0 ? `Mất <b>${HC.fmt(-myNet)}</b> ván này` : 'Hoà vốn');
    const rows = order.map(k => {
      const s = seats[k], p = st.players[k], shown = live.length > 1 && !p.folded;
      return { name: s.me && s.name === 'Bạn' ? 'Bạn' : s.name + (s.me ? ' (bạn)' : ''), avatar: s.avatar, me: s.me, amount: res.pay[k] - p.total,
        detail: `${p.folded ? 'Úp bài' : shown || s.me ? evals[k].desc : 'Không lật bài'} · đã bỏ ${HC.short(p.total)}${p.allIn ? ' · theo hết' : ''}`,
        tag: winners.includes(k) ? (shown ? evals[k].name : 'Thắng') : null };
    });
    const result = { log, hands: hands.map(h => h.slice()), order, stacks0, ante, coinsDelta: ctx.coins - coinsStart, chipsOk };
    if (!auto) await ctx.ui.results(myNet > 0 ? 'Bạn ăn hũ!' : winners.length ? seats[winners[0]].name + ' ăn hũ' : 'Kết thúc ván', rows, { again: 'Ván mới' });
    // ---- clear the table
    for (const ms of meshes) for (const m of ms) ctx.tween(m, { x: DECK.x, y: .3, z: DECK.z, rx: 0, arc: 1 }, 380, 'io').then(() => ctx.remove(m));
    betL.forEach(l => l && l.remove());
    await ctx.wait(450);
    return result;
  }
})();
