/*
 * T3 — shared 3D table framework for the Heo Con Club games (play3d.html?game=<key>).
 *
 * A game module registers itself:
 *   T3.register('bau-cua', { title, sub, table: 'round'|'rect'|'board'|'none', theme: 'pink'|'mint'|'sky'|'lemon'|'lavender'|'peach',
 *     tex: ['cards','chips',…] (assets/3d/js/tex_<name>.js bundles), models: ['bgb_coin_gold',…], rules: '<html>',
 *     async start(ctx) { … game loop … }, async selftest(ctx) { … return {pass, fail, …} } });
 * Everything a module needs is on ctx (see Ctx below). Coins are the shared wallet (HC.store 'coins').
 * Needs: three r147 + GLTFLoader + SkeletonUtils, js/hc3d.js, js/hc-core.js.
 */
(function () {
  'use strict';
  const T = window.THREE, H = window.HC3D;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const EASE = {
    lin: k => k, out: k => 1 - Math.pow(1 - k, 3), in: k => k * k * k, io: k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    back: k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
    bounce: k => { const n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + .75; if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + .9375; return n * (k -= 2.625 / d) * k + .984375; },
  };
  const MODULES = {};
  const T3 = { register(key, def) { MODULES[key] = def; }, modules: MODULES, EASE };
  window.T3 = T3;

  const THEMES = {
    pink: { felt: '#ff8fbf', felt2: '#ff6fa8', rim: 0xffffff, accent: 0xff4f95, bg: ['#ffd9ec', '#e7dbff'], dark: '#c2407a' },
    mint: { felt: '#5fd9ac', felt2: '#2fc58e', rim: 0xffffff, accent: 0x1fb07c, bg: ['#d3fbe9', '#d7ecff'], dark: '#168a60' },
    sky: { felt: '#6fbfff', felt2: '#3d9bff', rim: 0xffffff, accent: 0x2a7fd0, bg: ['#d8efff', '#e7dbff'], dark: '#1f6fc0' },
    lemon: { felt: '#ffd25a', felt2: '#ffb81c', rim: 0xffffff, accent: 0xd99a00, bg: ['#fff1c9', '#ffd9ec'], dark: '#a86d00' },
    lavender: { felt: '#b79bff', felt2: '#8d6bff', rim: 0xffffff, accent: 0x6c4bd1, bg: ['#ece3ff', '#d8efff'], dark: '#5f3fc9' },
    peach: { felt: '#ffb38a', felt2: '#ff8f5c', rim: 0xffffff, accent: 0xe0703c, bg: ['#ffe3d3', '#ffd9ec'], dark: '#b8542a' },
    red: { felt: '#e8556f', felt2: '#c93a55', rim: 0xffe6a0, accent: 0xb02a44, bg: ['#ffe0e0', '#fff1c9'], dark: '#8e1f36' },
  };
  const CHIP_VALUES = [['10m', 1e7], ['1m', 1e6], ['500k', 5e5], ['100k', 1e5], ['50k', 5e4], ['10k', 1e4], ['5k', 5e3], ['1k', 1e3]];
  const CHIP_SIDE = { '1k': 0xff8fc0, '5k': 0x5fd9ac, '10k': 0x6fbfff, '50k': 0xffc93c, '100k': 0xb79bff, '500k': 0xff8f5c, '1m': 0xe8556f, '10m': 0x3a2a4a };
  const BOTS = [
    { name: 'Bơ Sáp', key: 'adv_knight' }, { name: 'Kem Dâu', key: 'adv_ranger' }, { name: 'Mít Ướt', key: 'adv_rogue' }, { name: 'Bánh Bao', key: 'adv_barbarian' },
    { name: 'Sữa Chua', key: 'adv_mage' }, { name: 'Bin Bon', key: 'adv_rogue_hooded' }, { name: 'Cún Con', key: 'mini_dog' }, { name: 'Gấu Bông', key: 'mini_bear' }, { name: 'Vịt Bầu', key: 'mini_duck' },
  ];
  const SFX = {
    card: 'audio-casino-kenney/Audio/card-place-1.ogg', card2: 'audio-casino-kenney/Audio/card-place-2.ogg', slide: 'audio-casino-kenney/Audio/card-slide-1.ogg', shuffle: 'audio-casino-kenney/Audio/card-shuffle.ogg',
    fan: 'audio-casino-kenney/Audio/card-fan-1.ogg', chip: 'audio-casino-kenney/Audio/chip-lay-1.ogg', chips: 'audio-casino-kenney/Audio/chips-stack-1.ogg', dice: 'audio-casino-kenney/Audio/dice-shake-1.ogg',
    diceThrow: 'audio-casino-kenney/Audio/dice-throw-1.ogg', coin: 'audio-sfx-ninja/Bonus/Coin.wav', gold: 'audio-sfx-ninja/Bonus/Gold1.wav', win: 'audio-sfx-ninja/Jingles/Success1.wav',
    lose: 'audio-sfx-ninja/Jingles/GameOver.wav', click: 'audio-ui-kenney/Audio/click1.ogg', tick: 'audio-interface-kenney/Audio/tick_001.ogg', pop: 'audio-sfx-ninja/Elemental/Bubble.wav',
    turn: 'audio-sfx-ninja/Alert/Alert.wav', error: 'audio-interface-kenney/Audio/error_004.ogg', power: 'audio-digital-kenney/Audio/powerUp2.ogg', laser: 'audio-digital-kenney/Audio/pepSound1.ogg',
    boom: 'audio-sfx-ninja/Elemental/Explosion.wav', jingle: 'audio-jingles-kenney/Audio/Pizzicato jingles/jingles_PIZZI00.ogg',
  };
  const MUSIC = { cards: 'music-bgm/opengameart/happy-clappy-loop__OwlishMedia.wav', dice: 'music-bgm/opengameart/level-loop-tigrun__qubodup.ogg', board: 'music-bgm/opengameart/menu-chill__etrock.wav', sea: 'music-bgm/ninja-adventure/39 - Boat.ogg', loto: 'music-bgm/opengameart/happy-vibes__Ruskerdax.mp3' };

  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t; }
  function rr(x, X, Y, W, Hh, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + Hh, R); x.arcTo(X + W, Y + Hh, X, Y + Hh, R); x.arcTo(X, Y + Hh, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
  T3.canvasTex = canvasTex; T3.rr = rr;

  // ==================================================================== context
  class Ctx {
    constructor(def, el) {
      this.def = def; this.el = el;                // el: { canvas, ui (UI root), gameui (module HUD), labels, fx, coinEl }
      this.Q = new URLSearchParams(location.search);
      this.SHOT = this.Q.has('shot'); this.TEST = this.Q.has('selftest');
      this.timeScale = this.TEST ? .2 : this.SHOT ? .05 : 1;
      this.theme = THEMES[def.theme || 'pink'];
      this.tweens = []; this.frames = new Set(); this.pickables = []; this.labels = [];
      this.uiScale = 1; this.UW = 1920; this.UH = 1080;
      this.THREE = T; this.H = H; this.EASE = EASE; this.clamp = clamp; this.DEG = DEG;
      this.BOTS = BOTS; this.THEMES = THEMES;
      this.ui = new UI(this);
      this.texCache = {};
      this.rand = Math.random;
    }
    // ------------------------------------------------------------ boot
    async init(onProgress = () => {}) {
      const d = this.def;
      for (const src of d.scripts || []) await loadScript(src);   // e.g. js/games3d/rules/<key>.js
      for (let i = 0; i < (d.tex || []).length; i++) { await loadScript(`assets/3d/js/tex_${d.tex[i]}.js`); onProgress((i + 1) / ((d.tex || []).length + 2)); }
      const st = this.st = new H.Stage(this.el.canvas, { width: innerWidth, height: innerHeight, fov: d.fov || 40, shadows: true, pixelRatio: Math.min(devicePixelRatio || 1, 1.5), exposure: 1.05 });
      this.scene = st.scene; this.camera = st.camera; st.camera.far = 400; st.camera.near = .1;
      st.scene.children.filter(o => o.isLight).forEach(l => st.scene.remove(l));
      st.scene.add(new T.HemisphereLight(0xfff4fb, 0xc9b4ff, .85));
      const key = this.keyLight = new T.DirectionalLight(0xfff2e0, 1.45); key.position.set(6, 18, 9); key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 }); key.shadow.bias = -.0004; key.shadow.normalBias = .02;
      st.scene.add(key); st.scene.add(key.target);
      const fill = new T.DirectionalLight(0xffc6e6, .45); fill.position.set(-10, 8, -6); st.scene.add(fill);
      const bg = this.theme.bg;
      st.scene.background = canvasTex(8, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(0, 0, w, h); });
      st.scene.fog = new T.Fog(new T.Color(bg[1]), 40, 90);
      const models = ['anim_general', 'anim_move', ...(d.models || [])];
      for (let i = 0; i < models.length; i++) await H.load(models[i]);
      onProgress(.9);
      if (d.table !== 'none') { this.buildRoom(); this.buildTable(d.table || 'round'); }   // 'none': the module builds its own world
      this.camTo(d.cam || this.defaultCam(), 0);
      this.bindPick();
      this._last = performance.now();
      st.onUpdate(() => this.tick());
      st.start();
      onProgress(1);
    }
    defaultCam() {
      const t = this.def.table;
      if (t === 'rect') return { pos: [0, 11, 16], look: [0, 0, -.5] };
      if (t === 'board') return { pos: [0, 15.5, 10.5], look: [0, 0, .2] };
      return { pos: [0, 11, 16.5], look: [0, 0, -2] };
    }
    resize(w, h, uiScale, UW, UH) {
      this.uiScale = uiScale; this.UW = UW; this.UH = UH;
      if (!this.st) return;
      this.st.w = w; this.st.h = h; this.st.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); this.st.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // narrow windows: widen the view so the whole table stays in frame
      this.camera.fov = (this.def.fov || 40) * Math.max(1, 1.45 / (w / h)) ** .55; this.camera.updateProjectionMatrix();
    }
    // ------------------------------------------------------------ room + tables
    buildRoom() {
      const floorTex = canvasTex(512, 512, (x, w, h) => {
        x.fillStyle = '#f3e3ef'; x.fillRect(0, 0, w, h); const n = 8, s = w / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? '#f7ebf3' : '#efdcea'; x.fillRect(i * s, j * s, s, s); }
      });
      floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; floorTex.repeat.set(16, 16);
      const floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ map: floorTex, roughness: .9 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -3.2; floor.receiveShadow = true; this.scene.add(floor);
      const rug = new T.Mesh(new T.CircleGeometry(15, 64), new T.MeshStandardMaterial({ map: canvasTex(512, 512, (x, w, h) => {
        const cols = [this.theme.felt2, '#ffffff', this.theme.felt, '#ffffff']; for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % 4]; x.beginPath(); x.arc(w / 2, h / 2, w / 2 * (1 - i / 9), 0, 7); x.fill(); }
      }), roughness: 1 }));
      rug.rotation.x = -Math.PI / 2; rug.position.y = -3.18; rug.receiveShadow = true; this.scene.add(rug);
      // a few cosy props around
      const deco = [['hp_monstera', -13, -6, 1.3], ['hp_yucca', 13, -7, 1.3], ['hp_pothos', -15, 4, 1.1], ['hp_monstera', 15, 3, 1.2], ['pp_lantern', -11, -12, 1], ['pp_lantern', 11, -12, 1]];
      deco.forEach(([k, x, z, s]) => H.load(k).then(g => { const o = H.clone(g); o.scale.setScalar(s); o.position.set(x, -3.2, z); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); this.scene.add(o); }).catch(() => {}));
    }
    feltTex(w, h, logo = true) {
      const th = this.theme;
      return canvasTex(w, h, (x) => {
        const g = x.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * .65); g.addColorStop(0, th.felt); g.addColorStop(1, th.felt2); x.fillStyle = g; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
        x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 6; x.setLineDash([22, 16]);
        if (w === h) { x.beginPath(); x.arc(w / 2, h / 2, w * .4, 0, 7); x.stroke(); } else { rr(x, w * .05, h * .07, w * .9, h * .86, 60); x.stroke(); }
        x.setLineDash([]);
        if (logo) { x.font = `400 ${Math.round(w / 11)}px "Grandstander Black", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,255,255,.22)'; x.fillText('HEO CON CLUB', w / 2, h / 2); }
      });
    }
    buildTable(type) {
      const th = this.theme, g = this.table = new T.Group(); this.scene.add(g);
      const wood = H.mat(0xf3d2b8, { roughness: .6 }), rim = H.mat(th.rim, { roughness: .35, metalness: .1 }), acc = H.mat(th.accent, { roughness: .5 });
      const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
      if (type === 'round') {
        this.TR = 7;
        add(new T.CylinderGeometry(7, 7, .3, 96), new T.MeshStandardMaterial({ map: this.feltTex(1024, 1024), roughness: .95 }), 0, -.15, 0).castShadow = false;
        add(new T.TorusGeometry(7.25, .42, 20, 120), rim, 0, -.05, 0).rotation.x = Math.PI / 2;
        add(new T.CylinderGeometry(7.4, 7.1, .7, 96), acc, 0, -.6, 0);
        add(new T.CylinderGeometry(1.4, 2.6, 2.4, 32), wood, 0, -2.1, 0);
        this.size = { w: 14, d: 14 };
      } else if (type === 'rect') {
        add(H.roundedBox(18, .3, 11, .14, 2), new T.MeshStandardMaterial({ map: this.feltTex(1636, 1000), roughness: .95 }), 0, -.15, 0).castShadow = false;
        add(H.roundedBox(19, .6, 12, .3, 3), rim, 0, -.42, 0);
        add(H.roundedBox(18.6, .7, 11.6, .3, 2), acc, 0, -.9, 0);
        for (const [x, z] of [[-8, -4.6], [8, -4.6], [-8, 4.6], [8, 4.6]]) add(new T.CylinderGeometry(.45, .35, 2.4, 16), wood, x, -2.1, z);
        this.size = { w: 18, d: 11 };
      } else if (type === 'board') {
        add(H.roundedBox(15, .5, 13, .3, 3), wood, 0, -.3, 0);
        add(H.roundedBox(15.6, .4, 13.6, .25, 2), rim, 0, -.62, 0);
        for (const [x, z] of [[-6.5, -5.6], [6.5, -5.6], [-6.5, 5.6], [6.5, 5.6]]) add(new T.CylinderGeometry(.5, .4, 2.4, 16), wood, x, -2.1, z);
        this.size = { w: 15, d: 13 };
      }
    }
    // ------------------------------------------------------------ loop
    tick() {
      const now = performance.now(), dt = Math.min(.1, (now - this._last) / 1000); this._last = now;
      for (let i = this.tweens.length - 1; i >= 0; i--) { const tw = this.tweens[i]; if (tw.step(now)) { this.tweens.splice(i, 1); tw.resolve(); } }
      for (const f of [...this.frames]) { if (f(dt, now / 1000) === false) this.frames.delete(f); }
      this.updateLabels();
    }
    onFrame(fn) { this.frames.add(fn); return () => this.frames.delete(fn); }
    wait(ms) { return new Promise(r => setTimeout(r, ms * this.timeScale)); }
    /** Animate an Object3D. to: { x,y,z, rx,ry,rz, s, arc } (arc = extra height at the middle). */
    tween(obj, to, ms = 400, ease = 'out') {
      const from = { x: obj.position.x, y: obj.position.y, z: obj.position.z, rx: obj.rotation.x, ry: obj.rotation.y, rz: obj.rotation.z, s: obj.scale.x };
      const keys = Object.keys(to).filter(k => k in from), fn = typeof ease === 'function' ? ease : EASE[ease] || EASE.out, start = performance.now(), dur = Math.max(1, ms * this.timeScale), arc = to.arc || 0;
      // a new tween on the same property replaces the old one; settle the old promise so nobody waits forever
      this.tweens = this.tweens.filter(t => { const clash = t.obj === obj && t.keys.some(k => keys.includes(k)); if (clash) t.resolve(); return !clash; });
      return new Promise(resolve => {
        this.tweens.push({ obj, keys, resolve, step(now) {
          const k = clamp((now - start) / dur, 0, 1), e = fn(k);
          for (const p of keys) {
            const v = from[p] + (to[p] - from[p]) * e;
            if (p === 'x' || p === 'y' || p === 'z') obj.position[p] = v; else if (p === 's') obj.scale.setScalar(v); else obj.rotation[p[1]] = v;
          }
          if (arc) obj.position.y += Math.sin(Math.PI * k) * arc;
          return k >= 1;
        } });
      });
    }
    camTo(c, ms = 700) {
      const cam = this.camera, p0 = cam.position.clone(), l0 = this._look ? this._look.clone() : new T.Vector3(...c.look), p1 = new T.Vector3(...c.pos), l1 = new T.Vector3(...c.look);
      if (!ms) { cam.position.copy(p1); this._look = l1; cam.lookAt(l1); return Promise.resolve(); }
      const start = performance.now(), dur = ms * this.timeScale;
      return new Promise(resolve => this.tweens.push({ obj: cam, keys: ['cam'], resolve, step: (now) => { const k = EASE.io(clamp((now - start) / dur, 0, 1)); cam.position.lerpVectors(p0, p1, k); this._look = l0.clone().lerp(l1, k); cam.lookAt(this._look); return k >= 1; } }));
    }
    // ------------------------------------------------------------ textures & materials
    tex(key) {
      if (this.texCache[key]) return this.texCache[key];
      const src = (window.HC_TEX || {})[key]; const t = new T.Texture();
      t.encoding = T.sRGBEncoding; t.anisotropy = 8;
      if (src) { const im = new Image(); im.onload = () => { t.image = im; t.needsUpdate = true; }; im.src = src; }
      else console.warn('missing texture', key);
      return (this.texCache[key] = t);
    }
    texReady() { return Promise.all(Object.values(this.texCache).map(t => t.image ? 0 : new Promise(r => { const c = setInterval(() => { if (t.image) { clearInterval(c); r(); } }, 30); setTimeout(() => { clearInterval(c); r(); }, 3000); }))); }
    mat(hex, o) { return H.mat(hex, o); }
    add(o) { this.scene.add(o); return o; }
    remove(o) { if (o && o.parent) o.parent.remove(o); }
    // ------------------------------------------------------------ cards (52-card deck)
    /** Card mesh. key like 'hearts_A' / 'spades_10' (or any texture key with face:true). Lies flat, face up. */
    card(key, opts = {}) {
      const W = opts.w || 1.1, Hh = W * 1.44, g = new T.Group();
      const faceKey = opts.tex || (key ? 'c_' + key : null);
      const front = new T.Mesh(new T.PlaneGeometry(W, Hh), new T.MeshStandardMaterial({ map: faceKey ? this.tex(faceKey) : null, roughness: .55, transparent: true, alphaTest: .35 }));
      front.rotation.x = -Math.PI / 2; front.position.y = .006; front.castShadow = true; g.add(front);
      const back = new T.Mesh(new T.PlaneGeometry(W, Hh), new T.MeshStandardMaterial({ map: this.tex(opts.back || 'c_back'), roughness: .55, transparent: true, alphaTest: .35 }));
      back.rotation.x = Math.PI / 2; back.position.y = -.006; back.castShadow = true; g.add(back);
      g.userData = { key, front, back, faceUp: true, W, H: Hh };
      g.setFace = k => { g.userData.key = k; front.material.map = this.tex(opts.tex ? k : 'c_' + k); front.material.needsUpdate = true; };
      return g;
    }
    deck(shuffle = true) {
      const S = ['spades', 'clubs', 'diamonds', 'hearts'], R = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], d = [];
      S.forEach(s => R.forEach(r => d.push({ s, r, key: `${s}_${r}` })));
      return shuffle ? this.shuffle(d) : d;
    }
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    pick(a) { return a[Math.floor(this.rand() * a.length)]; }
    /** Place a card face-up/down with a flip animation. */
    flip(card, faceUp, ms = 350) { card.userData.faceUp = faceUp; const target = faceUp ? 0 : Math.PI; return this.tween(card, { rz: target, y: card.position.y, arc: .5 }, ms, 'io'); }
    /** Deal: fly a card from `from` to {x,y,z,ry} lying on the table. */
    async deal(card, to, ms = 380, faceUp = false) {
      if (!card.parent) this.scene.add(card);
      card.rotation.set(0, to.ry || 0, faceUp ? 0 : Math.PI); card.userData.faceUp = faceUp;
      this.sfx(Math.random() < .5 ? 'card' : 'card2', .35);
      await this.tween(card, { x: to.x, y: to.y || .02, z: to.z, ry: to.ry || 0, arc: 1.2 }, ms, 'out');
      return card;
    }
    /** Lay out the player's hand: standing up, fanned, facing the camera at the near edge of the table. */
    layoutHand(cards, opts = {}) {
      const n = cards.length, z = opts.z != null ? opts.z : 6.4, y = opts.y != null ? opts.y : 1.6, spread = opts.spread || Math.min(1.05, 11 / Math.max(1, n)), tilt = opts.tilt != null ? opts.tilt : 1.05;
      return Promise.all(cards.map((c, i) => {
        const t = i - (n - 1) / 2, up = c.userData.selected ? .45 : 0;
        if (!c.parent) this.scene.add(c);
        c.renderOrder = i;
        return this.tween(c, { x: t * spread, y: y + up - Math.abs(t) * .02, z: z - up * .3 + i * .012, rx: tilt, ry: 0, rz: -t * (opts.fan || .02) }, opts.ms || 300, 'out');
      }));
    }
    // ------------------------------------------------------------ chips, dice, coins, bowls
    chipKey(v) { for (const [k, val] of CHIP_VALUES) if (v >= val) return k; return '1k'; }
    chipValue(k) { return (CHIP_VALUES.find(c => c[0] === k) || [0, 1000])[1]; }
    chip(k) {
      const g = new T.Group(), r = .42, h = .1;
      const side = new T.Mesh(new T.CylinderGeometry(r, r, h, 32, 1, true), H.mat(CHIP_SIDE[k] || 0xff8fc0, { roughness: .4 })); side.castShadow = true; g.add(side);
      const top = new T.Mesh(new T.CircleGeometry(r, 32), new T.MeshStandardMaterial({ map: this.tex('chip_' + k), roughness: .45 })); top.rotation.x = -Math.PI / 2; top.position.y = h / 2; g.add(top);
      const bot = new T.Mesh(new T.CircleGeometry(r, 32), H.mat(CHIP_SIDE[k] || 0xff8fc0)); bot.rotation.x = Math.PI / 2; bot.position.y = -h / 2; g.add(bot);
      g.userData.chip = k; return g;
    }
    /** Break an amount into chip keys (largest first, max `max` chips). */
    chipsFor(amount, max = 14) { const out = []; for (const [k, v] of CHIP_VALUES) while (amount >= v && out.length < max) { out.push(k); amount -= v; } return out; }
    /** A small stack of chips worth `amount` at (x,z). Returns the group. */
    stack(amount, x, z, parent) {
      const g = new T.Group(); g.position.set(x, 0, z);
      this.chipsFor(amount).forEach((k, i) => { const c = this.chip(k); c.position.set((i % 2) * .03, .05 + i * .1, 0); c.rotation.y = Math.random() * 6; g.add(c); });
      (parent || this.scene).add(g); return g;
    }
    /** Animate a stack from one place to another, then remove it if `vanish`. */
    async moveStack(g, x, z, ms = 500, vanish = false) { this.sfx('chips', .35); await this.tween(g, { x, z, arc: 1.4 }, ms, 'io'); if (vanish) this.remove(g); }
    /** Die with 6 face textures (keys) or classic pips. Face order: values[0] is up (+y) when rotation is zero. */
    die(opts = {}) {
      const s = opts.size || .9;
      const faceTex = opts.faces ? opts.faces.map(k => this.tex(k)) : [1, 2, 3, 4, 5, 6].map(v => this.pipTex(v, opts.color || '#ffffff', opts.pip || '#3a2030'));
      // BoxGeometry material order: +x, -x, +y, -y, +z, -z  →  values: +y=v0, -y=v5, +x=v2, -x=v3, +z=v1, -z=v4 (opposites v0/v5, v1/v4, v2/v3)
      const order = [2, 3, 0, 5, 1, 4];
      const mats = order.map(i => new T.MeshStandardMaterial({ map: faceTex[i], roughness: .35 }));
      const m = new T.Mesh(H.roundedBox(s, s, s, s * .14, 3), mats); m.castShadow = true; m.receiveShadow = true;
      const g = new T.Group(); g.add(m); g.position.y = s / 2; g.userData = { size: s, value: 0 };
      // rotations that bring face i to the top
      const Q = [new T.Euler(0, 0, 0), new T.Euler(-Math.PI / 2, 0, 0), new T.Euler(0, 0, Math.PI / 2), new T.Euler(0, 0, -Math.PI / 2), new T.Euler(Math.PI / 2, 0, 0), new T.Euler(Math.PI, 0, 0)].map(e => new T.Quaternion().setFromEuler(e));
      /** Tumble to (x,z) and land with face `face` (0..5) on top. */
      g.roll = (face, x, z, ms = 1100) => {
        const startPos = g.position.clone(), q0 = m.quaternion.clone(), yaw = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
        const q1 = yaw.multiply(Q[face]), spin = new T.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(), turns = 3 + Math.random() * 2;
        const start = performance.now(), dur = ms * this.timeScale; g.userData.value = face;
        return new Promise(resolve => this.tweens.push({ obj: g, keys: ['roll'], resolve, step: (now) => {
          const k = clamp((now - start) / dur, 0, 1);
          g.position.x = startPos.x + (x - startPos.x) * EASE.out(k); g.position.z = startPos.z + (z - startPos.z) * EASE.out(k);
          g.position.y = s / 2 + Math.abs(Math.sin(k * Math.PI * 2.5)) * (1 - k) * 1.6;
          if (k < .72) { m.quaternion.copy(q0).multiply(new T.Quaternion().setFromAxisAngle(spin, k / .72 * turns * Math.PI * 2)); }
          else { const tq = q0.clone().multiply(new T.Quaternion().setFromAxisAngle(spin, turns * Math.PI * 2)); m.quaternion.copy(tq).slerp(q1, EASE.out((k - .72) / .28)); }
          return k >= 1;
        } }));
      };
      g.setFace = face => { m.quaternion.copy(Q[face]); g.userData.value = face; };
      return g;
    }
    pipTex(v, bg, pip) {
      const key = `pip_${v}_${bg}_${pip}`; if (this.texCache[key]) return this.texCache[key];
      const P = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.27, .22], [.73, .22], [.27, .5], [.73, .5], [.27, .78], [.73, .78]] };
      return (this.texCache[key] = canvasTex(128, 128, (x, w) => { x.fillStyle = bg; x.fillRect(0, 0, w, w); for (const [a, b] of P[v]) { x.fillStyle = v === 1 || v === 4 ? '#ff3d6e' : pip; x.beginPath(); x.arc(a * w, b * w, v === 1 ? 17 : 12, 0, 7); x.fill(); } }));
    }
    /** Two-sided disc (Xóc Đĩa coins). */
    coin2(texA, texB, r = .45) {
      const g = new T.Group();
      const a = new T.Mesh(new T.CircleGeometry(r, 32), new T.MeshStandardMaterial({ map: this.tex(texA), roughness: .4, transparent: true, alphaTest: .3 })); a.rotation.x = -Math.PI / 2; a.position.y = .03; g.add(a);
      const b = new T.Mesh(new T.CircleGeometry(r, 32), new T.MeshStandardMaterial({ map: this.tex(texB), roughness: .4, transparent: true, alphaTest: .3 })); b.rotation.x = Math.PI / 2; b.position.y = -.03; g.add(b);
      const e = new T.Mesh(new T.CylinderGeometry(r * .98, r * .98, .06, 32, 1, true), H.mat(0xd9b46a)); g.add(e);
      a.castShadow = b.castShadow = true; g.position.y = .04; return g;
    }
    bowl(color = 0xff8fc0, r = 2.2) {
      const pts = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; pts.push(new T.Vector2(Math.sin(a) * r + .02, Math.cos(a) * r * .8)); }
      const g = new T.Group();
      const m = new T.Mesh(new T.LatheGeometry(pts, 48), H.mat(color, { roughness: .35, side: T.DoubleSide })); m.castShadow = true; g.add(m);
      const knob = new T.Mesh(new T.SphereGeometry(r * .18, 20, 14), H.mat(0xffffff, { roughness: .3 })); knob.position.y = r * .82; g.add(knob);
      const ring = new T.Mesh(new T.TorusGeometry(r * .99, .08, 10, 64), H.mat(0xffffff, { roughness: .3 })); ring.rotation.x = Math.PI / 2; ring.position.y = .04; g.add(ring);
      return g;
    }
    plate(color = 0xffffff, r = 2.6) {
      const g = new T.Group();
      const m = new T.Mesh(new T.CylinderGeometry(r, r * .85, .22, 64), H.mat(color, { roughness: .3 })); m.position.y = .11; m.castShadow = true; m.receiveShadow = true; g.add(m);
      const rim = new T.Mesh(new T.TorusGeometry(r, .09, 10, 64), H.mat(0xffd34d, { roughness: .25, metalness: .4 })); rim.rotation.x = Math.PI / 2; rim.position.y = .22; g.add(rim);
      return g;
    }
    // ------------------------------------------------------------ bots & seats
    /** Seats around the table. Seat 0 is the player (camera side, no 3D body). Returns [{i, name, key, avatar, pos, angle, ch, label}]. */
    async seats(n, opts = {}) {
      const R = opts.r || 8.4, bots = this.shuffle(BOTS.slice()), out = [];
      const angles = opts.angles || (n === 2 ? [90, 270] : n === 3 ? [90, 210, 330] : n === 4 ? [90, 180, 270, 0] : n === 5 ? [90, 162, 216, 324, 18] : Array.from({ length: n }, (_, i) => 90 + i * 360 / n));
      for (let i = 0; i < n; i++) {
        const a = angles[i] * DEG, pos = new T.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
        const s = { i, angle: a, pos, me: i === 0, coins: 0 };
        if (i === 0) { Object.assign(s, { name: (window.HC && HC.store.get('name', 'Bạn')) || 'Bạn', avatar: (window.HC && HC.store.get('av', 'avatars-dicebear/fun-emoji/png/bong.png')) }); }
        else {
          const b = bots[(i - 1) % bots.length]; Object.assign(s, { name: b.name, key: b.key, avatar: `3d/renders/avatars/${b.key}.png`, coins: Math.round((2 + Math.random() * 30)) * 100000 });
          const ch = await H.character(this.st, b.key, { anim: 'Idle_A', scale: b.key.startsWith('mini') ? 2.1 : 1.45 });
          ch.root.position.set(Math.cos(a) * (R + 1.2), -1.25, Math.sin(a) * (R + 1.2)); ch.root.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
          ch.root.traverse(m => { if (m.isMesh) m.castShadow = true; });
          s.ch = ch;
          s.anim = (name) => { const adv = b.key.startsWith('adv'); const map = { cheer: adv ? 'Jump_Full_Short' : 'cheer', sad: adv ? 'Hit_A' : 'sad', think: adv ? 'Interact' : 'idle', wave: adv ? 'Interact' : 'cheer' }; ch.play(map[name] || name, { once: true, then: 'Idle_A' }); };
          s.label = this.label(() => new T.Vector3(Math.cos(a) * (R + 1.2), b.key.startsWith('mini') ? 2.6 : 3.1, Math.sin(a) * (R + 1.2)), `<img src="${HC.A(s.avatar)}"><div><b>${s.name}</b><span class="c">${HC.short(s.coins)}</span></div>`, 'seatlbl');
        }
        s.say = (text, ms = 2200) => this.ui.bubble(s, text, ms);
        s.setCoins = v => { s.coins = v; if (s.label) s.label.el.querySelector('.c').textContent = HC.short(Math.max(0, v)); };
        s.turn = on => { if (s.label) s.label.el.classList.toggle('turn', !!on); else this.ui.meTurn(!!on); };
        /** a point on the table in front of this seat; along = sideways offset, inward = distance from the rim */
        s.spot = (along = 0, inward = 2.6) => { const r = (opts.tableR || 7) - inward; return new T.Vector3(Math.cos(a) * r - Math.sin(a) * along, .02, Math.sin(a) * r + Math.cos(a) * along); };
        s.facing = Math.atan2(Math.cos(a), Math.sin(a));   // yaw so a card faces the seat's owner
        out.push(s);
      }
      this.seatList = out;
      return out;
    }
    // ------------------------------------------------------------ picking
    pickable(obj, onClick, onHover) { const p = { obj, onClick, onHover }; this.pickables.push(p); return () => { this.pickables = this.pickables.filter(x => x !== p); }; }
    bindPick() {
      const cv = this.el.canvas, ray = new T.Raycaster(), ndc = new T.Vector2();
      const find = e => {
        const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, this.camera);
        const objs = this.pickables.filter(p => p.obj.visible !== false).map(p => p.obj);
        const hit = ray.intersectObjects(objs, true).find(h => h.object.visible !== false);
        if (!hit) return null;
        let o = hit.object; while (o && !this.pickables.some(p => p.obj === o)) o = o.parent;
        return o ? { p: this.pickables.find(p => p.obj === o), point: hit.point } : null;
      };
      this.ray = (e, plane = new T.Plane(new T.Vector3(0, 1, 0), 0)) => { const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, this.camera); const p = new T.Vector3(); return ray.ray.intersectPlane(plane, p) ? p : null; };
      let down = null, hov = null;
      cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; if (this.onPointerDown) this.onPointerDown(e); });
      cv.addEventListener('pointerup', e => {
        if (this.onPointerUp) this.onPointerUp(e);
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) { down = null; return; } down = null;
        const h = find(e); if (h && h.p.onClick) h.p.onClick(h.point, e);
      });
      cv.addEventListener('pointermove', e => {
        if (this.onPointerMove) this.onPointerMove(e);
        if (e.pointerType === 'touch') return;
        const h = find(e), o = h && h.p;
        if (hov !== o) { if (hov && hov.onHover) hov.onHover(false); hov = o; if (o && o.onHover) o.onHover(true); }
        cv.style.cursor = o && o.onClick ? 'pointer' : 'default';
      });
    }
    // ------------------------------------------------------------ labels projected from 3D
    label(target, html, cls = '') {
      const el = document.createElement('div'); el.className = 'lbl3 ' + cls; el.innerHTML = html; this.el.labels.appendChild(el);
      const l = { el, target, remove: () => { el.remove(); this.labels = this.labels.filter(x => x !== l); } };
      this.labels.push(l); return l;
    }
    toUI(v3) { const v = v3.clone().project(this.camera); return { x: (v.x + 1) / 2 * this.UW, y: (1 - v.y) / 2 * this.UH, behind: v.z > 1 }; }
    updateLabels() {
      for (const l of this.labels) {
        const p = typeof l.target === 'function' ? l.target() : l.target.getWorldPosition ? l.target.getWorldPosition(new T.Vector3()) : l.target;
        const s = this.toUI(p); l.el.style.display = s.behind ? 'none' : '';
        l.el.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px) translate(-50%,-100%)`;
      }
    }
    // ------------------------------------------------------------ wallet & sound
    get coins() { return HC.store.get('coins', 1250000); }
    set coins(v) { HC.store.set('coins', Math.max(0, Math.round(v))); this.ui.refreshCoins(); }
    /** Take a bet. Returns false (and tells the player) if there is not enough. */
    spend(n) { if (this.coins < n) { this.ui.toast('Không đủ xu rồi 😅', 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); this.sfx('error', .4); return false; } this.coins = this.coins - n; return true; }
    /** Give the player coins with a flying-coin effect from a 3D point (or the screen centre). */
    win(n, from) { if (n <= 0) return; this.coins = this.coins + n; this.ui.flyCoins(from ? this.toUI(from) : { x: this.UW / 2, y: this.UH / 2 }, Math.min(16, 4 + Math.round(Math.log10(n)))); this.ui.float('+' + HC.short(n), from); this.sfx('coin', .35); }
    sfx(name, vol = .5) { if (this.SHOT || this.TEST || !HC.settings.sfx || !SFX[name]) return; const now = performance.now(); this._snd = this._snd || {}; if (now - (this._snd[name] || 0) < 40) return; this._snd[name] = now; try { const a = new Audio(HC.A(SFX[name])); a.volume = vol; a.play().catch(() => {}); } catch (e) {} }
    music(key) { if (MUSIC[key]) HC.music(MUSIC[key], .25); }
  }

  // ==================================================================== UI kit (DOM, in UI units)
  class UI {
    constructor(ctx) { this.ctx = ctx; }
    get root() { return this.ctx.el.gameui; }
    h(tag, attrs = {}, parent) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k === 'html') e.innerHTML = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } if (parent) parent.appendChild(e); return e; }
    img(src, cls = '', parent) { return this.h('img', { src: HC.A(src), class: cls }, parent); }
    refreshCoins() { const e = this.ctx.el.coinEl; if (e) e.textContent = HC.fmt(this.ctx.coins); }
    /** Bottom action bar. items: [{id, label, cls:'pink'|'mint'|'sky'|'lemon'|'grey', onClick, icon}] → returns {btn(id), set(id, {disabled, label, hidden}), el} */
    actions(items) {
      if (this._bar) this._bar.remove();
      const bar = this._bar = this.h('div', { class: 'gbar glass' }, this.root), map = {};
      for (const it of items) {
        const b = this.h('div', { class: 'gbtn ' + (it.cls || 'pink'), html: (it.icon ? `<img src="${HC.A(it.icon)}">` : '') + `<span>${it.label}</span>` }, bar);
        b.onclick = () => { if (b.classList.contains('off')) return; this.ctx.sfx('click', .4); it.onClick && it.onClick(); };
        map[it.id || it.label] = b;
      }
      return { el: bar, btn: id => map[id], set: (id, o) => { const b = map[id]; if (!b) return; if ('disabled' in o) b.classList.toggle('off', !!o.disabled); if ('hidden' in o) b.style.display = o.hidden ? 'none' : ''; if ('label' in o) b.querySelector('span').textContent = o.label; } };
    }
    clearActions() { if (this._bar) { this._bar.remove(); this._bar = null; } }
    /** Chip value selector (left side). values in coins. */
    chipPicker(values, onChange, start = 0) {
      if (this._chips) this._chips.remove();
      const box = this._chips = this.h('div', { class: 'chippick glass' }, this.root); let cur = values[start];
      values.forEach((v, i) => { const c = this.img('', 'chipimg' + (i === start ? ' on' : ''), box); c.src = HC.A(`games/card-shared/chips/chip_${this.ctx.chipKey(v)}.png`); c.title = HC.fmt(v); c.onclick = () => { cur = v; [...box.children].forEach(x => x.classList.toggle('on', x === c)); this.ctx.sfx('chip', .3); onChange && onChange(v); }; });
      return { get value() { return cur; }, el: box };
    }
    status(text) { if (!this._st) this._st = this.h('div', { class: 'gstatus' }, this.root); this._st.innerHTML = text; this._st.style.display = text ? '' : 'none'; }
    toast(msg, icon = 'emoji-fluent-3d/game/party_popper.png') { const t = this.ctx.el.toast; t.querySelector('img').src = HC.A(icon); t.querySelector('span').textContent = msg; t.style.display = 'flex'; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 2300); }
    callout(text, color = '#c2407a') { if (this.ctx.SHOT) return; const c = this.h('div', { class: 'callout3', text, style: `-webkit-text-stroke-color:${color};text-shadow:0 12px 0 ${color}` }, this.ctx.el.fx); setTimeout(() => c.remove(), 1700); }
    confetti(n = 90) { if (this.ctx.SHOT || this.ctx.TEST) return; const cols = ['#ff6fa8', '#ffc93c', '#3ccf9b', '#4fb3ff', '#a07bff', '#fff']; for (let i = 0; i < n; i++) { const c = this.h('div', { class: 'confetti', style: `left:${Math.random() * this.ctx.UW}px;background:${cols[i % cols.length]}` }, this.ctx.el.fx); c.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${Math.random() * 400 - 200}px,${this.ctx.UH + 200}px) rotate(${Math.random() * 1800 - 900}deg)` }], { duration: 1600 + Math.random() * 1200, delay: Math.random() * 400 }).onfinish = () => c.remove(); } }
    float(text, from, cls = '') { const p = from ? this.ctx.toUI(from) : { x: this.ctx.UW / 2, y: this.ctx.UH / 2 }; const e = this.h('div', { class: 'float3 ' + cls, text, style: `left:${p.x}px;top:${p.y - 40}px` }, this.ctx.el.fx); setTimeout(() => e.remove(), 1200); }
    flyCoins(from, n = 10) {
      if (this.ctx.SHOT || this.ctx.TEST) return; const r = this.ctx.el.coinEl.getBoundingClientRect(), u = this.ctx.uiScale, to = { x: r.left / u + 10, y: r.top / u + 10 };
      for (let i = 0; i < n; i++) { const c = this.img('emoji-fluent-3d/game/coin.png', 'flycoin', this.ctx.el.fx); c.style.left = from.x - 28 + 'px'; c.style.top = from.y - 28 + 'px'; const mx = (from.x + to.x) / 2 + Math.random() * 300 - 150, my = Math.min(from.y, to.y) - 60 - Math.random() * 160; c.animate([{ transform: 'translate(0,0) scale(.6)' }, { transform: `translate(${mx - from.x}px,${my - from.y}px) scale(1.1)`, offset: .45 }, { transform: `translate(${to.x - from.x}px,${to.y - from.y}px) scale(.7)` }], { duration: 700 + Math.random() * 300, delay: i * 50, easing: 'ease-in-out' }).onfinish = () => c.remove(); }
    }
    bubble(seat, text, ms = 2200) {
      if (seat.me) { this.toast(text, 'emoji-fluent-3d/symbols/speech_balloon.png'); return; }
      if (!seat._bub) { const a = seat.angle, R = 9.6; seat._bub = this.ctx.label(() => new this.ctx.THREE.Vector3(Math.cos(a) * R, seat.key && seat.key.startsWith('mini') ? 4 : 4.6, Math.sin(a) * R), '', 'bub3'); }
      const e = seat._bub.el; e.textContent = text; e.classList.add('on'); clearTimeout(e._h); e._h = setTimeout(() => e.classList.remove('on'), ms * (this.ctx.TEST ? .1 : 1));
    }
    meTurn(on) { this.ctx.el.ui.classList.toggle('myturn', on); }
    /** Modal. buttons: [{label, cls, onClick, close:true}] → Promise of the clicked label. */
    modal({ title, html, body, buttons = [{ label: 'Đóng', cls: 'grey' }], width = 900, icon }) {
      const m = this.ctx.el.modal; m.innerHTML = ''; m.classList.add('on');
      const p = this.h('div', { class: 'mpanel', style: `width:${width}px` }, m);
      if (icon) this.img(icon, 'micon', p);
      if (title) this.h('h2', { text: title }, p);
      const b = this.h('div', { class: 'mbody' }, p); if (html) b.innerHTML = html; if (body) b.appendChild(body);
      const row = this.h('div', { class: 'mrow' }, p);
      requestAnimationFrame(() => { const k = Math.min(1.25, (this.ctx.UW - 60) / p.offsetWidth, (this.ctx.UH - 60) / p.offsetHeight); p.style.transform = `scale(${k})`; }); // popups shrink less than the HUD
      return new Promise(res => buttons.forEach(bt => { const e = this.h('div', { class: 'gbtn ' + (bt.cls || 'pink'), html: `<span>${bt.label}</span>` }, row); e.onclick = () => { this.ctx.sfx('click', .4); if (bt.close !== false) this.closeModal(); bt.onClick && bt.onClick(); res(bt.label); }; }));
    }
    closeModal() { const m = this.ctx.el.modal; m.classList.remove('on'); m.innerHTML = ''; }
    /** End-of-round table. rows: [{name, avatar, detail, amount, me, tag}] */
    results(title, rows, { again = 'Ván mới', onAgain } = {}) {
      const body = this.h('div', { class: 'rlist' });
      rows.forEach(r => { const it = this.h('div', { class: 'rrow' + (r.me ? ' me' : '') }, body); if (r.tag) this.h('div', { class: 'rtag', text: r.tag }, it); this.img(r.avatar, 'rav', it); const w = this.h('div', { class: 'rwho' }, it); this.h('b', { text: r.name }, w); this.h('small', { html: r.detail || '' }, w); this.h('div', { class: 'ramt' + (r.amount < 0 ? ' neg' : ''), text: r.amount == null ? '' : (r.amount > 0 ? '+' : r.amount < 0 ? '−' : '') + HC.fmt(Math.abs(r.amount)) }, it); });
      return this.modal({ title, body, width: 1000, buttons: [{ label: again, cls: 'pink', onClick: onAgain }] });
    }
  }

  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src + (window.HC && HC.V ? '?' + HC.V : ''); s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); }); }
  T3.loadScript = loadScript;
  T3.Ctx = Ctx;
})();
