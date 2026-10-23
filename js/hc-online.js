/*
 * Heo Con online (Firebase): Google sign-in, cloud save, real leaderboard, who is online, and small room primitives for playing
 * at one table with friends. Loaded by every page after hc-core.js (and js/firebase-config.js).
 *
 * Nothing happens until js/firebase-config.js holds a real config AND the page runs on http(s) (GitHub Pages or localhost):
 * from file:// the game stays fully offline. Setup steps: docs/ONLINE_SETUP.md. Security rules: firestore.rules.
 *
 * Data (Firestore):
 *   saves/{uid}    { data: { <store key>: <json> }, updated }       private: only the owner reads / writes
 *   players/{uid}  { name, av, fr, lv, vip, coins, won, seen }      public card for the leaderboard and "đang online"
 *   rooms/{code}   { game, host, seats[], state, open, updated }    a table friends join with a 6-digit code
 *   rooms/{code}/moves/{auto}  { by, t, move }                      actions sent to the host
 * A Google account plays as local user "g_<12 chars>", so its save lives under its own store keys like offline accounts.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else if (root.HC) root.HC.online = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const HC = root.HC || null;
  const CFG = root.HC_FIREBASE || null;
  const SDK = 'https://cdn.jsdelivr.net/npm/firebase@10.12.2/';
  const isHttp = !!(root.location && /^https?:$/.test(root.location.protocol));
  const MOCK = !!(root.location && (/[?&]mockfb=1/.test(root.location.search) || (root.sessionStorage && root.sessionStorage.getItem('heocon_mockfb_on'))));   // development stand-in (js/firebase-mock.js), kept for the tab
  if (MOCK && root.sessionStorage) root.sessionStorage.setItem('heocon_mockfb_on', '1');
  const configured = MOCK || !!(CFG && CFG.apiKey && !/DÁN|PASTE|xxx/i.test(CFG.apiKey));
  const available = configured && (isHttp || MOCK);
  const SAVE_EVERY = 15000, SEEN_EVERY = 60000, ONLINE_WINDOW = 3 * 60000;

  // ------------------------------------------------------------------ pure helpers (node-tested)
  function localName(uid) { let h = 2166136261; for (const c of String(uid)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return 'g_' + ((h >>> 0).toString(36) + String(uid).toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 12); }
  /** Every saved key of one local user, as { shortKey: rawJson }. */
  function collect(ls, user) {
    const pre = 'heocon_u_' + user + '_', out = {};
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(pre) && !k.endsWith('_cloud_t')) out[k.slice(pre.length)] = ls.getItem(k); }
    return out;
  }
  function apply(ls, user, data) { const pre = 'heocon_u_' + user + '_'; for (const k in data) if (typeof data[k] === 'string') ls.setItem(pre + k, data[k]); }
  /** Which copy wins when signing in: 'cloud' (newer cloud save), 'local' (upload this device) or 'none'. */
  function decide(localStamp, cloud, localHasData) {
    if (cloud && cloud.data && (!localStamp || cloud.updated > localStamp)) return 'cloud';
    if (localHasData) return 'local';
    return cloud ? 'cloud' : 'none';
  }
  const roomCode = (r = Math.random) => String(100000 + Math.floor(r() * 900000));
  const seatCard = (S, me, seat) => ({ uid: me.uid, name: S.get('name', me.name), av: S.get('av', ''), fr: S.get('fr', 'pink'), coins: S.get('coins', 0), seat });

  const helpers = { localName, collect, apply, decide, roomCode };
  if (!HC) return helpers;

  // ------------------------------------------------------------------ firebase loading
  let readyP = null, fb = null, auth = null, db = null, me = null, dirty = false, saving = null, timers = [];
  const listeners = new Set();
  const emit = (t, d) => listeners.forEach(f => { try { f(t, d); } catch (e) {} });
  function load(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Không tải được ' + src)); document.head.appendChild(s); }); }
  function init() {
    if (!available) return Promise.reject(new Error(isHttp ? 'Chưa bật chơi online (thiếu cấu hình Firebase).' : 'Chơi online cần mở bản web của game.'));
    if (readyP) return readyP;
    readyP = (async () => {
      if (MOCK) await load('js/firebase-mock.js');
      else for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']) await load(SDK + f);
      fb = root.firebase; if (!fb.apps.length) fb.initializeApp(CFG);
      auth = fb.auth(); db = fb.firestore();
      await auth.setPersistence(fb.auth.Auth.Persistence.LOCAL);
      const u = await new Promise(res => { const un = auth.onAuthStateChanged(x => { un(); res(x); }); });
      if (u) await adopt(u, false);
      auth.onAuthStateChanged(x => { if (!x && me) { me = null; emit('signout'); } });
      return me;
    })();
    readyP.catch(() => { readyP = null; });
    return readyP;
  }

  // ------------------------------------------------------------------ session + cloud save
  const raw = HC.raw, LS = root.localStorage;
  async function adopt(u, fresh) {
    const user = localName(u.uid);
    me = { uid: u.uid, user, name: u.displayName || 'Bạn Heo Con', photo: u.photoURL || '' };
    raw.set('heocon_session', { user, google: true, uid: u.uid, t: Date.now() }); raw.set('heocon_last_user', user);
    const stampKey = 'heocon_u_' + user + '_cloud_t', localStamp = +LS.getItem(stampKey) || 0;
    const local = collect(LS, user), hasLocal = Object.keys(local).length > 0;
    let cloud = null; try { const d = await db.collection('saves').doc(u.uid).get(); cloud = d.exists ? d.data() : null; } catch (e) { console.warn('cloud load', e); }
    const how = decide(localStamp, cloud, hasLocal);
    if (how === 'cloud') { apply(LS, user, cloud.data); LS.setItem(stampKey, String(cloud.updated)); }
    if (how === 'none' || (fresh && !cloud && !hasLocal)) {          // brand-new player: same start as an offline account
      HC.store.set('name', (me.name || '').slice(0, 14) || 'Bạn Heo Con'); HC.store.set('coins', 1250000); HC.store.set('fr', 'pink'); HC.store.set('welcome', true);
      if (me.photo) HC.store.set('av', me.photo);
    }
    if (how !== 'cloud') { dirty = true; await flush(); }
    startLoops(); emit('signin', me);
    return me;
  }
  async function flush() {
    if (!me || !db || !dirty) return saving;
    if (saving) return saving;
    dirty = false;
    const t = Date.now(), data = collect(LS, me.user), S = HC.store;
    saving = (async () => {
      try {
        await db.collection('saves').doc(me.uid).set({ data, updated: t });
        LS.setItem('heocon_u_' + me.user + '_cloud_t', String(t));
        const P = HC.prog;
        await db.collection('players').doc(me.uid).set({ name: S.get('name', me.name), av: S.get('av', ''), fr: S.get('fr', 'pink'), coins: S.get('coins', 0),
          lv: P ? P.level() : S.get('lv', 1), vip: P ? P.vip() : S.get('vip', 1), won: P ? P.stats().won : 0, seen: t }, { merge: true });
        emit('saved', t);
      } catch (e) { dirty = true; console.warn('cloud save', e); emit('error', e); }
      finally { saving = null; }
    })();
    return saving;
  }
  function startLoops() {
    timers.forEach(clearInterval); timers = [];
    timers.push(setInterval(() => { if (dirty) flush(); }, SAVE_EVERY));
    timers.push(setInterval(() => { if (me && document.visibilityState === 'visible') db.collection('players').doc(me.uid).set({ seen: Date.now() }, { merge: true }).catch(() => {}); }, SEEN_EVERY));
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }
  // every store write marks the save dirty while signed in with Google
  const set0 = HC.store.set;
  HC.store.set = (k, v) => { set0(k, v); if (me && k !== 'cloud_t') dirty = true; };
  // page changes wait (briefly) for the cloud save
  const goto0 = HC.goto;
  HC.goto = (url, text) => { if (me && dirty) { HC.veil(text); Promise.race([flush(), new Promise(r => setTimeout(r, 1500))]).then(() => goto0(url, text)); } else goto0(url, text); };

  // ------------------------------------------------------------------ public api
  const api = Object.assign({}, helpers, {
    available, configured, isHttp, mock: MOCK,
    webUrl: 'https://dorisle-uxui.github.io/heo-con-club/',
    on: f => { listeners.add(f); return () => listeners.delete(f); },
    user: () => me,
    isGoogle: () => { const s = raw.get('heocon_session', null); return !!(s && s.google); },
    /** Resume a Google session on page load (no popup). Resolves to the user or null. */
    resume: () => (available && api.isGoogle() ? init().catch(e => { console.warn(e); return null; }) : Promise.resolve(null)),
    async signIn() {
      await init();
      const prov = new fb.auth.GoogleAuthProvider(); prov.setCustomParameters({ prompt: 'select_account' });
      const res = await auth.signInWithPopup(prov);
      return adopt(res.user, !!(res.additionalUserInfo && res.additionalUserInfo.isNewUser));
    },
    async signOut() { try { await flush(); if (auth) await auth.signOut(); } finally { me = null; HC.auth.logout(); timers.forEach(clearInterval); } },
    flush: () => { dirty = true; return flush(); },
    /** Real players sorted by a public field (coins | lv | won). */
    async top(field = 'coins', n = 30) { await init(); const q = await db.collection('players').orderBy(field, 'desc').limit(n).get(); return q.docs.map(d => Object.assign({ uid: d.id, me: !!me && d.id === me.uid }, d.data())); },
    async onlineNow(n = 30) { await init(); const q = await db.collection('players').where('seen', '>', Date.now() - ONLINE_WINDOW).orderBy('seen', 'desc').limit(n).get(); return q.docs.map(d => Object.assign({ uid: d.id, me: !!me && d.id === me.uid }, d.data())); },

    // ---------------------------------------------------------------- rooms (play at one table with friends)
    async createRoom(game, opts = {}) {
      await init(); if (!me) throw new Error('Cần đăng nhập Google để mở phòng.');
      for (let i = 0; i < 6; i++) {
        const code = roomCode(), ref = db.collection('rooms').doc(code);
        const ok = await db.runTransaction(async tx => { const d = await tx.get(ref); if (d.exists && d.data().open && Date.now() - d.data().updated < 36e5) return false;
          tx.set(ref, { game, host: me.uid, open: true, seats: [seatCard(HC.store, me, 0)], max: opts.max || 4, stake: opts.stake || 0, mode: opts.mode || '', state: null, updated: Date.now() }); return true; });
        if (ok) return code;
      }
      throw new Error('Không tạo được phòng, thử lại nhé.');
    },
    async joinRoom(code) {
      await init(); if (!me) throw new Error('Cần đăng nhập Google để vào phòng.');
      const ref = db.collection('rooms').doc(String(code));
      return db.runTransaction(async tx => {
        const d = await tx.get(ref); if (!d.exists || !d.data().open) throw new Error('Không thấy phòng ' + code + ' hoặc phòng đã đóng.');
        const r = d.data(); if (r.seats.some(s => s.uid === me.uid)) return r;
        if (r.seats.length >= r.max) throw new Error('Phòng đã đủ người.');
        const used = new Set(r.seats.map(s => s.seat)); let seat = 0; while (used.has(seat)) seat++;
        const seats = r.seats.concat([seatCard(HC.store, me, seat)]);
        tx.update(ref, { seats, updated: Date.now() }); return Object.assign({}, r, { seats });
      });
    },
    async leaveRoom(code) { if (!db || !me) return; const ref = db.collection('rooms').doc(String(code)); await db.runTransaction(async tx => { const d = await tx.get(ref); if (!d.exists) return; const r = d.data(); const seats = r.seats.filter(s => s.uid !== me.uid); tx.update(ref, { seats, open: seats.length > 0 && r.open, host: r.host === me.uid && seats[0] ? seats[0].uid : r.host, hb: Date.now(), updated: Date.now() }); }).catch(() => {}); },
    /** Take over a room whose host stopped answering (its heartbeat is still the one this player last saw). */
    async claimHost(code, seenHb) {
      await init(); const ref = db.collection('rooms').doc(String(code));
      return db.runTransaction(async tx => { const d = await tx.get(ref); if (!d.exists) return false; const r = d.data();
        if ((r.hb || r.updated) !== seenHb || !r.seats.some(s => s.uid === me.uid)) return false;
        tx.update(ref, { host: me.uid, hb: Date.now(), updated: Date.now() }); return true; });
    },
    watchRoom(code, cb) { return db.collection('rooms').doc(String(code)).onSnapshot(d => cb(d.exists ? d.data() : null)); },
    /** Host only: publish the table state everyone renders. */
    setRoom(code, patch) { return db.collection('rooms').doc(String(code)).update(Object.assign({}, patch, { updated: Date.now() })); },
    /** Any seat: send a move to the host. */
    sendMove(code, move) { return db.collection('rooms').doc(String(code)).collection('moves').add({ by: me.uid, t: Date.now(), move }); },
    watchMoves(code, cb) { const since = Date.now() - 1000; return db.collection('rooms').doc(String(code)).collection('moves').where('t', '>', since).orderBy('t').onSnapshot(q => q.docChanges().forEach(c => { if (c.type === 'added') cb(Object.assign({ id: c.doc.id }, c.doc.data())); })); },
  });
  if (available && api.isGoogle()) init().catch(e => console.warn('online', e));   // keep syncing on every page while signed in with Google
  return api;
});
