/* Lô Tô 3D — Vietnamese 90-ball bingo. Everyone buys a ticket (3 rows × 9 columns, 5 numbers per row), a wire drum spins,
 * one ball pops out every ~2 s and the caller shouts it. Mark your ticket (or switch on "Tự dò"); the first full row wins:
 * press KINH! — the claim is checked against what you really marked. Winners share 90% of the pot.
 * Pure rules: js/games3d/rules/lo-to.js (tests: tests/lo-to.test.js). */
(function () {
  'use strict';
  // ---- layout (rect table 18 × 11, camera side = +z)
  const DRUM = { x: -5.75, y: 1.55, z: -1.75, r: 1.1, len: 2.4 };
  const PED = { x: 0, z: -2.75, h: .46 };
  const TRAY = { x0: 1.5, z: -3.35, step: .7, n: 8 };
  const POT = { x: -2.35, z: -3.9 };
  const BALL_R = .3, BIG = 2.2;
  const TK = { x: 0, z: 2.25, cw: 1.08, ch: .98, tilt: .3, mx: .3, top: .92, bottom: .3 };
  TK.W = 9 * TK.cw + 2 * TK.mx; TK.D = TK.top + 3 * TK.ch + TK.bottom;
  const PRICES = [1000, 5000, 10000, 50000, 100000];
  const DRAW_MS = 2200;
  const COLC = ['#ff5c9a', '#ff8a4c', '#f5a400', '#2fbf83', '#2f9bff', '#7d5cff', '#e0446a', '#14a3a3', '#b45cff'];
  const COLD = ['#d9286a', '#e0561a', '#c07a00', '#12935d', '#1f6fd0', '#5233cc', '#b81f48', '#0b7a7a', '#8a2fd0'];   // darker shades for numbers on tickets
  const THEMES = { pink: ['#ffc4dc', '#ff8fbf', '#b0306e', '#ff5c9a'], mint: ['#bff3dd', '#4fd3a0', '#168a60', '#22b57a'], sky: ['#c9e6ff', '#6fbfff', '#1f62b0', '#3d8bff'], lemon: ['#ffeaa6', '#ffc93c', '#9a6200', '#f0a400'] };
  const TALK = {
    buy: ['Mua vé nè! 🎫', 'Ván này kinh chắc luôn 😎', 'Vé đẹp quá trời 🥰', 'Hên hên hên 🙏'],
    near: ['Chờ 1 số thôi! 😬', 'Sắp kinh rồi nha!', 'Run quá trời ơi 🫣', 'Gọi số của tui đi mà 🙏'],
    kinh: ['KINH!!! 🎉', 'Kinh rồi nè! 🥳', 'Ố là la, KINH! 🤩'],
    lose: ['Tiếc ghê, chờ có 1 số 😭', 'Ván sau gỡ! 😤', 'Hên quá ha 😒'],
  };

  T3.register('lo-to', {
    title: 'Lô Tô', sub: 'Dò số · 5 số một hàng là KINH!', stakeName: 'Giá vé',
    table: 'rect', theme: 'mint', tex: ['lo-to', 'chips'], scripts: ['js/games3d/rules/lo-to.js'], models: ['hp_monstera', 'hp_yucca', 'hp_pothos', 'pp_lantern'],
    cam: { pos: [0, 11.6, 14.6], look: [0, 0, -.15] },
    rules: `<p>Mỗi người mua <b>một vé</b> (chọn giá vé bên trái). Vé có <b>3 hàng × 9 cột</b>, mỗi hàng <b>5 số</b>; cột 1 là số 1–9, cột 2 là 10–19, … cột cuối là 80–90.</p>
      <p>Lồng cầu quay, mỗi lần ra một bi từ <b>1 đến 90</b> và người hô đọc số. Chạm vào số trên vé để <b>đánh dấu</b> (chạm lần nữa để bỏ). Bật <b>Tự dò</b> để máy đánh dấu giùm.</p>
      <ul><li>Ai đủ <b>5 số trên một hàng ngang</b> trước thì bấm <b>KINH!</b>. Nhà cái sẽ <b>dò vé</b>: các số phải được gọi rồi và được bạn đánh dấu, sai thì không tính.</li>
      <li>Hũ = tiền vé của cả bàn. Người kinh nhận <b>90%</b> hũ (nhà cái giữ 10%). Nhiều người kinh cùng lúc thì <b>chia đều</b>.</li>
      <li>Có người kinh thì bàn ngừng quay để dò vé: ai khác cũng đủ hàng thì bấm KINH ngay lúc đó để được chia.</li></ul>`,
    async start(ctx) { const g = await setup(ctx, false); for (;;) await g.round(ctx.Q.has('demo') ? { demo: true, toEnd: ctx.Q.get('demo') === 'end' } : {}); },
    async selftest(ctx) { const g = await setup(ctx, true); return g.selftest(); },
  });

  // ------------------------------------------------------------------ helpers
  function css(id, text) { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = text; document.head.appendChild(s); }
  const loadImg = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  function fitCamera(ctx, base) {
    const apply = () => {
      const cam = ctx.camera, asp = cam.aspect, tanV = Math.tan(cam.fov * Math.PI / 360), need = Math.tan(20 * Math.PI / 180) * 16 / 9;
      const k = Math.max(1, need / (tanV * asp)), t = Math.max(0, Math.min(1, (16 / 9 - asp) / (16 / 9 - 1)));
      const off = base.pos.map((p, i) => p - base.look[i]), horiz = Math.hypot(off[0], off[2]) || 1, len = Math.hypot(...off) * k * (1 - t * .1);
      const el = Math.atan2(off[1], horiz) + t * .28, look = [base.look[0], base.look[1], base.look[2] + t * .9];   // narrow windows: look a bit more from above
      ctx.camTo({ pos: [look[0] + off[0] / horiz * Math.cos(el) * len, look[1] + Math.sin(el) * len, look[2] + off[2] / horiz * Math.cos(el) * len], look }, 0);
    };
    const orig = ctx.resize.bind(ctx); ctx.resize = (...a) => { orig(...a); apply(); }; apply();
  }

  const anim = (ctx, ms, step) => new Promise(res => { const t0 = performance.now(), dur = Math.max(1, ms * ctx.timeScale); ctx.onFrame(() => { const k = Math.min(1, (performance.now() - t0) / dur); step(k); if (k >= 1) { res(); return false; } }); });
  function outlineText(x, text, cx, cy, size, ink, font = 'Grandstander Black', fill = '#fff') {
    x.font = `400 ${size}px "${font}"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.strokeStyle = '#fff'; x.lineWidth = size * .3; x.strokeText(text, cx, cy);
    x.strokeStyle = ink; x.lineWidth = size * .17; x.strokeText(text, cx, cy);
    x.fillStyle = fill; x.fillText(text, cx, cy);
  }

  /** A label target that stays clear of the top bar (title box, coin pill, buttons): first a small sideways nudge, else it slides down. */
  function clearOfTopBar(ctx, el, base, extraTop = 18) {
    const T = ctx.THREE, sel = ['#back', '#where', '#top .pill', '#rulesBtn', '#sndBtn'];
    return () => {
      const p = ctx.toUI(base), w = el.offsetWidth || 220, hgt = (el.offsetHeight || 80) + extraTop, u = ctx.uiScale || 1;
      const rects = sel.map(s => document.querySelector(s)).filter(Boolean).map(n => { const r = n.getBoundingClientRect(); return { l: r.left / u - 8, r: r.right / u + 8, b: r.bottom / u + 8 }; });
      const hits = (x, y) => rects.filter(r => y - hgt < r.b && x + w / 2 > r.l && x - w / 2 < r.r);
      const now = hits(p.x, p.y);
      if (!now.length) return base;
      for (const r of now) for (const nx of [r.l - w / 2, r.r + w / 2]) {
        if (Math.abs(nx - p.x) > 90 || hits(nx, p.y).length) continue;
        const q = ctx.toUI(new T.Vector3(base.x + 1, base.y, base.z)), ppx = q.x - p.x || 1;
        return new T.Vector3(base.x + (nx - p.x) / ppx, base.y, base.z);
      }
      const minY = Math.max(...now.map(r => r.b + hgt)), q = ctx.toUI(new T.Vector3(base.x, base.y - 1, base.z)), ppu = Math.max(1, q.y - p.y);
      return new T.Vector3(base.x, base.y - (minY - p.y) / ppu, base.z);
    };
  }

  /** Simulate a finger tap on the canvas at a 3D point (exercises the real picking path in self-tests). */
  function tapAt(ctx, v3) {
    const cv = ctx.el.canvas, r = cv.getBoundingClientRect(), v = v3.clone().project(ctx.camera);
    const o = { clientX: r.left + (v.x + 1) / 2 * r.width, clientY: r.top + (1 - v.y) / 2 * r.height, bubbles: true, pointerId: 1, pointerType: 'mouse' };
    cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o));
  }

  // ------------------------------------------------------------------ the game
  async function setup(ctx, test) {
    const T = ctx.THREE, H = ctx.H, R = window.Rules['lo-to'], rand = ctx.rand;
    ctx.music('loto');
    fitCamera(ctx, ctx.def.cam);
    css('lt-css', `
      .lt-board{position:absolute;right:16px;top:132px;padding:12px 14px 14px;border-radius:30px;display:flex;flex-direction:column;gap:8px;align-items:center}
      .lt-board .hd{font:400 26px "Grandstander Black";color:#168a60}.lt-board .hd span{font:800 22px "Baloo 2";color:#7a5a6e;margin-left:8px}
      .lt-board .grid{display:grid;grid-template-columns:repeat(10,28px);gap:3px;padding:8px;border-radius:18px;background:#effcf6;box-shadow:inset 0 0 0 3px #c9f5e3}
      .lt-board .grid i{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:400 14px "Grandstander Black";font-style:normal;color:#b9cfc6;background:#fff}
      .lt-board .grid i.on{color:#fff;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18)}
      .lt-board .grid i.last{animation:ltpulse .8s ease-in-out infinite alternate;outline:3px solid #ffd23c}
      @keyframes ltpulse{to{transform:scale(1.25)}}
      .lt-call{position:absolute;left:16px;top:50%;transform:translateY(-50%);width:270px;padding:18px 16px 16px;border-radius:34px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
      .lt-call .ball{width:150px;height:150px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:inset -10px -14px 0 rgba(0,0,0,.16),inset 8px 10px 0 rgba(255,255,255,.35),0 8px 16px rgba(60,10,50,.25)}
      .lt-call .ball b{width:96px;height:96px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font:400 58px "Grandstander Black";color:#5a2342}
      .lt-call .ball.pop{animation:ltpop .45s cubic-bezier(.2,1.6,.4,1)}
      @keyframes ltpop{from{transform:scale(.3) rotate(-30deg)}}
      .lt-call .ph{font:800 25px/1.18 "Baloo 2";color:#5a2342;min-height:60px}
      .lt-call .ct{font:800 20px "Baloo 2";color:#8a6a80}
      .lt-call .hd{font:400 24px "Grandstander Black";color:#168a60}
      .lt-call .mine{padding:4px 16px;border-radius:18px;background:#effcf6;font:800 21px "Baloo 2";color:#168a60}.lt-call .mine b{font:400 22px "Grandstander Black"}
      .lt-call .mine.hot{background:#ff4f95;color:#fff;animation:ltblink .6s ease-in-out infinite alternate}
      .lt-w{position:absolute;left:50%;bottom:-26px;transform:translateX(-50%);padding:1px 14px;border-radius:14px;background:#fff;border:3px solid #c9f5e3;font:800 20px "Baloo 2";color:#168a60;line-height:1.2;font-style:normal;white-space:nowrap}
      .lt-w:empty{display:none}
      .lt-w.hot{color:#fff;background:#ff4f95;border-color:#fff;animation:ltblink .6s ease-in-out infinite alternate}
      @keyframes ltblink{to{opacity:.55}}
      .lt-pot{padding:4px 18px;border-radius:20px;font:400 24px "Grandstander Black";color:#a86d00;background:#fff;border:3px solid #ffe27a;box-shadow:0 4px 0 rgba(168,109,0,.35);text-align:center;line-height:1.1}
      .lt-pot small{display:block;font:800 17px "Baloo 2";color:#8a6a80}
      .gbtn.lt-hot{animation:lthot .5s ease-in-out infinite alternate}
      .lt-board.lt-narrow{transform:scale(.72);transform-origin:top right}.lt-call.lt-narrow{transform:translateY(-50%) scale(.8);transform-origin:left center}
      @keyframes lthot{to{transform:scale(1.1);filter:brightness(1.15) drop-shadow(0 0 14px #ffe27a)}}
    `);
    await Promise.race([Promise.all(['400 80px "Grandstander Black"', '800 40px "Baloo 2"', '400 40px "Grandstander Black"'].map(f => document.fonts.load(f))), ctx.wait(1500)]);
    const heartImg = await loadImg((window.HC_TEX || {}).lt_heart);

    // ---------------------------------------------------------------- balls
    const ballTexCache = {};
    function ballTex(n) {
      if (ballTexCache[n]) return ballTexCache[n];
      const col = COLC[R.colOf(n)];
      return (ballTexCache[n] = T3.canvasTex(256, 128, (x, w, h) => {
        x.fillStyle = col; x.fillRect(0, 0, w, h);
        x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, h * .2, w, h * .06); x.fillRect(0, h * .74, w, h * .06);
        for (const cx of [64, 192]) { x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, 64, 33, 0, 7); x.fill(); x.fillStyle = '#4a1d38'; x.font = `400 ${n > 9 ? 36 : 42}px "Grandstander Black"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), cx, 67); }
      }));
    }
    const ballGeo = new T.SphereGeometry(BALL_R, 32, 20);
    function makeBall(n) {
      const m = new T.Mesh(ballGeo, new T.MeshStandardMaterial({ map: ballTex(n), roughness: .28, metalness: .05, emissive: 0xffffff, emissiveMap: ballTex(n), emissiveIntensity: .12 }));
      m.castShadow = true; m.userData.n = n; return m;
    }

    // ---------------------------------------------------------------- the drum (lồng cầu)
    const drum = new T.Group(); drum.position.set(DRUM.x, DRUM.y, DRUM.z); ctx.add(drum);
    const cage = new T.Group(); drum.add(cage);
    const gold = ctx.mat(0xffc93c, { roughness: .3, metalness: .55 }), pinkM = ctx.mat(0xff8fc0, { roughness: .35, metalness: .2 }), white = ctx.mat(0xffffff, { roughness: .35 });
    for (let i = 0; i <= 4; i++) { const ring = new T.Mesh(new T.TorusGeometry(DRUM.r, i % 4 ? .035 : .06, 8, 48), i % 4 ? pinkM : gold); ring.rotation.y = Math.PI / 2; ring.position.x = -DRUM.len / 2 + i * DRUM.len / 4; ring.castShadow = true; cage.add(ring); }
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, bar = new T.Mesh(new T.CylinderGeometry(.025, .025, DRUM.len, 6), i % 2 ? gold : pinkM); bar.rotation.z = Math.PI / 2; bar.position.set(0, Math.cos(a) * DRUM.r, Math.sin(a) * DRUM.r); bar.castShadow = true; cage.add(bar); }
    for (const sx of [-1, 1]) { const hub = new T.Mesh(new T.CylinderGeometry(.24, .24, .12, 20), white); hub.rotation.z = Math.PI / 2; hub.position.x = sx * DRUM.len / 2; cage.add(hub); for (let k = 0; k < 6; k++) { const sp = new T.Mesh(new T.CylinderGeometry(.02, .02, DRUM.r * 2, 5), gold); sp.position.x = sx * DRUM.len / 2; sp.rotation.x = k * Math.PI / 6; cage.add(sp); } }
    const crank = new T.Group(); crank.position.x = -DRUM.len / 2 - .5; cage.add(crank);
    { const arm = new T.Mesh(H.roundedBox(.12, .9, .12, .05, 2), pinkM); arm.position.y = .4; crank.add(arm); const knob = new T.Mesh(new T.SphereGeometry(.14, 16, 12), white); knob.position.set(-.18, .82, 0); crank.add(knob); }
    const axle = new T.Mesh(new T.CylinderGeometry(.07, .07, DRUM.len + 1.2, 12), white); axle.rotation.z = Math.PI / 2; drum.add(axle);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = new T.Mesh(H.roundedBox(.14, DRUM.y + .2, .14, .05, 2), pinkM); leg.position.set(sx * (DRUM.len / 2 + .32), -(DRUM.y) / 2 + .02, sz * .42); leg.rotation.x = -sz * .45; leg.castShadow = true; drum.add(leg); }
    const dbase = new T.Mesh(H.roundedBox(DRUM.len + 1.3, .14, 2.0, .07, 2), ctx.mat(0xfff6fb, { roughness: .5 })); dbase.position.y = -DRUM.y + .07; dbase.castShadow = dbase.receiveShadow = true; drum.add(dbase);
    // chute where the drawn ball rolls out
    const chute = new T.Mesh(H.roundedBox(1.0, .1, .5, .05, 2), white); chute.position.set(DRUM.len / 2 + .55, -DRUM.y + .55, .55); chute.rotation.z = -.5; chute.castShadow = true; drum.add(chute);
    const OUTLET = new T.Vector3(DRUM.x + DRUM.len / 2 + .2, DRUM.y - .5, DRUM.z + .55), CHUTE_END = new T.Vector3(DRUM.x + DRUM.len / 2 + 1.15, BALL_R, DRUM.z + .55);
    // balls tumbling inside
    const inner = new T.Group(); drum.add(inner);
    const tumble = Array.from({ length: 24 }, (_, i) => { const n = 1 + Math.floor(rand() * 90), b = new T.Mesh(new T.SphereGeometry(.19, 14, 10), ctx.mat(new T.Color(COLC[R.colOf(n)]).getHex(), { roughness: .3 })); inner.add(b); return { b, x: -DRUM.len / 2 + .3 + (i % 8) / 7 * (DRUM.len - .6), ph: rand() * 6, f: .8 + rand() * 1.4, a: .5 + rand() * .7 }; });
    let spinBoost = 0, spinT = 0;
    ctx.onFrame((dt, t) => {
      const sp = .7 + spinBoost * 7; cage.rotation.x += dt * sp;
      spinT += dt * (1 + spinBoost * 2.5);
      for (const q of tumble) { const amp = q.a + spinBoost * 2.2, ang = Math.sin(spinT * q.f + q.ph) * amp + spinBoost * spinT * 1.5, rr = DRUM.r - .26 - .12 * Math.abs(Math.cos(spinT * q.f * 1.7 + q.ph)); q.b.position.set(q.x + Math.sin(spinT * .6 + q.ph) * .12, -rr * Math.cos(ang), rr * Math.sin(ang)); }
    });

    // ---------------------------------------------------------------- pedestal, tray, pot
    const ped = new T.Group(); ped.position.set(PED.x, 0, PED.z); ctx.add(ped);
    { const c = new T.Mesh(new T.CylinderGeometry(.5, .62, PED.h, 28), pinkM); c.position.y = PED.h / 2; c.castShadow = c.receiveShadow = true; ped.add(c); const rim = new T.Mesh(new T.TorusGeometry(.5, .07, 10, 32), gold); rim.rotation.x = Math.PI / 2; rim.position.y = PED.h; ped.add(rim); }
    const trayLen = TRAY.n * TRAY.step + .5, tray = new T.Group(); tray.position.set(TRAY.x0 + (TRAY.n - 1) * TRAY.step / 2, 0, TRAY.z); ctx.add(tray);
    { const b = new T.Mesh(H.roundedBox(trayLen, .16, .86, .08, 2), ctx.mat(0xfff6fb, { roughness: .5 })); b.position.y = .08; b.castShadow = b.receiveShadow = true; tray.add(b); for (const sz of [-1, 1]) { const rail = new T.Mesh(H.roundedBox(trayLen, .14, .1, .05, 2), pinkM); rail.position.set(0, .22, sz * .38); tray.add(rail); } }
    let potStack = null, potLabel = null;

    // ---------------------------------------------------------------- tickets
    function drawTicket(x, w, h, tk, theme, price, small) {
      const [c1, c2, ink, deep] = THEMES[theme], u = w / TK.W, k = w / 1500;     // u: px per table unit, k: px scale vs. the full-size canvas
      x.fillStyle = c2; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff'; T3.rr(x, 12 * k, 12 * k, w - 24 * k, h - 24 * k, 32 * k); x.fill();
      const hh = (TK.top - .2) * u, hg = x.createLinearGradient(0, 0, 0, hh); hg.addColorStop(0, c2); hg.addColorStop(1, deep);
      x.fillStyle = hg; T3.rr(x, 22 * k, 22 * k, w - 44 * k, hh, 24 * k); x.fill();
      if (!small) {
        const cy = 22 * k + hh / 2;
        outlineText(x, 'VÉ LÔ TÔ', w * .17, cy + 3 * k, hh * .62, ink);
        x.font = `800 ${Math.round(hh * .46)}px "Baloo 2"`; x.fillStyle = '#fff'; x.textAlign = 'right'; x.textBaseline = 'middle';
        x.fillText(price ? `Giá vé ${HC.short(price)}` : 'Chưa mua vé', w - 50 * k, cy + 3 * k);
        if (heartImg) for (let i = 0; i < 3; i++) x.drawImage(heartImg, w * .38 + i * 80 * k, cy - 30 * k, 60 * k, 60 * k);
      }
      for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) {
        const cx = (TK.mx + c * TK.cw) * u, cy = (TK.top + r * TK.ch) * u, n = tk.rows[r][c], pad = 6 * k, cw = TK.cw * u - 2 * pad, ch = TK.ch * u - 2 * pad;
        if (n == null) {
          x.fillStyle = c1; T3.rr(x, cx + pad, cy + pad, cw, ch, 16 * k); x.fill();
          if (heartImg && !small) { x.globalAlpha = .55; const s = ch * .42; x.drawImage(heartImg, cx + pad + cw / 2 - s / 2, cy + pad + ch / 2 - s / 2, s, s); x.globalAlpha = 1; }
        } else {
          x.fillStyle = '#fff'; x.strokeStyle = c2; x.lineWidth = 5 * k; T3.rr(x, cx + pad, cy + pad, cw, ch, 16 * k); x.fill(); x.stroke();
          x.fillStyle = small ? ink : COLD[c]; x.font = `400 ${Math.round(ch * .62)}px "Grandstander Black"`; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText(String(n), cx + pad + cw / 2, cy + pad + ch / 2 + ch * .06);
        }
      }
      x.strokeStyle = c2; x.lineWidth = 4 * k; x.setLineDash([12 * k, 9 * k]);
      for (let r = 1; r < 3; r++) { const y = (TK.top + r * TK.ch) * u; x.beginPath(); x.moveTo(TK.mx * u, y); x.lineTo(w - TK.mx * u, y); x.stroke(); }
      x.setLineDash([]);
    }
    const cellPos = (r, c) => ({ x: -TK.W / 2 + TK.mx + (c + .5) * TK.cw, z: -TK.D / 2 + TK.top + (r + .5) * TK.ch });
    /** A ticket lying on the table, tilted toward its owner: { g, face, setTicket(tk, price), markers } */
    function ticketMesh(theme, scale, pos, ry = 0) {
      const g = new T.Group(); g.position.copy(pos); g.rotation.order = 'YXZ'; g.rotation.y = ry; g.rotation.x = TK.tilt; g.scale.setScalar(scale);
      g.position.y = Math.sin(TK.tilt) * TK.D / 2 * scale + .1 * scale;
      const base = new T.Mesh(H.roundedBox(TK.W + .1, .14, TK.D + .1, .1, 2), ctx.mat(0xffffff, { roughness: .5 })); base.position.y = -.07; base.castShadow = true; base.receiveShadow = true; g.add(base);
      const face = new T.Mesh(new T.PlaneGeometry(TK.W, TK.D), new T.MeshStandardMaterial({ roughness: .85, emissive: 0xffffff, emissiveIntensity: .03 })); face.rotation.x = -Math.PI / 2; face.position.y = .005; face.receiveShadow = true; g.add(face);
      ctx.add(g);
      // a little easel under the raised far edge (its top touches the underside of the tilted ticket)
      const sn = Math.sin(TK.tilt), cs = Math.cos(TK.tilt), zl = -TK.D / 2 + .7, under = g.position.y + scale * (-.14 * cs - zl * sn), pz = pos.z + scale * (-.14 * sn + zl * cs);
      const prop = new T.Mesh(H.roundedBox(TK.W * .78 * scale, under, .5 * scale, .1 * scale, 2), ctx.mat(new T.Color(THEMES[theme][1]).getHex(), { roughness: .5 }));
      prop.position.set(pos.x, under / 2, pz); prop.castShadow = prop.receiveShadow = true; ctx.add(prop);
      const out = { g, face, markers: {}, theme };
      out.setTicket = (tk, price) => {
        out.tk = tk; const res = scale < .5 ? 520 : 1500;
        if (face.material.map) face.material.map.dispose();
        const tex = T3.canvasTex(res, Math.round(res * TK.D / TK.W), (x, w, h) => drawTicket(x, w, h, tk, theme, price, scale < .5));
        face.material.map = tex; face.material.emissiveMap = tex; face.material.needsUpdate = true;
        Object.values(out.markers).forEach(m => g.remove(m)); out.markers = {};
      };
      return out;
    }
    const heartTex = ctx.tex('lt_heart');
    const discGeo = new T.CylinderGeometry(.42, .42, .04, 28), ringGeo = new T.TorusGeometry(.42, .05, 8, 28), heartGeo = new T.PlaneGeometry(.42, .42);
    const discMat = new T.MeshStandardMaterial({ color: new T.Color(0xff6fa8).convertSRGBToLinear(), transparent: true, opacity: .38, roughness: .3, depthWrite: false });
    const ringMat = ctx.mat(0xff4f95, { roughness: .35 });
    const heartMat = new T.MeshStandardMaterial({ map: heartTex, transparent: true, alphaTest: .2, roughness: .4, emissive: 0xffffff, emissiveMap: heartTex, emissiveIntensity: .2 });
    function addMarker(tm, n, big, animate) {
      if (tm.markers[n]) return tm.markers[n];
      let rc = null; tm.tk.rows.forEach((row, r) => row.forEach((v, c) => { if (v === n) rc = [r, c]; }));
      if (!rc) return null;
      const p = cellPos(rc[0], rc[1]), m = new T.Group();
      const disc = new T.Mesh(discGeo, discMat); m.add(disc);
      const ring = new T.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = .02; m.add(ring);
      const heart = new T.Mesh(heartGeo, heartMat); heart.rotation.x = -Math.PI / 2; heart.position.set(.3, .06, -.26); m.add(heart);
      if (!big) m.scale.setScalar(.9);
      m.position.set(p.x, .05, p.z); m.rotation.y = (rand() - .5) * .3; tm.g.add(m); tm.markers[n] = m;
      if (animate) { m.position.y = 1.4; ctx.tween(m, { y: .05 }, 380, 'bounce'); }
      return m;
    }
    function removeMarker(tm, n) { const m = tm.markers[n]; if (!m) return; delete tm.markers[n]; ctx.tween(m, { y: .9, s: .2 }, 200, 'in').then(() => tm.g.remove(m)); }

    const mine = ticketMesh('pink', 1, new T.Vector3(TK.x, 0, TK.z));
    // row highlight bars on my ticket (lit when a row is fully marked)
    const rowBars = [0, 1, 2].map(r => { const b = new T.Mesh(H.roundedBox(TK.W - .3, .04, TK.ch - .06, .05, 2), new T.MeshBasicMaterial({ color: 0xfff06a, transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); b.position.set(0, .012, cellPos(r, 0).z); mine.g.add(b); return b; });
    const hover = new T.Mesh(H.roundedBox(TK.cw - .04, .03, TK.ch - .04, .1, 2), new T.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: .55, toneMapped: false, depthWrite: false })); hover.visible = false; mine.g.add(hover);

    // ---------------------------------------------------------------- players
    const seats = await ctx.seats(4, { angles: [90, 235, 270, 305], r: 8.2 });
    const me = seats[0], bots = seats.slice(1), botThemes = ['mint', 'sky', 'lemon'];
    bots.forEach((b, i) => {
      const a = b.angle, bx = Math.cos(a) * 9.4, bz = Math.sin(a) * 9.4;
      const ly = (b.key.startsWith('mini') ? 2.3 : 2.7) - (Math.abs(bx) < 1 ? .3 : 0);
      b.label.target = clearOfTopBar(ctx, b.label.el, new T.Vector3(bx, ly, bz));
      b.label.el.insertAdjacentHTML('beforeend', '<em class="lt-w"></em>');
      b.waitEl = b.label.el.querySelector('.lt-w');
      const side = bx > 1 ? -1 : 1;
      b._bub = ctx.label(() => new T.Vector3(bx + side * 2.6, 1.5, bz + 1), '', 'bub3');
      b.tm = ticketMesh(botThemes[i], .26, new T.Vector3(Math.cos(a) * 9.4 * .8, 0, -4.78));
      b.idx = i + 1;
    });

    // ---------------------------------------------------------------- HUD
    const board = ctx.ui.h('div', { class: 'lt-board glass' }, ctx.ui.root);
    const caller = ctx.ui.h('div', { class: 'lt-call glass' }, ctx.ui.root);
    let picker = null, price = PRICES[2];
    const layout = () => { const narrow = ctx.UW / ctx.UH < 1.3; board.classList.toggle('lt-narrow', narrow); caller.classList.toggle('lt-narrow', narrow); };
    const resize0 = ctx.resize.bind(ctx); ctx.resize = (...a) => { resize0(...a); layout(); }; layout();
    function drawBoard(drawn) {
      const set = new Set(drawn), last = drawn[drawn.length - 1];
      let html = `<div class="hd">Bảng số<span>${drawn.length} / 90 số</span></div><div class="grid">`;
      for (let n = 1; n <= 90; n++) html += `<i class="${set.has(n) ? 'on' : ''}${n === last ? ' last' : ''}" style="${set.has(n) ? `background:${COLC[R.colOf(n)]}` : ''}">${n}</i>`;
      board.innerHTML = html + '</div>';
    }
    function drawCaller(n, phrase, count) {
      caller.innerHTML = (n ? `<div class="hd">Người hô 🎤</div><div class="ball pop" style="background:${COLC[R.colOf(n)]}"><b>${n}</b></div><div class="ph">${phrase}</div><div class="ct">Số thứ ${count} · còn ${90 - count} bi</div>` : `<div class="hd">Người hô 🎤</div><div class="ball" style="background:#c9f5e3"><b>?</b></div><div class="ph">${phrase || 'Chờ mua vé…'}</div>`) + '<div class="mine"></div>';
      drawMine();
    }
    function drawMine() {
      const el = caller.querySelector('.mine'); if (!el || !mine.tk) return;
      const w = R.waiting(mine.tk, marked);
      el.className = 'mine' + (w <= 1 ? ' hot' : ''); el.innerHTML = w <= 0 ? 'Vé bạn: <b>ĐỦ HÀNG!</b> bấm KINH' : `Vé bạn: chờ <b>${w}</b> số`;
    }
    function setBotWait(b, w, claimed) { b.waitEl.textContent = claimed ? 'KINH! 🎉' : w == null ? '' : w <= 0 ? 'đủ hàng!' : `chờ ${w} số`; b.waitEl.classList.toggle('hot', claimed || (w != null && w <= 1)); }

    // ---------------------------------------------------------------- pointer: tap a number on your ticket
    let phase = 'idle', marked = new Set(), drawn = [], drawnSet = new Set(), autoMark = false, claims = [], tapHandler = null;
    const rc = new T.Raycaster(), ndc = new T.Vector2();
    function cellAt(e) {
      const r = ctx.el.canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); rc.setFromCamera(ndc, ctx.camera);
      const hit = rc.intersectObject(mine.face, false)[0]; if (!hit) return null;
      const lp = mine.g.worldToLocal(hit.point.clone()), c = Math.floor((lp.x + TK.W / 2 - TK.mx) / TK.cw), row = Math.floor((lp.z + TK.D / 2 - TK.top) / TK.ch);
      return c >= 0 && c < 9 && row >= 0 && row < 3 ? { r: row, c, n: mine.tk.rows[row][c] } : null;
    }
    ctx.onPointerMove = e => { const cell = phase === 'draw' || phase === 'check' ? cellAt(e) : null; hover.visible = !!(cell && cell.n != null); if (hover.visible) { const p = cellPos(cell.r, cell.c); hover.position.set(p.x, .02, p.z); } };
    ctx.pickable(mine.g, (pt, e) => { const cell = e ? cellAt(e) : null; if (cell && cell.n != null && tapHandler) tapHandler(cell.n); });

    function updateRows() {
      const done = R.completeRows(mine.tk, marked);
      rowBars.forEach((b, r) => { b.material.opacity = done.includes(r) ? .85 : 0; });
      return done.length > 0;
    }
    /** Tap a number on your ticket: mark it if it has been called, tap again to unmark. */
    function tapNumber(n) {
      if (phase !== 'draw' && phase !== 'check') return false;
      if (!mine.tk.nums.includes(n)) return false;
      if (marked.has(n)) { marked.delete(n); removeMarker(mine, n); ctx.sfx('click', .3); updateRows(); refreshKinh(); return false; }
      if (!drawnSet.has(n)) { ctx.ui.toast(`Số ${n} chưa được gọi đâu nha 😉`, 'emoji-fluent-3d/symbols/speech_balloon.png'); ctx.sfx('error', .3); return false; }
      marked.add(n); addMarker(mine, n, true, !test); ctx.sfx('pop', .4);
      if (updateRows()) ctx.sfx('jingle', .4);
      refreshKinh(); return true;
    }
    tapHandler = tapNumber;
    let acts = null;
    function refreshKinh() {
      if (!acts || !acts.btn('kinh')) return;
      const ok = R.canKinh(mine.tk, marked, drawnSet).ok && !claims.some(c => c.seat === me);
      acts.btn('kinh').classList.toggle('lt-hot', ok);
      drawMine();
    }
    function pressKinh() {
      if (phase !== 'draw' && phase !== 'check') return false;
      if (claims.some(c => c.seat === me)) return false;
      const k = R.canKinh(mine.tk, marked, drawnSet);
      if (!k.ok) { ctx.ui.toast('Chưa kinh được đâu! Phải đánh dấu đủ 5 số một hàng 😅', 'emoji-fluent-3d/reactions/grinning_face_with_sweat.png'); ctx.sfx('error', .4); return false; }
      claim(me, k.row);
      return true;
    }
    function claim(seat, row) {
      if (claims.some(c => c.seat === seat)) return;
      claims.push({ seat, row, nums: R.rowNums(seat === me ? mine.tk : seat.tm.tk, row) });
      if (seat === me) { ctx.ui.callout('KINH!', '#c2407a'); ctx.sfx('win', .5); me.say('KINH! 🎉'); refreshKinh(); }
      else { seat.say(ctx.pick(TALK.kinh)); seat.anim('cheer'); setBotWait(seat, 0, true); ctx.sfx('turn', .4); }
      if (phase === 'draw') phase = 'check';
    }
    function setToggle() { if (acts) { acts.set('auto', { label: autoMark ? 'Tự dò: BẬT' : 'Tự dò: TẮT' }); const b = acts.btn('auto'); b.classList.toggle('mint', autoMark); b.classList.toggle('grey', !autoMark); } }
    function toggleAuto(on) {
      autoMark = on == null ? !autoMark : on; setToggle();
      if (autoMark) { for (const n of drawn) if (mine.tk.nums.includes(n) && !marked.has(n)) { marked.add(n); addMarker(mine, n, true, !test); } updateRows(); refreshKinh(); }
    }

    // ---------------------------------------------------------------- one draw: spin, pop a ball out, roll it to the pedestal
    let pedBall = null, trayBalls = [];
    function trayPos(i) { return new T.Vector3(TRAY.x0 + i * TRAY.step, .16 + BALL_R - .04, TRAY.z); }
    async function toTray(ball) {
      trayBalls.unshift(ball);
      const gone = trayBalls.splice(TRAY.n);
      gone.forEach(b => ctx.tween(b, { x: b.position.x + .9, y: -.2, s: .01, arc: .4 }, 300, 'in').then(() => ctx.remove(b)));
      trayBalls.forEach((b, i) => { if (i) ctx.tween(b, { x: trayPos(i).x }, 260, 'out'); });
      const p = trayPos(0);
      await ctx.tween(ball, { x: p.x, y: p.y, z: p.z, s: 1, rx: -.55, ry: 0, rz: 0, arc: .9 }, 380, 'io');
    }
    async function rollTo(ball, x, z, ms) {
      const from = ball.position.clone(), dx = x - from.x, dz = z - from.z, dist = Math.hypot(dx, dz), axis = new T.Vector3(dz, 0, -dx).normalize(), q = new T.Quaternion();
      let last = 0;
      await anim(ctx, ms, k => { const e = 1 - (1 - k) * (1 - k); ball.position.x = from.x + dx * e; ball.position.z = from.z + dz * e; q.setFromAxisAngle(axis, (e - last) * dist / BALL_R); ball.quaternion.premultiply(q); last = e; });
    }
    async function drawBall(n) {
      spinBoost = 1; ctx.sfx('shuffle', .3);
      const prev = pedBall; pedBall = null;
      if (prev) toTray(prev);
      await ctx.wait(380);
      const ball = makeBall(n); ball.position.copy(OUTLET); ball.scale.setScalar(.7); ctx.add(ball);
      ctx.sfx('pop', .5);
      await ctx.tween(ball, { x: CHUTE_END.x, y: CHUTE_END.y, z: CHUTE_END.z, s: 1, arc: .5 }, 240, 'out');
      spinBoost = 0;
      await rollTo(ball, PED.x - .9, PED.z + .2, 380);
      ctx.sfx('tick', .4);
      await ctx.tween(ball, { x: PED.x, y: PED.h + BALL_R * BIG, z: PED.z, s: BIG, rx: -.5, ry: 0, rz: 0, arc: .6 }, 300, 'back');
      if (phase !== 'draw') { ctx.tween(ball, { s: .01 }, 200, 'in').then(() => ctx.remove(ball)); return false; }   // someone shouted KINH while it rolled: it doesn't count
      pedBall = ball; return true;
    }

    // ---------------------------------------------------------------- a round
    function newTicketFor(tm, tk, p) { tm.setTicket(tk || R.makeTicket(rand), p); }
    async function waitClaimOr(ms) { const end = performance.now() + ms * ctx.timeScale; while (performance.now() < end && phase === 'draw') await new Promise(r => setTimeout(r, 30)); }

    async function round(opt = {}) {
      // ---- reset the table
      claims = []; marked = new Set(); drawn = []; drawnSet = new Set(); phase = 'buy';
      if (pedBall) { ctx.remove(pedBall); pedBall = null; } trayBalls.forEach(b => ctx.remove(b)); trayBalls = [];
      rowBars.forEach(b => { b.material.opacity = 0; });
      if (potStack) { ctx.remove(potStack); potStack = null; } if (potLabel) { potLabel.remove(); potLabel = null; }
      bots.forEach(b => { setBotWait(b, null); b.tm.setTicket(R.makeTicket(rand)); });
      newTicketFor(mine, opt.tickets && opt.tickets[0], null);
      drawBoard([]); drawCaller(null, 'Mua vé đi bà con ơi! 🎫'); caller.style.display = 'none'; board.style.display = '';
      // ---- buy a ticket
      picker = ctx.ui.chipPicker(PRICES, v => { price = v; acts.set('buy', { label: `MUA VÉ ${HC.short(v)}` }); }, PRICES.indexOf(price));
      price = picker.value;     // a lobby room may only offer some prices
      ctx.ui.status(`Chọn giá vé bên trái rồi bấm <b>MUA VÉ</b> · KINH nhận <b>90%</b> hũ`);
      await new Promise(res => {
        acts = ctx.ui.actions([
          { id: 'swap', label: 'Đổi vé', cls: 'sky', icon: 'emoji-fluent-3d/game/joker.png', onClick: () => { newTicketFor(mine, null, null); ctx.sfx('card', .4); } },
          { id: 'buy', label: `MUA VÉ ${HC.short(price)}`, cls: 'pink', icon: 'emoji-fluent-3d/game/ticket.png', onClick: () => { const p = opt.price || picker.value; if (ctx.spend(p)) { price = p; res(); } } },
        ]);
        if (test || opt.demo) acts.btn('buy').onclick();
      });
      ctx.ui.clearActions(); if (picker) { picker.el.remove(); picker = null; }
      mine.setTicket(mine.tk, price);
      bots.forEach((b, i) => {
        if (ctx.topUp(b, price, 500000, 2)) b.say('Nạp thêm xu mua vé nè 😅');      // bots never go broke
        if (opt.tickets && opt.tickets[i + 1]) b.tm.setTicket(opt.tickets[i + 1], price); else b.tm.setTicket(b.tm.tk, price);
        b.setCoins(b.coins - price); setBotWait(b, 5);
      });
      ctx.sfx('chips', .4);
      ctx.pick(bots).say(ctx.pick(TALK.buy));
      const pot = price * 4, prz = R.prize(price, 4, 1);
      potStack = ctx.stack(pot, POT.x, POT.z);
      potLabel = ctx.label(new T.Vector3(POT.x, 1.25, POT.z), `<div class="lt-pot">Hũ ${HC.short(pot)}<small>kinh nhận ${HC.short(prz.total)}</small></div>`, '');
      // ---- draw
      phase = 'draw'; caller.style.display = ''; drawCaller(null, 'Chuẩn bị quay nè…');
      acts = ctx.ui.actions([
        { id: 'auto', label: 'Tự dò: TẮT', cls: 'grey', icon: 'emoji-fluent-3d/hands/thumbs_up.png', onClick: () => toggleAuto() },
        { id: 'kinh', label: 'KINH!', cls: 'pink', icon: 'emoji-fluent-3d/game/party_popper.png', onClick: () => pressKinh() },
      ]);
      if (opt.autoMark != null) autoMark = opt.autoMark; else if (opt.demo) autoMark = true;
      setToggle(); refreshKinh();
      let order = opt.order;
      if (!order && opt.demo && ctx.SHOT && !opt.toEnd) {           // screenshot: a mid-round state where nobody has won yet but you have marks
        for (let t = 0; t < 400; t++) { const o = R.drawOrder(rand), hits = o.slice(0, 16).filter(n => mine.tk.nums.includes(n)).length; if ([mine.tk, ...bots.map(b => b.tm.tk)].every(tk => R.drawsToWin(tk, o) > 18) && hits >= 5) { order = o; break; } }
      }
      order = order || R.drawOrder(rand);
      ctx.ui.status(autoMark ? 'Máy đang tự dò giùm bạn · đủ hàng thì bấm <b>KINH!</b>' : 'Nghe số rồi chạm vào số trên vé để đánh dấu');
      await ctx.wait(500);
      for (let i = 0; i < order.length && phase === 'draw'; i++) {
        const n = order[i], t0 = performance.now();
        if (!(await drawBall(n))) break;
        drawn.push(n); drawnSet.add(n);
        const phrase = R.callPhrase(n, rand);
        drawCaller(n, phrase, drawn.length); drawBoard(drawn);
        if (ctx.SHOT) ctx.ui.status(`🎤 <b>${n}</b> · ${phrase}`);
        const onMine = mine.tk.nums.includes(n);
        if (autoMark && onMine) { marked.add(n); addMarker(mine, n, true, !test); if (updateRows()) ctx.sfx('jingle', .4); }
        if (!ctx.SHOT) ctx.ui.status(`🎤 <b>${n}</b> · ${phrase}${onMine && !autoMark ? ' · <b>vé bạn có số này!</b>' : ''}`);
        refreshKinh();
        // bots mark and maybe shout
        for (const b of bots) {
          if (b.tm.tk.nums.includes(n)) addMarker(b.tm, n, false, !test);
          const w = R.waiting(b.tm.tk, drawnSet);
          if (!claims.some(c => c.seat === b)) setBotWait(b, w);
          if (w === 1 && rand() < .25) b.say(ctx.pick(TALK.near));
          if (w === 0) { const row = R.completeRows(b.tm.tk, drawnSet)[0]; ctx.wait(350 + rand() * 450).then(() => { if (phase === 'draw' || phase === 'check') claim(b, row); }); }
        }
        if (opt.afterDraw) await opt.afterDraw(i + 1, n);
        if (ctx.SHOT && opt.demo && !opt.toEnd && i >= 15) { await new Promise(() => {}); }      // hold the mid-round state for the screenshot
        if (opt.toEnd && R.canKinh(mine.tk, marked, drawnSet).ok) pressKinh();
        await waitClaimOr(Math.max(900, DRAW_MS - (performance.now() - t0) / ctx.timeScale));    // bots react within 800 ms, before the next ball
      }
      // ---- dò vé: the table stops, everyone with a full row may still claim
      phase = 'check';
      const first = claims[0];
      ctx.ui.status(`<b>${first ? (first.seat === me ? 'Bạn' : first.seat.name) : 'Có người'}</b> kinh rồi! Đang dò vé… ai đủ hàng bấm <b>KINH</b> ngay!`);
      refreshKinh();
      bots.forEach(b => { if (!claims.some(c => c.seat === b) && R.waiting(b.tm.tk, drawnSet) === 0) { const row = R.completeRows(b.tm.tk, drawnSet)[0]; ctx.wait(200 + rand() * 600).then(() => { if (phase === 'check') claim(b, row); }); } });
      await ctx.wait(opt.checkMs || 1700);
      if (opt.beforeSettle) await opt.beforeSettle();
      phase = 'done';
      ctx.ui.clearActions(); hover.visible = false;
      // ---- settle: winners share 90% of the pot
      const winners = claims.slice(), pz = R.prize(price, 4, winners.length), myWin = winners.some(c => c.seat === me);
      if (myWin) { ctx.win(pz.share, new T.Vector3(POT.x, 1, POT.z)); ctx.ui.confetti(); }
      else ctx.sfx('lose', .3);
      winners.forEach(c => { if (c.seat !== me) c.seat.setCoins(c.seat.coins + pz.share); });
      bots.forEach(b => { if (!winners.some(c => c.seat === b)) { b.anim('sad'); if (R.waiting(b.tm.tk, drawnSet) <= 1 && rand() < .7) b.say(TALK.lose[0]); else if (rand() < .3) b.say(ctx.pick(TALK.lose.slice(1))); } });
      if (potStack) { const ps = potStack; potStack = null; const w0 = winners[0]; const dest = !w0 || w0.seat === me ? { x: 0, z: 7.5 } : { x: w0.seat.tm.g.position.x, z: w0.seat.tm.g.position.z }; ctx.moveStack(ps, dest.x, dest.z, 600, true); }
      const rowTxt = c => `Kinh hàng ${c.row + 1}: ${c.nums.join(' · ')}`;
      const rows = [me, ...bots].map(s => {
        const c = winners.find(w => w.seat === s), tk = s === me ? mine.tk : s.tm.tk, w = R.waiting(tk, s === me ? marked : drawnSet);
        return { name: s === me ? (/^bạn$/i.test(s.name) ? 'Bạn' : s.name + ' (bạn)') : s.name, avatar: s.avatar, me: s === me, tag: c ? 'KINH!' : null, detail: c ? rowTxt(c) : w <= 0 ? 'đủ hàng mà quên kinh 😱' : `chờ ${w} số`, amount: (c ? pz.share : 0) - price };
      });
      const result = { price, drawn: drawn.slice(), winners: winners.map(c => (c.seat === me ? 'me' : c.seat.name)), share: pz.share, house: pz.house, myWin };
      if (!test) {
        await ctx.wait(900);
        await ctx.ui.results(myWin ? (winners.length > 1 ? 'Kinh chung, chia hũ!' : 'KINH! Bạn thắng 🎉') : `${winners.map(c => c.seat.name).join(' & ')} kinh rồi!`, rows, { again: 'Ván mới' });
      }
      Object.keys(mine.markers).forEach(n => removeMarker(mine, +n)); bots.forEach(b => Object.keys(b.tm.markers).forEach(n => removeMarker(b.tm, +n)));
      await ctx.wait(test ? 100 : 300);
      return result;
    }

    // ---------------------------------------------------------------- self-test
    async function selftest() {
      const out = { pass: 0, fail: 0, rounds: [] };
      const check = (name, ok, info) => { out.rounds.push(Object.assign({ name, ok }, info)); if (!ok) out.fail++; };
      // 1) you complete row 1 first and claim it; a premature KINH and marking an uncalled number are refused
      let myTk = R.makeTicket(rand), bt = [1, 2, 3].map(() => R.makeTicket(rand));
      let order = R.rowNums(myTk, 0).concat(R.drawOrder(rand).filter(n => !R.rowNums(myTk, 0).includes(n)));
      while (bt.some(tk => R.drawsToWin(tk, order) <= 5)) bt = [1, 2, 3].map(() => R.makeTicket(rand));
      let c0 = ctx.coins, early = null, uncalled = null, marks = 0;
      let r = await round({ price: 10000, tickets: [myTk, ...bt], order, autoMark: false, afterDraw: async (k) => {
        if (k !== 5) return;
        early = pressKinh();                                                  // nothing marked yet
        const other = myTk.nums.find(n => !drawnSet.has(n)); uncalled = tapNumber(other);
        // mark the five numbers by tapping the 3D ticket on screen (real raycast path)
        for (const n of R.rowNums(myTk, 0)) { const c = myTk.rows[0].indexOf(n), p = mine.g.localToWorld(new T.Vector3(cellPos(0, c).x, .02, cellPos(0, c).z)); tapAt(ctx, p); if (marked.has(n)) marks++; }
        pressKinh();
      } });
      let pz = R.prize(10000, 4, 1);
      check('bạn kinh', early === false && uncalled === false && marks === 5 && r.myWin && r.winners.length === 1 && ctx.coins === c0 - 10000 + pz.share && r.drawn.length === 5, { early, uncalled, marks, winners: r.winners, delta: ctx.coins - c0, share: r.share });
      // 2) a bot completes first; you (auto-marking) never press KINH → you lose your ticket, the bot gets 90%
      myTk = R.makeTicket(rand); bt = [1, 2, 3].map(() => R.makeTicket(rand));
      order = R.rowNums(bt[0], 1).concat(R.drawOrder(rand).filter(n => !R.rowNums(bt[0], 1).includes(n)));
      while (R.drawsToWin(myTk, order) <= 5 || bt.slice(1).some(tk => R.drawsToWin(tk, order) <= 5)) myTk = R.makeTicket(rand);
      c0 = ctx.coins; const b0 = bots[0].coins;
      r = await round({ price: 5000, tickets: [myTk, ...bt], order, autoMark: true });
      pz = R.prize(5000, 4, 1);
      check('bot kinh', !r.myWin && r.winners.length === 1 && r.winners[0] === bots[0].name && ctx.coins === c0 - 5000 && bots[0].coins === b0 - 5000 + pz.share, { winners: r.winners, delta: ctx.coins - c0, botDelta: bots[0].coins - b0 });
      // 3) same ticket as a bot: both complete on the same ball, you press KINH during the check → the pot is split
      myTk = R.makeTicket(rand); bt = [JSON.parse(JSON.stringify(myTk)), R.makeTicket(rand), R.makeTicket(rand)];
      order = R.rowNums(myTk, 2).concat(R.drawOrder(rand).filter(n => !R.rowNums(myTk, 2).includes(n)));
      while (bt.slice(1).some(tk => R.drawsToWin(tk, order) <= 5)) { bt[1] = R.makeTicket(rand); bt[2] = R.makeTicket(rand); }
      c0 = ctx.coins;
      r = await round({ price: 50000, tickets: [myTk, ...bt], order, autoMark: true, beforeSettle: async () => { pressKinh(); } });
      pz = R.prize(50000, 4, 2);
      check('kinh chung', r.myWin && r.winners.length === 2 && ctx.coins === c0 - 50000 + pz.share && pz.share === 90000, { winners: r.winners, delta: ctx.coins - c0 });
      // 4) the 3D ticket shows a valid generated ticket
      check('vé hợp lệ', R.validateTicket(mine.tk).length === 0 && bots.every(b => R.validateTicket(b.tm.tk).length === 0), {});
      out.checks = out.rounds.length; out.pass = out.fail ? 0 : 1; out.botsCoins = bots.map(b => b.coins);
      return out;
    }
    return { round, selftest };
  }
})();
