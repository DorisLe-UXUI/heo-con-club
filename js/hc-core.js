/*
 * HC core — shared by index.html (town), lobby.html and tien-len.html.
 * Offline accounts (stored in this browser only), per-account save data, settings, sounds and page transitions.
 */
(function () {
  'use strict';
  const LS = (() => { try { const k = '__hc_t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } })();
  const SS = (() => { try { return sessionStorage; } catch (e) { return null; } })();
  const raw = {
    get(k, d, s = LS) { try { const v = s && s.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v, s = LS) { try { s && s.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k, s = LS) { try { s && s.removeItem(k); } catch (e) {} },
  };

  // ------------------------------------------------------------------ session & per-account keys
  function session() { return raw.get('heocon_session', null, SS) || raw.get('heocon_session', null); }
  function user() { const s = session(); return s && s.user ? s.user : null; }
  /** Guests keep the original keys (heocon_coins …); accounts get heocon_u_<name>_coins … */
  function key(k) { const u = user(); return 'heocon_' + (u ? 'u_' + u + '_' : '') + k; }
  const store = { get: (k, d) => raw.get(key(k), d), set: (k, v) => raw.set(key(k), v), del: k => raw.del(key(k)) };

  // ------------------------------------------------------------------ password hashing
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const randHex = n => { const a = new Uint8Array(n); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256); return hex(a); };
  function sha256(str) { // compact fallback for browsers without crypto.subtle
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const bytes = new TextEncoder().encode(str), l = bytes.length, words = [];
    for (let i = 0; i < l; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    words[l >> 2] |= 0x80 << (24 - (l % 4) * 8); words[(((l + 8) >> 6) + 1) * 16 - 1] = l * 8;
    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let j = 0; j < words.length; j += 16) {
      const w = []; let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        w[i] = i < 16 ? words[j + i] | 0 : (r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10)) + w[i - 7] + (r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3)) + w[i - 16] | 0;
        const t1 = h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i] | 0, t2 = (r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c)) | 0;
        h = g; g = f; f = e; e = d + t1 | 0; d = c; c = b; b = a; a = t1 + t2 | 0;
      }
      H = H.map((x, i) => x + [a, b, c, d, e, f, g, h][i] | 0);
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  async function hashPass(pass, salt) {
    if (window.crypto && crypto.subtle && window.isSecureContext !== false) {
      try {
        const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120000, hash: 'SHA-256' }, k, 256);
        return 'pbkdf2:' + hex(bits);
      } catch (e) { /* fall through */ }
    }
    let h = salt + pass; for (let i = 0; i < 2000; i++) h = sha256(h + salt);
    return 'sha256x2000:' + h;
  }

  // ------------------------------------------------------------------ accounts
  const USER_RE = /^[a-z0-9_.]{3,16}$/;
  const accounts = () => raw.get('heocon_accounts', {});
  const auth = {
    USER_RE,
    exists: u => !!accounts()[String(u).toLowerCase()],
    session, user,
    isGuest() { const s = session(); return !!(s && s.guest); },
    signedIn() { return !!session(); },
    async register({ user: u, pass, display, mascot = 0 }) {
      u = String(u || '').trim().toLowerCase();
      if (!USER_RE.test(u)) throw new Error('Tên đăng nhập 3–16 ký tự, chỉ gồm chữ thường không dấu, số, dấu _ hoặc dấu chấm.');
      if (String(pass || '').length < 6) throw new Error('Mật khẩu cần ít nhất 6 ký tự.');
      const all = accounts(); if (all[u]) throw new Error('Tên đăng nhập này đã có người dùng.');
      const salt = randHex(16);
      all[u] = { salt, hash: await hashPass(pass, salt), created: Date.now() };
      raw.set('heocon_accounts', all);
      raw.set('heocon_session', { user: u, t: Date.now() }, SS); raw.set('heocon_session', { user: u, t: Date.now() });
      const name = String(display || '').trim().slice(0, 14) || u;
      store.set('name', name); store.set('mascot', mascot); store.set('coins', 1250000); store.set('fr', 'pink');
      store.set('av', `3d/renders/avatars/${['adv_mage', 'adv_knight', 'adv_rogue_hooded', 'adv_ranger', 'adv_barbarian', 'adv_rogue', 'mini_bear', 'mini_dog', 'mini_duck'][mascot % 9]}.png`);
      store.set('welcome', true);
      return u;
    },
    async login(u, pass, remember = true) {
      u = String(u || '').trim().toLowerCase();
      const a = accounts()[u];
      if (!a) throw new Error('Không tìm thấy tài khoản này trên máy.');
      if (await hashPass(pass, a.salt) !== a.hash) throw new Error('Sai mật khẩu rồi, thử lại nha.');
      raw.set('heocon_session', { user: u, t: Date.now() }, SS);
      if (remember) raw.set('heocon_session', { user: u, t: Date.now() }); else raw.del('heocon_session');
      raw.set('heocon_last_user', u);
      return u;
    },
    guest() { raw.set('heocon_session', { guest: true, t: Date.now() }, SS); raw.set('heocon_session', { guest: true, t: Date.now() }); },
    logout() { raw.del('heocon_session', SS); raw.del('heocon_session'); },
    lastUser: () => raw.get('heocon_last_user', ''),
  };

  // ------------------------------------------------------------------ small helpers
  /** Release stamp added to asset URLs so browsers fetch new pictures after an update (tools/bump_version.py changes it). */
  const V = 'v=202610281646';
  const A = p => /^(data:|blob:|https?:)/.test(p) ? p : (window.HC_ASSET_BASE || 'assets/') + p.split('/').map(encodeURIComponent).join('/') + '?' + V;
  const fmt = n => Math.round(n).toLocaleString('vi-VN');
  const short = n => n >= 1e9 ? (n / 1e9).toFixed(n % 1e9 ? 1 : 0).replace('.', ',') + 'B' : n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace('.', ',') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // ------------------------------------------------------------------ settings & sound
  const settings = Object.assign({ music: true, sfx: true, vibe: true }, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);
  /** UI zoom levels for the "Cỡ giao diện" setting. */
  const UIZ = { nho: .5, vua: .6, lon: .76 };
  /**
   * Scale of one UI unit (designed at 1080p) in screen pixels. Kept small so the game, not the HUD,
   * fills the window; small windows shrink less so text stays readable.
   */
  const uiScale = (designW = 1640) => {
    const base = Math.min(1.3, innerHeight / 1080, innerWidth / designW);
    return Math.max(Math.min(base, .45), base * (UIZ[settings.ui] || UIZ.vua));
  };
  const SFX = {
    click: 'audio-ui-kenney/Audio/click1.ogg', pop: 'audio-sfx-ninja/Elemental/Bubble.wav', coin: 'audio-sfx-ninja/Bonus/Coin.wav', gold: 'audio-sfx-ninja/Bonus/Gold1.wav',
    win: 'audio-sfx-ninja/Jingles/Success1.wav', accept: 'audio-sfx-ninja/Menu/Accept.wav', cancel: 'audio-sfx-ninja/Menu/Cancel.wav', jump: 'audio-sfx-ninja/Jump & Bounce/Jump.wav',
    bounce: 'audio-sfx-ninja/Jump & Bounce/Bounce.wav', power: 'audio-digital-kenney/Audio/powerUp2.ogg', error: 'audio-interface-kenney/Audio/error_004.ogg',
    tick: 'audio-interface-kenney/Audio/tick_001.ogg', open: 'audio-interface-kenney/Audio/maximize_006.ogg', close: 'audio-interface-kenney/Audio/minimize_006.ogg',
    honk: 'audio-digital-kenney/Audio/lowDown.ogg', step: 'audio-interface-kenney/Audio/tick_002.ogg', jingle: 'audio-jingles-kenney/Audio/Pizzicato jingles/jingles_PIZZI00.ogg',
  };
  const QUIET = /[?&](shot|uitest|pose)=/.test(location.search);
  function sfx(name, vol = 0.6) {
    if (!settings.sfx || QUIET || !SFX[name]) return;
    try { const a = new Audio(A(SFX[name])); a.volume = vol; a.play().catch(() => {}); } catch (e) {}
  }
  let bgm = null;
  function music(path, vol = 0.32) {
    if (QUIET) return;
    if (!settings.music) { if (bgm) bgm.pause(); return; }
    if (bgm && bgm.dataset.p === path) { bgm.play().catch(() => {}); return; }
    if (bgm) bgm.pause();
    bgm = new Audio(A(path)); bgm.loop = true; bgm.volume = vol; bgm.dataset.p = path; bgm.play().catch(() => {});
    // browsers block autoplay until the first tap
    const resume = () => { if (bgm && settings.music) bgm.play().catch(() => {}); removeEventListener('pointerdown', resume); };
    addEventListener('pointerdown', resume);
  }
  function stopMusic() { if (bgm) bgm.pause(); }

  // ------------------------------------------------------------------ page transition veil
  const VEIL_CSS = `#hcVeil{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
    background:radial-gradient(circle at 50% 40%,#fff1f8 0,#ffc6e0 45%,#c9b4ff 100%);transition:opacity .35s ease;font-family:"Grandstander Black","Baloo 2",sans-serif}
    #hcVeil.off{opacity:0;pointer-events:none}
    #hcVeil .pig{width:150px;height:150px;animation:hcBounce .8s cubic-bezier(.3,1.6,.5,1) infinite alternate}
    #hcVeil .tx{font-size:34px;color:#fff;-webkit-text-stroke:7px #c2407a;paint-order:stroke fill;letter-spacing:1px}
    #hcVeil .dots{display:flex;gap:12px}#hcVeil .dots i{width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 3px 0 #e889b5;animation:hcDot 1s ease-in-out infinite}
    #hcVeil .dots i:nth-child(2){animation-delay:.15s}#hcVeil .dots i:nth-child(3){animation-delay:.3s}
    @keyframes hcBounce{from{transform:translateY(8px) scale(1.04,.96)}to{transform:translateY(-22px) scale(.97,1.03)}}
    @keyframes hcDot{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-12px);opacity:1}}`;
  let veilEl = null;
  function veil(text = 'Đang tải…') {
    if (!document.getElementById('hcVeilCss')) { const s = document.createElement('style'); s.id = 'hcVeilCss'; s.textContent = VEIL_CSS; document.head.appendChild(s); }
    if (!veilEl) {
      veilEl = document.createElement('div'); veilEl.id = 'hcVeil';
      veilEl.innerHTML = `<img class="pig" src="${A('emoji-fluent-3d/animals/pig_face.png')}" onerror="this.src='${A('emoji-fluent-3d/game/coin.png')}'"><div class="tx"></div><div class="dots"><i></i><i></i><i></i></div>`;
      document.body.appendChild(veilEl);
    }
    veilEl.querySelector('.tx').textContent = text; veilEl.classList.remove('off');
    return () => veilEl && veilEl.classList.add('off');
  }
  /** Fade to the veil, then navigate. */
  function goto(url, text = 'Đang chuyển cảnh…') {
    veil(text); raw.set('heocon_veil', text, SS);
    setTimeout(() => { location.href = url; }, 380);
  }
  /** Called by pages when ready: lifts the veil left by goto(). */
  function arrive() { if (veilEl) veilEl.classList.add('off'); raw.del('heocon_veil', SS); }
  // pages entered via goto() start covered so there is no white flash
  if (raw.get('heocon_veil', null, SS) && !QUIET) {
    const t = raw.get('heocon_veil', '', SS);
    const show = () => { veil(t); setTimeout(arrive, 4000); };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }

  /** Where "back" should go: the 3D town if the player came from it, else the given fallback. */
  function from() { return new URLSearchParams(location.search).get('from') || raw.get('heocon_from', '', SS); }
  function rememberFrom() { const f = new URLSearchParams(location.search).get('from'); if (f) raw.set('heocon_from', f, SS); }
  rememberFrom();

  window.HC = { V, raw, store, key, auth, settings, saveSettings, uiScale, UIZ, sfx, music, stopMusic, veil, goto, arrive, from, A, fmt, short, pick, LS: !!LS, _sha256: sha256 };
})();
