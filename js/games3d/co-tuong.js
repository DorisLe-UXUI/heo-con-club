/* Cờ Tướng 3D — you play Red (near side, moves first) against a bot playing Blue ("quân Xanh", far side).
 * Rules + alpha-beta AI live in js/games3d/rules/co-tuong.js; this file is the 3D table, input and flow. */
(function () {
  'use strict';
  const KEY = 'co-tuong';
  // ct_board art: 860 × 950 px, intersections every 90 px starting 70 px from the left/top edge
  const P = 1.08, BW = 860 / 90 * P, BD = 950 / 90 * P;
  const Y_BOARD = .14, PR = .48, PH = .27;                 // board surface height, piece radius / thickness
  const STAKES = [5000, 10000, 50000, 100000, 500000];
  const sx = c => (c - 4) * P, sz = r => (r - 4.5) * P;
  const REASON = { checkmate: 'Chiếu bí', stalemate: 'Hết nước đi', repetition: 'Lặp lại thế cờ 3 lần', quiet: '60 nước liền không ăn quân', material: 'Hai bên hết quân tấn công', resign: 'Đầu hàng', agreed: 'Hai bên đồng ý hoà' };

  T3.register(KEY, {
    title: 'Cờ Tướng', sub: 'Đấu trí với bot · chiếu bí Tướng Xanh để thắng',
    table: 'board', theme: 'pink', tex: ['co-tuong', 'chips'], scripts: ['js/games3d/rules/co-tuong.js'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    rules: `<p>Bạn cầm quân <b>Đỏ</b> và đi trước, bot cầm quân <b>Xanh</b>. Chọn mức cược rồi bấm <b>VÀO VÁN</b>: thắng nhận lại <b>gấp đôi</b> tiền cược, hoà được trả lại cược, thua mất cược.</p>
      <ul><li><b>Tướng</b> đi 1 ô ngang/dọc trong cung (ô 3×3 có gạch chéo). <b>Sĩ</b> đi chéo 1 ô trong cung.</li>
      <li><b>Tượng</b> đi chéo 2 ô, không được qua sông, bị chặn nếu có quân ở giữa (mắt tượng).</li>
      <li><b>Mã</b> đi 1 ô thẳng rồi 1 ô chéo, bị cản nếu có quân đứng sát chân mã.</li>
      <li><b>Xe</b> đi thẳng bao xa cũng được. <b>Pháo</b> đi như Xe, muốn ăn phải nhảy qua đúng 1 quân (ngòi).</li>
      <li><b>Tốt</b> đi thẳng 1 ô; qua sông rồi được đi ngang, không bao giờ đi lùi.</li>
      <li>Hai Tướng không được nhìn mặt nhau trên một cột trống (lộ mặt tướng). Không được đi nước làm Tướng mình bị chiếu.</li>
      <li>Bị <b>chiếu bí</b> hoặc <b>hết nước đi</b> là thua. Hoà khi lặp lại thế cờ 3 lần, 60 nước liền không ăn quân, hoặc cả hai hết quân tấn công.</li>
      <li><b>Đi lại</b>: lùi nước của bạn và của bot. <b>Xin hoà</b>: bot chỉ đồng ý khi nó không ở thế thắng. <b>Đầu hàng</b>: thua ván.</li>
      <li>Sức bot theo bàn chọn ở sảnh: <b>Tập Sự</b> nhìn trước 2 nước, <b>Bình Dân</b> 4 nước, <b>Cao Thủ</b> và <b>Đại Gia</b> tính sâu, <b>Hoàng Gia</b> nghĩ lâu và sâu nhất.</li></ul>`,
    async start(ctx) {
      const S = await setup(ctx);
      if (ctx.Q.has('demo')) await game(ctx, S, { stake: 10000, script: demoScript(S) });   // &demo=1: auto-play a few moves
      for (;;) await game(ctx, S, {});
    },
    async selftest(ctx) { return selftest(ctx); },
  });

  // ------------------------------------------------------------------ camera: fit the board between the HUD bars
  function fitCamera(ctx, pts, o) {
    const T = ctx.THREE, cam = ctx.camera.clone(), look = new T.Vector3(...o.look);
    const dir = new T.Vector3(0, Math.sin(o.elev), Math.cos(o.elev));
    const top = 1 - 2 * o.top / ctx.UH, bot = -1 + 2 * o.bottom / ctx.UH, side = 1 - 2 * o.side / ctx.UW;
    const test = (lz, D) => {
      const L = look.clone(); L.z += lz; cam.position.copy(L).addScaledVector(dir, D); cam.lookAt(L); cam.updateMatrixWorld();
      let ok = true;
      for (const p of pts) { const v = p.clone().project(cam), t = p.top != null ? 1 - 2 * p.top / ctx.UH : top; if (Math.abs(v.x) > side || v.y > t || v.y < bot) ok = false; }
      return { ok, L };
    };
    let best = null;
    for (let lz = -3; lz <= 3.001; lz += .25) {
      let a = 4, b = 90; for (let k = 0; k < 26; k++) { const m = (a + b) / 2; if (test(lz, m).ok) b = m; else a = m; }
      if (!best || b < best.D) best = { D: b, lz };
    }
    const L = look.clone(); L.z += best.lz;
    ctx.camTo({ pos: L.clone().addScaledVector(dir, best.D).toArray(), look: L.toArray() }, 0);
    if (ctx.scene.fog) { ctx.scene.fog.near = best.D + 14; ctx.scene.fog.far = best.D + 70; }   // keep the board itself out of the room fog
  }
  function autoFit(ctx, pts, o) {
    let key = '';
    ctx.onFrame(() => { const k = ctx.camera.aspect.toFixed(3) + ':' + ctx.camera.fov.toFixed(2) + ':' + Math.round(ctx.UH); if (k !== key) { key = k; fitCamera(ctx, pts, o); } });
  }

  // ------------------------------------------------------------------ table setup (once)
  async function setup(ctx) {
    const T = ctx.THREE, H = ctx.H, R = window.Rules[KEY];
    ctx.music('board');
    const S = { ctx, R, at: new Array(90).fill(null), trays: [[], []], marks: [], meshes: [] };
    // board: a soft plate with the ct_board art on top
    const plate = new T.Mesh(H.roundedBox(BW + .36, .2, BD + .36, .16, 3), ctx.mat(0xffc2dc, { roughness: .45 }));
    plate.position.y = Y_BOARD - .1; plate.castShadow = true; plate.receiveShadow = true; ctx.add(plate);
    const art = new T.Mesh(new T.PlaneGeometry(BW, BD), new T.MeshStandardMaterial({ map: ctx.tex('ct_board'), color: 0x6e6e6e, roughness: 1, transparent: true, alphaTest: .4, toneMapped: false }));
    art.rotation.x = -Math.PI / 2; art.position.y = Y_BOARD + .002; art.receiveShadow = true; ctx.add(art);
    // trays for captured pieces (right: Blue pieces you took, left: Red pieces the bot took)
    for (const sgn of [1, -1]) {
      const tray = new T.Mesh(H.roundedBox(1.72, .08, 7.4, .04, 2), ctx.mat(0xfff4f9, { roughness: .5 })); tray.position.set(sgn * 6.55, -.01, 0); tray.receiveShadow = true; ctx.add(tray);
      const rim = new T.Mesh(H.roundedBox(1.86, .05, 7.54, .03, 2), ctx.mat(sgn > 0 ? 0x9cc8ff : 0xff9cc4, { roughness: .5 })); rim.position.set(sgn * 6.55, -.04, 0); ctx.add(rim);
    }
    // shared piece geometry: lathe body + top disc whose UVs crop the painted top face of the ct_* art
    const prof = [[0, 0], [PR - .05, 0], [PR, .05], [PR, PH - .06], [PR - .015, PH - .015], [PR - .05, PH]].map(([x, y]) => new T.Vector2(x, y));
    const sideGeo = new T.LatheGeometry(prof, 48);
    const TOP_R = PR - .045, topGeo = new T.CircleGeometry(TOP_R, 48);
    { const uv = topGeo.attributes.uv, pos = topGeo.attributes.position; for (let i = 0; i < uv.count; i++) { const x = pos.getX(i) / TOP_R, y = pos.getY(i) / TOP_R; uv.setXY(i, (91 + 79 * x) / 182, 1 - (82 - 73 * y) / 182); } }
    const sideMat = { 1: ctx.mat(0xd9518f, { roughness: .4 }), '-1': ctx.mat(0x4a7fd0, { roughness: .4 }) };
    const topMat = {};
    S.makePiece = p => {
      const red = p > 0, name = R.NAMES[Math.abs(p)], k = (red ? 'ct_red_' : 'ct_black_') + name;
      const g = new T.Group();
      const body = new T.Mesh(sideGeo, sideMat[red ? 1 : -1]); body.castShadow = true; body.receiveShadow = true; g.add(body);
      const top = new T.Mesh(topGeo, topMat[k] || (topMat[k] = new T.MeshBasicMaterial({ map: ctx.tex(k), color: 0xf2f2f2, toneMapped: false })));
      top.rotation.x = -Math.PI / 2; top.position.y = PH + .001; top.receiveShadow = true; g.add(top);
      g.userData.p = p; return g;
    };
    // markers
    const mk = (geo, color, opacity) => { const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; return m; };
    S.dotGeo = new T.CircleGeometry(.21, 28); S.dotRing = new T.RingGeometry(.21, .27, 28); S.ringGeo = new T.RingGeometry(PR + .05, PR + .15, 44); S.capGeo = new T.RingGeometry(PR + .03, PR + .2, 44); S.smallRing = new T.RingGeometry(.14, .22, 28);
    S.mk = mk;
    S.lastFrom = mk(S.smallRing, 0xffb81c, .9); S.lastTo = mk(S.ringGeo, 0xffc93c, .85); S.lastFrom.visible = S.lastTo.visible = false; ctx.add(S.lastFrom); ctx.add(S.lastTo);
    S.selRing = mk(S.ringGeo, 0xfff27a, .95); S.selRing.visible = false; ctx.add(S.selRing);
    S.checkRing = mk(new T.RingGeometry(PR + .04, PR + .24, 44), 0xff2d55, .9); S.checkRing.visible = false; ctx.add(S.checkRing);
    ctx.onFrame((dt, t) => {
      const k = .5 + .5 * Math.sin(t * 6);
      for (const m of S.marks) { m.material.opacity = m.userData.cap ? .6 + .4 * k : .82 + .18 * k; m.scale.setScalar(m.userData.cap ? 1 + .06 * k : .92 + .16 * k); }
      if (S.checkRing.visible) { S.checkRing.material.opacity = .45 + .5 * k; S.checkRing.scale.setScalar(1 + .1 * k); }
    });
    // input: one invisible plane at piece-top height; snap clicks to the nearest intersection
    const pick = new T.Mesh(new T.PlaneGeometry(BW, BD), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    pick.rotation.x = -Math.PI / 2; pick.position.y = Y_BOARD + PH; ctx.add(pick);
    ctx.pickable(pick, pt => {
      const c = Math.round(pt.x / P + 4), r = Math.round(pt.z / P + 4.5);
      if (r < 0 || r > 9 || c < 0 || c > 8 || Math.hypot(pt.x - sx(c), pt.z - sz(r)) > P * .62) return;
      S.click(r, c);
    });
    // seats: you (near) and the bot (far side, behind the Blue pieces)
    S.seats = await ctx.seats(2, { angles: [90, 270], r: 6.3 });
    S.me = S.seats[0]; S.bot = S.seats[1];
    S.bot.label.el.insertAdjacentHTML('beforeend', '<i>Quân Xanh</i>');
    const fitPts = [[-BW / 2 - .2, Y_BOARD, -BD / 2 - .2], [BW / 2 + .2, Y_BOARD, -BD / 2 - .2], [-BW / 2 - .2, Y_BOARD, BD / 2 + .2], [BW / 2 + .2, Y_BOARD, BD / 2 + .2], [-7.4, 0, -3.8], [7.4, 0, 3.8], [-7.4, 0, 3.8], [7.4, 0, -3.8]].map(a => new T.Vector3(...a));
    const head = new T.Vector3(0, 3.1, -7.5); head.top = 100; fitPts.push(head);            // bot name label stays on screen
    autoFit(ctx, fitPts, { elev: 63 * Math.PI / 180, look: [0, 0, 0], top: 126, bottom: 166, side: 24 });
    return S;
  }

  // ------------------------------------------------------------------ pieces on the board
  function place(S, pos, animate) {
    const ctx = S.ctx;
    S.meshes.forEach(m => ctx.remove(m)); S.meshes = []; S.at.fill(null); S.trays = [[], []];
    const drops = [];
    for (let s = 0; s < 90; s++) {
      const p = pos.b[s]; if (!p) continue;
      const m = S.makePiece(p), r = S.R.rowOf(s), c = S.R.colOf(s);
      m.position.set(sx(c), Y_BOARD, sz(r)); ctx.add(m); S.at[s] = m; S.meshes.push(m);
      if (animate) { m.position.y = Y_BOARD + 3 + Math.random() * 1.5; drops.push(ctx.wait(Math.abs(r - 4.5) * 40 + Math.random() * 120).then(() => ctx.tween(m, { y: Y_BOARD }, 420, 'bounce'))); }
    }
    return Promise.all(drops);
  }
  function traySlot(side, k) { return side > 0 ? { x: 6.17 + (k % 2) * .76, z: 3.25 - Math.floor(k / 2) * .82 } : { x: -6.17 - (k % 2) * .76, z: -3.25 + Math.floor(k / 2) * .82 }; }
  /** Fly a captured piece into the tray of the side that captured it. */
  function knockOff(S, mesh, capturer) {
    const tray = S.trays[capturer > 0 ? 0 : 1], k = tray.length, t = traySlot(capturer, k);
    tray.push(mesh);
    S.ctx.sfx('pop', .55);
    return S.ctx.tween(mesh, { x: t.x, z: t.z, y: .03, arc: 2.4, rx: Math.PI * 2, s: .74 }, 650, 'out').then(() => { mesh.rotation.x = 0; });
  }
  function clearMarks(S) { S.marks.forEach(m => S.ctx.remove(m)); S.marks = []; S.selRing.visible = false; }
  function showLast(S, m) {
    const R = S.R, f = m >> 7, t = m & 127;
    S.lastFrom.position.set(sx(R.colOf(f)), Y_BOARD + .012, sz(R.rowOf(f))); S.lastTo.position.set(sx(R.colOf(t)), Y_BOARD + .012, sz(R.rowOf(t)));
    S.lastFrom.visible = S.lastTo.visible = true;
  }
  function showCheck(S, g) {
    const side = g.side, k = g.pos.ksq[side > 0 ? 0 : 1], on = k >= 0 && g.pos.inCheck(side);
    S.checkRing.visible = on;
    if (on) S.checkRing.position.set(sx(S.R.colOf(k)), Y_BOARD + .014, sz(S.R.rowOf(k)));
    return on;
  }
  /** Slide a piece, knocking off whatever it captures. */
  async function animateMove(S, m, capturer) {
    const ctx = S.ctx, R = S.R, f = m >> 7, t = m & 127, mesh = S.at[f], victim = S.at[t];
    S.at[f] = null;
    ctx.sfx('slide', .5);
    const slide = ctx.tween(mesh, { x: sx(R.colOf(t)), z: sz(R.rowOf(t)), y: Y_BOARD, arc: victim ? .9 : .45 }, 420, 'io');
    let knock = null;
    if (victim) { await ctx.wait(300); knock = knockOff(S, victim, capturer); }
    await slide; S.at[t] = mesh; ctx.sfx('card', .45);
    if (knock) await knock;
    return { mesh, victim };
  }
  async function animateUndo(S, h, capturer) {
    const ctx = S.ctx, R = S.R, f = h.m >> 7, t = h.m & 127, mesh = S.at[t];
    S.at[t] = null;
    const back = ctx.tween(mesh, { x: sx(R.colOf(f)), z: sz(R.rowOf(f)), y: Y_BOARD, arc: .45 }, 320, 'io');
    if (h.cap) {
      const tray = S.trays[capturer > 0 ? 0 : 1], v = tray.pop();
      await ctx.tween(v, { x: sx(R.colOf(t)), z: sz(R.rowOf(t)), y: Y_BOARD, s: 1, arc: 1.6 }, 420, 'out');
      S.at[t] = v;
    }
    await back; S.at[f] = mesh;
  }

  // ------------------------------------------------------------------ stake
  async function chooseStake(ctx, S, fixed) {
    if (fixed != null) { ctx.spend(fixed); return fixed; }
    const picker = ctx.ui.chipPicker(STAKES, null, S.stakeIdx || 1);
    ctx.ui.status('Chọn mức cược bên trái rồi bấm <b>VÀO VÁN</b>');
    const stake = await new Promise(res => {
      ctx.ui.actions([{ id: 'go', label: 'VÀO VÁN', cls: 'pink', icon: 'emoji-fluent-3d/game-items/chess_pawn.png', onClick: () => { if (ctx.spend(picker.value)) { S.stakeIdx = STAKES.indexOf(picker.value); res(picker.value); } } }]);
    });
    picker.el.remove(); ctx.ui.clearActions();
    return stake;
  }

  // ------------------------------------------------------------------ one game
  /** opts: { fen, stake, script(S, g, n) → called whenever you may act, demo } → { result: 'win'|'loss'|'draw', reason, stake, coinsDelta, plies } */
  async function game(ctx, S, opts = {}) {
    const R = S.R, T = ctx.THREE, fast = ctx.TEST || ctx.SHOT;
    clearMarks(S); S.lastFrom.visible = S.lastTo.visible = S.checkRing.visible = false;
    const g = new R.Game(opts.fen);
    await place(S, g.pos, !ctx.TEST);
    const coins0 = ctx.coins;
    const stake = await chooseStake(ctx, S, opts.stake);
    const pot = ctx.stack(stake * 2, 6.55, -4.55); pot.scale.setScalar(.8);
    S.bot.setCoins(S.bot.coins - stake);
    S.bot.say(ctx.pick(['Chơi nhẹ tay nha 😆', 'Đỏ đi trước đó!', 'Ván này mình thắng 😎', 'Mời bạn ra quân!']));
    let result = null, reason = '', actions = 0, botMoves = 0;
    const acts = ctx.ui.actions([
      { id: 'undo', label: 'Đi lại', cls: 'sky', icon: 'emoji-fluent-3d/hands/backhand_index_pointing_left.png', onClick: () => S.human && S.human({ type: 'undo' }) },
      { id: 'draw', label: 'Xin hoà', cls: 'mint', icon: 'emoji-fluent-3d/hands/handshake.png', onClick: () => S.human && S.human({ type: 'draw' }) },
      { id: 'resign', label: 'Đầu hàng', cls: 'grey', icon: 'emoji-fluent-3d/reactions/face_holding_back_tears.png', onClick: () => S.human && S.human({ type: 'resign' }) },
    ]);
    const setBtns = on => { acts.set('undo', { disabled: !on || g.hist.length < 2 }); acts.set('draw', { disabled: !on }); acts.set('resign', { disabled: !on }); };
    setBtns(false);

    // selection / click handling during your turn
    let legal = [], sel = -1;
    const select = s => {
      clearMarks(S);
      if (sel >= 0 && S.at[sel]) ctx.tween(S.at[sel], { y: Y_BOARD }, 140, 'out');
      sel = s; if (s < 0) { status(); return; }
      const mesh = S.at[s]; ctx.tween(mesh, { y: Y_BOARD + .28 }, 160, 'out'); ctx.sfx('tick', .4);
      S.selRing.position.set(mesh.position.x, Y_BOARD + .013, mesh.position.z); S.selRing.visible = true;
      for (const m of legal) {
        if ((m >> 7) !== s) continue;
        const t = m & 127, cap = !!g.pos.b[t];
        const mark = cap ? S.mk(S.capGeo, 0xff3d7f, .95) : S.mk(S.dotGeo, 0x12c27e, .95);
        if (!cap) { const halo = S.mk(S.dotRing, 0xffffff, .95); halo.rotation.x = 0; halo.position.z = .001; mark.add(halo); }
        mark.userData.cap = cap; mark.position.set(sx(R.colOf(t)), Y_BOARD + .015, sz(R.rowOf(t))); ctx.add(mark); S.marks.push(mark);
      }
      ctx.ui.status(`<b>${R.VI[g.pos.b[s]]}</b> · chạm vào ô sáng để đi`);
    };
    const status = () => ctx.ui.status(g.pos.inCheck(1) ? 'Bạn đang bị <b>chiếu</b>! Hãy gỡ chiếu' : 'Lượt của bạn · chạm vào quân <b>Đỏ</b>');
    S.click = (r, c) => {
      if (!S.human) return;
      const s = R.sq(r, c);
      if (sel >= 0) { const m = legal.find(x => (x >> 7) === sel && (x & 127) === s); if (m != null) { const res = S.human; res({ type: 'move', m }); return; } }
      const p = g.pos.b[s];
      if (p > 0) { if (!legal.some(x => (x >> 7) === s)) { ctx.sfx('error', .3); ctx.ui.toast(`${R.VI[p]} không có nước đi nào`, 'emoji-fluent-3d/reactions/thinking_face.png'); return select(-1); } return select(s === sel ? -1 : s); }
      select(-1);
    };
    const afterMove = (info, mover) => {
      const chk = showCheck(S, g);
      if (chk) {
        ctx.ui.callout('CHIẾU TƯỚNG!', mover > 0 ? '#c2407a' : '#2a6fd0'); ctx.sfx('power', .5);
        if (mover < 0) S.bot.say(ctx.pick(['Chiếu tướng! 😎', 'Chiếu nè!', 'Tướng ơi chạy đi 😏'])); else { S.bot.say(ctx.pick(['Ối dồi ôi 😱', 'Hừm… để xem', 'Á, bị chiếu rồi'])); S.bot.anim('sad'); }
      } else if (info.cap) {
        if (mover < 0) S.bot.say(ctx.pick(['Măm măm 😋', `Ăn ${R.VI[Math.abs(info.cap)]} nhé!`, 'Cảm ơn nha 😎'])); else if (Math.abs(info.cap) >= 4) S.bot.say(ctx.pick(['Ui da 😣', `Mất ${R.VI[Math.abs(info.cap)]} rồi…`, 'Bạn ác quá 😭']));
      }
    };

    // main loop
    while (!result) {
      const st = g.status();
      if (st.over) { result = st.winner === 0 ? 'draw' : st.winner > 0 ? 'win' : 'loss'; reason = REASON[st.reason]; break; }
      if (g.side > 0) {
        // ---- your turn
        legal = g.legal(); sel = -1; status(); S.me.turn(true); setBtns(true);
        const act = await new Promise(res => { S.human = res; if (opts.script) Promise.resolve().then(() => opts.script(S, g, actions++)); });
        S.human = null; clearMarks(S); S.me.turn(false); setBtns(false);
        if (act.type !== 'move' && sel >= 0 && S.at[sel]) ctx.tween(S.at[sel], { y: Y_BOARD }, 140, 'out');
        if (act.type === 'move') {
          const info = g.play(act.m);
          await animateMove(S, act.m, 1); showLast(S, act.m); afterMove(info, 1);
        } else if (act.type === 'undo') {
          for (let k = 0; k < 2 && g.hist.length; k++) { const mover = g.side > 0 ? -1 : 1, h = g.undo(); await animateUndo(S, h, mover); }
          S.lastFrom.visible = S.lastTo.visible = false; if (g.hist.length) showLast(S, g.hist[g.hist.length - 1].m); showCheck(S, g);
          ctx.ui.toast('Đã đi lại một nước', 'emoji-fluent-3d/hands/backhand_index_pointing_left.png');
        } else if (act.type === 'draw') {
          S.bot.anim('think'); ctx.ui.status('Bot đang cân nhắc lời xin hoà…'); await ctx.wait(500);
          if (R.acceptsDraw(g.pos, -1, fast ? { maxNodes: 20000 } : {})) { S.bot.say('Hoà thì hoà 🤝'); result = 'draw'; reason = REASON.agreed; }
          else { S.bot.say(ctx.pick(['Chưa đâu nha 😏', 'Không hoà! Mình đang ngon mà', 'Đánh tiếp đi bạn ơi 😆'])); ctx.ui.toast('Bot không đồng ý hoà', 'emoji-fluent-3d/hands/handshake.png'); }
        } else if (act.type === 'resign') {
          let sure = true;
          if (!opts.script) sure = (await ctx.ui.modal({ title: 'Đầu hàng?', html: '<p>Bạn sẽ thua ván này và mất tiền cược.</p>', width: 760, buttons: [{ label: 'Đầu hàng', cls: 'pink' }, { label: 'Chơi tiếp', cls: 'grey' }] })) === 'Đầu hàng';
          if (sure) { result = 'loss'; reason = REASON.resign; }
        }
      } else {
        // ---- bot turn
        S.bot.turn(true); S.bot.anim('think'); ctx.ui.status(`<b>${S.bot.name}</b> đang suy nghĩ…`);
        await ctx.wait(fast ? 120 : 380);
        const lv = ctx.room ? ctx.aiLevel(1) : null, STR = [{ timeMs: 120, maxDepth: 2, maxNodes: 4000 }, { timeMs: 300, maxDepth: 4, maxNodes: 120000 }, { timeMs: 600, maxDepth: 9, maxNodes: 700000 }, { timeMs: 1200, maxDepth: 12, maxNodes: 1600000 }];
        const r = R.search(g.pos, Object.assign(fast ? { timeMs: 150, maxDepth: 3, maxNodes: 25000 } : lv == null ? { timeMs: 600, maxDepth: 9, maxNodes: 700000 } : STR[lv], { seen: g.seen() }));   // room tier → bot strength
        const info = g.play(r.move);            // throws if the move were illegal
        botMoves++;
        await animateMove(S, r.move, -1); showLast(S, r.move); afterMove(info, -1);
        S.bot.turn(false);
      }
    }
    // ---- settle
    setBtns(false); ctx.ui.clearActions(); S.checkRing.visible = false;
    const amount = result === 'win' ? stake : result === 'loss' ? -stake : 0;
    if (result === 'win') { ctx.win(stake * 2, new T.Vector3(0, 1, 3)); ctx.ui.callout('THẮNG!'); ctx.ui.confetti(); ctx.sfx('win', .5); S.bot.anim('sad'); S.bot.say('Bạn giỏi quá 😭'); S.bot.setCoins(S.bot.coins); }
    else if (result === 'draw') { ctx.win(stake, new T.Vector3(0, 1, 3)); ctx.ui.callout('HOÀ', '#2a7fd0'); S.bot.anim('wave'); S.bot.setCoins(S.bot.coins + stake); }
    else { ctx.sfx('lose', .4); S.bot.anim('cheer'); S.bot.say('Hehe thắng rồi 🎉'); S.bot.setCoins(S.bot.coins + stake * 2); }
    ctx.remove(pot);
    ctx.ui.status(result === 'win' ? 'Bạn thắng! 🎉' : result === 'draw' ? 'Ván cờ hoà' : 'Bạn thua ván này');
    const out = { result, reason, stake, coinsDelta: ctx.coins - coins0, plies: g.hist.length, botMoves, synced: consistent(S, g.pos), fen: S.R.toFen(g.pos) };
    const rows = [
      { name: S.me.name + ' (bạn)', avatar: S.me.avatar, me: true, detail: `Quân Đỏ · ${reason}`, amount, tag: result === 'win' ? 'Thắng' : null },
      { name: S.bot.name, avatar: S.bot.avatar, detail: `Quân Xanh · ${g.hist.length} nước`, amount: -amount, tag: result === 'loss' ? 'Thắng' : null },
    ];
    const title = result === 'win' ? 'Bạn thắng!' : result === 'loss' ? 'Thua rồi' : 'Hoà cờ';
    if (ctx.TEST) { ctx.ui.results(title, rows); await ctx.wait(300); ctx.ui.closeModal(); }
    else await ctx.ui.results(title, rows, { again: 'Ván mới' });
    return out;
  }

  // ------------------------------------------------------------------ demo + self-test drivers
  /** Demo: quick moves for a few turns, then select a piece so the legal-move markers show. */
  function demoScript(S) {
    return async (S2, g, n) => {
      const R = S.R;
      if (n < 4) {
        await S.ctx.wait(150);
        const m = R.search(g.pos, { timeMs: 120, maxDepth: 2, maxNodes: 6000 }).move;
        S.click(R.rowOf(m >> 7), R.colOf(m >> 7)); await S.ctx.wait(200); S.click(R.rowOf(m & 127), R.colOf(m & 127));
      } else {
        S.demoDone = true;
        const legal = g.legal(), from = [...new Set(legal.map(m => m >> 7))].sort((a, b) => legal.filter(m => m >> 7 === b).length - legal.filter(m => m >> 7 === a).length);
        const pick = from.find(s => Math.abs(g.pos.b[s]) === R.N || Math.abs(g.pos.b[s]) === R.C) || from[0];
        S.click(R.rowOf(pick), R.colOf(pick));
      }
    };
  }
  /** 3D pieces match the rules position exactly. */
  function consistent(S, pos) { for (let s = 0; s < 90; s++) { const m = S.at[s]; if ((m ? m.userData.p : 0) !== pos.b[s]) return false; if (m && (Math.abs(m.position.x - sx(S.R.colOf(s))) > .01 || Math.abs(m.position.z - sz(S.R.rowOf(s))) > .01)) return false; } return true; }
  async function selftest(ctx) {
    const S = await setup(ctx), R = S.R, out = { games: [], checks: {} };
    const c0 = ctx.coins, stake = 10000;
    const clickMove = async (fr, fc, tr, tc) => { S.click(fr, fc); await ctx.wait(50); S.click(tr, tc); };
    // A. mate in one for Red: chariot a7 → a9 (row 2 → row 0)
    const A = await game(ctx, S, { fen: '4k4/8R/R8/9/9/9/9/9/9/3K5 w', stake, script: async () => clickMove(2, 0, 0, 0) });
    out.games.push(A); out.checks.mateWin = A.result === 'win' && A.coinsDelta === stake;
    // B. a normal opening move, the bot replies (legal by construction: Game.play throws otherwise), then resign
    const B = await game(ctx, S, { stake, script: async (S2, g, n) => { if (n === 0) clickMove(7, 1, 7, 4); else S.human({ type: 'resign' }); } });
    out.games.push(B); out.checks.resignLoss = B.result === 'loss' && B.coinsDelta === -stake && B.botMoves === 1 && B.plies === 2;
    // C. draw offer in the opening: accepted, stake returned
    const C = await game(ctx, S, { stake, script: async () => S.human({ type: 'draw' }) });
    out.games.push(C); out.checks.drawAccepted = C.result === 'draw' && C.coinsDelta === 0;
    // D. draw offer while the bot is a chariot up: refused; then the undo button on an empty history is a no-op; resign
    const D = await game(ctx, S, { fen: '3k5/9/9/r8/9/9/9/9/9/4K4 w', stake, script: async (S2, g, n) => { if (n === 0) S.human({ type: 'draw' }); else S.human({ type: 'resign' }); } });
    out.games.push(D); out.checks.drawRefused = D.result === 'loss' && D.coinsDelta === -stake;
    // E. undo: play a move, bot replies, undo both → back to the start position, then mate is not possible: resign
    let fenAfterUndo = null;
    const E = await game(ctx, S, { stake, script: async (S2, g, n) => { if (n === 0) clickMove(9, 7, 7, 6); else if (n === 1) S.human({ type: 'undo' }); else { fenAfterUndo = R.toFen(g.pos); S.human({ type: 'resign' }); } } });
    out.games.push(E); out.checks.undo = fenAfterUndo === R.START && E.synced;
    out.checks.synced = out.games.every(x => x.synced);
    out.coinsDelta = ctx.coins - c0; out.checks.wallet = out.coinsDelta === stake - stake + 0 - stake - stake;
    const ok = Object.values(out.checks).every(Boolean);
    return Object.assign(out, { pass: ok ? 1 : 0, fail: ok ? 0 : 1 });
  }
})();
