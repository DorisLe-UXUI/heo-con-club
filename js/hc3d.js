/*
 * HC3D — tiny three.js helper for Heo Con Club (works from file:// because models are embedded as base64 JS).
 * Needs: js/vendor/three.min.js, js/vendor/GLTFLoader.js, js/vendor/SkeletonUtils.js
 */
(function () {
  'use strict';
  const T = window.THREE;
  const HC3D = { ok: false };
  window.HC3D = HC3D;
  if (!T) return;
  try {
    const c = document.createElement('canvas');
    HC3D.ok = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { HC3D.ok = false; }
  const BASE = (window.HC3D_BASE || 'assets/3d/js/');
  // Headless Chrome (used for automated screenshots) never resolves createImageBitmap on embedded textures;
  // GLTFLoader falls back to a plain Image decode when it is missing.
  if (/HeadlessChrome/.test(navigator.userAgent)) { try { window.createImageBitmap = undefined; } catch (e) {} }
  const gltfCache = {}, scriptCache = {};

  function loadScript(key) {
    if (window.HC_MODELS && window.HC_MODELS[key]) return Promise.resolve();
    if (!scriptCache[key]) scriptCache[key] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = BASE + key + '.js'; s.onload = () => res(); s.onerror = () => rej(new Error('model ' + key));
      document.head.appendChild(s);
    });
    return scriptCache[key];
  }
  function b64(str) { const bin = atob(str); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  HC3D.load = function (key) {
    if (!gltfCache[key]) gltfCache[key] = loadScript(key).then(() => new Promise((res, rej) => {
      new T.GLTFLoader().parse(b64(window.HC_MODELS[key]), '', g => {
        g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.side = T.FrontSide; } } });
        res(g);
      }, rej);
    }));
    return gltfCache[key];
  };
  HC3D.clone = function (gltf) { return T.SkeletonUtils ? T.SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true); };

  // ------------------------------------------------------------------ stage
  class Stage {
    /**
     * opts: { ortho: true → pixel coordinates (x right, y down) over a w×h area; else perspective camera }
     */
    constructor(canvas, opts = {}) {
      this.canvas = canvas; this.opts = opts;
      this.w = opts.width || canvas.width; this.h = opts.height || canvas.height;
      this.renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: !!opts.preserve });
      this.renderer.setPixelRatio(Math.min(opts.pixelRatio || window.devicePixelRatio || 1, 2));
      this.renderer.setSize(this.w, this.h, false);
      this.renderer.outputEncoding = T.sRGBEncoding;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = opts.exposure || 1.15;
      this.renderer.shadowMap.enabled = !!opts.shadows;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.scene = new T.Scene();
      if (opts.ortho) {
        this.camera = new T.OrthographicCamera(0, this.w, 0, -this.h, -3000, 3000);
        this.camera.position.set(0, 0, 1000);
      } else {
        this.camera = new T.PerspectiveCamera(opts.fov || 32, this.w / this.h, 0.1, 200);
        this.camera.position.set(0, 2.2, 9); this.camera.lookAt(0, 1.2, 0);
      }
      const hemi = new T.HemisphereLight(0xfff4fb, 0xb9a0ff, 0.95); this.scene.add(hemi);
      const key = new T.DirectionalLight(0xffffff, 1.35);
      key.position.set(opts.ortho ? 600 : 4, opts.ortho ? 900 : 8, opts.ortho ? 1200 : 6);
      if (opts.shadows) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; key.shadow.radius = 4; key.shadow.bias = -0.0005; }
      this.scene.add(key); this.key = key;
      const rim = new T.DirectionalLight(0xffc2e6, 0.6); rim.position.set(-5, 3, -4); this.scene.add(rim);
      this.clock = new T.Clock();
      this.updaters = new Set();
      this.mixers = new Set();
      this.running = false;
      this._loop = this._loop.bind(this);
    }
    add(o) { this.scene.add(o); return o; }
    remove(o) { this.scene.remove(o); }
    onUpdate(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }
    start() { if (!this.running) { this.running = true; this.clock.getDelta(); requestAnimationFrame(this._loop); } return this; }
    stop() { this.running = false; }
    _loop() {
      if (!this.running) return;
      const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
      for (const m of this.mixers) m.update(dt);
      for (const f of [...this.updaters]) { if (f(dt, t) === false) this.updaters.delete(f); }
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this._loop);
    }
    /** pixel → world for ortho stages */
    px(x, y, z = 0) { return new T.Vector3(x, -y, z); }
  }
  HC3D.Stage = Stage;

  // ------------------------------------------------------------------ characters
  const ANIM_KEYS = ['anim_general', 'anim_move'];
  HC3D.character = async function (stage, key, opts = {}) {
    const g = await HC3D.load(key);
    const root = new T.Group();
    const model = HC3D.clone(g);
    root.add(model);
    const out = { root, model, key, clips: {}, mixer: null, action: null };
    out.dispose = () => { stage.remove(root); if (out.mixer) { out.mixer.stopAllAction(); stage.mixers.delete(out.mixer); } };
    if (key.startsWith('adv_')) {
      const anims = await Promise.all(ANIM_KEYS.map(HC3D.load));
      anims.forEach(a => a.animations.forEach(c => { out.clips[c.name] = c; }));
      out.mixer = new T.AnimationMixer(model); stage.mixers.add(out.mixer);
      out.play = (name, o = {}) => {
        const clip = out.clips[name]; if (!clip) return null;
        const act = out.mixer.clipAction(clip);
        act.reset(); act.setLoop(o.once ? T.LoopOnce : T.LoopRepeat, Infinity); act.clampWhenFinished = !!o.once;
        act.timeScale = o.speed || 1;
        if (out.action && out.action !== act) { act.crossFadeFrom(out.action, o.fade == null ? 0.25 : o.fade, false); }
        act.play(); out.action = act;
        if (o.once && o.then) { const h = e => { if (e.action === act) { out.mixer.removeEventListener('finished', h); out.play(o.then); } }; out.mixer.addEventListener('finished', h); }
        return act;
      };
      out.play(opts.anim || 'Idle_A', { fade: 0 });
    } else {
      // KayKit mini-game animals: procedural idle (bob, head tilt, arm swing)
      const parts = {};
      model.traverse(o => { if (/ArmLeft$/.test(o.name)) parts.al = o; else if (/ArmRight$/.test(o.name)) parts.ar = o; else if (/Head$/.test(o.name)) parts.head = o; });
      const base = { al: parts.al && parts.al.rotation.clone(), ar: parts.ar && parts.ar.rotation.clone(), head: parts.head && parts.head.rotation.clone() };
      let mode = 'idle', modeT = 0;
      out.play = (name) => { mode = /Walk|Run/i.test(name) ? 'walk' : /Jump|Spawn|Interact|cheer/i.test(name) ? 'cheer' : /Hit|Death|sad/i.test(name) ? 'sad' : 'idle'; modeT = 0; };
      const y0 = model.position.y;
      stage.onUpdate((dt, t) => {
        if (!root.parent) return false;
        modeT += dt;
        const ch = mode === 'cheer' && modeT < 2.2, sad = mode === 'sad' && modeT < 2.2;
        const walk = mode === 'walk';
        model.position.y = y0 + (ch ? Math.abs(Math.sin(t * 9)) * 0.35 : walk ? Math.abs(Math.sin(t * 11)) * 0.16 : Math.sin(t * 2.4) * 0.04);
        model.rotation.z = walk ? Math.sin(t * 11) * 0.13 : 0;
        if (walk) { if (parts.al) parts.al.rotation.x = base.al.x + Math.sin(t * 11) * 0.7; if (parts.ar) parts.ar.rotation.x = base.ar.x - Math.sin(t * 11) * 0.7; }
        else { if (parts.al) parts.al.rotation.x = base.al.x; if (parts.ar) parts.ar.rotation.x = base.ar.x; }
        if (parts.al) parts.al.rotation.z = base.al.z + (ch ? -1.2 - Math.sin(t * 18) * 0.5 : sad ? 0.25 : Math.sin(t * 2.4) * 0.12);
        if (parts.ar) parts.ar.rotation.z = base.ar.z + (ch ? 1.2 + Math.sin(t * 18) * 0.5 : sad ? -0.25 : -Math.sin(t * 2.4) * 0.12);
        if (parts.head) { parts.head.rotation.z = base.head.z + (sad ? Math.sin(t * 6) * 0.25 : Math.sin(t * 1.3) * 0.08); parts.head.rotation.x = base.head.x + (sad ? 0.25 : 0); }
      });
    }
    if (opts.scale) root.scale.setScalar(opts.scale);
    stage.add(root);
    return out;
  };

  // ------------------------------------------------------------------ building blocks
  /** sRGB hex → correctly lit standard material (hex colours are authored in sRGB). */
  HC3D.mat = function (hex, o = {}) {
    const { emissiveHex, emissiveIntensity, ...rest } = o;
    const m = new T.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0 }, rest));
    m.color = new T.Color(hex).convertSRGBToLinear();
    if (emissiveHex != null) { m.emissive = new T.Color(emissiveHex).convertSRGBToLinear(); m.emissiveIntensity = emissiveIntensity || 1; }
    return m;
  };
  /** Box with rounded edges (port of three's RoundedBoxGeometry, no uv fix-up). */
  HC3D.roundedBox = function (w = 1, h = 1, d = 1, r = 0.1, seg = 2) {
    seg = seg * 2 + 1; r = Math.min(w / 2, h / 2, d / 2, r);
    const g = new T.BoxGeometry(1, 1, 1, seg, seg, seg).toNonIndexed();
    const pos = g.attributes.position.array, nor = g.attributes.normal.array;
    const box = new T.Vector3(w, h, d).divideScalar(2).subScalar(r), p = new T.Vector3(), n = new T.Vector3(), half = 0.5 / seg;
    for (let j = 0; j < pos.length; j += 3) {
      p.fromArray(pos, j); n.copy(p);
      n.x -= Math.sign(n.x) * half; n.y -= Math.sign(n.y) * half; n.z -= Math.sign(n.z) * half; n.normalize();
      pos[j] = box.x * Math.sign(p.x) + n.x * r; pos[j + 1] = box.y * Math.sign(p.y) + n.y * r; pos[j + 2] = box.z * Math.sign(p.z) + n.z * r;
      nor[j] = n.x; nor[j + 1] = n.y; nor[j + 2] = n.z;
    }
    // planar UVs per face (BoxGeometry's own UVs get squeezed into the middle segment by the rounding above)
    const uv = g.attributes.uv.array, size = [w, h, d], AX = { x: 0, y: 1, z: 2 };
    const PL = [['z', 'y', -1, -1], ['z', 'y', 1, -1], ['x', 'z', 1, 1], ['x', 'z', 1, -1], ['x', 'y', 1, -1], ['x', 'y', -1, -1]];
    for (const grp of g.groups) {
      const [ua, va, ud, vd] = PL[grp.materialIndex], ui = AX[ua], vi = AX[va];
      for (let i = grp.start; i < grp.start + grp.count; i++) { uv[i * 2] = pos[i * 3 + ui] / size[ui] * ud + .5; uv[i * 2 + 1] = .5 - pos[i * 3 + vi] / size[vi] * vd; }
    }
    g.attributes.uv.needsUpdate = true;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    return g;
  };
  /** Rounded rectangle Shape (for doors, signs, windows). */
  HC3D.roundRectShape = function (w, h, r, archTop) {
    const s = new T.Shape(), x = -w / 2, y = 0;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    if (archTop) { s.lineTo(x + w, y + h - w / 2); s.absarc(0, y + h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(x, y + r); }
    else { s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); }
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  /**
   * Hue-shift the green parts of an object's textures (e.g. turn a tree into a pink blossom tree).
   * variant: { hue: 0..360 target hue, sat: multiplier, light: offset } — results are cached per source image.
   */
  const recolorCache = new Map();
  HC3D.recolor = function (obj, variant, test = (h, s) => h > 60 && h < 175 && s > 0.12) {
    obj.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map(m => {
        if (!m.map || !m.map.image) { const c = m.clone(); return c; }
        const img = m.map.image, key = (img.src || img.uuid || (img.uuid = Math.random().toString(36))) + JSON.stringify(variant);
        let tex = recolorCache.get(key);
        if (!tex) {
          const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
          const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
          const id = cx.getImageData(0, 0, cv.width, cv.height), px = id.data;
          for (let i = 0; i < px.length; i += 4) {
            const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
            if (!d) continue;
            const s = d / (1 - Math.abs(2 * l - 1));
            let hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360;
            if (!test(hh, s)) continue;
            const nh = variant.hue + (hh - 120) * (variant.spread == null ? 0.35 : variant.spread), ns = Math.min(1, s * (variant.sat || 1)), nl = Math.min(0.95, l + (variant.light || 0));
            const c = (1 - Math.abs(2 * nl - 1)) * ns, hp = ((nh % 360) + 360) % 360 / 60, x = c * (1 - Math.abs(hp % 2 - 1)), m0 = nl - c / 2;
            const [r1, g1, b1] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
            px[i] = (r1 + m0) * 255; px[i + 1] = (g1 + m0) * 255; px[i + 2] = (b1 + m0) * 255;
          }
          cx.putImageData(id, 0, 0);
          tex = new T.CanvasTexture(cv); tex.flipY = m.map.flipY; tex.encoding = m.map.encoding; tex.wrapS = m.map.wrapS; tex.wrapT = m.map.wrapT;
          tex.magFilter = m.map.magFilter; tex.minFilter = m.map.minFilter;
          recolorCache.set(key, tex);
        }
        const c = m.clone(); c.map = tex; return c;
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
    return obj;
  };
  /** Canvas → texture in sRGB. */
  HC3D.canvasTex = function (cv, o = {}) {
    const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    if (o.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
    return t;
  };

  // ------------------------------------------------------------------ props & effects
  HC3D.prop = async function (stage, key, opts = {}) {
    const g = await HC3D.load(key);
    const o = HC3D.clone(g);
    const holder = new T.Group(); holder.add(o);
    if (opts.faceCamera) o.rotation.x = Math.PI / 2; // coins lie flat in the model
    if (opts.scale) holder.scale.setScalar(opts.scale);
    if (opts.pos) holder.position.copy(opts.pos);
    stage.add(holder);
    if (opts.spin || opts.bob) {
      const p0 = holder.position.clone(), ph = Math.random() * 6.28;
      stage.onUpdate((dt, t) => {
        if (!holder.parent) return false;
        if (opts.spin) holder.rotation.y += dt * opts.spin;
        if (opts.bob) holder.position.y = p0.y + Math.sin(t * 2 + ph) * opts.bob;
      });
    }
    return holder;
  };

  HC3D.decor = async function (stage, key, opts = {}) {
    const h = await HC3D.prop(stage, key, opts);
    h.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); if (opts.opacity != null) { o.material.transparent = true; o.material.opacity = opts.opacity; } } });
    return h;
  };

  /** Burst of spinning 3D coins in an ortho (pixel) stage from (x0,y0) to (x1,y1). */
  HC3D.coinBurst = async function (stage, from, to, n = 12, opts = {}) {
    const g = await HC3D.load(opts.key || 'bgb_coin_gold');
    const size = opts.size || 46;
    const coins = [];
    for (let i = 0; i < n; i++) {
      const c = HC3D.clone(g); const h = new T.Group(); h.add(c);
      c.rotation.x = Math.PI / 2 * (0.6 + Math.random() * 0.4);
      h.scale.setScalar(size); h.position.set(from.x, -from.y, 200 + i);
      stage.add(h);
      const spread = opts.spread == null ? 160 : opts.spread;
      coins.push({ h, delay: i * 0.035, mid: { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * spread * 2, y: Math.min(from.y, to.y) - 90 - Math.random() * spread }, spin: 6 + Math.random() * 8, done: false });
    }
    const dur = opts.duration || 0.85;
    let t = 0;
    return new Promise(res => {
      stage.onUpdate(dt => {
        t += dt; let alive = 0;
        for (const k of coins) {
          const u = Math.min(1, Math.max(0, (t - k.delay) / dur));
          if (u >= 1) { if (!k.done) { k.done = true; stage.remove(k.h); opts.onEach && opts.onEach(); } continue; }
          alive++;
          const e = u * u * (3 - 2 * u);
          const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * k.mid.x + e * e * to.x;
          const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * k.mid.y + e * e * to.y;
          k.h.position.set(x, -y, 200);
          k.h.rotation.y += dt * k.spin; k.h.rotation.z += dt * 2;
          const s = size * (u < 0.15 ? 0.5 + u / 0.15 * 0.6 : 1.1 - (u - 0.15) * 0.4);
          k.h.scale.setScalar(s);
        }
        if (!alive && t > dur) { res(); return false; }
      });
    });
  };

  /** Coin rain over the whole ortho stage (victory). */
  HC3D.coinRain = async function (stage, n = 40, w = 1920, h = 1080) {
    const keys = ['bgb_coin_gold', 'bgb_coin_10_gold', 'mini_star', 'mini_diamond_blue', 'mini_heart_red'];
    const gs = await Promise.all(keys.map(HC3D.load));
    const items = [];
    for (let i = 0; i < n; i++) {
      const k = i % 5 === 0 ? (2 + (i % 3)) : (i % 2);
      const o = HC3D.clone(gs[k]); const hld = new T.Group(); hld.add(o);
      if (k < 2) o.rotation.x = Math.PI / 2;
      const s = k < 2 ? 50 + Math.random() * 20 : 34 + Math.random() * 14;
      hld.scale.setScalar(s);
      hld.position.set(Math.random() * w, 120 + Math.random() * 500, 300);
      stage.add(hld);
      items.push({ hld, vy: 300 + Math.random() * 400, vx: (Math.random() - 0.5) * 160, rs: (Math.random() - 0.5) * 10 });
    }
    return new Promise(res => {
      let t = 0;
      stage.onUpdate(dt => {
        t += dt;
        for (const it of items) { it.vy += 900 * dt; it.hld.position.y -= it.vy * dt; it.hld.position.x += it.vx * dt; it.hld.rotation.y += it.rs * dt; it.hld.rotation.x += it.rs * 0.5 * dt; }
        if (t > 3) { items.forEach(it => stage.remove(it.hld)); res(); return false; }
      });
    });
  };

  /** Pastel podium (cylinder with a ring) for perspective stages. */
  HC3D.podium = function (stage, colorTop = 0xffb3d1, colorSide = 0xff6fa8) {
    const g = new T.Group();
    const top = new T.Mesh(new T.CylinderGeometry(1.9, 2.05, 0.38, 64), new T.MeshStandardMaterial({ color: new T.Color(colorSide).convertSRGBToLinear(), roughness: 0.55, metalness: 0.05 }));
    top.receiveShadow = true; g.add(top);
    const cap = new T.Mesh(new T.CylinderGeometry(1.75, 1.75, 0.06, 64), new T.MeshStandardMaterial({ color: new T.Color(colorTop).convertSRGBToLinear(), roughness: 0.75 }));
    cap.position.y = 0.21; cap.receiveShadow = true; g.add(cap);
    const ring = new T.Mesh(new T.TorusGeometry(1.98, 0.07, 16, 96), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0xffe0f0, emissiveIntensity: 0.3 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    g.position.y = -0.2;
    stage.add(g);
    return g;
  };
})();
