/* Xì Dách 3D — you and two players against a bot dealer, or (chế độ "Làm cái") you hold the bank against three bots.
 * Rules in js/games3d/rules/xi-dach.js. */
(function () {
  'use strict';
  T3.register('xi-dach', {
    title: 'Xì Dách', sub: 'Rút bài sát 21 · đủ 16 điểm mới được dằn · Xì Bàng, Xì Dách, Ngũ Linh',
    table: 'round', theme: 'sky', tex: ['cards', 'chips'], scripts: ['js/games3d/rules/xi-dach.js'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    rules: `<p>Mỗi người được 2 lá, đấu với <b>nhà cái</b>. J Q K tính 10, A tính 11 hoặc 1.</p>
      <ul><li><b>Rút</b> thêm lá cho sát 21. Quá 21 là <b>quắc</b> (thua, trừ khi nhà cái cũng quắc thì hoà).</li>
      <li>Phải đủ <b>16 điểm</b> mới được <b>Dằn</b> (dừng).</li>
      <li><b>Xì Bàng</b> (2 lá A) ăn gấp đôi. <b>Xì Dách</b> (A + 10/J/Q/K) ăn 1,5 lần.</li>
      <li><b>Ngũ Linh</b>: 5 lá mà chưa quắc, ăn gấp đôi. Hai bên cùng Ngũ Linh thì ai ít điểm hơn thắng.</li>
      <li>Còn lại so điểm với nhà cái, ai cao hơn thắng.</li></ul>`,
    modes: [
      { id: 'con', name: 'Nhà con', desc: 'Bạn đặt cược và đấu với nhà cái là bot.', rules: 'bạn chọn mức cược, rút / dằn rồi so bài với nhà cái (bot).' },
      { id: 'lam-cai', name: 'Làm cái', minMul: 4, desc: 'Bạn cầm cái: ba bot đặt cược, rút bài trước, bạn rút sau rồi so với từng nhà. Cần vốn gấp 4 để chung tiền.',
        rules: 'bạn là nhà cái. Ba bot đặt cược theo mức của bàn (không vượt quá số xu bạn chung được) và rút bài trước. Bạn rút sau cùng, đủ 16 điểm mới được dằn, rồi so với từng nhà: nhà nào thắng bạn chung tiền (Xì Bàng, Ngũ Linh ×2, Xì Dách ×1,5), nhà nào thua bạn ăn tiền cược. Nhà cái ra Xì Bàng / Xì Dách ngay khi chia thì lật bài so luôn.' },
    ],
    async start(ctx) { const bank = ctx.mode && ctx.mode.id === 'lam-cai'; for (;;) await (bank ? bankRound(ctx, null) : round(ctx, null)); },
    async selftest(ctx) {
      const R = window.Rules['xi-dach'];
      if (ctx.mode && ctx.mode.id === 'lam-cai') {   // ?selftest=1&mode=lam-cai
        const r = await bankRound(ctx, { auto: true }), exp = R.settleBank(r.hands, r.bets, r.dealer);
        return { pass: r.coinsDelta === exp.dealerNet && exp.dealerNet + exp.net.reduce((a, b) => a + b, 0) === 0 && r.bets.every(b => b > 0) ? 1 : 0, fail: 0, mode: 'lam-cai', dealer: r.dealer.map(c => c.r).join(' '), bets: r.bets, net: exp.net, coinsDelta: r.coinsDelta };
      }
      const r = await round(ctx, { auto: true }); const exp = R.settle(r.me, r.dealer);
      return { pass: r.mult === exp && r.coinsDelta === (exp > 0 ? Math.round(r.bet * exp) : exp === 0 ? 0 : -r.bet) ? 1 : 0, fail: 0, me: r.me.map(c => c.r).join(' '), dealer: r.dealer.map(c => c.r).join(' '), mult: r.mult, coinsDelta: r.coinsDelta, bet: r.bet };
    },
  });

  let S = null;   // persistent table state between rounds
  async function setup(ctx) {
    const T = ctx.THREE, bank = ctx.mode && ctx.mode.id === 'lam-cai';
    ctx.music('cards');
    const seats = await ctx.seats(4, { angles: [90, 180, 270, 0] });
    const dealer = bank ? seats[0] : seats[2];
    if (bank) { const n = document.getElementById('meNote'); if (n) n.textContent = 'Nhà cái'; }
    else dealer.label.el.insertAdjacentHTML('beforeend', '<i>Nhà cái</i>');
    // deck on the table in front of the dealer
    const deckPos = bank ? new T.Vector3(3.6, 0, 3.0) : new T.Vector3(0, 0, -3.4), deckStack = new T.Group(); deckStack.position.copy(deckPos);
    for (let i = 0; i < 8; i++) { const c = ctx.card(null); c.rotation.z = Math.PI; c.position.y = .02 + i * .025; c.rotation.y = (Math.random() - .5) * .1; deckStack.add(c); }
    ctx.add(deckStack);
    const chips = bank ? null : ctx.ui.chipPicker([1000, 5000, 10000, 50000, 100000, 500000], null, 2);
    S = { seats, dealer, deckPos, chips, tags: [] };
  }
  /** Shared dealing helper: one card from the deck to seat s (your cards stand up in front of the camera). */
  function dealer(ctx, deck, hands, meshes) {
    return async (s, faceUp) => {
      const c = deck.pop(), m = ctx.card(c.key); m.position.copy(S.deckPos); m.position.y = .25; m.rotation.z = Math.PI; ctx.add(m);
      hands.get(s).push(c); meshes.get(s).push(m);
      if (s.me) { await ctx.tween(m, { x: 0, y: 1, z: 4.5, arc: 1 }, 260, 'out'); m.rotation.z = 0; await ctx.layoutHand(meshes.get(s), { z: 5.4, y: 1.45, tilt: 1.0 }); }
      else { const n = meshes.get(s).length - 1, p = s.spot((n - 1) * .75, 3.6); await ctx.deal(m, { x: p.x, z: p.z, ry: s.facing, y: .02 + n * .01 }, 300, faceUp); }
    };
  }
  const handName = k => (k.cls === 1 ? k.total + ' điểm' : k.name);

  async function round(ctx, test) {
    if (!S) await setup(ctx);
    const T = ctx.THREE, R = window.Rules['xi-dach'], { seats, dealer: dl, deckPos, chips } = S;
    const players = seats.filter(s => s !== dl);
    S.tags.forEach(t => t.remove()); S.tags = [];
    // ---- bet
    let bet = 0;
    await new Promise(res => {
      ctx.ui.status('Chọn mức cược bên trái rồi bấm <b>CHIA BÀI</b>');
      const a = ctx.ui.actions([{ id: 'deal', label: 'CHIA BÀI', cls: 'pink', icon: 'emoji-fluent-3d/game/joker.png', onClick: () => { if (ctx.spend(chips.value)) { bet = chips.value; res(); } } }]);
      if ((test && test.auto) || ctx.Q.has('demo')) a.btn('deal').click();
    });
    ctx.ui.clearActions();
    const myStack = ctx.stack(bet, 0, 3.6);
    players.forEach(p => { if (!p.me) ctx.topUp(p, 60000, 1500000); });
    const botBets = players.map(p => (p.me ? bet : ctx.botStake([5000, 10000, 50000])));
    const botStacks = players.map((p, i) => (p.me ? null : ctx.stack(botBets[i], p.spot(0, 2.2).x, p.spot(0, 2.2).z)));
    // ---- deal two cards to everyone
    const deck = ctx.deck(), hands = new Map(), meshes = new Map();
    seats.forEach(s => { hands.set(s, []); meshes.set(s, []); });
    ctx.sfx('shuffle', .4);
    const order = [...players, dl];
    const give = dealer(ctx, deck, hands, meshes);
    for (let k = 0; k < 2; k++) for (const s of order) await give(s, false);
    const meHand = hands.get(seats[0]);
    const showMe = () => { const k = R.kind(meHand); ctx.ui.status(`Bài của bạn: <b>${handName(k)}</b>${k.cls === 0 ? ' 😵' : ''} · cược ${HC.fmt(bet)}`); return k; };
    showMe();
    // ---- specials end the round early
    const dk = R.kind(hands.get(dl));
    let early = dk.cls >= 3;
    if (early) { dl.say(dk.name + '! 😎'); }
    // ---- your turn
    if (!early && R.kind(meHand).cls < 3) {
      seats[0].turn(true);
      await new Promise(res => {
        const upd = () => { const k = showMe(); a.set('hit', { disabled: k.cls !== 1 || meHand.length >= 5 }); a.set('stand', { disabled: k.cls === 1 && k.total < 16 && meHand.length < 5 }); if (k.cls !== 1) res(); };
        const a = ctx.ui.actions([
          { id: 'hit', label: 'RÚT', cls: 'mint', icon: 'emoji-fluent-3d/hands/thumbs_up.png', onClick: async () => { a.set('hit', { disabled: true }); await give(seats[0], true); upd(); } },
          { id: 'stand', label: 'DẰN', cls: 'pink', onClick: () => res() },
        ]);
        upd();
        if (test && test.auto) { const auto = async () => { while (R.kind(meHand).cls === 1 && R.kind(meHand).total < 16 && meHand.length < 5) await give(seats[0], true); res(); }; auto(); }
      });
      ctx.ui.clearActions(); seats[0].turn(false);
      // bots
      for (const s of players) {
        if (s.me) continue;
        s.turn(true); await ctx.wait(350);
        while (R.shouldHit(hands.get(s), false)) { s.anim('think'); await give(s, false); await ctx.wait(200); }
        if (R.kind(hands.get(s)).cls === 0) s.say('Quắc rồi 😭'); else s.say(ctx.pick(['Dằn!', 'Đủ rồi nha', 'Thôi dừng 😏']));
        s.turn(false);
      }
      // dealer reveals and plays
      dl.turn(true);
      for (const m of meshes.get(dl)) await ctx.flip(m, true, 260);
      while (R.shouldHit(hands.get(dl), true)) { await ctx.wait(300); await give(dl, true); }
      dl.turn(false);
    } else {
      for (const m of meshes.get(dl)) await ctx.flip(m, true, 260);
    }
    // ---- reveal everyone and settle
    for (const s of players) if (!s.me) for (const m of meshes.get(s)) ctx.flip(m, true, 260);
    await ctx.wait(400);
    const rows = []; let myMult = 0;
    const dHand = hands.get(dl), dKind = R.kind(dHand);
    S.tags.push(ctx.label(dl.spot(0, 2.2).setY(.8), `<div class="tag3 lemon">${handName(dKind)}</div>`));
    players.forEach((s, i) => {
      const hand = hands.get(s), k = R.kind(hand), mult = R.settle(hand, dHand), b = botBets[i];
      const amount = Math.round(b * mult);
      if (s.me) myMult = mult;
      else { s.setCoins(s.coins + amount); if (mult > 0) s.anim('cheer'); else if (mult < 0) s.anim('sad'); }
      if (!s.me) S.tags.push(ctx.label(s.spot(0, 2.4).setY(.8), `<div class="tag3 ${mult > 0 ? 'mint' : mult < 0 ? 'grey' : 'sky'}">${handName(k)}</div>`));
      rows.push({ name: s.name + (s.me ? ' (bạn)' : ''), avatar: s.avatar, me: s.me, detail: `${handName(k)} · ${hand.length} lá · ${mult > 0 ? 'thắng' : mult < 0 ? 'thua' : 'hoà'} nhà cái`, amount, tag: k.cls >= 2 ? k.name : null });
    });
    const coins0 = ctx.coins + bet;   // the stake was taken when betting
    if (myMult >= 0) ctx.win(Math.round(bet * (1 + myMult)), new T.Vector3(0, 1, 3.6));
    if (myMult > 0) { ctx.ui.callout(R.kind(meHand).cls >= 2 ? R.kind(meHand).name.toUpperCase() + '!' : 'THẮNG!'); ctx.sfx('win', .5); }
    else if (myMult < 0) ctx.sfx('lose', .35);
    ctx.remove(myStack); botStacks.forEach(b => b && ctx.remove(b));
    rows.unshift({ name: dl.name + ' (nhà cái)', avatar: dl.avatar, detail: `${handName(dKind)} · ${dHand.length} lá`, amount: null });
    const result = { me: meHand.slice(), dealer: dHand.slice(), mult: myMult, bet, coinsDelta: ctx.coins - coins0 };
    if (!(test && test.auto)) await ctx.ui.results(myMult > 0 ? 'Bạn thắng!' : myMult < 0 ? 'Thua ván này' : 'Hoà', rows, { again: 'Ván mới' });
    // clean the table
    for (const [, ms] of meshes) for (const m of ms) ctx.tween(m, { x: deckPos.x, y: .3, z: deckPos.z, arc: 1 }, 380, 'io').then(() => ctx.remove(m));
    await ctx.wait(420);
    return result;
  }

  /** Chế độ "Làm cái": you hold the bank against the three bots. */
  async function bankRound(ctx, test) {
    if (!S) await setup(ctx);
    const T = ctx.THREE, R = window.Rules['xi-dach'], { seats, deckPos } = S, me = seats[0], players = seats.slice(1);
    const auto = !!(test && test.auto);
    S.tags.forEach(t => t.remove()); S.tags = [];
    // ---- the bots bet (never more than your bank can pay at once)
    const levels = ctx.room ? ctx.room.stakes : [5000, 10000, 50000];
    players.forEach(p => ctx.topUp(p, 60000, 1500000));
    await new Promise(res => {
      ctx.ui.status(`Bạn làm <b>nhà cái</b> · nhà con đặt cược theo bàn (${levels.map(HC.short).join(' / ')}) · bấm <b>CHIA BÀI</b>`);
      const a = ctx.ui.actions([{ id: 'deal', label: 'CHIA BÀI', cls: 'pink', icon: 'emoji-fluent-3d/game/joker.png', onClick: () => res() }]);
      if (auto || ctx.Q.has('demo')) a.btn('deal').click();
    });
    ctx.ui.clearActions();
    const bets = R.capBets(players.map(() => levels[Math.floor(Math.random() * levels.length)]), ctx.coins, levels);
    if (!bets.some(b => b > 0)) { ctx.ui.toast('Không đủ xu để làm cái bàn này 😅', 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); ctx.offerRescue && ctx.offerRescue(); await ctx.wait(1600); return { hands: [], bets: [], dealer: [], coinsDelta: 0 }; }
    const stacks = players.map((p, i) => { if (!bets[i]) return null; const sp = p.spot(0, 2.2), g = ctx.stack(bets[i], p.pos.x, p.pos.z); g.position.y = 1.4; ctx.tween(g, { x: sp.x, y: 0, z: sp.z, arc: .8 }, 380, 'out'); return g; });
    players.forEach((p, i) => { if (bets[i]) { p.setCoins(p.coins - bets[i]); if (Math.random() < .5) p.say(ctx.pick(['Cược ' + HC.short(bets[i]) + ' nha!', 'Nhà cái run chưa? 😆', 'Ván này ăn chắc 😏']), 1500); } });
    ctx.sfx('chips', .35);
    await ctx.wait(450);
    // ---- deal: the bettors first, the bank last
    const deck = ctx.deck(), hands = new Map(), meshes = new Map();
    seats.forEach(s => { hands.set(s, []); meshes.set(s, []); });
    ctx.sfx('shuffle', .4);
    const live = players.filter((p, i) => bets[i] > 0), give = dealer(ctx, deck, hands, meshes);
    for (let k = 0; k < 2; k++) { for (const s of live) await give(s, false); await give(me, true); }
    const myHand = hands.get(me);
    const showMe = () => { const k = R.kind(myHand); ctx.ui.status(`Bạn làm cái · bài: <b>${handName(k)}</b>${k.cls === 0 ? ' 😵' : ''} · nhà con cược ${HC.fmt(bets.reduce((a, b) => a + b, 0))}`); return k; };
    showMe();
    const early = R.kind(myHand).cls >= 3;
    if (early) { ctx.ui.callout(R.kind(myHand).name.toUpperCase() + '!'); await ctx.wait(500); }
    else {
      // ---- the bettors draw first
      for (const s of live) {
        if (R.kind(hands.get(s)).cls >= 3) { s.say(R.kind(hands.get(s)).name + '! 😎'); continue; }
        s.turn(true); ctx.ui.status(`<b>${s.name}</b> đang rút bài…`); await ctx.wait(350);
        while (R.shouldHit(hands.get(s), false)) { s.anim('think'); await give(s, false); await ctx.wait(200); }
        if (R.kind(hands.get(s)).cls === 0) s.say('Quắc rồi 😭'); else s.say(ctx.pick(['Dằn!', 'Đủ rồi nha', 'Thôi dừng 😏']));
        s.turn(false);
      }
      // ---- your turn as the bank
      me.turn(true);
      await new Promise(res => {
        const upd = () => { const k = showMe(); a.set('hit', { disabled: k.cls !== 1 || myHand.length >= 5 }); a.set('stand', { disabled: k.cls === 1 && k.total < 16 && myHand.length < 5 }); if (k.cls !== 1) res(); };
        const a = ctx.ui.actions([
          { id: 'hit', label: 'RÚT', cls: 'mint', icon: 'emoji-fluent-3d/hands/thumbs_up.png', onClick: async () => { a.set('hit', { disabled: true }); await give(me, true); upd(); } },
          { id: 'stand', label: 'DẰN', cls: 'pink', onClick: () => res() },
        ]);
        upd();
        if (auto) { (async () => { while (R.shouldHit(myHand, true)) await give(me, true); res(); })(); }
      });
      ctx.ui.clearActions(); me.turn(false);
    }
    // ---- everyone shows, the bank settles with each player
    for (const s of live) for (const m of meshes.get(s)) ctx.flip(m, true, 260);
    await ctx.wait(450);
    const bHands = live.map(s => hands.get(s)), bBets = live.map(s => bets[players.indexOf(s)]), res = R.settleBank(bHands, bBets, myHand);
    const coins0 = ctx.coins, rows = [];
    live.forEach((s, i) => {
      const k = R.kind(bHands[i]), m = res.mult[i], net = res.net[i], sp = s.spot(0, 2.2), g = stacks[players.indexOf(s)];
      s.setCoins(s.coins + bBets[i] + net);
      if (m > 0) { s.anim('cheer'); const pay = ctx.stack(net, 0, 4.2); ctx.tween(pay, { x: sp.x, y: 0, z: sp.z, arc: 1.2 }, 520, 'io').then(() => ctx.tween(pay, { x: s.pos.x, z: s.pos.z, y: 0, arc: 1 }, 420, 'io')).then(() => ctx.remove(pay)); ctx.tween(g, { x: s.pos.x, y: 0, z: s.pos.z, arc: 1 }, 600, 'io').then(() => ctx.remove(g)); }
      else if (m < 0) { s.anim('sad'); ctx.tween(g, { x: 0, y: 0, z: 4.2, arc: 1.2 }, 560, 'io').then(() => ctx.remove(g)); }
      else ctx.tween(g, { x: s.pos.x, y: 0, z: s.pos.z, arc: 1 }, 600, 'io').then(() => ctx.remove(g));
      S.tags.push(ctx.label(s.spot(0, 2.4).setY(.8), `<div class="tag3 ${m > 0 ? 'mint' : m < 0 ? 'grey' : 'sky'}">${handName(k)}</div>`));
      rows.push({ name: s.name, avatar: s.avatar, detail: `${handName(k)} · cược ${HC.short(bBets[i])} · ${m > 0 ? 'thắng' : m < 0 ? 'thua' : 'hoà'} nhà cái`, amount: net, tag: k.cls >= 2 ? k.name : null });
    });
    stacks.forEach((g, i) => { if (g && !bets[i]) ctx.remove(g); });
    await ctx.wait(700);
    const dNet = res.dealerNet;
    if (dNet > 0) { ctx.win(dNet, new T.Vector3(0, 1, 4)); ctx.ui.callout('NHÀ CÁI ĂN!'); ctx.sfx('win', .5); }
    else if (dNet < 0) { if (!ctx.spend(-dNet)) ctx.coins = Math.max(0, ctx.coins + dNet); ctx.sfx('lose', .35); }
    const myK = R.kind(myHand);
    rows.unshift({ name: me.name + ' (nhà cái)', avatar: me.avatar, me: true, detail: `${handName(myK)} · ${myHand.length} lá`, amount: dNet, tag: myK.cls >= 2 ? myK.name : null });
    ctx.ui.status(dNet > 0 ? `Nhà cái ăn <b>${HC.fmt(dNet)}</b> 🎉` : dNet < 0 ? `Nhà cái chung <b>${HC.fmt(-dNet)}</b>` : 'Huề vốn');
    const result = { hands: bHands.map(h => h.slice()), bets: bBets, dealer: myHand.slice(), coinsDelta: ctx.coins - coins0 };
    if (!auto) await ctx.ui.results(dNet > 0 ? 'Nhà cái thắng!' : dNet < 0 ? 'Nhà cái chung tiền' : 'Huề vốn', rows, { again: 'Ván mới' });
    for (const [, ms] of meshes) for (const m of ms) ctx.tween(m, { x: deckPos.x, y: .3, z: deckPos.z, arc: 1 }, 380, 'io').then(() => ctx.remove(m));
    await ctx.wait(420);
    return result;
  }
})();
