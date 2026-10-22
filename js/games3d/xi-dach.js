/* Xì Dách 3D — you and two players against a bot dealer. Rules in js/games3d/rules/xi-dach.js. */
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
    async start(ctx) { for (;;) await round(ctx, null); },
    async selftest(ctx) { const r = await round(ctx, { auto: true }); const R = window.Rules['xi-dach']; const exp = R.settle(r.me, r.dealer); return { pass: r.mult === exp && r.coinsDelta === (exp > 0 ? Math.round(r.bet * exp) : exp === 0 ? 0 : -r.bet) ? 1 : 0, fail: 0, me: r.me.map(c => c.r).join(' '), dealer: r.dealer.map(c => c.r).join(' '), mult: r.mult, coinsDelta: r.coinsDelta, bet: r.bet }; },
  });

  let S = null;   // persistent table state between rounds
  async function setup(ctx) {
    const T = ctx.THREE;
    ctx.music('cards');
    const seats = await ctx.seats(4, { angles: [90, 180, 270, 0] });
    const dealer = seats[2];
    dealer.label.el.insertAdjacentHTML('beforeend', '<i>Nhà cái</i>');
    // deck on the table in front of the dealer
    const deckPos = new T.Vector3(0, 0, -3.4), deckStack = new T.Group(); deckStack.position.copy(deckPos);
    for (let i = 0; i < 8; i++) { const c = ctx.card(null); c.rotation.z = Math.PI; c.position.y = .02 + i * .025; c.rotation.y = (Math.random() - .5) * .1; deckStack.add(c); }
    ctx.add(deckStack);
    const chips = ctx.ui.chipPicker([1000, 5000, 10000, 50000, 100000, 500000], null, 2);
    S = { seats, dealer, deckPos, chips, tags: [] };
  }
  async function round(ctx, test) {
    if (!S) await setup(ctx);
    const T = ctx.THREE, R = window.Rules['xi-dach'], { seats, dealer, deckPos, chips } = S;
    const players = seats.filter(s => s !== dealer);
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
    const botBets = players.map(p => (p.me ? bet : ctx.pick([5000, 10000, 50000])));
    const botStacks = players.map((p, i) => (p.me ? null : ctx.stack(botBets[i], p.spot(0, 2.2).x, p.spot(0, 2.2).z)));
    // ---- deal two cards to everyone
    const deck = ctx.deck(), hands = new Map(), meshes = new Map();
    seats.forEach(s => { hands.set(s, []); meshes.set(s, []); });
    ctx.sfx('shuffle', .4);
    const order = [...players, dealer];
    const give = async (s, faceUp) => {
      const c = deck.pop(), m = ctx.card(c.key); m.position.copy(deckPos); m.position.y = .25; m.rotation.z = Math.PI; ctx.add(m);
      hands.get(s).push(c); meshes.get(s).push(m);
      if (s.me) { await ctx.tween(m, { x: 0, y: 1, z: 4.5, arc: 1 }, 260 * 1, 'out'); m.rotation.z = 0; await ctx.layoutHand(meshes.get(s), { z: 5.4, y: 1.45, tilt: 1.0 }); }
      else { const n = meshes.get(s).length - 1, p = s.spot((n - 1) * .75, 3.6); await ctx.deal(m, { x: p.x, z: p.z, ry: s.facing, y: .02 + n * .01 }, 300, faceUp); }
    };
    for (let k = 0; k < 2; k++) for (const s of order) await give(s, false);
    const meHand = hands.get(seats[0]);
    const showMe = () => { const k = R.kind(meHand); ctx.ui.status(`Bài của bạn: <b>${k.cls === 1 ? k.total + ' điểm' : k.name}</b>${k.cls === 0 ? ' 😵' : ''} · cược ${HC.fmt(bet)}`); return k; };
    showMe();
    // ---- specials end the round early
    const dk = R.kind(hands.get(dealer));
    let early = dk.cls >= 3;
    if (early) { dealer.say(dk.name + '! 😎'); }
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
      dealer.turn(true);
      for (const m of meshes.get(dealer)) await ctx.flip(m, true, 260);
      while (R.shouldHit(hands.get(dealer), true)) { await ctx.wait(300); await give(dealer, true); }
      dealer.turn(false);
    } else {
      for (const m of meshes.get(dealer)) await ctx.flip(m, true, 260);
    }
    // ---- reveal everyone and settle
    for (const s of players) if (!s.me) for (const m of meshes.get(s)) ctx.flip(m, true, 260);
    await ctx.wait(400);
    const rows = []; let myMult = 0;
    const dHand = hands.get(dealer), dKind = R.kind(dHand);
    S.tags.push(ctx.label(dealer.spot(0, 2.2).setY(.8), `<div class="tag3 lemon">${dKind.cls === 1 ? dKind.total + ' điểm' : dKind.name}</div>`));
    players.forEach((s, i) => {
      const hand = hands.get(s), k = R.kind(hand), mult = R.settle(hand, dHand), b = botBets[i];
      const amount = Math.round(b * mult);
      if (s.me) myMult = mult;
      else { s.setCoins(s.coins + amount); if (mult > 0) s.anim('cheer'); else if (mult < 0) s.anim('sad'); }
      if (!s.me) S.tags.push(ctx.label(s.spot(0, 2.4).setY(.8), `<div class="tag3 ${mult > 0 ? 'mint' : mult < 0 ? 'grey' : 'sky'}">${k.cls === 1 ? k.total + ' điểm' : k.name}</div>`));
      rows.push({ name: s.name + (s.me ? ' (bạn)' : ''), avatar: s.avatar, me: s.me, detail: `${k.cls === 1 ? k.total + ' điểm' : k.name} · ${hand.length} lá · ${mult > 0 ? 'thắng' : mult < 0 ? 'thua' : 'hoà'} nhà cái`, amount, tag: k.cls >= 2 ? k.name : null });
    });
    const coins0 = ctx.coins + bet;   // the stake was taken when betting
    if (myMult >= 0) ctx.win(Math.round(bet * (1 + myMult)), new T.Vector3(0, 1, 3.6));
    if (myMult > 0) { ctx.ui.callout(R.kind(meHand).cls >= 2 ? R.kind(meHand).name.toUpperCase() + '!' : 'THẮNG!'); ctx.sfx('win', .5); }
    else if (myMult < 0) ctx.sfx('lose', .35);
    ctx.remove(myStack); botStacks.forEach(b => b && ctx.remove(b));
    rows.unshift({ name: dealer.name + ' (nhà cái)', avatar: dealer.avatar, detail: `${dKind.cls === 1 ? dKind.total + ' điểm' : dKind.name} · ${dHand.length} lá`, amount: null });
    const result = { me: meHand.slice(), dealer: dHand.slice(), mult: myMult, bet, coinsDelta: ctx.coins - coins0 };
    if (!(test && test.auto)) await ctx.ui.results(myMult > 0 ? 'Bạn thắng!' : myMult < 0 ? 'Thua ván này' : 'Hoà', rows, { again: 'Ván mới' });
    // clean the table
    for (const [, ms] of meshes) for (const m of ms) ctx.tween(m, { x: deckPos.x, y: .3, z: deckPos.z, arc: 1 }, 380, 'io').then(() => ctx.remove(m));
    await ctx.wait(420);
    return result;
  }
})();
