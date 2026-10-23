/* Cờ Cá Ngựa 3D — you (Đỏ) + 3 bots on a cross-shaped 15 × 15 board drawn on a canvas.
 * Rules + bot choice live in js/games3d/rules/co-ca-ngua.js; this file is the 3D table, dice, pawns and flow.
 * Board layout (rows top → bottom, cols left → right): Đỏ yard bottom-left, Xanh lá top-left, Vàng top-right,
 * Xanh dương bottom-right; play goes clockwise. Every cell centre is computed from the same (row, col) grid that the
 * canvas uses, so pawns always land exactly on the painted cells. */
(function () {
  'use strict';
  const KEY = 'co-ca-ngua', Qn = .76, MG = .3, BS = 15 * Qn + 2 * MG, Y_BOARD = .12;
  const STAKES = [5000, 10000, 50000, 100000, 500000];
  const COL = [{ yard: '#ff8fbf', yard2: '#ff5c9a', cell: '#ff8fbf', pawn: 0xff4f8b, die: '#ffe1ee', name: 'Đỏ', css: '#e8407f' },
    { yard: '#6fe0b4', yard2: '#2fc58e', cell: '#5fd9ac', pawn: 0x22c47f, die: '#dcfff0', name: 'Xanh lá', css: '#1f9a70' },
    { yard: '#ffd76a', yard2: '#ffb81c', cell: '#ffcf4a', pawn: 0xffb000, die: '#fff4cf', name: 'Vàng', css: '#c98a00' },
    { yard: '#8cc8ff', yard2: '#3d9bff', cell: '#6fb7ff', pawn: 0x3d8fff, die: '#e1efff', name: 'Xanh dương', css: '#2a6fd0' }];
  const TOKEN = ['cn_red', 'cn_green', 'cn_yellow', 'cn_blue'];

  // ------------------------------------------------------------------ geometry (cell coordinates)
  // classic Ludo track with Đỏ at the top-left, then rotated 90° counter-clockwise so Đỏ sits at the bottom-left (near you)
  const rot = ([r, c]) => [14 - c, r];
  const BASE_TRACK = [];
  { const seg = (a) => a.forEach(p => BASE_TRACK.push(p));
    seg([[6, 1], [6, 2], [6, 3], [6, 4], [6, 5]]); seg([[5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6]]); seg([[0, 7]]);
    seg([[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8]]); seg([[6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14]]); seg([[7, 14]]);
    seg([[8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9]]); seg([[9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8]]); seg([[14, 7]]);
    seg([[14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6]]); seg([[8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]]); seg([[7, 0]]); seg([[6, 0]]); }
  const TRACK = BASE_TRACK.map(rot);
  const HOME = [[[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]].map(l => l.map(rot));
  const YARD0 = [[9, 0], [0, 0], [0, 9], [9, 9]];                // top-left cell of each 6 × 6 yard
  const rotCW = ([dr, dc]) => [dc, -dr];
  const FIN_OFF = [[[1.08, -.56], [1.08, 0], [1.08, .56], [.52, 0]]];
  for (let k = 1; k < 4; k++) FIN_OFF.push(FIN_OFF[k - 1].map(rotCW));
  const yardCentre = pl => [YARD0[pl][0] + 2.5, YARD0[pl][1] + 2.5];
  const SLOT = [[-1.05, -1.05], [-1.05, 1.05], [1.05, -1.05], [1.05, 1.05]];
  const wx = c => (c - 7) * Qn, wz = r => (r - 7) * Qn;

  T3.register(KEY, {
    title: 'Cá Ngựa', sub: '4 người · đổ 1 hoặc 6 để xuất chuồng · về đích đủ 4 ngựa là thắng',
    table: 'board', theme: 'lavender', tex: ['co-ca-ngua', 'chips'], scripts: ['js/games3d/rules/co-ca-ngua.js'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    rules: `<p>Bạn cầm ngựa <b>Đỏ</b>, ba bot cầm <b>Xanh lá</b>, <b>Vàng</b>, <b>Xanh dương</b>. Mỗi người góp cùng một mức cược vào <b>hũ</b>, ai đưa đủ <b>4 ngựa về đích</b> trước ăn cả hũ.</p>
      <ul><li>Bấm <b>GIEO</b> (hoặc chạm vào xúc xắc của bạn). Đổ <b>1 hoặc 6</b> mới được đưa một ngựa ra ô xuất phát.</li>
      <li>Ngựa đi theo chiều kim đồng hồ đúng số chấm. Được đi vượt qua mọi ngựa khác, nhưng không được dừng trên ô có ngựa cùng màu.</li>
      <li>Dừng đúng ô có ngựa đối thủ là <b>đá</b> ngựa đó về chuồng (cả khi vừa xuất chuồng). Ngựa trong đường về đích của mình thì an toàn.</li>
      <li>Đi hết một vòng thì rẽ vào <b>đường về đích</b> cùng màu (5 ô) rồi vào ô <b>đích</b> ở giữa bàn. Phải đổ <b>vừa đúng</b> số bước, dư thì ngựa đó không được đi.</li>
      <li>Đổ được <b>6</b> thì được gieo thêm lượt nữa. Không có ngựa nào đi được thì mất lượt.</li>
      <li>Có nhiều ngựa đi được thì chạm vào con ngựa đang nhún nhảy để chọn. <b>Tự đi</b> để máy đi giúp bạn. <b>Bỏ cuộc</b> là mất tiền cược.</li></ul>`,
    async start(ctx) {
      const S = await setup(ctx);
      if (ctx.Q.has('demo')) await game(ctx, S, demoOpts(S));
      for (;;) await game(ctx, S, {});
    },
    async selftest(ctx) { return selftest(ctx); },
  });

  // ------------------------------------------------------------------ camera fit
  function fitCamera(ctx, pts, o) {
    const T = ctx.THREE, cam = ctx.camera.clone(), look = new T.Vector3(...o.look), dir = new T.Vector3(0, Math.sin(o.elev), Math.cos(o.elev));
    const top = 1 - 2 * o.top / ctx.UH;
    const test = (lz, D) => {
      const L = look.clone(); L.z += lz; cam.position.copy(L).addScaledVector(dir, D); cam.lookAt(L); cam.updateMatrixWorld();
      for (const p of pts) { const v = p.clone().project(cam), t = p.top != null ? 1 - 2 * p.top / ctx.UH : top, bt = -1 + 2 * (p.bottom != null ? p.bottom : o.bottom) / ctx.UH, sd = 1 - 2 * (p.side != null ? p.side : o.side) / ctx.UW; if (Math.abs(v.x) > sd || v.y > t || v.y < bt) return false; }
      return true;
    };
    let best = null;
    for (let lz = -3; lz <= 3.001; lz += .25) { let a = 4, b = 90; for (let k = 0; k < 26; k++) { const m = (a + b) / 2; if (test(lz, m)) b = m; else a = m; } if (!best || b < best.D) best = { D: b, lz }; }
    const L = look.clone(); L.z += best.lz;
    ctx.camTo({ pos: L.clone().addScaledVector(dir, best.D).toArray(), look: L.toArray() }, 0);
    if (ctx.scene.fog) { ctx.scene.fog.near = best.D + 14; ctx.scene.fog.far = best.D + 70; }   // keep the board itself out of the room fog
  }
  function autoFit(ctx, pts, o) { let key = ''; ctx.onFrame(() => { const k = ctx.camera.aspect.toFixed(3) + ':' + ctx.camera.fov.toFixed(2) + ':' + Math.round(ctx.UH); if (k !== key) { key = k; fitCamera(ctx, pts, o); } }); }

  // ------------------------------------------------------------------ board canvas
  function loadImg(src) { return new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
  async function boardTexture() {
    const TEX = window.HC_TEX || {}, board = await loadImg(TEX.cn_board), tokens = await Promise.all(TOKEN.map(k => loadImg(TEX[k])));
    return T3.canvasTex(2048, 2048, (x, w) => {
      const u = w / BS, cell = Qn * u, o = MG * u;
      const X = c => o + c * cell, Y = r => o + r * cell, rr = T3.rr;
      x.fillStyle = '#fff6ee'; x.fillRect(0, 0, w, w);
      x.fillStyle = '#ffe9dc'; rr(x, 8, 8, w - 16, w - 16, 70); x.fill(); x.fillStyle = '#fffaf5'; rr(x, 22, 22, w - 44, w - 44, 60); x.fill();
      // yards
      for (let k = 0; k < 4; k++) {
        const [r0, c0] = YARD0[k], C = COL[k], pad = cell * .12;
        const g = x.createLinearGradient(0, Y(r0), 0, Y(r0 + 6)); g.addColorStop(0, C.yard); g.addColorStop(1, C.yard2);
        x.fillStyle = 'rgba(0,0,0,.08)'; rr(x, X(c0) + pad, Y(r0) + pad + 10, 6 * cell - 2 * pad, 6 * cell - 2 * pad, cell * .7); x.fill();
        x.fillStyle = g; rr(x, X(c0) + pad, Y(r0) + pad, 6 * cell - 2 * pad, 6 * cell - 2 * pad, cell * .7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.28)'; rr(x, X(c0) + pad * 2.2, Y(r0) + pad * 2.2, 6 * cell - 4.4 * pad, cell * 1.6, cell * .5); x.fill();
        x.fillStyle = '#ffffff'; rr(x, X(c0 + .95), Y(r0 + .95), 4.1 * cell, 4.1 * cell, cell * .55); x.fill();
        const [cr, cc] = yardCentre(k);
        for (const [dr, dc] of SLOT) {
          const sx = X(cc + dc + .5), sy = Y(cr + dr + .5);
          x.fillStyle = C.yard; x.globalAlpha = .35; x.beginPath(); x.arc(sx, sy, cell * .46, 0, 7); x.fill(); x.globalAlpha = 1;
          x.strokeStyle = C.yard2; x.lineWidth = 6; x.beginPath(); x.arc(sx, sy, cell * .46, 0, 7); x.stroke();
          if (tokens[k]) { x.globalAlpha = .28; x.drawImage(tokens[k], sx - cell * .34, sy - cell * .34, cell * .68, cell * .68); x.globalAlpha = 1; }
        }
        // centre spot for the die
        x.strokeStyle = C.yard; x.lineWidth = 5; x.setLineDash([12, 10]); rr(x, X(cc + .5) - cell * .42, Y(cr + .5) - cell * .42, cell * .84, cell * .84, cell * .18); x.stroke(); x.setLineDash([]);
      }
      // track cells
      const cellBox = (r, c, fill, stroke) => { const p = cell * .05; x.fillStyle = fill; rr(x, X(c) + p, Y(r) + p, cell - 2 * p, cell - 2 * p, cell * .18); x.fill(); x.strokeStyle = stroke; x.lineWidth = 4; x.stroke(); };
      TRACK.forEach(([r, c]) => cellBox(r, c, '#ffffff', '#eed9cf'));
      const star = (cx0, cy0, R0, fill) => { x.fillStyle = fill; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? R0 * .45 : R0; x.lineTo(cx0 + Math.cos(a) * rad, cy0 + Math.sin(a) * rad); } x.closePath(); x.fill(); };
      for (let k = 0; k < 4; k++) {
        const [r, c] = TRACK[13 * k]; cellBox(r, c, COL[k].cell, COL[k].yard2); star(X(c + .5), Y(r + .5), cell * .3, '#fff7c2');
        HOME[k].forEach(([hr, hc], i) => { cellBox(hr, hc, COL[k].cell, COL[k].yard2); x.fillStyle = 'rgba(255,255,255,.75)'; x.font = `400 ${Math.round(cell * .38)}px "Grandstander Black", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i + 1), X(hc + .5), Y(hr + .5) + 3); });
        // arrow on the cell before the home column
        const [ar, ac] = TRACK[(13 * k + 50) % 52], [hr, hc] = HOME[k][0], dx = hc - ac, dy = hr - ar;
        x.save(); x.translate(X(ac + .5), Y(ar + .5)); x.rotate(Math.atan2(dy, dx)); x.fillStyle = COL[k].yard2; x.beginPath(); x.moveTo(cell * .28, 0); x.lineTo(-cell * .12, -cell * .22); x.lineTo(-cell * .12, cell * .22); x.closePath(); x.fill(); x.restore();
      }
      // centre: four triangles (bottom Đỏ, left Xanh lá, top Vàng, right Xanh dương) + trophy
      const c0 = X(6), c1 = X(9), mid = X(7.5), tri = (ax, ay, bx, by, fill) => { x.fillStyle = fill; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.lineTo(mid, mid); x.closePath(); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 8; x.stroke(); };
      tri(c0, c1, c1, c1, COL[0].cell); tri(c0, c0, c0, c1, COL[1].cell); tri(c0, c0, c1, c0, COL[2].cell); tri(c1, c0, c1, c1, COL[3].cell);
      if (board) { const s = cell * 1.25; x.drawImage(board, 452, 452, 96, 96, mid - s / 2, mid - s / 2, s, s); }
    });
  }

  // ------------------------------------------------------------------ setup (once)
  async function setup(ctx) {
    const T = ctx.THREE, H = ctx.H, R = window.Rules[KEY];
    ctx.music('board');
    await document.fonts.load('400 40px "Grandstander Black"').catch(() => {});
    const S = { ctx, R, pawns: [], dice: [], auto: false, speed: 1 };
    const plate = new T.Mesh(H.roundedBox(BS + .3, .2, BS + .3, .2, 3), ctx.mat(0xffd6c2, { roughness: .5 })); plate.position.y = Y_BOARD - .1; plate.castShadow = true; plate.receiveShadow = true; ctx.add(plate);
    const art = new T.Mesh(new T.PlaneGeometry(BS, BS), new T.MeshStandardMaterial({ map: await boardTexture(), color: 0x6e6e6e, roughness: 1, toneMapped: false })); art.rotation.x = -Math.PI / 2; art.position.y = Y_BOARD + .002; art.receiveShadow = true; ctx.add(art);
    // pawns: lathe body + head + a horse medallion facing the camera
    const prof = [[0, 0], [.27, 0], [.28, .05], [.22, .1], [.15, .2], [.11, .3], [.17, .34], [.15, .38], [0, .39]].map(([a, b]) => new T.Vector2(a, b));
    const bodyGeo = new T.LatheGeometry(prof, 32), headGeo = new T.SphereGeometry(.13, 20, 14), coinGeo = new T.CylinderGeometry(.19, .19, .05, 32), faceGeo = new T.CircleGeometry(.185, 32);
    for (let pl = 0; pl < 4; pl++) {
      const mat = new T.MeshStandardMaterial({ color: new T.Color(COL[pl].pawn).convertSRGBToLinear().multiplyScalar(.52), roughness: .35, toneMapped: false }),   // vivid like the board art
        face = new T.MeshBasicMaterial({ map: ctx.tex(TOKEN[pl]), toneMapped: false });
      S.pawns.push([0, 1, 2, 3].map(h => {
        const g = new T.Group(), inner = new T.Group(); g.add(inner);
        const body = new T.Mesh(bodyGeo, mat); body.castShadow = true; inner.add(body);
        const head = new T.Mesh(headGeo, mat); head.position.y = .46; head.castShadow = true; inner.add(head);
        const medal = new T.Group(); medal.position.set(0, .62, .02); medal.rotation.x = -.62; inner.add(medal);
        const coin = new T.Mesh(coinGeo, mat); coin.rotation.x = Math.PI / 2; coin.castShadow = true; medal.add(coin);
        const f = new T.Mesh(faceGeo, face); f.position.z = .026; medal.add(f);
        const ring = new T.Mesh(new T.RingGeometry(.3, .4, 32), new T.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: .95, depthWrite: false, toneMapped: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = .015; ring.visible = false; g.add(ring);
        inner.scale.setScalar(1.22);
        g.userData = { pl, h, inner, ring, fin: -1 };
        ctx.add(g);
        ctx.pickable(g, () => S.tapHorse && S.tapHorse(pl, h));
        return g;
      }));
      const d = ctx.die({ size: .62, color: COL[pl].die, pip: '#5a2342' }); const [cr, cc] = yardCentre(pl); d.position.set(wx(cc), Y_BOARD + .31, wz(cr)); d.setFace(5); ctx.add(d); S.dice.push(d);
      if (pl === 0) ctx.pickable(d, () => S.rollReq && S.rollReq());
    }
    // landing marker for the chosen move
    S.targetGeo = new T.CircleGeometry(.3, 28); S.targetRing = new T.RingGeometry(.3, .37, 28);
    S.targets = [];
    ctx.onFrame((dt, t) => {
      for (const row of S.pawns) for (const p of row) { const u = p.userData; if (u.bob) { u.inner.position.y = Math.abs(Math.sin(t * 6 + u.h)) * .22; u.ring.material.opacity = .6 + .35 * Math.sin(t * 8); } else u.inner.position.y = 0; }
      for (const m of S.targets) m.material.opacity = .65 + .2 * Math.sin(t * 7);
    });
    // seats: you near Đỏ (bottom-left); bots at left / far / right next to their yards
    S.seats = await ctx.seats(4, { angles: [90, 180, 270, 0], r: 7.0 });
    S.seats.forEach((s, i) => { if (s.label) s.label.el.insertAdjacentHTML('beforeend', `<i style="background:${COL[i].css};box-shadow:0 3px 0 rgba(0,0,0,.2)">${COL[i].name}</i>`); });
    // side panel: players + pot
    S.panel = ctx.ui.h('div', { class: 'glass', style: 'position:absolute;right:16px;bottom:18px;padding:14px 18px;display:flex;flex-direction:column;gap:8px;font:400 24px "Grandstander Black";color:#5f3fc9;min-width:250px' }, ctx.ui.root);
    const V = (x, y, z, o) => Object.assign(new T.Vector3(x, y, z), o || {}), e = BS / 2 + .2;
    const pts = [V(-e, Y_BOARD, -e), V(e, Y_BOARD, -e), V(-e, Y_BOARD, e, { side: 300, bottom: 212 }), V(e, Y_BOARD, e, { side: 300, bottom: 212 }),
      V(0, 3.1, -8.2, { top: 98 }), V(-8.2, 2.6, 0, { side: 70 }), V(8.2, 2.6, 0, { side: 70 })];
    autoFit(ctx, pts, { elev: 62 * Math.PI / 180, look: [0, 0, 0], top: 126, bottom: 166, side: 40 });
    return S;
  }

  // ------------------------------------------------------------------ positions
  function spot(S, pl, p, h, finIdx) {
    let rc;
    if (p === -1) { const [cr, cc] = yardCentre(pl); rc = [cr + SLOT[h][0], cc + SLOT[h][1]]; }
    else if (p <= S.R.LAST_TRACK) rc = TRACK[S.R.cellOf(pl, p)];
    else if (p < S.R.FINISH) rc = HOME[pl][p - S.R.HOME_FIRST];
    else { const o = FIN_OFF[pl][Math.max(0, finIdx)]; rc = [7 + o[0], 7 + o[1]]; }
    return { x: wx(rc[1]), z: wz(rc[0]) };
  }
  function snapAll(S, st) {
    const fin = [0, 0, 0, 0];
    for (let pl = 0; pl < 4; pl++) for (let h = 0; h < 4; h++) {
      const p = st.horses[pl][h], m = S.pawns[pl][h], u = m.userData;
      u.fin = p === S.R.FINISH ? fin[pl]++ : -1;
      const s = spot(S, pl, p, h, u.fin); m.position.set(s.x, Y_BOARD, s.z); m.scale.setScalar(p === S.R.FINISH ? .62 : 1); m.rotation.set(0, 0, 0); u.bob = false; u.ring.visible = false;
    }
  }
  /** Hop a horse along its path one cell at a time; kicked horses fly home afterwards. */
  async function animateMove(S, st, pl, m, finCount) {
    const ctx = S.ctx, R = S.R, mesh = S.pawns[pl][m.h], hop = 150 * S.speed;
    if (m.exit) { const s = spot(S, pl, 0, m.h); ctx.sfx('jingle', .35); await ctx.tween(mesh, { x: s.x, z: s.z, y: Y_BOARD, arc: 1.3 }, 420 * S.speed, 'io'); }
    else for (let p = m.from + 1; p <= m.to; p++) {
      const fin = p === R.FINISH; if (fin) mesh.userData.fin = finCount;
      const s = spot(S, pl, p, m.h, mesh.userData.fin);
      ctx.sfx('tick', .3);
      await ctx.tween(mesh, fin ? { x: s.x, z: s.z, y: Y_BOARD, arc: .9, s: .62 } : { x: s.x, z: s.z, y: Y_BOARD, arc: .42 }, fin ? 360 * S.speed : hop, 'io');
    }
    if (m.kick) {
      const v = S.pawns[m.kick.pl][m.kick.h], s = spot(S, m.kick.pl, -1, m.kick.h);
      ctx.sfx('boom', .4); ctx.ui.float('ĐÁ!', v.position.clone().setY(1.2));
      await ctx.tween(v, { x: s.x, z: s.z, y: Y_BOARD, arc: 3.2, rz: Math.PI * 4 }, 750 * S.speed, 'out'); v.rotation.z = 0;
    }
    if (m.finish) { ctx.sfx('gold', .45); ctx.ui.float('VỀ ĐÍCH!', mesh.position.clone().setY(1.2)); }
  }

  // ------------------------------------------------------------------ HUD
  function drawPanel(S, st, pot, cur) {
    const R = S.R;
    S.panel.innerHTML = `<div style="display:flex;align-items:center;gap:10px;justify-content:center"><img src="${HC.A('emoji-fluent-3d/game/money_bag.png')}" style="width:46px"><span>Hũ <b style="font:400 32px "Grandstander Black";color:#a86d00">${HC.short(pot)}</b></span></div>` +
      S.seats.map((s, i) => `<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:22px;${i === cur ? 'background:#f3ecff;box-shadow:0 0 0 4px #b79bff' : ''}"><span style="width:22px;height:22px;border-radius:50%;background:${COL[i].css};box-shadow:0 3px 0 rgba(0,0,0,.2)"></span><span style="flex:1;font:400 22px 'Grandstander Black';color:#5a2342;white-space:nowrap">${s.me ? 'Bạn' : s.name}</span><span style="font:800 22px 'Baloo 2';color:#7a5a6e">🏁 ${R.homeCount(st, i)}/4</span></div>`).join('');
  }

  // ------------------------------------------------------------------ pre-game stake
  async function chooseStake(ctx, S, fixed) {
    if (fixed != null) { ctx.spend(fixed); return fixed; }
    const picker = ctx.ui.chipPicker(STAKES, null, S.stakeIdx || 1);
    ctx.ui.status('Chọn mức cược rồi bấm <b>VÀO VÁN</b> · mỗi người góp như nhau');
    const stake = await new Promise(res => ctx.ui.actions([{ id: 'go', label: 'VÀO VÁN', cls: 'pink', icon: 'emoji-fluent-3d/game-items/horse_face.png', onClick: () => { if (ctx.spend(picker.value)) { S.stakeIdx = STAKES.indexOf(picker.value); res(picker.value); } } }]));
    picker.el.remove(); ctx.ui.clearActions();
    return stake;
  }

  // ------------------------------------------------------------------ one game
  /** opts: { stake, state, dice: [forced rolls…], script(S, kind, info) for your decisions, auto } → { winner, stake, coinsDelta, turns, kicks, log } */
  async function game(ctx, S, opts = {}) {
    const R = S.R, T = ctx.THREE;
    const st = opts.state ? R.clone(opts.state) : R.newState();
    snapAll(S, st); S.dice.forEach(d => d.setFace(5));
    S.auto = !!opts.auto;
    const coins0 = ctx.coins, stake = await chooseStake(ctx, S, opts.stake);
    const bots = S.seats.slice(1); bots.forEach(b => b.setCoins(b.coins - stake));
    const pot = stake * 4;
    const potStack = ctx.stack(pot, BS / 2 + .9, -BS / 2 + .6);
    const forced = (opts.dice || []).slice(), log = [];
    const roll = () => (forced.length ? forced.shift() : 1 + Math.floor(Math.random() * 6));
    let pl = 0, turns = 0, kicks = 0, winner = -1, forfeit = false;
    drawPanel(S, st, pot, 0);
    S.seats[1].say(ctx.pick(['Ngựa ơi chạy nhanh lên! 🐴', 'Đổ 6 đi nào!', 'Ván này hũ to nha 😎']));
    // action bar for your turns
    const acts = ctx.ui.actions([
      { id: 'roll', label: 'GIEO', cls: 'pink', icon: 'emoji-fluent-3d/game/game_die.png', onClick: () => S.rollReq && S.rollReq() },
      { id: 'auto', label: 'Tự đi: Tắt', cls: 'sky', icon: 'emoji-fluent-3d/reactions/robot.png', onClick: () => { S.auto = !S.auto; acts.set('auto', { label: 'Tự đi: ' + (S.auto ? 'Bật' : 'Tắt') }); if (S.auto && S.rollReq) S.rollReq(); if (S.auto && S.pickReq) S.pickReq(null); } },
      { id: 'quit', label: 'Bỏ cuộc', cls: 'grey', icon: 'emoji-fluent-3d/reactions/face_holding_back_tears.png', onClick: async () => { if (forfeit || winner >= 0) return; const ok = opts.script ? true : (await ctx.ui.modal({ title: 'Bỏ cuộc?', html: '<p>Bạn sẽ mất tiền cược, hũ thuộc về bot đang dẫn đầu.</p>', width: 760, buttons: [{ label: 'Bỏ cuộc', cls: 'pink' }, { label: 'Chơi tiếp', cls: 'grey' }] })) === 'Bỏ cuộc'; if (ok) { forfeit = true; if (S.rollReq) S.rollReq(); if (S.pickReq) S.pickReq(null); } } },
    ]);
    acts.set('auto', { label: 'Tự đi: ' + (S.auto ? 'Bật' : 'Tắt') });
    S.quit = () => { forfeit = true; if (S.rollReq) S.rollReq(); if (S.pickReq) S.pickReq(null); };
    acts.set('roll', { disabled: true });
    const clearHi = () => { for (const p of S.pawns[0]) { p.userData.bob = false; p.userData.ring.visible = false; } S.targets.forEach(m => ctx.remove(m)); S.targets = []; };

    while (winner < 0 && !forfeit) {
      const seat = S.seats[pl], me = pl === 0;
      seat.turn(true); drawPanel(S, st, pot, pl);
      // ---- roll
      if (me) {
        acts.set('roll', { disabled: false }); ctx.ui.status('Lượt của bạn · bấm <b>GIEO</b>');
        await new Promise(res => { S.rollReq = res; if (S.auto) res(); else if (opts.script) Promise.resolve().then(() => opts.script(S, 'roll', { st })); });
        S.rollReq = null; acts.set('roll', { disabled: true });
        if (forfeit) { seat.turn(false); break; }
      } else { seat.anim('think'); ctx.ui.status(`<b>${seat.name}</b> đang gieo…`); await ctx.wait(320 * S.speed); }
      const v = roll(), die = S.dice[pl], [cr, cc] = yardCentre(pl);
      ctx.sfx('diceThrow', .45);
      die.position.set(wx(cc) + (pl < 2 ? 1 : -1) * .9, Y_BOARD + .9, wz(cr) + (pl === 0 || pl === 3 ? 1 : -1) * .9);
      await die.roll(v - 1, wx(cc), wz(cr), 700 * S.speed);
      die.position.y = Y_BOARD + .31;
      const moves = R.distinctMoves(R.legalMoves(st, pl, v));
      log.push({ pl, v, n: moves.length });
      // ---- choose
      let mv = null;
      if (!moves.length) {
        if (me) ctx.ui.toast(v === 6 ? 'Không đi được, nhưng được gieo thêm!' : 'Không có ngựa nào đi được', 'emoji-fluent-3d/reactions/thinking_face.png');
        else if (Math.random() < .3) seat.say(ctx.pick(['Huhu không ra 1 với 6 😭', 'Xui quá…', 'Chờ tí nữa thôi!']));
        await ctx.wait(450 * S.speed);
      } else if (me && !S.auto && moves.length > 1) {
        // highlight the movable horses and where they would land
        ctx.ui.status(`Đổ được <b>${v}</b> · chạm ngựa đang nhún`);
        for (const m of moves) {
          const horses = m.from === -1 ? [0, 1, 2, 3].filter(h => st.horses[0][h] === -1) : [m.h];
          for (const h of horses) { const u = S.pawns[0][h].userData; u.bob = true; u.ring.visible = true; }
          const s = spot(S, 0, m.to, m.h, R.homeCount(st, 0)), T = ctx.THREE;
          const t = new T.Mesh(S.targetGeo, new T.MeshBasicMaterial({ color: m.kick ? 0xff2d6f : 0xff8fc0, transparent: true, opacity: .6, depthWrite: false, toneMapped: false })); t.rotation.x = -Math.PI / 2; t.position.set(s.x, Y_BOARD + .02, s.z);
          const rg = new T.Mesh(S.targetRing, new T.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, toneMapped: false })); rg.position.z = .002; t.add(rg); ctx.add(t); S.targets.push(t);
        }
        mv = await new Promise(res => {
          S.pickReq = res;
          S.tapHorse = (tpl, h) => { if (tpl !== 0) return; const p = st.horses[0][h]; const m = moves.find(x => (p === -1 ? x.from === -1 : x.h === h)); if (m) res(p === -1 ? Object.assign({}, m, { h }) : m); else ctx.sfx('error', .3); };
          if (opts.script) Promise.resolve().then(() => opts.script(S, 'pick', { st, moves, v }));
        });
        S.pickReq = null; S.tapHorse = null; clearHi();
        if (forfeit) { seat.turn(false); break; }
        if (!mv) mv = R.chooseMove(st, 0, v, moves);            // switched to auto while choosing
      } else {
        if (!me) { seat.anim('think'); await ctx.wait(260 * S.speed); }
        mv = me && !S.auto ? moves[0] : R.chooseMove(st, pl, v, moves, Math.random, me || !ctx.room ? undefined : ctx.aiLevel(1));
        if (me) await ctx.wait(220 * S.speed);
      }
      // ---- move
      if (mv) {
        const finCount = R.homeCount(st, pl);
        R.apply(st, pl, mv);
        await animateMove(S, st, pl, mv, finCount);
        if (mv.kick) {
          kicks++; const victim = S.seats[mv.kick.pl];
          if (!me) { seat.anim('cheer'); seat.say(ctx.pick(['Đá nè! 🦶', 'Về chuồng đi bạn ơi 😆', 'Hehe xin lỗi nha'])); }
          if (victim.me) ctx.ui.toast('Ngựa của bạn bị đá về chuồng 😭', 'emoji-fluent-3d/reactions/crying_face.png'); else victim.anim('sad');
          if (me) ctx.ui.callout('ĐÁ!', COL[0].css);
        }
        if (mv.finish && !me && Math.random() < .5) seat.say('Một con về đích! 🏁');
        drawPanel(S, st, pot, pl);
        winner = R.winner(st);
      }
      seat.turn(false);
      if (winner >= 0) break;
      if (v === 6) { if (me) ctx.ui.toast('Đổ 6, được gieo thêm!', 'emoji-fluent-3d/game/game_die.png'); else if (Math.random() < .4) seat.say('Thêm lượt nữa! 🎲'); }
      const nx = R.nextPlayer(pl, v); if (nx !== pl) turns++; pl = nx;
      if (opts.maxTurns && turns >= opts.maxTurns) break;
    }
    // ---- settle
    ctx.ui.clearActions(); clearHi(); ctx.remove(potStack);
    if (forfeit || winner < 0) { let best = 1; for (let i = 2; i < 4; i++) if (R.homeCount(st, i) * 100 + R.progress(st, i) > R.homeCount(st, best) * 100 + R.progress(st, best)) best = i; winner = forfeit ? best : winner; }
    const order = [0, 1, 2, 3].sort((a, b) => (b === winner) - (a === winner) || R.homeCount(st, b) - R.homeCount(st, a) || R.progress(st, b) - R.progress(st, a));
    if (winner === 0) { ctx.win(pot, new T.Vector3(0, 1, 3)); ctx.ui.callout('VỀ NHẤT!'); ctx.ui.confetti(); ctx.sfx('win', .5); bots.forEach(b => b.anim('sad')); }
    else if (winner > 0) { ctx.sfx('lose', .4); S.seats[winner].anim('cheer'); S.seats[winner].say('Về nhất rồi! 🏆'); S.seats[winner].setCoins(S.seats[winner].coins + pot); bots.forEach(b => { if (b !== S.seats[winner]) b.anim('sad'); }); }
    ctx.ui.status(winner === 0 ? 'Bạn về nhất, ăn cả hũ! 🎉' : forfeit ? 'Bạn đã bỏ cuộc' : `${S.seats[winner].name} về nhất`);
    const out = { winner, forfeit, stake, pot, coinsDelta: ctx.coins - coins0, turns, kicks, horses: st.horses.map(h => h.slice()), synced: synced(S, st) };
    const rows = order.map(i => ({ name: S.seats[i].me ? S.seats[i].name + ' (bạn)' : S.seats[i].name, avatar: S.seats[i].avatar, me: S.seats[i].me, detail: `Ngựa ${COL[i].name} · về đích ${R.homeCount(st, i)}/4${i === 0 && forfeit ? ' · bỏ cuộc' : ''}`, amount: i === winner ? pot - stake : -stake, tag: i === winner ? 'Về nhất' : null }));
    await ctx.wait(500);
    const title = winner === 0 ? 'Bạn về nhất!' : 'Ván đã xong';
    if (ctx.TEST) { ctx.ui.results(title, rows); await ctx.wait(200); ctx.ui.closeModal(); }
    else await ctx.ui.results(title, rows, { again: 'Ván mới' });
    return out;
  }
  /** Every pawn stands where the rules state says it is. */
  function synced(S, st) {
    for (let pl = 0; pl < 4; pl++) for (let h = 0; h < 4; h++) {
      const p = st.horses[pl][h], m = S.pawns[pl][h]; if (p === S.R.FINISH) continue;
      const s = spot(S, pl, p, h); if (Math.abs(m.position.x - s.x) > .02 || Math.abs(m.position.z - s.z) > .02) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ demo + self-test
  function demoOpts(S) {
    const st = S.R.newState();
    st.horses = [[3, 17, -1, 56], [6, 30, -1, -1], [12, 40, -1, -1], [45, 2, -1, -1]];
    let rolled = false;
    return { stake: 10000, state: st, dice: [6], script: (S2, kind) => { if (kind === 'roll' && !rolled) { rolled = true; S.rollReq(); } } };
  }
  async function selftest(ctx) {
    const S = await setup(ctx), R = S.R, out = { games: [], checks: {} }, stake = 10000, c0 = ctx.coins;
    S.speed = .5;
    // A. kick then finish: Đỏ has three horses home and one at 47; a Xanh lá horse waits 3 cells ahead
    const A0 = R.newState(); A0.horses = [[56, 56, 56, 47], [37, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]];
    let afterKick = null;
    const A = await game(ctx, S, { stake, state: A0, dice: [3, 2, 2, 2, 6], script: (S2, kind, info) => { if (kind === 'roll') { if (info.st.horses[0][3] === 50) afterKick = info.st.horses[1][0]; S.rollReq(); } } });
    out.games.push(A); out.checks.kickAndWin = A.winner === 0 && A.kicks === 1 && afterKick === -1 && A.coinsDelta === stake * 3;
    // B. choosing between several horses: roll 6 with one horse out → tap the horse on the board (not the stable)
    const B0 = R.newState(); B0.horses = [[10, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]];
    let picked = null, choices = 0;
    const B = await game(ctx, S, { stake, state: B0, dice: [6, 2, 3, 3, 3, 4], script: (S2, kind, info) => {
      if (kind === 'pick') { choices = info.moves.length; S.tapHorse(0, 0); }
      else if (kind === 'roll') { if (info.st.horses[0][0] === 18) { picked = info.st.horses[0].slice(); S.quit(); } else S.rollReq(); }
    } });
    out.games.push(B); out.checks.pickHorse = choices === 2 && picked && picked[0] === 18 && picked.slice(1).every(p => p === -1) && B.forfeit && B.coinsDelta === -stake;
    // C. near the end for everyone, random dice, you on auto: someone must win and the wallet must match
    const C0 = R.newState(); C0.horses = [[56, 56, 50, 44], [56, 56, 56, 40], [56, 56, 49, 30], [56, 56, 56, 35]];
    const C = await game(ctx, S, { stake, state: C0, auto: true });
    out.games.push(C); out.checks.autoGame = C.winner >= 0 && C.coinsDelta === (C.winner === 0 ? stake * 3 : -stake);
    out.checks.synced = out.games.every(g => g.synced);
    out.coinsDelta = ctx.coins - c0; out.checks.wallet = out.coinsDelta === out.games.reduce((a, g) => a + g.coinsDelta, 0);
    const ok = Object.values(out.checks).every(Boolean);
    return Object.assign(out, { pass: ok ? 1 : 0, fail: ok ? 0 : 1 });
  }
})();
