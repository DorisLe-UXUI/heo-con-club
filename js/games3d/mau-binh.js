/* Mậu Binh 3D — you + 3 bots, 13 cards each arranged into 3 chi, compared chi by chi. Rules + bots in js/games3d/rules/mau-binh.js. */
(function () {
  'use strict';
  const STAKES = [1000, 5000, 10000, 50000, 100000];
  const MIN_UNITS = 18;
  const TIME = 60;                                   // seconds to arrange
  const ROWZ = [4.6, 2.85, 1.1], SPX = 1.24;         // your three rows: chi 1 (near you), chi 2, chi 3 (far)
  const BOT = { sc: .72, sp: .78, inward: [1.15, 2.2, 3.25] };
  const CAM = { table: { pos: [0, 12.6, 15.4], look: [0, 0, -.6] }, arrange: { pos: [0, 12.3, 14.3], look: [0, 0, .1] } };
  T3.register('mau-binh', {
    title: 'Mậu Binh', sub: 'Binh xập xám · 13 lá xếp 3 chi · so từng chi · sập 3 chi ăn đôi',
    table: 'round', theme: 'peach', tex: ['cards', 'chips'], scripts: ['js/games3d/rules/mau-binh.js'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    cam: CAM.table,
    demoSeed: 7,
    rules: `<p>Mỗi người <b>13 lá</b>, xếp thành 3 chi: <b>chi 1</b> (5 lá, mạnh nhất, hàng gần bạn), <b>chi 2</b> (5 lá), <b>chi 3</b> (3 lá, hàng xa nhất). Có <b>60 giây</b> để xếp.</p>
      <ul><li>Thứ tự: <b>Thùng phá sảnh</b> &gt; <b>Tứ quý</b> &gt; <b>Cù lũ</b> &gt; <b>Thùng</b> &gt; <b>Sảnh</b> &gt; <b>Sám cô</b> &gt; <b>Thú</b> (2 đôi) &gt; <b>Đôi</b> &gt; <b>Mậu thầu</b>. Chi 3 chỉ tính sám cô, đôi, mậu thầu. Sảnh A-2-3-4-5 nhỏ nhất, 10-J-Q-K-A lớn nhất. Không so chất: bằng nhau là hoà.</li>
      <li>Phải xếp <b>chi 1 ≥ chi 2 ≥ chi 3</b>, sai là <b>binh lủng</b>: thua mỗi nhà 6 đơn vị.</li>
      <li>So với từng người: thắng chi nào ăn <b>1</b>, thua chi nào trả <b>1</b>. Thắng cả 3 chi là <b>sập 3 chi</b>: ăn gấp đôi (<b>6</b>).</li>
      <li><b>Mậu Binh</b> (tới trắng) thắng ngay: <b>Sảnh rồng</b> (13 lá khác số) ăn <b>12</b> mỗi nhà; <b>6 đôi</b>, <b>3 thùng</b>, <b>3 sảnh</b> ăn <b>6</b>. Hai nhà cùng Mậu Binh thì Sảnh rồng &gt; 6 đôi &gt; 3 thùng &gt; 3 sảnh, cùng loại hoà.</li></ul>
      <p>Chạm 1 lá rồi chạm lá khác để <b>đổi chỗ</b>. <b>XẾP TỰ ĐỘNG</b> tìm cách xếp tốt, <b>XONG</b> để chốt. Hết giờ mà còn lủng thì máy tự xếp giúp.</p>`,
    modes: [
      { id: 'thuong', name: 'Thường', desc: 'Thắng mỗi chi ăn 1, sập 3 chi ăn đôi.', rules: 'mỗi chi thắng ăn 1, thua trả 1; sập 3 chi ăn 6.' },
      { id: 'thuong-chi', name: 'Có thưởng chi', desc: 'Chi mạnh ăn nhiều hơn: chi cuối sám cô ăn 3, chi giữa cù lũ ăn 2, tứ quý chi đầu ăn 4…',
        rules: 'thắng chi bằng bài mạnh được thưởng: <b>chi 1</b> tứ quý ăn 4, thùng phá sảnh ăn 5; <b>chi 2</b> cù lũ ăn 2, tứ quý ăn 8, thùng phá sảnh ăn 10; <b>chi 3</b> sám cô ăn 3. Chi thắng bằng bài thường vẫn ăn 1. Sập 3 chi thì nhân đôi tổng. Mậu Binh và binh lủng tính như chế độ thường.' },
    ],
    async start(ctx) {
      const R = window.Rules['mau-binh'];
      const ut = ctx.Q.has('uitest') ? uiDriver(ctx, +ctx.Q.get('uitest') || 2, ({ by, click, memo, S }) => {
        if (click(by('CHIA BÀI'))) { memo.step = 0; return; }
        if (!by('XONG')) return;
        // swap two cards by tapping, swap chi 1/2, try to lock a lủng hand (needs a 2nd press), then auto-arrange and lock
        const st = memo.step = (memo.step || 0) + 1;
        if (st === 1 && S.mine.length === 13) { tapMine(ctx, S.mine[0]); tapMine(ctx, S.mine[12]); }
        else if (st === 2) click(by('ĐỔI CHI'));
        else if (st === 3) click(by('XONG'));
        else if (st === 4) click(by('XẾP TỰ ĐỘNG'));
        else if (st >= 6) click(by('XONG'));
      }, r => r.delta === R.settle(r.players, { bonus: r.bonus }).units[0] * r.stake && r.cardsOk && r.players.every(p => p.special || R.isValid(p.chi))) : null;
      for (;;) { const r = await game(ctx, null); if (ut) { r.summary = { units: r.units, delta: r.delta }; ut.done(r); } }
    },
    async selftest(ctx) {
      const R = window.Rules['mau-binh'], out = { pass: 0, fail: 0, games: [] };
      for (let i = 0; i < 2; i++) {
        const r = await game(ctx, { auto: true });
        const exp = R.settle(r.players, { bonus: r.bonus }).units[0] * r.stake;
        const ok = r.delta === exp && r.units.reduce((a, b) => a + b, 0) === 0 && r.cardsOk && r.players.every(p => p.special || R.isValid(p.chi));
        out[ok ? 'pass' : 'fail']++;
        out.games.push({ units: r.units, stake: r.stake, delta: r.delta, expected: exp, specials: r.players.map(p => (p.special ? p.special.kind : null)), chi: r.players.map(p => p.chi.map(c => R.evaluate(c).name).join('/')), cardsOk: r.cardsOk });
      }
      return out;
    },
  });

  let S = null;
  const R = () => window.Rules['mau-binh'];
  const say = (s, arr) => s && s.say && s.say(arr[Math.floor(Math.random() * arr.length)]);
  const rowOf = i => (i < 5 ? 0 : i < 10 ? 1 : 2), START = [0, 5, 10], LEN = [5, 5, 3];
  const CHI = ['Chi 1', 'Chi 2', 'Chi 3'];

  // ---------------------------------------------------------------- table setup (once)
  async function setup(ctx) {
    const T = ctx.THREE;
    ctx.music('cards');
    const seats = await ctx.seats(4, { angles: [90, 0, 270, 180] });
    fixSeats(ctx, seats);
    const mkGlow = col => T3.canvasTex(160, 220, (x, w, h) => { x.shadowColor = col; x.shadowBlur = 30; x.fillStyle = col; T3.rr(x, 26, 26, w - 52, h - 52, 18); x.fill(); x.fill(); x.fill(); });
    // 13 card slots in front of you
    const slotTex = T3.canvasTex(160, 220, (x, w, h) => { x.fillStyle = 'rgba(255,255,255,.28)'; T3.rr(x, 8, 8, w - 16, h - 16, 16); x.fill(); x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 6; x.setLineDash([14, 10]); T3.rr(x, 8, 8, w - 16, h - 16, 16); x.stroke(); });
    const slots = [];
    for (let i = 0; i < 13; i++) { const m = new T.Mesh(new T.PlaneGeometry(1.24, 1.76), new T.MeshBasicMaterial({ map: slotTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; const p = slotPos(i); m.position.set(p.x, .011, p.z); ctx.add(m); slots.push(m); }
    const timerEl = ctx.ui.h('div', { class: 'glass', style: 'position:absolute;right:16px;bottom:150px;display:none;align-items:center;gap:12px;padding:6px 26px 6px 10px;font:400 40px "Grandstander Black";color:#b8542a' }, ctx.ui.root);
    const info = ctx.ui.h('div', { class: 'glass', style: 'position:absolute;right:16px;top:132px;padding:10px 24px;font:400 26px "Grandstander Black";color:#b8542a;display:none' }, ctx.ui.root);
    const deckPos = new T.Vector3(0, 0, -1.2);
    let lastAspect = 0;
    ctx.onFrame(() => { const a = ctx.camera.aspect; if (Math.abs(a - lastAspect) < .005) return; const first = !lastAspect; lastAspect = a; if (!first && S && !S.camMoving) cam(ctx, S.camWhich || 'table', 0); });
    S = { ctx, seats, slots, glow: { pink: mkGlow('#ff8fc0'), gold: mkGlow('#ffd84d'), mint: mkGlow('#5fe0b0') }, timerEl, info, deckPos, mesh: new Map(), mine: [], bot: [null, [], [], []], tags: [], rowTags: [], bt: [] };
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
  /** Camera with a narrow-window pull-back (the framework only widens the fov a little). */
  function cam(ctx, which, ms = 700) {
    const base = CAM[which], a = ctx.camera.aspect, k = Math.min(1.35, Math.max(1, Math.pow(1.55 / a, .6))), P = base.pos, L = base.look;
    S.camWhich = which; S.camMoving = ms > 0;
    return ctx.camTo({ pos: [L[0] + (P[0] - L[0]) * k, L[1] + (P[1] - L[1]) * k, L[2] + (P[2] - L[2]) * k], look: L }, ms).then(() => { S.camMoving = false; });
  }
  function slotPos(i) { const r = rowOf(i), k = i - START[r], n = LEN[r]; return { x: (k - (n - 1) / 2) * SPX, z: ROWZ[r] }; }
  const dir = p => (p === 3 ? -1 : 1);
  function botPos(p, i) { const r = rowOf(i), k = i - START[r], n = LEN[r], v = S.seats[p].spot((k - (n - 1) / 2) * BOT.sp * dir(p), BOT.inward[r]); return { x: v.x, z: v.z }; }

  // ---------------------------------------------------------------- card helpers
  function mk(ctx, id) { const m = ctx.card(R().key(id)); m.userData.id = id; S.mesh.set(id, m); return m; }
  function glow(ctx, card, kind) {
    const T = ctx.THREE;
    if (kind && !card.userData.glow) { const g = new T.Mesh(new T.PlaneGeometry(card.userData.W * 1.4, card.userData.H * 1.3), new T.MeshBasicMaterial({ transparent: true, depthWrite: false })); g.rotation.x = -Math.PI / 2; g.position.y = .001; card.add(g); card.userData.glow = g; }
    const g = card.userData.glow; if (!g) return;
    g.visible = !!kind; if (kind) { g.material.map = S.glow[kind]; g.material.needsUpdate = true; }
  }
  function placeMine(ctx, i, ms = 260, arc = .5) { const m = S.mine[i], p = slotPos(i), sel = m.userData.selected; m.renderOrder = 20 + i; return ctx.tween(m, { x: p.x, y: sel ? .55 : .03, z: p.z - (sel ? .25 : 0), rx: sel ? .35 : 0, ry: 0, rz: 0, s: sel ? 1.08 : 1, arc }, ms, 'out'); }
  function placeBot(ctx, p, i, ms = 260, faceUp = false) { const m = S.bot[p][i], q = botPos(p, i); m.renderOrder = 10 + i; return ctx.tween(m, { x: q.x, y: .03 + (i % 5) * .004, z: q.z, rx: 0, ry: 0, rz: faceUp ? 0 : Math.PI, s: BOT.sc, arc: .4 }, ms, 'out'); }
  const myChi = () => [0, 1, 2].map(r => S.mine.slice(START[r], START[r] + LEN[r]).map(m => m.userData.id));
  const botChi = p => [0, 1, 2].map(r => S.bot[p].slice(START[r], START[r] + LEN[r]).map(m => m.userData.id));

  // ---------------------------------------------------------------- one game
  async function game(ctx, test) {
    if (!S) await setup(ctx);
    const T = ctx.THREE, RR = R(), auto = !!(test && test.auto), mode = ctx.Q.get('demo'), demo = ctx.Q.has('demo') && !auto, demoEnd = demo && ['end', 'lay'].includes(mode);
    cleanup(ctx);
    const stake = await chooseStake(ctx, auto || demo);
    S.info.style.display = ''; S.info.innerHTML = `Cược <span style="color:#a86d00">${HC.short(stake)}</span> / chi`;
    const useDemo = demo && !S.demoDone; S.demoDone = true;
    const rng = useDemo ? RR.mulberry32(T3.modules['mau-binh'].demoSeed) : Math.random;
    const hands = test && ctx.Q.get('force') ? forced(RR, ctx.Q.get('force')) : RR.deal(rng);
    hands[0] = [...hands[0]].reverse();    // your cards land high to low: chi 1 starts with the big ones
    await dealAnim(ctx, hands);
    // bots arrange (in the background, they take a few "seconds")
    const bots = [null, 1, 2, 3].map(p => (p ? RR.botArrange(hands[p], rng, ctx.room ? ctx.aiLevel(1) : undefined) : null));
    const botDone = [false, false, false, false];
    for (let p = 1; p < 4; p++) { setBotTag(p, '13 lá · đang xếp…', 'sky'); S.seats[p].turn(true); }
    S.seats[0].turn(true);
    const botTimers = [1, 2, 3].map(p => ctx.wait(1800 + Math.random() * 5200).then(async () => { await arrangeBot(ctx, p, bots[p]); botDone[p] = true; setBotTag(p, '13 lá · xong ✓', 'mint'); S.seats[p].turn(false); if (Math.random() < .5) say(S.seats[p], ['Xong rồi nha 😎', 'Bài đẹp quá', 'Nhanh lên bạn ơi ⏱', 'Hmm…']); }));
    // you arrange
    let mineSpecial = RR.special(hands[0]);
    if (auto || demoEnd) { const a = mineSpecial && mineSpecial.chi ? { chi: mineSpecial.chi } : RR.arrange(hands[0]); await applyArrangement(ctx, a.chi, 200); }
    else await humanArrange(ctx, hands[0], mineSpecial, demo);
    S.seats[0].turn(false);
    if (botDone.some((d, p) => p && !d)) ctx.ui.status('Chờ mọi người xếp xong…');
    await Promise.all(botTimers);
    S.timerEl.style.display = 'none';
    ctx.ui.clearActions();
    // ---- reveal & settle
    const players = [0, 1, 2, 3].map(p => {
      const chi = p ? botChi(p) : myChi();
      const sp = RR.special(hands[p]);
      return { chi, special: sp };
    });
    const res = RR.settle(players, { bonus: !!(ctx.mode && ctx.mode.id === 'thuong-chi') });
    await reveal(ctx, players, res);
    return finish(ctx, players, res, stake, test);
  }

  /** Selftest only (?selftest=1&force=special): you get Sảnh rồng and a bot 6 đôi. */
  function forced(RR, kind) {
    const deck = RR.shuffled(Math.random), take = r => { const k = deck.findIndex(id => RR.rankOf(id) === r); return deck.splice(k, 1)[0]; };
    if (kind === 'special') {
      const mine = Array.from({ length: 13 }, (_, r) => take(r));
      const six = [0, 0, 2, 2, 4, 4, 6, 6, 8, 8, 10, 10, 12].map(take);
      return [mine, six, deck.slice(0, 13), deck.slice(13, 26)].map(RR.sortIds);
    }
    return RR.deal(Math.random);
  }

  function cleanup(ctx) {
    for (const m of S.mesh.values()) { if (m.userData.unpick) m.userData.unpick(); ctx.remove(m); }
    S.mesh.clear(); S.mine = []; S.bot = [null, [], [], []];
    S.tags.forEach(t => t.remove()); S.tags = [];
    S.rowTags.forEach(t => t.remove()); S.rowTags = [];
    S.bt.forEach(t => t && t.remove()); S.bt = [];
    S.timerEl.style.display = 'none'; S.sel = null;
    ctx.ui.clearActions(); ctx.ui.status('');
    if (S.camWhich !== 'table') cam(ctx, 'table', 0);
  }
  function chooseStake(ctx, autoGo) {
    return new Promise(res => {
      ctx.ui.status('Chọn mức cược (giá <b>1 chi</b>) rồi bấm <b>CHIA BÀI</b>');
      const saved = +HC.store.get('maubinh_stake', 5000), start = Math.max(0, STAKES.indexOf(saved));
      const chips = ctx.ui.chipPicker(STAKES, v => HC.store.set('maubinh_stake', v), start);
      const go = () => {
        const v = autoGo ? STAKES[0] : chips.value;
        if (!autoGo && ctx.coins < v * MIN_UNITS) { ctx.ui.toast(`Cần ít nhất ${HC.fmt(v * MIN_UNITS)} xu cho mức này`, 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); ctx.sfx('error', .4); return; }
        chips.el.remove(); ctx.ui.clearActions(); res(v);
      };
      ctx.ui.actions([{ id: 'deal', label: 'CHIA BÀI', cls: 'pink', icon: 'emoji-fluent-3d/game/joker.png', onClick: go }]);
      if (autoGo) go();
    });
  }
  function setBotTag(p, text, cls) {
    const s = S.seats[p];
    const T = S.ctx.THREE, at = p === 2 ? new T.Vector3(0, 1.1, -6.45) : new T.Vector3(p === 1 ? 6.4 : -6.4, .9, 3.3);   // beside the rows, not over them
    if (!S.bt[p]) S.bt[p] = S.ctx.label(at, '');
    S.bt[p].el.innerHTML = text ? `<div class="tag3 ${cls}" style="font-size:22px;padding:3px 13px">${text}</div>` : '';
  }
  async function dealAnim(ctx, hands) {
    const T = ctx.THREE;
    ctx.ui.status('Đang chia bài…'); ctx.sfx('shuffle', .4);
    cam(ctx, 'table', 0);
    for (let k = 0; k < 13; k++) for (let p = 0; p < 4; p++) {
      const id = hands[p][k], m = mk(ctx, id);
      m.position.set(S.deckPos.x, .5, S.deckPos.z); m.rotation.set(0, 0, Math.PI); ctx.add(m);
      if (p === 0) { S.mine.push(m); m.rotation.z = 0; m.userData.unpick = ctx.pickable(m, () => tapMine(ctx, m)); placeMine(ctx, k, 220, .9); }
      else { S.bot[p].push(m); placeBot(ctx, p, k, 220); }
      ctx.sfx(Math.random() < .5 ? 'card' : 'card2', .22);
      await ctx.wait(26);
    }
    await ctx.wait(300);
  }
  async function arrangeBot(ctx, p, a) {
    const by = new Map(S.bot[p].map(m => [m.userData.id, m]));
    S.bot[p] = a.chi.flat().map(id => by.get(id));
    ctx.sfx('slide', .25);
    await Promise.all(S.bot[p].map((m, i) => placeBot(ctx, p, i, 300)));
  }

  // ---------------------------------------------------------------- your arrangement
  function tapMine(ctx, m) {
    if (!S.arranging) return;
    const i = S.mine.indexOf(m);
    if (S.sel == null) { S.sel = i; m.userData.selected = true; glow(ctx, m, 'pink'); placeMine(ctx, i, 160, 0); ctx.sfx('click', .3); }
    else if (S.sel === i) { m.userData.selected = false; glow(ctx, m, null); S.sel = null; placeMine(ctx, i, 160, 0); }
    else {
      const j = S.sel, a = S.mine[j];
      a.userData.selected = false; glow(ctx, a, null); S.sel = null;
      S.mine[j] = m; S.mine[i] = a;
      placeMine(ctx, i, 260, .9); placeMine(ctx, j, 260, .9); ctx.sfx('card', .35);
    }
    if (S.onChange) S.onChange();
  }
  async function applyArrangement(ctx, chi, ms = 320) {
    const by = new Map(S.mine.map(m => [m.userData.id, m]));
    S.mine = chi.flat().map(id => by.get(id));
    S.mine.forEach(m => { m.userData.selected = false; glow(ctx, m, null); }); S.sel = null;
    ctx.sfx('fan', .35);
    await Promise.all(S.mine.map((m, i) => placeMine(ctx, i, ms, .9)));
    if (S.onChange) S.onChange();
  }
  function rowTags(ctx) {
    const T = ctx.THREE;
    if (!S.rowTags.length) for (let r = 0; r < 3; r++) S.rowTags.push(ctx.label(new T.Vector3(-(LEN[r] - 1) / 2 * SPX - 1.05, .25, ROWZ[r] + .2), ''));
    const RR = R(), chi = myChi(), sc = chi.map(c => RR.evaluate(c)), bad = [sc[0].score < sc[1].score, sc[1].score < sc[2].score];
    S.rowTags.forEach((t, r) => {
      const wrong = (r === 0 && bad[0]) || (r === 1 && (bad[0] || bad[1])) || (r === 2 && bad[1]);
      t.el.innerHTML = `<div class="tag3 ${wrong ? 'grey' : r === 0 ? 'lemon' : r === 1 ? 'sky' : 'mint'}" style="font-size:23px;padding:4px 14px;transform:translateX(-50%)">${CHI[r]} · ${sc[r].name}</div>`;
    });
    return { ok: !bad[0] && !bad[1], sc };
  }
  function humanArrange(ctx, hand, special, demo) {
    const RR = R();
    return new Promise(resolve => {
      cam(ctx, 'arrange', 700);
      let left = TIME, over = false;
      const prompt = () => {
        const v = rowTags(ctx);
        if (special) ctx.ui.status(`Bạn có <b>Mậu Binh: ${special.label}</b>! Ăn trắng ${special.units} chi mỗi nhà · bấm <b>XONG</b>`);
        else ctx.ui.status(v.ok ? `Hợp lệ ✓ · ${v.sc.map(s => s.name).join(' ≥ ')} · chạm 2 lá để đổi chỗ` : `<b>Binh lủng!</b> Cần chi 1 ≥ chi 2 ≥ chi 3 · chạm 2 lá để đổi chỗ`);
        bar.set('done', { label: v.ok || special ? 'XONG' : 'XONG (lủng)' });
      };
      const finish = async (timeUp) => {
        if (over) return; over = true; S.arranging = false; S.onChange = null;
        if (S.sel != null) { const m = S.mine[S.sel]; m.userData.selected = false; glow(ctx, m, null); placeMine(ctx, S.sel, 160, 0); S.sel = null; }
        ctx.ui.clearActions();
        const v = rowTags(ctx);
        if (special && special.chi) await applyArrangement(ctx, special.chi);
        else if (!v.ok && timeUp) { ctx.ui.toast('Hết giờ: máy xếp giúp để khỏi lủng', 'emoji-fluent-3d/game/alarm_clock.png'); await applyArrangement(ctx, RR.arrange(hand).chi); }
        rowTags(ctx);
        resolve();
      };
      const bar = ctx.ui.actions([
        { id: 'swap', label: 'ĐỔI CHI 1⇄2', cls: 'lavender', onClick: () => { const c = myChi(); applyArrangement(ctx, [c[1], c[0], c[2]], 280); } },
        { id: 'auto', label: 'XẾP TỰ ĐỘNG', cls: 'sky', icon: 'emoji-fluent-3d/game/magic_wand.png', onClick: () => applyArrangement(ctx, special && special.chi ? special.chi : RR.arrange(hand).chi) },
        { id: 'done', label: 'XONG', cls: 'pink', icon: 'emoji-fluent-3d/hands/thumbs_up.png', onClick: () => {
          const v = rowTags(ctx);
          if (!v.ok && !special && !S.confirmLung) { S.confirmLung = true; ctx.ui.toast('Đang binh lủng! Bấm XONG lần nữa nếu vẫn muốn chốt', 'emoji-fluent-3d/reactions/face_screaming_in_fear.png'); ctx.sfx('error', .4); return; }
          finish(false);
        } },
      ]);
      S.confirmLung = false;
      S.arranging = true; S.onChange = () => { S.confirmLung = false; prompt(); };
      prompt();
      if (special) { ctx.ui.callout('MẬU BINH!', '#b8542a'); ctx.sfx('power', .5); }
      // timer
      const show = () => { S.timerEl.style.display = 'flex'; S.timerEl.innerHTML = `<img src="${HC.A('emoji-fluent-3d/game/stopwatch.png')}" style="width:52px"><span style="color:${left <= 10 ? '#e0405f' : '#b8542a'}">${left}s</span>`; };
      show();
      if (demo) {   // screenshot: auto-arranged, one card picked up, the clock paused
        left = 47; show();
        applyArrangement(ctx, RR.arrange(hand).chi, 200).then(() => { const m = S.mine[11]; tapMine(ctx, m); });
        return;
      }
      (async () => { while (!over && left > 0) { await ctx.wait(1000); if (over) return; left--; show(); if (left <= 10 && left > 0) ctx.sfx('tick', .35); } if (!over) finish(true); })();
    });
  }

  // ---------------------------------------------------------------- reveal
  async function reveal(ctx, players, res) {
    const T = ctx.THREE, RR = R();
    for (let p = 1; p < 4; p++) setBotTag(p, '', 'sky');
    S.rowTags.forEach(t => t.remove()); S.rowTags = [];
    S.board = [null, 1, 2, 3].map(p => (p ? { lines: [], total: '', tag: ctx.label(boardPos(p), '') } : null));
    S.board.forEach(b => b && S.tags.push(b.tag));
    S.mine.forEach(m => { if (m.userData.unpick) { m.userData.unpick(); m.userData.unpick = null; } });
    await cam(ctx, 'table', 800);
    ctx.ui.status('Lật bài so chi!'); ctx.ui.callout('SO CHI!', '#b8542a');
    // special hands first
    for (let p = 0; p < 4; p++) if (players[p].special) {
      const sp = players[p].special;
      if (p) { await Promise.all(S.bot[p].map((m, i) => placeBot(ctx, p, i, 300, true))); say(S.seats[p], ['Mậu Binh! ' + sp.label + ' 😎']); S.seats[p].anim('cheer'); }
      if (p) boardLine(p, `<b style="color:#a86d00">Mậu Binh: ${sp.label}</b>`);
      else S.tags.push(ctx.label(tagPos(0, 1).setY(1.3), `<div class="tag3 lemon">Mậu Binh: ${sp.label}</div>`));
      ctx.ui.callout(sp.label.toUpperCase() + '!', '#a86d00'); ctx.sfx('power', .5);
      await ctx.wait(900);
    }
    const valid = res.valid;
    for (let k = 0; k < 3; k++) {
      ctx.ui.status(`So <b>${CHI[k]}</b>`);
      ctx.sfx('fan', .35);
      await Promise.all([1, 2, 3].filter(p => !players[p].special).map(p => Promise.all(S.bot[p].slice(START[k], START[k] + LEN[k]).map((m, j) => placeBot(ctx, p, START[k] + j, 320, true)))));
      // name tags for this chi + net result of the chi
      for (let p = 0; p < 4; p++) {
        if (players[p].special) continue;
        const ev = RR.evaluate(players[p].chi[k]);
        let net = 0;
        const bonus = ctx.mode && ctx.mode.id === 'thuong-chi';   // chế độ có thưởng chi: a chi won with a strong hand is worth more
        if (valid[p]) for (let q = 0; q < 4; q++) if (q !== p && !players[q].special && valid[q]) { const o = RR.evaluate(players[q].chi[k]), d = Math.sign(ev.score - o.score); net += !bonus ? d : d > 0 ? RR.chiBonus(k, ev.cat) : d < 0 ? -RR.chiBonus(k, o.cat) : 0; }
        const sign = valid[p] ? ` <span style="color:${net > 0 ? '#1f9a70' : net < 0 ? '#d24a6a' : '#8a6a80'}">${net > 0 ? '+' : net < 0 ? '−' : '±'}${Math.abs(net)}</span>` : '';
        if (p) boardLine(p, `<b style="color:#b8542a">${CHI[k]}</b> ${ev.name}${sign}`);
        else S.tags.push(ctx.label(tagPos(0, k), `<div class="tag3 ${!valid[p] ? 'grey' : net > 0 ? 'mint' : net < 0 ? 'grey' : 'sky'}" style="font-size:21px;padding:3px 12px">${ev.name}${valid[p] ? ` ${net > 0 ? '+' : net < 0 ? '−' : '±'}${Math.abs(net)}` : ''}</div>`));
        if (p && valid[p] && net >= 2 && Math.random() < .5) say(S.seats[p], ['Chi này ngon 😋', 'Hehe', 'Ăn chi nha!']);
      }
      await ctx.wait(1100);
    }
    // lủng / sập callouts
    for (let p = 0; p < 4; p++) if (!valid[p]) { if (p) { say(S.seats[p], ['Ơ binh lủng 😱', 'Xếp nhầm rồi…']); S.seats[p].anim('sad'); boardLine(p, '<b style="color:#d24a6a">Binh lủng!</b>'); } else S.tags.push(ctx.label(tagPos(0, 1).setY(1.3), '<div class="tag3 grey">Binh lủng</div>')); }
    const saps = res.pairs.filter(d => d.why === 'sap');
    for (const d of saps) {
      const w = d.u > 0 ? d.i : d.j, l = d.u > 0 ? d.j : d.i;
      if (w === 0 || l === 0) { ctx.ui.callout(w === 0 ? 'SẬP 3 CHI!' : 'BỊ SẬP!', w === 0 ? '#1f9a70' : '#c2407a'); ctx.sfx(w === 0 ? 'power' : 'boom', .45); }
      if (w) { say(S.seats[w], [`Sập ${l ? S.seats[l].name : 'bạn'} rồi! 💥`, 'Sập 3 chi nha 😎']); S.seats[w].anim('cheer'); }
      if (l) S.seats[l].anim('sad');
      await ctx.wait(700);
    }
  }
  /** Per-bot scoreboard (one small panel per bot) instead of tags over the crowded rows. */
  function boardPos(p) {
    const T = S.ctx.THREE;
    if (p === 2) return new T.Vector3(3.4, .3, -3.6);
    return p === 3 ? new T.Vector3(-4.5, .4, -2.75) : new T.Vector3(5.3, .3, 4.9);
  }
  function boardLine(p, html, total) {
    const b = S.board && S.board[p]; if (!b) return;
    if (html) b.lines.push(html);
    if (total != null) b.total = total;
    b.tag.el.innerHTML = `<div style="background:rgba(255,255,255,.94);border:3px solid #fff;border-radius:18px;padding:6px 14px;box-shadow:0 5px 0 rgba(184,84,42,.3),0 8px 16px rgba(60,10,50,.18);font:800 21px 'Baloo 2';color:#6a3a50;line-height:1.3;min-width:160px">${b.lines.map(l => `<div>${l}</div>`).join('')}${b.total}</div>`;
  }
  function tagPos(p, k) {
    const T = S.ctx.THREE;
    if (p === 0) { const z = ROWZ[k]; return new T.Vector3(-(LEN[k] - 1) / 2 * SPX - 1.15, .3, z + .25); }
    const q = botPos(p, START[k] + Math.floor(LEN[k] / 2)); return new T.Vector3(q.x, .75, q.z - .55);
  }

  // ---------------------------------------------------------------- results
  async function finish(ctx, players, res, stake, test) {
    const T = ctx.THREE, RR = R(), auto = !!(test && test.auto), units = res.units;
    const coins0 = ctx.coins, delta = units[0] * stake;
    // what is on the table must be exactly what was settled
    const cardsOk = [0, 1, 2, 3].every(p => (p ? botChi(p) : myChi()).flat().join() === players[p].chi.flat().join()) && new Set([...S.mesh.keys()]).size === 52;
    S.seats.forEach((s, p) => {
      const u = units[p], amt = u * stake;
      const html = `<div class="tag3 ${u > 0 ? 'mint' : u < 0 ? 'grey' : 'sky'}" style="font-size:24px;margin-top:6px;text-align:center">${u > 0 ? '+' : u < 0 ? '−' : ''}${HC.short(Math.abs(amt))}</div>`;
      if (p && S.board && S.board[p]) boardLine(p, null, html);
      else S.tags.push(ctx.label(p === 0 ? new T.Vector3(0, .4, .25) : s.spot(0, .4).setY(1.8), html.replace('font-size:24px', 'font-size:34px')));
      if (p) { s.setCoins(s.coins + amt); if (u > 0) s.anim('cheer'); else if (u < 0) s.anim('sad'); }
    });
    if (delta > 0) ctx.win(delta, new T.Vector3(0, 1.5, 3.5));
    else if (delta < 0) { const pay = Math.min(-delta, ctx.coins); if (pay > 0) ctx.spend(pay); }
    if (units[0] > 0) { ctx.ui.callout('THẮNG!'); ctx.ui.confetti(); ctx.sfx('win', .5); } else if (units[0] < 0) ctx.sfx('lose', .35);
    const vs = (p, q) => { const d = res.pairs.find(x => (x.i === p && x.j === q) || (x.i === q && x.j === p)); return d ? (d.i === p ? d : { ...d, u: -d.u, chi: d.chi.map(c => -c) }) : null; };
    const rows = S.seats.map((s, p) => {
      const pl = players[p], parts = [];
      if (pl.special) parts.push(`Mậu Binh: ${pl.special.label}`);
      else if (!res.valid[p]) parts.push('Binh lủng');
      else parts.push(pl.chi.map(c => RR.evaluate(c).name).join(' / '));
      const saps = [0, 1, 2, 3].filter(q => q !== p && vs(p, q) && vs(p, q).why === 'sap' && vs(p, q).u > 0).map(q => (q ? S.seats[q].name : 'bạn'));
      if (saps.length) parts.push('sập ' + saps.join(', '));
      parts.push(`${units[p] > 0 ? '+' : ''}${units[p]} chi`);
      return { name: p ? s.name : (s.name === 'Bạn' ? 'Bạn' : s.name + ' (bạn)'), avatar: s.avatar, me: !p, amount: units[p] * stake, tag: pl.special ? 'Mậu Binh' : saps.length ? 'Sập 3 chi' : !res.valid[p] ? 'Lủng' : null, detail: parts.join(' · ') };
    }).sort((a, b) => b.amount - a.amount);
    const result = { players, units, stake, delta: ctx.coins - coins0, cardsOk, bonus: !!(ctx.mode && ctx.mode.id === 'thuong-chi') };
    ctx.ui.status(`Ván kết thúc · ${delta >= 0 ? 'bạn ăn' : 'bạn mất'} <b>${HC.fmt(Math.abs(delta))}</b> xu`);
    if (ctx.Q.get('demo') === 'lay' && !auto) await new Promise(() => {});   // screenshot aid
    if (!auto) {
      await ctx.ui.results(units[0] > 0 ? 'Bạn thắng!' : units[0] < 0 ? 'Thua ván này' : 'Hoà vốn', rows, { again: 'Ván mới' });
    }
    for (const m of S.mesh.values()) { if (m.userData.unpick) m.userData.unpick(); ctx.tween(m, { x: S.deckPos.x, y: .3, z: S.deckPos.z, rz: Math.PI, rx: 0, arc: 1 }, 340, 'io').then(() => ctx.remove(m)); }
    S.mesh.clear(); S.mine = []; S.bot = [null, [], [], []];
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
