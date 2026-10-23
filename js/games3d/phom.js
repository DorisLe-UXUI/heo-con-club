/* Phỏm (Tá Lả) 3D — you + 3 bots: ăn bài, bốc, đánh 4 vòng, hạ phỏm, gửi bài. Rules + bots in js/games3d/rules/phom.js. */
(function () {
  'use strict';
  const STAKES = [1000, 5000, 10000, 50000, 100000];
  const MIN_UNITS = 12;
  const HAND = { z: 5.75, y: 1.95, tilt: .95, spread: .96 };
  const SC = { hand: .74, row: .9 };            // card scales: bots' hands, rows on the table
  const DECK = { x: 0, z: .15 };
  T3.register('phom', {
    title: 'Phỏm', sub: 'Tá Lả · ăn bài, hạ phỏm, gửi bài · ít điểm nhất thắng · Ù ăn 5',
    table: 'round', theme: 'lavender', tex: ['cards', 'chips'], scripts: ['js/games3d/rules/phom.js'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    cam: { pos: [0, 12.6, 15.4], look: [0, 0, -.6] },
    demo: { seed: 10, starter: 1 },     // ?demo=1 replays this deal: you hold an eaten K and can eat a J
    rules: `<p>4 người, mỗi người <b>9 lá</b>, người đi đầu <b>10 lá</b>. Bài còn lại làm <b>nọc</b> ở giữa bàn.</p>
      <ul><li><b>Phỏm</b> = 3-4 lá cùng số (sám/tứ), hoặc 3 lá trở lên <b>liên tiếp cùng chất</b> (A nhỏ nhất, K lớn nhất, không vòng K-A-2).</li>
      <li>Đến lượt: <b>ăn</b> lá người trước vừa đánh nếu nó tạo phỏm với bài của bạn, không thì <b>bốc</b> 1 lá ở nọc; sau đó <b>đánh</b> 1 lá. Người đi đầu chỉ đánh ở lượt đầu.</li>
      <li>Lá đã ăn được <b>đánh dấu vàng</b>, phải nằm trong phỏm, không được đánh đi; 2 lá ăn không được chung 1 phỏm.</li>
      <li>Bị ăn mất 1 lá trả <b>1 đơn vị</b> cho người ăn; bị ăn <b>chốt</b> (lá đánh ở vòng cuối) trả <b>4</b>.</li>
      <li>Mỗi người đánh đủ <b>4 vòng</b> thì tất cả <b>hạ phỏm</b> (máy gợi ý cách hạ ít điểm nhất, bạn có thể đổi), rồi <b>gửi bài</b>: gửi lá lẻ vào phỏm của người khác. Người móm không được gửi.</li>
      <li>Tính điểm bài lẻ còn lại: A = 1 … J = 11, Q = 12, K = 13. <b>Ít điểm nhất thắng</b>, bằng điểm thì ai hạ trước xếp trên. <b>Móm</b> (không có phỏm) xếp cuối.</li>
      <li>Nhất ăn <b>1 / 2 / 3</b> đơn vị của Nhì / Ba / Bét; người <b>móm</b> trả <b>4</b>.</li>
      <li><b>Ù</b>: vừa ăn hoặc bốc mà 9-10 lá đã thành phỏm thì thắng ngay, ăn <b>5</b> đơn vị mỗi nhà.</li></ul>
      <p>Mức cược là giá của 1 đơn vị. Người thắng ván trước đi đầu ván sau.</p>`,
    modes: [
      { id: 'co-gui', name: 'Có gửi bài', desc: 'Hạ phỏm xong được gửi lá lẻ vào phỏm của người khác để giảm điểm.', rules: 'sau khi hạ phỏm, người không móm được gửi lá lẻ vào phỏm của nhà khác (lá gửi không tính điểm).' },
      { id: 'khong-gui', name: 'Không gửi bài', desc: 'Hạ phỏm xong là tính điểm luôn, không ai được gửi bài — phải tự lo bài lẻ của mình.', rules: 'không có bước gửi bài: hạ phỏm xong tính ngay điểm các lá lẻ còn lại trên tay.' },
    ],
    async start(ctx) {
      const R = window.Rules['phom'];
      const ut = ctx.Q.has('uitest') ? uiDriver(ctx, +ctx.Q.get('uitest') || 2, ({ by, click, memo }) => {
        if (click(by('CHIA BÀI')) || click(by('ĂN')) || click(by('BỐC')) || click(by('GỬI BÀI'))) return;
        if (by('HẠ PHỎM')) { if (!memo.alt) { memo.alt = 1; if (click(by('ĐỔI CÁCH HẠ'))) return; } memo.alt = 0; click(by('HẠ PHỎM')); return; }
        if (by('ĐÁNH')) { if (click(by('ĐÁNH'))) { memo.h = 0; return; } if (!memo.h) { memo.h = 1; click(by('GỢI Ý')); } else { memo.h = 0; click(by('XẾP BÀI')); } }
      }, r => r.delta === R.Game.expectedUnits(r.res)[0] * r.stake && r.cardsOk) : null;
      for (;;) { const r = await game(ctx, null); if (ut) { r.summary = { kind: r.res.kind, units: r.res.units, delta: r.delta, eats: r.res.eats.length }; ut.done(r); } }
    },
    async selftest(ctx) {
      const R = window.Rules['phom'], out = { pass: 0, fail: 0, games: [] };
      for (let i = 0; i < 2; i++) {
        const r = await game(ctx, { auto: true });
        const exp = R.Game.expectedUnits(r.res)[0] * r.stake;
        const ok = r.delta === exp && r.res.units.reduce((a, b) => a + b, 0) === 0 && r.cardsOk;
        out[ok ? 'pass' : 'fail']++;
        out.games.push({ kind: r.res.kind, winner: r.res.winner, units: r.res.units, stake: r.stake, delta: r.delta, expected: exp, eats: r.res.eats.length, turns: r.turns, cardsOk: r.cardsOk, score: r.res.score || null });
      }
      return out;
    },
  });

  let S = null;
  const R = () => window.Rules['phom'];
  const say = (s, arr) => s && s.say && s.say(arr[Math.floor(Math.random() * arr.length)]);
  const RANKNAME = ['Nhất', 'Nhì', 'Ba', 'Bét'];

  // ---------------------------------------------------------------- table setup (once)
  async function setup(ctx) {
    const T = ctx.THREE;
    ctx.music('cards');
    const seats = await ctx.seats(4, { angles: [90, 0, 270, 180] });    // counter-clockwise: you → right → top → left
    fixSeats(ctx, seats);
    fitCamera(ctx, T3.modules.phom.cam);
    const glowTex = T3.canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.55, 'rgba(255,250,190,.55)'); g.addColorStop(1, 'rgba(255,250,190,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    const mkGlow = col => T3.canvasTex(160, 220, (x, w, h) => { x.shadowColor = col; x.shadowBlur = 30; x.fillStyle = col; T3.rr(x, 26, 26, w - 52, h - 52, 18); x.fill(); x.fill(); x.fill(); });
    const spot = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: .8 }));
    spot.rotation.x = -Math.PI / 2; spot.position.y = .012; spot.visible = false; ctx.add(spot);
    const pulse = new Set();
    ctx.onFrame((dt, t) => { if (spot.visible) spot.material.opacity = .55 + Math.sin(t * 4) * .25; for (const g of pulse) g.material.opacity = .65 + Math.sin(t * 6) * .35; });
    // the draw pile in the middle
    const deck = new T.Group(); deck.position.set(DECK.x, 0, DECK.z);
    for (let i = 0; i < 16; i++) { const c = ctx.card(null); c.rotation.z = Math.PI; c.position.y = .02 + i * .022; c.rotation.y = (Math.random() - .5) * .1; deck.add(c); }
    ctx.add(deck);
    ctx.pickable(deck, () => { if (S.onDeck) S.onDeck(); });
    const deckTag = ctx.label(() => new T.Vector3(DECK.x, .9, DECK.z - .2), '');
    const usedPos = new T.Vector3(-3.9, 0, -3.6);
    const info = ctx.ui.h('div', { class: 'glass', style: 'position:absolute;right:16px;top:132px;padding:10px 24px;font:400 26px "Grandstander Black";color:#5f3fc9;display:none;text-align:right;line-height:1.25' }, ctx.ui.root);
    S = { seats, spot, pulse, glow: { gold: mkGlow('#ffd84d'), pink: mkGlow('#ff8fc0'), mint: mkGlow('#5fe0b0') }, deck, deckTag, usedPos, info, nextStarter: 0, mesh: new Map(), hand: [[], [], [], []], disc: [[], [], [], []], eatRow: [[], [], [], []], tags: [], countTags: [], meldRows: null, restRows: null };
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
  function fitCamera(ctx, base) {
    let last = 0;
    ctx.onFrame(() => {
      const a = ctx.camera.aspect; if (Math.abs(a - last) < .005) return; last = a;
      const k = Math.min(1.35, Math.max(1, Math.pow(1.55 / a, .6))), P = base.pos, L = base.look;
      ctx.camera.position.set(L[0] + (P[0] - L[0]) * k, L[1] + (P[1] - L[1]) * k, L[2] + (P[2] - L[2]) * k); ctx.camera.lookAt(L[0], L[1], L[2]);
    });
  }

  // ---------------------------------------------------------------- card helpers
  function mk(ctx, id) { const m = ctx.card(R().key(id)); m.userData.id = id; S.mesh.set(id, m); return m; }
  function glow(ctx, card, kind) {
    const T = ctx.THREE;
    if (kind && !card.userData.glow) { const g = new T.Mesh(new T.PlaneGeometry(card.userData.W * 1.4, card.userData.H * 1.3), new T.MeshBasicMaterial({ transparent: true, depthWrite: false })); g.rotation.x = -Math.PI / 2; g.position.y = .001; card.add(g); card.userData.glow = g; }
    const g = card.userData.glow; if (!g) return;
    g.visible = !!kind; if (kind) { g.material.map = S.glow[kind]; g.material.needsUpdate = true; g.material.opacity = 1; }
    card.userData.glowKind = kind || null;
  }
  function pulseOn(card, on) { const g = card.userData.glow; if (!g) return; if (on) S.pulse.add(g); else { S.pulse.delete(g); g.material.opacity = 1; } }
  const dim = (card, k) => card.userData.front.material.color.setScalar(k);
  const dir = p => (p === 3 ? -1 : 1);
  /** Point on a row in front of seat p (inward = distance from the rim), item i of n, spacing sp. */
  function rowPt(p, i, n, inward, sp, extra = 0) {
    const along = ((i - (n - 1) / 2) * sp + extra) * dir(p);
    if (p === 0) return { x: along, z: 7 - inward };
    const v = S.seats[p].spot(along, inward); return { x: v.x, z: v.z };
  }
  function botHandSlot(p, i, n) { const s = S.seats[p], v = s.spot((i - (n - 1) / 2) * .3 * dir(p), 1.45); return { x: v.x, y: .03 + i * .006, z: v.z, ry: s.facing, rz: Math.PI, rx: 0, s: SC.hand }; }
  function layoutBot(ctx, p, ms = 240) { const h = S.hand[p]; return Promise.all(h.map((m, i) => ctx.tween(m, botHandSlot(p, i, h.length), ms, 'out'))); }
  function layoutDisc(ctx, p, ms = 240) { const d = S.disc[p]; return Promise.all(d.map((m, i) => { const q = rowPt(p, i, 4, p === 0 ? 5.0 : 4.0, .7); m.renderOrder = 10 + i; return ctx.tween(m, { x: q.x, y: .03 + i * .008, z: q.z, rx: 0, ry: 0, rz: 0, s: SC.row }, ms, 'out'); })); }
  function layoutEat(ctx, p, ms = 240) { if (!p) return; const e = S.eatRow[p]; return Promise.all(e.map((m, i) => { const q = rowPt(p, i, e.length, 2.6, .72); return ctx.tween(m, { x: q.x, y: .04 + i * .008, z: q.z, rx: 0, ry: 0, rz: 0, s: SC.hand }, ms, 'out'); })); }
  function layoutMe(ctx, ms = 240) {
    const h = S.hand[0], n = h.length, gaps = S.gapsAfter || new Set(), xs = [];
    let x = 0; for (let i = 0; i < n; i++) { xs.push(x); x += HAND.spread + (gaps.has(h[i].userData.id) ? .32 : 0); }
    const w = n ? xs[n - 1] : 0;
    return Promise.all(h.map((c, i) => {
      const t = i - (n - 1) / 2, up = c.userData.selected ? .45 : 0;
      c.renderOrder = 30 + i;
      return ctx.tween(c, { x: xs[i] - w / 2, y: HAND.y + up - Math.abs(t) * .02, z: HAND.z - up * .3 + i * .012, rx: HAND.tilt, ry: 0, rz: -t * .02, s: 1 }, ms, 'out');
    }));
  }
  /** Sort the hand: 'meld' (phỏm first, with gaps), 'rank', 'suit'. */
  function sortHand(g, mode = S.sortMode || 'meld') {
    const RR = R(), h = S.hand[0], ids = h.map(m => m.userData.id), by = new Map(h.map(m => [m.userData.id, m]));
    S.gapsAfter = new Set();
    let order;
    if (mode === 'meld') {
      const a = RR.solve(ids, g.locked[0].filter(id => ids.includes(id)), 'pts') || { melds: [], rest: ids };
      order = [];
      for (const m of a.melds) { order.push(...m); S.gapsAfter.add(m[m.length - 1]); }
      order.push(...[...a.rest].sort((x, y) => RR.rankOf(x) - RR.rankOf(y) || x - y));
    } else if (mode === 'suit') order = RR.bySuitRank(ids);
    else order = [...ids].sort((x, y) => RR.rankOf(x) - RR.rankOf(y) || x - y);
    S.hand[0] = order.map(id => by.get(id));
  }
  function setCount(g, p) { const t = S.countTags[p]; if (t) t.el.innerHTML = `<div class="tag3 sky" style="font-size:22px;padding:3px 13px">${g.hands[p].length} lá</div>`; }
  function setDeck(g) {
    const n = g.deck.length;
    S.deck.children.forEach((c, i) => { c.visible = i < Math.ceil(n * 16 / 15); });
    S.deckTag.el.innerHTML = n ? `<div class="tag3 lemon" style="font-size:22px;padding:3px 13px">Nọc ${n}</div>` : '';
  }
  function setInfo(g, stake) {
    const live = g && !g.over && g.phase !== 'lay' && g.turn >= 0;
    S.info.style.display = '';
    S.info.innerHTML = `Cược <span style="color:#a86d00">${HC.short(stake)}</span>${live ? `<br><small style="font-size:22px;color:#8a6a80">Vòng ${Math.min(4, g.discCount[g.turn] + 1)}/4</small>` : ''}`;
  }
  function setTurn(p) {
    S.seats.forEach((s, i) => s.turn(i === p));
    const sp = S.spot;
    if (p == null || p < 0) { sp.visible = false; return; }
    sp.visible = true;
    if (p === 0) { sp.position.set(0, .012, 4.7); sp.scale.set(9, 3.2, 1); sp.rotation.z = 0; }
    else { const v = S.seats[p].spot(0, 1.45); sp.position.set(v.x, .012, v.z); sp.scale.set(4.6, 2.4, 1); sp.rotation.z = (p === 2 ? 0 : Math.PI / 2); }
  }

  // ---------------------------------------------------------------- one game
  async function game(ctx, test) {
    if (!S) await setup(ctx);
    const T = ctx.THREE, RR = R(), auto = !!(test && test.auto), demo = ctx.Q.has('demo') && !auto, demoEnd = demo && ['end', 'lay'].includes(ctx.Q.get('demo'));
    cleanup(ctx);
    const stake = await chooseStake(ctx, auto || demo);
    S.stake = stake;
    const useDemo = demo && !S.demoDone; S.demoDone = true;
    const D = T3.modules.phom.demo;
    const g = new RR.Game({ starter: useDemo ? D.starter : S.nextStarter, seed: useDemo ? D.seed : undefined, send: !(ctx.mode && ctx.mode.id === 'khong-gui'), level: ctx.room ? ctx.aiLevel(1) : undefined });
    g.deal(); S.g = g;
    setInfo(g, stake);
    await dealAnim(ctx, g);
    let turns = 0;
    if (g.over) await apply(ctx, g, [{ type: 'u', p: g.result.winner, melds: g.result.uHand.melds }]);
    while (!g.over && g.phase !== 'lay') {
      const p = g.turn; setTurn(p); setInfo(g, stake);
      const human = p === 0 && !auto && !demoEnd && !(demo && g.discCount[0] < 2);   // demo: your first two turns play themselves
      if (g.phase === 'take') {
        if (human) await humanTake(ctx, g, demo && !demoEnd);
        else { await think(ctx, p); await apply(ctx, g, g.aiTake(p) === 'eat' ? g.eat(p) : g.draw(p)); }
      } else {
        if (human) await humanDiscard(ctx, g);
        else { await think(ctx, p, .7); await apply(ctx, g, g.discard(p, g.aiDiscard(p))); }
      }
      if (++turns > 200) throw new Error('Phỏm: too many turns');
    }
    setTurn(-1);
    if (!g.over) await endPhase(ctx, g, !auto && !demoEnd);
    return finish(ctx, g, stake, test, turns);
  }
  async function think(ctx, p, k = 1) { if (S.g && !S.g.over) ctx.ui.status(p ? `Lượt của <b>${S.seats[p].name}</b>${S.g.phase === 'take' ? '…' : ' · đánh bài'}` : 'Lượt của bạn (tự đánh)'); if (p) { if (Math.random() < .3) S.seats[p].anim('think'); await ctx.wait((420 + Math.random() * 380) * k); } else await ctx.wait(200); }

  function cleanup(ctx) {
    for (const m of S.mesh.values()) { if (m.userData.unpick) m.userData.unpick(); S.pulse.delete(m.userData.glow); ctx.remove(m); }
    S.mesh.clear(); S.hand = [[], [], [], []]; S.disc = [[], [], [], []]; S.eatRow = [[], [], [], []];
    S.tags.forEach(t => t.remove()); S.tags = [];
    S.countTags.forEach(t => t && t.remove()); S.countTags = [];
    S.deck.children.forEach(c => { c.visible = true; }); S.deckTag.el.innerHTML = '';
    S.onDeck = null; S.gapsAfter = null; S.sortMode = 'meld';
    ctx.ui.clearActions(); ctx.ui.status('');
  }
  function chooseStake(ctx, autoGo) {
    return new Promise(res => {
      ctx.ui.status('Chọn mức cược (giá <b>1 đơn vị</b>) rồi bấm <b>CHIA BÀI</b>');
      const saved = +HC.store.get('phom_stake', 5000), start = Math.max(0, STAKES.indexOf(saved));
      const chips = ctx.ui.chipPicker(STAKES, v => HC.store.set('phom_stake', v), start);
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
    ctx.ui.status('Đang chia bài…'); ctx.sfx('shuffle', .4);
    for (let p = 1; p < 4; p++) { const s = S.seats[p]; S.countTags[p] = ctx.label(() => s.spot(0, 1.45).setY(1.0), ''); }
    const order = [0, 1, 2, 3].map(i => (g.starter + i) % 4), from = S.deck.position;
    for (let k = 0; k < 10; k++) for (const p of order) {
      const id = g.hands[p][k]; if (id == null) continue;
      const m = mk(ctx, id); m.position.set(from.x, .45, from.z); m.rotation.set(0, 0, Math.PI); ctx.add(m);
      S.hand[p].push(m);
      if (p === 0) { addPick(ctx, g, m); m.rotation.z = 0; sortHand(g); layoutMe(ctx, 200); }
      else { ctx.tween(m, botHandSlot(p, S.hand[p].length - 1, g.hands[p].length), 220, 'out'); setCount(g, p); }
      ctx.sfx(Math.random() < .5 ? 'card' : 'card2', .25);
      await ctx.wait(34);
    }
    setDeck(g);
    await ctx.wait(240);
    for (let p = 1; p < 4; p++) layoutBot(ctx, p, 200);
    await layoutMe(ctx, 240);
  }
  function addPick(ctx, g, m) {
    m.userData.unpick = ctx.pickable(m, () => {
      if (!S.canSelect) return;
      if (g.locked[0].includes(m.userData.id)) { ctx.ui.toast('Lá đã ăn phải nằm trong phỏm, không đánh được', 'emoji-fluent-3d/reactions/face_with_monocle.png'); ctx.sfx('error', .3); return; }
      const on = !m.userData.selected;
      for (const c of S.hand[0]) { if (c.userData.selected) { c.userData.selected = false; glow(ctx, c, g.locked[0].includes(c.userData.id) ? 'gold' : null); } }
      if (on) { m.userData.selected = true; glow(ctx, m, 'pink'); }
      ctx.sfx('click', .3); layoutMe(ctx, 160);
      if (S.onSelect) S.onSelect();
    });
  }

  // ---------------------------------------------------------------- your turn
  function humanTake(ctx, g, frozen) {
    const RR = R();
    return new Promise(resolve => {
      ctx.sfx('turn', .3);
      const can = g.canEat(0), last = g.last, eatMesh = can ? S.mesh.get(last.card) : null;
      let busy = false;
      const done = async ev => {
        if (busy) return; busy = true; S.onDeck = null; if (eatTag) eatTag.remove();
        if (eatMesh) { pulseOn(eatMesh, false); glow(ctx, eatMesh, null); if (eatMesh.userData.unpick) { eatMesh.userData.unpick(); eatMesh.userData.unpick = null; } }
        ctx.ui.clearActions(); await apply(ctx, g, ev());
        if (eatMesh && last) layoutDisc(ctx, last.by, 200);    // drew instead: the lifted discard settles back
        resolve();
      };
      const a = ctx.ui.actions([
        { id: 'sort', label: 'XẾP BÀI', cls: 'lavender', onClick: () => cycleSort(ctx, g) },
        { id: 'eat', label: 'ĂN', cls: 'mint', icon: 'emoji-fluent-3d/reactions/face_savoring_food.png', onClick: () => { if (g.canEat(0)) done(() => g.eat(0)); } },
        { id: 'draw', label: 'BỐC', cls: 'pink', icon: 'emoji-fluent-3d/game/joker.png', onClick: () => done(() => g.draw(0)) },
      ]);
      a.set('eat', { disabled: !can });
      S.onDeck = () => done(() => g.draw(0));
      let eatTag = null;
      if (eatMesh) {
        glow(ctx, eatMesh, 'gold'); pulseOn(eatMesh, true); eatMesh.userData.unpick = ctx.pickable(eatMesh, () => done(() => g.eat(0)));
        ctx.tween(eatMesh, { y: .35, s: SC.row * 1.12 }, 220, 'back');
        eatTag = ctx.label(() => eatMesh.position.clone().setY(1.05), '<div class="tag3 mint" style="font-size:22px;padding:3px 14px">Ăn được!</div>');
      }
      const prevName = last ? (last.by ? S.seats[last.by].name : 'bạn') : '';
      ctx.ui.status(can ? `Lượt của bạn: <b>ĂN</b> lá <b>${RR.label(last.card)}</b> của ${prevName} hoặc <b>BỐC</b> nọc` : `Lượt của bạn: <b>BỐC</b> một lá ở nọc${last ? ` (lá ${RR.label(last.card)} không ăn được)` : ''}`);
      if (frozen) S.onDeck = null;   // demo screenshot: wait here
    });
  }
  function humanDiscard(ctx, g) {
    const RR = R();
    return new Promise(resolve => {
      let busy = false;
      const finalRound = g.discCount[0] === 3;
      const prompt = () => {
        const m = S.hand[0].find(c => c.userData.selected), id = m && m.userData.id;
        const ok = m && g.canDiscard(0, id);
        ctx.ui.status(m ? (ok ? `Đánh lá <b>${RR.label(id)}</b>?` : `Không đánh được ${RR.label(id)}: sẽ vỡ phỏm có lá đã ăn`) : `Chọn <b>1 lá</b> để đánh${finalRound ? ' · vòng cuối, đánh xong là hạ phỏm' : ''}`);
        a.set('play', { disabled: !ok });
      };
      const a = ctx.ui.actions([
        { id: 'sort', label: 'XẾP BÀI', cls: 'lavender', onClick: () => cycleSort(ctx, g) },
        { id: 'hint', label: 'GỢI Ý', cls: 'sky', icon: 'emoji-fluent-3d/game/light_bulb.png', onClick: () => { const id = g.aiDiscard(0); const m = S.mesh.get(id); if (m && !m.userData.selected) m.userData.unpick && pickToggle(ctx, g, m); } },
        { id: 'play', label: 'ĐÁNH', cls: 'pink', icon: 'emoji-fluent-3d/game/joker.png', onClick: async () => {
          const m = S.hand[0].find(c => c.userData.selected); if (busy || !m) return;
          if (!g.canDiscard(0, m.userData.id)) { ctx.ui.toast('Lá này đang giữ phỏm có lá đã ăn', 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); ctx.sfx('error', .4); return; }
          busy = true; S.canSelect = false; S.onSelect = null; ctx.ui.clearActions(); await apply(ctx, g, g.discard(0, m.userData.id)); resolve();
        } },
      ]);
      S.canSelect = true; S.onSelect = prompt; prompt();
    });
  }
  function pickToggle(ctx, g, m) {   // same as tapping the card
    for (const c of S.hand[0]) if (c.userData.selected) { c.userData.selected = false; glow(ctx, c, g.locked[0].includes(c.userData.id) ? 'gold' : null); }
    m.userData.selected = true; glow(ctx, m, 'pink'); layoutMe(ctx, 160); if (S.onSelect) S.onSelect();
  }
  function cycleSort(ctx, g) { const modes = ['meld', 'rank', 'suit']; S.sortMode = modes[(modes.indexOf(S.sortMode || 'meld') + 1) % 3]; sortHand(g); layoutMe(ctx, 220); ctx.ui.toast({ meld: 'Xếp theo phỏm', rank: 'Xếp theo số', suit: 'Xếp theo chất' }[S.sortMode], 'emoji-fluent-3d/game/spade_suit.png'); }

  // ---------------------------------------------------------------- events → animation
  async function apply(ctx, g, evs) {
    const RR = R(), T = ctx.THREE;
    for (const e of evs) {
      if (e.type === 'draw') {
        const m = mk(ctx, e.card); m.position.set(S.deck.position.x, .5, S.deck.position.z); m.rotation.set(0, 0, Math.PI); ctx.add(m);
        S.hand[e.p].push(m); setDeck(g); ctx.sfx('card2', .35);
        if (e.p === 0) { addPick(ctx, g, m); sortHand(g); m.rotation.z = 0; m.userData.selected = false; glow(ctx, m, 'mint'); await layoutMe(ctx, 300); ctx.wait(900).then(() => { if (!m.userData.selected && m.userData.glowKind === 'mint') glow(ctx, m, null); }); }
        else { await layoutBot(ctx, e.p, 260); setCount(g, e.p); }
      } else if (e.type === 'eat') {
        const m = S.mesh.get(e.card), from = S.seats[e.from], s = S.seats[e.p];
        S.disc[e.from] = S.disc[e.from].filter(x => x !== m);
        glow(ctx, m, 'gold'); dim(m, 1);
        ctx.sfx('power', .4);
        if (e.chot) ctx.ui.callout('ĂN CHỐT!', '#a86d00');
        if (e.p === 0) { S.hand[0].push(m); addPick(ctx, g, m); sortHand(g); await layoutMe(ctx, 340); ctx.ui.toast(`Bạn ăn ${RR.label(e.card)}${e.chot ? ' (chốt)' : ''} · +${e.units} đơn vị`, 'emoji-fluent-3d/reactions/face_savoring_food.png'); }
        else { S.eatRow[e.p].push(m); await layoutEat(ctx, e.p, 340); setCount(g, e.p); say(s, ['Ăn nè! 😋', 'Ngon quá 😆', 'Cảm ơn nha', 'Phỏm rồi!']); s.anim('cheer'); }
        ctx.ui.float('+' + HC.short(e.units * S.stake), (e.p ? s.spot(0, 2.6) : new T.Vector3(0, 2.2, 4.8)));
        if (e.from) { say(from, e.chot ? ['Ơ chốt của tui 😭', 'Trời ơi chốt!'] : ['Ơ ăn của tui 😤', 'Hớ rồi', 'Biết vậy giữ lại 😅']); from.anim('sad'); }
        await layoutDisc(ctx, e.from, 200);
      } else if (e.type === 'discard') {
        const m = S.mesh.get(e.card);
        S.hand[e.p] = S.hand[e.p].filter(x => x !== m);
        if (m.userData.unpick) { m.userData.unpick(); m.userData.unpick = null; }
        m.userData.selected = false; glow(ctx, m, null);
        // the previous discard of this player can no longer be eaten: dim it
        S.disc[e.p].forEach(c => dim(c, .78));
        S.disc[e.p].push(m); ctx.sfx('card', .4);
        await Promise.all([layoutDisc(ctx, e.p, 320), e.p ? layoutBot(ctx, e.p, 240) : layoutMe(ctx, 240)]);
        if (e.p) setCount(g, e.p);
        setInfo(g, S.stake);
        if (e.p && e.n === 4) say(S.seats[e.p], ['Chốt nè', 'Lá cuối!', 'Hạ thôi']);
      } else if (e.type === 'u') {
        const s = S.seats[e.p];
        ctx.ui.callout('Ù!', '#5f3fc9'); ctx.sfx('power', .5);
        if (e.p) { say(s, ['Ù rồi nha! 🎉', 'Ù! Ù! 😎']); s.anim('cheer'); }
        await layMelds(ctx, g, e.p, e.melds, R().solve(g.hands[e.p], g.locked[e.p], 'cnt').rest);
      }
    }
  }

  // ---------------------------------------------------------------- end: hạ phỏm + gửi bài
  async function endPhase(ctx, g, human) {
    const RR = R();
    ctx.ui.status('Hết 4 vòng · <b>hạ phỏm</b>!'); ctx.ui.callout('HẠ PHỎM!', '#5f3fc9');
    await ctx.wait(500);
    // discard piles leave the table
    const old = S.disc.flat(); S.disc = [[], [], [], []];
    ctx.sfx('slide', .35);
    await Promise.all(old.map((m, i) => ctx.tween(m, { x: S.usedPos.x, y: .1 + i * .01, z: S.usedPos.z, rz: Math.PI, ry: Math.random() * .4, s: .8, arc: .8 }, 320, 'io')));
    old.forEach(m => { S.mesh.delete(m.userData.id); ctx.remove(m); });
    let choice = null;
    if (human) choice = await askLay(ctx, g);
    const evs = g.layDown(choice ? { 0: choice } : {});
    S.meldRows = [[], [], [], []]; S.restRows = [[], [], [], []];
    for (const e of evs) if (e.type === 'ha') {
      await layMelds(ctx, g, e.p, e.melds, e.rest);
      const s = S.seats[e.p];
      if (e.mom) { if (e.p) { say(s, ['Móm rồi 😭', 'Không có phỏm nào…']); s.anim('sad'); } else ctx.ui.toast('Bạn bị móm 😭', 'emoji-fluent-3d/reactions/loudly_crying_face.png'); }
      await ctx.wait(260);
    }
    let skip = false;
    if (human && !g.mom[0]) {
      const opts = g.sendOptions(0);
      if (opts.length) skip = !(await askSend(ctx, g, opts));
    }
    const ev2 = g.finishLay({ skip: { 0: skip } });
    for (const e of ev2) if (e.type === 'gui') {
      const m = S.mesh.get(e.card), s = S.seats[e.p];
      S.restRows[e.p] = S.restRows[e.p].filter(x => x !== m);
      S.meldRows[e.to][e.meld].push(m);
      S.meldRows[e.to][e.meld].sort((a, b) => sortInMeld(a.userData.id, b.userData.id, S.meldRows[e.to][e.meld]));
      ctx.sfx('card', .4); glow(ctx, m, 'mint');
      if (e.p) say(s, ['Gửi nè!', 'Gửi 1 lá 😉']); else ctx.ui.toast(`Bạn gửi ${RR.label(e.card)} vào phỏm của ${S.seats[e.to].name}`, 'emoji-fluent-3d/hands/thumbs_up.png');
      await Promise.all([layoutRows(ctx, e.to, 340), layoutRows(ctx, e.p, 340)]);
    }
  }
  function sortInMeld(a, b, meld) { const RR = R(); const ids = meld.map(m => m.userData.id); return RR.meldKind(ids) === 'run' ? RR.rankOf(a) - RR.rankOf(b) : a - b; }
  /** Move all of p's cards (hand + eaten row) onto the table: phỏm row and leftover row. */
  async function layMelds(ctx, g, p, melds, rest) {
    if (!S.meldRows) { S.meldRows = [[], [], [], []]; S.restRows = [[], [], [], []]; }
    S.meldRows[p] = melds.map(m => m.map(id => S.mesh.get(id)));
    S.restRows[p] = rest.map(id => S.mesh.get(id));
    for (const m of [...S.hand[p], ...S.eatRow[p]]) { if (m.userData.unpick) { m.userData.unpick(); m.userData.unpick = null; } m.userData.selected = false; if (m.userData.glowKind !== 'gold') glow(ctx, m, null); pulseOn(m, false); }
    S.hand[p] = []; S.eatRow[p] = [];
    if (S.countTags[p]) S.countTags[p].el.innerHTML = '';
    ctx.sfx('fan', .4);
    await layoutRows(ctx, p, 380);
  }
  function layoutRows(ctx, p, ms) {
    const RR = R(), melds = S.meldRows[p], rest = S.restRows[p], sp = .46, gap = .4, jobs = [];
    const total = melds.reduce((s, m) => s + m.length, 0), width = Math.max(0, total - 1) * sp + Math.max(0, melds.length - 1) * gap;
    let k = 0, off = -width / 2;
    melds.forEach((m, mi) => m.forEach((c, i) => {
      const q = rowPt(p, 0, 1, p === 0 ? 3.75 : 3.85, 0, off + (k++) * sp + mi * gap);
      c.renderOrder = 60 + k; dim(c, 1);
      jobs.push(ctx.tween(c, { x: q.x, y: .03 + k * .006, z: q.z, rx: 0, ry: 0, rz: 0, s: .84, arc: .6 }, ms, 'out'));
    }));
    rest.forEach((c, i) => { const q = rowPt(p, i, rest.length, p === 0 ? 2.35 : 2.45, sp); c.renderOrder = 80 + i; dim(c, .8); jobs.push(ctx.tween(c, { x: q.x, y: .03 + i * .006, z: q.z, rx: 0, ry: 0, rz: 0, s: .74, arc: .6 }, ms, 'out')); });
    // score tag
    const pts = rest.reduce((s, c) => s + RR.pts(c.userData.id), 0), mom = !melds.length;
    if (S.scoreTags && S.scoreTags[p]) S.scoreTags[p].remove();
    S.scoreTags = S.scoreTags || [];
    const at = p === 0 ? new ctx.THREE.Vector3(3.9, .9, 4.1) : S.seats[p].spot(0, 1.3).setY(.9);
    S.scoreTags[p] = ctx.label(at, `<div class="tag3 ${mom ? 'grey' : 'sky'}" style="font-size:24px">${mom ? 'Móm · ' : ''}${pts} điểm</div>`);
    S.scoreTags[p].pts = pts; S.scoreTags[p].mom = mom;
    return Promise.all(jobs);
  }
  function askLay(ctx, g) {
    const RR = R(), sug = g.suggestions(0);
    if (!sug.length || !sug[0].melds.length) { ctx.ui.toast('Bạn không có phỏm nào (móm)', 'emoji-fluent-3d/reactions/loudly_crying_face.png'); return Promise.resolve(null); }
    return new Promise(res => {
      let i = 0;
      const show = () => {
        const a = sug[i], inMeld = new Set(a.melds.flat()), by = new Map(S.hand[0].map(m => [m.userData.id, m]));
        S.hand[0] = [...a.melds.flat(), ...a.rest].map(id => by.get(id));
        S.gapsAfter = new Set(a.melds.map(m => m[m.length - 1]));
        S.hand[0].forEach(m => { m.userData.selected = inMeld.has(m.userData.id); glow(ctx, m, g.locked[0].includes(m.userData.id) ? 'gold' : inMeld.has(m.userData.id) ? 'mint' : null); });
        layoutMe(ctx, 220);
        ctx.ui.status(`Cách hạ ${i + 1}/${sug.length}: <b>${a.melds.length} phỏm</b> (${a.melds.map(m => m.map(RR.label).join(' ')).join(' · ')}) · còn <b>${a.pts} điểm</b>`);
      };
      const bar = ctx.ui.actions([
        { id: 'alt', label: 'ĐỔI CÁCH HẠ', cls: 'sky', onClick: () => { i = (i + 1) % sug.length; show(); } },
        { id: 'ok', label: 'HẠ PHỎM', cls: 'pink', icon: 'emoji-fluent-3d/hands/thumbs_up.png', onClick: () => { ctx.ui.clearActions(); res(sug[i].melds); } },
      ]);
      bar.set('alt', { disabled: sug.length < 2 });
      show();
    });
  }
  function askSend(ctx, g, opts) {
    const RR = R();
    return new Promise(res => {
      ctx.ui.status(`Gửi được <b>${opts.length} lá</b>: ${opts.map(o => `${RR.label(o.card)} → ${S.seats[o.to].name}`).join(', ')}`);
      opts.forEach(o => { const m = S.mesh.get(o.card); if (m) { glow(ctx, m, 'mint'); pulseOn(m, true); } });
      const end = v => { opts.forEach(o => { const m = S.mesh.get(o.card); if (m) pulseOn(m, false); }); ctx.ui.clearActions(); res(v); };
      ctx.ui.actions([
        { id: 'no', label: 'KHÔNG GỬI', cls: 'grey', onClick: () => end(false) },
        { id: 'yes', label: 'GỬI BÀI', cls: 'mint', icon: 'emoji-fluent-3d/hands/thumbs_up.png', onClick: () => end(true) },
      ]);
    });
  }

  // ---------------------------------------------------------------- results
  async function finish(ctx, g, stake, test, turns) {
    const T = ctx.THREE, RR = R(), r = g.result, auto = !!(test && test.auto);
    ctx.ui.clearActions(); S.canSelect = false;
    // every card id still has exactly one mesh and the table shows the right hands
    const ids = [...S.mesh.keys()];
    const cardsOk = new Set(ids).size === ids.length && (r.kind === 'u' || [0, 1, 2, 3].every(p => [...S.meldRows[p].flat(), ...S.restRows[p]].map(m => m.userData.id).sort((a, b) => a - b).join() === [...r.laid[p].flat(), ...r.rest[p]].sort((a, b) => a - b).join()));
    if (r.kind === 'u') {
      // reveal the others' hands where they sit
      for (let p = 1; p < 4; p++) if (p !== r.winner) S.hand[p].forEach((m, i) => { const q = rowPt(p, i, S.hand[p].length, 1.6, .42); ctx.tween(m, { x: q.x, z: q.z, rz: 0, ry: 0, s: .7 }, 300, 'io'); });
    }
    await ctx.wait(400);
    const coins0 = ctx.coins, delta = r.units[0] * stake;
    const place = p => (r.kind === 'u' ? (p === r.winner ? 0 : -1) : r.ranking.indexOf(p));
    S.seats.forEach((s, p) => {
      const u = r.units[p], amt = u * stake;
      const html = `<div class="tag3 ${u > 0 ? 'mint' : u < 0 ? 'grey' : 'sky'}" style="font-size:24px">${place(p) >= 0 ? RANKNAME[place(p)] + ' · ' : ''}${S.scoreTags && S.scoreTags[p] ? (S.scoreTags[p].mom ? 'Móm · ' : '') + S.scoreTags[p].pts + ' điểm · ' : ''}${u > 0 ? '+' : u < 0 ? '−' : ''}${HC.short(Math.abs(amt))}</div>`;
      if (S.scoreTags && S.scoreTags[p]) S.scoreTags[p].el.innerHTML = html;
      else S.tags.push(ctx.label(p === 0 ? new T.Vector3(3.9, .9, 4.1) : s.spot(0, 1.3).setY(.9), html));
      if (p) { s.setCoins(s.coins + amt); if (p === r.winner) { s.anim('cheer'); say(s, ['Nhất nha! 🎉', 'Hehe thắng rồi 😎', 'Ván này dễ quá']); } else if (u < 0) s.anim('sad'); }
    });
    if (delta > 0) ctx.win(delta, new T.Vector3(0, 1.5, 4.5));
    else if (delta < 0) { const pay = Math.min(-delta, ctx.coins); if (pay > 0) ctx.spend(pay); }
    const meFirst = r.winner === 0;
    if (meFirst) { ctx.ui.callout(r.kind === 'u' ? 'Ù RỒI!' : 'VỀ NHẤT!'); ctx.ui.confetti(); ctx.sfx('win', .5); } else if (delta < 0) ctx.sfx('lose', .35);
    S.nextStarter = r.winner;
    const eatsOf = p => r.eats.filter(e => e.to === p).length, eatenOf = p => r.eats.filter(e => e.from === p);
    const rows = S.seats.map((s, p) => {
      const parts = [];
      if (r.kind === 'u') parts.push(p === r.winner ? 'Ù!' : 'Thua ù');
      else { parts.push(r.mom[p] ? 'Móm' : `${r.laid[p].length} phỏm`); parts.push(`${r.score[p]} điểm`); if (r.sent[p].length) parts.push(`gửi ${r.sent[p].length} lá`); }
      if (eatsOf(p)) parts.push(`ăn ${eatsOf(p)} lá`);
      const lost = eatenOf(p); if (lost.length) parts.push(`bị ăn ${lost.length}${lost.some(e => e.chot) ? ' (có chốt)' : ''}`);
      const u = r.units[p]; parts.push(u > 0 ? `+${u} đơn vị` : u < 0 ? `${u} đơn vị` : 'hoà');
      return { name: p ? s.name : (s.name === 'Bạn' ? 'Bạn' : s.name + ' (bạn)'), avatar: s.avatar, me: !p, amount: u * stake, tag: place(p) >= 0 ? (r.kind === 'u' ? 'Ù' : RANKNAME[place(p)]) : null, detail: parts.join(' · '), order: place(p) >= 0 ? place(p) : 9 };
    }).sort((a, b) => a.order - b.order || b.amount - a.amount);
    const result = { res: r, stake, delta: ctx.coins - coins0, turns, cardsOk };
    ctx.ui.status(`Ván kết thúc · ${delta >= 0 ? 'bạn ăn' : 'bạn mất'} <b>${HC.fmt(Math.abs(delta))}</b> xu`);
    if (ctx.Q.get('demo') === 'lay' && !auto) await new Promise(() => {});   // screenshot aid: stay on the laid-out table
    if (!auto) {
      await ctx.ui.results(r.kind === 'u' ? (meFirst ? 'Bạn Ù!' : S.seats[r.winner].name + ' Ù rồi!') : meFirst ? 'Bạn về nhất!' : `Bạn về ${RANKNAME[place(0)].toLowerCase()}`, rows, { again: 'Ván mới' });
    }
    // clear the table
    for (const m of S.mesh.values()) { if (m.userData.unpick) m.userData.unpick(); S.pulse.delete(m.userData.glow); ctx.tween(m, { x: S.usedPos.x, y: .3, z: S.usedPos.z, rz: Math.PI, arc: 1 }, 340, 'io').then(() => ctx.remove(m)); }
    S.mesh.clear(); S.hand = [[], [], [], []]; S.disc = [[], [], [], []]; S.eatRow = [[], [], [], []]; S.meldRows = null; S.restRows = null;
    (S.scoreTags || []).forEach(t => t && t.remove()); S.scoreTags = [];
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
