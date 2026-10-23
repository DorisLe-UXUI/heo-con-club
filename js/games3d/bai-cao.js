/* Bài Cào (Ba Cây) 3D — you + 4 bots. One bot is the dealer (nhà cái, the role rotates among the bots every hand);
 * everyone else bets against the dealer. You "nặn" (squeeze) your three face-down cards one by one.
 * Rules in js/games3d/rules/bai-cao.js. */
(function () {
  'use strict';
  const ANGLES = [90, 200, 247, 293, 340], SEAT_R = 7.9;
  const CAM = { pos: [0, 12, 17], look: [0, 0, -2.3] };
  const LEVELS = [1000, 5000, 10000, 50000, 100000, 500000];
  const MY = i => ({ x: (i - 1) * 1.62, y: 1.55, z: 5.1, rx: 1.0 });   // where your three cards stand
  const ME_BET = [-3.35, 3.45];

  T3.register('bai-cao', {
    title: 'Bài Cào', sub: 'Ba Cây · tính nút · Ba Tây 1 ăn 2',
    table: 'round', theme: 'peach', tex: ['cards', 'chips'], cam: CAM,
    scripts: ['js/games3d/rules/cards-common.js', 'js/games3d/rules/bai-cao.js'],
    models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    rules: `<p>Mỗi người 3 lá úp. Một bạn bot làm <b>nhà cái</b> (đổi lượt mỗi ván), những người còn lại đặt cược và so bài với nhà cái.</p>
      <ul><li><b>Tính nút</b>: cộng điểm 3 lá rồi lấy hàng đơn vị. A = 1, 2–9 đúng số, 10 J Q K = 10. Ví dụ 7 + 8 + K = 25 → <b>5 nút</b>. 0 nút gọi là <b>Bù</b>.</li>
      <li><b>Ba Tây</b>: cả 3 lá là J, Q, K (lá 10 không tính) — thắng mọi loại nút.</li>
      <li><b>Bằng nút</b> (hoặc cùng Ba Tây): so <b>lá to nhất</b> của mỗi bên. Lá to xét <b>chất trước</b>: ♦ rô &gt; ♥ cơ &gt; ♠ bích &gt; ♣ chuồn, cùng chất thì xét số: A &gt; K &gt; Q &gt; J &gt; 10 &gt; … &gt; 2. Vì không có hai lá giống nhau nên không bao giờ hoà.</li>
      <li><b>Trả thưởng</b>: thắng nhà cái <b>1 ăn 1</b>, thắng bằng <b>Ba Tây 1 ăn 2</b>. Thua thì mất tiền cược.</li>
      <li><b>Nặn bài</b>: chạm vào từng lá để hé từ từ, hoặc bấm <b>LẬT HẾT</b>.</li></ul>`,
    modes: [
      { id: 'bot-cai', name: 'Nhà cái bot', desc: 'Các bạn bot thay nhau làm cái, bạn luôn là nhà con.', rules: 'cái chỉ xoay vòng giữa 4 bạn bot, bạn luôn đặt cược.' },
      { id: 'xoay-cai', name: 'Xoay cái', minMul: 4, desc: 'Cái xoay vòng cả bàn, tới lượt bạn thì bạn làm cái: 4 nhà con đặt cược, bạn chung hoặc ăn với từng nhà.',
        rules: 'cái xoay vòng qua cả 5 người, có bạn. Khi bạn làm cái, 4 bot đặt cược (không vượt quá số xu bạn chung được), bạn nặn bài rồi so với từng nhà: thua nhà nào thì chung tiền (Ba Tây 1 ăn 2), thắng nhà nào thì ăn tiền cược của nhà đó.' },
    ],
    async start(ctx) { for (;;) await round(ctx, null); },
    async selftest(ctx) {
      const C = window.Rules['cards-common'], R = window.Rules['bai-cao'], checks = [];
      const run = async (label, rig, wantMult) => {
        const r = await round(ctx, { auto: true, bet: 10000, rig });
        const exp = R.settle(r.me, r.dealer), want = exp > 0 ? 10000 * exp : -10000;
        const okk = r.mult === exp && (wantMult == null || exp === wantMult) && r.coinsDelta === want && r.zeroSum && r.botsOk;
        checks.push({ label, me: r.me.map(C.name).join(' '), dealer: r.dealer.map(C.name).join(' '), mult: r.mult, coinsDelta: r.coinsDelta, want, ok: okk });
      };
      if (ctx.mode && ctx.mode.id === 'xoay-cai') {   // ?selftest=1&mode=xoay-cai: hands with you holding the bank
        for (const [label, rig, sign] of [['bạn làm cái, Ba Tây', { dealer: 'J♣ Q♦ K♥' }, 1], ['bạn làm cái, Bù', { dealer: '2♣ 3♦ 5♠' }, 0], ['bạn làm cái, ngẫu nhiên', null, 0]]) {
          const r = await round(ctx, { auto: true, dealer: 0, rig });
          checks.push({ label, coinsDelta: r.coinsDelta, want: r.dealerNet, ok: r.youBank && r.coinsDelta === r.dealerNet && (!sign || r.dealerNet > 0) && r.zeroSum && r.botsOk });
        }
      } else {
        await run('Ba Tây ăn 1:2', { me: 'J♣ Q♦ K♥', dealer: '4♦ 5♦ K♦' }, 2);
        await run('thua nhà cái', { me: '2♣ 3♣ 2♠', dealer: '4♠ 4♣ A♣' }, -1);
        await run('bằng nút, so chất', { me: '9♦ K♣ Q♣', dealer: '4♥ 5♥ K♠' }, 1);
        await run('ngẫu nhiên', null, null);
      }
      const fail = checks.filter(c => !c.ok).length;
      return { pass: fail ? 0 : 1, fail, checks };
    },
  });

  let S = null;
  /** Chip stack flight. Replaces ctx.moveStack(): T3 tween() with `arc` but no `y` adds the arc to position.y on every
   *  step without resetting it, so stacks (and anything else tweened that way) drift upward. Always pass y. */
  const fly = (ctx, g, x, z, ms = 500, vanish = false) => { ctx.sfx('chips', .35); return ctx.tween(g, { x, y: 0, z, arc: 1.4 }, ms, 'io').then(() => { if (vanish) ctx.remove(g); }); };
  function css() {
    if (document.getElementById('bc3-css')) return;
    const st = document.createElement('style'); st.id = 'bc3-css';
    st.textContent = `.bc-amt{padding:3px 14px;border-radius:16px;background:rgba(50,22,60,.72);color:#ffe27a;font:400 22px "Grandstander Black";box-shadow:0 4px 10px rgba(0,0,0,.18)}
      .bub3.bub-r{translate:50% 0}.bub3.bub-l{translate:-50% 0}`;
    document.head.appendChild(st);
  }

  /** Narrow windows: pull the camera back so the side seats stay on screen (the framework only widens the FOV a little). */
  function fitCam(ctx) {
    const apply = () => {
      const f = 1 + Math.max(0, 1.7 - innerWidth / innerHeight) * .42, L = CAM.look;
      const pos = CAM.pos.map((v, i) => L[i] + (v - L[i]) * f); pos[2] += (f - 1) * -12;
      ctx.camTo({ pos, look: L }, 0);
    };
    apply(); addEventListener('resize', apply);
  }
  /** Keep seat labels and speech bubbles clear of the HUD: side seats get their label nudged inward and bubbles that
   *  grow towards the table; far seats get bubbles that grow outward instead of up into the top bar. */
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

  async function setup(ctx) {
    const T = ctx.THREE;
    css();
    ctx.music('cards');
    const seats = await ctx.seats(5, { angles: ANGLES, r: SEAT_R });
    arrange(ctx, seats); fitCam(ctx);
    // the dealer's deck: a small pile of backs that moves to whoever holds the bank
    const deckG = new T.Group();
    for (let i = 0; i < 10; i++) { const c = ctx.card(null); c.rotation.z = Math.PI; c.position.y = .02 + i * .022; c.rotation.y = (Math.random() - .5) * .12; deckG.add(c); }
    ctx.add(deckG);
    const chips = ctx.ui.chipPicker(LEVELS, null, 2);
    S = { seats, chips, deckG, dealer: 1 + Math.floor(ctx.rand() * 4), tags: [], first: true };
  }

  /** The slow "nặn": lift the card towards you, peel it open from the side, pause, then turn it over. */
  async function squeeze(ctx, m, base) {
    m.userData.busy = true;
    ctx.sfx('slide', .4);
    await ctx.tween(m, { y: base.y + .45, z: base.z - .2, rx: base.rx - .3 }, 260, 'out');
    await ctx.tween(m, { rz: Math.PI * .5 }, 650, 'io');
    await ctx.tween(m, { rz: Math.PI * .36 }, 700, 'lin');
    await ctx.wait(260);
    ctx.sfx('card', .45);
    await ctx.tween(m, { rz: 0 }, 330, 'out');
    await ctx.tween(m, { y: base.y, z: base.z, rx: base.rx }, 280, 'back');
    m.userData.faceUp = true; m.userData.busy = false;
  }
  async function quickFlip(ctx, m, base) {
    m.userData.busy = true;
    await ctx.tween(m, { rz: 0, y: base.y, z: base.z, rx: base.rx, arc: .35 }, 320, 'io');
    m.userData.faceUp = true; m.userData.busy = false;
  }
  const tagHtml = (txt, cls, big) => `<div class="tag3 ${cls}"${big ? ' style="font-size:34px;padding:8px 26px"' : ''}>${txt}</div>`;

  async function round(ctx, test) {
    if (!S) await setup(ctx);
    const T = ctx.THREE, C = window.Rules['cards-common'], R = window.Rules['bai-cao'];
    const { seats, chips, deckG } = S, me = seats[0];
    const auto = !!(test && test.auto), demo = ctx.Q.has('demo') && !auto, full = demo && ctx.Q.getAll('demo').includes('2');   // demo=2: play the hand out
    S.tags.forEach(t => t.remove()); S.tags = [];
    // ---- the bank rotates among the bots (chế độ Xoay cái: among all five seats, you included)
    const xoay = ctx.mode && ctx.mode.id === 'xoay-cai';
    if (test && test.dealer != null) S.dealer = test.dealer;
    else if (!S.first) S.dealer = R.nextDealer(S.dealer, 5, xoay);
    S.first = false;
    const dealer = seats[S.dealer], bettors = seats.filter(s => s !== dealer), youBank = dealer.me;
    seats.forEach(s => { if (s.label) { const i = s.label.el.querySelector('i'); if (i) i.remove(); } });
    if (dealer.label) dealer.label.el.insertAdjacentHTML('beforeend', '<i>Nhà cái</i>');
    { const n = document.getElementById('meNote'); if (n) n.textContent = youBank ? 'Nhà cái' : 'Bạn'; }
    const deckPos = youBank ? new T.Vector3(3.4, 0, 2.6) : dealer.spot(-1.0, 3.2);
    const deckMove = ctx.tween(deckG, { x: deckPos.x, y: 0, z: deckPos.z, ry: youBank ? 0 : dealer.facing, arc: .8 }, 450, 'io');
    if (youBank) ctx.ui.callout('BẠN LÀM CÁI!', '#a86d00');
    else dealer.say(ctx.pick(['Tới lượt tui làm cái 😎', 'Đặt cược đi mấy bạn!', 'Nhà cái sẵn sàng 🃏']), 1800);
    for (const s of seats) if (!s.me && ctx.topUp(s, 60000, 1500000)) s.say('Nạp thêm xu nè 😅', 1500);
    // ---- bets
    const coinsStart = ctx.coins;
    let bet = 0;
    if (!youBank) await new Promise(res => {
      ctx.ui.status(`Nhà cái: <b>${dealer.name}</b> · chọn mức cược bên trái rồi bấm <b>ĐẶT CƯỢC</b>`);
      chips.el.style.display = '';
      const a = ctx.ui.actions([{ id: 'bet', label: 'ĐẶT CƯỢC', cls: 'pink', icon: 'emoji-fluent-3d/game/money_bag.png', onClick: () => { const v = (test && test.bet) || chips.value; if (ctx.spend(v)) { bet = v; res(); } } }]);
      if (auto || demo) a.btn('bet').click();
    });
    else { chips.el.style.display = 'none'; ctx.ui.status('Bạn làm <b>nhà cái</b> · các nhà con đang đặt cược…'); await ctx.wait(500); }
    ctx.ui.clearActions();
    const bets = new Map(youBank ? [] : [[me, bet]]), stacks = new Map(), amtLbl = [];
    const betSpot = s => (s.me ? new T.Vector3(ME_BET[0], 0, ME_BET[1]) : s.spot(0, 3.35));
    const levels = ctx.room ? ctx.room.stakes : [5000, 10000, 20000, 50000, 100000];
    const botBet = s => (ctx.room ? ctx.botStake(levels) : R.botBet(s.coins, ctx.rand));
    if (youBank) { const want = bettors.map(botBet), capped = R.capBets(want, ctx.coins, levels); bettors.forEach((s, i) => bets.set(s, capped[i])); }
    for (const s of bettors) {
      if (!s.me && !youBank) bets.set(s, botBet(s));
      if (!bets.get(s)) continue;
      const p = betSpot(s), g = ctx.stack(bets.get(s), p.x, p.z), from = s.me ? new T.Vector3(0, 0, 8) : s.pos;
      g.position.set(from.x, 1.6, from.z); ctx.tween(g, { x: p.x, y: 0, z: p.z, arc: .8 }, 380, 'out'); ctx.sfx('chips', .3);
      stacks.set(s, g);
      amtLbl.push(ctx.label(p.clone().setY(1.0), `<div class="bc-amt">${HC.short(bets.get(s))}</div>`));
      if (!s.me && ctx.rand() < .3) s.say(ctx.pick(['Cược ' + HC.short(bets.get(s)) + ' nha!', 'Ván này ăn chắc 😏', 'Nhà cái run chưa? 😆']), 1500);
      await ctx.wait(150);
    }
    // ---- deal three cards each, starting left of the dealer
    const deck = ctx.deck(), want = new Map();
    if (test && test.rig) {
      const take = str => C.parse(str).map(c => { const k = deck.findIndex(d => d.key === c.key); return deck.splice(k, 1)[0]; });
      if (test.rig.me) want.set(me, take(test.rig.me));
      if (test.rig.dealer) want.set(dealer, take(test.rig.dealer));
    }
    const hands = new Map(), meshes = new Map();
    seats.forEach(s => { hands.set(s, []); meshes.set(s, []); });
    await deckMove;   // T3 tween() drops an overlapping tween on the same object without resolving it
    ctx.sfx('shuffle', .45);
    for (let i = 0; i < 4; i++) await ctx.tween(deckG, { ry: dealer.facing + (i % 2 ? -.18 : .18), y: .12 }, 70, 'io');
    await ctx.tween(deckG, { ry: dealer.facing, y: 0 }, 90, 'out');
    const order = [1, 2, 3, 4, 5].map(k => seats[(S.dealer + k) % 5]).filter(s => s === dealer || bets.get(s));    // dealer last
    const give = (s, k) => {
      const c = want.has(s) ? want.get(s)[k] : deck.pop(), m = ctx.card(c.key, s.me ? { w: 1.32 } : {});
      m.position.set(deckPos.x, .3, deckPos.z); m.rotation.set(0, s.me ? 0 : dealer.facing, Math.PI); ctx.add(m);
      hands.get(s).push(c); meshes.get(s).push(m); m.userData.faceUp = false;
      if (s.me) { const p = MY(k); ctx.sfx('card', .3); return ctx.tween(m, { x: p.x, y: p.y, z: p.z, rx: p.rx, ry: 0, rz: Math.PI, arc: .9 }, 360, 'out'); }
      const p = s.spot((k - 1) * .82, 2.0);
      return ctx.deal(m, { x: p.x, z: p.z, ry: s.facing, y: .02 + k * .006 }, 320, false);
    };
    const flights = [];
    for (let k = 0; k < 3; k++) for (const s of order) { flights.push(give(s, k)); await ctx.wait(105); }
    await Promise.all(flights);
    // ---- your turn: nặn bài
    const mine = meshes.get(me), myHand = hands.get(me);
    me.turn(true);
    const showMine = () => {
      const up = mine.map((m, i) => (m.userData.faceUp ? myHand[i] : null)).filter(Boolean);
      if (up.length === 3) { const sc = R.score(myHand); ctx.ui.status(`Bài của bạn: <b>${sc.name}</b> · lá to ${C.name(sc.top)} · cược ${HC.fmt(bet)}`); }
      else ctx.ui.status(up.length ? `Đã thấy <b>${up.map(C.name).join(' ')}</b> · chạm lá còn lại để nặn tiếp` : 'Chạm từng lá để <b>nặn bài</b> 👀 hoặc bấm <b>LẬT HẾT</b>');
    };
    showMine();
    await new Promise(res => {
      const offs = []; let finished = false;
      const check = () => { showMine(); if (!finished && mine.every(m => m.userData.faceUp)) { finished = true; offs.forEach(f => f()); res(); } };
      const peel = async (m, fast) => { if (m.userData.busy || m.userData.faceUp) return; const base = MY(mine.indexOf(m)); await (fast ? quickFlip(ctx, m, base) : squeeze(ctx, m, base)); check(); };
      mine.forEach((m, i) => offs.push(ctx.pickable(m, () => peel(m, false), on => { if (!m.userData.busy && !m.userData.faceUp) ctx.tween(m, { y: MY(i).y + (on ? .2 : 0) }, 140, 'out'); })));
      const a = ctx.ui.actions([{ id: 'all', label: 'LẬT HẾT', cls: 'mint', icon: 'emoji-fluent-3d/hands/raising_hands.png', onClick: async () => { a.set('all', { disabled: true }); for (const m of mine) { peel(m, true); await ctx.wait(120); } } }]);
      if (auto || full) a.btn('all').click();
      else if (demo) { peel(mine[0], false).then(() => { const b = bettors.find(s => !s.me); if (b) b.say('Nặn từ từ thôi, hồi hộp quá 😆', 1e9); }); }
      else { const b = ctx.pick(bettors.filter(s => !s.me)); setTimeout(() => b.say(ctx.pick(youBank ? ['Nhà cái nặn lẹ đi! 😆', 'Cái ơi run chưa? 🙈', 'Bù đi, bù đi 🙏'] : ['Nặn đi, nặn đi! 😆', 'Hồi hộp ghê 🙈', 'Ba Tây ra đây! 🙏'])), 600); }
    });
    ctx.ui.clearActions(); me.turn(false);
    const mySc = R.score(myHand);
    S.tags.push(ctx.label(new T.Vector3(0, 2.95, 5.0), tagHtml(mySc.name, mySc.baTay ? 'lemon' : 'sky', true)));
    await ctx.wait(500);
    // ---- the others reveal, the dealer last
    const tagOf = new Map();
    for (const s of order) {
      if (s.me) continue;
      s.turn(true);
      const ms = meshes.get(s);
      if (s === dealer) { ctx.ui.status(`Nhà cái <b>${dealer.name}</b> lật bài…`); for (const m of ms) { await ctx.tween(m, { y: .5 }, 160, 'out'); await ctx.flip(m, true, 330); await ctx.tween(m, { y: .02 }, 120, 'in'); } }
      else { for (const m of ms) { ctx.flip(m, true, 280); await ctx.wait(110); } await ctx.wait(220); }
      const sc = R.score(hands.get(s));
      s.say(R.quip(sc, ctx.rand), 1700);
      s.anim(sc.baTay || sc.points >= 8 ? 'cheer' : sc.points <= 2 ? 'sad' : 'think');
      const tg = ctx.label(s.spot(0, 2.0).setY(.95), tagHtml(sc.name, s === dealer ? 'lemon' : 'sky'));
      S.tags.push(tg); tagOf.set(s, tg);
      await ctx.wait(420);
      s.turn(false);
    }
    // ---- settle against the dealer
    const handsArr = seats.map(s => (hands.get(s).length === 3 ? hands.get(s) : hands.get(dealer))), betsArr = seats.map(s => (s === dealer ? 0 : bets.get(s) || 0));
    const res = R.settleTable(handsArr, betsArr, S.dealer);
    seats.forEach((s, i) => { if (s !== dealer && !betsArr[i]) { res.mult[i] = 0; res.net[i] = 0; } });   // seats that sat out (bank too small) neither win nor lose
    const bank = youBank ? new T.Vector3(1.2, 0, 3.4) : dealer.spot(1.15, 3.3), payStacks = new Map();
    ctx.ui.status('So bài với nhà cái…');
    for (const s of bettors) {
      if (!bets.get(s)) continue;
      const i = seats.indexOf(s), m = res.mult[i];
      const tg = s.me ? S.tags[0] : tagOf.get(s);
      if (tg) tg.el.firstChild.className = 'tag3 ' + (m > 0 ? 'mint' : 'grey');
      if (tg && m > 0) tg.el.firstChild.textContent = R.score(hands.get(s)).name + (m === 2 ? ' · ăn x2' : ' · thắng');
      if (m < 0) fly(ctx, stacks.get(s), bank.x, bank.z, 480, true);
      else { const p = betSpot(s), g = ctx.stack(bets.get(s) * m, bank.x, bank.z); payStacks.set(s, g); fly(ctx, g, p.x + .9, p.z, 480, false); }
      await ctx.wait(220);
    }
    await ctx.wait(560);
    amtLbl.forEach(l => l.remove());
    for (const s of bettors) {
      const i = seats.indexOf(s);
      if (res.mult[i] <= 0) continue;
      const to = s.me ? new T.Vector3(0, 0, 8) : s.pos;
      fly(ctx, stacks.get(s), to.x, to.z, 520, true); fly(ctx, payStacks.get(s), to.x, to.z, 520, true);
    }
    // coins: the wallet for you, the labels for the bots
    const myMult = res.mult[0];
    if (youBank) { const d = res.dealerNet; if (d > 0) ctx.win(d, new T.Vector3(0, 1, 4)); else if (d < 0 && !ctx.spend(-d)) ctx.coins = Math.max(0, ctx.coins + d); }
    else if (myMult > 0) ctx.win(R.payout(bet, myMult), new T.Vector3(0, 1, 4));
    for (const s of seats) { if (s.me) continue; const i = seats.indexOf(s); s.setCoins(s.coins + res.net[i]); if (s !== dealer && betsArr[i]) s.anim(res.mult[i] > 0 ? 'cheer' : 'sad'); }
    if (!youBank) {
      dealer.anim(res.dealerNet >= 0 ? 'cheer' : 'sad');
      dealer.say(res.dealerNet > 0 ? ctx.pick(['Nhà cái ăn đậm 🤑', 'Cảm ơn mọi người nha 😆']) : res.dealerNet < 0 ? ctx.pick(['Nhà cái thua sấp mặt 😭', 'Chung tiền nè 💸']) : 'Huề vốn 😌', 1900);
      if (myMult > 0) { ctx.ui.callout(myMult === 2 ? 'BA TÂY!' : 'THẮNG!'); ctx.sfx('win', .5); if (myMult === 2) ctx.ui.confetti(); }
      else ctx.sfx('lose', .35);
      ctx.ui.status(myMult > 0 ? `Bạn thắng <b>${HC.fmt(bet * myMult)}</b> 🎉` : `Thua nhà cái <b>${HC.fmt(bet)}</b>`);
    } else {
      const d = res.dealerNet;
      if (d > 0) { ctx.ui.callout('NHÀ CÁI ĂN!'); ctx.sfx('win', .5); } else if (d < 0) ctx.sfx('lose', .35);
      ctx.ui.status(d > 0 ? `Nhà cái ăn <b>${HC.fmt(d)}</b> 🎉` : d < 0 ? `Nhà cái chung <b>${HC.fmt(-d)}</b>` : 'Nhà cái huề vốn');
    }
    await ctx.wait(650);
    const dSc = R.score(hands.get(dealer));
    const rows = [{ name: dealer.name + ' (nhà cái)', avatar: dealer.avatar, me: youBank, detail: `${dSc.name} · lá to ${C.name(dSc.top)}`, amount: res.dealerNet, tag: dSc.baTay ? 'Ba Tây' : null }];
    for (const s of order) {
      if (s === dealer) continue;
      const i = seats.indexOf(s), sc = R.score(hands.get(s)), m = res.mult[i];
      rows.push({ name: s.me && s.name === 'Bạn' ? 'Bạn' : s.name + (s.me ? ' (bạn)' : ''), avatar: s.avatar, me: s.me, detail: `${sc.name} · lá to ${C.name(sc.top)} · cược ${HC.short(bets.get(s))} · ${m > 0 ? 'thắng' : 'thua'} nhà cái`, amount: res.net[i], tag: sc.baTay ? 'Ba Tây' : null });
    }
    const result = { me: myHand.slice(), dealer: hands.get(dealer).slice(), mult: myMult, bet, coinsDelta: ctx.coins - coinsStart, youBank, dealerNet: res.dealerNet,
      zeroSum: res.net.reduce((a, b) => a + b, 0) === 0, botsOk: bettors.every(s => s.me || bets.get(s) > 0) };
    const title = youBank ? (res.dealerNet > 0 ? 'Nhà cái thắng!' : res.dealerNet < 0 ? 'Nhà cái chung tiền' : 'Nhà cái huề vốn') : myMult > 0 ? (myMult === 2 ? 'Ba Tây! Ăn gấp đôi' : 'Bạn thắng nhà cái!') : 'Thua nhà cái rồi';
    if (!auto) await ctx.ui.results(title, rows, { again: 'Ván mới' });
    // ---- clear the table
    for (const [, ms] of meshes) for (const m of ms) ctx.tween(m, { x: deckPos.x, y: .3, z: deckPos.z, rx: 0, arc: 1 }, 380, 'io').then(() => ctx.remove(m));
    await ctx.wait(450);
    return result;
  }
})();
