/*
 * Language for every page: Vietnamese by default, English with ?lang=en (remembered) or the language setting.
 * The game is written in Vietnamese; in English mode this file translates what the player sees as it appears:
 * text in the page (MutationObserver), placeholders and tooltips, the tab title and text drawn on canvases
 * (3D table labels, minimap). Translations live in js/i18n-en.js (window.HC_EN).
 *
 * Lookup order for one piece of text: exact phrase → known names swapped and numbers lifted into {0}, {1}…
 * templates → split on " · " and translate each part → word list. Anything still Vietnamese is kept in
 * HC.i18n.misses (open the page with &i18nlog=1 and read window.__i18nMiss) so the list can be completed.
 * Loaded after js/hc-core.js and before the page's own scripts.
 */
(function () {
  'use strict';
  const HC = window.HC || (window.HC = {});
  const Q = new URLSearchParams(location.search);
  let lang = 'vi';
  try { lang = Q.get('lang') || localStorage.getItem('heocon_lang') || 'vi'; if (Q.get('lang')) localStorage.setItem('heocon_lang', Q.get('lang')); } catch (e) { lang = Q.get('lang') || 'vi'; }
  lang = lang === 'en' ? 'en' : 'vi';
  const VN = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;
  const misses = new Map();
  HC.lang = lang;
  HC.setLang = l => { try { localStorage.setItem('heocon_lang', l === 'en' ? 'en' : 'vi'); } catch (e) {} const u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u.href); };
  HC.i18n = { lang, misses, t: s => s };
  if (lang !== 'en') return;

  const D = window.HC_EN || { dict: {}, tpl: {}, names: {}, words: {} };
  const dict = D.dict, tpl = D.tpl, names = Object.assign({}, D.names);
  for (const [k, v] of Object.entries(D.names)) { names[k.toUpperCase()] = v.toUpperCase(); }   // shop signs and banners are in capitals
  for (const [k, v] of Object.entries(dict)) if (dict[k.toUpperCase()] == null) dict[k.toUpperCase()] = v.toUpperCase();
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameList = Object.keys(names).sort((a, b) => b.length - a.length);
  const NAME_RE = nameList.length ? new RegExp('(?<![\\p{L}])(?:' + nameList.map(esc).join('|') + ')(?![\\p{L}])', 'gu') : null;   // whole words only
  const wordList = Object.keys(D.words).sort((a, b) => b.length - a.length);
  const WORD_RE = wordList.length ? new RegExp('(^|[^\\p{L}])(' + wordList.map(esc).join('|') + ')(?=$|[^\\p{L}])', 'giu') : null;
  const lowerWords = Object.fromEntries(Object.entries(D.words).map(([k, v]) => [k.toLowerCase(), v]));
  const NUM_RE = /[+\-−]?\d[\d.,]*(?:\s?[KMB]\b)?%?/g;
  const NUM_OR_SLOT = new RegExp('\\{\\d+\\}|' + NUM_RE.source, 'g');
  const tplp = D.tplp || {}, TPLP = Object.keys(tplp).length > 0;
  const POS_RE = new RegExp((nameList.length ? '(?<![\\p{L}])(?:' + nameList.map(esc).join('|') + ')(?![\\p{L}])|' : '') + NUM_RE.source, 'gu');
  const RULES = (D.rules || []).map(([re, out]) => [new RegExp(re, 'u'), out]);
  function rules(s) { for (const [re, out] of RULES) { const m = s.match(re); if (m) return out.replace(/\{t(\d)\}/g, (_, i) => tr(m[+i]).trim()).replace(/\$(\d)/g, (_, i) => numEn(m[+i])); } return null; }
  /** Vietnamese number style → English: 1.250.000 → 1,250,000 and 1,5M → 1.5M. */
  const numEn = s => s.replace(/\d{1,3}(?:\.\d{3})+(?!\d)/g, m => m.replace(/\./g, ',')).replace(/(\d),(\d)([KMB])\b/g, '$1.$2$3');
  const cache = new Map();
  // Bingo caller lines spell the number in Vietnamese words ("hai mươi mốt" → "twenty-one")
  const VNUM = { 'không': 0, 'một': 1, 'mốt': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'tư': 4, 'năm': 5, 'lăm': 5, 'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9 };
  function viNum(w) {
    const t = w.toLowerCase().trim().split(/\s+/); let n = null;
    if (t[0] === 'mười') n = 10 + (t[1] != null ? VNUM[t[1]] : 0);
    else if (t[1] === 'mươi') n = VNUM[t[0]] * 10 + (t[2] != null ? VNUM[t[2]] : 0);
    else if (t.length === 1) n = VNUM[t[0]];
    return Number.isFinite(n) ? n : null;
  }
  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const enNum = n => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  const cap = w => w[0].toUpperCase() + w.slice(1);
  const LOTO = (D.loto || []).map(([k, v]) => [new RegExp('^' + esc(k).replace(/\\\{[wW]\\\}/, '(.+?)') + '$', 'i'), v]);
  function loto(s) {
    for (const [re, en] of LOTO) { const m = s.match(re); if (m) { const n = viNum(m[1]); if (n != null) return en.replace('{w}', enNum(n)).replace('{W}', cap(enNum(n))); } }
    const sp = s.match(/^(.+)… (.+)!$/); if (sp && dict[sp[1]] != null) { const n = viNum(sp[2]); if (n != null) return dict[sp[1]] + '… ' + cap(enNum(n)) + '!'; }
    return null;
  }

  function core(s) {
    if (dict[s] != null) return dict[s];
    // names and numbers become {0}, {1}… so one template covers every amount and every bot
    const vals = [];
    let k = NAME_RE ? s.replace(NAME_RE, m => { vals.push(names[m]); return '{' + (vals.length - 1) + '}'; }) : s;
    k = k.replace(NUM_OR_SLOT, m => { if (/^\{\d+\}$/.test(m)) return m; vals.push(numEn(m)); return '{' + (vals.length - 1) + '}'; });   // names already became {n}
    if (tpl[k] != null) return tpl[k].replace(/\{(\d+)\}/g, (_, i) => vals[+i] != null ? vals[+i] : '');
    if (dict[k] != null) return dict[k].replace(/\{(\d+)\}/g, (_, i) => vals[+i] != null ? vals[+i] : '');
    // templates taken from the source code number their holes left to right, names and numbers alike
    if (TPLP) {
      const pv = []; const kp = s.replace(POS_RE, m => { pv.push(names[m] != null ? names[m] : numEn(m)); return '{' + (pv.length - 1) + '}'; });
      if (tplp[kp] != null) return tplp[kp].replace(/\{(\d+)\}/g, (_, i) => pv[+i] != null ? pv[+i] : '');
    }
    if (!VN.test(k)) return k.replace(/\{(\d+)\}/g, (_, i) => vals[+i] != null ? vals[+i] : '');
    return loto(s) || rules(s);
  }
  function tr(text) {
    if (text == null) return text;
    const str = String(text);
    if (!str.trim()) return str;
    if (cache.has(str)) return cache.get(str);
    const lead = str.match(/^\s*/)[0], trail = str.match(/\s*$/)[0], s = str.trim();
    let out = /^[·•] /.test(s) ? s[0] + ' ' + tr(s.slice(2)).trim() : core(s);   // "· text" pieces of a status line
    if (out == null) {
      for (const sep of [' · ', ' — ', ' - ', ': ', '\n']) {
        if (!s.includes(sep)) continue;
        const parts = s.split(sep).map(p => { const r = core(p.trim()); return r == null ? null : r; });
        if (parts.every(p => p != null)) { out = parts.join(sep); break; }
      }
    }
    if (out == null) {       // word list as a last resort, and remember the sentence so it can get a real translation
      misses.set(s, (misses.get(s) || 0) + 1);
      let w = NAME_RE ? s.replace(NAME_RE, m => names[m]) : s;
      if (WORD_RE) w = w.replace(WORD_RE, (m, pre, word) => pre + (lowerWords[word.toLowerCase()] || word));
      out = w;
    }
    out = lead + numEn(out) + trail;
    if (cache.size > 5000) cache.clear();
    cache.set(str, out);
    return out;
  }
  HC.i18n.t = tr; HC.t = tr;

  // game icons with English titles (tools/gen_icons.py with HC_ICON_LANG=en)
  if (HC.A) { const A0 = HC.A; HC.A = p => A0(typeof p === 'string' ? p.replace(/^games\/lobby-icons\//, 'games/lobby-icons-en/') : p); }
  // numbers and short amounts in English style
  HC.fmt = n => Math.round(n).toLocaleString('en-US');
  if (HC.short) { const sh = HC.short; HC.short = n => sh(n).replace(',', '.'); }

  // ---------------------------------------------------------------- page text
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
  const done = new WeakMap();
  function textNode(n) {
    const v = n.nodeValue; if (!v || !v.trim() || done.get(n) === v) return;
    const p = n.parentNode; if (p && (SKIP.has(p.nodeName) || p.isContentEditable)) return;
    const t = tr(v); done.set(n, t); if (t !== v) n.nodeValue = t;
  }
  const ATTRS = ['placeholder', 'title', 'aria-label', 'data-tip'];
  function attrs(el) { for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && VN.test(v)) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } } }   // only real changes, or the observer would loop
  function walk(root) {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
    attrs(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = it.nextNode(); n; n = it.nextNode()) { if (n.nodeType === 3) textNode(n); else attrs(n); }
  }
  const mo = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') textNode(m.target);
      else if (m.type === 'attributes') attrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  });
  function start() {
    document.documentElement.lang = 'en';
    walk(document.body || document.documentElement);
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  // tab title
  const td = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
  if (td && td.set) Object.defineProperty(document, 'title', { get() { return td.get.call(this); }, set(v) { td.set.call(this, tr(v)); }, configurable: true });
  if (document.title) document.title = document.title;
  // text drawn on canvases (3D labels, minimap, wheels)
  const C2 = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (C2) for (const f of ['fillText', 'strokeText', 'measureText']) { const o = C2[f]; C2[f] = function (txt, ...a) { return o.call(this, typeof txt === 'string' ? tr(txt) : txt, ...a); }; }
  // alert / confirm / prompt
  for (const f of ['alert', 'confirm', 'prompt']) { const o = window[f]; if (o) window[f] = (m, ...a) => o.call(window, tr(m), ...a); }
  if (Q.get('i18nlog')) window.__i18nMiss = misses;
})();
