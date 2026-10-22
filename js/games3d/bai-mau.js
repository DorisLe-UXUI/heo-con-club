/* Bài Màu 3D — UNO-style colour card game: you and three bots around a round table. Rules in js/games3d/rules/bai-mau.js. */
(function () {
  'use strict';
  const HEX = { red: 0xff5c7a, green: 0x2fc58e, blue: 0x3d9bff, yellow: 0xffbf1f };
  const CSS = { red: '#ff6f8a', green: '#3fe0a0', blue: '#6db8ff', yellow: '#ffd23c' };
  const STAKES = [1000, 5000, 10000, 50000, 100000];
  const DRAW = { x: -1.35, z: -1.05 }, PILE = { x: 1.05, z: -1.05 }, RING = { x: -0.15, z: -1.05, r: 3.2 }, POT = { x: -0.15, z: 1.25 };
  const ORDER = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 };
  const VORDER = v => (/^\d$/.test(v) ? +v : { skip: 10, reverse: 11, draw2: 12, wild: 13, draw4: 14 }[v]);
  const DEMO_TURNS = 9;         // &demo=1: the bot logic plays your seat for the first turns, then waits for you
  let S = null, R = null;

  T3.register('bai-mau', {
    title: 'Bài Màu', sub: 'Trùng màu hoặc trùng số · Cấm, Đảo chiều, +2, Đổi màu, +4 · hết bài trước ăn cả hũ',
    table: 'round', theme: 'lavender', tex: ['bai-mau', 'chips'], scripts: ['js/games3d/rules/bai-mau.js'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    cam: { pos: [0, 11.6, 16.2], look: [0, 0, -1.8] },   // keep in sync with CAM below
    rules: `<p>4 người, mỗi người <b>7 lá</b>. Lần lượt đánh <b>một lá trùng màu</b> hoặc <b>trùng số / trùng ký hiệu</b> với lá trên cùng ở giữa bàn. Vòng mũi tên giữa bàn cho biết <b>chiều chơi</b>, quầng sáng cho biết <b>màu đang chơi</b>.</p>
      <ul><li><b>Cấm</b>: người kế tiếp mất lượt.</li>
      <li><b>Đảo chiều</b>: đổi chiều chơi.</li>
      <li><b>+2</b>: người kế tiếp rút 2 lá và mất lượt.</li>
      <li><b>Đổi màu</b>: đánh lúc nào cũng được, bạn chọn màu mới.</li>
      <li><b>+4</b>: chọn màu mới, người kế tiếp rút 4 lá và mất lượt. Chỉ được đánh khi trên tay <b>không còn lá nào cùng màu</b> đang chơi.</li>
      <li>Không có lá đánh được thì <b>rút 1 lá</b>. Lá vừa rút đánh được thì đánh luôn hoặc bấm <b>GIỮ BÀI</b>.</li>
      <li>Còn 2 lá, trước khi đánh xuống còn 1 lá phải bấm <b>UNO!</b>. Quên mà bị bắt thì <b>rút 2 lá</b>. Bot quên thì bạn bấm <b>BẮT!</b> thật nhanh.</li>
      <li>Ai <b>hết bài trước</b> thắng: mỗi người góp tiền cược vào hũ, người thắng ăn cả hũ. Điểm thắng = tổng bài còn lại của người khác (lá số theo số, Cấm/Đảo/+2 = 20, Đổi màu/+4 = 50).</li>
      <li>Lá mở đầu: Cấm thì người đầu mất lượt, Đảo chiều thì người chia bài đánh trước và đi ngược lại, +2 thì người đầu rút 2 lá. Lá Đổi màu/+4 được xào lại.</li></ul>`,
    async start(ctx) { for (;;) await game(ctx, null); },
    async selftest(ctx) {
      // 1) a full game, your seat played by the bot logic through the real UI handlers
      const c0 = ctx.coins, r = await game(ctx, { auto: true }), delta = ctx.coins - c0;
      const expected = r.winner === 0 ? r.stake * 3 : -r.stake;
      const ok1 = delta === expected && r.cards === 108 && r.visual && r.reason === 'empty';
      // 2) a rigged one-card deal that you win on the first move: checks the pot payout path
      const Rm = window.Rules['bai-mau'], d = Rm.makeDeck(), take = k => d.splice(d.findIndex(c => c.key === k), 1)[0];
      const mine = take('bm_red_5'), b1 = take('bm_blue_7'), b2 = take('bm_wild'), b3 = take('bm_green_skip'), start = take('bm_red_3');
      const c1 = ctx.coins, r2 = await game(ctx, { auto: true, dealer: 3, handSize: 1, deck: d.concat([start, b3, b2, b1, mine]) }), delta2 = ctx.coins - c1;
      const ok2 = r2.winner === 0 && delta2 === r2.stake * 3 && r2.points === 7 + 50 + 20 && r2.cards === 108 && r2.visual;
      const ok = ok1 && ok2;
      return { pass: ok ? 1 : 0, fail: ok ? 0 : 1, winner: r.winnerName, turns: r.turns, points: r.points, stake: r.stake, coinsDelta: delta, expected, cards: r.cards, visual: r.visual, reason: r.reason, unoCatches: r.catches, reshuffles: r.reshuffles,
        rigged: { winner: r2.winner, coinsDelta: delta2, expected: r2.stake * 3, points: r2.points, ok: ok2 } };
    },
  });

  // ------------------------------------------------------------------ one-time table setup
  async function setup(ctx) {
    const T = ctx.THREE; R = window.Rules['bai-mau'];
    injectCss();
    ctx.music('cards');
    const seats = await ctx.seats(4, { angles: [90, 180, 270, 0] });
    S = { ctx, seats, dealer: 3, mine: new Map(), discard: [], fans: [], tags: [], loose: [], dir: 1, colTarget: new T.Color(0xffffff), catches: 0 };
    buildRing(ctx);
    // draw pile: a stack of card backs whose height follows the number of cards left
    const dp = S.drawPile = new T.Group(); dp.position.set(DRAW.x, 0, DRAW.z); ctx.add(dp);
    const slot = new T.Mesh(new T.PlaneGeometry(1.7, 2.25), new T.MeshBasicMaterial({ map: T3.canvasTex(160, 208, (x, w, h) => { x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 8; x.setLineDash([16, 10]); T3.rr(x, 8, 8, w - 16, h - 16, 18); x.stroke(); }), transparent: true, depthWrite: false }));
    slot.rotation.x = -Math.PI / 2; slot.position.y = .004; dp.add(slot);
    S.drawStack = [];
    for (let i = 0; i < 14; i++) { const c = ctx.card(null, { tex: 'bm_back', back: 'bm_back', w: 1.3 }); c.position.set((Math.random() - .5) * .05, .02 + i * .028, (Math.random() - .5) * .05); c.rotation.y = (Math.random() - .5) * .1; dp.add(c); S.drawStack.push(c); }
    ctx.pickable(dp, () => S.onDraw && S.onDraw(), on => { dp.userData.hover = on; });
    S.drawTag = ctx.label(new T.Vector3(DRAW.x, 0, DRAW.z + 1.75), '<div class="tag3 sky bmsmall">108</div>');
    // discard slot
    const ps = new T.Mesh(slot.geometry, slot.material); ps.rotation.x = -Math.PI / 2; ps.position.set(PILE.x, .004, PILE.z); ctx.add(ps);
    // bots' hands: fanned card backs standing in front of each bot
    for (let i = 1; i < 4; i++) {
      const s = seats[i], p = s.spot(0, 1.25), h = new T.Group();
      // backs face the table centre blended toward the camera, cards lean back toward their owner
      const inward = new T.Vector3(-Math.cos(s.angle), 0, -Math.sin(s.angle)), toCam = ctx.camera.position.clone().sub(p).setY(0).normalize(), b = inward.add(toCam).normalize();
      h.position.set(p.x, .55, p.z); h.rotation.order = 'YXZ'; h.rotation.y = Math.atan2(-b.x, -b.z); h.rotation.x = 2.0; ctx.add(h);
      const tp = p.clone().addScaledVector(b, 1.15);
      const tag = ctx.label(new T.Vector3(tp.x, 0, tp.z), '<div class="tag3 bmsmall">0 lá</div>');
      S.fans[i] = { holder: h, cards: [], tag };
    }
    // a little side panel: pot, direction, colour
    S.side = ctx.ui.h('div', { class: 'bmside glass' }, ctx.ui.root);
    // glow sprite for playable cards
    S.glowTex = T3.canvasTex(192, 256, (x, w, h) => { x.shadowColor = '#fff27a'; x.shadowBlur = 28; x.strokeStyle = '#fff6b0'; x.lineWidth = 12; for (let k = 0; k < 3; k++) { T3.rr(x, 26, 26, w - 52, h - 52, 18); x.stroke(); } });
    S.glowMat = new T.MeshBasicMaterial({ map: S.glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    ctx.onFrame(frame);
    addEventListener('resize', () => { fitCamera(); ctx.updateLabels(); });   // re-project labels right away (the framework waits for the next tick)
  }

  function injectCss() {
    if (document.getElementById('bm-css')) return;
    const st = document.createElement('style'); st.id = 'bm-css';
    st.textContent = `
      .bmside{position:absolute;right:16px;top:132px;padding:14px 22px;display:flex;flex-direction:column;gap:6px;font:800 24px "Baloo 2";color:#7a4a8e;min-width:230px}
      .bmside .r{display:flex;align-items:center;gap:10px;white-space:nowrap}.bmside img{width:44px}.bmside b{font:400 30px "Grandstander Black";color:#a86d00}
      .bmside .sw{width:34px;height:34px;border-radius:50%;border:4px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.25)}
      .bmside .dir{font:400 36px "Grandstander Black";line-height:1;color:#8d6bff;width:44px;text-align:center}
      .bmsmall{font-size:24px;padding:4px 14px}
      .tag3.bmlav{background:linear-gradient(#d9c9ff,#8d6bff);box-shadow:0 5px 0 #5f3fc9}
      .bmpick{display:grid;grid-template-columns:1fr 1fr;gap:28px;padding:8px 26px}
      .bmcol{position:relative;height:190px;border-radius:44px;border:6px solid #fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;transition:transform .12s}
      .bmcol:hover{transform:translateY(-6px) scale(1.03)}.bmcol:active{transform:translateY(3px)}
      .mbody .bmcol b{font:400 46px "Grandstander Black";color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.2)}.bmcol small{font:800 26px "Baloo 2";opacity:.95}
      .bmcol:before{content:"";position:absolute;left:18px;top:14px;width:60px;height:30px;border-radius:50%;background:rgba(255,255,255,.55);transform:rotate(-20deg)}`;
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------------ direction ring, colour glow, turn pointer
  function buildRing(ctx) {
    const T = ctx.THREE, g = new T.Group(); g.position.set(RING.x, .02, RING.z); ctx.add(g);
    const glowTex = T3.canvasTex(256, 256, (x, w, h) => { const gr = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.5, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
    const glowMat = new T.MeshBasicMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: .75 });
    const glow = new T.Mesh(new T.PlaneGeometry(4.4, 4.4), glowMat); glow.rotation.x = -Math.PI / 2; glow.position.set(PILE.x - RING.x, .002, PILE.z - RING.z); g.add(glow);
    const wash = new T.Mesh(new T.CircleGeometry(RING.r - .12, 96), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .16, depthWrite: false })); wash.rotation.x = -Math.PI / 2; g.add(wash);
    const ringMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .45, roughness: .35 });
    const spin = new T.Group(); g.add(spin);
    const band = new T.Mesh(new T.TorusGeometry(RING.r, .1, 12, 160), ringMat); band.rotation.x = Math.PI / 2; band.position.y = .06; spin.add(band);
    // chevron arrows riding on the ring; the inner group is mirrored for counter-clockwise play
    const shape = new T.Shape(); shape.moveTo(0, .5); shape.lineTo(.42, -.22); shape.lineTo(0, -.02); shape.lineTo(-.42, -.22); shape.closePath();
    const ageo = new T.ExtrudeGeometry(shape, { depth: .1, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2 });
    ageo.rotateX(Math.PI / 2); ageo.translate(0, .17, 0);
    const arrowMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .35, roughness: .3 });
    const arrows = new T.Group(); spin.add(arrows);
    for (let k = 0; k < 4; k++) {
      const phi = k * Math.PI / 2 + Math.PI / 4, a = new T.Mesh(ageo, arrowMat);
      a.position.set(RING.r * Math.cos(phi), 0, -RING.r * Math.sin(phi)); a.rotation.y = phi; a.castShadow = true; arrows.add(a);
    }
    // pointer that slides around the ring to whoever is playing
    const ptr = new T.Group(); g.add(ptr);
    const cone = new T.Mesh(new T.ConeGeometry(.34, .8, 24), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .5, roughness: .3 }));
    cone.geometry.rotateZ(-Math.PI / 2); cone.castShadow = true; ptr.add(cone);
    const orb = new T.Mesh(new T.SphereGeometry(.26, 20, 14), arrowMat); orb.position.x = -.55; ptr.add(orb);
    S.ring = { g, spin, arrows, glowMat, wash: wash.material, ringMat, arrowMat, ptr, cone, mirror: 1, ang: Math.PI / 2, targetAng: Math.PI / 2, spinV: 0 };
  }
  const CAM = { pos: [0, 11.6, 16.2], look: [0, 0, -1.8] };
  /** Narrow windows: the framework only widens the fov, which still cuts off the side bots — pull the camera back too. */
  function fitCamera() {
    const cam = S.ctx.camera; if (S.aspect === cam.aspect) return; S.aspect = cam.aspect;
    const k = Math.min(1.8, Math.max(1, Math.sqrt(1.6 / cam.aspect))), P = CAM.pos, L = [CAM.look[0], CAM.look[1], CAM.look[2] - (k - 1) * 4];
    cam.position.set(L[0] + (P[0] - L[0]) * k, L[1] + (P[1] - L[1]) * k, L[2] + (P[2] - L[2]) * k); cam.lookAt(L[0], L[1], L[2]);
    S.k = k; if (S.st && S.mine.size) layoutMine(0);    // your hand comes closer to the camera on narrow screens
  }
  function frame(dt, t) {
    if (!S) return;
    fitCamera();
    const r = S.ring, T = S.ctx.THREE;
    r.spinV += ((-S.dir * .55) - r.spinV) * Math.min(1, dt * 3);
    r.spin.rotation.y += r.spinV * dt;
    r.mirror += (S.dir - r.mirror) * Math.min(1, dt * 7); r.arrows.scale.x = Math.abs(r.mirror) < .02 ? .02 * Math.sign(S.dir) : r.mirror;
    for (const m of [r.glowMat, r.wash]) m.color.lerp(S.colTarget, Math.min(1, dt * 5));
    r.ringMat.emissive.lerp(S.colTarget, Math.min(1, dt * 5)); r.cone.material.emissive.lerp(S.colTarget, Math.min(1, dt * 5));
    let d = r.targetAng - r.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); r.ang += d * Math.min(1, dt * 6);
    const rr = RING.r + .55 + Math.sin(t * 5) * .08;
    r.ptr.position.set(Math.cos(r.ang) * rr, .3, Math.sin(r.ang) * rr); r.ptr.rotation.y = -r.ang;
    r.glowMat.opacity = .62 + Math.sin(t * 3) * .12;
    S.drawPile.scale.setScalar(1 + ((S.drawPile.userData.hover || S.drawHint) ? .05 + (S.drawHint ? Math.sin(t * 6) * .03 : 0) : 0));
    if (S.mineGlow) for (const m of S.mine.values()) if (m.userData.glow) m.userData.glow.material.opacity = .75 + Math.sin(t * 5) * .25;
  }
  function setColor(c) { S.colTarget = new S.ctx.THREE.Color(HEX[c]).convertSRGBToLinear(); side(); }
  function setDir(d) { S.dir = d; side(); }
  function pointAt(p) { S.ring.targetAng = S.seats[p].angle; }
  function side() {
    const st = S.st; if (!st) { S.side.style.display = 'none'; return; }
    S.side.style.display = '';
    S.side.innerHTML = `<div class="r"><img src="${HC.A('emoji-fluent-3d/game/money_bag.png')}"><span>Hũ</span><b>${HC.short(S.pot || 0)}</b></div>`
      + `<div class="r"><span class="dir">${S.dir > 0 ? '↻' : '↺'}</span><span>${S.dir > 0 ? 'Theo kim đồng hồ' : 'Ngược kim đồng hồ'}</span></div>`
      + `<div class="r"><span class="sw" style="background:${CSS[st.color] || '#fff'}"></span><span>Màu <b style="font:800 26px 'Baloo 2';color:${CSS[st.color]}">${R.COLOR_NAME[st.color] || ''}</b></span></div>`;
  }

  // ------------------------------------------------------------------ card meshes
  function mk(card, w = 1.32) { const m = S.ctx.card(null, { tex: card ? card.key : 'bm_back', back: 'bm_back', w }); m.userData.cid = card ? card.id : -1; m.userData.card = card; return m; }
  function drawTop() { const n = S.drawStack.filter(c => c.visible).length; return new S.ctx.THREE.Vector3(DRAW.x, .06 + n * .028, DRAW.z); }
  function refreshDrawPile() {
    const n = S.st ? S.st.draw.length : 108, k = n ? Math.max(1, Math.min(14, Math.ceil(n / 7))) : 0;
    S.drawStack.forEach((c, i) => { c.visible = i < k; });
    S.drawTag.el.innerHTML = `<div class="tag3 sky bmsmall">${n} lá</div>`;
  }
  function refreshTags() {
    const st = S.st;
    for (let i = 1; i < 4; i++) {
      const n = st ? st.hands[i].length : 0, f = S.fans[i];
      const uno = st && n === 1 && st.unoCalled[i];
      f.tag.el.innerHTML = `<div class="tag3 ${uno ? 'lemon' : n <= 2 ? '' : 'bmlav'} bmsmall">${uno ? 'UNO! · 1 lá' : n + ' lá'}</div>`;
      f.tag.el.style.display = st ? '' : 'none';
    }
  }
  function layoutFan(i, ms = 240) {
    const f = S.fans[i], n = f.cards.length, da = Math.min(.16, 1.8 / Math.max(1, n)), Rf = 2.6;
    f.cards.forEach((c, k) => { const a = (k - (n - 1) / 2) * da; S.ctx.tween(c, { x: -Rf * Math.sin(a), y: -k * .005, z: Rf - Rf * Math.cos(a), ry: a + Math.PI, rx: 0, rz: 0 }, ms, 'out'); });   // ry + π: the back art reads upright from the table centre
  }
  function fanAdd(i) { const c = mk(null, .95); c.position.set(0, 0, 0); S.fans[i].holder.add(c); S.fans[i].cards.push(c); layoutFan(i); }
  function fanPos(i) { return S.fans[i].holder.getWorldPosition(new S.ctx.THREE.Vector3()); }
  function seatPos(p) { return p === 0 ? new S.ctx.THREE.Vector3(0, 1.4, 5.2) : fanPos(p); }

  function addMine(card) {
    const ctx = S.ctx, m = mk(card, 1.26);
    const glow = new ctx.THREE.Mesh(new ctx.THREE.PlaneGeometry(1.26 * 1.32, 1.26 * 1.44 * 1.24), S.glowMat.clone());
    glow.rotation.x = -Math.PI / 2; glow.position.y = .001; glow.visible = false; m.add(glow); m.userData.glow = glow;
    m.userData.unpick = ctx.pickable(m, () => onMyCard(card), on => { if (S.mine.has(card.id)) ctx.tween(m, { s: on && S.human ? 1.08 : 1 }, 120); });
    S.mine.set(card.id, m);
    return m;
  }
  function sortedMine() { return S.st.hands[0].slice().sort((a, b) => ORDER[a.c] - ORDER[b.c] || VORDER(a.v) - VORDER(b.v)); }
  function layoutMine(ms = 280) {
    const st = S.st, myTurn = !!S.human && !S.human.busy;
    const list = sortedMine().filter(c => S.mine.has(c.id)).map(c => {
      const m = S.mine.get(c.id), ok = myTurn && R.canPlay(st, 0, c), k = myTurn && !ok ? .6 : 1;
      m.userData.selected = ok; m.userData.glow.visible = ok; m.userData.front.material.color.setRGB(k, k, k * 1.04);
      return m;
    });
    S.mineGlow = myTurn;
    const k = (S.k || 1) - 1;
    return S.ctx.layoutHand(list, { z: 5.25 + k * 10, y: 1.5 + k * 4.5, tilt: 1.0 - k * .4, spread: Math.min(1.1, 11 / Math.max(1, list.length)) * (1 - k * .5), ms });
  }

  // ------------------------------------------------------------------ animations
  function nextDiscardSpot() { const n = Math.min(S.discard.length, 12); return { x: PILE.x + (Math.random() - .5) * .3, y: .03 + n * .01, z: PILE.z + (Math.random() - .5) * .26, ry: (Math.random() - .5) * 1.1 }; }
  function compactDiscard() {
    while (S.discard.length > 12) S.ctx.remove(S.discard.shift());
    S.discard.forEach((m, i) => { m.position.y = .03 + i * .01; });
  }
  async function toDiscard(m) {
    const ctx = S.ctx, d = nextDiscardSpot();
    if (!m.parent) ctx.add(m);
    ctx.sfx(Math.random() < .5 ? 'card' : 'card2', .4);
    await ctx.tween(m, { x: d.x, y: d.y, z: d.z, rx: 0, ry: d.ry, rz: 0, s: 1, arc: 1.3 }, 420, 'out');
    S.discard.push(m); compactDiscard();
  }
  /** Cards just drawn by player p (already in the rules state) fly from the draw pile to that hand. */
  async function animDraw(p, cards) {
    const ctx = S.ctx; syncReshuffle();
    for (const card of cards) {
      const from = drawTop();
      if (p === 0) {
        const m = addMine(card); m.position.copy(from); m.rotation.set(0, 0, Math.PI); ctx.add(m);
        ctx.sfx('slide', .35);
        await ctx.tween(m, { x: 0, y: 2.3, z: 3.6, arc: .8 }, 230, 'out');
        layoutMine(220);
      } else {
        const m = mk(null, .95); m.position.copy(from); m.rotation.set(0, 0, 0); ctx.add(m);
        const to = fanPos(p); ctx.sfx('slide', .3);
        await ctx.tween(m, { x: to.x, y: to.y, z: to.z, ry: S.seats[p].facing, arc: .9 }, 260, 'out');
        ctx.remove(m); fanAdd(p);
      }
      refreshDrawPile(); refreshTags();
    }
    if (p === 0) await ctx.wait(160);
  }
  /** The rules reshuffled the discard pile into the draw pile: sweep the old discards over. */
  function syncReshuffle() {
    if (!S.st || S.st.reshuffles === S.seenReshuffles) return;
    S.seenReshuffles = S.st.reshuffles;
    const keep = S.discard.pop();
    for (const m of S.discard) S.ctx.tween(m, { x: DRAW.x, y: .3, z: DRAW.z, rz: Math.PI, arc: 1 }, 380, 'io').then(() => S.ctx.remove(m));
    S.discard = keep ? [keep] : []; compactDiscard();
    S.ctx.ui.toast('Hết bài rút · xào lại chồng bài giữa bàn', 'emoji-fluent-3d/game/joker.png');
    S.ctx.sfx('shuffle', .4);
  }
  function say(p, text) { if (p === 0) S.ctx.ui.toast(text, 'emoji-fluent-3d/symbols/speech_balloon.png'); else S.seats[p].say(text, 1600); }

  /** Visualise one rules event (a card played by p) and its effects. */
  async function applyPlay(ev, test) {
    const ctx = S.ctx, T = ctx.THREE, p = ev.p, st = S.st;
    let m;
    if (p === 0) { m = S.mine.get(ev.card.id); S.mine.delete(ev.card.id); m.userData.unpick(); m.remove(m.userData.glow); m.userData.front.material.color.setRGB(1, 1, 1); layoutMine(); }
    else {
      const f = S.fans[p], old = f.cards.pop(); if (old) f.holder.remove(old); layoutFan(p);
      m = mk(ev.card); m.position.copy(fanPos(p)); m.rotation.set(0, S.seats[p].facing, Math.PI); ctx.add(m);
    }
    refreshTags();
    await toDiscard(m);
    setColor(st.color);
    const c = ev.card;
    if (c.c === 'wild') { ctx.ui.float((c.v === 'draw4' ? '+4 · ' : '') + 'Màu ' + R.COLOR_NAME[ev.color] + '!', new T.Vector3(PILE.x, 1, PILE.z)); if (p) say(p, ctx.pick(['Đổi sang ', 'Chơi màu ', 'Giờ là màu ']) + R.COLOR_NAME[ev.color] + ' nha!'); ctx.sfx('power', .4); }
    if (ev.reversed) { setDir(st.dir); ctx.ui.float('ĐẢO CHIỀU', new T.Vector3(RING.x, 1, RING.z)); ctx.sfx('slide', .5); if (p) say(p, 'Đảo chiều nè! 🔄'); }
    if (ev.skipped != null) { const v = ev.skipped; ctx.ui.float('MẤT LƯỢT', seatPos(v).add(new T.Vector3(0, .8, 0))); say(v, v === 0 ? 'Bạn bị cấm một lượt 😵' : ctx.pick(['Ơ kìa 😵', 'Bị cấm rồi 😭', 'Hic, mất lượt'])); ctx.sfx('error', .3); }
    if (ev.victim != null) {
      ctx.ui.float(c.v === 'draw4' ? '+4' : '+2', seatPos(ev.victim).add(new T.Vector3(0, .8, 0)));
      if (ev.victim) S.seats[ev.victim].anim('sad');
      say(ev.victim, ev.victim === 0 ? `Bạn phải rút ${ev.drawn.length} lá 😭` : ctx.pick(['Huhu 😭', 'Ác quá nha!', 'Nhớ đó nha 😤']));
      await animDraw(ev.victim, ev.drawn);
    }
    if (ev.uno && p) { say(p, 'UNO! ☝️'); ctx.sfx('jingle', .4); }      // your own call was already celebrated on the button
    if (ev.forgotUno && !st.over) await unoWindow(p, test);
    refreshTags(); side();
  }

  /** Someone went down to one card without calling UNO: a short window to catch them (or to call it late). */
  async function unoWindow(p, test) {
    const ctx = S.ctx, st = S.st;
    if (p === 0) {
      ctx.ui.toast('Quên bấm UNO! rồi · bấm ngay kẻo bị bắt!', 'emoji-fluent-3d/symbols/speech_balloon.png');
      refreshButtons();
      for (let t = 0; t < 1700 && st.unoPending === 0; t += 100) await ctx.wait(100);
      if (st.unoPending === 0 && (test || ctx.rand() < .8)) {
        const catcher = 1 + Math.floor(ctx.rand() * 3), c = R.catchUno(st, catcher);
        if (c) { S.catches++; say(catcher, 'Bắt được rồi nha! Quên hô UNO, rút 2 lá 😝'); S.seats[catcher].anim('cheer'); await animDraw(0, c.cards); }
      }
    } else {
      S.catchOpen = true; refreshButtons();
      if (test) ctx.wait(250).then(() => { const b = A && A.btn('catch'); if (b && S.catchOpen) b.click(); });
      const t0 = ctx.rand() * 900 + 500;
      for (let t = 0; t < 1600 && st.unoPending === p; t += 100) {
        await ctx.wait(100);
        if (st.unoPending === p && !S.catchClicked && t >= t0 && ctx.rand() < .07) {   // another bot may notice first
          const others = [1, 2, 3].filter(i => i !== p), catcher = others[Math.floor(ctx.rand() * others.length)], c = R.catchUno(st, catcher);
          if (c) { S.catches++; say(catcher, `${S.seats[p].name} quên hô UNO kìa! 😝`); await animDraw(p, c.cards); }
        }
      }
      S.catchOpen = false; S.catchClicked = false; refreshButtons();
    }
  }

  // ------------------------------------------------------------------ HUD
  let A = null;
  function refreshButtons() {
    if (!A) return;
    const st = S.st, h = S.human, idle = h && !h.busy;
    A.set('draw', { disabled: !(idle && st.drawnId < 0) });
    A.set('uno', { disabled: !(st && R.canCallUno(st, 0)) || !!(h && h.busy && st.unoPending !== 0) });
    A.set('pass', { hidden: !(idle && st.drawnId >= 0) });
    A.set('catch', { hidden: !S.catchOpen });
    S.drawHint = !!(idle && st.drawnId < 0 && !R.legalMoves(st, 0).length);
  }
  function status(extra) {
    const st = S.st; if (!st) return;
    const who = st.turn === 0 ? 'Lượt của <b>bạn</b>' : `Lượt của <b>${S.seats[st.turn].name}</b>`;
    S.ctx.ui.status(`${who} · màu <b style="color:${CSS[st.color]}">${R.COLOR_NAME[st.color]}</b>${extra ? ' · ' + extra : ''}`);
  }
  function setTurn(p) { S.seats.forEach((s, i) => s.turn(i === p)); pointAt(p); }

  function pickColor() {
    const ctx = S.ctx;
    return new Promise(res => {
      const body = ctx.ui.h('div', { class: 'bmpick' });
      for (const c of R.COLORS) {
        const n = S.st.hands[0].filter(x => x.c === c).length;
        const b = ctx.ui.h('div', { class: 'bmcol', style: `background:radial-gradient(circle at 35% 25%,#ffffff99,${CSS[c]} 55%);box-shadow:0 10px 0 ${'#' + (HEX[c] & 0xbfbfbf).toString(16).padStart(6, '0')},0 16px 26px rgba(60,10,50,.25)`, html: `<b>${R.COLOR_NAME[c]}</b><small>${n ? 'bạn có ' + n + ' lá' : 'chưa có lá nào'}</small>`, 'data-c': c }, body);
        b.onclick = () => { ctx.ui.closeModal(); ctx.sfx('pop', .5); res(c); };
      }
      ctx.ui.modal({ title: 'Chọn màu mới', body, buttons: [], width: 760, icon: 'emoji-fluent-3d/game/magic_wand.png' });
    });
  }

  // human actions -------------------------------------------------------
  async function onMyCard(card) {
    const ctx = S.ctx, st = S.st, h = S.human;
    if (!h || h.busy || !st.hands[0].includes(card)) return;
    if (!R.canPlay(st, 0, card)) {
      const m = S.mine.get(card.id); ctx.sfx('error', .4);
      ctx.tween(m, { rz: m.rotation.z + .12 }, 70).then(() => ctx.tween(m, { rz: m.rotation.z - .2 }, 90)).then(() => layoutMine(120));
      ctx.ui.toast(st.drawnId >= 0 ? 'Chỉ được đánh lá vừa rút (hoặc GIỮ BÀI)' : card.v === 'draw4' && st.hands[0].some(c => c.c === st.color) ? `Còn lá màu ${R.COLOR_NAME[st.color]} nên chưa được đánh +4` : 'Lá này không hợp màu / số', 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png');
      return;
    }
    h.busy = true; refreshButtons();
    let color = null;
    if (card.c === 'wild') { layoutMine(); color = await pickColor(); }
    const ev = R.play(st, 0, card.id, color);
    await applyPlay(ev, S.test);
    finishHuman();
  }
  async function onDraw() {
    const st = S.st, h = S.human;
    if (!h || h.busy || st.drawnId >= 0) return;
    h.busy = true; refreshButtons();
    const d = R.drawTurn(st, 0);
    await animDraw(0, d.card ? [d.card] : []);
    if (d.playable) { h.busy = false; layoutMine(); refreshButtons(); status('đánh lá vừa rút hoặc <b>GIỮ BÀI</b>'); }
    else { if (!d.card) S.ctx.ui.toast('Hết bài để rút · qua lượt', 'emoji-fluent-3d/game/joker.png'); finishHuman(); }
  }
  function onPass() { const st = S.st, h = S.human; if (!h || h.busy || st.drawnId < 0) return; R.pass(st, 0); finishHuman(); }
  function onUno() {
    const st = S.st; if (!st || !R.callUno(st, 0)) return;
    S.ctx.ui.callout('UNO!', '#8d6bff'); S.ctx.sfx('jingle', .45); S.ctx.ui.toast('Bạn đã hô UNO! ☝️', 'emoji-fluent-3d/game/party_popper.png'); refreshButtons();
  }
  function onCatch() {
    const st = S.st; if (!S.catchOpen || S.catchClicked) return;
    const target = st.unoPending; S.catchClicked = true;
    const c = R.catchUno(st, 0);
    if (c) { S.catches++; S.ctx.ui.callout('BẮT ĐƯỢC!', '#c2407a'); say(target, 'Á á, quên mất 😭'); animDraw(target, c.cards); }
    S.catchOpen = false; refreshButtons();
  }
  function finishHuman() { const h = S.human; S.human = null; S.drawHint = false; layoutMine(); refreshButtons(); if (h) h.resolve(); }
  function humanTurn() {
    return new Promise(resolve => {
      S.human = { resolve, busy: false };
      layoutMine(); refreshButtons();
      const st = S.st, legal = R.legalMoves(st, 0).length;
      status(legal ? 'chạm lá sáng để đánh' : 'hết lá hợp · <b>RÚT BÀI</b>');
      if (S.st.hands[0].length === 2 && legal && !st.unoCalled[0]) S.ctx.ui.toast('Còn 2 lá: nhớ bấm UNO! trước khi đánh', 'emoji-fluent-3d/symbols/speech_balloon.png');
    });
  }

  /** Auto-play your seat (self-test, demo) through the real UI: card clicks, buttons, the colour picker. */
  async function drive(test) {
    const ctx = S.ctx, st = S.st, h = S.human;
    await ctx.wait(test ? 160 : 500);
    if (S.human !== h || !h) return;
    const click = id => { const b = A && A.btn(id); if (b) b.click(); };
    const chooseColour = c => { (async () => { for (let i = 0; i < 40; i++) { const e = document.querySelector('.bmcol[data-c="' + c + '"]'); if (e) { e.click(); return; } await ctx.wait(50); } })(); };
    let m = R.botMove(st, 0, ctx.rand);
    if (!m) {
      click('draw');
      for (let i = 0; i < 200 && S.human === h && h.busy; i++) await ctx.wait(40);
      if (S.human !== h) return;                                   // drawn card was not playable: turn over
      const c = st.hands[0].find(x => x.id === st.drawnId);
      if (!c || (R.isWild(c) && ctx.rand() < .3)) { click('pass'); return; }
      m = { id: c.id, color: R.isWild(c) ? R.bestColor(st.hands[0].filter(x => x !== c), ctx.rand) : null };
    }
    if (R.canCallUno(st, 0)) { if (S.forgetOnce) S.forgetOnce = false; else click('uno'); }
    const card = st.hands[0].find(x => x.id === m.id);
    if (R.isWild(card)) chooseColour(m.color);
    onMyCard(card);
  }

  // bots ------------------------------------------------------------------
  async function botTurn(p, test) {
    const ctx = S.ctx, st = S.st, s = S.seats[p];
    status('đang suy nghĩ…');
    s.anim('think');
    await ctx.wait(test ? 260 : 650 + ctx.rand() * 600);
    let m = R.botMove(st, p, ctx.rand);
    if (!m) {
      const d = R.drawTurn(st, p);
      await animDraw(p, d.card ? [d.card] : []);
      if (!d.playable) { say(p, ctx.pick(['Rút thôi…', 'Không có lá nào 😅', 'Hên xui nè'])); return; }
      await ctx.wait(test ? 120 : 380);
      m = { id: d.card.id, color: R.isWild(d.card) ? R.bestColor(st.hands[p].filter(c => c.id !== d.card.id), ctx.rand) : null };
    }
    if (R.canCallUno(st, p) && ctx.rand() < (test ? .7 : .82)) R.callUno(st, p);    // bots sometimes forget
    const ev = R.play(st, p, m.id, m.color);
    await applyPlay(ev, test);
  }

  // ------------------------------------------------------------------ one game
  async function game(ctx, test) {
    if (!S) await setup(ctx);
    const T = ctx.THREE, auto = !!(test && test.auto), demo = ctx.Q.has('demo') && !auto;
    // clear the previous game
    for (const m of S.mine.values()) { m.userData.unpick(); ctx.remove(m); }
    S.mine.clear(); S.discard.forEach(m => ctx.remove(m)); S.discard = []; S.loose.forEach(o => ctx.remove(o)); S.loose = [];
    for (let i = 1; i < 4; i++) { S.fans[i].cards.forEach(c => S.fans[i].holder.remove(c)); S.fans[i].cards = []; }
    S.st = null; S.pot = 0; S.dir = 1; S.catches = 0; S.test = auto; S.forgetOnce = auto;   // the self-test forgets UNO once to exercise the catch S.colTarget = new T.Color(0xffffff); side(); refreshTags(); refreshDrawPile();
    S.seats.forEach(s => s.turn(false));
    // ---- stake
    let stake = 0;
    await new Promise(res => {
      ctx.ui.status('Chọn mức cược bên trái rồi bấm <b>CHƠI</b> · ai hết bài trước ăn cả hũ');
      const chips = ctx.ui.chipPicker(STAKES, null, 2);
      const a = ctx.ui.actions([{ id: 'go', label: 'CHƠI', cls: 'pink', icon: 'emoji-fluent-3d/game/joker.png', onClick: () => { if (ctx.spend(chips.value)) { stake = chips.value; chips.el.remove(); res(); } } }]);
      if (auto || demo) a.btn('go').click();
    });
    ctx.ui.clearActions();
    // everyone pays the stake into the pot
    const ins = S.seats.map(s => { const p = s.me ? new T.Vector3(0, 0, 4.4) : s.spot(0, 2.6); return ctx.stack(stake, p.x, p.z); });
    await Promise.all(ins.map(g => ctx.moveStack(g, POT.x, POT.z, 520, true)));
    S.potStack = ctx.stack(stake * 4, POT.x, POT.z); S.loose.push(S.potStack); S.pot = stake * 4;
    // ---- deal
    S.dealer = (S.dealer + 1) % 4;
    const hs = test && test.handSize || 7;
    const st = S.st = R.newGame({ dealer: test && test.dealer != null ? test.dealer : S.dealer, rng: ctx.rand, deck: test && test.deck, handSize: hs }); S.seenReshuffles = 0;
    side(); refreshDrawPile();
    ctx.sfx('shuffle', .5);
    for (let k = 0; k < hs; k++) {
      for (let j = 1; j <= 4; j++) {
        const p = (st.dealer + j) % 4, card = st.hands[p][k];
        const from = drawTop();
        if (p === 0) { const m = addMine(card); m.position.copy(from); m.rotation.set(0, 0, Math.PI); ctx.add(m); ctx.tween(m, { x: 0, y: 2, z: 3.4, arc: .6 }, 160, 'out'); }
        else { const m = mk(null, .95); m.position.copy(from); ctx.add(m); const to = fanPos(p); ctx.tween(m, { x: to.x, y: to.y, z: to.z, ry: S.seats[p].facing, arc: .6 }, 170, 'out').then(() => { ctx.remove(m); fanAdd(p); refreshTags(); }); }
        await ctx.wait(45);
      }
      if (k === 3) layoutMine(200);
    }
    await ctx.wait(200); layoutMine(260); refreshTags();
    // the first card
    const first = R.top(st), fm = mk(first); fm.position.copy(drawTop()); fm.rotation.set(0, 0, Math.PI); ctx.add(fm);
    await toDiscard(fm); setColor(st.color); setDir(st.dir);
    const se = st.start;
    if (se.skipped != null) { ctx.ui.float('MẤT LƯỢT', seatPos(se.skipped).add(new T.Vector3(0, .8, 0))); say(se.skipped, 'Lá đầu là Cấm 😵'); }
    if (se.reversed) ctx.ui.float('ĐẢO CHIỀU', new T.Vector3(RING.x, 1, RING.z));
    if (se.victim != null) { ctx.ui.float('+2', seatPos(se.victim).add(new T.Vector3(0, .8, 0))); await animDraw(se.victim, se.drawn); }
    refreshDrawPile(); refreshTags();
    // ---- play
    A = ctx.ui.actions([
      { id: 'draw', label: 'RÚT BÀI', cls: 'sky', icon: 'emoji-fluent-3d/game/joker.png', onClick: onDraw },
      { id: 'pass', label: 'GIỮ BÀI', cls: 'grey', onClick: onPass },
      { id: 'uno', label: 'UNO!', cls: 'lemon', icon: 'emoji-fluent-3d/hands/index_pointing_up.png', onClick: onUno },
      { id: 'catch', label: 'BẮT!', cls: 'pink', icon: 'emoji-fluent-3d/hands/raising_hands.png', onClick: onCatch },
    ]);
    S.onDraw = onDraw; refreshButtons();
    let guard = 0;
    while (!st.over && guard++ < 3000) {
      const p = st.turn;
      setTurn(p); status();
      if (p === 0) { const turn = humanTurn(); if (auto || (demo && st.turns < DEMO_TURNS)) drive(auto); await turn; }
      else await botTurn(p, auto);
      refreshButtons(); refreshDrawPile(); refreshTags();
      await ctx.wait(auto ? 60 : 260);
    }
    ctx.ui.clearActions(); A = null; S.onDraw = null; S.human = null;
    S.seats.forEach(s => s.turn(false));
    // ---- settle: winner takes the pot, show everyone's points
    const sc = R.score(st), deltas = R.settle(4, st.winner, stake), w = st.winner, ws = S.seats[w];
    const visual = S.mine.size === st.hands[0].length && [1, 2, 3].every(i => S.fans[i].cards.length === st.hands[i].length) && S.discard.length > 0 && S.discard[S.discard.length - 1].userData.cid === R.top(st).id;
    ctx.ui.status(`<b>${w === 0 ? 'Bạn' : ws.name}</b> hết bài · ăn hũ ${HC.short(S.pot)} · ${sc.points} điểm`);
    // reveal the bots' cards on the table in front of them
    for (let i = 1; i < 4; i++) {
      const f = S.fans[i]; f.cards.forEach(c => f.holder.remove(c)); f.cards = [];
      st.hands[i].forEach((c, k) => { const m = mk(c, .8), n = st.hands[i].length, sp = S.seats[i].spot((k - (n - 1) / 2) * Math.min(.62, 5.4 / n), 1.35); m.position.copy(fanPos(i)); m.rotation.set(0, S.seats[i].facing, Math.PI); ctx.add(m); S.loose.push(m); ctx.tween(m, { x: sp.x, y: .03 + k * .004, z: sp.z, rz: 0, arc: .6 }, 380, 'out'); });
    }
    refreshTags(); S.fans.forEach(f => f && (f.tag.el.style.display = 'none'));
    await ctx.wait(500);
    const to = w === 0 ? new T.Vector3(0, 0, 4.6) : S.seats[w].spot(0, 2.4);
    await ctx.moveStack(S.potStack, to.x, to.z, 650, true);
    const myDelta = deltas[0];
    if (w === 0) { ctx.win(stake * 4, new T.Vector3(0, 1, 4.4)); ctx.ui.callout('THẮNG!'); ctx.ui.confetti(); ctx.sfx('win', .5); }
    else { ctx.sfx('lose', .35); ws.anim('cheer'); ws.say('Hết bài! 🎉'); }
    for (let i = 1; i < 4; i++) { S.seats[i].setCoins(S.seats[i].coins + deltas[i]); if (i !== w) S.seats[i].anim('sad'); }
    const rows = S.seats.map((s, i) => ({
      name: s.name + (s.me ? ' (bạn)' : ''), avatar: s.avatar, me: s.me, amount: deltas[i], tag: i === w ? 'Hết bài' : null,
      detail: i === w ? `Thắng · ăn <b>${sc.points}</b> điểm từ bài còn lại` : `Còn ${st.hands[i].length} lá · ${sc.per[i]} điểm`,
    }));
    rows.sort((a, b) => b.amount - a.amount);
    const result = { winner: w, winnerName: ws.name, turns: st.turns, points: sc.points, stake, myDelta, cards: R.countCards(st), visual, reason: st.reason, catches: S.catches, reshuffles: st.reshuffles };
    if (!auto) await ctx.ui.results(w === 0 ? 'Bạn thắng! 🎉' : ws.name + ' thắng ván này', rows, { again: 'Ván mới' });
    return result;
  }
})();
