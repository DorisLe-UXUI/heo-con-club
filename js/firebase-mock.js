/*
 * Development stand-in for the Firebase compat SDK (only the parts js/hc-online.js uses), stored in localStorage so several
 * tabs of the same browser act as different players. Used when a page is opened with ?mockfb=1 (optionally &mockuser=<name>).
 * Not used by the real game.
 */
(function () {
  'use strict';
  const KEY = 'heocon_mockfb', SKEY = 'heocon_mockfb_user';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const saveAll = db => { localStorage.setItem(KEY, JSON.stringify(db)); fire(); };
  const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
  const listeners = new Set();
  function fire() { for (const l of [...listeners]) { try { l(); } catch (e) { console.warn(e); } } }
  addEventListener('storage', e => { if (e.key === KEY) fire(); });
  let autoId = 0; const newId = () => Date.now().toString(36) + (autoId++).toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------------------------------------------------------------- firestore
  const snapDoc = (path, data) => ({ id: path.split('/').pop(), exists: data !== undefined, data: () => clone(data) });
  class DocRef {
    constructor(path) { this.path = path; this.id = path.split('/').pop(); }
    collection(name) { return new Query(this.path + '/' + name); }
    async get() { return snapDoc(this.path, load()[this.path]); }
    async set(data, opt) { const db = load(); db[this.path] = opt && opt.merge ? Object.assign({}, db[this.path] || {}, clone(data)) : clone(data); saveAll(db); }
    async update(patch) { const db = load(); if (!(this.path in db)) throw Object.assign(new Error('not-found'), { code: 'not-found' }); db[this.path] = Object.assign(db[this.path], clone(patch)); saveAll(db); }
    onSnapshot(cb) { let last; const run = () => { const v = JSON.stringify(load()[this.path]); if (v !== last) { last = v; cb(snapDoc(this.path, load()[this.path])); } }; listeners.add(run); setTimeout(run, 0); return () => listeners.delete(run); }
  }
  class Query {
    constructor(coll, filters = [], order = null, lim = 0) { this.coll = coll; this.filters = filters; this.order = order; this.lim = lim; }
    doc(id) { return new DocRef(this.coll + '/' + (id || newId())); }
    async add(data) { const r = this.doc(); await r.set(data); return r; }
    where(f, op, v) { return new Query(this.coll, this.filters.concat([[f, op, v]]), this.order, this.lim); }
    orderBy(f, dir = 'asc') { return new Query(this.coll, this.filters, [f, dir], this.lim); }
    limit(n) { return new Query(this.coll, this.filters, this.order, n); }
    _rows() {
      const db = load(), pre = this.coll + '/', ops = { '>': (a, b) => a > b, '>=': (a, b) => a >= b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '==': (a, b) => a === b };
      let rows = Object.keys(db).filter(k => k.startsWith(pre) && !k.slice(pre.length).includes('/')).map(k => ({ path: k, data: db[k] }));
      rows = rows.filter(r => this.filters.every(([f, op, v]) => ops[op](r.data[f], v)));
      if (this.order) { const [f, dir] = this.order; rows.sort((a, b) => (a.data[f] > b.data[f] ? 1 : a.data[f] < b.data[f] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
      return this.lim ? rows.slice(0, this.lim) : rows;
    }
    async get() { const docs = this._rows().map(r => snapDoc(r.path, r.data)); return { docs, size: docs.length, empty: !docs.length }; }
    onSnapshot(cb) {
      const seen = new Set();
      const run = () => { const ch = []; for (const r of this._rows()) if (!seen.has(r.path)) { seen.add(r.path); ch.push({ type: 'added', doc: snapDoc(r.path, r.data) }); } if (ch.length) cb({ docChanges: () => ch }); };
      listeners.add(run); setTimeout(run, 0); return () => listeners.delete(run);
    }
  }
  const firestore = () => ({
    collection: name => new Query(name),
    async runTransaction(fn) {
      const tx = { get: ref => ref.get(), set: (ref, d) => { tx.ops.push(() => { const db = load(); db[ref.path] = clone(d); localStorage.setItem(KEY, JSON.stringify(db)); }); }, update: (ref, p) => { tx.ops.push(() => { const db = load(); db[ref.path] = Object.assign(db[ref.path] || {}, clone(p)); localStorage.setItem(KEY, JSON.stringify(db)); }); }, ops: [] };
      const out = await fn(tx); tx.ops.forEach(f => f()); if (tx.ops.length) fire(); return out;
    },
  });

  // ---------------------------------------------------------------- auth
  const authListeners = new Set();
  const current = () => { try { return JSON.parse(sessionStorage.getItem(SKEY)); } catch (e) { return null; } };
  function GoogleAuthProvider() {} GoogleAuthProvider.prototype.setCustomParameters = function () {};
  const authObj = {
    get currentUser() { return current(); },
    async setPersistence() {},
    onAuthStateChanged(cb) { authListeners.add(cb); setTimeout(() => cb(current()), 0); return () => authListeners.delete(cb); },
    async signInWithPopup() {
      const name = new URLSearchParams(location.search).get('mockuser') || 'Người chơi ' + Math.floor(Math.random() * 900 + 100);
      const uid = 'mock' + name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20).padEnd(6, 'x');
      const isNew = !load()['saves/' + uid];
      const u = { uid, displayName: name, photoURL: '' }; sessionStorage.setItem(SKEY, JSON.stringify(u));
      authListeners.forEach(f => f(u)); return { user: u, additionalUserInfo: { isNewUser: isNew } };
    },
    async signOut() { sessionStorage.removeItem(SKEY); authListeners.forEach(f => f(null)); },
  };
  const auth = () => authObj;
  auth.Auth = { Persistence: { LOCAL: 'local' } }; auth.GoogleAuthProvider = GoogleAuthProvider;
  window.firebase = { apps: [], initializeApp(cfg) { this.apps.push(cfg || {}); }, auth, firestore, _mock: true, _reset() { localStorage.removeItem(KEY); sessionStorage.removeItem(SKEY); } };
})();
