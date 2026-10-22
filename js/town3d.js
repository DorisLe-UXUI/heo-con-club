/*
 * HC Town — the 3D street hub of Heo Con Club.
 * A round plaza with a fountain, a roundabout and four streets. Every game is a shop on the street;
 * trees, lamps, benches, cars, walkers and birds fill the rest. The player's mascot walks where you tap.
 * Needs: three r147 + GLTFLoader + SkeletonUtils, js/hc3d.js, assets/3d/js/tex_town.js (sign images as data URIs).
 */
(function () {
  'use strict';
  const T = window.THREE, H = window.HC3D;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // seeded random so the town is laid out the same on every visit
  let seed = 20261014;
  const srnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const sr = (a, b) => a + srnd() * (b - a);
  const spick = a => a[Math.floor(srnd() * a.length)];

  // ------------------------------------------------------------------ layout constants (metres)
  const L = { ROAD: 8, PLAZA: 13.5, RING: 20.5, RING_SW: 24, EDGE: 96, FAR: 170, LOT: 8.8, Y_SIDE: 0.2, Y_GRASS: 0.22, Y0: 0.55 };
  const ARM_LIST = [{ id: 'E', ang: 0 }, { id: 'S', ang: 90 }, { id: 'W', ang: 180 }, { id: 'N', ang: 270 }].map(a => {
    const dir = { x: Math.round(Math.cos(a.ang * DEG)), z: Math.round(Math.sin(a.ang * DEG)) };
    return Object.assign(a, { dir, lat: { x: -dir.z, z: dir.x } });
  });
  const ARMS = Object.fromEntries(ARM_LIST.map(a => [a.id, a]));
  const armPt = (arm, along, lateral, y = 0) => new T.Vector3(arm.dir.x * along + arm.lat.x * lateral, y, arm.dir.z * along + arm.lat.z * lateral);

  const CAT = {
    bai: { wall: 0xffc6de, cream: 0xfff4f8, roof: 0xff6fa8, accent: 0xff4f95, dark: 0xc2407a, css: '#ff4f95', name: 'Game bài' },
    xx: { wall: 0xffe49a, cream: 0xfff9e8, roof: 0xffb81c, accent: 0xf5a000, dark: 0xa86d00, css: '#f5a000', name: 'Xúc xắc' },
    co: { wall: 0xb6f0d8, cream: 0xf0fff8, roof: 0x2fcf96, accent: 0x1fb07c, dark: 0x168a60, css: '#1fb07c', name: 'Cờ' },
    khac: { wall: 0xc2e4ff, cream: 0xf2f9ff, roof: 0x4aa8ff, accent: 0x2f8ff0, dark: 0x1f6fc0, css: '#2f8ff0', name: 'Vui khác' },
    sp: { wall: 0xdfd3ff, cream: 0xf8f4ff, roof: 0x9b7bff, accent: 0x8a63ff, dark: 0x5f3fc9, css: '#8a63ff', name: 'Tiện ích' },
  };

  /** Every shop on the streets. arm + s choose the street side; the rest is looks. */
  const BUILDINGS = [
    { key: 'tien-len', name: 'Tiến Lên', cat: 'bai', arm: 'N', s: 1, w: 13, d: 10, h: 8, roof: 'dome', prop: 'cards', hot: true, desc: 'Tiến Lên Miền Nam đủ luật: chặt heo, tới trắng, cóng, thối.' },
    { key: 'phom', name: 'Phỏm', cat: 'bai', arm: 'N', s: 1, w: 9, d: 8, h: 6.6, roof: 'gable', prop: 'cards', desc: 'Ăn phỏm, ù tròn, xếp bài nhanh tay.' },
    { key: 'mau-binh', name: 'Mậu Binh', cat: 'bai', arm: 'N', s: 1, w: 9, d: 8, h: 7, roof: 'flat', prop: 'cards', desc: 'Xếp 3 chi thật khéo, binh lủng là thua.' },
    { key: 'xi-dach', name: 'Xì Dách', cat: 'bai', arm: 'N', s: 1, w: 9, d: 8, h: 6.6, roof: 'gable', prop: 'cards', desc: 'Rút bài sát 21, xì bàng ăn gấp đôi.' },
    { key: 'poker', name: 'Poker', cat: 'bai', arm: 'N', s: -1, w: 10, d: 8, h: 7, roof: 'flat', prop: 'chips', hot: true, desc: 'Texas Hold’em: cược, theo, tố và lật bài.' },
    { key: 'bai-cao', name: 'Bài Cào', cat: 'bai', arm: 'N', s: -1, w: 9, d: 8, h: 6.6, roof: 'gable', prop: 'cards', desc: '3 lá, tính nút, ba tây là nhất.' },
    { key: 'sam-loc', name: 'Sâm Lốc', cat: 'bai', arm: 'N', s: -1, w: 9, d: 8, h: 6.8, roof: 'tent', prop: 'cards', desc: 'Báo sâm, chặn hết là thắng lớn.' },
    { key: 'lieng', name: 'Liêng', cat: 'bai', arm: 'N', s: -1, w: 9, d: 8, h: 6.6, roof: 'flat', prop: 'chips', desc: 'Sáp, liêng, ảnh: tố thật mạnh tay.' },
    { key: 'bau-cua', name: 'Bầu Cua', cat: 'xx', arm: 'E', s: -1, w: 10, d: 8, h: 6.8, roof: 'tent', prop: 'dice', hot: true, desc: 'Đặt cửa nai, bầu, gà, cá, cua, tôm rồi lắc.' },
    { key: 'xoc-dia', name: 'Xóc Đĩa', cat: 'xx', arm: 'E', s: -1, w: 9, d: 8, h: 6.6, roof: 'gable', prop: 'coins', desc: 'Chẵn hay lẻ? Mở bát là biết.' },
    { key: 'tai-xiu', name: 'Tài Xỉu', cat: 'xx', arm: 'E', s: -1, w: 9, d: 8, h: 7, roof: 'flat', prop: 'dice3', desc: '3 xúc xắc: Tài 11–17, Xỉu 4–10.' },
    { key: 'ban-ca', name: 'Bắn Cá', cat: 'khac', arm: 'E', s: 1, w: 11, d: 9, h: 7.4, roof: 'dome', prop: 'fish', hot: true, desc: 'Nâng súng, bắn cá vàng, săn trùm.' },
    { key: 'lo-to', name: 'Lô Tô', cat: 'khac', arm: 'E', s: 1, w: 9, d: 8, h: 6.6, roof: 'gable', prop: 'balls', desc: 'Dò số trên tờ, kinh là thắng.' },
    { key: 'bai-mau', name: 'Bài Màu', cat: 'khac', arm: 'E', s: 1, w: 9, d: 8, h: 6.8, roof: 'tent', prop: 'cards', desc: 'Đánh theo màu hoặc số, hô UNO!' },
    { key: 'co-tuong', name: 'Cờ Tướng', cat: 'co', arm: 'W', s: 1, w: 10, d: 8, h: 7, roof: 'gable', prop: 'pawn', desc: 'Pháo đầu, mã nhảy, chiếu tướng!' },
    { key: 'co-ca-ngua', name: 'Cá Ngựa', cat: 'co', arm: 'W', s: 1, w: 9, d: 8, h: 6.6, roof: 'tent', prop: 'pawn', desc: 'Gieo xúc xắc, đua ngựa về đích.' },
    { key: 'co-caro', name: 'Cờ Caro', cat: 'co', arm: 'W', s: 1, w: 9, d: 8, h: 6.6, roof: 'flat', prop: 'ring', desc: '5 ô liền là thắng.' },
    { key: 'shop', name: 'Cửa Hàng', cat: 'sp', arm: 'W', s: -1, w: 11, d: 9, h: 7, roof: 'flat', prop: 'diamond', action: 'shop', desc: 'Mua xu, kim cương, khung avatar.' },
    { key: 'rank', name: 'Xếp Hạng', cat: 'sp', arm: 'W', s: -1, w: 8, d: 8, h: 8.5, roof: 'tower', prop: 'star', action: 'rank', desc: 'Bảng đại gia và cao thủ tuần này.' },
    { key: 'event', name: 'Sự Kiện', cat: 'sp', arm: 'W', s: -1, w: 10, d: 8, h: 6.6, roof: 'tent', prop: 'flag', action: 'event', desc: 'Lễ hội Heo Con: nhiệm vụ nhận quà.' },
    { key: 'daily', name: 'Quà Ngày', cat: 'sp', arm: 'S', s: 1, w: 9, d: 8, h: 6.6, roof: 'gable', prop: 'gift', action: 'daily', desc: 'Ghé mỗi ngày nhận xu miễn phí.' },
    { key: 'day-xu', name: 'Đẩy Xu', cat: 'khac', arm: 'S', s: 1, w: 11, d: 9, h: 7.2, roof: 'dome', prop: 'tower', hot: true, isNew: true, desc: 'Máy đẩy xu: canh khay đẩy, ngắm góc sát mép, hốt cuộn vé và Heo Vàng.' },
    { key: 'hall', name: 'Sảnh Game', cat: 'sp', arm: 'S', s: -1, w: 11, d: 9, h: 7.2, roof: 'dome', prop: 'star', action: 'hall', desc: 'Bản đồ menu của cả thị trấn: xem hết 18 game, chọn và vào chơi ngay.' },
  ];
  const ICON_TEX = k => 'icon_' + (CAT[k] ? k : k);

  const NPCS = [
    { key: 'adv_knight', name: 'Bơ Sáp', lv: 31 }, { key: 'adv_ranger', name: 'Kem Dâu', lv: 18 }, { key: 'adv_rogue', name: 'Mít Ướt', lv: 24 },
    { key: 'adv_barbarian', name: 'Bánh Bao', lv: 42 }, { key: 'adv_mage', name: 'Sữa Chua', lv: 15 }, { key: 'adv_rogue_hooded', name: 'Bin Bon', lv: 27 },
    { key: 'mini_dog', name: 'Cún Con', lv: 9 }, { key: 'mini_bear', name: 'Gấu Bông', lv: 12 }, { key: 'mini_duck', name: 'Vịt Bầu', lv: 7 },
  ];
  const NPC_LINES = ['Ai chơi Tiến Lên không? 🃏', 'Vừa chặt heo xong nè 🐷', 'Bầu Cua hôm nay đỏ ghê 🦀', 'Đi nhận quà ngày đi 🎁', 'Bắn cá vui lắm 🐟',
    'Cờ Tướng một ván không? ♟️', 'Trời đẹp quá ☀️', 'Hôm nay may mắn nè 🍀', 'Tới trắng rồi nè 😎', 'Xì Dách đủ 21! 🎉'];

  // ------------------------------------------------------------------ canvas textures (no external images, so file:// stays happy)
  function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function grassTex() {
    const [c, x] = cvs(256, 256);
    x.fillStyle = '#a6e28a'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 700; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(204,243,178,.55)' : 'rgba(150,214,128,.45)'; x.beginPath(); x.arc(rnd(0, 256), rnd(0, 256), rnd(1, 3.2), 0, 7); x.fill(); }
    for (let i = 0; i < 26; i++) { const px = rnd(4, 252), py = rnd(4, 252); x.fillStyle = pick(['#ffffff', '#ffd1e6', '#fff4a3', '#e7d8ff']); for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(px + Math.cos(k * 1.26) * 2.2, py + Math.sin(k * 1.26) * 2.2, 1.5, 0, 7); x.fill(); } x.fillStyle = '#ffc93c'; x.beginPath(); x.arc(px, py, 1.2, 0, 7); x.fill(); }
    return H.canvasTex(c, { repeat: [1, 1] });
  }
  function asphaltTex() {
    const [c, x] = cvs(256, 256);
    x.fillStyle = '#a7a3c8'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1600; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(190,186,220,.6)' : 'rgba(140,136,176,.45)'; x.fillRect(rnd(0, 256), rnd(0, 256), 2, 2); }
    return H.canvasTex(c, { repeat: [1, 1] });
  }
  function tileTex() {
    const [c, x] = cvs(256, 256), n = 4, s = 256 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      x.fillStyle = (i + j) % 2 ? '#fff0f6' : '#ffe2ee'; x.fillRect(i * s, j * s, s, s);
      x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(i * s + 6, j * s + 6, s - 12, 5);
    }
    x.strokeStyle = '#f3bfd4'; x.lineWidth = 5;
    for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, 256); x.stroke(); x.beginPath(); x.moveTo(0, i * s); x.lineTo(256, i * s); x.stroke(); }
    return H.canvasTex(c, { repeat: [1, 1] });
  }
  function plazaTex() {
    const [c, x] = cvs(1024, 1024), R = 512;
    x.fillStyle = '#ffe9f2'; x.fillRect(0, 0, 1024, 1024);
    const rings = ['#fff6fa', '#ffd9e9', '#fff6fa', '#ffe4ef', '#fff6fa', '#ffd2e5', '#fff6fa', '#ffe4ef'];
    for (let i = rings.length - 1; i >= 0; i--) { x.fillStyle = rings[i]; x.beginPath(); x.arc(R, R, R * (i + 1) / rings.length, 0, 7); x.fill(); }
    x.strokeStyle = '#f5c3d8'; x.lineWidth = 4;
    for (let i = 1; i <= rings.length; i++) { x.beginPath(); x.arc(R, R, R * i / rings.length, 0, 7); x.stroke(); }
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; x.beginPath(); x.moveTo(R + Math.cos(a) * R * .25, R + Math.sin(a) * R * .25); x.lineTo(R + Math.cos(a) * R, R + Math.sin(a) * R); x.stroke(); }
    // a candy star around the fountain
    x.fillStyle = '#ffc6dd'; x.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? R * .27 : R * .4; x.lineTo(R + Math.cos(a) * r, R + Math.sin(a) * r); }
    x.closePath(); x.fill();
    return H.canvasTex(c);
  }
  function awningTex(css) {
    const [c, x] = cvs(512, 256);
    const n = 8, sw = 512 / n;
    for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? '#ffffff' : css; x.fillRect(i * sw, 0, sw, 200); }
    for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? '#ffffff' : css; x.beginPath(); x.arc(i * sw + sw / 2, 196, sw / 2, 0, Math.PI); x.fill(); }
    x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 0, 512, 14);
    return H.canvasTex(c);
  }
  function dotTex() {
    const [c, x] = cvs(64, 64); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(220,245,255,.9)'); g.addColorStop(1, 'rgba(200,240,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return H.canvasTex(c);
  }
  function skyTex() {
    const [c, x] = cvs(8, 512), g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#5cb4ff'); g.addColorStop(.45, '#a6d8ff'); g.addColorStop(.8, '#ffd6ea'); g.addColorStop(1, '#ffe0ef');
    x.fillStyle = g; x.fillRect(0, 0, 8, 512); return H.canvasTex(c);
  }
  const imgCache = {};
  function texImg(key) {
    if (!imgCache[key]) imgCache[key] = new Promise(res => { const src = (window.HC_TEX || {})[key]; if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    return imgCache[key];
  }
  function rr(x, X, Y, W, Hh, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + Hh, R); x.arcTo(X + W, Y + Hh, X, Y + Hh, R); x.arcTo(X, Y + Hh, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
  async function signTex(b) {
    const cat = CAT[b.cat], [c, x] = cvs(1024, 256);
    rr(x, 10, 10, 1004, 236, 70); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#fff1f7'); x.fillStyle = g; x.fill();
    x.lineWidth = 18; x.strokeStyle = cat.css; x.stroke();
    const icon = await texImg('icon_' + b.key);
    if (icon) { x.save(); rr(x, 34, 30, 196, 196, 46); x.clip(); x.drawImage(icon, 34, 30, 196, 196); x.restore(); }
    let fs = 132; const txt = b.name.toUpperCase();
    do { x.font = `400 ${fs}px "Grandstander Black", "Baloo 2", sans-serif`; fs -= 4; } while (x.measureText(txt).width > 720 && fs > 40);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = 22; x.strokeStyle = '#ffffff'; x.strokeText(txt, 630, 136);
    x.fillStyle = '#' + cat.dark.toString(16).padStart(6, '0'); x.fillText(txt, 630, 136);
    return H.canvasTex(c);
  }
  async function gateTex() {
    const [c, x] = cvs(1024, 256);
    rr(x, 10, 10, 1004, 236, 90); const g = x.createLinearGradient(0, 0, 1024, 0);
    ['#ff8fc0', '#ffc36b', '#7fe0b2', '#7cc4ff', '#b79bff'].forEach((col, i) => g.addColorStop(i / 4, col)); x.fillStyle = g; x.fill();
    x.lineWidth = 16; x.strokeStyle = '#ffffff'; x.stroke();
    const pig = await texImg('icon_pig'); if (pig) { x.drawImage(pig, 40, 34, 188, 188); x.drawImage(pig, 796, 34, 188, 188); }
    x.font = '400 112px "Grandstander Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = 24; x.strokeStyle = '#c2407a'; x.strokeText('HEO CON CLUB', 512, 132); x.fillStyle = '#fff'; x.fillText('HEO CON CLUB', 512, 132);
    return H.canvasTex(c);
  }

  // ------------------------------------------------------------------ geometry helpers
  /** Outline (world X,Z) → extruded slab lying on the ground. */
  function slab(pointsXZ, depth, mats, holes) {
    const sh = new T.Shape(pointsXZ.map(p => new T.Vector2(p.x, -p.z)));
    if (holes) holes.forEach(hp => sh.holes.push(new T.Path(hp.map(p => new T.Vector2(p.x, -p.z)))));
    const g = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 48 });
    g.rotateX(-Math.PI / 2);
    const m = new T.Mesh(g, mats); m.receiveShadow = true; return m;
  }
  /** Quadrant land between two arms: everything with lateral > lim from both arms and radius > r0. */
  function quadrantOutline(a, b, lim, r0, far) {
    // local frame: u along arm a, v along arm b (b = a rotated +90°)
    const toW = (u, v) => ({ x: a.dir.x * u + b.dir.x * v, z: a.dir.z * u + b.dir.z * v });
    const c = Math.sqrt(r0 * r0 - lim * lim), pts = [];
    pts.push(toW(lim, c), toW(lim, far), toW(far, far), toW(far, lim), toW(c, lim));
    const a0 = Math.atan2(lim, c), a1 = Math.atan2(c, lim);
    for (let i = 1; i < 24; i++) { const t = a0 + (a1 - a0) * i / 24; pts.push(toW(r0 * Math.cos(t), r0 * Math.sin(t))); }
    return pts;
  }
  function pickBox(w, h, d) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial()); m.visible = false; return m; }

  // ------------------------------------------------------------------ the town
  class Town {
    constructor(canvas, opts = {}) {
      this.canvas = canvas; this.opts = opts;
      this.labelsEl = opts.labels || null;
      this.handlers = {};
      this.mode = 'intro';
      this.dyn = [];          // {obj, spin, bob, base}
      this.obst = [];         // colliders
      this.occupied = [];     // {x,z,r} for decoration placement
      this.instances = new Map();
      this.buildings = [];
      this.npcs = [];
      this.cars = [];
      this.birds = [];
      this.labels = [];
      this.camYaw = 0.5; this.camPitch = 0.76; this.camDist = 41; this.camTarget = new T.Vector3(0, 0, 10);
      this.keys = {};
      this.player = null;
      this.t = 0;
    }
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); }
    emit(ev, ...a) { (this.handlers[ev] || []).forEach(f => f(...a)); }

    /** Load models (progress 0..1) and build everything. */
    async init(progress = () => {}) {
      const st = this.st = new H.Stage(this.canvas, { width: this.opts.width || 1920, height: this.opts.height || 1080, fov: 34, shadows: true, pixelRatio: this.opts.pixelRatio || 1, exposure: 1.0 });
      const cam = st.camera; cam.far = 700; cam.near = 0.5; cam.updateProjectionMatrix();
      const sc = st.scene;
      sc.background = skyTex();
      sc.fog = new T.Fog(0xffe0ef, 170, 420);
      // lights: soft pastel sky + warm sun with shadows that follow the camera
      sc.children.filter(o => o.isLight).forEach(l => sc.remove(l));
      sc.add(new T.HemisphereLight(0xfff3fa, 0x98cf86, 0.9));
      const sun = this.sun = new T.DirectionalLight(0xfff0dc, 1.7);
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 260 });
      sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
      sc.add(sun); sc.add(sun.target);
      const fill = new T.DirectionalLight(0xffc6e6, 0.35); fill.position.set(-60, 40, -50); sc.add(fill);

      const keys = ['pp_tree', 'pp_tree_large', 'hh_tree', 'hh_tree_large', 'kf_tree_1a', 'kf_tree_2a', 'kf_tree_3a', 'kf_tree_4a', 'pp_bush', 'pp_bush_large', 'kf_bush_1a', 'kf_bush_2a', 'kf_bush_3a', 'kf_bush_4a',
        'pp_flower_a', 'pp_flower_b', 'pp_grass_a', 'pp_grass_b', 'pp_lantern', 'pp_bench', 'pp_trashcan', 'pp_hedge_long', 'pp_hedge', 'pp_fountain', 'pp_bird', 'hh_house', 'hh_mailbox', 'hh_fence_long', 'hh_foliage_a', 'hh_foliage_b',
        'hh_bench_a', 'hh_package', 'hp_monstera', 'hp_yucca', 'hp_cacti', 'hp_succulent', 'kf_rock_1a', 'tt_merry_go_round', 'tt_slide', 'tt_spring_horse', 'tt_sandcastle', 'tt_tire_pink', 'tt_stumps', 'tt_tree',
        'bgb_coin_gold', 'bgb_coin_silver', 'bgb_coin_10_gold', 'bgb_d6_red', 'bgb_d6_blue', 'bgb_d6_yellow', 'bgb_pawn_red', 'mini_star', 'mini_diamond_blue', 'mini_heart_red', 'mini_ball_red', 'mini_ring_blue', 'mini_flag_red',
        'anim_general', 'anim_move', ...new Set(NPCS.map(n => n.key))];
      let done = 0;
      const total = keys.length + 6;
      const step = () => progress(Math.min(1, ++done / total));
      for (let i = 0; i < keys.length; i += 6) await Promise.all(keys.slice(i, i + 6).map(k => H.load(k).then(step)));

      this.buildGround(); step();
      await this.buildPlaza(); step();
      for (const b of BUILDINGS) await this.buildShop(b);
      this.buildHouses(); step();
      this.buildStreetFurniture(); this.buildPlayground(); step();
      await this.buildGate(); this.scatter(); step();
      await this.buildInstances();
      this.buildCars(); this.buildClouds(); this.buildBirds(); this.buildFountainSpray();
      await this.buildNpcs(); step();
      this.makeLabels();
      this.bindInput();
      // start from the aerial intro pose so the first fly-in never begins next to the player
      st.camera.position.set(Math.cos(.6) * 92, 54, Math.sin(.6) * 92); this._look = new T.Vector3(0, 4, 0); st.camera.lookAt(this._look);
      st.onUpdate((dt, t) => this.update(dt, t));
      this.resizePixelRatio(this.opts.pixelRatio || 1);
      st.start();
      this.emit('ready');
    }
    resizePixelRatio(pr) { this.resize(this.st.w, this.st.h, pr); }
    /** Fit the renderer to the window (w×h CSS px). */
    resize(w, h, pr) {
      const st = this.st; st.w = w; st.h = h;
      if (pr) st.renderer.setPixelRatio(pr);
      st.renderer.setSize(w, h, false); st.camera.aspect = w / h; st.camera.updateProjectionMatrix();
    }

    // ---------------------------------------------------------------- static instanced decoration
    place(key, x, z, o = {}) {
      const id = key + (o.variant ? '#' + o.variant.name : '') + (o.forest ? '@f' : '');
      if (!this.instances.has(id)) this.instances.set(id, { key, variant: o.variant, forest: !!o.forest, list: [] });
      const m = new T.Matrix4().compose(new T.Vector3(x, o.y == null ? L.Y_GRASS : o.y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), o.rot || 0), new T.Vector3().setScalar(o.s || 1));
      if (o.sxyz) m.compose(new T.Vector3(x, o.y == null ? L.Y_GRASS : o.y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), o.rot || 0), new T.Vector3(...o.sxyz));
      this.instances.get(id).list.push(m);
      if (o.r) this.occupied.push({ x, z, r: o.r });
      if (o.solid) this.obst.push({ type: 'circle', x, z, r: o.solid });
    }
    free(x, z, r) {
      for (const o of this.occupied) if ((o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + r) ** 2) return false;
      return true;
    }
    async buildInstances() {
      for (const [, it] of this.instances) {
        const g = await H.load(it.key);
        let src = g.scene.clone(true);
        if (it.variant) H.recolor(src, it.variant);
        src.updateMatrixWorld(true);
        src.traverse(o => {
          if (!o.isMesh) return;
          const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld);
          const im = new T.InstancedMesh(geo, o.material, it.list.length);
          it.list.forEach((m, i) => im.setMatrixAt(i, m));
          im.castShadow = !it.forest && it.key !== 'pp_flower_a' && it.key !== 'pp_flower_b' && !it.key.includes('grass'); im.receiveShadow = !it.forest; im.frustumCulled = false;
          this.st.add(im);
        });
      }
    }

    // ---------------------------------------------------------------- ground, roads, blocks
    buildGround() {
      const sc = this.st.scene;
      const gt = grassTex(); gt.repeat.set(110, 110);
      const ground = new T.Mesh(new T.PlaneGeometry(700, 700), new T.MeshStandardMaterial({ map: gt, roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
      // roads
      const at = asphaltTex();
      const roadMat = new T.MeshStandardMaterial({ map: at, roughness: .95 });
      for (const a of ARM_LIST) {
        const len = L.FAR - 18, t = at.clone(); t.needsUpdate = true; t.repeat.set(len / 8, 1);
        const m = new T.Mesh(new T.PlaneGeometry(len, L.ROAD), new T.MeshStandardMaterial({ map: t, roughness: .95 }));
        m.geometry.rotateX(-Math.PI / 2); m.rotation.y = -a.ang * DEG; m.position.copy(armPt(a, 18 + len / 2, 0, 0.03)); m.receiveShadow = true; sc.add(m);
      }
      const ringT = at.clone(); ringT.needsUpdate = true; ringT.repeat.set(5, 5);
      const ring = new T.Mesh(new T.RingGeometry(L.PLAZA - .2, L.RING + .3, 120), new T.MeshStandardMaterial({ map: ringT, roughness: .95 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.035; ring.receiveShadow = true; sc.add(ring);
      // road paint (one instanced mesh)
      const marks = [];
      const mark = (x, z, len, wid, rot) => marks.push(new T.Matrix4().compose(new T.Vector3(x, 0.05, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), rot), new T.Vector3(len, 1, wid)));
      for (const a of ARM_LIST) {
        const rot = -a.ang * DEG;
        for (let d = 29; d < L.FAR; d += 4.4) { const p = armPt(a, d, 0); mark(p.x, p.z, 2.2, .26, rot); }
        for (const l of [-3.55, 3.55]) { const p = armPt(a, (27 + L.FAR) / 2, l); mark(p.x, p.z, L.FAR - 27, .16, rot); }
        for (let l = -3.1; l <= 3.15; l += 1.24) { const p = armPt(a, 24.2, l); mark(p.x, p.z, 3.2, .62, rot); }   // zebra at the arm mouth
      }
      for (let i = 0; i < 360; i += 7) { if (i % 45 < 4 || i % 45 > 41) continue; const a = i * DEG; mark(Math.cos(a) * 17, Math.sin(a) * 17, 1.6, .24, -a - Math.PI / 2); }
      for (let k = 0; k < 4; k++) { const a = (45 + 90 * k) * DEG; for (let r = 14.6; r < 20; r += 1.24) mark(Math.cos(a) * r, Math.sin(a) * r, 3.0, .6, -a - Math.PI / 2); }
      const mg = new T.PlaneGeometry(1, 1); mg.rotateX(-Math.PI / 2);
      const mm = new T.InstancedMesh(mg, new T.MeshStandardMaterial({ color: 0xffffff, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 }), marks.length);
      marks.forEach((m, i) => mm.setMatrixAt(i, m)); mm.receiveShadow = true; mm.frustumCulled = false; sc.add(mm);
      // blocks: raised sidewalk slab + grass inset
      const tt = tileTex(); tt.repeat.set(1 / 3, 1 / 3);
      const sideMat = [new T.MeshStandardMaterial({ map: tt, roughness: .85 }), H.mat(0xffffff, { roughness: .6 })];
      const gt2 = grassTex(); gt2.repeat.set(1 / 6, 1 / 6);
      const lawnMat = [new T.MeshStandardMaterial({ map: gt2, roughness: 1 }), H.mat(0x9fd98a)];
      for (let i = 0; i < 4; i++) {
        const a = ARM_LIST[i], b = ARM_LIST[(i + 1) % 4];
        sc.add(slab(quadrantOutline(a, b, L.ROAD / 2, L.RING, L.EDGE), L.Y_SIDE, sideMat));
        sc.add(slab(quadrantOutline(a, b, L.ROAD / 2 + 3.6, L.RING_SW, L.EDGE - 3), L.Y_GRASS, lawnMat));
      }
      // plaza disc
      const pt = plazaTex(); pt.repeat.set(1 / (2 * L.PLAZA), 1 / (2 * L.PLAZA)); pt.offset.set(.5, .5);
      const circle = []; for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; circle.push({ x: Math.cos(a) * L.PLAZA, z: Math.sin(a) * L.PLAZA }); }
      sc.add(slab(circle, L.Y_SIDE, [new T.MeshStandardMaterial({ map: pt, roughness: .8 }), H.mat(0xffffff)]));
    }

    async buildPlaza() {
      const f = H.clone(await H.load('pp_fountain'));
      f.scale.setScalar(2.3); f.position.y = L.Y_SIDE; f.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.st.add(f);
      this.obst.push({ type: 'circle', x: 0, z: 0, r: 4.9 }); this.occupied.push({ x: 0, z: 0, r: 5.5 });
      const sakura = { name: 'sakura', hue: 335, sat: 1.15, light: .12 };
      for (let k = 0; k < 4; k++) {
        const base = (90 * k) * DEG;
        this.place('pp_tree_large', Math.cos(base) * 12, Math.sin(base) * 12, { y: L.Y_SIDE, s: 1.05, rot: sr(0, 6), variant: sakura, solid: .7 });
        for (const off of [-18, 18]) {
          const a = base + off * DEG;
          this.place('pp_hedge_long', Math.cos(a) * 11.4, Math.sin(a) * 11.4, { y: L.Y_SIDE, rot: -a - Math.PI / 2, s: .9 });
          for (let j = 0; j < 3; j++) { const aa = a + sr(-.12, .12); this.place(spick(['pp_flower_a', 'pp_flower_b']), Math.cos(aa) * 10.2, Math.sin(aa) * 10.2, { y: L.Y_SIDE, rot: sr(0, 6), s: 1.6 }); }
        }
        const ba = base + 32 * DEG * (k % 2 ? 1 : -1);
        this.place('pp_bench', Math.cos(ba) * 9.4, Math.sin(ba) * 9.4, { y: L.Y_SIDE, rot: Math.atan2(-Math.cos(ba), -Math.sin(ba)), s: 1.1 });
        const la = (45 + 90 * k) * DEG;
        for (const s of [-1, 1]) { const aa = la + s * 9 * DEG; this.place('pp_lantern', Math.cos(aa) * 12.8, Math.sin(aa) * 12.8, { y: L.Y_SIDE, s: .78 }); }
      }
    }

    // ---------------------------------------------------------------- shops
    lotCursor(arm, s) { const k = arm + s; this._cur = this._cur || {}; if (this._cur[k] == null) this._cur[k] = arm === 'S' ? 33 : 31; return k; }
    async buildShop(b) {
      const arm = ARMS[b.arm], k = this.lotCursor(b.arm, b.s);
      const along = this._cur[k] + b.w / 2; this._cur[k] += b.w + 4.6;
      const lateral = b.s * (L.LOT + b.d / 2);
      const c = armPt(arm, along, lateral);
      const front = { x: -arm.lat.x * b.s, z: -arm.lat.z * b.s };
      const rot = Math.atan2(front.x, front.z);
      const cat = CAT[b.cat], idx = BUILDINGS.indexOf(b);
      const colored = idx % 2 === 0;
      const g = new T.Group(); g.position.set(c.x, L.Y_GRASS, c.z); g.rotation.y = rot;
      const wallMat = H.mat(colored ? cat.wall : cat.cream, { roughness: .8 });
      const trimMat = H.mat(cat.accent, { roughness: .6 });
      const roofMat = H.mat(colored ? 0xffffff : cat.roof, { roughness: .55 });
      const whiteMat = H.mat(0xffffff, { roughness: .5 });
      const glassMat = H.mat(0xbfe9ff, { roughness: .15, metalness: .1, emissiveHex: 0x9fd8ff, emissiveIntensity: .25 });
      const darkMat = H.mat(cat.dark, { roughness: .6 });
      const add = (geo, mat, x, y, z, ry = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
      const { w, d, h } = b, y0 = L.Y0 - L.Y_GRASS;
      add(H.roundedBox(w + 1, .5, d + 1, .2), whiteMat, 0, .25, 0);
      const walls = add(H.roundedBox(w, h, d, .4, 3), wallMat, 0, y0 + h / 2, 0);
      add(H.roundedBox(w + .15, .55, d + .15, .25), trimMat, 0, y0 + .28, 0);
      add(H.roundedBox(w + .2, .35, d + .2, .16), trimMat, 0, y0 + h - .1, 0);
      const fz = d / 2, flowers = [];
      // door
      const frame = new T.ExtrudeGeometry(H.roundRectShape(2.9, 3.6, .2, true), { depth: .14, bevelEnabled: false, curveSegments: 20 });
      add(frame, whiteMat, 0, y0, fz - .02);
      const door = new T.ExtrudeGeometry(H.roundRectShape(2.3, 3.2, .2, true), { depth: .14, bevelEnabled: false, curveSegments: 20 });
      add(door, darkMat, 0, y0 + .05, fz + .06);
      add(new T.SphereGeometry(.13, 12, 8), H.mat(0xffd34d, { metalness: .5, roughness: .3 }), .7, y0 + 1.5, fz + .24);
      add(H.roundedBox(3.4, .22, 1.3, .1), whiteMat, 0, .58, fz + .7);
      // windows
      const wins = w >= 12 ? [-w / 2 + 2, -3.4, 3.4, w / 2 - 2] : [-w / 2 + 2.05, w / 2 - 2.05];
      for (const wx of wins) {
        add(H.roundedBox(2.1, 2, .2, .2), whiteMat, wx, y0 + 2.05, fz + .02);
        add(H.roundedBox(1.7, 1.6, .2, .18), glassMat, wx, y0 + 2.05, fz + .08);
        add(new T.BoxGeometry(.12, 1.6, .06), whiteMat, wx, y0 + 2.05, fz + .2);
        add(new T.BoxGeometry(1.7, .12, .06), whiteMat, wx, y0 + 2.05, fz + .2);
        add(H.roundedBox(2.2, .3, .5, .1), H.mat(0xc98d5c), wx, y0 + .95, fz + .3);
        for (let j = -1; j <= 1; j++) flowers.push([wx + j * .6, y0 + 1.1, fz + .32]);
      }
      // awning
      const aw = new T.Mesh(new T.PlaneGeometry(w * .92, 1.9), new T.MeshStandardMaterial({ map: awningTex(cat.css), transparent: true, alphaTest: .5, side: T.DoubleSide, roughness: .8 }));
      aw.position.set(0, y0 + 3.95, fz + .78); aw.rotation.x = -.95; aw.castShadow = true; g.add(aw);
      add(new T.CylinderGeometry(.12, .12, w * .94, 10).rotateZ(Math.PI / 2), trimMat, 0, y0 + 4.48, fz + .12);
      // sign
      const sw = Math.min(w * .84, 9.6), sh = sw / 4, sy = Math.max(y0 + 4.55 + sh / 2 + .15, y0 + h - sh / 2 - .35);
      add(H.roundedBox(sw + .35, sh + .35, .3, .15), trimMat, 0, sy, fz + .12);
      const sign = new T.Mesh(new T.PlaneGeometry(sw, sh), new T.MeshStandardMaterial({ map: await signTex(b), roughness: .6, emissive: 0xffffff, emissiveIntensity: .05, transparent: true }));
      sign.position.set(0, sy, fz + .29); g.add(sign);
      // roof
      let top = y0 + h;
      if (b.roof === 'gable') {
        const sh2 = new T.Shape([new T.Vector2(-w / 2 - .6, 0), new T.Vector2(w / 2 + .6, 0), new T.Vector2(0, 2.8)]);
        const rg = new T.ExtrudeGeometry(sh2, { depth: d + .9, bevelEnabled: true, bevelThickness: .15, bevelSize: .15, bevelSegments: 3 }); rg.translate(0, 0, -(d + .9) / 2);
        add(rg, colored ? H.mat(cat.roof, { roughness: .5 }) : roofMat, 0, top + .1, 0);
        add(new T.CylinderGeometry(.22, .22, d + 1.2, 12).rotateX(Math.PI / 2), whiteMat, 0, top + 3, 0);
        add(H.roundedBox(1, 1.8, 1, .15), whiteMat, w / 2 - 1.8, top + 1.6, -d / 4);
        top += 3.1;
      } else if (b.roof === 'flat') {
        add(H.roundedBox(w + .7, .6, d + .7, .25), colored ? H.mat(cat.roof) : roofMat, 0, top + .3, 0);
        add(H.roundedBox(w * .45, .9, d * .45, .3), whiteMat, -w * .18, top + 1, -d * .12);
        top += .7;
      } else if (b.roof === 'dome') {
        const r = Math.min(w, d) * .37;
        add(new T.CylinderGeometry(r + .25, r + .45, .8, 40), trimMat, 0, top + .4, 0);
        add(new T.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), colored ? H.mat(cat.roof, { roughness: .4 }) : roofMat, 0, top + .8, 0);
        add(new T.SphereGeometry(.5, 20, 12), H.mat(0xffd34d, { metalness: .4, roughness: .3 }), 0, top + .8 + r + .3, 0);
        top += .8 + r + .6;
      } else if (b.roof === 'tent') {
        const cone = new T.ConeGeometry(Math.max(w, d) * .66, 3.2, 4, 1); cone.rotateY(Math.PI / 4); cone.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
        add(cone, colored ? H.mat(cat.roof, { roughness: .5 }) : roofMat, 0, top + 1.6, 0);
        add(new T.CylinderGeometry(.08, .08, 1.6, 8), whiteMat, 0, top + 3.8, 0);
        top += 3.4;
      } else if (b.roof === 'tower') {
        add(H.roundedBox(w * .6, 3.6, d * .6, .35), wallMat, 0, top + 1.8, 0);
        add(new T.CylinderGeometry(.9, .9, .25, 24).rotateX(Math.PI / 2), H.mat(0xfff7c7, { emissiveHex: 0xffe68a, emissiveIntensity: .4 }), 0, top + 2.2, d * .3 + .05);
        const cone = new T.ConeGeometry(w * .48, 3, 4, 1); cone.rotateY(Math.PI / 4);
        add(cone, H.mat(cat.roof, { roughness: .5 }), 0, top + 5.1, 0);
        top += 6.6;
      }
      this.st.add(g);
      g.updateMatrixWorld(true);
      // rooftop showpiece
      await this.roofProp(b, g, top);
      // potted plants by the door + sidewalk lamps
      const wp = (lx, lz) => new T.Vector3(lx, 0, lz).applyMatrix4(g.matrixWorld);
      for (const [fx, fy, fzz] of flowers) { const q = new T.Vector3(fx, fy, fzz).applyMatrix4(g.matrixWorld); this.place(spick(['pp_flower_a', 'pp_flower_b']), q.x, q.z, { y: q.y, s: 1.3, rot: srnd() * 6 }); }
      const pl = wp(-1.9, fz + 1.2), pr = wp(1.9, fz + 1.2);
      this.place(spick(['hp_monstera', 'hp_yucca']), pl.x, pl.z, { s: .55, rot: sr(0, 6) });
      this.place(spick(['hp_cacti', 'hp_succulent', 'hp_yucca']), pr.x, pr.z, { s: .55, rot: sr(0, 6) });
      const doorPt = wp(0, fz + 3.2); doorPt.y = 0;
      const info = Object.assign({}, b, { group: g, center: new T.Vector3(c.x, 0, c.z), door: doorPt, along, rot, top: L.Y_GRASS + top, walls, wallMat, base: wallMat.emissive.clone() });
      const pk = pickBox(w + 1, top + 2, d + 1); pk.position.set(0, (top + 2) / 2, 0); pk.userData.building = info; g.add(pk); info.pick = pk;
      this.buildings.push(info);
      this.obst.push({ type: 'obb', x: c.x, z: c.z, hw: w / 2 + .6, hd: d / 2 + .6, rot });
      this.occupied.push({ x: c.x, z: c.z, r: Math.max(w, d) / 2 + 2.2 });
    }
    async roofProp(b, g, top) {
      const holder = new T.Group(); holder.position.set(0, top + .2, 0); g.add(holder);
      const addM = async (key, s, x = 0, y = 0, z = 0, flat) => { const o = H.clone(await H.load(key)); o.scale.setScalar(s); o.position.set(x, y, z); if (flat) o.rotation.x = Math.PI / 2; o.traverse(m => { if (m.isMesh) m.castShadow = true; }); holder.add(o); return o; };
      const card = async (key, x, rz) => {
        const cg = new T.Group(); const im = await texImg(key), bk = await texImg('card_back');
        const mk = (img) => { const t = new T.Texture(img); t.encoding = T.sRGBEncoding; t.needsUpdate = true; t.anisotropy = 4; return new T.MeshStandardMaterial({ map: t, transparent: true, alphaTest: .4, roughness: .6 }); };
        const front = new T.Mesh(new T.PlaneGeometry(2.1, 3), mk(im)); front.castShadow = true; cg.add(front);
        const back = new T.Mesh(new T.PlaneGeometry(2.1, 3), mk(bk)); back.rotation.y = Math.PI; cg.add(back);
        cg.position.set(x, 1.6, 0); cg.rotation.z = rz; holder.add(cg);
      };
      let spin = 0, bob = .25;
      switch (b.prop) {
        case 'cards': await card('card_sK', -1.2, .28); await card('card_hQ', 0, 0); await card('card_hA', 1.2, -.28); holder.children.forEach((c, i) => { c.position.z = i * .05; c.position.y += i === 1 ? .25 : 0; }); spin = .35; break;
        case 'chips': for (let i = 0; i < 4; i++) await addM(i % 2 ? 'bgb_coin_silver' : 'bgb_coin_10_gold', 3.2, 0, .3 + i * .32, 0); spin = .8; break;
        case 'tower': for (let i = 0; i < 7; i++) (await addM(i % 3 === 2 ? 'bgb_coin_silver' : 'bgb_coin_gold', 2.6, Math.sin(i * 1.7) * .12, .25 + i * .5, Math.cos(i * 1.7) * .12)).rotation.z = Math.sin(i) * .12; await addM('mini_star', 1.6, 0, 4.2, 0); spin = .7; break;
        case 'dice': (await addM('bgb_d6_red', 3.2, 0, 1.3, 0)).rotation.set(.5, .6, .2); spin = .9; break;
        case 'dice3': for (const [k, x] of [['bgb_d6_red', -1.5], ['bgb_d6_blue', 0], ['bgb_d6_yellow', 1.5]]) (await addM(k, 2.2, x, 1, 0)).rotation.set(sr(0, 3), sr(0, 3), 0); spin = .7; break;
        case 'coins': (await addM('bgb_coin_gold', 4, -.9, 1.6, 0, true)); (await addM('bgb_coin_silver', 4, .9, 1.6, 0, true)); spin = 1.1; break;
        case 'fish': {
          for (const [k, x, y] of [['fish_a', -1.4, 1.6], ['fish_b', 1.3, 2.4], ['fish_c', 0, 3.1]]) { const im = await texImg(k); const t = new T.Texture(im); t.encoding = T.sRGBEncoding; t.needsUpdate = true; const s = new T.Sprite(new T.SpriteMaterial({ map: t })); s.scale.set(2.4, 2.4, 1); s.position.set(x, y, 0); holder.add(s); }
          await addM('mini_ring_blue', 2.2, 0, .6, 0); bob = .45; break;
        }
        case 'balls': for (const [x, y] of [[-1.2, .9], [1.2, .9], [0, 2.2]]) await addM('mini_ball_red', 1.6, x, y, 0); spin = .6; break;
        case 'pawn': await addM('bgb_pawn_red', 4.6, 0, 0, 0); spin = .6; break;
        case 'ring': await addM('mini_ring_blue', 3, 0, 1.2, 0); spin = 1.2; break;
        case 'diamond': await addM('mini_diamond_blue', 3.4, 0, 1, 0); spin = 1.3; break;
        case 'star': await addM('mini_star', 3.2, 0, 1, 0); spin = 1.4; break;
        case 'flag': await addM('mini_flag_red', 3, 0, 0, 0); spin = .3; bob = .1; break;
        case 'gift': await addM('hh_package', 2.4, 0, .2, 0); await addM('mini_heart_red', 1.6, 0, 2.6, 0); spin = .7; break;
      }
      this.dyn.push({ obj: holder, spin, bob, y0: holder.position.y, ph: srnd() * 6 });
      if (b.hot) for (let i = 0; i < 5; i++) {
        const c = H.clone(await H.load('bgb_coin_gold')); c.scale.setScalar(1.5); c.rotation.x = Math.PI / 2;
        const orb = new T.Group(); orb.add(c); c.position.set(Math.max(b.w, b.d) * .38, 0, 0); orb.rotation.y = i / 5 * Math.PI * 2; orb.position.y = top + 1.2;
        g.add(orb); this.dyn.push({ obj: orb, spin: .9, bob: .3, y0: orb.position.y, ph: i, coin: c });
      }
    }

    // ---------------------------------------------------------------- houses, furniture, playground, gate, trees
    buildHouses() {
      const fill = (arm, s, until) => {
        const k = this.lotCursor(arm, s);
        while (this._cur[k] + 8 < until) {
          const a = ARMS[arm], along = this._cur[k] + 4.2, lateral = s * (L.LOT + 4.4);
          const c = armPt(a, along, lateral), front = { x: -a.lat.x * s, z: -a.lat.z * s }, rot = Math.atan2(front.x, front.z);
          this.place('hh_house', c.x, c.z, { rot, s: 1.18 });
          this.obst.push({ type: 'obb', x: c.x, z: c.z, hw: 3.8, hd: 4.1, rot }); this.occupied.push({ x: c.x, z: c.z, r: 5.6 });
          const mp = armPt(a, along + 3, s * (L.LOT - .2)), fence = armPt(a, along - 2.6, s * (L.LOT - .7));
          this.place('hh_fence_long', fence.x, fence.z, { rot: Math.atan2(-a.dir.z, a.dir.x), s: .9 });
          this.place('hh_mailbox', mp.x, mp.z, { rot, s: .9 });
          for (let j = 0; j < 3; j++) { const p = armPt(a, along + sr(-3.5, 3.5), s * (L.LOT + 9.5 + sr(0, 2))); this.place(spick(['hh_foliage_a', 'hh_foliage_b', 'pp_bush']), p.x, p.z, { s: sr(1, 1.5), rot: sr(0, 6) }); }
          this._cur[k] += 9.2;
        }
      };
      fill('S', 1, 92); fill('S', -1, 92);
      fill('N', 1, 92); fill('N', -1, 92); fill('E', 1, 92); fill('E', -1, 92); fill('W', 1, 92); fill('W', -1, 92);
    }
    buildStreetFurniture() {
      const variants = [null, { name: 'sakura', hue: 335, sat: 1.15, light: .12 }, { name: 'lilac', hue: 280, sat: .9, light: .1 }, { name: 'lemon', hue: 52, sat: 1.1, light: .06 }];
      for (const a of ARM_LIST) for (const s of [-1, 1]) {
        let i = 0;
        for (let d = 28; d < 94; d += 7.5, i++) {
          const nearDoor = this.buildings.some(b => b.arm === a.id && b.s === s && Math.abs(b.along - d) < 2.6);
          const p = armPt(a, d, s * 6.6);
          if (!nearDoor && i % 2 === 0) this.place(spick(['pp_tree', 'pp_tree_large', 'pp_tree']), p.x, p.z, { y: L.Y_SIDE, s: sr(.85, 1.05), rot: sr(0, 6), variant: spick(variants), solid: .5 });
          else if (!nearDoor) { this.place(spick(['pp_bush', 'kf_bush_3a']), p.x, p.z, { y: L.Y_SIDE, s: sr(1.1, 1.6), rot: sr(0, 6) }); }
          if (i % 2 === 1) { const lp = armPt(a, d, s * 4.5); this.place('pp_lantern', lp.x, lp.z, { y: L.Y_SIDE, s: .8, solid: .25 }); }
          if (i % 4 === 2 && !nearDoor) { const bp = armPt(a, d + 3.3, s * 6.4); this.place('pp_bench', bp.x, bp.z, { y: L.Y_SIDE, rot: Math.atan2(-a.lat.x * s, -a.lat.z * s), s: 1 }); }
          if (i % 6 === 3) { const tp = armPt(a, d + 1.8, s * 4.7); this.place('pp_trashcan', tp.x, tp.z, { y: L.Y_SIDE, s: .55 }); }
        }
      }
      // ring sidewalk trees between the arms
      for (let deg = 0; deg < 360; deg += 15) {
        const off = deg % 90; if (off < 28 || off > 62) continue;
        const a = deg * DEG; this.place(deg % 30 ? 'pp_lantern' : 'pp_tree', Math.cos(a) * 22.3, Math.sin(a) * 22.3, { y: L.Y_SIDE, s: deg % 30 ? .8 : 1, variant: deg % 30 ? null : variants[(deg / 30) % 4 | 0], solid: .4 });
      }
    }
    buildPlayground() {
      const S = ARMS.S, base = armPt(S, 70, -31);
      const items = [['tt_merry_go_round', 0, 0, 1.6], ['tt_slide', 6, -4, 1.6], ['tt_spring_horse', -4, 4, 1.8], ['tt_sandcastle', 5, 5, 1.6], ['tt_tire_pink', -5, -4, 1.7], ['tt_stumps', 1, 7, 1.6]];
      for (const [k, x, z, s] of items) {
        H.load(k).then(g => { const o = H.clone(g); o.scale.setScalar(s); o.position.set(base.x + x, L.Y_GRASS, base.z + z); o.rotation.y = srnd() * 6; o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); this.st.add(o); });
        this.occupied.push({ x: base.x + x, z: base.z + z, r: 3 });
      }
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; this.place('hh_fence_long', base.x + Math.cos(a) * 11, base.z + Math.sin(a) * 11, { rot: -a + Math.PI / 2, s: 1.1 }); }
      this.occupied.push({ x: base.x, z: base.z, r: 12 });
    }
    async buildGate() {
      const S = ARMS.S, p = armPt(S, 98, 0), g = new T.Group(); g.position.copy(p);
      const pink = H.mat(0xff8fc0), white = H.mat(0xffffff);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) { const m = new T.Mesh(H.roundedBox(1.6, 2.2, 1.6, .3), i % 2 ? white : pink); m.position.set(s * 6.5, 1.1 + i * 2.2, 0); m.castShadow = true; g.add(m); }
        const ball = new T.Mesh(new T.SphereGeometry(1.1, 24, 16), H.mat(0xffd34d, { roughness: .3, metalness: .3 })); ball.position.set(s * 6.5, 9.9, 0); ball.castShadow = true; g.add(ball);
      }
      const board = new T.Mesh(new T.PlaneGeometry(13.6, 3.4), new T.MeshStandardMaterial({ map: await gateTex(), transparent: true, side: T.DoubleSide, roughness: .6 }));
      board.position.set(0, 8.3, .2); g.add(board);
      const back = new T.Mesh(H.roundedBox(14, 3.6, .4, .3), white); back.position.set(0, 8.3, -.1); back.castShadow = true; g.add(back);
      g.rotation.y = Math.PI; // face the town
      this.st.add(g);
      this.balloons(armPt(S, 96, 8.5)); this.balloons(armPt(S, 96, -8.5));
      this.balloons(this.buildings.find(b => b.key === 'event').door.clone().add(new T.Vector3(2, 0, 0)));
      this.obst.push({ type: 'circle', x: p.x - 6.5, z: p.z, r: 1.2 }, { type: 'circle', x: p.x + 6.5, z: p.z, r: 1.2 });
    }
    balloons(at) {
      const cols = [0xff6fa8, 0xffc93c, 0x5fd9ac, 0x6fbfff, 0xb18cff];
      for (let i = 0; i < 5; i++) {
        const g = new T.Group(); g.position.set(at.x + sr(-1, 1), 0, at.z + sr(-1, 1));
        const b = new T.Mesh(new T.SphereGeometry(.7, 20, 14), H.mat(cols[i], { roughness: .25, metalness: .05 })); b.scale.y = 1.18; b.position.y = 5 + sr(0, 2); b.castShadow = true; g.add(b);
        const str = new T.Mesh(new T.CylinderGeometry(.02, .02, b.position.y, 4), H.mat(0xffffff)); str.position.y = b.position.y / 2; g.add(str);
        this.st.add(g); this.dyn.push({ obj: g, sway: true, ph: srnd() * 6 });
      }
    }
    scatter() {
      const treeKinds = ['pp_tree', 'pp_tree_large', 'hh_tree', 'hh_tree_large', 'kf_tree_1a', 'kf_tree_2a', 'kf_tree_3a', 'kf_tree_4a', 'tt_tree'];
      const variants = [null, null, { name: 'sakura', hue: 335, sat: 1.15, light: .12 }, { name: 'lilac', hue: 280, sat: .9, light: .1 }, { name: 'lemon', hue: 52, sat: 1.1, light: .06 }, { name: 'peach', hue: 22, sat: 1.1, light: .05 }];
      const onRoad = (x, z, pad) => ARM_LIST.some(a => { const al = x * a.dir.x + z * a.dir.z, lt = x * a.lat.x + z * a.lat.z; return al > 0 && Math.abs(lt) < L.ROAD / 2 + pad; }) || Math.hypot(x, z) < L.RING_SW + pad;
      // inside the blocks (behind the shops)
      let n = 0, tries = 0;
      while (n < 260 && tries++ < 6000) {
        const x = sr(-L.EDGE + 4, L.EDGE - 4), z = sr(-L.EDGE + 4, L.EDGE - 4);
        if (onRoad(x, z, 6) || !this.free(x, z, 2.2)) continue;
        const r = srnd();
        if (r < .55) { const k = spick(treeKinds); this.place(k, x, z, { s: sr(.9, 1.4), rot: sr(0, 6), variant: k.startsWith('pp') ? spick(variants) : null, r: 2.4, solid: .6 }); }
        else if (r < .8) this.place(spick(['pp_bush', 'pp_bush_large', 'kf_bush_1a', 'kf_bush_2a', 'kf_bush_4a', 'hh_foliage_a']), x, z, { s: sr(1.2, 2.2), rot: sr(0, 6), r: 1.2 });
        else if (r < .92) for (let j = 0; j < 4; j++) this.place(spick(['pp_flower_a', 'pp_flower_b', 'pp_grass_a', 'pp_grass_b']), x + sr(-1.5, 1.5), z + sr(-1.5, 1.5), { s: sr(1.4, 2.2), rot: sr(0, 6), r: .6 });
        else this.place('kf_rock_1a', x, z, { s: sr(1.2, 2.4), rot: sr(0, 6), r: 1.4 });
        n++;
      }
      // the forest ring outside the town
      tries = 0; n = 0;
      while (n < 420 && tries++ < 8000) {
        const x = sr(-175, 175), z = sr(-175, 175), m = Math.max(Math.abs(x), Math.abs(z));
        if (m < L.EDGE + 3 || onRoad(x, z, 3)) continue;
        const k = spick(treeKinds); this.place(k, x, z, { y: 0, s: sr(1.1, 2), rot: sr(0, 6), variant: k.startsWith('pp') ? spick(variants) : null, forest: true });
        n++;
      }
      // soft hills on the horizon
      const hillMat = H.mat(0xa6dd8e, { roughness: 1 });
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + sr(-.1, .1), r = sr(190, 240); const h = new T.Mesh(new T.SphereGeometry(sr(30, 55), 24, 12), hillMat); h.scale.y = sr(.25, .45); h.position.set(Math.cos(a) * r, -2, Math.sin(a) * r); this.st.add(h); }
    }

    // ---------------------------------------------------------------- living things
    makeCar(color) {
      const g = new T.Group(), body = H.mat(color, { roughness: .35, metalness: .05 }), white = H.mat(0xffffff, { roughness: .4 });
      const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
      add(H.roundedBox(2.6, .85, 1.4, .32), body, 0, .72, 0);
      add(H.roundedBox(1.5, .78, 1.26, .3), white, -.2, 1.42, 0);
      add(H.roundedBox(1.56, .42, 1.3, .18), H.mat(0x8fd6ff, { roughness: .1, emissiveHex: 0x7fcfff, emissiveIntensity: .2 }), -.2, 1.45, 0);
      for (const [x, z] of [[.85, .62], [-.85, .62], [.85, -.62], [-.85, -.62]]) {
        const w = add(new T.CylinderGeometry(.36, .36, .28, 18), H.mat(0x5a4a6a), x, .38, z); w.rotation.x = Math.PI / 2;
        const hub = add(new T.CylinderGeometry(.16, .16, .3, 12), white, x, .38, z); hub.rotation.x = Math.PI / 2;
      }
      for (const z of [-.42, .42]) { add(new T.SphereGeometry(.14, 10, 8), H.mat(0xfff3a0, { emissiveHex: 0xffe680, emissiveIntensity: .8 }), 1.3, .82, z); add(new T.SphereGeometry(.11, 10, 8), H.mat(0xff7b9c, { emissiveHex: 0xff5c85, emissiveIntensity: .6 }), -1.3, .82, z); }
      add(H.roundedBox(.5, .14, 1.1, .06), white, -.2, 1.87, 0);
      return g;
    }
    carRoute() {
      const ia = Math.floor(Math.random() * 4), turn = 1 + Math.floor(Math.random() * 3), ib = (ia + 4 - turn) % 4;
      const A = ARM_LIST[ia], B = ARM_LIST[ib];
      const start = armPt(A, L.FAR, -2, .05), entry = armPt(A, 22.5, -2, .05), exit = armPt(B, 22.5, 2, .05), end = armPt(B, L.FAR, 2, .05);
      let t0 = Math.atan2(entry.z, entry.x), t1 = Math.atan2(exit.z, exit.x);
      while (t1 >= t0 - .2) t1 -= Math.PI * 2;
      const pts = [start, armPt(A, 60, -2, .05), entry];
      const R = 18.3, n = Math.ceil((t0 - t1) / (10 * DEG));
      for (let i = 1; i < n; i++) { const t = t0 + (t1 - t0) * i / n; pts.push(new T.Vector3(Math.cos(t) * R, .05, Math.sin(t) * R)); }
      pts.push(exit, armPt(B, 60, 2, .05), end);
      return new T.CatmullRomCurve3(pts, false, 'centripetal', .5);
    }
    buildCars() {
      const cols = [0xff8fc0, 0x6fd9b0, 0xffd25a, 0x7cc4ff, 0xb39bff, 0xff9e7a, 0xffffff];
      for (let i = 0; i < 9; i++) {
        const mesh = this.makeCar(cols[i % cols.length]); this.st.add(mesh);
        const car = { mesh, curve: this.carRoute(), u: Math.random() * .8, v: 0, vmax: rnd(7, 9.5), honk: 0 };
        car.len = car.curve.getLength(); this.cars.push(car);
      }
    }
    buildClouds() {
      const mat = H.mat(0xffffff, { roughness: 1, emissiveHex: 0xffffff, emissiveIntensity: .25 });
      for (let i = 0; i < 12; i++) {
        const g = new T.Group();
        for (let j = 0; j < 5; j++) { const s = new T.Mesh(new T.SphereGeometry(sr(2.4, 4.2), 16, 12), mat); s.position.set(j * 2.6 - 5, sr(-.5, 1.2), sr(-1.5, 1.5)); s.castShadow = true; g.add(s); }
        g.position.set(sr(-170, 170), sr(42, 58), sr(-140, 140)); g.scale.y = .65;
        this.st.add(g); this.dyn.push({ obj: g, cloud: true, v: sr(1.5, 3) });
      }
    }
    async buildBirds() {
      const g = await H.load('pp_bird');
      for (let i = 0; i < 8; i++) {
        const o = H.clone(g); o.scale.setScalar(.75); o.traverse(m => { if (m.isMesh) m.castShadow = true; });
        this.st.add(o);
        const bird = { o, state: 'peck', t: 0, vel: new T.Vector3() };
        this.landBird(bird, true); this.birds.push(bird);
      }
    }
    landBird(bd, instant) {
      const a = rnd(0, Math.PI * 2), r = rnd(6, 12.5);
      bd.home = new T.Vector3(Math.cos(a) * r, L.Y_SIDE, Math.sin(a) * r);
      bd.o.position.copy(bd.home); if (!instant) bd.o.position.y = 30;
      bd.state = instant ? 'peck' : 'land'; bd.t = 0; bd.o.rotation.y = rnd(0, 6);
    }
    buildFountainSpray() {
      const n = 160, pos = new Float32Array(n * 3); this.spray = { n, pos, vel: new Float32Array(n * 3), life: new Float32Array(n) };
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ size: .5, map: dotTex(), transparent: true, depthWrite: false, opacity: .9, color: 0xdff6ff }));
      pts.frustumCulled = false; this.st.add(pts); this.spray.geo = geo;
      for (let i = 0; i < n; i++) this.spray.life[i] = -rnd(0, 1.4);
    }
    async buildNpcs() {
      const graph = this.graph = this.walkGraph();
      for (const n of NPCS) {
        const ch = await H.character(this.st, n.key, { anim: 'Idle_A', scale: n.key.startsWith('mini') ? 1.75 : 1.12 });
        ch.root.traverse(m => { if (m.isMesh) m.castShadow = true; });
        const node = Math.floor(Math.random() * graph.nodes.length);
        ch.root.position.copy(graph.nodes[node]);
        const pk = new T.Mesh(new T.CylinderGeometry(.9, .9, 3, 8), new T.MeshBasicMaterial()); pk.visible = false; pk.position.y = 1.5; ch.root.add(pk);
        const npc = Object.assign({}, n, { ch, node, prev: -1, target: null, wait: rnd(0, 3), say: rnd(4, 14), walking: false, pick: pk });
        pk.userData.npc = npc;
        this.npcs.push(npc);
      }
    }
    /** Sidewalk waypoints for walkers. */
    walkGraph() {
      const nodes = [], edges = [];
      const add = p => { nodes.push(p); edges.push([]); return nodes.length - 1; };
      const link = (a, b) => { edges[a].push(b); edges[b].push(a); };
      const y = L.Y_SIDE;
      const armSide = {};
      for (const a of ARM_LIST) for (const s of [-1, 1]) {
        let prev = -1; const ids = [];
        for (let d = 26; d <= 90; d += 8) { const i = add(armPt(a, d, s * 5.6, y)); ids.push(i); if (prev >= 0) link(prev, i); prev = i; }
        armSide[a.id + s] = ids;
      }
      const ringIdx = {};
      for (let q = 0; q < 4; q++) {
        const base = q * 90; let prev = -1;
        for (let deg = base + 25; deg <= base + 65; deg += 10) { const a = deg * DEG, i = add(new T.Vector3(Math.cos(a) * 22.2, y, Math.sin(a) * 22.2)); ringIdx[deg] = i; if (prev >= 0) link(prev, i); prev = i; }
        // quadrant q lies between arm q (side +1) and arm q+1 (side -1)
        link(ringIdx[base + 25], armSide[ARM_LIST[q].id + 1][0]);
        link(ringIdx[base + 65], armSide[ARM_LIST[(q + 1) % 4].id + -1][0]);
      }
      const plaza = [];
      for (let k = 0; k < 8; k++) { const a = (22.5 + 45 * k) * DEG; plaza.push(add(new T.Vector3(Math.cos(a) * 7.6, y, Math.sin(a) * 7.6))); }
      for (let k = 0; k < 8; k++) link(plaza[k], plaza[(k + 1) % 8]);
      for (let q = 0; q < 4; q++) { const deg = 45 + 90 * q, a = deg * DEG; const mid = add(new T.Vector3(Math.cos(a) * 11.6, y, Math.sin(a) * 11.6)); link(mid, plaza[(2 * q + 0) % 8]); link(mid, plaza[(2 * q + 1) % 8]); link(mid, ringIdx[deg]); }
      return { nodes, edges };
    }

    // ---------------------------------------------------------------- player
    async setPlayer(key, name) {
      const old = this.player;
      const ch = await H.character(this.st, key, { anim: 'Idle_A', scale: key.startsWith('mini') ? 1.75 : 1.12 });
      ch.root.traverse(m => { if (m.isMesh) m.castShadow = true; });
      const pos = old ? old.ch.root.position.clone() : new T.Vector3(0, L.Y_SIDE, 6.6);
      if (old) old.ch.dispose();
      ch.root.position.copy(pos); ch.root.rotation.y = Math.PI;
      this.player = { ch, key, name, target: null, onArrive: null, moving: false, heading: Math.PI };
      if (this.playerLabel) this.playerLabel.querySelector('b').textContent = name;
      if (!this.marker) {
        this.marker = new T.Mesh(new T.TorusGeometry(.8, .1, 8, 32), H.mat(0xff6fa8, { emissiveHex: 0xff6fa8, emissiveIntensity: .6 }));
        this.marker.rotation.x = Math.PI / 2; this.marker.visible = false; this.st.add(this.marker);
      }
      ch.root.visible = this.mode === 'play';
      return this.player;
    }
    walkTo(x, z, onArrive, near = .35) {
      const p = this.player; if (!p) return;
      p.target = new T.Vector3(x, 0, z); p.onArrive = onArrive || null; p.near = near;
      if (!onArrive) { this.marker.position.set(x, L.Y_SIDE + .06, z); this.marker.visible = true; this.marker.userData.t = 0; }
    }
    goToBuilding(key, teleport, silent) {
      const b = this.buildings.find(x => x.key === key); if (!b || !this.player) return;
      if (teleport) {
        const r = this.player.ch.root; r.position.set(b.door.x, L.Y_SIDE, b.door.z);
        r.rotation.y = Math.atan2(b.center.x - b.door.x, b.center.z - b.door.z); this.player.heading = r.rotation.y;
        this.camTarget.copy(r.position); this.player.target = null; this.puff(r.position);
        if (!silent) setTimeout(() => this.emit('enter', b), 380);
        return;
      }
      this.walkTo(b.door.x, b.door.z, () => this.emit('enter', b), 1.1);
    }
    emote(anim = 'cheer') { const p = this.player; if (!p) return; p.ch.play(p.key.startsWith('adv') ? pick(['Jump_Full_Short', 'Interact']) : anim, { once: true, then: 'Idle_A' }); p.emoteT = 1.6; }
    puff(at) {
      for (let i = 0; i < 14; i++) {
        const s = new T.Mesh(new T.SphereGeometry(rnd(.25, .5), 10, 8), H.mat(pick([0xffffff, 0xffd6ea, 0xfff4b8]), { emissiveHex: 0xffffff, emissiveIntensity: .3, transparent: true }));
        s.position.copy(at).add(new T.Vector3(0, 1, 0)); this.st.add(s);
        const v = new T.Vector3(rnd(-1, 1), rnd(.6, 1.8), rnd(-1, 1)).multiplyScalar(3);
        this.dyn.push({ obj: s, puff: true, v, life: 0 });
      }
    }

    // ---------------------------------------------------------------- input
    bindInput() {
      const cv = this.canvas, ray = new T.Raycaster(), ndc = new T.Vector2();
      let down = null, drag = false, pinch = null;
      const pts = new Map();
      const setNdc = e => { const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
      const hit = e => {
        setNdc(e); ray.setFromCamera(ndc, this.st.camera);
        const picks = [...this.buildings.map(b => b.pick), ...this.npcs.map(n => n.pick)];
        const h = ray.intersectObjects(picks, false)[0];
        if (h) return h.object.userData;
        const p = new T.Vector3(); if (ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -L.Y_SIDE), p)) return { ground: p };
        return null;
      };
      cv.addEventListener('pointerdown', e => {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.camDist }; }
        down = { x: e.clientX, y: e.clientY, yaw: this.camYaw, pitch: this.camPitch, btn: e.button }; drag = false;
        cv.setPointerCapture(e.pointerId);
      });
      cv.addEventListener('pointermove', e => {
        if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; this.camDist = clamp(pinch.dist * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 18, 85); drag = true; return; }
        if (down) {
          const dx = e.clientX - down.x, dy = e.clientY - down.y;
          if (!drag && Math.hypot(dx, dy) > 8) drag = true;
          if (drag && this.mode === 'play') { this.camYaw = down.yaw - dx * .006; this.camPitch = clamp(down.pitch + dy * .004, .45, 1.25); }
          return;
        }
        if (this.mode !== 'play' || e.pointerType === 'touch') return;
        const now = performance.now(); if (now - (this._hov || 0) < 60) return; this._hov = now;
        const h = hit(e); this.hover(h && (h.building || h.npc) || null); cv.style.cursor = h && (h.building || h.npc) ? 'pointer' : 'default';
      });
      const up = e => {
        pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
        if (!down) return;
        const wasDrag = drag; down = null; drag = false;
        if (wasDrag || this.mode !== 'play') return;
        const h = hit(e); if (!h) return;
        if (h.building) { this.emit('tap-building', h.building); this.goToBuilding(h.building.key); }
        else if (h.npc) { const n = h.npc; this.walkTo(n.ch.root.position.x, n.ch.root.position.z, () => this.emit('npc', n), 2.2); }
        else if (h.ground) { const g = h.ground; if (Math.hypot(g.x, g.z) < 160) { this.walkTo(g.x, g.z); this.emit('walk'); } }
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); down = null; pinch = null; });
      cv.addEventListener('wheel', e => { e.preventDefault(); this.camDist = clamp(this.camDist * (1 + Math.sign(e.deltaY) * .08), 18, 85); }, { passive: false });
      addEventListener('keydown', e => { if (/input|textarea/i.test(document.activeElement && document.activeElement.tagName)) return; this.keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'q') this.camYaw += .15; if (e.key.toLowerCase() === 'e') this.camYaw -= .15; });
      addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
      addEventListener('blur', () => { this.keys = {}; });
    }
    hover(obj) {
      if (this._hovB && this._hovB !== obj) { this._hovB.wallMat && this._hovB.wallMat.emissive.copy(this._hovB.base); this._hovB = null; }
      if (obj && obj.wallMat) { this._hovB = obj; }
      this.labels.forEach(l => l.el.classList.toggle('hov', !!obj && l.ref === obj));
    }

    // ---------------------------------------------------------------- labels (HTML over the canvas)
    makeLabels() {
      const box = this.labelsEl; if (!box) return;
      const A = window.HC ? HC.A : (p => 'assets/' + p);
      const icon = b => b.action ? { shop: 'emoji-fluent-3d/game/shopping_bags.png', rank: 'emoji-fluent-3d/game/trophy.png', event: 'emoji-fluent-3d/game/party_popper.png', daily: 'emoji-fluent-3d/game/wrapped_gift.png', hall: 'emoji-fluent-3d/game/joystick.png' }[b.action] : `games/lobby-icons/${b.key}.png`;
      for (const b of this.buildings) {
        const el = document.createElement('div'); el.className = 'blabel c-' + b.cat;
        b.online = b.action ? 0 : Math.floor(rnd(300, 9800));
        el.innerHTML = `<img src="${A(icon(b))}"><div><b>${b.name}</b>${b.online ? `<span>● ${b.online.toLocaleString('vi-VN')} đang chơi</span>` : `<span>${CAT[b.cat].name}</span>`}</div>${b.hot ? '<i class="hot">HOT</i>' : ''}${b.action === 'daily' ? '<i class="bang">!</i>' : ''}`;
        el.onclick = () => { if (this.mode === 'play') this.goToBuilding(b.key); };
        box.appendChild(el); b.label = el;
        this.labels.push({ el, ref: b, pos: () => new T.Vector3(b.center.x, b.top + 2.6, b.center.z), far: 78 });
      }
      for (const n of this.npcs) {
        const el = document.createElement('div'); el.className = 'nlabel'; el.innerHTML = `<b>${n.name}</b><span>Lv ${n.lv}</span>`;
        box.appendChild(el); n.label = el;
        const bub = document.createElement('div'); bub.className = 'bubble'; box.appendChild(bub); n.bubble = bub;
        this.labels.push({ el, ref: n, pos: () => n.ch.root.position.clone().add(new T.Vector3(0, n.key.startsWith('mini') ? 3.3 : 3.6, 0)), far: 42 });
        this.labels.push({ el: bub, ref: n, bubble: true, pos: () => n.ch.root.position.clone().add(new T.Vector3(0, n.key.startsWith('mini') ? 4.5 : 4.9, 0)), far: 60 });
      }
      const pl = this.playerLabel = document.createElement('div'); pl.className = 'nlabel me'; pl.innerHTML = `<b>${this.player ? this.player.name : ''}</b>`; box.appendChild(pl);
      const pb = this.playerBubble = document.createElement('div'); pb.className = 'bubble me'; box.appendChild(pb);
      this.labels.push({ el: pl, player: true, pos: () => this.player ? this.player.ch.root.position.clone().add(new T.Vector3(0, this.player.key.startsWith('mini') ? 3.3 : 3.6, 0)) : null, far: 90 });
      this.labels.push({ el: pb, player: true, bubble: true, pos: () => this.player ? this.player.ch.root.position.clone().add(new T.Vector3(0, this.player.key.startsWith('mini') ? 4.5 : 4.9, 0)) : null, far: 90 });
    }
    say(n, text, ms = 3200) {
      const el = n === 'me' ? this.playerBubble : n.bubble; if (!el) return;
      el.textContent = text; el.classList.add('on'); clearTimeout(el._h); el._h = setTimeout(() => el.classList.remove('on'), ms);
    }
    updateLabels() {
      if (!this.labelsEl) return;
      const cam = this.st.camera, v = new T.Vector3(), W = this.st.w, Hh = this.st.h, show = this.mode === 'play', u = this.uiScale || 1;
      this.labelsEl.style.display = show ? '' : 'none'; if (!show) return;
      const rows = [];
      for (const l of this.labels) {
        const p = l.pos(); if (!p) { l.el.style.display = 'none'; continue; }
        const dist = p.distanceTo(cam.position);
        v.copy(p).project(cam);
        const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && dist < l.far && (!l.bubble || l.el.classList.contains('on'));
        if (!vis) { l.el.style.display = 'none'; continue; }
        rows.push({ l, dist, x: (v.x + 1) / 2 * W / u, y: (1 - v.y) / 2 * Hh / u });
      }
      rows.sort((a, b) => a.dist - b.dist);
      const boxes = [];
      for (const r of rows) {
        const l = r.l, k = clamp(52 / r.dist, .55, 1.12);
        if (l.ref && l.ref.label === l.el) { // shop label: skip if it would sit on top of a nearer one
          const w = (l.el._w || (l.el._w = l.el.offsetWidth || 300)) * k, h = 92 * k, bx = r.x - w / 2, by = r.y - h;
          if (boxes.some(b => bx < b.x + b.w && bx + w > b.x && by < b.y + b.h && by + h > b.y)) { l.el.style.display = 'none'; continue; }
          boxes.push({ x: bx - 8, y: by - 6, w: w + 16, h: h + 12 });
          l.el.style.opacity = String(clamp((l.far - r.dist) / 18, 0, 1));
        }
        l.el.style.display = '';
        l.el.style.transform = `translate(${r.x.toFixed(1)}px,${r.y.toFixed(1)}px) translate(-50%,-100%) scale(${k.toFixed(3)})`;
        l.el.style.zIndex = String(1000 - Math.round(r.dist));
      }
    }

    // ---------------------------------------------------------------- minimap
    drawMinimap(ctx, S) {
      const sc = S / 2 / 100, cx = S / 2, cy = S / 2;
      const P = (x, z) => [cx + x * sc, cy + z * sc];
      ctx.clearRect(0, 0, S, S);
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, S / 2 - 2, 0, 7); ctx.clip();
      ctx.fillStyle = '#b9e8a2'; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#ffe4ef';
      for (let i = 0; i < 4; i++) { const pts = quadrantOutline(ARM_LIST[i], ARM_LIST[(i + 1) % 4], 4, L.RING, L.EDGE); ctx.beginPath(); pts.forEach((p, j) => ctx[j ? 'lineTo' : 'moveTo'](...P(p.x, p.z))); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#c9f0b4';
      for (let i = 0; i < 4; i++) { const pts = quadrantOutline(ARM_LIST[i], ARM_LIST[(i + 1) % 4], 7.6, L.RING_SW, L.EDGE - 3); ctx.beginPath(); pts.forEach((p, j) => ctx[j ? 'lineTo' : 'moveTo'](...P(p.x, p.z))); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = '#a7a3c8'; ctx.lineWidth = L.ROAD * sc;
      for (const a of ARM_LIST) { ctx.beginPath(); ctx.moveTo(...P(a.dir.x * 18, a.dir.z * 18)); ctx.lineTo(...P(a.dir.x * 120, a.dir.z * 120)); ctx.stroke(); }
      ctx.lineWidth = (L.RING - L.PLAZA) * sc; ctx.beginPath(); ctx.arc(cx, cy, (L.RING + L.PLAZA) / 2 * sc, 0, 7); ctx.stroke();
      ctx.fillStyle = '#ffd2e5'; ctx.beginPath(); ctx.arc(cx, cy, L.PLAZA * sc, 0, 7); ctx.fill();
      ctx.fillStyle = '#8fd8ff'; ctx.beginPath(); ctx.arc(cx, cy, 4.5 * sc, 0, 7); ctx.fill();
      for (const b of this.buildings) {
        ctx.save(); ctx.translate(...P(b.center.x, b.center.z)); ctx.rotate(-b.rot);
        ctx.fillStyle = CAT[b.cat].css; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        const w = b.w * sc, d = b.d * sc; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -d / 2, w, d, 3) : ctx.rect(-w / 2, -d / 2, w, d); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = '#ffffff'; for (const n of this.npcs) { const [x, y] = P(n.ch.root.position.x, n.ch.root.position.z); ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#5f5a80'; for (const c of this.cars) { const [x, y] = P(c.mesh.position.x, c.mesh.position.z); ctx.fillRect(x - 2, y - 2, 4, 4); }
      if (this.player) {
        const p = this.player.ch.root.position, [x, y] = P(p.x, p.z);
        // view cone
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(x, y);
        const ya = -this.camYaw - Math.PI / 2; ctx.arc(x, y, 34, ya - .55, ya + .55); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.translate(x, y); ctx.rotate(-this.player.heading + Math.PI);
        ctx.fillStyle = '#ff4f95'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
      ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, S / 2 - 3, 0, 7); ctx.stroke();
    }
    /** Switch to a tilted orthographic bird's-eye view of the whole town; returns shop pins in 0..1 image coords. */
    renderMap(w, h, pitchDeg = 58) {
      this.mode = 'map';
      this.dyn.forEach(d => { if (d.cloud) d.obj.visible = false; });
      const hw = 106, hh = hw * h / w, cam = new T.OrthographicCamera(-hw, hw, hh, -hh, 1, 900);
      const p = pitchDeg * DEG; cam.position.set(0, Math.sin(p) * 400, Math.cos(p) * 400 + 1); cam.lookAt(0, 0, 1);
      this.st.camera = cam; this.st.w = w; this.st.h = h; this.st.renderer.setSize(w, h, false);
      this.st.scene.fog = null;
      Object.assign(this.sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, far: 400 }); this.sun.shadow.camera.updateProjectionMatrix(); this.sun.shadow.mapSize.set(4096, 4096);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      this.sun.position.set(60, 120, 50); this.sun.target.position.set(0, 0, 0); this.sun.target.updateMatrixWorld();
      if (this.labelsEl) this.labelsEl.style.display = 'none';
      if (this.player) this.player.ch.root.visible = false;
      cam.updateMatrixWorld(true);
      const proj = v => { const q = v.clone().project(cam); return { u: +((q.x + 1) / 2).toFixed(4), v: +((1 - q.y) / 2).toFixed(4) }; };
      return { pins: this.buildings.map(b => Object.assign({ key: b.key, name: b.name, cat: b.cat, action: b.action || null, hot: !!b.hot, isNew: !!b.isNew, desc: b.desc }, proj(new T.Vector3(b.center.x, b.top, b.center.z)))), plaza: proj(new T.Vector3(0, 0, 0)), w, h };
    }
    minimapToWorld(mx, my, S) { const sc = S / 2 / 100; return { x: (mx - S / 2) / sc, z: (my - S / 2) / sc }; }

    // ---------------------------------------------------------------- modes & camera
    setMode(m) {
      const from = this.mode; this.mode = m;
      if (this.player) this.player.ch.root.visible = m === 'play';
      if (m === 'play' && from !== 'play') {
        this.fly = { t: 0, dur: this.opts.instant ? 0.01 : 2.4, pos: this.st.camera.position.clone(), look: this._look ? this._look.clone() : new T.Vector3() };
        if (this.player) { this.camTarget.copy(this.player.ch.root.position); this.player.ch.play(this.player.key.startsWith('adv') ? 'Spawn_Ground' : 'cheer', { once: true, then: 'Idle_A' }); }
      }
    }
    followPose() {
      const t = this.camTarget, d = this.camDist, p = this.camPitch, y = this.camYaw;
      const pos = new T.Vector3(t.x + Math.sin(y) * Math.cos(p) * d, t.y + Math.sin(p) * d + 1, t.z + Math.cos(y) * Math.cos(p) * d);
      return { pos, look: new T.Vector3(t.x, t.y + 1.6, t.z) };
    }
    collide(p, r) {
      for (const o of this.obst) {
        if (o.type === 'circle') {
          const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + r;
          if (d < m && d > 1e-4) { p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; }
        } else {
          const c = Math.cos(o.rot), s = Math.sin(o.rot), dx = p.x - o.x, dz = p.z - o.z;
          let lx = dx * c - dz * s, lz = dx * s + dz * c;
          const qx = clamp(lx, -o.hw, o.hw), qz = clamp(lz, -o.hd, o.hd);
          if (Math.abs(lx) <= o.hw && Math.abs(lz) <= o.hd) { // inside: push out through the nearest face
            const px = o.hw - Math.abs(lx), pz = o.hd - Math.abs(lz);
            if (px < pz) lx = Math.sign(lx || 1) * (o.hw + r); else lz = Math.sign(lz || 1) * (o.hd + r);
          } else {
            const ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
            if (d < r) { lx = qx + ex / d * r; lz = qz + ez / d * r; } else continue;
          }
          p.x = o.x + lx * c + lz * s; p.z = o.z - lx * s + lz * c;
        }
      }
      const R = Math.hypot(p.x, p.z); if (R > 150) { p.x *= 150 / R; p.z *= 150 / R; }
    }

    // ---------------------------------------------------------------- per-frame
    update(dt, t) {
      // gameplay follows real time even when frames are slow (the renderer clamps dt to 0.05)
      const now = performance.now(); dt = Math.min(.12, (now - (this._last || now)) / 1000) || dt; this._last = now;
      this.t = t;
      const cam = this.st.camera;
      // player
      const pl = this.player;
      if (pl && this.mode === 'play') {
        const r = pl.ch.root, k = this.keys;
        let mx = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0), mz = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
        let vx = 0, vz = 0;
        if (mx || mz) {
          const c = Math.cos(this.camYaw), s = Math.sin(this.camYaw), l = Math.hypot(mx, mz);
          vx = (mx * c + mz * s) / l; vz = (-mx * s + mz * c) / l; pl.target = null; pl.onArrive = null; this.marker.visible = false;
        } else if (pl.target) {
          const dx = pl.target.x - r.position.x, dz = pl.target.z - r.position.z, d = Math.hypot(dx, dz);
          if (d < (pl.near || .35)) { pl.target = null; this.marker.visible = false; const f = pl.onArrive; pl.onArrive = null; if (f) f(); }
          else { vx = dx / d; vz = dz / d; }
        }
        const moving = !!(vx || vz), speed = 7.2;
        if (moving) {
          const before = r.position.clone();
          r.position.x += vx * speed * dt; r.position.z += vz * speed * dt;
          this.collide(r.position, .55);
          if (pl.target && r.position.distanceTo(before) < speed * dt * .15) { pl.stuck = (pl.stuck || 0) + dt; if (pl.stuck > .5) { pl.stuck = 0; const f = pl.onArrive; pl.target = null; pl.onArrive = null; this.marker.visible = false; if (f) f(); } } else pl.stuck = 0;
          const want = Math.atan2(vx, vz); let dh = want - pl.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); pl.heading += dh * Math.min(1, dt * 12); r.rotation.y = pl.heading;
          const onWalk = Math.hypot(r.position.x, r.position.z) < L.PLAZA || this.onSidewalk(r.position.x, r.position.z);
          r.position.y = lerp(r.position.y, onWalk ? L.Y_SIDE : .03, .3);
        }
        if (moving !== pl.moving) { pl.moving = moving; pl.ch.play(moving ? (pl.key.startsWith('adv') ? 'Running_A' : 'Walk') : 'Idle_A', { fade: .15 }); }
        this.camTarget.lerp(new T.Vector3(r.position.x, 0, r.position.z), Math.min(1, dt * 5));
        if (this.marker.visible) { this.marker.userData.t += dt; const s = 1 + Math.sin(this.marker.userData.t * 8) * .15; this.marker.scale.setScalar(s); }
        // shops light up when you walk by
        for (const b of this.buildings) {
          const near = Math.hypot(b.door.x - r.position.x, b.door.z - r.position.z) < 3.2;
          if (b.wallMat) b.wallMat.emissive.setRGB(...(near || this._hovB === b ? [.16 + Math.sin(t * 6) * .05, .1, .14] : [b.base.r, b.base.g, b.base.b]));
          if (near && !b._near && !pl.target) this.emit('near', b);
          b._near = near;
        }
      }
      // camera
      if (this.mode === 'map') { /* camera is set by renderMap() */ }
      else if (this.mode === 'intro') {
        const a = t * .045 + .6;
        cam.position.set(Math.cos(a) * 92, 54, Math.sin(a) * 92); this._look = new T.Vector3(0, 4, 0); cam.lookAt(this._look);
      } else {
        const f = this.followPose();
        if (this.fly && this.fly.t < this.fly.dur) {
          this.fly.t += dt; const k = ease(Math.min(1, this.fly.t / this.fly.dur));
          cam.position.lerpVectors(this.fly.pos, f.pos, k); this._look = this.fly.look.clone().lerp(f.look, k); cam.lookAt(this._look);
        } else { cam.position.copy(f.pos); this._look = f.look; cam.lookAt(f.look); }
      }
      // sun + shadow box follow what the camera looks at
      const look = this.mode === 'map' ? new T.Vector3() : this._look || new T.Vector3();
      this.sun.position.set(look.x + 45, 85, look.z + 30); this.sun.target.position.set(look.x, 0, look.z); this.sun.target.updateMatrixWorld();
      // spinning rooftop props, balloons, clouds, puffs
      for (let i = this.dyn.length - 1; i >= 0; i--) {
        const d = this.dyn[i], o = d.obj;
        if (d.cloud) { o.position.x += d.v * dt; if (o.position.x > 190) o.position.x = -190; continue; }
        if (d.sway) { o.rotation.z = Math.sin(t * 1.3 + d.ph) * .06; o.rotation.x = Math.cos(t * 1.1 + d.ph) * .05; continue; }
        if (d.puff) { d.life += dt; d.v.y -= dt * 4; o.position.addScaledVector(d.v, dt); o.scale.setScalar(Math.max(.01, 1 - d.life * 1.2)); if (d.life > .85) { this.st.remove(o); this.dyn.splice(i, 1); } continue; }
        if (d.spin) o.rotation.y += d.spin * dt;
        if (d.bob) o.position.y = d.y0 + Math.sin(t * 2 + d.ph) * d.bob;
        if (d.coin) d.coin.rotation.z += dt * 3;
      }
      this.updateCars(dt);
      this.updateNpcs(dt, t);
      this.updateBirds(dt, t);
      this.updateSpray(dt);
      this.updateLabels();
      if (this.onFrame) this.onFrame(dt, t);
    }
    onSidewalk(x, z) {
      const r = Math.hypot(x, z); if (r < L.RING) return false;
      for (const a of ARM_LIST) { const al = x * a.dir.x + z * a.dir.z, lt = x * a.lat.x + z * a.lat.z; if (al > 0 && Math.abs(lt) < L.ROAD / 2) return false; }
      return Math.max(Math.abs(x), Math.abs(z)) < L.EDGE;
    }
    updateCars(dt) {
      const pp = this.player && this.mode === 'play' ? this.player.ch.root.position : null;
      for (const c of this.cars) {
        const pos = c.mesh.position, head = c.curve.getTangentAt(Math.min(.999, c.u));
        let blocked = false;
        for (const o of this.cars) { if (o === c) continue; const dx = o.mesh.position.x - pos.x, dz = o.mesh.position.z - pos.z, d = Math.hypot(dx, dz); if (d < 5.5 && (dx * head.x + dz * head.z) > d * .55) { blocked = true; break; } }
        if (pp) { const dx = pp.x - pos.x, dz = pp.z - pos.z, d = Math.hypot(dx, dz); if (d < 4.2 && (dx * head.x + dz * head.z) > d * .4) { blocked = true; if ((c.honk -= dt) < 0) { c.honk = 4; if (window.HC) HC.sfx('honk', .25); } } }
        c.v = lerp(c.v, blocked ? 0 : c.vmax, Math.min(1, dt * (blocked ? 6 : 1.5)));
        c.u += c.v * dt / c.len;
        if (c.u >= 1) { c.curve = this.carRoute(); c.len = c.curve.getLength(); c.u = 0; }
        const p = c.curve.getPointAt(Math.min(1, c.u)), tg = c.curve.getTangentAt(Math.min(.999, c.u));
        pos.copy(p); c.mesh.rotation.y = Math.atan2(-tg.z, tg.x);
        c.mesh.position.y = .03 + Math.abs(Math.sin(this.t * 14 + c.vmax)) * .03 * (c.v / c.vmax);
      }
    }
    updateNpcs(dt, t) {
      const G = this.graph; if (!G) return;
      const pp = this.player && this.mode === 'play' ? this.player.ch.root.position : null;
      for (const n of this.npcs) {
        const r = n.ch.root;
        if (pp && r.position.distanceTo(pp) < 1.7) { // stop and look at the player
          if (n.walking) { n.walking = false; n.ch.play('Idle_A', { fade: .2 }); }
          r.rotation.y = lerp(r.rotation.y, Math.atan2(pp.x - r.position.x, pp.z - r.position.z), .1); continue;
        }
        if (n.wait > 0) { n.wait -= dt; if (n.wait <= 0) n.target = null; }
        else {
          if (n.target == null) { const opts = G.edges[n.node].filter(i => i !== n.prev); n.target = pick(opts.length ? opts : G.edges[n.node]); if (!n.walking) { n.walking = true; n.ch.play(n.key.startsWith('adv') ? 'Walking_A' : 'Walk', { fade: .2 }); } }
          const tp = G.nodes[n.target], dx = tp.x - r.position.x, dz = tp.z - r.position.z, d = Math.hypot(dx, dz);
          const sp = n.key.startsWith('mini') ? 1.9 : 1.75;
          if (d < .1) { n.prev = n.node; n.node = n.target; n.target = null; if (Math.random() < .35) { n.wait = rnd(1.5, 5); n.walking = false; n.ch.play(Math.random() < .3 && n.key.startsWith('adv') ? pick(['Interact', 'Idle_B']) : 'Idle_A', { fade: .2 }); } }
          else { r.position.x += dx / d * Math.min(d, sp * dt); r.position.z += dz / d * Math.min(d, sp * dt); let dh = Math.atan2(dx, dz) - r.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); r.rotation.y += dh * Math.min(1, dt * 8); }
        }
        if ((n.say -= dt) < 0) { n.say = rnd(9, 20); if (this.mode === 'play' && pp && r.position.distanceTo(pp) < 40) this.say(n, pick(NPC_LINES)); }
      }
    }
    updateBirds(dt, t) {
      const pp = this.player && this.mode === 'play' ? this.player.ch.root.position : null;
      for (const b of this.birds) {
        const o = b.o; b.t += dt;
        if (b.state === 'peck') {
          o.position.y = b.home.y + Math.max(0, Math.sin(b.t * 7)) * .12 * (Math.sin(b.t * .9) > .3 ? 1 : 0);
          o.rotation.x = Math.sin(b.t * 9) > .6 ? .35 : 0;
          if (Math.random() < dt * .2) o.rotation.y += rnd(-1, 1);
          if (pp && o.position.distanceTo(pp) < 3.4) { b.state = 'fly'; b.t = 0; const a = Math.atan2(o.position.z - pp.z, o.position.x - pp.x); b.vel.set(Math.cos(a) * 6, 7, Math.sin(a) * 6); o.rotation.y = Math.atan2(b.vel.x, b.vel.z); o.rotation.x = -.3; if (window.HC) HC.sfx('pop', .2); }
        } else if (b.state === 'fly') {
          o.position.addScaledVector(b.vel, dt); b.vel.y += dt * 1.5; o.rotation.z = Math.sin(t * 30) * .4;
          if (b.t > 6) this.landBird(b);
        } else if (b.state === 'land') {
          o.position.y = lerp(o.position.y, b.home.y, Math.min(1, dt * 2)); o.rotation.z = Math.sin(t * 30) * .3;
          if (o.position.y - b.home.y < .05) { b.state = 'peck'; o.rotation.z = 0; o.rotation.x = 0; }
        }
      }
    }
    updateSpray(dt) {
      const s = this.spray; if (!s) return;
      const top = 3.95;
      for (let i = 0; i < s.n; i++) {
        s.life[i] += dt; const j = i * 3;
        if (s.life[i] < 0) { s.pos[j + 1] = -50; continue; }
        if (s.pos[j + 1] < 1.1 || s.life[i] > 2) {
          const a = Math.random() * Math.PI * 2, sp = rnd(.8, 1.6);
          s.pos[j] = 0; s.pos[j + 1] = top; s.pos[j + 2] = 0; s.vel[j] = Math.cos(a) * sp; s.vel[j + 1] = rnd(3, 4.6); s.vel[j + 2] = Math.sin(a) * sp; s.life[i] = 0;
        }
        s.vel[j + 1] -= 9 * dt; s.pos[j] += s.vel[j] * dt; s.pos[j + 1] += s.vel[j + 1] * dt; s.pos[j + 2] += s.vel[j + 2] * dt;
      }
      s.geo.attributes.position.needsUpdate = true;
    }
  }

  window.HCTown = { Town, BUILDINGS, CAT, NPCS };
})();
