/* Sâm Lốc 3D — you + 3 bots, 10 cards each, first out wins. Rules + bots in js/games3d/rules/sam-loc.js. */
(function () {
  'use strict';
  const STAKES = [1000, 5000, 10000, 50000, 100000];
  const MIN_UNITS = 20;                 // you need at least 20 units of coins to sit at a stake
  const HAND = { z: 5.7, y: 1.95, tilt: .95, spread: .98 };
  T3.register('sam-loc', {
    title: 'Sâm Lốc', sub: '10 lá · đánh hết bài trước là thắng · Báo Sâm ăn 20 · tứ quý chặt heo',
    table: 'round', theme: 'mint', tex: ['cards', 'chips'], scripts: ['js/games3d/rules/sam-loc.js'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    cam: { pos: [0, 12.6, 15.4], look: [0, 0, -.6] },
    demoSeed: 73,     // ?demo=1 replays this deal so the screenshot lands on an interesting moment
    rules: `<p>4 người, mỗi người <b>10 lá</b>. Bài xếp từ nhỏ đến lớn: 3 4 5 6 7 8 9 10 J Q K A <b>2</b>. <b>Chất không quan trọng.</b></p>
      <ul><li>Bộ được đánh: <b>rác</b> (1 lá), <b>đôi</b>, <b>sám</b> (3 lá), <b>tứ quý</b> (4 lá), <b>sảnh</b> từ 3 lá liên tiếp. Heo (2) không được nằm trong sảnh; A đứng cuối sảnh được (Q-K-A), không có sảnh A-2-3.</li>
      <li>Chặn bằng bộ <b>cùng loại, cùng số lá</b> nhưng lớn hơn. <b>Tứ quý chặt được 1 heo</b>.</li>
      <li>Đã <b>bỏ lượt</b> thì phải chờ vòng mới. Ai cũng bỏ thì người đánh sau cùng được đi tiếp.</li>
      <li><b>Báo Sâm</b> trước khi đánh: phải đi hết bài mà không ai chặn được. Thành công ăn <b>20 lá</b> mỗi nhà; bị chặn thì đền <b>20 lá</b> cho mỗi nhà.</li>
      <li>Hết ván: người về nhất ăn của mỗi nhà <b>1 lá</b> cho mỗi lá còn trên tay; <b>cóng</b> (chưa đánh lá nào) trả <b>15</b>; mỗi heo còn trên tay (<b>thối heo</b>) trả thêm <b>5</b>.</li>
      <li><b>Tới trắng</b> ngay khi chia: tứ quý heo, 5 đôi, 3 sám, sảnh rồng 10 lá. Ăn 20 lá mỗi nhà.</li></ul>
      <p>Mức cược là giá của 1 lá. Ván đầu ai giữ lá nhỏ nhất đi trước (chỉ lúc này mới xét chất, 3♠ nhỏ nhất), các ván sau người thắng đi trước.</p>`,
    async start(ctx) {
      const R = window.Rules['sam-loc'];
      const ut = ctx.Q.has('uitest') ? uiDriver(ctx, +ctx.Q.get('uitest') || 2, ({ by, click, memo }) => {
        if (click(by('CHIA BÀI')) || click(by('KHÔNG BÁO'))) return;
        if (by('ĐÁNH')) {
          if (!memo.sorted) { memo.sorted = 1; click(by('XẾP BÀI')); return; }
          if (click(by('ĐÁNH'))) { memo.hinted = 0; return; }
          if (!memo.hinted) { memo.hinted = 1; click(by('GỢI Ý')); return; }
          memo.hinted = 0; click(by('BỎ LƯỢT'));
        }
      }, r => r.delta === R.Game.expectedUnits(r.res)[0] * r.stake && r.cardsOk) : null;
      for (;;) { const r = await game(ctx, null); if (ut) { r.summary = { kind: r.res.kind, units: r.res.units, delta: r.delta }; ut.done(r); } }
    },
    async selftest(ctx) {
      const R = window.Rules['sam-loc'], out = { pass: 0, fail: 0, games: [] };
      for (let i = 0; i < 2; i++) {
        const r = await game(ctx, { auto: true });
        const exp = R.Game.expectedUnits(r.res)[0] * r.stake;
        const ok = r.delta === exp && r.res.units.reduce((a, b) => a + b, 0) === 0 && r.cardsOk;
        out[ok ? 'pass' : 'fail']++;
        out.games.push({ kind: r.res.kind, winner: r.res.winner, units: r.res.units, stake: r.stake, delta: r.delta, expected: exp, plays: r.plays, cardsOk: r.cardsOk });
      }
      return out;
    },
  });

  let S = null;
  const say = (s, arr) => s.say(arr[Math.floor(Math.random() * arr.length)]);

  // ---------------------------------------------------------------- table setup (once)
  async function setup(ctx) {
    const T = ctx.THREE;
    ctx.music('cards');
    const seats = await ctx.seats(4, { angles: [90, 0, 270, 180] });    // counter-clockwise: you → right → top → left
    fixSeats(ctx, seats);
    fitCamera(ctx, T3.modules['sam-loc'].cam);
    const glowTex = T3.canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.55, 'rgba(255,250,190,.55)'); g.addColorStop(1, 'rgba(255,250,190,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    const cardGlowTex = T3.canvasTex(160, 220, (x, w, h) => { x.shadowColor = '#ffe066'; x.shadowBlur = 26; x.fillStyle = '#ffd84d'; T3.rr(x, 24, 24, w - 48, h - 48, 18); x.fill(); x.fill(); });
    // turn spotlight under the active hand
    const spot = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: .8 }));
    spot.rotation.x = -Math.PI / 2; spot.position.y = .012; spot.visible = false; ctx.add(spot);
    ctx.onFrame((dt, t) => { if (spot.visible) spot.material.opacity = .55 + Math.sin(t * 4) * .25; });
    // undealt cards (right corner) and the used pile (left corner)
    const deckPos = new T.Vector3(3.7, 0, -3.5), usedPos = new T.Vector3(-3.7, 0, -3.5);
    const stackOf = (pos, n, key) => { const g = new T.Group(); g.position.copy(pos); for (let i = 0; i < n; i++) { const c = ctx.card(null, { back: key }); c.rotation.z = Math.PI; c.position.y = .02 + i * .022; c.rotation.y = (Math.random() - .5) * .12; g.add(c); } ctx.add(g); return g; };
    const deckStack = stackOf(deckPos, 10, 'c_back'); const usedStack = stackOf(usedPos, 6, 'c_back'); usedStack.visible = false;
    const stakeEl = ctx.ui.h('div', { class: 'glass', style: 'position:absolute;right:16px;top:132px;padding:10px 24px;font:400 26px "Grandstander Black";color:#1f9a70;display:none' }, ctx.ui.root);
    S = { seats, spot, cardGlowTex, deckPos, usedPos, deckStack, usedStack, stakeEl, nextStarter: null, hand: [[], [], [], []], tags: [], pile: [], countTags: [] };
  }

  /** Seat tags: the far seat's name tag and bubble would sit under the top HUD bar, so they go beside the character;
   *  on narrow windows the side seats' tags slide inwards so they stay on screen. */
  function fixSeats(ctx, seats) {
    const T = ctx.THREE;
    const narrow = () => Math.max(0, Math.min(2.8, (1.5 - ctx.camera.aspect) * 6));
    seats.forEach((s, p) => {
      if (!p) return;
      const mini = s.key && s.key.startsWith('mini');
      if (p === 2) {
        if (s.label) s.label.target = () => new T.Vector3(2.7, mini ? 1.2 : 1.5, -9.6);
        s._bub = ctx.label(() => new T.Vector3(-2.6, mini ? 1.9 : 2.2, -9.6), '', 'bub3');
      } else {
        const sx = Math.sign(Math.cos(s.angle));
        if (s.label) s.label.target = () => new T.Vector3(sx * (9.6 - narrow()), mini ? 2.6 : 3.1, 0);
        s._bub = ctx.label(() => new T.Vector3(sx * (9.6 - narrow()), mini ? 4 : 4.6, 0), '', 'bub3');
      }
    });
  }

  /** Narrow windows: pull the camera back so the side players stay on screen (the framework only widens the fov a little). */
  function fitCamera(ctx, base) {
    let last = 0;
    ctx.onFrame(() => {
      const a = ctx.camera.aspect; if (Math.abs(a - last) < .005) return; last = a;
      const k = Math.min(1.35, Math.max(1, Math.pow(1.55 / a, .6))), P = base.pos, L = base.look;
      ctx.camera.position.set(L[0] + (P[0] - L[0]) * k, L[1] + (P[1] - L[1]) * k, L[2] + (P[2] - L[2]) * k); ctx.camera.lookAt(L[0], L[1], L[2]);
    });
  }

  // ---------------------------------------------------------------- card helpers
  const R = () => window.Rules['sam-loc'];
  function mk(ctx, id) { const m = ctx.card(R().key(id)); m.userData.id = id; return m; }
  function glow(ctx, card, on) {
    if (on && !card.userData.glow) { const T = ctx.THREE, g = new T.Mesh(new T.PlaneGeometry(card.userData.W * 1.32, card.userData.H * 1.24), new T.MeshBasicMaterial({ map: S.cardGlowTex, transparent: true, depthWrite: false })); g.rotation.x = -Math.PI / 2; g.position.y = .001; card.add(g); card.userData.glow = g; }
    if (card.userData.glow) card.userData.glow.visible = !!on;
  }
  function dim(card, k) { card.userData.front.material.color.setScalar(k); }
  function botSlot(s, i, n) { const along = (i - (n - 1) / 2) * .34, v = s.spot(along, 1.75); return { x: v.x, y: .03 + i * .006, z: v.z, ry: s.facing, rz: Math.PI, rx: 0, s: .8 }; }
  async function layoutBot(ctx, p, ms = 260) { const s = S.seats[p], h = S.hand[p]; await Promise.all(h.map((m, i) => ctx.tween(m, botSlot(s, i, h.length), ms, 'out'))); }
  function layoutMe(ctx, ms = 260) { return ctx.layoutHand(S.hand[0], { ...HAND, ms }); }
  function setCount(p) { const t = S.countTags[p]; if (!t) return; const n = S.hand[p].length, passed = S.passed && S.passed[p]; t.el.innerHTML = `<div class="tag3 ${passed ? 'grey' : n <= 2 ? 'lemon' : 'sky'}" style="font-size:24px;padding:4px 14px">${passed ? 'Bỏ lượt · ' : ''}${n} lá</div>`; }
  function setTurn(p) {
    S.seats.forEach((s, i) => s.turn(i === p));
    const sp = S.spot;
    if (p == null || p < 0) { sp.visible = false; return; }
    sp.visible = true;
    if (p === 0) { sp.position.set(0, .012, 4.6); sp.scale.set(9, 3.2, 1); sp.rotation.z = 0; }
    else { const v = S.seats[p].spot(0, 1.75); sp.position.set(v.x, .012, v.z); sp.scale.set(5.2, 2.6, 1); sp.rotation.z = (p === 2 ? 0 : Math.PI / 2); }
  }
  function sortHand(mode) {
    const RR = R(), h = S.hand[0];
    if (mode === 'plan') {
      const groups = RR.plan(RR.counts(h.map(m => m.userData.id))).groups.slice().sort((a, b) => (b.n - a.n) || (a.rank - b.rank));
      const pool = h.slice(), out = [];
      for (const g of groups) for (const r of g.ranks) { const k = pool.findIndex(m => RR.rankOf(m.userData.id) === r); out.push(pool.splice(k, 1)[0]); }
      S.hand[0] = out.concat(pool);
    } else S.hand[0] = h.slice().sort((a, b) => a.userData.id - b.userData.id);
  }

  // ---------------------------------------------------------------- one game
  async function game(ctx, test) {
    if (!S) await setup(ctx);
    const T = ctx.THREE, RR = R(), auto = !!(test && test.auto), demo = ctx.Q.has('demo') && !auto, demoEnd = demo && ['end', 'lay'].includes(ctx.Q.get('demo'));
    cleanup(ctx);
    // ---- stake
    const stake = await chooseStake(ctx, auto || demo);
    S.stakeEl.style.display = ''; S.stakeEl.innerHTML = `Cược <span style="color:#a86d00">${HC.short(stake)}</span> / lá`;
    // ---- deal
    const g = new RR.Game({ starter: S.nextStarter, seed: demo && !S.demoDone ? T3.modules['sam-loc'].demoSeed : undefined });
    S.demoDone = true;
    g.deal(test && ctx.Q.get('force') ? forced(RR, ctx.Q.get('force')) : undefined);
    S.g = g; S.passed = [false, false, false, false];
    await dealAnim(ctx, g);
    let plays = 0, myTurns = 0;
    if (!g.over) {
      // ---- báo sâm
      while (g.phase === 'bao') {
        const p = g.baoTurn; let yes;
        setTurn(p);
        if (p === 0 && !auto && !demo) yes = await askSam(ctx, g);
        else { ctx.ui.status(p ? `<b>${S.seats[p].name}</b> đang xem bài…` : 'Xem bài…'); await ctx.wait(p === 0 ? 120 : 380); yes = p === 0 ? (auto && (ctx.Q.get('force') === 'fail' || g.aiBao(0))) : g.aiBao(p); }
        await apply(ctx, g.declare(p, yes));
      }
      // ---- play
      while (!g.over) {
        const p = g.turn; setTurn(p);
        if (p === 0 && !auto && !demoEnd && !(demo && myTurns < 2)) await humanTurn(ctx, g, demo && myTurns >= 2);
        else {
          ctx.ui.status(p ? `Lượt của <b>${S.seats[p].name}</b>…` : 'Lượt của bạn (tự đánh)');
          if (p) { S.seats[p].anim('think'); await ctx.wait(560 + Math.random() * 420); } else await ctx.wait(240);
          const m = g.aiMove(p);
          await apply(ctx, m.action === 'play' ? g.play(p, m.cards) : g.pass(p));
        }
        if (p === 0) myTurns++;
        plays++;
        if (plays > 400) throw new Error('Sâm Lốc: too many turns');
      }
    }
    setTurn(-1);
    return finish(ctx, g, stake, test, plays);
  }

  /** Selftest only (?selftest=1&force=…): deal a rare situation on purpose. */
  function forced(RR, kind) {
    const want = { instant: [12, 12, 12, 12, 0, 2, 4, 6, 8, 10], sam: [7, 8, 9, 10, 11, 12, 12, 12, 11, 11], fail: [0, 1, 2, 3, 4, 5, 6, 7, 8, 12] }[kind];
    if (!want) return undefined;
    const deck = RR.shuffled(Math.random), mine = [];
    for (const r of want) { const k = deck.findIndex(id => RR.rankOf(id) === r); mine.push(deck.splice(k, 1)[0]); }
    return [mine, deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30)];
  }

  function cleanup(ctx) {
    for (const h of S.hand) for (const m of h) { if (m.userData.unpick) m.userData.unpick(); ctx.remove(m); }
    S.hand = [[], [], [], []];
    for (const c of S.pile) for (const m of c.cards) ctx.remove(m);
    S.pile = [];
    S.tags.forEach(t => t.remove()); S.tags = [];
    S.countTags.forEach(t => t && t.remove()); S.countTags = [];
    if (S.comboTag) { S.comboTag.remove(); S.comboTag = null; }
    S.seats.forEach(s => { if (s.label) { const b = s.label.el.querySelector('i'); if (b) b.remove(); } });
    S.usedStack.visible = false; S.deckStack.children.forEach(c => { c.visible = true; });
    ctx.ui.clearActions(); ctx.ui.status('');
  }

  function chooseStake(ctx, autoGo) {
    return new Promise(res => {
      ctx.ui.status('Chọn mức cược (giá <b>1 lá</b>) rồi bấm <b>CHIA BÀI</b>');
      const saved = +HC.store.get('samloc_stake', 5000), start = Math.max(0, STAKES.indexOf(saved));
      const chips = ctx.ui.chipPicker(STAKES, v => HC.store.set('samloc_stake', v), start);
      const go = () => {
        const v = autoGo ? STAKES[0] : chips.value;
        if (!autoGo && ctx.coins < v * MIN_UNITS) { ctx.ui.toast(`Cần ít nhất ${HC.fmt(v * MIN_UNITS)} xu cho mức này`, 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); ctx.sfx('error', .4); return; }
        chips.el.remove(); ctx.ui.clearActions(); res(v);
      };
      ctx.ui.actions([{ id: 'deal', label: 'CHIA BÀI', cls: 'pink', icon: 'emoji-fluent-3d/game/joker.png', onClick: go }]);
      if (autoGo) go();
    });
  }

  async function dealAnim(ctx, g) {
    const T = ctx.THREE;
    ctx.ui.status('Đang chia bài…'); ctx.sfx('shuffle', .4);
    // count tags
    for (let p = 1; p < 4; p++) { const s = S.seats[p]; S.countTags[p] = ctx.label(() => s.spot(0, 1.75).setY(1.05), ''); }
    const from = S.deckPos;
    for (let k = 0; k < 10; k++) {
      for (let p = 0; p < 4; p++) {
        const id = g.hands[p][k], m = mk(ctx, id);
        m.position.set(from.x, .3, from.z); m.rotation.set(0, 0, Math.PI); ctx.add(m);
        S.hand[p].push(m);
        if (p === 0) {
          m.userData.unpick = ctx.pickable(m, () => toggle(ctx, m));
          sortHand('rank'); m.rotation.z = 0;
          layoutMe(ctx, 200);
        } else { ctx.tween(m, botSlot(S.seats[p], S.hand[p].length - 1, 10), 220, 'out'); setCount(p); }
        ctx.sfx(Math.random() < .5 ? 'card' : 'card2', .25);
        await ctx.wait(34);
      }
    }
    await ctx.wait(260);
    for (let p = 1; p < 4; p++) layoutBot(ctx, p, 200);
    S.deckStack.children.forEach((c, i) => { c.visible = i < 5; });
    await layoutMe(ctx, 240);
  }

  // ---------------------------------------------------------------- selection
  function toggle(ctx, m) {
    if (!S.canSelect) return;
    m.userData.selected = !m.userData.selected; glow(ctx, m, m.userData.selected);
    ctx.sfx('click', .3); layoutMe(ctx, 160);
    if (S.onSelect) S.onSelect();
  }
  function selected() { return S.hand[0].filter(m => m.userData.selected).map(m => m.userData.id); }
  function select(ctx, ids) { for (const m of S.hand[0]) { m.userData.selected = ids.includes(m.userData.id); glow(ctx, m, m.userData.selected); } layoutMe(ctx, 180); if (S.onSelect) S.onSelect(); }

  function askSam(ctx, g) {
    return new Promise(res => {
      const chance = Math.round(g.samChance(0, 60) * 100);
      ctx.ui.status(`Báo Sâm? Đi hết bài không ai chặn: ăn <b>20 lá</b> mỗi nhà, bị chặn đền 20 · khả năng ~<b>${chance}%</b>`);
      ctx.sfx('turn', .35);
      ctx.ui.actions([
        { id: 'no', label: 'KHÔNG BÁO', cls: 'grey', onClick: () => { ctx.ui.clearActions(); res(false); } },
        { id: 'yes', label: 'BÁO SÂM', cls: 'lemon', icon: 'emoji-fluent-3d/game/crown.png', onClick: () => { ctx.ui.clearActions(); res(true); } },
      ]);
    });
  }

  function humanTurn(ctx, g, frozen) {
    const RR = R();
    return new Promise(resolve => {
      const lead = !g.current;
      let busy = false;
      ctx.sfx('turn', .3);
      const target = g.current && g.current.combo;
      const prompt = () => {
        const sel = selected(), c = RR.analyze(sel);
        const chk = sel.length ? g.check(0, sel) : null;
        const head = lead ? (g.sam === 0 ? 'Bạn đang báo sâm — đánh tiếp' : 'Bạn đi trước — đánh bộ nào cũng được') : `Chặn <b>${RR.describe(target)}</b> của ${S.seats[g.current.by].name}`;
        ctx.ui.status(sel.length ? `${head} · chọn: <b>${c ? RR.describe(c) : 'không hợp lệ'}</b>${chk && !chk.ok && c ? ' (' + chk.reason.toLowerCase() + ')' : ''}` : `${head} · chạm vào lá để chọn`);
        a.set('play', { disabled: !(chk && chk.ok) });
      };
      const done = () => { S.canSelect = false; S.onSelect = null; ctx.ui.clearActions(); resolve(); };
      const a = ctx.ui.actions([
        { id: 'sort', label: 'XẾP BÀI', cls: 'lavender', onClick: () => { S.sortMode = S.sortMode === 'plan' ? 'rank' : 'plan'; sortHand(S.sortMode); layoutMe(ctx, 220); } },
        { id: 'hint', label: 'GỢI Ý', cls: 'sky', icon: 'emoji-fluent-3d/game/light_bulb.png', onClick: () => { const o = g.options(0); if (o.length) select(ctx, o[0].cards); else ctx.ui.toast('Không có bộ nào chặn được, bỏ lượt thôi', 'emoji-fluent-3d/reactions/thinking_face.png'); } },
        { id: 'pass', label: 'BỎ LƯỢT', cls: 'grey', onClick: async () => { if (busy || lead) return; busy = true; select(ctx, []); S.canSelect = false; ctx.ui.clearActions(); await apply(ctx, g.pass(0)); done(); } },
        { id: 'play', label: 'ĐÁNH', cls: 'pink', icon: 'emoji-fluent-3d/game/joker.png', onClick: async () => {
          if (busy) return; const sel = selected(), chk = g.check(0, sel);
          if (!chk.ok) { ctx.ui.toast(chk.reason, 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); ctx.sfx('error', .4); return; }
          busy = true; S.canSelect = false; ctx.ui.clearActions(); await apply(ctx, g.play(0, sel)); done();
        } },
      ]);
      a.set('pass', { disabled: lead });
      S.canSelect = true; S.onSelect = prompt;
      prompt();
      if (frozen) { const o = g.options(0); if (o.length) select(ctx, o[0].cards); }   // demo screenshot: a suggestion is lifted, waiting
    });
  }

  // ---------------------------------------------------------------- events → animation
  async function apply(ctx, evs) {
    const RR = R();
    for (const e of evs) {
      if (e.type === 'sam') {
        const s = S.seats[e.p];
        ctx.ui.callout('BÁO SÂM!', '#a86d00'); ctx.sfx('power', .5);
        if (e.p) { say(s, ['Báo sâm! 😎', 'Sâm nè, chặn đi!', 'Ván này tui sâm 💪']); s.anim('cheer'); s.label.el.insertAdjacentHTML('beforeend', '<i>Báo sâm</i>'); }
        else { ctx.ui.toast('Bạn đã báo sâm, đừng để ai chặn nhé!', 'emoji-fluent-3d/game/crown.png'); S.tags.push(ctx.label(new ctx.THREE.Vector3(0, 3.2, 5.2), '<div class="tag3 lemon">Báo sâm</div>')); }
      } else if (e.type === 'play') await animPlay(ctx, e);
      else if (e.type === 'pass') {
        S.passed[e.p] = true; setCount(e.p);
        if (e.p) say(S.seats[e.p], ['Bỏ lượt', 'Qua!', 'Không theo', 'Nhường đó 😌']);
        else ctx.ui.toast('Bạn bỏ lượt', 'emoji-fluent-3d/hands/waving_hand.png');
        ctx.sfx('pop', .3);
        await ctx.wait(160);
      } else if (e.type === 'round_end') await sweep(ctx, e.winner);
    }
  }
  async function animPlay(ctx, e) {
    const RR = R(), p = e.p, ids = e.combo.cards, s = S.seats[p];
    const meshes = S.hand[p].filter(m => ids.includes(m.userData.id));
    S.hand[p] = S.hand[p].filter(m => !ids.includes(m.userData.id));
    meshes.forEach(m => { if (m.userData.unpick) { m.userData.unpick(); m.userData.unpick = null; } m.userData.selected = false; glow(ctx, m, false); });
    // older combos slide back and fade
    S.pile.forEach((c, i) => c.cards.forEach(m => { ctx.tween(m, { z: m.position.z - .42 }, 220, 'out'); dim(m, .62); }));
    const n = meshes.length, gap = n > 6 ? .46 : .6, cx = (Math.random() - .5) * .5, cz = .55 + (Math.random() - .5) * .3, rot = (Math.random() - .5) * .22;
    const order = meshes.slice().sort((a, b) => RR.rankOf(a.userData.id) - RR.rankOf(b.userData.id) || a.userData.id - b.userData.id);
    ctx.sfx('card', .45);
    const lvl = S.pile.length;
    await Promise.all(order.map((m, i) => {
      m.renderOrder = 50 + lvl * 12 + i;
      const t = i - (n - 1) / 2;
      return ctx.tween(m, { x: cx + t * gap * Math.cos(rot), y: .03 + lvl * .014 + i * .003, z: cz - t * gap * Math.sin(rot), rx: 0, ry: rot, rz: 0, s: 1, arc: 1.1 }, 330, 'out');
    }));
    S.pile.push({ cards: order, by: p });
    if (S.comboTag) S.comboTag.remove();
    const label = RR.describe(e.combo), big = e.cut || e.combo.type === 'quad' || e.combo.rank === RR.HEO;
    S.comboTag = ctx.label(new ctx.THREE.Vector3(cx, .9, cz - .2), `<div class="tag3 ${big ? 'lemon' : ''}" style="font-size:24px">${label} · ${p ? s.name : 'Bạn'}</div>`);
    if (p) await layoutBot(ctx, p, 200); else layoutMe(ctx, 220);
    setCount(p);
    if (e.cut) {
      const v = S.seats[e.cut.victim];
      ctx.ui.callout('CHẶT HEO!', '#c2407a'); ctx.sfx('boom', .45);
      if (p) { say(s, ['Chặt nè! 💥', 'Heo ngon quá 🐷', 'Tứ quý đây!']); s.anim('cheer'); }
      if (e.cut.victim) { say(v, ['Ối heo của tui 😭', 'Trời ơi!', 'Cay quá 😤']); v.anim('sad'); }
    } else if (p && e.left === 1) say(s, ['Báo 1 lá! ☝️', 'Còn 1 lá nha 😏']);
    else if (p && e.beat != null && Math.random() < .25) say(s, ['Chặn nè!', 'Hehe 😆', 'Lớn hơn nha', 'Đỡ nổi không?']);
    if (S.g && S.g.sam >= 0 && p !== S.g.sam) { ctx.ui.callout('CHẶN SÂM!', '#1f9a70'); ctx.sfx('boom', .45); }
  }
  async function sweep(ctx, winner) {
    const all = S.pile.flatMap(c => c.cards); S.pile = [];
    if (S.comboTag) { S.comboTag.remove(); S.comboTag = null; }
    S.passed = [false, false, false, false]; for (let p = 1; p < 4; p++) setCount(p);
    await ctx.wait(260);
    ctx.sfx('slide', .35);
    await Promise.all(all.map((m, i) => ctx.tween(m, { x: S.usedPos.x + (Math.random() - .5) * .2, y: .2 + i * .01, z: S.usedPos.z, rz: Math.PI, ry: Math.random() * .3, arc: .8 }, 320, 'io')));
    all.forEach(m => ctx.remove(m));
    S.usedStack.visible = true;
    if (winner === 0) ctx.ui.toast('Bạn được đi tiếp', 'emoji-fluent-3d/hands/thumbs_up.png');
  }

  // ---------------------------------------------------------------- end of game
  async function finish(ctx, g, stake, test, plays) {
    const T = ctx.THREE, RR = R(), r = g.result, auto = !!(test && test.auto);
    ctx.ui.clearActions(); S.canSelect = false;
    // cards conserved on the table: hand meshes + pile + swept == the dealt ids
    const cardsOk = S.hand.every((h, p) => h.map(m => m.userData.id).sort((a, b) => a - b).join() === [...g.hands[p]].sort((a, b) => a - b).join());
    // reveal the bots' remaining cards (fanned, face up)
    for (let p = 1; p < 4; p++) {
      const s = S.seats[p], h = S.hand[p];
      h.forEach((m, i) => { const along = (i - (h.length - 1) / 2) * .42, v = s.spot(along, 1.9); ctx.tween(m, { x: v.x, z: v.z, y: .04 + i * .006, rz: 0, ry: s.facing, s: .85, arc: .4 }, 300, 'io'); });
    }
    if (r.kind === 'instant') {
      const w = S.seats[r.winner];
      ctx.ui.callout('TỚI TRẮNG!', '#a86d00');
      if (r.winner) { say(w, [r.info.label + '! 😎']); w.anim('cheer'); }
      // show the winner's hand face up
      if (r.winner) S.hand[r.winner].forEach((m, i) => { const v = w.spot((i - 4.5) * .5, 2.2); ctx.tween(m, { x: v.x, z: v.z, rz: 0, s: .9 }, 300, 'io'); });
    }
    await ctx.wait(500);
    S.countTags.forEach(t => t && (t.el.innerHTML = ''));
    const coins0 = ctx.coins, delta = r.units[0] * stake;
    S.seats.forEach((s, p) => {
      const u = r.units[p], amt = u * stake;
      const pos = p === 0 ? new T.Vector3(-5.9, 1.2, 4.6) : s.spot(0, 1.9).setY(.9);
      S.tags.push(ctx.label(pos, `<div class="tag3 ${u > 0 ? 'mint' : u < 0 ? 'grey' : 'sky'}">${u > 0 ? '+' : u < 0 ? '−' : ''}${HC.short(Math.abs(amt))}</div>`));
      if (p) { s.setCoins(s.coins + amt); if (u > 0) { s.anim('cheer'); say(s, ['Về nhất! 🎉', 'Hehe ăn hết 😎', 'Cảm ơn mọi người nha']); } else if (u < 0) s.anim('sad'); }
    });
    if (delta > 0) ctx.win(delta, new T.Vector3(0, 1.5, 4.5));
    else if (delta < 0) { const pay = Math.min(-delta, ctx.coins); if (pay > 0) ctx.spend(pay); }
    const meWin = r.units[0] > 0;
    if (meWin) { ctx.ui.callout(r.kind === 'sam' ? 'SÂM THÀNH CÔNG!' : r.kind === 'instant' ? 'TỚI TRẮNG!' : r.kind === 'sam_fail' ? 'CHẶN SÂM!' : 'VỀ NHẤT!'); ctx.ui.confetti(); ctx.sfx('win', .5); }
    else ctx.sfx('lose', .35);
    S.nextStarter = r.winner;
    const kindTxt = { normal: 'Về nhất', sam: 'Báo sâm thành công', sam_fail: 'Bị chặn sâm', instant: 'Tới trắng' }[r.kind];
    const unitsTxt = u => (u > 0 ? `ăn ${u} lá` : u < 0 ? `trả ${-u} lá` : 'hoà');
    const rows = S.seats.map((s, p) => {
      const left = g.hands[p].length, heo = g.hands[p].filter(id => RR.rankOf(id) === RR.HEO).length;
      let detail;
      if (r.kind === 'normal') detail = p === r.winner ? 'Về nhất' : [`còn ${left} lá`, r.played[p] === 0 ? 'cóng' : '', heo ? `thối ${heo} heo` : ''].filter(Boolean).join(' · ');
      else detail = r.notes[p].join(' · ') || (p === r.winner ? kindTxt : '');
      return { name: p ? s.name : (s.name === 'Bạn' ? 'Bạn' : s.name + ' (bạn)'), avatar: s.avatar, me: !p, amount: r.units[p] * stake,
        tag: p === r.winner ? (r.kind === 'sam_fail' ? 'Chặn sâm' : kindTxt) : (r.kind === 'sam_fail' && p === r.sam ? 'Đền sâm' : null),
        detail: (detail ? detail + ' · ' : '') + unitsTxt(r.units[p]) };
    }).sort((a, b) => b.amount - a.amount);
    const result = { res: r, stake, delta: ctx.coins - coins0, plays, cardsOk };
    ctx.ui.status(`Ván kết thúc · ${delta >= 0 ? 'bạn ăn' : 'bạn mất'} <b>${HC.fmt(Math.abs(delta))}</b> xu`);
    if (ctx.Q.get('demo') === 'lay' && !auto) await new Promise(() => {});   // screenshot aid: stay on the revealed table
    if (!auto) {
      const title = r.kind === 'sam' ? (r.winner === 0 ? 'Sâm thành công!' : S.seats[r.winner].name + ' báo sâm thành công') : r.kind === 'sam_fail' ? (r.sam === 0 ? 'Bị chặn sâm rồi' : 'Chặn sâm thành công') : meWin ? 'Bạn về nhất!' : 'Thua ván này';
      await ctx.ui.results(title, rows, { again: 'Ván mới' });
    }
    // clear the table
    const all = [...S.hand.flat(), ...S.pile.flatMap(c => c.cards)];
    all.forEach(m => { if (m.userData.unpick) m.userData.unpick(); ctx.tween(m, { x: S.usedPos.x, y: .3, z: S.usedPos.z, rz: Math.PI, arc: 1 }, 340, 'io').then(() => ctx.remove(m)); });
    S.hand = [[], [], [], []]; S.pile = [];
    await ctx.wait(380);
    return result;
  }

  // ---------------------------------------------------------------- ?uitest=N: click the real buttons through N games (human code paths)
  function uiDriver(ctx, n, policy, check) {
    const out = { games: 0, pass: 0, fail: 0, clicks: 0, list: [] };
    const btns = () => [...document.querySelectorAll('#gameui .gbar .gbtn')].map(el => ({ el, label: el.textContent.trim(), off: el.classList.contains('off') }));
    const click = b => { if (b && !b.off) { b.el.click(); out.clicks++; return true; } return false; };
    const memo = {};
    const iv = setInterval(() => {
      if (out.games >= n) return;
      const m = document.querySelector('#modal.on .mrow .gbtn'); if (m) { m.click(); return; }
      const list = btns(); if (!list.length) return;
      const by = l => list.find(b => b.label === l || b.label.startsWith(l));
      policy({ by, click, memo, S });
    }, 140);
    return { done(r) { out.games++; const ok = check(r); out[ok ? 'pass' : 'fail']++; out.list.push(r.summary || null); if (out.games >= n) { clearInterval(iv); document.body.dataset.uitest = JSON.stringify(out); } } };
  }
})();
