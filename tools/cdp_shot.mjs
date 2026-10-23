// Real-time headless screenshot through the Chrome DevTools Protocol (no virtual time, so images and timers behave
// like a normal browser). Useful for moments that only last a few seconds, e.g. Tiến Lên poses.
// usage: node tools/cdp_shot.mjs "<page.html?query>" <out.png> [W,H] [--title=POSED] [--wait=1500] [--max=60000]
//   --title  wait until document.title equals this value (the page signals that it reached the pose)
//   --wait   extra milliseconds before the capture;  --max  give up waiting for the title after this long
//   --eval   a JS expression evaluated just before the capture; its JSON value is printed (for debugging)
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [page, out, size = '1920,1080', ...rest] = process.argv.slice(2);
if (!page || !out) { console.error('usage: node tools/cdp_shot.mjs "<page.html?query>" <out.png> [W,H] [--title=X] [--wait=ms] [--max=ms]'); process.exit(1); }
const opt = Object.fromEntries(rest.map(a => { const i = a.indexOf('='); return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)]; }));
const [w, h] = size.split(',').map(Number);
const [file, query = ''] = page.split('?');
const url = pathToFileURL(path.join(ROOT, file)).href + (query ? '?' + query : '');
const prof = mkdtempSync(path.join(tmpdir(), 'cdp-shot-'));
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--mute-audio', '--hide-scrollbars', '--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  `--user-data-dir=${prof}`, `--window-size=${w},${h}`, `--remote-debugging-port=${port}`, url], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const done = async code => { try { chrome.kill(); } catch {} await sleep(400); rmSync(prof, { recursive: true, force: true }); process.exit(code); };

let target;
for (let i = 0; i < 150 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
}
if (!target) { console.error('Chrome did not start'); await done(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++seq; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

const t0 = Date.now(), max = +(opt.max || 60000);
let reached = !opt.title;
while (!reached && Date.now() - t0 < max) {
  const r = await send('Runtime.evaluate', { expression: 'document.title' });
  if (r.result && r.result.value === opt.title) reached = true; else await sleep(250);
}
await sleep(+(opt.wait || 1500));
if (opt.eval) {
  const r = await send('Runtime.evaluate', { expression: opt.eval, returnByValue: true, awaitPromise: true });
  console.log('eval:', JSON.stringify(r.result ? r.result.value : r));
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(`${out}  ${Math.round((Date.now() - t0) / 1000)}s${opt.title ? (reached ? '  (pose reached)' : '  (title NOT reached)') : ''}`);
ws.close();
await done(reached ? 0 : 2);
