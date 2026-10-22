// Offline account tests for js/hc-core.js (run: node tests/auth.test.js)
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
function mkStorage() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m }; }
global.window = global;
global.localStorage = mkStorage(); global.sessionStorage = mkStorage();
global.location = { search: '', href: '' };
global.document = { body: null, addEventListener() {}, getElementById() { return null; }, head: { appendChild() {} }, createElement() { return { style: {}, querySelector: () => ({}) }; } };
global.addEventListener = () => {}; global.removeEventListener = () => {};
eval(fs.readFileSync(path.join(__dirname, '../js/hc-core.js'), 'utf8'));
const HC = global.HC;
let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };
(async () => {
  ok(HC._sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'sha256 fallback is correct');
  ok(HC._sha256('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'sha256 empty');
  ok(!HC.auth.signedIn(), 'starts signed out');
  // guest keeps the old keys
  HC.auth.guest(); HC.store.set('coins', 777); ok(localStorage.getItem('heocon_coins') === '777', 'guest uses heocon_coins');
  HC.auth.logout(); ok(!HC.auth.signedIn(), 'logout clears session');
  // validation
  for (const [u, p] of [['ab', 'secret1'], ['Bad Name', 'secret1'], ['vịt', 'secret1'], ['okname', '123']]) {
    let threw = false; try { await HC.auth.register({ user: u, pass: p }); } catch (e) { threw = true; } ok(threw, 'rejects ' + u + '/' + p);
  }
  // register
  const u = await HC.auth.register({ user: 'HeoCon_01', pass: 'mat-khau-123', display: 'Heo Hồng', mascot: 8 });
  ok(u === 'heocon_01', 'username is lower-cased');
  ok(HC.auth.user() === 'heocon_01' && HC.key('coins') === 'heocon_u_heocon_01_coins', 'per-account key');
  ok(HC.store.get('coins') === 1250000 && HC.store.get('name') === 'Heo Hồng' && HC.store.get('mascot') === 8 && HC.store.get('welcome') === true, 'starter data');
  ok(localStorage.getItem('heocon_coins') === '777', 'guest coins untouched');
  const acc = JSON.parse(localStorage.getItem('heocon_accounts')).heocon_01;
  ok(!JSON.stringify(acc).includes('mat-khau-123') && /^pbkdf2:[0-9a-f]{64}$/.test(acc.hash) && acc.salt.length === 32, 'password stored only as salted PBKDF2 hash');
  let dup = false; try { await HC.auth.register({ user: 'heocon_01', pass: 'another1' }); } catch (e) { dup = /đã có/.test(e.message); } ok(dup, 'duplicate username rejected');
  HC.store.set('coins', 4200000);
  // login
  HC.auth.logout();
  let bad = false; try { await HC.auth.login('heocon_01', 'wrong-pass'); } catch (e) { bad = /Sai mật khẩu/.test(e.message); } ok(bad, 'wrong password rejected');
  let none = false; try { await HC.auth.login('nobody', 'whatever1'); } catch (e) { none = /Không tìm thấy/.test(e.message); } ok(none, 'unknown user rejected');
  await HC.auth.login('  HEOCON_01 ', 'mat-khau-123', false);
  ok(HC.auth.user() === 'heocon_01' && HC.store.get('coins') === 4200000, 'login restores that account');
  ok(localStorage.getItem('heocon_session') === null && sessionStorage.getItem('heocon_session'), 'remember=false keeps the session for this tab only');
  ok(HC.auth.lastUser() === 'heocon_01', 'last user remembered for the login form');
  // second account is isolated
  HC.auth.logout(); await HC.auth.register({ user: 'meo.map', pass: 'meomeo99' });
  ok(HC.store.get('coins') === 1250000, 'second account has its own coins');
  // fallback hashing path (no WebCrypto)
  HC.auth.logout(); const subtle = crypto.subtle; Object.defineProperty(globalThis.crypto, 'subtle', { value: undefined, configurable: true });
  await HC.auth.register({ user: 'old_browser', pass: 'abcdef1' });
  ok(/^sha256x2000:/.test(JSON.parse(localStorage.getItem('heocon_accounts')).old_browser.hash), 'fallback hash used');
  HC.auth.logout(); await HC.auth.login('old_browser', 'abcdef1'); ok(HC.auth.user() === 'old_browser', 'fallback login works');
  Object.defineProperty(globalThis.crypto, 'subtle', { value: subtle, configurable: true });
  console.log(pass + ' passed, 0 failed');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
