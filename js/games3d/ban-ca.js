/* Bắn Cá 3D — shoot cute fish in an underwater scene. Fish table, HP model, prizes and swim paths: js/games3d/rules/ban-ca.js.
 * Coordinates: fish and bullets live around the swim plane y = PY inside G.bounds (x right, z toward the camera).
 * Your cannon sits at the bottom edge, three bot cannons on the left, top and right edges.
 * Aiming: pressing on (or near, in screen space) a fish locks onto it; bullets then home in on that fish and always land.
 * Pressing on empty water fires straight; straight bullets bounce off the edges and hit any fish they touch (3D test).
 */
(function () {
  'use strict';
  const PY = 1.4, SAND_Y = -1.7, DEG = Math.PI / 180;
  const LEVEL_HEX = [0xff6fa8, 0x2fc58e, 0x3d9bff, 0x8d6bff, 0xffb81c];
  const LEVEL_CSS = ['#ff6fa8', '#2fc58e', '#3d9bff', '#8d6bff', '#ffb81c'];
  const CANNON_PNG = ['cannon_lv1_pink', 'cannon_lv2_mint', 'cannon_lv3_sky', 'cannon_lv4_lavender', 'cannon_lv5_gold'];
  const MAX_FISH = 30, MAX_MY_BULLETS = 14, FIRE_GAP = .2, BULLET_SPEED = 21, BULLET_LIFE = 12, POOL_BULLETS = 60, POOL_NETS = 24, POOL_COINS = 90, POOL_HP = 32;
  const LOCK_RADIUS = 70;                       // UI px: how close to a fish (on screen) a press must be to lock onto it
  const BULLET_R = .32;                         // bullet radius for the 3D hit test
  let G = null, R = null;

  T3.register('ban-ca', {
    title: 'Bắn Cá', sub: 'Nhấn giữ vào cá để khoá mục tiêu · cá to nhiều máu, thưởng lớn · trùm xuất hiện mỗi phút',
    table: 'none', theme: 'sky', tex: ['ban-ca', 'custom-fish'], scripts: ['js/games3d/rules/ban-ca.js'],   // custom-fish: your own fish art (tools/apply_custom.py)
    cam: { pos: [0, 22, 13], look: [0, PY, 0] },
    rules: '<p>Đang tải bảng cá…</p>',
    async start(ctx) { await setup(ctx, {}); },
    async selftest(ctx) { return selftest(ctx); },
  });

  /** Picture of a species for HTML (rules table, toasts): custom art lives in HC_TEX as a data URI. */
  function iconOf(f) {
    if (f.custom) return (window.HC_TEX || {})[f.look] || 'emoji-fluent-3d/sea/fish.png';
    return f.look.startsWith('proc:') ? 'emoji-fluent-3d/sea/tropical_fish.png' : 'emoji-fluent-3d/sea/' + f.look.slice(4) + '.png';
  }
  function hpRange(f) { const s = R.SPREAD[f.tier], m = R.hp(f.mult); return f.tier === 'small' ? `${Math.max(1, Math.floor(m * (1 - s)))}–${Math.min(5, Math.ceil(m * (1 + s)))}` : `${Math.floor(m * (1 - s))}–${Math.ceil(m * (1 + s))}`; }
  function rulesHtml() {
    const img = f => HC.A(iconOf(f));
    const rows = R.FISH.map(f => `<tr><td><img src="${img(f)}" style="width:44px;vertical-align:middle;${f.look.startsWith('proc:') ? 'filter:hue-rotate(' + ({ 'proc:gold': 150, 'proc:pink': 260, 'proc:clown': 140, 'proc:dragon': 160 }[f.look]) + 'deg)' : ''}"> ${f.name}</td><td><b>×${f.mult}</b></td><td>${hpRange(f)}</td><td>${R.TIERS[f.tier]}</td></tr>`).join('');
    return `<p><b>Nhấn vào một con cá</b> (hoặc gần nó) để <b>khoá mục tiêu</b>: vòng ngắm hiện trên con cá và đạn sẽ <b>bay đuổi theo nó</b>, trúng chắc chắn. Giữ chuột (hoặc giữ tay) để bắn liên tục. Nhấn vào chỗ không có cá thì đạn bay thẳng, nảy khi chạm thành và trúng con nào thì tính con đó. Bật <b>TỰ BẮN</b> để súng tự chọn cá và bám theo.</p>
      <ul><li>Mỗi viên đạn tốn đúng mức cược của súng: cấp 1–5 = <b>1K · 2K · 5K · 10K · 50K</b> (nút − / +).</li>
      <li>Mỗi con cá có một <b>thanh máu</b>, hiện ra khi bị bắn trúng và tụt sau mỗi phát. Phát nào làm cạn thanh máu thì <b>bắt được cá</b> và nhận <b>cược × hệ số</b>.</li>
      <li><b>Cá càng to càng nhiều máu nhưng thưởng càng lớn</b>: cá nhỏ chỉ cần 1–5 phát, trùm cần cả trăm phát. Trung bình mỗi phát trúng trả lại <b>95%</b> tiền đạn, cá nhỏ hay cá to đều như nhau.</li>
      <li>Cá trúng lưới sẽ bơi chậm lại một chút. Cá bơi khỏi màn hình thì mang theo vết thương, số đạn đã bắn vào nó coi như mất.</li>
      <li>Nếu bạn và bot cùng bắn một con, khi cá bị bắt thì <b>ai góp đạn cũng được chia thưởng</b> theo số xu đã bắn vào nó. Bot không bao giờ lấy xu của bạn. Đạn lạc không trúng con nào được hoàn xu.</li>
      <li>Khoảng mỗi phút có một <b>trùm</b> (${R.BOSSES.map(b => b.name).join(', ')}) bơi ngang, hệ số ×${Math.min(...R.BOSSES.map(b => b.mult))} đến ×${Math.max(...R.BOSSES.map(b => b.mult))}.</li></ul>
      <table style="width:100%;border-collapse:collapse;font-size:24px"><tr style="color:#c2407a"><th style="text-align:left">Cá</th><th>Hệ số</th><th>Máu (số phát)</th><th>Loại</th></tr>${rows}</table>`;
  }

  // ==================================================================== setup
  async function setup(ctx, opts) {
    const T = ctx.THREE; R = window.Rules['ban-ca'];
    if (!R.customAdded) {                                                // species from custom/ban-ca, new art for built-in ones from custom/ban-ca/thay
      R.customAdded = R.addFish(window.HC_CUSTOM_FISH || []).length || true;
      const looks = window.HC_CUSTOM_LOOKS || {};
      for (const id in looks) if (R.BY_ID[id] && (window.HC_TEX || {})[looks[id]]) Object.assign(R.BY_ID[id], { look: looks[id], custom: true });
    }
    T3.modules['ban-ca'].rules = rulesHtml();
    G = { ctx, T, fish: [], bullets: [], nets: [], coins: [], fx: [], own: new Set(), level: opts.test ? 3 : ctx.Q.has('demo') ? 1 : 2, auto: false, firing: false,
      aim: new T.Vector3(0, PY, -2), lastShot: -9, t: 0, spent: 0, won: 0, shots: 0, caught: 0, myInFlight: 0, test: !!opts.test, demo: ctx.Q.has('demo') && !opts.test,
      log: [], spawnT: 0, bossT: 0, bounds: Object.assign({}, R.DEFAULT_BOUNDS), camKey: '', lock: null, pointer: null, safe: { top: .13, bottom: .15 } };
    G.bossT = G.demo ? 2.5 : 38;
    G.preview = R.BY_ID[ctx.Q.get('fish')] || null;   // ?fish=<id> keeps sending that species (to look at your own fish art)
    if (G.preview && G.preview.tier === 'boss') G.bossT = 1.5;
    ctx.music('sea');
    // the 'none' table still gets the room floor/rug and async potted plants: sweep everything that is not ours
    G.own.add(ctx.keyLight.target); ctx.scene.children.filter(o => !o.isLight && o !== ctx.keyLight.target).forEach(o => ctx.scene.remove(o));
    for (const k of ['bc_bullet', 'bc_net', ...R.FISH.filter(f => !f.look.startsWith('proc:')).map(f => f.look), 'sea_spiral_shell']) ctx.tex(k);
    await ctx.texReady();
    buildWorld();
    buildPools();
    buildCannons();
    buildHud();
    bindInput();
    ctx.onFrame(update);
    addEventListener('resize', () => { fitCamera(); ctx.updateLabels(); });   // re-project labels right away (the framework waits for the next tick)
    if (!G.test) { updateBounds(); for (let i = 0; i < 12; i++) spawnSchool(null, .12 + Math.random() * .62); }
    if (G.demo) setAuto(true);
  }

  // ==================================================================== world
  function own(o) { G.ctx.add(o); G.own.add(o); return o; }
  /** Bake every mesh under `root` (except inside `skip` objects) into one mesh per material: far fewer draw calls. */
  function mergeStatic(root, skip = new Set()) {
    const T = G.T; root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert(), byMat = new Map(), victims = [];
    root.traverse(o => {
      if (!o.isMesh || o === root) return;
      for (let p = o; p && p !== root; p = p.parent) if (skip.has(p)) return;
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(inv.clone().multiply(o.matrixWorld));
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!byMat.has(o.material)) byMat.set(o.material, { list: [], cast: false });
      const e = byMat.get(o.material); e.list.push(g); e.cast = e.cast || o.castShadow; victims.push(o);
    });
    victims.forEach(o => o.parent.remove(o));
    for (const [m, e] of byMat) {
      const n = e.list.reduce((s, g) => s + g.attributes.position.count, 0), out = new T.BufferGeometry();
      for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]]) { const arr = new Float32Array(n * size); let off = 0; for (const g of e.list) { arr.set(g.attributes[name].array, off); off += g.attributes[name].array.length; } out.setAttribute(name, new T.BufferAttribute(arr, size)); }
      out.computeBoundingSphere();
      const mesh = new T.Mesh(out, m); mesh.castShadow = e.cast; mesh.receiveShadow = true; root.add(mesh);
    }
    return root;
  }
  const keep = o => o.isLight || G.own.has(o) || (G.ctx.keyLight && o === G.ctx.keyLight.target);
  function sweepRoom() { for (const o of [...G.ctx.scene.children]) if (!keep(o)) G.ctx.scene.remove(o); }
  function mat(hex, o = {}) { return G.ctx.mat(hex, Object.assign({ roughness: .55 }, o)); }

  function buildWorld() {
    const { ctx, T } = G, H = ctx.H, w = G.world = own(new T.Group());
    G.glowTex = T3.canvasTex(64, 64, (x, W) => { const g = x.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, W); });
    ctx.scene.background = T3.canvasTex(8, 512, (x, W, Hh) => { const g = x.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, '#8eeaf2'); g.addColorStop(.5, '#3fb3d8'); g.addColorStop(1, '#1d6fa8'); x.fillStyle = g; x.fillRect(0, 0, W, Hh); });
    ctx.scene.fog = new T.Fog(new T.Color('#2a8fc8'), 30, 72);
    ctx.scene.children.filter(o => o.isLight).forEach(l => {
      if (l.isHemisphereLight) { l.color.set(0xd2f6ff); l.groundColor.set(0x2f7fa8); l.intensity = .8; }
      else if (l.castShadow) { l.color.set(0xf4fdff); l.intensity = 1.0; l.position.set(-5, 26, 9); l.shadow.camera.left = -18; l.shadow.camera.right = 18; l.shadow.camera.top = 14; l.shadow.camera.bottom = -14; l.shadow.camera.updateProjectionMatrix(); }
      else { l.color.set(0x9fe8ff); l.intensity = .35; }
    });
    // sand floor with ripples
    const sandTex = T3.canvasTex(512, 512, (x, W, Hh) => {
      x.fillStyle = '#e8bd7a'; x.fillRect(0, 0, W, Hh);
      for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(255,236,200,${.25 + Math.random() * .25})`; x.lineWidth = 5 + Math.random() * 6; x.beginPath(); const y0 = Math.random() * Hh; for (let X = -10; X <= W + 10; X += 16) x.lineTo(X, y0 + Math.sin(X / 40 + i) * 9); x.stroke(); }
      for (let i = 0; i < 2600; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(190,140,90,.22)' : 'rgba(255,255,255,.35)'; x.fillRect(Math.random() * W, Math.random() * Hh, 2 + Math.random() * 2, 2); }
    });
    sandTex.wrapS = sandTex.wrapT = T.RepeatWrapping; sandTex.repeat.set(9, 9);
    const sand = new T.Mesh(new T.PlaneGeometry(160, 160), new T.MeshStandardMaterial({ map: sandTex, roughness: 1 })); sand.rotation.x = -Math.PI / 2; sand.position.y = SAND_Y; sand.receiveShadow = true; w.add(sand);
    // soft dunes
    const duneMat = mat(0xf2d3a0, { roughness: 1 });
    for (const [x, z, s] of [[-17, -9, 5], [16, -10, 6], [-19, 6, 5], [19, 7, 6], [0, -13, 7], [-9, 12, 5], [10, 12, 5]]) { const d = new T.Mesh(new T.SphereGeometry(1, 24, 12), duneMat); d.scale.set(s, s * .22, s * .8); d.position.set(x, SAND_Y, z); d.receiveShadow = true; w.add(d); }
    // caustics: tileable cellular pattern, two layers drifting
    const cTex = causticTex(); cTex.wrapS = cTex.wrapT = T.RepeatWrapping; cTex.repeat.set(7, 7);
    G.caustics = [0, 1].map(i => { const t = cTex.clone(); t.needsUpdate = true; t.repeat.set(i ? 5.3 : 7, i ? 5.3 : 7); const m = new T.Mesh(new T.PlaneGeometry(90, 90), new T.MeshBasicMaterial({ map: t, color: i ? 0x9fefff : 0xd8fbff, transparent: true, opacity: i ? .09 : .13, blending: T.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = SAND_Y + .04 + i * .02; w.add(m); return t; });
    // blue water haze between the sea floor and the swimming layer: tints the floor, keeps the fish crisp
    const haze = new T.Mesh(new T.PlaneGeometry(220, 220), new T.MeshBasicMaterial({ color: 0x0a78c2, transparent: true, opacity: .58, depthWrite: false })); haze.rotation.x = -Math.PI / 2; haze.position.y = .3; haze.renderOrder = -5; w.add(haze);
    // decor around the edges
    const rockMats = [0xb9a7d8, 0x9fb7cc, 0xc9b3a3, 0xa8c3b8].map(c => mat(c, { roughness: .85, flatShading: true }));
    const rock = (x, z, s, k = 0) => { const r = new T.Mesh(new T.IcosahedronGeometry(1, 1), rockMats[k % 4]); r.scale.set(s * (1.2 + Math.random() * .5), s * (.7 + Math.random() * .4), s * (1 + Math.random() * .4)); r.rotation.y = Math.random() * 6; r.position.set(x, SAND_Y + s * .25, z); r.castShadow = true; r.receiveShadow = true; w.add(r); };
    [[-15, -7.5, 1.6], [-13.4, -8.6, 1], [14.6, -7.8, 1.8], [16.5, -5.5, 1.1], [-16, 3, 1.3], [15.5, 4.5, 1.4], [-6, -9.5, 1.1], [7.5, -9.6, 1.3], [-12.5, 8.6, 1.2], [12.6, 9, 1.1], [-3.5, 9.6, .8], [4.6, 10, .9]].forEach(([x, z, s], i) => rock(x, z, s, i));
    const coralCols = [0xff7fa8, 0xff9f5a, 0xb07cff, 0xff6f8a, 0x4fd6c8];
    [[-14, -5.8], [13.2, -6.4], [-15.4, 5.4], [16, 2], [-9.5, -9], [10.5, -8.8], [-7.6, 9.4], [8.4, 9.6], [0, -10.3]].forEach(([x, z], i) => w.add(coral(x, z, coralCols[i % coralCols.length], .9 + Math.random() * .6)));
    G.weedTime = { value: 0 };
    const weeds = new T.Group(); w.add(weeds);
    [[-17, -2], [-16.6, -4], [17, -1], [16.8, -3.4], [-11.5, -9.8], [12, -10], [-17.2, 8.2], [17.4, 8.6], [-3, -11], [3.4, -11.2], [-14.2, 10.4], [14.2, 10.6], [-18, 1.5], [18, 1]].forEach(([x, z], i) => weeds.add(seaweed(x, z, i)));
    mergeStatic(weeds);
    const star = starfish(); [[-11, 6.6, 0xff8f5c], [11.6, -5.2, 0xff6fa8], [5.5, 8.6, 0xffc93c], [-5.8, -8.2, 0xb07cff]].forEach(([x, z, c]) => { const s = new T.Mesh(star, mat(c, { roughness: .6 })); s.rotation.x = -Math.PI / 2; s.rotation.z = Math.random() * 6; s.position.set(x, SAND_Y + .05, z); s.scale.setScalar(.8 + Math.random() * .4); s.castShadow = true; w.add(s); });
    const shellMat = new T.MeshBasicMaterial({ map: ctx.tex('sea_spiral_shell'), transparent: true, alphaTest: .3, toneMapped: false });
    [[-8.6, 8.2], [9.6, -8.4], [14.8, 7.4]].forEach(([x, z]) => { const s = new T.Mesh(new T.PlaneGeometry(1.4, 1.4), shellMat); s.rotation.x = -Math.PI / 2; s.rotation.z = Math.random() * 2 - 1; s.position.set(x, SAND_Y + .08, z); w.add(s); });
    G.chest = chest(); G.chest.position.set(-12.2, SAND_Y, -10.4); G.chest.rotation.y = .5; w.add(G.chest);
    // god rays
    const rayTex = T3.canvasTex(64, 256, (x, W, Hh) => { const g = x.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, Hh); const h = x.createLinearGradient(0, 0, W, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, W, Hh); });
    G.rays = [];
    for (let i = 0; i < 7; i++) { const m = new T.Mesh(new T.PlaneGeometry(2.2 + Math.random() * 2.5, 34), new T.MeshBasicMaterial({ map: rayTex, color: 0xeaffff, transparent: true, opacity: .1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); m.position.set(-16 + i * 5.3 + Math.random() * 2, 9, -9 + Math.random() * 10); m.rotation.z = .35; m.userData.ph = Math.random() * 6; w.add(m); G.rays.push(m); }
    // bubbles (one Points object)
    const N = 150, pos = new Float32Array(N * 3), sp = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 38; pos[i * 3 + 1] = SAND_Y + Math.random() * 12; pos[i * 3 + 2] = (Math.random() - .5) * 24; sp[i] = .6 + Math.random() * 1.4; }
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(pos, 3));
    const bubTex = T3.canvasTex(64, 64, (x, W) => { x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 4; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 5, 0, 7); x.stroke(); x.fillStyle = 'rgba(255,255,255,.18)'; x.fill(); x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.arc(W * .36, W * .34, 6, 0, 7); x.fill(); });
    G.bubbles = new T.Points(bg, new T.PointsMaterial({ map: bubTex, size: .42, transparent: true, depthWrite: false, opacity: .8, fog: false })); G.bubbles.userData.sp = sp; w.add(G.bubbles);
    // shared bits
    G.shadowMat = new T.MeshBasicMaterial({ map: T3.canvasTex(64, 64, (x, W) => { const g = x.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); g.addColorStop(0, 'rgba(10,50,80,.55)'); g.addColorStop(1, 'rgba(10,50,80,0)'); x.fillStyle = g; x.fillRect(0, 0, W, W); }), transparent: true, depthWrite: false });
    G.shadowGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // one instanced mesh draws every fish's soft shadow on the sand
    G.shadows = new T.InstancedMesh(G.shadowGeo, G.shadowMat, MAX_FISH + 8); G.shadows.count = 0; G.shadows.frustumCulled = false; G.shadows.renderOrder = -6; w.add(G.shadows);
    G.m4 = new T.Matrix4(); G.v3 = new T.Vector3(); G.q0 = new T.Quaternion(); G.s3 = new T.Vector3();
  }
  function causticTex() {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), img = x.createImageData(S, S), pts = [];
    for (let i = 0; i < 22; i++) pts.push([Math.random() * S, Math.random() * S]);
    for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
      let d1 = 1e9, d2 = 1e9;
      for (const [px, py] of pts) { let dx = Math.abs(X - px), dy = Math.abs(y - py); if (dx > S / 2) dx = S - dx; if (dy > S / 2) dy = S - dy; const d = Math.sqrt(dx * dx + dy * dy); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }   // wrap-around distance: tileable
      const v = Math.max(0, 1 - (d2 - d1) / 7), a = Math.pow(v, 2.2) * 255, i = (y * S + X) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a;
    }
    x.putImageData(img, 0, 0);
    const t = new G.T.CanvasTexture(c); t.encoding = G.T.sRGBEncoding; return t;
  }
  function coral(x, z, color, s) {
    const T = G.T, g = new T.Group(), m = mat(color, { roughness: .5, emissiveHex: color, emissiveIntensity: .12 }), tipM = mat(0xffffff, { roughness: .4, emissiveHex: color, emissiveIntensity: .25 });
    const branch = (parent, len, rad, depth) => {
      const b = new T.Group(); parent.add(b);
      const c = new T.Mesh(new T.CylinderGeometry(rad * .75, rad, len, 10), m); c.position.y = len / 2; c.castShadow = true; b.add(c);
      if (depth > 0) for (let i = 0; i < 2; i++) { const k = branch(b, len * .72, rad * .72, depth - 1); k.position.y = len * .95; k.rotation.z = (i ? 1 : -1) * (.35 + Math.random() * .3); k.rotation.y = Math.random() * 3; }
      else { const tip = new T.Mesh(new T.SphereGeometry(rad * 1.25, 10, 8), tipM); tip.position.y = len; b.add(tip); }
      return b;
    };
    for (let i = 0; i < 3; i++) { const b = branch(g, 1.1, .2, 2); b.rotation.z = (i - 1) * .4; b.rotation.y = i * 2.1; }
    g.position.set(x, SAND_Y, z); g.scale.setScalar(s); return mergeStatic(g);
  }
  function weedMat(col) {
    G.weedMats = G.weedMats || {};
    if (G.weedMats[col]) return G.weedMats[col];
    const m = mat(col, { roughness: .6 });
    m.onBeforeCompile = sh => {   // sway grows with height above the sand
      sh.uniforms.uTime = G.weedTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float hh = max(0.0, position.y - (${SAND_Y.toFixed(2)}));
        float sw = sin(uTime * 1.3 + position.x * .7 + position.z * .45 - hh * .5) * .055 * hh * hh / (1.0 + hh * .35);
        transformed.x += sw; transformed.z += sw * .6;`);
    };
    return (G.weedMats[col] = m);
  }
  function seaweed(x, z, i) {
    const T = G.T, root = new T.Group(); root.position.set(x, SAND_Y, z);
    const m = weedMat([0x3fcf7a, 0x2fb59a, 0x6fdc6a][i % 3]), geo = G.leafGeo || (G.leafGeo = new T.SphereGeometry(.42, 10, 8));
    for (let k = 0; k < 3; k++) {
      const n = 6 + Math.floor(Math.random() * 3), ox = (k - 1) * .4, oz = (Math.random() - .5) * .4, ry = k * 2.1 + Math.random(), lean = (Math.random() - .5) * .3;
      for (let j = 0; j < n; j++) { const leaf = new T.Mesh(geo, m); leaf.scale.set(.55 - j * .03, 1, .3); leaf.rotation.set(0, ry, Math.sin(j * .9 + k) * .25 + lean); leaf.position.set(ox + Math.sin(j * .8 + k) * .12 + lean * j * .3, .35 + j * .62, oz); root.add(leaf); }
    }
    return root;
  }
  function starfish() {
    const T = G.T, s = new T.Shape();
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? .32 : .8; const p = [Math.cos(a) * r, Math.sin(a) * r]; if (i) s.lineTo(p[0], p[1]); else s.moveTo(p[0], p[1]); }
    return new T.ExtrudeGeometry(s, { depth: .1, bevelEnabled: true, bevelThickness: .08, bevelSize: .08, bevelSegments: 3 });
  }
  function chest() {
    const T = G.T, H = G.ctx.H, g = new T.Group(), wood = mat(0xc98a4b, { roughness: .7 }), gold = mat(0xffcf4d, { roughness: .3, metalness: .5 });
    const base = new T.Mesh(H.roundedBox(2.4, 1.2, 1.6, .12, 2), wood); base.position.y = .6; base.castShadow = true; g.add(base);
    for (const x of [-.8, .8]) { const band = new T.Mesh(H.roundedBox(.18, 1.25, 1.66, .05, 1), gold); band.position.set(x, .6, 0); g.add(band); }
    const lid = new T.Group(); lid.position.set(0, 1.2, -.8); lid.rotation.x = -1.05; g.add(lid);
    const lm = new T.Mesh(new T.CylinderGeometry(.8, .8, 2.4, 20, 1, false, 0, Math.PI), wood); lm.rotation.z = Math.PI / 2; lm.position.z = .8; lid.add(lm);
    const coinM = mat(0xffd34d, { roughness: .25, metalness: .6, emissiveHex: 0xffb000, emissiveIntensity: .35 });
    for (let i = 0; i < 16; i++) { const c = new T.Mesh(new T.CylinderGeometry(.2, .2, .06, 14), coinM); c.position.set((Math.random() - .5) * 1.8, 1.22 + Math.random() * .2, (Math.random() - .5) * 1.1); c.rotation.set(Math.random(), 0, Math.random()); g.add(c); }
    const gem = new T.Mesh(new T.OctahedronGeometry(.3), mat(0xff6fa8, { roughness: .2, emissiveHex: 0xff6fa8, emissiveIntensity: .4 })); gem.position.set(.3, 1.6, .1); g.add(gem); g.userData.gem = gem;
    const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTex, color: 0xffe27a, transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(3.4); glow.position.y = 1.5; g.add(glow); g.userData.glow = glow;
    return mergeStatic(g, new Set([gem, glow]));
  }

  // ==================================================================== fish
  const PROC = {
    gold: { body: '#ffc44d', top: '#ff9a2e', belly: '#fff3c4', fin: 0xff8f3d },
    pink: { body: '#ff9cc8', top: '#ff5c9a', belly: '#fff0f6', fin: 0xff6fa8 },
    clown: { body: '#ff9440', top: '#ff7a1f', belly: '#ffd9b8', fin: 0xff8a3d, stripes: true },
    dragon: { body: '#ffd84d', top: '#ffb000', belly: '#fff6c8', fin: 0xff5c5c, scales: true, crown: true },
  };
  function procTemplate(style) {
    G.tpl = G.tpl || {};
    if (G.tpl[style]) return G.tpl[style];
    const T = G.T, c = PROC[style], g = new T.Group();
    const tex = T3.canvasTex(256, 128, (x, W, Hh) => {
      const gr = x.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, c.top); gr.addColorStop(.45, c.body); gr.addColorStop(.8, c.belly); gr.addColorStop(1, c.belly); x.fillStyle = gr; x.fillRect(0, 0, W, Hh);
      if (c.stripes) for (const xs of [.42, -.25]) { const u = Math.acos(-xs) / (2 * Math.PI); for (const uu of [u, 1 - u]) { x.fillStyle = '#3a2030'; x.fillRect(uu * W - 13, 0, 26, Hh); x.fillStyle = '#ffffff'; x.fillRect(uu * W - 9, 0, 18, Hh); } }
      if (c.scales) { x.strokeStyle = 'rgba(255,160,0,.55)'; x.lineWidth = 3; for (let r = 0; r < 6; r++) for (let k = 0; k < 18; k++) { x.beginPath(); x.arc(k * 15 + (r % 2) * 7, 20 + r * 14, 8, 0, Math.PI); x.stroke(); } }
    });
    const bodyM = new T.MeshStandardMaterial({ map: tex, roughness: .4, metalness: c.scales ? .25 : 0, emissive: new T.Color(c.scales ? 0x553300 : 0x000000) });
    const finM = mat(c.fin, { roughness: .45, side: T.DoubleSide, transparent: true, opacity: .95 });
    const body = new T.Mesh(new T.SphereGeometry(1, 28, 18), bodyM); body.scale.set(1.25, .95, .74); g.add(body);
    // eyes: big and cute, on the sides
    const white = mat(0xffffff, { roughness: .2 }), black = mat(0x2a1830, { roughness: .2 });
    for (const s of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(.3, 16, 12), white); e.position.set(.7, .22, s * .5); g.add(e);
      const p = new T.Mesh(new T.SphereGeometry(.18, 14, 10), black); p.position.set(.8, .24, s * .66); g.add(p);
      const gl = new T.Mesh(new T.SphereGeometry(.06, 8, 6), white); gl.position.set(.9, .33, s * .78); g.add(gl);
      const fin = new T.Group(); fin.name = s < 0 ? 'finL' : 'finR'; fin.position.set(.05, -.25, s * .62); g.add(fin);
      const fm = new T.Mesh(new T.SphereGeometry(.38, 12, 8), finM); fm.scale.set(1, .18, .6); fm.position.z = s * .25; fin.add(fm);
    }
    const mouth = new T.Mesh(new T.TorusGeometry(.12, .045, 8, 16), mat(0xd94a6a)); mouth.position.set(1.22, -.12, 0); mouth.rotation.y = Math.PI / 2; g.add(mouth);
    // tail fan (thick enough to read from above) and dorsal fin
    const ts = new T.Shape(); ts.moveTo(0, 0); ts.quadraticCurveTo(-.5, .7, -1.05, .78); ts.quadraticCurveTo(-.75, 0, -1.05, -.78); ts.quadraticCurveTo(-.5, -.7, 0, 0);
    const tg = new T.ExtrudeGeometry(ts, { depth: .16, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 2 }); tg.translate(0, 0, -.08);
    const tail = new T.Group(); tail.name = 'tail'; tail.position.x = -1.08; g.add(tail);
    const tm = new T.Mesh(tg, finM); tm.scale.set(1, 1, 2.2); tail.add(tm);
    const ds = new T.Shape(); ds.moveTo(-.7, 0); ds.quadraticCurveTo(-.2, .8, .45, 0); ds.lineTo(-.7, 0);
    const dg = new T.ExtrudeGeometry(ds, { depth: .1, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 2 }); dg.translate(0, 0, -.05);
    const dorsal = new T.Mesh(dg, finM); dorsal.position.y = .82; g.add(dorsal);
    if (c.crown) {
      const gold = mat(0xffd34d, { roughness: .25, metalness: .6, emissiveHex: 0xffa000, emissiveIntensity: .35 }), cr = new T.Group(); cr.position.set(.45, .95, 0); g.add(cr);
      const ring = new T.Mesh(new T.TorusGeometry(.32, .07, 8, 20), gold); ring.rotation.x = Math.PI / 2; cr.add(ring);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, sp = new T.Mesh(new T.ConeGeometry(.1, .3, 8), gold); sp.position.set(Math.cos(a) * .32, .16, Math.sin(a) * .32); cr.add(sp); }
      const gem = new T.Mesh(new T.OctahedronGeometry(.12), mat(0xff3d6e, { emissiveHex: 0xff3d6e, emissiveIntensity: .5 })); gem.position.y = .2; cr.add(gem);
    }
    mergeStatic(g, new Set([tail, g.getObjectByName('finL'), g.getObjectByName('finR')]));
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    return (G.tpl[style] = g);
  }
  function spriteMat(key, upright) {
    G.smat = G.smat || {};
    if (!G.smat[key]) G.smat[key] = new G.T.MeshBasicMaterial({ map: G.ctx.tex(key), transparent: true, alphaTest: .08, side: G.T.DoubleSide, toneMapped: false, depthWrite: true });
    return G.smat[key];
  }
  /** Create one fish riding `path` at distance d0 with sideways offset `off`. */
  function makeFish(type, path, d0, off) {
    const T = G.T, f = { type, path, d: d0, off, speed: type.speed * (.92 + Math.random() * .16), alive: true, dying: 0, flash: 0, ph: Math.random() * 6, x: 0, z: 0, dx: 1, dz: 0,
      t: R.newTarget(type), hitAt: -9, incoming: 0, hp: null, y: PY };
    if (type.look.startsWith('proc:')) {
      const o = procTemplate(type.look.slice(5)).clone(); o.rotation.order = 'YXZ'; o.scale.setScalar(type.r * .92);
      f.parts = { tail: o.getObjectByName('tail'), finL: o.getObjectByName('finL'), finR: o.getObjectByName('finR') };
      f.obj = o;
    } else {
      const m = new T.Mesh(G.planeGeo || (G.planeGeo = new T.PlaneGeometry(1, 1)), spriteMat(type.look).clone()); m.renderOrder = 2;
      f.obj = m; f.sprite = true; f.size = type.r * (type.tier === 'boss' ? 2.15 : 2.3);
    }
    G.world.add(f.obj);
    if (type.tier === 'big' || type.tier === 'boss') f.tag = G.ctx.label(() => above(f, type.r * .95 + .5), `<div class="tag3 ${type.tier === 'boss' ? '' : 'lemon'} bcmult">×${type.mult}</div>`);
    placeFish(f, 0);
    G.fish.push(f);
    return f;
  }
  function spawnSchool(type, progress) {
    type = type || (G.preview && G.preview.tier !== 'boss' && Math.random() < .5 ? G.preview : R.pickType(Math.random));
    const n = R.schoolSize(type, Math.random), path = R.makePath(type, Math.random, G.bounds), spread = R.schoolSpread(type);
    const base = progress != null ? path.len * progress : 0;
    for (let i = 0; i < n && G.fish.length < MAX_FISH; i++) makeFish(type, path, base - i * type.r * 1.6 - Math.random() * .4, n === 1 ? 0 : (Math.random() * 2 - 1) * spread);
  }
  function spawnBoss() {
    const b = G.preview && G.preview.tier === 'boss' ? G.preview : R.pickBoss(Math.random), path = R.makePath(b, Math.random, G.bounds);
    makeFish(b, path, 0, 0);
    G.ctx.ui.callout(b.name.toUpperCase() + '!', '#1f6fc0');
    G.ctx.ui.toast(`${b.name} ×${b.mult} xuất hiện! Bắn mau!`, iconOf(b));
    G.ctx.sfx('power', .5); G.ctx.sfx('turn', .35);
  }
  function placeFish(f, dt) {
    const q = R.pathAt(f.path, f.d), T = G.T;
    if (!q.dx && !q.dz) q.dx = 1;          // parked fish (self-test) have no heading
    f.x = q.x - q.dz * f.off; f.z = q.z + q.dx * f.off; f.dx = q.dx; f.dz = q.dz;
    const bob = Math.sin(G.t * 2.2 + f.ph) * .12, o = f.obj, s0 = f.type.r * .92;
    o.position.set(f.x, PY + bob, f.z); f.y = PY + bob;
    const pulse = 1 + f.flash * 1.1;
    if (f.sprite) {
      const cam = G.ctx.camera; o.quaternion.copy(cam.quaternion);
      const e = cam.matrixWorld.elements, sx = q.dx * e[0] + q.dz * e[2], sy = q.dx * e[4] + q.dz * e[6];
      let rz = 0, flip = 1;
      if (!f.type.upright) { flip = (sx > 0 ? -1 : 1) * (f.type.faces === 'right' ? -1 : 1); rz = sx >= 0 ? Math.atan2(sy, sx) : -Math.atan2(sy, -sx); rz = Math.max(-.5, Math.min(.5, rz)); }
      rz += Math.sin(G.t * (f.type.upright ? 2 : 5) + f.ph) * (f.type.upright ? .08 : .06);
      o.rotateZ(rz);
      const sq = f.type.upright ? 1 + Math.sin(G.t * 3 + f.ph) * .04 : 1;
      o.scale.set(f.size * flip * pulse, f.size * pulse * sq, 1);
      if (f.dying) { const k = Math.min(1, f.dying / .8); o.rotateZ(k * Math.PI * 4); o.scale.multiplyScalar(1 - k * .9); }
      o.material.color.setRGB(1, 1 - f.flash * 2.5, 1 - f.flash * 2.5);
    } else {
      const yaw = Math.atan2(-q.dz, q.dx);
      o.rotation.y = yaw; o.rotation.x = -.75 * Math.cos(yaw); o.rotation.z = Math.sin(G.t * 3 + f.ph) * .08;
      const wag = G.t * (7 + 6 / f.type.r) + f.ph;
      if (f.parts.tail) f.parts.tail.rotation.y = Math.sin(wag) * .55;
      if (f.parts.finL) { f.parts.finL.rotation.x = Math.sin(wag * .7) * .5; f.parts.finR.rotation.x = -Math.sin(wag * .7) * .5; }
      o.scale.setScalar(s0 * pulse);
      if (f.dying) { const k = Math.min(1, f.dying / .8); o.rotation.x += k * Math.PI * 4; o.scale.multiplyScalar(1 - k * .9); }
    }
  }
  /** World point straight above fish f on screen (along the camera's up vector). */
  function above(f, h) { const e = G.ctx.camera.matrixWorld.elements; return new G.T.Vector3(f.x + e[4] * h, f.y + e[5] * h, f.z + e[6] * h); }
  function removeFish(f) {
    f.alive = false; G.world.remove(f.obj);
    if (f.hp) { f.hp.on = false; f.hp.g.visible = false; f.hp = null; }
    if (G.lock === f) G.lock = null;
    if (f.sprite) f.obj.material.dispose();
    if (f.tag) f.tag.remove();
    const i = G.fish.indexOf(f); if (i >= 0) G.fish.splice(i, 1);
  }

  // ==================================================================== bullets, nets, coins (pooled)
  function buildPools() {
    const T = G.T;
    const bulletMat = new T.SpriteMaterial({ map: G.ctx.tex('bc_bullet'), transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    for (let i = 0; i < POOL_BULLETS; i++) {
      const s = new T.Sprite(bulletMat); s.scale.setScalar(.62); s.renderOrder = 30; s.visible = false;
      const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTex, color: 0xffffff, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthTest: false, depthWrite: false })); glow.scale.setScalar(1.5); glow.renderOrder = 29; glow.visible = false;
      G.world.add(s); G.world.add(glow);
      G.bullets.push({ s, glow, on: false, x: 0, z: 0, vx: 0, vz: 0, life: 0, owner: 0, bet: 0, lvl: 0 });
    }
    const netGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < POOL_NETS; i++) {
      const m = new T.Mesh(netGeo, new T.MeshBasicMaterial({ map: G.ctx.tex('bc_net'), transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); m.renderOrder = 28; m.visible = false; G.world.add(m);
      G.nets.push({ m, on: false, t: 0, r: 1 });
    }
    const coinGeo = new T.CylinderGeometry(.22, .22, .06, 18), coinMat = mat(0xffcf3a, { roughness: .25, metalness: .65, emissiveHex: 0xffa800, emissiveIntensity: .45 });
    for (let i = 0; i < POOL_COINS; i++) { const m = new T.Mesh(coinGeo, coinMat); m.visible = false; m.renderOrder = 31; G.world.add(m); G.coins.push({ m, on: false }); }
    // HP bars (billboards, shown once a fish has been hit)
    G.hpPool = [];
    const barGeo = new T.PlaneGeometry(1, 1), frameTex = T3.canvasTex(128, 32, (x, W, Hh) => { x.fillStyle = 'rgba(30,40,80,.75)'; T3.rr(x, 2, 2, W - 4, Hh - 4, 12); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 4; T3.rr(x, 2, 2, W - 4, Hh - 4, 12); x.stroke(); });
    for (let i = 0; i < POOL_HP; i++) {
      const g = new T.Group(); g.visible = false; G.world.add(g);
      const bg = new T.Mesh(barGeo, new T.MeshBasicMaterial({ map: frameTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); bg.renderOrder = 26; g.add(bg);
      const fill = new T.Mesh(barGeo, new T.MeshBasicMaterial({ color: 0x3ccf8e, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); fill.renderOrder = 27; g.add(fill);
      G.hpPool.push({ g, bg, fill, on: false });
    }
    // lock-on ring drawn over the locked fish
    const ringTex = T3.canvasTex(256, 256, (x, W) => {
      x.strokeStyle = '#fff'; x.lineWidth = 14; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 30, 0, 7); x.stroke();
      x.lineWidth = 12; x.lineCap = 'round'; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; x.beginPath(); x.moveTo(W / 2 + Math.cos(a) * (W / 2 - 52), W / 2 + Math.sin(a) * (W / 2 - 52)); x.lineTo(W / 2 + Math.cos(a) * (W / 2 - 4), W / 2 + Math.sin(a) * (W / 2 - 4)); x.stroke(); }
      x.setLineDash([18, 22]); x.lineWidth = 6; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 52, 0, 7); x.stroke();
    });
    G.lockRing = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: ringTex, color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); G.lockRing.renderOrder = 33; G.lockRing.visible = false; G.world.add(G.lockRing);
    G.flashes = [];
    for (let i = 0; i < 8; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: G.glowTex, color: 0xfff6b0, transparent: true, blending: T.AdditiveBlending, depthTest: false, depthWrite: false })); s.visible = false; s.renderOrder = 32; G.world.add(s); G.flashes.push({ s, t: 0, on: false }); }
  }
  function getFree(pool) { return pool.find(p => !p.on); }
  function net(x, z, lvl) {
    const n = getFree(G.nets); if (!n) return;
    n.on = true; n.t = 0; n.m.visible = true; n.m.position.set(x, PY + .2, z); n.m.material.color.setHex(LEVEL_HEX[lvl]); n.m.rotation.y = Math.random() * 6; n.r = 1.6 + lvl * .25;
  }
  function flash(x, y, z, s = 1.2) { const f = getFree(G.flashes); if (!f) return; f.on = true; f.t = 0; f.s.visible = true; f.s.position.set(x, y, z); f.s.userData.k = s; }
  /** Coins pop out of a caught fish and fly to `to` (a Vector3 or a function returning one). */
  function coinBurst(x, z, n, to) {
    const T = G.T;
    for (let i = 0; i < n; i++) {
      const c = getFree(G.coins); if (!c) return;
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3;
      Object.assign(c, { on: true, t: -i * .035, x: x, y: PY + .4, z: z, vx: Math.cos(a) * sp, vy: 5 + Math.random() * 3, vz: Math.sin(a) * sp, to, spin: 6 + Math.random() * 8 });
      c.m.position.set(x, PY + .4, z); c.m.visible = false; c.m.scale.setScalar(1);
    }
  }
  function walletPoint() {
    const T = G.T, ctx = G.ctx, r = ctx.el.coinEl.getBoundingClientRect(), cam = ctx.camera;
    const ndc = new T.Vector3((r.left + 20) / innerWidth * 2 - 1, -((r.top + r.height / 2) / innerHeight) * 2 + 1, .5).unproject(cam);
    return cam.position.clone().add(ndc.sub(cam.position).normalize().multiplyScalar(9));
  }

  // ==================================================================== cannons
  function makeCannon(lvl, scale = 1) {
    const T = G.T, g = new T.Group();
    const baseM = mat(0xf2f0fa, { roughness: .35 }), dotM = mat(0xc8c8de, { roughness: .4 }), gold = mat(0xffcf4d, { roughness: .25, metalness: .55 });
    const col = mat(LEVEL_HEX[lvl], { roughness: .35 });
    const plate = new T.Mesh(new T.CylinderGeometry(1.7, 1.8, .22, 48), col); plate.position.y = -.32; g.add(plate);
    const base = new T.Mesh(new T.CylinderGeometry(1.2, 1.32, .5, 40), baseM); base.castShadow = true; g.add(base);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, d = new T.Mesh(new T.SphereGeometry(.09, 10, 8), dotM); d.position.set(Math.cos(a) * 1.08, .27, Math.sin(a) * 1.08); g.add(d); }
    const ring = new T.Mesh(new T.TorusGeometry(1.26, .07, 10, 48), gold); ring.rotation.x = Math.PI / 2; ring.position.y = .2; g.add(ring);
    const turret = new T.Group(); turret.position.y = .25; g.add(turret);
    const dome = new T.Mesh(new T.SphereGeometry(.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), col); dome.castShadow = true; turret.add(dome);
    const barrel = new T.Group(); barrel.position.y = .5; turret.add(barrel);
    const tube = new T.Mesh(new T.CylinderGeometry(.36, .44, 1.9, 28), col); tube.rotation.z = -Math.PI / 2; tube.position.x = .95; tube.castShadow = true; barrel.add(tube);
    for (const x of [.55, 1.15]) { const st = new T.Mesh(new T.TorusGeometry(.42, .06, 8, 28), mat(0xffffff, { roughness: .3 })); st.rotation.y = Math.PI / 2; st.position.x = x; barrel.add(st); }
    const muzzle = new T.Mesh(new T.TorusGeometry(.4, .12, 10, 28), gold); muzzle.rotation.y = Math.PI / 2; muzzle.position.x = 1.92; barrel.add(muzzle);
    const hole = new T.Mesh(new T.CircleGeometry(.3, 20), mat(0x3a2040)); hole.rotation.y = Math.PI / 2; hole.position.x = 1.95; barrel.add(hole);
    const badge = new T.Mesh(new T.CircleGeometry(.36, 24), new T.MeshBasicMaterial({ map: levelBadge(lvl), transparent: true, toneMapped: false })); badge.rotation.x = -Math.PI / 2; badge.position.set(-.35, .82, 0); turret.add(badge);
    mergeStatic(g, new Set([turret])); mergeStatic(barrel);
    g.scale.setScalar(scale);
    const c = { g, turret, barrel, col, badge, lvl, yaw: 0, recoil: 0, scale };
    c.setLevel = l => { c.lvl = l; col.color.setHex(LEVEL_HEX[l]).convertSRGBToLinear(); badge.material.map = levelBadge(l); badge.material.needsUpdate = true; };
    c.setLevel(lvl);
    return c;
  }
  function levelBadge(l) {
    G.badges = G.badges || [];
    return G.badges[l] || (G.badges[l] = T3.canvasTex(128, 128, (x, W) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 4, 0, 7); x.fill(); x.fillStyle = LEVEL_CSS[l]; x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 14, 0, 7); x.fill(); x.font = '400 72px "Grandstander Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(String(l + 1), W / 2, W / 2 + 4); }));
  }
  function buildCannons() {
    const ctx = G.ctx, T = G.T, bots = ctx.shuffle(ctx.BOTS.slice()).slice(0, 3);
    G.cannons = [];
    const me = makeCannon(G.level - 1, .9); own(me.g); me.owner = 0; G.cannons.push(me);
    bots.forEach((b, i) => {
      const lvl = 1 + Math.floor(Math.random() * 4), c = makeCannon(lvl - 1, .72); own(c.g);
      Object.assign(c, { owner: i + 1, side: ['left', 'top', 'right'][i], name: b.name, avatar: `3d/renders/avatars/${b.key}.png`, coins: Math.round(3 + Math.random() * 25) * 100000, level: lvl, next: 1 + Math.random() * 2, target: null });
      c.label = ctx.label(() => c.labelPos, `<img src="${HC.A(c.avatar)}"><div><b>${c.name}</b><span class="c">${HC.short(c.coins)}</span></div>`, 'seatlbl bcseat');
      G.cannons.push(c);
    });
    placeCannons();
  }
  function placeCannons() {
    const b = G.bounds, T = G.T, [me, l, t, r] = G.cannons, k = Math.max(.75, Math.min(1, b.x1 / 12));
    me.g.scale.setScalar(me.scale = .8 * k); for (const c of [l, t, r]) c.g.scale.setScalar(c.scale = .72 * k);
    me.g.position.set(0, PY - .45, b.z1 - .95); me.inward = new T.Vector3(0, 0, -1);
    l.g.position.set(b.x0 + .85, PY - .45, .3); l.inward = new T.Vector3(1, 0, 0); l.labelPos = new T.Vector3(b.x0 + 1.1, PY + 1, -.75);
    t.g.position.set(-3.2, PY - .45, b.z0 + .85); t.inward = new T.Vector3(0, 0, 1); t.labelPos = new T.Vector3(-.2, PY + .4, b.z0 + 1.6);
    r.g.position.set(b.x1 - .85, PY - .45, .3); r.inward = new T.Vector3(-1, 0, 0); r.labelPos = new T.Vector3(b.x1 - 1.1, PY + 1, -.75);
    for (const c of G.cannons) if (!c.yaw) { c.yaw = Math.atan2(-c.inward.z, c.inward.x); c.turret.rotation.y = c.yaw; }
  }
  function muzzle(c) { const s = c.scale * 2.0, p = c.g.position; return { x: p.x + Math.cos(c.yaw) * s, z: p.z - Math.sin(c.yaw) * s }; }
  /** Aim direction from a cannon toward (x,z), kept pointing into the field. */
  function aimDir(c, x, z) {
    const p = c.g.position; let dx = x - p.x, dz = z - p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const dot = dx * c.inward.x + dz * c.inward.z;
    if (dot < .12) { const k = .12 - dot; dx += c.inward.x * k * 1.5; dz += c.inward.z * k * 1.5; const l2 = Math.hypot(dx, dz); dx /= l2; dz /= l2; }
    return { dx, dz };
  }
  const usable = f => f && f.alive && !f.dying && !f.t.dead;
  const onScreen = f => R.inside(f.x, f.z, G.bounds, f.type.r * .6);
  /** Fire one bullet from cannon c: homing at `target` (a fish) or straight toward (x,z). Your shots pay through ctx.spend. */
  function fire(c, target, x, z) {
    const ctx = G.ctx, mine = c.owner === 0, lvl = mine ? G.level - 1 : c.level - 1, bet = R.betOf(lvl + 1);
    if (mine && G.myInFlight >= MAX_MY_BULLETS) return false;
    const b = getFree(G.bullets); if (!b) return false;
    if (mine) { if (!ctx.spend(bet)) { G.firing = false; setAuto(false); return false; } G.spent += bet; G.shots++; G.myInFlight++; }
    else { c.coins -= bet; }
    if (target) { x = target.x; z = target.z; }
    const d = aimDir(c, x, z); c.yaw = Math.atan2(-d.dz, d.dx); c.turret.rotation.y = c.yaw;
    const m = muzzle(c);
    Object.assign(b, { on: true, x: m.x, y: PY + .1, z: m.z, vx: d.dx * BULLET_SPEED, vy: 0, vz: d.dz * BULLET_SPEED, life: BULLET_LIFE, age: 0, owner: c.owner, bet, lvl, target: target || null });
    if (target) target.incoming++;
    b.s.visible = b.glow.visible = true; b.glow.material.color.setHex(LEVEL_HEX[lvl]);
    b.s.position.set(m.x, b.y, m.z); b.glow.position.copy(b.s.position);
    c.recoil = 1; flash(m.x, PY + .55, m.z, .9 + lvl * .1);
    if (mine) ctx.sfx('laser', .18);
    return true;
  }
  function releaseBullet(b) { if (b.target) { b.target.incoming--; b.target = null; } b.on = false; b.s.visible = b.glow.visible = false; if (b.owner === 0) G.myInFlight--; }
  /** A homing bullet lost its fish (caught by someone else): follow the shooter's current lock, or fly on straight. */
  function retarget(b) {
    if (b.target) b.target.incoming--;
    const lock = b.owner === 0 ? G.lock : G.cannons[b.owner].target;
    b.target = usable(lock) && R.needed(lock.t, lock.incoming) > 0 ? lock : null;
    if (b.target) b.target.incoming++;
  }

  /** A bullet landed on fish f: one point off its HP bar; the hit that empties it catches the fish (rules.applyHit). */
  function hit(b, f) {
    const ctx = G.ctx, owner = b.owner, bet = b.bet, lvl = b.lvl;
    if (b.target === f) { f.incoming--; b.target = null; }
    releaseBullet(b); net(b.x, b.z, lvl);
    const res = R.applyHit(f.t, owner, bet);
    if (res.late) return;
    f.hitAt = G.t; f.flash = .12;
    if (owner === 0) { G.log.push({ fish: f.type.id, n: f.t.n, hits: res.hits, bet, dead: res.dead }); pop(f, '+1'); ctx.sfx('pop', .15); }
    if (!f.hp) { const h = getFree(G.hpPool); if (h) { h.on = true; f.hp = h; } }
    if (!res.dead) return;
    f.dying = .001;
    if (f.hp) { f.hp.on = false; f.hp.g.visible = false; f.hp = null; }
    const pos = new G.T.Vector3(f.x, f.y + .5, f.z), n = Math.min(14, 2 + Math.round(Math.log2(f.type.mult) * 1.6));
    for (const p of res.payouts) {
      if (p.shooter === 0) {
        if (p.amount <= 0) continue;
        G.won += p.amount; G.caught++;
        ctx.win(p.amount, pos);
        coinBurst(f.x, f.z, owner === 0 ? n : Math.max(3, n >> 1), walletPoint);
        if (f.type.tier === 'boss' && owner === 0) { ctx.ui.callout('ĐẠI THẮNG ×' + f.type.mult + '!', '#a86d00'); ctx.ui.confetti(); ctx.sfx('win', .5); }
        else if (f.type.mult >= 20 && owner === 0) { ctx.ui.callout('TRÚNG LỚN ×' + f.type.mult + '!', '#a86d00'); ctx.sfx('gold', .45); }
      } else {
        const c = G.cannons[p.shooter]; c.coins += p.amount;
        if (p.shooter === owner) { coinBurst(f.x, f.z, Math.min(8, n), () => c.g.position.clone().setY(PY + .6)); if (f.type.mult >= 20 && Math.random() < .7) botSay(c, ctx.pick(['Trúng rồi! 🎉', 'Hehe cá to nè 😎', `×${f.type.mult} nha!`])); }
      }
    }
  }
  /** Small "+1" that pops off a fish on each of your hits. */
  function pop(f, text) {
    const ctx = G.ctx, p = ctx.toUI(above(f, f.type.r * .6)), e = ctx.ui.h('div', { class: 'bchit', text, style: `left:${(p.x + (Math.random() - .5) * 30).toFixed(0)}px;top:${p.y.toFixed(0)}px` }, ctx.el.fx);
    setTimeout(() => e.remove(), 650);
  }
  function botSay(c, text) {
    if (!c.bub) c.bub = G.ctx.label(() => c.labelPos.clone().add(new G.T.Vector3(0, 0, -1.5)), '', 'bub3');
    const e = c.bub.el; e.textContent = text; e.classList.add('on'); clearTimeout(e._h); e._h = setTimeout(() => e.classList.remove('on'), 1800);
  }

  // ==================================================================== HUD & input
  function buildHud() {
    const ctx = G.ctx;
    if (!document.getElementById('bc-css')) {
      const st = document.createElement('style'); st.id = 'bc-css';
      st.textContent = `.bcpanel{position:absolute;right:16px;bottom:18px;padding:10px 24px;display:flex;flex-direction:column;gap:2px;font:800 23px "Baloo 2";color:#2a6f9e;min-width:250px}
        .bcpanel .h{font:400 26px "Grandstander Black";color:#1f6fc0}.bcpanel b{font:400 26px "Grandstander Black";color:#a86d00}.bcpanel .neg{color:#d24a6a}.bcpanel .pos{color:#2fae7a}
        .bcmult{font-size:24px;padding:3px 14px}.bcseat{transform-origin:50% 100%}
        .gbtn.bcsq{min-width:96px;padding:0 18px;font-size:52px}.gbtn.bclvl{min-width:250px}.gbtn.bclvl img{width:62px;margin:-8px 0}
        .bchit{position:absolute;font:400 30px "Grandstander Black";color:#fff;-webkit-text-stroke:6px #1f6fc0;paint-order:stroke fill;white-space:nowrap;pointer-events:none;transform:translate(-50%,-50%);animation:bchit .6s ease-out forwards}
        @keyframes bchit{0%{opacity:0;transform:translate(-50%,-30%) scale(.5)}25%{opacity:1;transform:translate(-50%,-70%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-170%) scale(.9)}}`;
      document.head.appendChild(st);
    }
    G.panel = ctx.ui.h('div', { class: 'bcpanel glass' }, ctx.ui.root);
    G.acts = ctx.ui.actions([
      { id: 'minus', label: '−', cls: 'sky bcsq', onClick: () => setLevel(G.level - 1) },
      { id: 'lvl', label: '', cls: 'lemon bclvl', icon: 'games/ban-ca/' + CANNON_PNG[0] + '.png', onClick: () => setLevel(G.level % 5 + 1) },
      { id: 'plus', label: '+', cls: 'sky bcsq', onClick: () => setLevel(G.level + 1) },
      { id: 'auto', label: 'TỰ BẮN', cls: 'grey', icon: 'emoji-fluent-3d/game/bullseye.png', onClick: () => setAuto(!G.auto) },
    ]);
    setLevel(G.level); refreshPanel();
    ctx.ui.status('Nhấn giữ <b>vào con cá</b> để khoá & bắn đuổi');
  }
  function setLevel(l) {
    l = Math.max(1, Math.min(5, l)); G.level = l;
    const bet = R.betOf(l), btn = G.acts.btn('lvl');
    btn.querySelector('img').src = HC.A('games/ban-ca/' + CANNON_PNG[l - 1] + '.png');
    G.acts.set('lvl', { label: HC.short(bet) + '/phát' });
    G.acts.set('minus', { disabled: l <= 1 }); G.acts.set('plus', { disabled: l >= 5 });
    if (G.cannons) G.cannons[0].setLevel(l - 1);
    G.ctx.sfx('click', .3);
  }
  function setAuto(on) {
    G.auto = on; const b = G.acts && G.acts.btn('auto'); if (!b) return;
    b.classList.toggle('mint', on); b.classList.toggle('grey', !on); G.acts.set('auto', { label: on ? 'ĐANG TỰ BẮN' : 'TỰ BẮN' });
    if (!on) G.lock = null;
  }
  function refreshPanel() {
    const net = G.won - G.spent;
    G.panel.innerHTML = `<div class="h">Phiên này</div><div>Đã bắn <b>${HC.short(G.spent)}</b> · ${G.shots} viên</div><div>Thu về <b>${HC.short(G.won)}</b> · ${G.caught} con</div><div>Lời/lỗ <b class="${net < 0 ? 'neg' : 'pos'}">${net < 0 ? '−' : '+'}${HC.short(Math.abs(net))}</b></div>`;
  }
  /** The fish under or nearest to a screen point (UI units), within LOCK_RADIUS of its outline. */
  function fishAtScreen(ux, uy) {
    const ctx = G.ctx, e = ctx.camera.matrixWorld.elements; let best = null, bd = LOCK_RADIUS;
    for (const f of G.fish) {
      if (!usable(f) || !onScreen(f)) continue;
      const c = new G.T.Vector3(f.x, f.y, f.z), cu = ctx.toUI(c), eu = ctx.toUI(c.clone().add(new G.T.Vector3(e[0], e[1], e[2]).multiplyScalar(f.type.r)));
      const d = Math.max(0, Math.hypot(ux - cu.x, uy - cu.y) - Math.hypot(eu.x - cu.x, eu.y - cu.y) * .85);
      if (d < bd || (d === 0 && best && f.type.mult > best.type.mult && bd === 0)) { bd = d; best = f; }
    }
    return best;
  }
  function setLock(f) { G.lock = f || null; }
  function bindInput() {
    const ctx = G.ctx, plane = new G.T.Plane(new G.T.Vector3(0, 1, 0), -PY);
    const aim = e => { const p = ctx.ray(e, plane); if (p) G.aim.copy(p); G.pointer = { ux: e.clientX / innerWidth * ctx.UW, uy: e.clientY / innerHeight * ctx.UH }; };
    ctx.onPointerMove = e => { aim(e); if (G.firing) { const f = fishAtScreen(G.pointer.ux, G.pointer.uy); if (f && f !== G.lock) setLock(f); } };
    ctx.onPointerDown = e => { aim(e); G.firing = true; if (G.auto) setAuto(false); setLock(fishAtScreen(G.pointer.ux, G.pointer.uy)); };
    ctx.onPointerUp = () => { G.firing = false; };
    addEventListener('pointerup', () => { G.firing = false; }); addEventListener('blur', () => { G.firing = false; });
  }

  // ==================================================================== camera fit
  /** Screen fractions covered by the top bar and the bottom action bar, read from the live DOM (the HUD may be rescaled). */
  function measureSafe() {
    const top = document.getElementById('top'), bar = G.acts && G.acts.el, H = innerHeight || 1;
    const t = top ? top.getBoundingClientRect().bottom : H * .12, b = bar ? bar.getBoundingClientRect().top : H * .86;
    G.safe = { top: Math.min(.3, Math.max(0, t / H + .015)), bottom: Math.min(.35, Math.max(0, (H - b) / H + .015)) };
  }
  function updateBounds() {
    const ctx = G.ctx, cam = ctx.camera, safeAspect = cam.aspect / Math.max(.3, 1 - G.safe.top - G.safe.bottom), hd = 6.5;
    const hw = Math.max(8, Math.min(12.5, hd * safeAspect * .8));
    const nb = { x0: -hw, x1: hw, z0: -hd, z1: hd };
    if (nb.x1 !== G.bounds.x1) { G.bounds = nb; if (G.cannons) placeCannons(); }
  }
  /** Fit the camera so the playfield sits between the top bar and the bottom action bar, whatever the window shape. */
  function fitCamera() {
    const ctx = G.ctx, cam = ctx.camera;
    if (!G.safeT || G.t - G.safeT > .5) { G.safeT = G.t; measureSafe(); }
    const key = cam.aspect.toFixed(3) + '|' + G.safe.top.toFixed(3) + '|' + G.safe.bottom.toFixed(3);
    if (key === G.camKey) return; G.camKey = key;
    updateBounds();
    const T = G.T, b = G.bounds, pitch = 57 * DEG, dir = new T.Vector3(0, Math.sin(pitch), Math.cos(pitch));
    const yTop = 1 - 2 * G.safe.top, yBot = -1 + 2 * G.safe.bottom, want = (yTop + yBot) / 2, v = new T.Vector3();
    const test = (d, lz) => {
      cam.position.set(0, PY, lz).addScaledVector(dir, d); cam.lookAt(0, PY, lz); cam.updateMatrixWorld();
      let ok = true, top = -9, bot = 9;
      for (const [x, z] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) { v.set(x, PY, z).project(cam); if (Math.abs(v.x) > .985) ok = false; if (z === b.z0) top = Math.max(top, v.y); else bot = Math.min(bot, v.y); }
      return { ok: ok && top <= yTop && bot >= yBot, top, bot };
    };
    let lo = 8, hi = 120, best = { d: 40, lz: 0 };
    for (let it = 0; it < 24; it++) {
      const d = (lo + hi) / 2; let lz = 0;
      for (let k = 0; k < 10; k++) { const r = test(d, lz); lz -= ((r.top + r.bot) / 2 - want) * d * .35; }
      if (test(d, lz).ok) { hi = d; best = { d, lz }; } else lo = d;
    }
    test(best.d, best.lz);
  }

  // ==================================================================== main loop
  function update(dt, now) {
    if (!G) return;
    const t0 = performance.now(); updateInner(dt, now); G.updMs = (G.updMs || 0) * .9 + (performance.now() - t0) * .1;
  }
  function updateInner(dt, now) {
    const ctx = G.ctx, T = G.T, b = G.bounds; G.t += dt;
    if (G.t < 20) sweepRoom();
    fitCamera();
    // ---- ambience
    for (const [i, t] of G.caustics.entries()) { t.offset.x += dt * (i ? -.012 : .016); t.offset.y += dt * (i ? .01 : .008); }
    for (const r of G.rays) r.material.opacity = .15 + Math.sin(G.t * .6 + r.userData.ph) * .06;
    G.weedTime.value = G.t;
    const bp = G.bubbles.geometry.attributes.position, sp = G.bubbles.userData.sp;
    for (let i = 0; i < sp.length; i++) { let y = bp.getY(i) + sp[i] * dt; if (y > 9) { y = SAND_Y; if (i % 5 === 0) { bp.setX(i, G.chest.position.x + (Math.random() - .5)); bp.setZ(i, G.chest.position.z + (Math.random() - .5)); } } bp.setY(i, y); bp.setX(i, bp.getX(i) + Math.sin(G.t * 2 + i) * dt * .15); }
    bp.needsUpdate = true;
    G.chest.userData.gem.rotation.y += dt * 1.5; G.chest.userData.glow.material.opacity = .4 + Math.sin(G.t * 2) * .15;
    // ---- spawning
    if (!G.spawnOff) {
      G.spawnT -= dt;
      const target = Math.min(MAX_FISH - 1, 18 + Math.round(b.x1 * .7));
      if (G.spawnT <= 0 && G.fish.length < target) { spawnSchool(null, null); G.spawnT = .4 + Math.random() * .8; }
      G.bossT -= dt;
      if (G.bossT <= 0 && !G.fish.some(f => f.type.tier === 'boss' && f.alive)) { spawnBoss(); G.bossT = G.preview ? 4 : G.demo ? 18 : R.nextBossDelay(Math.random); }
    }
    // ---- fish
    for (const f of [...G.fish]) {
      if (f.dying) { f.dying += dt; f.flash = 0; placeFish(f, dt); if (f.dying > .85) removeFish(f); continue; }
      if (!f.hold) f.d += f.speed * R.speedFactor(G.t - f.hitAt) * dt;
      f.flash = Math.max(0, f.flash - dt);
      if (f.d > f.path.len + .01) { removeFish(f); continue; }
      placeFish(f, dt);
    }
    let ns = 0;
    for (const f of G.fish) { const k = f.dying ? Math.max(0, 1 - f.dying / .8) : 1; G.s3.set(f.type.r * 2.6 * k, 1, f.type.r * 1.9 * k); G.v3.set(f.x + .5, SAND_Y + .05, f.z + .35); G.m4.compose(G.v3, G.q0, G.s3); G.shadows.setMatrixAt(ns++, G.m4); }
    G.shadows.count = ns; G.shadows.instanceMatrix.needsUpdate = true;
    // ---- HP bars and the lock ring follow their fish
    const cq = ctx.camera.quaternion;
    for (const f of G.fish) {
      const h = f.hp; if (!h) continue;
      const w = Math.max(1, Math.min(3, f.type.r * 1.7)), frac = Math.max(0, 1 - f.t.hits / f.t.n);
      h.g.visible = !f.dying; h.g.position.copy(above(f, f.type.r * .95 + .18)); h.g.quaternion.copy(cq);
      h.bg.scale.set(w + .16, .3, 1); h.fill.scale.set(Math.max(.001, w * frac), .16, 1); h.fill.position.x = -w / 2 + w * frac / 2;
      h.fill.material.color.setHex(frac > .5 ? 0x3ccf8e : frac > .25 ? 0xffc93c : 0xff5c7a);
    }
    if (G.lock && (!usable(G.lock) || !onScreen(G.lock))) G.lock = null;
    // ---- your cannon: TỰ BẮN or a held press keeps a lock; with no fish near the press it fires straight
    const me = G.cannons[0];
    if (!G.lock && G.auto) G.lock = autoTarget();
    if (!G.lock && G.firing && G.pointer) G.lock = fishAtScreen(G.pointer.ux, G.pointer.uy);
    const L = G.lock;
    G.lockRing.visible = !!L;
    if (L) { G.lockRing.position.set(L.x, L.y, L.z); G.lockRing.quaternion.copy(cq); G.lockRing.rotateZ(G.t * 1.5); G.lockRing.scale.setScalar((L.type.r * 1.45 + .7) * (1 + Math.sin(G.t * 8) * .05)); G.lockRing.material.color.setHex(LEVEL_HEX[G.level - 1]); }
    const tx = L ? L.x : G.aim.x, tz = L ? L.z : G.aim.z;
    const d = aimDir(me, tx, tz), yaw = Math.atan2(-d.dz, d.dx);
    me.yaw += Math.atan2(Math.sin(yaw - me.yaw), Math.cos(yaw - me.yaw)) * Math.min(1, dt * 18); me.turret.rotation.y = me.yaw;
    if ((G.firing || G.auto) && G.t - G.lastShot >= FIRE_GAP) {
      if (L) { if (R.needed(L.t, L.incoming) > 0 && fire(me, L)) G.lastShot = G.t; }          // never send more bullets than the fish has HP left
      else if (G.firing && fire(me, null, tx, tz)) G.lastShot = G.t;
    }
    // ---- bots: lock onto a fish (biased toward big ones) and fire homing shots about once a second
    for (const c of G.cannons) {
      c.recoil = Math.max(0, c.recoil - dt * 6); c.barrel.position.x = -c.recoil * .3;
      if (c.owner === 0 || G.botsOff) continue;
      if (c.target && (!usable(c.target) || !onScreen(c.target))) c.target = null;
      if (c.target) { const dd = aimDir(c, c.target.x, c.target.z), y2 = Math.atan2(-dd.dz, dd.dx); c.yaw += Math.atan2(Math.sin(y2 - c.yaw), Math.cos(y2 - c.yaw)) * Math.min(1, dt * 8); c.turret.rotation.y = c.yaw; }
      c.next -= dt;
      if (c.next <= 0) {
        c.next = .5 + Math.random() * .9;
        if (!c.target || R.needed(c.target.t, c.target.incoming) <= 0) c.target = botTarget();
        if (c.target && R.needed(c.target.t, c.target.incoming) > 0) fire(c, c.target);
        if (Math.random() < .01) { c.level = 1 + Math.floor(Math.random() * 5); c.setLevel(c.level - 1); }
      }
      c.label.el.querySelector('.c').textContent = HC.short(Math.max(0, c.coins));
    }
    // ---- bullets: homing ones steer onto their fish and always land; straight ones bounce and hit whatever they touch (3D)
    for (const bl of G.bullets) {
      if (!bl.on) continue;
      bl.age += dt;
      if (bl.target && !usable(bl.target)) retarget(bl);
      const f = bl.target;
      if (f) {
        const dx = f.x - bl.x, dy = f.y - bl.y, dz = f.z - bl.z, dist = Math.hypot(dx, dy, dz) || 1e-6, reach = f.type.r * .8 + BULLET_R;
        if (dist <= reach + BULLET_SPEED * dt || bl.age > 3) { bl.x = f.x - dx / dist * reach; bl.z = f.z - dz / dist * reach; hit(bl, f); continue; }
        const k = Math.min(1, dt * (bl.age < .08 ? 4 : 14)), sp = BULLET_SPEED / dist;
        bl.vx += (dx * sp - bl.vx) * k; bl.vy += (dy * sp - bl.vy) * k; bl.vz += (dz * sp - bl.vz) * k;
        const v = Math.hypot(bl.vx, bl.vy, bl.vz) || 1; bl.vx *= BULLET_SPEED / v; bl.vy *= BULLET_SPEED / v; bl.vz *= BULLET_SPEED / v;
        bl.x += bl.vx * dt; bl.y += bl.vy * dt; bl.z += bl.vz * dt;
      } else {
        bl.x += bl.vx * dt; bl.z += bl.vz * dt; bl.y += (PY + .1 - bl.y) * Math.min(1, dt * 6); bl.life -= dt;
        if (bl.x < b.x0) { bl.x = 2 * b.x0 - bl.x; bl.vx = Math.abs(bl.vx); } else if (bl.x > b.x1) { bl.x = 2 * b.x1 - bl.x; bl.vx = -Math.abs(bl.vx); }
        if (bl.z < b.z0) { bl.z = 2 * b.z0 - bl.z; bl.vz = Math.abs(bl.vz); } else if (bl.z > b.z1) { bl.z = 2 * b.z1 - bl.z; bl.vz = -Math.abs(bl.vz); }
        let hitF = null;
        for (const g of G.fish) { if (!usable(g) || !onScreen(g)) continue; const rr = g.type.r * 1.05 + BULLET_R; if ((g.x - bl.x) ** 2 + (g.y - bl.y) ** 2 + (g.z - bl.z) ** 2 < rr * rr) { hitF = g; break; } }
        if (hitF) { hit(bl, hitF); continue; }
        if (bl.life <= 0) { if (bl.owner === 0) { ctx.coins = ctx.coins + bl.bet; G.spent -= bl.bet; G.refunds = (G.refunds || 0) + 1; } else G.cannons[bl.owner].coins += bl.bet; releaseBullet(bl); continue; }
      }
      bl.s.position.set(bl.x, bl.y, bl.z); bl.glow.position.copy(bl.s.position);
      bl.s.material.rotation = G.t * 8;
    }
    // ---- nets, flashes, coins
    for (const n of G.nets) { if (!n.on) continue; n.t += dt; const k = n.t / .5; if (k >= 1) { n.on = false; n.m.visible = false; continue; } n.m.scale.setScalar(n.r * (.35 + T3.EASE.back(Math.min(1, k * 1.6)) * .65)); n.m.material.opacity = k < .6 ? 1 : 1 - (k - .6) / .4; }
    for (const f of G.flashes) { if (!f.on) continue; f.t += dt; const k = f.t / .14; if (k >= 1) { f.on = false; f.s.visible = false; continue; } f.s.scale.setScalar(f.s.userData.k * (1 + k)); f.s.material.opacity = 1 - k; }
    let coinSfx = false;
    for (const c of G.coins) {
      if (!c.on) continue; c.t += dt; if (c.t < 0) continue; c.m.visible = true;
      if (c.t < .5) { c.vy -= 14 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; }
      else { const to = typeof c.to === 'function' ? (c.toV || (c.toV = c.to())) : c.to, sp = 10 + (c.t - .5) * 50; const dx = to.x - c.x, dy = to.y - c.y, dz = to.z - c.z, l = Math.hypot(dx, dy, dz); if (l < .6 || c.t > 2.5) { c.on = false; c.toV = null; c.m.visible = false; coinSfx = true; continue; } c.x += dx / l * sp * dt; c.y += dy / l * sp * dt; c.z += dz / l * sp * dt; }
      c.m.position.set(c.x, c.y, c.z); c.m.rotation.x += c.spin * dt; c.m.rotation.z += c.spin * .6 * dt;
    }
    if (coinSfx) ctx.sfx('coin', .25);
    if ((G.panelT = (G.panelT || 0) + dt) > .25) { G.panelT = 0; refreshPanel(); if (ctx.Q.has('dbg')) { const inf = ctx.st.renderer.info; G.panel.insertAdjacentHTML('beforeend', `<div>calls ${inf.render.calls} tris ${inf.render.triangles} fish ${G.fish.length} upd ${(G.updMs || 0).toFixed(2)}ms</div>`); } }
  }
  /** TỰ BẮN: among fish that can still be finished before they swim off (and need at most ~12 s of fire, so bosses only once
   *  they are worn down), the most valuable of the nearest few. Every fish returns the same 95% per hit, this just keeps it lively. */
  function autoTarget() {
    const me = G.cannons[0], m = muzzle(me);
    const list = G.fish.filter(f => usable(f) && R.inside(f.x, f.z, G.bounds, -.5) && R.needed(f.t, f.incoming) > 0 && f.t.n - f.t.hits <= 60 && R.worthLocking(f.t, f.path, f.d, f.speed, 1 / FIRE_GAP));
    if (!list.length) return null;
    list.sort((a, f) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(f.x - m.x, f.z - m.z));
    return list.slice(0, 5).reduce((a, f) => (f.type.mult > a.type.mult ? f : a));
  }
  /** Bots: random fish, biased toward big multipliers. */
  function botTarget() {
    const list = G.fish.filter(f => usable(f) && R.inside(f.x, f.z, G.bounds, -1) && R.needed(f.t, f.incoming) > 0);
    if (!list.length) return null;
    list.sort((a, f) => f.type.mult - a.type.mult);
    return list[Math.floor(Math.pow(Math.random(), 1.6) * list.length)];
  }

  // ==================================================================== self-test
  async function selftest(ctx) {
    await setup(ctx, { test: true });
    G.botsOff = true; G.spawnOff = true;
    await ctx.wait(300);
    const park = (id, x, z) => { const f = makeFish(R.BY_ID[id], fixedPath(x, z), 0, 0); f.hold = true; return f; };
    const until = async (cond, ms = 20000) => { const t0 = performance.now(); while (!cond() && performance.now() - t0 < ms) await ctx.wait(40); return cond(); };   // fish and bullets move in real time
    /** Lock onto a parked fish by "pressing" on its screen position, hold until it is caught. levels: cannon level per shot index. */
    const run = async (id, levels) => {
      G.fish.slice().forEach(removeFish);
      const f = park(id, 1.5, -1.2); placeFish(f, 0); ctx.camera.updateMatrixWorld();
      const p = ctx.toUI(new G.T.Vector3(f.x + f.type.r * .5, f.y, f.z));           // press a little off-centre, still on the fish
      G.pointer = { ux: p.x, uy: p.y }; setLock(fishAtScreen(p.x, p.y));
      const locked = G.lock === f, c0 = ctx.coins, log0 = G.log.length, n = f.t.n, spent0 = G.spent;
      setLevel(levels(0)); G.firing = true;
      const lv = setInterval(() => setLevel(levels(G.log.length - log0)), 20);
      const caught = await until(() => f.dying > 0 || !f.alive);
      G.firing = false; clearInterval(lv);
      await until(() => G.myInFlight === 0, 3000);
      const log = G.log.slice(log0), spent = G.spent - spent0, delta = ctx.coins - c0;
      const prize = Math.round(f.type.mult * spent / n);                          // all hits were yours: mult × coins put in / n
      return { fish: id, mult: f.type.mult, locked, caught, hpDrawn: n, hits: log.length, maxHit: Math.max(...log.map(e => e.hits)), spent, prize, delta, expected: prize - spent,
        ok: locked && caught && log.length === n && log.every((e, i) => e.hits === i + 1 && e.hits <= n) && delta === prize - spent && G.myInFlight === 0 };
    };
    // a sea turtle (×20) at level 3 (5K), then a lobster (×25) switching 1K → 10K after 6 hits (prize follows the coins put in;
    // 10K keeps the worst case inside a fresh 1.25M wallet)
    const a = await run('rua', () => 3);
    const sw = await run('tom_hum', i => (i < 6 ? 1 : 4));
    // the + button reaches level 5 (50K)
    setLevel(3); G.acts.btn('plus').click(); G.acts.btn('plus').click();
    const lvlOk = G.level === 5 && R.betOf(G.level) === 50000;
    // a straight shot (no lock) still hits a fish it touches — 3D test including the bob height
    G.fish.slice().forEach(removeFish); setLevel(1); setLock(null);
    const g = park('ca_vang', 0, -2.5); g.t.n = 99; const s0 = G.log.length;
    fire(G.cannons[0], null, 0, -2.5);
    const straightOk = await until(() => G.log.length > s0, 3000) && G.log[G.log.length - 1].fish === 'ca_vang';
    // a stray bullet with nothing to hit is refunded
    G.fish.slice().forEach(removeFish); await ctx.wait(100); const c2 = ctx.coins;
    fire(G.cannons[0], null, 3, -6); for (let k = 0; k < 40; k++) { const bl = G.bullets.find(x => x.on && x.owner === 0); if (!bl) break; bl.life = Math.min(bl.life, .05); await ctx.wait(25); }
    const refundOk = ctx.coins === c2 && G.myInFlight === 0;
    const pass = a.ok && sw.ok && lvlOk && straightOk && refundOk;
    return { pass: pass ? 1 : 0, fail: pass ? 0 : 1, turtle: a, switchBet: sw, levelButtons: lvlOk, straightShot: straightOk, refund: refundOk, fishTypes: R.FISH.length };
  }
  function fixedPath(x, z) { return { p: [[x, z], [x, z], [x, z], [x, z]], len: 1e9, lut: [0, 1e9] }; }
})();
