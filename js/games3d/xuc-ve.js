/* Máy Xúc Vé 3D — a candy-scoop style arcade machine full of ticket rolls. Rules, physics and odds: js/games3d/rules/xuc-ve.js.
 * World layout (x right, z toward the camera): the pusher shelf's back wall is at z = Z0 and its front edge at Z0 + FRONT;
 * shelf rolls use the rules' shelf coordinates (x, z) → world (x, Z0 + z). Behind the back wall, a raised bin holds the heap;
 * the scoop arm turns around a pivot at (0, PIVOT_Y, PIVOT_Z): at angle θ the scoop is at (L·sinθ, PIVOT_Z − L·cosθ),
 * so θ = π puts it over the shelf at shelf z = DROP_Z, where it tips the rolls out.
 * One machine for all scoop sizes; it is saved in HC.store 'xucve_m' (heap, random stream, every roll on the shelf).
 */
(function () {
  'use strict';
  const KEY = 'xuc-ve';
  /** Lobby rooms (js/t3-lobby.js): the scoop size; `stakes` is the price of one scoop. All rooms share one machine. */
  const ROOMS = [
    { id: 'nho', name: 'Muỗng Nhỏ', stakes: [30000], min: 150000, lv: 1, scene: 'sakura', color: '#c2407a', grad: ['#ffd1e3', '#ff8fbf'] },
    { id: 'vua', name: 'Muỗng Vừa', stakes: [60000], min: 300000, lv: 1, scene: 'sky', color: '#1f6fc0', grad: ['#d3ecff', '#6fbfff'] },
    { id: 'to', name: 'Muỗng Lớn', stakes: [120000], min: 600000, lv: 3, scene: 'tet', color: '#a86d00', grad: ['#fff1c2', '#ffc93c'] },
  ];
  const Z0 = -0.8, PIVOT_Z = -1.7, PIVOT_Y = 3.7, ARM_L = 2.6, BIN_Y = 1.4, PUSH_TOP = .55, ROLL_H = .3, SCOOP_UP = 3.0, SCOOP_DIG = 1.85, SCOOP_POUR = 2.25;
  const CAM = { pos: [0, 12.6, 12.0], look: [0, -.5, .9] };
  let G = null, R = null;

  T3.register(KEY, {
    title: 'Máy Xúc Vé', sub: 'Canh muỗng trên đống vé cao nhất rồi bấm XÚC · khay đẩy vé rơi ra là trúng',
    table: 'none', theme: 'lemon', fov: 46, scripts: ['js/games3d/rules/xuc-ve.js'],
    models: ['mini_star', 'hp_monstera', 'hp_yucca', 'hp_pothos'],
    rooms: ROOMS, stakeName: 'Giá xúc', botLabel: false,
    cam: CAM,
    rules: '<p>Đang tải luật…</p>',
    async start(ctx) { await setup(ctx, {}); },
    async selftest(ctx) { return selftest(ctx); },
  });

  // ==================================================================== helpers
  const short = n => HC.short(n);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function track(type, data) {
    try {
      const c = G && G.ctx; data = Object.assign({ game: KEY }, data);
      if (c && typeof c.track === 'function') { if (type === 'round') { c.track('round', data); c.roundBet = 0; } return; }   // the framework reports bets and wins itself
      if (window.HC && HC.prog && HC.prog.track) HC.prog.track(type, data);
    } catch (e) {}
  }
  const hash = (a, b) => { let h = Math.imul(a + 1, 2654435761) ^ Math.imul(b + 7, 40503); h ^= h >>> 13; h = Math.imul(h, 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function rulesHtml() {
    const rows = R.ROLLS.map(r => `<span style="display:inline-flex;align-items:center;gap:6px;margin:4px 10px 4px 0"><i style="display:inline-block;width:30px;height:30px;border-radius:50%;background:${r.top};border:5px solid ${r.ring}"></i><b style="color:${r.ink}">${r.label}</b><small>${(r.w / R.W_TOTAL * 100).toFixed(r.w / R.W_TOTAL < .01 ? 1 : 0)}%</small></span>`).join('');
    return `<p>Cánh tay máy đung đưa trên <b>thùng vé</b>. Bấm <b>XÚC!</b> (hoặc chạm màn hình, phím <b>Space</b>) đúng lúc muỗng ở trên <b>đống vé cao nhất</b>: càng trúng đống cao, muỗng càng đầy. Thanh canh giờ ở dưới cho thấy chỗ nào đống vé cao (cột xanh).</p>
      <ul><li>Chọn cỡ muỗng ở sảnh (hoặc bảng bên trái): <b>${R.TIERS.map(t => `${t.name} ${short(t.price)} (tối đa ${t.cap} cuộn)`).join(' · ')}</b>. Muỗng to hơn xúc nhiều hơn, tỉ lệ trả thưởng như nhau.</li>
      <li>Muỗng đổ vé lên <b>kệ đẩy</b>. Khay đẩy tới lui, cuộn nào bị đẩy rơi ở <b>mép trước</b> thì bạn nhận đúng số xu in trên cuộn. Rơi ở <b>hai góc</b> (rãnh xám) thì cuộn trượt về thùng.</li>
      <li>Cuộn chưa rơi <b>nằm lại trên kệ</b> cho lượt sau, nên kệ càng lúc càng đầy, có lúc đổ ào một loạt!</li>
      <li>Trong thùng, cuộn vé chưa lộ giá: xúc lên mới biết. Máy tự rải thêm vé vào thùng thành đống mới.</li>
      <li>Về lâu dài máy trả lại khoảng <b>85–95%</b> số xu bỏ vào nếu bạn canh giờ tốt, bấm bừa thì ít hơn nhiều.</li></ul>
      <p>Các loại cuộn vé (tỉ lệ ra):</p><p>${rows}</p>`;
  }

  // ==================================================================== setup
  async function setup(ctx, opts) {
    const T = ctx.THREE; R = window.Rules[KEY];
    T3.modules[KEY].rules = rulesHtml();
    const want = (ctx.room && ctx.room.id) || ctx.Q.get('room') || HC.store.get('xucve_tier', 'vua');
    G = { ctx, T, opts, test: !!opts.test, demo: ctx.Q.has('demo') && !opts.test, tier: R.TIER[want] ? want : 'vua', swingT: R.SWING * .1, theta: 0, busy: false,
      meshes: new Map(), sess: { scoops: 0, spent: 0, won: 0, rolls: {}, back: 0, round: 0 }, log: [], saveT: 0, falling: [] };
    const saved = G.test || G.demo || ctx.SHOT ? null : R.load(HC.store.get('xucve_m', null));
    G.M = saved || R.create({ seed: G.test || G.demo || ctx.SHOT ? 20261023 : ((Date.now() ^ (Math.random() * 1e9)) >>> 0) });
    ctx.music('dice');
    buildRoom(); buildMachine(); buildHud(); bindInput();
    syncPile(); syncShelf();
    ctx.onFrame(update);
    addEventListener('pagehide', saveMachine);
    status();
    if (G.demo) demoLoop();
  }
  function saveMachine() { if (G && !G.test && !G.demo && !G.ctx.SHOT) HC.store.set('xucve_m', R.save(G.M)); }
  const tier = () => R.TIER[G.tier];

  // ==================================================================== textures & materials
  function mat(hex, o = {}) { return G.ctx.mat(hex, Object.assign({ roughness: .6 }, o)); }
  function box(w, h, d, m, x, y, z, parent, r = .12) { const T = G.T, mesh = new T.Mesh(G.ctx.H.roundedBox(w, h, d, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001), 2), m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; (parent || G.ctx.scene).add(mesh); return mesh; }
  /** Top face of a roll: paper spiral + printed value. */
  function rollTop(r) {
    G.tops = G.tops || {};
    if (G.tops[r.id]) return G.tops[r.id];
    const t = T3.canvasTex(256, 256, (x, w) => {
      const c = w / 2;
      if (r.gold) { const g = x.createRadialGradient(c, c, 10, c, c, c); g.addColorStop(0, '#fffbe0'); g.addColorStop(.6, '#ffd84d'); g.addColorStop(1, '#ffb300'); x.fillStyle = g; } else x.fillStyle = r.top;
      x.beginPath(); x.arc(c, c, c, 0, 7); x.fill();
      x.strokeStyle = r.gold ? 'rgba(168,109,0,.35)' : 'rgba(255,255,255,.75)'; x.lineWidth = 3;
      for (let k = 30; k < c - 8; k += 11) { x.beginPath(); x.arc(c, c, k, 0, 7); x.stroke(); }
      x.lineWidth = 16; x.strokeStyle = r.ring; x.beginPath(); x.arc(c, c, c - 9, 0, 7); x.stroke();
      x.font = `400 ${r.label.length > 3 ? 70 : 84}px "Grandstander Black"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      x.lineWidth = 16; x.strokeStyle = '#fff'; x.strokeText(r.label, c, c + 6); x.fillStyle = r.ink; x.fillText(r.label, c, c + 6);
      if (r.gold) { x.fillStyle = '#fff'; for (const [a, d] of [[.6, .62], [2.4, .7], [4.2, .6]]) { x.save(); x.translate(c + Math.cos(a) * c * d, c + Math.sin(a) * c * d); x.beginPath(); for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4, rr = i % 2 ? 4 : 13; x.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } x.fill(); x.restore(); } }
    });
    return (G.tops[r.id] = new G.T.MeshStandardMaterial({ map: t, roughness: r.gold ? .3 : .6, metalness: r.gold ? .35 : 0, emissive: r.gold ? new G.T.Color(0x553300) : new G.T.Color(0), emissiveIntensity: r.gold ? .5 : 0 }));
  }
  function rollSide(r) {
    G.sides = G.sides || {};
    if (G.sides[r.id]) return G.sides[r.id];
    const t = T3.canvasTex(256, 64, (x, w, h) => {
      x.fillStyle = r.gold ? '#ffd23f' : '#ffffff'; x.fillRect(0, 0, w, h);
      x.fillStyle = r.ring; for (let i = 0; i < 4; i++) x.fillRect(0, 6 + i * 15, w, 5);
      x.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 16; i++) x.fillRect(i * 16, 0, 2, h);
    });
    return (G.sides[r.id] = new G.T.MeshStandardMaterial({ map: t, roughness: .55, metalness: r.gold ? .3 : 0 }));
  }
  function rollMesh(kind) {
    const T = G.T, r = R.BY_ID[kind], rad = R.R_ROLL * (r.gold ? 1.08 : 1);
    G.rollGeo = G.rollGeo || new T.CylinderGeometry(R.R_ROLL, R.R_ROLL, ROLL_H, 28);
    const m = new T.Mesh(G.rollGeo, [rollSide(r), rollTop(r), rollSide(r)]); m.castShadow = true; m.receiveShadow = true;
    if (r.gold) m.scale.set(1.08, 1.1, 1.08);
    m.userData.kind = kind; m.userData.rad = rad;
    return m;
  }

  // ==================================================================== room
  function buildRoom() {
    const { ctx, T } = G;
    const floorTex = T3.canvasTex(256, 256, (x, w) => { const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? '#fff1c9' : '#fffaf0'; x.fillRect(i * s, j * s, s, s); } });
    floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; floorTex.repeat.set(16, 16);
    const floor = new T.Mesh(new T.PlaneGeometry(110, 110), new T.MeshStandardMaterial({ map: floorTex, roughness: .85 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -3.4; floor.receiveShadow = true; ctx.add(floor);
    const wallTex = T3.canvasTex(512, 512, (x, w, h) => {
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#fff4d6' : '#ffe9b0'; x.fillRect(i * w / 8, 0, w / 8, h); }
      x.font = '400 58px "Grandstander Black"'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? 'rgba(255,184,28,.45)' : 'rgba(255,111,168,.35)'; x.fillText((i + j) % 2 ? '★' : '●', i * 128 + 64, j * 128 + 64); }
    });
    wallTex.wrapS = wallTex.wrapT = T.RepeatWrapping; wallTex.repeat.set(7, 3);
    const wall = new T.Mesh(new T.PlaneGeometry(90, 34), new T.MeshStandardMaterial({ map: wallTex, roughness: .9 })); wall.position.set(0, 12, -9); ctx.add(wall);
    const deco = [['hp_monstera', -6.4, -6.2, 1.6], ['hp_yucca', 6.6, -6.3, 1.6], ['hp_pothos', -9.6, -3.5, 1.4]];
    deco.forEach(([k, x, z, s]) => ctx.H.load(k).then(g => { const o = ctx.H.clone(g); o.scale.setScalar(s); o.position.set(x, -3.4, z); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); ctx.add(o); }).catch(() => {}));
    // giant ticket rolls stacked around the machine
    for (const [x, z, n, ks] of [[-6.2, -1.6, 4, ['r10', 'r20', 'r50', 'r100']], [-7.6, 2.4, 3, ['r20', 'r10', 'r200']], [6.3, -1.2, 5, ['r10', 'r50', 'r20', 'r10', 'r500']], [7.7, 2.8, 2, ['r100', 'r20']]]) {
      for (let i = 0; i < n; i++) { const m = rollMesh(ks[i % ks.length]); m.scale.set(2.3, 2.6, 2.3); m.position.set(x + (i % 2) * .12, -3.4 + .39 + i * .8, z); m.rotation.y = i * .7 + x; ctx.add(m); }
    }
    ctx.keyLight.position.set(5, 20, 12); ctx.keyLight.target.position.set(0, 0, 0);
    Object.assign(ctx.keyLight.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11 }); ctx.keyLight.shadow.camera.updateProjectionMatrix();
  }

  // ==================================================================== machine
  function buildMachine() {
    const { ctx, T } = G, sh = G.M.shelf, W = sh.W, F = sh.FRONT, g = G.mach = new T.Group(); ctx.add(g);
    const M = G.mats = { body: mat(0xffc93c, { roughness: .45 }), trim: mat(0xffffff, { roughness: .35 }), pink: mat(0xff8fbf, { roughness: .45 }), dark: mat(0x4a2a3a, { roughness: .7 }),
      chrome: mat(0xeeeef6, { metalness: .7, roughness: .22 }), gold: mat(0xffd34d, { metalness: .55, roughness: .28 }) };
    const front = Z0 + F, cabFront = front + 1.35, back = PIVOT_Z - ARM_L - 1.0, depth = cabFront - back, midZ = (cabFront + back) / 2;
    // cabinet: the tall body under the shelf and the bin, a lower front part under the prize tray
    const bodyD = front - back;
    box(2 * W + 1.2, 3.4, bodyD, M.body, 0, -1.72, back + bodyD / 2, g, .35);
    box(2 * W + 1.3, .24, bodyD + .1, M.trim, 0, -.08, back + bodyD / 2, g, .1);
    box(2 * W + 1.2, 2.1, cabFront - front + .2, M.body, 0, -2.35, (front + cabFront) / 2 - .1, g, .3);
    box(2 * W + 1.3, .3, depth + .1, M.trim, 0, -3.3, midZ, g, .1);
    // shelf floor with chevrons, gold win lip, grey gutters
    const floorTex = T3.canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#fff3f8'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,111,168,.22)'; x.lineWidth = 16; x.lineCap = 'round';
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const cx = 64 + i * 128, cy = 70 + j * 128; x.beginPath(); x.moveTo(cx - 34, cy - 14); x.lineTo(cx, cy + 16); x.lineTo(cx + 34, cy - 14); x.stroke(); }
    });
    const shelfFloor = new T.Mesh(new T.PlaneGeometry(2 * W, F), new T.MeshStandardMaterial({ map: floorTex, roughness: .7 })); shelfFloor.rotation.x = -Math.PI / 2; shelfFloor.position.set(0, 0, Z0 + F / 2); shelfFloor.receiveShadow = true; g.add(shelfFloor);
    const winW = 2 * (W - sh.GUTTER);
    box(winW, .12, .22, M.gold, 0, -.02, front + .02, g, .05);
    for (const s of [-1, 1]) { const gx = s * (W - sh.GUTTER / 2); box(sh.GUTTER, .1, .2, mat(0x9a8aa6), gx, -.03, front + .02, g, .04); }
    // side walls of the shelf (low, clear) + rails
    const glassM = new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .14, roughness: .05, depthWrite: false, side: T.DoubleSide });
    const sideA = PIVOT_Z - ARM_L - .7, sideL = front - sideA, sideC = (front + sideA) / 2;
    for (const s of [-1, 1]) {
      const p = new T.Mesh(new T.PlaneGeometry(sideL, 1.5), glassM); p.rotation.y = Math.PI / 2; p.position.set(s * (W + .05), .75, sideC); g.add(p);
      box(.18, .2, sideL, M.trim, s * (W + .1), 1.5, sideC, g, .06);
      box(.4, 2.9, .4, M.pink, s * (W + .2), .15, front + .2, g, .12);
    }
    // the pit in front of the edge: the tray in the middle, chutes back to the bin on the corners
    const pitM = mat(0x5a2342, { roughness: .8 });
    for (const s of [-1, 1]) box(sh.GUTTER + .3, .08, cabFront - front - .1, pitM, s * (W - sh.GUTTER / 2 + .15), -1.26, (front + cabFront) / 2, g, .03);
    box(winW, .45, cabFront - front - .15, mat(0xffe27a, { roughness: .4 }), 0, -1.08, (front + cabFront) / 2, g, .14);
    box(winW - .3, .06, cabFront - front - .45, mat(0xfff6c2, { roughness: .5 }), 0, -.84, (front + cabFront) / 2, g, .03);
    const trayLbl = new T.Mesh(new T.PlaneGeometry(winW * .8, .42), new T.MeshBasicMaterial({ map: T3.canvasTex(1024, 128, (x, w, h) => { x.font = '400 92px "Grandstander Black"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 14; x.strokeStyle = '#a86d00'; x.strokeText('▼ VÉ RƠI LÀ TRÚNG ▼', w / 2, h / 2 + 6); x.fillStyle = '#fff'; x.fillText('▼ VÉ RƠI LÀ TRÚNG ▼', w / 2, h / 2 + 6); }), transparent: true }));
    trayLbl.position.set(0, -1.95, cabFront + .03); g.add(trayLbl);
    for (const s of [-1, 1]) {
      const lb = new T.Mesh(new T.PlaneGeometry(1.1, .38), new T.MeshBasicMaterial({ map: T3.canvasTex(256, 90, (x, w, h) => { T3.rr(x, 4, 4, w - 8, h - 8, 36); x.fillStyle = '#9a8aa6'; x.fill(); x.font = '400 50px "Grandstander Black"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText('↩ thùng', w / 2, h / 2 + 3); }), transparent: true }));
      lb.position.set(s * (W - sh.GUTTER / 2 + .2), -1.95, cabFront + .03); g.add(lb);
    }
    const frontGlass = new T.Mesh(new T.PlaneGeometry(2 * W + .6, 1.6), glassM); frontGlass.position.set(0, -.5, cabFront - .02); g.add(frontGlass);
    box(2 * W + .8, .16, .16, M.trim, 0, .3, cabFront - .02, g, .05);
    // the pusher (its top is a little shelf too)
    G.pusher = new T.Group(); g.add(G.pusher);
    const pTex = T3.canvasTex(512, 128, (x, w, h) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#ff8fbf'; x.beginPath(); x.moveTo(i * 40 - 20, h); x.lineTo(i * 40 + 20, 0); x.lineTo(i * 40 + 60, 0); x.lineTo(i * 40 + 20, h); x.fill(); } });
    const pBody = new T.Mesh(G.ctx.H.roundedBox(2 * W - .04, PUSH_TOP, 3.2, .06, 2), [mat(0xff8fbf), mat(0xff8fbf), mat(0xfff0f6, { roughness: .5 }), mat(0xff8fbf), new T.MeshStandardMaterial({ map: pTex, roughness: .5 }), mat(0xff8fbf)]);
    pBody.position.set(0, PUSH_TOP / 2, -1.6); pBody.castShadow = true; pBody.receiveShadow = true; G.pusher.add(pBody);
    // back wall over the pusher, the raised bin behind it
    const binFront = Z0 - .05, binBack = back + .3, binD = binFront - binBack, binMid = (binFront + binBack) / 2;
    box(2 * W + .3, BIN_Y + .45 - PUSH_TOP - .05, .3, M.trim, 0, (BIN_Y + .45 + PUSH_TOP + .05) / 2, binFront - .1, g, .08);
    box(2 * W + .3, .3, binD, mat(0xfff0c2, { roughness: .8 }), 0, BIN_Y - .15, binMid, g, .08);
    box(2 * W + .3, .9, .3, M.pink, 0, BIN_Y + .3, binBack - .1, g, .1);
    for (const s of [-1, 1]) box(.3, .9, binD, M.pink, s * (W + .05), BIN_Y + .3, binMid, g, .1);
    const binFloor = new T.Mesh(new T.CircleGeometry(ARM_L + .9, 48, Math.PI * .5 - R.ARC - .45, 2 * R.ARC + .9), mat(0xffe3a1, { roughness: .9 }));
    binFloor.rotation.x = -Math.PI / 2; binFloor.position.set(0, BIN_Y + .01, PIVOT_Z); g.add(binFloor);
    // backboard with the sign
    const board = box(2 * W + 1.2, 3.4, .35, M.body, 0, BIN_Y + 1.9, binBack - .45, g, .3);
    G.sign = new T.Mesh(new T.PlaneGeometry(2 * W + .6, 1.5), new T.MeshStandardMaterial({ roughness: .5, emissive: 0xffffff, emissiveIntensity: .1, map: T3.canvasTex(1024, 256, (x, w, h) => {
      T3.rr(x, 8, 8, w - 16, h - 16, 70); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 14; x.strokeStyle = '#ff6fa8'; x.stroke();
      x.font = '400 128px "Grandstander Black"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = 22; x.strokeStyle = '#ffe27a'; x.strokeText('MÁY XÚC VÉ', w / 2, h / 2 + 8); x.fillStyle = '#ff4f95'; x.fillText('MÁY XÚC VÉ', w / 2, h / 2 + 8);
    }) }));
    G.sign.position.set(0, BIN_Y + 2.6, binBack - .26); g.add(G.sign);
    G.bulbs = []; const bOn = mat(0xfff6c2, { emissiveHex: 0xffe27a, emissiveIntensity: 1.1, roughness: .3 }), bOff = mat(0xffe7b0, { roughness: .4 }); G.bulbMats = [bOn, bOff];
    for (let i = 0; i < 18; i++) { const b = new T.Mesh(new T.SphereGeometry(.08, 10, 8), bOn); b.position.set(-W - .2 + i * ((2 * W + .4) / 17), BIN_Y + 3.5, binBack - .26); g.add(b); G.bulbs.push(b); }
    G.ctx.H.load('mini_star').then(gl => { const st = G.ctx.H.clone(gl); st.scale.setScalar(1.6); st.position.set(0, BIN_Y + 3.75, binBack - .45); g.add(st); G.star = st; }).catch(() => {});
    // pile (one instanced mesh: mystery rolls in pastel colours)
    const N = R.PILE_N + 4;
    G.pileGeo = new T.CylinderGeometry(R.R_ROLL * .92, R.R_ROLL * .92, ROLL_H, 18);
    G.pile = new T.InstancedMesh(G.pileGeo, new T.MeshStandardMaterial({ roughness: .55, map: T3.canvasTex(128, 32, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 3; i++) x.fillRect(0, 5 + i * 10, w, 3); }) }), N);
    G.pile.castShadow = true; G.pile.receiveShadow = true; G.pile.count = 0; g.add(G.pile);
    // arm + scoop
    const arm = G.arm = new T.Group(); arm.position.set(0, PIVOT_Y, PIVOT_Z); g.add(arm);
    const post = new T.Mesh(new T.CylinderGeometry(.22, .3, PIVOT_Y - BIN_Y, 20), M.chrome); post.position.set(0, (BIN_Y + PIVOT_Y) / 2 - .1, PIVOT_Z); post.castShadow = true; g.add(post);
    const hub = new T.Mesh(new T.CylinderGeometry(.42, .42, .36, 28), M.gold); hub.castShadow = true; arm.add(hub);
    const cap = new T.Mesh(new T.SphereGeometry(.42, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xff6fa8, { roughness: .35 })); cap.position.y = .18; arm.add(cap);
    const beam = new T.Mesh(G.ctx.H.roundedBox(.34, .26, ARM_L, .1, 2), M.chrome); beam.position.set(0, 0, -ARM_L / 2); beam.castShadow = true; arm.add(beam);
    G.rod = new T.Mesh(new T.CylinderGeometry(.06, .06, 1, 10), M.chrome); arm.add(G.rod);
    G.scoop = new T.Group(); arm.add(G.scoop);
    G.bucket = new T.Group(); G.scoop.add(G.bucket);
    G.inScoop = [];
    buildBucket();
    placeScoop(SCOOP_UP);
  }
  function buildBucket() {
    const T = G.T, t = tier(), b = G.bucket; while (b.children.length) b.remove(b.children[0]);
    const w = [0, .95, 1.25, 1.6][R.TIERS.indexOf(t) + 1], col = new T.Color(t.color).getHex(), m = mat(col, { roughness: .4, side: T.DoubleSide });
    const back = new T.Mesh(new T.CylinderGeometry(.45, .45, w, 24, 1, true, Math.PI, Math.PI), m); back.rotation.z = Math.PI / 2; back.castShadow = true; b.add(back);
    for (const s of [-1, 1]) { const end = new T.Mesh(new T.CircleGeometry(.45, 24, Math.PI, Math.PI), m); end.rotation.y = s * Math.PI / 2; end.position.x = s * w / 2; b.add(end); }
    const lip = new T.Mesh(new T.CylinderGeometry(.05, .05, w + .08, 10), mat(0xffffff, { roughness: .3 })); lip.rotation.z = Math.PI / 2; lip.position.set(0, 0, .45); b.add(lip);
    b.userData.w = w;
  }
  /** Scoop height in world y (bucket centre). */
  function placeScoop(y) { G.scoopY = y; G.scoop.position.set(0, y - PIVOT_Y, -ARM_L); const len = PIVOT_Y - y - .1; G.rod.scale.y = Math.max(.05, len); G.rod.position.set(0, -len / 2, -ARM_L); }
  function setArm(theta) { G.theta = theta; G.arm.rotation.y = -theta; }
  /** World position of slot i's arc point. */
  const slotPos = i => { const th = R.slotAngle(i); return { x: ARM_L * Math.sin(th), z: PIVOT_Z - ARM_L * Math.cos(th) }; };
  /** Rebuild the heap from the bin's slot counts. Each roll in slot i, layer k sits at a fixed jittered spot. */
  function syncPile() {
    const T = G.T, m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), col = new T.Color(), pal = [0xffd6e8, 0xd6f3ff, 0xd8fbe9, 0xece3ff, 0xfff3b0, 0xffe3d3];
    let n = 0;
    for (let i = 0; i < R.SLOTS; i++) {
      const p = slotPos(i), c = G.M.pile[i], th = R.slotAngle(i);
      for (let k = 0; k < c && n < G.pile.instanceMatrix.count; k++) {
        const a = hash(i, k), b = hash(k, i + 31), radial = (a - .5) * .9, tang = (b - .5) * .35;
        const x = p.x + Math.sin(th) * radial + Math.cos(th) * tang, z = p.z - Math.cos(th) * radial + Math.sin(th) * tang;
        const y = BIN_Y + ROLL_H / 2 + Math.min(k, 7) * .17 + (k > 7 ? (k - 7) * .05 : 0);
        e.set((a - .5) * 1.1, b * 6.28, (b - .5) * 1.1); q.setFromEuler(e);
        m4.compose(new T.Vector3(x, y, z), q, new T.Vector3(1, 1, 1)); G.pile.setMatrixAt(n, m4); G.pile.setColorAt(n, col.set(pal[(i * 7 + k * 3) % pal.length]).convertSRGBToLinear()); n++;
      }
    }
    G.pile.count = n; G.pile.instanceMatrix.needsUpdate = true; if (G.pile.instanceColor) G.pile.instanceColor.needsUpdate = true;
    drawBar();
  }
  /** Keep one mesh per roll on the shelf, at the simulation's position. */
  function syncShelf() {
    const sh = G.M.shelf, seen = new Set();
    for (const it of sh.items) {
      if (it.state === 'gone') continue;
      seen.add(it.id);
      let m = G.meshes.get(it.id);
      if (!m) { m = rollMesh(it.kind); G.ctx.add(m); G.meshes.set(it.id, m); m.rotation.y = (it.rot % 1) - .5; }
      let y = ROLL_H / 2, x = it.x, z = Z0 + it.z;
      if (it.state === 'shelf') y = PUSH_TOP + ROLL_H / 2;
      else if (it.state === 'drop') y = it.y + ROLL_H / 2;
      else if (it.state === 'fall') { y = Math.max(-.62, ROLL_H / 2 + it.y * .6); z = Math.min(Z0 + sh.FRONT + 1.0, z); x = clamp(x, -sh.W - .2, sh.W + .2); m.rotation.x += .12; }
      m.position.set(x, y, z);
    }
    for (const [id, m] of G.meshes) if (!seen.has(id)) { G.ctx.remove(m); G.meshes.delete(id); }
  }

  // ==================================================================== HUD
  function buildHud() {
    const ctx = G.ctx, ui = ctx.ui;
    if (!document.getElementById('xv-css')) {
      const st = document.createElement('style'); st.id = 'xv-css';
      st.textContent = `.xvtier{position:absolute;left:16px;top:132px;padding:10px;display:flex;flex-direction:column;gap:8px}
        .xvt{display:flex;align-items:center;gap:10px;padding:6px 16px 6px 8px;border-radius:26px;cursor:pointer;border:4px solid transparent;transition:transform .12s}
        .xvt:hover{transform:translateX(3px)}.xvt.on{border-color:var(--c);background:#fffaf0;box-shadow:0 4px 0 var(--c)}.xvt.off{opacity:.45;pointer-events:none}
        .xvt i{width:46px;height:46px;border-radius:14px;background:var(--c);display:flex;align-items:center;justify-content:center;font:400 22px "Grandstander Black";color:#fff;font-style:normal;box-shadow:inset 0 -5px 0 rgba(0,0,0,.15)}
        .xvt b{display:block;font:400 23px "Grandstander Black";color:#7a2a56;line-height:1.05}.xvt span{display:block;font:800 19px "Baloo 2";color:#a86d00;line-height:1.1}
        .xvtally{position:absolute;right:16px;top:132px;width:270px;padding:12px 16px;display:flex;flex-direction:column;gap:4px;font:800 19px "Baloo 2";color:#7a5a6e}
        .xvtally .h{font:400 23px "Grandstander Black";color:#c2407a}.xvtally b{font:400 21px "Grandstander Black";color:#9b2c5e}.xvtally .pos{color:#2fae7a}.xvtally .neg{color:#d24a6a}
        .xvrolls{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:4px}
        .xvr{display:flex;align-items:center;gap:4px;padding:2px 4px;border-radius:12px;background:#fffaf0;font:400 17px "Grandstander Black";color:#7a5a6e}
        .xvr i{width:22px;height:22px;border-radius:50%;border:4px solid var(--c);background:var(--t);flex:none}.xvr.zero{opacity:.35}
        .xvdock{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:16px;padding:10px 16px 10px 22px;border-radius:50px}
        .xvbar{position:relative;width:520px;height:62px;border-radius:18px;background:#fff4dc;box-shadow:inset 0 3px 6px rgba(168,109,0,.18);overflow:hidden}
        .xvbar .b{position:absolute;bottom:0;border-radius:6px 6px 0 0;transition:height .3s,background .3s}
        .xvbar .k{position:absolute;top:-2px;bottom:-2px;width:8px;margin-left:-4px;border-radius:4px;background:#ff4f95;box-shadow:0 0 0 3px #fff,0 0 12px #ff4f95}
        .xvbar .t{position:absolute;left:10px;top:4px;font:400 16px "Grandstander Black";color:#c08f00;opacity:.8}
        .xvdock .gbtn{min-width:250px;height:90px;font-size:44px}.xvdock .gbtn small{position:absolute;right:-10px;top:-14px;padding:0 10px;border-radius:16px;background:#fff;color:#c2407a;font:400 22px/32px "Grandstander Black";text-shadow:none;box-shadow:0 3px 0 #f2a9c8}
        .xvq{position:absolute;padding:6px 20px;border-radius:24px;font:400 32px "Grandstander Black";color:#fff;white-space:nowrap;transform:translate(-50%,-100%);pointer-events:none;box-shadow:0 5px 0 rgba(0,0,0,.18);animation:xvq 1.5s ease-out forwards}
        @keyframes xvq{0%{opacity:0;transform:translate(-50%,-60%) scale(.6)}15%{opacity:1;transform:translate(-50%,-100%) scale(1.1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-170%)}}
        .float3.back{color:#e8e2ee;-webkit-text-stroke-color:#8a7a96;font-size:30px}`;
      document.head.appendChild(st);
    }
    G.tierEl = ui.h('div', { class: 'xvtier glass' }, ui.root);
    G.tierBtns = R.TIERS.map(t => { const b = ui.h('div', { class: 'xvt', style: `--c:${t.color}`, html: `<i>×${t.cap}</i><div><b>${t.name}</b><span>${short(t.price)} · ${t.cap} cuộn</span></div>` }, G.tierEl); b.onclick = () => setTier(t.id); return b; });
    if (ctx.room) G.tierEl.style.display = 'none';      // the lobby picked the scoop size
    G.tallyEl = ui.h('div', { class: 'xvtally glass' }, ui.root);
    G.dock = ui.h('div', { class: 'xvdock glass' }, ui.root);
    G.barEl = ui.h('div', { class: 'xvbar' }, G.dock);
    ui.h('div', { class: 't', text: 'đống vé' }, G.barEl);
    G.bars = []; for (let i = 0; i < 41; i++) G.bars.push(ui.h('div', { class: 'b', style: `left:${i / 41 * 100 + .3}%;width:${100 / 41 - .6}%` }, G.barEl));
    G.knob = ui.h('div', { class: 'k' }, G.barEl);
    G.goBtn = ui.h('div', { class: 'gbtn pink', html: '<span>XÚC!</span><small></small>' }, G.dock);
    G.goBtn.onclick = () => { ctx.sfx('click', .4); press(); };
    refreshHud();
  }
  function drawBar() {
    if (!G.bars) return;
    G.bars.forEach((b, i) => { const th = -R.ARC + 2 * R.ARC * (i + .5) / G.bars.length, q = R.quality(G.M.pile, th); b.style.height = Math.max(4, q * 100) + '%'; b.style.background = q >= .85 ? '#2fc58e' : q >= .55 ? '#ffc93c' : '#ffb3cf'; });
  }
  function refreshHud() {
    const t = tier(), s = G.sess, net = s.won - s.spent;
    G.tierBtns.forEach((b, i) => { b.classList.toggle('on', R.TIERS[i].id === G.tier); b.classList.toggle('off', G.busy); });
    const onShelf = G.M.shelf.live();
    G.tallyEl.innerHTML = `<div class="h">Phiên này</div><div>Đã xúc <b>${s.scoops}</b> lần · tốn <b>${short(s.spent)}</b></div><div>Vé rơi trúng <b>${short(s.won)}</b> · <b class="${net < 0 ? 'neg' : 'pos'}">${net < 0 ? '−' : '+'}${short(Math.abs(net))}</b></div>
      <div class="xvrolls">${R.ROLLS.map(r => `<div class="xvr${s.rolls[r.id] ? '' : ' zero'}" style="--c:${r.ring};--t:${r.top}"><i></i>${r.label}<small style="font-family:'Baloo 2';font-weight:800">×${s.rolls[r.id] || 0}</small></div>`).join('')}</div>
      <div style="margin-top:4px">Trên kệ: <b>${onShelf.length}</b> cuộn ≈ <b>${short(R.shelfValue(G.M))}</b></div>`;
    G.goBtn.querySelector('small').textContent = short(t.price);
    G.goBtn.classList.toggle('off', G.busy);
  }
  function status(text) {
    if (text) return G.ctx.ui.status(text);
    G.ctx.ui.status(G.busy ? 'Muỗng đang xúc…' : `Bấm <b>XÚC!</b> (hoặc chạm màn hình) khi muỗng ở trên <b>cột xanh</b> · <b>${short(tier().price)}</b>/lượt`);
  }
  function qTag(text, color) {
    const ctx = G.ctx, p = G.scoop.getWorldPosition(new G.T.Vector3()); p.y += .9;
    const s = ctx.toUI(p), e = ctx.ui.h('div', { class: 'xvq', text, style: `left:${s.x}px;top:${s.y}px;background:${color}` }, ctx.el.fx); setTimeout(() => e.remove(), 1600);
  }

  // ==================================================================== input
  function bindInput() {
    const ctx = G.ctx;
    G.onKey = e => { if (document.querySelector('#modal.on')) return; if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); if (!e.repeat) press(); } };
    addEventListener('keydown', G.onKey);
    let down = null;
    ctx.onPointerDown = e => { down = { x: e.clientX, y: e.clientY }; };
    ctx.onPointerUp = e => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 14 && !G.demo) press(); down = null; };
  }
  function setTier(id) {
    if (G.busy || !R.TIER[id] || id === G.tier || G.ctx.room) return;
    G.tier = id; if (!G.test) HC.store.set('xucve_tier', id);
    buildBucket(); refreshHud(); status();
    G.ctx.ui.toast(`${R.TIER[id].name}: ${short(R.TIER[id].price)} một lượt, tối đa ${R.TIER[id].cap} cuộn`, 'emoji-fluent-3d/game/admission_tickets.png');
  }

  // ==================================================================== the scoop
  function armTo(theta, ms, ease = 'io') {
    const ctx = G.ctx, from = G.theta, start = performance.now(), dur = Math.max(1, ms * ctx.timeScale), fn = ctx.EASE[ease] || ctx.EASE.io;
    return new Promise(res => ctx.tweens.push({ obj: G.arm, keys: ['arm'], resolve: res, step(now) { const k = clamp((now - start) / dur, 0, 1); setArm(from + (theta - from) * fn(k)); return k >= 1; } }));
  }
  function scoopTo(y, ms, ease = 'io') {
    const ctx = G.ctx, from = G.scoopY, start = performance.now(), dur = Math.max(1, ms * ctx.timeScale), fn = ctx.EASE[ease] || ctx.EASE.io;
    return new Promise(res => ctx.tweens.push({ obj: G.scoop, keys: ['sy'], resolve: res, step(now) { const k = clamp((now - start) / dur, 0, 1); placeScoop(from + (y - from) * fn(k)); return k >= 1; } }));
  }
  /** Press XÚC at the arm's current angle. Resolves with the scoop result once the rolls are on the shelf. */
  async function press(forceTheta) {
    if (G.busy) return null;
    const ctx = G.ctx, T = G.T, t = tier();
    if (!ctx.spend(t.price)) return null;
    G.busy = true;
    G.sess.spent += t.price; G.sess.scoops++; track('bet', { amount: t.price });
    refreshHud(); status();
    if (G.sess.scoops > 1) track('round', { net: G.sess.round - (G.lastPrice || 0), bet: G.lastPrice || 0 });
    G.sess.round = 0; G.lastPrice = t.price;
    ctx.sfx('click', .4);
    if (forceTheta != null) { setArm(forceTheta); G.swingT = Math.asin(clamp(forceTheta / R.ARC, -1, 1)) / (2 * Math.PI) * R.SWING; }
    const res = R.scoop(G.M, G.theta, t.id);
    G.log.push({ q: +res.q.toFixed(2), n: res.n, kinds: res.kinds, tier: t.id });
    // dig
    ctx.sfx('slide', .4);
    await scoopTo(SCOOP_DIG, 420, 'in');
    await ctx.tween(G.bucket, { rx: -.9 }, 220, 'out');
    syncPile();
    // the rolls it got sit in the bucket
    G.inScoop.forEach(m => G.bucket.remove(m)); G.inScoop = [];
    const w = G.bucket.userData.w;
    res.kinds.forEach((k, i) => { const m = rollMesh(k); const col = i % 4, row = Math.floor(i / 4); m.position.set((col - 1.5) * Math.min(.36, w / 4.4), -.2 + row * .17, -.05 + (row % 2) * .1); m.rotation.set(.2 + hash(i, 3) * .5, hash(i, 9) * 6, hash(i, 5) * .5); m.scale.multiplyScalar(.8); G.bucket.add(m); G.inScoop.push(m); });
    await ctx.tween(G.bucket, { rx: 0 }, 260, 'out');
    await scoopTo(SCOOP_UP, 480, 'out');
    if (res.n === 0) qTag('Hụt rồi! 😅', '#ff6f8f');
    else if (res.q >= .85) qTag(`Tuyệt vời! ${res.n} cuộn`, '#2fc58e');
    else if (res.q >= .5) qTag(`Khá! ${res.n} cuộn`, '#ffb300');
    else qTag(`Hơi hụt… ${res.n} cuộn`, '#ff8f5c');
    // swing round to the shelf and pour
    const stop = G.theta, dest = stop >= 0 ? Math.PI : -Math.PI;
    ctx.sfx('fan', .35);
    await armTo(dest, 900 + Math.abs(dest - stop) * 120);
    await scoopTo(SCOOP_POUR, 260, 'out');
    await ctx.tween(G.bucket, { rx: 1.25 }, 300, 'in');
    const xs = R.dumpX(G.M, res.n), sh = G.M.shelf;
    for (let i = 0; i < G.inScoop.length; i++) {
      const m = G.inScoop[i], wp = m.getWorldPosition(new T.Vector3()); G.bucket.remove(m); m.scale.setScalar(R.BY_ID[res.kinds[i]].gold ? 1.08 : 1); m.position.copy(wp); ctx.add(m);
      ctx.sfx('card', .3);
      ctx.tween(m, { x: clamp(xs[i], -sh.W + R.R_ROLL, sh.W - R.R_ROLL), y: 1.75, z: Z0 + sh.DROP_Z, rx: 0, rz: 0 }, 180, 'out').then(() => { ctx.remove(m); sh.drop(xs[i], res.kinds[i], 1.6); });
      await ctx.wait(70);
    }
    G.inScoop = [];
    await ctx.wait(200);
    await ctx.tween(G.bucket, { rx: 0 }, 240, 'out');
    // back over the bin, top it up, swing on
    await Promise.all([armTo(stop, 800 + Math.abs(dest - stop) * 110), scoopTo(SCOOP_UP, 300)]);
    const rf = R.refill(G.M);
    if (rf.slots.length) { ctx.sfx('chips', .35); syncPile(); }
    G.busy = false; refreshHud(); status(); saveMachine();
    return res;
  }

  // ==================================================================== per frame
  let blinkT = 0;
  function update(dt, t) {
    if (!G) return;
    const ctx = G.ctx, sh = G.M.shelf;
    // the arm swings while it waits
    if (!G.busy) { G.swingT += dt; setArm(R.armAngle(G.swingT)); }
    if (G.knob) G.knob.style.left = ((G.theta + R.ARC) / (2 * R.ARC) * 100).toFixed(2) + '%';
    // shelf physics + pusher
    sh.step(Math.min(dt, .1));
    G.pusher.position.z = Z0 + sh.pz;
    for (const e of sh.takeEvents()) onShelfEvent(e);
    syncShelf();
    blinkT += dt; if (blinkT > .2) { blinkT = 0; G.blink = (G.blink || 0) + 1; G.bulbs.forEach((b, i) => { b.material = G.bulbMats[(i + G.blink) % 3 === 0 ? 1 : 0]; }); }
    if (G.star) G.star.rotation.y = t * 1.2;
    G.saveT += dt; if (G.saveT > 6) { G.saveT = 0; saveMachine(); }
  }
  function onShelfEvent(e) {
    const ctx = G.ctx, T = G.T, sh = G.M.shelf, at = new T.Vector3(e.x, .2, Z0 + sh.FRONT + .5);
    if (e.type === 'land') { if (!G.test) ctx.sfx(e.shelf ? 'chip' : 'card2', .25); return; }
    if (e.type === 'win') {
      ctx.win(e.value, at); G.sess.won += e.value; G.sess.round += e.value; G.sess.rolls[e.kind] = (G.sess.rolls[e.kind] || 0) + 1;
      track('win', { amount: e.value });
      if (e.kind === 'r500') { ctx.ui.callout('CUỘN VÀNG 500K!', '#a86d00'); ctx.ui.confetti(140); ctx.sfx('win', .5); }
      else if (e.kind === 'r200' || e.kind === 'r100') { ctx.ui.toast(`${R.BY_ID[e.kind].name}! +${HC.fmt(e.value)} xu`, 'emoji-fluent-3d/game/admission_tickets.png'); ctx.sfx('gold', .45); }
      refreshHud();
    } else if (e.type === 'lost') {
      ctx.ui.float('↩ thùng', at, 'back'); G.sess.back++;
    }
  }

  // ==================================================================== demo (?demo=1)
  async function demoLoop() {
    const ctx = G.ctx;
    await ctx.wait(400);
    for (let n = 0; n < 300 && G; n++) {
      const best = R.bestAngle(G.M.pile);
      if (n === 0) { await press(best); await ctx.wait(300); continue; }
      // wait for the arm to come over the tallest heap (or give up after one swing)
      const t0 = performance.now();
      while (Math.abs(G.theta - best) > .05 && performance.now() - t0 < R.SWING * 1000) await new Promise(r => setTimeout(r, 16));
      const r = await press(Math.abs(G.theta - best) <= .08 ? G.theta : best);
      if (!r) break;
      await ctx.wait(500);
    }
  }

  // ==================================================================== self-test
  async function selftest(ctx) {
    const out = { checks: {}, scoops: [] };
    await setup(ctx, { test: true });
    const sh = G.M.shelf, c0 = ctx.coins;
    out.checks.machine = R.pileTotal(G.M) === R.PILE_N && sh.live().length >= 20 && G.meshes.size === sh.live().length && G.pile.count === R.PILE_N;
    // a perfectly timed big scoop fills the scoop; the rolls land on the shelf
    setTier('to');
    const id0 = sh.nextId, best = R.bestAngle(G.M.pile), cBefore = ctx.coins, won0 = G.sess.won;
    const r1 = await press(best);
    out.scoops.push({ q: +r1.q.toFixed(2), n: r1.n });
    await new Promise(r => setTimeout(r, 900));
    out.checks.bigScoop = r1.q > .9 && r1.n >= R.TIER.to.cap - 1 && cBefore - ctx.coins + (G.sess.won - won0) === R.TIER.to.price;
    out.checks.onShelf = sh.nextId - id0 === r1.n && R.pileTotal(G.M) > R.PILE_N - R.BATCH && R.pileTotal(G.M) <= R.PILE_N;
    // a scoop over empty air (force an empty patch of the bin) takes nothing
    setTier('nho');
    const saved = G.M.pile.slice(); for (let i = 12; i < R.SLOTS; i++) G.M.pile[i] = 0; syncPile();
    const r2 = await press(R.slotAngle(R.SLOTS - 1));
    out.scoops.push({ q: +r2.q.toFixed(2), n: r2.n });
    out.checks.emptyScoop = r2.n === 0 && r2.q === 0;
    G.M.pile = saved.map((v, i) => i < 12 ? G.M.pile[i] : v); R.refill(G.M); syncPile();
    // keyboard
    const cK = ctx.coins, wK = G.sess.won; dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); await new Promise(r => setTimeout(r, 50));
    out.checks.keyboard = G.busy && ctx.coins === cK - R.TIER.nho.price + (G.sess.won - wK);
    while (G.busy) await new Promise(r => setTimeout(r, 50));
    // a roll at the middle of the edge pays its value; one at the corner goes back to the bin
    const w0 = G.sess.won, c1 = ctx.coins, back0 = G.sess.back;
    sh.add('r200', 0, sh.FRONT + .12); sh.add('r50', sh.W - .45, sh.FRONT + .12);
    await new Promise(r => setTimeout(r, 400));
    out.checks.payEdge = G.sess.won - w0 >= 200000 && ctx.coins - c1 >= 200000 && G.sess.rolls.r200 >= 1;
    out.checks.gutter = G.sess.back > back0;
    // the shelf keeps going: let it run a few pushes, rolls never leave the walls
    await new Promise(r => setTimeout(r, 1500));
    out.checks.walls = sh.items.every(i => i.state === 'fall' || i.state === 'gone' || (Math.abs(i.x) <= sh.W - i.r + 1e-6 && i.z >= 0));
    out.checks.meshesInSync = [...G.meshes.keys()].every(id => sh.items.some(i => i.id === id && i.state !== 'gone'));
    // save / load the whole machine
    const snap = JSON.parse(JSON.stringify(R.save(G.M))), back = R.load(snap);
    out.checks.saveLoad = !!back && back.pile.join() === G.M.pile.join() && back.shelf.live().length === snap.items.length;
    // rooms: three scoop sizes, prices
    const lobbyRooms = T3.roomsFor ? T3.roomsFor(KEY, T3.modules[KEY]) : T3.modules[KEY].rooms;
    out.checks.rooms = lobbyRooms.map(r => r.stakes.join('/')).join() === R.TIERS.map(t => t.price).join() && lobbyRooms.every(r => R.TIER[r.id]);
    // the pure rules agree on timing
    const good = R.binStats({ tier: 'vua', player: 'perfect', scoops: 2000 }).fillRate, bad = R.binStats({ tier: 'vua', player: 'random', scoops: 2000 }).fillRate;
    out.fill = { perfect: +good.toFixed(2), random: +bad.toFixed(2) }; out.checks.timing = good > .95 && bad < .7;
    out.coinsDelta = ctx.coins - c0; out.won = G.sess.won;
    const ok = Object.values(out.checks).every(Boolean);
    return Object.assign(out, { pass: ok ? 1 : 0, fail: ok ? 0 : 1 });
  }
})();
