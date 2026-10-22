/* Cờ Caro 3D — 15 × 15, you play X (pink, first) against a bot playing O (blue). Five in a row wins.
 * Rules + threat-based AI live in js/games3d/rules/co-caro.js; this file is the 3D table, input and flow. */
(function () {
  'use strict';
  const KEY = 'co-caro', N = 15, Q = .74, M = .42;          // cell size, paper margin around the grid
  const BS = N * Q + 2 * M, Y_BOARD = .12;
  const STAKES = [5000, 10000, 50000, 100000, 500000];
  const LV = [{ id: 'de', label: 'Dễ' }, { id: 'vua', label: 'Vừa' }, { id: 'kho', label: 'Khó' }];
  const cx = c => (c - 7) * Q, cz = r => (r - 7) * Q;

  T3.register(KEY, {
    title: 'Cờ Caro', sub: 'Bàn 15 × 15 · 5 quân liền hàng là thắng',
    table: 'board', theme: 'mint', tex: ['chips'], scripts: ['js/games3d/rules/co-caro.js'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    rules: `<p>Bạn cầm quân <b>X</b> (hồng) và đi trước, bot cầm quân <b>O</b> (xanh). Hai bên lần lượt đặt quân vào một ô trống.</p>
      <ul><li>Ai có <b>5 quân liền nhau</b> theo hàng ngang, dọc hoặc chéo trước là thắng. 6 quân trở lên cũng thắng, và <b>bị chặn hai đầu vẫn tính thắng</b>.</li>
      <li>Bàn đầy mà chưa ai đủ 5 quân là <b>hoà</b>.</li>
      <li>Chọn độ khó <b>Dễ / Vừa / Khó</b> và mức cược trước ván. Thắng nhận lại <b>gấp đôi</b> tiền cược, hoà được trả lại cược.</li>
      <li><b>Đi lại</b>: lùi nước của bạn và của bot. <b>Đầu hàng</b>: thua ván.</li></ul>`,
    async start(ctx) {
      const S = await setup(ctx);
      if (ctx.Q.has('demo')) await game(ctx, S, { stake: 10000, level: 'vua', script: demoScript(S) });
      for (;;) await game(ctx, S, {});
    },
    async selftest(ctx) { return selftest(ctx); },
  });

  // ------------------------------------------------------------------ camera fit (same approach as Cờ Tướng)
  function fitCamera(ctx, pts, o) {
    const T = ctx.THREE, cam = ctx.camera.clone(), look = new T.Vector3(...o.look), dir = new T.Vector3(0, Math.sin(o.elev), Math.cos(o.elev));
    const top = 1 - 2 * o.top / ctx.UH, bot = -1 + 2 * o.bottom / ctx.UH, side = 1 - 2 * o.side / ctx.UW;
    const test = (lz, D) => {
      const L = look.clone(); L.z += lz; cam.position.copy(L).addScaledVector(dir, D); cam.lookAt(L); cam.updateMatrixWorld();
      for (const p of pts) { const v = p.clone().project(cam), t = p.top != null ? 1 - 2 * p.top / ctx.UH : top; if (Math.abs(v.x) > side || v.y > t || v.y < bot) return false; }
      return true;
    };
    let best = null;
    for (let lz = -3; lz <= 3.001; lz += .25) { let a = 4, b = 90; for (let k = 0; k < 26; k++) { const m = (a + b) / 2; if (test(lz, m)) b = m; else a = m; } if (!best || b < best.D) best = { D: b, lz }; }
    const L = look.clone(); L.z += best.lz;
    ctx.camTo({ pos: L.clone().addScaledVector(dir, best.D).toArray(), look: L.toArray() }, 0);
    if (ctx.scene.fog) { ctx.scene.fog.near = best.D + 14; ctx.scene.fog.far = best.D + 70; }   // keep the board itself out of the room fog
  }
  function autoFit(ctx, pts, o) { let key = ''; ctx.onFrame(() => { const k = ctx.camera.aspect.toFixed(3) + ':' + ctx.camera.fov.toFixed(2) + ':' + Math.round(ctx.UH); if (k !== key) { key = k; fitCamera(ctx, pts, o); } }); }

  // ------------------------------------------------------------------ board art (canvas)
  function boardTexture(T3) {
    return T3.canvasTex(2048, 2048, (x, w, h) => {
      const px = w / BS, g0 = M * px, cell = Q * px;
      const bg = x.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#f2fff9'); bg.addColorStop(1, '#e9f7ff'); x.fillStyle = bg; x.fillRect(0, 0, w, h);
      // soft polka dots in the margin
      x.fillStyle = 'rgba(95,217,172,.18)'; for (let i = 0; i < 70; i++) { const t = i / 70 * Math.PI * 2, rr = w * .49; x.beginPath(); x.arc(w / 2 + Math.cos(t) * rr * .99, h / 2 + Math.sin(t) * rr * .99, 6, 0, 7); x.fill(); }
      // checker tint
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if ((r + c) % 2) { x.fillStyle = 'rgba(95,217,172,.13)'; x.fillRect(g0 + c * cell, g0 + r * cell, cell, cell); }
      // grid
      x.strokeStyle = '#6fcfab'; x.lineWidth = 5;
      for (let i = 0; i <= N; i++) { x.beginPath(); x.moveTo(g0 + i * cell, g0); x.lineTo(g0 + i * cell, g0 + N * cell); x.stroke(); x.beginPath(); x.moveTo(g0, g0 + i * cell); x.lineTo(g0 + N * cell, g0 + i * cell); x.stroke(); }
      x.strokeStyle = '#3fbf92'; x.lineWidth = 12; T3.rr(x, g0 - 6, g0 - 6, N * cell + 12, N * cell + 12, 22); x.stroke();
      // star points (little hearts)
      for (const [r, c] of [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]]) {
        const X = g0 + (c + .5) * cell, Y = g0 + (r + .5) * cell, s = cell * .16;
        x.fillStyle = 'rgba(255,111,168,.35)'; x.beginPath(); x.moveTo(X, Y + s * 1.1); x.bezierCurveTo(X - s * 1.9, Y - s * .2, X - s * .9, Y - s * 1.6, X, Y - s * .55); x.bezierCurveTo(X + s * .9, Y - s * 1.6, X + s * 1.9, Y - s * .2, X, Y + s * 1.1); x.fill();
      }
      // row / column labels
      x.fillStyle = '#2fae7a'; x.font = `400 ${Math.round(cell * .42)}px "Grandstander Black", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i < N; i++) { x.fillText(String.fromCharCode(65 + i), g0 + (i + .5) * cell, g0 * .45); x.fillText(String(i + 1), g0 * .45, g0 + (i + .5) * cell); }
    });
  }

  // ------------------------------------------------------------------ setup (once)
  async function setup(ctx) {
    const T = ctx.THREE, H = ctx.H, R = window.Rules[KEY];
    ctx.music('board');
    const S = { ctx, R, at: new Array(N * N).fill(null), level: 'vua', score: [0, 0, 0] };
    await document.fonts.load('400 40px "Grandstander Black"').catch(() => {});
    const plate = new T.Mesh(H.roundedBox(BS + .3, .2, BS + .3, .16, 3), ctx.mat(0x7fe3bd, { roughness: .45 })); plate.position.y = Y_BOARD - .1; plate.castShadow = true; plate.receiveShadow = true; ctx.add(plate);
    const paper = new T.Mesh(new T.PlaneGeometry(BS, BS), new T.MeshStandardMaterial({ map: boardTexture(T3), color: 0x6e6e6e, roughness: 1, toneMapped: false })); paper.rotation.x = -Math.PI / 2; paper.position.y = Y_BOARD + .002; paper.receiveShadow = true; ctx.add(paper);
    // pieces: X = two crossed rounded bars (pink), O = a torus (blue)
    S.xGeo = new T.CapsuleGeometry(.1, .46, 6, 14); S.oGeo = new T.TorusGeometry(.215, .092, 16, 40);
    S.xMat = new T.MeshStandardMaterial({ color: new T.Color(0xff4f95).convertSRGBToLinear().multiplyScalar(.55), roughness: .3, toneMapped: false });
    S.oMat = new T.MeshStandardMaterial({ color: new T.Color(0x3d9bff).convertSRGBToLinear().multiplyScalar(.55), roughness: .3, toneMapped: false });
    S.makePiece = (s, ghost) => {
      const g = new T.Group();
      const mat = ghost ? new T.MeshStandardMaterial({ color: (s === 1 ? S.xMat : S.oMat).color, transparent: true, opacity: .55, depthWrite: false, toneMapped: false }) : (s === 1 ? S.xMat : S.oMat).clone();
      if (s === 1) for (const a of [1, -1]) { const b = new T.Mesh(S.xGeo, mat); b.rotation.set(0, a * Math.PI / 4, Math.PI / 2, 'YXZ'); b.position.y = .1; b.castShadow = !ghost; g.add(b); }
      else { const t = new T.Mesh(S.oGeo, mat); t.rotation.x = Math.PI / 2; t.position.y = .092; t.castShadow = !ghost; g.add(t); }
      g.userData = { s, mat }; return g;
    };
    S.ghost = S.makePiece(1, true); S.ghost.visible = false; ctx.add(S.ghost);
    const ring = (r0, r1, color, op) => { const m = new T.Mesh(new T.RingGeometry(r0, r1, 36), new T.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; return m; };
    S.lastRing = ring(.27, .34, 0xffb81c, .95); S.lastRing.visible = false; ctx.add(S.lastRing);
    S.winBar = new T.Mesh(new T.CapsuleGeometry(.07, 1, 6, 12), new T.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: .85, toneMapped: false })); S.winBar.visible = false; ctx.add(S.winBar);
    S.glow = [];
    ctx.onFrame((dt, t) => {
      const k = .5 + .5 * Math.sin(t * 7);
      for (const m of S.glow) { m.emissive.setRGB(.9 * k + .2, .75 * k + .15, .1); }
      if (S.winBar.visible) S.winBar.material.opacity = .55 + .4 * k;
      if (S.ghost.visible) S.ghost.position.y = Y_BOARD + .05 + .05 * Math.sin(t * 5);
    });
    // input: plane over the grid; hover shows a ghost X on empty cells
    const pick = new T.Mesh(new T.PlaneGeometry(N * Q, N * Q), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    pick.rotation.x = -Math.PI / 2; pick.position.y = Y_BOARD + .01; ctx.add(pick);
    const cellAt = pt => { const c = Math.floor(pt.x / Q + 7.5), r = Math.floor(pt.z / Q + 7.5); return r >= 0 && r < N && c >= 0 && c < N ? R.idx(r, c) : -1; };
    ctx.pickable(pick, pt => { const i = cellAt(pt); if (i >= 0) S.click(R.rowOf(i), R.colOf(i)); }, on => { if (!on) S.hover(-1); });
    const plane = new T.Plane(new T.Vector3(0, 1, 0), -(Y_BOARD + .01));
    ctx.onPointerMove = e => { if (e.pointerType === 'touch') return; const p = ctx.ray(e, plane); S.hover(p ? cellAt(p) : -1); };
    S.hover = i => { const ok = i >= 0 && S.canHover && S.canHover(i); S.ghost.visible = ok; if (ok) S.ghost.position.set(cx(R.colOf(i)), Y_BOARD + .05, cz(R.rowOf(i))); };
    S.seats = await ctx.seats(2, { angles: [90, 270], r: 6.0 });
    S.me = S.seats[0]; S.bot = S.seats[1];
    S.bot.label.el.insertAdjacentHTML('beforeend', '<i>Quân O</i>');
    // score panel
    S.panel = ctx.ui.h('div', { class: 'glass', style: 'position:absolute;right:16px;top:132px;padding:16px 24px;display:flex;flex-direction:column;gap:6px;align-items:center;font:400 26px "Grandstander Black";color:#168a60;min-width:190px' }, ctx.ui.root);
    S.drawPanel = () => { S.panel.innerHTML = `<div>Tỉ số</div><div style="font:400 44px "Grandstander Black";color:#c2407a">${S.score[0]} <span style="color:#a59bb2">–</span> <span style="color:#2a7fd0">${S.score[1]}</span></div><div style="font:800 22px 'Baloo 2';color:#7a5a6e">Hoà ${S.score[2]} · Bot: <b style="color:#168a60">${LV.find(l => l.id === S.level).label}</b></div>`; };
    S.drawPanel();
    autoFit(ctx, [[-BS / 2 - .2, Y_BOARD, -BS / 2 - .2], [BS / 2 + .2, Y_BOARD, -BS / 2 - .2], [-BS / 2 - .2, Y_BOARD, BS / 2 + .2], [BS / 2 + .2, Y_BOARD, BS / 2 + .2], Object.assign(new T.Vector3(0, 3.1, -7.2), { top: 98 })].map(p => (p.isVector3 ? p : new T.Vector3(...p))),
      { elev: 68 * Math.PI / 180, look: [0, 0, 0], top: 126, bottom: 166, side: 260 });
    return S;
  }

  function clearBoard(S) { const ctx = S.ctx; S.at.forEach(m => m && ctx.remove(m)); S.at.fill(null); S.lastRing.visible = false; S.winBar.visible = false; S.glow = []; }
  /** Drop a piece onto cell i with a bouncy landing. */
  async function drop(S, i, s, fast) {
    const ctx = S.ctx, R = S.R, m = S.makePiece(s);
    m.position.set(cx(R.colOf(i)), Y_BOARD + (fast ? .01 : 2.2), cz(R.rowOf(i))); m.rotation.y = (Math.random() - .5) * .3; ctx.add(m); S.at[i] = m;
    S.lastRing.visible = false;
    if (!fast) await ctx.tween(m, { y: Y_BOARD + .01 }, 380, 'bounce');
    ctx.sfx(s === 1 ? 'pop' : 'chip', .5);
    S.lastRing.position.set(m.position.x, Y_BOARD + .006, m.position.z); S.lastRing.visible = true;
  }
  function showWin(S, line) {
    const R = S.R, a = line[0], b = line[line.length - 1];
    for (const i of line) { const m = S.at[i]; if (m) { const mat = m.userData.mat; S.glow.push(mat); S.ctx.tween(m, { y: Y_BOARD + .25 }, 300, 'back'); } }
    const x0 = cx(R.colOf(a)), z0 = cz(R.rowOf(a)), x1 = cx(R.colOf(b)), z1 = cz(R.rowOf(b)), len = Math.hypot(x1 - x0, z1 - z0);
    S.winBar.scale.set(1, len + .5, 1); S.winBar.position.set((x0 + x1) / 2, Y_BOARD + .5, (z0 + z1) / 2);
    S.winBar.quaternion.setFromUnitVectors(new S.ctx.THREE.Vector3(0, 1, 0), new S.ctx.THREE.Vector3(x1 - x0, 0, z1 - z0).normalize());
    S.winBar.visible = true;
  }

  // ------------------------------------------------------------------ pre-game: level + stake
  async function chooseStake(ctx, S, fixed, level) {
    if (level) { S.level = level; S.drawPanel(); }
    if (fixed != null) { ctx.spend(fixed); return fixed; }
    const picker = ctx.ui.chipPicker(STAKES, null, S.stakeIdx || 1);
    ctx.ui.status('Chọn độ khó, mức cược rồi bấm <b>VÀO VÁN</b>');
    const stake = await new Promise(res => {
      const items = LV.map(l => ({ id: l.id, label: l.label, cls: l.id === S.level ? 'lavender' : 'grey', onClick: () => { S.level = l.id; LV.forEach(o => { a.btn(o.id).className = 'gbtn ' + (o.id === S.level ? 'lavender' : 'grey'); }); S.drawPanel(); } }));
      items.push({ id: 'go', label: 'VÀO VÁN', cls: 'pink', icon: 'emoji-fluent-3d/symbols/cross_mark.png', onClick: () => { if (ctx.spend(picker.value)) { S.stakeIdx = STAKES.indexOf(picker.value); res(picker.value); } } });
      const a = ctx.ui.actions(items);
      LV.forEach(o => { const b = a.btn(o.id); b.style.minWidth = '130px'; });
    });
    picker.el.remove(); ctx.ui.clearActions();
    return stake;
  }

  // ------------------------------------------------------------------ one game
  /** opts: { stake, level, preset: [[r,c,s]...], turn, script(S, g, n) } → { result, stake, coinsDelta, moves, line } */
  async function game(ctx, S, opts = {}) {
    const R = S.R, T = ctx.THREE, fast = !!ctx.TEST;
    clearBoard(S);
    const g = new R.Game();
    if (opts.preset) { for (const [r, c, s] of opts.preset) { const i = R.idx(r, c); g.b[i] = s; drop(S, i, s, true); } S.lastRing.visible = false; g.turn = opts.turn || 1; }
    const coins0 = ctx.coins, stake = await chooseStake(ctx, S, opts.stake, opts.level);
    S.bot.setCoins(S.bot.coins - stake);
    S.bot.say(ctx.pick(['Chặn hết nha 😏', 'X đi trước đó!', 'Hôm nay mình ' + (S.level === 'kho' ? 'nghiêm túc' : 'hiền') + ' thôi 😆', 'Năm con là thắng nhé!']));
    let result = null, actions = 0, line = null;
    const acts = ctx.ui.actions([
      { id: 'undo', label: 'Đi lại', cls: 'sky', icon: 'emoji-fluent-3d/hands/backhand_index_pointing_left.png', onClick: () => S.human && S.human({ type: 'undo' }) },
      { id: 'resign', label: 'Đầu hàng', cls: 'grey', icon: 'emoji-fluent-3d/reactions/face_holding_back_tears.png', onClick: () => S.human && S.human({ type: 'resign' }) },
    ]);
    const presetLen = g.hist.length;
    const setBtns = on => { acts.set('undo', { disabled: !on || g.hist.length - presetLen < 2 }); acts.set('resign', { disabled: !on }); };
    setBtns(false);
    S.canHover = i => !!S.human && !g.b[i];
    S.click = (r, c) => {
      if (!S.human) return;
      const i = R.idx(r, c);
      if (g.b[i]) { ctx.sfx('error', .25); return; }
      S.human({ type: 'move', i });
    };
    const finish = () => { if (g.over) { result = g.over.winner === 1 ? 'win' : g.over.winner === 2 ? 'loss' : 'draw'; line = g.over.line; } };
    while (!result) {
      if (g.turn === 1) {
        S.me.turn(true); setBtns(true); ctx.ui.status('Lượt của bạn · chạm vào một ô trống để đặt <b>X</b>');
        const act = await new Promise(res => { S.human = res; if (opts.script) Promise.resolve().then(() => opts.script(S, g, actions++)); });
        S.human = null; S.ghost.visible = false; S.me.turn(false); setBtns(false);
        if (act.type === 'move') { g.play(act.i); await drop(S, act.i, 1, false); finish(); }
        else if (act.type === 'undo') {
          for (let k = 0; k < 2 && g.hist.length > presetLen; k++) { const i = g.undo(); const m = S.at[i]; S.at[i] = null; if (m) ctx.tween(m, { y: Y_BOARD + 2, s: .2 }, 260, 'in').then(() => ctx.remove(m)); }
          S.lastRing.visible = false; const li = g.hist[g.hist.length - 1]; if (li != null) { S.lastRing.position.set(cx(R.colOf(li)), Y_BOARD + .006, cz(R.rowOf(li))); S.lastRing.visible = true; }
          await ctx.wait(280); ctx.ui.toast('Đã đi lại một nước', 'emoji-fluent-3d/hands/backhand_index_pointing_left.png');
        } else if (act.type === 'resign') {
          let sure = true;
          if (!opts.script) sure = (await ctx.ui.modal({ title: 'Đầu hàng?', html: '<p>Bạn sẽ thua ván này và mất tiền cược.</p>', width: 760, buttons: [{ label: 'Đầu hàng', cls: 'pink' }, { label: 'Chơi tiếp', cls: 'grey' }] })) === 'Đầu hàng';
          if (sure) result = 'loss';
        }
      } else {
        S.bot.turn(true); S.bot.anim('think'); ctx.ui.status(`<b>${S.bot.name}</b> đang tính nước…`);
        await ctx.wait(fast ? 80 : 420);
        const i = R.bestMove(g.b, 2, S.level);
        g.play(i); await drop(S, i, 2, false); S.bot.turn(false); finish();
        if (!result) { // comment on threats
          const myFive = R.candidates(g.b, 1).some(j => R.cellScore(g.b, j, 2) >= R.W_FIVE);
          if (myFive && Math.random() < .7) S.bot.say(ctx.pick(['Sắp 5 rồi nha 😎', 'Chặn đi chứ!', 'Hehe 4 con rồi']));
        }
      }
    }
    // ---- settle
    ctx.ui.clearActions(); S.canHover = null; S.ghost.visible = false;
    if (line) showWin(S, line);
    const amount = result === 'win' ? stake : result === 'loss' ? -stake : 0;
    S.score[result === 'win' ? 0 : result === 'loss' ? 1 : 2]++; S.drawPanel();
    if (result === 'win') { ctx.win(stake * 2, new T.Vector3(0, 1, 3)); ctx.ui.callout('5 QUÂN! THẮNG!'); ctx.ui.confetti(); ctx.sfx('win', .5); S.bot.anim('sad'); S.bot.say('Bạn giỏi quá 😭'); }
    else if (result === 'draw') { ctx.win(stake, new T.Vector3(0, 1, 3)); ctx.ui.callout('HOÀ', '#2a7fd0'); S.bot.anim('wave'); S.bot.setCoins(S.bot.coins + stake); }
    else { ctx.sfx('lose', .4); S.bot.anim('cheer'); S.bot.say(line ? 'Năm con rồi! 🎉' : 'Hehe 😆'); S.bot.setCoins(S.bot.coins + stake * 2); }
    ctx.ui.status(result === 'win' ? 'Bạn thắng! 🎉' : result === 'draw' ? 'Bàn đầy, hoà cờ' : 'Bạn thua ván này');
    const moves = g.hist.length;
    const out = { result, stake, coinsDelta: ctx.coins - coins0, moves, line: line ? line.length : 0, level: S.level, synced: S.at.every((m, i) => (m ? m.userData.s : 0) === g.b[i]) };
    const lvName = LV.find(l => l.id === S.level).label;
    const rows = [
      { name: S.me.name + ' (bạn)', avatar: S.me.avatar, me: true, detail: `Quân X · ${result === 'win' ? 'đủ 5 quân' : result === 'loss' ? (line ? 'bot đủ 5 quân' : 'đầu hàng') : 'bàn đầy'}`, amount, tag: result === 'win' ? 'Thắng' : null },
      { name: S.bot.name, avatar: S.bot.avatar, detail: `Quân O · độ khó ${lvName} · ${moves} nước`, amount: -amount, tag: result === 'loss' ? 'Thắng' : null },
    ];
    await ctx.wait(line ? 900 : 300);
    const title = result === 'win' ? 'Bạn thắng!' : result === 'loss' ? 'Thua rồi' : 'Hoà cờ';
    if (ctx.TEST) { ctx.ui.results(title, rows); await ctx.wait(200); ctx.ui.closeModal(); }
    else await ctx.ui.results(title, rows, { again: 'Ván mới' });
    return out;
  }

  // ------------------------------------------------------------------ demo + self-test
  function demoScript(S) {
    return async (S2, g, n) => {
      const R = S.R;
      if (n < 7) { await S.ctx.wait(100); const i = R.bestMove(g.b, 1, 'vua'); S.click(R.rowOf(i), R.colOf(i)); }
      else { const i = R.bestMove(g.b, 1, 'de'); S.hover(i); }
    };
  }
  async function selftest(ctx) {
    const S = await setup(ctx), R = S.R, out = { games: [], checks: {} }, stake = 10000, c0 = ctx.coins;
    // A. open four for X on row 7: complete it
    const A = await game(ctx, S, { stake, level: 'vua', preset: [[7, 3, 1], [7, 4, 1], [7, 5, 1], [7, 6, 1], [6, 6, 2], [8, 8, 2], [5, 5, 2]], script: async () => S.click(7, 7) });
    out.games.push(A); out.checks.fiveWins = A.result === 'win' && A.line === 5 && A.coinsDelta === stake;
    // B. a whole game: your moves come from the strong AI, the bot plays Dễ
    const B = await game(ctx, S, { stake, level: 'de', script: async (S2, g) => { const i = R.bestMove(g.b, 1, 'kho'); S.click(R.rowOf(i), R.colOf(i)); } });
    out.games.push(B); out.checks.fullGame = B.result !== null && B.coinsDelta === (B.result === 'win' ? stake : B.result === 'loss' ? -stake : 0) && B.synced;
    // C. full board without five: draw, stake returned
    const preset = []; for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) if (r !== 14 || c !== 14) preset.push([r, c, (c + 2 * r) % 4 < 2 ? 1 : 2]);
    const C = await game(ctx, S, { stake, level: 'vua', preset, turn: 1, script: async () => S.click(14, 14) });
    out.games.push(C); out.checks.drawFull = C.result === 'draw' && C.coinsDelta === 0;
    // D. the bot blocks your four; undo takes both moves back; then resign
    let afterUndo = null, blocked = null;
    const D = await game(ctx, S, { stake, level: 'kho', preset: [[7, 3, 1], [7, 4, 1], [7, 5, 1], [7, 2, 2], [3, 3, 2]], script: async (S2, g, n) => {
      if (n === 0) S.click(7, 6);
      else if (n === 1) { blocked = g.b[R.idx(7, 7)] === 2; S.human({ type: 'undo' }); }
      else { afterUndo = g.b[R.idx(7, 6)] === 0 && g.b[R.idx(7, 7)] === 0 && g.hist.length === 0; S.human({ type: 'resign' }); }
    } });
    out.games.push(D); out.checks.blockAndUndo = blocked === true && afterUndo === true && D.result === 'loss' && D.coinsDelta === -stake;
    out.coinsDelta = ctx.coins - c0;
    out.checks.wallet = out.coinsDelta === out.games.reduce((a, x) => a + x.coinsDelta, 0);
    out.checks.synced = out.games.every(x => x.synced);
    const ok = Object.values(out.checks).every(Boolean);
    return Object.assign(out, { pass: ok ? 1 : 0, fail: ok ? 0 : 1 });
  }
})();
