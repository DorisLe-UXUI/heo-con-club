/* Bầu Cua Tôm Cá 3D — bet on the six animals, the dealer shakes three dice under a bowl. */
(function () {
  'use strict';
  const SYM = ['nai', 'bau', 'ga', 'ca', 'cua', 'tom'];
  const NAME = { nai: 'Nai', bau: 'Bầu', ga: 'Gà', ca: 'Cá', cua: 'Cua', tom: 'Tôm' };
  /** Pure payout rule: each bet wins its stake once per matching die (stake returned), else it is lost. */
  function settle(bets, dice) {
    let back = 0; const per = {};
    for (const s of SYM) { const b = bets[s] || 0; if (!b) continue; const m = dice.filter(d => d === s).length; per[s] = m ? b * (m + 1) : 0; back += per[s]; }
    return { back, per };
  }
  T3.register('bau-cua', {
    title: 'Bầu Cua', sub: 'Đặt phỉnh vào con vật · 3 xúc xắc · trúng bao nhiêu con ăn bấy nhiêu lần',
    table: 'rect', theme: 'red', tex: ['bau-cua', 'chips'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'], settle,
    rules: `<p>Chọn mệnh giá phỉnh bên trái, chạm vào ô con vật để đặt cược. Có thể đặt nhiều ô.</p>
      <p>Bấm <b>LẮC</b>: nhà cái úp bát, lắc 3 xúc xắc rồi mở.</p>
      <ul><li>Mỗi xúc xắc ra đúng con bạn đặt: thắng <b>1 lần</b> tiền cược.</li><li>Ra 2 con: thắng <b>2 lần</b>, ra 3 con: thắng <b>3 lần</b>.</li><li>Không ra con nào: mất tiền cược ô đó.</li></ul>`,
    async start(ctx) { await play(ctx, false); },
    async selftest(ctx) { return play(ctx, true); },
  });

  async function play(ctx, test) {
    const T = ctx.THREE, H = ctx.H;
    ctx.music('dice');
    // board: 2 × 3 animal tiles on the left, plate + bowl on the right
    const tiles = {}, TILE = 3.1;
    SYM.forEach((s, i) => {
      const x = -6.6 + (i % 3) * (TILE + .35), z = -1.75 + Math.floor(i / 3) * (TILE + .35);
      const g = new T.Group(); g.position.set(x, 0, z);
      const base = new T.Mesh(H.roundedBox(TILE, .22, TILE, .18, 2), ctx.mat(0xfff6e8, { roughness: .5 })); base.position.y = .11; base.castShadow = true; base.receiveShadow = true; g.add(base);
      const face = new T.Mesh(new T.PlaneGeometry(TILE - .25, TILE - .25), new T.MeshStandardMaterial({ map: ctx.tex('bc_tile_' + s), roughness: .6, transparent: true }));
      face.rotation.x = -Math.PI / 2; face.position.y = .225; g.add(face);
      const glow = new T.Mesh(new T.RingGeometry(TILE * .62, TILE * .7, 4, 1, Math.PI / 4), new T.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0 }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = .24; glow.scale.set(1, 1, 1); g.add(glow);
      ctx.add(g); tiles[s] = { g, base, glow, x, z, stacks: [] };
      ctx.pickable(g, () => placeBet(s), on => { base.material.emissive.setHex(on ? 0x553300 : 0x000000); });
    });
    const PX = 5.4, PZ = 1.3, BX = 5.4, BZ = -3.4;
    const plate = ctx.plate(0xffffff, 2.4); plate.position.set(PX, 0, PZ); ctx.add(plate);
    const bowl = ctx.bowl(0xff6f8f, 2.0); bowl.position.set(BX, 0, BZ); ctx.add(bowl);
    const dice = [0, 1, 2].map(i => { const d = ctx.die({ faces: SYM.map(s => 'bc_face_' + s), size: .95 }); d.position.set(PX + (i - 1) * 1.1, .7, PZ); d.setFace(i); ctx.add(d); return d; });
    const seats = await ctx.seats(4, { angles: [90, 235, 270, 305], r: 8.2 });
    const bots = seats.slice(1);
    const hist = [];
    const histEl = ctx.ui.h('div', { class: 'glass', style: 'position:absolute;right:16px;top:132px;padding:14px 18px;display:flex;flex-direction:column;gap:8px;align-items:center;font:400 24px "Grandstander Black";color:#9b2c5e' }, ctx.ui.root);
    const drawHist = () => { histEl.innerHTML = '<div>Lịch sử</div>' + hist.slice(-6).reverse().map(r => `<div style="display:flex;gap:4px">${r.map(s => `<img src="${HC.A('games/bau-cua/dice-faces/' + s + '.png')}" style="width:44px;height:44px;border-radius:10px">`).join('')}</div>`).join(''); };
    drawHist();
    const chips = ctx.ui.chipPicker([1000, 5000, 10000, 50000, 100000, 500000], null, 2);
    let bets = {}, last = {}, rolling = false, botBets = [];
    const total = () => Object.values(bets).reduce((a, b) => a + b, 0);
    const status = () => ctx.ui.status(rolling ? 'Nhà cái đang lắc…' : total() ? `Tổng cược <b>${HC.fmt(total())}</b> · bấm <b>LẮC</b>` : 'Chọn phỉnh rồi chạm vào con vật để đặt cược');
    function addChipVisual(s, amount, mine) {
      const t = tiles[s], k = ctx.chipKey(amount), c = ctx.chip(k), n = t.stacks.length;
      const ox = (mine ? -.75 : .75) + ((n % 3) - 1) * .12, oz = (mine ? .75 : -.75) + Math.floor(n / 3) * .02;
      c.position.set(t.x + ox, .32 + (n % 12) * .1, t.z + oz); c.rotation.y = Math.random() * 6; c.userData.mine = mine; c.userData.sym = s; c.userData.amount = amount;
      ctx.add(c); t.stacks.push(c);
      if (!test) { c.position.y += 2.5; ctx.tween(c, { y: .32 + (n % 12) * .1 }, 260, 'bounce'); }
    }
    function placeBet(s, amount) {
      if (rolling) return;
      amount = amount || chips.value;
      if (!ctx.spend(amount)) return;
      bets[s] = (bets[s] || 0) + amount; addChipVisual(s, amount, true); ctx.sfx('chip', .4);
      tiles[s].glow.material.opacity = .9; status(); acts.set('roll', { disabled: false });
    }
    function clearVisual() { SYM.forEach(s => { tiles[s].stacks.forEach(c => ctx.remove(c)); tiles[s].stacks = []; tiles[s].glow.material.opacity = 0; }); }
    const acts = ctx.ui.actions([
      { id: 'clear', label: 'Xoá cược', cls: 'grey', onClick: () => { if (rolling) return; ctx.coins = ctx.coins + total(); bets = {}; clearVisual(); botBets.forEach(([s, a]) => addChipVisual(s, a, false)); status(); } },
      { id: 'again', label: 'Đặt lại', cls: 'sky', onClick: () => { if (rolling) return; for (const [s, a] of Object.entries(last)) placeBet(s, a); } },
      { id: 'roll', label: 'LẮC!', cls: 'pink', icon: 'games/bau-cua/dice-faces/cua.png', onClick: () => round() },
    ]);
    acts.set('roll', { disabled: true });
    function botsBet() {
      botBets = [];
      bots.forEach(b => { const n = 1 + Math.floor(Math.random() * 2); for (let i = 0; i < n; i++) { const s = ctx.pick(SYM), a = ctx.pick([5000, 10000, 50000]); botBets.push([s, a, b]); addChipVisual(s, a, false); } });
      bots[Math.floor(Math.random() * bots.length)].say(ctx.pick(['Cua về đi cua ơi! 🦀', 'Bầu bầu bầu!', 'Nai ơi nai ơi 🦌', 'Hôm nay tôm đỏ 🦐']));
    }
    async function round(forced) {
      if (rolling || !total()) return;
      rolling = true; acts.set('roll', { disabled: true }); acts.set('clear', { disabled: true }); acts.set('again', { disabled: true }); status();
      last = Object.assign({}, bets);
      const res = forced || [0, 1, 2].map(() => SYM[Math.floor(Math.random() * 6)]);
      // cover, shake, roll under the bowl, lift
      ctx.sfx('dice', .5);
      await ctx.tween(bowl, { x: PX, y: .22, z: PZ, arc: 1.5 }, 450, 'io');
      for (let i = 0; i < 6; i++) await ctx.tween(bowl, { rz: (i % 2 ? -.12 : .12), x: PX + (i % 2 ? -.15 : .15) }, 70, 'io');
      await ctx.tween(bowl, { rz: 0, x: PX }, 80);
      await Promise.all(dice.map((d, i) => { d.position.set(PX + (Math.random() - .5), .5, PZ + (Math.random() - .5)); return d.roll(SYM.indexOf(res[i]), PX + [-1.05, 1.05, 0][i], PZ + [.5, .5, -.8][i], 500); }));
      await ctx.wait(250);
      ctx.sfx('diceThrow', .5);
      await ctx.tween(bowl, { x: BX, y: 0, z: BZ, arc: 2.5 }, 600, 'io');
      hist.push(res); drawHist();
      // settle
      const { back, per } = settle(bets, res);
      SYM.forEach(s => { if (res.includes(s)) { const t = tiles[s]; t.glow.material.opacity = 1; t.glow.material.color.setHex(0x7ff0c4); ctx.tween(t.g, { y: .35 }, 180, 'out').then(() => ctx.tween(t.g, { y: 0 }, 260, 'bounce')); } });
      await ctx.wait(500);
      for (const s of SYM) {
        const t = tiles[s], won = res.includes(s);
        for (const c of t.stacks) {
          if (won) ctx.tween(c, c.userData.mine ? { x: 0, y: 2, z: 7.5, arc: 1 } : { x: c.position.x, y: 3, z: -7, arc: 1 }, 600, 'io').then(() => ctx.remove(c));
          else ctx.tween(c, { x: BX + 2.4, y: .3, z: BZ, arc: 1.2 }, 600, 'io').then(() => ctx.remove(c));
        }
      }
      for (const [s, a, b] of botBets) { const m = res.filter(x => x === s).length; b.setCoins(b.coins + (m ? a * m : -a)); if (m) b.anim('cheer'); }
      const net = back - total();
      await ctx.wait(650);
      if (back) ctx.win(back, new T.Vector3(0, 1, 4));
      if (net > 0) { ctx.ui.callout(net >= total() * 2 ? 'ĂN ĐẬM!' : 'THẮNG!'); ctx.sfx('win', .5); if (net >= total() * 2) ctx.ui.confetti(); }
      else if (total()) { ctx.ui.toast(`Ván này ${back ? 'thu về ' + HC.fmt(back) : 'không trúng'} · ${res.map(r => NAME[r]).join(' · ')}`, 'games/bau-cua/dice-faces/' + res[0] + '.png'); }
      const result = { dice: res, bets: Object.assign({}, bets), back, net };
      await ctx.wait(test ? 100 : 1600);
      bets = {}; clearVisual(); rolling = false; acts.set('clear', { disabled: false }); acts.set('again', { disabled: !Object.keys(last).length });
      botsBet(); status();
      return result;
    }
    botsBet(); status();
    if (!test) return;
    // ---- self-test: bet, force a result, check the payout
    const c0 = ctx.coins;
    placeBet('cua', 10000); placeBet('cua', 10000); placeBet('tom', 5000);
    const spent = c0 - ctx.coins;
    const r = await round(['cua', 'cua', 'nai']);
    const expected = 20000 * 3;      // 2 matches → stake ×(2+1); tôm lost
    return { pass: spent === 25000 && r.back === expected && ctx.coins === c0 - 25000 + expected ? 1 : 0, fail: 0, spent, back: r.back, expected, coinsDelta: ctx.coins - c0, dice: r.dice, settleCheck: settle({ ga: 1000 }, ['ga', 'ga', 'ga']).back === 4000 };
  }
})();
