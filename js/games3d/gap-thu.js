/* Gắp Thú 3D — a claw machine full of plushies. Rules, odds and payouts: js/games3d/rules/gap-thu.js.
 * World units: the machine floor is y = 0 and uses the rules' coordinates directly (x ∈ ±W, z ∈ ±D, z toward the camera).
 * One try: pay (or use a free try) → move the claw (pad buttons, arrow keys / WASD, or drag anywhere on the scene) → GẮP!
 * The outcome is decided by Rules.attempt() the moment the claw drops; the animation then plays it out
 * (miss / slip at the lift / drop on the way / into the chute). Machines remember their prizes (HC.store 'gapthu_m_<id>').
 */
(function () {
  'use strict';
  const KEY = 'gap-thu';
  /** Lobby rooms (js/t3-lobby.js): one machine per room; `stakes` is the price of one try. */
  const ROOMS = [
    { id: 'hong', name: 'Máy Hồng', stakes: [1000], min: 10000, lv: 1, scene: 'sakura', color: '#c2407a', grad: ['#ffd1e3', '#ff8fbf'] },
    { id: 'xanh', name: 'Máy Xanh', stakes: [5000], min: 50000, lv: 1, scene: 'sky', color: '#1f6fc0', grad: ['#d3ecff', '#6fbfff'] },
    { id: 'vang', name: 'Máy Vàng', stakes: [20000], min: 200000, lv: 3, scene: 'tet', color: '#a86d00', grad: ['#fff1c2', '#ffc93c'] },
  ];
  const TOP_Y = 2.75, RAIL_Y = 3.42, MOVE_SPEED = 2.1, TIME_LIMIT = 20, FLOOR_Y = 0;
  const CAMS = { front: { pos: [0, 3.0, 11.7], look: [0, 0.78, 0.2] }, side: { pos: [11.6, 3.0, 2.6], look: [0, 0.8, 0.1] } };
  const OPEN = 0.55, CLOSED = -0.16;
  let G = null, R = null;

  T3.register(KEY, {
    title: 'Gắp Thú', sub: 'Điều khiển càng gắp · thả đúng giữa thú bông · rơi vào lỗ là trúng quà',
    table: 'none', theme: 'pink', fov: 40, scripts: ['js/games3d/rules/gap-thu.js'],
    models: ['mini_bear', 'mini_dog', 'mini_duck', 'hp_monstera', 'hp_yucca', 'pp_lantern'],
    rooms: ROOMS, stakeName: 'Giá lượt', botLabel: false,
    cam: CAMS.front,
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
      if (c && typeof c.track === 'function') { if (type === 'round') { c.track('round', data); c.roundBet = 0; } return; }   // the framework reports bets and wins itself   // the framework reports money itself
      if (window.HC && HC.prog && HC.prog.track) HC.prog.track(type, data);
    } catch (e) {}
  }
  function addTickets(n) { if (n > 0) HC.store.set('tickets', (HC.store.get('tickets', 0) || 0) + n); }
  function addGems(n) { if (n <= 0) return; if (typeof HC.giveGems === 'function') HC.giveGems(n); else HC.store.set('gems', (HC.store.get('gems', 2480) || 0) + n); }
  function rulesHtml() {
    const rar = Object.entries(R.RARITY).map(([k, r]) => {
      const list = R.PRIZES.filter(p => p.rarity === k).map(p => `<img src="${HC.A(p.icon)}" title="${p.name}" style="width:44px;vertical-align:middle">`).join('');
      const id = R.PRIZES.find(p => p.rarity === k).id;
      const cells = R.TIERS.map(t => { const pay = R.payout(id, t.price); return `<td><b>${short(pay.coins)}</b>${pay.tickets ? `<br><small>+${pay.tickets} vé</small>` : ''}${pay.gems ? `<small> +${pay.gems} 💎</small>` : ''}</td>`; }).join('');
      return `<tr><td><b style="color:${r.dark}">${r.name}</b></td><td>${list}</td>${cells}</tr>`;
    }).join('');
    return `<p>Có 3 máy: <b>Máy Hồng 1K · Máy Xanh 5K · Máy Vàng 20K</b> một lượt (chọn ở sảnh, hoặc bảng bên trái). Bấm mũi tên hoặc <b>kéo</b> trên màn hình để đưa càng gắp tới con thú bông bạn thích (bàn phím: mũi tên / WASD, <b>Space</b> để gắp, <b>V</b> đổi góc nhìn). Mỗi lượt có <b>${TIME_LIMIT} giây</b>, hết giờ càng tự thả.</p>
      <ul><li>Càng thả xuống, khép lại, nhấc lên rồi mang thú về <b>lỗ quà</b> ở góc trái phía trước.</li>
      <li><b>Lực kẹp mỗi lượt là ngẫu nhiên</b>: thường thì yếu, thỉnh thoảng rất chặt. Thú càng hiếm càng <b>nặng</b>, khó giữ hơn.</li>
      <li>Thả <b>đúng giữa</b> con thú thì kẹp ăn nhất. Lệch ra mép thì càng dễ trượt.</li>
      <li>Kẹp chưa đủ chặt: thú <b>tuột ngay</b> khi nhấc lên, hoặc <b>rơi giữa đường</b>, nằm gần lỗ hơn cho lượt sau. Rơi trúng miệng lỗ thì vẫn được quà!</li>
      <li>Mỗi lượt trượt được <b>1 ⭐</b>, đủ ${R.STARS_FOR_FREE} ⭐ đổi <b>1 lượt miễn phí</b>.</li>
      <li>Vé đổi ra xu ở Máy Đẩy Xu (1 vé = ${R.TICKET_XU} xu). Về lâu dài máy trả lại khoảng <b>85–95%</b> số xu bỏ vào nếu bạn gắp khéo.</li></ul>
      <table style="width:100%;border-collapse:collapse;font-size:24px"><tr style="color:#c2407a"><th style="text-align:left">Độ hiếm</th><th>Thú bông</th>${R.TIERS.map(t => `<th>${t.name}<br><small>${short(t.price)}/lượt</small></th>`).join('')}</tr>${rar}</table>`;
  }

  // ==================================================================== setup
  async function setup(ctx, opts) {
    const T = ctx.THREE; R = window.Rules[KEY];
    T3.modules[KEY].rules = rulesHtml();
    G = { ctx, T, opts, test: !!opts.test, demo: ctx.Q.has('demo') && !opts.test, plush: new Map(), held: null, keys: {}, phase: 'idle', claw: { x: R.HOME.x, z: R.HOME.z, y: TOP_Y },
      vel: { x: 0, z: 0 }, drag: null, timer: 0, active: false, busy: false, view: 'front', sess: { tries: 0, spent: 0, won: 0, prizes: 0 }, log: [] };
    const want = (ctx.room && ctx.room.id) || ctx.Q.get('room') || HC.store.get('gapthu_tier', 'hong');
    G.tier = R.TIER[want] ? want : 'hong';
    G.col = Object.assign({}, HC.store.get('gapthu_col', {}) || {});
    ctx.music('cards');
    buildRoom(); buildMachine();
    await loadMachine(G.tier, opts.seed);
    buildHud(); bindInput();
    ctx.onFrame(update);
    setPhase('idle');
    if (G.demo) demoLoop();
  }
  function machineKey(t) { return 'gapthu_m_' + t; }
  async function loadMachine(tier, seed) {
    const ctx = G.ctx;
    G.tier = tier; if (!G.test) HC.store.set('gapthu_tier', tier);
    const saved = G.test || G.demo ? null : R.load(HC.store.get(machineKey(tier), null));
    G.M = saved || R.create({ seed: seed || (G.test || G.demo || ctx.SHOT ? 20261023 + R.TIERS.findIndex(t => t.id === tier) : (Date.now() ^ (Math.random() * 1e9)) >>> 0) });
    paintMachine();
    for (const [, m] of G.plush) ctx.remove(m); G.plush.clear();
    for (const p of G.M.prizes) await placePlush(p, false);
    saveMachine();
  }
  function saveMachine() { if (!G.test && !G.demo) HC.store.set(machineKey(G.tier), R.save(G.M)); }
  const price = () => R.TIER[G.tier].price;

  // ==================================================================== room
  function mat(hex, o = {}) { return G.ctx.mat(hex, Object.assign({ roughness: .6 }, o)); }
  function box(w, h, d, m, x, y, z, parent, r = .12) { const T = G.T, mesh = new T.Mesh(G.ctx.H.roundedBox(w, h, d, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001), 2), m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; (parent || G.ctx.scene).add(mesh); return mesh; }
  function buildRoom() {
    const { ctx, T } = G;
    const floorTex = T3.canvasTex(256, 256, (x, w) => { const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? '#ffe3ef' : '#fff7fb'; x.fillRect(i * s, j * s, s, s); } });
    floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; floorTex.repeat.set(14, 14);
    const floor = new T.Mesh(new T.PlaneGeometry(90, 90), new T.MeshStandardMaterial({ map: floorTex, roughness: .85 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -3.6; floor.receiveShadow = true; ctx.add(floor);
    const wallTex = T3.canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#ffd9ec'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffe9f3' : '#ffd0e6'; x.fillRect(i * w / 8, 0, w / 8, h); }
      x.font = '400 54px "Grandstander Black"'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = ['rgba(255,255,255,.75)', 'rgba(255,143,191,.55)'][(i + j) % 2]; x.fillText((i + j) % 2 ? '★' : '♥', i * 128 + 64, j * 128 + 64); }
    });
    wallTex.wrapS = wallTex.wrapT = T.RepeatWrapping; wallTex.repeat.set(6, 2.4);
    const wall = new T.Mesh(new T.PlaneGeometry(70, 26), new T.MeshStandardMaterial({ map: wallTex, roughness: .9 })); wall.position.set(0, 9.4, -7); wall.receiveShadow = true; ctx.add(wall);
    // neon sign on the wall
    const neon = new T.Mesh(new T.PlaneGeometry(9, 1.9), new T.MeshBasicMaterial({ map: T3.canvasTex(1024, 216, (x, w, h) => {
      x.font = '400 150px "Grandstander Black"'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = '#ff4f95'; x.shadowBlur = 30; x.lineWidth = 14; x.strokeStyle = '#ff6fa8'; x.strokeText('KHU GẮP THÚ', w / 2, h / 2 + 8);
      x.shadowBlur = 0; x.fillStyle = '#fff6fb'; x.fillText('KHU GẮP THÚ', w / 2, h / 2 + 8);
    }), transparent: true, toneMapped: false }));
    neon.position.set(0, 7.6, -6.95); ctx.add(neon);
    // two more machines for company + plants
    for (const [x, hex, ry] of [[-7.8, 0x6fbfff, .22], [7.8, 0xffc93c, -.22]]) { const g = sideMachine(hex); g.position.set(x, 0, -5.0); g.rotation.y = ry; ctx.add(g); }
    const deco = [['hp_monstera', -4.6, -2.6, 1.4], ['hp_yucca', 4.7, -2.7, 1.4], ['pp_lantern', -11, -5.5, 1.2], ['pp_lantern', 11, -5.5, 1.2]];
    deco.forEach(([k, x, z, s]) => G.ctx.H.load(k).then(g => { const o = G.ctx.H.clone(g); o.scale.setScalar(s); o.position.set(x, -3.6, z); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); ctx.add(o); }).catch(() => {}));
    // soft round rug in front of the machine
    const rug = new T.Mesh(new T.CircleGeometry(4.6, 48), new T.MeshStandardMaterial({ map: T3.canvasTex(256, 256, (x, w) => { const c = ['#ff9cc4', '#ffffff', '#ffc6de', '#ffffff']; for (let i = 0; i < 6; i++) { x.fillStyle = c[i % 4]; x.beginPath(); x.arc(w / 2, w / 2, w / 2 * (1 - i / 7), 0, 7); x.fill(); } }), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, -3.585, 3.6); rug.receiveShadow = true; ctx.add(rug);
  }
  /** A simpler machine standing at the side of the room (no claw logic). */
  function sideMachine(hex) {
    const T = G.T, g = new T.Group(), body = mat(hex, { roughness: .45 }), white = mat(0xffffff, { roughness: .4 });
    box(4.4, 3.4, 3.4, body, 0, -1.9, 0, g, .25);
    box(4.6, .9, 3.6, body, 0, 3.75, 0, g, .25);
    for (const [x, z] of [[-2.1, -1.6], [2.1, -1.6], [-2.1, 1.6], [2.1, 1.6]]) box(.2, 3.3, .2, white, x, 1.65, z, g, .08);
    const glass = new T.Mesh(new T.BoxGeometry(4.2, 3.3, 3.2), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .12, roughness: .05, depthWrite: false })); glass.position.y = 1.65; g.add(glass);
    const cols = [0xffe066, 0xffb3cf, 0xbfe3ff, 0xc9f2d9, 0xe2d4ff];
    for (let i = 0; i < 10; i++) { const s = new T.Mesh(new T.SphereGeometry(.38 + (i % 3) * .06, 16, 12), mat(cols[i % cols.length], { roughness: .9 })); s.position.set(-1.6 + (i % 5) * .8 + (i > 4 ? .4 : 0), .38, -0.9 + Math.floor(i / 5) * 1.0); s.castShadow = true; g.add(s); }
    const claw = new T.Mesh(new T.CylinderGeometry(.16, .16, .3, 16), mat(0xffd34d, { metalness: .6, roughness: .3 })); claw.position.set(.6, 2.5, -.2); g.add(claw);
    return g;
  }

  // ==================================================================== machine
  function buildMachine() {
    const { ctx, T } = G, H = ctx.H, W = R.W, D = R.D, g = G.mach = new T.Group(); ctx.add(g);
    G.mats = { body: mat(0xff8fbf, { roughness: .42 }), trim: mat(0xffffff, { roughness: .35 }), dark: mat(0x5a2342, { roughness: .7 }), gold: mat(0xffd34d, { metalness: .55, roughness: .28 }),
      chrome: mat(0xeeeef6, { metalness: .7, roughness: .22 }) };
    const M = G.mats;
    // cabinet below the prize floor
    box(5.4, 3.5, 4.2, M.body, 0, -1.85, .05, g, .3);
    box(5.5, .22, 4.3, M.trim, 0, -.1, .05, g, .1);
    box(5.5, .3, 4.3, M.trim, 0, -3.45, .05, g, .1);
    // control deck in front
    const deck = new T.Group(); deck.position.set(0, -.75, 2.45); deck.rotation.x = .22; g.add(deck);
    box(5.4, .38, 1.15, M.trim, 0, 0, 0, deck, .16);
    box(5.0, .06, .9, mat(0xffe3ef, { roughness: .5 }), 0, .2, 0, deck, .02);
    G.stick = new T.Group(); G.stick.position.set(.9, .22, 0); deck.add(G.stick);
    const stickRod = new T.Mesh(new T.CylinderGeometry(.05, .05, .55, 12), M.chrome); stickRod.position.y = .27; G.stick.add(stickRod);
    const ball = new T.Mesh(new T.SphereGeometry(.2, 20, 14), mat(0xff4f95, { roughness: .3 })); ball.position.y = .58; ball.castShadow = true; G.stick.add(ball);
    const base = new T.Mesh(new T.CylinderGeometry(.24, .28, .08, 20), M.dark); base.position.y = .03; G.stick.add(base);
    G.btn3 = new T.Mesh(new T.CylinderGeometry(.28, .28, .16, 28), mat(0x3ccf9b, { roughness: .3, emissiveHex: 0x1f9a70, emissiveIntensity: .25 })); G.btn3.position.set(1.95, .28, 0); deck.add(G.btn3);
    const btnRing = new T.Mesh(new T.CylinderGeometry(.36, .36, .1, 28), M.trim); btnRing.position.set(1.95, .22, 0); deck.add(btnRing);
    // coin slot plate with the price
    G.slotTex = null;
    G.slot = new T.Mesh(new T.PlaneGeometry(1.5, .62), new T.MeshStandardMaterial({ roughness: .5 })); G.slot.rotation.x = -Math.PI / 2; G.slot.position.set(-.9, .235, 0); deck.add(G.slot);
    // prize door under the chute
    const door = new T.Group(); door.position.set(R.CHUTE.x, -2.25, 2.17); g.add(door); G.door = door;
    box(1.5, 1.15, .1, M.trim, 0, 0, 0, door, .14);
    box(1.22, .9, .12, M.dark, 0, -.02, .02, door, .1);
    const flap = new T.Mesh(new T.PlaneGeometry(1.15, .55), new T.MeshStandardMaterial({ color: 0xffb3d6, transparent: true, opacity: .55, roughness: .2 })); flap.position.set(0, .15, .1); door.add(flap); G.flap = flap;
    const doorLbl = new T.Mesh(new T.PlaneGeometry(1.4, .36), new T.MeshBasicMaterial({ map: T3.canvasTex(512, 132, (x, w, h) => { x.font = '400 92px "Grandstander Black"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 16; x.strokeStyle = '#c2407a'; x.strokeText('QUÀ', w / 2, h / 2 + 4); x.fillStyle = '#fff'; x.fillText('QUÀ', w / 2, h / 2 + 4); }), transparent: true }));
    doorLbl.position.set(0, .82, .08); door.add(doorLbl);
    // prize floor + soft ball filler
    const felt = new T.Mesh(new T.PlaneGeometry(2 * W, 2 * D), new T.MeshStandardMaterial({ map: T3.canvasTex(256, 256, (x, w) => { x.fillStyle = '#ffc6de'; x.fillRect(0, 0, w, w); for (let i = 0; i < 1500; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.12)' : 'rgba(194,64,122,.06)'; x.fillRect(Math.random() * w, Math.random() * w, 2, 2); } }), roughness: 1 }));
    felt.rotation.x = -Math.PI / 2; felt.position.y = FLOOR_Y; felt.receiveShadow = true; g.add(felt);
    const N = 230, balls = new T.InstancedMesh(new T.SphereGeometry(1, 12, 8), new T.MeshStandardMaterial({ roughness: .55 }), N), m4 = new T.Matrix4(), col = new T.Color();
    const pal = [0xffffff, 0xffb3cf, 0xbfe3ff, 0xfff0a6, 0xd8c8ff, 0xc9f2d9];
    let k = 0; for (let tries = 0; k < N && tries < 4000; tries++) {
      const x = -W + .14 + Math.random() * (2 * W - .28), z = -D + .14 + Math.random() * (2 * D - .28), r = .11 + Math.random() * .07;
      if (Math.abs(x - R.CHUTE.x) < R.HOLE + .2 && Math.abs(z - R.CHUTE.z) < R.HOLE + .2) continue;
      m4.makeScale(r, r, r).setPosition(x, r * .7 + Math.random() * .06, z); balls.setMatrixAt(k, m4); balls.setColorAt(k, col.set(pal[k % pal.length]).convertSRGBToLinear()); k++;
    }
    balls.count = k; balls.receiveShadow = true; g.add(balls);
    // the chute: dark hole + clear guard
    const hole = new T.Mesh(new T.PlaneGeometry(2 * R.HOLE, 2 * R.HOLE), new T.MeshBasicMaterial({ color: 0x2a1030 })); hole.rotation.x = -Math.PI / 2; hole.position.set(R.CHUTE.x, .012, R.CHUTE.z); g.add(hole);
    const rimM = mat(0xffffff, { roughness: .3 });
    for (const [w, d, x, z] of [[2 * R.HOLE + .12, .06, 0, -R.HOLE], [2 * R.HOLE + .12, .06, 0, R.HOLE], [.06, 2 * R.HOLE, -R.HOLE, 0], [.06, 2 * R.HOLE, R.HOLE, 0]]) box(w, .08, d, rimM, R.CHUTE.x + x, .04, R.CHUTE.z + z, g, .02);
    const guardM = new T.MeshStandardMaterial({ color: 0xff8fc0, transparent: true, opacity: .32, roughness: .1, depthWrite: false, side: T.DoubleSide });
    const gh = .62, gx = R.CHUTE.x + R.HOLE + .04, gz = R.CHUTE.z - R.HOLE - .04;
    const g1 = new T.Mesh(new T.PlaneGeometry(D - gz, gh), guardM); g1.rotation.y = Math.PI / 2; g1.position.set(gx, gh / 2, (gz + D) / 2); g.add(g1);
    const g2 = new T.Mesh(new T.PlaneGeometry(gx + W, gh), guardM); g2.position.set((gx - W) / 2, gh / 2, gz); g.add(g2);
    box(.06, .06, D - gz, rimM, gx, gh, (gz + D) / 2, g, .02); box(gx + W, .06, .06, rimM, (gx - W) / 2, gh, gz, g, .02);
    const holeTag = new T.Mesh(new T.PlaneGeometry(1.0, .3), new T.MeshBasicMaterial({ map: T3.canvasTex(400, 120, (x, w, h) => { T3.rr(x, 4, 4, w - 8, h - 8, 50); x.fillStyle = '#ff4f95'; x.fill(); x.font = '400 70px "Grandstander Black"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText('LỖ QUÀ', w / 2, h / 2 + 4); }), transparent: true }));
    holeTag.position.set((gx - W) / 2, gh - .2, gz + .01); g.add(holeTag);
    // glass box, back panel, posts, canopy
    const glassM = new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .1, roughness: .05, metalness: .1, depthWrite: false, side: T.DoubleSide });
    const GH = 3.62, GX = W + .2, GZ = D + .22;
    const pane = (w, h, x, y, z, ry) => { const p = new T.Mesh(new T.PlaneGeometry(w, h), glassM); p.position.set(x, y, z); p.rotation.y = ry; g.add(p); return p; };
    pane(2 * GX, GH, 0, GH / 2, GZ, 0); pane(2 * GZ, GH, -GX, GH / 2, 0, Math.PI / 2); pane(2 * GZ, GH, GX, GH / 2, 0, Math.PI / 2);
    // shine streaks on the front glass
    const shine = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .13, depthWrite: false });
    for (const [x, w] of [[-1.3, .35], [-0.85, .12], [1.5, .28]]) { const s = new T.Mesh(new T.PlaneGeometry(w, GH * 1.05), shine); s.position.set(x, GH / 2, GZ + .01); s.rotation.z = .35; g.add(s); }
    const backTex = T3.canvasTex(512, 384, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe3f1'); gr.addColorStop(1, '#e7dbff'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) { x.fillStyle = 'rgba(255,255,255,.8)'; const cx = (i * 97) % w, cy = 40 + (i * 61) % (h - 120); for (let k2 = 0; k2 < 3; k2++) { x.beginPath(); x.arc(cx + k2 * 26, cy + (k2 === 1 ? -12 : 0), 24, 0, 7); x.fill(); } }
      x.font = '400 40px "Grandstander Black"'; x.textAlign = 'center'; x.fillStyle = 'rgba(255,111,168,.55)'; for (let i = 0; i < 14; i++) x.fillText('★', (i * 131) % w, 30 + (i * 83) % h);
    });
    const back = new T.Mesh(new T.PlaneGeometry(2 * GX, GH), new T.MeshStandardMaterial({ map: backTex, roughness: .8 })); back.position.set(0, GH / 2, -GZ); back.receiveShadow = true; g.add(back);
    for (const [x, z] of [[-GX, -GZ], [GX, -GZ], [-GX, GZ], [GX, GZ]]) box(.24, GH + .05, .24, M.trim, x, GH / 2, z, g, .09);
    box(2 * GX + .2, .18, .24, M.trim, 0, .02, GZ, g, .06);
    box(2 * GX + .5, 1.15, 2 * GZ + .5, M.body, 0, GH + .55, 0, g, .3);
    box(2 * GX + .62, .16, 2 * GZ + .62, M.trim, 0, GH + .02, 0, g, .07);
    G.sign = new T.Mesh(new T.PlaneGeometry(4.3, .95), new T.MeshStandardMaterial({ roughness: .5, emissive: 0xffffff, emissiveIntensity: .12 })); G.sign.position.set(0, GH + .57, GZ + .26); g.add(G.sign);
    // light bulbs around the sign
    G.bulbs = [];
    const bulbOn = mat(0xfff6c2, { emissiveHex: 0xffe27a, emissiveIntensity: 1.1, roughness: .3 }), bulbOff = mat(0xffe7b0, { roughness: .4 });
    G.bulbMats = [bulbOn, bulbOff];
    for (let i = 0; i < 16; i++) { const b = new T.Mesh(new T.SphereGeometry(.07, 10, 8), bulbOn); b.position.set(-2.35 + i * (4.7 / 15), GH + 1.07, GZ + .27); g.add(b); G.bulbs.push(b); }
    for (let i = 0; i < 16; i++) { const b = new T.Mesh(new T.SphereGeometry(.07, 10, 8), bulbOn); b.position.set(-2.35 + i * (4.7 / 15), GH + .07, GZ + .27); g.add(b); G.bulbs.push(b); }
    // gantry: rails, bridge, carriage, cable
    for (const x of [-W - .06, W + .06]) box(.12, .1, 2 * D + .3, M.chrome, x, RAIL_Y, 0, g, .03);
    G.bridge = box(2 * W + .3, .12, .16, M.chrome, 0, RAIL_Y - .04, 0, g, .04);
    G.carriage = box(.42, .24, .42, M.gold, 0, RAIL_Y - .16, 0, g, .07);
    G.cable = new T.Mesh(new T.CylinderGeometry(.018, .018, 1, 6), mat(0x9a8aa6, { roughness: .4 })); g.add(G.cable);
    buildClaw();
    // aim ring on the floor under the claw
    G.ring = new T.Mesh(new T.RingGeometry(.2, .26, 40), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, depthWrite: false }));
    G.ring.rotation.x = -Math.PI / 2; G.ring.position.y = .03; g.add(G.ring);
    G.ringDot = new T.Mesh(new T.CircleGeometry(.05, 16), new T.MeshBasicMaterial({ color: 0xff4f95, transparent: true, opacity: .8, depthWrite: false })); G.ringDot.rotation.x = -Math.PI / 2; G.ringDot.position.y = .032; g.add(G.ringDot);
  }
  function buildClaw() {
    const T = G.T, M = G.mats, c = G.clawObj = new T.Group(); G.mach.add(c);
    const hub = new T.Mesh(new T.CylinderGeometry(.2, .24, .32, 24), M.gold); hub.castShadow = true; c.add(hub);
    const cap = new T.Mesh(new T.SphereGeometry(.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.gold); cap.position.y = .16; c.add(cap);
    const bolt = new T.Mesh(new T.CylinderGeometry(.08, .08, .12, 12), M.chrome); bolt.position.y = -.2; c.add(bolt);
    G.prongs = [];
    for (let k = 0; k < 3; k++) {
      const arm = new T.Group(); arm.rotation.y = k * Math.PI * 2 / 3 + Math.PI / 6; c.add(arm);
      const pv = new T.Group(); pv.position.set(.15, -.17, 0); arm.add(pv);
      const up = new T.Mesh(new T.CylinderGeometry(.035, .03, .58, 8), M.chrome); up.position.y = -.29; up.castShadow = true; pv.add(up);
      const knee = new T.Group(); knee.position.y = -.58; knee.rotation.z = -.95; pv.add(knee);
      const low = new T.Mesh(new T.CylinderGeometry(.03, .022, .3, 8), M.chrome); low.position.y = -.15; low.castShadow = true; knee.add(low);
      const tip = new T.Mesh(new T.SphereGeometry(.05, 10, 8), M.gold); tip.position.y = -.3; knee.add(tip);
      pv.rotation.z = OPEN; G.prongs.push(pv);
    }
  }
  function signTex(tier) {
    const t = R.TIER[tier];
    return T3.canvasTex(1024, 228, (x, w, h) => {
      T3.rr(x, 6, 6, w - 12, h - 12, 60); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 12; x.strokeStyle = t.color; x.stroke();
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '400 112px "Grandstander Black"'; x.lineJoin = 'round';
      x.lineWidth = 18; x.strokeStyle = '#ffffff'; x.strokeText('GẮP THÚ', w / 2 - 120, h / 2 + 6); x.fillStyle = t.color; x.fillText('GẮP THÚ', w / 2 - 120, h / 2 + 6);
      T3.rr(x, w - 330, 40, 290, h - 80, 50); x.fillStyle = t.color; x.fill();
      x.font = '400 76px "Grandstander Black"'; x.fillStyle = '#fff'; x.fillText(short(t.price), w - 185, h / 2 + 4);
    });
  }
  function slotTex(tier) {
    const t = R.TIER[tier];
    return T3.canvasTex(384, 160, (x, w, h) => { T3.rr(x, 4, 4, w - 8, h - 8, 34); x.fillStyle = '#5a2342'; x.fill(); x.fillStyle = '#2a1030'; x.fillRect(40, h / 2 - 10, 90, 20); x.font = '400 64px "Grandstander Black"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffe27a'; x.fillText(short(t.price), 260, h / 2 + 4); });
  }
  function paintMachine() {
    const t = R.TIER[G.tier], c = new G.T.Color(t.hex).convertSRGBToLinear();
    G.mats.body.color.copy(c);
    G.sign.material.map = signTex(G.tier); G.sign.material.needsUpdate = true;
    G.slot.material.map = slotTex(G.tier); G.slot.material.needsUpdate = true;
  }

  // ==================================================================== plushies
  async function makePlush(id) {
    const { ctx, T } = G, P = R.BY_ID[id], r = P.r, g = new T.Group(), inner = new T.Group(); g.add(inner);
    if (!P.model.startsWith('proc:')) {
      const o = ctx.H.clone(await ctx.H.load(P.model));
      o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      const bb = new T.Box3().setFromObject(o), sz = bb.getSize(new T.Vector3()), s = 2 * r * 1.08 / Math.max(sz.x, sz.z, sz.y * .8);
      o.scale.setScalar(s); const c = bb.getCenter(new T.Vector3());
      o.position.set(-c.x * s, -bb.min.y * s, -c.z * s); inner.add(o);
      g.userData.h = sz.y * s;
    } else g.userData.h = procPlush(P.model.slice(5), r, inner);
    g.userData.id = id; g.userData.inner = inner;
    return g;
  }
  /** Soft toys built from spheres. Returns the height. All face +z. */
  function procPlush(kind, r, g) {
    const T = G.T, soft = (hex, o) => mat(hex, Object.assign({ roughness: .92 }, o));
    const ball = (m, rad, x, y, z, sx = 1, sy = 1, sz = 1) => { const s = new T.Mesh(new T.SphereGeometry(rad, 22, 16), m); s.scale.set(sx, sy, sz); s.position.set(x, y, z); s.castShadow = true; s.receiveShadow = true; g.add(s); return s; };
    const black = soft(0x3a2030, { roughness: .4 }), white = soft(0xffffff, { roughness: .4 }), blush = soft(0xff8fb1);
    const eyes = (y, z, sep, size = .075) => { for (const sx of [-1, 1]) { ball(black, r * size * 1.2, sx * sep, y, z); ball(white, r * size * .45, sx * sep + r * .02, y + r * .03, z + r * size * .9); } };
    const cheeks = (y, z, sep) => { for (const sx of [-1, 1]) ball(blush, r * .09, sx * sep, y, z, 1, .6, .4); };
    if (kind === 'chick') {
      const yel = soft(0xffe066), org = soft(0xff9f43);
      ball(yel, r * .95, 0, r * .92, 0, 1, .95, 1);
      for (const sx of [-1, 1]) ball(yel, r * .32, sx * r * .88, r * .8, -r * .05, .45, .8, .9).rotation.z = sx * .5;
      for (let i = 0; i < 3; i++) ball(yel, r * .14, (i - 1) * r * .12, r * 1.86, -r * .05);
      const beak = new T.Mesh(new T.ConeGeometry(r * .14, r * .3, 12), org); beak.rotation.x = Math.PI / 2; beak.position.set(0, r * .95, r * .98); g.add(beak);
      eyes(r * 1.18, r * .8, r * .3); cheeks(r * .98, r * .84, r * .52);
      for (const sx of [-1, 1]) ball(org, r * .14, sx * r * .3, r * .08, r * .4, 1.2, .5, 1.5);
      return r * 2;
    }
    if (kind === 'pig' || kind === 'goldpig') {
      const gold = kind === 'goldpig';
      const skin = gold ? mat(0xffc93c, { metalness: .55, roughness: .28, emissiveHex: 0xa86d00, emissiveIntensity: .22 }) : soft(0xffb3cf);
      const dark = gold ? mat(0xe0a020, { metalness: .5, roughness: .3 }) : soft(0xff8fb1);
      ball(skin, r * .98, 0, r * .9, 0, 1, .9, 1.02);
      const snout = new T.Mesh(new T.CylinderGeometry(r * .3, r * .32, r * .2, 22), dark); snout.rotation.x = Math.PI / 2; snout.position.set(0, r * .8, r * .97); snout.castShadow = true; g.add(snout);
      for (const sx of [-1, 1]) ball(black, r * .06, sx * r * .1, r * .8, r * 1.08, 1, 1.4, .5);
      for (const sx of [-1, 1]) { const e = new T.Mesh(new T.ConeGeometry(r * .22, r * .36, 14), dark); e.position.set(sx * r * .5, r * 1.68, r * .1); e.rotation.set(.35, 0, -sx * .4); e.castShadow = true; g.add(e); }
      eyes(r * 1.15, r * .8, r * .32); if (!gold) cheeks(r * .92, r * .86, r * .56);
      for (const [x, z] of [[-.45, .45], [.45, .45], [-.45, -.45], [.45, -.45]]) ball(dark, r * .18, x * r, r * .1, z * r, 1, .7, 1);
      const tail = new T.Mesh(new T.TorusGeometry(r * .1, r * .035, 8, 16), dark); tail.position.set(0, r * .95, -r * 1.0); g.add(tail);
      if (gold) {
        const crown = new T.Group(); crown.position.set(0, r * 1.78, 0); g.add(crown);
        const cm = mat(0xffe27a, { metalness: .6, roughness: .25, emissiveHex: 0xffb300, emissiveIntensity: .3 });
        const band = new T.Mesh(new T.CylinderGeometry(r * .28, r * .3, r * .14, 18, 1, true), cm); crown.add(band);
        for (let i = 0; i < 5; i++) { const sp = new T.Mesh(new T.ConeGeometry(r * .07, r * .2, 8), cm); const a = i / 5 * Math.PI * 2; sp.position.set(Math.cos(a) * r * .28, r * .15, Math.sin(a) * r * .28); crown.add(sp); }
        const gem = new T.Mesh(new T.OctahedronGeometry(r * .08), mat(0xff4f95, { metalness: .3, roughness: .2, emissiveHex: 0xff4f95, emissiveIntensity: .4 })); gem.position.set(0, 0, r * .3); crown.add(gem);
        const sp = new T.Sprite(new T.SpriteMaterial({ map: sparkleTex(), color: 0xfff2a0, transparent: true, depthWrite: false })); sp.scale.setScalar(r * 2.6); sp.position.set(r * .6, r * 1.6, r * .3); g.add(sp); g.userData.sparkle = sp;
      }
      return r * 1.95;
    }
    if (kind === 'bunny') {
      const fur = soft(0xfff3f8), pink = soft(0xffb3d1);
      ball(fur, r * .8, 0, r * .72, 0, 1, .92, 1);
      ball(fur, r * .62, 0, r * 1.62, r * .12);
      for (const sx of [-1, 1]) { const e = ball(fur, r * .17, sx * r * .26, r * 2.3, 0, 1, 2.6, .8); e.rotation.z = -sx * .18; const ei = ball(pink, r * .1, sx * r * .27, r * 2.3, r * .1, 1, 2.6, .5); ei.rotation.z = -sx * .18; }
      eyes(r * 1.7, r * .66, r * .23, .07); cheeks(r * 1.5, r * .68, r * .38);
      ball(pink, r * .07, 0, r * 1.56, r * .74);
      for (const sx of [-1, 1]) ball(fur, r * .2, sx * r * .48, r * .9, r * .55, .9, 1.2, .9);
      for (const sx of [-1, 1]) ball(fur, r * .24, sx * r * .38, r * .12, r * .5, 1, .6, 1.4);
      ball(white, r * .2, 0, r * .55, -r * .78);
      return r * 2.75;
    }
    if (kind === 'cat') {
      const fur = soft(0xffc98f), stripe = soft(0xf59a4a), cream = soft(0xfff1dc);
      ball(fur, r * .8, 0, r * .72, 0, 1, .92, 1);
      ball(cream, r * .5, 0, r * .62, r * .42, 1, 1, .6);
      ball(fur, r * .64, 0, r * 1.6, r * .1, 1.08, .95, 1);
      for (const sx of [-1, 1]) { const e = new T.Mesh(new T.ConeGeometry(r * .2, r * .34, 4), fur); e.position.set(sx * r * .38, r * 2.15, r * .05); e.rotation.set(0, Math.PI / 4, -sx * .3); e.castShadow = true; g.add(e); }
      for (let i = 0; i < 3; i++) ball(stripe, r * .1, (i - 1) * r * .17, r * 2.13, r * .2, .6, .35, .6);
      eyes(r * 1.68, r * .66, r * .25, .07); cheeks(r * 1.5, r * .68, r * .42);
      ball(soft(0xff8fb1), r * .06, 0, r * 1.55, r * .74);
      const wm = new T.MeshBasicMaterial({ color: 0x8a5a3a });
      for (const sx of [-1, 1]) for (const dy of [-.04, .04]) { const wh = new T.Mesh(new T.CylinderGeometry(r * .008, r * .008, r * .42, 4), wm); wh.rotation.z = Math.PI / 2 + sx * dy * 3; wh.position.set(sx * r * .36, r * 1.5 + dy * r, r * .7); g.add(wh); }
      const tail = new T.Mesh(new T.TorusGeometry(r * .32, r * .08, 8, 20, Math.PI * 1.2), stripe); tail.position.set(r * .4, r * .4, -r * .7); tail.rotation.y = Math.PI / 2; g.add(tail);
      for (const sx of [-1, 1]) ball(fur, r * .22, sx * r * .36, r * .12, r * .5, 1, .6, 1.3);
      return r * 2.3;
    }
    if (kind === 'panda') {
      const fur = soft(0xffffff), blk = soft(0x403040);
      ball(fur, r * .82, 0, r * .74, 0, 1, .92, 1);
      ball(fur, r * .66, 0, r * 1.64, r * .08, 1.06, .96, 1);
      for (const sx of [-1, 1]) ball(blk, r * .22, sx * r * .5, r * 2.12, 0);
      for (const sx of [-1, 1]) { const p = ball(blk, r * .17, sx * r * .25, r * 1.68, r * .6, .9, 1.25, .5); p.rotation.z = sx * .5; }
      for (const sx of [-1, 1]) { ball(white, r * .06, sx * r * .25, r * 1.71, r * .68); }
      ball(blk, r * .09, 0, r * 1.5, r * .7, 1.3, .9, .7);
      cheeks(r * 1.5, r * .64, r * .44);
      for (const sx of [-1, 1]) ball(blk, r * .24, sx * r * .62, r * .9, r * .35, .9, 1.3, .9);
      for (const sx of [-1, 1]) ball(blk, r * .27, sx * r * .4, r * .14, r * .45, 1, .6, 1.3);
      return r * 2.35;
    }
    ball(soft(0xffb3cf), r, 0, r, 0); return 2 * r;
  }
  function sparkleTex() {
    if (G.sparkle) return G.sparkle;
    return (G.sparkle = T3.canvasTex(128, 128, (x, w) => { x.translate(w / 2, w / 2); const gr = x.createRadialGradient(0, 0, 0, 0, 0, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.2, 'rgba(255,240,160,.8)'); gr.addColorStop(1, 'rgba(255,240,160,0)'); x.fillStyle = gr;
      x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = i % 2 ? w * .1 : w * .5; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fill(); }));
  }
  /** Plush pose on the floor from the rules' prize record. */
  function poseOf(p) {
    const h = (p.uid * 2654435761) >>> 0, a = (h % 1000) / 1000, b = ((h >>> 10) % 1000) / 1000;
    return { x: p.x, y: FLOOR_Y + .06, z: p.z, ry: ((p.yaw % 1.6) - .8), rx: (a - .5) * .45, rz: (b - .5) * .4 };
  }
  async function placePlush(p, drop) {
    const m = await makePlush(p.id), ps = poseOf(p);
    m.position.set(ps.x, drop ? 4.5 : ps.y, ps.z); m.rotation.set(0, ps.ry, 0); m.userData.inner.rotation.set(ps.rx, 0, ps.rz);
    G.ctx.add(m); G.plush.set(p.uid, m);
    if (drop) { await G.ctx.tween(m, { y: ps.y }, 650, 'bounce'); G.ctx.sfx('pop', .4); }
    return m;
  }

  // ==================================================================== HUD
  function buildHud() {
    const ctx = G.ctx, ui = ctx.ui;
    if (!document.getElementById('gt-css')) {
      const st = document.createElement('style'); st.id = 'gt-css';
      st.textContent = `.gtmach{position:absolute;left:16px;top:132px;padding:10px;display:flex;flex-direction:column;gap:8px}
        .gtm{display:flex;align-items:center;gap:10px;padding:6px 16px 6px 8px;border-radius:26px;cursor:pointer;border:4px solid transparent;transition:transform .12s}
        .gtm:hover{transform:translateX(3px)}.gtm.on{border-color:var(--c);background:#fff8fb;box-shadow:0 4px 0 var(--c)}.gtm.off{opacity:.45;pointer-events:none}
        .gtm i{width:44px;height:44px;border-radius:14px;background:var(--c);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 -5px 0 rgba(0,0,0,.15)}
        .gtm i img{width:34px}.gtm b{display:block;font:400 23px "Grandstander Black";color:#7a2a56;line-height:1.05}.gtm span{display:block;font:800 19px "Baloo 2";color:#a86d00;line-height:1.1}
        .gtcol{position:absolute;right:16px;top:132px;width:276px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;font:800 19px "Baloo 2";color:#7a5a6e}
        .gtcol .h{font:400 23px "Grandstander Black";color:#c2407a}
        .gtgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
        .gtit{position:relative;height:66px;border-radius:16px;background:#fff4f9;display:flex;align-items:center;justify-content:center;border:3px solid var(--c)}
        .gtit img{width:48px;transition:transform .2s}.gtit.zero img{filter:grayscale(1);opacity:.3}.gtit.zero{border-color:#eee3ea}
        .gtit em{position:absolute;right:-6px;top:-8px;min-width:26px;padding:0 6px;border-radius:13px;background:#ff4f95;color:#fff;font:400 17px/26px "Grandstander Black";font-style:normal;text-align:center}
        .gtit.zero em{display:none}.gtit.bump img{animation:gtb .6s}
        @keyframes gtb{30%{transform:scale(1.5) rotate(-10deg)}60%{transform:scale(.9)}}
        .gtcol b{color:#9b2c5e;font-family:"Grandstander Black";font-weight:400}.gtcol .neg{color:#d24a6a}.gtcol .pos{color:#2fae7a}
        .gtstar{height:16px;border-radius:8px;background:#f6e3ec;overflow:hidden}.gtstar i{display:block;height:100%;background:linear-gradient(90deg,#ffd34d,#ffb300);transition:width .3s}
        .gtpad{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:12px 18px;border-radius:52px}
        .gtpad .gbtn{min-width:0;width:92px;height:84px;padding:0;font-size:46px;touch-action:none}
        .gtpad .gbtn.go{width:250px;font-size:40px}.gtpad .gbtn.go small{position:absolute;right:-10px;top:-14px;padding:0 10px;border-radius:16px;background:#fff;color:#c2407a;font:400 22px/32px "Grandstander Black";text-shadow:none;box-shadow:0 3px 0 #f2a9c8}
        .gtpad .gbtn.hold{transform:translateY(4px);filter:brightness(1.1)}
        .gtpad .sep{width:6px}
        .gtview{position:absolute;right:16px;bottom:18px;min-width:0!important;height:70px!important;padding:0 22px!important;font-size:24px!important}
        .gtgrip{position:absolute;padding:6px 18px;border-radius:22px;font:400 30px "Grandstander Black";color:#fff;white-space:nowrap;transform:translate(-50%,-100%);pointer-events:none;box-shadow:0 5px 0 rgba(0,0,0,.18);animation:gtg 1.3s ease-out forwards}
        @keyframes gtg{0%{opacity:0;transform:translate(-50%,-60%) scale(.6)}15%{opacity:1;transform:translate(-50%,-100%) scale(1.1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-160%)}}`;
      document.head.appendChild(st);
    }
    // machine picker
    G.machEl = ui.h('div', { class: 'gtmach glass' }, ui.root);
    G.machBtns = R.TIERS.map(t => {
      const b = ui.h('div', { class: 'gtm', style: `--c:${t.color}`, html: `<i><img src="${HC.A('emoji-fluent-3d/game/teddy_bear.png')}"></i><div><b>${t.name}</b><span>${short(t.price)} / lượt</span></div>` }, G.machEl);
      b.onclick = () => switchMachine(t.id); return b;
    });
    if (ctx.room) G.machEl.style.display = 'none';      // the lobby picked the machine ("Đổi bàn" goes back there)
    // collection + session
    G.colEl = ui.h('div', { class: 'gtcol glass' }, ui.root);
    ui.h('div', { class: 'h', text: 'Đã gắp được' }, G.colEl);
    const grid = ui.h('div', { class: 'gtgrid' }, G.colEl);
    G.colItems = {};
    for (const p of R.PRIZES) { const it = ui.h('div', { class: 'gtit', style: `--c:${R.RARITY[p.rarity].color}`, title: `${p.name} · ${R.RARITY[p.rarity].name}`, html: `<img src="${HC.A(p.icon)}"><em></em>` }, grid); G.colItems[p.id] = it; }
    G.sessEl = ui.h('div', {}, G.colEl);
    G.starEl = ui.h('div', {}, G.colEl);
    // pad
    G.pad = ui.h('div', { class: 'gtpad glass' }, ui.root);
    G.padBtns = {};
    const dirs = [['l', '◀'], ['f', '▲'], ['b', '▼'], ['r', '▶']];
    for (const [d, label] of dirs) {
      const b = ui.h('div', { class: 'gbtn sky', html: `<span>${label}</span>` }, G.pad); G.padBtns[d] = b;
      const on = e => { e.preventDefault(); if (G.busy) return; b.classList.add('hold'); G.keys['pad_' + d] = true; startTry(); };
      const off = () => { b.classList.remove('hold'); G.keys['pad_' + d] = false; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    }
    ui.h('div', { class: 'sep' }, G.pad);
    G.goBtn = ui.h('div', { class: 'gbtn pink go', html: `<span>GẮP!</span><small></small>` }, G.pad);
    G.goBtn.onclick = () => { ctx.sfx('click', .4); drop(); };
    G.viewBtn = ui.h('div', { class: 'gbtn lavender gtview', html: '<span>👀 Nhìn ngang</span>' }, ui.root);
    G.viewBtn.onclick = () => toggleView();
    refreshHud();
  }
  function refreshHud() {
    const t = R.TIER[G.tier];
    G.machBtns.forEach((b, i) => { b.classList.toggle('on', R.TIERS[i].id === G.tier); b.classList.toggle('off', G.busy || G.active); });
    for (const p of R.PRIZES) { const n = G.col[p.id] || 0, it = G.colItems[p.id]; it.classList.toggle('zero', !n); it.querySelector('em').textContent = n > 99 ? '99+' : n; }
    const net = G.sess.won - G.sess.spent;
    G.sessEl.innerHTML = `Lượt <b>${G.sess.tries}</b> · Tốn <b>${short(G.sess.spent)}</b><br>Thu <b>${short(G.sess.won)}</b> · <b class="${net < 0 ? 'neg' : 'pos'}">${net < 0 ? '−' : '+'}${short(Math.abs(net))}</b>`;
    G.starEl.innerHTML = `⭐ <b>${G.M.stars}/${R.STARS_FOR_FREE}</b> → 1 lượt free${G.M.free ? ` · <b class="pos">Có ${G.M.free} lượt free</b>` : ''}<div class="gtstar"><i style="width:${G.M.stars / R.STARS_FOR_FREE * 100}%"></i></div>`;
    const small = G.goBtn.querySelector('small');
    small.textContent = G.active ? `⏱ ${Math.ceil(G.timer)}` : (G.M.free ? 'FREE' : short(t.price));
    G.goBtn.classList.toggle('off', G.busy);
    Object.values(G.padBtns).forEach(b => b.classList.toggle('off', G.busy));
  }
  function status() {
    const ctx = G.ctx;
    if (G.busy) return;
    if (!G.active) ctx.ui.status(`Bấm mũi tên hoặc <b>kéo</b> để đưa càng tới thú bông · <b>${G.M.free ? 'lượt FREE' : short(price()) + '/lượt'}</b>`);
    else ctx.ui.status(`Còn <b>${Math.ceil(G.timer)} giây</b> · thả càng đúng giữa con thú rồi bấm <b>GẮP!</b>`);
  }
  function setPhase(p) { G.phase = p; refreshHud(); status(); }
  function gripTag(text, color) {
    const ctx = G.ctx, s = ctx.toUI(new G.T.Vector3(G.claw.x, G.claw.y + .6, G.claw.z));
    const e = ctx.ui.h('div', { class: 'gtgrip', text, style: `left:${s.x}px;top:${s.y}px;background:${color}` }, ctx.el.fx); setTimeout(() => e.remove(), 1400);
  }

  // ==================================================================== input
  function bindInput() {
    const ctx = G.ctx, T = G.T, plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    const map = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b' };
    G.onKey = e => {
      if (document.querySelector('#modal.on')) return;
      const d = map[e.code];
      if (d) { e.preventDefault(); G.keys['k_' + d] = e.type === 'keydown'; if (e.type === 'keydown') startTry(); return; }
      if (e.type !== 'keydown' || e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); drop(); }
      else if (e.code === 'KeyV') toggleView();
    };
    addEventListener('keydown', G.onKey); addEventListener('keyup', G.onKey);
    addEventListener('blur', () => { G.keys = {}; });
    addEventListener('pointerup', () => { for (const k in G.keys) if (k.startsWith('pad_')) G.keys[k] = false; Object.values(G.padBtns || {}).forEach(b => b.classList.remove('hold')); });
    ctx.onPointerDown = e => {
      if (G.busy || G.demo) return;
      const p = ctx.ray(e, plane); if (!p) return;
      G.drag = { p0: p, x0: G.claw.x, z0: G.claw.z, moved: false };
    };
    ctx.onPointerMove = e => {
      if (!G.drag || G.busy) return;
      const p = ctx.ray(e, plane); if (!p) return;
      const dx = p.x - G.drag.p0.x, dz = p.z - G.drag.p0.z;
      if (!G.drag.moved && Math.hypot(dx, dz) < .06) return;
      if (!G.drag.moved) { G.drag.moved = true; if (!startTry()) { G.drag = null; return; } }
      G.dragTarget = R.clampClaw(G.drag.x0 + dx, G.drag.z0 + dz);
    };
    ctx.onPointerUp = () => { G.drag = null; G.dragTarget = null; };
  }
  function toggleView() {
    G.view = G.view === 'front' ? 'side' : 'front';
    G.ctx.camTo(CAMS[G.view], 700);
    G.viewBtn.querySelector('span').textContent = G.view === 'front' ? '👀 Nhìn ngang' : '👀 Nhìn thẳng';
  }

  // ==================================================================== game flow
  /** Pay for a try (or use a free one) and start the timer. Returns false if the player cannot pay. */
  function startTry() {
    if (G.active) return true;
    if (G.busy) return false;
    const ctx = G.ctx, t = R.TIER[G.tier];
    if (G.M.free > 0) { R.useTry(G.M); G.paid = 0; ctx.ui.toast('Lượt miễn phí! 🎁', 'emoji-fluent-3d/game/wrapped_gift.png'); }
    else { if (!ctx.spend(t.price)) return false; G.paid = t.price; G.sess.spent += t.price; track('bet', { amount: t.price }); ctx.sfx('coin', .35); }
    G.active = true; G.timer = TIME_LIMIT; G.sess.tries++;
    saveMachine(); setPhase('move');
    return true;
  }
  async function switchMachine(id) {
    if (G.busy || G.active || id === G.tier || !R.TIER[id] || G.ctx.room) return;
    G.busy = true; refreshHud();
    await G.ctx.tween(G.mach, { s: .96 }, 120, 'out');
    await loadMachine(id);
    G.claw.x = R.HOME.x; G.claw.z = R.HOME.z;
    await G.ctx.tween(G.mach, { s: 1 }, 260, 'back');
    G.busy = false; setPhase('idle');
    G.ctx.ui.toast(`${R.TIER[id].name}: ${short(R.TIER[id].price)} một lượt`, 'emoji-fluent-3d/game/teddy_bear.png');
  }
  /** Drop the claw where it is now. Resolves with the try's result once everything has settled. */
  async function drop() {
    if (G.busy) return null;
    if (!G.active && !startTry()) return null;
    G.busy = true; G.active = false; G.keys = {}; G.drag = null; G.dragTarget = null; setPhase('drop');
    const ctx = G.ctx, T = G.T, t = R.TIER[G.tier], paid = G.paid || 0;
    ctx.ui.status('Càng đang gắp…');
    // press the 3D button
    ctx.tween(G.btn3, { y: .2 }, 90).then(() => ctx.tween(G.btn3, { y: .28 }, 160));
    const cx = G.claw.x, cz = G.claw.z;
    const res = R.attempt(G.M, cx, cz);
    const P = res.uid != null ? G.plush.get(res.uid) : null, prize = res.id ? R.BY_ID[res.id] : null;
    // 1. down
    const grabY = P ? Math.max(.75, P.position.y + P.userData.h * .82 + .25) : .72;
    ctx.sfx('slide', .4);
    await clawTo({ y: grabY }, 900 * (TOP_Y - grabY) / 2 + 300, 'io');
    // 2. close
    await closeClaw(P ? CLOSED + .1 : CLOSED, 380);
    if (P) gripTag(res.ratio >= 1 ? 'Kẹp chặt! 💪' : res.ratio >= .5 ? 'Hơi lỏng…' : 'Trượt rồi…', res.ratio >= 1 ? '#2fc58e' : res.ratio >= .5 ? '#ffb300' : '#ff6f8f');
    // 3. up (+ what happens to the prize)
    let carried = false;
    if (P && res.kind !== 'miss') {
      const lift = res.kind === 'slip' ? .35 : null;
      if (res.kind === 'slip') {
        G.held = { m: P, dy: P.position.y - grabY }; ctx.sfx('pop', .3);
        await clawTo({ y: grabY + lift }, 320, 'out');
        G.held = null; openClaw(OPEN * .6, 200);
        const lp = poseOf(G.M.prizes.find(p => p.uid === res.uid));
        ctx.tween(P.userData.inner, { rx: lp.rx, rz: lp.rz }, 420);
        await Promise.all([ctx.tween(P, { x: lp.x, y: lp.y, z: lp.z, ry: lp.ry }, 420, 'bounce'), clawTo({ y: TOP_Y }, 700, 'io')]);
        ctx.sfx('card', .35);
      } else {
        G.held = { m: P, dy: P.position.y - grabY }; carried = true;
        ctx.tween(P.userData.inner, { rx: 0, rz: 0 }, 400);
        await clawTo({ y: TOP_Y }, 900, 'io');
      }
    } else {
      await new Promise(r => setTimeout(r, 120 * ctx.timeScale));
      await clawTo({ y: TOP_Y }, 800, 'io');
    }
    // 4. travel home; a "drop" lets go part of the way
    const dist = Math.hypot(R.HOME.x - G.claw.x, R.HOME.z - G.claw.z);
    const travelMs = 450 + dist * 380;
    if (carried && res.lucky) {
      // it slips on the way but lands right over the opening
      const f = clamp(res.f, 0, 1), sx = G.claw.x, sz = G.claw.z;
      await clawTo({ x: sx + (R.HOME.x - sx) * f, z: sz + (R.HOME.z - sz) * f }, Math.max(140, travelMs * f), 'io');
      G.held = null; gripTag('Rơi trúng lỗ! 🍀', '#2fc58e');
      await ctx.tween(P, { x: R.CHUTE.x, y: -1.6, z: R.CHUTE.z, s: .8 }, 420, 'in');
      await clawTo({ x: R.HOME.x, z: R.HOME.z }, Math.max(160, travelMs * (1 - f)), 'io');
    } else if (carried && res.kind === 'drop') {
      const f = clamp(res.f, 0, 1), sx = G.claw.x, sz = G.claw.z;
      await clawTo({ x: sx + (R.HOME.x - sx) * f, z: sz + (R.HOME.z - sz) * f }, Math.max(140, travelMs * f), 'io');
      G.held = null; ctx.sfx('pop', .4); gripTag('Ôi rơi rồi!', '#ff6f8f');
      const pr = G.M.prizes.find(p => p.uid === res.uid), lp = poseOf(pr);
      ctx.tween(P, { x: lp.x, y: lp.y, z: lp.z, ry: lp.ry }, 520, 'bounce'); ctx.tween(P.userData.inner, { rx: lp.rx, rz: lp.rz }, 520);
      await clawTo({ x: R.HOME.x, z: R.HOME.z }, Math.max(160, travelMs * (1 - f)), 'io');
    } else {
      await clawTo({ x: R.HOME.x, z: R.HOME.z }, travelMs, 'io');
    }
    // nudged neighbours settle
    for (const n of res.nudged) { const m = G.plush.get(n.uid), pr = G.M.prizes.find(p => p.uid === n.uid); if (m && pr) { const lp = poseOf(pr); ctx.tween(m, { x: lp.x, z: lp.z }, 380, 'out'); } }
    // 5. open over the chute
    await openClaw(OPEN, 260);
    let pay = null;
    if (res.kind === 'win') {
      G.held = null;
      if (!res.lucky) await ctx.tween(P, { x: R.CHUTE.x, y: -1.6, z: R.CHUTE.z, s: .8 }, 520, 'in');
      ctx.remove(P); G.plush.delete(res.uid);
      pay = await payOut(res, t);
    } else if (res.kind === 'miss') { ctx.ui.toast('Càng gắp hụt rồi, thử lại nhé!', 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); }
    else if (res.kind === 'slip' && P) ctx.ui.toast(`${prize.name} tuột mất rồi 😅`, prize.icon);
    if (res.freeEarned) { ctx.ui.toast(`Đủ ${R.STARS_FOR_FREE} ⭐: tặng 1 lượt miễn phí!`, 'emoji-fluent-3d/symbols/glowing_star.png'); ctx.sfx('power', .4); }
    if (res.restocked) placePlush(res.restocked, true);
    const won = pay ? pay.coins + pay.tickets * R.TICKET_XU : 0;
    track('round', { net: won - paid, bet: paid });
    G.log.push({ kind: res.kind, lucky: res.lucky, id: res.id, paid, pay, stars: G.M.stars, free: G.M.free });
    saveMachine();
    G.busy = false; setPhase('idle');
    return Object.assign({ paid, pay }, res);
  }
  async function payOut(res, t) {
    const ctx = G.ctx, T = G.T, pz = R.BY_ID[res.id], rar = R.RARITY[pz.rarity], pay = R.payout(res.id, t.price);
    // the plush pops out of the prize door
    const m = await makePlush(res.id), door = G.door.getWorldPosition(new T.Vector3());
    m.position.set(door.x, door.y - .3, door.z - .2); m.scale.setScalar(.75); ctx.add(m);
    ctx.sfx('jingle', .45);
    await ctx.tween(m, { z: door.z + .9, y: door.y - .05, s: 1, arc: .8, ry: .5 }, 520, 'out');
    ctx.win(pay.coins, new T.Vector3(door.x, door.y + .6, door.z + 1));
    if (pay.tickets) { addTickets(pay.tickets); ctx.ui.float(`+${pay.tickets} vé`, new T.Vector3(door.x + .9, door.y + 1.2, door.z + 1)); }
    if (pay.gems) { addGems(pay.gems); ctx.ui.float(`+${pay.gems} 💎`, new T.Vector3(door.x - .7, door.y + 1.4, door.z + 1)); }
    track('win', { amount: pay.coins + pay.tickets * R.TICKET_XU });
    G.sess.won += pay.coins + pay.tickets * R.TICKET_XU; G.sess.prizes++;
    G.col[res.id] = (G.col[res.id] || 0) + 1; if (!G.test) HC.store.set('gapthu_col', G.col);
    const it = G.colItems[res.id]; it.classList.remove('bump'); void it.offsetWidth; it.classList.add('bump');
    if (pz.rarity === 'huyen') { ctx.ui.callout('HUYỀN THOẠI!', '#a86d00'); ctx.ui.confetti(140); ctx.sfx('win', .5); }
    else if (pz.rarity === 'sieu') { ctx.ui.callout('SIÊU HIẾM!', '#5f3fc9'); ctx.ui.confetti(); ctx.sfx('win', .5); }
    else ctx.ui.toast(`Gắp được ${pz.name}! +${HC.fmt(pay.coins)} xu${pay.tickets ? ` · +${pay.tickets} vé` : ''}`, pz.icon);
    refreshHud();
    await ctx.wait(500);
    await ctx.tween(m, { y: door.y + 2.6, s: .2, ry: 3 }, 480, 'in');
    ctx.remove(m);
    return pay;
  }
  function clawTo(to, ms, ease) {
    const from = Object.assign({}, G.claw), keys = Object.keys(to), ctx = G.ctx, start = performance.now(), dur = Math.max(1, ms * ctx.timeScale), fn = ctx.EASE[ease] || ctx.EASE.out;
    return new Promise(res => ctx.tweens.push({ obj: G.claw, keys: ['claw'], resolve: res, step(now) { const k = clamp((now - start) / dur, 0, 1), e = fn(k); for (const p of keys) G.claw[p] = from[p] + (to[p] - from[p]) * e; return k >= 1; } }));
  }
  function closeClaw(a, ms) { G.ctx.sfx('chip', .35); return Promise.all(G.prongs.map(p => G.ctx.tween(p, { rz: a }, ms, 'out'))); }
  function openClaw(a, ms) { return Promise.all(G.prongs.map(p => G.ctx.tween(p, { rz: a }, ms, 'out'))); }

  // ==================================================================== per frame
  let blinkT = 0;
  function update(dt, t) {
    if (!G) return;
    const c = G.claw;
    // movement while a try is active
    if (G.active && !G.busy) {
      const k = G.keys, dx = (k.k_r || k.pad_r ? 1 : 0) - (k.k_l || k.pad_l ? 1 : 0), dz = (k.k_b || k.pad_b ? 1 : 0) - (k.k_f || k.pad_f ? 1 : 0);
      if (dx || dz) { const n = Math.hypot(dx, dz); G.vel.x = dx / n * MOVE_SPEED; G.vel.z = dz / n * MOVE_SPEED; G.dragTarget = null; }
      else if (G.dragTarget) { const ex = G.dragTarget.x - c.x, ez = G.dragTarget.z - c.z, d = Math.hypot(ex, ez), sp = Math.min(6, d / Math.max(dt, 1e-3)); G.vel.x = d > 1e-4 ? ex / d * Math.min(sp, 6) : 0; G.vel.z = d > 1e-4 ? ez / d * Math.min(sp, 6) : 0; }
      else { G.vel.x *= .6; G.vel.z *= .6; }
      const p = R.clampClaw(c.x + G.vel.x * dt, c.z + G.vel.z * dt); c.x = p.x; c.z = p.z;
      if (!G.test && !G.demo && !G.ctx.SHOT) {
        const before = Math.ceil(G.timer); G.timer -= dt;
        if (Math.ceil(G.timer) !== before) { refreshHud(); status(); if (G.timer <= 5 && G.timer > 0) G.ctx.sfx('tick', .3); }
        if (G.timer <= 0) drop();
      }
    } else if (!G.busy) { G.vel.x *= .7; G.vel.z *= .7; }
    // claw + gantry
    const o = G.clawObj; o.position.set(c.x, c.y, c.z);
    const sw = G.busy ? 0 : 1; o.rotation.z += ((-G.vel.x * .05 * sw) - o.rotation.z) * Math.min(1, dt * 8); o.rotation.x += ((G.vel.z * .05 * sw) - o.rotation.x) * Math.min(1, dt * 8);
    G.bridge.position.z = c.z; G.carriage.position.set(c.x, RAIL_Y - .16, c.z);
    const top = RAIL_Y - .26, bot = c.y + .2, len = Math.max(.01, top - bot); G.cable.position.set(c.x, bot + len / 2, c.z); G.cable.scale.y = len;
    G.ring.position.x = G.ringDot.position.x = c.x; G.ring.position.z = G.ringDot.position.z = c.z;
    const tg = !G.busy && R.target(G.M, c.x, c.z);
    G.ring.material.color.setHex(tg ? (tg.alignF >= .99 ? 0x7ff0c4 : 0xffe27a) : 0xffffff);
    G.ring.visible = G.ringDot.visible = !G.busy;
    G.ring.scale.setScalar(1 + Math.sin(t * 6) * .08);
    if (G.held) { const m = G.held.m; m.position.set(c.x, c.y + G.held.dy, c.z); m.rotation.y += dt * .3; }
    // joystick follows the movement
    if (G.stick) { G.stick.rotation.z += ((-G.vel.x * .16) - G.stick.rotation.z) * Math.min(1, dt * 10); G.stick.rotation.x += ((G.vel.z * .16) - G.stick.rotation.x) * Math.min(1, dt * 10); }
    // bulbs chase
    blinkT += dt; if (blinkT > .18) { blinkT = 0; G.blink = (G.blink || 0) + 1; G.bulbs.forEach((b, i) => { b.material = G.bulbMats[(i + G.blink) % 3 === 0 ? 1 : 0]; }); }
    for (const [, m] of G.plush) if (m.userData.sparkle) { const s = m.userData.sparkle; s.material.rotation = t * 1.5; s.material.opacity = .6 + Math.sin(t * 4) * .35; }
  }

  // ==================================================================== demo (?demo=1): a bot plays by itself
  async function demoLoop() {
    const ctx = G.ctx;
    await ctx.wait(600);
    for (let n = 0; n < 200 && G; n++) {
      if (!startTry()) break;
      const aim = R.choose(G.M, 'smart', price());
      // glide there like a player on the stick: first along x, then along z
      await clawTo({ x: aim.x }, 250 + Math.abs(aim.x - G.claw.x) / MOVE_SPEED * 1000, 'io');
      await clawTo({ z: aim.z }, 250 + Math.abs(aim.z - G.claw.z) / MOVE_SPEED * 1000, 'io');
      await ctx.wait(250);
      await drop();
      await ctx.wait(700);
    }
  }

  // ==================================================================== self-test
  /** Find a spot (and, if needed, a later point of the machine's random stream) where the next try ends in `kind`.
   *  Searches on copies of the machine; the test then jumps the real machine's stream there. */
  function findDrop(kind) {
    const spots = [];
    for (const p of G.M.prizes) for (const [ox, oz] of [[0, 0], [.08, 0], [0, .08], [-.12, .05], [.18, -.1], [.3, .2], [-.32, -.25]]) spots.push([p.x + ox, p.z + oz]);
    for (let i = 0; i < 300; i++) { const x = -1.8 + (i % 20) * .2, z = -1.3 + Math.floor(i / 20) * .2; if (!R.target(G.M, x, z) && !R.inKeepOut(x, z)) { spots.push([x, z]); break; } }
    const st = { s: G.M.s };
    for (let k = 0; k < 400; k++) {
      for (const [x, z] of spots) {
        const copy = R.load(JSON.parse(JSON.stringify(R.save(G.M)))); copy.s = st.s;
        const r = R.attempt(copy, x, z);
        if (r.kind === kind) return { x: r.claw.x, z: r.claw.z, s: st.s };
      }
      R.rnd(st);
    }
    return null;
  }
  async function selftest(ctx) {
    const out = { checks: {}, tries: [] };
    await setup(ctx, { test: true, seed: 777 });
    const H = HC.store, c0 = ctx.coins, tk0 = H.get('tickets', 0) || 0;
    out.checks.prizes = G.M.prizes.length === R.N_PRIZES && G.plush.size === R.N_PRIZES;
    // move with the pad (hold right) and the keyboard (hold up)
    const x0 = G.claw.x, z0 = G.claw.z;
    G.padBtns.r.dispatchEvent(new PointerEvent('pointerdown')); await new Promise(r => setTimeout(r, 400)); G.padBtns.r.dispatchEvent(new PointerEvent('pointerup'));
    dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' })); await new Promise(r => setTimeout(r, 300)); dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' }));
    out.checks.moved = G.claw.x > x0 + .3 && G.claw.z < z0 - .2 && G.active && ctx.coins === c0 - 1000;
    out.checks.bounds = G.claw.x <= R.CLAW_BOUNDS.x1 + 1e-9 && G.claw.z >= R.CLAW_BOUNDS.z0 - 1e-9;
    const run = async (kind) => {
      const at = findDrop(kind); if (!at) return null;
      if (!G.active) startTry();
      G.claw.x = at.x; G.claw.z = at.z; G.M.s = at.s;
      const cb = ctx.coins, paidBefore = G.paid, r = await drop();
      out.tries.push({ kind: r.kind, want: kind, lucky: r.lucky, id: r.id, delta: ctx.coins - cb, paid: paidBefore });
      return r;
    };
    // a win: coins = payout (the try was paid when it started)
    const colBefore = Object.assign({}, G.col);
    const w = await run('win');
    out.checks.win = !!w && w.kind === 'win' && out.tries[out.tries.length - 1].delta === w.pay.coins && G.col[w.id] === (colBefore[w.id] || 0) + 1 && G.plush.size === R.N_PRIZES;
    out.checks.tickets = !!w && (H.get('tickets', 0) || 0) === tk0 + w.pay.tickets;
    // a slip and a miss pay nothing and give a star
    const s0 = G.M.stars;
    const s = await run('slip'); const c1 = ctx.coins; const m = await run('miss');
    out.checks.slip = !!s && s.kind === 'slip' && !s.pay; out.checks.miss = !!m && m.kind === 'miss' && ctx.coins === c1 - 1000 && G.M.stars === s0 + 2;
    const d = await run('drop'); out.checks.drop = !!d && d.kind === 'drop' && G.M.prizes.some(p => p.uid === d.uid);
    // free try after 10 stars
    G.M.stars = R.STARS_FOR_FREE - 1; const c2 = ctx.coins;
    await run('miss'); out.checks.freeEarned = G.M.free === 1 && G.M.stars === 0;
    const c3 = ctx.coins; startTry(); out.checks.freeUsed = ctx.coins === c3 && G.M.free === 0 && G.paid === 0 && c2 - c3 === 1000;
    await run('miss');
    // switching machines changes the price
    await switchMachine('vang'); const c4 = ctx.coins; startTry(); out.checks.vang = G.tier === 'vang' && c4 - ctx.coins === 20000;
    const v = await run('win'); out.checks.vangWin = !!v && v.pay.coins === Math.round(R.RARITY[R.BY_ID[v.id].rarity].mult * 20000);
    // save / load keeps the machine
    const snap = R.save(G.M), back = R.load(JSON.parse(JSON.stringify(snap)));
    out.checks.saveLoad = !!back && back.prizes.length === G.M.prizes.length && back.s === G.M.s;
    // drag moves the claw (relative)
    await switchMachine('hong');
    const cv = ctx.el.canvas, rect = cv.getBoundingClientRect(), px = rect.left + rect.width * .5, py = rect.top + rect.height * .62;
    const bx = G.claw.x;
    ctx.onPointerDown({ clientX: px, clientY: py }); ctx.onPointerMove({ clientX: px + 160, clientY: py }); await new Promise(r => setTimeout(r, 300)); ctx.onPointerUp({});
    out.checks.drag = G.active && G.claw.x > bx + .2;
    await drop();
    // lobby rooms = the three machines, one price each
    const lobbyRooms = T3.roomsFor ? T3.roomsFor(KEY, T3.modules[KEY]) : T3.modules[KEY].rooms;
    out.checks.rooms = lobbyRooms.map(r => r.stakes.join('/')).join() === R.TIERS.map(t => t.price).join() && lobbyRooms.every(r => R.TIER[r.id]);
    // the pure rules agree on the economy
    const sim = R.simulate({ tries: 3000, player: 'smart', seed: 5 });
    out.rtp = +(sim.rtp * 100).toFixed(1); out.checks.economy = sim.rtp > .75 && sim.rtp < 1.1;
    out.coinsDelta = ctx.coins - c0;
    const ok = Object.values(out.checks).every(Boolean);
    return Object.assign(out, { pass: ok ? 1 : 0, fail: ok ? 0 : 1 });
  }
})();
